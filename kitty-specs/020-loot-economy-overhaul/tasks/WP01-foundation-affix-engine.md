---
work_package_id: WP01
title: Foundation & Affix Engine
dependencies: []
requirement_refs:
- FR-002
- FR-003
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: f53484c2b991b30ac2a8dec6bbfc2b222f6e88e8
created_at: '2026-04-09T14:56:47.288804+00:00'
subtasks: [T001, T002, T003, T004, T005, T006, T007]
shell_pid: "55372"
agent: "claude"
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/lootSystem.js
execution_mode: code_change
lane: planned
owned_files:
- js/lootSystem.js
- tests/lootSystem.test.js
- index.html
---

# WP01 — Foundation & Affix Engine

## Objective

Create the `js/lootSystem.js` IIFE module with the affix pool, affix-rolling logic, and the AggregatedBonuses cache. This is the foundation that EVERY other WP in this feature builds on. After this WP, the file exists with stub exports for ALL public API methods that later WPs will fill in (so the module surface is stable from the start).

You will also write the first round of unit tests covering pure logic (affix rolling + bonus aggregation).

## Context

Read first:
- [../spec.md](../spec.md) — feature spec
- [../plan.md](../plan.md) — implementation plan
- [../data-model.md](../data-model.md) — full AFFIX_DEFS array (24 entries) and AggregatedBonuses shape
- [../contracts/lootSystem.api.md](../contracts/lootSystem.api.md) — public API surface + 15-item test contract

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- This is the FIRST WP — you implement directly on `main`. No feature branch.
- Subsequent WPs may stack on this one if they need feature-branch isolation, but this proof-of-concept project commits directly to main.

Implementation command:
```bash
spec-kitty implement WP01
```
(no `--base` flag because there are no dependencies)

## Files Owned

You are the EXCLUSIVE owner of:
- `js/lootSystem.js` (NEW — you create this file)
- `tests/lootSystem.test.js` (NEW — you create this file)
- `index.html` (you modify ONE script tag insertion)

Do not modify any other file in this WP.

## Subtasks

### T001 — Create `js/lootSystem.js` IIFE skeleton with stubbed public API

**Purpose:** Establish the module shape and namespace from day one. All later WPs add implementation to these stubs.

**Steps:**
1. Create `js/lootSystem.js` with the `(function () { ... })()` IIFE pattern (matches `js/abilitySystem.js`, `js/questSystem.js`).
2. Inside the IIFE, declare module-private state placeholders:
   ```js
   const AFFIX_DEFS = [/* T002 fills this */];
   const ITEM_BASES = [/* WP02 fills this */];
   const POTION_DEFS = [/* WP04 fills this */];
   const _bonusCache = { flat: {}, percent: {}, version: 0 };
   let _potionCooldownUntil = 0;
   let _shopState = null;
   ```
3. Define stub functions for the FULL public API (so later WPs only fill bodies):
   ```js
   function rollAffixes(iLevel, count, rng = Math.random) { /* T003 */ }
   function rollItem(baseKey, iLevel, forceTier) { throw new Error('rollItem: not implemented (WP02)'); }
   function composeName(item) { throw new Error('composeName: not implemented (WP02)'); }
   function recomputeBonuses() { /* T004 */ }
   function getBonus(statKey) { /* T004 */ }
   function grantGold(amount) { throw new Error('grantGold: not implemented (WP03)'); }
   function getGold() { throw new Error('getGold: not implemented (WP03)'); }
   function spendGold(amount) { throw new Error('spendGold: not implemented (WP03)'); }
   function consumePotion(slot) { throw new Error('consumePotion: not implemented (WP04)'); }
   function onPotionKey() { throw new Error('onPotionKey: not implemented (WP04)'); }
   function isPotionOnCooldown() { throw new Error('isPotionOnCooldown: not implemented (WP04)'); }
   function getOrCreateShopState() { throw new Error('getOrCreateShopState: not implemented (WP06)'); }
   function rerollItem(item, costGold) { throw new Error('rerollItem: not implemented (WP06)'); }
   function migrateSave(saveData) { throw new Error('migrateSave: not implemented (WP02)'); }
   ```
4. Export to `window.LootSystem`:
   ```js
   window.LootSystem = {
     AFFIX_DEFS, ITEM_BASES, POTION_DEFS,
     rollAffixes, rollItem, composeName,
     recomputeBonuses, getBonus,
     grantGold, getGold, spendGold,
     consumePotion, onPotionKey, isPotionOnCooldown,
     getOrCreateShopState, rerollItem,
     migrateSave
   };
   ```
