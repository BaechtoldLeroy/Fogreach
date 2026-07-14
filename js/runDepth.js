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
  //
  // Frontier-Gate: `startDepth` ist die Tiefe, auf der der Run STARTETE. Nur ein
  // Run, der AN der aktuellen Tiefengrenze beginnt (startDepth >= maxDepth), hebt
  // die Grenze. Ein Wiederholungs-Run auf bereits freigeschalteter, geringerer
  // Tiefe (z. B. maxDepth-5, etwa um einen Boss zu farmen) zählt NICHT -> maxDepth
  // bleibt gleich. `startDepth` weggelassen -> Alt-Verhalten (bump), damit
  // bestehende Aufrufer/Tests ohne Tiefe unverändert +1 bekommen.
  function tryCompleteRun(reason, startDepth) {
    if (!isCompletionReason(reason)) return null;
    if (_completedThisRun) return null;
    _completedThisRun = true;
    if (typeof window !== 'undefined' && window.Persistence
        && typeof window.Persistence.bumpMaxDepth === 'function') {
      if (typeof startDepth === 'number'
          && typeof window.Persistence.getMaxDepth === 'function'
          && startDepth < window.Persistence.getMaxDepth()) {
        return null; // Wiederholung unterhalb der Grenze -> keine Progression
      }
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
