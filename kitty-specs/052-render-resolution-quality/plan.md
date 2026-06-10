# Implementation Plan: 052 — Render Resolution Quality

**Branch**: `main` (planning + small-blast-radius shipping per project workflow)
**Date**: 2026-06-10
**Spec**: [spec.md](spec.md)

## Summary

Sprites in Fogreach rendern weich, weil das Phaser-Canvas auf fixe **960×480** internal resolution gesetzt ist und der Browser auf 1080p–4K hochskaliert (2-4× Stretch). Per-Texture LINEAR-Override (aus 051) hilft punktuell, kann den strukturellen Soft-Look aber nicht eliminieren.

> **REVISION 2026-06-10**: WP01-Baseline zeigt Mobile bei 20fps Procroom /
> 40fps Combat. Plus Phaser 3.70 hat keinen `scale.resolution`-Key mehr.
> Plan komplett reframed: Quality-Levers nur Desktop. Mobile-Render-Path
> unangetastet. Siehe `research/baseline-fps.md` und
> `research/phaser-resolution-config.md`.

Das Feature shipped **drei voneinander unabhängige Quality-Levers
Desktop-only** plus einen plattformübergreifenden LINEAR-Audit, gated
durch zentralisierten Mobile-Detect:

1. **WP01 Baseline-FPS-Messung** — ✅ DONE 2026-06-10. Output: `research/baseline-fps.md`.
2. **WP02 RenderQuality-Helper + Mobile-Detect** — `js/renderQuality.js` (neu) mit `isMobile()`, `applyLinearFilter()`. FR-06 + C-07. Zero User-Visible-Change.
3. **WP03 LINEAR-Filter-Audit** — Helper aus WP02 anwenden auf alle Non-Proc-Texturen (Hub-BG, NPCs, Player-Sprites POST-Normalisierung, Icons, UI). FR-03. **Beide Plattformen** — zero Perf-Kosten.
4. **WP04 Desktop DPR-Resolution** — `scale.width × DPR`, `scale.height × DPR`, `scale.zoom / DPR`, DPR-Cap=2. Mobile-skipped via WP02-Helper. FR-02.
5. **WP05 Desktop Canvas-Bump 960→1920** — Plus 4 RED-Sites in `main.js` fixen (siehe `research/canvas-bump-layout-risks.md`). Mobile-skipped. FR-04.
6. **WP06 Settings-Toggle "Render-Qualität"** — Desktop: Niedrig/Mittel/Hoch. Mobile: readonly Info. FR-05.

Jeder WP wird einzeln gemessen und einzeln gemerged. NFR-Gate post-jedem:
Desktop bleibt 60, Mobile fällt nicht unter Baseline (20/40/60).

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2015+), Phaser 3 (siehe `node_modules/phaser/package.json` für exakte Version vor WP02)
**Primary Dependencies**: Phaser 3 (Scale Manager, Texture Filter API)
**Storage**: `localStorage.demonfall_settings_v1` (nested-key Pattern aus 045/050/051)
**Testing**: `node tools/runTests.js` (251 Tests, müssen alle grün bleiben — SC-04)
**Target Platform**: Browser (Desktop 1080p/1440p/4K, Mobile Pixel-class 2-3× DPR)
**Project Type**: Single-page Phaser-Spiel, kein Backend
**Performance Goals**: Desktop ≥60fps (NFR-02), Mobile ≥55fps (NFR-01)
**Constraints**: `pixelArt: true` ist load-bearing für Proc-Dungeon — DARF NICHT global deaktiviert werden (C-01)
**Scale/Scope**: 1 Settings-Toggle, 1-3 Lever-Combos, ~5 UI-Scenes für C-04-Audit

## Constitution Check

*GATE: Must pass before WP02 implementation starts.*

