// Unit tests for Feature 059 (#42) WP03 Batch 1 — amulet effect maths.
// Pure logic in js/amuletEffects.js (window.AmuletEffects); combat/stat hooks
// in player.js/inventory.js/enemy.js just call into it.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function fresh(effect) {
  if (!globalThis.window) require('./setup');
  globalThis.window.runAmulet = effect ? { effect } : null;
  delete globalThis.window.AmuletEffects;
  loadGameModule('js/amuletEffects.js');
  const AE = globalThis.window.AmuletEffects;
  AE.resetRunState();
  return AE;
}

test('activeEffect reflects window.runAmulet.effect (null when none)', () => {
  assert.strictEqual(fresh(null).activeEffect(), null);
  assert.strictEqual(fresh('glass').activeEffect(), 'glass');
});

test('getStatMods: glass = +50% dmg / -25% maxHP', () => {
  const m = fresh('glass').getStatMods();
  assert.ok(Math.abs(m.damageMul - 1.5) < 1e-9);
  assert.ok(Math.abs(m.maxHpMul - 0.75) < 1e-9);
  assert.strictEqual(m.moveAdd, 0);
});

test('getStatMods: tempo = +move / +attack speed', () => {
  const m = fresh('tempo').getStatMods();
  assert.ok(m.moveAdd > 0, 'moveAdd > 0');
  assert.ok(m.speedMul > 1, 'speedMul > 1');
  assert.strictEqual(m.damageMul, 1);
});

test('getStatMods: no amulet / other effect = identity', () => {
  for (const e of [null, 'twin', 'lifesteal']) {
    const m = fresh(e).getStatMods();
    assert.deepStrictEqual(m, { moveAdd: 0, speedMul: 1, damageMul: 1, maxHpMul: 1 });
  }
});

test('lifestealPct: only the lifesteal amulet returns > 0', () => {
  assert.ok(fresh('lifesteal').lifestealPct() > 0);
  assert.strictEqual(fresh('glass').lifestealPct(), 0);
  assert.strictEqual(fresh(null).lifestealPct(), 0);
});

test('momentum: kills stack the damage multiplier, capped, then decays', () => {
  const AE = fresh('momentum');
  const t0 = 1000;
  assert.strictEqual(AE.momentumMul(t0), 1, 'no stacks -> x1');
  AE.onEnemyKilled(null, null, t0);
  AE.onEnemyKilled(null, null, t0);
  assert.ok(Math.abs(AE.momentumMul(t0) - (1 + 2 * 0.06)) < 1e-9, '2 kills -> x1.12');
  // cap
  for (let i = 0; i < 50; i++) AE.onEnemyKilled(null, null, t0);
  assert.ok(AE.momentumMul(t0) <= 1 + 10 * 0.06 + 1e-9, 'stacks capped');
  // decay: well past the decay window -> back to x1
  assert.strictEqual(AE.momentumMul(t0 + 999999), 1, 'decayed to x1');
});

test('momentum only applies to the momentum amulet (others x1)', () => {
  const AE = fresh('glass');
  AE.onEnemyKilled(null, null, 1000);
  assert.strictEqual(AE.momentumMul(1000), 1, 'non-momentum amulet never ramps');
  assert.strictEqual(AE.damageMul(1000), 1);
});

test('resetRunState clears momentum stacks', () => {
  const AE = fresh('momentum');
  AE.onEnemyKilled(null, null, 1000);
  assert.ok(AE.momentumStacks() > 0);
  AE.resetRunState();
  assert.strictEqual(AE.momentumStacks(), 0);
});
