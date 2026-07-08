---
work_package_id: WP05
title: Room-Mode-Visuals (Intro-Banner, einheitliches HUD, Ziel-Marker, i18n)
dependencies:
- WP01
requirement_refs:
- FR-09
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: ef8adad27a2625cde8ed04b7ed91de99d0302288
created_at: '2026-07-08T14:03:01.866974+00:00'
subtasks:
- T017
- T018
- T019
phase: Phase 3 - Politur
assignee: ''
agent: ''
shell_pid: "43340"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModeVisuals.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModeVisuals.js
- tests/roomModeVisuals.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP05 – Room-Mode-Visuals (Feedback-Schicht)

## Ziel
Eine **eigenständige Rendering-/HUD-Schicht** `js/roomModeVisuals.js` (Muster `js/espionageVisuals.js`), die den aktiven Modus über `RoomMode`-`getState()` liest und einheitlich darstellt — ohne die testbare Modus-Logik zu berühren (R3). WP01 ruft `RoomModeVisuals.sync(scene)` im GameScene-Update auf (analog `EspionageVisuals.sync`).

## Umfang (FR-09)
- **Intro-Banner** beim Betreten eines Spezialraums („Verteidige den Altar!", „Überlebe 30 s", „Ziel: Kettenhauptmann").
- **Einheitliches Modus-HUD**: je Modus Timer / Objekt-HP-Balken / Ziel-Marker (aus `getState()`), plus Erfolgs-/Malus-Anzeige beim Abschluss.
- **DE/EN-i18n** für die generischen HUD-Rahmen (modus-spezifische Strings registrieren die Modus-Dateien selbst).

## Subtasks
- **T017** `js/roomModeVisuals.js`: `sync(scene)` (mount/unmount, stale-guard wie EspionageVisuals), Timer/HP/Marker-Rendering aus `getState()`.
- **T018** Intro-Banner + Erfolg/Malus-Einblendung; DE/EN-i18n der HUD-Rahmen.
- **T019** `tests/roomModeVisuals.test.js` (reine State→Anzeige-Logik, soweit ohne Phaser testbar) + Browser-Smokes über `?mode=survival|defend|hunt` (Banner + HUD sichtbar, 0 Errors).

## Akzeptanz
- Jeder Spezialraum kommuniziert Ziel + Fortschritt + Ausgang (Erfolg/Malus) klar; HUD einheitlich; DE/EN vollständig; 0 Errors.

## Activity Log

- 2026-07-08T14:08:28Z – unknown – shell_pid=43340 – lane=for_review – Moved to for_review
