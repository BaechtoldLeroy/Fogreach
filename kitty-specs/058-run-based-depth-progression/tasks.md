# Tasks: Run-basierte Tiefen-Progression

**Feature**: 058-run-based-depth-progression
**Generated**: 2026-06-24
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Decision-Lock + Test-Gerüst (test-first) | 4 (T001–T004) | ~150 | none | — |
| WP02 | Per-Raum-Increment entfernen (Tiefe run-konstant) | 4 (T005–T008) | ~80 | WP01 | — |
| WP03 | Run-Abschluss-+1 (idempotent) + Persistence | 4 (T009–T012) | ~90 | WP01, WP02 | — |
| WP04 | „Der Hinabstieg"-Abstimmung + Quest-Objektive | 5 (T013–T017) | ~120 | WP02, WP03 | — |
| WP05 | Audit + Save-Kompat + Endless + NFR-Verifikation | 5 (T018–T022) | ~80 | WP02–WP04 | — |

**Total**: 22 Subtasks über 5 WPs.

**Ship-Reihenfolge**: WP01 (Decision-Lock + Tests rot) → WP02 (Tiefe
run-konstant; SC-01 grün) → WP03 (+1 bei Abschluss; SC-02/03 grün) → WP04
(Hinabstieg + Quests; SC-04/05 grün) → WP05 (Härtung/Mess-Gates;
SC-06/07/08 grün). WP02 ist die Kern-Mechanik und allein schon spürbar
(run-konstante Tiefe), aber erst mit WP03 wächst die Tiefe wieder.

