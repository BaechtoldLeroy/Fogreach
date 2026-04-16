# Implementation Plan: Random Event Rework

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/032-random-event-rework/spec.md`

## Summary

Overhaul random events to be more diverse and engaging. Current pool: treasure_cache (30%), ambush (18%), wandering_merchant (18%), trapped_chest (12%), lore_fragment (15%), environmental_hazard (7%). Chest events are boring and dominant.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0
**Testing**: Manual playtesting
**Target Platform**: Desktop + Mobile browsers

## Approach

1. **New event types** in `js/eventSystem.js`:
   - **Shrine buffs** — Temporary stat boost with tradeoff (+damage/-armor etc.)
   - **NPC rescue** — Save trapped NPC for reward
   - **Cursed item** — High-power item with debuff (via `statusEffects.js`)
   - **Puzzle room** — Simple lever/pattern puzzle
   - **Elite ambush** — Mini-boss with better loot (via `eliteEnemies.js`)
   - **Gambling** — Risk gold for rare items

2. **Choice UI** — Simple overlay dialog with 2-3 option buttons for events that offer decisions.

3. **Rebalance weights** — Reduce treasure_cache to ~15%, distribute new events. Keep probability curve (35%+2%/depth, cap 55%).

## Key Files

- `js/eventSystem.js` — Add event types, choice system, rebalance weights
- `js/lootSystem.js` — Reward generation for new events
- `js/eliteEnemies.js` — Elite ambush integration
- `js/statusEffects.js` — Cursed item debuffs

## Dependencies

- None (standalone)
