# Specification: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Created**: 2026-05-14
**Mission**: software-dev
**Tracker**: Issue #33 (Phase 2 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Phase 2 of the Vertical Slice strategy. Phase 1 shipped 4 MVP systems (Tutorial #29, Faction #25, Knowledge Tree #26, Printing House #24) — Act 1 now has the **mechanical scaffolding** but no **narrative spine**. Today the player drops into a hub with NPCs that hand out generic kill-N / explore-N objectives. This feature replaces those generic quests with a hand-authored 5-quest chain that takes the player from "Awakening" (constitution §Narrative Arc Act 1) to a faction-decision-point and an Act-2 cliffhanger — the polished demo loop the Donor strategy hinges on.

**Doctrinal shape (constitution §Setting)**: *"The Chain Council governs as a sham democracy whose factions compete outwardly but serve a unified occult agenda."* The Act-1 quest chain must MAKE THIS VISIBLE by gameplay, not just by dialogue. Concretely:

- **Three Council-internal factions** (Magistrat / Klerus / Garde) appear to disagree on Quest-1's outcome and each pitch the player to align with them.
- **The Resistance** is the only outside-the-system option — the "good" path in a setting where the Council factions are a manipulated false-choice.
- The Act-1 climax (Quest 5) reveals that whichever Council faction the player aligned with, all three were colluding the entire time. The Resistance arc validates the player's distrust.

Reuses `js/questSystem.js`, `js/storySystem.js`, `js/factionSystem.js` (with a refactor — see FR-13), `js/knowledgeTree.js`, and the existing `_showDialoguePages` modal pattern in `js/scenes/HubSceneV2.js`. No new combat or mechanic systems — this is content, dialogue, faction wiring, and pacing.

## 2. Stakeholders & Actors

### Council-internal factions (publicly competing, secretly aligned)

- **Magistrat** — administrative-bureaucratic arm of the Council. Aldric is the in-Hub face. Pitches "rule of law / public order" framing. Quest-givers currently use `npcId: 'aldric'` and `faction = 'council'` — both get updated.
- **Klerus** — religious / occult-facing arm. NEW NPC (no new sprite — represented via the existing `RitualChamber` priest model OR via off-screen dialogue if no sprite fits). Pitches "spiritual purity / heretic eradication" framing — superficially in tension with the Magistrat's secular framing.
- **Garde** — enforcement / patrol arm. Represented through Hub-side patrol mechanics (Printing-House suspicion edicts already touch this) + 1 quest-NPC for the Act-1 chain. Pitches "loyalty / no questions asked" framing.

### Outside-the-Council

- **Widerstand (Resistance)** — organized opposition. Elara is the face. Currently `npcId: 'elara'` (referenced in `harren_daughter`) gets rewritten as a living, active Resistance contact. The Resistance is the moral spine of Act 1: the player's hint that something is off about the Council comes from this side.
- **Independent** — neutral flag. Player can refuse all four factions and walk a lone path. Tracked in `factionSystem`, but yields no Act-1 quests of its own — it's a stance, not a quest-giver.

### Supporting cast

- **Harren** (Mentor / ex-Archivsmith) — repositioned as Quest-1 giver + lore-fragment gatekeeper. NOT aligned with any faction — his role is to teach the player to read the city without trusting any single source.
- **Mara** (Black Market vendor) — unchanged. Brief flavor-dialogue reactions to whatever faction the player has highest standing with.
- **Bürgermeister + Tochter** — quest-NPC pair, dialogue-only (no sprites). Daughter's investigation is Quest 1; she becomes an NPC in Quest 2A/2B/2C depending on the player's choice.

### System actors

- **Quest System** (`js/questSystem.js`) — consumes new quest definitions.
- **Faction System** (`js/factionSystem.js`) — **expanded** from 3 standings (council / resistance / independent) to 5 (magistrat / klerus / garde / widerstand / independent). See FR-13.

## 3. User Scenarios

### Primary: A first-time player completes the Act 1 chain

