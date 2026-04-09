// Unit tests for js/lootSystem.js — WP01 Foundation & Affix Engine.
//
// Covers the pure-logic surface implemented in WP01:
//   - rollAffixes(iLevel, count, rng?) — deterministic weighted pick
//   - recomputeBonuses() / getBonus(statKey) — AggregatedBonuses cache
//
// Other public API methods (rollItem, composeName, grantGold, etc.) are
// stubbed in WP01 and throw on call; later WPs replace them and add tests.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

// Deterministic Mulberry32-style RNG used for every test. Never call
// Math.random from a test — flakiness is the enemy.
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
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

beforeEach(() => {
  resetStore();
  globalThis.window.equipment = {};
});

// ---------------------------------------------------------------------------
// Phase 1: rollAffixes
// ---------------------------------------------------------------------------

test('AFFIX_DEFS has exactly 24 entries', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.AFFIX_DEFS.length, 24);
});

test('AFFIX_DEFS is frozen (top-level)', () => {
  const sys = freshSystem();
  assert.strictEqual(Object.isFrozen(sys.AFFIX_DEFS), true);
  assert.throws(() => { sys.AFFIX_DEFS.push({ id: 'x' }); });
});

test('AFFIX_DEFS entries each have required fields', () => {
  const sys = freshSystem();
  const required = ['id', 'displayName', 'position', 'statKey', 'valueType',
    'range', 'iLevelMin', 'weight', 'appliesTo', 'tooltipText'];
  for (const def of sys.AFFIX_DEFS) {
    for (const f of required) {
      assert.ok(f in def, 'missing field ' + f + ' on ' + def.id);
    }
    assert.ok('min' in def.range && 'max' in def.range);
  }
});

test('AFFIX_DEFS ids are all unique', () => {
  const sys = freshSystem();
  const ids = sys.AFFIX_DEFS.map((d) => d.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('rollAffixes is deterministic given the same seeded RNG', () => {
  const sys = freshSystem();
  const a = sys.rollAffixes(10, 3, makeRng(42));
  const b = sys.rollAffixes(10, 3, makeRng(42));
  assert.deepStrictEqual(a, b);
});

test('rollAffixes returns different results for different seeds', () => {
  const sys = freshSystem();
  const a = sys.rollAffixes(10, 3, makeRng(42));
  const b = sys.rollAffixes(10, 3, makeRng(9999));
  // Not strictly required to differ in theory, but with these seeds and the
  // 24-entry pool they MUST differ. If this ever flakes, pick different seeds.
  assert.notDeepStrictEqual(a, b);
});

test('rollAffixes excludes affixes whose iLevelMin > iLevel', () => {
  const sys = freshSystem();
  // iLevel=1 should exclude of_might and of_haste (iLevelMin=8).
  const out = sys.rollAffixes(1, 20, makeRng(7));
  const ids = out.map((a) => a.defId);
  assert.strictEqual(ids.includes('of_might'), false);
  assert.strictEqual(ids.includes('of_haste'), false);
  assert.strictEqual(ids.includes('of_the_leech'), false); // iLevelMin=6
});

test('rollAffixes may include high-tier affixes when iLevel is high enough', () => {
  const sys = freshSystem();
  // Try several seeds; at iLevel=20 with count=24 ALL should be eligible.
  const out = sys.rollAffixes(20, 24, makeRng(1));
  // Every affix in the pool should be reachable; with count=24 and pool=24 we
  // get exactly one of each (deterministic pick-without-replacement).
  assert.strictEqual(out.length, 24);
  const ids = new Set(out.map((a) => a.defId));
  assert.strictEqual(ids.size, 24);
});

test('rollAffixes returns at most eligible.length when count exceeds pool', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(1, 100, makeRng(0));
  // At iLevel=1, only affixes with iLevelMin<=1 are eligible.
  const eligible = sys.AFFIX_DEFS.filter((d) => d.iLevelMin <= 1);
  assert.strictEqual(out.length, eligible.length);
});

test('rollAffixes returns no duplicate defIds', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 5, makeRng(123));
  const ids = out.map((a) => a.defId);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('rollAffixes entries each have defId and numeric value', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 4, makeRng(99));
  for (const inst of out) {
    assert.ok(typeof inst.defId === 'string' && inst.defId.length > 0);
    assert.ok(typeof inst.value === 'number' && Number.isFinite(inst.value));
    // value must lie within the declared range
    const def = sys.AFFIX_DEFS.find((d) => d.id === inst.defId);
    assert.ok(inst.value >= def.range.min && inst.value <= def.range.max);
  }
});

