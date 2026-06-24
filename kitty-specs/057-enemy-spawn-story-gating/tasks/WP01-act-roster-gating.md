---
work_package_id: WP01
title: Akt-Roster-Gating (Filter-Modul + Tests + Verdrahtung)
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-08
- NFR-01
- NFR-02
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 3197a090600e7fe970b0c4daf2cf7ed983bd56fe
created_at: '2026-06-24T12:47:34.818381+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 — Akt-Roster-Gating
assignee: ''
agent: ''
shell_pid: "45372"
history:
- timestamp: '2026-06-24T08:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: js/enemySpawnGating.js
execution_mode: code_change
lane: planned
owned_files:
- js/enemySpawnGating.js
- js/enemy.js
- index.html
- tests/enemySpawnGating.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — Akt-Roster-Gating (Filter-Modul + Tests + Verdrahtung)

## Objective

Das Gegner-Spawn-Roster zusätzlich an den Story-Akt (`storySystem.getCurrentActIndex()`)
koppeln, ohne das bestehende Tiefen-Gating (Mindest-Floor) oder explizit
angeforderte Spawns zu verändern — mit der harten Garantie, dass das gefilterte
Roster **nie leer** ist. Die Filter-Logik wird in ein neues, Phaser-freies
IIFE-Modul `js/enemySpawnGating.js` extrahiert und **test-first** abgesichert;
`spawnEnemy` ruft es statt der heutigen inline-`if`-Kette.

## Context

- **Spec**: `kitty-specs/057-enemy-spawn-story-gating/spec.md` (FR-01–08, §4.1 Roster↔Akt-Mapping, SC-01–06)
- **Plan**: `kitty-specs/057-enemy-spawn-story-gating/plan.md` (§Project Structure, §Constitution Check)
- **Tasks**: `kitty-specs/057-enemy-spawn-story-gating/tasks.md` (T001–T006)

### Verifizierte Code-Stellen
- `js/enemy.js` `spawnEnemy`, Tiefen-Roster **Z. 328–347** (inline-`if`-Kette
  über `window.DUNGEON_DEPTH`). Heutige Tiefen-Tiers (1:1 übernehmen als Floor):
  - `depth <= 2` → `[8,9,10]`
  - `depth <= 4` → `[8,9,10,1,2]`
  - `depth <= 6` → `[1,2,3,4]`
  - `depth <= 8` → `[1,2,3,4,5]`
  - sonst → `[1,2,3,4,5,6,7]`
- `js/storySystem.js`: `getCurrentActIndex()` **Z. 518–520**, exportiert auf
  `window.storySystem` **Z. 1082–1102**; `STORY_ACTS` **Z. 7–14** (Indizes 0–6:
  auftrag, treuer_diener, erste_risse, wahrheit, bruch, rebellion, offenbarung).
  **Read-only** verwenden — NICHT verändern.
- `tests/eliteEnemies.test.js` — Vorlage für reine-Logik-Unit-Tests
  (`loadGameModule`, `node:test`).

### Gegnertyp-Legende
1=Imp, 2=Archer, 3=Brute, 4=Mage, 5=Shadow, 6=ChainGuard, 7=FlameWeaver,
8=Rat, 9=Bat, 10=Wolf.

## Constitution Gate: TEST_FIRST

T001 (Tests) wird VOR T002–T004 (Implementierung/Verdrahtung) geschrieben und
muss zunächst rot sein. Pflicht-Test: „Roster nie leer" über alle
`depth ∈ {1..12}` × `actIndex ∈ {0..6}`.

## Subtasks

