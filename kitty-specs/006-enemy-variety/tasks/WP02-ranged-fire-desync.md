---
work_package_id: WP02
title: Ranged Unit Fire Desync
dependencies: []
requirement_refs:
- FR-002
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-10T10:56:00.000000+00:00'
subtasks: [T006, T007, T008]
agent: claude
history:
- {ts: '2026-04-10T10:56:00Z', action: created, actor: claude}
authoritative_surface: js/ai/
execution_mode: code_change
owned_files:
- js/ai/**
---

# WP02 — Ranged Unit Fire Desync

## Goal
Add a random delay offset to ranged enemy attack timers so multiple archers/mages don't fire in perfect lockstep. Currently when several ranged units spawn together, they all shoot at the exact same tick, creating unavoidable damage spikes.

## Key changes
1. On spawn, each ranged enemy gets a random offset (0–500ms) added to their initial attack cooldown.
2. Subsequent attack cycles use the normal cooldown — only the first shot is staggered.
3. Apply to Archer, Mage, and any future ranged types.

## Acceptance criteria
- 5+ ranged enemies in the same room fire at visibly staggered intervals
- Overall DPS per enemy unchanged (offset doesn't reduce fire rate)
- No impact on melee enemy timing
