# Feature: Loot & Economy Overhaul

**Feature ID:** 020-loot-economy-overhaul
**Mission:** software-dev
**Status:** specified
**Created:** 2026-04-09

## Problem

Demonfall's current item system is shallow: items have a static `rarity` field with no meaningful gameplay impact, no affix variation, and no progression hook. Combat with the current system feels samey because no random elite enemies break the pace, and there is no in-run economy beyond Eisenbrocken (used for crafting only). The game lacks the loot-driven feedback loop that defines the action-RPG genre.

Five gaps work together to make the experience flat:

1. **No itemization depth** — every Eisenklinge looks identical to every other Eisenklinge.
2. **No second currency** — Eisenbrocken does double duty for crafting and would have to do triple duty for shopping; players need a separate, faster-flowing currency for the moment-to-moment dopamine loop.
3. **No consumables** — players who run out of HP have no recovery option mid-dungeon. Death is the only outcome.
4. **No vendor / shop** — the existing NPCs offer dialogue and quests but no place to *spend* loot or *gamble* on better gear.
5. **No elite enemies** — every encounter is mechanically identical; there are no “oh no a champion pack” moments.

These gaps are coupled. An affix system without a vendor to roll affixes is half-baked; a vendor without a currency to spend is pointless; a currency without items worth buying is just a number that goes up. Solving them together is cheaper and produces a coherent foundation that the next features (random events, slower pacing, larger levels) can build on.

## Goal

Replace the existing rarity-only item system with a **single unified D2-light loot & economy foundation** that ties together itemization, currency, consumables, a vendor, and elite enemies into one coherent gameplay loop:

> Kill enemies → drop gold + items with rolled affixes → spend gold at Mara to buy potions or reroll item affixes → tackle harder content → fight elite enemies that drop better loot → repeat.

The new system fully replaces the current `item.rarity` / `item.rarityValue` data, no parallel systems left behind.

## Technical Context

- **Engine:** Phaser 3, JavaScript ES6+, browser-only, no build tooling
- **Existing systems touched:**
  - `js/inventory.js` — `inventory[]`, `equipment{}`, `materialCounts.MAT` (Eisenbrocken)
  - `js/loot.js` — drop tables for chests + enemies
  - `js/enemy.js` — enemy spawning, type flags, damage, health
  - `js/scenes/CraftingScene.js` — current item-rarity-aware UI
  - `js/scenes/HubSceneV2.js` — Mara NPC + dialog system
  - `js/main.js` — HUD, GameScene, key handlers
  - `js/persistence.js` — central localStorage registry (already exists)
  - `js/storage.js` — main save format
- **Constraints:** No console errors, manual playtest passes, existing 24 unit tests + 14 smoke checks must still pass.
- **Save migration:** Strict — existing items in saves get downgraded to Common (0 affixes); the old `rarity`/`rarityValue` fields on items are removed and the new affix data structure replaces them.

## User Scenarios & Testing

### Scenario 1 — First gold drop

A player starts a new run, kills an Imp in the first room, and sees a small pile of gold coins drop on the floor. They walk over it; the coins disappear and the gold counter in the top HUD increments by `+8`. They feel the loop kick in.

### Scenario 2 — First magic item

A player kills a Brute in the second room. A weapon drops with a yellow name “Sharp Eisenklinge of Strength” instead of the usual gray “Eisenklinge”. They pick it up, see two stat lines (`+12% Damage`, `+3 Strength`), and equip it. Their damage display ticks up.

### Scenario 3 — First potion use

A player takes heavy damage in a room. They press `F`. A green health bar tick begins; over the next 3 seconds 60% of their max HP is restored. The potion icon in the HUD greys out for 2 seconds (cooldown), then becomes available again.

### Scenario 4 — First shop visit

A player returns to the hub with 250 gold. They walk to Mara, press `E`, and a new “Schwarzmarkt” dialog option appears alongside the existing dialog. Selecting it opens a Shop UI with three tabs:
- **Items** — randomly rolled gear refreshed every dungeon run
- **Tränke** — health potions of different tiers
- **Reroll** — drop in an item, pay gold, get new affix rolls

### Scenario 5 — First elite encounter

