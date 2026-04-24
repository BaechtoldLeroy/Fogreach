# Tasks: 042 — ARPG Control Scheme

**Feature**: `042-arpg-control-scheme`
**Branch / Base / Merge Target**: `main` / `main` / `main`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/input-scheme-api.md](./contracts/input-scheme-api.md)

## Overview

4 Work Packages, 22 Subtasks. WP01 is the foundation (provides `window.InputScheme` + persistence + tests). WP02, WP03, WP04 depend on WP01 but are mutually independent — parallelizable. File ownership is strictly non-overlapping to match the spec-kitty workspace model. Manual QA from `quickstart.md` is carried as a DoD item inside each WP rather than as a dedicated QA package.

## Branch Strategy

- Planning / base: `main`
- Final merge target: `main`
- Stacking: WP02, WP03, WP04 stack on WP01 (`spec-kitty implement WPxx --base WP01`).

## Work Packages

---

### WP01 — InputScheme Core Module

**Goal**: Ship the `window.InputScheme` dispatcher + persistence hook + unit tests. No consumer-side changes yet — this is the plumbing everybody else will call.

**Priority**: P0 (foundation; WP02/03/04 all block on it).

**Independent test**: After this WP, in the browser console:
- `window.InputScheme.getScheme()` → `'classic'` (default)
- `window.InputScheme.setScheme('arpg')` → `true`, `getScheme()` → `'arpg'`, persists across reload
- `window.InputScheme.getSlotLabel(1)` → `'Q'` (classic) / `'1'` (arpg)
- `node tools/runTests.js` passes the new `tests/inputScheme.test.js` in both schemes

**Subtasks**:
- [ ] T001 — Extend `js/persistence.js`: add `getControlScheme()` (default `'classic'`, validates against `{'classic', 'arpg'}`) and `setControlScheme(value)` writing into `demonfall_settings_v1.controlScheme`.
- [ ] T002 — Create `js/inputScheme.js` module shell: IIFE, internal state, `init(scene, options)`, `_configureForTest(primitives)` DI entry, `onChange(cb) → unsubscribe` subscriber pattern.
- [ ] T003 — Implement `getScheme()`, `setScheme(value)` (persists via Persistence, notifies subscribers, validates values). Set initial scheme from Persistence on first call.
- [ ] T004 — Implement `getMovementInput()` (scheme-aware: arrows in classic, WASD in arpg; returns `{x, y}` ∈ {-1, 0, 1} per axis), `isBasicAttackTriggered()` (edge-triggered: Space or primary mouse button in both schemes), `shouldSuppressCombatInput()` (centralizes the `invOpen || playerDeathHandled || isReturningToHub` gate).
- [ ] T005 — Implement `getAimDirection(scene, player)` (20 px dead-zone with last-known-aim cache; `source` field per `data-model.md::AimVector`), `consumeAbilityTrigger(slotIndex)` (edge-triggered, slot 1-4, scheme-dependent key resolution), `getSlotLabel(slotIndex)` (returns `'Q'/'W'/'E'/'R'` or `'1'/'2'/'3'/'4'`).
- [ ] T006 — Register i18n keys at module load (`input.scheme.classic` DE "Klassisch" / EN "Classic"; `input.scheme.arpg` DE "ARPG" / EN "ARPG"; `settings.input_scheme.label` DE "Steuerung" / EN "Control Scheme"). Update `index.html` script order: `persistence.js` → `i18n.js` → `inputScheme.js` → gameplay modules.
- [ ] T007 — Unit tests in `tests/inputScheme.test.js`: (a) default scheme is classic; (b) `setScheme` persists + notifies + rejects bogus values; (c) `getMovementInput` honors scheme and stub key state; (d) `isBasicAttackTriggered` is edge-triggered + gated by suppress; (e) `getAimDirection` dead-zone + last-known fallback + first-read fallback to `(1,0)`; (f) `consumeAbilityTrigger` returns true once per press; (g) `getSlotLabel` returns correct char per scheme; (h) `onChange` subscribe + unsubscribe.

**Owned files**: `js/inputScheme.js`, `js/persistence.js`, `index.html`, `tests/inputScheme.test.js`

**Estimated prompt size**: ~500 lines

**Dependencies**: none

**Requirements mapped**: FR-001, FR-002, FR-011, NFR-003, C-001, C-002, C-003, C-004

---

### WP02 — main.js Input Rewire

**Goal**: Route all input reads in `main.js` through `InputScheme`. Add the Phaser key bindings for WASD and 1-4, replace direct `JustDown(qKey)` style polls with `consumeAbilityTrigger`, wire the scene-level `pointerdown` handler to use `getAimDirection` for attack direction. HUD slot badges read `getSlotLabel` and re-render on `onChange`.

**Priority**: P1.

