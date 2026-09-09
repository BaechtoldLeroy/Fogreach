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
  assert.strictEqual(Object.keys(state.ranks).length, 12);
  for (const id in state.ranks) {
    assert.strictEqual(state.ranks[id], 0, 'rank for ' + id + ' starts at 0');
  }
});

test('T008: getCatalog returns 12 nodes with stable shape', () => {
  const { KT } = fresh();
  const catalog = KT.getCatalog();
  // #116: vier Knoten je Zweig, alle maxRank 5 -> 12 Knoten, 60 Raenge.
  assert.strictEqual(catalog.length, 12);
  const ids = catalog.map((n) => n.id);
  // Spot-check stable IDs (persisted contract — never rename).
  assert.ok(ids.includes('node_damage'));
  assert.ok(ids.includes('node_xp'));
  // #116: node_cdr ist in den Talentbaum gewandert (dort haengt die
  // Abklingzeit an einer Entscheidung), ersetzt durch node_angriffstempo.
  assert.ok(ids.includes('node_angriffstempo'));
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

test('T009: invest blocked at maxRank=5 (node_xp)', () => {
  // #116: die Gier-Knoten standen auf maxRank 3; jetzt 5, damit alle drei
  // Zweige 20 Raenge haben. Der DECKEL ist derselbe (3 % x 5 statt 5 % x 3).
  const { KT } = fresh();
  KT.addFragments(7);
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(KT.invest('node_xp'), true, 'Rang ' + (i + 1));
  }
  assert.strictEqual(KT.invest('node_xp'), false, 'bei 5 gedeckelt');
  assert.strictEqual(KT.getRank('node_xp'), 5);
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

// ---------------------------------------------------------------------------
// #116 — Keystones
// ---------------------------------------------------------------------------
// Die zehn Kleinknoten sind unbedingte Einzelwerte; die Knappheit laeuft ab,
// weil Fragmente sich ueber die Laeufe ansammeln. Dauerhaft ist nur, was sich
// ausschliesst — darum sechs Keystones, von denen HOECHSTENS EINER gilt.

// #116: Ein Grundsatz verlangt seit der Verkettung ein Buendel seines Zweigs
// (6 Raenge -> Buendel -> Grundsatz). Die Tests unten wollen den Grundsatz
// pruefen, nicht den Weg dorthin — dieser Helfer geht ihn.
function oeffneZweig(KT, zweig, notableId) {
  // Acht Raenge, seit NOTABLE_BRAUCHT von 6 auf 8 gezogen ist (bei 20 Raengen
  // je Zweig waeren 6 nur noch 30 % statt 40 %).
  const wege = {
    kraft: ['node_damage', 'node_damage', 'node_damage', 'node_damage', 'node_damage',
      'node_angriffstempo', 'node_angriffstempo', 'node_angriffstempo'],
    zaehigkeit: ['node_armor', 'node_armor', 'node_armor', 'node_armor', 'node_armor',
      'node_speed', 'node_speed', 'node_speed'],
    gier: ['node_gold', 'node_gold', 'node_gold', 'node_gold',
      'node_xp', 'node_xp', 'node_xp', 'node_xp']
  };
  wege[zweig].forEach((id) => KT.invest(id));
  const nid = notableId || { kraft: 'not_schlagfolge', zaehigkeit: 'not_zaeher_lauf', gier: 'not_aasgeier' }[zweig];
  assert.strictEqual(KT.investNotable(nid), true, 'Buendel ' + nid + ' muss setzbar sein');
}

test('Keystones: sechs Stueck, je mindestens drei Effekte', () => {
  const { KT } = fresh();
  const ks = KT.getKeystones();
  assert.strictEqual(ks.length, 6, 'sechs Keystones erwartet');
  ks.forEach((k) => {
    assert.ok(Array.isArray(k.effekte) && k.effekte.length >= 3,
      k.id + ' braucht mindestens drei Effekte');
    assert.ok(k.labelKey && k.descKey && k.zweig, k.id + ' unvollstaendig');
  });
});

test('Keystones: hoechstens einer darf gesetzt sein', () => {
  const { KT } = fresh();
  KT.addFragments(80);
  oeffneZweig(KT, 'zaehigkeit');
  oeffneZweig(KT, 'kraft');
  oeffneZweig(KT, 'gier');
  assert.strictEqual(KT.getActiveKeystone(), null);
  assert.strictEqual(KT.investKeystone('key_turmwache'), true);
  assert.strictEqual(KT.getActiveKeystone(), 'key_turmwache');
  assert.strictEqual(KT.investKeystone('key_blutrausch'), false, 'zweiter muss abgelehnt werden');
  assert.strictEqual(KT.investKeystone('key_sammler'), false);
  assert.strictEqual(KT.getActiveKeystone(), 'key_turmwache');
});

test('Keystones: Kosten abgezogen, beim Loesen erstattet', () => {
  const { KT } = fresh();
  KT.addFragments(40);
  oeffneZweig(KT, 'gier');
  const vor = KT.getFragments();
  KT.investKeystone('key_sammler');
  assert.strictEqual(KT.getFragments(), vor - KT.KEYSTONE_KOSTEN);
  assert.strictEqual(KT.loeseKeystone(), true);
  assert.strictEqual(KT.getFragments(), vor, 'Einsatz kommt vollstaendig zurueck');
  assert.strictEqual(KT.getActiveKeystone(), null);
});

test('Keystones: zu wenig Fragmente -> abgelehnt', () => {
  const { KT } = fresh();
  // Genau so viele Fragmente, dass der Zweig aufgeht (6 Raenge + Buendel = 10)
  // und danach EINES zu wenig fuer den Grundsatz bleibt.
  KT.addFragments(12 + KT.KEYSTONE_KOSTEN - 1);
  oeffneZweig(KT, 'zaehigkeit');
  assert.strictEqual(KT.getFragments(), KT.KEYSTONE_KOSTEN - 1, 'ein Fragment zu wenig');
  assert.strictEqual(KT.keystoneOffen('key_turmwache'), true, 'der Weg ist offen');
  assert.strictEqual(KT.investKeystone('key_turmwache'), false, 'aber das Gold fehlt');
  assert.strictEqual(KT.getActiveKeystone(), null);
});

test('Keystones: der Entzug schlaegt die kleinen Knoten', () => {
  // node_crit gibt +0,10 critAdd. "Ruhige Hand" setzt critAdd -1 — der
  // Clamp in inventory.js:1645 macht daraus 0 Kritchance. Ohne diesen Test
  // koennte ein spaeterer Umbau die Reihenfolge drehen und der Preis waere
  // still verschwunden.
  const { KT } = fresh();
  KT.addFragments(60);
  for (let i = 0; i < 5; i++) KT.invest('node_crit');
  assert.ok(Math.abs(globalThis.window.knowledgeTreeBuffs.critAdd - 0.10) < 1e-9);
  // Zweig oeffnen — ueber ein Buendel OHNE critAdd, damit die Zahl oben klar
  // bleibt (Kaltbluetig gaebe +0,05 dazu).
  for (let i = 0; i < 3; i++) KT.invest('node_angriffstempo');
  assert.strictEqual(KT.investNotable('not_schlagfolge'), true);
  KT.investKeystone('key_ruhige_hand');
  const b = globalThis.window.knowledgeTreeBuffs;
  assert.ok(b.critAdd <= -0.8, 'Entzug muss durchschlagen, war ' + b.critAdd);
  // 1,45 (Grundsatz) x 1,08 (Schlagfolge) — das Buendel, das den Zweig
  // geoeffnet hat, faerbt mit ab. Beide Kraft-Buendel beruehren damageMult,
  // ein "sauberer" Weg in diesen Zweig existiert nicht.
  assert.ok(Math.abs(b.damageMult - 1.45 * 1.08) < 1e-9,
    'damageMult 1,566, war ' + b.damageMult);
  assert.ok(Math.abs(b.speedMult - 0.65) < 1e-9, 'speedMult 0,65, war ' + b.speedMult);
});

test('Keystones: multiplizieren mit den kleinen Knoten statt zu ueberschreiben', () => {
  const { KT } = fresh();
  KT.addFragments(60);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');   // +25 % -> 1,25
  assert.ok(Math.abs(globalThis.window.knowledgeTreeBuffs.damageMult - 1.25) < 1e-9);
  // Turmwache liegt in Zaehigkeit; ueber ein Buendel OHNE damageMult oeffnen.
  oeffneZweig(KT, 'zaehigkeit');
  KT.investKeystone('key_turmwache');                     // x0,60
  const d = globalThis.window.knowledgeTreeBuffs.damageMult;
  assert.ok(Math.abs(d - 0.75) < 1e-9, 'erwartet 0,75 (1,25 x 0,60), war ' + d);
});

test('Keystones: Altstand behaelt einen, erstattet den zweiten', () => {
  const blob = JSON.stringify({
    version: 1, fragments: 3,
    ranks: { key_turmwache: 1, key_sammler: 1, node_damage: 2 }
  });
  const { KT } = fresh({ storage: makeStorage({ [STORAGE_KEY]: blob }) });
  assert.strictEqual(KT.getActiveKeystone(), 'key_turmwache', 'erster bleibt gesetzt');
  assert.strictEqual(KT.getRank('node_damage'), 2, 'kleine Knoten unberuehrt');
  assert.strictEqual(KT.getFragments(), 3 + KT.KEYSTONE_KOSTEN,
    'der zweite Keystone wird mit vollem Preis erstattet');
});

// ---------------------------------------------------------------------------
// #116 — node_cdr abgeloest, Notables
// ---------------------------------------------------------------------------

test('node_cdr ist weg, node_angriffstempo da — 20 Raenge je Zweig', () => {
  const { KT } = fresh();
  const ids = KT.getCatalog().map((n) => n.id);
  assert.ok(ids.indexOf('node_cdr') === -1, 'node_cdr gehoert in den Talentbaum');
  assert.ok(ids.indexOf('node_angriffstempo') >= 0, 'node_angriffstempo fehlt');
  const summe = KT.getCatalog().reduce((s2, n) => s2 + n.maxRank, 0);
  // Alle 12 Knoten stehen auf maxRank 5 -> 60 Raenge, exakt 20 je Zweig.
  assert.strictEqual(summe, 60, 'zwoelf Knoten x fuenf Raenge');
  ['kraft', 'zaehigkeit', 'gier'].forEach((z) => {
    const zs = KT.getCatalog().filter((n) => KT.ZWEIG[n.id] === z)
      .reduce((s3, n) => s3 + n.maxRank, 0);
    assert.strictEqual(zs, 20, z + ' hat ' + zs + ' statt 20 Raenge');
  });
});

test('node_angriffstempo speist attackSpeedMult, nicht cdrAll', () => {
  const { KT } = fresh();
  KT.addFragments(20);
  for (let i = 0; i < 5; i++) KT.invest('node_angriffstempo');
  const b = globalThis.window.knowledgeTreeBuffs;
  assert.ok(Math.abs(b.attackSpeedMult - 1.15) < 1e-9,
    '+3 % je Rang -> 1,15, war ' + b.attackSpeedMult);
  assert.strictEqual(b.cdrAll, 0, 'die Abklingzeit gehoert dem Talentbaum');
});

test('Altstand mit node_cdr: Fragmente kommen zurueck', () => {
  const blob = JSON.stringify({ version: 1, fragments: 0, ranks: { node_cdr: 4 } });
  const { KT } = fresh({ storage: makeStorage({ [STORAGE_KEY]: blob }) });
  assert.strictEqual(KT.getRank('node_cdr'), 0);
  assert.strictEqual(KT.getFragments(), 4, 'die vier Raenge werden erstattet');
});

test('Notables: sechs Stueck, je zwei Effekte, je Zweig zwei', () => {
  const { KT } = fresh();
  const ns = KT.getNotables();
  assert.strictEqual(ns.length, 6);
  const proZweig = {};
  ns.forEach((n) => {
    assert.strictEqual(n.effekte.length, 2, n.id + ' buendelt genau zwei Wirkungen');
    proZweig[n.zweig] = (proZweig[n.zweig] | 0) + 1;
  });
  assert.deepStrictEqual(proZweig, { kraft: 2, zaehigkeit: 2, gier: 2 });
});

test('Notables: gesperrt, bis der Zweig sechs Raenge hat', () => {
  const { KT } = fresh();
  KT.addFragments(50);
  assert.strictEqual(KT.notableOffen('not_kaltbluetig'), false, 'anfangs zu');
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), false);
  // sieben Raenge reichen noch nicht
  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  KT.invest('node_crit'); KT.invest('node_crit');
  assert.strictEqual(KT.zweigRaenge('kraft'), 7);
  assert.strictEqual(KT.notableOffen('not_kaltbluetig'), false, 'sieben reichen nicht');
  // der achte oeffnet
  KT.invest('node_crit');
  assert.strictEqual(KT.zweigRaenge('kraft'), 8);
  assert.strictEqual(KT.notableOffen('not_kaltbluetig'), true);
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);
});

