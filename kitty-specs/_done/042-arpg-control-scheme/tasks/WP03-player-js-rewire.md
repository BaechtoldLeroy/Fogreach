---
work_package_id: WP03
title: player.js Input Rewire + Sprite Facing
dependencies: [WP01]
requirement_refs:
- FR-004
- FR-005
- FR-006
- FR-007
- FR-009
- NFR-002
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 042-arpg-control-scheme-WP01
base_commit: 35fa4b61b4783bf6e25c1ae2dcd5c7cdaf8bb033
created_at: '2026-04-24T16:32:20.101543+00:00'
subtasks: [T013, T014, T015, T016, T017]
shell_pid: "31488"
history:
- 2026-04-24 — Scaffolded during /spec-kitty.tasks
authoritative_surface: js/player.js
execution_mode: code_change
lane: planned
owned_files:
- js/player.js
---

# WP03 — player.js Input Rewire + Sprite Facing

## Objective

Route movement, basic-attack triggering, and every offensive-ability aim vector in `js/player.js` through `window.InputScheme`. In ARPG mode, the player sprite faces the cursor (via `getDirectionFromVelocity(aim.x, aim.y)` into the existing 8-octant `dir00..dir07` system). `lastMoveDirection` is still maintained in both schemes — it backs Classic's aim and the ARPG dead-zone fallback.

This WP is the "aim decoupling" work. The Classic-mode output must be bit-identical; the ARPG-mode output must hit every requirement from FR-005 through FR-009 and match Edge Cases EC-1, EC-2.

## Branch Strategy

- Planning / base: `main`
- Actual implementation base: `042-arpg-control-scheme-WP01` (stacked on WP01)
- Merge target: `main`
- Run: `spec-kitty implement WP03 --base WP01`

## Context

Prerequisites:
- WP01 merged → `window.InputScheme.getMovementInput()`, `.isBasicAttackTriggered()`, `.getAimDirection(scene, player)` are all available
- `contracts/input-scheme-api.md` — canonical API
- `data-model.md::AimVector` — `{x, y, source}` shape

Existing code to read before editing:
- `js/player.js:25-42` — `PLAYER_DIRECTION_SEQUENCE` + `PLAYER_DIRECTION_LOOKUP`
- `js/player.js:392-414` — `getDirectionFromVelocity(vx, vy, fallbackDd)`
- `js/player.js:447-485` — `updatePlayerSpriteAnimation(sprite, vx, vy)`
- `js/player.js:985-1095` — `updatePlayerMovement` (the `cursors.left.isDown` reads + `lastMoveDirection.set(...)` calls + joystick handling)
- `js/player.js:1098-1102` — `handlePlayerAttack`
- `js/player.js:1104-1128` — `showAttackEffect` (uses `lastMoveDirection.angle()`)
- `js/player.js:1208+` — `attack()`, plus the ability functions called from elsewhere: `spinAttack`, `beginChargedSlash`, `releaseChargedSlash`, `dashSlash`, `daggerThrow`, `shieldBash`, `_fireBowArrow`. Each reads `lastMoveDirection` to compute a direction vector or angle.

## Subtasks

### T013 — Route movement via InputScheme.getMovementInput

