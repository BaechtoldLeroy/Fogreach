# Tasks: Story v4 — Inszenierung

**Feature:** 063-story-v4-inszenierung · **Branch:** main → main
**Design:** [spec.md](spec.md) · [plan.md](plan.md) · [contracts/dialog-ui-contract.md](contracts/dialog-ui-contract.md) · [contracts/finale-contract.md](contracts/finale-contract.md)

5 Work Packages, 25 Subtasks. Auf **maximale Parallelität** geschnitten: WP01/WP02/WP03 starten sofort, WP04 nach WP02, WP05 (Integration) zuletzt. Nicht-überlappende owned_files; `js/questSystem.js` gehört allein WP04, `index.html`/`HubSceneV2.js` allein WP05.

## Parallelität & Abhängigkeiten

```
WP01 Finale-Logik      [P] ─────────────────────────────┐
WP02 Dialog-UI-Komp.   [P] ──┬── WP04 Schluesselszenen ──┤
WP03 Dialog-Content    [P]   │                            ├── WP05 Integration+Finale+Deploy
                             └────────────────────────────┘
```
- Dependencies: WP03 — (keine, Kontrakt-getrieben) · WP04 — WP02 · WP05 — WP01, WP02, WP03, WP04

---

## WP01 — Finale-Logik (`computeFinaleState`)
**Ziel:** Reines Modul `js/questFinale.js` gemäß [finale-contract](contracts/finale-contract.md). **Priorität:** hoch (MVP-Kern). **Dependencies:** none.
**Independent test:** `node --test tests/questFinale.test.js` grün; alle vier Regler + Default abgedeckt.
- [x] T001 `js/questFinale.js` Skeleton (`window.QuestFinale` IIFE, Classic Script)
- [x] T002 `computeFinaleState`: Regler 1 (betrayalForeseen) + Regler 4 (remembered) + Default-Robustheit
- [x] T003 `computeFinaleState`: Regler 2 (allies branka/mara/thom)
- [x] T004 `computeFinaleState`: Regler 3 (elara lives/dies) + abgeleitete Felder (aloneAtEnd, namelessEnding)
- [x] T005 `tests/questFinale.test.js`: pro Regler true/false, Elara-Kombinatorik, Default, Reinheit
**Prompt:** [tasks/WP01-finale-logik.md](tasks/WP01-finale-logik.md) (~300 lines)

## WP02 — Dialog-Auswahl-Komponente (`DialogChoice`)
**Ziel:** Wiederverwendbare Komponente `js/dialogChoice.js` gemäß [dialog-ui-contract](contracts/dialog-ui-contract.md). **Priorität:** hoch (Fundament). **Dependencies:** none.
**Independent test:** `node --test tests/dialogChoice.test.js` grün (reine `resolve`-Logik); Boot-Check zeigt `window.DialogChoice`.
- [x] T006 `js/dialogChoice.js` Skeleton + reine `resolve(config, flags)` (showIf-Filter, Flag-Sammlung, Ergebnis)
- [x] T007 `present(scene, config)`: Phaser-Rendering im Panel-/Button-Stil, rekursives `scrollFactor(0)`
- [x] T008 Flag-Anbindung: lazy `_setFlag` (nutzt `window.questSystem.setFlag` zur Laufzeit) + `getFlags`-Lesen
- [x] T009 `toPage(config)`-Adapter für die spätere `_showDialoguePages`-Einbindung
- [x] T010 `tests/dialogChoice.test.js`: showIf-Filter, setFlags-Sammlung, flag-abhängige Varianten (headless, Setter injiziert)
**Prompt:** [tasks/WP02-dialog-ui-komponente.md](tasks/WP02-dialog-ui-komponente.md) (~330 lines)

