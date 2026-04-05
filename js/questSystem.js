// js/questSystem.js — Quest System for Demonfall

(function () {
  'use strict';

  // ---- Quest Definitions ----
  const QUEST_DEFINITIONS = {
    // === Branka's Questline (Archivschmiede) ===
    branka_documents: {
      id: 'branka_documents',
      title: 'Verlorene Protokolle',
      description: 'Finde 3 Protokoll-Abschriften im Rathauskeller und bringe sie zu Branka.',
      npcId: 'branka',
      type: 'fetch',
      chain: 1,
      objectives: [
        { type: 'fetch', target: 'document', current: 0, required: 3 }
      ],
      rewards: { xp: 50, materials: { MAT: 10 } },
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir drei Abschriften, und ich veredele deine Artefakte.\n\nWillst du diese Aufgabe uebernehmen?',
      dialogueProgress: 'Hast du die Protokolle schon gefunden? Suche weiter im Rathauskeller — sie verstecken sich zwischen dem Geruempel.',
      dialogueComplete: 'Ausgezeichnet! Diese Protokolle werden uns helfen, die Wahrheit ans Licht zu bringen. Hier ist deine Belohnung.'
    },
    branka_seals: {
      id: 'branka_seals',
      title: 'Daemonische Siegel',
      description: 'Besiege 5 Elite-Gegner im Rathauskeller, um die daemonischen Siegel zu zerstoeren.',
      npcId: 'branka',
      type: 'kill',
      chain: 2,
      objectives: [
        { type: 'kill', target: 'elite_enemy', current: 0, required: 5 }
      ],
      rewards: { xp: 100, items: [{ type: 'weapon', key: 'SIEGELBRECHER', name: 'Siegelbrecher', iconKey: 'itWeapon', rarity: 'rare', rarityLabel: 'Selten', rarityValue: 2, itemLevel: 8, damage: 12, speed: 1.0, range: 110, armor: 0, crit: 0.10, hp: 0 }] },
      prerequisites: ['branka_documents'],
      requiredAct: 1,
      dialogueOffer: 'Die Protokolle, die du gebracht hast, enthuellen daemonische Siegel tief im Keller. Elite-Wachen beschuetzen sie.\n\nBesiege fuenf dieser Elite-Gegner, damit ich eine Waffe schmieden kann, die die Siegel bricht.',
      dialogueProgress: 'Die Elite-Wachen sind zaeh, aber nicht unbesiegbar. Kaempfe weiter — jeder Sieg bringt uns naeher an die Wahrheit.',
      dialogueComplete: 'Die Siegel fallen! Aus ihren Fragmenten habe ich den Siegelbrecher geschmiedet. Nimm ihn — er wird dir noch gute Dienste leisten.'
    },
    branka_truth: {
      id: 'branka_truth',
      title: 'Die Wahrheit der Schmiede',
      description: 'Erreiche Welle 20 im Rathauskeller und kehre zu Branka zurueck.',
      npcId: 'branka',
      type: 'wave',
      chain: 3,
      objectives: [
        { type: 'wave', target: 'reach_wave', current: 0, required: 20 }
      ],
      rewards: { xp: 200, unlocks: ['enhanced_crafting'] },
      prerequisites: ['branka_seals'],
      requiredAct: 2,
      dialogueOffer: 'Tief unter dem Rathaus, jenseits von Welle 20, liegt die alte Meisterschmiede. Dort verbergen sich die Geheimnisse der wahren Schmiedekunst.\n\nDringe vor und kehre zurueck — dann zeige ich dir Techniken, die der Rat verboten hat.',
      dialogueProgress: 'Du musst tiefer vordringen. Welle 20 — dort liegt die alte Meisterschmiede verborgen.',
      dialogueComplete: 'Du hast die alte Meisterschmiede gefunden! Mit diesem Wissen kann ich nun Waffen schmieden, die der Rat fuerchtet. Die Werkstatt ist jetzt erweitert.'
    },

    // === Thom's Questline (Druckerei) ===
    thom_evidence: {
      id: 'thom_evidence',
      title: 'Beweise sammeln',
      description: 'Besiege 20 Gegner im Rathauskeller, um Beweise fuer die Druckerei zu sichern.',
      npcId: 'thom',
      type: 'kill',
      chain: 1,
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 20 }
      ],
      rewards: { xp: 75, items: [{ type: 'weapon', key: 'THOM_REWARD', name: 'Druckerpresse-Klinge', iconKey: 'itWeapon', rarity: 'rare', rarityLabel: 'Selten', rarityValue: 2, itemLevel: 5, damage: 8, speed: 1.2, range: 100, armor: 0, crit: 0.08, hp: 0 }] },
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll. Besiege 20 Wachen dort unten und sammle ihre Dokumente.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Kaempfe weiter im Rathauskeller. Jeder besiegte Feind bringt uns naeher an die Wahrheit.',
      dialogueComplete: 'Hervorragend! Mit diesen Beweisen koennen wir endlich drucken, was die Buerger wissen muessen. Nimm diese Klinge als Dank.'
    },
    thom_plates: {
      id: 'thom_plates',
      title: 'Verbotene Druckplatten',
      description: 'Finde 5 verbotene Druckplatten in den Tiefen des Rathauskellers.',
      npcId: 'thom',
      type: 'fetch',
      chain: 2,
      objectives: [
        { type: 'fetch', target: 'print_plate', current: 0, required: 5 }
      ],
      rewards: { xp: 150, materials: { MAT: 20 } },
      prerequisites: ['thom_evidence'],
      requiredAct: 1,
      dialogueOffer: 'Die erste Ausgabe war ein Erfolg! Aber fuer die naechste brauche ich alte Druckplatten — der Rat hat sie im Keller versteckt.\n\nFinde fuenf dieser Platten, und unsere Pamphlete werden unaufhaltsam.',
      dialogueProgress: 'Die Druckplatten sind irgendwo im Rathauskeller verborgen. Suche weiter — sie leuchten schwach im Dunkeln.',
      dialogueComplete: 'Fantastisch! Diese Platten sind aus einer Zeit, als die Wahrheit noch gedruckt werden durfte. Hier ist dein Lohn.'
    },
    thom_pamphlets: {
      id: 'thom_pamphlets',
      title: 'Die Pamphlete verbreiten',
      description: 'Schliesse 3 Dungeon-Durchlaeufe ab, um die Pamphlete in der Stadt zu verbreiten.',
      npcId: 'thom',
      type: 'dungeon_runs',
      chain: 3,
      objectives: [
        { type: 'dungeon_run', target: 'dungeon_complete', current: 0, required: 3 }
      ],
      rewards: { xp: 250, unlocks: ['xp_bonus_10'] },
      prerequisites: ['thom_plates'],
      requiredAct: 2,
      dialogueOffer: 'Die Druckerpresse laeuft! Aber die Pamphlete muessen verteilt werden. Jeder Durchlauf durch den Keller ist eine Chance, sie unter den Wachen zu streuen.\n\nSchliesse drei Durchlaeufe ab, und ganz Fogreach wird die Wahrheit lesen.',
      dialogueProgress: 'Kaempfe dich weiter durch den Rathauskeller. Jeder abgeschlossene Durchlauf verbreitet unsere Botschaft.',
      dialogueComplete: 'Die ganze Stadt liest unsere Wahrheiten! Die Buerger sind aufgewacht. Als Dank erhaeltst du meinen Segen — deine Erfahrung waechst nun schneller. (+10% XP)'
    },

    // === Mara's Questline (Untergrund) ===
    mara_seals: {
      id: 'mara_seals',
      title: 'Siegel brechen',
      description: 'Raeume 5 Raeume im Rathauskeller, um die Siegel des Zeremonenmeisters zu brechen.',
      npcId: 'mara',
      type: 'explore',
      chain: 1,
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 5 }
      ],
      rewards: { xp: 100, materials: { MAT: 15 } },
      prerequisites: [],
      requiredAct: 0,
      dialogueOffer: 'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv. Raeume fuenf Raeume im Rathauskeller, um seine Siegel zu brechen.\n\nBist du bereit?',
      dialogueProgress: 'Sichere weiter Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.',
      dialogueComplete: 'Die Siegel sind gebrochen. Die Daemonen des Zeremonienmeisters verlieren ihre Macht. Hier — das hast du dir verdient.'
    },
    mara_shadow: {
      id: 'mara_shadow',
      title: 'Schattenagent',
      description: 'Besiege den Kettenmeister-Boss bei Welle 10.',
      npcId: 'mara',
      type: 'boss',
      chain: 2,
      objectives: [
        { type: 'boss_kill', target: 'kettenmeister', current: 0, required: 1 }
      ],
      rewards: { xp: 200, unlocks: ['shadow_skill'] },
      prerequisites: ['mara_seals'],
      requiredAct: 1,
      dialogueOffer: 'Meine Spaeher berichten: Der Kettenmeister selbst bewacht Welle 10. Er ist der Schluessel zum inneren Kreis des Rates.\n\nBesiege ihn, und ich oeffne dir Tueren, die bisher verschlossen waren.',
      dialogueProgress: 'Der Kettenmeister wartet bei Welle 10. Sei vorsichtig — er ist staerker als alles, was du bisher gesehen hast.',
      dialogueComplete: 'Der Kettenmeister ist gefallen! Du hast bewiesen, dass du wuerdig bist. Ich lehre dich nun die Schattenkuenste meines Netzwerks.'
    },
    mara_inner_circle: {
      id: 'mara_inner_circle',
      title: 'Der innere Kreis',
      description: 'Besiege den Schattenrat-Boss bei Welle 30, um die Wahrheit aufzudecken.',
      npcId: 'mara',
      type: 'boss',
      chain: 3,
      objectives: [
        { type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }
      ],
      rewards: { xp: 500, unlocks: ['story_ending'] },
      prerequisites: ['mara_shadow'],
      requiredAct: 2,
      dialogueOffer: 'Der Schattenrat — der wahre Herrscher von Fogreach — verbirgt sich bei Welle 30. Er ist die letzte Kette, die diese Stadt fesselt.\n\nBesiege ihn, und die Wahrheit wird endlich frei.',
      dialogueProgress: 'Der Schattenrat wartet in der Tiefe bei Welle 30. Bereite dich gut vor — dies ist der finale Kampf.',
      dialogueComplete: 'Der Schattenrat ist vernichtet! Die Ketten von Fogreach sind gebrochen. Du hast die Stadt befreit.'
    }
  };

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
    console.log('[QuestSystem] Accepted quest:', questId);
    _notifyUpdate();
    return true;
  }

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
   * Check if all quest chains for all NPCs are completed.
   */
  function areAllQuestChainsComplete() {
    var chainEnders = ['branka_truth', 'thom_pamphlets', 'mara_inner_circle'];
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
        questState[id] = data[id];
      }
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
    var lines = [];
    active.forEach(function (q) {
      q.objectives.forEach(function (obj) {
        var shortName = q.title.length > 16 ? q.title.substring(0, 14) + '..' : q.title;
        lines.push(shortName + ': ' + obj.current + '/' + obj.required);
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
    areAllQuestChainsComplete: areAllQuestChainsComplete,
    isQuestReadyToComplete: isQuestReadyToComplete,
    completeQuest: completeQuest,
    getQuestSaveData: getQuestSaveData,
    loadQuestSaveData: loadQuestSaveData,
    onQuestUpdate: onQuestUpdate,
    offQuestUpdate: offQuestUpdate,
    getTrackerText: getTrackerText
  };

  window.questSystem = questSystem;
})();
