# Specification: Story v4 — Inszenierung (Finale, Schlüsselszenen, verzweigtes Dialog-UI)

**Feature:** 063-story-v4-inszenierung
**Mission:** software-dev
**Baut auf:** 062-story-v4-quest-backbone (Quest-Rückgrat, gemergt auf `main`)

## 1. Overview

Das v4-Quest-Rückgrat (062) ist datenseitig vollständig und durchspielbar, aber **un-inszeniert**: Spieler-Entscheidungen im Dialog fehlen, zwei Schlüssel-Reveals laufen über `dialogue`-Auto-Complete-Platzhalter, und das Ende ist nur ein freigeschaltetes Flag (`story_ending`) ohne spürbaren Ausgang.

Dieses Feature liefert die **Präsentationsschicht** in drei Strängen: (1) ein wiederverwendbares, verzweigtes Spieler-Auswahl-UI für das bestehende Dialogsystem, über das die vollen `[Spieler: …]`-Auswahlen aus dem Dialog-Skript **über alle Akte** verdrahtet werden und Story-Flags setzen; (2) die drei Schlüsselszenen (geheime Sitzung, Elaras erster Riss, Elara-Lager) als gespielte Szenen mit echten Objective-Triggern statt Platzhaltern; (3) das Vier-Regler-Finale — reine Ausgangs-Logik (`computeFinaleState`) plus die Inszenierung in `the_reckoning` (Vatermord, Druck-Beat, Präsentation des berechneten Ausgangs).

Es ist rein **additiv**: kein Umbau der Quest-Datenstruktur, kein `STORY_VERSION`-Bump, kein Altstand-Reset. Quellen sind die Design-Dokumente in `kitty-specs/062-story-v4-quest-backbone/research/` (Story v4 §10 + §13, das vollständige Dialog-Skript v1, Migration v4).

## 2. Scope

### In Scope
- **Verzweigtes Dialog-Auswahl-UI** als wiederverwendbare Komponente für das bestehende Hub-/Quest-Dialogsystem: `[Spieler: …]`-Optionen, die eine Antwortzeile auslösen, optional Story-Flags setzen (`{flag}`) und flag-abhängige Textvarianten zeigen.
- **Voller Dialog-Pass:** alle `[Spieler: …]`-Auswahlen des Dialog-Skripts v1 über **alle Akte (0–4)** werden über die Komponente verdrahtet; die dokumentierten Flag-Wahlen sind funktional (u. a. `verification_sealed`/`verification_refused`, `petitions_surrendered`/`petitions_kept`, `truth_told`, `mole_evidence`).
- **Schlüsselszene: Geheime Sitzung** (`council_collusion_reveal`) mit „Zuhören"-Fortschrittsleiste, die das Objective-Ziel `collusion_reveal_seen` als echten Trigger feuert (ersetzt den 062-Platzhalter).
- **Schlüsselszene: Elaras erster Riss** (`elara_second_truth`) als gespielte Szene, die `three_hands_seen` als echten Trigger feuert (ersetzt den 062-Platzhalter).
- **Schlüsselszene: Elara-Lager** (Story v4 §13.2) als ruhige Szene ohne Auftrag (atmosphärischer Beat, keine neue Quest).
- **Vier-Regler-Finale-Logik:** neues Modul `js/questFinale.js` mit reiner Funktion `computeFinaleState(flags)`, die aus vorhandenen Story-Flags die vier Regler ableitet und einen serialisierbaren Ausgangs-Zustand liefert (kein UI, kein globaler Zustand).
- **Finale-Inszenierung** in `the_reckoning`: Vatermord-Sequenz (Harren tritt dazwischen, Kamera-/Timing-Beat), der eine Druck-Handlung, und die Präsentation des von `computeFinaleState` berechneten Ausgangs. `the_reckoning` schaltet weiterhin `story_ending` frei.
- **Auslieferung** nach Projekt-Ritual (Cache-Buster, `<script>`-Tags für neue Module, Boot-Check).

### Out of Scope (jeweils eigenes Folge-Feature)
- Die drei neuen **Boss-Mechaniken** (Kettenmeister-Fesselung, Zeremonienmeister-Auslöschung, Schattenrat-Quelle). Die Boss-**Quests** funktionieren mit den bestehenden Bossen.
- **Hub-Evolution über die Akte** (Layout-/Bedeutungswechsel, feindliches Rathaus nach dem Bruch, Epilog-Hub).
- **Menschliche Textur-Nebenquests** (Story v4 §14).
- Kein `STORY_VERSION`-Bump / kein Altstand-Reset (rein additiv; die Quest-Datenstruktur bleibt die von 062).
- Neue Quest-**Definitionen** oder Umbenennungen (alle 34 Quests bleiben wie in 062).

