# Feature: Archivschmiede Crafting

## Problem
The Archive Forge scene (Archivschmiede.js) exists as a UI mockup but has no functional crafting mechanics, leaving collected materials purposeless.

## Goal
Implement a working crafting system in the Archivschmiede where players enhance equipment, combine materials, and enchant items using Eisenbrocken (iron scraps) and dungeon loot.

## Technical Context
- Engine: Phaser 3
- Scene: js/scenes/Archivschmiede.js (mockup exists)
- Inventory system already tracks items and materials
- Eisenbrocken (iron scraps) is the primary crafting currency
- Equipment slots exist in the player inventory

## Functional Requirements
- **FR-001**: Crafting UI in Archivschmiede scene with slots for input materials and output preview
- **FR-002**: Item enhancement: spend Eisenbrocken to increase equipment stat values
- **FR-003**: Material combining: merge lower-tier materials into higher-tier ones
- **FR-004**: Enchanting: apply special properties (e.g., lifesteal, bonus damage, resistance) to equipment using rare dungeon drops
- **FR-005**: Recipes define required inputs and resulting outputs with clear display of costs
- **FR-006**: Enhancement has a maximum level per item with increasing Eisenbrocken cost per tier
- **FR-007**: Crafting results persist to the player inventory and save system
- **FR-008**: Visual and audio feedback on successful craft, enhancement, or enchant