**Independent test**: Classic scheme remains bit-identical (arrows move, Space attacks, QWER triggers abilities). Switching to ARPG via `window.InputScheme.setScheme('arpg')` in the console:
- W/A/S/D move the player
- Pressing `1/2/3/4` triggers ability slots (was QWER before)
- Left-clicking fires an attack toward the cursor
- HUD slot badges switch from "Q W E R" to "1 2 3 4" without reload

**Subtasks**:
- [ ] T008 — In `main.js` `create()`, add Phaser key bindings for `W`, `A`, `S`, `D` and `ONE`/`TWO`/`THREE`/`FOUR`. Keep existing arrow/Space/QWER bindings — both sets live side by side; `InputScheme` decides which is authoritative each frame.
- [ ] T009 — Call `window.InputScheme.init(this)` in `create()` after all key bindings exist, passing the scene so pointer world coords are resolvable. Ensure cleanup on `SHUTDOWN` (tear down pointerdown listener, onChange subscribers).
- [ ] T010 — Rewire the existing scene-level `pointerdown` handler (committed as `ff91985`) to delegate direction to `InputScheme.getAimDirection(this, player)` and the suppression gate to `InputScheme.shouldSuppressCombatInput()`. Keep the `currentlyOver.length > 0` UI-hit-test skip. Attack function still receives a directional vector — no behavioral change in Classic.
- [ ] T011 — Replace the ability-slot polling block in `update()` (currently `Phaser.Input.Keyboard.JustDown(qKey)` / `wKey` / `eKey` / `rKey`) with `if (InputScheme.consumeAbilityTrigger(n)) { AbilitySystem.tryActivate(slotN, this); }` for n in 1..4. Corresponding `JustUp` release paths use `consumeAbilityReleaseTrigger` or equivalent — add to InputScheme if needed (note: charge-type abilities rely on press + release; coordinate with WP01 API).
- [ ] T012 — HUD slot-badge rendering in `refreshSlotMappings` reads `InputScheme.getSlotLabel(slotIndex)` instead of the hardcoded `{slot1: 'Q', slot2: 'W', ...}` map. Subscribe to `InputScheme.onChange` once in `create()` to call `_refreshAbilityHUD()` (already exposed) on scheme change.

**Owned files**: `js/main.js`

**Estimated prompt size**: ~400 lines

**Dependencies**: WP01

**Requirements mapped**: FR-005, FR-008, FR-009, FR-010, FR-012, FR-013, NFR-004

---

### WP03 — player.js Input Rewire + Sprite Facing

**Goal**: Route movement and all ability aim vectors in `js/player.js` through `InputScheme`. Sprite facing in ARPG mode follows the aim direction via the existing 8-octant `getDirectionFromVelocity`. `lastMoveDirection` continues to be maintained (needed as dead-zone fallback inside `getAimDirection`).

**Priority**: P1.

**Independent test**: With ARPG active and a bow equipped, moving W+A while the cursor points east causes:
- Player visibly moves northwest
- Player sprite faces east (dir04)
- Arrows/projectiles fire east
- With Classic active everything behaves exactly as pre-feature (same frame data, same motion).

**Subtasks**:
- [ ] T013 — In `updatePlayerMovement` (around `player.js:985-997`), replace the `cursors.left.isDown / cursors.right.isDown / cursors.up.isDown / cursors.down.isDown` reads with `const mv = InputScheme.getMovementInput();  vx = mv.x;  vy = mv.y;`. Preserve existing speed/slow/attack-commit multipliers downstream.
- [ ] T014 — Replace `if (Phaser.Input.Keyboard.JustDown(spaceKey)) { attack.call(this); }` in `handlePlayerAttack` with `if (InputScheme.isBasicAttackTriggered()) { attack.call(this); }`. The InputScheme guard already includes suppression — remove any redundant local guard.
- [ ] T015 — Rewire all offensive-ability direction reads. Functions affected (each currently samples `lastMoveDirection.x/y` for arc / projectile / dash direction): `attack()`, `showAttackEffect()`, `spinAttack()`, `beginChargedSlash()`, `releaseChargedSlash()`, `dashSlash()`, `daggerThrow()`, `shieldBash()`, `_fireBowArrow()`. Change each to `const aim = InputScheme.getAimDirection(scene, player);` and use `aim.x / aim.y`. `lastMoveDirection` is still updated inside `updatePlayerMovement` (it remains the Classic-scheme truth source and the dead-zone fallback).
- [ ] T016 — In `updatePlayerSpriteAnimation(sprite, vx, vy)`, when `InputScheme.getScheme() === 'arpg'`, pass the aim vector instead of `(vx, vy)` into `getDirectionFromVelocity`. Pseudocode: `const aim = InputScheme.getAimDirection(sprite.scene, sprite); const dirInput = (scheme === 'arpg' && aim.source !== 'lastKnown') ? aim : { x: vx, y: vy }; const direction = moving ? getDirectionFromVelocity(dirInput.x, dirInput.y, state.direction) : ...`. When idle + ARPG + valid aim, still update facing from aim (idle ARPG players should still turn their head).
- [ ] T017 — Verify `lastMoveDirection` continues to be maintained in both schemes; it's read by `InputScheme.getAimDirection` as the Classic source-of-truth and as the dead-zone fallback. Add a brief comment documenting this contract. Smoke-check: in Classic the aim stays coupled to movement (no regression); in ARPG idle + cursor-near-player keeps the last meaningful facing (EC-1).

