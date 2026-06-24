---
work_package_id: WP02
title: Per-Raum-Increment entfernen (Tiefe run-konstant)
dependencies:
- WP01
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: eac07a8d9c3dff280ebd1bde02e5eeb47d7edbfb
created_at: '2026-06-24T17:54:59.286826+00:00'
subtasks:
- T005
- T006
- T007
- T008
phase: Phase 2 - Tiefe run-konstant
assignee: ''
agent: ''
shell_pid: "7672"
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

# Work Package Prompt: WP02 – Per-Raum-Increment entfernen

## Ziel

`window.DUNGEON_DEPTH` während eines **regulären** Runs konstant halten. Der
Per-Raum-Increment beim Raumwechsel entfällt; jeder Raum eines Runs läuft auf
der Run-Start-Tiefe. Der Endless-Mode-Pfad bleibt unberührt.

## Anforderungen

FR-01, FR-08, SC-01.

## Subtasks

- **T005** `js/roomManager.js` `onStairOverlap` (Z. 1040–1047): Der
  `depthBase`-Block setzt heute `window.SELECTED_WAVE_OVERRIDE` auf
  `NEXT_DUNGEON_DEPTH` (= Tiefe+1) und treibt damit das Per-Raum-Klettern.
  Für den **regulären** Übergang (NICHT der Endless-Zweig Z. 1008–1032) so
  ändern, dass die Run-Start-Tiefe beibehalten wird (kein +1) — z.B.
  `SELECTED_WAVE_OVERRIDE = window.DUNGEON_DEPTH` oder den Override ganz
  weglassen, sodass `enterRoom` `savedDepth` nutzt.
- **T006** `js/roomManager.js` `markRoomCleared` (Z. 1142–1149): das
  per-Raum `window.DUNGEON_DEPTH = completed` / `NEXT_DUNGEON_DEPTH =
  completed+1` und den `maxDepth`-`localStorage.setItem` (Z. 1148–1149)
  entfernen. Der `maxDepth`-Bump wandert nach WP03 (Run-Abschluss). Die
  bestehende `room.wave += 1`-/`enemiesPerWave`-Logik (Z. 1135–1141) für die
  Intra-Raum-Wellen-Eskalation darf bleiben, darf aber `DUNGEON_DEPTH` nicht
  mehr verändern.
- **T007** `js/roomManager.js` `enterRoom` (Z. 919–934): sicherstellen, dass
  `depth` aus `savedDepth` (= Run-Start-`DUNGEON_DEPTH`) abgeleitet wird und
  `NEXT_DUNGEON_DEPTH` nicht mehr als Per-Raum-Treiber wirkt. `currentWave =
  depth-1` (Z. 962) bleibt run-konstant.
- **T008** Endless-Abgrenzung (FR-08): verifizieren, dass der Endless-Zweig
  (`roomManager.js` Z. 1011–1014: `newDepth = DUNGEON_DEPTH+1` +
  `SELECTED_WAVE_OVERRIDE = newDepth`; `endlessMode.js` Z. 240–242) seine
  eigene Tiefen-Erhöhung behält. Smoke/Test: Endless steigt weiter, regulärer
  Run nicht.

## Independent Test

`tests/runBasedDepth.test.js` Invariante (a) grün. Smoke: Run durchlaufen,
`window.DUNGEON_DEPTH` ändert sich von Raum 1 bis zum letzten Raum nicht.
Endless-Mode steigt weiterhin pro Extra-Raum.

## Hinweise

- Gegner-/Loot-Skalierung liest `window.DUNGEON_DEPTH` — run-konstant ist
  gewollt. Intra-Run-Varianz bleibt über `roomDifficultyMult` (Z. 952–958,
  Raum-Position, NICHT Tiefe).
- `DUNGEON_DEPTH`-Init in `main.js` (Z. 1144–1148) NICHT brechen.

## Activity Log

- 2026-06-24T17:58:34Z – unknown – shell_pid=7672 – lane=for_review – Moved to for_review
- 2026-06-24T17:58:37Z – unknown – shell_pid=7672 – lane=approved – Moved to approved
- 2026-06-24T17:58:48Z – unknown – shell_pid=7672 – lane=done – Done override: Manual merge; invariant (a) green, (b-d) red until WP03
