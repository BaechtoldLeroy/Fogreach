---
work_package_id: "WP02"
title: "Run-Lifecycle: run-scoped State + Reset + Save-Guard"
lane: "planned"
dependencies:
  - "WP01"
planning_base_branch: "main"
merge_target_branch: "main"
branch_strategy: "Planning artifacts were generated on main; completed changes must merge back into main."
subtasks:
  - "T007"
  - "T008"
  - "T009"
  - "T010"
  - "T011"
phase: "Phase 2 - Run-Lifecycle"
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

# Work Package Prompt: WP02 – Run-scoped State + Reset + Save-Guard

## Ziel
Garantieren, dass das Amulett **run-spezifisch** ist: Reset bei Hub-Rückkehr UND Tod
(D1c: ein Hook für alle Reasons) und **kein** Persist ins Save-Equipment. Dies ist
das sicherheitskritische WP gegen das „Amulett überlebt den Run"-Leck (R-02).

## Requirements
FR-03 (Reset), FR-12 (kein Persist), NFR-03 (deterministischer Reset), SC-02, SC-06.

## Kontext / Code-Anker (gegen aktuellen Code geprüft)
- `js/main.js:1689` — `leaveDungeonForHub(scene, options)`; `options.reason` ∈ `'portal'|'death'|…`.
- `js/main.js:1725` — `if (window.brunnenBuffs) { window.brunnenBuffs = null; recalcDerived(0,0); }` — **exakte Reset-Vorlage**.
- `js/main.js:1736` — analog `window.printingBuffs`.
- `js/main.js:1968` — Tod-Pfad ruft `leaveDungeonForHub(scene, { reason: 'death', skipSave: true })` → Hook deckt Tod automatisch ab.
- `js/gameState.js:48` — `state.inventory.equipment = window.equipment;` (Serialisierungs-Pfad).
- `js/storage.js:269` — `window.equipment = equipment;` (Load-Pfad).
- `js/persistence.js:8` — `KEYS` (`SAVE: 'demonfall_save_v1'`), `:38` `NEW_GAME_WIPE_KEYS`. **Kein** neuer Key nötig.

## Subtasks
- **T007** [test-first] In `tests/runAmulet.test.js` Reset-Tests schreiben (rot): nach simuliertem `leaveDungeonForHub` mit reason `'portal'` UND `'death'` ist `equipment.amulet === null` und `window.runAmulet === null`. Save-Guard-Test: Save-Roundtrip mit angelegtem Amulett ergibt **kein** Amulett im geladenen Equipment.
- **T008** Reset-Hook in `leaveDungeonForHub` (`js/main.js:1689`) ergänzen — **gleiches Muster** wie `brunnenBuffs` (`:1725`): `if (equipment && equipment.amulet) { equipment.amulet = null; }` und `window.runAmulet = null;`, danach `recalcDerived(0,0)` (defensiv try/catch wie Bestand). Greift für alle Reasons (Tod über `:1968` automatisch).
- **T009** Save-Guard (FR-12): im Serialisierungs-Pfad (`js/gameState.js:48` bzw. `js/storage.js` saveGame) sicherstellen, dass `amulet` NICHT persistiert wird. Bevorzugt: beim Speichern eine flache Kopie des Equipment ohne `amulet` schreiben (Bestands-Slots unberührt). `js/persistence.js` KEYS unverändert.
- **T010** Defensiver Load (`js/storage.js:269` Umfeld): nach Load `equipment.amulet = null` erzwingen (Alt-Saves ohne Feld laden fehlerfrei; ein evtl. fälschlich gespeichertes Amulett wird genullt). SC-06.
- **T011** Alle Reset-/Save-Guard-Tests grün; `node tools/runTests.js` grün; Bestands-Save-Tests (`tests/lootSystem.test.js`) ohne Regression.

## Independent Test
Unit-Test: Reset für `portal`+`death`, Save-Roundtrip ohne Amulett, Alt-Save lädt
fehlerfrei.

## Done-Kriterien
- Nach Hub-Rückkehr/Tod: `equipment.amulet === null`, `window.runAmulet === null` (SC-02).
- Gespeichertes/geladenes Save enthält kein Amulett im Equipment (SC-06).
- Kein neuer localStorage-Key; keine Regression der Bestands-Persistenz (NFR-04).
