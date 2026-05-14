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
    standings: { magistrat:42, widerstand:-17, independent: 5 }
  }));
  FS.init();
  assert.strictEqual(FS.getStanding('magistrat'), 42);
  assert.strictEqual(FS.getStanding('widerstand'), -17);
  assert.strictEqual(FS.getStanding('independent'), 5);
});

// --- 4. adjustStanding clamps to +100 ------------------------------------

test('adjustStanding clamps to +100 max', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('magistrat', 80);
  const newVal = FS.adjustStanding('magistrat', 50);
  assert.strictEqual(newVal, 100);
  assert.strictEqual(FS.getStanding('magistrat'), 100);
});

// --- 5. adjustStanding clamps to -100 ------------------------------------

test('adjustStanding clamps to -100 min', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('widerstand', -80);
  const newVal = FS.adjustStanding('widerstand', -50);
  assert.strictEqual(newVal, -100);
  assert.strictEqual(FS.getStanding('widerstand'), -100);
});

// --- 6. delta=0 is a no-op + does NOT notify -----------------------------

test('adjustStanding with delta=0 returns current value and does NOT fire subscribers', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('magistrat', 10);
  let fires = 0;
  FS.onChange(() => { fires += 1; });
  const ret = FS.adjustStanding('magistrat', 0);
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
  const v1 = FS.setStanding('magistrat', 200); // clamp to 100
  assert.strictEqual(v1, 100);
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.standings.magistrat, 100);
  // setStanding to same value should not notify.
  let fires = 0;
  FS.onChange(() => { fires += 1; });
  FS.setStanding('magistrat', 100);
  assert.strictEqual(fires, 0);
});

// --- 9. getTier returns correct boundary values --------------------------

test('getTier returns correct tier for boundary values', () => {
  const { FS } = fresh();
  FS.init();
  // Hostile: < -25
  FS.setStanding('magistrat', -26);
  assert.strictEqual(FS.getTier('magistrat'), 'hostile');
  // Neutral upper boundary
  FS.setStanding('magistrat', -25);
  assert.strictEqual(FS.getTier('magistrat'), 'neutral');
  FS.setStanding('magistrat', 25);
  assert.strictEqual(FS.getTier('magistrat'), 'neutral');
  // Friendly: > 25
  FS.setStanding('magistrat', 26);
  assert.strictEqual(FS.getTier('magistrat'), 'friendly');
  FS.setStanding('magistrat', 50);
  assert.strictEqual(FS.getTier('magistrat'), 'friendly');
  // Allied: > 50
  FS.setStanding('magistrat', 51);
  assert.strictEqual(FS.getTier('magistrat'), 'allied');
});

// --- 10. onChange fires + unsubscribe ------------------------------------

test('onChange fires on advance with (factionId, newValue, oldValue); unsubscribe stops further calls', () => {
  const { FS } = fresh();
  FS.init();
  const events = [];
  const unsub = FS.onChange((fid, nv, ov) => { events.push([fid, nv, ov]); });
  FS.adjustStanding('magistrat', 10);  // 0 -> 10
  FS.adjustStanding('magistrat', -5);  // 10 -> 5
  assert.deepStrictEqual(events, [['magistrat', 10, 0], ['magistrat', 5, 10]]);
  unsub();
  FS.adjustStanding('magistrat', 1);
  assert.deepStrictEqual(events, [['magistrat', 10, 0], ['magistrat', 5, 10]]);
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
    assert.doesNotThrow(() => FS.adjustStanding('magistrat', 10));
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
    if (!recursed && fid === 'magistrat') {
      recursed = true;
      FS.adjustStanding('widerstand', 5);
    }
  });
  FS.adjustStanding('magistrat', 10);
  // Both mutations fired exactly once: outer council, then queued resistance.
  assert.deepStrictEqual(events, [['magistrat', 10, 0], ['widerstand', 5, 0]]);
});

// --- 13. version > 1 discarded on init -----------------------------------

test('stored blob with version > 1 is discarded on init', () => {
  const { FS, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    standings: { magistrat:99, widerstand:99, independent: 99 }
  }));
  // Suppress the warn this is allowed to emit.
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    FS.init();
  } finally {
    console.warn = origWarn;
  }
  assert.strictEqual(FS.getStanding('magistrat'), 0, 'v2 blob discarded');
  assert.strictEqual(FS.getStanding('widerstand'), 0);
});

// --- 14. missing faction key defaults to 0 -------------------------------

test('missing faction key in persisted blob defaults to 0 without throwing', () => {
  const { FS, p } = fresh();
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    standings: { magistrat:30 } // resistance + independent missing
  }));
  FS.init();
  assert.strictEqual(FS.getStanding('magistrat'), 30);
  assert.strictEqual(FS.getStanding('widerstand'), 0);
  assert.strictEqual(FS.getStanding('independent'), 0);
});

