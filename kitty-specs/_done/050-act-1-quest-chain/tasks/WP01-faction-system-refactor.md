---
work_package_id: WP01
title: factionSystem 3→5 Refactor + Migration
dependencies: []
requirement_refs:
- FR-14
- FR-15
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 0fbed4afdd2ed99b1e602580927c1f07b59a785c
created_at: '2026-05-14T17:09:26.349554+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 — Engine Foundation
assignee: ''
agent: claude
shell_pid: "24256"
history:
- timestamp: '2026-05-14T17:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks-packages
authoritative_surface: js/factionSystem.js
execution_mode: code_change
lane: planned
owned_files:
- js/factionSystem.js
- js/printingHouse.js
- tests/factionSystem.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — factionSystem 3→5 Refactor + Migration

## Objective

Expand `js/factionSystem.js` from 3 standings (`council` / `resistance` / `independent`) to 5 (`magistrat` / `klerus` / `garde` / `widerstand` / `independent`). Add a `getCouncilComposite()` helper that returns the max of the 3 Council-internal standings — single migration point for callers that need "loyal to Council in general". Migrate all existing `getStanding('resistance')` callsites to `getStanding('widerstand')`. Per user direction, NO save migration — fresh standings for everyone on first load post-upgrade.

After this WP, the engine supports the 5-faction model required by WP02's quest catalog. Behavior parity for existing features (Printing-House gating, Aldric greetings) preserved via `getCouncilComposite()`.

## Context

- **Spec**: `kitty-specs/050-act-1-quest-chain/spec.md` (FR-14, FR-15, NFR-04)
- **Plan**: `kitty-specs/050-act-1-quest-chain/plan.md` §Constitution Check
- **Research**: `kitty-specs/050-act-1-quest-chain/research.md` §R-04
- **Data model**: `kitty-specs/050-act-1-quest-chain/data-model.md` §"Domain 2"
- **Existing implementation**: `js/factionSystem.js` (3-standing MVP from 045)
- **Existing tests**: `tests/factionSystem.test.js` (28 tests)
- **Callsite map**: research.md §R-04 migration table

## Subtasks

### T001 — Expand `FACTION_IDS` + state shape

`js/factionSystem.js:15`: change `var FACTION_IDS = ['council', 'resistance', 'independent'];` to `['magistrat', 'klerus', 'garde', 'widerstand', 'independent']`.

`js/factionSystem.js` `_freshState()` (`:50`): update `standings: { council: 0, resistance: 0, independent: 0 }` to `standings: { magistrat: 0, klerus: 0, garde: 0, widerstand: 0, independent: 0 }`.

No SCHEMA_VERSION bump (no save migration per user direction).

### T002 — Implement `getCouncilComposite()`

Add a new function after `getStanding`:

```js
function getCouncilComposite() {
  return Math.max(
    getStanding('magistrat'),
    getStanding('klerus'),
    getStanding('garde')
  );
}
```

Export via the API at the bottom of the module:
```js
window.FactionSystem = {
  // ... existing exports
  getCouncilComposite: getCouncilComposite,
};
```

### T003 — i18n: register new faction labels + NPC greeting tiers

Keep existing `faction.aldric.greet.*` keys as-is — Aldric IS the Magistrat face. Add new keys for Klerus / Garde / Elara greeting tiers:

For each of `klerus`, `garde`, `elara`:
- `faction.<id>.greet.hostile` (DE + EN)
- `faction.<id>.greet.neutral` (DE + EN)
- `faction.<id>.greet.friendly` (DE + EN)
- `faction.<id>.greet.allied` (DE + EN)

Plus 5 faction labels for the Faction modal:
- `faction.magistrat.label`, `faction.klerus.label`, `faction.garde.label`, `faction.widerstand.label`, `faction.independent.label` (DE + EN)

Strings draft (DE — refine in playtest):
- `faction.klerus.greet.hostile`: 'Klerus-Priester: »Deine Seele ist schon vergeben — an etwas, das du nicht überleben wirst.«'
- `faction.klerus.greet.neutral`: 'Klerus-Priester: »Die Ordnung des Kettenrats wartet auf jeden, der sie sucht.«'
- `faction.klerus.greet.friendly`: 'Klerus-Priester: »Du dienst dem Licht. Sehr gut.«'
- `faction.klerus.greet.allied`: 'Klerus-Priester: »Ein wahrer Anhänger. Tritt näher.«'
- `faction.garde.greet.hostile`: 'Wachtmeister: »Verschwinde. Du gehörst hier nicht hin.«'
- `faction.garde.greet.neutral`: 'Wachtmeister: »Halte dich an die Patrouillenrouten und es gibt keine Probleme.«'
- `faction.garde.greet.friendly`: 'Wachtmeister: »Du machst dich nützlich. Die Garde merkt sich das.«'
- `faction.garde.greet.allied`: 'Wachtmeister: »Eine Ehre. Komm, ich erkläre dir die nächste Patrouille.«'
- `faction.elara.greet.hostile`: 'Elara: »Geh. Du bist eine Gefahr für uns.«'
- `faction.elara.greet.neutral`: 'Elara: »Sei vorsichtig, wem du in dieser Stadt traust.«'
- `faction.elara.greet.friendly`: 'Elara: »Du hast Augen, die wirklich sehen. Bleib in der Nähe.«'
- `faction.elara.greet.allied`: 'Elara: »Du bist einer von uns. Komm — wir haben Pläne.«'

