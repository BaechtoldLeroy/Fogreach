// tests/beuteDaempfung.test.js — wie viel Ausruestung ein Lauf abwirft.
//
// Es gibt KEINE harte Grenze, nur eine Bremse: je mehr echte Ausruestung in
// einem Lauf schon gefallen ist, desto seltener faellt weitere.
//
//   ab dem 3. Stueck   30 Prozent der Chance
//   ab dem 6. Stueck   20 Prozent
//
// MINIBOSSE sind ausgenommen: sie sind der Grund, einen Raum zu kaempfen statt
// ihn zu durchqueren, und sollen spaet im Lauf nicht weniger wert sein.
//
// Wie hier gemessen wird: der Wurf ist `Math.random() * 100 < schwelle`. Haelt
// man Math.random fest, faellt genau dann etwas, wenn der feste Wert unter der
// Schwelle liegt — eine Intervallschachtelung findet die WIRKSAME Schwelle auf
// zwei Nachkommastellen.
//
// Das ist immer noch eine Messung am laufenden Spiel und keine Pruefung des
// Quelltexts: sie fragt, was beim Wurf herauskommt. Der frueher hier stehende
// Weg ueber 5000 Stichproben je Messung sagte dasselbe, nur mit so viel
// Rauschen, dass die Toleranzen bei +/- 20 Prozentpunkten lagen — bei
// Elite-Gegnern (2 % Grundchance) haette er den Unterschied zwischen 30 und
// 50 Prozent gar nicht mehr aufgeloest.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=10', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Wie oft faellt bei N Toetungen Ausruestung, wenn der Laufzaehler auf `schon`
 * steht? Der Zaehler wird VOR jedem Wurf zurueckgesetzt, damit die Messung
 * genau eine Stufe der Bremse trifft.
 */
function trefferQuote(schon, gegnerArt, versuche) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var gefallen = 0;
    var AUS = { weapon: 1, offhand: 1, head: 1, body: 1, boots: 1 };
    var orig = window.randomLoot;
    window.randomLoot = function () {
      var it = orig.apply(this, arguments);
      if (it && AUS[it.type]) gefallen++;
      return it;
    };
    for (var i = 0; i < ${versuche}; i++) {
      window.__runItemsDropped = ${schon};
      try { spawnLoot.call(sc, 400, 300, null, ${JSON.stringify(gegnerArt)}); } catch (e) {}
    }
    window.randomLoot = orig;
    window.__runItemsDropped = 0;
    return gefallen / ${versuche};
  })()`);
}

/**
 * Die WIRKSAME Abwurfschwelle in Prozent, per Intervallschachtelung.
 *
 * Zaehlt wird, ob randomLoot ueberhaupt gerufen wird — das passiert nur, wenn
 * der Wurf durchkommt. Ueber die Art des Stuecks sagt das nichts, und das ist
 * hier auch nicht die Frage.
 */
function wirksameSchwelle(gegnerArt, schon) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var art = ${JSON.stringify(gegnerArt)};
    function faellt(wert) {
      var gerufen = false;
      var origLoot = window.randomLoot;
      var origRnd = Math.random;
      window.randomLoot = function () { gerufen = true; return null; };
      Math.random = function () { return wert; };
      window.__runItemsDropped = ${schon};
      try { spawnLoot.call(sc, 400, 300, null, art); } catch (e) {}
      Math.random = origRnd;
      window.randomLoot = origLoot;
      window.__runItemsDropped = 0;
      return gerufen;
    }
    if (!faellt(0)) return 0;
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var m = (lo + hi) / 2;
      if (faellt(m)) lo = m; else hi = m;
    }
    return Math.round(lo * 100 * 100) / 100;
  })()`);
}

test('Ab dem 3. Stueck bleiben 30 Prozent der Chance', () => {
  const voll = wirksameSchwelle({ isElite: true }, 0);
  const gebremst = wirksameSchwelle({ isElite: true }, 3);
  assert.strictEqual(voll, 2, 'die Grundchance eines Elite ist nicht mehr 2 %: ' + voll);
  assert.strictEqual(gebremst, 0.6,
    'ab dem 3. Stueck stehen ' + gebremst + ' % statt 0,6 % (30 % von 2 %)');
});

test('Ab dem 6. Stueck bleiben 20 Prozent', () => {
  const gebremst = wirksameSchwelle({ isElite: true }, 6);
  assert.strictEqual(gebremst, 0.4,
    'ab dem 6. Stueck stehen ' + gebremst + ' % statt 0,4 % (20 % von 2 %)');
});

test('Bei 2 Stuecken bremst noch nichts', () => {
  // Die Grenze liegt bei DREI. Ein Off-by-one waere hier am leichtesten
  // passiert — vorher setzte die Bremse tatsaechlich erst ab vier ein.
  assert.strictEqual(wirksameSchwelle({ isElite: true }, 2), 2,
    'bei 2 Stuecken wird schon gebremst');
});

test('Auch der normale Gegner wird gebremst, nicht nur der Elite', () => {
  // Sonst haenge die Bremse an einer Gegnerart statt am Beutestrom.
  assert.strictEqual(wirksameSchwelle({}, 0), 0.5, 'die Grundchance ist nicht mehr 0,5 %');
  assert.strictEqual(wirksameSchwelle({}, 3), 0.15, 'ab 3 Stuecken stimmt es nicht');
  assert.strictEqual(wirksameSchwelle({}, 6), 0.1, 'ab 6 Stuecken stimmt es nicht');
});

