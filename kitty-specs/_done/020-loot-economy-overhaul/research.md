# Phase 0 Research: Loot & Economy Overhaul

**Feature:** 020-loot-economy-overhaul
**Date:** 2026-04-09

This file resolves the open technical questions identified in `plan.md`. The spec has 0 `[NEEDS CLARIFICATION]` markers — all research items are "best practices for known tech".

---

## R-001 — Phaser scene launch vs start vs overlay container for Shop UI

**Question:** What's the right pattern to render Mara's Shop UI as a modal overlay on top of HubSceneV2 without stopping the hub scene?

**Decision:** Use `parentScene.scene.launch('ShopScene')`.

**Rationale:**
- `scene.start(key)` STOPS the calling scene and starts the new one — wrong, the hub would unload.
- `scene.launch(key)` ADDS the new scene on top of the calling scene without stopping it — exactly what we want.
- The existing `SettingsScene` (added in feature 013) already uses this pattern via `window.openSettingsScene(parentScene)`. Same convention.
- The Phaser scene manager handles input routing — the top-most active scene receives keyboard/mouse events.
- Closing is just `this.scene.stop()` from inside ShopScene.

**Alternatives considered:**
- **In-container UI overlay** (like `loadoutOverlay.js`): viable but has the bug we just fixed (scene-level hit zones survive container destroy and crash on stale tooltip refs). Avoiding that pattern for new code.
- **DOM overlay** (HTML on top of canvas): would work but breaks the Phaser-only convention; mixing input systems gets messy.

**Reference:** `js/scenes/SettingsScene.js`, lines 1-50 (open pattern), `_close()` at line 230.

---

## R-002 — RNG strategy for affix rolling

**Question:** Should `rollAffixes()` use `Math.random()` or a seedable RNG so unit tests can be deterministic?

**Decision:** Use `Math.random()` in production code, but expose an injectable RNG via the second argument:

```js
LootSystem.rollAffixes(iLevel, count, rng = Math.random)
```

Tests pass a deterministic RNG (e.g. a Mulberry32 seeded at 0) for repeatable results. Production paths leave the default.

**Rationale:**
- No external RNG library needed; Mulberry32 is ~10 lines of pure JS in the test setup.
- Production gameplay benefits from non-deterministic rolls (player surprise factor).
- Tests can assert exact stat values, exact affix selection, exact roll distribution.
- Pattern matches what `pickAccessibleSpawnPosition()` already does in `js/enemy.js` (accepts an injectable random source).

**Alternatives considered:**
- **Always seedable, even in production**: would let players save-scum by reading the seed. Bad.
- **Mock `Math.random()` globally in tests**: brittle, leaks across test files, hard to debug.

---

## R-003 — Save migration trigger point

**Question:** Where in the load path do we hook the migration so old saves get fixed before any code touches them?

**Decision:** Hook in `js/storage.js` `applySaveToState(scene, s)` immediately after the save object is parsed but BEFORE any state assignment:

```js
function applySaveToState(scene, s) {
  // Run migration first — converts old item structures in-place
  if (window.LootSystem && window.LootSystem.migrateSave) {
    s = window.LootSystem.migrateSave(s);
  }
  // ... existing logic
}
```

**Rationale:**
- Single chokepoint — every save load goes through `applySaveToState()`. If we miss this hook, no save can survive the upgrade.
- Migration runs BEFORE inventory/equipment assignment, so the rest of the function only ever sees migrated items.
- `migrateSave()` is idempotent — running it twice on an already-migrated save is a no-op (it checks for the new affix structure first).
- New saves (post-migration) skip the migration body entirely on subsequent loads.

**Alternatives considered:**
- **Migrate at game boot in `main.js`**: doesn't help — boot happens before any save is loaded.
- **Migrate inside `loadGame()` in `storage.js`**: also valid, but `applySaveToState()` is closer to where items are read.
- **Migrate per-item lazily on first access**: leaks complexity into every reader.

**Idempotency check pattern:**
```js
function migrateSave(saveData) {
  if (!saveData || !saveData.inventory) return saveData;
  for (const item of saveData.inventory) {
    if (!item) continue;
    if (item.tier !== undefined && Array.isArray(item.affixes)) continue; // already migrated
    // strip old fields, set tier=0, set affixes=[], preserve baseStats
    delete item.rarity;
    delete item.rarityValue;
    delete item.rarityLabel;
    delete item.enhanceLevel;
    item.tier = 0;
    item.affixes = [];
    item.iLevel = item.iLevel || 1;
    item.requiredLevel = item.requiredLevel || 1;
    item.displayName = item._baseName || item.name || 'Item';
  }
  // same for equipment
  return saveData;
}
```

---

## R-004 — Gold sprite pooling

**Question:** At 50 simultaneous gold piles on the floor (NFR-003), do we need a Phaser object pool like the projectile pool in feature 019?

**Decision:** No pool needed. Use plain `scene.physics.add.sprite()` for gold piles.

**Rationale:**
- Gold piles are static (no per-frame movement, no per-frame collisions). The cost driver in projectiles was the per-frame physics + draw call overhead during heavy combat — gold piles don't have that.
- Pickup is via `scene.physics.add.overlap(player, goldGroup, onPickup)` which is already efficient (broadphase).
- 50 sprites × ~32×32 px is trivial for Phaser. The brute spritesheets are 384px+ and we render dozens with no performance impact.
- Despawn timeout (assumption 7 in spec) keeps the count bounded automatically.
- Adding a pool is added complexity for no measurable benefit.

**Alternatives considered:**
- **Pool from day 1**: premature optimization. Can be added later if profiling shows actual frame drops.
- **One graphic per gold tier**: cosmetic, not a perf concern.

---

## R-005 — HUD counter placement for Gold

