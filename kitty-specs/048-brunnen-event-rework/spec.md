# Specification: Brunnen Event Rework

**Feature**: 048-brunnen-event-rework
**Created**: 2026-05-02
**Mission**: software-dev
**Tracker**: Issue #16
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

The current Brunnen event triggers, applies a small predictable effect (current observation: minor heal or tiny gold drop), and disappears. Players ignore it because the cost-benefit signal is flat. This rework converts the Brunnen into a meaningful choice point: each interaction offers 2–3 distinct options with clearly different risk/reward profiles, and outcomes have enough spread (buff/debuff/loot/damage) that the player remembers the encounter. The implementation reuses the existing event-system infrastructure; no new event-runtime is introduced.

## 2. Stakeholders & Actors

- **Player** — encounters the Brunnen during a dungeon run; stops, considers, picks an option, lives with the consequence.
- **Event-system** (existing in `js/eventSystem.js`) — handles trigger, dialog overlay, and effect application.
- **Stat-bonus pipeline** (`window.eventBuffs` + `recalcDerived`) — receives buffs/debuffs.

## 3. User Scenarios

### Primary: Drink → Buff outcome
1. Player approaches the Brunnen during a run; presses E.
2. Dialog presents 2–3 options: **Trinken**, **Opfern** (cost gold or HP), **Ignorieren**.
3. Player picks Trinken; weighted-random outcome (50% buff / 30% loot / 20% debuff) resolves.
4. Toast shows outcome ("Reines Wasser! +10% Schaden bis Run-Ende").
5. Brunnen visual switches to "exhausted"; cannot double-dip in the same run.

### Alternate: Sacrifice → Bigger reward
1. Player picks Opfern. Cost: -25% current HP (clamped above 1) OR -50 gold (whichever the player has more of).
2. Outcome bias shifts positive: 70% strong buff / 20% rare loot / 10% nothing.

### Alternate: Ignore
1. Player walks away; Brunnen remains usable; no effect.

### Alternate: Already-exhausted Brunnen
1. Interaction prompt suppressed; visual indicates "leer".

## 4. Functional Requirements

| ID    | Requirement                                                                                                                  | Status |
|-------|------------------------------------------------------------------------------------------------------------------------------|--------|
| FR-01 | The Brunnen interaction MUST present a localized choice dialog with 2–3 options.                                              | Draft  |
| FR-02 | **Trinken** MUST resolve to a weighted-random outcome from a defined table (buff / loot / debuff); weights documented in plan. | Draft  |
| FR-03 | **Opfern** MUST deduct the documented cost (HP or gold) and resolve to a positively-skewed outcome table.                       | Draft  |
| FR-04 | **Ignorieren** (or walking away) MUST have no effect and leave the Brunnen usable.                                              | Draft  |
| FR-05 | Each consumed Brunnen MUST become unavailable for the rest of the run (visual + interaction-prompt suppressed).                 | Draft  |
| FR-06 | Buff/debuff outcomes MUST integrate with the existing `window.eventBuffs` pipeline (negative values for debuffs).               | Draft  |
| FR-07 | Loot outcomes MUST spawn via the existing `spawnLoot` path; rarity tier configurable in the outcome table.                      | Draft  |
| FR-08 | HP-cost outcomes MUST clamp player HP above 1 (Opfern never instakills).                                                        | Draft  |
| FR-09 | All visible strings MUST be localized via `i18n` (DE primary, EN secondary).                                                    | Draft  |
| FR-10 | Outcome resolution MUST be testable in isolation: outcome table + RNG primitive injected via the existing `_configureForTest` pattern. | Draft  |

## 5. Non-Functional Requirements

| ID     | Requirement                                                          | Threshold                  | Status |
|--------|----------------------------------------------------------------------|----------------------------|--------|
| NFR-01 | Dialog open + outcome resolution MUST complete within one frame.       | < 16 ms p99.                | Draft  |
| NFR-02 | Rework MUST NOT regress existing event-system behavior.                | Existing tests still pass. | Draft  |

## 6. Constraints

| ID    | Constraint                                                                                                              | Status |
|-------|-------------------------------------------------------------------------------------------------------------------------|--------|
| C-01  | Reuse existing event-system runtime and dialog system.                                                                  | Draft  |
| C-02  | No new persistent state — exhausted flag is per-run only.                                                                | Draft  |
| C-03  | Outcome weights MUST live in a single configuration object (one place to tune).                                          | Draft  |
| C-04  | Trigger / spawn rate MUST stay the same as today's Brunnen — frequency tuning is out of scope.                            | Draft  |
| C-05  | HP-cost outcome MUST go through the existing damage pipeline so existing damage listeners (sound, particles) fire.        | Draft  |

## 7. Success Criteria

| ID    | Criterion                                                                                                                                       |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| SC-01 | Players who interact report (in playtest) that the choice "felt meaningful" — qualitative metric, validated during manual review.                |
| SC-02 | The outcome table produces all documented outcome categories within 100 simulated rolls (proven via unit test with seeded RNG).                  |
| SC-03 | An exhausted Brunnen does not re-trigger; visual state matches; interaction prompt is suppressed.                                                |
| SC-04 | All dialog strings render correctly in DE and EN.                                                                                               |
| SC-05 | Zero console errors during a 10-run smoke that exercises every option.                                                                          |

## 8. Edge Cases

- Player has 1 HP and picks Opfern (HP cost) → falls back to gold cost; if no gold, option is greyed out.
- Player has 0 gold and picks Opfern (gold cost) → falls back to HP cost; if neither possible, option is hidden.
- Debuff exceeds run length → persists until next hub return, then clears (existing `eventBuffs` semantics).
- Brunnen triggered during a buffer-frame between rooms → trigger suppressed; existing event-system already handles.
- RNG returns the same outcome 5 times in a row → expected; weighted-random is allowed to streak.

## 9. Key Entities

| Entity            | Description                                                                                  |
|-------------------|----------------------------------------------------------------------------------------------|
| Brunnen interaction | The dialog overlay invoked when the player presses E on a Brunnen.                          |
| Outcome table     | `{ optionKey: [{ weight, kind: 'buff'|'loot'|'debuff'|'damage', payload }, …] }` per option. |
| Outcome resolution | Weighted-random pick from the table for the chosen option.                                   |
| Exhausted flag    | Per-Brunnen-instance boolean; cleared at run end.                                              |

## 10. Assumptions

- The existing event-system supports adding choice dialogs (or can be extended without a rewrite).
- `window.eventBuffs` accepts negative values cleanly.
- The Brunnen visual has at least two states or a tint can mark "exhausted".

## 11. Out of Scope

- Multiple Brunnen variants (different art, different table).
- Persistent run-meta progression linked to Brunnen choices.
- Spawn-rate tuning.
- Faction-aware outcomes.

## 12. Dependencies

- Existing systems: `js/eventSystem.js`, `window.eventBuffs` + `recalcDerived`, `spawnLoot`, dialog system, `i18n`, damage pipeline.

## 13. Risks

- **R-01**: Weights need playtesting iteration. Mitigation: single config object (C-03) for fast re-balancing.
- **R-02**: Players min-max Opfern if too positive. Mitigation: tune EV close to Trinken; difference is variance.

## 14. References

- Issue #16
- `js/eventSystem.js`, `js/main.js` `recalcDerived` + `window.eventBuffs`, `js/loot.js` `spawnLoot`
