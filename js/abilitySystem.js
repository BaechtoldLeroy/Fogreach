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

  // ---------- i18n bootstrap ----------
  // Auto-register German strings for all abilities + unlock hints, then convert
  // each def.name / def.description / unlockRule.hint into a getter so existing
  // consumers (loadoutOverlay tooltip, HUD slot tiles) automatically see the
  // active language without code changes.
  if (window.i18n) {
    var _autoDe = {};
    Object.keys(ABILITY_DEFS).forEach(function (id) {
      var d = ABILITY_DEFS[id];
      if (typeof d.name === 'string') _autoDe['ability.' + id + '.name'] = d.name;
      if (typeof d.description === 'string') _autoDe['ability.' + id + '.description'] = d.description;
    });
    Object.keys(UNLOCK_RULES).forEach(function (id) {
      var r = UNLOCK_RULES[id];
      if (r && typeof r.hint === 'string') _autoDe['ability.' + id + '.unlock_hint'] = r.hint;
    });
    window.i18n.register('de', _autoDe);

    window.i18n.register('en', {
      'ability.spinAttack.name': 'Spin Attack',
      'ability.spinAttack.description': 'AoE spin strike around the player.',
      'ability.spinAttack.unlock_hint': 'Defeat 5 enemies',
      'ability.chargeSlash.name': 'Charged Slash',
      'ability.chargeSlash.description': 'Hold to charge, release for a mighty strike.',
      'ability.chargeSlash.unlock_hint': 'Defeat 15 enemies',
      'ability.dashSlash.name': 'Dash Slash',
      'ability.dashSlash.description': 'Quick forward dash dealing damage.',
      'ability.dashSlash.unlock_hint': 'Defeat 25 enemies',
      'ability.daggerThrow.name': 'Dagger Throw',
      'ability.daggerThrow.description': 'Throws a dagger in the facing direction.',
      'ability.daggerThrow.unlock_hint': 'Reach wave 3',
      'ability.shieldBash.name': 'Shield Bash',
      'ability.shieldBash.description': 'Stuns nearby enemies.',
      'ability.shieldBash.unlock_hint': 'Defeat 50 enemies',
      'ability.heilwunde.name': 'Heal Wound',
      'ability.heilwunde.description': 'Heals 5 HP. Cooldown: 30s.',
      'ability.heilwunde.unlock_hint': "Complete Branka's documents quest",
      'ability.frostnova.name': 'Frost Nova',
      'ability.frostnova.description': 'AoE around the player, slows all nearby enemies.',
      'ability.frostnova.unlock_hint': 'Defeat the Chainmaster',
      'ability.blutopfer.name': 'Blood Sacrifice',
      'ability.blutopfer.description': 'Sacrifice 5 HP for +50% damage (10s).',
      'ability.blutopfer.unlock_hint': 'Reach wave 15',
      'ability.schattenschritt.name': 'Shadow Step',
      'ability.schattenschritt.description': 'Brief invulnerability + speed bonus (3s).',
      'ability.schattenschritt.unlock_hint': 'Defeat the Shadow Council'
    });

    // Convert existing value-properties into getters so reads always honor the
    // active language. NOTE: assigns to non-frozen plain literals, safe.
    Object.keys(ABILITY_DEFS).forEach(function (id) {
      var d = ABILITY_DEFS[id];
      var nameKey = 'ability.' + id + '.name';
      var descKey = 'ability.' + id + '.description';
      try {
        Object.defineProperty(d, 'name', {
          get: function () {
            var v = window.i18n.t(nameKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : id;
          },
          configurable: true, enumerable: true
        });
        Object.defineProperty(d, 'description', {
          get: function () {
            var v = window.i18n.t(descKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : '';
          },
          configurable: true, enumerable: true
        });
      } catch (e) { /* swallow */ }
    });
    Object.keys(UNLOCK_RULES).forEach(function (id) {
      var r = UNLOCK_RULES[id];
      var hintKey = 'ability.' + id + '.unlock_hint';
      try {
        Object.defineProperty(r, 'hint', {
          get: function () {
            var v = window.i18n.t(hintKey);
            return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : '';
          },
          configurable: true, enumerable: true
        });
      } catch (e) { /* swallow */ }
    });
  }

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
  const SLOT_KEY_LABELS = { slot1: 'Q', slot2: 'W', slot3: 'E', slot4: 'R' };

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
  /**
   * @typedef {Object} AbilityDef
   * @property {string} id           Stable identifier (e.g. "spinAttack")
   * @property {string} name         Human-readable name shown in UI
   * @property {string} description  One-line description for tooltips
   * @property {string} icon         Single-character emoji icon
   * @property {number} color        Hex color used for UI accents
   * @property {number} [cooldownMs] Per-ability cooldown in ms (optional)
   */

  /**
   * @typedef {('slot1'|'slot2'|'slot3'|'slot4')} SlotKey
   * @typedef {Object<SlotKey, string|null>} ActiveLoadout
   */

  /** @param {string} id @returns {AbilityDef|null} */
  function getAbilityDef(id) {
    return ABILITY_DEFS[id] || null;
  }

  /** @returns {AbilityDef[]} */
  function getAllAbilityDefs() {
    return Object.values(ABILITY_DEFS);
  }

  /** @returns {string[]} A defensive copy of the learned-ability id list. */
  function getLearnedAbilities() {
    return state.learnedAbilities.slice();
  }

  /** @param {string} id @returns {boolean} */
  function isLearned(id) {
    return state.learnedAbilities.includes(id);
  }

  /** @returns {ActiveLoadout} A defensive copy of the equipped loadout. */
  function getActiveLoadout() {
    return Object.assign({}, state.activeLoadout);
  }

  /** @param {string} id @returns {boolean} */
  function isEquipped(id) {
    return SLOT_KEYS.some((slot) => state.activeLoadout[slot] === id);
  }

  /** @param {string} id @returns {SlotKey|null} */
  function getSlotForAbility(id) {
    return SLOT_KEYS.find((slot) => state.activeLoadout[slot] === id) || null;
  }

  /**
   * Equip an ability into a slot. Auto-swaps if the ability is already
   * equipped elsewhere. Pass null to clear the slot.
   * @param {SlotKey} slot
   * @param {string|null} abilityId
   * @returns {boolean} false if invalid slot/id or ability not learned
   */
  function setSlot(slot, abilityId) {
    if (!SLOT_KEYS.includes(slot)) return false;
    if (abilityId !== null && !ABILITY_DEFS[abilityId]) return false;
    if (abilityId !== null && !isLearned(abilityId)) return false;

    if (abilityId) {
      const existingSlot = getSlotForAbility(abilityId);
      if (existingSlot && existingSlot !== slot) {
        state.activeLoadout[existingSlot] = state.activeLoadout[slot] || null;
      }
    }
    state.activeLoadout[slot] = abilityId;
    save();
    if (typeof window._refreshAbilityHUD === 'function') window._refreshAbilityHUD();
    return true;
  }

  /**
   * Mark an ability as learned. Idempotent — calling twice with the same id
   * is a no-op (returns false).
   * @param {string} id
   * @param {{silent?: boolean}} [opts] silent suppresses the unlock toast
   * @returns {boolean} true on first successful learn, false on duplicate or unknown id
   */
  function learnAbility(id, opts = {}) {
    if (!ABILITY_DEFS[id]) return false;
    if (state.learnedAbilities.includes(id)) return false;
    state.learnedAbilities.push(id);
    save();
    if (!opts.silent) {
      console.log('[AbilitySystem] Neue F\u00E4higkeit erlernt:', ABILITY_DEFS[id].name);
      _showLearnToast(ABILITY_DEFS[id].name);
    }
    // Tutorial: signal that the player learned a skill so the deferred
    // skill-loadout / skill-use tutorial steps can activate. Fires AFTER
    // persistence so a tutorial replay sees the same state.
    try { console.log('[AbilitySystem] dispatching ability.learned to TutorialSystem; TS present?', !!window.TutorialSystem, 'id=', id); } catch (_) {}
    if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
      try {
        window.TutorialSystem.report('ability.learned', { abilityId: id });
      } catch (e) {
        try { console.warn('[AbilitySystem] TutorialSystem.report threw', e); } catch (_) {}
      }
    } else {
      try { console.warn('[AbilitySystem] TutorialSystem not available — ability.learned NOT emitted'); } catch (_) {}
    }
    return true;
  }

  function _showLearnToast(name) {
    try {
      const scene = window.gameScene || (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.find((s) => s && s.sys && s.sys.isActive()));
      if (!scene || !scene.add) return;

      // Pause gameplay so the player can read the unlock notification.
      // We pause physics + freeze player velocity. Tweens stay active so the
      // toast can animate in and out cleanly.
      const wasPhysicsRunning = !!(scene.physics && scene.physics.world && !scene.physics.world.isPaused);
      if (scene.physics && scene.physics.pause) {
        scene.physics.pause();
      }
      if (window.player && window.player.body && window.player.body.setVelocity) {
        window.player.body.setVelocity(0, 0);
      }

      // Find ability def to get icon + description
      let def = null;
      for (const id in ABILITY_DEFS) {
        if (ABILITY_DEFS[id].name === name) { def = ABILITY_DEFS[id]; break; }
      }

      const cam = scene.cameras?.main;
      const cw = cam ? cam.width : 800;
      const ch = cam ? cam.height : 600;

      const panelW = 480, panelH = 140;
      const cx = cw / 2, cy = 100;

      const container = scene.add.container(cx, cy).setScrollFactor(0).setDepth(9999);

      // Background panel
      const bg = scene.add.graphics();
      bg.fillStyle(0x0a0a14, 0.95).fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
      bg.lineStyle(3, 0xffd166, 1).strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
      container.add(bg);

      // Header
      const header = scene.add.text(0, -panelH / 2 + 14, 'NEUE F\u00C4HIGKEIT ERLERNT', {
        fontFamily: 'serif',
        fontSize: 14,
        color: '#ffd166',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      container.add(header);

      // Icon (left side)
      if (def && def.icon) {
        const iconBg = scene.add.graphics();
        iconBg.fillStyle(0x1a2238, 0.9).fillRoundedRect(-panelW / 2 + 16, -panelH / 2 + 38, 64, 64, 8);
        iconBg.lineStyle(2, def.color || 0xffd166, 0.9).strokeRoundedRect(-panelW / 2 + 16, -panelH / 2 + 38, 64, 64, 8);
        container.add(iconBg);

        const icon = scene.add.text(-panelW / 2 + 48, -panelH / 2 + 70, def.icon, {
          fontFamily: 'serif',
          fontSize: 36,
          color: '#ffffff',
        }).setOrigin(0.5);
        container.add(icon);
      }

      // Name
      const nameText = scene.add.text(-panelW / 2 + 96, -panelH / 2 + 38, name, {
        fontFamily: 'serif',
        fontSize: 22,
        color: '#ffe28a',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
      container.add(nameText);

      // Description
      const descText = scene.add.text(-panelW / 2 + 96, -panelH / 2 + 66, def?.description || '', {
        fontFamily: 'monospace',
        fontSize: 12,
        color: '#c8d8ff',
        wordWrap: { width: panelW - 120 },
      }).setOrigin(0, 0);
      container.add(descText);

      // Footer hint — now also tells the player how to dismiss the panel
      const footer = scene.add.text(0, panelH / 2 - 14, '[Leertaste / Klick] fortfahren  -  [K] Loadout', {
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#88aaff',
      }).setOrigin(0.5, 1);
      container.add(footer);

      // Animate in
      container.setAlpha(0).setScale(0.85);
      scene.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: 280,
        ease: 'Back.easeOut',
      });

      // ---- Dismiss handler ----
      // The toast pauses the game until the player presses Space/Enter or clicks.
      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        // Detach listeners
        scene.input.keyboard.off('keydown-SPACE', dismiss);
        scene.input.keyboard.off('keydown-ENTER', dismiss);
        scene.input.off('pointerdown', dismiss);
        // Resume physics
        if (wasPhysicsRunning && scene.physics && scene.physics.resume) {
          scene.physics.resume();
        }
        // Animate out
        scene.tweens.add({
          targets: container,
          alpha: 0,
          duration: 300,
          onComplete: () => container.destroy(true),
        });
      };

      // Defer the input bindings by 1 frame so the keypress that opened the
      // skill (or the click that triggered the unlock) doesn't immediately
      // close the toast.
      scene.time.delayedCall(150, () => {
        if (dismissed) return;
        scene.input.keyboard.on('keydown-SPACE', dismiss);
        scene.input.keyboard.on('keydown-ENTER', dismiss);
        scene.input.on('pointerdown', dismiss);
      });

      // Hard fallback: auto-dismiss after 15 seconds in case input is somehow lost
      scene.time.delayedCall(15000, dismiss);
    } catch (err) {
      // non-fatal
      console.warn('[AbilitySystem] toast failed', err);
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

    // Tutorial step 8 trigger (feature 044). One emission per successful
    // activation — placed AFTER cooldown checks so a no-op press doesn't
    // count.
    if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
      window.TutorialSystem.report('combat.ability.used', { slot: slot });
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

  // Remaining cooldown in ms for a given ability id (0 when ready).
  function getCooldownRemaining(abilityId, now) {
    const ready = state.cooldowns[abilityId] || 0;
    const n = Number.isFinite(now) ? now : Date.now();
    return Math.max(0, ready - n);
  }

  // ---------- Unlock Hooks ----------
  function _checkUnlocks(triggerType, value) {
    // Endless mode: only Endless.apply() may grant abilities (via direct
    // learnAbility call). Auto-unlocks from kill/wave/boss/quest triggers
    // are disabled so the upgrade-card pick is the sole acquisition path.
    if (window.__ENDLESS_MODE__) return;
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

  // Wipes persistent ability progress and resets in-memory state.
  // Called when the player starts a new game so leftover skills from a
  // previous run don't carry over. The actual storage wipe is delegated
  // to Persistence.clearAllSaves so all subsystems are wiped together.
  function resetForNewGame() {
    state.learnedAbilities = DEFAULT_LEARNED.slice();
    state.activeLoadout = Object.assign({}, DEFAULT_LOADOUT);
    state.enemyKills = 0;
    state.cooldowns = {};
    try {
      if (window.Persistence && typeof window.Persistence.clearAllSaves === 'function') {
        window.Persistence.clearAllSaves();
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[AbilitySystem] resetForNewGame storage clear failed', err);
    }
    // Test default: every new run starts with 20 Eisenbrocken so the forge
    // is immediately usable. Done here (instead of in inventory.js) so that
    // it ALSO applies to existing saves that get a "neues Spiel" click.
    if (window.materialCounts) {
      window.materialCounts.MAT = 20;
    } else {
      window.materialCounts = { MAT: 20 };
    }
    // FR-028 (WP04): seed 2 Minor health potions in the first empty inventory slot
    if (Array.isArray(window.inventory)) {
      for (let i = 0; i < window.inventory.length; i++) {
        if (!window.inventory[i]) {
          window.inventory[i] = {
            type: 'potion',
            potionTier: 1,
            name: 'Heiltrank (S)',
            iconKey: 'itPotionMinor',
            stack: 2
          };
          break;
        }
      }
      if (typeof window._refreshInventoryHUD === 'function') {
        try { window._refreshInventoryHUD(); } catch (e) { /* HUD may not exist yet */ }
      }
    }
    if (typeof window._refreshAbilityHUD === 'function') {
      try { window._refreshAbilityHUD(); } catch (e) { /* HUD may not exist yet */ }
    }
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
    resetForNewGame,
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
    getCooldownRemaining,
    onEnemyKilled,
    onBossKilled,
    onQuestCompleted,
    onWaveCompleted,
    getEnemyKills,
    getUnlockRule
  };

  // -------------------------------------------------------------------------
  // Diagnostic watchdog (#29 stabilization sweep): poll state.learnedAbilities
  // every 500 ms and log when its length grows. Catches any code path that
  // bypasses learnAbility() and pushes directly into the array — useful while
  // we're debugging "no console output when a skill is learned" reports from
  // the user. Remove once the tutorial flow is verified end-to-end.
  // -------------------------------------------------------------------------
  if (typeof window !== 'undefined' && typeof setInterval === 'function') {
    var _wd_lastLen = state.learnedAbilities.length;
    setInterval(function () {
      try {
        var len = state.learnedAbilities.length;
        if (len !== _wd_lastLen) {
          var added = state.learnedAbilities.slice(_wd_lastLen);
          console.log('[AbilitySystem watchdog] learnedAbilities length',
                      _wd_lastLen, '->', len,
                      'newly present:', JSON.stringify(added),
                      'full list:', JSON.stringify(state.learnedAbilities));
          _wd_lastLen = len;
        }
      } catch (_) { /* ignore */ }
    }, 500);
  }
})();
