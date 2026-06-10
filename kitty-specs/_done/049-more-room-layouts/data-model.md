# Data Model: More Room Layouts

**Feature**: 049-more-room-layouts
**Date**: 2026-05-14

This feature ships JSON data, not code-level entities. The "data model" is the existing room-template JSON shape (already in production) re-described for the templates added by this feature.

## Entity: RoomTemplate

**Storage location**: `js/roomTemplates/<TemplateName>.json`

**Schema** (verified against `Arena.json`, `CirclePillars.json`):

| Field | Type | Required | Description | Validation |
|---|---|---|---|---|
| `name` | string | yes | Logical template name | MUST equal the filename minus `.json` (e.g., `PillarHall` → `PillarHall.json`). |
| `tags` | string[] | yes | Free-form tags used for theming and debug filters | Choose from existing tag vocabulary: `arena`, `corridor`, `hall`, `chamber`, `combat`, `boss`, `treasure`, `puzzle`, `narrow`. |
| `size.tile` | int | yes | Tile size in pixels | MUST be `32` (engine constant). |
| `size.w` | int | yes | Width in tiles | 8 ≤ w ≤ 40 (engine viewport limit). |
| `size.h` | int | yes | Height in tiles | 8 ≤ h ≤ 32 (engine viewport limit). |
| `tiles.floor` | string | yes | Default floor texture key | One of: `floor_stone`, `floor_cobble`, `floor_tile_ornate`, `floor_stone_dark`. |
| `layout.legend` | object | yes | Map of char → tile-key | MUST contain `#` (wall) and `.` (floor). May contain `P` (pillar_small), `B` (brazier), etc. — every char used in `walls` MUST appear in legend. |
| `layout.walls` | string[] | yes | The room grid, one row per string | `walls.length === size.h`; every row `walls[i].length === size.w`. Outer border MUST be solid `#`. |
| `entrances` | object[] | yes | ≥ 1 entrance with cardinal direction | Each: `{ x: int, y: int, dir: "N" | "S" | "E" | "W" }`. The entrance tile MUST be a floor tile (`.`) so the player can stand on it; the tile immediately outside the room in `dir` direction is the next-room connector. |
| `spawns.player` | object | yes | Player spawn point | `{ x: int, y: int }` — tile MUST be a floor tile; spawn + 1-tile 3×3 buffer MUST contain no obstacles. |
| `spawns.loot` | object[] | no | Loot tile positions | 0+ entries; each tile MUST be a floor tile and reachable from `spawns.player` via flood-fill. |

## Validation Rules (codified in `tests/roomNav.test.js`)

1. **Dimensional consistency**: `walls.length === size.h && walls.every(r => r.length === size.w)`.
2. **Border integrity**: `walls[0]`, `walls[size.h-1]` are all `#`; `walls[i][0]`, `walls[i][size.w-1]` are `#` for all rows (entrances are *gaps* in the border, but tracked separately in `entrances[]`).
3. **Legend coverage**: every distinct character in `walls` (excluding `\n`) exists as a key in `legend`.
4. **Protected-tile freedom**: for the protected set built from `spawns.player`, `entrances`, `spawns.loot`, no tile in that set is an obstacle char in `walls`.
5. **Flood-fill reachability**: BFS from `spawns.player` reaches every entrance tile and every loot tile.

## Registration touchpoints

These three lists MUST be kept in sync with the set of JSON files in `js/roomTemplates/`:

| Touchpoint | File | Purpose |
|---|---|---|
| Phaser preload | `js/scenes/startScene.js` ~L245 (`templateNames`) | Tells Phaser to download each `*.json` at boot |
| `RT.TEMPLATES` population | `js/scenes/startScene.js` ~L526 (`allTemplateNames`) | Copies parsed JSON from `cache.json` into `window.RoomTemplates.TEMPLATES[name]` |
| Picker pool | `js/roomTemplates.js` ~L9 (`RT.MANIFEST`) | The procedural picker draws from this array |
| Catalog (informational) | `js/roomTemplates/manifest.json` | Documents the full set + count for tools/inspection |

**Drift risk**: forgetting to add a name to one of the three JS arrays causes silent omission (no error, just fewer rooms). Every WP that adds templates MUST touch all three.

## New templates added by this feature

| Name | Size (w×h) | Tags | Required FR |
|---|---|---|---|
| `CorridorLong` | 16×28 | `corridor`, `narrow` | FR-02 |
| `CorridorBranch` | 24×24 | `corridor`, `chamber` | FR-02, FR-04 (mild asymmetry) |
| `PillarHall` | 36×28 | `hall`, `combat` | FR-03 |
| `AsymmetricChamber` | 28×24 | `chamber` | FR-04 |
| `TerracedHall` | 36×28 | `hall`, `combat` | FR-05 (visual tiers) |
| `DoubleAlcove` | 32×24 | `chamber`, `treasure` | (variety) |

Final size/tag choices may be refined during authoring; the table is a starting target.
