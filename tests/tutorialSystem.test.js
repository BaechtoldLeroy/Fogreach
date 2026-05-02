// Unit tests for js/tutorialSystem.js
//
// TutorialSystem is an IIFE that attaches to window. We load it once via the
// shared loader, then use its _configureForTest(primitives) entry to swap in
// stubbed storage / i18n / scheduler / persistence per test.
//
// Test seam contract (mirrors inputScheme.js / data-model.md / contracts/):
//   _configureForTest(p) replaces internal `primitives` and resets in-memory
//   state to a fresh, *uninitialized* form. Tests then call TS.init() to
//   trigger persistence load + i18n registration against the supplied stubs.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const STORAGE_KEY = 'demonfall_tutorial_v1';

function makePrimitives() {
  const _store = {};
  let _now = 0;
  const _timers = []; // { id, fireAt, cb }
  let _nextTimerId = 1;

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
    },
    now: () => _now,
    advanceClock: (ms) => {
      _now += ms;
      // Fire any timers whose fireAt is <= _now, in registration order.
      const due = [];
      for (let i = 0; i < _timers.length; i++) {
        if (_timers[i].fireAt <= _now) due.push(_timers[i]);
      }
      for (const t of due) {
        const idx = _timers.indexOf(t);
        if (idx >= 0) _timers.splice(idx, 1);
        try { t.cb(); } catch (_) { /* swallow */ }
      }
    },
    scheduler: {
      setTimeout: (cb, delay) => {
        const id = _nextTimerId++;
        _timers.push({ id, fireAt: _now + delay, cb });
        return id;
      },
      clearTimeout: (id) => {
        const idx = _timers.findIndex((t) => t.id === id);
        if (idx >= 0) _timers.splice(idx, 1);
      }
    },
    persistence: {
      hasSave: () => false  // override per test as needed
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
    loadGameModule('js/tutorialSystem.js');
    loaded = true;
  }
  return globalThis.window.TutorialSystem;
}

function fresh(overrides = {}) {
  const TS = ensureLoaded();
  const p = makePrimitives();
  Object.assign(p, overrides);
  TS._configureForTest(p);
  return { TS, p };
}

beforeEach(() => {
  resetStore();
});

// --- 1. init() idempotency + i18n registration ----------------------------

test('init() is idempotent and registers i18n exactly once per language', () => {
  const { TS, p } = fresh();
  TS.init();
  assert.strictEqual(p.i18n._calls.de, 1, 'de registered once');
  assert.strictEqual(p.i18n._calls.en, 1, 'en registered once');
  TS.init();
  TS.init();
  assert.strictEqual(p.i18n._calls.de, 1, 'de still registered exactly once after repeated init');
  assert.strictEqual(p.i18n._calls.en, 1, 'en still registered exactly once after repeated init');
});

// --- 2. maybeAutoSkip() with existing save ---------------------------------

test('maybeAutoSkip returns true and persists skipped:true when hasSave() is true', () => {
  const { TS, p } = fresh({ persistence: { hasSave: () => true } });
  TS.init();
  const result = TS.maybeAutoSkip();
  assert.strictEqual(result, true);
  assert.strictEqual(TS.isActive(), false);
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.skipped, true);
  assert.strictEqual(stored.active, false);
  assert.strictEqual(stored.version, 1);
});

// --- 3. maybeAutoSkip() with no save --------------------------------------

test('maybeAutoSkip seeds fresh state and advances to first visible step when no save exists', () => {
  const { TS, p } = fresh();
  TS.init();
  const result = TS.maybeAutoSkip();
  assert.strictEqual(result, false);
  assert.strictEqual(TS.isActive(), true);
  const step = TS.getCurrentStep();
  assert.ok(step, 'a step descriptor exists');
  assert.strictEqual(step.id, 'movement', 'first visible step is `movement` (step 2)');
  // Persisted blob reflects the same.
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.currentStepId, 'movement');
  assert.strictEqual(stored.active, true);
  assert.strictEqual(stored.skipped, false);
});

// --- 4. report() no-op when inactive --------------------------------------

test('report() is a no-op when inactive', () => {
  const { TS } = fresh();
  TS.init();
  // Before maybeAutoSkip, the system is inactive.
  assert.strictEqual(TS.isActive(), false);
  let fires = 0;
  TS.onChange(() => { fires += 1; });
  TS.report('player.moved', { dx: 1, dy: 0 });
  assert.strictEqual(fires, 0);
  assert.strictEqual(TS.isActive(), false);
});

// --- 5. report() no-op when event name does not match ---------------------

