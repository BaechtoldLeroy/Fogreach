# Quickstart — Verifikation des Quest-Rückgrats

So wird das umgesetzte Feature geprüft. Reihenfolge entspricht der Akzeptanz aus der Spec.

## 1. Test-Suite

```
node tools/runTests.js
```
Erwartung: 0 Fehler (NFR-001). Neue/angepasste Tests in `tests/questSystem.test.js`:
- vier Akt-Trigger einzeln (Abschluss X → Akt N),
- „genau vier `advanceAct`-Trigger"-Invariante,
- `the_reckoning` → `story_ending`,
- `elara_second_truth` setzt keinen `advanceAct`,
- Altstand-Reset (Fixture ohne `storyVersion` → Akt 0, Charakter-State bleibt),
- Boss-Leiter-Ziele (kettenmeister/zeremonienmeister/schattenrat) nach den Umbenennungen.

## 2. Doku-Generator

```
node tools/genQuestDoc.js
```
Erwartung: `docs/QUESTS.md` bildet die v4-Struktur ab; die Akt-Register-Tabelle zeigt für Akt 1–4 je einen Trigger (kein „kein Trigger — nicht erreichbar" mehr für 1–4). (SC-005)

## 3. Durchlauf der Akt-Leiter (manuell / Browser)

Neuer Spielstand → Akt 0. Prüfen, dass:
- Abschluss `harren_daughter_investigation` → Akt 1,
- die vier Fraktions-Quests sind Vorbedingung für `council_collusion_reveal`,
- `council_collusion_reveal` → Akt 2, Rats-Quests danach weiter annehmbar (Doppelspiel),
- `mara_warning` (Kettenmeister) → Akt 3,
- `bruch_confrontation` → Akt 4,
- `the_reckoning` → `story_ending` gesetzt.

Boot-Konsole fehlerfrei (NFR-004). Browser-Rezept wie in den Projekt-Notizen (http-server via launch.json, Loop pumpen bei hidden-Tab).

## 4. Altstand-Reset

Alten Save (ohne `storyVersion`, mit alten IDs wie `ritual_chamber`/`final_truth`) laden. Erwartung:
- Story/Quests auf Akt 0 zurückgesetzt, keine Konsolen-Fehler (FR-016/017),
- Level/Inventar/Gold/Skillbaum unverändert.

## 5. Deploy-Ritual

- `?v=`-Cache-Buster für jede geänderte JS-Datei in `index.html` bumpen (NFR-005),
- committen/pushen (Pages-Deploy laggt 1–4 min),
- #44 im Issue-Tracker schließen (SC-007).

## Definition of Done

Alle Success Criteria SC-001…SC-007 erfüllt; Test-Suite grün; `docs/QUESTS.md` regeneriert; #44 geschlossen.
