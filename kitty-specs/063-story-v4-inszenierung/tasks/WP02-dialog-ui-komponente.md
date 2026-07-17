---
work_package_id: WP02
title: Dialog-Auswahl-Komponente (DialogChoice)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-017
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 6eaccc183d288e702e92b3a11f11436c5033942a
created_at: '2026-07-17T22:24:37.342740+00:00'
subtasks: [T006, T007, T008, T009, T010]
authoritative_surface: js/dialogChoice.js
execution_mode: code_change
lane: planned
owned_files: [js/dialogChoice.js, tests/dialogChoice.test.js]
shell_pid: "27384"
agent: "claude"
---

# WP02 — Dialog-Auswahl-Komponente (`DialogChoice`)

## Objective
Die wiederverwendbare Spieler-Auswahl-Komponente `js/dialogChoice.js` gemäß [dialog-ui-contract](../contracts/dialog-ui-contract.md). Sie ist das **Fundament** für Szenen (WP04), Content (WP03) und Finale-Inszenierung (WP05) — diese bauen gegen den Kontrakt, nicht gegen die Implementierung. Keine Dependencies.

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP02` (keine Dependencies).

## Kontext & Quellen
- **Verbindlicher Kontrakt:** [contracts/dialog-ui-contract.md](../contracts/dialog-ui-contract.md) — Datenformen (DialogChoice/Config/Result), API (`present`, `resolve`, `toPage`), Invarianten (scrollFactor, showIf, Flag-Setzen).
- **Wirt (nur lesen, NICHT editieren — gehört WP05):** `js/scenes/HubSceneV2.js`, Methode `_showDialoguePages(npcData, titleStr, pages, questMode, questData, pageIndex)`. Pages sind `{text, choices:[{label,action}], _isInfoPage, _isTurnin}`, Container `setDepth(1500).setScrollFactor(0)`, Panel `0x0c0c11`, Buttons 40px hoch.
- **scrollFactor-Falle:** [[project_phaser_scrollfactor_dialogs]] — rekursive Propagation, sonst verfehlen mobile Taps.
- **Flags:** `window.questSystem.getFlags()` (aus 062, liefert Kopie). Setter: `window.questSystem.setFlag(name)` wird von WP04 ergänzt; hier NUR zur Laufzeit auflösen (nicht importieren).

## Projekt-Konventionen
- Classic Script IIFE, `window.DialogChoice = {...}`. ASCII in Flags, Umlaute in Anzeigetexten ok.
- `Date.now()` für Zeit (Entprellung), nie `scene.time.now` szenenübergreifend.

---

## Subtasks

### T006 — Skeleton + reine `resolve`
**Zweck:** Die DOM-freie Kernlogik zuerst, damit sie testbar ist.
**Schritte:**
1. `js/dialogChoice.js`: IIFE, `window.DialogChoice = { resolve, present, toPage }`.
2. `resolve(config, flags)` (rein): filtert `config.choices` per `showIf(flags)` (fehlt showIf → sichtbar), liefert `{ visibleChoices: [...] }`. Zusätzlich Helper `pickResult(choice, index)` → `{ index, choice, flagsSet: (choice.setFlags||[]).slice() }`.
3. Keine Phaser-/DOM-Nutzung in `resolve`/`pickResult`.
**Validierung:** `node --check`; `resolve` gibt bei 3 Optionen mit einem `showIf=false` genau 2 zurück.

### T007 — `present(scene, config)` (Phaser-Rendering)
**Schritte:**
1. Container in `scene` erstellen (`scene.add.container`), `setScrollFactor(0)`, Depth über dem Dialogpanel.
2. Optional `config.prompt` als Textzeile rendern; darunter je sichtbarer Choice einen Button (Panel-/Button-Stil des Wirts nachbilden: dunkles Rechteck, heller Text, ~40px).
3. **Rekursives `scrollFactor(0)`** auf Container UND allen Kindern (Helper `_applyScrollFactor(obj)` der über `obj.list` rekursiert).
4. Klick/Tap-Handler pro Button (`setInteractive`, `pointerup`).
5. Rückgabe: Handle mit `destroy()` (räumt Container + Listener ab).
**Validierung:** Boot-Check (WP05): Optionen sichtbar, mobil antippbar.

### T008 — Flag-Anbindung
**Schritte:**
1. Interner `_setFlag(name)`: `if (window.questSystem && typeof window.questSystem.setFlag === 'function') window.questSystem.setFlag(name);` (lazy, zur Laufzeit — kein Build-Dependency auf WP04).
2. Interner `_getFlags()`: `return (window.questSystem && window.questSystem.getFlags) ? window.questSystem.getFlags() : {};`.
3. Bei Auswahl: alle `choice.setFlags` via `_setFlag` setzen; `choice.onPick` (falls vorhanden) aufrufen; optional `choice.response` als Folgezeile zeigen; dann `config.onResolved(pickResult(...))`.
4. `showIf`-Filter nutzt `_getFlags()`.
**Validierung:** Test injiziert einen Fake-Setter (siehe T010).

### T009 — `toPage(config)`-Adapter
**Schritte:**
1. `toPage(config)` liefert ein `_showDialoguePages`-kompatibles Page-Objekt `{ text: config.prompt||'', choices: <label-Liste>, _choiceConfig: config }`, damit WP05 Auswahl-Seiten in den bestehenden Flow einhängen kann, ohne die Komponente zu kennen.
2. Dokumentiere im Datei-Kopf-Kommentar, wie WP05 `_choiceConfig` in `_showDialoguePages` behandelt (bei Auswahl `present`/`resolve` nutzen).
**Validierung:** `toPage` gibt ein Objekt mit `text`, `choices` (Array), `_choiceConfig` zurück.

### T010 — Tests (headless)
**Schritte:** `tests/dialogChoice.test.js` (node:test, `global.window={}` + Fake `questSystem`):
1. `resolve`: showIf-Filter entfernt unsichtbare Optionen; ohne showIf alle sichtbar.
2. `pickResult`: `flagsSet` entspricht `choice.setFlags`.
3. Flag-Setzen: mit injiziertem `window.questSystem.setFlag`-Spy prüfen, dass die gewählte Option ihre Flags setzt (die reine Pfad-Logik ohne Phaser testen — ggf. `_setFlag` über eine kleine, exportierte Funktion prüfbar machen).
4. flag-abhängige Variante: `showIf(flags)` reagiert auf einen gesetzten Flag.
**Validierung:** `node --test tests/dialogChoice.test.js` grün. (Das Phaser-`present`-Rendering wird NICHT im Unit-Test, sondern im Boot-Check von WP05 geprüft.)

---

## Definition of Done
- `js/dialogChoice.js` erfüllt den [dialog-ui-contract](../contracts/dialog-ui-contract.md); `resolve` ist DOM-frei getestet.
- Rekursives `scrollFactor(0)` implementiert; kein direkter localStorage-Zugriff (Flags nur über questSystem).
- `node tools/runTests.js` grün.

## Risiken & Reviewer-Hinweise
- **scrollFactor-Falle:** Reviewer prüft die rekursive Propagation (nicht nur auf dem Container).
- **Kein Build-Dependency auf WP04:** `setFlag` wird nur zur Laufzeit aufgelöst; die Datei lädt auch ohne `questSystem.setFlag` fehlerfrei.
- WP02 editiert NICHT `HubSceneV2.js`/`questSystem.js` (fremde owned_files).

## Activity Log
- (leer bis implement)
- 2026-07-17T22:24:38Z – claude – shell_pid=27384 – lane=doing – Started implementation via workflow command
- 2026-07-17T22:26:23Z – claude – shell_pid=27384 – lane=for_review – resolve/applyChoice headless getestet (10), rekursives scrollFactor, Suite 532/0.