1. Player finishes the tutorial (044) and arrives at the hub for the first time. Faction standings all at 0.
2. Talks to Harren (he's the only NPC offering anything): the mayor's daughter has vanished. Harren asks the player to investigate — not as a faction errand, but as a personal favor. *"Trust no one until you've seen the journal yourself."*
3. **Quest 1**: dungeon run (depth 1, guided). Player retrieves the journal fragment. The fragment hints that the daughter went into hiding **on her own** — and that she feared the Klerus specifically.
4. Back at the hub, **four NPCs all want to talk** about the journal:
   - **Aldric (Magistrat)**: pitches the journal as evidence of "subversive contact" — wants the player to find the daughter and turn her in for "her own protection". Frames it as administrative duty.
   - **Klerus-NPC**: pitches the journal as evidence of "heretical influence" — wants the player to find the daughter and report her location to the Inquisition. Frames it as spiritual purification.
   - **Garde-NPC**: pitches a "no-questions-asked" patrol contract — find her, deliver her, get paid. Frames it as transactional loyalty.
   - **Elara (Resistance)**: pitches helping the daughter **stay hidden** — protects her from the Council apparatus. Frames it as moral defiance.
5. Player picks **one of four Quest-2 variants**. Standing shifts visibly (HUD toast: "Magistrat +1" / "Klerus +1" / "Garde +1" / "Widerstand +1"). The other three Quest-2 options remain offered but get a "you've made your choice" flavor response if approached.
6. **Quest 3 (per faction)**: each path exercises the **Archive Forge** hub-location mechanic — but in faction-flavored ways:
   - Magistrat: craft a council-sealed "verification document" item.
   - Klerus: salvage a "heretic relic" for purification.
   - Garde: upgrade a piece of standard-issue gear via Forge.
   - Widerstand: secretly forge a forged Council seal at the Forge (Archivsmith past comes in handy).
7. **Quest 4 (per faction)**: each path exercises either **Rathauskeller catacombs** OR **Printing House**:
   - Magistrat → Printing House: publish a "stability edict" (suspicion +1).
   - Klerus → Catacomb run: clear a "tainted" lower level.
   - Garde → Printing House: publish an "increased patrol" edict.
   - Widerstand → Catacomb run: extract a hidden document from a Council ritual chamber.
8. **Quest 5 (Faction-Decision-Point — irreversible)**:
   - Three Council paths (Magistrat / Klerus / Garde) all converge on the same scene: the player witnesses a clandestine meeting between high-ranking members of all three "competing" factions, revealing they coordinate. The player is offered ONE final step that locks them deeper into Council service (high faction-faction standing, **but the player KNOWS**). Their choice unlocks `act2_hook_council`: *"the rot runs deeper than one faction."*
   - The Resistance path culminates in a confrontation where Elara reveals the Resistance has been tracking the same alignment from the outside. The player gets a different lore fragment — `act2_hook_resistance`: *"the war between the factions is theater; the real conflict is below."*
   - Both Act-2 hooks point to **Act 3 — Descent / Demonic Pacts** (per constitution §Narrative Arc), reinforcing the same destination via different framings.
9. Run-summary modal (already shipped) shows the final lore-fragment + a "To be continued — Act 2" toast.

### Alternate: A returning player skips the tutorial and replays Act 1

1. Player has a save from a previous Act 1 completion. Loads.
2. Hub flags "Act 1 cleared — replay?" option on Harren's dialogue. Replay resets Act-1 quest-state but preserves Knowledge-Tree progress (per constitution §Permanent Progression).
3. Player can choose a different faction path this time, see how Quests 3–4 differ. The same Act-2-hook lore fragment from their previous run remains in the Knowledge Tree (lore is permanent).

### Edge case: Player completes Quest 1 then leaves the dungeon mid-Quest-2

1. Quest 2A/B/C/D objectives are tracked in `questSystem` and persisted via `getQuestSaveData / loadQuestSaveData`.
2. On hub return, the active faction-NPC's dialogue reflects current progress (existing `questMode='progress'` flow).
3. The other three Quest-2 NPCs remain in their "you've made your choice" state.

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | Quest 1 (`mayor_daughter_investigation`) MUST be offered by Harren as the first available Act-1 quest, no prerequisites.    | Draft  |
| FR-02 | Quest 1 completion MUST yield a journal-fragment lore item that triggers Aldric (Magistrat), Klerus-NPC, Garde-NPC, AND Elara (Widerstand) to each offer a Quest-2 variant. | Draft  |
| FR-03 | The four Quest-2 variants MUST be mutually exclusive — accepting any one locks out the other three for this run. The locked-out NPCs MUST acknowledge the choice in dialogue, not be silent. | Draft  |
| FR-04 | Quest-2 acceptance MUST shift the corresponding faction standing by +1 via `factionSystem.adjustStanding()`. Standing change MUST surface as a HUD toast. | Draft  |
| FR-05 | Quest 3 (per faction) MUST exercise the Archive Forge hub-location mechanic (crafting / item-upgrade event). All four faction-flavored variants share the Forge interaction but with different recipes / item targets. | Draft  |
| FR-06 | Quest 4 (per faction) MUST exercise either the Rathauskeller catacomb run OR the Printing House edict mechanic (split: Magistrat + Garde → Printing House; Klerus + Widerstand → Catacomb run). | Draft  |
| FR-07 | Quest 5 MUST present an irreversible binary choice. The three Council paths converge on the same scene with the same choice ("commit" or "withdraw"). The Widerstand path has its own scene with a parallel choice. | Draft  |
| FR-08 | Quest 5 completion MUST grant exactly one Act-2-hook lore fragment via `KnowledgeTree.addFragments()` — `act2_hook_council` for the three Council paths, `act2_hook_widerstand` for the Resistance path. A "To be continued" toast MUST display on hub return. | Draft  |
| FR-09 | All quest dialogues MUST be available in both DE and EN (mirror the existing i18n approach in `js/i18n.js`).                | Draft  |
| FR-10 | The 5-quest chain MUST be completable in 1.5–2 h wall-clock for a competent ARPG player (1 dungeon run per quest, ~10–20 min per run per constitution §Pacing). | Draft  |
| FR-11 | Each quest dialogue MUST reference at least one piece of city / political flavor (council factions, fog, archives, edicts, occult hints) so the political theme isn't deferred to #34. The four Quest-2 pitches MUST be visibly distinct in their political framing. | Draft  |
| FR-12 | Pre-existing generic Aldric quests (`aldric_cleanup`, `aldric_patrol`, `aldric_intruders`) MUST be either retired or rewired into the Magistrat path — no orphan quests offered. Existing `harren_daughter` quest MUST be retired (Elara is alive in the new chain). | Draft  |
| FR-13 | `factionSystem.js` MUST be refactored from 3 standings (council / resistance / independent) to 5 (magistrat / klerus / garde / widerstand / independent). Save-migration MUST preserve existing `council` value as `magistrat`, `resistance` value as `widerstand`, on first load post-upgrade. | Draft  |
| FR-14 | A read-only `factionSystem.getCouncilComposite()` helper MUST return the max of magistrat / klerus / garde so callers that just need "loyal to Council in general" (e.g. existing Printing-House suspicion gating) don't need three lookups. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                          | Threshold                                  | Status |
|--------|----------------------------------------------------------------------|---------------------------------------------|--------|
| NFR-01 | Quest definitions MUST load instantly during `questSystem` init.       | < 5 ms total for the new chain.            | Draft  |
| NFR-02 | Quest dialogue + flavor MUST stay within the existing modal sizing (~520 wide). | Existing `_showDialoguePages` panel limits. | Draft  |
| NFR-03 | Save migration: existing save files (Phase-1 players) MUST load without error after this feature lands. Faction-standing migration MUST be deterministic. | No console errors; missing quests gracefully ignored. | Draft  |
| NFR-04 | Faction-standing changes MUST be reversible only via explicit "Replay Act 1" — no accidental flips. | Tested via two-run playthrough.          | Draft  |
| NFR-05 | The faction-system refactor (FR-13) MUST NOT break existing Printing-House gating or NPC greeting variants. All `council`-keyed checks migrated to `getCouncilComposite()` OR to the specific Magistrat lookup as appropriate. | Existing Printing-House run regression-tested. | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | MUST reuse the existing `questSystem.js` quest-definition shape (id / title / npcId / type / chain / objectives / rewards / prerequisites / requiredAct / dialogue*). | Draft  |
| C-02  | MUST NOT introduce a new dialogue rendering pipeline — extend the existing `_showDialoguePages` flow only.                | Draft  |
| C-03  | MUST NOT add new NPC sprites. New Klerus-NPC + Garde-NPC reuse existing sprite slots (e.g. the priest model in the RitualChamber template) OR live as off-screen voices in dialogue. Mayor + daughter remain dialogue-only. | Draft  |
| C-04  | Faction-standing deltas MUST go through `factionSystem.adjustStanding(factionId, delta)` — no direct mutation.            | Draft  |
| C-05  | Lore fragments granted MUST flow through `KnowledgeTree.addFragments()`.                                                 | Draft  |
| C-06  | No new mechanics. If a quest objective can't be expressed via the existing `kill / explore / fetch / craft` objective types, redesign the objective. | Draft  |
| C-07  | The political message MUST be embedded in quest **outcomes and reveals**, not just NPC monologues. Quest 5's collusion reveal is the central proof-of-thesis moment. | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | A fresh playthrough from tutorial-end to Quest-5-completion completes in 1.5–2 h with no soft-locks.                                              |
| SC-02 | Quest 2 decision visibly changes the player's faction standing (HUD toast + Faction modal reflects the new value for the chosen faction).         |
| SC-03 | A playtester who picked one of the three Council factions reports they FELT the moment of betrayal in Quest 5 — the political message landed mechanically, not via dialogue alone. | Draft |
| SC-04 | A playtester who picked the Widerstand reports they felt their distrust validated — the Resistance path is meaningfully different in tone and outcome, not just a re-skinned quest. | Draft |
| SC-05 | All visible strings present in DE and EN (verify via runtime language toggle).                                                                   |
| SC-06 | Pre-existing save files load without errors. A Phase-1 save with `council = 30` becomes `magistrat = 30` post-migration; with `resistance = 30` becomes `widerstand = 30`. | Draft |
| SC-07 | Console is clean across the full playthrough — zero errors, zero warnings.                                                                       |

## 8. Edge Cases

- **Mid-quest save & reload** — covered by existing `getQuestSaveData / loadQuestSaveData` persistence.
- **Player picks Quest 2A but loses the run** — quest state preserved; Aldric dialogue reflects progress on hub return.
- **Player never picks up Quest 1** — Aldric / Klerus / Garde / Elara remain silent on Quest 2 until Quest 1 is complete (prerequisite enforced).
- **Player picks Widerstand then maxes Magistrat standing somehow (cheats? old save?)** — Quest-5 logic uses the chosen Quest-2 branch as ground truth, not raw standing values.
- **Pre-Phase-1 player whose `council` standing was high** — migrated to `magistrat`. They still get all four Quest-2 NPCs offering (the chain restarts), but their Magistrat standing is non-zero from the start. No correctness issue, just narrative dissonance — acceptable for the demo.
- **Existing Printing-House gating that reads `council` standing** — migrated to call `getCouncilComposite()` so the gate continues to fire when any Council sub-faction is at the gating threshold.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Quest 1 — `mayor_daughter_investigation` | Harren-given fetch: 1 dungeon run, find journal fragment, return.                  |
| Quest 2A — `magistrat_turn_in_daughter`  | Magistrat-side fetch: locate the daughter, turn her in to the Council.              |
| Quest 2B — `klerus_report_heretic`       | Klerus-side fetch: report the daughter's location to the Inquisition.              |
| Quest 2C — `garde_patrol_contract`       | Garde-side bounty: capture the daughter and deliver. No questions asked.            |
| Quest 2D — `widerstand_protect_daughter` | Resistance-side: help the daughter stay hidden from all three Council factions.    |
| Quest 3 (×4)      | Per-faction Archive-Forge interaction: craft / salvage / upgrade / forge-counterfeit. |
| Quest 4 (×4)      | Per-faction Rathauskeller catacomb run OR Printing-House edict.                       |
| Quest 5 (×2 scenes) | Faction-Decision-Point. Council paths converge on the collusion-reveal scene; Resistance path has its own validation scene. |
| Lore fragment — `act2_hook_council`      | Granted on Quest-5 completion via any Council path.                                 |
| Lore fragment — `act2_hook_widerstand`   | Granted on Quest-5 completion via the Resistance path.                              |

## 10. Assumptions

- `factionSystem.js` is refactored as part of this feature (FR-13). The refactor is small enough (~ 50 LOC) to bundle with the quest chain in a single WP.
- `KnowledgeTree.addFragments(n)` is the canonical way to grant Knowledge-Tree currency (verified during 047).
- The existing `_showDialoguePages` modal correctly handles multi-page dialogues with branching choices (verified by the existing Aldric / Mara flows + 4bf2c54 mobile fix).
- The Klerus-NPC and Garde-NPC can be placed in the hub using the existing `_HUB_NPCS` configuration without new sprite art (C-03).

## 11. Out of Scope

- **Acts 2–5 story content** — separate epic (#31).
- **Multiple endings / branching beyond Act-1-end** — separate issue (#28).
- **Espionage / disguise mechanics** — separate issue (#30); Quest 2C's "patrol contract" stays as combat-flavored, not stealth.
- **New NPC sprites** — mayor + daughter remain dialogue-only; Klerus-NPC + Garde-NPC reuse existing sprites or are off-screen voices.
- **Tone & political-message polish pass** — separate issue #34 / Phase 2 follow-up. THIS spec ensures the political message lands in **quest outcomes**; #34 handles dialogue refinement, intro/outro, demo-skip toggle.
- **Difficulty re-balancing for the new chain** — Phase 3 / #11. The chain assumes existing combat balance.

## 12. Dependencies

- `js/questSystem.js` — quest-definition catalog, objective tracking, save/load.
- `js/storySystem.js` — narrative state, act progression flag.
- `js/factionSystem.js` — refactored (FR-13) to 5 standings + `getCouncilComposite()` helper.
- `js/knowledgeTree.js` — `addFragments()` for lore-fragment grants.
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` for quest dialogues + faction-decision-point UI.
- `js/i18n.js` — string registration for DE + EN.
- `js/printingHouse.js` — existing `council`-keyed gating callsites migrated to `getCouncilComposite()` (FR-14).

## 13. Risks

- **R-01 — Pacing miss**: 5 quests stretched across 1.5–2 h means each quest needs ~20 min of meaningful gameplay. If a quest collapses to "click → click → done", the demo loop feels hollow. Mitigation: each quest MUST require at least one dungeon run OR one substantial hub-mechanic interaction (FR-05 / FR-06 are explicit).
- **R-02 — Political message muted**: if FR-11 + C-07 aren't enforced per-quest, the chain reads as generic ARPG fetch quests and the donor-demo strategy fails. Mitigation: Quest 5 collusion-reveal is the structural payoff — even if individual quest dialogues are mediocre, the reveal carries the thesis. #34 follow-up if the in-quest delivery underperforms.
- **R-03 — Faction-content asymmetry**: 4 faction paths × 3 quests = 12 quest-variants to author. Risk of one path feeling thinner than others. Mitigation: each path shares the same Archive-Forge / Catacomb / Printing-House mechanic — only flavor (item targets, dialogue, edict choice) varies per faction. Caps the authoring cost at ~3× a single path, not 4×.
- **R-04 — `factionSystem.js` refactor regressions**: existing Printing-House suspicion gating depends on `council` standing. Migration must keep gating intact. Mitigation: FR-14 (`getCouncilComposite()` helper) gives Printing-House a stable target; migration script copies `council → magistrat` so the player's gating-threshold history is preserved.
- **R-05 — Legacy Aldric quest conflicts** (FR-12): a player could have `aldric_cleanup` or `aldric_intruders` in progress from an older save. Decision (defer to plan phase): (a) auto-complete legacy quests on save migration with full rewards, or (b) leave them as parallel quests, but ensure the new chain doesn't depend on Aldric being free.
- **R-06 — Four-way Quest-2 overwhelms the player**: presenting four NPCs at once may be paralysing. Mitigation: Harren explicitly previews the choice ("you'll hear from four people about the journal — listen, then decide"), and the Hub UI highlights only ONE faction's NPC at a time as "wants to talk" (rotation: Magistrat → Klerus → Garde → Widerstand on subsequent hub visits if the player ignores the current one).

## 14. References

- ROADMAP.md §Phase 2 — Vertical Slice scope
- Issue #33 — Act 1 Quest-Chain & Narrative-Content (canonical scope)
- Issue #32 — Vertical Slice Tracker (Epic)
- constitution.md §Setting §Narrative Arc §Pacing §Permanent Progression — particularly the *"factions compete outwardly but serve a unified occult agenda"* clause
- `js/questSystem.js` — existing quest mechanism + Aldric / Harren / Branka quest definitions to retire/rewire
- `js/factionSystem.js` — current 3-standing MVP, to be refactored to 5 standings
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` + project-memory `phaser_scrollfactor_dialogs`