test('Notables: Kosten und Wirkung', () => {
  const { KT } = fresh();
  KT.addFragments(50);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');   // 1,25
  for (let i = 0; i < 3; i++) KT.invest('node_crit');     // +0,06, oeffnet den Zweig
  const vor = KT.getFragments();
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);
  assert.strictEqual(KT.getFragments(), vor - KT.NOTABLE_KOSTEN);
  const b = globalThis.window.knowledgeTreeBuffs;
  // 1,25 (Knoten) x 1,10 (Notable) = 1,375
  assert.ok(Math.abs(b.damageMult - 1.375) < 1e-9, 'erwartet 1,375, war ' + b.damageMult);
  assert.ok(Math.abs(b.critAdd - (0.06 + 0.05)) < 1e-9, 'erwartet 0,11, war ' + b.critAdd);
});

test('Notables sind nicht ausschliessend — anders als die Keystones', () => {
  const { KT } = fresh();
  KT.addFragments(80);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  for (let i = 0; i < 3; i++) KT.invest('node_crit');
  for (let i = 0; i < 5; i++) KT.invest('node_armor');
  for (let i = 0; i < 3; i++) KT.invest('node_max_hp');
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);
  assert.strictEqual(KT.investNotable('not_eisenhaut'), true, 'zweiter Notable muss gehen');
});

