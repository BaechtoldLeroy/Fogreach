# Research: ARPG Control Scheme

Feeds Phase 1 design. Each decision has a **Decision / Rationale / Alternatives** trio.

## D0-1 — Sprite facing uses existing 8-octant dispatcher

**Decision**: Reuse `getDirectionFromVelocity(vx, vy, fallbackDd)` from `js/player.js:392` to pick the sprite's `dir00..dir07` frame. In Classic pass `(vx, vy)` (movement); in ARPG pass `(aim.x, aim.y)`.

**Rationale**: The player already has 8 directions (`assets/PlayerSprites/dir00..07_f00..07`) and `getDirectionFromVelocity` does a dot-product octant match over a pre-normalized sequence. No new art needed; no new math; one call-site change in `updatePlayerSpriteAnimation`.

**Octant convention** (source `PLAYER_DIRECTION_SEQUENCE`):
| dd | vector | name |
|----|--------|------|
| 00 | (-1, 0)      | left |
| 01 | (-1, -1) norm | up-left |
| 02 | (0, -1)      | up |
| 03 | (1, -1) norm  | up-right |
| 04 | (1, 0)       | right |
| 05 | (1, 1) norm   | down-right |
| 06 | (0, 1)       | down |
| 07 | (-1, 1) norm  | down-left |

Note the `name` field on the sequence (`'front'`, `'back'` etc.) is semantically misleading but doesn't affect behavior — `dd` and `vector` are what the lookup uses.

**Alternatives considered**:
- Horizontal-only mirror (cursor.x > player.x → right sprite): 4× less granular, breaks for vertical-heavy aim.
- New dedicated "facing" sprite set: wasteful — we already have 8 octants.

## D0-2 — Aim dead-zone at 20 px world radius

**Decision**: If `|mouse_world - player.pos| < 20`, `getAimDirection` returns the last known non-zero aim (initialized from `lastMoveDirection`). Inside the dead-zone the sprite keeps its prior facing; no jitter.

**Rationale**: At 1.0× camera scale the player sprite is ~60 px wide — a 20 px radius sits just outside the sprite without reaching into a "meaningful" aim zone. D2 uses a similar guard where hovering the cursor on your own character doesn't spin the sprite.

**Alternatives**:
- No dead-zone → sprite jitters when cursor hovers the player during close-combat.
- Larger radius (e.g., 40 px) → missed shots at point-blank range.

## D0-3 — Polled dispatch API (not event-driven)

**Decision**: `InputScheme` exposes polled getters (`getMovementInput()`, `isBasicAttackTriggered()`, `getAimDirection()`, `consumeAbilityTrigger(slot)`). Callers invoke them inside the Phaser `update()` cycle.

**Rationale**: The existing codebase is 100% polled — `cursors.left.isDown`, `Phaser.Input.Keyboard.JustDown(qKey)`, etc. An event-driven API would require consumer refactor (callbacks, subscribers, teardown). Polling matches the game loop and keeps the diff local.

One exception: `consumeAbilityTrigger(slot)` is polled but internally edge-triggered — returns `true` once per key press. Prevents the same key press from firing the ability every frame while held.

**Alternatives**:
- Event bus: richer API, but foreign to this codebase. Out of scope.

## D0-4 — Scheme-change subscriber pattern mirrors `i18n.onChange`

**Decision**: `InputScheme.onChange(cb)` returns an unsubscribe function. Used by HUD (to refresh slot-badge key labels) and SettingsScene (to reflect the new picker state if changed externally).

**Rationale**: Identical shape to `window.i18n.onChange` — the codebase has one working example already (SettingsScene re-renders on language change). Keeps the mental model consistent.

**Alternatives**:
- Manual `window._refreshAbilityHUD()` call from the setter: works but couples SettingsScene and HUD code. Subscriber decouples.

## D0-5 — Phaser pointer world-space via `scene.input.activePointer`

**Decision**: `scene.input.activePointer.worldX` / `.worldY` yields world coordinates (camera-scroll-adjusted). Access only inside the Phaser scene lifecycle; pass `scene` into `getAimDirection(scene, player)`.

**Rationale**: `activePointer` reflects the latest pointer (mouse on desktop, touch on mobile). `worldX/Y` already account for `scene.cameras.main.scrollX/Y`. No manual camera-offset math needed.

**Edge case**: When the pointer hasn't moved at all since scene boot, `worldX/Y` read a sensible default (scene center). First user interaction updates them. Not a problem: dead-zone fallback handles the transient pre-movement case.

**Alternatives**:
- `input.mousePointer.worldX`: desktop-only; breaks mobile Phaser paths even though mobile doesn't use the ARPG scheme (FR-014) — defensive code still needs a uniform accessor.

## D0-6 — Test harness stubs Phaser via injectable primitives

**Decision**: `InputScheme` accepts injected accessors for key state and pointer state. In production (`window`-bound init), it binds to Phaser's real `cursors`, `addKey(...)`, `input.activePointer`. In tests, it receives stub objects.

Rough shape:
```js
InputScheme.init({
  getKeyDown: (keyName) => bool,       // "up", "w", "space", "1", etc.
  isKeyJustDown: (keyName) => bool,    // edge-triggered read
  getPointerWorldXY: () => ({x, y}),   // returns null if unavailable
  isPrimaryButtonJustDown: () => bool, // left mouse
  getPersistence: () => ({             // usually window.Persistence
    getControlScheme, setControlScheme
  })
});
```

**Rationale**: Tests need to verify scheme-switching semantics, dead-zone behavior, and slot-trigger edge cases without loading Phaser. Dependency injection keeps the module pure from the test's perspective.

**Alternatives**:
- Heavy Phaser stub in tests: brittle, large surface.
- Skip unit tests entirely: violates `TEST_FIRST`.

## Additional notes

- **No browser shortcut collisions**: WASD, arrows, numbers 1-4, space, QWER are all free in both browsers and Phaser contexts. F11 (fullscreen) is already handled by Phaser's own key listener and is out of the input scheme's domain.
- **Left-click-attack already exists** (commit `ff91985`) — InputScheme wraps it rather than re-implementing. In Classic the existing pointerdown handler's guards (`invOpen`, `playerDeathHandled`, `currentlyOver.length === 0`) are retained; in ARPG the same guards apply and the direction is routed through `getAimDirection`.
- **Mobile detection**: `this.sys.game.device.input.touch` is already read in main.js `create()`. SettingsScene picks up the same flag to hide the control-scheme row on touch devices.
