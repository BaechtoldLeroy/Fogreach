---
work_package_id: WP02
title: Fog of war respects closed doors
dependencies: [WP01]
requirement_refs: [FR-003]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T12:00:00Z'
subtasks: [T001, T002]
history:
- action: created
  agent: claude
  utc: '2026-04-16T12:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/roomManager.js
---

# WP02 — Fog of war respects closed doors

## Objective

Integrate door state into the fog of war system so that closed doors block line of sight in the vision polygon computation, and open doors allow vision through doorways.

## Context

`roomManager.js` computes a vision polygon via `computeVisionPolygon` using wall geometry for raycasting. Currently, doorways are open gaps in the wall geometry. When a door is closed, its position should contribute wall segments that block raycasts; when open, those segments should be removed so the player can see through.

## Subtasks

### T001 — Add closed-door segments to vision polygon wall geometry

**Purpose**: Closed doors should block line of sight for fog of war.

**Steps**:
1. In `roomManager.js`, locate the wall segment collection used by `computeVisionPolygon`.
2. Query the door system for all doors in the current room and their open/closed state.
3. For each closed door, add a wall segment at the door's position matching the doorway width.
4. For each open door, ensure no blocking segment exists at that position.

**Files**: `js/roomManager.js`, `js/doorSystem.js` (expose door state query API if not already present).

**Validation**: Stand near a closed door -- fog of war hides the area beyond it. Open the door -- the area beyond becomes visible.

### T002 — Update vision polygon when door state changes

**Purpose**: Fog of war should update immediately when a door opens or closes.

**Steps**:
1. When a door's state changes in `doorSystem.js`, trigger a recomputation of the vision polygon.
2. This can be a callback, event, or direct call to the fog of war update function.

**Files**: `js/roomManager.js`, `js/doorSystem.js`.

**Validation**: Toggle a door open/closed and observe the fog of war update in real-time without needing to move the player.

## Definition of Done

- Closed doors block line of sight in the fog of war vision polygon.
- Open doors allow vision through doorways.
- Vision polygon updates immediately when a door is toggled.

## Risks

- Performance: adding/removing wall segments on every door toggle could be expensive if `computeVisionPolygon` is heavy. Profile if needed and consider caching.
- Door positions from `proceduralRooms.js` must align with the wall segment coordinate system used for raycasting.

## Reviewer guidance

- Verify that door segments are in the same coordinate space as existing wall segments.
- Check that toggling a door does not leave stale segments or cause raycasting artifacts.

## Implementation command

```
spec-kitty implement WP02
```
