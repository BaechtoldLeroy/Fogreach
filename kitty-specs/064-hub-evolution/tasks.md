# Tasks: Hub-Evolution über die Akte

**Feature:** 064-hub-evolution · **Branch:** main → main · **Issue:** [#67](https://github.com/BaechtoldLeroy/Fogreach/issues/67)
**Design:** [spec.md](spec.md) · [plan.md](plan.md) · [contracts/hub-phase-contract.md](contracts/hub-phase-contract.md) · [contracts/hub-phase-view-contract.md](contracts/hub-phase-view-contract.md)

3 Work Packages, 14 Subtasks. Fundament (reine Logik) + View (Rendering-Modul) bauen parallel gegen die zwei Kontrakte; Integration führt in HubSceneV2 zusammen. Nicht-überlappende owned_files; `HubSceneV2.js`/`hubLayout.js`/`index.html` gehören allein WP03.

## Parallelität & Abhängigkeiten
```
WP01 Fundament (hubPhase.js) [P] ──┐
WP02 View (hubPhaseView.js)  [P] ──┴── WP03 Integration (HubSceneV2 + hubLayout + index.html)
```
- Dependencies: WP01 — keine · WP02 — WP01 · WP03 — WP01, WP02

---

## WP01 — Fundament: Phasen-Logik (`hubPhase.js`)
**Ziel:** Reines Modul gemäß [hub-phase-contract](contracts/hub-phase-contract.md). **Priorität:** hoch (MVP-Kern). **Dependencies:** none.
**Independent test:** `node --test tests/hubPhase.test.js` grün; alle Phasen + Priorität + Default.
- [x] T001 `js/hubPhase.js` Skeleton + `derivePhase(actIndex, flags)` (Priorität epilogue>broken>doubleAgent>council, Default council, kein Mutieren)
- [x] T002 `PHASE_STYLE` (4 Phasen, Felder tint/desaturate/fog/posters/assetKey/rathausHostile)
- [x] T003 `npcFlavorByPhase` + `aldricBlocksQuests(phase)` + `current()`-Wrapper (liest Globals)
- [x] T004 `tests/hubPhase.test.js`: alle Phasen, Priorität, Default/Robustheit, `aldricBlocksQuests`, PHASE_STYLE-Vollständigkeit
**Prompt:** [tasks/WP01-fundament-phasen-logik.md](tasks/WP01-fundament-phasen-logik.md) (~260 lines)

## WP02 — View: Phasen-Darstellung (`hubPhaseView.js`)
**Ziel:** `window.HubPhaseView.apply(scene, phase, refs)` gemäß [hub-phase-view-contract](contracts/hub-phase-view-contract.md). **Priorität:** hoch. **Dependencies:** WP01.
**Independent test:** `node --check js/hubPhaseView.js`; Boot-Check (WP03) zeigt Overlay/Tint je Phase; idempotent.
- [ ] T005 `js/hubPhaseView.js` Skeleton + `apply`-Struktur (Style aus HubPhase.PHASE_STYLE), Handle mit `destroy()`, Idempotenz (Teardown vor Neu-Anwendung)
- [ ] T006 Tint/Entsättigung auf `bg` + Nebel-Overlay (fog-Alpha), rekursives `scrollFactor(0)`
- [ ] T007 Anschlagtafeln-Zustand (`posters` faded/torn/gone) + `rathausHostile`-Markierung (`refs.rathausRect`)
- [ ] T008 Asset-Austauschpunkt: `assetKey` → `scene.textures.exists` → Textur nutzen, sonst code-gezeichneter Fallback; defensive Guards (fehlt HubPhase/bg → no-op)
**Prompt:** [tasks/WP02-view-phasen-darstellung.md](tasks/WP02-view-phasen-darstellung.md) (~300 lines)

## WP03 — Integration & Deploy (HubSceneV2 + hubLayout + index.html)
**Ziel:** Phase beim Hub-Aufbau anwenden, Verhalten (Aldric-Sperre/Flavor/Epilog-Bürger) verdrahten, ausliefern. **Priorität:** hoch (schließt ab). **Dependencies:** WP01, WP02.
**Independent test:** Boot-Check je Phase (Akt forcieren) ohne Fehler; Aldric bietet in `broken` keine Quest; volle Suite grün.
- [ ] T009 `HubPhaseView.apply` beim Hub-Aufbau aufrufen (Phase via `HubPhase.current()`; refs: `bg`, `overlayDepth`, `rathaus_body`-Rect); Handle bei Szenen-Verlassen/Neu-Betreten abräumen
- [ ] T010 Aldric-Quest-Sperre in `broken`: bestehende `aldricRefuses`-Bedingung (~Z.1072) um `HubPhase.aldricBlocksQuests(phase)` erweitern; Quest-Indikator ebenfalls unterdrücken
- [ ] T011 Phasenabhängige NPC-Flavor: `HubPhase.npcFlavorByPhase[phase][npcId]` im Flavor-Pfad überschreiben (sonst unverändert)
- [ ] T012 Epilog-Bürger als Vorleser: im `epilogue` den bestehenden `buerger`-NPC (hubLayout) via Flavor-Override/Prominenz einsetzen (bei `truth_told`)
- [ ] T013 `index.html`: `<script>`-Tags `hubPhase.js`/`hubPhaseView.js` VOR `HubSceneV2.js`; Cache-Buster für `HubSceneV2.js` (+ `hubLayout.js` falls geändert) bumpen
- [ ] T014 Browser-Boot-Check je Phase (council/doubleAgent/broken/epilogue) + `node tools/runTests.js` grün; keine Regression bestehender Hub-Interaktionen
**Prompt:** [tasks/WP03-integration-deploy.md](tasks/WP03-integration-deploy.md) (~340 lines)

---

## Dependencies (für finalize-tasks)
- WP01 Dependencies: none
- WP02 Dependencies: WP01
- WP03 Dependencies: WP01, WP02

## MVP-Empfehlung
WP01 (reine Logik) ist der testbare Kern; WP02+WP03 machen die Evolution sichtbar. Reihenfolge: WP01 → WP02 → WP03.
