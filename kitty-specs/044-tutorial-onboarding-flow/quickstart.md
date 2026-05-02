# Quickstart: Tutorial Onboarding Flow

**Feature**: 044-tutorial-onboarding-flow
**Audience**: A developer joining mid-implementation who needs to run the tutorial code locally.

## Prerequisites

- Node ≥ 18 (for `node:test`)
- Browser (Chrome/Firefox/Edge)
- Repo at `C:\Users\LeroyBächtold\Documents\Demonfall` (or your local clone)

## 1. Run the unit tests

```powershell
npm test
```

This runs `node tools/runTests.js`, which executes every `tests/*.test.js`. The new file `tests/tutorialSystem.test.js` is part of that sweep. All ~15 tutorial tests should pass green.

## 2. Run the smoke test (optional but recommended)

```powershell
npm run test:smoke
```

This launches Playwright against the local server, picks a loadout, and walks the game briefly. Use it after touching scene wiring to confirm no regressions.

## 3. Launch the game in the browser

```powershell
npx serve .
```

Open the printed URL (typically `http://localhost:3000`).

### Verify a fresh-player flow

1. Open browser DevTools → Application → Local Storage → site origin.
2. Delete any keys starting with `demonfall_` (especially `demonfall_save_v1` and `demonfall_tutorial_v1`).
3. Reload the page → click **New Game**.
4. You should see a banner: `WASD zum Bewegen` (or English equivalent if language is `en`).
5. Move the player → banner advances to `Geh zur Werkstatt` and the Werkstatt entrance pulses with an outline.
6. Walk through the rest of the 12 steps; total ~10–15 minutes for a deliberate run.

### Verify auto-skip

1. With a completed save in `demonfall_save_v1`, delete only `demonfall_tutorial_v1`.
2. Click **New Game** (or **Continue**).
3. No banner should appear at any point.

### Verify replay

1. Open Settings → click **Tutorial neu starten** → confirm.
2. Return to hub. Banner should appear at step 2 (movement) again.
3. Inventory and save remain untouched.

## 4. Where to look in the code

| Concern                          | File                                          |
|----------------------------------|-----------------------------------------------|
| State machine                    | `js/tutorialSystem.js`                        |
| Banner + highlight rendering     | `js/scenes/tutorialOverlay.js`                |
| Auto-skip on New Game            | `js/scenes/StartScene.js`                     |
| Event reports (hub)              | `js/scenes/HubSceneV2.js`                     |
| Event reports (combat/loot)      | `js/scenes/GameScene.js`, `js/abilitySystem.js`, `js/lootSystem.js` |
| Settings UI (skip, replay)       | `js/scenes/SettingsScene.js`                  |
| Druckerei stub line              | `js/scenes/hub/hubLayout.js` (Setzer Thom)    |
| i18n strings                     | `js/tutorialSystem.js` (registered at IIFE load) |
| Unit tests                       | `tests/tutorialSystem.test.js`                |

## 5. Persistence keys touched

- `demonfall_tutorial_v1` — owned exclusively by `tutorialSystem`.
- **Not** touched: `demonfall_save_v1`, `demonfall_settings_v1`, ability/difficulty keys.

## 6. Common debugging entry points

- In the browser console: `TutorialSystem.getCurrentStep()` returns the current descriptor.
- `TutorialSystem.replay()` to restart from the first visible step.
- `TutorialSystem.skip(true)` to dismiss immediately.
- `localStorage.removeItem('demonfall_tutorial_v1')` to wipe persisted state.
