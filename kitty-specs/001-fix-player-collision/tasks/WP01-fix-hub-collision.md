---
work_package_id: WP01
title: Fix Hub Collision
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: ddc6106bcae3624089d572d7dca8e37bf6293fee
created_at: '2026-04-02T22:30:24.845457+00:00'
subtasks: [T001, T002, T003]
shell_pid: "30356"
history:
- timestamp: '2026-04-02T22:24:34Z'
  action: created
  by: spec-kitty.tasks
authoritative_surface: js/scenes/
execution_mode: code_change
lane: planned
owned_files:
- js/player.js
- js/scenes/HubScene.js
- js/scenes/HubSceneV2.js
---

# WP01: Fix Hub Collision

## Branch Strategy

- **Planning base branch**: `main`
- **Merge target branch**: `main`
- **Implementation command**: `spec-kitty implement WP01`
- Note: The actual `base_branch` may differ for stacked WPs during `/spec-kitty.implement`

## Objective

Standardize the player physics body configuration and fix all collision zones in both hub scenes (HubScene.js and HubSceneV2.js). After this WP, the player must be correctly blocked by all buildings, NPCs, and boundary walls in the hub world.

## Context

This is a Phaser 3 browser-based action RPG using Arcade Physics (no gravity, top-down). Collision is handled entirely through invisible physics zones — there are no tilemaps. The player walks through solid objects due to likely body-sizing mismatches, missing `refreshBody()` calls, or zone misalignment.

**Key files**:
- `js/player.js` — Shared player creation and movement logic. `handlePlayerMovement()` at lines 682-707.
- `js/scenes/HubScene.js` (~2772 lines) — Hub v1. Player created at line 104. Building colliders via `buildingGroup` (staticGroup) at lines 121-203. NPC bodies at lines 870-876. Boundary walls at lines 469-479.
- `js/scenes/HubSceneV2.js` (~842 lines) — Hub v2. Uses `HUB_HITBOXES` data structure scaled by `SCALE_FACTOR = 1536/960`. Collider group at lines 116-158.

**Physics config** (in `js/main.js` lines 23-26):
```javascript
physics: {
  default: 'arcade',
  fps: 60,
  arcade: { gravity: { y: 0 }, debug: false }
}
```

**Player speed**: 220 in hub scenes (from global `playerSpeed` variable).

---

## Subtask T001: Standardize Player Physics Body Size/Offset

**Purpose**: Ensure the player's physics body matches the character's visual walkable footprint consistently across all scenes. A body that's too large causes the player to collide with invisible walls; too small allows walking through obstacles.

**Steps**:

1. **Enable debug mode temporarily** to visualize the current player body:
   - In `js/main.js`, change `debug: false` to `debug: true` in the arcade physics config (line 26)
   - This renders green rectangles for all physics bodies — observe the player body relative to the sprite

2. **Find where the player sprite is created** in each scene:
   - `HubScene.js` line 104: `this.player = this.physics.add.sprite(1024, 612, textureKey, 0)`
   - `HubSceneV2.js`: Similar pattern — search for `this.physics.add.sprite` or `this.player`
   - Check if `body.setSize()` and `body.setOffset()` are called after creation

3. **Set explicit body dimensions** matching the character's walkable footprint:
   - The character sprite is likely larger than the collision area (includes head, hat, weapon)
   - Set the body to roughly the character's torso/feet area
   - Example (adjust based on actual sprite dimensions):
     ```javascript
     this.player.body.setSize(20, 24);  // Width, height of collision box
     this.player.body.setOffset(
       (this.player.width - 20) / 2,    // Center horizontally
       this.player.height - 24           // Align to feet
     );
     ```
   - The exact values depend on the sprite frame size — check the spritesheet to determine the right proportions

4. **Apply the same body dimensions in all scenes** where the player is created. If player creation is centralized in `player.js`, modify it there. If each scene creates its own player, ensure consistency.

5. **Also check `setCollideWorldBounds(true)`** is present in all scenes.

**Files**: `js/player.js`, `js/scenes/HubScene.js`, `js/scenes/HubSceneV2.js`

**Validation**:
- [ ] Player body (green debug rect) is centered on character's feet/torso
- [ ] Body does not extend beyond the visual character boundaries
- [ ] Same body size used in HubScene, HubSceneV2, and GameScene
- [ ] Player cannot walk outside world bounds

---

## Subtask T002: Fix HubScene.js Collision Zones

**Purpose**: Audit and fix all collision zones in HubScene.js so buildings, NPCs, and boundaries correctly block the player.

**Steps**:

1. **Audit building colliders** (created in building spawn methods):
   - Look for `this.buildingGroup.create(...)` calls followed by `setSize()`
   - Line 638-639: Standard building colliders — verify `baseX, baseY` alignment
   - Line 754-759: Archivschmiede custom collider (12px narrower, 28px shorter)
   - **Check**: After `setSize()`, is `refreshBody()` called? If not, add it:
     ```javascript
     collider.setSize(scaledW, scaledH).setVisible(false);
     collider.refreshBody();  // IMPORTANT: recalculate collision bounds
     ```

