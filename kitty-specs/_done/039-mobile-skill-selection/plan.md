# Implementation Plan: Mobile Skill Selection

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/039-mobile-skill-selection/spec.md`

## Summary

Add mobile skill selection UI. Currently mobile shows ability buttons via `js/mobileControls.js` (2x4 grid, bottom-right) but there's no way to change which skills are equipped during gameplay. Desktop uses keyboard shortcuts (K=loadout).

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0
**Testing**: Mobile device testing
**Target Platform**: Mobile browsers (touch devices)

## Approach

1. **Skill bar** — The existing mobile ability buttons (`mobileControls.js`, `mobileAbilityButtons.js`) already show equipped skills. These are the "skill bar". Add long-press or dedicated button to open skill selection.

2. **Skill selection overlay** — Modal overlay showing all available skills (from `abilitySystem.js`). Player taps a slot on the bar, then taps a skill from the pool to equip it. Similar to desktop loadout (K key) but touch-optimized.

3. **Cooldown indicators** — Add visual cooldown overlays on mobile ability buttons (radial fill or darkening). Currently cooldowns are tracked in `abilitySystem.js` but not visually shown on mobile buttons.

4. **Layout** — Skill selection overlay should be centered, large enough for touch targets (min 44px). Dismiss by tapping outside or a close button.

## Key Files

- `js/mobileControls.js` — Skill bar, add selection trigger
- `js/mobileAbilityButtons.js` — Button rendering, add cooldown visuals
- `js/abilitySystem.js` — Available skills, equipped state, cooldowns
- `js/inventory.js` — Desktop loadout system (reference implementation)

## Dependencies

- 038-mobile-d2-controls (shares mobile input handling, avoid conflicts)
