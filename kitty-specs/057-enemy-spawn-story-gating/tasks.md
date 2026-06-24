# Tasks: Enemy-Spawn Story-Gating

**Feature**: 057-enemy-spawn-story-gating
**Generated**: 2026-06-24
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Akt-Roster-Gating (Filter-Modul + Tests + Verdrahtung) | 6 (T001–T006) | ~180 | none | — |

**Total**: 6 Subtasks über 1 WP.

**Ship-Reihenfolge**: WP01 ist allein vollständig shippbar (kleines Feature):
reines Filter-Modul + Tests zuerst (test-first), dann Verdrahtung in
`spawnEnemy` + `index.html`.

**Constitution-Gate**: `test-first` (DIRECTIVE TEST_FIRST) — die reine
`getAvailableEnemyTypes`-Logik (Mapping, „nie leer", Tiefen-Identität,
defensive Defaults) wird als Unit-Test VOR der Verdrahtung geschrieben.

---

## Phase 1 — Akt-Roster-Gating

### WP01: Akt-Roster-Gating (Filter-Modul + Tests + Verdrahtung)

**Goal**: Spawn-Gating zusätzlich an `currentActIndex` koppeln, ohne das
Tiefen-Gating (Mindest-Floor) oder explizite Spawns zu verändern, mit
garantiert nie-leerem Roster. **Depends on**: none. **Requirements**: FR-01–08,
NFR-01–03, C-01–05, SC-01–06.

**Independent test**: `node tools/runTests.js` grün inkl. neuem
`tests/enemySpawnGating.test.js`; Smoke (`node tools/testGame.js`) lädt ohne
Konsolen-Fehler; in Akt 0/1 auf Tiefe 9 spawnen keine Typen 5/6/7.

**Subtasks**:
- [x] **T001** (test-first) `tests/enemySpawnGating.test.js` schreiben (lädt `js/enemySpawnGating.js` via `loadGameModule`, Vorlage `tests/eliteEnemies.test.js`): assert `ENEMY_MIN_ACT`-Shape (Keys 1–10, Werte 0–6 gemäß Roster↔Akt-Tabelle §4.1); `getAvailableEnemyTypes(depth, actIndex)` filtert korrekt (z.B. depth=9,act=0 → ohne 5/6/7; depth=9,act=4 → mit 6/7); **„nie leer"**-Test über alle `depth ∈ {1..12}` × `actIndex ∈ {0..6}` (jedes Ergebnis nicht-leer, Array von Zahlen 1–10); **Tiefen-Identität** bei `actIndex >= 6` == heutiges reines Tiefen-Roster; defensive Defaults (`depth` undefiniert → wie depth=1; `actIndex` außerhalb 0–6 → geclamped, kein Crash). Tests rot (Modul fehlt noch).
- [x] **T002** `js/enemySpawnGating.js` als IIFE anlegen (`window.EnemySpawnGating`): `DEPTH_TIERS` (1:1 aus heutiger `js/enemy.js` Z. 335–345: `depth<=2 → [8,9,10]`, `<=4 → [8,9,10,1,2]`, `<=6 → [1,2,3,4]`, `<=8 → [1,2,3,4,5]`, sonst `[1..7]`) als reine Helferfunktion `depthRoster(depth)`; `ENEMY_MIN_ACT = {1:0,2:1,3:1,4:2,5:3,6:4,7:4,8:0,9:0,10:0}`.
- [x] **T003** `getAvailableEnemyTypes(depth, actIndex)` implementieren: `roster = depthRoster(depth)`; clamp `actIndex` auf 0–6 (NaN/undefiniert → 6 = „voll", FR-06); `filtered = roster.filter(t => ENEMY_MIN_ACT[t] <= actIndex)`; **Fallback (FR-04)**: ist `filtered` leer → niedrigsten tiefen-erlaubten akt-freien Typ wählen, ersatzweise `[8]` (Rat); nie `[]`/`undefined` zurückgeben. T001-Tests grün machen.
- [x] **T004** `js/enemy.js` `spawnEnemy` (Z. 328–347) verdrahten: random-Pfad (kein expliziter `enemyType`) liest Akt defensiv `var actIdx = (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function') ? window.storySystem.getCurrentActIndex() : 6;` und ersetzt die inline-`if`-Kette durch `var availableTypes = (window.EnemySpawnGating && window.EnemySpawnGating.getAvailableEnemyTypes) ? window.EnemySpawnGating.getAvailableEnemyTypes(depth, actIdx) : <heutige inline-Kette als Fallback>;`. Expliziter-Typ-Pfad (FR-05) und `Phaser.Math.Between`-Pick unverändert.
- [x] **T005** `index.html`: `<script src="js/enemySpawnGating.js"></script>` VOR `js/enemy.js` einhängen (FR-08), sodass `window.EnemySpawnGating` zur Spawn-Zeit existiert.
- [x] **T006** Verifikation: `node tools/runTests.js` (alle Tests + neue grün, Baseline nicht regredieren); Smoke `node tools/testGame.js` ohne Konsolen-Fehler; manuell/Log prüfen: Akt 0/1 + Tiefe 9 → keine 5/6/7; voll-Akt + Tiefe 9 → volles Roster (FR-07). SC-01..06 abhaken.
