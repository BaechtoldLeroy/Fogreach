# Feature: ARPG Control Scheme

**Feature slug**: `042-arpg-control-scheme`
**Mission**: software-dev
**Created**: 2026-04-24

## Summary

Add a second, optional control scheme inspired by classic ARPGs (Diablo 2, Path of Exile): movement on WASD, aim direction driven by the mouse cursor, ability slots on number keys. Players pick their scheme in Settings; the existing scheme (arrow keys + space + QWER) remains the default and keeps working unchanged.

## Motivation

The current scheme (arrows for movement, Space for attack, QWER for abilities) suffers from keyboard ghosting on membrane keyboards — several players cannot attack while moving up-left because the matrix drops one of the three simultaneous inputs. A left-click attack fallback was already added, but the deeper limitation — that aim and facing are coupled to movement direction — still restricts combat feel, especially for ranged/kiting play with bows or charged attacks.

An opt-in ARPG scheme addresses both problems at once: WASD sits on a different matrix region than arrows, and mouse-aim decouples "where I'm going" from "where I'm hitting". Keeping the existing scheme as default protects players who already learned the controls.

## User Scenarios & Testing

### Primary flows

**PF-1 — Switch schemes in settings**
A player on Classic opens Settings from the main menu or in-game, picks "ARPG" from the control-scheme option, closes Settings, and immediately uses the new bindings without reloading the game. Their choice persists across sessions.

**PF-2 — Kite a ranged enemy with ARPG**
With ARPG active and a bow equipped, the player moves left with A while the mouse points right at an archer. The player faces right, shoots right, and moves left — decoupled aim is the whole point.

**PF-3 — Up-left diagonal attack with ARPG**
With ARPG active, the player holds W+A and clicks left mouse. The attack fires in the direction of the cursor. No keyboard ghosting occurs because W, A, and the mouse button are on independent input paths.

**PF-4 — Trigger abilities in ARPG mode**
With ARPG active and four abilities slotted, pressing 1, 2, 3, or 4 activates the ability in slot Q/W/E/R (respectively). The HUD still shows those slots labeled Q/W/E/R *or* 1/2/3/4 to match the active scheme.

### Secondary flows

**SF-1 — Classic player unaffected by feature**
A player who never visits the new setting sees the Classic scheme working identically to before. No new prompts, no behavioral changes.

**SF-2 — Mobile player unaffected**
Opening Settings on mobile hides the control-scheme picker. Touch controls (joystick + action buttons) are unchanged.

### Edge cases

- **EC-1**: Mouse cursor is on top of the player sprite (distance < dead-zone). Aim falls back to last known aim direction, or to movement direction if no prior aim exists. Player sprite does not jitter.
- **EC-2**: Mouse leaves the game window during ARPG play. Last known aim direction is retained until the cursor returns.
- **EC-3**: Player switches from Classic → ARPG mid-run while a charged slash or dash is already in flight. The in-flight ability completes with its original direction; subsequent inputs use the new scheme.
- **EC-4**: Player rebinds keys externally (browser extension, OS-level remap). Not supported — the feature ships with fixed bindings per scheme.
- **EC-5**: Player triggers a UI overlay (inventory, settings, dialog) while in ARPG mode. Clicking inside the UI does not fire the attack, and number keys do not trigger abilities while UI is focused.

## Requirements

### Functional Requirements

| ID     | Requirement                                                                                                   | Status   |
|--------|---------------------------------------------------------------------------------------------------------------|----------|
| FR-001 | The game exposes a "control scheme" setting with two values: `classic` (default) and `arpg`.                  | Proposed |
| FR-002 | The control-scheme setting persists across sessions and survives game reloads.                                | Proposed |
| FR-003 | Switching schemes takes effect immediately without requiring a reload or scene restart.                       | Proposed |
| FR-004 | In Classic mode, movement, attack, and ability triggers behave exactly as they did before this feature.       | Proposed |
| FR-005 | In ARPG mode, W/A/S/D map to up/left/down/right movement.                                                     | Proposed |
| FR-006 | In ARPG mode, the mouse cursor position defines the aim direction for all offensive abilities.                | Proposed |
| FR-007 | In ARPG mode, the player sprite faces the aim direction while idle or moving.                                 | Proposed |
| FR-008 | In ARPG mode, the number keys 1/2/3/4 activate ability slots that Classic binds to Q/W/E/R respectively.      | Proposed |
| FR-009 | In ARPG mode, the left mouse button triggers the basic attack in the direction of the cursor.                 | Proposed |
| FR-010 | In ARPG mode, Space continues to function as an alternate basic-attack trigger.                               | Proposed |
| FR-011 | Non-combat keys (F potion, I inventory, K loadout, O settings, J journal, M mute, P perf) remain identical across schemes. | Proposed |
| FR-012 | The HUD ability-slot badges display the key binding that matches the active scheme (Q/W/E/R vs 1/2/3/4).      | Proposed |
| FR-013 | When a UI overlay (inventory, dialog, settings) is open, ARPG bindings are suppressed — mouse-clicks and number keys do not activate combat. | Proposed |
| FR-014 | The settings picker for control scheme is not shown on touch/mobile devices.                                   | Proposed |

