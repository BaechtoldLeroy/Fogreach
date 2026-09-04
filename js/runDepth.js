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

  /**
   * Alle Boss-Tore (#131).
   *
   * Es gab genau EINS — vor dem Kettenmeister auf Tiefe 10. Der Gedanke
   * dahinter stimmte, aber er wurde nie auf die anderen beiden Bosse
   * uebertragen, und daran ist ein ganzer Durchgang gescheitert:
   *
   * Bosse erscheinen nur alle zehn Tiefen, und welcher kommt, entscheidet
   * (floor(Tiefe/10) - 1) % 3. Der Zeremonienmeister steht damit auf Tiefe 20
   * und dann erst wieder auf 50. onBossKilled zaehlt nur fuer AKTIVE Quests —
   * wer Tiefe 20 raeumte, ohne 'Die Ritualkammer' angenommen zu haben, verlor
   * den Fortschritt fuer dreissig Tiefen. Und mit ihm den Weg nach Akt 5, denn
   * bruch_confrontation haengt ueber elara_second_truth daran.
   *
   * Jetzt bleibt die Tiefe eine Stufe VOR jedem Story-Boss stehen, bis sein
   * Auftrag laeuft. Die erste Begegnung ist damit immer die inszenierte.
   */
  var BOSS_TORE = [
    { tiefe: 9,  questId: 'mara_warning',       titel: 'Maras Warnung' },
    { tiefe: 19, questId: 'elara_ritual',       titel: 'Die Ritualkammer' },
    { tiefe: 29, questId: 'schattenrat_finale', titel: 'Der Schattenrat' }
  ];

  /** Laeuft (oder lief) diese Quest schon? */
  function _questBekannt(questId) {
    if (typeof window === 'undefined' || !window.questSystem) return false;
    var qs = window.questSystem;
    try {
      var hasQuest = function (getter) {
        if (typeof getter !== 'function') return false;
        var list = getter.call(qs);
        return Array.isArray(list) && list.some(function (q) {
          return q && q.id === questId;
        });
      };
      return hasQuest(qs.getActiveQuests) || hasQuest(qs.getCompletedQuests);
    } catch (e) { return false; }
  }

  /**
   * Welches Tor haelt gerade? null = keins.
   *
   * Nur EXAKT auf der Torstufe geprueft: wer schon tiefer steht (Altstand oder
   * weil das Tor einmal offen war) wird nicht rueckwirkend zurueckgehalten.
   */
  function _torBei(tiefe) {
    for (var i = 0; i < BOSS_TORE.length; i++) {
      if (BOSS_TORE[i].tiefe !== tiefe) continue;
      return _questBekannt(BOSS_TORE[i].questId) ? null : BOSS_TORE[i];
    }
    return null;
  }

  // Gate offen, wenn die fuehrende Quest aktiv ODER abgeschlossen ist. DOM-frei
  // ueber window.questSystem; fehlt es, ist das Gate ZU (kein Bump ueber 9).
  function _defaultGateOpen() {
    return _questBekannt(KETTENMEISTER_QUEST_ID);
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
      // Boss-Tore: der Bump auf eine Boss-Tiefe bleibt gesperrt, solange der
      // zugehoerige Auftrag nicht laeuft. Nur exakt auf der Torstufe pruefen —
      // wer schon tiefer steht, wird nicht rueckwirkend zurueckgehalten.
      if (typeof window.Persistence.getMaxDepth === 'function') {
        var _jetzt = window.Persistence.getMaxDepth();
        // Das Kettenmeister-Tor bleibt ueber _gateOpen ansprechbar, damit die
        // vorhandene Test-Injektion (_setGateForTest) weiter greift.
        if (_jetzt === KETTENMEISTER_GATE_DEPTH && !_gateOpen()) {
          return null;
        }
        if (_jetzt !== KETTENMEISTER_GATE_DEPTH && _torBei(_jetzt)) {
          return null;
        }
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
    // #131: alle Boss-Tore, fuer UI-Hinweise und Verifikation.
    BOSS_TORE: BOSS_TORE,
    /** Das Tor, das bei dieser Tiefe haelt — oder null. */
    torBei: function (tiefe) {
      if (tiefe === KETTENMEISTER_GATE_DEPTH) {
        return _gateOpen() ? null : BOSS_TORE[0];
      }
      return _torBei(tiefe);
    },
    _resetForTest: _resetForTest,
    _setGateForTest: _setGateForTest
  };
})();
