---
work_package_id: WP02
title: SurvivalMode (eigene Datei, self-registrierend) + Timed-Spawner
dependencies:
- WP01
requirement_refs:
- FR-04
- NFR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 59777fedb692e9e792820d3f83d5155161d7c6da
created_at: '2026-07-08T13:47:11.780904+00:00'
subtasks:
- T007
- T008
- T009
phase: Phase 2 - Modi
assignee: ''
agent: ''
shell_pid: "21536"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModeSurvival.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModeSurvival.js
- tests/roomModeSurvival.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP02 – SurvivalMode

## Ziel
Neue, **eigenständige** Datei `js/roomModeSurvival.js`, die sich per `window.RoomMode.register('survival', …)` selbst registriert (Script-Tag legt WP01 in `index.html` an). „Überlebe {seconds}s" mit **nachrückenden** Spawns; `isComplete()` = Timer ≤ 0; Treppe öffnet bei Timer-Ende. Modus stellt seinen HUD-State über `getState()` bereit (Rendering macht das Visuals-WP).

## Design
- Timer (Default z. B. 30 s, tiefen-skaliert) + **Timed-Spawner**: periodische Nachspawns über die bestehende Spawn-Funktion aus `wave.js` (kapseln, NICHT in `checkWaveEnd` einhängen — R2). Cap gegen Überfüllung; NFR-04 (billig).
- `objectiveFailed()` = false (Tod läuft über den normalen Death-Pfad).
- eigene i18n-Registrierung der Survival-Strings (Muster `lootSystem.js`).

## Subtasks
- **T007** `js/roomModeSurvival.js`: SurvivalMode + Self-Register + Timer + `getState()` (Restsekunden).
- **T008** Timed-Spawner-Logik (rein/zeitbasiert, testbar).
- **T009** `tests/roomModeSurvival.test.js`: Timer runter → `isComplete` bei 0; Spawn-Rate deterministisch. Browser-Smoke via `?mode=survival` (Timer sichtbar, Treppe bei 0, 0 Errors).

## Akzeptanz
- `?mode=survival`: Timer läuft, Gegner spawnen nach, Treppe bei 0; Clear-Räume unverändert; Tests grün.
