# Specification: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Created**: 2026-05-14
**Mission**: software-dev
**Tracker**: Issue #33 (Phase 2 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Phase 2 of the Vertical Slice strategy. Phase 1 shipped 4 MVP systems (Tutorial #29, Faction #25, Knowledge Tree #26, Printing House #24) — Act 1 now has the **mechanical scaffolding** but no **narrative spine**. Today the player drops into a hub with NPCs that hand out generic kill-N / explore-N objectives. This feature replaces those generic quests with a hand-authored **6-quest linear chain** that takes the player from "Awakening" (constitution §Narrative Arc Act 1) to the Act-2 hook.

**Doctrinal shape (constitution §Setting)**: *"The Chain Council governs as a sham democracy whose factions compete outwardly but serve a unified occult agenda."* The Act-1 chain must MAKE THIS VISIBLE through gameplay. Concretely:

- The player completes one quest for each of three Council-internal factions (Magistrat / Klerus / Garde) — they appear to compete and use contrasting framings, but mechanically they all advance the Council.
- The player completes one quest for the Widerstand, the only outside-the-system faction.
- The Act-1 climax (Quest 6) reveals that the three Council factions coordinate behind closed doors. **The player has already done dirty work for all three** by the time the reveal lands — complicity is the punch, not a chosen alignment.

**Design pivot from earlier draft**: this is a **linear, non-branching** chain. All Council-faction quests are completed in the same playthrough; standing accumulates as a *consequence*, not as a content-gate. Faction-affiliation will become a branching factor in Acts 2–5; Act 1 sells the political thesis by showing every Council faction up-close and then revealing their unity. Pacing target: 1.5–2 h wall-clock.

Reuses `js/questSystem.js`, `js/storySystem.js`, `js/factionSystem.js` (with a small refactor — see FR-13), `js/knowledgeTree.js`, and the existing `_showDialoguePages` modal pattern in `js/scenes/HubSceneV2.js`. No new combat or mechanic systems — this is content, dialogue, faction wiring, and pacing.

## 2. Stakeholders & Actors

### Council-internal factions (publicly competing, secretly aligned)

- **Magistrat** — administrative-bureaucratic arm. Aldric is the in-Hub face. Frames Quest 2 as "rule of law / record-keeping". Existing `npcId: 'aldric'`; legacy Aldric quests get retired or rewired.
- **Klerus** — religious / occult-facing arm. NEW NPC, sprite reused from the existing RitualChamber priest model (or off-screen voice if no sprite fits — C-03). Frames Quest 3 as "spiritual purification".
- **Garde** — enforcement / patrol arm. NEW NPC, sprite reused from existing guard model. Frames Quest 4 as "loyalty / no questions asked".

### Outside-the-Council

