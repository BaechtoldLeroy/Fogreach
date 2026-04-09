# Contract: `window.LootSystem`

**File:** `js/lootSystem.js`
**Pattern:** Browser global IIFE (matches `abilitySystem.js`, `questSystem.js`)

## Public API

### `LootSystem.AFFIX_DEFS`
**Type:** `AffixDef[]`
**Mutability:** Read-only (frozen)
**Purpose:** The 24-entry affix pool defined in `data-model.md`.

---

### `LootSystem.rollAffixes(iLevel, count, rng?)`
**Signature:** `(number, number, function?) → AffixInstance[]`

**Parameters:**
- `iLevel` — item level used to filter the eligible affix pool (`def.iLevelMin <= iLevel`)
- `count` — exact number of affixes to roll
- `rng` *(optional)* — function returning a random number in `[0, 1)`. Defaults to `Math.random`.

**Returns:** Array of `AffixInstance` of length `count`. Each entry has a unique `defId` (no duplicates per item). Values are rolled within each affix's `range`.

**Throws:** Never. If the eligible pool is smaller than `count`, returns as many as possible.

**Performance:** < 1ms per call (NFR-001).

**Pure function** — no side effects, no global mutation. Testable in isolation.

---

### `LootSystem.ITEM_BASES`
**Type:** `ItemBase[]`
**Mutability:** Read-only
**Purpose:** Base item templates defined in `data-model.md`.

---

### `LootSystem.rollItem(baseKey, iLevel, forceTier?)`
**Signature:** `(string, number, number?) → Item`

**Parameters:**
- `baseKey` — key into `ITEM_BASES` (e.g. `'WPN_EISENKLINGE'`). If `null`, the function picks a random base item using `iLevel`-weighted drop tables.
- `iLevel` — item level for affix-roll filtering AND `requiredLevel` derivation
- `forceTier` *(optional)* — force a specific tier (used by elite enemies guaranteeing Magic+)

**Returns:** A fully populated `Item` object with `tier`, `iLevel`, `requiredLevel`, `baseStats` (deep-copied from base), `affixes` (rolled), and `displayName` (composed).

**Side effects:** None. Pure function — same arguments → same return given the same RNG state.

---

### `LootSystem.composeName(item)`
**Signature:** `(Item) → string`

**Returns:** The display name composed from the item's tier + base name + affixes.

