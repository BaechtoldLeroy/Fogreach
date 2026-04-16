# Bug: Enemies Spawning in Inaccessible Areas (Proc-Rooms)

## Problem
In procedural rooms, enemies are sometimes spawned in areas the player cannot reach (behind walls, inside geometry, in unreachable pockets). This makes rooms impossible to clear and breaks gameplay.

## Goal
Enemy spawn positions in procedural rooms must always be in walkable, player-reachable areas.

## Functional Requirements
- **FR-001**: Spawn point validation checks walkability before placing an enemy
- **FR-002**: Spawn points must be reachable from the room's entry point (pathfinding check)
- **FR-003**: No enemies should spawn inside walls, obstacles, or isolated pockets
- **FR-004**: If a valid spawn point cannot be found, skip the spawn rather than placing in an invalid location
