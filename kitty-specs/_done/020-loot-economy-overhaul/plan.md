# Implementation Plan: Loot & Economy Overhaul

**Feature:** 020-loot-economy-overhaul
**Branch:** `main` → `main` (no feature branch — proof-of-concept project, direct main commits)
**Spec:** [spec.md](./spec.md)
**Status:** planned
**Last Updated:** 2026-04-09

## Branch Contract

- Current branch: `main`
- Planning/base branch: `main`
- Final merge target: `main`
- `branch_matches_target`: true ✓

This proof-of-concept project does not use feature branches; planning artifacts and implementation commits all land directly on `main`.

## Summary

Replace the existing item rarity system with a single unified D2-light loot & economy foundation that ties together itemization (4 tiers, 20-30 affix pool with ability modifiers), gold currency, health potions, Mara as shop/reroll vendor, and Champion/Unique elite enemies into one coherent gameplay loop. Migration is strict: old `rarity`/`rarityValue`/`enhanceLevel` fields are stripped, items become Common.

Implementation lives in 3 new files (`js/lootSystem.js`, `js/eliteEnemies.js`, `js/scenes/ShopScene.js`) plus surgical patches to 9 existing files. Pure logic (affix rolling, pricing math, save migration) gets unit tests via the existing `node:test` setup.

## Technical Context

**Language/Version**: JavaScript ES6+
**Primary Dependencies**: Phaser 3 v3.70.0 (CDN), browser globals via IIFE pattern
**Storage**: `localStorage` via existing `js/persistence.js` central registry
**Testing**: `node:test` (built-in Node 18+), `tools/runTests.js` runner; Playwright smoke test in `tools/testGame.js`
**Target Platform**: Desktop browsers (Edge primary)
**Project Type**: single (browser game, no build tooling)
**Performance Goals**: 60 fps sustained, scene transitions < 1s, affix roll < 1ms p95, shop open < 250ms p95
**Constraints**: 0 console errors, must keep existing 24 unit + 14 smoke tests passing, save migration must be idempotent
**Scale/Scope**: ~700 LOC in lootSystem.js, ~350 in eliteEnemies.js, ~450 in ShopScene.js, ~300 LOC in unit tests, surgical patches to ~9 existing files

## Constitution Check

| Gate | Requirement | Status |
|---|---|---|
| Manual playtest passes | Player completes: dungeon → hub → shop → buy potion → reroll item → equip → dungeon → use F-potion → kill elite | Will verify after WP completion |
| 0 console errors | No `[error]` in browser console during full play loop | Will verify each WP via smoke test |
| 60 fps sustained | NFR-001/NFR-003 — affix roll < 1ms p95, 50 gold sprites stable 60fps | Will benchmark in unit tests + playtest |
| Existing tests pass | 24 unit + 14 smoke checks pass post-migration | Verified after each WP — migration is highest risk |
| Test-first for pure logic | Affix rolling, pricing math, save migration get unit tests | Plan adds `tests/lootSystem.test.js` + `tests/eliteEnemies.test.js` |

No violations identified. Plan proceeds.

## Architecture Overview

### Module dependency graph

```
js/persistence.js  ─┐
js/inventory.js    ─┤
                    ├──→  js/lootSystem.js (NEW)
js/abilitySystem.js ┘            │
                                  ├──→  js/eliteEnemies.js (NEW)
                                  │            │
                                  │            └──→  hooks js/enemy.js spawnEnemy
                                  │
                                  └──→  js/scenes/ShopScene.js (NEW)
                                              │
                                              └──→  launched from js/scenes/HubSceneV2.js
                                                    (Mara dialog "Schwarzmarkt" action)
```

### `js/lootSystem.js` public surface

