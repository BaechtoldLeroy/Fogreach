# Data Model — Mobile Control Optimization

This is a frontend/game feature; "data model" here captures persistent settings + in-scene UI state that survives `initControls()` setup.

## Persistent settings (`localStorage['demonfall_settings_v1']`)

Extends existing `DEFAULTS` in `js/scenes/SettingsScene.js`:

```js
mobile: {
  deadZone: 0.15,       // number, 0.0–0.4; below this force → zero velocity
  haptics: true,        // boolean; enables navigator.vibrate()
  autoAim: true,        // boolean; attack btn auto-targets nearest when stationary
  buttonScale: 1.0      // number, one of 0.8 / 1.0 / 1.2
}
```

Validation on load:
- `deadZone` clamped to `[0, 0.4]`
- `buttonScale` snapped to nearest allowed value
- Unknown keys ignored

Applied on boot via `applySettings()`:
- `window.__MOBILE_DEAD_ZONE__ = settings.mobile.deadZone`
- `window.__MOBILE_HAPTICS__ = !!settings.mobile.haptics`
- `window.__MOBILE_AUTO_AIM__ = !!settings.mobile.autoAim`
- `window.__MOBILE_BUTTON_SCALE__ = settings.mobile.buttonScale`

## Runtime state

`initControls()` retains:
- `joystick` — the existing rex instance, now floating
- `joystickActive` (new) — boolean, true between pointerdown/pointerup on left half
- `abilityButtons[]` (existing, restructured) — now keyed by ability name, each with: `{ circle, icon, label, hitRect, cooldownText, dx, dy, baseRadius }`

`window.__SAFE_AREA__` — object `{top, right, bottom, left}` in CSS px, read once at startup from a hidden probe DOM element using `getComputedStyle().paddingTop` of a div with `padding: env(safe-area-inset-*)`.

## No server-side state

Mobile-only feature; no backend.
