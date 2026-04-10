# Feature: Status Effects

## Problem
No status effects exist, so combat lacks tactical depth beyond direct damage dealing.

## Goal
Introduce status effects (poison, stun, slow, bleed) applicable to both players and enemies with clear visual feedback and defined duration/stacking rules.

## Technical Context
- Engine: Phaser 3
- Arcade Physics for movement (slow effect modifies velocity)
- Existing HP system on player and enemy sprites
- 6 player abilities and 4 enemy types as effect sources

## Functional Requirements
- **FR-001**: Status effect data model with type, duration, tick rate, magnitude, source, and stack count
- **FR-002**: Poison: deals damage over time at fixed tick intervals
- **FR-003**: Stun: prevents movement and ability use for duration
- **FR-004**: Slow: reduces movement speed by a percentage for duration
- **FR-005**: Bleed: deals escalating damage over time, refreshed on reapplication
- **FR-006**: Visual indicators on affected sprites (tint, particle, or icon) per effect type
- **FR-007**: Duration timer displayed on player HUD for effects on the player
- **FR-008**: Stacking rules: poison and bleed stack up to a cap, stun and slow refresh duration
- **FR-009**: Enemies can apply effects to the player and player abilities can apply effects to enemies
