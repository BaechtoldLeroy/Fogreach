# Feature: More Stairs in Procedural Rooms

## Problem
Procedural rooms lack vertical connections. More stairways would add depth and navigation variety to dungeon layouts.

## Goal
Add stair generation to the procedural room system so rooms can connect vertically, creating multi-level dungeon sections.

## Functional Requirements
- **FR-001**: Procedural room generator can place stairs up/down
- **FR-002**: Stairs connect to other procedural rooms or dungeon levels
- **FR-003**: Stair placement respects room geometry and doesn't overlap with walls or obstacles
- **FR-004**: Stairs are clearly visible and interactable
- **FR-005**: Stair frequency is configurable or follows a balanced distribution
