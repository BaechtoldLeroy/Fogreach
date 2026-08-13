---
work_package_id: WP02
title: Synthese D-A (Mobile-UI-Prinzipien)
dependencies: [WP01]
requirement_refs:
- FR-003
- FR-006
- FR-007
planning_base_branch: main
merge_target_branch: main
branch_strategy: 'Plan/Basis: main. Merge-Ziel: main. Haengt an WP01 -> in /spec-kitty.implement base=WP01 (spec-kitty implement WP02 --base WP01).'
subtasks: [T007, T008, T009, T010]
history:
- '2026-08-13: erstellt (/spec-kitty.tasks)'
authoritative_surface: kitty-specs/067-mobile-ui-benchmark-rework/research/D-A-principles.md
execution_mode: planning_artifact
lane: planned
owned_files: [kitty-specs/067-mobile-ui-benchmark-rework/research/D-A-principles.md]
---

# WP02 — Synthese D-A (Mobile-UI-Prinzipien)

## Ziel
Aus der Matrix (WP01) je Achse ≥1 belegtes, auf Fogreach anwendbares Prinzip ableiten und
als **`research/D-A-principles.md`** nach `contracts/D-A-principles.contract.md` festhalten.

## Kontext
- Eingang: `research/matrix.md` (WP01). Format: `contracts/D-A-principles.contract.md`.
  Methodik: `research.md` R3 (Nicht-Übertragbarkeit/Widersprüche) + R4 (Format).
- Baseline für die Delta-Aussage: Fogreach-Ist aus der Matrix / `plan.md`.
- Block-Format je Achse: **Beobachtung/Beleg → Empfehlung für Fogreach → Delta zum
  Ist-Zustand → Übertragbarkeit (übertragbar | nicht übertragbar + Grund)**.

## Subtasks

### T007 — Beleglage je Achse verdichten
Pro Achse (A1–A7) die Beobachtungen der Titel aus der Matrix zu einer knappen Beleglage
zusammenfassen (mit Quellenverweis). Widersprüche zwischen Titeln als Trade-off benennen
(nicht erzwungen auflösen, s. R3).

### T008 — Fogreach-Empfehlung + Delta je Achse
Pro Achse eine konkrete, im Phaser-Browser-Touch-Rahmen umsetzbare Empfehlung formulieren
und die `Delta zum Ist-Zustand`-Aussage gegen die Baseline (FR-007).

### T009 — Übertragbarkeit prüfen (FR-006)
Praktiken, die im Browser-Phaser-Touch-Rahmen nicht sinnvoll übertragbar sind, explizit als
„nicht übertragbar (Grund)" markieren — statt sie blind zu empfehlen (C-003).

### T010 — D-A formatieren + Selbstprüfung
`research/D-A-principles.md` exakt nach Kontrakt schreiben; gegen quickstart Schritt 2 prüfen
(je Achse ≥1 Block; jede Empfehlung mit ≥1 Beleg; jede mit Delta; nicht-übertragbar markiert;
self-contained inkl. Quellen — NFR-003).

## Definition of Done
- `research/D-A-principles.md` folgt dem Kontrakt, deckt alle 7 Achsen mit je ≥1 begründeten
  Prinzip ab (FR-003), besteht quickstart Schritt 2.
- Keine Änderung außerhalb `owned_files` (nur `research/D-A-principles.md`).

## Reviewer-Guidance
Stichprobe: 2 Prinzipien → hat jedes Beleg + Delta? Ist mind. eine nicht-übertragbare Praxis
mit Grund ausgewiesen (Realismus-Check)? Bleiben Empfehlungen im technischen Rahmen?

## Branch Strategy
Plan/Basis-Branch: `main`. Merge-Ziel: `main`. Dependency WP01 →
`spec-kitty implement WP02 --base WP01`.
