# Phase 0 Research: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Date**: 2026-05-14
**Status**: Complete

## R-01 — How does the current quest system handle multi-NPC parallel availability?

**Decision**: Use the existing `getAvailableQuests(npcId)` flow with `prerequisites: ['harren_daughter_investigation']` on all four Council/Widerstand Q2–Q5 entries. They become independently available simultaneously after Q1.

**Rationale**:
- `js/questSystem.js:612` `getAvailableQuests` returns the FIRST eligible quest for the given NPC where prerequisites + requiredAct + gate predicate all pass.
- Multiple quests with the same `requiredAct` and overlapping prerequisites can coexist — each NPC's own `npcId` field scopes them.
- `js/scenes/HubSceneV2.js:803` already iterates `qs.getAvailableQuests(npcId)` per NPC, so all 4 NPCs (Aldric / Klerus / Garde / Elara) will independently show Quest-2..5 once Q1 is complete.
- No new dispatch logic needed — drop the 4 quest definitions into `QUEST_DEFINITIONS` with matching `prerequisites: ['harren_daughter_investigation']` and the existing engine wires them up.

**Alternatives considered**:
- A new `quest_chain` table that says "after Q1, unlock {Q2, Q3, Q4, Q5}" — rejected. The existing prerequisites field already encodes this DAG.
- A `prerequisitesAny` / `prerequisitesAll` distinction — rejected. Not needed; all 4 share the same single prerequisite.

## R-02 — How does Q6's "all four prerequisites complete" gate work?

**Decision**: Use `prerequisites: ['magistrat_verification', 'klerus_purification', 'garde_patrol_expansion', 'widerstand_proof']` — a 4-entry array. The existing `getQuestField(quest, 'prerequisites')` already supports multi-entry arrays via `prerequisites.every()`.

**Rationale**:
- `js/questSystem.js:684` checks `prerequisites.every(prereqId => completedQuests.includes(prereqId))`. No change needed.
- Q6 is owned by Harren (`npcId: 'harren'`). When all 4 Q2–Q5 are complete, Harren's `getAvailableQuests('harren')` returns Q6.
- Harren's existing dialogue logic in HubSceneV2 surfaces "Harren has a new task" — same UX pattern as Q1.

**Alternatives considered**:
- Auto-unlock via story-system event — rejected. The existing prerequisite-chain is idiomatic and free.

## R-03 — How is faction-standing applied as a quest reward today?

**Decision**: Use `rewards.factionStanding: { factionId: delta }` as a NEW reward field. Extend `completeQuest` (`js/questSystem.js:821`) to apply each entry via `window.FactionSystem.adjustStanding(factionId, delta)` after the existing XP/materials/items grant.

**Rationale**:
- Today, quest rewards in the existing definitions are XP / materials / druckblaetter (Druckerei) / items / info / unlocks. No faction-standing reward field exists.
- Adding `factionStanding` keeps the data co-located with the quest (single source of truth) and runs through the existing reward-grant code path.
- Per FR-04: each Quest 2–5 grants +1 to its faction; Q1 grants +1 independent; Q6 grants nothing.

**Implementation snippet (planning reference only)**:
```js
// In completeQuest, after existing reward grants:
if (quest.rewards.factionStanding && window.FactionSystem) {
  Object.entries(quest.rewards.factionStanding).forEach(([factionId, delta]) => {
    window.FactionSystem.adjustStanding(factionId, delta);
  });
}
```

**Alternatives considered**:
- Hard-coded in the quest's `dialogueComplete` handler — rejected. Diffuses the reward across the codebase.
- A standing-grant hook on the quest-update bus — rejected. Over-engineered for 5 quests.

## R-04 — factionSystem refactor: how to grow 3 standings to 5 safely?

**Decision**: Extend `FACTION_IDS` to `['magistrat', 'klerus', 'garde', 'widerstand', 'independent']`. Update default state to include all 5. Add `getCouncilComposite()` helper that returns `Math.max(getStanding('magistrat'), getStanding('klerus'), getStanding('garde'))`. Replace existing `'resistance'` references with `'widerstand'` in code; leave save-key as `demonfall_factions_v1` (no version bump — no migration).

