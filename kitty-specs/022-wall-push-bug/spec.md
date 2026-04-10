# Bug: Enemies can push player through walls

## Problem
Enemies can push the player character through wall colliders. When multiple enemies crowd the player against a wall, the combined force clips the player through the obstacle and out of bounds.

## Goal
Prevent enemies from displacing the player through walls under any circumstances.

## Technical Context
- Engine: Phaser 3 Arcade Physics
- Player has `setCollideWorldBounds(true)` and obstacle colliders
- Enemies already have `body.pushable = false` (added in 001-fix-player-collision)
- Wall colliders are static bodies from room templates
- Issue likely caused by multiple enemy bodies overlapping the player and their combined separation force exceeding the collision response

## Functional Requirements
- **FR-001**: Player must never be pushed through wall or obstacle colliders by enemy contact
- **FR-002**: Fix must work with any number of enemies crowding the player
- **FR-003**: Player movement and enemy AI must not be otherwise affected

## Possible Approaches
- Make player body immovable during enemy overlap resolution
- Set `player.body.pushable = false` so enemies cannot displace the player
- Add post-collision position clamping to keep player within room bounds
- Reduce or cap the total force enemies can apply to the player per frame
