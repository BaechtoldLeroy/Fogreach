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
    'tutorial.step.combat_potion':            'F drücken für Heiltrank',
    'tutorial.step.combat_potion.mobile':     'Tippe den Heiltrank-Knopf',
    'tutorial.step.journal_hint':             'Ratsherr Aldric hat dir einen Auftrag gegeben — drücke J, um dein Journal zu öffnen',
    'tutorial.step.journal_hint.mobile':      'Ratsherr Aldric hat dir einen Auftrag gegeben — tippe das Journal-Symbol oben rechts',
    'tutorial.step.skill_loadout':            'Du hast eine neue Fähigkeit erlernt — drücke K, um sie ins Loadout zu legen',
    'tutorial.step.skill_loadout.mobile':     'Du hast eine neue Fähigkeit erlernt — tippe das Loadout-Symbol oben',
    'tutorial.step.skill_use':                'Im Dungeon kannst du die Fähigkeit mit Q/W/E/R einsetzen',
    'tutorial.step.skill_use.classic':        'Im Dungeon kannst du die Fähigkeit mit Q/W/E/R einsetzen',
    'tutorial.step.skill_use.arpg':           'Im Dungeon kannst du die Fähigkeit mit 1/2/3/4 einsetzen',
    'tutorial.step.skill_use.mobile':         'Im Dungeon kannst du die Fähigkeit mit den Ability-Knöpfen unten einsetzen',
    // loot_wait has no banner (hintKey null in the step) — the banner stays
    // hidden between combat.basics and the first loot drop, so the player
    // isn't told to pick something up before there is anything to pick up.
    'tutorial.step.loot_pickup':              'Ein Item ist gefallen — lauf einfach drüber, um es aufzuheben',
    'tutorial.step.loot_pickup.mobile':       'Ein Item ist gefallen — bewege dich mit dem Joystick darüber, um es aufzuheben',
    'tutorial.step.loot_equip':               'Öffne das Inventar (I) und mache Rechtsklick auf das Item, um es anzulegen',
    'tutorial.step.loot_equip.mobile':        'Öffne das Inventar, tippe das Item an und dann den passenden Ausrüstungs-Slot',
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
    'tutorial.step.combat_potion':            'Press F to drink a healing potion',
    'tutorial.step.combat_potion.mobile':     'Tap the potion button',
    'tutorial.step.journal_hint':             "Councillor Aldric gave you a task — press J to open your journal",
    'tutorial.step.journal_hint.mobile':      "Councillor Aldric gave you a task — tap the journal icon (top-right)",
    'tutorial.step.skill_loadout':            'You learned a new ability — press K to slot it into your loadout',
    'tutorial.step.skill_loadout.mobile':     'You learned a new ability — tap the loadout icon at the top',
    'tutorial.step.skill_use':                'In the dungeon you can trigger the ability with Q/W/E/R',
    'tutorial.step.skill_use.classic':        'In the dungeon you can trigger the ability with Q/W/E/R',
    'tutorial.step.skill_use.arpg':           'In the dungeon you can trigger the ability with 1/2/3/4',
    'tutorial.step.skill_use.mobile':         'In the dungeon you can trigger the ability with the ability buttons at the bottom',
    'tutorial.step.loot_pickup':              'An item dropped — just walk over it to pick it up',
    'tutorial.step.loot_pickup.mobile':       'An item dropped — move over it with the joystick to pick it up',
    'tutorial.step.loot_equip':               'Open the inventory (I) and right-click the item to equip it',
    'tutorial.step.loot_equip.mobile':        'Open the inventory, tap the item, then tap the matching equipment slot',
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
      // Force the banner to stay visible for at least 5 s so the player
      // can read "WASD/Pfeiltasten zum Bewegen" before the first frame
      // of motion advances past it. Movement events that arrive earlier
      // are dropped silently and the step advances on the next event
      // after the minimum time has elapsed.
      minDisplayMs: 5000,
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
      // Ability slot tutorial deferred until the player actually has an
      // After the first hit, wait silently until something actually drops
      // before showing pickup instructions. hintKey:null keeps the banner
      // hidden so the player isn't told "lauf darüber zum Aufheben"
      // before there is anything to pick up. Advances when an enemy or
      // chest first spawns loot in this run.
      id: 'loot.wait',
      scene: 'GameScene',
      hintKey: null,
      targetRef: null,
      completion: { event: 'loot.dropped' }
    },
    {
      id: 'loot.pickup',
      scene: 'GameScene',
      hintKey: 'tutorial.step.loot_pickup',
      targetRef: null,
      // Briefly freeze physics when this step becomes active so the player
      // — who is already moving toward the dropped item — can't walk
      // straight onto it before reading the banner. The overlay handles
      // the pause/resume against the active scene.
      freezePhysicsMs: 1500,
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
      // Potion key tutorial moved AFTER the loot loop so the player has had
      // a chance to find a potion in the wild before being told to drink
      // one. Advances on every F-press regardless of whether a potion was
      // actually consumed (no softlock for empty-inventory players).
      // The ability tutorial that originally lived in this slot is deferred
      // until the player actually has an ability equipped (Phase 2+).
      id: 'combat.potion',
      scene: 'GameScene',
      hintKey: 'tutorial.step.combat_potion',
      targetRef: null,
      completion: { event: 'potion.attempted' }
    },
    {
      // Quest pointer + journal-key hint. Appears immediately after the
      // potion step (still in the dungeon — both Hub and GameScene bind
      // J to the journal overlay). Advances when the player presses J.
      id: 'journal.hint',
      scene: null, // any scene — banner travels with the player
      hintKey: 'tutorial.step.journal_hint',
      targetRef: null,
      completion: { event: 'journal.opened' }
    },
    {
      // Skill mini-tutorial — silent wait until the player has learned an
      // ability. Auto-unlocks fire on kill / wave / quest milestones,
      // typically while the player is still in the dungeon, so this slot
      // is positioned BEFORE hub.return.wait. If ability.learned fires
      // earlier in the flow (e.g. during combat.basics) the event is
      // buffered and replayed when this step is entered (see report()).
      id: 'skill.wait',
      scene: null,
      hintKey: null,
      targetRef: null,
      completion: { event: 'ability.learned' }
    },
    {
      // Loadout binding hint. K is bound to openLoadoutUI in both Hub
      // (HubSceneV2._handleLoadout) and GameScene (main.js); the
      // tutorial accepts a loadout-open from either.
      id: 'skill.loadout',
      scene: null,
      hintKey: 'tutorial.step.skill_loadout',
      targetRef: null,
      completion: { event: 'loadout.opened' }
    },
    {
      // Skill use binding hint. The .classic/.arpg/.mobile i18n variants
      // render the correct keys for the active scheme. Advances on
      // combat.ability.used. No softlock if the player never uses an
      // ability — the tutorial just parks here.
      id: 'skill.use',
      scene: null,
      hintKey: 'tutorial.step.skill_use',
      targetRef: null,
      completion: { event: 'combat.ability.used' }
    },
    {
      // Silent gate — the next visible step (save.notice) only fires once
      // the player has returned to the hub. Without this gate the save
      // notice could appear inside the dungeon, which makes no sense.
      id: 'hub.return.wait',
      scene: null,
      hintKey: null,
      targetRef: null,
      completion: { event: 'hub.returned' }
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
      // Final step — Druckerei is always last in the flow so it is never
      // skipped, regardless of how the player progresses through the
      // skill mini-tutorial.
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
      pendingTimerId: null,
      // Timestamp (primitives.now()) when the current step was entered.
      // Used to enforce step.minDisplayMs — events that arrive before the
      // minimum has elapsed are dropped so a fast player can't blow past
      // the first banner without reading it.
      currentStepShownAt: 0,
      // True when ability.learned arrived before the player reached
      // skill.wait. _advance checks this when entering skill.wait and
      // immediately re-advances so the loadout hint appears without
      // waiting for ANOTHER ability learn (auto-unlocks fire only once
      // per ability, so a second learn could be a long time away).
      pendingAbilityLearned: false
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
    state.currentStepShownAt = primitives.now();
    _persist();
    _notify();
    if (next.autoDismissMs) _scheduleAutoDismiss(next);
    // If ability.learned was buffered earlier in the flow, replay it now
    // by advancing one more step. This drops the silent skill.wait gate
    // and lands directly on skill.loadout so the player gets the hint
    // immediately on reaching this slot.
    if (next.id === 'skill.wait' && state.pendingAbilityLearned) {
      state.pendingAbilityLearned = false;
      _persist();
      _advance();
    }
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
      // Re-set currentStepShownAt so minDisplayMs applies again on resume.
      // We don't know how long the banner was shown last session, so the
      // safest behavior is to show it for the full minimum again.
      if (state.active && state.currentStepId) {
        state.currentStepShownAt = primitives.now();
      }
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

    // ---- Buffer: ability.learned before skill.wait ----------------------
    // The skill mini-tutorial sits between journal.hint and hub.return.wait
    // in the linear flow. Auto-unlocks (kill / wave / quest milestones)
    // can fire ability.learned much earlier — during combat.basics, the
    // loot loop, combat.potion, etc. We do NOT want to skip those steps
    // (every other reorder request was specifically about preserving
    // them). Instead, remember that an ability has been learned and let
    // skill.wait advance immediately when the player reaches it.
    if (eventName === 'ability.learned') {
      var skillWaitIdx = _stepIndex('skill.wait');
      var hereIdx = _stepIndex(state.currentStepId);
      if (skillWaitIdx >= 0 && hereIdx >= 0 && hereIdx < skillWaitIdx) {
        if (!state.pendingAbilityLearned) {
          state.pendingAbilityLearned = true;
          _persist();
        }
        _debugLog(eventName, payload, 'buffered for skill.wait (currently on ' + state.currentStepId + ')');
        return;
      }
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
    if (step.minDisplayMs && state.currentStepShownAt > 0) {
      var elapsed = primitives.now() - state.currentStepShownAt;
      if (elapsed < step.minDisplayMs) {
        _debugLog(eventName, payload, 'dropped: minDisplayMs not yet elapsed (' + elapsed + 'ms / ' + step.minDisplayMs + 'ms) for step ' + step.id);
        return;
      }
    }
    _debugLog(eventName, payload, 'advancing from ' + step.id);
    _advance();
  }

  // Diagnostic — logs every report() call until the tutorial flow is
  // verified end-to-end. Set window.__TUTORIAL_DEBUG__ = false in DevTools
  // to silence (default ON during the #29 stabilization sweep).
  //
  // Repeated identical (event + first-word-of-verdict) drops are coalesced
  // into a single line with a "(xN)" suffix on the next distinct line, so
  // a player holding WASD during the movement step's minDisplayMs window
  // doesn't flood the console with 300 identical "dropped: minDisplayMs..."
  // entries.
  var _lastLogKey = null;
  var _lastLogCount = 0;
  function _debugLog(eventName, payload, verdict) {
    try {
      if (typeof window !== 'undefined' && window.__TUTORIAL_DEBUG__ === false) return;
      // Verdict starts with "advancing" or "dropped: ..." — coalesce on
      // the prefix only so different drop reasons stay distinguishable.
      var verdictKey = String(verdict).split(':')[0];
      var key = eventName + '|' + verdictKey;
      if (key === _lastLogKey) {
        _lastLogCount += 1;
        return;
      }
      if (_lastLogCount > 0) {
        console.log('[TutorialSystem.report] ... (repeated x' + (_lastLogCount + 1) + ')');
      }
      _lastLogKey = key;
      _lastLogCount = 0;
      console.log('[TutorialSystem.report]', eventName, payload, '->', verdict);
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
      autoDismissMs: s.autoDismissMs || null,
      minDisplayMs: s.minDisplayMs || 0,
      freezePhysicsMs: s.freezePhysicsMs || 0
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
