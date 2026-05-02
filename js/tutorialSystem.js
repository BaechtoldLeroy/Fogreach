// tutorialSystem.js — first-time-player onboarding state machine.
//
// Runs as an IIFE that attaches `window.TutorialSystem`. The module owns its
// own localStorage key (`demonfall_tutorial_v1`) — never bundled into the main
// save (Constraint C-07). Scenes report player events via report(eventName,
// payload); the overlay (js/scenes/tutorialOverlay.js) subscribes via
// onChange(cb) and renders the current step's hint banner + target highlight.
//
// See:
//   kitty-specs/044-tutorial-onboarding-flow/contracts/tutorial-system-api.md
//   kitty-specs/044-tutorial-onboarding-flow/data-model.md

(function () {
  var STORAGE_KEY = 'demonfall_tutorial_v1';
  var SCHEMA_VERSION = 1;
  var INIT_STEP_ID = 'init';
  var FIRST_VISIBLE_STEP_ID = 'movement';

  // --- i18n string tables -------------------------------------------------
  // Registered once per language at init(). Owned here so the keys ship with
  // the feature; consumers (overlay, settings, hubLayout for the Druckerei
  // stub) reference these keys via window.i18n.t(...).
  // Input-binding-aware hint variants. The overlay resolver picks the most
  // specific available key in priority: <key>.mobile > <key>.<scheme> > <key>.
  // Classic = arrow keys + Space + QWER. ARPG = WASD + LMB + 1234. Mobile =
  // floating joystick + on-screen ability buttons + virtual interact button.
  // Steps that mention a specific binding (movement, combat, dialog/interact,
  // loot pickup/equip) all carry .classic / .arpg / .mobile variants. Steps
  // that only direct the player ("go to X") do not.
  var I18N_DE = {
    'tutorial.step.movement':                 'WASD zum Bewegen',
    'tutorial.step.movement.classic':         'Pfeiltasten zum Bewegen',
    'tutorial.step.movement.arpg':            'WASD zum Bewegen',
    'tutorial.step.movement.mobile':          'Joystick links benutzen zum Bewegen',
    'tutorial.step.quest_dialog':             'Sprich mit Ratsherr Aldric — [E] zum Reden',
    'tutorial.step.quest_dialog.mobile':      'Geh zu Ratsherr Aldric und tippe den Interaktions-Knopf',
    'tutorial.step.quest_close':              'Nimm den Auftrag an und schließe den Dialog (ESC)',
    'tutorial.step.quest_close.mobile':       'Nimm den Auftrag an und schließe den Dialog',
    'tutorial.step.dungeon_approach':         'Geh zum Rathauskeller',
    'tutorial.step.dungeon_enter':            '[E] um den Dungeon zu betreten',
    'tutorial.step.dungeon_enter.mobile':     'Tippe den Interaktions-Knopf, um den Dungeon zu betreten',
    'tutorial.step.combat_basics':            'WASD bewegen, LMB/Space angreifen',
    'tutorial.step.combat_basics.classic':    'Pfeiltasten bewegen, Space angreifen',
    'tutorial.step.combat_basics.arpg':       'WASD bewegen, Linksklick angreifen',
    'tutorial.step.combat_basics.mobile':     'Joystick bewegt, Angriffs-Knopf greift an',
    'tutorial.step.combat_ability':           'Ability-Slot 1 — Q drücken',
    'tutorial.step.combat_ability.classic':   'Ability-Slot 1 — Q drücken',
    'tutorial.step.combat_ability.arpg':      'Ability-Slot 1 — Taste 1 drücken',
    'tutorial.step.combat_ability.mobile':    'Tippe einen der Ability-Knöpfe',
    'tutorial.step.loot_pickup':              'Lauf darüber zum Aufheben',
    'tutorial.step.loot_pickup.mobile':       'Lauf mit dem Joystick darüber zum Aufheben',
    'tutorial.step.loot_equip':               'Rechtsklick zum Anlegen',
    'tutorial.step.loot_equip.mobile':        'Item antippen, dann auf den Slot tippen',
    'tutorial.step.save_notice':              'Dein Fortschritt wird automatisch gespeichert',
    'tutorial.step.druckerei_visit':          'Geh zur Druckerei',
    'tutorial.druckerei.stub':                'Setzer Thom: »Die Druckerei ist noch in Arbeit. Komm bald wieder.«',
    'tutorial.skip.confirm':                  'Tutorial wirklich überspringen?',
    'tutorial.settings.skip_label':           'Tutorial überspringen',
    'tutorial.settings.replay_label':         'Tutorial neu starten',
    'tutorial.settings.replay_confirm':       'Tutorial wirklich von vorne beginnen?'
  };
  var I18N_EN = {
    'tutorial.step.movement':                 'WASD to move',
    'tutorial.step.movement.classic':         'Arrow keys to move',
    'tutorial.step.movement.arpg':            'WASD to move',
    'tutorial.step.movement.mobile':          'Use the left joystick to move',
    'tutorial.step.quest_dialog':             'Talk to Councillor Aldric — press [E]',
    'tutorial.step.quest_dialog.mobile':      'Walk to Councillor Aldric and tap the interact button',
    'tutorial.step.quest_close':              'Accept the task and close the dialog (ESC)',
    'tutorial.step.quest_close.mobile':       'Accept the task and close the dialog',
    'tutorial.step.dungeon_approach':         'Go to the town hall cellar',
    'tutorial.step.dungeon_enter':            '[E] to enter the dungeon',
    'tutorial.step.dungeon_enter.mobile':     'Tap the interact button to enter the dungeon',
    'tutorial.step.combat_basics':            'WASD to move, LMB/Space to attack',
    'tutorial.step.combat_basics.classic':    'Arrow keys to move, Space to attack',
    'tutorial.step.combat_basics.arpg':       'WASD to move, left-click to attack',
    'tutorial.step.combat_basics.mobile':     'Joystick moves, attack button strikes',
    'tutorial.step.combat_ability':           'Ability slot 1 — press Q',
    'tutorial.step.combat_ability.classic':   'Ability slot 1 — press Q',
    'tutorial.step.combat_ability.arpg':      'Ability slot 1 — press 1',
    'tutorial.step.combat_ability.mobile':    'Tap any ability button',
    'tutorial.step.loot_pickup':              'Walk over it to pick up',
    'tutorial.step.loot_pickup.mobile':       'Walk over it with the joystick to pick up',
    'tutorial.step.loot_equip':               'Right-click to equip',
    'tutorial.step.loot_equip.mobile':        'Tap the item, then tap the slot',
    'tutorial.step.save_notice':              'Your progress is saved automatically',
    'tutorial.step.druckerei_visit':          'Go to the printing house',
    'tutorial.druckerei.stub':                "Setzer Thom: 'The printing house is still under construction. Come back soon.'",
    'tutorial.skip.confirm':                  'Really skip the tutorial?',
    'tutorial.settings.skip_label':           'Skip tutorial',
    'tutorial.settings.replay_label':         'Restart tutorial',
    'tutorial.settings.replay_confirm':       'Really restart the tutorial from the beginning?'
  };

  // --- Helpers ------------------------------------------------------------
  //
  // Matching helper: HubSceneV2 emits payload.name as the entrance's stable
  // hubLayout id (e.g. 'rathaus_entrance', 'schmiede_entrance') and dialog
  // events emit payload.npc as the NPC's stable id (e.g. 'aldric', 'branka').
  // Old matchers compared against display labels ('Rathauskeller', 'Branka')
  // which never matched. Use case-insensitive substring matching against
  // either side so a step's `ref` can be the player-facing slug.
  function _nameMatches(actual, ref) {
    if (!actual || !ref) return false;
    var a = String(actual).toLowerCase();
    var r = String(ref).toLowerCase();
    return a === r || a.indexOf(r) !== -1 || r.indexOf(a) !== -1;
  }

  // --- Step definitions ---------------------------------------------------
  // Order is canonical. Index 0 (`init`) is the silent step seeded on New
  // Game; maybeAutoSkip() advances past it immediately to FIRST_VISIBLE_STEP_ID.
  // The save-notice step auto-dismisses after 5000 ms via the scheduler;
  // its completion has no event match.
  //
  // Flow rationale (revised after playtest #29 v2):
  //   movement -> talk to Aldric (quest pickup) -> close dialog ->
  //   approach Rathauskeller -> enter dungeon -> combat (hit, ability,
  //   loot, equip) -> save notice -> visit Druckerei (outro stub).
  // Originally the player was sent to the workshop first, then to Branka,
  // then to the dungeon, which made narrative no sense and stalled when
  // the workshop entrance switched scenes before the Branka dialog could
  // be matched.
  var STEPS = [
    {
      id: INIT_STEP_ID,
      scene: 'StartScene',
      hintKey: null,
      targetRef: null,
      completion: { auto: true }
    },
    {
      id: 'movement',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.movement',
      targetRef: null,
      completion: { event: 'player.moved' }
    },
    {
      id: 'quest.dialog',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.quest_dialog',
      targetRef: { type: 'npc', name: 'Aldric' },
      completion: { event: 'dialog.opened', matcher: function (p) { return _nameMatches(p && p.npc, 'aldric'); } }
    },
    {
      id: 'quest.close',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.quest_close',
      targetRef: null,
      completion: { event: 'dialog.closed', matcher: function (p) { return _nameMatches(p && p.npc, 'aldric'); } }
    },
    {
      id: 'dungeon.approach',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.dungeon_approach',
      targetRef: { type: 'entrance', name: 'Rathaus' },
      completion: { event: 'hub.entrance.approached', matcher: function (p) { return _nameMatches(p && p.name, 'rathaus'); } }
    },
    {
      id: 'dungeon.enter',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.dungeon_enter',
      targetRef: { type: 'entrance', name: 'Rathaus' },
      completion: { event: 'hub.entrance.entered', matcher: function (p) { return _nameMatches(p && p.name, 'rathaus'); } }
    },
    {
      id: 'combat.basics',
      scene: 'GameScene',
      hintKey: 'tutorial.step.combat_basics',
      targetRef: null,
      completion: { event: 'combat.hit', matcher: function (p) { return p && p.byPlayer === true; } }
    },
    {
      id: 'combat.ability',
      scene: 'GameScene',
      hintKey: 'tutorial.step.combat_ability',
      targetRef: null,
      completion: { event: 'combat.ability.used' }
    },
    {
      id: 'loot.pickup',
      scene: 'GameScene',
      hintKey: 'tutorial.step.loot_pickup',
      targetRef: null,
      completion: { event: 'loot.picked' }
    },
    {
      id: 'loot.equip',
      scene: 'GameScene',
      hintKey: 'tutorial.step.loot_equip',
      targetRef: null,
      completion: { event: 'inventory.equipped' }
    },
    {
      id: 'save.notice',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.save_notice',
      targetRef: null,
      completion: { auto: true },
      autoDismissMs: 5000
    },
    {
      id: 'druckerei.visit',
      scene: 'HubSceneV2',
      hintKey: 'tutorial.step.druckerei_visit',
      targetRef: { type: 'entrance', name: 'Druckerei' },
      completion: { event: 'dialog.closed', matcher: function (p) { return _nameMatches(p && p.npc, 'Setzer Thom'); } }
    }
  ];

  function _stepIndex(id) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i;
    return -1;
  }

  // --- Internal mutable state --------------------------------------------
  var state = _freshState();
  var subscribers = new Set();
  var primitives = _defaultPrimitives();
  // Single warn-once flag for storage failures (avoids console spam).
  var _storageWarned = false;

  function _freshState() {
    return {
      initialized: false,
      active: false,
      currentStepId: null,
      skipped: false,
      completedSteps: [],
      i18nRegistered: false,
      pendingTimerId: null
    };
  }

  function _defaultPrimitives() {
    var hasWindow = typeof window !== 'undefined';
    return {
      storage: (hasWindow && window.localStorage) || {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
      },
      i18n: (hasWindow && window.i18n) || {
        register: function () {}, t: function (k) { return k; }, onChange: function () { return function () {}; }
      },
      now: function () { return Date.now(); },
      scheduler: {
        setTimeout: function (cb, ms) { return setTimeout(cb, ms); },
        clearTimeout: function (id) { clearTimeout(id); }
      },
      persistence: (hasWindow && window.Persistence) || { hasSave: function () { return false; } }
    };
  }

  // --- Persistence -------------------------------------------------------

  function _persist() {
    var blob = JSON.stringify({
      version: SCHEMA_VERSION,
      active: state.active,
      currentStepId: state.currentStepId,
      skipped: state.skipped,
      completedSteps: state.completedSteps.slice()
    });
    try {
      primitives.storage.setItem(STORAGE_KEY, blob);
    } catch (err) {
      if (!_storageWarned) {
        _storageWarned = true;
        try { console.warn('[TutorialSystem] persist failed; running in-memory only', err); } catch (_) {}
      }
    }
  }

  function _loadPersisted() {
    var raw;
    try { raw = primitives.storage.getItem(STORAGE_KEY); } catch (_) { raw = null; }
    if (!raw) return null;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) {
      _clearPersisted();
      return null;
    }
    if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
      _clearPersisted();
      return null;
    }
    return parsed;
  }

  function _clearPersisted() {
    try { primitives.storage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // --- Subscribers --------------------------------------------------------

  function _notify() {
    var step = getCurrentStep();
    subscribers.forEach(function (cb) {
      try { cb(step); }
      catch (err) {
        try { console.error('[TutorialSystem] subscriber threw', err); } catch (_) {}
      }
    });
  }

  // --- Step traversal -----------------------------------------------------

  function _scheduleAutoDismiss(step) {
    if (!step || !step.autoDismissMs) return;
    if (state.pendingTimerId !== null) {
      try { primitives.scheduler.clearTimeout(state.pendingTimerId); } catch (_) {}
      state.pendingTimerId = null;
    }
    state.pendingTimerId = primitives.scheduler.setTimeout(function () {
      state.pendingTimerId = null;
      // Only advance if we are still on this step (player may have skipped).
      if (state.active && state.currentStepId === step.id) {
        _advance();
      }
    }, step.autoDismissMs);
  }

  function _advance() {
    var idx = _stepIndex(state.currentStepId);
    if (idx < 0) {
      // Defensive: state is corrupt. Mark complete.
      state.active = false;
      state.currentStepId = null;
      _persist();
      _notify();
      return;
    }
    state.completedSteps.push(state.currentStepId);
    var nextIdx = idx + 1;
    if (nextIdx >= STEPS.length) {
      state.active = false;
      state.currentStepId = null;
      _persist();
      _notify();
      return;
    }
    var next = STEPS[nextIdx];
    state.currentStepId = next.id;
    _persist();
    _notify();
    if (next.autoDismissMs) _scheduleAutoDismiss(next);
  }

  // --- Public API ---------------------------------------------------------

  function init() {
    // Idempotent. Registers i18n exactly once per instance, then loads
    // persisted state if any. Multiple init() calls are no-ops after the
    // first successful run.
    if (state.initialized) return;
    state.initialized = true;
    if (!state.i18nRegistered) {
      try {
        primitives.i18n.register('de', I18N_DE);
        primitives.i18n.register('en', I18N_EN);
        state.i18nRegistered = true;
      } catch (_) {
        // Swallow — registration may fail if i18n is unavailable; tutorial
        // still works with raw keys.
      }
    }
    var persisted = _loadPersisted();
    if (persisted) {
      state.active = !!persisted.active;
      state.currentStepId = persisted.currentStepId || null;
      state.skipped = !!persisted.skipped;
      state.completedSteps = Array.isArray(persisted.completedSteps) ? persisted.completedSteps.slice() : [];

      // If the persisted currentStepId is not a known step (e.g. saved under
      // an older version of this module before steps were renamed), don't
      // leave the system in a "active but no current step" zombie state.
      // Discard the in-memory currentStepId + active flag so the next
      // maybeAutoSkip() can either auto-skip (when a save exists) or
      // fresh-seed at the first visible step. Skipped flag is preserved so
      // a player who explicitly opted out doesn't get the tutorial back.
      if (state.active && state.currentStepId && _stepIndex(state.currentStepId) < 0) {
        try { console.warn('[TutorialSystem] discarding unknown currentStepId:', state.currentStepId); } catch (_) {}
        state.active = false;
        state.currentStepId = null;
        // Persist the cleanup so the next session boots clean too.
        _persist();
      }

      // If we resumed mid-step-11, re-arm the auto-dismiss timer.
      var cur = getCurrentStep();
      if (cur && cur.autoDismissMs) _scheduleAutoDismiss(cur);
    }
  }

  function maybeAutoSkip() {
    if (!state.initialized) init();
    // Already skipped (this session or a prior one) → nothing to do.
    if (state.skipped) return true;
    var hasSave = false;
    try { hasSave = !!(primitives.persistence && primitives.persistence.hasSave && primitives.persistence.hasSave()); } catch (_) {}
    if (hasSave) {
      state.active = false;
      state.skipped = true;
      state.currentStepId = null;
      _persist();
      _notify();
      return true;
    }
    if (!state.active && !state.currentStepId) {
      // Fresh seed: start at the silent `init` step, then immediately advance
      // to the first visible step.
      state.active = true;
      state.currentStepId = INIT_STEP_ID;
      state.completedSteps = [];
      _advance();
    }
    return false;
  }

  function report(eventName, payload) {
    if (!state.initialized) {
      _debugLog(eventName, payload, 'dropped: not initialized');
      return;
    }
    if (!isActive()) {
      _debugLog(eventName, payload, 'dropped: not active (currentStepId=' + state.currentStepId + ', skipped=' + state.skipped + ')');
      return;
    }
    var step = getCurrentStep();
    if (!step || !step.completion) {
      _debugLog(eventName, payload, 'dropped: no step or no completion (currentStepId=' + state.currentStepId + ')');
      return;
    }
    if (step.completion.auto) {
      _debugLog(eventName, payload, 'dropped: step ' + step.id + ' is auto-dismiss only');
      return;
    }
    if (step.completion.event !== eventName) {
      _debugLog(eventName, payload, 'dropped: step ' + step.id + ' expects ' + step.completion.event);
      return;
    }
    if (typeof step.completion.matcher === 'function' && !step.completion.matcher(payload)) {
      _debugLog(eventName, payload, 'dropped: matcher rejected for step ' + step.id);
      return;
    }
    _debugLog(eventName, payload, 'advancing from ' + step.id);
    _advance();
  }

  // Diagnostic — set window.__TUTORIAL_DEBUG__ = true in DevTools to trace
  // every report() call (which event, which payload, whether it advanced or
  // why it was dropped). Off by default to avoid noisy production logs.
  function _debugLog(eventName, payload, verdict) {
    try {
      if (typeof window !== 'undefined' && window.__TUTORIAL_DEBUG__) {
        console.log('[TutorialSystem.report]', eventName, payload, '->', verdict);
      }
    } catch (_) {}
  }

  function getCurrentStep() {
    if (!state.active || !state.currentStepId) return null;
    var idx = _stepIndex(state.currentStepId);
    if (idx < 0) return null;
    var s = STEPS[idx];
    // Shallow-clone to avoid letting consumers mutate the canonical descriptor.
    return {
      id: s.id,
      scene: s.scene,
      hintKey: s.hintKey,
      targetRef: s.targetRef ? { type: s.targetRef.type, name: s.targetRef.name } : null,
      completion: s.completion,
      autoDismissMs: s.autoDismissMs || null
    };
  }

  function isActive() {
    return !!(state.active && !state.skipped && state.currentStepId);
  }

  function skip(confirmedByUser) {
    if (confirmedByUser !== true) return false;
    if (state.pendingTimerId !== null) {
      try { primitives.scheduler.clearTimeout(state.pendingTimerId); } catch (_) {}
      state.pendingTimerId = null;
    }
    state.active = false;
    state.skipped = true;
    state.currentStepId = null;
    _persist();
    _notify();
    return true;
  }

  function replay() {
    if (state.pendingTimerId !== null) {
      try { primitives.scheduler.clearTimeout(state.pendingTimerId); } catch (_) {}
      state.pendingTimerId = null;
    }
    _clearPersisted();
    state.active = true;
    state.skipped = false;
    state.currentStepId = INIT_STEP_ID;
    state.completedSteps = [];
    // Advance past `init` to the first visible step, persist, notify.
    _advance();
  }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    subscribers.add(cb);
    return function () { subscribers.delete(cb); };
  }

  function _configureForTest(p) {
    // Replace primitives (shallow merge so partial overrides work) and reset
    // in-memory state to a fresh, *uninitialized* form. Tests then call
    // init() explicitly to exercise the load path against the test's stubs.
    primitives = _defaultPrimitives();
    if (p && typeof p === 'object') {
      if (p.storage) primitives.storage = p.storage;
      if (p.i18n) primitives.i18n = p.i18n;
      if (typeof p.now === 'function') primitives.now = p.now;
      if (p.scheduler) primitives.scheduler = p.scheduler;
      if (p.persistence) primitives.persistence = p.persistence;
    }
    state = _freshState();
    subscribers.clear();
    _storageWarned = false;
  }

  // Auto-init on script load so production callers don't have to wire it.
  init();

  window.TutorialSystem = {
    init: init,
    maybeAutoSkip: maybeAutoSkip,
    report: report,
    getCurrentStep: getCurrentStep,
    isActive: isActive,
    skip: skip,
    replay: replay,
    onChange: onChange,
    _configureForTest: _configureForTest,
    _STEPS: STEPS,
    _STORAGE_KEY: STORAGE_KEY,
    _SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
