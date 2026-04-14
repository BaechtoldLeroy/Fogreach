# Feature: Procedural Room Themes (varied floor/wall textures)

## Problem
Procedural rooms always use `floor_stone` + `obstacleWall`. Hand-authored templates use varied themes (`floor_cobble`, `floor_tile_ornate`, `floor_stone_dark`, `wall_dungeon`, `wall_stone_large`, `wall_brick`) giving each room a distinct feel. Procedural rooms look generic.

## Goal
Procedural rooms pick a theme from the existing pool, matching the visual variety of hand-authored templates.

## Technical Context
- Existing themes defined in `js/roomTemplates.js` ROOM_THEMES
- Floor/wall texture keys are referenced in room data and resolved during render
- ProceduralRooms.generate() currently hardcodes `floor_stone` in legend and `floor: 'floor_stone'` in tiles

## Functional Requirements
- **FR-001**: Define a theme pool compatible with existing assets: e.g. `crypt` (dark stone + dungeon wall), `cathedral` (ornate + stone large), `sewer` (cobble + brick), `cave` (rough variants)
- **FR-002**: Procedural generator picks a theme per room (seeded so it's deterministic)
- **FR-003**: Legend and tiles section in generated template reflect chosen theme
- **FR-004**: Object placement considers theme (e.g. barrels in sewers, braziers in crypts)
- **FR-005**: Enemy composition can be themed (e.g. mages/shadows in cathedrals, brutes in sewers)
