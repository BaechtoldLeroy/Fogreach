---
work_package_id: WP01
title: Größen-Buckets (Bucket-Logik + Tests + Verdrahtung + Tuning)
dependencies: []
requirement_refs:
- FR-01
- FR-02
- FR-03
- FR-04
- FR-05
- FR-06
- FR-07
- FR-08
- NFR-01
- NFR-02
- NFR-03
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 4930f12d2e3c3eb09ecf03d72fd86ee3b91b218b
created_at: '2026-06-24T08:32:52.339045+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 — Größen-Buckets
assignee: ''
agent: ''
shell_pid: "6812"
history:
- timestamp: '2026-06-24T08:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
authoritative_surface: js/roomManager.js
execution_mode: code_change
lane: planned
owned_files:
- js/roomManager.js
- js/proceduralRooms.js
- tests/procRoomBuckets.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP01 — Größen-Buckets (Bucket-Logik + Tests + Verdrahtung + Tuning)

## Objective

Die Größe prozeduraler Räume nach **festen Gewichten** rollen — **20 % Small /
60 % Medium / 20 % Large** — statt sie wie heute implizit aus dem
Generator-Stil abzuleiten. Der Bucket bestimmt die Tile-Range; der
Generator-Stil (Cave vs. BSP) bleibt ein **separater** Coinflip, sodass beide
Stile in jedem Bucket möglich sind. Generatoren, Walkable-Area-/Wave-Kopplung,
Endless-Pfad und authored Templates bleiben unberührt. Die gewichtete
Bucket-Auswahl ist reine, **test-first** abgesicherte Logik.

## Context

- **Spec**: `kitty-specs/056-proc-room-size-buckets/spec.md` (FR-01–08, §7 SC-01–07, §8 Edge Cases)
- **Plan**: `kitty-specs/056-proc-room-size-buckets/plan.md` (§Project Structure, §Constitution Check)
- **Tasks**: `kitty-specs/056-proc-room-size-buckets/tasks.md` (T001–T006)

### Verifizierte Code-Stellen
- `js/roomManager.js` Proc-Einstreu-Block **Z. 232–262**: streut pro Run
  `procCount = 2 + Math.floor(Math.random()*3)` (= 2–4) Räume ein. Heute pro
  Raum **ein** Coinflip
  `var useCave = window.CaveGenerator && (!window.ProceduralRooms || Math.random() < 0.55);`,
  der Stil **und** Größe koppelt:
  - Cave: `procWidth = 56 + rand(24)` (56–80), `procHeight = 48 + rand(20)` (48–68)
  - BSP:  `procWidth = 80 + rand(40)` (80–120), `procHeight = 80 + rand(40)` (80–120)
  Danach: Template-Registrierung in `window.RoomTemplates.TEMPLATES[procName]`
  und Insert via `templateOrder.splice(insertPos, 0, procName)` — **unverändert
  lassen**.
- `js/proceduralRooms.js`: `weightedPick(rng, weights)` **Z. 198–207** (reine
  gewichtete Auswahl, normiert über die Gewichtssumme); `mulberry32` (seedbarer
  RNG); Export **Z. 830**: `window.ProceduralRooms = { generate: generate, mulberry32: mulberry32 };`
  — `weightedPick` ist **nicht** exportiert.
- `js/caveGenerator.js`: `generate({ width, height, name, depth })` — **unverändert**.
- **NICHT anfassen**: Walkable-Area/Wave **Z. 941–945**
  (`computeWalkableAreaPx` → `computeWaveEnemyTotal`); Endless-Pfad
  **Z. 1018–1025** (BSP 90–150); authored Templates.

## Constitution Gate: TEST_FIRST

T001 (Tests) wird VOR T002–T004 (Export/Struktur/Verdrahtung) geschrieben und
muss zunächst rot sein. Pflicht-Test: **Verteilung ~20/60/20** über N ≥ 2000
Ziehungen (deterministischer Seed via `mulberry32`, Toleranz ±3–4 %-Punkte) +
**Range-Grenzen** je Bucket.

## Subtasks

- [x] **T001** (test-first) `tests/procRoomBuckets.test.js` anlegen (lädt die
  reine Logik via `loadGameModule`, Stil wie bestehende `tests/*` mit
  `node:test`):
  - **Verteilung** (FR-01/SC-01): über N ≥ 2000 Ziehungen liefert
    `weightedPick(rng, [20,60,20])` ~20 % Index 0 / ~60 % Index 1 / ~20 %
    Index 2 (Toleranz ±3–4 %-Punkte; Seed via `mulberry32` für Determinismus).
  - **Range-Grenzen** (FR-03/SC-03): für jeden Bucket liegen erzeugte
    `width`/`height` innerhalb der definierten Range (Small ~50–70×44–60,
    Medium ~70–95×60–85, Large ~95–130×85–120) — keine Off-by-one über
    Ober-/Untergrenze.
  - **Beide Stile** (FR-02/SC-02): über genügend Ziehungen kommen in jedem
    Bucket **beide** Stile (Cave & BSP) vor (kein Stil-Ausschluss durch eine
    optionale Bias).
  - Tests rot, solange Export/`SIZE_BUCKETS`/`rollBucket` fehlen.
