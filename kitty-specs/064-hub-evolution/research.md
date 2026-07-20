# Research: Hub-Evolution

## R1 — Phasen-Modell (Entscheidung: 4 abgeleitete Phasen, priorisiert)
- **Befund:** Story v4 §15 nennt drei Wandel-Punkte (Kippung A2, Bruch A3→A4, Epilog). Der Ausgangszustand ist die vierte (implizite) Phase.
- **Entscheidung:** vier Phasen `council/doubleAgent/broken/epilogue`, rein aus Akt-Index + Flags abgeleitet (nicht persistiert), Priorität epilogue>broken>doubleAgent>council. So zeigt ein in beliebigem Akt geladener Stand sofort die richtige Phase (FR-009).
- **Alternative verworfen:** Phase als eigenes Save-Feld — würde mit dem Akt-Index driften und braucht Migration.

## R2 — „Bruch" = Akt 4 (Entscheidung)
- **Befund:** `bruch_confrontation` triggert Akt 4; Aldrics letzte Quest (`verseuchte_kammer`) liegt in Akt 3.
- **Entscheidung:** `broken` gilt ab `actIndex >= 4`. „Aldric kein Questgeber mehr" ist ab Akt 4 ohnehin konsistent (er hat keine Akt-4-Quest); die Phase macht es explizit über `aldricBlocksQuests`.

## R3 — Visuelle Umsetzung (Entscheidung: Hybrid — code-gezeichnet + Asset-Austauschpunkt)
- **Befund:** Nutzer-Entscheidung Hybrid. Hub-Hintergrund ist ein einzelnes Bild (`hubscene_bg`); die Anschlagtafeln sind Teil davon, keine separaten Objekte.
- **Entscheidung:** Tint auf `bg` + Overlay-/Nebel-Rechtecke + code-gezeichnete Tafeln-Abdeckung. `PHASE_STYLE.assetKey` ist der Austauschpunkt: liegt eine Phasen-Textur vor, wird sie genutzt, sonst Fallback (C-006).
- **Alternative verworfen:** Sofort neue Hintergrund-Assets — blockiert auf externe Art, liefert nicht.

## R4 — Aldric-Quest-Sperre (Entscheidung: bestehendes Muster erweitern)
- **Befund:** HubSceneV2 hat bereits `aldricRefuses` (PrintingHouse-Retaliation `active_hunt`) → dann kein `questMode='offer'`.
- **Entscheidung:** die Bedingung um `HubPhase.aldricBlocksQuests(currentPhase)` erweitern. Gleiches Muster, kein neuer Mechanismus. Betrifft Angebot UND Quest-Indikator (beide lesen `getAvailableQuests`).

## R5 — NPC-Flavor je Phase (Entscheidung: additive Override-Map)
- **Befund:** Flavor kommt aus `storySystem.getNpcDialogue(npcId)` bzw. `npcData.lines`.
- **Entscheidung:** `HubPhase.npcFlavorByPhase[phase][npcId]` überschreibt die Flavor-Zeilen, wenn vorhanden; sonst unverändert. Kein Umbau des Dialogsystems.

## R6 — Epilog-Bürger (Entscheidung: 063-NPC wiederverwenden)
- **Befund:** der `buerger`-NPC (063/#66) erscheint ab Akt 2 und setzt `truth_told`.
- **Entscheidung:** im Epilog dient er als Vorleser (Flavor-Override + ggf. Position/Prominenz). Kein neuer NPC.

## R7 — Parallelität (Entscheidung: Fundament/View/Integration)
- **Entscheidung:** Die visuelle Anwendung ist ein einzelner Integrationspunkt (HubSceneV2). Statt Etappen A/B/C parallel (Kollision auf HubSceneV2) wird geschnitten in: reine Logik (`hubPhase.js`), Rendering-Modul (`hubPhaseView.js`), Integration (HubSceneV2/hubLayout/index.html). Logik + View bauen parallel gegen die zwei Kontrakte; Integration zuletzt.

## R8 — Deploy/Test (unverändert)
- Cache-Buster pro geänderter JS-Datei; neue Module `<script>`-Tag mit Version. `node tools/runTests.js` grün; Boot-Check je Phase (Akt via Konsole forcieren) nach [[project_browser_verification]].
