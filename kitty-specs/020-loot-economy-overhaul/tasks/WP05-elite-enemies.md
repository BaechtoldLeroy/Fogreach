---
work_package_id: WP05
title: Elite Enemies
dependencies: [WP02]
requirement_refs:
- FR-022
- FR-023
- FR-024
- FR-025
planning_base_branch: main
merge_target_branch: main
branch_strategy: main → main (stacks on WP02)
subtasks: [T026, T027, T028, T029, T030, T031, T032, T033, T034]
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/eliteEnemies.js
execution_mode: code_change
lane: planned
owned_files:
- js/eliteEnemies.js
- js/enemy.js
- js/loot.js
- index.html
- tests/eliteEnemies.test.js
---

# WP05 — Elite Enemies

## Objective

Add D2-style Champion and Unique elite enemies. They get random affixes from a 10-entry pool, scale with dungeon depth, are visually differentiated by tint + aura + name tag, and drop bonus loot. Hooks into the existing `spawnEnemy` and drop pipelines without breaking regular enemy spawns.

## Context

Read first:
- [../spec.md](../spec.md) — FR-022, FR-023, FR-024, FR-025
- [../data-model.md](../data-model.md) — `EnemyAffixDef` (10 entries) + `EliteEnemy` shape
- [../contracts/eliteEnemies.api.md](../contracts/eliteEnemies.api.md) — public API + 10-item test contract
- [../research.md](../research.md) — visual layering decisions

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Stacks on WP02 (uses `LootSystem.rollItem` for guaranteed Magic+ drops on Unique kills).
- Implementation command: `spec-kitty implement WP05 --base WP02`

## Files Owned

- `js/eliteEnemies.js` (NEW — you create this file)
- `js/enemy.js` (you ADD a hook in spawnEnemy; nothing else)
- `js/loot.js` (you ADD a hook in the drop pipeline; nothing else)
- `index.html` (you ADD ONE script tag)
- `tests/eliteEnemies.test.js` (NEW — you create this file)

## Subtasks

### T026 — Create js/eliteEnemies.js IIFE skeleton

**Purpose:** Same pattern as WP01 — establish the module shape with stub exports.

**Steps:**
1. Create `js/eliteEnemies.js` with the IIFE pattern.
2. Stub all public API methods:
   ```js
   (function () {
     const ENEMY_AFFIX_DEFS = [/* T027 */];

     function shouldSpawnElite(depth, rng = Math.random) { /* T028 */ }
     function applyEliteToEnemy(enemy, eliteTier, rng = Math.random) { /* T029 */ }
     function modifyDropTable(enemy, baseDrops) { /* T031 */ }

     window.EliteEnemies = {
       ENEMY_AFFIX_DEFS,
       shouldSpawnElite,
       applyEliteToEnemy,
       modifyDropTable
     };
   })();
   ```

**Files:** `js/eliteEnemies.js` (~30 lines)

**Validation:** `window.EliteEnemies` exists after page load.

---

### T027 — Define ENEMY_AFFIX_DEFS (10 entries)

**Purpose:** Hardcode the 10 enemy affixes from data-model.md, each with an `apply(enemy)` mutation function.

**Steps:**
1. Define the array with the 10 entries (from data-model.md table):
   - `fanatic`, `lightning_enchanted`, `cold_aura`, `spectral_hit`, `multishot`, `vampiric`, `berserker`, `extra_strong`, `extra_fast`, `magic_resistant`
