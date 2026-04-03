# Feature: Settings Menu

## Problem
No settings or options menu exists. Players cannot adjust volume, difficulty, graphics, or view keybindings.

## Goal
Add a settings menu with volume controls, difficulty selection, graphics quality toggle, and keybinding display, accessible from both the hub and the pause menu.

## Technical Context
- Engine: Phaser 3
- Audio: Phaser sound manager (SFX and music channels)
- Save system: localStorage
- No pause menu exists yet (see feature 015)

## Functional Requirements
- **FR-001**: Create a SettingsScene rendered as an overlay or dedicated scene with a back/close button
- **FR-002**: Add separate volume sliders for music and SFX (0-100%), applied in real time via Phaser sound manager
- **FR-003**: Add difficulty selection (Easy, Normal, Hard) that scales enemy HP, damage, and wave count
- **FR-004**: Add a graphics quality toggle (Low, Medium, High) that controls particle density and optional effects
- **FR-005**: Display current keybindings in a read-only reference panel (movement, abilities, interact, inventory, pause)
- **FR-006**: Persist all settings to localStorage and load them on game start
- **FR-007**: Settings menu must be openable from the hub scene (via UI button or hotkey) and from the pause menu
- **FR-008**: Apply difficulty setting to dungeon enemy scaling without requiring a scene restart
