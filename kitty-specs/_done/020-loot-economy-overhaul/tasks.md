# Tasks: Loot & Economy Overhaul

**Feature:** 020-loot-economy-overhaul
**Total subtasks:** 53
**Total work packages:** 8
**Generated:** 2026-04-09
**Branch contract:** main → main (proof-of-concept project, no feature branches)

## Work Package Map

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|---|---|---:|---:|---|---|
| WP01 | Foundation & Affix Engine | 7 | ~430 | — | — |
| WP02 | Item System & Migration | 6 | ~430 | WP01 | with WP03/04/07 |
| WP03 | Gold Currency | 6 | ~380 | WP01 | with WP02/04/07 |
| WP04 | Health Potions | 6 | ~400 | WP01 | with WP02/03/07 |
| WP05 | Elite Enemies | 9 | ~560 | WP02 | with WP06 |
| WP06 | Mara Shop UI | 9 | ~570 | WP02, WP03, WP04 | with WP05 |
| WP07 | Ability Modifier Integration | 5 | ~340 | WP01 | with WP02/03/04 |
| WP08 | Cleanup & Verification | 5 | ~330 | all prior | — |

## Phase 1: Foundation (sequential entry point)

### WP01 — Foundation & Affix Engine

**Goal:** Create `js/lootSystem.js` IIFE skeleton with the AFFIX_DEFS pool, affix-rolling logic, AggregatedBonuses cache, and unit tests for the pure logic. Foundation that everything else builds on.

**Priority:** P0 (blocks all other WPs)
**Independent test:** `node tools/runTests.js` → all new lootSystem tests pass; smoke test still passes (no integration yet).
**Prompt:** [tasks/WP01-foundation-affix-engine.md](tasks/WP01-foundation-affix-engine.md)

**Subtasks:**
- [ ] **T001** Create `js/lootSystem.js` IIFE skeleton with `window.LootSystem` namespace and stub exports for all public API methods (rollAffixes, rollItem, composeName, recomputeBonuses, getBonus, grantGold, spendGold, consumePotion, onPotionKey, getOrCreateShopState, rerollItem, migrateSave). The stubs should throw `Error('not implemented')` so any premature caller fails loud.
- [ ] **T002** Define and freeze the 24-entry `AFFIX_DEFS` constant inside the IIFE (per `data-model.md` exact entries). Expose via `LootSystem.AFFIX_DEFS`.
- [ ] **T003** Implement `rollAffixes(iLevel, count, rng = Math.random)` per the contract — filter by `iLevelMin <= iLevel`, weighted random pick without replacement, return `AffixInstance[]` of length `min(count, eligible.length)`.
- [ ] **T004** Implement the `AggregatedBonuses` cache: `recomputeBonuses()` reads `window.equipment` and aggregates all affix values into `flat`/`percent` maps, bumps `version`. `getBonus(statKey)` returns the right value depending on the stored type. The cache is module-private; only `recomputeBonuses` mutates it.
- [ ] **T005** Wire the new `<script src="js/lootSystem.js"></script>` tag into `index.html` AFTER `js/inventory.js` and BEFORE `js/abilitySystem.js`. Ensure no console errors at page load.
- [ ] **T006** Write `tests/lootSystem.test.js` Phase 1: tests for `rollAffixes` (deterministic with seeded Mulberry32 RNG, iLevelMin filter, no duplicates, count cap when pool too small) — 8+ test cases.
- [ ] **T007** Write `tests/lootSystem.test.js` Phase 2: tests for `recomputeBonuses` + `getBonus` (correct sum across multiple equipped items, percent vs flat handling, version bump, returns 0 for unknown statKey) — 6+ test cases.

**Risks:** Frozen `Object.freeze(AFFIX_DEFS)` may cause issues if any later code mutates entries — explicitly forbid mutation in the prompt. The cache must NOT be recomputed on every `getBonus` call (NFR-001).

## Phase 2: Parallel Implementation (4 WPs in parallel after WP01)

### WP02 — Item System & Migration

