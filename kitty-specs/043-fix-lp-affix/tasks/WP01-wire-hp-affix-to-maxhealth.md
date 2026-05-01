---
work_package_id: WP01
title: Wire HP Affix into playerMaxHealth Recompute
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 2d056b050f452048faff1c2f23a1992a1ad31aa0
created_at: '2026-05-01T14:29:27.337686+00:00'
subtasks: [T001, T002, T003]
authoritative_surface: js/inventory.js
execution_mode: code_change
lane: planned
owned_files:
- js/inventory.js
shell_pid: "37668"
assignee: "claude"
---

# WP01 — Wire HP Affix into playerMaxHealth Recompute

## Objective

Add `LootSystem.getBonus('hp')` to the `newMaxHealth` calculation in `js/inventory.js` so that the `of_health` affix actually contributes to the player's max HP. The affix system already aggregates HP correctly into `_bonusCache.flat.hp` — only the consumer-side read is missing.

At the end of this WP:
- Items with the `of_health` affix grant their stated HP bonus to `playerMaxHealth`.
- Equipping/unequipping correctly raises or lowers max HP.
- No regression in damage, armor, lifesteal, speed, crit, or skill-tree HP bonuses.

## Context

`js/inventory.js:836-869` recomputes `playerMaxHealth` from base + `sum.maxHP` (legacy `item.hp` field) + `_skillMaxHpBonus`. It never reads `LootSystem.getBonus('hp')`. The reference pattern lives at `js/player.js:653` for `lifesteal`.

## Subtasks

- [ ] **T001** — Modify `js/inventory.js` around line 869: read `LootSystem.getBonus('hp')` defensively (mirror the lifesteal pattern), add to `newMaxHealth` calculation. ~3 lines added.
- [ ] **T002** — Manual playtest per `plan.md` §"Verification Strategy": equip → max HP rises, unequip → max HP falls, reroll → updates, save/reload → persists, regression on other affixes.
- [ ] **T003** — Verify on a save with HP-affixed item already equipped: load → max HP includes affix on first frame.

## Definition of Done

- All 3 subtasks complete.
- All 7 manual verification steps from `plan.md` pass.
- No console errors during the test run.
- GitHub Issue [#13](https://github.com/BaechtoldLeroy/Fogreach/issues/13) auto-closed via merge commit message.

## Activity Log

- 2026-05-01T15:34:00Z – unknown – shell_pid=37668 – lane=in_progress – Moved to in_progress
- 2026-05-01T15:34:02Z – unknown – shell_pid=37668 – lane=for_review – Moved to for_review
