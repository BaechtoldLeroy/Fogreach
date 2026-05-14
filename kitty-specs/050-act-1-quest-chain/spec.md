# Specification: Act 1 Quest Chain

**Feature**: 050-act-1-quest-chain
**Created**: 2026-05-14
**Mission**: software-dev
**Tracker**: Issue #33 (Phase 2 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Phase 2 of the Vertical Slice strategy. With all 4 Phase-1 MVP systems live (Tutorial #29, Faction #25, Knowledge Tree #26, Printing House #24), Act 1 has the **mechanical scaffolding** but no **narrative spine**. Today the player drops into a hub with NPCs that hand out generic kill-N / explore-N objectives. This feature replaces those generic quests with a hand-authored 5-quest chain that takes the player from "Awakening" (constitution §Narrative Arc Act 1) to a faction-decision-point and an Act-2 cliffhanger — the polished demo loop the Donor strategy hinges on.

Reuses `js/questSystem.js`, `js/storySystem.js`, `js/factionSystem.js` (already wired into Hub V2 dialogues), and the existing `_showDialoguePages` modal pattern in `js/scenes/HubSceneV2.js`. No new combat or mechanic systems — this is content, dialogue, faction wiring, and pacing.

## 2. Stakeholders & Actors

- **Player** — Archivsmith protagonist. Experiences Act 1 as a coherent 1.5–2 h narrative arc.
- **Aldric** (Council representative, lives) — primary quest-giver for "official" Council framing. Already gives 3 generic quests; gets rewritten to deliver the Council viewpoint on Quest 1 + 2.
- **Elara** (Resistance contact) — currently exists in `harren_daughter` as the missing-person target. **Rewritten**: she's alive and active in Act 1, presenting the Resistance counter-viewpoint. The "missing daughter" hook moves to a different NPC.
- **Harren** (Mentor / ex-Archivsmith) — currently quest-gives `harren_daughter`. **Repositioned**: becomes the player's mentor figure, gates lore-fragment access, sets up the act-2 cliffhanger.
- **Mara** (Black Market vendor, lives) — unchanged. Stays as currency / item sink. Brief flavor-dialogue reactions to faction standing.
- **Mayor + missing daughter** — NEW quest-NPC pair (no sprite needed — flavor-text only, referenced via dialogue not seen on the hub map).
- **Quest System** (`js/questSystem.js`) — consumes new quest definitions, hooks objectives, awards rewards including faction-standing deltas.
- **Faction System** (`js/factionSystem.js`) — receives standing deltas at decision points and at quest completion.

## 3. User Scenarios

### Primary: A first-time player completes the Act 1 chain
1. Player finishes the tutorial (044) and arrives at the hub for the first time.
2. Talks to Harren: the mayor's daughter has vanished. Harren asks the player to investigate.
3. Quest 1 sends the player into a guided catacomb run (depth 1). On clearing the run, the player finds a journal fragment hinting that the daughter went willingly.
4. Back at the hub, Aldric (Council) and Elara (Resistance) both want to talk. They give contrasting interpretations of the journal:
   - Aldric: the daughter was abducted; Council demands the player hunt the abductor.
   - Elara: the daughter is hiding from the Council; Resistance asks the player to escort her safely.
5. Player accepts ONE of them (Quest 2A or Quest 2B). Faction standing shifts visibly (toast: "Council +1 standing" or "Resistance +1 standing").
6. Quests 3–4 advance the chosen faction's storyline through the 3 hub locations (Archive Forge / Rathauskeller / Printing House — exercising each hub-location's mechanics).
7. Quest 5 is the Faction-Decision-Point proper: the player makes an irreversible choice that locks one of two Act-2-hook lore fragments. Both unlocks point to the Catacombs / Demonic Pacts arc described in constitution §Act 3.
8. Run-summary modal (already shipped) shows the final lore-fragment + a "To be continued — Act 2" toast.

### Alternate: A returning player skips the tutorial and replays Act 1
1. Player has a save from a previous Act 1 completion. Loads.
2. Hub flags "Act 1 cleared — replay?" option on Harren's dialogue. Replay resets Act 1 quest-state but preserves Knowledge-Tree progress (per constitution §Permanent Progression).
3. Player can choose the opposite faction this time, see how Quests 3–4 differ. Same Act-2-hook fragment unlocks, different framing.

