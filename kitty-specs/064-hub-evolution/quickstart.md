# Quickstart: Hub-Evolution

## Bauen & Testen (headless)
```
node --check js/hubPhase.js js/hubPhaseView.js js/scenes/HubSceneV2.js
node tools/runTests.js               # volle Suite; 0 Fehler
node --test tests/hubPhase.test.js
```

## Phasen-Logik isoliert prüfen
```
node -e "global.window={}; require('./js/hubPhase.js'); const H=window.HubPhase;
  console.log(H.derivePhase(0,{}), H.derivePhase(2,{}), H.derivePhase(4,{}), H.derivePhase(4,{story_ending:true}));"
# erwartet: council doubleAgent broken epilogue
```

## Browser-Boot-Check je Phase (nach [[project_browser_verification]])
1. Dev-Server `fogreach-static`, Seite laden, Konsole auf Fehler prüfen.
2. Globals: `window.HubPhase`, `window.HubPhaseView`.
3. Phase forcieren und Hub betreten — je Phase kein Konsolen-Fehler, Overlay/Tint sichtbar:
   ```
   // Akt setzen und Hub neu betreten:
   window.storySystem.advanceToAct(2)  // doubleAgent
   window.questSystem.setFlag('story_ending')  // epilogue
   ```
4. `broken`: Aldric bietet keine Quest an (kein „!"/Angebot); Rathaus feindlich markiert.
5. `epilogue`: Nebel-Ton, Bürger liest vor (wenn `truth_told`).

## Deploy-Ritual
- `<script>`-Tags für `hubPhase.js`, `hubPhaseView.js` **vor** `HubSceneV2.js`; `?v=001`.
- Cache-Buster bumpen für `HubSceneV2.js` (+ `hubLayout.js` falls geändert).
- Pages-Deploy laggt 1–4 min.

## Definition of Done (Feature)
- Hub in Akt 0–1 / ab Akt 2 / nach Bruch / Epilog sichtbar unterschiedlich.
- Aldric nach dem Bruch kein Questgeber; Rathaus feindlich.
- `node tools/runTests.js` grün inkl. `hubPhase`-Tests; Boot je Phase fehlerfrei; keine Regression bestehender Hub-Interaktionen.
