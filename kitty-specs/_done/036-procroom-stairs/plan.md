# Implementation Plan: Procroom Stairs

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/036-procroom-stairs/spec.md`

## Summary

Add more stairs/vertical connections in procedural rooms. Currently stairs unlock after wave clear (`js/wave.js`) and connect rooms linearly. Goal: more stair placement for multi-level dungeon feel.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0
**Testing**: Manual playtesting
**Target Platform**: Desktop + Mobile browsers

## Approach

1. **Multiple stair placement** — Modify `js/proceduralRooms.js` BSP generator to place stairs in larger chambers (not just at room exit). Stairs placed at edges of walkable areas, against walls.

2. **Stair types** — Up stairs (to next room/level) and down stairs (optional deeper sub-level). Use existing `stairsGroup` (static physics group from `js/main.js`).

3. **Procedural texture** — Generate stair sprites via Canvas 2D in `js/graphics.js`, matching room theme textures.

4. **Placement rules** — Stairs need 2-tile clearance from walls, doors, and other stairs. Must be in walkable, reachable area (leverages 035 spawn fix logic).

5. **Frequency** — Configurable: 1-2 additional stair connections per large room, scaling with dungeon depth.

## Key Files

- `js/proceduralRooms.js` — Stair placement logic during BSP generation
- `js/graphics.js` — Stair texture generation
- `js/wave.js` — Stair unlock logic after wave clear
- `js/roomManager.js` — Room transitions via stairs

## Dependencies

- 035-procroom-enemy-spawn-fix (shares walkability/reachability checks)
