// Unit tests for js/knowledgeTree.js
//
// KnowledgeTree is an IIFE attaching window.KnowledgeTree. Pattern mirrors
// printingHouse / factionSystem: load once via the shared loader, then per
// test rebuild a fresh primitives bundle and call `_configureForTest(p)`
// which resets internal state, reloads from the (potentially preloaded)
// storage stub, and rebuilds window.knowledgeTreeBuffs from current ranks.
//
// Each test isolates its storage by handing _configureForTest its own
// makeStorage() instance — so cross-test leakage is impossible.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const STORAGE_KEY = 'demonfall.knowledgeTree.v1';

// -- Helpers --------------------------------------------------------------

function makeStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    _data: data,
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

function makeQuietI18n() {
  return {
    register: () => {},
    t: (k) => k,
    onChange: () => () => {}
  };
}

function makePrimitives(overrides) {
  const base = {
    storage: makeStorage(),
    i18n: makeQuietI18n()
  };
  return Object.assign(base, overrides || {});
}

let loaded = false;
function ensureLoaded() {
  if (!loaded) {
    if (!globalThis.window.i18n) {
      globalThis.window.i18n = makeQuietI18n();
    }
    loadGameModule('js/knowledgeTree.js');
    loaded = true;
  }
  return globalThis.window.KnowledgeTree;
}

function fresh(overrides) {
  const KT = ensureLoaded();
  const p = makePrimitives(overrides);
  // Silence any one-time warnings emitted during _configureForTest's load path
  // (e.g. malformed-blob / version-mismatch warns). We restore immediately so
  // assertions about real warnings could still be added per-test if needed.
  const origWarn = console.warn;
  console.warn = () => {};
  try { KT._configureForTest(p); } finally { console.warn = origWarn; }
  return { KT, p };
}

beforeEach(() => { resetStore(); });

// =========================================================================
// T008 — Scaffolding + clean-default-state verification
// =========================================================================

test('T008: clean state after _configureForTest with empty storage', () => {
  const { KT } = fresh();
  assert.strictEqual(KT.getFragments(), 0);
  const state = KT.getState();
  assert.strictEqual(Object.keys(state.ranks).length, 10);
  for (const id in state.ranks) {
    assert.strictEqual(state.ranks[id], 0, 'rank for ' + id + ' starts at 0');
  }
});

test('T008: getCatalog returns 10 nodes with stable shape', () => {
  const { KT } = fresh();
  const catalog = KT.getCatalog();
  assert.strictEqual(catalog.length, 10);
  const ids = catalog.map((n) => n.id);
  // Spot-check stable IDs (persisted contract — never rename).
  assert.ok(ids.includes('node_damage'));
  assert.ok(ids.includes('node_xp'));
  assert.ok(ids.includes('node_cdr'));
  for (const node of catalog) {
    assert.strictEqual(typeof node.id, 'string');
    assert.strictEqual(typeof node.maxRank, 'number');
    assert.ok(node.maxRank >= 1);
    assert.ok(node.perRank && typeof node.perRank.field === 'string');
    assert.ok(node.perRank.kind === 'mult' || node.perRank.kind === 'add');
  }
});

test('T008: knowledgeTreeBuffs initialized to identity after fresh configure', () => {
  fresh();
  const buffs = globalThis.window.knowledgeTreeBuffs;
  assert.ok(buffs, 'buffs bag exists');
  assert.strictEqual(buffs.damageMult, 1.0);
  assert.strictEqual(buffs.armorAdd, 0);
  assert.strictEqual(buffs.speedMult, 1.0);
  assert.strictEqual(buffs.maxHpAdd, 0);
  assert.strictEqual(buffs.critAdd, 0);
  assert.strictEqual(buffs.xpMult, 1.0);
  assert.strictEqual(buffs.goldMult, 1.0);
  assert.strictEqual(buffs.pickupAddRange, 0);
  assert.strictEqual(buffs.magicFindMult, 1.0);
  assert.strictEqual(buffs.cdrAll, 0);
});

