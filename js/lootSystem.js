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
  // ITEM_BASES — 13 frozen base item templates from data-model.md (WP02)
  // POTION_DEFS — placeholder, WP04 will populate.
  // ---------------------------------------------------------------------------
  const ITEM_BASES = Object.freeze([
    // Weapons (4)
    Object.freeze({ key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Eisenklinge', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: 8 }), dropWeight: Object.freeze({ 1: 100, 5: 80, 10: 50, 15: 30 }) }),
    Object.freeze({ key: 'WPN_SCHATTENDOLCH', type: 'weapon', name: 'Schattendolch', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: 5, speed: 15, crit: 5 }), dropWeight: Object.freeze({ 3: 60, 8: 80, 15: 100 }) }),
    Object.freeze({ key: 'WPN_KETTENMORGENSTERN', type: 'weapon', name: 'Kettenmorgenstern', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: 12, speed: -5 }), dropWeight: Object.freeze({ 5: 40, 10: 80, 18: 60 }) }),
    Object.freeze({ key: 'WPN_GLUTAXT', type: 'weapon', name: 'Glutaxt', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: 15, speed: -10 }), dropWeight: Object.freeze({ 8: 30, 12: 60, 18: 80 }) }),

    // Helms (3)
    Object.freeze({ key: 'HD_KETTENHAUBE', type: 'head', name: 'Kettenhaube', iconKey: 'itHead',
      baseStats: Object.freeze({ armor: 5 }), dropWeight: Object.freeze({ 1: 100, 5: 80, 10: 40 }) }),
    Object.freeze({ key: 'HD_BRONZEHELM', type: 'head', name: 'Bronzehelm', iconKey: 'itHead',
      baseStats: Object.freeze({ armor: 8 }), dropWeight: Object.freeze({ 4: 80, 10: 100, 15: 60 }) }),
    Object.freeze({ key: 'HD_SCHLANGENMASKE', type: 'head', name: 'Schlangenmaske', iconKey: 'itHead',
      baseStats: Object.freeze({ armor: 4, crit: 5 }), dropWeight: Object.freeze({ 6: 50, 12: 80, 18: 100 }) }),

    // Body armor (3)
    Object.freeze({ key: 'BD_LEDERHARNISCH', type: 'body', name: 'Lederharnisch', iconKey: 'itBody',
      baseStats: Object.freeze({ armor: 6, speed: 5 }), dropWeight: Object.freeze({ 1: 100, 5: 60, 10: 30 }) }),
    Object.freeze({ key: 'BD_PLATTENPANZER', type: 'body', name: 'Plattenpanzer', iconKey: 'itBody',
      baseStats: Object.freeze({ armor: 15, speed: -5 }), dropWeight: Object.freeze({ 5: 60, 10: 100, 15: 80 }) }),
    Object.freeze({ key: 'BD_SCHATTENKUTTE', type: 'body', name: 'Schattenkutte', iconKey: 'itBody',
      baseStats: Object.freeze({ armor: 4, speed: 10, crit: 3 }), dropWeight: Object.freeze({ 6: 40, 12: 80, 18: 100 }) }),

    // Boots (3)
    Object.freeze({ key: 'BT_LEDERSTIEFEL', type: 'boots', name: 'Lederstiefel', iconKey: 'itBoots',
      baseStats: Object.freeze({ speed: 15 }), dropWeight: Object.freeze({ 1: 100, 5: 80, 10: 40 }) }),
    Object.freeze({ key: 'BT_STAHLSOHLEN', type: 'boots', name: 'Stahlsohlen', iconKey: 'itBoots',
      baseStats: Object.freeze({ armor: 6, speed: 8 }), dropWeight: Object.freeze({ 4: 80, 10: 100 }) }),
    Object.freeze({ key: 'BT_WINDLAEUFER', type: 'boots', name: 'Windläufer', iconKey: 'itBoots',
      baseStats: Object.freeze({ speed: 25, crit: 2 }), dropWeight: Object.freeze({ 8: 50, 14: 100 }) })
  ]);
  // WP04: 4 health potion tiers (Minor / Normal / Major / Super)
  const POTION_DEFS = Object.freeze([
    Object.freeze({
      potionTier: 1, name: 'Heiltrank (Klein)', healPercent: 0.30, healDurationMs: 3000,
      goldCost: 25, stackSize: 5, iconKey: 'itPotionMinor', iLevelMin: 1
    }),
    Object.freeze({
      potionTier: 2, name: 'Heiltrank', healPercent: 0.60, healDurationMs: 3000,
      goldCost: 75, stackSize: 5, iconKey: 'itPotionNormal', iLevelMin: 4
    }),
    Object.freeze({
      potionTier: 3, name: 'Heiltrank (Gross)', healPercent: 1.00, healDurationMs: 3000,
      goldCost: 200, stackSize: 5, iconKey: 'itPotionMajor', iLevelMin: 8
    }),
    Object.freeze({
      potionTier: 4, name: 'Heiltrank (Super)', healPercent: 1.00, healDurationMs: 3000,
      goldCost: 500, stackSize: 5, iconKey: 'itPotionSuper', iLevelMin: 12,
      bonusEffect: Object.freeze({ tempMaxHp: 0.10, durationMs: 30000 })
    })
  ]);

  // ---------------------------------------------------------------------------
  // Module-private state
  // ---------------------------------------------------------------------------
  const _bonusCache = { flat: {}, percent: {}, version: 0 };
  let _potionCooldownUntil = 0;
  const POTION_GLOBAL_CD_MS = 2000;
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
  // WP02: rollItem / composeName / migrateSave
  // ---------------------------------------------------------------------------

  function _interpolateDropWeight(dropWeightMap, iLevel) {
    const keys = Object.keys(dropWeightMap).map(Number).sort(function (a, b) { return a - b; });
    if (keys.length === 0) return 0;
    if (iLevel <= keys[0]) return dropWeightMap[keys[0]];
    if (iLevel >= keys[keys.length - 1]) return dropWeightMap[keys[keys.length - 1]];
    for (let i = 0; i < keys.length - 1; i++) {
      if (iLevel >= keys[i] && iLevel <= keys[i + 1]) {
        const t = (iLevel - keys[i]) / (keys[i + 1] - keys[i]);
        return dropWeightMap[keys[i]] * (1 - t) + dropWeightMap[keys[i + 1]] * t;
      }
    }
    return 0;
  }

  function _pickWeightedBase(iLevel, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    const weighted = [];
    for (let i = 0; i < ITEM_BASES.length; i++) {
      const w = _interpolateDropWeight(ITEM_BASES[i].dropWeight, iLevel);
      if (w > 0) weighted.push({ base: ITEM_BASES[i], weight: w });
    }
    if (weighted.length === 0) return ITEM_BASES[0];
    let total = 0;
    for (let i = 0; i < weighted.length; i++) total += weighted[i].weight;
    let r = rng() * total;
    for (let i = 0; i < weighted.length; i++) {
      r -= weighted[i].weight;
      if (r <= 0) return weighted[i].base;
    }
    return weighted[weighted.length - 1].base;
  }

  function _rollTier(iLevel, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    const shift = Math.max(0, (iLevel - 5)) * 0.01;
    const weights = [
      Math.max(0, 0.60 - shift * 1.5), // Common
      Math.max(0, 0.30 - shift * 0.5), // Magic
      Math.min(1, 0.08 + shift * 1.0), // Rare
      Math.min(1, 0.02 + shift * 1.0)  // Legendary
    ];
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  function rollItem(baseKey, iLevel, forceTier) {
    if (typeof iLevel !== 'number' || !Number.isFinite(iLevel)) iLevel = 1;
    let base;
    if (baseKey) {
      for (let i = 0; i < ITEM_BASES.length; i++) {
        if (ITEM_BASES[i].key === baseKey) { base = ITEM_BASES[i]; break; }
      }
      if (!base) throw new Error('Unknown item base: ' + baseKey);
    } else {
      base = _pickWeightedBase(iLevel, Math.random);
    }

    const tier = (forceTier !== undefined && forceTier !== null) ? forceTier : _rollTier(iLevel, Math.random);
    const affixCount = tier;
    const affixes = rollAffixes(iLevel, affixCount, Math.random, base.type);

    const item = {
      key: base.key,
      type: base.type,
      _baseName: base.name,
      iconKey: base.iconKey,
      tier: tier,
      iLevel: iLevel,
      requiredLevel: Math.max(1, iLevel - 2),
      baseStats: JSON.parse(JSON.stringify(base.baseStats)),
      affixes: affixes,
      displayName: ''
    };
    item.displayName = composeName(item);
    return item;
  }

  function composeName(item) {
    if (!item) return 'Item';
    const baseName = item._baseName || item.name || 'Item';
    if (!item.tier || item.tier === 0 || !item.affixes || item.affixes.length === 0) {
      return baseName;
    }
    const defs = [];
    for (let i = 0; i < item.affixes.length; i++) {
      const inst = item.affixes[i];
      if (!inst) continue;
      let def = null;
      for (let k = 0; k < AFFIX_DEFS.length; k++) {
        if (AFFIX_DEFS[k].id === inst.defId) { def = AFFIX_DEFS[k]; break; }
      }
      if (def) defs.push(def);
    }
    const prefixes = defs.filter(function (d) { return d.position === 'prefix'; });
    const suffixes = defs.filter(function (d) { return d.position === 'suffix'; });

    let name = baseName;
    if (item.tier === 1) {
      if (prefixes.length > 0) {
        name = prefixes[0].displayName + ' ' + baseName;
      } else if (suffixes.length > 0) {
        name = baseName + ' ' + suffixes[0].displayName;
      }
    } else if (item.tier === 2) {
      const p = prefixes[0] ? prefixes[0].displayName : '';
      const s = suffixes[0] ? suffixes[0].displayName : '';
      name = (p + ' ' + baseName + ' ' + s).trim().replace(/\s+/g, ' ');
    } else if (item.tier === 3) {
      const p1 = prefixes[0] ? prefixes[0].displayName : '';
      const p2 = prefixes[1] ? prefixes[1].displayName : '';
      const s1 = suffixes[0] ? suffixes[0].displayName : '';
      const s2 = suffixes[1] ? suffixes[1].displayName : '';
      name = (p1 + ' ' + p2 + ' ' + baseName + ' ' + s1 + ' ' + s2).trim().replace(/\s+/g, ' ');
      if (name.length > 50) {
        name = (p1 + ' ' + baseName + ' ' + s1 + ' [Legendary]').trim().replace(/\s+/g, ' ');
      }
    }
    return name;
  }
  // ---------------------------------------------------------------------------
  // WP03: Gold Currency
  //
  // Gold lives on `window.materialCounts.GOLD` so it rides the existing
  // save/load pipeline in js/storage.js (which serialises every key of
  // `window.materialCounts`). HUD refresh hooks into `window._refreshHUD`
  // (optional — tests and headless runs simply skip it).
  // ---------------------------------------------------------------------------
  function _ensureGoldStore() {
    if (typeof window === 'undefined') return null;
    if (!window.materialCounts || typeof window.materialCounts !== 'object') {
      window.materialCounts = {};
    }
    if (typeof window.materialCounts.GOLD !== 'number' || !Number.isFinite(window.materialCounts.GOLD)) {
      window.materialCounts.GOLD = 0;
    }
    return window.materialCounts;
  }

  function _refreshGoldHUD() {
    if (typeof window === 'undefined') return;
    if (typeof window._refreshHUD === 'function') {
      try { window._refreshHUD(); } catch (e) { /* swallow HUD errors */ }
    }
  }

  function grantGold(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const store = _ensureGoldStore();
    if (!store) return;
    store.GOLD = Math.max(0, Math.floor(store.GOLD + amount));
    _refreshGoldHUD();
  }

  function getGold() {
    const store = _ensureGoldStore();
    if (!store) return 0;
    return store.GOLD || 0;
  }

  function spendGold(amount) {
    if (!Number.isFinite(amount) || amount < 0) return false;
    const store = _ensureGoldStore();
    if (!store) return false;
    const current = store.GOLD || 0;
    if (current < amount) return false;
    store.GOLD = Math.max(0, Math.floor(current - amount));
    _refreshGoldHUD();
    return true;
  }
  // ---------------------------------------------------------------------------
  // WP04: Health Potions — consumePotion / onPotionKey / isPotionOnCooldown
  // ---------------------------------------------------------------------------
  function isPotionOnCooldown() {
    return Date.now() < _potionCooldownUntil;
  }

  function _findActiveScene() {
    if (typeof window === 'undefined') return null;
    if (window.gameScene && window.gameScene.time) return window.gameScene;
    try {
      if (window.game && window.game.scene && Array.isArray(window.game.scene.scenes)) {
        for (let i = 0; i < window.game.scene.scenes.length; i++) {
          const s = window.game.scene.scenes[i];
          if (s && s.sys && typeof s.sys.isActive === 'function' && s.sys.isActive() && s.time) {
            return s;
          }
        }
      }
    } catch (e) { /* swallow */ }
    return null;
  }

  function _applyHoT(def) {
    if (typeof window === 'undefined') return;
    if (typeof window.playerMaxHealth !== 'number') return;
    if (typeof window.addPlayerHealth !== 'function') return;
    const totalHeal = Math.round(def.healPercent * window.playerMaxHealth);
    const tickIntervalMs = 100;
    const ticks = Math.max(1, Math.floor(def.healDurationMs / tickIntervalMs));
    const perTick = Math.max(1, Math.floor(totalHeal / ticks));
    const scene = _findActiveScene();
    if (!scene || !scene.time || typeof scene.time.delayedCall !== 'function') {
      // Fallback: instant heal (also used in tests)
      window.addPlayerHealth(totalHeal);
    } else {
      for (let i = 0; i < ticks; i++) {
        scene.time.delayedCall(i * tickIntervalMs, function () {
          if (typeof window.addPlayerHealth === 'function') {
            window.addPlayerHealth(perTick);
          }
        });
      }
    }
    // Super tier bonus: temp max HP boost
    if (def.bonusEffect && def.bonusEffect.tempMaxHp) {
      const bonus = Math.round(window.playerMaxHealth * def.bonusEffect.tempMaxHp);
      if (bonus > 0) {
        window.playerMaxHealth = window.playerMaxHealth + bonus;
        window.addPlayerHealth(bonus);
        if (scene && scene.time && typeof scene.time.delayedCall === 'function') {
          scene.time.delayedCall(def.bonusEffect.durationMs, function () {
            window.playerMaxHealth = Math.max(1, window.playerMaxHealth - bonus);
            if (typeof window.playerHealth === 'number' && window.playerHealth > window.playerMaxHealth) {
              window.playerHealth = window.playerMaxHealth;
            }
          });
        }
      }
    }
  }

  function consumePotion(slot) {
    if (isPotionOnCooldown()) return false;
    if (typeof slot !== 'number') return false;
    if (typeof window === 'undefined' || !Array.isArray(window.inventory)) return false;
    const item = window.inventory[slot];
    if (!item || item.type !== 'potion') return false;
    let def = null;
    for (let i = 0; i < POTION_DEFS.length; i++) {
      if (POTION_DEFS[i].potionTier === item.potionTier) { def = POTION_DEFS[i]; break; }
    }
    if (!def) return false;
    _applyHoT(def);
    const stack = item.stack || 1;
    if (stack > 1) {
      item.stack = stack - 1;
    } else {
      window.inventory[slot] = null;
    }
    _potionCooldownUntil = Date.now() + POTION_GLOBAL_CD_MS;
    if (typeof window._refreshInventoryHUD === 'function') {
      try { window._refreshInventoryHUD(); } catch (e) { /* swallow */ }
    }
    return true;
  }

  function onPotionKey() {
    if (isPotionOnCooldown()) return false;
    if (typeof window === 'undefined' || !Array.isArray(window.inventory)) return false;
    let bestSlot = -1;
    let bestTier = 0;
    for (let i = 0; i < window.inventory.length; i++) {
      const it = window.inventory[i];
      if (it && it.type === 'potion' && typeof it.potionTier === 'number' && it.potionTier > bestTier) {
        bestTier = it.potionTier;
        bestSlot = i;
      }
    }
    if (bestSlot < 0) return false;
    return consumePotion(bestSlot);
  }

  function _getPotionCooldownRemaining() {
    return Math.max(0, _potionCooldownUntil - Date.now());
  }
  function _resetPotionCooldown() {
    _potionCooldownUntil = 0;
  }
  // ---------------------------------------------------------------------------
  // WP06: Shop state (Mara Schwarzmarkt)
  // ---------------------------------------------------------------------------
  let _lastShopRunId = null;
  const SHOP_STOCK_COUNT = 7;

  function _currentRunId() {
    if (typeof window === 'undefined') return 'default';
    if (window.dungeonRun && window.dungeonRun.runId) return window.dungeonRun.runId;
    if (typeof window.currentRunSeed !== 'undefined' && window.currentRunSeed !== null) {
      return 'seed:' + window.currentRunSeed;
    }
    if (typeof window.currentWave === 'number') return 'wave:' + window.currentWave;
    return 'default';
  }

  function _generateShopStock(runId) {
    const depth = (typeof window !== 'undefined' && typeof window.currentWave === 'number')
      ? Math.max(1, window.currentWave)
      : (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number' ? window.DUNGEON_DEPTH : 3);
    const stock = [];
    for (let i = 0; i < SHOP_STOCK_COUNT; i++) {
      try {
        const it = rollItem(null, depth);
        if (it) stock.push(it);
      } catch (err) { /* skip */ }
    }
    return stock;
  }

  function getOrCreateShopState(runIdOverride) {
    const runId = (typeof runIdOverride !== 'undefined' && runIdOverride !== null)
      ? runIdOverride
      : _currentRunId();
    if (!_shopState || _lastShopRunId !== runId) {
      _lastShopRunId = runId;
      _shopState = {
        currentRunId: runId,
        generatedAt: Date.now(),
        itemStock: _generateShopStock(runId)
      };
    }
    return _shopState;
  }

  function _computeRerollCost(item) {
    if (!item || typeof item.tier !== 'number') return 0;
    const tierMult = [1, 2, 4, 8];
    const t = Math.max(0, Math.min(3, item.tier));
    const iLevel = (typeof item.iLevel === 'number' && item.iLevel > 0) ? item.iLevel : 1;
    return Math.max(1, Math.round(50 * tierMult[t] * (1 + iLevel * 0.05)));
  }

  function rerollItem(item, costGold) {
    if (!item || typeof item.tier !== 'number') return false;
    const expected = (typeof costGold === 'number') ? costGold : _computeRerollCost(item);
    if (!spendGold(expected)) return false;
    const iLevel = (typeof item.iLevel === 'number' && item.iLevel > 0) ? item.iLevel : 1;
    const count = Math.max(0, item.tier | 0);
    item.affixes = rollAffixes(iLevel, count, Math.random, item.type);
    try { item.displayName = composeName(item); } catch (e) { /* swallow */ }
    return true;
  }
  function migrateSave(saveData) {
    if (!saveData) return saveData;
    if (typeof saveData.saveVersion === 'number' && saveData.saveVersion >= 2) {
      return saveData;
    }

    const migrateItem = function (item) {
      if (!item || typeof item !== 'object') return item;
      // Already migrated?
      if (typeof item.tier === 'number' && Array.isArray(item.affixes)) {
        return item;
      }
      // Strip old fields
      delete item.rarity;
      delete item.rarityValue;
      delete item.rarityLabel;
      delete item.enhanceLevel;
      // Add new fields with defaults
      item.tier = 0;
      item.affixes = [];
      if (typeof item.iLevel !== 'number') {
        item.iLevel = (typeof item.itemLevel === 'number') ? item.itemLevel : 1;
      }
      if (typeof item.requiredLevel !== 'number') item.requiredLevel = 1;
      if (!item.baseStats || typeof item.baseStats !== 'object') {
        const stats = {};
        const statKeys = ['damage', 'armor', 'hp', 'speed', 'crit', 'range'];
        for (let i = 0; i < statKeys.length; i++) {
          const k = statKeys[i];
          if (typeof item[k] === 'number') stats[k] = item[k];
        }
        item.baseStats = stats;
      }
      if (!item.displayName) {
        item.displayName = item._baseName || item.name || 'Item';
      }
      return item;
    };

    if (Array.isArray(saveData.inventory)) {
      for (let i = 0; i < saveData.inventory.length; i++) {
        saveData.inventory[i] = migrateItem(saveData.inventory[i]);
      }
    }
    if (saveData.equipment && typeof saveData.equipment === 'object') {
      const slots = Object.keys(saveData.equipment);
      for (let i = 0; i < slots.length; i++) {
        saveData.equipment[slots[i]] = migrateItem(saveData.equipment[slots[i]]);
      }
    }

    saveData.saveVersion = 2;
    return saveData;
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
    _getPotionCooldownRemaining: _getPotionCooldownRemaining,
    _resetPotionCooldown: _resetPotionCooldown,
    POTION_GLOBAL_CD_MS: POTION_GLOBAL_CD_MS,
    getOrCreateShopState: getOrCreateShopState,
    rerollItem: rerollItem,
    _computeRerollCost: _computeRerollCost,
    migrateSave: migrateSave,

    // internal cache handle exposed for tests (read-only by convention)
    _bonusCache: _bonusCache
  };
})();