## 3. User Scenarios & Testing

### Primär: Spieler trifft eine Dialog-Entscheidung, die Wirkung hat
Bei `magistrat_verification` wählt der Spieler „Siegel setzen" oder „Verweigern". Die Wahl zeigt die passende Aldric-Antwort und setzt `verification_sealed` bzw. `verification_refused`. Später referenziert der Abschlusstext den gesetzten Flag; im Finale zählt die Wahl in Regler „wer steht neben dir" / Tonspur mit.

### Primär: Geheime Sitzung wird als Szene erlebt und schließt die Quest
Der Spieler betritt die Sitzung, hört über eine „Zuhören"-Leiste zu; bei Abschluss der Leiste feuert `collusion_reveal_seen`, die Quest `council_collusion_reveal` wird abschließbar und triggert (via bestehendem `advanceAct:2`) Akt 2. Ohne Zuhören schließt die Quest nicht.

### Primär: Das Finale spiegelt die Reise
Nach dem Sturz des Schattenrats spielt `the_reckoning`: der Vatermord läuft ab, dann wird der aus den Flags berechnete Ausgang gezeigt (Verrat vorhergesehen? wer steht dabei? lebt Elara? erinnert man sich?). Danach ist `story_ending` freigeschaltet. Zwei Durchläufe mit unterschiedlichen Flags zeigen unterschiedliche Ausgangstexte.

### Alternate: Spieler überspringt optionale Inhalte
Wer `who_you_were` nicht abschließt, erhält im Finale den namenlosen Ausgang (Regler 4 = false). Wer den Konvoi auffliegen lässt / Gesuche einbehält, leert den „wer steht neben dir"-Raum entsprechend.

### Edge: Flags fehlen / Alt-Zustand
`computeFinaleState` erhält einen Flag-Satz ohne die neuen Flags (z. B. Spielstand, der vor diesem Feature stand). Es liefert einen wohldefinierten Default-Ausgang (alle Regler konservativ false), ohne Fehler.

### Edge: Mobile / scrollende Dialoge
Die Auswahlkomponente ist im HubSceneV2-Dialog auch mobil antippbar (korrekte `scrollFactor`-Propagation, keine verfehlten Taps), und bei mehr Optionen als sichtbar bleibt sie bedienbar.

## 4. Requirements