2. Each `apply(enemy)` function is non-trivial. Examples:
   ```js
   {
     id: 'fanatic',
     displayName: 'Fanatic',
     tint: 0xff8844,
     auraColor: 0xff5500,
     category: 'speed',
     apply: function (enemy) {
       enemy.speed = (enemy.speed || 60) * 1.5;
       enemy._attackCdMul = (enemy._attackCdMul || 1) * 0.5;
       enemy.isFanatic = true;
     }
   },
   {
     id: 'extra_strong',
     displayName: 'Extra Strong',
     tint: 0xffaa00,
     auraColor: 0xff8800,
     category: 'offense',
     apply: function (enemy) {
       enemy.damage = (enemy.damage || 1) * 2;
     }
   },
   {
     id: 'extra_fast',
     displayName: 'Extra Fast',
     tint: 0x00ffcc,
     auraColor: 0x00ffff,
     category: 'speed',
     apply: function (enemy) {
       enemy.speed = (enemy.speed || 60) * 1.5;
     }
   },
   // ... all 10 entries
   ```
3. Some affixes require deeper hooks (lightning_enchanted needs a death-explosion handler, vampiric needs a hit hook). For these:
   - Mark the enemy with a flag (`enemy.isLightningEnchanted = true`)
   - The actual behavior can be implemented as a side effect in the `apply` callback OR deferred as a TODO comment if it would require touching combat code outside this WP's owned files
   - For this WP, focus on the FLAG-and-tint side; the deep behavior hooks (lightning death-explosion, etc.) are nice-to-have. Document them as `TODO: hook into combat` in the apply functions where they'd be needed.

**Files:** `js/eliteEnemies.js` (~150 lines added)

**Validation:** `EliteEnemies.ENEMY_AFFIX_DEFS.length === 10`. Each entry has `id`, `displayName`, `tint`, `auraColor`, `apply`. Calling `apply({})` doesn't throw.

---

### T028 — Implement shouldSpawnElite(depth, rng?)

**Purpose:** Decide whether to make an enemy elite, based on dungeon depth.

**Steps:**
1. Implement per FR-024 spawn rate logic:
   ```js
   function shouldSpawnElite(depth, rng = Math.random) {
     if (depth < 6) return null;
     let championRate, uniqueRate;
     if (depth <= 10) { championRate = 0.25; uniqueRate = 0.05; }
     else if (depth <= 15) { championRate = 0.35; uniqueRate = 0.10; }
     else { championRate = 0.40; uniqueRate = 0.15; }
     const r = rng();
     if (r < uniqueRate) return 'unique';
     if (r < uniqueRate + championRate) return 'champion';
     return null;
   }
   ```
2. Pure function — no globals touched.

**Files:** `js/eliteEnemies.js` (~20 lines added)

**Validation:** `shouldSpawnElite(1)` always returns null. `shouldSpawnElite(20)` returns elite ~55% of the time across many calls.

---

### T029 — Implement applyEliteToEnemy(enemy, eliteTier, rng?)

**Purpose:** Mutate a regular enemy into an elite — pick affixes, apply effects, change visuals.

