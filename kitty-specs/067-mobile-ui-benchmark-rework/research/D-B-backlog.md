# D-B — Priorisiertes Mobile-UI-Rework-Backlog

Aus D-A (WP02) abgeleitet, gefiltert durch das **DI-Leitbild** (voller ARPG, manueller Kampf;
kein Auto-Attack). Priorisierung: Impact × Aufwand (H/M/N), Quick-Wins (hoher Impact + niedriger
Aufwand) zuerst; Tie-Break nach research R5. Format nach `contracts/D-B-backlog.contract.md`.

## Backlog (nach Priorität)

| Prio | ID | Item | Impact | Aufwand | Bezug | Kurzbegründung |
|------|----|------|--------|---------|-------|----------------|
| 1 | RW-01 | **Kontext-Primärbutton**: `attack` + `interact` zu einer kontextsensitiven Zelle (= Feature **065** / #80) | H | M | A3 | Beseitigt redundante Zelle, macht Tap eindeutig, gibt eine Zelle frei; bereits spezifiziert (065). |
| 2 | RW-02 | **Label-Kontrast** auf hell gefärbten Buttons (z. B. Cyan Frostnova/Wirbelwind): dunkler Text/Outline | M | N | A5 | Quick Win: reine Style-Änderung, sofort bessere Lesbarkeit. |
| 3 | RW-03 | **Leere Slots ausblenden** statt grau anzeigen | M | N | A2 | Quick Win: weniger HUD-Rauschen, mehr Platz/Übersicht. |
| 4 | RW-04 | **Trefferflächen ≥48 px** + Primärangriff als größtes Target + ausreichend Abstand | M | N–M | A7 | Weniger Fehl-Taps; folgt Apple/Material/WCAG-Mindestgrößen. |
| 5 | RW-05 | **Auto-Pickup von Loot** (DI-Stil, Proximity/Toggle) | M | N–M | A3, A6 | Reduziert „Interagieren"-Bedarf → Kontext-Button bleibt v. a. Angriff/Dialog/Tür. |
| 6 | RW-06 | **Radialer Cooldown-Sweep** über Buttons + klares „bereit"-Aufblitzen | M | M | A5 | Genshin-Stil-Feedback; schneller lesbar als reine Sekundenzahl. |
| 7 | RW-07 | **Reachability-Anordnung**: häufigste Aktionen in den unteren-rechten Daumenbogen | M | M | A1 | Ergonomie-Gewinn ohne neue Mechanik; Layout-Umbau der Zellen. |
| 8 | RW-08 | **Safe-Area-Platzierung** von Cluster+Joystick verifizieren/feintunen | N | N | A4 | Grundlage (mobileSafeArea) da; nur Prüfung/Feintuning der Cluster-Lage. |
| 9 | RW-09 | *(optional)* **Ziel-hilfe** à la Genshin (Angriff/Skill richtet sich auf nächsten Gegner; Feuern bleibt manuell) | M | M | A6 | Verbessert Touch-Zielen; **kein** Auto-Attack — passt ins DI-Leitbild. |
| 10 | RW-10 | *(optional)* **Floating/adaptiver Joystick** (re-zentriert unter dem Daumen, Brawl-Stars-Stil) | M | H | A1, A7 | Reachability-Plus; Input-Umbau, rex-Plugin-Fallstricke (bekannt) → höherer Aufwand. |

**Top-3 (eindeutig)**: RW-01 (065, H-Impact) → RW-02 (Kontrast, M/N Quick Win) → RW-03
(leere Slots, M/N Quick Win). Tie-Break RW-02 vor RW-03: kleinerer Eingriff (reiner Style).

## Bewusst NICHT im Backlog
- **Auto-Attack** (Archero/VS/SK-Modell): per Leitbild-Entscheidung ausgeschlossen — Fogreach
  bleibt manueller DI-Stil-Kampf (siehe D-A A6). Nur die optionale Ziel-*hilfe* (RW-09) bleibt
  als reine Assist-Idee erhalten.

## Einordnung von Feature 065 / #80
065 (Kontext-Primärbutton) steht auf **Prio 1** — höchster Impact (H) bei mittlerem Aufwand,
bereits spezifiziert. Es ist damit relativ zu den anderen Items **oben**, aber Teil eines
größeren Bildes: die Quick Wins RW-02/RW-03 können parallel/sofort laufen, die Ergonomie- und
Feedback-Items (RW-04/06/07) bilden die zweite Welle.

## Selbstprüfung (quickstart Schritt 3+4)
- [x] Nach Priorität sortierte Tabelle; jedes Item Impact + Aufwand (H/M/N).
- [x] Top-3 eindeutig (RW-01 > RW-02 > RW-03, Tie-Break benannt).
- [x] Genau ein Item = Feature 065 / #80 (RW-01), relativ eingeordnet (FR-005).
- [x] Jedes Item verweist auf ≥1 Prinzip/Achse aus D-A.
- [x] D-A/D-B allein als Feature-Schneidegrundlage nutzbar (self-contained).
