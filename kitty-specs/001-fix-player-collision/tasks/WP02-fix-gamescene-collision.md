---
work_package_id: WP02
title: Fix GameScene Collision & Anti-Tunneling
dependencies: [WP01]
requirement_refs:
- FR-001
- FR-002
- FR-003
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T004, T005, T006]
history:
- timestamp: '2026-04-02T22:24:34Z'
  action: created
  by: spec-kitty.tasks
authoritative_surface: js/main.js
execution_mode: code_change
lane: planned
owned_files:
- js/main.js
---

# WP02: Fix GameScene Collision & Anti-Tunneling

## Branch Strategy

- **Planning base branch**: `main`
- **Merge target branch**: `main`
- **Implementation command**: `spec-kitty implement WP02 --base WP01`
- Note: WP02 depends on WP01 (player body standardization). The `--base WP01` flag ensures this WP branches from WP01's completed work.

## Objective

Fix obstacle collision in the GameScene (Rathauskeller dungeon levels), add tunneling mitigation to the Phaser physics engine, and verify all collision fixes across all scenes via manual playtesting. After this WP, the player must be blocked by all obstacles in dungeon rooms and cannot pass through any solid object in the entire game.

## Context

The GameScene is defined in `js/main.js` (~1529 lines). It generates dungeon rooms procedurally from room templates in `js/roomTemplates/`. Obstacles are placed dynamically into a static physics group. The player enters the Rathauskeller from HubSceneV2's rathaus entrance.

