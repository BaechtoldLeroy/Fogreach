---
work_package_id: WP01
title: InputScheme Core Module
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- C-004
- FR-001
- FR-002
- FR-011
- NFR-003
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 713efb0d7824d6d61d00b19aade51cafb1c5351d
created_at: '2026-04-24T16:22:40.358787+00:00'
subtasks: [T001, T002, T003, T004, T005, T006, T007]
shell_pid: "26192"
history:
- 2026-04-24 — Scaffolded during /spec-kitty.tasks
authoritative_surface: js/inputScheme.js
execution_mode: code_change
lane: planned
owned_files:
- js/inputScheme.js
- js/persistence.js
- index.html
- tests/inputScheme.test.js
---

# WP01 — InputScheme Core Module

## Objective

Ship the `window.InputScheme` module — a scheme-aware input dispatcher — plus the persistence hook and unit tests. This WP writes the module and its plumbing. It does **not** rewire any consumer (main.js, player.js, SettingsScene.js stay untouched in this WP — those are WP02/03/04).

At the end of this WP:
- `window.InputScheme` exists with a stable public surface per `contracts/input-scheme-api.md`
- `window.Persistence.getControlScheme()` / `setControlScheme()` back the scheme value in `localStorage`
- `tests/inputScheme.test.js` covers every public function and passes under `node tools/runTests.js`
- All existing tests still pass (no regressions)

## Branch Strategy

- Planning / base: `main`
- Merge target: `main`
- Stacking: none (first in the chain). When WP02/03/04 call `spec-kitty implement WPxx --base WP01`, their worktrees branch from this one.
- `branch_matches_target` was true at planning time; if `/spec-kitty.implement` reports a different `base_branch` later, use that instead.

## Context

Read before starting:
- `kitty-specs/042-arpg-control-scheme/spec.md` — the whole spec (FR / NFR / Edge cases)
- `kitty-specs/042-arpg-control-scheme/plan.md` — especially Technical Context and Phase 0 decisions
- `kitty-specs/042-arpg-control-scheme/contracts/input-scheme-api.md` — **canonical API shape**
- `kitty-specs/042-arpg-control-scheme/data-model.md` — ControlScheme / AimVector / SlotBinding

Existing code to reference (do not touch in this WP):
- `js/i18n.js` — copy the IIFE + subscriber pattern used there for `onChange`
- `js/persistence.js` — see `getLanguage/setLanguage` (lines ~91-110); mirror the exact shape for `getControlScheme/setControlScheme`
- `js/player.js:26-42` — `PLAYER_DIRECTION_SEQUENCE` (needed only as reference, not modified here)
- `tests/questSystem.test.js` — template for a Node `node:test` file in this codebase

## Subtasks

### T001 — Extend persistence.js with control-scheme accessors

**Purpose**: Give `InputScheme` a persistence layer identical in shape to the existing language pair.

**Steps**:
1. Open `js/persistence.js`. Find the `getLanguage` / `setLanguage` pair (around line 91-110).
2. Add `getControlScheme()` below them:
   - Return the `controlScheme` field from the cached settings object.
   - Validate: if the stored value is not one of `'classic'` / `'arpg'`, return `'classic'` and log a warning at console.warn level.
3. Add `setControlScheme(value)`:
   - Accept only `'classic'` or `'arpg'`; otherwise log a warning and no-op (do not coerce).
   - Write the new value into the settings object, persist to localStorage under the existing `demonfall_settings_v1` key, using the same persistence mechanism `setLanguage` uses (do NOT invent a new storage key).
4. Export both via the existing `window.Persistence` object assignment block.

**Files**:
- `js/persistence.js` (edit — add ~20 lines in the same style as the language pair)

**Validation**:
- [ ] In browser console: `Persistence.getControlScheme()` → `'classic'` on fresh localStorage
- [ ] `Persistence.setControlScheme('arpg')` then `Persistence.getControlScheme()` → `'arpg'`
- [ ] `Persistence.setControlScheme('xyz')` logs a warning and does NOT change the stored value
- [ ] Reload page: `getControlScheme()` still returns the last valid value set

### T002 — Create inputScheme.js module shell

**Purpose**: Scaffold the module file with IIFE wrapper, internal state object, `init(scene, options)` entry, `_configureForTest(primitives)` DI entry, and the subscriber list for `onChange`.

