# Specification: Tutorial Onboarding Flow

**Feature**: 044-tutorial-onboarding-flow
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #29 (Phase 1 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Demonfall lacks a structured introduction for new players. First-time players currently spawn into the central hub with no guidance toward core mechanics (movement, combat, loot, dialog, save persistence) or the three hub locations (Werkstatt, Rathauskeller, Druckerei). This feature adds a guided 12-step onboarding that walks a new player through every core verb in 10–15 minutes and lets returning players skip without friction.

The tutorial is **non-blocking ambient guidance**: hints appear as on-screen prompts and target highlights; the player is never trapped in a modal. Skipping is honored at any moment.

## 2. Stakeholders & Actors

- **First-time player** — primary actor; has no save, sees the full guided flow.
- **Returning player** — has an existing save; tutorial is auto-skipped.
- **Player who manually skipped** — opted out via Settings; can re-trigger via the replay control.
- **Donor / demo viewer** — Vertical Slice consumer; experiences the polished onboarding as the entry point of the demo build.

## 3. User Scenarios

### Primary Scenario: New player completes the tutorial

1. Player launches the game with no save data and clicks **New Game** on the start screen.
2. The tutorial initializes silently and the player spawns in the central hub.
3. A persistent banner reads "WASD zum Bewegen". The player moves; the banner advances.
4. The banner reads "Geh zur Werkstatt" and the Werkstatt entrance pulses with a highlight outline. The player walks toward it.
5. Near the Werkstatt entrance the banner reads "[E] um zu sprechen". The player presses E and the dialog with Branka opens via the existing dialog system. After the dialog closes, the banner advances.
6. Steps 5–6 repeat for the Rathauskeller, ending with the player entering the dungeon.
7. In the dungeon the banner reads "WASD bewegen, LMB/Space angreifen". The player damages an enemy; the banner advances.
8. After the first kill, the banner reads "Ability-Slot 1 — Q drücken". The player triggers the ability; the banner advances.
9. When loot drops, the banner reads "Klick zum Aufheben". The player picks up the item; the banner advances.
10. When the inventory opens, the banner reads "Rechtsklick zum Anlegen". The player equips the item; the banner advances.
11. Returning to the hub, the banner reads "Dein Fortschritt wird automatisch gespeichert" for ~5 seconds, then auto-dismisses.
12. The banner reads "Geh zur Druckerei" with the Druckerei entrance highlighted. The player approaches and speaks to Setzer Thom, who delivers a stub line indicating the location is under construction. The tutorial ends and the banner disappears.
13. Total elapsed wall-clock time is approximately 10–15 minutes.

### Alternate Scenario: Returning player skips automatically

1. Player launches the game with an existing save and clicks **Continue** (or **New Game** after a save exists).
2. The tutorial detects the existing save, marks itself as skipped, and never displays a banner or highlight.

### Alternate Scenario: Mid-tutorial manual skip

1. The tutorial is active.
2. The player opens the Settings scene and toggles **Tutorial überspringen**.
3. A confirmation prompt asks the player to confirm; the player accepts.
4. The banner and any active highlights disappear immediately. The player retains all in-game progress made so far (inventory, position, save state).

### Alternate Scenario: Replay after skip or completion