test('Der Miniboss ist von der Bremse AUSGENOMMEN', () => {
  // Er ist der Grund, einen Raum zu kaempfen statt ihn zu durchqueren. Wer
  // spaet im Lauf einen erlegt, soll nicht dafuer bestraft werden, dass er
  // vorher fleissig war.
  //
  // Diese Ausnahme ist — anders als der frueher hier stehende !isBossDrop-Zweig
  // — wirksam: der Wurf eines Minibosses wird wirklich befragt.
  const voll = wirksameSchwelle({ isMiniBoss: true }, 0);
  assert.strictEqual(voll, 6, 'die Grundchance eines Minibosses ist nicht mehr 6 %: ' + voll);
  [3, 6, 12].forEach((schon) => {
    assert.strictEqual(wirksameSchwelle({ isMiniBoss: true }, schon), voll,
      'nach ' + schon + ' Stuecken faellt der Miniboss auf '
      + wirksameSchwelle({ isMiniBoss: true }, schon) + ' % statt auf ' + voll + ' %');
  });
});

test('Der Boss laesst IMMER etwas fallen, egal wie viel schon gefallen ist', () => {
  // Er ist der Hoehepunkt einer Tiefe und erscheint nur alle zehn. Die Bremse
  // erreicht ihn gar nicht: sein Wurf wird nie befragt.
  //
  // Genau das war der Grund, den frueheren !isBossDrop-Zweig zu entfernen — er
  // sah aus wie eine Ausnahme, war aber wirkungslos, und keine Mutation konnte
  // ihn zum Fallen bringen. Was hier zaehlt, ist die Garantie.
  const frisch = trefferQuote(0, { isBoss: true }, 200);
  const spaet = trefferQuote(9, { isBoss: true }, 200);
  assert.strictEqual(frisch, 1, 'der Boss laesst nicht immer etwas fallen: ' + frisch);
  assert.strictEqual(spaet, 1,
    'nach 9 Stuecken laesst der Boss nur noch in ' + (spaet * 100).toFixed(0) + ' % der Faelle etwas fallen');
});

test('Der Zaehler wird bei jedem neuen Lauf zurueckgesetzt', () => {
  // Ohne das truege man die Bremse aus dem letzten Lauf in den naechsten.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');
  assert.ok(/__runItemsDropped\s*=\s*0/.test(quelle),
    'der Laufzaehler wird nirgends zurueckgesetzt');
});

test('Ein Drittel der fallenden Rollen ist eine Treppenrolle', () => {
  // Die Treppenrolle war nur bei Mara zu kaufen und tauchte im Lauf nie auf,
  // obwohl sie genau dort nuetzt — sie bringt einen zur naechsten Treppe.
  //
  // Der Anteil kommt aus DEMSELBEN Wurf wie die Portalrolle, nicht aus einem
  // eigenen: sonst haette sich die Gesamtzahl der Rollen erhoeht, und das war
  // nicht gewollt. Genau das prueft die letzte Zusicherung.
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 10; window.currentWave = 10;
    var z = { portal: 0, treppe: 0, gesamt: 0 };
    for (var i = 0; i < 20000; i++) {
      var it = window.randomLoot(1, null);
      if (!it) continue;
      z.gesamt++;
      if (it.key === 'PORTAL_SCROLL') z.portal++;
      else if (it.key === 'STAIR_SCROLL') z.treppe++;
    }
    return z;
  })()`);
  const rollen = r.portal + r.treppe;
  assert.ok(rollen > 300, 'zu wenige Rollen gemessen: ' + rollen);
  const anteil = r.treppe / rollen;
  assert.ok(Math.abs(anteil - 1 / 3) < 0.06,
    (anteil * 100).toFixed(1) + ' % der Rollen sind Treppenrollen, erwartet rund 33');

  // Und der Anteil ALLER Rollen an der Beute darf sich nicht geaendert haben:
  // die Treppenrolle teilt sich den Wurf mit der Portalrolle (roll 90..92),
  // sie kommt nicht dazu.
  const anteilRollen = rollen / r.gesamt;
  assert.ok(Math.abs(anteilRollen - 0.03) < 0.01,
    'Rollen machen ' + (anteilRollen * 100).toFixed(1) + ' % der Beute aus, erwartet rund 3');
});

test('Die Treppenrolle hat ein eigenes Symbol und einen eigenen Namen', () => {
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 10; window.currentWave = 10;
    var probe = null;
    for (var k = 0; k < 20000 && !probe; k++) {
      var x = window.randomLoot(1, null);
      if (x && x.key === 'STAIR_SCROLL') probe = { name: x.name, icon: x.iconKey, mat: x.materialKey };
    }
    return { probe: probe,
             texturTreppe: window.game.textures.exists('itStairScroll'),
             texturPortal: window.game.textures.exists('itPortalScroll') };
  })()`);
  assert.ok(r.probe, 'in 20 000 Wuerfen fiel keine Treppenrolle');
  assert.strictEqual(r.probe.icon, 'itStairScroll',
    'die Treppenrolle traegt das Symbol ' + r.probe.icon);
  assert.notStrictEqual(r.probe.icon, 'itPortalScroll',
    'sie teilt sich das Symbol mit der Portalrolle');
  assert.strictEqual(r.probe.mat, 'STAIR_SCROLL',
    'sie zaehlt auf den falschen Vorrat: ' + r.probe.mat);
  assert.ok(r.probe.name && r.probe.name.indexOf('MISSING') < 0,
    'der Name fehlt in der Sprachtabelle: ' + r.probe.name);
  assert.strictEqual(r.texturTreppe, true, 'das Symbol wurde nie gezeichnet');
  assert.strictEqual(r.texturPortal, true, 'die Portalrolle hat ihr Symbol verloren');
});
