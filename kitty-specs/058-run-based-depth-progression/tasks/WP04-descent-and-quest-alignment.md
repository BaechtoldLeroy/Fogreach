---
work_package_id: "WP04"
title: "„Der Hinabstieg\"-Abstimmung + Quest-Objektive"
lane: "planned"
dependencies:
  - "WP02"
  - "WP03"
planning_base_branch: "main"
merge_target_branch: "main"
branch_strategy: "Planning artifacts were generated on main; completed changes must merge back into main."
subtasks:
  - "T013"
  - "T014"
  - "T015"
  - "T016"
  - "T017"
phase: "Phase 4 - Hinabstieg & Quest-Abstimmung"
assignee: ""
agent: ""
shell_pid: ""
review_status: ""
reviewed_by: ""
review_feedback: ""
history:
  - timestamp: "2026-06-24T08:00:00Z"
    lane: "planned"
    agent: "system"
    action: "Prompt generated via /spec-kitty.tasks"
---

# Work Package Prompt: WP04 – Hinabstieg + Quest-Abstimmung

## Ziel

„Der Hinabstieg"-Tiefenwahl an „eine Tiefe pro Run" anpassen (run-konstant,
≤ `maxDepth`, flacher bleibt erlaubt) und alle Quest-Objektive, die an der
alten Per-Raum-Wellen-Logik hingen, so abstimmen, dass sie completable
bleiben (bekannte Projekt-Falle: broken Trigger = uncompletable Quest).

## Anforderungen

FR-05, FR-06, FR-07, C-04, SC-04, SC-05.

## Subtasks

- **T013** `js/scenes/HubSceneV2.js` `_openWaveSelectDialog` (Z. 1819–1896)
  + `startDungeon` (Z. 1737–1740): `chooseDepth` (Z. 1889) setzt die
  run-konstante Start-Tiefe; auf ≤ `maxDepth` clampen (D2: „An die Grenze" =
  exakt `maxDepth`, flachere Optionen bleiben). Die bereits aus `maxDepth`
  abgeleiteten Optionen (Z. 1847–1860) bleiben; sicherstellen, dass keine
  Option > `maxDepth` entsteht. `LAST_DEPTH`-Persist (Z. 1890) bleibt.
- **T014** `js/questSystem.js` `reach_wave` (Z. 428/539/577; Logik
  `onWaveCompleted` Z. 1078–1083): Objektiv „bis Tiefe 20/30/40" auf die
  **run-konstante** Tiefe umstellen — erfüllt, wenn ein Run auf/über der
  Zieltiefe gespielt wird (z.B. `window.DUNGEON_DEPTH >= required` bei
  Run-Start/Wellen-Abschluss), NICHT durch Per-Raum-Klettern. Sicherstellen,
  dass die Quest mit run-konstanter Tiefe completable bleibt.
- **T015** `js/questSystem.js` `dungeon_run`/`dungeon_complete`
  (`thom_pamphlets` Z. 500; Logik Z. 1085–1088): von „jede Welle zählt als
  Run" auf „genau +1 pro abgeschlossenem Run" umstellen. An den Run-Abschluss
  koppeln — z.B. neue `questSystem.onDungeonCompleted()`, gerufen aus
  `leaveDungeonForHub` (`reason: 'dungeon_complete'`, WP03), statt im
  `onWaveCompleted`-Pfad zu inkrementieren.
- **T016** Wave-Fan-out prüfen (`js/wave.js` Z. 126–132): `storySystem`/
  `AbilitySystem` `onWaveCompleted` dürfen unter run-konstanter Tiefe nicht
  regredieren. Story-Akt-Sprünge sind bereits depth-entkoppelt
  (`storySystem.js` Z. 602: „Depth-based act advancement REMOVED") — nur
  bestätigen/dokumentieren, keine neue Kopplung.
- **T017** i18n (FR-11-Analog): falls Hinabstieg-Texte
  (`hub.wave_select.subtitle`, `hub.descent.*`) sich semantisch ändern
  (run-konstant statt „tiefer klettern"), DE/EN über das bestehende
  i18n-Register anpassen — keine hartkodierten Strings.

## Independent Test

- Hinabstieg startet Runs run-konstant; keine wählbare Tiefe > `maxDepth`;
  flacher-starten möglich (SC-04).
- `reach_wave`-Quest (20/30/40) ist auf run-konstanter Tiefe abschließbar.
- `thom_pamphlets` zählt +1 pro abgeschlossenem Run (nicht pro Welle).

## Hinweise

- C-04: Jede berührte Quest gegen `updateQuestProgress(type,target)` /
  `onWaveCompleted` / neue `onDungeonCompleted` auditieren (Vollaudit in
  WP05/T018).
