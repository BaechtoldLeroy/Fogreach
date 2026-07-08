---
work_package_id: WP01
title: Framework + Integration + ClearMode + Modus-Auswahl + Bonus-Chest
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-07
- FR-08
- FR-10
- NFR-01
- NFR-02
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: c3a104fc8f3900ecaafcd94e4571611143f11026
created_at: '2026-07-08T13:17:10.840134+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Foundation
assignee: ''
agent: ''
shell_pid: "71716"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModes.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModes.js
- js/roomManager.js
- js/wave.js
- js/main.js
- index.html
- tests/roomModes.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 – Framework + Integration + ClearMode + Auswahl + Bonus-Chest

## Ziel
Die **komplette geteilte Plumbing-Schicht** in einem WP (damit die Modus-WPs danach je EINE neue, disjunkte Datei anlegen). Umfasst: `js/roomModes.js` (Registry + Interface + `ClearMode` + Auswahl-Logik), die Integration in `roomManager`/`wave`/`main`, den `?mode=`-Force-Hook, und die Bonus-Chest-Belohnung. **Mit nur `clear` registriert ist das Spiel verhaltensidentisch zu heute (NFR-01).**

## Interface
```
RoomMode.register(modeId, factory)
RoomMode.create(modeId, ctx) -> { start(scene,ctx), update(dt), isComplete(), objectiveFailed(), getState() }
RoomMode.selectForRoom({ roomIndex, isBoss, isEspionage, depth, rng }) -> modeId   // rein/testbar
```
- `ClearMode`: `isComplete()` = alte Wave-Clear-Bedingung; `objectiveFailed()` = false.
- Fremd-Modi (survival/defend/hunt/escape) registrieren sich SELBST aus ihrer eigenen Datei (spätere WPs). WP01 legt in `index.html` bereits die `<script>`-Tags für diese Dateien an (fehlt die Datei noch, fällt die Auswahl defensiv auf `clear` zurück).

## Auswahl (Entscheidungen #2/#3)
- ~1–2 Spezialräume/Run, tiefen-skaliert; **erster Raum = `clear`**, **Boss = `clear`**, **Espionage unangetastet**. Gewichte als tunebare Config.
- Bonus-Chest: bei Spezialraum-Abschluss mit `!objectiveFailed()` → garantierter Chest (bestehender Reward-Pfad); sonst keiner.

## Subtasks
- **T001** `js/roomModes.js`: Registry + Interface + defensive `create`/`selectForRoom` (unknown → `clear`).
- **T002** `ClearMode` (kapselt die bestehende Wave-Clear-Logik, keine Duplizierung).
- **T003** `roomManager.enterRoom`: Modus wählen (`selectForRoom`, Force-Hook hat Vorrang), `mode.start()`, Treppe via `mode.isComplete()` (Entkopplung von Wave-Clear); `_espionageRoom`-Sonderweg bleibt.
- **T004** `main.js`: `mode.update(dt)` im GameScene-Update (defensiv try/catch, Muster `EspionageVisuals.sync`).
- **T005** Bonus-Chest im `markRoomCleared`-Pfad (nur Spezialmodus + `!objectiveFailed`); `?mode=<id>`-Force-Hook; `index.html` Script-Tags (`roomModes.js` + Platzhalter für Modus-Dateien) + `?v=`-Bumps.
- **T006** `tests/roomModes.test.js`: Registry, ClearMode-Äquivalenz, `selectForRoom`-Verteilung (~1–2/Run, erster/Boss=`clear`, Espionage aus), Bonus-Chest-Bedingung.

## Akzeptanz
- Nur-`clear`-Runs verhaltensidentisch zu heute; alle Bestandstests grün (`node tools/runTests.js`).
- Kernlogik Phaser-frei testbar (NFR-02); Hooks defensiv (NFR-03).
- Browser-Smoke: normaler Run bootet, Räume clearen wie gehabt, 0 Errors.
