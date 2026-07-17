---
work_package_id: WP05
title: Integration, Finale-Inszenierung & Deploy
dependencies: [WP01, WP02, WP03, WP04]
requirement_refs:
- FR-015
- FR-016
- FR-018
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: cc6209d051e34a26c6a1cd3753ee1f04cf6532ae
created_at: '2026-07-17T22:33:37.312639+00:00'
subtasks: [T021, T022, T023, T024, T025]
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files: [js/scenes/HubSceneV2.js, index.html]
shell_pid: "34316"
agent: "claude"
---

# WP05 — Integration, Finale-Inszenierung & Deploy

## Objective
Alles zusammenführen: die `DialogChoice`-Auswahlen (WP02) mit den `storyDialog`-Daten (WP03) an die Hub-/Quest-Dialoge binden, die drei Szenen (WP04) an den richtigen Stellen aufrufen, `the_reckoning` mit `computeFinaleState` (WP01) inszenieren, und ausliefern (Script-Tags + Cache-Buster). Besitzt `HubSceneV2.js` + `index.html` **allein**.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP05 --base WP04` (integriert alle; base auf den zuletzt gemergten Stand rebasen).

## Kontext & Quellen
- **Wirt (owned):** `js/scenes/HubSceneV2.js` — `_showDialoguePages(...)` (Pages/Choices), `_showCollusionReveal` (bestehender 4-Seiten-Reveal; ggf. durch die Szene aus WP04 ersetzen/aufrufen), NPC-Dialog-Aufbau ab Zeile ~1080.
- **Konsumierte Kontrakte:** [dialog-ui-contract](../contracts/dialog-ui-contract.md) (`DialogChoice.present`/`toPage`), [finale-contract](../contracts/finale-contract.md) (`QuestFinale.computeFinaleState`).
- **Daten/Module:** `window.storyDialog` (WP03), `window.storyScenes` (WP04), `window.QuestFinale` (WP01), `window.DialogChoice` (WP02).
- **Deploy-Ritual:** [[project_resume_2026_06_23]] — `?v=`-Cache-Buster pro geänderter JS-Datei; neue Module brauchen `<script>`-Tag; Reihenfolge Logik/Daten VOR Szenen. Boot-Check [[project_browser_verification]].

## Projekt-Konventionen
- Classic Script; Umlaute in Anzeigetexten, ASCII in Flags. `Date.now()` für szenenübergreifende Zeit. scrollFactor-Falle beachten (die Komponente kapselt das, aber neue eigene Overlays ebenso).

---

## Subtasks

### T021 — DialogChoice + storyDialog in `_showDialoguePages` einhängen
**Schritte:**
1. Wo ein Quest/NPC eine `storyDialog.byQuest[<id>]`-Auswahl hat, eine Auswahl-Page über `DialogChoice.toPage(config)` einschieben bzw. an der Stelle `DialogChoice.present(this, config)` aufrufen; `onResolved` führt den Dialog fort.
2. Bestehende accept/info/decline-Choices unangetastet lassen; die neuen Spieler-Auswahlen ergänzen den Fluss.
3. `config.onResolved` sorgt für die passende Antwortzeile und ggf. das Fortsetzen zur nächsten Page.
**Validierung:** Boot-Check: ein Quest mit Auswahl (z. B. `magistrat_verification`) zeigt die Optionen; die Wahl setzt den Flag (`questSystem.getFlags()`).

### T022 — Szenen aufrufen
**Schritte:**
1. Geheime Sitzung: an der Stelle, wo bisher `_showCollusionReveal`/der Platzhalter lief, jetzt `window.storyScenes.playCollusionSession(this, onDone)` aufrufen (Quest wird über den observe-Trigger abschließbar).
2. Elaras erster Riss: an der `elara_second_truth`-Stelle `playElaraFirstCrack`.
3. Elara-Lager: an einem passenden Akt-3-Hub-Moment `playElaraCamp` (atmosphärisch, optional).
**Validierung:** Boot-Check: geheime Sitzung schließt die Quest nur über die Zuhören-Leiste.

### T023 — `the_reckoning`-Inszenierung
**Schritte:**
1. Bei `the_reckoning` (Akt 4) den Ausgang berechnen: `const st = window.QuestFinale.computeFinaleState(window.questSystem.getFlags());`.
2. Beats spielen: Elaras Nebelgriff-Zeilen (§13.4), **Vatermord** (Harren tritt dazwischen; Kamera-Shake/Fade, Timing über `Date.now()`/Tweens), dann der eine **Druck**-Beat.
3. Ausgang präsentieren: Text/Inszenierung entlang `st` (betrayalForeseen, allies, elara lives/dies, remembered/nameless). Mindestens sichtbar unterschiedliche Abschlusstexte je Regler.
4. `story_ending` bleibt über den bestehenden Quest-Reward freigeschaltet (nicht doppelt setzen).
**Validierung:** Zwei Durchläufe mit unterschiedlichen Flags → sichtbar unterschiedliche Ausgänge.

### T024 — Auslieferung (index.html)
**Schritte:**
1. `<script>`-Tags für die neuen Module ergänzen — **vor** `HubSceneV2.js`, Reihenfolge: `questFinale.js`, `dialogChoice.js`, `storyDialog.js`, `storyScenes.js` (jeweils `?v=001`).
2. Cache-Buster bumpen für geänderte Dateien: `HubSceneV2.js` und `questSystem.js` (WP04 hat es geändert — Version hochzählen).
3. Prüfen, dass keine geänderte JS-Datei den Bump vergisst.
**Validierung:** `index.html` referenziert alle neuen Module + gebumpte Versionen.

### T025 — Boot-Check + Abnahme
**Schritte:**
1. Dev-Server `fogreach-static`, Seite laden, Konsole ohne Fehler (`read_console_messages onlyErrors`).
2. Globals prüfen: `QuestFinale`, `DialogChoice`, `storyDialog`, `storyScenes`.
3. Eine Auswahl treffen (Flag gesetzt), geheime Sitzung spielen (Quest abschließbar), Finale zweimal mit verschiedenen Flags.
4. `node tools/runTests.js` grün.
**Validierung:** Boot fehlerfrei; die Success Criteria (SC-001..005) erfüllt.

---

## Definition of Done
- Spieler-Auswahlen, Szenen und Finale sind im Spiel erlebbar; zwei Finale-Durchläufe unterscheiden sich.
- `story_ending` wird wie bisher freigeschaltet; volle Suite grün; Boot fehlerfrei.
- Script-Tags + Cache-Buster gesetzt.

## Risiken & Reviewer-Hinweise
- **Integrationspunkt-Owner:** WP05 ist der EINZIGE WP, der `HubSceneV2.js` + `index.html` editiert.
- **Reihenfolge der Script-Tags:** Logik/Daten VOR HubSceneV2, sonst `undefined`-Globals beim Boot.
- **Kein Doppel-Unlock** von `story_ending` (kommt aus dem Quest-Reward).
- Reviewer prüft die zwei sichtbar unterschiedlichen Finale-Ausgänge (Kern-Erlebnis des Features).

## Activity Log
- (leer bis implement)
- 2026-07-17T22:33:38Z – claude – shell_pid=34316 – lane=doing – Started implementation via workflow command
- 2026-07-17T22:38:58Z – claude – shell_pid=34316 – lane=for_review – computeFinaleState verdrahtet, the_reckoning inszeniert (Vatermord/Druck/Ausgang), observe-Trigger fuer Collusion+Riss, Script-Tags+Cache-Buster. Boot fehlerfrei, endings_differ verifiziert.
