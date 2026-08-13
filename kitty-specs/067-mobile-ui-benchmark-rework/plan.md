# Implementation Plan: Mobile-UI-Benchmark & Rework-Prinzipien (research)

**Branch**: `main` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)
**Input**: Research specification from `kitty-specs/067-mobile-ui-benchmark-rework/spec.md`
**Mission**: research (question → methodology → gather → analyze → synthesize → publish)

## Summary

Beobachtender **Benchmark** der Mobile-Touch-UI führender ARPG-/Roguelite-Games entlang
7 Achsen, erhoben in einer **Achsen×Titel-Matrix** (Zwischenartefakt), daraus zwei
synthetisierte Markdown-Deliverables: **D-A** (Fogreach-Prinzipien mit Belegen + Delta zum
Ist-Zustand) und **D-B** (priorisiertes Rework-Backlog, 065/#80 als Eintrag). Kein Code.

## Technical Context (Methodik)

**Vorgehensart**: Beobachtender Sekundär-Benchmark (keine Nutzertests, kein Reverse-
Engineering). Öffentlich beobachtbare UI-Praxis der Referenz-Titel + anerkannte Mobile-UX-
Ergonomie werden erhoben und auf Fogreach übertragen.
**Erhebungs-Struktur**: Eine Matrix `Achse × Referenz-Titel` — pro Zelle „was macht der
Titel auf dieser Achse, wie". Verdichtet zu Prinzipien (D-A) und Rework-Items (D-B).
**Quellen**: (1) öffentlich beobachtbare UI (Gameplay-Videos/Screenshots/Reviews/
Store-Material der Referenz-Titel); (2) etablierte Mobile-UX-Ergonomie (Daumen-/Reach-
Zonen, Mindest-Trefferflächen ~44–48 px, Safe-Area-Konventionen). Jede Aussage in D-A ist
auf ≥1 Beleg rückführbar (NFR-001).
**Belegführung**: Beobachtungen werden als solche markiert und von Empfehlungen getrennt;
nicht-übertragbare Praktiken werden mit Grund ausgewiesen (FR-006).
**Referenz-Titel**: Diablo Immortal, Archero, Soul Knight, Vampire Survivors (Mobile),
Genshin Impact, Brawl Stars; optional Torchlight Infinite, Path of Exile Mobile.
**Achsen (7)**: Daumen-Zonen/Reachability · minimaler HUD · kontextuelle Buttons ·
Safe-Area/Notch · Lesbarkeit/Kontrast/Feedback · Auto-Targeting/Assist · Trefferflächen-
Ergonomie.
**Vergleichs-Baseline (Fogreach heute)**: 8-Zellen-Ability-Bar (`attack`, `slot1–4`,
`potion`, `roll`, `interact`) + fester Joystick; HUD `js/hudV2.js`; Steuerung
`js/mobileControls.js` / `js/mobileAbilityButtons.js`; Safe-Area `js/mobileSafeArea.js`.
**Output-Form**: Markdown-Artefakte im Feature-Verzeichnis (`research/`). Keine
Code-Änderung, kein Build, keine Tests am Spielcode.
**Ziel-Plattform-Rahmen**: Phaser-Browser-Game, Touch — Empfehlungen müssen in diesem
Rahmen umsetzbar sein (keine Nativ-only-Annahmen).
**Scope/Umfang**: 5 Pflicht-Titel × 7 Achsen (35 Kern-Zellen) + 2 optionale Titel;
Synthese zu D-A (≥7 Prinzipien) und D-B (priorisierte Item-Liste inkl. 065).

## Constitution Check

*GATE: Must pass before Phase 0.*

Kein durchsetzbares Constitution-File aufgelöst (Governance meldet `unresolved`: Tools
node/npm/phaser nicht in der Runtime-Registry — nicht blockierend für ein reines
Research-Feature ohne Code/Build). **Gate: übersprungen** (keine Code-/Tool-Gates
anwendbar). Projekt-Konventionen (Umlaute, Markdown-Doku im Feature-Verzeichnis) werden
eingehalten.

## Project Structure

### Documentation (this feature)

```
kitty-specs/067-mobile-ui-benchmark-rework/
├── plan.md                 # Diese Datei (Methodik-Plan)
├── research.md             # Phase 0: Methodik-Entscheidungen (Decision/Rationale/Alternatives)
├── data-model.md           # Phase 1: Entitäten (Referenz-Titel, UI-Prinzip, Rework-Item)
├── quickstart.md           # Phase 1: Abnahme-/Validierungs-Leitfaden für D-A/D-B
├── contracts/              # Phase 1: Format-Kontrakte der Deliverables
│   ├── matrix.contract.md      # Achsen×Titel-Matrix (Zwischenartefakt)
│   ├── D-A-principles.contract.md
│   └── D-B-backlog.contract.md
└── research/               # Phase „gather/analyze/synthesize" (in /spec-kitty.implement)
    ├── matrix.md               # ausgefüllte Achsen×Titel-Matrix
    ├── D-A-principles.md       # Deliverable A
    └── D-B-backlog.md          # Deliverable B
```

### Source Code (repository root)

**Keine.** Reines Research-/Synthese-Feature — es werden ausschließlich Markdown-Artefakte
im Feature-Verzeichnis erzeugt. Am Spielcode (`js/…`) wird nichts geändert.

**Structure Decision**: Research-Mission — Deliverables leben unter
`kitty-specs/067-mobile-ui-benchmark-rework/research/`, ihre Formate als Kontrakte unter
`contracts/`. Die spätere Umsetzung (abgeleitete Features) ist ausdrücklich NICHT Teil
dieses Features (C-004).

## Complexity Tracking

*Keine Constitution-Verletzungen — Tabelle entfällt.*
