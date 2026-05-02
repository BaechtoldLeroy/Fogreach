# Contract: `window.FactionSystem`

**Feature**: 045-faction-system-mvp
**Date**: 2026-05-02

## Public surface

```js
window.FactionSystem = {
  init,
  getStanding,
  adjustStanding,
  setStanding,
  getTier,
  onChange,
  _configureForTest,
  FACTIONS, // { COUNCIL, RESISTANCE, INDEPENDENT } — exposed for callers
};
```

## Methods

### `init(): void`
- Idempotent. Loads persisted blob; on failure or version mismatch, defaults to `{council:0, resistance:0, independent:0}`.
- Side effect: registers i18n keys (DE+EN) on first call.

### `getStanding(factionId: string): integer`
- Returns the current standing for `factionId`. Defaults to `0` for unknown ids (no warn).
- Safe before `init()` (returns 0).

### `adjustStanding(factionId: string, delta: number): integer`
- Adds `delta` to the current value, clamps to `[-100, +100]`, persists, notifies subscribers.
- Returns the **new** standing value.
- `delta === 0` → no-op; subscribers NOT notified.
- Unknown `factionId` → logs `console.warn` once, returns `0`, no-op.

### `setStanding(factionId: string, value: number): integer`
- Sets standing directly. Clamps to `[-100, +100]`. For save migration.
- Returns the new standing.
- Same behavior as `adjustStanding` for unknown ids and zero-delta semantics (if old==new, no notify).

### `getTier(factionId: string): string`
- Returns `'hostile'`, `'neutral'`, `'friendly'`, or `'allied'` based on the current standing.
- Unknown id → `'neutral'`.

### `onChange(callback: (factionId, newValue, oldValue) => void): () => void`
- Registers callback. Returns unsubscribe.
- Notify uses an iteration snapshot — a subscriber that calls `adjustStanding` recursively will see the new mutation queued, not stacked.
- Subscriber exceptions are caught + `console.error`; other subscribers still fire.

### `_configureForTest(primitives): void`
- Replaces internal primitives + resets in-memory state to a fresh, uninitialized form.
- Required keys: `storage`, `i18n`, optionally `persistence`.
- Test then calls `init()` explicitly.

## Algorithm: `adjustStanding`

```text
adjustStanding(factionId, delta):
  if !KNOWN_FACTIONS.has(factionId): warn once, return 0
  old = standings[factionId]
  new = clamp(old + delta, -100, +100)
  if new == old: return new
  standings[factionId] = new
  persist()
  notify(factionId, new, old)
  return new
```

## Failure modes

| Condition | Behavior |
|---|---|
| `localStorage` unavailable | Swallow; in-memory only. Single warn. |
| Stored blob malformed | Discard; defaults. Single warn. |
| `version > 1` | Discard; defaults. Single warn. |
| `i18n.register` missing/throws | Swallow; consumers fall back to keys. |
| Subscriber throws | Catch + `console.error`; others fire. |

## Test plan (informs `tests/factionSystem.test.js`)

1. `init()` is idempotent; i18n.register fires exactly once per language.
2. `getStanding` returns 0 for unknown faction without warning.
3. `getStanding` returns persisted value after `init()` from seeded blob.
4. `adjustStanding` clamps to +100 max.
5. `adjustStanding` clamps to -100 min.
6. `adjustStanding` with delta=0 returns current value AND does NOT fire subscribers.
7. `adjustStanding` with unknown faction warns once and returns 0.
8. `setStanding` clamps and persists; same-value setStanding does not notify.
9. `getTier` returns the correct tier for boundary values (-26, -25, +25, +26, +50, +51).
10. `onChange` fires on advance with `(factionId, newValue, oldValue)`; unsubscribe stops further calls.
11. `onChange` swallows subscriber exceptions; remaining subscribers still fire.
12. `replay-style` recursive subscriber: a subscriber that calls `adjustStanding` does not deadlock; the new mutation fires after the current notify loop completes.
13. Persisted blob with `version > 1` is discarded on init.
14. Missing faction key in persisted blob defaults to 0 without throwing.
15. `setStanding` for save migration accepts out-of-range values (clamps), does not throw.
