---
work_package_id: WP02
title: Item System & Migration
dependencies: []
requirement_refs:
- FR-001
- FR-004
- FR-005
- FR-006
- FR-007
- FR-026
- FR-027
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 020-loot-economy-overhaul-WP01
base_commit: 55a4b21344127a1592d4acdeb7c7fa1d1ffc8f25
created_at: '2026-04-09T16:24:50.578522+00:00'
subtasks: [T008, T009, T010, T011, T012, T013]
shell_pid: "52760"
agent: "claude"
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/storage.js
execution_mode: code_change
lane: planned
owned_files:
- js/storage.js
---

# WP02 — Item System & Migration

## Objective

Add the item-rolling layer on top of the WP01 affix engine. Define `ITEM_BASES`, implement `rollItem()`, `composeName()`, and the strict `migrateSave()` function. Hook migration into the save load path so existing saves get cleaned up when they load.

This WP is the bridge between "we have an affix pool" (WP01) and "items in the world" (WP03+ onwards).

## Context

Read first:
- [../spec.md](../spec.md) — FR-001, FR-004 to FR-007, FR-026, FR-027
- [../data-model.md](../data-model.md) — Item shape, ITEM_BASES (13 entries), Migration table
- [../contracts/lootSystem.api.md](../contracts/lootSystem.api.md) — rollItem / composeName / migrateSave contracts
- WP01 prompt for the existing `js/lootSystem.js` structure and stub functions

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- This WP **stacks on WP01**. WP01 must be merged into `main` first.
- Implementation command: `spec-kitty implement WP02 --base WP01`
- Direct main commits per project convention.

## Files Owned

- `js/lootSystem.js` (you ADD function bodies for rollItem, composeName, migrateSave; you do NOT remove/rewrite WP01 content)
- `js/storage.js` (you ADD ONE call to LootSystem.migrateSave; nothing else)
- `tests/lootSystem.test.js` (you APPEND new tests)

⚠️ Do NOT touch any other file. Do NOT modify the AFFIX_DEFS / cache code from WP01.

## Subtasks

### T008 — Define and freeze ITEM_BASES (13 entries)

**Purpose:** The base item template list. Each entry is the "Common" version of an item before affixes are rolled.

**Steps:**
1. Open `js/lootSystem.js`. Find the placeholder `const ITEM_BASES = [];` from WP01.
2. Replace with the full array from `data-model.md` (13 entries: 4 weapons, 3 helms, 3 body armors, 3 boots).
3. Wrap in `Object.freeze` like AFFIX_DEFS.
4. Each entry has: `key`, `type`, `name`, `iconKey`, `baseStats`, `dropWeight` (sparse map of `iLevel → weight`).

**Files:** `js/lootSystem.js`

**Validation:** `LootSystem.ITEM_BASES.length === 13`. Each entry has `key`, `type`, `name`, `iconKey`, `baseStats`, `dropWeight`. All keys unique.

---

### T009 — Implement rollItem(baseKey, iLevel, forceTier?)

**Purpose:** The item-rolling engine. Picks a base, determines the tier, rolls the affixes, composes the name.

**Steps:**
1. Replace the WP01 stub `function rollItem(baseKey, iLevel, forceTier) { throw ... }` with the real implementation.
2. Pick the base item:
   ```js
   let base;
   if (baseKey) {
     base = ITEM_BASES.find((b) => b.key === baseKey);
     if (!base) throw new Error(`Unknown item base: ${baseKey}`);
   } else {
     base = _pickWeightedBase(iLevel, rng);  // see below
   }
   ```
3. `_pickWeightedBase(iLevel, rng)` is a private helper:
   ```js
   function _pickWeightedBase(iLevel, rng = Math.random) {
     // Linear-interpolate dropWeight at the requested iLevel
     const weighted = ITEM_BASES.map((b) => ({
       base: b,
       weight: _interpolateDropWeight(b.dropWeight, iLevel)
     })).filter((w) => w.weight > 0);
     if (weighted.length === 0) return ITEM_BASES[0]; // fallback
     const total = weighted.reduce((s, w) => s + w.weight, 0);
     let r = rng() * total;
     for (const w of weighted) {
       r -= w.weight;
       if (r <= 0) return w.base;
     }
     return weighted[weighted.length - 1].base;
   }

   function _interpolateDropWeight(dropWeightMap, iLevel) {
     // dropWeightMap is { 1: 100, 5: 80, 10: 50 } sparse
     const keys = Object.keys(dropWeightMap).map(Number).sort((a, b) => a - b);
     if (iLevel <= keys[0]) return dropWeightMap[keys[0]];
     if (iLevel >= keys[keys.length - 1]) return dropWeightMap[keys[keys.length - 1]];
     for (let i = 0; i < keys.length - 1; i++) {
       if (iLevel >= keys[i] && iLevel <= keys[i + 1]) {
         const t = (iLevel - keys[i]) / (keys[i + 1] - keys[i]);
         return dropWeightMap[keys[i]] * (1 - t) + dropWeightMap[keys[i + 1]] * t;
       }
     }
     return 0;
   }
   ```
