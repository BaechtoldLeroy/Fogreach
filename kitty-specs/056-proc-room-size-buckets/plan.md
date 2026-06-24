# Implementation Plan: Proc-Room Größen-Buckets (20/60/20)

**Branch**: `main` (planning) → merges into `main` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/kitty-specs/056-proc-room-size-buckets/spec.md`

## Summary

Prozedurale Räume werden in `js/roomManager.js` (Proc-Einstreu-Block Z. 232–262)
pro Run 2–4× eingestreut. Heute bestimmt ein **einziger** Coinflip sowohl den
**Generator-Stil** (~55 % Cave / ~45 % BSP) als auch — implizit — die **Größe**
(Cave klein 56–80×48–68, BSP groß 80–120×80–120). Es gibt keine Mittelkategorie
und die Größenverteilung ist nicht steuerbar.

Technischer Ansatz: **Größe von Stil entkoppeln**.

1. Eine benannte Datenstruktur `SIZE_BUCKETS` definiert an **einer** Stelle die
   drei Buckets mit Gewicht + Tile-Range:
   Small `[20]` (~50–70 × 44–60), Medium `[60]` (~70–95 × 60–85),
   Large `[20]` (~95–130 × 85–120).
2. Pro Proc-Raum wird zuerst der **Bucket** über `weightedPick(rng, [20,60,20])`
   gewählt (→ `procWidth`/`procHeight`-Range), dann **separat** der Stil
   (Cave vs. BSP) gewürfelt. In jedem Bucket sind beide Stile möglich (optionale,
   tunebare Bucket→Stil-Bias, ohne einen Stil auszuschließen).
3. `weightedPick` existiert bereits (`js/proceduralRooms.js` Z. 198–207), ist
   aber nicht exportiert (Export Z. 830 nur `generate`, `mulberry32`). Es wird
   exportiert und im Room-Manager wiederverwendet (alternativ eine äquivalente
   kleine reine Helferfunktion) — Hauptsache **eine** testbare Funktion.

Die Generatoren bleiben unverändert (bekommen nur andere `width`/`height`).
Die Walkable-Area-/Wave-Kopplung (Z. 941–945) bleibt unberührt — die
Encounter-Größe folgt automatisch der neuen Raumgröße. Endless-Pfad
(Z. 1018–1025) und authored Templates bleiben im Default unverändert.

Test-first: die gewichtete Bucket-Auswahl ist reine Logik und wird ohne
Phaser/DOM unit-getestet (Verteilung ~20/60/20 über großes N, Range-Grenzen).

## Technical Context

**Language/Version**: ES6+ Vanilla-JS (klassische `<script>`-Tags, KEIN Bundler)
**Primary Dependencies**: Phaser 3 (nur im Room-Manager-Kontext; die Bucket-/Pick-Logik ist Phaser-frei)
**Storage**: keine neue Persistenz — Raumgröße ist Laufzeit-Generierung (nichts wird serialisiert)
**Testing**: `node tools/runTests.js` (node:test, `loadGameModule`); Smoke `node tools/testGame.js` (Server :3456, Playwright)
**Target Platform**: Browser (Desktop + Mobile), klassische Script-Einbindung via `index.html`
**Project Type**: single (Browser-Game, Vanilla-JS in `js/`)
**Performance Goals**: 60fps Desktop, Mobile-Floor (053) ≥45; Bucket-Wahl O(3), keine per-Frame-Last
**Constraints**: Verteilung statistisch ~20/60/20 (SC-01); Generatoren unverändert (C-01); Endless + authored unberührt (C-04); keine neue Dependency (NFR-02)
**Scale/Scope**: 1 Edit im Proc-Block von `roomManager.js` + 1 Export-Zeile in `proceduralRooms.js` + 1 Testdatei

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **TEST_FIRST**: erfüllt — die reine gewichtete Bucket-Auswahl (Verteilung
  ~20/60/20, Range-Grenzen, beide Stile vertreten) wird als Unit-Test VOR der
  Verdrahtung in den Proc-Block geschrieben.
- **Additiv / keine Regression**: Generatoren unverändert (C-01); Walkable-Area/
  Wave read-only (FR-06); Endless + authored Templates im Default unberührt
  (FR-07/FR-08). Keine neue Dependency (NFR-02). Keine Save-Migration (C-05).
- **i18n**: nicht betroffen (keine neuen Spieler-Texte).

Kein Constitution-Verstoß → Complexity Tracking leer.

## Project Structure

### Documentation (this feature)

```
kitty-specs/056-proc-room-size-buckets/
├── plan.md              # Diese Datei
├── spec.md              # Spezifikation
├── tasks.md             # WP-Übersicht + Subtasks
├── meta.json
└── tasks/
    ├── README.md
    └── WP01-size-buckets.md
```

### Source Code (repository root)

```
js/
├── roomManager.js        # EDIT — Proc-Einstreu-Block Z. 232–262:
│                         #   gekoppelter Coinflip → Bucket-Größe (gewichtet)
│                         #   + separater Stil-Coinflip; SIZE_BUCKETS-Datenstruktur
│                         #   (Endless Z. 1018–1025 + Walkable-Area Z. 941–945 UNVERÄNDERT)
├── proceduralRooms.js    # EDIT (minimal) — weightedPick (Z. 198–207) auf
│                         #   window.ProceduralRooms exportieren (Z. 830),
│                         #   damit roomManager + Test es wiederverwenden;
│                         #   generate/Layout-Logik UNVERÄNDERT
└── caveGenerator.js      # UNVERÄNDERT — bekommt nur andere width/height

tests/
└── procRoomBuckets.test.js  # NEU — Unit-Test der gewichteten Bucket-Auswahl:
                             #   Verteilung ~20/60/20 über großes N, Range-Grenzen,
                             #   beide Stile je Bucket möglich
```

**Structure Decision**: Single-Project Browser-Game. Die Größenwahl wird vom
Generator-Stil entkoppelt und über eine benannte `SIZE_BUCKETS`-Struktur +
`weightedPick` gesteuert. `weightedPick` wird (statt dupliziert) aus
`proceduralRooms.js` exportiert und wiederverwendet, sodass dieselbe getestete
reine Funktion sowohl im Room-Manager als auch im Unit-Test läuft. Die
Generatoren und die Walkable-Area-Kopplung bleiben unberührt.

## Complexity Tracking

*Keine Constitution-Verstöße — Tabelle leer.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
