---
work_package_id: WP05
title: Haptics + Mobile settings section
dependencies: []
requirement_refs: [FR-013, FR-014, FR-015]
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 021-mobile-control-optimization-WP01
base_commit: bef362b3c0a28afa183be4e518751b03b1b737b6
created_at: '2026-04-15T20:05:20.237784+00:00'
subtasks: [T001, T002, T003, T004, T005]
shell_pid: "52552"
history:
- action: created
  agent: claude
  utc: '2026-04-15T14:00:00Z'
authoritative_surface: js/
execution_mode: code_change
lane: planned
owned_files:
- js/haptics.js
- js/scenes/SettingsScene.js
---

# WP05 — Haptics + Mobile settings section

## Objective

Add short, tasteful haptic feedback for mobile taps/hits/damage/level-up, and surface all mobile control preferences (dead zone, haptics, auto-aim, button scale) in the existing SettingsScene under a new "MOBILE" section that only renders on mobile.

## Context

Haptics wiring is purely additive: a small `haptics.js` module that no-ops where unsupported, listens to the same `CustomEvent` bus WP01 established, and dispatches `navigator.vibrate()` calls.

Settings plumbing follows the existing `DEFAULTS` / `applySettings()` pattern in `js/scenes/SettingsScene.js`. Populating `window.__MOBILE_*` globals on boot is how WP03 and WP04 read their live values.

## Subtasks

### T001 — Create `js/haptics.js`

**Purpose**: Thin wrapper with sensible defaults and a toggleable kill-switch.

**Steps**:
1. Define four functions:
   ```js
   function tap()      { _vibrate(10); }
   function hit()      { _vibrate(25); }
   function damage()   { _vibrate(50); }
   function levelUp()  { _vibrate([30, 30, 80]); }
   ```
2. `_vibrate(pattern)` checks `window.__MOBILE_HAPTICS__` and `typeof navigator.vibrate === 'function'` before firing. Silent no-op otherwise.
3. Export under `window.Haptics = { tap, hit, damage, levelUp }`.

**Files**: `js/haptics.js` (new, ~50 lines).

**Validation**: On a vibration-capable device with haptics ON, `window.Haptics.tap()` triggers a short buzz.

### T002 — Wire haptics to event bus

**Purpose**: React to taps, hits, damage, level-up without editing far-flung files.

**Steps**:
1. Listen for `demonfall:ability-tap` → `Haptics.tap()`.
2. Listen for `demonfall:player-hit-connect` → `Haptics.hit()`.
3. Listen for `demonfall:player-damaged` → `Haptics.damage()`.
4. Listen for `demonfall:level-up` → `Haptics.levelUp()`.
5. **CustomEvent contract for upstream**: these four events must be emitted by existing code. If they don't exist yet, add dispatch calls in existing hit/damage/level-up code paths as minimal glue inside THIS WP. Since `player.js` is owned by WP03 and combat files aren't owned by anyone, consolidate glue emits into a small shim you add in `haptics.js` using a `MutationObserver`-free hook pattern: subscribe to existing Phaser events if present (e.g. `scene.events.on('player-hit', ...)`), else leave TODO markers and file a follow-up.

> If adding emit-calls cross-file is blocked by ownership, scope this WP to the two events WP01 already emits (`ability-tap`, `ability-release`) and file the other three emits as a follow-up WP. This is an acceptable MVP.

**Files**: `js/haptics.js` (subscribes at window load).

**Validation**: Tapping a button on a vibration device produces a tick.

### T003 — Extend SettingsScene DEFAULTS + applySettings

**Purpose**: Persist and apply the four mobile settings.

**Steps**:
1. Extend `DEFAULTS`:
   ```js
   mobile: {
     deadZone: 0.15,
     haptics: true,
     autoAim: true,
     buttonScale: 1.0
   }
   ```
2. Extend `applySettings(settings)`:
   ```js
   const m = settings.mobile || DEFAULTS.mobile;
   window.__MOBILE_DEAD_ZONE__   = Math.max(0, Math.min(0.4, m.deadZone));
   window.__MOBILE_HAPTICS__     = !!m.haptics;
   window.__MOBILE_AUTO_AIM__    = !!m.autoAim;
   const scaleChoices = [0.8, 1.0, 1.2];
   window.__MOBILE_BUTTON_SCALE__ = scaleChoices.includes(m.buttonScale) ? m.buttonScale : 1.0;
   ```
3. Update the `loadSettings` merge to include `mobile` alongside `debug`.

**Files**: `js/scenes/SettingsScene.js`.

**Validation**: Setting values survive reload. `window.__MOBILE_*` globals reflect stored values on boot.

### T004 — Render "MOBILE" section in SettingsScene

**Purpose**: FR-015 — expose controls in the UI, mobile-only.

**Steps**:
1. Inside `create()`, after the existing DEBUG section, check `isMobile` (read from `window.isMobile` or `this.sys.game.device.input.touch`).
2. If mobile, add a `_sectionLabel('MOBILE')` and rows:
   - `_volumeRow` adapted for `mobile.deadZone` (0.00–0.40 in 0.05 steps — extend `_volumeRow` to accept `step` and `max` or add a new `_sliderRow`).
   - `_toggleRow('Haptics', 'mobile.haptics', ...)`.
   - `_toggleRow('Auto-Aim', 'mobile.autoAim', ...)`.
   - A new `_pickerRow('Button-Groesse', 'mobile.buttonScale', [0.8, 1.0, 1.2])` that cycles through options on click.
3. When desktop, skip the section entirely.

**Files**: `js/scenes/SettingsScene.js`.

**Validation**: Mobile emulation shows the section; desktop does not. Every row updates its backing setting immediately.

### T005 — Verify persistence + live application

**Purpose**: Regression check.

**Steps**:
1. Flip every setting, reload, confirm it persists.
2. Confirm the live globals update without a reload for at least Haptics and Auto-Aim (Button Scale may require scene restart — document that in the UI hint text).

**Files**: `js/scenes/SettingsScene.js` (add hint text).

**Validation**: From the acceptance checklist in `quickstart.md`.

## Definition of Done

- Four haptic events fire correctly where wired (at minimum `ability-tap`).
- Settings persist; globals reflect stored values; "MOBILE" section only shows on mobile.
- No desktop regression.

## Risks

- Cross-file event emits (hit / damage / level-up) may require glue that overlaps with other WPs' ownership. See T002 guidance — MVP ships with just the `ability-tap` hook and files a follow-up if ownership blocks us.
- `navigator.vibrate` is not supported on iOS Safari; feature degrades gracefully (silent no-op).

## Reviewer guidance

- Two files only: `js/haptics.js` (new), `js/scenes/SettingsScene.js` (edited).
- Confirm desktop still renders the existing two sections unchanged.

## Implementation command

```
spec-kitty implement WP05 --base WP01
```
