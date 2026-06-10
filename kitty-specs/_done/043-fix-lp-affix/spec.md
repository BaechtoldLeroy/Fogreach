# Feature: Fix LP Affix Not Applied to Player Max HP

**Feature slug**: `043-fix-lp-affix`
**Mission**: software-dev
**Created**: 2026-05-01
**Tracks**: GitHub Issue [#13](https://github.com/BaechtoldLeroy/Fogreach/issues/13)

## Summary

Bug fix: The HP affix (`of_health`, `+X HP`) on equipment is rolled and stored on items but is never applied to the player's max HP. Items with the LP affix show the bonus in tooltips but provide no actual stat increase. The fix wires `LootSystem.getBonus('hp')` into the max-HP recompute path in `inventory.js`, mirroring how lifesteal is already integrated.

## Motivation

The affix system was added in WP07 (per a comment at `js/inventory.js:913`). Lifesteal correctly reads its value via `LootSystem.getBonus('lifesteal')` in `js/player.js:653`. The HP affix was never given the equivalent integration — `inventory.js` only sums the legacy `item.hp` base field when computing `playerMaxHealth`, so any value in `_bonusCache.flat.hp` is invisible to the player. Players see a tooltip promising +HP but their health bar does not move.

This breaks player trust in itemization, makes Tier 1+ items with the HP affix feel weak, and undermines the affix system's perceived value. It is also the simplest class of fix available — a missing read of an already-aggregated bonus.

## User Scenarios & Testing

### Primary flow

**PF-1 — Equip an HP-affixed item, verify max HP increases**
Player has a Tier 1+ chest piece without HP affix equipped (e.g. Plate Armor, max HP shown as N). Player picks up an item with `of_health (+15 HP)` affix and equips it. Max HP immediately becomes N + 15. Current HP increases by the same delta (no clamp loss).

### Secondary flows

**SF-1 — Unequip removes the bonus**
With the +15 HP item equipped (max HP = N + 15), the player unequips it. Max HP returns to N. Current HP is clamped if it exceeded the new max.

**SF-2 — Multiple HP-affixed items stack**
Player equips two items, each with `of_health` affix worth +10 HP. Max HP increases by 20 in total.

**SF-3 — Reroll changes the value**
Player rerolls an item with HP affix at Mara. New rolled HP value is reflected in max HP without restart.

### Edge cases

- **EC-1**: Item with HP affix in inventory but not equipped → no effect on max HP.
- **EC-2**: Save loaded with HP-affixed item already equipped → max HP includes the bonus on game start.
- **EC-3**: Skill bonus + equipment HP base + HP affix combine without double-counting (the existing `_skillMaxHpBonus` path must remain intact).

## Requirements

### Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | The HP value from `LootSystem.getBonus('hp')` is added to `playerMaxHealth` whenever equipment stats are recomputed. | Proposed |
| FR-002 | The fix does not double-count: `item.hp` base values and affix HP bonuses each contribute exactly once. | Proposed |
| FR-003 | Skill-derived `playerMaxHealth` bonuses continue to work without change (no regression on skill tree). | Proposed |
| FR-004 | Current HP delta-adjustment logic remains correct: equipping/unequipping does not unexpectedly drain or pad current HP beyond the natural delta. | Proposed |

### Non-Functional Requirements

- No additional dependencies or globals.
- Fix touches only `js/inventory.js`. No changes to `lootSystem.js`, item data, or affix definitions.

### Constraints

- Must not break existing saves. HP-affixed items already equipped in a save should retroactively grant their bonus on load.

## Success Criteria

- Manual playtest: equip an item with `of_health` affix, verify max HP bar grows by the affix value.
- Unequipping returns max HP to baseline.
- No console errors.
- No regression in skill-tree HP bonuses or in non-HP affixes (damage, armor, lifesteal, etc.).

## Key Entities

- `js/inventory.js` — recompute path that builds `playerMaxHealth` from base + sum + skill bonus.
- `js/lootSystem.js` — owns `_bonusCache.flat.hp` and exposes `getBonus(statKey)`.
- `js/player.js` — reference implementation for `getBonus()` integration (lifesteal at line 653).

## Assumptions

- `LootSystem.recomputeBonuses()` is already called whenever equipment changes (verified — it is).
- The `hp` statKey is the only HP-related affix key. No percent-based HP affixes currently exist (verified against `AFFIX_DEFS` in `lootSystem.js`).

## Out of Scope

- Adding new HP-related affixes (e.g. `+X% HP` or `regen`).
- Refactoring the legacy `item.hp` field into the affix system.
- Changes to the tooltip / display logic — tooltips already show the correct affix value.

## Dependencies

None. Self-contained bug fix.

## Open Clarifications

None.
