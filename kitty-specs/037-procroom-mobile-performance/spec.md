# Bug: Poor Mobile Performance in Procedural Rooms

## Problem
Procedural rooms run poorly on mobile devices. Frame rate drops significantly, making gameplay unplayable.

## Goal
Optimize procedural room rendering and logic to maintain acceptable performance on mobile.

## Functional Requirements
- **FR-001**: Profile and identify the main performance bottlenecks in proc-rooms on mobile
- **FR-002**: Optimize rendering (reduce draw calls, cull off-screen objects, simplify lighting/fog)
- **FR-003**: Optimize game logic (reduce per-frame calculations, optimize pathfinding)
- **FR-004**: Target a playable frame rate on mid-range mobile devices
- **FR-005**: Performance improvements should not visually degrade the desktop experience
