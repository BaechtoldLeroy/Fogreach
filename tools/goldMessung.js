/**
 * tools/goldMessung.js — ein durchgehender Aufstieg von Tiefe 1 nach unten (#132).
 *
 * Das Gold-Gleichgewicht war nie als Ganzes durchgerechnet. Die Formel kennt
 * man (js/loot.js, _rollEnemyGoldDrop), den tatsaechlichen Zufluss ueber einen
 * gespielten Durchgang nicht — und der haengt an Dingen, die keine Formel
 * hergibt: wie viele Gegner ein Raum hat, wie viele Truhen darin stehen, wie
 * oft ein Mini-Boss kommt, wie schnell man ueberhaupt durchkommt.
 *
 * EIN Durchgang, nicht sieben Stichproben: der Bot startet auf Tiefe 1 mit
 * Startausruestung und nimmt Gold UND Ausruestung mit nach unten. Er wird also
 * staerker, weil er spielt — genau wie ein Spieler.
 *
 * Ein erster Anlauf gab dem Bot stattdessen den Debug-Kraftaufschlag
 * (?stark=). Das war der falsche Weg: es misst, was ein fertig ausgeruesteter
 * Charakter verdient, nicht was man auf dem Weg dorthin zusammentraegt — und
 * genau das ist die Frage.
 *
 * Gemessen wird durch die ECHTEN Pfade (LootSystem.grantGold), nicht
 * nachgerechnet. Stirbt der Bot oder kommt er nicht weiter, ist DAS das
 * Ergebnis — abgebrochen wird ehrlich, nicht geschoent.
 *
 * Aufruf:
 *   node tools/goldMessung.js                    Tiefe 1..30
 *   node tools/goldMessung.js --bis 15           nur bis Tiefe 15
 *   node tools/goldMessung.js --raeume 3         Raeume je Tiefe
 */
'use strict';

const { launch } = require('./headless/index.js');

/**
 * EINE TIEFE IST GANZ ODER GAR NICHT.
 *
 * Der erste Anlauf nahm zwei Raeume je Tiefe als Stichprobe. Das war zu
 * wenig, und zwar nicht ein bisschen: eine Tiefe hat 7 bis 12 Raeume
 * (roomManager.js, computeRunRoomCount), und der BOSS steht im LETZTEN
 * (roomManager.js:1356, __isFinalDungeonRoom). Zwei Raeume sind also ein
 * Viertel der Tiefe — ohne den Hoehepunkt, ohne den garantierten Boss-Abwurf
 * und ohne die Belohnung des Endraums. Gemessen bei erzwungener Tiefe 10 und
 * 20: null Bosse, null Mini-Bosse in den ersten Raeumen.
 *
 * Darum laeuft jede Tiefe jetzt bis in den Endraum. Gemessen fuer Tiefe 1
 * (7 Raeume): rund 2250 Runden, gut drei Minuten. Tiefere Ebenen haben mehr
 * Raeume, deshalb das grosszuegige Budget unten — es ist eine Notbremse,
 * kein Richtwert.
 */
const BUDGET_JE_TIEFE = 4000;

/**
 * Je Raum ZWEI Abschnitte, und das ist der Kern der Messung.
 *
 * play() ist ein Schnelldurchlauf: steht die Treppe offen, rennt der Bot
 * hin. Gemessen ueber 250 Runden waren das 0 Kills, 5 Truhen, 3 Treppen —
 * beim Verlassen standen noch 28 Gegner im Raum. So gemessen kaeme heraus,
 * was Truhen abwerfen, nicht was das Spiel abwirft.
 *
 * Nur zu kaempfen geht aber genauso wenig: die Wellen laufen weiter, der
 * Raum wird nie leer, und der Bot kommt nie zur Treppe (gemessen: 250 Runden
 * raeumen, 0 Treppen). Ein Spieler raeumt auf, was da ist, und geht dann —
 * also erst kaempfen, dann weiterziehen.
 */
const KAMPF_RUNDEN = 140;
const LAUF_RUNDEN = 110;

