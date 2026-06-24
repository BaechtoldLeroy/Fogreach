// Unit tests for Feature 059 (#42) WP01 — run-amulet data model.
//
// The unit-loadable surface lives in js/lootSystem.js (AMULET_DEFS + rollAmulet).
// The equipment.amulet SLOT + equip/swap live in main.js/inventory.js (Phaser,
// not unit-loadable) and are verified via the smoke test + manual play.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

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
  loadGameModule('js/lootSystem.js');
  return globalThis.window.LootSystem;
}

const EFFECTS = new Set([
  'twin', 'chain', 'cleave', 'lifesteal', 'aura', 'tempo',
  'orbit', 'killburst', 'dashstrike', 'momentum', 'frost', 'glass', 'revive', 'bloodpact'
]);
const GEAR_TYPES = ['weapon', 'head', 'body', 'boots', 'potion', 'material'];

test('AMULET_DEFS: 14 well-formed, unique amulet defs (voller Pool)', () => {
  const sys = freshSystem();
  const defs = sys.AMULET_DEFS;
  assert.ok(Array.isArray(defs) && defs.length === 14, 'exactly 14 amulets');
  const keys = new Set();
  for (const d of defs) {
    assert.strictEqual(d.type, 'amulet');
    assert.ok(typeof d.key === 'string' && d.key.length > 0, 'has key');
    assert.ok(typeof d.name === 'string' && d.name.length > 0, 'has name');
    assert.ok(typeof d.iconKey === 'string' && d.iconKey.length > 0, 'has iconKey');
    assert.ok(EFFECTS.has(d.effect), 'known effect key: ' + d.effect);
    keys.add(d.key);
  }
  assert.strictEqual(keys.size, 14, 'unique keys');
});

test('AMULET_DEFS: alle effect-Keys einmalig (kein Effekt doppelt)', () => {
  const sys = freshSystem();
  const effects = sys.AMULET_DEFS.map((d) => d.effect);
  assert.strictEqual(new Set(effects).size, effects.length, 'unique effect keys');
  assert.strictEqual(effects.length, EFFECTS.size, 'pool covers exactly the known effects');
});

test('AMULET_DEFS is frozen (cannot be mutated)', () => {
  const sys = freshSystem();
  assert.strictEqual(Object.isFrozen(sys.AMULET_DEFS), true);
  assert.throws(() => { sys.AMULET_DEFS.push({}); });
});

test('rollAmulet returns a valid amulet item from the pool', () => {
  const sys = freshSystem();
  const keys = new Set(sys.AMULET_DEFS.map((d) => d.key));
  for (let s = 0; s < 200; s++) {
    const a = sys.rollAmulet(12, makeRng(s + 1));
    assert.strictEqual(a.type, 'amulet', 'only amulets');
    assert.strictEqual(a.isAmulet, true);
    assert.ok(keys.has(a.key), 'key from AMULET_DEFS: ' + a.key);
    assert.ok(EFFECTS.has(a.effect), 'effect set: ' + a.effect);
    assert.ok(typeof a.name === 'string' && a.name.length > 0);
  }
});

test('rollAmulet never returns regular gear types (separate from rollItem)', () => {
  const sys = freshSystem();
  for (let s = 0; s < 100; s++) {
    const a = sys.rollAmulet(15, makeRng(s + 100));
    assert.ok(!GEAR_TYPES.includes(a.type), 'not gear: ' + a.type);
  }
});

test('rollAmulet is deterministic for a given seed', () => {
  const sys = freshSystem();
  assert.strictEqual(sys.rollAmulet(12, makeRng(42)).key, sys.rollAmulet(12, makeRng(42)).key);
});

test('rollAmulet defaults (no rng / no depth) do not throw and return an amulet', () => {
  const sys = freshSystem();
  const a = sys.rollAmulet();
  assert.strictEqual(a.type, 'amulet');
  assert.ok(typeof a.name === 'string' && a.name.length > 0);
});

// --- WP02: Run-Lifecycle (Reset + Save-Guard) ---

test('#42 WP02: PERSISTENT_EQUIP_SLOTS excludes amulet (Save-Guard FR-12)', () => {
  const sys = freshSystem();
  assert.ok(Array.isArray(sys.PERSISTENT_EQUIP_SLOTS), 'whitelist exists');
  assert.deepStrictEqual(sys.PERSISTENT_EQUIP_SLOTS, ['weapon', 'head', 'body', 'boots']);
  assert.ok(!sys.PERSISTENT_EQUIP_SLOTS.includes('amulet'), 'amulet is never persisted');
});

test('#42 WP02: clearRunAmulet nulls the amulet slot, leaves gear untouched', () => {
  const sys = freshSystem();
  const eq = { weapon: { x: 1 }, head: null, body: null, boots: null, amulet: { effect: 'twin' } };
  const out = sys.clearRunAmulet(eq);
  assert.strictEqual(out.amulet, null, 'amulet cleared');
  assert.deepStrictEqual(out.weapon, { x: 1 }, 'weapon untouched');
});

test('#42 WP02: clearRunAmulet is null-safe (no throw)', () => {
  const sys = freshSystem();
  assert.doesNotThrow(() => sys.clearRunAmulet(null));
  assert.doesNotThrow(() => sys.clearRunAmulet(undefined));
  assert.doesNotThrow(() => sys.clearRunAmulet({}));
});
