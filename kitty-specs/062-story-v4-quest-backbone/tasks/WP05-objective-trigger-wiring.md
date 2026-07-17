---
work_package_id: WP05
title: Objective-Trigger-Verdrahtung
dependencies: [WP01]
requirement_refs:
- FR-021
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 062-story-v4-quest-backbone-WP01
base_commit: 2615b1a68e51e9d445caaffc1dce988682a022ef
created_at: '2026-07-17T18:45:34.350598+00:00'
subtasks: [T020, T021, T022]
shell_pid: "32284"
agent: "claude"
history:
- 2026-07-17T17:41:57Z: Erstellt (spec-kitty.analyze-Remediation, Option B).
authoritative_surface: js/loot.js
execution_mode: code_change
lane: planned
owned_files: [js/loot.js, js/roomManager.js, js/roomTemplates/CouncilWarehouse.json]
---

# WP05 — Objective-Trigger-Verdrahtung

## Objective

Die neuen **gameplay-basierten** Objective-Ziele der v4-Quests auslösbar machen, damit die betroffenen Quests completable sind. Ohne dieses WP wären mehrere neue/geänderte Quests uncompletable — die Fehlerklasse, die schon #44 verursacht hat (dieser Befund kam aus `/spec-kitty.analyze`).

**Nicht hier:** die zwei szenengebundenen Reveals (`collusion_reveal_seen`, `three_hands_seen`) — deren Szene ist Out-of-Scope; sie bleiben in WP01 `dialogue` (Auto-Complete). Dieses WP verdrahtet nur die gameplay-Ziele.

## Branch Strategy

- Planungs-/Basis-Branch: `main`. Merge-Ziel: `main`.
- Abhängig von WP01 (die Ziel-Namen stehen im Kontrakt/den Quest-Daten). Start: `spec-kitty implement WP05 --base WP01`.

## Kontext & Quellen

- **Analyse-Befund & Entscheidung:** `.../research.md` R7; `.../data-model.md` Abschnitt 1a (Verdrahtungs-Tabelle).
- **Kontrakt:** `.../contracts/quest-data-contract.md` — die mit **⚙WP05** markierten Ziele.
- **fetch-Muster (bestehend):** `js/loot.js` — bei Item-Pickup mit `questTarget` wird `window.questSystem.updateQuestProgress('fetch', item.questTarget, 1)` gefeuert (Zeile ~431). `journal_fragment`/`council_document` sind so als 10%-Drops bei aktiver Quest verdrahtet — dem Muster folgen.
- **observe-Muster (bestehend):** `js/espionageSystem.js` — `convoy_intel`/`archive_record`/`informant_id` (ggf. teils schon vorhanden) feuern `updateQuestProgress('observe', target)` in kuratierten Spionage-Räumen.

## Projekt-Konventionen

- Classic-Script; ASCII-Targets. Kein Feuern ohne aktive Quest (sonst Progress-Leak).
- Cache-Buster für `loot.js`/`espionageSystem.js` liegen in WP04 (dort gebumpt).

---

## Subtasks

### T020 — fetch-Ziele als Quest-Item-Drops (loot.js)
**Zweck:** `verification_seal`, `proclamation`, `memory_shard` als aufsammelbare Quest-Items, die den Fortschritt feuern.
**Schritte:**
1. Dem `journal_fragment`/`council_document`-Muster folgen: wenn die zugehörige Quest aktiv ist, mit definierter Chance ein Quest-Item mit `questTarget: '<ziel>'` droppen; beim Pickup feuert `updateQuestProgress('fetch', questTarget, 1)`.
2. `verification_seal` (magistrat_verification), `proclamation` (faction_campaign, ×3), `memory_shard` (who_you_were, ×3, respektiert `minDepth: 5`).
3. Sicherstellen, dass die Drops nur bei aktiver, noch nicht erfüllter Quest erscheinen.
**Validierung:** Mit aktiver Quest droppt/sammelt das Item und der Objective-Counter steigt; ohne aktive Quest kein Drop.

### T021 — observe-Ziele als Spionage-Zonen (espionageSystem.js)
**Zweck:** `escort_route` (garde_night_escort), `informant_id` (espionage_informant) auslösbar machen.
**Schritte:**
1. Dem `convoy_intel`/`archive_record`-Muster folgen: in einer kuratierten Spionage-Zone feuert das Abhören `updateQuestProgress('observe', '<ziel>')`.
2. Prüfen, ob `informant_id` bereits existiert (espionage_informant war zuvor evtl. anders verdrahtet) — dann nur an Mara/Akt 3 anpassen, nicht doppeln.
3. `escort_route` an eine passende bestehende Spionage-Situation hängen (kein neuer Raum nötig, wenn eine bestehende Zone thematisch trägt).
**Validierung:** In der Zone mit aktiver Quest steigt der observe-Counter.

### T022 — Regressions-Schutz
**Zweck:** Keine Störung bestehender fetch/observe-Ziele.
**Schritte:**
1. Bestehende Ziele (`journal_fragment`, `council_document`, `convoy_intel`, `archive_record`) unverändert lassen.
2. Kein Progress-Leak: neue Drops/Zonen feuern nur bei aktiver zugehöriger Quest.
3. `node --check` beider Dateien; kurzer Blick, dass keine bestehende Quest ihren Trigger verliert.
**Validierung:** Bestehende Quest-Trigger funktionieren weiter; neue feuern kontrolliert.

---

## Definition of Done

- `verification_seal`, `proclamation`, `memory_shard` sind fetch-verdrahtet; `escort_route`, `informant_id` observe-verdrahtet.
- Kein Feuern ohne aktive Quest; keine Regression bestehender Ziele.
- `js/loot.js` und `js/espionageSystem.js` laden fehlerfrei.
- Der Trigger-Audit-Test in WP03 (T019) läuft grün.

## Risiken & Reviewer-Hinweise

- **Progress-Leak** (Ziel feuert für inaktive Quest) — Reviewer prüft die Aktiv-Bedingung.
- **Doppel-Verdrahtung** von `informant_id`, falls es schon existierte — nicht duplizieren.
- Reviewer gleicht die verdrahteten Ziele mit den **⚙WP05**-Markierungen im Kontrakt ab (genau diese fünf, nicht die ⏳auto-Ziele).

## Activity Log

- 2026-07-17T18:45:35Z – claude – shell_pid=32284 – lane=doing – Started implementation via workflow command