A player enters wave 7. In one of the rooms, a Brute spawns with a faint orange aura and a name-tag “*Fanatic Lightning Enchanted Brute*”. The Brute moves and attacks 50% faster than normal and has visibly more HP. When killed, it drops two items, both Magic or higher tier, plus a guaranteed gold pile.

### Scenario 6 — Reroll an item

A player has a weapon with one bad affix. They visit Mara → Reroll tab → drop the weapon in → see the cost “120 Gold”. They confirm; the weapon's affixes are re-randomized using its existing `iLevel`. The new roll might be better, worse, or sideways — pure gambling.

## Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | The system MUST define exactly 4 item tiers: Common (0 affixes), Magic (1 affix), Rare (2 affixes), Legendary (3 affixes). | proposed |
| FR-002 | The system MUST maintain a single affix pool of 15-25 entries, each with: id, displayName, statKey, range (`min`, `max`), tier (1-4), iLevelRequirement. | proposed |
| FR-003 | The system MUST roll affixes for new items using `iLevel` to filter the pool (only affixes whose `iLevelRequirement <= iLevel` are eligible). | proposed |
| FR-004 | Items MUST track an `iLevel` value, set at creation time from the source's `mLevel` (monster level) or chest level. | proposed |
| FR-005 | Items MUST track a `requiredLevel` value for equipping; the player MUST be unable to equip items whose `requiredLevel > playerLevel`. | proposed |
| FR-006 | The display name of an item MUST be derived from its tier + affix combination (e.g. `Sharp Eisenklinge of Strength` for Magic, `Bloodthirsty Eisenklinge of the Tiger` for Rare). | proposed |
| FR-007 | Item tooltips MUST list each rolled affix on its own line with the resolved value. | proposed |
| FR-008 | The system MUST introduce a Gold currency, separate from Eisenbrocken, persisted in `window.materialCounts.GOLD` (or equivalent). | proposed |
| FR-009 | Gold MUST drop from defeated enemies (1d(mLevel*5)), bosses (mLevel*50), and chests (mLevel*30), randomized within ±20%. | proposed |
| FR-010 | Gold MUST appear as a sprite in the world when dropped and be auto-collected when the player's body overlaps it. | proposed |
| FR-011 | Gold MUST display as a counter in the dungeon HUD next to the existing Eisenbrocken counter, with a coin icon. | proposed |
| FR-012 | Eisenbrocken MUST retain its existing function (crafting, item enhance, salvage) and MUST NOT be replaced by Gold. | proposed |
| FR-013 | The system MUST introduce 4 health potion tiers: Minor (30% Max HP), Normal (60% Max HP), Major (100% Max HP), Super (full heal + small temp Max HP buff). All heal Over Time across 3 seconds. | proposed |
| FR-014 | Pressing `F` in the dungeon MUST consume the highest-tier potion in the player's inventory and apply its heal. | proposed |
| FR-015 | A 2-second global potion cooldown MUST apply between potion uses, regardless of which tier is consumed. The cooldown MUST be visualized in the HUD. | proposed |
| FR-016 | Health potions MUST occupy regular inventory slots and stack up to a configurable maximum per tier (e.g. 5 per stack). | proposed |
| FR-017 | Mara (NPC `mara` in HubSceneV2) MUST gain a new dialog action "Schwarzmarkt" that opens a Shop UI scene/overlay. | proposed |
| FR-018 | The Shop UI MUST have three tabs: Items, Tränke (potions), Reroll. | proposed |
| FR-019 | The Items tab MUST show 6-8 randomly rolled items per visit. The selection MUST refresh per dungeon run (return to hub triggers a re-roll). | proposed |
| FR-020 | The Tränke tab MUST sell all 4 potion tiers at scaling gold prices. | proposed |
| FR-021 | The Reroll tab MUST allow the player to drop in one equippable item from inventory, pay a gold cost (formula: `base * tier_multiplier * iLevel`), and receive the same item with re-randomized affixes (number of affixes preserved by tier). | proposed |
| FR-022 | The system MUST support Champion-pack and Unique elite enemies with one or more affixes drawn from a separate enemy-affix pool of ~10 entries (Fanatic, Lightning Enchanted, Cold Aura, Spectral Hit, Multishot, Vampiric, Berserker, Extra Strong, Extra Fast, Magic Resistant). | proposed |
| FR-023 | Champion enemies MUST have 1 affix and +50% HP. Unique enemies MUST have 2-3 affixes, +100% HP, and a guaranteed Magic+ item drop. | proposed |
| FR-024 | Elite enemy spawn rate MUST scale with dungeon depth: waves 1-5 = 0 elites per room, waves 6-15 = ~1 elite per room, waves 16+ = 2-3 elites per room. | proposed |
| FR-025 | Elite enemies MUST be visually distinguished by: tinted sprite (color matching their primary affix element), glowing aura particle effect, and a name-tag floating above the sprite showing their compound name. | proposed |
| FR-026 | Save migration MUST: (a) strip the old `rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel` fields from existing items, (b) downgrade them all to Common (0 affixes), (c) preserve their base stats and `_baseName`. | proposed |
| FR-027 | The CraftingScene MUST keep its current Verbessern + Zerlegen functionality but MUST adapt to the new affix-aware item structure (no parallel rarity logic). | proposed |
| FR-028 | The new game flow MUST seed players with 50 Gold and 2 Minor Health Potions in the starting inventory (in addition to the existing Eisenbrocken default). | proposed |

