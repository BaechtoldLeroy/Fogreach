---
work_package_id: WP03
title: Stair interaction and room transitions
dependencies: [WP01, WP02]
requirement_refs: [FR-002, FR-004]
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
- js/roomManager.js
- js/wave.js
---

# WP03 — Stair interaction and room transitions

## Objective

Wire up player interaction with the new stairs so that stepping on an unlocked staircase triggers a room transition to the connected procedural room or dungeon level. Ensure the existing linear room-connection flow is preserved while the new multi-stair layout adds branching vertical paths.

## Context

Currently `js/roomManager.js` handles room transitions triggered by the single exit staircase. `js/wave.js` unlocks the exit after wave clear. With WP01 adding multiple stairs per room, the transition system needs to handle multiple stair targets: some stairs lead to the next room in sequence (same as today), while additional stairs connect to optional side-rooms or sub-levels. Each stair must map to a destination so the player can navigate a multi-level dungeon.

## Subtasks

### T001 — Build stair-destination mapping

**Purpose**: Associate each placed stair with a target room or level.

**Steps**:
1. In `js/proceduralRooms.js`, when placing extra stairs (WP01), assign a `destination` property: `{ type: 'room' | 'sublevel', roomId, levelOffset }`.
2. The main exit stair keeps its existing behavior (next room in linear sequence).
3. Extra up-stairs connect to optional bonus rooms (generated on demand). Extra down-stairs connect to sub-levels (deeper difficulty).
4. Store the mapping in a `stairConnections` map keyed by stair object id, accessible from `roomManager.js`.

**Files**: `js/proceduralRooms.js`, `js/roomManager.js`.

**Validation**: Each stair object has a valid `destination` property after room generation.

### T002 — Implement stair overlap detection and transition trigger

**Purpose**: Detect when the player steps on an unlocked stair and trigger the transition.

**Steps**:
1. In `js/roomManager.js`, add a physics overlap check between the player and `stairsGroup`.
2. On overlap with an unlocked stair, check cooldown (prevent rapid re-triggers), then call the transition handler.
3. For the main exit stair, delegate to the existing transition logic.
4. For extra stairs, generate or load the destination room based on the stair's `destination` property, then transition the scene.

**Files**: `js/roomManager.js`.

**Validation**: Walking onto an unlocked extra stair transitions the player to a new room. Walking onto a locked stair does nothing.

### T003 — Return stairs and backtracking

**Purpose**: Allow the player to return from bonus rooms and sub-levels.

**Steps**:
1. When generating a bonus room or sub-level, place a return stair at the spawn point that links back to the origin room and stair position.
2. On return transition, restore the origin room state (enemies cleared, loot collected) rather than regenerating.
3. Mark visited stairs visually (slight tint change) so the player knows which paths they have explored.

**Files**: `js/roomManager.js`, `js/proceduralRooms.js`.

**Validation**: Player can descend a sub-level stair, clear it, and return to the original room in the same state they left it.

## Definition of Done

- All stairs (main exit + extras) trigger appropriate room transitions when unlocked and stepped on.
- Extra stairs lead to bonus rooms or sub-levels that are generated on demand.
- Player can backtrack from bonus rooms/sub-levels to the origin room.
- Existing linear dungeon progression is unaffected.
- No duplicate transitions or softlocks from rapid stair overlap.

## Key Files

- `js/roomManager.js` — Primary: transition logic, overlap detection, room state preservation
- `js/proceduralRooms.js` — Stair-destination mapping, return stair placement
- `js/wave.js` — Reference: stair unlock timing

## Risks

- Room state preservation on backtracking could consume significant memory if many rooms are kept alive; may need to serialize/deserialize room state.
- Bonus room generation on demand could cause a visible hitch; consider a brief loading overlay or pre-generation during wave combat.
