// tests/standhalten.test.js — Aushang "Standhalten" als Ausdauerprobe.
//
// "Welle 14 auf Tiefe 14" war ein einziger Raum (die Welle ist die
// Lauftiefe). Jetzt: 6 Raeume auf Tiefe 14 oder tiefer in EINEM Lauf, ohne
// zu sterben. Der Zaehler ('room_lauf') faellt auf 0, sobald ein Lauf endet,
// ohne dass er voll ist.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
loadGameModule('js/questSystem.js');
const QS = globalThis.window.questSystem;

function annehmen(quests) {
  const st = QS.getQuestSaveData();
  st.quests = Object.assign({ brett_welle: { status: 'available', objectives: null } }, quests || {});
  QS.loadQuestSaveData(st);
}
const stand = () => QS.getActiveQuests().filter((q) => q.id === 'brett_welle')[0].objectives[0].current;
const raeume = (n, tiefe) => {
  globalThis.window.DUNGEON_DEPTH = tiefe;
  for (let i = 0; i < n; i++) QS.updateQuestProgress('explore', 'room_lauf', 1);
};

test('das Ziel: 6 Raeume in einem Lauf, ab Tiefe 14', () => {
  const d = QS.QUEST_DEFINITIONS.brett_welle;
  assert.deepStrictEqual(d.objectives, [{ type: 'explore', target: 'room_lauf', current: 0, required: 6 }]);
  assert.strictEqual(d.minDepth, 14);
  assert.strictEqual(d.angebotAb, 14);
  assert.strictEqual(d.repeatable, true);
});

test('Raeume unter Tiefe 14 zaehlen nicht, ab 14 schon', () => {
  annehmen(); QS.acceptQuest('brett_welle');
  raeume(4, 13);
  assert.strictEqual(stand(), 0);
  raeume(4, 14);
  assert.strictEqual(stand(), 4);
});

test('endet der Lauf vor dem sechsten Raum, beginnt es von vorn; voll bleibt voll', () => {
  annehmen(); QS.acceptQuest('brett_welle');
  raeume(5, 15);
  QS.onLaufEnde();
  assert.strictEqual(stand(), 0, 'nach dem Lauf stand der Zaehler noch');
  raeume(6, 15);
  assert.strictEqual(QS.isQuestReadyToComplete('brett_welle'), true);
  QS.onLaufEnde();
  assert.strictEqual(QS.isQuestReadyToComplete('brett_welle'), true, 'ein voller Zaehler fiel zurueck');
});

test('Altstand mit dem Wellenziel laedt und bleibt abschliessbar', () => {
  annehmen({ brett_welle: { status: 'active', objectives: [{ type: 'wave', target: 'reach_wave', current: 3, required: 12 }] } });
  assert.deepStrictEqual(QS.getActiveQuests().filter((q) => q.id === 'brett_welle')[0].objectives,
    [{ type: 'explore', target: 'room_lauf', current: 0, required: 6 }]);
  raeume(6, 14);
  assert.strictEqual(QS.isQuestReadyToComplete('brett_welle'), true);
  // War die Welle schon erreicht, bleibt er abgabebereit.
  annehmen({ brett_welle: { status: 'active', objectives: [{ type: 'wave', target: 'reach_wave', current: 6, required: 6 }] } });
  assert.strictEqual(QS.isQuestReadyToComplete('brett_welle'), true);
});

describe('im Spiel', () => {
  let H = null;
  const SC = `window.game.scene.getScene('GameScene')`;
  before(async () => { H = await launchDungeon({ depth: 14 }); H.run('window._playerInvincible = true'); });
  after(async () => { if (H) await H.shutdown(); });

  const annehmenImSpiel = () => H.run(`(function () {
    var QS = window.questSystem, st = QS.getQuestSaveData();
    st.quests.brett_welle = { status: 'available', objectives: null };
    QS.loadQuestSaveData(st); QS.acceptQuest('brett_welle');
  })()`);
  const standImSpiel = () => H.run(`window.questSystem.getActiveQuests().filter(function (q) { return q.id === 'brett_welle'; })[0].objectives[0].current`);
  /** n Raeume betreten und ueber markRoomCleared abschliessen. */
  const raeumeImSpiel = (n) => {
    for (let i = 1; i <= n; i++) {
      H.run(`window.DUNGEON_DEPTH = 14; enterRoom(${SC}, ${i}); enemies.clear(true, true); markRoomCleared({ forRoomId: ${i} });`);
      H.step(2);
    }
  };

  test('sechs geraeumte Raeume auf Tiefe 14 in einem Lauf erfuellen den Aushang', () => {
    annehmenImSpiel();
    raeumeImSpiel(6);
    assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('brett_welle')`), true, 'Stand ' + standImSpiel());
  });

  test('wer stirbt, beginnt von vorn', () => {
    annehmenImSpiel();
    raeumeImSpiel(3);
    assert.strictEqual(standImSpiel(), 3);
    H.run(`handlePlayerDeath(${SC})`);
    for (let k = 0; k < 300 && standImSpiel() !== 0; k++) H.step(2);
    assert.strictEqual(standImSpiel(), 0, 'nach dem Tod stand der Zaehler noch');
  });
});
