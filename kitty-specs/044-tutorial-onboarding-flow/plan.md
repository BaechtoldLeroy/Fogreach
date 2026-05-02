# Implementation Plan: Tutorial Onboarding Flow

**Branch**: `main` (planning + merge target — no feature branch in this project) | **Date**: 2026-05-02 | **Spec**: [spec.md](spec.md)
**Input**: [kitty-specs/044-tutorial-onboarding-flow/spec.md](spec.md)

## Summary

A 12-step guided onboarding for first-time players. The system is decomposed into a **pure-logic state machine** (`tutorialSystem`, fully unit-testable via the existing `node:test` harness) and a **Phaser overlay** (`tutorialOverlay`, validated through the existing Playwright smoke test). Scenes report player events to the state machine; the overlay subscribes to state changes and renders a persistent banner plus a runtime-drawn highlight outline around the contextual target. Skip is honored at any time; replay resets only the tutorial-specific local-storage key.

## Technical Context

**Language/Version**: JavaScript (browser ES2017+, IIFE module pattern; no transpiler).
**Primary Dependencies**: Phaser 3 (CDN-loaded, no bundler). Existing in-repo modules: `js/i18n.js`, `js/storage.js`, `js/persistence.js`, `js/hudV2.js`, `js/scenes/HubSceneV2.js`, `js/scenes/GameScene.js`, `js/scenes/SettingsScene.js`, `js/scenes/StartScene.js`, `js/scenes/hub/hubLayout.js`, `js/inputScheme.js`.
**Storage**: Browser `localStorage` under dedicated key `demonfall_tutorial_v1` (separate from `demonfall_save_v1` per Constraint C-07).
**Testing**: `node:test` (Node built-in) via `tools/runTests.js` for the state machine; `tools/testGame.js --loadout` (Playwright) smoke for the overlay; visual review for the highlight effect.
**Target Platform**: Modern desktop browsers (Chrome/Firefox/Edge/Safari) — same matrix the rest of Demonfall already targets.
**Project Type**: Single-project, vanilla JS browser game with co-located `tests/` directory at repo root. No `src/` separation exists.
**Performance Goals**: 60 fps sustained while overlay is active (NFR-01). Highlight outline drawn with one Phaser `Graphics` object per active target; pulse uses Phaser tween (no per-frame full re-draw).
**Constraints**: No new asset files (Constraint C-05). Reuse existing dialog/HUD/i18n modules (Constraints C-01–C-03). Cannot modify Wave 1 spawn config (Constraint C-04). Must work with stub Druckerei (Constraint C-06). Must be backward-compatible (NFR-04). Auto-skip MUST run before tutorial UI renders (NFR-05). Language change MUST update visible text within one frame (NFR-03).
**Scale/Scope**: 12 steps, ~25 i18n strings × 2 languages, 2 new files (`js/tutorialSystem.js`, `js/scenes/tutorialOverlay.js`), 5 modified files (StartScene, HubSceneV2, GameScene, SettingsScene, `index.html` for `<script>` include).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution context (compact mode) reports: `paradigms: test-first`, `directives: TEST_FIRST`, tools `git, spec-kitty`. The full constitution is at [reference/constitution.md](../../reference/constitution.md). The compact context surfaced no other binding gates.

| Gate | Status | Notes |
|------|--------|-------|
| TEST_FIRST | ✅ Plan compliant | `tutorialSystem` unit tests (Phase 0 of work) are written and red before any production logic; overlay validated by smoke test that exists today. WP sequencing in `/spec-kitty.tasks` will enforce test-before-code. |
| Vanilla-JS reuse pattern (codebase convention) | ✅ Plan compliant | Both new files follow the IIFE-on-window pattern used by `inputScheme.js`/`hudV2.js`; expose `_configureForTest(primitives)` for stubability. |
| Pacing.Early Game (Constitution §Pacing) | ✅ Aligned | Tutorial fits the documented 10–15 min budget for first-session onboarding (NFR-02). |
| No new dialog engine (spec C-01) | ✅ Aligned | Druckerei stub dialog is rendered via existing `HubSceneV2` `_showDialoguePages`. |

**Re-check after Phase 1**: deferred until data-model.md and contracts are written below; revisited at end of this document.