**Constitution-Gate**: `test-first` — die drei Kern-Invarianten
(„Tiefe run-konstant", „+1 genau bei Abschluss", „kein +1 bei Tod/Abbruch")
werden als Unit-Tests in WP01 VOR der Implementierung geschrieben.
Quest-Trigger-Audit (C-04) ist Pflicht-Subtask in WP05.

**Decision-Lock (WP01)**: D1 = „erfolgreicher Run" := `leaveDungeonForHub`
`reason === 'dungeon_complete'` (letzten Raum erreicht). D2 = strikt +1,
flacher-starten bleibt. Beides aus spec.md §8 übernommen — falls der User
abweicht, hier zuerst anpassen.

---

## Phase 1 — Decision-Lock & Tests (test-first)

### WP01: Decision-Lock + Test-Gerüst

**Goal**: Design-Entscheidungen D1/D2 fixieren und die Kern-Invarianten als
(rote) Unit-Tests anlegen, bevor Code geändert wird. **Depends on**: none.
**Requirements**: FR-01, FR-02, FR-03 (als Tests), Constitution test-first.

**Independent test**: `node tools/runTests.js` läuft; neue
`tests/runBasedDepth.test.js` existiert und schlägt erwartbar fehl (rot),
weil die Mechanik noch nicht umgestellt ist.

**Subtasks**:
- [x] **T001** Decision-Lock: D1 (`reason === 'dungeon_complete'` = Abschluss) + D2 (strikt +1, flacher bleibt) in `spec.md` §8 als „entschieden" markieren bzw. mit User bestätigen. Kurz-Notiz `research/decisions.md` (Hook-Punkte: `roomManager.js` Z. 1035, `main.js` Z. 1689).
- [x] **T002** Research: bestätigen, dass `leaveDungeonForHub` der einzige saubere Abschluss-Punkt ist (reasons `dungeon_complete`/`death`/`portal`; Aufrufer `roomManager.js` Z. 1034-1035, `inventory.js` Z. 757-758, `main.js` Z. 1968-1970). Dokumentieren, welche reasons NICHT zählen.
- [x] **T003** `tests/runBasedDepth.test.js` anlegen: (a) Tiefe bleibt über mehrere `enterRoom`/`onStairOverlap`-Zyklen konstant; (b) `dungeon_complete` → `MAX_DEPTH` += 1; (c) `death`/`portal` → `MAX_DEPTH` unverändert; (d) Doppel-Aufruf → nur +1 (Idempotenz). Test in den Runner einhängen (Pattern bestehender Tests). Erwartung: rot.
- [x] **T004** Baseline-Lauf: bestehende Tests + Smoke (`node tools/testGame.js`) als Grün-Referenz protokollieren (kein bestehender Test darf durch das Test-Gerüst brechen).

---

## Phase 2 — Tiefe run-konstant

### WP02: Per-Raum-Increment entfernen

**Goal**: `window.DUNGEON_DEPTH` bleibt während eines regulären Runs
konstant. **Depends on**: WP01. **Requirements**: FR-01, FR-08 (Endless
nicht brechen), SC-01.

**Independent test**: In `tests/runBasedDepth.test.js` ist Invariante (a)
grün; Smoke: Run durchlaufen, `DUNGEON_DEPTH` ändert sich von Raum 1 bis
letztem Raum nicht.

**Subtasks**:
- [x] **T005** `roomManager.js` `onStairOverlap` (Z. 1040–1047): den `depthBase`-Block (setzt `SELECTED_WAVE_OVERRIDE = NEXT_DUNGEON_DEPTH`, also +1) so ändern, dass beim **regulären** Raumwechsel die Run-Start-Tiefe beibehalten wird (kein +1). Endless-Zweig (Z. 1008–1032) bleibt unberührt.
- [x] **T006** `roomManager.js` `markRoomCleared` (Z. 1142–1144): das per-Raum-`window.DUNGEON_DEPTH = completed` / `NEXT_DUNGEON_DEPTH = completed+1` + `maxDepth`-`localStorage.setItem` (Z. 1148–1149) entfernen — der `maxDepth`-Bump wandert nach WP03 (Run-Abschluss). Tiefe bleibt run-konstant.
- [x] **T007** `roomManager.js` `enterRoom` (Z. 919–934): sicherstellen, dass `depth` aus der Run-Start-Tiefe (`DUNGEON_DEPTH`/`savedDepth`) abgeleitet wird und `NEXT_DUNGEON_DEPTH` nicht mehr als Per-Raum-Treiber wirkt; `currentWave = depth-1` bleibt run-konstant (Z. 962).
- [x] **T008** Endless-Abgrenzung: verifizieren, dass der Endless-Pfad (`roomManager.js` Z. 1011–1014, `endlessMode.js` Z. 240–242) seine eigene Tiefen-Erhöhung behält (FR-08). Test/Smoke: Endless steigt weiter, regulär nicht.

---

## Phase 3 — Run-Abschluss-Increment

### WP03: +1 bei erfolgreichem Run (idempotent)

**Goal**: Genau ein `MAX_DEPTH`-+1 pro erfolgreich abgeschlossenem Run.
**Depends on**: WP01, WP02. **Requirements**: FR-02, FR-03, FR-04, NFR-02,
SC-02, SC-03.

**Independent test**: Invarianten (b)(c)(d) aus `runBasedDepth.test.js`
grün: `dungeon_complete` → +1; `death`/`portal` → kein +1; Doppel-Aufruf →
einmal +1.

**Subtasks**:
- [x] **T009** `persistence.js`: Helper `bumpMaxDepth()` (liest `KEYS.MAX_DEPTH`, `+1`, schreibt zurück, gibt neuen Wert; kein Schreiben wenn nicht nötig). Optional: `setLastDepth()` zentralisieren. Export am bestehenden Persistence-API anhängen.
- [x] **T010** `main.js` `leaveDungeonForHub` (Z. 1689 ff.): bei `reason === 'dungeon_complete'` (D1) genau einmal `bumpMaxDepth()` aufrufen. Idempotenz-Guard (Run-Abschluss-Flag, z.B. `window.runStats`-Konsum oder eigener `window.__runCompleted`-Latch), damit mehrfache Aufrufe nicht doppelt zählen (FR-02, R-02).
- [x] **T011** `LAST_DEPTH`-Konsistenz (FR-04): bestätigen, dass die im Hinabstieg gewählte Tiefe weiter als `LAST_DEPTH` persistiert wird (`HubSceneV2.js` Z. 1890) und der nächste Run-Default daraus + `maxDepth` korrekt abgeleitet wird (nicht aus per-Raum-Stand).
- [x] **T012** NFR-02: sicherstellen, dass `MAX_DEPTH` nur einmal pro Run geschrieben wird (kein per-Raum/-Frame-`setItem`). Tests (b)(c)(d) grün.

---

## Phase 4 — Hinabstieg & Quest-Abstimmung

### WP04: „Der Hinabstieg" + Quest-Objektive

**Goal**: Tiefen-Wahl run-konstant + alle betroffenen Quests bleiben
completable. **Depends on**: WP02, WP03. **Requirements**: FR-05, FR-06,
FR-07, C-04, SC-04, SC-05.

**Independent test**: Hinabstieg startet Runs run-konstant, gewählte Tiefe
≤ `maxDepth`; `reach_wave`-Quest (20/30/40) lässt sich auf run-konstanter
Tiefe abschließen; `thom_pamphlets` zählt +1 pro Run (nicht pro Welle).

**Subtasks**:
- [ ] **T013** `HubSceneV2.js` `_openWaveSelectDialog` (Z. 1819–1896) + `startDungeon` (Z. 1737–1740): gewählte Tiefe `chooseDepth` setzt run-konstante Start-Tiefe; clampen auf ≤ `maxDepth` (D2: „An die Grenze" = exakt `maxDepth`, flacher bleibt). `LAST_DEPTH`-Persist bleibt (Z. 1890).
- [ ] **T014** `questSystem.js` `reach_wave` (Z. 428/539/577 + Logik `onWaveCompleted` Z. 1078–1083): Objektiv so umstellen, dass es die **run-konstante** Tiefe zählt (Run auf/über Zieltiefe erfüllt das Ziel), nicht ein Per-Raum-Klettern. Sicherstellen completable bei run-konstanter Tiefe.
- [ ] **T015** `questSystem.js` `dungeon_run`/`dungeon_complete` (Z. 500, Logik Z. 1085–1088): von „jede Welle zählt" auf „genau +1 pro abgeschlossenem Run" umstellen — an denselben Run-Abschluss-Hook koppeln wie WP03 (z.B. `questSystem.onDungeonCompleted()` aus `leaveDungeonForHub` `dungeon_complete`), nicht aus `onWaveCompleted`.
- [ ] **T016** Wave-Fan-out prüfen (`wave.js` Z. 126–132): `storySystem.onWaveCompleted`/`AbilitySystem.onWaveCompleted` dürfen unter run-konstanter Tiefe nicht regredieren (Story-Akt-Sprünge sind bereits depth-entkoppelt, `storySystem.js` Z. 602). Dokumentieren.
- [ ] **T017** i18n/Texte: falls Hinabstieg-Subtitle/Optionstexte (`hub.wave_select.*`, `hub.descent.*`) sich semantisch ändern (run-konstant statt klettern), DE/EN-Strings über das i18n-Register anpassen — keine hartkodierten Strings.

---

## Phase 5 — Audit, Save-Kompat & Verifikation

### WP05: Audit + Save + Endless + NFR

**Goal**: Abschluss-Härtung + Mess-Gates. **Depends on**: WP02–WP04.
**Requirements**: FR-08, FR-09, C-03, C-04, C-05, NFR-01–03, alle SCs.

**Independent test**: alle SC erfüllt; `node tools/runTests.js` grün;
Alt-Save lädt; Endless intakt; Smoke ohne neue Fehler.

**Subtasks**:
- [ ] **T018** **Quest-Trigger-Audit (C-04)**: jede berührte Quest (`reach_wave` ×3, `thom_pamphlets`) gegen `updateQuestProgress(type,target)` / `onWaveCompleted` / `onDungeonCompleted` prüfen — keine uncompletable Quest (SC-05).
- [ ] **T019** Save-Kompat (FR-09, C-03): Alt-Save mit hohem `maxDepth` laden → respektiert, kein Reset/Wipe; `DUNGEON_DEPTH`-Init (`main.js` Z. 1144–1148) + `storage.js` (Z. 72, 232) konsistent. Test mit Alt-Save (SC-06).
- [ ] **T020** Endless-Regression (FR-08, C-05): Endless-Mode steigt weiter pro Extra-Raum; regulärer Run bleibt run-konstant (SC-07).
- [ ] **T021** NFR-Mess-Check: Desktop 60fps, Mobile-Procroom ≥45 (053 nicht regrediert); kein per-Raum-`setItem`-Spam (NFR-01/02).
- [ ] **T022** Playtest-Verifikation (NFR-03): nach ~2 Quests NICHT mehr Tiefe ~15; flachere Kurve plausibel. SC-Abnahme + Feature-Accept vorbereiten (`node tools/runTests.js` + Smoke grün, SC-08).