4. Determine the tier with the 60/30/8/2 base distribution + iLevel modifier:
   ```js
   function _rollTier(iLevel, rng = Math.random) {
     // Each iLevel above 5 shifts the distribution slightly toward higher tiers.
     const shift = Math.max(0, (iLevel - 5)) * 0.01;
     const weights = [
       Math.max(0, 0.60 - shift * 1.5),  // Common
       Math.max(0, 0.30 - shift * 0.5),  // Magic
       Math.min(1, 0.08 + shift * 1.0),  // Rare
       Math.min(1, 0.02 + shift * 1.0),  // Legendary
     ];
     const total = weights.reduce((s, w) => s + w, 0);
     let r = rng() * total;
     for (let i = 0; i < weights.length; i++) {
       r -= weights[i];
       if (r <= 0) return i;
     }
     return 0;
   }
   ```
5. Compose the final item:
   ```js
   const tier = (forceTier !== undefined && forceTier !== null) ? forceTier : _rollTier(iLevel);
   const affixCount = tier;
   const affixes = rollAffixes(iLevel, affixCount, Math.random, base.type);
   const item = {
     key: base.key,
     type: base.type,
     _baseName: base.name,
     iconKey: base.iconKey,
     tier,
     iLevel,
     requiredLevel: Math.max(1, iLevel - 2),
     baseStats: JSON.parse(JSON.stringify(base.baseStats)),  // deep copy
     affixes,
     displayName: ''  // composed below
   };
   item.displayName = composeName(item);
   return item;
   ```

**Files:** `js/lootSystem.js` (~80 lines added)

**Validation:** `LootSystem.rollItem('WPN_EISENKLINGE', 5)` returns an Item object with the right shape. `forceTier=2` overrides the random tier. `baseStats` is a NEW object (not shared with the template).

---

### T010 — Implement composeName(item)

**Purpose:** Build the display name based on tier + affix prefixes/suffixes.

**Steps:**
1. Replace the WP01 stub `function composeName(item) { throw ... }` with the real implementation.
2. Naming rules:
   - **tier 0 (Common):** `item._baseName`
   - **tier 1 (Magic):** Prefix XOR Suffix — pick whichever of the rolled affixes has a `position` field, prefer prefix
   - **tier 2 (Rare):** Prefix + Suffix — pick the first prefix and the first suffix from `item.affixes`
   - **tier 3 (Legendary):** Up to 2 prefixes + 2 suffixes; if the resulting name exceeds 50 chars, fall back to single prefix + single suffix + ` [Legendary]` indicator
3. Look up each affix's `displayName` from `AFFIX_DEFS` by `defId`:
   ```js
   function composeName(item) {
     if (!item || !item._baseName) return item.name || 'Item';
     if (item.tier === 0 || !item.affixes || item.affixes.length === 0) {
       return item._baseName;
     }
     const defs = item.affixes.map((inst) => AFFIX_DEFS.find((d) => d.id === inst.defId)).filter(Boolean);
     const prefixes = defs.filter((d) => d.position === 'prefix');
     const suffixes = defs.filter((d) => d.position === 'suffix');
     let name = '';
     if (item.tier === 1) {
       // Magic: 1 affix only — pick prefix if available, else suffix
       if (prefixes.length > 0) {
         name = `${prefixes[0].displayName} ${item._baseName}`;
       } else if (suffixes.length > 0) {
         name = `${item._baseName} ${suffixes[0].displayName}`;
       } else {
         name = item._baseName;
       }
     } else if (item.tier === 2) {
       // Rare: 1 prefix + 1 suffix (or fallbacks)
       const p = prefixes[0]?.displayName || '';
       const s = suffixes[0]?.displayName || '';
       name = `${p} ${item._baseName} ${s}`.trim().replace(/\s+/g, ' ');
     } else if (item.tier === 3) {
       // Legendary: up to 2 prefixes + 2 suffixes
       const p1 = prefixes[0]?.displayName || '';
       const p2 = prefixes[1]?.displayName || '';
       const s1 = suffixes[0]?.displayName || '';
       const s2 = suffixes[1]?.displayName || '';
       name = `${p1} ${p2} ${item._baseName} ${s1} ${s2}`.trim().replace(/\s+/g, ' ');
       if (name.length > 50) {
         name = `${p1} ${item._baseName} ${s1} [Legendary]`.trim().replace(/\s+/g, ' ');
       }
     }
     return name;
   }
   ```

