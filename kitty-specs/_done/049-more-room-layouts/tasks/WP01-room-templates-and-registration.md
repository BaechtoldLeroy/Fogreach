---
work_package_id: WP01
title: 6 New Room Templates + Registration + Tests
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-08
- NFR-01
- NFR-02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: bef0674c7915ef1c715352c8b7e991797b02f791
created_at: '2026-05-14T12:20:31.346350+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
- T009
phase: Phase 1 — Foundation
assignee: ''
agent: claude
shell_pid: "17388"
history:
- timestamp: '2026-05-14T10:05:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks-packages
authoritative_surface: js/roomTemplates/
execution_mode: code_change
lane: planned
owned_files:
- js/roomTemplates/CorridorLong.json
- js/roomTemplates/CorridorBranch.json
- js/roomTemplates/PillarHall.json
- js/roomTemplates/AsymmetricChamber.json
- js/roomTemplates/TerracedHall.json
- js/roomTemplates/DoubleAlcove.json
- js/roomTemplates/manifest.json
- js/scenes/startScene.js
- js/roomTemplates.js
- tests/roomNav.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — 6 New Room Templates + Registration + Tests

## Objective

Author 6 new procedural-room JSON templates, register each in the three sync points (Phaser preload, `RT.TEMPLATES` registration, `RT.MANIFEST` picker pool, plus the catalog `manifest.json`), and add a per-template assertion block to `tests/roomNav.test.js`. Goal: enlarge the procedural pool from 22 → 28 entries so a 10-room run encounters ≥ 7 distinct templates on average (SC-02), without changing picker logic (C-03) or introducing new art (C-04).

## Context

- **Spec**: `kitty-specs/049-more-room-layouts/spec.md`
- **Plan**: `kitty-specs/049-more-room-layouts/plan.md`
- **Research**: `kitty-specs/049-more-room-layouts/research.md` (especially R-02 for the JSON contract and R-05 for template choices)
- **Data model**: `kitty-specs/049-more-room-layouts/data-model.md` (schema + validation rules + registration touchpoints)
- **Quickstart**: `kitty-specs/049-more-room-layouts/quickstart.md` (manual playtest steps for T009)
- **Reference templates**: `js/roomTemplates/Arena.json` (full-size 36×28 example), `js/roomTemplates/CirclePillars.json` (medium variant)
- **Test contract**: `tests/roomNav.test.js` — `buildProtectedTiles` + `floodFill` helpers already encode the validation contract; reuse them.

## Subtasks

### T001 — Author `js/roomTemplates/CorridorLong.json`

Long narrow corridor — 16 cols × 28 rows. Single-direction movement bias (N→S or S→N feel). 2–3 sparse `pillar_small` columns spaced along the corridor. Two entrances: one at `{ x: 7, y: 1, dir: "N" }`, one at `{ x: 7, y: 26, dir: "S" }`. Player spawn near the N entrance, e.g. `{ x: 7, y: 3 }`. No loot.

- `tags`: `["corridor", "narrow"]`
- `tiles.floor`: `"floor_stone"`
- `legend`: `{ "#": "obstacleWall", ".": "floor_stone", "P": "pillar_small" }`
- Width must be ≥ 3 walkable cols at every row (a 1-col-wide corridor strands enemies and breaks pathing).

### T002 — Author `js/roomTemplates/CorridorBranch.json`

24 × 24 corridor with one side alcove. Asymmetric entrances: one `N` at the top, one `S` at the bottom, the alcove is a 4×4 pocket off the W or E side. 1 loot tile inside the alcove.

- `tags`: `["corridor", "chamber"]`
- `tiles.floor`: `"floor_cobble"`
- Player spawn between the N entrance and the alcove mouth.

### T003 — Author `js/roomTemplates/PillarHall.json`

36 × 28 hall — same canvas size as Arena. 4–6 pillar clusters of 2–3 `pillar_small` each, breaking line-of-sight. Two entrances: N and S, both centered. 1–2 loot tiles, placed off-center so they're not trivially picked up.

- `tags`: `["hall", "combat"]`
- `tiles.floor`: `"floor_stone"`
- All choke points must be ≥ 2 tiles wide (enemy A* expects 2-tile clearance).
- Player spawn near the N entrance with a clear 3×3 around it (validation rule).

### T004 — Author `js/roomTemplates/AsymmetricChamber.json`

28 × 24. One corner cut away by an obstacle wedge (a triangular block of `#` filling 4–6 tiles in, say, the NE corner). Player spawn off-center. Two entrances: one N, one E (the E entrance must be on the opposite side from the cut corner). 1 loot tile in the "hidden" corner opposite the cut.

- `tags`: `["chamber"]`
- `tiles.floor`: `"floor_cobble"`

### T005 — Author `js/roomTemplates/TerracedHall.json`

36 × 28 with two visual tiers (research §R-04 — visual only, no true elevation). Express via:
- Upper half: `floor_tile_ornate` tiles (use a tier-specific char in the legend like `+`).
- Lower half: `floor_stone` tiles.
- A 1-row-thick `pillar_small` wall divides them, with a 4-tile gap in the middle so both tiers are flood-fill-reachable.

