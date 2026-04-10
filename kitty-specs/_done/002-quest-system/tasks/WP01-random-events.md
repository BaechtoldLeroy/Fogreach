---
work_package_id: WP01
title: Random Events & Encounters
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 8c576c15ab15a8fb069bfba6ca24923e4c0b8b92
created_at: '2026-04-10T11:43:01.577413+00:00'
subtasks: [T001, T002, T003, T004, T005]
agent: claude
shell_pid: "52164"
history:
- {ts: '2026-04-10T10:56:00Z', action: created, actor: claude}
authoritative_surface: src/
execution_mode: code_change
owned_files:
- src/**
---

# WP01 — Random Events & Encounters

## Goal
Add a random event system that triggers procedural encounters during dungeon runs — treasure rooms, ambushes, NPC encounters, environmental puzzles — to break up the pure combat loop and add replayability.

## Key changes
1. **Event engine**: A lightweight system that rolls for events on room transitions with depth-weighted probabilities.
2. **Event types** (4–6 to start):
   - Treasure cache — bonus loot room
   - Ambush — surprise extra wave with bonus XP
   - Wandering merchant — temporary shop with random inventory
   - Trapped chest — risk/reward interaction
   - Lore fragment — story/worldbuilding pickup
   - Environmental hazard — avoid damage for a reward
3. **UI**: Toast notification on trigger, event-specific interaction prompts.
4. **Rewards**: Feed into existing loot/gold/XP systems.
5. **Anti-repetition**: Events weighted by depth, no back-to-back repeats.

## Acceptance criteria
- At least 1 random event per dungeon run on average
- Events vary across runs (not deterministic)
- Event rewards integrate with existing inventory/gold systems
- No event type repeats consecutively in the same run
