# Feature: Pause Menu

## Problem
The game cannot be paused during combat. Players have no way to stop the action to access inventory, skills, settings, or quit safely.

## Goal
Add a pause overlay triggered by ESC with resume, inventory, skills, settings, and quit-to-hub options that freezes physics and enemy AI.

## Technical Context
- Engine: Phaser 3 (Arcade Physics)
- Physics: Arcade Physics with active enemy AI and projectile movement
- Scenes: Hub and Rathauskeller dungeon (combat)
- Settings menu: feature 013 (may or may not be implemented yet)

## Functional Requirements
- **FR-001**: Pressing ESC during gameplay opens a pause overlay rendered on top of the current scene
- **FR-002**: Pause must freeze Arcade Physics (all bodies), enemy AI updates, projectile movement, cooldown timers, and wave spawn timers
- **FR-003**: Pause overlay displays buttons: Resume, Inventory, Skills, Settings, Quit to Hub
- **FR-004**: Resume (or pressing ESC again) closes the overlay and restores all physics, AI, and timers to their pre-pause state
- **FR-005**: Inventory button opens the inventory UI from the pause state
- **FR-006**: Skills button opens the skill tree UI from the pause state
- **FR-007**: Settings button opens the settings menu (feature 013) or a placeholder if not yet implemented
- **FR-008**: Quit to Hub returns the player to the hub scene, discarding current dungeon run progress with a confirmation prompt
- **FR-009**: Pause menu must not be accessible from the hub scene (only during dungeon/combat scenes)
