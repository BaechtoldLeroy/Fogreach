# Quickstart — Manual Smoke Test

The project has no automated test harness, so each WP lands with a manual verification checklist. This doc is the master acceptance run for the whole feature.

## Setup

1. `npm run dev` (or open `index.html` in browser).
2. Open Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M).
3. Select **iPhone 14 Pro** (390×844, has notch + home indicator) for portrait.
4. Hard-reload (Ctrl+Shift+R) so mobile detection takes effect.

## Acceptance checklist

### Layout
- [ ] Inventory button visible in top-right, not hidden by notch.
- [ ] Ability buttons clustered bottom-right, no overlap with the home-indicator strip.
- [ ] Buttons scale with the "Button Scale" setting (80% / 100% / 120%).
- [ ] Rotating to landscape (844×390) re-positions everything cleanly.

### Joystick
- [ ] Touching anywhere on the left half of the screen spawns the joystick base under the finger.
- [ ] Dragging the thumb moves the player analog-proportional (slow near center, full-speed at rim).
- [ ] Releasing resets the joystick out of view.
- [ ] With dead zone at default 0.15, a gently resting thumb does not move the player.
- [ ] Joystick does not spawn under ability buttons on the right half.

### Abilities
- [ ] Every ability button shows an icon AND a 1–2 char label.
- [ ] Cooldown countdown text is readable over the button color.
- [ ] Tapping anywhere inside the 44×44 hit area registers reliably.
- [ ] Disabled (on cooldown) state is visually distinct.

### Auto-attack
- [ ] With the joystick untouched and auto-aim ON, tapping the attack button swings toward the nearest enemy within melee range.
- [ ] With the joystick deflected, auto-aim is suppressed and the player swings in the joystick direction.
- [ ] Turning auto-aim OFF in settings restores the stationary-attack-no-target behavior.

### Haptics
- [ ] On a device with vibration support, enabling haptics produces:
  - A brief tick on each ability tap.
  - A pulse on getting hit.
  - A longer pulse on level-up.
- [ ] Disabling haptics silences all vibration immediately.

### Settings persistence
- [ ] Any change in the Mobile section survives a page reload.
- [ ] Desktop view (DevTools mobile-emulation off) does not render the Mobile section in Settings.

## Pass criterion

Every box checked on both a portrait iPhone emulation AND a landscape Pixel emulation.
