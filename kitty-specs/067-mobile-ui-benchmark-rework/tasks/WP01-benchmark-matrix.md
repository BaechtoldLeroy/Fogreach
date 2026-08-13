---
work_package_id: WP01
title: Benchmark-Erhebung (Achsen×Titel-Matrix)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-007
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T001, T002, T003, T004, T005, T006]
history:
- '2026-08-13: erstellt (/spec-kitty.tasks)'
authoritative_surface: kitty-specs/067-mobile-ui-benchmark-rework/research/matrix.md
execution_mode: planning_artifact
lane: planned
owned_files: [kitty-specs/067-mobile-ui-benchmark-rework/research/matrix.md]
---

# WP01 — Benchmark-Erhebung (Achsen×Titel-Matrix)

## Ziel
Die beobachtbare Mobile-Touch-UI-Praxis der Referenz-Titel über die 7 Untersuchungsachsen
belegt erheben und als **`research/matrix.md`** nach `contracts/matrix.contract.md`
festhalten. Dies sind die Rohdaten, aus denen WP02 (D-A) und WP03 (D-B) synthetisiert werden.

## Kontext
- Spec: `spec.md` · Methodik: `research.md` (R1, R2, R3) · Format: `contracts/matrix.contract.md`.
- **Achsen (7)**: A1 Daumen-Zonen/Reachability · A2 minimaler HUD/Informationsdichte ·
  A3 kontextuelle statt redundante Buttons · A4 Safe-Area/Notch · A5 Lesbarkeit/Kontrast/
  Feedback · A6 Auto-Targeting/Auto-Attack/Assist · A7 Button-Größe & Trefferflächen-Ergonomie.
- **Referenz-Titel**: Diablo Immortal, Genshin Impact, Archero, Soul Knight, Vampire
  Survivors (Mobile), Brawl Stars (Pflicht); optional Torchlight Infinite, PoE Mobile.
- **Fogreach-Ist (Baseline)**: 8-Zellen-Ability-Bar (`attack`, `slot1–4`, `potion`, `roll`,
  `interact`) + fester Joystick; HUD `js/hudV2.js`; Steuerung `js/mobileControls.js` /
  `js/mobileAbilityButtons.js`; Safe-Area `js/mobileSafeArea.js`.
- **Belegpflicht (NFR-001)**: jede Zelle nennt einen Beleg (Gameplay-Video/Screenshot/
  Review/Store-Material bzw. anerkannte UX-Konvention wie ~44–48 px Mindest-Trefferfläche).
- **Trennung**: Matrix enthält NUR Beobachtung („was/wie") + Beleg — KEINE Wertung/Empfehlung
  (die kommt erst in WP02).

## Recherche-Hinweis
Web-Recherche (Gameplay-Analysen, UI-Breakdowns, offizielle Screenshots) ist der Kern dieses
WP. Für nicht eindeutig belegbare Punkte lieber „nicht eindeutig belegbar" notieren, als zu
raten. Etablierte Mobile-UX-Ergonomie (Daumen-Reach-Zonen, Trefferflächen-Mindestgrößen,
Safe-Area) darf als Quelle für die generischen Achsen (A1, A4, A7) herangezogen werden.

## Subtasks

### T001 — Fogreach-Ist-Baseline je Achse
Für jede der 7 Achsen die aktuelle Fogreach-Umsetzung als „Ist"-Zeile festhalten (aus
`plan.md`/Code, kein Ausprobieren nötig). Diese Zeile ist der Vergleichsanker (FR-007).

### T002 [P] — Referenz-Gruppe A: Diablo Immortal, Genshin Impact
Beide Titel über alle 7 Achsen: was machen sie, wie — mit Beleg. Fokus: „volle" Action-UIs
(Joystick + Skill-Ring/Buttons, kontextuelle Aktionen, poliertes Feedback).

### T003 [P] — Referenz-Gruppe B: Archero, Soul Knight, Vampire Survivors (Mobile)
Über alle 7 Achsen, mit Beleg. Fokus: minimalistische/einhändige & auto-fire-lastige UIs
(A3 kontextuell, A6 Automatisierung, A2 minimaler HUD).

### T004 [P] — Referenz-Gruppe C: Brawl Stars (+ optional Torchlight Infinite / PoE Mobile)
Über alle 7 Achsen, mit Beleg. Fokus: Twin-Stick-Ergonomie & Aim-Assist (A1, A6, A7);
optionale ARPG-Titel nur wenn belegbar.

### T005 — Matrix zusammenführen (Kontrakt-Format)
Aus T001–T004 `research/matrix.md` bauen: eine Tabelle je Achse (A1–A7), Zeilen = Titel +
Fogreach-Ist, Spalten = Beobachtung | Beleg. Exakt nach `contracts/matrix.contract.md`.

### T006 — Selbstprüfung (quickstart Schritt 1)
Prüfen: 7 Achsen-Tabellen vorhanden; je Achse ≥2 Referenz-Titel mit Beobachtung UND Beleg;
Fogreach-Ist-Zeile je Achse; keine Wertungen in der Matrix.

## Definition of Done
- `research/matrix.md` existiert, folgt dem Kontrakt, besteht quickstart Schritt 1.
- Jede belegte Zelle hat einen nachvollziehbaren Beleg (NFR-001).
- Keine Änderung außerhalb `owned_files` (nur `research/matrix.md`).

## Reviewer-Guidance
Stichprobe: 3 zufällige Zellen → ist der Beleg nachvollziehbar? Enthält die Matrix
versehentlich Empfehlungen (gehört nicht hierher)? Ist die Fogreach-Ist-Zeile je Achse da?

## Branch Strategy
Plan/Basis-Branch: `main`. Merge-Ziel: `main`. Keine Dependencies → `spec-kitty implement WP01`.

## Activity Log

- 2026-08-13T15:13:31Z – unknown – lane=done – Benchmark-Matrix erhoben, quickstart Schritt 1 erfuellt | Done override: planning_artifact ohne WP-Branch/Worktree — direkt auf main committet; keine Merge-Ancestry moeglich
