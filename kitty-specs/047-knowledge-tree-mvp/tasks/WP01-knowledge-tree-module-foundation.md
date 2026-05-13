---
work_package_id: WP01
title: knowledgeTree.js Module Foundation
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-10
- FR-11
- NFR-02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 9bbee24c7678f1dad236841f0a66359f499cb3b3
created_at: '2026-05-13T19:48:18.935172+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
phase: Phase 1 — Foundation
assignee: ''
agent: ''
shell_pid: "28552"
history:
- timestamp: '2026-05-13T19:28:10Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: js/knowledgeTree.js
execution_mode: code_change
lane: planned
owned_files:
- js/knowledgeTree.js
- index.html
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — `knowledgeTree.js` Module Foundation

## Objective

Create the single `js/knowledgeTree.js` IIFE module that holds catalog, state, persistence, buff-recompute, public API, subscribers, and i18n registration. Wire it into `index.html`. This is the foundation — every other WP depends on the API and globals defined here.

After this WP, the player can interact with the Knowledge Tree **from DevTools only** (no UI yet). The module exposes `window.KnowledgeTree.*` and `window.knowledgeTreeBuffs`.

## Context

- **Spec**: `kitty-specs/047-knowledge-tree-mvp/spec.md`
- **Plan**: `kitty-specs/047-knowledge-tree-mvp/plan.md`
- **Data model**: `kitty-specs/047-knowledge-tree-mvp/data-model.md`
- **API contract**: `kitty-specs/047-knowledge-tree-mvp/contracts/knowledgeTree.contract.md`
- **Research notes**: `kitty-specs/047-knowledge-tree-mvp/research.md` (R-03, R-04, R-05, R-07, R-08, R-09, R-10 are directly relevant)
- **Pattern source**: `js/printingHouse.js` (closest analog — IIFE on `window` + persistence + `_configureForTest` + subscriber set + i18n register)
- **Pattern source 2**: `js/tutorialSystem.js` (i18n register pattern with DE+EN double-table)

## Branch strategy

Planning base: `main`. Merge target: `main`. No feature branch. Implement in the WP01 worktree created by `spec-kitty implement WP01`. The base may be overridden by the `--base` flag during implementation for stacked WPs — but WP01 has no parent, so it builds directly off `main`.

## Mandatory ordering inside this WP

Subtasks T001–T007 in numeric order. Each builds on the previous one. **Do not skip ahead** — for example, T003 needs T002's catalog to exist before it can compute initial buff identities.

---

## Subtask T001: IIFE skeleton + i18n registration

**Purpose**: Lay down the file structure, register all 54 i18n keys (DE + EN), and expose a placeholder `window.KnowledgeTree` namespace so other modules can feature-detect it.

**Steps**:

1. Create file `js/knowledgeTree.js` with this top-level shape (mirror `js/printingHouse.js` for the IIFE wrapper):
   ```js
   (function () {
     'use strict';
     if (window.KnowledgeTree) return; // idempotent guard
     // i18n register (T001)
     // catalog (T002)
     // state (T003)
     // persistence (T004)
     // api (T005)
     // subscribers + test seam (T006)
     window.KnowledgeTree = { /* public surface filled in T005 */ };
   })();
   ```

2. Register all i18n keys at the top of the IIFE. The pattern is `if (window.i18n) { window.i18n.register('de', {...}); window.i18n.register('en', {...}); }`.

   **Chrome keys** (apply to both langs):
   - `knowledge.title` — "Wissensbaum" / "Knowledge Tree"
   - `knowledge.fragments` — "Fragmente: {count}" / "Fragments: {count}"
   - `knowledge.btn.respec` — "[ Zurücksetzen ]" / "[ Respec ]"
   - `knowledge.btn.close` — "[ Schließen ]" / "[ Close ]"
   - `knowledge.respec.confirm` — "Wissen wirklich zurücksetzen?" / "Really reset the knowledge tree?"
   - `knowledge.rank` — "Rang {rank}/{max}" / "Rank {rank}/{max}"
   - `knowledge.maxRank` — "Maximaler Rang erreicht" / "Maximum rank reached"
   - `knowledge.noFragments` — "Keine Fragmente" / "No fragments"

   **Per-node label + desc** (10 nodes × 2 keys × 2 langs = 40 strings). Use the table from `data-model.md` §"Effect application". Example for one node:
   ```js
   'knowledge.node.damage.label': 'Kraft des Wissens',
   'knowledge.node.damage.desc':  '+5 % Schaden pro Rang',
   ```
   English equivalent in the en-table. Use the German labels from `research.md` R-04.

