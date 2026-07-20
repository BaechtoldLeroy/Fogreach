# Implementation Plan: Hub-Evolution über die Akte

**Branch**: `main` (Planungs-/Basis = Merge-Ziel = `main`, matches=true) | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)
**Input**: [spec.md](spec.md) · Issue [#67](https://github.com/BaechtoldLeroy/Fogreach/issues/67) · Quelle: [Story v4 §15](../062-story-v4-quest-backbone/research/Fogreach_Story_v4.md)

## Summary

Der Hub wird akt-/flag-abhängig. Eine **reine Phasen-Ableitung** `hubPhase(actIndex, flags) → 'council'|'doubleAgent'|'broken'|'epilogue'` (Fundament) bestimmt den Zustand; eine **Darstellungs-Schicht** wendet pro Phase Tint/Entsättigung, Nebel-/Overlay-Layer und Anschlagtafel-Zustand auf die bestehende Hub-Szene an (code-gezeichnet, mit Austauschpunkt für optionale Assets); die **Integration** in HubSceneV2 hängt das ein, sperrt Aldrics Quest-Angebote in `broken` und blendet den Epilog-Bürger/Flavor ein.

**Parallelität:** Zwei Kontrakte entkoppeln die Arbeit — der **Phasen-Kontrakt** (reine Logik + Style-/Flavor-Daten) und der **View-Kontrakt** (`HubPhaseView.apply(scene, phase, refs)`). Die reine Logik hat keine Abhängigkeit und startet sofort; die View baut gegen den Phasen-Kontrakt; die Integration führt beides in HubSceneV2 zusammen. Die Issue-Etappen A (doubleAgent-Atmosphäre), B (broken/Aldric), C (epilogue) verteilen sich über View (visuell) + Integration (Verhalten).

## Technical Context

**Language/Version**: JavaScript ES2015+ als **Classic Scripts** (kein Modulsystem), Phaser 3.70 im Browser; Node 20+ für Tests.
**Primary Dependencies**: Phaser 3.70, `window.storySystem` (`getCurrentActIndex`), `window.questSystem` (`getFlags`), HubSceneV2 (`create`, NPC-Spawn, `_showNpcDialogue`), `hubLayout.js` (NPC-Roster + `visibleFromAct`/`visibleAfterFlag`-Gates).
**Storage**: keine neue Persistenz — Phase wird aus Akt-Index/Flags **abgeleitet**, nicht gespeichert.
**Testing**: `node tools/runTests.js` (node:test); reine Logik DOM-frei; Browser-Boot-Check je Phase.
**Target Platform**: GitHub Pages, Desktop + Mobile.
**Performance Goals**: kein wahrnehmbarer Ruckler beim Hub-Aufbau (NFR-005).
**Constraints**: Classic-Script (`window.*`, IIFE); ASCII in IDs/Phasen, Umlaute im Fließtext; rekursive `scrollFactor(0)`-Propagation für Overlays; `Date.now()`; kein STORY_VERSION-Bump; **kein Layout-Umbau** (nur Tönung/Overlay/Flavor/NPC-Verfügbarkeit).
**Scale/Scope**: 4 Phasen, 1 neues Logikmodul, 1 neues View-Modul, Integration in HubSceneV2 + hubLayout.

**Bestehende Anker (aus Code-Sichtung):**
- Hub-Hintergrund: `const bg = this.add.image(0, 0, 'hubscene_bg')` (HubSceneV2 ~Z.166) — Ziel für `setTint`/Overlay.
- Aldric-Quest-Sperre: bestehendes `aldricRefuses`-Muster (HubSceneV2 ~Z.1072, PrintingHouse-Retaliation) — für `broken` erweitern.
- NPC-Flavor: `storySystem.getNpcDialogue(npcId)` bzw. `npcData.lines` — phasenabhängig überschreibbar.
- `buerger`-NPC (063) ab Akt 2 mit `truth_told` — im Epilog als Vorleser wiederverwenden.

## Constitution Check

*GATE:* Nur die bekannte Tool-Registry-Warnung (nicht blockierend). Kanon (Story v4 §15, „Layout bleibt, Bedeutung kippt") ist mit dem Feature konsistent — die Constitution-Storyline wurde in der Backlog-Pflege bereits auf v4 aktualisiert. **Pass.**

## Project Structure

### Documentation (this feature)
```
kitty-specs/064-hub-evolution/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/
│   ├── hub-phase-contract.md        # derivePhase + PHASE_STYLE + npcFlavorByPhase + Aldric-Regel
│   └── hub-phase-view-contract.md   # HubPhaseView.apply(scene, phase, refs)
└── tasks.md                          # (spec-kitty.tasks)
```

### Source Code (repository root)
```
js/
├── hubPhase.js          # NEU: window.HubPhase — derivePhase(actIndex,flags), PHASE_STYLE, npcFlavorByPhase, aldricBlocksQuests(phase)
├── hubPhaseView.js      # NEU: window.HubPhaseView.apply(scene, phase, refs) — Tint/Overlay/Nebel/Anschlagtafeln, Asset-Austauschpunkt
├── scenes/HubSceneV2.js # ERWEITERT: apply beim Hub-Aufbau; Aldric-Block in broken; Epilog-Buerger/Flavor
├── scenes/hub/hubLayout.js # ERWEITERT (falls nötig): phasenabhängige NPC-Sichtbarkeit/Flavor-Hooks
└── ...
tests/
└── hubPhase.test.js     # NEU: derivePhase alle Phasen + Prioritaet + Default; aldricBlocksQuests
index.html                # ERWEITERT: <script>-Tags + Cache-Buster
```

**Structure Decision**: Single-Project. Die reine Logik (`hubPhase.js`) ist DOM-frei testbar; das Rendering kapselt `hubPhaseView.js` in EINEM Modul (die visuelle Anwendung ist inhärent ein Integrationspunkt und lässt sich nicht sinnvoll pro Etappe parallelisieren, ohne HubSceneV2 mehrfach zu besitzen). Deshalb: **Fundament / View / Integration** statt A/B/C-parallel; die Etappen A/B/C sind Subtasks über View + Integration.

## Work-Package-Parallelität (Vorschlag für /spec-kitty.tasks)

| WP | owned_files | Abhängigkeit | Parallel? |
|---|---|---|---|
| **Fundament** | `js/hubPhase.js`, `tests/hubPhase.test.js` | keine | sofort |
| **View** | `js/hubPhaseView.js` | Phasen-Kontrakt | gegen Kontrakt parallel |
| **Integration** | `js/scenes/HubSceneV2.js`, `js/scenes/hub/hubLayout.js`, `index.html` | Fundament + View | zuletzt |

`hubPhase.js`/`hubPhaseView.js` sind neue Dateien (überlappungsfrei). Genau EIN WP besitzt HubSceneV2/hubLayout/index.html (Integration).

## Complexity Tracking

*Keine Constitution-Verletzungen.* Bewusste Aufteilung in drei kleine Module statt einem, begründet durch DOM-freie Testbarkeit der Logik und den geforderten Asset-Austauschpunkt (View isoliert).
