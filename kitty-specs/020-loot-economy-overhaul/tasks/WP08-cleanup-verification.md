---
work_package_id: WP08
title: Cleanup & Verification
dependencies: [WP01, WP02, WP03, WP04, WP05, WP06, WP07]
requirement_refs: []
planning_base_branch: main
merge_target_branch: main
branch_strategy: main → main (final integration WP)
subtasks: [T049, T050, T051, T052, T053]
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: tools/testGame.js
execution_mode: code_change
lane: planned
owned_files:
- js/inventory.js
- js/loot.js
- js/scenes/CraftingScene.js
- tools/testGame.js
---

# WP08 — Cleanup & Verification

## Objective

Final integration: remove all references to the old item rarity system, verify the unified affix-based system is the only path. Run the full test suite. Manually playtest per `quickstart.md`. Extend the smoke test with shop verification.

## Context

Read first:
- [../spec.md](../spec.md) — C-001 (no parallel rarity vs affix logic), FR-027 (CraftingScene compatibility)
- [../quickstart.md](../quickstart.md) — 14-step manual playtest
- All previous WP prompts

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Final WP — depends on EVERYTHING else.
- Implementation command: `spec-kitty implement WP08 --base WP07` (or any of the prior WPs after they all land on main)

## Files Owned

- `js/inventory.js` (cleanup of rarity references)
- `js/loot.js` (cleanup of rarity references; integration of new rollItem)
- `js/scenes/CraftingScene.js` (cleanup + tier-aware display)
- `tools/testGame.js` (extend smoke test)

## Subtasks

### T049 — Grep + remove old rarity references

**Purpose:** Eliminate the old `rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel` fields from all reading code.

**Steps:**
1. Grep the codebase:
   ```bash
   grep -rn "rarity\|rarityValue\|rarityLabel\|enhanceLevel" js/
   ```
2. For EACH match in `js/inventory.js`, `js/loot.js`, `js/scenes/CraftingScene.js`, and any other file:
   - Remove or replace with the new tier/affix-based read
   - Use `item.tier` instead of `item.rarityValue`
   - Use `LootSystem.composeName(item)` for display name
   - Use `item.affixes` for the bonus stat lookup
3. Color codes for item names: replace any old rarity color map with a new tier color map:
   ```js
   const TIER_COLORS = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
   const itemColor = TIER_COLORS[item.tier || 0];
   ```
4. After all replacements, re-grep to verify no `rarity` references remain in the production code (test files and the spec docs may keep them).

**Files:** `js/inventory.js`, `js/loot.js`, `js/scenes/CraftingScene.js` (varies)

**Validation:** `grep -n "rarity\|rarityValue\|rarityLabel\|enhanceLevel" js/inventory.js js/loot.js js/scenes/CraftingScene.js` returns 0 matches.

---

### T050 — Update CraftingScene for tier-aware display

**Purpose:** The crafting scene currently reads `rarity` for color and possibly enhance levels. Update to read `tier` and `affixes`.

**Steps:**
1. Open `js/scenes/CraftingScene.js`. Find any place where item names are colored or stats displayed.
2. Replace `getRarityColor(item)` calls with the new tier-color lookup:
   ```js
   const TIER_COLORS = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
   const color = TIER_COLORS[item.tier || 0];
   ```
3. Replace `_getEnhancedName(item)` (the function that adds `+5` etc. to names) with `LootSystem.composeName(item)` directly.
4. Stats display: instead of just showing `item.damage`, show `item.baseStats.damage + bonusFromAffixes`. Or simpler: show `LootSystem.composeName(item)` + the affix lines from `item.affixes`.
5. The Verbessern (enhance) button:
   - **Decision:** REMOVE it. The reroll vendor (Mara, WP06) replaces this concept. Crafting can stay focused on creating new items via recipes.
   - Or: KEEP it as a stat boost but redefine it to add a fixed bonus to baseStats, separate from affixes. Either approach is fine.
   - For this prompt: REMOVE the Verbessern button. Salvage stays.
6. Verify the Eisenbrocken-based crafting recipes still work (FR-012). Don't touch the Schmieden buttons or recipe logic — those are independent.

**Files:** `js/scenes/CraftingScene.js` (~30 lines patched, ~50 lines removed for Verbessern)

**Validation:** Open Schmiede in the hub. Items in the inventory list show colored names per tier. Affix lines appear in the item rows. Schmieden a recipe still works (Eisenbrocken decreases). Verbessern button is gone (or at least non-functional in the dropped-in path).

---

### T051 — Run full test suite

**Purpose:** Verify zero regressions.

**Steps:**
1. Run unit tests: `node tools/runTests.js`
   - Expect ALL tests to pass: 24 existing + ~14 from WP01 + ~10 from WP02 + ~10 from WP05 = ~58+ tests
2. Run smoke test: `node tools/testGame.js --loadout`
   - Expect ALL 14 existing checks to pass plus the new shop verification from T053
   - Expect "Errors found: 0"
3. If any test fails, document the failure in the corresponding WP and fix it before continuing.

**Files:** None (this is a verification step)

**Validation:** Both commands return 0 failures. 0 console errors.

---

### T052 — Manual playtest per quickstart.md

**Purpose:** Final acceptance gate per the constitution's "manual playtest passes" requirement.