3. Run grep `knowledge\\.` over `js/` before saving to verify no collision. If `knowledge.*` already exists, namespace as `knowledgetree.*` instead — but per current code search this is clean.

**Files**:
- `js/knowledgeTree.js` (new, ~80 LOC for this subtask alone)

**Validation**:
- File created, parses as JS (open in browser, no syntax errors in console).
- `window.KnowledgeTree` is truthy after page load.
- `window.i18n.t('knowledge.title')` returns "Wissensbaum" with locale 'de', "Knowledge Tree" with 'en'.

**Edge cases**:
- `window.i18n` may be undefined if script load order is wrong (this WP fixes load order in T007 — accept the guard for now).

---

## Subtask T002: Catalog definition (10 nodes)

**Purpose**: Define the static `CATALOG` array with stable IDs and per-rank effect parameters. The catalog is immutable — frozen on module load.

**Steps**:

1. Inside the IIFE, define:
   ```js
   const CATALOG = Object.freeze([
     { id: 'node_damage',     labelKey: 'knowledge.node.damage.label',     descKey: 'knowledge.node.damage.desc',     maxRank: 5, perRank: { field: 'damageMult',     kind: 'mult', value: 0.05 } },
     { id: 'node_armor',      labelKey: 'knowledge.node.armor.label',      descKey: 'knowledge.node.armor.desc',      maxRank: 5, perRank: { field: 'armorAdd',      kind: 'add',  value: 0.05 } },
     { id: 'node_speed',      labelKey: 'knowledge.node.speed.label',      descKey: 'knowledge.node.speed.desc',      maxRank: 5, perRank: { field: 'speedMult',      kind: 'mult', value: 0.03 } },
     { id: 'node_max_hp',     labelKey: 'knowledge.node.max_hp.label',     descKey: 'knowledge.node.max_hp.desc',     maxRank: 5, perRank: { field: 'maxHpAdd',      kind: 'add',  value: 10   } },
     { id: 'node_crit',       labelKey: 'knowledge.node.crit.label',       descKey: 'knowledge.node.crit.desc',       maxRank: 5, perRank: { field: 'critAdd',       kind: 'add',  value: 0.02 } },
     { id: 'node_xp',         labelKey: 'knowledge.node.xp.label',         descKey: 'knowledge.node.xp.desc',         maxRank: 3, perRank: { field: 'xpMult',         kind: 'mult', value: 0.05 } },
     { id: 'node_gold',       labelKey: 'knowledge.node.gold.label',       descKey: 'knowledge.node.gold.desc',       maxRank: 3, perRank: { field: 'goldMult',       kind: 'mult', value: 0.05 } },
     { id: 'node_pickup',     labelKey: 'knowledge.node.pickup.label',     descKey: 'knowledge.node.pickup.desc',     maxRank: 3, perRank: { field: 'pickupAddRange', kind: 'add',  value: 20   } },
     { id: 'node_magic_find', labelKey: 'knowledge.node.magic_find.label', descKey: 'knowledge.node.magic_find.desc', maxRank: 3, perRank: { field: 'magicFindMult', kind: 'mult', value: 0.05 } },
     { id: 'node_cdr',        labelKey: 'knowledge.node.cdr.label',        descKey: 'knowledge.node.cdr.desc',        maxRank: 5, perRank: { field: 'cdrAll',        kind: 'add',  value: 0.03 } }
   ]);
   ```

2. Build a lookup index for O(1) access by id:
   ```js
   const CATALOG_BY_ID = {};
   for (const node of CATALOG) CATALOG_BY_ID[node.id] = node;
   ```

3. Total max-rank fragment cost sanity check (T002 — comment in code, not asserted at runtime):
   - Sum of `maxRank` = 5+5+5+5+5+3+3+3+3+5 = **42**. The respec invariant: refund returns all 42 to fragments when fully invested.

