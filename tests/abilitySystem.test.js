// Unit tests for js/abilitySystem.js
//
// The system is browser-IIFE that attaches to window. We load it via the
// loadGameModule helper which provides a stubbed window+localStorage.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function freshSystem() {
  // Wipe storage and reload the module so the closure-state restarts
  resetStore();
  delete globalThis.window.AbilitySystem;
  loadGameModule('js/abilitySystem.js');
  return globalThis.window.AbilitySystem;
}

beforeEach(() => {
  // Each test starts with a brand-new system + clean storage
  resetStore();
});

test('fresh init has no learned abilities', () => {
  const sys = freshSystem();
  assert.deepStrictEqual(sys.getLearnedAbilities(), []);
});

test('learnAbility adds the id and returns true', () => {
  const sys = freshSystem();
  const result = sys.learnAbility('whirlwind');
  assert.strictEqual(result, true);
  assert.ok(sys.getLearnedAbilities().includes('whirlwind'));
});

test('learnAbility returns false on the second call for the same id', () => {
  const sys = freshSystem();
  sys.learnAbility('whirlwind');
  const result = sys.learnAbility('whirlwind');
  assert.strictEqual(result, false);
});

test('learnAbility returns false for unknown ids', () => {
  const sys = freshSystem();
  const result = sys.learnAbility('nonexistent_ability');
  assert.strictEqual(result, false);
  assert.deepStrictEqual(sys.getLearnedAbilities(), []);
});

test('isLearned reflects learnAbility', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.isLearned('hammer'), false);
  sys.learnAbility('hammer');
  assert.strictEqual(sys.isLearned('hammer'), true);
});

test('getActiveLoadout returns a copy that does not mutate state', () => {
  const sys = freshSystem();
  sys.learnAbility('whirlwind');
  sys.setSlot('slot1', 'whirlwind');
  const loadout1 = sys.getActiveLoadout();
  loadout1.slot1 = 'tampered';
  const loadout2 = sys.getActiveLoadout();
  assert.strictEqual(loadout2.slot1, 'whirlwind', 'mutating returned object must not affect internal state');
});

test('setSlot equips a learned ability and isEquipped returns true', () => {
  const sys = freshSystem();
  sys.learnAbility('hammer');
  sys.setSlot('slot2', 'hammer');
  assert.strictEqual(sys.getActiveLoadout().slot2, 'hammer');
  assert.strictEqual(sys.isEquipped('hammer'), true);
});

test('resetForNewGame wipes learned abilities and storage', () => {
  const sys = freshSystem();
  sys.learnAbility('whirlwind');
  sys.learnAbility('hammer');
  sys.setSlot('slot1', 'whirlwind');
  sys.save();
  // sanity: storage now has the key
  assert.notStrictEqual(globalThis.localStorage.getItem('demonfall_abilities_v1'), null);
  sys.resetForNewGame();
  assert.deepStrictEqual(sys.getLearnedAbilities(), []);
  assert.strictEqual(sys.getActiveLoadout().slot1, null);
  assert.strictEqual(globalThis.localStorage.getItem('demonfall_abilities_v1'), null);
});

test('save → mutate → load round-trips state', () => {
  const sys = freshSystem();
  sys.learnAbility('whirlwind');
  sys.learnAbility('twistingBlades');
  sys.setSlot('slot1', 'whirlwind');
  sys.setSlot('slot3', 'twistingBlades');
  sys.save();
  // Mutate in-memory then reload from storage
  sys.resetForNewGame();
  // resetForNewGame also clears storage — re-save what we want before
  // reloading. Different test: just verify load() restores after save().
  sys.learnAbility('whirlwind');
  sys.setSlot('slot1', 'whirlwind');
  sys.save();
  // wipe in-memory state without touching storage
  delete globalThis.window.AbilitySystem;
  loadGameModule('js/abilitySystem.js');
  const reloaded = globalThis.window.AbilitySystem;
  assert.ok(reloaded.isLearned('whirlwind'), 'learned set should restore from storage');
  assert.strictEqual(reloaded.getActiveLoadout().slot1, 'whirlwind');
});

test('resetForNewGame seeds 20 Eisenbrocken default', () => {
  const sys = freshSystem();
  // Pre-seed an artificially low MAT count
  globalThis.window.materialCounts = { MAT: 0 };
  sys.resetForNewGame();
  assert.strictEqual(globalThis.window.materialCounts.MAT, 20);
});

// === 060 Strang KETTEN — neue Skill-Tree-Fähigkeiten ===
test('060 ketten abilities are registered in ABILITY_DEFS', () => {
  const sys = freshSystem();
  ['twistingBlades', 'steelGrasp', 'cycloneStrike', 'frostNova'].forEach((id) => {
    const def = sys.getAbilityDef(id);
    assert.ok(def, `${id} should exist in ABILITY_DEFS`);
    assert.strictEqual(def.id, id);
    assert.strictEqual(typeof def.activate, 'function');
    assert.ok(['tap', 'self'].includes(def.type), `${id} type valid`);
  });
});

test('060 ketten abilities are learnable + equippable', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.learnAbility('cycloneStrike'), true);
  assert.ok(sys.isLearned('cycloneStrike'));
  assert.strictEqual(sys.setSlot('slot2', 'cycloneStrike'), true);
  assert.strictEqual(sys.getActiveLoadout().slot2, 'cycloneStrike');
});

test('060 cycloneStrike + frostNova carry a cooldown', () => {
  const sys = freshSystem();
  assert.ok(sys.getAbilityDef('cycloneStrike').cooldownMs > 0);
  assert.ok(sys.getAbilityDef('frostNova').cooldownMs > 0);
});
