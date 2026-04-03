// js/questSystem.js — Quest System for Demonfall

(function () {
  'use strict';

  // ---- Quest Definitions ----
  const QUEST_DEFINITIONS = {
    branka_documents: {
      id: 'branka_documents',
      title: 'Verlorene Protokolle',
      description: 'Finde 3 Protokoll-Abschriften im Rathauskeller und bringe sie zu Branka.',
      npcId: 'branka',
      type: 'fetch',
      objectives: [
        { type: 'fetch', target: 'document', current: 0, required: 3 }
      ],
      rewards: { xp: 50, materials: { MAT: 10 } },
      prerequisites: [],
      dialogueOffer: 'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir drei Abschriften, und ich veredele deine Artefakte.\n\nWillst du diese Aufgabe uebernehmen?',
      dialogueProgress: 'Hast du die Protokolle schon gefunden? Suche weiter im Rathauskeller — sie verstecken sich zwischen dem Geruempel.',
      dialogueComplete: 'Ausgezeichnet! Diese Protokolle werden uns helfen, die Wahrheit ans Licht zu bringen. Hier ist deine Belohnung.'
    },
    thom_evidence: {
      id: 'thom_evidence',
      title: 'Beweise sammeln',
      description: 'Besiege 20 Gegner im Rathauskeller, um Beweise fuer die Druckerei zu sichern.',
      npcId: 'thom',
      type: 'kill',
      objectives: [
        { type: 'kill', target: 'enemy', current: 0, required: 20 }
      ],
      rewards: { xp: 75, items: [{ type: 'weapon', key: 'THOM_REWARD', name: 'Druckerpresse-Klinge', iconKey: 'itWeapon', rarity: 'rare', rarityLabel: 'Selten', rarityValue: 2, itemLevel: 5, damage: 8, speed: 1.2, range: 100, armor: 0, crit: 0.08, hp: 0 }] },
      prerequisites: [],
      dialogueOffer: 'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll. Besiege 20 Wachen dort unten und sammle ihre Dokumente.\n\nNimmst du den Auftrag an?',
      dialogueProgress: 'Kaempfe weiter im Rathauskeller. Jeder besiegte Feind bringt uns naeher an die Wahrheit.',
      dialogueComplete: 'Hervorragend! Mit diesen Beweisen koennen wir endlich drucken, was die Buerger wissen muessen. Nimm diese Klinge als Dank.'
    },
    mara_seals: {
      id: 'mara_seals',
      title: 'Siegel brechen',
      description: 'Raeume 5 Raeume im Rathauskeller, um die Siegel des Zeremonenmeisters zu brechen.',
      npcId: 'mara',
      type: 'explore',
      objectives: [
        { type: 'explore', target: 'room', current: 0, required: 5 }
      ],
      rewards: { xp: 100, materials: { MAT: 15 } },
      prerequisites: [],
      dialogueOffer: 'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv. Raeume fuenf Raeume im Rathauskeller, um seine Siegel zu brechen.\n\nBist du bereit?',
      dialogueProgress: 'Sichere weiter Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.',
      dialogueComplete: 'Die Siegel sind gebrochen. Die Daemonen des Zeremonienmeisters verlieren ihre Macht. Hier — das hast du dir verdient.'
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

  function getAvailableQuests(npcId) {
    return Object.keys(QUEST_DEFINITIONS).filter(function (id) {
      var def = QUEST_DEFINITIONS[id];
      var state = questState[id];
      if (!state || state.status !== 'available') return false;
      if (def.npcId !== npcId) return false;
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