**Goal:** Add `ITEM_BASES`, `rollItem()`, `composeName()`, and the strict `migrateSave()` function. Wire migration into the save load path.

**Priority:** P0
**Independent test:** Roll 100 items at varied iLevels; assert tier distribution within ±5%; migrate a fixture save with old `rarity` items and assert all old fields are stripped.
**Prompt:** [tasks/WP02-item-system-migration.md](tasks/WP02-item-system-migration.md)
**Depends on:** WP01

**Subtasks:**
- [ ] **T008** Define and freeze the 13-entry `ITEM_BASES` constant inside `js/lootSystem.js` (per `data-model.md`). Expose via `LootSystem.ITEM_BASES`.
- [ ] **T009** Implement `rollItem(baseKey, iLevel, forceTier?)`:
  - If `baseKey` is null, pick a random base via `dropWeight` interpolation.
  - Determine tier via the 60/30/8/2 base distribution + iLevel modifier (heavier toward higher tiers as iLevel grows).
  - If `forceTier` is set, override the random pick.
  - Roll affixes via `rollAffixes(iLevel, tier)` (tier 0 = no affixes).
  - Compose `displayName`, set `requiredLevel = max(1, iLevel - 2)`, deep-copy `baseStats`.
- [ ] **T010** Implement `composeName(item)` per the spec naming rules (Common = base only, Magic = prefix OR suffix, Rare = prefix + suffix, Legendary = up to 2 prefix + 2 suffix with [Legendary] fallback for over-long names).
- [ ] **T011** Implement `migrateSave(saveData)` — strict, idempotent. Strip `rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel` from every item in `inventory[]` and `equipment[]`. Add `tier=0`, `affixes=[]`, `iLevel=1`, `requiredLevel=1`, `displayName=_baseName`. Set `saveVersion=2`. If already at v2, no-op return.
- [ ] **T012** Hook `LootSystem.migrateSave(saveData)` into `js/storage.js applySaveToState(scene, s)` — invoked BEFORE any state assignment from `s`. Verify with a fixture save that has old items.
- [ ] **T013** Extend `tests/lootSystem.test.js` (Phase 3): tests for `rollItem` (tier distribution Monte Carlo, forceTier override, baseStats deep-copy isolation), `composeName` (all 4 tiers + truncation), `migrateSave` (strict strip, idempotency, saveVersion bump). 10+ test cases.

**Risks:** Migration must be idempotent — running it twice on the same save must produce identical state. Test this explicitly. Tier distribution must NOT trivially default to Common — Monte Carlo test should detect a bias.

### WP03 — Gold Currency

**Goal:** Add the gold counter, gold drops from enemies + chests, gold pile sprites, pickup overlap, and HUD counter.

**Priority:** P0
**Independent test:** Kill 20 enemies in a smoke test, verify gold count incremented; click "spendGold(100)" via console, verify it deducts.
**Prompt:** [tasks/WP03-gold-currency.md](tasks/WP03-gold-currency.md)
**Depends on:** WP01

**Subtasks:**
- [ ] **T014** Add `gold` field to the save model (top-level `saveData.gold = 0`). Wire reads/writes through `js/persistence.js` registry. Document the field in `js/persistence.js` KEYS comment.
- [ ] **T015** Implement `LootSystem.grantGold(amount)`, `LootSystem.getGold()`, `LootSystem.spendGold(amount)`. Each MUST call `window._refreshHUD?.()` so the counter updates.
- [ ] **T016** Generate a `goldPile` procedural sprite in `js/graphics.js` (~24×16 px golden coin pile). Use the existing `g.generateTexture('goldPile', w, h)` pattern; remember the lesson from feature 020-pre — TileSprites don't work with canvas textures, but plain `add.image` does.
- [ ] **T017** Add gold drop logic to `js/loot.js`:
  - Standard enemy: drop `1d(mLevel*5)` gold (rounded), ±20% randomized
  - Boss enemy: drop `mLevel*50` gold ±20%
  - Chest opened: spawn `mLevel*30` gold pile ±20%
  - Each drop creates a `goldPile` sprite at the loot position via `scene.physics.add.sprite(x, y, 'goldPile')` and adds it to a `goldGroup`.
