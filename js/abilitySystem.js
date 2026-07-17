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
  // 060 WP03: Erwerb l\u00E4uft ausschlie\u00DFlich \u00FCber den Skill-Baum. ABILITY_DEFS
  // enth\u00E4lt daher nur noch die 12 Skill-Baum-Knoten (3 Str\u00E4nge x 4). Die alten
  // Kill/Wellen/Quest-freischaltbaren Defs (spinAttack/chargeSlash/dashSlash/
  // daggerThrow/shieldBash + Platzhalter heilwunde/frostnova/blutopfer/
  // schattenschritt) wurden entfernt.
  const ABILITY_DEFS = {
    // === 060 Strang WUT ===
    // Vier aktive Faehigkeiten des "WUT & WUCHT"-Strangs (Skill-Baum-Knoten:
    // whirlwind/hammer/frenzy/berserk). Schaden wird mit dmgMult (Rang+Synergie),
    // Cooldowns mit cdMult skaliert; beide defensiv aus window.SkillTree gelesen
    // (SkillTree kann theoretisch fehlen -> Fallback 1).
    //
    // whirlwind/hammer recyceln die bestehenden Basis-Funktionen (spinAttack /
    // beginChargedSlash+releaseChargedSlash) und setzen window._skillCastDmgMult
    // fuer die Dauer des Casts, damit dealDamageToEnemy (player.js) den
    // Rang-Multiplikator beruecksichtigt. frenzy/berserk setzen globale Buff-
    // States (window.frenzyState / window.berserkState), die player.js liest
    // (getAttackSpeedMultiplier bzw. dealDamageToEnemy).
    whirlwind: {
      id: 'whirlwind',
      name: 'Wirbelwind',
      description: 'Wirble ~1s durch die Gegner — bewege dich dabei frei, triff alle in Reichweite mehrfach.',
      type: 'tap',
      icon: '\u{1F300}',
      color: 0x00ffff,
      cooldownMs: 2500,
      activate(scene) {
        // 060: beweglicher Channel (castWhirlwind in player.js) statt Einzel-Spin.
        try {
          if (typeof window.castWhirlwind === 'function') window.castWhirlwind.call(scene);
        } catch (err) {
          console.warn('[Abilities] Wirbelwind failed', err);
        }
      }
    },
    hammer: {
      id: 'hammer',
      name: 'Hammer der Ahnen',
      description: 'Geladener Hieb. Halten zum Aufladen, loslassen für mächtigen Schlag.',
      type: 'charge',
      icon: '\u{1F528}',
      color: 0xffaa00,
      onPress(scene) {
        try {
          if (typeof window.beginChargedSlash === 'function') window.beginChargedSlash.call(scene);
        } catch (err) {
          console.warn('[Abilities] Hammer (press) failed', err);
        }
      },
      onRelease(scene) {
        var dmgMult = (window.SkillTree && window.SkillTree.getAbilityDamageMult)
          ? window.SkillTree.getAbilityDamageMult('hammer') : 1;
        try {
          if (typeof window.releaseChargedSlash === 'function') {
            window._skillCastDmgMult = dmgMult;
            try { window.releaseChargedSlash.call(scene); }
            finally { window._skillCastDmgMult = 1; }
          }
        } catch (err) {
          window._skillCastDmgMult = 1;
          console.warn('[Abilities] Hammer (release) failed', err);
        }
      }
    },
    frenzy: {
      id: 'frenzy',
      name: 'Raserei',
      description: 'Angriffstempo-Buff, der bei Treffern/Kills stapelt und abklingt.',
      type: 'self',
      icon: '\u{1F525}',
      color: 0xff5522,
      cooldownMs: 8000,
      activate(scene) {
        // Vorbild: Amulett-Effekt 'momentum' (amuletEffects.js) — stapelt auf
        // Kills, decay ueber Zeit. Rang erhoeht Max-Stacks und Tempo pro Stack.
        try {
          var rank = (window.SkillTree && window.SkillTree.getRank)
            ? (window.SkillTree.getRank('frenzy') | 0) : 0;
          var cdMult = (window.SkillTree && window.SkillTree.getAbilityCooldownMult)
            ? window.SkillTree.getAbilityCooldownMult('frenzy') : 1;
          var now = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();
          var maxStacks = 5 + Math.max(0, rank - 1) * 2;       // Rang -> mehr Max-Stacks
          var perStack  = 0.04 + Math.max(0, rank - 1) * 0.01; // Rang -> mehr Tempo/Stack
          var decayMs   = 6000;                                // länger aktiv (war 4000)
          window.frenzyState = {
            active: true,
            stacks: 1,            // sofort 1 Stack beim Aktivieren
            maxStacks: maxStacks,
            perStack: perStack,
            decayMs: decayMs,
            // Gesamtfenster: solange Stacks frisch gehalten werden, bleibt der
            // Buff aktiv; _frenzyBump (player.js) schiebt expiry nach hinten.
            expiry: now + decayMs
          };
          // Per-Ability Cooldown skaliert bereits zentral in tryActivate via cdMult.
          if (typeof window._frenzyFx === 'function') window._frenzyFx(scene);
          console.log('[Abilities] Raserei aktiviert (Stacks bis ' + maxStacks + ', +' + (perStack * 100).toFixed(0) + '%/Stack), cdMult=' + cdMult.toFixed(2));
        } catch (err) {
          console.warn('[Abilities] Raserei failed', err);
        }
      }
    },
    berserk: {
      id: 'berserk',
      name: 'Berserker',
      description: 'Opfert LP für einen Schadens-Buff. Stärke steigt mit Rang.',
      type: 'self',
      icon: '\u{1FA78}',
      color: 0xff3366,
      cooldownMs: 20000,
      activate(scene) {
        // Basis: bestehende Blutopfer-Logik (LP-Opfer -> Schadensbonus).
        // Buff-Staerke = Basis * (1 + getSynergyValue('berserk','buff')) und
        // steigt mit Rang.
        try {
          var rank = (window.SkillTree && window.SkillTree.getRank)
            ? (window.SkillTree.getRank('berserk') | 0) : 0;
          var synBuff = (window.SkillTree && window.SkillTree.getSynergyValue)
            ? window.SkillTree.getSynergyValue('berserk', 'buff') : 0;
          var baseBonus = 0.5 + Math.max(0, rank - 1) * 0.15; // Rang -> mehr Bonus
          var mult = 1 + baseBonus * (1 + synBuff);
          var now = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();
          var durationMs = 10000;
          // LP opfern (wie Blutopfer), nie unter 1.
          if (typeof setPlayerHealth === 'function' && typeof playerHealth !== 'undefined') {
            setPlayerHealth(Math.max(1, playerHealth - 5));
          }
          window.berserkState = { active: true, mult: mult, expiry: now + durationMs };
          if (scene && scene.time && scene.time.delayedCall) {
            scene.time.delayedCall(durationMs, function () {
              if (window.berserkState) window.berserkState.active = false;
            });
          }
          console.log('[Abilities] Berserker aktiviert: Schaden x' + mult.toFixed(2) + ' (Rang ' + rank + ', Synergie ' + synBuff.toFixed(2) + ')');
        } catch (err) {
          console.warn('[Abilities] Berserker failed', err);
        }
      }
    },

    // === 060 Strang KETTEN ===
    // Skill-Tree-Strang "Ketten & Kontrolle". Vier aktive Fähigkeiten, die ihre
    // Cast-Logik aus js/player.js beziehen (window.cast*). Schaden/Cooldown
    // skalieren defensiv über den SkillTree-Contract (fehlt → Multiplier 1).
    twistingBlades: {
      id: 'twistingBlades',
      name: 'Wirbelklingen',
      description: 'Wurfklinge, die zurückkehrt und auf Hin- und Rückweg trifft.',
      type: 'tap',
      icon: '\u{1FA83}',
      color: 0xff8800,
      cooldownMs: 7000,
      activate(scene) {
        if (typeof window.castTwistingBlades === 'function') {
          window.castTwistingBlades.call(scene);
        }
      }
    },
    steelGrasp: {
      id: 'steelGrasp',
      name: 'Stahlgriff',
      description: 'Kettengriff: zieht den ersten getroffenen Gegner heran + Schaden.',
      type: 'tap',
      icon: '⛓',
      color: 0xbfc7d6,
      cooldownMs: 7000,
      activate(scene) {
        if (typeof window.castSteelGrasp === 'function') {
          window.castSteelGrasp.call(scene);
        }
      }
    },
    cycloneStrike: {
      id: 'cycloneStrike',
      name: 'Wirbelsog',
      description: 'Zieht alle Gegner im Umkreis heran und fügt AoE-Schaden zu.',
      type: 'self',
      icon: '\u{1F32A}',
      color: 0x66ddff,
      cooldownMs: 9000,
      activate(scene) {
        if (typeof window.castCycloneStrike === 'function') {
          window.castCycloneStrike.call(scene);
        }
      }
    },
    frostNova: {
      id: 'frostNova',
      name: 'Frostnova',
      description: 'AoE-Frostnova: verlangsamt alle Gegner in der Nähe + Schaden.',
      type: 'self',
      icon: '❄',
      color: 0x88ddff,
      cooldownMs: 12000,
      activate(scene) {
        if (typeof window.castFrostNova === 'function') {
          window.castFrostNova.call(scene);
        }
      }
    },
    // === /060 Strang KETTEN ===

    // === 060 Strang SCHATTEN ===
    // Vier neue aktive Fähigkeiten des SkillTree-Strangs SCHATTEN & JAGD.
    // Schaden/Cooldown skalieren defensiv via window.SkillTree.* (Contract:
    // fehlt die Funktion → mult 1). Logik liegt in js/player.js (shadow*).
    charge: {
      id: 'charge',
      name: 'Ansturm',
      description: 'Linien-Sturm: dasht durch alle Gegner im Pfad und stoßt sie weg.',
      type: 'tap',
      icon: '➡',
      color: 0x66ccff,
      cooldownMs: 6000,
      activate(scene) {
        try {
          if (typeof window.shadowCharge === 'function') window.shadowCharge.call(scene);
        } catch (err) { console.warn('[Abilities] charge failed', err); }
      }
    },
    teleportDash: {
      id: 'teleportDash',
      name: 'Schattenschritt',
      description: 'Kurzer Blink mit Unverwundbarkeit; Strecke/Dauer skalieren mit Rang.',
      type: 'self',
      icon: '\u{1F47B}',
      color: 0x9966ff,
      cooldownMs: 9000,
      activate(scene) {
        try {
          if (typeof window.shadowTeleportDash === 'function') window.shadowTeleportDash.call(scene);
        } catch (err) { console.warn('[Abilities] teleportDash failed', err); }
      }
    },
    heilwunde: {
      id: 'heilwunde',
      name: 'Heilwunde',
      description: 'Heilt LP; Heilmenge skaliert mit Rang.',
      type: 'self',
      icon: '✚',
      color: 0x66ff66,
      cooldownMs: 30000,
      activate(scene) {
        try {
          if (typeof window.shadowHeilwunde === 'function') window.shadowHeilwunde.call(scene);
        } catch (err) { console.warn('[Abilities] heilwunde failed', err); }
      }
    },
    deathBlow: {
      id: 'deathBlow',
      name: 'Todesstoss',
      description: 'Schlag nach vorn; angeschlagene Gegner werden sofort exekutiert. Hinrichtung setzt den Cooldown zurück.',
      type: 'self',
      icon: '\u{1F480}',
      color: 0xff3344,
      cooldownMs: 8000,
      activate(scene) {
        try {
          var executed = (typeof window.shadowDeathBlow === 'function')
            ? window.shadowDeathBlow.call(scene) : false;
          // Ketten-Hinrichtung: starb mindestens ein Gegner durch Exekution,
          // wird der Cooldown SOFORT zurückgesetzt, damit erneut zugeschlagen
          // werden kann.
          if (executed) resetCooldown('deathBlow');
        } catch (err) { console.warn('[Abilities] deathBlow failed', err); }
      }
    }
    // === /060 Strang SCHATTEN ===
  };

  // ---------- Unlock Conditions ----------
  // 060 WP03: Auto-Unlock (Kills/Wellen/Quests/Bosse) wurde entfernt \u2014 Erwerb
  // l\u00E4uft ausschlie\u00DFlich \u00FCber den Skill-Baum (window.SkillTree). UNLOCK_RULES
  // bleibt als leeres Objekt erhalten, damit Altkonsumenten (getUnlockRule)
  // nicht crashen; es gibt keine automatischen Freischaltungen mehr.
  const UNLOCK_RULES = {};

  // ---------- i18n bootstrap ----------
  // Auto-register German strings for all abilities, then convert each def.name /
  // def.description into a getter so existing consumers (loadoutOverlay tooltip,
  // HUD slot tiles) automatically see the active language without code changes.
  if (window.i18n) {
    var _autoDe = {};
    Object.keys(ABILITY_DEFS).forEach(function (id) {
      var d = ABILITY_DEFS[id];
      if (typeof d.name === 'string') _autoDe['ability.' + id + '.name'] = d.name;
      if (typeof d.description === 'string') _autoDe['ability.' + id + '.description'] = d.description;
    });
    window.i18n.register('de', _autoDe);

    window.i18n.register('en', {
      // 060 Strang WUT
      'ability.whirlwind.name': 'Whirlwind',
      'ability.whirlwind.description': 'Whirl through enemies for ~1s — move freely while spinning, hitting everything in range repeatedly.',
      'ability.hammer.name': 'Hammer of the Ancestors',
      'ability.hammer.description': 'Charged strike. Hold to charge, release for a mighty blow.',
      'ability.frenzy.name': 'Frenzy',
      'ability.frenzy.description': 'Attack-speed buff that stacks on hits/kills and decays over time.',
      'ability.berserk.name': 'Berserk',
      'ability.berserk.description': 'Sacrifice HP for a damage buff. Strength grows with rank.',
      // 060 Strang KETTEN
      'ability.twistingBlades.name': 'Twisting Blades',
      'ability.twistingBlades.description': 'A thrown blade that returns, hitting on both the outward and return path.',
      'ability.steelGrasp.name': 'Steel Grasp',
      'ability.steelGrasp.description': 'Chain grab: pulls the first enemy hit toward you and deals damage.',
      'ability.cycloneStrike.name': 'Cyclone Strike',
      'ability.cycloneStrike.description': 'Pulls all nearby enemies toward you and deals AoE damage.',
      'ability.frostNova.name': 'Frost Nova',
      'ability.frostNova.description': 'AoE frost nova: slows all nearby enemies and deals damage.',
      // === 060 Strang SCHATTEN ===
      'ability.charge.name': 'Charge',
      'ability.charge.description': 'Line dash through all enemies in the path, knocking them away.',
      'ability.teleportDash.name': 'Shadow Step',
      'ability.teleportDash.description': 'Quick blink with i-frames; range/duration scale with rank.',
      'ability.heilwunde.name': 'Heal Wound',
      'ability.heilwunde.description': 'Heals HP; heal amount scales with rank.',
      'ability.deathBlow.name': 'Death Blow',
      'ability.deathBlow.description': 'Strike ahead; low-HP enemies are executed instantly. An execution resets the cooldown.'
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
  }

  // 060 WP03: Keine Abilities standardmäßig gelernt. Erwerb läuft ausschließlich
  // über den Skill-Baum (window.SkillTree.investPoint -> SkillTree.onChange-Sync,
  // siehe skillTree.js). Neue Spiele starten mit 0 gelernten Fähigkeiten.
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
      (window.SlotStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[AbilitySystem] save failed', err);
    }
  }

  function load() {
    try {
      const raw = (window.SlotStorage || localStorage).getItem(STORAGE_KEY);
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
    if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
      try {
        window.TutorialSystem.report('ability.learned', { abilityId: id });
      } catch (_) { /* never crash gameplay */ }
    }
    return true;
  }

  /**
   * Verlernt eine Ability: entfernt sie aus learnedAbilities UND räumt sie aus
   * allen aktiven Slots (Loadout). Gegenstück zu learnAbility — wird vom
   * SkillTree-Sync (skillTree.js onChange) für Knoten mit Rang 0 sowie nach
   * respec() aufgerufen. Idempotent + defensiv (unbekannte/ungelernte id -> false).
   * @param {string} id
   * @returns {boolean} true wenn die Ability gelernt war und entfernt wurde
   */
  function forgetAbility(id) {
    const idx = state.learnedAbilities.indexOf(id);
    if (idx === -1) return false;
    state.learnedAbilities.splice(idx, 1);
    // Aus allen Slots entfernen, die diese Ability tragen.
    SLOT_KEYS.forEach((slot) => {
      if (state.activeLoadout[slot] === id) state.activeLoadout[slot] = null;
    });
    save();
    if (typeof window._refreshAbilityHUD === 'function') {
      try { window._refreshAbilityHUD(); } catch (e) { /* HUD may not exist yet */ }
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

    // Per-ability cooldowns (only enforced for "self"/tap type abilities).
    // Cooldown wird defensiv mit dem SkillTree-CooldownMult skaliert
    // (Contract: fehlt die Funktion → mult 1).
    if (def.cooldownMs) {
      // gameNow: pausierte Spannen (Inventar offen o.ä.) rausgerechnet, damit
      // Cooldowns nicht "durchlaufen", während das Spiel pausiert ist.
      const now = (typeof window.gameNow === 'function')
        ? window.gameNow(scene)
        : ((scene?.time?.now) || Date.now());
      const ready = state.cooldowns[abilityId] || 0;
      if (now < ready) return false;
      // 060: Skill-Rang senkt den Cooldown (cdMult, gedeckelt).
      // Defensiv aus window.SkillTree gelesen (kann fehlen -> Faktor 1).
      let cdMult = 1;
      try {
        if (window.SkillTree && window.SkillTree.getAbilityCooldownMult) {
          const m = window.SkillTree.getAbilityCooldownMult(abilityId);
          if (typeof m === 'number' && isFinite(m) && m > 0) cdMult = m;
        }
      } catch (e) { /* never break activation */ }
      // 060: Loot-Affixe (cd_<ability> + cd_all_abilities + Wissensbaum-CDR)
      // senken auch die Cooldowns der neuen Self-Abilities (cycloneStrike/
      // frostNova/deathBlow etc.). getLootAbilityCooldownReduction lebt global
      // in player.js; defensiv aufgerufen, nie die Aktivierung brechen.
      let lootCdMult = 1;
      try {
        if (typeof getLootAbilityCooldownReduction === 'function') {
          const red = getLootAbilityCooldownReduction(abilityId);
          if (typeof red === 'number' && isFinite(red)) lootCdMult = Math.max(0.2, 1 - red);
        }
      } catch (e) { /* never break activation */ }
      let _cdBudget = def.cooldownMs * cdMult * lootCdMult;
      // Feature 059: Blutpakt-Amulett — fast kein Cooldown, kostet dafür LP.
      // Nach dem Ready-Check -> LP nur bei ERFOLGREICHER Aktivierung.
      if (typeof window !== 'undefined' && typeof window.isBloodpactActive === 'function'
          && window.isBloodpactActive()) {
        _cdBudget = Math.max(120, _cdBudget * 0.1);
        if (typeof window.applyBloodpactCost === 'function') {
          try { window.applyBloodpactCost(); } catch (e) { /* never break activation */ }
        }
      }
      state.cooldowns[abilityId] = now + _cdBudget;
      state.cooldownDurations = state.cooldownDurations || {};
      state.cooldownDurations[abilityId] = _cdBudget;
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

  // 060 Strang SCHATTEN: setzt den Cooldown einer Ability sofort zurück
  // (deathBlow Ketten-Hinrichtung). Defensiv — unbekannte ids no-op.
  function resetCooldown(abilityId) {
    if (!abilityId) return;
    state.cooldowns[abilityId] = 0;
    if (typeof window._refreshAbilityHUD === 'function') {
      try { window._refreshAbilityHUD(); } catch (e) { /* HUD may not exist yet */ }
    }
  }

  // 060: Externes Registrieren einer Cooldown-Anzeige für Abilities, die ihren
  // Cooldown SELBST verwalten (z.B. Hammer/charge ohne def.cooldownMs) — damit
  // die Loadout-HUD sie trotzdem als Cooldown darstellt. `now` = scene.time.now.
  function setCooldown(abilityId, ms, now) {
    if (!abilityId || !(ms > 0)) return;
    state.cooldowns[abilityId] = (now || 0) + ms;
    state.cooldownDurations = state.cooldownDurations || {};
    state.cooldownDurations[abilityId] = ms;   // für die HUD-Füllrate
    if (typeof window._refreshAbilityHUD === 'function') {
      try { window._refreshAbilityHUD(); } catch (e) { /* HUD may not exist yet */ }
    }
  }

  // Volle Cooldown-Dauer (ms) der letzten Aktivierung — die HUD braucht sie für
  // die Füll-/Ring-Anzeige bei Abilities OHNE statisches def.cooldownMs (Hammer).
  function getCooldownDuration(abilityId) {
    return (state.cooldownDurations && state.cooldownDurations[abilityId]) || 0;
  }

  // ---------- Unlock Hooks ----------
  // 060 WP03: Auto-Unlock entfernt. Abilities werden NICHT mehr automatisch über
  // Kills/Wellen/Bosse/Quests gelernt — der einzige Erwerbspfad ist der
  // Skill-Baum (window.SkillTree, synchronisiert via SkillTree.onChange in
  // skillTree.js). Die on*-Hooks bleiben als inerte Stubs erhalten, damit
  // bestehende Aufrufer (main.js/questSystem etc.) nicht crashen. Kills werden
  // weiterhin als Statistik gezählt, lösen aber keine Freischaltung mehr aus.
  function onEnemyKilled() {
    state.enemyKills += 1;
    save();
  }

  function onBossKilled(_bossType) { /* Auto-Unlock entfernt (060 WP03) */ }

  function onQuestCompleted(_questId) { /* Auto-Unlock entfernt (060 WP03) */ }

  function onWaveCompleted(_wave) { /* Auto-Unlock entfernt (060 WP03) */ }

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
        (window.SlotStorage || localStorage).removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[AbilitySystem] resetForNewGame storage clear failed', err);
    }
    // Feature 060: Skill-Baum beim Neues-Spiel ZURÜCKSETZEN. clearAllSaves wischt
    // nur localStorage-Keys, nicht den in-memory SkillTree-State (eigenes Modul/
    // eigener Storage-Key) -> sonst behält ein neues Spiel die alten Talente.
    try {
      if (window.SkillTree && typeof window.SkillTree.resetForNewGame === 'function') {
        window.SkillTree.resetForNewGame();
      }
    } catch (err) {
      console.warn('[AbilitySystem] SkillTree reset failed', err);
    }
    // Neues Spiel startet OHNE Eisenbrocken (werden im Dungeon gefunden/zerlegt).
    // Hier gesetzt (statt in inventory.js), damit es auch beim "neues Spiel"-Klick
    // auf bestehende Saves greift.
    if (window.materialCounts) {
      window.materialCounts.MAT = 0;
    } else {
      window.materialCounts = { MAT: 0 };
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
    forgetAbility,
    tryActivate,
    tryRelease,
    getCooldownRemaining,
    resetCooldown,
    setCooldown,
    getCooldownDuration,
    onEnemyKilled,
    onBossKilled,
    onQuestCompleted,
    onWaveCompleted,
    getEnemyKills,
    getUnlockRule
  };

})();
