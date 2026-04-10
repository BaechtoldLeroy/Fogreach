# Feature: Skill Tree Expansion

## Problem
Only 18 passive stat-bonus skills exist across 3 trees. There are no active abilities unlocked via the skill tree, no synergy bonuses, and no way to respec.

## Goal
Expand the skill system with active ability unlocks, cross-tree synergy bonuses, a respec mechanism, and a visual skill tree UI.

## Technical Context
- Engine: Phaser 3
- Current skills: 18 passive skills across 3 trees
- Player has 6 abilities already implemented for combat
- Save system: localStorage

## Functional Requirements
- **FR-001**: Add at least 2 active abilities per tree (6 total) that are unlocked through skill point investment and usable in combat
- **FR-002**: Implement synergy bonuses that activate when the player invests points in skills from multiple trees (e.g., 3 points in Strength + 3 in Arcane = bonus effect)
- **FR-003**: Add a respec option available from hub NPCs, costing in-game currency, that refunds all spent skill points
- **FR-004**: Build a visual skill tree UI showing nodes, connections, locked/unlocked state, and point requirements
- **FR-005**: Skill nodes must support prerequisites (unlock node X before node Y)
- **FR-006**: Display tooltip on hover/click for each skill node showing name, description, cost, and current rank
- **FR-007**: Persist skill allocations and synergy state in the existing localStorage save system
- **FR-008**: Active abilities unlocked via the tree must integrate with the existing 6-ability hotbar