## Non-Functional Requirements

| ID | Requirement | Status | Threshold |
|---|---|---|---|
| NFR-001 | The affix-roll function MUST complete within 1ms per item on a typical dropped enemy (10-20 enemies cleared per room). | proposed | 1ms p95 |
| NFR-002 | The Shop UI scene MUST open in under 250ms from the player triggering the dialog action. | proposed | 250ms p95 |
| NFR-003 | The new gold pickup sprites MUST not cause noticeable framerate drops at room cleared state with up to 50 simultaneous gold piles on the floor. | proposed | 60 fps sustained |
| NFR-004 | The existing 24 unit tests + 14 smoke test checks MUST still pass after the migration runs against a save with old-style items. | proposed | 0 failures |
| NFR-005 | The save file MUST not grow more than 50% in size compared to the pre-migration version (rough budget for affix data on items). | proposed | < 50% growth |
| NFR-006 | Browser console MUST show 0 errors during a full dungeon run + hub return + shop visit + reroll + potion use cycle. | proposed | 0 errors |

## Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | The implementation MUST replace the old item-rarity system entirely. No parallel rarity vs affix logic may coexist after the feature is merged. | proposed |
| C-002 | The implementation MUST keep the existing Eisenbrocken crafting flow working unchanged (FR-012). | proposed |
| C-003 | Browser-only code, no Node-side bundler. Modules attach to `window.*` like the existing systems. | proposed |
| C-004 | The implementation MUST NOT break the existing smoke test or any of the 24 unit tests. New tests are encouraged where the new logic is pure (affix-rolling, pricing formulas, save migration). | proposed |
| C-005 | The Shop UI scene MUST be implemented as a modal overlay (Phaser scene `launch`, not `start`) so the underlying hub scene stays visible behind it. | proposed |

## Success Criteria

| Metric | Target |
|---|---|
| Players can complete a full dungeon run + hub return + shop visit + reroll + potion use without console errors | 100% |
| Existing save files load without crashes after migration runs | 100% |
| At least 80% of dropped equipment items in waves 1-10 have at least 1 affix | ≥ 80% |
| Average gold per dungeon run reaches 200-400 by wave 10 | 200-400 |
| Elite enemy encounters per dungeon run (5 rooms) reaches 3-8 by wave 10 | 3-8 |
| Player tooltips show affix lines for any Magic+ item | 100% |
| Reroll cost is balanced so players use it 1-3 times per dungeon run on average | 1-3 |

## Key Entities

### `Item`
Replaces the existing item structure entirely.
- `key`: stable id (`WPN_EISENKLINGE`, etc.)
- `type`: `weapon | head | body | boots | potion`
- `tier`: `0=Common | 1=Magic | 2=Rare | 3=Legendary`
- `iLevel`: number — set at drop time, used for affix-pool filtering
- `requiredLevel`: number — set from iLevel, gates equipping
- `baseStats`: object — fixed stats from the base item template (e.g. `{damage: 8}`)
- `affixes`: array of `AffixInstance` (length matches tier: 0/1/2/3)
- `_baseName`: string — the unaffixed name for display name composition
- `displayName`: derived from baseName + affix prefix/suffix
- (no `rarity`, no `rarityValue`, no `enhanceLevel` — the old fields are removed)

