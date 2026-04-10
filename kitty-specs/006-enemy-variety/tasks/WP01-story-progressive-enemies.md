---
work_package_id: WP01
title: Story-Progressive Enemy Roster
dependencies: []
requirement_refs:
- FR-001
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 281ff88f0812016a0ebea1b988d7b0c191fa2bbf
created_at: '2026-04-10T11:42:55.620054+00:00'
subtasks: [T001, T002, T003, T004, T005]
agent: claude
shell_pid: "19012"
history:
- {ts: '2026-04-10T10:56:00Z', action: created, actor: claude}
authoritative_surface: js/enemy.js
execution_mode: code_change
owned_files:
- js/enemy.js
- js/wave.js
- js/eliteEnemies.js
---

# WP01 — Story-Progressive Enemy Roster

## Goal
Replace flat enemy spawning with a depth/story-based progression. Early dungeon floors should feel like exploring a cellar overrun with vermin and animals, not immediately fighting supernatural enemies.

## Key changes
1. **Progression table**: Define a mapping from dungeon depth to available enemy pools.
   - Depth 1–2: Animals (rats, bats, wolves) — low HP, simple patterns
   - Depth 3–5: Current base enemies (Imp, Archer) mixed with remaining animals
   - Depth 6+: Full roster (Brute, Mage, elites)
2. **New early-game enemies**: Create 2–3 animal types with simple AI (charge, bite, swarm).
3. **Spawner refactor**: Wave spawner reads from progression table by current depth.
4. **Stat scaling**: Enemy stats scale by depth tier, not just wave count.
5. **Reward scaling**: Loot/XP proportional to enemy tier.

## Acceptance criteria
- First 2 rooms only spawn animal-tier enemies
- Enemy roster visibly changes as player goes deeper
- No regression in existing enemy behavior at deeper depths
- XP and loot drops scale with enemy difficulty