**Files**:
- `js/knowledgeTree.js` (catalog block, ~30 LOC)

**Validation**:
- Catalog has exactly 10 entries (FR-06 lower bound 8, upper bound 10).
- Every `node.maxRank` is in `[1, 5]` (FR-07 range 3-5 recommended).
- Every `node.perRank.field` is one of `{damageMult, armorAdd, speedMult, maxHpAdd, critAdd, xpMult, goldMult, pickupAddRange, magicFindMult, cdrAll}` (matches contract).
- `CATALOG_BY_ID['node_damage'].maxRank === 5`.

**Edge cases**:
- `Object.freeze` is shallow — `node.perRank` is still mutable internally but the array length is locked. Acceptable for MVP; future tests can `Object.freeze(node)` if paranoid.

---

## Subtask T003: State + buff-recompute

**Purpose**: Maintain the current `fragments` count and per-node ranks in memory. Recompute `window.knowledgeTreeBuffs` from these whenever state changes.

**Steps**:

1. Module-private state (NOT on window — use closure):
   ```js
   let state = { fragments: 0, ranks: {} };
   for (const node of CATALOG) state.ranks[node.id] = 0;
   ```

2. Initialize `window.knowledgeTreeBuffs` with **neutral identity values** at module load:
   ```js
   window.knowledgeTreeBuffs = {
     damageMult: 1.0,
     armorAdd: 0,
     speedMult: 1.0,
     maxHpAdd: 0,
     critAdd: 0,
     xpMult: 1.0,
     goldMult: 1.0,
     pickupAddRange: 0,
     magicFindMult: 1.0,
     cdrAll: 0
   };
   ```

3. Implement `_applyRanksToBuffs()` — mutates the existing object **in place** (object identity is stable per the contract):
   ```js
   function _applyRanksToBuffs() {
     const b = window.knowledgeTreeBuffs;
     // reset to identity
     b.damageMult = 1.0; b.armorAdd = 0; b.speedMult = 1.0; b.maxHpAdd = 0;
     b.critAdd = 0; b.xpMult = 1.0; b.goldMult = 1.0; b.pickupAddRange = 0;
     b.magicFindMult = 1.0; b.cdrAll = 0;
     // apply each rank
     for (const node of CATALOG) {
       const rank = state.ranks[node.id] || 0;
       if (rank <= 0) continue;
       const delta = rank * node.perRank.value;
       if (node.perRank.kind === 'mult') {
         b[node.perRank.field] = 1 + delta;
       } else {
         b[node.perRank.field] = delta;
       }
     }
   }
   ```

4. Call `_applyRanksToBuffs()` once at the end of module init (after persistence load, but the load happens in T004).

**Files**:
- `js/knowledgeTree.js` (~40 LOC for this subtask)

**Validation**:
- After module load: `window.knowledgeTreeBuffs.damageMult === 1.0` (neutral).
- Manually set `state.ranks.node_damage = 3` and call `_applyRanksToBuffs()` in DevTools — `window.knowledgeTreeBuffs.damageMult === 1.15`.
- Identity check: `b1 = window.knowledgeTreeBuffs; _applyRanksToBuffs(); b1 === window.knowledgeTreeBuffs` (true).

