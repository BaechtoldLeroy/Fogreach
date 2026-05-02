// Unit tests for js/factionSystem.js
//
// FactionSystem is an IIFE attaching window.FactionSystem. We load it once
// via the shared loader, then use _configureForTest(primitives) to swap
// in stubbed storage / i18n per test. Tests assert on observable behavior
// (return values, persisted blob shape, fired callbacks), not internals.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const STORAGE_KEY = 'demonfall_factions_v1';

function makePrimitives() {
  const _store = {};
  const i18nCalls = { de: 0, en: 0, other: 0 };
  return {
    storage: {
      _store,
      getItem: (k) => (Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; }
    },
    i18n: {
      _calls: i18nCalls,
      register: (lang) => {
        if (lang === 'de') i18nCalls.de += 1;
        else if (lang === 'en') i18nCalls.en += 1;
        else i18nCalls.other += 1;
      },
      t: (k) => k,
      onChange: () => () => {}
    }
  };
}

let loaded = false;
function ensureLoaded() {
  if (!loaded) {
    if (!globalThis.window.i18n) {
      globalThis.window.i18n = {
        register: () => {}, t: (k) => k, onChange: () => () => {}
      };
    }
    loadGameModule('js/factionSystem.js');
    loaded = true;
  }
  return globalThis.window.FactionSystem;
}

function fresh(overrides = {}) {
  const FS = ensureLoaded();
  const p = makePrimitives();
  Object.assign(p, overrides);
  FS._configureForTest(p);
  return { FS, p };
}

beforeEach(() => { resetStore(); });

// --- 1. init idempotency + i18n once per language ------------------------

test('init() is idempotent and registers i18n exactly once per language', () => {
  const { FS, p } = fresh();
  FS.init();
  assert.strictEqual(p.i18n._calls.de, 1, 'de registered once');
  assert.strictEqual(p.i18n._calls.en, 1, 'en registered once');
  FS.init();
  FS.init();
  assert.strictEqual(p.i18n._calls.de, 1, 'still once after repeated init');
  assert.strictEqual(p.i18n._calls.en, 1, 'still once after repeated init');
});

// --- 2. getStanding for unknown id returns 0 silently --------------------

test('getStanding returns 0 for unknown faction id without warning', () => {
  const { FS } = fresh();
  FS.init();
  // Capture console.warn so we can assert it was not called.
  const origWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount += 1; };
  try {
    assert.strictEqual(FS.getStanding('xyz'), 0);
    assert.strictEqual(warnCount, 0);
  } finally {
    console.warn = origWarn;
  }
});

// --- 3. getStanding returns persisted value after init -------------------

test('getStanding returns persisted value after init from a seeded blob', () => {
  const { FS, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    standings: { council: 42, resistance: -17, independent: 5 }
  }));
  FS.init();
  assert.strictEqual(FS.getStanding('council'), 42);
  assert.strictEqual(FS.getStanding('resistance'), -17);
  assert.strictEqual(FS.getStanding('independent'), 5);
});

// --- 4. adjustStanding clamps to +100 ------------------------------------

test('adjustStanding clamps to +100 max', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('council', 80);
  const newVal = FS.adjustStanding('council', 50);
  assert.strictEqual(newVal, 100);
  assert.strictEqual(FS.getStanding('council'), 100);
});

// --- 5. adjustStanding clamps to -100 ------------------------------------

test('adjustStanding clamps to -100 min', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('resistance', -80);
  const newVal = FS.adjustStanding('resistance', -50);
  assert.strictEqual(newVal, -100);
  assert.strictEqual(FS.getStanding('resistance'), -100);
});

// --- 6. delta=0 is a no-op + does NOT notify -----------------------------

test('adjustStanding with delta=0 returns current value and does NOT fire subscribers', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('council', 10);
  let fires = 0;
  FS.onChange(() => { fires += 1; });
  const ret = FS.adjustStanding('council', 0);
  assert.strictEqual(ret, 10);
  assert.strictEqual(fires, 0);
});

// --- 7. unknown faction warns once + no-op -------------------------------

test('adjustStanding with unknown faction warns once and returns 0', () => {
  const { FS } = fresh();
  FS.init();
  const origWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount += 1; };
  try {
    const ret = FS.adjustStanding('xyz', 10);
    assert.strictEqual(ret, 0);
    assert.strictEqual(warnCount, 1, 'warn fired exactly once');
  } finally {
    console.warn = origWarn;
  }
});

// --- 8. setStanding clamps + same-value does not notify -------------------

