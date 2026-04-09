// Unit tests for js/eliteEnemies.js — WP05 Elite Enemies.
//
// Covers the pure-logic surface:
//   - ENEMY_AFFIX_DEFS shape / count / uniqueness
//   - shouldSpawnElite depth-tiered probabilities (with deterministic RNG)
//   - rollEliteAffixes count + no-duplicates
//   - applyEliteToEnemy mutation: HP, flags, affix apply()
//   - removeEliteFromEnemy: flags cleared, affix revert()
//   - modifyDropTable: non-elite passthrough, unique bonus

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

// Deterministic Mulberry32-style RNG.
function makeRng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshSystem() {
  resetStore();
  delete globalThis.window.EliteEnemies;
  loadGameModule('js/eliteEnemies.js');
  return globalThis.window.EliteEnemies;
}

function mockEnemy(overrides) {
  const tintCalls = [];
  const base = {
    hp: 60,
    maxHp: 60,
    speed: 80,
    damage: 5,
    baseDamage: 5,
    scene: null, // null so visual code branches cleanly
    active: true,
    setTint: function (c) { tintCalls.push(c); this._lastTint = c; },
    destroy: function () { this.active = false; this._destroyed = true; },
    _tintCalls: tintCalls
  };
  return Object.assign(base, overrides || {});
}

beforeEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// 1. ENEMY_AFFIX_DEFS shape
// ---------------------------------------------------------------------------

test('ENEMY_AFFIX_DEFS has exactly 10 entries', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.ENEMY_AFFIX_DEFS.length, 10);
});

test('ENEMY_AFFIX_DEFS entries have required fields', () => {
  const sys = freshSystem();
  const required = ['id', 'displayName', 'tint', 'apply'];
  for (const def of sys.ENEMY_AFFIX_DEFS) {
    for (const f of required) {
      assert.ok(f in def, 'missing field ' + f + ' on ' + def.id);
    }
    assert.strictEqual(typeof def.apply, 'function');
  }
});

