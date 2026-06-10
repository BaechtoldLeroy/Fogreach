# Phase 0 Research: More Room Layouts

**Feature**: 049-more-room-layouts
**Date**: 2026-05-14
**Status**: Complete

## R-01 — How does the room picker select templates today?

**Decision**: Re-use the existing manifest+registration pipeline; do not add a picker, weight, or rarity layer.

**Rationale**:
- `js/roomTemplates.js` exposes `RT.MANIFEST` (array of template names) and `RT.TEMPLATES` (map of name → parsed JSON).
- The procedural picker (in `js/main.js` / dungeon controller) draws uniformly from `RT.MANIFEST`. Story rooms (`RathausArchive`, `RitualVault`, `PrisonDepths`, `CouncilChamber`, `ForgottenCrypt`) are listed in `RT.MANIFEST` but gated by act/story state at selection time.
- Adding 4–6 entries to `RT.MANIFEST` is sufficient to enlarge the pool; no logic change is required (C-03).

**Alternatives considered**:
- A separate `RT.PROCEDURAL_MANIFEST` to isolate procedural-only entries — rejected: existing manifest already mixes procedural + story-gated entries; the existing gate handles separation.
- Rarity-tagged templates — rejected: explicit out-of-scope per spec §11.

## R-02 — What is the JSON contract for a template file?

**Decision**: Match the shape used by `js/roomTemplates/Arena.json` (reference) and `CirclePillars.json` (smaller variant).

**Required keys** (verified against `Arena.json`):

```jsonc
{
  "name": "<TemplateName>",          // must equal filename minus .json
  "tags": ["arena" | "corridor" | "hall" | ...],
  "size": { "tile": 32, "w": <cols>, "h": <rows> },
  "tiles": { "floor": "floor_stone" | "floor_cobble" | "floor_tile_ornate" | "floor_stone_dark" },
  "layout": {
    "legend": {                       // char → tile-key (must include obstacles + floor)
      "#": "obstacleWall",
      ".": "floor_stone",
      "P": "pillar_small"             // optional — only if used in walls grid
    },
    "walls": [                        // array of strings, length === size.h, each string length === size.w
      "####################################",
      "#..................................#",
      ...
    ]
  },
  "entrances": [                      // ≥ 1 entry; (x, y) is tile coords, dir is cardinal
    { "x": 12, "y": 1, "dir": "N" }
  ],
  "spawns": {
    "player": { "x": <tx>, "y": <ty> },
    "loot": [                         // optional — 0 or more
      { "x": <tx>, "y": <ty> }
    ]
  }
}
```

**Rationale**:
- Phaser preload at `js/scenes/startScene.js:253` uses `this.load.json(name, 'js/roomTemplates/${name}.json')`, then `loadRoomTemplatesAndStart()` (`startScene.js:521`) registers parsed objects into `RT.TEMPLATES[name]`.
- `applyRoomTemplate` (referenced in `js/roomTemplates.js:1225`) consumes the shape above; deviations cause Phaser runtime errors or invisible tiles.

**Alternatives considered**:
- YAML / inline JS const — rejected: breaks the C-01 contract.
- Compressed run-length walls — rejected: makes hand-editing painful, no perf win at this size.

## R-03 — How does `roomNav.test.js` validate a template?

**Decision**: Each new template gets a test block that constructs a `template` object literal (or loads the JSON via `require`) and runs the existing helpers.

**Validation contract** (from `tests/roomNav.test.js`):

1. **Protected-tile set** built by `buildProtectedTiles(template)`:
   - Player spawn + 1-tile radius (3×3 block)
   - Each entrance + 1-tile radius (3×3 block)
   - Each loot tile (single tile)
2. **Flood-fill reachability** (`floodFill(walls, blocked, startX, startY)`):
   - Starting from `spawns.player`, every entrance tile MUST be reachable.
   - Every loot tile MUST be reachable.
3. **No obstacles inside protected tiles**: builder asserts none of the protected coordinates contain an obstacle char in `layout.walls`.

**Rationale**: Constitution §Testing requires test coverage for risky logic. Room geometry is risky (a bad template strands the player) so each template gets a dedicated test case.

**Alternatives considered**:
- One generic test that walks `RT.TEMPLATES` — rejected: harder to attribute failure, can't run in isolation; also `roomTemplates.js` requires Phaser to load.

## R-04 — What "multi-tier" means within current physics

**Decision**: Implement multi-tier as **visual** height bands using obstacle clusters and floor-tile variation; no true elevation.

**Rationale**: R-01 in spec.md flags that true multi-tier requires physics changes that are out of scope. Existing layouts already simulate tiers visually (e.g., `CollapsingHall`, `BridgeOverGap`). Reusing this pattern keeps FR-05 in scope without engine work.

**Alternatives considered**:
- Add a `z` field — rejected: requires engine changes.
- Drop FR-05 — rejected: per spec §13 R-01 mitigation, fall back to "asymmetric variant 2" only if visual tiers prove insufficient at playtest time; first attempt is visual tiers.

## R-05 — Template count

**Decision**: Ship **6 templates** (top of the 4–6 range):
1. **CorridorLong** — narrow long corridor (8w × 28h), single-direction movement bias, sparse pillars
2. **CorridorBranch** — corridor with a single side alcove, asymmetric entrances
3. **PillarHall** — 36×28 hall with dense pillar clusters breaking line-of-sight
4. **AsymmetricChamber** — 28×24 room with one corner cut away, off-center spawn
5. **TerracedHall** — 36×28 with two visual "tiers" expressed as floor-tile bands + pillar walls
6. **DoubleAlcove** — 32×24 with two symmetric loot alcoves flanking the main room

**Rationale**: 6 entries hit every FR (FR-02..FR-05 each have at least one match) and give the SC-02 sampling enough variety (≥7 distinct templates per 10-room run becomes statistically easy when the pool grows from 22 → 28).

**Alternatives considered**:
- 4 templates (minimum) — viable but tighter on SC-02; rejected unless a template fails playtest.

## Outstanding clarifications

None. All NEEDS CLARIFICATION resolved. Proceed to Phase 1.
