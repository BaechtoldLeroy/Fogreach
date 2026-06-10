# Specification: Mobile Dungeon Performance

**Feature**: 053-mobile-dungeon-performance
**Created**: 2026-06-10
**Mission**: software-dev
**Tracker**: Surfaced durch WP01-Baseline-Messung von Feature 052 — Mobile reisst NFR-01 schon JETZT, vor jeder Render-Quality-Änderung.
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

WP01-Baseline-Messung (2026-06-10, dokumentiert in
`kitty-specs/052-render-resolution-quality/research/baseline-fps.md`)
hat gezeigt: **Mobile-FPS im Dungeon ist seit längerem unter playable-
Schwelle.**

| Scene             | Desktop | Mobile     |
|-------------------|---------|------------|
| Hub (HubSceneV2)  | 60      | 60         |
| Combat-Room       | 60      | **40**     |
| Procedural-Room   | 60      | **20**     |

Procrooms haben 104×88 = 9152 Tiles plus runtime-generated Floor/Wall/
Obstacle-Texturen. 20fps fühlt sich auf Mobile **unspielbar an** — der
Procroom-Anteil der Dungeon-Erfahrung ist ein Drittel der Spielzeit.

Feature 052 (Render Quality) wurde reframed: Quality-Levers shippen nur
auf Desktop; Mobile-Render-Path bleibt unangetastet. Das löst aber
nicht das Mobile-Perf-Problem das hier ZU LÖSEN ist.

Dieses Feature ist eine **Perf-Rescue-Operation**, nicht ein neues
Feature im klassischen Sinn. Ziel: Mobile auf playable bringen ohne
visuelle Regression auf Desktop.

## 2. Stakeholders & Actors

- **Mobile-Spieler (Pixel-class, 2-3× DPR)** — primärer Beneficiary.
  Aktuell 20fps in Procrooms = Frust, evtl. Drop-out.
- **Donor-Demo-Tester auf Mobile** — Donor-Strategie braucht spielbare
  Erfahrung auf ihren Geräten.
- **Desktop-Spieler** — sollen ZERO sichtbare Regression sehen.
- **Procedural-Dungeon-System** (`js/roomTemplates.js`,
  `js/proceduralRooms.js`) — wird wahrscheinlich angefasst.
- **Render-Pipeline** (Phaser 3.70 ScaleManager, TextureManager) —
  möglicherweise Settings-Tweaks.

## 3. User Scenarios

### Primary: Mobile-Spieler im Procroom

1. Vor 053: Spieler betritt Procroom → FPS auf 20 → laggige Steuerung,
   verzögertes Combat-Feedback, langsame Tile-Scroll-Renderings.
2. Nach 053: Spieler betritt Procroom → FPS ≥45 (= unscharf aber
   spielbar) oder ≥55 (= NFR-konform).
3. Visuelle Qualität: gleichwertig zu vor 053 (keine sichtbare
   Texture-Auflösungs-Reduktion).

### Primary: Mobile-Spieler im Combat

1. Vor 053: Combat bei 40fps — minimal akzeptabel, aber Combos und
   Dodges fühlen sich verspätet an.
2. Nach 053: Combat ≥55fps — flüssig.

### Edge case: Desktop-Spieler

1. Vor 053: 60fps überall.
2. Nach 053: 60fps überall (= unverändert). Falls eine 053-Optimierung
   Desktop-FPS reduziert (z.B. weniger Sprite-Detail) → revertieren oder
   per Mobile-Detect ausschliessen.

## 4. Functional Requirements

