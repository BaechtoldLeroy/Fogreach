# Specification: Knowledge Tree (MVP)

**Feature**: 047-knowledge-tree-mvp
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #26 (Phase 1 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

The game already drops lore-fragment events (`js/eventSystem.js:30+`) but they are one-shot text snippets with no progression payoff. The Constitution names "knowledge tree: invest lore fragments for passive bonuses and new abilities" as a permanent-progression pillar. This MVP turns lore fragments into a persistent currency and exposes a small tree screen with 8–10 nodes that grant passive bonuses by reusing existing stat hooks (HP cap, XP gain, gold find, crit chance, etc.). One fragment buys one point. A respec option via Mara closes the loop. Ability unlocks are explicitly out of scope and live in a Phase 2 follow-up.

## 2. Stakeholders & Actors

- **Player** — picks up lore fragments, opens the tree, invests, sees stat changes.
- **Lore-fragment events** (existing) — increment the fragment counter on pickup.
- **Stat-bonus pipeline** (existing in `js/main.js` / `recalcDerived`) — receives knowledge-tree contributions during stat recalc.
- **Mara** — existing NPC; gains a "Respec" option on her dialog or shop.

## 3. User Scenarios

### Primary Scenario: Earn → Invest → Feel

1. The player completes a dungeon run that triggered three lore-fragment events.
2. `KnowledgeTree.addFragments(3)` is called by the lore-event handler on each pickup.
3. Back in the hub, the player opens the Knowledge Tree (via NPC dialog or hub entrance — see FR-09).
4. The tree screen lists 8–10 nodes; each node shows label, current rank, max rank, fragment cost, and short flavor.
5. The player invests 3 fragments into "+5 % Crit Chance per rank" (one-fragment-one-rank), spending all 3.
6. `recalcDerived()` runs; the player's effective crit chance increases by 15 %.
7. The next dungeon run reflects the bonus; persistence survives reload.

### Alternate Scenario: Respec

1. The player visits Mara and selects "Wissen zurücksetzen" (Respec).
2. A confirmation dialog appears.
3. On confirm, all invested points return to the fragment counter; ranks reset to 0; `recalcDerived()` runs.
4. No gold cost in MVP (cost tuning is post-MVP).

### Alternate Scenario: Cap reached

1. The player tries to invest a fragment into a node already at its max rank.
2. The button is disabled / a brief toast says "Maximaler Rang erreicht".
3. Fragment count is unchanged.

### Alternate Scenario: Empty wallet

1. The player has 0 fragments and opens the tree.
2. All invest buttons are disabled with a hint "Keine Fragmente".
3. The screen still renders; current ranks are visible.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | The system MUST track an integer **fragment count** that increases by 1 per lore-fragment pickup event.                       | Draft  |
| FR-02 | The system MUST persist fragment count plus per-node invested ranks under a dedicated localStorage key.                       | Draft  |
| FR-03 | The system MUST expose `getFragments()`, `addFragments(n)`, `getRank(nodeId)`, `invest(nodeId)`, `respec()`, `onChange(cb)`.   | Draft  |
| FR-04 | `invest(nodeId)` MUST require fragments ≥ 1 AND `getRank(nodeId) < node.maxRank`; on success, decrement fragments by 1, increment rank by 1, persist, notify subscribers, and trigger `recalcDerived()`. | Draft  |
| FR-05 | `respec()` MUST refund all invested points back into the fragment count, reset all ranks to 0, persist, notify, and trigger `recalcDerived()`. | Draft  |
| FR-06 | The catalog MUST contain at least 8 and at most 10 nodes drawn exclusively from existing stat hooks (HP cap, XP gain, gold find, crit chance, +damage %, +defense %, +pickup radius, +potion charge — exact list in plan phase). | Draft  |
| FR-07 | Each node MUST have a max rank (recommended 3–5) and a per-rank value applied during `recalcDerived()`.                        | Draft  |
| FR-08 | Lore-fragment pickup events MUST emit `KnowledgeTree.addFragments(1)` instead of (or in addition to) showing the existing snippet text. | Draft  |
| FR-09 | The Knowledge Tree screen MUST be reachable from the hub via either Mara's dialog ("Wissen") or a dedicated hub interaction; choice deferred to plan phase. | Draft  |
| FR-10 | All visible strings MUST be localized via the existing `i18n` module with German primary and English secondary translations.   | Draft  |
| FR-11 | The system MUST default to `0` fragments and `0` ranks for any node missing in the persisted blob (forward-compatible).        | Draft  |
| FR-12 | The screen MUST close cleanly via ESC and via a Close button; no input lock leaks.                                             | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                                          | Threshold / Metric                                  | Status |
|--------|--------------------------------------------------------------------------------------|------------------------------------------------------|--------|
| NFR-01 | `recalcDerived()` cost MUST not increase by more than 0.5 ms per call.                | Profiled in DevTools; verified via stopwatch in test. | Draft  |
| NFR-02 | Persisted blob MUST be forward-compatible across one major version.                    | Loading a v1 blob in a future version MUST not throw. | Draft  |
| NFR-03 | The tree screen MUST sustain 60 fps while open.                                        | Verified manually.                                   | Draft  |
| NFR-04 | A subscriber that throws MUST NOT prevent other subscribers from firing.               | Verified by unit test (mirror existing pattern).     | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Implementation MUST follow the codebase IIFE-on-`window` pattern.                                                        | Draft  |
| C-02  | Persistence MUST use a dedicated localStorage key (separate from save, settings, tutorial, faction, edicts).             | Draft  |
| C-03  | Implementation MUST reuse the existing stat-hook machinery (`recalcDerived` / `window.eventBuffs` pattern); MUST NOT introduce a new stat pipeline. | Draft  |
| C-04  | Implementation MUST NOT add ability unlocks (Phase 2+).                                                                  | Draft  |
| C-05  | Implementation MUST NOT introduce a node prerequisite / branch system in MVP — all nodes are independently investable.    | Draft  |
| C-06  | The Tree screen MUST render via Phaser scene (or modal Container); MUST NOT introduce a separate DOM overlay.             | Draft  |
| C-07  | The module MUST expose a `_configureForTest(primitives)` test seam matching the existing pattern.                         | Draft  |
| C-08  | Lore-fragment events MUST keep their existing flavor text (the snippet is not removed); the fragment increment is additive. | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | After picking up N lore fragments, `getFragments()` returns N and the value persists across reload.                                              |
| SC-02 | Investing into a node decrements fragments by 1, increments rank by 1, and the corresponding stat changes in the player's effective stats.      |
| SC-03 | Respec returns all invested points to the fragment counter and resets all ranks to 0.                                                           |
| SC-04 | The tree screen renders all 8–10 nodes correctly in both German and English; switching language mid-screen updates labels within one frame.       |
| SC-05 | A unit test suite covers add / invest / respec / onChange / cap-reached / empty-wallet / persistence-load / version-mismatch.                    |
| SC-06 | Zero console errors during a full earn → invest → respec → re-invest cycle.                                                                     |

