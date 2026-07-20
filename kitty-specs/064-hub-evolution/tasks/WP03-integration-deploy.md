---
work_package_id: WP03
title: Integration & Deploy
dependencies: [WP01, WP02]
requirement_refs:
- FR-004
- FR-006
- FR-007
- FR-008
- FR-009
- FR-011
- FR-012
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T009, T010, T011, T012, T013, T014]
authoritative_surface: js/scenes/HubSceneV2.js
execution_mode: code_change
lane: planned
owned_files: [js/scenes/HubSceneV2.js, js/scenes/hub/hubLayout.js, index.html]
---

# WP03 — Integration & Deploy

## Objective
Die Phasen-Schicht in den Hub einhängen: `HubPhaseView.apply` beim Aufbau aufrufen, das Verhalten je Phase verdrahten (Aldric-Quest-Sperre in `broken`, phasenabhängige NPC-Flavor, Epilog-Bürger als Vorleser) und ausliefern. Besitzt `HubSceneV2.js` + `hubLayout.js` + `index.html` **allein**.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP03 --base WP02` (integriert WP01+WP02; base auf den zuletzt gemergten Stand rebasen).

## Kontext & Quellen
- **Wirt (owned):** `js/scenes/HubSceneV2.js` — Hub-Aufbau in `create` (Hintergrund `bg` ~Z.166), NPC-Spawn + Quest-Angebot (`getAvailableQuests`, `aldricRefuses`-Muster ~Z.1072), Flavor-Pfad (`storySystem.getNpcDialogue`/`npcData.lines`). `js/scenes/hub/hubLayout.js` — NPC-Roster inkl. `buerger` + `rathaus_body`-Collider.
- **Konsumierte Kontrakte/Module:** `window.HubPhase` (WP01: `current`, `PHASE_STYLE`, `npcFlavorByPhase`, `aldricBlocksQuests`), `window.HubPhaseView.apply` (WP02).
- **Deploy-Ritual:** [[project_resume_2026_06_23]] — `?v=`-Cache-Buster; neue Module `<script>`-Tag; Logik/View VOR HubSceneV2. Boot-Check [[project_browser_verification]].

## Projekt-Konventionen
- Classic Script; Umlaute in Anzeigetexten, ASCII in Flags/IDs. `Date.now()`. scrollFactor-Falle (kapselt die View, aber eigene Overlays ebenso).

---

## Subtasks

### T009 — HubPhaseView.apply beim Hub-Aufbau
**Schritte:**
1. Am Ende des Hub-Aufbaus (nachdem `bg` erzeugt ist): `const phase = window.HubPhase && window.HubPhase.current ? window.HubPhase.current() : 'council';` dann `this._hubPhaseHandle = window.HubPhaseView && window.HubPhaseView.apply(this, phase, { bg: bg, overlayDepth: 90, rathausRect: <rathaus_body aus HUB_HITBOXES.colliders> });`.
2. Beim Verlassen/Neu-Betreten der Szene das Handle abräumen (`this._hubPhaseHandle && this._hubPhaseHandle.destroy()`), damit kein Overlay doppelt liegt.
3. Defensiv: fehlen die Module, bleibt der Hub wie bisher (kein Wurf).
**Validierung:** Boot-Check: Hub in Akt 0 neutral, in Akt 2 gekippt.

### T010 — Aldric-Quest-Sperre in `broken`
**Schritte:**
1. Die bestehende `aldricRefuses`-Bedingung (~Z.1072) erweitern: `aldricRefuses = aldricRefuses || (window.HubPhase && window.HubPhase.aldricBlocksQuests(phase));` (Phase einmal berechnen/cachen).
2. Sicherstellen, dass auch der **Quest-Indikator** ("!"/"?") für Aldric in `broken` unterdrückt wird (der Indikator-Pfad ~Z.884 liest ebenfalls `getAvailableQuests`).
**Validierung:** in `broken` bietet Aldric keine Quest an und trägt keinen Indikator.

### T011 — Phasenabhängige NPC-Flavor
**Schritte:**
1. Im Flavor-Pfad (`questMode === 'flavor'`, wo `storySystem.getNpcDialogue(npcId)`/`npcData.lines` verwendet werden): wenn `window.HubPhase.npcFlavorByPhase[phase] && [phase][npcId]` existiert, diese Zeilen statt der Standard-Flavor-Zeilen verwenden.
2. Kein Umbau des Dialogsystems; bestehende Quest-Dialoge/Auswahlen unberührt.
**Validierung:** Aldric klingt in `doubleAgent`/`broken` anders; andere NPCs unverändert, wenn kein Override.

### T012 — Epilog-Bürger als Vorleser
**Schritte:**
1. In `epilogue`: der bestehende `buerger`-NPC (hubLayout, sichtbar ab Akt 2 bei `truth_told`) erhält Epilog-Flavor (aus `npcFlavorByPhase.epilogue.buerger`) — er „liest auf dem Platz vor". Optional Position/Prominenz leicht anpassen (in hubLayout, ohne Layout-Umbau der Gebäude).
2. Kein neuer NPC.
**Validierung:** nach `story_ending` (+`truth_told`) hat der Bürger Epilog-Flavor.

### T013 — Auslieferung (index.html)
**Schritte:**
1. `<script>`-Tags für `js/hubPhase.js` und `js/hubPhaseView.js` **vor** `js/scenes/HubSceneV2.js` (nach `hubLayout.js`), je `?v=001`.
2. Cache-Buster bumpen: `HubSceneV2.js` und `hubLayout.js` (falls geändert).
**Validierung:** `index.html` referenziert die neuen Module + gebumpte Versionen.

### T014 — Boot-Check je Phase + Abnahme
**Schritte:**
1. Dev-Server `fogreach-static`; Konsole ohne Fehler.
2. Phasen forcieren (`storySystem.advanceToAct(2/4)`, `questSystem.setFlag('story_ending')`) und Hub jeweils betreten: council/doubleAgent/broken/epilogue sichtbar unterschiedlich; Globals `HubPhase`/`HubPhaseView` vorhanden.
3. `broken`: Aldric ohne Angebot/Indikator; `epilogue`: Nebel-Ton + Bürger-Flavor.
4. `node tools/runTests.js` grün; bestehende Hub-Interaktionen (andere NPC-Dialoge, Eingänge) unverändert.
**Validierung:** SC-001..005 erfüllt.

---

## Definition of Done
- Hub in council/doubleAgent/broken/epilogue sichtbar unterschiedlich; Aldric in `broken` kein Questgeber; Epilog-Bürger liest vor.
- Script-Tags + Cache-Buster gesetzt; volle Suite grün; Boot je Phase fehlerfrei; keine Regression.

## Risiken & Reviewer-Hinweise
- **Integrationspunkt-Owner:** WP03 ist der EINZIGE WP, der `HubSceneV2.js`/`hubLayout.js`/`index.html` editiert.
- **Reihenfolge der Script-Tags:** hubPhase/hubPhaseView VOR HubSceneV2, sonst `undefined`-Globals.
- **Handle-Teardown:** kein doppeltes Overlay bei Hub-Neu-Betreten.
- **Aldric-Indikator:** nicht vergessen (zwei Pfade lesen `getAvailableQuests`).

## Activity Log
- (leer bis implement)