**Purpose**: The core per-frame movement read moves from direct `cursors.*.isDown` polling to `InputScheme.getMovementInput()`. Joystick and tap-to-move paths stay unchanged (they're for mobile/touch, orthogonal to the scheme).

**Steps**:
1. Open `js/player.js::updatePlayerMovement` (starts ~line 985).
2. Find the four `cursors.*.isDown` reads around line 994-997:
   ```js
   let vx = 0, vy = 0;
   if (cursors.left.isDown)  vx -= 1;
   if (cursors.right.isDown) vx += 1;
   if (cursors.up.isDown)    vy -= 1;
   if (cursors.down.isDown)  vy += 1;
   ```
3. Replace with:
   ```js
   let vx = 0, vy = 0;
   if (window.InputScheme && typeof window.InputScheme.getMovementInput === 'function') {
     const mv = window.InputScheme.getMovementInput();
     vx = mv.x;
     vy = mv.y;
   } else {
     // defensive fallback — InputScheme should always be present in this build
     if (cursors.left.isDown)  vx -= 1;
     if (cursors.right.isDown) vx += 1;
     if (cursors.up.isDown)    vy -= 1;
     if (cursors.down.isDown)  vy += 1;
   }
   ```
   The defensive fallback keeps the game playable if `inputScheme.js` fails to load for some reason (defense in depth). InputScheme in classic mode polls the exact same `cursors.*.isDown` under the hood.
4. The rest of the function (speed multipliers, attack-commit weight, joystick override, tap-to-move, smoothed velocity) is unchanged.
5. Ensure `lastMoveDirection.set(...)` still runs in both the keyboard and joystick paths — it's now critical because InputScheme reads it as the Classic aim source AND the ARPG dead-zone fallback.

**Files**:
- `js/player.js` (edit — ~10 lines in `updatePlayerMovement`)

**Validation**:
- [ ] Classic: all four arrow-key directions still move the player at the correct speed
- [ ] ARPG (after scheme flip): W/A/S/D move the player at the correct speed; arrow keys are silent
- [ ] Joystick (mobile) still works — the scheme doesn't affect the mobile path
- [ ] `lastMoveDirection` still updates in both schemes (verify via `console.log(window.lastMoveDirection)` after a few movement inputs)

### T014 — handlePlayerAttack uses InputScheme.isBasicAttackTriggered

**Purpose**: The Space-triggered basic attack becomes InputScheme-gated. Its internal logic is unchanged.

**Steps**:
1. Find `handlePlayerAttack` at `js/player.js:1098-1102`:
   ```js
   function handlePlayerAttack() {
     if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
       attack.call(this);
     }
   }
   ```
2. Replace with:
   ```js
   function handlePlayerAttack() {
     if (window.InputScheme && window.InputScheme.isBasicAttackTriggered()) {
       attack.call(this);
     }
   }
   ```
3. `isBasicAttackTriggered` already includes the suppression guard (via `shouldSuppressCombatInput`), so any redundant local `invOpen` / death checks can be deleted if they exist in this function. (Based on current code, no redundancy exists.)
4. This path now picks up left-mouse-click implicitly (WP01's InputScheme already fires on LMB via the scene-level pointerdown coordination with WP02). So `handlePlayerAttack` fires for both Space and LMB in both schemes — matches FR-010.

**Files**:
- `js/player.js` (edit — 3 lines)

**Validation**:
- [ ] Classic: Space → attack; LMB → attack (unchanged — WP02 handler still delivers); repeat-press → multiple attacks
- [ ] ARPG: Space → attack; LMB → attack toward cursor (direction is resolved in T015)

### T015 — Rewire all ability direction reads to InputScheme.getAimDirection

**Purpose**: Every function that currently reads `lastMoveDirection.x/y` or `lastMoveDirection.angle()` to compute a direction for an attack/projectile/arc must switch to `InputScheme.getAimDirection(scene, player)`. In Classic, InputScheme returns `lastMoveDirection` (backward compatible). In ARPG, it returns the cursor-based aim.

**Steps**:
1. Enumerate the call sites (grep `lastMoveDirection` in `js/player.js`, excluding the *writes* inside `updatePlayerMovement`). Expected call sites:
   - `attack()` (melee swing)
   - `showAttackEffect(scene, options)` — reads `lastMoveDirection.angle()` for the arc orientation
   - `spinAttack(scene)` — likely uses `lastMoveDirection` for nothing (spin is radial); verify
   - `beginChargedSlash(scene)` — reads direction at charge start
   - `releaseChargedSlash(scene)` — reads direction at release (ARPG benefit: aim can change during charge)
   - `dashSlash(scene)` — reads direction for dash vector
   - `daggerThrow(scene)` — reads direction for projectile launch
   - `shieldBash(scene)` — reads direction for push vector
   - `_fireBowArrow(scene)` — reads direction for arrow trajectory
2. For each, add near the top of the function:
   ```js
   const aim = (window.InputScheme && typeof window.InputScheme.getAimDirection === 'function')
     ? window.InputScheme.getAimDirection(scene, player)
     : { x: lastMoveDirection.x, y: lastMoveDirection.y, source: 'movement' };
   ```
3. Replace every `lastMoveDirection.x` / `.y` / `.angle()` inside the function with the equivalent read from `aim`:
   - `.x` → `aim.x`
   - `.y` → `aim.y`
   - `.angle()` → `Math.atan2(aim.y, aim.x)`
4. Do NOT change the `lastMoveDirection.set(...)` calls inside `updatePlayerMovement` — those are writes and remain the Classic source-of-truth.
5. `spinAttack` has a radial (360°) AoE pattern; it probably doesn't need `aim` at all. If so, don't touch it — just annotate with a brief comment that spin is aim-agnostic.

**Files**:
- `js/player.js` (edit — ~40 lines across 7-8 functions)

**Validation**:
- [ ] Classic: every ability swings/shoots/dashes in the same direction as the last movement (as before)
- [ ] ARPG: every ability swings/shoots/dashes toward the cursor, regardless of movement direction
- [ ] Charged Slash: start charging (W or 2), move the cursor to a new position, release — projectile goes in the *new* direction (aim is re-read at release)
- [ ] Bow: fires arrows toward the cursor in ARPG; toward movement in Classic

### T016 — updatePlayerSpriteAnimation facing uses aim in ARPG

**Purpose**: In ARPG mode, the sprite should face the cursor (not the movement direction). Reuse `getDirectionFromVelocity` with the aim vector.

**Steps**:
1. Find `updatePlayerSpriteAnimation(sprite, vx = 0, vy = 0)` at `js/player.js:447`.
2. Current logic: `const direction = moving ? getDirectionFromVelocity(vx, vy, state.direction || PLAYER_DEFAULT_DD) : (state.direction || PLAYER_DEFAULT_DD);`
3. Enrich with scheme awareness:
   ```js
   const scheme = window.InputScheme ? window.InputScheme.getScheme() : 'classic';
   let facingInput = { x: vx, y: vy };
   if (scheme === 'arpg' && window.InputScheme && typeof window.InputScheme.getAimDirection === 'function') {
     const aim = window.InputScheme.getAimDirection(sprite.scene, sprite);
     // Only override facing with aim if aim is "real" (from cursor, not dead-zone fallback)
     if (aim && aim.source === 'cursor') {
       facingInput = { x: aim.x, y: aim.y };
     }
   }
   const direction = (moving || scheme === 'arpg')
     ? getDirectionFromVelocity(facingInput.x, facingInput.y, state.direction || PLAYER_DEFAULT_DD)
     : (state.direction || PLAYER_DEFAULT_DD);
   ```
4. Why `moving || scheme === 'arpg'`: in ARPG, we want the sprite to turn toward the cursor even when standing still (idle but aiming). Classic keeps the original "face movement direction" behavior when moving; when idle, keeps the last direction — unchanged.
5. The walk animation still uses the movement vector for playback (`walk_${direction}` where `direction` is now the facing dir). If the player walks backward (say, moving west with aim east), the sprite will play the east-walk animation while the position translates west. This is the intended D2-style behavior — confirm it looks reasonable; if not, decide whether to play the movement-direction animation while holding facing-direction tinted frame.
6. Simpler alternative: in ARPG, always override `direction = facingInput direction` for the displayed frame but use `vx, vy` for the walk animation key. That would show the cursor-facing idle pose while moving.

**Files**:
- `js/player.js` (edit — ~15 lines in `updatePlayerSpriteAnimation`)

**Validation**:
- [ ] Classic: sprite faces movement direction (unchanged)
- [ ] ARPG: sprite faces the cursor when idle AND when moving
- [ ] ARPG + cursor inside dead-zone: sprite keeps last facing, no jitter (EC-1)
- [ ] ARPG: all 8 octants visibly tested by circling the cursor around the player
- [ ] Walking backward (move W, aim E) still plays a walk animation — verify it reads natural

### T017 — Verify lastMoveDirection invariant + inline comment

**Purpose**: Document the contract so future changes don't break the aim chain.

**Steps**:
1. At the top of `updatePlayerMovement` (or above the `lastMoveDirection.set(...)` call), add a comment:
   ```js
   // `lastMoveDirection` is the movement unit vector last observed.
   // It is the Classic-scheme aim source-of-truth AND the ARPG dead-zone
   // fallback for `InputScheme.getAimDirection`. Do not stop updating it
   // across scheme changes — both schemes rely on it.
   ```
2. Smoke-check paths where `lastMoveDirection` is read *outside* ability functions (grep again):
   - `showAttackEffect` — already covered by T015's edits
   - HUD/debug display (if any) — leave alone
3. Ensure `lastMoveDirection` is initialized to a non-zero value at scene boot. If it starts at `(0, 0)`, `getAimDirection` in Classic returns `(1, 0)` as per the invariant (seeded in WP01's state).

**Files**:
- `js/player.js` (edit — one comment block; possibly a default init if missing)

**Validation**:
- [ ] Grep `lastMoveDirection` in player.js — all *writes* remain; all *reads* that feed ability direction have been replaced (writes in `updatePlayerMovement`, reads in ability fns via `aim`)
- [ ] EC-1 edge case passes: start game, do not move, move cursor onto player in ARPG — sprite doesn't twitch

## Definition of Done

- [ ] All 5 subtasks complete with validation ticked
- [ ] Classic play is visually and behaviorally identical: same movement, same attack directions, same sprite facing. Run `quickstart.md` Part A.
- [ ] ARPG play: kiting works (PF-2), sprite rotates with cursor (FR-007), all 6+1 abilities aim via cursor (FR-006). Run `quickstart.md` Part C + Part F.
- [ ] EC-1 (cursor on player, no jitter) and EC-2 (mouse left window, last aim retained) both pass visually
- [ ] `node tools/runTests.js` still passes
- [ ] `git diff` shows only `js/player.js` touched

## Risks + Reviewer Guidance

| Risk | Mitigation |
|------|------------|
| Backward-walking animations look off | D2 lives with this. If uncomfortable, option in a follow-up to play the movement-direction animation while the facing frame comes from aim. Out of scope for this WP. |
| Idle ARPG with cursor inside dead-zone: sprite stuck | `state.lastAim` seeds from `(1, 0)` or from the first post-init movement. Worst case: first ever frame shows the default facing. Acceptable. |
| Charged Slash ambiguity: aim at charge-start vs release | Spec says cursor drives aim — so latest aim wins. Release reads `getAimDirection` afresh. Confirm this behavior matches the expected feel; if players want "commit aim at start", reconsider in QA. |
| `lastMoveDirection` zero before any input | InputScheme's fallback handles this (returns `(1, 0)`). Don't patch it in player.js. |
| `getAimDirection` called with null scene (pre-init) | InputScheme's guard must handle this (WP01 responsibility). Reviewer should spot-check: on game load, the first frame shouldn't throw. |

**For the reviewer**: grep `lastMoveDirection.x`, `.y`, `.angle(` in the diff. Every remaining read should be either the Classic-branch fallback inside the ternary, or a write. Play the game in both schemes for ~5 minutes, covering all abilities.

## Next Step

After this WP and WP02, ARPG is fully functional via console `setScheme`. WP04 adds the user-facing Settings picker.
