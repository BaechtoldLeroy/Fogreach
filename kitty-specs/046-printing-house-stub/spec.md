# Specification: Printing House (Stub)

**Feature**: 046-printing-house-stub
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #24 (Phase 1 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

The Druckerei is currently the third hub location only in name — its only behavior is a 1-line "under construction" dialog stub installed by the Tutorial feature (#29). This feature delivers a working stub of the Printing House: an NPC who lets the player publish one of two **edicts** that take effect on the next dungeon run. The implementation proves the edict pattern (publish → persist → apply at run start → revoke after run) with a minimal catalog (2 edicts) and a minimal UI (existing dialog system + a 2-choice prompt). Edict availability is gated by Resistance standing from #25.

## 2. Stakeholders & Actors

- **Player** — visits the Printing House, picks an edict, sees its effect on the next run.
- **Drucker/Curator NPC** — single new NPC at the Druckerei location; presents the edict catalog as dialog choices.
- **Run-start systems** — Council patrol spawner (Edict A) and Mara's shop pricing (Edict B) read the active edict on dungeon entry.
- **Faction system (#25)** — gates Edict A on Resistance standing.

## 3. User Scenarios

### Primary Scenario: Publish Edict A → Patrol reduction

1. The player has Resistance standing ≥ 0.
2. The player enters the Druckerei (existing entrance from `hubLayout.js`).
3. The Drucker NPC opens dialog with a short framing line and two choices: **Patrouillen-Reduzierung** and **Händler-Discount**.
4. The player picks Patrouillen-Reduzierung; a confirmation toast appears ("Edikt veröffentlicht").
5. The active edict is persisted to localStorage.
6. The player enters the dungeon. Council patrol spawn count for this run is reduced (e.g., −50 % capped at minimum 1).
7. On returning to the hub, the active edict slot is cleared. The Drucker greets with a flavor line ("Die Presse ruht.").

### Alternate Scenario: Edict A unavailable due to standing

1. The player has Resistance standing < 0.
2. The Drucker dialog shows only **Händler-Discount** as a choice; the Patrouillen-Reduzierung option is hidden (or visible but greyed with a hint "[benötigt Resistance-Vertrauen]").
3. Picking Händler-Discount works exactly as Edict B (next-run -10 % at Mara).

### Alternate Scenario: Cancel without publishing

1. The player opens Drucker dialog and presses ESC.
2. No edict is set; no localStorage write.
3. The dialog closes; gameplay resumes.

### Alternate Scenario: Returning player with prior edict

1. The previous session ended mid-dungeon with Edict A active.
2. On reload (Continue), the active edict is restored from localStorage.
3. If the player is in the hub on reload, the edict still applies to the next run start.
4. If the player is in the dungeon on reload (rare, normally returning to hub on death), the active edict is preserved until run end, then cleared.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                              | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | The Druckerei entrance MUST trigger a dialog with the Drucker NPC instead of the under-construction stub line installed by #29.            | Draft  |
| FR-02 | The Drucker dialog MUST present a framing line plus exactly two edict choices when both are available; one choice when only one is available. | Draft  |
| FR-03 | Picking an edict MUST set the active edict in persistent state and confirm via a localized toast ("Edikt veröffentlicht").                   | Draft  |
| FR-04 | Edict A (Patrouillen-Reduzierung) availability MUST require `FactionSystem.getStanding('resistance') >= 0`.                                   | Draft  |
| FR-05 | Edict B (Händler-Discount) MUST always be available.                                                                                       | Draft  |
| FR-06 | At dungeon run start (transition from HubSceneV2 to GameScene), the active edict's effect MUST be applied: Edict A reduces Council patrol spawns by 50 % (rounded down, minimum 1); Edict B reduces all of Mara's shop prices for the run by 10 %. | Draft  |
| FR-07 | When the run ends and the player returns to the hub, the active edict slot MUST be cleared (one-shot per publication).                       | Draft  |
| FR-08 | Active edict state MUST persist across browser reload under a dedicated localStorage key.                                                   | Draft  |
| FR-09 | The dialog MUST localize all strings via `i18n` with German primary and English secondary translations.                                     | Draft  |
| FR-10 | The Drucker NPC MUST be reachable via the existing Druckerei entrance; no new entrance art or hub layout changes are required.              | Draft  |
| FR-11 | The publish flow MUST be testable in isolation: a public API (`PrintingHouse.publish(edictId)`, `getActive()`, `clearActive()`) backs the dialog. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                                                       | Threshold / Metric                                | Status |
|--------|---------------------------------------------------------------------------------------------------|----------------------------------------------------|--------|
| NFR-01 | Edict effect application at run start MUST add no measurable frame-time impact.                    | < 1 ms cumulative cost on the supported hardware.  | Draft  |
| NFR-02 | Persisted blob MUST be forward-compatible.                                                          | Loading a v1 blob in a future version MUST not throw or lose unrelated saves. | Draft  |
| NFR-03 | i18n switches MUST update Drucker dialog text within one frame of language change.                  | Verified manually.                                 | Draft  |
| NFR-04 | The system MUST NOT break existing Druckerei entrance behavior for builds without #25 (`FactionSystem` missing). | Edict A is hidden; Edict B works; no console errors. | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Implementation MUST follow the codebase IIFE-on-`window` pattern (mirror `js/inputScheme.js`, `js/tutorialSystem.js`, `js/factionSystem.js` from #25). | Draft  |
| C-02  | Persistence MUST use a dedicated localStorage key (separate from save, settings, tutorial, faction).                     | Draft  |
| C-03  | Implementation MUST reuse the existing HubSceneV2 dialog system (no new dialog engine).                                  | Draft  |
| C-04  | Implementation MUST NOT modify the Druckerei entrance hitbox / hub layout art.                                            | Draft  |
| C-05  | Implementation MUST NOT introduce a Druckerei sub-scene; the dialog is rendered in HubSceneV2 like every other NPC.       | Draft  |
| C-06  | When `FactionSystem` is missing or returns standing 0 for unknown reasons, Edict A MUST default to **unavailable** (fail-safe). | Draft  |
| C-07  | The 1-line tutorial stub installed by #29 MUST be replaced cleanly: same i18n key (`tutorial.druckerei.stub`) is removed or repurposed; the new NPC dialog is the only Druckerei behavior. | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | A player with Resistance standing ≥ 0 can publish Edict A and observes ≥ 30 % fewer Council patrols in the next dungeon run vs. the same room without an edict. |
| SC-02 | A player can publish Edict B and observes Mara's shop prices reduced by 10 % in the next visit; baseline restored on the run after.              |
| SC-03 | Hub return after a run with an active edict clears the slot; the next Drucker dialog shows the publication options again.                       |
| SC-04 | Resistance standing < 0 hides Edict A from the Drucker choice list; Edict B is still presented.                                                 |
| SC-05 | Active edict survives a browser reload mid-hub.                                                                                                 |
| SC-06 | Zero console errors during publish / apply / clear cycles.                                                                                      |
| SC-07 | Drucker dialog renders correctly in both German and English; language switch mid-dialog updates text within one frame.                           |

## 8. Edge Cases

- **Player publishes Edict A then loses Resistance standing before the run** → the published edict MUST still apply (publication is the gate, not run-start).
- **Player publishes Edict A while one is already active** → the second publication overwrites the first; toast confirms; no error.
- **Run aborted (player closes browser mid-run)** → on reload, edict is still active; the run-start hook fires when the player next enters the dungeon.
- **`FactionSystem` returns -100 for resistance** → Edict A is hidden; UI shows only one choice cleanly (no empty grey space).
- **Two edicts with conflicting hooks (future)** → out of MVP scope, but the API MUST allow at most one active edict at a time to avoid the question.
- **Save with edict id unknown to current build** (e.g. removed in a future update) → MUST not throw; defaults to no active edict; logs a warning once.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Edict id          | One of `patrol_reduction`, `merchant_discount` (string constant).                             |
| Active edict slot | The single currently published edict, or `null`. Persisted under a dedicated localStorage key. |
| Edict definition  | `{ id, labelKey, descKey, availability(state) -> bool, applyAtRunStart(scene) }` — a registry entry per edict. |
| Drucker NPC       | New NPC entry; renders via the existing dialog system.                                          |
| Persisted blob    | `{ version: 1, active: 'patrol_reduction' \| 'merchant_discount' \| null }`.                  |

## 10. Assumptions

- `FactionSystem` (#25) is implemented and exposes `getStanding(factionId)` with the 'resistance' faction id.
- The Council patrol spawn count is configurable per run (or a hook exists where a multiplier can be applied at spawn time).
- Mara's shop pricing accepts a per-run price multiplier (or a hook exists).
- The existing dialog system supports conditional rendering of choices (already verified during the Tutorial #29 work).

## 11. Out of Scope

- Full edict catalog (10+ edicts) — future work.
- Multi-effect or stacking edicts — future work.
- Edict cooldowns or cost currencies — future work.
- Visible city reactions (patrols on the hub map, edict posters, etc.) — polish.
- Story-gated Printing House availability — Phase 2+.
- Faction-locked Drucker variants (Council vs. Resistance edict catalogs) — Phase 2+.
- Replacing or extending the existing tutorial Druckerei step (#29 already covers it; #46 simply replaces the stub line).

## 12. Dependencies

- **Hard dependency**: #25 Faction System (MVP) — `FactionSystem.getStanding('resistance')`. C-06 provides a fail-safe for builds without it.
- Existing systems: HubSceneV2 dialog, hubLayout (Druckerei entrance), i18n, localStorage, the run-start handoff path (`HubSceneV2._enterLocation` → `GameScene`), and Mara's shop pricing.
- Affects: Tutorial #29 (replaces the `tutorial.druckerei.stub` content path, see C-07).

## 13. Risks

- **R-01**: The Council-patrol spawn config is buried in `js/main.js` or `js/enemy.js` without a clean hook. Mitigation: document a single multiplier insertion site during plan phase.
- **R-02**: Mara's shop pricing pipeline does not currently support per-run multipliers. Mitigation: add a thin runtime variable read at price compute time; falls back to 1.0 when no edict is active.
- **R-03**: Two edicts is too few to prove the pattern. Mitigation: out of MVP scope; the registry shape ensures adding more is a 1-entry change.

## 14. References

- Issue #24 — Printing House
- Issue #25 — Faction System (MVP) — hard dependency
- Issue #29 — Tutorial (installed the existing 1-line stub being replaced)
- Issue #32 — Vertical Slice Epic
- `reference/constitution.md` §Hub World, §Permanent Progression
- `js/scenes/HubSceneV2.js`, `js/scenes/hub/hubLayout.js`, `js/lootSystem.js` (Mara shop), `js/main.js` / `js/enemy.js` (patrol spawns)
