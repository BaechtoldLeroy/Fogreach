---
work_package_id: WP02
title: Object culling and physics optimization
dependencies: [WP01]
requirement_refs: [FR-003, FR-004]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
created_at: '2026-04-16T00:00:00Z'
subtasks: [T001, T002, T003]
lane: planned
owned_files:
- js/enemy.js
- js/proceduralRooms.js
- js/roomManager.js
---

# WP02 — Object culling and physics optimization

## Objective

Reduce per-frame CPU cost by culling off-screen objects and disabling physics for entities outside the camera viewport. Procedural rooms can contain many enemies, obstacles, and wall segments; updating all of them every frame is wasteful on mobile.

## Context

`js/enemy.js` runs update logic for every enemy regardless of whether they are visible. `js/proceduralRooms.js` generates rooms with many physics bodies (walls, obstacles, decorations). On mobile, the arcade physics solver struggles with large body counts.

## Subtasks

### T001 — Camera-based object culling

**Purpose**: Skip rendering and update logic for objects outside the camera viewport.

**Steps**:
1. Create a utility function `isInCameraView(gameObject, camera, margin)` that checks if an object's bounds intersect the camera viewport plus a configurable margin (default: 128px).
2. In the enemy update loop (`js/enemy.js`), skip AI/movement updates for enemies outside camera view.
3. Ensure culled enemies still respond to damage if hit by a projectile that reaches them.

**Files**: `js/enemy.js`.

**Validation**: With 20+ enemies in a room, only enemies near the player run their update. Frame time for enemy updates drops proportionally.

### T002 — Disable physics for off-screen bodies

**Purpose**: Reduce arcade physics solver workload.

**Steps**:
1. For enemies and obstacles outside camera view, call `body.enable = false` to remove them from the physics simulation.
2. Re-enable physics bodies when they enter the camera margin.
3. Use a check interval (every 10-15 frames) rather than every frame to avoid the culling check itself becoming expensive.

**Files**: `js/enemy.js`, `js/proceduralRooms.js`.

**Validation**: Physics body count (visible in Phaser debug) drops when many enemies are off-screen. No enemies get stuck or fail to reactivate when player approaches.

### T003 — Reduce wall segment physics bodies

**Purpose**: Merge adjacent wall segments to reduce total body count.

**Steps**:
1. In `js/proceduralRooms.js`, after room generation, merge adjacent horizontal and vertical wall segments into fewer, larger rectangle bodies.
2. Only apply this optimization on mobile (desktop can keep the fine-grained walls for precision).
3. Ensure collision accuracy is preserved for gameplay-critical paths.

**Files**: `js/proceduralRooms.js`.

**Validation**: Total physics body count for a typical room drops by 40%+. Player movement and enemy pathfinding still work correctly.

## Definition of Done

- Off-screen enemies skip AI updates and have physics disabled.
- Physics body re-activation works reliably when objects enter camera view.
- Wall segment merging reduces body count on mobile.
- No gameplay regressions: enemies still path, attack, and take damage correctly.
- Desktop behavior is unchanged.

## Risks

- Enemies that are culled mid-attack may behave strangely when re-activated. Ensure state is preserved.
- Wall merging may create gaps if the merge logic is off by a pixel. Test with procedural room seeds that produce narrow corridors.

## Reviewer guidance

- Test with rooms containing 20+ enemies and verify frame time improvement.
- Check that enemies near the viewport edge do not visibly "pop" in/out of existence.
- Verify wall collision is pixel-accurate after merging.
