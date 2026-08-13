# Phase 0 — Methodik-Entscheidungen

Format je Punkt: **Decision / Rationale / Alternatives considered**.

## R1 — Erhebungsmethode: Achsen×Titel-Matrix

- **Decision**: Eine Matrix `7 Achsen × Referenz-Titel`; pro Zelle eine kurze, belegte
  Beobachtung („was macht der Titel auf dieser Achse, wie"). Die Matrix ist das
  Zwischenartefakt, aus dem D-A und D-B synthetisiert werden.
- **Rationale**: Erzwingt gleichmäßige Abdeckung aller Achsen über alle Titel (keine
  Lücken), macht Widersprüche zwischen Titeln sichtbar, und trennt Rohbeobachtung sauber
  von Synthese.
- **Alternatives considered**: Freitext-Notizen je Titel (unstrukturiert, Lücken-anfällig);
  nur Prinzipien ohne Rohmatrix (nicht rückverfolgbar, verletzt NFR-001).

## R2 — Quellen & Belegführung

- **Decision**: Zwei Quellklassen — (a) öffentlich beobachtbare UI der Referenz-Titel
  (Gameplay-Videos, Screenshots, Reviews, Store-Material); (b) etablierte Mobile-UX-
  Ergonomie (Daumen-/Reach-Zonen, Mindest-Trefferfläche ~44–48 px, Safe-Area-Konvention).
  Jede D-A-Empfehlung nennt ≥1 konkreten Beleg.
- **Rationale**: Erfüllt NFR-001 (nachvollziehbare Herleitung), hält die Untersuchung
  überprüfbar und frei von unbelegten Behauptungen.
- **Alternatives considered**: Reverse-Engineering/Teardown der Apps (unnötig aufwändig,
  teils AGB-heikel); reine Erfahrungswerte ohne Quellen (nicht überprüfbar).

## R3 — Umgang mit Nicht-Übertragbarkeit & Widersprüchen

- **Decision**: Praktiken, die im Phaser-Browser-Touch-Rahmen nicht sinnvoll übertragbar
  sind, werden explizit als „nicht übertragbar (Grund)" markiert (FR-006). Widersprüchliche
  Praktiken (z. B. Auto-Attack vs. manuell) werden als Trade-off mit Empfehlung + Kontext
  dargestellt, nicht künstlich aufgelöst.
- **Rationale**: Verhindert Cargo-Cult-Übernahme und macht Design-Spannungen transparent.
- **Alternatives considered**: Jede Referenz-Praxis 1:1 empfehlen (ignoriert Kontext);
  Widersprüche verschweigen (verzerrt die Grundlage).

## R4 — Deliverable-Formate

- **Decision**: **D-A** = Prinzipien-Doc, je Achse ein Block: *Beobachtung/Beleg →
  Fogreach-Empfehlung → Delta zum Ist-Zustand*. **D-B** = Backlog-Tabelle: *Item · Impact
  (H/M/N) · Aufwand (H/M/N) · Priorität · Bezug zu Prinzip(en)*, mit 065/#80 als Zeile.
  Formate sind als Kontrakte in `contracts/` fixiert.
- **Rationale**: Feste Formate machen die Deliverables self-contained (NFR-003) und direkt
  als Feature-Schneidegrundlage nutzbar.
- **Alternatives considered**: Fließtext-Report (schlechter scan-/priorisierbar); Score-
  Modell mit Zahlen-Gewichten (Scheingenauigkeit für qualitative Einschätzungen).

## R5 — Priorisierungsschema (D-B)

- **Decision**: Qualitatives **Impact × Aufwand** (je H/M/N). Reihenfolge: hoher Impact +
  niedriger Aufwand zuerst („Quick Wins"), dann hoher Impact/mittlerer Aufwand, usw.
  Gleichstände werden per Tie-Break (kleinere Abhängigkeit / größere Ergonomie-Wirkung)
  aufgelöst, sodass die Top-3 eindeutig sind (NFR-002).
- **Rationale**: Passt zu qualitativen Einschätzungen (keine Story-Points nötig), liefert
  eine eindeutige Startreihenfolge für die Umsetzung.
- **Alternatives considered**: Reine Impact-Sortierung (ignoriert Aufwand); numerisches
  RICE/WSJF (überengineered für diese Größe).

## R6 — Einordnung von Feature 065 (#80)

- **Decision**: 065 (Button-Merge attack+interact) wird als regulärer D-B-Eintrag geführt
  und relativ zu den anderen Items priorisiert — nicht privilegiert, nicht ausgeklammert.
- **Rationale**: Ziel der Untersuchung war gerade, 065 ins Gesamtbild zu setzen statt
  isoliert umzusetzen.
- **Alternatives considered**: 065 vorab fixieren (widerspricht research-first); 065 ganz
  weglassen (verliert bereits geleistete Spezifikationsarbeit).

**Ausgang**: Alle Methodik-Unbekannten aufgelöst — keine offenen `NEEDS CLARIFICATION`.
Bereit für Phase 1 (Format-Kontrakte + Datenmodell + Abnahme-Leitfaden).
