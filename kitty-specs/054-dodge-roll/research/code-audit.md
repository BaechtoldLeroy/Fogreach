# 054 Dodge Roll — Code Audit

Pre-spec/plan reconnaissance for the Shift-Dodge-Roll feature. All file paths
are absolute. File:Line references are stable as of commit `a33a7bb`.

---

## 1. Input-Handling-Audit

### Classic vs ARPG scheme (js/inputScheme.js)

`window.InputScheme` is the single dispatcher. Two schemes:
- **classic**: Arrow keys move, Q/W/E/R = ability slots 1-4, Space + LMB = basic attack.
- **arpg**: WASD move, 1/2/3/4 = ability slots 1-4, LMB (cursor aim) = basic attack.

Public surface (`js\inputScheme.js:334-351`):
- `init(scene)` / `teardown()` — wire/unwire scene-keyed primitives
- `getScheme()` / `setScheme()` / `onChange(cb)`
- `getMovementInput()` → `{x,y}` raw input vector (not normalized)
- `isBasicAttackTriggered()` — edge-triggered, consumes Space + LMB flag
- `markPrimaryButtonJustDown()` — main.js pointerdown sets this after UI hit-test
- `consumeAbilityTrigger(slotIndex)` / `consumeAbilityReleaseTrigger(slotIndex)`
- `getSlotLabel(slotIndex)` — returns `'Q'`/`'1'` per scheme for HUD
- `getAimDirection(scene, player)` — `{x,y,source}` for facing; movement-based
  in classic, cursor-based in ARPG (dead-zone 20px)
- `shouldSuppressCombatInput()` — `invOpen || playerDeathHandled || isReturningToHub`

Key bindings registered eagerly in `_makeProductionPrimitives` at
`js\inputScheme.js:59-76`. Phaser `addKey()` is idempotent (safe to call
again for SHIFT). All keys go through one `primitives.getKeyDown`/
`isKeyJustDown`/`isKeyJustUp` indirection — clean place to add a `shift` entry.

### Ability key dispatch (js/main.js)

In `update()` at `js\main.js:1540-1564`:

```js
for (let slot = 1; slot <= 4; slot++) {
  if (window.InputScheme.consumeAbilityTrigger(slot)) {
    window.AbilitySystem.tryActivate('slot' + slot, this);
  }
  if (window.InputScheme.consumeAbilityReleaseTrigger(slot)) {
    window.AbilitySystem.tryRelease('slot' + slot, this);
  }
}
```

This is the canonical "edge press + edge release" pattern to copy for dodge.

### Basic-attack trigger

- Space — `js\inputScheme.js:247` via `JustDown(space)` inside `isBasicAttackTriggered`
- LMB — `js\main.js:1003-1016` `_mouseAttackHandler` sets `markPrimaryButtonJustDown()`;
  it skips if `currentlyOver.length > 0` (UI hit-test), if combat input is
  suppressed, or if `pointer.button !== 0`.
- Both paths funnel through `handlePlayerAttack` at `js\player.js:1178-1190`.

### SHIFT availability — IMPORTANT

`js\main.js:2409` has `spinKey = this.input.keyboard.addKey('SHIFT');` — but
`spinKey` is **never declared in `let`** (only `cursors, spaceKey, rKey, eKey,
qKey, wKey` at line 387). The reference is a leftover and the SHIFT key
is **never actually polled anywhere**. Treat `SHIFT` as free for dodge.

Other reserved keys (must NOT clash):
- Movement: arrows + WASD (Hub also re-uses these via InputScheme)
- Combat: Space, LMB, Q/W/E/R (classic), 1/2/3/4 (arpg), F (potion)
- UI: I (inventory), J (journal), K (loadout), M (shop), O (settings), P (perf), TAB (minimap), ESC (close)
- Hub-only: E (interact NPC)
- Workshop: UP/DOWN, ENTER, SPACE, R

Browser-tab convention: `Shift+Tab` and `Shift+arrow` are platform shortcuts —
fine while focus is on the canvas, but a roll bound to `keydown-SHIFT`
(modifier-only) needs to ignore the `shiftKey` set on **other** keys to avoid
double-firing on Shift+Tab.

### Suggested Shift registration pattern

Two options, both inside `js\inputScheme.js`:

