# Prüfliste Spezifikationsqualität: Spezialräume — Schwierigkeit harmonisieren

**Zweck**: Vollständigkeit und Qualität der Spezifikation prüfen, bevor die Planung beginnt
**Erstellt**: 2026-09-01
**Feature**: [spec.md](../spec.md)
**Besonderheit**: erstellt OHNE Befragung des Projektinhabers — siehe „Annahmen" in der spec.md

## Inhaltliche Qualität

- [x] Keine Umsetzungsdetails (Sprachen, Rahmenwerke, Schnittstellen)
      *Anmerkung*: Datei- und Funktionsnamen werden genannt, weil sie den GEMESSENEN Ist-Zustand
      belegen (Abschnitt 2) und die Randbedingungen des Projekts sind (C-001..C-004). Die
      Anforderungen selbst schreiben keine Umsetzung vor — FR-001 verlangt „eine gemeinsame
      Quelle", nicht eine bestimmte Datei.
- [x] Auf Nutzen und Bedarf ausgerichtet (Abschnitt 3 Zielbild, Abschnitt 4 Szenarien)
- [x] Für Nicht-Entwickler lesbar (Abschnitt 1–4, 10 kommen ohne Code aus)
- [x] Alle Pflichtabschnitte gefüllt

## Vollständigkeit der Anforderungen

- [x] Keine `[NEEDS CLARIFICATION]`-Marker — stattdessen benannte offene Fragen Q1–Q4
- [x] Anforderungen sind prüfbar und eindeutig
- [x] Anforderungstypen getrennt (FR / NFR / C)
- [x] IDs eindeutig über FR-###, NFR-###, C-###
- [x] Jede Zeile hat einen Status
- [x] Nicht-funktionale Anforderungen mit messbarer Schwelle **und** gemessenem Ausgangswert
- [x] Erfolgskriterien messbar
- [~] Erfolgskriterien technologieunabhängig
      *Anmerkung*: SC-008 nennt `node tools/runTests.js`, `?v=` und `GAME_VERSION`. Das ist eine
      ausdrückliche Auflage des Auftrags und des Issues, kein Leck aus der Umsetzung.
- [x] Abnahmeszenarien beschrieben (S1–S4 plus Randfälle)
- [x] Randfälle benannt
- [x] Umfang klar abgegrenzt (Abschnitt 12)
- [x] Abhängigkeiten und Annahmen benannt (A-01..A-11)

## Feature-Reife

- [x] Jede funktionale Anforderung hat ein Abnahmekriterium (SC-001..SC-008 decken FR-001..FR-010)
- [~] Nutzerszenarien decken die Hauptpfade
      *Anmerkung*: Was ein Spieler tatsächlich FÜHLT, ist nicht gemessen. Das Issue verlangt
      selbst „ein Durchlauf je Modus vor dem Angleichen" — dieser Spieltest fehlt und ist als
      A-03 offengelegt.
- [~] Das Feature erfüllt die messbaren Ziele
      *Anmerkung*: Die Zielwerte (Faktor 2,0 / 1,8 / 2,5) sind ein VORSCHLAG dieser
      Spezifikation, keine Vorgabe des Projektinhabers — siehe Q1 und Q4.
- [x] Keine Umsetzungsdetails in den Anforderungen

## Offen (blockiert die Planung nicht, muss aber vor der Umsetzung entschieden werden)

1. **Q1** — Wo liegt das Zielband? (NFR-001/002 sind Vorschläge)
2. **Q2** — Zählt `escape` mit seiner freiwilligen Aufgabe ins selbe Band?
3. **Q3** — Bekommt `hunt` einen breitenwirksamen Regler oder bleibt es eine eigene Klasse?
4. **Q4** — Ist die Stapelung Tiefe × Edikt × Modus gewollt, und wo liegt der Deckel?

## Anmerkungen

- Der Ist-Zustand ist gemessen, nicht abgeschrieben (Anhang A der spec.md). Zwei Behauptungen
  des Issues wurden dabei korrigiert: `hunt` ist **nicht** reglerlos (Ziel-HP ×6,0), und die
  Basiswelle eines Spezialraums bekommt den Modus-Faktor **schon heute**.
- `spec-kitty constitution context --action specify` meldete
  „Governance: unresolved — Constitution selected unavailable tools: node, npm, phaser".
  Die Governance-Prüfung konnte deshalb nicht laufen; das ist ein Werkzeugproblem des
  Projekt-Setups, kein Mangel dieser Spezifikation.