```js
window.LootSystem = {
  // affix pool
  AFFIX_DEFS,                              // 20-30 entries
  rollAffixes(iLevel, count),              // → AffixInstance[]

  // item creation
  ITEM_BASES,                              // base item templates
  rollItem(baseKey, iLevel, forceTier),    // → Item
  composeName(item),                       // → string

  // aggregated bonuses cache
  recomputeBonuses(),                      // → AggregatedBonuses
  getBonus(statKey),                       // → number (O(1) cache lookup)

  // gold
  grantGold(amount),
  getGold(),
  spendGold(amount),                       // → boolean

  // potions
  POTION_DEFS,                             // 4 tiers
  consumePotion(slot),                     // direct slot use
  onPotionKey(),                           // F-key handler
  isPotionOnCooldown(),                    // → boolean

  // shop
  getOrCreateShopState(),                  // → ShopState (refreshed per run)
  rerollItem(item, costGold),              // → Item with new affixes

  // save migration
  migrateSave(saveData)                    // → migrated saveData
};
```

### `js/eliteEnemies.js` public surface

```js
window.EliteEnemies = {
  ENEMY_AFFIX_DEFS,                        // ~10 entries (Fanatic, Lightning, etc.)
  shouldSpawnElite(depth),                 // → 'champion' | 'unique' | null
  applyEliteToEnemy(enemy, depth),         // mutates enemy: HP, name, tint, aura
  modifyDropTable(enemy, baseDrops),       // → enriched drops
};
```

### `js/scenes/ShopScene.js` public surface

```js
class ShopScene extends Phaser.Scene {
  create(data) { /* tabs, items, reroll */ }
}

window.openShopScene = (parentScene) => {
  parentScene.scene.launch('ShopScene');
};
```

### Data flow on item drop (hot path)

```
Enemy killed
  ├─→ js/loot.js drop logic
  │     ├─→ EliteEnemies.modifyDropTable(enemy, baseDrops)
  │     ├─→ LootSystem.rollItem(baseKey, iLevel, eliteTier?)
  │     │     ├─→ pick base item from ITEM_BASES
  │     │     ├─→ determine tier (random with weights)
  │     │     ├─→ rollAffixes(iLevel, tier.affixCount)
  │     │     ├─→ composeName(item)
  │     │     └─→ return Item with embedded affixes
  │     └─→ push into world as loot sprite (existing path)
  ├─→ Player picks up → inventory.add(item)
  └─→ Player equips → equipment[slot] = item → LootSystem.recomputeBonuses()
```

### Data flow on ability fire (every shot must be O(1))

```
Player presses Q (slot1, e.g. spinAttack)
  ├─→ AbilitySystem.tryActivate('slot1', this)
  ├─→ Compute final damage:
  │     baseDamage * (1 + LootSystem.getBonus('dmg_spinAttack')
  │                    + LootSystem.getBonus('dmg_all_abilities'))
  └─→ Compute final cooldown:
        baseCooldown * (1 - LootSystem.getBonus('cd_spinAttack')
                            - LootSystem.getBonus('cd_all_abilities'))
```

`LootSystem.getBonus()` reads the precomputed `AggregatedBonuses` cache — single object lookup, no array iteration. Cache is invalidated and recomputed only when the equipped item set changes.

## Project Structure

### Documentation (this feature)

```
kitty-specs/020-loot-economy-overhaul/
├── plan.md                                # This file
├── spec.md                                # Already created
├── research.md                            # Phase 0 output (this command)
├── data-model.md                          # Phase 1 output (this command)
├── quickstart.md                          # Phase 1 output (this command)
├── contracts/
│   ├── lootSystem.api.md
│   ├── eliteEnemies.api.md
│   └── shopScene.api.md
├── checklists/
│   └── requirements.md                    # Already created (validated)
└── tasks/                                 # /spec-kitty.tasks output (NOT created here)
```

### Source code touched

**NEW files:**

```
js/
├── lootSystem.js                          # ~700 lines — affixes/items/gold/potions/cache/migration
├── eliteEnemies.js                        # ~350 lines — Champion/Unique spawn injection
└── scenes/
    └── ShopScene.js                       # ~450 lines — Mara modal shop with 3 tabs

assets/
└── sprites/
    └── gold_pile.png                      # OR procedurally generated in graphics.js

tests/
├── lootSystem.test.js                     # ~200 lines — affix rolling, pricing, naming, migration
└── eliteEnemies.test.js                   # ~100 lines — spawn rate scaling, affix application
```

