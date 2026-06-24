# Implementation Plan: Run-Amulett-Slot + Inventar-UI-Redesign

**Branch**: `main` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/059-run-amulet-slot/spec.md`

## Summary

Ein fünfter, **run-spezifischer** Equipment-Slot „Amulett" (Item-`type: 'amulet'`)
mit roguelike-Relikt-Charakter: starke, run-definierende Effekte (Extra-Projektil/
Cleave, Chain, Aura, Lebensraub, Tempo/Burst), freigeschaltet ab Tiefe 10, früh im
Run findbar, zusätzlich beim fliegenden Händler kaufbar — und bei Hub-Rückkehr/Tod
zurückgesetzt (NICHT persistent). Im selben Zug Inventar-UI-Redesign (5-Slot-Layout,
Run-Badge, Effekt-Tooltip).

**Technischer Ansatz**: Additiv auf bestehender Infrastruktur. Der Amulett-Slot
hängt sich in `equipment` (`js/main.js:825`) und `equipKeys` (`js/inventory.js:619`)
ein; reine Stats fließen automatisch über `recalcDerived` (iteriert
`Object.values(equipment)`); Nicht-Stat-Effekte über explizite Combat-Hooks in
`js/player.js`, die `window.runAmulet.effect` lesen. Der Reset nutzt das exakt
bestehende run-scoped-Buff-Muster (`brunnenBuffs`/`printingBuffs` in
`leaveDungeonForHub`, `js/main.js:1689`). Spawn-Gating in `initDungeonRun`
(`js/roomManager.js:141`) gegen `DUNGEON_DEPTH >= 10`. Der fliegende Händler
verwendet das run-fixe Shop-State-Muster (`getOrCreateShopState`, `js/lootSystem.js:854`).

## Technical Context

**Language/Version**: ES6+ Vanilla-JS (klassische `<script>`-Tags, KEIN Build/Bundler)
**Primary Dependencies**: Phaser 3, `window.i18n`, keine neuen Dependencies
**Storage**: localStorage via `js/persistence.js` (`KEYS.SAVE`); Amulett bewusst NICHT persistent
**Testing**: `node tools/runTests.js` (Unit), Smoke: `node tools/testGame.js` (Server :3456)
**Target Platform**: Browser (Desktop + Mobile-Touch)
**Project Type**: single (Phaser-Browser-Spiel, alles unter `js/`)
**Performance Goals**: 60fps Desktop, Mobile-Procroom ≥45 (053 nicht regredieren)
**Constraints**: additiv, defensive Loads, Amulett run-scoped (kein Persist), keine hartkodierten Strings (DE/EN i18n)
**Scale/Scope**: 5 WPs (Slot+Datenmodell, Run-Lifecycle/Reset, Effekt-Pool+Hooks, Spawn-Gating+Händler, UI-Redesign)

## Constitution Check

*GATE: Must pass before research. Re-check after design.*

- **test-first** (DIRECTIVE TEST_FIRST): Reset-Logik (SC-02/SC-06), Spawn-Gating
  (SC-03) und Effekt-Anwendung/getBonus (SC-05) als Unit-Tests VOR der
  Implementierung (`tests/runAmulet.test.js`).
- **i18n-Pflicht**: alle neuen Strings über `window.i18n` (DE source-of-truth) — kein
  hartkodierter String (FR-11).
- **Additiv / keine Regression**: 4 Bestands-Slots, Loot, Save-Pfad unverändert (NFR-04).
- **Keine neuen Dependencies**: Vanilla-JS + Phaser-built-ins.
- **Quest-Trigger-Audit**: n/a (kein neuer Quest-Objective-Typ).

Kein Verstoß → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```
kitty-specs/059-run-amulet-slot/
├── plan.md              # This file
├── spec.md              # Specification
├── tasks.md             # WP overview (/spec-kitty.tasks output)
├── tasks/
│   ├── WP01-amulet-slot-data-model.md
│   ├── WP02-run-lifecycle-reset.md
│   ├── WP03-effect-pool-hooks.md
│   ├── WP04-spawn-gating-flying-merchant.md
│   └── WP05-inventory-ui-redesign.md
├── research/            # Phase 0 notes (Combat-Hooks, Save-Pfad)
└── checklists/
```

### Source Code (repository root)

```
js/
├── main.js            # equipment-Objekt (+amulet); leaveDungeonForHub (Reset-Hook); window.runAmulet
├── inventory.js       # equipKeys (+amulet); recalcDerived (Stat-Anteil); formatItemTooltip; Slot-UI-Redesign
├── loot.js            # Item-type 'amulet' Konstanten/Visuals (TIER_COLORS-Umfeld)
├── lootSystem.js      # AMULET_DEFS (eigener Pool); rollAmulet; getOrCreateAmuletShopState (Händler)
├── roomManager.js     # initDungeonRun: Amulett-Spawn-Gating ab Tiefe 10, früher Raum
├── player.js          # Combat-Hooks: Extra-Projektil/Cleave/Chain/Lifesteal/Aura (lesen window.runAmulet)
└── persistence.js     # Garantie: Amulett nicht in persistentem SAVE-Equipment

tests/
└── runAmulet.test.js  # Reset, Spawn-Gating, getBonus/Effekt-Anwendung (test-first)
```

**Structure Decision**: Single-Project. Alle Änderungen additiv in den oben
gelisteten `js/`-Modulen; ein neues Test-File `tests/runAmulet.test.js`. Kein neues
Runtime-Modul außer optional einem schlanken `js/runAmulet.js`-Namespace (Entscheidung
in WP01-Research: eigene Datei vs. Anbau an `lootSystem.js`). Default-Empfehlung:
Amulett-Definitionen + Roll in `lootSystem.js` (neben `ITEM_BASES`/`rollItem`),
run-State `window.runAmulet` in `main.js` neben `equipment`.

## Phasen-Überblick

| Phase | WP | Inhalt |
|-------|----|--------|
| 1 Foundation | WP01 | Slot + Datenmodell + Item-type 'amulet' + Test-Skeleton |
| 2 Lifecycle | WP02 | Run-scoped State + Reset in leaveDungeonForHub + Save-Guard |
| 3 Effekte | WP03 | Effekt-Pool (A1–A6) + Combat-/Stat-Hooks |
| 4 Spawn/Shop | WP04 | Spawn-Gating ab Tiefe 10 + fliegender Händler |
| 5 UI | WP05 | Inventar-UI-Redesign + Tooltip + Mobile + i18n-Abschluss |

## Complexity Tracking

*Keine Constitution-Verstöße — Tabelle leer.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
