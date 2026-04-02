# Tasks: Fix Player Collision

**Feature**: 001-fix-player-collision
**Date**: 2026-04-03
**Branch**: `main` → `main`

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|-----|----------|
| T001 | Standardize player physics body size/offset across all scenes | WP01 | |
| T002 | Fix HubScene.js collision zones (buildings, NPCs, boundaries) | WP01 | [P] |
| T003 | Fix HubSceneV2.js collider zones (HUB_HITBOXES scaling, refreshBody) | WP01 | [P] |
| T004 | Fix GameScene obstacle colliders from room templates | WP02 | |
| T005 | Add tunneling mitigation (TILE_BIAS, max velocity) | WP02 | [P] |
| T006 | Manual playtesting & debug cleanup across all scenes | WP02 | |

## Work Packages

### WP01: Fix Hub Collision

**Priority**: High (foundational — player body fix affects all scenes)
**Dependencies**: None
**Estimated prompt size**: ~350 lines
**Prompt file**: [WP01-fix-hub-collision.md](tasks/WP01-fix-hub-collision.md)

**Goal**: Standardize the player physics body and fix all collision zones in both hub scenes (HubScene.js and HubSceneV2.js) so the player is correctly blocked by buildings, NPCs, and boundaries.

**Included subtasks**:
- [ ] T001: Standardize player physics body size/offset across all scenes
- [ ] T002: Fix HubScene.js collision zones (buildings, NPCs, boundaries)
- [ ] T003: Fix HubSceneV2.js collider zones (HUB_HITBOXES scaling, refreshBody)

**Implementation sketch**:
1. Enable debug mode to visualize current collision bodies
2. Set explicit player body size/offset in player creation code
3. Audit all building collider zones in HubScene for alignment
4. Audit HUB_HITBOXES data and zone creation in HubSceneV2
5. Ensure `refreshBody()` called after static body modifications
6. Verify NPC collision bodies are correctly sized and immovable

**Parallel opportunities**: T002 and T003 modify different files and can be done in parallel after T001.

**Risks**: Changing player body size may affect entrance overlap detection — verify entrance zones still trigger correctly.

---

### WP02: Fix GameScene Collision & Anti-Tunneling

**Priority**: High
**Dependencies**: WP01 (player body standardization must be done first)
**Estimated prompt size**: ~300 lines
**Prompt file**: [WP02-fix-gamescene-collision.md](tasks/WP02-fix-gamescene-collision.md)

**Goal**: Fix obstacle collision in the GameScene (Rathauskeller dungeons), add tunneling mitigation to the physics engine, and verify all fixes via manual playtesting.

**Included subtasks**:
- [ ] T004: Fix GameScene obstacle colliders from room templates
- [ ] T005: Add tunneling mitigation (TILE_BIAS, max velocity)
- [ ] T006: Manual playtesting & debug cleanup across all scenes

**Implementation sketch**:
1. Audit obstacle group creation in GameScene (main.js lines 1469-1529)
2. Verify room template obstacles are correctly added to static group
3. Increase `TILE_BIAS` in physics world config to prevent tunneling
4. Add `setMaxVelocity()` as safety cap on player movement
5. Playtest all 3 areas: HubScene, HubSceneV2, GameScene/Rathauskeller
6. Disable debug mode after verification

**Parallel opportunities**: T004 and T005 can be done in parallel (different code sections).

**Risks**: TILE_BIAS increase could cause player to get stuck at edges — test with various values.