test('report() is a no-op when event name does not match current step', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip(); // active at step `movement`
  let fires = 0;
  TS.onChange(() => { fires += 1; });
  TS.report('combat.hit', { byPlayer: true }); // wrong event for `movement`
  assert.strictEqual(fires, 0);
  assert.strictEqual(TS.getCurrentStep().id, 'movement');
});

// --- 6. report() advances when event matches and matcher passes -----------

test('report() advances when event matches and matcher passes', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip(); // step `movement`
  TS.report('player.moved', { dx: 1, dy: 0 });
  assert.strictEqual(TS.getCurrentStep().id, 'forge.approach');
  TS.report('hub.entrance.approached', { name: 'Werkstatt' });
  assert.strictEqual(TS.getCurrentStep().id, 'forge.dialog');
});

// --- 7. report() does not advance when matcher returns false --------------

test('report() does not advance when matcher returns false', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  TS.report('player.moved', {}); // advance to forge.approach
  assert.strictEqual(TS.getCurrentStep().id, 'forge.approach');
  // forge.approach matcher requires name === 'Werkstatt'
  TS.report('hub.entrance.approached', { name: 'Rathauskeller' });
  assert.strictEqual(TS.getCurrentStep().id, 'forge.approach', 'wrong target name does not advance');
});

// --- 8. step 11 auto-dismiss via injected scheduler -----------------------

test('step 11 auto-dismisses after 5000 ms via the injected scheduler', () => {
  const { TS, p } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  // Force-walk to step 11 (`save.notice`) without going through every event.
  // Use the public report() with the proper events for each step in order.
  TS.report('player.moved', { dx: 1, dy: 0 });                                  // -> forge.approach
  TS.report('hub.entrance.approached', { name: 'Werkstatt' });                  // -> forge.dialog
  TS.report('dialog.closed', { npc: 'Branka' });                                // -> keller.approach
  TS.report('hub.entrance.approached', { name: 'Rathauskeller' });              // -> keller.enter
  TS.report('hub.entrance.entered', { name: 'Rathauskeller' });                 // -> combat.basics
  TS.report('combat.hit', { byPlayer: true });                                  // -> combat.ability
  TS.report('combat.ability.used', { slot: 1 });                                // -> loot.pickup
  TS.report('loot.picked', { itemId: 'x' });                                    // -> loot.equip
  TS.report('inventory.equipped', { slot: 'mainhand' });                        // -> save.notice
  assert.strictEqual(TS.getCurrentStep().id, 'save.notice');
  // Auto-dismiss must NOT have fired yet.
  p.advanceClock(4999);
  assert.strictEqual(TS.getCurrentStep().id, 'save.notice');
  // After the configured 5000 ms total, the system advances to step 12.
  p.advanceClock(1);
  assert.strictEqual(TS.getCurrentStep().id, 'druckerei.visit');
});

// --- 9. skip(true) deactivates; skip(false) is a no-op --------------------

test('skip(true) deactivates and persists; skip(false) is a no-op', () => {
  const { TS, p } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  assert.strictEqual(TS.isActive(), true);
  // skip(false) does nothing.
  assert.strictEqual(TS.skip(false), false);
  assert.strictEqual(TS.isActive(), true);
  // skip(true) deactivates and persists.
  assert.strictEqual(TS.skip(true), true);
  assert.strictEqual(TS.isActive(), false);
  assert.strictEqual(TS.getCurrentStep(), null);
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.active, false);
  assert.strictEqual(stored.skipped, true);
});

// --- 10. replay() resets and does not touch unrelated keys ----------------

test('replay() resets state and does not touch unrelated localStorage keys', () => {
  const { TS, p } = fresh();
  // Pre-seed an unrelated key — must survive replay.
  p.storage.setItem('demonfall_save_v1', 'sentinel');
  TS.init();
  // Skip the tutorial first so we can prove replay re-activates.
  TS.maybeAutoSkip();
  TS.skip(true);
  assert.strictEqual(TS.isActive(), false);
  // Replay re-activates at the first visible step.
  TS.replay();
  assert.strictEqual(TS.isActive(), true);
  assert.strictEqual(TS.getCurrentStep().id, 'movement');
  // The unrelated save key must be untouched.
  assert.strictEqual(p.storage.getItem('demonfall_save_v1'), 'sentinel');
});

// --- 11. onChange fires + unsubscribe -------------------------------------

