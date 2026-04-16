# Tasks: Procroom Enemy Spawn Fix

**Feature**: 035-procroom-enemy-spawn-fix
**Date**: 2026-04-16
**Branch**: `main` -> `main`

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|-----|----------|
| T001 | Harden `isSpawnPositionBlocked` to check walkable tiles, not just obstacle overlap | WP01 | |
| T002 | Ensure `recomputeAccessibleArea` flood-fill uses room entry/doorway as seed point | WP01 | |
| T003 | Filter `spawnCandidates` pool to exclude cells adjacent to walls | WP01 | |
| T004 | Add graceful skip when no valid spawn point is found after N attempts | WP02 | |
| T005 | Wire skip logic into `pickAccessibleSpawnPosition` callers in `enemy.js` | WP02 | |
| T006 | Add optional debug overlay to visualize accessible-area grid and spawn candidates | WP02 | [P] |

## Work Packages

### WP01: Harden Walkability and Reachability Validation

**Priority**: High (foundational -- fixes the root cause)
**Dependencies**: None
**Estimated prompt size**: ~400 lines
**Prompt file**: [WP01-harden-spawn-validation.md](tasks/WP01-harden-spawn-validation.md)

**Goal**: Fix the core spawn validation pipeline so that `recomputeAccessibleArea` only marks cells as reachable if they are truly walkable floor tiles connected to the room entry point, and `isSpawnPositionBlocked` properly rejects positions on or adjacent to wall tiles.

**Included subtasks**:
- [ ] T001: Harden `isSpawnPositionBlocked` to check walkable tiles, not just obstacle overlap
- [ ] T002: Ensure `recomputeAccessibleArea` flood-fill uses room entry/doorway as seed point
- [ ] T003: Filter `spawnCandidates` pool to exclude cells adjacent to walls

**Implementation sketch**:
1. Audit `isSpawnPositionBlocked` -- currently only checks overlap with the `obstacles` group; add a check against the procedural room's wall grid so narrow gaps between walls are rejected
2. In `recomputeAccessibleArea`, verify the flood-fill seed comes from the room's entry doorway (not an arbitrary player position that might be inside geometry)
3. Add a wall-adjacency buffer when building `spawnCandidates` so enemies don't spawn in 1-tile gaps next to walls

**Parallel opportunities**: T001 and T003 touch different sections of `roomManager.js` and can be developed in parallel after T002 establishes the correct seed point.

**Risks**: Tightening the spawn filter may reduce the candidate pool in small rooms -- ensure fallback logic (WP02) handles empty pools gracefully.

---

### WP02: Fallback Skip Logic and Debug Overlay

**Priority**: High
**Dependencies**: WP01 (validation must be correct before skip logic is meaningful)
**Estimated prompt size**: ~350 lines
**Prompt file**: [WP02-fallback-skip-debug.md](tasks/WP02-fallback-skip-debug.md)

**Goal**: Ensure that when no valid spawn position can be found, the enemy spawn is gracefully skipped rather than placing the enemy in an invalid location. Add an optional debug overlay for future diagnosis.

**Included subtasks**:
- [ ] T004: Add graceful skip when no valid spawn point is found after N attempts
- [ ] T005: Wire skip logic into `pickAccessibleSpawnPosition` callers in `enemy.js`
- [ ] T006: Add optional debug overlay to visualize accessible-area grid and spawn candidates

**Implementation sketch**:
1. In `pickAccessibleSpawnPosition`, return `null` cleanly when all attempts exhausted (already partially done -- verify no fallback places enemy at 0,0 or random position)
2. Audit every call site in `enemy.js` that calls `pickAccessibleSpawnPosition` or `pickAccessibleSpawnPoint` -- ensure `null` result causes the spawn to be skipped, enemy count adjusted
3. Add a debug rendering function that draws the accessible-area grid cells and highlights spawn candidates, toggled via a debug flag

**Parallel opportunities**: T006 is independent and can be done in parallel with T004/T005.

**Risks**: Skipping spawns may reduce enemy count below intended difficulty -- log a warning so designers can detect rooms with excessive skips.
