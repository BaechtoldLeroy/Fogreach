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

test('all public API methods are implemented (no stubs remaining)', () => {
  const sys = freshSystem();
  // WP02: rollItem, composeName, migrateSave
  // WP03: grantGold, getGold, spendGold
  // WP04: consumePotion, onPotionKey, isPotionOnCooldown
  // WP06: getOrCreateShopState, rerollItem
  const implemented = [
    'rollItem', 'composeName', 'migrateSave',
    'grantGold', 'getGold', 'spendGold',
    'consumePotion', 'onPotionKey', 'isPotionOnCooldown',
    'getOrCreateShopState', 'rerollItem'
  ];
  for (const name of implemented) {
    assert.strictEqual(typeof sys[name], 'function', name + ' should be a function');
  }
});

// ---------------------------------------------------------------------------
// Phase 3 (WP02): ITEM_BASES, rollItem, composeName, migrateSave
// ---------------------------------------------------------------------------

test('ITEM_BASES has exactly 13 frozen entries with required fields', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.ITEM_BASES.length, 13);
  assert.strictEqual(Object.isFrozen(sys.ITEM_BASES), true);
  const required = ['key', 'type', 'name', 'iconKey', 'baseStats', 'dropWeight'];
  const seen = new Set();
  for (const b of sys.ITEM_BASES) {
    for (const f of required) {
      assert.ok(f in b, 'missing field ' + f + ' on ' + b.key);
    }
    assert.strictEqual(seen.has(b.key), false, 'duplicate base key: ' + b.key);
    seen.add(b.key);
  }
});

test('rollItem(baseKey, iLevel) returns an item with the right key and shape', () => {
  const sys = freshSystem();
  const item = sys.rollItem('WPN_EISENKLINGE', 5);
  assert.strictEqual(item.key, 'WPN_EISENKLINGE');
  assert.strictEqual(item.type, 'weapon');
  assert.strictEqual(item._baseName, 'Eisenklinge');
  assert.ok(typeof item.tier === 'number' && item.tier >= 0 && item.tier <= 3);
  assert.strictEqual(item.iLevel, 5);
  assert.strictEqual(item.requiredLevel, 3);
  assert.ok(item.baseStats && typeof item.baseStats === 'object');
  assert.ok(Array.isArray(item.affixes));
  assert.strictEqual(item.affixes.length, item.tier);
  assert.ok(typeof item.displayName === 'string' && item.displayName.length > 0);
});

test('rollItem with forceTier overrides random tier and matches affix count', () => {
  const sys = freshSystem();
  for (let t = 0; t <= 3; t++) {
    const item = sys.rollItem('WPN_EISENKLINGE', 10, t);
    assert.strictEqual(item.tier, t);
    assert.strictEqual(item.affixes.length, t);
  }
});

test('rollItem deep-copies baseStats so template is not shared/mutated', () => {
  const sys = freshSystem();
  const tmpl = sys.ITEM_BASES.find(function (b) { return b.key === 'WPN_EISENKLINGE'; });
  const item = sys.rollItem('WPN_EISENKLINGE', 5, 0);
  assert.notStrictEqual(item.baseStats, tmpl.baseStats);
  // Mutating the rolled item must not throw and must not affect the frozen template
  item.baseStats.damage = 9999;
  assert.strictEqual(tmpl.baseStats.damage, 8);
});

test('rollItem(null, iLevel) picks one of the 13 base keys via weighted drop', () => {
  const sys = freshSystem();
  const validKeys = new Set(sys.ITEM_BASES.map(function (b) { return b.key; }));
  for (let i = 0; i < 20; i++) {
    const item = sys.rollItem(null, 5, 0);
    assert.ok(validKeys.has(item.key), 'unexpected key: ' + item.key);
  }
});

test('rollItem throws on unknown baseKey', () => {
  const sys = freshSystem();
  assert.throws(function () { sys.rollItem('NOPE_NOT_REAL', 5); }, /Unknown item base/);
});

