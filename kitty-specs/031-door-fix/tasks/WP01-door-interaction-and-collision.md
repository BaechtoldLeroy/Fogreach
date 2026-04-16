---
work_package_id: WP01
title: Fix door open/close interaction and collision
dependencies: []
requirement_refs: [FR-001, FR-002, FR-004, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T12:00:00Z'
subtasks: [T001, T002, T003]
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

# WP01 — Fix door open/close interaction and collision

## Objective

Debug and fix the core door interaction logic in `doorSystem.js` so that doors reliably open and close when the player interacts with them, and closed doors properly block movement for both the player and enemies.

## Context

The door system was implemented in spec 027 but is not functioning correctly. The primary issues are in `doorSystem.js` which handles proximity detection, state transitions (open/close), procedural texture generation, and physics body management.

## Subtasks

### T001 — Debug and fix proximity detection and interaction trigger

**Purpose**: Ensure the player can trigger door open/close by approaching or interacting.

**Steps**:
1. Trace the proximity detection logic in `doorSystem.js` to identify why doors do not respond to player interaction.
2. Verify the overlap/collider setup between the player and door trigger zones.
3. Fix the interaction trigger so doors transition between open and closed states on player approach or key press.
4. Ensure the door texture/sprite updates to reflect the current state (open vs closed appearance).

**Files**: `js/doorSystem.js`.

**Validation**: Walking up to a closed door and interacting opens it; interacting again closes it. The door sprite visually changes between open and closed states.

### T002 — Fix collision physics for closed doors

**Purpose**: Closed doors must block player and enemy movement; open doors must allow passage.

**Steps**:
1. Verify the arcade physics static body on each door is created correctly.
2. When a door is closed, enable the physics body so it blocks movement.
3. When a door is open, disable the physics body so entities can pass through.
4. Ensure colliders are registered between the door bodies and both the player and enemy groups.

**Files**: `js/doorSystem.js`.

**Validation**: Player and enemies cannot walk through closed doors. After opening a door, both can pass through freely.

### T003 — Ensure door state persists within a room session

**Purpose**: Door state (open/closed) should not reset while the player remains in or re-enters the same room.

**Steps**:
1. Verify that door state is stored and not re-initialized on each frame or room re-entry.
2. Fix any state reset bugs so that a door stays in its last toggled state.

**Files**: `js/doorSystem.js`.

**Validation**: Open a door, walk away within the room, walk back -- the door remains open.

## Definition of Done

- Doors open and close reliably on player interaction.
- Closed doors block player and enemy movement via physics bodies.
- Open doors allow free passage.
- Door state persists while the room is active.
- No visual glitches with door sprite transitions.

## Risks

- Physics body dimensions may not align with the door sprite, causing invisible blocking or pass-through at edges.
- Procedural texture generation from spec 027 may have z-order issues addressed in WP03.

## Reviewer guidance

- Focus on the interaction trigger flow: is proximity detection working, is the state toggle firing, is the physics body toggling in sync.
- Check that colliders are added against both player and enemy groups.

## Implementation command

```
spec-kitty implement WP01
```
