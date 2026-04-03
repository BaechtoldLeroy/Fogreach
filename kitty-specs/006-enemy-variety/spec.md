# Feature: Enemy Variety

## Problem
Only 4 enemy types (Imp, Archer, Brute, Mage) exist, making wave-based combat predictable after a few runs.

## Goal
Expand the enemy roster with elite variants, new base types, and mini-bosses to keep combat encounters varied and challenging.

## Technical Context
- Engine: Phaser 3
- Existing enemy types: Imp, Archer, Brute, Mage
- Wave-based spawning system in Rathauskeller dungeon
- Boss appears every 10 waves with scaled stats

## Functional Requirements
- **FR-001**: Elite variants for each existing enemy type with modified stats (HP, damage, speed) and a visual distinction (glow, size, color)
- **FR-002**: Elite variants gain one additional ability or behavior compared to their base type
- **FR-003**: 3-4 new base enemy types with distinct movement and attack patterns (e.g., shielded, teleporting, summoner, explosive)
- **FR-004**: Mini-boss enemies that can appear in regular waves starting at higher wave numbers
- **FR-005**: Mini-bosses have a small health bar and at least one unique mechanic
- **FR-006**: Enemy spawn tables define which types and variants can appear per wave range
- **FR-007**: New enemies integrate with existing loot drop and XP systems
