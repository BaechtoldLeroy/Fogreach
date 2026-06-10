# Tasks: More Room Layouts

**Feature**: 049-more-room-layouts
**Generated**: 2026-05-14
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`

This document is the implementation roadmap. Each work package is independently implementable and has its own detailed prompt file at `tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | 6 New Room Templates + Registration + Tests | 9 (T001–T009) | ~600 (mostly JSON layout grids) | none | — |

**Total**: 9 subtasks across 1 WP. The work is content-authoring (JSON files) plus three small registration edits and N test-case additions; splitting across multiple WPs would create merge conflicts on the shared registration arrays without parallelism gain.

**MVP scope recommendation**: Single sequential WP. Each template is authored, tested, and registered before moving to the next.

---

## Phase 1 — Foundation (only phase)

### WP01: 6 New Room Templates + Registration + Tests

**Goal**: Author 6 new room-template JSON files (`CorridorLong`, `CorridorBranch`, `PillarHall`, `AsymmetricChamber`, `TerracedHall`, `DoubleAlcove`), register each in the three sync points (preload list, `allTemplateNames`, `RT.MANIFEST`, and `manifest.json` for catalog), and add a per-template assertion block in `tests/roomNav.test.js` validating the protected-tile + flood-fill contract.

**Priority**: P0 (sole WP — without it, nothing ships).

**Independent test**: `node tools/runTests.js` — baseline of ~188 tests grows by 6, all green. Then open the game and walk through a fresh run; confirm at least one of the new templates appears in the first 10 rooms (uniform draw from a 28-entry pool).

**Included subtasks**:

- [ ] **T001** Author `js/roomTemplates/CorridorLong.json` — 16×28 narrow corridor, single-direction movement bias, 2–3 sparse pillars, N/S entrances, no loot. Reference: `Arena.json` shape, `CirclePillars.json` size.
- [ ] **T002** Author `js/roomTemplates/CorridorBranch.json` — 24×24 corridor with a single side alcove (E or W), asymmetric entrances (one N, one S), 1 loot tile in the alcove.
- [ ] **T003** Author `js/roomTemplates/PillarHall.json` — 36×28 hall with 4–6 pillar clusters breaking line-of-sight, 2 entrances (N + S), 1–2 loot tiles. Avoid choke points narrower than 2 tiles.
- [ ] **T004** Author `js/roomTemplates/AsymmetricChamber.json` — 28×24 room with one corner cut away by an obstacle wedge, off-center player spawn, 2 entrances (N + E), 1 loot tile.
- [ ] **T005** Author `js/roomTemplates/TerracedHall.json` — 36×28 hall with two visual "tiers" expressed as floor-tile bands + a low pillar wall between them. Both tiers fully reachable (flood-fill must succeed across the dividing wall via a gap). 2 entrances, 1 loot tile.
- [ ] **T006** Author `js/roomTemplates/DoubleAlcove.json` — 32×24 chamber with two symmetric loot alcoves flanking the main room. 2 entrances (N + S), 2 loot tiles (one per alcove).
- [ ] **T007** Update three registration sync points (CRITICAL — drift here causes silent omission):
  - `js/roomTemplates/manifest.json` — add the 6 names to `templates` array (alphabetical), bump `count`.
  - `js/scenes/startScene.js` ~L245 (`templateNames` for Phaser preload) — append the 6 names.
  - `js/scenes/startScene.js` ~L526 (`allTemplateNames` for `RT.TEMPLATES` registration) — append the 6 names.
  - `js/roomTemplates.js` ~L9 (`RT.MANIFEST`, the picker pool) — append the 6 names.
- [ ] **T008** Extend `tests/roomNav.test.js` with 6 new `test('roomNav: <TemplateName> ...')` blocks. Each block loads the JSON via `require('../js/roomTemplates/<TemplateName>.json')`, builds the protected-tile set via the existing `buildProtectedTiles(template)`, asserts no obstacle char overlaps the protected set, then runs `floodFill` from `spawns.player` and asserts every entrance + loot tile is reachable.
- [ ] **T009** Manual playtest per `quickstart.md`: run `npx serve .`, start a New Game, walk through ≥ 10 rooms, record which templates appeared. Expect ≥ 7 distinct templates including ≥ 1 from the new set across 1–2 runs (SC-02, SC-04). Confirm zero console errors (SC-01, SC-03).

**Owned files**:
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

**Risks**:
- **Registration drift** (data-model §Registration touchpoints): missing one of the three JS arrays means the template silently never appears. T007 lists all three explicitly; the playtest in T009 catches drift.
- **Flood-fill stranding**: a misplaced wall char strands the spawn or an entrance. T008 catches this in CI before merge.
- **Multi-tier feasibility** (research R-04): `TerracedHall` uses visual tiers only; if playtest in T009 reveals the tiers feel flat, drop FR-05 and replace `TerracedHall` with a second asymmetric variant (`AsymmetricChamber2`), updating manifest + registrations.
- **Border integrity** (data-model §Validation 2): every row of `layout.walls` must start and end with `#` except for entrance gaps. Easy to break when hand-editing.

**Requirement refs**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, NFR-01, NFR-02, SC-01, SC-02, SC-03, SC-04

**Implementation command**: `spec-kitty implement WP01 --feature 049-more-room-layouts`

---

## Dependency graph

```
┌──────┐
│ WP01 │ 6 JSON templates + registrations + tests
└──────┘
```

Single WP, no internal dependencies between templates (each can be authored independently, but they share three registration files so they merge as one).

## Parallel opportunities

None. The work is sequential by nature (shared registration files); splitting would create merge conflicts without gaining throughput.

## Risks (rolled up)

- **Registration drift** — three sync points must stay aligned with the JSON file set. See data-model §Registration touchpoints.
- **Flood-fill stranding** — caught by `tests/roomNav.test.js` extension in T008.
- **Multi-tier feasibility** — visual-only tiers; fallback plan documented above.
- **Performance** — 6 × ~1 kB JSON parse is negligible; NFR-01 (< 5 ms load) trivially met.

## Definition of done (feature-level)

All of:
- [ ] WP01 merged into `main`
- [ ] `node tools/runTests.js` green, baseline + 6 new per-template tests pass
- [ ] Manual playtest: 10-room run shows ≥ 7 distinct templates with ≥ 1 from the new set (SC-02)
- [ ] Zero console errors during walkthrough (SC-01, SC-03)
- [ ] Each new template is visually distinct from existing ones (subjective SC-04 sign-off)

## Branch strategy

Per `plan.md` and constitution §"Spec Kitty Governance": all planning + implementation happens on `main`. No feature branch. WP01 is implemented in its own worktree (`spec-kitty implement WP01 --feature 049-more-room-layouts`) and merged back to `main` when complete.

## Next command

`spec-kitty implement WP01 --feature 049-more-room-layouts` — author the 6 templates + registrations + tests.
