# Data Model: Knowledge Tree (MVP)

**Feature**: 047-knowledge-tree-mvp
**Generated**: 2026-05-13
**Phase**: 1 (Design & Contracts)

## Entities

### 1. `FragmentCount` — currency

- **Type**: non-negative integer.
- **Lifecycle**: persists across runs and reloads; only modified by `addFragments(n)`, `invest(nodeId)` (-1), `respec()` (refund).
- **Validation**:
  - `addFragments(0)` → no-op.
  - `addFragments(n < 0)` → rejected with warning.
  - `invest` → caller-side guard: requires `fragments >= 1`.

### 2. `NodeDefinition` — static catalog entry (compile-time)

- **Shape**:
  ```js
  {
    id: string,           // stable id, never renamed (e.g. 'node_damage')
    labelKey: string,     // i18n key for display name (e.g. 'knowledge.node.damage.label')
    descKey: string,      // i18n key for description (e.g. 'knowledge.node.damage.desc')
    maxRank: int,         // 1..5
    perRank: {
      field: string,      // key in window.knowledgeTreeBuffs (e.g. 'damageMult')
      kind: 'mult' | 'add',
      value: number       // per-rank delta or factor — see "Effect application" below
    }
  }
  ```
- **Catalog** (10 entries; full list in `research.md` R-04). IDs are stable contracts — never renamed.

### 3. `Rank` — runtime per-node state

- **Type**: non-negative integer, bound `[0, NodeDefinition.maxRank]`.
- **Default**: 0 (for any node missing from persisted blob — satisfies FR-11).
- **Validation on load**: clamp to current `maxRank`; refund the excess into `FragmentCount`.

### 4. `PersistedBlob` — localStorage payload

- **Key**: `demonfall.knowledgeTree.v1`
- **Shape**:
  ```json
  {
    "version": 1,
    "fragments": 0,
    "ranks": {
      "node_damage": 0,
      "node_armor": 0,
      "node_speed": 0,
      "node_max_hp": 0,
      "node_crit": 0,
      "node_xp": 0,
      "node_gold": 0,
      "node_pickup": 0,
      "node_magic_find": 0,
      "node_cdr": 0
    }
  }
  ```
- **Migration**: `version !== 1` → ignore blob, start fresh (warn to console). Unknown node ids → drop + refund. Missing node ids → treat as rank 0.

### 5. `KnowledgeTreeBuffs` — runtime contributor (window-scoped)

- **Object identity**: `window.knowledgeTreeBuffs` (lazily created on first computation, mutated in place by `_applyRanksToBuffs()`).
- **Shape** (full reference in research.md R-03):
  ```js
  {
    damageMult: number,
    armorAdd: number,
    speedMult: number,
    maxHpAdd: number,
    critAdd: number,
    xpMult: number,
    goldMult: number,
    pickupAddRange: number,
    magicFindMult: number,
    cdrAll: number
  }
  ```
- **Recomputed**: after every `invest` / `respec` / `load`.
- **Identity stable**: callers may cache the reference; the module mutates fields, never reassigns the object.

## Effect application

For each node, the runtime maps `rank` → `buff field` as follows:

| nodeId | Computation | Stat path |
|---|---|---|
| `node_damage` | `buffs.damageMult = 1 + rank * 0.05` | weaponDamage *= damageMult (inventory.js §3.9) |
| `node_armor` | `buffs.armorAdd = rank * 0.05` | playerArmor += armorAdd, then clamp 0..0.85 |
| `node_speed` | `buffs.speedMult = 1 + rank * 0.03` | playerSpeed *= speedMult |
| `node_max_hp` | `buffs.maxHpAdd = rank * 10` | added to newMaxHealth in recalcDerived §1 |
| `node_crit` | `buffs.critAdd = rank * 0.02` | playerCritChance += critAdd at main.js:806 |
| `node_xp` | `buffs.xpMult = 1 + rank * 0.05` | wrap addXP(amount) → amount * xpMult |
| `node_gold` | `buffs.goldMult = 1 + rank * 0.05` | gold drop value * goldMult |
| `node_pickup` | `buffs.pickupAddRange = rank * 20` | pickup overlap radius += pickupAddRange |
| `node_magic_find` | `buffs.magicFindMult = 1 + rank * 0.05` | rare/legendary weights *= magicFindMult |
| `node_cdr` | `buffs.cdrAll = rank * 0.03` | cooldown_reduction_fraction += cdrAll |

**Stacking rule**: All multipliers stack multiplicatively with other systems (eventBuffs, brunnenBuffs, printingBuffs). Additive fields stack additively. Clamps (armor 85%, speed floor 60) apply after all layers, as in current `recalcDerived`.

## State transitions

```
                  addFragments(n>0)
                ┌─────────────────┐
                ▼                 │
    ┌────────[State]──────────────┤
    │  fragments: F               │
    │  ranks:    {nodeId: R}      │
    └────────┬────────────────────┘
             │
             │  invest(nodeId)   [F>=1 AND R<maxRank]
             ▼
    F' = F - 1,  R' = R + 1, save, notify, recalc

             │  respec()
             ▼
    F' = F + sum(ranks), R' = 0 for all nodes, save, notify, recalc
```

## Invariants

1. `fragments >= 0` at all times after construction.
2. `ranks[nodeId] in [0, definition.maxRank]` for every node currently in catalog.
3. Total fragments ever earned = current fragments + sum of current ranks (modulo loaded-state refunds).
4. The `knowledgeTreeBuffs` object reference is stable across the module's lifetime.
5. Persistence I/O happens only inside `_saveToStorage()`; no other function touches `localStorage`.

## Identity & versioning

- Stable IDs (`node_*`) are part of the persisted contract — never rename.
- Field names in `knowledgeTreeBuffs` are part of the integration contract with `inventory.js` / `main.js` / `player.js` / `lootSystem.js` — never rename without coordinated edit.
- Schema `version: 1` — on bump, write a migration in `_loadFromStorage` mapping `v1 → v2`.
