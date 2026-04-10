# Contract: `window.EliteEnemies`

**File:** `js/eliteEnemies.js`
**Pattern:** Browser global IIFE

## Public API

### `EliteEnemies.ENEMY_AFFIX_DEFS`
**Type:** `EnemyAffixDef[]`
**Mutability:** Read-only
**Purpose:** The 10-entry enemy affix pool defined in `data-model.md`. Each entry has an `apply(enemy)` mutation function that gets called when the affix is applied.

---

### `EliteEnemies.shouldSpawnElite(depth, rng?)`
**Signature:** `(number, function?) → 'champion' | 'unique' | null`

**Parameters:**
- `depth` — current dungeon depth (`window.currentWave` or `window.DUNGEON_DEPTH`)
- `rng` *(optional)* — injectable random source for tests

**Returns:**
- `null` — spawn a regular (non-elite) enemy
- `'champion'` — spawn a Champion (1 affix, +50% HP)
- `'unique'` — spawn a Unique (2-3 affixes, +100% HP, guaranteed Magic+ drop)

**Spawn rate logic (per spec FR-024):**
- depth 1-5: always returns `null`
- depth 6-10: 25% champion, 5% unique, 70% null
- depth 11-15: 35% champion, 10% unique, 55% null
- depth 16+: 40% champion, 15% unique, 45% null

**Pure function** — given the same depth + RNG state, returns the same result.

---

### `EliteEnemies.applyEliteToEnemy(enemy, eliteTier, rng?)`
**Signature:** `(EnemyObject, 'champion'|'unique', function?) → void`

**Side effects:**
1. Picks 1 (champion) or 2-3 (unique) random `EnemyAffixDef` from `ENEMY_AFFIX_DEFS`.
2. Calls `affixDef.apply(enemy)` for each picked affix — mutates the enemy's stats and behavior.
3. Sets `enemy._isElite = true`, `enemy.eliteTier = eliteTier`, `enemy.eliteAffixes = [...defIds]`.
4. Multiplies HP: champion ×1.5, unique ×2.0.
5. Applies sprite tint from the first picked affix's `tint`.
6. Creates an aura `Phaser.Graphics` at depth 38 (just under the enemy at depth 50) with the affix's `auraColor`. Stores reference on `enemy._eliteAura` for cleanup.
7. Creates a `Phaser.Text` floating above the enemy with the composed name (e.g. `"Fanatic Lightning Enchanted Brute"`). Stores reference on `enemy._eliteNameTag`.
8. Hooks the enemy's `destroy()` so the aura + name tag get destroyed too.

**Compose name rule:**
```
[affix1.displayName] [affix2.displayName] ... [enemyTypeName]
```
e.g. `Fanatic Lightning Enchanted Brute`, `Vampiric Imp`, `Berserker Extra Strong Mage`.

---

### `EliteEnemies.modifyDropTable(enemy, baseDrops)`
**Signature:** `(EnemyObject, DropTable) → DropTable`

**Returns:** A new drop table with elite bonuses applied:
- **Champion:** drop count × 1.5, tier distribution boosted (Common rolls re-rolled to Magic+)
- **Unique:** drop count × 2, tier distribution heavily boosted (Common+Magic re-rolled to Rare+), guaranteed Magic+ item drop, +50% gold
- Non-elite: returns `baseDrops` unchanged

---

## Hook contract — how this integrates with `js/enemy.js`

`spawnEnemy()` is patched to call EliteEnemies AFTER the regular enemy creation completes:

```js
function spawnEnemy(x, y, type) {
  const enemy = scene.physics.add.sprite(...);
  // ... existing enemy setup ...

  // NEW: elite check
  if (window.EliteEnemies) {
    const eliteTier = EliteEnemies.shouldSpawnElite(window.currentWave || 1);
    if (eliteTier) {
      EliteEnemies.applyEliteToEnemy(enemy, eliteTier);
    }
  }

  return enemy;
}
```

The hook is non-breaking: if `EliteEnemies` is not loaded, regular enemies spawn as before.

---

## Visual layering (depth values)

| Depth | Object |
|---|---|
| -5 | Floor render texture (existing) |
| 38 | Elite aura graphics (new) |
| 39 | Wall tilesprites (existing) |
| 40 | Stair sprites (existing) |
| 50 | Enemy layer (existing) |
| 51 | Elite name tag floating text (new) |
| 100 | Player (existing) |

The aura sits BELOW the enemy so the enemy sprite covers most of it but a glowing rim is visible. The name tag sits above all enemies but below the HUD.

---

## Test contract

`tests/eliteEnemies.test.js` MUST cover:

1. **`shouldSpawnElite(depth=1)` always returns `null`.**
2. **`shouldSpawnElite(depth=10)` returns champion or unique with the documented frequencies.** Roll 1000 times, assert frequencies within ±5%.
3. **`shouldSpawnElite(depth=20)` returns elite >50% of the time.**
4. **`applyEliteToEnemy` doubles HP for unique tier.** (mock enemy object)
5. **`applyEliteToEnemy` sets `_isElite=true` and stores `eliteAffixes` array.**
6. **`applyEliteToEnemy` for champion picks exactly 1 affix.**
7. **`applyEliteToEnemy` for unique picks 2 or 3 affixes (random).**
8. **`modifyDropTable` for non-elite enemies returns the input unchanged.**
9. **`modifyDropTable` for unique adds a guaranteed Magic+ item to the drop list.**
10. **`ENEMY_AFFIX_DEFS` has at least 10 entries with required fields (`id`, `displayName`, `tint`, `apply`).**

Tests use mock enemy objects (plain JS objects with `hp`, `speed`, `damage` fields) — no Phaser dependency.