**Steps:**
1. Implement:
   ```js
   function applyEliteToEnemy(enemy, eliteTier, rng = Math.random) {
     if (!enemy || !enemy.scene) return;
     // Pick affixes
     const isUnique = eliteTier === 'unique';
     const affixCount = isUnique ? (2 + Math.floor(rng() * 2)) : 1;  // 2-3 for unique, 1 for champion
     const pool = ENEMY_AFFIX_DEFS.slice();
     const picked = [];
     for (let i = 0; i < affixCount && pool.length > 0; i++) {
       const idx = Math.floor(rng() * pool.length);
       picked.push(pool.splice(idx, 1)[0]);
     }
     // Apply each affix
     for (const def of picked) {
       try { def.apply(enemy); } catch (e) { /* swallow */ }
     }
     // HP boost
     const hpMul = isUnique ? 2.0 : 1.5;
     enemy.hp = Math.round((enemy.hp || 50) * hpMul);
     enemy.maxHp = enemy.hp;
     // Mark
     enemy._isElite = true;
     enemy.eliteTier = eliteTier;
     enemy.eliteAffixes = picked.map((d) => d.id);
     // Visual tint from first affix
     if (picked.length > 0 && enemy.setTint) {
       enemy.setTint(picked[0].tint);
     }
     // Aura graphic at depth 38 (under enemy depth 50)
     if (picked.length > 0 && enemy.scene.add && enemy.scene.add.graphics) {
       const aura = enemy.scene.add.graphics();
       aura.fillStyle(picked[0].auraColor, 0.35);
       aura.fillCircle(enemy.x, enemy.y, 36);
       aura.setDepth(38);
       enemy._eliteAura = aura;
       // Follow the enemy (cheap: per-frame in the existing enemy update loop)
       enemy.scene.events.on('update', () => {
         if (enemy.active && aura.active) {
           aura.x = enemy.x - aura._initialX;  // hack — actually just clear/redraw
         }
       });
       // Simpler: clear and redraw each frame in the update path. Or use a follow mechanism via scene tweens.
       // For this prompt, use a setInterval on scene timer:
       const auraTimer = enemy.scene.time.addEvent({
         delay: 16, loop: true,
         callback: () => {
           if (!enemy.active || !aura.active) {
             auraTimer.remove();
             return;
           }
           aura.clear();
           aura.fillStyle(picked[0].auraColor, 0.35);
           aura.fillCircle(enemy.x, enemy.y, 36);
         }
       });
       enemy._eliteAuraTimer = auraTimer;
     }
     // Floating name tag
     if (enemy.scene.add && enemy.scene.add.text) {
       const baseTypeName = enemy._typeName || _enemyTypeName(enemy);
       const nameTagText = picked.map((d) => d.displayName).join(' ') + ' ' + baseTypeName;
       const tag = enemy.scene.add.text(enemy.x, enemy.y - 30, nameTagText, {
         fontFamily: 'monospace', fontSize: '11px', color: '#ffaa00',
         backgroundColor: '#000a', padding: { x: 3, y: 1 }
       }).setOrigin(0.5).setDepth(51);
       enemy._eliteNameTag = tag;
       const tagTimer = enemy.scene.time.addEvent({
         delay: 16, loop: true,
         callback: () => {
           if (!enemy.active || !tag.active) {
             tagTimer.remove();
             return;
           }
           tag.x = enemy.x;
           tag.y = enemy.y - 30;
         }
       });
       enemy._eliteNameTagTimer = tagTimer;
     }
     // Cleanup hook on enemy destroy
     const origDestroy = enemy.destroy.bind(enemy);
     enemy.destroy = function () {
       if (enemy._eliteAura) enemy._eliteAura.destroy();
       if (enemy._eliteNameTag) enemy._eliteNameTag.destroy();
       if (enemy._eliteAuraTimer) enemy._eliteAuraTimer.remove();
       if (enemy._eliteNameTagTimer) enemy._eliteNameTagTimer.remove();
       origDestroy();
     };
   }

   function _enemyTypeName(enemy) {
     if (enemy.isBrute) return 'Brute';
     if (enemy.isImp) return 'Imp';
     if (enemy.isArcher) return 'Archer';
     if (enemy.isMage) return 'Mage';
     if (enemy.isFlameWeaver) return 'Flame Weaver';
     if (enemy.isShadowCreeper) return 'Shadow';
     if (enemy.isChainGuard) return 'Chain Guard';
     return 'Enemy';
   }
   ```
2. Edge cases:
   - If `enemy.scene` is gone, skip everything (race during shutdown)
   - If `enemy.setTint` doesn't exist, skip the tint
   - Always add the aura/name tag CLEANUPS in destroy override

**Files:** `js/eliteEnemies.js` (~120 lines added)

**Validation:** Mock an enemy object with `hp=60, scene={...stub}`, call `applyEliteToEnemy(enemy, 'unique')`, assert `enemy.hp === 120`, `enemy._isElite === true`, `enemy.eliteAffixes.length` is 2 or 3.

---

### T030 — Hook into js/enemy.js spawnEnemy

**Purpose:** Make every regular enemy creation pass through the elite check.