**Owned files**: `js/player.js`

**Estimated prompt size**: ~450 lines

**Dependencies**: WP01

**Requirements mapped**: FR-005, FR-006, FR-007, FR-009, NFR-002

---

### WP04 — Settings Scheme Picker

**Goal**: Add the control-scheme picker row to `SettingsScene.js` (pattern identical to `_languageRow`). Hide the picker on touch devices. Wire the switch callback to `InputScheme.setScheme`. Subscribe to `InputScheme.onChange` for live re-render.

**Priority**: P1.

**Independent test**: Open settings (O key). A new "Steuerung" / "Control Scheme" row appears between the DEBUG and language sections, offering "Klassisch" / "ARPG" (or "Classic" / "ARPG" in EN). Selecting ARPG persists the choice, updates HUD badges (via WP02's subscriber), and behaves correctly across a browser reload. On a touch device the row is hidden.

**Subtasks**:
- [ ] T018 — Add `_schemeRow(centerX, y, panelW)` method in `SettingsScene.js`, modeled on the existing `_languageRow`. Two option buttons, current scheme highlighted, both clickable.
- [ ] T019 — Mobile gate: in the row-render loop, skip `_schemeRow` when `this.sys.game.device.input.touch === true`. Verify the panel height math still works (don't leave a blank gap; compute row positions via a running offset — same pattern as elsewhere in the scene).
- [ ] T020 — Register i18n keys at module-header time: `settings.input_scheme.label` (DE "Steuerung", EN "Control Scheme"), `settings.input_scheme.classic` (DE "Klassisch", EN "Classic"), `settings.input_scheme.arpg` (DE "ARPG", EN "ARPG"). Use these in `_schemeRow`.
- [ ] T021 — On scheme-button click: `window.InputScheme.setScheme(newScheme)` then re-render the picker row so the highlight moves. Persistence is handled by `InputScheme.setScheme` — do not double-write to Persistence directly.
- [ ] T022 — Register an `InputScheme.onChange` subscriber in the scene's `create()` that calls the same re-render routine. Unsubscribe on `SHUTDOWN`. This keeps the picker in sync if the scheme is changed from the console or another path.

**Owned files**: `js/scenes/SettingsScene.js`

**Estimated prompt size**: ~320 lines

**Dependencies**: WP01

**Requirements mapped**: FR-001, FR-003, FR-014, NFR-001

---

## Dependencies Graph

```
WP01 (Foundation)
  ├── WP02 (main.js rewire)
  ├── WP03 (player.js rewire + sprite facing)
  └── WP04 (Settings picker)
```

WP02, WP03, WP04 are mutually independent after WP01 lands — each owns a single source file.

## MVP Scope

WP01 + WP02 alone is a console-testable MVP: `window.InputScheme.setScheme('arpg')` makes WASD move, 1-4 trigger abilities, left-click attacks toward cursor. WP03 adds the aim-direction decoupling and sprite rotation that make the scheme actually feel like ARPG. WP04 gives the user-facing switch.

## Acceptance (Cross-WP)

Full acceptance per `quickstart.md` — all 25 steps across parts A-G pass, in both DE and EN, on at least one desktop browser. `node tools/runTests.js` still reports 112/113 pre-existing (unrelated ITEM_BASES count test).

## Requirement Coverage (Hint)

- FR-001 (Settings picker with two values) → WP01, WP04
- FR-002 (Persistence) → WP01
- FR-003 (Live switch, no reload) → WP04
- FR-004 (Classic unchanged) → WP02, WP03 (regression discipline)
- FR-005 (WASD movement) → WP02, WP03
- FR-006 (Mouse cursor → aim) → WP03
- FR-007 (Sprite faces aim) → WP03
- FR-008 (1-4 ability keys) → WP02
- FR-009 (LMB attack in ARPG) → WP02, WP03
- FR-010 (Space alt attack in ARPG) → WP01 (API), WP03 (consumer)
- FR-011 (Non-combat keys unchanged) → WP01 (not reassigned)
- FR-012 (HUD badges follow scheme) → WP02
- FR-013 (UI overlay suppresses bindings) → WP01
- FR-014 (Picker hidden on mobile) → WP04
- NFR-001 (switch < 200 ms) → WP04
- NFR-002 (facing at frame rate) → WP03
- NFR-003 (< 1 ms/frame) → WP01
- NFR-004 (no Classic regression) → WP02, WP03
- C-001, C-002, C-003, C-004 → WP01 (design-level) + WP02/03 (enforcement)
