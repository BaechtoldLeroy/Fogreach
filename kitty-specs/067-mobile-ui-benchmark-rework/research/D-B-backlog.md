# D-B — Priorisiertes Mobile-UI-Rework-Backlog

Aus D-A (WP02) abgeleitet, gefiltert durch das **DI-Leitbild** (voller ARPG, manueller Kampf;
kein Auto-Attack). Priorisierung: Impact × Aufwand (H/M/N), Quick-Wins (hoher Impact + niedriger
Aufwand) zuerst; Tie-Break nach research R5. Format nach `contracts/D-B-backlog.contract.md`.

## Backlog (nach Priorität)

| Prio | ID | Item | Impact | Aufwand | Bezug | Kurzbegründung |
|------|----|------|--------|---------|-------|----------------|
| 1 | RW-01 | **Kontext-Primärbutton**: `attack` + `interact` zu einer kontextsensitiven Zelle (= Feature **065** / #80) | H | M | A3 | **✅ DONE (b61)** — umgesetzt, live. |
| 2 | RW-02 | **Label-Kontrast** auf hell gefärbten Buttons (z. B. Cyan Frostnova/Wirbelwind): dunkler Text/Outline | M | N | A5 | **✅ DONE (b62)** — Umriss 2→3.5 + Schatten. |
| 3 | RW-03 | **Leere Slots ausblenden** statt grau anzeigen | M | N | A2 | **✓ WAR SCHON ERFÜLLT** — `_resolveSlot`/`_runtimeSpec` geben für leere Slots `null` → Button wird gar nicht gebaut. |
| 4 | RW-04 | Trefferflächen ≥48 px + Primärangriff als größtes Target | M | N–M | A7 | **✓ ≥48px ERFÜLLT** (BASE_RADIUS 38 = 76px). Offener Rest: „größter Primärbutton" (optional). |
| 5 | RW-05 | **Reachability-Anordnung**: häufigste Aktionen in den unteren-rechten Daumenbogen | M | M | A1 | ⏳ OFFEN — Layout-Umbau, ändert Muskelgedächtnis (Design-Entscheidung). |
| 6 | RW-06 | **Safe-Area-Platzierung** von Cluster+Joystick verifizieren/feintunen | N | N | A4 | ⏳ OFFEN — reine Prüfung/Feintuning (Grundlage mobileSafeArea da). |
| 7 | RW-07 | *(optional)* **Floating/adaptiver Joystick** (re-zentriert unter dem Daumen, Brawl-Stars-Stil) | M | M | A1, A7 | ⏳ OFFEN — via rex-**Reposition** (globaler pointerdown setzt Basis auf Touch) ODER Custom-Widget; nicht mehr via setVisible. Input-kritisch → Feel prüfen. |

**Stand**: RW-01/02 umgesetzt (b61/b62); RW-03/04 waren bereits erfüllt. Offen: RW-05
(Reachability, subjektiv), RW-06 (Safe-Area-Check), RW-07 (floating Joystick, input-kritisch).

## Bereits gelöst / bewusst so gelassen (NICHT im Backlog)
- **Auto-Pickup von Loot**: bereits vorhanden (Gold-Overlap + magnetische Anziehung via
  Wissensbaum, `pickupAddRange`) → kein Handlungsbedarf.
- **Cooldown-Anzeige**: aktuelle Darstellung (Sekunden + Labels, gameNow-korrekt) wird bewusst
  **beibehalten** — kein radialer Sweep.
- **Auto-Attack** (Archero/VS/SK-Modell): per Leitbild-Entscheidung ausgeschlossen — Fogreach
  bleibt manueller DI-Stil-Kampf (siehe D-A A6). Auch die optionale **Zielhilfe** (auto-target)
  wird bewusst **nicht verfolgt** — Zielen/Feuern bleibt manuell.

## Einordnung von Feature 065 / #80
065 (Kontext-Primärbutton) steht auf **Prio 1** — höchster Impact (H) bei mittlerem Aufwand,
bereits spezifiziert. Es ist damit relativ zu den anderen Items **oben**, aber Teil eines
größeren Bildes: die Quick Wins RW-02/RW-03 können parallel/sofort laufen, die Ergonomie-Items
(RW-04/RW-05) bilden die zweite Welle.

## Selbstprüfung (quickstart Schritt 3+4)
- [x] Nach Priorität sortierte Tabelle; jedes Item Impact + Aufwand (H/M/N).
- [x] Top-3 eindeutig (RW-01 > RW-02 > RW-03, Tie-Break benannt).
- [x] Genau ein Item = Feature 065 / #80 (RW-01), relativ eingeordnet (FR-005).
- [x] Jedes Item verweist auf ≥1 Prinzip/Achse aus D-A.
- [x] D-A/D-B allein als Feature-Schneidegrundlage nutzbar (self-contained).
