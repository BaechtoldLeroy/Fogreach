# Feature: Particle Effects

## Problem
Combat has no visual feedback beyond sprite animations. Hits, spells, and loot drops feel flat and unresponsive.

## Goal
Add particle effects for combat hits, spell abilities, screen shake on big impacts, and loot sparkle using Phaser's built-in particle emitter system.

## Technical Context
- Engine: Phaser 3 (Arcade Physics)
- Particle system: `Phaser.GameObjects.Particles.ParticleEmitterManager`
- 6 player abilities exist that need VFX
- 4 enemy types with melee/ranged attacks
- Top-down view

## Functional Requirements
- **FR-001**: Add hit-impact particles (blood/dust) when player attacks connect with enemies
- **FR-002**: Add hit-impact particles when enemies damage the player
- **FR-003**: Create spell VFX for each of the 6 player abilities (projectile trails, area-of-effect bursts, buff auras)
- **FR-004**: Implement screen shake on heavy hits (boss attacks, critical strikes) using camera shake with configurable intensity and duration
- **FR-005**: Add loot sparkle/glow particles on dropped items and collectibles
- **FR-006**: Add death explosion particles when enemies are killed
- **FR-007**: Create a reusable `ParticleFactory` utility class for spawning and pooling particle emitters to avoid runtime allocation
- **FR-008**: All particle effects must be performant (object pooling, max particle limits) to maintain 60fps on mid-range hardware
