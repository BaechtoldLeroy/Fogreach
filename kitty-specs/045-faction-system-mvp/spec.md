# Specification: Faction System (MVP)

**Feature**: 045-faction-system-mvp
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #25 (Phase 1 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Demonfall has no faction state. The Constitution describes "multiple factions … player can align, play them off each other", and Phase 1 of the Vertical Slice depends on it: the Printing House (#24) needs faction standing to gate edict availability, and Acts 2–5 will branch on faction alignment. This MVP delivers the minimum-viable foundation: three named factions, a per-faction standing integer persisted in localStorage, a small public API consumed by other modules, two NPC greeting variants driven by standing, and one standing-gated mission as a working showcase.

## 2. Stakeholders & Actors

- **Player** — perceives faction standing only indirectly: NPC greeting changes, mission availability, future edict gating.
- **Other systems** — `Printing House` (#24) reads standing to filter edict list; `questSystem` consumes standing for at least one gated mission.
- **Future content authors** (Acts 2–5, #28 multiple endings) — need stable API now so quest scripts can read/write standing.

## 3. User Scenarios

### Primary Scenario: Standing changes via gameplay action

1. The player completes a mission whose reward is `+10` Resistance standing.
2. `FactionSystem.adjustStanding('resistance', 10)` is called by the quest reward path.
3. The new standing is clamped to `[-100, +100]` and persisted to localStorage.
4. Subscribers (NPC greeting refresh, edict-availability refresh in #24) re-evaluate.
5. The next time the player passes the relevant NPC, the greeting reflects the new standing tier.

### Alternate Scenario: NPC greeting variant

1. With Council standing < 0, the Council guard greets the player with a hostile line.
2. The player raises Council standing above 25.
3. On the next dialog open, the guard greets neutrally.
4. Above 50, the guard greets warmly and offers a faction-only mission.

### Alternate Scenario: Standing-gated mission

1. A Resistance NPC offers a mission only when Resistance standing ≥ 25.
2. With standing 24, the offer dialog page does not appear; standard flavor lines play.
3. Raising standing to 25 unlocks the offer on next dialog open.

### Alternate Scenario: Save migration

1. A save without faction state is loaded.
2. `FactionSystem.init()` detects the missing key and seeds defaults: `Council=0, Resistance=0, Independent=0`.
3. The player continues without disruption.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | The system MUST define exactly three faction identifiers as constants: `council`, `resistance`, `independent`.                | Draft  |
| FR-02 | The system MUST track a per-faction standing integer in the closed range `[-100, +100]`.                                       | Draft  |
| FR-03 | The system MUST expose `getStanding(factionId)` returning the current integer.                                                 | Draft  |
| FR-04 | The system MUST expose `adjustStanding(factionId, delta)` that adds `delta` (positive or negative) and clamps to `[-100, +100]`. | Draft  |
| FR-05 | The system MUST expose `setStanding(factionId, value)` for save migration; values outside the range MUST be clamped, not rejected. | Draft  |
| FR-06 | The system MUST persist standing for all three factions under a dedicated localStorage key.                                     | Draft  |
| FR-07 | The system MUST provide a subscribe API (`onChange(callback)`) that fires on every standing mutation, returning an unsubscribe function. | Draft  |
| FR-08 | The system MUST default to `0` for any faction missing in the persisted blob (forward-compatible for future factions).         | Draft  |
| FR-09 | At least one in-game NPC MUST present at least two greeting variants whose selection depends on the player's standing with that NPC's faction. | Draft  |
| FR-10 | At least one quest-offer dialog page MUST be conditionally rendered based on a standing threshold check.                       | Draft  |
| FR-11 | All public API calls MUST be safe before `init()` (return defaults; never throw).                                              | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                                          | Threshold / Metric                                  | Status |
|--------|--------------------------------------------------------------------------------------|------------------------------------------------------|--------|
| NFR-01 | API calls MUST complete in constant time relative to standing magnitude.              | O(1) per call; < 1 ms p99 on the supported hardware. | Draft  |
| NFR-02 | Persisted blob MUST remain forward-compatible for one major version.                  | Loading a v1 blob in a future version MUST not throw or lose unrelated save data. | Draft  |
| NFR-03 | The system MUST NOT introduce a new global per faction; only the module-level singleton. | Verified by code review.                          | Draft  |
| NFR-04 | A subscriber that throws MUST NOT prevent other subscribers from firing.               | Verified by unit test (mirror inputScheme/tutorialSystem pattern). | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Implementation MUST follow the codebase IIFE-on-`window` pattern (mirror `js/inputScheme.js`, `js/tutorialSystem.js`).   | Draft  |
| C-02  | Persistence MUST use a dedicated localStorage key (separate from `demonfall_save_v1` and other module keys).             | Draft  |
| C-03  | Implementation MUST NOT introduce a UI surface beyond NPC dialog text variants (no faction-reputation display in MVP).   | Draft  |
| C-04  | Implementation MUST NOT branch the existing main story flow beyond the showcase mission.                                  | Draft  |
| C-05  | The module MUST expose a `_configureForTest(primitives)` test seam matching the existing pattern.                         | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                              |
|-------|----------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | A unit test suite covers every public method (get/adjust/set/onChange/init) plus clamp behavior, persistence load, and exception swallowing on subscribers. |
| SC-02 | At least one NPC visibly switches greeting variant when standing crosses the configured threshold during gameplay.                     |
| SC-03 | At least one quest offer becomes available only above a standing threshold, and the unlock is observable in a single play session.     |
| SC-04 | Standing persists across browser reload; a wipe of the dedicated key restores defaults without affecting unrelated saves.              |
| SC-05 | Zero console errors during normal play paths that exercise standing changes.                                                           |
| SC-06 | The Printing House (#24) implementation can call `FactionSystem.getStanding('resistance')` without further API changes.                |

## 8. Edge Cases

- **Save loaded with standing > 100** (manual edit, future migration error) → clamp to 100 on load; no throw.
- **`adjustStanding` with zero delta** → no-op; subscribers are NOT notified.
- **Multiple `adjustStanding` calls in one tick** → each notifies subscribers; consumers de-bounce if needed.
- **Faction id misspelled by caller** → return `0` for `getStanding`; `adjustStanding`/`setStanding` log a single warning and no-op.
- **`onChange` subscriber that calls `adjustStanding` recursively** → the new mutation fires after the current notify loop completes; never deadlocks or recurses unboundedly (queue or guard required).
- **Faction id added in a future version** → MUST default to 0 when not present in old persisted blobs; old code reading only the three MVP factions MUST not throw.

## 9. Key Entities

| Entity            | Description                                                              |
|-------------------|--------------------------------------------------------------------------|
| Faction id        | One of `council`, `resistance`, `independent` (lowercased string constants). |
| Standing          | Integer in `[-100, +100]`; tier interpretation (hostile / neutral / friendly) is consumer-side. |
| Persisted blob    | `{ version: 1, standings: { council: int, resistance: int, independent: int } }` under a dedicated localStorage key. |
| Subscriber        | Function `(factionId, newValue, oldValue) => void` registered via `onChange`. |

## 10. Assumptions

- The existing `questSystem` supports gating quest offers via a callable predicate or pre-offer hook; if not, a thin wrapper is acceptable.
- The chosen NPC for FR-09 already exists in `HUB_HITBOXES` (most likely a Council guard or Resistance recruiter).
- `localStorage` is available; the same swallow-on-failure approach used by other modules applies here.

## 11. Out of Scope

- Faction-locked merchants (full inventory variants per faction) — future work.
- Sub-factions / hidden orgs — Acts 2+.
- UI faction-reputation display — Phase 2 when the player can no longer mentally track three numbers.
- Standing change toasts / animations — polish phase.
- Branching logic for Acts 2–5 (#31) — depends on this MVP but is not part of it.
- Multiple endings (#28) — same.

## 12. Dependencies

- Existing systems: `questSystem`, `HUB_HITBOXES`/`HubSceneV2` dialog, `i18n`, `localStorage`.
- Downstream consumers (NOT blockers, but unblocked by this): #24 Printing House, #28 Multiple Endings, #31 Story Acts 2–5.

## 13. Risks

- **R-01**: Without UI feedback (out of scope per C-03), players may not understand why content is gated. Mitigation: NPC dialog should foreshadow ("the Resistance does not yet trust you"); accept this as a known MVP limitation.
- **R-02**: The "showcase mission" choice may collide with Tutorial (#29) flow. Mitigation: pick a mission that becomes available after Act 0 / mid-Act 1, not at game start.

## 14. References

- Issue #25 — Faction-System
- Issue #32 — Vertical Slice Epic
- Issue #24 — Printing House (downstream consumer)
- `reference/constitution.md` §Storyline (multi-faction structure)
- `js/inputScheme.js`, `js/tutorialSystem.js` — reference implementation patterns
- `js/questSystem.js` — gating hook target
