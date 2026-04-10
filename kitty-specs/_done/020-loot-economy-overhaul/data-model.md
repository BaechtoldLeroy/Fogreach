# Phase 1 Data Model: Loot & Economy Overhaul

**Feature:** 020-loot-economy-overhaul
**Date:** 2026-04-09

This document defines the concrete shape of every entity introduced or modified by the feature. JS object literal syntax is used for clarity; no TypeScript / JSON Schema in the runtime.

---

## `Item` (replaces existing item structure)

The unified item shape after migration. Replaces all uses of the old `rarity` / `rarityValue` / `rarityLabel` / `enhanceLevel` fields.

```js
{
  // identity
  key: 'WPN_EISENKLINGE',          // stable id, matches ITEM_BASES key
  type: 'weapon',                   // 'weapon' | 'head' | 'body' | 'boots' | 'potion'
  _baseName: 'Eisenklinge',         // unaffixed display name
  iconKey: 'itWeapon',              // texture key for inventory icon

  // tier + level
  tier: 1,                          // 0=Common, 1=Magic, 2=Rare, 3=Legendary
  iLevel: 7,                        // set at creation; drives affix-pool filter
  requiredLevel: 5,                 // gates equip; player.level must be >= this

  // base stats (from ITEM_BASES template)
  baseStats: {
    damage: 8,
    armor: 0,
    hp: 0,
    speed: 0,
    range: 0,
    crit: 0
  },

  // rolled affixes (length matches tier exactly)
  affixes: [
    { defId: 'sharp_dmg_pct',  value: 22 },     // +22% damage
    { defId: 'of_strength_dmg_spin', value: 18 } // +18% Spin Attack damage
  ],

  // derived
  displayName: 'Sharp Eisenklinge of Strength'
}
```

**Field rules:**
- `affixes.length` MUST equal `tier`. Common items have empty `affixes`.
- `displayName` is composed by `LootSystem.composeName(item)` and cached on the item.
- After migration of old saves, items have `tier: 0`, `affixes: []`, `iLevel: 1`, `requiredLevel: 1`.

---

## `AffixDef` (template entry in the affix pool)

```js
{
  id: 'sharp_dmg_pct',                  // stable id
  displayName: 'Sharp',                  // applied as prefix in name composition
  position: 'prefix',                    // 'prefix' | 'suffix'
  statKey: 'damage',                     // see statKey vocabulary below
  valueType: 'percent',                  // 'flat' | 'percent'
  range: { min: 10, max: 30 },           // value range to roll (inclusive)
  iLevelMin: 1,                          // minimum iLevel where this affix can roll
  weight: 100,                           // relative spawn weight in the pool
  appliesTo: ['weapon'],                 // restrict to specific item types (optional)
  tooltipText: '+{value}% Damage'        // displayed in item tooltip; {value} is interpolated
}
```

### `statKey` vocabulary

| Category | Keys |
|---|---|
| **base stats** | `damage`, `armor`, `hp`, `speed`, `crit`, `range` |
| **defensive** | `resist_fire`, `resist_cold`, `resist_lightning`, `lifesteal` |
| **per-ability damage** | `dmg_spinAttack`, `dmg_chargeSlash`, `dmg_dashSlash`, `dmg_daggerThrow`, `dmg_shieldBash` |
| **per-ability cooldown** | `cd_spinAttack`, `cd_chargeSlash`, `cd_dashSlash`, `cd_daggerThrow`, `cd_shieldBash` |
| **global ability mods** | `dmg_all_abilities`, `cd_all_abilities` |
| **luxury** | `xp_gain`, `gold_find` |

### Concrete `AFFIX_DEFS` (24 entries — see research R-006)

