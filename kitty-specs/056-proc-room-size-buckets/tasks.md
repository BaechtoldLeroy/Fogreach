# Tasks: Proc-Room Größen-Buckets (20/60/20)

**Feature**: 056-proc-room-size-buckets
**Generated**: 2026-06-24
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Größen-Buckets (Bucket-Logik + Tests + Verdrahtung + Tuning) | 6 (T001–T006) | ~140 | none | — |

**Total**: 6 Subtasks über 1 WP.

**Ship-Reihenfolge**: WP01 ist allein vollständig shippbar (kleines Feature):
zuerst der Verteilungs-/Range-Unit-Test (test-first) + `weightedPick`-Export,
dann die `SIZE_BUCKETS`-Datenstruktur und die Verdrahtung im Proc-Block von
`roomManager.js`, zuletzt Verifikation/Tuning.

**Constitution-Gate**: `test-first` (DIRECTIVE TEST_FIRST) — die reine
gewichtete Bucket-Auswahl (Verteilung ~20/60/20 über großes N, Range-Grenzen,
beide Stile je Bucket) wird als Unit-Test VOR der Verdrahtung geschrieben.

---

## Phase 1 — Größen-Buckets

### WP01: Größen-Buckets (Bucket-Logik + Tests + Verdrahtung + Tuning)

**Goal**: Die Größe prozeduraler Räume von feste Gewichten `[20,60,20]`
(Small/Medium/Large) rollen statt vom Generator-Stil ableiten; den Stil
(Cave vs. BSP) als **separaten** Coinflip behalten. Generatoren,
Walkable-Area-/Wave-Kopplung, Endless-Pfad und authored Templates bleiben
unberührt. **Depends on**: none. **Requirements**: FR-01–08, NFR-01–03,
C-01–05, SC-01–07.

**Independent test**: `node tools/runTests.js` grün inkl. neuem
`tests/procRoomBuckets.test.js` (Verteilung ~20/60/20 über N ≥ 2000 mit
Toleranz, Range-Grenzen je Bucket, beide Stile vertreten). Smoke
(`node tools/testGame.js`) lädt ohne Konsolen-Fehler; im Spiel erscheinen
sichtbar mittelgroße Proc-Räume.

**Subtasks**:
- [x] **T001** (test-first) `tests/procRoomBuckets.test.js` schreiben (lädt die reine Bucket-/Pick-Logik via `loadGameModule`, Stil wie bestehende `tests/*`): assert Verteilung über N ≥ 2000 Ziehungen von `weightedPick(rng, [20,60,20])` liegt bei ~20/60/20 (Toleranz ±3–4 %-Punkte, deterministischer Seed via `mulberry32`); assert für jeden Bucket liegen erzeugte `width`/`height` innerhalb der definierten Range (Small ~50–70×44–60, Medium ~70–95×60–85, Large ~95–130×85–120), keine Off-by-one; assert über genügend Ziehungen kommen in jedem Bucket **beide** Stile (Cave & BSP) vor (FR-02/SC-02). Tests rot, soweit Export/Struktur noch fehlen.
- [x] **T002** `js/proceduralRooms.js`: `weightedPick` (Z. 198–207) auf `window.ProceduralRooms` exportieren — Export-Objekt Z. 830 (`{ generate, mulberry32 }`) um `weightedPick: weightedPick` erweitern. **Keine** Änderung an `generate`/Layout-Logik (C-01).
- [x] **T003** `js/roomManager.js`: benannte `SIZE_BUCKETS`-Datenstruktur an EINER Stelle anlegen (FR-03/C-03), z.B. `[{ key:'small', weight:20, w:[50,70], h:[44,60] }, { key:'medium', weight:60, w:[70,95], h:[60,85] }, { key:'large', weight:20, w:[95,130], h:[85,120] }]`. Eine kleine reine Helferfunktion `rollBucket(rng)` → wählt via `weightedPick(rng, SIZE_BUCKETS.map(b=>b.weight))` und liefert die `width`/`height` per `lo + Math.floor(rng()*(hi-lo+1))` aus der Bucket-Range.
- [x] **T004** `js/roomManager.js` Proc-Block (Z. 232–262) verdrahten: pro Proc-Raum zuerst `rollBucket` (→ `procWidth`/`procHeight`), dann **separat** den Stil würfeln (Cave vs. BSP, optional leichte Bucket→Stil-Bias, aber beide Stile je Bucket > 0 — FR-02). `procWidth`/`procHeight` aus dem Bucket an `CaveGenerator.generate`/`ProceduralRooms.generate` übergeben. Template-Registrierung, Insert-Position und `procCount` (2–4) **unverändert** lassen. Single-Generator-Fallback (nur Cave XOR BSP geladen) beibehalten.
- [x] **T005** Sicherstellen, dass **Endless-Pfad** (Z. 1018–1025) und **Walkable-Area/Wave** (Z. 941–945) sowie authored Templates **unberührt** bleiben (FR-06/FR-07/FR-08) — keine Code-Änderung dort, nur Review/Diff-Kontrolle.
- [x] **T006** Verifikation & Tuning: `node tools/runTests.js` (alle + neue grün, Baseline nicht regredieren); Smoke `node tools/testGame.js` ohne Konsolen-Fehler; manuell prüfen: Medium dominiert sichtbar, mittelgroße Encounters existieren, Endless unverändert. Tile-Ranges bei Bedarf im Playtest tunen (FR-03 ist tunebar). SC-01..07 abhaken.