1. **Add `shift` to `keys` table** (`js\inputScheme.js:68`), expose
   `isDodgeRollTriggered()` / `consumeDodgeRollTrigger()` that calls
   `isKeyJustDown('shift')`. Mirrors the `isBasicAttackTriggered` pattern.
   Then poll it from `js\main.js:1540` block right beside the slot dispatch.

2. Add a fully generic `consumeUtilityTrigger('dodge')` that maps `'dodge'`
   to SHIFT via a small action table — future-proof if more bindings come.

Pattern #1 is the minimum-blast-radius choice. Cleanup is automatic
(InputScheme has its own teardown at `js\inputScheme.js:147`); no scene-level
keydown listener registration/unregistration needed.

---

## 2. Player-Movement-Audit

### Position / velocity (js/player.js)

- Movement reads input via `InputScheme.getMovementInput()` (`js\player.js:1067-1077`).
- Computes normalized direction × `effectiveSpeed`, then funnels through
  `_applySmoothedVelocity(targetVx, targetVy, scene)` at `js\player.js:1010-1049`
  which writes `player.setVelocity(...)`. There is **no direct `player.x/y`
  poke** anywhere in the loop — except inside `dashSlash` at
  `js\player.js:1751-1753` (`player.x = prevDashX; player.y = prevDashY`) to
  undo wall-tunneling.
- Smoothing has a tunable: `window.__MOVEMENT_WEIGHT__`. `weight === 0` is the
  default (instant `setVelocity`); higher values give D2-style inertia.
- `lastMoveDirection` (Phaser.Math.Vector2 — also exposed as
  `window.lastMoveDirection`) is the source of truth for "current movement
  direction" in classic AIM and ARPG dead-zone fallback. Roll direction read
  should reuse `_getAimVector2` at `js\player.js:1197-1211` — it already
  handles "no input → fall back to facing".

### Player properties (script-scope, top of main.js)

Declared `let` at `js\main.js:469-477`:
```js
let playerHealth = 30; playerMaxHealth = 30; weaponDamage = 1;
weaponAttackSpeed = 1.0; attackRange = 100; playerSpeed = 160;
playerArmor = 0; playerCritChance = 0;
```
Flags at `js\main.js:762-773`:
```js
isAttacking, attackCooldown, isSpinning, lastSpinTime,
isChargingSlash, chargeSlashCooldown, chargeSlashStartTime,
chargeSlashMaxTimer, dashSlashCooldown, daggerThrowCooldown,
shieldBashCooldown, isDashing, playerDeathHandled
```

No formal state machine — abilities gate each other ad-hoc by checking
`if (isDashing || isSpinning || isChargingSlash) return;` (see
`js\player.js:1355, 1460, 1561, 1687`).

The reference base-stats object at `js\main.js:812`:
```js
let baseStats = { damage:1, speed:1.0, range:100, maxHP:30, move:160, armor:0, crit:0.05 };
```

Loot/Knowledge buffs are applied in `recalcDerived` (`js\inventory.js:877`),
which sets `playerSpeed = Math.max(60, baseStats.move + sum.move)` then
multiplies by `speedMult` from buffs at `js\inventory.js:1003,1018,1043`.

### Concrete numbers for roll design

- **Sprite display footprint**: `PLAYER_BASE_DISPLAY_WIDTH=60`,
  `PLAYER_BASE_DISPLAY_HEIGHT=150`, scaled by `PLAYER_VISUAL_SCALE=0.456`,
  i.e. about **27×68 px** visible.
- **Physics collider**: `PLAYER_COLLIDER_WIDTH=34`, `PLAYER_COLLIDER_HEIGHT=56`
  (`js\player.js:12-13`), set in `applyPlayerDisplaySettings` at
  `js\player.js:576`. Aligned to bottom (feet) via origin Y=0.92.
- **Speed**: base `160 px/s` (`baseStats.move`), capped at `setMaxVelocity(220,
  220)` (`js\main.js:2442`). Effective speed in play hovers 160–220.
- **Comparable abilities**: `dashSlash` covers `DASH_SLASH_DISTANCE_BASE=220
  px` over `DASH_SLASH_DURATION_BASE=220 ms` → ~1000 px/s peak (boosted by
  `attackRange` scaling). Shadow-Step skill at `js\player.js:967` further
  multiplies dash distance by 1.5.

So a 80–100 px roll over ~200ms at ~400–500 px/s feels deliberately slower
than dashSlash (which is the offensive lunge). Good differentiation.

### Where to plug roll movement

