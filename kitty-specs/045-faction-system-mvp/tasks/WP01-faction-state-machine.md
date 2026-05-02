---
work_package_id: WP01
title: Faction state machine + tests (TEST_FIRST)
dependencies: []
requirement_refs:
- C-01
- C-02
- C-05
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-08
- FR-11
- NFR-01
- NFR-02
- NFR-03
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: d7f0351b9ea09fd7c6514d26769e3e83091cd9f8
created_at: '2026-05-02T14:49:39.227628+00:00'
subtasks: [T001, T002, T003]
shell_pid: "9932"
agent: "claude"
history:
- timestamp: '2026-05-02T14:50:00Z'
  actor: tasks-command
  action: created
authoritative_surface: js/factionSystem.js
execution_mode: code_change
lane: planned
owned_files:
- tests/factionSystem.test.js
- js/factionSystem.js
- index.html
---

# WP01 — Faction state machine + tests (TEST_FIRST)

## Branch strategy
- Planning base: `main` · merge target: `main`.

## Objective
Deliver `window.FactionSystem` per [contracts/faction-system-api.md](../contracts/faction-system-api.md), backed by a `node:test` unit suite. IIFE auto-initializes, registers i18n on load, persists under `demonfall_factions_v1`. Mirror the structural pattern of `js/inputScheme.js` and `js/tutorialSystem.js`.

