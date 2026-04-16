# Implementation Plan: Fullscreen Option

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/040-fullscreen-option/spec.md`

## Summary

Add fullscreen toggle. Phaser already has the API (`this.scale.startFullscreen()` / `stopFullscreen()`), and there's commented-out fullscreen code in `js/main.js` (lines ~801-805). Just needs a proper toggle in settings and a keyboard shortcut.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0 (Scale Manager has fullscreen support)
**Testing**: Manual testing in desktop browsers
**Target Platform**: Desktop browsers (Fullscreen API)

## Approach

1. **Settings toggle** — Add fullscreen checkbox/toggle in `js/scenes/SettingsScene.js`. On toggle: call `this.scale.startFullscreen()` or `stopFullscreen()`. Save preference in `demonfall_settings_v1` localStorage.

2. **Keyboard shortcut** — Add F11 key binding in `js/main.js` to toggle fullscreen. Prevent default browser F11 behavior.

3. **Auto-restore** — On game load, if fullscreen preference is saved, request fullscreen (note: browsers require user gesture, so may need to trigger on first click).

4. **Canvas scaling** — Phaser's `Scale.FIT` mode should handle resizing automatically. Verify no HUD positioning breaks.

## Key Files

- `js/scenes/SettingsScene.js` — Add fullscreen toggle
- `js/main.js` — F11 shortcut, uncomment/fix existing fullscreen code
- `js/persistence.js` or localStorage — Save preference

## Dependencies

- None (simplest feature, can be done anytime)
