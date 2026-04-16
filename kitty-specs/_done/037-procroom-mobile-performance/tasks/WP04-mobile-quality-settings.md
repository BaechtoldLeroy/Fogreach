---
work_package_id: WP04
title: Mobile quality settings toggle
dependencies: [WP01, WP02, WP03]
requirement_refs: [FR-002, FR-004, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002, T003]
lane: planned
owned_files:
- js/scenes/SettingsScene.js
- js/roomManager.js
- js/graphics.js
---

# WP04 — Mobile quality settings toggle

## Objective

Add a "Reduced Effects" quality toggle in the settings menu that allows mobile players to trade visual fidelity for performance. This toggle controls particle counts, decoration density, fog complexity, and texture quality. Auto-detect mobile and default to reduced effects.

## Context

`js/scenes/SettingsScene.js` already has a settings UI. WP01-WP03 add the underlying optimizations; this WP exposes them as user-controllable settings and wires up auto-detection so mobile players get good defaults out of the box.

## Subtasks

### T001 — Add quality setting to SettingsScene

**Purpose**: Give players explicit control over visual quality.

**Steps**:
1. Add a "Graphics Quality" toggle to `SettingsScene.js` with options: "High" (desktop default), "Medium", "Low" (mobile default).
2. Persist the setting via `localStorage` (key: `demonfall_graphics_quality`).
3. Expose the current quality level globally (e.g., `window.__GRAPHICS_QUALITY__` or a getter function) so other modules can read it.
4. Auto-detect mobile on first launch and default to "Low". Desktop defaults to "High".

**Files**: `js/scenes/SettingsScene.js`.

**Validation**: Setting appears in the settings menu. Changing it persists across page reloads. Mobile auto-detects to "Low".

### T002 — Wire quality setting to optimizations

**Purpose**: Connect the quality toggle to the optimizations from WP01-WP03.

**Steps**:
1. Fog of war (WP01): "Low" = update every 3 frames + reduced rays. "Medium" = every 2 frames. "High" = every frame.
2. Object culling (WP02): "Low" = aggressive culling margin (64px). "Medium" = 128px. "High" = no culling.
3. Textures (WP03): "Low" = 50% resolution. "Medium" = 75%. "High" = 100%.
4. Read quality level in each module and apply the corresponding parameters.

**Files**: `js/roomManager.js`, `js/enemy.js`, `js/graphics.js`.

**Validation**: Switching quality levels produces visible and measurable differences in frame rate and visual fidelity.

### T003 — Reduce particles and decorations on low quality

**Purpose**: Further reduce GPU load on low-end devices.

**Steps**:
1. On "Low" quality, reduce particle emitter quantities by 50-75% (fewer blood splats, fewer ambient particles).
2. On "Low" quality, skip spawning purely decorative room objects (cobwebs, cracks, stains) that have no gameplay function.
3. On "Medium", reduce particle count by 25% and keep all decorations.

**Files**: `js/proceduralRooms.js`, `js/graphics.js`.

**Validation**: "Low" quality rooms have visibly fewer particles and decorations. Frame rate improves accordingly. "High" quality is identical to pre-optimization desktop experience.

## Definition of Done

- Settings menu shows Graphics Quality with three levels.
- Mobile auto-detects to "Low", desktop to "High".
- All optimizations from WP01-WP03 are controlled by the quality setting.
- Particle and decoration counts scale with quality level.
- Desktop on "High" has zero visual regression from the pre-optimization state.
- Stable 30fps+ on mid-range mobile at "Low" quality.

## Risks

- Too many modules reading a global quality flag could become messy. Keep the quality API simple (one getter function).
- "Low" quality might look too stripped down. Get visual feedback from playtesting.

## Reviewer guidance

- Test all three quality levels on both desktop and mobile emulation.
- Verify that "High" on desktop matches the pre-optimization visual output exactly.
- Measure frame rate on mobile emulation at each quality level.
- Check that the setting persists correctly in localStorage.
