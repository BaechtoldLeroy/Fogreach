---
work_package_id: WP04
title: HuntMode (eigene Datei) + markiertes Ziel
dependencies:
- WP01
requirement_refs:
- FR-06
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 667f666ad3bbbbba2276d77b3f3e81626a5b62c4
created_at: '2026-07-08T13:58:29.363531+00:00'
subtasks:
- T014
- T015
- T016
phase: Phase 2 - Modi
assignee: ''
agent: ''
shell_pid: "50612"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModeHunt.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModeHunt.js
- tests/roomModeHunt.test.js
- js/eliteEnemies.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP04 – HuntMode

## Ziel
Eigenständige Datei `js/roomModeHunt.js` (self-registrierend als `hunt`). Unter dem Trash gibt es **ein markiertes Ziel** (Elite). Kill des Ziels schließt den Raum ab — unabhängig vom restlichen Trash. `objectiveFailed()` = false (kein Verfehlen). HUD-State (Ziel-Name/Position) via `getState()`.

## Design
- Nutzt das bestehende Elite-System (`js/eliteEnemies.js`) — kein neuer Gegnertyp. Beim Spawn wird ein Elite als `isHuntTarget` geflaggt.
- `isComplete()` = Ziel tot. Ziel-Marker-Rendering macht das Visuals-WP (WP05) aus `getState()`.
- eigene i18n-Registrierung („Ziel: {name}").

## Subtasks
- **T014** `js/roomModeHunt.js`: HuntMode + Self-Register + `getState()` (Ziel-Ref/Position).
- **T015** `js/eliteEnemies.js`: Flag/Helper, um einen Elite als Hunt-Ziel zu markieren + Kill-Erkennung.
- **T016** `tests/roomModeHunt.test.js`: Ziel-Flag; Kill des Ziels → `isComplete` true bei lebendem Trash. Browser-Smoke `?mode=hunt`.

## Akzeptanz
- Ziel markiert; Kill öffnet die Treppe unabhängig vom Rest; `objectiveFailed` immer false. Tests grün; 0 Errors.

## Activity Log

- 2026-07-08T14:02:50Z – unknown – shell_pid=50612 – lane=for_review – Moved to for_review
- 2026-07-08T14:02:54Z – unknown – shell_pid=50612 – lane=approved – reviewed
