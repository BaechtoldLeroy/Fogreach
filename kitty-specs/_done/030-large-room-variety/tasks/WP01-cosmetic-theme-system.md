---
work_package_id: WP01
title: Cosmetic theme system for large rooms
dependencies: []
requirement_refs: [FR-003, FR-005]
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
authoritative_surface: js/roomTemplates.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomTemplates.js
---

# WP01 — Cosmetic theme system for large rooms

## Objective

Extend the existing room theme system in `js/roomTemplates.js` to support cosmetic variations for large rooms. Each theme defines floor tint, wall tint, ambient lighting hints, and an associated prop set identifier. When a large room is generated, a theme is randomly selected so repeat visits feel visually distinct.

## Context

Currently `js/roomTemplates.js` provides floor/wall textures but all large rooms look the same. This WP adds a `LARGE_ROOM_THEMES` array with at least 5 theme definitions (overgrown, flooded, crumbling, blood-stained, ancient) that downstream WPs use to select props and tints.

## Subtasks

### T001 — Define LARGE_ROOM_THEMES data structure

**Purpose**: Create the canonical theme definitions that all other WPs reference.

**Steps**:
1. Add a `LARGE_ROOM_THEMES` array to `js/roomTemplates.js` with at least 5 entries.
2. Each entry: `{ id, displayName, floorTint, wallTint, propSetId, weight }`.
3. Themes: `overgrown` (green tint, vines/moss props), `flooded` (blue tint, puddle props), `crumbling` (brown/grey tint, rubble props), `bloodstained` (red tint, gore props), `ancient` (gold tint, ruin props).
4. Export via the existing module pattern so `proceduralRooms.js` can access it.

**Files**: `js/roomTemplates.js`

**Validation**: `window.RoomTemplates.LARGE_ROOM_THEMES.length >= 5`. Each entry has all required fields.

### T002 — Theme selection function

**Purpose**: Weighted random theme picker called during room generation.

**Steps**:
1. Add `selectLargeRoomTheme(rng)` that picks a theme using weighted random selection from `LARGE_ROOM_THEMES`.
2. Accept optional `rng` parameter (defaults to `Math.random`) for determinism.
3. Export the function.

**Files**: `js/roomTemplates.js`

**Validation**: Calling with a seeded RNG returns consistent results. All themes can be selected.

### T003 — Apply theme tints during room rendering

**Purpose**: Make the selected theme visually affect the room.

**Steps**:
1. In `js/proceduralRooms.js`, after a large room is generated, call `selectLargeRoomTheme()` and store the result on the room data.
2. Apply `floorTint` and `wallTint` to the procedurally generated textures for that room.
3. Store the selected theme on the room object so WP02 can read `room.theme.propSetId`.

**Files**: `js/proceduralRooms.js`, `js/roomTemplates.js`

**Validation**: Large rooms visually differ in color between visits. The theme object is accessible on the room data.

## Definition of Done

- `LARGE_ROOM_THEMES` has at least 5 themed entries with tints and prop set IDs.
- `selectLargeRoomTheme(rng)` performs weighted random selection.
- Large rooms display visually distinct floor/wall tints based on the selected theme.
- The selected theme is stored on the room object for downstream WPs.
- No regression in room generation or existing gameplay.

## Risks

| Risk | Mitigation |
|---|---|
| Tint application may clash with existing texture generation | Test each theme color against the base textures; keep tints subtle |
| Theme data shape may need revision when props are added | Use `propSetId` as a loose reference; WP02 owns the prop definitions |

## Implementation command

```
spec-kitty implement WP01
```
