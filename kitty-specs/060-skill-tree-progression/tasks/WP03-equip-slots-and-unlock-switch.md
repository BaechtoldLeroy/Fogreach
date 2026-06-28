---
work_package_id: WP03
title: 4-Slot-Equip (nur ≥1 Rang) + Auto-Unlock ablösen
dependencies:
- WP01
requirement_refs:
- FR-05
- FR-07
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: main
base_commit: da15e554e5ecd761760317891c56efecd487b451
created_at: '2026-06-28T00:00:00Z'
subtasks:
- T013
- T014
- T015
- T016
phase: Phase 2 - Erwerb
assignee: ''
agent: ''
history:
- timestamp: '2026-06-28T00:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated
authoritative_surface: js/abilitySystem.js
execution_mode: code_change
lane: planned
owned_files:
- js/abilitySystem.js
- js/mobileAbilityButtons.js
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP03 – 4-Slot-Equip (nur ≥1 Rang) + Auto-Unlock ablösen

## Ziel
Der passive Auto-Unlock entfällt: Knoten werden über `SkillTree` **verfügbar**
(Min-Level/Prereq), aber nur durch investierte Punkte „gelernt". In die 4 aktiven
Slots (Q/W/E/R, Desktop + Mobile) lassen sich **nur Skills mit ≥1 Rang** legen.

## Requirements
FR-05 (Equip nur ≥1 Rang), FR-07 (Auto-Unlock ablösen), SC-04. **Depends on**: WP01.

## Kontext / Code-Anker
- `js/abilitySystem.js` — `UNLOCK_RULES` + `_checkUnlocks` (kills/quest/boss/wave), `onEnemyKilled`/`onBossKilled`/`onQuestCompleted`/`onWaveCompleted`, `getLearnedAbilities`, `getActiveLoadout`/Equip-Setter, `tryActivate`.
- Loadout-UI: `window.openLoadoutUI` (K-Taste); Mobile slot-index (Memory `mobile_slot_index_layout`), `js/mobileAbilityButtons.js`.
- `js/skillTree.js` (WP01) — `getRank`, `getAllNodes`.

## Subtasks
- **T013** „Gelernt" = `SkillTree.getRank(node) >= 1`. `getLearnedAbilities`/Equip-Pfad so umstellen, dass nur solche Abilities equippbar/aktivierbar sind. `tryActivate` bleibt der gemeinsame Aktivierungspfad.
- **T014** `UNLOCK_RULES`-Auto-Learn ablösen: `_checkUnlocks` neutralisieren/entfernen (kein automatisches `learnAbility` mehr aus kills/quest/boss/wave). Sicherstellen, dass `onEnemyKilled` etc. weiter aufgerufen werden dürfen, aber keine Skills mehr auto-lernen. Verfügbarkeit kommt aus `SkillTree.isNodeAvailable`.
- **T015** Mobile: slot-index-basiertes Equip prüfen — nur ≥1-Rang-Skills landen in den Slots; HUD-Buttons zeigen nur equippte Skills (kein Auto-Learn-Leak).
- **T016** Verifikation: Unit/Smoke — vor Punkt-Investition ist KEIN Skill equippbar/aktiv; nach Investieren (Rang≥1) equippbar (Desktop + Mobile). `node tools/runTests.js` grün; `node tools/testGame.js --loadout` „Errors found: 0". Bestehende ability/loadout-Tests anpassen (kein Auto-Unlock mehr).

## Independent Test
Loadout-Smoke + ggf. angepasste ability-Tests; nachweisbar kein Auto-Learn, nur geranktе Skills equippbar.

## Done-Kriterien
- `UNLOCK_RULES`-Auto-Learn ist abgelöst (SC-04 / FR-07).
- Nur Skills mit ≥1 Rang sind equippbar/aktiv (Desktop + Mobile). Keine Regression von `tryActivate`.

## Activity Log
