# Tasks: Dungeon Variety

**Feature:** 004-dungeon-variety
**Total subtasks:** 6
**Total work packages:** 1
**Generated:** 2026-04-10
**Branch contract:** main → main

## Work Package Map

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|---|---|---:|---:|---|---|
| WP01 | Longer, Slower-Paced Levels | 6 | ~350 | — | — |

> **Note:** WP01 covers all functional requirements (FR-001 through FR-007) as a single cohesive work package — bigger levels with procedural selection, branching paths, depth scaling, no-repeat logic, minimap, and boss room placement are all part of the level rework.

## Phase 1: Level Pacing & Scale

### WP01 — Longer, Slower-Paced Levels

**Goal:** Make dungeon runs longer and slower-paced with bigger levels. Increase room count per run, use the full room template pool, and tune enemy spawn timing / wave intervals for a more deliberate pace.

**Priority:** P0
**Independent test:** Start a dungeon run; verify more rooms are generated, rooms feel larger, and wave pacing is noticeably slower than current.
**Prompt:** [tasks/WP01-longer-slower-levels.md](tasks/WP01-longer-slower-levels.md)

**Subtasks:**
- [ ] **T001** Increase default room count per run from 3 to a configurable value (6–10 range), drawing from the full 17-template pool without repeats.
- [ ] **T002** Scale up room dimensions or use larger template variants so individual rooms feel bigger.
- [ ] **T003** Increase wave interval timers — add breathing room between enemy waves so combat is less frantic.
- [ ] **T004** Add exploration elements between combat (e.g., loot rooms, rest areas, environmental storytelling) to break up the pace.
- [ ] **T005** Scale enemy count and difficulty per room based on room depth to maintain challenge across longer runs.
- [ ] **T006** Persist and display run progress (room X of Y) so the player knows how deep they are.
