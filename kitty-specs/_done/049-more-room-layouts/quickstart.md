# Quickstart: More Room Layouts

**Feature**: 049-more-room-layouts
**Date**: 2026-05-14

This is the end-to-end smoke check after the templates land.

## Prereqs

- Local checkout on `main` with the feature merged.
- Node 18+ available (for `tools/runTests.js`).
- Either `npx serve` or any static file server to host the game.

## 1. Unit tests pass

```bash
node tools/runTests.js
```

Expect: baseline ~188 tests grow by N (one per new template), all green. Failures here indicate a broken template JSON (border, legend, reachability).

## 2. Boot the game and reach the dungeon

```bash
npx serve .
# Open http://localhost:3000 (or whichever port serve picks)
```

1. Open DevTools console — confirm zero `[RoomTemplates] Missing texture` warnings for the new templates.
2. Run `console.log(Object.keys(window.RoomTemplates.TEMPLATES).filter(n => ['CorridorLong','CorridorBranch','PillarHall','AsymmetricChamber','TerracedHall','DoubleAlcove'].includes(n)))` — expect all six (or whichever N landed) listed.
3. Run `console.log(window.RoomTemplates.MANIFEST.length)` — expect old count + N.

## 3. Walk through a fresh run

1. Start a New Game from the start screen.
2. Walk through the first 10 procedural rooms (skip story-gated ones).
3. Note which templates appeared — record on paper or via `console.log(window.currentScene?.activeTemplateName)` in DevTools after each room transition.

**Acceptance**: across 10 rooms, ≥ 7 distinct templates appear (SC-02). At least one corridor variant, one pillared hall, one asymmetric chamber, one tiered hall should appear across 3 runs of 10 rooms each.

## 4. Spot-check per-template

For each new template, force it via DevTools and verify:

```js
// Force-load a specific template in the next room transition
window.__forceNextTemplate = 'PillarHall';
// then trigger a room change (walk through a door)
```

(If `__forceNextTemplate` is not exposed, simply replay runs until the template appears; expect ≤ 4 retries given the enlarged pool.)

Verify per template:
- Player spawns on a floor tile, not inside an obstacle.
- All entrances are walkable.
- Loot tiles (if any) are reachable.
- No visible texture-missing warnings in the console.
- Layout feels visually distinct from existing rooms (subjective — SC-04).

## 5. Confirm no regression

```bash
node tools/runTests.js
```

Re-run the full suite. Expect zero failures in pre-existing tests (`abilitySystem`, `eliteEnemies`, `printingHouse`, `knowledgeTree`, etc.) — SC-03.

## Done criteria

- [ ] `node tools/runTests.js` green, including new per-template assertions.
- [ ] 10-room walkthrough shows ≥ 7 distinct templates (SC-02).
- [ ] Each new template playtested manually with no visual or reachability issues (SC-04).
- [ ] Zero console errors during the walkthrough (SC-01, SC-03).
