# Feature: Sound & Music

## Problem
The game is completely silent, lacking audio feedback for actions, atmosphere, and UI interactions.

## Goal
Add sound effects and music that reinforce combat feedback, create atmosphere in hub and dungeon scenes, and improve UI responsiveness.

## Technical Context
- Engine: Phaser 3
- Audio: Phaser sound manager (`this.sound.add()`, `this.sound.play()`)
- Scenes: Hub (Fogreach), Rathauskeller dungeon, Archivschmiede
- 6 player abilities and 4 enemy types need distinct SFX

## Functional Requirements
- **FR-001**: Attack and ability SFX for all 6 player abilities
- **FR-002**: Hit feedback sounds for player dealing and receiving damage
- **FR-003**: Enemy-specific attack and death sounds for each of the 4 enemy types
- **FR-004**: Ambient background music loop for the hub scene
- **FR-005**: Dungeon music loop that differs from hub music
- **FR-006**: Boss encounter theme that triggers on boss wave
- **FR-007**: UI sounds for menu navigation, item pickup, quest updates, and inventory actions
- **FR-008**: Volume controls for music and SFX independently
- **FR-009**: Audio assets preloaded in scene preload phase to avoid playback delay
