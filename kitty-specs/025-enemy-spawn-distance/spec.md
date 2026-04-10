# Bug: Enemies can spawn on top of player in small rooms

## Problem
In small or maze-like rooms (e.g. MazeLite), enemies sometimes spawn directly on the player despite MIN_SPAWN_DISTANCE=300. The fallback logic exhausts all offset attempts but still spawns the enemy at a too-close position.

## Goal
Guarantee enemies never spawn within visible range of the player, or delay their spawn with a warning.

## Functional Requirements
- **FR-001**: If no valid spawn position is found at MIN_SPAWN_DISTANCE, spawn at the farthest accessible point from the player instead of giving up
- **FR-002**: In very small rooms, reduce MIN_SPAWN_DISTANCE proportionally to room area