**Rationale**:
- The schema-versioned save (`SCHEMA_VERSION = 1`) currently stores `{ council: N, resistance: N, independent: N }`. New schema stores `{ magistrat: N, klerus: N, garde: N, widerstand: N, independent: N }`.
- Per user direction: no save migration. Existing saves load with their old fields ignored as "unknown faction" warnings (already handled by `_warnUnknownOnce`). New standings start at 0 for existing players. Acceptable narrative dissonance.
- `getCouncilComposite()` is the single migration point for callers that currently read `'council'` standing. Replace `getStanding('council')` with `getCouncilComposite()` in:
  - `js/printingHouse.js` (1 call site for Aldric's `aldricRefuses` flag — actually it reads `getRetaliationTier()`, not `getStanding('council')`; only `js/printingHouse.js:338,367` read `getStanding('resistance')` — those rename to `'widerstand'`)
  - `js/scenes/HubSceneV2.js` greeting-tier code path (greps for `'council'` reads — see audit below)
  - `js/questSystem.js:182` gate predicate (`getStanding('resistance') >= 25` → `getStanding('widerstand') >= 25`)
- All `'resistance'` string references are renamed to `'widerstand'` in one sweep. The i18n keys (`faction.aldric.greet.*`) remain Magistrat-specific now.

**Test changes**: `tests/factionSystem.test.js` extended:
1. Default state has all 5 standings at 0.
2. `getStanding('magistrat')`, `getStanding('klerus')`, `getStanding('garde')` work independently.
3. `getCouncilComposite()` returns the max of the 3 council values.
4. `getCouncilComposite()` returns 0 when no council faction has any standing.
5. `getStanding('widerstand')` works (renamed from resistance).
6. `getStanding('council')` returns 0 + warns once (unknown faction).
7. `getStanding('resistance')` returns 0 + warns once (unknown faction).

**Alternatives considered**:
- Keep `'council'` as a derived alias that returns `getCouncilComposite()` — rejected. Two ways to access the same data invites drift. Force callers to choose explicitly.

## R-05 — Klerus + Garde NPC placement in the hub

**Decision**: Add two entries to `hubLayout.js`'s `npcs` array. Reuse existing sprites:
- **Klerus**: sprite key `priester` (exists in RitualChamber template). Hub coords `{ x: 480, y: 360 }` — near the Rathaus entrance, conceptually "the priest who steps out of the Council chambers".
- **Garde**: sprite key `stadtwache` (exists in Catacombs template). Hub coords `{ x: 580, y: 380 }` — near the central plaza, conceptually "the guard who patrols here".

**Rationale**:
- `hubLayout.js:91-115` already declares 5 NPCs via the same shape (id / name / x / y / texture / scale / lines). The pattern is uniform; adding 2 entries is mechanical.
- HubSceneV2.create() iterates `hubLayout.npcs` and constructs interactables for each — no scene code change needed.
- Hub coords picked from a quick scan of `hubLayout.js` decoration positions to avoid overlap with existing NPCs (Aldric, Elara, Mara, Harren, Branka, Thom) and entrances.

**Risk**: Sprite key `priester` and `stadtwache` may not exist as standalone hub-scale images (they live as enemy/decoration sprites in dungeon templates). If they're not loadable, the spec's C-03 fallback applies: off-screen voices (dialogue without a hub-visible NPC). Audit during Phase 1 data-model — if sprite loading fails, switch to a temporary placeholder using `placeholder` or `archivist` sprite for Phase 2 playtest, schedule proper sprite acquisition for #34 polish.

**Alternatives considered**:
- Single new NPC handling both Klerus + Garde dialogue branches — rejected. Two distinct factions need two distinct NPCs for the political-thesis structure to land.
- Off-screen voices for both — rejected. Hub presence is critical for the player to feel "I keep walking past this guy who gives me orders" — that's what makes Q6's reveal land.

## R-06 — Q2/Q4 side-dialogue trigger on Branka + Thom (FR-12b)

**Decision**: Use a quest-state subscription. When Quest 2 becomes `active`, register a one-shot listener that fires when the player approaches Branka's interaction zone — displaying a one-line side-dialogue from Branka. Same pattern for Quest 4 → Thom.

**Rationale**:
- `js/questSystem.js:909` `onQuestUpdate(fn)` already exposes a subscription bus. HubSceneV2 can subscribe at scene-create time, react to `active` transitions for Q2 / Q4.
- The "approach NPC interaction zone" trigger exists for normal NPC dialogue — reuse the same proximity check.
- Side-dialogue uses the same `_showDialoguePages` modal with a single page + no choices, so it's lightweight and non-blocking.

**Implementation snippet (planning reference only)**:
```js
// In HubSceneV2.create() after this._questUpdateHandler is set up:
this._questUpdateHandler = (event) => {
  if (event.type === 'quest_activated') {
    if (event.questId === 'magistrat_verification') {
      this._pendingSideDialogue = { npcId: 'branka', dialogueKey: 'sidedialog.branka.q2_eyebrow' };
    } else if (event.questId === 'garde_patrol_expansion') {
      this._pendingSideDialogue = { npcId: 'thom', dialogueKey: 'sidedialog.thom.q4_eyebrow' };
    }
  }
};
// In the NPC-interaction handler:
if (this._pendingSideDialogue?.npcId === npcId) {
  this._showSideDialogue(this._pendingSideDialogue.dialogueKey);
  this._pendingSideDialogue = null;
}
```

**Alternatives considered**:
- Always-on Branka/Thom commentary (regardless of quest state) — rejected. Less narratively pointed; player might miss the "first crack" timing.
- Pre-emptive comment when Q2/Q4 is *offered* (before accepted) — rejected. Side-dialogue should reward player commitment, not preempt their choice.

## R-07 — Legacy-quest deletion strategy

**Decision**: Hard-delete 3 quest definitions from `QUEST_DEFINITIONS`:
- `aldric_intruders` (Akt 1, generic kill-20 + Ratsschwert reward — Ratsschwert dropped per user direction)
- `harren_daughter` (Akt 1, conflicts with new Q1's `harren_daughter_investigation`)
- `branka_armor` (Akt 1, generic fetch with no narrative payoff)

Patch 2 prerequisite chains:
- `branka_doubt.prerequisites: ['branka_armor']` → `[]`
- `harren_rescue.prerequisites: ['harren_daughter']` → `['harren_daughter_investigation']`

Auto-rename via factionSystem refactor:
- `resistance_fetch_01` gate: `getStanding('resistance')` → `getStanding('widerstand')`

Keep untouched:
- `aldric_cleanup` / `aldric_patrol` (Akt 0, tutorial-warmup)
- `resistance_fetch_01` (Akt 0, faction-gated showcase)
- All 12 Akts-2–5 skeletons (locked behind `requiredAct: 2+`)

**Rationale**: All decisions confirmed with user. No save migration per explicit direction — `loadQuestSaveData` already silently drops unknown IDs (defensive pattern).

**Test changes**: `tests/questSystem.test.js` extended:
1. The 3 deleted quest IDs are no longer in `QUEST_DEFINITIONS`.
2. The 6 new quest IDs ARE in `QUEST_DEFINITIONS` with expected shape (id / npcId / requiredAct / prerequisites / dialogueOffer / etc.).
3. Prerequisite graph is acyclic and all referenced IDs exist.
4. `loadQuestSaveData({ activeQuests: ['aldric_intruders'] })` logs a warning and produces no errors.

## R-08 — Q6 climax scene UX

**Decision**: Q6 is a 4-page dialogue using the existing `_showDialoguePages`:
1. **Page 1** (Harren narration): "Komm mit. Du musst etwas sehen."
2. **Page 2** (Reveal scene narration + visual): camera pans to a Rathaus interior (reuse the RathausArchive template visuals) — three silhouettes converging at a table. Text describes Magistrat + Klerus + Garde members coordinating.
3. **Page 3** (Player choice — binary, flavor only): "Wirst du dich umdrehen — oder dich erinnern?" — choices "Umdrehen" / "Erinnern". Both proceed to page 4; no content branching.
4. **Page 4** (Wrap-up + lore-fragment grant): "Du hast für sie alle gearbeitet. Jetzt weisst du es. Akt 2 beginnt jenseits dieses Hubs." Knowledge-Tree fragment `act2_hook` granted via `KnowledgeTree.addFragments(1)` + storySystem `advanceToAct(2)` call.

**Rationale**: Modal already does multi-page navigation (Space/Enter advances). The "binary choice that doesn't branch content" is unusual but intentional per C-08 and FR-07 — it's a moment of *reflection* for the player, not gameplay choice. Lets the player commit emotionally to a stance without forking the codebase.

**Visual constraint**: No new art. The "three silhouettes" page uses one of the existing Rathaus-themed sprite stand-ins (e.g. `kettenmeister` boss sprite or `priester` + `stadtwache` + `magistrat`-Aldric sprites layered). Phase-1 design — refine in #34 polish.

**Alternatives considered**:
- Cutscene with camera-pan animation — rejected. New mechanic violates C-06.
- Auto-completes on page 4 without player input — rejected. Player needs an active button-press to seal the moment.

## R-09 — Pacing budget per quest

**Decision**: Per spec §"Was mein 6-Quest-Spec konkret liefert" (target ~20 min/quest):
- Q1 (Dungeon-Run depth 1): kill ~15 enemies + fetch journal — ~15 min
- Q2 (Archive Forge crafting): forge 1 sealed document — ~10 min (with Branka side-dialogue padding)
- Q3 (Catacomb run depth 2): kill ~10 elites in lower floor — ~15 min
- Q4 (Printing House edict): publish 1 patrol edict — ~10 min (with Thom side-dialogue padding)
- Q5 (Dungeon run with extraction): kill enemies + fetch document — ~15 min
- Q6 (Dialog scene): 4-page reveal — ~5 min

Total: ~70 min direct quest-time + ~30–50 min hub-travel + inventory + dialogue reading + KT investing = **~1h45–2h15**. Matches #33 target.

**Rationale**: Reuses existing dungeon-depth scaling (no per-quest tuning). Side-dialogues add ~1 min each.

**Risk mitigation hooks (post-playtest tuning)**: If playtest measures < 90 min, bump Q3 + Q5 to depth 3, or add a Catacomb-pre-step to Q4.

## Outstanding clarifications

None. All `NEEDS CLARIFICATION` resolved. Proceed to Phase 1.
