// Unit tests for Feature 057 (#40) — Enemy spawn gating by story act.
//
// js/enemySpawnGating.js is a pure, Phaser-free IIFE (window.EnemySpawnGating)
// so it can be unit-loaded; enemy.js only wires it into spawnEnemy.
//
// Covered:
//   - ENEMY_MIN_ACT mapping shape (§4.1)
//   - getAvailableEnemyTypes filter correctness per (depth, act)
//   - "never empty" guarantee over all depth 1..12 x act 0..6 (FR-04)
//   - depth-identity at full act (FR-07)
//   - defensive defaults (FR-06): missing depth / NaN / out-of-range act

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function freshModule() {
  if (globalThis.window) delete globalThis.window.EnemySpawnGating;
  loadGameModule('js/enemySpawnGating.js');
  return globalThis.window.EnemySpawnGating;
}

// Pure depth roster (mirror of enemy.js Z.335-345) for the identity check.
function depthRosterRef(depth) {
  const d = (typeof depth === 'number' && depth >= 1) ? depth : 1;
  // Kumulativ: Bestien (8/9/10) bleiben auch tiefer im Pool (Abwechslung).
  if (d <= 2) return [8, 9, 10];
  if (d <= 4) return [8, 9, 10, 1, 2];
  if (d <= 6) return [8, 9, 10, 1, 2, 3, 4];
  if (d <= 8) return [8, 9, 10, 1, 2, 3, 4, 5];
  return [8, 9, 10, 1, 2, 3, 4, 5, 6, 7];
}

test('ENEMY_MIN_ACT has the exact §4.1 mapping', () => {
  const M = freshModule();
  assert.deepStrictEqual(M.ENEMY_MIN_ACT,
    { 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 4, 7: 4, 8: 0, 9: 0, 10: 0 });
});

test('getAvailableEnemyTypes filters by act at depth 9', () => {
  const M = freshModule();
  const a0 = M.getAvailableEnemyTypes(9, 0);
  assert.ok(![5, 6, 7].some((t) => a0.includes(t)), 'act0 excludes 5/6/7');
  const a3 = M.getAvailableEnemyTypes(9, 3);
  assert.ok(a3.includes(5), 'act3 includes 5 (Shadow)');
  assert.ok(!a3.includes(6) && !a3.includes(7), 'act3 excludes 6/7');
  const a4 = M.getAvailableEnemyTypes(9, 4);
  assert.ok(a4.includes(6) && a4.includes(7), 'act4 includes 6 and 7');
});

test('result is NEVER empty across depth 1..12 x act 0..6 (FR-04)', () => {
  const M = freshModule();
  for (let depth = 1; depth <= 12; depth++) {
    for (let act = 0; act <= 6; act++) {
      const r = M.getAvailableEnemyTypes(depth, act);
      assert.ok(Array.isArray(r) && r.length > 0, `non-empty at depth ${depth}, act ${act}`);
      assert.ok(r.every((t) => Number.isInteger(t) && t >= 1 && t <= 10), `valid types at depth ${depth}, act ${act}`);
    }
  }
});

test('at full act (6) the roster equals the pure depth roster (FR-07)', () => {
  const M = freshModule();
  for (let depth = 1; depth <= 12; depth++) {
    assert.deepStrictEqual(
      M.getAvailableEnemyTypes(depth, 6).slice().sort((a, b) => a - b),
      depthRosterRef(depth).slice().sort((a, b) => a - b),
      `full-act roster matches depth roster at depth ${depth}`
    );
  }
});

test('defensive defaults: missing depth behaves like depth 1 (FR-06)', () => {
  const M = freshModule();
  assert.deepStrictEqual(
    M.getAvailableEnemyTypes(undefined, 6).slice().sort((a, b) => a - b),
    depthRosterRef(1).slice().sort((a, b) => a - b)
  );
});

test('defensive defaults: NaN/undefined/out-of-range act → no throw, treated as full', () => {
  const M = freshModule();
  // undefined/NaN act → full roster (act 6)
  assert.deepStrictEqual(
    M.getAvailableEnemyTypes(9, undefined).slice().sort((a, b) => a - b),
    depthRosterRef(9).slice().sort((a, b) => a - b)
  );
  assert.deepStrictEqual(
    M.getAvailableEnemyTypes(9, NaN).slice().sort((a, b) => a - b),
    depthRosterRef(9).slice().sort((a, b) => a - b)
  );
  // out-of-range high clamps to 6 (full); negative clamps to 0
  assert.deepStrictEqual(
    M.getAvailableEnemyTypes(9, 99).slice().sort((a, b) => a - b),
    depthRosterRef(9).slice().sort((a, b) => a - b)
  );
  const aNeg = M.getAvailableEnemyTypes(9, -5);
  assert.ok(Array.isArray(aNeg) && aNeg.length > 0, 'negative act clamped, non-empty');
  assert.ok(!aNeg.includes(5) && !aNeg.includes(6) && !aNeg.includes(7), 'negative act == act 0');
});
