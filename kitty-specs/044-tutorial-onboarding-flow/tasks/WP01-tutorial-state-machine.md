---
work_package_id: WP01
title: Tutorial state machine + tests (TEST_FIRST)
dependencies: []
requirement_refs:
- C-02
- C-07
- FR-01
- FR-02
- FR-03
- FR-04
- FR-07
- FR-11
- NFR-03
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 5931da1dee9f15810212e1eba4bdcf506f9fff15
created_at: '2026-05-02T11:50:46.209891+00:00'
subtasks: [T001, T002, T003]
shell_pid: "27776"
history:
- timestamp: '2026-05-02T11:30:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/tutorialSystem.js
execution_mode: code_change
lane: planned
owned_files:
- tests/tutorialSystem.test.js
- js/tutorialSystem.js
---

# WP01 — Tutorial state machine + tests (TEST_FIRST)

## Branch strategy

- **Planning base**: `main`
- **Merge target**: `main`
- During `/spec-kitty.implement` the helper may stack this WP differently; the canonical source of truth at implement time is the resolved `--base` flag.

## Objective

Deliver `window.TutorialSystem` exactly per [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md), backed by a complete unit-test suite that proves correctness in isolation. The IIFE auto-initializes on script load (registers DE+EN i18n strings, restores persisted state) and exposes the public API plus a `_configureForTest` test seam.

This is **WP01 of 6** and the foundation of the entire feature. Every other WP depends on this contract being stable.

## Context (read first)

- [spec.md](../spec.md) — feature requirements, especially FR-01..FR-04, FR-07, FR-11, NFR-04, NFR-05, C-07.
- [data-model.md](../data-model.md) — persisted shape, the 12 step descriptors, event vocabulary, i18n key list.
- [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md) — public API, semantics, failure modes, **the 15 unit-test cases listed in the bottom section are the canonical T001 acceptance criteria**.
- [research.md](../research.md) D-01 (persistence key), D-03 (pub/sub), D-07 (out-of-order), D-09 (i18n boundary), D-10 (test seam).
- `js/inputScheme.js` — reference implementation pattern (IIFE on `window`, `_configureForTest`, `onChange` exception swallowing, persistence-key ownership).
- `tests/inputScheme.test.js` — reference test pattern (`node:test`, `loadGameModule`, primitives stub).
- `tests/setup.js` — provides `window` + `localStorage` stubs.
- `tests/loadGameModule.js` — loads IIFE-wrapped game files.

## TEST_FIRST mandate

This WP **must** start red. Subtask order is non-negotiable:

1. **T001 first** — write the test file. Run `npm test`. Confirm the new test file fails with "TutorialSystem is undefined" (or similar). This is the red bar.
2. **T002 second** — implement `js/tutorialSystem.js` until each test goes green.
3. **T003 last** — final sweep: full test suite green, no regressions, smoke unaffected.

Do **not** sketch an implementation alongside the tests. Write tests against the contract; let them fail; then implement.

---

## Subtask T001 — Write `tests/tutorialSystem.test.js` (RED bar)

**Purpose**: Encode the contract from [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md) §"Test plan" as 15 executable `node:test` cases. Use the same patterns as `tests/inputScheme.test.js`.

**Steps**:

1. Create `tests/tutorialSystem.test.js`. Top-level imports:

   ```js
   const { test, beforeEach } = require('node:test');
   const assert = require('node:assert');
   const { resetStore } = require('./setup');
   const { loadGameModule } = require('./loadGameModule');
   ```