**Steps**:
1. Create `js/inputScheme.js` at the project `js/` level.
2. Structure as an IIFE that sets `window.InputScheme = { ... }` at the end — mirror `i18n.js` structure.
3. Internal state shape (private inside the IIFE):
   ```js
   const state = {
     scheme: 'classic',            // current scheme, initialized lazily on first getScheme()
     lastAim: { x: 1, y: 0 },      // last known non-zero aim; seeds dead-zone fallback
     abilityTriggerLatch: {        // per-slot edge-trigger memory (for classic AND arpg keys)
       1: false, 2: false, 3: false, 4: false
     }
   };
   const subscribers = new Set();
   ```
4. `init(scene, options = {})`:
   - Stash `scene` for pointer reads.
   - If called in production (no `options.primitives`), bind real accessors: Phaser `scene.input.keyboard.addKey(...)` per slot number, `scene.input.activePointer`, existing classic key objects from main.js (pass via `options.cursors`, `options.spaceKey`, etc., or read from `window.cursors` et al. — decide one pattern and document it).
   - If `options.primitives` is present, route all reads through it (test mode).
   - Idempotent: if called twice, tear down previous listeners and rebind.
5. `_configureForTest(primitives)`: exposed for Node tests; replaces the internal accessor functions. Accept the object shape defined in `contracts/input-scheme-api.md` under "Testing contract".
6. `onChange(cb) → unsubscribe`: identical pattern to `i18n.js:59-63`.

**Files**:
- `js/inputScheme.js` (new file)

**Validation**:
- [ ] In browser console after page load: `typeof window.InputScheme === 'object'`
- [ ] `window.InputScheme.init` is a function
- [ ] `window.InputScheme.onChange(() => {})` returns a function (the unsubscribe)

### T003 — Implement getScheme / setScheme with persistence + notifications

**Purpose**: Make the scheme value observable and mutable through the module API.

**Steps**:
1. Add `getScheme()`:
   - On first call, lazy-init from `Persistence.getControlScheme()` (if `state.scheme` is still the placeholder). Cache the result.
   - Return `state.scheme`.
2. Add `setScheme(value)`:
   - Validate against `{'classic', 'arpg'}`. Invalid → `console.warn` and return `false`, no state change, no notification.
   - If value is the same as current → return `true` without notifying (idempotent).
   - Set `state.scheme = value`, call `Persistence.setControlScheme(value)`, reset `state.abilityTriggerLatch` to all false (releases stale held-key assumptions across the scheme switch).
   - Notify all subscribers: `subscribers.forEach(cb => { try { cb(value); } catch (e) { console.error(e); } })`.
   - Return `true`.
3. Expose both on the returned module object.

**Files**:
- `js/inputScheme.js` (edit)

**Validation**:
- [ ] In browser console: `InputScheme.getScheme()` → `'classic'`
- [ ] `InputScheme.setScheme('arpg')` returns `true`; `getScheme()` → `'arpg'`; reload keeps the value
- [ ] `InputScheme.setScheme('bogus')` returns `false`; scheme unchanged
- [ ] `const unsub = InputScheme.onChange(v => console.log('new:', v)); InputScheme.setScheme('classic'); unsub();` — logs `new: classic` exactly once

### T004 — Implement getMovementInput + isBasicAttackTriggered + shouldSuppressCombatInput

**Purpose**: The two most-frequently polled APIs (movement vector, basic-attack trigger) plus the shared combat-suppression guard.

**Steps**:
1. `getMovementInput()`:
   - Return `{x: 0, y: 0}` if `shouldSuppressCombatInput()` is true (or at least movement should halt — actually no, movement during inventory is already handled separately; keep this API always-return the raw movement, let callers decide).
   - Revise: **do not** apply suppression here; movement polling needs to return 0,0 only when appropriate, and the existing code in `player.js` has its own pause paths. Just return:
     - Classic: `{x: (right?1:0) - (left?1:0), y: (down?1:0) - (up?1:0)}`
     - ARPG: same with WASD: `d / a / w / s`
   - Keys resolved via the DI `getKeyDown(name)` primitive.
2. `isBasicAttackTriggered()`:
   - Return `false` immediately if `shouldSuppressCombatInput()` is true.
   - Else: edge-triggered true on the frame Space *or* left mouse went down. Internal flag to debounce.
