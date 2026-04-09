---
work_package_id: WP03
title: Gold Currency
dependencies: [WP01]
requirement_refs:
- FR-008
- FR-009
- FR-010
- FR-011
- FR-012
planning_base_branch: main
merge_target_branch: main
branch_strategy: main → main (stacks on WP01, parallel-safe with WP02/WP04/WP07)
subtasks: [T014, T015, T016, T017, T018, T019]
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/loot.js
execution_mode: code_change
lane: planned
owned_files:
- js/lootSystem.js
- js/loot.js
- js/main.js
- js/graphics.js
- js/persistence.js
---

# WP03 — Gold Currency

## Objective

Add the second currency to the game: Gold. Drops from enemies/bosses/chests, appears as a sprite on the floor, auto-collected on player overlap, displayed in the HUD next to Eisenbrocken. Eisenbrocken keeps its existing crafting role unchanged.

## Context

Read first:
- [../spec.md](../spec.md) — FR-008 to FR-012
- [../research.md](../research.md) — R-004 (no pool needed), R-005 (HUD placement)
- [../data-model.md](../data-model.md) — Persistence shape (gold field added to save)

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Stacks on WP01 (uses LootSystem namespace) but does NOT depend on WP02. Parallel-safe with WP02, WP04, WP07.
- Implementation command: `spec-kitty implement WP03 --base WP01`

## Files Owned

- `js/lootSystem.js` (you ADD bodies for grantGold/getGold/spendGold; you do NOT touch WP01/WP02 code)
- `js/loot.js` (drop logic + gold pile spawning)
- `js/main.js` (HUD counter + pickup overlap registration)
- `js/graphics.js` (procedural goldPile sprite generation)
- `js/persistence.js` (document the new gold KEYS field)

## Subtasks

### T014 — Add gold field to save model + persistence registry

**Purpose:** Make gold persist across save/load.

**Steps:**
1. Open `js/persistence.js`. Find the `KEYS` object.
2. The gold itself doesn't need a NEW localStorage key — it lives inside the existing `demonfall_save_v1` save. Just add a comment documenting it:
   ```js
   const KEYS = Object.freeze({
     SAVE: 'demonfall_save_v1',           // Main save (now also includes player gold field)
     // ... rest unchanged
   });
   ```
3. Open `js/storage.js`. Find `saveGame()` and `applySaveToState()`.
4. In `saveGame()`, add `gold: window.materialCounts?.GOLD || 0` to the payload object.
5. In `applySaveToState()`, add (after the existing migration hook):
   ```js
   if (typeof s.gold === 'number') {
     window.materialCounts = window.materialCounts || {};
     window.materialCounts.GOLD = s.gold;
   } else {
     window.materialCounts = window.materialCounts || {};
     window.materialCounts.GOLD = window.materialCounts.GOLD || 0;
   }
   ```

**Files:** `js/persistence.js` (1 comment line), `js/storage.js` (~5 lines added)

**Validation:** Save the game, reload, verify `window.materialCounts.GOLD` is preserved.

---

### T015 — Implement grantGold / getGold / spendGold

**Purpose:** The public API for adding/spending gold.

**Steps:**
1. Open `js/lootSystem.js`. Replace the WP01 stubs:
   ```js
   function grantGold(amount) {
     if (!Number.isFinite(amount) || amount === 0) return;
     window.materialCounts = window.materialCounts || {};
     window.materialCounts.GOLD = (window.materialCounts.GOLD || 0) + amount;
     if (typeof window._refreshHUD === 'function') {
       try { window._refreshHUD(); } catch (e) { /* ignore */ }
     }
   }

   function getGold() {
     return (window.materialCounts && window.materialCounts.GOLD) || 0;
   }

   function spendGold(amount) {
     if (!Number.isFinite(amount) || amount < 0) return false;
     const current = getGold();
     if (current < amount) return false;
     window.materialCounts.GOLD = current - amount;
     if (typeof window._refreshHUD === 'function') {
       try { window._refreshHUD(); } catch (e) { /* ignore */ }
     }
     return true;
   }
   ```
