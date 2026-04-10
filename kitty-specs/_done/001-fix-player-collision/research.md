# Research: Fix Player Collision

**Feature**: 001-fix-player-collision
**Date**: 2026-04-03

## Research Findings

### 1. Phaser 3 Arcade Physics — Tunneling Problem

**Decision**: Check and mitigate tunneling (objects passing through thin barriers at high speed)

**Rationale**: Phaser Arcade Physics uses discrete collision detection — it checks overlap at each frame. If velocity * deltaTime > body width, the player can skip over a collision zone entirely. At speed 220 and 60fps, the player moves ~3.67px/frame. If collision zones or the player body are thin, tunneling occurs.

**Mitigation options**:
- Increase `TILE_BIAS` (default 16) — adds padding to collision checks
- Ensure collision zones are thick enough (minimum: player speed / 60)
- Reduce player speed if bodies are unavoidably thin
- Use `body.setMaxVelocity()` as a safety cap

**Alternatives considered**:
- Matter.js physics (continuous detection) — overkill for this project, would require full physics rewrite
- Custom raycasting — too complex for proof-of-concept

### 2. Player Body Configuration

**Decision**: Audit and standardize player physics body across all scenes

**Rationale**: The player sprite is created with `this.physics.add.sprite()` but body size/offset may not be explicitly set in all scenes. Phaser defaults the body to the full sprite frame size, which may not match the visual character footprint.

**Best practice**:
- Set explicit `body.setSize(w, h)` matching the character's walkable footprint (not full sprite with head/hat)
- Set `body.setOffset(x, y)` to center the body on the character's feet
- Use the same body dimensions across all scenes for consistent collision feel

### 3. Static Body Refresh

**Decision**: Ensure `refreshBody()` is called after modifying static bodies

**Rationale**: When a static physics body is created via `this.physics.add.existing(zone, true)` and then modified with `setSize()`, the internal collision data may not update. Calling `refreshBody()` forces Phaser to recalculate the body bounds.

**Applies to**: HubScene buildingGroup zones, HubSceneV2 colliderGroup zones

### 4. Collider Registration Order

**Decision**: Verify colliders are registered after all bodies are added to groups

**Rationale**: If `physics.add.collider(player, group)` is called before all members are added to the group, late-added members may not participate in collision. Phaser handles this dynamically for most cases, but static groups may behave differently if bodies aren't refreshed.

### 5. Debug Visualization

**Decision**: Use `debug: true` as primary diagnostic tool

**Rationale**: Setting `arcade: { debug: true }` in game config renders all physics bodies as colored rectangles. This instantly reveals:
- Misaligned bodies (body not matching visual position)
- Missing bodies (no rectangle where expected)
- Oversized/undersized bodies
- Body offset issues

**Implementation**: Change `debug: false` to `debug: true` in `js/main.js` line 26. Remember to revert before release.
