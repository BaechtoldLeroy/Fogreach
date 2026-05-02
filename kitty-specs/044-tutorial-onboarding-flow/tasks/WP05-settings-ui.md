---
work_package_id: WP05
title: 'Settings UI: skip toggle + replay'
dependencies: [WP01]
requirement_refs:
- FR-09
- FR-10
- FR-11
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: eb5a8abe29a7bdc869b69afa833e5cceae926715
created_at: '2026-05-02T12:27:58.243659+00:00'
subtasks: [T016, T017, T018]
shell_pid: "2072"
agent: "claude"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/scenes/SettingsScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/SettingsScene.js
---

# WP05 — Settings UI: skip toggle + replay

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- **Implement-time base**: stack on top of WP01 (`spec-kitty implement WP05 --base WP01`).
- **Parallel-safe with WP03 and WP04** — no shared owned files.

## Objective

Add two new controls to `SettingsScene`:

1. **Tutorial überspringen** — a toggle/button that, when activated mid-tutorial, calls `TutorialSystem.skip(true)` after a `window.confirm` prompt.
2. **Tutorial neu starten** — a button that, after a `window.confirm` prompt, calls `TutorialSystem.replay()`.

Both labels must update live when the language changes (NFR-03). Use the i18n keys registered in WP01.

## Context (read first)

- [spec.md](../spec.md) — FR-09, FR-10, NFR-03.
- [research.md](../research.md) D-05 (Skip-confirmation UX: `window.confirm`).
- [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md) — `skip(confirmedByUser: boolean)`, `replay()`.
- `js/scenes/SettingsScene.js` — read end-to-end first; understand the existing layout (likely a column of buttons/toggles, possibly with section headers).
- `js/i18n.js` — `t(key)`, `onChange(cb)`, `setLanguage(lang)`.

## Layout convention

If the existing settings have sections (e.g., "Audio", "Anzeige"), add a new section header **"Tutorial"** with the two new controls beneath. Match the visual style of existing controls: same font, same button background, same vertical spacing.

If there are no sections, append the two controls at the bottom with a label/separator above them (`window.i18n.t('tutorial.settings.section_header')` — register this key too if not already, otherwise a hard-coded German label is acceptable as a one-off).

---

## Subtask T016 — Skip toggle

**Purpose**: FR-09 — let the player skip a running tutorial from Settings.

**Steps**:

1. In `SettingsScene.create()`, locate where existing controls are appended.

2. Create a new button (re-use the existing button factory if one exists in this scene). Label source:
   ```js
   const skipLabel = window.i18n.t('tutorial.settings.skip_label');
   ```

3. Visual state of the button reflects whether the tutorial is currently active:
   - Active tutorial → button enabled, label `tutorial.settings.skip_label`.
   - Inactive tutorial (already skipped or completed) → button disabled / dimmed, optional label suffix.
   - Implement a tiny `_refreshSkipButton()` that the scene calls on create and whenever `TutorialSystem` state changes.

4. Click handler:
   ```js
   skipButton.on('pointerdown', () => {
     if (!window.TutorialSystem?.isActive()) return;
     const ok = window.confirm(window.i18n.t('tutorial.skip.confirm'));
     if (ok) {
       window.TutorialSystem.skip(true);
       this._refreshSkipButton();
     }
   });
   ```

5. Subscribe to tutorial changes so the button re-renders when the user replays from another path:
   ```js
   this._skipUnsub = window.TutorialSystem?.onChange(() => this._refreshSkipButton());
   ```
   Unsubscribe in `shutdown`.

**Files**:
- `js/scenes/SettingsScene.js` — modified (~25 lines added).

**Validation**:
- [ ] With tutorial active: opening Settings shows the skip button enabled. Clicking → confirm prompt → accept → tutorial overlay disappears in the underlying scene (close Settings to verify).
- [ ] Cancel on the confirm prompt leaves tutorial active.
- [ ] With tutorial inactive: button is dimmed.

---

## Subtask T017 — Replay button

