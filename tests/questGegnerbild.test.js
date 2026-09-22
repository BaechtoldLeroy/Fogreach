// tests/questGegnerbild.test.js — Auftraege mit eigenem Gegnerbild (#79).
//
// Solange "Ueberwachung" (council_surveillance) aktiv ist, bewacht der Rat die
// Kammern: Kellerwaechter, dazu Alarmwichte als Spaeher. Ausserhalb der Quest
// und im Finalraum bleibt es beim normalen Tiefen-/Akt-Pool.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

loadGameModule('js/enemySpawnGating.js');
const G = globalThis.window.EnemySpawnGating;

test('questProfil: nur fuer Quests mit eigenem Profil', () => {
  assert.deepStrictEqual(G.questProfil(['aldric_cleanup', 'council_surveillance']), [2, 2, 2, 16, 3]);
  assert.strictEqual(G.questProfil(['aldric_cleanup']), null);
  assert.strictEqual(G.questProfil([]), null);
  assert.strictEqual(G.questProfil(undefined), null);
});

test('Das Profil der Ueberwachung: Kellerwaechter ueberwiegen, keine Kettenwache vor dem Bruch', () => {
  const p = G.QUEST_PROFILE.council_surveillance;
  const waechter = p.filter((t) => t === 2).length;
  assert.ok(waechter > p.length / 2, 'Kellerwaechter nicht in der Mehrheit: ' + p.join(','));
  assert.ok(!p.includes(6), 'Kettenwache gehoert erst zum Bruch (#162)');
});

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 8 });
  H.lab.setDepth(8, 8);
});
after(async () => { if (H) await H.shutdown(); });
beforeEach(() => { H.lab.clearEnemies(); });

/** 120 Gegner ohne Typ erzeugen und nach Typ zaehlen (Gewicht 3 von 5 -> ~72). */
function spawnen(questAktiv, finalraum) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem, alt = qs.getActiveQuests;
    var altFinal = window.__isFinalDungeonRoom;
    qs.getActiveQuests = function () { return ${questAktiv ? "[{ id: 'council_surveillance' }]" : '[]'}; };
    window.__isFinalDungeonRoom = ${finalraum ? 'true' : 'false'};
    var typen = {};
    try {
      for (var i = 0; i < 120; i++) {
        var e = spawnEnemy.call(sc, 0, 0);
        if (!e) continue;
        typen[e.enemyType] = (typen[e.enemyType] || 0) + 1;
        e.destroy();
      }
    } finally {
      qs.getActiveQuests = alt;
      window.__isFinalDungeonRoom = altFinal;
    }
    return typen;
  })()`);
}

test('Mit aktiver Ueberwachung: nur Gegner aus dem Profil, Kellerwaechter vorn', () => {
  const t = spawnen(true, false);
  const summe = Object.values(t).reduce((a, b) => a + b, 0);
  assert.ok(summe >= 100, 'zu wenige Gegner erzeugt: ' + JSON.stringify(t));
  const fremd = Object.keys(t).filter((k) => ![2, 16, 3].includes(Number(k)));
  assert.deepStrictEqual(fremd, [], 'Gegner ausserhalb des Profils: ' + JSON.stringify(t));
  // Erwartet ~60 %; 40 % liegt gut vier Standardabweichungen darunter.
  assert.ok((t[2] || 0) > summe * 0.4, 'Kellerwaechter zu selten: ' + JSON.stringify(t));
  assert.ok((t[2] || 0) > (t[3] || 0) && (t[2] || 0) > (t[16] || 0), 'Kellerwaechter nicht vorn: ' + JSON.stringify(t));
});

test('Ohne die Quest: der normale Pool', () => {
  const t = spawnen(false, false);
  const fremd = Object.keys(t).filter((k) => ![2, 16, 3].includes(Number(k)));
  assert.ok(fremd.length > 0, 'auch ohne Quest nur das Profil: ' + JSON.stringify(t));
});

test('Im Finalraum gilt das Profil nicht', () => {
  const t = spawnen(true, true);
  const fremd = Object.keys(t).filter((k) => ![2, 16, 3].includes(Number(k)));
  assert.ok(fremd.length > 0, 'Profil im Finalraum: ' + JSON.stringify(t));
});