// --- 15. setStanding for save migration accepts out-of-range -------------

test('setStanding for save migration clamps out-of-range values without throwing', () => {
  const { FS } = fresh();
  FS.init();
  assert.doesNotThrow(() => FS.setStanding('magistrat', 9999));
  assert.strictEqual(FS.getStanding('magistrat'), 100);
  assert.doesNotThrow(() => FS.setStanding('widerstand', -9999));
  assert.strictEqual(FS.getStanding('widerstand'), -100);
});

// =========================================================================
// Feature 050 — factionSystem 3→5 refactor + getCouncilComposite() helper
// =========================================================================

// --- 16. all 5 standings default to 0 on fresh init ----------------------

test('feature 050: fresh init has all 5 standings at 0', () => {
  const { FS } = fresh();
  FS.init();
  assert.strictEqual(FS.getStanding('magistrat'), 0);
  assert.strictEqual(FS.getStanding('klerus'), 0);
  assert.strictEqual(FS.getStanding('garde'), 0);
  assert.strictEqual(FS.getStanding('widerstand'), 0);
  assert.strictEqual(FS.getStanding('independent'), 0);
});

// --- 17. each new Council-internal faction adjusts independently ---------

test('feature 050: klerus and garde standings adjust independently of magistrat', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('magistrat', 5);
  FS.adjustStanding('klerus', 7);
  FS.adjustStanding('garde', 3);
  assert.strictEqual(FS.getStanding('magistrat'), 5);
  assert.strictEqual(FS.getStanding('klerus'), 7);
  assert.strictEqual(FS.getStanding('garde'), 3);
  // Cross-check: bumping one does NOT bleed into the others
  FS.adjustStanding('klerus', 10);
  assert.strictEqual(FS.getStanding('magistrat'), 5, 'magistrat unaffected by klerus bump');
  assert.strictEqual(FS.getStanding('garde'), 3, 'garde unaffected by klerus bump');
});

// --- 18. getCouncilComposite returns 0 when no Council standing > 0 ------

test('feature 050: getCouncilComposite() returns 0 on fresh init', () => {
  const { FS } = fresh();
  FS.init();
  assert.strictEqual(FS.getCouncilComposite(), 0);
});

// --- 19. getCouncilComposite returns max of magistrat/klerus/garde -------

test('feature 050: getCouncilComposite() returns max of the 3 Council-internal standings', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('magistrat', 3);
  assert.strictEqual(FS.getCouncilComposite(), 3, 'magistrat alone');
  FS.adjustStanding('klerus', 7);
  assert.strictEqual(FS.getCouncilComposite(), 7, 'klerus overtakes magistrat');
  FS.adjustStanding('garde', 1);
  assert.strictEqual(FS.getCouncilComposite(), 7, 'garde does not lower the max');
  FS.adjustStanding('magistrat', 100); // clamps to 100
  assert.strictEqual(FS.getCouncilComposite(), 100, 'magistrat now leads');
});

// --- 20. getCouncilComposite ignores widerstand + independent ------------

test('feature 050: getCouncilComposite() ignores widerstand + independent standings', () => {
  const { FS } = fresh();
  FS.init();
  FS.adjustStanding('widerstand', 50);
  FS.adjustStanding('independent', 30);
  assert.strictEqual(FS.getCouncilComposite(), 0, 'only Council-internal factions count');
  FS.adjustStanding('magistrat', 5);
  assert.strictEqual(FS.getCouncilComposite(), 5);
});

// --- 21. legacy 'council' ID returns 0 + warns once -----------------------

test('feature 050: legacy getStanding("council") returns 0 silently', () => {
  // getStanding for unknown faction is silent (NOT warn-once) — that's
  // adjustStanding's behavior. This test pins the silent-zero contract for
  // legacy callers that still try the old name.
  const { FS } = fresh();
  FS.init();
  assert.strictEqual(FS.getStanding('council'), 0);
  assert.strictEqual(FS.getStanding('resistance'), 0);
});

// --- 22. legacy 'council' ID via adjustStanding warns once ----------------

test('feature 050: legacy adjustStanding("council") warns once and is a no-op', () => {
  const { FS } = fresh();
  FS.init();
  const origWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount += 1; };
  try {
    FS.adjustStanding('council', 50);    // legacy ID — warn once
    FS.adjustStanding('resistance', 50); // legacy ID — warn once
    FS.adjustStanding('council', 50);    // second legacy call, no extra warn
  } finally {
    console.warn = origWarn;
  }
  // 2 distinct legacy IDs each warn once = 2 warns total
  assert.strictEqual(warnCount, 2);
  // And of course the legacy IDs didn't accidentally write anything
  assert.strictEqual(FS.getStanding('council'), 0);
  assert.strictEqual(FS.getStanding('resistance'), 0);
});
