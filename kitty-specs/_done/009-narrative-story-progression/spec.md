# Feature: Narrative Story Progression

## Problem
Rich lore exists (Fogreach, Chain Council, demon pacts, Archive Forge) but zero narrative is implemented in-game. Players have no story motivation or sense of progression beyond combat waves.

## Goal
Implement a main quest arc across 5 acts (Awakening, Obedience vs Memory, Descent, Rebellion, Revelation) with story events triggered by dungeon progress and quest completion.

## Technical Context
- Engine: Phaser 3
- Current state: Hub scene with 3 NPCs, Rathauskeller dungeon with wave-based combat
- Save system: localStorage-based persistence
- NPCs exist but have no quest dialogue beyond static text

## Functional Requirements
- **FR-001**: Define 5-act main quest structure with discrete story beats tied to dungeon wave milestones and NPC interactions
- **FR-002**: Implement a quest state tracker persisted via localStorage (active quests, completed quests, current act)
- **FR-003**: Add branching dialogue to existing NPCs that updates based on current quest/act progress
- **FR-004**: Create story event triggers that fire on dungeon wave completion (e.g., completing wave 5 unlocks Act 2)
- **FR-005**: Display narrative text via an in-game dialogue UI (text box with speaker name, portrait placeholder, and advance/dismiss controls)
- **FR-006**: Add cutscene-style sequences at act transitions (camera pan, text overlay, optional fade-to-black)
- **FR-007**: Provide a quest log UI accessible from the hub showing active and completed quests with descriptions
- **FR-008**: Support at least one meaningful player choice per act that affects dialogue or minor rewards
