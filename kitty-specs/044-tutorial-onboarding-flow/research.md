# Research: Tutorial Onboarding Flow

**Feature**: 044-tutorial-onboarding-flow
**Date**: 2026-05-02
**Plan**: [plan.md](plan.md)

## Purpose

Resolve every open technical question identified during planning so that no `[NEEDS CLARIFICATION]` markers remain when work-package generation begins.

## Decisions

### D-01 — Persistence key separation

- **Decision**: Persist tutorial state under a dedicated `localStorage` key `demonfall_tutorial_v1`. Do **not** add fields to the existing `demonfall_save_v1` save blob.
- **Rationale**: Spec Constraint C-07 requires that replaying the tutorial cannot affect game saves. The `Persistence` module already exposes `clearAllSaves()` which intentionally preserves settings; following the same per-concern key strategy keeps `tutorialSystem` self-contained and lets a future cleanup remove only its own key.
- **Alternatives considered**:
  - *Bundle inside `demonfall_save_v1`* — rejected because resetting the tutorial would require either a partial-overwrite codepath (fragile) or wiping the save (forbidden).
  - *Use `Persistence.SETTINGS`* — rejected because settings carry user preferences (audio/language) that should survive `clearAllSaves()` and should not be reset by the replay action.

### D-02 — Highlight rendering

- **Decision**: Render the target highlight as a Phaser `Graphics` object that draws a 3 px outline rectangle (or circle for NPCs) around the target's bounding box. Animate with a Phaser tween that pulses alpha between 0.4 and 1.0 at 1 Hz. Re-attach to a new target whenever the active step's `targetRef` changes; destroy when no step is active.
- **Rationale**: Spec Constraint C-05 forbids new sprite assets. `Graphics` is already in use across scenes (e.g., `hudV2.js` HP bars), so this introduces no new pattern. One `Graphics` instance + one tween per active step is well below NFR-01's perf budget.
- **Alternatives considered**:
  - *Per-frame re-draw with custom shader* — rejected as overkill; `Graphics` + tween already supports alpha pulses cleanly.
  - *PNG arrow asset* — rejected by user decision (target highlight, not arrow).

### D-03 — Event surface (pub/sub vs. direct calls)

- **Decision**: Scenes notify the tutorial via `tutorialSystem.report(eventName, payload)`. The state machine matches the event against the current step's `completion.event` (and optional `matcher`); on match, it advances and fires `onChange` for subscribers. Reverse direction: overlay subscribes via `tutorialSystem.onChange(cb)` for re-renders.
- **Rationale**: Mirrors `inputScheme.onChange` and `i18n.onChange` patterns already in the codebase. Keeps `tutorialSystem` decoupled from Phaser, which is the precondition for unit-testability under `node:test`.
- **Alternatives considered**:
  - *Direct method calls per step (`tutorial.completeMovement()`)* — rejected because it leaks step IDs into every scene and breaks if step IDs change.
  - *Phaser event emitter on a global scene* — rejected because it forces tests to load Phaser.

### D-04 — Druckerei stub dialog

- **Decision**: Add a `lines[]` page array to the existing Setzer Thom NPC entry in `js/scenes/hub/hubLayout.js`. Localize via i18n key `tutorial.druckerei.stub`. The dialog renders through the existing `_showDialoguePages` codepath in `HubSceneV2.js`.
- **Rationale**: Constraint C-01 forbids a new dialog engine. The existing dialog system already supports static page arrays. The string lives in `tutorialSystem.js`'s i18n registration block (so it ships and unships with the tutorial feature) but is consumed by `hubLayout.js` via the standard `i18n.t()` path.
- **Alternatives considered**:
  - *Phaser `BitmapText` toast* — rejected: spec says "speaks to Setzer Thom", which implies the existing dialog modal.
  - *Open the dialog directly from `tutorialSystem`* — rejected: violates the decoupling principle in D-03.

### D-05 — Skip-confirmation UX

