# Feature: Tutorial / Onboarding

## Problem
New players receive no guidance on how to move, fight, use abilities, manage inventory, or interact with NPCs.

## Goal
Implement contextual tutorial hints on first play, dismissible popups for each core system, and a help reference accessible anytime.

## Technical Context
- Engine: Phaser 3
- Current scenes: Hub (with NPCs), Rathauskeller dungeon (combat)
- Controls: keyboard for movement and abilities, click for interact/inventory
- Save system: localStorage (can track tutorial completion flags)

## Functional Requirements
- **FR-001**: Show a movement tutorial prompt when the player first loads the hub scene (WASD/arrow keys)
- **FR-002**: Show a combat tutorial prompt when the player enters the dungeon for the first time (attack, dodge)
- **FR-003**: Show ability tutorial prompts when the player first unlocks or uses abilities (hotkeys, cooldowns)
- **FR-004**: Show an inventory tutorial prompt when the player first opens the inventory or picks up an item
- **FR-005**: Show an NPC interaction prompt when the player first approaches an NPC in the hub
- **FR-006**: All tutorial popups must be dismissible with a click or keypress and must not block gameplay for more than a brief overlay
- **FR-007**: Track tutorial completion flags in localStorage so prompts only appear once per save
- **FR-008**: Provide a Help/Controls reference panel accessible anytime via a UI button or hotkey that summarizes all controls and systems