function _zahlen(H) {
  return H.run(`(function () {
    var angelegt = 0;
    try {
      Object.keys(equipment || {}).forEach(function (k) { if (equipment[k]) angelegt++; });
    } catch (e) {}
    return {
      gold: window.LootSystem.getGold(),
      zufluss: window.__goldZu || 0,
      zufluesse: window.__goldEreignisse || 0,
      schaden: (typeof weaponDamage === 'number') ? Math.round(weaponDamage * 10) / 10 : null,
      leben: (typeof playerMaxHealth === 'number') ? playerMaxHealth : null,
      lebt: !!(typeof player !== 'undefined' && player && player.active),
      angelegt: angelegt,
      imBeutel: Array.isArray(window.inventory) ? window.inventory.filter(Boolean).length : 0
    };
  })()`);
}

/** Stehen wir im Endraum der Tiefe, und lebt dort noch etwas? */
function _endraum(H) {
  return H.run(`(function () {
    var a = [];
    try {
      a = enemies.getChildren().filter(function (e) { return e && e.active; });
    } catch (e) {}
    return {
      final: !!window.__isFinalDungeonRoom,
      gegner: a.length,
      bosse: a.filter(function (e) { return e.isBoss; }).length,
      mini: a.filter(function (e) { return e.isMiniBoss; }).length
    };
  })()`);
}

function _setzeTiefe(H, tiefe) {
  return H.run(`(function () {
    window.DUNGEON_DEPTH = ${tiefe};
    window.SELECTED_WAVE_OVERRIDE = ${tiefe};
    if (typeof currentWave !== 'undefined') currentWave = ${tiefe};
    window.game.scene.getScene('GameScene').scene.restart();
    return 1;
  })()`);
}

async function aufstieg(bisTiefe, budgetJeTiefe) {
  const H = await launch({
    search: '?autostart=1&dungeon=1',
    renderer: 'canvas',
    waitFor: 'StartScene'
  });
  const ok = await H.waitForScene('GameScene', { maxRounds: 400 });
  if (!ok) { await H.shutdown(); throw new Error('GameScene wurde nicht erreicht'); }

  // Zaehler scharfstellen. grantGold ist der einzige Weg, auf dem Gold beim
  // Spieler ankommt — Bodenfunde, Ereignisse und Questlohn laufen alle darueber.
  H.run(`(function () {
    var LS = window.LootSystem;
    LS.spendGold(LS.getGold() || 0);
    window.__goldZu = 0;
    window.__goldEreignisse = 0;
    if (!window.__goldHaken) {
      window.__goldHaken = true;
      var orig = LS.grantGold;
      LS.grantGold = function (n) {
        if (typeof n === 'number' && n > 0) { window.__goldZu += n; window.__goldEreignisse++; }
        return orig.apply(this, arguments);
      };
    }
    return 1;
  })()`);

  const zeilen = [];
  let letzterZufluss = 0;
  let letzteKills = H.kills();
  let fehler = 0;

  try {
    for (let tiefe = 1; tiefe <= bisTiefe; tiefe++) {
      if (tiefe > 1) {
        _setzeTiefe(H, tiefe);
        await H.settle(() => false, { maxRounds: 60 });
      }
      // Bis in den Endraum — erst kaempfen, dann weiterziehen. Im Endraum
      // wird nur noch gekaempft, bis nichts mehr steht: dort haengt der Boss.
      let truhen = 0;
      let raeume = 0;
      let budget = budgetJeTiefe;
      let bossGesehen = false;
      let miniGesehen = false;
      let imEndraum = 0;
      while (budget > 0 && _zahlen(H).lebt) {
        const a = await H.bot.play({ rounds: KAMPF_RUNDEN, raeumen: true });
        truhen += a.chestsBroken || 0;
        raeume += a.roomsEntered || 0;
        budget -= KAMPF_RUNDEN;
        if (!_zahlen(H).lebt) break;

        const e = _endraum(H);
        if (e.bosse) bossGesehen = true;
        if (e.mini) miniGesehen = true;
        if (e.final) {
          // Angekommen. Noch drei Kampfabschnitte, dann ist der Boss
          // entweder tot oder es geht ohnehin nicht mehr weiter.
          imEndraum++;
          if (e.gegner === 0 || imEndraum > 3) break;
          continue;
        }
        const b = await H.bot.play({ rounds: LAUF_RUNDEN });
        truhen += b.chestsBroken || 0;
        raeume += b.roomsEntered || 0;
        budget -= LAUF_RUNDEN;
      }
      const z = _zahlen(H);
      const kills = H.kills() - letzteKills;
      letzteKills = H.kills();
      const verdient = z.zufluss - letzterZufluss;
      letzterZufluss = z.zufluss;

      zeilen.push({
        tiefe: tiefe, verdient: verdient, beutel: z.gold, kills: kills,
        schaden: z.schaden, leben: z.leben, angelegt: z.angelegt,
        imBeutel: z.imBeutel, lebt: z.lebt, raeume: raeume, truhen: truhen,
        boss: bossGesehen, mini: miniGesehen,
        verbraucht: budgetJeTiefe - budget, budget: budgetJeTiefe
      });
      process.stdout.write('  Tiefe ' + String(tiefe).padStart(2) + ': '
        + String(verdient).padStart(5) + ' Gold verdient, Beutel ' + String(z.gold).padStart(6)
        + ', Schaden ' + String(z.schaden).padStart(5)
        + ', ' + String(kills).padStart(3) + ' Kills'
        + ', ' + String(raeume).padStart(2) + ' Raeume'
        + (bossGesehen ? ', BOSS' : (miniGesehen ? ', Mini' : ''))
        + (z.lebt ? '' : '   << gestorben') + '\n');
      if (!z.lebt) break;
    }
  } finally {
    fehler = H.hardErrors().length;
    await H.shutdown();
  }
  return { zeilen: zeilen, fehler: fehler };
}

