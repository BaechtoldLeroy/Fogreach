// endlessMode.js — Roguelike "Endlos-Modus".
// Skips the hub, descends procedural room after procedural room, and shows a
// 3-card upgrade pick after each cleared room. Death persists the deepest
// floor reached and fades back to the StartScene.
//
// Activation: window.__ENDLESS_MODE__ = true (set by StartScene's ENDLOS
// button). Active checks via Endless.isActive() so other modules can branch.

(function () {
  'use strict';

  if (window.i18n) {
    window.i18n.register('de', {
      'endless.btn.start': 'ENDLOS-MODUS',
      'endless.choice.title': 'Wähle eine Verstärkung',
      'endless.choice.tag.skill': 'KAMPF',
      'endless.choice.tag.defense': 'VERTEIDIGUNG',
      'endless.choice.tag.speed': 'TEMPO',
      'endless.death.title': 'GESTORBEN',
      'endless.death.depth': 'Tiefste Stufe: {depth}',
      'endless.death.best': 'Bester Run: {best}',
      'endless.death.btn_menu': 'Zum Hauptmenü',
      'endless.depth_label': 'Stufe {depth}',

      'endless.up.dmg_small.name': 'Eiserne Faust I',
      'endless.up.dmg_small.desc': '+2 Waffenschaden',
      'endless.up.dmg_med.name': 'Eiserne Faust II',
      'endless.up.dmg_med.desc': '+4 Waffenschaden',
      'endless.up.dmg_large.name': 'Meisterklinge',
      'endless.up.dmg_large.desc': '+8 Waffenschaden',
      'endless.up.atkspd_small.name': 'Schnelle Hand',
      'endless.up.atkspd_small.desc': '+0.2 Angriffstempo',
      'endless.up.atkspd_med.name': 'Schnelle Hand II',
      'endless.up.atkspd_med.desc': '+0.4 Angriffstempo',
      'endless.up.crit_small.name': 'Präzision',
      'endless.up.crit_small.desc': '+5% kritische Trefferchance',
      'endless.up.crit_med.name': 'Präzision II',
      'endless.up.crit_med.desc': '+10% kritische Trefferchance',
      'endless.up.range.name': 'Erweiterte Reichweite',
      'endless.up.range.desc': '+20 Angriffsreichweite',

      'endless.up.hp_small.name': 'Zähigkeit',
      'endless.up.hp_small.desc': '+10 max. LP (heilt voll)',
      'endless.up.hp_med.name': 'Zähigkeit II',
      'endless.up.hp_med.desc': '+20 max. LP (heilt voll)',
      'endless.up.hp_large.name': 'Eiserner Wille',
      'endless.up.hp_large.desc': '+40 max. LP (heilt voll)',
      'endless.up.armor_small.name': 'Dicke Haut',
      'endless.up.armor_small.desc': '+5% Rüstung',
      'endless.up.armor_med.name': 'Dicke Haut II',
      'endless.up.armor_med.desc': '+10% Rüstung',
      'endless.up.regen.name': 'Regeneration',
      'endless.up.regen.desc': 'Heilt 1 LP alle 5 Sekunden',
      'endless.up.lifesteal.name': 'Lebensraub',
      'endless.up.lifesteal.desc': '10% des Schadens heilt dich',
      'endless.up.dodge.name': 'Ausweichen',
      'endless.up.dodge.desc': '+10% Chance, Schaden zu vermeiden',

      'endless.up.spd_small.name': 'Flinke Füße',
      'endless.up.spd_small.desc': '+15 Bewegungstempo',
      'endless.up.spd_med.name': 'Flinke Füße II',
      'endless.up.spd_med.desc': '+25 Bewegungstempo',
      'endless.up.spd_large.name': 'Windläufer',
      'endless.up.spd_large.desc': '+40 Bewegungstempo',

      'endless.up.learn_spin.name': 'Fähigkeit: Wirbelangriff',
      'endless.up.learn_spin.desc': 'AoE-Wirbel um dich (Slot belegt)',
      'endless.up.learn_charge.name': 'Fähigkeit: Aufgeladener Schlag',
      'endless.up.learn_charge.desc': 'Halten zum Aufladen (Slot belegt)',
      'endless.up.learn_dash.name': 'Fähigkeit: Sturmhieb',
      'endless.up.learn_dash.desc': 'Schneller Vorwärts-Dash (Slot belegt)',
      'endless.up.learn_dagger.name': 'Fähigkeit: Dolchwurf',
      'endless.up.learn_dagger.desc': 'Wirft Dolch in Blickrichtung (Slot belegt)',
      'endless.up.learn_shield.name': 'Fähigkeit: Schildstoß',
      'endless.up.learn_shield.desc': 'Betäubt nahe Gegner (Slot belegt)',
      'endless.up.learn_heal.name': 'Fähigkeit: Heilwunde',
      'endless.up.learn_heal.desc': 'Heilt 5 LP (30s Cooldown, Slot belegt)'
    });
    window.i18n.register('en', {
      'endless.btn.start': 'ENDLESS MODE',
      'endless.choice.title': 'Choose an upgrade',
      'endless.choice.tag.skill': 'COMBAT',
      'endless.choice.tag.defense': 'DEFENSE',
      'endless.choice.tag.speed': 'SPEED',
      'endless.death.title': 'YOU DIED',
      'endless.death.depth': 'Deepest floor: {depth}',
      'endless.death.best': 'Best run: {best}',
      'endless.death.btn_menu': 'Back to main menu',
      'endless.depth_label': 'Floor {depth}',

      'endless.up.dmg_small.name': 'Iron Fist I',
      'endless.up.dmg_small.desc': '+2 weapon damage',
      'endless.up.dmg_med.name': 'Iron Fist II',
      'endless.up.dmg_med.desc': '+4 weapon damage',
      'endless.up.dmg_large.name': 'Master Blade',
      'endless.up.dmg_large.desc': '+8 weapon damage',
      'endless.up.atkspd_small.name': 'Quick Hand',
      'endless.up.atkspd_small.desc': '+0.2 attack speed',
      'endless.up.atkspd_med.name': 'Quick Hand II',
      'endless.up.atkspd_med.desc': '+0.4 attack speed',
      'endless.up.crit_small.name': 'Precision',
      'endless.up.crit_small.desc': '+5% critical hit chance',
      'endless.up.crit_med.name': 'Precision II',
      'endless.up.crit_med.desc': '+10% critical hit chance',
      'endless.up.range.name': 'Extended Reach',
      'endless.up.range.desc': '+20 attack range',

      'endless.up.hp_small.name': 'Toughness',
      'endless.up.hp_small.desc': '+10 max HP (full heal)',
      'endless.up.hp_med.name': 'Toughness II',
      'endless.up.hp_med.desc': '+20 max HP (full heal)',
      'endless.up.hp_large.name': 'Iron Will',
      'endless.up.hp_large.desc': '+40 max HP (full heal)',
      'endless.up.armor_small.name': 'Thick Skin',
      'endless.up.armor_small.desc': '+5% armor',
      'endless.up.armor_med.name': 'Thick Skin II',
      'endless.up.armor_med.desc': '+10% armor',
      'endless.up.regen.name': 'Regeneration',
      'endless.up.regen.desc': 'Heals 1 HP every 5 seconds',
      'endless.up.lifesteal.name': 'Life Steal',
      'endless.up.lifesteal.desc': '10% of damage dealt heals you',
      'endless.up.dodge.name': 'Dodge',
      'endless.up.dodge.desc': '+10% chance to avoid damage',

      'endless.up.spd_small.name': 'Swift Feet',
      'endless.up.spd_small.desc': '+15 move speed',
      'endless.up.spd_med.name': 'Swift Feet II',
      'endless.up.spd_med.desc': '+25 move speed',
      'endless.up.spd_large.name': 'Wind Walker',
      'endless.up.spd_large.desc': '+40 move speed',

      'endless.up.learn_spin.name': 'Ability: Spin Attack',
      'endless.up.learn_spin.desc': 'AoE spin around you (takes a slot)',
      'endless.up.learn_charge.name': 'Ability: Charged Slash',
      'endless.up.learn_charge.desc': 'Hold to charge (takes a slot)',
      'endless.up.learn_dash.name': 'Ability: Dash Slash',
      'endless.up.learn_dash.desc': 'Quick forward dash (takes a slot)',
      'endless.up.learn_dagger.name': 'Ability: Dagger Throw',
      'endless.up.learn_dagger.desc': 'Throws a dagger (takes a slot)',
      'endless.up.learn_shield.name': 'Ability: Shield Bash',
      'endless.up.learn_shield.desc': 'Stuns nearby enemies (takes a slot)',
      'endless.up.learn_heal.name': 'Ability: Heal Wound',
      'endless.up.learn_heal.desc': 'Heals 5 HP (30s cooldown, takes a slot)'
    });
  }
  const T = (k, p) => (window.i18n ? window.i18n.t(k, p) : k);

  const STORAGE_KEY = 'demonfall_endless_best';
  const TAG_KEYS = {
    skill: 'endless.choice.tag.skill',
    defense: 'endless.choice.tag.defense',
    speed: 'endless.choice.tag.speed'
  };
  const TAG_COLORS = {
    skill: 0xff6644,
    defense: 0x4488ff,
    speed: 0x55cc55
  };

  // ---- Stat-buff registry (additive; layered into recalcDerived after skills) ----
  const _resetBuffs = () => ({
    weaponDamage: 0,
    weaponAttackSpeed: 0,
    attackRange: 0,
    playerArmor: 0,
    playerSpeed: 0,
    playerCritChance: 0,
    playerMaxHealth: 0,
    dodgeChance: 0,
    healthRegen: 0,
    lifesteal: 0
  });

  // ---- Upgrade pool ----
  const POOL = [
    // Combat
    { id: 'dmg_small',   tag: 'skill',   apply: (b) => { b.weaponDamage += 2; } },
    { id: 'dmg_med',     tag: 'skill',   apply: (b) => { b.weaponDamage += 4; } },
    { id: 'dmg_large',   tag: 'skill',   apply: (b) => { b.weaponDamage += 8; } },
    { id: 'atkspd_small', tag: 'skill',  apply: (b) => { b.weaponAttackSpeed += 0.2; } },
    { id: 'atkspd_med',  tag: 'skill',   apply: (b) => { b.weaponAttackSpeed += 0.4; } },
    { id: 'crit_small',  tag: 'skill',   apply: (b) => { b.playerCritChance += 0.05; } },
    { id: 'crit_med',    tag: 'skill',   apply: (b) => { b.playerCritChance += 0.10; } },
    { id: 'range',       tag: 'skill',   apply: (b) => { b.attackRange += 20; } },

    // Defense
    { id: 'hp_small',    tag: 'defense', apply: (b) => { b.playerMaxHealth += 10; }, postApply: 'fullHeal' },
    { id: 'hp_med',      tag: 'defense', apply: (b) => { b.playerMaxHealth += 20; }, postApply: 'fullHeal' },
    { id: 'hp_large',    tag: 'defense', apply: (b) => { b.playerMaxHealth += 40; }, postApply: 'fullHeal' },
    { id: 'armor_small', tag: 'defense', apply: (b) => { b.playerArmor += 0.05; } },
    { id: 'armor_med',   tag: 'defense', apply: (b) => { b.playerArmor += 0.10; } },
    { id: 'regen',       tag: 'defense', apply: (b) => { b.healthRegen += 1; } },
    { id: 'lifesteal',   tag: 'defense', apply: (b) => { b.lifesteal += 0.10; } },
    { id: 'dodge',       tag: 'defense', apply: (b) => { b.dodgeChance += 0.10; } },

    // Speed
    { id: 'spd_small',   tag: 'speed',   apply: (b) => { b.playerSpeed += 15; } },
    { id: 'spd_med',     tag: 'speed',   apply: (b) => { b.playerSpeed += 25; } },
    { id: 'spd_large',   tag: 'speed',   apply: (b) => { b.playerSpeed += 40; } },

    // Learn ability (skill tag, but also doubles as a unique pull). Filtered
    // out once already learned.
    { id: 'learn_spin',    tag: 'skill',   abilityId: 'spinAttack' },
    { id: 'learn_charge',  tag: 'skill',   abilityId: 'chargeSlash' },
    { id: 'learn_dash',    tag: 'speed',   abilityId: 'dashSlash' },
    { id: 'learn_dagger',  tag: 'skill',   abilityId: 'daggerThrow' },
    { id: 'learn_shield',  tag: 'defense', abilityId: 'shieldBash' },
    { id: 'learn_heal',    tag: 'defense', abilityId: 'heilwunde' }
  ];

  // ---- Module state ----
  const Endless = {
    active: false,
    depth: 1,
    bestDepth: 0,
    pickInProgress: false,
    _ui: null
  };

  function isActive() { return !!Endless.active; }

  function _readBest() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return Number.isFinite(v) ? v : 0;
    } catch (e) { return 0; }
  }

  function _writeBest(v) {
    try { localStorage.setItem(STORAGE_KEY, String(v | 0)); } catch (e) {}
  }

  // Begin a fresh run: reset buff registry, ability state, depth.
  function start() {
    Endless.active = true;
    Endless.depth = 1;
    Endless.bestDepth = _readBest();
    window.__ENDLESS_MODE__ = true;
    window.endlessBuffs = _resetBuffs();
    window.DUNGEON_DEPTH = 1;
    window.NEXT_DUNGEON_DEPTH = 1;
    window.SELECTED_WAVE_OVERRIDE = 1;
  }

  // Pull `n` random unique upgrades, skipping abilities already learned.
  function pickRandom(n) {
    const pool = POOL.filter((u) => {
      if (!u.abilityId) return true;
      // skip if already learned
      try {
        const learned = window.AbilitySystem && window.AbilitySystem.getLearnedAbilities
          ? window.AbilitySystem.getLearnedAbilities()
          : [];
        return !learned.includes(u.abilityId);
      } catch (e) { return true; }
    });
    const out = [];
    const used = new Set();
    let safety = 200;
    while (out.length < n && safety-- > 0 && pool.length > out.length) {
      const idx = Math.floor(Math.random() * pool.length);
      if (used.has(idx)) continue;
      used.add(idx);
      out.push(pool[idx]);
    }
    return out;
  }

  // Apply one upgrade to runtime stats. For stat buffs: mutate the registry +
  // re-run recalcDerived so the new totals propagate. For ability learns:
  // call AbilitySystem and auto-equip to the next free slot.
  function apply(up) {
    if (!up) return;
    if (up.apply) {
      up.apply(window.endlessBuffs);
      if (up.postApply === 'fullHeal' && typeof window.setPlayerMaxHealth === 'function') {
        // recalcDerived will re-add the bonus next call; just trigger and refill
        if (typeof recalcDerived === 'function') {
          try { recalcDerived(0, 0); } catch (e) {}
        }
        if (typeof window.setPlayerHealth === 'function' && typeof window.playerMaxHealth === 'number') {
          window.setPlayerHealth(window.playerMaxHealth);
        }
      }
    }
    if (up.abilityId && window.AbilitySystem) {
      try {
        if (typeof window.AbilitySystem.learnAbility === 'function') {
          window.AbilitySystem.learnAbility(up.abilityId);
        }
        // Auto-equip to next free slot
        const slots = window.AbilitySystem.SLOT_KEYS || ['slot1', 'slot2', 'slot3', 'slot4'];
        const loadout = window.AbilitySystem.getActiveLoadout
          ? (window.AbilitySystem.getActiveLoadout() || {})
          : {};
        for (let i = 0; i < slots.length; i++) {
          if (!loadout[slots[i]]) {
            if (typeof window.AbilitySystem.setActiveLoadout === 'function') {
              window.AbilitySystem.setActiveLoadout(slots[i], up.abilityId);
            }
            break;
          }
        }
        if (typeof window._refreshAbilityHUD === 'function') {
          try { window._refreshAbilityHUD(); } catch (e) {}
        }
      } catch (e) { /* ignore */ }
    }
    if (typeof recalcDerived === 'function') {
      try { recalcDerived(0, 0); } catch (e) {}
    }
    if (typeof updateHUD === 'function') {
      try { updateHUD(); } catch (e) {}
    }
  }

  // Build the 3-card overlay. Picks 3 random (filtered) upgrades and waits
  // for the player to choose. Calls onPicked() when done so the caller can
  // unlock stairs / advance the run.
  function showChoice(scene, onPicked) {
    if (!scene || !scene.add || Endless.pickInProgress) return;
    Endless.pickInProgress = true;
    const cards = pickRandom(3);
    if (cards.length === 0) {
      Endless.pickInProgress = false;
      if (onPicked) onPicked(null);
      return;
    }

    const cw = scene.cameras.main.width;
    const ch = scene.cameras.main.height;
    const overlay = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.78)
      .setScrollFactor(0).setDepth(2700).setInteractive();
    const title = scene.add.text(cw / 2, 70, T('endless.choice.title'), {
      fontFamily: 'serif', fontSize: '28px', color: '#ffd166', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2702);

    const cardW = 240;
    const cardH = 320;
    const gap = 28;
    const totalW = cardW * cards.length + gap * (cards.length - 1);
    const startX = cw / 2 - totalW / 2;
    const cardY = ch / 2 - cardH / 2 + 20;

    const cardObjects = [];
    cards.forEach((up, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const cy = cardY + cardH / 2;
      const tagColor = TAG_COLORS[up.tag] || 0xffffff;
      const bg = scene.add.rectangle(cx, cy, cardW, cardH, 0x1a1a26, 0.97)
        .setStrokeStyle(3, tagColor, 0.9)
        .setScrollFactor(0).setDepth(2701);
      const tagBg = scene.add.rectangle(cx, cy - cardH / 2 + 18, cardW - 8, 24, tagColor, 0.25)
        .setScrollFactor(0).setDepth(2702);
      const tagTxt = scene.add.text(cx, cy - cardH / 2 + 18, T(TAG_KEYS[up.tag] || 'endless.choice.tag.skill'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2703);
      const name = scene.add.text(cx, cy - 70, T('endless.up.' + up.id + '.name'), {
        fontFamily: 'serif', fontSize: '18px', color: '#ffd166', fontStyle: 'bold',
        align: 'center', wordWrap: { width: cardW - 24 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2703);
      const desc = scene.add.text(cx, cy + 20, T('endless.up.' + up.id + '.desc'), {
        fontFamily: 'monospace', fontSize: '13px', color: '#cfd0ff',
        align: 'center', wordWrap: { width: cardW - 28 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2703);
      const hit = scene.add.rectangle(cx, cy, cardW, cardH, 0x000000, 0)
        .setScrollFactor(0).setDepth(2704)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => { bg.setFillStyle(0x2a2a3a, 0.97); });
      hit.on('pointerout',  () => { bg.setFillStyle(0x1a1a26, 0.97); });
      hit.on('pointerdown', () => {
        // Cleanup overlay first so apply()-side effects (recalc, HUD) render fresh
        cleanup();
        apply(up);
        Endless.pickInProgress = false;
        if (onPicked) onPicked(up);
      });
      cardObjects.push(bg, tagBg, tagTxt, name, desc, hit);
    });

    const cleanup = () => {
      try { overlay.destroy(); } catch (e) {}
      try { title.destroy(); } catch (e) {}
      cardObjects.forEach((g) => { try { g.destroy(); } catch (e) {} });
    };

    Endless._ui = { cleanup };
  }

  // Called from roomManager.markRoomCleared when endless is active. Locks
  // stairs again until the player picks a card, then unlocks for descent.
  function handleRoomCleared(scene) {
    if (!isActive() || !scene) return;
    // Re-lock stairs so the player can't descend before picking
    if (typeof window.lockStairs === 'function' && scene.stairsGroup) {
      try { window.lockStairs(scene, true); } catch (e) {}
    } else if (scene.stairsGroup && scene.stairsGroup.children) {
      scene.stairsGroup.children.iterate(s => s && s.setData('locked', true) && s.setAlpha(0.6));
    }
    // Give the room-cleared toast a moment to fade in, then offer cards
    scene.time.delayedCall(450, () => {
      showChoice(scene, () => {
        // Unlock stairs after pick
        if (scene.stairsGroup && scene.stairsGroup.children) {
          scene.stairsGroup.children.iterate(s => s && s.setData('locked', false) && s.setAlpha(1));
        }
      });
    });
  }

  // Called from roomManager when the player would normally trigger
  // "last room → return to hub". In endless mode we instead increment depth
  // and keep going.
  function shouldSkipHubReturn() { return isActive(); }

  function onDepthAdvance(newDepth) {
    Endless.depth = newDepth;
    if (newDepth > Endless.bestDepth) {
      Endless.bestDepth = newDepth;
      _writeBest(newDepth);
    }
  }

  // Death handler — overlay with depth + best, then back to start menu
  function handleDeath(scene) {
    if (!isActive() || !scene) return false;
    const depth = Endless.depth;
    const best = Math.max(Endless.bestDepth, depth);
    if (depth > Endless.bestDepth) _writeBest(depth);

    const cw = scene.cameras.main.width;
    const ch = scene.cameras.main.height;
    const ov = scene.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(2800).setInteractive();
    const title = scene.add.text(cw / 2, ch / 2 - 80, T('endless.death.title'), {
      fontFamily: 'serif', fontSize: '52px', color: '#c0392b', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2801);
    const depthTxt = scene.add.text(cw / 2, ch / 2 - 10, T('endless.death.depth', { depth: depth }), {
      fontFamily: 'monospace', fontSize: '20px', color: '#f1e9d8'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2801);
    const bestTxt = scene.add.text(cw / 2, ch / 2 + 20, T('endless.death.best', { best: best }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2801);
    const btn = scene.add.text(cw / 2, ch / 2 + 90, T('endless.death.btn_menu'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
      backgroundColor: '#3a3a5a', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2801).setInteractive({ useHandCursor: true });

    const close = () => {
      try { ov.destroy(); } catch (e) {}
      try { title.destroy(); } catch (e) {}
      try { depthTxt.destroy(); } catch (e) {}
      try { bestTxt.destroy(); } catch (e) {}
      try { btn.destroy(); } catch (e) {}
      // Reset endless state and return to start menu
      Endless.active = false;
      window.__ENDLESS_MODE__ = false;
      window.endlessBuffs = _resetBuffs();
      try { if (typeof window.clearSave === 'function') window.clearSave(); } catch (e) {}
      try {
        if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
          window.AbilitySystem.resetForNewGame();
        }
      } catch (e) {}
      try { scene.scene.start('StartScene'); } catch (e) {}
    };
    btn.on('pointerdown', close);
    return true;
  }

  window.Endless = {
    isActive: isActive,
    start: start,
    handleRoomCleared: handleRoomCleared,
    shouldSkipHubReturn: shouldSkipHubReturn,
    onDepthAdvance: onDepthAdvance,
    handleDeath: handleDeath,
    pickRandom: pickRandom,
    apply: apply
  };
})();