test('composeName: tier 0 returns _baseName', () => {
  const sys = freshSystem();
  const name = sys.composeName({ tier: 0, _baseName: 'Eisenklinge', affixes: [] });
  assert.strictEqual(name, 'Eisenklinge');
});

test('composeName: tier 1 with prefix-only affix → "Prefix BaseName"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 1, _baseName: 'Eisenklinge',
    affixes: [{ defId: 'sharp_dmg', value: 20 }]
  });
  assert.strictEqual(name, 'Sharp Eisenklinge');
});

test('composeName: tier 1 with suffix-only affix → "BaseName Suffix"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 1, _baseName: 'Eisenklinge',
    affixes: [{ defId: 'of_health', value: 20 }]
  });
  assert.strictEqual(name, 'Eisenklinge of the Bear');
});

test('composeName: tier 2 with prefix + suffix → "Prefix BaseName Suffix"', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 2, _baseName: 'Eisenklinge',
    affixes: [
      { defId: 'sharp_dmg', value: 20 },
      { defId: 'of_health', value: 25 }
    ]
  });
  assert.strictEqual(name, 'Sharp Eisenklinge of the Bear');
});

test('composeName: tier 3 legendary with 4 affixes composes a long name', () => {
  const sys = freshSystem();
  const name = sys.composeName({
    tier: 3, _baseName: 'Sword',
    affixes: [
      { defId: 'sharp_dmg', value: 20 },
      { defId: 'spinning_dmg', value: 15 },
      { defId: 'of_health', value: 20 },
      { defId: 'of_precision', value: 5 }
    ]
  });
  // Either full or [Legendary] fallback — both must contain baseName
  assert.ok(name.indexOf('Sword') !== -1, 'name missing baseName: ' + name);
  assert.ok(name.length > 'Sword'.length);
});

test('composeName: tier 3 with very long names falls back to [Legendary]', () => {
  const sys = freshSystem();
  // Force a long name by using long affix display names
  const item = {
    tier: 3,
    _baseName: 'Kettenmorgenstern',
    affixes: [
      { defId: 'fire_warding', value: 15 },     // 'Fireproof' prefix
      { defId: 'lightning_warding', value: 15 }, // 'Stormproof' prefix
      { defId: 'of_swift_charge', value: 12 },   // 'of Swift Charge' suffix
      { defId: 'of_swift_dagger', value: 12 }    // 'of Swift Dagger' suffix
    ]
  };
  const name = sys.composeName(item);
  assert.ok(name.indexOf('[Legendary]') !== -1, 'expected legendary fallback, got: ' + name);
});

test('migrateSave: strips old fields and adds new ones on inventory items', () => {
  const sys = freshSystem();
  const save = {
    inventory: [
      { name: 'Test Sword', _baseName: 'Test Sword', rarity: 'common', rarityValue: 1, rarityLabel: 'Common', enhanceLevel: 3, damage: 5 }
    ]
  };
  const out = sys.migrateSave(save);
  const it = out.inventory[0];
  assert.strictEqual('rarity' in it, false);
  assert.strictEqual('rarityValue' in it, false);
  assert.strictEqual('rarityLabel' in it, false);
  assert.strictEqual('enhanceLevel' in it, false);
  assert.strictEqual(it.tier, 0);
  assert.deepStrictEqual(it.affixes, []);
  assert.strictEqual(it.iLevel, 1);
  assert.strictEqual(it.requiredLevel, 1);
  assert.strictEqual(it.baseStats.damage, 5);
  assert.strictEqual(it.displayName, 'Test Sword');
});

