# Implementation Plan: 053 — Mobile Dungeon Performance

**Branch**: `main` (planning + small-blast-radius shipping per project workflow)
**Date**: 2026-06-10
**Spec**: [spec.md](spec.md)

## Summary

WP01-Baseline aus Feature 052 hat aufgedeckt: Mobile-FPS im Dungeon ist
bereits heute unter Player-Experience-Schwelle (Procroom 20fps, Combat
40fps). 052 hat das nicht gelöst — die Render-Quality-Levers (DPR, Canvas-
Bump) hätten Mobile noch weiter runtergedrückt und wurden deshalb auf
Desktop-only umgestellt.

053 ist eine **Diagnose-First-Rescue-Operation**. Wir wissen NICHT was
genau die 20fps verursacht. Vermutet: Texture-Memory-Bandwidth (104×88
Tile-Grids mit runtime-generierten Texturen pro Procroom), oder Tile-
Sprite-Count, oder GameObject-Pool-Overhead, oder FogOfWar-Update-Rate.

Plan: Erst messen (WP01), dann zielgerichtete Mitigation. Statt Top-Down-
"refactor everything" → Bottom-Up "Profile → Top-Sink → fix → re-profile".

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2015+), Phaser 3.70 (CDN)
**Primary Dependencies**: Phaser 3 Pipelines (Texture, Sprite, Tile)
**Storage**: keine neuen Storage-Anforderungen
**Testing**: `node tools/runTests.js` (251+052-WPs-Tests, müssen grün bleiben)
**Target Platform**: Mobile Pixel-class 2-3× DPR primär. Desktop als Regression-Guard.
**Project Type**: Single-page Phaser-Spiel
**Performance Goals**:
- Mobile Procroom: 20fps → ≥45fps (playable) bzw. ≥55fps (NFR-konform)
- Mobile Combat: 40fps → ≥55fps
- Desktop: 60fps unverändert (no regression)
**Constraints**:
- C-01 (Spec): keine Game-Logic-Änderung — render-only
- C-04: keine visuelle Regression
- C-05: Procroom-Layouts unverändert
- 052-Dependency: `js/renderQuality.js` Mobile-Detect muss existieren
**Scale/Scope**: ungewiss bis FR-01 (Diagnose). Geschätzt 3-5 WPs nach Diagnose.

## Constitution Check

*GATE: Must pass before WP02 implementation starts.*

- ✅ **Diagnose-First** — keine Code-Änderung vor FR-01-Output. WP01 = pure Messung.
- ✅ **No new deps (C-02)** — Vanilla-JS + Phaser-built-ins only.
- ✅ **Desktop-Guard (C-03)** — jede Mitigation MUST Desktop-FPS ≥60 halten.
- ✅ **Visual-Quality-Guard (C-04)** — kein sichtbarer Quality-Drop akzeptabel.
- ✅ **052-Dependency** — `js/renderQuality.js` aus 052 WP02 muss gemerged sein.

## Project Structure

### Documentation (this feature)

```
kitty-specs/053-mobile-dungeon-performance/
├── plan.md              # Dieses File
├── spec.md              # ✅ vorhanden
├── tasks.md             # WP01..WP0N — Output
└── research/
    ├── mobile-perf-profile.md    # WP01-Output (Chrome DevTools Performance Recording)
    └── mitigation-results.md     # Pro implementierte Mitigation: Before/After FPS
```

### Source Code (Single project, kein neuer Strukturbedarf)

```
js/
├── renderQuality.js         # AUS 052 — Mobile-Detect-Helper, wird reused
├── roomTemplates.js         # WP-Target (FR-02/03): Texture-Atlas oder grössere Tiles
├── proceduralRooms.js       # WP-Target (FR-03): Off-Screen-Culling, Tile-Reduktion
├── eventSystem.js           # WP-Target (FR-04): Enemy-Pooling
├── loot.js                  # WP-Target (FR-04): Loot-Object-Pooling
└── fogOfWar.js              # WP-Target (FR-05): LOD-Update-Rate (falls existiert)
```

**Structure Decision**: keine neuen Files erforderlich. Optimierungen in
bestehenden Modulen, gated durch `RenderQuality.isMobile()`.

## Phase Breakdown

### Phase 0 — Diagnose (WP01)

**Ziel**: Top-5 Performance-Sinks identifizieren mit Chrome DevTools
Performance Recording auf echtem Mobile.

**Outputs**:
- `research/mobile-perf-profile.md` mit Top-5-Sinks + Quantifizierung
- Entscheidungs-Matrix: Welche FR (02/03/04/05) zuerst angehen

**Mess-Methodik**:
- Chrome Android: USB-Connect → chrome://inspect auf Desktop
- 30s Procroom-Spielzeit, Performance Recording
- Identifiziere Top-Function-Calls (CPU-Side) + Top-GL-Operations (GPU-Side)
- Memory-Snapshot vor + nach Procroom-Entry → Texture-Memory-Delta
- Counter pro Frame: Tile-Sprites, GameObjects, Texture-Bind-Calls

**Constraint**: Bevor irgendeine Mitigation impl., MUSS FR-01-Profile-Output existieren.

### Phase 1 — Top-Sink-Mitigation (WP02 oder WP03 oder WP04 oder WP05)

Welche FR zuerst hängt von FR-01-Output ab:
- Wenn **Texture-Memory** dominiert → FR-02 (Texture-Atlas/Pool)
- Wenn **Tile-Sprite-Count** dominiert → FR-03 (Tile-Reduktion/Culling)
- Wenn **GameObject-Lifecycle** dominiert → FR-04 (Enemy/Loot-Pooling)
- Wenn **FogOfWar-Update** dominiert → FR-05 (LOD)

Eine Mitigation per Phase. Re-Mess nach jeder.

### Phase 2..N — Weitere Sinks falls NFR nicht erreicht

Iterativ. Nach jeder Mitigation Re-Mess. Wenn Procroom <45fps → nächste
FR. Wenn ≥45fps → Combat checken. Wenn beide ≥ Ziel → DONE.

### Phase Final — NFR-Validierung (WP06+)

Endgültige Mess-Session vor Accept:
- Mobile Procroom ≥45 (idealerweise ≥55)
- Mobile Combat ≥55
- Desktop 60 (no regression)
- Visual A/B-Compare (Screenshots) → kein sichtbarer Unterschied
- 1 Playtester subjektiv "spielbar"

## Complexity Tracking

| Aspekt | Risk |
|--------|------|
| Diagnose-Phase | low — pure Messung |
| Texture-Atlas (falls FR-02) | high — touches Texture-Cache-Lifecycle, viele Test-Räume nötig |
| Tile-Reduktion (falls FR-03) | med — visuell sichtbar wenn zu aggressiv |
| Object-Pooling (falls FR-04) | med — touches Enemy/Loot-Lifecycle, Regression-Risk |
| FogOfWar-LOD (falls FR-05) | low — wenn existent, lokal change |

## Open Questions vor WP01

1. **Existiert `js/fogOfWar.js`?** Grep nötig. Falls nicht — FR-05 entfällt.
2. **Welches Mobile-Device wurde gemessen?** Pixel-Class war angenommen. Wenn anderes Device → Baseline könnte abweichen.
3. **iOS-Safari getestet?** Andere Bottlenecks möglich. Idealerweise WP01-Diagnose auf Chrome UND Safari.

Alle werden in WP01-Diagnose-Phase beantwortet.
