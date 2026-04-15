# Feature: Mobile Control Optimization

## Problem
Mobile controls are functional but rough. Current state (from `js/main.js:initControls`):
- 6 colored circle buttons with no icons or labels — players must memorize which color is which ability.
- Fixed 34/40px hit targets (below Apple HIG's recommended 44px minimum) — mis-taps are common, especially near screen edges.
- Joystick is fixed at `(100, height-100)` — thumb has to travel to a specific spot instead of using wherever the thumb naturally rests.
- No analog speed scaling — joystick deflection is treated as full-speed on/off (`force > 0`).
- No dead zone — tiny drifts cause unwanted movement.
- No haptic feedback for taps, hits, or level-up.
- No auto-attack targeting — players have to manually face enemies while also dodging.
- Ability button layout is hand-positioned in negative offsets from screen corner; small phones push buttons off-screen or let them overlap the joystick area.

## Goal
Bring mobile controls up to modern ARPG-on-mobile standards (Diablo Immortal, PoE Mobile): precise inputs, legible UI, safe-area-aware layout, and touch-feel that rivals keyboard+mouse responsiveness.

## Technical Context
- Engine: Phaser 3 + `rexVirtualJoystick` plugin.
- Mobile detection: `this.sys.game.device.input.touch` → `isMobile` flag drives `handleMobileMovement()` + `initControls()`.
- Target: portrait and landscape phones, 360–430 px wide. Safe areas (notches, home indicator) currently ignored.
- Existing state to preserve: all abilities and their cooldown logic (`window.AbilitySystem`), inventory button at top-right, button-to-function wiring in `initControls`.

## Functional Requirements

### Layout & hit targets
- **FR-001**: All interactive buttons have a minimum 44×44 CSS-px tap area (larger visual radius optional).
- **FR-002**: Button layout uses safe-area insets (`env(safe-area-inset-*)` or equivalent) on iOS; nothing overlaps the home-indicator strip or notch.
- **FR-003**: Layout is defined as a grid/anchored scheme that adapts to screen width/height, not hard-coded offsets.
- **FR-004**: Inventory button and future settings shortcut fit within the top safe-area without touching the joystick/ability cluster.

### Iconography & readability
- **FR-005**: Each ability button shows a recognizable icon (same iconography used elsewhere, e.g. ability panel) AND a short text label (1-2 chars: e.g. "Spin", "Dash").
- **FR-006**: Cooldown overlay is legible against the button color at all sizes (contrast + stroke).
- **FR-007**: Disabled state (cooldown, insufficient resource) is visually distinct from enabled.

### Joystick
- **FR-008**: Joystick behaves as a **floating/dynamic** joystick — first touch on the left half of the screen places the joystick base at that point; lifting resets.
- **FR-009**: Joystick output is analog: `force` drives movement speed proportionally (0.0–1.0), with a configurable dead zone (default ~0.15) to eliminate drift.
- **FR-010**: Joystick never overlaps ability buttons on the right side of the screen.

### Auto-attack assist
- **FR-011**: Attack button auto-targets the nearest enemy within melee range if the player is stationary (face the target without requiring joystick input).
- **FR-012**: Auto-target does not override an active joystick direction.

### Haptics
- **FR-013**: Use `navigator.vibrate()` (where supported) for:
  - 10 ms tick on ability button press
  - 25 ms pulse on successful player hit
  - 50 ms pulse on player damage taken
  - 120 ms pulse on level-up
- **FR-014**: Haptics are a user-toggleable setting (default ON).

### Settings integration
- **FR-015**: New "Mobile" settings section exposing: joystick dead zone, haptics on/off, auto-attack on/off, button scale (80/100/120%).

## Non-Goals
- Controller/gamepad support (separate feature).
- Redesign of the ability HUD on desktop.
- New ability additions or rebalances.

## Related
- Existing memory: mobile ability buttons need icons + labels (this feature resolves that).
- D2-feel weight slider (already shipped) — analog joystick input pairs well with it.

## Success Criteria
- A first-time mobile player can identify every ability without reading documentation.
- No mis-taps caused by buttons being smaller than a thumb.
- Movement feels precise on the joystick; no drift at rest.
- Auto-attack makes melee-only play viable one-handed.
