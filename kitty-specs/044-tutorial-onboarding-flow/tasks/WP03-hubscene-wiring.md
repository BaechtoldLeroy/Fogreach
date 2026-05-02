---
work_package_id: WP03
title: StartScene + HubScene wiring + Druckerei stub
dependencies: [WP01, WP02]
requirement_refs:
- C-01
- C-06
- FR-01
- FR-02
- FR-04
- FR-06
- FR-08
- FR-12
- NFR-05
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: fd6913880151b93d4c4b89ac5552322b4b7ef960
created_at: '2026-05-02T12:27:51.447800+00:00'
subtasks: [T007, T008, T009, T010]
shell_pid: "22772"
agent: "claude"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/StartScene.js
- js/scenes/HubSceneV2.js
- js/scenes/hub/hubLayout.js
---

# WP03 — StartScene + HubScene wiring + Druckerei stub

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- **Implement-time base**: stack on top of WP02 (`spec-kitty implement WP03 --base WP02`).

## Objective

Make the tutorial actually progress through steps 1–6 and 11–12 (the hub portion). Wire `StartScene` to call `TutorialSystem.maybeAutoSkip()` on the New Game click; emit hub events from `HubSceneV2`; mount `TutorialOverlay` on hub entry; add the Druckerei stub dialog so step 12's "Setzer Thom" line can play through the existing dialog system.

## Context (read first)

- [spec.md](../spec.md) — FR-01, FR-02, FR-04, FR-06, FR-08, NFR-05, C-01, C-06.
- [data-model.md](../data-model.md) — event vocabulary; steps 1–6 + 11 + 12.
- [research.md](../research.md) D-04 (Druckerei dialog), D-06 (auto-skip timing).
- `js/scenes/StartScene.js` — find the existing New Game click handler; the `Persistence.hasSave()` check there is already what gates Continue vs New Game.
- `js/scenes/HubSceneV2.js` — already has interaction-prompt code, dialog code, scene-transition code. Hook into the existing single funnel for each event; do not introduce per-frame conditionals.
- `js/scenes/hub/hubLayout.js` — `HUB_HITBOXES` array. Setzer Thom NPC entry is where the Druckerei stub line goes.

## Event-to-source mapping (T008 cheat sheet)

| Event                       | Where to emit (existing code)                                                |
|-----------------------------|------------------------------------------------------------------------------|
| `player.moved`              | HubSceneV2 `update()` after the existing movement-applied block; emit once   |
|                             | per scene-life with payload `{dx, dy}` only on first non-zero motion.        |
| `hub.entrance.approached`   | Inside `_refreshInteractionPrompt()` (or whatever decides which entrance is  |
|                             | "currently selected"). Emit when the selected entrance changes from null to  |
|                             | a name.                                                                      |
| `hub.entrance.entered`      | Inside the E-key handler for entrance transitions, just **before** the scene |
|                             | switch. Payload: `{ name }`.                                                 |
| `dialog.opened`             | At the top of `_showDialoguePages` (or wherever the NPC dialog container is  |
|                             | created). Payload: `{ npc }` from the NPC name.                              |
| `dialog.closed`             | At the dialog-container destroy/close path. Payload: `{ npc }`.              |
| `hub.returned`              | In `HubSceneV2.create` after detecting an arrival from `GameScene` (i.e. not |
|                             | the first hub mount). No payload.                                            |

In every case: call `window.TutorialSystem?.report(event, payload)` defensively (the `?.` guards against script-load order issues during dev).

---

## Subtask T007 — StartScene auto-skip wire-up

**Purpose**: Satisfy NFR-05 — returning players see zero tutorial frames.

**Steps**:

1. Locate the New Game handler in `js/scenes/StartScene.js`. It typically looks like:
   ```js
   newGameButton.on('pointerdown', () => {
     // ...persistence wipe, scene transition...
   });
   ```

2. **Before** the scene transition (and **after** any save-wipe, if New Game wipes saves), insert:
   ```js
   if (window.TutorialSystem) {
     window.TutorialSystem.maybeAutoSkip();
   }
   ```

3. The Continue button does **not** need this wire-up — `maybeAutoSkip()` is keyed on `Persistence.hasSave()`, and Continue implies a save exists, but the call is harmless either way. Add it to Continue too for consistency.