2. Write a `makePrimitives()` helper that returns a fresh stub set per test:

   ```js
   function makePrimitives() {
     const _store = {};
     let _now = 0;
     const _timers = []; // {id, fireAt, cb}
     let _nextTimerId = 1;

     return {
       state: { i18nRegistered: { de: 0, en: 0 } },
       storage: {
         getItem: (k) => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
         setItem: (k, v) => { _store[k] = String(v); },
         removeItem: (k) => { delete _store[k]; },
         _store,
       },
       i18n: {
         register: (lang, _strings) => { /* count */ },
         t: (k) => k,
         onChange: () => () => {},
       },
       now: () => _now,
       advanceClock: (ms) => {
         _now += ms;
         // fire any timers due
         for (const t of [..._timers]) {
           if (t.fireAt <= _now) {
             const idx = _timers.indexOf(t);
             if (idx >= 0) _timers.splice(idx, 1);
             t.cb();
           }
         }
       },
       scheduler: {
         setTimeout: (cb, delay) => {
           const id = _nextTimerId++;
           _timers.push({ id, fireAt: _now + delay, cb });
           return id;
         },
         clearTimeout: (id) => {
           const idx = _timers.findIndex(t => t.id === id);
           if (idx >= 0) _timers.splice(idx, 1);
         },
       },
       persistence: {
         hasSave: () => false,  // override per test as needed
       },
     };
   }
   ```

3. Loader helper (mirrors `inputScheme.test.js`):

   ```js
   let loaded = false;
   function ensureLoaded() {
     if (!loaded) {
       if (!globalThis.window.i18n) {
         globalThis.window.i18n = { register: () => {}, t: (k) => k, onChange: () => () => {} };
       }
       loadGameModule('js/tutorialSystem.js');
       loaded = true;
     }
     return globalThis.window.TutorialSystem;
   }

   function fresh(overrides = {}) {
     const TS = ensureLoaded();
     const p = makePrimitives();
     Object.assign(p, overrides);
     TS._configureForTest(p);
     return { TS, p };
   }

   beforeEach(() => { resetStore(); });
   ```

4. Implement the 15 test cases below. Each test name must read like a contract assertion. Group with comments where helpful.

   | # | Test name (suggested)                                                                       |
   |---|---------------------------------------------------------------------------------------------|
   | 1 | `init() is idempotent and registers i18n exactly once`                                       |
   | 2 | `maybeAutoSkip returns true and persists skipped:true when hasSave() is true`                 |
   | 3 | `maybeAutoSkip seeds fresh state and advances to the first visible step when no save exists` |
   | 4 | `report() is a no-op when inactive`                                                          |
   | 5 | `report() is a no-op when event name does not match current step`                             |
   | 6 | `report() advances when event matches and matcher passes`                                     |
   | 7 | `report() does not advance when matcher returns false`                                        |
   | 8 | `step 11 auto-dismisses after 5000 ms via the injected scheduler`                             |
   | 9 | `skip(true) deactivates and persists; skip(false) is a no-op`                                 |
   | 10 | `replay() resets state and does not touch unrelated localStorage keys`                       |
   | 11 | `onChange fires on advance, skip, and replay; unsubscribe stops further calls`               |
   | 12 | `onChange swallows subscriber exceptions; remaining subscribers still fire`                  |
   | 13 | `out-of-order report() (e.g., loot.picked during step 7) is dropped`                          |
   | 14 | `stored blob with version > 1 is discarded on init`                                           |
   | 15 | `final advance past last step sets active:false, currentStepId:null and fires onChange(null)` |

   Write tests that assert on **observable behavior** (return values, persisted state, fired callbacks) — not implementation internals.

   For test 10, seed `localStorage` with an unrelated key (`demonfall_save_v1: 'sentinel'`) before calling `replay()`, then assert it's still present.

   For test 14, seed the store with `{"version":2,"active":true,...}` and assert `getCurrentStep()` returns the **fresh** initial state, not the loaded blob.