// =========================================================================
// T009 — Core API: add / invest / respec / cap / wallet / unknown
// =========================================================================

test('T009: addFragments handles positive, zero, and negative inputs', () => {
  const { KT } = fresh();
  KT.addFragments(3);
  assert.strictEqual(KT.getFragments(), 3);
  KT.addFragments(0); // no-op
  assert.strictEqual(KT.getFragments(), 3);
  // Negative is rejected — silence the expected warn.
  const origWarn = console.warn;
  console.warn = () => {};
  try { KT.addFragments(-5); } finally { console.warn = origWarn; }
  assert.strictEqual(KT.getFragments(), 3);
});

test('T009: addFragments rejects non-numeric and non-finite inputs', () => {
  const { KT } = fresh();
  KT.addFragments('seven');
  KT.addFragments(NaN);
  KT.addFragments(Infinity);
  KT.addFragments(undefined);
  KT.addFragments(null);
  assert.strictEqual(KT.getFragments(), 0);
});

test('T009: invest happy-path deducts a fragment and ranks up the node', () => {
  const { KT } = fresh();
  KT.addFragments(3);
  const ok = KT.invest('node_damage');
  assert.strictEqual(ok, true);
  assert.strictEqual(KT.getFragments(), 2);
  assert.strictEqual(KT.getRank('node_damage'), 1);
  // Buff field updated: +5% per rank (mult).
  assert.ok(Math.abs(globalThis.window.knowledgeTreeBuffs.damageMult - 1.05) < 1e-9);
});

test('T009: invest with no fragments returns false and leaves state unchanged', () => {
  const { KT } = fresh();
  const ok = KT.invest('node_damage');
  assert.strictEqual(ok, false);
  assert.strictEqual(KT.getRank('node_damage'), 0);
  assert.strictEqual(KT.getFragments(), 0);
});

test('T009: invest blocked once maxRank is reached (maxRank=5, node_damage)', () => {
  const { KT } = fresh();
  KT.addFragments(10);
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(KT.invest('node_damage'), true, 'invest ' + (i + 1) + ' succeeds');
  }
  // 6th invest blocked by maxRank=5
  assert.strictEqual(KT.invest('node_damage'), false);
  assert.strictEqual(KT.getRank('node_damage'), 5);
  assert.strictEqual(KT.getFragments(), 5);
});

test('T009: invest blocked at maxRank=3 (node_xp)', () => {
  const { KT } = fresh();
  KT.addFragments(5);
  assert.strictEqual(KT.invest('node_xp'), true);
  assert.strictEqual(KT.invest('node_xp'), true);
  assert.strictEqual(KT.invest('node_xp'), true);
  assert.strictEqual(KT.invest('node_xp'), false, 'capped at 3');
  assert.strictEqual(KT.getRank('node_xp'), 3);
  assert.strictEqual(KT.getFragments(), 2);
});

test('T009: invest unknown node returns false; no fragment consumed', () => {
  const { KT } = fresh();
  KT.addFragments(1);
  const ok = KT.invest('node_nonexistent');
  assert.strictEqual(ok, false);
  assert.strictEqual(KT.getFragments(), 1);
});

test('T009: getRank on unknown nodeId returns 0 silently', () => {
  const { KT } = fresh();
  const origWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    assert.strictEqual(KT.getRank('node_does_not_exist'), 0);
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(warned, false, 'getRank on unknown id must be silent');
});

test('T009: respec refunds all invested fragments and resets ranks + buffs', () => {
  const { KT } = fresh();
  KT.addFragments(10);
  assert.strictEqual(KT.invest('node_damage'), true);
  assert.strictEqual(KT.invest('node_damage'), true);
  assert.strictEqual(KT.invest('node_armor'), true);
  assert.strictEqual(KT.getFragments(), 7);
  KT.respec();
  assert.strictEqual(KT.getFragments(), 10);
  assert.strictEqual(KT.getRank('node_damage'), 0);
  assert.strictEqual(KT.getRank('node_armor'), 0);
  // Buffs reset to identity
  assert.strictEqual(globalThis.window.knowledgeTreeBuffs.damageMult, 1.0);
  assert.strictEqual(globalThis.window.knowledgeTreeBuffs.armorAdd, 0);
});

