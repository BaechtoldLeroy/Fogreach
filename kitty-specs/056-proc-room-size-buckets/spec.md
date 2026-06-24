# Specification: Proc-Room Größen-Buckets (20/60/20)

**Feature**: 056-proc-room-size-buckets
**Created**: 2026-06-24
**Mission**: software-dev
**Tracker**: GitHub #43
**Branch contract**: planning on `main`, merges into `main`

## 1. Overview

Prozedurale Räume („Proc-Räume") werden pro Dungeon-Run in den Raum-Ablauf
eingestreut, um Abwechslung zwischen den authored Templates zu schaffen. Die
Größe eines Proc-Raums wird heute **implizit vom Generator-Typ bestimmt**:
`js/roomManager.js` (Z. 232–262) wirft pro Raum eine Münze (~55 % Cave / ~45 %
BSP-Procedural); der Cave-Generator liefert immer **kleine** Räume
(56–80 × 48–68 Tiles), der BSP-Generator immer **große** (80–120 × 80–120
Tiles). Größe ist innerhalb der Range gleichverteilt.

Folge: Die Größenverteilung ist ein **Nebenprodukt** des Generator-Coinflips
(~55 % klein / ~45 % groß) und es gibt **keine mittelgroßen** Räume — die
Verteilung ist bimodal und nicht steuerbar. Da die **Gegnerzahl an der
begehbaren Fläche hängt** (`computeWalkableAreaPx` → `computeWaveEnemyTotal`,
`js/roomManager.js` Z. 941–945), steuert die Raumgröße direkt die
Encounter-Größe — die fehlende Mittelkategorie macht Encounters entweder klein
oder groß, selten „mittel".

Dieses Feature entkoppelt **Größe** von **Generator-Stil**: Proc-Räume werden
nach **Größen-Buckets mit festen Gewichten** gerollt — **20 % Small /
60 % Medium / 20 % Large** —, der Bucket bestimmt die Tile-Range; der
Generator-Stil (Cave vs. BSP) bleibt ein **separater** Coinflip. So entsteht
eine planbare, glockenförmige Größenverteilung (Medium dominiert) und beide
Raumstile können in jeder Größe auftreten.

**Prinzip:** Bucket sagt *wie groß* (→ Encounter-Größe); der Generator-Stil
sagt *wie der Raum aussieht* (organische Cave vs. rechteckige BSP-Kammern).
Beide Achsen werden unabhängig gewürfelt.

## 2. Stakeholders & Actors

- **Spieler** — durchläuft Dungeon-Runs; soll abwechslungsreichere, planbar
  verteilte Raumgrößen (und damit Encounter-Größen) erleben, mit Medium als
  häufigster Erfahrung.
- **Room-Manager** (`js/roomManager.js`) — streut Proc-Räume ein (Z. 232–262)
  und bestimmt heute Größe + Stil in einem gekoppelten Coinflip; wird auf
  Bucket-gewichtete Größe + separaten Stil-Coinflip umgestellt.
- **Proc-Generatoren** — `js/proceduralRooms.js` (BSP, `generate({width,height,…})`)
  und `js/caveGenerator.js` (Cave, `generate({width,height,…})`). Beide bleiben
  unverändert; sie erhalten nur andere `width`/`height`-Werte.
- **Walkable-Area-/Wave-System** (`computeWalkableAreaPx`,
  `computeWaveEnemyTotal`, `js/roomManager.js` Z. 941–945) — read-only-Konsument:
  größere Räume → mehr begehbare Fläche → mehr Gegner. Wird NICHT geändert,
  reagiert aber automatisch auf die neuen Größen.

## 3. User Scenarios

### Primary A: Planbare Größenverteilung über einen Run
1. Spieler startet einen Dungeon-Run; der Room-Manager streut 2–4 Proc-Räume ein.
2. Für jeden Proc-Raum wird zuerst der **Größen-Bucket** mit Gewichten
   `[20, 60, 20]` (Small/Medium/Large) gewürfelt, dann der **Stil** (Cave/BSP)
   separat.
3. Über viele Räume hinweg ist Medium die häufigste Größe (~60 %), Small und
   Large je ~20 % — Encounter-Größen folgen dieser Verteilung.

### Primary B: Stil unabhängig von Größe
1. Ein Small-Bucket-Raum kann sowohl als organische Cave als auch als
   rechteckige BSP-Kammer erscheinen (nicht mehr „klein ⇒ immer Cave").
2. Ein Large-Bucket-Raum kann ebenfalls beide Stile annehmen.
3. (Optional/tunebar) Eine leichte Stil-Bias je Bucket (Small→eher Cave,
   Large→eher BSP) ist erlaubt, aber **beide Stile bleiben in jedem Bucket
   möglich**.

### Primary C: Encounter-Größe folgt der Raumgröße
1. Ein Medium-Raum liefert mehr begehbare Fläche als ein Small-Raum.
2. `computeWalkableAreaPx` → `computeWaveEnemyTotal` skaliert die Gegnerzahl
   automatisch mit — ohne Änderung am Wave-System.
3. Der Spieler erlebt mittelgroße Encounters als neue, dominante Kategorie.

### Edge: Generator nicht geladen
- Ist nur **einer** der beiden Generatoren verfügbar
  (`window.CaveGenerator` XOR `window.ProceduralRooms`), wird der Bucket
  trotzdem gewürfelt (steuert die Größe), und der vorhandene Generator erzeugt
  den Raum in der Bucket-Range. Das heutige Fallback-Verhalten
  („nimm, was geladen ist") bleibt erhalten.

### Edge: Endless-Pfad
- Der **Endless-Pfad** (`js/roomManager.js` Z. 1018–1025, BSP 90–150) wird in
  diesem Feature **separat entschieden** und standardmäßig **unverändert**
  gelassen (Endless eskaliert bewusst zu großen Räumen). Optionale Angleichung
  ist explizit Out of Scope (siehe §11), kann aber als getunte Variante
  dokumentiert werden.

### Edge: Authored Templates
- **Authored (handgebaute) Raum-Templates bleiben unberührt** — das Bucket-
  System betrifft ausschließlich die prozedural generierten Räume.

## 4. Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | **Bucket-gewichtete Größe**: Pro Proc-Raum wird der Größen-Bucket über feste Gewichte `[20, 60, 20]` (Small/Medium/Large) gewählt. Der Bucket bestimmt die Tile-Range für `procWidth`/`procHeight`. | Draft |
| FR-02 | **Stil als separater Coinflip**: Der Generator-Stil (Cave vs. BSP) wird **unabhängig** vom Bucket gewürfelt; in **jedem** Bucket sind **beide** Stile möglich. Eine optionale, tunebare Bucket→Stil-Bias (Small→eher Cave, Large→eher BSP) ist erlaubt, darf aber keinen Stil in einem Bucket ausschließen. | Draft |
| FR-03 | **Tile-Ranges (Startwerte, tunebar)**: Small ~50–70 × 44–60; Medium ~70–95 × 60–85; Large ~95–130 × 85–120. Innerhalb des gewählten Buckets bleibt die Größe (wie heute) gleichverteilt über die Range. Die Ranges sind als benannte Datenstruktur an **einer** Stelle definiert (leicht tunebar). | Draft |
| FR-04 | **Gewichtete Auswahl wiederverwendbar/testbar**: Die Bucket-Wahl nutzt eine reine, seiteneffektfreie gewichtete Auswahl. `weightedPick(rng, weights)` existiert bereits in `js/proceduralRooms.js` (Z. 198–207), ist aber **nicht** auf `window.ProceduralRooms` exportiert (nur `generate`, `mulberry32`, Z. 830). Entweder `weightedPick` exportieren und wiederverwenden ODER eine äquivalente kleine reine Helferfunktion im Room-Manager-Scope anlegen — Entscheidung in der Implementierung, Hauptsache **eine** testbare Funktion. | Draft |
| FR-05 | **Verdrahtung in `roomManager.js`**: Der Proc-Raum-Einstreu-Block (Z. 232–262) wird so umgebaut, dass zuerst der Bucket (→ `procWidth`/`procHeight`-Range), dann der Stil bestimmt wird. Der Rest (Template-Registrierung in `RoomTemplates.TEMPLATES`, Insert-Position, `procCount` 2–4) bleibt unverändert. | Draft |
| FR-06 | **Walkable-Area-Kopplung unberührt**: `computeWalkableAreaPx`/`computeWaveEnemyTotal` (Z. 941–945) werden NICHT geändert. Die Gegnerzahl skaliert automatisch mit der neuen Raumgröße. | Draft |
| FR-07 | **Endless-Pfad separat**: Der Endless-Pfad (Z. 1018–1025) bleibt standardmäßig unverändert (kein Bucket); jede Angleichung ist eine bewusste, dokumentierte Entscheidung (Default: aus). | Draft |
| FR-08 | **Authored Templates unberührt**: Keine Änderung an handgebauten Templates oder am Template-Einstreu-Mechanismus außerhalb des Proc-Blocks. | Draft |

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-01 | Performance unverändert: Bucket-Wahl ist O(3); keine zusätzliche per-Frame-Last. Generatoren laufen wie heute zur Raum-Aufbauzeit. 053-Mobile-Floor nicht regredieren. | 60fps Desktop / Mobile ≥45 |
| NFR-02 | Keine neue Dependency; Vanilla-JS + Phaser-built-ins; klassische `<script>`-Einbindung. | — |
| NFR-03 | Die gewichtete Bucket-Auswahl ist als reine Logik ohne Phaser/DOM unit-testbar (`node tools/runTests.js`), Vorlage `tests/*` mit `loadGameModule`. | Tests grün |

## 6. Constraints

| ID | Constraint |
|----|------------|
| C-01 | Generatoren (`proceduralRooms.js`, `caveGenerator.js`) bleiben **unverändert** in ihrer Generierungslogik — sie bekommen nur andere `width`/`height`. |
| C-02 | Größe und Stil sind **entkoppelt** — der Stil darf die Größe nicht mehr implizit festlegen (C-01 des alten Verhaltens wird aufgehoben). |
| C-03 | Bucket-Gewichte `[20, 60, 20]` und die Tile-Ranges stehen an **einer** benannten Stelle (tunebar, kein verstreutes Magic-Number-Duplikat). |
| C-04 | Authored Templates und der Endless-Pfad bleiben im Default-Verhalten unberührt (FR-07/FR-08). |
| C-05 | Keine Save-/Persistenz-Änderung — Raumgröße ist Laufzeit-Generierung, nichts wird serialisiert. |

## 7. Success Criteria

| ID | Criterion |
|----|-----------|
| SC-01 | Über N Runs/Räume (z.B. N ≥ 2000 Ziehungen im Unit-Test) liegt die Bucket-Verteilung statistisch bei **~20 % Small / ~60 % Medium / ~20 % Large** (Toleranz z.B. ±3–4 %-Punkte bei großem N). |
| SC-02 | In jedem Bucket sind über genügend Ziehungen **beide** Stile (Cave & BSP) vertreten (kein Stil-Ausschluss). |
| SC-03 | Erzeugte `procWidth`/`procHeight` liegen für jeden Bucket innerhalb der definierten Tile-Range (Small/Medium/Large nicht überlappend an den Grenzen verletzt). |
| SC-04 | Medium ist die häufigste Größe; mittelgroße Encounters existieren (vorher gab es keine). |
| SC-05 | `computeWalkableAreaPx`/Wave-System unverändert; Gegnerzahl skaliert weiterhin mit der Fläche. |
| SC-06 | Endless-Pfad + authored Templates verhalten sich wie vor dem Feature. |
| SC-07 | Alle bestehenden Tests + neue Bucket-Verteilungstests grün (`node tools/runTests.js`); Smoke (`node tools/testGame.js`) ohne Konsolen-Fehler. |

## 8. Edge Cases

- **Nur ein Generator geladen**: Bucket wird trotzdem gewürfelt; der vorhandene
  Generator baut den Raum in der Bucket-Range (heutiges Fallback bleibt).
- **Range-Grenzen**: Die `Math.floor(Math.random() * span)`-Berechnung muss die
  exakten Ober-/Untergrenzen je Bucket einhalten (keine Off-by-one über die
  Range hinaus).
- **Tuning-Drift**: Werden Gewichte/Ranges später getunt, darf die Summe der
  Gewichte ≠ 100 sein — `weightedPick` normiert über die Summe (Z. 199–201),
  also bleibt die Verteilung korrekt relativ zu den Gewichten.
- **Stil-Bias optional**: Ist die Bucket→Stil-Bias aktiviert, darf sie keinen
  Stil auf 0 setzen (sonst Verstoß gegen FR-02/SC-02).

## 9. Key Entities

| Entity | Description |
|--------|-------------|
| `js/roomManager.js` (Proc-Block Z. 232–262) | Streut Proc-Räume ein; wird auf Bucket-Größe + separaten Stil-Coinflip umgebaut. |
| `SIZE_BUCKETS` (neu, benannt) | Datenstruktur mit den 3 Buckets: Gewicht + `widthRange`/`heightRange` (Small/Medium/Large), an EINER Stelle (FR-03/C-03). |
| `weightedPick(rng, weights)` | Reine gewichtete Auswahl, `js/proceduralRooms.js` Z. 198–207 — wiederverwenden (ggf. exportieren) oder äquivalent neu (FR-04). |
| `js/proceduralRooms.js` / `js/caveGenerator.js` | BSP-/Cave-Generatoren — unverändert, bekommen nur Bucket-Größen (C-01). |
| `computeWalkableAreaPx` / `computeWaveEnemyTotal` (Z. 941–945) | Read-only-Konsument — Encounter-Größe folgt automatisch (FR-06). |

## 10. Assumptions

- Die Tile-Ranges (Small ~50–70×44–60, Medium ~70–95×60–85, Large ~95–130×85–120)
  sind plausible Startwerte und werden im Playtest getunt; sie überschneiden
  sich grob mit den heutigen Cave-/BSP-Größen, sodass keine extremen
  Performance-/Layout-Ausreißer entstehen.
- `weightedPick` (Z. 198–207) ist korrekt und kann unverändert wiederverwendet
  werden (nur Export fehlt für die Wiederverwendung außerhalb der Datei).
- Beide Generatoren akzeptieren beliebige `width`/`height` in den neuen Ranges
  ohne Sonderfälle (im Code verifiziert: beide nehmen `opts.width/height`).

## 11. Out of Scope

- **Endless-Pfad-Umbau** (Z. 1018–1025) — bleibt standardmäßig unverändert
  (FR-07); eine spätere bewusste Angleichung ist ein separates Tuning.
- **Generator-interne Layout-Änderungen** (Tunnel-Dichte, Cave-Erosion, BSP-
  Split-Tiefe) — nur Größe wird gesteuert, nicht das Innenleben.
- **Wave-/Gegnerzahl-Tuning** — die Kopplung bleibt; Encounter-Balancing je
  Bucket ist ein Folgethema, falls Playtest es verlangt.
- **Authored-Template-Größen** — handgebaute Räume bleiben unberührt.
- **Neue Generator-Stile** — nur die zwei bestehenden (Cave, BSP).

## 12. Dependencies

- `js/proceduralRooms.js` ✓ — BSP-Generator + `weightedPick` + `mulberry32`.
- `js/caveGenerator.js` ✓ — Cave-Generator.
- `js/roomManager.js` ✓ — Proc-Einstreu-Block + Walkable-Area-Kopplung.

## 13. Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-01 | Verteilung weicht von 20/60/20 ab (falsche Gewichts-Normierung). | Dedizierter Verteilungs-Unit-Test über großes N mit Toleranz (SC-01); `weightedPick` normiert über die Gewichtssumme. |
| R-02 | Range-Off-by-one → Raumgrößen außerhalb des Buckets. | Range-Grenzen-Test (SC-03); Ranges an einer Stelle definiert (C-03). |
| R-03 | Stil-Bias schließt versehentlich einen Stil aus. | FR-02/SC-02: beide Stile je Bucket > 0; Test prüft Vorkommen beider Stile. |
| R-04 | Encounter zu groß/klein durch verschobene Flächen (Wave-Kopplung). | SC-05: Wave-System unverändert; Playtest-Tuning der Ranges (FR-03 tunebar). |
| R-05 | Endless-Pfad versehentlich mitgeändert. | FR-07/SC-06: Endless-Block bleibt explizit unberührt. |

## 14. References

- `js/roomManager.js` — Proc-Einstreu-Block **Z. 232–262** (heutiger gekoppelter
  Coinflip); Walkable-Area/Wave **Z. 941–945**; Endless-Pfad **Z. 1018–1025**.
- `js/proceduralRooms.js` — `weightedPick` **Z. 198–207**, Export
  `window.ProceduralRooms = { generate, mulberry32 }` **Z. 830**, `generate`
  ab **Z. 228**.
- `js/caveGenerator.js` — Cave-`generate({width,height,…})`.
- GitHub #43.
- Schwester-Feature 057 (`tests/*`-Stil mit `loadGameModule` für reine Logik).
