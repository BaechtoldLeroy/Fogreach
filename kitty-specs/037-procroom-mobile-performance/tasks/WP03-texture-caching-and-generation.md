---
work_package_id: WP03
title: Texture caching and generation optimization
dependencies: [WP01]
requirement_refs: [FR-002, FR-004, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002, T003]
lane: planned
owned_files:
- js/graphics.js
- js/proceduralRooms.js
---

# WP03 — Texture caching and generation optimization

## Objective

Optimize procedural texture generation so that textures are created once at room load time and cached, rather than regenerated or redrawn frequently. Reduce Canvas 2D operations that stall the main thread on mobile.

## Context

`js/graphics.js` generates procedural textures (floors, walls, decorations) using Canvas 2D API. Some of these may be regenerated more often than necessary. Large canvas operations block the main thread, causing frame drops during room transitions and gameplay.

## Subtasks

### T001 — Audit texture generation frequency

**Purpose**: Identify which textures are regenerated unnecessarily.

**Steps**:
1. Add console.count or timing instrumentation to every texture generation function in `js/graphics.js`.
2. Play through several procedural rooms and record how often each texture function is called.
3. Identify functions called more than once for the same visual output (redundant generation).

**Files**: `js/graphics.js`.

**Validation**: A log shows which texture functions are called, how often, and their execution time. Redundant calls are identified.

### T002 — Cache generated textures

**Purpose**: Generate each procedural texture once and reuse it.

**Steps**:
1. Implement a texture cache keyed by generation parameters (e.g., room type, tile variant, size).
2. Before generating a texture, check the cache. Return cached texture if parameters match.
3. Clear the cache on scene shutdown to avoid memory leaks.
4. On mobile, limit cache size and evict least-recently-used entries if memory pressure is detected.

**Files**: `js/graphics.js`, `js/proceduralRooms.js`.

**Validation**: Texture generation functions are called only once per unique parameter set per room. Room transitions are faster on mobile.

### T003 — Reduce texture resolution on mobile

**Purpose**: Smaller textures mean faster generation and less GPU memory.

**Steps**:
1. On mobile, generate procedural textures at 50-75% of desktop resolution.
2. Use Phaser's texture scaling to display them at full size (bilinear filtering handles the upscale).
3. Ensure the visual quality reduction is subtle and acceptable.

**Files**: `js/graphics.js`.

**Validation**: Texture generation time drops on mobile. Visual comparison shows acceptable quality. Desktop textures remain full resolution.

## Definition of Done

- Procedural textures are generated once per unique parameter set and cached.
- Redundant texture generation calls are eliminated.
- Mobile textures are generated at reduced resolution with acceptable quality.
- No memory leaks from texture caching (cache is cleared on scene shutdown).
- Desktop visual quality is unchanged.

## Risks

- Aggressive caching could increase memory usage on devices that are already memory-constrained. Monitor memory with the performance tools.
- Reduced-resolution textures may look noticeably blurry on high-DPI mobile screens. Test on both 1x and 2x displays.

## Reviewer guidance

- Verify cache hit rate is high (most textures generated only once per room).
- Check memory usage before and after room transitions to confirm cache cleanup.
- Compare mobile screenshot at reduced resolution to desktop to assess visual quality.