4. Verify in the browser:
   - Wipe `demonfall_tutorial_v1` and `demonfall_save_v1` from localStorage.
   - Reload, click New Game.
   - In DevTools: `TutorialSystem.isActive()` returns `true`, `getCurrentStep().id` is `'movement'` (step 2).
   - Now wipe again, but this time pre-seed `demonfall_save_v1` with any non-empty string.
   - Reload, click New Game.
   - `TutorialSystem.isActive()` returns `false`.

**Files**:
- `js/scenes/StartScene.js` — modified (~5 lines added).

**Validation**:
- [ ] Auto-skip works as described.
- [ ] No console errors when New Game / Continue is clicked.

---

## Subtask T008 — HubSceneV2 event emission

**Purpose**: Drive step transitions for steps 2–6 and 11. Six events total.

**Steps**:

1. Read `HubSceneV2.js` carefully to identify the **single** location for each event. Do not scatter emissions inside per-frame blocks.

2. **`player.moved`** (step 2 trigger):
   - Add a flag `_movementReported = false` to the scene.
   - In `update()`, after the movement vector has been applied to the player sprite, check: `if (!this._movementReported && (vx !== 0 || vy !== 0))`. Set the flag and emit `report('player.moved', { dx: vx, dy: vy })`.
   - Reset the flag in `create()` (so it re-arms when the scene re-mounts).

