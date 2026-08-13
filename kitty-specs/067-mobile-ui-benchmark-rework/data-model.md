# Phase 1 — Datenmodell (Untersuchungs-Entitäten)

Reines Analyse-Datenmodell (Markdown-Artefakte, keine DB/Code).

## Entität: Referenz-Titel
Ein untersuchtes Game.
- `name` — Titel (z. B. „Diablo Immortal").
- `genre_note` — kurze Einordnung (z. B. „Mobile-ARPG, Joystick + Skill-Ring").
- `pflicht` — bool (5 Pflicht-Titel vs. optionale).

## Entität: Achse
Eine der 7 Untersuchungsdimensionen.
- `id` — A1…A7.
- `name` — z. B. „Daumen-Zonen/Reachability".
- `frage` — was auf dieser Achse beobachtet wird.

## Entität: Matrix-Zelle (Beobachtung)
Eine Beobachtung an der Kreuzung Achse × Titel — die Rohdaten.
- `achse_id` · `titel` — Schlüssel.
- `beobachtung` — was der Titel auf dieser Achse tut, wie.
- `beleg` — Quelle/Verweis (Video/Screenshot/Review/UX-Konvention).
- Validierung: für jede der 5 Pflicht-Titel × 7 Achsen soll eine Zelle existieren
  (≥2 Titel pro Achse belegt, FR-002).

## Entität: UI-Prinzip (D-A)
Eine synthetisierte, auf Fogreach anwendbare Empfehlung.
- `achse_id` — Bezug.
- `beobachtung` — verdichtete Beleglage aus den Matrix-Zellen.
- `empfehlung_fogreach` — konkrete Empfehlung.
- `delta_ist` — Abweichung vom Fogreach-Ist-Zustand (Baseline).
- `uebertragbar` — bool; falls false: `grund`.
- Validierung: je Achse ≥1 Prinzip mit ≥1 Beleg (FR-003, NFR-001).

## Entität: Rework-Item (D-B)
Ein konkreter Umsetzungs-Kandidat fürs Backlog.
- `id` — RW-01…
- `titel` — kurzer Name des Items.
- `beschreibung` — was geändert würde.
- `impact` — H/M/N.
- `aufwand` — H/M/N.
- `prioritaet` — abgeleitete Reihenfolge (Quick-Win zuerst; Tie-Break s. research R5).
- `bezug_prinzip` — verknüpfte Prinzip(en)/Achse(n).
- Sonderfall: genau ein Item entspricht Feature 065 / #80 (FR-005).

## Beziehungen
- Achse 1–n Matrix-Zelle; Titel 1–n Matrix-Zelle.
- Achse 1–n UI-Prinzip; UI-Prinzip 0–n Rework-Item.
- Baseline (Fogreach-Ist) ist Referenzpunkt jedes `delta_ist`.
