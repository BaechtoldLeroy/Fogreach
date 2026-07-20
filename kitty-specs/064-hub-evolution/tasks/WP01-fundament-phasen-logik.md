---
work_package_id: WP01
title: Fundament - Phasen-Logik
dependencies: []
requirement_refs:
- FR-001
- FR-002
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T001, T002, T003, T004]
authoritative_surface: js/hubPhase.js
execution_mode: code_change
lane: planned
owned_files: [js/hubPhase.js, tests/hubPhase.test.js]
---

# WP01 — Fundament: Phasen-Logik (`hubPhase.js`)

## Objective
Ein reines Classic-Script-Modul `js/hubPhase.js`, das aus Akt-Index + Story-Flags die Hub-Phase ableitet und die pro Phase definierten Darstellungs-/Verhaltens-Daten bereitstellt — exakt gemäß [hub-phase-contract](../contracts/hub-phase-contract.md). Fundament, gegen das View (WP02) und Integration (WP03) bauen. Keine Abhängigkeit, sofort baubar.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP01`.

## Kontext & Quellen
- **Verbindlicher Kontrakt:** [contracts/hub-phase-contract.md](../contracts/hub-phase-contract.md) — Signatur, Ableitungsregel, PHASE_STYLE-Felder, Test-Erwartungen.
- Design: [Story v4 §15](../../062-story-v4-quest-backbone/research/Fogreach_Story_v4.md).
- Projekt-Muster: bestehende reine Module (`js/questFinale.js` aus 063) — IIFE, `window.*`, kein `import/export`; Tests laden mit `global.window={}` + require.

## Projekt-Konventionen
- Classic Script: `(function(){ 'use strict'; ... window.HubPhase = {...}; })();`.
- ASCII in Phasen-Namen/Flags/NPC-IDs; Umlaute nur im Fließtext.
- `derivePhase` ist rein: kein `Date`/`Math.random`, keine Seiteneffekte, mutiert die Eingabe nicht.

---

## Subtasks

### T001 — Skeleton + derivePhase
**Schritte:**
1. `js/hubPhase.js`: IIFE, `window.HubPhase = { derivePhase, current, PHASE_STYLE, npcFlavorByPhase, aldricBlocksQuests }`.
2. `derivePhase(actIndex, flags)`: `var a = (typeof actIndex === 'number') ? actIndex : 0; var f = flags || {};` dann Priorität: `if (f.story_ending) return 'epilogue'; if (a >= 4) return 'broken'; if (a >= 2) return 'doubleAgent'; return 'council';`.
**Validierung:** `node --check`; `derivePhase(2,{})` = 'doubleAgent', `derivePhase(4,{story_ending:true})` = 'epilogue'.

### T002 — PHASE_STYLE
**Schritte:**
1. `PHASE_STYLE` mit genau vier Einträgen (`council/doubleAgent/broken/epilogue`), jeder mit allen Feldern: `tint` (0xRRGGBB), `desaturate` (0..1), `fog` (0..1), `posters` ∈ {fresh|faded|torn|gone}, `assetKey` (string|null), `rathausHostile` (bool).
2. Werte thematisch: council neutral (tint 0xffffff, fog 0, posters fresh, rathausHostile false); doubleAgent kühl/entsättigt (posters faded); broken rötlich/dunkel (posters torn, rathausHostile true); epilogue heller Nebel (fog hoch, posters gone). `assetKey` je Phase gesetzt (z. B. `hub_doubleAgent`), council `null`.
**Validierung:** jede Phase hat einen Eintrag mit allen sechs Feldern.

### T003 — npcFlavorByPhase + aldricBlocksQuests + current
**Schritte:**
1. `aldricBlocksQuests(phase)` → `return phase === 'broken';`.
2. `current()` → `derivePhase(window.storySystem && window.storySystem.getCurrentActIndex ? window.storySystem.getCurrentActIndex() : 0, window.questSystem && window.questSystem.getFlags ? window.questSystem.getFlags() : {})` (defensiv).
3. `npcFlavorByPhase`: mindestens `doubleAgent.aldric` (hohler Wahlkampf), `broken.aldric` (feindlich/enttarnt), `epilogue.buerger` (liest vor). ASCII-NPC-IDs, Umlaute im Text ok. Fehlt ein Eintrag → Integration lässt die Flavor-Zeilen unverändert.
**Validierung:** `aldricBlocksQuests('broken')` true, sonst false; `current()` wirft nicht ohne Globals.

### T004 — Tests
**Schritte:** `tests/hubPhase.test.js` (node:test, `global.window={}` + require):
1. `derivePhase`: (0,{})=council, (1,{})=council, (2,{})=doubleAgent, (3,{})=doubleAgent, (4,{})=broken.
2. Priorität: (4,{story_ending:true})=epilogue, (2,{story_ending:true})=epilogue.
3. Default/Robustheit: (null,undefined)=council, kein Wurf; Eingabeobjekt unverändert (Snapshot).
4. `aldricBlocksQuests`: 'broken'→true; 'council'/'doubleAgent'/'epilogue'→false.
5. PHASE_STYLE: alle vier Phasen vorhanden, jede mit den sechs Feldern (Typen grob prüfen).
**Validierung:** `node --test tests/hubPhase.test.js` grün; Mutationsprobe: eine Prioritäts-Bedingung invertieren → roter Test.

---

## Definition of Done
- `js/hubPhase.js` erfüllt den [hub-phase-contract](../contracts/hub-phase-contract.md); DOM-frei ladbar.
- `node --test tests/hubPhase.test.js` grün; `node tools/runTests.js` bleibt grün.

## Risiken & Reviewer-Hinweise
- Reviewer prüft die exakte Prioritätsreihenfolge (epilogue schlägt broken).
- Reinheit: keine Globals-Lesung in `derivePhase` (nur `current()` liest Globals).

## Activity Log
- (leer bis implement)
