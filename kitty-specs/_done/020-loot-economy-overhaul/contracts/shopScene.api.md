# Contract: `ShopScene` (Phaser scene class)

**File:** `js/scenes/ShopScene.js`
**Pattern:** Phaser.Scene subclass + module-level `window.openShopScene` helper

## Class

```js
class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create(data) { /* ... */ }
}

window.ShopScene = ShopScene;
```

The class is registered in the Phaser game config's `scene: [...]` array (see `js/main.js` modifications).

## Public open helper

```js
window.openShopScene = function(parentScene) {
  const game = window.game;
  if (!game) return;
  if (game.scene.isActive('ShopScene')) return;
  game.scene.launch('ShopScene', { from: parentScene && parentScene.scene && parentScene.scene.key });
};
```

Matches the pattern used by `window.openSettingsScene` in `js/scenes/SettingsScene.js`.

## Lifecycle

### `create(data)`
**Parameters:** `data` — `{ from: 'HubSceneV2' }` (passed via `scene.launch`)

**Behavior:**
1. Set `this.parentSceneKey = data.from`.
2. Read shop state via `LootSystem.getOrCreateShopState()`.
3. Render the dim backdrop overlay (depth 2000).
4. Render the panel container (depth 2001+):
   - Title `"Schwarzmarkt — Mara"`
   - 3 tabs: `Items`, `Tränke`, `Reroll`
   - Active tab body
   - Bottom: gold counter `"Gold: NNN"`, close button `"Schliessen [ESC]"`
5. Wire up tab clicks + ESC handler.
6. Default to the `Items` tab.

### Tab: Items
- Lists 6-8 items from `shopState.itemStock`.
- Each item row: icon, name (colored by tier), tooltip with affix lines, price `Y Gold`, "Kaufen" button.
- Clicking "Kaufen": `LootSystem.spendGold(price)` → on success, push the item into `inventory[]`, remove from stock, refresh row.
- "Refresh stock" button at the bottom: NOT available during a single shop visit (per spec, refreshes per dungeon run).

### Tab: Tränke
- Lists all 4 potion tiers from `LootSystem.POTION_DEFS`.
- Each row: icon, name, heal amount, price, quantity available, "Kaufen 1" button.
- Clicking "Kaufen 1": spends gold, adds one potion to inventory at the appropriate stack.

### Tab: Reroll
- Drop zone area for the player to drag/drop one item from inventory (or click an inventory item to select).
- Once an item is selected:
  - Shows the item's current name + affixes
  - Shows the reroll cost (`50 * tierMult * (1 + iLevel * 0.05)`)
  - "Reroll" button calls `LootSystem.rerollItem(item, cost)` → mutates the item in-place → refresh display
- Without selection: shows hint "Wähle ein Item aus deinem Inventar".

### Close behavior
- ESC key, close button, or "B" key (Phaser convention for "back") all call `this.scene.stop()`.
- The `parentSceneKey` (HubSceneV2) was never stopped — it's still rendered behind the modal, so closing just removes the overlay.

## Data flow

```
Player presses E on Mara
   │
   └─→ HubSceneV2 dialog handler picks "Schwarzmarkt" action
         │
         └─→ window.openShopScene(this)
               │
               └─→ game.scene.launch('ShopScene', { from: 'HubSceneV2' })
                     │
                     └─→ ShopScene.create() runs
                           │
                           ├─→ LootSystem.getOrCreateShopState()
                           ├─→ render UI
                           └─→ wait for user action
```

```
Player clicks "Reroll" with selected item
   │
   ├─→ cost = computeRerollCost(item)
   ├─→ if (LootSystem.spendGold(cost))
   │     ├─→ LootSystem.rerollItem(item, cost)
   │     └─→ refresh the displayed item view
   └─→ else show "Nicht genug Gold" toast
```

## Performance

- The shop scene MUST open in < 250ms (NFR-002). No heavy work in `create()` — affix re-rolling for the shop stock happens once per run when the shop state is generated, not on every open.
- Tab switching is O(1) — destroy current tab body group, build new one.
- No per-frame work needed. The scene is mostly static UI.

## Test contract

There is no unit test for `ShopScene` itself (Phaser scene rendering is hard to test in node:test). Verification is via the smoke test:

`tools/testGame.js` MUST be extended with a "Shop Test" block that:

1. Inject 500 gold via `window.LootSystem.grantGold(500)`.
2. Trigger the shop opening via `window.openShopScene(hubScene)` directly.
3. Wait for `ShopScene` to be active.
4. Verify all 3 tabs exist as scene children.
5. Click the Reroll tab, simulate item selection, click Reroll button, verify the item's `affixes` array changed.
6. Press ESC, verify ShopScene is no longer active and HubSceneV2 still is.
7. Verify 0 console errors.
