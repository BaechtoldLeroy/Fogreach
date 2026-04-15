# Research — Mobile Control Optimization

## Decision: Floating joystick via rexVirtualJoystick's repositionable API

**Decision**: Replace the fixed-position joystick with a floating one. On `pointerdown` inside the left half of the screen (and below the inventory row), reposition the joystick base to the touch point and begin tracking. On `pointerup`, hide the base/thumb. Keep `rexVirtualJoystick` — we don't need a new plugin.

**Rationale**: `rexVirtualJoystick.setPosition(x, y)` and `.setVisible()` are already available. A full DIY joystick would add surface area without real benefit.

**Alternatives considered**:
- *Fixed joystick (status quo)*: rejected — thumb-travel pain, feels dated.
- *Swap plugin for `nipplejs`*: rejected — adds a dependency for no extra capability; rex plugin handles analog force already.

## Decision: Analog speed via `joystick.force` with dead zone

**Decision**: In `handleMobileMovement()`, use `force` as a 0.0–1.0 multiplier on `effectiveSpeed`, after a dead-zone threshold (default 0.15; configurable). Below dead zone → zero velocity.

**Rationale**: Removes drift at rest, enables slow walking for precision (D2 weight slider pairs with this). Dead zone is single-line code.

**Alternatives considered**:
- *Binary full-speed on/off (status quo)*: rejected — users have explicitly asked for more precision.
- *Non-linear response curve (e.g. cubic)*: deferred — linear is fine until proven otherwise; revisit if players report sluggishness.

## Decision: Icons from existing asset pool + 1–2 char label

**Decision**: Reuse the ability icons already produced in `graphics.js` / ability system UI (if present). Each button renders: circle background (current color), centered icon (24×24 within 88×88 button), and a small label beneath the icon (e.g. "Spin", "Dash").

**Rationale**: Consistency with desktop HUD. No new art pipeline.

**Alternatives considered**:
- *Text-only labels*: rejected — slower to parse at a glance.
- *New icon set*: rejected — scope creep.

## Decision: 44 px minimum hit area via Phaser's `hitArea`

**Decision**: Keep the visual circle radius at ~34/40 px for the smaller abilities (visually they stay dense), but override the interactive `hitArea` to a 44×44 or larger rect. Phaser supports `.setInteractive({ hitArea, hitAreaCallback, cursor })`.

**Rationale**: Apple HIG standard. Visual density preserved but taps are more forgiving.

**Alternatives considered**:
- *Enlarge the visual circles*: rejected — cluster becomes cramped and visually noisy.

## Decision: Safe-area insets via `env(safe-area-inset-*)` propagated into Phaser

**Decision**: Read `env(safe-area-inset-top/bottom/left/right)` via a hidden CSS probe element into JS at scene create, store as `window.__SAFE_AREA__`. Layout logic adds these to the corner offsets.

**Rationale**: `env()` is not accessible directly from JS; the hidden-probe pattern is the standard workaround.

**Alternatives considered**:
- *Assume fixed 20/34 px insets*: rejected — breaks on devices without notches/gestures.

## Decision: Auto-attack = nearest enemy within melee range when joystick is at rest

**Decision**: In `attack()` (or a mobile wrapper), when `joystick.force < deadZone` and `isMobile`, find nearest enemy within `meleeRange + 16 px` and set `lastMoveDirection` toward it before running the normal attack flow. Only when auto-attack setting is ON.

**Rationale**: Makes one-thumb melee viable. Doesn't change desktop behavior. Scoped to "stationary" so it never fights the joystick.

**Alternatives considered**:
- *Full auto-attack (fire every swing at nearest regardless of joystick)*: rejected — players want to be able to aim manually.
- *Lock-on target overlay*: deferred — nice-to-have, not MVP.

## Decision: Haptics via `navigator.vibrate()` with a small wrapper

**Decision**: Add `js/haptics.js` with `haptics.tap()`, `.hit()`, `.damage()`, `.levelUp()`. Each calls `navigator.vibrate(ms)` if available AND the user setting is ON. Hard-fail silent on unsupported browsers (iOS Safari has partial support — we no-op where absent).

**Rationale**: Tiny surface, easy to mute, no dependency.

**Alternatives considered**:
- *`WebKit.messageHandlers` for richer iOS haptics*: rejected — requires wrapper app; out of scope.

## Decision: Settings live under `settings.mobile` in the existing store

**Decision**: Extend `DEFAULTS` in `SettingsScene.js` with:

```js
mobile: {
  deadZone: 0.15,
  haptics: true,
  autoAim: true,
  buttonScale: 1.0   // 0.8 / 1.0 / 1.2
}
```

New "Mobile" section in the settings UI, rendered only when `isMobile` (on desktop the section is skipped).

**Rationale**: Reuses existing persistence & apply-on-boot flow.

**Alternatives considered**:
- *Separate storage key*: rejected — fragments state.