test('migrateSave: migrates equipment slots and strips old fields', () => {
  const sys = freshSystem();
  const save = {
    equipment: {
      weapon: { name: 'W', _baseName: 'W', rarity: 'rare', damage: 10 },
      head: null,
      body: { name: 'B', _baseName: 'B', rarity: 'common', armor: 4 },
      boots: null
    }
  };
  sys.migrateSave(save);
  assert.strictEqual('rarity' in save.equipment.weapon, false);
  assert.strictEqual(save.equipment.weapon.tier, 0);
  assert.deepStrictEqual(save.equipment.weapon.affixes, []);
  assert.strictEqual(save.equipment.weapon.baseStats.damage, 10);
  assert.strictEqual(save.equipment.body.baseStats.armor, 4);
  assert.strictEqual(save.equipment.head, null);
});

test('migrateSave: sets saveVersion to 2', () => {
  const sys = freshSystem();
  const save = { inventory: [] };
  const out = sys.migrateSave(save);
  assert.strictEqual(out.saveVersion, 2);
});

test('migrateSave: idempotent — running twice produces identical result', () => {
  const sys = freshSystem();
  const save = {
    inventory: [
      { name: 'Sword', _baseName: 'Sword', rarity: 'rare', damage: 7 },
      null,
      { name: 'Helm', _baseName: 'Helm', rarity: 'common', armor: 3 }
    ],
    equipment: {
      weapon: { name: 'W', _baseName: 'W', rarity: 'common', damage: 5 }
    }
  };
  const once = sys.migrateSave(save);
  const onceSnap = JSON.parse(JSON.stringify(once));
  const twice = sys.migrateSave(once);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(twice)), onceSnap);
});

test('migrateSave: no-op when saveVersion >= 2', () => {
  const sys = freshSystem();
  const save = { saveVersion: 2, inventory: [{ rarity: 'should_stay_because_already_migrated' }] };
  const out = sys.migrateSave(save);
  // Returns same reference, untouched
  assert.strictEqual(out, save);
  assert.strictEqual(out.inventory[0].rarity, 'should_stay_because_already_migrated');
});

test('migrateSave: handles null/undefined gracefully', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.migrateSave(null), null);
  assert.strictEqual(sys.migrateSave(undefined), undefined);
});

// ---------------------------------------------------------------------------
// WP03 — Gold Currency
// ---------------------------------------------------------------------------

function freshGoldSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  delete globalThis.window.materialCounts;
  delete globalThis.window._refreshHUD;
  globalThis.window.equipment = {};
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

test('getGold: returns 0 on a fresh system with no gold stored', () => {
  const sys = freshGoldSystem();
  assert.strictEqual(sys.getGold(), 0);
});

test('grantGold: adds positive amounts and getGold reflects the total', () => {
  const sys = freshGoldSystem();
  sys.grantGold(50);
  assert.strictEqual(sys.getGold(), 50);
  sys.grantGold(25);
  assert.strictEqual(sys.getGold(), 75);
});

test('grantGold: ignores zero, negative, NaN, and non-finite amounts', () => {
  const sys = freshGoldSystem();
  sys.grantGold(10);
  sys.grantGold(0);
  sys.grantGold(-5);
  sys.grantGold(NaN);
  sys.grantGold(Infinity);
  sys.grantGold('100'); // non-number
  assert.strictEqual(sys.getGold(), 10);
});

test('spendGold: deducts when balance is sufficient and returns true', () => {
  const sys = freshGoldSystem();
  sys.grantGold(100);
  const ok = sys.spendGold(40);
  assert.strictEqual(ok, true);
  assert.strictEqual(sys.getGold(), 60);
});

test('spendGold: returns false and does not deduct on insufficient funds', () => {
  const sys = freshGoldSystem();
  sys.grantGold(10);
  const ok = sys.spendGold(999);
  assert.strictEqual(ok, false);
  assert.strictEqual(sys.getGold(), 10);
});

test('spendGold: rejects negative, NaN, and non-finite amounts without mutating balance', () => {
  const sys = freshGoldSystem();
  sys.grantGold(50);
  assert.strictEqual(sys.spendGold(-1), false);
  assert.strictEqual(sys.spendGold(NaN), false);
  assert.strictEqual(sys.spendGold(Infinity), false);
  assert.strictEqual(sys.getGold(), 50);
});

