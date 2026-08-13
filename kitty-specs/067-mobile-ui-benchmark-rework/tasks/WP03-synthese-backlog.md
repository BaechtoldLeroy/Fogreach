---
work_package_id: WP03
title: Synthese D-B (priorisiertes Rework-Backlog)
dependencies: [WP01, WP02]
requirement_refs:
- FR-004
- FR-005
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T011, T012, T013, T014]
history:
- '2026-08-13: erstellt (/spec-kitty.tasks)'
authoritative_surface: kitty-specs/067-mobile-ui-benchmark-rework/research/D-B-backlog.md
execution_mode: planning_artifact
lane: planned
owned_files: [kitty-specs/067-mobile-ui-benchmark-rework/research/D-B-backlog.md]
---

# WP03 — Synthese D-B (priorisiertes Rework-Backlog)

## Ziel
Aus den Prinzipien (WP02) konkrete Rework-Items ableiten, mit Impact/Aufwand priorisieren
und als **`research/D-B-backlog.md`** nach `contracts/D-B-backlog.contract.md` festhalten.
Feature **065 / GitHub #80** (Button-Merge attack+interact) ist ein Eintrag darin.

## Kontext
- Eingang: `research/D-A-principles.md` (WP02) + `research/matrix.md` (WP01).
  Format: `contracts/D-B-backlog.contract.md`. Priorisierung: `research.md` R5 + R6.
- Tabellen-Format: **Prio · ID · Item · Impact(H/M/N) · Aufwand(H/M/N) · Bezug(Prinzip/Achse)
  · Kurzbegründung**.

## Subtasks

### T011 — Rework-Items ableiten (inkl. 065/#80)
Aus jedem Prinzip einen oder mehrere konkrete, umsetzbare Rework-Items formen (RW-01…). Genau
ein Item entspricht Feature 065 / #80 (Button-Merge attack+interact) und wird als regulärer
Eintrag geführt — nicht privilegiert, nicht ausgeklammert (FR-005, R6).

### T012 — Impact/Aufwand + Bezug einschätzen
Je Item Impact (H/M/N) und Aufwand (H/M/N) qualitativ einschätzen und auf ≥1 Prinzip/Achse
aus D-A verweisen (Rückbindung an die Belege). Kurzbegründung je Item.

### T013 — Priorisieren (Impact×Aufwand)
Nach Impact×Aufwand sortieren: hoher Impact + niedriger Aufwand zuerst („Quick Wins"), dann
absteigend. Gleichstände per Tie-Break (kleinere Abhängigkeit / größere Ergonomie-Wirkung, R5)
auflösen, sodass die **Top-3 eindeutig** sind (NFR-002).

### T014 — D-B formatieren + Selbstprüfung
`research/D-B-backlog.md` exakt nach Kontrakt schreiben; gegen quickstart Schritt 3+4 prüfen
(jedes Item Impact+Aufwand; Top-3 eindeutig; 065/#80 vorhanden & eingeordnet; jedes Item mit
Prinzip-Bezug; D-A/D-B allein als Feature-Schneidegrundlage nutzbar — SC-004/NFR-003).

## Definition of Done
- `research/D-B-backlog.md` folgt dem Kontrakt, ist nach Priorität sortiert, Top-3 eindeutig
  (NFR-002), enthält 065/#80 (FR-005), besteht quickstart Schritt 3+4.
- Keine Änderung außerhalb `owned_files` (nur `research/D-B-backlog.md`).

## Reviewer-Guidance
Ist die Reihenfolge nachvollziehbar (Quick-Wins oben)? Sind die Top-3 wirklich eindeutig
(kein ungelöster Gleichstand)? Ist 065/#80 als Zeile da und plausibel eingeordnet? Verweist
jedes Item auf ein Prinzip?

## Branch Strategy
Plan/Basis-Branch: `main`. Merge-Ziel: `main`. Dependencies WP01+WP02 →
`spec-kitty implement WP03 --base WP02`.

## Activity Log

- 2026-08-13T15:32:06Z – unknown – lane=in_progress – Synthese D-B, DI-Leitbild
