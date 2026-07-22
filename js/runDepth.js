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

  // Variante C: Kettenmeister-Tiefensperre. Die Tiefengrenze (MAX_DEPTH) darf 9
  // NICHT ueberschreiten, solange die Quest, die zum Kettenmeister (Boss auf
  // Tiefe 10) fuehrt, nicht angenommen (aktiv) ODER bereits abgeschlossen ist.
  // Der Boss spawnt nur in einem Run auf Tiefe 10 (currentWave % 10, wave.js),
  // und die Run-Tiefe ist <= MAX_DEPTH — also ist der 9->10-Bump der exakte
  // Sperrpunkt. So ist die ERSTE Begegnung mit dem Boss immer die inszenierte,
  // quest-getriebene, statt eines zufaelligen Grind-Runs vor der Story.
  var KETTENMEISTER_GATE_DEPTH = 9;
  var KETTENMEISTER_QUEST_ID = 'mara_warning';

  // Gate offen, wenn die fuehrende Quest aktiv ODER abgeschlossen ist. DOM-frei
  // ueber window.questSystem; fehlt es, ist das Gate ZU (kein Bump ueber 9).
  function _defaultGateOpen() {
    if (typeof window === 'undefined' || !window.questSystem) return false;
    var qs = window.questSystem;
    try {
      var hasQuest = function (getter) {
        if (typeof getter !== 'function') return false;
        var list = getter.call(qs);
        return Array.isArray(list) && list.some(function (q) {
          return q && q.id === KETTENMEISTER_QUEST_ID;
        });
      };
      return hasQuest(qs.getActiveQuests) || hasQuest(qs.getCompletedQuests);
    } catch (e) { return false; }
  }

  // Injizierbar fuer Tests (sonst muesste jeder Test window.questSystem stellen).
  var _gateOpen = _defaultGateOpen;

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
      // Kettenmeister-Gate: der Bump von 9 -> 10 (Tiefe des Bosses) bleibt
      // gesperrt, solange die fuehrende Quest nicht aktiv/abgeschlossen ist.
      // Nur exakt auf 9 pruefen: bereits tiefere Staende (Alt-Saves, oder nachdem
      // das Gate einmal offen war) werden NICHT rueckwirkend zurueckgehalten.
      if (typeof window.Persistence.getMaxDepth === 'function'
          && window.Persistence.getMaxDepth() === KETTENMEISTER_GATE_DEPTH
          && !_gateOpen()) {
        return null; // Tiefe 10 erst mit angenommener Kettenmeister-Quest
      }
      return window.Persistence.bumpMaxDepth();
    }
    return null; // persistence wiring lands in WP03
  }

  function _resetForTest() { _completedThisRun = false; _gateOpen = _defaultGateOpen; }
  // Test-Hook: Gate-Funktion injizieren (undefined -> Default = questSystem lesen).
  function _setGateForTest(fn) { _gateOpen = (typeof fn === 'function') ? fn : _defaultGateOpen; }

  window.RunDepth = {
    isCompletionReason: isCompletionReason,
    nextRoomDepth: nextRoomDepth,
    markRunStarted: markRunStarted,
    tryCompleteRun: tryCompleteRun,
    // Fuer UI/Hinweise (z. B. Hinabstiegs-Dialog): ist die Tiefe-10-Sperre offen?
    isKettenmeisterGateOpen: function () { return _gateOpen(); },
    KETTENMEISTER_GATE_DEPTH: KETTENMEISTER_GATE_DEPTH,
    _resetForTest: _resetForTest,
    _setGateForTest: _setGateForTest
  };
})();