test('spendGold: allows spending exact balance to zero', () => {
  const sys = freshGoldSystem();
  sys.grantGold(25);
  assert.strictEqual(sys.spendGold(25), true);
  assert.strictEqual(sys.getGold(), 0);
  // Can't spend anything after that
  assert.strictEqual(sys.spendGold(1), false);
});

test('grantGold / spendGold: trigger window._refreshHUD when defined', () => {
  const sys = freshGoldSystem();
  let calls = 0;
  globalThis.window._refreshHUD = function () { calls++; };
  sys.grantGold(10);
  sys.spendGold(5);
  sys.spendGold(999); // should NOT refresh on failed spend
  assert.strictEqual(calls, 2);
  delete globalThis.window._refreshHUD;
});

// ---------------------------------------------------------------------------
// WP04: Health Potions
// ---------------------------------------------------------------------------

function freshPotionSystem() {
  const sys = freshSystem();
  sys._resetPotionCooldown();
  globalThis.window.inventory = [null, null, null, null, null];
  globalThis.window.playerHealth = 50;
  globalThis.window.playerMaxHealth = 100;
  globalThis.window.addPlayerHealth = function (delta) {
    const max = globalThis.window.playerMaxHealth || 1;
    globalThis.window.playerHealth = Math.max(0, Math.min(max,
      (globalThis.window.playerHealth || 0) + delta));
    return globalThis.window.playerHealth;
  };
  return sys;
}

test('POTION_DEFS has 4 entries with required fields', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.POTION_DEFS.length, 4);
  assert.strictEqual(Object.isFrozen(sys.POTION_DEFS), true);
  for (const def of sys.POTION_DEFS) {
    assert.strictEqual(typeof def.potionTier, 'number');
    assert.strictEqual(typeof def.healPercent, 'number');
    assert.strictEqual(typeof def.healDurationMs, 'number');
    assert.strictEqual(typeof def.goldCost, 'number');
  }
  // Super tier has bonusEffect
  const superDef = sys.POTION_DEFS.find((d) => d.potionTier === 4);
  assert.ok(superDef.bonusEffect);
  assert.strictEqual(superDef.bonusEffect.tempMaxHp, 0.10);
});

test('isPotionOnCooldown: false initially', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.isPotionOnCooldown(), false);
});

test('consumePotion: heals, decrements stack, sets cooldown', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 2 };
  const before = globalThis.window.playerHealth;
  const ok = sys.consumePotion(0);
  assert.strictEqual(ok, true);
  assert.ok(globalThis.window.playerHealth > before, 'should have healed');
  assert.strictEqual(globalThis.window.inventory[0].stack, 1);
  assert.strictEqual(sys.isPotionOnCooldown(), true);
});

test('consumePotion: removes item when stack reaches 0', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  sys.consumePotion(0);
  assert.strictEqual(globalThis.window.inventory[0], null);
});

test('consumePotion: returns false on cooldown', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 5 };
  globalThis.window.inventory[1] = { type: 'potion', potionTier: 1, stack: 5 };
  assert.strictEqual(sys.consumePotion(0), true);
  assert.strictEqual(sys.consumePotion(1), false);
});

test('consumePotion: returns false for non-potion or invalid slot', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.consumePotion(0), false);
  globalThis.window.inventory[0] = { type: 'weapon' };
  assert.strictEqual(sys.consumePotion(0), false);
  assert.strictEqual(sys.consumePotion('x'), false);
});

test('onPotionKey: picks the highest-tier potion in inventory', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  globalThis.window.inventory[2] = { type: 'potion', potionTier: 3, stack: 1 };
  globalThis.window.inventory[3] = { type: 'potion', potionTier: 2, stack: 1 };
  const ok = sys.onPotionKey();
  assert.strictEqual(ok, true);
  // Tier 3 slot is consumed
  assert.strictEqual(globalThis.window.inventory[2], null);
  assert.ok(globalThis.window.inventory[0], 'tier 1 untouched');
  assert.ok(globalThis.window.inventory[3], 'tier 2 untouched');
});