- [ ] **T018** Add gold pickup overlap in main.js GameScene create(): `scene.physics.add.overlap(player, goldGroup, onGoldPickup)`. The handler reads the sprite's stored `amount`, calls `LootSystem.grantGold(amount)`, and destroys the sprite. Add a 5-minute despawn timeout per pile (assumption 7 from spec).
- [ ] **T019** Add a Gold HUD counter in `js/main.js` GameScene create() — a Phaser text positioned just below the existing Eisenbrocken counter, color `#ffd166`, text `"Gold: NNN"`. Updated by `_refreshHUD()`.

**Risks:** Gold sprites must despawn so the count is bounded (NFR-003). The pickup overlap must NOT fire multiple times per pile (set `proj.body.enable = false` immediately on first pickup before destroy).

### WP04 — Health Potions

**Goal:** Add 4 potion tiers, F-key handler, HoT effect, 2-second global cooldown, HUD cooldown indicator. Seed new game with 2 Minor potions.

**Priority:** P0
**Independent test:** Press F → HP ticks up 60% over 3s; press F again → no effect; wait 2s → press F → works.
**Prompt:** [tasks/WP04-health-potions.md](tasks/WP04-health-potions.md)
**Depends on:** WP01

**Subtasks:**
- [ ] **T020** Define and freeze the 4-entry `POTION_DEFS` constant inside `js/lootSystem.js`. Expose via `LootSystem.POTION_DEFS`. Each entry has `potionTier`, `name`, `iconKey`, `healPercent`, `healDurationMs`, `goldCost`, `stackSize`, `iLevelMin`.
- [ ] **T021** Implement `LootSystem.consumePotion(slot)`, `LootSystem.onPotionKey()`, `LootSystem.isPotionOnCooldown()`. Stores the cooldown timestamp in a module-level `_potionCooldownUntil` variable. `onPotionKey()` finds the highest-tier potion stack in inventory and consumes one.
- [ ] **T022** Hook the F key in `js/main.js` GameScene `create()` keyboard listeners: `this.input.keyboard.on('keydown-F', () => { if (window.LootSystem) window.LootSystem.onPotionKey(); })`. Note F was previously slot4 ability — confirmed FREE since QWER refactor.
- [ ] **T023** Implement the HoT effect: when a potion is consumed, apply `healPercent * playerMaxHealth` over `healDurationMs` via a `scene.tweens` interpolation that ticks `addPlayerHealth(delta)` per frame. Use the existing `addPlayerHealth` function from `main.js`.
- [ ] **T024** Add a small Phaser graphics indicator next to the player HP bar that shows the potion cooldown — a circle that fills up over 2s, then disappears. Visible only while cooldown is active.
- [ ] **T025** Modify `AbilitySystem.resetForNewGame()` (or wherever new-game seeding lives) to also seed the inventory with 2 Minor potions. FR-028.

