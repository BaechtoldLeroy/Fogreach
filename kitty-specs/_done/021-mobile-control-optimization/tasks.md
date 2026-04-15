# Tasks Outline — Mobile Control Optimization

**Feature**: `021-mobile-control-optimization`
**Target branch**: `main` (direct-to-target, no worktrees)
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

## Work Package Graph

```
WP01 (Layout + safe-area)
  ├── WP02 (Ability icons/labels)
  ├── WP03 (Floating analog joystick)
  ├── WP04 (Auto-attack targeting)
  └── WP05 (Haptics + Mobile settings)
```

WP02, WP03, WP04, WP05 are independent of one another and can be implemented in any order once WP01 lands. They all depend on the shared layout & settings scaffolding introduced in WP01.

## Work Packages

### WP01 — Responsive layout + safe-area + hit targets
**Covers**: FR-001, FR-002, FR-003, FR-004
**Size**: M (~1 day)
**Depends on**: —

Establish the layout foundation every other WP builds on.

Subtasks:
1. Add `js/mobileSafeArea.js` with a `readSafeArea()` helper (hidden CSS probe element) that returns `{top, right, bottom, left}` in CSS px. Cache into `window.__SAFE_AREA__`.
2. Refactor `initControls()` ability-button positioning from hard-coded negative offsets into a declarative grid (columns × rows, anchored bottom-right, padded by safe-area + `buttonScale`).
3. Introduce a 44×44 minimum interactive hit-rect on each ability button while keeping the visual circle radius unchanged.
4. Re-position inventory button to respect top-safe-area.
5. Read `buttonScale` from `window.__MOBILE_BUTTON_SCALE__` (default 1.0) and scale both visual radius and hit-rect accordingly.
6. Verify layout in portrait (iPhone 14 Pro) and landscape (Pixel 7) — no overlap with home indicator, no clipped buttons.

Acceptance:
- All ability buttons still fire the correct function.
- Nothing overlaps safe-area zones on a notched device.
- Tap-miss rate (subjective smoke test with thumb) noticeably down vs main.

### WP02 — Ability icons + labels + legible cooldown
**Covers**: FR-005, FR-006, FR-007
**Size**: M (~½ day)
**Depends on**: WP01

Subtasks:
1. Inventory existing ability icons in `graphics.js` / ability panel and map `abilityKey → iconTexture`.
2. In `initControls()`, add an icon `Image` + short text label (`1–2` chars) inside each ability button container.
3. Give the cooldown text a stroke + shadow so it stays legible over any button color.
4. Add a disabled visual state (desaturate + reduced alpha) while the ability is on cooldown or lacks resources.
5. Ensure labels don't exceed the button diameter at the smallest `buttonScale` (0.8).

Acceptance: a new player can identify every ability without reading docs.

### WP03 — Floating analog joystick with dead zone
**Covers**: FR-008, FR-009, FR-010
**Size**: M (~1 day)
**Depends on**: WP01

Subtasks:
1. Register a `pointerdown` handler on the left half of the screen (excluding the top inventory row and the bottom safe-area). On touch, call `joystick.setPosition(x, y)` and `.setVisible(true)`.
2. On `pointerup`/`pointerupoutside`, hide the joystick.
3. Update `handleMobileMovement()` to multiply `effectiveSpeed` by `force`, after applying the `deadZone` threshold (zero below).
4. Read `deadZone` from `window.__MOBILE_DEAD_ZONE__` (default 0.15).
5. Guard against the joystick spawning under an active ability button (right half).

Acceptance: gentle thumb-rest does not drift; full deflection moves at max speed; joystick appears under the thumb wherever it lands on the left half.

### WP04 — Auto-attack targeting assist
**Covers**: FR-011, FR-012
**Size**: S (~½ day)
**Depends on**: WP01

Subtasks:
1. Add `js/mobileAutoAim.js` with `findNearestEnemy(player, maxRange)` returning `{enemy, dx, dy}` or null.
2. In the attack button's `pointerdown` handler, if `isMobile && window.__MOBILE_AUTO_AIM__` and `joystick.force < deadZone`, set `lastMoveDirection` toward the nearest enemy within `meleeRange + 16px` before calling `attack()`.
3. No behavior change when joystick is deflected or on desktop.

Acceptance: stationary attack on mobile swings toward the nearest mob; moving-attack behavior unchanged.

### WP05 — Haptics + Mobile settings section
**Covers**: FR-013, FR-014, FR-015
**Size**: M (~½ day)
**Depends on**: WP01

Subtasks:
1. Add `js/haptics.js` with `tap()`, `hit()`, `damage()`, `levelUp()` wrapping `navigator.vibrate()`. No-op when unsupported or setting is OFF.
2. Wire `tap()` into each ability button's `pointerdown`; `hit()` into the player-attack-connects code path; `damage()` into the player-takes-damage code path; `levelUp()` into the level-up event.
3. Extend `SettingsScene.DEFAULTS` with the `mobile` block from the data model; extend `applySettings()` to populate the four `window.__MOBILE_*` globals.
4. Render a new **"MOBILE"** section in `SettingsScene` — only when `isMobile` — with rows for: dead zone (slider), haptics (toggle), auto-aim (toggle), button scale (3-option picker).
5. Verify settings persist across reload.

Acceptance: every setting toggles its behavior live; nothing renders on desktop.

## Sizing & parallelism

Total: 5 WPs, ~3.5 dev-days if serialized. WP02–WP05 can be parallelized once WP01 is merged.

## Out of scope

- Desktop control changes.
- New abilities or ability rebalancing.
- Controller/gamepad support.