Roll **must not** go through `_applySmoothedVelocity` — the smoothing tau
(40-180 ms) would fight the burst. Mirror the dashSlash approach
(`js\player.js:1684-1834`):
- Set `isDashing = true` (or new `isRolling` flag — see WP order below)
- `player.body.setMaxVelocity(rollSpeed, rollSpeed)`
- `player.setVelocity(rollDir.x * rollSpeed, rollDir.y * rollSpeed)`
- After roll duration: restore `setMaxVelocity(220, 220)`, set velocity 0,
  drop flag.

Also wall-tunneling guard. dashSlash already implements one at
`js\player.js:1714-1758` (`dashCrossedWall` + `stopDashAtWall`) — copy it.

---

## 3. Animation-System-Audit

### Walk anims (8-directional)

- 8 directions × 8 frames each, key pattern `dir${dd}_f${ff}` where
  `dd` ∈ `00`..`07` and `ff` ∈ `00`..`07` (`js\player.js:23-45`).
- Animation keys: `walk_00`..`walk_07`, created lazily in
  `ensurePlayerAnimations` (`js\player.js:424-449`) at `frameRate: 10`,
  `repeat: -1`.
- Lazy-loaded per direction via `ensureDirectionLoaded` (`js\player.js:71-103`)
  — initial scene only has `dir00`; the rest stream as the player turns.
- Direction picked by `getDirectionFromVelocity(vx, vy)` (`js\player.js:400-422`)
  — dot-product against the 8 unit vectors.
- Idle frame = `dir${dd}_f00`.

### Attack animations — **NONE**

There is no per-attack sprite animation. Attacks reuse the walk frames + a
graphics-arc VFX (`showAttackEffect` at `js\player.js:1213-1238`) + tint
flashes on hit. The dashSlash has only a 0x7fd6ff player tint + arc + cyan
trail particles; no body-pose change.

### Roll animation — Plan A vs B vs C

There is **no roll spritesheet** in the project. Options:

- **Plan A (artist-required)**: 1 row of ~6 frames per direction (48 sprites
  total at 125×500 base) — not feasible without a sprite drop.
- **Plan B (recommended, no-art)**: Keep playing the walk anim but boost
  `sprite.anims.timeScale` to ~2.5 for the roll duration so legs blur,
  combined with a tween: `setRotation(0 → Math.PI*2)` (one full barrel-roll
  spin in screen-space) over the roll duration. Easy and reads as "roll".
  Caveat: the sprite origin is at the feet (`originY = 0.92`), so the
  rotation pivots around the feet — visually weird. Either: (a) animate
  `setScale(scaleY → 0.7 → scaleY)` instead (squash, no rotation), or
  (b) temporarily set origin to (0.5, 0.5) for the roll and restore. The
  origin swap is the cleaner read and matches the squash-roll convention
  in 2D games like Hades.
- **Plan C (cheapest)**: No body anim — just the afterimage trail +
  invulnerability flash tint. Functional but underwhelming.

Recommendation: ship **Plan B + Plan C combined**. Squash via `setScale`,
afterimage trail, color flash. No artist work needed.

### Adding new anims (reference pattern)

`js\player.js:108-129` (`ensureDirectionAnimations`) shows the canonical
3-step: build `frames` array → `scene.anims.create({key, frames, frameRate,
repeat: -1})` → `sprite.anims.play(key, true)`. Re-usable verbatim if a
spritesheet ever lands.

---

## 4. Physics-Body-Audit

### Player body

- Arcade physics sprite (`this.physics.add.sprite(...)` at `js\main.js:2432`).
- Body size: 34×56, offset recomputed every frame in
  `applyPlayerDisplaySettings` (`js\player.js:567-591`).
- World-bounds enabled, max velocity 220 (`js\main.js:2436, 2442`).
- Push-able disabled (`setPushable(false)`).
- Colliders: `player ↔ enemies` (`js\main.js:2486`), `player ↔ obstacles`
  set up per-room in `roomManager.js` enterRoom (NOT in main.js).
- Overlaps: `player ↔ enemies → hitByMelee` (`js\main.js:2506`),
  `player ↔ enemyProjectiles → hitByProjectile` (`js\main.js:2507`),
  `player ↔ lootGroup`, `player ↔ goldGroup`.

### Damage flow — single chokepoint

