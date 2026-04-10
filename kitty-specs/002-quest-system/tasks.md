# Tasks: Quest System

**Feature:** 002-quest-system
**Total subtasks:** 5
**Total work packages:** 1
**Generated:** 2026-04-10
**Branch contract:** main → main

## Work Package Map

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|---|---|---:|---:|---|---|
| WP01 | Random Events & Encounters | 5 | ~350 | — | — |

## Phase 1: Random Events

### WP01 — Random Events & Encounters

**Goal:** Add a random event system that triggers procedural mini-quests and encounters during dungeon runs — treasure rooms, ambushes, NPC encounters, environmental puzzles — to break up the combat loop and add replayability.

**Priority:** P0
**Independent test:** Complete 3 dungeon runs; verify that random events trigger at least once per run and are not identical across runs.
**Prompt:** [tasks/WP01-random-events.md](tasks/WP01-random-events.md)

**Subtasks:**
- [ ] **T001** Create a random event engine that can trigger events based on room transitions, with configurable probability per depth.
- [ ] **T002** Define 4–6 event types: treasure cache, ambush (extra wave), wandering merchant, trapped chest, lore fragment, environmental hazard.
- [ ] **T003** Build event UI — notification when an event triggers, event-specific interaction prompts.
- [ ] **T004** Wire event rewards into existing loot/gold/XP systems.
- [ ] **T005** Ensure events are weighted by depth and don't repeat back-to-back in the same run.