## WP03 — Dialog-Content-Pass (`storyDialog`)
**Ziel:** Datenbank aller `[Spieler: …]`-Auswahlen aus dem Skript über Akt 0–4 in `js/storyDialog.js`, gemäß Kontrakt-Datenformen. **Priorität:** mittel. **Dependencies:** none (Kontrakt-getrieben, reine Daten).
**Independent test:** `node --check js/storyDialog.js`; ein DOM-freier Struktur-Check (jede Choice hat `label`; alle finale-relevanten Flags haben einen Setzer).
- [ ] T011 `js/storyDialog.js` Struktur + Akt 0/1 (inkl. `verification_sealed`/`verification_refused`, faction_campaign)
- [ ] T012 Akt 2 (inkl. `petitions_surrendered`/`petitions_kept`, `branka_ally`, klerus/mara/espionage)
- [ ] T013 Akt 3 (inkl. `thom_ally`, elara/verseuchte_kammer/garde/who_you_were)
- [ ] T014 Akt 4 (branka_weapons, thom_pamphlets, the_reckoning press_decision, mara_assault)
- [ ] T015 Abgleich gegen [finale-contract](contracts/finale-contract.md): jeder gelesene Flag hat genau einen Setzer im Content
**Prompt:** [tasks/WP03-dialog-content.md](tasks/WP03-dialog-content.md) (~340 lines)

## WP04 — Schlüsselszenen + observe-Trigger
**Ziel:** `js/storyScenes.js` (drei Szenen) + observe-Flip in `js/questSystem.js`; 062-Trigger-Audit-Test nachziehen. **Priorität:** mittel. **Dependencies:** WP02.
**Independent test:** Boot-Check: geheime Sitzung schließt `council_collusion_reveal` nur über die Zuhören-Leiste; `node tools/runTests.js` grün (Audit-Test angepasst).
- [ ] T016 `js/storyScenes.js` Skeleton + Geheime Sitzung mit „Zuhören"-Fortschrittsleiste → `observe collusion_reveal_seen`
- [ ] T017 observe-Flip in `js/questSystem.js`: `collusion_reveal_seen`/`three_hands_seen` von `dialogue` → `observe`; `tests/questSystem.test.js` (T019-Audit) nachziehen + `questSystem.setFlag(name)` Public-Setter ergänzen
- [ ] T018 Szene „Elaras erster Riss" → `observe three_hands_seen`
- [ ] T019 Szene „Elara-Lager" (§13.2), atmosphärisch, kein Trigger
- [ ] T020 Verdrahtung der Szenen-Auslöser als aufrufbare Einstiegspunkte (von WP05 im Hub gerufen)
**Prompt:** [tasks/WP04-schluesselszenen.md](tasks/WP04-schluesselszenen.md) (~360 lines)

## WP05 — Integration, Finale-Inszenierung & Deploy
**Ziel:** `js/scenes/HubSceneV2.js` + `index.html`: DialogChoice/Content einhängen, Szenen aufrufen, `the_reckoning` inszenieren (Vatermord + Druck + Ausgang aus `computeFinaleState`), Script-Tags + Cache-Buster. **Priorität:** hoch (schließt ab). **Dependencies:** WP01, WP02, WP03, WP04.
**Independent test:** Zwei Finale-Durchläufe mit unterschiedlichen Flags zeigen unterschiedliche Ausgänge; Boot fehlerfrei; volle Suite grün.
- [ ] T021 DialogChoice in `_showDialoguePages` einhängen; `storyDialog`-Auswahlen an Quest-/Hub-Dialoge binden
- [ ] T022 Die drei Szenen aus `storyScenes` an den passenden Hub-Triggern aufrufen
- [ ] T023 `the_reckoning`-Inszenierung: `QuestFinale.computeFinaleState(questSystem.getFlags())`, Vatermord- + Druck-Beat, Ausgangs-Präsentation; `story_ending` bleibt freigeschaltet
- [ ] T024 `index.html`: `<script>`-Tags (questFinale/dialogChoice/storyDialog/storyScenes VOR HubSceneV2) + Cache-Buster für `HubSceneV2.js` bumpen
- [ ] T025 Browser-Boot-Check + zwei Finale-Durchläufe (unterschiedliche Flags → unterschiedliche Ausgänge); volle Suite grün
**Prompt:** [tasks/WP05-integration-finale-deploy.md](tasks/WP05-integration-finale-deploy.md) (~380 lines)

---

## Dependencies (für finalize-tasks)
- WP01 Dependencies: none
- WP02 Dependencies: none
- WP03 Dependencies: none
- WP04 Dependencies: WP02
- WP05 Dependencies: WP01, WP02, WP03, WP04

## MVP-Empfehlung
WP01 + WP02 bilden den testbaren Kern (reine Logik + Fundament-Komponente). WP05 macht das Feature spielbar-sichtbar.