test('Notable-Altstand wird nicht als unbekannter Knoten erstattet', () => {
  const blob = JSON.stringify({
    version: 1, fragments: 2, ranks: { not_aasgeier: 1, node_gold: 3 }
  });
  const { KT } = fresh({ storage: makeStorage({ [STORAGE_KEY]: blob }) });
  assert.strictEqual(KT.getRank('not_aasgeier'), 1, 'Notable bleibt gesetzt');
  assert.strictEqual(KT.getFragments(), 2, 'nichts faelschlich erstattet');
});

test('Respec erstattet nach PREIS und loest Keystone wie Notable', () => {
  // Vorher zaehlte die Erstattung nur die Raenge — ein Keystone (5) und ein
  // Buendel (4) haben aber Rang 1 und kamen mit je EINEM Fragment zurueck:
  // 50 investiert, 43 erstattet. Und die Loeschschleife lief nur ueber den
  // Katalog, sodass beide gesetzt blieben, obwohl sie erstattet waren.
  const { KT } = fresh();
  KT.addFragments(60);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  for (let i = 0; i < 3; i++) KT.invest('node_crit');
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);
  oeffneZweig(KT, 'zaehigkeit');
  assert.strictEqual(KT.investKeystone('key_turmwache'), true);
  KT.respec();
  assert.strictEqual(KT.getFragments(), 60, 'alles zurueck — auch Buendel und Grundsatz zum vollen Preis');
  assert.strictEqual(KT.getActiveKeystone(), null, 'Keystone muss geloest sein');
  assert.strictEqual(KT.getRank('not_kaltbluetig'), 0, 'Buendel muss geloest sein');
  assert.strictEqual(KT.getRank('not_zaeher_lauf'), 0);
  assert.strictEqual(KT.getRank('node_damage'), 0);
  assert.strictEqual(globalThis.window.knowledgeTreeBuffs.damageMult, 1);
});