### Edge case: Player completes Quest 1 then leaves the dungeon mid-Quest-2
1. Quest 2A objectives are tracked in `questSystem` and persisted via `getQuestSaveData` / `loadQuestSaveData`.
2. On hub return, the Aldric / Elara dialogue reflects current progress (existing `questMode='progress'` flow).
3. No re-offer of Quest 2 is possible (single-acceptance enforced by `prerequisites` already in questSystem).

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | Quest 1 (`mayor_daughter_investigation`) MUST be offered by Harren as the first available Act 1 quest, no prerequisites.    | Draft  |
| FR-02 | Quest 1 completion MUST yield a journal-fragment lore item that triggers Aldric AND Elara to both offer Quest 2 variants.    | Draft  |
| FR-03 | Quest 2A (Aldric / Council) and Quest 2B (Elara / Resistance) MUST be mutually exclusive — accepting one locks out the other for this run. | Draft  |
| FR-04 | Quest 2A acceptance MUST shift Council standing by +1 and Resistance by 0; Quest 2B does the inverse. Standing change MUST surface as a HUD toast. | Draft  |
| FR-05 | Quest 3 (per faction) MUST exercise the Archive Forge hub-location mechanic (crafting / item-upgrade event).                 | Draft  |
| FR-06 | Quest 4 (per faction) MUST exercise either the Rathauskeller catacomb run OR the Printing House edict mechanic.              | Draft  |
| FR-07 | Quest 5 (Faction-Decision-Point) MUST present a binary irreversible choice that affects Council vs Resistance standing by ≥ 3 in opposite directions. | Draft  |
| FR-08 | Quest 5 completion MUST grant a single Act-2-hook lore fragment (different per faction) AND display a "To be continued" toast on hub return. | Draft  |
| FR-09 | All quest dialogues MUST be available in both DE and EN (mirror the existing i18n approach in `js/i18n.js`).                 | Draft  |
| FR-10 | The 5-quest chain MUST be completable in 1.5–2 h wall-clock for a competent ARPG player (1 dungeon run per quest, ~10–20 min per run per constitution §Pacing). | Draft  |
| FR-11 | Each quest MUST reference at least one piece of city / political flavor in its dialogue (council, fog, archives, resistance, edicts) so the political theme isn't deferred to #34. | Draft  |
| FR-12 | Pre-existing generic Aldric quests (`aldric_cleanup`, `aldric_patrol`, `aldric_intruders`) MUST be either retired or rewired into the new chain — no orphan quests offered to the player. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                          | Threshold                                  | Status |
|--------|----------------------------------------------------------------------|---------------------------------------------|--------|
| NFR-01 | Quest definitions MUST load instantly during `questSystem` init.       | < 5 ms total for the new chain.            | Draft  |
| NFR-02 | Quest dialogue + flavor MUST stay within the existing modal sizing (~520 wide). | Existing `_showDialoguePages` panel limits. | Draft  |
| NFR-03 | Save migration: existing save files (Phase-1 players) MUST load without error after this feature lands. | No console errors; missing quests gracefully ignored. | Draft  |
| NFR-04 | Faction-standing changes MUST be reversible only via explicit "Replay Act 1" — no accidental flips. | Tested via two-run playthrough.          | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | MUST reuse the existing `questSystem.js` quest-definition shape (id / title / npcId / type / chain / objectives / rewards / prerequisites / requiredAct / dialogue*). | Draft  |
| C-02  | MUST NOT introduce a new dialogue rendering pipeline — extend the existing `_showDialoguePages` flow only.                | Draft  |
| C-03  | MUST NOT add new NPC sprites; new "mayor + daughter" NPCs exist only as dialogue references (off-screen narrative).        | Draft  |
| C-04  | Faction-standing deltas MUST go through `factionSystem.adjustStanding()` — no direct mutation of standing state.          | Draft  |
| C-05  | Lore fragments granted MUST flow through `KnowledgeTree.addFragments()` so the Knowledge Tree currency economy stays consistent. | Draft  |
| C-06  | No new mechanics. If a quest objective can't be expressed via the existing `kill / explore / fetch / craft` objective types, redesign the objective. | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | A fresh playthrough from tutorial-end to Quest-5-completion completes in 1.5–2 h with no soft-locks.                                              |
| SC-02 | Quest 2 decision visibly changes the player's faction standing (HUD toast + Faction modal reflects the new values).                              |
| SC-03 | At least one playtester (or solo-dev sanity check) reports the political message comes through *before* the #34 Tone-Pass — quests carry weight on their own. |
| SC-04 | All visible strings present in DE and EN (verify via runtime language toggle).                                                                   |
| SC-05 | Pre-existing save files load without errors and surface the new Quest-1 offer next time the player visits the hub.                              |
| SC-06 | Console is clean across the full playthrough — zero errors, zero warnings.                                                                       |

## 8. Edge Cases

