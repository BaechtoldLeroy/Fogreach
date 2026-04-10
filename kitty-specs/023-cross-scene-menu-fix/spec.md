# Bug: Overlay menus don't work in all scenes

## Problem
Some overlay menus only work in one scene but not the other:
- Inventory (I) — only works in Dungeon, not in Hub
- Journal (J) — only works in Hub, not in Dungeon
All menus should be accessible from both Hub and Dungeon.

## Goal
Ensure all overlay menus (Settings, Inventory, Loadout, Journal) work in both HubSceneV2 and GameScene.

## Technical Context
- Engine: Phaser 3
- Keybindings are registered per-scene in `create()` 
- Hub: `js/scenes/HubSceneV2.js` — has O, M, J, K
- Dungeon: `js/main.js` (GameScene) — has I, M, K, O
- Settings (O) already fixed — was using wrong Phaser API

## Functional Requirements
- **FR-001**: Inventory (I key) must open in both Hub and Dungeon
- **FR-002**: Journal (J key) must open in both Hub and Dungeon
- **FR-003**: No regressions — Settings (O), Loadout (K), Mute (M) must continue working in both scenes