```js
[
  // === Base stats (6) ===
  { id: 'sharp_dmg', displayName: 'Sharp', position: 'prefix', statKey: 'damage',
    valueType: 'percent', range: { min: 8, max: 25 }, iLevelMin: 1, weight: 100,
    appliesTo: ['weapon'], tooltipText: '+{value}% Damage' },
  { id: 'sturdy_armor', displayName: 'Sturdy', position: 'prefix', statKey: 'armor',
    valueType: 'flat', range: { min: 2, max: 8 }, iLevelMin: 1, weight: 100,
    appliesTo: ['head', 'body', 'boots'], tooltipText: '+{value} Armor' },
  { id: 'of_health', displayName: 'of the Bear', position: 'suffix', statKey: 'hp',
    valueType: 'flat', range: { min: 5, max: 30 }, iLevelMin: 1, weight: 100,
    appliesTo: ['head', 'body', 'boots', 'weapon'], tooltipText: '+{value} HP' },
  { id: 'swift_speed', displayName: 'Swift', position: 'prefix', statKey: 'speed',
    valueType: 'percent', range: { min: 5, max: 15 }, iLevelMin: 1, weight: 80,
    appliesTo: ['boots', 'body'], tooltipText: '+{value}% Speed' },
  { id: 'of_precision', displayName: 'of Precision', position: 'suffix', statKey: 'crit',
    valueType: 'percent', range: { min: 2, max: 8 }, iLevelMin: 3, weight: 80,
    appliesTo: ['weapon', 'head'], tooltipText: '+{value}% Crit Chance' },
  { id: 'of_reach', displayName: 'of Reach', position: 'suffix', statKey: 'range',
    valueType: 'flat', range: { min: 10, max: 30 }, iLevelMin: 2, weight: 70,
    appliesTo: ['weapon'], tooltipText: '+{value} Range' },

  // === Defensive (4) ===
  { id: 'fire_warding', displayName: 'Fireproof', position: 'prefix', statKey: 'resist_fire',
    valueType: 'percent', range: { min: 5, max: 20 }, iLevelMin: 4, weight: 60,
    appliesTo: ['head', 'body', 'boots'], tooltipText: '+{value}% Fire Resist' },
  { id: 'cold_warding', displayName: 'Frostproof', position: 'prefix', statKey: 'resist_cold',
    valueType: 'percent', range: { min: 5, max: 20 }, iLevelMin: 4, weight: 60,
    appliesTo: ['head', 'body', 'boots'], tooltipText: '+{value}% Cold Resist' },
  { id: 'lightning_warding', displayName: 'Stormproof', position: 'prefix', statKey: 'resist_lightning',
    valueType: 'percent', range: { min: 5, max: 20 }, iLevelMin: 4, weight: 60,
    appliesTo: ['head', 'body', 'boots'], tooltipText: '+{value}% Lightning Resist' },
  { id: 'of_the_leech', displayName: 'of the Leech', position: 'suffix', statKey: 'lifesteal',
    valueType: 'percent', range: { min: 1, max: 5 }, iLevelMin: 6, weight: 40,
    appliesTo: ['weapon'], tooltipText: '+{value}% Life Steal' },

  // === Per-ability damage (5) ===
  { id: 'spinning_dmg', displayName: 'Spinning', position: 'prefix', statKey: 'dmg_spinAttack',
    valueType: 'percent', range: { min: 10, max: 35 }, iLevelMin: 2, weight: 60,
    appliesTo: ['weapon', 'body'], tooltipText: '+{value}% Spin Attack Damage' },
  { id: 'charged_dmg', displayName: 'Charged', position: 'prefix', statKey: 'dmg_chargeSlash',
    valueType: 'percent', range: { min: 10, max: 35 }, iLevelMin: 2, weight: 60,
    appliesTo: ['weapon', 'body'], tooltipText: '+{value}% Charged Slash Damage' },
  { id: 'dashing_dmg', displayName: 'Dashing', position: 'prefix', statKey: 'dmg_dashSlash',
    valueType: 'percent', range: { min: 10, max: 35 }, iLevelMin: 2, weight: 60,
    appliesTo: ['weapon', 'boots'], tooltipText: '+{value}% Dash Slash Damage' },
  { id: 'piercing_dmg', displayName: 'Piercing', position: 'prefix', statKey: 'dmg_daggerThrow',
    valueType: 'percent', range: { min: 10, max: 35 }, iLevelMin: 2, weight: 60,
    appliesTo: ['weapon', 'head'], tooltipText: '+{value}% Dagger Throw Damage' },
  { id: 'bashing_dmg', displayName: 'Bashing', position: 'prefix', statKey: 'dmg_shieldBash',
    valueType: 'percent', range: { min: 10, max: 35 }, iLevelMin: 2, weight: 60,
    appliesTo: ['weapon', 'body'], tooltipText: '+{value}% Shield Bash Damage' },

  // === Per-ability cooldown reduction (5) ===
  { id: 'of_swift_spin', displayName: 'of Swift Spin', position: 'suffix', statKey: 'cd_spinAttack',
    valueType: 'percent', range: { min: 8, max: 20 }, iLevelMin: 3, weight: 50,
    appliesTo: ['weapon', 'head'], tooltipText: '-{value}% Spin Attack Cooldown' },
  { id: 'of_swift_charge', displayName: 'of Swift Charge', position: 'suffix', statKey: 'cd_chargeSlash',
    valueType: 'percent', range: { min: 8, max: 20 }, iLevelMin: 3, weight: 50,
    appliesTo: ['weapon', 'head'], tooltipText: '-{value}% Charged Slash Cooldown' },
  { id: 'of_swift_dash', displayName: 'of Swift Dash', position: 'suffix', statKey: 'cd_dashSlash',
    valueType: 'percent', range: { min: 8, max: 20 }, iLevelMin: 3, weight: 50,
    appliesTo: ['boots'], tooltipText: '-{value}% Dash Slash Cooldown' },
  { id: 'of_swift_dagger', displayName: 'of Swift Dagger', position: 'suffix', statKey: 'cd_daggerThrow',
    valueType: 'percent', range: { min: 8, max: 20 }, iLevelMin: 3, weight: 50,
    appliesTo: ['head'], tooltipText: '-{value}% Dagger Throw Cooldown' },
  { id: 'of_swift_bash', displayName: 'of Swift Bash', position: 'suffix', statKey: 'cd_shieldBash',
    valueType: 'percent', range: { min: 8, max: 20 }, iLevelMin: 3, weight: 50,
    appliesTo: ['body', 'weapon'], tooltipText: '-{value}% Shield Bash Cooldown' },

  // === Global ability modifiers (2, gated to iLevel >= 8) ===
  { id: 'of_might', displayName: 'of Might', position: 'suffix', statKey: 'dmg_all_abilities',
    valueType: 'percent', range: { min: 8, max: 18 }, iLevelMin: 8, weight: 25,
    appliesTo: ['weapon', 'body'], tooltipText: '+{value}% All Ability Damage' },
  { id: 'of_haste', displayName: 'of Haste', position: 'suffix', statKey: 'cd_all_abilities',
    valueType: 'percent', range: { min: 5, max: 12 }, iLevelMin: 8, weight: 25,
    appliesTo: ['head', 'boots'], tooltipText: '-{value}% All Ability Cooldowns' },

  // === Luxury (2) ===
  { id: 'of_wisdom', displayName: 'of Wisdom', position: 'suffix', statKey: 'xp_gain',
    valueType: 'percent', range: { min: 5, max: 15 }, iLevelMin: 5, weight: 30,
    appliesTo: ['head'], tooltipText: '+{value}% XP Gain' },
  { id: 'of_greed', displayName: 'of Greed', position: 'suffix', statKey: 'gold_find',
    valueType: 'percent', range: { min: 10, max: 30 }, iLevelMin: 5, weight: 30,
    appliesTo: ['head', 'boots'], tooltipText: '+{value}% Gold Find' }
]
```

