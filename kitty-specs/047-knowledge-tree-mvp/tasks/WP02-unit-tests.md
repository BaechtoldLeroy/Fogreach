---
work_package_id: WP02
title: Unit Tests for KnowledgeTree API
dependencies:
- WP01
requirement_refs:
- NFR-02
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 047-knowledge-tree-mvp-WP01
base_commit: 9fc3d73ed18db7cf9a133aa33cb62d3134e65ae1
created_at: '2026-05-13T19:54:55.500683+00:00'
subtasks:
- T008
- T009
- T010
- T011
phase: Phase 2 — Parallelizable Work
assignee: ''
agent: claude
shell_pid: "10436"
history:
- timestamp: '2026-05-13T19:28:10Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: tests/knowledgeTree.test.js
execution_mode: code_change
lane: planned
owned_files:
- tests/knowledgeTree.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP02 — Unit Tests for KnowledgeTree API

## Objective

Cover the entire `window.KnowledgeTree` IIFE surface with Node-side unit tests using the existing `tools/runTests.js` runner. Satisfy SC-05 (full earn → invest → respec test loop) and the constitution's TEST_FIRST directive for risky stat-pipeline logic.

After this WP, `node tools/runTests.js` shows the 188-test baseline grown by the new tests, all green. Future refactors of `knowledgeTree.js` are protected by behavioral coverage.

## Context

- **Spec**: `kitty-specs/047-knowledge-tree-mvp/spec.md` § 7 (SC-05 demands coverage of add/invest/respec/onChange/cap/wallet/persistence/version)
- **Plan**: `kitty-specs/047-knowledge-tree-mvp/plan.md` § "Constitution Check" (TEST_FIRST adaptation)
- **Contract**: `kitty-specs/047-knowledge-tree-mvp/contracts/knowledgeTree.contract.md`
- **WP01 output**: `js/knowledgeTree.js` (this WP exercises that module)
- **Existing test patterns**: `tests/*.test.js` — look for one that loads an IIFE module on `window` (the runner provides a `window` shim). The closest analog is whatever tests already exist for `printingHouse.js`, `factionSystem.js`, or `tutorialSystem.js`. Grep `tests/` for those names; reuse their setup boilerplate.
- **Runner**: `tools/runTests.js`. Run via `node tools/runTests.js` or `npm test`.

## Branch strategy

Planning on `main`. Implement in worktree created by `spec-kitty implement WP02 --base WP01`. The `--base WP01` flag stacks this work on top of WP01's commit so the file `js/knowledgeTree.js` exists in the worktree. Merge back to `main` once green.

## Subtask T008: Test scaffolding + clean-default-state verification

**Purpose**: Set up the test file, prepare a fake `storage` implementation, wire `_configureForTest`, and prove the module starts in a clean state.

**Steps**:

1. Inspect `tools/runTests.js` and one or two existing test files (especially any that load IIFE-on-window modules — e.g., `tests/printingHouse.test.js` if it exists, otherwise `tests/factionSystem.test.js` or `tests/tutorialSystem.test.js`). Identify:
   - How `window` is shimmed (likely `global.window = global` or via JSDOM-ish stub).
   - How the module under test is loaded (via `require` of the JS file, or eval).
   - The assertion style (Node `assert` or a tiny custom matcher).

2. Create `tests/knowledgeTree.test.js`. At the top:
   ```js
   // Test scaffolding — see existing tests/*.test.js for the runner's conventions.
   // Load knowledgeTree.js after stubbing window + console.

   const assert = require('assert');

   // Minimal in-memory storage stub matching the localStorage API surface:
   function makeStorage(initial) {
     const data = Object.assign({}, initial || {});
     return {
       getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
       setItem: function (k, v) { data[k] = String(v); },
       removeItem: function (k) { delete data[k]; },
       _dump: function () { return Object.assign({}, data); }
     };
   }

   // Silent console for tests so warnings don't pollute output:
   function makeQuietConsole() {
     return { warn: function () {}, log: function () {} };
   }

   // Load the module — adapt to the runner's loading convention.
   // If the runner uses node `require` with a window shim, see existing tests.
   require('../js/knowledgeTree.js');  // attaches KnowledgeTree to global window
   ```

3. First test — clean state after `_configureForTest({})`:
   ```js
   exports.testCleanStateAfterReset = function () {
     window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
     assert.strictEqual(window.KnowledgeTree.getFragments(), 0);
     const state = window.KnowledgeTree.getState();
     assert.strictEqual(Object.keys(state.ranks).length, 10);
     for (const id in state.ranks) assert.strictEqual(state.ranks[id], 0);
   };
   ```

4. Make sure the runner picks up the file. Most runners auto-discover `tests/*.test.js`; verify with `node tools/runTests.js` after just T008 — expect "1 new test" appearing in the output.

**Files**:
- `tests/knowledgeTree.test.js` (new, ~60 LOC for this subtask)

**Validation**:
- `node tools/runTests.js` shows the new test passing.
- Pre-existing test count unchanged (no regressions).

