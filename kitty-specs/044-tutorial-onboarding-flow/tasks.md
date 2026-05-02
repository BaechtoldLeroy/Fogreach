# Tasks: Tutorial Onboarding Flow

**Feature**: 044-tutorial-onboarding-flow
**Date**: 2026-05-02
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md) · **Data Model**: [data-model.md](data-model.md) · **Contract**: [contracts/tutorial-system-api.md](contracts/tutorial-system-api.md)

**Branch contract**: planning base `main` · merge target `main` · matches: true.

---

## Overview

| Stat                 | Value |
|----------------------|-------|
| Work packages        | 6     |
| Subtasks total       | 21    |
| Avg subtasks per WP  | 3.5   |
| Critical path        | WP01 → WP02 → (WP03 ∥ WP04 ∥ WP05) → WP06 |
| MVP recommendation   | WP01 + WP02 + WP03 (gives a runnable hub-only tutorial; WP04/WP05/WP06 polish & dungeon flow) |

The plan is **TEST_FIRST**: WP01 starts with a red unit-test bar for `tutorialSystem` before any production code is written.

File ownership is non-overlapping across all WPs. The state machine (WP01) is the foundation; the overlay (WP02) depends on its public API; scene-wiring WPs (WP03, WP04, WP05) all depend on WP01 and can be implemented in parallel after WP02 is merged.

---

## Subtasks (master list)

| ID    | Description                                                                                                          | Owner WP | Parallel |
|-------|----------------------------------------------------------------------------------------------------------------------|----------|----------|
| T001  | Write `tests/tutorialSystem.test.js` with all 15 contract test cases — RED bar.                                       | WP01     |          |
| T002  | Implement `js/tutorialSystem.js` IIFE: state machine, persistence, pub/sub, i18n registration, `_configureForTest`.   | WP01     |          |
| T003  | Run unit + smoke suites; verify all 15 tutorial tests GREEN and no regressions in pre-existing tests.                  | WP01     |          |
| T004  | Implement `js/scenes/tutorialOverlay.js`: banner Text + onChange subscription + scene mount API.                       | WP02     |          |
| T005  | Implement target-resolution + Graphics-based highlight outline + alpha-pulse tween in `tutorialOverlay.js`.            | WP02     |          |
| T006  | Update `index.html` to load `tutorialSystem.js` and `tutorialOverlay.js` in the correct order.                         | WP02     |          |
| T007  | Wire `js/scenes/StartScene.js`: call `TutorialSystem.maybeAutoSkip()` on the New Game click before scene transition.    | WP03     |          |
| T008  | Wire `js/scenes/HubSceneV2.js` event reports: `player.moved`, `hub.entrance.approached`, `hub.entrance.entered`, `dialog.opened`, `dialog.closed`, `hub.returned`. | WP03 |    |
| T009  | Mount `tutorialOverlay` inside `HubSceneV2.create()`.                                                                  | WP03     |          |
| T010  | Add Druckerei stub dialog: `js/scenes/hub/hubLayout.js` Setzer Thom NPC entry references the new i18n key.             | WP03     |          |
| T011  | Wire `js/scenes/GameScene.js` + `js/enemy.js`: emit `combat.hit` + `combat.kill` from the existing damage funnel.       | WP04     |          |
| T012  | Wire `js/abilitySystem.js`: emit `combat.ability.used` with `{ slot }`.                                                | WP04     | [P]      |
| T013  | Wire `js/lootSystem.js`: emit `loot.dropped` and `loot.picked`.                                                         | WP04     | [P]      |
| T014  | Locate inventory module; emit `inventory.opened` and `inventory.equipped`.                                              | WP04     |          |
| T015  | Mount `tutorialOverlay` inside `GameScene.create()`.                                                                    | WP04     |          |
| T016  | Add **Tutorial überspringen** toggle in `js/scenes/SettingsScene.js` with `window.confirm` and `tutorialSystem.skip(true)`. | WP05     |          |
| T017  | Add **Tutorial neu starten** button in `js/scenes/SettingsScene.js` with `window.confirm` and `tutorialSystem.replay()`.   | WP05     |          |
| T018  | Subscribe Settings labels to `i18n.onChange` so language switches update toggle/button text live (NFR-03).               | WP05     |          |
| T019  | Extend `tools/testGame.js` smoke to walk steps 1–6 (hub portion of the tutorial) and assert no console errors.            | WP06     |          |
| T020  | Manual run-through of the full 12-step happy path; record observations in `quickstart.md` validation appendix.            | WP06     |          |
| T021  | Manual verification: auto-skip with existing save, replay flow, mid-tutorial skip-toggle, language switch mid-tutorial.    | WP06     |          |

