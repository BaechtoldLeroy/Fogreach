// Unit tests for js/printingHouse.js
//
// PrintingHouse is an IIFE attaching window.PrintingHouse. Pattern mirrors
// tutorialSystem / factionSystem: load + register at IIFE eval, mutate via
// public API, persist after every change, expose a _configureForTest seam.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const STORAGE_KEY = 'demonfall_printinghouse_v1';

function makePrimitives(overrides) {
  const _store = {};
  const i18nCalls = { de: 0, en: 0 };
  const base = {
    storage: {
      _store,
      getItem: (k) => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; }
    },
    i18n: {
      _calls: i18nCalls,
      register: (lang) => {
        if (lang === 'de') i18nCalls.de += 1;
        else if (lang === 'en') i18nCalls.en += 1;
      },
      t: (k) => k,
      onChange: () => () => {}
    },
    factionSystem: {
      _standing: { resistance: 0, council: 0, independent: 0 },
      getStanding(id) { return this._standing[id] || 0; }
    },
    questSystem: {
      _completed: [],
      getCompletedQuests() { return this._completed.slice(); }
    },
    lootSystem: {
      _gold: 0,
      getGold() { return this._gold; },
      spendGold(amount) {
        if (this._gold < amount) return false;
        this._gold -= amount;
        return true;
      }
    }
  };
  return Object.assign(base, overrides || {});
}

let loaded = false;
function ensureLoaded() {
  if (!loaded) {
    if (!globalThis.window.i18n) {
      globalThis.window.i18n = { register: () => {}, t: (k) => k, onChange: () => () => {} };
    }
    loadGameModule('js/printingHouse.js');
    loaded = true;
  }
  return globalThis.window.PrintingHouse;
}

function fresh(overrides) {
  const PH = ensureLoaded();
  const p = makePrimitives(overrides);
  PH._configureForTest(p);
  return { PH, p };
}

beforeEach(() => { resetStore(); });

// --- 1. init + i18n -------------------------------------------------------

test('init() is idempotent and registers i18n exactly once per language', () => {
  const { PH, p } = fresh();
  PH.init();
  assert.strictEqual(p.i18n._calls.de, 1);
  assert.strictEqual(p.i18n._calls.en, 1);
  PH.init();
  PH.init();
  assert.strictEqual(p.i18n._calls.de, 1);
  assert.strictEqual(p.i18n._calls.en, 1);
});

// --- 2. Druckblätter currency ---------------------------------------------

test('addDruckblaetter clamps to the 50-cap', () => {
  const { PH } = fresh();
  PH.init();
  assert.strictEqual(PH.getDruckblaetter(), 0);
  assert.strictEqual(PH.addDruckblaetter(30), 30);
  assert.strictEqual(PH.addDruckblaetter(30), 50);
  assert.strictEqual(PH.addDruckblaetter(10), 50);
});

test('addDruckblaetter persists', () => {
  const { PH, p } = fresh();
  PH.init();
  PH.addDruckblaetter(7);
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.druckblaetter, 7);
});

// --- 3. Suspicion ---------------------------------------------------------

test('addSuspicion clamps to >= 0; bribe deducts gold and reduces suspicion', () => {
  const { PH, p } = fresh();
  PH.init();
  PH.addSuspicion(10);
  assert.strictEqual(PH.getSuspicion(), 10);
  PH.addSuspicion(-3);
  assert.strictEqual(PH.getSuspicion(), 7);
  PH.addSuspicion(-100);
  assert.strictEqual(PH.getSuspicion(), 0, 'clamps to zero');
  PH.addSuspicion(15);
  p.lootSystem._gold = 200;
  assert.strictEqual(PH.bribe(), true);
  assert.strictEqual(PH.getSuspicion(), 10);
  assert.strictEqual(p.lootSystem._gold, 100);
});

test('bribe with insufficient gold is a no-op', () => {
  const { PH, p } = fresh();
  PH.init();
  PH.addSuspicion(10);
  p.lootSystem._gold = 50;
  assert.strictEqual(PH.bribe(), false);
  assert.strictEqual(PH.getSuspicion(), 10);
  assert.strictEqual(p.lootSystem._gold, 50);
});

test('bribe at suspicion 0 is a no-op (no gold deducted)', () => {
  const { PH, p } = fresh();
  PH.init();
  p.lootSystem._gold = 200;
  assert.strictEqual(PH.bribe(), false);
  assert.strictEqual(p.lootSystem._gold, 200);
});

// --- 4. Druckerei unlock --------------------------------------------------

test('isUnlocked() returns true once aldric_cleanup is completed', () => {
  const { PH, p } = fresh();
  PH.init();
  assert.strictEqual(PH.isUnlocked(), false);
  p.questSystem._completed.push('aldric_cleanup');
  assert.strictEqual(PH.isUnlocked(), true);
});

// --- 5. Edict catalog visibility -----------------------------------------

test('getEdictCatalog returns at least 7 edicts across three tiers', () => {
  const { PH } = fresh();
  PH.init();
  const cat = PH.getEdictCatalog();
  assert.ok(cat.length >= 7, 'catalog has at least 7 entries');
  const tiers = new Set(cat.map(e => e.tier));
  assert.ok(tiers.has('mild'));
  assert.ok(tiers.has('strong'));
  assert.ok(tiers.has('risky'));
});

