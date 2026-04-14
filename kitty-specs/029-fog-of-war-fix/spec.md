# Bug: Fog of War doesn't work correctly

## Problem
Fog of war has several issues:
- Black bars visible at viewport edges with camera zoom 0.89
- Vision polygon offset math may be incorrect after fog RT resize
- "Explored" areas don't always persist correctly across room transitions
- Enemies may remain visible through walls in explored fog

## Goal
Fog of war should:
1. Cover the entire viewport at any camera zoom
2. Reveal only the player's line-of-sight area
3. Dim explored-but-not-visible areas (not hide them completely)
4. Hide enemies behind walls correctly

## Technical Context
- Logic in `js/roomManager.js`: `initFogOfWar`, `updateFogOfWar`, `computeVisionPolygon`
- Uses two RenderTextures: `exploredRT` (persistent) and `spotlightRT` (current vision)
- `fogUnseen` is a black graphics with inverted-alpha BitmapMask of `exploredRT`
- `enemyLayer` uses a geometry mask from vision polygon to hide out-of-sight enemies

## Functional Requirements
- **FR-001**: Fog covers full viewport regardless of camera zoom (no black bars)
- **FR-002**: Vision polygon correctly maps world coords to RT pixel coords
- **FR-003**: Explored areas remain dimly visible after leaving
- **FR-004**: Enemies hidden outside vision polygon
- **FR-005**: Fog system works in both small template rooms and large procedural rooms