## Project Structure

### Documentation (this feature)

```
kitty-specs/044-tutorial-onboarding-flow/
├── plan.md                  # This file
├── spec.md                  # Existing
├── research.md              # Phase 0 output (this command)
├── data-model.md            # Phase 1 output (this command)
├── quickstart.md            # Phase 1 output (this command)
├── contracts/
│   └── tutorial-system-api.md   # Phase 1 output: pub/sub + report contract
├── checklists/
│   └── requirements.md      # Existing (from /specify)
└── tasks/                   # Created later by /spec-kitty.tasks
```

### Source Code (repository root)

```
js/
├── tutorialSystem.js                  # NEW — pure-logic state machine (IIFE)
├── scenes/
│   ├── tutorialOverlay.js             # NEW — Phaser overlay (banner + highlight)
│   ├── StartScene.js                  # MODIFIED — auto-skip check on New Game
│   ├── HubSceneV2.js                  # MODIFIED — report events, mount overlay,
│   │                                  #            Druckerei stub dialog (NPC: Setzer Thom)
│   ├── GameScene.js                   # MODIFIED — report combat/loot events
│   └── SettingsScene.js               # MODIFIED — skip toggle + replay button
├── i18n.js                            # UNCHANGED — registration happens inside
│                                      #             tutorialSystem.js (existing pattern)
├── storage.js / persistence.js        # UNCHANGED — tutorialSystem owns its key
└── hudV2.js                           # UNCHANGED — overlay uses sibling layer

index.html                             # MODIFIED — add <script> includes for the
                                       #             two new files (load order:
                                       #             tutorialSystem before any scene
                                       #             that references it)

tests/
├── tutorialSystem.test.js             # NEW — node:test unit tests
├── setup.js                           # UNCHANGED — provides localStorage stub
└── loadGameModule.js                  # UNCHANGED — IIFE loader
```

**Structure Decision**: Vanilla browser game with no `src/` directory. New code lives under `js/` (logic) and `js/scenes/` (Phaser). New tests live under `tests/`. This matches the existing repository layout exactly — no restructure proposed.

---

## Phase 0: Research Outputs

See [research.md](research.md). Summary of decisions resolved during planning:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where to persist tutorial state? | New key `demonfall_tutorial_v1` in `localStorage`, owned by `tutorialSystem` (not added to the `Persistence` save key). | Spec C-07 requires separation. Replay must not touch the save. Mirrors how `inputScheme` owns its own scheme key. |
| How to render the highlight? | Phaser `Graphics` with a tween-driven alpha pulse drawn around the target's bounding box each scene update where a target is active. | Constraint C-05 forbids new sprite assets. `Graphics` already in use elsewhere in scenes. Per-frame cost is one fill+stroke. |
| Step-completion event surface | Pub/sub. Scenes call `tutorial.report(eventName, payload)`; tutorial advances if event matches the current step. | Avoids monkey-patching scenes. Mirrors `inputScheme.onChange` pattern. Easy to unit-test the state machine in isolation. |
| Druckerei dialog source | A new dialog page array is added to `hubLayout.js`'s NPC entry for Setzer Thom (under construction copy), localized via i18n. | Constraint C-01 forbids a new dialog engine. The existing `_showDialoguePages` already supports static page arrays from `lines[]`. |
| Skip-confirmation UX | Reuse the existing dialog choice mechanism in `HubSceneV2` (a 2-choice dialog: "Wirklich überspringen?" / "Abbrechen") OR a simple `window.confirm()` when triggered from `SettingsScene`. | First option is consistent with in-game UI; second is acceptable for the Settings entry where a Phaser dialog is unavailable. Decision: `window.confirm()` for Settings (simpler, settings is a pause-menu context); in-game ESC during tutorial can stay deferred (not in MVP scope per spec). |
| Scene-loading hook for auto-skip | `StartScene`'s "New Game" handler calls `tutorialSystem.maybeAutoSkip()` before transitioning to `HubSceneV2`. | NFR-05 requires zero-frame return for returning players. Doing it at the scene boundary guarantees no overlay frame ever renders. |
| Step ordering when player goes out-of-order | Steps that listen for an event later in the sequence still complete the first time the event matches their expected step. Out-of-order events for already-completed steps are no-ops. | Spec edge cases call this out (loot picked up before step 9, ability used before step 8). |
| First-hit detection in combat | `GameScene` reports `'combat.hit'` after the existing damage application code. | Re-using the existing damage path avoids new conditionals scattered through enemy AI. |