| ID    | Requirement | Status |
|-------|-------------|--------|
| FR-01 | **Diagnose-Phase**: Profile Mobile-Dungeon mit Chrome DevTools Performance Recording. Identifiziere Top-5-Performance-Sinks (GPU vs CPU, Texture-Memory, Tile-Render-Cost, Enemy-Pool-Overhead, FogOfWar-Update). Output: `research/mobile-perf-profile.md`. | Draft |
| FR-02 | **Texture-Atlas oder Texture-Pooling**: Wenn FR-01 zeigt dass Texture-Memory-Bandwidth dominant ist — implementiere Texture-Atlas für Floor/Wall/Obstacle-Texturen ODER LRU-Texture-Pool. | Draft |
| FR-03 | **Tile-Render-Optimierung**: Wenn FR-01 zeigt dass Tile-Sprite-Count dominant ist — reduziere Tile-Count via grössere Tiles, Off-Screen-Culling, oder Pre-Composed Floor-Textures pro Room. | Draft |
| FR-04 | **Enemy/Loot-Object-Pooling**: Wenn FR-01 zeigt dass GameObject-Lifecycle (create/destroy) dominant ist — implementiere Pool für Enemies, Projectiles, Loot. | Draft |
| FR-05 | **FogOfWar-LOD**: Wenn FR-01 zeigt dass FogOfWar-Updates dominant sind — Lower-Resolution-Fog-Grid auf Mobile, Update-Rate halbiert. | Draft |
| FR-06 | **Mobile-Detection zentralisieren**: Re-use der Detection-Logic aus 052 (`js/renderQuality.js`). Mobile-only-Optimierungen über zentralen Flag, kein verstreuter UserAgent-Sniff. | Draft |
| FR-07 | **NFR-01-Validierung**: Post-FR-02/03/04/05 erneute Baseline-Messung. Procroom MUSS ≥45fps; Combat MUSS ≥55fps. Sonst weitere Optimierung. | Draft |

## 5. Non-Functional Requirements

| ID     | Requirement | Threshold |
|--------|-------------|-----------|
| NFR-01 | Mobile FPS in Procroom MUST ≥ 45 (minimal playable). Ziel ≥ 55 (NFR-konform). | Pixel-class Mid-tier |
| NFR-02 | Mobile FPS in Combat MUST ≥ 55. | Pixel-class Mid-tier |
| NFR-03 | Desktop FPS MUST stay 60 (no regression). | 1080p Standard |
| NFR-04 | Texture-Memory MUST NOT exceed +20MB vs. heute. | DevTools Memory Tab |
| NFR-05 | Initial Load-Time MUST NOT exceed +5% vs. heute. | Cold-Load-Comparison |
| NFR-06 | Visuelle Qualität auf Mobile darf NICHT sichtbar schlechter als heute. Subjective: 1 Playtester bestätigt. | Subjective check |

## 6. Constraints

| ID    | Constraint |
|-------|------------|
| C-01  | KEINE Änderung der Game-Logic. Optimierung ist render-only. Combat-Damage, Hit-Detection, Story-Flags etc. unangetastet. |
| C-02  | KEINE neuen Dependencies. Phaser-built-ins, Vanilla-JS. |
| C-03  | Desktop-Performance darf NICHT reduziert werden. Wenn eine Optimierung Desktop verlangsamt → Mobile-only. |
| C-04  | KEINE visuelle Regression. Wenn eine Optimierung sichtbar Quality reduziert → andere Strategie. |
| C-05  | Procroom-Layouts (Tile-Patterns, Wall-Placements) bleiben identisch — Optimierung ist Render-Pipeline, nicht Level-Design. |
| C-06  | `pixelArt: true` bleibt aktiv (siehe 052 C-01 und `main.js:80-84` — Proc-Texturen brauchen NEAREST). |

## 7. Success Criteria

| ID    | Criterion |
|-------|-----------|
| SC-01 | Mobile Procroom-FPS ≥ 45 (gemessen via Baseline-Methodik). |
| SC-02 | Mobile Combat-FPS ≥ 55. |
| SC-03 | Desktop FPS auf 60 (= unverändert). |
| SC-04 | Alle 251 Tests grün. |
| SC-05 | Visueller Diff-Check: 5 Screenshots (Hub, 2 Procrooms, Combat, Boss) vor/nach 053. Kein sichtbarer Unterschied auf Desktop. |
| SC-06 | Mindestens 1 Playtester bestätigt subjektiv "spielbar" auf Mobile-Procroom. |