**Question:** Where exactly does the Gold counter go in the HUD without crowding the existing Eisenbrocken counter?

**Decision:** Top-left HUD area, immediately below the existing Eisenbrocken counter, with a coin icon.

**Rationale:**
- Existing HUD has Damage/Speed/Range/Armor/Crit at top-left, Level/XP/Dungeon Level below those, and the Eisenbrocken counter elsewhere.
- Adding a "Gold: NNN" line directly below "Eisenbrocken: NNN" is the cleanest visual pairing.
- Color the gold counter `#ffd166` (yellow, matches the gold sprite tint) so it's visually distinct.
- Updates on every `LootSystem.grantGold()` call via `window._refreshHUD()` (already exists for Eisenbrocken).

**Alternatives considered:**
- **Top-right next to minimap**: cluttered, the minimap area is already busy with HUD ability tiles.
- **Inventory-only**: hides the dopamine loop. Players need the running counter visible.

---

## R-006 — Affix pool size sweet spot

**Question:** The spec says 20-30 affixes total. What's the right concrete number for the first iteration?

**Decision:** 24 affixes total, distributed:
- 6 base stat affixes (damage, armor, hp, speed, crit, range)
- 4 defensive affixes (resist_fire, resist_cold, resist_lightning, lifesteal)
- 10 ability-specific affixes (5 per-ability damage + 5 per-ability cooldown — one each for spinAttack/chargeSlash/dashSlash/daggerThrow/shieldBash)
- 2 global ability affixes (dmg_all_abilities, cd_all_abilities) — gated to iLevel ≥ 8
- 2 luxury affixes (e.g. `xp_gain` +X%, `gold_find` +X%)

**Rationale:**
- 24 is enough variety that two Rare items rarely roll identical, but small enough to write all defs in one ~150-line array.
- Split keeps base / defensive / ability / global / luxury categories balanced.
- The 2 global affixes being iLevel-gated to 8+ creates a clear "wow, my first all-abilities item" moment for the player.

---

## R-007 — Item base templates — what items can drop?

**Question:** Which base items exist in the new system?

**Decision:** Start with the existing item families plus 3-4 new ones:
- **Weapons:** Eisenklinge (existing), Schattendolch, Kettenmorgenstern, Glutaxt
- **Helms:** Kettenhaube (existing), Bronzehelm, Schlangenmaske
- **Body armor:** new — Lederharnisch, Plattenpanzer, Schattenkutte
- **Boots:** Lederstiefel (existing), Stahlsohlen, Windläufer
- **Potions:** Minor / Normal / Major / Super — separate from equip items

Each base item template defines: `key`, `type`, `name`, `iconKey`, base stats, drop weight per dungeon depth tier.

**Rationale:**
- Reuses existing crafting recipe items so the CraftingScene doesn't break.
- 3 items per slot gives variety; players see new weapons throughout the run.
- Body armor is a new slot category (already exists in equipment but no items dropped before — fixes the gap).

---

## R-008 — Tier roll weights (probability of Common vs Magic vs Rare vs Legendary)

**Question:** What's the drop distribution for the 4 item tiers?

**Decision:** Base distribution:
- Common: 60%
- Magic: 30%
- Rare: 8%
- Legendary: 2%

Modified by:
- iLevel scaling: each iLevel above 5 shifts the distribution slightly toward higher tiers
- Elite enemies: Champion guarantees Magic+ (Common roll re-rolled), Unique guarantees Rare+ (Common+Magic re-rolled)

**Rationale:**
- D2-style steep falloff so Legendary feels rare.
- Elite enemies feel special because they bypass the bottom of the distribution.
- iLevel scaling rewards going deeper without making early game frustrating.

---

## R-009 — Reroll cost formula

**Question:** What's the gold cost to reroll an item's affixes?

**Decision:**
```
cost = baseCost * tierMultiplier[tier] * iLevelMultiplier(iLevel)

baseCost = 50
tierMultiplier = [1, 2, 5, 12]   // Common/Magic/Rare/Legendary
iLevelMultiplier(iLevel) = 1 + iLevel * 0.05
```

Example costs:
- Magic item, iLevel 5: 50 × 2 × 1.25 = **125 gold**
- Rare item, iLevel 10: 50 × 5 × 1.5 = **375 gold**
- Legendary item, iLevel 15: 50 × 12 × 1.75 = **1050 gold**

**Rationale:**
- Common items have nothing to reroll (0 affixes), so the multiplier of 1 is mostly cosmetic — though we could let Common items roll into Magic for that cost.
- Higher tiers cost dramatically more, encouraging the player to commit before rerolling Legendaries.
- iLevel scaling makes endgame rerolls expensive, gating them to players who've been farming for gold.
- Aligns with the success criterion "1-3 rerolls per dungeon run on average" if average gold per run is 200-400.

---

## Summary — open items resolved

| # | Topic | Decision |
|---|---|---|
| R-001 | Phaser modal pattern | `scene.launch` (matches SettingsScene) |
| R-002 | RNG seedability | Injectable RNG arg, `Math.random` default |
| R-003 | Save migration hook | `applySaveToState()` early, idempotent |
| R-004 | Gold sprite pooling | Not needed, plain sprites are fine |
| R-005 | Gold HUD counter placement | Top-left, below Eisenbrocken, gold tint |
| R-006 | Affix pool size | 24 affixes, balanced across 5 categories |
| R-007 | Item bases | 3-4 per slot, body slot newly populated |
| R-008 | Tier drop distribution | 60/30/8/2 base, modified by iLevel + elite |
| R-009 | Reroll cost formula | `50 × tierMult × (1 + iLevel * 0.05)` |

All Phase 0 questions resolved. Plan can proceed to Phase 1 design artifacts (data-model.md, contracts/, quickstart.md).
