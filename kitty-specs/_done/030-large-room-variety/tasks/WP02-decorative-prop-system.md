---
work_package_id: WP02
title: Decorative prop spawner and textures
dependencies: [WP01]
requirement_refs: [FR-001, FR-004, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T12:00:00Z'
subtasks: [T001, T002, T003, T004]
history:
- action: created
  agent: claude
  utc: '2026-04-16T12:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/graphics.js
- js/proceduralRooms.js
---

# WP02 — Decorative prop spawner and textures

## Objective

Create a prop spawning system that places decorative objects (barrels, crates, pillars, torches, cobwebs, rubble, vines, puddles) in large rooms after BSP generation. Generate procedural textures for each prop type via Canvas 2D in `js/graphics.js`. Props are placed on walkable tiles with clearance checks to avoid blocking doors, stairs, and spawn points.

## Context

WP01 provides theme data with `propSetId`. This WP defines prop sets per theme and handles placement. Collidable props (barrels, crates, pillars) join the obstacle/collision group. Non-collidable props (cobwebs, rubble, puddles) go on a decoration layer beneath the player.

## Subtasks

### T001 — Prop texture generation in graphics.js

**Purpose**: Generate Canvas 2D textures for all decorative prop types.

**Steps**:
1. Add procedural texture generators for: barrel, crate, pillar, torch, cobweb, rubble, vine, puddle.
2. Each generator creates a small canvas texture (16x16 or 32x32) matching the game's art style.
3. Register textures in the Phaser texture manager during scene preload.

**Files**: `js/graphics.js`

**Validation**: All prop textures render without errors. Visual inspection confirms they fit the game's style.

### T002 — Define prop sets per theme

**Purpose**: Map each theme's `propSetId` to a list of eligible props with spawn weights.

**Steps**:
1. Create a `PROP_SETS` lookup object keyed by `propSetId`.
2. Each prop set lists props with `{ key, weight, collidable, maxPerRoom }`.
3. Example: `overgrown` favors vines and cobwebs; `crumbling` favors rubble and broken pillars; `flooded` favors puddles.
4. All themes share a base set (barrels, crates, torches) with theme-specific additions.

**Files**: `js/proceduralRooms.js`

**Validation**: Each `propSetId` from WP01 has a corresponding entry in `PROP_SETS`.

### T003 — Prop placement algorithm

**Purpose**: Place props on valid walkable tiles without blocking critical areas.

**Steps**:
1. After BSP room generation, identify walkable tiles in large rooms.
2. Build an exclusion set: tiles adjacent to doors, stairs, player spawn, and enemy spawn points (2-tile clearance).
3. Randomly select tiles from the remaining set for prop placement.
4. Number of props scales with room area (e.g., 1 prop per 20-30 walkable tiles, capped at `maxPerRoom`).
5. Collidable props are added to the physics obstacle group.
6. Non-collidable props are added to a decoration layer with depth below the player.

**Files**: `js/proceduralRooms.js`

**Validation**: Props appear in large rooms. No props block doorways or stairs. Collidable props stop player movement. Non-collidable props render behind the player.

### T004 — Performance guard

**Purpose**: Ensure prop count does not hurt frame rate.

**Steps**:
1. Cap total props per room at a reasonable limit (e.g., 15-20).
2. On mobile, reduce the cap by 30-50%.
3. Use static images (no per-frame animation) for decorative props.

**Files**: `js/proceduralRooms.js`

**Validation**: 60fps maintained on desktop with maximum props. Mobile remains playable.

## Definition of Done

- At least 8 prop types have procedural textures.
- Props spawn in large rooms respecting walkable area and clearance rules.
- Collidable props block movement; non-collidable props are purely visual.
- Prop selection varies by room theme from WP01.
- No doors, stairs, or spawn points are blocked.
- Performance stays at 60fps desktop, playable on mobile.

## Risks

| Risk | Mitigation |
|---|---|
| Too many props cause frame drops | Hard cap on prop count; reduce on mobile |
| Props placed on invalid tiles | 2-tile clearance from critical points; test with multiple seeds |
| Texture generation adds to load time | Generate textures once during preload, cache in texture manager |

## Implementation command

```
spec-kitty implement WP02
```
