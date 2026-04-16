---
work_package_id: WP03
title: Interactive objects (breakables and hidden containers)
dependencies: [WP02]
requirement_refs: [FR-002, FR-005]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 1591edf4eb1a915db149d0591f06562ee7135d28
created_at: '2026-04-16T12:00:00Z'
subtasks: [T001, T002, T003]
history:
- action: created
  agent: claude
  utc: '2026-04-16T12:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/proceduralRooms.js
- js/lootSystem.js
- js/graphics.js
---

# WP03 — Interactive objects (breakables and hidden containers)

## Objective

Add interactive objects to large rooms: breakable barrels/crates that drop minor loot when destroyed by the player, and hidden containers (chests, urns) with small rewards. This gives players a reason to explore large rooms beyond just fighting enemies.

## Context

WP02 places decorative barrels and crates. This WP upgrades a subset of them to be breakable and adds hidden containers as a new interactive prop type. Loot drops integrate with `js/lootSystem.js`.

## Subtasks

### T001 — Breakable object behavior

**Purpose**: Allow certain props (barrels, crates) to be destroyed by player attacks.

**Steps**:
1. Tag a percentage of spawned barrels/crates as `breakable: true` (e.g., 30-50% of them).
2. Breakable objects have a small HP pool (1-2 hits to destroy).
3. On destruction: play a simple break animation (swap texture to rubble/debris), remove the collider, and call the loot drop function.
4. Register breakable objects with the combat overlap system so player attacks can hit them.

**Files**: `js/proceduralRooms.js`, `js/graphics.js` (break debris texture)

**Validation**: Attacking a breakable barrel destroys it. Non-breakable barrels are unaffected. Destroyed barrels no longer block movement.

### T002 — Loot drops from breakables

**Purpose**: Reward the player for breaking objects.

**Steps**:
1. Define a simple drop table for breakables: gold (common), health potion (rare), nothing (possible).
2. On breakable destruction, roll the drop table and spawn the reward via `js/lootSystem.js` (use `grantGold` for gold, potion pickup for potions).
3. Drop rates should be modest so breaking objects is a nice bonus, not the primary loot source.

**Files**: `js/proceduralRooms.js`, `js/lootSystem.js`

**Validation**: Breaking objects sometimes drops gold or potions. Drop rates feel balanced (not every barrel drops loot).

### T003 — Hidden containers

**Purpose**: Add discoverable containers that reward exploration.

**Steps**:
1. Spawn 0-2 hidden containers per large room (urns, small chests) in corners or edges.
2. Hidden containers have a subtle visual distinction (slight glow or different color) to reward observant players.
3. Interacting with a container (attack or walk-over) opens it and grants a reward (gold, potion, or rarely a loot item).
4. Once opened, the container changes to an "opened" texture and cannot be interacted with again.
5. Generate container textures (closed urn, open urn, closed chest, open chest) in `js/graphics.js`.

**Files**: `js/proceduralRooms.js`, `js/graphics.js`, `js/lootSystem.js`

**Validation**: Hidden containers appear in large rooms. They can be opened once. Rewards are granted correctly. Opened containers show a different visual.

## Definition of Done

- 30-50% of barrels/crates in large rooms are breakable.
- Breakable objects are destroyed in 1-2 hits and drop loot from a defined table.
- 0-2 hidden containers spawn per large room with discoverable rewards.
- Loot drops integrate correctly with `js/lootSystem.js`.
- No regression in combat system or existing loot mechanics.

## Risks

| Risk | Mitigation |
|---|---|
| Breakable overlap with combat system causes unintended interactions | Use a separate overlap group for breakables; test with all ability types |
| Loot drops from breakables are too generous | Keep drop rates low; gold amounts small relative to enemy drops |
| Hidden containers feel unfair if too hard to spot | Use subtle but visible distinction (glow effect or color shift) |

## Implementation command

```
spec-kitty implement WP03
```