test('Respec kostet dasselbe wie im Talentbaum', () => {
  const { KT } = fresh();
  // Ohne LootSystem: kostenlos, damit ein Respec nie an einem fehlenden
  // Modul scheitert.
  const alt = globalThis.window.LootSystem;
  delete globalThis.window.LootSystem;
  assert.strictEqual(KT.getRespecCost(), 0);
  // Mit LootSystem: acht Tiefeneinkommen, exakt wie skillTree.getRespecCost.
  globalThis.window.LootSystem = {
    PREIS_TIEFEN: { respec: 8 },
    preisNachTiefeneinkommen: (n) => n * 13 * 10
  };
  assert.strictEqual(KT.getRespecCost(), 8 * 13 * 10);
  if (alt) globalThis.window.LootSystem = alt; else delete globalThis.window.LootSystem;
});

test('Keystone verlangt ein Buendel seines Zweigs (die Kette)', () => {
  // Ohne diese Bedingung war ein Grundsatz fuer fuenf Fragmente zu haben,
  // ganz ohne Investition — und das drehte die Anreize um: sein Preis trifft
  // einen Wert, den erst der Zweig liefert. Gerechnet fuer "Ruhige Hand":
  // bei 0 Kraft-Raengen netto +45 % Schaden, bei 10 nur +38 %. Der Grundsatz
  // war also am staerksten, wenn man nichts investiert hatte.
  const { KT } = fresh();
  KT.addFragments(60);
  assert.strictEqual(KT.keystoneOffen('key_ruhige_hand'), false, 'anfangs zu');
  assert.strictEqual(KT.investKeystone('key_ruhige_hand'), false);

  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  for (let i = 0; i < 3; i++) KT.invest('node_crit');   // acht Raenge -> Buendel offen
  assert.strictEqual(KT.keystoneOffen('key_ruhige_hand'), false,
    'Raenge allein reichen nicht — es braucht das Buendel');
  assert.strictEqual(KT.investKeystone('key_ruhige_hand'), false);

  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);
  assert.strictEqual(KT.keystoneOffen('key_ruhige_hand'), true);
  assert.strictEqual(KT.investKeystone('key_ruhige_hand'), true);
});