**Edge cases**:
- The runner may need a JSDOM-ish `window` shim — verify by looking at an existing test that touches `window.foo`. If absent, add `global.window = global;` at the top of the test file before `require`-ing the module.

---

## Subtask T009: Core API tests — add / invest / respec / cap / wallet

**Purpose**: Verify the public API contracts (FR-03, FR-04, FR-05, SC-01, SC-02, SC-03) directly.

**Steps**:

Add to `tests/knowledgeTree.test.js`:

```js
exports.testAddFragmentsBasics = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(3);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 3);
  window.KnowledgeTree.addFragments(0); // no-op
  assert.strictEqual(window.KnowledgeTree.getFragments(), 3);
  window.KnowledgeTree.addFragments(-5); // rejected
  assert.strictEqual(window.KnowledgeTree.getFragments(), 3);
};

exports.testInvestHappyPath = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(3);
  const ok = window.KnowledgeTree.invest('node_damage');
  assert.strictEqual(ok, true);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 2);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 1);
  // Buff field updated
  assert.strictEqual(window.knowledgeTreeBuffs.damageMult, 1.05);
};

exports.testInvestNoFragments = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  const ok = window.KnowledgeTree.invest('node_damage');
  assert.strictEqual(ok, false);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 0);
};

exports.testInvestCapReached = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(10);
  for (let i = 0; i < 5; i++) assert.strictEqual(window.KnowledgeTree.invest('node_damage'), true);
  // 6th invest blocked by maxRank=5
  assert.strictEqual(window.KnowledgeTree.invest('node_damage'), false);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 5);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 5);
};

exports.testInvestUnknownNode = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(1);
  const ok = window.KnowledgeTree.invest('node_nonexistent');
  assert.strictEqual(ok, false);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 1);
};

exports.testRespecRefundsAll = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(10);
  window.KnowledgeTree.invest('node_damage'); // -1
  window.KnowledgeTree.invest('node_damage'); // -1
  window.KnowledgeTree.invest('node_armor');  // -1
  assert.strictEqual(window.KnowledgeTree.getFragments(), 7);
  window.KnowledgeTree.respec();
  assert.strictEqual(window.KnowledgeTree.getFragments(), 10);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 0);
  assert.strictEqual(window.KnowledgeTree.getRank('node_armor'), 0);
  // Buffs reset to identity
  assert.strictEqual(window.knowledgeTreeBuffs.damageMult, 1.0);
  assert.strictEqual(window.knowledgeTreeBuffs.armorAdd, 0);
};
```

**Files**:
- `tests/knowledgeTree.test.js` (~120 LOC added)

**Validation**:
- `node tools/runTests.js` — all 6 new tests pass.
- No regressions on existing 188 tests.

**Edge cases**:
- `getRank` on unknown nodeId returns 0 (silent, per contract).
- Investing in `node_xp` (maxRank 3) hits cap after 3 ranks — covered by the cap test using `node_damage` (maxRank 5); a parallel test for a maxRank-3 node strengthens coverage:
  ```js
  exports.testInvestCapMaxRank3 = function () { /* node_xp */ };
  ```
  Add it if budget allows; not strictly required.

---

## Subtask T010: Persistence tests — round-trip + version + clamp + drop-unknown

**Purpose**: Cover FR-02, FR-11, NFR-02 and the "Edge Cases" enumerated in spec §8.

**Steps**:

Add to `tests/knowledgeTree.test.js`:

```js
exports.testPersistenceRoundTrip = function () {
  const stor = makeStorage();
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  window.KnowledgeTree.addFragments(5);
  window.KnowledgeTree.invest('node_damage');
  // Re-init: simulate a reload — _configureForTest resets state then loads from storage
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getFragments(), 4);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 1);
};

exports.testPersistenceVersionMismatchStartsFresh = function () {
  const stor = makeStorage({
    'demonfall.knowledgeTree.v1': JSON.stringify({ version: 99, fragments: 100, ranks: { node_damage: 5 } })
  });
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getFragments(), 0);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 0);
};

exports.testPersistenceMalformedJsonStartsFresh = function () {
  const stor = makeStorage({ 'demonfall.knowledgeTree.v1': '{not-valid-json' });
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getFragments(), 0);
};

exports.testPersistenceClampOverRankRefunds = function () {
  // node_damage maxRank is 5; persisted blob has rank=8 — module clamps to 5 and refunds 3
  const stor = makeStorage({
    'demonfall.knowledgeTree.v1': JSON.stringify({ version: 1, fragments: 2, ranks: { node_damage: 8 } })
  });
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 5);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 2 + 3); // refund 3
};

exports.testPersistenceDropsUnknownNodeAndRefunds = function () {
  const stor = makeStorage({
    'demonfall.knowledgeTree.v1': JSON.stringify({ version: 1, fragments: 1, ranks: { node_unknown_v2_thing: 4 } })
  });
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getRank('node_unknown_v2_thing'), 0);
  assert.strictEqual(window.KnowledgeTree.getFragments(), 1 + 4); // refund 4
};

exports.testPersistenceMissingRanksDefaultsToZero = function () {
  // FR-11: missing nodeIds default to rank 0
  const stor = makeStorage({
    'demonfall.knowledgeTree.v1': JSON.stringify({ version: 1, fragments: 3 })
  });
  window.KnowledgeTree._configureForTest({ storage: stor, console: makeQuietConsole() });
  assert.strictEqual(window.KnowledgeTree.getFragments(), 3);
  assert.strictEqual(window.KnowledgeTree.getRank('node_damage'), 0);
};
```

