# Implementation Plan: Fix LP Affix Not Applied to Player Max HP

**Branch**: `043-fix-lp-affix` | **Date**: 2026-05-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/043-fix-lp-affix/spec.md`

## Summary

Wire `LootSystem.getBonus('hp')` into the `playerMaxHealth` recompute in `js/inventory.js` so that the `of_health` affix actually contributes to the player's max HP. Mirror the existing pattern used for `lifesteal` in `js/player.js:653`.

## Technical Context

**Language/Version**: JavaScript ES6+ (browser, no transpile)
**Primary Dependencies**: Phaser 3
**Storage**: localStorage (saves include equipped items with affixes)
**Testing**: Manual playtesting — no automated test suite for stat application
**Target Platform**: Browser (Edge, Chrome, Firefox), desktop and mobile
**Project Type**: Single (static-served browser game)
**Performance Goals**: 60fps target; the recompute is event-driven (on equip change), not per-frame, so no perf concern
**Constraints**: No new dependencies. Existing save format must continue to work.

## Constitution Check

- **Clean code**: Single-purpose change, mirrors existing pattern.
- **Minimal tooling**: No new tools or libraries.
- **Modular scenes**: Change is scoped to `inventory.js` stat-recompute path.
- **No premature abstraction**: Direct fix, no helper extraction.

## Root Cause

`js/inventory.js:836-869` recomputes `playerMaxHealth` from three sources:
1. `baseStats.maxHP` (player base)
2. `sum.maxHP` — sum of `item.hp` across equipped items (legacy direct field)
3. `_skillMaxHpBonus` — derived from skill tree

The aggregated affix bonus held in `LootSystem._bonusCache.flat.hp` is never read. The `of_health` affix correctly populates this cache (verified at `lootSystem.js:386-418`), but no consumer pulls it into max HP.

By contrast, `lifesteal` is correctly read at `player.js:653`:
```js
lsPct += (window.LootSystem.getBonus('lifesteal') || 0) / 100;
```

## Approach

Read `LootSystem.getBonus('hp')` immediately before computing `newMaxHealth` and add it to the sum. Defensive null-check on `window.LootSystem` to match the lifesteal precedent.

### Code change (single hunk)

In `js/inventory.js` around line 869:

```js
// Before:
const newMaxHealth = Math.max(1, Math.round(
  (baseStats.maxHP || 0) + sum.maxHP + _skillMaxHpBonus
));

// After:
const _affixHpBonus =
  (window.LootSystem && typeof window.LootSystem.getBonus === 'function')
    ? (window.LootSystem.getBonus('hp') || 0)
    : 0;
const newMaxHealth = Math.max(1, Math.round(
  (baseStats.maxHP || 0) + sum.maxHP + _skillMaxHpBonus + _affixHpBonus
));
```

The existing delta-based current-HP adjustment (`setPlayerMaxHealth(newMaxHealth)`) handles the rest correctly: equip/unequip transitions adjust current HP by the same delta, with no shrink or pad on items whose max HP didn't change.

## Project Structure

### Documentation (this feature)
```
kitty-specs/043-fix-lp-affix/
├── spec.md          (written)
├── plan.md          (this file)
├── tasks.md         (next)
├── meta.json        (auto)
├── checklists/
├── research/
└── tasks/
```

### Source Code

Touched files:
- `js/inventory.js` — single change in the stat recompute path

Untouched (verified during research):
- `js/lootSystem.js` — already exposes `getBonus('hp')` correctly
- `js/player.js` — reference for the pattern
- `js/loot.js` — affix rolling unaffected
- Save/load format — `item.affixes` already persisted

## Complexity Tracking

Simplest possible fix shape: read an already-aggregated value at one site. No new state, no new files, no API surface change. Complexity score: **trivial**.

## Verification Strategy

1. **Pre-fix baseline**: equip a chest piece without HP affix. Note max HP (e.g. 30).
2. **Apply fix**.
3. **Equip an item with `of_health` affix** showing tooltip "+15 HP". Max HP should become 45.
4. **Unequip**. Max HP should return to 30.
5. **Reroll** the affix at Mara to a different HP value. Max HP should update without restart.
6. **Save/reload** with HP-affixed item equipped. Max HP includes the bonus on load.
7. **Regression**: damage, armor, lifesteal, speed, crit affixes all still work.
