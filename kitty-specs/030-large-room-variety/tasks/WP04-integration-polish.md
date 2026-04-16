---
work_package_id: WP04
title: Integration testing and visual polish
dependencies: [WP01, WP02, WP03]
requirement_refs: [FR-001, FR-002, FR-003, FR-004, FR-005]
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
- js/proceduralRooms.js
- js/graphics.js
- js/roomTemplates.js
---

# WP04 — Integration testing and visual polish

## Objective

Verify all large room variety systems work together end-to-end, fix visual inconsistencies, tune prop density and loot balance, and ensure the feature meets the goal of making large rooms feel noticeably different from each other on repeat visits.

## Context

WP01-03 build the theme system, prop spawner, and interactive objects independently. This WP integrates them, handles edge cases, and polishes the visual output. This is the final WP before the feature is considered complete.

## Subtasks

### T001 — End-to-end integration verification

**Purpose**: Confirm all systems work together without conflicts.

**Steps**:
1. Play through multiple dungeon runs and verify: themes apply correctly, props spawn per theme, breakables work, hidden containers are discoverable.
2. Verify that rooms generated with the same seed produce consistent theme + prop layouts.
3. Test edge cases: very small large rooms (minimum size), rooms with many doors, rooms with stairs.
4. Verify props do not overlap with enemies spawned by the enemy spawn system.
5. Fix any integration bugs found.

**Files**: `js/proceduralRooms.js`, `js/roomTemplates.js`

**Validation**: 5+ consecutive dungeon runs show varied large rooms with no visual glitches or gameplay-blocking bugs.

### T002 — Visual polish and tuning

**Purpose**: Make the room variety feel polished and intentional.

**Steps**:
1. Tune theme tint intensities so they are noticeable but not garish.
2. Adjust prop density: rooms should feel decorated but not cluttered.
3. Ensure prop z-ordering is correct (player walks in front of low props, behind tall props like pillars).
4. Add subtle depth variation to props (slight scale or alpha differences) for visual interest.
5. Verify torch props emit a faint light circle if the lighting system supports it.

**Files**: `js/graphics.js`, `js/proceduralRooms.js`

**Validation**: Visual inspection confirms rooms look good across all 5 themes. Props have correct depth ordering.

### T003 — Mobile compatibility and performance verification

**Purpose**: Ensure the feature works well on mobile devices.

**Steps**:
1. Test on mobile emulation (Chrome DevTools) for touch interaction with breakables and containers.
2. Verify prop cap reduction on mobile keeps frame rate stable.
3. Confirm prop textures are crisp at mobile resolution.
4. Fix any mobile-specific layout issues (props overlapping mobile controls, etc.).

**Files**: `js/proceduralRooms.js`

**Validation**: Mobile emulation shows stable frame rate. All interactive objects respond to touch. No visual artifacts.

## Definition of Done

- All 5 themes render correctly with appropriate props.
- Large rooms feel noticeably different from each other across multiple runs (FR-005).
- No props block doors, stairs, or spawn points.
- Breakable objects and hidden containers function correctly in all themes.
- 60fps on desktop, playable on mobile.
- No regressions in existing dungeon generation, combat, or loot systems.

## Risks

| Risk | Mitigation |
|---|---|
| Integration reveals incompatibilities between WP01-03 | Budget time for debugging; each WP is designed with clean interfaces |
| Tuning is subjective | Focus on clear visual distinction between themes; avoid over-decorating |

## Implementation command

```
spec-kitty implement WP04
```
