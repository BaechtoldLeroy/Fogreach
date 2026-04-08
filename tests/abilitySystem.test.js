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
  const result = sys.learnAbility('spinAttack');
  assert.strictEqual(result, true);
  assert.ok(sys.getLearnedAbilities().includes('spinAttack'));
});

test('learnAbility returns false on the second call for the same id', () => {
  const sys = freshSystem();
  sys.learnAbility('spinAttack');
  const result = sys.learnAbility('spinAttack');
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
  assert.strictEqual(sys.isLearned('chargeSlash'), false);
  sys.learnAbility('chargeSlash');
  assert.strictEqual(sys.isLearned('chargeSlash'), true);
});

test('getActiveLoadout returns a copy that does not mutate state', () => {
  const sys = freshSystem();
  sys.learnAbility('spinAttack');
  sys.setSlot('slot1', 'spinAttack');
  const loadout1 = sys.getActiveLoadout();
  loadout1.slot1 = 'tampered';
  const loadout2 = sys.getActiveLoadout();
  assert.strictEqual(loadout2.slot1, 'spinAttack', 'mutating returned object must not affect internal state');
});

test('setSlot equips a learned ability and isEquipped returns true', () => {
  const sys = freshSystem();
  sys.learnAbility('chargeSlash');
  sys.setSlot('slot2', 'chargeSlash');
  assert.strictEqual(sys.getActiveLoadout().slot2, 'chargeSlash');
  assert.strictEqual(sys.isEquipped('chargeSlash'), true);
});

test('resetForNewGame wipes learned abilities and storage', () => {
  const sys = freshSystem();
  sys.learnAbility('spinAttack');
  sys.learnAbility('chargeSlash');
  sys.setSlot('slot1', 'spinAttack');
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
  sys.learnAbility('spinAttack');
  sys.learnAbility('dashSlash');
  sys.setSlot('slot1', 'spinAttack');
  sys.setSlot('slot3', 'dashSlash');
  sys.save();
  // Mutate in-memory then reload from storage
  sys.resetForNewGame();
  // resetForNewGame also clears storage — re-save what we want before
  // reloading. Different test: just verify load() restores after save().
  sys.learnAbility('spinAttack');
  sys.setSlot('slot1', 'spinAttack');
  sys.save();
  // wipe in-memory state without touching storage
  delete globalThis.window.AbilitySystem;
  loadGameModule('js/abilitySystem.js');
  const reloaded = globalThis.window.AbilitySystem;
  assert.ok(reloaded.isLearned('spinAttack'), 'learned set should restore from storage');
  assert.strictEqual(reloaded.getActiveLoadout().slot1, 'spinAttack');
});

test('resetForNewGame seeds 20 Eisenbrocken default', () => {
  const sys = freshSystem();
  // Pre-seed an artificially low MAT count
  globalThis.window.materialCounts = { MAT: 0 };
  sys.resetForNewGame();
  assert.strictEqual(globalThis.window.materialCounts.MAT, 20);
});
