// js/lootSystem.js
// Loot & Economy Overhaul — Foundation & Affix Engine (WP01).

if (window.i18n) {
  window.i18n.register('de', {
    // Affix displayNames (used in composeName to build "Sharp Iron Blade")
    'loot.affix.sharp_dmg': 'Scharfe',
    'loot.affix.sturdy_armor': 'Robuste',
    'loot.affix.of_health': 'des Bären',
    'loot.affix.swift_speed': 'Flinke',
    'loot.affix.of_precision': 'der Präzision',
    'loot.affix.of_reach': 'der Reichweite',
    'loot.affix.fire_warding': 'Feuerfeste',
    'loot.affix.cold_warding': 'Frostfeste',
    'loot.affix.lightning_warding': 'Sturmfeste',
    'loot.affix.of_the_leech': 'des Egels',
    'loot.affix.spinning_dmg': 'Wirbelnde',
    'loot.affix.charged_dmg': 'Geladene',
    'loot.affix.dashing_dmg': 'Hetzende',
    'loot.affix.piercing_dmg': 'Durchdringende',
    'loot.affix.bashing_dmg': 'Schmetternde',
    'loot.affix.of_swift_spin': 'des schnellen Wirbels',
    'loot.affix.of_swift_charge': 'der schnellen Ladung',
    'loot.affix.of_swift_dash': 'des schnellen Hetzens',
    'loot.affix.of_swift_dagger': 'des schnellen Dolchs',
    'loot.affix.of_swift_bash': 'des schnellen Schmetterns',
    'loot.affix.of_might': 'der Macht',
    'loot.affix.of_haste': 'der Eile',
    'loot.affix.of_wisdom': 'der Weisheit',
    'loot.affix.of_greed': 'der Gier',

    // Affix tooltip texts (with {value} placeholder). Used by inventory.js
    // when rendering item tooltips.
    'loot.affix.sharp_dmg.tooltip': '+{value}% Schaden',
    'loot.affix.sturdy_armor.tooltip': '+{value} Rüstung',
    'loot.affix.of_health.tooltip': '+{value} LP',
    'loot.affix.swift_speed.tooltip': '+{value}% Tempo',
    'loot.affix.of_precision.tooltip': '+{value}% Krit-Chance',
    'loot.affix.of_reach.tooltip': '+{value} Reichweite',
    'loot.affix.fire_warding.tooltip': '+{value}% Feuerresistenz',
    'loot.affix.cold_warding.tooltip': '+{value}% Frostresistenz',
    'loot.affix.lightning_warding.tooltip': '+{value}% Blitzresistenz',
    'loot.affix.of_the_leech.tooltip': '+{value}% Lebensraub',
    'loot.affix.spinning_dmg.tooltip': '+{value}% Wirbelangriff-Schaden',
    'loot.affix.charged_dmg.tooltip': '+{value}% Aufgeladener Schlag-Schaden',
    'loot.affix.dashing_dmg.tooltip': '+{value}% Sturmhieb-Schaden',
    'loot.affix.piercing_dmg.tooltip': '+{value}% Dolchwurf-Schaden',
    'loot.affix.bashing_dmg.tooltip': '+{value}% Schildstoß-Schaden',
    'loot.affix.of_swift_spin.tooltip': '-{value}% Wirbelangriff-Cooldown',
    'loot.affix.of_swift_charge.tooltip': '-{value}% Aufgeladener Schlag-Cooldown',
    'loot.affix.of_swift_dash.tooltip': '-{value}% Sturmhieb-Cooldown',
    'loot.affix.of_swift_dagger.tooltip': '-{value}% Dolchwurf-Cooldown',
    'loot.affix.of_swift_bash.tooltip': '-{value}% Schildstoß-Cooldown',
    'loot.affix.of_might.tooltip': '+{value}% Schaden aller Fähigkeiten',
    'loot.affix.of_haste.tooltip': '-{value}% Cooldown aller Fähigkeiten',
    'loot.affix.of_wisdom.tooltip': '+{value}% XP-Gewinn',
    'loot.affix.of_greed.tooltip': '+{value}% Gold-Find',

    'loot.item.WPN_EISENKLINGE': 'Eisenklinge',
    'loot.item.WPN_SCHATTENDOLCH': 'Schattendolch',
    'loot.item.WPN_KETTENMORGENSTERN': 'Kettenmorgenstern',
    'loot.item.WPN_GLUTAXT': 'Glutaxt',
    'loot.item.WPN_ESCHENBOGEN': 'Eschenbogen',
    'loot.item.WPN_HORNBOGEN': 'Hornbogen',
    'loot.item.WPN_GLUTBOGEN': 'Glutbogen',
    'loot.item.HD_KETTENHAUBE': 'Kettenhaube',
    'loot.item.HD_BRONZEHELM': 'Bronzehelm',
    'loot.item.HD_SCHLANGENMASKE': 'Schlangenmaske',
    'loot.item.BD_LEDERHARNISCH': 'Lederharnisch',
    'loot.item.BD_PLATTENPANZER': 'Plattenpanzer',
    'loot.item.BD_SCHATTENKUTTE': 'Schattenkutte',
    'loot.item.BT_LEDERSTIEFEL': 'Lederstiefel',
    'loot.item.BT_STAHLSOHLEN': 'Stahlsohlen',
    'loot.item.BT_WINDLAEUFER': 'Windläufer',
    'loot.potion.t1': 'Heiltrank (S)',
    'loot.potion.t2': 'Heiltrank (M)',
    'loot.potion.t3': 'Heiltrank (L)',
    'loot.potion.t4': 'Heiltrank (XL)',
    'loot.fallback.item': 'Gegenstand'
  });
  window.i18n.register('en', {
    'loot.affix.sharp_dmg': 'Sharp',
    'loot.affix.sturdy_armor': 'Sturdy',
    'loot.affix.of_health': 'of the Bear',
    'loot.affix.swift_speed': 'Swift',
    'loot.affix.of_precision': 'of Precision',
    'loot.affix.of_reach': 'of Reach',
    'loot.affix.fire_warding': 'Fireproof',
    'loot.affix.cold_warding': 'Frostproof',
    'loot.affix.lightning_warding': 'Stormproof',
    'loot.affix.of_the_leech': 'of the Leech',
    'loot.affix.spinning_dmg': 'Spinning',
    'loot.affix.charged_dmg': 'Charged',
    'loot.affix.dashing_dmg': 'Dashing',
    'loot.affix.piercing_dmg': 'Piercing',
    'loot.affix.bashing_dmg': 'Bashing',
    'loot.affix.of_swift_spin': 'of Swift Spin',
    'loot.affix.of_swift_charge': 'of Swift Charge',
    'loot.affix.of_swift_dash': 'of Swift Dash',
    'loot.affix.of_swift_dagger': 'of Swift Dagger',
    'loot.affix.of_swift_bash': 'of Swift Bash',
    'loot.affix.of_might': 'of Might',
    'loot.affix.of_haste': 'of Haste',
    'loot.affix.of_wisdom': 'of Wisdom',
    'loot.affix.of_greed': 'of Greed',

    'loot.affix.sharp_dmg.tooltip': '+{value}% Damage',
    'loot.affix.sturdy_armor.tooltip': '+{value} Armor',
    'loot.affix.of_health.tooltip': '+{value} HP',
    'loot.affix.swift_speed.tooltip': '+{value}% Speed',
    'loot.affix.of_precision.tooltip': '+{value}% Crit Chance',
    'loot.affix.of_reach.tooltip': '+{value} Range',
    'loot.affix.fire_warding.tooltip': '+{value}% Fire Resist',
    'loot.affix.cold_warding.tooltip': '+{value}% Cold Resist',
    'loot.affix.lightning_warding.tooltip': '+{value}% Lightning Resist',
    'loot.affix.of_the_leech.tooltip': '+{value}% Life Steal',
    'loot.affix.spinning_dmg.tooltip': '+{value}% Spin Attack Damage',
    'loot.affix.charged_dmg.tooltip': '+{value}% Charged Slash Damage',
    'loot.affix.dashing_dmg.tooltip': '+{value}% Dash Slash Damage',
    'loot.affix.piercing_dmg.tooltip': '+{value}% Dagger Throw Damage',
    'loot.affix.bashing_dmg.tooltip': '+{value}% Shield Bash Damage',
    'loot.affix.of_swift_spin.tooltip': '-{value}% Spin Attack Cooldown',
    'loot.affix.of_swift_charge.tooltip': '-{value}% Charged Slash Cooldown',
    'loot.affix.of_swift_dash.tooltip': '-{value}% Dash Slash Cooldown',
    'loot.affix.of_swift_dagger.tooltip': '-{value}% Dagger Throw Cooldown',
    'loot.affix.of_swift_bash.tooltip': '-{value}% Shield Bash Cooldown',
    'loot.affix.of_might.tooltip': '+{value}% All Ability Damage',
    'loot.affix.of_haste.tooltip': '-{value}% All Ability Cooldowns',
    'loot.affix.of_wisdom.tooltip': '+{value}% XP Gain',
    'loot.affix.of_greed.tooltip': '+{value}% Gold Find',

    'loot.item.WPN_EISENKLINGE': 'Iron Blade',
    'loot.item.WPN_SCHATTENDOLCH': 'Shadow Dagger',
    'loot.item.WPN_KETTENMORGENSTERN': 'Chain Morningstar',
    'loot.item.WPN_GLUTAXT': 'Ember Axe',
    'loot.item.WPN_ESCHENBOGEN': 'Ash Bow',
    'loot.item.WPN_HORNBOGEN': 'Horn Bow',
    'loot.item.WPN_GLUTBOGEN': 'Ember Bow',
    'loot.item.HD_KETTENHAUBE': 'Chain Coif',
    'loot.item.HD_BRONZEHELM': 'Bronze Helm',
    'loot.item.HD_SCHLANGENMASKE': 'Serpent Mask',
    'loot.item.BD_LEDERHARNISCH': 'Leather Harness',
    'loot.item.BD_PLATTENPANZER': 'Plate Armor',
    'loot.item.BD_SCHATTENKUTTE': 'Shadow Cloak',
    'loot.item.BT_LEDERSTIEFEL': 'Leather Boots',
    'loot.item.BT_STAHLSOHLEN': 'Steel Soles',
    'loot.item.BT_WINDLAEUFER': 'Wind Walkers',
    'loot.potion.t1': 'Healing Potion (S)',
    'loot.potion.t2': 'Healing Potion (M)',
    'loot.potion.t3': 'Healing Potion (L)',
    'loot.potion.t4': 'Healing Potion (XL)',
    'loot.fallback.item': 'Item'
  });
}
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

    // Bows (ranged weapons — equipping one swaps default attack to a projectile)
    Object.freeze({ key: 'WPN_ESCHENBOGEN', type: 'weapon', subtype: 'bow', name: 'Eschenbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: 6, range: 80 }), dropWeight: Object.freeze({ 2: 40, 6: 60, 12: 30 }) }),
    Object.freeze({ key: 'WPN_HORNBOGEN', type: 'weapon', subtype: 'bow', name: 'Hornbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: 9, range: 100, crit: 4 }), dropWeight: Object.freeze({ 6: 40, 12: 70, 18: 50 }) }),
    Object.freeze({ key: 'WPN_GLUTBOGEN', type: 'weapon', subtype: 'bow', name: 'Glutbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: 13, range: 120, speed: -5 }), dropWeight: Object.freeze({ 10: 30, 15: 60, 20: 70 }) }),

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
      potionTier: 1, name: 'Heiltrank (S)', healPercent: 0.30, healDurationMs: 3000,
      goldCost: 25, stackSize: 5, iconKey: 'itPotionMinor', iLevelMin: 1
    }),
    Object.freeze({
      potionTier: 2, name: 'Heiltrank (M)', healPercent: 0.60, healDurationMs: 3000,
      goldCost: 75, stackSize: 5, iconKey: 'itPotionNormal', iLevelMin: 4
    }),
    Object.freeze({
      potionTier: 3, name: 'Heiltrank (L)', healPercent: 1.00, healDurationMs: 3000,
      goldCost: 200, stackSize: 5, iconKey: 'itPotionMajor', iLevelMin: 8
    }),
    Object.freeze({
      potionTier: 4, name: 'Heiltrank (XL)', healPercent: 1.00, healDurationMs: 3000,
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
    // D2-like curves: flatter scaling, capped Rare/Legendary.
    const shift = Math.max(0, (iLevel - 5)) * 0.003;
    const weights = [
      Math.max(0, 0.78 - shift * 1.2),      // Common
      Math.max(0, 0.20 - shift * 0.3),      // Magic
      Math.min(0.05, 0.02 + shift * 0.4),   // Rare       (capped 5%)
      Math.min(0.02, 0.003 + shift * 0.3)   // Legendary  (capped 2%)
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

    const _itemNameKey = 'loot.item.' + base.key;
    const _localizedBase = (window.i18n
      ? (function () {
          const v = window.i18n.t(_itemNameKey);
          return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : base.name;
        })()
      : base.name);
    const item = {
      key: base.key,
      type: base.type,
      subtype: base.subtype,
      name: _localizedBase,
      nameKey: _itemNameKey,
      _baseName: _localizedBase,
      iconKey: base.iconKey,
      tier: tier,
      iLevel: iLevel,
      itemLevel: iLevel,
      requiredLevel: Math.max(1, iLevel - 2),
      baseStats: JSON.parse(JSON.stringify(base.baseStats)),
      affixes: affixes,
      displayName: ''
    };
    // Mirror baseStats to top-level fields so legacy readers (inventory
    // tooltip, equipSelectedItem, recalcDerived, ability code) that look at
    // it.hp / it.damage / etc. find the values without having to walk the
    // baseStats subobject.
    // NOTE: ITEM_BASES stores speed/armor/crit as percentages (e.g. -10 = -10%)
    // but recalcDerived adds them as FLAT values. Convert the percent-style
    // stats to fractions here so summing them in recalcDerived works correctly.
    const _statKeys = ['hp', 'damage', 'speed', 'range', 'armor', 'crit', 'move'];
    const _percentStats = { speed: true, armor: true, crit: true };
    for (let _i = 0; _i < _statKeys.length; _i++) {
      const _k = _statKeys[_i];
      if (typeof base.baseStats[_k] === 'number') {
        item[_k] = _percentStats[_k] ? base.baseStats[_k] / 100 : base.baseStats[_k];
      }
    }
    item.displayName = composeName(item);
    return item;
  }

  function composeName(item) {
    if (!item) return (window.i18n ? window.i18n.t('loot.fallback.item') : 'Item');
    // Potions: derive i18n key from potionTier when nameKey is missing.
    let nameKey = item.nameKey;
    if (!nameKey && item.type === 'potion' && item.potionTier) {
      nameKey = 'loot.potion.t' + item.potionTier;
    }
    let baseName;
    if (window.i18n && nameKey) {
      const v = window.i18n.t(nameKey);
      baseName = (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : (item._baseName || item.name);
    } else {
      baseName = item._baseName || item.name || (window.i18n ? window.i18n.t('loot.fallback.item') : 'Item');
    }
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
    // Localized affix-name lookup: prefer i18n key over hardcoded displayName
    function _affixName(def) {
      if (window.i18n && def && def.id) {
        var v = window.i18n.t('loot.affix.' + def.id);
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return def ? def.displayName : '';
    }
    const prefixes = defs.filter(function (d) { return d.position === 'prefix'; });
    const suffixes = defs.filter(function (d) { return d.position === 'suffix'; });

    let name = baseName;
    if (item.tier === 1) {
      if (prefixes.length > 0) {
        name = _affixName(prefixes[0]) + ' ' + baseName;
      } else if (suffixes.length > 0) {
        name = baseName + ' ' + _affixName(suffixes[0]);
      }
    } else if (item.tier === 2) {
      const p = _affixName(prefixes[0]);
      const s = _affixName(suffixes[0]);
      name = (p + ' ' + baseName + ' ' + s).trim().replace(/\s+/g, ' ');
    } else if (item.tier === 3) {
      const p1 = _affixName(prefixes[0]);
      const p2 = _affixName(prefixes[1]);
      const s1 = _affixName(suffixes[0]);
      const s2 = _affixName(suffixes[1]);
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

  // Invalidate the cached shop state so the next getOrCreateShopState() call
  // builds a fresh stock roll. Called when the player leaves the hub to enter
  // the dungeon — Mara's inventory should feel fresh run-to-run rather than
  // showing the same items the player already browsed.
  function refreshShop() {
    _shopState = null;
    _lastShopRunId = null;
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
    // i18n helper: always re-resolves item name + affixes against current
    // language. Consumers should prefer this over reading item.displayName
    // (which is snapped at instantiation and may be stale after a switch).
    getLocalizedDisplayName: function (item) { return composeName(item); },
    // i18n helper: resolve an affix's tooltip string in the active language
    // with the {value} placeholder filled in. Falls back to def.tooltipText
    // when no key is registered.
    getAffixTooltipText: function (def, value) {
      if (!def) return '';
      if (window.i18n) {
        var v = window.i18n.t('loot.affix.' + def.id + '.tooltip', { value: value });
        if (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) return v;
      }
      return (def.tooltipText || '').split('{value}').join(String(value));
    },
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
    refreshShop: refreshShop,
    rerollItem: rerollItem,
    _computeRerollCost: _computeRerollCost,
    migrateSave: migrateSave,

    // internal cache handle exposed for tests (read-only by convention)
    _bonusCache: _bonusCache
  };

  // Re-snap item.displayName for every live item when language changes so
  // legacy consumers reading item.displayName see the new language without
  // having to adopt getLocalizedDisplayName everywhere.
  if (window.i18n) {
    window.i18n.onChange(function () {
      var pools = [];
      if (typeof inventory !== 'undefined' && Array.isArray(inventory)) pools.push(inventory);
      if (typeof equipment !== 'undefined' && equipment && typeof equipment === 'object') {
        pools.push(Object.values(equipment));
      }
      pools.forEach(function (pool) {
        pool.forEach(function (item) {
          if (item && typeof item === 'object') {
            try { item.displayName = composeName(item); } catch (e) { /* ignore */ }
          }
        });
      });
      // Trigger HUD repaint (gold text uses _refreshHUD; potion tile uses
      // its own refresh; both already wired to onChange in main.js — but
      // repaint here too in case other consumers cache).
      if (typeof window._refreshHUD === 'function') { try { window._refreshHUD(); } catch (e) {} }
    });
  }

  // -------------------------------------------------------------------------
  // Tutorial wrappers (feature 044).
  //
  // spawnLoot / collectLoot live in loot.js (loads AFTER lootSystem.js).
  // GameScene is defined inline in main.js (which WP04 must not modify per
  // its brief). Both globals are wrapped on the next tick so the originals
  // exist; the GameScene overlay hook polls the global scene manager for up
  // to 10 s after boot, then attaches a 'create'/'start' listener that
  // mounts the tutorial overlay whenever GameScene activates with the
  // tutorial active.
  // -------------------------------------------------------------------------
  function _wrapLootGlobals() {
    if (typeof window === 'undefined') return;
    if (typeof window.spawnLoot === 'function' && !window.spawnLoot._tutorialWrapped) {
      var origSpawn = window.spawnLoot;
      window.spawnLoot = function (x, y, maybeItem, sourceEnemy) {
        var ret = origSpawn.apply(this, arguments);
        if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
          try {
            window.TutorialSystem.report('loot.dropped', { itemId: (maybeItem && maybeItem.id) || null });
          } catch (_) { /* never crash gameplay */ }
        }
        return ret;
      };
      window.spawnLoot._tutorialWrapped = true;
    }
    if (typeof window.collectLoot === 'function' && !window.collectLoot._tutorialWrapped) {
      var origCollect = window.collectLoot;
      window.collectLoot = function (playerSprite, loot) {
        var item = (loot && loot.getData) ? loot.getData('item') : null;
        var ret = origCollect.apply(this, arguments);
        if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
          try {
            window.TutorialSystem.report('loot.picked', { itemId: (item && item.id) || null });
          } catch (_) { /* never crash gameplay */ }
        }
        return ret;
      };
      window.collectLoot._tutorialWrapped = true;
    }
  }

  function _hookGameSceneOverlay() {
    if (typeof window === 'undefined') return false;
    if (!window.game || !window.game.scene || !window.TutorialOverlay) return false;
    var scenes = (window.game.scene.scenes || []);
    var hooked = false;
    for (var i = 0; i < scenes.length; i++) {
      var sc = scenes[i];
      if (!sc || !sc.scene || !sc.events) continue;
      if (sc.scene.key !== 'GameScene') continue;
      if (sc._tutorialOverlayHookInstalled) { hooked = true; continue; }
      sc._tutorialOverlayHookInstalled = true;
      hooked = true;
      var mountFor = function (scene) {
        if (!window.TutorialOverlay || !window.TutorialSystem) return;
        if (scene._tutorialOverlay) return;
        if (!window.TutorialSystem.isActive || !window.TutorialSystem.isActive()) return;
        try {
          scene._tutorialOverlay = window.TutorialOverlay.create(scene);
          scene._tutorialOverlay.mount();
        } catch (e) { /* swallow */ }
      };
      sc.events.on('create', (function (s) { return function () { mountFor(s); }; })(sc));
      sc.events.on('start',  (function (s) { return function () { mountFor(s); }; })(sc));
      if (sc.scene.isActive && sc.scene.isActive()) mountFor(sc);
      if (typeof window.TutorialSystem.onChange === 'function' && !sc._tutorialUnsubInstalled) {
        sc._tutorialUnsubInstalled = true;
        sc._tutorialUnsub = window.TutorialSystem.onChange((function (s) {
          return function (step) {
            if (step) {
              mountFor(s);
            } else if (s._tutorialOverlay) {
              try { s._tutorialOverlay.unmount(); } catch (e) {}
              s._tutorialOverlay = null;
            }
          };
        })(sc));
        sc.events.once('shutdown', (function (s) {
          return function () {
            if (s._tutorialUnsub) { try { s._tutorialUnsub(); } catch (e) {} s._tutorialUnsub = null; }
            if (s._tutorialOverlay) { try { s._tutorialOverlay.unmount(); } catch (e) {} s._tutorialOverlay = null; }
          };
        })(sc));
      }
    }
    return hooked;
  }

  if (typeof setTimeout === 'function') {
    setTimeout(function () {
      _wrapLootGlobals();
      var attempts = 0;
      var poll = function () {
        if (_hookGameSceneOverlay()) return;
        if (++attempts < 40) setTimeout(poll, 250); // up to 10 s
      };
      poll();
    }, 0);
  }
})();