test('Ein Buendel oeffnet BEIDE Grundsaetze seines Zweigs, keine fremden', () => {
  const { KT } = fresh();
  KT.addFragments(60);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  for (let i = 0; i < 3; i++) KT.invest('node_crit');
  KT.investNotable('not_kaltbluetig');
  assert.strictEqual(KT.keystoneOffen('key_ruhige_hand'), true);
  assert.strictEqual(KT.keystoneOffen('key_blutrausch'), true, 'zweiter Kraft-Grundsatz auch');
  assert.strictEqual(KT.keystoneOffen('key_turmwache'), false, 'fremder Zweig bleibt zu');
  assert.strictEqual(KT.keystoneOffen('key_sammler'), false);
});

test('Mindestpreis eines Grundsatzes: 17 Fragmente', () => {
  const { KT } = fresh();
  KT.addFragments(60);
  const vor = KT.getFragments();
  for (let i = 0; i < 5; i++) KT.invest('node_damage');   // 5
  for (let i = 0; i < 3; i++) KT.invest('node_crit');     // 3  -> Tor bei 8
  assert.strictEqual(KT.investNotable('not_kaltbluetig'), true);   // 4
  assert.strictEqual(KT.investKeystone('key_ruhige_hand'), true);  // 5
  assert.strictEqual(vor - KT.getFragments(), 17);
});