---

## WP01 — Tutorial state machine + tests (TEST_FIRST)

**File**: [tasks/WP01-tutorial-state-machine.md](tasks/WP01-tutorial-state-machine.md)

**Goal**: Deliver `window.TutorialSystem` matching the contract in [contracts/tutorial-system-api.md](contracts/tutorial-system-api.md), with a complete unit-test suite proving correctness in isolation. The IIFE auto-initializes on script load and registers all DE+EN i18n strings.

**Priority**: Critical (foundation for everything else).

**Independent test**: `npm test` runs all `tests/*.test.js` including the new `tutorialSystem.test.js`. All 15 tutorial tests pass; no regressions in pre-existing tests.

**Subtasks**:
- [x] T001 — Write `tests/tutorialSystem.test.js` (RED).
- [x] T002 — Implement `js/tutorialSystem.js`.
- [x] T003 — Verify GREEN + no regressions.

**Dependencies**: none.

**Risks**: i18n registration ordering (mitigated by IIFE pattern + `index.html` load order documented in WP02). Persistence-key migration (handled by `version` field; spec NFR-04).

**Estimated prompt size**: ~480 lines.

---

## WP02 — Tutorial overlay (banner + highlight)

**File**: [tasks/WP02-tutorial-overlay.md](tasks/WP02-tutorial-overlay.md)

**Goal**: Deliver `js/scenes/tutorialOverlay.js`, a Phaser layer that subscribes to `TutorialSystem.onChange`, renders the persistent hint banner, draws the target highlight (Graphics outline with alpha pulse), and exposes a mount API (`mount(scene)`, `unmount()`) so hub and game scenes can attach/detach it cleanly. Also: load both new scripts from `index.html` in the right order.

**Priority**: Critical — blocks any user-visible feedback.

**Independent test**: After WP01 ships, manually run the game; open DevTools console; call `TutorialSystem.replay()`; the banner appears and the Werkstatt entrance has a visible pulsing outline. Performance: 60 fps sustained on the same hardware that runs the game without the tutorial.

**Subtasks**:
- [ ] T004 — Banner + onChange subscription + mount API.
- [ ] T005 — Target resolver + highlight outline + alpha pulse.
- [ ] T006 — `index.html` script-include update.

**Dependencies**: WP01.

**Risks**: Highlight outline z-order vs HUD (NFR-01 perf). Mitigated by drawing on a dedicated container above scene gameplay but below HUD modals.

**Estimated prompt size**: ~400 lines.

---

## WP03 — StartScene + HubScene wiring + Druckerei stub

**File**: [tasks/WP03-hubscene-wiring.md](tasks/WP03-hubscene-wiring.md)

**Goal**: Make the tutorial actually progress in the hub. Hook `StartScene` to auto-skip on New Game; emit hub events (movement, entrance approach/enter, dialog open/close, hub return); mount the tutorial overlay; add the Druckerei stub dialog page so step 12 has a closing line.

**Priority**: High — first user-visible step path.

**Independent test**: With WP01+WP02 merged, walk a fresh-save player from spawn through step 6 (entering the dungeon). Banner advances at each milestone; highlight outline retargets correctly.

**Subtasks**:
- [ ] T007 — StartScene auto-skip wire-up.
- [ ] T008 — HubSceneV2 event emission (6 event types).
- [ ] T009 — HubSceneV2 overlay mount.
- [ ] T010 — Druckerei stub dialog (Setzer Thom).

**Dependencies**: WP01, WP02.

**Risks**: Existing HubSceneV2 already has interaction-prompt / entrance-detection code; new event reports must hook into the same logic to avoid double-trigger or drift.

**Estimated prompt size**: ~520 lines.

---

## WP04 — GameScene combat/loot/ability/inventory wiring

**File**: [tasks/WP04-gamescene-wiring.md](tasks/WP04-gamescene-wiring.md)

**Goal**: Emit dungeon-side events (combat hit/kill, ability use, loot drop/pickup, inventory open/equip) and mount the overlay in `GameScene` so steps 7–10 progress.

**Priority**: High — completes the dungeon arc of the tutorial.

**Independent test**: With WP01+WP02 merged, drop a player into a fresh dungeon run with the tutorial active at step 7; banner advances through hit → ability → loot → equip in any reasonable play order.

