---
work_package_id: WP03
title: Tests
dependencies:
- WP01
- WP02
- WP05
requirement_refs:
- FR-018
- FR-020
- FR-021
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: 05cb2fe362b93481ac8531b2526f1713f0967cc4
created_at: '2026-07-17T19:20:34.792384+00:00'
subtasks: [T011, T012, T013, T014, T015, T019]
shell_pid: "33952"
agent: "claude"
history:
- 2026-07-17T17:13:33Z: Erstellt (spec-kitty.tasks).
authoritative_surface: tests/questSystem.test.js
execution_mode: code_change
lane: planned
owned_files: [tests/questSystem.test.js]
---

# WP03 — Tests

## Objective

`tests/questSystem.test.js` deckt die neue v4-Struktur ab: die vier Akt-Trigger, die „genau vier Trigger"-Invariante (die den #44-Fehler verhindert hätte), die Ende-Freischaltung, den Altstand-Reset und die Boss-Ziele nach den Umbenennungen. Bestehende Tests, die von entfernten/umbenannten IDs abhängen, werden angepasst.

## Branch Strategy

- Planungs-/Basis-Branch: `main`. Merge-Ziel: `main`.
- Abhängig von WP01 und WP02. Start: `spec-kitty implement WP03 --base WP01` (bzw. auf die integrierte Basis von WP01+WP02).

## Kontext & Quellen

- Test-Muster: bestehende `tests/questSystem.test.js` (nutzt `tests/loadGameModule.js`, lädt Module ohne DOM). Vorbild-Tests aus der Akt-1-Reparatur (Akt-Trigger, „jeder bewohnte Akt hat einen Trigger").
- Kontrakt: `.../contracts/quest-data-contract.md` (Invarianten am Ende).
- Datenmodell: `.../data-model.md` (Save-Format, Reset-Regel).

## Projekt-Konventionen

- Test-Runner: `node tools/runTests.js` (node:test). Deterministische Fixtures, kein `Math.random`/Zeit.
- **Mutationsprüfung** (Projekt-Gewohnheit): nach dem Schreiben jeden neuen Test testweise gegen den unveränderten (Prä-WP01) Zustand bzw. durch Entfernen des Fixes prüfen, dass er WIRKLICH fällt — insbesondere die „genau vier Trigger"-Invariante und der Reset-Test.

---

## Subtasks

### T011 — Akt-Trigger + Invariante
**Schritte:**
1. Je ein Test: Abschluss von `harren_daughter_investigation`→Akt 1, `council_collusion_reveal`→2, `mara_warning`→3, `bruch_confrontation`→4.
2. Invarianten-Test: aus `QUEST_DEFINITIONS` genau vier Quests mit `advanceAct`; jeder Akt-Index 1–4 hat einen Trigger; kein `advanceAct: 5/6`.
**Validierung:** Tests grün; Invariante fällt, wenn ein Trigger fehlt (Mutationsprobe).

### T012 — Ende + Nicht-Trigger
**Schritte:**
1. Test: nach Abschluss von `the_reckoning` ist `story_ending` freigeschaltet (`unlocks`).
2. Test: `elara_second_truth` trägt kein `advanceAct`.
**Validierung:** beide grün.

### T013 — Altstand-Reset
**Schritte:**
1. Fixture: ein Quest-Save-Blob OHNE `storyVersion`, mit alten IDs (`ritual_chamber`, `final_truth`) und gesetzten Flags.
2. `loadQuestSaveData(fixture)` → Akt 0, Story-Flags leer, keine alten Quests im State; kein Fehler.
3. Positiv-Gegentest: ein v4-Blob (mit `storyVersion`) lädt normal (State übernommen).
**Validierung:** Reset greift nur bei fehlender/alter Version.

### T014 — Boss-Leiter-Ziele
**Schritte:**
1. Tests: `mara_warning`-Objective-target = `kettenmeister`, `elara_ritual` = `zeremonienmeister`, `schattenrat_finale` = `schattenrat`.
2. Bestehende Tests, die auf `ritual_chamber`/`harren_rescue`/`final_truth`/alte Trigger zeigen, auf die neuen IDs/Trigger umstellen (z. B. der frühere „Ritualkammer"-/`mara_assault`-Test).
**Validierung:** keine bestehenden Tests brechen wegen der Umbenennungen.

### T015 — Struktur-Invarianten
**Schritte:**
1. Test: 34 Quest-Definitionen; keine doppelten `id`; keine doppelten `title`.
2. Stichproben: `council_collusion_reveal.prerequisites` = die vier Fraktions-Quests; `espionage_informant.npcId === 'mara'`; `bruch_confrontation.prerequisites` enthält `elara_second_truth`; npcId von `klerus_district_purge` === `klerus_priester`, von `garde_night_escort` === `stadtwache` (FR-022).
**Validierung:** grün gegen den Kontrakt.

### T019 — Objective-Trigger-Audit
**Zweck:** Sicherstellen, dass JEDES Objective-Ziel auslösbar ist — das hätte #44 (und den Analyse-Befund) gefangen.
**Schritte:**
1. Eine bekannte Menge auslösbarer Ziele definieren: bereits verdrahtete Typen (`kill`/`elite_enemy`, `boss_kill`, `explore`/`room`, `craft`, `dungeon_run`, `wave`), die bestehenden fetch/observe-Ziele, die **WP05**-verdrahteten Ziele (`verification_seal`, `proclamation`, `memory_shard`, `escort_route`, `informant_id`) und `dialogue` (Auto-Complete).
2. Test iteriert über alle `QUEST_DEFINITIONS`-Objectives und bestätigt, dass jedes `type`/`target` in dieser Menge liegt — kein Ziel bleibt ohne Trigger.
3. Insbesondere: `council_collusion_reveal` und `elara_second_truth` sind `dialogue` (nicht `observe`).
**Validierung:** Test fällt, sobald ein Objective ein unverdrahtetes Ziel bekommt (Mutationsprobe: ein Ziel auf einen Fantasienamen setzen → rot).

---

## Definition of Done

- `node tools/runTests.js` grün, inkl. aller neuen Fälle.
- Mutationsproben für Invariante + Reset dokumentiert (fallen ohne den jeweiligen Mechanismus).
- Keine bestehenden Tests brechen wegen der Umbenennungen.

## Risiken & Reviewer-Hinweise

- Reviewer prüft, dass die Invarianten-Tests tatsächlich scharf sind (nicht nur „grün", sondern fallen bei Mutation) — genau das hätte #44 verhindert.
- Fixture-Realismus: der Alt-Save muss dem echten alten Blob-Format entsprechen (flach `quests`/`flags`).

## Activity Log

- 2026-07-17T19:20:36Z – claude – shell_pid=33952 – lane=doing – Started implementation via workflow command
- 2026-07-17T19:33:33Z – claude – shell_pid=33952 – lane=for_review – 12 neue Tests + 7 auf v4 umgestellt. Suite 503/0. Mutationsproben scharf.
- 2026-07-17T19:33:53Z – claude – shell_pid=33952 – lane=approved – Selbst-Review: 12 neue + 7 v4-Tests, volle Suite 503/0, Mutationsproben fallen je 1/1. Nur tests/questSystem.test.js beruehrt.
- 2026-07-17T19:34:48Z – claude – shell_pid=33952 – lane=done – Moved to done
