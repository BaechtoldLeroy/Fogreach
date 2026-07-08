# Implementation Plan: Room Objective Variety (Raum-Modi)

**Branch**: `061-room-objective-variety` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/061-room-objective-variety/spec.md`

## Summary

Einführung einer steckbaren **RoomMode-Schicht**, die das Raum-Objektiv (Spawn-Verhalten, Abschluss-Bedingung, Treppen-Freischaltung, HUD) kapselt. Das heutige „Welle clearen" wird verlustfrei als `ClearMode` refaktoriert (Default), darauf setzen `survival`, `defend`, `hunt` (+ optional `escape`) auf. Modi werden pro Run gewichtet zugewiesen (~1–2/Run, tiefen-skaliert; erster Raum/Boss/Espionage ausgenommen). Erfolg → Bonus-Chest; Verfehlen = Malus (kein Chest), kein harter Fail.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2020), klassische `<script>`-Tags, kein Bundler.
**Primary Dependencies**: Phaser 3.70 (CDN). Kein neuer Dependency.
**Storage**: Modi sind **run-scoped**, nicht persistiert → keine `storage.js`/Save-Migration (NFR-05).
**Testing**: `node:test` via `node tools/runTests.js`; Browser-Smokes via Playwright + temp static server + `?mode=<id>`/`?spy=1`-Muster.
**Target Platform**: Browser (Desktop + Mobile), Deploy auf GitHub Pages (`?v=`-Cache-Buster in `index.html`).
**Project Type**: single (Spielcode in `js/`, Tests in `tests/`).
**Performance Goals**: 60 fps; `mode.update(dt)` ohne Pro-Frame-Allokationen (NFR-04).
**Constraints**: Verlustfreiheit bei ausschließlich `clear`-Räumen (NFR-01); Modul defensiv (nie den Game-Loop brechen, NFR-03); Kernmodul unit-testbar ohne Phaser (NFR-02).
**Scale/Scope**: 1 neues Kernmodul (`js/roomModes.js`), Integration in `roomManager.js` + `wave.js`, 3–4 Modi, 1 HUD-Schicht, 1 neue Test-Datei.

## Constitution Check

*GATE: Vor Phase 0 bestehen; nach Phase 1 erneut prüfen.*

- **Verlustfreie Refaktorierung zuerst** (WP01): Bestehendes Verhalten wird 1:1 hinter das Interface gezogen, bevor Neues dazukommt → alle Bestandstests bleiben grün. ✓
- **Kernlogik testbar & Phaser-frei** (Vorbild `espionageSystem.js`/`knowledgeTree.js`): Registry + Auswahl + Timer-/Fail-Logik als reine Funktionen. ✓
- **Defensive Isolation**: Hooks in try/catch, damit ein Modus nie den Loop bricht. ✓
- **Additiv & save-kompatibel**: keine persistierten Änderungen. ✓
- Keine Verletzungen → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```
kitty-specs/061-room-objective-variety/
├── spec.md              # Feature-Spezifikation
├── plan.md              # Dieses Dokument
├── research.md          # (optional, für R1 Gegner-Targeting in WP03)
└── tasks/               # WP##-Prompt-Dateien
```

### Source Code (repository root)

```
js/
├── roomModes.js         # NEU: RoomMode-Registry + Interface + ClearMode/Survival/Defend/Hunt
├── roomManager.js       # geändert: enterRoom nutzt Modus; initDungeonRun weist Modi zu; Bonus-Chest
├── wave.js              # geändert: Treppe via mode.isComplete(); Timed-Spawner-Hook (Survival)
├── enemy.js             # geändert (WP03): optionales Nicht-Spieler-Ziel (Defend-Objekt)
├── eliteEnemies.js      # genutzt (WP04): markiertes Ziel (Hunt)
├── main.js              # ggf. Hook: mode.update(dt) im GameScene-Update; ?mode=-Force-Flag
└── hudV2.js / eigenes   # Modus-HUD (Banner/Timer/Objekt-HP/Ziel-Marker) (WP07)

tests/
└── roomModes.test.js    # NEU: Registry, ClearMode-Äquivalenz, Survival/Defend/Hunt, Auswahl, Bonus-Chest

index.html               # geändert: <script src="js/roomModes.js"> + ?v=-Bumps
```

**Structure Decision**: Single-Project. Ein neues, gekapseltes Kernmodul `js/roomModes.js` (IIFE → `window.RoomMode`), Vorbild `js/espionageSystem.js`. Integration minimal-invasiv in `roomManager.js`/`wave.js` über `mode.isComplete()`/`mode.update(dt)`. Rendering (HUD/Objekt-Sprite) separat, damit die testbare Logik Phaser-frei bleibt (analog `espionageSystem.js` ↔ `espionageVisuals.js`).

## Phasing (Work Packages)

| Phase | WP | Inhalt |
|-------|----|--------|
| **1 – Foundation** | WP01 | RoomMode-Registry + Interface + ClearMode-Refaktor (verlustfrei), Entkopplung Treppe, Unit-Tests |
| **2 – Erster Modus** | WP02 | SurvivalMode + Timed-Spawner + `?mode=`-Force-Hook |
| **3 – Integration** | WP05 | Gewichtete Modus-Auswahl in `initDungeonRun` + Bonus-Chest (Erfolg) / Malus (Verfehlen) |
| **4 – Weitere Modi** | WP03, WP04 | DefendMode (Objekt + Gegner-Targeting), HuntMode (markiertes Ziel) |
| **5 – Politur** | WP07 | Intro-Banner, einheitliches Modus-HUD, i18n, Belohnungs-/Balance-Tuning |
| **(optional)** | WP06 | EscapeMode |

**Abhängigkeiten:** WP01 → {WP02, WP03, WP04, WP06}; WP05 braucht WP01+WP02; WP07 braucht WP02–WP05.
**Empfohlene Landing-Reihenfolge:** WP01 → WP02 → WP05 → WP03 → WP04 → WP07 → (WP06).

## Phase 0 – Research (nur WP03)

**R1 — Gegner-Targeting eines Nicht-Spieler-Ziels.** Prüfen, wie die Gegner-KI (`enemy.js`, `ai/steering.js`) ihr Ziel wählt und ob ein Override auf einen Objekt-Punkt (Defend-Altar) sauber möglich ist. Fallback: einfacher „move-to-point"-Modus für Gegner in Defend-Räumen. Ergebnis → `research.md` (nur falls WP03 es braucht).

## Complexity Tracking

*Keine Constitution-Verletzungen — Tabelle leer.*
