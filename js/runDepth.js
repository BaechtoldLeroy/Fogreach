// js/runDepth.js
// Feature 058 (#41): run-based depth progression. Depth is RUN-CONSTANT within
// a run (no more +1 per room) and grows by +1 only when a run is COMPLETED
// (reason 'dungeon_complete', decision D1). Unit-loadable (window.RunDepth) so
// the invariants are testable; the Phaser hooks (roomManager.js / main.js) just
// call into it. No-op-safe whenever Persistence is unavailable.
(function () {
  'use strict';

  // Run-scoped idempotency latch: one run may call leaveDungeonForHub more than
  // once (e.g. death-cleanup + complete during a single teardown). markRun-
  // Started() re-arms it at run start so each completed run counts exactly once.
  var _completedThisRun = false;

  // D1: only a fully cleared run ('dungeon_complete') advances the depth. Death
  // and voluntary portal-leave do NOT count.
  function isCompletionReason(reason) {
    return reason === 'dungeon_complete';
  }

  // FR-01 / SC-01: within a run the depth never climbs per room — entering the
  // next room keeps the run-start depth. This is the (now identity) per-room
  // rule that roomManager.onStairOverlap consults. Endless mode drives its own
  // depth and does NOT call this.
  function nextRoomDepth(runStartDepth) {
    return Math.max(1, Math.round(Number(runStartDepth) || 1));
  }

  // Call at run start (roomManager.initDungeonRun) to re-arm the latch.
  function markRunStarted() {
    _completedThisRun = false;
  }

  // FR-02: bump MAX_DEPTH by exactly 1 on the first completion of a run.
  // Idempotent via the run latch. Returns the new max depth, or null when the
  // run does not complete (wrong reason / already counted / persistence absent).
  function tryCompleteRun(reason) {
    if (!isCompletionReason(reason)) return null;
    if (_completedThisRun) return null;
    _completedThisRun = true;
    if (typeof window !== 'undefined' && window.Persistence
        && typeof window.Persistence.bumpMaxDepth === 'function') {
      return window.Persistence.bumpMaxDepth();
    }
    return null; // persistence wiring lands in WP03
  }

  function _resetForTest() { _completedThisRun = false; }

  window.RunDepth = {
    isCompletionReason: isCompletionReason,
    nextRoomDepth: nextRoomDepth,
    markRunStarted: markRunStarted,
    tryCompleteRun: tryCompleteRun,
    _resetForTest: _resetForTest
  };
})();
