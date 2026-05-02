# Tasks: Faction System (MVP)

**Feature**: 045-faction-system-mvp
**Date**: 2026-05-02
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md) · **Data Model**: [data-model.md](data-model.md) · **Contract**: [contracts/faction-system-api.md](contracts/faction-system-api.md)

**Branch contract**: planning base `main` · merge target `main` · matches: true.

## Overview

| Stat | Value |
|---|---|
| Work packages | 2 |
| Subtasks | 7 |
| Critical path | WP01 → WP02 |
| MVP recommendation | WP01 alone gives a working API; WP02 wires the showcase |

TEST_FIRST: WP01 starts red.

## Subtasks

| ID | Description | WP |
|---|---|---|
| T001 | Write `tests/factionSystem.test.js` with 15 contract test cases (RED). | WP01 |
| T002 | Implement `js/factionSystem.js` IIFE: state machine, persistence, pub/sub, i18n registration, `_configureForTest`. | WP01 |
| T003 | Add `<script src="js/factionSystem.js">` to `index.html` and verify GREEN + smoke. | WP01 |
| T004 | Add Aldric greeting variants in `js/scenes/hub/hubLayout.js` (or wherever Aldric's NPC entry lives) — register `faction.aldric.greet.*` keys. | WP02 |
| T005 | Add tier-aware greeting selection in `HubSceneV2._showNpcDialogue` for Aldric (read `FactionSystem.getTier('council')`). | WP02 |
| T006 | Extend `js/questSystem.js` with a `gate(player)` predicate field on quest definitions; filter offers via the new predicate. Add the showcase Resistance fetch quest. | WP02 |
| T007 | Manual verification + commit. | WP02 |

## WP01 — Faction state machine + tests (TEST_FIRST)

**File**: [tasks/WP01-faction-state-machine.md](tasks/WP01-faction-state-machine.md)

**Goal**: Deliver `window.FactionSystem` per the contract; full unit-test suite.

**Independent test**: `npm test` passes; new factionSystem tests all green; no regressions.

**Subtasks**: T001 → T002 → T003.

**Dependencies**: none.

**Estimated prompt size**: ~400 lines.

## WP02 — NPC variant + gated quest

**File**: [tasks/WP02-npc-variant-gated-quest.md](tasks/WP02-npc-variant-gated-quest.md)

**Goal**: Wire the showcase consumers — Aldric's tier-aware greeting and one Resistance-gated quest offer.

**Independent test**: Manual: `FactionSystem.adjustStanding('council', -30)` → Aldric greets hostile. `adjustStanding('resistance', 25)` → Resistance fetch quest appears in offer list.

**Subtasks**: T004 → T005 → T006 → T007.

**Dependencies**: WP01.

**Estimated prompt size**: ~350 lines.

## Requirement coverage

| Requirement | Covered by |
|---|---|
| FR-01..FR-08 (API + persistence) | WP01 |
| FR-09 (NPC variant) | WP02 |
| FR-10 (gated quest) | WP02 |
| FR-11 (safe before init) | WP01 |
| NFR-01..NFR-04 | WP01 |
| C-01..C-05 | WP01, WP02 |
