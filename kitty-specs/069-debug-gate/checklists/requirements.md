# Spezifikations-Qualitätscheckliste: Debug-Gate

**Zweck**: Vollständigkeit und Qualität der Spezifikation prüfen, bevor es zur Planung geht
**Erstellt**: 2026-09-01
**Feature**: [spec.md](../spec.md)
**Quelle**: GitHub-Issue #88

## Inhaltliche Qualität

- [x] Keine Implementierungsdetails (Sprachen, Frameworks, Schnittstellen) — *mit bewusster Abweichung, siehe Notizen*
- [x] Auf Nutzen und Bedarf ausgerichtet
- [x] Für nicht-technische Beteiligte lesbar — *eingeschränkt, siehe Notizen*
- [x] Alle Pflichtabschnitte ausgefüllt

## Vollständigkeit der Anforderungen

- [x] Keine `[NEEDS CLARIFICATION]`-Marker mehr (offene Punkte stehen strukturiert unter „Offene Fragen")
- [x] Anforderungen sind prüfbar und eindeutig
- [x] Anforderungstypen getrennt (Funktional / Nicht-funktional / Constraints)
- [x] IDs eindeutig über FR-###, NFR-### und C-### hinweg (FR-001…019, NFR-001…007, C-001…008)
- [x] Jede Anforderungszeile hat einen nicht-leeren Status
- [x] Nicht-funktionale Anforderungen mit messbaren Schwellen (NFR-001 < 1 ms; NFR-004 ≤ 1 Zeile / ≤ 10 % Bildschirmhöhe; NFR-005 null `console.log`; NFR-007 ≥ 543 Prüfungen)
- [x] Erfolgskriterien messbar
- [~] Erfolgskriterien technologie-agnostisch — *SC-005 nennt konkrete Prüfbefehle, siehe Notizen*
- [x] Alle Akzeptanzszenarien definiert (9 Given/When/Then-Szenarien)
- [x] Randfälle identifiziert (8 Stück, u. a. Ladereihenfolge, Reload, persistierter Alt-Zustand, Mobile)
- [x] Umfang klar begrenzt („Nicht im Umfang" mit 6 Punkten)
- [x] Abhängigkeiten und Annahmen benannt (13 Annahmen AN-01…AN-13; Abhängigkeiten des kopflosen Systems in eigener Tabelle)

## Feature-Reife

- [x] Alle funktionalen Anforderungen haben klare Abnahmekriterien
- [x] Nutzungsabläufe decken die Hauptfälle ab (Spieler, Entwickler, automatisiertes System)
- [x] Das Feature erfüllt die messbaren Ergebnisse aus den Erfolgskriterien
- [x] Vollständigkeit der Bestandsaufnahme: 9 URL-Flags, 4 Einstellungs-Zugänge, 6 Overlays/Diagnosen, 3 Tasten-/Menü-Zugänge, 24 Globalen-Gruppen, 5 Konsolen-Befunde, 4 Alt-Material-Befunde — je mit Datei:Zeile
- [x] Bedarf des kopflosen Testsystems und des Spieltest-Bots ausdrücklich adressiert (FR-015, FR-016, C-006, eigene Abhängigkeitstabelle)

## Notizen

**Bewusste Abweichungen von der Standard-Checkliste**

1. **Implementierungsdetails (Datei:Zeile)**: Die Bestandsaufnahme nennt Dateien und
   Zeilennummern. Das ist hier kein Leck, sondern der Kern des Auftrags: Der Wert
   dieser Spezifikation steht und fällt mit der Vollständigkeit der Zugangsliste.
   Ein übersehener Zugang macht das ganze Gate wertlos. Die Anforderungen selbst
   (FR/NFR/C) sind unabhängig von der Umsetzung formuliert.
2. **Lesbarkeit für nicht-technische Beteiligte**: Motivation, Nutzungsabläufe,
   Erfolgskriterien und offene Fragen sind allgemeinverständlich; die
   Bestandsaufnahme-Tabellen sind es naturgemäss nicht.
3. **SC-005 nennt Prüfbefehle**: Bewusst, weil die Bedingung „das automatisierte
   Prüfsystem darf nicht ausgesperrt werden" nur an den konkreten Einstiegspunkten
   überhaupt abnehmbar ist.

**Prozess-Abweichung**

- Die im `/spec-kitty.specify`-Ablauf vorgesehene Befragung des Projektinhabers hat
  **nicht stattgefunden**. Alle Festlegungen sind aus Issue #88 und dem Quelltext
  abgeleitet und im Abschnitt „Annahmen" (AN-01…AN-13) ausdrücklich als solche
  gekennzeichnet. Echte Lücken stehen unter „Offene Fragen" (OQ-1…OQ-6).

**Vor `/spec-kitty.plan` zu klären**

- **OQ-1** — `deploy/demonfall/game/`: eine versionierte Alt-Kopie des ganzen Spiels
  mit aktivem Cheat-Pfad. Ist sie über die Pages-URL erreichbar? Falls ja, ist sie
  ein zweiter, ungegateter Einstiegspunkt und untergräbt das Feature vollständig.
- **OQ-2** — Beständigkeit des Gates über `location.reload()` (Slot-Wechsel).
- Die übrigen offenen Fragen (OQ-3…OQ-6) betreffen die Einordnung einzelner Zugänge
  und können auch in der Planung entschieden werden.
