# Feature: Boss Variety

## Problem
Only one boss pattern exists that scales stats with wave number, making every boss encounter feel the same regardless of progression.

## Goal
Introduce unique bosses with distinct arenas, attack patterns, and lore connections to the Chain Council, appearing every 10 waves.

## Technical Context
- Engine: Phaser 3
- Current boss spawns every 10 waves with scaled HP/damage
- Rathauskeller dungeon wave system handles boss triggering
- Arcade Physics for boss movement and projectile collision

## Functional Requirements
- **FR-001**: At least 3 unique boss definitions, each with a distinct sprite, name, and lore tie to the Kettenrat (Chain Council)
- **FR-002**: Each boss has a unique arena layout or environmental hazard during the fight
- **FR-003**: Each boss has at least 2 distinct attack phases that change based on remaining HP
- **FR-004**: Boss attack patterns include unique mechanics not shared with regular enemies (e.g., area denial, summon adds, charge attacks)
- **FR-005**: Bosses rotate or are assigned to specific wave thresholds (wave 10, 20, 30, etc.)
- **FR-006**: Boss defeat triggers unique loot drops not available from regular enemies
- **FR-007**: Health bar with boss name displayed prominently during the encounter
- **FR-008**: Brief lore introduction text or cutscene when a boss first appears