Two entrances: N (in the upper tier) and S (in the lower tier). 1 loot tile in the lower tier.

- `tags`: `["hall", "combat"]`
- `tiles.floor`: `"floor_stone"` (default; `legend` overrides per-char for the upper tier)
- **Fallback** (research §R-04): if playtest reveals the tiers feel flat, swap this template for `AsymmetricChamber2` (a second asymmetric variant) and update the registrations + tests accordingly. Document the swap in the commit message.

### T006 — Author `js/roomTemplates/DoubleAlcove.json`

32 × 24. Two symmetric loot alcoves, one on the W side and one on the E side, each a 4×4 pocket. Main central area is open. Two entrances: N and S. 2 loot tiles, one per alcove.

- `tags`: `["chamber", "treasure"]`
- `tiles.floor`: `"floor_cobble"`

### T007 — Update three registration sync points

These three lists MUST be in sync with the set of JSON files (data-model §Registration touchpoints):

1. **`js/roomTemplates/manifest.json`** — Add the 6 names to the `templates` array (keep alphabetical order). Bump `count` from 27 to 33. Update `generatedAt` to the current ISO timestamp.
2. **`js/scenes/startScene.js` ~L245** (`templateNames` for Phaser preload) — Append the 6 names.
3. **`js/scenes/startScene.js` ~L526** (`allTemplateNames` for `RT.TEMPLATES` registration) — Append the 6 names.
4. **`js/roomTemplates.js` ~L9** (`RT.MANIFEST`, the picker pool) — Append the 6 names.

**Drift check**: after editing, grep the four files for each new template name and assert exactly 4 matches per name.

### T008 — Extend `tests/roomNav.test.js`

For each new template, add a `test('roomNav: <TemplateName> ...')` block that:
1. Loads the JSON: `const template = require('../js/roomTemplates/<TemplateName>.json');`
2. Asserts dimensional consistency: `walls.length === size.h`, every `walls[i].length === size.w`.
3. Builds the protected-tile set: `const protected = buildProtectedTiles(template);`
4. Asserts no protected tile contains an obstacle char (`#` or any non-floor char in the legend).
5. Constructs the `walls` / `blocked` 2D arrays and runs `floodFill(walls, blocked, spawn.x, spawn.y)`.
6. Asserts every entrance tile and every loot tile is reachable.

Follow the existing test style in `tests/roomNav.test.js`. New tests should add 6 entries to the run count (baseline ~188 → ~194).

### T009 — Manual playtest (per `quickstart.md`)

1. `node tools/runTests.js` — green, +6 tests.
2. `npx serve .` and open the game.
3. Start a New Game. Walk through ≥ 10 procedural rooms. Note which templates appeared (log via `console.log(window.currentScene?.activeTemplateName)` after each transition if helpful).
4. Confirm ≥ 7 distinct templates across the 10 rooms, with ≥ 1 from the new set (SC-02). If not, run a second 10-room sample.
5. Spot-check each new template visually for distinctness (SC-04) and zero console errors (SC-01, SC-03).

Document the playtest results (list of templates encountered per run) in the WP completion commit message.

## Owned files

- `js/roomTemplates/CorridorLong.json` (NEW)
- `js/roomTemplates/CorridorBranch.json` (NEW)
- `js/roomTemplates/PillarHall.json` (NEW)
- `js/roomTemplates/AsymmetricChamber.json` (NEW)
- `js/roomTemplates/TerracedHall.json` (NEW)
- `js/roomTemplates/DoubleAlcove.json` (NEW)
- `js/roomTemplates/manifest.json` (MODIFIED)
- `js/scenes/startScene.js` (MODIFIED — preload list + registration list)
- `js/roomTemplates.js` (MODIFIED — picker manifest)
- `tests/roomNav.test.js` (MODIFIED — per-template assertions)

## Risks

- **Registration drift** — missing one of the three JS arrays means the template silently never appears. T007's grep check is the gate.
- **Flood-fill stranding** — a misplaced wall char strands the spawn or an entrance. T008's per-template assertion is the gate.
- **Multi-tier feasibility** — `TerracedHall` uses visual tiers only. Fallback to `AsymmetricChamber2` documented in T005.
- **Border integrity** — every row must start and end with `#` except for entrance gaps. Easy to miscount when hand-editing 28-char wide rows.
- **Choke-point pathing** — corridors and alcove mouths narrower than 2 tiles break enemy A*. Verify at playtest.

## Independent test

After this WP merges:
- `node tools/runTests.js` — baseline + 6 new template tests, all green.
- Game boots without console errors.
- `console.log(window.RoomTemplates.MANIFEST.length)` returns old count + 6.
- 10-room run shows ≥ 7 distinct templates with ≥ 1 from the new set.

## Implementation command

```bash
spec-kitty implement WP01 --feature 049-more-room-layouts
```
