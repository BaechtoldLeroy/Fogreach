# Quickstart — Abnahme der Untersuchung

Wie ein Reviewer prüft, dass die Deliverables die Spec erfüllen (keine Code-Ausführung —
nur Sichtprüfung der Markdown-Artefakte in `research/`).

## Schritt 1 — Rohdaten (Matrix)
- [ ] `research/matrix.md` existiert und hat alle 7 Achsen als eigene Tabelle.
- [ ] Pro Achse ≥2 Referenz-Titel mit Beobachtung **und** Beleg (FR-002).
- [ ] Jede Achse enthält die Fogreach-Ist-Zeile (Baseline, FR-007).
- [ ] Beobachtungen enthalten keine Wertung/Empfehlung (nur „was/wie").

## Schritt 2 — D-A (Prinzipien)
- [ ] `research/D-A-principles.md` hat je Achse ≥1 Prinzip-Block (FR-003).
- [ ] Jede Empfehlung nennt ≥1 konkreten Beleg (NFR-001).
- [ ] Jede Empfehlung hat eine `Delta zum Ist-Zustand`-Aussage (FR-007).
- [ ] Nicht übertragbare Praktiken sind mit Grund markiert (FR-006).
- [ ] Empfehlungen bleiben im Phaser-Browser-Touch-Rahmen (C-003).

## Schritt 3 — D-B (Backlog)
- [ ] `research/D-B-backlog.md` ist eine nach Priorität sortierte Tabelle.
- [ ] Jedes Item hat Impact (H/M/N) und Aufwand (H/M/N) (FR-004).
- [ ] Die Top-3-Prioritäten sind eindeutig (NFR-002).
- [ ] Genau ein Item = Feature 065 / #80, relativ eingeordnet (FR-005).
- [ ] Jedes Item verweist auf ≥1 Prinzip/Achse aus D-A.

## Schritt 4 — Gesamt (Success Criteria)
- [ ] SC-001: 7 Achsen je ≥1 begründete Fogreach-Empfehlung.
- [ ] SC-002: priorisierte Items mit Impact/Aufwand, Top-Prios eindeutig.
- [ ] SC-003: 065/#80 nachvollziehbar eingeordnet.
- [ ] SC-004: D-A/D-B allein (ohne diese Konversation) als Feature-Schneidegrundlage nutzbar (NFR-003).

## Abgrenzung
- Kein Code, kein Build, keine Tests am Spielcode (C-001).
- Desktop nicht Gegenstand (C-002).
- Umsetzungs-Features werden erst NACH Abnahme separat geschnitten (C-004).
