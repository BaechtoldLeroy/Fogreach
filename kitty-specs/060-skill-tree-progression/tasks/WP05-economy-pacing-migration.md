---
work_package_id: WP05
title: Economy (Respec-Gold + Schwarzmarkt) + Pacing + Persistenz/Migration
dependencies: []
requirement_refs:
- FR-06
- FR-09
- FR-10
- FR-11
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: da15e554e5ecd761760317891c56efecd487b451
created_at: '2026-06-28T00:00:00Z'
subtasks:
- T022
- T023
- T024
- T025
- T026
- T027
phase: Phase 4 - Economy/Pacing/Migration
assignee: ''
agent: ''
history:
- timestamp: '2026-06-28T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/scenes/ShopScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/ShopScene.js
- js/lootSystem.js
- js/storage.js
- js/persistence.js
- js/main.js
- tests/skillTreeSave.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP05 – Economy + Pacing + Persistenz/Migration

## Ziel
Den Gold-Kreislauf schließen (Respec kostet skalierend Gold, Maras Schwarzmarkt
aufgewertet → #51), die Level-Kurve strecken (#41), und Skill-State sauber
speichern + alte Saves migrieren (#11/SC-07).

## Requirements
FR-06 (Respec-Gold), FR-09 (Schwarzmarkt-Sink), FR-10 (Pacing), FR-11 (Persistenz/Migration). **Depends on**: WP01, WP04.

## Kontext / Code-Anker
- `js/lootSystem.js` — `getGold`/`spendGold`/`grantGold`.
- `js/skillTree.js` — `respec`, `getSpentPoints`, `getSaveData`/`loadSaveData`.
- `js/scenes/ShopScene.js` — Maras Schwarzmarkt (Sortiment/Reroll/Potions, `_tryBuy*`).
- `js/main.js`/`js/player.js` — `getNeededXP`/`neededXP` (≈`2*level`), Level-Up-Pfad.
- `js/storage.js` (`saveGame`/`applySaveToState`, Save-Payload) + `js/persistence.js` (`KEYS`).
- Migration-Quelle: `demonfall_abilities_v1` (`abilitySystem` `learnedAbilities`).

## Subtasks
- **T022** Respec-Gold-Kosten **skalierend** finalisieren (Formel, z.B. `Basis * getSpentPoints()` oder `f(playerLevel)`; tunebar/zentral). In WP04s Respec-Button verdrahten: `spendGold(cost)` nur bei ausreichend Gold, sonst Hinweis. Kostenanzeige live.
- **T023** **Maras Schwarzmarkt aufwerten** (#51): erweitertes/rotierendes Sortiment und/oder zusätzliche Gold-Services (z.B. mehr Stock, bessere Reroll-Optionen). Reiner Gold-Sink, **keine neue Währung**.
- **T024** **Level-Kurve steiler** (#41): `getNeededXP`/`neededXP` von linear `2*level` auf eine **progressivere** Kurve umstellen (tunebar), damit Skill-Punkte über mehr Content verteilt sind. Balance-Notiz im Code.
- **T025** **Persistenz**: `SkillTree.getSaveData()` (skillPoints + ranks + equippte Slots) in den Haupt-Save (`storage.js`) aufnehmen + Laden in `applySaveToState`; ggf. `persistence.js` KEY. Konsistent mit dem Save-once-Pfad.
- **T026** **Migration Pre-060**: beim Laden eines Saves ohne Skill-State → definierte Regel anwenden (Empfehlung: voller Reset mit **Gratis-Respec** + Punkte = aktueller Level; ODER `learnedAbilities` → je Rang 1 + verbuchte Punkte). Kein Crash, kein Item-/Gold-/Skill-Verlust.
- **T027** **Save-Kompat-Tests** (`tests/`): Pre-060-Save lädt in konsistenten Zustand (SC-07); Respec zieht Gold nur bei Deckung (SC-05/06); Level-Kurve liefert erwartete Schwellen. `node tools/runTests.js` grün; `node tools/testGame.js --dungeon`/`--loadout` „Errors found: 0".

## Independent Test
Unit: Respec-Gold-Gating, Migration, Level-Kurve. Smoke: fehlerfrei. Playwright: Respec zieht Gold; Pre-060-Save lädt ohne Verlust.

## Done-Kriterien
- Respec kostet skalierend Gold; Schwarzmarkt + Respec ziehen spürbar Gold (SC-06).
- Level-Kurve gestreckt (#41); Skill-State persistiert; Pre-060-Saves migrieren sauber (SC-07).

## Activity Log