test('T009: invest on a mult-kind node updates buff to 1 + rank*value', () => {
  const { KT } = fresh();
  KT.addFragments(5);
  KT.invest('node_speed'); // +3% per rank
  KT.invest('node_speed');
  assert.strictEqual(KT.getRank('node_speed'), 2);
  assert.ok(Math.abs(globalThis.window.knowledgeTreeBuffs.speedMult - 1.06) < 1e-9);
});

test('T009: invest on an add-kind node updates buff to rank*value', () => {
  const { KT } = fresh();
  KT.addFragments(5);
  KT.invest('node_max_hp'); // +10 per rank (add)
  KT.invest('node_max_hp');
  KT.invest('node_max_hp');
  assert.strictEqual(KT.getRank('node_max_hp'), 3);
  assert.strictEqual(globalThis.window.knowledgeTreeBuffs.maxHpAdd, 30);
});

test('T009: invest triggers recalcDerived seam when supplied', () => {
  let calls = 0;
  const { KT } = fresh({ recalcDerived: () => { calls += 1; } });
  KT.addFragments(2);
  KT.invest('node_damage');
  assert.strictEqual(calls, 1, 'recalcDerived fired once on invest');
  KT.respec();
  assert.strictEqual(calls, 2, 'recalcDerived fired again on respec');
});

// =========================================================================
// T010 — Persistence: round-trip / version / malformed / clamp / drop /
//        FR-11 missing ranks default to zero
// =========================================================================

test('T010: persistence round-trip (re-configure with same storage rehydrates)', () => {
  const stor = makeStorage();
  const { KT } = fresh({ storage: stor });
  KT.addFragments(5);
  assert.strictEqual(KT.invest('node_damage'), true);
  // Re-initialise with the same storage — simulates a page reload.
  fresh({ storage: stor });
  assert.strictEqual(globalThis.window.KnowledgeTree.getFragments(), 4);
  assert.strictEqual(globalThis.window.KnowledgeTree.getRank('node_damage'), 1);
  // Buffs re-applied from rehydrated ranks.
  assert.ok(Math.abs(globalThis.window.knowledgeTreeBuffs.damageMult - 1.05) < 1e-9);
});

test('T010: persistence — version mismatch starts fresh and clears blob', () => {
  const stor = makeStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 99, fragments: 100, ranks: { node_damage: 5 } })
  });
  const { KT } = fresh({ storage: stor });
  assert.strictEqual(KT.getFragments(), 0);
  assert.strictEqual(KT.getRank('node_damage'), 0);
  // Module proactively wipes the incompatible blob.
  assert.strictEqual(stor.getItem(STORAGE_KEY), null);
});

test('T010: persistence — malformed JSON blob starts fresh', () => {
  const stor = makeStorage({ [STORAGE_KEY]: '{not-valid-json' });
  const { KT } = fresh({ storage: stor });
  assert.strictEqual(KT.getFragments(), 0);
  assert.strictEqual(KT.getRank('node_damage'), 0);
  assert.strictEqual(stor.getItem(STORAGE_KEY), null);
});

test('T010: persistence — over-rank value is clamped to maxRank and refunded', () => {
  // node_damage maxRank is 5; persisted blob has rank=8 — clamps to 5 and refunds 3.
  const stor = makeStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      fragments: 2,
      ranks: { node_damage: 8 }
    })
  });
  const { KT } = fresh({ storage: stor });
  assert.strictEqual(KT.getRank('node_damage'), 5);
  assert.strictEqual(KT.getFragments(), 2 + 3, 'refund 3 over-rank points');
});