test('ENEMY_AFFIX_DEFS ids are all unique', () => {
  const sys = freshSystem();
  const ids = sys.ENEMY_AFFIX_DEFS.map((d) => d.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('ENEMY_AFFIX_DEFS is frozen (read-only)', () => {
  const sys = freshSystem();
  assert.strictEqual(Object.isFrozen(sys.ENEMY_AFFIX_DEFS), true);
});

// ---------------------------------------------------------------------------
// 2. shouldSpawnElite
// ---------------------------------------------------------------------------

test('shouldSpawnElite(depth < 6) always returns null', () => {
  const sys = freshSystem();
  const rng = makeRng(1);
  for (let d = 1; d < 6; d++) {
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(sys.shouldSpawnElite(d, rng), null);
    }
  }
});

test('shouldSpawnElite(depth=10) yields ~30% elite across 1000 trials', () => {
  const sys = freshSystem();
  const rng = makeRng(12345);
  let elites = 0;
  for (let i = 0; i < 1000; i++) {
    if (sys.shouldSpawnElite(10, rng)) elites++;
  }
  const rate = elites / 1000;
  // Expected 25% + 5% = 30%; tolerance ±6%.
  assert.ok(rate >= 0.24 && rate <= 0.36, 'expected ~30% elite at depth=10, got ' + rate);
});

test('shouldSpawnElite(depth=20) yields >50% elite across 1000 trials', () => {
  const sys = freshSystem();
  const rng = makeRng(98765);
  let elites = 0;
  for (let i = 0; i < 1000; i++) {
    if (sys.shouldSpawnElite(20, rng)) elites++;
  }
  const rate = elites / 1000;
  assert.ok(rate > 0.50, 'expected >50% elite at depth=20, got ' + rate);
});

test('shouldSpawnElite returns only champion/unique/null', () => {
  const sys = freshSystem();
  const rng = makeRng(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    seen.add(sys.shouldSpawnElite(20, rng));
  }
  for (const v of seen) {
    assert.ok(v === null || v === 'champion' || v === 'unique');
  }
});

// ---------------------------------------------------------------------------
// 3. rollEliteAffixes
// ---------------------------------------------------------------------------

test('rollEliteAffixes(champion) picks exactly 1 affix', () => {
  const sys = freshSystem();
  const rng = makeRng(42);
  for (let i = 0; i < 50; i++) {
    const picks = sys.rollEliteAffixes('champion', rng);
    assert.strictEqual(picks.length, 1);
  }
});

test('rollEliteAffixes(unique) picks 2 or 3 affixes with no duplicates', () => {
  const sys = freshSystem();
  const rng = makeRng(43);
  for (let i = 0; i < 50; i++) {
    const picks = sys.rollEliteAffixes('unique', rng);
    assert.ok(picks.length === 2 || picks.length === 3, 'got ' + picks.length);
    const ids = picks.map((p) => p.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate affixes in unique pick');
  }
});

test('rollEliteAffixes is deterministic given same seeded RNG', () => {
  const sys = freshSystem();
  const a = sys.rollEliteAffixes('unique', makeRng(100));
  const b = sys.rollEliteAffixes('unique', makeRng(100));
  assert.deepStrictEqual(a.map((d) => d.id), b.map((d) => d.id));
});

// ---------------------------------------------------------------------------
// 4. applyEliteToEnemy
// ---------------------------------------------------------------------------

test('applyEliteToEnemy(champion) multiplies HP by 1.5 and sets flags', () => {
  const sys = freshSystem();
  const enemy = mockEnemy({ hp: 60, maxHp: 60 });
  sys.applyEliteToEnemy(enemy, 'champion', makeRng(1));
  assert.strictEqual(enemy.hp, 90);
  assert.strictEqual(enemy._isElite, true);
  assert.strictEqual(enemy.eliteTier, 'champion');
  assert.strictEqual(enemy.eliteAffixes.length, 1);
});

test('applyEliteToEnemy(unique) multiplies HP by 2.0 and picks 2-3 affixes', () => {
  const sys = freshSystem();
  const enemy = mockEnemy({ hp: 60, maxHp: 60 });
  sys.applyEliteToEnemy(enemy, 'unique', makeRng(2));
  assert.strictEqual(enemy.hp, 120);
  assert.strictEqual(enemy._isElite, true);
  assert.strictEqual(enemy.eliteTier, 'unique');
  assert.ok(enemy.eliteAffixes.length === 2 || enemy.eliteAffixes.length === 3);
});

test('applyEliteToEnemy applies first-affix tint to sprite', () => {
  const sys = freshSystem();
  const enemy = mockEnemy();
  sys.applyEliteToEnemy(enemy, 'champion', makeRng(5));
  assert.strictEqual(enemy._tintCalls.length, 1);
  assert.strictEqual(typeof enemy._lastTint, 'number');
});

test('applyEliteToEnemy with invalid tier is a no-op', () => {
  const sys = freshSystem();
  const enemy = mockEnemy();
  sys.applyEliteToEnemy(enemy, 'bogus', makeRng(3));
  assert.strictEqual(enemy._isElite, undefined);
  assert.strictEqual(enemy.hp, 60);
});

test('applyEliteToEnemy runs affix.apply() to mutate enemy stats', () => {
  const sys = freshSystem();
  // Pick deterministic seed and check at least one expected side effect fires:
  // affixes mutate speed, damage, or set an is* flag.
  const enemy = mockEnemy({ hp: 50, speed: 80, damage: 5 });
  sys.applyEliteToEnemy(enemy, 'unique', makeRng(777));
  const mutatedSomething =
    enemy.speed !== 80 ||
    enemy.damage !== 5 ||
    enemy.isFanatic || enemy.isExtraFast || enemy.isExtraStrong ||
    enemy.isLightningEnchanted || enemy.hasColdAura || enemy.isSpectralHit ||
    enemy.isMultishot || enemy.isVampiric || enemy.isBerserker || enemy.isMagicResistant;
  assert.ok(mutatedSomething, 'expected at least one affix to mutate enemy');
});

// ---------------------------------------------------------------------------
// 5. isElite predicate
// ---------------------------------------------------------------------------

test('isElite() predicate recognises elite and non-elite enemies', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.isElite(null), false);
  assert.strictEqual(sys.isElite({}), false);
  const enemy = mockEnemy();
  assert.strictEqual(sys.isElite(enemy), false);
  sys.applyEliteToEnemy(enemy, 'champion', makeRng(10));
  assert.strictEqual(sys.isElite(enemy), true);
});

// ---------------------------------------------------------------------------
// 6. removeEliteFromEnemy
// ---------------------------------------------------------------------------

test('removeEliteFromEnemy reverts affix mutations and clears flags', () => {
  const sys = freshSystem();
  const enemy = mockEnemy({ hp: 60, speed: 80, damage: 5 });
  sys.applyEliteToEnemy(enemy, 'unique', makeRng(55));
  sys.removeEliteFromEnemy(enemy);
  assert.strictEqual(enemy._isElite, false);
  // After revert, speed and damage should be restored to original
  assert.strictEqual(enemy.speed, 80);
  assert.strictEqual(enemy.damage, 5);
  // Revert should clear all affix is* flags
  assert.ok(!enemy.isFanatic && !enemy.isExtraFast && !enemy.isExtraStrong);
});

// ---------------------------------------------------------------------------
// 7. modifyDropTable
// ---------------------------------------------------------------------------

test('modifyDropTable returns baseDrops unchanged for non-elite', () => {
  const sys = freshSystem();
  const drops = { items: [{ tier: 0 }], gold: 10 };
  const out = sys.modifyDropTable({ _isElite: false }, drops);
  assert.strictEqual(out, drops);
});

test('modifyDropTable for unique adds extra items and gold', () => {
  const sys = freshSystem();
  const enemy = { _isElite: true, eliteTier: 'unique', iLevel: 5 };
  const drops = { items: [{ tier: 0 }], gold: 10 };
  const out = sys.modifyDropTable(enemy, drops);
  assert.ok(out.items.length > drops.items.length, 'unique should add drops');
  assert.ok(out.gold > drops.gold, 'unique should boost gold');
});

test('modifyDropTable for champion duplicates existing drops', () => {
  const sys = freshSystem();
  const enemy = { _isElite: true, eliteTier: 'champion' };
  const drops = { items: [{ tier: 0 }, { tier: 1 }], gold: 10 };
  const out = sys.modifyDropTable(enemy, drops);
  assert.ok(out.items.length > drops.items.length, 'champion should add drops');
});