## 8. Edge Cases

- **Low-end Android (1× DPR)**: Sollte schon vorher OK gewesen sein, validieren.
- **iOS Safari**: Andere WebGL-Implementierung — kann andere Bottlenecks haben als Chrome.
- **Procroom mit MANY Enemies (8328 enemies x3 laut log)**: Worst-case. Spezielle Aufmerksamkeit in FR-04.
- **Boss-Räume**: Pre-built (nicht proc) aber große Sprites. Eigener Mess-Punkt.

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| `js/roomTemplates.js` | Wo Floor/Wall/Obstacle-Texturen runtime generiert werden — FR-02-Target. |
| `js/proceduralRooms.js` | Procroom-Layout-Logic, Tile-Generation — FR-03-Target. |
| `js/eventSystem.js` + Enemy-Spawn | GameObject-Lifecycle — FR-04-Target. |
| `js/fogOfWar.js` (falls existiert) | Fog-Update-Pipeline — FR-05-Target. |
| `js/renderQuality.js` (von 052) | Mobile-Detection-Helper — FR-06-Reuse. |
| Phaser ScaleManager (3.70) | Render-Pipeline-Layer; eventuell scale.mode-Anpassung. |

## 10. Assumptions

- Mobile-Bottleneck ist GPU-bound (Texture-Sampling + Fragment-Shader),
  nicht CPU-bound. Wird in FR-01 validiert.
- Procroom-104×88-Grids sind übergroß für Mobile-GPU. Wird in FR-01 validiert.
- Pre-built Combat-Rooms (CirclePillars etc.) sind weniger problematisch
  als Procrooms. Wird in FR-01 validiert.

## 11. Out of Scope

- **Visuelle Quality-Verbesserung** auf Mobile — Aufgabe von 052.
- **Combat-System-Änderungen** — Render-only, Game-Logic unangetastet (C-01).
- **Level-Design-Änderungen** — Layouts bleiben (C-05).
- **Asset-Re-Authoring** — bestehende Texturen weiterverwenden.

## 12. Dependencies

- Feature 052 MUSS vorher gemerged sein für `js/renderQuality.js` Mobile-Detection-Helper.
- WP01-Baseline (`052/research/baseline-fps.md`) ist die Ausgangs-Messung.

## 13. Risks

- **R-01 — Optimierung reduziert Visuelle Quality**: FogOfWar-LOD oder
  Tile-Reduktion könnte sichtbar werden. Mitigation: A/B-Screenshot-Compare,
  Playtester-Check.
- **R-02 — Desktop-Regression**: Eine Mobile-Optimierung könnte Desktop
  unbeabsichtigt verlangsamen. Mitigation: Mobile-Detect für jede
  Mobile-only-Mitigation.
- **R-03 — Bottleneck-Falsche-Identifikation**: FR-01-Diagnose könnte
  falsche Top-5 ergeben. Mitigation: Mehrere Devices messen, Chrome-
  Tracing UND Safari-Profiling verwenden.
- **R-04 — Texture-Atlas-Komplexität**: Runtime-generated Floor-Texturen
  per Room sind heute "fresh per room". Atlasing erfordert Re-Architecting
  des Texture-Cache. Möglicherweise grösser als initial geschätzt.

## 14. References

- `kitty-specs/052-render-resolution-quality/research/baseline-fps.md` — die auslösende Messung
- `kitty-specs/052-render-resolution-quality/research/linear-filter-inventory.md` — Texture-Inventar
- `js/main.js:80-84` — pixelArt-Landmine-Comment
- `js/roomTemplates.js` — Tile-Generation
- ROADMAP.md Phase 3 — wo 053 reinpasst