test('T010: persistence — unknown nodeId is dropped and refunded', () => {
  const stor = makeStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      fragments: 1,
      ranks: { node_unknown_v2_thing: 4 }
    })
  });
  const { KT } = fresh({ storage: stor });
  assert.strictEqual(KT.getRank('node_unknown_v2_thing'), 0);
  assert.strictEqual(KT.getFragments(), 1 + 4, 'refund all 4 unknown-node points');
});

test('T010: FR-11 — missing nodeIds in persisted ranks default to rank 0', () => {
  const stor = makeStorage({
    [STORAGE_KEY]: JSON.stringify({ version: 1, fragments: 3 })
  });
  const { KT } = fresh({ storage: stor });
  assert.strictEqual(KT.getFragments(), 3);
  // Every catalog node must read 0.
  for (const node of KT.getCatalog()) {
    assert.strictEqual(KT.getRank(node.id), 0, node.id + ' defaults to 0');
  }
});

test('T010: persistence writes blob after addFragments and after invest', () => {
  const stor = makeStorage();
  const { KT } = fresh({ storage: stor });
  KT.addFragments(7);
  let blob = JSON.parse(stor.getItem(STORAGE_KEY));
  assert.strictEqual(blob.fragments, 7);
  assert.strictEqual(blob.version, 1);
  KT.invest('node_armor');
  blob = JSON.parse(stor.getItem(STORAGE_KEY));
  assert.strictEqual(blob.fragments, 6);
  assert.strictEqual(blob.ranks.node_armor, 1);
});

// =========================================================================
// T011 — Subscribers: notify / unsubscribe / throwing isolation (NFR-04)
// =========================================================================

test('T011: subscriber fires on addFragments with current snapshot', () => {
  const { KT } = fresh();
  let calls = 0;
  let lastState = null;
  KT.onChange((s) => { calls += 1; lastState = s; });
  KT.addFragments(2);
  assert.strictEqual(calls, 1);
  assert.ok(lastState && lastState.fragments === 2);
  assert.ok(lastState.ranks && typeof lastState.ranks === 'object');
});

test('T011: subscriber fires on invest and respec (3 total)', () => {
  const { KT } = fresh();
  let calls = 0;
  KT.onChange(() => { calls += 1; });
  KT.addFragments(1);            // +1
  assert.strictEqual(KT.invest('node_damage'), true); // +1
  KT.respec();                   // +1
  assert.strictEqual(calls, 3);
});

test('T011: unsubscribe stops further notifications', () => {
  const { KT } = fresh();
  let calls = 0;
  const off = KT.onChange(() => { calls += 1; });
  KT.addFragments(1);
  assert.strictEqual(calls, 1);
  off();
  KT.addFragments(1);
  assert.strictEqual(calls, 1, 'no further notifications after unsubscribe');
});

test('T011: a throwing subscriber does NOT block siblings (NFR-04)', () => {
  const { KT } = fresh();
  let goodCalls = 0;
  // Silence the warn that the module emits when a subscriber throws.
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    KT.onChange(() => { throw new Error('subscriber failure'); });
    KT.onChange(() => { goodCalls += 1; });
    KT.addFragments(1);
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(goodCalls, 1);
});

test('T011: onChange returns a no-op unsubscriber for non-function input', () => {
  const { KT } = fresh();
  const off = KT.onChange('not a function');
  assert.strictEqual(typeof off, 'function');
  // Calling it must not throw.
  off();
  // And no real callback was registered, so notifications add no calls.
  KT.addFragments(1);
  // Nothing observable to assert other than no exceptions.
  assert.ok(true);
});

test('T011: multiple subscribers each receive the same snapshot', () => {
  const { KT } = fresh();
  const snaps = [];
  KT.onChange((s) => snaps.push(['a', s.fragments]));
  KT.onChange((s) => snaps.push(['b', s.fragments]));
  KT.addFragments(4);
  assert.deepStrictEqual(snaps, [['a', 4], ['b', 4]]);
});
