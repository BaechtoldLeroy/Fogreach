// Skill-Belegung (Q/W/E/R) pro Speicherslot — und der Boot-Vertrag dahinter.
//
// Faehigkeiten werden AUSSCHLIESSLICH ueber den Skill-Baum erworben:
// skillTree._syncAbilitySystem() lernt Knoten mit Rang>=1 und ruft fuer Knoten
// mit Rang 0 forgetAbility() — das raeumt auch die aktive Slot-Belegung.
//
// Dieser Sync laeuft beim Modul-Laden. Wenn der Baum seinen persistierten Stand
// NICHT vorher laedt, synct er mit leeren Raengen und verlernt alles: die
// Belegung ist weg und wird leer persistiert. Genau das war der Fall — init()
// war exportiert, aber niemand rief es auf.
//
// Ladereihenfolge hier = index.html: saveSlots -> abilitySystem -> skillTree.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore, localStorageStub } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function boot() {
  delete globalThis.window.SaveSlots;
  delete globalThis.window.SlotStorage;
  delete globalThis.window.AbilitySystem;
  delete globalThis.window.SkillTree;
  loadGameModule('js/saveSlots.js');
  loadGameModule('js/abilitySystem.js');
  loadGameModule('js/skillTree.js');
  return {
    S: globalThis.window.SaveSlots,
    A: globalThis.window.AbilitySystem,
    T: globalThis.window.SkillTree
  };
}

// Ein in sich stimmiger Spielstand: Baum-Raenge UND passende Belegung.
// Beides muss zusammenpassen, sonst verwirft der Sync die Faehigkeiten
// zu Recht (Baum ist die Quelle der Wahrheit).
function seedSlot(slot, ranks, loadout, learned) {
  localStorageStub.setItem('demonfall.slot' + slot + '.demonfall.skillTree.v1',
    JSON.stringify({ version: 1, skillPoints: 0, ranks: ranks }));
  localStorageStub.setItem('demonfall.slot' + slot + '.demonfall_abilities_v1',
    JSON.stringify({ learnedAbilities: learned, activeLoadout: loadout, enemyKills: 0 }));
}

function seedTwoBuilds() {
  resetStore();
  localStorageStub.setItem('demonfall.activeSlot', '1');
  localStorageStub.setItem('demonfall.slotsMigrated.v1', '1');
  seedSlot(1, { whirlwind: 3, hammer: 2 },
    { slot1: 'whirlwind', slot2: 'hammer', slot3: null, slot4: null },
    ['whirlwind', 'hammer']);
  seedSlot(2, { twistingBlades: 2 },
    { slot1: 'twistingBlades', slot2: null, slot3: null, slot4: null },
    ['twistingBlades']);
}

beforeEach(() => { resetStore(); });

test('Boot laedt den Baum, bevor der Ability-Sync laeuft', () => {
  // Kern des Fixes. Ohne init() vor dem Sync steht der Baum auf
  // _defaultState() -> jeder Knoten Rang 0 -> forgetAbility fuer alles.
  seedTwoBuilds();
  const { T } = boot();
  const data = T.getSaveData();
  assert.deepStrictEqual(data.ranks, { whirlwind: 3, hammer: 2 },
    'die Raenge des aktiven Slots stehen direkt nach dem Boot');
});

test('die Belegung ueberlebt einen Seitenneustart', () => {
  seedTwoBuilds();
  const { A } = boot();
  assert.deepStrictEqual(A.getActiveLoadout(),
    { slot1: 'whirlwind', slot2: 'hammer', slot3: null, slot4: null },
    'Q/W/E/R stehen nach dem Boot noch');
  assert.deepStrictEqual(A.getLearnedAbilities().sort(), ['hammer', 'whirlwind']);
});

test('der Boot persistiert die Belegung nicht leer zurueck', () => {
  // Der Fehler war destruktiv: forgetAbility ruft save(), der leere Stand
  // landete also im Slot. Ein zweiter Boot haette ihn dann als Wahrheit gelesen.
  seedTwoBuilds();
  boot();
  const roh = JSON.parse(localStorageStub.getItem('demonfall.slot1.demonfall_abilities_v1'));
  assert.deepStrictEqual(roh.activeLoadout,
    { slot1: 'whirlwind', slot2: 'hammer', slot3: null, slot4: null },
    'der persistierte Blob darf nach dem Boot nicht leer sein');
  assert.deepStrictEqual(roh.learnedAbilities.sort(), ['hammer', 'whirlwind']);
});

test('die Belegung ist pro Slot getrennt', () => {
  seedTwoBuilds();
  let { S, A } = boot();
  assert.strictEqual(A.getActiveLoadout().slot1, 'whirlwind', 'Slot 1: Wut-Build');

  S.setActiveSlot(2);
  ({ S, A } = boot()); // Slot-Wechsel laedt die Seite neu (#63)
  assert.deepStrictEqual(A.getActiveLoadout(),
    { slot1: 'twistingBlades', slot2: null, slot3: null, slot4: null },
    'Slot 2: Ketten-Build — erbt NICHTS aus Slot 1');
  assert.deepStrictEqual(A.getLearnedAbilities(), ['twistingBlades']);

  S.setActiveSlot(1);
  ({ S, A } = boot());
  assert.deepStrictEqual(A.getActiveLoadout(),
    { slot1: 'whirlwind', slot2: 'hammer', slot3: null, slot4: null },
    'Slot 1 ist unveraendert');
});

test('der Baum bleibt die Quelle der Wahrheit: Belegung ohne Rang wird verworfen', () => {
  // Kein Rueckschritt durch den Fix — eine Belegung, die der Baum nicht deckt
  // (Hand-Edit, respec), muss weiterhin geraeumt werden.
  resetStore();
  localStorageStub.setItem('demonfall.activeSlot', '1');
  localStorageStub.setItem('demonfall.slotsMigrated.v1', '1');
  seedSlot(1, { whirlwind: 2 }, // hammer hat KEINEN Rang
    { slot1: 'whirlwind', slot2: 'hammer', slot3: null, slot4: null },
    ['whirlwind', 'hammer']);

  const { A } = boot();
  assert.strictEqual(A.getActiveLoadout().slot1, 'whirlwind', 'gedeckte Ability bleibt');
  assert.strictEqual(A.getActiveLoadout().slot2, null, 'ungedeckte Ability fliegt aus dem Slot');
  assert.deepStrictEqual(A.getLearnedAbilities(), ['whirlwind']);
});
