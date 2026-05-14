---
work_package_id: WP02
title: Act-1 Quest Catalog + Hub NPCs + Legacy Cleanup
dependencies:
- WP01
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-08
- FR-09
- FR-10
- FR-11
- FR-12
- FR-13
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: e899982428a5041cf5c36b4d56ded41e975a03bf
created_at: '2026-05-14T17:00:00Z'
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
- T013
- T014
phase: Phase 2 — Content
assignee: ''
agent: claude
history:
- timestamp: '2026-05-14T17:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks-packages
authoritative_surface: js/questSystem.js
execution_mode: code_change
lane: planned
owned_files:
- js/questSystem.js
- js/scenes/hub/hubLayout.js
- js/storySystem.js
- js/i18n.js
- tests/questSystem.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP02 — Act-1 Quest Catalog + Hub NPCs + Legacy Cleanup

## Objective

Author the 6 new Act-1 quest definitions (Q1–Q6), wire the new `rewards.factionStanding` + `rewards.fragments` reward fields, delete the 3 legacy Akt-1 quests + patch the 2 dangling prerequisites, add Klerus + Garde NPCs to the hub layout, and register all DE+EN i18n strings. After this WP, the chain is playable end-to-end with stub Q6 dialogue (the proper Q6 climax scene ships in WP03).

## Context

- **Spec**: `kitty-specs/050-act-1-quest-chain/spec.md` (FR-01 through FR-13, NFR-03)
- **Plan**: `kitty-specs/050-act-1-quest-chain/plan.md` §Project Structure
- **Research**: `kitty-specs/050-act-1-quest-chain/research.md` §R-01, R-03, R-07
- **Data model**: `kitty-specs/050-act-1-quest-chain/data-model.md` §"Domain 1" (full quest YAML), §"Domain 3" (NPC entries)
- **Existing patterns**: `js/questSystem.js` (existing 18-quest catalog + completeQuest), `js/scenes/hub/hubLayout.js` (existing 5-NPC roster)
- **Side note**: Q6 dialogue in this WP is a 1-page placeholder ("TBD reveal scene — implemented in WP03"). The reward grants (fragments, advanceToAct) DO fire in this WP — only the visual climax is deferred.

## Subtasks

### T007 — Add 6 new quest definitions to QUEST_DEFINITIONS

Use the YAML schemas in `data-model.md` §"Domain 1" as the source of truth. Convert each to a JS object literal in `js/questSystem.js` `QUEST_DEFINITIONS`. The 6 IDs:
- `harren_daughter_investigation`
- `magistrat_verification`
- `klerus_purification`
- `garde_patrol_expansion`
- `widerstand_proof`
- `council_collusion_reveal`

For each, include all standard fields (id, title, description, npcId, type, chain, objectives, rewards, prerequisites, requiredAct, dialogueOffer, dialogueProgress, dialogueComplete). Use rich political-flavor dialogue per FR-11.

Q6's `dialogueOffer` for this WP: a single-page stub `'Komm mit. Du musst etwas sehen. (Climax-Scene wird in WP03 final implementiert.)'`. WP03 replaces this with the full 4-page reveal.

### T008 — Extend `completeQuest` to apply `rewards.factionStanding`

In `js/questSystem.js:821` `completeQuest`, after the existing reward grants (xp / materials / items / druckblaetter / info / unlocks), add:

```js
if (quest.rewards && quest.rewards.factionStanding && window.FactionSystem) {
  Object.entries(quest.rewards.factionStanding).forEach(function (entry) {
    var factionId = entry[0], delta = entry[1];
    if (typeof window.FactionSystem.adjustStanding === 'function') {
      window.FactionSystem.adjustStanding(factionId, delta);
    }
  });
}
```

The standing-change toast is already handled by the FactionSystem's `_notify` subscribers (existing wiring from 045).

### T009 — Extend `completeQuest` to apply `rewards.fragments`

In the same handler, also add:

```js
if (quest.rewards && quest.rewards.fragments && window.KnowledgeTree
    && typeof window.KnowledgeTree.addFragments === 'function') {
  window.KnowledgeTree.addFragments(quest.rewards.fragments);
}
```

Q1, Q5, and Q6 use this for the lore-currency grant (C-05).

### T010 — Delete legacy Akt-1 quests + patch prerequisites + rename `'resistance'` gate