24 entries. Each is filterable by `iLevelMin <= iLevel` AND `appliesTo.includes(item.type)`.

---

## `AffixInstance`

A rolled affix attached to an `Item`.

```js
{
  defId: 'sharp_dmg',     // reference to AffixDef.id
  value: 22                // rolled value within AffixDef.range
}
```

That's it. The full affix metadata (display name, tooltip, statKey) is looked up from `AFFIX_DEFS` at render time. Storing only `defId + value` keeps the save file small.

---

## `AggregatedBonuses`

The precomputed cache used by combat code. Recomputed only when equipped item set changes.

```js
{
  flat: {
    damage: 5,         // from sturdy_armor on body
    hp: 30,            // from of_health on weapon + head
    armor: 12,
    range: 0,
    // ...
  },
  percent: {
    damage: 0.22,             // +22% from sharp_dmg
    speed: 0.10,              // from swift_speed on boots
    crit: 0.05,
    dmg_spinAttack: 0.18,     // from spinning_dmg
    cd_chargeSlash: -0.12,    // negative because cooldown REDUCTION
    dmg_all_abilities: 0,     // accumulator stays 0 if no item rolled this
    cd_all_abilities: 0,
    gold_find: 0.20,
    // ...
  },
  version: 17                  // bumped on every recompute, used by HUD invalidation
}
```

