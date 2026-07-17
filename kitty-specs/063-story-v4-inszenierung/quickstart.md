# Quickstart: Story v4 — Inszenierung

## Bauen & Testen (headless)
```
node --check js/questFinale.js js/dialogChoice.js js/storyDialog.js js/storyScenes.js
node tools/runTests.js          # volle Suite; muss 0 Fehler zeigen
node --test tests/questFinale.test.js tests/dialogChoice.test.js
```

## Finale-Logik isoliert prüfen
```
node -e "global.window={}; require('./js/questFinale.js');
  console.log(JSON.stringify(window.QuestFinale.computeFinaleState({elara_trust:true, mole_evidence:true, self_remembered:true, petitions_kept:true})));"
# erwartet: betrayalForeseen true, elara 'lives', remembered true, mara true
```

## Browser-Boot-Check (nach [[project_browser_verification]])
1. Dev-Server: `fogreach-static` (launch.json, http-server :8123).
2. Seite laden, Konsole auf Fehler prüfen (`read_console_messages onlyErrors`).
3. Prüfen, dass die neuen Globals da sind:
   `window.QuestFinale`, `window.DialogChoice`, `window.storyDialog`/`window.storyScenes`.
4. Hub betreten, einen Quest-Dialog mit `[Spieler: …]`-Wahl öffnen, Wahl treffen → Flag gesetzt (via `window.questSystem.getFlags()` in der Konsole).
5. Geheime Sitzung: Zuhören-Leiste abschließen → `council_collusion_reveal` wird abschließbar.

## Deploy-Ritual
- Für jede geänderte JS-Datei den `?v=`-Cache-Buster in `index.html` bumpen.
- Neue Module (`questFinale.js`, `dialogChoice.js`, `storyDialog.js`, `storyScenes.js`) bekommen je einen `<script>`-Tag mit `?v=001` — Reihenfolge: Logik/Daten VOR HubSceneV2.
- Nach Push: Pages-Deploy laggt 1–4 min.

## Definition of Done (Feature)
- `node tools/runTests.js` grün inkl. neuer Tests.
- Zwei Finale-Durchläufe mit unterschiedlichen Flags zeigen unterschiedliche Ausgänge.
- Geheime Sitzung & Elaras erster Riss schließen ihre Quests nur über die Szene (kein Auto-Complete).
- Boot fehlerfrei; Cache-Buster/Script-Tags gesetzt.