## 8. Edge Cases

- **Lore-fragment event fires twice in the same frame** → both calls increment the counter; subscribers fire twice.
- **`invest` called concurrently from two click handlers** (rare; both quickly) → fragments decrement once per call; cap check protects against over-invest.
- **Persisted rank > maxRank** (catalog change between versions) → clamp to current maxRank on load; refund the difference back to fragments.
- **Persisted node id not in current catalog** → drop silently with a single warning; refund the spent fragments.
- **Player closes tree screen mid-invest** → state is consistent (each `invest` is atomic).
- **`addFragments(0)` or negative** → `addFragments(0)` no-ops; negatives are rejected with a single warning.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Fragment count    | Non-negative integer; the "currency" earned from lore events.                                  |
| Node id           | String constant per node (e.g. `node_hp_cap`, `node_crit_chance`).                             |
| Node definition   | `{ id, labelKey, descKey, maxRank, perRank: { stat, value } }`. The `stat` is a key already understood by `recalcDerived`. |
| Persisted blob    | `{ version: 1, fragments: int, ranks: { [nodeId]: int } }`.                                   |
| Tree screen       | Phaser scene/Container that renders the catalog with current state.                            |

## 10. Assumptions

- The existing event-system lore-fragment handler can be hooked at one site; the snippet display path stays.
- `recalcDerived()` exposes a way to incorporate per-stat additive bonuses (the `window.eventBuffs` pattern from auto-memory works).
- Mara's dialog supports adding a new top-level choice ("Respec") without breaking existing flows.
- The hub has space for either a new entrance OR Mara is the entry point (decided in plan phase).

## 11. Out of Scope

- Ability unlocks — Phase 2+.
- Multi-tier tree with prerequisites / branches — mid-game content.
- Visual skill-tree polish (animated lines, hover effects beyond basic hover).
- Tree-gating by story progress — Phase 2+.
- Fragment cost scaling per rank — Phase 2+ (MVP is flat 1 fragment = 1 rank).

## 12. Dependencies

- Existing systems: `js/eventSystem.js` (lore-fragment event handler), `recalcDerived()` + `window.eventBuffs` stat pipeline, HubSceneV2 dialog (Mara entry point), `i18n`, `localStorage`.
- Loosely related: #29 Tutorial added a new pattern for IIFE-on-`window` + persisted state — KnowledgeTree mirrors it.

## 13. Risks

- **R-01**: `recalcDerived` may not currently support an external bonus contributor cleanly. Mitigation: register a `window.knowledgeTreeBuffs` map in the same shape as `window.eventBuffs` and read both during recalc; document the new convention.
- **R-02**: 8–10 nodes may feel too sparse to players. Mitigation: each rank is meaningful (e.g. +5 %), and Phase 2 expands the catalog without breaking persisted state.
- **R-03**: Choosing Mara vs. a dedicated entrance may collide with existing Schwarzmarkt UX. Mitigation: defer to plan phase; either is acceptable from the spec POV.

## 14. References

- Issue #26 — Knowledge Tree
- Issue #32 — Vertical Slice Epic
- `reference/constitution.md` (knowledge tree as permanent-progression pillar)
- `js/eventSystem.js` (lore-fragment handler — current entry point)
- `js/main.js` `recalcDerived()` and `window.eventBuffs` (auto-memory: scope rules; use `window.eventBuffs`-style contributor pattern)
- `js/inputScheme.js`, `js/tutorialSystem.js` — IIFE + `_configureForTest` reference patterns