**Lookup contract:**
```js
LootSystem.getBonus('dmg_spinAttack')  // → 0.18 (multiplier; combat multiplies by 1+x)
LootSystem.getBonus('cd_chargeSlash')  // → -0.12 (combat multiplies cooldown by 1+x)
LootSystem.getBonus('hp')               // → 30 (flat add)
```

The function checks both `flat[key]` and `percent[key]` and returns the appropriate value based on the affix's `valueType`.

---

## `ITEM_BASES`

Base item templates (the "common" version of each item before affixes are rolled).

```js
[
  // Weapons
  { key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Eisenklinge', iconKey: 'itWeapon',
    baseStats: { damage: 8 }, dropWeight: { 1: 100, 5: 80, 10: 50, 15: 30 } },
  { key: 'WPN_SCHATTENDOLCH', type: 'weapon', name: 'Schattendolch', iconKey: 'itWeapon',
    baseStats: { damage: 5, speed: 15, crit: 5 }, dropWeight: { 3: 60, 8: 80, 15: 100 } },
  { key: 'WPN_KETTENMORGENSTERN', type: 'weapon', name: 'Kettenmorgenstern', iconKey: 'itWeapon',
    baseStats: { damage: 12, speed: -5 }, dropWeight: { 5: 40, 10: 80, 18: 60 } },
  { key: 'WPN_GLUTAXT', type: 'weapon', name: 'Glutaxt', iconKey: 'itWeapon',
    baseStats: { damage: 15, speed: -10 }, dropWeight: { 8: 30, 12: 60, 18: 80 } },

  // Helms
  { key: 'HD_KETTENHAUBE', type: 'head', name: 'Kettenhaube', iconKey: 'itHead',
    baseStats: { armor: 5 }, dropWeight: { 1: 100, 5: 80, 10: 40 } },
  { key: 'HD_BRONZEHELM', type: 'head', name: 'Bronzehelm', iconKey: 'itHead',
    baseStats: { armor: 8 }, dropWeight: { 4: 80, 10: 100, 15: 60 } },
  { key: 'HD_SCHLANGENMASKE', type: 'head', name: 'Schlangenmaske', iconKey: 'itHead',
    baseStats: { armor: 4, crit: 5 }, dropWeight: { 6: 50, 12: 80, 18: 100 } },

  // Body armor
  { key: 'BD_LEDERHARNISCH', type: 'body', name: 'Lederharnisch', iconKey: 'itBody',
    baseStats: { armor: 6, speed: 5 }, dropWeight: { 1: 100, 5: 60, 10: 30 } },
  { key: 'BD_PLATTENPANZER', type: 'body', name: 'Plattenpanzer', iconKey: 'itBody',
    baseStats: { armor: 15, speed: -5 }, dropWeight: { 5: 60, 10: 100, 15: 80 } },
  { key: 'BD_SCHATTENKUTTE', type: 'body', name: 'Schattenkutte', iconKey: 'itBody',
    baseStats: { armor: 4, speed: 10, crit: 3 }, dropWeight: { 6: 40, 12: 80, 18: 100 } },

  // Boots
  { key: 'BT_LEDERSTIEFEL', type: 'boots', name: 'Lederstiefel', iconKey: 'itBoots',
    baseStats: { speed: 15 }, dropWeight: { 1: 100, 5: 80, 10: 40 } },
  { key: 'BT_STAHLSOHLEN', type: 'boots', name: 'Stahlsohlen', iconKey: 'itBoots',
    baseStats: { armor: 6, speed: 8 }, dropWeight: { 4: 80, 10: 100 } },
  { key: 'BT_WINDLAEUFER', type: 'boots', name: 'Windläufer', iconKey: 'itBoots',
    baseStats: { speed: 25, crit: 2 }, dropWeight: { 8: 50, 14: 100 } }
]
```

