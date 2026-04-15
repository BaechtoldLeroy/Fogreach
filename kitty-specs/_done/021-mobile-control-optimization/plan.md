# Implementation Plan: Mobile Control Optimization

**Branch**: `main` (no worktree — direct to target) | **Date**: 2026-04-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `kitty-specs/021-mobile-control-optimization/spec.md`

Branch contract: Current branch at workflow start: `main`. Planning/base branch: `main`. Final merge target: `main`. `branch_matches_target = true`.

## Summary

Replace the current rudimentary mobile control layer with a modern ARPG-on-mobile control scheme: safe-area-aware layout, 44 px+ hit targets, iconified ability buttons with labels, floating/dynamic joystick with analog output and dead zone, auto-attack targeting assist, and optional haptics — all surfaced through a new "Mobile" section in the existing SettingsScene.

## Technical Context

**Language/Version**: JavaScript (ES2020+), no build step.
**Primary Dependencies**: Phaser 3, `rexVirtualJoystick` plugin, Web Audio API (existing `soundManager`), browser `navigator.vibrate()` for haptics.
**Storage**: `localStorage['demonfall_settings_v1']` (existing SettingsScene storage — extended with a `mobile` subkey).
**Testing**: manual browser smoke-testing in Chrome DevTools mobile emulation + real device smoke-test. No automated test harness exists in this project — task-level "Done" criteria are explicit acceptance checks in each WP.
**Target Platform**: Modern mobile browsers (iOS Safari 15+, Android Chrome 100+). Portrait and landscape.
**Project Type**: single — Phaser game, flat `js/` tree with a few `js/scenes/` subdirs.
**Performance Goals**: No new per-frame work on desktop (feature is gated by `isMobile`). On mobile, input handling must not add measurable frame-time overhead (>1 ms per frame budget).
**Constraints**: No breaking changes to the desktop control path. `window.AbilitySystem` wiring must be preserved exactly.
**Scale/Scope**: Touches `js/main.js:initControls`, `js/player.js:handleMobileMovement`, `js/scenes/SettingsScene.js`. New small module(s) for haptics and auto-targeting if warranted.

## Constitution Check

Skipped — no `.kittify/constitution/constitution.md` gates relevant to a UI/control optimization feature. Project-level directives (TEST_FIRST) are acknowledged but relaxed: no automated test harness exists, so "test-first" is interpreted as "define explicit acceptance checks in each WP before code is written".

## Project Structure

### Documentation (this feature)

```
kitty-specs/021-mobile-control-optimization/
├── plan.md              # this file
├── research.md          # Phase 0 — design decisions
├── data-model.md        # Phase 1 — settings schema + UI state
├── quickstart.md        # Phase 1 — manual smoke-test instructions
└── tasks/               # Phase 2 — WP task files (created by /spec-kitty.tasks)
```

### Source Code (repository root)

```
js/
├── main.js                  # initControls() — layout, joystick, ability buttons
├── player.js                # handleMobileMovement() — joystick → velocity
├── soundManager.js          # (haptics helper may live here or separate)
├── haptics.js               # NEW — thin wrapper over navigator.vibrate()
├── mobileAutoAim.js         # NEW — nearest-enemy target resolution for attack btn
└── scenes/
    └── SettingsScene.js     # new "Mobile" section (dead zone, haptics, autoaim, scale)
```

**Structure Decision**: Follow the existing flat `js/` layout. Two new small modules (`haptics.js`, `mobileAutoAim.js`) for clarity; everything else is edits to `main.js`, `player.js`, and `SettingsScene.js`. No directory restructure.

## Complexity Tracking

None — all requirements fit inside the existing mobile code path. No new dependencies, no new build tooling.
