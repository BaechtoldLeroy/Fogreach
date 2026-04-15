# Feature: Random Event Overhaul

## Problem
Random dungeon events currently only show a brief toast text and silently apply effects in the background. Events feel invisible and unimpactful — the player barely notices them.

## Goal
Make random events feel like real encounters with visible NPCs, interactive UI, and meaningful choices. The wandering merchant should appear as a sprite the player can interact with, treasure should be a visible chest, ambushes should have a dramatic lead-in, etc.

## Technical Context
- Engine: Phaser 3
- Current: `js/eventSystem.js` with 6 event types, toast-only UI
- NPC dialog system exists (used by hub NPCs)
- Shop UI exists (Mara shop scene)

## Functional Requirements
- **FR-001**: Wandering Merchant — spawn a merchant NPC sprite in the room that the player can interact with to open a small shop overlay (reuse/adapt Mara shop)
- **FR-002**: Treasure Cache — spawn a visible chest sprite that the player walks to and opens (with animation/particle effect), then receive loot
- **FR-003**: Ambush — dramatic warning text + short delay before extra enemies spawn, with a reward bonus for surviving
- **FR-004**: Trapped Chest — visible chest that triggers a risk/reward dialog (open or leave), with visual feedback for damage taken and gold gained
- **FR-005**: Lore Fragment — spawn a glowing scroll/book sprite the player picks up, showing a short story text in a dialog overlay
- **FR-006**: Environmental Hazard — visual effect (falling rocks, crumbling floor) with a brief dodge window before damage is applied
- **FR-007**: Event toast text should be larger, last longer (4-5s), and include an icon or color coding per event type
- **FR-008**: HUD must update immediately after gold/HP/XP changes from events