1. The player opens Settings and clicks **Tutorial neu starten**.
2. The tutorial state is reset; the next time the player enters the hub or game scene, the tutorial resumes from step 2.
3. Save data, inventory, and position are unaffected.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                                            | Status |
|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | The system MUST detect whether a save exists when the player begins a session and auto-skip the tutorial when one does.                                | Draft  |
| FR-02 | The system MUST initialize the tutorial when a new game is started without an existing save and the player has not previously opted out.               | Draft  |
| FR-03 | The system MUST persist tutorial progress (current step, skipped flag) across browser reloads using local storage.                                     | Draft  |
| FR-04 | The system MUST display each of the 12 ordered steps with a localized hint string and advance only when the step's completion condition is satisfied. | Draft  |
| FR-05 | The system MUST highlight the contextual target (entrance, NPC) for each navigation-oriented step using a visible outline or glow effect.              | Draft  |
| FR-06 | The system MUST detect first-movement, dialog-completion, scene-transition, first-hit, first-kill, first-ability-use, loot-pickup, and equip events to advance the relevant tutorial steps. | Draft  |
| FR-07 | The system MUST auto-dismiss the save-concept hint (step 11) after approximately 5 seconds without requiring player input.                              | Draft  |
| FR-08 | The Druckerei dialog (step 12) MUST present a localized "under construction" message and complete the tutorial when closed.                              | Draft  |
| FR-09 | The Settings scene MUST expose a toggle to skip the active tutorial; activating the toggle MUST require a confirmation step.                            | Draft  |
| FR-10 | The Settings scene MUST expose a control to reset and replay the tutorial without affecting any other save data.                                        | Draft  |
| FR-11 | All tutorial-facing strings MUST be available in German (primary) and English via the existing i18n system.                                              | Draft  |
| FR-12 | The system MUST NOT block, gate, or otherwise restrict normal player actions outside of the highlighted prompts (no forced movement, no input lock).    | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                                                                  | Threshold / Metric                                            | Status |
|--------|--------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|--------|
| NFR-01 | The tutorial overlay MUST NOT degrade frame rate.                                                             | 60 fps sustained on the same hardware that runs the game without tutorial. | Draft  |
| NFR-02 | A complete tutorial run from step 1 through step 12 MUST take approximately 10–15 minutes of wall-clock time. | Median run between 10 and 15 minutes for an attentive new player. | Draft  |
| NFR-03 | Switching between German and English MUST update all tutorial strings without requiring a reload.              | All visible tutorial text reflects the new language within one frame of the language change. | Draft  |
| NFR-04 | The persisted tutorial state MUST remain backward-compatible for one major version.                            | Loading a v1 state in a future version MUST not throw or lose unrelated save data. | Draft  |
| NFR-05 | The auto-skip check MUST run before any tutorial UI is rendered.                                               | Returning players see zero tutorial frames at session start. | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                                            | Status |
|-------|---------------------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Implementation MUST reuse the existing HubSceneV2 dialog system for any conversational hints; no new dialog engine is to be introduced. | Draft  |
| C-02  | Implementation MUST reuse the existing i18n module (`js/i18n.js`) for all string registration.                                          | Draft  |
| C-03  | Implementation MUST reuse the existing HUD prompt rendering (`createPrompt()` in `js/hudV2.js`) where appropriate.                      | Draft  |
| C-04  | Tutorial MUST NOT modify the difficulty curve of Wave 1 in the dungeon; the standard spawn count and enemy mix apply.                   | Draft  |
| C-05  | Tutorial MUST NOT depend on assets that do not yet exist; target highlighting MUST be achieved via runtime rendering (glow/outline), not a sprite asset. | Draft  |
| C-06  | Druckerei step MUST work even though the Druckerei is currently a stub (Issue #24); the tutorial MUST NOT block on Issue #24.            | Draft  |
| C-07  | Persisted tutorial state MUST be stored under a dedicated local-storage key (separate from `demonfall_save_v1`) so resetting the tutorial cannot affect game saves. | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                              |
|-------|----------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | An attentive first-time player completes all 12 steps without external help in 10–15 minutes.                                           |
| SC-02 | A returning player with an existing save sees no tutorial UI at all.                                                                    |
| SC-03 | A player who toggles the manual skip mid-tutorial sees the overlay disappear within one frame and never sees it again until they replay. |
| SC-04 | A player who clicks the replay control sees step 2 of the tutorial within one scene transition; their save and inventory are untouched. |
| SC-05 | The tutorial flow produces zero console errors during a complete run on the supported browsers.                                          |
| SC-06 | All 12 steps render correct strings in both German and English.                                                                          |

## 8. Edge Cases

- **Player closes the browser mid-tutorial** → on next launch, tutorial resumes from the persisted step.
- **Player dies in the dungeon during the combat intro (steps 7–10)** → tutorial state persists; on respawn the same step is active.
- **Player switches input scheme (classic ↔ ARPG) mid-tutorial** → hint strings MUST reflect the new bindings (e.g., "Q" vs. mouse button) on the next step display.
- **Player triggers an ability before killing an enemy** → step 8 still completes on next ability use after the first kill; out-of-order ability use does not break progression.
- **Player picks up loot before step 9 is reached** → the next loot pickup after step 9 becomes active satisfies the step.
- **Player toggles skip but cancels the confirmation** → tutorial remains active and the next event continues progression.
- **Save is wiped (New Game over existing save)** → tutorial state persists unless the player also resets it explicitly via Settings.
- **Player switches language mid-tutorial** → currently-shown banner re-renders in the new language without resetting progress.

## 9. Key Entities

| Entity            | Description                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------------|
| Tutorial state    | Persisted record of `{ active, currentStep, skipped }`; lives under its own local-storage key.                |
| Tutorial step     | One of 12 ordered units with an id, scene scope, hint string key, completion event/condition, and optional target reference. |
| Target reference  | Symbolic pointer to a hub entrance or NPC used to drive the highlight outline.                                |
| Hint banner       | Persistent on-screen text element rendered by the overlay; visible whenever a step has an active hint.         |
| Highlight outline | Visual emphasis applied at runtime (no sprite asset) to the current step's target.                            |

## 10. Assumptions

- The `hasSave()` helper in `js/storage.js` is the authoritative source of truth for "is this a returning player".
- The existing `js/i18n.js` module supports per-module string registration with German as the default and English as the secondary language.
- The existing HubSceneV2 dialog system can be invoked from a tutorial-driven trigger without duplicating its modal logic.
- The current Wave 1 (Brute + Imp) spawn is forgiving enough for a brand-new player; no special tutorial-only enemy setup is required.
- The browser localStorage is available (game already requires it for saves).

## 11. Out of Scope

- Voice-over or audio narration of tutorial steps.
- Story-quest content (delivered in Issue #33).
- Political/tonal pass on Act 1 dialog (delivered in Issue #34).
- Animated cutscenes or scripted camera moves.
- A complete Druckerei implementation (delivered in Issue #24).
- A tutorial path for the not-yet-existing alternative input modes beyond classic and ARPG.

## 12. Dependencies

- Existing systems: HubSceneV2 dialog, hudV2 prompt rendering, i18n module, storage/persistence module, settings scene, input scheme module.
- Issue #41 (i18n DE/EN) — already done; this feature relies on its infrastructure.
- Issue #24 (Druckerei) — explicitly NOT a blocker; tutorial uses a stub line.

## 13. Risks

- **R-01**: A subtle race between scene-transition events and step-advance events could cause a step to never resolve. Mitigation: integration test that walks the entire flow.
- **R-02**: Highlight outline may clash visually with existing HUD elements. Mitigation: visual review during implement phase.
- **R-03**: First-time players on slow hardware may exceed the 15-minute budget. Mitigation: budget is a target, not a hard cap; SC-01 specifies "attentive player".

## 14. References

- Issue #29 — Tutorial / Act-1-Onboarding-Flow
- Issue #32 — Vertical Slice Epic
- Issue #24 — Printing House (Druckerei)
- `reference/constitution.md` §Pacing.Early Game
- `js/i18n.js`, `js/hudV2.js`, `js/scenes/HubSceneV2.js`, `js/storage.js`, `js/persistence.js`
