# WP01 — Mobile-Diagnose-Profile (Feature 053)

**Status**: 🟡 In Arbeit — Instrumentierung steht, Mess-Werte ausstehend.
**Datum**: 2026-06-19
**Spec**: [../spec.md](../spec.md) · **Tasks**: [../tasks.md](../tasks.md) (WP01)

---

## 0. Mess-Setup

| Feld | Wert |
|------|------|
| Device-Modell | _(ausfüllen)_ |
| OS / Browser | _(ausfüllen, z.B. Android 14 / Chrome 1xx)_ |
| DPR | _(ausfüllen)_ |
| Mess-Methodik | `index.html?perf=1` → `js/perfProbe.js`-Overlay (FPS, #Objects, #Bodies, Draw-Calls/Frame, #Texturen, ~VRAM, JS-Heap). Pro Kontext ~20–30s stehen, dann **⤓ DUMP** tippen. |

**Instrumentierung**: `js/perfProbe.js` (No-Op außer bei `?perf=1`).
Ergänzt das bestehende FPS-Overlay (P-Taste / Burger-Menu) um die in
WP01 geforderten Frame-Counter.

---

## 1. Architektur-Befunde (verifiziert, code-only, 2026-06-19)

Diese Punkte sind **ohne Device** aus dem Code geklärt — sie schärfen
den Scope der FR-Wahl:

- **FR-05 (FogOfWar-LOD) — Scope geklärt:** `js/fogOfWar.js` **existiert
  nicht**. Fog-Logik ist inline verteilt in `js/main.js`,
  `js/roomManager.js`, `js/player.js`, `js/eliteEnemies.js`. → Kein
  isoliertes Fog-Modul für ein sauberes LOD; falls Fog ein Top-Sink ist,
  braucht FR-05 erst ein Extrahieren/Lokalisieren der Update-Schleife.
- **Procroom-Grid:** 104×88 = 9152 Tile-Zellen (Spec §1). Floor/Wall/
  Obstacle-Texturen werden runtime pro Room generiert
  (`js/roomTemplates.js`, `js/proceduralRooms.js`).
- **Render-Config:** `pixelArt: true` + `roundPixels: true`, Canvas
  960×480, `Phaser.Scale.FIT`, `antialias: false` (`js/main.js:87-113`).
  `pixelArt` ist Pflicht (NEAREST) für die Proc-Texturen — Landmine-
  Kommentar `js/main.js:88-94`.
- **Mobile-Detection-Helper:** `js/renderQuality.js` (aus 052) für FR-06
  vorhanden — zentral wiederverwenden, kein verstreuter UA-Sniff.

---

## 2. FPS-Baseline (zu re-messen mit Probe)

Vorläufig aus 052-Baseline (2026-06-10, nur FPS, kein Counter-Kontext):

| Kontext            | Desktop | Mobile (alt) | Mobile (Probe) | Ziel |
|--------------------|---------|--------------|----------------|------|
| Hub (HubSceneV2)   | 60      | 60           | _(—)_          | ≥55  |
| Combat-Room        | 60      | 40           | _(—)_          | ≥55 (NFR-02) |
| Procedural-Room    | 60      | **20**       | _(—)_          | ≥45 (NFR-01) |

---

## 3. Frame-Counter pro Kontext (Probe-Output)

Aus `window.__perfDump()` / **⤓ DUMP** — pro Kontext fpsMin/fpsAvg,
objMax (GameObjects rekursiv), drawMax (Draw-Calls/Frame), texMb (~VRAM):

| Kontext        | fpsMin | fpsAvg | objMax | bodies | drawMax | ~VRAM |
|----------------|--------|--------|--------|--------|---------|-------|
| Hub            | _(—)_  | _(—)_  | _(—)_  | _(—)_  | _(—)_   | _(—)_ |
| Combat-Room    | _(—)_  | _(—)_  | _(—)_  | _(—)_  | _(—)_   | _(—)_ |
| Procroom       | _(—)_  | _(—)_  | _(—)_  | _(—)_  | _(—)_   | _(—)_ |

**Memory-Delta beim Procroom-Entry** (JS-Heap vorher→nachher): _(—)_

---

## 4. CPU-Profil (Chrome DevTools, optional via USB)

_Nur falls eine USB-DevTools-Session gemacht wird. Top-5-CPU-Funktionen
pro Frame im Procroom:_

| Rang | Funktion | % Frame | Datei |
|------|----------|---------|-------|
| 1 | _(—)_ | _(—)_ | _(—)_ |

---

## 5. Top-Sink-Hypothesen → FR-Entscheidungs-Matrix

Wird nach Mess-Werten ausgefüllt. Kandidaten (Spec §4):

| Sink-Hypothese | Probe-Signal das ihn bestätigt | FR |
|----------------|--------------------------------|-----|
| Texture-Memory-Bandwidth dominant | hohe ~VRAM + viele Texturen, draws moderat | FR-02 (Atlas/Pool) |
| Tile-Sprite-Count dominant | sehr hohe objMax + hohe draws im Procroom | FR-03 (Tile-Reduktion) |
| GameObject-Lifecycle dominant | objMax/bodies spiken bei Enemy-Spawn, Heap wächst | FR-04 (Pooling) |
| Fog-Update dominant | CPU-Profil zeigt Fog-Schleife (nur via DevTools) | FR-05 (Fog-LOD) |

---

## 6. Entscheidung & Empfehlung

_(Nach Mess-Werten: welche FR (02/03/04/05) priorisieren, in welcher
Reihenfolge, mit konkreten Code-Targets. Speist WP02+ in tasks.md.)_

---

## 7. Offene Fragen / Risiken

- _(—)_
