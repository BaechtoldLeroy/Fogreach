// js/lootSystem.js
// Loot & Economy Overhaul — Foundation & Affix Engine (WP01).
//
// This module exposes the full `window.LootSystem` public API surface defined
// in kitty-specs/020-loot-economy-overhaul/contracts/lootSystem.api.md.
//
// WP01 implements:
//   - AFFIX_DEFS (24 frozen entries, single source of truth)
//   - ITEM_BASES / POTION_DEFS placeholders (WP02 / WP04 fill these)
//   - rollAffixes(iLevel, count, rng?, itemType?)  — deterministic with seeded RNG
//   - recomputeBonuses() / getBonus(statKey)        — O(1) cache lookup
//
// Every other public API method is stubbed with `throw new Error('... not
// implemented (WPxx)')` so that later WPs can fill in bodies without changing
// the module surface.

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // AFFIX_DEFS — 24 frozen entries from data-model.md
  // ---------------------------------------------------------------------------
  const AFFIX_DEFS = Object.freeze([
    // === Base stats (6) ===
    Object.freeze({ id: 'sharp_dmg', displayName: 'Sharp', position: 'prefix', statKey: 'damage',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 25 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value}% Damage' }),
    Object.freeze({ id: 'sturdy_armor', displayName: 'Sturdy', position: 'prefix', statKey: 'armor',
      valueType: 'flat', range: Object.freeze({ min: 2, max: 8 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['head', 'body', 'boots']), tooltipText: '+{value} Armor' }),
    Object.freeze({ id: 'of_health', displayName: 'of the Bear', position: 'suffix', statKey: 'hp',
      valueType: 'flat', range: Object.freeze({ min: 5, max: 30 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['head', 'body', 'boots', 'weapon']), tooltipText: '+{value} HP' }),
    Object.freeze({ id: 'swift_speed', displayName: 'Swift', position: 'prefix', statKey: 'speed',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 15 }), iLevelMin: 1, weight: 80,
      appliesTo: Object.freeze(['boots', 'body']), tooltipText: '+{value}% Speed' }),
    Object.freeze({ id: 'of_precision', displayName: 'of Precision', position: 'suffix', statKey: 'crit',
      valueType: 'percent', range: Object.freeze({ min: 2, max: 8 }), iLevelMin: 3, weight: 80,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '+{value}% Crit Chance' }),
    Object.freeze({ id: 'of_reach', displayName: 'of Reach', position: 'suffix', statKey: 'range',
      valueType: 'flat', range: Object.freeze({ min: 10, max: 30 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value} Range' }),

    // === Defensive (4) ===
    Object.freeze({ id: 'fire_warding', displayName: 'Fireproof', position: 'prefix', statKey: 'resist_fire',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 20 }), iLevelMin: 4, weight: 60,
      appliesTo: Object.freeze(['head', 'body', 'boots']), tooltipText: '+{value}% Fire Resist' }),
    Object.freeze({ id: 'cold_warding', displayName: 'Frostproof', position: 'prefix', statKey: 'resist_cold',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 20 }), iLevelMin: 4, weight: 60,
      appliesTo: Object.freeze(['head', 'body', 'boots']), tooltipText: '+{value}% Cold Resist' }),
    Object.freeze({ id: 'lightning_warding', displayName: 'Stormproof', position: 'prefix', statKey: 'resist_lightning',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 20 }), iLevelMin: 4, weight: 60,
      appliesTo: Object.freeze(['head', 'body', 'boots']), tooltipText: '+{value}% Lightning Resist' }),
    Object.freeze({ id: 'of_the_leech', displayName: 'of the Leech', position: 'suffix', statKey: 'lifesteal',
      valueType: 'percent', range: Object.freeze({ min: 1, max: 5 }), iLevelMin: 6, weight: 40,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value}% Life Steal' }),

    // === Per-ability damage (5) ===
    Object.freeze({ id: 'spinning_dmg', displayName: 'Spinning', position: 'prefix', statKey: 'dmg_spinAttack',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 35 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Spin Attack Damage' }),
    Object.freeze({ id: 'charged_dmg', displayName: 'Charged', position: 'prefix', statKey: 'dmg_chargeSlash',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 35 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Charged Slash Damage' }),
    Object.freeze({ id: 'dashing_dmg', displayName: 'Dashing', position: 'prefix', statKey: 'dmg_dashSlash',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 35 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'boots']), tooltipText: '+{value}% Dash Slash Damage' }),
    Object.freeze({ id: 'piercing_dmg', displayName: 'Piercing', position: 'prefix', statKey: 'dmg_daggerThrow',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 35 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '+{value}% Dagger Throw Damage' }),
    Object.freeze({ id: 'bashing_dmg', displayName: 'Bashing', position: 'prefix', statKey: 'dmg_shieldBash',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 35 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Shield Bash Damage' }),

    // === Per-ability cooldown reduction (5) ===
    Object.freeze({ id: 'of_swift_spin', displayName: 'of Swift Spin', position: 'suffix', statKey: 'cd_spinAttack',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 20 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '-{value}% Spin Attack Cooldown' }),
    Object.freeze({ id: 'of_swift_charge', displayName: 'of Swift Charge', position: 'suffix', statKey: 'cd_chargeSlash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 20 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '-{value}% Charged Slash Cooldown' }),
    Object.freeze({ id: 'of_swift_dash', displayName: 'of Swift Dash', position: 'suffix', statKey: 'cd_dashSlash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 20 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['boots']), tooltipText: '-{value}% Dash Slash Cooldown' }),
    Object.freeze({ id: 'of_swift_dagger', displayName: 'of Swift Dagger', position: 'suffix', statKey: 'cd_daggerThrow',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 20 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['head']), tooltipText: '-{value}% Dagger Throw Cooldown' }),
    Object.freeze({ id: 'of_swift_bash', displayName: 'of Swift Bash', position: 'suffix', statKey: 'cd_shieldBash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 20 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['body', 'weapon']), tooltipText: '-{value}% Shield Bash Cooldown' }),

    // === Global ability modifiers (2, iLevel >= 8) ===
    Object.freeze({ id: 'of_might', displayName: 'of Might', position: 'suffix', statKey: 'dmg_all_abilities',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 18 }), iLevelMin: 8, weight: 25,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% All Ability Damage' }),
    Object.freeze({ id: 'of_haste', displayName: 'of Haste', position: 'suffix', statKey: 'cd_all_abilities',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 12 }), iLevelMin: 8, weight: 25,
      appliesTo: Object.freeze(['head', 'boots']), tooltipText: '-{value}% All Ability Cooldowns' }),

    // === Luxury (2) ===
    Object.freeze({ id: 'of_wisdom', displayName: 'of Wisdom', position: 'suffix', statKey: 'xp_gain',
      valueType: 'percent', range: Object.freeze({ min: 5, max: 15 }), iLevelMin: 5, weight: 30,
      appliesTo: Object.freeze(['head']), tooltipText: '+{value}% XP Gain' }),
    Object.freeze({ id: 'of_greed', displayName: 'of Greed', position: 'suffix', statKey: 'gold_find',
      valueType: 'percent', range: Object.freeze({ min: 10, max: 30 }), iLevelMin: 5, weight: 30,
      appliesTo: Object.freeze(['head', 'boots']), tooltipText: '+{value}% Gold Find' })
  ]);

  // ---------------------------------------------------------------------------
  // ITEM_BASES / POTION_DEFS — placeholders, WP02 / WP04 will populate.
  // ---------------------------------------------------------------------------
  const ITEM_BASES = [/* WP02 fills this */];
  const POTION_DEFS = [/* WP04 fills this */];

  // ---------------------------------------------------------------------------
  // Module-private state
  // ---------------------------------------------------------------------------
  const _bonusCache = { flat: {}, percent: {}, version: 0 };
  // eslint-disable-next-line no-unused-vars
  let _potionCooldownUntil = 0;
  // eslint-disable-next-line no-unused-vars
  let _shopState = null;

  // ---------------------------------------------------------------------------
  // rollAffixes — deterministic weighted pick without replacement
  // ---------------------------------------------------------------------------
  function rollAffixes(iLevel, count, rng, itemType) {
    if (typeof rng !== 'function') rng = Math.random;
    if (typeof count !== 'number' || count <= 0) return [];

    const eligible = AFFIX_DEFS.filter(function (def) {
      if (def.iLevelMin > iLevel) return false;
      if (itemType && def.appliesTo && def.appliesTo.indexOf(itemType) === -1) return false;
      return true;
    });

    const result = [];
    const used = {};
    const target = Math.min(count, eligible.length);

    while (result.length < target) {
      // Build the list of still-pickable entries
      const remaining = [];
      let totalWeight = 0;
      for (let i = 0; i < eligible.length; i++) {
        const d = eligible[i];
        if (used[d.id]) continue;
        remaining.push(d);
        totalWeight += d.weight;
      }
      if (remaining.length === 0 || totalWeight <= 0) break;

      let roll = rng() * totalWeight;
      let pickedDef = remaining[remaining.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        roll -= remaining[i].weight;
        if (roll <= 0) { pickedDef = remaining[i]; break; }
      }
      used[pickedDef.id] = true;

      // Roll value inside range (inclusive)
      const range = pickedDef.range;
      const value = Math.round(range.min + rng() * (range.max - range.min));
      result.push({ defId: pickedDef.id, value: value });
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // recomputeBonuses / getBonus — AggregatedBonuses cache
  // ---------------------------------------------------------------------------
  function recomputeBonuses() {
    _bonusCache.flat = {};
    _bonusCache.percent = {};

    const eq = (typeof window !== 'undefined' && window.equipment) ? window.equipment : {};
    const slots = Object.keys(eq);
    for (let s = 0; s < slots.length; s++) {
      const item = eq[slots[s]];
      if (!item || !item.affixes) continue;
      for (let i = 0; i < item.affixes.length; i++) {
        const inst = item.affixes[i];
        if (!inst) continue;
        let def = null;
        for (let k = 0; k < AFFIX_DEFS.length; k++) {
          if (AFFIX_DEFS[k].id === inst.defId) { def = AFFIX_DEFS[k]; break; }
        }
        if (!def) continue;
        if (def.valueType === 'percent') {
          const cur = _bonusCache.percent[def.statKey] || 0;
          _bonusCache.percent[def.statKey] = cur + (inst.value / 100);
        } else {
          const curF = _bonusCache.flat[def.statKey] || 0;
          _bonusCache.flat[def.statKey] = curF + inst.value;
        }
      }
    }
    _bonusCache.version++;

    if (typeof window !== 'undefined' && typeof window._refreshAbilityHUD === 'function') {
      try { window._refreshAbilityHUD(); } catch (e) { /* swallow HUD errors */ }
    }
    return _bonusCache;
  }

  function getBonus(statKey) {
    if (Object.prototype.hasOwnProperty.call(_bonusCache.flat, statKey)) {
      return _bonusCache.flat[statKey];
    }
    if (Object.prototype.hasOwnProperty.call(_bonusCache.percent, statKey)) {
      return _bonusCache.percent[statKey];
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Stubs — later WPs fill in the bodies. Throw-on-call so callers fail loudly.
  // ---------------------------------------------------------------------------
  function rollItem(/* baseKey, iLevel, forceTier */) {
    throw new Error('rollItem: not implemented in WP01 (WP02)');
  }
  function composeName(/* item */) {
    throw new Error('composeName: not implemented in WP01 (WP02)');
  }
  function grantGold(/* amount */) {
    throw new Error('grantGold: not implemented in WP01 (WP03)');
  }
  function getGold() {
    throw new Error('getGold: not implemented in WP01 (WP03)');
  }
  function spendGold(/* amount */) {
    throw new Error('spendGold: not implemented in WP01 (WP03)');
  }
  function consumePotion(/* slot */) {
    throw new Error('consumePotion: not implemented in WP01 (WP04)');
  }
  function onPotionKey() {
    throw new Error('onPotionKey: not implemented in WP01 (WP04)');
  }
  function isPotionOnCooldown() {
    throw new Error('isPotionOnCooldown: not implemented in WP01 (WP04)');
  }
  function getOrCreateShopState() {
    throw new Error('getOrCreateShopState: not implemented in WP01 (WP06)');
  }
  function rerollItem(/* item, costGold */) {
    throw new Error('rerollItem: not implemented in WP01 (WP06)');
  }
  function migrateSave(/* saveData */) {
    throw new Error('migrateSave: not implemented in WP01 (WP02)');
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.LootSystem = {
    // data
    AFFIX_DEFS: AFFIX_DEFS,
    ITEM_BASES: ITEM_BASES,
    POTION_DEFS: POTION_DEFS,

    // implemented in WP01
    rollAffixes: rollAffixes,
    recomputeBonuses: recomputeBonuses,
    getBonus: getBonus,

    // stubs (later WPs)
    rollItem: rollItem,
    composeName: composeName,
    grantGold: grantGold,
    getGold: getGold,
    spendGold: spendGold,
    consumePotion: consumePotion,
    onPotionKey: onPotionKey,
    isPotionOnCooldown: isPotionOnCooldown,
    getOrCreateShopState: getOrCreateShopState,
    rerollItem: rerollItem,
    migrateSave: migrateSave,

    // internal cache handle exposed for tests (read-only by convention)
    _bonusCache: _bonusCache
  };
})();
