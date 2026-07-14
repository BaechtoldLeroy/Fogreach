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
    'loot.affix.of_swiftness': 'des Windes',
    'loot.affix.of_the_leech': 'des Egels',
    'loot.affix.spinning_dmg': 'Wirbelnde',
    'loot.affix.charged_dmg': 'Wuchtige',
    'loot.affix.dashing_dmg': 'Saugende',
    'loot.affix.piercing_dmg': 'Frostige',
    'loot.affix.bashing_dmg': 'Tödliche',
    'loot.affix.of_swift_spin': 'des schnellen Wirbels',
    'loot.affix.of_swift_charge': 'des schnellen Hammers',
    'loot.affix.of_swift_dash': 'des Wirbelsogs',
    'loot.affix.of_swift_dagger': 'des Frosts',
    'loot.affix.of_swift_bash': 'der Hinrichtung',
    'loot.affix.twisting_dmg': 'Schneidende',
    'loot.affix.grasping_dmg': 'Greifende',
    'loot.affix.charging_dmg': 'Stürmende',
    'loot.affix.of_swift_grasp': 'des Stahlgriffs',
    'loot.affix.of_swift_charge2': 'des Ansturms',
    'loot.affix.of_swift_step': 'des Schattenschritts',
    'loot.affix.of_swift_heal': 'der Heilung',
    'loot.affix.of_swift_frenzy': 'der Raserei',
    'loot.affix.of_swift_berserk': 'des Berserkers',
    'loot.affix.of_might': 'der Macht',
    'loot.affix.of_haste': 'der Eile',
    'loot.affix.of_wisdom': 'der Weisheit',
    'loot.affix.of_greed': 'der Gier',
    'loot.affix.attr_strength': 'der Stärke',
    'loot.affix.attr_dexterity': 'der Geschicklichkeit',
    'loot.affix.attr_vitality': 'der Vitalität',
    'loot.affix.attr_focus': 'des Fokus',

    // Affix tooltip texts (with {value} placeholder). Used by inventory.js
    // when rendering item tooltips.
    'loot.affix.sharp_dmg.tooltip': '+{value}% Schaden',
    'loot.affix.sturdy_armor.tooltip': '+{value}% Rüstung',
    'loot.affix.of_health.tooltip': '+{value} LP',
    'loot.affix.swift_speed.tooltip': '+{value}% Angriffstempo',
    'loot.affix.of_precision.tooltip': '+{value}% Krit-Chance',
    'loot.affix.of_reach.tooltip': '+{value} Reichweite',
    'loot.affix.of_swiftness.tooltip': '+{value} Lauftempo',
    'loot.affix.of_the_leech.tooltip': '+{value}% Lebensraub',
    'loot.affix.spinning_dmg.tooltip': '+{value}% Wirbelwind-Schaden',
    'loot.affix.charged_dmg.tooltip': '+{value}% Hammer-Schaden',
    'loot.affix.dashing_dmg.tooltip': '+{value}% Wirbelsog-Schaden',
    'loot.affix.piercing_dmg.tooltip': '+{value}% Frostnova-Schaden',
    'loot.affix.bashing_dmg.tooltip': '+{value}% Todesstoss-Schaden',
    'loot.affix.of_swift_spin.tooltip': '-{value}% Wirbelwind-Cooldown',
    'loot.affix.of_swift_charge.tooltip': '-{value}% Hammer-Cooldown',
    'loot.affix.of_swift_dash.tooltip': '-{value}% Wirbelsog-Cooldown',
    'loot.affix.of_swift_dagger.tooltip': '-{value}% Frostnova-Cooldown',
    'loot.affix.of_swift_bash.tooltip': '-{value}% Todesstoss-Cooldown',
    'loot.affix.twisting_dmg.tooltip': '+{value}% Wirbelklingen-Schaden',
    'loot.affix.grasping_dmg.tooltip': '+{value}% Stahlgriff-Schaden',
    'loot.affix.charging_dmg.tooltip': '+{value}% Ansturm-Schaden',
    'loot.affix.of_swift_grasp.tooltip': '-{value}% Stahlgriff-Cooldown',
    'loot.affix.of_swift_charge2.tooltip': '-{value}% Ansturm-Cooldown',
    'loot.affix.of_swift_step.tooltip': '-{value}% Schattenschritt-Cooldown',
    'loot.affix.of_swift_heal.tooltip': '-{value}% Heilwunde-Cooldown',
    'loot.affix.of_swift_frenzy.tooltip': '-{value}% Raserei-Cooldown',
    'loot.affix.of_swift_berserk.tooltip': '-{value}% Berserker-Cooldown',
    'loot.affix.of_might.tooltip': '+{value}% Schaden aller Fähigkeiten',
    'loot.affix.of_haste.tooltip': '-{value}% Cooldown aller Fähigkeiten',
    'loot.affix.of_wisdom.tooltip': '+{value}% XP-Gewinn',
    'loot.affix.of_greed.tooltip': '+{value}% Gold-Find',
    'loot.affix.attr_strength.tooltip': '+{value} Stärke',
    'loot.affix.attr_dexterity.tooltip': '+{value} Geschicklichkeit',
    'loot.affix.attr_vitality.tooltip': '+{value} Vitalität',
    'loot.affix.attr_focus.tooltip': '+{value} Fokus',

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
    'loot.fallback.item': 'Gegenstand',
    // Feature 059 (#42): kurze Effektbeschreibung pro Amulett (Shop/UI).
    'amulet.fx.twin': 'Greift zweimal an (2. Treffer 60%)',
    'amulet.fx.chain': 'Treffer springt auf 2 nahe Gegner',
    'amulet.fx.cleave': 'Nahkampf trifft rundum (360°)',
    'amulet.fx.lifesteal': 'Heilt 18% des Schadens',
    'amulet.fx.aura': 'Brennende Aura schadet Gegnern nahebei',
    'amulet.fx.tempo': 'Mehr Lauf- und Angriffstempo',
    'amulet.fx.orbit': 'Rotierende Klingen umkreisen dich',
    'amulet.fx.killburst': 'Getötete Gegner explodieren',
    'amulet.fx.dashstrike': 'Ausweichrolle phast durch und verletzt',
    'amulet.fx.momentum': 'Mehr Schaden je Kill (stapelt sich)',
    'amulet.fx.frost': 'Treffer frosten; Frost-Gegner zersplittern',
    'amulet.fx.glass': '+50% Schaden, −25% Max-LP',
    'amulet.fx.revive': 'Überlebt den Tod 1× pro Run',
    'amulet.fx.bloodpact': 'Fähigkeiten ohne Cooldown, kosten LP',
    'shop.amulet.section': '— Amulette (run-spezifisch) —',
    // Feature 059 (#42) WP05: localized amulet names (keyed by effect).
    'amulet.name.twin': 'Amulett der Zwillingsklinge',
    'amulet.name.chain': 'Kettenherz',
    'amulet.name.cleave': 'Schnitterband',
    'amulet.name.lifesteal': 'Aderlass-Talisman',
    'amulet.name.aura': 'Brandmal der Gier',
    'amulet.name.tempo': 'Sturmschritt-Amulett',
    'amulet.name.orbit': 'Trabantenstein',
    'amulet.name.killburst': 'Aschefunke',
    'amulet.name.dashstrike': 'Schattenmantel',
    'amulet.name.momentum': 'Schlächterkrone',
    'amulet.name.frost': 'Frostsiegel',
    'amulet.name.glass': 'Glasherz',
    'amulet.name.revive': 'Zweiter Atem',
    'amulet.name.bloodpact': 'Blutpakt'
  });
  window.i18n.register('en', {
    'loot.affix.sharp_dmg': 'Sharp',
    'loot.affix.sturdy_armor': 'Sturdy',
    'loot.affix.of_health': 'of the Bear',
    'loot.affix.swift_speed': 'Swift',
    'loot.affix.of_precision': 'of Precision',
    'loot.affix.of_reach': 'of Reach',
    'loot.affix.of_swiftness': 'of Swiftness',
    'loot.affix.of_the_leech': 'of the Leech',
    'loot.affix.spinning_dmg': 'Whirling',
    'loot.affix.charged_dmg': 'Forceful',
    'loot.affix.dashing_dmg': 'Drawing',
    'loot.affix.piercing_dmg': 'Frostbound',
    'loot.affix.bashing_dmg': 'Deadly',
    'loot.affix.of_swift_spin': 'of Swift Whirling',
    'loot.affix.of_swift_charge': 'of the Hammer',
    'loot.affix.of_swift_dash': 'of the Cyclone',
    'loot.affix.of_swift_dagger': 'of Frost',
    'loot.affix.of_swift_bash': 'of Execution',
    'loot.affix.twisting_dmg': 'Twisting',
    'loot.affix.grasping_dmg': 'Grasping',
    'loot.affix.charging_dmg': 'Charging',
    'loot.affix.of_swift_grasp': 'of Swift Grasp',
    'loot.affix.of_swift_charge2': 'of the Charge',
    'loot.affix.of_swift_step': 'of Swift Stepping',
    'loot.affix.of_swift_heal': 'of Swift Mending',
    'loot.affix.of_swift_frenzy': 'of Frenzy',
    'loot.affix.of_swift_berserk': 'of Fury',
    'loot.affix.of_might': 'of Might',
    'loot.affix.of_haste': 'of Haste',
    'loot.affix.of_wisdom': 'of Wisdom',
    'loot.affix.of_greed': 'of Greed',
    'loot.affix.attr_strength': 'of Strength',
    'loot.affix.attr_dexterity': 'of Dexterity',
    'loot.affix.attr_vitality': 'of Vitality',
    'loot.affix.attr_focus': 'of Focus',

    'loot.affix.sharp_dmg.tooltip': '+{value}% Damage',
    'loot.affix.sturdy_armor.tooltip': '+{value}% Armor',
    'loot.affix.of_health.tooltip': '+{value} HP',
    'loot.affix.swift_speed.tooltip': '+{value}% Attack Speed',
    'loot.affix.of_precision.tooltip': '+{value}% Crit Chance',
    'loot.affix.of_reach.tooltip': '+{value} Range',
    'loot.affix.of_swiftness.tooltip': '+{value} Movement Speed',
    'loot.affix.of_the_leech.tooltip': '+{value}% Life Steal',
    'loot.affix.spinning_dmg.tooltip': '+{value}% Whirlwind Damage',
    'loot.affix.charged_dmg.tooltip': '+{value}% Hammer Damage',
    'loot.affix.dashing_dmg.tooltip': '+{value}% Cyclone Strike Damage',
    'loot.affix.piercing_dmg.tooltip': '+{value}% Frost Nova Damage',
    'loot.affix.bashing_dmg.tooltip': '+{value}% Death Blow Damage',
    'loot.affix.of_swift_spin.tooltip': '-{value}% Whirlwind Cooldown',
    'loot.affix.of_swift_charge.tooltip': '-{value}% Hammer Cooldown',
    'loot.affix.of_swift_dash.tooltip': '-{value}% Cyclone Strike Cooldown',
    'loot.affix.of_swift_dagger.tooltip': '-{value}% Frost Nova Cooldown',
    'loot.affix.of_swift_bash.tooltip': '-{value}% Death Blow Cooldown',
    'loot.affix.twisting_dmg.tooltip': '+{value}% Twisting Blades Damage',
    'loot.affix.grasping_dmg.tooltip': '+{value}% Steel Grasp Damage',
    'loot.affix.charging_dmg.tooltip': '+{value}% Charge Damage',
    'loot.affix.of_swift_grasp.tooltip': '-{value}% Steel Grasp Cooldown',
    'loot.affix.of_swift_charge2.tooltip': '-{value}% Charge Cooldown',
    'loot.affix.of_swift_step.tooltip': '-{value}% Shadow Step Cooldown',
    'loot.affix.of_swift_heal.tooltip': '-{value}% Heal Wound Cooldown',
    'loot.affix.of_swift_frenzy.tooltip': '-{value}% Frenzy Cooldown',
    'loot.affix.of_swift_berserk.tooltip': '-{value}% Berserk Cooldown',
    'loot.affix.of_might.tooltip': '+{value}% All Ability Damage',
    'loot.affix.of_haste.tooltip': '-{value}% All Ability Cooldowns',
    'loot.affix.of_wisdom.tooltip': '+{value}% XP Gain',
    'loot.affix.of_greed.tooltip': '+{value}% Gold Find',
    'loot.affix.attr_strength.tooltip': '+{value} Strength',
    'loot.affix.attr_dexterity.tooltip': '+{value} Dexterity',
    'loot.affix.attr_vitality.tooltip': '+{value} Vitality',
    'loot.affix.attr_focus.tooltip': '+{value} Focus',

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
    'loot.fallback.item': 'Item',
    // Feature 059 (#42): short per-amulet effect blurbs (shop/UI).
    'amulet.fx.twin': 'Strikes twice (2nd hit 60%)',
    'amulet.fx.chain': 'Hits jump to 2 nearby foes',
    'amulet.fx.cleave': 'Melee hits all around (360°)',
    'amulet.fx.lifesteal': 'Heals 18% of damage dealt',
    'amulet.fx.aura': 'Burning aura damages nearby foes',
    'amulet.fx.tempo': 'More move & attack speed',
    'amulet.fx.orbit': 'Rotating blades orbit you',
    'amulet.fx.killburst': 'Slain foes explode',
    'amulet.fx.dashstrike': 'Dodge roll phases through & hurts',
    'amulet.fx.momentum': 'More damage per kill (stacks)',
    'amulet.fx.frost': 'Hits chill; frozen foes shatter',
    'amulet.fx.glass': '+50% damage, -25% max HP',
    'amulet.fx.revive': 'Survive death once per run',
    'amulet.fx.bloodpact': 'Abilities cost HP, no cooldown',
    'shop.amulet.section': '— Amulets (run-specific) —',
    // Feature 059 (#42) WP05: localized amulet names (keyed by effect).
    'amulet.name.twin': 'Twinblade Amulet',
    'amulet.name.chain': 'Chainheart',
    'amulet.name.cleave': "Reaper's Band",
    'amulet.name.lifesteal': 'Bloodletting Talisman',
    'amulet.name.aura': 'Brand of Greed',
    'amulet.name.tempo': 'Storm-Step Amulet',
    'amulet.name.orbit': 'Satellite Stone',
    'amulet.name.killburst': 'Ashspark',
    'amulet.name.dashstrike': 'Shadowmantle',
    'amulet.name.momentum': "Slayer's Crown",
    'amulet.name.frost': 'Frost Seal',
    'amulet.name.glass': 'Glass Heart',
    'amulet.name.revive': 'Second Wind',
    'amulet.name.bloodpact': 'Blood Pact'
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
  // AFFIX_DEFS — 22 frozen entries (orig. 24 minus 3 resists + 1 move affix).
  // ---------------------------------------------------------------------------
  const AFFIX_DEFS = Object.freeze([
    // === Base stats (7) ===
    Object.freeze({ id: 'sharp_dmg', displayName: 'Sharp', position: 'prefix', statKey: 'damage',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 33 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value}% Damage' }),
    Object.freeze({ id: 'sturdy_armor', displayName: 'Sturdy', position: 'prefix', statKey: 'armor',
      valueType: 'percent', range: Object.freeze({ min: 2, max: 9 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['head', 'body', 'boots']), tooltipText: '+{value}% Armor' }),
    Object.freeze({ id: 'of_health', displayName: 'of the Bear', position: 'suffix', statKey: 'hp',
      valueType: 'flat', range: Object.freeze({ min: 3, max: 34 }), iLevelMin: 1, weight: 100,
      appliesTo: Object.freeze(['head', 'body', 'boots', 'weapon']), tooltipText: '+{value} HP' }),
    Object.freeze({ id: 'swift_speed', displayName: 'Swift', position: 'prefix', statKey: 'speed',
      valueType: 'percent', range: Object.freeze({ min: 4, max: 21 }), iLevelMin: 1, weight: 80,
      appliesTo: Object.freeze(['boots', 'body']), tooltipText: '+{value}% Speed' }),
    Object.freeze({ id: 'of_precision', displayName: 'of Precision', position: 'suffix', statKey: 'crit',
      valueType: 'percent', range: Object.freeze({ min: 2, max: 13 }), iLevelMin: 3, weight: 80,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '+{value}% Crit Chance' }),
    Object.freeze({ id: 'of_reach', displayName: 'of Reach', position: 'suffix', statKey: 'range',
      valueType: 'flat', range: Object.freeze({ min: 8, max: 41 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value} Range' }),
    // Lauftempo (movement speed) — wirkt auf playerSpeed via getBonus('move').
    // Bewusst getrennt von swift_speed (statKey 'speed' = ANGRIFFstempo).
    // Bereich klein + nur Stiefel (1 Slot): Bewegung ist sensibel, und #37
    // skaliert den flachen Wert mit der Tiefe — sonst balloniert es (Basis 160).
    Object.freeze({ id: 'of_swiftness', displayName: 'of Swiftness', position: 'suffix', statKey: 'move',
      valueType: 'flat', range: Object.freeze({ min: 5, max: 25 }), iLevelMin: 1, weight: 80,
      appliesTo: Object.freeze(['boots']), tooltipText: '+{value} Movement Speed' }),

    // === Defensive (1) ===
    Object.freeze({ id: 'of_the_leech', displayName: 'of the Leech', position: 'suffix', statKey: 'lifesteal',
      valueType: 'percent', range: Object.freeze({ min: 1, max: 8 }), iLevelMin: 6, weight: 40,
      appliesTo: Object.freeze(['weapon']), tooltipText: '+{value}% Life Steal' }),

    // === Per-ability damage (5) ===
    Object.freeze({ id: 'spinning_dmg', displayName: 'Whirling', position: 'prefix', statKey: 'dmg_spinAttack',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Whirlwind Damage' }),
    Object.freeze({ id: 'charged_dmg', displayName: 'Forceful', position: 'prefix', statKey: 'dmg_chargeSlash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Hammer Damage' }),
    Object.freeze({ id: 'dashing_dmg', displayName: 'Drawing', position: 'prefix', statKey: 'dmg_dashSlash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'boots']), tooltipText: '+{value}% Cyclone Strike Damage' }),
    Object.freeze({ id: 'piercing_dmg', displayName: 'Frostbound', position: 'prefix', statKey: 'dmg_daggerThrow',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '+{value}% Frost Nova Damage' }),
    Object.freeze({ id: 'bashing_dmg', displayName: 'Deadly', position: 'prefix', statKey: 'dmg_shieldBash',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 60,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Death Blow Damage' }),
    // 060: Schaden-Affixe für die übrigen schadensbringenden Skills.
    Object.freeze({ id: 'twisting_dmg', displayName: 'Twisting', position: 'prefix', statKey: 'dmg_twistingBlades',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 55,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '+{value}% Twisting Blades Damage' }),
    Object.freeze({ id: 'grasping_dmg', displayName: 'Grasping', position: 'prefix', statKey: 'dmg_steelGrasp',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 55,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% Steel Grasp Damage' }),
    Object.freeze({ id: 'charging_dmg', displayName: 'Charging', position: 'prefix', statKey: 'dmg_charge',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 46 }), iLevelMin: 2, weight: 55,
      appliesTo: Object.freeze(['weapon', 'boots']), tooltipText: '+{value}% Charge Damage' }),

    // === Per-ability cooldown reduction (5) ===
    Object.freeze({ id: 'of_swift_spin', displayName: 'of Swift Whirling', position: 'suffix', statKey: 'cd_spinAttack',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '-{value}% Whirlwind Cooldown' }),
    Object.freeze({ id: 'of_swift_charge', displayName: 'of the Hammer', position: 'suffix', statKey: 'cd_chargeSlash',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '-{value}% Hammer Cooldown' }),
    Object.freeze({ id: 'of_swift_dash', displayName: 'of the Cyclone', position: 'suffix', statKey: 'cd_dashSlash',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['boots']), tooltipText: '-{value}% Cyclone Strike Cooldown' }),
    Object.freeze({ id: 'of_swift_dagger', displayName: 'of Frost', position: 'suffix', statKey: 'cd_daggerThrow',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['head']), tooltipText: '-{value}% Frost Nova Cooldown' }),
    Object.freeze({ id: 'of_swift_bash', displayName: 'of Execution', position: 'suffix', statKey: 'cd_shieldBash',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 50,
      appliesTo: Object.freeze(['body', 'weapon']), tooltipText: '-{value}% Death Blow Cooldown' }),
    // 060: Cooldown-Affixe für die übrigen Skills mit Abklingzeit.
    Object.freeze({ id: 'of_swift_grasp', displayName: 'of Swift Grasp', position: 'suffix', statKey: 'cd_steelGrasp',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '-{value}% Steel Grasp Cooldown' }),
    Object.freeze({ id: 'of_swift_charge2', displayName: 'of the Charge', position: 'suffix', statKey: 'cd_charge',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['boots', 'weapon']), tooltipText: '-{value}% Charge Cooldown' }),
    Object.freeze({ id: 'of_swift_step', displayName: 'of Swift Stepping', position: 'suffix', statKey: 'cd_teleportDash',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['boots', 'head']), tooltipText: '-{value}% Shadow Step Cooldown' }),
    Object.freeze({ id: 'of_swift_heal', displayName: 'of Swift Mending', position: 'suffix', statKey: 'cd_heilwunde',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['body', 'head']), tooltipText: '-{value}% Heal Wound Cooldown' }),
    Object.freeze({ id: 'of_swift_frenzy', displayName: 'of Frenzy', position: 'suffix', statKey: 'cd_frenzy',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['weapon', 'head']), tooltipText: '-{value}% Frenzy Cooldown' }),
    Object.freeze({ id: 'of_swift_berserk', displayName: 'of Fury', position: 'suffix', statKey: 'cd_berserk',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 24 }), iLevelMin: 3, weight: 45,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '-{value}% Berserk Cooldown' }),

    // === Global ability modifiers (2, iLevel >= 8) ===
    Object.freeze({ id: 'of_might', displayName: 'of Might', position: 'suffix', statKey: 'dmg_all_abilities',
      valueType: 'percent', range: Object.freeze({ min: 6, max: 26 }), iLevelMin: 8, weight: 25,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value}% All Ability Damage' }),
    Object.freeze({ id: 'of_haste', displayName: 'of Haste', position: 'suffix', statKey: 'cd_all_abilities',
      valueType: 'percent', range: Object.freeze({ min: 4, max: 17 }), iLevelMin: 8, weight: 25,
      appliesTo: Object.freeze(['head', 'boots']), tooltipText: '-{value}% All Ability Cooldowns' }),

    // === Luxury (2) ===
    Object.freeze({ id: 'of_wisdom', displayName: 'of Wisdom', position: 'suffix', statKey: 'xp_gain',
      valueType: 'percent', range: Object.freeze({ min: 4, max: 21 }), iLevelMin: 5, weight: 30,
      appliesTo: Object.freeze(['head']), tooltipText: '+{value}% XP Gain' }),
    Object.freeze({ id: 'of_greed', displayName: 'of Greed', position: 'suffix', statKey: 'gold_find',
      valueType: 'percent', range: Object.freeze({ min: 8, max: 41 }), iLevelMin: 5, weight: 30,
      appliesTo: Object.freeze(['head', 'boots']), tooltipText: '+{value}% Gold Find' }),

    // === D2-artige Kern-Attribute (4, #60) — flach, nur ueber Items. Fliessen
    // in recalcDerived: Staerke->Schaden%, Geschick->Krit+Tempo, Vitalitaet->LP,
    // Fokus->globale Cooldown-Reduktion. Je 2 Slot-Typen (Build-Differenzierung).
    Object.freeze({ id: 'attr_strength', displayName: 'of Strength', position: 'suffix', statKey: 'strength',
      valueType: 'flat', range: Object.freeze({ min: 2, max: 9 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['weapon', 'body']), tooltipText: '+{value} Strength' }),
    Object.freeze({ id: 'attr_dexterity', displayName: 'of Dexterity', position: 'suffix', statKey: 'dexterity',
      valueType: 'flat', range: Object.freeze({ min: 2, max: 9 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['weapon', 'boots']), tooltipText: '+{value} Dexterity' }),
    Object.freeze({ id: 'attr_vitality', displayName: 'of Vitality', position: 'suffix', statKey: 'vitality',
      valueType: 'flat', range: Object.freeze({ min: 2, max: 9 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['body', 'head']), tooltipText: '+{value} Vitality' }),
    Object.freeze({ id: 'attr_focus', displayName: 'of Focus', position: 'suffix', statKey: 'focus',
      valueType: 'flat', range: Object.freeze({ min: 2, max: 9 }), iLevelMin: 2, weight: 70,
      appliesTo: Object.freeze(['head', 'boots']), tooltipText: '+{value} Focus' })
  ]);

  // ---------------------------------------------------------------------------
  // ITEM_BASES — 13 frozen base item templates from data-model.md (WP02)
  // POTION_DEFS — placeholder, WP04 will populate.
  // ---------------------------------------------------------------------------
  const ITEM_BASES = Object.freeze([
    // Weapons (4)
    // #38: Waffen-Basisschaden ist ein gerolltes {min,max}-Band (statt Fixwert)
    // und ggü. früher ~halbiert, damit normale Gegner 1-3 Schläge brauchen statt
    // sofort zu sterben — der Gear-Spielraum (Affixe/Krit) zieht dann auf 1-2.
    // Boss/Elite/Miniboss-Multiplikatoren bewusst noch unverändert (Playtest).
    Object.freeze({ key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Eisenklinge', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 2, max: 5 }) }), dropWeight: Object.freeze({ 1: 100, 5: 80, 10: 50, 15: 30 }) }),
    Object.freeze({ key: 'WPN_SCHATTENDOLCH', type: 'weapon', name: 'Schattendolch', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 1, max: 4 }), speed: 15, crit: 5 }), dropWeight: Object.freeze({ 3: 60, 8: 80, 15: 100 }) }),
    Object.freeze({ key: 'WPN_KETTENMORGENSTERN', type: 'weapon', name: 'Kettenmorgenstern', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 4, max: 7 }), speed: -5 }), dropWeight: Object.freeze({ 5: 40, 10: 80, 18: 60 }) }),
    Object.freeze({ key: 'WPN_GLUTAXT', type: 'weapon', name: 'Glutaxt', iconKey: 'itWeapon',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 4, max: 6 }), speed: -10 }), dropWeight: Object.freeze({ 8: 30, 12: 60, 18: 80 }) }),

    // Bows (ranged weapons — equipping one swaps default attack to a projectile)
    Object.freeze({ key: 'WPN_ESCHENBOGEN', type: 'weapon', subtype: 'bow', name: 'Eschenbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 1, max: 4 }), range: 80 }), dropWeight: Object.freeze({ 2: 40, 6: 60, 12: 30 }) }),
    Object.freeze({ key: 'WPN_HORNBOGEN', type: 'weapon', subtype: 'bow', name: 'Hornbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 3, max: 6 }), range: 100, crit: 4 }), dropWeight: Object.freeze({ 6: 40, 12: 70, 18: 50 }) }),
    Object.freeze({ key: 'WPN_GLUTBOGEN', type: 'weapon', subtype: 'bow', name: 'Glutbogen', iconKey: 'itBow',
      baseStats: Object.freeze({ damage: Object.freeze({ min: 4, max: 7 }), range: 120, speed: -5 }), dropWeight: Object.freeze({ 10: 30, 15: 60, 20: 70 }) }),

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

    // Boots (3) — geben Lauftempo (move), nicht Angriffstempo. 'move' ist flach
    // (px/s auf playerSpeed), daher hier ganze Zahlen statt Prozent-Stil.
    Object.freeze({ key: 'BT_LEDERSTIEFEL', type: 'boots', name: 'Lederstiefel', iconKey: 'itBoots',
      baseStats: Object.freeze({ move: 18 }), dropWeight: Object.freeze({ 1: 100, 5: 80, 10: 40 }) }),
    Object.freeze({ key: 'BT_STAHLSOHLEN', type: 'boots', name: 'Stahlsohlen', iconKey: 'itBoots',
      baseStats: Object.freeze({ armor: 6, move: 10 }), dropWeight: Object.freeze({ 4: 80, 10: 100 }) }),
    Object.freeze({ key: 'BT_WINDLAEUFER', type: 'boots', name: 'Windläufer', iconKey: 'itBoots',
      baseStats: Object.freeze({ move: 30, crit: 2 }), dropWeight: Object.freeze({ 8: 50, 14: 100 }) })
  ]);

  // ---------------------------------------------------------------------------
  // Feature 059 (#42): Run-specific AMULET slot. Amulets are a SEPARATE pool
  // from ITEM_BASES and are NOT in the rollItem weighted droppool — they never
  // displace regular gear. WP01 = data model + roll path only; the run-defining
  // EFFECTS (effect key) are wired in WP03, spawn/merchant gating in WP04.
  // ---------------------------------------------------------------------------
  const AMULET_DEFS = Object.freeze([
    Object.freeze({ key: 'AMU_ZWILLINGSKLINGE', type: 'amulet', name: 'Amulett der Zwillingsklinge', iconKey: 'itAmulet', effect: 'twin',      depthMin: 10 }),
    Object.freeze({ key: 'AMU_KETTENHERZ',      type: 'amulet', name: 'Kettenherz',                  iconKey: 'itAmulet', effect: 'chain',     depthMin: 10 }),
    Object.freeze({ key: 'AMU_SCHNITTERBAND',   type: 'amulet', name: 'Schnitterband',               iconKey: 'itAmulet', effect: 'cleave',    depthMin: 10 }),
    Object.freeze({ key: 'AMU_ADERLASS',        type: 'amulet', name: 'Aderlass-Talisman',           iconKey: 'itAmulet', effect: 'lifesteal', depthMin: 10 }),
    Object.freeze({ key: 'AMU_BRANDMAL',        type: 'amulet', name: 'Brandmal der Gier',           iconKey: 'itAmulet', effect: 'aura',      depthMin: 10 }),
    Object.freeze({ key: 'AMU_STURMSCHRITT',    type: 'amulet', name: 'Sturmschritt-Amulett',        iconKey: 'itAmulet', effect: 'tempo',      depthMin: 10 }),
    // Run-defining "verb changers" (WP03 implements the behaviour per effect key):
    Object.freeze({ key: 'AMU_TRABANTENSTEIN',  type: 'amulet', name: 'Trabantenstein',              iconKey: 'itAmulet', effect: 'orbit',      depthMin: 10 }),
    Object.freeze({ key: 'AMU_ASCHEFUNKE',      type: 'amulet', name: 'Aschefunke',                  iconKey: 'itAmulet', effect: 'killburst',  depthMin: 10 }),
    Object.freeze({ key: 'AMU_SCHATTENMANTEL',  type: 'amulet', name: 'Schattenmantel',              iconKey: 'itAmulet', effect: 'dashstrike', depthMin: 10 }),
    Object.freeze({ key: 'AMU_SCHLAECHTERKRONE',type: 'amulet', name: 'Schlächterkrone',             iconKey: 'itAmulet', effect: 'momentum',   depthMin: 10 }),
    Object.freeze({ key: 'AMU_FROSTSIEGEL',     type: 'amulet', name: 'Frostsiegel',                 iconKey: 'itAmulet', effect: 'frost',      depthMin: 10 }),
    Object.freeze({ key: 'AMU_GLASHERZ',        type: 'amulet', name: 'Glasherz',                    iconKey: 'itAmulet', effect: 'glass',      depthMin: 10 }),
    Object.freeze({ key: 'AMU_ZWEITER_ATEM',    type: 'amulet', name: 'Zweiter Atem',                iconKey: 'itAmulet', effect: 'revive',     depthMin: 10 }),
    Object.freeze({ key: 'AMU_BLUTPAKT',        type: 'amulet', name: 'Blutpakt',                    iconKey: 'itAmulet', effect: 'bloodpact',  depthMin: 10 })
  ]);

  // Roll a run amulet (separate path from rollItem). Depth-bias on stronger
  // amulets is WP04 (D5); WP01 is a uniform pick among depth-eligible defs.
  // Returns an inventory-compatible item object (type 'amulet').
  function rollAmulet(depth, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    if (typeof depth !== 'number' || !Number.isFinite(depth)) depth = 10;
    var eligible = AMULET_DEFS.filter(function (a) { return (a.depthMin || 1) <= depth; });
    var pool = eligible.length ? eligible : AMULET_DEFS;
    var def = pool[Math.floor(rng() * pool.length)] || AMULET_DEFS[0];
    return {
      key: def.key,
      type: 'amulet',
      name: def.name,
      displayName: def.name,
      _baseName: def.name,
      // WP05 (#42): i18n name key (effect is unique per amulet) so composeName/
      // getLocalizedDisplayName resolve the localized name; def.name is the
      // DE fallback when i18n is absent.
      nameKey: 'amulet.name.' + def.effect,
      iconKey: def.iconKey,
      effect: def.effect,
      isAmulet: true,
      iLevel: depth,
      itemLevel: depth,
      requiredLevel: 1,
      tier: 0,
      affixes: [],
      baseStats: {}
    };
  }

  // Feature 059 (#42) WP04: early run-amulet spawn gate. Spec §0/D6: amulets
  // appear only from depth 10 AND as a CHANCE (not every run) — keeps the slot
  // a treat rather than a guaranteed staple. Pure -> unit-testable; roomManager
  // calls this once per run in initDungeonRun.
  const RUN_AMULET_MIN_DEPTH = 10;
  const RUN_AMULET_SPAWN_CHANCE = 0.5;
  function shouldSpawnRunAmulet(depth, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    if (typeof depth !== 'number' || !Number.isFinite(depth)) return false;
    if (depth < RUN_AMULET_MIN_DEPTH) return false;
    return rng() < RUN_AMULET_SPAWN_CHANCE;
  }

  // Short blurb for an amulet effect key (shop rows / future UI). Prefers the
  // localized i18n string; falls back to a built-in DE map so it still works
  // headless (tests) or before i18n is wired.
  const AMULET_FX_FALLBACK = Object.freeze({
    twin: 'Greift zweimal an (2. Treffer 60%)',
    chain: 'Treffer springt auf 2 nahe Gegner',
    cleave: 'Nahkampf trifft rundum (360°)',
    lifesteal: 'Heilt 18% des Schadens',
    aura: 'Brennende Aura schadet Gegnern nahebei',
    tempo: 'Mehr Lauf- und Angriffstempo',
    orbit: 'Rotierende Klingen umkreisen dich',
    killburst: 'Getötete Gegner explodieren',
    dashstrike: 'Ausweichrolle phast durch und verletzt',
    momentum: 'Mehr Schaden je Kill (stapelt sich)',
    frost: 'Treffer frosten; Frost-Gegner zersplittern',
    glass: '+50% Schaden, −25% Max-LP',
    revive: 'Überlebt den Tod 1× pro Run',
    bloodpact: 'Fähigkeiten ohne Cooldown, kosten LP'
  });
  function getAmuletEffectDesc(effect) {
    if (!effect) return '';
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t('amulet.fx.' + effect);
      if (typeof v === 'string' && v && v.indexOf('[MISSING:') !== 0) return v;
    }
    return AMULET_FX_FALLBACK[effect] || '';
  }

  // Feature 059 WP02: amulets are RUN-SPECIFIC and must never persist.
  // PERSISTENT_EQUIP_SLOTS is the save whitelist — it deliberately OMITS
  // 'amulet' so storage.js never serialises it (FR-12 save-guard). Single
  // source of truth shared with storage.js cloneEquipment.
  const PERSISTENT_EQUIP_SLOTS = Object.freeze(['weapon', 'head', 'body', 'boots']);

  // Null the amulet slot on a passed equipment object (used by the run-reset
  // in leaveDungeonForHub). Null-safe; returns the object for chaining.
  function clearRunAmulet(equipment) {
    if (equipment && typeof equipment === 'object') equipment.amulet = null;
    return equipment;
  }

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
  const POTION_GLOBAL_CD_MS = 8000;
  // eslint-disable-next-line no-unused-vars
  let _shopState = null;

  // ---------------------------------------------------------------------------
  // Issue #37 — D2-style affix value scaling with item level.
  // An affix rolls its base `range` right when it unlocks (at its iLevelMin)
  // and grows beyond it the deeper the item drops. This is what makes "go
  // deeper" mean "stronger rolls of the same affix" (Diablo-2 tiered-affix feel
  // via a smooth iLevel curve). Tunables — adjust after playtest:
  //   GROWTH    = +x of the base range per item level above the affix's iLevelMin
  //   MAX_SCALE = hard ceiling so percent stats can't balloon
  const AFFIX_ILVL_VALUE_GROWTH = 0.03;
  const AFFIX_ILVL_VALUE_MAX_SCALE = 2.5;

  function _affixValueScale(iLevel, iLevelMin) {
    const growth = Math.max(0, (iLevel || 1) - (iLevelMin || 1));
    return Math.min(AFFIX_ILVL_VALUE_MAX_SCALE, 1 + growth * AFFIX_ILVL_VALUE_GROWTH);
  }

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

      // Roll value inside the iLevel-scaled range (inclusive). The base range
      // is multiplied by an iLevel curve so deeper items roll bigger numbers of
      // the same affix (#37). At iLevel == iLevelMin the scale is 1 (base range).
      const range = pickedDef.range;
      const scale = _affixValueScale(iLevel, pickedDef.iLevelMin);
      const effMin = range.min * scale;
      const effMax = range.max * scale;
      let value = Math.round(effMin + rng() * (effMax - effMin));
      if (value < 1) value = 1;
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

  function _rollTier(iLevel, rng, qualityBias) {
    if (typeof rng !== 'function') rng = Math.random;
    // D2-like curves: flatter scaling, capped Rare/Legendary.
    const shift = Math.max(0, (iLevel - 5)) * 0.003;
    // Printing-House loot rarity bias: scales the higher-tier weights
    // (Magic/Rare/Legendary) and inversely shrinks Common.
    const _ph = (typeof window !== 'undefined') ? window.printingBuffs : null;
    const phBias = (_ph && typeof _ph.lootRarityBias === 'number' && _ph.lootRarityBias > 0)
      ? _ph.lootRarityBias : 1;
    // Issue #26 — Knowledge-Tree magicFindMult stacks multiplicatively with
    // the Printing-House bias. HIGHER magicFindMult → MORE rare/legendary.
    const _kt = (typeof window !== 'undefined') ? window.knowledgeTreeBuffs : null;
    const ktMf = (_kt && typeof _kt.magicFindMult === 'number' && _kt.magicFindMult > 0)
      ? _kt.magicFindMult : 1;
    // Optionaler Extra-Qualitaets-Bias (z. B. Blindkauf): multipliziert auf die
    // bestehenden Boni, sodass die Quelle IMMER >= Basis-Odds rollt.
    const _extra = (typeof qualityBias === 'number' && qualityBias > 0) ? qualityBias : 1;
    const bias = phBias * ktMf * _extra;
    const weights = [
      Math.max(0, 0.78 - shift * 1.2),                    // Common
      Math.max(0, (0.20 - shift * 0.3) * bias),           // Magic
      Math.min(0.05 * bias, (0.02 + shift * 0.4) * bias), // Rare       (capped scales with bias)
      Math.min(0.02 * bias, (0.003 + shift * 0.3) * bias) // Legendary  (capped scales with bias)
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

  function rollItem(baseKey, iLevel, forceTier, qualityBias) {
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

    const tier = (forceTier !== undefined && forceTier !== null) ? forceTier : _rollTier(iLevel, Math.random, qualityBias);
    const affixCount = tier;
    const affixes = rollAffixes(iLevel, affixCount, Math.random, base.type);

    const _itemNameKey = 'loot.item.' + base.key;
    const _localizedBase = (window.i18n
      ? (function () {
          const v = window.i18n.t(_itemNameKey);
          return (typeof v === 'string' && v.indexOf('[MISSING:') !== 0) ? v : base.name;
        })()
      : base.name);
    // Resolve baseStats first: a stat may be a fixed number OR a {min,max} band
    // (#38: weapons roll their base damage within a band, like affixes). Roll
    // once here so item.baseStats and the mirrored flat fields share the value.
    const _resolvedBase = {};
    const _baseKeys = Object.keys(base.baseStats);
    for (let _r = 0; _r < _baseKeys.length; _r++) {
      const _bk = _baseKeys[_r];
      const _bv = base.baseStats[_bk];
      if (_bv && typeof _bv === 'object' && typeof _bv.min === 'number' && typeof _bv.max === 'number') {
        let _rolled = _bv.min + Math.random() * (_bv.max - _bv.min);
        // Damage keeps ONE decimal place so the band roll reads as a fine,
        // visible spread (e.g. 3.0..5.0) instead of just 3/4/5. range/hp stay
        // whole numbers.
        if (_bk === 'damage') _rolled = Math.round(_rolled * 10) / 10;
        else if (_bk === 'range' || _bk === 'hp') _rolled = Math.round(_rolled);
        _resolvedBase[_bk] = _rolled;
      } else {
        _resolvedBase[_bk] = _bv;
      }
    }
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
      baseStats: _resolvedBase,
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
      if (typeof _resolvedBase[_k] === 'number') {
        item[_k] = _percentStats[_k] ? _resolvedBase[_k] / 100 : _resolvedBase[_k];
      }
    }

    // Unified item-level system (one formula for Normal + Schwierig). The
    // displayed `itemLevel` is STAT-WEIGHTED (computeItemLevelFromStats, loot.js:
    // depth + weighted base-stat sum), computed here at the single source so
    // every spawn path (drops, reward chests, shop) is consistent. The Hard
    // path (_applyDifficultyToRolledItem) re-applies the SAME formula after
    // scaling stats by the difficulty multiplier, so both difficulties share
    // one system instead of "Normal = raw depth, Hard = stat-based". `iLevel`
    // stays the raw generation depth (affix iLevelMin gating + reroll cost).
    if (typeof window !== 'undefined' && typeof window.computeItemLevelFromStats === 'function') {
      item.itemLevel = window.computeItemLevelFromStats(item, iLevel);
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
        // Zu lang -> auf 1 Prefix + 1 Suffix kuerzen (ohne sichtbaren Tag;
        // die Raritaet zeigt sich ueber Farbe/Tooltip, nicht im Namen).
        name = (p1 + ' ' + baseName + ' ' + s1).trim().replace(/\s+/g, ' ');
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
    // Issue #26 — Knowledge-Tree goldMult applies to every gold gain (drops,
    // chests, event payouts). Centralised here so shop refunds also benefit
    // — players investing in this node are rewarded uniformly.
    const ktGold = (typeof window !== 'undefined' && window.knowledgeTreeBuffs
      && typeof window.knowledgeTreeBuffs.goldMult === 'number'
      && window.knowledgeTreeBuffs.goldMult > 1)
      ? window.knowledgeTreeBuffs.goldMult : 1;
    // 'of Greed' (gold_find) affix — percent bonus on every gold gain.
    // getBonus returns a fraction (e.g. 0.20 for +20%); 0 when unequipped.
    const goldFind = Math.max(0, getBonus('gold_find') || 0);
    const goldMult = ktGold * (1 + goldFind);
    const scaled = (goldMult !== 1) ? Math.max(1, Math.round(amount * goldMult)) : amount;
    store.GOLD = Math.max(0, Math.floor(store.GOLD + scaled));
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
    // Issue #24: "Letzte Schlacht" Risky edict disables potions for the
    // run. Buff registry is set by PrintingHouse.applyActivePublicationEffect
    // and cleared by leaveDungeonForHub.
    if (window.printingBuffs && window.printingBuffs.potionDisabled) return false;
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
  // Feature 060 (WP05 / #51): Maras Schwarzmarkt aufgewertet → größerer Bestand,
  // damit pro Besuch mehr (und höherwertige) Items zum Gold-Ausgeben da sind.
  const SHOP_STOCK_COUNT = 10;
  // Gold-Sink: kompletter Lager-Reroll (frische Auslage gegen Gold). Tunebar.
  const SHOP_REROLL_BASE_COST = 120;

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
    // Gating (#51): unter der Mindesttiefe ist die sichtbare Auslage gesperrt
    // (nur der Blindkauf bleibt). Sonst rollt sie auf (maxDepth - OFFSET).
    if (!isBlackMarketUnlocked()) return [];
    const depth = Math.max(1, _maxDepth() - BLACK_MARKET_DEPTH_OFFSET);
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
      // Feature 060 (#51): frischer Lager-State ⇒ Reroll-Preis-Eskalation reset.
      _shopRerollCount = 0;
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
    // Feature 059 (#42) WP04: the dungeon-merchant amulet auslage is also
    // run-scoped — drop it so the next run rolls a fresh curated selection.
    _amuletShopState = null;
    _lastAmuletShopRunId = null;
  }

  // Feature 060 (WP05 / #51): Gold-Sink — Maras Auslage gegen Gold komplett neu
  // würfeln. Der Preis steigt mit jedem Reroll innerhalb desselben Lager-States
  // (verhindert spottbilliges Dauer-Rerollen). Reset, sobald ein neuer
  // Lager-State (neuer Run) erzeugt wird.
  let _shopRerollCount = 0;

  function getShopRerollCost() {
    const n = Math.max(0, _shopRerollCount | 0);
    // ×2 — "Lager auffrischen" bei Mara doppelt so teuer.
    return Math.max(1, Math.round(SHOP_REROLL_BASE_COST * 2 * (1 + n * 0.5)));
  }

  // Bezahlt den aktuellen Reroll-Preis und ersetzt itemStock durch eine frische
  // Auslage. Gibt true bei Erfolg zurück, false wenn nicht genug Gold. Defensiv
  // gegen fehlenden Shop-State.
  function rerollShopStock(costGold) {
    const state = getOrCreateShopState();
    if (!state) return false;
    const cost = (typeof costGold === 'number') ? costGold : getShopRerollCost();
    if (!spendGold(cost)) return false;
    state.itemStock = _generateShopStock(state.currentRunId);
    _shopRerollCount += 1;
    return true;
  }

  // === G2 (#51): Blindkauf / Gambling — der zentrale Gold-Sink ================
  // Mara verkauft eine UNIDENTIFIZIERTE Ware zu Fixpreis (skaliert mit Tiefe).
  // Der Inhalt wird beim Kauf via rollItem gerollt — mit einem QUALITAETS-BONUS
  // (BLIND_BUY_BIAS) gegenueber dem sichtbaren Schwarzmarkt: man kauft die Katze
  // im Sack, also sind die Raritaets-Chancen als Risikoausgleich BESSER als ein
  // normaler Fund. Wiederholbar (Dauer-Sink).
  const BLIND_BUY_BASE = 80;        // Grundpreis
  const BLIND_BUY_PER_DEPTH = 30;   // Aufschlag je Tiefe
  // Multiplikator auf die Magic/Rare/Legendary-Gewichte ggue. Basis-Odds (>1).
  const BLIND_BUY_BIAS = 1.8;

  // Schwarzmarkt-Gating (#51): Maras SICHTBARE Auslage ist erst ab dieser je
  // erreichten Tiefe verfuegbar und rollt dann auf (maxDepth - OFFSET) — also
  // ein paar Stufen unter der Front. Der Blindkauf dagegen rollt auf die volle
  // maxDepth (bessere, aber ungewisse Ware).
  const BLACK_MARKET_MIN_DEPTH = 4;
  const BLACK_MARKET_DEPTH_OFFSET = 3;

  // Tiefste je erreichte Tiefe (persistiert). Bevorzugt Persistence.getMaxDepth,
  // faellt auf den localStorage-Key bzw. 1 zurueck. Defensiv gegen fehlende Module.
  function _maxDepth() {
    if (typeof window !== 'undefined' && window.Persistence
        && typeof window.Persistence.getMaxDepth === 'function') {
      const v = window.Persistence.getMaxDepth();
      if (typeof v === 'number' && v > 0) return Math.round(v);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const v = parseInt(localStorage.getItem('demonfall_maxDepth') || '', 10);
        if (Number.isFinite(v) && v > 0) return v;
      }
    } catch (e) { /* ignore */ }
    return 1;
  }

  // Ist die Schwarzmarkt-Auslage freigeschaltet? (maxDepth >= Mindesttiefe)
  function isBlackMarketUnlocked() {
    return _maxDepth() >= BLACK_MARKET_MIN_DEPTH;
  }

  function getBlindBuyPrice(depthOverride) {
    const d = (typeof depthOverride === 'number' && depthOverride > 0) ? depthOverride : _maxDepth();
    // ×2: alle Käufe bei Mara sind doppelt so teuer (Blindkauf ist Mara-exklusiv).
    return Math.max(1, Math.round((BLIND_BUY_BASE + d * BLIND_BUY_PER_DEPTH) * 2));
  }

  // Kauft eine Blind-Ware: zieht Gold ab, wuerfelt ein Item auf maxDepth mit einem
  // Qualitaets-Bonus (BLIND_BUY_BIAS) auf die normalen Drop-Odds — also BESSER als
  // der sichtbare Schwarzmarkt. Rueckgabe: {ok, item?, price, tier?}
  // bzw. {ok:false, reason}.
  function blindBuy(depthOverride) {
    // #51: Blindkauf teilt das Schwarzmarkt-Gating — unter der Mindesttiefe
    // gesperrt (kein override umgeht das; die UI blendet ihn ohnehin aus).
    if (!isBlackMarketUnlocked()) return { ok: false, reason: 'locked' };
    const depth = (typeof depthOverride === 'number' && depthOverride > 0) ? depthOverride : _maxDepth();
    const price = getBlindBuyPrice(depth);
    if (!spendGold(price)) return { ok: false, reason: 'gold', price: price };
    let item = null;
    try { item = rollItem(null, depth, null, BLIND_BUY_BIAS); } catch (e) { item = null; }
    if (!item) {
      // Roll fehlgeschlagen -> Gold exakt zurueck (ohne gold_find-Multiplikator).
      const s = _ensureGoldStore();
      if (s) { s.GOLD = (s.GOLD || 0) + price; _refreshGoldHUD(); }
      return { ok: false, reason: 'roll', price: price };
    }
    return { ok: true, item: item, price: price, tier: item.tier };
  }

  // Feature 059 (#42) WP04: the flying merchant (wandering_merchant event)
  // offers a curated run-fixed amulet selection from depth 10. Separate state
  // from Mara's itemStock; cached per runId so the same run shows the same
  // options (FR-13: nothing below depth 10).
  let _amuletShopState = null;
  let _lastAmuletShopRunId = null;
  const AMULET_SHOP_COUNT = 2;
  const AMULET_SHOP_MIN_DEPTH = 10;

  function _generateAmuletStock(depth) {
    if (typeof depth !== 'number' || depth < AMULET_SHOP_MIN_DEPTH) return [];
    const stock = [];
    const seen = {};
    let attempts = 0;
    while (stock.length < AMULET_SHOP_COUNT && attempts < 40) {
      attempts++;
      const a = rollAmulet(depth, Math.random);
      if (a && !seen[a.key]) { seen[a.key] = true; stock.push(a); }
    }
    return stock;
  }

  function getOrCreateAmuletShopState(runIdOverride) {
    const runId = (typeof runIdOverride !== 'undefined' && runIdOverride !== null)
      ? runIdOverride
      : _currentRunId();
    const depth = (typeof window !== 'undefined' && typeof window.DUNGEON_DEPTH === 'number')
      ? window.DUNGEON_DEPTH : 1;
    if (!_amuletShopState || _lastAmuletShopRunId !== runId) {
      _lastAmuletShopRunId = runId;
      _amuletShopState = {
        currentRunId: runId,
        amuletStock: _generateAmuletStock(depth)
      };
    }
    return _amuletShopState;
  }

  // #51 G3: Aufpreis-Faktor, wenn beim Reroll ein Affix gesperrt (behalten) wird.
  const REROLL_LOCK_SURCHARGE = 1.75;

  function _computeRerollCost(item, locked) {
    if (!item || typeof item.tier !== 'number') return 0;
    const tierMult = [1, 2, 4, 8];
    const t = Math.max(0, Math.min(3, item.tier));
    const iLevel = (typeof item.iLevel === 'number' && item.iLevel > 0) ? item.iLevel : 1;
    // Basis 100 (vorher 50) — Reroll bei Mara doppelt so teuer.
    const base = 100 * tierMult[t] * (1 + iLevel * 0.05);
    return Math.max(1, Math.round(base * (locked ? REROLL_LOCK_SURCHARGE : 1)));
  }

  // Eisenbrocken-Kosten eines Rerolls (zusätzlich zum Gold): tier-skaliert 1..4.
  function _computeRerollMatCost(item) {
    if (!item || typeof item.tier !== 'number') return 0;
    return 1 + Math.max(0, Math.min(3, item.tier | 0));
  }

  // Aktuell verfügbare Eisenbrocken (bevorzugt die Inventar-Helfer, sonst direkt).
  function _matCount() {
    if (typeof window === 'undefined') return 0;
    if (typeof window.getMaterialCount === 'function') return window.getMaterialCount('MAT') || 0;
    return (window.materialCounts && typeof window.materialCounts.MAT === 'number') ? window.materialCounts.MAT : 0;
  }
  function _spendMat(amount) {
    if (typeof window === 'undefined' || amount <= 0) return;
    if (typeof window.changeMaterialCount === 'function') { window.changeMaterialCount('MAT', -amount); return; }
    if (window.materialCounts) window.materialCounts.MAT = Math.max(0, (window.materialCounts.MAT || 0) - amount);
  }

  // Wuerfelt die Affixe eines Items neu. #51 G3: mit optionalem lockIndex bleibt
  // GENAU ein Affix erhalten; die uebrigen (count-1) werden neu gerollt (ohne den
  // gesperrten Affix zu duplizieren). Sperren lohnt erst ab tier 2 (>=2 Affixe).
  function rerollItem(item, costGold, lockIndex) {
    if (!item || typeof item.tier !== 'number') return false;
    const count = Math.max(0, item.tier | 0);
    const hasLock = (typeof lockIndex === 'number' && Array.isArray(item.affixes)
      && lockIndex >= 0 && lockIndex < item.affixes.length && count >= 2);
    const expected = (typeof costGold === 'number') ? costGold : _computeRerollCost(item, hasLock);
    // Reroll kostet Gold UND Eisenbrocken. Erst Material prüfen (nichts abziehen),
    // dann Gold; nur wenn beides reicht, beides abbuchen (atomar).
    const matCost = _computeRerollMatCost(item);
    if (_matCount() < matCost) return false;
    if (!spendGold(expected)) return false;
    _spendMat(matCost);
    const iLevel = (typeof item.iLevel === 'number' && item.iLevel > 0) ? item.iLevel : 1;
    if (hasLock) {
      const locked = item.affixes[lockIndex];
      const out = [locked];
      let guard = 0;
      while (out.length < count && guard < 40) {
        const extra = rollAffixes(iLevel, 1, Math.random, item.type)[0];
        if (extra && extra.defId !== locked.defId && !out.some((a) => a.defId === extra.defId)) out.push(extra);
        guard++;
      }
      item.affixes = out;
    } else {
      item.affixes = rollAffixes(iLevel, count, Math.random, item.type);
    }
    try { item.displayName = composeName(item); } catch (e) { /* swallow */ }
    return true;
  }
  function migrateSave(saveData) {
    if (!saveData) return saveData;
    const ver = (typeof saveData.saveVersion === 'number') ? saveData.saveVersion : 1;
    if (ver >= 3) return saveData;

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

    // Save v3 (#Bugfix): repariert Prozent-Basiswerte, die vor dem /100-Fix als
    // ROHwert persistiert wurden (z.B. it.speed=15 statt 0.15) -> Tooltip zeigte
    // "+1500% Angriffstempo". Tell-tale: das Top-Level-Feld ist identisch mit dem
    // ROH-baseStats-Wert UND betragsmaessig > 1 (legitime Brueche sind < 1; der
    // /100-Pfad macht Top-Level != baseStats). Nur speed/armor/crit sind percent.
    const _PCT_STATS = ['speed', 'armor', 'crit'];
    const repairItem = function (item) {
      if (!item || typeof item !== 'object' || !item.baseStats) return item;
      for (let i = 0; i < _PCT_STATS.length; i++) {
        const k = _PCT_STATS[i];
        const bv = item.baseStats[k];
        if (typeof item[k] === 'number' && typeof bv === 'number'
            && item[k] === bv && Math.abs(item[k]) > 1) {
          item[k] = bv / 100;
        }
      }
      return item;
    };

    const _eachItem = function (fn) {
      if (Array.isArray(saveData.inventory)) {
        for (let i = 0; i < saveData.inventory.length; i++) {
          saveData.inventory[i] = fn(saveData.inventory[i]);
        }
      }
      if (saveData.equipment && typeof saveData.equipment === 'object') {
        const slots = Object.keys(saveData.equipment);
        for (let i = 0; i < slots.length; i++) {
          saveData.equipment[slots[i]] = fn(saveData.equipment[slots[i]]);
        }
      }
    };

    if (ver < 2) _eachItem(migrateItem); // v1 -> v2 Item-Shape
    _eachItem(repairItem);               // v<3 -> Prozent-Reparatur

    saveData.saveVersion = 3;
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
    // Feature 059 (#42): run-specific amulets — separate pool + roll path.
    AMULET_DEFS: AMULET_DEFS,
    rollAmulet: rollAmulet,
    PERSISTENT_EQUIP_SLOTS: PERSISTENT_EQUIP_SLOTS,
    clearRunAmulet: clearRunAmulet,
    // WP04: spawn gate + merchant auslage + effect blurb.
    shouldSpawnRunAmulet: shouldSpawnRunAmulet,
    getAmuletEffectDesc: getAmuletEffectDesc,
    getOrCreateAmuletShopState: getOrCreateAmuletShopState,

    // implemented in WP01
    rollAffixes: rollAffixes,
    recomputeBonuses: recomputeBonuses,
    getBonus: getBonus,
    // #37: exposed so callers/tests share the same iLevel value-scaling curve.
    _affixValueScale: _affixValueScale,

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
    getShopRerollCost: getShopRerollCost,
    rerollShopStock: rerollShopStock,
    getBlindBuyPrice: getBlindBuyPrice,
    blindBuy: blindBuy,
    isBlackMarketUnlocked: isBlackMarketUnlocked,
    rerollItem: rerollItem,
    _computeRerollCost: _computeRerollCost,
    _computeRerollMatCost: _computeRerollMatCost,
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
        // Tutorial: when the system is on the `loot.wait` step (i.e. the
        // player is about to be told to pick up an item and then equip
        // it), force the next random drop to be a basic equippable
        // weapon. Without this, the random loot table can produce a
        // potion or material and the upcoming "equip" step has nothing
        // to equip — soft-locking the tutorial. We only override when
        // the caller didn't already pass an explicit item, so quest
        // rewards / boss drops are untouched.
        var item = maybeItem;
        if (!item && window.TutorialSystem && typeof window.TutorialSystem.getCurrentStep === 'function') {
          try {
            var step = window.TutorialSystem.getCurrentStep();
            if (step && step.id === 'loot.wait' && typeof rollItem === 'function') {
              item = rollItem('WPN_EISENKLINGE', 1);
            }
          } catch (_) { /* fall through to the random drop */ }
        }
        var ret = origSpawn.call(this, x, y, item, sourceEnemy);
        // Only fire loot.dropped when an actual pickup-able item exists.
        // spawnLoot is also the entry-point for chest obstacles, gold piles
        // and quest-fetch items; firing here for those would silently
        // advance the tutorial past loot.wait while the world has no
        // equippable on the ground for the player to walk over.
        var isPickupItem = false;
        if (item && typeof item.type === 'string') {
          var t = item.type.toLowerCase();
          if (t === 'weapon' || t === 'head' || t === 'body' || t === 'boots' || t === 'accessory' || t === 'potion') {
            isPickupItem = true;
          }
        }
        if (isPickupItem && window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
          try {
            window.TutorialSystem.report('loot.dropped', { itemId: (item && item.id) || null, type: item && item.type });
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
        // Skip the report when the loot is a non-equipment pickup
        // (xp orb, health pot, quest item) — those don't satisfy the
        // "lauf darüber zum Aufheben" hint the player just read.
        var lootType = loot && loot.lootType;
        var equippable = false;
        if (item && typeof item.type === 'string') {
          var ct = item.type.toLowerCase();
          if (ct === 'weapon' || ct === 'head' || ct === 'body' || ct === 'boots' || ct === 'accessory' || ct === 'potion') {
            equippable = true;
          }
        }
        var ret = origCollect.apply(this, arguments);
        if (equippable && lootType !== 'health' && lootType !== 'xp'
            && window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
          try {
            window.TutorialSystem.report('loot.picked', { itemId: (item && item.id) || null, type: item && item.type });
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