**Steps:**
1. Open `kitty-specs/020-loot-economy-overhaul/quickstart.md`.
2. Execute each of the 14 steps in order.
3. At each step, verify the EXPECTED outcome matches reality.
4. If any step fails:
   - Document which step + what failed
   - Determine which WP owns the failing code
   - Fix and re-run
5. The constitution's gate is binary: ALL 14 steps pass with 0 console errors, OR the feature is not mergeable.

**Files:** None

**Validation:** All 14 steps green. No console errors during the entire walkthrough. Save reload still works after the new feature is in place.

---

### T053 — Extend smoke test with shop verification

**Purpose:** Add automated coverage for the new shop flow so future regressions don't break it silently.

**Steps:**
1. Open `tools/testGame.js`. Find the existing test sections (loadout, NPC interaction, HUD, crafting).
2. Add a new "Shop Test" block AFTER the existing tests:
   ```js
   // ---- Shop Test ----
   console.log('\n--- Shop Test ---');
   await page.evaluate(() => {
     // Inject 1000 gold
     if (window.LootSystem && window.LootSystem.grantGold) {
       window.LootSystem.grantGold(1000);
     }
     // Inject a Magic+ item to be reroll-able
     const magicItem = window.LootSystem.rollItem('WPN_EISENKLINGE', 5, 1);  // forceTier=1
     for (let i = 0; i < window.inventory.length; i++) {
       if (!window.inventory[i]) {
         window.inventory[i] = magicItem;
         break;
       }
     }
   });
   await page.evaluate(() => {
     const hub = window.game.scene.getScene('HubSceneV2');
     window.openShopScene(hub);
   });
   await page.waitForFunction(() => {
     const game = window.game;
     return game && game.scene.isActive('ShopScene');
   }, { timeout: 5000 });
   console.log('  ✓ ShopScene activated');

   // Switch to Reroll tab
   const rerollResult = await page.evaluate(() => {
     const shop = window.game.scene.getScene('ShopScene');
     shop._renderTab('reroll');
     // Find the first reroll-able item and select it
     const items = (window.inventory || []).filter((it) => it && it.type !== 'potion' && it.tier !== undefined);
     if (items.length === 0) return { error: 'no items' };
     shop.selectedRerollItem = items[0];
     shop._renderTab('reroll');
     // Capture before-affixes
     const before = JSON.stringify(items[0].affixes);
     // Trigger reroll
     const cost = shop._computeRerollCost(items[0]);
     const ok = window.LootSystem.rerollItem(items[0], cost);
     const after = JSON.stringify(items[0].affixes);
     return { ok, changed: before !== after, before, after };
   });
   console.log('  Reroll result:', JSON.stringify(rerollResult));
   if (rerollResult.ok && rerollResult.changed) {
     console.log('  ✓ Reroll mutated affixes');
   } else if (rerollResult.ok) {
     console.log('  ⚠ Reroll succeeded but affixes unchanged (low-affix-count tier?)');
   } else {
     console.log('  ✗ Reroll failed');
   }

   // Close shop
   await page.keyboard.press('Escape');
   await page.waitForTimeout(300);
   const shopClosed = await page.evaluate(() => !window.game.scene.isActive('ShopScene'));
   if (shopClosed) console.log('  ✓ Shop closed via ESC');
   else console.log('  ✗ Shop did not close');
   ```
3. Run `node tools/testGame.js --loadout` and verify the new block runs and reports OK.

**Files:** `tools/testGame.js` (~50 lines added)

**Validation:** Smoke test now reports 14 + shop checks. All green. 0 errors.

---

## Definition of Done

- [ ] No `rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel` references in production code (excluding test fixtures and spec docs)
- [ ] CraftingScene displays items with the new tier-color and affix-line scheme
- [ ] CraftingScene Verbessern button removed (or repurposed)
- [ ] CraftingScene Schmieden recipes still work with Eisenbrocken
- [ ] All unit tests pass (`node tools/runTests.js`)
- [ ] Smoke test passes including the new Shop test block (`node tools/testGame.js --loadout`)
- [ ] Manual playtest per `quickstart.md` — all 14 steps green
- [ ] 0 console errors throughout the entire walkthrough
- [ ] Old saves load correctly via the migration (verified by loading a save created before this feature)

## Risks

| Risk | Mitigation |
|---|---|
| Removing rarity refs breaks crafting display | Tier-color map covers all tiers; verify visually |
| Verbessern removal breaks user expectations | Document the change as "use Reroll vendor at Mara instead" in a UI hint |
| Smoke test extension is brittle to layout changes | Keep the test focused on programmatic state checks (item.affixes changed), not pixel positions |
| Manual playtest catches a bug late in the cycle | This IS the final gate; expect to find and fix some bugs here |

## Reviewer Guidance

1. Confirm all unit tests pass.
2. Confirm smoke test (with shop block) passes.
3. Open the game manually:
   - New game seeds 50 gold + 2 minor potions
   - Walk to Mara, Schwarzmarkt option visible
   - Open shop, all 3 tabs work, can buy + reroll
   - Enter dungeon, kill enemies, gold drops + magic item drops with affixes
   - Wave 6+ → at least one elite enemy with tint + aura
   - Press F → potion HoT effect
   - Equip a per-ability damage item → ability hits harder + badge appears on tile
   - Return to hub, save, reload → state preserved
4. Open an OLD save (one that existed before this feature) — items are downgraded to Common, no crashes.
5. The 14 quickstart steps are the binding gate. If any fail, the merge is blocked.