**Risks:** F-key must NOT conflict with any other handler (verified FREE). HoT must NOT exceed playerMaxHealth (clamp via `addPlayerHealth`'s existing clamp).

### WP07 — Ability Modifier Integration

**Goal:** Wire combat code (damage + cooldown computation) to consult `LootSystem.getBonus()`. Update HUD slot tiles to show bonus badges + faster radial sweep when bonuses are active.

**Priority:** P1 (gameplay polish, but spec-defined)
**Independent test:** Equip an item with `+22% Spin Attack Damage`, verify the next Spin Attack hit deals 22% more damage. Equip a `-12% Charged Slash Cooldown` item, verify the cooldown shrinks visibly.
**Prompt:** [tasks/WP07-ability-modifier-integration.md](tasks/WP07-ability-modifier-integration.md)
**Depends on:** WP01 (LootSystem.getBonus exists)

**Subtasks:**
- [ ] **T044** Patch the player ability code (likely in `js/player.js` or `js/abilitySystem.js`) to multiply the base damage of each ability by `1 + LootSystem.getBonus('dmg_${abilityId}') + LootSystem.getBonus('dmg_all_abilities')`. Find every spot where ability damage is computed.
- [ ] **T045** Patch the cooldown computation similarly: `effectiveCooldown = baseCooldown * (1 - LootSystem.getBonus('cd_${abilityId}') - LootSystem.getBonus('cd_all_abilities'))`. Clamp at minimum 100ms.
- [ ] **T046** Add a small `+X%` bonus badge to each HUD slot tile in `js/main.js`. The badge is a Phaser text positioned under the ability name; visible only when the bonus is non-zero. Updated whenever `recomputeBonuses` runs.
- [ ] **T047** The HUD radial cooldown sweep already reads from `updateAbilityStatus(key, info)` — verify that the `durationMs` it gets passed is the EFFECTIVE (post-bonus) duration, so the visual sweep speed reflects equipped CD-reduction.
- [ ] **T048** Hook `LootSystem.recomputeBonuses()` into all equipment-change events: inventory equip/unequip, CraftingScene equip flow, save load, game start. Each call MUST also call `window._refreshAbilityHUD()` to push the updated badges.

**Risks:** O(1) lookup is critical (NFR-001). The cache must NOT iterate affixes per ability fire — only `getBonus(statKey)` reads, which is one object lookup. Also verify the HUD bonus badges don't overflow tile width.

## Phase 3: Integration WPs (depend on Phase 2)

### WP05 — Elite Enemies

**Goal:** Add Champion + Unique elite enemies with affix pool, scaling spawn rate, visual differentiation, and loot drop bonuses. Hook into `spawnEnemy` and `loot.js` drops.

**Priority:** P1
**Independent test:** Force `EliteEnemies.shouldSpawnElite(20)` 100 times → assert ~55% return non-null. Apply elite to a mock enemy → assert HP doubled, affixes array set.
**Prompt:** [tasks/WP05-elite-enemies.md](tasks/WP05-elite-enemies.md)
**Depends on:** WP02 (uses `LootSystem.rollItem` for guaranteed Magic+ drops)

**Subtasks:**
- [ ] **T026** Create `js/eliteEnemies.js` IIFE skeleton with `window.EliteEnemies` namespace stub exports.
- [ ] **T027** Define and freeze the 10-entry `ENEMY_AFFIX_DEFS` constant per `data-model.md`. Each entry has `id`, `displayName`, `tint`, `auraColor`, `category`, `apply(enemy)` mutation function.
- [ ] **T028** Implement `EliteEnemies.shouldSpawnElite(depth, rng = Math.random)` per FR-024 spawn rate: depth 1-5 → null, 6-10 → 25% champion / 5% unique / 70% null, 11-15 → 35/10/55, 16+ → 40/15/45.
- [ ] **T029** Implement `EliteEnemies.applyEliteToEnemy(enemy, eliteTier, rng?)`: pick 1 affix (champion) or 2-3 affixes (unique), call each `affixDef.apply(enemy)`, multiply HP (×1.5 champion, ×2 unique), apply sprite tint, create aura graphic at depth 38, create floating name tag.
- [ ] **T030** Hook into `js/enemy.js spawnEnemy()` AFTER the regular enemy creation: `if (window.EliteEnemies) { const tier = EliteEnemies.shouldSpawnElite(...); if (tier) EliteEnemies.applyEliteToEnemy(enemy, tier); }`. Non-breaking when EliteEnemies not loaded.
- [ ] **T031** Implement `EliteEnemies.modifyDropTable(enemy, baseDrops)`: champion → drop count ×1.5 + tier boost; unique → drop count ×2 + guaranteed Magic+ item via `LootSystem.rollItem(null, enemy.iLevel, 1)` + 50% gold bonus. Returns new drop table.
- [ ] **T032** Hook elite drop bonus into `js/loot.js` drop logic: when an enemy dies, check `if (enemy._isElite) drops = EliteEnemies.modifyDropTable(enemy, drops);`. Ensure the gold bonus also flows through.
- [ ] **T033** Wire the new `<script src="js/eliteEnemies.js"></script>` tag into `index.html` AFTER `js/enemy.js` and BEFORE the scene scripts.
- [ ] **T034** Write `tests/eliteEnemies.test.js` (10 tests per the contract: spawn rate frequency Monte Carlo at depths 1/10/20, applyElite mutations, modifyDropTable variants, ENEMY_AFFIX_DEFS shape validation).

**Risks:** Elite visual layering (depth 38 aura under depth 50 enemy) must not interfere with the existing fog-of-war or vision masks. Aura cleanup on enemy death must destroy both aura graphic AND name tag text — leak risk.

### WP06 — Mara Shop UI

**Goal:** Add Mara's "Schwarzmarkt" dialog action that opens a Phaser modal `ShopScene` with 3 tabs (Items / Tränke / Reroll). Items refresh per dungeon run.

**Priority:** P0 (core economy loop)
**Independent test:** Inject 500 gold, force `openShopScene(hubScene)`, verify scene opens; verify each tab renders; verify reroll mutates an item's affixes; press ESC, verify scene closes and HubSceneV2 is still active.
**Prompt:** [tasks/WP06-mara-shop-ui.md](tasks/WP06-mara-shop-ui.md)
**Depends on:** WP02 (rollItem), WP03 (gold), WP04 (potion defs)

**Subtasks:**
- [ ] **T035** Create `js/scenes/ShopScene.js` with the Phaser scene class skeleton. Register as `'ShopScene'`. Add `<script>` tag to `index.html` after `CraftingScene.js`. Add `ShopScene` to the `scene: [...]` array in `js/main.js`.
- [ ] **T036** Implement `ShopScene.create(data)` lifecycle: dim backdrop overlay (depth 2000), main panel rectangle with rounded corners (depth 2001), title text "Schwarzmarkt — Mara", 3 tab buttons row, gold counter "Gold: NNN" bottom-left, close button "Schliessen [ESC]" bottom-right. ESC keyboard handler that calls `this.scene.stop()`.
- [ ] **T037** Implement the **Items tab** body: list 6-8 items from `LootSystem.getOrCreateShopState().itemStock`. Each row shows the item icon, displayName (colored by tier), tooltip with affix lines on hover, price `Y Gold`, and a "Kaufen" button that calls `LootSystem.spendGold(price)` then pushes the item into the player's inventory. Refresh the row state on success.
- [ ] **T038** Implement the **Tränke tab** body: list all 4 potion tiers from `LootSystem.POTION_DEFS`. Each row shows the icon, name, heal text "+30% MaxHP" etc., price, "Kaufen 1" button. Buy → spend gold → push potion item into inventory or stack with existing potion stack.
- [ ] **T039** Implement the **Reroll tab** body: drop zone for an inventory item (clickable inventory slots become selectable when this tab is active). Once selected, show: current item displayName + affix list + reroll cost (`50 * tierMult * (1 + iLevel * 0.05)`) + "Reroll" button. On click → `LootSystem.rerollItem(item, cost)` → refresh displayed item view.
- [ ] **T040** Implement `window.openShopScene(parentScene)` helper function in `ShopScene.js` (matches `window.openSettingsScene` pattern from feature 013). Uses `game.scene.launch('ShopScene', { from: parentScene.scene.key })` so the parent scene is NOT stopped — modal overlay.
- [ ] **T041** Add a "Schwarzmarkt" dialog action to Mara's NPC entry in `js/scenes/HubSceneV2.js`. This goes in the existing dialog action handler — when the player picks the new dialog option, call `window.openShopScene(this)`. Mara dialog must be available from game start (not gated by act).
- [ ] **T042** Implement `LootSystem.getOrCreateShopState()` in `js/lootSystem.js`. Stores `currentRunId` (bumped on each new dungeon run start) and `itemStock` array. Regenerates stock when `currentRunId` changes. Stock is 6-8 items rolled via `rollItem(null, currentDungeonDepth)`.
- [ ] **T043** Implement `LootSystem.rerollItem(item, costGold)` in `js/lootSystem.js`. Pre-checks `spendGold(costGold)`, then re-rolls `item.affixes` via `rollAffixes(item.iLevel, item.tier)`, recomposes `displayName`. Returns the mutated item (also returns false if cost can't be paid).

**Risks:** Modal scene management — ESC handling must not interfere with the existing K-loadout or O-settings overlays. Only one modal at a time — guard with `game.scene.isActive('ShopScene')` check in `openShopScene()`. Gold deductions must be transactional (spendGold returns false → no item pushed).

## Phase 4: Polish

### WP08 — Cleanup & Verification

**Goal:** Remove all references to the old item rarity system, run full smoke + unit tests, manual playtest per quickstart.md.

**Priority:** P0 (release gate)
**Independent test:** Full play loop per `quickstart.md` 14-step checklist, 0 console errors.
**Prompt:** [tasks/WP08-cleanup-verification.md](tasks/WP08-cleanup-verification.md)
**Depends on:** all prior WPs

**Subtasks:**
- [ ] **T049** Grep the entire codebase for `rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel` references and remove or update them. Keep only the new tier-based reads via `item.tier` and `LootSystem.composeName`. Files likely affected: `js/inventory.js`, `js/loot.js`, `js/scenes/CraftingScene.js`, possibly `js/main.js` HUD.
- [ ] **T050** Update `js/scenes/CraftingScene.js` to use the new tier-aware item display. The Verbessern (enhance) and Zerlegen (salvage) buttons should still work — Verbessern can stay as a separate stat-boost mechanism distinct from affix rolling, OR be removed in favor of Reroll. Pick the simplest path: remove the enhance button entirely (replaced by Reroll vendor).
- [ ] **T051** Run `node tools/runTests.js` and `node tools/testGame.js --loadout`. Fix any failures. The smoke test will be extended in T053 to cover shop opening.
- [ ] **T052** Manual playtest per `quickstart.md` (14 steps). Document any failing step and create a follow-up issue. Zero console errors is the gate.
- [ ] **T053** Extend `tools/testGame.js` smoke test with a "Shop test" block: inject 500 gold via console, force `openShopScene(hubScene)`, verify scene activates, click the Reroll tab via direct method call, simulate item selection + reroll, verify the item's affixes array changed, ESC out, verify no errors.

**Risks:** Touching CraftingScene risks breaking existing crafting flow — verify the Eisenbrocken-based crafting still works (FR-012). Migration verification on a real old save is the highest-risk gate.

## Parallelization Opportunities

After WP01 completes, the following 4 WPs can run in parallel as independent worktree agents (each owns its specific files / lootSystem.js function bodies):

```
WP01 (Foundation)
   │
   └─→ WP02 + WP03 + WP04 + WP07  (4 parallel worktrees)
            │
            └─→ WP05 + WP06  (2 parallel worktrees, both depend on WP02)
                  │
                  └─→ WP08  (sequential, integrates everything)
```

Best case: 8 WPs in 4 phases (1 → 4 parallel → 2 parallel → 1).

## MVP Recommendation

**MVP scope = WP01 + WP02 + WP03 + WP04 + WP08** (5 WPs).

This delivers:
- Item affix system + migration
- Gold currency
- Health potions
- Cleanup of old rarity system
- Fully verified playable build

Defer WP05 (elite enemies), WP06 (shop UI), WP07 (ability modifiers) to a follow-up commit if you want a smaller initial release. They can be added incrementally without breaking the MVP.

## Requirements coverage

| WP | Functional Requirements covered |
|---|---|
| WP01 | FR-002, FR-003 |
| WP02 | FR-001, FR-004, FR-005, FR-006, FR-007, FR-026, FR-027 |
| WP03 | FR-008, FR-009, FR-010, FR-011, FR-012 |
| WP04 | FR-013, FR-014, FR-015, FR-016, FR-028 |
| WP05 | FR-022, FR-023, FR-024, FR-025 |
| WP06 | FR-017, FR-018, FR-019, FR-020, FR-021 |
| WP07 | FR-029, FR-030, FR-031, FR-032, FR-033 |
| WP08 | (verification of all prior FRs) |

All 33 FRs from the spec are mapped to a WP.