**Purpose**: FR-10 — let the player restart the tutorial without affecting other saves.

**Steps**:

1. Below the skip button, create another button:
   ```js
   const replayLabel = window.i18n.t('tutorial.settings.replay_label');
   ```

2. Click handler:
   ```js
   replayButton.on('pointerdown', () => {
     const ok = window.confirm(window.i18n.t('tutorial.settings.replay_confirm'));
     if (ok) {
       window.TutorialSystem.replay();
       this._refreshSkipButton();
     }
   });
   ```

3. The replay button is **always enabled** (it works even if the tutorial is already done, by design).

4. Verify in the browser:
   - Wipe `demonfall_tutorial_v1` from localStorage (simulate a previously-skipped player).
   - Open Settings, click Replay → confirm.
   - Close Settings. The tutorial overlay appears at step 2 (movement).
   - The save (`demonfall_save_v1`) and other settings remain intact (DevTools → Application → Local Storage).

**Files**:
- `js/scenes/SettingsScene.js` — modified (~15 lines added).

**Validation**:
- [ ] Replay restarts the tutorial.
- [ ] Save data remains untouched (verified by inspecting localStorage before/after).
- [ ] Cancel on confirm prompt does nothing.

---

## Subtask T018 — Live i18n re-render on language change

**Purpose**: NFR-03 — language switches update visible labels within one frame.

**Steps**:

1. After both buttons are created, subscribe:
   ```js
   this._i18nUnsub = window.i18n?.onChange(() => {
     skipButton.setText(window.i18n.t('tutorial.settings.skip_label'));
     replayButton.setText(window.i18n.t('tutorial.settings.replay_label'));
   });
   ```

2. In `SettingsScene` shutdown:
   ```js
   if (this._i18nUnsub) { this._i18nUnsub(); this._i18nUnsub = null; }
   if (this._skipUnsub) { this._skipUnsub(); this._skipUnsub = null; }
   ```

3. Verify in the browser:
   - Open Settings; both buttons display German labels.
   - Switch language to English (existing toggle).
   - Both new buttons update to English labels immediately, no scene reload.

**Files**:
- `js/scenes/SettingsScene.js` — modified (~10 lines added).

**Validation**:
- [ ] Language switch updates both labels live.
- [ ] No console errors during language switch.
- [ ] No memory leak: rapidly toggling Settings open/close many times does not accumulate subscribers (use `console.log` in the i18n callback to spot-check, then remove).

---

## Definition of Done

- [ ] T016–T018 marked complete.
- [ ] Both controls appear in Settings with correct German + English labels.
- [ ] Skip toggle works only when tutorial is active; replay button always works.
- [ ] All confirm prompts honor cancel.
- [ ] Save data is never modified by either control.

## Risks & mitigations

- **`window.confirm` blocks Phaser's main loop** briefly — acceptable for Settings (already a pause-menu context). If a non-blocking variant is preferred later, that's a future enhancement, not in MVP scope.
- **Subscriber leaks** — strict cleanup in `shutdown`, validated manually.
- **Existing Settings layout overflow** — if adding a section pushes other items off-screen, propose a simple "Tutorial" subsection collapse or scroll. Out of MVP scope unless visible during testing; mention in PR if encountered.

## Reviewer guidance

- Confirm both subscriptions are unsubscribed in `shutdown`.
- Confirm Replay does not touch `demonfall_save_v1`.
- Confirm the buttons match the visual style of existing Settings controls.

## Implementation command

```bash
spec-kitty implement WP05 --feature 044-tutorial-onboarding-flow --base WP01
```

## Activity Log

- 2026-05-02T12:27:58Z – claude – shell_pid=2072 – lane=doing – Started implementation via workflow command
- 2026-05-02T12:44:53Z – claude – shell_pid=2072 – lane=for_review – Tutorial section in Settings; resumed after agent stall.
- 2026-05-02T14:10:15Z – claude – shell_pid=2072 – lane=approved – Self-review approved