EN mirrors in parallel.

### T004 — Rename `'resistance'` → `'widerstand'` at all factionSystem-owned callsites

Touchpoints owned by this WP:
- `js/printingHouse.js:338` — edict-effect read. Change `getStanding('resistance')` to `getStanding('widerstand')`.
- `js/printingHouse.js:367` — second edict-effect read. Same change.

Touchpoints owned by WP02 (handled there, not here):
- `js/questSystem.js:181-182` — gate predicate. Moves to WP02's T010 (legacy-quest cleanup) since WP02 owns `questSystem.js`.

Grep before editing: `grep -rn "getStanding('resistance')" js/` — should match exactly the 3 lines above. If grep finds more outside `js/questSystem.js`, add them to this WP's rename list.

### T005 — Audit + migrate `getStanding('council')` callsites

`grep -rn "getStanding('council')" js/` — list all matches.

Per the existing 045 MVP, the most likely matches are in `js/scenes/HubSceneV2.js` (Aldric greeting tier logic). Each match either:
- Becomes `getCouncilComposite()` — for callers that need "loyal to ANY Council faction" (likely the case for Aldric greetings since Aldric is the Magistrat face but his attitude reflects general Council loyalty).
- Becomes `getStanding('magistrat')` — for callers explicitly about Aldric-as-Magistrat.

Decision per call site: read the surrounding code, pick the right replacement. Document the decision in the WP commit message ("Replaced X 'council' callsites: N → getCouncilComposite(), M → getStanding('magistrat')").

### T006 — Extend `tests/factionSystem.test.js`

Add tests covering the new shape:

1. `init()` produces all 5 standings at 0.
2. `adjustStanding('magistrat', 5)` then `getStanding('magistrat') === 5`. Mirror for klerus / garde / widerstand.
3. `getCouncilComposite()` returns 0 when no Council standing > 0.
4. `adjustStanding('magistrat', 3)` → `getCouncilComposite() === 3`.
5. `adjustStanding('klerus', 7)` after step 4 → `getCouncilComposite() === 7`.
6. `adjustStanding('garde', 1)` after step 5 → `getCouncilComposite() === 7` (max unchanged).
7. `getStanding('council')` returns 0 + warns once (unknown faction).
8. `getStanding('resistance')` returns 0 + warns once (unknown faction).

## Owned files

- `js/factionSystem.js` — FACTION_IDS, state, getCouncilComposite, i18n register
- `js/printingHouse.js` — edict-effect renames (2 lines)
- `tests/factionSystem.test.js` — extended test coverage

(`js/questSystem.js` gate predicate rename is owned by WP02 to avoid ownership overlap. Migration table in this WP's research footnote.)

## Risks

- **Hidden callsites**: anything reading the 3-letter strings `'council'` or `'resistance'` in faction context that grep misses (interpolation, dynamic IDs). Mitigation: T005 explicit grep step + commit-message audit log.
- **i18n key collisions**: existing 045 MVP registered specific keys. T003 must not double-register. Solution: existing `i18n.register()` is idempotent (overwrites duplicates safely).
- **Save load with old keys**: existing saves with `{council: 30, resistance: 0, independent: 0}` load → `_warnUnknownOnce` fires for unknown keys → standings effectively reset. Per user direction, acceptable. Tests verify warn-once behavior (T006 items 7–8).

## Independent test

After merge:
1. `node tools/runTests.js` — baseline + extended `factionSystem.test.js` green.
2. Open game, run in DevTools:
   ```js
   const fs = window.FactionSystem;
   console.log('init:', ['magistrat','klerus','garde','widerstand','independent'].map(f => [f, fs.getStanding(f)]));
   fs.adjustStanding('magistrat', 5); fs.adjustStanding('klerus', 3);
   console.log('composite:', fs.getCouncilComposite()); // expect 5
   ```
3. Verify Printing House still gates correctly: open via hub, confirm edicts that depended on `resistance` standing now respond to `widerstand` standing (use DevTools `fs.adjustStanding('widerstand', 30)` to test gate).

## Implementation command

```bash
spec-kitty implement WP01 --feature 050-act-1-quest-chain
```
