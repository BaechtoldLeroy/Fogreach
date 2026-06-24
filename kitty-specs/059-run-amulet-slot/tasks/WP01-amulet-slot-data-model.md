---
work_package_id: WP01
title: Amulett-Slot + Datenmodell + Item-type amulet
dependencies: []
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: b61cb3124fc4ca82b6e7e874cdc80b273becb972
created_at: '2026-06-24T13:00:54.869879+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Foundation
assignee: ''
agent: ''
shell_pid: "38556"
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

# Work Package Prompt: WP01 – Amulett-Slot + Datenmodell + Item-type `amulet`

## Ziel
Den fünften Equipment-Slot `amulet` und ein eigenes Amulett-Datenmodell anlegen —
ohne Effekte, ohne Spawn. Der Slot ist anleg-/ablegbar, Amulett-Items existieren als
eigener Item-Typ, und ein eigener Roll-Pfad liefert Amulette (getrennt vom regulären
`rollItem`-Droppool, damit Amulette kein reguläres Gear verdrängen).

## Requirements
FR-01 (Slot `amulet`), FR-02 (Item-type + eigener Pool), FR-08 (Slot-Kapazität 1, tauschbar).

## Kontext / Code-Anker (gegen aktuellen Code geprüft)
- `js/main.js:825` — `equipment = { weapon, head, body, boots }`, `window.equipment = equipment` (`:832`).
- `js/inventory.js:619` — `const equipKeys = ['weapon', 'head', 'body', 'boots']`.
- `js/inventory.js:1220` — Equip-Swap-Pfad (`oldItem = equipment[slotKey]`, Swap-Logik).
- `js/lootSystem.js:255` — `ITEM_BASES` (Object.freeze-Array, Felder key/type/name/iconKey/baseStats/dropWeight).
- `js/lootSystem.js:514` — `rollItem(baseKey, iLevel, forceTier)`; `:956` Umfeld — `LootSystem`-Export-Objekt.
- `js/loot.js` — `TIER_COLORS` / Item-Visual-Umfeld.

## Subtasks
- **T001** `equipment` (`js/main.js:825`) um `amulet: null` erweitern. `window.runAmulet = null` neben `window.equipment` (`:832`) deklarieren (run-scoped State-Anker für spätere WPs).
- **T002** `equipKeys` (`js/inventory.js:619`) um `'amulet'` ergänzen. Equip-Swap (`:1220`) prüfen: 5. Slot muss korrekt swappen; Slot-Kapazität 1, Tausch erlaubt (altes Amulett zurück ins Inventar, FR-08).
- **T003** Item-`type: 'amulet'` + `AMULET_DEFS` (neues Object.freeze-Array) in `js/lootSystem.js` neben `ITEM_BASES` (`:255`). Felder pro Amulett: `id/key`, `type:'amulet'`, `name`, `iconKey`, `effect` (Stub-Kennung, z.B. `'twin'|'chain'|'cleave'|'lifesteal'|'aura'|'tempo'`), optionaler `baseStats`-Anteil, `tierBias`/`depthMin`. **Nicht** in `ITEM_BASES`, **nicht** im `rollItem`-Weighted-Pool.
- **T004** `rollAmulet(depth, rng)` in `js/lootSystem.js` (eigener Pfad, getrennt von `rollItem`). Liefert ein Amulett-Item-Objekt (kompatibel zum Inventar-Item-Shape: `type`, `name`/`displayName`, `iconKey`, `effect`). Über `LootSystem`-API exportieren (Export-Objekt `:956` Umfeld), z.B. `rollAmulet`, `AMULET_DEFS`.
- **T005** Amulett-Icon/Visual: Icon-Key in `js/loot.js` (TIER_COLORS-Umfeld) registrieren + Fallback-Icon, damit der Slot/Drop ein eigenes Visual hat.
- **T006** `tests/runAmulet.test.js` aufsetzen: (a) `equipment.amulet`-Slot existiert; (b) Amulett an-/ablegen funktioniert; (c) Tausch hält genau 1 aktiv; (d) `AMULET_DEFS` wohlgeformt (jeder Eintrag hat `type:'amulet'`, `effect`, `name`, `iconKey`); (e) `rollAmulet` liefert nur Amulette. Baseline-Tests grün halten.

## Independent Test
`node tools/runTests.js` grün; `tests/runAmulet.test.js` deckt Slot + AMULET_DEFS +
rollAmulet + Tausch ab.

## Done-Kriterien
- `equipment.amulet` ist ein echter, an-/ablegbarer Slot (SC-01 Vorstufe).
- `AMULET_DEFS` + `rollAmulet` existieren, getrennt vom regulären Loot.
- Keine Regression der 4 Bestands-Slots (NFR-04).

## Activity Log

- 2026-06-24T13:00:56Z – unknown – shell_pid=38556 – lane=in_progress – Moved to in_progress
- 2026-06-24T13:09:43Z – unknown – shell_pid=38556 – lane=for_review – Moved to for_review