Delete these entries from `QUEST_DEFINITIONS` in `js/questSystem.js`:
- `aldric_intruders` (Akt 1, generic kill-20, conflicts with new Q2)
- `harren_daughter` (Akt 1, conflicts with new Q1)
- `branka_armor` (Akt 1, blocks no narrative)

Patch 2 dangling prerequisites:
- `branka_doubt`: `prerequisites: ['branka_armor']` → `prerequisites: []`
- `harren_rescue`: `prerequisites: ['harren_daughter']` → `prerequisites: ['harren_daughter_investigation']`

Rename the `'resistance'` gate predicate (delegated here from WP01 to avoid file-ownership overlap):
- `js/questSystem.js:181-182`: `window.FactionSystem.getStanding('resistance') >= 25` → `... .getStanding('widerstand') >= 25`.

Keep `aldric_cleanup`, `aldric_patrol`, `resistance_fetch_01` quest IDs (the quest is still called `resistance_fetch_01`, only its standing-read changes) and all 11 Akts-2–6 skeletons untouched.

No save migration: `loadQuestSaveData` already silently drops unknown IDs (verify in T014 test).

### T011 — Add Klerus + Garde NPCs to hubLayout.js

Append to the `npcs` array in `js/scenes/hub/hubLayout.js` (after `thom` entry around line 115):

```js
{
  id: 'klerus_priester',
  name: 'Hochpriester der Ordnung',
  x: 480, y: 360,
  texture: 'priester',
  scale: 0.36,
  lines: [
    'Die Ordnung des Kettenrats ist heilig. Wer sie befragt, befragt das Licht selbst.',
    'Ketzerei beginnt mit der falschen Frage. Halte deine Lippen rein.',
    'Wenn die Tochter geflohen ist, war es nicht aus eigenem Willen. Eine dunkle Hand führt sie.'
  ]
},
{
  id: 'stadtwache',
  name: 'Wachtmeister der Garde',
  x: 580, y: 380,
  texture: 'stadtwache',
  scale: 0.34,
  lines: [
    'Die Patrouillen wachsen jeden Monat. So muss es sein — die Stadt ist unruhig.',
    'Loyalität ist die einzige Münze, die zwischen den Strassen Bestand hat. Frag nicht warum.',
    'Wenn der Magistrat ruft, antwortet die Garde. Wenn der Klerus segnet, marschiert die Garde. So funktioniert es.'
  ]
}
```

**Sprite audit**: before merging, verify `priester` and `stadtwache` textures load via `tex.exists()` in HubSceneV2's preload. If either fails:
1. Document in commit which sprite(s) failed.
2. Fall back to a known-loadable placeholder texture (e.g. `archivist` or `harren` re-skin) for now.
3. Add a TODO comment in hubLayout.js + create a follow-up issue tagged `#34 polish` for proper sprite acquisition.

### T012 — Register DE + EN i18n strings for new quests + side-dialogue stubs

Most quest strings auto-register via the questSystem i18n bootstrap at `js/questSystem.js:357` — which reads `QUEST_DEFINITIONS[id].dialogueOffer` etc. and registers them under `quest.<id>.dialogue_offer` keys.

