# Tasks: Knowledge Tree (MVP)

**Feature**: 047-knowledge-tree-mvp
**Generated**: 2026-05-13
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`

This document is the implementation roadmap. Each work package is independently implementable and has its own detailed prompt file at `tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | `knowledgeTree.js` Module Foundation | 7 (T001–T007) | ~470 | none | — |
| WP02 | Unit Tests for KnowledgeTree API | 4 (T008–T011) | ~290 | WP01 | with WP03, WP04 |
| WP03 | Stat-Pipeline Integration | 5 (T012–T016) | ~370 | WP01 | with WP02, WP04 |
| WP04 | HubSceneV2 Modal UI | 7 (T017–T023) | ~510 | WP01 | with WP02, WP03 |

**Total**: 23 subtasks across 4 WPs. Subtask range 4–7, prompt range 290–510 lines — all within the ideal target.

**MVP scope recommendation**: WP01 → then WP02 + WP03 + WP04 in parallel. Each parallel WP needs WP01's module loaded and the i18n keys registered, but does not interact with siblings.

---

## Phase 1 — Foundation

### WP01: `knowledgeTree.js` Module Foundation

**Goal**: Create the single `js/knowledgeTree.js` IIFE module that holds catalog, state, persistence, buff-recompute, public API, subscribers, and the i18n registration. Wire it into `index.html`.

**Priority**: P0 (foundation for all other WPs).

**Independent test**: Open the game in a browser, run in DevTools:
```js
KnowledgeTree.addFragments(3);
KnowledgeTree.invest('node_damage');
console.log(KnowledgeTree.getState());
// → { fragments: 2, ranks: { node_damage: 1, ...others 0 } }
KnowledgeTree.respec();
console.log(KnowledgeTree.getFragments());  // → 3
```
Reload the page — fragments and ranks must persist.

**Included subtasks**:
- [x] **T001** Create `js/knowledgeTree.js` IIFE skeleton + register all 54 i18n keys (DE/EN: 7 chrome keys × 2 + 10 nodes × 2 keys × 2 langs)
- [x] **T002** Define the static catalog (10 nodes with stable IDs, maxRank, perRank fields)
- [x] **T003** Implement state storage + `_applyRanksToBuffs()` that mutates `window.knowledgeTreeBuffs`
- [x] **T004** Implement localStorage persistence (`demonfall.knowledgeTree.v1` schema, version validation, clamp+refund on bad ranks)
- [x] **T005** Implement public API (`getFragments`/`getRank`/`getMaxRank`/`getCatalog`/`getState`/`addFragments`/`invest`/`respec`)
- [x] **T006** Implement subscribers (`onChange` + unsubscribe + throwing-subscriber isolation) + `_configureForTest` seam
- [x] **T007** Add `<script src="js/knowledgeTree.js"></script>` in `index.html` after `js/i18n.js` and before `js/scenes/HubSceneV2.js`

**Owned files**: `js/knowledgeTree.js`, `index.html`

**Risks**:
- The classic-script scope falle (memory: `classic_script_scope`) — IIFE must hang state on `window`, never on a top-level `let`.
- i18n key collisions if `knowledge.*` namespace is already used elsewhere (verify with grep before writing).

**Requirement refs**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-10, FR-11, NFR-02

**Implementation command**: `spec-kitty implement WP01`

---

## Phase 2 — Parallelizable Work (after WP01 lands)

### WP02: Unit Tests for KnowledgeTree API

**Goal**: Cover the entire KnowledgeTree IIFE surface with Node-side unit tests using the existing `tools/runTests.js` runner. This satisfies SC-05 (full earn → invest → respec test loop) and the constitution's TEST_FIRST directive for risky stat-pipeline logic.

**Priority**: P1.

**Independent test**: Run `node tools/runTests.js` — baseline of 188 tests grows to include the new ones, all green.

**Included subtasks**:
- [x] **T008** Set up `tests/knowledgeTree.test.js` with a fake `storage` implementation and `_configureForTest` wiring; verify clean default state at module init
- [x] **T009** Tests for the core API: `addFragments` (positive, zero, negative), `invest` (success, no fragments, cap reached, unknown node), `respec` (refund + reset)
- [x] **T010** Tests for persistence: round-trip save/load, version mismatch handling, clamp-rank-and-refund, drop-unknown-node-and-refund
- [x] **T011** Tests for subscribers: notify on state change, unsubscribe stops notifications, a throwing subscriber does NOT prevent others from firing (NFR-04)

**Owned files**: `tests/knowledgeTree.test.js`

**Dependencies**: WP01

