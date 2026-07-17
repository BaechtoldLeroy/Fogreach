---
work_package_id: WP01
title: Quest-Datenschicht & Register
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
- FR-010
- FR-011
- FR-012
- FR-013
- FR-014
- FR-015
- FR-016
- FR-017
- FR-018
- FR-020
- FR-022
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: b1077f954786ba393b89b5b7c9766437b8442de8
created_at: '2026-07-17T18:17:54.436438+00:00'
subtasks: [T001, T002, T003, T004, T005, T006, T007]
shell_pid: "26640"
history:
- 2026-07-17T17:13:33Z: Erstellt (spec-kitty.tasks).
authoritative_surface: js/questSystem.js
execution_mode: code_change
lane: planned
owned_files: [js/questSystem.js]
---

# WP01 — Quest-Datenschicht & Register

## Objective

Die komplette v4-Doppelagenten-Quest-Struktur in `js/questSystem.js` umsetzen: Umbenennungen, das Akt-Trigger-Register, `requiredAct`/`prerequisites` aller Quests, die sechs neuen Quests inkl. Texte, die Doppel-Tonspur, das Flag-Wiring und den versionierten Altstand-Reset. Dieses WP ist das inhaltliche Herz des Features und macht Akt 1–4 sowie das Story-Ende erreichbar (**schließt #44**).

## Branch Strategy

- Planungs-/Basis-Branch: `main`. Merge-Ziel: `main`.
- Start: `spec-kitty implement WP01` (keine Abhängigkeiten).
- Hinweis: Bei gestapelten WPs kann der reale `base_branch` später abweichen; für WP01 ist die Basis `main`.

## Kontext & Quellen (verbindlich)

- **Quest-Daten-Kontrakt:** `kitty-specs/062-story-v4-quest-backbone/contracts/quest-data-contract.md` — die maßgebliche Zuordnung aller 34 Quests (id, npcId, requiredAct, prerequisites, objective, Flags). **Diese Tabelle ist die Wahrheit.**
- **Migration mit Code-Blöcken:** `kitty-specs/062-story-v4-quest-backbone/research/Fogreach_Quest_Migration_v4.md` (Abschnitt C = exakte Quest-Blöcke, Abschnitt F = Flag-Herkunft).
- **Dialog-Skript (Texte):** `.../research/Fogreach_Dialog_Skript_v1.md` — die Angebots-/Unterwegs-/Abschlusstexte je Quest.
- **Datenmodell:** `.../data-model.md`.

## Projekt-Konventionen (Pflicht)

- **Classic-Script:** kein `import`/`export`; `questSystem.js` ist ein IIFE, das `window.questSystem` setzt. Keine Modul-Syntax.
- **Objective-Feld heißt `required`/`current`** (bestehende Konvention), NICHT `count` (Migration-Notation). Beim Übertragen der Code-Blöcke aus Abschnitt C umsetzen: `{ type, target, current: 0, required: N }`.
- **Code-Strings ASCII** (ae/oe/ue), Fließtext in den Dialog-Strings mit Umlauten. Bestehende Datei als Vorbild.
- **Reward-Felder:** `factionStanding` und `fragments` (NICHT `reputation`/`knowledgeFragments` aus der Migration — die auf diese bestehenden Felder abbilden).
- **npcId aus dem Code:** `klerus_priester` und `stadtwache` (NICHT `klerus`/`garde` aus den Migration-C-Blöcken) — sonst wird die Quest vom falschen NPC angeboten (FR-022).
- **Objective-Trigger (Analyse-Befund, Option B):** szenengebundene Reveals bleiben `dialogue` (Auto-Complete), damit die Akt-Leiter erreichbar ist — konkret `council_collusion_reveal` (`dialogue collusion_reveal_seen`) und `elara_second_truth` (`dialogue three_hands_seen`). Die Migration will hier `observe`; das NICHT übernehmen, solange die Szene fehlt (würde Akt 2 unerreichbar machen). Die gameplay-`fetch`/`observe`-Ziele (verification_seal/proclamation/memory_shard/escort_route/informant_id) verdrahtet **WP05** — WP01 setzt nur die Objective-Daten gemäß Kontrakt.

---

## Subtasks

### T001 — Umbenennungen & Entfernung
**Zweck:** Die drei ID-Änderungen sauber durchziehen, ohne Boss-Ziele zu verlieren.
**Schritte:**
1. `ritual_chamber` → `verseuchte_kammer` (bleibt Akt-3-Quest, Aldric; behält `explore room`-Objective; bekommt in T005 die Doppel-Tonspur). Kommentar aktualisieren.
2. `harren_rescue` → `schattenrat_finale` (Akt 4, npcId `harren`; Objective bleibt `boss_kill` mit target `schattenrat`). **Das Boss-Ziel `schattenrat` darf nicht verloren gehen.**
3. `final_truth` komplett entfernen.
4. Datei nach den alten IDs durchsuchen (auch in `advanceAct`-Logik, Kommentaren) und jede Referenz nachziehen.
**Validierung:** Kein Vorkommen von `ritual_chamber`, `harren_rescue`, `final_truth` mehr in `questSystem.js`; `verseuchte_kammer` und `schattenrat_finale` existieren.

### T002 — Akt-Register / Trigger
**Zweck:** Genau vier `advanceAct`-Trigger etablieren, Trigger verschieben.
**Schritte:**
1. `advanceAct` NUR auf: `harren_daughter_investigation` (1), `council_collusion_reveal` (2), `mara_warning` (3), `bruch_confrontation` (4). (Der harte `advanceToAct(2)`-Sprung für `council_collusion_reveal` bleibt zusätzlich bestehen.)
2. `mara_warning`: `advanceAct: 3` ergänzen (war reine Boss-Quest); `requiredAct: 2`.
3. `bruch_confrontation`: `advanceAct` von 3 → 4 ändern; `requiredAct: 3`.
4. `elara_second_truth`: falls vorhanden mit `advanceAct` — entfernen (kein Trigger).
5. Jegliche alten `actN_open`-Unlock-Flags/Trigger, die nicht mehr gebraucht werden, entfernen.
**Validierung:** Exakt vier Quests tragen `advanceAct`; die vier Zielwerte stimmen mit dem Kontrakt.

### T003 — requiredAct + prerequisites (bestehende Quests)
**Zweck:** Die Doppelspiel-Verteilung über Akt 2/3 herstellen.
**Schritte:** Für jede bestehende Quest `requiredAct` und `prerequisites` exakt nach Kontrakt setzen. Besonders:
- `council_collusion_reveal.prerequisites` = die vier Fraktions-Quests.
- `espionage_informant`: `npcId: 'mara'`, `requiredAct: 3`, Objective `observe informant_id`, setzt `mole_evidence` (Flag in T006).
- `thom_truth`: `requiredAct: 3`.
- `verseuchte_kammer`: `requiredAct: 3`, `prerequisites: ['council_surveillance']`.
- `mara_warning`: `prerequisites: ['mara_contact', 'espionage_convoy']`.
- `bruch_confrontation`: `prerequisites: ['verseuchte_kammer', 'elara_second_truth']`, `minDepth: 8`.
**Validierung:** Stichprobe gegen Kontrakt-Tabelle; keine Quest verweist auf eine entfernte ID.

### T004 — Sechs neue Quests inkl. Texte
**Zweck:** Die fehlenden Quests anlegen.
**Schritte:** Anlegen gemäß Kontrakt + Migration-C-Blöcken + Dialog-Skript-Texten:
1. `faction_campaign` (A1, Aldric, optional; `fetch proclamation ×3`; Wahl → `factionStanding`).
2. `klerus_district_purge` (A2, `klerus_priester`; `kill enemy ×8`; Doppel-Tonspur im Abschluss).
3. `garde_night_escort` (A3, `stadtwache`; `observe escort_route ×1`; Doppel-Tonspur).
4. `who_you_were` (A3, Branka, optional; `fetch memory_shard ×3`, `minDepth: 5`; setzt `self_remembered`).
5. `elara_second_truth` (A3, Elara; **`dialogue three_hands_seen ×1`** — Auto-Complete-Platzhalter, Szene folgt; KEIN `advanceAct`; `prerequisites: ['thom_truth','elara_ritual']`).
6. `the_reckoning` (A4, Thom; `dialogue press_decision ×1`; `prerequisites: ['schattenrat_finale']`; `unlocks: ['story_ending']`).
**Texte:** Angebots-/Unterwegs-/Abschlusstext je Quest aus dem Dialog-Skript übernehmen (Umlaute im Fließtext ok). ASCII nur für IDs/Targets/Flags.
**Validierung:** Sechs neue Einträge existieren mit vollständigen Feldern; `the_reckoning` trägt `unlocks: ['story_ending']`.

### T005 — Doppel-Tonspur
**Zweck:** Die zweite (Doppelagenten-)Stimme im Abschlusstext.
**Schritte:** Abschlusstext von `council_seizure`, `council_surveillance`, `verseuchte_kammer` um die zweite Tonspur ergänzen (Klammer-Halbsatz „… an Mara …" gemäß Migration C7 / Dialog-Skript). Die neuen Tarnaufträge (T004) tragen sie bereits.
**Validierung:** Die drei Abschlusstexte enthalten den Doppel-Halbsatz.

### T006 — Flag-Wiring + getFlags() + Reward-Abgleich
**Zweck:** Story-Flags über den bestehenden Speicher setzen (KEIN neues `questFlags.js`).
**Schritte:**
1. In den zuständigen Quests bei Abschluss `setFlag(...)` aufrufen bzw. die Flag-Wahl abbilden: `verification_sealed`/`verification_refused` (`magistrat_verification`), `petitions_kept`/`petitions_surrendered` (`council_seizure`), `convoy_blade_drawn` (`espionage_convoy`), `elara_trust` (`elara_meeting`), `mole_evidence` (`espionage_informant`), `self_remembered` (`who_you_were`).
2. `getFlags()` (oder `listFlags()`) als Lesehilfe ergänzen und in `window.questSystem` exportieren (für das spätere Finale-Feature).
3. Reward-Feldnamen prüfen: falls in übernommenen Blöcken `reputation`/`knowledgeFragments` stehen, auf `factionStanding`/`fragments` ändern.
**Validierung:** Nach Abschluss der jeweiligen Quest liefert `hasFlag(name)` true; `getFlags()` ist exportiert.

### T007 — storyVersion + Reset
**Zweck:** Alte Story-Stände beim Laden sauber zurücksetzen.
**Schritte:**
1. Konstante `STORY_VERSION` (Integer, v4-Wert, z. B. `4`) im Modul.
2. `getQuestSaveData()` schreibt `storyVersion: STORY_VERSION` mit in den Blob.
3. `loadQuestSaveData(data)`: wenn `data.storyVersion` fehlt ODER `< STORY_VERSION` → Quest-State + Flags NICHT übernehmen, sondern `_initQuestState()` (frisch, Akt 0) und Flags leeren. Zusätzlich den Story-Akt auf 0 setzen (über `window.storySystem.advanceToAct(0)` bzw. den in WP02 bereitgestellten Reset — defensiv, falls storySystem noch nicht geladen).
4. Unbekannte alte Quest-IDs weiterhin ohne Fehler ignorieren (bestehendes Verhalten beibehalten).
**Validierung:** Save mit v4 lädt normal; Save ohne `storyVersion` → Akt 0, leere Flags.

---

## Definition of Done

- Alle sieben Subtasks umgesetzt, `js/questSystem.js` lädt fehlerfrei (`node --check`).
- 34 Quests, keine doppelten IDs/Titel; genau vier `advanceAct`-Trigger; die vier Zuordnungen stimmen mit dem Kontrakt.
- `the_reckoning` schaltet `story_ending`; `elara_second_truth` ohne Trigger.
- Flags werden über den bestehenden Speicher gesetzt; `getFlags()` exportiert.
- `storyVersion`+Reset umgesetzt.
- (Tests, Doku, Cache-Buster liegen in WP03/WP04.)

## Risiken & Reviewer-Hinweise

- **Objective-Feldname:** häufigster Fehler — `count` statt `required`. Reviewer prüft, dass Objectives zählen.
- **Boss-Ziel bei Umbenennung:** `schattenrat_finale` muss `boss_kill schattenrat` behalten.
- **Keine Doppel-Speicher:** ausschließlich der bestehende `questFlags`-Store; kein neues Modul.
- **Reward-Felder:** `factionStanding`/`fragments`, nicht `reputation`/`knowledgeFragments`.
- **npcId:** `klerus_priester`/`stadtwache` (nicht `klerus`/`garde`).
- **Objective-Typen:** `council_collusion_reveal` und `elara_second_truth` bleiben `dialogue` (nicht `observe`), sonst wird Akt 2 unerreichbar bzw. der Reveal uncompletable. Die gameplay-Ziele verdrahtet WP05.
- Reviewer gleicht die geänderten Definitionen stichprobenartig gegen `contracts/quest-data-contract.md` ab.
