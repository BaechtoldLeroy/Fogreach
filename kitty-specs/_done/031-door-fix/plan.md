# Implementation Plan: Door Fix

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/031-door-fix/spec.md`

## Summary

Fix broken doors from spec 027. The door system in `js/doorSystem.js` generates procedural door textures and places them at doorway positions, but they are not functioning correctly (open/close, collision, fog interaction).

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0
**Testing**: Manual playtesting
**Target Platform**: Desktop + Mobile browsers

## Approach

1. **Debug door interactions** — Trace `doorSystem.js` logic: proximity detection, open/close state transitions, physics body toggling. Fix the open/close trigger so doors respond to player approach.

2. **Collision** — When closed, door's static physics body must block player and enemy movement. When open, body disabled. Verify arcade physics overlap/collider setup.

3. **Fog of war integration** — Closed doors should block line-of-sight in `roomManager.js` vision polygon computation (`computeVisionPolygon`). Add door segments to the wall geometry used for raycasting.

4. **Z-order** — Door sprites must render at correct depth (above floor, below player when behind, above player when in front).

## Key Files

- `js/doorSystem.js` — Main fix target: open/close logic, physics bodies, texture states
- `js/roomManager.js` — Fog of war integration (vision polygon must respect doors)
- `js/proceduralRooms.js` — Doorway positions fed to door system

## Dependencies

- None (standalone bugfix, should be done early)
