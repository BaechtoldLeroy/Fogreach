---
work_package_id: WP02
title: main.js Input Rewire
dependencies: [WP01]
requirement_refs:
- FR-004
- FR-005
- FR-008
- FR-009
- FR-010
- FR-012
- FR-013
- NFR-004
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks: [T008, T009, T010, T011, T012]
history:
- 2026-04-24 — Scaffolded during /spec-kitty.tasks
authoritative_surface: js/main.js
execution_mode: code_change
lane: planned
owned_files:
- js/main.js
---

# WP02 — main.js Input Rewire

## Objective

Route every input read in `js/main.js` through the `window.InputScheme` API that WP01 shipped. Add the Phaser key bindings for WASD and number keys 1-4. Replace direct QWER `JustDown` polling with `consumeAbilityTrigger`. Route the existing scene-level `pointerdown` left-click-attack handler through `getAimDirection` for direction and `shouldSuppressCombatInput` for the guard. HUD slot-badge labels read from `getSlotLabel` and re-render on `InputScheme.onChange`.

Classic-mode play must stay **bit-identical** to pre-feature behavior. The whole point of this WP is adding the new plumbing without regressions.

## Branch Strategy

- Planning / base: `main`
- Actual implementation base: `042-arpg-control-scheme-WP01` (stacked on WP01's branch)
- Merge target: `main`
- Run: `spec-kitty implement WP02 --base WP01`
- If `/spec-kitty.implement` reports a different `base_branch`, use that.

## Context

Prerequisites:
- WP01 merged → `window.InputScheme` exists and passes its unit tests
- `contracts/input-scheme-api.md` is the canonical API reference
- `data-model.md::SlotBinding` lists the scheme-to-key matrix

Existing code to read before editing:
- `js/main.js:904-957` — the current `create()` input-setup block (key bindings, scene-level listeners, SHUTDOWN cleanup)
- `js/main.js:1388-1420` — the current QWER ability-slot polling in `update()`
- `js/main.js:1940-2002` — `refreshSlotMappings` (HUD slot-badge renderer)
- Commit `ff91985` — the existing left-click-attack fallback at `js/main.js` (scene-level `pointerdown` handler added near the SHUTDOWN block)
- `js/main.js::handlePlayerAttack` reference — called from `update()`

## Subtasks

### T008 — Add Phaser key bindings for WASD and number keys 1-4

**Purpose**: Both schemes' keys exist simultaneously as Phaser `Key` objects. `InputScheme` decides which is authoritative per frame.

**Steps**:
1. In `js/main.js::create()`, locate the existing `cursors = this.input.keyboard.createCursorKeys()` block (around line 905).
2. Keep all existing bindings (arrow keys, Space, Q/W/E/R, F/I/K/O/J/M/P). Do not remove anything.
3. Add:
   ```js
   // ARPG-scheme bindings: live alongside Classic; InputScheme resolves per-frame.
   const wKeyMove  = this.input.keyboard.addKey('W');
   const aKey      = this.input.keyboard.addKey('A');
   const sKey      = this.input.keyboard.addKey('S');
   const dKey      = this.input.keyboard.addKey('D');
   const num1Key   = this.input.keyboard.addKey('ONE');
   const num2Key   = this.input.keyboard.addKey('TWO');
   const num3Key   = this.input.keyboard.addKey('THREE');
   const num4Key   = this.input.keyboard.addKey('FOUR');
   ```
   Note: `wKey` already exists as slot-2 ability key. Rename the NEW WASD-W variable to `wKeyMove` (or similar) to avoid shadowing. Both bind to the physical `W` — they're the same key; Phaser will hand both `isDown`/`JustDown` reads from the same internal key object, but having named accessors makes the intent explicit at call sites.
4. If the renaming is awkward, an alternative: don't create `wKeyMove`; reuse `wKey` for both WASD-movement and Classic slot-2. `InputScheme` reads the scheme flag per frame and either (classic) uses W as an ability slot trigger or (arpg) uses W as movement. Either pattern works — pick the one that reads clearly. Document the choice with a comment.

**Files**:
- `js/main.js` (edit — ~10 lines added in `create()`)

**Validation**:
- [ ] Page loads without error
- [ ] In Chrome devtools `performance` tab or equivalent: typing W/A/S/D and 1-4 fires Phaser keyup/keydown events (no "cannot find key" warnings from Phaser)
- [ ] Classic play is unchanged: W still triggers slot-2 ability, arrow keys still move

### T009 — Call InputScheme.init(this) and register shutdown teardown

**Purpose**: Hand the scene to `InputScheme` so it can read `activePointer.worldX/Y`, and clean up on scene shutdown.

**Steps**:
1. In `create()`, **after** all key bindings exist and **after** the `isMobile = ...` line, call:
   ```js
   if (window.InputScheme && typeof window.InputScheme.init === 'function') {
     window.InputScheme.init(this);
   }
   ```
2. The existing SHUTDOWN block (around line 948-957) already tears down keyboard listeners. Add to that block:
   ```js
   if (window.InputScheme && typeof window.InputScheme.teardown === 'function') {
     window.InputScheme.teardown();
   }
   ```
   If `teardown` wasn't declared in WP01's final API, coordinate with WP01 to add it (it's a trivial method — clears scene ref and subscribers for this scene). Otherwise, `init(scene)` is idempotent and will re-bind on the next scene boot, which is also acceptable.

**Files**:
- `js/main.js` (edit — 2 small additions)

**Validation**:
- [ ] In browser console after game starts: `window.InputScheme.getScheme()` returns the persisted value (or `'classic'` default)
- [ ] Going Hub → GameScene → Hub → GameScene does not leak listeners (check `this.events.listenerCount('update')` or similar)

### T010 — Rewire scene-level pointerdown handler through InputScheme

**Purpose**: The left-click-attack handler committed in `ff91985` currently uses bare `invOpen/playerDeathHandled/isReturningToHub` guards and hands a raw `attack.call(this)` (which internally uses `lastMoveDirection`). In ARPG we want the direction to come from the cursor. Route both the guard and the direction via `InputScheme`.

**Steps**:
1. Find the existing pointerdown block in `create()`:
   ```js
   if (!isMobile) {
     _mouseAttackHandler = (pointer, currentlyOver) => {
       if (pointer.button !== 0) return;
       if (invOpen || playerDeathHandled || isReturningToHub) return;
       if (Array.isArray(currentlyOver) && currentlyOver.length > 0) return;
       if (typeof attack === 'function') attack.call(this);
     };
     this.input.on('pointerdown', _mouseAttackHandler);
   }
   ```
2. Replace the manual guard chain with `InputScheme.shouldSuppressCombatInput()`:
   ```js
   if (window.InputScheme && window.InputScheme.shouldSuppressCombatInput()) return;
   ```
   Keep the `currentlyOver.length > 0` check — it's UI-hit-test specific and orthogonal to the combat suppression guard.
3. The actual direction passed to `attack` will be resolved **inside** `attack()` in WP03 (player.js reads `InputScheme.getAimDirection`). Here, simply ensure you no longer reference the classic-only guards; let the call chain through. No behavior change to Classic (its aim still comes from `lastMoveDirection` via InputScheme's classic branch).
4. Keep the mobile exclusion (`if (!isMobile)`) — InputScheme is desktop-focused.

**Files**:
- `js/main.js` (edit — ~5 lines changed inside `_mouseAttackHandler`)

**Validation**:
- [ ] Classic: left-click attacks in the direction of `lastMoveDirection` (unchanged behavior)
- [ ] ARPG (after scheme flipped via console or WP04's UI): left-click attacks toward the cursor
- [ ] Clicking an inventory slot or dialog button does NOT fire the attack (the `currentlyOver` + suppression guards hold)

### T011 — Route ability-slot polling in update() through consumeAbilityTrigger

**Purpose**: Replace the five hardcoded `Phaser.Input.Keyboard.JustDown(qKey / wKey / eKey / rKey)` blocks with a single loop calling `InputScheme.consumeAbilityTrigger(n)` for `n` in 1..4. Edge-triggered semantics must match (one ability fire per physical key press).

**Steps**:
1. Open `js/main.js::update()`. Find the current QWER polling around line 1388-1420:
   ```js
   if (Phaser.Input.Keyboard.JustDown(qKey)) { AbilitySystem.tryActivate('slot1', this); }
   if (Phaser.Input.Keyboard.JustUp(qKey))   { AbilitySystem.tryRelease('slot1', this); }
   if (wKey && Phaser.Input.Keyboard.JustDown(wKey)) { ... slot2 ... }
   ...
   ```
2. For press/activate: replace each with `consumeAbilityTrigger`:
   ```js
   for (let i = 1; i <= 4; i++) {
     if (window.InputScheme.consumeAbilityTrigger(i)) {
       window.AbilitySystem.tryActivate('slot' + i, this);
     }
   }
   ```
3. For release (charge-type abilities like Charged Slash):
   - WP01 should have shipped `consumeAbilityReleaseTrigger(slotIndex)` alongside the press trigger. If it didn't, coordinate with WP01 to add the mirrored release-edge API. If that's not feasible, keep the release path on raw key objects gated by scheme:
     ```js
     // Charged abilities need precise press+release detection. Keep scheme-aware manually.
     const scheme = window.InputScheme.getScheme();
     const releaseKey = scheme === 'classic' ? qKey : num1Key;
     if (Phaser.Input.Keyboard.JustUp(releaseKey)) {
       window.AbilitySystem.tryRelease('slot1', this);
     }
     // repeat for slots 2-4
     ```
   - Prefer the API approach; fall back to the inline scheme read only if WP01 didn't expose a release API.
4. Remove any now-dead code (orphaned `JustDown(qKey)` lines, etc.).

**Files**:
- `js/main.js` (edit — refactor ~15 lines of ability polling)

**Validation**:
- [ ] Classic: pressing Q/W/E/R triggers slots 1/2/3/4 exactly once per press (no repeat-fire while held)
- [ ] ARPG (after scheme flip): pressing 1/2/3/4 triggers the same slots
- [ ] Charged Slash (slot bound to a charge-type ability): press + hold + release still works in both schemes
- [ ] No orphaned references to `qKey`, `eKey`, `rKey` for the slot-trigger path (they may still exist as Phaser key objects; just ensure nothing polls them directly for ability activation)

### T012 — HUD slot-badge labels read getSlotLabel + subscribe to onChange

**Purpose**: The ability HUD currently hardcodes `{slot1: 'Q', slot2: 'W', ...}` in `refreshSlotMappings`. Switch to `InputScheme.getSlotLabel(n)` so the badges reflect the active scheme, and re-render when `setScheme` fires.

**Steps**:
1. Find `refreshSlotMappings` in `main.js` (around line 1942). The HUD tiles are built with fixed key labels in `buildTile(_, 'Q', 0x888888)` etc., and the `tile.keyText.text` is set to the key label.
2. Look further: the `buildTile` calls for Q/W/E/R at line 1934-1937:
   ```js
   slot1: buildTile(_HUD_T('hud.slot.empty'), 'Q', 0x888888),
   slot2: buildTile(_HUD_T('hud.slot.empty'), 'W', 0x888888),
   slot3: buildTile(_HUD_T('hud.slot.empty'), 'E', 0x888888),
   slot4: buildTile(_HUD_T('hud.slot.empty'), 'R', 0x888888)
   ```
   Change the literal `'Q'/'W'/'E'/'R'` to `InputScheme.getSlotLabel(n)` calls. Since `buildTile` is called at HUD-init time, also update `refreshSlotMappings` (or add a new helper `refreshSlotKeyLabels`) that sets `tile.keyText.setText(InputScheme.getSlotLabel(n))` for each slot.
3. In the same `create()` where you called `InputScheme.init`, subscribe to scheme changes and call the refresh on notification:
   ```js
   const _unsubInputScheme = window.InputScheme.onChange(() => {
     if (typeof window._refreshAbilityHUD === 'function') {
       window._refreshAbilityHUD();
     }
   });
   // and on SHUTDOWN:
   this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
     if (typeof _unsubInputScheme === 'function') _unsubInputScheme();
   });
   ```
   Make sure `_refreshAbilityHUD` also refreshes the key-label text (it may only refresh icon/name today — extend it if needed).
4. Note that SlotBinding keys for Classic match exactly what the HUD has today — Classic behavior is a no-op. ARPG is the case that exercises the new path.

**Files**:
- `js/main.js` (edit — ~20 lines touching HUD tile creation + SHUTDOWN cleanup)

**Validation**:
- [ ] Classic: HUD slot badges show `Q W E R`
- [ ] `window.InputScheme.setScheme('arpg')` in the console immediately switches HUD badges to `1 2 3 4` without a reload
- [ ] Flipping back to classic restores `Q W E R`
- [ ] Language switch (Settings) still re-renders slot *names* (not the key labels — those are scheme-scoped)

## Definition of Done

- [ ] All 5 subtasks complete with their validation checkboxes ticked
- [ ] Classic play is visually and behaviorally identical to pre-feature: arrows move, Space attacks, QWER triggers abilities, HUD shows Q/W/E/R. Run `quickstart.md` Part A.
- [ ] Toggling `setScheme('arpg')` via console: WASD moves, 1-4 trigger abilities, left-click attacks toward cursor, HUD shows 1/2/3/4. Run `quickstart.md` Parts B-C.
- [ ] `node tools/runTests.js` still passes its existing ratio
- [ ] `git diff` shows only `js/main.js` touched
- [ ] No console warnings ("key not found", "InputScheme undefined", "activePointer is null")

## Risks + Reviewer Guidance

| Risk | Mitigation |
|------|------------|
| Double-binding W (slot-2 ability AND movement) | Either use a single `wKey` with scheme-aware dispatch (cleanest) or two named references pointing to the same Phaser key object. Document the choice in a code comment. |
| `consumeAbilityTrigger` edge semantics differ from the current `JustDown` | Validate with a pressed-and-held Q key — should trigger once, not every frame. If WP01's implementation is off, fix WP01 rather than patching here. |
| Charge-type abilities break when released via InputScheme | WP01 ideally ships `consumeAbilityReleaseTrigger`. If not, the fallback inline scheme check is acceptable but document it as tech debt for a follow-up. |
| `isMobile` check misses edge cases | The existing logic (`this.sys.game.device.input.touch`) is fine. Don't change it here. |
| HUD labels flash during scheme switch | Scheme-switch is user-initiated and rare; one-frame flash is acceptable. If visually jarring, tween the text color. Out of scope for this WP. |

**For the reviewer**: diff `js/main.js` against `main`. Every change should map 1:1 to these subtasks. Grep the file for any remaining `JustDown(qKey)` / `cursors.left.isDown` / etc. — those are leaks of the old scheme and should be gone *except* where Classic explicitly polls them via InputScheme's internal primitives.

## Next Step

WP03 (player.js) and WP04 (Settings) can proceed in parallel with this WP. WP04 in particular unlocks user-facing scheme switching (instead of console commands).
