---
work_package_id: WP04
title: Auto-attack targeting assist
dependencies: []
requirement_refs: [FR-011, FR-012]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 021-mobile-control-optimization-WP01
base_commit: bef362b3c0a28afa183be4e518751b03b1b737b6
created_at: '2026-04-15T20:03:47.320684+00:00'
subtasks: [T001, T002, T003]
shell_pid: "57612"
history:
- action: created
  agent: claude
  utc: '2026-04-15T14:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/mobileAutoAim.js
---

# WP04 — Auto-attack targeting assist

## Objective

Make melee-only play viable one-thumb: when the joystick is at rest and `autoAim` is enabled, the attack button swings toward the nearest enemy within melee range. When the joystick is deflected or `autoAim` is off, behavior is unchanged.

## Context

The attack button's `pointerdown` already lives in WP01's `mobileControls.js` and dispatches `demonfall:ability-tap`. This WP hooks the same event (or a dedicated pre-attack hook) and mutates `lastMoveDirection` before the existing `attack()` function runs.

WP01 exports a helper `setLastMoveDirection(dx, dy)` from mobileControls that this WP can call. If missing, use `window.lastMoveDirection` directly (it's a `Phaser.Math.Vector2` defined globally in `player.js`).

## Subtasks

### T001 — Nearest-enemy lookup

**Purpose**: Pure function returning the closest enemy to the player.

**Steps**:
1. In `js/mobileAutoAim.js`, export `findNearestEnemy(player, maxRange)`:
   ```js
   function findNearestEnemy(player, maxRange) {
     if (!window.enemies || !window.enemies.children) return null;
     let best = null, bestDistSq = maxRange * maxRange;
     window.enemies.children.iterate((e) => {
       if (!e || !e.active || !e.body) return;
       const dx = e.x - player.x;
       const dy = e.y - player.y;
       const d2 = dx*dx + dy*dy;
       if (d2 < bestDistSq) { best = {enemy:e, dx, dy, dist:Math.sqrt(d2)}; bestDistSq = d2; }
     });
     return best;
   }
   ```
2. Export `computeAutoAimRange()` returning `meleeRange + 16` (read melee range from wherever `attack()` reads it — grep for it; likely `playerAttackRange` or similar).

**Files**: `js/mobileAutoAim.js` (new, ~80 lines).

**Validation**: Manual test: in a room with 3 enemies, call `findNearestEnemy(player, 200)` from console — returns the closest.

### T002 — Hook into attack-button press

**Purpose**: Face the nearest enemy before the attack swing fires.

**Steps**:
1. Register a listener for `demonfall:ability-tap` on the window object.
2. When `event.detail.ability === 'attack'` AND `window.__MOBILE_AUTO_AIM__` AND `isMobile`:
   - Read current joystick force. If `force > (window.__MOBILE_DEAD_ZONE__ || 0.15)`, skip auto-aim (FR-012).
   - Otherwise, call `findNearestEnemy(player, computeAutoAimRange())`. If non-null, normalize `(dx, dy)` and write to `lastMoveDirection`.
3. Do this BEFORE `attack()` runs. Use event-listener ordering: WP01's button dispatches the event and THEN calls `attack()`. Document this ordering in WP01's prompt — if not guaranteed, WP01 must dispatch the event first.

**Files**: `js/mobileAutoAim.js`.

**Validation**: Stand next to an enemy without pressing the joystick, tap attack — character faces the enemy and swings at it.

### T003 — Settings gating

**Purpose**: Respect the auto-aim toggle.

**Steps**:
1. Read `window.__MOBILE_AUTO_AIM__` (default `true`) at every tap. WP05 populates this from SettingsScene.
2. If `false`, do nothing (attack proceeds in whatever direction the player is already facing).

**Files**: `js/mobileAutoAim.js`.

**Validation**: Toggling the setting changes the behavior live (after a scene restart is acceptable if live-toggle is tricky).

## Definition of Done

- Stationary mobile attack auto-faces the nearest enemy within melee range.
- Attacking while moving does NOT override the joystick direction.
- Toggling the setting disables the behavior.
- Desktop control path untouched.

## Risks

- Ordering dependency on WP01 (event dispatched BEFORE `attack()` runs). Confirm in WP01 review.
- `window.enemies` global assumed to be the active enemy group — verify via grep.

## Reviewer guidance

- One new file. No cross-file edits.
- The listener must clean itself up on scene shutdown to avoid leaks on re-enter.

## Implementation command

```
spec-kitty implement WP04 --base WP01
```

## Activity Log

- 2026-04-15T20:05:04Z – unknown – shell_pid=57612 – lane=for_review – WP04 complete: nearest-enemy auto-aim on stationary attack.
- 2026-04-15T20:10:11Z – unknown – shell_pid=57612 – lane=approved – self-review: syntax pass, matches spec
