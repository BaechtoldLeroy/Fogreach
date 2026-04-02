\# Feature: Fix Player Collision



\## Problem

Player character can walk through solid objects when movement keys are pressed

in certain combinations (e.g. diagonal movement or rapid direction changes).



\## Goal

Player is correctly blocked by all solid tilemap layers and objects in all

movement directions and key combinations.



\## Technical Context

\- Engine: Phaser 3

\- Movement: keyboard input, likely in update() loop

\- Collision: Phaser arcade physics or tilemap collider



\## Functional Requirements

- **FR-001**: Player cannot pass through any solid tile or object
- **FR-002**: All 8 movement directions behave correctly
- **FR-003**: No regression in existing movement feel

