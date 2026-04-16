# Implementation Plan: HUD & Menu Polish

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/033-hud-menu-polish/spec.md`

## Summary

Fix overlapping UI elements and improve visual consistency across all menus. HUD is built in `js/main.js` (initUI), menus are Phaser scenes (ShopScene, CraftingScene, SettingsScene) rendered as overlays.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0 (960x480 canvas, FIT scale mode)
**Testing**: Manual visual testing on desktop + mobile
**Target Platform**: Desktop + Mobile browsers
**Constraints**: No CSS — all UI is Phaser text/graphics objects

## Approach

1. **Audit all menus** — Screenshot each menu on desktop (960x480) and mobile (portrait + landscape). Document every overlap, clip, and misalignment.

2. **Fix overlaps** — Recalculate positions and sizes for:
   - Inventory panel (`js/inventory.js`) — equipment slots, grid, Stadtportal button
   - Shop scene (`js/scenes/ShopScene.js`) — tab headers, item list, gold display
   - Crafting scene (`js/scenes/CraftingScene.js`) — material counts, recipe slots
   - Settings scene (`js/scenes/SettingsScene.js`) — sliders, toggles, labels

3. **Responsive layout** — Use game canvas dimensions and safe area insets to position elements. Test at multiple aspect ratios.

4. **Visual consistency** — Standardize font sizes, colors, button styles across scenes. Use tier colors consistently.

## Key Files

- `js/main.js` — HUD initialization (initUI)
- `js/inventory.js` — Inventory panel layout
- `js/scenes/ShopScene.js` — Shop layout
- `js/scenes/CraftingScene.js` — Crafting layout
- `js/scenes/SettingsScene.js` — Settings layout
- `js/mobileControls.js` — Mobile ability button layout

## Dependencies

- None (standalone polish task)
