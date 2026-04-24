# Data Model: ARPG Control Scheme

Three entities carry state or shape behavior. None are persisted to a server — the only durable storage is the local settings bucket.

## ControlScheme (value type)

A string enum identifying the active input binding profile.

| Field | Type | Values | Default | Notes |
|-------|------|--------|---------|-------|
| `value` | string | `'classic'` \| `'arpg'` | `'classic'` | Persisted under `demonfall_settings_v1.controlScheme`. Unknown values fall back to `'classic'`. |

**Validation**
- `setControlScheme(x)` must accept only one of the two canonical values. Anything else → console warning + no-op (do not silently coerce).
- `getControlScheme()` coerces missing/corrupt storage → `'classic'`.

**State transitions**
```
[classic] ──setControlScheme('arpg')──▶ [arpg]
[arpg]    ──setControlScheme('classic')▶ [classic]
```

Both transitions emit a notification to all `InputScheme.onChange` subscribers.

## AimVector (derived, transient)

The per-frame aim direction used by offensive abilities and sprite facing.

| Field | Type | Notes |
|-------|------|-------|
| `x` | number | Unit vector x-component, `[-1, 1]` |
| `y` | number | Unit vector y-component, `[-1, 1]` |
| `source` | string | `'movement'` (Classic) or `'cursor'` (ARPG) or `'lastKnown'` (dead-zone fallback) |

**Derivation rules**
- Classic: `source = 'movement'`; `x, y = lastMoveDirection.x, .y` (already normalized by `player.js`).
- ARPG, cursor **outside** dead-zone: `source = 'cursor'`; `(x, y) = normalize(pointer.world - player.pos)`.
- ARPG, cursor **inside** dead-zone OR unavailable: `source = 'lastKnown'`; returns the last-cached valid aim (initialized from `lastMoveDirection` on first read).

**Degenerate case**: if both movement and cursor are unavailable (start of game, no input yet), returns `(1, 0)` — arbitrary but deterministic. Covered by D0-2.

## SlotBinding (lookup table)

The key label + physical key code per ability slot, scheme-dependent.

| Slot | Classic key code | Classic label | ARPG key code | ARPG label |
|------|------------------|---------------|----------------|-------------|
| slot1 | `Q` | "Q" | `ONE` | "1" |
| slot2 | `W` | "W" | `TWO` | "2" |
| slot3 | `E` | "E" | `THREE` | "3" |
| slot4 | `R` | "R" | `FOUR` | "4" |

Phaser key-code names: `Phaser.Input.Keyboard.KeyCodes.ONE`, `.TWO`, etc. — or the string `'1'`, `'2'`… (`addKey('1')` also works).

**Consumers**
- HUD slot tiles read `getSlotLabel(slotIndex)` to populate their key badge text.
- main.js `update()` calls `consumeAbilityTrigger(slotIndex)` to check whether a slot's bound key just went down this frame.

## Relationships

```
ControlScheme (1) ────owns──▶ (4) SlotBinding
              └────drives──▶ AimVector.source
```

`ControlScheme` change → triggers re-read of SlotBindings and resets any held-key state (user must release + re-press to avoid carrying a held-key from the old scheme into the new).
