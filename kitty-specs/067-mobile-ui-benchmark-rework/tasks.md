# Tasks: Mobile-UI-Benchmark & Rework-Prinzipien (067)

**Mission**: research · **Branch**: `main` → `main` · **Execution**: planning_artifact (nur Markdown, kein Code)

Alle Deliverables leben unter `kitty-specs/067-mobile-ui-benchmark-rework/research/`.
Formate sind in `contracts/` fixiert; Abnahme in `quickstart.md`.

## Work Packages (Übersicht)

| WP | Ziel | Deliverable | Dependencies | Subtasks |
|----|------|-------------|--------------|----------|
| WP01 | Benchmark-Erhebung (Achsen×Titel-Matrix) | `research/matrix.md` | — | T001–T006 |
| WP02 | Synthese D-A (Prinzipien) | `research/D-A-principles.md` | WP01 | T007–T010 |
| WP03 | Synthese D-B (priorisiertes Rework-Backlog) | `research/D-B-backlog.md` | WP01, WP02 | T011–T014 |

Parallelisierung: WP01 startet allein; WP02 nach WP01; WP03 nach WP01+WP02 (lineare Kette,
da jede Stufe auf der vorigen aufbaut). MVP = WP01 (die Rohdaten tragen alles Weitere).

---

## WP01 — Benchmark-Erhebung (Matrix)
**Prompt**: [tasks/WP01-benchmark-matrix.md](tasks/WP01-benchmark-matrix.md)
**Ziel**: Beobachtbare Mobile-UI-Praxis der Referenz-Titel über 7 Achsen belegt erheben und
in `research/matrix.md` nach `contracts/matrix.contract.md` festhalten.
**Independent test**: quickstart.md Schritt 1 erfüllt (7 Achsen-Tabellen, je ≥2 Titel mit
Beobachtung+Beleg, Fogreach-Ist-Zeile je Achse).
**Dependencies**: none.

- [x] T001 Fogreach-Ist-Baseline je Achse festhalten (aus plan.md/Code) — die Vergleichs-Zeile.
- [x] T002 [P] Referenz-Recherche Gruppe A (Diablo Immortal, Genshin Impact) über alle 7 Achsen, mit Belegen.
- [x] T003 [P] Referenz-Recherche Gruppe B (Archero, Soul Knight, Vampire Survivors Mobile) über alle 7 Achsen, mit Belegen.
- [x] T004 [P] Referenz-Recherche Gruppe C (Brawl Stars; optional Torchlight Infinite / PoE Mobile) über alle 7 Achsen, mit Belegen.
- [x] T005 Matrix zusammenführen + Format nach `contracts/matrix.contract.md` (7 Tabellen).
- [x] T006 Selbstprüfung gegen quickstart Schritt 1 (Vollständigkeit, ≥2 Titel/Achse, Belege, Ist-Zeile).

**Risiken**: unbelegte Aussagen (NFR-001) → jede Zelle mit Beleg; Achsen-Lücken → Matrix erzwingt Abdeckung.

---

## WP02 — Synthese D-A (Prinzipien)
**Prompt**: [tasks/WP02-synthese-prinzipien.md](tasks/WP02-synthese-prinzipien.md)
**Ziel**: Aus der Matrix je Achse ≥1 belegtes Fogreach-Prinzip ableiten (Beobachtung/Beleg →
Empfehlung → Delta zum Ist → Übertragbarkeit), Format nach `contracts/D-A-principles.contract.md`.
**Independent test**: quickstart.md Schritt 2 erfüllt.
**Dependencies**: WP01.

- [x] T007 Je Achse Beleglage aus der Matrix verdichten (Beobachtung/Beleg).
- [x] T008 Je Achse Fogreach-Empfehlung + Delta zum Ist-Zustand formulieren.
- [x] T009 Übertragbarkeit prüfen; nicht übertragbare Praktiken mit Grund markieren (FR-006).
- [x] T010 D-A nach Kontrakt formatieren + Selbstprüfung (quickstart Schritt 2).

**Risiken**: Empfehlung ohne Beleg/Delta → Kontrakt-Pflichtfelder erzwingen beides; Cargo-Cult → FR-006-Markierung.

---

## WP03 — Synthese D-B (priorisiertes Rework-Backlog)
**Prompt**: [tasks/WP03-synthese-backlog.md](tasks/WP03-synthese-backlog.md)
**Ziel**: Aus den Prinzipien konkrete Rework-Items ableiten, mit Impact/Aufwand (H/M/N)
priorisieren (Top-3 eindeutig), 065/#80 als Eintrag; Format nach `contracts/D-B-backlog.contract.md`.
**Independent test**: quickstart.md Schritt 3+4 erfüllt.
**Dependencies**: WP01, WP02.

- [ ] T011 Rework-Items aus den Prinzipien ableiten (inkl. 065/#80 als eigenen Eintrag).
- [ ] T012 Je Item Impact + Aufwand (H/M/N) + Prinzip-/Achsen-Bezug einschätzen.
- [ ] T013 Nach Impact×Aufwand priorisieren (Quick-Wins zuerst; Tie-Break R5; Top-3 eindeutig).
- [ ] T014 D-B nach Kontrakt formatieren + Selbstprüfung (quickstart Schritt 3+4).

**Risiken**: unklare Reihenfolge → NFR-002 Top-3 eindeutig; 065 vergessen → FR-005-Checkliste.

---

## Dependencies (für finalize-tasks)
- WP01: Dependencies: none
- WP02: Dependencies: WP01
- WP03: Dependencies: WP01, WP02
