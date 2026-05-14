# Tasks: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Generated**: 2026-05-14
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`

This document is the implementation roadmap. Each work package is independently implementable and has its own detailed prompt file at `tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | factionSystem 3→5 Refactor + Migration | 6 (T001–T006) | ~250 | none | — |
| WP02 | Act-1 Quest Catalog + Hub NPCs + Legacy Cleanup | 8 (T007–T014) | ~450 | WP01 | — |
| WP03 | Q6 Climax Scene + Q2/Q4 Side-Dialogue Hooks | 5 (T015–T019) | ~200 | WP02 | — |

**Total**: 19 subtasks across 3 WPs. Sequential — WP02 depends on the 5-standing API from WP01; WP03 depends on the quest IDs from WP02. Parallelism would invite cross-cutting merge conflicts in `questSystem.js` + `HubSceneV2.js`, so we serialize cleanly.

**MVP scope recommendation**: WP01 → WP02 → WP03. Each WP lands a meaningful slice. After WP01: factionSystem ready. After WP02: quests playable end-to-end except Q6 has placeholder dialogue. After WP03: full Act-1 demo loop.

---

## Phase 1 — Engine Foundation

### WP01: factionSystem 3→5 Refactor + Migration

**Goal**: Expand `js/factionSystem.js` from 3 standings (council / resistance / independent) to 5 (magistrat / klerus / garde / widerstand / independent). Add `getCouncilComposite()` helper. Migrate all `'council'` / `'resistance'` callsites across the codebase. Per user direction: no save migration — fresh standings for everyone.

**Priority**: P0 (every other WP needs the new API).

**Independent test**: `node tools/runTests.js` — baseline tests still green; new tests cover 5-standing init + composite + post-refactor callsites.

**Included subtasks**:
- [ ] **T001** Extend `FACTION_IDS` array in `js/factionSystem.js:15` to `['magistrat', 'klerus', 'garde', 'widerstand', 'independent']`. Update `_freshState()` `standings` shape accordingly.
- [ ] **T002** Implement `getCouncilComposite()` returning `Math.max(getStanding('magistrat'), getStanding('klerus'), getStanding('garde'))`. Export via the `window.FactionSystem` API surface.
- [ ] **T003** Update i18n: rename existing `faction.aldric.greet.*` keys to stay (Aldric IS the Magistrat face). Register new keys for Klerus / Garde / Elara greeting tiers (4 levels × 3 NPCs = 12 new keys × 2 langs = 24 strings). Add `faction.<id>.label` keys for the 5 factions (10 strings).
- [ ] **T004** Codebase-wide rename `getStanding('resistance')` → `getStanding('widerstand')`. Touchpoints: `js/questSystem.js:181-182` (gate predicate); `js/printingHouse.js:338` + `:367` (edict effect reads).
- [ ] **T005** Audit + migrate any `getStanding('council')` call to `getCouncilComposite()` (grep first, list call sites in the WP commit). Likely 0–2 callsites based on the existing 045 MVP shape.
- [ ] **T006** Extend `tests/factionSystem.test.js`: 5-standing init at 0, independent adjust per faction, `getCouncilComposite()` returns max-of-3, legacy keys `'council'`/`'resistance'` return 0 + warn-once.

**Owned files**: `js/factionSystem.js`, `js/questSystem.js` (just the gate predicate rename), `js/printingHouse.js` (2 line changes), `tests/factionSystem.test.js`.

**Risks**:
- **Hidden `'council'` / `'resistance'` callsites**: the audit step (T005) must be exhaustive — grep `js/` for both string literals in faction context. Missing one breaks Aldric greetings silently.
- **i18n key collisions** with existing `faction.aldric.greet.*`: namespace check before adding `faction.klerus.greet.*` etc. — existing key inventory in `js/i18n.js` should be grepped.

**Requirement refs**: FR-14, FR-15, NFR-04

**Implementation command**: `spec-kitty implement WP01 --feature 050-act-1-quest-chain`

---

## Phase 2 — Content

### WP02: Act-1 Quest Catalog + Hub NPCs + Legacy Cleanup

**Goal**: Author the 6 new quest definitions (Q1–Q6) in `js/questSystem.js`, delete the 3 legacy Akt-1 quests + patch 2 prerequisite chains, add Klerus + Garde NPCs to `hubLayout.js`, and wire all reward-factionStanding deltas. After this WP, the chain is playable end-to-end with stub Q6 dialogue (final climax scene polished in WP03).

**Priority**: P0 (the content this whole feature exists for).

**Independent test**: Open the game, start fresh save, follow `quickstart.md` Steps 1–6 — confirm all quests reachable + completable + faction-standing deltas apply correctly. Q6 will show a placeholder "TBD reveal scene" until WP03.