**Files:** `js/lootSystem.js` (~40 lines added)

**Validation:** `composeName({tier:0, _baseName:'Eisenklinge', affixes:[]})` → `'Eisenklinge'`. Magic with `[{defId:'sharp_dmg'}]` → `'Sharp Eisenklinge'`. Rare with prefix + suffix → both included. Legendary truncation works.

---

### T011 — Implement migrateSave(saveData)

**Purpose:** Strict, idempotent migration from the old item structure to the new one. Strip old fields, add new fields, preserve base stats.

**Steps:**
1. Replace the WP01 stub `function migrateSave(saveData) { throw ... }` with the real implementation.
2. Idempotency check:
   ```js
   function migrateSave(saveData) {
     if (!saveData) return saveData;
     if (saveData.saveVersion >= 2) return saveData;  // already migrated
     // ... migrate
     saveData.saveVersion = 2;
     return saveData;
   }
   ```
3. Migrate items in `inventory[]` and `equipment{}`:
   ```js
   const migrateItem = (item) => {
     if (!item) return item;
     // Already migrated?
     if (item.tier !== undefined && Array.isArray(item.affixes)) return item;
     // Strip old fields
     delete item.rarity;
     delete item.rarityValue;
     delete item.rarityLabel;
     delete item.enhanceLevel;
     // Add new fields with defaults
     item.tier = 0;
     item.affixes = [];
     item.iLevel = item.iLevel || 1;
     item.requiredLevel = item.requiredLevel || 1;
     // baseStats: keep existing damage/armor/etc fields as baseStats if missing
     if (!item.baseStats) {
       item.baseStats = {};
       for (const stat of ['damage', 'armor', 'hp', 'speed', 'crit', 'range']) {
         if (typeof item[stat] === 'number') item.baseStats[stat] = item[stat];
       }
     }
     // displayName falls back to _baseName or name
     item.displayName = item._baseName || item.name || 'Item';
     return item;
   };

   if (Array.isArray(saveData.inventory)) {
     saveData.inventory = saveData.inventory.map(migrateItem);
   }
   if (saveData.equipment && typeof saveData.equipment === 'object') {
     for (const slot of Object.keys(saveData.equipment)) {
       saveData.equipment[slot] = migrateItem(saveData.equipment[slot]);
     }
   }
   ```
4. The function MUST be idempotent — running it twice produces identical state.

**Files:** `js/lootSystem.js` (~50 lines added)

**Validation:** Migrate a fixture save with `inventory[0].rarity = 'common'`; assert the field is gone afterwards. Run migration twice; assert identical result.

---

### T012 — Hook migrateSave into js/storage.js

**Purpose:** Make the migration run automatically when any save loads.

**Steps:**
1. Open `js/storage.js`. Find `function applySaveToState(scene, s)`.
2. Insert at the very top of the function body:
   ```js
   function applySaveToState(scene, s) {
     // Run migration first — converts old item structures in-place before any state assignment
     if (window.LootSystem && typeof window.LootSystem.migrateSave === 'function') {
       try {
         s = window.LootSystem.migrateSave(s);
       } catch (err) {
         console.warn('[storage] migrateSave failed', err);
       }
     }
     // ... existing logic
   }
   ```
