---
work_package_id: WP03
title: Effekt-Pool (A1-A6) + Combat-/Stat-Hooks
dependencies:
- WP01
- WP02
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on main; completed changes must merge back into main.
base_branch: main
base_commit: a358696c8dacc53cec7c7e6628aaa2ffae2fa2be
created_at: '2026-06-24T16:38:33.739185+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
- T018
- T019
phase: Phase 3 - Effekte
assignee: ''
agent: ''
shell_pid: ''
history:
- timestamp: '2026-06-24T08:00:00Z'
  lane: planned
  agent: system
  action: Prompt generated via /spec-kitty.tasks
lane: planned
review_feedback: ''
review_status: ''
reviewed_by: ''
---

# Work Package Prompt: WP03 – Effekt-Pool (A1–A6) + Combat-/Stat-Hooks

## Ziel
Die run-definierenden Amulett-Effekte implementieren. Reine/teilweise Stat-Effekte
fließen über `recalcDerived`; Nicht-Stat-Effekte (Extra-Projektil, Chain, Cleave,
Lebensraub, Aura) über explizite, leichtgewichtige Combat-Hooks, die
`window.runAmulet.effect` lesen. Mindestens 6 Amulette (A1–A6 aus spec §6).

## Requirements
FR-05 (Effekt-Pool), FR-06 (Pipeline/Hook-Anwendung), NFR-01 (Perf), NFR-02 (Balance), SC-05.

## Kontext / Code-Anker (gegen aktuellen Code geprüft)
- `js/inventory.js:842` — `recalcDerived(oldItemHp, newItemHp)`; `:852` `Object.values(equipment).forEach(it => …)` — Amulett-Stat-Anteil wird hier automatisch mitgezählt, solange das Amulett-Item ein kompatibles `baseStats`/Affix-Shape hat.
- `js/inventory.js:948` — Skill-Effekte werden ON TOP der Equipment-Stats addiert (Muster für additive Amulett-Stats).
- `js/lootSystem.js:437` — `getBonus(statKey)` (Affix-Aggregat) als Referenz-Muster.
- `js/player.js:2040` — `_fireBowArrow(scene)` (Projektil-Spawn-Pfad → Extra-Projektil-Hook A1).
- `js/player.js:2034` — `_hasBowEquipped()` (liest `equipment.weapon`) als Hook-Vorbild.
- Melee-Treffer-Pfad in `js/player.js` (Suchanker: Schaden-an-Gegner-Anwendung) für A3 Cleave / A2 Chain / A4 Lifesteal.

## Subtasks
- **T012** [test-first] Effekt-Tests in `tests/runAmulet.test.js` (rot): (a) Stat-Amulett (A6 Tempo / A8 Glasherz-Stil) ändert Derived korrekt; (b) Nicht-Stat-Hook-Dispatch ruft den richtigen Effekt nur wenn `window.runAmulet.effect` gesetzt; (c) ohne Amulett: alle Hooks no-op.
- **T013** A6 (Tempo/Burst) + A8 (Glasherz, optional) als Stat-Amulette: Amulett-Stat-Anteil in `recalcDerived` (`js/inventory.js:842`) verrechnen (move/speed/damage/maxHp). Sicherstellen, dass der `Object.values(equipment)`-Loop (`:852`) das Amulett mitnimmt; ggf. Amulett-spezifischer Bonus-Block ON TOP (Muster `:948`).
- **T014** A1 Extra-Projektil/Doppelschlag: Hook in Player-Attack. Bei `runAmulet.effect==='twin'`: zweiter versetzter Treffer/Projektil (~60% Schaden) — Bogen über `_fireBowArrow` (`:2040`), Melee über Melee-Treffer-Pfad.
- **T015** A2 Chain: Hit-Resolve-Hook — bei Treffer auf Gegner bis zu 2 nächste Gegner im Pool finden (Distanz-Schwelle) und mit abnehmendem Schaden (~40%) treffen.
- **T016** A3 Cleave: Melee-Hit-Region bei `cleave` auf Kegel/AoE erweitern statt Einzelziel.
- **T017** A4 Lebensraub: Damage-Dealt-Hook + `setPlayerHealth` — heilt X% des verursachten Schadens (deutlich über jedem Affix-Lifesteal).
- **T018** A5 Aura: throttled Per-Tick-DoT um den Spieler im Update-Loop (NFR-01: Throttle, kein per-Frame O(n²); nur nahe Gegner).
- **T019** Zentraler Dispatch: Helfer `applyAmuletEffectHook(kind, ctx)` (z.B. `'onAttack'|'onHit'|'onDamageDealt'|'onTick'`) liest `window.runAmulet`; alle Hooks sind no-op ohne aktives Amulett. Tests grün; NFR-01-Perf-Check (60fps Desktop, Mobile ≥45).

## Independent Test
Unit-Test pro Effekt-Archetyp + Dispatch-Test (no-op ohne Amulett). Combat-Hooks
lesen `window.runAmulet.effect`. 60fps unverändert.

## Done-Kriterien
- ≥5 (Ziel 6) Amulette mit unterscheidbaren, spürbaren Effekten (SC-05).
- Stat-Anteil über `recalcDerived`; Nicht-Stat über Hooks; ohne Amulett kein Effekt.
- Keine Perf-Regression (NFR-01); Loot nicht entwertet (NFR-02, Playtest in WP05).

## Activity Log

- 2026-06-24T16:37:56Z – unknown – lane=in_progress – Moved to in_progress
- 2026-06-24T17:15:18Z – unknown – lane=for_review – Moved to for_review
