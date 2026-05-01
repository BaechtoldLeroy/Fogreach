# Tasks: 043 — Fix LP Affix Not Applied to Player Max HP

**Feature**: `043-fix-lp-affix`
**Branch / Base / Merge Target**: `main` / `main` / `main`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Overview

Single Work Package, 3 subtasks. The fix is a one-hunk change in `js/inventory.js` that wires `LootSystem.getBonus('hp')` into the max-HP recompute. Manual playtest is the verification path — no automated tests for stat application exist in this codebase.

## Branch Strategy

- Planning / base: `main`
- Final merge target: `main`
- Single WP, no stacking.

## Work Packages

---

### WP01 — Wire HP Affix into playerMaxHealth Recompute

**Goal**: Add `LootSystem.getBonus('hp')` to the `newMaxHealth` calculation in `js/inventory.js` so that the `of_health` affix actually contributes to the player's max HP.

**Priority**: P0 (only WP; the entire feature).

**Independent test**: With the fix applied:
- Player base max HP is N (no equipment).
- Equip an item with `of_health` affix tooltip "+15 HP" → max HP becomes N + 15 in HUD and gameState.
- Unequip → max HP returns to N.
- No console errors during equip/unequip cycles.

**Subtasks**:

- [x] T001 — In `js/inventory.js`, in the stat-recompute path around line 869: read `LootSystem.getBonus('hp')` defensively (matching the pattern at `js/player.js:653`) and add it to `newMaxHealth`. Single hunk, ~3 lines added.
- [ ] T002 — Manual playtest per the verification strategy in `plan.md` (sections 1–7). Cover: equip, unequip, reroll, save/reload, regression on damage/armor/lifesteal/speed/crit affixes, skill-tree HP bonuses still apply.
- [ ] T003 — Verify the fix on a save with HP-affixed items already equipped: load → max HP correctly includes affix bonus on first frame. Confirms FR-004 edge case (no double-counting after load).

**Owned files**: `js/inventory.js`

**Estimated prompt size**: ~50 lines (the change itself is tiny; bulk is reading surrounding context)

**Dependencies**: none

**Requirements mapped**: FR-001, FR-002, FR-003, FR-004

---

## Definition of Done

- Fix committed to a feature branch off `main`.
- Manual playtest from plan.md §"Verification Strategy" passes all 7 steps.
- No regressions in existing affix application (damage, armor, lifesteal, etc.).
- GitHub Issue [#13](https://github.com/BaechtoldLeroy/Fogreach/issues/13) closed via merge commit (`Closes #13`).
