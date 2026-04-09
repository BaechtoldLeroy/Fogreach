---
work_package_id: WP04
title: Health Potions
dependencies: []
requirement_refs:
- FR-013
- FR-014
- FR-015
- FR-016
- FR-028
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 020-loot-economy-overhaul-WP03
base_commit: 2506bf9adfcd145f6d63a3616ae16908d39f3467
created_at: '2026-04-09T16:52:06.200804+00:00'
subtasks: [T020, T021, T022, T023, T024, T025]
shell_pid: "3884"
agent: "claude"
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/main.js
execution_mode: code_change
lane: planned
owned_files:
- js/main.js
- js/abilitySystem.js
---

# WP04 — Health Potions

## Objective

Add 4 tiers of health potions (Minor / Normal / Major / Super) with HoT healing, F-key hotkey, 2-second global cooldown, and HUD cooldown indicator. Seed new game with 2 Minor potions.

## Context

Read first:
- [../spec.md](../spec.md) — FR-013, FR-014, FR-015, FR-016, FR-028
- [../data-model.md](../data-model.md) — POTION_DEFS shape (4 entries)
- [../contracts/lootSystem.api.md](../contracts/lootSystem.api.md) — consumePotion / onPotionKey / isPotionOnCooldown contracts

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Stacks on WP01. Parallel-safe with WP02/WP03/WP07.
- Implementation command: `spec-kitty implement WP04 --base WP01`

## Files Owned

- `js/lootSystem.js` (you ADD POTION_DEFS data + bodies for consumePotion/onPotionKey/isPotionOnCooldown)
- `js/main.js` (F-key handler + cooldown HUD indicator)
- `js/abilitySystem.js` (resetForNewGame seeds 2 Minor potions)

## Subtasks

### T020 — Define POTION_DEFS (4 tiers)

**Purpose:** The 4 potion tier templates from `data-model.md`.

**Steps:**
1. Open `js/lootSystem.js`. Replace the WP01 placeholder `const POTION_DEFS = [];`.
2. Add the 4 entries from `data-model.md`:
   ```js
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
       bonusEffect: { tempMaxHp: 0.10, durationMs: 30000 }
     })
   ]);
   ```
3. The Super tier has a `bonusEffect` (+10% temp max HP for 30s) — implement the temp-buff in T023.

**Files:** `js/lootSystem.js` (~30 lines added)

**Validation:** `LootSystem.POTION_DEFS.length === 4`. Each entry has `potionTier`, `healPercent`, `goldCost`.

---

### T021 — Implement consumePotion / onPotionKey / isPotionOnCooldown

**Purpose:** The potion-use API. F-key calls `onPotionKey()` which finds and uses the best available potion.

**Steps:**
1. Replace the WP01 stubs in `js/lootSystem.js`:
   ```js
   let _potionCooldownUntil = 0;
   const POTION_GLOBAL_CD_MS = 2000;

   function isPotionOnCooldown() {
     return Date.now() < _potionCooldownUntil;
   }

   function consumePotion(slot) {
     if (isPotionOnCooldown()) return false;
     if (typeof slot !== 'number' || !window.inventory) return false;
     const item = window.inventory[slot];
     if (!item || item.type !== 'potion') return false;
     // Find the def
     const def = POTION_DEFS.find((p) => p.potionTier === item.potionTier);
     if (!def) return false;
     // Apply HoT
     _applyHoT(def);
     // Decrement stack or remove
     const stack = item.stack || 1;
     if (stack > 1) {
       item.stack = stack - 1;
     } else {
       window.inventory[slot] = null;
     }
     // Set cooldown
     _potionCooldownUntil = Date.now() + POTION_GLOBAL_CD_MS;
     // Refresh HUD
     if (typeof window._refreshInventoryHUD === 'function') window._refreshInventoryHUD();
     return true;
   }

   function onPotionKey() {
     if (isPotionOnCooldown()) return false;
     if (!window.inventory) return false;
     // Find highest-tier potion in inventory
     let bestSlot = -1;
     let bestTier = 0;
     for (let i = 0; i < window.inventory.length; i++) {
       const it = window.inventory[i];
       if (it && it.type === 'potion' && it.potionTier > bestTier) {
         bestTier = it.potionTier;
         bestSlot = i;
       }
     }
     if (bestSlot < 0) return false;
     return consumePotion(bestSlot);
   }
   ```
