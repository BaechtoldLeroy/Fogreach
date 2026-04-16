---
work_package_id: WP03
title: Door z-order and final verification
dependencies: [WP01, WP02]
requirement_refs: [FR-005]
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
- js/doorSystem.js
---

# WP03 — Door z-order and final verification

## Objective

Fix any z-order/depth issues with door sprites so they render correctly relative to floors, walls, and the player, then verify all door requirements end-to-end.

## Context

Door sprites must appear above the floor tiles but interact correctly with the player's depth sorting -- a door in front of the player should render above the player, and a door behind should render below. Phaser depth sorting needs to be configured correctly for the door sprites.

## Subtasks

### T001 — Fix door sprite depth/z-order

**Purpose**: Doors render at the correct visual layer.

**Steps**:
1. Set door sprite depth above the floor layer but in the entity sorting range.
2. If the game uses y-sort for depth (common in top-down games), ensure door sprites participate in y-sorting so they layer correctly relative to the player.
3. If y-sorting is not used, set a fixed depth that places doors above floors and below the UI, with correct layering relative to player position.

**Files**: `js/doorSystem.js`.

**Validation**: Walk around doors from all directions -- the door never incorrectly overlaps or hides behind entities in a visually broken way.

### T002 — End-to-end verification of all door requirements

**Purpose**: Confirm all five functional requirements work together.

**Steps**:
1. Playtest: approach a door, interact to open/close (FR-001).
2. Verify closed doors block player and enemy movement (FR-002).
3. Verify closed doors block fog of war line of sight (FR-003).
4. Verify door state persists during room session (FR-004).
5. Verify no visual glitches or z-order issues (FR-005).
6. Test with multiple doors in a room and across different room layouts from `proceduralRooms.js`.

**Files**: No code changes expected; bug fixes as needed in `js/doorSystem.js`, `js/roomManager.js`.

**Validation**: All five functional requirements pass in manual playtesting across multiple room configurations.

## Definition of Done

- Door sprites render at correct depth relative to floor, walls, and player.
- All five functional requirements (FR-001 through FR-005) verified working together.
- No visual glitches with door rendering in any tested room layout.

## Risks

- Depth sorting approach depends on how the game handles entity layering -- may need to match the existing pattern used by other sprites (enemies, items).

## Reviewer guidance

- Compare door depth values to those used by player and enemy sprites.
- Ensure the verification subtask covers rooms with multiple doors and different orientations (horizontal/vertical doorways).

## Implementation command

```
spec-kitty implement WP03
```
