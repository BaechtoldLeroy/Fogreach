// tests/debugAuftragRaeume.test.js — die Auftrags-Adressen aus docs/debug-modus.md
// ("Nebenauftraege der Akte 3 und 4") muessen im Keller Gegner bringen.
//
// Gemeldet (b497): ?debug=1&auftrag=klerus_brueder&dungeon=15&sonder=beschwoerer
// "spawnt keine Gegner mehr". ?sonder= schaltet die Welle ab und stellt nur
// den Beschwoerer hin — der wurde aber gesetzt, BEVOR der neue Raum seine
// begehbare Flaeche kannte. spawnEnemy pruefte gegen den Vorraum, und der
// Beschwoerer stand in den Folgeraeumen meist in einer Wand: unsichtbar,
// unerreichbar, der Raum fuer den Spieler leer.
//
// Geprueft am Verhalten: in jedem Raum steht der Beschwoerer auf begehbarem
// Boden DIESES Raums, und ihn zu erschlagen zaehlt fuer den Auftrag. Ohne
// ?sonder= kommen Wellen. Die anderen Auftrags-Adressen: Gegner bzw. Raum-Modus.

const { test, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GS = `window.game.scene.getScene('GameScene')`;
const offen = [];
after(async () => { for (const h of offen) { try { await h.shutdown(); } catch (e) {} } });

async function keller(tiefe, zusatz) {
  const h = await launchDungeon({ depth: tiefe, zusatz });
  offen.push(h);
  h.run('window._playerInvincible = true');
  return h;
}

/** Naechster Raum ueber den echten Raumaufbau; Reste des alten raeumt enterRoom. */
function weiter(h, raum) { h.run(`enterRoom(${GS}, ${raum})`); h.step(30); }

/** Was im Raum steht: Gegner, wer davon auf begehbarem Boden, Raum-Modus. */
function raumBild(h) {
  return JSON.parse(h.run(`JSON.stringify((function () {
    var sc = ${GS}, b = sc.physics.world.bounds;
    var es = enemies.getChildren().filter(function (e) { return e && e.active; });
    var drin = function (e) { return e.x >= b.x && e.y >= b.y && e.x <= b.right && e.y <= b.bottom; };
    return {
      raum: window.currentRoomId,
      gegner: es.length,
      beschwoerer: es.filter(function (e) { return e.enemyType === 13; }).map(function (e) {
        return { x: Math.round(e.x), y: Math.round(e.y), begehbar: !!sc.isPointAccessible(e.x, e.y), drin: drin(e), sonder: !!e._debugSonder };
      }),
      modus: window.RoomMode.activeModeId()
    };
  })())`));
}

const klerusZiel = (h) => h.run(`(function () {
  var q = window.questSystem.getQuestSaveData().quests.klerus_brueder;
  return q ? q.status + ' ' + q.objectives[0].current + '/' + q.objectives[0].required : 'fehlt';
})()`);

test('Gemeldete Adresse: in jedem Raum steht der Beschwoerer begehbar, Erschlagen zaehlt', async () => {
  const h = await keller(15, '&debug=1&auftrag=klerus_brueder&sonder=beschwoerer');
  assert.strictEqual(klerusZiel(h), 'active 0/3', 'der Auftrag laeuft nicht');
  for (let raum = 0; raum < 5; raum++) {
    if (raum > 0) weiter(h, raum);
    const bild = raumBild(h);
    assert.strictEqual(bild.raum, raum);
    const gesetzt = bild.beschwoerer.filter((b) => b.sonder);
    assert.strictEqual(gesetzt.length, 1, 'Raum ' + raum + ': kein Beschwoerer von ?sonder= ' + JSON.stringify(bild));
    assert.ok(gesetzt[0].drin && gesetzt[0].begehbar,
      'Raum ' + raum + ': der Beschwoerer steht in der Wand oder ausserhalb des Raums ' + JSON.stringify(bild));
    // Erschlagen ueber den echten Trefferweg (handleEnemyHit meldet kill:typ_13).
    const vorher = klerusZiel(h);
    h.run(`(function () { var sc = ${GS};
      enemies.getChildren().filter(function (e) { return e && e.active && e._debugSonder; })
        .forEach(function (e) { e.hp = 0; handleEnemyHit(sc, e, {}); }); })()`);
    h.step(10);
    if (raum < 3) {
      assert.strictEqual(klerusZiel(h), 'active ' + (raum + 1) + '/3', 'Raum ' + raum + ': der Kill zaehlt nicht (vorher ' + vorher + ')');
    }
  }
  assert.strictEqual(h.run(`window.questSystem.isQuestReadyToComplete('klerus_brueder')`), true);
});

test('Ohne ?sonder=: mit laufendem Auftrag kommen Wellen, Beschwoerer ziehen schwerer', async () => {
  const h = await keller(15, '&debug=1&auftrag=klerus_brueder');
  assert.strictEqual(klerusZiel(h), 'active 0/3');
  assert.strictEqual(h.run(`window.questSystem.getAuftragsSchub('gegner')[13]`), 4, 'kein Schub fuer Beschwoerer');
  for (let raum = 0; raum < 3; raum++) {
    if (raum > 0) weiter(h, raum);
    const bild = raumBild(h);
    assert.ok(bild.gegner > 0, 'Raum ' + raum + ' ohne Welle: ' + JSON.stringify(bild));
    assert.ok(bild.beschwoerer.every((b) => !b.sonder), 'ohne ?sonder= steht ein Debug-Beschwoerer');
  }
});

// Die uebrigen Keller-Adressen der Tabelle (Thoms Edikt laeuft im Hub, siehe
// tests/debugAuftrag.test.js). Jeder Raum: Gegner da oder der Modus laeuft.
[
  { id: 'mara_kreide', tiefe: 18, zusatz: '&kreide=1' },
  { id: 'elara_schloesser', tiefe: 21, zusatz: '&event=chain_lock' },
  { id: 'wache_helm', tiefe: 24, zusatz: '&schar=1' },
  { id: 'mara_letzte_fuhre', tiefe: 28, zusatz: '&mode=hunt', modus: 'hunt' },
  { id: 'branka_schmiede_halten', tiefe: 27, zusatz: '&mode=defend', modus: 'defend' },
].forEach((f) => {
  test(f.id + f.zusatz + ': der Auftrag laeuft, in jedem Raum Gegner bzw. der Modus', async () => {
    const h = await keller(f.tiefe, '&debug=1&auftrag=' + f.id + f.zusatz);
    assert.strictEqual(h.run(`(window.questSystem.getQuestSaveData().quests['${f.id}'] || {}).status`), 'active');
    for (let raum = 0; raum < 2; raum++) {
      if (raum > 0) weiter(h, raum);
      const bild = raumBild(h);
      if (raum === 0 && f.modus) assert.strictEqual(bild.modus, f.modus, '?mode= greift nicht');
      assert.ok(bild.gegner > 0 || bild.modus !== 'clear', 'Raum ' + raum + ' leer: ' + JSON.stringify(bild));
    }
  });
});
