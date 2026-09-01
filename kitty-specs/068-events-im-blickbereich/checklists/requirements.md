# Spezifikations-Qualitaetscheckliste: Ereignisse im Blickbereich

**Zweck**: Vollstaendigkeit und Qualitaet der Spezifikation pruefen, bevor geplant wird
**Erstellt**: 2026-09-01
**Feature**: [spec.md](../spec.md)

## Inhaltliche Qualitaet

- [x] Keine Umsetzungsdetails (Sprachen, Rahmenwerke, Schnittstellen) in den Anforderungen — Quelltext-Fundstellen stehen bewusst getrennt im Ist-Zustand und in den Umsetzungshinweisen
- [x] Auf Spielernutzen und Spielgefuehl ausgerichtet
- [x] Fuer nicht-technische Leser verstaendlich (Abschnitte 1, 3, 4, 5, 7)
- [x] Alle Pflichtabschnitte gefuellt

## Vollstaendigkeit der Anforderungen

- [ ] Keine `[NEEDS CLARIFICATION]`-Markierungen mehr offen — **3 offen (Q1, Q2, Q3)**, bewusst dem Projektinhaber vorgelegt, weil sie weder aus Issue noch Quelltext entscheidbar sind
- [x] Anforderungen sind pruefbar und eindeutig
- [x] Anforderungstypen getrennt (funktional / nicht-funktional / Randbedingungen)
- [x] IDs eindeutig ueber FR-###, NFR-### und C-### hinweg
- [x] Jede Anforderungszeile hat einen gefuellten Status
- [x] Nicht-funktionale Anforderungen haben messbare Schwellen (Spalte „Schwelle")
- [x] Erfolgskriterien sind messbar
- [x] Erfolgskriterien sind technologie-unabhaengig formuliert
- [x] Abnahme-Szenarien beschrieben (Abschnitt 4)
- [x] Randfaelle benannt (Abschnitt 4.6)
- [x] Zuschnitt klar begrenzt (Abschnitt 10)
- [x] Abhaengigkeiten und Annahmen benannt (Abschnitt 8, jede Annahme einzeln bestaetigbar)

## Reife des Features

- [x] Jede funktionale Anforderung hat ein erkennbares Abnahmekriterium
- [x] Nutzer-Szenarien decken die Hauptablaeufe ab (annehmen, ausschlagen, scheitern, umgehen)
- [ ] Feature erfuellt die Erfolgskriterien — erst nach Umsetzung pruefbar
- [x] Keine Umsetzungsentscheidungen in die Anforderungen durchgesickert

## Anmerkungen

- Die drei offenen Fragen (Q1 Naehe-Rueckfall, Q2 Geltung fuer `hunt`, Q3 Sehen
  gegen Bestaetigen) sollten **vor** `/spec-kitty.plan` beantwortet werden. Q3
  betrifft den Zuschnitt am staerksten: eine Bestaetigungs-Interaktion waere ein
  anderes Feature als ein reiner Sicht-Auslöser.
- Zwoelf Annahmen (A-01 bis A-12) ersetzen die entfallene Befragung. Wird A-01
  oder A-02 verworfen, aendert sich der Zuschnitt grundlegend.
- FR-016 traegt bewusst den Status „Offen", weil er an Q2 haengt.
