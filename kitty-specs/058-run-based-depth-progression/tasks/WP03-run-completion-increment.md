---
work_package_id: WP03
title: Run-Abschluss-+1 (idempotent) + Persistence
dependencies:
- WP01
- WP02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: a5f17e5d57747295e12d8a2549b0c3b7ae6156a6
created_at: '2026-06-24T17:58:59.796184+00:00'
subtasks:
- T009
- T010
- T011
- T012
phase: Phase 3 - Run-Abschluss-Increment
assignee: ''
agent: ''
shell_pid: "21752"
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

# Work Package Prompt: WP03 – Run-Abschluss-+1 (idempotent)

## Ziel

Genau **ein** `MAX_DEPTH`-Increment (+1) pro erfolgreich abgeschlossenem Run,
gekoppelt an den Run-Abschluss-Hook (D1: `leaveDungeonForHub` mit
`reason === 'dungeon_complete'`). Tod/Portal zählen nicht. Mehrfache Aufrufe
zählen nicht doppelt (idempotent).

## Anforderungen

FR-02, FR-03, FR-04, NFR-02, SC-02, SC-03.

## Subtasks

- **T009** `js/persistence.js`: Helper `bumpMaxDepth()` ergänzen (liest
  `KEYS.MAX_DEPTH`, `+1`, schreibt zurück, gibt neuen Wert zurück). Optional
  `setLastDepth(depth)` zentralisieren (`KEYS.LAST_DEPTH`). An das bestehende
  Persistence-Export-API anhängen (gleiches Pattern wie vorhandene Getter/
  Setter). Kein Schreiben, wenn der Wert sich nicht ändert (NFR-02).
- **T010** `js/main.js` `leaveDungeonForHub` (Z. 1689 ff.): bei
  `reason === 'dungeon_complete'` (D1) genau einmal `bumpMaxDepth()`
  aufrufen. **Idempotenz-Guard** einbauen, damit mehrfache Aufrufe nicht
  doppelt zählen — z.B. an den bestehenden `window.runStats`-Konsum koppeln
  (runStats wird in der Funktion einmalig auf `null` gesetzt, Z. 1718) oder
  einen eigenen `window.__runDepthBumped`-Latch nutzen, der bei Run-Start
  (`initDungeonRun`) zurückgesetzt wird.
- **T011** `LAST_DEPTH`-Konsistenz (FR-04): bestätigen/sicherstellen, dass
  die im Hinabstieg gewählte Tiefe weiter als `LAST_DEPTH` persistiert wird
  (`HubSceneV2.js` `chooseDepth` Z. 1890) und der nächste Run-Default daraus
  + `maxDepth` abgeleitet wird (NICHT aus einem per-Raum gewachsenen Stand).
- **T012** NFR-02: sicherstellen, dass `MAX_DEPTH` nur **einmal pro Run**
  geschrieben wird (kein per-Raum/-Frame-`setItem`; der frühere Schreib-Punkt
  in `markRoomCleared` ist in WP02 entfernt). Tests (b)(c)(d) aus
  `runBasedDepth.test.js` grün.

## Independent Test

`tests/runBasedDepth.test.js` Invarianten (b)(c)(d) grün:
- `dungeon_complete` → `MAX_DEPTH` += 1,
- `death`/`portal` → `MAX_DEPTH` unverändert,
- Doppelter `dungeon_complete`-Aufruf → nur einmal +1.

## Hinweise

- Der Abschluss-Hook ist `roomManager.js` Z. 1035 (`leaveDungeonForHub(scene,
  { reason: 'dungeon_complete' })`), gefeuert wenn `nextIndex >= totalRooms`
  (letzter Raum erreicht).
- `bumpMaxDepth` darf den Wert nur nach **oben** bewegen (max(alt, alt+1)) —
  bei Save mit altem hohem `maxDepth` keine Regression.

## Activity Log

- 2026-06-24T18:02:21Z – unknown – shell_pid=21752 – lane=for_review – Moved to for_review
- 2026-06-24T18:02:37Z – unknown – shell_pid=21752 – lane=approved – Moved to approved
- 2026-06-24T18:02:49Z – unknown – shell_pid=21752 – lane=done – Done override: Manual merge; all 6 invariants green, 346 pass, smoke 0, pushed