- **Decision**: When the player toggles the skip option in the Settings scene, use a plain `window.confirm()` to confirm. If the user accepts, the tutorial transitions to `skipped: true` and the overlay disappears immediately. If the user cancels, the toggle reverts.
- **Rationale**: Settings is a pause-menu context where a Phaser dialog isn't already mounted; `window.confirm()` matches the simplicity of other Settings actions. A more elaborate in-game ESC-confirm flow is out of MVP scope (spec only mandates "skip works mid-tutorial", not how the prompt looks).
- **Alternatives considered**:
  - *In-game Phaser modal* — rejected: would require a new dialog scaffold inside Settings, scope creep.
  - *No confirmation at all* — rejected: spec FR-09 mandates a confirmation step.

### D-06 — Auto-skip timing

- **Decision**: `StartScene`'s "New Game" handler calls `tutorialSystem.maybeAutoSkip()` synchronously before the scene transition to `HubSceneV2`. Auto-skip runs whenever `Persistence.hasSave() === true` AND the player has not already explicitly opted out (which would already mark `skipped: true`).
- **Rationale**: NFR-05 requires zero tutorial frames for returning players. Doing the check at the scene boundary guarantees the first frame of `HubSceneV2` is rendered with `tutorialSystem.isActive() === false`.
- **Alternatives considered**:
  - *Check inside `HubSceneV2.create`* — rejected: a one-frame flicker of the overlay is possible if other init code runs first.
  - *Always check on every scene `create`* — rejected: redundant; one check at session start is sufficient.

### D-07 — Out-of-order event handling

- **Decision**: `report(eventName, payload)` is a no-op when the event does not match the current step. Events that arrive before their step is reached are dropped. The "first" matching event after a step becomes active satisfies the step.
- **Rationale**: Spec edge cases explicitly call out this scenario (loot picked up before step 9, ability used before step 8). The simplest and most predictable behavior is to advance only on the next matching event after the step becomes current.
- **Alternatives considered**:
  - *Buffered events that auto-complete on step entry* — rejected: would skip past prompts the player hasn't seen, defeating the tutorial purpose.

### D-08 — Combat-hit detection point

- **Decision**: Add a single `tutorialSystem.report('combat.hit', { byPlayer: true })` call in the existing damage-application path of `GameScene` (or `enemy.js`'s damage entry, whichever is the single funnel for player-dealt damage). Same approach for `combat.kill` (after enemy dies) and `combat.ability.used` (already centralized in `abilitySystem.js`).
- **Rationale**: One report per logical event, placed at the existing single funnel. Avoids scattering conditionals through enemy AI or ability variants.
- **Alternatives considered**:
  - *Phaser physics overlap callback* — rejected: too coarse, fires multiple times per frame.

### D-09 — i18n registration boundary

- **Decision**: `tutorialSystem.js` calls `window.i18n.register('de', {...})` and `register('en', {...})` at IIFE evaluation time, registering all ~25 strings. The Druckerei stub line lives here too, even though `hubLayout.js` consumes it.
- **Rationale**: Single source of truth for tutorial strings. Same pattern is used by other modules (e.g., `inputScheme.js` registers its own keys at load time).
- **Alternatives considered**:
  - *Strings in a separate `tutorialStrings.js`* — rejected: unnecessary fragmentation for ~25 keys.

### D-10 — Test seam (`_configureForTest`)

- **Decision**: `tutorialSystem` exposes `_configureForTest({ storage, now, i18n, scheduler })`. Tests inject:
  - `storage` — in-memory `{ getItem, setItem, removeItem }` stub
  - `now()` — controllable clock for the 5-second auto-dismiss in step 11
  - `i18n` — no-op stub (returns key as value)
  - `scheduler` — `setTimeout`/`clearTimeout` shim so the auto-dismiss can be advanced synchronously in tests
- **Rationale**: Mirrors the test seam in `inputScheme.js`. Keeps tests free of Phaser, real timers, and real localStorage.

## References

- `tests/inputScheme.test.js` — pattern for IIFE module testing under `node:test`
- `js/inputScheme.js` — pattern for `_configureForTest`, `onChange`, persistence-key ownership
- `js/persistence.js` — how `clearAllSaves()` distinguishes save data from settings
- `js/scenes/HubSceneV2.js:850–1188` — `_showDialoguePages` reuse target
- `js/scenes/hub/hubLayout.js:91–164` — Setzer Thom NPC entry