3. `shouldSuppressCombatInput()`:
   - Reads `window.invOpen`, `window.playerDeathHandled`, `window.isReturningToHub`. These are module-scope flags in main.js; expose via `window.*` (they're already hoisted there as of existing code).
   - Return true if any is truthy.
4. Expose all three.

**Files**:
- `js/inputScheme.js` (edit)

**Validation**:
- [ ] Works against stubbed primitives in tests (T007)
- [ ] In browser after WP02 lands: moving with WASD in ARPG mode yields `{x: 1, y: 0}` for `getMovementInput()` when 'd' is held (debug via console override of scheme to 'arpg' + press key + read value)

### T005 — Implement getAimDirection + consumeAbilityTrigger + getSlotLabel

**Purpose**: The remaining three input APIs — aim math, slot-trigger edge detection, and the HUD key label lookup.

**Steps**:
1. `getAimDirection(scene, player)`:
   - Determine scheme. If `classic`:
     - Return `{ x: state.lastMoveDirection.x, y: state.lastMoveDirection.y, source: 'movement' }`. Read `lastMoveDirection` from `window.lastMoveDirection` (exposed by player.js) or from an injected primitive.
     - If `lastMoveDirection` is zero (game just started, player hasn't moved), return `{ x: 1, y: 0, source: 'lastKnown' }`.
   - If `arpg`:
     - Read pointer world position via primitive `getPointerWorldXY()` — in prod this is `scene.input.activePointer.worldX/Y`.
     - Read player pos via primitive `getPlayerPos()` — in prod this is `{x: player.x, y: player.y}`.
     - Compute `dx = pointer.x - player.x; dy = pointer.y - player.y; len = hypot(dx, dy);`
     - If `len < 20` (dead-zone): return `{...state.lastAim, source: 'lastKnown'}`.
     - Else: normalize → `{ x: dx/len, y: dy/len, source: 'cursor' }`, cache as `state.lastAim` (x, y only — not source).
   - Invariant: never return `{x:0, y:0}`; always a valid unit vector (or close to it).
2. `consumeAbilityTrigger(slotIndex)`:
   - slotIndex is 1..4. Resolve the physical key bound to this slot for the current scheme:
     - Classic: slot 1→Q, 2→W, 3→E, 4→R
     - ARPG: slot 1→'1', 2→'2', 3→'3', 4→'4'
   - Return true once on the frame the key went down (`isKeyJustDown` primitive). Use the latch in `state.abilityTriggerLatch` to guarantee a single `true` per physical press even across multiple calls in the same frame.
   - If `shouldSuppressCombatInput()` is true, return false.
3. `getSlotLabel(slotIndex)`:
   - Classic: return `['Q','W','E','R'][slotIndex - 1]`
   - ARPG: return `String(slotIndex)`
4. Expose all three.

**Files**:
- `js/inputScheme.js` (edit)

**Validation**:
- [ ] Covered by tests T007 (aim dead-zone, consume edge trigger, slot label matrix)

### T006 — i18n keys + index.html bootstrap order

**Purpose**: Scheme names localize, and the module loads at the right place in the script chain.

**Steps**:
1. In `js/inputScheme.js`, at module-header time (inside the IIFE, near the top):
   ```js
   if (window.i18n) {
     window.i18n.register('de', {
       'input.scheme.classic': 'Klassisch',
       'input.scheme.arpg': 'ARPG',
       'settings.input_scheme.label': 'Steuerung'
     });
     window.i18n.register('en', {
       'input.scheme.classic': 'Classic',
       'input.scheme.arpg': 'ARPG',
       'settings.input_scheme.label': 'Control Scheme'
     });
   }
   ```
2. In `index.html`, find the script-tag block near the current `persistence.js` + `i18n.js` load. Insert `<script src="js/inputScheme.js"></script>` **after** `i18n.js` and **before** the gameplay modules that will consume it (main.js, player.js, scenes/SettingsScene.js).
3. The inline `<script>window.i18n.setLanguage(window.Persistence.getLanguage());</script>` currently sits right after i18n.js (line 31). Leave it alone. `InputScheme.init()` is called from `main.js::create()` (WP02), not inline here.

**Files**:
- `js/inputScheme.js` (edit)
- `index.html` (edit — add one `<script>` line)

**Validation**:
- [ ] Loading the page does not throw
- [ ] `window.i18n.t('input.scheme.classic')` returns `'Klassisch'` (in DE) / `'Classic'` (in EN)
- [ ] `window.InputScheme` is defined after `window.i18n` in the load order

### T007 — Unit tests in tests/inputScheme.test.js

**Purpose**: TEST_FIRST compliance for every public API — run via `node tools/runTests.js`.

**Steps**:
1. Create `tests/inputScheme.test.js` using the `node:test` pattern from `tests/questSystem.test.js` (require + describe + it).
2. Import the module via `require`. Since `js/inputScheme.js` is a browser IIFE that assigns to `window`, the test file needs a small shim: create a fake `global.window = { Persistence: { ... }, i18n: { register() {}, onChange() { return () => {}; } } }` before loading, then use `_configureForTest` to inject primitives.
3. Test cases (group into `describe` blocks):
   - **persistence**: default `getScheme()` is `'classic'`; `setScheme('arpg')` persists (verify with a stub Persistence); `setScheme('bogus')` returns false and does not change the value.
   - **onChange**: subscribing fires once per `setScheme` to a new value; does not fire for same-value sets; unsubscribing stops notifications; subscriber exceptions are swallowed (not crashing subsequent subscribers).
   - **getMovementInput**: in classic, stub arrow-key down → returns `{x: -1, y: 0}` for left; in arpg, stub 'a' down → `{x: -1, y: 0}`; zero keys → `{x: 0, y: 0}`.
   - **isBasicAttackTriggered**: fires once per Space-justDown; fires once per LMB-justDown; returns false when suppress is true; debounces (two calls in the same frame → true+false).
   - **getAimDirection** (classic): uses `lastMoveDirection`; falls back to `(1,0)` when `lastMoveDirection` is zero. (ARPG): cursor far from player → correct unit vector; cursor inside 20 px → returns `lastAim`; first-ever read with no input → `(1,0)`.
   - **consumeAbilityTrigger**: returns true once per physical press; held key → one true, then false; scheme switch mid-press → latch reset, next press fires cleanly.
   - **getSlotLabel**: full 4-entry matrix per scheme.
   - **shouldSuppressCombatInput**: stubbed flags → correct truthiness.
4. Run `node tools/runTests.js` — all new tests pass; the existing 112/113 ratio is preserved (the unrelated ITEM_BASES test still fails as before).

**Files**:
- `tests/inputScheme.test.js` (new)

**Validation**:
- [ ] `node tools/runTests.js` shows an increased pass count covering the new tests
- [ ] The new file has at least 8 `test(...)` calls
- [ ] Failure case intentionally introduced (e.g., swap the label map) → test catches it (sanity check)

## Definition of Done

- [ ] All 7 subtasks complete and their validation checkboxes tick
- [ ] `node tools/runTests.js` passes; pass count went up by the number of new tests
- [ ] `window.InputScheme` public surface matches `contracts/input-scheme-api.md` exactly (names + arities). Verify by opening the module in the browser console.
- [ ] No Classic-mode behavior can change yet — consumers haven't been rewired. Regression check: run the game and confirm Classic play works.
- [ ] `js/inputScheme.js` ≤ ~300 LOC; no dead code.
- [ ] `git diff` shows only the four owned files touched.

## Risks + Reviewer Guidance

| Risk | Mitigation |
|------|------------|
| Tests need Phaser globals | Only the test file must stub the minimum — `window.Persistence`, `window.i18n`, key-state accessors. Aim for a small test harness, not a Phaser clone. |
| Circular dep: InputScheme reads `window.lastMoveDirection`, player.js writes it | Document the contract inline: "InputScheme reads, player.js owns." If needed, introduce `setLastMoveDirection` primitive and have player.js push instead of InputScheme pulling. Prefer the simpler read-pull for now. |
| `getAimDirection` called before `init` | Guard: if scene is null, return the cached `lastAim`. Never throw. |
| Persistence key collision | Use the exact same `demonfall_settings_v1` bucket as language. Verify no other code writes to `controlScheme` today (grep the repo). |

**For the reviewer**: verify the module's public surface against the contract line-by-line. Check that NO consumer code was modified (main.js, player.js, SettingsScene.js should be at HEAD). Run the test suite and smoke-check Classic play.

## Next Step

After this WP lands, WP02, WP03, and WP04 can start in parallel. Each will `spec-kitty implement WPxx --base WP01`.