test('rollAffixes returns [] when count is 0', () => {
  const sys = freshSystem();
  const out = sys.rollAffixes(10, 0, makeRng(1));
  assert.deepStrictEqual(out, []);
});

// ---------------------------------------------------------------------------
// Phase 2: recomputeBonuses + getBonus
// ---------------------------------------------------------------------------

function makeMockItem(affixes) {
  return { affixes };
}

test('getBonus returns 0 for unknown statKey with empty equipment', () => {
  const sys = freshSystem();
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('damage'), 0);
  assert.strictEqual(sys.getBonus('nonexistent_stat'), 0);
});

test('getBonus returns the percent fraction for one damage affix', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'sharp_dmg', value: 22 }])
  };
  sys.recomputeBonuses();
  // 22% -> 0.22
  assert.ok(Math.abs(sys.getBonus('damage') - 0.22) < 1e-9);
});

test('getBonus sums percent affixes across multiple items', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'sharp_dmg', value: 20 }]),
    body: makeMockItem([{ defId: 'spinning_dmg', value: 10 }])
  };
  // sharp_dmg -> damage 0.20; spinning_dmg -> dmg_spinAttack 0.10
  sys.recomputeBonuses();
  assert.ok(Math.abs(sys.getBonus('damage') - 0.20) < 1e-9);
  assert.ok(Math.abs(sys.getBonus('dmg_spinAttack') - 0.10) < 1e-9);
});

test('getBonus sums flat affixes across multiple items', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'of_health', value: 15 }]),
    head: makeMockItem([{ defId: 'of_health', value: 20 }, { defId: 'sturdy_armor', value: 5 }])
  };
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('hp'), 35);
  assert.strictEqual(sys.getBonus('armor'), 5);
});

test('recomputeBonuses bumps version counter', () => {
  const sys = freshSystem();
  const v0 = sys._bonusCache.version;
  sys.recomputeBonuses();
  sys.recomputeBonuses();
  assert.strictEqual(sys._bonusCache.version, v0 + 2);
});

test('recomputeBonuses wipes previous cache state', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'sharp_dmg', value: 25 }])
  };
  sys.recomputeBonuses();
  assert.ok(sys.getBonus('damage') > 0);

  // Unequip everything, recompute — stale entries should be gone.
  globalThis.window.equipment = {};
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('damage'), 0);
});

test('recomputeBonuses ignores affixes with unknown defId', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([
      { defId: 'sharp_dmg', value: 10 },
      { defId: 'ghost_affix_that_does_not_exist', value: 9999 }
    ])
  };
  sys.recomputeBonuses();
  assert.ok(Math.abs(sys.getBonus('damage') - 0.10) < 1e-9);
});

test('getBonus returns positive value for cd_* affixes (combat applies sign)', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: makeMockItem([{ defId: 'of_swift_spin', value: 12 }])
  };
  sys.recomputeBonuses();
  // cd_spinAttack is stored as +0.12; combat code multiplies baseCd * (1 - x).
  assert.ok(Math.abs(sys.getBonus('cd_spinAttack') - 0.12) < 1e-9);
});

// ---------------------------------------------------------------------------
// Stub contract — every later-WP method must throw a traceable error
// ---------------------------------------------------------------------------

test('stubbed API methods throw "not implemented" errors', () => {
  const sys = freshSystem();
  const stubbed = [
    'rollItem', 'composeName', 'grantGold', 'getGold', 'spendGold',
    'consumePotion', 'onPotionKey', 'isPotionOnCooldown',
    'getOrCreateShopState', 'rerollItem', 'migrateSave'
  ];
  for (const name of stubbed) {
    assert.strictEqual(typeof sys[name], 'function', name + ' should be a function');
    assert.throws(() => sys[name](), /not implemented/, name + ' should throw');
  }
});
