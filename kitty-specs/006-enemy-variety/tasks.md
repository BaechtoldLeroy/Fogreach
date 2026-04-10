# Tasks: Enemy Variety

**Feature:** 006-enemy-variety
**Total subtasks:** 8
**Total work packages:** 2
**Generated:** 2026-04-10
**Branch contract:** main → main

## Work Package Map

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|---|---|---:|---:|---|---|
| WP01 | Story-Progressive Enemy Roster | 5 | ~300 | — | with WP02 |
| WP02 | Ranged Unit Fire Desync | 3 | ~80 | — | with WP01 |

## Phase 1: Enemy Progression & Polish (parallel)

### WP01 — Story-Progressive Enemy Roster

**Goal:** Replace flat enemy spawning with a progression system that matches story/dungeon depth. Early floors spawn weaker, thematically appropriate enemies (animals, vermin), while deeper floors introduce the current roster and harder variants.

**Priority:** P0
**Independent test:** Start a new run; verify early rooms spawn animal/vermin-type enemies, and deeper rooms transition to Imps, Archers, Brutes, Mages.
**Prompt:** [tasks/WP01-story-progressive-enemies.md](tasks/WP01-story-progressive-enemies.md)

**Subtasks:**
- [ ] **T001** Define enemy tier/progression table mapping depth ranges to enemy pools (e.g., depth 1–2: rats/bats/wolves, depth 3–5: imps/archers, depth 6+: brutes/mages/elites).
- [ ] **T002** Create 2–3 early-game animal enemy types (e.g., rat, bat, wolf) with simple movement/attack patterns and appropriate sprites.
- [ ] **T003** Refactor wave spawner to read from the progression table instead of a flat enemy list.
- [ ] **T004** Scale enemy stats (HP, damage, speed) based on depth tier, not just wave number.
- [ ] **T005** Ensure loot drops and XP scale appropriately for the new enemy tiers — weaker enemies drop less, stronger enemies drop more.

### WP02 — Ranged Unit Fire Desync

**Goal:** Add a random delay to ranged enemy attack timers so that archers and mages don't all fire in perfect sync. This makes combat feel more natural and reduces unavoidable damage spikes from synchronized volleys.

**Priority:** P1
**Independent test:** Spawn 5+ archers in a test room; observe that their projectiles fire at staggered intervals rather than all at once.
**Prompt:** [tasks/WP02-ranged-fire-desync.md](tasks/WP02-ranged-fire-desync.md)

**Subtasks:**
- [ ] **T006** Add a per-enemy random offset (e.g., 0–500ms) to the ranged attack cooldown timer on spawn.
- [ ] **T007** Apply the offset to all ranged enemy types (Archer, Mage, and any new ranged animals).
- [ ] **T008** Verify that the offset doesn't affect overall DPS balance — just staggers the timing, not the rate.
