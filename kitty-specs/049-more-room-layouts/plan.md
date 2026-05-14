# Implementation Plan: More Room Layouts

**Branch**: `main` (planning + merge on main, per Branch Strategy in constitution.md §"Spec Kitty Governance")
**Date**: 2026-05-14
**Spec**: `kitty-specs/049-more-room-layouts/spec.md`
**Input**: Feature specification from `kitty-specs/049-more-room-layouts/spec.md`

## Summary

Add 4–6 new room templates to the existing `js/roomTemplates/` JSON pool so procedural runs stop feeling repetitive. The procedural-room picker already iterates `RT.MANIFEST` from `js/roomTemplates.js`; this feature ships JSON template files and registers them in three places: `manifest.json` (template-loader catalog), the `templateNames` arrays in `js/scenes/startScene.js` (preload + `RT.TEMPLATES` registration), and `RT.MANIFEST` in `js/roomTemplates.js` (picker pool). No engine changes, no new gameplay system. Each template conforms to the same `{ name, tags, size, tiles, layout: { legend, walls }, entrances, spawns }` shape as `Arena.json` / `CirclePillars.json` and passes the existing protected-tile + flood-fill contract codified in `tests/roomNav.test.js`.

## Technical Context

**Language/Version**: JavaScript ES6+ (classic `<script>` tags, no module system, no build pipeline) — templates are pure JSON, no JS code in this feature
**Primary Dependencies**: Phaser 3 (game engine; `this.load.json` preloads template files), `window.RoomTemplates` global (`MANIFEST` + `TEMPLATES`)
**Storage**: `js/roomTemplates/<TemplateName>.json` — plain JSON, no persistence layer
**Testing**: `node tools/runTests.js` runs `tests/roomNav.test.js` which mirrors the production protected-tile + flood-fill contract from `applyRoomTemplate`. New templates are exercised against a Node-side parallel implementation, so authored JSON must conform to that contract. Manual playtest: `npx serve` then start a run and walk through ~10 rooms.
**Target Platform**: Desktop browsers (Edge, Chrome, Firefox), mobile via existing touch controls. Static deploy at https://baechtoldleroy.github.io/Fogreach/.
**Project Type**: single (browser game, no client/server split)
**Performance Goals**: Each new template loads in < 5 ms during room-picker selection (NFR-01). Picker iteration cost rises linearly with `MANIFEST.length`; +4–6 entries on a ~22-entry pool is negligible.
**Constraints**: Same JSON shape as existing templates (C-01); one JSON per template plus one-line additions to picker lists (C-02); MUST NOT change picker logic or weighting (C-03); MUST NOT introduce new tilemap art (C-04); same nominal room size as Arena (36×28 tiles) unless deviation is documented per-template (C-05).
**Scale/Scope**: 4–6 new templates × ~28 rows × ~36 cols of layout chars ≈ 1 kB each. Three files touched for registration: `manifest.json`, `js/scenes/startScene.js`, `js/roomTemplates.js`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution paradigms listed in effect: `clean-code`, `minimal-tooling`, `modular-scenes` (note: doctrine references only `paradigm-test-first.md`; the other three are mentioned in constitution metadata but lack library entries — pre-existing drift, not introduced by this feature). Directive: `TEST_FIRST` (from constitution context bootstrap).

| Gate | Verdict | Notes |
|---|---|---|
| **CLEAN_CODE** — no premature abstraction | ✅ PASS | Pure JSON templates following the existing shape. No new abstraction, no new helper. |
| **MINIMAL_TOOLING** — no build pipeline, classic scripts | ✅ PASS | No new dependency, no new tool. JSON loaded by existing Phaser preloader. |
| **MODULAR_SCENES** — keep Phaser scenes modular | ✅ PASS | Templates are scene-agnostic; consumed by the existing `applyRoomTemplate` in `js/roomTemplates.js`. No scene code changes. |
| **TEST_FIRST** — risky logic verified before commit | ✅ PASS | `tests/roomNav.test.js` already encodes the room-validity contract (protected-tile set + flood-fill reachability). Each new template will be added as a test case that loads the JSON and asserts the contract. No new test machinery required. |
| **Performance** — < 5 ms load per template (NFR-01) | ✅ PASS | JSON parsing of ~1 kB is sub-ms on all target platforms; Phaser caches the parsed object. |
| **Memory** — ≤ 50 KB total footprint (NFR-02) | ✅ PASS | 6 × ~1 kB JSON + parsed object overhead ≪ 50 KB budget. |

**Gate result: PASS**. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
kitty-specs/049-more-room-layouts/
├── plan.md              # This file (/spec-kitty.plan output)
├── spec.md              # Feature specification (already authored)
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
└── tasks.md             # Phase 2 output — NOT created here (/spec-kitty.tasks)
```

### Source Code (repository root)

```
js/
├── roomTemplates/
│   ├── manifest.json                # +N entries in `templates` array, bump `count`
│   ├── <NewTemplate1>.json          # NEW — corridor variant
│   ├── <NewTemplate2>.json          # NEW — pillared hall
│   ├── <NewTemplate3>.json          # NEW — asymmetric chamber
│   ├── <NewTemplate4>.json          # NEW — multi-tier (visual height bands)
│   └── <NewTemplate5..6>.json       # NEW — optional extras (corridor 2 / pillared 2)
├── roomTemplates.js                 # MODIFIED — append new names to RT.MANIFEST (picker pool)
└── scenes/
    └── startScene.js                # MODIFIED — append new names to templateNames preload list (~line 245)
                                     #            and allTemplateNames registration list (~line 526)

tests/
└── roomNav.test.js                  # MODIFIED — add per-template assertion blocks for each new layout
```

**Structure Decision**: Single-project layout. Each new template is one JSON file plus three one-line registrations (preload, registration loop, picker manifest). The `tests/` change adds N new test cases — one per template — exercising the protected-tile + flood-fill contract.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations. Section intentionally empty.
