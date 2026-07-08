---
work_package_id: WP06
title: (optional) EscapeMode (eigene Datei)
dependencies:
- WP01
requirement_refs:
- FR-11
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: b661ff5ff6999bbc6036303c2e0b2eec079fad75
created_at: '2026-07-08T14:08:38.649828+00:00'
subtasks:
- T020
- T021
phase: Phase 4 - Optional
assignee: ''
agent: ''
shell_pid: "34528"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModeEscape.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModeEscape.js
- tests/roomModeEscape.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP06 – EscapeMode (optional/Stretch)

## Ziel
Optionale, eigenständige Datei `js/roomModeEscape.js` (self-registrierend als `escape`): den Ausgang **unter Dauer-Druck** erreichen statt „alles töten". Treppe von Anfang an offen; der Weg steht unter Druck (Nachspawns/Zeit). `isComplete()` = Ausgang erreicht; `objectiveFailed()` = false. Nur bauen, wenn WP01–WP05 rund sind.

## Subtasks
- **T020** `js/roomModeEscape.js`: EscapeMode + Self-Register; Druck-Spawns (Zeit-/Nachspawn-Logik, ggf. Muster aus WP02); Abschluss bei Ausgang-Erreichen.
- **T021** `tests/roomModeEscape.test.js` + Browser-Smoke `?mode=escape` (Druck vorhanden, Ausgang schließt ab, 0 Errors).

## Akzeptanz
- Ausgang erreichen schließt den Raum ab; kontinuierlicher Druck; Tests grün; 0 Errors.

## Activity Log

- 2026-07-08T14:13:19Z – unknown – shell_pid=34528 – lane=for_review – Moved to for_review
- 2026-07-08T14:13:23Z – unknown – shell_pid=34528 – lane=approved – reviewed