2. The HoT helper `_applyHoT(def)` is implemented in T023.

**Files:** `js/lootSystem.js` (~60 lines added)

**Validation:** Mock `window.inventory[0] = {type:'potion', potionTier:1, stack:1}`; call `LootSystem.onPotionKey()` → returns true; inventory[0] is null; `isPotionOnCooldown()` is true.

---

### T022 — F-key handler in main.js GameScene

**Purpose:** Wire the `F` keyboard event to call `LootSystem.onPotionKey()`.

**Steps:**
1. Open `js/main.js`. Find GameScene `create()` (the function that registers other key handlers like K for loadout, O for settings).
2. Add:
   ```js
   this.input.keyboard.on('keydown-F', () => {
     if (window.LootSystem && typeof window.LootSystem.onPotionKey === 'function') {
       window.LootSystem.onPotionKey();
     }
   });
   ```
3. Cleanup on scene shutdown:
   ```js
   this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
     this.input.keyboard.off('keydown-F');
   });
   ```
4. ⚠️ F was previously slot4 ability before the QWER refactor. Verified FREE in spec assumption.

**Files:** `js/main.js` (~10 lines added)

**Validation:** In the dungeon, press F. With a potion in inventory, the potion is consumed. Without one, nothing happens.

---

### T023 — HoT effect implementation

**Purpose:** Heal the player gradually over `healDurationMs` instead of all at once.

**Steps:**
1. In `js/lootSystem.js`, add the helper `_applyHoT(def)`:
   ```js
   function _applyHoT(def) {
     if (typeof window.playerMaxHealth !== 'number') return;
     if (typeof window.addPlayerHealth !== 'function') return;
     const totalHeal = Math.round(def.healPercent * window.playerMaxHealth);
     const tickIntervalMs = 100;  // 10 ticks per second
     const ticks = Math.max(1, Math.floor(def.healDurationMs / tickIntervalMs));
     const perTick = Math.max(1, Math.floor(totalHeal / ticks));
     // Find the active scene to schedule timers
     const scene = window.gameScene || (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.find((s) => s && s.sys && s.sys.isActive()));
     if (!scene || !scene.time) {
       // Fallback: instant heal
       window.addPlayerHealth(totalHeal);
       return;
     }
     for (let i = 0; i < ticks; i++) {
       scene.time.delayedCall(i * tickIntervalMs, () => {
         if (typeof window.addPlayerHealth === 'function') {
           window.addPlayerHealth(perTick);
         }
       });
     }
     // Apply Super tier bonus effect if applicable
     if (def.bonusEffect && def.bonusEffect.tempMaxHp) {
       const bonus = Math.round(window.playerMaxHealth * def.bonusEffect.tempMaxHp);
       window.playerMaxHealth += bonus;
       window.addPlayerHealth(bonus);  // also fill the new max
       scene.time.delayedCall(def.bonusEffect.durationMs, () => {
         window.playerMaxHealth = Math.max(1, window.playerMaxHealth - bonus);
         if (window.playerHealth > window.playerMaxHealth) window.playerHealth = window.playerMaxHealth;
       });
     }
   }
   ```
2. The HoT respects the existing `addPlayerHealth(delta)` clamp to maxHealth.

**Files:** `js/lootSystem.js` (~50 lines added)

**Validation:** Take damage, press F, watch HP slowly tick up over 3 seconds (Normal tier).

---

### T024 — HUD cooldown indicator

**Purpose:** Visual feedback that the potion cooldown is active so the player knows when they can press F again.

**Steps:**
1. In `js/main.js` (GameScene create), after the gold counter from WP03, add a small Phaser graphics object for the potion cooldown:
   ```js
   const potionCdGfx = this.add.graphics().setScrollFactor(0).setDepth(1001);
   const potionCdLabel = this.add.text(0, 0, 'F', {
     fontFamily: 'monospace', fontSize: '12px', color: '#88ff88'
   }).setScrollFactor(0).setDepth(1002).setVisible(false);
   ```
