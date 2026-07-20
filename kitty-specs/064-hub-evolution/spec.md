# Specification: Hub-Evolution über die Akte

**Feature:** 064-hub-evolution · **Mission:** software-dev · **Issue:** [#67](https://github.com/BaechtoldLeroy/Fogreach/issues/67)
**Baut auf:** 062 (Quest-Rückgrat) + 063 (Inszenierung), gemergt auf `main`

## 1. Overview

Der Hub (Stadtplatz vor Rathaus, Schmiede, Druckerei) bleibt aktuell über die gesamte Story **statisch**. Story v4 §15 sieht drei Wandel-Punkte vor: eine leise Kippung ab Akt 2, den strukturellen **Bruch** am Ende von Akt 3, und einen veränderten **Epilog-Hub** nach dem Story-Ende. Dieses Feature macht den Hub akt- und flag-abhängig, sodass er in Akt 0–1, ab Akt 2, nach dem Bruch und im Epilog **erkennbar unterschiedlich** aussieht und klingt.

**Ansatz (Hybrid):** Die sichtbaren Veränderungen werden zunächst **code-gezeichnet** (Tint/Entsättigung, Overlay-/Nebel-Layer, veränderte Anschlagtafeln, tonal andere NPC-Flavor-Zeilen) — **keine neuen Grafik-Assets**, nutzt den bestehenden Hub-Hintergrund. Die Struktur bietet einen **Austauschpunkt**, an dem später optionale Art-Assets pro Phase eingehängt werden können, ohne die Logik zu ändern.

Rein additiv: kein `STORY_VERSION`-Bump, keine Quest-Datenumbauten.

## 2. Scope

### In Scope
- Eine **Hub-Phasen-Schicht**, die aus Akt-Index (`storySystem.getCurrentActIndex()`) und Story-Flags (`questSystem.getFlags()`, u. a. `story_ending`) den aktuellen Hub-Zustand ableitet: `council` (Akt 0–1), `doubleAgent` (ab Akt 2), `broken` (nach dem Bruch, Akt 4), `epilogue` (nach `story_ending`).
- **Phase `doubleAgent` (ab Akt 2):** subtile Kippung — Entsättigung/kühlerer Tint des Hubs, verblasste/veränderte Wahlkampf-Anschlagtafeln, tonal andere NPC-Flavor-Zeilen (hohler Wahlkampf, Doppelspiel).
- **Phase `broken` (der Bruch, Akt 4):** das Rathaus wird **feindlich** markiert (visuell + tonal); **Aldric ist kein Questgeber mehr** und tritt feindlich/abwesend auf; die Basis verschiebt sich spürbar zu Druckerei und Schmiede (Betonung/Hinweise).
- **Phase `epilogue` (nach `story_ending`):** dünner Nebel/hellerer Ton, ein Bürger, der auf dem Platz vorliest (Wiederverwendung des in 063 eingebauten `buerger`-NPC, sichtbar wenn `truth_told`), veränderte Flavor-Zeilen der verbliebenen NPCs.
- **Austauschpunkt für Art-Assets:** die Phasen-Schicht liest optionale, pro Phase hinterlegte Hintergrund-/Overlay-Texturen und nutzt sie, falls vorhanden; fehlen sie, greift die code-gezeichnete Darstellung.
- Auslieferung nach Projekt-Ritual (Cache-Buster, Boot-Check).

### Out of Scope (jeweils eigenes Folge-Feature)
- Neu beauftragte **Art-Assets** selbst (der Austauschpunkt ist vorbereitet; die Bilder kommen separat).
- **Layout-Umbau** des Hubs (Gebäude verschieben, neue Räume) — die Kippung bleibt „Layout bleibt, Bedeutung kippt".
- Die drei v4-**Boss-Mechaniken** (#62).
- Die Druckerei als vollwertige, eigenständige **Finale-Bühnen-Szene** über das hinaus, was 063 bereits inszeniert.
- Neue Quests oder Quest-Datenänderungen.

## 3. User Scenarios & Testing

### Primär: Der Hub kippt ab Akt 2
Ein Spieler, der Akt 2 erreicht, betritt den Hub und sieht ihn merklich kühler/entsättigt, die Anschlagtafeln verblasst; die NPCs sprechen tonal anders (hohler Wahlkampf). In Akt 0–1 war der Hub farbig und „normal".

### Primär: Der Bruch macht das Rathaus feindlich
Nach dem Bruch (Akt 4) ist das Rathaus als feindlich markiert und **Aldric bietet keine Quests mehr an** (kein „!"/Angebot); sein Auftreten ist feindlich/abwesend. Druckerei und Schmiede sind als neue Basis betont.

### Primär: Epilog-Hub nach dem Ende
Nach `story_ending` ist der Hub im Epilog-Zustand: dünnerer Nebel/hellerer Ton, der Bürger liest auf dem Platz vor (`truth_told`), verbliebene NPCs haben Epilog-Flavor.

### Alternate: Alter Spielstand / mitten in einem Akt geladen
Wird ein Spielstand in Akt 2/3/4 geladen, zeigt der Hub sofort die zum Akt/Flag passende Phase (die Phase wird aus dem Zustand abgeleitet, nicht aus einem Event).

### Edge: Kein storySystem/questSystem
Fehlen die Globals (defensiver Teil-Build), fällt der Hub auf die `council`-Ausgangsphase zurück, ohne Fehler.

### Edge: Austauschpunkt ohne Assets
Sind keine Phasen-Texturen hinterlegt, rendert die code-gezeichnete Darstellung; sind welche vorhanden, werden sie genutzt — in beiden Fällen bootet der Hub fehlerfrei.

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | Eine Hub-Phasen-Ableitung bestimmt aus Akt-Index und Story-Flags genau eine von vier Phasen: `council` (Akt 0–1), `doubleAgent` (ab Akt 2), `broken` (Akt 4 / nach dem Bruch), `epilogue` (nach `story_ending`). | Proposed |
| FR-002 | Die Phasen-Ableitung ist priorisiert und eindeutig: `epilogue` (wenn `story_ending`) > `broken` (Akt ≥ 4) > `doubleAgent` (Akt ≥ 2) > `council`. | Proposed |
| FR-003 | Phase `doubleAgent`: der Hub wird sichtbar entsättigt/kühler getönt und die Wahlkampf-Anschlagtafeln verblasst/verändert dargestellt. | Proposed |
| FR-004 | Phase `doubleAgent`: die NPC-Flavor-Zeilen wechseln tonal (hohler Wahlkampf/Doppelspiel), soweit für die jeweiligen NPCs vorgesehen. | Proposed |
| FR-005 | Phase `broken`: das Rathaus ist visuell und tonal als feindlich markiert. | Proposed |
| FR-006 | Phase `broken`: Aldric bietet keine Quests mehr an (kein Angebot/Turn-in) und tritt feindlich oder abwesend auf. | Proposed |
| FR-007 | Phase `broken`: Druckerei und Schmiede werden als neue Basis betont (visueller/tonaler Hinweis). | Proposed |
| FR-008 | Phase `epilogue`: der Hub zeigt dünneren Nebel/helleren Ton; der `buerger`-NPC liest bei gesetztem `truth_told` auf dem Platz vor; verbliebene NPCs haben Epilog-Flavor. | Proposed |
| FR-009 | Die Phase wird aus dem geladenen Zustand abgeleitet (nicht aus einem einmaligen Event); ein in einem beliebigen Akt geladener Spielstand zeigt sofort die passende Phase. | Proposed |
| FR-010 | Die Phasen-Schicht bietet einen Austauschpunkt: pro Phase optional hinterlegte Hintergrund-/Overlay-Texturen werden genutzt, falls vorhanden; sonst greift die code-gezeichnete Darstellung. | Proposed |
| FR-011 | Bestehende Hub-Interaktionen (NPC-Dialoge, Eingänge, Quest-Angebote der übrigen NPCs) funktionieren in allen Phasen unverändert weiter. | Proposed |
| FR-012 | Geänderte JS-Dateien haben einen gebumpten `?v=`-Cache-Buster in `index.html`; neue Module haben einen `<script>`-Tag mit Version. | Proposed |

### 4.2 Non-Functional Requirements

| ID | Requirement | Measure | Status |
|---|---|---|---|
| NFR-001 | Keine Regression in der bestehenden Test-Suite. | `node tools/runTests.js` meldet 0 Fehler. | Proposed |
| NFR-002 | Die reine Phasen-Ableitung ist DOM-frei unit-getestet. | Eine Funktion `(actIndex, flags) -> phase` hat Tests für alle vier Phasen, die Prioritätsreihenfolge und den Default; geladen ohne Phaser (Muster `tests/loadGameModule.js`). | Proposed |
| NFR-003 | Architektur-Konformität: Classic-Script (`window.*`, kein ES-`import/export`); Overlays folgen der rekursiven `scrollFactor`-Propagation; szenenübergreifende Zeit über `Date.now()`. | Code-Review; Boot-Check. | Proposed |
| NFR-004 | Boot bleibt fehlerfrei; keine neuen Konsolen-Fehler beim Betreten des Hubs in jeder Phase. | Browser-Boot-Check je Phase (Akt forcieren) ohne Konsolen-Fehler. | Proposed |
| NFR-005 | Der Phasen-Wechsel erzeugt keine wahrnehmbaren Ruckler beim Hub-Aufbau. | Manuelle Prüfung; kein langer Frame-Aussetzer beim Betreten. | Proposed |
| NFR-006 | Auslieferung folgt dem Deploy-Ritual (Cache-Buster/Script-Tags). | `index.html` referenziert die gebumpten/neuen Versionen. | Proposed |

### 4.3 Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | Classic-Script-Architektur, keine ES-Module. Neue Logik als `window.*`-Global/IIFE. | Proposed |
| C-002 | ASCII in IDs/Flags/Phase-Namen; Umlaute nur im Fließtext. | Proposed |
| C-003 | Kein Layout-Umbau des Hubs; nur Tönung/Overlay/Flavor/NPC-Verfügbarkeit ändern sich. „Layout bleibt, Bedeutung kippt." | Proposed |
| C-004 | Keine Quest-Datenänderung, kein `STORY_VERSION`-Bump. Der Phasen-Zustand wird aus vorhandenem Akt-Index/Flags abgeleitet, nicht separat persistiert. | Proposed |
| C-005 | Zustands-Lesen über die bestehenden Schnittstellen (`storySystem.getCurrentActIndex()`, `questSystem.getFlags()`), nie direkt über `localStorage`. | Proposed |
| C-006 | Der Austauschpunkt für Assets darf die code-gezeichnete Darstellung nicht brechen, wenn keine Assets vorliegen (Fallback ist Pflicht). | Proposed |

## 5. Success Criteria

- **SC-001:** Ein Spieler erkennt den Hub in Akt 0–1, ab Akt 2, nach dem Bruch und im Epilog **jeweils als sichtbar unterschiedlich** (Tönung/Overlay/Anschlagtafeln/Flavor).
- **SC-002:** Nach dem Bruch bietet Aldric **keine** Quest mehr an; das Rathaus ist als feindlich erkennbar.
- **SC-003:** Nach `story_ending` ist der Epilog-Zustand aktiv (Nebel-Ton + vorlesender Bürger bei `truth_told`).
- **SC-004:** Ein in Akt 2/3/4 geladener Spielstand zeigt sofort die passende Phase.
- **SC-005:** `node tools/runTests.js` grün (inkl. Phasen-Ableitungs-Tests); Boot in jeder Phase fehlerfrei; keine Regression bestehender Hub-Interaktionen.

## 6. Key Entities

- **HubPhase** — einer von `council` | `doubleAgent` | `broken` | `epilogue`; abgeleitet aus Akt-Index + Flags, nicht persistiert.
- **HubPhaseStyle** — die pro Phase definierten Darstellungs-Parameter: Tint/Entsättigung, Overlay-/Nebel-Stärke, Anschlagtafel-Zustand, optionaler Asset-Key (Austauschpunkt).
- **NPCFlavorByPhase** — phasenabhängige Flavor-Zeilen für die NPCs (z. B. Aldric feindlich in `broken`, Wahlkampf hohl in `doubleAgent`).
- **StoryState (bestehend)** — Akt-Index (`getCurrentActIndex`) + Flags (`getFlags`), gelesen, nicht verändert.

## 7. Assumptions

- Der „Bruch" entspricht Akt 4 (Index 4): `bruch_confrontation` triggert Akt 4; ab da gilt Phase `broken`. Aldrics letzte Quest (`verseuchte_kammer`) liegt in Akt 3, sodass „kein Questgeber mehr" ab Akt 4 konsistent ist.
- Der Epilog beginnt mit `story_ending` (aus `the_reckoning`) und hat Vorrang vor `broken`.
- Der `buerger`-NPC (063/#66) und sein `truth_told`-Flag werden für den Epilog wiederverwendet; kein neuer NPC nötig.
- Die code-gezeichneten Effekte (Tint, Nebel-Overlay) werden über die bestehende Hub-Szene gelegt (Kamera-/Overlay-Container), ohne den Hub-Hintergrund auszutauschen.
- Etappen aus dem Issue bilden die Work-Package-Grenzen: A = `doubleAgent`-Atmosphäre/Flavor, B = `broken`/Aldric, C = `epilogue`; die reine Phasen-Ableitung ist die gemeinsame Grundlage.
