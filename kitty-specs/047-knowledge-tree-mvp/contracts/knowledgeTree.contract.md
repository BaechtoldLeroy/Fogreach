# Contract: `window.KnowledgeTree` API

**Feature**: 047-knowledge-tree-mvp
**Phase**: 1
**Module**: `js/knowledgeTree.js` (IIFE-on-`window`, classic script, no build)

All methods are synchronous. The module is safe to call before `HubSceneV2` exists. `recalcDerived()` is called via `window.recalcDerived` if present; if absent, the buff map is still updated for next-frame readers.

---

## Read API

### `KnowledgeTree.getFragments() → int`
Returns the current non-negative fragment balance.

### `KnowledgeTree.getRank(nodeId: string) → int`
Returns the current rank for `nodeId`. Returns `0` if the node has not been invested in OR if `nodeId` is not in the catalog (silently — caller responsibility to pass valid id).

### `KnowledgeTree.getMaxRank(nodeId: string) → int | null`
Returns the configured max rank, or `null` if `nodeId` is unknown.

### `KnowledgeTree.getCatalog() → NodeDefinition[]`
Returns a defensive copy of the static catalog (caller may not mutate the internal array).

### `KnowledgeTree.getState() → { fragments: int, ranks: { [nodeId]: int } }`
Returns a defensive snapshot of current state for UI rendering.

---

## Write API

### `KnowledgeTree.addFragments(n: int) → void`
- `n === 0` → no-op.
- `n < 0` → rejected, single console warning.
- `n > 0` → increment fragments, persist, notify subscribers. Does NOT trigger `recalcDerived()` (fragment count alone does not change stats).

### `KnowledgeTree.invest(nodeId: string) → boolean`
- Returns `true` on success, `false` if any precondition fails.
- Preconditions: `fragments >= 1` AND `getRank(nodeId) < getMaxRank(nodeId)` AND `nodeId` is in catalog.
- On success: decrement fragments by 1, increment rank by 1, recompute `window.knowledgeTreeBuffs`, persist, call `window.recalcDerived()` if available, notify subscribers.

### `KnowledgeTree.respec() → void`
- Refunds all invested points back into `fragments`.
- Resets every rank to 0.
- Recomputes `window.knowledgeTreeBuffs` (to neutral identity values).
- Persists, calls `window.recalcDerived()` if available, notifies subscribers.

---

## Subscriber API

### `KnowledgeTree.onChange(cb: (state) => void) → () => void`
- Registers a subscriber. `cb` receives the snapshot from `getState()`.
- Returns an `unsubscribe()` function.
- A throwing subscriber is logged with `console.warn` but does NOT prevent other subscribers from firing.

---

## Test seam

### `KnowledgeTree._configureForTest(primitives: { storage?, now?, recalcDerived?, console? }) → void`
- Replaces internal dependencies for unit tests.
- `storage`: object with `getItem(key)`, `setItem(key, value)`, `removeItem(key)` — defaults to `window.localStorage`.
- `now`: `() => number` — defaults to `Date.now`.
- `recalcDerived`: `() => void` — defaults to `window.recalcDerived` (read at call time).
- `console`: object with `warn` — defaults to `window.console`.

---

## Buff contract (read by other modules)

`window.knowledgeTreeBuffs` is the module's output for the stat pipeline. Other modules treat it as read-only:

```js
{
  damageMult: 1.0,        // inventory.js §3.9 reads this
  armorAdd: 0,            // inventory.js §3.9 reads this
  speedMult: 1.0,         // inventory.js §3.9 reads this
  maxHpAdd: 0,            // inventory.js §1-2 reads this (before max-HP clamp)
  critAdd: 0,             // main.js (where playerCritChance is set) reads this
  xpMult: 1.0,            // addXP() in main.js reads this
  goldMult: 1.0,          // lootSystem.js gold-drop reads this
  pickupAddRange: 0,      // item-pickup overlap reads this
  magicFindMult: 1.0,     // lootSystem.js tier-roll reads this
  cdrAll: 0               // player.js getLootAbilityCooldownReduction reads this
}
```

Object identity is stable across the module's lifetime (always the same reference); fields are mutated in place.

---

## Persistence contract

- **Key**: `demonfall.knowledgeTree.v1`
- **Shape**: `{ version: 1, fragments: int, ranks: { [nodeId]: int } }`
- **Write trigger**: any `addFragments` / `invest` / `respec` call.
- **Read trigger**: module initialization (immediately on first script load).

---

## Error policy

| Situation | Behavior |
|---|---|
| `localStorage` throws on write | Single console.warn, in-memory state still updated, subscribers notified. |
| `localStorage` returns malformed JSON | Treat as missing, start fresh (warn). |
| `version` field mismatch | Treat as missing, start fresh (warn). |
| Persisted `rank > maxRank` | Clamp to `maxRank`, refund difference to fragments, warn. |
| Persisted `nodeId` not in catalog | Drop entry, refund its fragments, warn. |
| `invest` for unknown nodeId | Return `false`, no-op, no warn (caller responsibility). |
| `addFragments(n < 0)` | Single warn, no-op. |
| Subscriber callback throws | warn + continue to next subscriber. |

---

## Initialization order

The `<script>` tag for `js/knowledgeTree.js` must appear in `index.html` **before** `js/scenes/HubSceneV2.js` (which calls into it from the modal) and **after** `js/i18n.js` (so the i18n register call has an instance to register on). It is independent of `inventory.js` because the buff map is read lazily by `recalcDerived` — the script load order between them does not matter.

---

## Out of contract

- The module does NOT trigger UI rendering. UI lives in `HubSceneV2._showKnowledgeTreeUI()` and listens via `onChange`.
- The module does NOT enforce node prerequisites (none exist in MVP — C-05).
- The module does NOT modify or read any other localStorage key.
