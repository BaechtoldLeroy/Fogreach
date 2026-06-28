---
work_package_id: WP02
title: Rang-/Synergie-Effekte im Combat
dependencies:
- WP01
requirement_refs:
- FR-04
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: da15e554e5ecd761760317891c56efecd487b451
created_at: '2026-06-28T00:00:00Z'
subtasks:
- T008
- T009
- T010
- T011
- T012
phase: Phase 2 - Effekte
assignee: ''
agent: ''
history:
- timestamp: '2026-06-28T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/player.js
execution_mode: code_change
lane: planned
owned_files:
- js/player.js
- tests/skillTreeEffects.test.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP02 – Rang-/Synergie-Effekte im Combat

## Ziel
Fähigkeiten skalieren mit ihrem **Rang** (Schaden/Cooldown/Effekt) und mit
**Synergien** (Rang eines Knotens pusht eine Kennzahl eines anderen). Eine
zentrale Lesestelle versorgt den Ability-Combat-Pfad mit den effektiven Werten.

## Requirements
FR-04 (Rang-/Synergie-Effekte), SC-03 (≥2 Synergie-Paare nachweisbar). **Depends on**: WP01.

## Kontext / Code-Anker
- `js/skillTree.js` (WP01) — `getRank`, `getSynergyValue`, `getNode`.
- `js/player.js` — Ability-Ausführung/Schaden (z.B. Spin/Charge/Dagger-Pfade), `dealDamageToEnemy`, Cooldown-Setzung (`startCooldownTimer`).
- `js/abilitySystem.js` — `ABILITY_DEFS` (Basis-Werte), `tryActivate`.

## Subtasks
- **T008** In `js/skillTree.js`: `getAbilityRank(abilityId)` (Rang des zugehörigen Knotens) + `getEffectiveAbilityStats(abilityId)` → liefert Basis-Werte aus `ABILITY_DEFS`, **moduliert mit Rang-Kurve + Synergie-Beiträgen** (nutzt `getSynergyValue`). Reine Funktion, testbar.
- **T009** Ability-Combat in `js/player.js` liest die effektiven Werte über `getEffectiveAbilityStats` statt der fixen `ABILITY_DEFS`-Zahlen (Schaden, ggf. Cooldown, Effekt-Stärke). Defensiv: wenn `SkillTree` fehlt → Fallback auf Basis-Werte (kein Bruch).
- **T010** Synergie-Anwendung konkret verdrahten: mind. **2 Synergie-Paare** (z.B. „Rang in A gibt B +X% Schaden") in `SKILL_TREE` aktivieren + im effektiven Wert berücksichtigen.
- **T011** Rang-Effekt-Kurven + `maxRank`-Caps austarieren (diminishing returns gegen One-Skill-Dominanz, #45). Werte tunebar/zentral.
- **T012** Tests in `tests/skillTree.test.js` ergänzen: (a) höherer Rang → höherer effektiver Schaden; (b) Synergie-Paar nachweisbar (Rang in A erhöht B's Wert); (c) Cap greift. `node tools/runTests.js` grün. Smoke `node tools/testGame.js --dungeon` „Errors found: 0".

## Independent Test
Unit-Tests für effektive Werte + Synergie; Dungeon-Smoke fehlerfrei.

## Done-Kriterien
- Abilities werden mit Rang stärker; ≥2 Synergie-Paare wirken nachweisbar (SC-03).
- Combat-Pfad bricht ohne `SkillTree` nicht (Fallback). Keine Regression.

## Activity Log
