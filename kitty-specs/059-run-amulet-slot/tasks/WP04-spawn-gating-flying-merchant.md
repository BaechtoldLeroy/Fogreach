---
work_package_id: "WP04"
title: "Spawn-Gating ab Tiefe 10 + fliegender Haendler"
lane: "planned"
dependencies:
  - "WP01"
  - "WP02"
planning_base_branch: "main"
merge_target_branch: "main"
branch_strategy: "Planning artifacts were generated on main; completed changes must merge back into main."
subtasks:
  - "T020"
  - "T021"
  - "T022"
  - "T023"
  - "T024"
  - "T025"
phase: "Phase 4 - Spawn & Haendler"
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

# Work Package Prompt: WP04 – Spawn-Gating ab Tiefe 10 + fliegender Händler

## Ziel
Amulette ab Tiefe 10 **garantiert** und **früh** im Run verfügbar machen — sowohl als
Spawn-Pickup in einem der ersten Räume als auch über einen **fliegenden Händler** mit
run-fixer, kuratierter Amulett-Auswahl. Unter Tiefe 10: nichts davon.

## Requirements
FR-04 (Spawn-Gating ab Tiefe 10, früh), FR-07 (Händler), FR-13 (Tiefe <10 keine Auslage), SC-03, SC-04.

## Kontext / Code-Anker (gegen aktuellen Code geprüft)
- `js/roomManager.js:141` — `initDungeonRun()`; `:173` `depth = Math.max(1, window.DUNGEON_DEPTH || 1)`; `:174` `act = getStoryAct(depth)` (`getStoryAct` :129 schaltet ab depth ≥10 auf Akt 2 — gleiche Schwelle).
- `js/roomManager.js:179` — Beispiel für quest-gesteuertes Force-Inject von Räumen (Muster für gezieltes Early-Inject).
- `js/lootSystem.js:854` — `getOrCreateShopState(runIdOverride)`; `:830` `_currentRunId()`; `:840` `_generateShopStock(runId)` — **Vorlage** für run-fixe Auswahl.
- `js/lootSystem.js:873` — `refreshShop()` (Invalidierung beim Hub-Verlassen) als Muster.
- EventSystem-Encounter-Muster: vgl. Memory `project_dungeon_npc_encounter` (`EventSystem.spawnEventObject` mit `{ scale: 0.16 }` + roomManager-Statemachine).

## Subtasks
- **T020** [test-first] Tests (rot): (a) `window.DUNGEON_DEPTH < 10` → `rollAmulet`-Spawn wird **nicht** injiziert; (b) `>= 10` (inklusiv, Grenze genau 10) → genau **1** Amulett-Inject in einem frühen Raum; (c) `getOrCreateAmuletShopState(runId)` ist run-fix (gleicher runId → gleiche Auswahl), unter Tiefe 10 leere/keine Amulett-Auslage.
- **T021** Spawn-Inject in `initDungeonRun` (`js/roomManager.js:141`): wenn `window.DUNGEON_DEPTH >= 10`, `rollAmulet(depth)` als Pickup in einen der **ersten** Räume einspeisen (eigenes Drop-Visual aus WP01). Bestehende Spawn-Order (regular/story/final) nicht brechen; genau 1 Amulett-Spawn pro Run.
- **T022** Fliegender-Händler-Encounter: run-spezifischer NPC/Auslage als Encounter im Run (nicht im Hub). Über EventSystem/Encounter-Muster spawnen (vgl. Memory `project_dungeon_npc_encounter`), [E]-Interaktion öffnet die Amulett-Auslage.
- **T023** `getOrCreateAmuletShopState(runId)` in `js/lootSystem.js` nach Vorbild `getOrCreateShopState` (`:854`): 2–3 `rollAmulet`-Optionen, run-fix per `runId` (`_currentRunId` `:830`); leichter Tiefen-Bias auf stärkere Amulette (D5). `refreshAmuletShop()` analog `refreshShop` (`:873`).
- **T024** Kauf-Flow: Gold via `spendGold` abziehen, Amulett ins Inventar legen; Tausch/Anlegen über WP01-Slot. Unter Tiefe 10 keine Amulett-Auslage (FR-13).
- **T025** Spawn-/Händler-Tests grün; i18n DE/EN für Händler-Dialog + Tiefe-10-Hinweis (Strings über `window.i18n`).

## Independent Test
Unit-Test: Tiefe <10 kein Spawn/keine Auslage; ≥10 genau 1 Spawn + run-fixe
Händler-Auswahl. Grenze 10 inklusiv.

## Done-Kriterien
- Tiefe <10: kein Amulett-Spawn, kein Händler-Amulett (SC-03).
- Tiefe ≥10: garantiert 1 Amulett früh im Run + run-fixe Händler-Auswahl (SC-03, SC-04).
- Bestehende Spawn-Order/Shop-Logik ohne Regression (NFR-04).
