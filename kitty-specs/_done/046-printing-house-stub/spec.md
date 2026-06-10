# Specification: Printing House (with Currency, Tiers, Suspicion)

**Feature**: 046-printing-house-stub
**Created**: 2026-05-02 · **Revised**: 2026-05-03
**Mission**: software-dev
**Tracker**: Issue #24 (Phase 1 of Vertical Slice Epic #32)
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Constitution §Permanent Progression names "Printing House edicts" as one of the four permanent progression pillars. The original spec was a 2-edict stub; user feedback during planning called it too flat ("publish, free, no tradeoff"). This revised spec adds gameplay depth via three pillars:

1. **Currency** — a printable resource ("Druckblätter") that players collect and spend on edicts. Persists across runs.
2. **Edict tiers with cost** — Mild (1 paper), Strong (3), Risky (5). Risky edicts have meaningful downside.
3. **Council Suspicion counter** — publishing increases Council attention; high suspicion triggers retaliation in the next runs. Decays naturally; can also be paid down with gold.

All edict gameplay effects (player buffs, shop multipliers, loot bias, enemy bonuses) are run-scoped and clear on hub return — same pattern the Brunnen rework (#16) established with `window.brunnenBuffs`. The currency, suspicion, unlock state, and publication history persist across runs.

## 2. Stakeholders & Actors

- **Player** — collects Druckblätter, visits the Druckerei, browses unlocked edicts, weighs cost vs. effect vs. suspicion, publishes.
- **Setzer Thom** (Druckerei NPC) — single new NPC, browses edicts via the existing dialog UI.
- **Council faction (#25)** — gates edict unlocks; retaliates when suspicion is high.
- **Mara (existing)** — accepts gold "Bestechung" to lower suspicion; her shop prices respond to merchant-discount edicts.
- **Run-start systems** — apply the active edict's effect when the player enters the dungeon (player damage / max-HP buffs, enemy difficulty modifiers, loot rarity bias, shop price multiplier).

## 3. User Scenarios

### Primary: Publish a Mild edict on the first visit

1. Player plays a few runs and accumulates 3 Druckblätter (drops + a quest reward).
2. They visit the Druckerei. Setzer Thom opens an edict-browser dialog.
3. Three Mild edicts are visible (Resistance standing >= 0). Strong / Risky tiers are listed but greyed out with the unlock requirement.
4. Player picks "Schutzamulette verteilt" (1 Druckblatt → +10 Max-HP next run). Confirmation prompt with cost/effect/suspicion summary.
5. Confirm → Druckblätter -1, suspicion +1, edict marked active for next run, history entry added.
6. Player enters the dungeon. Max HP is +10. On hub return: max HP reverts; suspicion stays.

### Alternate: Strong edict requires Resistance standing

1. Player has 5 Druckblätter and Resistance standing 28.
2. Strong tier unlocks. They publish "Kriegsruf" (3 Druckblätter → +15% damage next run).
3. Suspicion +3. Total suspicion now 4.

### Alternate: Risky edict, big payoff + downside

1. Player has 5 Druckblätter, Resistance standing 60, low suspicion.
2. Publish "Letzte Schlacht" (5 Druckblätter → +30% damage AND +30% Max-HP, but no potions usable).
3. Run is high-stakes. If they survive, they get massive XP / gold from the buffed combat. If they die, run is wasted.

### Alternate: Suspicion retaliation

1. Player has published 4 Strong edicts in a row. Suspicion = 12.
2. Retaliation kicks in: each dungeon room spawns +1 elite Council guard. Aldric refuses to give new quests.
3. Player either (a) publishes nothing for 12 runs to decay back, or (b) bribes Aldric (100 gold per visit, -5 suspicion).

### Alternate: Druckerei not yet visible

1. Brand new player walks toward the Druckerei. The entrance dialog says "Die Druckerei ist verschlossen — komm wieder, wenn du dich bewährt hast."
2. After completing the first Aldric quest (`aldric_cleanup`), the Druckerei opens.

## 4. Functional Requirements

### Currency

| ID | Requirement | Status |
|---|---|---|
| FR-01 | The system MUST track a non-negative integer "Druckblätter" count, persisted in localStorage. | Draft |
| FR-02 | Druckblätter MUST cap at 50 (additional drops above the cap are discarded). | Draft |
| FR-03 | Council guards (and elite variants) MUST drop 1 Druckblatt with 5–10% chance (mild), elites 15–20%. | Draft |
| FR-04 | Quest rewards MUST be able to grant Druckblätter via a `druckblaetter` field on the rewards object (1–3 typical). | Draft |
| FR-05 | At least one Druckerei action MUST allow the player to spend gold to convert to Druckblätter (e.g. 50 gold → 1 Druckblatt) so a stuck player can always make some progress. | Draft |

### Edicts

| ID | Requirement | Status |
|---|---|---|
| FR-10 | The catalog MUST contain at least 7 edicts across three tiers (Mild ×3+, Strong ×3+, Risky ×2+). | Draft |
| FR-11 | Mild edicts cost 1 Druckblatt and require Resistance standing >= 0. | Draft |
| FR-12 | Strong edicts cost 3 Druckblätter and require Resistance standing >= 25. | Draft |
| FR-13 | Risky edicts cost 5 Druckblätter and require Resistance standing >= 50. | Draft |
| FR-14 | Each edict MUST have a single, configured effect drawn from: damage multiplier, max-HP delta, shop price multiplier, loot rarity bias, gold drop multiplier, enemy strength multiplier, potion-disable flag. | Draft |
| FR-15 | Each edict's effect MUST persist for the duration of the next dungeon run only and clear on hub return (same scope as Brunnen buffs from #16). | Draft |
| FR-16 | At most ONE edict can be active at a time; publishing a second edict is allowed only after the first one is consumed by entering and returning from a run. | Draft |
| FR-17 | Publishing an edict MUST: deduct cost in Druckblätter, increase Council suspicion by the edict's suspicion cost, mark the edict as the active publication, and record a history entry. | Draft |

### Council Suspicion

| ID | Requirement | Status |
|---|---|---|
| FR-20 | The system MUST track an integer "Council suspicion" >= 0, persisted across runs. | Draft |
| FR-21 | Suspicion MUST decay by 1 per dungeon run completed without publishing an edict. | Draft |
| FR-22 | The player MUST be able to bribe Aldric to reduce suspicion (100 gold → -5 suspicion, capped at suspicion >= 0). | Draft |
| FR-23 | Suspicion >= 10 MUST trigger "high alert" retaliation in the next run: +1 elite enemy spawn per room, council enemy difficulty +20%. | Draft |
| FR-24 | Suspicion >= 20 MUST trigger "active hunt" retaliation: Aldric refuses to offer / progress quests; hub spawns 1 patrolling Council guard that aggros at <80px (player-killable, drops Druckblätter). | Draft |

### Progression / Visibility

| ID | Requirement | Status |
|---|---|---|
| FR-30 | The Druckerei dialog MUST be locked until the player completes the `aldric_cleanup` quest (existing). Before that, the entrance dialog says "Die Druckerei ist verschlossen". | Draft |
| FR-31 | Edicts that are tier-locked (standing too low) MUST appear in the browser as visible-but-greyed entries with the unlock requirement shown. | Draft |
| FR-32 | The Druckerei dialog MUST surface the player's current Druckblätter count, current suspicion, and the count of unlocked edicts at all times. | Draft |
| FR-33 | The publication history (last 10 entries) MUST be viewable from the Druckerei (time-of-publication, edict id, suspicion at the time). | Draft |

### Persistence

| ID | Requirement | Status |
|---|---|---|
| FR-40 | All Druckerei state (Druckblätter, suspicion, active edict, history, completed unlock checks) MUST persist under a dedicated localStorage key `demonfall_printinghouse_v1`. | Draft |
| FR-41 | Save MUST trigger on every mutation: publish, bribe, currency add, suspicion change. | Draft |
| FR-42 | Persistence schema MUST include `version: 1` for future migration compat. | Draft |

### UI / i18n

| ID | Requirement | Status |
|---|---|---|
| FR-50 | All player-facing strings MUST go through `i18n` with German primary and English secondary translations. | Draft |
| FR-51 | The edict-browser MUST be implemented within the existing HubSceneV2 dialog system (no new dialog engine). | Draft |
| FR-52 | The browser MUST render in a list with cost / effect / suspicion / lock-state per row, no scrolling required for the initial 7-edict catalog. | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|---|---|---|---|
| NFR-01 | Edict effect application at run start MUST add no measurable frame-time impact. | < 1 ms cumulative on supported hardware. | Draft |
| NFR-02 | Persisted blob MUST remain forward-compatible for one major version. | v1 blob loadable by future versions without throw / data loss. | Draft |
| NFR-03 | Druckerei dialog MUST sustain 60 fps while open. | Verified manually. | Draft |
| NFR-04 | Currency-drop hooks MUST not perceptibly slow enemy-death processing. | < 0.5 ms added per kill. | Draft |

## 6. Constraints

| ID | Constraint | Status |
|---|---|---|
| C-01 | Implementation MUST follow the codebase IIFE-on-`window` pattern. | Draft |
| C-02 | Persistence MUST use a dedicated localStorage key (separate from save, settings, tutorial, faction, brunnen). | Draft |
| C-03 | Run-scoped edict effects MUST go through `window.brunnenBuffs`-style or equivalent registry that's cleared in `leaveDungeonForHub`. Implementation may reuse the existing brunnen registry or introduce a sibling `window.printingBuffs` — design choice in plan phase. | Draft |
| C-04 | Implementation MUST NOT add a new full-screen scene. The Druckerei UI MUST live in the existing HubSceneV2 dialog framework. | Draft |
| C-05 | Implementation MUST NOT add patrol-reduction edicts — buffs go to the player (damage / HP / loot / gold), not against enemy spawn counts. (Removing enemies makes the dungeon less fun.) | Draft |
| C-06 | The module MUST expose a `_configureForTest(primitives)` test seam matching the existing pattern. | Draft |
| C-07 | When `FactionSystem` is missing, all standing-gated edicts MUST default to **locked** (fail-safe). | Draft |
| C-08 | `tutorial.druckerei.stub` i18n key from #29 MUST be removed; tutorial flow already drops the druckerei step (done in earlier commit). | Draft |

## 7. Success Criteria

| ID | Criterion |
|---|---|
| SC-01 | A player who collects 3 Druckblätter from a single dungeon run can publish a Mild edict and observe the effect (e.g. +10 max HP) in the next run. |
| SC-02 | A player with Resistance standing 28 can publish a Strong edict; a player with standing 24 sees Strong edicts greyed out with the unlock hint. |
| SC-03 | A player who publishes 4+ Strong edicts in a row sees suspicion >= 10 in the Druckerei UI and notices extra elite enemies in the next run. |
| SC-04 | Bribing Aldric for 100 gold reduces suspicion by 5 and Mara's shop / quest dialog adapt accordingly. |
| SC-05 | Active edict effect fully reverts on hub return; persisted state (Druckblätter, suspicion, history) survives across reload. |
| SC-06 | Druckerei is locked until `aldric_cleanup` is completed; pre-quest entrance shows the locked-message. |
| SC-07 | Zero console errors during a full publish → run → return cycle. |
| SC-08 | All UI renders correctly in DE and EN. |

## 8. Edge Cases

- **Player at Druckblätter cap (50)** — additional drops are silently discarded; HUD doesn't blink.
- **Player publishes a Risky edict, dies in the run** — edict is consumed; effect cleared on hub return; suspicion stays. No refund.
- **Player bribes Aldric while suspicion = 0** — gold not deducted, no-op.
- **Player has only 1 Druckblatt and clicks a Strong edict** — confirm dialog shows "insufficient". Cancellable.
- **Suspicion would go negative after decay or bribe** — clamped to 0.
- **`FactionSystem` missing on save load** — Strong / Risky edicts default to locked (graceful degradation).
- **Save with edict id unknown to current build** — silently dropped from `active` slot; warn once.
- **Player has the "Letzte Schlacht" Risky edict active and finds a potion drop** — potion appears as normal but F-key does nothing; HUD potion tile shows a "blockiert" overlay.
- **Aldric quest gate (`aldric_cleanup`) was completed in a save before this feature shipped** — Druckerei detects via `questSystem.getCompletedQuests('aldric')` and unlocks immediately on first hub entry post-update.

## 9. Key Entities

| Entity | Description |
|---|---|
| Druckblatt | Currency token. Integer >= 0, capped at 50. |
| Edict definition | `{ id, tier: 'mild'|'strong'|'risky', cost, suspicionCost, requireStanding, effect: { kind, value }, labelKey, descKey }`. Static catalog. |
| Active publication | The single currently-published edict that takes effect on the next run. Cleared after the run. |
| Suspicion | Integer >= 0, persisted. Drives retaliation tiers. |
| Publication history | Array of `{ edictId, publishedAt, suspicionAtPublish }`, capped at 10 entries (FIFO). |
| Persisted blob | `{ version: 1, druckblaetter: int, suspicion: int, active: edictId|null, history: [...] }` under `demonfall_printinghouse_v1`. |

## 10. Assumptions

- `FactionSystem.getStanding('resistance')` (from #25, done) is the unlock predicate for Strong / Risky tiers.
- `questSystem.getCompletedQuests('aldric')` returns the list of completed Aldric quests; the existence of `aldric_cleanup` in that list is the Druckerei-unlock predicate.
- Mara's shop has (or can add) a per-run price multiplier hook (similar to the one Brunnen reuses). Plan phase confirms.
- Council guards are identifiable by `enemy.factionId === 'council'` or `enemy.type === 'council_guard'`. Plan phase confirms.
- HubSceneV2 dialog system supports list-style choice menus (it does — used by quest accept/decline/info).

## 11. Out of Scope

- Edict cooldowns or charge-up timers (every edict is one-shot per publication).
- Multi-effect edicts (each edict has exactly one effect kind).
- Edict crafting / upgrading.
- Faction-locked Drucker variants (Council vs. Resistance edict catalogs).
- Story-progression-gated edict tiers beyond the standing requirement.
- Visual hub changes for active suspicion (e.g. visible patrolling Council on hub map). Patrolling Council guard for FR-24 is allowed but visual polish is out of scope.

## 12. Dependencies

- **Hard**: #25 Faction System (MVP) — `FactionSystem.getStanding('resistance')`.
- **Hard**: existing `questSystem` for the `aldric_cleanup` unlock predicate.
- **Soft**: shop price multiplier hook in `LootSystem` (added if missing during plan).
- **Affects**: Tutorial #29 (the old `tutorial.druckerei.stub` line is no longer used; safe to remove from i18n registry).

## 13. Risks

- **R-01**: Currency-drop tuning might make Druckblätter too rare (player can never publish) or too common (every run = free Strong edict). Mitigation: drop weights and cap live in a single config object so they're tunable in one edit; manual playtest before merge.
- **R-02**: Suspicion retaliation might feel punitive if the player isn't told why. Mitigation: Druckerei UI shows current suspicion + threshold for the next penalty tier; Aldric's bribe option is always available.
- **R-03**: Risky edicts (especially "no potions") might be no-ops if the player rarely uses potions anyway. Mitigation: pair the downside with the strongest buffs so the choice still feels real.
- **R-04**: Save backwards compatibility — players who completed `aldric_cleanup` before this ships need the Druckerei to unlock immediately. Mitigation: predicate runs on every hub entry, not just on quest-complete event.

## 14. References

- Issue #24 — Printing House
- Issue #25 — Faction System (MVP), `FactionSystem.getStanding`
- Issue #16 — Brunnen Rework (`window.brunnenBuffs` pattern, hub-return clearance)
- Issue #29 — Tutorial (Druckerei step removal)
- `reference/constitution.md` §Hub World, §Permanent Progression
- `js/scenes/HubSceneV2.js`, `js/scenes/hub/hubLayout.js`, `js/lootSystem.js` (Mara shop), `js/enemy.js` (council guard hooks), `js/main.js` (`leaveDungeonForHub` clearance hook), `js/inventory.js` (`recalcDerived` integration for damage/HP buffs)
- `js/eventSystem.js` — Brunnen rework for the `window.brunnenBuffs` pattern reference