2. Position next to the player health bar (search for `playerHealthText` and put it just to the right).
3. In the GameScene `update()` loop, redraw the cooldown:
   ```js
   if (window.LootSystem && window.LootSystem.isPotionOnCooldown && potionCdGfx) {
     potionCdGfx.clear();
     if (window.LootSystem.isPotionOnCooldown()) {
       const now = Date.now();
       // Read internal _potionCooldownUntil somehow — expose a getter
       const remainMs = window.LootSystem._getPotionCooldownRemaining ? window.LootSystem._getPotionCooldownRemaining() : 0;
       const total = 2000;
       const fraction = remainMs / total;
       // Draw a small filled circle that empties as cooldown progresses
       potionCdGfx.fillStyle(0x44ff44, 0.4);
       potionCdGfx.beginPath();
       potionCdGfx.moveTo(potionCdLabelX, potionCdLabelY);
       potionCdGfx.arc(potionCdLabelX, potionCdLabelY, 12, -Math.PI/2, -Math.PI/2 + fraction * Math.PI * 2, false);
       potionCdGfx.closePath();
       potionCdGfx.fillPath();
       potionCdLabel.setVisible(true);
     } else {
       potionCdLabel.setVisible(false);
     }
   }
   ```
4. Expose a small helper from lootSystem.js so main.js can read remaining cooldown:
   ```js
   // in lootSystem.js
   window.LootSystem._getPotionCooldownRemaining = () => Math.max(0, _potionCooldownUntil - Date.now());
   ```
5. The exact positioning is up to you — just don't overlap with existing HUD elements.

**Files:** `js/main.js` (~30 lines added), `js/lootSystem.js` (~5 lines added for the helper export)

**Validation:** Press F with a potion, the indicator shows the cooldown filling. Try to press F again — nothing happens; indicator is still active. After 2s, indicator disappears.

---

### T025 — Seed new game with 2 Minor potions

**Purpose:** Players starting a new game have potions from turn 1 (FR-028).

**Steps:**
1. Open `js/abilitySystem.js`. Find `resetForNewGame()` (already exists from feature 020-pre).
2. After the existing seeding (gold default, etc.), add:
   ```js
   // FR-028: seed 2 Minor health potions
   if (Array.isArray(window.inventory)) {
     // Find first empty slot
     for (let i = 0; i < window.inventory.length; i++) {
       if (!window.inventory[i]) {
         window.inventory[i] = {
           type: 'potion',
           potionTier: 1,
           name: 'Heiltrank (Klein)',
           iconKey: 'itPotionMinor',
           stack: 2
         };
         break;
       }
     }
   }
   ```
3. The 2 potions are stacked into a single inventory slot.

**Files:** `js/abilitySystem.js` (~15 lines added)

**Validation:** Click "NEUES SPIEL" → check inventory → first empty slot has a "Heiltrank (Klein)" stack of 2.

---

## Definition of Done

- [ ] `POTION_DEFS` has 4 frozen entries matching data-model
- [ ] `consumePotion(slot)` works and respects cooldown
- [ ] `onPotionKey()` finds the highest-tier potion and consumes it
- [ ] F key in GameScene triggers `onPotionKey()`
- [ ] HoT heals 60% (Normal) over 3 seconds in 30 ticks
- [ ] Super tier applies +10% temp max HP for 30s (and removes it correctly)
- [ ] HUD cooldown indicator visible during the 2s window
- [ ] New game seeds inventory with 2 Minor Health Potions
- [ ] Smoke + unit tests still pass
- [ ] No console errors

## Risks

| Risk | Mitigation |
|---|---|
| F-key conflict with another handler | Verified FREE per spec assumption + plan risk register |
| HoT continues after player death | The `addPlayerHealth` function should be a no-op when player is dead — verify |
| Temp max HP buff doesn't reverse | Use scene.time.delayedCall to ensure the cleanup runs |
| Stack count desyncs (drop-pickup-stack edge cases) | Validate against the existing inventory stacking logic if any |
| addPlayerHealth not defined when tests run | Tests for HoT skip the timer-driven path; only validate `consumePotion` returns true and inventory is decremented |

## Reviewer Guidance

1. New game → inventory has 2 Minor potions in one slot.
2. Take damage, press F, watch HP tick up gradually (not instant).
3. Press F again immediately → no effect.
4. Wait 2s, press F → works again.
5. Reach a state where you have multiple potion tiers — F should always pick the HIGHEST tier first.
6. Super potion (test by injecting via console) → max HP temporarily goes up by 10%, reverts after 30s.

## Activity Log

- 2026-04-09T16:52:06Z – claude – shell_pid=3884 – lane=doing – Started implementation via workflow command
