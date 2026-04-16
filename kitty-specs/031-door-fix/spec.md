# Bug: Doors Not Working

## Problem
Doors implemented in spec 027 are not functioning correctly. They need to be debugged and fixed.

## Goal
Doors in doorways should work reliably: open/close on interaction, block passage when closed, and integrate correctly with fog of war and pathfinding.

## Functional Requirements
- **FR-001**: Doors open and close correctly on player interaction
- **FR-002**: Closed doors block player and enemy movement
- **FR-003**: Closed doors block line of sight for fog of war
- **FR-004**: Door state persists while the room is active
- **FR-005**: No visual glitches or z-order issues with door sprites
