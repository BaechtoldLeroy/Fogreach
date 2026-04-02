# Implementation Plan: Fix Player Collision
*Path: kitty-specs/001-fix-player-collision/plan.md*

**Branch**: `main` | **Date**: 2026-04-03 | **Spec**: [kitty-specs/001-fix-player-collision/spec.md](spec.md)
**Input**: Feature specification from `kitty-specs/001-fix-player-collision/spec.md`

## Summary

Fix player collision across all three gameplay areas (HubScene, HubSceneV2, GameScene/Rathauskeller) so the player is correctly blocked by all solid physics zones in all 8 movement directions. The root cause is likely a combination of body-sizing mismatches, missing colliders, and/or velocity exceeding physics resolution at 60fps. No tilemaps are involved — all collision uses invisible Arcade Physics zones and static groups.

## Technical Context

**Language/Version**: JavaScript (ES6+)
**Primary Dependencies**: Phaser 3 (Arcade Physics)
**Storage**: N/A
**Testing**: Manual playtesting only (proof-of-concept mode)
**Target Platform**: Desktop browsers (Edge)
**Project Type**: Single project — browser-based static deployment
**Performance Goals**: 60fps, no memory leaks
**Constraints**: No build tools, no server, repo-local tooling only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No formal tests required | PASS | Manual playtesting per constitution |
| No console errors | PASS | Will verify during playtest |
| No regressions in existing scenes | PASS | All 3 scenes tested after fix |
| 60fps maintained | PASS | Collision fix should not impact perf |
| Edge desktop compatible | PASS | Standard Phaser Arcade Physics |

No violations. No complexity justification needed.

## Affected Areas

### 1. HubScene.js (`js/scenes/HubScene.js`)
- **Collision system**: `buildingGroup` (staticGroup), `npcGroup` (immovable group)
- **Colliders**: `physics.add.collider(player, buildingGroup)` + `physics.add.collider(player, npcGroup)`
- **Building colliders**: Invisible zones created at building positions with `setSize(scaledW, scaledH)`
- **NPC bodies**: 30x36px hitbox, immovable, not pushable
- **Boundary walls**: Left, right, top zones added to buildingGroup

### 2. HubSceneV2.js (`js/scenes/HubSceneV2.js`)
- **Collision system**: `colliderGroup` (staticGroup) from `HUB_HITBOXES` data
- **Colliders**: `physics.add.collider(player, colliderGroup)`
- **Hitboxes**: Scaled by `SCALE_FACTOR = 1536/960` from base coordinates
- **Entrances**: Separate overlap detection via `Phaser.Geom.Rectangle.Overlaps()`

### 3. GameScene / Rathauskeller (`js/main.js`)
- **Collision system**: `obstacles` (staticGroup), `enemies` (dynamic group)
- **Colliders**: `physics.add.collider(player, obstacles)` + `physics.add.collider(player, enemies)`
- **Obstacles**: Dynamically placed from room templates (`js/roomTemplates/`)
- **Additional**: Projectile-obstacle and enemy-obstacle colliders

### 4. Shared Movement Code (`js/player.js`)
- **Movement**: `handlePlayerMovement()` (line 682-707) — cursor keys → normalized velocity
- **Speed**: `playerSpeed` variable (160 in GameScene, 220 in Hub)
- **Diagonal normalization**: `Math.hypot()` used correctly

## Project Structure

### Documentation (this feature)

```
kitty-specs/001-fix-player-collision/
├── plan.md              # This file
├── research.md          # Phase 0 output
└── tasks.md             # Phase 2 output (NOT created by /spec-kitty.plan)
```

### Source Code (affected files)

```
js/
├── main.js              # GameScene (Rathauskeller dungeons) — colliders at lines 1469-1529
├── player.js            # Shared movement logic — handlePlayerMovement() at lines 682-707
└── scenes/
    ├── HubScene.js      # Hub v1 — buildingGroup/npcGroup colliders at lines 201-203
    └── HubSceneV2.js    # Hub v2 — colliderGroup from HUB_HITBOXES at lines 116-158
```

## Investigation Plan

### Step 1: Enable Debug Visualization
- Set `debug: true` in `main.js` physics config to see all collision bodies
- Verify that collision bodies align with visual sprites/buildings in all 3 scenes

### Step 2: Diagnose Root Causes
Likely causes to check (in priority order):

1. **Player body size/offset mismatch** — Player physics body may be smaller than visual sprite, or offset incorrectly, allowing edges to pass through thin collision zones
2. **Tunneling at high velocity** — At speed 220 (Hub) the player may move >1 body-width per frame, skipping collision detection entirely. Phaser Arcade default `tileBias` may need adjustment
3. **Missing or misaligned collider zones** — Some buildings/obstacles may lack colliders or have zones offset from their visual position
4. **Static body refresh** — After zone creation, `refreshBody()` may not be called, leaving stale collision data
5. **Collision group registration** — Objects may be added to groups after collider is registered

### Step 3: Apply Fixes
- Adjust player body size and offset to match visual footprint
- If tunneling: reduce max velocity or enable `physics.world.TILE_BIAS` increase
- Audit all collision zones in each scene for alignment
- Ensure `refreshBody()` is called after static body modifications

### Step 4: Verify
- Manual playtesting in all 3 areas
- Test all 8 directions + diagonal movement
- Test rapid direction changes
- Confirm no regression in movement feel
- Confirm 60fps maintained
- Confirm no console errors
