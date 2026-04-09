---
work_package_id: WP07
title: Ability Modifier Integration
dependencies: []
requirement_refs:
- FR-029
- FR-030
- FR-031
- FR-032
- FR-033
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 020-loot-economy-overhaul-WP06
base_commit: 36ab61ce9e84344af3c47bb86b0dd567be7a5f95
created_at: '2026-04-09T18:12:08.872971+00:00'
subtasks: [T044, T045, T046, T047, T048]
shell_pid: "55652"
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/player.js
execution_mode: code_change
lane: planned
owned_files:
- js/player.js
---

# WP07 — Ability Modifier Integration

## Objective

Wire the combat code (damage + cooldown computation) to consult `LootSystem.getBonus()`. Update HUD slot tiles to show bonus badges + faster radial sweep when ability-modifier affixes are equipped. This is what makes loot drops actually CHANGE how the player plays.

## Context

Read first:
- [../spec.md](../spec.md) — FR-029 to FR-033, scenario 7 (build-defining drop)
- [../contracts/lootSystem.api.md](../contracts/lootSystem.api.md) — getBonus contract, AggregatedBonuses cache
- WP01 — for the cache implementation

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Stacks on WP01. Parallel-safe with WP02/WP03/WP04.
- Implementation command: `spec-kitty implement WP07 --base WP01`

## Files Owned

- `js/player.js` (you patch ability damage/cooldown computation)
- `js/abilitySystem.js` (you patch ability fire entry points if needed)
- `js/main.js` (HUD bonus badge on slot tiles)
- `js/scenes/CraftingScene.js` (recomputeBonuses on equip change)

## Subtasks

### T044 — Patch ability damage to consult getBonus

**Purpose:** Ability hits deal more damage when an item with `dmg_<ability>` or `dmg_all_abilities` is equipped.

**Steps:**
1. Open `js/player.js`. Search for the per-ability damage calculation. Each ability has a damage value computed somewhere — find every spot.
2. Find the spinAttack damage calculation (search for `spinAttack` and look for damage/dmg variables nearby). For example:
   ```js
   const baseDmg = SPIN_ATTACK_BASE_DAMAGE * weaponDamage;
   ```
3. Add the LootSystem multiplier:
   ```js
   const baseDmg = SPIN_ATTACK_BASE_DAMAGE * weaponDamage;
   const bonusMul = 1 + (window.LootSystem ? window.LootSystem.getBonus('dmg_spinAttack') : 0)
                       + (window.LootSystem ? window.LootSystem.getBonus('dmg_all_abilities') : 0);
   const finalDmg = baseDmg * bonusMul;
   ```
4. Repeat for: `chargeSlash`, `dashSlash`, `daggerThrow`, `shieldBash`. Each one needs the same pattern but with the matching `statKey` (`dmg_chargeSlash`, etc.).
5. Also patch the regular attack damage (the basic SPACE attack) — use `dmg_all_abilities` only (no per-ability bonus for plain attack).

**Files:** `js/player.js` (~20-40 lines patched across multiple ability handlers)

**Validation:** Mock `window.equipment` with an item that has `dmg_spinAttack: 25%`, recomputeBonuses, fire spinAttack — damage is 25% higher than baseline.

---

### T045 — Patch ability cooldowns to consult getBonus

**Purpose:** Items with `cd_<ability>` or `cd_all_abilities` reduce cooldown.

**Steps:**
1. In `js/player.js` (or wherever cooldowns are computed for each ability), find the cooldown values. Typically passed to `startCooldownTimer(scene, duration, options)`.
2. Patch each cooldown calculation:
   ```js
   const baseCD = SPIN_ATTACK_COOLDOWN_MS;
   const cdReductionMul = 1
     - (window.LootSystem ? window.LootSystem.getBonus('cd_spinAttack') : 0)
     - (window.LootSystem ? window.LootSystem.getBonus('cd_all_abilities') : 0);
   const effectiveCD = Math.max(100, baseCD * cdReductionMul);  // floor at 100ms
   startCooldownTimer(scene, effectiveCD, { ... });
   ```
3. Repeat for each ability (chargeSlash, dashSlash, daggerThrow, shieldBash).
4. The HUD radial cooldown sweep speed automatically reflects the effective duration because `updateAbilityStatus(key, { remainingMs, durationMs })` is called with `durationMs = effectiveCD`.

**Files:** `js/player.js` (~25 lines patched)

**Validation:** Equip `cd_chargeSlash: 12%`, fire chargeSlash, the cooldown radial visibly ticks faster than baseline.

---

### T046 — HUD bonus badge on slot tiles

**Purpose:** Show a small `+22%` or `-12%` badge under each slot tile name when bonuses are active.

**Steps:**
1. Open `js/main.js`. Find `buildTile` (the helper that creates each ability HUD tile).
2. Add a new Phaser text object inside the tile container:
   ```js
   const bonusBadge = scene.add.text(badgeX + badgeWidth/2, badgeY + badgeHeight + 4, '', {
     fontFamily: 'monospace', fontSize: '10px', color: '#ffd166'
   }).setOrigin(0.5, 0).setVisible(false);
   container.add(bonusBadge);
   ```