**MODIFIED files:**

```
index.html                                 # Add 3 new <script> tags in dependency order
js/main.js                                 # Gold HUD counter; F-key handler; ability damage/CD lookups
js/inventory.js                            # Tooltip affix lines; tier-aware color
js/loot.js                                 # rollItem() integration; gold drops; elite drop bonuses
js/enemy.js                                # spawnEnemy() consults EliteEnemies
js/scenes/HubSceneV2.js                    # Mara dialog "Schwarzmarkt" action
js/scenes/CraftingScene.js                 # Tier-aware salvage; affix display
js/storage.js                              # Hook LootSystem.migrateSave() in load path
js/abilitySystem.js                        # Ability damage/CD helpers query getBonus()
```

**Files NOT touched (defensive list):**
- `js/loadoutOverlay.js`, `js/scenes/SettingsScene.js`, `js/roomTemplates.js`, `js/roomManager.js`, `js/questSystem.js`, `js/persistence.js` (gold lives in main save, not new key)
- All `assets/enemy/*` and `assets/sprites/*` except `gold_pile.png`
- `tools/testGame.js` only updated if a new flow needs verification

**Structure Decision:** Single-project layout matching the existing browser-game convention (browser globals via IIFE, no build tooling, scripts loaded in dependency order through `index.html`). Tests live alongside the existing `tests/` directory under the `node:test` runner.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Save migration corrupts existing player saves | Medium | High | Migration is idempotent + backup save before migrate; unit-tested with fixture saves |
| Affix-bonus aggregation slow on every ability fire | Low | High | Precompute cache, recompute only on equip change (NFR-001) |
| Shop UI conflict with existing K loadout / O settings overlays | Medium | Medium | All overlays use modal `scene.launch`; only one at a time, ESC closes |
| Elite enemy visual changes interfere with existing FX masks | Medium | Medium | Tint via `setTint()`, aura is separate Graphics layer at depth − 3 |
| Affix display names too long, break tooltip layout | Low | Low | Cap each affix line at ~30 chars, truncate base name if needed |
| F-key potion conflicts with another existing F-key handler | Low | Low | F was previously slot4 ability; since QWER refactor, slot4 is W. F is FREE. |
| Gold sprite count grows unbounded if player parks | Low | Low | Despawn timeout 5 minutes per pile (assumption 7 in spec) |

## Complexity Tracking

No constitution violations. Section intentionally empty.

## Branch Contract (re-stated)

- Current branch at plan completion: `main`
- Planning/base branch: `main`
- Final merge target for completed work: `main`
- `branch_matches_target`: true

All work packages will commit directly to `main` per project convention.

## Next Step

Run `/spec-kitty.tasks` to break this plan into work packages (WPs). Recommended grouping (the planner agent will finalize):

1. **WP01 — Foundation & Affix Engine**: AFFIX_DEFS, rollAffixes(), AggregatedBonuses cache, unit tests. Foundation for all other WPs.
2. **WP02 — Item System & Migration**: ITEM_BASES, rollItem(), composeName(), save migration. Depends on WP01.
3. **WP03 — Gold Currency**: drops, sprite, pickup, HUD counter. Independent.
4. **WP04 — Health Potions**: POTION_DEFS, F-key, HoT, cooldown, HUD.
5. **WP05 — Elite Enemies**: ENEMY_AFFIX_DEFS, spawn injection, visuals, loot bonuses. Depends on WP02.
6. **WP06 — Mara Shop UI**: ShopScene, 3 tabs, dialog integration. Depends on WP02 + WP03 + WP04.
7. **WP07 — Ability Modifier Integration**: combat code reads `LootSystem.getBonus()`, HUD shows bonus badges + faster radial. Depends on WP01.
8. **WP08 — Existing System Cleanup & Migration Verification**: remove old `rarity` references, full save round-trip test, end-to-end smoke. Depends on all prior.