**Key code locations in `js/main.js`**:
- Physics config: lines 23-26 (`arcade: { gravity: { y: 0 }, debug: false }`)
- Player creation: `this.physics.add.sprite(...)` with `setCollideWorldBounds(true)`
- Obstacle group: `obstacles` static group
- Collider registration: lines 1469-1529 — `physics.add.collider(player, obstacles)`, plus enemy/projectile colliders
- Player speed in GameScene: 160 (lower than hub's 220)

**Room template system** (`js/roomTemplates/`):
- Templates define obstacle positions within rooms
- `roomManager.js` instantiates obstacles from templates into the `obstacles` static group
- Each obstacle is an invisible physics zone (similar to hub approach)

**Tunneling risk**: At speed 160 and 60fps, the player moves ~2.67px/frame. Thin obstacles (< 3px) could be skipped. Phaser's default `TILE_BIAS` is 16, which should be sufficient, but verify.

---

## Subtask T004: Fix GameScene Obstacle Colliders

**Purpose**: Ensure all obstacles spawned from room templates correctly block the player and enemies in dungeon levels.

**Steps**:

1. **Trace obstacle creation flow**:
   - Find where room templates are loaded (likely in `js/roomTemplates/` or a room manager)
   - Follow the code path from template data → obstacle physics body creation
   - Identify where obstacles are added to the `obstacles` static group

2. **Verify obstacle body setup**:
   - Each obstacle should be added as a static body: `this.physics.add.existing(obstacle, true)`
   - After sizing, `refreshBody()` should be called
   - Check that obstacles are added to the `obstacles` group BEFORE the collider is registered at lines 1469-1529
   - If obstacles are added dynamically (as rooms are generated), verify they still participate in collision

3. **Check wall/boundary obstacles**:
   - Room boundaries (walls) should be continuous — no gaps between adjacent wall segments
   - Door openings should be the only gaps
   - Verify wall thickness is sufficient (at least player body width)

4. **Check collider completeness** (lines 1469-1529):
   - `physics.add.collider(player, obstacles)` — player blocked by obstacles
   - `physics.add.collider(enemies, obstacles)` — enemies blocked by obstacles
   - `physics.add.collider(enemyProjectiles, obstacles)` — projectiles destroyed on impact
   - `physics.add.collider(playerProjectiles, obstacles)` — player projectiles destroyed
   - Verify all four are present and active

5. **Test with debug mode**: Enter the Rathauskeller from the hub and verify:
   - All wall segments have visible collision bodies
   - No gaps in room boundaries
   - Obstacle bodies align with visual obstacles (if any are visible)

**Files**: `js/main.js`, `js/roomTemplates/` (read-only reference)

**Validation**:
- [ ] All room walls block the player
- [ ] No gaps between wall segments
- [ ] Dynamic obstacle placement correctly registers with physics
- [ ] `refreshBody()` called for all static obstacle bodies
- [ ] Enemy collision with obstacles also works

---

## Subtask T005: Add Tunneling Mitigation

**Purpose**: Prevent the player from passing through thin obstacles at high velocity by adjusting physics engine settings.

**Steps**:

1. **Increase TILE_BIAS** in the physics world:
   - After scene creation (in `create()` method), add:
     ```javascript
     this.physics.world.TILE_BIAS = 24;  // Default is 16, increase for safety
     ```
   - This adds padding to collision checks, making them more robust against fast-moving bodies
   - Apply this in ALL scenes that have collision: HubScene, HubSceneV2, GameScene

   **Note**: Since TILE_BIAS is set on `this.physics.world`, it's per-scene. Set it in each scene's `create()` method.

   **IMPORTANT**: Only modify `js/main.js` (GameScene). WP01 handles the hub scenes.

2. **Add max velocity cap** on the player:
   - After player creation, set:
     ```javascript
     this.player.body.setMaxVelocity(220, 220);  // Cap at max intended speed
     ```
   - This prevents any code bug from accidentally setting velocity higher than intended
   - In GameScene, cap at 160 (the GameScene speed)

3. **Verify physics FPS**:
   - Current: `fps: 60` in physics config (line 25)
   - This means 60 physics updates per second — adequate for the speeds used
   - If issues persist, could increase to 120 but this doubles CPU cost — try other fixes first

4. **Test edge cases**:
   - Rapidly alternate direction keys while pressing against a wall
   - Move diagonally into corners where two walls meet
   - Hold movement key while transitioning between rooms

**Files**: `js/main.js`

**Validation**:
- [ ] TILE_BIAS set to 24 in GameScene's create() method
- [ ] Max velocity cap set on player
- [ ] No tunneling through walls at any speed
- [ ] No performance regression from TILE_BIAS increase
- [ ] Diagonal corner movement doesn't cause stuck/tunneling

---

## Subtask T006: Manual Playtesting & Debug Cleanup

**Purpose**: Verify all collision fixes work correctly across the entire game and clean up debug settings.

**Steps**:

1. **Playtest HubScene** (if accessible from scene selection):
   - Walk around all buildings from all 4 sides
   - Test diagonal movement against building corners
   - Verify NPC collision
   - Verify boundary walls (left, right, top)
   - Test entrance interaction zones still work

2. **Playtest HubSceneV2**:
   - Walk around all buildings: Rathaus, Archivschmiede, Druckerei, fountain, planters, benches
   - Test diagonal movement against all building corners
   - Verify rathaus entrance leads to GameScene
   - Verify all entrance prompts appear

3. **Playtest GameScene (Rathauskeller)**:
   - Enter from HubSceneV2
   - Walk through multiple dungeon rooms
   - Test wall collision in each room
   - Test obstacle collision
   - Test rapid direction changes while against walls
   - Verify enemy collision still works
   - Verify projectile-obstacle collision

4. **Disable debug mode**:
   - In `js/main.js`, set `debug: false` back in physics config
   - Verify game renders normally without green collision rectangles

5. **Final checks**:
   - Open browser console — verify no errors
   - Check FPS counter (should maintain 60fps)
   - Verify movement feel is unchanged (responsiveness, speed)

**Files**: `js/main.js` (debug flag only)

**Validation**:
- [ ] Player blocked by all solid objects in HubScene
- [ ] Player blocked by all solid objects in HubSceneV2
- [ ] Player blocked by all walls/obstacles in GameScene
- [ ] All 8 movement directions work in all scenes
- [ ] Rapid direction changes don't cause walkthrough
- [ ] Entrance/interaction zones still functional
- [ ] No console errors
- [ ] 60fps maintained
- [ ] `debug: false` in final code

---

## Definition of Done

- [ ] Player cannot pass through any solid object in any scene
- [ ] All 8 movement directions behave correctly everywhere
- [ ] No regression in movement feel (speed, responsiveness)
- [ ] No console errors
- [ ] 60fps on desktop browsers
- [ ] Debug mode disabled in committed code
- [ ] Tunneling mitigation active (TILE_BIAS, max velocity)

## Risks

| Risk | Mitigation |
|------|------------|
| TILE_BIAS too high causes player to get "stuck" at edges | Start with 24, reduce if sticking occurs; test thoroughly |
| Max velocity cap interferes with dash/sprint mechanics | Check if dash/sprint exists before capping; adjust cap value |
| Room template obstacles not compatible with refreshBody() | Test each room template type; fix template generation if needed |
| Performance regression from physics changes | Monitor FPS during playtest; revert TILE_BIAS if FPS drops |

## Reviewer Guidance

- Play through the game from start (hub → rathaus entrance → dungeon) testing collision at every step
- Focus on corners and edges — these are where collision fails most
- Try to "wiggle through" obstacles by rapidly alternating directions
- Check that enemy AI isn't broken by obstacle collision changes
- Verify projectiles still destroy on wall impact
