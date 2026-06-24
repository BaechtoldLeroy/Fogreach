---
work_package_id: WP05
title: Inventar-UI-Redesign + Tooltip + Mobile + i18n-Abschluss
dependencies:
- WP01
- WP03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: 619f519b221e8b8e6f32c7df7646bf57cff7bb72
created_at: '2026-06-24T17:32:35.436281+00:00'
subtasks:
- T026
- T027
- T028
- T029
- T030
- T031
phase: Phase 5 - UI-Redesign & Abschluss
assignee: ''
agent: ''
shell_pid: "45360"
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

# Work Package Prompt: WP05 – Inventar-UI-Redesign + Tooltip + Mobile + i18n

## Ziel
Das Inventar-UI für den 5. Slot umbauen: Equipment-Spalte auf 5 Slots, den
run-spezifischen Amulett-Slot **visuell deutlich** vom persistenten Gear absetzen
(eigene Optik + Run-Badge), Effekt-Tooltip, Gesperrt-Zustand unter Tiefe 10,
Mobile-Bedienbarkeit, und i18n-Abschluss + Gesamt-Verifikation.

## Requirements
FR-09 (UI-Redesign), FR-10 (Tooltip), FR-11 (i18n), FR-13 (Gesperrt <10), SC-07, SC-08.

## Kontext / Code-Anker (gegen aktuellen Code geprüft)
- `js/inventory.js:619` — `equipKeys` (jetzt 5 Einträge nach WP01).
- `js/inventory.js:624`–`660` — Equipment-Slot-Aufbau-Schleife; `:660` `invUI.equip[equipKeys[i]] = { slot, icon, highlight }`.
- `js/inventory.js:515` — `formatItemTooltip(it, heading)`; `:564` Tooltip-Render; `:576` Kommentar zum Tooltip-Clipping (Equipment-Slot von unten).
- `js/inventory.js:1` — i18n-Register (`window.i18n.register('de'/'en', {...})`), `inventory.label.*`-Keys als Vorlage; `_INV_T` (`:54`).
- Mobile-Falle: Memory `project_phaser_scrollfactor_dialogs` (recursive scrollFactor) + `project_mobile_slot_index_layout`.

## Subtasks
- **T026** Equipment-Spalte auf 5 Slots umbauen (`js/inventory.js:624`–`660`): Abstände/Größen/Layout so anpassen, dass 5 Slots lesbar passen; Amulett-Slot mit eigener Slot-Optik (run-Farbton/Rahmen), damit er nicht wie persistentes Gear aussieht.
- **T027** Run-Badge „Nur dieser Run" am Amulett-Slot rendern; Gesperrt-Zustand bei `window.DUNGEON_DEPTH < 10` (Slot ausgegraut + i18n-Hinweis „freigeschaltet ab Tiefe 10", FR-13).
- **T028** `formatItemTooltip` (`js/inventory.js:515`) um Amulett-Block erweitern: Effekt-Beschreibung (aus AMULET_DEFS/i18n) prominent + Run-Hinweis, vom Stat-Block abgesetzt. Tooltip-Clipping (`:576`) für den 5. Slot prüfen/fixen.
- **T029** Mobile-Bedienbarkeit: Touch-Hit-Area des 5. Slots sicherstellen (scrollFactor-/Hit-Area-Falle, Memory `project_phaser_scrollfactor_dialogs`); Tap trifft den Slot. Auf Touch testen.
- **T030** i18n-Vollständigkeit DE/EN: Amulett-Namen, Effekt-Texte (A1–A6), Slot-Label, Run-Badge, Händler-Dialog, Tiefe-10-Hinweis — alle über `window.i18n` (Register-Block `:1` Umfeld). Grep auf hartkodierte Strings in neuen Pfaden (FR-11).
- **T031** Abschluss-Verifikation: alle SC (SC-01..SC-08) prüfen; `node tools/runTests.js` grün; Smoke `node tools/testGame.js` (Server :3456); NFR-01 (60fps Desktop / Mobile-Procroom ≥45) + NFR-02 (Balance-Playtest: Amulett spürbar, Loot nicht entwertet); Feature-Accept vorbereiten.

## Independent Test
Inventar zeigt 5 Equipment-Slots; Amulett-Slot mit Run-Badge + eigener Optik;
Tooltip rendert Effekt; Touch-Tap trifft den Slot; keine hartkodierten Strings;
alle Tests grün; 60fps/Mobile ≥45.

## Done-Kriterien
- Amulett-Slot visuell als „Nur dieser Run" erkennbar; Tooltip zeigt Effekt; Layout lesbar; Mobile bedienbar (SC-07).
- DE/EN vollständig, keine hartkodierten Strings; alle Tests grün; Perf unverändert (SC-08).
- Keine Regression der 4 Bestands-Slots (NFR-04).

## Activity Log

- 2026-06-24T17:40:23Z – unknown – shell_pid=45360 – lane=for_review – Moved to for_review
- 2026-06-24T17:40:25Z – unknown – shell_pid=45360 – lane=approved – Moved to approved