**Subtasks**:
- [ ] T011 — Combat hit + kill events.
- [ ] T012 — Ability event.
- [ ] T013 — Loot events.
- [ ] T014 — Inventory events.
- [ ] T015 — GameScene overlay mount.

**Dependencies**: WP01, WP02.

**Risks**: Multiple modules touched (combat funnel, ability, loot, inventory). One emission per logical event; avoid scattering inside per-frame loops.

**Estimated prompt size**: ~500 lines.

---

## WP05 — Settings UI: skip toggle + replay

**File**: [tasks/WP05-settings-ui.md](tasks/WP05-settings-ui.md)

**Goal**: Expose two controls in `SettingsScene`: a **Tutorial überspringen** toggle (uses `window.confirm`, calls `TutorialSystem.skip(true)`) and a **Tutorial neu starten** button (uses `window.confirm`, calls `TutorialSystem.replay()`). Subscribe labels to `i18n.onChange` so language switches update them live.

**Priority**: Medium — required for spec FR-09/FR-10/NFR-03 but parallelizable with WP03/WP04.

**Independent test**: With WP01 merged (WP02 not strictly required), opening Settings shows the two new controls; pressing the skip toggle while the tutorial is active deactivates it after confirmation; pressing the replay button resets state.

**Subtasks**:
- [ ] T016 — Skip toggle.
- [ ] T017 — Replay button.
- [ ] T018 — Live i18n re-render on language change.

**Dependencies**: WP01.

**Risks**: Settings layout density (visual). `window.confirm` UX is acceptable per design decision D-05.

**Estimated prompt size**: ~280 lines.

---

## WP06 — End-to-end validation (smoke + manual)

**File**: [tasks/WP06-e2e-validation.md](tasks/WP06-e2e-validation.md)

**Goal**: Extend the Playwright smoke to cover the hub portion of the tutorial; perform a manual full-loop run-through; record results. This is the final gate before merge.

**Priority**: Required for DoD — does not block earlier WPs but cannot be skipped.

**Independent test**: `npm run test:smoke` exits 0 with the new tutorial assertions in place. Manual checklist (auto-skip, full happy path, replay, mid-tutorial skip, language switch) all pass.

**Subtasks**:
- [ ] T019 — Smoke-test extension.
- [ ] T020 — Manual happy-path run-through + record.
- [ ] T021 — Edge-case manual verification (auto-skip, replay, skip-toggle, language switch).

**Dependencies**: WP01, WP02, WP03, WP04, WP05.

**Risks**: Manual steps are gating but quick (~30 min total).

**Estimated prompt size**: ~260 lines.

---

## Parallelization

After WP01 → WP02 ship, three WPs can run concurrently in separate worktrees:

```
WP01 (foundation, sequential)
   └── WP02 (overlay, sequential after WP01)
          ├── WP03 (hub wiring)        ← parallel
          ├── WP04 (game wiring)       ← parallel
          └── WP05 (settings)          ← parallel
                 └── WP06 (validation, after all merged)
```

Two agents could realistically pick WP03 and WP04 simultaneously without conflict.

## Requirement coverage

| Requirement | Covered by                |
|-------------|---------------------------|
| FR-01 (auto-skip)                | WP01, WP03 |
| FR-02 (init on new game)         | WP01, WP03 |
| FR-03 (persistence)              | WP01 |
| FR-04 (12 steps + advancement)   | WP01, WP03, WP04 |
| FR-05 (target highlight)         | WP02 |
| FR-06 (event detection)          | WP03, WP04 |
| FR-07 (auto-dismiss step 11)     | WP01 |
| FR-08 (Druckerei dialog)         | WP03 |
| FR-09 (skip toggle + confirm)    | WP05 |
| FR-10 (replay button)            | WP05 |
| FR-11 (i18n DE+EN)               | WP01, WP05 |
| FR-12 (non-blocking)             | WP01 (state-machine design), WP02 (overlay design) |
| NFR-01 (60 fps)                  | WP02, WP06 |
| NFR-02 (10–15 min)               | WP06 |
| NFR-03 (live i18n)               | WP01, WP05 |
| NFR-04 (backward compat)         | WP01 |
| NFR-05 (zero tutorial frames for returning)  | WP03 |
| C-01 (reuse dialog)              | WP03 |
| C-02 (reuse i18n)                | WP01 |
| C-03 (reuse HUD prompt)          | WP02 |
| C-04 (Wave 1 vanilla)            | enforced by *not* modifying wave config in any WP |
| C-05 (no sprite asset)           | WP02 |
| C-06 (Druckerei stub)            | WP03 |
| C-07 (separate storage key)      | WP01 |
