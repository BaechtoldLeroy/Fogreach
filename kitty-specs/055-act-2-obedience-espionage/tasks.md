# Tasks: Act 2 — Obedience vs. Memory (+ Espionage)

**Feature**: 055-act-2-obedience-espionage
**Generated**: 2026-06-23
**Phase**: 2 (Tasks)
**Planning base**: `main` → **Merge target**: `main`
**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Jedes Work Package ist eigenständig implementierbar; Detail-Prompt unter
`tasks/WPxx-*.md`.

## At-a-glance

| WP | Title | Subtasks | Est. lines | Depends on | Parallel-safe |
|----|-------|----------|------------|------------|---------------|
| WP01 | Research + Espionage-Gerüst + Bestands-Integration | 6 (T001–T006) | ~200 | none | — |
| WP02 | Akt-2-Story-Quests (ohne Espionage) + Milestone-Kopplung | 9 (T007–T015) | ~500 | WP01 | — |
| WP03 | Espionage-Mechanik (Disguise/Detection/Info-Gathering + Räume) | 8 (T016–T023) | ~450 | WP01 | — |
| WP04 | Espionage-Quests (Konvoi/Archiv/Maulwurf) + Elara-Foreshadow | 5 (T024–T028) | ~300 | WP02, WP03 | — |
| WP05 | i18n/Save/Audit/Stealth-Tuning/NFR-Verifikation | 6 (T029–T034) | ~150 | WP02, WP03, WP04 | — |

**Total**: 34 Subtasks über 5 WPs.

**MVP-/Ship-Reihenfolge**: WP01 → **WP02 (allein shippbar: voller spielbarer
Akt 2 als Story-Chain bis `wahrheit`/`bruch`, ohne Espionage)** → WP03 →
WP04 → WP05. WP03 kann parallel zu WP02 starten (beide hängen nur an WP01),
aber zur Konfliktvermeidung in `questSystem.js` seriell empfohlen.

**Constitution-Gate**: `test-first` (DIRECTIVE TEST_FIRST) — Objective-
Progress + Unlock-Kette + Disguise-fällt-bei-Angriff als Unit-Tests VOR der
Implementierung. Quest-Trigger-Audit (C-05) ist Pflicht-Subtask in WP05.

---

## Phase 1 — Foundation

### WP01: Research + Espionage-Gerüst + Bestands-Integration

**Goal**: Offene Research-Punkte schließen und das Gerüst legen, ohne
Gameplay zu ändern. **Depends on**: none. **Requirements**: FR-03, FR-09,
C-01, C-03.

**Independent test**: `node tools/runTests.js` grün; neues
`tests/espionageSystem.test.js` (Skeleton-API existiert, no-op-Defaults).

**Subtasks**:
- [ ] **T001** Enemy-Detection-Research: analysieren, wie Aggro/Sicht heute in `js/enemy.js` funktioniert (Range/LoS), als Basis für Stealth-Detection. Befund in `research/detection-notes.md`.
- [ ] **T002** Milestone-Trigger-Research: in `js/storySystem.js` ermitteln, wie `currentActIndex`/Milestones heute getriggert werden (Wave vs. triggerQuests). Dokumentieren, wo Quest-Abschluss sauber daneben-haken kann (nicht Akt-1/Wave-Pfad brechen). Befund in `research/milestone-notes.md`.
- [ ] **T003** roomTemplate-Zonen-Schema: prüfen, wie kuratierte Räume (`js/roomTemplates/*.json`) Metadaten tragen; Schema für Wachen-Posten/Deckung/Observe-Zonen entwerfen.
- [ ] **T004** `js/espionageSystem.js` Skeleton: `window.espionage = { disguised:false, ... }` + no-op-Funktionen (`startMission/endMission/isDetected/registerZone`). In `index.html` einhängen. Zero-Effekt außerhalb Espionage-Missionen.
- [ ] **T005** Bestands-Quest-Audit: die 3 `requiredAct:2`-Quests (`mara_contact`, `branka_doubt`, `elara_meeting`) in `js/questSystem.js` sichten + Anreicherungs-/Integrationsplan notieren (KEIN Duplikat). Mapping in `research/act2-existing-quests.md`.
- [ ] **T006** `tests/espionageSystem.test.js` aufsetzen (Skeleton-API, Defaults). Baseline 268 Tests weiterhin grün.