5. The throw-on-stub pattern is intentional — if any caller hits an unimplemented method, the failure is loud and traceable. Later WPs replace each stub.

**Files:** `js/lootSystem.js` (~80 lines after this subtask)

**Validation:** Module loads without console errors. `window.LootSystem.rollAffixes` is a function. Calling `window.LootSystem.rollItem(...)` throws "not implemented (WP02)".

---

### T002 — Define and freeze the 24-entry AFFIX_DEFS

**Purpose:** Hardcode the entire affix pool from `data-model.md`. This is THE single source of truth for what affixes exist.

**Steps:**
1. Open `data-model.md` and find the `AFFIX_DEFS` section (24 entries).
2. Copy the entire JS array literal verbatim into `js/lootSystem.js`, replacing the placeholder `const AFFIX_DEFS = [];`.
3. Wrap the array in `Object.freeze` to prevent accidental mutation:
   ```js
   const AFFIX_DEFS = Object.freeze([
     // 6 base stat affixes
     Object.freeze({ id: 'sharp_dmg', displayName: 'Sharp', position: 'prefix', ... }),
     // ... all 24 entries, each individually frozen
   ]);
   ```
4. Each affix entry has these required fields: `id`, `displayName`, `position` (`'prefix' | 'suffix'`), `statKey`, `valueType` (`'flat' | 'percent'`), `range` (object `{min, max}`), `iLevelMin`, `weight`, `appliesTo` (array of item types), `tooltipText`.
5. Double-check that all 24 IDs are unique. Categories per data-model:
   - 6 base stats (damage, armor, hp, speed, crit, range)
   - 4 defensive (3 resistances + lifesteal)
   - 5 per-ability damage
   - 5 per-ability cooldown reduction
   - 2 global ability mods (dmg_all_abilities, cd_all_abilities)
   - 2 luxury (xp_gain, gold_find)

**Files:** `js/lootSystem.js` (grows to ~250 lines)

**Validation:** `console.log(window.LootSystem.AFFIX_DEFS.length)` → 24. Attempting `LootSystem.AFFIX_DEFS.push(...)` throws (because frozen). Each entry has all required fields.

---

### T003 — Implement rollAffixes(iLevel, count, rng?)

**Purpose:** The affix-rolling engine. Filters the pool by iLevel and item type, picks `count` distinct affixes via weighted random selection, returns AffixInstance objects with rolled values.

**Steps:**
1. Function signature: `function rollAffixes(iLevel, count, rng = Math.random, itemType = null)`.
2. Filter the pool:
   ```js
   const eligible = AFFIX_DEFS.filter((def) => {
     if (def.iLevelMin > iLevel) return false;
     if (itemType && def.appliesTo && !def.appliesTo.includes(itemType)) return false;
     return true;
   });
   ```
3. Iteratively pick without replacement:
   ```js
   const result = [];
   const used = new Set();
   const target = Math.min(count, eligible.length);
   while (result.length < target) {
     // weighted pick from `eligible` excluding `used`
     const remaining = eligible.filter((d) => !used.has(d.id));
     if (remaining.length === 0) break;
     const totalWeight = remaining.reduce((s, d) => s + d.weight, 0);
     let roll = rng() * totalWeight;
     let pickedDef = remaining[0];
     for (const def of remaining) {
       roll -= def.weight;
       if (roll <= 0) { pickedDef = def; break; }
     }
     used.add(pickedDef.id);
     // roll the value
     const range = pickedDef.range;
     const value = Math.round(range.min + rng() * (range.max - range.min));
     result.push({ defId: pickedDef.id, value });
   }
   return result;
   ```
4. The function MUST be deterministic given the same `rng` — if you pass a seeded Mulberry32, two calls produce identical results. This is the test contract.

**Files:** `js/lootSystem.js` (~30 lines added)

**Validation:** With seeded RNG, two identical calls return identical output. `rollAffixes(1, 5)` excludes any affix with `iLevelMin > 1`. No duplicate `defId` in the result.

---

### T004 — Implement AggregatedBonuses cache (recomputeBonuses + getBonus)

**Purpose:** The hot-path bonus lookup. Combat code calls `getBonus(statKey)` on EVERY ability fire — must be O(1). The cache is recomputed only when the equipped item set changes.

