---
work_package_id: WP01
title: Decision-Lock + Test-Gerüst (test-first)
dependencies: []
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: 31631e0ecea82e38060769d8eaac62930e4c9dc3
created_at: '2026-06-24T17:52:19.225783+00:00'
subtasks:
- T001
- T002
- T003
- T004
phase: Phase 1 - Decision-Lock & Tests
assignee: ''
agent: ''
shell_pid: "35876"
history:
- timestamp: '2026-06-24T08:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
lane: planned
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 – Decision-Lock + Test-Gerüst (test-first)

## Ziel

Die zwei offenen Design-Entscheidungen aus `spec.md` §8 fixieren und die drei
Kern-Invarianten der run-basierten Tiefe als **rote** Unit-Tests anlegen,
bevor irgendein Spiel-Code geändert wird (Constitution `test-first`).

**Decision-Lock (Default, aus spec.md §8):**
- **D1** „erfolgreicher Run" := `leaveDungeonForHub(reason: 'dungeon_complete')`
  (letzten Raum erreicht; Hook gesetzt in `roomManager.js` Z. 1035). `death`
  und `portal` zählen NICHT.
- **D2** strikt **+1** pro Abschluss; **flacher** starten bleibt erlaubt
  (Hinabstieg-Optionen), tiefer als `maxDepth` ausgeschlossen.

## Anforderungen

FR-01, FR-02, FR-03 (als Tests), Constitution `test-first`.

## Subtasks

- **T001** Decision-Lock D1/D2 in `spec.md` §8 als „entschieden" markieren
  (bzw. mit User bestätigen). Kurz-Notiz `research/decisions.md` mit den
  konkreten Hook-Punkten: `roomManager.js` Z. 1035, `main.js` Z. 1689.
- **T002** Research: bestätigen, dass `leaveDungeonForHub` der einzige
  saubere Abschluss-Punkt ist. Aufrufer/Reasons dokumentieren:
  - `roomManager.js` Z. 1034–1035 → `reason: 'dungeon_complete'`
  - `inventory.js` Z. 757–758 → `reason: 'portal'`
  - `main.js` Z. 1968–1970 → `reason: 'death'`
  Notieren, welche reasons NICHT als Abschluss zählen (`portal`, `death`).
- **T003** `tests/runBasedDepth.test.js` anlegen mit vier Invarianten:
  - (a) Tiefe bleibt über mehrere `enterRoom`/`onStairOverlap`-Zyklen
    konstant (gegen `window.DUNGEON_DEPTH`).
  - (b) `leaveDungeonForHub(reason: 'dungeon_complete')` → `MAX_DEPTH` += 1.
  - (c) `reason: 'death'` bzw. `'portal'` → `MAX_DEPTH` unverändert.
  - (d) Doppelter `dungeon_complete`-Aufruf → nur **einmal** +1 (Idempotenz).
  In den bestehenden Runner einhängen (Pattern anderer `tests/*.test.js`).
  **Erwartung: rot** (Mechanik noch nicht umgestellt).
- **T004** Baseline protokollieren: `node tools/runTests.js` + Smoke
  `node tools/testGame.js` (Server :3456) — kein bestehender Test darf durch
  das neue Test-Gerüst brechen.

## Independent Test

`node tools/runTests.js` läuft; `tests/runBasedDepth.test.js` existiert und
schlägt erwartbar fehl (rot). Alle vorbestehenden Tests bleiben grün.

## Hinweise

- KEIN Spiel-Code in diesem WP ändern — nur Tests + Doku.
- Test-Setup muss `window.DUNGEON_DEPTH`/`localStorage`-Stubs sauber
  zurücksetzen (siehe bestehende Tests für das jsdom/Stub-Pattern).

## Activity Log

- 2026-06-24T17:54:34Z – unknown – shell_pid=35876 – lane=approved – Moved to approved
- 2026-06-24T17:54:50Z – unknown – shell_pid=35876 – lane=done – Done override: Manual merge; test-first red scaffold, baseline 340 green