2. **Audit boundary walls** (lines 469-479):
   - Left, right, top zones added via `this.physics.add.existing(zone, true)`
   - Verify zone positions cover the intended boundaries
   - Check that zones are added to `buildingGroup` so the player collider applies

3. **Audit NPC collision bodies** (lines 870-876):
   - NPCs have 30x36px hitbox, immovable, not pushable
   - Verify `setImmovable(true)` and `setPushable(false)` are actually working
   - Check that `this.physics.add.collider(this.player, this.npcGroup)` is registered (line 202)

4. **Check collider registration order**:
   - Verify `this.physics.add.collider(this.player, this.buildingGroup)` (line 201) is called AFTER all buildings are added to the group
   - If buildings are added dynamically after collider registration, this should still work in Phaser but verify

5. **Test with debug mode**: With `debug: true`, walk the player around all buildings and verify:
   - Green rectangles align with visual building positions
   - No gaps between adjacent colliders
   - Player body stops at collider edges

**Files**: `js/scenes/HubScene.js`

**Validation**:
- [ ] All buildings have visible debug collision boxes aligned to their visuals
- [ ] Boundary walls fully cover left, right, and top edges
- [ ] NPCs are immovable and block the player
- [ ] `refreshBody()` called after all static body size modifications
- [ ] No gaps in collision coverage

---

## Subtask T003: Fix HubSceneV2.js Collider Zones

**Purpose**: Audit and fix the zone-based hitbox collision system in HubSceneV2.js.

**Steps**:

1. **Audit HUB_HITBOXES data** at the top of HubSceneV2.js:
   - Check that all buildings have hitbox entries: `rathaus_body`, `rathaus_steps`, `fountain`, `planters`, `benches`, `archivschmiede_body`, `druckerei_body`
   - Verify x, y, w, h values match the visual building positions at base resolution (960px)
   - Look for any buildings visible on screen that DON'T have hitbox entries — these would be walkthrough bugs

2. **Verify scaling** (line 60: `SCALE_FACTOR = 1536 / 960`):
   - In `createColliders()` method (lines 116-199):
     ```javascript
     const sx = c.x * SCALE_FACTOR;
     const sy = c.y * SCALE_FACTOR;
     const sw = c.w * SCALE_FACTOR;
     const sh = c.h * SCALE_FACTOR;
     ```
   - Verify that zone creation uses scaled values correctly
   - Zone position should be center: `sx + sw/2, sy + sh/2`

3. **Check zone physics setup**:
   - After `this.add.zone(...)`, verify `this.physics.add.existing(zone, true)` is called (true = static body)
   - After adding to `colliderGroup`, call `zone.body.refreshBody()` if not already done
   - Verify `this.physics.add.collider(this.player, this.colliderGroup)` is registered

4. **Check entrance overlap zones** (lines 14-18):
   - Entrance zones use `Phaser.Geom.Rectangle.Overlaps()` (line 329) for interaction detection
   - After fixing collision zones, verify entrance detection still works — the player body change from T001 may affect overlap area

5. **Test with debug mode**: Verify all hitbox zones render as colored rectangles aligned with buildings.

**Files**: `js/scenes/HubSceneV2.js`

**Validation**:
- [ ] Every visible building has a corresponding hitbox in HUB_HITBOXES
- [ ] Scaled zone positions/sizes match visual building positions
- [ ] `refreshBody()` called after zone creation
- [ ] Entrance overlap detection still triggers correctly
- [ ] No walkthrough at any building edge

---

## Definition of Done

- [ ] Player is blocked by ALL buildings, NPCs, and boundaries in HubScene
- [ ] Player is blocked by ALL hitbox zones in HubSceneV2
- [ ] All 8 movement directions work correctly (up, down, left, right, 4 diagonals)
- [ ] Entrance/interaction zones still trigger when approaching doors
- [ ] No console errors
- [ ] Movement feel is unchanged (same speed, same responsiveness)
- [ ] Debug mode can be toggled for future debugging

## Risks

| Risk | Mitigation |
|------|------------|
| Changing player body size breaks entrance overlap detection | Test entrance zones after body change; adjust overlap zone sizes if needed |
| refreshBody() calls cause performance regression | Minimal impact — only called once at scene creation, not per frame |
| HUB_HITBOXES data incorrect at base resolution | Use debug mode to visually verify; adjust values empirically |

## Reviewer Guidance

- Enable `debug: true` in physics config and walk around the entire hub
- Try to walk through each building from all 4 sides
- Try diagonal movement against building corners
- Verify entrance prompts still appear at doors
- Check for "stuck" spots where player can't escape collision zones

## Activity Log

- 2026-04-02T22:36:55Z – unknown – shell_pid=30356 – lane=done – Done override: Implemented in worktree, pending merge