3. **`hub.entrance.approached`** (steps 3, 5, 12 trigger):
   - Find `_refreshInteractionPrompt()` (per the explorer's earlier survey). That function tracks which interactable is "currently in range".
   - Add a `_lastApproachedName` field on the scene. When the function sets a new in-range entrance, compare against `_lastApproachedName`. If it changed and the new value is not null, emit `report('hub.entrance.approached', { name })`. Update the field.

4. **`hub.entrance.entered`** (steps 6, 12 trigger):
   - Find the E-key handler that triggers entrance transitions.
   - Just before `this.scene.start(...)`, emit `report('hub.entrance.entered', { name })`.

5. **`dialog.opened`** / **`dialog.closed`** (steps 4, 12 trigger):
   - In `_showDialoguePages`, emit `dialog.opened` at the top with the NPC name.
   - At the dialog close path (where `npcDialogContainer` is destroyed), emit `dialog.closed`.

6. **`hub.returned`** (step 11 context):
   - In `HubSceneV2.create()`, after the scene init, detect "this is a re-entry" — most scenes pass an arrival flag via `data` parameter. Use `this.scene.settings.data?.fromGame === true` or whichever convention this codebase uses. Emit `report('hub.returned', {})` only on re-entry.

7. Defensive guard everywhere: `window.TutorialSystem?.report(...)`.

**Files**:
- `js/scenes/HubSceneV2.js` — modified (~30 lines added across 5 hook points).

**Validation**:
- [ ] Open DevTools console. `TutorialSystem.replay()`. Walk to Werkstatt entrance — banner advances from "WASD bewegen" to "Geh zur Werkstatt" then to "[E] um zu sprechen".
- [ ] Press E, talk to Branka, close the dialog — banner advances to "Geh zum Rathauskeller".
- [ ] Walk to Rathauskeller, press E — scene transitions to dungeon (next steps in WP04).
- [ ] No double-fires (verified by adding a `console.log` inside `report()` temporarily, then removing).

---

## Subtask T009 — HubSceneV2 overlay mount

**Purpose**: Make the overlay visible while in the hub.

**Steps**:

1. In `HubSceneV2.create()`, after the scene's own UI is created and after the auto-skip check would have run, add:
   ```js
   if (window.TutorialOverlay && window.TutorialSystem?.isActive()) {
     this._tutorialOverlay = window.TutorialOverlay.create(this);
     this._tutorialOverlay.mount();
   }
   ```

2. In `HubSceneV2`'s `shutdown()` (or equivalent — Phaser scenes use `this.events.on('shutdown', ...)` or override `shutdown`), call:
   ```js
   if (this._tutorialOverlay) {
     this._tutorialOverlay.unmount();
     this._tutorialOverlay = null;
   }
   ```

3. Subscribe to a tutorial state change at create-time so that if the tutorial *becomes* active later (e.g., after replay from Settings), the overlay mounts then. Cleanest pattern:
   ```js
   this._tutorialUnsub = window.TutorialSystem?.onChange((step) => {
     if (step && !this._tutorialOverlay) {
       this._tutorialOverlay = window.TutorialOverlay.create(this);
       this._tutorialOverlay.mount();
     } else if (!step && this._tutorialOverlay) {
       this._tutorialOverlay.unmount();
       this._tutorialOverlay = null;
     }
   });
   ```
   Unsubscribe in `shutdown`.

**Files**:
- `js/scenes/HubSceneV2.js` — modified (~15 lines added in `create` + `shutdown`).

**Validation**:
- [ ] After WP01+WP02 are merged: `TutorialSystem.replay()` from console while standing in the hub mounts the overlay live.
- [ ] Returning to hub from dungeon does not double-mount.
- [ ] `TutorialSystem.skip(true)` immediately removes the overlay.

---

## Subtask T010 — Druckerei stub dialog (Setzer Thom)

**Purpose**: Make step 12's `dialog.closed` event reachable. Use the existing dialog system.

**Steps**:

1. Open `js/scenes/hub/hubLayout.js`. Find the `HUB_HITBOXES` array and locate the entry for **Setzer Thom** (the explorer placed him in the Druckerei).

2. Add a `lines` array to that NPC entry. Use the i18n key registered in WP01:
   ```js
   {
     name: 'Setzer Thom',
     // ... existing fields (x, y, texture) ...
     lines: [
       { type: 'text', key: 'tutorial.druckerei.stub' }
     ],
   }
   ```
   *If the existing `_showDialoguePages` accepts plain strings rather than `{type, key}` objects, adapt accordingly — the goal is "one page, localized via i18n".*

3. If `HUB_HITBOXES` is not currently exposed on `window` (per WP02's resolver fallback), expose it now:
   ```js
   if (typeof window !== 'undefined') {
     window.HUB_HITBOXES = HUB_HITBOXES;
   }
   ```

4. Verify in the browser:
   - With the tutorial active at step 12, walk to Setzer Thom.
   - Press E. The dialog opens with "Setzer Thom: »Die Druckerei ist noch in Arbeit. Komm bald wieder.«"
   - Close the dialog. The banner disappears (step 12 completed; tutorial done).

**Files**:
- `js/scenes/hub/hubLayout.js` — modified (~5 lines added: stub `lines` + window export).

**Validation**:
- [ ] Setzer Thom dialog displays the German stub line.
- [ ] Closing the dialog completes the tutorial (`TutorialSystem.isActive()` returns `false`).
- [ ] Switching language to English shows the English stub line ("Setzer Thom: 'The printing house is still under construction. Come back soon.'" or similar).

---

## Definition of Done

- [ ] T007–T010 marked complete.
- [ ] A new player playing through hub → dungeon entry sees steps 2–6 advance correctly.
- [ ] Returning player (with save) sees zero tutorial UI.
- [ ] Druckerei step (12) closes the tutorial cleanly via Setzer Thom's stub dialog.
- [ ] No new console errors during the hub portion.

## Risks & mitigations

- **Existing approach detection drifts** — emission keyed off the *change* in `_lastApproachedName`, not raw containment, prevents per-frame spam.
- **Dialog-close codepath has multiple exits** (ESC, choice button, etc.) — make sure `dialog.closed` is emitted from each. If there is a single funnel function, emit once there.
- **Scene re-mount during dungeon return** — `_tutorialOverlay` initialization in T009 must be conditional on `isActive()` and mounted via `onChange` to handle the post-dungeon return where step 11's auto-dismiss may already have started.

## Reviewer guidance

- Confirm each event has exactly **one** emission site.
- Confirm `window.TutorialSystem?.report(...)` (with `?.`) is used — never `window.TutorialSystem.report(...)`.
- Confirm `_tutorialUnsub` is unsubscribed in `shutdown`.
- Confirm `HUB_HITBOXES` global export does not conflict with anything else.

## Implementation command

```bash
spec-kitty implement WP03 --feature 044-tutorial-onboarding-flow --base WP02
```

## Activity Log

- 2026-05-02T12:27:51Z – claude – shell_pid=22772 – lane=doing – Started implementation via workflow command
- 2026-05-02T12:49:06Z – claude – shell_pid=22772 – lane=for_review – StartScene auto-skip in loadRoomTemplatesAndStart; HubSceneV2 emits 6 hub events at single funnels; Druckerei stub uses 'Setzer Thom' stable name + tutorial.druckerei.stub key. Resumed after agent stall.
- 2026-05-02T14:10:13Z – claude – shell_pid=22772 – lane=approved – Self-review approved