### 4.1 Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-001 | Es existiert eine wiederverwendbare Spieler-Auswahl-Komponente für das bestehende Dialogsystem: sie zeigt eine Liste von `[Spieler: …]`-Optionen, ruft bei Auswahl einen Callback mit der gewählten Option auf und zeigt optional eine zugeordnete Antwortzeile. | Proposed |
| FR-002 | Eine Auswahl-Option kann einen oder mehrere Story-Flags setzen; das Setzen läuft über das bestehende `questSystem` (bzw. den bestehenden Flag-Speicher), nicht über direkten `localStorage`-Zugriff. | Proposed |
| FR-003 | Dialog-Zeilen und Optionen können flag-abhängige Varianten definieren (Text/Verfügbarkeit hängt vom gelesenen Flag ab, z. B. Abschlusstext je `verification_sealed`). | Proposed |
| FR-004 | Die vollen `[Spieler: …]`-Auswahlen des Dialog-Skripts v1 sind über **alle Akte (0–4)** über die Komponente verdrahtet; die dort mit `{flag}` notierten Flags werden korrekt gesetzt. | Proposed |
| FR-005 | Die dokumentierten Entscheidungs-Flags sind funktional gesetzt: mindestens `verification_sealed`/`verification_refused`, `petitions_surrendered`/`petitions_kept`, `truth_told`, sowie die für die Finale-Regler nötigen Flags. | Proposed |
| FR-006 | `council_collusion_reveal` wird als gespielte Szene mit „Zuhören"-Fortschrittsleiste inszeniert; deren Abschluss feuert das Objective-Ziel `collusion_reveal_seen` als echten Trigger (kein `dialogue`-Auto-Complete-Platzhalter mehr). | Proposed |
| FR-007 | `elara_second_truth` wird als gespielte Szene inszeniert; deren Abschluss feuert das Objective-Ziel `three_hands_seen` als echten Trigger (kein Platzhalter mehr). | Proposed |
| FR-008 | Die Elara-Lager-Szene (§13.2) ist als ruhige Szene ohne Auftrag spielbar (atmosphärischer Beat mit den Skript-Zeilen). | Proposed |
| FR-009 | Das Modul `js/questFinale.js` stellt eine reine Funktion `computeFinaleState(flags)` bereit, die ausschließlich aus dem übergebenen Flag-Satz einen Ausgangs-Zustand berechnet (keine Seiteneffekte, kein globaler Zustand, kein Storage-Zugriff). | Proposed |
| FR-010 | `computeFinaleState` leitet Regler 1 „Verrat vorhergesehen" aus der Handschriften-/Maulwurf-Spur ab (mindestens `mole_evidence`, ggf. weitere dokumentierte Spur-Flags). | Proposed |
| FR-011 | `computeFinaleState` leitet Regler 2 „wer steht neben dir" (Branka/Mara/Thom je einzeln anwesend/abwesend) aus den Verhaltens-Flags ab (u. a. `petitions_surrendered`/`petitions_kept`, Konvoi-/Spionage-Flags). | Proposed |
| FR-012 | `computeFinaleState` leitet Regler 3 „lebt Elara" aus Vertrauen (`elara_trust`) und Beweisen ab und liefert die möglichen Ausgänge (mit Worten aufgehalten → lebt; sonst → ihre Klinge). | Proposed |
| FR-013 | `computeFinaleState` leitet Regler 4 „Selbst erinnert" allein aus dem Abschluss von `who_you_were` (`self_remembered`) ab, nicht aus gesammelten Fragmenten. | Proposed |
| FR-014 | Bei fehlenden/unbekannten Flags liefert `computeFinaleState` einen wohldefinierten konservativen Default (Regler false), ohne Fehler. | Proposed |
| FR-015 | `the_reckoning` spielt die Vatermord-Sequenz (Harren tritt dazwischen; Kamera-/Timing-Beat) und danach die eine Druck-Handlung. | Proposed |
| FR-016 | `the_reckoning` präsentiert den von `computeFinaleState` gelieferten Ausgang (die vier Regler in Text/Inszenierung sichtbar), und schaltet weiterhin `story_ending` frei. | Proposed |
| FR-017 | Die Auswahlkomponente und die Szenen sind im HubSceneV2-Dialogkontext bedienbar: korrekte rekursive `scrollFactor`-Propagation und mobil zuverlässig antippbar. | Proposed |
| FR-018 | Neue JS-Module sind über `index.html` mit `<script>`-Tag (inkl. `?v=`-Version) eingebunden; geänderte JS-Dateien haben einen gebumpten Cache-Buster. | Proposed |

### 4.2 Non-Functional Requirements

| ID | Requirement | Measure | Status |
|---|---|---|---|
| NFR-001 | Keine Regression in der bestehenden Test-Suite. | `node tools/runTests.js` meldet 0 Fehler. | Proposed |
| NFR-002 | Die Finale-Logik ist vollständig unit-getestet. | `computeFinaleState` hat pro Regler mindestens je einen Test für true/false sowie den Default-Fall; Tests laden das Modul ohne DOM (Muster `tests/loadGameModule.js`). | Proposed |
| NFR-003 | Architektur-Konformität: neue Module folgen dem Classic-Script-Muster (kein ES-`import`/`export`; Zustand/Anbindung über `window.*`). | Code-Review; `questFinale.js` lädt ohne Modul-System und ist über `window` erreichbar; `computeFinaleState` ist ohne Phaser/DOM aufrufbar. | Proposed |
| NFR-004 | Der Boot bleibt fehlerfrei; keine neuen Konsolen-Fehler beim Start, im Hub-Dialog, in den Szenen oder im Finale. | Browser-Boot-Prüfung + Konsole ohne Fehler; die Szenen sind erreichbar. | Proposed |
| NFR-005 | Auslieferung folgt dem Deploy-Ritual des Projekts. | `?v=`-Cache-Buster für jede geänderte JS-Datei in `index.html`; neue Dateien haben `<script>`-Tag mit Version. | Proposed |
| NFR-006 | Die Auswahlkomponente reagiert flüssig; keine wahrnehmbaren Ruckler beim Öffnen der Optionen oder beim Zuhören-Fortschritt. | Manuelle Prüfung im Browser; keine langen Frame-Aussetzer beim Öffnen/Auswählen. | Proposed |