- ✅ **Test-First (paradigm-test-first.md)** — WP01 = Messung, deren Output (Baseline-FPS) ist der Test, gegen den jeder Lever in WP02/WP04 misst.
- ✅ **No new deps (C-02)** — Phaser-built-in scale/resolution config only.
- ✅ **Mobile-perf-floor (C-03 + NFR-01)** — Hard-Revert-Gate bei <55fps Mobile.
- ✅ **051-Polish-Pattern (Quellref C-04)** — LINEAR-Override ist proven-shape, WP03 erweitert nur die Liste.

## Project Structure

### Documentation (this feature)

```
kitty-specs/052-render-resolution-quality/
├── plan.md              # Dieses File
├── spec.md              # ✅ vorhanden
├── tasks.md             # WP01..WP05 — Output von /spec-kitty.tasks
├── checklists/          # ✅ vorhanden
└── research/            # ✅ vorhanden (FPS-Mess-Methodik kommt hier rein post-WP01)
```

### Source Code (Single project, kein neuer Strukturbedarf)

```
js/
├── main.js                          # Phaser config (pixelArt, scale.width/height/resolution) — WP02/WP04
├── performanceMonitor.js            # Baseline-Mess-Instrument — WP01
├── scenes/
│   ├── HubSceneV2.js               # Existing LINEAR-Override-Pattern — WP03 referenziert
│   ├── SettingsScene.js            # Toggle "Render-Qualität" — WP05
│   └── ...                          # Alle 5 UI-Scenes für C-04-Audit
├── roomTemplates.js                 # Proc-Texture-Pipeline — NICHT angefasst (C-01)
└── proceduralRooms.js              # dito
```

**Structure Decision**: Keine neuen Files, nur Edits in bestehenden. Settings persistieren via existierendem `demonfall_settings_v1` Pattern (C-05). `window.__RENDER_QUALITY__` als Surface-Flag.

## Phase Breakdown

### Phase 0 — Research (WP01)

**Ziel**: Baseline + Lever-Effekt-Mess-Matrix erzeugen.

**Outputs**:
- `research/baseline-fps.md` — FPS auf Desktop-1080p, Desktop-1440p, Mobile Pixel-class. Hub + Combat + Procroom je 30s.
- `research/lever-impact-matrix.md` — Nach WP02/WP03/WP04 jeweils gemessen und appendet.

**Constraint**: Bevor irgendein Code geändert wird, muss die Baseline existieren.

### Phase 1 — Lever 1 (WP02)

`resolution: window.devicePixelRatio` in Phaser scale config. Vollen Q1-Q6 Chain durchlaufen + 3 Procrooms (FR-02). Wenn proc-textures brechen → revert, Doku in `research/lever-1-procbreak.md`, weiter zu Phase 2 ohne Lever 1.

### Phase 2 — LINEAR-Audit (WP03)

Pattern aus `HubSceneV2.create:124-141` extrahieren in shared Helper (`js/renderQuality.js`?) und auf alle Non-Proc-Texturen anwenden. Liste der Touchpoints aus C-04 + Spec §2.

### Phase 3 — Canvas-Bump (WP04)

960×480 → 1920×960. Gated auf Mobile FPS ≥55 nach WP02+WP03. Vorher: jede UI-Scene auf Layout-Brüche prüfen (C-04, FR-06).

### Phase 4 — Settings-Toggle (WP05)

Neue Settings-Key `gameplay.renderQuality: "low" | "medium" | "high"`, Default `"medium"`. UI-Row in `SettingsScene`, apply-on-next-scene-transition (C-06).

## Complexity Tracking

Keine Constitution-Violations. Single-Project, keine neuen Pattern.

## Open Questions vor WP01

1. **Phaser-Version** — `node_modules/phaser/package.json` prüfen, ob `scale.resolution` in dieser Version unterstützt wird (Assumption #1 in Spec).
2. **`performanceMonitor.js` Lese-API** — gibt es eine `getCurrentFPS()` o.ä. oder muss Instrumentierung gebaut werden? (Assumption #4 in Spec)

Beide werden in WP01 mit-beantwortet.