**Risks**:
- The existing test runner is Node-side; `window` and `localStorage` may need stubs. Check `tools/runTests.js` for the pattern used by `tests/printingHouse.test.js` (similar module shape).
- A throwing subscriber test must not let the throw escape the test runner.

**Requirement refs**: SC-01, SC-02, SC-03, SC-05, SC-06, NFR-02, NFR-04

**Implementation command**: `spec-kitty implement WP02 --base WP01`

---

### WP03: Stat-Pipeline Integration

**Goal**: Wire `window.knowledgeTreeBuffs` into every stat-read site so investing into a node produces a measurable in-game effect. Also wire the lore-fragment overlap callback to call `addFragments(1)`.

**Priority**: P0 (without this, the tree's "Invest" button does nothing visible).

**Independent test**: With the module loaded, set `window.knowledgeTreeBuffs.damageMult = 1.5` in DevTools, call `recalcDerived(0, 0)`, and verify the HUD weapon-damage value increases. Then walk over a lore fragment and verify `KnowledgeTree.getFragments()` increments.

**Included subtasks**:
- [x] **T012** `js/inventory.js`: add §3.9 buff layer in `recalcDerived()` that reads `damageMult`/`armorAdd`/`speedMult`/`maxHpAdd` from `window.knowledgeTreeBuffs` and applies them after §3.8 (printingBuffs). Add `maxHpAdd` into `newMaxHealth` before clamp.
- [x] **T013** `js/main.js`: apply `critAdd` to `playerCritChance` initialization (line ~806) and wrap `addXP` to multiply incoming amount by `xpMult`
- [x] **T014** `js/player.js`: extend `getLootAbilityCooldownReduction` to add `knowledgeTreeBuffs.cdrAll` to the total cooldown reduction fraction
- [x] **T015** `js/lootSystem.js`: multiply gold drop value by `goldMult`, scale rare/legendary tier weights by `magicFindMult`, add `pickupAddRange` to the pickup overlap radius
- [x] **T016** `js/eventSystem.js`: add `window.KnowledgeTree?.addFragments(1)` call in the lore-fragment overlap callback at line ~1132 (after `activeLore.picked = true;`, before `showLoreDialog`)

**Owned files**: `js/inventory.js`, `js/main.js`, `js/player.js`, `js/lootSystem.js`, `js/eventSystem.js`

**Dependencies**: WP01

**Risks**:
- Performance (NFR-01): the new buff layer adds ~6 mults/adds per `recalcDerived` call — must stay under 0.5 ms.
- Magic Find: scaling tier weights wrong can break loot drops entirely. Verify by sampling 100 drops before and after.
- Classic-script scope: do not write `window.weaponDamage = ...`. Mutate the script-scoped binding via the existing `recalcDerived` flow.

**Requirement refs**: FR-04 (invest triggers recalc), FR-08 (lore-fragment emits addFragments)

**Implementation command**: `spec-kitty implement WP03 --base WP01`

---

### WP04: HubSceneV2 Modal UI

**Goal**: Replace the existing `_showSkillTreeUI` modal at Mara with a new `_showKnowledgeTreeUI` modal that renders the 10 nodes, fragment count, invest buttons, respec, and close. The K-key and Mara dialog button now invoke this modal instead of the old skill tree.

**Priority**: P0 (without this, the player cannot reach the tree).

**Independent test**: Walk to Mara, press the dialog button that was "Skills lernen" (now "Wissen"). Modal opens. Click a node's `+` button. Fragment count decreases, rank text updates. Close with ESC. Re-open. State persists.

**Included subtasks**:
- [x] **T017** Replace the body of `_showSkillTreeUI` in `js/scenes/HubSceneV2.js` (line ~1829) with `_showKnowledgeTreeUI`: same modal shell (overlay rectangle + container + header + body + footer). Keep depth 2000/2001, same panel size (920×460).
- [x] **T018** Render a 2-column × 5-row grid of node cards. Each card shows: label (DE/EN), description (with per-rank effect interpolated), current `rank/maxRank`, an Invest `+` button (enabled when `fragments >= 1 && rank < maxRank`), and a disabled state with hint when conditions fail.
- [x] **T019** Wire each Invest button's `pointerdown` → `KnowledgeTree.invest(nodeId)`. Subscribe to `KnowledgeTree.onChange(cb)` on modal open; cb refreshes fragment-counter text and re-evaluates every card's button state.
- [x] **T020** Add a Respec button in the footer that opens a confirmation dialog (reuse the existing two-button confirmation pattern from `HubSceneV2`). On confirm, call `KnowledgeTree.respec()`. On cancel, close confirmation only.
- [x] **T021** Rename the i18n key from `hub.skills.learn` to `hub.knowledge.learn` (DE: "Wissen lernen", EN: "Knowledge Tree"). Re-route the K-key handler (line ~1195) and the Mara dialog button (line ~1081) to call `_showKnowledgeTreeUI` instead of `_showSkillTreeUI`.
- [x] **T022** Cleanup on close: ESC + Close button both unsubscribe the `onChange` listener, destroy the container, and clear `this._dialogOpen` so a second open works. No input lock leaks (FR-12).
- [x] **T023** Manual playtest end-to-end (per `quickstart.md` §3): earn 1 fragment in dungeon → return to hub → invest in damage → notice HUD change → respec → verify refund. Capture browser console — zero errors (SC-06).

**Owned files**: `js/scenes/HubSceneV2.js`

**Dependencies**: WP01

**Risks**:
- The old `_showSkillTreeUI` is still referenced in `HubScene.js` (the legacy non-V2 hub scene) at lines 1043/1096/1391. Verify which scene is active in current builds — if `HubScene` is dead code, leave it alone; if it's still wired, leave its skill tree intact (it's a different scene from V2).
- The Mara button is sized via `maraBtnHeight = 90` (HubSceneV2.js:1011) which assumes the Skills + Shop buttons. Recheck layout after the rename so the dialog frame still fits.
- Subscriber leak: forgetting to unsubscribe `onChange` when the modal closes causes the next modal-open to register duplicate callbacks. Use a `let unsubscribe = ...; onClose: unsubscribe()`.
- The existing "(K)" keyboard hint in the button label needs to stay accurate.