**Files**:
- `tests/knowledgeTree.test.js` (~110 LOC added)

**Validation**:
- All 6 new persistence tests green.
- Existing tests still green.

**Edge cases**:
- Storage write failure (quota): hard to simulate without a richer stub; document as out-of-scope and rely on manual verification per `quickstart.md`.
- `_configureForTest` itself must reset state cleanly even if storage is empty — the first test (T008) covers that path.

---

## Subtask T011: Subscriber tests — notify + unsubscribe + throwing-isolation (NFR-04)

**Purpose**: Cover the subscriber contract from §10 of `research.md` and NFR-04.

**Steps**:

Add to `tests/knowledgeTree.test.js`:

```js
exports.testSubscriberNotifiedOnAdd = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  let calls = 0;
  let lastState = null;
  window.KnowledgeTree.onChange(function (s) { calls++; lastState = s; });
  window.KnowledgeTree.addFragments(2);
  assert.strictEqual(calls, 1);
  assert.strictEqual(lastState.fragments, 2);
};

exports.testSubscriberNotifiedOnInvestAndRespec = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  let calls = 0;
  window.KnowledgeTree.onChange(function () { calls++; });
  window.KnowledgeTree.addFragments(1);   // +1
  window.KnowledgeTree.invest('node_damage'); // +1
  window.KnowledgeTree.respec();              // +1
  assert.strictEqual(calls, 3);
};

exports.testUnsubscribeStopsNotifications = function () {
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  let calls = 0;
  const off = window.KnowledgeTree.onChange(function () { calls++; });
  window.KnowledgeTree.addFragments(1);
  assert.strictEqual(calls, 1);
  off();
  window.KnowledgeTree.addFragments(1);
  assert.strictEqual(calls, 1); // not incremented
};

exports.testThrowingSubscriberDoesNotBlockOthers = function () {
  // NFR-04
  window.KnowledgeTree._configureForTest({ storage: makeStorage(), console: makeQuietConsole() });
  let goodCalls = 0;
  window.KnowledgeTree.onChange(function () { throw new Error('subscriber failure'); });
  window.KnowledgeTree.onChange(function () { goodCalls++; });
  window.KnowledgeTree.addFragments(1);
  assert.strictEqual(goodCalls, 1);
};
```

**Files**:
- `tests/knowledgeTree.test.js` (~70 LOC added)

**Validation**:
- All 4 new subscriber tests green.
- Total test run: 188 baseline + the new tests (count depends on T009 inclusion of the optional test). Expect ≥ 16 new tests.

**Edge cases**:
- A subscriber added during notification iteration: `Set.forEach` iterates a snapshot — the new subscriber fires only on the next notification. Don't test this directly unless you spotted a bug; document if observed.
- Throwing in `respec`'s `recalcDerived` path is covered indirectly — the module's catch-and-warn in `invest`/`respec` doesn't propagate.

---

## Definition of Done (WP02)

All of:
- [ ] `tests/knowledgeTree.test.js` exists with all four subtask's tests (~16+ test functions)
- [ ] `node tools/runTests.js` passes — baseline (188) + new tests (16+) — total ≥ 204
- [ ] No regressions in existing tests
- [ ] Each test cleanly resets state via `_configureForTest({...})` — no cross-test interference
- [ ] All warnings are suppressed via the quiet-console stub; test output is clean
- [ ] At minimum, every SC clause from spec §7 has at least one test backing it (SC-01 add, SC-02 invest, SC-03 respec, SC-05 persistence)

## Risks

- **Runner conventions unknown**: spend the first 10 minutes reading `tools/runTests.js` and 1-2 existing tests. Reuse the exact loading pattern they use — don't invent a new one.
- **`require` of a classic-script file**: Node's `require` doesn't execute IIFE on-window the same way the browser does. Existing tests must have a workaround (likely `global.window = global` before `require`); reuse it.
- **Test count drift**: if the team adds tests between WP01 and WP02 merge, the "188 baseline" comment may need updating to the new baseline. Use `git log` to see if `tests/` was touched.

## Reviewer guidance

Before approving:
1. `node tools/runTests.js` — all green.
2. Read `tests/knowledgeTree.test.js` and confirm each test asserts the **behavior** specified in the contract, not internal implementation details (e.g., test the result of `getFragments` after `addFragments`, don't test that `_saveToStorage` was called).
3. Confirm no test mutates persistent state between runs (each test sets up its own `makeStorage()`).
4. Verify warning suppression — running the suite produces no `console.warn` output.

## Next WP

WP02 is leaf — nothing depends on it. After approval, the test suite stays as a regression net for any future refactor of `knowledgeTree.js`.

## Implementation command

```bash
spec-kitty implement WP02 --base WP01
```