- [x] **T002** `js/proceduralRooms.js`: `weightedPick` (Z. 198–207) auf
  `window.ProceduralRooms` exportieren — Export-Objekt **Z. 830** um
  `weightedPick: weightedPick` erweitern. **Keine** Änderung an
  `generate`/Layout-Logik (C-01).
- [x] **T003** `js/roomManager.js`: benannte `SIZE_BUCKETS`-Datenstruktur an
  **einer** Stelle anlegen (FR-03/C-03), z.B.:
  ```js
  var SIZE_BUCKETS = [
    { key: 'small',  weight: 20, w: [50, 70],  h: [44, 60]  },
    { key: 'medium', weight: 60, w: [70, 95],  h: [60, 85]  },
    { key: 'large',  weight: 20, w: [95, 130], h: [85, 120] }
  ];
  ```
  Plus eine kleine reine Helferfunktion `rollBucket(rng)`, die via
  `weightedPick(rng, SIZE_BUCKETS.map(function(b){return b.weight;}))` den
  Bucket wählt und `width`/`height` per `lo + Math.floor(rng()*(hi-lo+1))` aus
  der Bucket-Range zieht. `rng` defaults auf `Math.random`, damit es im Spiel
  ohne Seed läuft, im Test aber seedbar ist.
- [x] **T004** `js/roomManager.js` Proc-Block (**Z. 232–262**) verdrahten:
  pro Proc-Raum zuerst `rollBucket(...)` → `procWidth`/`procHeight`; **dann
  separat** den Stil würfeln (Cave vs. BSP). Optionale, **tunebare** Bucket→Stil-
  Bias erlaubt (Small→eher Cave, Large→eher BSP), aber beide Stile je Bucket
  müssen Wahrscheinlichkeit > 0 behalten (FR-02). Die Bucket-`procWidth`/
  `procHeight` an `window.CaveGenerator.generate(...)` bzw.
  `window.ProceduralRooms.generate(...)` übergeben. **Unverändert**:
  Template-Registrierung (`RoomTemplates.TEMPLATES[procName]`), Insert-Position
  (`templateOrder.splice`), `procCount` (2–4), Single-Generator-Fallback
  (nur Cave XOR BSP geladen).
- [x] **T005** Review/Diff-Kontrolle: **Endless-Pfad** (Z. 1018–1025),
  **Walkable-Area/Wave** (Z. 941–945) und authored Templates bleiben **ohne
  Code-Änderung** (FR-06/FR-07/FR-08).
- [x] **T006** Verifikation & Tuning: `node tools/runTests.js` (Baseline + neue
  Tests grün, keine Regression); Smoke `node tools/testGame.js` (Server :3456)
  ohne Konsolen-Fehler. Manuell prüfen: Medium dominiert sichtbar, mittelgroße
  Encounters existieren, Endless unverändert. Tile-Ranges bei Bedarf im Playtest
  tunen (FR-03 tunebar — Werte zentral in `SIZE_BUCKETS`). SC-01..07 abhaken.

## Acceptance / Independent Test

- `node tools/runTests.js` grün inkl. `tests/procRoomBuckets.test.js`
  (Verteilung ~20/60/20 über N ≥ 2000 mit Toleranz, Range-Grenzen je Bucket,
  beide Stile je Bucket vertreten).
- Smoke lädt ohne Konsolen-Fehler; im Spiel erscheinen sichtbar mittelgroße
  Proc-Räume; Medium ist die häufigste Größe.
- Generatoren (`proceduralRooms.js` Layout, `caveGenerator.js`),
  Walkable-Area-/Wave-Kopplung (Z. 941–945), Endless-Pfad (Z. 1018–1025) und
  authored Templates verhalten sich wie vor dem Feature.

## Out of Scope

- Endless-Pfad-Umbau (Z. 1018–1025) — bleibt im Default unverändert (FR-07).
- Generator-interne Layout-Änderungen (nur Größe wird gesteuert, nicht das
  Innenleben).
- Wave-/Gegnerzahl-Tuning je Bucket und authored-Template-Größen.
- Neue Generator-Stile.

## Activity Log

- 2026-06-24T08:33:18Z – unknown – shell_pid=6812 – lane=in_progress – Moved to in_progress
- 2026-06-24T08:42:27Z – unknown – shell_pid=6812 – lane=for_review – Moved to for_review
- 2026-06-24T08:43:46Z – unknown – shell_pid=6812 – lane=approved – Selbst-Review: 304 Tests gruen (4 neue), Smoke 0 Fehler, FR-01-08/SC-01-07 erfuellt, Endless/Walkable/authored unberuehrt.
