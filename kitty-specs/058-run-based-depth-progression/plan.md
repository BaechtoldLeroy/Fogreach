# Implementation Plan: Run-basierte Tiefen-Progression

**Branch**: `main` (planning + merge target) | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/058-run-based-depth-progression/spec.md`

## Summary

Die Dungeon-Tiefe (`window.DUNGEON_DEPTH`) klettert heute **pro Raum** und
treibt damit Gegnerstärke, Loot-iLevel und Level-Tempo viel zu schnell hoch.
Dieses Feature stellt die Tiefe auf **run-konstant** um: ein Run läuft auf
einer festen Tiefe; nur ein **erfolgreich abgeschlossener** Run erhöht die
Tiefen-Grenze (`MAX_DEPTH`) um **genau +1**.

**Technischer Ansatz (chirurgisch, additiv):**
1. Per-Raum-Increment im regulären Run-Übergang entfernen/neutralisieren
   (`roomManager.js` `onStairOverlap` Z. 1040–1047, `markRoomCleared`
   Z. 1142–1144) — jeder Raum eines Runs läuft auf der Run-Start-Tiefe.
2. Run-Abschluss-Hook: `leaveDungeonForHub(reason: 'dungeon_complete')`
   (`main.js` Z. 1689, Aufruf `roomManager.js` Z. 1035) erhöht `MAX_DEPTH`
   einmalig +1 (idempotent über ein Abschluss-Flag).
3. „Der Hinabstieg" (`HubSceneV2._openWaveSelectDialog`) leitet seine
   Optionen bereits aus `maxDepth` ab — bleibt funktional, gewählte Tiefe
   gilt jetzt run-konstant, ≤ `maxDepth`.
4. Quest-Objektive abstimmen: `reach_wave` (Tiefe 20/30/40) und
   `dungeon_run`/`dungeon_complete` auf run-konstante Tiefe / einen
   Increment-pro-Run umstellen (sonst uncompletable).
5. Endless-Mode behält seine eigene Tiefen-Eskalation (eigener Pfad).

## Technical Context

**Language/Version**: ES6+ Vanilla-JS (klassische `<script>`-Tags, KEIN Build/Bundler)
**Primary Dependencies**: Phaser 3 (built-ins), keine neuen Dependencies
**Storage**: `localStorage` über `js/persistence.js` (`KEYS.MAX_DEPTH`/`LAST_DEPTH`) + `js/storage.js` (Save-Snapshot)
**Testing**: `node tools/runTests.js` (Unit), Smoke `node tools/testGame.js` (Server :3456)
**Target Platform**: Browser (Desktop + Mobile-Touch)
**Project Type**: single (Phaser-Browserspiel, alle Sources in `js/`)
**Performance Goals**: 60fps Desktop, Mobile-Procroom ≥45 (053 nicht regredieren)
**Constraints**: kein per-Frame/-Raum-`localStorage`-Spam; Increment idempotent; bestehende Saves laden ohne Wipe; Endless-Pfad intakt
**Scale/Scope**: ~4 Dateien berührt, chirurgischer Eingriff, kein neues Runtime-Modul

## Constitution Check

*GATE: Must pass before research. Re-check after design.*

- **Additiv/Reuse (C-01)**: Kein paralleles Depth-Runtime — bestehende
  `DUNGEON_DEPTH`/`MAX_DEPTH`/`LAST_DEPTH`-Infrastruktur wird umgehängt, nicht
  dupliziert. PASS.
- **Keine neuen Dependencies (C-02)**: Vanilla-JS + Phaser-built-ins. PASS.
- **Save-Kompatibilität (C-03)**: additive/defensive Loads, kein
  `MAX_DEPTH`-Wipe. PASS (Test-Subtask in WP05).
- **Quest-Trigger-Audit (C-04)**: Pflicht-Subtask vor Ship (bekannte
  Projekt-Falle — uncompletable Quests). PASS (audited in WP04/WP05).
- **test-first (DIRECTIVE TEST_FIRST)**: „Tiefe run-konstant" + „+1 bei
  Abschluss" + „kein +1 bei Tod" werden als Unit-Tests VOR der Umsetzung
  geschrieben. PASS.

Keine Verletzungen → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```
kitty-specs/058-run-based-depth-progression/
├── spec.md              # Spezifikation (vorhanden)
├── plan.md              # Diese Datei
├── tasks.md             # WP-Übersicht + Subtasks
├── meta.json            # Feature-Metadaten
└── tasks/
    ├── README.md        # WP-Frontmatter-Format
    ├── WP01-decision-lock-and-tests.md
    ├── WP02-run-constant-depth.md
    ├── WP03-run-completion-increment.md
    ├── WP04-descent-and-quest-alignment.md
    └── WP05-verification-and-save-compat.md
```

### Source Code (repository root)

```
js/
├── roomManager.js       # Per-Raum-Increment entfernen (Z. 1040-1047, 1142-1144);
│                        #   Run-Start-Tiefe konstant (enterRoom Z. 919-934)
├── main.js              # leaveDungeonForHub (Z. 1689): Run-Abschluss-+1-Hook (D1)
├── persistence.js       # KEYS.MAX_DEPTH/LAST_DEPTH (Z. 27-30); ggf. Helper bumpMaxDepth()
├── scenes/HubSceneV2.js # _openWaveSelectDialog (Z. 1819): run-konstante Start-Tiefe, <= maxDepth
├── questSystem.js       # reach_wave (Z. 428/539/577) + dungeon_run/complete (Z. 500, 1085-1088)
├── endlessMode.js       # Endless-Tiefen-Pfad (Z. 240-242) UNVERAENDERT lassen / abgrenzen
└── storage.js           # Save-Snapshot dungeonDepth (Z. 72, 232) — Konsistenz pruefen

tests/
└── runBasedDepth.test.js   # NEU: run-konstant, +1-bei-Abschluss, kein-+1-bei-Tod, idempotenz
```

**Structure Decision**: Single-Project Phaser-Layout. Der Eingriff ist
chirurgisch in `js/roomManager.js` (Tiefen-Owner) + `js/main.js` (Abschluss-
Hook) konzentriert; `persistence.js`/`HubSceneV2.js`/`questSystem.js` werden
abgestimmt. Kein neues Modul, kein neues Runtime — bewusst minimal, weil das
Risiko in den Quest-Trigger-/Endless-Wechselwirkungen liegt, nicht in
Architektur.

## Complexity Tracking

*Keine Constitution-Verletzungen — Tabelle bleibt leer.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