2. Make sure these are exported (they already are from WP01's namespace export).

**Files:** `js/lootSystem.js` (~30 lines added)

**Validation:** Browser console: `window.LootSystem.getGold()` → 0. `window.LootSystem.grantGold(100); window.LootSystem.getGold()` → 100. `window.LootSystem.spendGold(50)` → true; `getGold()` → 50. `spendGold(100)` → false; gold unchanged.

---

### T016 — Generate procedural goldPile sprite

**Purpose:** A visible sprite to show on the floor when gold drops. Procedurally drawn so we don't need a new asset file.

**Steps:**
1. Open `js/graphics.js`. Find the existing `createObstacleGraphics` function or similar (the place where `g.generateTexture('floor_stone', ...)` lives — you can search for `generateTexture`).
2. Add a new function `createGoldPileGraphics()` (or inline the texture generation in an existing factory):
   ```js
   function createGoldPileGraphics() {
     const g = this.add.graphics();
     // Base shadow
     g.fillStyle(0x000000, 0.4);
     g.fillEllipse(12, 14, 16, 6);
     // Coin pile (3 stacked coins)
     const coinColors = [0xffd166, 0xffe89a, 0xffd166];
     for (let i = 0; i < 3; i++) {
       g.fillStyle(coinColors[i], 1);
       g.fillCircle(12, 12 - i * 2, 7 - i);
       g.lineStyle(1, 0xb89030, 0.8);
       g.strokeCircle(12, 12 - i * 2, 7 - i);
     }
     // Highlight
     g.fillStyle(0xffffff, 0.4);
     g.fillCircle(10, 10, 2);
     g.generateTexture('goldPile', 24, 18);
     g.destroy();
   }
   window.createGoldPileGraphics = createGoldPileGraphics;
   ```
3. ⚠️ Lesson from feature 020-pre — TileSprites don't work with canvas-generated textures, but `add.image` does. Gold piles will be added via `physics.add.sprite(x, y, 'goldPile')` so they're fine.
4. Call `createGoldPileGraphics()` from `createAllGraphics` in `js/main.js` (alongside the other procedural texture creators).

**Files:** `js/graphics.js` (~25 lines added), `js/main.js` (~1 line added in createAllGraphics)

**Validation:** In a browser console: `window.game.scene.getScene('GameScene').textures.exists('goldPile')` → `true`.

---

### T017 — Gold drop logic in loot.js

**Purpose:** When an enemy dies or a chest is opened, spawn gold piles on the floor.

**Steps:**
1. Open `js/loot.js`. Find the existing drop logic (likely a function called from enemy-death or `dealDamageToEnemy`).
2. Add gold drops to the drop pipeline. The cleanest spot is wherever items currently drop. After or before that:
   ```js
   function _dropGold(scene, x, y, mLevel, isBoss) {
     if (typeof window.LootSystem === 'undefined') return;
     let amount;
     if (isBoss) {
       amount = mLevel * 50;
     } else {
       amount = Math.floor(1 + Math.random() * (mLevel * 5));
     }
     // ±20% jitter
     amount = Math.max(1, Math.floor(amount * (0.8 + Math.random() * 0.4)));
     _spawnGoldPile(scene, x, y, amount);
   }

   function _spawnGoldPile(scene, x, y, amount) {
     if (!scene || !scene.physics || !scene.add) return;
     const sprite = scene.physics.add.sprite(x, y, 'goldPile');
     sprite.setData('goldAmount', amount);
     sprite.setDepth(40);
     // Add to a global goldGroup if it exists
     if (window.goldGroup && window.goldGroup.add) {
       window.goldGroup.add(sprite);
     }
     // 5-minute despawn timeout (assumption 7 from spec)
     scene.time.delayedCall(300000, () => {
       if (sprite && sprite.active) sprite.destroy();
     });
   }
   ```
3. Call `_dropGold(scene, enemy.x, enemy.y, enemy.iLevel || enemy.mLevel || currentWave || 1, !!enemy.isBoss)` from the enemy-kill drop path.
4. Also add chest gold: when a chest is opened (find the chest pickup code), spawn `mLevel * 30` gold pile at the chest's position.

**Files:** `js/loot.js` (~50 lines added)

**Validation:** Kill an enemy in the dungeon — a goldPile sprite appears at its position. Open a chest — same.

---

### T018 — Pickup overlap in main.js

**Purpose:** When the player walks over a gold pile, the gold is added to the counter and the sprite disappears.

**Steps:**
1. Open `js/main.js`. Find the GameScene `create()` function.
2. After the existing physics group setup (where `enemyProjectiles`, `obstacles`, etc. are created), add:
   ```js
   window.goldGroup = this.physics.add.group();
   ```
3. Add the overlap registration:
   ```js
   this.physics.add.overlap(player, window.goldGroup, (playerSprite, pile) => {
     if (!pile.active || !pile.body) return;
     pile.body.enable = false;  // prevent double-pickup
     const amount = pile.getData('goldAmount') || 1;
     if (window.LootSystem) window.LootSystem.grantGold(amount);
     // Optional: small sparkle effect
     pile.destroy();
   }, null, this);
   ```
4. The `body.enable = false` is critical — without it, the overlap can fire multiple times in the same frame (the projectile-pool fix from feature 020 had the same lesson).

**Files:** `js/main.js` (~15 lines added)

**Validation:** Walk over a goldPile — the sprite disappears, gold counter increments by the amount.

---

### T019 — HUD gold counter

**Purpose:** Display the current gold count in the dungeon HUD.

**Steps:**
1. Find the existing Eisenbrocken counter in `js/main.js`. It's likely in `initUI()` or in the HUD setup section. Search for `Eisenbrocken` in `js/main.js` to find it.
2. Add a parallel gold counter Phaser text just below the Eisenbrocken counter:
   ```js
   const goldText = this.add.text(eisenbrockenText.x, eisenbrockenText.y + 16, 'Gold: 0', {
     fontFamily: 'monospace',
     fontSize: '14px',
     color: '#ffd166'
   }).setScrollFactor(0).setDepth(1001);
   ```
3. Update the existing `_refreshHUD()` (or create one if there isn't one) to also update the gold text:
   ```js
   const _refreshHUD = () => {
     // ... existing Eisenbrocken update
     if (goldText) {
       const gold = (window.materialCounts && window.materialCounts.GOLD) || 0;
       goldText.setText('Gold: ' + gold);
     }
   };
   window._refreshHUD = _refreshHUD;
   ```
4. Call `_refreshHUD()` once after the GameScene is set up so the initial value is displayed.

**Files:** `js/main.js` (~20 lines added)

**Validation:** Open the dungeon — top-left HUD shows "Gold: 0" below "Eisenbrocken: 20". Pick up a gold pile — counter updates immediately.

---

## Definition of Done

- [ ] `LootSystem.grantGold/getGold/spendGold` work correctly
- [ ] Save format includes `gold` field; round-trips on save/load
- [ ] `goldPile` texture exists in the texture cache
- [ ] Enemies drop gold piles via `loot.js` with the correct formulas
- [ ] Bosses drop bigger gold piles (`mLevel * 50`)
- [ ] Chests drop gold piles when opened
- [ ] Player overlap auto-collects gold and increments the counter
- [ ] HUD shows "Gold: NNN" below the Eisenbrocken counter
- [ ] No double-pickup bug (sprite destroy is final)
- [ ] Existing tests still pass (`node tools/runTests.js`)
- [ ] Smoke test passes with 0 console errors

## Risks

| Risk | Mitigation |
|---|---|
| Eisenbrocken break (FR-012) | Do NOT touch the Eisenbrocken code path; gold lives in `materialCounts.GOLD`, NOT `materialCounts.MAT` |
| Gold sprite count grows unbounded | 5-minute despawn timeout per pile |
| Double pickup on overlap | Set `pile.body.enable = false` immediately on first hit before destroy |
| HUD text overlap with Eisenbrocken counter | Position 16px below; same x; same monospace font |

## Reviewer Guidance

1. Test killing enemies and verifying gold accumulates.
2. Spend gold via console: `window.LootSystem.spendGold(20)` → counter drops.
3. Try to spend more than you have: `spendGold(99999)` → returns false; counter unchanged.
4. Open a save from before this WP — `materialCounts.GOLD` initializes to 0, no errors.
5. Check that the existing Eisenbrocken counter still updates when materials are spent at the forge.