### `AffixDef`
A template entry in the global affix pool.
- `id`: string
- `displayName`: string with `{value}` placeholder
- `position`: `prefix | suffix`
- `statKey`: string — the stat field to modify (`damage`, `armor`, `hp`, `speed`, `crit`, etc.)
- `range`: `{min, max}` — value range to roll
- `iLevelMin`: number — minimum iLevel where this affix can roll
- `weight`: number — relative spawn weight in the pool

### `AffixInstance`
A rolled affix attached to an Item.
- `defId`: reference to `AffixDef.id`
- `value`: the rolled value within `AffixDef.range`

### `Potion`
A consumable item, separate concept from `Item`.
- `tier`: `1=Minor | 2=Normal | 3=Major | 4=Super`
- `healPercent`: number — fraction of Max HP to restore
- `healDurationMs`: number — how long the HoT lasts
- `goldCost`: number — shop price

### `EnemyAffixDef`
A template entry in the enemy affix pool.
- `id`: string
- `displayName`: string
- `tint`: hex color for sprite tint
- `auraColor`: hex color for aura particle effect
- `apply`: function pointer — modifies the enemy's stats and behavior on spawn
- `loot_modifier`: drop-table modifier on kill

### `EliteEnemy`
A regular enemy with one or more rolled `EnemyAffixDef` references.
- `eliteTier`: `champion | unique`
- `affixes`: array of `EnemyAffixDef.id`
- `nameTag`: composed name (e.g. `Fanatic Lightning Enchanted Brute`)

### `ShopState`
Per-run state of Mara's shop.
- `currentItems`: array of 6-8 randomly rolled `Item` instances, refreshed at start of each dungeon run
- `potionStock`: object mapping potion tier → quantity available

### `RerollPricing`
Configuration for the reroll vendor.
- `baseCost`: number
- `tierMultiplier`: array `[1, 2, 5, 12]` for Common/Magic/Rare/Legendary
- `iLevelMultiplier`: function `(iLevel) => 1 + iLevel * 0.05`
- final formula: `baseCost * tierMultiplier[item.tier] * iLevelMultiplier(item.iLevel)`

## Out of Scope

- Set items (saved for a later iteration if the player base wants more depth)
- Item gem-sockets / runeword combinations
- Identification mechanic (all items drop pre-identified)
- Trade between players (single-player game, irrelevant)
- Auction house, dynamic pricing
- Crafting receipes that consume Gold instead of Eisenbrocken
- Gambling for Uniques (D2 vendor gambling) — the reroll vendor covers a similar role
- Stash / shared inventory between runs (separate concern)

## Assumptions

1. The player can carry a reasonable number of inventory items; the existing 20-slot inventory is sufficient for the new system.
2. Mara is consistently present in the hub (the existing visibility check `visibleFromAct` does not gate her shop access — she's available from game start).
3. Affix-roll math is deterministic given a seed, so unit tests can verify roll distributions.
4. Existing crafted items (Eisenklinge, Kettenhaube, Lederstiefel) continue to drop as Common base items and can roll affixes via Mara's reroll.
5. The HUD has space next to the Eisenbrocken counter for a Gold counter without crowding.
6. Per-room elite spawn count is bounded so it never exceeds the regular enemy count for that room (no "all elites" rooms by accident).
7. Dropped Gold sprites despawn after a long timeout (e.g. 5 minutes) to prevent infinite accumulation if the player parks in a room.

## Dependencies

- **Existing systems that must keep working unchanged:**
  - `AbilitySystem` (Q/W/E/R loadout)
  - `questSystem` (NPC quest flow)
  - `roomTemplates` / `roomManager` (dungeon generation, including the recently fixed floor textures)
  - `loadoutOverlay` (K menu)
  - `SettingsScene` (O menu)
  - `Persistence` (centralized localStorage registry — Gold currency adds to this)
- **External API:** none — pure browser/Phaser, no backend
