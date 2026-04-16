---
work_package_id: WP01
title: Fog of war optimization for mobile
dependencies: []
requirement_refs: [FR-001, FR-002, FR-004]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002, T003]
lane: planned
owned_files:
- js/roomManager.js
- js/performanceMonitor.js
---

# WP01 — Fog of war optimization for mobile

## Objective

Reduce the GPU and CPU cost of the fog of war system in procedural rooms on mobile devices. The fog system (exploredRT, spotlightRT, vision polygon raycasting) is the primary suspected bottleneck. Target: fog updates should consume less than 4ms per frame on a mid-range mobile device.

## Context

`js/roomManager.js` manages two RenderTextures for fog of war: `exploredRT` and `spotlightRT`. Every frame, `computeVisionPolygon` performs raycasting to determine visible area, then redraws both RenderTextures. On mobile GPUs, RenderTexture operations are expensive, and per-frame raycasting with many rays compounds the problem.

## Subtasks

### T001 — Profile fog of war on mobile

**Purpose**: Establish baseline measurements and confirm fog is the primary bottleneck.

**Steps**:
1. Use `js/performanceMonitor.js` (P key) to measure per-frame time on mobile emulation.
2. Add timing markers around fog-related calls in `roomManager.js`: `computeVisionPolygon`, `exploredRT.draw()`, `spotlightRT.draw()`.
3. Record baseline frame times with fog enabled vs disabled to quantify fog cost.

**Files**: `js/roomManager.js`, `js/performanceMonitor.js`.

**Validation**: Console output shows per-subsystem timing. Fog cost is isolated and quantified.

### T002 — Reduce fog update frequency on mobile

**Purpose**: Skip fog redraws on intermediate frames to cut GPU cost.

**Steps**:
1. Detect mobile via existing `isMobile` flag or user-agent check.
2. On mobile, only recompute vision polygon and redraw fog RenderTextures every 2-3 frames instead of every frame. Cache the last result.
3. Ensure the cached fog still renders correctly on skipped frames (the existing RT stays on screen).
4. Make the skip interval configurable (default: 2 on mobile, 1 on desktop).

**Files**: `js/roomManager.js`.

**Validation**: On mobile emulation, fog updates occur every 2nd frame. Visual appearance is acceptable (minor lag in fog reveal is tolerable). Frame time drops measurably.

### T003 — Reduce vision polygon ray count on mobile

**Purpose**: Fewer raycasting rays means less CPU per fog update.

**Steps**:
1. In `computeVisionPolygon`, reduce the number of rays cast on mobile (e.g., halve the ray count or increase the angle step).
2. Use interpolation or polygon smoothing to avoid jagged edges from fewer rays.
3. Optionally reduce the RenderTexture resolution on mobile (e.g., half-resolution RT, scaled up).

**Files**: `js/roomManager.js`.

**Validation**: Vision polygon still looks reasonable with fewer rays. Frame time for `computeVisionPolygon` drops by 30%+ on mobile.

## Definition of Done

- Fog of war update frequency is reduced on mobile (every 2-3 frames).
- Vision polygon uses fewer rays on mobile with acceptable visual quality.
- Frame time improvement from fog optimization is measured and documented in the activity log.
- No visual regression on desktop (full-rate fog, full ray count).

## Risks

- Skipping fog frames may cause visible "popping" when the player moves fast. Mitigate by using a small viewport margin for the vision polygon.
- Fewer rays may cause light leaking through walls. Test with narrow corridors.

## Reviewer guidance

- Check that desktop path is unchanged (no skip, full rays).
- Verify the mobile detection method is consistent with the rest of the codebase.
- Frame time measurements should be included in the activity log before marking done.
