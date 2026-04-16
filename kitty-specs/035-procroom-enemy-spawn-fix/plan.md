# Implementation Plan: Procroom Enemy Spawn Fix

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/035-procroom-enemy-spawn-fix/spec.md`

## Summary

Fix enemies spawning in inaccessible areas in procedural rooms. `js/enemy.js` uses `scene.pickAccessibleSpawnPoint()` but the accessibility check is apparently insufficient — enemies end up behind walls or in isolated pockets.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0 (arcade physics)
**Testing**: Manual playtesting, possibly visual debug overlay
**Target Platform**: Desktop + Mobile browsers

## Approach

1. **Diagnose** — Enable debug rendering to visualize spawn points vs walkable areas. Check if `pickAccessibleSpawnPoint()` correctly tests tile walkability and reachability.

2. **Walkability check** — Ensure spawn candidates are tested against the actual walkable tile map, not just "not inside a wall tile". A point between walls in a narrow gap may pass the wall check but be unreachable.

3. **Reachability check** — Add pathfinding validation: from room entry point to candidate spawn point. If no path exists, reject the candidate. Use the nav mesh or a flood-fill from the entry doorway.

4. **Fallback** — If no valid position found after N attempts, skip spawning that enemy rather than placing in an invalid spot.

## Key Files

- `js/enemy.js` — `pickAccessibleSpawnPoint()` — main fix target
- `js/proceduralRooms.js` — BSP room data, walkable tile info, doorway positions
- `js/roomManager.js` — Orchestrates spawning, provides room context

## Dependencies

- None (high-priority bugfix, should be done first)