`applyPlayerDamage(rawDamage, scene)` at `js\enemy.js:1649-1797` is the
**only function** that decrements `playerHealth`. All 13 call sites:
- Melee overlap (`hitByMelee` → enemy.js:1554)
- Projectile overlap (`hitByProjectile` → enemy.js:1592)
- Standard enemy attack ranger (`enemy.js:1231, 1431`)
- Boss + mini-boss attacks (`enemy.js:2199, 2236, 2276, 2316, 2407, 2449`)

Status-effect tick damage (`statusEffects.js:210` POISON/BLEED) and trapped-
chest damage (`main.js:1317`, `eventSystem.js:1369`) write `playerHealth`
directly **without** going through `applyPlayerDamage`. **Decision for the
spec**: do i-frames apply to DoT ticks too? Most ARPGs say no (status effects
are pre-applied; the roll dodges the *application*, not the tick). The
existing `window._playerInvincible` flag (set by Lightning-Reflex skill at
`js\enemy.js:1667`) bails out of `applyPlayerDamage` at line 1651, and that
already covers melee + projectile + boss AOEs uniformly. **It does NOT cover
status-effect ticks** — confirm this is acceptable.

### i-Frame implementation options

- **Option A** (`body.checkCollision.none = true`): breaks overlap callbacks
  but also breaks loot/gold/stairs/doors/chests pickup — player rolls past
  them invisibly. Not viable.
- **Option B** (flag-based, recommended): set `window._playerInvincible = true`
  for the i-frame window, restore after. `applyPlayerDamage` already respects
  it. **Zero damage-call-site changes.** This is the same flag the skill
  system uses; we either share it (with explicit precedence: roll wins over
  skill) or add a parallel `_playerDodgeInvincible` that ORs into the check.
  Cleaner: add a single `isPlayerInvincible()` helper that ORs all flags.
- **Option C** (set a roll-specific group + adjust colliders): heavy, no
  benefit vs Option B.

**Option B wins.** All boss AOEs route through `applyPlayerDamage`, so they
are automatically i-frame-able.

### Status-effect interaction

`window.statusEffectManager.applyEffect(player, ...)` is the gateway for
SLOW/BLEED/POISON/STUN on the player. Brute melee at `js\enemy.js:1235-1239`
applies STUN regardless of damage outcome. **Recommendation**: gate
`applyEffect(player, ...)` on `isPlayerInvincible()` too — otherwise a
roll-through-Brute eats the stun without taking HP damage. Single edit in
statusEffects.js (or wrap each callsite in enemy.js).

---

## 5. Cooldown-System-Audit

### Two cooldown patterns coexist

1. **Per-ability boolean + delayedCall** (used by every melee ability):
   ```js
   chargeSlashCooldown = true;
   startCooldownTimer(scene, cd, { button, label, statusKey:'charge',
     onComplete: () => { chargeSlashCooldown = false; } });
   ```
   `startCooldownTimer` at `js\player.js:788-842` handles the button-disable,
   text countdown, HUD status update.
2. **AbilitySystem internal cooldown map** (`js\abilitySystem.js:626-633`):
   ```js
   if (def.cooldownMs) {
     const ready = state.cooldowns[abilityId] || 0;
     if (now < ready) return false;
     state.cooldowns[abilityId] = now + def.cooldownMs;
   }
   ```
   Used only by `'self'` type abilities (Heilwunde, Frostnova, Blutopfer,
   Schattenschritt) — the others rely on pattern #1.

### For dodge roll

Pick **pattern #1** (per-ability boolean). Pattern matches dashSlash:
```js
let rollCooldown = false;
let lastRollTime = 0;
// in roll():
if (rollCooldown || isDashing || ...) return;
rollCooldown = true;
startCooldownTimer(this, ROLL_COOLDOWN_MS, {
  button: rollBtn, label: rollBtnCooldownText, statusKey: 'roll',
  onComplete: () => { rollCooldown = false; }
});
```
`updateAbilityStatus('roll', ...)` integrates with `js\hudV2.js`-driven
mobile HUD cooldown rings automatically (statusKey is the contract).

### CD-reduction multipliers