test('onChange fires on advance, skip, and replay; unsubscribe stops further calls', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  const events = [];
  const unsub = TS.onChange((step) => { events.push(step ? step.id : null); });
  // Advance once.
  TS.report('player.moved', { dx: 1, dy: 0 });
  // Skip.
  TS.skip(true);
  // Replay.
  TS.replay();
  assert.deepStrictEqual(events, ['forge.approach', null, 'movement']);
  // After unsub, further state changes do not fire the callback.
  unsub();
  TS.report('player.moved', { dx: 1, dy: 0 });
  assert.deepStrictEqual(events, ['forge.approach', null, 'movement']);
});

// --- 12. onChange swallows subscriber exceptions --------------------------

test('onChange swallows subscriber exceptions; remaining subscribers still fire', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  let calledA = 0;
  let calledB = 0;
  TS.onChange(() => { calledA += 1; throw new Error('boom'); });
  TS.onChange(() => { calledB += 1; });
  // Suppress noisy stderr from the swallowed-exception logger.
  const origErr = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => TS.report('player.moved', { dx: 1, dy: 0 }));
  } finally {
    console.error = origErr;
  }
  assert.strictEqual(calledA, 1);
  assert.strictEqual(calledB, 1);
});

// --- 13. out-of-order report() is dropped ---------------------------------

test('out-of-order report() (e.g., loot.picked during step 7) is dropped', () => {
  const { TS } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  // Walk to step 7 (`combat.basics`).
  TS.report('player.moved', {});                                                // -> forge.approach
  TS.report('hub.entrance.approached', { name: 'Werkstatt' });                  // -> forge.dialog
  TS.report('dialog.closed', { npc: 'Branka' });                                // -> keller.approach
  TS.report('hub.entrance.approached', { name: 'Rathauskeller' });              // -> keller.enter
  TS.report('hub.entrance.entered', { name: 'Rathauskeller' });                 // -> combat.basics
  assert.strictEqual(TS.getCurrentStep().id, 'combat.basics');
  // loot.picked is the trigger for step 9, not 7. Should be dropped.
  TS.report('loot.picked', { itemId: 'sword' });
  assert.strictEqual(TS.getCurrentStep().id, 'combat.basics', 'out-of-order event ignored');
  // Now legitimately advance.
  TS.report('combat.hit', { byPlayer: true });
  assert.strictEqual(TS.getCurrentStep().id, 'combat.ability');
});

// --- 14. stored blob with version > 1 is discarded ------------------------

test('stored blob with version > 1 is discarded on init', () => {
  const { TS, p } = fresh();
  // Pre-seed an incompatible blob.
  p.storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    active: true,
    currentStepId: 'forge.dialog',
    skipped: false,
    completedSteps: ['init', 'movement', 'forge.approach']
  }));
  TS.init();
  // Discarded → system starts uninitialized; isActive should be false until
  // maybeAutoSkip runs. Either way, we must NOT carry over the v2 step.
  assert.notStrictEqual(TS.getCurrentStep() && TS.getCurrentStep().id, 'forge.dialog',
    'v2 blob did not bleed into v1 in-memory state');
});

// --- 15. final advance past last step completes the tutorial --------------

test('final advance past last step sets active:false, currentStepId:null and fires onChange(null)', () => {
  const { TS, p } = fresh();
  TS.init();
  TS.maybeAutoSkip();
  // Walk all the way to step 12 (`druckerei.visit`).
  TS.report('player.moved', {});
  TS.report('hub.entrance.approached', { name: 'Werkstatt' });
  TS.report('dialog.closed', { npc: 'Branka' });
  TS.report('hub.entrance.approached', { name: 'Rathauskeller' });
  TS.report('hub.entrance.entered', { name: 'Rathauskeller' });
  TS.report('combat.hit', { byPlayer: true });
  TS.report('combat.ability.used', { slot: 1 });
  TS.report('loot.picked', { itemId: 'x' });
  TS.report('inventory.equipped', { slot: 'mainhand' });
  // Auto-dismiss step 11.
  p.advanceClock(5000);
  assert.strictEqual(TS.getCurrentStep().id, 'druckerei.visit');
  // Final report — Setzer Thom dialog closes.
  let lastEvent = 'sentinel';
  TS.onChange((step) => { lastEvent = step; });
  TS.report('dialog.closed', { npc: 'Setzer Thom' });
  assert.strictEqual(TS.isActive(), false);
  assert.strictEqual(TS.getCurrentStep(), null);
  assert.strictEqual(lastEvent, null, 'onChange fired with null on completion');
  // Persisted state reflects completion.
  const stored = JSON.parse(p.storage.getItem(STORAGE_KEY));
  assert.strictEqual(stored.active, false);
  assert.strictEqual(stored.currentStepId, null);
});
