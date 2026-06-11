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

// TEST-MODE: DEFAULT_LEARNED enthält jetzt alle 9 Abilities (statt leer)
// für Mobile-Layout-Testing. Tests reflektieren den aktuellen Default.
const TEST_MODE_DEFAULT_LEARNED = [
  'spinAttack', 'chargeSlash', 'dashSlash', 'daggerThrow', 'shieldBash',
  'heilwunde', 'frostnova', 'blutopfer', 'schattenschritt'
];

test('fresh init starts with all abilities learned (TEST-MODE default)', () => {
  const sys = freshSystem();
  assert.deepStrictEqual(sys.getLearnedAbilities(), TEST_MODE_DEFAULT_LEARNED);
});

test('learnAbility returns false when ability is already in DEFAULT_LEARNED', () => {
  const sys = freshSystem();
  const result = sys.learnAbility('spinAttack');
  // spinAttack ist im TEST-MODE bereits gelernt → learnAbility ist no-op
  assert.strictEqual(result, false);
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
  // Unknown ID nicht added — Liste bleibt auf DEFAULT_LEARNED
  assert.deepStrictEqual(sys.getLearnedAbilities(), TEST_MODE_DEFAULT_LEARNED);
});

test('isLearned reflects DEFAULT_LEARNED in TEST-MODE', () => {
  const sys = freshSystem();
  // chargeSlash ist im TEST-MODE bereits gelernt
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

test('resetForNewGame resets to DEFAULT_LEARNED + clears storage', () => {
  const sys = freshSystem();
  sys.setSlot('slot1', 'spinAttack');
  sys.save();
  // sanity: storage now has the key
  assert.notStrictEqual(globalThis.localStorage.getItem('demonfall_abilities_v1'), null);
  sys.resetForNewGame();
  // TEST-MODE: reset stellt DEFAULT_LEARNED wieder her (alle 9), nicht leer
  assert.deepStrictEqual(sys.getLearnedAbilities(), TEST_MODE_DEFAULT_LEARNED);
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