**Included subtasks**:
- [ ] **T007** Add the 6 new quest definitions to `QUEST_DEFINITIONS` in `js/questSystem.js`: `harren_daughter_investigation`, `magistrat_verification`, `klerus_purification`, `garde_patrol_expansion`, `widerstand_proof`, `council_collusion_reveal`. Use the YAML schemas in `data-model.md` §"Domain 1" as source of truth. Q6 dialogue is a 1-page placeholder ("TBD — implemented in WP03").
- [ ] **T008** Extend `completeQuest` (`js/questSystem.js:821`) to apply `rewards.factionStanding` via `window.FactionSystem.adjustStanding(factionId, delta)`. Backward-compatible (existing quests without this field still work).
- [ ] **T009** Extend `completeQuest` to grant `rewards.fragments` via `window.KnowledgeTree.addFragments(n)` (Q1/Q5/Q6 use this). Existing fragment grant via lore-fragment event-spawn is unchanged; this is a parallel reward path.
- [ ] **T010** Delete the 3 legacy Akt-1 quests from `QUEST_DEFINITIONS`: `aldric_intruders`, `harren_daughter`, `branka_armor`. Patch the 2 dangling prerequisites: `branka_doubt.prerequisites: ['branka_armor'] → []`, `harren_rescue.prerequisites: ['harren_daughter'] → ['harren_daughter_investigation']`.
- [ ] **T011** Add `klerus_priester` and `stadtwache` entries to `hubLayout.js`'s `npcs[]` array. Use existing sprites if loadable (`priester`, `stadtwache`) — if missing, fall back to a placeholder sprite and log the audit finding. Hub coords: Klerus at (480, 360), Garde at (580, 380). 3 atmospheric dialogue lines each (from `data-model.md` §"Domain 3").
- [ ] **T012** Register DE + EN i18n strings for the 6 new quests' dialogues. Most are auto-registered via the questSystem i18n bootstrap (`js/questSystem.js:357`) — verify after T007 that `i18n.t('quest.harren_daughter_investigation.dialogue_offer')` etc. resolve correctly in both languages.
- [ ] **T013** Wire `storySystem.advanceToAct(2)` into Q6 completion (per FR-08). Audit `storySystem.js` for the existing API surface; reuse the existing act-advancement mechanism rather than reinventing.
- [ ] **T014** Extend `tests/questSystem.test.js`: verify the 3 legacy quests are gone, the 6 new ones exist with correct shape, prerequisites graph is acyclic, `branka_doubt` and `harren_rescue` have patched prerequisites.

**Owned files**: `js/questSystem.js`, `js/scenes/hub/hubLayout.js`, `js/storySystem.js` (minor — just verifying the advance-to-act API call), `js/i18n.js` (string registration), `tests/questSystem.test.js`.

**Dependencies**: WP01 (uses `adjustStanding(factionId, delta)` for new faction IDs).

**Risks**:
- **Sprite audit (T011)**: `priester` and `stadtwache` may not exist as hub-scale sprites. Fallback: temporary placeholder. Document in commit message; schedule proper sprite acquisition for #34 polish.
- **i18n registration order**: the questSystem bootstrap fires at module init. If `i18n.register()` isn't ready, strings fall through to keys. Verify the bootstrap order matches the 045 MVP pattern.
- **Reward-path drift (T008/T009)**: `completeQuest` already handles XP / materials / items / druckblaetter / info / unlocks. Adding two more reward paths (factionStanding + fragments) keeps the dispatcher growing — but at 8 fields it's still trivially readable.
- **Legacy save loading**: a save with `aldric_intruders` in active list should silently drop the unknown ID. Verify `loadQuestSaveData` does this; if not, add a defensive filter (NOT a migration, just a runtime drop).

**Requirement refs**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-08, FR-09, FR-10, FR-11, FR-13, NFR-03

**Implementation command**: `spec-kitty implement WP02 --feature 050-act-1-quest-chain --base WP01`

---

## Phase 3 — UI / Polish

### WP03: Q6 Climax Scene + Q2/Q4 Side-Dialogue Hooks

**Goal**: Build the Q6 multi-page reveal scene in HubSceneV2 (new `_showCollusionReveal` helper) and the Q2/Q4 side-dialogue triggers on Branka + Thom. After this WP, the full Act-1 demo loop hits its political-thesis payoff.

**Priority**: P1 (chain is playable without it, but emotionally flat).

**Independent test**: Complete `quickstart.md` Steps 7–8 end-to-end. Q6 modal shows 4 pages with the reveal scene + binary flavor choice; Q2 + Q4 trigger Branka/Thom side-dialogue at the right moment.