- **Mid-quest save & reload** — covered by existing `getQuestSaveData / loadQuestSaveData` persistence.
- **Player picks Quest 2A, then loses the run before completing it** — quest state preserved; Aldric dialogue reflects progress on hub return.
- **Player never picks up Quest 1** — Aldric / Elara remain silent on Quest 2 until Quest 1 is complete (prerequisite enforced).
- **Player completes Knowledge-Tree investments mid-chain** — fragment economy is independent; KT investment continues to work in parallel.
- **Faction standing already maxed (Phase-1 player)** — standing delta caps gracefully; Quest 5 choice still unlocks the correct lore fragment.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Quest 1 — `mayor_daughter_investigation` | Harren-given fetch quest: 1 dungeon run, find journal fragment, return.            |
| Quest 2A — `aldric_hunt_abductor`        | Council-side kill quest: 1 dungeon run, slay 15 enemies + an elite "abductor".      |
| Quest 2B — `elara_escort_daughter`       | Resistance-side escort: 1 dungeon run, reach a specific room without losing > X HP. |
| Quest 3 — `forge_council` / `forge_resistance` | Archive-Forge crafting: upgrade a specific item tier OR salvage a specific count.  |
| Quest 4 — `printing_council` / `printing_resistance` | Printing-House: publish a specific edict OR steal a Council document via dungeon run. |
| Quest 5 — `decision_point` (binary)      | Faction-Decision-Point: dialogue-only choice, ≥3 standing delta both directions.    |
| Lore fragment — `act2_hook_council` / `act2_hook_resistance` | Different Knowledge-Tree-currency lore unlock per faction outcome.       |

## 10. Assumptions

- `factionSystem.js` already exposes a usable `adjustStanding(faction, delta)` API.
- `KnowledgeTree.addFragments(n)` is the canonical way to grant Knowledge-Tree currency (verified during 047).
- The existing `_showDialoguePages` modal correctly handles multi-page dialogues with branching choices (verified by the existing Aldric / Mara flows).
- Mobile dialog scrollFactor falle has been fixed already (project memory; commit `4bf2c54`).

## 11. Out of Scope

- **Acts 2–5 story content** — separate epic (#31).
- **Multiple endings / branching beyond Act-1-end** — separate issue (#28).
- **Espionage / disguise mechanics** — separate issue (#30); Quest 2A's "hunt" stays as combat, not stealth.
- **New NPC sprites** — mayor + daughter remain dialogue-only.
- **Tone & political-message polish pass** — separate issue #34 / Phase 2 follow-up.
- **Difficulty re-balancing for the new chain** — Phase 3 / #11. The chain assumes existing combat balance.

## 12. Dependencies

- `js/questSystem.js` — quest-definition catalog, objective tracking, save/load.
- `js/storySystem.js` — narrative state, act progression flag.
- `js/factionSystem.js` — standing adjustments + faction-gating checks.
- `js/knowledgeTree.js` — `addFragments()` for lore-fragment grants.
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` for quest dialogues + faction-decision-point UI.
- `js/i18n.js` — string registration for DE + EN.

## 13. Risks

- **R-01 — Pacing miss**: 5 quests stretched across 1.5–2 h means each quest needs ~20 min of meaningful gameplay. If a quest collapses to "click → click → done", the demo loop feels hollow. Mitigation: each quest MUST require at least one dungeon run OR one substantial hub-mechanic interaction (FR-05 / FR-06 are explicit about this).
- **R-02 — Political message muted**: if FR-11 isn't enforced per-quest, the chain reads as generic ARPG fetch quests and the donor-demo strategy fails. Mitigation: dialogue review pass before merge; #34 follow-up if the in-quest delivery underperforms.
- **R-03 — Faction-standing state pollution**: pre-existing players have arbitrary standing from Phase-1 gameplay. Quest 2 standing deltas could over-correct. Mitigation: NFR-04 + a one-time standing-snapshot recorded at Quest 1 acceptance so Quest 5 deltas measure from that baseline.
- **R-04 — Legacy Aldric quest conflicts** (FR-12): the player could have `aldric_cleanup` or `aldric_intruders` in progress from an older save. Either: (a) auto-complete legacy quests on save migration with full rewards, or (b) leave them as parallel quests and ensure new chain doesn't depend on Aldric being free. Decision deferred to the plan phase.

## 14. References

- ROADMAP.md §Phase 2 — Vertical Slice scope
- Issue #33 — Act 1 Quest-Chain & Narrative-Content (the canonical scope source)
- Issue #32 — Vertical Slice Tracker (Epic)
- constitution.md §Storyline §Pacing §Permanent Progression
- `js/questSystem.js` — existing quest mechanism + Aldric / Harren / Branka quest definitions to retire/rewire
- `js/factionSystem.js` — standing API
- `js/scenes/HubSceneV2.js` — `_showDialoguePages` + project-memory `phaser_scrollfactor_dialogs`
