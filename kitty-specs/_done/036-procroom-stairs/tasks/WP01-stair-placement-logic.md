---
work_package_id: WP01
title: Stair placement logic in BSP generator
dependencies: []
requirement_refs: [FR-001, FR-003, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002, T003]
history:
- action: created
  agent: claude
  utc: '2026-04-16T00:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/proceduralRooms.js
---

# WP01 — Stair placement logic in BSP generator

## Objective

Add stair-placement logic to the BSP room generator in `js/proceduralRooms.js` so that larger chambers can contain additional up/down stair tiles beyond the single exit staircase. Stairs must respect room geometry, maintain clearance from walls, doors, and other stairs, and scale in frequency with dungeon depth.

## Context

Currently `js/proceduralRooms.js` generates BSP-based rooms but only places a single exit stairway that unlocks after wave clear. The plan calls for 1-2 additional stair connections per large room, placed at walkable edges against walls with 2-tile clearance from walls, doors, and other stairs. The reachability/walkability checks from 035-procroom-enemy-spawn-fix should be reused.

## Subtasks

### T001 — Define stair placement parameters

**Purpose**: Make stair frequency and clearance configurable.

**Steps**:
1. Add a `STAIR_CONFIG` object to `proceduralRooms.js` with keys: `minRoomSizeForExtraStairs` (minimum room area in tiles), `maxExtraStairs` (default 2), `clearanceTiles` (default 2), `depthScaleFactor` (multiplier per dungeon level).
2. Expose as module-level constants so they can be tuned without code changes.

**Files**: `js/proceduralRooms.js`.

**Validation**: Config object is accessible and values are used by placement logic in T002.

### T002 — Implement stair candidate selection

**Purpose**: Find valid positions for additional stairs within a room.

**Steps**:
1. After BSP subdivision and room carving, iterate rooms whose tile area exceeds `minRoomSizeForExtraStairs`.
2. For each qualifying room, collect candidate tiles that are: walkable, adjacent to a wall on at least one side, and at least `clearanceTiles` away from doors, existing stairs, and room corners.
3. Reuse the walkability/reachability grid from 035 spawn-fix logic to confirm candidates are player-reachable.
4. Randomly select up to `maxExtraStairs` candidates (scaled by dungeon depth), spacing them apart by at least `clearanceTiles`.

**Files**: `js/proceduralRooms.js`.

**Validation**: On a fresh generation, large rooms contain 1-2 additional stair positions that are reachable and properly spaced.

### T003 — Instantiate stair objects at selected positions

**Purpose**: Create the actual stair game objects in the scene.

**Steps**:
1. For each selected stair position, add a sprite to the existing `stairsGroup` (static physics group from `js/main.js`).
2. Assign a `stairType` property: `'up'` or `'down'` based on dungeon depth and position within the room.
3. Newly placed stairs start locked (same as existing exit stairs) and unlock after wave clear via the existing mechanism in `js/wave.js`.

**Files**: `js/proceduralRooms.js`, `js/wave.js` (minor — ensure unlock iterates all stairs in group, not just one).

**Validation**: Extra stairs appear visually in generated rooms, are locked initially, and unlock after wave clear.

## Definition of Done

- Large procedural rooms contain 1-2 additional stairs beyond the exit stairway.
- Stairs have 2-tile clearance from walls, doors, and each other.
- All placed stairs are in walkable, reachable areas.
- Stair frequency scales with dungeon depth via config.
- Existing single-exit-stair behavior is preserved; no regression in room generation.

## Key Files

- `js/proceduralRooms.js` — Primary: stair placement during BSP generation
- `js/wave.js` — Minor: ensure stair unlock covers all stairs in group
- `js/main.js` — Reference: `stairsGroup` static physics group

## Risks

- Reachability checks from 035 may not be exported cleanly; may need a small refactor to share the utility.
- Over-placing stairs in small rooms would clutter navigation; the `minRoomSizeForExtraStairs` threshold must be tuned.
