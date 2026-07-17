# Tasks — Story v4 Quest-Rückgrat

**Feature:** `062-story-v4-quest-backbone` · **Branch:** `main` → `main`
**Quellen:** [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contracts/quest-data-contract.md](contracts/quest-data-contract.md), [research.md](research.md), [quickstart.md](quickstart.md).

## Zerlegungs-Prinzip

Das Feature ist stark auf `js/questSystem.js` konzentriert. Da sich Work-Packages **keine Dateien teilen dürfen** (Ownership-Regel), verläuft der Schnitt entlang der **Datei-Grenzen**, nicht der Quest-Gruppen:

- **WP01** besitzt `js/questSystem.js` (die gesamte Quest-Datenschicht + Flags + Reset) — das inhaltliche Herz.
- **WP02** besitzt `js/storySystem.js` (Akt-Namen + Reset-Kopplung).
- **WP03** besitzt `tests/questSystem.test.js` (Verifikation).
- **WP04** besitzt `tools/genQuestDoc.js`, `docs/QUESTS.md`, `index.html` (Doku + Deploy).

`js/player.js` (Boss-Mapping) wird nur **geprüft**, nicht geändert (die Boss-IDs bleiben; nur Quest-IDs werden umbenannt) — die Prüfung liegt als Test in WP03.

## Reihenfolge & Abhängigkeiten

```
WP01 (questSystem.js) ─┐
WP02 (storySystem.js) ─┼─→ WP03 (Tests)
                       └─→ WP04 (Doku/Deploy)
```

WP01 und WP02 sind parallelisierbar (verschiedene Dateien, stabile `advanceToAct`-API-Grenze). WP03 und WP04 hängen an beiden.

---

## WP01 — Quest-Datenschicht & Register
**Prompt:** [tasks/WP01-quest-data-register.md](tasks/WP01-quest-data-register.md) · **Priorität:** P1 (MVP) · **Größe:** ~7 Subtasks
**Ziel:** Die komplette v4-Quest-Struktur in `js/questSystem.js` — Umbenennungen, Akt-Register/Trigger, `requiredAct`/`prerequisites`, sechs neue Quests inkl. Texte, Doppel-Tonspur, Flag-Wiring, `storyVersion`+Reset.
**Unabhängiger Test:** Ein Skript, das `QUEST_DEFINITIONS` lädt, bestätigt: 34 Quests, genau vier `advanceAct`-Trigger, die vier Trigger-Zuordnungen, keine doppelten IDs/Titel.

- [ ] T001 Umbenennungen/Entfernung: `ritual_chamber`→`verseuchte_kammer`, `harren_rescue`→`schattenrat_finale`, `final_truth` entfernen (Boss-Objective `schattenrat` erhalten).
- [ ] T002 Akt-Register/Trigger: `advanceAct` auf genau vier Quests; `mara_warning`→3, `bruch_confrontation`→4, `elara_second_truth` OHNE; alte `actN_open`/Trigger raus.
- [ ] T003 `requiredAct` + `prerequisites` aller bestehenden Quests gemäß Kontrakt (Doppelspiel-Verteilung Akt 2/3).
- [ ] T004 Sechs neue Quests inkl. Angebots-/Unterwegs-/Abschlusstext: `faction_campaign`, `klerus_district_purge`, `garde_night_escort`, `who_you_were`, `elara_second_truth`, `the_reckoning`.
- [ ] T005 Doppel-Tonspur im Abschlusstext von `council_seizure`, `council_surveillance`, `verseuchte_kammer`.
- [ ] T006 Flag-Wiring (`setFlag` in den zuständigen Quests) + `getFlags()`-Ergänzung + Reward-Feld-Abgleich (`reputation`/`knowledgeFragments` → `factionStanding`/`fragments`).
- [ ] T007 `STORY_VERSION` + version-gated Reset in `getQuestSaveData`/`loadQuestSaveData`.