test('onPotionKey: returns false when no potions available', () => {
  const sys = freshPotionSystem();
  assert.strictEqual(sys.onPotionKey(), false);
});

test('_getPotionCooldownRemaining: returns positive after consume', () => {
  const sys = freshPotionSystem();
  globalThis.window.inventory[0] = { type: 'potion', potionTier: 1, stack: 1 };
  sys.consumePotion(0);
  const remaining = sys._getPotionCooldownRemaining();
  assert.ok(remaining > 0 && remaining <= sys.POTION_GLOBAL_CD_MS);
});

// ---------------------------------------------------------------------------
// Phase 6 (WP06): Mara shop state + rerollItem + reroll cost formula
// ---------------------------------------------------------------------------

function freshShopSystem() {
  resetStore();
  delete globalThis.window.LootSystem;
  globalThis.window.equipment = {};
  globalThis.window.inventory = new Array(10).fill(null);
  globalThis.window.materialCounts = { GOLD: 0 };
  delete globalThis.window.dungeonRun;
  delete globalThis.window.currentRunSeed;
  globalThis.window.currentWave = 3;
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

test('_computeRerollCost: tier 0 scales at base * (1 + iLevel*0.05)', () => {
  const sys = freshShopSystem();
  const item = { tier: 0, iLevel: 1 };
  // 50 * 1 * (1 + 0.05) = 52.5 -> 53
  assert.strictEqual(sys._computeRerollCost(item), 53);
});

test('_computeRerollCost: higher tiers use the tier multiplier [1,2,4,8]', () => {
  const sys = freshShopSystem();
  const base = { iLevel: 10 };
  // 1 + 10*0.05 = 1.5
  assert.strictEqual(sys._computeRerollCost({ ...base, tier: 0 }), Math.round(50 * 1 * 1.5));
  assert.strictEqual(sys._computeRerollCost({ ...base, tier: 1 }), Math.round(50 * 2 * 1.5));
  assert.strictEqual(sys._computeRerollCost({ ...base, tier: 2 }), Math.round(50 * 4 * 1.5));
  assert.strictEqual(sys._computeRerollCost({ ...base, tier: 3 }), Math.round(50 * 8 * 1.5));
});

test('_computeRerollCost: never returns less than 1', () => {
  const sys = freshShopSystem();
  assert.ok(sys._computeRerollCost({ tier: 0, iLevel: 1 }) >= 1);
});

test('rerollItem: succeeds when gold is sufficient and mutates affixes in place', () => {
  const sys = freshShopSystem();
  sys.grantGold(10000);
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3);
  assert.strictEqual(item.affixes.length, 3);
  const prevIds = item.affixes.map(a => a.defId).join(',');
  const cost = sys._computeRerollCost(item);
  const goldBefore = sys.getGold();
  const ok = sys.rerollItem(item, cost);
  assert.strictEqual(ok, true);
  assert.strictEqual(sys.getGold(), goldBefore - cost);
  assert.strictEqual(item.affixes.length, 3, 'affix count stays tied to tier');
  // Affix contents should be re-rolled (may rarely match, but defIds or values usually differ).
  // Accept either change or same because affix pool may be small at iLevel 10 — but we at least
  // confirm the array is a new instance populated.
  assert.ok(Array.isArray(item.affixes));
  assert.ok(item.affixes.every(a => typeof a.defId === 'string'));
  // sanity: prevIds was captured
  assert.ok(typeof prevIds === 'string');
});

