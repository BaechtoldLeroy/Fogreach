// tests/questEntfernt.test.js — "Waffen für den Widerstand" ist entfernt (b479).
//
// Der Auftrag (branka_weapons, drei Gegenstaende schmieden) passte nicht
// mehr in die Geschichte. Alte Spielstaende tragen ihn noch, laufend oder
// abgeschlossen: sie muessen ohne Fehler laden, ein laufender verschwindet
// still (kein Tracker-Eintrag), ein abgeschlossener stoert nicht.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const DE = {}, EN = {};
globalThis.window.i18n = {
  register(lang, dict) { Object.assign(lang === 'en' ? EN : DE, dict); },
  t: (k) => (k in DE ? DE[k] : k), getLanguage: () => 'de', setLanguage() {}, onChange: () => () => {},
  has: (k) => k in DE
};
globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
globalThis.window.Persistence = { getMaxDepth: () => 40 };
loadGameModule('js/questSystem.js');
const QS = globalThis.window.questSystem;

test('nicht mehr definiert, ohne Texte, nirgends Vorbedingung, nie angeboten', () => {
  assert.strictEqual(QS.QUEST_DEFINITIONS.branka_weapons, undefined);
  assert.deepStrictEqual(Object.keys(DE).concat(Object.keys(EN)).filter((k) => /branka_weapons/.test(k)), []);
  Object.values(QS.QUEST_DEFINITIONS).forEach((d) => {
    assert.ok(!(d.prerequisites || []).includes('branka_weapons'), d.id + ' setzt ihn noch voraus');
  });
  assert.ok(!QS.getAvailableQuests('branka').some((q) => q.id === 'branka_weapons'));
});

test('alter Stand mit laufendem und mit abgeschlossenem Auftrag laedt sauber', () => {
  const basis = QS.getQuestSaveData();
  const aktiv = { status: 'active', objectives: [{ type: 'craft', target: 'craft_item', current: 1, required: 3 }] };
  assert.doesNotThrow(() => QS.loadQuestSaveData(Object.assign({}, basis, {
    quests: Object.assign({}, basis.quests, { branka_weapons: aktiv }) })));
  assert.ok(!QS.getActiveQuests().some((q) => q.id === 'branka_weapons'), 'steht noch in der Liste');
  assert.ok(!/Waffen/.test(QS.getTrackerText() || ''), 'steht noch im Tracker');
  assert.doesNotThrow(() => QS.onItemCrafted(), 'Schmieden wirft ohne den Auftrag');
  assert.doesNotThrow(() => QS.loadQuestSaveData(Object.assign({}, basis, {
    quests: Object.assign({}, basis.quests, { branka_weapons: { status: 'completed', objectives: null } }) })));
  assert.ok(!QS.getCompletedQuests().some((q) => q && q.id === 'branka_weapons'));
});
