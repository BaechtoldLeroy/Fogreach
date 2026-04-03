# Feature: Equipment Visuals

## Problem
Equipped items do not change the player's appearance. The player always looks the same regardless of gear, reducing the sense of progression and reward.

## Goal
Render visual changes on the player sprite when equipping different weapons, armor, helmets, and boots, layered on top of the base 8-directional sprite.

## Technical Context
- Engine: Phaser 3
- Player uses 8-directional sprites (64 frames total: 8 directions x 8 animation frames)
- Inventory has 4 equipment slots: weapon, armor, helmet, boots
- Sprites are rendered via Phaser sprite/spritesheet system

## Functional Requirements
- **FR-001**: Implement an overlay sprite layer system that composites equipment visuals on top of the base player sprite
- **FR-002**: Each equipment item must have a corresponding spritesheet matching the player's 8-direction, 64-frame layout
- **FR-003**: Equipment overlay sprites must stay synchronized with the base sprite's current animation frame and direction
- **FR-004**: Support all 4 equipment slots rendering simultaneously (weapon, armor, helmet, boots) with correct z-ordering
- **FR-005**: Provide at least 2 visual variants per slot for initial implementation (8 spritesheets minimum)
- **FR-006**: Equipment visuals must update immediately when items are equipped or unequipped via the inventory UI
- **FR-007**: Define a sprite naming convention and asset pipeline so new equipment visuals can be added without code changes
