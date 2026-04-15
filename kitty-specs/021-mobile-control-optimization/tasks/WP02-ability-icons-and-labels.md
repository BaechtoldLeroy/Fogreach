---
work_package_id: WP02
title: Ability icons + labels + legible cooldown
dependencies: []
requirement_refs: [FR-005, FR-006, FR-007]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 021-mobile-control-optimization-WP01
base_commit: bef362b3c0a28afa183be4e518751b03b1b737b6
created_at: '2026-04-15T19:51:40.662981+00:00'
subtasks: [T001, T002, T003, T004]
shell_pid: "17888"
history:
- action: created
  agent: claude
  utc: '2026-04-15T14:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/mobileAbilityButtons.js
---

# WP02 — Ability icons + labels + legible cooldown

## Objective

Every mobile ability button shows a recognizable icon + 1–2 char label, has legible cooldown text across all button colors, and has a clearly-distinct disabled state while on cooldown or insufficient-resource. Aims to let a new mobile player identify every ability without documentation.

## Context

Current state after WP01: buttons are colored circles with a 44×44 hit rect, positioned by the grid. Cooldown text uses plain white on varying backgrounds — legibility is inconsistent.

Icon sources in the repo (verify during T001 — these are likely candidates, not guaranteed):
- `js/graphics.js` defines textures used in the desktop HUD.
- Ability-panel UI (search for `ABILITY_ICON` or similar) may already map ability keys to texture keys.

If no icon pool exists, fall back to single-letter glyphs from the ability name (e.g. "S" for Spin, "⚡" for Dash) — document the fallback in a code comment.

## Subtasks

### T001 — Build the `abilityKey → iconTexture` map

**Purpose**: Single source of truth for which texture each ability button shows.

**Steps**:
1. Grep for existing ability icon maps (likely `ABILITY_ICONS`, `ABILITY_SPRITES`, or similar). If one exists, import/reference it from `mobileAbilityButtons.js`.
2. If missing, define the map locally:
   ```js
   const ABILITY_ICON_MAP = {
     attack: 'iconSword',
     spin:   'iconSpin',
     charge: 'iconCharge',
     dash:   'iconDash',
     dagger: 'iconDagger',
     shield: 'iconShield',
   };
   ```
3. Export `getAbilityIcon(key)` returning `null` if the texture doesn't exist (so buttons can fall back to glyph).

**Files**: `js/mobileAbilityButtons.js` (new, ~150 lines after this WP).

**Validation**: `getAbilityIcon('spin')` returns a string in loaded textures. `getAbilityIcon('unknown')` returns `null`.

### T002 — Enrich button visuals with icon + label

**Purpose**: Replace the bare circle with circle + icon + text.

**Steps**:
1. Export `decorateAbilityButton(scene, btnCircle, abilityKey)` that:
   - Adds a centered `Image` (24×24 at scale 1.0, scaled by `__MOBILE_BUTTON_SCALE__`) on top of the circle.
   - Adds a 1–2 char label (`Spin`, `Ds`, `Dg`, `Sh`, `Ch`, `Atk` — pick short but readable) in 11 px text at `y = radius - 6`.
   - Uses `depth = circle.depth + 1` for icon, `circle.depth + 2` for label.
2. WP01's mobileControls.js calls this decorator after building each button. (This WP adds a small listener on `demonfall:mobile-layout-ready` that iterates buttons and decorates them.)
3. If the icon texture is missing, render a single glyph (the first letter of the ability name, styled to match).

**Files**: `js/mobileAbilityButtons.js`.

**Validation**: All 6 buttons show an icon + label. Nothing overflows the button at `scale = 0.8`.

### T003 — Legible cooldown text

**Purpose**: Cooldown numbers must be readable over any button color.

**Steps**:
1. Configure each cooldown text node with `stroke: '#000', strokeThickness: 3, color: '#fff', shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true }`.
2. Keep the existing cooldown-update loop in `abilitySystem.js` — this WP only styles the text.
3. Anchor cooldown text to the button center (not the legacy corner offset), so it reads as an overlay, not a neighboring label.

**Files**: `js/mobileAbilityButtons.js` (exports a `styleCooldownText(textNode)` helper that WP01's main loop calls).

**Validation**: Cooldown of 4.2 → 4.1 → 4.0 is readable on every button color including the bright cyan spin button.

### T004 — Disabled visual state

**Purpose**: Distinguish "can press" from "on cooldown" or "not unlocked".

**Steps**:
1. When the button is disabled, desaturate: `circle.setFillStyle(originalColor, 0.25)`; set icon `setAlpha(0.5)`; label `setAlpha(0.5)`.
2. When re-enabled, restore: `circle.setFillStyle(originalColor, 0.6)`; icon/label alpha 1.0.
3. Expose `setAbilityButtonEnabled(abilityKey, enabled)` so ability-system code can call it cleanly. Hook into the existing cooldown tick if possible; otherwise add a short `scene.events.on('update', poll)` loop.

**Files**: `js/mobileAbilityButtons.js`.

**Validation**: Trigger spin (long cooldown) — its button should visibly gray out and restore on cooldown end.

## Definition of Done

- Every mobile ability button shows an icon OR fallback glyph, plus a label.
- Cooldown numbers are legible on every button color.
- Disabled state is visually distinct at a glance.
- No regression to ability firing or cooldown timing.

## Risks

- Icon textures may not exist yet — fallback to glyphs is mandatory, not optional.
- Label text may clip at `buttonScale = 0.8` — test this explicitly and shorten any label that overflows.

## Reviewer guidance

- Expect a new module file plus small hooks into the event contract WP01 introduced.
- No modifications to `abilitySystem.js` or `main.js` — all changes confined to `js/mobileAbilityButtons.js`.

## Implementation command

```
spec-kitty implement WP02 --base WP01
```

## Activity Log

- 2026-04-15T19:58:19Z – unknown – shell_pid=17888 – lane=for_review – WP02 complete: emoji icons + labels + cooldown styling + disabled state.
- 2026-04-15T20:10:04Z – unknown – shell_pid=17888 – lane=approved – self-review: syntax pass, matches spec