**Steps:**
1. Module-private state (already declared in T001):
   ```js
   const _bonusCache = { flat: {}, percent: {}, version: 0 };
   ```
2. Implement `recomputeBonuses()`:
   ```js
   function recomputeBonuses() {
     // wipe
     _bonusCache.flat = {};
     _bonusCache.percent = {};
     // iterate equipment
     const eq = window.equipment || {};
     for (const slot of Object.keys(eq)) {
       const item = eq[slot];
       if (!item || !item.affixes) continue;
       for (const inst of item.affixes) {
         const def = AFFIX_DEFS.find((d) => d.id === inst.defId);
         if (!def) continue;
         const bucket = def.valueType === 'percent' ? _bonusCache.percent : _bonusCache.flat;
         bucket[def.statKey] = (bucket[def.statKey] || 0) + (def.valueType === 'percent' ? inst.value / 100 : inst.value);
       }
     }
     _bonusCache.version++;
     // notify HUD if it exists
     if (typeof window._refreshAbilityHUD === 'function') {
       try { window._refreshAbilityHUD(); } catch (e) { /* swallow */ }
     }
     return _bonusCache;
   }
   ```
3. Implement `getBonus(statKey)`:
   ```js
   function getBonus(statKey) {
     // check both buckets
     if (statKey in _bonusCache.flat) return _bonusCache.flat[statKey];
     if (statKey in _bonusCache.percent) return _bonusCache.percent[statKey];
     return 0;
   }
   ```
4. Note: cd reductions are stored as POSITIVE percent values (e.g. `cd_chargeSlash: 0.12` means -12% cooldown). The combat code in WP07 will read this and apply it as `baseCooldown * (1 - getBonus('cd_chargeSlash'))`.

**Files:** `js/lootSystem.js` (~50 lines added)

**Validation:** Mock `window.equipment` with two items, each having affixes; call `recomputeBonuses()`; assert `getBonus('damage')` returns the correct sum. Calling `getBonus('unknown')` returns 0.

---

### T005 — Wire `<script>` tag in index.html

**Purpose:** Make the new module loadable by the game.

**Steps:**
1. Open `index.html`.
2. Find the existing `<script src="js/inventory.js"></script>` line.
3. Insert AFTER it (and BEFORE `js/abilitySystem.js`):
   ```html
   <script src="js/lootSystem.js"></script>
   ```
4. Reload the game in a browser. Open DevTools console. Type `window.LootSystem` — should see the namespace object with all methods.

**Files:** `index.html` (1 line added)

**Validation:** Browser console: `typeof window.LootSystem` → `'object'`. `window.LootSystem.AFFIX_DEFS.length` → `24`. No load errors.

---

### T006 — tests/lootSystem.test.js Phase 1 — rollAffixes tests

**Purpose:** Verify `rollAffixes` correctness with deterministic seeded RNG. The pure-logic test gate from the constitution applies here.

**Steps:**
1. Create `tests/lootSystem.test.js` using the existing `tests/setup.js` + `tests/loadGameModule.js` helpers (same pattern as `tests/abilitySystem.test.js`).
2. At the top of the file, define a deterministic Mulberry32 RNG:
   ```js
   function makeRng(seed) {
     let s = seed;
     return function () {
       s = (s + 0x6D2B79F5) | 0;
       let t = Math.imul(s ^ (s >>> 15), 1 | s);
       t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
   }
   ```
3. Load the game module:
   ```js
   const { test, beforeEach } = require('node:test');
   const assert = require('node:assert');
   const { resetStore } = require('./setup');
   const { loadGameModule } = require('./loadGameModule');

   function freshSystem() {
     resetStore();
     delete globalThis.window.LootSystem;
     loadGameModule('js/lootSystem.js');
     return globalThis.window.LootSystem;
   }
   ```
4. Write test cases (8+ tests):
   - `rollAffixes(1, 1, makeRng(42))` returns the same array on two calls (deterministic)
   - `rollAffixes(1, 1, makeRng(42))` and `rollAffixes(1, 1, makeRng(43))` return DIFFERENT arrays
   - `rollAffixes(1, 5, makeRng(0))` excludes any affix with `iLevelMin > 1`
   - `rollAffixes(20, 5, makeRng(0))` MAY include any affix
   - `rollAffixes(1, 100, makeRng(0))` returns at most `eligible.length` items (no errors)
   - `rollAffixes(5, 3, makeRng(0))` returns no duplicate `defId`
   - `rollAffixes(5, 3, makeRng(0))` returns objects with `defId` and `value` fields
   - `rollAffixes(5, 0, ...)` returns `[]`