3. Store `bonusBadge` on the returned tile object.
4. In `refreshSlotMappings()` (where slot keys are mapped to abilities), update the badge:
   ```js
   const dmgKey = 'dmg_' + abilityId;
   const cdKey = 'cd_' + abilityId;
   const dmgBonus = window.LootSystem ? window.LootSystem.getBonus(dmgKey) + window.LootSystem.getBonus('dmg_all_abilities') : 0;
   const cdBonus = window.LootSystem ? window.LootSystem.getBonus(cdKey) + window.LootSystem.getBonus('cd_all_abilities') : 0;
   if (dmgBonus > 0 || cdBonus > 0) {
     const parts = [];
     if (dmgBonus > 0) parts.push('+' + Math.round(dmgBonus * 100) + '%');
     if (cdBonus > 0) parts.push('-' + Math.round(cdBonus * 100) + '% CD');
     tile.bonusBadge.setText(parts.join(' '));
     tile.bonusBadge.setVisible(true);
   } else {
     tile.bonusBadge.setVisible(false);
   }
   ```
5. The badge updates whenever `window._refreshAbilityHUD()` is called (which `LootSystem.recomputeBonuses` already does in WP01).

**Files:** `js/main.js` (~30 lines patched)

**Validation:** Equip an item with a per-ability damage affix, see the badge appear on the matching slot tile.

---

### T047 — HUD radial cooldown speed reflects effective cooldown

**Purpose:** The radial pie wedge that shows cooldown progress should sweep based on the EFFECTIVE (post-bonus) cooldown, not the base.

**Steps:**
1. Verify (no code change needed if already correct): the radial wedge is drawn in `updateAbilityStatus(key, info)` based on `info.remainingMs / info.durationMs`. Both values come from `startCooldownTimer(scene, duration, ...)` which is called with the EFFECTIVE cooldown after T045. So as long as T045 is done correctly, T047 is automatic.
2. Test: equip a `-12% cd_spinAttack` item, fire spin attack, watch the radial — it should empty in `~1.32s` instead of `1.5s` (or whatever the base is). If it doesn't, the EFFECTIVE duration isn't reaching the HUD update path. Trace the `durationMs` parameter back through the call chain.
3. If a fix is needed: ensure `effectiveCD` (not `baseCD`) is what gets passed to `startCooldownTimer`.

**Files:** No new code if T045 is correct. Otherwise small fix in `js/player.js`.

**Validation:** Manual test: with and without a CD-reduction item equipped, the radial visibly sweeps at different rates.

---

### T048 — Hook recomputeBonuses into equip-change events

**Purpose:** When the player equips/unequips an item, the cache must be recomputed so the new bonuses take effect immediately.

**Steps:**
1. Find every place equipment is mutated. Likely candidates:
   - `js/inventory.js` — equip from inventory click
   - `js/scenes/CraftingScene.js` — equip from crafting
   - `js/storage.js applySaveToState` — equipment loaded from save
   - `js/scenes/ShopScene.js` — buying an item (if it auto-equips? no, it goes to inventory; OK)
2. After each mutation, add:
   ```js
   if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
     window.LootSystem.recomputeBonuses();
   }
   ```
3. The recompute will also call `window._refreshAbilityHUD()` which updates the bonus badges.
4. Also call `recomputeBonuses` once on game start (in `js/main.js GameScene create()` after the inventory is loaded).

**Files:** `js/inventory.js` (~5 lines), `js/scenes/CraftingScene.js` (~5 lines), `js/main.js` (~3 lines), `js/storage.js` (~3 lines)

**Validation:** Equip an item with a damage affix, immediately fire the matching ability — damage is boosted (no need to reload the scene).

---

## Definition of Done

- [ ] All 5 abilities (spinAttack, chargeSlash, dashSlash, daggerThrow, shieldBash) consult getBonus for damage
- [ ] All 5 abilities consult getBonus for cooldown
- [ ] Cooldowns clamp at 100ms minimum
- [ ] HUD slot tile bonus badge shows when an ability has a non-zero bonus
- [ ] Radial cooldown sweep visually reflects the EFFECTIVE cooldown
- [ ] Equipping/unequipping immediately updates the badge + sweep speed
- [ ] Smoke + unit tests still pass
- [ ] No console errors

## Risks

| Risk | Mitigation |
|---|---|
| Some ability damage paths missed in the patch | Grep for every `damage` / `dmg` reference in player.js to find all spots |
| O(1) lookup contract violated by accidental array iteration | Verify getBonus is just one object lookup; don't add findIndex/filter |
| Equip event hook missed in one place → bonuses go stale | Audit all equipment mutations; add recomputeBonuses to each |
| Bonus badge text overflows tile width | Cap to ~12 chars, use short format `+22%` not `+22% Damage` |

## Reviewer Guidance

1. Equip an item with `+25% Spin Attack Damage` — fire spin, verify damage is 25% higher.
2. Equip an item with `-15% Charged Slash Cooldown` — fire charge, verify cooldown is 15% shorter.
3. Equip an item with `+10% All Ability Damage` — every ability fires harder.
4. Equip 2 stacking items (e.g. `+25% Spin Attack Damage` and `+10% All Ability Damage`) — total bonus is 35% on spin.
5. Unequip the item — bonus disappears immediately, badge gone.
6. Open a save with no relevant items — no badges visible, baseline behavior.
