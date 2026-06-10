# Implementation Plan: Knowledge Tree (MVP)

**Branch**: `main` (planning + merge on main, per Branch Strategy in constitution.md §"Spec Kitty Governance" — "No review required. Merge when playtest passes and no console errors.")
**Date**: 2026-05-13
**Spec**: `kitty-specs/047-knowledge-tree-mvp/spec.md`
**Input**: Feature specification from `kitty-specs/047-knowledge-tree-mvp/spec.md`

## Summary

Turn the existing lore-fragment event drops into a persistent currency and expose a 10-node passive-stat tree at Mara. The new tree **replaces** Mara's current "Skills lernen" (K) dialog: the `_showSkillTreeUI` modal in `HubSceneV2` and the K-key binding both pivot to opening the Knowledge Tree instead. Already-learned active skills remain usable in dungeon runs (the `skillSystem.js` runtime is untouched) — only the **acquisition** of new active skills exits MVP and returns in Phase 2.

The tree exposes 10 nodes drawing from existing stat hooks: 4 plug-and-play (damage, armor, speed, max HP), 1 reuses the existing loot-affix cooldown pipeline (`getLootAbilityCooldownReduction`), and 5 require minimal new buff fields in `recalcDerived()` (crit, XP, gold, pickup radius, magic find). One fragment buys one rank; no per-rank cost scaling; full free respec via a button inside the tree modal. Persistence lives in its own localStorage key. Implementation follows the IIFE-on-`window` pattern from `printingHouse.js` / `tutorialSystem.js`.

## Technical Context

**Language/Version**: JavaScript ES6+ (classic `<script>` tags, no module system, no build pipeline)
**Primary Dependencies**: Phaser 3 (game engine), `window.i18n` (localization), `window.eventBuffs` pattern (stat-bonus contributor registry), `window.SaveSystem`/`localStorage` (persistence)
**Storage**: `localStorage` key `demonfall.knowledgeTree.v1` — JSON blob `{ version: 1, fragments: int, ranks: { [nodeId]: int } }`
**Testing**: `node tools/runTests.js` (existing unit-test runner — Node-side tests that load game JS in a JSDOM-ish stub). New tests live in `tests/knowledgeTree.test.js`. Manual playtest via `npx serve` per constitution §Testing.
**Target Platform**: Desktop browsers (Edge, Chrome, Firefox), mobile via existing touch controls. Static deploy at https://baechtoldleroy.github.io/Fogreach/.
**Project Type**: single (browser game, no client/server split)
**Performance Goals**: 60 fps while modal is open; `recalcDerived()` cost increase ≤ 0.5 ms per call (NFR-01).
**Constraints**: No DOM overlay (Phaser modal Container only — C-06); IIFE-on-`window` pattern (C-01); separate localStorage key (C-02); reuse existing `eventBuffs`-style contributor pattern (C-03); no ability unlocks in MVP (C-04); no node prerequisites / branches (C-05); `_configureForTest` test seam (C-07); lore-fragment snippet text preserved (C-08).
**Scale/Scope**: 10 nodes, ~36-42 fragment-investments to max all ranks, single `js/knowledgeTree.js` module (~250 LOC est.), ~100 LOC of edits across `HubSceneV2.js` (modal UI), `inventory.js` (recalcDerived buff layer), `eventSystem.js` (fragment increment), `player.js` (cooldown integration), `main.js` (crit add).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution paradigms in effect: `clean-code`, `minimal-tooling`, `modular-scenes`. Directive: `TEST_FIRST` (from constitution context bootstrap).