---

## Phase 1: Design Outputs

### data-model.md (state shapes)

See [data-model.md](data-model.md).

Persisted state shape (`demonfall_tutorial_v1`):

```json
{
  "version": 1,
  "active": true,
  "currentStepId": "movement",
  "skipped": false,
  "completedSteps": ["init"]
}
```

Step definition shape (in-memory, defined in `tutorialSystem.js`):

```js
{
  id: "movement",
  scene: "HubSceneV2",         // scene where this step is active
  hintKey: "tutorial.step.movement",  // i18n key
  targetRef: null,              // optional: { type: "entrance"|"npc", name: "Werkstatt" }
  completion: {
    event: "player.moved",
    matcher: (payload) => true  // optional predicate
  },
  autoDismissMs: null           // for step 11 only: 5000
}
```

### contracts/tutorial-system-api.md

See [contracts/tutorial-system-api.md](contracts/tutorial-system-api.md).

Public surface of `window.TutorialSystem`:

```text
init()                       — call once at app boot; loads persisted state
maybeAutoSkip()              — call from StartScene's New Game; returns true if skipped
report(eventName, payload)   — scenes report player events; may advance the current step
getCurrentStep()             — returns the current step descriptor or null
isActive()                   — true while a step is being shown
skip(confirmedByUser)        — manual skip (Settings toggle); records skipped=true
replay()                     — clears state, resets to step 1
onChange(callback)           — subscribe; called with the new step descriptor (or null)
                                whenever currentStepId/active changes
_configureForTest(primitives) — test-only entry: inject {storage, now, i18n, scheduler}
```

Event names emitted by scenes (the `report` vocabulary):

```text
player.moved                  — from HubSceneV2 update loop after first nonzero delta
hub.entrance.approached       — payload: { name }
hub.entrance.entered          — payload: { name }  (E-key trigger)
dialog.opened                 — payload: { npc }
dialog.closed                 — payload: { npc }
combat.hit                    — payload: { byPlayer: true }
combat.kill                   — payload: { enemyType }
combat.ability.used           — payload: { slot }
loot.dropped                  — payload: { itemId }
loot.picked                   — payload: { itemId }
inventory.opened              — (no payload)
inventory.equipped            — payload: { slot }
hub.returned                  — fired by HubSceneV2 on entry from GameScene
```

### quickstart.md (developer onboarding)

See [quickstart.md](quickstart.md). Walks a new contributor from `git pull` through running the new tests, launching the smoke test, and verifying the highlight visually.

### Agent context update

The repo does not currently maintain a separate agent context file (e.g., `CLAUDE.md`) — operations rely on `MEMORY.md` under `.claude/projects/...`. No update needed at this step beyond what the user's auto-memory already captures. (If a project-level `CLAUDE.md` is added later, the only entry warranted from this feature is: "Tutorial state persists under `demonfall_tutorial_v1`; do not bundle into the main save key.")

---

## Constitution Re-Check (post-Phase 1)

| Gate | Status | Notes |
|------|--------|-------|
| TEST_FIRST | ✅ | The contract above is fully unit-testable. Work-package sequencing in `/spec-kitty.tasks` will explicitly start with the `tutorialSystem.test.js` red bar. |
| Reuse over rewrite (spec C-01–C-03) | ✅ | Confirmed by contract: dialog stub re-uses `_showDialoguePages`; banner overlay co-renders with `hudV2`'s prompt layer; i18n registration uses existing `js/i18n.js`. |
| Performance (NFR-01) | ✅ | Highlight uses Phaser `Graphics` + tween — bounded cost, validated in smoke test. No new render passes. |
| Backward compatibility (NFR-04) | ✅ | Persistence shape carries `version: 1`; `tutorialSystem.init()` will guard against future migrations explicitly. |

All gates pass. Plan is ready for `/spec-kitty.tasks`.

---

## Complexity Tracking

No constitution violations; nothing to justify here.