**Included subtasks**:
- [ ] **T015** Implement `_showCollusionReveal()` in `HubSceneV2.js` as a 4-page wrapper around `_showDialoguePages`: (1) Harren narration ("Komm mit..."), (2) reveal scene + silhouettes (text only, optional visual layering of priester+stadtwache+aldric sprites), (3) binary flavor choice ("Umdrehen" / "Erinnern"), (4) wrap-up + lore-fragment grant. Hook into Q6 completion handler.
- [ ] **T016** Apply `_ktPropagateScrollFactor` to the Q6 modal container (mobile-safe per [[project_phaser_scrollfactor_dialogs]]). Verify on mobile-viewport sim in DevTools that the close button + choice buttons are tappable.
- [ ] **T017** Subscribe to `questSystem.onQuestUpdate` in HubSceneV2.create(): when `magistrat_verification` activates, set `this._pendingSideDialogue = { npcId: 'branka', dialogueKey: 'sidedialog.branka.q2_eyebrow' }`. Mirror for `garde_patrol_expansion` → Thom. Clear flag after firing.
- [ ] **T018** Trigger the side-dialogue in the NPC-interaction handler: when the player approaches Branka or Thom and the matching `_pendingSideDialogue` is set, show a one-page non-blocking dialogue using `_showDialoguePages` with no choices. Side-dialogue uses i18n keys registered in T012.
- [ ] **T019** Manual playtest per `quickstart.md` end-to-end. Capture wall-clock time, console hygiene, and pacing — flag any quest that collapsed to "click-click-done" for post-merge tuning per plan §R-09.

**Owned files**: `js/scenes/HubSceneV2.js` (new helper + side-dialogue plumbing), `js/i18n.js` (2 side-dialogue keys × 2 langs = 4 strings).

**Dependencies**: WP02 (uses the quest IDs + onQuestUpdate event from the activated chain).

**Risks**:
- **Q6 visual layering**: rendering three sprite "silhouettes" on a single modal page may not look right without additional asset work. Fallback: pure text description ("Eine Stimme aus der Versammlung..."). Document the visual decision in the WP commit.
- **Side-dialogue timing (T017/T018)**: if the player accepts Q2 then immediately walks past Branka, the side-dialogue should fire on the NEXT approach, not immediately. Verify the proximity-trigger logic gates on actual interaction-zone overlap, not just quest-activation.
- **Q6 flavor choice persistence**: the binary "Umdrehen / Erinnern" choice doesn't branch content, but the player's choice should be recordable (for potential Acts-2-5 use). Stash in `window.storySystem` via a generic `recordChoice('act1_finale', value)` API — or skip if storySystem lacks that surface.
- **scrollFactor regression**: if T016 is forgotten, mobile players can't dismiss the Q6 modal. NON-NEGOTIABLE.

**Requirement refs**: FR-07, FR-08, FR-12b, NFR-02

**Implementation command**: `spec-kitty implement WP03 --feature 050-act-1-quest-chain --base WP02`

---

## Dependency graph

```
              ┌──────┐
              │ WP01 │ factionSystem 3→5 + tests
              └───┬──┘
                  │
              ┌───▼──┐
              │ WP02 │ 6 quests + Klerus/Garde NPCs + legacy cleanup
              └───┬──┘
                  │
              ┌───▼──┐
              │ WP03 │ Q6 climax + Q2/Q4 side-dialogue
              └──────┘
```

Sequential. Each WP touches `questSystem.js` or `HubSceneV2.js`; parallelizing would force conflict-resolution merges that aren't worth the throughput gain at this size.

## Parallel opportunities

None within 050. **Cross-feature parallel work** possible while WP02 is in flight: a designer can hand-author the dialogue text for Q1–Q6 (per FR-12) without touching code — feed back as a markdown table for T007 to paste into the quest definitions. Not modeled here as a separate WP, but the option exists.

## Risks (rolled up)

- **factionSystem callsite audit** (T005) — exhaustive grep required, missing one breaks Aldric greetings silently. WP01-level risk.
- **Sprite availability** for Klerus + Garde NPCs (T011) — fallback to placeholder sprite + later acquisition.
- **i18n bootstrap order** (T012) — verify auto-registration fires before first NPC dialogue.
- **scrollFactor falle on Q6 modal** (T016) — must apply `_ktPropagateScrollFactor` or mobile-tappability breaks (project-memory-documented gotcha).
- **Pacing tuning post-merge** (T019) — measure first, tune second. Plan §R-09 has the knobs.

## Definition of Done (feature-level)

All of:
- [ ] WP01, WP02, WP03 merged into `main`.
- [ ] `node tools/runTests.js` green, baseline + new tests pass.
- [ ] Fresh-save playthrough completes Q1–Q6 with all 5 faction standings at 1 and `storySystem.getCurrentAct() === 2` at the end.
- [ ] All visible strings present in DE and EN (verified via runtime language toggle).
- [ ] Branka + Thom side-dialogues fire for Q2 + Q4 respectively.
- [ ] Console clean across the full playthrough — zero errors, zero warnings.
- [ ] Wall-clock playtest: 1.5–2.5 h.

## Branch strategy

Per `plan.md` and constitution §"Spec Kitty Governance": planning + implementation on `main`. Each WP gets its own worktree via `spec-kitty implement WPxx --feature 050-act-1-quest-chain` (and `--base WPxx-1` for WPs after the first to inherit prior commits). Merge back to `main` when each WP's manual playtest passes.

## Next command

`spec-kitty implement WP01 --feature 050-act-1-quest-chain` — start with the factionSystem refactor foundation.
