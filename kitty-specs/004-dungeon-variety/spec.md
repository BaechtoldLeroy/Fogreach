# Feature: Dungeon Variety

## Problem
17 room templates exist in js/roomTemplates/ but only 3 are used per run in a fixed linear layout, making dungeon runs repetitive.

## Goal
Use the full pool of room templates with procedural selection and branching paths to make each dungeon run feel different.

## Technical Context
- Engine: Phaser 3
- Room templates: 17 defined in js/roomTemplates/
- Current manifest loads exactly 3 rooms in linear sequence
- Arcade Physics for collision in each room

## Functional Requirements
- **FR-001**: Procedural room selection draws from the full pool of available templates each run
- **FR-002**: Runs consist of more than 3 rooms (configurable room count per run)
- **FR-003**: Branching paths where players choose between 2+ doors leading to different rooms
- **FR-004**: Room difficulty scales with depth (harder rooms appear deeper in the run)
- **FR-005**: No identical room appears twice in the same run
- **FR-006**: Minimap or breadcrumb UI showing visited rooms and available paths
- **FR-007**: Boss room always appears as the final room of a run
