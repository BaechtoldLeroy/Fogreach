# Implementation Plan: Mobile D2 Controls

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/038-mobile-d2-controls/spec.md`

## Summary

Add Diablo 2-style tap-to-move and tap-to-attack controls on mobile. Currently mobile uses a virtual joystick (rex plugin, bottom-left) for movement. Desktop already has D2-style click movement via the `movementWeight` setting in SettingsScene (0=instant, 1=D2-like).

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0, phaser3-rex-plugins (virtual joystick)
**Testing**: Mobile device testing
**Target Platform**: Mobile browsers (touch devices)

## Approach

1. **Tap-to-move** — On mobile, detect single taps on walkable floor tiles. Set player target position and move toward it (reuse desktop D2 movement logic with `movementWeight=1`). Coexists with virtual joystick — joystick overrides tap-move when active.

2. **Tap-to-attack** — Tap on an enemy to target and auto-attack it. Use hit-testing on enemy sprites. Combine with `mobileAutoAim.js` for ranged abilities.

3. **Hold-to-move** — Holding a position triggers continuous movement toward the touch point. Use pointer move events while pointer is down.

4. **Touch priority** — Touch on UI elements (HUD, ability buttons) takes priority over game-world taps. Use Phaser input priority system.

5. **Settings toggle** — Add "D2 Controls" toggle in SettingsScene mobile section. When off, keep classic joystick-only mode.

## Key Files

- `js/mobileControls.js` — Add tap-to-move/attack handlers alongside joystick
- `js/main.js` — Player movement logic, integrate D2-style pathfinding
- `js/mobileAutoAim.js` — Extend for tap-to-attack targeting
- `js/scenes/SettingsScene.js` — D2 controls toggle
- `js/player.js` — Movement target system

## Dependencies

- 037-procroom-mobile-performance should ideally be done first (performance budget)
