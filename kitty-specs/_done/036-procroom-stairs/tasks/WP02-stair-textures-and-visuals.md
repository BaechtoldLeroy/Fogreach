---
work_package_id: WP02
title: Stair texture generation and visual differentiation
dependencies: [WP01]
requirement_refs: [FR-004]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002]
history:
- action: created
  agent: claude
  utc: '2026-04-16T00:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/graphics.js
---

# WP02 — Stair texture generation and visual differentiation

## Objective

Generate procedural stair sprites via Canvas 2D in `js/graphics.js` that visually distinguish up-stairs from down-stairs and match the room's theme textures. Stairs must be clearly readable at a glance so players can identify vertical connections.

## Context

The plan specifies procedural texture generation in `js/graphics.js` matching room theme textures. Currently the game generates room tiles and decorations procedurally via Canvas 2D. Stair sprites need the same treatment: theme-colored, with clear directional indicators (arrow/chevron for up vs down). WP01 places the stair objects; this WP gives them their visual appearance.

## Subtasks

### T001 — Generate stair sprite textures

**Purpose**: Create Canvas 2D-rendered stair textures that match room themes.

**Steps**:
1. Add a `generateStairTexture(scene, direction, theme)` function to `js/graphics.js`.
2. Draw a tile-sized canvas with stepped lines (3-4 horizontal bars) to suggest a staircase.
3. Use the room theme's palette (pulled from existing theme color definitions) for the base color.
4. Add a directional indicator: upward-pointing chevron for `'up'`, downward-pointing chevron for `'down'`.
5. Register the generated texture with Phaser's texture manager under keys like `stair-up-<theme>` and `stair-down-<theme>`.

**Files**: `js/graphics.js`.

**Validation**: Calling `generateStairTexture(scene, 'up', 'stone')` produces a visible, theme-appropriate stair texture in the texture manager.

### T002 — Apply textures to stair objects from WP01

**Purpose**: Wire the generated textures into the stair placement flow.

**Steps**:
1. In `js/proceduralRooms.js`, after WP01 creates stair objects, call `generateStairTexture()` for the current room's theme if not already cached.
2. Set each stair sprite's texture to the appropriate `stair-up-<theme>` or `stair-down-<theme>` key.
3. Add a subtle glow or outline tint to locked stairs (matching the existing exit-stair locked appearance) and remove it on unlock.

**Files**: `js/proceduralRooms.js`, `js/graphics.js`.

**Validation**: In-game, stairs are visually distinct from floor tiles, up/down types are distinguishable, and locked stairs have a visual indicator that clears on unlock.

## Definition of Done

- Up and down stairs have distinct, theme-matched procedural textures.
- Textures are generated via Canvas 2D in `js/graphics.js`, not loaded from external assets.
- Locked/unlocked state is visually clear.
- Stair visuals are readable on both desktop and mobile at default zoom.

## Key Files

- `js/graphics.js` — Primary: stair texture generation
- `js/proceduralRooms.js` — Integration: applying textures to placed stairs

## Risks

- Theme palette extraction may vary if themes define colors inconsistently; fallback to a neutral grey if theme color is undefined.