Verify after T007:
1. `window.i18n.t('quest.harren_daughter_investigation.dialogue_offer')` resolves in both DE + EN.
2. Same check for the other 5 new quests.
3. Klerus/Stadtwache NPC names go through `name:` in hubLayout — no separate i18n keys needed (they render as the literal string for now; #34 polish can add proper i18n later).

If any auto-registered keys are missing in EN, add them manually to `js/i18n.js`'s EN translation table.

**Pre-register the side-dialogue keys** (consumed by WP03 — register them here since WP02 owns `js/i18n.js`):

DE strings:
- `sidedialog.branka.q2_eyebrow`: `'Branka hebt eine Augenbraue, als sie das Magistrats-Siegel sieht. »Wieder eines dieser Verifikations-Siegel. Weisst du eigentlich, was am Ende auf diesen Dokumenten steht?«'`
- `sidedialog.thom.q4_eyebrow`: `'Thom blickt kurz auf, dann zurück zur Presse. »Patrouillen-Erweiterung. Der Edikt klingt vernünftig. Frag mal jemanden im Pavillon, was »vernünftig« diesen Monat bedeutet.«'`

EN mirrors:
- `sidedialog.branka.q2_eyebrow`: `'Branka raises an eyebrow when she sees the Magistrat seal. "Another verification seal. Do you actually know what ends up written on these documents?"'`
- `sidedialog.thom.q4_eyebrow`: `'Thom glances up, then back at the press. "Patrol expansion. The edict sounds reasonable. Go ask someone at the gazebo what \'reasonable\' has meant this month."'`

### T013 — Wire `storySystem.advanceToAct(2)` on Q6 completion

Audit `js/storySystem.js` for the existing act-advancement API. Likely named `advanceToAct(n)` or `setCurrentAct(n)` — confirm via grep.

In `completeQuest` (`js/questSystem.js`), after the reward grants, add:

```js
if (quest.id === 'council_collusion_reveal' && window.storySystem
    && typeof window.storySystem.advanceToAct === 'function') {
  window.storySystem.advanceToAct(2);
}
```

(Or whatever the actual API surface turns out to be.)

This unlocks the 12 Akts-2–6 skeleton quests via their `requiredAct: 2+` predicates — the player can now interact with them in subsequent runs, which feeds #31 epic.

### T014 — Extend `tests/questSystem.test.js`

Add tests:

1. The 3 deleted IDs (`aldric_intruders`, `harren_daughter`, `branka_armor`) are NOT in `QUEST_DEFINITIONS`.
2. The 6 new IDs ARE in `QUEST_DEFINITIONS` with full required fields.
3. `branka_doubt.prerequisites === []`.
4. `harren_rescue.prerequisites === ['harren_daughter_investigation']`.
5. Prerequisite graph is acyclic and every referenced ID resolves to a defined quest.
6. Loading save state `{ activeQuests: ['aldric_intruders'] }` via `loadQuestSaveData` produces no errors and logs a single warning.
7. After accepting + completing `harren_daughter_investigation`, calling `getAvailableQuests('aldric')` returns the new Q2 (`magistrat_verification`) for an Akt-1 player.
8. Reward dispatcher correctness: a quest with `rewards.factionStanding: { magistrat: 1 }` increments `getStanding('magistrat')` by 1 on completion.
9. Reward dispatcher correctness: a quest with `rewards.fragments: 1` calls `KnowledgeTree.addFragments(1)` on completion.

## Owned files

- `js/questSystem.js` — quest catalog edits, completeQuest extensions
- `js/scenes/hub/hubLayout.js` — Klerus + Garde NPC entries
- `js/storySystem.js` — verify `advanceToAct` API, hook from Q6 completion
- `js/i18n.js` — manual EN strings if auto-registration misses any
- `tests/questSystem.test.js` — extended coverage

## Risks

- **Sprite audit (T011)**: if `priester` / `stadtwache` aren't hub-scale-loadable, fallback chain documented above. Most likely outcome based on prior 045/046 NPC additions — sprites exist somewhere in the project, but may need a hub-specific scale variant.
- **`storySystem.advanceToAct` API surface unknown (T013)**: grep before coding. If the API is `setCurrentAct` or similar, use that. If no public API exists, expose one in storySystem.js as part of this WP (small change).
- **Auto-registered i18n key naming**: confirm the existing bootstrap normalizes `dialogueOffer` → `dialogue_offer` (snake_case) or keeps camelCase. Test path: load game with `i18n.setLanguage('en')` and check console.
- **Quest-state pollution**: a player mid-`aldric_intruders` who hits this update loses that quest progress silently. Acceptable per user direction (no migration).
- **Reward double-grant**: if T008 + T009 run inside a try/catch that the existing completeQuest doesn't have, an exception in adjustStanding could skip the fragments grant. Wrap each new reward path in its own try/catch with a console.warn.

## Independent test

After merge:
1. `node tools/runTests.js` — extended `questSystem.test.js` green; baseline still passes.
2. Fresh-save playthrough per `quickstart.md` Steps 1–6 + 8 (Steps 7+ ship with WP03):
   - Tutorial → hub → talk to Harren → Q1 offered.
   - Complete Q1 → all 4 (Aldric/Klerus/Garde/Elara) now offer Q2/Q3/Q4/Q5.
   - Complete all 4 in any order — toasts fire, standings increment.
   - Talk to Harren — Q6 placeholder dialogue runs ("TBD reveal scene"), Q6 completes, `act2_hook` fragment granted.
   - DevTools: `window.FactionSystem.getCouncilComposite()` returns 1; all 5 standings at 1; `window.storySystem.getCurrentAct()` returns 2.
3. Console clean across the playthrough.

## Implementation command

```bash
spec-kitty implement WP02 --feature 050-act-1-quest-chain --base WP01
```
