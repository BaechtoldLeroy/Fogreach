# Contract: `window.InputScheme`

Public API of the input-scheme dispatcher. All consumers must interact with this module; no new call-site may read Phaser key/pointer primitives directly.

## Lifecycle

### `init(scene, options = {})`

Called once per game scene boot (typically inside `GameScene.create()` after Phaser key bindings exist).

**Parameters**
- `scene` — the Phaser scene (needed for pointer world coords).
- `options` — optional, used by tests to inject stubs. Omit in production.

**Effect**
- Binds to Phaser's key objects (`cursors`, `spaceKey`, `qKey`, etc.) the scene created.
- Reads `Persistence.getControlScheme()` to set the initial scheme.
- Adds keydown listeners for WASD, number keys 1-4, and subscribes to pointerdown (shared with left-click-attack).

**Idempotent**: calling twice in the same scene is safe — second call tears down prior bindings.

## Scheme accessor / mutator

### `getScheme() → 'classic' | 'arpg'`
Current active scheme. Reads cached value, not localStorage per call.

### `setScheme(value) → bool`
Sets the scheme, persists to `localStorage`, notifies `onChange` subscribers. Returns `true` on valid value; `false` (and no change) on invalid.

### `onChange(cb) → unsubscribe()`
Registers a callback that fires with the new scheme string on every `setScheme` call. Returns an unsubscribe function.

## Per-frame input getters

All of these are safe to call every frame. Internal state handles edge-triggering where needed.

### `getMovementInput() → { x: number, y: number }`
Returns raw movement input, **not** normalized. `-1 / 0 / +1` per axis.
- Classic: arrow keys.
- ARPG: WASD.

Consumer still multiplies by player speed and applies status effects (as today).

### `getAimDirection(scene, player) → { x, y, source }`
Returns the unit aim vector per `data-model.md::AimVector`.
- `scene`: current Phaser scene (for pointer world coords).
- `player`: the player sprite (for position).

### `isBasicAttackTriggered() → bool`
Edge-triggered. Fires true on the frame the player pressed:
- Classic: Space OR left mouse (same as today's behavior).
- ARPG: Left mouse OR Space.

Both schemes keep Space as an accessibility fallback; see FR-010.

### `consumeAbilityTrigger(slotIndex) → bool`
`slotIndex` is 1..4 (1-based, matches `slot1`..`slot4`). Returns true exactly once per physical key press of the bound key for that slot. Implementation uses `Phaser.Input.Keyboard.JustDown` semantics internally.

## Display helpers

### `getSlotLabel(slotIndex) → string`
Returns the single-character key label ("Q"/"W"/"E"/"R" or "1"/"2"/"3"/"4") for HUD key badges.

### `getSchemeLabel(scheme) → string`
Localized display name via `i18n.t('input.scheme.classic')` / `i18n.t('input.scheme.arpg')`. Registered alongside other SettingsScene strings.

## UI guard (shared with left-click-attack)

### `shouldSuppressCombatInput() → bool`
Consolidates the gates: `invOpen || playerDeathHandled || isReturningToHub`. Called by `isBasicAttackTriggered` and `consumeAbilityTrigger` before returning true. Exposed publicly so callers that wrap raw input (e.g., the existing `pointerdown` handler) can reuse the same check.

## Testing contract

The module must be require-able in Node (CommonJS) for unit tests. In that environment `window` and `Phaser` are undefined.

Tests configure the module via a hidden `_configureForTest(primitives)` entry that accepts:
```js
{
  getKeyDown(name)    // 'up'|'down'|'left'|'right'|'w'|'a'|'s'|'d'|'space'|'1'|'2'|'3'|'4'|'q'|'w'|'e'|'r'
  isKeyJustDown(name)
  getPointerWorldXY() // -> { x, y } | null
  isPrimaryButtonJustDown()
  getPlayerPos()      // -> { x, y }
  getLastMoveDir()    // -> { x, y }
  persistence: { getControlScheme(), setControlScheme(v) }
}
```

Public getters then work against this stub. `init()` in production wires these to real Phaser/Persistence calls.

## Invariants

1. `getAimDirection` never returns `(0, 0)` — always a valid unit vector.
2. `consumeAbilityTrigger` returns true for at most one frame per physical key press.
3. `getScheme()` always matches the value that would be read from `Persistence.getControlScheme()`.
4. `isBasicAttackTriggered` returns false whenever `shouldSuppressCombatInput()` is true, regardless of key/button state.
5. `getSlotLabel(n)` returns a single character in the set `{Q, W, E, R, 1, 2, 3, 4}`.

## Out of scope for this contract

- Gamepad input
- Click-to-move
- Per-key remapping
- Touch/mobile input (existing `mobileControls.js` keeps its own path)
