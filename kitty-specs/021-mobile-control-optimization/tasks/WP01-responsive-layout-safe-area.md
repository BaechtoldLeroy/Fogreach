---
work_package_id: WP01
title: Responsive layout + safe-area + hit targets
dependencies: []
requirement_refs: [FR-001, FR-002, FR-003, FR-004]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 4844c747a2f54aa54ac24f6f3fbd85e2855e7bb6
created_at: '2026-04-15T15:15:32.427524+00:00'
subtasks: [T001, T002, T003, T004, T005, T006]
shell_pid: "71152"
history:
- action: created
  agent: claude
  utc: '2026-04-15T14:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/mobileSafeArea.js
- js/mobileControls.js
- js/main.js
---

# WP01 — Responsive layout + safe-area + hit targets

## Objective

Establish a clean layout foundation for the mobile control cluster: safe-area-aware button positions, 44×44 minimum hit targets, responsive to `buttonScale`, and extracted from the current ad-hoc offsets in `initControls()` into a single maintainable module. Every downstream WP (icons, joystick, auto-aim, haptics) plugs into this scaffold.

## Context

Current state (`js/main.js:1966-2082`):
- `initControls()` runs a 100-line block of hand-positioned `add.circle()` calls at hardcoded negative offsets from the screen corner.
- No safe-area awareness — iPhone home indicator overlaps the bottom row of buttons.
- Visual radius (34 or 40 px) equals the interactive hit area; missed taps are common.
- No per-device scaling — small phones cut off the leftmost ability.

Design decisions (see `research.md`):
- Floating-joystick rework lives in WP03, but the left-half pointer region must be reserved here so WP03 can attach.
- Icon + label rendering lives in WP02; this WP only lays out *positions* and interactive hit areas.
- Haptics wiring lives in WP05 but this WP dispatches the `CustomEvent`s haptics will listen to.

## Subtasks

### T001 — Create `js/mobileSafeArea.js`

**Purpose**: Surface iOS/Android safe-area insets to JS for layout math.

**Steps**:
1. Insert a hidden `<div>` at startup with `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)` and `position: fixed; pointer-events: none; opacity: 0;`.
2. Read `getComputedStyle(el).paddingTop/Right/Bottom/Left`, parse px, write to `window.__SAFE_AREA__ = {top, right, bottom, left}`.
3. Re-measure on `window.orientationchange` and on `visualViewport.resize` (debounced 200 ms).
4. Export `readSafeArea()` for tests/manual access.

**Files**: `js/mobileSafeArea.js` (new, ~60 lines).

**Validation**: On an iPhone 14 Pro emulation, `window.__SAFE_AREA__.top >= 47` and `bottom >= 34`. On a non-notched device, values are 0.

### T002 — Create `js/mobileControls.js` as the single mobile-control entry point

**Purpose**: Extract all mobile-specific setup from `initControls()` into one module, exposing a narrow API.

**Steps**:
1. Export `initMobileControls(scene)` that `initControls()` calls when `isMobile`. All existing mobile code in `initControls()` moves here verbatim first (pure refactor, no behavior change).
2. Export `getAbilityButtonAnchor()` returning `{x, y, layout}` so other WPs can query where buttons live.
3. Export `getLeftPointerRegion()` returning the rect WP03 will use for floating-joystick spawning (excludes top inventory row and bottom safe-area).
4. Dispatch `window.dispatchEvent(new CustomEvent('demonfall:ability-tap', {detail:{ability}}))` on every ability button press. Haptics WP listens here.
5. Dispatch `demonfall:ability-release` for buttons that support hold/release (charge slash).

**Files**: `js/mobileControls.js` (new, ~200 lines after this WP), `js/main.js` (removes the block, adds `initMobileControls.call(this)`).

**Validation**: Game still boots on mobile emulation; every ability button still fires its original function.

### T003 — Declarative grid for ability buttons

**Purpose**: Replace hardcoded offsets with a grid spec.

