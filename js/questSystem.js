// js/questSystem.js — Quest System for Demonfall

(function () {
  'use strict';

  // ---- Quest Definitions ----
  const QUEST_DEFINITIONS = {
    // =======================================================
    // === Act 1: Der Auftrag ===
    // =======================================================
    aldric_cleanup: {
      id: 'aldric_cleanup',
      title: 'Saeuberung der Keller',
      description: 'Besiege 10 Gegner in den Kellern unter der Archivschmiede.',
      npcId: 'aldric',
      type: 'kill',
      chain: 1,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 10 }
      ],
      rewards: { xp: 30, materials: { MAT: 5 } },
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Wilde Tiere in den Kellern. Raeum sie aus.\n\nWillst du diese Aufgabe uebernehmen?',
      dialogueProgress: 'Die Keller sind noch nicht sicher. Kaempfe weiter.',
      dialogueComplete: 'Gut. Die Keller sind gesaeubert. Hier ist dein Lohn.'
    },
    aldric_patrol: {
      id: 'aldric_patrol',
      title: 'Keller-Patrouille',
      description: 'Raeume 3 Raeume in den Kellern, um alle Gaenge zu sichern.',
      npcId: 'aldric',
      type: 'explore',
      chain: 2,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 3 }
      ],
      rewards: { xp: 40 },
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Stell sicher, dass alle Gaenge sicher sind. Patrouilliere drei Raeume.\n\nBist du bereit?',
      dialogueProgress: 'Noch nicht alle Gaenge gesichert. Weiter patrouillieren.',
      dialogueComplete: 'Alle Gaenge sind sicher. Gute Arbeit, Archivschmied.'
    },

    // =======================================================
    // === Act 2: Der treue Diener ===
    // =======================================================
    aldric_intruders: {
      id: 'aldric_intruders',
      title: 'Die Eindringlinge',
      description: 'Besiege 20 Eindringlinge, die die Archive des Rats stehlen.',
      npcId: 'aldric',
      type: 'kill',
      chain: 3,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 20 }
      ],
      rewards: { xp: 75, items: [{ type: 'weapon', key: 'ALDRIC_SCHWERT', name: 'Ratsschwert', iconKey: 'itWeapon', rarity: 'rare', rarityLabel: 'Selten', rarityValue: 2, itemLevel: 6, damage: 10, speed: 1.1, range: 105, armor: 0, crit: 0.08, hp: 0 }] },
      prerequisites: ['aldric_cleanup'],
      requiredAct: 1,
      dialogueOffer: 'Fremde stehlen unsere Dokumente. Stoppe sie. Besiege zwanzig dieser Eindringlinge.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Die Eindringlinge treiben noch ihr Unwesen. Kaempfe weiter.',
      dialogueComplete: 'Hervorragend. Die Eindringlinge sind vertrieben. Nimm dieses Schwert als Zeichen des Vertrauens.'
    },
    harren_daughter: {
      id: 'harren_daughter',
      title: 'Die verschwundene Tochter',
      description: 'Durchsuche 5 Raeume und finde Elaras Tagebuch.',
      npcId: 'harren',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 5 },
        { type: 'fetch', target: 'diary', current: 0, required: 1 }
      ],
      rewards: { xp: 100 },
      prerequisites: [],
      requiredAct: 1,
      dialogueOffer: 'Meine Tochter Elara... bitte finde sie. Durchsuche die Raeume und bring mir ihr Tagebuch.\n\nHilfst du einem alten Mann?',
      dialogueProgress: 'Hast du etwas gefunden? Bitte such weiter nach Elara...',
      dialogueComplete: 'Ihr Tagebuch... Danke. Wenigstens weiss ich jetzt, dass sie lebt.'
    },
    branka_armor: {
      id: 'branka_armor',
      title: 'Neue Ruestungen',
      description: 'Beschaffe 3 Materialien fuer die vom Rat bestellten Ruestungen.',
      npcId: 'branka',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'material', current: 0, required: 3 }
      ],
      rewards: { xp: 50, materials: { MAT: 10 } },
      prerequisites: [],
      requiredAct: 1,
      dialogueOffer: 'Der Rat will neue Ruestungen. Aber die Plaene... stimmen nicht. Bring mir trotzdem drei Materialien.\n\nHilfst du mir?',
      dialogueProgress: 'Ich brauche noch mehr Materialien. Such weiter.',
      dialogueComplete: 'Danke. Aber diese Ruestungen... die Masse sind fuer Gefangene, nicht Soldaten. Etwas stimmt hier nicht.'
    },

    // =======================================================
    // === Act 3: Erste Risse ===
    // =======================================================
    mara_contact: {
      id: 'mara_contact',
      title: 'Die Spaeherin',
      description: 'Triff Mara und hoere, was sie zu sagen hat.',
      npcId: 'mara',
      type: 'dialogue',
      chain: 1,
      objectives: [
        { type: 'dialogue', target: 'mara_meet', current: 0, required: 1 }
      ],
      rewards: { info: 'Maras Netzwerk enthuellt' },
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Du erinnerst dich nicht. Aber ich kenne dich.\n\nHoer mir zu — es ist wichtig.',
      dialogueProgress: 'Wir muessen reden. Komm zu mir.',
      dialogueComplete: 'Jetzt weisst du Bescheid. Mein Netzwerk steht dir offen.'
    },
    elara_meeting: {
      id: 'elara_meeting',
      title: 'Elaras Geheimnis',
      description: 'Finde 2 geheime Dokumente, die Elara versteckt hat.',
      npcId: 'elara',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'document', current: 0, required: 2 }
      ],
      rewards: { xp: 100, unlocks: ['elara_trust'] },
      prerequisites: [],
      requiredAct: 2,
      dialogueOffer: 'Ich bin nicht entfuehrt worden. Ich bin geflohen. Hier — lies das.\n\nFinde zwei Dokumente, die ich im Keller versteckt habe.',
      dialogueProgress: 'Die Dokumente sind gut versteckt. Suche weiter.',
      dialogueComplete: 'Jetzt siehst du die Wahrheit. Der Rat hat mich benutzt — fuer ihre Rituale.'
    },
    branka_doubt: {
      id: 'branka_doubt',
      title: 'Zweifel der Schmiedin',
      description: 'Besiege 5 Elite-Gegner, um Beweise fuer Brankas Verdacht zu finden.',
      npcId: 'branka',
      type: 'kill',
      chain: 2,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 5 }
      ],
      rewards: { xp: 80 },
      prerequisites: ['branka_armor'],
      requiredAct: 2,
      dialogueOffer: 'Diese Ruestungen sind fuer Gefangene, nicht Soldaten. Hilf mir, Beweise zu finden.\n\nBesiege fuenf Elite-Wachen und bring mir ihre Befehle.',
      dialogueProgress: 'Die Elite-Wachen tragen die Beweise bei sich. Kaempfe weiter.',
      dialogueComplete: 'Ich hatte recht. Der Rat baut Gefaengnisse, keine Kasernen. Wir muessen handeln.'
    },

    // =======================================================
    // === Act 4: Die Wahrheit sickert durch ===
    // =======================================================
    elara_ritual: {
      id: 'elara_ritual',
      title: 'Die Ritualkammer',
      description: 'Dringe bis Welle 20 vor, um die Ritualkammer des Rats zu finden.',
      npcId: 'elara',
      type: 'wave',
      chain: 2,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 20 }
      ],
      rewards: { xp: 150, items: [{ type: 'accessory', key: 'RITUAL_AMULETT', name: 'Ritualamulett', iconKey: 'itAccessory', rarity: 'epic', rarityLabel: 'Episch', rarityValue: 3, itemLevel: 12, damage: 0, speed: 0, range: 0, armor: 5, crit: 0.05, hp: 20 }] },
      prerequisites: ['elara_meeting'],
      requiredAct: 3,
      dialogueOffer: 'Tief unten ist eine Kammer... ich zeige dir wo. Dringe bis Welle 20 vor.\n\nBist du bereit fuer die Wahrheit?',
      dialogueProgress: 'Du musst tiefer vordringen. Die Ritualkammer liegt bei Welle 20.',
      dialogueComplete: 'Du hast sie gefunden. Die Beschwoerungskammer des Rats. Nimm dieses Amulett — es schuetzt vor ihrer dunklen Magie.'
    },
    thom_truth: {
      id: 'thom_truth',
      title: 'Verbotene Wahrheiten',
      description: 'Finde 5 Druckplatten mit den verbotenen Wahrheiten ueber den Rat.',
      npcId: 'thom',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'print_plate', current: 0, required: 5 }
      ],
      rewards: { xp: 100, materials: { MAT: 20 } },
      prerequisites: [],
      requiredAct: 3,
      dialogueOffer: 'Ich habe genug gedruckt, was der Rat will. Zeit fuer die Wahrheit.\n\nFinde fuenf Druckplatten im Keller — sie enthalten die echte Geschichte.',
      dialogueProgress: 'Die Druckplatten sind irgendwo im Rathauskeller verborgen. Suche weiter.',
      dialogueComplete: 'Fantastisch! Diese Platten enthalten Beweise, die der Rat vernichten wollte. Die Wahrheit geht in Druck.'
    },
    mara_warning: {
      id: 'mara_warning',
      title: 'Maras Warnung',
      description: 'Besiege den Kettenmeister-Boss, der die ersten echten Beweise bewacht.',
      npcId: 'mara',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'kettenmeister', current: 0, required: 1 }
      ],
      rewards: { xp: 200 },
      prerequisites: ['mara_contact'],
      requiredAct: 3,
      dialogueOffer: 'Der Kettenmeister bewacht die ersten echten Beweise. Besiege ihn.\n\nOhne diese Beweise koennen wir nichts beweisen.',
      dialogueProgress: 'Der Kettenmeister lebt noch. Finde und besiege ihn.',
      dialogueComplete: 'Der Kettenmeister ist gefallen! Die Beweise sind gesichert. Jetzt kann niemand mehr leugnen, was der Rat getan hat.'
    },

    // =======================================================
    // === Act 5: Der Bruch ===
    // =======================================================
    branka_weapons: {
      id: 'branka_weapons',
      title: 'Waffen fuer den Widerstand',
      description: 'Stelle 3 Gegenstaende in der Archivschmiede her.',
      npcId: 'branka',
      type: 'craft',
      chain: 3,
      objectives: [
        { type: 'craft', target: 'craft_item', current: 0, required: 3 }
      ],
      rewards: { xp: 150 },
      prerequisites: ['branka_doubt'],
      requiredAct: 4,
      dialogueOffer: 'Wir brauchen Waffen. Nicht fuer den Rat — fuer UNS.\n\nStelle drei Gegenstaende in der Schmiede her.',
      dialogueProgress: 'Die Schmiede wartet. Stelle weitere Gegenstaende her.',
      dialogueComplete: 'Gut geschmiedet. Diese Waffen werden den Unterschied machen.'
    },
    thom_pamphlets: {
      id: 'thom_pamphlets',
      title: 'Die Pamphlete',
      description: 'Schliesse 3 Dungeon-Durchlaeufe ab, um Flugblaetter zu verteilen.',
      npcId: 'thom',
      type: 'dungeon_runs',
      chain: 2,
      objectives: [
        { type: 'dungeon_run', target: 'dungeon_complete', current: 0, required: 3 }
      ],
      rewards: { xp: 200, unlocks: ['xp_bonus_10'] },
      prerequisites: ['thom_truth'],
      requiredAct: 4,
      dialogueOffer: 'Jeder Durchlauf ist eine Chance, Flugblaetter zu verteilen.\n\nSchliesse drei Durchlaeufe ab, und ganz Fogreach wird die Wahrheit lesen.',
      dialogueProgress: 'Kaempfe dich weiter durch den Rathauskeller. Jeder Durchlauf verbreitet unsere Botschaft.',
      dialogueComplete: 'Die ganze Stadt liest unsere Wahrheiten! Die Buerger sind aufgewacht. Deine Erfahrung waechst nun schneller. (+10% XP)'
    },
    elara_blade: {
      id: 'elara_blade',
      title: 'Elaras Geschenk',
      description: 'Elara hat eine besondere Waffe fuer dich geschmiedet.',
      npcId: 'elara',
      type: 'dialogue',
      chain: 3,
      elaraGift: true,
      objectives: [
        { type: 'dialogue', target: 'elara_gift', current: 0, required: 1 }
      ],
      rewards: { xp: 0, items: [{ type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', iconKey: 'itWeapon', rarity: 'legendary', rarityLabel: 'Legendaer', rarityValue: 4, itemLevel: 15, damage: 22, speed: 1.3, range: 120, armor: 0, crit: 0.15, hp: 0, elaraGift: true }] },
      prerequisites: ['elara_ritual'],
      requiredAct: 4,
      dialogueOffer: 'Nimm das. Ich habe es fuer dich geschmiedet. Fuer den Fall, dass...\n\nNimm Elaras Klinge an?',
      dialogueProgress: 'Die Klinge wartet auf dich.',
      dialogueComplete: 'Moege sie dich beschuetzen. Egal was kommt.'
    },

    // =======================================================
    // === Act 6: Rebellion ===
    // =======================================================
    mara_assault: {
      id: 'mara_assault',
      title: 'Der Sturm auf den Rat',
      description: 'Dringe bis Welle 30 vor, um den Rat zu stuerzen.',
      npcId: 'mara',
      type: 'wave',
      chain: 3,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 30 }
      ],
      rewards: { xp: 300 },
      prerequisites: ['mara_warning'],
      requiredAct: 5,
      dialogueOffer: 'Es ist soweit. Der Rat faellt heute. Dringe bis Welle 30 vor.\n\nBist du bereit fuer den Sturm?',
      dialogueProgress: 'Der Rat wartet in der Tiefe. Dringe weiter vor — Welle 30.',
      dialogueComplete: 'Der Rat ist gestuerzt! Fogreach atmet auf. Aber die Schatten sind noch nicht besiegt...'
    },
    harren_rescue: {
      id: 'harren_rescue',
      title: 'Rettung oder Beweis',
      description: 'Besiege den Schattenrat-Boss, um Elara zu finden.',
      npcId: 'harren',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }
      ],
      rewards: { xp: 250 },
      prerequisites: ['harren_daughter'],
      requiredAct: 5,
      dialogueOffer: 'Finde meine Tochter. Bitte. Der Schattenrat haelt sie fest.\n\nBesiege ihn und bring Elara zurueck.',
      dialogueProgress: 'Der Schattenrat lebt noch. Finde und besiege ihn — fuer Elara.',
      dialogueComplete: 'Du hast den Schattenrat besiegt. Aber Elara... sie ist mit ihm verschwunden. Was hat das zu bedeuten?'
    },

    // =======================================================
    // === Act 7: Offenbarung ===
    // =======================================================
    final_truth: {
      id: 'final_truth',
      title: 'Die letzte Wahrheit',
      description: 'Dringe bis Welle 40 vor, um die wahre Quelle des Pakts zu finden.',
      npcId: 'mara',
      type: 'wave',
      chain: 4,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 40 }
      ],
      rewards: { xp: 500, unlocks: ['story_ending'] },
      prerequisites: ['mara_assault'],
      requiredAct: 6,
      dialogueOffer: 'Unter Fogreach wartet die Wahrheit. Bist du bereit?\n\nDringe bis Welle 40 vor — in die Dimension aus Ketten und Schatten.',
      dialogueProgress: 'Die letzte Wahrheit liegt bei Welle 40. Du musst tiefer gehen.',
      dialogueComplete: 'Die Ketten sind gebrochen. Die Wahrheit ist frei. Fogreach gehoert wieder den Menschen.'
    }
  };

  // ---- i18n bootstrap ----
  // Auto-register German strings from QUEST_DEFINITIONS so consumers can use
  // i18n.t('quest.<id>.<field>'). German is source-of-truth — fallback for any
  // EN translation that is missing returns the German value via the i18n
  // lookup cascade (active → de → [MISSING:key]).
  if (window.i18n) {
    var QUEST_FIELDS = ['title', 'description', 'dialogueOffer', 'dialogueProgress', 'dialogueComplete'];
    var _autoDe = {};
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      var q = QUEST_DEFINITIONS[id];
      QUEST_FIELDS.forEach(function (field) {
        if (typeof q[field] === 'string') {
          _autoDe['quest.' + id + '.' + field] = q[field];
        }
      });
    });
    // Generic tracker strings
    _autoDe['quest.tracker.progress'] = '{title}: {cur}/{required}';
    _autoDe['quest.tracker.short_suffix'] = '..';
    window.i18n.register('de', _autoDe);

    // English overrides — partial; missing keys gracefully fall back to DE.
    // Translations will expand iteratively. Quest titles + tracker translated
    // up front; dialogues to follow.
    window.i18n.register('en', {
      'quest.tracker.progress': '{title}: {cur}/{required}',
      'quest.tracker.short_suffix': '..',
      'quest.aldric_cleanup.title': 'Cellar Cleanup',
      'quest.aldric_cleanup.description': 'Defeat 10 enemies in the cellars beneath the Archive Forge.',
      'quest.aldric_patrol.title': 'Cellar Patrol',
      'quest.aldric_patrol.description': 'Clear 3 rooms in the cellars to secure all corridors.',
      'quest.aldric_intruders.title': 'The Intruders',
      'quest.aldric_intruders.description': 'Defeat 20 intruders raiding the council archives.',
      'quest.harren_daughter.title': 'The Missing Daughter',
      'quest.harren_daughter.description': 'Search 5 rooms and find Elara\'s diary.',
      'quest.branka_armor.title': 'New Armor',
      'quest.branka_armor.description': 'Gather 3 materials for the council-commissioned armor.',
      'quest.mara_contact.title': 'The Scout',
      'quest.mara_contact.description': 'Meet Mara and hear what she has to say.',
      'quest.elara_meeting.title': "Elara's Secret",
      'quest.elara_meeting.description': 'Find 2 secret documents Elara has hidden.',
      'quest.branka_doubt.title': "The Smith's Doubt",
      'quest.branka_doubt.description': "Defeat 5 elite enemies to find evidence for Branka's suspicions.",
      'quest.elara_ritual.title': 'The Ritual Chamber',
      'quest.elara_ritual.description': 'Reach wave 20 to find the council\'s ritual chamber.',
      'quest.thom_truth.title': 'Forbidden Truths',
      'quest.thom_truth.description': 'Find 5 print plates with the forbidden truths about the council.',
      'quest.mara_warning.title': "Mara's Warning",
      'quest.mara_warning.description': 'Defeat the Chainmaster boss who guards the first real evidence.',
      'quest.branka_weapons.title': 'Weapons for the Resistance',
      'quest.branka_weapons.description': 'Craft 3 items at the Archive Forge.',
      'quest.thom_pamphlets.title': 'The Pamphlets',
      'quest.thom_pamphlets.description': 'Complete 3 dungeon runs to spread the leaflets.',
      'quest.elara_blade.title': "Elara's Gift",
      'quest.elara_blade.description': 'Elara has forged a special weapon for you.',
      'quest.mara_assault.title': 'Storming the Council',
      'quest.mara_assault.description': 'Reach wave 30 to topple the council.',
      'quest.harren_rescue.title': 'Rescue or Evidence',
      'quest.harren_rescue.description': 'Defeat the Shadow Council boss to find Elara.',
      'quest.final_truth.title': 'The Final Truth',
      'quest.final_truth.description': 'Reach wave 40 to find the true source of the pact.'
    });
  }

  // ---- i18n helpers ----
  // Use these helpers (or i18n.t directly with `quest.<id>.<field>`) instead of
  // reading quest.title / quest.description directly so the active language is
  // always honored. Falls back to the original field when i18n is absent.
  function getQuestField(quest, field) {
    if (!quest) return '';
    if (window.i18n) {
      var v = window.i18n.t('quest.' + quest.id + '.' + field);
      if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
    }
    return quest[field] || '';
  }

  // ---- Quest State ----
  // status: 'available' | 'active' | 'completed'
  let questState = {};

  function _initQuestState() {
    questState = {};
    Object.keys(QUEST_DEFINITIONS).forEach(function (id) {
      questState[id] = { status: 'available', objectives: null };
    });
  }
  _initQuestState();

  // ---- Core Functions ----

  function _getCurrentActIndex() {
    if (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function') {
      return window.storySystem.getCurrentActIndex();
    }
    return 0;
  }

  function getAvailableQuests(npcId) {
    var currentAct = _getCurrentActIndex();
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var state = questState[id];
      if (!state || state.status !== 'available') return false;
      if (def.npcId !== npcId) return false;
      // Check act requirement
      if (typeof def.requiredAct === 'number' && currentAct < def.requiredAct) return false;
      // Check prerequisites
      if (Array.isArray(def.prerequisites) && def.prerequisites.length > 0) {
        for (var i = 0; i < def.prerequisites.length; i++) {
          var preState = questState[def.prerequisites[i]];
          if (!preState || preState.status !== 'completed') return false;
        }
      }
      return true;
    }).map(function (id) { return QUEST_DEFINITIONS[id]; });
  }

  function getActiveQuests(npcId) {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active') return false;
      if (npcId && QUEST_DEFINITIONS[id].npcId !== npcId) return false;
      return true;
    }).map(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var objectives = questState[id].objectives || def.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: o.required };
      });
      return Object.assign({}, def, { objectives: objectives, status: 'active' });
    });
  }

  function getCompletedQuests(npcId) {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'completed') return false;
      if (npcId && QUEST_DEFINITIONS[id].npcId !== npcId) return false;
      return true;
    }).map(function (id) { return QUEST_DEFINITIONS[id]; });
  }

  /**
   * Move a quest from 'available' to 'active' state and initialise its objectives.
   * Auto-completes dialogue-type quests immediately. Fires onQuestUpdate listeners.
   * @param {string} questId
   * @returns {boolean} true if state actually changed, false on unknown id or wrong state
   */
  function acceptQuest(questId) {
    var def = QUEST_DEFINITIONS[questId];
    if (!def) return false;
    var state = questState[questId];
    if (!state || state.status !== 'available') return false;

    questState[questId] = {
      status: 'active',
      objectives: def.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: 0, required: o.required };
      })
    };

    // Auto-complete dialogue quests immediately upon acceptance
    if (def.type === 'dialogue') {
      questState[questId].objectives.forEach(function (obj) {
        obj.current = obj.required;
      });
      console.log('[QuestSystem] Auto-completed dialogue quest:', questId);
    }

    console.log('[QuestSystem] Accepted quest:', questId);
    _notifyUpdate();
    return true;
  }

  /**
   * Increment progress on every active quest objective whose (type, target)
   * tuple matches. Used for kill/explore/collect/dialogue progress events.
   * @param {string} type   Objective type — 'kill' | 'explore' | 'collect' | 'dialogue' | 'boss_kill' | ...
   * @param {string} target Objective target — 'enemy' | 'room' | 'item:foo' | a boss key | ...
   * @param {number} [amount=1] How much to increment (clamped at obj.required)
   * @returns {boolean} true if any objective changed (and listeners were notified)
   */
  function updateQuestProgress(type, target, amount) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      state.objectives.forEach(function (obj) {
        if (obj.type === type && obj.target === target && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + (amount || 1));
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
    }
    return changed;
  }

  /**
   * Called when a wave is completed. Updates wave-type objectives
   * and dungeon_run objectives.
   */
  function onWaveCompleted(waveNumber) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      state.objectives.forEach(function (obj) {
        // Wave reach objectives: set current to highest wave reached
        if (obj.type === 'wave' && obj.target === 'reach_wave') {
          if (waveNumber > obj.current) {
            obj.current = Math.min(obj.required, waveNumber);
            changed = true;
          }
        }
        // Dungeon run completion: each wave completion past wave 1 counts as a run
        if (obj.type === 'dungeon_run' && obj.target === 'dungeon_complete' && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + 1);
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
    }
    return changed;
  }

  /**
   * Called when a boss is killed. Updates boss_kill objectives.
   * @param {string} bossType - e.g. 'kettenmeister', 'schattenrat'
   */
  function onBossKilled(bossType) {
    var changed = false;
    Object.keys(questState).forEach(function (id) {
      var state = questState[id];
      if (!state || state.status !== 'active' || !state.objectives) return;
      state.objectives.forEach(function (obj) {
        if (obj.type === 'boss_kill' && obj.target === bossType && obj.current < obj.required) {
          obj.current = Math.min(obj.required, obj.current + 1);
          changed = true;
        }
      });
    });
    if (changed) {
      _notifyUpdate();
    }
    return changed;
  }

  /**
   * Called when an item is crafted. Updates craft-type objectives.
   */
  function onItemCrafted() {
    return updateQuestProgress('craft', 'craft_item', 1);
  }

  /**
   * Check if all quest chains for all NPCs are completed.
   */
  function areAllQuestChainsComplete() {
    var chainEnders = ['final_truth'];
    return chainEnders.every(function (id) {
      var state = questState[id];
      return state && state.status === 'completed';
    });
  }

  function isQuestReadyToComplete(questId) {
    var state = questState[questId];
    if (!state || state.status !== 'active' || !state.objectives) return false;
    return state.objectives.every(function (obj) { return obj.current >= obj.required; });
  }

  function completeQuest(questId) {
    if (!isQuestReadyToComplete(questId)) return false;
    var def = QUEST_DEFINITIONS[questId];
    if (!def) return false;

    questState[questId].status = 'completed';

    // Grant rewards
    var rewards = def.rewards;
    if (rewards.xp) {
      window.playerXP = (window.playerXP || 0) + rewards.xp;
      if (typeof playerXP !== 'undefined') playerXP = window.playerXP;
      console.log('[QuestSystem] Granted ' + rewards.xp + ' XP');
      if (typeof updateHUD === 'function') updateHUD();
    }
    if (rewards.materials) {
      Object.keys(rewards.materials).forEach(function (key) {
        if (typeof changeMaterialCount === 'function') {
          changeMaterialCount(key, rewards.materials[key]);
          console.log('[QuestSystem] Granted ' + rewards.materials[key] + ' ' + key);
        } else if (typeof materialCounts !== 'undefined') {
          materialCounts[key] = (materialCounts[key] || 0) + rewards.materials[key];
          console.log('[QuestSystem] Granted ' + rewards.materials[key] + ' ' + key);
        }
      });
    }
    if (rewards.items && Array.isArray(rewards.items)) {
      rewards.items.forEach(function (item) {
        if (typeof inventory !== 'undefined' && Array.isArray(inventory)) {
          var idx = inventory.findIndex(function (slot) { return !slot; });
          if (idx >= 0) inventory[idx] = Object.assign({}, item);
          else inventory[0] = Object.assign({}, item);
          if (typeof refreshInventoryUI === 'function') refreshInventoryUI();
        }
      });
    }
    if (rewards.unlocks && Array.isArray(rewards.unlocks)) {
      rewards.unlocks.forEach(function (unlock) {
        if (!window._questUnlocks) window._questUnlocks = {};
        window._questUnlocks[unlock] = true;
        console.log('[QuestSystem] Unlocked:', unlock);
        // Apply XP bonus immediately if applicable
        if (unlock === 'xp_bonus_10') {
          window._questXpBonus = (window._questXpBonus || 0) + 0.10;
          console.log('[QuestSystem] XP bonus now:', window._questXpBonus);
        }
      });
    }

    console.log('[QuestSystem] Completed quest:', questId);
    if (window.AbilitySystem && typeof window.AbilitySystem.onQuestCompleted === 'function') {
      window.AbilitySystem.onQuestCompleted(questId);
    }
    _notifyUpdate();
    return true;
  }

  // ---- Persistence ----

  function getQuestSaveData() {
    return JSON.parse(JSON.stringify(questState));
  }

  function loadQuestSaveData(data) {
    if (!data || typeof data !== 'object') return;
    _initQuestState();
    Object.keys(data).forEach(function (id) {
      if (questState[id]) {
        // Load known quests from save
        questState[id] = data[id];
      }
      // Old quest IDs from previous saves are silently ignored,
      // preserving backward compatibility
    });
    _notifyUpdate();
  }

  // ---- HUD Update Notification ----
  var _updateListeners = [];

  function onQuestUpdate(fn) {
    _updateListeners.push(fn);
  }

  function offQuestUpdate(fn) {
    _updateListeners = _updateListeners.filter(function (f) { return f !== fn; });
  }

  function _notifyUpdate() {
    var active = getActiveQuests();
    _updateListeners.forEach(function (fn) {
      try { fn(active); } catch (e) { console.warn('[QuestSystem] listener error', e); }
    });
  }

  // ---- Quest Tracker HUD helpers ----

  function getTrackerText() {
    var active = getActiveQuests();
    if (!active.length) return '';
    var suffix = (window.i18n ? window.i18n.t('quest.tracker.short_suffix') : '..');
    var lines = [];
    active.forEach(function (q) {
      var fullTitle = getQuestField(q, 'title');
      var shortName = fullTitle.length > 16 ? fullTitle.substring(0, 14) + suffix : fullTitle;
      q.objectives.forEach(function (obj) {
        if (window.i18n) {
          lines.push(window.i18n.t('quest.tracker.progress', {
            title: shortName, cur: obj.current, required: obj.required
          }));
        } else {
          lines.push(shortName + ': ' + obj.current + '/' + obj.required);
        }
      });
    });
    return lines.join('\n');
  }

  // ---- Export ----
  var questSystem = {
    QUEST_DEFINITIONS: QUEST_DEFINITIONS,
    getAvailableQuests: getAvailableQuests,
    getActiveQuests: getActiveQuests,
    getCompletedQuests: getCompletedQuests,
    acceptQuest: acceptQuest,
    updateQuestProgress: updateQuestProgress,
    onWaveCompleted: onWaveCompleted,
    onBossKilled: onBossKilled,
    onItemCrafted: onItemCrafted,
    areAllQuestChainsComplete: areAllQuestChainsComplete,
    isQuestReadyToComplete: isQuestReadyToComplete,
    completeQuest: completeQuest,
    getQuestSaveData: getQuestSaveData,
    loadQuestSaveData: loadQuestSaveData,
    onQuestUpdate: onQuestUpdate,
    offQuestUpdate: offQuestUpdate,
    getTrackerText: getTrackerText,
    getQuestField: getQuestField,
    getQuestTitle: function (q) { return getQuestField(q, 'title'); },
    getQuestDescription: function (q) { return getQuestField(q, 'description'); },
    getQuestDialogue: function (q, phase) {
      var key = 'dialogue' + phase[0].toUpperCase() + phase.slice(1);
      return getQuestField(q, key);
    }
  };

  // Re-render living quest tracker on language change.
  if (window.i18n) {
    window.i18n.onChange(function () {
      _notifyUpdate();
    });
  }

  window.questSystem = questSystem;
})();
