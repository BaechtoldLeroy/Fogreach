# Contract: `window.TutorialSystem`

**Feature**: 044-tutorial-onboarding-flow
**Date**: 2026-05-02

## Module surface

`tutorialSystem.js` exposes a single global namespace:

```js
window.TutorialSystem = {
  init,
  maybeAutoSkip,
  report,
  getCurrentStep,
  isActive,
  skip,
  replay,
  onChange,
  _configureForTest,    // test-only
};
```

## Methods

### `init(): void`

- Reads the persisted blob from `localStorage[demonfall_tutorial_v1]`.
- If absent or invalid (per migration policy in data-model.md): leaves the system uninitialized; the next `maybeAutoSkip()` call decides whether to start fresh.
- If present and valid: restores `active`, `currentStepId`, `skipped`, `completedSteps` to the in-memory store.
- Idempotent: safe to call multiple times.
- Side-effect: registers i18n keys (DE+EN) on first call.

### `maybeAutoSkip(): boolean`

- Called by `StartScene` on the New Game click.
- Returns **true** if the tutorial was just skipped or was already skipped (caller can short-circuit).
- Returns **false** otherwise (caller proceeds to scene transition; tutorial will become active in the hub).
- Decision rules:
  - If `skipped === true` already → return `true` (no-op).
  - Else if `Persistence.hasSave() === true` → set `skipped = true`, persist, return `true`.
  - Else if no persisted blob exists → seed with `{ active: true, currentStepId: "init", skipped: false, completedSteps: [] }`, advance to step 2 immediately, persist, return `false`.
  - Else (mid-tutorial reload) → resume; return `false`.

### `report(eventName: string, payload?: object): void`

- Drops the call silently if `isActive() === false`.
- Drops the call silently if the current step's `completion.event !== eventName`.
- Drops the call silently if the current step has a `matcher` that returns falsy for `payload`.
- Otherwise: marks the current step complete, advances to the next step (or completes the tutorial), persists, fires `onChange`.
- Never throws.

### `getCurrentStep(): StepDescriptor | null`

- Returns a shallow copy of the active step descriptor (id, scene, hintKey, targetRef, completion, autoDismissMs).
- Returns `null` when `isActive() === false`.

### `isActive(): boolean`

- Returns `true` iff `active === true && skipped === false && currentStepId !== null`.

### `skip(confirmedByUser: boolean): boolean`

- If `confirmedByUser !== true`: returns `false` and does nothing.
- Else: sets `active = false`, `skipped = true`, `currentStepId = null`. Persists. Fires `onChange(null)`. Returns `true`.

### `replay(): void`

- Removes the persisted blob, resets in-memory state to `{ active: true, currentStepId: "init", skipped: false, completedSteps: [] }`, immediately advances to step 2 (the first visible step), persists, fires `onChange` with the new step.
- Does **not** touch `demonfall_save_v1` or any other key.

### `onChange(callback: (step: StepDescriptor | null) => void): () => void`

- Registers `callback`. Returns an unsubscribe function.
- Callback is invoked with the new current step (or `null`) whenever the active step changes (advance, skip, replay).
- Subscriber exceptions are caught and logged via `console.error`; one bad subscriber does not block the others (mirrors `inputScheme.onChange`).

### `_configureForTest(primitives: object): void` (test-only)

- Replaces internal access to `localStorage`, `window.i18n`, time, and `setTimeout` with provided stubs.
- Required keys on `primitives`:
  - `storage`: `{ getItem, setItem, removeItem }`
  - `i18n`: `{ register, t, onChange }`
  - `now: () => number` — controllable clock
  - `scheduler`: `{ setTimeout, clearTimeout }`
- Resets in-memory state so each test starts clean.

## Step-advance algorithm (for unit tests)

```text
report(event, payload):
  if !isActive(): return
  step = getCurrentStep()
  if step.completion.auto: return            // step 11; auto-dismiss handles it
  if step.completion.event != event: return
  if step.completion.matcher && !step.completion.matcher(payload): return
  completedSteps.push(step.id)
  next = STEPS[indexOf(step) + 1]
  if !next:
    active = false; currentStepId = null
  else:
    currentStepId = next.id
    if next.autoDismissMs:
      scheduler.setTimeout(() => advance(next.id), next.autoDismissMs)
  persist()
  notifySubscribers(getCurrentStep())
```

## Failure modes

| Condition                                 | Behavior                                |
|-------------------------------------------|------------------------------------------|
| `localStorage` unavailable                | `init` swallows; tutorial runs in-memory only (no persistence). |
| `i18n.register` missing                   | `init` falls back to using raw keys as text. |
| Stored blob malformed JSON                 | `init` discards it; treats as fresh. |
| `report()` called before `init()`         | No-op (no in-memory state yet). |
| Two `onChange` subscribers, one throws     | Other subscribers still fire; error logged. |

## Test plan (informs `tutorialSystem.test.js` work package)

Unit tests cover, at minimum:

1. `init()` is idempotent and registers i18n exactly once.
2. `maybeAutoSkip()` returns `true` and persists `skipped:true` when `hasSave()` is true.
3. `maybeAutoSkip()` seeds fresh state and advances to the first visible step when no save exists.
4. `report()` is a no-op when inactive.
5. `report()` is a no-op when event name does not match.
6. `report()` advances when event matches and matcher passes.
7. `report()` does not advance when matcher fails.
8. Step 11's auto-dismiss fires after the configured delay (controlled scheduler).
9. `skip(true)` deactivates and persists; `skip(false)` is a no-op.
10. `replay()` resets state and does not touch unrelated localStorage keys.
11. `onChange` fires on advance/skip/replay; unsubscribe stops further calls.
12. `onChange` swallows subscriber exceptions.
13. Out-of-order `report()` (e.g., loot picked during step 7) is dropped.
14. Stored blob with `version > 1` is discarded on init.
15. Final advance past last step sets `active:false, currentStepId:null` and fires `onChange(null)`.