function tabelle(zeilen) {
  const kopf = ['Tiefe', 'verdient', 'Beutel', 'Kills', 'Truhen', 'Raeume',
    'Klimax', 'Gold/Kill', 'Schaden', 'Max-LP', 'angelegt', 'Runden'];
  const daten = zeilen.map((z) => [
    String(z.tiefe), String(z.verdient), String(z.beutel), String(z.kills),
    String(z.truhen || 0), String(z.raeume || 0),
    z.boss ? 'Boss' : (z.mini ? 'Mini' : '-'),
    z.kills ? (z.verdient / z.kills).toFixed(1) : '-',
    String(z.schaden), String(z.leben), String(z.angelegt),
    // Ein Stern heisst: die Notbremse hat gegriffen, die Tiefe wurde NICHT
    // fertig gespielt. Ohne diese Spalte saehe eine abgebrochene Tiefe aus
    // wie eine karge.
    String(z.verbraucht || 0) + ((z.verbraucht >= z.budget) ? '*' : '')
  ]);
  const breiten = kopf.map((k, i) => Math.max(k.length, ...daten.map((r) => r[i].length)));
  const zeile = (r) => r.map((c, i) => c.padStart(breiten[i])).join('  ');
  console.log('');
  console.log(zeile(kopf));
  console.log(breiten.map((b) => '-'.repeat(b)).join('  '));
  daten.forEach((r) => console.log(zeile(r)));
}

async function main() {
  const args = process.argv.slice(2);
  const zahl = (flagge, vorgabe) => {
    const i = args.indexOf(flagge);
    return (i >= 0) ? (parseInt(args[i + 1], 10) || vorgabe) : vorgabe;
  };
  const bis = zahl('--bis', 30);
  const budget = zahl('--budget', BUDGET_JE_TIEFE);

  console.log('Gold-Messung: ein durchgehender Aufstieg von Tiefe 1 bis ' + bis);
  console.log('Jede Tiefe wird bis in den Endraum gespielt (Notbremse: '
    + budget + ' Runden).');
  console.log('Der Bot nimmt Gold UND Ausruestung mit — er wird staerker, weil er spielt.');
  console.log('');

  const erg = await aufstieg(bis, budget);
  if (erg.zeilen.length) tabelle(erg.zeilen);
  if (erg.zeilen.some((z) => z.verbraucht >= z.budget)) {
    console.log('\n* = Notbremse gegriffen: diese Tiefe wurde nicht zu Ende gespielt.');
  }
  if (erg.fehler) console.log('\nKonsolenfehler waehrend des Laufs: ' + erg.fehler);
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { aufstieg };