**Files:** `tests/lootSystem.test.js` (~120 lines after this subtask)

**Validation:** `node tools/runTests.js` runs the new test file and all 8+ tests pass.

---

### T007 — tests/lootSystem.test.js Phase 2 — recomputeBonuses + getBonus tests

**Purpose:** Verify the cache aggregates correctly across multiple equipped items.

**Steps:**
1. Add to the existing `tests/lootSystem.test.js`:
2. Mock `window.equipment` with fixture items:
   ```js
   function makeMockItem(affixes) {
     return { affixes };
   }

   beforeEach(() => {
     globalThis.window.equipment = {};
   });
   ```
3. Test cases (6+ tests):
   - Empty equipment → `getBonus('damage')` returns 0
   - One item with `damage` percent affix → `getBonus('damage')` returns the rolled fraction (e.g. 0.22)
   - Two items each contributing `damage` percent → `getBonus('damage')` returns the SUM
   - Two items contributing different stats → `getBonus('damage')` and `getBonus('hp')` return their respective values
   - `recomputeBonuses()` increments `version` (read via `_bonusCache.version` or expose a getter)
   - Affix with unknown `statKey` (impossible if data-model is correct, but defensive)
   - `getBonus('cd_spinAttack')` returns positive value when an item has `cd_spinAttack` affix (combat code converts to negative reduction)
4. Each test calls `recomputeBonuses()` after mocking `window.equipment` so the cache reflects the new state.

**Files:** `tests/lootSystem.test.js` (~80 lines added)

**Validation:** `node tools/runTests.js` runs all tests and they pass. No regressions in existing 24 unit tests (run them all).

---

## Definition of Done

- [ ] `js/lootSystem.js` exists and exports `window.LootSystem` with all stub methods
- [ ] `AFFIX_DEFS` has exactly 24 frozen entries matching `data-model.md`
- [ ] `rollAffixes(iLevel, count, rng)` is deterministic with a seeded RNG
- [ ] `recomputeBonuses()` correctly aggregates affixes from `window.equipment`
- [ ] `getBonus(statKey)` is an O(1) cache lookup
- [ ] `index.html` loads `js/lootSystem.js` BEFORE `js/abilitySystem.js`
- [ ] `tests/lootSystem.test.js` has 14+ tests (8 for rollAffixes, 6 for bonuses) and ALL pass
- [ ] `node tools/runTests.js` returns 0 failures (existing 24 + new 14 = 38+ tests)
- [ ] `node tools/testGame.js --loadout` smoke test still passes with 0 console errors
- [ ] Browser console at game load: 0 errors, `window.LootSystem` is defined

## Risks

| Risk | Mitigation |
|---|---|
| Frozen AFFIX_DEFS may break later WPs that try to add entries | The 24 entries are FINAL per data-model. WP02-08 do NOT add new affixes. |
| Cache isn't actually O(1) if `getBonus` searches an array | Use object key access only (`bucket[statKey]`), not `find` |
| Tests may be flaky if Math.random leaks in | All test calls MUST pass an explicit `makeRng(seed)` |
| Test file overwrites the existing tests setup | Use the same pattern as `tests/abilitySystem.test.js` — import from setup, isolate state via `beforeEach` |

## Reviewer Guidance

When reviewing this WP, verify:
1. The file structure of `js/lootSystem.js` matches the IIFE-with-frozen-data pattern of `js/abilitySystem.js`.
2. The 24 AFFIX_DEFS entries match `data-model.md` exactly (same IDs, same statKeys, same iLevelMin, same weights). Diff the two if necessary.
3. `rollAffixes` is genuinely deterministic — test with seed 42 twice and assert equal results.
4. The cache is invalidated only on `recomputeBonuses` calls, not on every getBonus.
5. The script tag in `index.html` is in the right position (after inventory.js, before abilitySystem.js).
6. No regressions in existing tests (`tools/runTests.js` and `tools/testGame.js --loadout` both green).

## Activity Log

- 2026-04-09T14:56:47Z – claude – shell_pid=55372 – lane=doing – Started implementation via workflow command
