// Integrationstest fuer #63: greifen die ECHTEN Subsysteme wirklich auf den
// aktiven Slot zu?
//
// tests/saveSlots.test.js prueft nur die Namespacing-Schicht fuer sich. Die
// uebrigen Tests laden ihre Module ohne saveSlots.js und laufen damit im
// Fallback (= Ein-Slot-Verhalten). Keiner von beiden wuerde bemerken, wenn ein
// Subsystem an SlotStorage vorbei direkt auf localStorage schreibt — genau der
// Fehler, vor dem #63 warnt ("sonst driftet ein Slot").
//
// Darum hier: saveSlots.js + Subsystem zusammen laden, Slot wechseln, pruefen.
// Abgedeckt sind beide Verdrahtungs-Muster, die im Code vorkommen:
//   - Adapter-Muster  (_defaultPrimitives().storage) -> factionSystem
//   - Direktzugriff   ((window.SlotStorage || localStorage)) -> skillTree, storage.js

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function bootWithSlots(modules) {
  resetStore();
  delete globalThis.window.SaveSlots;
  delete globalThis.window.SlotStorage;
  loadGameModule('js/saveSlots.js');
  modules.forEach((m) => loadGameModule(m));
  return globalThis.window.SaveSlots;
}

beforeEach(() => { resetStore(); });

test('Adapter-Muster: FactionSystem-Ansehen ist pro Slot getrennt', () => {
  delete globalThis.window.FactionSystem;
  const S = bootWithSlots(['js/factionSystem.js']);
  const F = globalThis.window.FactionSystem;

  S.setActiveSlot(1);
  F.init();
  F.setStanding('magistrat', 40);
  assert.strictEqual(F.getStanding('magistrat'), 40);

  // Slot wechseln + Subsystem neu laden (entspricht einem Neustart im Slot 2)
  S.setActiveSlot(2);
  delete globalThis.window.FactionSystem;
  loadGameModule('js/factionSystem.js');
  const F2 = globalThis.window.FactionSystem;
  F2.init();
  assert.strictEqual(F2.getStanding('magistrat'), 0,
    'Slot 2 darf das Ansehen aus Slot 1 nicht erben');

  F2.setStanding('magistrat', -30);

  // Zurueck zu Slot 1
  S.setActiveSlot(1);
  delete globalThis.window.FactionSystem;
  loadGameModule('js/factionSystem.js');
  const F3 = globalThis.window.FactionSystem;
  F3.init();
  assert.strictEqual(F3.getStanding('magistrat'), 40, 'Slot 1 ist unveraendert');

  // Und die Rohdaten liegen wirklich unter getrennten Keys
  assert.ok(localStorage.getItem('demonfall.slot1.demonfall_factions_v1'));
  assert.ok(localStorage.getItem('demonfall.slot2.demonfall_factions_v1'));
  assert.strictEqual(localStorage.getItem('demonfall_factions_v1'), null,
    'kein un-praefixierter Schreibzugriff mehr');
});

test('Direktzugriff-Muster: Persistence.maxDepth ist pro Slot getrennt', () => {
  delete globalThis.window.Persistence;
  const S = bootWithSlots(['js/persistence.js']);
  const P = globalThis.window.Persistence;

  S.setActiveSlot(1);
  assert.strictEqual(P.getMaxDepth(), 1, 'frischer Slot startet bei Tiefe 1');
  P.bumpMaxDepth(); P.bumpMaxDepth(); P.bumpMaxDepth();
  assert.strictEqual(P.getMaxDepth(), 4);

  S.setActiveSlot(2);
  assert.strictEqual(P.getMaxDepth(), 1, 'Slot 2 erbt die Tiefengrenze nicht');
  P.bumpMaxDepth();
  assert.strictEqual(P.getMaxDepth(), 2);

  S.setActiveSlot(1);
  assert.strictEqual(P.getMaxDepth(), 4, 'Slot 1 unveraendert');
});

test('Settings gelten geraeteweit — auch ueber Slots hinweg', () => {
  delete globalThis.window.Persistence;
  const S = bootWithSlots(['js/persistence.js']);
  const P = globalThis.window.Persistence;

  S.setActiveSlot(1);
  P.setLanguage('en');
  P.setControlScheme('arpg');

  S.setActiveSlot(3);
  assert.strictEqual(P.getLanguage(), 'en', 'Sprache ist ein Geraete-Setting');
  assert.strictEqual(P.getControlScheme(), 'arpg', 'Steuerung ist ein Geraete-Setting');
  assert.strictEqual(localStorage.getItem('demonfall.slot1.demonfall_settings_v1'), null,
    'Settings duerfen NICHT slot-praefixiert werden');
});

test('clearAllSaves ("Neues Spiel") trifft nur den aktiven Slot', () => {
  delete globalThis.window.Persistence;
  const S = bootWithSlots(['js/persistence.js']);
  const P = globalThis.window.Persistence;
  const St = globalThis.window.SlotStorage;

  S.setActiveSlot(1); St.setItem('demonfall_save_v1', 'SLOT1'); P.bumpMaxDepth();
  S.setActiveSlot(2); St.setItem('demonfall_save_v1', 'SLOT2'); P.bumpMaxDepth();

  S.setActiveSlot(2);
  P.clearAllSaves();

  assert.strictEqual(St.getItem('demonfall_save_v1'), null, 'Slot 2 ist geleert');
  S.setActiveSlot(1);
  assert.strictEqual(St.getItem('demonfall_save_v1'), 'SLOT1', 'Slot 1 lebt weiter');
  assert.strictEqual(P.getMaxDepth(), 2, 'auch Slot 1s Tiefengrenze steht noch');
});

test('Persistence.KEYS deckt jeden Key ab, den saveSlots kennt', () => {
  // Die Registry behauptet, JEDEN localStorage-Key zu dokumentieren — genau das
  // war gedriftet (6 Keys fehlten). Dieser Test haelt beide Listen zusammen.
  delete globalThis.window.Persistence;
  const S = bootWithSlots(['js/persistence.js']);
  const registryKeys = Object.values(globalThis.window.Persistence.KEYS);

  S.SLOT_KEYS.concat(S.GLOBAL_KEYS)
    .filter((k) => k.indexOf('demonfall.slot') !== 0 && k.indexOf('demonfall.activeSlot') !== 0
      && k.indexOf('demonfall.slotsMigrated') !== 0)
    .forEach((k) => {
      assert.ok(registryKeys.indexOf(k) !== -1,
        'Persistence.KEYS fehlt "' + k + '" — Registry ist wieder gedriftet');
    });
});
