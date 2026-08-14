# Tasks: Mobile Kontext-Primärbutton (065)

**Mission**: software-dev · **Branch**: `main` → `main` · **Execution**: code_change (Mobile-only)

Kleines Feature → **ein** Work Package. Betrifft `js/mobileControls.js`,
`js/mobileAbilityButtons.js`, `js/doorSystem.js` (leichter Getter). Desktop unverändert.

## WP01 — Mobile Kontext-Primärbutton umsetzen
**Prompt**: [tasks/WP01-context-primary-button.md](tasks/WP01-context-primary-button.md)
**Ziel**: `attack` + `interact` zu einer kontextsensitiven Primärzelle zusammenlegen; Glyph/
Label reaktiv (✋„Aktion" ↔ ⚔️„Angr"); Tap dispatcht kontextabhängig über bestehende Pfade.
**Independent test**: quickstart.md (Kampf/Tür/Loot/NPC/Prop/Übergang/Cooldown/Desktop).
**Dependencies**: none.

- [ ] T001 `DoorSystem.isDoorInRange(scene, player)` — leichter Getter (nearest door < INTERACT_DIST).
- [ ] T002 `hasPeacefulTarget(scene)`-Helfer (window-Global) — Aggregation Hub/Dungeon; nie Gegner/destructible.
- [ ] T003 `ABILITY_LAYOUT`: `attack`+`interact` → eine Primärzelle (`primary`), frei werdende Position leer.
- [ ] T004 Kontext-Poll in `_pollEnabledState`: Glyph/Label des Primärbuttons nach `hasPeacefulTarget`.
- [ ] T005 Tap-Dispatch-Weiche: peaceful → `_interact()`, sonst Angriff; genau EIN Pfad.
- [ ] T006 Cooldown-Anzeige + Icon-Padding erhalten; Verifikation, `?v=`-Bumps + `GAME_VERSION`, Tests.

**Implementation sketch**: T001→T002 (Signale) → T003 (Layout) → T004/T005 (View+Controller) → T006 (Erhalt+Verify).
**Risiken**: doppelte Auslösung (nur EIN Pfad, R3); Cooldown-Regress (b59 erhalten); Desktop-Pfade nicht anfassen (C-001).
**Estimated prompt size**: ~330 Zeilen.

## Dependencies (für finalize-tasks)
- WP01: Dependencies: none
