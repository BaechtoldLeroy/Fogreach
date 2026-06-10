# Specification: More Room Layouts

**Feature**: 049-more-room-layouts
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #5
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

The procedural-room pool currently feels repetitive — the same templates show up too often per run. This feature adds 4–6 new room templates (corridor, pillared hall, asymmetric chamber, multi-tier) to the existing `RoomTemplates.TEMPLATES` registry so the room picker has more variety. No new picker, no new gameplay system; the new templates plug into the existing JSON-template + manifest pipeline already validated by features 015/019/023.

## 2. Stakeholders & Actors

- **Player** — perceives variety as fewer repeated layouts per session.
- **Room picker** (existing in `js/main.js` / `js/roomTemplates.js`) — selects from `RoomTemplates.TEMPLATES`; expanded pool means longer mean-time-between-repeat.
- **Test pipeline** (existing `tests/roomNav.test.js`) — must accept the new templates without modification.

## 3. User Scenarios

### Primary: More variety per run
1. Player starts a fresh run.
2. The room picker draws templates from the expanded pool.
3. Across 10 rooms, the player encounters at least 7 distinct templates (vs. ~5 today).
4. New layouts include at least one corridor variant, one pillared hall, one asymmetric chamber, one multi-tier room.

### Alternate: Existing rooms still work
1. Existing templates (Arena, ArmoryVault, …) are selected at the same baseline rate.
2. `roomNav.test.js` continues to pass — flood-fill reachability, spawn-buffer, loot-tile protection still respected by every new template.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | Add **at least 4** and **at most 6** new room templates to `RoomTemplates.TEMPLATES`.                                          | Draft  |
| FR-02 | At least one template MUST be a corridor variant (long, narrow, single-direction movement bias).                              | Draft  |
| FR-03 | At least one template MUST be a pillared hall (multiple obstacle clusters, line-of-sight breaks).                              | Draft  |
| FR-04 | At least one template MUST be an asymmetric chamber (no axis of symmetry, encourages exploration).                             | Draft  |
| FR-05 | At least one template MUST be multi-tier (height bands or platforms — within current physics constraints).                      | Draft  |
| FR-06 | Each new template MUST be registered in `RoomTemplates.MANIFEST` so the picker selects it.                                     | Draft  |
| FR-07 | Each new template MUST pass the existing `roomNav.test.js` validation (flood-fill reachability + spawn-buffer + loot-tile protection). | Draft  |
| FR-08 | Each new template MUST honor existing tile protection rules: spawn point + 1-tile buffer free, entrance + 1-tile buffer free, loot tile reachable. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                          | Threshold                                  | Status |
|--------|----------------------------------------------------------------------|---------------------------------------------|--------|
| NFR-01 | Each new template MUST load in < 5 ms during room-picker selection.    | Measured via existing template-load timing. | Draft  |
| NFR-02 | Adding the templates MUST NOT increase memory footprint by more than 50 KB total. | Enforced via PR review.            | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Follow the existing JSON-template format (same key shape as Arena.json, etc.).                                            | Draft  |
| C-02  | Each template MUST be a separate `assets/.../<TemplateName>.json` file plus a one-line addition to the picker's `allTemplateNames` list. | Draft  |
| C-03  | MUST NOT change room picker logic or weighting.                                                                            | Draft  |
| C-04  | MUST NOT introduce new tilemap art beyond reusing existing wall/floor tile ids.                                            | Draft  |
| C-05  | Templates MUST be authored at the same nominal size as existing rooms (or document the deviation per template).             | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | All new templates pass `roomNav.test.js` validations.                                                                                           |
| SC-02 | A 10-room run encounters at least 7 distinct templates on average (sampled over 5 simulated runs).                                              |
| SC-03 | No regression in existing tests (`abilitySystem`, `eliteEnemies`, etc. unaffected).                                                             |
| SC-04 | Manual playtest: each new template feels visually distinct from existing ones.                                                                  |

## 8. Edge Cases

- New template's spawn-tile is unreachable → `roomNav.test.js` catches it during CI.
- New template clips with enemy spawn margins → caught by spawn-buffer tile rule (FR-08).
- Multi-tier room exceeds camera bounds → constrain template to current viewport size (C-05).
- Loot tile placed in an unreachable area → caught by flood-fill reachability test.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Room template     | JSON file in `assets/.../*.json` describing tile grid, obstacles, spawn point, entrances, loot tile. |
| Manifest entry    | One line in `RoomTemplates.MANIFEST` keyed by template name.                                   |

## 10. Assumptions

- `RoomTemplates.TEMPLATES` and the picker accept any new template that conforms to the existing JSON shape.
- The current tileset has enough wall/floor variations to express the new layouts visually (no new art needed).

## 11. Out of Scope

- Multi-room set-pieces (e.g. a 2-room sequence) — future work.
- Theme variations (snow, swamp) — different tilesets are not in this feature.
- Picker weighting or rarity tags — deferred (C-03).
- Boss arenas — those have their own pipeline.

## 12. Dependencies

- Existing systems: `js/main.js` `loadRoomTemplatesAndStart`, `js/roomTemplates.js`, room picker, `tests/roomNav.test.js`.

## 13. Risks

- **R-01**: Multi-tier rooms may not be feasible without physics changes. Mitigation: define "multi-tier" as visual height variation within existing flat physics; if true elevation is required, drop FR-05 to "asymmetric variant 2" and document.
- **R-02**: New templates may stylistically clash with existing rooms. Mitigation: use the same tile palette; visual review before merge.

## 14. References

- Issue #5 — Mehr Layout-Varianten
- `js/main.js` `loadRoomTemplatesAndStart` — template enumeration list
- `js/roomTemplates.js` — manifest
- `tests/roomNav.test.js` — validation suite