**Steps:**
1. Open `js/enemy.js`. Find the `spawnEnemy` function.
2. AFTER the regular enemy creation completes (just before the function returns), add:
   ```js
   // Elite check (non-breaking — only fires if EliteEnemies is loaded)
   if (window.EliteEnemies && typeof window.EliteEnemies.shouldSpawnElite === 'function') {
     try {
       const tier = window.EliteEnemies.shouldSpawnElite(window.currentWave || 1);
       if (tier) {
         window.EliteEnemies.applyEliteToEnemy(enemy, tier);
       }
     } catch (err) {
       console.warn('[enemy] elite injection failed', err);
     }
   }
   return enemy;
   ```
3. Wrap in try/catch so a buggy elite implementation doesn't break regular enemy spawning.

**Files:** `js/enemy.js` (~12 lines added)

**Validation:** Enter the dungeon at wave 10+. Spawn a few enemies. Some should appear with tint + aura + name tag.

---

### T031 — Implement modifyDropTable

**Purpose:** Elite enemies drop more loot.

**Steps:**
1. Implement in `js/eliteEnemies.js`:
   ```js
   function modifyDropTable(enemy, baseDrops) {
     if (!enemy || !enemy._isElite) return baseDrops;
     const drops = baseDrops ? { ...baseDrops, items: (baseDrops.items || []).slice(), gold: baseDrops.gold || 0 } : { items: [], gold: 0 };
     if (enemy.eliteTier === 'champion') {
       // ×1.5 drop count (already-rolled items get duplicated for the extra)
       const extraCount = Math.floor(drops.items.length * 0.5);
       for (let i = 0; i < extraCount; i++) {
         drops.items.push(drops.items[i % drops.items.length]);  // mirror existing
       }
       // No gold bonus
     } else if (enemy.eliteTier === 'unique') {
       // ×2 drop count
       drops.items = drops.items.concat(drops.items.slice());
       // Guaranteed Magic+ item via LootSystem.rollItem
       if (window.LootSystem && typeof window.LootSystem.rollItem === 'function') {
         try {
           const guaranteed = window.LootSystem.rollItem(null, enemy.iLevel || enemy.mLevel || 5, 1);  // forceTier=1 (Magic)
           drops.items.push(guaranteed);
         } catch (e) { /* ignore */ }
       }
       drops.gold = Math.round((drops.gold || 0) * 1.5);
     }
     return drops;
   }
   ```

**Files:** `js/eliteEnemies.js` (~35 lines added)

**Validation:** `modifyDropTable({_isElite: true, eliteTier: 'unique', iLevel: 5}, {items: [{tier:0}], gold: 10})` returns drops with > 1 item and gold > 10.

---

### T032 — Hook elite drop bonus into js/loot.js

**Purpose:** Make the actual drop pipeline use the elite bonus.

**Steps:**
1. Open `js/loot.js`. Find the function that handles enemy drops (likely `dropLootForEnemy(enemy)` or similar).
2. Wherever the drop table is constructed, AFTER computing the base drops but BEFORE spawning sprites, add:
   ```js
   if (window.EliteEnemies && typeof window.EliteEnemies.modifyDropTable === 'function') {
     drops = window.EliteEnemies.modifyDropTable(enemy, drops);
   }
   ```
3. Make sure the loop that spawns the actual loot sprites runs over the modified `drops.items` array.

**Files:** `js/loot.js` (~5 lines added)

**Validation:** Kill an elite enemy in the dungeon, observe more loot drops than from a regular enemy.

---

### T033 — Add script tag to index.html

**Purpose:** Load the new module in the right order.

**Steps:**
1. Open `index.html`. Find `<script src="js/enemy.js"></script>`.
2. Insert AFTER it (and BEFORE the scene scripts):
   ```html
   <script src="js/eliteEnemies.js"></script>
   ```
