// js/abilitySystem.js — Ability Loadout & Learning System
// ---------------------------------------------------------
// Manages which abilities the player has LEARNED and which 4 are
// currently EQUIPPED (active loadout). Active slots map to keys
// Q (slot1), E (slot2), R (slot3), F (slot4). Basic attack stays
// on click / SPACE and is NOT part of the loadout.
//
// Save format (localStorage key: demonfall_abilities_v1):
//   {
//     learnedAbilities: ['spinAttack', 'chargeSlash', ...],
//     activeLoadout:    { slot1: 'spinAttack', slot2: 'chargeSlash', ... },
//     enemyKills:       42
//   }
// ---------------------------------------------------------

(function () {
  const STORAGE_KEY = 'demonfall_abilities_v1';

  // ---------- Ability Definitions ----------
  // type: 'tap'    -> single keydown trigger
  //       'charge' -> begin on keydown, release on keyup
  //       'self'   -> tap, but no scene-target (utility/buff)
  const ABILITY_DEFS = {
    spinAttack: {
      id: 'spinAttack',
      name: 'Wirbelangriff',
      description: 'AoE-Wirbelschlag um den Spieler.',
      type: 'tap',
      icon: '\u{1F300}',
      color: 0x00ffff,
      activate(scene) {
        if (typeof window.spinAttack === 'function') {
          window.spinAttack.call(scene);
        }
      }
    },
    chargeSlash: {
      id: 'chargeSlash',
      name: 'Aufgeladener Schlag',
      description: 'Halten zum Aufladen, loslassen f\u00FCr m\u00E4chtigen Hieb.',
      type: 'charge',
      icon: '\u26A1',
      color: 0xffaa00,
      onPress(scene) {
        if (typeof window.beginChargedSlash === 'function') {
          window.beginChargedSlash.call(scene);
        }
      },
      onRelease(scene) {
        if (typeof window.releaseChargedSlash === 'function') {
          window.releaseChargedSlash.call(scene);
        }
      }
    },
    dashSlash: {
      id: 'dashSlash',
      name: 'Sturmhieb',
      description: 'Schneller Vorw\u00E4rts-Dash mit Schaden.',
      type: 'tap',
      icon: '\u27A1',
      color: 0x66ccff,
      activate(scene) {
        if (typeof window.dashSlash === 'function') {
          window.dashSlash.call(scene);
        }
      }
    },
    daggerThrow: {
      id: 'daggerThrow',
      name: 'Dolchwurf',
      description: 'Wirft einen Dolch in Blickrichtung.',
      type: 'tap',
      icon: '\u{1F5E1}',
      color: 0xff8800,
      activate(scene) {
        if (typeof window.throwDagger === 'function') {
          window.throwDagger.call(scene);
        }
      }
    },
    shieldBash: {
      id: 'shieldBash',
      name: 'Schildsto\u00DF',
      description: 'Bet\u00E4ubt nahe Gegner.',
      type: 'tap',
      icon: '\u{1F6E1}',
      color: 0x66ffaa,
      activate(scene) {
        if (typeof window.shieldBash === 'function') {
          window.shieldBash.call(scene);
        }
      }
    },

    // ---- New abilities (placeholder implementations) ----
    heilwunde: {
      id: 'heilwunde',
      name: 'Heilwunde',
      description: 'Heilt 5 LP. Abklingzeit: 30s.',
      type: 'self',
      icon: '\u271A',
      color: 0x66ff66,
      cooldownMs: 30000,
      activate(scene) {
        console.log('[Abilities] Heilwunde aktiviert');
        try {
          const max = (typeof playerMaxHealth !== 'undefined') ? playerMaxHealth : 30;
          const cur = (typeof playerHealth !== 'undefined') ? playerHealth : max;
          const next = Math.min(max, cur + 5);
          if (typeof setPlayerHealth === 'function') {
            setPlayerHealth(next);
          } else if (typeof playerHealth !== 'undefined') {
            playerHealth = next;
          }
          if (typeof updateHUD === 'function') updateHUD();
        } catch (err) {
          console.warn('[Abilities] Heilwunde failed', err);
        }
      }
    },
    frostnova: {
      id: 'frostnova',
      name: 'Frostnova',
      description: 'AoE um den Spieler, verlangsamt alle Gegner in der N\u00E4he.',
      type: 'self',
      icon: '\u2744',
      color: 0x88ddff,
      cooldownMs: 12000,
      activate(scene) {
        console.log('[Abilities] Frostnova aktiviert (Platzhalter)');
        try {
          if (window.statusEffectManager && window.StatusEffectType
              && typeof enemies !== 'undefined' && enemies?.children && typeof player !== 'undefined') {
            const range = 160;
            enemies.children.iterate((enemy) => {
              if (!enemy || !enemy.active) return;
              const dx = enemy.x - player.x;
              const dy = enemy.y - player.y;
              if (Math.hypot(dx, dy) <= range) {
                window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.SLOW, 'frostnova');
              }
            });
          }
        } catch (err) {
          console.warn('[Abilities] Frostnova failed', err);
        }
      }
    },
    blutopfer: {
      id: 'blutopfer',
      name: 'Blutopfer',
      description: 'Opfert 5 LP f\u00FCr 50% Schadensbonus (10s).',
      type: 'self',
      icon: '\u{1FA78}',
      color: 0xff3366,
      cooldownMs: 25000,
      activate(scene) {
        console.log('[Abilities] Blutopfer aktiviert (Platzhalter)');
        try {
          if (typeof setPlayerHealth === 'function' && typeof playerHealth !== 'undefined') {
            setPlayerHealth(Math.max(1, playerHealth - 5));
          }
          window._blutopferActive = true;
          window._blutopferUntil = (scene?.time?.now || Date.now()) + 10000;
          if (scene?.time?.delayedCall) {
            scene.time.delayedCall(10000, () => {
              window._blutopferActive = false;
            });
          }
        } catch (err) {
          console.warn('[Abilities] Blutopfer failed', err);
        }
      }
    },
    schattenschritt: {
      id: 'schattenschritt',
      name: 'Schattenschritt',
      description: 'Kurze Unverwundbarkeit + Tempobonus (3s).',
      type: 'self',
      icon: '\u{1F47B}',
      color: 0x9966ff,
      cooldownMs: 18000,
      activate(scene) {
        console.log('[Abilities] Schattenschritt aktiviert (Platzhalter)');
        try {
          window._shadowStepActive = true;
          window._shadowStepUntil = (scene?.time?.now || Date.now()) + 3000;
          if (typeof player !== 'undefined' && player?.setAlpha) {
            player.setAlpha(0.5);
          }
          if (scene?.time?.delayedCall) {
            scene.time.delayedCall(3000, () => {
              window._shadowStepActive = false;
              if (typeof player !== 'undefined' && player?.setAlpha) {
                player.setAlpha(1);
              }
            });
          }
        } catch (err) {
          console.warn('[Abilities] Schattenschritt failed', err);
        }
      }
    }
  };

  // ---------- Unlock Conditions ----------
  // Each ability has an unlock entry. abilities not listed here are
  // unlocked by default at game start.
  const UNLOCK_RULES = {
    spinAttack:      { type: 'kills',         value: 5,                  hint: 'Besiege 5 Gegner' },
    chargeSlash:     { type: 'kills',         value: 15,                 hint: 'Besiege 15 Gegner' },
    dashSlash:       { type: 'kills',         value: 25,                 hint: 'Besiege 25 Gegner' },
    daggerThrow:     { type: 'wave',          value: 3,                  hint: 'Erreiche Welle 3' },
    shieldBash:      { type: 'kills',         value: 50,                 hint: 'Besiege 50 Gegner' },
    heilwunde:       { type: 'quest',         value: 'branka_documents', hint: 'Schlie\u00DFe Brankas Dokumenten-Quest ab' },
    frostnova:       { type: 'boss',          value: 'chainMaster',      hint: 'Besiege den Kettenmeister' },
    blutopfer:       { type: 'wave',          value: 15,                 hint: 'Erreiche Welle 15' },
    schattenschritt: { type: 'boss',          value: 'shadowCouncillor', hint: 'Besiege den Schattenrat' }
  };

  // No abilities learned by default — only basic attack (space) is always available.
  // Player must learn skills through gameplay (kills, quests, bosses).
  const DEFAULT_LEARNED = [];

  const DEFAULT_LOADOUT = {
    slot1: null,
    slot2: null,
    slot3: null,
    slot4: null
  };

  const SLOT_KEYS = ['slot1', 'slot2', 'slot3', 'slot4'];
  const SLOT_KEY_LABELS = { slot1: 'Q', slot2: 'E', slot3: 'R', slot4: 'F' };

  // ---------- State ----------
  const state = {
    learnedAbilities: DEFAULT_LEARNED.slice(),
    activeLoadout: Object.assign({}, DEFAULT_LOADOUT),
    enemyKills: 0,
    cooldowns: {} // abilityId -> timestamp ms when ready again
  };

  // ---------- Persistence ----------
  function save() {
    try {
      const payload = {
        learnedAbilities: state.learnedAbilities.slice(),
        activeLoadout: Object.assign({}, state.activeLoadout),
        enemyKills: state.enemyKills | 0
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[AbilitySystem] save failed', err);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.learnedAbilities = DEFAULT_LEARNED.slice();
        state.activeLoadout = Object.assign({}, DEFAULT_LOADOUT);
        state.enemyKills = 0;
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.learnedAbilities)) {
        state.learnedAbilities = parsed.learnedAbilities.filter((id) => !!ABILITY_DEFS[id]);
      }
      // Always make sure defaults are learned
      DEFAULT_LEARNED.forEach((id) => {
        if (!state.learnedAbilities.includes(id)) state.learnedAbilities.push(id);
      });
      if (parsed.activeLoadout && typeof parsed.activeLoadout === 'object') {
        SLOT_KEYS.forEach((slot) => {
          const id = parsed.activeLoadout[slot];
          if (id && ABILITY_DEFS[id] && state.learnedAbilities.includes(id)) {
            state.activeLoadout[slot] = id;
          } else {
            state.activeLoadout[slot] = DEFAULT_LOADOUT[slot];
          }
        });
      }
      state.enemyKills = parsed.enemyKills | 0;
    } catch (err) {
      console.warn('[AbilitySystem] load failed', err);
      state.learnedAbilities = DEFAULT_LEARNED.slice();
      state.activeLoadout = Object.assign({}, DEFAULT_LOADOUT);
    }
  }

  // ---------- Public API ----------
  function getAbilityDef(id) {
    return ABILITY_DEFS[id] || null;
  }

  function getAllAbilityDefs() {
    return Object.values(ABILITY_DEFS);
  }

  function getLearnedAbilities() {
    return state.learnedAbilities.slice();
  }

  function isLearned(id) {
    return state.learnedAbilities.includes(id);
  }

  function getActiveLoadout() {
    return Object.assign({}, state.activeLoadout);
  }

  function isEquipped(id) {
    return SLOT_KEYS.some((slot) => state.activeLoadout[slot] === id);
  }

  function getSlotForAbility(id) {
    return SLOT_KEYS.find((slot) => state.activeLoadout[slot] === id) || null;
  }

  function setSlot(slot, abilityId) {
    if (!SLOT_KEYS.includes(slot)) return false;
    if (abilityId !== null && !ABILITY_DEFS[abilityId]) return false;
    if (abilityId !== null && !isLearned(abilityId)) return false;

    // If ability already equipped in another slot, swap them.
    if (abilityId) {
      const existingSlot = getSlotForAbility(abilityId);
      if (existingSlot && existingSlot !== slot) {
        state.activeLoadout[existingSlot] = state.activeLoadout[slot] || null;
      }
    }
    state.activeLoadout[slot] = abilityId;
    save();
    return true;
  }

  function learnAbility(id, opts = {}) {
    if (!ABILITY_DEFS[id]) return false;
    if (state.learnedAbilities.includes(id)) return false;
    state.learnedAbilities.push(id);
    save();
    if (!opts.silent) {
      console.log('[AbilitySystem] Neue F\u00E4higkeit erlernt:', ABILITY_DEFS[id].name);
      _showLearnToast(ABILITY_DEFS[id].name);
    }
    return true;
  }

  function _showLearnToast(name) {
    try {
      const scene = window.gameScene || (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.find((s) => s && s.sys && s.sys.isActive()));
      if (!scene || !scene.add) return;
      const cam = scene.cameras?.main;
      const cw = cam ? cam.width : 800;
      const text = scene.add.text(cw / 2, 80, 'Neue F\u00E4higkeit: ' + name, {
        fontFamily: 'serif',
        fontSize: 22,
        color: '#ffe28a',
        backgroundColor: '#000000',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
      scene.tweens.add({
        targets: text,
        alpha: 0,
        delay: 2200,
        duration: 600,
        onComplete: () => text.destroy()
      });
    } catch (err) {
      // non-fatal
    }
  }

  // ---------- Input Routing ----------
  // Called by main.js for Q/E/R/F press / release events.
  function tryActivate(slot, scene) {
    const abilityId = state.activeLoadout[slot];
    if (!abilityId) return false;
    const def = ABILITY_DEFS[abilityId];
    if (!def) return false;
    if (!isLearned(abilityId)) return false;

    // Per-ability cooldowns (only enforced for "self" type abilities).
    if (def.cooldownMs) {
      const now = (scene?.time?.now) || Date.now();
      const ready = state.cooldowns[abilityId] || 0;
      if (now < ready) return false;
      state.cooldowns[abilityId] = now + def.cooldownMs;
    }

    if (def.type === 'charge' && typeof def.onPress === 'function') {
      def.onPress(scene);
      return true;
    }
    if (typeof def.activate === 'function') {
      def.activate(scene);
      return true;
    }
    return false;
  }

  function tryRelease(slot, scene) {
    const abilityId = state.activeLoadout[slot];
    if (!abilityId) return false;
    const def = ABILITY_DEFS[abilityId];
    if (!def || def.type !== 'charge') return false;
    if (typeof def.onRelease === 'function') {
      def.onRelease(scene);
      return true;
    }
    return false;
  }

  // ---------- Unlock Hooks ----------
  function _checkUnlocks(triggerType, value) {
    Object.keys(UNLOCK_RULES).forEach((id) => {
      if (state.learnedAbilities.includes(id)) return;
      const rule = UNLOCK_RULES[id];
      if (!rule) return;
      let matches = false;
      switch (rule.type) {
        case 'kills':
          if (triggerType === 'kills' && state.enemyKills >= rule.value) matches = true;
          break;
        case 'quest':
          if (triggerType === 'quest' && value === rule.value) matches = true;
          break;
        case 'boss':
          if (triggerType === 'boss' && value === rule.value) matches = true;
          break;
        case 'wave':
          if (triggerType === 'wave' && (value | 0) >= rule.value) matches = true;
          break;
      }
      if (matches) learnAbility(id);
    });
  }

  function onEnemyKilled() {
    state.enemyKills += 1;
    save();
    _checkUnlocks('kills');
  }

  function onBossKilled(bossType) {
    _checkUnlocks('boss', bossType);
  }

  function onQuestCompleted(questId) {
    _checkUnlocks('quest', questId);
  }

  function onWaveCompleted(wave) {
    _checkUnlocks('wave', wave);
  }

  function getEnemyKills() {
    return state.enemyKills | 0;
  }

  function getUnlockRule(id) {
    return UNLOCK_RULES[id] || null;
  }

  // ---------- Bootstrap ----------
  load();

  window.AbilitySystem = {
    ABILITY_DEFS,
    UNLOCK_RULES,
    SLOT_KEYS,
    SLOT_KEY_LABELS,
    DEFAULT_LOADOUT,
    DEFAULT_LEARNED,
    save,
    load,
    getAbilityDef,
    getAllAbilityDefs,
    getLearnedAbilities,
    isLearned,
    getActiveLoadout,
    isEquipped,
    getSlotForAbility,
    setSlot,
    learnAbility,
    tryActivate,
    tryRelease,
    onEnemyKilled,
    onBossKilled,
    onQuestCompleted,
    onWaveCompleted,
    getEnemyKills,
    getUnlockRule
  };
})();