---

## Phase 2 — Story (allein shippbar)

### WP02: Akt-2-Story-Quests (ohne Espionage) + Milestone-Kopplung

**Goal**: Spielbare Akt-2-Story-Chain in `js/questSystem.js` bis
`wahrheit`/`bruch` — Council + Surveillance + private Jobs, ohne Espionage.
**Depends on**: WP01. **Requirements**: FR-01, FR-02, FR-08, FR-09, FR-10,
FR-11, FR-12, FR-13 (Elara-Foreshadow #2 in Q8).

**Independent test**: Neue Quests von `act2_open` bis `bruch` end-to-end
durchspielbar; `currentActIndex` erreicht `wahrheit`/`bruch` durch
Quest-Abschluss; Akt-1-Saves laden fehlerfrei. Unit-Tests Unlock-Kette grün.

**Subtasks**:
- [ ] **T007** Q1 `council_seizure` „Beschlagnahme" (Aldric, fetch/kill) — Crack #1 (Zeugenaussagen). prerequisites: `['act2_open']`, requiredAct 2.
- [ ] **T008** Q2 `council_surveillance` „Überwachung" (Aldric, `observe`-lite) — Surveillance-Crack #2. Nutzt minimalen observe-Objective-Typ (volle Mechanik in WP03; hier nur Zähl-Variante).
- [ ] **T009** Q3 `mara_contact` **anreichern** (Bestand) — Widerstand-Kontakt als Privat-Strang-Opener; Dialog/Unlocks erweitern.
- [ ] **T010** Q4 `branka_transcripts` „Verbotene Abschriften" (Branka, fetch) + **Lore-Fragment** (FR-10, Hook `js/knowledgeTree.js`).
- [ ] **T011** Q5 `branka_doubt` **anreichern** (Bestand) — Brankas Zweifel an dem, was der Spieler bringt; Dialoge vertiefen.
- [ ] **T012** Q8 `elara_meeting` **anreichern** (Bestand, `elara_trust`) — **Elara-Foreshadow #2** (Belege passen zu glatt zur Rats-Deutung).
- [ ] **T013** Q10 `ritual_chamber` „Die Ritualkammer" (Aldric, kill/explore) — triggert **`wahrheit`-Milestone** (scripted, FR-08).
- [ ] **T014** Q11 `bruch_confrontation` „Der Bruch" (Aldric, dialogue) — triggert **`bruch`**, Akt-2-Abschluss + Akt-3-Hook (`unlocks: ['act3_open']`).
- [ ] **T015** Milestone-Kopplung (FR-09): Quest-Abschluss treibt `currentActIndex` zu `wahrheit`/`bruch` (Hook neben Wave-Pfad). i18n DE/EN für alle Q1–Q11-Texte. Unit-Test Unlock-Kette + Save-Kompat.

---

## Phase 3 — Espionage-Mechanik

### WP03: Espionage-Runtime (Disguise/Detection/Info-Gathering + Räume)

**Goal**: `js/espionageSystem.js` ausimplementieren + neue Objective-Typen +
2–3 kuratierte Stealth-Räume. **Depends on**: WP01. **Requirements**: FR-04,
FR-05, FR-06, NFR-02.

**Independent test**: In einem Test-Stealth-Raum: Verkleidung an → unentdeckt
außerhalb Range; Angriff → Verkleidung fällt + Detection steigt; Observe-Zone
X Sek → Objective-Increment. Detection-Check leichtgewichtig (60fps).

**Subtasks**:
- [ ] **T016** Disguise-State + Visual-Swap (`disguised`-Flag, Sprite-Tint/Swap); Toggle an Mission-Start.
- [ ] **T017** **Verkleidung fällt bei Angriff** (FR-04) — Hook in Player-Attack; Detection-Spike. Unit-Test.
- [ ] **T018** Detection-System (FR-05): Wachen-Detection-Range/LoS (auf T001-Befund aufbauend); Eskalation; Schwelle → „enttarnt" = Kampf (kein Insta-Fail, C-04).
- [ ] **T019** Verstecken/Deckung: Deckungs-Zonen reduzieren Detection.
- [ ] **T020** Info-Gathering-Objective (FR-06): Observe-Zonen; `observe`/`eavesdrop`-Increment bei Aufenthalt X Sek unentdeckt.
- [ ] **T021** Neue Objective-Typen in `js/questSystem.js`-Progress: `observe`, `infiltrate`/`reach` via `updateQuestProgress(type,target)` (Trigger-Audit beachten, C-05).
- [ ] **T022** Kuratierte Räume `js/roomTemplates/CouncilWarehouse.json` + `SealedArchive.json` (+ ggf. `InformantDen`) mit Zonen-Metadaten (Wachen/Deckung/Observe).
- [ ] **T023** Performance: Detection-Check throttle/leichtgewichtig (NFR-02, kein per-Frame O(n²)); Mobile-Toggle für Disguise (R-05). Tests grün.

---

## Phase 4 — Espionage-Quests

### WP04: Espionage-Quests + Elara-Foreshadow

**Goal**: Q6/Q7/Q9 auf der WP03-Mechanik. **Depends on**: WP02, WP03.
**Requirements**: FR-07, FR-13.

**Independent test**: Die 3 Espionage-Quests von Annahme bis Abgabe
abschließbar (Disguise + Stealth + Observe); Elara-Foreshadow #1 sichtbar.

**Subtasks**:
- [ ] **T024** Q6 `espionage_convoy` „Der Konvoi" (Mara) — Konvoi im `CouncilWarehouse` beschatten + abhören → Ritual-Fracht.
- [ ] **T025** Q7 `espionage_archive` „Das versiegelte Archiv" (Harren) — Infiltration `SealedArchive`, Schreiber abhören, Akt bergen. **Elara-Foreshadow #1** (Akt zu sauber).
- [ ] **T026** Q9 `espionage_informant` „Der Maulwurf" (Widerstand) — Council-Maulwurf enttarnen; **Paranoia-Saat** (subtil Richtung Elara, ohne Bestätigung).
- [ ] **T027** Prerequisites/Verfügbarkeit: Espionage nach `mara_contact`; alle ohne Gates verfügbar; in Quest-Reihenfolge einreihen.
- [ ] **T028** i18n DE/EN für alle Espionage-Quest-Texte + Foreshadow-Lore.

---

## Phase 5 — Polish & Verifikation

### WP05: i18n/Save/Audit/Tuning/NFR

**Goal**: Abschluss-Härtung + Mess-Gates. **Depends on**: WP02–WP04.
**Requirements**: FR-11, FR-12, NFR-01–04, C-04, C-05, alle SCs.

**Independent test**: alle SC erfüllt; 268+neue Tests grün; Alt-Save lädt;
keine hartkodierten Strings; Playtime ~3–4 h Akt 2 plausibel.

**Subtasks**:
- [ ] **T029** **Quest-Trigger-Audit (C-05)**: jede neue Quest gegen `updateQuestProgress(type,target)` prüfen (keine uncompletable Quest).
- [ ] **T030** i18n-Vollständigkeit DE/EN: grep auf hartkodierte Strings in neuen Quests/Espionage; alle über i18n-Register.
- [ ] **T031** Save-Kompat-Test: Akt-1-Alt-Save laden → Akt-2-Quests werden verfügbar, kein Crash/Wipe (FR-12, C-03).
- [ ] **T032** Stealth-Playtest-Tuning (C-04/R-02): Detection-Schwellen/Range fair einstellen; kein frustrierendes Insta-Fail.
- [ ] **T033** NFR-Mess-Check: Desktop 60fps, Mobile-Procroom ≥45 (053 nicht regrediert), Detection-Overhead messbar gering (NFR-01/02).
- [ ] **T034** Playtime-Verifikation (NFR-03): Akt 2 ~3–4 h authored plausibel; SC-Abnahme + Doku-Update; Feature-Accept vorbereiten.