3. Reload, check console: `window.EliteEnemies` exists.

**Files:** `index.html` (1 line added)

**Validation:** `typeof window.EliteEnemies === 'object'` in browser console.

---

### T034 — tests/eliteEnemies.test.js

**Purpose:** Unit tests for the pure-logic parts (spawn rate, mutation, drop modification). 10 tests per the contract.

**Steps:**
1. Create `tests/eliteEnemies.test.js` using the existing test setup pattern.
2. Tests:
   - `ENEMY_AFFIX_DEFS.length >= 10`
   - Each entry has `id`, `displayName`, `tint`, `apply`
   - `shouldSpawnElite(1)` always returns null (1000 trials)
   - `shouldSpawnElite(10)` returns elite ~30% of the time (Monte Carlo, ±5% tolerance)
   - `shouldSpawnElite(20)` returns elite ~55% (Monte Carlo)
   - `applyEliteToEnemy` on a mock with `hp=60` and `eliteTier='unique'` results in `enemy.hp >= 120`
   - `applyEliteToEnemy` sets `enemy._isElite = true`
   - `applyEliteToEnemy` for champion picks exactly 1 affix
   - `applyEliteToEnemy` for unique picks 2 or 3 affixes
   - `modifyDropTable` for non-elite returns input unchanged
3. Mock enemy = plain JS object: `{hp: 60, damage: 5, speed: 60, scene: null, setTint: () => {}}`. The `scene: null` makes the visual code skip cleanly.
4. Use the same `loadGameModule` helper:
   ```js
   delete globalThis.window.EliteEnemies;
   loadGameModule('js/eliteEnemies.js');
   const sys = globalThis.window.EliteEnemies;
   ```

**Files:** `tests/eliteEnemies.test.js` (~150 lines)

**Validation:** `node tools/runTests.js` runs the new tests, all 10 pass.

---

## Definition of Done

- [ ] `js/eliteEnemies.js` exists with the IIFE pattern
- [ ] `ENEMY_AFFIX_DEFS` has 10 frozen entries
- [ ] `shouldSpawnElite` follows the depth-tiered probabilities
- [ ] `applyEliteToEnemy` mutates HP, applies tint, creates aura + name tag
- [ ] Aura + name tag follow the enemy and clean up on death
- [ ] `js/enemy.js spawnEnemy` calls EliteEnemies for elite injection
- [ ] `js/loot.js` calls modifyDropTable on enemy death
- [ ] Champions drop ×1.5 loot, Uniques drop ×2 + guaranteed Magic+ + 50% gold
- [ ] `tests/eliteEnemies.test.js` has 10 passing tests
- [ ] All existing tests still pass
- [ ] Smoke test passes with 0 console errors

## Risks

| Risk | Mitigation |
|---|---|
| Aura graphics leak (forgot to destroy) | Override `enemy.destroy` to clean up aura + name tag + timers |
| Per-frame timer for aura position is expensive | Use a single `scene.time.addEvent` per enemy, cleared on death |
| Affix `apply` mutations conflict with existing enemy AI flags | Only set new flags (`isFanatic`, `isLightningEnchanted`) — never override existing ones |
| `LootSystem.rollItem` not available when modifyDropTable runs | Wrap in `if (window.LootSystem)` check |
| Test runs hit Phaser scene methods | Use mock enemy with `scene: null` so visual code branches skip |

## Reviewer Guidance

1. Wave 10+ in the dungeon. Within 5 enemy kills you should see at least one elite (tinted + aura + name tag).
2. Kill an elite — count the dropped items, verify ≥ regular enemy.
3. Kill a Unique elite — verify a guaranteed Magic+ item is in the drops.
4. Open DevTools, find the elite enemy via `enemies.children.entries[0]` — verify `_isElite`, `eliteTier`, `eliteAffixes` fields exist.
5. Wait for the elite to die, then check `aura.active === false` and `nameTag.active === false` — no leak.
