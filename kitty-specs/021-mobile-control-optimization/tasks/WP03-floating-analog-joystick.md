---
work_package_id: WP03
title: Floating analog joystick with dead zone
dependencies: []
requirement_refs: [FR-008, FR-009, FR-010]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T001, T002, T003, T004]
history:
- action: created
  agent: claude
  utc: '2026-04-15T14:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/mobileJoystick.js
- js/player.js
---

# WP03 — Floating analog joystick with dead zone

## Objective

Replace the fixed-position joystick with a floating one that spawns under the player's thumb on the left half of the screen, with analog force output and a configurable dead zone. Existing `rexVirtualJoystick` plugin is reused.

## Context

Current state (`js/main.js:1978-1986` and `js/player.js:handleMobileMovement`):
- Joystick is fixed at `(100, height-100)`.
- Movement is binary: `force > 0 ? fullSpeed : 0`.

WP01 reserves the left-pointer region via `getLeftPointerRegion()` and emits `demonfall:mobile-layout-ready`. This WP listens there and sets up the floating behavior.

## Subtasks

### T001 — Replace fixed joystick creation with floating setup

**Purpose**: Joystick hidden until first touch on the left region.

**Steps**:
1. In `mobileJoystick.js`, listen for `demonfall:mobile-layout-ready`. Read `joystickSlot` (the rex instance created by WP01) and call `joystickSlot.setVisible(false)` initially.
2. Register `scene.input.on('pointerdown', handleDown)` and `scene.input.on('pointerup', handleUp)` (plus `pointerupoutside`).
3. In `handleDown(pointer)`: if pointer is inside `getLeftPointerRegion()` and not on an ability button, `joystickSlot.setPosition(pointer.x, pointer.y); joystickSlot.setVisible(true);`. Store the pointer id in module state.
4. In `handleUp(pointer)`: if pointer id matches stored id, `joystickSlot.setVisible(false);` and clear state.

**Files**: `js/mobileJoystick.js` (new, ~120 lines).

**Validation**: Tapping anywhere in the left half spawns the joystick base there; releasing hides it.

### T002 — Guard against overlap with right-side ability cluster

**Purpose**: FR-010 — joystick never under an ability button.

**Steps**:
1. In `handleDown`, before accepting the touch, check the pointer is NOT inside any ability-button hit rect. Use `mobileControls.getAbilityButtonHitRects()` (WP01 exports this).
2. Also exclude the top inventory-button rect and top safe-area band (already excluded by the left-pointer region, but reinforce here).

**Files**: `js/mobileJoystick.js`.

**Validation**: Touching an ability button never spawns a joystick base over it.

### T003 — Analog speed in `handleMobileMovement`

**Purpose**: FR-009 — force drives speed continuously, with dead zone.

**Steps**:
1. In `js/player.js:handleMobileMovement`, replace:
   ```js
   if (force > 0) { vx = cos*effectiveSpeed; vy = sin*effectiveSpeed; }
   ```
   with:
   ```js
   const deadZone = window.__MOBILE_DEAD_ZONE__ || 0.15;
   if (force > deadZone) {
     const t = (force - deadZone) / (1 - deadZone); // 0..1 after dead zone
     vx = Math.cos(rad) * effectiveSpeed * t;
     vy = Math.sin(rad) * effectiveSpeed * t;
   }
   ```
2. Keep the existing animation + direction bookkeeping.
3. Stun/dash handling unchanged.

**Files**: `js/player.js`.

**Validation**: A thumb resting at center produces zero velocity; partial deflection produces proportionally slower movement.

### T004 — Smoothing compatibility

**Purpose**: Ensure the D2-feel weight slider still works with the new analog input.

**Steps**:
1. The existing `_applySmoothedVelocity()` runs on `targetVx`/`targetVy` after speed scaling — no logic change needed.
2. Verify in emulation that combined dead-zone + weight produces no drift and no jitter.
3. Add a comment linking to this WP in `handleMobileMovement`.

**Files**: `js/player.js`.

**Validation**: With `movementWeight = 0` and `deadZone = 0.15`, small thumb wiggles produce no movement. With `movementWeight = 1.0` and a full-rim deflection, player accelerates smoothly to max speed over ~180 ms.

## Definition of Done

- Floating joystick spawns under any left-half tap, respecting safe-area and ability-button rects.
- Force drives speed proportionally after the dead zone.
- Existing weight/smoothing slider interoperates correctly.
- No regression on desktop.

## Risks

- `rexVirtualJoystick` may not support `.setPosition()` on the fly on all versions — verify in T001 early. Fallback: destroy and re-create the joystick on touch.
- Pointer-id handling on multi-touch (e.g. thumb on joystick + finger on ability button simultaneously) must not cross-cancel.

## Reviewer guidance

- Minimal edit to `player.js` — only the one `if` block in `handleMobileMovement`.
- Everything else in new `mobileJoystick.js`.

## Implementation command

```
spec-kitty implement WP03 --base WP01
```