**Edge cases**:
- Don't `Object.freeze` the buff map — it is mutated by us.
- Negative rank (shouldn't happen but defensive): `rank <= 0` guard skips.

---

## Subtask T004: localStorage persistence

**Purpose**: Persist state to `localStorage` key `demonfall.knowledgeTree.v1` and load it on module init. Handle version mismatches and out-of-range ranks gracefully.

**Steps**:

1. Add storage primitive references (defaults to `localStorage`, swappable via `_configureForTest`):
   ```js
   const STORAGE_KEY = 'demonfall.knowledgeTree.v1';
   let _storage = (typeof localStorage !== 'undefined') ? localStorage : null;
   let _consoleRef = (typeof console !== 'undefined') ? console : { warn: function(){} };
   ```

2. Implement `_loadFromStorage()`:
   ```js
   function _loadFromStorage() {
     if (!_storage) return;
     let raw;
     try { raw = _storage.getItem(STORAGE_KEY); } catch (e) { _consoleRef.warn('KnowledgeTree: read failed', e); return; }
     if (!raw) return;
     let blob;
     try { blob = JSON.parse(raw); } catch (e) { _consoleRef.warn('KnowledgeTree: parse failed, starting fresh'); return; }
     if (!blob || blob.version !== 1) { _consoleRef.warn('KnowledgeTree: version mismatch, starting fresh'); return; }
     // Restore fragments (non-negative integer)
     state.fragments = Math.max(0, Math.floor(Number(blob.fragments) || 0));
     // Restore ranks with clamp + refund for out-of-range, drop+refund for unknown nodes
     const incoming = blob.ranks || {};
     for (const nodeId in incoming) {
       const desired = Math.max(0, Math.floor(Number(incoming[nodeId]) || 0));
       const node = CATALOG_BY_ID[nodeId];
       if (!node) {
         state.fragments += desired;
         _consoleRef.warn('KnowledgeTree: unknown nodeId in storage, refunded', { nodeId, refund: desired });
         continue;
       }
       const clamped = Math.min(desired, node.maxRank);
       if (clamped < desired) {
         state.fragments += (desired - clamped);
         _consoleRef.warn('KnowledgeTree: rank clamped, refund issued', { nodeId, was: desired, now: clamped });
       }
       state.ranks[nodeId] = clamped;
     }
   }
   ```

3. Implement `_saveToStorage()`:
   ```js
   function _saveToStorage() {
     if (!_storage) return;
     try {
       const blob = { version: 1, fragments: state.fragments, ranks: Object.assign({}, state.ranks) };
       _storage.setItem(STORAGE_KEY, JSON.stringify(blob));
     } catch (e) {
       _consoleRef.warn('KnowledgeTree: write failed', e);
     }
   }
   ```

4. Call `_loadFromStorage()` once during init, **before** `_applyRanksToBuffs()`.

**Files**:
- `js/knowledgeTree.js` (~60 LOC for this subtask)

**Validation**:
- Open game, run `KnowledgeTree.addFragments(5); KnowledgeTree.invest('node_damage')` (after T005), then reload. After reload: `KnowledgeTree.getFragments()` → 4, `KnowledgeTree.getRank('node_damage')` → 1.
- Manually corrupt the blob: `localStorage.setItem('demonfall.knowledgeTree.v1', '{"version":99}')` and reload. Single warning, state defaults to fresh.
- Forward-compat (NFR-02): set ranks above maxRank manually in localStorage, reload, observe clamp + refund warning.

**Edge cases**:
- `localStorage` throws on private browsing or quota-full — `_saveToStorage` swallows and warns; in-memory state still consistent.
- Corrupt JSON — warn + fresh start.
- Missing `ranks` object — treated as `{}` (all zeros).
- Negative fragments in blob — clamped to 0 by `Math.max(0, ...)`.

---

## Subtask T005: Public API

**Purpose**: Expose `KnowledgeTree.getFragments`, `getRank`, `getMaxRank`, `getCatalog`, `getState`, `addFragments`, `invest`, `respec` per the contract.

**Steps**:

1. Implement read methods:
   ```js
   function getFragments() { return state.fragments; }
   function getRank(nodeId) { return (state.ranks[nodeId] || 0); }
   function getMaxRank(nodeId) {
     const node = CATALOG_BY_ID[nodeId];
     return node ? node.maxRank : null;
   }
   function getCatalog() {
     // defensive copy — caller may not mutate internal array
     return CATALOG.map(function (n) {
       return { id: n.id, labelKey: n.labelKey, descKey: n.descKey, maxRank: n.maxRank, perRank: Object.assign({}, n.perRank) };
     });
   }
   function getState() {
     return { fragments: state.fragments, ranks: Object.assign({}, state.ranks) };
   }
   ```

2. Implement write methods:
   ```js
   function addFragments(n) {
     if (n === 0) return;
     if (n < 0) { _consoleRef.warn('KnowledgeTree.addFragments: negative count rejected', n); return; }
     state.fragments += Math.floor(n);
     _saveToStorage();
     _notifySubscribers();  // T006
   }

   function invest(nodeId) {
     const node = CATALOG_BY_ID[nodeId];
     if (!node) return false;
     const currentRank = state.ranks[nodeId] || 0;
     if (state.fragments < 1) return false;
     if (currentRank >= node.maxRank) return false;
     state.fragments -= 1;
     state.ranks[nodeId] = currentRank + 1;
     _applyRanksToBuffs();
     _saveToStorage();
     if (typeof window.recalcDerived === 'function') {
       try { window.recalcDerived(0, 0); } catch (e) { _consoleRef.warn('KnowledgeTree.invest: recalcDerived threw', e); }
     }
     _notifySubscribers();
     return true;
   }

   function respec() {
     let refund = 0;
     for (const nodeId in state.ranks) refund += (state.ranks[nodeId] || 0);
     state.fragments += refund;
     for (const node of CATALOG) state.ranks[node.id] = 0;
     _applyRanksToBuffs();
     _saveToStorage();
     if (typeof window.recalcDerived === 'function') {
       try { window.recalcDerived(0, 0); } catch (e) { _consoleRef.warn('KnowledgeTree.respec: recalcDerived threw', e); }
     }
     _notifySubscribers();
   }
   ```

3. Attach to `window.KnowledgeTree` at the end of the IIFE — accumulate fields so T006 can add `onChange` and `_configureForTest` next:
   ```js
   window.KnowledgeTree = {
     getFragments: getFragments,
     getRank: getRank,
     getMaxRank: getMaxRank,
     getCatalog: getCatalog,
     getState: getState,
     addFragments: addFragments,
     invest: invest,
     respec: respec
     // onChange, _configureForTest added in T006
   };
   ```

**Files**:
- `js/knowledgeTree.js` (~80 LOC)

**Validation** (DevTools, after T007 wires the script):
- `KnowledgeTree.addFragments(3); KnowledgeTree.getFragments()` → 3
- `KnowledgeTree.invest('node_damage'); KnowledgeTree.getFragments()` → 2, `KnowledgeTree.getRank('node_damage')` → 1
- `KnowledgeTree.invest('node_damage')` 4 more times → 5th invest returns `false` (cap)
- `KnowledgeTree.respec(); KnowledgeTree.getFragments()` → 7 (refunded all 5)
- `KnowledgeTree.invest('node_nonexistent')` → `false` (no throw)
- `KnowledgeTree.addFragments(-2)` → warning + no change

**Edge cases**:
- `invest` on a node with rank already at max → returns false, no state mutation.
- `invest` with `fragments === 0` → returns false, no state mutation.
- `recalcDerived` throws → warning logged, but state changes still committed (saved + subscribers fired).
- `respec` with all ranks zero → no-op state-wise but still fires subscribers (callers may want to re-render).

---

## Subtask T006: Subscribers + `_configureForTest`

**Purpose**: Allow UI code (WP04) and tests (WP02) to listen for state changes. Provide a dependency-injection seam for tests.

**Steps**:

1. Subscriber set:
   ```js
   const _subscribers = new Set();
   function onChange(cb) {
     if (typeof cb !== 'function') return function () {};
     _subscribers.add(cb);
     return function unsubscribe() { _subscribers.delete(cb); };
   }
   function _notifySubscribers() {
     const snapshot = getState();
     _subscribers.forEach(function (cb) {
       try { cb(snapshot); } catch (e) { _consoleRef.warn('KnowledgeTree: subscriber threw, others continue', e); }
     });
   }
   ```

2. Test seam:
   ```js
   function _configureForTest(primitives) {
     primitives = primitives || {};
     if (primitives.storage) _storage = primitives.storage;
     if (primitives.console) _consoleRef = primitives.console;
     // recalcDerived is read from window at call time, no swap needed
     // Reset state so the test starts clean
     state = { fragments: 0, ranks: {} };
     for (const node of CATALOG) state.ranks[node.id] = 0;
     _subscribers.clear();
     _loadFromStorage();
     _applyRanksToBuffs();
   }
   ```

3. Add to the public surface:
   ```js
   window.KnowledgeTree.onChange = onChange;
   window.KnowledgeTree._configureForTest = _configureForTest;
   ```

**Files**:
- `js/knowledgeTree.js` (~40 LOC)

**Validation**:
- `let calls = 0; const off = KnowledgeTree.onChange(s => calls++); KnowledgeTree.addFragments(1); console.log(calls)` → 1
- `off(); KnowledgeTree.addFragments(1); console.log(calls)` → still 1 (unsubscribed)
- Throwing subscriber: `KnowledgeTree.onChange(() => { throw new Error('x'); }); KnowledgeTree.onChange(() => calls++); KnowledgeTree.addFragments(1)` — second subscriber still fires; warning in console.

**Edge cases**:
- Subscriber callback adds another subscriber during iteration — `Set.forEach` snapshots iteration safely, but the newly-added cb fires on the **next** notify call.
- Re-entrant `addFragments` from a subscriber — allowed but may surprise; document as caller responsibility, not module concern.

---

## Subtask T007: Wire `<script>` tag in `index.html`

**Purpose**: Ensure the module is loaded in the correct order — after `i18n.js` (so registration works), before `HubSceneV2.js` (so the UI can call into it). The order between knowledgeTree.js and inventory.js doesn't matter (recalc reads the buff map lazily).

**Steps**:

1. Open `index.html`. Find the existing block of `<script src="js/...">` tags.

2. Locate the `<script src="js/i18n.js">` line. The new line goes **after** it.

3. Locate the `<script src="js/scenes/HubSceneV2.js">` line. The new line must come **before** it.

4. Recommended position: right after `js/printingHouse.js` (similar IIFE-on-window pattern, similar lifecycle).

5. Add:
   ```html
   <script src="js/knowledgeTree.js"></script>
   ```

**Files**:
- `index.html` (1 line added)

**Validation**:
- Open the game. DevTools console — no syntax errors.
- `typeof window.KnowledgeTree === 'object'`.
- `typeof window.knowledgeTreeBuffs === 'object'`.
- `window.knowledgeTreeBuffs.damageMult === 1.0`.

**Edge cases**:
- If `index.html` has a `defer` strategy (it does not currently — classic-script convention), the order is the document order.
- The new tag must be plain `<script src="...">` — do not add `type="module"` (would break the classic-script contract).

---

## Definition of Done (WP01)

All of:
- [ ] `js/knowledgeTree.js` exists with all 6 internal sections (i18n, catalog, state, persistence, API, subscribers + test seam)
- [ ] All 54 i18n keys registered in DE + EN
- [ ] `<script src="js/knowledgeTree.js">` in `index.html` between i18n.js and HubSceneV2.js
- [ ] In DevTools: `KnowledgeTree.addFragments(3); KnowledgeTree.invest('node_damage'); KnowledgeTree.getState()` returns `{ fragments: 2, ranks: { node_damage: 1, ...8 zeros } }`
- [ ] Reload: state persists. `KnowledgeTree.getFragments()` → 2.
- [ ] `KnowledgeTree.respec()` refunds all ranks back to fragments.
- [ ] No console errors during page load or any API call.
- [ ] `window.knowledgeTreeBuffs` exists and updates after `invest`.

## Risks

- **Classic-script scope falle** (auto-memory): keep all `let`-bindings inside the IIFE. The only `window`-attached objects are `window.KnowledgeTree` and `window.knowledgeTreeBuffs`.
- **i18n collision**: namespace `knowledge.*` — verify with `grep -rn "knowledge\\." js/` that the existing code doesn't already use this prefix. If `hub.knowledge.learn` is added in WP04 it goes under `hub.*`, not `knowledge.*` — different namespace.
- **localStorage quota**: the blob is ~200 bytes; quota is not a real concern but the catch-and-warn keeps the in-memory state correct if it ever happens.

## Reviewer guidance

Before approving:
1. Open DevTools, run the validation sequence above — all assertions pass.
2. Read the catalog table and verify it matches `data-model.md` table exactly (10 entries, correct fields).
3. Verify `window.knowledgeTreeBuffs` object identity is stable: `let b = window.knowledgeTreeBuffs; KnowledgeTree.invest('node_damage'); b === window.knowledgeTreeBuffs` → true.
4. Verify no extra globals leak — only `window.KnowledgeTree` and `window.knowledgeTreeBuffs` should be new.

## Next WP

After this WP merges, WP02, WP03, WP04 can start in parallel — all three downstream WPs are siblings rooted in this foundation.

## Implementation command

```bash
spec-kitty implement WP01
```
