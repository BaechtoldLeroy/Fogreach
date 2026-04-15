# Bug: Fog of War + Camera Zoom incompatible

## Problem
Camera zoom (0.89 for D2-matching viewport) was removed because it breaks fog of war:
Phaser's `setScrollFactor(0)` elements ARE still affected by camera zoom, so fog RTs
(exploredRT, spotlightRT, fogUnseen) get scaled down, leaving uncovered viewport edges.

Attempts made (all failed):
- Oversize fogUnseen rectangle — only fogUnseen extended, the mask RT still small
- Oversize all RTs with matching offset — offset math didn't align with zoomed viewport
- setScale(1/zoom) on RTs — vision polygon draw math became incorrect
- Dual-camera (UI camera for fog) — complex, Phaser doesn't support "render only these objects"

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

## Goal (revised)
Get camera zoom back (0.89) while keeping fog fully functional. Likely needs a
proper UI camera with explicit render-ignore lists.

## Functional Requirements
- **FR-001**: Fog covers full viewport regardless of camera zoom (no black bars)
- **FR-002**: Vision polygon correctly maps world coords to RT pixel coords
- **FR-003**: Explored areas remain dimly visible after leaving
- **FR-004**: Enemies hidden outside vision polygon
- **FR-005**: Fog system works in both small template rooms and large procedural rooms
