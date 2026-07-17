---
work_package_id: WP01
title: Finale-Logik (computeFinaleState)
dependencies: []
requirement_refs:
- FR-009
- FR-010
- FR-011
- FR-012
- FR-013
- FR-014
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T001, T002, T003, T004, T005]
authoritative_surface: js/questFinale.js
execution_mode: code_change
lane: planned
owned_files: [js/questFinale.js, tests/questFinale.test.js]
---

# WP01 — Finale-Logik (`computeFinaleState`)

## Objective
Ein neues, **reines** Classic-Script-Modul `js/questFinale.js`, das aus dem Story-Flag-Satz den Finale-Ausgang berechnet — exakt gemäß [finale-contract](../contracts/finale-contract.md). Keine Abhängigkeit; sofort und voll parallel baubar. Die Inszenierung (the_reckoning) konsumiert dieses Modul später (WP05).

## Branch Strategy
- Planungs-/Basis-Branch **main**, Merge-Ziel **main**. Start: `spec-kitty implement WP01` (keine Dependencies).

## Kontext & Quellen
- **Verbindlicher Kontrakt:** [contracts/finale-contract.md](../contracts/finale-contract.md) — Signatur, Eingabe-Flag-Vokabular (Tabelle), Ausgabeform, Ableitungsregeln, Default, Test-Erwartungen.
- Design: [research/Fogreach_Story_v4.md](../../062-story-v4-quest-backbone/research/Fogreach_Story_v4.md) §10 (die vier Regler) und §13.4 (Finale).
- Projekt-Muster: bestehende Save-/Logik-Module (`js/questSystem.js`) — IIFE, `window.*`, kein `import/export`. Tests laden Module ohne DOM via `tests/loadGameModule.js`.

## Projekt-Konventionen
- Classic Script: `(function(){ 'use strict'; ... window.QuestFinale = {...}; })();`. In Node muss `global.window` gesetzt sein (die Tests tun das).
- ASCII in IDs/Flags. Keine Umlaute in Code. Rein: kein `Date`, kein `Math.random`, keine Seiteneffekte, kein Storage/DOM.
- Die Funktion darf das Eingabe-`flags`-Objekt **nicht mutieren**.

---

## Subtasks

### T001 — Modul-Skeleton
**Schritte:**
1. `js/questFinale.js` anlegen: IIFE, `'use strict'`, `window.QuestFinale = { computeFinaleState: computeFinaleState };`.
2. Interner Helper `flag(flags, name)` → `!!(flags && flags[name])` (fehlende Flags = false).
**Validierung:** `node --check js/questFinale.js`; `node -e "global.window={};require('./js/questFinale.js');console.log(typeof window.QuestFinale.computeFinaleState)"` → `function`.

### T002 — Regler 1 + Regler 4 + Default
**Schritte:**
1. `betrayalForeseen = flag('mole_evidence') || flag('three_hands_seen')`.
2. `remembered = flag('self_remembered')`.
3. Default-Robustheit: bei `null`/`undefined`/leerem Objekt liefert die Funktion den kompletten konservativen Zustand ohne Fehler.
**Validierung:** `computeFinaleState({})` liefert `betrayalForeseen:false, remembered:false, ...` ohne Wurf; `computeFinaleState(null)` ebenso.

### T003 — Regler 2 (allies)
**Schritte:**
1. `allies.mara = (flag('petitions_kept') || flag('mole_evidence')) && !flag('convoy_blown')`.
2. `allies.branka = flag('branka_ally')`.
3. `allies.thom = flag('thom_ally')`.
4. Hinweis: `petitions_surrendered` allein macht Mara NICHT anwesend (die `petitions_kept`-Bedingung greift dann nicht) — kein Extra-Code nötig, aber im Test absichern.
**Validierung:** siehe Kontrakt (petitions_surrendered → mara false; petitions_kept → mara true).

### T004 — Regler 3 (elara) + abgeleitete Felder
**Schritte:**
1. `elara = (flag('elara_trust') && (flag('mole_evidence') || flag('three_hands_seen'))) ? 'lives' : 'dies'`.
2. `aloneAtEnd = !(allies.branka || allies.mara || allies.thom)`.
3. `namelessEnding = !remembered`.
4. Rückgabeobjekt exakt in der Kontrakt-Form zusammensetzen.
**Validierung:** Vertrauen+Beweis → 'lives'; Vertrauen ohne Beweis → 'dies'; Beweis ohne Vertrauen → 'dies'.

### T005 — Tests
**Schritte:** `tests/questFinale.test.js` (node:test, Muster `tests/loadGameModule.js` bzw. `global.window={}` + require):
1. Pro Regler je ein true- und ein false-Fall (≥8 Fälle).
2. Elara-Kombinatorik: {trust+evidence}=lives; {trust, kein evidence}=dies; {evidence, kein trust}=dies; {nichts}=dies.
3. `petitions_surrendered` allein → `allies.mara===false`; `petitions_kept` → true; `convoy_blown` überschreibt mara auf false.
4. Default: `computeFinaleState({})` deep-equal dem konservativen Zustand; kein Wurf bei `null`.
5. Reinheit: zweifacher Aufruf mit demselben Objekt → deep-equal; Eingabeobjekt bleibt unverändert (Snapshot vor/nach vergleichen).
**Validierung:** `node --test tests/questFinale.test.js` grün; jeder Test ist scharf (Mutationsprobe: eine Regler-Bedingung invertieren → roter Test).

---

## Definition of Done
- `js/questFinale.js` lädt DOM-frei und erfüllt den [finale-contract](../contracts/finale-contract.md).
- `node --test tests/questFinale.test.js` grün; `node tools/runTests.js` bleibt grün.
- Reinheit nachgewiesen (kein Mutieren des Eingabeobjekts, deterministisch).

## Risiken & Reviewer-Hinweise
- Reviewer prüft, dass die Regeln **exakt** dem Kontrakt entsprechen (v. a. Elara = Vertrauen UND Beweis; Mara-Bedingung inkl. `convoy_blown`-Override).
- Kein Einlesen globaler Flags im Modul — die Flags kommen ausschließlich als Argument (Reinheit).

## Activity Log
- (leer bis implement)