- [x] **T001** (test-first) `tests/enemySpawnGating.test.js` anlegen (lädt
  `js/enemySpawnGating.js` via `loadGameModule`, Stil wie `eliteEnemies.test.js`):
  - `ENEMY_MIN_ACT`-Shape: Keys 1–10, Werte exakt `{1:0,2:1,3:1,4:2,5:3,6:4,7:4,8:0,9:0,10:0}` (§4.1).
  - Filter-Korrektheit: `getAvailableEnemyTypes(9, 0)` enthält **nicht** 5/6/7; `getAvailableEnemyTypes(9, 3)` enthält 5 aber nicht 6/7; `getAvailableEnemyTypes(9, 4)` enthält 6 und 7.
  - **„Nie leer"** (FR-04): für jedes `depth ∈ {1..12}` × `actIndex ∈ {0..6}` ist das Ergebnis ein nicht-leeres Array von Zahlen ∈ {1..10}.
  - **Tiefen-Identität** (FR-07): für `actIndex = 6` ist das Ergebnis je Tiefe gleich dem reinen Tiefen-Roster (Tiers oben).
  - Defensive Defaults (FR-06): `depth` undefiniert → wie `depth=1`; `actIndex` NaN/undefiniert/außerhalb 0–6 → geclamped (undefiniert/NaN → „voll" = 6), kein Throw.
- [x] **T002** `js/enemySpawnGating.js` als IIFE → `window.EnemySpawnGating` anlegen:
  - reine Helferfunktion `depthRoster(depth)` mit den 5 Tiers (1:1 aus `enemy.js` Z. 335–345; `depth` Default 1).
  - `ENEMY_MIN_ACT = {1:0,2:1,3:1,4:2,5:3,6:4,7:4,8:0,9:0,10:0}`.
- [x] **T003** `getAvailableEnemyTypes(depth, actIndex)` implementieren (rein,
  seiteneffektfrei): `roster = depthRoster(depth)`; `actIndex` clampen auf 0–6
  (NaN/undefiniert → 6 = „voll", FR-06); `filtered = roster.filter(t => ENEMY_MIN_ACT[t] <= actIndex)`;
  **Fallback (FR-04)**: ist `filtered` leer → niedrigsten akt-freien Typ aus
  `roster` nehmen, sonst `[8]` (Rat). Immer nicht-leeres Array zurückgeben.
  T001-Tests grün machen.
- [x] **T004** `js/enemy.js` `spawnEnemy` (Z. 328–347) verdrahten: im
  random-Pfad (kein gültiger expliziter `enemyType`) den Akt defensiv lesen
  (`window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function' ? ... : 6`)
  und die inline-`if`-Kette ersetzen durch
  `window.EnemySpawnGating.getAvailableEnemyTypes(depth, actIdx)` — mit
  defensivem Fallback auf die bisherige inline-Kette, falls
  `window.EnemySpawnGating` fehlt. **Explizit-Typ-Pfad (FR-05) und das
  `Phaser.Math.Between`-Picken unverändert lassen.**
- [x] **T005** `index.html`: `<script src="js/enemySpawnGating.js"></script>`
  **vor** `js/enemy.js` einhängen (FR-08).
- [x] **T006** Verifikation: `node tools/runTests.js` (Baseline + neue Tests
  grün, keine Regression); Smoke `node tools/testGame.js` (Server :3456) ohne
  Konsolen-Fehler. Stichprobe: Akt 0/1 + Tiefe 9 → keine 5/6/7; voll-Akt +
  Tiefe 9 → volles Roster. SC-01..06 abhaken.

## Acceptance / Independent Test

- `node tools/runTests.js` grün inkl. `tests/enemySpawnGating.test.js`
  (Mapping-Shape, Filter, „nie leer", Tiefen-Identität, defensive Defaults).
- Smoke lädt ohne Konsolen-Fehler; `window.EnemySpawnGating` existiert.
- In Akt 0/1 auf Tiefe 9 spawnen keine Typen 5/6/7; bei voll-Akt identisch zum
  heutigen Tiefen-Roster.
- Explizit angeforderter `enemyType` unverändert; fehlendes `storySystem`
  führt nicht zum Crash und spawnt wie ohne Feature.

## Out of Scope

- Änderung der Tiefen-Floors, der Story-Progression/`advanceToAct`, oder des
  Save-Formats. Keine neuen Gegnertypen/Balance. Kein Quest-feines Gating
  (nur akt-grob über `currentActIndex`).

## Activity Log

- 2026-06-24T12:47:43Z – unknown – shell_pid=45372 – lane=in_progress – Moved to in_progress
- 2026-06-24T12:51:46Z – unknown – shell_pid=45372 – lane=for_review – Moved to for_review
- 2026-06-24T12:53:14Z – unknown – shell_pid=45372 – lane=approved – Selbst-Review ok, 310 Tests gruen auf main.
