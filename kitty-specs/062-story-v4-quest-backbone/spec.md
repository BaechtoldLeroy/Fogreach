# Specification: Story v4 — Quest-Rückgrat (Doppelagenten-Struktur)

**Feature:** `062-story-v4-quest-backbone` · **Mission:** software-dev · **Status:** Proposed
**Quellen (im Feature versioniert unter `research/`):** `Fogreach_Story_v4.md` (Story-Bibel), `Fogreach_Quest_Migration_v4.md` (Migration + Code-Blöcke), `Fogreach_Dialog_Skript_v1.md` (Dialoge/Szenen).

---

## 1. Overview

Die Story wurde auf **v4** neu geschrieben: eine Doppelagenten-Struktur, in der der Spieler nach der geheimen Ratssitzung nicht flieht, sondern eingebettet bleibt und den Widerstand von innen füttert. Der Bruch mit dem Rat rückt ans Ende von Akt 3, die Akt-Trigger verschieben sich, es kommen zwei Tarnaufträge und mehrere neue Quests hinzu, und das Story-Ende wird über eine terminale Quest erreichbar.

Dieses Feature setzt **nur das Quest-Rückgrat** um — die Datenschicht und Fortschrittslogik, die die neue Akt-Struktur trägt: das Akt-Trigger-Register, verschobene `advanceAct`-Trigger, `requiredAct`/`prerequisites` aller Quests, Umbenennungen, neue Quests inklusive ihrer Angebots-/Unterwegs-/Abschlusstexte, die Doppel-Tonspur an den Rats-Quests, einen Story-Flag-Speicher (`questFlags.js`) und einen Reset des Story-Fortschritts beim Laden alter Spielstände.