**Requirement refs**: FR-04 (button triggers invest+recalc), FR-05 (respec UI), FR-09 (UI reachable from Mara), FR-12 (clean close), NFR-03 (60 fps), SC-04, SC-06

**Implementation command**: `spec-kitty implement WP04 --base WP01`

---

## Dependency graph

```
            ┌──────┐
            │ WP01 │ knowledgeTree.js + i18n + index.html
            └───┬──┘
                │
       ┌────────┼─────────┐
       │        │         │
       ▼        ▼         ▼
   ┌──────┐ ┌──────┐ ┌──────┐
   │ WP02 │ │ WP03 │ │ WP04 │ (parallel after WP01)
   │tests │ │stats │ │ UI   │
   └──────┘ └──────┘ └──────┘
```

WP02 / WP03 / WP04 can run concurrently after WP01 lands. They touch disjoint files (WP02: `tests/`; WP03: `js/inventory.js` + `js/main.js` + `js/player.js` + `js/lootSystem.js` + `js/eventSystem.js`; WP04: `js/scenes/HubSceneV2.js`).

## Parallel opportunities

- WP02, WP03, WP04 can run in three separate worktrees, each `spec-kitty implement WPxx --base WP01`. No file conflicts; merge in any order.

## Risks (rolled up)

- **Classic-script scope falle** (auto-memory): never write `window.weaponDamage = ...` style assignments for stat changes — let `recalcDerived` mutate the script-local binding via the existing pattern. WP03 is the most exposed.
- **Performance budget** (NFR-01): new §3.9 buff layer must stay under +0.5 ms per recalc call. Profile before merging WP03.
- **Subscriber leaks** (NFR-04): WP04 must unsubscribe on modal close; WP02 covers the test for non-blocking errors.
- **Persistence collisions** (C-02): unique key `demonfall.knowledgeTree.v1` — verify no other module uses this key before merging WP01.
- **i18n key collisions**: namespace `knowledge.*` must not collide with `hub.knowledge.*` (used for hub navigation? — verify in WP01 T001).

## Definition of done (feature-level)

All of:
- [x] WP01, WP02, WP03, WP04 merged into `main`
- [x] `node tools/runTests.js` green, baseline + new tests pass
- [x] Manual playtest: earn → invest → respec → re-invest cycle completes with zero console errors (SC-06)
- [x] All visible strings present in DE and EN (SC-04)
- [x] `recalcDerived` profile shows ≤ +0.5 ms cost (NFR-01)

## Branch strategy

Per `plan.md` and constitution §"Spec Kitty Governance": all planning + implementation happens on `main`. No feature branch. Each WP is implemented in its own worktree (`spec-kitty implement WPxx`) and merged back to `main` when complete. The `--base WP01` flag on WP02-04 ensures their worktrees start from WP01's commit.

## Next command

`spec-kitty implement WP01` — start with the foundation module.
