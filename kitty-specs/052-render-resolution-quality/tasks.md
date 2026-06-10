# Tasks: 052 — Render Resolution Quality

**Status**: WP01 done. WP02-WP06 ready to claim.
**Plan**: [plan.md](plan.md)
**Spec**: [spec.md](spec.md)

## Work Package Overview

| WP   | Title                                  | Status       | Depends-on | Risk |
|------|----------------------------------------|--------------|------------|------|
| WP01 | Baseline-FPS-Messung                   | ✅ Done      | —          | none |
| WP02 | RenderQuality-Helper + Mobile-Detect   | ✅ Done      | WP01       | low  |
| WP03 | LINEAR-Filter-Audit beidseitig         | ✅ Done      | WP02       | low  |
| WP04 | Desktop DPR-Resolution                 | ❌ Deferred  | WP02       | med  |
| WP05 | Desktop Canvas-Bump 960→1920           | ❌ Deferred  | WP02, WP04 | high |
| WP06 | Settings-Toggle "Render-Qualität"      | ❌ Deferred  | WP02       | low  |

**WP04/WP05 Deferral-Reason**: Implementiert + revertiert. Phaser 3.70
ScaleManager koppelt gameSize an scale.width (verifiziert via Source-
Read), keine config-only Lösung. Working pattern erfordert ~70 LoC
Post-Boot Canvas-Hack mit WebGL-State-Patches + per-Text setResolution.
ROI zu schlecht für den marginalen Schärfe-Gewinn über WP03 hinaus.
Verschoben auf zukünftiges Feature (054+) falls jemand das Pattern
sauber löst.

**WP06 Deferral-Reason**: Settings-Toggle braucht togglebare Levers.
Ohne WP04/WP05 ist nichts zu togglen. WP03 ist Default-on.

---

## WP01 — Baseline-FPS-Messung ✅ DONE

**Output**: `research/baseline-fps.md`

Gemessen 2026-06-10:
- Desktop: 60fps überall (cap)
- Mobile Hub: 60, Combat: 40, Procroom: 20

Plus FPS-Overlay-Infrastructure als Side-Effect:
- `js/performanceMonitor.js` instrumentiert
- P-Taste-Binding in HubSceneV2 + GameScene
- Burger-Menu-Entry "FPS Overlay" für Mobile
- Defensive try/catch im PerformanceMonitor (Phaser-Texture-Quirk-Workaround)

---

## WP02 — RenderQuality-Helper + Mobile-Detect

**Risk**: low. Zero User-Visible-Change. Setzt Infrastruktur für WP03-WP06.

### Acceptance Criteria
- `js/renderQuality.js` existiert als neues Module
- Exports: `isMobile()`, `getDPR()` (capped at 2), `applyLinearFilter(scene, keys, opts)`, `applyLinearFilterByPrefix(scene, prefixes, opts)`
- `isMobile()` Detection-Logic: `matchMedia('(pointer: coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)` (Fallback-Chain)
- Tests in `tests/renderQualityTest.js`: Detection-Logic mocked + `applyLinearFilter` no-op-bei-fehlender-Texture
- Alle 251 Tests grün + neue Tests
- Zero Behavior-Change in der App (Helper noch nicht aufgerufen)

### Files
- Create: `js/renderQuality.js`
- Create: `tests/renderQualityTest.js`
- Edit: `index.html` (Script-Tag für renderQuality.js VOR main.js)
- Edit: `tools/runTests.js` (registriere neuen Test)

### Verification
- `node tools/runTests.js` → 251+N tests passing
- Browser: keine Changes sichtbar
- DevTools: `window.RenderQuality.isMobile()` returns boolean

---

## WP03 — LINEAR-Filter-Audit beidseitig

**Risk**: low. Zero Perf-Kosten. Sichtbarer Quality-Gewinn beidseitig.

### Acceptance Criteria
- LINEAR-Filter angewendet auf alle Non-Proc-Texturen aus `research/linear-filter-inventory.md`
- Bestehender 051-Block in `HubSceneV2.js:121-143` ersetzt durch Helper-Call
- Player-Sprites bekommen LINEAR **POST-Normalisierungs-Swap** (player.js:204 gotcha)
- Cellar-Assets (`rathauskeller_bg`, `elara_right0`) gefiltert
- Q5-Merchant-Respawn (`eventSystem.js:948` runtime-load) hooked via `load.once('complete')`
- Proc-Texturen (alles `generateTexture`/`createCanvas`-basiert) UNANGETASTET (C-01)
- Visueller A/B-Compare: Hub-NPCs + UI deutlich schärfer; Procroom identisch
- Mobile-FPS unverändert (Baseline-Re-Mess)

### Files
- Edit: `js/scenes/startScene.js:137-241` (apply filter post-preload)
- Edit: `js/scenes/HubSceneV2.js:121-143` (replace inline with helper)
- Edit: `js/player.js` (POST-normalizePlayerDirectionalFrames apply filter)
- Edit: `js/main.js` cellar preload (filter `rathauskeller_bg`, `elara_right0`)
- Edit: `js/eventSystem.js:948` (filter on lazy-load complete)

