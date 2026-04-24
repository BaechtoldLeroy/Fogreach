---
work_package_id: WP04
title: Settings Scheme Picker
dependencies: [WP01]
requirement_refs:
- FR-001
- FR-003
- FR-014
- NFR-001
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T018, T019, T020, T021, T022]
history:
- 2026-04-24 — Scaffolded during /spec-kitty.tasks
authoritative_surface: js/scenes/SettingsScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/SettingsScene.js
---

# WP04 — Settings Scheme Picker

## Objective

Add a user-facing "Control Scheme" row to the Settings scene. It lets the player pick between Classic and ARPG, persists the choice via `InputScheme.setScheme`, and updates live (HUD badges + input handlers all react via the existing `onChange` subscribers that WP02 sets up). On touch devices the row is hidden outright.

This WP is UI-only. No gameplay logic changes.

## Branch Strategy

- Planning / base: `main`
- Actual implementation base: `042-arpg-control-scheme-WP01` (stacked on WP01)
- Merge target: `main`
- Run: `spec-kitty implement WP04 --base WP01`

## Context

Prerequisites:
- WP01 merged → `window.InputScheme.getScheme()`, `.setScheme()`, `.onChange()` available, i18n keys registered
- (Optional) WP02 merged — lets you visibly verify HUD badges update when switching scheme in the picker. Without WP02, only the picker's own highlight moves; badges stay hardcoded. That's acceptable — each WP is independently mergable.

Existing code to read before editing:
- `js/scenes/SettingsScene.js` — full file. The file is ~430 lines; focus on:
  - The `_pickerRow(...)` method (the generic picker row used by audio/debug toggles)
  - `_languageRow(centerX, y, panelW)` at ~line 421 — **this is the template to copy from**
  - The row layout loop in `create()` (around line 200-220) where rows are added sequentially via `this._languageRow(px, rowY, panelW); rowY += 24;`
  - The existing i18n registration at the module header (register DE/EN strings for all Settings rows)
  - The SHUTDOWN handler that unsubscribes from i18n.onChange — your new `InputScheme.onChange` subscriber needs the same cleanup

## Subtasks

### T018 — Add _schemeRow method and wire it into the row layout

**Purpose**: A new picker row visually and structurally identical to `_languageRow`, offering Classic / ARPG.

**Steps**:
1. Open `js/scenes/SettingsScene.js`. Find `_languageRow(centerX, y, panelW)` around line 421.
2. Copy the method and rename to `_schemeRow`. The structure is typically:
   - A label text to the left
   - Two option buttons to the right
   - Clicking an option updates the stored value + highlights the active one
3. Configure for scheme options:
   ```js
   _schemeRow(centerX, y, panelW) {
     const labelKey = 'settings.input_scheme.label';
     const options = [
       { value: 'classic', labelKey: 'input.scheme.classic' },
       { value: 'arpg',    labelKey: 'input.scheme.arpg'    }
     ];
     const current = (window.InputScheme && window.InputScheme.getScheme) ? window.InputScheme.getScheme() : 'classic';
     // render label + options (mirror _languageRow styling)
     // clicking an option → this._applyScheme(option.value)
   }
   ```