### Non-Functional Requirements

| ID      | Requirement                                                                                                  | Status   |
|---------|--------------------------------------------------------------------------------------------------------------|----------|
| NFR-001 | Switching scheme from the settings menu completes in under 200 ms (perceived instant).                       | Proposed |
| NFR-002 | In ARPG mode, sprite-facing updates at least at the display frame rate (no visible lag between cursor motion and player rotation). | Proposed |
| NFR-003 | Aim-direction computation and dispatch adds less than 1 ms per frame on desktop hardware.                    | Proposed |
| NFR-004 | Classic-mode performance does not regress measurably (no additional cost when ARPG features are dormant).    | Proposed |

### Constraints

| ID    | Constraint                                                                                                  | Status   |
|-------|-------------------------------------------------------------------------------------------------------------|----------|
| C-001 | The feature must not change any existing key binding in Classic mode.                                        | Proposed |
| C-002 | The feature must not introduce a mandatory mouse dependency for Classic players.                             | Proposed |
| C-003 | The feature must coexist with the existing left-click-attack fallback (committed in feat/input earlier) and not double-fire. | Proposed |
| C-004 | No new keyboard binding may shadow browser-reserved shortcuts (Ctrl+R, F5, F11, etc.).                       | Proposed |

## Success Criteria

- **SC-1**: A Classic player completes a full dungeon run (~10 min) after this feature ships without noticing any change in their controls.
- **SC-2**: An ARPG player can reproduce the Up-left diagonal + attack combo that was previously blocked by keyboard ghosting, across at least three different keyboard types, 100% of attempts.
- **SC-3**: 90% of new players who opt into ARPG in a playtest complete their first dungeon run without reverting to Classic.
- **SC-4**: Language, scheme-toggle UI, and HUD badges remain correctly localized (German + English) under both schemes.
- **SC-5**: No automated test in the existing suite regresses after the feature lands.

## Key Entities

- **Control Scheme**: a named set of input bindings for movement, aim, and abilities. Two values exist: `classic` and `arpg`. Stored per player in local settings.
- **Aim Direction**: a unit vector describing where offensive abilities should be directed. Derived from movement direction in Classic mode and from the mouse cursor (relative to the player world position) in ARPG mode.
- **Ability Slot**: one of four loadout positions (slot1/slot2/slot3/slot4) that the player fills with abilities. Each slot is addressable via a scheme-dependent key binding.

## Assumptions

- Target platform: desktop (keyboard + mouse). Mobile has its own touch-control scheme and is explicitly unaffected.
- Aim dead-zone: when the cursor sits within a small pixel radius of the player (≈ 20 px world-space), the aim vector falls back to the last known direction rather than producing a zero-vector.
- Sprite asset sufficiency: the existing 8-direction (or left/right with mirroring) sprite set suffices to convey facing toward the cursor. No new art is required.
- Localization: the setting label and the two scheme names ("Classic" / "ARPG") are new translation keys; other existing strings are unaffected.
- Settings UI: the new picker follows the same pattern as the language picker (WP02 of the 041 feature).

## Out of Scope

- Full custom key rebinding (a general remapping UI). Schemes are fixed presets.
- Gamepad/controller support.
- Mouse-driven movement (click-to-move). Movement in ARPG is WASD-only.
- Multiple named profiles (one active scheme per player).
- Mobile/touch scheme changes.

## Dependencies

- Settings persistence layer (already present; language picker uses it — same mechanism).
- HUD slot badge renderer (present; needs to read the active scheme to decide the key label).
- Existing `i18n.register`/`onChange` subscribers for live localization.

## Open Clarifications

None at this time.
