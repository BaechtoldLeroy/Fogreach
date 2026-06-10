# Implementation Plan: ARPG Control Scheme

**Feature slug**: `042-arpg-control-scheme`
**Branch**: `main` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Merge target**: `main` — `branch_matches_target: true`

## Summary

Add a second, opt-in control scheme (WASD + mouse-aim + number-key ability slots) alongside the existing Classic scheme (arrows + Space + QWER). A new `InputScheme` module owns all scheme-dependent input resolution; every call-site that currently polls raw Phaser key objects switches to a semantic API (`getMovementInput`, `isBasicAttackTriggered`, `getAimDirection`, `consumeAbilityTrigger`). Aim direction in ARPG mode comes from the mouse cursor's world position; the existing 8-direction sprite system handles facing via `getDirectionFromVelocity(aim.x, aim.y)`. Classic stays bit-identical.

## Technical Context

**Language/Version**: Browser-side JavaScript (ES2019+, no transpilation). No bundler.
**Primary Dependencies**: Phaser 3 (global `window.Phaser`). All modules load as plain `<script>` tags via `index.html`.
**Storage**: `localStorage` under `demonfall_settings_v1` (existing bucket used by `Persistence`).
**Testing**: Node's built-in `node:test` runner (`tools/runTests.js`). Existing suite uses CommonJS requires with module stubbing; Phaser is not available — input module must be testable without it.
**Target Platform**: Modern desktop browsers (Chrome/Firefox/Edge/Safari). Touch/mobile scheme unchanged.
**Project Type**: Single-project browser game.
**Performance Goals**: 60 fps baseline; scheme-dependent input lookup must stay under 1 ms/frame (NFR-003).
**Constraints**: Classic mode may not regress measurably (NFR-004, C-001); no mandatory mouse dependency in Classic (C-002); no collision with browser-reserved shortcuts (C-004).
**Scale/Scope**: Single-player; ~10 call-sites touch input today (movement, 6 classic abilities, 4 new-ability slots, 6 menu shortcuts).

## Constitution Check

*Gate: must pass before Phase 0 research. Re-checked after Phase 1 design.*

Governance snapshot from `spec-kitty constitution context --action plan --json`:
- Template set: `software-dev-default`
- Paradigms: `test-first`
- Directives: `TEST_FIRST`
- Tools: `git`, `spec-kitty`

### TEST_FIRST compliance
- WPs introducing behavior (`inputScheme.js` module, aim-direction computation incl. dead-zone, persistence getter/setter) ship unit tests in the same WP as the code. Tests are authored first.
- UI-only WPs (HUD label update, Settings picker row) are validated manually per `quickstart.md`. Acceptable because they contain no headless-testable logic.

**Gate status**: PASS. No exceptions required.

## Project Structure

### Documentation (this feature)

```
kitty-specs/042-arpg-control-scheme/
├── plan.md              # this file
├── research.md          # Phase 0 — key technical decisions
├── data-model.md        # Phase 1 — entities
├── quickstart.md        # Phase 1 — manual acceptance script
├── contracts/
│   └── input-scheme-api.md   # Phase 1 — module public surface
├── spec.md
└── checklists/requirements.md
```

### Source Code (repository root)

```
js/
├── inputScheme.js          # NEW — scheme-aware input dispatcher
├── persistence.js          # MODIFIED — getControlScheme / setControlScheme
├── main.js                 # MODIFIED — create() + update() read via InputScheme
├── player.js               # MODIFIED — movement + aim direction via InputScheme
└── scenes/
    └── SettingsScene.js    # MODIFIED — new scheme picker row (desktop only)

tests/
└── inputScheme.test.js     # NEW — unit tests for the module

index.html                  # MODIFIED — load inputScheme.js in bootstrap order
```

**Structure Decision**: Matches the existing flat `js/` layout. No new directories. `inputScheme.js` loads after `persistence.js` (which it reads for the current scheme) and after `i18n.js` (for label translations), but before gameplay modules that consume it.

## Phases

### Phase 0 — Research
See `research.md` for decisions D0-1 through D0-6 (sprite-facing octants, aim dead-zone, dispatch API shape, scheme-change subscriber, Phaser pointer API, test harness without Phaser).

### Phase 1 — Design & Contracts
- `data-model.md`: ControlScheme, AimVector, SlotBinding entities
- `contracts/input-scheme-api.md`: public surface of `window.InputScheme`
- `quickstart.md`: manual acceptance steps (PF-1 through PF-4 + edge cases EC-1 through EC-5 from spec.md)

### Phase 2 — Tasks (NOT part of this command)
User invokes `/spec-kitty.tasks` to generate work packages.

## Complexity Tracking

No Constitution violations. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