Damit werden **Akt 1 bis 4 und das Story-Ende erreichbar** — das schließt das bekannte Problem, dass Akt 5/6 bzw. das Ende nie erreichbar waren (**Issue #44**).

**Warum jetzt:** Die bisherige Akt-Leiter endete bei Akt 4; `mara_assault`, `harren_rescue` und `final_truth` hingen ohne Trigger fest. Die v4-Struktur räumt das auf und gibt der Story einen durchgängigen, testbaren Bogen.

---

## 2. Scope

### In Scope
- Kanonisches Akt-Trigger-Register mit **genau vier** `advanceAct`-Triggern (Akt 0→1→2→3→4) plus einer terminalen Quest, die `story_ending` freischaltet.
- Verschieben der Trigger: `mara_warning` triggert Akt 3, `bruch_confrontation` triggert Akt 4, `elara_second_truth` ist **kein** Trigger.
- Umbenennungen: `ritual_chamber` → `verseuchte_kammer`, `harren_rescue` → `schattenrat_finale`; `final_truth` entfernt.
- `requiredAct` und `prerequisites` aller Quests gemäß Migration-Tabelle B (Doppelagenten-Verteilung über Akt 2 und 3).
- Neue Quests inkl. ihrer Texte: `faction_campaign`, `klerus_district_purge`, `garde_night_escort`, `who_you_were`, `elara_second_truth`, `the_reckoning`.
- Doppel-Tonspur (zweite Tonspur im Abschlusstext) an `council_seizure`, `council_surveillance`, `verseuchte_kammer`.
- Story-Flag-Speicher `questFlags.js` (Setzen/Lesen/Persistieren der Flags aus Migration-Abschnitt F), integriert in den bestehenden Save-Fluss.
- Reset des Story-/Quest-Fortschritts beim Laden von Spielständen, die noch die alte Struktur tragen (Level/Items/Gold bleiben).
- `docs/QUESTS.md` neu generieren (Generator liest die neuen `QUEST_DEFINITIONS`).

### Out of Scope (jeweils eigenes Folge-Feature)
- Das **Vier-Regler-Finale-Modul** (`questFinale.js`, `computeFinaleState`) und die Entscheidungs-UI in `the_reckoning`. In diesem Feature ist `the_reckoning` eine Dialog-Quest, die `story_ending` freischaltet — die Regler-Auswertung und die Elara-Wahl folgen später.
- **Aufwändige Szenen-Inszenierung**: die „Zuhören"-Fortschrittsleiste der geheimen Sitzung, die Vatermord-Sequenz mit Kamera, das Elara-Lager als gespielte Szene. In diesem Feature liegen die zugehörigen Beats als Quest-Texte vor, nicht als inszenierte Szenen.
- **Verzweigte Spieler-Antwortauswahl** (`[Spieler: …]`) als neues Dialog-UI. Vorhandene flag-abhängige Textvarianten (z. B. Abschlusstext je nach `verification_sealed`) werden als Daten unterstützt, soweit das bestehende Dialogsystem das trägt; ein neues Auswahl-UI ist nicht Teil dieses Features.
- Die drei neuen **Boss-Mechaniken** (Kettenmeister Fesselung, Zeremonienmeister Auslöschung, Schattenrat Quelle). Die Boss-**Quests** (`boss_kill`-Objectives) sind in Scope und funktionieren mit den bestehenden Bossen; die neuen Mechaniken sind es nicht.
- **Hub-Evolution** über die Akte (Layout-/Bedeutungswechsel, feindliches Rathaus nach dem Bruch).
- Migration laufender Story-Spielstände (bewusst durch Reset ersetzt).

---

## 3. User Scenarios & Testing

### Primär: Ein neuer Spielstand durchläuft die Akt-Leiter
Ein frisch gestarteter Spielstand erreicht der Reihe nach Akt 1, 2, 3 und 4, wobei **jeder** Aktübergang von genau der im Register vorgesehenen Quest ausgelöst wird. Nach Abschluss der terminalen Quest ist das Story-Ende freigeschaltet. Kein Aktübergang passiert doppelt oder durch die falsche Quest.

**Akzeptanz:**
- Abschluss von `harren_daughter_investigation` setzt Akt 1.
- Abschluss von `council_collusion_reveal` setzt Akt 2.
- Abschluss von `mara_warning` setzt Akt 3.
- Abschluss von `bruch_confrontation` setzt Akt 4.
- Abschluss von `the_reckoning` schaltet `story_ending` frei.
- `elara_second_truth` setzt **keinen** Akt.

### Primär: Doppelspiel bleibt annehmbar
Nach der geheimen Sitzung (Akt 2) sind die Rats-Quests weiterhin annehmbar; ihr Abschlusstext trägt die zweite (Doppelagenten-)Tonspur. Der Rat wird nicht vorzeitig feindlich; die Enttarnung passiert erst mit `bruch_confrontation` am Ende von Akt 3.

### Primär: Fraktions-Quests öffnen die Sitzung
Die vier Fraktions-Quests in Akt 1 (`magistrat_verification`, `klerus_purification`, `garde_patrol_expansion`, `widerstand_proof`) sind Vorbedingung von `council_collusion_reveal`; erst wenn alle vier abgeschlossen sind, wird die Sitzung angeboten.

### Alternate: Alter Spielstand wird geladen
Ein Spielstand mit der alten Quest-Struktur (enthält z. B. `ritual_chamber`, `final_truth`, alte Flags) wird geladen. Der Story-/Quest-Fortschritt wird auf Akt 0 zurückgesetzt; Charakter-Fortschritt (Level, Inventar, Gold, Skillbaum) bleibt erhalten. Es entstehen keine Konsolenfehler durch unbekannte alte Quest-IDs.

### Edge: Flags über Quests hinweg
Ein in Akt 1/2 gesetzter Flag (z. B. `verification_sealed`, `petitions_kept`) ist in einer späteren Quest bzw. deren Textvariante lesbar und übersteht Speichern/Laden desselben Slots. Flags sind pro Speicherslot getrennt (Konsistenz mit dem Slot-System).

### Edge: Doppelte Namen / Identität
Keine zwei Quests tragen denselben Titel. `espionage_informant` gehört Mara und setzt `mole_evidence`. Harren nennt die Tochter bis `elara_second_truth` nie „Elara".

---

## 4. Requirements

Status-Werte: **Proposed** (noch nicht umgesetzt).

### 4.1 Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | Genau vier Quests setzen `advanceAct`, jeweils auf `currentAct + 1`: `harren_daughter_investigation`→1, `council_collusion_reveal`→2, `mara_warning`→3, `bruch_confrontation`→4. Keine weitere Quest setzt `advanceAct`. | Proposed |
| FR-002 | `mara_warning` triggert Akt 3 (nicht mehr eine reine Boss-Quest); `bruch_confrontation` triggert Akt 4 (nicht Akt 3). | Proposed |
| FR-003 | `elara_second_truth` existiert als Quest in Akt 3, setzt aber **kein** `advanceAct`. | Proposed |
| FR-004 | `ritual_chamber` ist zu `verseuchte_kammer` umbenannt; `harren_rescue` zu `schattenrat_finale`; `final_truth` ist entfernt. Verweise auf die alten IDs (Boss-Mapping, Tests, Doku) sind nachgezogen. | Proposed |
| FR-005 | `requiredAct` jeder Quest entspricht Migration-Tabelle B (Akt-0-Onboarding, Akt-1-Fraktionen, Akt-2/3-Doppelspiel-Verteilung, Akt-4-Finale). | Proposed |
| FR-006 | `prerequisites` jeder Quest entsprechen Tabelle B; insbesondere ist `council_collusion_reveal` von den vier Akt-1-Fraktions-Quests abhängig. | Proposed |
| FR-007 | Die neue Quest `faction_campaign` (Akt 1, optional, Wahlkampf) existiert inkl. Angebots-/Unterwegs-/Abschlusstext. | Proposed |
| FR-008 | Die neuen Tarnaufträge `klerus_district_purge` (Akt 2, NPC Klerus) und `garde_night_escort` (Akt 3, NPC Garde) existieren inkl. Texten und Doppel-Tonspur im Abschluss. | Proposed |
| FR-009 | Die neue Quest `who_you_were` (Akt 3, NPC Branka, optional) existiert, Objective `fetch memory_shard ×3` mit `minDepth`, und setzt `self_remembered`. | Proposed |
| FR-010 | Die neue Quest `the_reckoning` (Akt 4, NPC Thom) existiert, Objective `dialogue press_decision ×1`, und schaltet `story_ending` frei. | Proposed |
| FR-011 | `espionage_informant` gehört NPC Mara, liegt in Akt 3, setzt `mole_evidence`. | Proposed |
| FR-012 | `thom_truth` ist in Akt 3 verortet (von Akt 4 hochgezogen). | Proposed |
| FR-013 | Die Rats-Quests `council_seizure`, `council_surveillance`, `verseuchte_kammer` tragen im Abschlusstext die zweite (Doppelagenten-)Tonspur. | Proposed |
| FR-014 | Ein Story-Flag-Speicher (`questFlags.js`) kann Flags setzen, lesen und listen; die Flags aus Migration-Abschnitt F werden von den jeweils zuständigen Quests gesetzt. | Proposed |
| FR-015 | Story-Flags werden pro Speicherslot persistiert und beim Laden desselben Slots wiederhergestellt (Konsistenz mit dem Slot-System). | Proposed |
| FR-016 | Beim Laden eines Spielstands mit alter Story-/Quest-Struktur wird der Story-/Quest-Fortschritt (inkl. Story-Flags und Akt-Index) auf den Startzustand (Akt 0) zurückgesetzt; Charakter-Fortschritt bleibt erhalten. | Proposed |
| FR-017 | Unbekannte/alte Quest-IDs in geladenen Ständen werden ohne Fehler ignoriert. | Proposed |
| FR-018 | Boss-Quest-Objectives sind auf die korrekten Boss-Ziel-IDs verdrahtet: `mara_warning`→`kettenmeister`, `elara_ritual`→`zeremonienmeister`, `schattenrat_finale`→`schattenrat`. | Proposed |
| FR-019 | `docs/QUESTS.md` wird aus den neuen `QUEST_DEFINITIONS` neu generiert und bildet die v4-Struktur inkl. Akt-Register korrekt ab. | Proposed |
| FR-020 | Die Gesamtzahl der Quest-Definitionen entspricht der v4-Vorgabe (34), ohne doppelte IDs oder doppelte Titel. | Proposed |

### 4.2 Non-Functional Requirements

| ID | Requirement | Schwelle / Messung | Status |
|---|---|---|---|
| NFR-001 | Keine Regression in der bestehenden Test-Suite. | `node tools/runTests.js` meldet 0 Fehler; die neue Quest-Struktur ist durch zusätzliche Tests abgedeckt. | Proposed |
| NFR-002 | Neue/geänderte Quest-Logik ist unit-getestet (analog zu `tests/questSystem.test.js`). | Jeder der vier Akt-Trigger und die `story_ending`-Freischaltung haben mindestens einen Test; ein Test prüft, dass genau vier `advanceAct`-Trigger existieren. | Proposed |
| NFR-003 | Architektur-Konformität: neue Module folgen dem Classic-Script-Muster des Projekts (kein ES-`import`/`export`; Zustand über `window.*`, injizierbarer Storage-Adapter wie bei den anderen Save-Modulen). | Code-Review; `questFlags.js` lädt ohne Modul-System und ist über `window` erreichbar. | Proposed |
| NFR-004 | Der Boot bleibt fehlerfrei; keine neuen Konsolen-Fehler beim Start, beim Laden alter Stände oder beim Durchlaufen der Akt-Leiter. | Manuelle Boot-Prüfung + Konsole ohne Fehler. | Proposed |
| NFR-005 | Auslieferung folgt dem Deploy-Ritual des Projekts. | `?v=`-Cache-Buster für jede geänderte JS-Datei in `index.html` gebumpt; neue Dateien haben `<script>`-Tag mit Version. | Proposed |

### 4.3 Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | Classic-Script-Architektur: keine ES-Module. Das in der Migration-Vorlage als ES-Modul skizzierte `questFlags.js`/`questFinale.js`-Muster wird auf das Projekt-Muster (`window`-Global, IIFE) übertragen. | Proposed |
| C-002 | Fließtext in Umlauten (ä/ö/ü), Code-Strings in ASCII (ae/oe/ue) — Konvention der bestehenden `questSystem.js`-Daten. | Proposed |
| C-003 | Speicherzugriffe laufen über `window.SlotStorage` (Slot-Namespacing), nie direkt über `localStorage` — Konsistenz mit dem Speicherslot-System. | Proposed |
| C-004 | Akt-Aufstieg bleibt rein quest-getrieben (`advanceAct` bzw. der hartverdrahtete `council_collusion_reveal`-Sprung). Kein tiefen-/wellenbasierter Aufstieg. | Proposed |
| C-005 | Boss-Quests nutzen die bestehenden Bosse und deren `boss_kill`-Trigger; keine neuen Boss-Mechaniken in diesem Feature. | Proposed |
| C-006 | Bestehende, inhaltlich unveränderte Quests behalten ihre IDs; nur die in der Migration benannten IDs werden umbenannt/entfernt. | Proposed |

---

## 5. Success Criteria

- **SC-001:** Ein neuer Spielstand erreicht Akt 1→2→3→4 in Folge, jeder Übergang durch die im Register vorgesehene Quest; nach `the_reckoning` ist `story_ending` gesetzt. (Vorher: Ende unerreichbar — #44.)
- **SC-002:** Nach der geheimen Sitzung bleiben die Rats-Quests bis in Akt 3 annehmbar; ihre Abschlusstexte tragen die zweite Tonspur.
- **SC-003:** Das Laden eines alten Spielstands führt zu einem sauberen Story-Reset (Akt 0) ohne Verlust von Level/Inventar/Gold und ohne Konsolen-Fehler.
- **SC-004:** Story-Flags übersteht Speichern/Laden im selben Slot und sind zwischen Slots getrennt.
- **SC-005:** `docs/QUESTS.md` bildet die v4-Struktur inkl. lückenlosem Akt-Register (kein „kein Trigger"-Vermerk mehr für Akt 1–4) ab.
- **SC-006:** Test-Suite grün (0 Fehler); mindestens die vier Akt-Trigger, die Ende-Freischaltung, die „genau vier Trigger"-Invariante und der Alt-Stand-Reset sind getestet.
- **SC-007:** #44 ist geschlossen (Story-Ende erreichbar).

---

## 6. Key Entities

- **Quest-Definitionen** (`QUEST_DEFINITIONS` in `js/questSystem.js`): 34 Quests mit `id`, `npcId`, `requiredAct`, `prerequisites`, `chain`, `objectives`, `rewards`, optional `advanceAct`, `minDepth`, `unlocks`, sowie Angebots-/Unterwegs-/Abschlusstext (teils flag-abhängig).
- **Akt-Trigger-Register** (Migration Abschnitt A): die kanonische Zuordnung Aktgrenze → Trigger-Quest.
- **Story-Flags** (`questFlags.js`, Migration Abschnitt F): u. a. `verification_sealed`/`verification_refused`, `petitions_kept`/`petitions_surrendered`, `convoy_blade_drawn`, `elara_trust`, `mole_evidence`, `self_remembered`. (Die Finale-Flags `harren_dead`, `elara_spared`/`elara_killed` gehören zum Finale-Folge-Feature.)
- **Fraktions-Ansehen / Wissens-Fragmente:** die Migration nennt `reputation`/`knowledgeFragments`; diese binden an die bestehenden Systeme (`factionSystem`, `knowledgeTree`) an bzw. werden als deren Belohnungen ausgedrückt.
- **NPCs:** Aldric, Harren, Elara, Mara, Branka, Thom, Klerus-Priester, Stadtwache.
- **Bosse (bestehend):** Kettenmeister (Tiefe 10), Zeremonienmeister (Tiefe 20), Schattenrat (Tiefe 30).

---

## 7. Assumptions

- Der **Reset** alter Story-Stände (statt Migration) ist akzeptiert (vom Nutzer bestätigt): Story von vorn, Charakter-Fortschritt bleibt.
- Das bestehende Dialogsystem rendert Angebots-/Unterwegs-/Abschlusstexte; **flag-abhängige Textvarianten** werden nur so weit umgesetzt, wie das bestehende System sie trägt. Reiche verzweigte Auswahl-Dialoge (`[Spieler: …]`) und inszenierte Szenen sind Folge-Features.
- `the_reckoning` schaltet in diesem Feature `story_ending` über ein `dialogue`-Objective frei; die Vier-Regler-Auswertung und die Elara-Wahl sind noch nicht wirksam (Folge-Feature). Das reicht, um #44 (Erreichbarkeit) zu schließen.
- Die **exakten Code-Blöcke** aus Migration Abschnitt C sind die verbindliche Vorlage für die Quest-Daten (mit ASCII-Code-Strings gemäß C-002); Feldnamen werden beim Umsetzen einmal gegen die reale `questSystem.js` abgeglichen (VERIFY-Hinweise der Migration).
- Story-Flags nutzen denselben Slot-Namespacing-Mechanismus wie die übrigen Save-Keys.

---

## 8. Dependencies

- Bestehende Systeme: `js/questSystem.js`, `js/storySystem.js`, `js/storage.js`, `js/saveSlots.js` (Slot-Namespacing), `js/player.js` (Boss-Mapping, Quest-Fortschritt-Trigger), `tools/genQuestDoc.js` (Doku-Generator), `tests/questSystem.test.js`.
- Referenzdokumente unter `research/`: `Fogreach_Story_v4.md`, `Fogreach_Quest_Migration_v4.md`, `Fogreach_Dialog_Skript_v1.md`.
- Schließt **Issue #44**.
- Voraussetzung für die Folge-Features: Finale-Vier-Regler (`questFinale.js` + `the_reckoning`-Entscheidung), Szenen-Inszenierung, drei Boss-Mechaniken, Hub-Evolution.