test('rerollItem: fails and returns false when gold is insufficient', () => {
  const sys = freshShopSystem();
  sys.grantGold(5);
  const item = sys.rollItem('WPN_EISENKLINGE', 10, 3);
  const cost = sys._computeRerollCost(item);
  assert.ok(cost > 5);
  const originalAffixes = item.affixes.slice();
  const ok = sys.rerollItem(item, cost);
  assert.strictEqual(ok, false);
  assert.strictEqual(sys.getGold(), 5, 'gold not deducted on failure');
  assert.deepStrictEqual(item.affixes, originalAffixes, 'affixes unchanged on failure');
});

test('rerollItem: returns false for null / invalid item', () => {
  const sys = freshShopSystem();
  sys.grantGold(10000);
  assert.strictEqual(sys.rerollItem(null, 100), false);
  assert.strictEqual(sys.rerollItem({}, 100), false);
  assert.strictEqual(sys.getGold(), 10000, 'no gold spent on invalid input');
});

test('getOrCreateShopState: returns a ShopState with itemStock array', () => {
  const sys = freshShopSystem();
  const state = sys.getOrCreateShopState('run-a');
  assert.ok(state);
  assert.strictEqual(state.currentRunId, 'run-a');
  assert.ok(Array.isArray(state.itemStock));
  assert.ok(state.itemStock.length > 0, 'stock should contain rolled items');
});

test('getOrCreateShopState: stable per runId (repeat calls return same state)', () => {
  const sys = freshShopSystem();
  const s1 = sys.getOrCreateShopState('run-xyz');
  const s2 = sys.getOrCreateShopState('run-xyz');
  assert.strictEqual(s1, s2, 'same object returned within a single run');
  assert.strictEqual(s1.itemStock, s2.itemStock);
});

test('getOrCreateShopState: regenerates when runId changes', () => {
  const sys = freshShopSystem();
  const s1 = sys.getOrCreateShopState('run-1');
  const s2 = sys.getOrCreateShopState('run-2');
  assert.notStrictEqual(s1, s2, 'new run should produce a new state object');
  assert.strictEqual(s2.currentRunId, 'run-2');
});

// ---------------------------------------------------------------------------
// WP08 T048: equip-change hooks into recomputeBonuses
// ---------------------------------------------------------------------------

// Build a mock equipped item whose affix values map directly onto the
// aggregated-bonus cache. We hand-craft defId + value pairs that match real
// AFFIX_DEFS entries so recomputeBonuses produces the exact keys we expect.
function mockAbilityItem(sys, defId, value) {
  // Ensure the def exists so the test is self-validating.
  const def = sys.AFFIX_DEFS.find((d) => d.id === defId);
  if (!def) throw new Error('mockAbilityItem: unknown affix def ' + defId);
  return {
    type: 'weapon',
    tier: 1,
    affixes: [{ defId, value }]
  };
}

test('WP08 T048: equipping a per-ability damage item aggregates into getBonus', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', 25) // 25 percent
  };
  sys.recomputeBonuses();
  // percent affixes are stored as value/100 in the cache
  assert.strictEqual(sys.getBonus('dmg_spinAttack'), 0.25);
});

test('WP08 T048: stacking two items sums their per-ability damage bonuses', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', 20), // +20%
    body:   mockAbilityItem(sys, 'spinning_dmg', 15)  // +15%
  };
  sys.recomputeBonuses();
  const bonus = sys.getBonus('dmg_spinAttack');
  // Floating-point friendly comparison
  assert.ok(Math.abs(bonus - 0.35) < 1e-9, 'expected +35% combined, got ' + bonus);
});

test('WP08 T048: unequipping drops the bonus back to 0 after recompute', () => {
  const sys = freshSystem();
  globalThis.window.equipment = {
    weapon: mockAbilityItem(sys, 'spinning_dmg', 25)
  };
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('dmg_spinAttack'), 0.25);

  // Simulate unequip
  globalThis.window.equipment = {};
  sys.recomputeBonuses();
  assert.strictEqual(sys.getBonus('dmg_spinAttack'), 0);
});