`applyCooldownModifier(base, key)` at `js\player.js:895-903` applies:
- per-ability `abilityBonuses[key].cooldown`
- LootSystem `cd_<ability>` + `cd_all_abilities` affixes
- KnowledgeTree `cdrAll` (Issue #26)

Apply same modifier to roll if we want CDR to affect it. **Recommendation**:
DO apply CDR — feels bad if KT "Geübte Hände" doesn't reduce roll CD.
Use ability key `'roll'`.

---

## 6. Mobile-Controls-Audit

### Current layout (js/mobileControls.js)

8 buttons in a 4-col × 2-row right-anchored grid (`ABILITY_LAYOUT` at lines
32-41):

```
              [potion ]            ← col 3, row 0
[charge][dash ][shield][interact]  ← col 2, 1, 0 row 1, col 3 row 1
[attack][spin ][dagger]            ← col 2, 1, 0 row 0
```
Wait — reading `ABILITY_LAYOUT` correctly:
- row 0 (bottom): attack(col0), spin(col1), dagger(col2), potion(col3)
- row 1 (upper): charge(col0), dash(col1), shield(col2), interact(col3)

So we already use **8 cells, both rows full**. col 0 is innermost (closest
to bottom-right corner). Cell size = `max(76px * scale, 44px) + 12px gap`.

The grid is computed from the bottom-right via `_cellCenter` at
`js\mobileControls.js:74-82` using `__SAFE_AREA__` (notch insets).

### Adding a Roll button — constraints

- **No empty slot remaining** in the current 4×2 grid.
- Adding **col 4** (further left) eats joystick space on small phones. The
  joystick lives bottom-left at `(100, h - 100)` with radius 60, so its
  thumb-throw zone extends ~160px from the left edge. On a 360px-wide phone
  in landscape (so ~640w), 4 cols × 88px = 352px from the right edge → roll
  button would land at x ≈ 288 from left = barely safe but tight.
- Adding **row 2** (above) collides with the top HUD bar (mobile health bar,
  gold counter, etc.). The mobile tap-to-move handler explicitly reserves
  `pointer.y < 60` as the top HUD area at `js\mobileControls.js:335`. A
  third row at the bottom-right corner adds ~88px of height → button bottom
  at `h - 252px`. Should be safe but cramped.

### Recommendation

**Dedicated button**, position: add a **col 4, row 0 slot** (further from
corner) for "roll" alongside attack/spin/dagger/potion. Reasoning:
- All combat actions stay on row 0 (same vertical band, easier thumb).
- Interact + charge/dash/shield stay on row 1.
- The leftmost edge of the right-grid is still right of the joystick zone
  on every tested device (verified empirically in 048-mobile-button-layout).

Alternative: **swap interact → row 0 col 4** and put roll in row 1 col 3 —
keeps the "spell row" idea (charge/dash/shield/roll). Slightly weaker thumb
ergonomics since roll wants to be the most-pressed defensive button.

### Wiring

Just add an entry to `ABILITY_LAYOUT`:
```js
{ key: 'roll', col: 4, row: 0, color: 0xaa66ff, abilityId: null }
```
Then add a handler in both `handlers` tables (`mobileControls.js:193-202`
and `:265-274`):
```js
roll: { onDown: dodgeRoll, onUp: null }
```
The cooldown text auto-wires via `cdFor('roll')` (line 217). The button
visibility is auto-handled (abilityId null = always visible). Add a glyph
+ label to `DECORATION` in `mobileAbilityButtons.js:45-54`.

**Gesture alternative — REJECT.** A two-finger swipe or double-tap-direction
conflicts with the tap-to-move handler at `mobileControls.js:330-370`. The
existing UI hit-test there (`scene.input.hitTestPointer`) would not catch
a gesture started outside a button. Worth ~1 day of regression debugging.
Dedicated button is the safer call.

---

## 7. VFX-System-Audit

### Particle factory (js/particleEffects.js)

`window.particleFactory` exposes:
- `hitSpark`, `bloodSplat`, `deathBurst`, `playerHit`, `lootSparkle`
- `abilityTrail(x, y, color)` — used by spin/dash/shield with ~3 particles
  per call, lifespan 150ms. **Already cheap**.
- `screenShake(duration, intensity)` — wrapper for `cam.shake()`.

Honors `window.__REDUCED_EFFECTS__` for mobile (halves particle count). The
particle textures `'particle'` and `'particle_soft'` are generated once in
`createParticleTextures.call(this)` at `js\main.js:2421`.

### Afterimage trail

Phaser doesn't ship a RenderTexture-trail helper out of the box but there
are two cheap approaches:

- **Plan A (lightweight)**: Each frame of the roll (or every 2nd frame),
  duplicate the current player sprite as a static `scene.add.image(x, y,
  textureKey)` with `setAlpha(0.5)` and tween alpha→0 over 200ms then
  destroy. 5-6 ghosts per roll. Same texture key as the player's current
  frame, so no resource cost beyond a Phaser Image object. Free on desktop,
  ~5ms cost on mobile during the roll burst.
- **Plan B (RenderTexture)**: One persistent `scene.add.renderTexture()`
  per roll, draw the player into it every tick with decay alpha. More
  complex, marginally cheaper on long trails. Not worth the code.

Use **Plan A**, gated on `!__REDUCED_EFFECTS__` (or reduce count to 2
ghosts on mobile). The existing `dashSlash` already shows that scattering
per-tick `delayedCall`s through the `tick = 40ms` loop is the pattern to
copy (`js\player.js:1789-1806`).

Particle alternative: tint the player sprite to e.g. 0xaa66ff during i-frames
+ emit a `abilityTrail(player.x, player.y, 0xaa66ff)` every 30ms. Cheapest of
all and matches the existing dashSlash visual language.

### Performance budget

Procrooms render at ~20 FPS on mid-mobile (the trigger that prompted feature
053). The roll lasts ~200ms — so even 5 frame ghosts at 30 FPS = 6 extra
image draws over that window. Negligible. Avoid screen-shake on the roll
itself (only on the *attack-cancel-into-combo*).

---

## 8. Knowledge-Tree-Hook-Audit

### How passives currently apply (js/knowledgeTree.js)

`window.knowledgeTreeBuffs` (lazy-init in `_ensureBuffsBag` at
`js\knowledgeTree.js:214-231`) is a flat bag of fields reset + re-summed
in `_applyRanksToBuffs` (line 233). Consumers read it directly:
- `xpMult`: `js\player.js:2078` in `addXP`
- `goldMult`: `js\lootSystem.js:651` in gold drop
- `cdrAll`: `js\player.js:891` in `getLootAbilityCooldownReduction`
- `critAdd`: `js\main.js:816` at create-time
- `pickupAddRange`: `js\main.js:1496`
- `maxHpAdd`: `js\inventory.js:917`
- `speedMult`, `armorAdd`, `damageMult`, `magicFindMult` → in
  `inventory.js:recalcDerived`

### Adding roll-related KT nodes later (no spec impact)

To add e.g. "+100ms i-frames" or "+20px roll distance" as future KT nodes:
1. Append entry to `CATALOG` at `js\knowledgeTree.js:96-107` with a new
   `perRank.field` key (e.g. `rollIFrameAddMs`, `rollDistanceAddPx`).
2. Append i18n strings to `I18N_DE` and `I18N_EN`.
3. Initialise the new field to 0 in `_ensureBuffsBag` and reset it in
   `_applyRanksToBuffs`.
4. In `dodgeRoll()`, read it:
   ```js
   const ktExtraIFrames = (window.knowledgeTreeBuffs?.rollIFrameAddMs) || 0;
   const iFrameMs = BASE_IFRAME_MS + ktExtraIFrames;
   ```

**Recommendation**: the roll spec should expose the durations / distance as
**named constants** at the top of the function so a follow-up KT node can
add to them with one line. No need to author the nodes in feature 054.

---

## 9. Saubere Integrationspunkte

### Top-5 regression risks

1. **`isDashing` cross-contamination** — `dashSlash` sets `isDashing=true`
   and is currently the only thing that gates `handlePlayerMovement` (line
   1052: `if (isDashing) return;`). If the roll reuses `isDashing`, it
   inherits the wall-tunneling-snap-back logic plus the max-velocity
   restoration. If it introduces a new `isRolling` flag, `handlePlayerMovement`
   must also check it (and `handleMobileMovement` at line 1110). **Use a
   new `isRolling` flag** and add the gate at both line 1052 and 1110.
2. **Attack cancel** — Roll-cancels-attack is a stated requirement. attack()
   at `js\player.js:1354-1448` does NOT directly set `body.velocity` — it
   only sets `isAttacking=true` and schedules a `delayedCall(200, () =>
   isAttacking = false)`. The dash-canceling logic must (a) cancel any
   in-flight `delayedCall`s (currently dropped — there's no handle stored
   in a `let`) or (b) explicitly clear `isAttacking = false; attackCooldown
   = false`. Look out for **stuck `attackCooldown`** if the roll fires
   between attack() and the cooldown delayedCall — the `startCooldownTimer`
   doesn't expose a cancel handle. **Mitigation**: have `dodgeRoll()` reset
   `attackCooldown = false; isAttacking = false; chargeSlashCooldown = false;`
   manually after canceling; track the dependent state explicitly. Skip
   `isSpinning` cancel — spin attack already finishes inside 300ms.
3. **`chargeSlashMaxTimer`** — Charged slash holds a real timer handle
   (`js\player.js:1572-1579`). If the player rolls mid-charge, this timer
   will fire 50ms after `CHARGED_SLASH_MAX_CHARGE` and call
   `releaseChargedSlash` on a stale state. **Must call
   `chargeSlashMaxTimer.remove(false); chargeSlashMaxTimer = null` from
   the roll** if `isChargingSlash` is true. Also clear `isChargingSlash`
   and `player.clearTint()`.
4. **Mobile tap-to-move conflict** — `__MOBILE_MOVE_TARGET__` continues
   pathing toward the last tapped point. If the player rolls on mobile and
   the roll completes, `handleMobileMovement` will instantly re-pull them
   toward the old target. **Mitigation**: in the roll, set
   `window.__MOBILE_MOVE_TARGET__ = null` so the player can stop or
   manually re-tap after. Mirror what the joystick-active path does at
   `js\player.js:1156`.
5. **`_smoothVelX/_smoothVelY` carry-over** — the smoothing state is
   module-private (`js\player.js:1003-1004`). The roll setting velocity
   directly is fine, but **after** the roll, the smoother will jump back to
   the old target. If the player had been moving north, they'll briefly
   coast north out of the roll. **Mitigation**: zero them out in the roll
   end callback: `_smoothVelX = 0; _smoothVelY = 0;`.

### Lesser risks (worth listing)

- **Status-effect ticks bypass `applyPlayerDamage`** — POISON/BLEED ticks
  in `js\statusEffects.js:210` write `playerHealth` directly. i-frames as
  described in section 4 won't block those. Likely acceptable
  (you can't roll out of poison damage you already took), but document it
  in the spec.
- **Brute STUN application bypasses damage flow** — `js\enemy.js:1235-1239`
  applies STUN inside `hitByMelee` after `applyPlayerDamage` returns. Roll
  would dodge the damage but eat the stun. **Mitigation**: wrap the
  `applyEffect(player, ...)` call in an `isPlayerInvincible()` check, or
  return early from `hitByMelee` if invincible.
- **HubSceneV2 has its own movement loop** (`js\scenes\HubSceneV2.js:707-779`)
  — should roll work in the hub? Probably **no** (no enemies to dodge). The
  feature 054 implementation should only register the SHIFT listener +
  dispatch in GameScene's update, NOT HubSceneV2's. Keep the change
  isolated.

### Recommended WP order

Based on dependency + risk:

1. **WP01: Input + flag scaffolding** — add `isRolling` flag,
   `InputScheme.consumeDodgeRollTrigger()` + SHIFT registration, no-op
   handler that just sets/clears the flag with a console.log. Wire
   `handlePlayerMovement` / `handleMobileMovement` to early-return on
   `isRolling`. Smoke-test: SHIFT in dungeon = "player frozen for 400ms".
2. **WP02: Movement burst + cooldown** — implement direction + setVelocity
   burst + max-velocity restore + `startCooldownTimer`. Verify cooldown
   ring shows in HUD. Cancel-other-actions logic lives here (the 3
   chargeSlashMaxTimer/attackCooldown/spin guards from risk #2, #3).
3. **WP03: i-Frames** — introduce `isPlayerInvincible()` helper, route
   `applyPlayerDamage` + Brute-stun + Mage-slow application through it.
   Verify roll-through-Brute = no damage AND no stun.
4. **WP04: VFX (afterimage + tint)** — squash anim + tint + ghost trail.
5. **WP05: Mobile button** — add `roll` to `ABILITY_LAYOUT`, glyph,
   handler wiring, layout verification on iPhone-X notch + landscape Android.
6. **WP06: Roll-into-attack buffer** — track `_rollBufferedAttack` in the
   last 100ms of i-frames; on roll end if buffered, call `attack.call(scene)`
   automatically. Test that the buffered attack uses the **post-roll
   facing**, not the pre-roll.
7. **WP07 (optional)**: Polish — SFX hook, screen-shake on combo trigger,
   tutorial-system step (`combat.dodge` if you want it gated for new players).

WP01-03 are the MVP; can ship after that and add 4-7 incrementally.

---

## TL;DR for the Implementor

**Yes, you can implement a Shift-Dodge-Roll cleanly.** SHIFT is free (the
existing `addKey('SHIFT')` at `main.js:2409` is dead code). All player
damage routes through `applyPlayerDamage(rawDamage, scene)` in `js/enemy.js`,
which already respects a `window._playerInvincible` flag — so i-frames are
a **3-line addition** with zero call-site changes. The whole feature can
land in ~250 LoC + a mobile button entry.

### Minimum-viable recipe

1. **Register SHIFT in `InputScheme`** (`js\inputScheme.js:68`): add
   `shift: kb.addKey('SHIFT')`. Expose `consumeDodgeRollTrigger()` that
   wraps `isKeyJustDown('shift')` + `shouldSuppressCombatInput()`. Poll it
   from `js\main.js:1540` block.
2. **Add `isRolling` flag** beside `isDashing` at `js\main.js:772`. Gate
   `handlePlayerMovement` and `handleMobileMovement` on it (mirror
   `js\player.js:1052`).
3. **Implement `dodgeRoll()`** in `js\player.js`, modeled on
   `dashSlash` (`js\player.js:1684-1834`) but without damage:
   - Direction from `_getAimVector2(scene)` (handles classic + ARPG + no-input fallback)
   - Distance 90px over 200ms → speed = 450 px/s
   - Cancel: `chargeSlashMaxTimer?.remove()`, clear `isAttacking`,
     `attackCooldown=false`, `isChargingSlash=false`,
     `window.__MOBILE_MOVE_TARGET__ = null`, `_smoothVelX=0; _smoothVelY=0;`
   - i-Frames: `window._playerInvincible = true` for **0.3s** of the 0.4s
     spec window (allows last 100ms as "active frames" for combo buffer)
   - Cooldown: `applyCooldownModifier(600, 'roll')` + `startCooldownTimer`
4. **Wall-tunneling guard** — copy `dashCrossedWall` (`js\player.js:1723-1744`)
   verbatim, snap-back to last-safe position on collide.
5. **Mobile button** — append `{ key:'roll', col:4, row:0, color:0xaa66ff,
   abilityId:null }` to `ABILITY_LAYOUT` (`js\mobileControls.js:32`), add
   `roll: { onDown: dodgeRoll, onUp:null }` to both handler tables, add a
   glyph entry to `mobileAbilityButtons.js:45`.

### Sprite-frames question — honest answer

**There are no roll sprite frames.** Plan B = walk-anim re-use is the
right call. Concretely:
- Save current `sprite.originX/Y` (0.5, 0.92), set to (0.5, 0.5) for the
  roll duration, restore after.
- Tween `sprite.scaleX/Y` with squash (e.g., scaleY × 0.7 then back) over
  the 200ms — a sub-Phaser tween chain is fine.
- Set `sprite.anims.timeScale = 2.5` for the duration, restore to 1.0.
- Add `setTint(0xaa66ff)` for the i-frame window, `clearTint()` after.
- Emit `abilityTrail(player.x, player.y, 0xaa66ff)` every 30ms during the
  roll (2-3 emits total). Or duplicate the sprite into a fading ghost on
  each of those ticks if you want a stronger after-image.

This reads as "fast purple dodge spin" without an artist.

### Recommended WP sequence

`WP01 input+flag → WP02 movement+cooldown → WP03 i-frames → WP04 VFX →
WP05 mobile button → WP06 roll-into-attack buffer → WP07 polish.`

MVP = WP01-03 (~120 LoC), ship-quality = WP01-05 (~250 LoC), full-spec =
all 7 (~350 LoC + ~30 lines of mobile-button glue).

### Hidden trap to flag in the spec

`statusEffects.js:210` (DoT ticks) and `enemy.js:1235-1239` (Brute STUN
application) do NOT route through `applyPlayerDamage`. The spec should
explicitly say whether the roll is supposed to dodge:
- (a) just enemy hits (damage + projectiles + boss AOEs) — current
      `_playerInvincible` flag covers this automatically.
- (b) status-effect application from non-damage sources (e.g. Brute STUN
      hits you with 0 damage if you're invincible, but stun still lands).
- (c) DoT ticks from previously-applied effects (you've been poisoned;
      can you roll out of the next tick?).

Recommendation: (a) yes, (b) yes (wrap `applyEffect(player, ...)` calls in
`isPlayerInvincible()` gates), (c) no (already-applied DoTs continue to tick
— it's a status, not an attack).
