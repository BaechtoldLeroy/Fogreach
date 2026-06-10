# Quickstart: ARPG Control Scheme

Manual acceptance script. Run after all WPs land and before merging to `main`. Each step maps back to a spec requirement or user scenario.

## Preconditions

- Working desktop browser (Chrome, Firefox, Edge, or Safari).
- Local dev server serving the project root on port 5173 (`npx serve -l 5173 .` or equivalent).
- Fresh localStorage for at least one run (clear `demonfall_settings_v1` or use a private window).

## Steps

### Part A — Classic regression (no scheme change)

1. Open `http://localhost:5173`.
2. Start a new game. Confirm: movement on arrow keys, attack on Space, abilities on Q/W/E/R all behave exactly as they did pre-feature.
   - **Covers**: FR-004, SC-1.
3. In the HUD, the ability slot badges show `Q / W / E / R`.
   - **Covers**: FR-012.
4. Open settings (O). Confirm: no errors thrown; language picker still works.
5. Close settings (no scheme change). Play for ~1 minute with basic and advanced abilities. No regressions.

### Part B — Switch to ARPG

6. Open settings again (O). Find the **Control Scheme** picker — should show `Classic` (active) and `ARPG`.
7. Click / tap `ARPG`. Close settings.
   - **Covers**: FR-001, FR-003, NFR-001.
8. HUD slot badges update to `1 / 2 / 3 / 4` (no reload required).
   - **Covers**: FR-012 live-update.

### Part C — ARPG happy path

9. Move with WASD. Arrow keys should no longer move the player (they're silent).
   - **Covers**: FR-005.
10. Hover mouse to the right of the player. Player sprite faces right (dir04).
11. Hold W+A (up-left), left-click. Player attacks in the direction of the cursor, not in the up-left movement direction.
    - **Covers**: PF-3, FR-006, FR-009, EC-3-avoidance.
12. Press 1, 2, 3, 4 in order. Each ability in the respective slot activates (assuming slots are filled).
    - **Covers**: FR-008.
13. Press Space while moving. A basic attack fires in cursor direction.
    - **Covers**: FR-010.

### Part D — ARPG edge cases

14. Move cursor to sit exactly on top of the player sprite. Face direction does **not** twitch randomly. Sprite retains last facing.
    - **Covers**: EC-1.
15. Alt-tab out of the window while in ARPG. Return. Sprite still faces its last known direction until next mouse move.
    - **Covers**: EC-2.
16. Open inventory (I) while cursor is in the play field. Click inventory items — no attack fires.
    - **Covers**: EC-5, FR-013.
17. Open the loadout overlay (K). Press `1` — no ability triggers (UI is focused).
    - **Covers**: FR-013.

### Part E — Persistence + localization

18. Reload the browser. ARPG is still active (persistent setting).
    - **Covers**: FR-002, NFR-001.
19. Open settings, switch language DE ↔ EN. Both scheme names in the picker localize; HUD slot tooltips (if any) stay correct.
    - **Covers**: SC-4.
20. Switch back to Classic. Movement reverts to arrow keys, attack to Space. HUD badges return to Q/W/E/R.

### Part F — Ranged kiting acceptance

21. Equip a bow. Switch to ARPG. Aggro an archer enemy. Move **away** from the archer (W) while aiming **at** the archer (mouse). Fire arrows with left click.
22. Observe: player moves up, arrows fly in cursor direction at the pursuing archer.
    - **Covers**: PF-2, main motivational use-case.

### Part G — Mobile sanity (if hardware available)

23. Open `http://localhost:5173` on a touch device. Open settings.
24. The control-scheme picker is hidden.
    - **Covers**: FR-014, SF-2.
25. Touch controls (joystick + buttons) function unchanged.

## Exit criteria

- All 25 steps pass.
- No console errors observed.
- Existing unit test suite (`node tools/runTests.js`) reports 112/113 (same preexisting failure as before) — no new regressions.

## Rollback plan

If a blocker is found post-merge:

1. Revert the WP07 (or latest) merge commit that enabled the picker.
2. `setControlScheme('classic')` in every session via `localStorage.setItem('demonfall_settings_v1', JSON.stringify({...existing, controlScheme: 'classic'}))` as a hotfix advisory.
3. No data migration is needed — existing saves are untouched.