### 4.3 Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | Classic-Script-Architektur: keine ES-Module. Das in der Vorlage als ES-Modul skizzierte `questFinale.js`-Muster wird auf das Projekt-Muster (`window`-Global, IIFE) übertragen. | Proposed |
| C-002 | Fließtext in Umlauten (ä/ö/ü), Code-Strings/IDs/Flags in ASCII (ae/oe/ue) — Konvention der bestehenden Daten. | Proposed |
| C-003 | Speicher-/Flag-Zugriffe laufen über die bestehenden Schnittstellen (`questSystem`-Flags, `window.SlotStorage`), nie direkt über `localStorage`. | Proposed |
| C-004 | Keine Änderung der Quest-Datenstruktur außer dem Umschalten der zwei Platzhalter-Objectives (`collusion_reveal_seen`, `three_hands_seen`) von `dialogue`-Auto-Complete auf `observe`-Trigger. Kein `STORY_VERSION`-Bump. | Proposed |
| C-005 | Phaser-/HubSceneV2-Konventionen: rekursive `scrollFactor`-Propagation für Dialog-Overlays (sonst verfehlen mobile Taps); szenenübergreifende Timestamps über `Date.now()`, nicht `scene.time.now`. | Proposed |
| C-006 | Der Objective-Trigger-Audit aus 062 bleibt grün: nach dem Umschalten auf `observe` sind `collusion_reveal_seen`/`three_hands_seen` als verdrahtete `observe`-Ziele geführt (kein uncompletable Objective). | Proposed |

## 5. Success Criteria

- **SC-001:** Ein Spieler kann jede im Skript vorgesehene `[Spieler: …]`-Entscheidung im Spiel treffen; die dokumentierten Flags werden dadurch gesetzt und sind später wirksam (Textvariante oder Finale-Regler).
- **SC-002:** Die geheime Sitzung und Elaras erster Riss sind als Szenen spielbar und schließen ihre Quests ausschließlich über die Szene ab (kein stiller Auto-Complete).
- **SC-003:** Zwei Finale-Durchläufe mit bewusst unterschiedlichen Entscheidungen zeigen sichtbar unterschiedliche Ausgänge entlang der vier Regler.
- **SC-004:** `story_ending` wird am Ende von `the_reckoning` freigeschaltet, wie zuvor.
- **SC-005:** `node tools/runTests.js` ist grün (inkl. neuer `computeFinaleState`-Tests), und das Spiel bootet fehlerfrei bis in Hub-Dialog, Szenen und Finale.

## 6. Key Entities

- **DialogChoice** — eine wählbare Spieler-Option: Anzeigetext, optionale Antwortzeile, optionale zu setzende Flags, optionale Sichtbarkeits-/Varianten-Bedingung (flag-abhängig).
- **DialogNode / DialogSequence** — eine Abfolge gesprochener Zeilen mit eingebetteten Auswahlpunkten; Quelle ist das Dialog-Skript v1.
- **SceneBeat** — ein inszenierter Moment (Zuhören-Leiste, Vatermord, Druck) mit Timing/Kamera und einem Trigger bei Abschluss.
- **FinaleState** — der von `computeFinaleState(flags)` gelieferte, serialisierbare Ausgangs-Zustand: die vier Regler-Werte plus abgeleitete Präsentations-Hinweise (anwesende Verbündete, Elara-Ausgang, benannt/namenlos).
- **StoryFlags** — der bestehende Flag-Satz (`questSystem.getFlags()`), von den Dialog-Auswahlen gesetzt und von `computeFinaleState` gelesen.

## 7. Assumptions

- Die Präsentation nutzt das **bestehende** Hub-/Quest-Dialogsystem als Wirt; die Auswahlkomponente erweitert es, ersetzt es nicht.
- Die drei Szenen werden als Dialog-/Overlay-Inszenierungen im bestehenden Szenen-/Hub-Kontext umgesetzt (Zeilen, Timing, einfache Kamera-Beats), nicht als neue vollwertige Phaser-Scene-Klassen, sofern das bestehende Muster trägt.
- Die im Skript mit `{flag}` notierten Flags sind die kanonische Quelle der Flag-Namen; wo ein Flag noch keinen Setzer hat, setzt die zuständige Dialog-Auswahl ihn.
- `who_you_were` setzt `self_remembered` (aus 062); `elara_meeting` setzt `elara_trust`; `espionage_informant` setzt `mole_evidence` (aus 062) — `computeFinaleState` liest diese.
- Parallelität: `computeFinaleState` (reine Logik) ist ohne Abhängigkeit sofort baubar; die Szenen und die Finale-Inszenierung bauen auf der Auswahlkomponente auf und werden gegen deren Kontrakt (Plan-Phase) parallel entwickelt.
