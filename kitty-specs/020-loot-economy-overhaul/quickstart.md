# Quickstart: Loot & Economy Overhaul

**Feature:** 020-loot-economy-overhaul
**Audience:** Anyone (developer or playtester) who wants to verify the implemented feature works end-to-end.

This is the manual playtest checklist that satisfies the constitution's "manual playtest passes" gate.

---

## Setup

1. Pull `main`.
2. Start the dev server: `npx serve -p 3456` (or whatever the existing convention is — check `package.json`).
3. Open `http://127.0.0.1:3456/` in Edge or Chrome.
4. Open browser DevTools → Console tab. Keep it visible. **Zero errors during the entire walkthrough is the gate.**
5. Click **NEUES SPIEL** to start a fresh save.

---

## Walkthrough

### Step 1 — Hub spawn check

**Expected:**
- Player spawns in the hub.
- HUD top-left shows: `Damage`, `Speed`, `Range`, `Armor`, `Crit`, `Level`, `Dungeon Level`, `Eisenbrocken: 20`, `Gold: 50` (NEW).
- Inventory has 2 Minor Health Potions (NEW seed items per FR-028).
- No console errors.

### Step 2 — Talk to Mara

**Expected:**
- Walk to Mara (Speherin position).
- Press `E`.
- Dialog appears with the existing dialog options PLUS a new entry **"Schwarzmarkt"**.

### Step 3 — Open the Shop

**Expected:**
- Click "Schwarzmarkt".
- ShopScene overlay opens within < 250ms (NFR-002).
- Three tabs visible: **Items / Tränke / Reroll**.
- Bottom of panel: "Gold: 50" + "Schliessen [ESC]".

### Step 4 — Buy a Health Potion

**Expected:**
- Click the **Tränke** tab.
- See 4 potion tiers: Minor (25g), Normal (75g), Major (200g), Super (500g).
- Click "Kaufen 1" on Minor.
- Gold counter drops from 50 → 25.
- Inventory now has 3 Minor Health Potions.

### Step 5 — Buy a Magic item

**Expected:**
- Click the **Items** tab.
- See 6-8 randomly rolled items.
- At least one is Magic+ tier (yellow/blue/orange name color).
- Click "Kaufen" on a Magic item with affordable cost (if you can — if not, this step is verified via the next dungeon run).

### Step 6 — Close shop, enter dungeon

**Expected:**
- Press `ESC`. ShopScene closes. Hub is still rendered behind it (was not stopped).
- Walk to the Rathauskeller entrance.
- Press `E` to enter the dungeon.

### Step 7 — Kill an enemy, observe gold + item drop

**Expected:**
- Kill the first Imp.
- A gold pile appears on the floor (small yellow sprite).
- Walk over it. Gold counter increments by ~5-10.
- Sometimes an item drops too (existing chance, now with affixes).

### Step 8 — Pick up a Magic+ item

**Expected:**
- Find any item drop with a colored name (not gray = Magic, Rare, or Legendary).
- Pick it up.
- Open the inventory (`I` key).
- Hover over the item — tooltip shows the name AND a list of rolled affix lines (e.g. `+22% Damage`, `+18% Spin Attack Damage`).

### Step 9 — Equip an item with ability bonus

**Expected:**
- Find or buy an item with a per-ability damage or cooldown affix (e.g. `+18% Spin Attack Damage` or `-12% Charged Slash Cooldown`).
- Equip it via the inventory.
- Open HUD ability tile for that ability:
  - The tile MUST show a small `+18%` (or `-12%`) badge under the ability name.
  - When the ability is fired and goes on cooldown, the radial sweep MUST tick down faster (if cooldown reduction is equipped).

### Step 10 — Use a Health Potion

**Expected:**
- Take some damage in the dungeon (let an enemy hit you).
- Press `F`.
- A green HoT effect ticks up your HP over 3 seconds, healing 60% of Max HP (Normal tier) or 30% (Minor).
- Press `F` again immediately — nothing happens (2-second global cooldown active).
- Wait 2 seconds, press `F` again — works.

### Step 11 — Encounter an Elite Enemy

**Expected:**
- Continue to wave 6 or higher.
- At least one enemy in a room MUST spawn with:
  - Tinted sprite (color depends on its primary affix)
  - Aura particle effect around it
  - Floating name tag above it (e.g. "Fanatic Brute" or "Lightning Enchanted Imp")
- Kill it.
- It drops more loot than a regular enemy (at least 1 guaranteed Magic+ for Uniques, more gold).

### Step 12 — Return to hub, reroll an item

**Expected:**
- Return to the hub (via stair or game over).
- Talk to Mara again. The shop re-rolls its item stock for the new run.
- Open the **Reroll** tab.
- Select an item from your inventory (click or drag).
- Cost is shown (e.g. "120 Gold" for a Magic item at iLevel 5).
- Click "Reroll".
- The item's affixes are completely re-randomized — the new roll might be better, worse, or sideways.
- Gold counter decreases by the cost.

### Step 13 — Save & reload (migration test)

**Expected:**
- Close the browser tab.
- Reopen it.
- Click **FORTSETZEN**.
- Save loads correctly. Inventory items still have their affixes. Gold count preserved. No console errors.

### Step 14 — Old save migration test

**Expected:**
- (One-time check) If a save file from before this feature exists in localStorage:
- Load it.
- All old items are downgraded to Common (gray name, no affix lines in tooltip).
- The old `rarity` / `rarityValue` / `enhanceLevel` fields are stripped — verify in DevTools console: `JSON.parse(localStorage.demonfall_save_v1).inventory.find(i => i).rarity` → undefined.
- Game runs normally without errors.

---

## Smoke test (automated)

Run the existing smoke test, which has been extended with shop-open + reroll verification:

```bash
node tools/testGame.js --loadout
```

**Expected:**
- All existing 14 checks pass.
- New checks for shop-open and reroll pass.
- "Errors found: 0".

---

## Unit tests

Run the unit test suite for the new pure logic:

```bash
node tools/runTests.js
```

**Expected:**
- All existing 24 unit tests pass.
- New `tests/lootSystem.test.js` tests pass (15 tests per the contract).
- New `tests/eliteEnemies.test.js` tests pass (10 tests per the contract).
- Total: 49+ tests passing, 0 failures.

---

## Performance verification

In the dungeon, let 50+ gold piles accumulate on the floor (kill many enemies, don't pick up gold). The frame rate (visible in DevTools → Performance tab or via `Ctrl+Shift+I` → Rendering → FPS meter) MUST stay at 60 fps.

---

## Failure modes & rollback

If any of the above steps fail:

1. **Console errors** → block, do not merge. Fix the error, re-test.
2. **Item migration breaks an existing save** → block. The migration MUST be idempotent and safe.
3. **Performance drops below 60 fps** → investigate; likely the AggregatedBonuses cache isn't being used in the hot path or gold sprite count isn't bounded.
4. **Shop UI conflicts with K loadout overlay or O settings overlay** → fix scene-stack management; only one modal at a time.

The constitution is clear: "Quality Gates: Manual playtest passes, no console errors, combat and enemy AI behave correctly, no regressions in existing scenes."

This quickstart IS the manual playtest. If all 14 steps pass with no console errors, the feature is mergeable.