**Naming rules:**
- **Common** (tier 0): just `item._baseName` — e.g. `"Eisenklinge"`
- **Magic** (tier 1): one prefix OR one suffix — e.g. `"Sharp Eisenklinge"` or `"Eisenklinge of Strength"`
- **Rare** (tier 2): one prefix AND one suffix (skips third affix in name if it's a duplicate position) — e.g. `"Sharp Eisenklinge of Strength"`
- **Legendary** (tier 3): up to 2 prefixes + up to 2 suffixes — e.g. `"Sharp Bloodthirsty Eisenklinge of Strength of the Tiger"`. If too long, fall back to single prefix + single suffix and append `[Legendary]` indicator.

**Pure function.**

---

### `LootSystem.recomputeBonuses()`
**Signature:** `() → AggregatedBonuses`

**Side effects:** Reads `window.equipment` (the equipped item set), iterates all affixes, sums them into the cache, bumps `version`, calls `window._refreshAbilityHUD?.()` if defined.

**When to call:** Whenever the equipped item set changes (equip / unequip / item replaced / migration on save load).

---

### `LootSystem.getBonus(statKey)`
**Signature:** `(string) → number`

**Returns:** The aggregated bonus for that stat from the precomputed cache. O(1) object lookup.

- For `flat` stats: returns the additive bonus (e.g. `30` for `+30 HP`)
- For `percent` stats: returns the multiplier delta (e.g. `0.18` for `+18% Spin Attack Damage`, or `-0.12` for `-12% Charged Slash Cooldown`)
- Returns `0` if the stat is not present in the cache (no items contribute).

**Performance:** O(1). Called from combat code on every ability fire.

---

### `LootSystem.grantGold(amount)`
**Signature:** `(number) → void`

Adds `amount` to the player's gold counter. Bumps the HUD via `window._refreshHUD?.()`.

---

### `LootSystem.getGold()`
**Signature:** `() → number`

Returns the current gold count.

---

### `LootSystem.spendGold(amount)`
**Signature:** `(number) → boolean`

Returns `true` and deducts gold if the player has enough; returns `false` otherwise.

---

### `LootSystem.POTION_DEFS`
**Type:** `Potion[]`
**Mutability:** Read-only
**Purpose:** The 4 potion tier templates defined in `data-model.md`.

---

### `LootSystem.consumePotion(slot)`
**Signature:** `(number) → boolean`

Consumes one potion from inventory `slot`. Triggers HoT, sets cooldown.

**Returns:** `true` if consumed, `false` if slot is empty / not a potion / on cooldown.

---

### `LootSystem.onPotionKey()`
**Signature:** `() → boolean`

The `F` key handler. Finds the highest-tier potion stack in inventory and consumes one. Returns `true` if a potion was used, `false` if no potions / on cooldown.

---

### `LootSystem.isPotionOnCooldown()`
**Signature:** `() → boolean`

True if the global potion cooldown is active.

---

### `LootSystem.getOrCreateShopState()`
**Signature:** `() → ShopState`

Returns the current shop state. If the player has started a new dungeon run since the last refresh, regenerates the `itemStock`.

---

### `LootSystem.rerollItem(item, costGold)`
**Signature:** `(Item, number) → Item`

**Pre-conditions:** Player has at least `costGold` gold; `item` has a valid `tier` and `iLevel`.

**Behavior:**
1. Verify cost via `spendGold(costGold)`.
2. If successful, re-randomize `item.affixes` using `rollAffixes(item.iLevel, item.tier)`.
3. Recompose `item.displayName`.
4. Return the mutated item.

**Throws:** if cost cannot be paid (caller should check `spendGold` return).

---

### `LootSystem.migrateSave(saveData)`
**Signature:** `(SaveData) → SaveData`

**Idempotent.** Strips old fields (`rarity`, `rarityValue`, `rarityLabel`, `enhanceLevel`) from `saveData.inventory[]` and `saveData.equipment[]` items. Adds new fields (`tier=0`, `affixes=[]`, `iLevel=1`, `requiredLevel=1`, `displayName`).

If `saveData.saveVersion >= 2`, returns `saveData` unchanged.

After migration, sets `saveData.saveVersion = 2`.

---

## Internal helpers (not exported)

These exist inside the IIFE but are not on `window.LootSystem`:

- `_pickWeightedRandom(items, rng)` — weighted random pick
- `_filterEligibleAffixes(iLevel, itemType)` — returns AFFIX_DEFS filtered by `iLevelMin` and `appliesTo`
- `_resolveAffixValue(affixDef, rng)` — rolls value within range
- `_potionGoldCost(tier)` — looks up cost from POTION_DEFS

---

## Test contract

`tests/lootSystem.test.js` MUST cover:

1. **`rollAffixes(iLevel, count, seededRng)` returns deterministic results.** Given the same RNG seed, two calls produce identical results.
2. **`rollAffixes` respects iLevelMin filter.** With `iLevel=1`, the global affixes (`of_might`, `of_haste`) MUST NOT be selected.
3. **`rollAffixes` returns at most `count` affixes.** Even when the pool is smaller, no error thrown.
4. **`rollAffixes` returns no duplicate `defId`.** Each affix is unique per item.
5. **`composeName(item)` for Common items returns `_baseName`.**
6. **`composeName(item)` for Magic items prefixes OR suffixes the name.** Never both.
7. **`composeName(item)` for Rare items uses prefix + suffix.**
8. **`recomputeBonuses` aggregates correctly.** Two items with `damage` affixes sum their values.
9. **`getBonus` returns 0 for unknown statKey.**
10. **`getBonus` returns the correct value for percent vs flat affixes.**
11. **`migrateSave` strips old `rarity` and `rarityValue` fields from items.**
12. **`migrateSave` is idempotent — running twice produces identical result.**
13. **`migrateSave` skips already-migrated items (`saveVersion >= 2`).**
14. **`spendGold` returns false on insufficient funds and does not deduct.**
15. **Reroll cost formula matches the documented `baseCost * tierMultiplier * iLevelMultiplier`.**
