# Implementation Plan: Enemy-Spawn Story-Gating

**Branch**: `main` (planning) → merges into `main` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/057-enemy-spawn-story-gating/spec.md`

## Summary

Das Gegner-Roster wird heute in `js/enemy.js` (`spawnEnemy`, Z. 328–347)
**ausschließlich nach Dungeon-Tiefe** gefiltert. Da die Tiefe über „Der
Hinabstieg" frei wählbar ist, erscheinen narrativ späte Gegnertypen zu früh.

Dieses Feature ergänzt das Spawn-Gating um einen **zusätzlichen Akt-Filter**,
gespeist aus `storySystem.getCurrentActIndex()`. Der technische Ansatz:

1. Neues, Phaser-freies Modul `js/enemySpawnGating.js` (IIFE →
   `window.EnemySpawnGating`) mit einer **reinen** Funktion
   `getAvailableEnemyTypes(depth, actIndex)`. Sie kapselt das heutige
   Tiefen-Roster (Mindest-Floor) **und** ein neues Typ→`minActIndex`-Mapping.
2. `spawnEnemy` ruft im random-Pfad diese Funktion auf (statt der inline-`if`-
   Kette), liest den Akt defensiv aus `storySystem`, und behält für explizit
   angeforderte Typen das heutige Verhalten.
3. Fallback-Garantie: das Ergebnis ist **nie leer** (Schnittmenge leer →
   sicherer Frühphasen-Typ).

Test-first: die reine Filter-Funktion ist ohne Phaser/DOM unit-testbar (wie
`tests/eliteEnemies.test.js`), inkl. dediziertem „nie leer"-Test über alle
depth×act-Kombinationen und einem Tiefen-Identitäts-Test bei voll-Akt.

## Technical Context

**Language/Version**: ES6+ Vanilla-JS (klassische `<script>`-Tags, KEIN Bundler)
**Primary Dependencies**: Phaser 3 (nur in `enemy.js`; das Gating-Modul ist Phaser-frei)
**Storage**: keine neue Persistenz — Akt kommt live aus `window.storySystem` (read-only)
**Testing**: `node tools/runTests.js` (node:test), Smoke `node tools/testGame.js` (Server :3456)
**Target Platform**: Browser (Desktop + Mobile), klassische Script-Einbindung via `index.html`
**Project Type**: single (Browser-Game, Vanilla-JS in `js/`)
**Performance Goals**: 60fps Desktop, Mobile-Floor (053) nicht regredieren; Filter O(≤10)
**Constraints**: Roster nie leer (FR-04); Tiefen-Floor erhalten (C-01); kein neuer Dependency (NFR-02)
**Scale/Scope**: 1 neues kleines Modul + 1 Edit in `enemy.js` + 1 Script-Tag in `index.html` + 1 Testdatei

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TEST_FIRST**: erfüllt — die reine `getAvailableEnemyTypes`-Logik (inkl.
  „nie leer", Tiefen-Identität, defensive Defaults) wird als Unit-Test VOR der
  Verdrahtung in `spawnEnemy` geschrieben.
- **Additiv / keine Regression**: Tiefen-Gating bleibt unverändert als Floor
  (C-01, FR-07); explizite Spawns unberührt (FR-05); `storySystem` read-only
  (C-03). Keine neue Dependency (NFR-02). Keine Save-Migration (C-05).
- **i18n**: nicht betroffen (keine neuen Spieler-Texte).

Kein Constitution-Verstoß → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```
kitty-specs/057-enemy-spawn-story-gating/
├── plan.md              # Diese Datei
├── spec.md              # Spezifikation
├── tasks.md             # WP-Übersicht + Subtasks
├── tasks/
│   ├── README.md
│   └── WP01-act-roster-gating.md
├── research/            # (vorhanden, leer)
└── checklists/          # (vorhanden)
```

### Source Code (repository root)

```
js/
├── enemySpawnGating.js   # NEU — IIFE → window.EnemySpawnGating:
│                         #   ENEMY_MIN_ACT (Typ→minActIndex),
│                         #   DEPTH_TIERS (heutige Tiefen-Floors),
│                         #   getAvailableEnemyTypes(depth, actIndex)  [rein]
├── enemy.js              # EDIT — spawnEnemy Z. 328–347:
│                         #   inline-if-Kette → EnemySpawnGating-Aufruf
│                         #   + defensiver Akt-Read aus window.storySystem
│                         #   + Fallback wenn Modul fehlt
└── storySystem.js        # UNVERÄNDERT — liefert getCurrentActIndex() (read-only)

index.html                # EDIT — <script src="js/enemySpawnGating.js"> VOR enemy.js

tests/
└── enemySpawnGating.test.js  # NEU — Unit-Tests der reinen Filter-Funktion
```

**Structure Decision**: Single-Project Browser-Game. Die Gating-Logik wird in
ein eigenes, Phaser-freies Modul extrahiert (analog `eliteEnemies.js`), damit
sie ohne DOM/Phaser geladen und unit-getestet werden kann. `enemy.js` bleibt
der einzige Spawn-Konsument; `storySystem.js` wird nur gelesen.

## Complexity Tracking

*Keine Constitution-Verstöße — Tabelle leer.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
