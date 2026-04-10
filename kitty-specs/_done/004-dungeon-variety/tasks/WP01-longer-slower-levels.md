---
work_package_id: WP01
title: Longer, Slower-Paced Levels
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 0894d21e41022ff78f58188e932fbc8b1994551c
created_at: '2026-04-10T11:11:14.249772+00:00'
subtasks: [T001, T002, T003, T004, T005, T006]
agent: claude
shell_pid: "38008"
history:
- {ts: '2026-04-10T10:56:00Z', action: created, actor: claude}
authoritative_surface: src/
execution_mode: code_change
owned_files:
- src/**
---

# WP01 — Longer, Slower-Paced Levels

## Goal
Make dungeon runs longer and slower-paced with bigger levels. The current 3-room linear sprint should become a 6–10 room journey that uses the full template pool, has larger rooms, and gives the player breathing room between waves.

## Key changes
1. **Room count**: Increase from 3 to configurable (default 8), draw from all 17 templates without repeats.
2. **Room scale**: Increase room dimensions or use larger template variants.
3. **Wave pacing**: Increase delay between waves, add a short calm period after clearing each wave.
4. **Exploration breaks**: Insert non-combat rooms (loot rooms, rest stops) every few rooms.
5. **Difficulty scaling**: Enemy count and stats scale with room depth.
6. **Progress indicator**: Show "Room X / Y" in HUD.

## Acceptance criteria
- Runs use 6+ rooms from the full template pool
- Wave intervals are noticeably longer than current
- At least one non-combat room type exists per run
- Room depth indicator visible in HUD
