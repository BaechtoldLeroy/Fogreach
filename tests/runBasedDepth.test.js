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
  // persistence.js reads the bare `localStorage` global (setup.js stub).
  globalThis.localStorage.setItem(MAX_DEPTH_KEY, String(n));
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

// --- WP04: ceiling floor + off-by-one (fresh save) ---

test('#41 WP04: getMaxDepth floors at 1 for a fresh save (depth 1 always attemptable)', () => {
  const { P } = fresh();
  assert.strictEqual(P.getMaxDepth(), 1, 'no MAX_DEPTH key yet -> ceiling 1');
});

test('#41 WP04: completing the first (depth-1) run lifts the ceiling to 2 (clear N -> unlock N+1)', () => {
  const { P, RD } = fresh();
  // Fresh save: nothing persisted. Ceiling is 1, the player runs depth 1.
  RD.markRunStarted();
  const after = RD.tryCompleteRun('dungeon_complete');
  assert.strictEqual(after, 2, 'first completion unlocks depth 2');
  assert.strictEqual(P.getMaxDepth(), 2);
});

// --- WP05: save-compat (FR-09 / C-03) ---

test('#41 WP05: an old save with a high MAX_DEPTH is respected, never reset', () => {
  const { P, RD } = fresh();
  setMaxDepth(25); // legacy save reached depth 25 under the old per-room system
  assert.strictEqual(P.getMaxDepth(), 25, 'high ceiling preserved on load');
  // The feature only changes GROWTH, not the existing ceiling: it can still
  // grow, but never regresses.
  RD.markRunStarted();
  assert.strictEqual(RD.tryCompleteRun('dungeon_complete'), 26, 'grows from the existing ceiling');
  assert.strictEqual(P.getMaxDepth(), 26);
});

test('#41 WP05: death/portal on a high-ceiling save never lower MAX_DEPTH', () => {
  const { P, RD } = fresh();
  setMaxDepth(25);
  RD.markRunStarted();
  RD.tryCompleteRun('death');
  RD.tryCompleteRun('portal');
  assert.strictEqual(P.getMaxDepth(), 25, 'a failed/abandoned run leaves the ceiling intact');
});

// --- Frontier-Gate: Wiederholung geringerer Tiefe progressed maxDepth NICHT ---

test('#41 frontier: completing a run BELOW the ceiling does NOT bump maxDepth', () => {
  const { P, RD } = fresh();
  setMaxDepth(10);
  RD.markRunStarted();
  const after = RD.tryCompleteRun('dungeon_complete', 5); // replay depth 5 < ceiling 10
  assert.strictEqual(after, null, 'shallow replay returns null');
  assert.strictEqual(P.getMaxDepth(), 10, 'ceiling unchanged on a shallow replay');
});

test('#41 frontier: completing a run AT the ceiling bumps maxDepth by 1', () => {
  const { P, RD } = fresh();
  setMaxDepth(10);
  RD.markRunStarted();
  const after = RD.tryCompleteRun('dungeon_complete', 10); // frontier run (startDepth == ceiling)
  assert.strictEqual(after, 11, 'frontier run advances the ceiling');
  assert.strictEqual(P.getMaxDepth(), 11);
});

test('#41 frontier: omitting startDepth keeps legacy behavior (bumps)', () => {
  const { P, RD } = fresh();
  setMaxDepth(10);
  RD.markRunStarted();
  const after = RD.tryCompleteRun('dungeon_complete'); // no depth arg -> legacy bump
  assert.strictEqual(after, 11, 'legacy call without depth still bumps');
  assert.strictEqual(P.getMaxDepth(), 11);
});
