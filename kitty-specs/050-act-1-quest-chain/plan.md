# Implementation Plan: Act 1 Quest Chain

**Branch**: `main` (planning + merge on main, per Branch Strategy in constitution.md §"Spec Kitty Governance")
**Date**: 2026-05-14
**Spec**: `kitty-specs/050-act-1-quest-chain/spec.md`
**Input**: Feature specification from `kitty-specs/050-act-1-quest-chain/spec.md`

## Summary

Implement the 6-quest linear Act 1 chain that turns Phase-1's mechanical scaffolding into a coherent ~1.5–2h narrative arc culminating in the Council-collusion reveal. The work splits cleanly along orthogonal axes — quest data + dialogue (content), factionSystem refactor (engine), Klerus + Garde NPC integration (hub geometry), legacy-quest cleanup (data hygiene), and a Q2/Q4 side-dialogue hook on Branka + Thom (atmosphere).

The political thesis is delivered structurally: the player completes one quest for each of the three Council factions before Q6's reveal lands. No branching, no mutual exclusion, no faction-gating in Act 1.

## Technical Context

**Language/Version**: JavaScript ES6+ (classic `<script>` tags, no module system, no build pipeline)
**Primary Dependencies**: Phaser 3, existing `window.questSystem` / `window.storySystem` / `window.FactionSystem` / `window.KnowledgeTree` IIFEs
**Storage**: `localStorage` — quest state via existing `getQuestSaveData`/`loadQuestSaveData`; faction standings via `demonfall_factions_v1`
**Testing**: `node tools/runTests.js` (existing unit-test runner). New tests: `tests/factionSystem.test.js` extended for 5-standing API; `tests/questSystem.test.js` extended for the 6-quest chain wiring + legacy-quest deletion. Manual playtest via `npx serve` per constitution §Testing.
**Target Platform**: Desktop browsers (Edge, Chrome, Firefox), mobile via existing touch controls. Static deploy at https://baechtoldleroy.github.io/Fogreach/.
**Project Type**: single (browser game, no client/server split)
**Performance Goals**: < 5 ms quest-catalog load (NFR-01); zero new per-frame work — dialogue + faction operations are event-driven.
**Constraints**: No new mechanics (C-06); no new dialogue rendering pipeline (C-02); no new NPC sprites — Klerus + Garde reuse priest + guard sprites (C-03); Widerstand cast (Elara + Branka + Thom) already exists; faction standings flow through `factionSystem.adjustStanding()` (C-04); lore fragments via `KnowledgeTree.addFragments()` (C-05).
**Scale/Scope**: 6 new quest definitions (~300 LOC of quest data + dialogue), factionSystem refactor (~60 LOC), 2 new hub NPCs (Klerus + Garde via `hubLayout.js`), Q6 climax scene (~80 LOC for the multi-page reveal), DE+EN i18n strings for everything. Total est. ~600–800 LOC across 6 files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Doctrine paradigms in effect: `test-first` (per recent constitution sync — `clean-code/minimal-tooling/modular-scenes` are project-level principles in constitution.md body, not formal doctrine paradigms).

| Gate | Verdict | Notes |
|---|---|---|
| **TEST_FIRST** — risky logic verified before commit | ✅ PASS | factionSystem refactor (FR-14) has 28 existing unit tests covering the 3-standing API — must extend to 5 standings + `getCouncilComposite()` BEFORE the refactor. Quest catalog changes are mostly data — unit tests cover quest definitions load + the prerequisite-graph audit for legacy cleanup. |
| **CLEAN_CODE** — no premature abstraction | ✅ PASS | Each quest is a literal entry in `QUEST_DEFINITIONS`; no per-faction abstraction. factionSystem `FACTION_IDS` grows from 3 to 5 entries — no new class hierarchy. |
| **MINIMAL_TOOLING** — no build pipeline, classic scripts | ✅ PASS | Six file edits, no new tooling. |
| **MODULAR_SCENES** — keep Phaser scenes modular | ✅ PASS | Q6 climax scene is a `_showDialoguePages` invocation, not a new Phaser scene. Klerus + Garde live in HubSceneV2 via the same NPC pattern as Aldric / Elara / Branka / Thom. |
| **Performance** — < 5 ms catalog load (NFR-01); 60 fps maintained | ✅ PASS | Quest definitions are static data. factionSystem ops are O(1). No new per-frame work. |
| **Save migration** — no migration required (per user direction) | ✅ PASS | Legacy quest deletion relies on existing `loadQuestSaveData` silently dropping unknown IDs. Verified pattern (defensive coding standard). |

**Gate result: PASS**. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```
kitty-specs/050-act-1-quest-chain/
├── plan.md              # This file (/spec-kitty.plan output)
├── spec.md              # Feature specification (already authored)
├── research.md          # Phase 0 output (this command)
├── data-model.md        # Phase 1 output (this command)
├── quickstart.md        # Phase 1 output (this command)
└── tasks.md             # Phase 2 output — NOT created here (/spec-kitty.tasks)
```

### Source Code (repository root)

```
js/
├── questSystem.js                   # MODIFIED — delete 3 legacy quests, add 6 new ones,
│                                    #            patch 2 prerequisite chains, rename
│                                    #            'resistance' standing-read to 'widerstand'
├── factionSystem.js                 # MODIFIED — FACTION_IDS 3→5 (magistrat/klerus/garde/
│                                    #            widerstand/independent), add
│                                    #            getCouncilComposite(), update i18n keys
├── scenes/
│   ├── HubSceneV2.js                # MODIFIED — Q6 climax scene (new
│   │                                #            _showCollusionReveal helper),
│   │                                #            Q2/Q4 side-dialogue trigger for
│   │                                #            Branka/Thom
│   └── hub/
│       └── hubLayout.js             # MODIFIED — add 2 NPCs (klerus_priester +
│                                    #            stadtwache) to the npcs[] array
├── knowledgeTree.js                 # UNCHANGED — addFragments() consumed by Q1/Q5/Q6
└── i18n.js                          # MODIFIED — register DE + EN strings for new
                                     #            quests, faction labels, NPC names

tests/
├── factionSystem.test.js            # MODIFIED — extend coverage to 5 standings +
│                                    #            getCouncilComposite()
└── questSystem.test.js              # MODIFIED — verify legacy quests gone, 6 new
                                     #            quests load, prerequisite graph valid
```

**Structure Decision**: Single-project layout. 6 file edits, 1 new helper method in HubSceneV2 (`_showCollusionReveal`), 1 new helper method in factionSystem (`getCouncilComposite`). No new files except potentially split test files if they grow too large — likely fine in-place.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations. Section intentionally empty.