test('alle Knoten haben maxRank 5, jeder Zweig 20 Raenge', () => {
  const { KT } = fresh();
  const kat = KT.getCatalog();
  assert.strictEqual(kat.length, 12, 'vier Knoten je Zweig');
  kat.forEach((n) => assert.strictEqual(n.maxRank, 5, n.id + ' muss maxRank 5 haben'));
  const zv = KT.ZWEIG;
  ['kraft', 'zaehigkeit', 'gier'].forEach((z) => {
    const summe = kat.reduce((s2, n) => s2 + (zv[n.id] === z ? n.maxRank : 0), 0);
    assert.strictEqual(summe, 20, z + ' muss 20 Raenge haben');
  });
});

test('Gier behaelt seine Deckel trotz 3 -> 5 Raengen', () => {
  // Der Wert je Rang faellt (5 % x 3 -> 3 % x 5), die Obergrenze bleibt.
  // Ohne diese Anpassung waere der Zweig um zwei Drittel staerker geworden.
  const { KT } = fresh();
  KT.addFragments(60);
  ['node_xp', 'node_gold', 'node_pickup', 'node_magic_find'].forEach((id) => {
    for (let i = 0; i < 5; i++) KT.invest(id);
  });
  const b = globalThis.window.knowledgeTreeBuffs;
  assert.ok(Math.abs(b.xpMult - 1.15) < 1e-9, 'xpMult 1,15, war ' + b.xpMult);
  assert.ok(Math.abs(b.goldMult - 1.15) < 1e-9, 'goldMult 1,15, war ' + b.goldMult);
  assert.strictEqual(b.pickupAddRange, 60);
  assert.ok(Math.abs(b.magicFindMult - 1.15) < 1e-9, 'magicFindMult 1,15, war ' + b.magicFindMult);
});

test('die zwei neuen Knoten speisen eigene Felder', () => {
  const { KT } = fresh();
  KT.addFragments(60);
  for (let i = 0; i < 5; i++) KT.invest('node_kritschaden');
  for (let i = 0; i < 5; i++) KT.invest('node_ausweichen');
  const b = globalThis.window.knowledgeTreeBuffs;
  assert.ok(Math.abs(b.critDamageAdd - 0.30) < 1e-9, 'critDamageAdd 0,30, war ' + b.critDamageAdd);
  assert.ok(Math.abs(b.dodgeAdd - 0.10) < 1e-9, 'dodgeAdd 0,10, war ' + b.dodgeAdd);
});

test('das Tor liegt bei 8 Raengen, nicht mehr bei 6', () => {
  // Bei 20 Raengen je Zweig waeren 6 nur noch 30 % statt 40 %.
  const { KT } = fresh();
  KT.addFragments(60);
  assert.strictEqual(KT.NOTABLE_BRAUCHT, 8);
  for (let i = 0; i < 5; i++) KT.invest('node_damage');
  KT.invest('node_crit'); KT.invest('node_crit');       // 7 Raenge
  assert.strictEqual(KT.notableOffen('not_kaltbluetig'), false, 'sieben reichen nicht');
  KT.invest('node_crit');                                // 8
  assert.strictEqual(KT.notableOffen('not_kaltbluetig'), true);
});
