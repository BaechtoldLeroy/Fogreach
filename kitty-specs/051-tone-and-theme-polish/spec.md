# Specification: Tone and Theme Polish

**Feature**: 051-tone-and-theme-polish
**Created**: 2026-05-14
**Mission**: software-dev
**Tracker**: Issue #34 (Phase 2 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Phase-2 follow-up to feature 050 (Act-1 Quest Chain). The chain is mechanically complete but the political-theme delivery is uneven — Council quests sound generic, Widerstand quests sound generic-rebel, and the Akt-1 arc has no formal opener or closer to frame the demo. Issue #34 calls this out as the donor-demo risk: without recognizable theme anchors (Wissen / Zensur / Widerstand) the donor positioning falls flat.

This feature delivers the polish that makes the political message land WITHOUT new mechanics, new sprites, or new audio. Five surfaces:

1. Demo intro splash (3–4 sentence setup before the tutorial).
2. Demo outro splash (after Q6 — frames the demo as "Akt 1 done, Akt 2 awaits supporters").
3. Skip-tutorial toggle in Settings (for returning donors who replay).
4. Tone polish on Council vs Widerstand quest dialogues (bureaucracy-soothing-condescending vs urgent-emotional-concrete; subtext over plakat).
5. Three Akt-1 lore fragments embedded in the existing lore-fragment drop system: city-history-manipulated / Council-pact-with-something-older / protagonist-amnesia-not-random.

**Out of scope (deferred to separate issue / Phase 3):** new visual hub atmosphere (censored posters, faded flags, candles), new audio (bells, council march). Both require new assets — beyond this session's scope.

## 2. Stakeholders & Actors

- **Player (first-time donor)** — should feel the political tension by the end of Akt 1 without it being preached.
- **Player (returning donor)** — should be able to skip the tutorial they already played.
- **Existing systems touched**:
  - `js/tutorialSystem.js` — read a new "skip" flag from settings; existing `maybeAutoSkip(hasSave)` flow generalised to also skip when the explicit toggle is set.
  - `js/scenes/SettingsScene.js` — new toggle row `settings.gameplay.skip_tutorial`.
  - `js/questSystem.js` — refined dialogues for Q2–Q5 (existing 050 content gets a tone polish pass).
  - `js/eventSystem.js` — three new lore-fragment definitions added to the existing pool, gated to Act 1.
  - `js/scenes/HubSceneV2.js` — intro-splash modal on first-game-entry; outro-splash modal on Q6 completion.

## 3. User Scenarios

### Primary: First-time donor plays Akt 1

1. Player launches game, clicks New Game.
2. **Intro splash** appears before the tutorial — 3–4 sentences setting up the fog, the Chain Council, the protagonist's amnesia, and the central question "wer kontrolliert was du erinnerst?". Single Continue button.
3. Tutorial runs (044, existing).
4. Akt-1 quest chain runs (050, existing). During play, the player completes Q1–Q6 and picks up the three Akt-1 lore fragments via random events in the dungeon.
5. On Q6 completion → hub return, **outro splash** appears — frames the demo as "Akt 1 done, the deeper rot waits for Akt 2. If this resonated, support the next chapter at [donor link]." Plus the existing `act2_hook` fragment.
6. Tone polish: throughout Q2–Q5 dialogues, Council NPCs speak in bureaucracy-condescending tone; Elara speaks urgent + concrete + emotional but verifiable.

### Alternate: Returning donor replays