test('setStanding clamps and persists; same-value setStanding does not notify', () => {
  const { FS, p } = fresh();
  FS.init();
  const v1 = FS.setStanding('council', 200); // clamp to 100
  assert.strictEqual(v1, 100);
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.standings.council, 100);
  // setStanding to same value should not notify.
  let fires = 0;
  FS.onChange(() => { fires += 1; });
  FS.setStanding('council', 100);
  assert.strictEqual(fires, 0);
});

// --- 9. getTier returns correct boundary values --------------------------

test('getTier returns correct tier for boundary values', () => {
  const { FS } = fresh();
  FS.init();
  // Hostile: < -25
  FS.setStanding('council', -26);
  assert.strictEqual(FS.getTier('council'), 'hostile');
  // Neutral upper boundary
  FS.setStanding('council', -25);
  assert.strictEqual(FS.getTier('council'), 'neutral');
  FS.setStanding('council', 25);
  assert.strictEqual(FS.getTier('council'), 'neutral');
  // Friendly: > 25
  FS.setStanding('council', 26);
  assert.strictEqual(FS.getTier('council'), 'friendly');
  FS.setStanding('council', 50);
  assert.strictEqual(FS.getTier('council'), 'friendly');
  // Allied: > 50
  FS.setStanding('council', 51);
  assert.strictEqual(FS.getTier('council'), 'allied');
});

// --- 10. onChange fires + unsubscribe ------------------------------------

test('onChange fires on advance with (factionId, newValue, oldValue); unsubscribe stops further calls', () => {
  const { FS } = fresh();
  FS.init();
  const events = [];
  const unsub = FS.onChange((fid, nv, ov) => { events.push([fid, nv, ov]); });
  FS.adjustStanding('council', 10);  // 0 -> 10
  FS.adjustStanding('council', -5);  // 10 -> 5
  assert.deepStrictEqual(events, [['council', 10, 0], ['council', 5, 10]]);
  unsub();
  FS.adjustStanding('council', 1);
  assert.deepStrictEqual(events, [['council', 10, 0], ['council', 5, 10]]);
});

// --- 11. onChange swallows subscriber exceptions -------------------------

test('onChange swallows subscriber exceptions; remaining subscribers still fire', () => {
  const { FS } = fresh();
  FS.init();
  let calledA = 0;
  let calledB = 0;
  FS.onChange(() => { calledA += 1; throw new Error('boom'); });
  FS.onChange(() => { calledB += 1; });
  const origErr = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => FS.adjustStanding('council', 10));
  } finally {
    console.error = origErr;
  }
  assert.strictEqual(calledA, 1);
  assert.strictEqual(calledB, 1);
});

// --- 12. recursive subscriber does not deadlock --------------------------

test('recursive subscriber call: a subscriber that calls adjustStanding does not deadlock; the new mutation also fires', () => {
  const { FS } = fresh();
  FS.init();
  const events = [];
  let recursed = false;
  FS.onChange((fid, nv, ov) => {
    events.push([fid, nv, ov]);
    // Recurse exactly once: when council changes for the first time, also bump resistance.
    if (!recursed && fid === 'council') {
      recursed = true;
      FS.adjustStanding('resistance', 5);
    }
  });
  FS.adjustStanding('council', 10);
  // Both mutations fired exactly once: outer council, then queued resistance.
  assert.deepStrictEqual(events, [['council', 10, 0], ['resistance', 5, 0]]);
});

// --- 13. version > 1 discarded on init -----------------------------------

test('stored blob with version > 1 is discarded on init', () => {
  const { FS, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    standings: { council: 99, resistance: 99, independent: 99 }
  }));
  // Suppress the warn this is allowed to emit.
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    FS.init();
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(FS.getStanding('council'), 0, 'v2 blob discarded');
  assert.strictEqual(FS.getStanding('resistance'), 0);
});

// --- 14. missing faction key defaults to 0 -------------------------------

test('missing faction key in persisted blob defaults to 0 without throwing', () => {
  const { FS, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    standings: { council: 30 } // resistance + independent missing
  }));
  FS.init();
  assert.strictEqual(FS.getStanding('council'), 30);
  assert.strictEqual(FS.getStanding('resistance'), 0);
  assert.strictEqual(FS.getStanding('independent'), 0);
});

// --- 15. setStanding for save migration accepts out-of-range -------------

test('setStanding for save migration clamps out-of-range values without throwing', () => {
  const { FS } = fresh();
  FS.init();
  assert.doesNotThrow(() => FS.setStanding('council', 9999));
  assert.strictEqual(FS.getStanding('council'), 100);
  assert.doesNotThrow(() => FS.setStanding('resistance', -9999));
  assert.strictEqual(FS.getStanding('resistance'), -100);
});