| Gate | Verdict | Notes |
|---|---|---|
| **CLEAN_CODE** — no premature abstraction, comment intent not mechanics | ✅ PASS | One IIFE module, one persistence key, no abstract base classes. Catalog is a literal const array. |
| **MINIMAL_TOOLING** — no build pipeline, classic scripts | ✅ PASS | New file is a plain `<script>` tag. No bundler, transpiler, or framework. |
| **MODULAR_SCENES** — keep Phaser scenes modular | ✅ PASS | Modal lives **inside** `HubSceneV2` (per user decision); does not couple to a sister scene. The KnowledgeTree module exposes a pure-data API and is scene-agnostic. |
| **TEST_FIRST** — risky logic verified before commit | ⚠️ ADAPTED | Constitution §Testing says "No formal test suite. Manual playtesting is primary. For risky logic changes (combat, AI state machines, collision), verify manually before committing." The KnowledgeTree adds **stat-pipeline logic** which is risky-adjacent. Plan: Node-side unit tests for the IIFE API (add/invest/respec/persistence/cap/wallet — SC-05) using the existing `tools/runTests.js` runner; manual playtest for the UI + integration. This satisfies both directives without requiring a heavier test framework. |
| **Performance** — 60 fps + recalc ≤ +0.5 ms (NFR-01, NFR-03) | ✅ PASS | New buff layer adds ~6 multiplications/additions per recalc; well under budget. Modal is static Phaser objects, no per-frame work beyond input. |
| **Forward compat** — persisted v1 blob loadable in v2 (NFR-02) | ✅ PASS | Schema-versioned blob; loader treats unknown nodeIds as drop+refund, missing nodes as rank 0. |

**Gate result: PASS** (with TEST_FIRST adapted per constitution §Testing — documented). Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
kitty-specs/047-knowledge-tree-mvp/
├── plan.md              # This file (/spec-kitty.plan output)
├── spec.md              # Feature specification (already authored)
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
├── contracts/           # Phase 1 output — JS API contracts
│   └── knowledgeTree.contract.md
└── tasks.md             # Phase 2 output — NOT created here (/spec-kitty.tasks)
```

### Source Code (repository root)

```
js/
├── knowledgeTree.js                # NEW — IIFE module: catalog, state, persistence, API
├── inventory.js                    # EDIT — add §3.9 knowledgeTreeBuffs layer in recalcDerived
├── eventSystem.js                  # EDIT — lore-fragment handler also calls KnowledgeTree.addFragments(1)
├── player.js                       # EDIT — extend getLootAbilityCooldownReduction to include knowledgeTreeBuffs.cdrAll
├── main.js                         # EDIT — apply knowledgeTreeBuffs.critAdd to playerCritChance during recalc
└── scenes/
    └── HubSceneV2.js               # EDIT — replace _showSkillTreeUI body with _showKnowledgeTreeUI; same K-key + Mara-button entry points

tests/
└── knowledgeTree.test.js           # NEW — Node-side unit tests for IIFE API + persistence + cap/wallet edges

index.html                          # EDIT — add <script src="js/knowledgeTree.js"></script> in correct load order (before HubSceneV2.js)
```

**Structure Decision**: Single-project Phaser-3 layout (constitution §Stack). New module is a peer of existing IIFE modules (`printingHouse.js`, `tutorialSystem.js`, `factionSystem.js`). UI lives inside `HubSceneV2` as a modal Container — same pattern as the skill tree it replaces. No new scene, no new asset files, no build-config changes.

## Complexity Tracking

*Filled only if Constitution Check has violations needing justification.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (none) | — | — |

No constitution gates were violated. The TEST_FIRST adaptation (Node-side unit tests for the API + manual playtest for UI) is the constitution's stated approach for risky logic, not a violation.

## Phase Outputs (this command)

- ✅ `plan.md` — this file
- → `research.md` — see Phase 0 below
- → `data-model.md` — see Phase 1 below
- → `contracts/knowledgeTree.contract.md` — see Phase 1 below
- → `quickstart.md` — see Phase 1 below

## STOP

This command ends after Phase 1 (planning artifacts). It does NOT generate `tasks.md` or work packages. The user invokes `/spec-kitty.tasks` next.