1. Player has a save with Akt 1 completed.
2. In Settings, toggles "Tutorial überspringen" → ON.
3. New Game → intro splash still shows (it's the demo opener, not the mechanics tutorial), then jumps straight into the hub without the tutorial steps.

## 4. Functional Requirements

| ID    | Requirement | Status |
|-------|-------------|--------|
| FR-01 | Intro splash MUST appear once per New Game, BEFORE the tutorial overlay activates. 3–4 sentences (~200 chars). | Draft |
| FR-02 | Intro splash MUST be dismissable via Continue button, ESC, Enter, or Space. | Draft |
| FR-03 | Outro splash MUST appear when `council_collusion_reveal` (Q6) is completed AND the player has returned to the hub. | Draft |
| FR-04 | Outro splash MUST reference the demo nature + donor hook + Akt-2 teaser. | Draft |
| FR-05 | A "Tutorial überspringen" toggle MUST appear in SettingsScene. Stored as `gameplay.skipTutorial`. | Draft |
| FR-06 | `tutorialSystem.maybeAutoSkip` MUST respect the new toggle — skip when EITHER hasSave OR toggle is on. | Draft |
| FR-07 | Q2/Q3/Q4 dialogues MUST be revised for bureaucratic-soothing-condescending tone — subtext via word choice. | Draft |
| FR-08 | Q5 (Elara/Widerstand) dialogue MUST be revised for urgent-emotional-concrete tone. | Draft |
| FR-09 | Three new Act-1 lore fragments MUST be defined in `js/eventSystem.js`: city-history-manipulated, Council-pact-older, protagonist-amnesia-orchestrated. | Draft |
| FR-10 | Lore fragments MUST drop via the existing event-spawn mechanism — no new spawn logic. | Draft |
| FR-11 | All new strings DE + EN. | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|----|-------------|-----------|--------|
| NFR-01 | Splash modals MUST dismiss cleanly — no input lock. | Manual playtest. | Draft |
| NFR-02 | Tone polish MUST preserve quest mechanics — only dialogue text changes. | Tests stay green. | Draft |
| NFR-03 | Settings change MUST persist via existing save/load flow. | Manual verification. | Draft |
| NFR-04 | Lore fragments MUST NOT collide with existing pool — unique IDs. | Grep verification. | Draft |

## 6. Constraints

| ID | Constraint | Status |
|----|------------|--------|
| C-01 | NO new mechanics. Splashes reuse existing modal pattern. | Draft |
| C-02 | NO new sprites, no new audio. | Draft |
| C-03 | Settings storage via existing localStorage `demonfall_settings_v1`. | Draft |
| C-04 | Tone polish keeps quest IDs / objectives / rewards intact. | Draft |
| C-05 | Splash modals MUST apply `_ktPropagateScrollFactor` (mobile-safe). | Draft |

## 7. Success Criteria

| ID | Criterion |
|----|-----------|
| SC-01 | First-time playtester can describe the political tension in 1–2 sentences after Akt 1. |
| SC-02 | Returning donor can toggle "Tutorial überspringen" and skip to the hub on next New Game. |
| SC-03 | All quest mechanics still work — tests stay green (251+). |
| SC-04 | Three Akt-1 lore fragments spawnable in a 10-room run. |
| SC-05 | All visible strings DE + EN. |
| SC-06 | Console clean. |

## 8. Edge Cases

- ESC mid-splash → instant dismiss, advance to next scene.
- Outro splash one-shot via `seenOutroSplash` flag.
- Settings change mid-game → applies on next New Game.
- Tutorial-skip flag + no save → toggle still works (FR-06 OR logic).

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| Intro splash | One-time modal, ~3–4 sentence world setup. |
| Outro splash | One-time modal on Q6 completion, donor hook + Akt-2 teaser. |
| Skip-tutorial toggle | `gameplay.skipTutorial` boolean in settings. |
| `fragment_lost_history` | Akt-1 lore: city archives edited. |
| `fragment_council_pact` | Akt-1 lore: pact older than the city. |
| `fragment_personal_amnesia` | Akt-1 lore: amnesia was orchestrated. |

## 10. Assumptions

- Existing lore-fragment event handler accepts new pool entries without structural change.
- `tutorialSystem.maybeAutoSkip` is the canonical entry point.
- `_showDialoguePages` is reusable for splash modals.
- Nested settings keys (`gameplay.skipTutorial`) are supported.

## 11. Out of Scope

- Hub visual atmosphere (posters, flags, candles) — needs art assets.
- Hub audio (bells, council march) — needs audio assets.
- Voice-acting.
- New tutorial steps.
- New mechanics.

## 12. Dependencies

- 050 features (questSystem 6-quest chain, factionSystem 5 standings, KnowledgeTree fragments) — live on `main`.
- 044 tutorial system.

## 13. Risks

- **R-01** — Dialogue tone misfires (bureaucratic ≠ menacing). Mitigation: sniff-test each revision.
- **R-02** — Outro splash timing (Q6 fires inside dialogue modal). Mitigation: trigger via hub-return hook, not direct quest-completion.
- **R-03** — Skip flag + no save edge case. Mitigation: explicit OR (hasSave || skipTutorialFlag).
- **R-04** — Lore-fragment text length exceeds modal. Mitigation: ~180-char limit, playtest verify.

## 14. References

- Issue #34, #32
- Feature 050 spec + WP02 quest catalog
- constitution.md §Goal Commercial §Setting §Narrative Arc
- Project memories: [[project_phaser_scrollfactor_dialogs]]