## WP02 — Story-Akte & Reset-Kopplung
**Prompt:** [tasks/WP02-story-acts-reset.md](tasks/WP02-story-acts-reset.md) · **Priorität:** P1 · **Größe:** ~3 Subtasks
**Ziel:** `js/storySystem.js` auf die v4-Akt-Namen (Index 0–4) setzen und den Reset-auf-Akt-0-Pfad bereitstellen, den WP01 beim `storyVersion`-Reset nutzt.
**Unabhängiger Test:** `STORY_ACTS[0..4]` tragen die v4-Namen; `advanceToAct(0)` setzt den Akt-Index auf 0; keine Referenz auf Index 5/6.

- [ ] T008 `STORY_ACTS` v4-Namen (0 Der Dienst, 1 Treuer Diener, 2 Das Doppelspiel, 3 Die Enttarnung, 4 Der Verrat und die Presse).
- [ ] T009 Reset-Pfad: sicherstellen, dass `advanceToAct(0)` (bzw. ein Reset-Helfer) den Akt vollständig auf 0 bringt und von WP01 aufrufbar ist.
- [ ] T010 Alte Index-5/6-Referenzen bereinigen (`_computeActIndex`, triggerWave/triggerQuests-Altdaten), damit nichts auf entfernte Akte zeigt.

## WP03 — Tests
**Prompt:** [tasks/WP03-tests.md](tasks/WP03-tests.md) · **Priorität:** P1 · **Größe:** ~5 Subtasks
**Dependencies:** WP01, WP02
**Ziel:** `tests/questSystem.test.js` deckt die Akt-Leiter, die „genau vier Trigger"-Invariante, den Ende-Trigger, den Altstand-Reset und die Boss-Ziele ab; bestehende Tests angepasst.
**Unabhängiger Test:** `node tools/runTests.js` grün, inkl. der neuen Fälle.

- [ ] T011 Akt-Trigger-Tests: vier einzeln (Abschluss X → Akt N) + „genau vier `advanceAct`-Trigger"-Invariante (bis Akt 4).
- [ ] T012 `the_reckoning` → `story_ending` gesetzt; `elara_second_truth` setzt keinen `advanceAct`.
- [ ] T013 Altstand-Reset: Fixture ohne `storyVersion` (mit alten IDs) → Akt 0, Story-Flags leer; Charakter-State-Feld (außerhalb `quests`) bleibt unberührt.
- [ ] T014 Boss-Leiter-Ziele nach Umbenennung (`mara_warning`→kettenmeister, `elara_ritual`→zeremonienmeister, `schattenrat_finale`→schattenrat); bestehende umbenennungs-/entfernungs-abhängige Tests anpassen.
- [ ] T015 Struktur-Invarianten: 34 Quests, keine doppelten `id`/`title`; Stichproben `requiredAct`/`prerequisites` gemäß Kontrakt.

## WP04 — Doku, Boss-Mapping-Verifikation & Deploy
**Prompt:** [tasks/WP04-docs-deploy.md](tasks/WP04-docs-deploy.md) · **Priorität:** P2 · **Größe:** ~3 Subtasks
**Dependencies:** WP01, WP02
**Ziel:** `tools/genQuestDoc.js` an die v4-Aktnamen anpassen, `docs/QUESTS.md` regenerieren, Cache-Buster in `index.html` bumpen.
**Unabhängiger Test:** `docs/QUESTS.md` zeigt für Akt 1–4 je einen Trigger (kein „kein Trigger" mehr); `index.html` referenziert die neuen `?v=`-Versionen.

- [ ] T016 `genQuestDoc.js`: `ACTS`-Array auf die v4-Namen; Generator läuft fehlerfrei durch.
- [ ] T017 `docs/QUESTS.md` regenerieren; Akt-Register lückenlos für 1–4.
- [ ] T018 Cache-Buster in `index.html` für alle geänderten JS-Dateien bumpen (`questSystem.js`, `storySystem.js`).

---

## MVP-Empfehlung

**WP01 + WP02** liefern das erreichbare Akt-Gerüst (schließt #44 funktional). **WP03** sichert es ab, **WP04** macht es sichtbar/deploybar. Alle vier gehören zum Abschluss dieses Features.