5. Run the suite: `npm test`. Confirm `tutorialSystem.test.js` fails (the module doesn't exist yet). **This is the RED bar.** Commit nothing yet.

**Files**:
- `tests/tutorialSystem.test.js` — new, ~280 lines.

**Validation**:
- [ ] File exists.
- [ ] `npm test` runs and exits non-zero with a clear failure indicating `TutorialSystem` is undefined.
- [ ] All 15 test names are present (ripgrep `^test\(` to count).

**Edge cases captured by tests** (not separate cases — embedded into the 15):
- `report()` before `init()` → no-op (covered by test 4).
- `_configureForTest` re-call → fresh in-memory state (used by `fresh()` helper).
- Subscriber that calls `skip(true)` mid-callback → must not deadlock or double-fire.

---

## Subtask T002 — Implement `js/tutorialSystem.js`

**Purpose**: Make all 15 tests green. Mirror the IIFE-on-`window` pattern from `js/inputScheme.js`.

**Steps**:

1. Create `js/tutorialSystem.js`. Wrap as an IIFE that assigns `window.TutorialSystem`. **Avoid `let`/`const` at module scope** (codebase convention — see auto-memory note "let ≠ window-property").

   ```js
   (function () {
     const STORAGE_KEY = 'demonfall_tutorial_v1';
     const SCHEMA_VERSION = 1;

     // Default primitives (real browser path).
     let primitives = {
       storage: (typeof window !== 'undefined' && window.localStorage) || nullStorage(),
       i18n: (typeof window !== 'undefined' && window.i18n) || nullI18n(),
       now: () => Date.now(),
       scheduler: { setTimeout, clearTimeout },
       persistence: (typeof window !== 'undefined' && window.Persistence) || { hasSave: () => false },
     };

     // ... STEPS array (12 entries, see data-model.md) ...

     // ... internal state object ...

     function init() { /* idempotent */ }
     function maybeAutoSkip() { /* ... */ }
     function report(evt, payload) { /* advance algorithm from contract */ }
     function getCurrentStep() { /* shallow copy or null */ }
     function isActive() { /* ... */ }
     function skip(confirmed) { /* ... */ }
     function replay() { /* ... */ }
     function onChange(cb) { /* returns unsubscribe */ }
     function _configureForTest(p) { /* swap primitives + reset state */ }

     // Auto-init on load.
     init();

     window.TutorialSystem = {
       init, maybeAutoSkip, report, getCurrentStep, isActive,
       skip, replay, onChange, _configureForTest,
     };
   })();
   ```

2. **STEPS array**: encode all 12 steps from [data-model.md §"The 12 steps"](../data-model.md). Keep step 1 (`init`) as a non-visible step — `getCurrentStep()` should still return the descriptor but the overlay's banner remains hidden when `hintKey` is nullish.

3. **i18n registration**: at IIFE load (after `init()` has run), iterate through both DE and EN tables and call `primitives.i18n.register('de', table)` and `register('en', table)`. Use the keys listed in [data-model.md §"i18n keys"](../data-model.md). For first-pass strings, write idiomatic German for `de` and a faithful English translation for `en`. Sample mapping (extend per the full key list):

   ```js
   const I18N_DE = {
     'tutorial.step.movement': 'WASD zum Bewegen',
     'tutorial.step.forge_approach': 'Geh zur Werkstatt',
     'tutorial.step.forge_dialog': '[E] um zu sprechen',
     'tutorial.step.keller_approach': 'Geh zum Rathauskeller',
     'tutorial.step.keller_enter': '[E] um den Dungeon zu betreten',
     'tutorial.step.combat_basics': 'WASD bewegen, LMB/Space angreifen',
     'tutorial.step.combat_ability': 'Ability-Slot 1 — Q drücken',
     'tutorial.step.loot_pickup': 'Klick zum Aufheben',
     'tutorial.step.loot_equip': 'Rechtsklick zum Anlegen',
     'tutorial.step.save_notice': 'Dein Fortschritt wird automatisch gespeichert',
     'tutorial.step.druckerei_visit': 'Geh zur Druckerei',
     'tutorial.druckerei.stub': 'Setzer Thom: »Die Druckerei ist noch in Arbeit. Komm bald wieder.«',
     'tutorial.skip.confirm': 'Tutorial wirklich überspringen?',
     'tutorial.settings.skip_label': 'Tutorial überspringen',
     'tutorial.settings.replay_label': 'Tutorial neu starten',
     'tutorial.settings.replay_confirm': 'Tutorial wirklich von vorne beginnen?',
   };
   ```

4. **State machine algorithm**: implement `report()` exactly as the algorithm in [contracts/tutorial-system-api.md §"Step-advance algorithm"](../contracts/tutorial-system-api.md). Persist after every transition.

5. **Auto-dismiss for step 11**: when the system advances *into* step 11, immediately call `primitives.scheduler.setTimeout` with the step's `autoDismissMs`; on fire, advance to step 12.

6. **Persistence migration**: when reading the stored blob, if `JSON.parse` throws OR `version !== 1`, treat as missing and clear the key.

7. **`_configureForTest`**:
   - Replace `primitives` with the supplied object (shallow merge if partial).
   - Reset internal state to a fresh, uninitialized form.
   - Re-run `init()` so the test starts from a clean known state.

8. **Failure-mode guards** per the contract's failure-modes table:
   - All localStorage access wrapped in `try/catch`; failures log via `console.warn` once and continue in-memory.
   - `i18n.register` may throw → swallow.
   - `onChange` callback exceptions → caught + `console.error`; other subscribers still fire.

9. Run `npm test` repeatedly until all 15 tests pass.

**Files**:
- `js/tutorialSystem.js` — new, ~250 lines.

**Validation**:
- [ ] All 15 unit tests pass.
- [ ] Manual sanity: open the game, in DevTools call `TutorialSystem.getCurrentStep()` — does not throw.
- [ ] No new console errors at game boot when no `demonfall_tutorial_v1` key exists.

---

## Subtask T003 — Verify GREEN + no regressions

**Purpose**: Make sure the rest of the test suite still passes and the game still boots.

**Steps**:

1. Run the full unit suite:
   ```powershell
   npm test
   ```
   Expect all tests green, including `abilitySystem`, `roomNav`, `questSystem`, `eliteEnemies`, `lootSystem`, `inputScheme`, and the new `tutorialSystem`.

2. Run the smoke (Playwright):
   ```powershell
   npm run test:smoke
   ```
   Expect exit 0. The smoke does not yet exercise the tutorial; it just verifies the game still loads. If it fails, suspect a script-load order issue (defer to WP02 to add the `<script>` include — at this point `tutorialSystem.js` is **not** yet referenced in `index.html`, so the test should pass without changes).

3. Manual sanity boot:
   - `npx serve .`
   - Load the page; play one wave.
   - Confirm no new console errors.

4. Commit. Suggested message:
   ```
   feat(tutorial): tutorial state machine + tests (WP01)

   Adds js/tutorialSystem.js IIFE with persistence, pub/sub, and i18n
   registration. 15 node:test cases cover the public contract.

   Refs #29
   ```

**Files**: none new.

**Validation**:
- [ ] `npm test` exits 0.
- [ ] `npm run test:smoke` exits 0.
- [ ] Game boots without new console output.

---

## Definition of Done

- [ ] T001, T002, T003 all marked complete.
- [ ] All 15 tutorialSystem unit tests pass.
- [ ] No regressions in pre-existing tests.
- [ ] `js/tutorialSystem.js` follows the codebase's IIFE-on-`window` convention (no top-level `let`/`const` exposed as window properties).
- [ ] Persistence uses `demonfall_tutorial_v1` exclusively.
- [ ] i18n keys registered for both `de` and `en`.

## Risks & mitigations

- **i18n not loaded yet at IIFE eval** → wrap `i18n.register` in try/catch; default to no-op if `window.i18n` is missing.
- **Persistence quota errors** → swallow + log once.
- **Subtle algorithm bug in step-advance** → covered by tests 4–8 + 13.

## Reviewer guidance

- Read [contracts/tutorial-system-api.md](../contracts/tutorial-system-api.md) first.
- Spot-check that test names map 1:1 to the 15-case list in the contract.
- Spot-check `report()` carefully against the algorithm in the contract.
- Verify the file follows `inputScheme.js`'s structural pattern (IIFE, `_configureForTest`, `onChange` with exception swallowing, persistence-key ownership).

## Implementation command

```bash
spec-kitty implement WP01 --feature 044-tutorial-onboarding-flow
```