**Steps**:
1. Define `ABILITY_LAYOUT` inside `mobileControls.js`:
   ```js
   const ABILITY_LAYOUT = [
     // row 0 (bottom row)
     { key: 'attack', col: 0, row: 0, baseRadius: 40 },
     { key: 'spin',   col: 1, row: 0, baseRadius: 40 },
     { key: 'dagger', col: 2, row: 0, baseRadius: 34 },
     // row 1 (upper row)
     { key: 'charge', col: 0, row: 1, baseRadius: 34 },
     { key: 'dash',   col: 1, row: 1, baseRadius: 34 },
     { key: 'shield', col: 2, row: 1, baseRadius: 34 },
   ];
   ```
2. Compute position from grid: `x = screenW - safeArea.right - (cellW * (col + 0.5)) - pad`, mirrored for `y`.
3. `cellW` derives from `baseRadius * 2 * scale + gap` where `scale = window.__MOBILE_BUTTON_SCALE__ || 1.0` (set to 1.0 as default; WP05 wires the settings).

**Files**: `js/mobileControls.js`.

**Validation**: Old visual layout is approximately reproduced when `scale=1.0`. Changing `window.__MOBILE_BUTTON_SCALE__ = 1.2` on the console resizes everything after a scene restart.

### T004 — 44×44 minimum hit rects

**Purpose**: Make taps forgiving without growing the visual circles.

**Steps**:
1. For each button, after the circle is created, call `btn.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-22, -22, 44, 44), hitAreaCallback: Phaser.Geom.Rectangle.Contains })`.
2. When `baseRadius * scale > 22`, the hit rect matches the visual (no shrink). Use `max(22, baseRadius * scale)` for the hit-rect half-size.

**Files**: `js/mobileControls.js`.

**Validation**: In DevTools, hovering a finger-sized cursor near the edge of a button still triggers. Compare to pre-WP01 main branch.

### T005 — Safe-area-aware corner padding

**Purpose**: Respect notches and home indicators.

**Steps**:
1. Bottom-right cluster padding: `pad = { right: 20 + safeArea.right, bottom: 20 + safeArea.bottom }`.
2. Inventory button top-right: `pad = { right: 16 + safeArea.right, top: 16 + safeArea.top }`.
3. Re-apply on `this.scale.on('resize', ...)`.

**Files**: `js/mobileControls.js`.

**Validation**: On iPhone 14 Pro emulation, bottom-row buttons sit above the home-indicator strip; inventory sits below the notch.

### T006 — Emit layout events for downstream WPs

**Purpose**: WP02/03/04/05 need to hook when the layout is ready or re-positioned.

**Steps**:
1. Dispatch `demonfall:mobile-layout-ready` after first positioning (detail: `{scene, buttons, joystickSlot}`).
2. Dispatch `demonfall:mobile-layout-changed` on resize.
3. Document the event contract at the top of `mobileControls.js`.

**Files**: `js/mobileControls.js`.

**Validation**: Console-listen for the events in DevTools and observe them fire on scene create and on window resize.

## Definition of Done

- Game starts on desktop unchanged.
- On mobile emulation, all 6 ability buttons are positioned via the declarative grid and respect safe-area on iPhone 14 Pro portrait + landscape.
- Every button's hit rect is ≥ 44×44 CSS px.
- Four `CustomEvent`s are dispatched as documented.
- No functional regression: every ability still fires its original handler.

## Risks

- Refactor could break an edge-case in `initControls()` (e.g. `setDepth` / `clearMask` calls at lines 2065-2081). Keep the sequence of those calls verbatim in the new module.
- Safe-area probe may return 0 on devices where `env()` isn't set up in CSS — ensure `<meta name="viewport" content="... viewport-fit=cover">` is present in `index.html`. If not, add it as part of this WP.

## Reviewer guidance

- Diff should show a big block of `initControls()` removed and an equal-size block added in `mobileControls.js`, plus the new layout grid and hit-rect logic on top.
- `CustomEvent` names must match the strings the downstream WPs expect: `demonfall:ability-tap`, `demonfall:ability-release`, `demonfall:mobile-layout-ready`, `demonfall:mobile-layout-changed`.

## Implementation command

```
spec-kitty implement WP01
```

## Activity Log

- 2026-04-15T19:50:47Z – unknown – shell_pid=71152 – lane=for_review – WP01 complete: mobileSafeArea + mobileControls modules; grid layout + 44x44 hit rects + safe-area + event bus.
- 2026-04-15T20:12:31Z – unknown – shell_pid=71152 – lane=approved – self-review