4. Implement `_applyScheme(newValue)` as a small helper that calls `window.InputScheme.setScheme(newValue)` and re-renders (or just re-invokes the scene's render pipeline that reconstructs the rows). `InputScheme.setScheme` persists; don't double-write to Persistence.
5. In the row layout (around line 211 area where `_languageRow` is invoked):
   ```js
   this._schemeRow(px, rowY, panelW); rowY += 24;
   ```
   Place it in the DEBUG or INPUT section of the panel. Keep the order: audio → controls (mobile) → display → debug → **input (new)** → language. Or put it right above language — align with the existing section ordering.

**Files**:
- `js/scenes/SettingsScene.js` (edit — ~40 lines added for the new method, 2 lines for the row-layout call)

**Validation**:
- [ ] Open Settings (O key). A new row appears with the label "Steuerung" / "Control Scheme" and two option buttons
- [ ] Clicking the non-active option highlights it and the old one dims
- [ ] The highlighted option matches `InputScheme.getScheme()` on scene open

### T019 — Mobile gate: hide the row on touch devices

**Purpose**: Touch devices don't use the desktop schemes at all (they have `mobileControls.js`). The row would just confuse.

**Steps**:
1. In the row-layout block, wrap the `_schemeRow` call in a conditional:
   ```js
   const isTouch = this.sys && this.sys.game && this.sys.game.device && this.sys.game.device.input && this.sys.game.device.input.touch;
   if (!isTouch) {
     this._schemeRow(px, rowY, panelW); rowY += 24;
   }
   ```
2. Verify the `rowY` advancement doesn't leave a visual gap on mobile — the subsequent row should flow naturally into the position where the scheme row would have been.
3. Test in Chrome DevTools' device emulation (Pixel/iPhone): the row should disappear.
4. Note that other rows like the mobile-joystick sensitivity slider are already conditionally shown on mobile only; study that pattern if needed.

**Files**:
- `js/scenes/SettingsScene.js` (edit — 4 lines wrapping the `_schemeRow` call)

**Validation**:
- [ ] Desktop: row visible
- [ ] Chrome DevTools → Toggle device toolbar → iPhone: row hidden, no visual gap

### T020 — Register i18n keys for picker label + option names

**Purpose**: The picker's label and the two option labels need translations.

**Steps**:
1. WP01's `inputScheme.js` already registers `input.scheme.classic`, `input.scheme.arpg`, and `settings.input_scheme.label`. Verify by opening the console and calling `window.i18n.t('settings.input_scheme.label')` — should return the correct DE/EN string.
2. If for any reason those are missing (e.g., WP01 load order breaks), register them at the top of SettingsScene.js' existing register block as a defensive duplicate:
   ```js
   window.i18n.register('de', {
     ...,
     'settings.input_scheme.label': 'Steuerung',
     'input.scheme.classic': 'Klassisch',
     'input.scheme.arpg': 'ARPG'
   });
   window.i18n.register('en', {
     ...,
     'settings.input_scheme.label': 'Control Scheme',
     'input.scheme.classic': 'Classic',
     'input.scheme.arpg': 'ARPG'
   });
   ```
   `window.i18n.register` does `Object.assign`, so duplicate keys are idempotent — safe to register from both modules.
3. Use the three keys inside `_schemeRow` — do not hardcode strings.

**Files**:
- `js/scenes/SettingsScene.js` (edit — optional defensive register block, at module header)

**Validation**:
- [ ] Switch language DE → EN in Settings → the scheme row's label and option names localize
- [ ] No `[MISSING:...]` warnings in the console

### T021 — Switch callback: InputScheme.setScheme + re-render picker

**Purpose**: Clicking an option mutates the scheme and re-renders the picker so the highlight moves.

**Steps**:
1. Inside `_schemeRow`, on each option button's pointerdown:
   ```js
   optionBtn.on('pointerdown', () => {
     window.InputScheme.setScheme(option.value);
     // Re-render this picker row so highlight moves. Easiest: destroy the two
     // option buttons + label text and call `_schemeRow` again at the same y.
     // Or: set `current = option.value` and recolor the buttons directly.
     this._refreshSchemeRow(); // if you abstract; or inline the recolor
   });
   ```
2. `InputScheme.setScheme` does three things already: persists, notifies subscribers, resets the ability-trigger latch. So the Settings scene doesn't need to persist separately; don't call `Persistence.setControlScheme` directly here.
3. Keep the re-render lightweight. No scene-restart — just refresh the row's visual state.

**Files**:
- `js/scenes/SettingsScene.js` (edit — ~10 lines in the option-button pointerdown handler)

**Validation**:
- [ ] Clicking an option immediately changes the highlight
- [ ] Close Settings, reopen: the last-clicked option is still highlighted (persistence works)
- [ ] Reload the browser: persisted choice is restored

### T022 — Subscribe to InputScheme.onChange for external updates

**Purpose**: If the scheme is set elsewhere (console, hotkey in the future, another scene), the picker should reflect the change even while Settings is open.

**Steps**:
1. In the scene's `create()` method (or wherever `_languageRow`'s `i18n.onChange` subscription sits), add:
   ```js
   let _unsubScheme = null;
   if (window.InputScheme && typeof window.InputScheme.onChange === 'function') {
     _unsubScheme = window.InputScheme.onChange(() => {
       // Re-render the scheme row highlight without re-rendering the whole scene
       if (typeof this._refreshSchemeRow === 'function') this._refreshSchemeRow();
     });
   }
   ```
2. In the existing SHUTDOWN handler (look for `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)`), add:
   ```js
   if (typeof _unsubScheme === 'function') { try { _unsubScheme(); } catch (e) {} }
   ```
3. If `_refreshSchemeRow` didn't already exist from T021, implement it: accepts no args, redraws the two option buttons with updated fill colors based on current scheme. Lightweight.

**Files**:
- `js/scenes/SettingsScene.js` (edit — ~12 lines, subscriber + cleanup + refresh helper)

**Validation**:
- [ ] With Settings open: `window.InputScheme.setScheme('arpg')` in the console updates the picker highlight without reopening Settings
- [ ] Close Settings → SHUTDOWN fires → no memory leak (verify `InputScheme` subscriber count stays stable across open/close cycles)

## Definition of Done

- [ ] All 5 subtasks complete with validation ticked
- [ ] Settings picker row appears between existing sections, labeled correctly in DE + EN
- [ ] Clicking an option persists and (if WP02 merged) updates HUD badges live
- [ ] Mobile emulation: row hidden
- [ ] Language switch: picker label + option names re-localize
- [ ] `node tools/runTests.js` still passes
- [ ] `git diff` shows only `js/scenes/SettingsScene.js` touched

## Risks + Reviewer Guidance

| Risk | Mitigation |
|------|------------|
| SettingsScene row order drifts | Decide the section (e.g., "INPUT" header above "ANZEIGE"/"DEBUG") and document in the scene. Keep consistent across the language picker's ordering. |
| `InputScheme.onChange` subscriber leak | Verify SHUTDOWN unsubscribe. Open Settings N times, each should add exactly 1 subscriber; after SHUTDOWN, count should be stable. |
| Mobile emulation inconsistent (some touch devices report touch=false) | The existing mobile-joystick sensitivity row uses the same check. If that check is correct, ours is too. |
| Double i18n registration | `i18n.register` is idempotent (Object.assign). Safe. |
| Picker renders before InputScheme is initialized | WP01 loads inputScheme.js before SettingsScene.js in index.html. `getScheme()` works immediately after module load. If somehow InputScheme is not yet available, the defensive `|| 'classic'` default in T018 keeps the picker functional. |

**For the reviewer**: visually inspect the picker in both languages and on mobile emulation. Click both options and verify the highlight. Run `window.InputScheme.getScheme()` after each click to confirm persistence.

## Next Step

This is the last WP in the planned series. After merge, run the full `quickstart.md` (25 steps). If it passes, the feature is ready for `/spec-kitty.accept`.
