# Research: Faction System (MVP)

**Feature**: 045-faction-system-mvp
**Date**: 2026-05-02
**Plan**: [plan.md](plan.md)

## D-01 — Persistence key separation

**Decision**: `demonfall_factions_v1` under `localStorage`. Owned exclusively by `factionSystem.js`.
**Rationale**: Spec C-02; mirrors how `tutorialSystem` and `inputScheme` own dedicated keys. Replay/wipe of one module never affects another.
**Alternatives**: bundling into `demonfall_save_v1` — rejected (cross-cutting; harder to test/wipe).

## D-02 — API surface

**Decision**: `init`, `getStanding`, `adjustStanding`, `setStanding`, `getTier`, `onChange`, `_configureForTest`.
**Rationale**: Spec FR-03/05/07 + C-05. Adding `getTier` is a convenience for consumers (NPC dialog code) so they don't re-derive the tier.
**Alternatives**: callers compute tier themselves — rejected (drift risk; one place is better).

## D-03 — Tier thresholds

**Decision**: Single config object with breakpoints:
- `< -25` → `hostile`
- `[-25..+25]` → `neutral`
- `(+25..+50]` → `friendly`
- `> +50` → `allied`

**Rationale**: Spec scenarios mention "above 25" and "above 50". One config object = one edit to retune.
**Alternatives**: per-faction thresholds — rejected (out of MVP scope; identical thresholds across factions are simpler and adequate).

## D-04 — Showcase NPC for FR-09

**Decision**: Aldric (faction `council`) already at the hub. Faction-coded greeting variants:
- hostile: cold, refuses to talk in detail
- neutral: brief flavor
- friendly/allied: warm + may surface special line

**Rationale**: Aldric exists in `HUB_HITBOXES.npcs`; no new art or hitbox needed.
**Alternatives**: new NPC — rejected (asset cost; spec didn't require new NPC).

## D-05 — Showcase gated quest for FR-10

**Decision**: A Resistance-coded fetch quest with `gate(player) => FactionSystem.getStanding('resistance') >= 25`. Add a `gate` predicate field to the quest definition; existing `questSystem.getAvailableQuests` filters using it.

**Rationale**: Tightly scoped, reuses existing offer-filtering pipeline.
**Alternatives**: new quest type — rejected (the gate is the new bit, not the quest mechanics).

## D-06 — Misspelled faction id

**Decision**: `getStanding('xyz')` returns 0. `adjustStanding('xyz', n)` and `setStanding('xyz', n)` log a single `console.warn` and no-op.

**Rationale**: Spec edge case; mirrors `inputScheme.setScheme` invalid-value handling.

## D-07 — Recursive subscriber

**Decision**: Notify loop iterates a snapshot (`Array.from(subscribers)`). A subscriber that mutates inside the callback enqueues a follow-up notify which fires after the current loop completes. No bounded recursion required because mutations queue, not stack.

**Rationale**: Spec edge case; matches the `Set`-based subscriber pattern in `inputScheme.onChange` with an explicit snapshot to keep semantics deterministic.

## D-08 — Persistence migration

**Decision**: `version` field in blob. On load, if `version !== 1` or JSON is malformed, discard + start fresh. Backward compat: missing factions default to 0 (FR-08, forward-compatible for adding factions later).

**Rationale**: Same migration discipline as feature 044.

## D-09 — Test seam

**Decision**: `_configureForTest({ storage, i18n, persistence })`. Storage and i18n stubs follow the test pattern from `tests/tutorialSystem.test.js`. `persistence` allows simulating "save exists" if any future logic needs it (currently not used; included for forward-compat).

**Rationale**: Mirror tutorialSystem so the test file is structurally identical.

## D-10 — i18n key naming

**Decision**: `faction.aldric.greet.hostile|neutral|friendly|allied` for the NPC greeting variants. `faction.quest.resistance_fetch.title|desc` for the gated quest.

**Rationale**: Same `module.entity.subkey` namespacing as existing modules.

## References

- `js/inputScheme.js` — `_configureForTest`, `onChange` swallowing pattern
- `js/tutorialSystem.js` — persistence migration, IIFE, key ownership
- `js/scenes/hub/hubLayout.js` — NPC entry shape (Aldric, Branka, Mara, etc.)
- `js/questSystem.js` — `getAvailableQuests` offer pipeline