`dropWeight` is a sparse map of `iLevel → weight`. Linear interpolation between defined points.

---

## `Potion`

Consumable items, separate concept from `Item` (they don't roll affixes).

```js
{
  type: 'potion',
  potionTier: 1,            // 1=Minor, 2=Normal, 3=Major, 4=Super
  name: 'Heiltrank (Klein)',
  iconKey: 'itPotionMinor',
  healPercent: 0.30,        // fraction of Max HP
  healDurationMs: 3000,     // HoT total duration
  goldCost: 25,             // shop price
  stackSize: 5              // max per inventory stack
}
```

### `POTION_DEFS`

```js
[
  { potionTier: 1, name: 'Heiltrank (Klein)',  healPercent: 0.30, healDurationMs: 3000,
    goldCost: 25,  stackSize: 5, iconKey: 'itPotionMinor',  iLevelMin: 1 },
  { potionTier: 2, name: 'Heiltrank',           healPercent: 0.60, healDurationMs: 3000,
    goldCost: 75,  stackSize: 5, iconKey: 'itPotionNormal', iLevelMin: 4 },
  { potionTier: 3, name: 'Heiltrank (Gross)',  healPercent: 1.00, healDurationMs: 3000,
    goldCost: 200, stackSize: 5, iconKey: 'itPotionMajor',  iLevelMin: 8 },
  { potionTier: 4, name: 'Heiltrank (Super)',  healPercent: 1.00, healDurationMs: 3000,
    goldCost: 500, stackSize: 5, iconKey: 'itPotionSuper',  iLevelMin: 12,
    bonusEffect: { tempMaxHp: 0.10, durationMs: 30000 } }   // +10% Max HP for 30s
]
```

---

## `EnemyAffixDef`

Template for elite enemy affixes (separate pool from item affixes).

```js
{
  id: 'fanatic',
  displayName: 'Fanatic',
  tint: 0xff8844,                // sprite tint
  auraColor: 0xff5500,             // aura particle color
  category: 'movement',            // grouping for visual hint
  apply: function(enemy) {         // mutation hook on spawn
    enemy.speed = (enemy.speed || 60) * 1.5;
    enemy._attackCdMul = (enemy._attackCdMul || 1) * 0.5;
    enemy.isFanatic = true;
  }
}
```

### `ENEMY_AFFIX_DEFS` (10 entries)

| id | displayName | category | tint | apply |
|---|---|---|---|---|
| `fanatic` | Fanatic | speed | `0xff8844` | speed × 1.5, attack CD × 0.5 |
| `lightning_enchanted` | Lightning Enchanted | element | `0x88aaff` | dies → ring of lightning bolts |
| `cold_aura` | Cold Aura | aura | `0x88ccff` | within 150px → player slowed 30% |
| `spectral_hit` | Spectral Hit | defense | `0xaa66ff` | only damaged by Magic+ items |
| `multishot` | Multishot | ranged | `0xff66cc` | ranged: 3 projectiles in spread |
| `vampiric` | Vampiric | survival | `0xff4444` | 30% lifesteal on hit |
| `berserker` | Berserker | offense | `0xff8800` | <30% HP → 2x damage |
| `extra_strong` | Extra Strong | offense | `0xffaa00` | damage × 2 |
| `extra_fast` | Extra Fast | speed | `0x00ffcc` | speed × 1.5 |
| `magic_resistant` | Magic Resistant | defense | `0xcc88ff` | abilities deal 50% less damage |

---

## `EliteEnemy`

Regular enemy mutated with `EnemyAffixDef` references.

```js
{
  // ... all existing enemy fields (sprite, hp, etc.)

  // new fields
  eliteTier: 'champion',           // 'champion' | 'unique'
  eliteAffixes: ['fanatic'],       // for champions: 1 entry; for uniques: 2-3
  eliteNameTag: 'Fanatic Brute',   // Phaser.Text floating above the sprite
  _isElite: true,
  hp: 90,                          // base 60 × 1.5 (champion HP boost)
}
```

`eliteNameTag` is a `Phaser.GameObjects.Text` that follows the enemy. Champions get +50% HP, Uniques get +100% HP and a guaranteed Magic+ drop.

---

## `ShopState`

Per-run state of Mara's shop, persisted in the save under `materialCounts.SHOP_STATE` or similar.

```js
{
  generatedAt: 1234567890,         // ms timestamp; refreshed when entering hub from a NEW run
  currentRunId: 'run_xyz',         // bump on each new dungeon run start
  itemStock: [                     // 6-8 randomly rolled Item entries
    { key: 'WPN_EISENKLINGE', ... },
    { key: 'HD_BRONZEHELM', ... },
    // ...
  ],
  potionStock: {
    1: 5,                          // tier 1 → 5 potions in stock
    2: 5,
    3: 3,
    4: 1
  }
}
```

The shop refreshes its `itemStock` each time the player completes a dungeon run and returns to the hub. Within a run, the shop shows the same items every time the player visits Mara (so they can budget gold).

---

## `RerollPricing`

Configuration object for the reroll vendor.

```js
{
  baseCost: 50,
  tierMultiplier: [1, 2, 5, 12],          // Common, Magic, Rare, Legendary
  iLevelMultiplier: function(iLevel) {
    return 1 + iLevel * 0.05;
  }
}
```

Final formula: `cost = baseCost * tierMultiplier[item.tier] * iLevelMultiplier(item.iLevel)`.

---

## Persistence shape

The save file (`demonfall_save_v1` localStorage key) is extended with new top-level fields:

```js
{
  // ... existing fields (playerHealth, playerXP, currentWave, inventory, equipment, etc.)

  // NEW
  gold: 0,                                  // current gold count
  shopState: { ... },                       // ShopState above
  potionCooldownUntil: 0,                   // ms timestamp when potion CD expires
  saveVersion: 2                            // bumped from undefined/1 → 2 on migration
}
```

`materialCounts.GOLD` is the in-memory mirror of `gold` (matches the existing `MAT` pattern). The persistence layer reads/writes `gold` directly from the save object — gold is NOT in `materialCounts.MAT` to keep them clearly separate.

---

## Migration table

| Old field on item | New field | Notes |
|---|---|---|
| `rarity` | (removed) | replaced by `tier` |
| `rarityValue` | (removed) | replaced by `tier` |
| `rarityLabel` | (removed) | derived from `tier` at render time |
| `enhanceLevel` | (removed) | enhance mechanic still exists in CraftingScene but uses tier instead |
| `_baseName` | `_baseName` | preserved |
| `name` | `displayName` | recomputed via `composeName(item)` after migration |
| (none) | `tier` | set to 0 (Common) on migration |
| (none) | `affixes` | set to `[]` on migration |
| (none) | `iLevel` | set to 1 (or read from old `itemLevel` if present) |
| (none) | `requiredLevel` | set to 1 |

After migration the save file should have NO references to the old fields anywhere. The migration function is idempotent — running it on already-migrated items is a no-op.
