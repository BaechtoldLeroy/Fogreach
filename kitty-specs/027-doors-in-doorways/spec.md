# Feature: Doors in Doorways

## Problem
Doorways in procedural rooms are just open gaps in walls. Real doors (visible sprite, possibly openable/closeable, optional locked state) would make chambers feel more defined and add gameplay options.

## Goal
Replace open doorways with actual door sprites. Support basic interaction (open/close on approach) and optional locked doors that require a key or trigger.

## Functional Requirements
- **FR-001**: Door sprite placed at doorway positions in procedural + template rooms
- **FR-002**: Doors are passable by default (auto-open or always open)
- **FR-003**: Optional locked doors that need a key/trigger (maybe for special chambers with loot)
- **FR-004**: Closed door blocks line of sight (fog of war reacts)
- **FR-005**: Open/close animation or at least texture swap
- **FR-006**: Doors should be visually themed with the room (wooden, iron, stone)
- **FR-007**: Hand-authored templates should support door placement via a new object type
