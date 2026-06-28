---
work_package_id: WP01
title: Foundation - skillTree.js (Punkte/Ränge/Prereqs/Synergie-Daten/Respec-Logik) + Level-Up-Hook + Tests
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-11
- NFR-01
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: a462372c0f79e3d51203c9c46d80da2399618e81
created_at: '2026-06-28T11:01:50.509967+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
phase: Phase 1 - Foundation
assignee: ''
agent: "claude"
shell_pid: "48556"
history:
- timestamp: '2026-06-28T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/skillTree.js
execution_mode: code_change
lane: planned
owned_files:
- js/skillTree.js
- tests/skillTree.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 – Foundation: `skillTree.js` + Punkte + Level-Up-Hook

## Ziel
Ein **pures, unit-testbares** Kernmodul `js/skillTree.js` (IIFE → `window.SkillTree`,
Vorbild `js/knowledgeTree.js`): EIN Skill-Baum als Datenmodell, Skill-Punkte,
Ränge, Investieren mit Voraussetzungen/Cap, Synergie-Werte, Respec-**Logik** (ohne
Gold). Plus: jeder Level-Up vergibt **+1 Skill-Punkt**. Keine UI, keine
Combat-Effekte (WP02), kein Gold (WP05).

## Requirements
FR-01 (Punkte 1/Level), FR-02 (Datenmodell, 1 Baum), FR-03 (investPoint mit Validierung), FR-11 (Persistenz-Form, Kern), NFR-01 (testbar).

## Kontext / Code-Anker
- `js/knowledgeTree.js` — Vorbild: IIFE-Modul, State, Ränge, `addFragments`/Respec, `getStorySaveData`/Load-Muster, Export-Objekt.
- `js/abilitySystem.js` — `ABILITY_DEFS` (Quelle der Ability-IDs für die Knoten), `tryActivate`, Persistenz `demonfall_abilities_v1`.
- Level-Up: `js/player.js`/`js/main.js` — `playerLevel`, `playerXP`, `getNeededXP`/`neededXP` (≈`2*level`); die Stelle, an der XP überläuft und `playerLevel` erhöht wird.
- `js/persistence.js` — `Persistence.KEYS` (neuen Key für Skill-State nur falls nötig; bevorzugt in den bestehenden Haupt-Save, finalisiert in WP05).

## Subtasks
- **T001** `js/skillTree.js` als IIFE anlegen (`window.SkillTree`). State: `{ skillPoints: 0, ranks: {} }` + `_init()`/Reset. In `index.html` nach `knowledgeTree.js`/`abilitySystem.js` einbinden.
- **T002** `SKILL_TREE`-Datenmodell (Object.freeze): `nodes` = Map `id → { abilityId, maxRank, requires: { minLevel?, node?, rank? }, synergies: [{ from, perRank, stat }] }`. Knoten aus den vorhandenen `ABILITY_DEFS` ableiten (Platzhalter-Topologie + 1–2 Synergie-Paare; finale Balance in WP02). Quelle der Wahrheit, rein lesbar.
- **T003** Getter: `getSkillPoints()`, `getSpentPoints()`, `getRank(nodeId)`, `getNode(nodeId)`, `getAllNodes()`, `isNodeAvailable(nodeId, playerLevel)` (prüft `minLevel` + Vorgänger-`node@rank`).
- **T004** `grantSkillPoint(n=1)` (+Punkte, persist) und `investPoint(nodeId, playerLevel)`: erhöht Rang um 1, nur wenn (a) `skillPoints > 0`, (b) `isNodeAvailable`, (c) `rank < maxRank`; zieht 1 Punkt ab; sonst no-op + `false`. Rückgabe boolean.
- **T005** `getSynergyValue(nodeId, stat)` — summiert Synergie-Beiträge (`from`-Rang × `perRank`) für eine Kennzahl (von WP02 genutzt). `respec()`: alle Ränge → 0, alle investierten Punkte zurück nach `skillPoints` (reine Logik, **Gold-Kosten in WP05**). Rückgabe Anzahl erstatteter Punkte.
- **T006** Level-Up-Hook: an der Level-Up-Stelle (`player.js`/`main.js`) defensiv `window.SkillTree && SkillTree.grantSkillPoint()` aufrufen (genau 1 Punkt pro Level). Persistenz-Form festlegen: `getSaveData()`/`loadSaveData()` (skillPoints + ranks) — Anbindung an Haupt-Save erfolgt in WP05, hier mindestens eigenes localStorage ODER vorbereitete Hooks.
- **T007** `tests/skillTree.test.js` (test-first wo möglich): (a) `grantSkillPoint` erhöht Punkte; (b) `investPoint` ohne erfüllte Prereqs/ohne Punkte → false, kein Rang; (c) mit erfüllten Prereqs → Rang+1, Punkt−1; (d) Cap bei `maxRank`; (e) `respec` setzt Ränge=0 + erstattet Punkte; (f) `getSynergyValue` rechnet `from`-Rang × `perRank`; (g) `isNodeAvailable` respektiert minLevel + Vorgänger. `node tools/runTests.js` insgesamt grün.

## Independent Test
`node tools/runTests.js` grün inkl. `tests/skillTree.test.js`. Modul ist ohne Phaser ladbar (`tests/loadGameModule.js`).

## Done-Kriterien
- `window.SkillTree` mit getesteter Punkte-/Rang-/Prereqs-/Synergie-/Respec-Logik.
- Level-Up vergibt nachweisbar +1 Punkt.
- Keine UI/Combat/Gold-Kopplung (folgt in WP02/04/05). Keine Regression.

## Activity Log
- 2026-06-28T11:09:26Z – claude – shell_pid=48556 – lane=in_progress – Moved to in_progress
