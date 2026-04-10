# Feature: Optimize Loading Time

## Problem
Game takes too long to load at startup. Player sprites alone are 131 MB (64 individual PNGs). NPC sprites loaded twice, 9.7 MB legacy assets unused.

## Goal
Reduce initial load time by 80%+ through asset optimization and lazy loading.

## Technical Context
- Engine: Phaser 3
- Current total preload: ~137 MB
- Biggest offender: 64 player PNGs at ~2 MB each = 131 MB

## Functional Requirements
- **FR-001**: Combine player sprites into sprite atlas or lazy-load per direction
- **FR-002**: Remove duplicate NPC sprite loading (loaded in both StartScene and HubSceneV2)
- **FR-003**: Delete unused legacy tilemap assets (assets/oldtilesmap/ = 9.7 MB)
- **FR-004**: Remove HubScene.js preload of unused textures
- **FR-005**: Add loading progress bar to StartScene
- **FR-006**: Compress brute sprites (4.25 MB for 6 frames)
