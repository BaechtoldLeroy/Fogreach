# Implementation Plan: Tone and Theme Polish

**Branch**: `main`
**Date**: 2026-05-14
**Spec**: `kitty-specs/051-tone-and-theme-polish/spec.md`

## Summary

Direct-on-main implementation (no WP split — content-polish work, ~310 LOC across 4 files). Shipped four of the five spec items in a single commit; the fifth (hub visual + audio atmosphere) was explicitly deferred to a follow-up issue due to asset dependencies.

Implementation reused existing systems wherever possible: the splash modals route through the `_ktPropagateScrollFactor`-mobile-safe pattern from 050/WP03; the lore-fragment additions plug into the existing event-spawn pool with the same drop weight; the skip-tutorial toggle uses the existing settings nested-key flow.

## Technical Context

**Language/Version**: JavaScript ES6+ (classic `<script>` tags, no module system)
**Primary Dependencies**: Phaser 3, `window.questSystem`, `window.tutorialSystem`, `window.i18n`
**Storage**: `localStorage` — `demonfall_settings_v1` for the skip toggle, `demonfall_seen_intro_splash` / `demonfall_seen_outro_splash` for one-shot splash gates
**Testing**: `node tools/runTests.js` — 251 baseline + no new tests this feature (UI-flow validation only)
**Target Platform**: Same as 050/051 — desktop browsers + mobile touch
**Performance Goals**: No new per-frame work — splashes are event-driven modals; lore fragments share the existing drop pool
**Constraints**: NO new mechanics, NO new sprites, NO new audio — pure content + UI polish on existing systems

## Constitution Check

| Gate | Verdict | Notes |
|---|---|---|
| TEST_FIRST | ✅ PASS | 251 tests still green. UI-flow changes lack unit-test coverage but no risky logic was added. |
| CLEAN_CODE | ✅ PASS | New methods (`_showIntroSplash`, `_showOutroSplash`, `_showSplashModal`) are flat helpers reusing existing patterns. |
| MINIMAL_TOOLING | ✅ PASS | No new dependencies. |
| MODULAR_SCENES | ✅ PASS | All work lives in existing scene/system modules. |
| Performance | ✅ PASS | Event-driven only — no per-frame cost. |

**Gate result: PASS**.

## Project Structure

```
js/
├── tutorialSystem.js              # MODIFIED — maybeAutoSkip respects window.__SKIP_TUTORIAL__
├── eventSystem.js                 # MODIFIED — 3 new Akt-1 lore fragments + i18n
├── scenes/
│   ├── SettingsScene.js           # MODIFIED — new gameplay.skipTutorial toggle + UI row
│   └── HubSceneV2.js              # MODIFIED — _showIntroSplash + _showOutroSplash + _showSplashModal helper, scheduled in create()
```

## Complexity Tracking

None.
