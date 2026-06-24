// Unit tests for Feature 058 (#41) — run-based depth progression.
//
// Core invariants live in the unit-loadable module js/runDepth.js
// (window.RunDepth) + js/persistence.js (getMaxDepth/bumpMaxDepth). The Phaser
// hooks (roomManager.js / main.js) just call into them.
//
// WP01 = test-first: this file is RED until WP02 (run-constant depth) + WP03
// (run-completion +1) land the implementation.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

const MAX_DEPTH_KEY = 'demonfall_maxDepth';

function fresh() {
  resetStore();
  delete globalThis.window.Persistence;
  delete globalThis.window.RunDepth;
  loadGameModule('js/persistence.js');
  // runDepth.js may not exist yet in WP01 (red). Load defensively so the file
  // fails via assertion, not a module-resolution crash.
  try { loadGameModule('js/runDepth.js'); } catch (e) { /* not implemented yet */ }
  return { P: globalThis.window.Persistence, RD: globalThis.window.RunDepth };
}

function setMaxDepth(n) {
  globalThis.window.localStorage.setItem(MAX_DEPTH_KEY, String(n));
}

// --- (a) Tiefe bleibt run-konstant über Räume (FR-01, SC-01) ---

test('#41 (a) nextRoomDepth keeps the run-start depth constant across rooms', () => {
  const { RD } = fresh();
  assert.ok(RD && typeof RD.nextRoomDepth === 'function', 'RunDepth.nextRoomDepth exists');
  // No per-room +1: entering room after room within a run keeps the same depth.
  let depth = 7;
  for (let room = 0; room < 6; room++) {
    depth = RD.nextRoomDepth(depth);
  }
  assert.strictEqual(depth, 7, 'depth never climbs per room within a run');
});

// --- (b) dungeon_complete → MAX_DEPTH += 1 (FR-02) ---

test('#41 (b) a completed run bumps MAX_DEPTH by exactly 1', () => {
  const { P, RD } = fresh();
  assert.ok(RD && typeof RD.tryCompleteRun === 'function', 'RunDepth.tryCompleteRun exists');
  assert.ok(P && typeof P.getMaxDepth === 'function', 'Persistence.getMaxDepth exists');
  setMaxDepth(7);
  RD.markRunStarted();
  const after = RD.tryCompleteRun('dungeon_complete');
  assert.strictEqual(after, 8, 'returns the new depth');
  assert.strictEqual(P.getMaxDepth(), 8, 'persisted +1');
});

// --- (c) death / portal → kein Bump (FR-02, D1) ---

test('#41 (c) death and portal do NOT bump MAX_DEPTH', () => {
  const { P, RD } = fresh();
  assert.ok(RD && typeof RD.tryCompleteRun === 'function');
  setMaxDepth(7);
  RD.markRunStarted();
  assert.strictEqual(RD.tryCompleteRun('death'), null, 'death does not complete');
  assert.strictEqual(RD.tryCompleteRun('portal'), null, 'portal does not complete');
  assert.strictEqual(P.getMaxDepth(), 7, 'MAX_DEPTH untouched');
});

// --- (d) Idempotenz: Doppel-Aufruf → nur +1 (FR-02, R-02) ---

test('#41 (d) a double dungeon_complete only bumps once (idempotent)', () => {
  const { P, RD } = fresh();
  assert.ok(RD && typeof RD.tryCompleteRun === 'function');
  setMaxDepth(7);
  RD.markRunStarted();
  RD.tryCompleteRun('dungeon_complete');
  RD.tryCompleteRun('dungeon_complete'); // e.g. death-cleanup + complete in one teardown
  assert.strictEqual(P.getMaxDepth(), 8, 'only one increment per run');
});

test('#41 (d) markRunStarted re-arms the latch for the NEXT run', () => {
  const { P, RD } = fresh();
  assert.ok(RD && typeof RD.tryCompleteRun === 'function');
  setMaxDepth(7);
  RD.markRunStarted();
  RD.tryCompleteRun('dungeon_complete'); // -> 8
  RD.markRunStarted();                   // new run
  RD.tryCompleteRun('dungeon_complete'); // -> 9
  assert.strictEqual(P.getMaxDepth(), 9, 'each completed run adds exactly 1');
});

test('#41 isCompletionReason only true for dungeon_complete (D1)', () => {
  const { RD } = fresh();
  assert.ok(RD && typeof RD.isCompletionReason === 'function');
  assert.strictEqual(RD.isCompletionReason('dungeon_complete'), true);
  for (const r of ['death', 'portal', '', null, undefined, 'complete']) {
    assert.strictEqual(RD.isCompletionReason(r), false, 'not a completion: ' + r);
  }
});