### Verification
- Browser DevTools → Sprites: filter='LINEAR' für Hub-NPCs, NEAREST für Proc-Tiles
- Screenshot-Compare: Hub vor/nach
- Tests grün
- Mobile-Re-Mess: Procroom bleibt 20fps, Combat 40fps (kein Regression)

---

## WP04 — Desktop DPR-Resolution

**Risk**: medium. Touches Phaser config core.

### Acceptance Criteria
- `main.js:91-99` scale-block angepasst nach Pattern aus `research/phaser-resolution-config.md` §9
- DPR-Multiplikation NUR wenn `!RenderQuality.isMobile()`
- DPR gecapped auf 2 (Cap-Constant in renderQuality.js)
- World-Coords bleiben 960×480 (`scale.zoom` adjustiert)
- Mobile: keine Änderung der Render-Pipeline
- Desktop 1080p/1440p/4K: sichtbarer Schärfe-Gewinn auf NPCs/Background
- Proc-Texturen rendern unverändert (FR-07, C-01)
- iframe-Edge-Case: `typeof window.devicePixelRatio === 'number'` Fallback auf DPR=1

### Files
- Edit: `js/main.js:91-99` (scale config)

### Verification
- Desktop: visuell schärfer, FPS bleibt 60
- Mobile: identisch zu vor WP04 (FPS unverändert, Quality unverändert)
- Tests grün
- DevTools → Canvas-Size auf Desktop: 1920×960 oder 2880×1440 (DPR-abhängig). Mobile: 960×480 unverändert.

---

## WP05 — Desktop Canvas-Bump 960→1920

**Risk**: high. UI-Layout-Risiko + interaktive Test-Phase nötig.

### Acceptance Criteria
- **PRE-Step**: 4 RED-Sites in `main.js` aus `research/canvas-bump-layout-risks.md` gefixt:
  - `:1061-1062` Rathauskeller-BG: `(480, 240)` → `(cw/2, ch/2)`
  - `:1948` gameOverText: `(400, 300)` → `(cw/2, ch/2 + 60)`
  - `:1951` levelUpText: `(400, 150)` → `(cw/2, ch/4)`
  - `:1810-1830` Highscores: relativ via `cw`/`ch`
- Canvas-Config auf Desktop: 1920×960 internal (NUR wenn `!isMobile()`)
- Mobile: keine Änderung (skipped via Helper)
- Alle 8 YELLOW-Sites manuell durchklicken auf Desktop nach Bump
- Inkl: HUDv2 Burger-Menu (340px Panel), Stats-Menu (360px Panel), Mobile-Controls-Sizes
- Desktop FPS bleibt 60 (NFR-02)
- Mobile-FPS unverändert

### Files
- Edit: `js/main.js` (scale.width/height + 4 RED-Site-Coordinates)
- Optional Edit: `js/hudV2.js` (YELLOW: Panel-Sizes anpassen wenn sichtbar zu klein)
- Optional Edit: `js/mobileControls.js` (`__MOBILE_BUTTON_SCALE__` Knob)

### Verification
- **Manual Test-Plan** aus `research/canvas-bump-layout-risks.md` durchlaufen:
  - Hub: NPCs + Modals
  - Combat: HUD + Skill-Buttons
  - Boss-Room
  - Game-Over-Splash
  - Level-Up
  - Settings/Crafting/PrintingHouse Modals
- Screenshot-Compare Desktop: deutlich schärfer
- Mobile: unverändert
- Tests grün

---

## WP06 — Settings-Toggle "Render-Qualität"

**Risk**: low. UI-only.

### Acceptance Criteria
- `SettingsScene.js` neue Toggle-Row "Render-Qualität"
- Desktop: 3 Optionen Niedrig/Mittel/Hoch
  - Niedrig: 960×480, kein DPR, kein Canvas-Bump (= aktueller Zustand)
  - Mittel: DPR aktiv, kein Canvas-Bump (= WP04 only)
  - Hoch: DPR + Canvas-Bump (= WP04 + WP05)
- Mobile: readonly Text "FPS-optimiert für dein Gerät"
- Persistierung: `localStorage.demonfall_settings_v1.gameplay.renderQuality`
- Default Desktop: "Mittel"
- Default Mobile: "Niedrig" (de-facto)
- Apply-on-next-scene-transition (C-06) — Hinweis "Wirkt beim nächsten Szenenwechsel" beim Toggle

### Files
- Edit: `js/scenes/SettingsScene.js` (neue Row)
- Edit: `js/main.js` (Phaser-Config liest renderQuality-Setting beim Boot)
- Edit: `js/persistence.js` falls Settings-Schema dort definiert

### Verification
- Settings öffnen → Toggle sichtbar
- Toggle ändern → Reload → Quality-Stufe aktiv
- Persistierung in `localStorage` checkbar
- Mobile-Browser: Toggle als readonly
- Tests grün

---

## Cross-WP Verification (Acceptance Gate)

Nach WP06 vor Feature-Accept:
- Alle 251 Tests grün
- Desktop Quality-Tour: Niedrig vs Mittel vs Hoch sichtbar unterschiedlich
- Mobile-Re-Mess: Hub 60, Combat 40, Procroom 20 unverändert (= Baseline-respektiert)
- Q1-Q6 Quest-Chain Re-Playthrough auf Desktop + Mobile ohne neue Bugs
- ROADMAP.md updaten (053 explizit erwähnen als Follow-up)