## Context (read first)
- [spec.md](../spec.md) — FR-01..FR-08, FR-11, NFR-01..NFR-04, C-01, C-02, C-05.
- [data-model.md](../data-model.md) — persisted shape, tier function.
- [contracts/faction-system-api.md](../contracts/faction-system-api.md) — public API + 15-case test plan.
- `js/tutorialSystem.js` — reference (auto-init, `_configureForTest`, persistence migration).
- `js/inputScheme.js` — reference (subscriber pattern, exception swallowing).
- `tests/tutorialSystem.test.js` — reference test file shape (this WP's test file is structurally identical).

## TEST_FIRST mandate
1. T001 first — write tests, run `npm test`, confirm RED.
2. T002 — implement until GREEN.
3. T003 — add `<script>` include + final sweep.

---

## Subtask T001 — Write `tests/factionSystem.test.js` (RED)

**Steps**:

1. Mirror the structure of `tests/tutorialSystem.test.js` but for the faction contract. Use `node:test` + `assert`. `setup.js` provides the localStorage stub; `loadGameModule.js` loads the IIFE.

2. Write a `makePrimitives()` helper:
   ```js
   function makePrimitives() {
     const _store = {};
     const i18nCalls = { de: 0, en: 0, other: 0 };
     return {
       storage: {
         _store,
         getItem: (k) => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
         setItem: (k, v) => { _store[k] = String(v); },
         removeItem: (k) => { delete _store[k]; }
       },
       i18n: {
         _calls: i18nCalls,
         register: (lang) => {
           if (lang === 'de') i18nCalls.de += 1;
           else if (lang === 'en') i18nCalls.en += 1;
           else i18nCalls.other += 1;
         },
         t: (k) => k,
         onChange: () => () => {}
       }
     };
   }
   ```

3. Loader + `fresh()` helper following `tests/tutorialSystem.test.js` lines 71–93.

4. Implement the 15 cases listed in [contracts/faction-system-api.md §"Test plan"](../contracts/faction-system-api.md). Each test asserts on observable behavior (return values, persisted blob shape, fired callbacks). For test 12 (recursive subscriber): inside the callback, call `adjustStanding(otherFactionId, 5)`; assert no infinite recursion + the inner mutation also notifies subscribers.

5. Run `npm test`. Confirm `factionSystem.test.js` fails with "FactionSystem is undefined" — RED bar.

**Files**: `tests/factionSystem.test.js` (new, ~280 lines).

---

## Subtask T002 — Implement `js/factionSystem.js`

**Steps**:

1. Create `js/factionSystem.js` as IIFE attaching `window.FactionSystem`. Constants:
   ```js
   var STORAGE_KEY = 'demonfall_factions_v1';
   var SCHEMA_VERSION = 1;
   var FACTION_IDS = ['council', 'resistance', 'independent'];
   ```

2. State + primitives mirror tutorialSystem pattern. State shape:
   ```js
   var state = {
     initialized: false,
     standings: { council: 0, resistance: 0, independent: 0 },
     i18nRegistered: false,
     // Recursion-safe notify queue:
     _notifying: false,
     _pendingNotify: []
   };
   ```

3. Public methods per the contract: `init`, `getStanding`, `adjustStanding`, `setStanding`, `getTier`, `onChange`, `_configureForTest`. Plus `FACTIONS` constant export.

4. **Recursive subscriber handling** (D-07):
   ```js
   function _notify(factionId, newValue, oldValue) {
     if (state._notifying) {
       state._pendingNotify.push([factionId, newValue, oldValue]);
       return;
     }
     state._notifying = true;
     try {
       var snapshot = Array.from(subscribers);
       for (var i = 0; i < snapshot.length; i++) {
         try { snapshot[i](factionId, newValue, oldValue); }
         catch (err) { try { console.error('[FactionSystem] subscriber threw', err); } catch (_) {} }
       }
     } finally {
       state._notifying = false;
     }
     // Drain queued notifies that were enqueued by recursive subscribers.
     while (state._pendingNotify.length) {
       var args = state._pendingNotify.shift();
       _notify(args[0], args[1], args[2]);
     }
   }
   ```

5. Tier function per data-model:
   ```js
   function getTier(factionId) {
     if (FACTION_IDS.indexOf(factionId) < 0) return 'neutral';
     var v = state.standings[factionId];
     if (v < -25) return 'hostile';
     if (v >  50) return 'allied';
     if (v >  25) return 'friendly';
     return 'neutral';
   }
   ```

6. i18n registration — DE+EN. Use `faction.aldric.greet.{hostile,neutral,friendly,allied}` and `faction.quest.resistance_fetch.{title,desc}` keys. (WP02 will consume these.)

7. Persistence migration — same pattern as tutorialSystem (`version` check, JSON.parse try/catch, default to fresh on failure).

8. Auto-init on load: `init();` at IIFE bottom.

9. Export:
   ```js
   window.FactionSystem = {
     init: init,
     getStanding: getStanding,
     adjustStanding: adjustStanding,
     setStanding: setStanding,
     getTier: getTier,
     onChange: onChange,
     _configureForTest: _configureForTest,
     FACTIONS: { COUNCIL: 'council', RESISTANCE: 'resistance', INDEPENDENT: 'independent' }
   };
   ```

10. Run `npm test` until all 15 cases pass.

**Files**: `js/factionSystem.js` (new, ~250 lines).

---

## Subtask T003 — `index.html` script + final sweep

**Steps**:

1. In `index.html`, add `<script src="js/factionSystem.js"></script>` AFTER `i18n.js` / `storage.js` / `persistence.js` and BEFORE any scene file.

2. Run `npm test` — expect all green (155 prior tests + 15 new + any pre-existing fails are unchanged).

3. Run `npm run test:smoke` — expect exit 0, no new console errors. (Smoke does not exercise factions; just verifies game still loads.)

4. Manual sanity in browser console: `FactionSystem.getStanding('council') === 0`.

5. Commit with message:
   ```
   feat(WP01): faction state machine + tests (TEST_FIRST)

   Adds js/factionSystem.js IIFE per the contract: 3 factions
   (council/resistance/independent), [-100..+100] standing per faction
   under demonfall_factions_v1, public API + recursion-safe onChange,
   _configureForTest test seam.

   15 node:test cases cover the full contract.

   Refs #25
   ```

**Files**: `index.html` modified; nothing else.

---

## Definition of Done
- [ ] T001..T003 done.
- [ ] All 15 factionSystem unit tests pass.
- [ ] No regressions in pre-existing tests.
- [ ] Module follows IIFE-on-window convention.
- [ ] Persistence uses `demonfall_factions_v1` exclusively.

## Implementation command
```bash
spec-kitty implement WP01 --feature 045-faction-system-mvp
```

## Activity Log

- 2026-05-02T14:49:39Z – claude – shell_pid=9932 – lane=doing – Started implementation via workflow command