test('catalog entries report unlocked state based on resistance standing', () => {
  const { PH, p } = fresh();
  PH.init();
  const cat0 = PH.getEdictCatalog();
  const mild0 = cat0.find(e => e.tier === 'mild');
  const strong0 = cat0.find(e => e.tier === 'strong');
  const risky0 = cat0.find(e => e.tier === 'risky');
  assert.strictEqual(mild0.isUnlocked, true);
  assert.strictEqual(strong0.isUnlocked, false);
  assert.strictEqual(risky0.isUnlocked, false);
  p.factionSystem._standing.resistance = 30;
  const cat1 = PH.getEdictCatalog();
  assert.strictEqual(cat1.find(e => e.id === strong0.id).isUnlocked, true);
  assert.strictEqual(cat1.find(e => e.id === risky0.id).isUnlocked, false);
  p.factionSystem._standing.resistance = 60;
  const cat2 = PH.getEdictCatalog();
  assert.strictEqual(cat2.find(e => e.id === risky0.id).isUnlocked, true);
});

// --- 6. publishEdict ------------------------------------------------------

test('publishEdict succeeds when all requirements are met; deducts cost; bumps suspicion; records history', () => {
  const { PH, p } = fresh();
  PH.init();
  PH.addDruckblaetter(5);
  const cat = PH.getEdictCatalog();
  const mild = cat.find(e => e.tier === 'mild' && e.isUnlocked);
  const result = PH.publishEdict(mild.id);
  assert.strictEqual(result.success, true);
  assert.strictEqual(PH.getDruckblaetter(), 5 - mild.cost);
  assert.strictEqual(PH.getSuspicion(), mild.suspicionCost);
  const active = PH.getActivePublication();
  assert.ok(active && active.id === mild.id);
  const history = PH.getHistory();
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].edictId, mild.id);
});

test('publishEdict fails with insufficient Druckblätter', () => {
  const { PH } = fresh();
  PH.init();
  const cat = PH.getEdictCatalog();
  const mild = cat.find(e => e.tier === 'mild');
  // 0 Druckblätter
  const result = PH.publishEdict(mild.id);
  assert.strictEqual(result.success, false);
  assert.ok(/insufficient|cost|druckbl/i.test(result.reason || ''));
});

test('publishEdict fails when tier is locked', () => {
  const { PH } = fresh();
  PH.init();
  PH.addDruckblaetter(50);
  const cat = PH.getEdictCatalog();
  const strong = cat.find(e => e.tier === 'strong');
  const result = PH.publishEdict(strong.id);
  assert.strictEqual(result.success, false);
  assert.ok(/lock|standing/i.test(result.reason || ''));
});

test('publishEdict fails when an edict is already active', () => {
  const { PH } = fresh();
  PH.init();
  PH.addDruckblaetter(10);
  const mild = PH.getEdictCatalog().find(e => e.tier === 'mild' && e.isUnlocked);
  PH.publishEdict(mild.id);
  const result = PH.publishEdict(mild.id);
  assert.strictEqual(result.success, false);
  assert.ok(/active|already/i.test(result.reason || ''));
});

// --- 7. clearActivePublication + decaySuspicion ---------------------------

test('clearActivePublication clears the active slot but keeps history', () => {
  const { PH } = fresh();
  PH.init();
  PH.addDruckblaetter(5);
  const mild = PH.getEdictCatalog().find(e => e.tier === 'mild' && e.isUnlocked);
  PH.publishEdict(mild.id);
  PH.clearActivePublication();
  assert.strictEqual(PH.getActivePublication(), null);
  assert.strictEqual(PH.getHistory().length, 1, 'history preserved');
});

test('decaySuspicion reduces suspicion by 1 (only when no active edict and >0)', () => {
  const { PH } = fresh();
  PH.init();
  PH.addSuspicion(5);
  PH.decaySuspicion();
  assert.strictEqual(PH.getSuspicion(), 4);
  // With active edict, no decay.
  PH.addDruckblaetter(5);
  const mild = PH.getEdictCatalog().find(e => e.tier === 'mild' && e.isUnlocked);
  PH.publishEdict(mild.id);
  const before = PH.getSuspicion();
  PH.decaySuspicion();
  assert.strictEqual(PH.getSuspicion(), before, 'no decay while edict active');
});

test('decaySuspicion clamps to zero', () => {
  const { PH } = fresh();
  PH.init();
  PH.decaySuspicion();
  assert.strictEqual(PH.getSuspicion(), 0);
});

// --- 8. Persistence migration ---------------------------------------------

test('stored blob with version > 1 is discarded on init', () => {
  const { PH, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2, druckblaetter: 99, suspicion: 99, active: 'x', history: []
  }));
  // Suppress noisy warn
  const origWarn = console.warn;
  console.warn = () => {};
  try { PH.init(); } finally { console.warn = origWarn; }
  assert.strictEqual(PH.getDruckblaetter(), 0);
  assert.strictEqual(PH.getSuspicion(), 0);
});