- **Widerstand (Resistance)** — organized opposition. Elara is the face — rewritten from her current cameo in `harren_daughter` (where she's a missing-person target) into a living, active Resistance contact who gives Quest 5. The Widerstand is the moral spine of Act 1.
- **Independent** — neutral flag in `factionSystem`. Quest 1 gives +1 Independent (it's a personal favor for Harren). The player can stay Independent-leaning by avoiding faction-aligned dialogue choices in Quests 2–5, but the quests themselves are not faction-gated.

### Supporting cast

- **Harren** (Mentor / ex-Archivsmith) — Quest 1 giver + lore-fragment gatekeeper. Not aligned with any faction; his role is to give the player a starting hook without picking a side.
- **Mara** (Black Market vendor) — unchanged. Brief flavor-dialogue reactions to whichever faction has the highest standing.
- **Bürgermeister + Tochter** — dialogue-only quest-NPCs (no sprites). Daughter's investigation is the spine of Quests 1–6: the player's evolving understanding of where she is and why parallels the political revelation.

### System actors

- **Quest System** (`js/questSystem.js`) — consumes 6 new quest definitions.
- **Faction System** (`js/factionSystem.js`) — **refactored** from 3 standings (council / resistance / independent) to 5 (magistrat / klerus / garde / widerstand / independent). See FR-13.

## 3. User Scenarios

### Primary: A first-time player completes the Act 1 chain

1. Player finishes the tutorial (044) and arrives at the hub. Faction standings all at 0.
2. Talks to **Harren** (the only NPC with anything to offer initially): the mayor's daughter has vanished. Harren asks for a personal favor — not a faction errand.
3. **Quest 1**: dungeon run (depth 1). Player retrieves a journal fragment. The fragment hints that the daughter went into hiding *on her own* and mentions all three Council factions by name — each in a tone that suggests fear.
4. Returning to the hub, **four NPCs become active simultaneously**: Aldric (Magistrat), the Klerus-NPC, the Garde-NPC, and Elara (Widerstand). Each has a quest. The player can do them in **any order** and **complete all four**.
   - **Quest 2 (Magistrat / Aldric)** — Archive Forge mechanic: forge a "council-sealed verification document" for an administrative record. Frame: "the daughter must be reclassified as a missing person of interest, not a runaway."
   - **Quest 3 (Klerus)** — Catacomb run: purge a "tainted" lower level. Frame: "her flight is symptomatic of a deeper heretical infection; cleansing required."
   - **Quest 4 (Garde)** — Printing House mechanic: publish a "patrol expansion" edict. Frame: "increased presence will deter further desertions like hers."
   - **Quest 5 (Widerstand / Elara)** — dungeon run with a twist: extract a hidden Council document from a ritual chamber. Frame: "the Council factions are not as opposed as they appear — bring us proof."
5. After all four (Q2–Q5) are complete, **Quest 6 unlocks** automatically via Harren (he summons the player for a final reveal). The player witnesses a clandestine meeting between high-ranking members of all three Council factions — confirming what Elara hinted at. The journal fragment makes sense now: the daughter knew. The player chooses how to react (a flavor choice, not a content-gate), and the Act 1 chain closes with a "To be continued — Act 2" lore-fragment unlock.
6. Run-summary modal (already shipped) shows the final lore-fragment + the "To be continued" toast.

### Alternate: A returning player replays Act 1

1. Player has a save from a previous Act 1 completion. Loads.
2. Harren's dialogue offers "Replay Act 1" — resets quest state for the chain but preserves Knowledge-Tree progress (per constitution §Permanent Progression) and the act2-hook lore fragment.
3. Player can replay to refine pacing, dialogue, or to see flavor variations in Klerus/Garde/Elara dialogue that they may have rushed.

### Edge case: Player completes Quest 1 then leaves the dungeon mid-Quest 3

1. Quest 3 objectives are tracked in `questSystem` and persisted via `getQuestSaveData / loadQuestSaveData`.
2. On hub return, the Klerus-NPC dialogue reflects current progress (existing `questMode='progress'` flow).
3. The other available quests (Q2, Q4, Q5) remain offered in parallel.

### Edge case: Player ignores some Council quests, completes Widerstand-only path through Q5

1. Quest 6 prerequisite is **all of Q2 / Q3 / Q4 / Q5 complete**. If the player has only done Q5 + Q1, Quest 6 doesn't unlock; the chain is incomplete.
2. Harren's dialogue gently surfaces this: "Until you've seen every face the Council shows, you cannot judge them as one."
3. This is intentional — the political reveal in Quest 6 requires the player to have **personally done jobs for all three Council factions**, otherwise the punch lands flat.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | Quest 1 (`harren_daughter_investigation`) MUST be offered by Harren as the first available Act-1 quest, no prerequisites. Reward MUST include a journal-fragment lore item that triggers FR-02. | Draft  |
| FR-02 | After Quest 1 completion, Quests 2–5 MUST all become available simultaneously, in any order, with no mutual exclusion. Each is offered by a distinct NPC (Aldric / Klerus / Garde / Elara). | Draft  |
| FR-03 | Quest 2 MUST exercise the Archive Forge hub-location mechanic (craft / upgrade / decode interaction).                       | Draft  |
| FR-04 | Quest 3 MUST exercise the Rathauskeller catacomb-run mechanic (a depth-2 or higher dungeon run with a specific objective).  | Draft  |
| FR-05 | Quest 4 MUST exercise the Printing-House edict mechanic (player publishes a specific edict; suspicion delta as documented in #46). | Draft  |
| FR-06 | Quest 5 MUST be a dungeon run with a Widerstand-flavored objective (extract a hidden document from a ritual chamber). It MUST grant a fragment-of-truth lore item that the player can re-read at the Knowledge-Tree modal. | Draft  |
| FR-07 | Quest 6 (`council_collusion_reveal`) MUST require Quests 2 / 3 / 4 / 5 all completed before becoming offered. It's a dialogue-only quest with a binary flavor choice that does NOT branch content within Act 1. | Draft  |
| FR-08 | Quest 6 completion MUST grant the `act2_hook` lore fragment via `KnowledgeTree.addFragments()` AND display a "To be continued — Act 2" toast on hub return. | Draft  |
| FR-09 | Each quest completion MUST grant a faction-standing delta via `factionSystem.adjustStanding(factionId, +1)` for the corresponding faction. Quest 1 grants +1 Independent. Quest 6 grants nothing (the reveal is its own reward). | Draft  |
| FR-10 | All quest dialogues MUST be available in both DE and EN (mirror the existing i18n approach in `js/i18n.js`).                | Draft  |
| FR-11 | The 6-quest chain MUST be completable in 1.5–2 h wall-clock for a competent ARPG player (1 dungeon run for Q1/Q3/Q5, hub-mechanic for Q2/Q4, dialogue for Q6 — averaging ~20 min per quest including travel + hub time per constitution §Pacing). | Draft  |
| FR-12 | Each quest dialogue MUST reference at least one piece of city / political flavor (council factions, fog, archives, edicts, occult hints). The three Council-faction pitches MUST be visibly distinct in their political framing so the reveal in Quest 6 has clear "wait, these were the same goal?" texture. | Draft  |
| FR-13 | Pre-existing generic Aldric quests (`aldric_cleanup`, `aldric_patrol`, `aldric_intruders`) and the placeholder `harren_daughter` quest MUST be either retired or rewired into the new chain — no orphan quests offered. | Draft  |
| FR-14 | `factionSystem.js` MUST be refactored from 3 standings (council / resistance / independent) to 5 (magistrat / klerus / garde / widerstand / independent). Save-migration MUST preserve existing `council` value as `magistrat`, `resistance` value as `widerstand`, on first load post-upgrade. | Draft  |
| FR-15 | A read-only `factionSystem.getCouncilComposite()` helper MUST return the max of magistrat / klerus / garde so existing callers that just need "loyal to Council in general" (Printing-House suspicion gating, Aldric greeting thresholds) don't need three lookups. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                          | Threshold                                  | Status |
|--------|----------------------------------------------------------------------|---------------------------------------------|--------|
| NFR-01 | Quest definitions MUST load instantly during `questSystem` init.       | < 5 ms total for the 6-quest chain.        | Draft  |
| NFR-02 | Quest dialogue + flavor MUST stay within the existing modal sizing (~520 wide). | Existing `_showDialoguePages` panel limits. | Draft  |
| NFR-03 | Save migration: existing save files (Phase-1 players) MUST load without error after this feature lands. Faction-standing migration MUST be deterministic. | No console errors; missing quests gracefully ignored. | Draft  |
| NFR-04 | The faction-system refactor (FR-14) MUST NOT break existing Printing-House gating, Aldric greeting variants, or the Widerstand-gated quest at `questSystem.js:181-182`. | Existing Printing-House and Aldric flows regression-tested. | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | MUST reuse the existing `questSystem.js` quest-definition shape (id / title / npcId / type / chain / objectives / rewards / prerequisites / requiredAct / dialogue*). | Draft  |
| C-02  | MUST NOT introduce a new dialogue rendering pipeline — extend the existing `_showDialoguePages` flow only.                | Draft  |
| C-03  | MUST NOT add new NPC sprites. New Klerus-NPC + Garde-NPC reuse existing sprite slots (e.g. the priest model in the RitualChamber template, the guard model from the Rathaus area). Mayor + daughter remain dialogue-only. | Draft  |
| C-04  | Faction-standing deltas MUST go through `factionSystem.adjustStanding(factionId, delta)` — no direct mutation.            | Draft  |
| C-05  | Lore fragments granted MUST flow through `KnowledgeTree.addFragments()`.                                                 | Draft  |
| C-06  | No new mechanics. If a quest objective can't be expressed via the existing `kill / explore / fetch / craft` objective types, redesign the objective. | Draft  |
| C-07  | The political message MUST be embedded in quest **outcomes and the Quest-6 reveal**, not just NPC monologues. The player having personally done jobs for Magistrat AND Klerus AND Garde is the lever that makes the reveal hit. | Draft  |
| C-08  | Act 1 is intentionally non-branching. Faction standings accumulate but DO NOT gate Act-1 content. They become relevant in Acts 2–5 (out of scope here). | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | A fresh playthrough from tutorial-end to Quest-6-completion completes in 1.5–2 h with no soft-locks.                                              |
| SC-02 | A player can complete all 6 quests in the same run — no quest locks another out (verified by running both Q2→Q3→Q4→Q5 and Q5→Q2→Q3→Q4 orderings). |
| SC-03 | A playtester reports the Quest-6 reveal landed mechanically — they felt the weight of having served all three Council factions. The political thesis is conveyed via gameplay structure, not dialogue claim alone. | Draft |
| SC-04 | Faction standings after a full Act-1 playthrough: Magistrat = 1, Klerus = 1, Garde = 1, Widerstand = 1, Independent = 1. All distinct, all trackable, all surfaced in the Faction modal. | Draft |
| SC-05 | All visible strings present in DE and EN (verify via runtime language toggle).                                                                   |
| SC-06 | Pre-existing save files load without errors. A Phase-1 save with `council = 30` becomes `magistrat = 30` post-migration; with `resistance = 30` becomes `widerstand = 30`. | Draft |
| SC-07 | Existing Printing-House and Aldric-greeting gating continues to fire correctly post-refactor (via `getCouncilComposite()`).                       |
| SC-08 | Console is clean across the full playthrough — zero errors, zero warnings.                                                                       |

## 8. Edge Cases

- **Mid-quest save & reload** — covered by existing `getQuestSaveData / loadQuestSaveData` persistence.
- **Player completes Q2/Q3/Q4 but skips Q5** — Q6 stays locked until Q5 also done. Harren's dialogue surfaces the missing piece without spoiling the reveal.
- **Player completes Q5 first (before any Council quests)** — Q6 stays locked. Elara's dialogue acknowledges the Widerstand information is incomplete without firsthand Council experience.
- **Player never picks up Quest 1** — Aldric / Klerus / Garde / Elara remain silent until Quest 1 is complete (prerequisite enforced via `prerequisites: ['harren_daughter_investigation']`).
- **Player completes Knowledge-Tree investments mid-chain** — fragment economy is independent; KT investment continues to work in parallel.
- **Pre-Phase-1 player whose `council` standing was high** — migrated to `magistrat`. Their Klerus + Garde start at 0 (since they never existed). Acceptable narrative dissonance for save-migration purposes; flagged in player-facing migration message ("Council standing migrated to Magistrat — Klerus and Garde standing starts fresh").
- **Existing Printing-House gating reading `council` standing** — migrated to call `getCouncilComposite()` so the gate continues to fire when any Council sub-faction is at the gating threshold.
- **Existing Widerstand-gated quest (`questSystem.js:181-182`)** — `getStanding('resistance')` migrated to `getStanding('widerstand')`.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Quest 1 — `harren_daughter_investigation` | Harren-given fetch: 1 dungeon run, find journal fragment.                          |
| Quest 2 — `magistrat_verification`        | Aldric-given craft: Archive Forge interaction, council-sealed document.            |
| Quest 3 — `klerus_purification`           | Klerus-NPC-given: catacomb run, clear a "tainted" lower level.                    |
| Quest 4 — `garde_patrol_expansion`        | Garde-NPC-given: Printing-House edict publication.                                |
| Quest 5 — `widerstand_proof`              | Elara-given: dungeon run, extract a hidden Council document.                       |
| Quest 6 — `council_collusion_reveal`      | Harren-given (auto-unlocks on Q2/Q3/Q4/Q5 completion): dialogue-only, climax scene. |
| Lore fragment — `act2_hook`               | Granted on Quest-6 completion. Single fragment, no per-faction variant — the chain converges. |

## 10. Assumptions

- `factionSystem.js` is refactored as part of this feature (FR-14). The refactor is small (~ 60 LOC + save migration) and bundles cleanly with the quest chain in a single WP.
- `KnowledgeTree.addFragments(n)` is the canonical way to grant Knowledge-Tree currency (verified during 047).
- The existing `_showDialoguePages` modal correctly handles multi-page dialogues with branching choices (verified by the existing Aldric / Mara flows + 4bf2c54 mobile fix).
- The Klerus-NPC and Garde-NPC can be placed in the hub using the existing `_HUB_NPCS` configuration without new sprite art (C-03).

## 11. Out of Scope

- **Faction-based content gating in Act 1** — explicitly out of scope (C-08). All Act-1 quests are accessible regardless of standing.
- **Acts 2–5 story content** — separate epic (#31). Faction standings accumulated in Act 1 become the *input* to Acts 2–5 branching.
- **Multiple endings / branching beyond Act-1-end** — separate issue (#28).
- **Espionage / disguise mechanics** — separate issue (#30); Quest 4's "patrol" stays as edict mechanic, not stealth.
- **New NPC sprites** — Klerus-NPC + Garde-NPC reuse existing sprites or are off-screen voices. Mayor + daughter dialogue-only.
- **Tone & political-message polish pass** — separate issue #34 / Phase 2 follow-up. THIS spec ensures the political message lands in **quest outcomes + Q6 reveal**; #34 handles dialogue refinement, intro/outro, demo-skip toggle.
- **Difficulty re-balancing** — Phase 3 / #11. The chain assumes existing combat balance.

## 12. Dependencies

- `js/questSystem.js` — quest-definition catalog, objective tracking, save/load.
- `js/storySystem.js` — narrative state, act progression flag.
- `js/factionSystem.js` — refactored (FR-14) to 5 standings + `getCouncilComposite()` helper.
- `js/knowledgeTree.js` — `addFragments()` for lore-fragment grants.
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` for quest dialogues + Quest-6 climax scene.
- `js/i18n.js` — string registration for DE + EN.
- `js/printingHouse.js` — existing `council`-keyed gating callsites migrated to `getCouncilComposite()` (FR-15).

## 13. Risks

- **R-01 — Pacing miss**: 6 quests across 1.5–2 h means each quest averages ~20 min of meaningful gameplay. If a quest collapses to "click → click → done", the demo loop feels hollow. Mitigation: each quest requires either a dungeon run (Q1/Q3/Q5) OR a substantial hub-mechanic interaction (Q2/Q4) OR a multi-page reveal scene (Q6).
- **R-02 — Political message muted**: if FR-12 + C-07 aren't enforced per-quest, the chain reads as generic ARPG fetch quests and the donor-demo strategy fails. The Q6 reveal is the structural payoff — even if individual quest dialogues are mediocre, the player has earned the reveal by doing all three Council jobs. #34 follow-up if the in-quest delivery underperforms.
- **R-03 — `factionSystem.js` refactor regressions** (FR-14 / NFR-04): existing Printing-House suspicion gating, Aldric greeting variants, and the Widerstand-gated quest at `questSystem.js:181-182` all depend on the current 3-standing API. Migration must keep all three intact. Mitigation: FR-15 (`getCouncilComposite()` helper) gives Printing-House + Aldric-greetings a stable target; explicit `resistance` → `widerstand` rename in `questSystem.js`.
- **R-04 — Legacy Aldric quest conflicts** (FR-13): a player could have `aldric_cleanup` or `aldric_intruders` in progress from an older save. Decision (defer to plan phase): (a) auto-complete legacy quests on save migration with full rewards, or (b) leave them as parallel quests, but ensure the new chain doesn't depend on Aldric being free for Q2 acceptance.
- **R-05 — Quest 5 (Widerstand) feels disconnected**: if the player rushes Q2/Q3/Q4 first and tacks Q5 on at the end, the Widerstand might feel like an afterthought. Mitigation: Elara's dialogue in Q5 explicitly references the player's recent Council work ("I see you've been busy with their errands. Good. Now let me show you what you actually did.") — this lands harder the later Q5 is done.
- **R-06 — Linear chain feels gameplay-shallow despite story depth**: 6 quests in fixed order (after Q1) is a hand-holding flow. Mitigation: Q2–Q5 are **parallel, not sequential** — the player picks the order, which gives them agency without branching content. The chain feels linear in *story* but choice-driven in *moment-to-moment pacing*.

## 14. References

- ROADMAP.md §Phase 2 — Vertical Slice scope
- Issue #33 — Act 1 Quest-Chain & Narrative-Content (canonical scope)
- Issue #32 — Vertical Slice Tracker (Epic)
- constitution.md §Setting §Narrative Arc §Pacing §Permanent Progression — particularly the *"factions compete outwardly but serve a unified occult agenda"* clause
- `js/questSystem.js` — existing quest mechanism + legacy Aldric / Harren / Branka quest definitions to retire/rewire
- `js/factionSystem.js` — current 3-standing MVP, to be refactored to 5 standings
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` + project-memory `phaser_scrollfactor_dialogs`
