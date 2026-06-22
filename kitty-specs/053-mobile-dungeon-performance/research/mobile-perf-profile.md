# WP01 — Mobile-Diagnose-Profile & Ergebnisse (Feature 053)

**Status**: ✅ Diagnose + Fix abgeschlossen. Procroom 20→60fps.
**Datum**: 2026-06-19 bis 2026-06-22
**Spec**: [../spec.md](../spec.md) · **Tasks**: [../tasks.md](../tasks.md)

---

## 0. Mess-Setup

| Feld | Wert |
|------|------|
| Methodik | `index.html?perf=1` → `js/perfProbe.js`-Overlay (FPS, #Objects, #Bodies, Draw-Calls/Frame, Typ-Histogramm, ~VRAM, JS-Heap) + Live-Toggle-Buttons (FOG/MASK/SPOT/EXPL) zur Subsystem-Isolation + URL-Tuner (`explRes/fogInterval/rays`). |
| Test-Umgebung | GitHub Pages (`baechtoldleroy.github.io/Fogreach/?perf=1`), echtes Mobile-Gerät über Browser (kein USB/DevTools nötig). |

**Instrumentierung** `js/perfProbe.js` — No-Op außer bei `?perf=1`, bleibt
als Dev-Tool im Repo.

---

## 1. Baseline (gemessen)

| Kontext | Draws | static bodies | Typen | ~VRAM | Heap | FPS |
|---------|-------|---------------|-------|-------|------|-----|
| Cavern  | 290   | 231 | — | 76 MB | 20.7 | 35 |
| Procroom| 340   | 307 | SPR:269 IMG:186 TS:91 TXT:65 | 103 MB | 20.7 | **20** |

---

## 2. Diagnose-Verlauf (Toggle-Isolation)

Jeder Schritt durch Live-Toggle bewiesen, nicht geraten:

1. **Draw-Calls sind NICHT der Sink.** Off-Screen-Culling senkte Draws
   380→115, FPS unverändert. → Culling wieder entfernt.
2. **Kein GC/Allokations-Sink.** JS-Heap in allen Kontexten stabil
   (20.7 MB) → FR-04 (Object-Pooling) gestrichen.
3. **`js/fogOfWar.js` existiert nicht** — Fog ist inline in
   `js/roomManager.js`. FR-05-Scope geklärt.
4. **Fog-of-War ist der GESAMTE Procroom-Sink.** FOG-Toggle aus → 20→**60**fps.
5. Fog-Teilkosten (alles per Live-Toggle):
   - **`spotlightRT`** (RenderTexture fill+erase/Tick) ≈ **50 ms/Update** —
     der teuerste Einzelteil (RT-Framebuffer-Ops stallen den Tile-GPU).
   - **`exploredRT.draw`** (welt-große 37 MB-RT/Tick) + Raycasting ≈ 18 ms.
   - **BitmapMask** (`fogUnseen`) ≈ 0 ms (MASK-Toggle).

---

## 3. Umgesetzte Fixes

| WP/Fix | Maßnahme | Effekt |
|--------|----------|--------|
| WP02 | Deko-Graphics konsolidiert (~80→4 Objekte) | Draws ↓, kein FPS-Effekt; harmlos behalten |
| WP03 | ~~Off-Screen-Culling~~ | 0 FPS-Nutzen → **entfernt** |
| WP04 | **Spotlight: RenderTexture → statische Graphics + invertierte Geometry-Mask** | 20→36 fps |
| WP05 | Mobile Fog-Update-Intervall 2→3 (final 4) | unterstützend |
| Fix | **VISION_RAYS Load-Order-Bug** (war immer 180 Desktop statt 90 Mobile) | 35→38 fps |
| WP06 | **exploredRT halb→viertel-aufgelöst** (37→~2 MB, Stamp ×_exploredRes, Anzeige hochskaliert) | 38→45→**60** fps |
| WP07 | Finale Mobile-Defaults gebacken: `explRes 0.25`, `fogInterval 4`, `rays 64` | Procroom + Combat **60 fps** |

---

## 4. Ergebnis vs. NFR

| Kriterium | Ziel | Ergebnis |
|-----------|------|----------|
| NFR-01 Procroom-FPS | ≥ 45 | **60** ✅ |
| NFR-02 Combat-FPS | ≥ 55 | **60** ✅ (in sehr dichten Kämpfen evtl. ~47, dann gegner- nicht fog-bedingt) |
| NFR-03 Desktop unverändert | 60 | ✅ (alle Mobile-Pfade `isMobile`-gated, Desktop-Werte unberührt) |
| NFR-06 keine sichtbare Regression | subjektiv | ✅ User bestätigt Fog + Grafik sauber bei explRes 0.25 |

---

## 5. Restposten / Folge-Arbeit

- **Combat-Gegner-Ceiling**: FOG aus brachte Combat (in dichtem Kampf) nur
  38→47 → ein **Gegner-Perf-Ceiling** (AI/Physik/Projektile), unabhängig
  vom Fog. Aktuell durch die Fog-Fixes überdeckt (60 fps), kann bei vielen
  Gegnern wieder greifen → optionaler separater Gegner-Perf-Pass für
  garantierte 55+ im Worst-Case.
- **Diagnose-Tool** (`js/perfProbe.js` + `__PERF`-Hooks in roomManager)
  bleibt auf User-Wunsch als Dev-Werkzeug (no-op ohne `?perf=1`).
