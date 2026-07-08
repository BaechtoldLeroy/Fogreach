---
work_package_id: WP03
title: DefendMode (eigene Datei) + Gegner-Targeting eines Objekts
dependencies:
- WP01
requirement_refs:
- FR-05
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 25876ab00899e3437e29b86f55302435c867c885
created_at: '2026-07-08T13:53:48.464837+00:00'
subtasks:
- T010
- T011
- T012
- T013
phase: Phase 2 - Modi
assignee: ''
agent: ''
shell_pid: "26824"
history:
- timestamp: '2026-07-08T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/roomModeDefend.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomModeDefend.js
- tests/roomModeDefend.test.js
- js/enemy.js
- research.md
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP03 – DefendMode

## Ziel
Eigenständige Datei `js/roomModeDefend.js` (self-registrierend als `defend`). Ein zerstörbares Objekt (Altar/Relikt) mit HP; Gegner steuern es an und beschädigen es. Erfolg = Welle geclleart bei lebendem Objekt; Objekt zerstört = `objectiveFailed` (Raum bleibt **trotzdem offen**, Entscheidung #1 → WP01 vergibt dann keinen Bonus-Chest). HUD-State (Objekt-HP) via `getState()`.

## Research (R1) — ZUERST
KI-Ziel-Wahl in `js/enemy.js` (+ `ai/steering.js`) analysieren: Kann ein Override auf einen Objekt-Punkt gesetzt werden? Ergebnis + Ansatz in `research.md`. **Fallback**: simpler „move-to-point"-Override nur für Gegner in Defend-Räumen. (Nur `enemy.js` gehört diesem WP — `ai/steering.js` nur lesen; falls Änderung nötig, minimal in `enemy.js` kapseln.)

## Subtasks
- **T010** (R1) KI-Analyse + Ansatz → `research.md`.
- **T011** `js/roomModeDefend.js`: Objekt-Datenmodell (HP) + Spawn (Sprite via Szene) + `DefendMode` (`isComplete` = Welle clear; `objectiveFailed` = HP≤0; `getState` = Objekt-HP).
- **T012** `js/enemy.js`: optionales Nicht-Spieler-Ziel (Gegner steuern das Defend-Objekt an + Nahkampf-Schaden am Objekt) — minimal, hinter einem Flag, das nur im Defend-Modus aktiv ist.
- **T013** `tests/roomModeDefend.test.js`: Objekt-HP sinkt; `objectiveFailed` bei 0; `isComplete` unabhängig vom Objekt. Browser-Smoke `?mode=defend`.

## Akzeptanz
- Gegner greifen das Objekt an, HP sinkt; Zerstörung → Raum trotzdem passierbar (`objectiveFailed=true`). Tests grün; 0 Errors.

## Activity Log

- 2026-07-08T13:58:15Z – unknown – shell_pid=26824 – lane=for_review – Moved to for_review
