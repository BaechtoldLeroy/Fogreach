# Implementation Plan: Stadtportal Cost

**Branch**: `main` | **Date**: 2026-04-16 | **Spec**: `kitty-specs/034-stadtportal-cost/spec.md`

## Summary

Add a cost to the town portal. Currently free (button in `js/inventory.js` line ~667). Portal scrolls should be a purchasable item from Mara in the potion tab of `js/scenes/ShopScene.js`.

## Technical Context

**Language/Version**: JavaScript (ES6, vanilla)
**Primary Dependencies**: Phaser 3.70.0
**Testing**: Manual playtesting
**Target Platform**: Desktop + Mobile browsers

## Approach

1. **Portal scroll item** — Add a new consumable item type "portal_scroll" to the inventory system. Track count in `window.materialCounts` or a dedicated field.

2. **Shop integration** — Add portal scrolls to Mara's "Tränke" (potion) tab in `ShopScene.js`. Fixed gold cost (e.g., 50-100 gold, balance TBD).

3. **Usage check** — Modify the Stadtportal button in `js/inventory.js` to check for scroll availability before allowing teleport. Decrement count on use. Grey out button when none available.

4. **UI feedback** — Show scroll count near the portal button. Show "no scrolls" message when attempting to use without one.

5. **Starting scrolls** — Give player 1-2 free scrolls at game start so the mechanic doesn't feel punishing early.

## Key Files

- `js/inventory.js` — Stadtportal button (line ~667), add scroll check
- `js/scenes/ShopScene.js` — Add scroll to Mara's potion tab
- `js/persistence.js` — Save/load scroll count
- `js/lootSystem.js` — Possibly drop scrolls from enemies (rare)

## Dependencies

- None (standalone feature)
