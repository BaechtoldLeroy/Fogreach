# Feature: Quest System

## Problem
NPCs (Branka, Thom, Mara) only have flavor dialogue with no gameplay purpose, giving players no structured objectives or progression incentives beyond combat.

## Goal
NPCs assign trackable quests with clear objectives, completion conditions, and rewards that tie hub interactions to dungeon gameplay.

## Technical Context
- Engine: Phaser 3
- NPCs already have dialogue UI and interaction triggers
- Dungeon runs produce loot/drops that quests can reference
- Inventory system exists for reward delivery

## Functional Requirements
- **FR-001**: Quest data model with id, giver, description, objectives, status (available/active/complete/turned-in), and rewards
- **FR-002**: Branka assigns quests to retrieve documents from the Rathauskeller
- **FR-003**: Thom assigns quests to gather evidence of Chain Council corruption for printing
- **FR-004**: Mara assigns quests to break council seals found in dungeon runs
- **FR-005**: Quest tracker UI showing active quests and objective progress
- **FR-006**: NPC dialogue changes based on quest state (available, in-progress, ready to turn in)
- **FR-007**: Quest completion triggers reward delivery to player inventory
- **FR-008**: Quest progress persists across scene transitions and sessions