3. The hook is non-breaking: if `LootSystem` is not loaded yet (shouldn't happen at this point in the script order), the function just falls through.

**Files:** `js/storage.js` (~5 lines added at the top of one function)

**Validation:** Load a save in the game (FORTSETZEN button). The save loads without errors. Inspect the in-memory `window.inventory` items — they have `tier`, `affixes`, `iLevel` fields and NO `rarity` field.

---

### T013 — tests/lootSystem.test.js Phase 3 — item / migration tests

**Purpose:** Verify rollItem distribution, composeName, and migration correctness.

**Steps:**
1. Append to the existing `tests/lootSystem.test.js` from WP01.
2. Test cases (10+ tests):

   **rollItem tests:**
   - `rollItem('WPN_EISENKLINGE', 5)` returns an item with `key === 'WPN_EISENKLINGE'`
   - `rollItem('WPN_EISENKLINGE', 5)` returns an item with `tier` in `[0, 1, 2, 3]`
   - `rollItem('WPN_EISENKLINGE', 5, 2)` always returns `tier === 2` (forceTier override)
   - `rollItem('WPN_EISENKLINGE', 5, 2).affixes.length === 2`
   - `rollItem(null, 5)` returns an item with one of the 13 base keys (random pick)
   - `rollItem('WPN_EISENKLINGE', 5).baseStats !== ITEM_BASES.find(b=>b.key==='WPN_EISENKLINGE').baseStats` (deep copy isolation)

   **composeName tests:**
   - tier 0 → `_baseName`
   - tier 1 with prefix-only affix → `'Prefix BaseName'`
   - tier 1 with suffix-only affix → `'BaseName Suffix'`
   - tier 2 with both → `'Prefix BaseName Suffix'`
   - tier 3 with 4 affixes → either full name or `[Legendary]` fallback

   **migrateSave tests:**
   - Migrate a fixture save with `inventory: [{rarity:'common', rarityValue:1, name:'Test', _baseName:'Test', damage:5}]` → `inventory[0]` has no `rarity`, has `tier=0`, has `affixes=[]`, has `baseStats.damage=5`
   - Run `migrateSave` twice on the same save → identical result (idempotent)
   - `migrateSave(saveData)` sets `saveData.saveVersion = 2`
   - `migrateSave({saveVersion: 2, ...})` is a no-op (returns identical reference)
   - Migrate `equipment{weapon:{rarity:'rare'}}` → equipment.weapon.rarity is gone

**Files:** `tests/lootSystem.test.js` (~150 lines appended)

**Validation:** `node tools/runTests.js` runs all tests, all pass. Total tests now ~30+ (existing 24 + WP01's 14 + WP02's 10).

---

## Definition of Done

- [ ] `ITEM_BASES` has exactly 13 frozen entries matching `data-model.md`
- [ ] `rollItem` generates items with the correct shape, deep-copied baseStats, rolled affixes, composed displayName
- [ ] `composeName` produces correct names for all 4 tiers
- [ ] `migrateSave` strips old fields, adds new, idempotent, sets `saveVersion = 2`
- [ ] `js/storage.js applySaveToState` calls migrateSave before any state assignment
- [ ] `tests/lootSystem.test.js` has 10+ new tests, all passing
- [ ] All existing tests still pass (`node tools/runTests.js` 0 failures)
- [ ] Smoke test still passes (`node tools/testGame.js --loadout` 0 console errors)
- [ ] Loading an old save in the browser does NOT throw and successfully migrates items in-memory

## Risks

| Risk | Mitigation |
|---|---|
| Migration mutates a save shape that the rest of the game can't handle | Strict idempotency test + manual playtest with a real old save |
| Tier distribution biases too heavily toward Common | Monte Carlo test in T013 — roll 1000 items, assert ~60% are Common ±5% |
| `_baseName` missing on legacy items causes naming to fail | Fall back to `item.name` if `_baseName` is undefined |
| Deep-copy via `JSON.parse(JSON.stringify())` slow for many items | Acceptable; rollItem is called maybe 5-20× per dungeon |

## Reviewer Guidance

1. Verify the `ITEM_BASES` array matches `data-model.md` exactly.
2. Run the unit tests with `node tools/runTests.js` and confirm 0 failures.
3. Manually load an old save (one created before this feature) and inspect via DevTools console:
   ```js
   const items = JSON.parse(localStorage.demonfall_save_v1).inventory;
   items.forEach(i => i && console.log(i.tier, !!i.rarity, i.displayName));
   ```
   All migrated items show `tier=0`, `!!i.rarity` is false (no old field), `displayName` is set.
4. Confirm new game still seeds the inventory with a working item set (cheat weapon should still appear).

## Activity Log

- 2026-04-09T16:24:51Z – claude – shell_pid=52760 – lane=doing – Started implementation via workflow command
- 2026-04-09T16:30:12Z – claude – shell_pid=52760 – lane=for_review – Item system + migration complete; tests pass
