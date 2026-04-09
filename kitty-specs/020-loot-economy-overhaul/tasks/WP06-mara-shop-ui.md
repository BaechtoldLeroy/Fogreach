---
work_package_id: WP06
title: Mara Shop UI
dependencies: []
requirement_refs:
- FR-017
- FR-018
- FR-019
- FR-020
- FR-021
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this feature were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: 020-loot-economy-overhaul-WP05
base_commit: d13015d401455e48e3e92138dafdfb19544d645d
created_at: '2026-04-09T17:47:27.393390+00:00'
subtasks: [T035, T036, T037, T038, T039, T040, T041, T042, T043]
shell_pid: "52720"
agent: "claude"
history:
- {ts: '2026-04-09T14:30:00Z', action: created, actor: /spec-kitty.tasks}
authoritative_surface: js/scenes/ShopScene.js
execution_mode: code_change
lane: planned
owned_files:
- js/scenes/ShopScene.js
- js/scenes/HubSceneV2.js
---

# WP06 — Mara Shop UI

## Objective

Add Mara's "Schwarzmarkt" dialog action that opens a Phaser modal `ShopScene` with 3 tabs (Items / Tränke / Reroll). Items refresh per dungeon run. Reroll mutates an item's affixes for a gold cost.

## Context

Read first:
- [../spec.md](../spec.md) — FR-017 to FR-021, scenario 4 (first shop visit) + scenario 6 (reroll)
- [../contracts/shopScene.api.md](../contracts/shopScene.api.md) — scene lifecycle + tab layout
- [../research.md](../research.md) — R-001 (scene.launch pattern), R-009 (reroll cost formula)
- [../data-model.md](../data-model.md) — `ShopState` and `RerollPricing` shapes

## Branch Strategy

- `planning_base_branch`: `main`
- `merge_target_branch`: `main`
- Stacks on WP02, WP03, WP04. All three must be merged into `main` first.
- Implementation command: `spec-kitty implement WP06 --base WP04` (any of WP02/03/04 works as a base, but the implementation pulls all 3)

## Files Owned

- `js/scenes/ShopScene.js` (NEW)
- `js/lootSystem.js` (you ADD bodies for getOrCreateShopState + rerollItem; no other changes)
- `js/scenes/HubSceneV2.js` (you ADD a "Schwarzmarkt" dialog action to Mara; no other changes)
- `js/main.js` (you ADD ShopScene to scene array; no other changes)
- `index.html` (you ADD ONE script tag)

## Subtasks

### T035 — Create ShopScene skeleton + register

**Purpose:** Create the Phaser scene class file and register it with the game config.

**Steps:**
1. Create `js/scenes/ShopScene.js`:
   ```js
   class ShopScene extends Phaser.Scene {
     constructor() {
       super({ key: 'ShopScene' });
     }

     create(data) {
       this.parentSceneKey = (data && data.from) || null;
       this.activeTab = 'items';
       this.tabContent = null;       // current tab body container
       this.selectedRerollItem = null;
       this.shopState = window.LootSystem ? window.LootSystem.getOrCreateShopState() : { itemStock: [] };
       this._buildLayout();
       this._renderTab('items');
     }

     _buildLayout() {
       // implemented in T036
     }

     _renderTab(tabName) {
       // implemented in T037/T038/T039
     }
   }

   window.ShopScene = ShopScene;
   ```
2. Add to `index.html` after `js/scenes/CraftingScene.js`:
   ```html
   <script src="js/scenes/ShopScene.js"></script>
   ```
3. Add to the scene array in `js/main.js`:
   ```js
   scene: [StartScene, HubSceneV2, CraftingScene, ShopScene, SettingsScene, TestTerrainScene, GameScene],
   ```

**Files:** `js/scenes/ShopScene.js` (~40 lines), `index.html` (1 line), `js/main.js` (1 word)

**Validation:** Reload, check `window.game.scene.scenes.find(s => s.scene.key === 'ShopScene')` — exists.

---

### T036 — Implement ShopScene.create() lifecycle (panel + tabs + close)

**Purpose:** The static UI shell — backdrop, panel, title, tab buttons row, gold counter, close button.

**Steps:**
1. Implement `_buildLayout()` to draw the static panel:
   ```js
   _buildLayout() {
     const cam = this.cameras.main;
     const cw = cam.width;
     const ch = cam.height;
     // Dim backdrop
     this.add.rectangle(cw/2, ch/2, cw, ch, 0x000000, 0.7).setScrollFactor(0).setDepth(2000);
     // Panel
     const panelW = Math.min(720, cw - 20);
     const panelH = Math.min(420, ch - 20);
     const px = cw/2;
     const py = ch/2;
     const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
     panel.fillStyle(0x10131c, 0.96).fillRoundedRect(px - panelW/2, py - panelH/2, panelW, panelH, 14);
     panel.lineStyle(3, 0xffd166, 0.9).strokeRoundedRect(px - panelW/2, py - panelH/2, panelW, panelH, 14);
     // Title
     this.add.text(px, py - panelH/2 + 14, 'Schwarzmarkt — Mara', {
       fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
     }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
     // Gold counter (bottom-left of panel)
     this.goldText = this.add.text(px - panelW/2 + 16, py + panelH/2 - 24, 'Gold: 0', {
       fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
     }).setScrollFactor(0).setDepth(2002);
     this._refreshGold();
     // Close button (bottom-right of panel)
     const closeBg = this.add.rectangle(px + panelW/2 - 110, py + panelH/2 - 24, 200, 28, 0x3a3a3a)
       .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(2002)
       .setInteractive({ useHandCursor: true });
     this.add.text(px + panelW/2 - 110, py + panelH/2 - 24, 'Schliessen [ESC]', {
       fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
     }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
     closeBg.on('pointerdown', () => this._close());
     // Tab buttons (3 rounded rects below the title)
     this._tabButtons = {};
     const tabs = ['items', 'potions', 'reroll'];
     const tabLabels = { items: 'Items', potions: 'Tränke', reroll: 'Reroll' };
     tabs.forEach((t, i) => {
       const tx = px - panelW/2 + 16 + i * 110;
       const ty = py - panelH/2 + 50;
       const bg = this.add.rectangle(tx + 50, ty + 14, 100, 26, 0x2a2a2a)
         .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
         .setInteractive({ useHandCursor: true });
       this.add.text(tx + 50, ty + 14, tabLabels[t], {
         fontFamily: 'monospace', fontSize: '12px', color: '#f1e9d8'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
       bg.on('pointerdown', () => this._renderTab(t));
       this._tabButtons[t] = bg;
     });
     // ESC handler
     this.input.keyboard.on('keydown-ESC', () => this._close());
     // Cleanup on shutdown
     this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
       this.input.keyboard.off('keydown-ESC');
     });
     // Track panel coords for tab body positioning
     this._panel = { px, py, panelW, panelH };
   }

   _refreshGold() {
     const gold = (window.LootSystem && window.LootSystem.getGold) ? window.LootSystem.getGold() : 0;
     if (this.goldText) this.goldText.setText('Gold: ' + gold);
   }

   _close() {
     this.scene.stop();
   }
   ```

**Files:** `js/scenes/ShopScene.js` (~80 lines added)

**Validation:** Force `window.openShopScene(hubScene)` from console — panel renders, ESC closes it.

---

### T037 — Implement Items tab body

**Purpose:** List the items currently for sale in Mara's stock. Each row has icon, name, tooltip, price, Buy button.

**Steps:**
1. Implement `_renderTab('items')` body:
   ```js
   _renderTab(tabName) {
     this.activeTab = tabName;
     // Tear down old tab body
     if (this.tabBody) {
       this.tabBody.forEach(g => g && g.destroy());
       this.tabBody = [];
     } else {
       this.tabBody = [];
     }
     if (tabName === 'items') this._renderItemsTab();
     else if (tabName === 'potions') this._renderPotionsTab();
     else if (tabName === 'reroll') this._renderRerollTab();
     // Visually highlight the active tab button
     for (const t in this._tabButtons) {
       this._tabButtons[t].setStrokeStyle(t === tabName ? 2 : 1, t === tabName ? 0xffd166 : 0x666666);
     }
   }

   _renderItemsTab() {
     const { px, py, panelW, panelH } = this._panel;
     const startY = py - panelH/2 + 90;
     const rowH = 36;
     const stock = (this.shopState && this.shopState.itemStock) || [];
     stock.forEach((item, i) => {
       const ry = startY + i * rowH;
       // Row background
       const rowBg = this.add.rectangle(px, ry + rowH/2, panelW - 30, rowH - 4, 0x2a2a2a)
         .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2002);
       this.tabBody.push(rowBg);
       // Item name (colored by tier)
       const tierColors = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
       const nameText = this.add.text(px - panelW/2 + 24, ry + 8, item.displayName || item._baseName || 'Item', {
         fontFamily: 'monospace', fontSize: '12px', color: tierColors[item.tier || 0]
       }).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(nameText);
       // Affix lines (if any)
       if (item.affixes && item.affixes.length > 0) {
         const affixSummary = item.affixes.map((a) => {
           const def = window.LootSystem.AFFIX_DEFS.find((d) => d.id === a.defId);
           return def ? def.tooltipText.replace('{value}', a.value) : '';
         }).join(' · ');
         const affixText = this.add.text(px - panelW/2 + 24, ry + 21, affixSummary, {
           fontFamily: 'monospace', fontSize: '9px', color: '#888888',
           wordWrap: { width: panelW - 200 }
         }).setScrollFactor(0).setDepth(2003);
         this.tabBody.push(affixText);
       }
       // Price
       const price = this._computeItemPrice(item);
       const priceText = this.add.text(px + panelW/2 - 100, ry + 12, price + ' Gold', {
         fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
       }).setOrigin(0, 0).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(priceText);
       // Buy button
       const buyBg = this.add.rectangle(px + panelW/2 - 30, ry + rowH/2, 50, 22, 0x3a3a3a)
         .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2003)
         .setInteractive({ useHandCursor: true });
       const buyText = this.add.text(px + panelW/2 - 30, ry + rowH/2, 'Kaufen', {
         fontFamily: 'monospace', fontSize: '10px', color: '#f1e9d8'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
       this.tabBody.push(buyBg);
       this.tabBody.push(buyText);
       buyBg.on('pointerdown', () => this._tryBuyItem(i, price));
     });
   }

   _computeItemPrice(item) {
     const tierMul = [10, 50, 200, 800];
     return Math.round((tierMul[item.tier || 0]) * (1 + (item.iLevel || 1) * 0.1));
   }

   _tryBuyItem(stockIdx, price) {
     if (!window.LootSystem.spendGold(price)) {
       this._showToast('Nicht genug Gold');
       return;
     }
     const item = this.shopState.itemStock[stockIdx];
     // Add to inventory
     if (Array.isArray(window.inventory)) {
       const slot = window.inventory.findIndex((s) => !s);
       if (slot < 0) {
         this._showToast('Inventar voll');
         window.LootSystem.grantGold(price);  // refund
         return;
       }
       window.inventory[slot] = item;
     }
     // Remove from stock
     this.shopState.itemStock.splice(stockIdx, 1);
     this._refreshGold();
     this._renderTab('items');  // re-render to remove the row
     this._showToast('Gekauft: ' + (item.displayName || item._baseName));
   }

   _showToast(msg) {
     const cam = this.cameras.main;
     const txt = this.add.text(cam.width/2, cam.height - 60, msg, {
       fontFamily: 'monospace', fontSize: '13px', color: '#88ff88',
       backgroundColor: '#0c0c11dd', padding: { x: 8, y: 4 }
     }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
     this.tweens.add({
       targets: txt, alpha: 0, delay: 1500, duration: 400,
       onComplete: () => txt.destroy()
     });
   }
   ```

**Files:** `js/scenes/ShopScene.js` (~120 lines added)

**Validation:** Inject 1000 gold via console, open shop, see 6-8 items, buy one, see it appear in inventory.

---

### T038 — Implement Tränke tab body

**Purpose:** Sell potions of all 4 tiers.

**Steps:**
1. Implement `_renderPotionsTab()` similarly to items:
   ```js
   _renderPotionsTab() {
     const { px, py, panelW, panelH } = this._panel;
     const startY = py - panelH/2 + 90;
     const rowH = 56;
     const defs = window.LootSystem.POTION_DEFS;
     defs.forEach((def, i) => {
       const ry = startY + i * rowH;
       const rowBg = this.add.rectangle(px, ry + rowH/2, panelW - 30, rowH - 4, 0x2a2a2a)
         .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2002);
       this.tabBody.push(rowBg);
       const nameText = this.add.text(px - panelW/2 + 24, ry + 12, def.name, {
         fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
       }).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(nameText);
       const healText = this.add.text(px - panelW/2 + 24, ry + 30, '+' + Math.round(def.healPercent * 100) + '% MaxHP über 3s', {
         fontFamily: 'monospace', fontSize: '10px', color: '#88ff88'
       }).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(healText);
       const priceText = this.add.text(px + panelW/2 - 130, ry + 18, def.goldCost + ' Gold', {
         fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
       }).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(priceText);
       const buyBg = this.add.rectangle(px + panelW/2 - 40, ry + rowH/2, 60, 26, 0x3a3a3a)
         .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2003)
         .setInteractive({ useHandCursor: true });
       this.add.text(px + panelW/2 - 40, ry + rowH/2, 'Kaufen 1', {
         fontFamily: 'monospace', fontSize: '10px', color: '#f1e9d8'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
       this.tabBody.push(buyBg);
       buyBg.on('pointerdown', () => this._tryBuyPotion(def));
     });
   }

   _tryBuyPotion(def) {
     if (!window.LootSystem.spendGold(def.goldCost)) {
       this._showToast('Nicht genug Gold');
       return;
     }
     // Find existing stack of same tier or empty slot
     if (Array.isArray(window.inventory)) {
       let stacked = false;
       for (let i = 0; i < window.inventory.length; i++) {
         const it = window.inventory[i];
         if (it && it.type === 'potion' && it.potionTier === def.potionTier) {
           it.stack = (it.stack || 1) + 1;
           if (it.stack > def.stackSize) it.stack = def.stackSize;  // cap
           stacked = true;
           break;
         }
       }
       if (!stacked) {
         const slot = window.inventory.findIndex((s) => !s);
         if (slot < 0) {
           this._showToast('Inventar voll');
           window.LootSystem.grantGold(def.goldCost);  // refund
           return;
         }
         window.inventory[slot] = {
           type: 'potion', potionTier: def.potionTier, name: def.name,
           iconKey: def.iconKey, stack: 1
         };
       }
     }
     this._refreshGold();
     this._showToast('Gekauft: ' + def.name);
   }
   ```

**Files:** `js/scenes/ShopScene.js` (~80 lines added)

**Validation:** Buy a Minor potion → inventory has it. Buy 2 more → stack of 3. Buy a Major → new slot.

---

### T039 — Implement Reroll tab body

**Purpose:** Let the player drop in an inventory item and re-randomize its affixes for a gold cost.

**Steps:**
1. Implement `_renderRerollTab()`:
   ```js
   _renderRerollTab() {
     const { px, py, panelW, panelH } = this._panel;
     // Simple list of inventory items the player can pick from
     const items = (window.inventory || []).filter((it) => it && it.type !== 'potion' && it.tier !== undefined);
     if (items.length === 0) {
       const t = this.add.text(px, py, 'Keine reroll-baren Items im Inventar.', {
         fontFamily: 'monospace', fontSize: '13px', color: '#888888'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(t);
       return;
     }
     // Header
     const headerText = this.add.text(px, py - panelH/2 + 90, this.selectedRerollItem ? 'Ausgewähltes Item:' : 'Wähle ein Item:', {
       fontFamily: 'monospace', fontSize: '12px', color: '#cccccc'
     }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
     this.tabBody.push(headerText);

     if (this.selectedRerollItem) {
       const item = this.selectedRerollItem;
       const tierColors = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
       const nameText = this.add.text(px, py - panelH/2 + 116, item.displayName, {
         fontFamily: 'monospace', fontSize: '14px', color: tierColors[item.tier]
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(nameText);
       // Affix lines
       (item.affixes || []).forEach((a, i) => {
         const def = window.LootSystem.AFFIX_DEFS.find((d) => d.id === a.defId);
         if (!def) return;
         const lineText = this.add.text(px, py - panelH/2 + 138 + i * 16, def.tooltipText.replace('{value}', a.value), {
           fontFamily: 'monospace', fontSize: '11px', color: '#88ff88'
         }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
         this.tabBody.push(lineText);
       });
       // Cost + button
       const cost = this._computeRerollCost(item);
       const costText = this.add.text(px, py + panelH/2 - 80, 'Reroll-Kosten: ' + cost + ' Gold', {
         fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
       this.tabBody.push(costText);
       const rerollBg = this.add.rectangle(px - 60, py + panelH/2 - 50, 120, 30, 0x3a3a3a)
         .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(2003)
         .setInteractive({ useHandCursor: true });
       this.add.text(px - 60, py + panelH/2 - 50, 'Reroll', {
         fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
       this.tabBody.push(rerollBg);
       rerollBg.on('pointerdown', () => this._doReroll(cost));
       // Cancel button
       const cancelBg = this.add.rectangle(px + 60, py + panelH/2 - 50, 120, 30, 0x2a2a2a)
         .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2003)
         .setInteractive({ useHandCursor: true });
       this.add.text(px + 60, py + panelH/2 - 50, 'Anderes Item', {
         fontFamily: 'monospace', fontSize: '11px', color: '#cccccc'
       }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
       this.tabBody.push(cancelBg);
       cancelBg.on('pointerdown', () => { this.selectedRerollItem = null; this._renderTab('reroll'); });
     } else {
       // List inventory items as clickable rows
       items.slice(0, 8).forEach((item, idx) => {
         const ry = py - panelH/2 + 116 + idx * 26;
         const tierColors = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
         const rowBg = this.add.rectangle(px, ry, panelW - 60, 22, 0x2a2a2a)
           .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2003)
           .setInteractive({ useHandCursor: true });
         this.tabBody.push(rowBg);
         const nameText = this.add.text(px, ry, item.displayName || item._baseName || 'Item', {
           fontFamily: 'monospace', fontSize: '12px', color: tierColors[item.tier || 0]
         }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
         this.tabBody.push(nameText);
         rowBg.on('pointerdown', () => { this.selectedRerollItem = item; this._renderTab('reroll'); });
       });
     }
   }

   _computeRerollCost(item) {
     const tierMul = [1, 2, 5, 12];
     const t = item.tier || 0;
     return Math.round(50 * tierMul[t] * (1 + (item.iLevel || 1) * 0.05));
   }

   _doReroll(cost) {
     if (!this.selectedRerollItem) return;
     const ok = window.LootSystem.rerollItem(this.selectedRerollItem, cost);
     if (!ok) {
       this._showToast('Reroll fehlgeschlagen');
       return;
     }
     this._refreshGold();
     this._renderTab('reroll');
     this._showToast('Reroll erfolgreich!');
   }
   ```

**Files:** `js/scenes/ShopScene.js` (~150 lines added)

**Validation:** Open shop, click Reroll tab, click an item, see cost, click Reroll → item's affixes change.

---

### T040 — Implement openShopScene helper

**Purpose:** The clean entry point that opens the modal scene from the hub.

**Steps:**
1. At the bottom of `js/scenes/ShopScene.js`, add:
   ```js
   window.openShopScene = function (parentScene) {
     const game = window.game;
     if (!game) return;
     if (game.scene.isActive('ShopScene')) return;
     game.scene.launch('ShopScene', { from: (parentScene && parentScene.scene && parentScene.scene.key) || null });
   };
   ```
2. Matches the `window.openSettingsScene` pattern from feature 013.

**Files:** `js/scenes/ShopScene.js` (~10 lines added)

**Validation:** From any scene's console: `window.openShopScene(this)` → scene opens.

---

### T041 — Mara dialog "Schwarzmarkt" action

**Purpose:** Add a clickable dialog option to Mara that opens the shop.

**Steps:**
1. Open `js/scenes/HubSceneV2.js`. Find Mara's NPC entry in the dialog handler. Mara's `id` is `'mara'`.
2. Find `_handleDialogueChoice` or wherever NPC dialog actions are processed.
3. Add a new dialog action:
   ```js
   if (npcData.id === 'mara' && action === 'shop') {
     this._closeDialog(keyClosers);
     if (typeof window.openShopScene === 'function') {
       window.openShopScene(this);
     }
     return;
   }
   ```
4. Find Mara's dialog page setup (where her dialog lines + actions are constructed). Add a "Schwarzmarkt öffnen" button to her dialog page choices. Use the same pattern as existing quest accept/decline actions.

**Files:** `js/scenes/HubSceneV2.js` (~15 lines added)

**Validation:** Walk to Mara, press E, click "Schwarzmarkt öffnen" — shop opens.

---

### T042 — Implement getOrCreateShopState in lootSystem.js

**Purpose:** Provide the per-run shop stock generator.

**Steps:**
1. In `js/lootSystem.js`, replace the WP01 stub:
   ```js
   let _shopState = null;
   let _lastShopRunId = null;

   function getOrCreateShopState() {
     const currentRunId = (window.dungeonRun && window.dungeonRun.runId) || (window.currentRunSeed) || 'default';
     if (!_shopState || _lastShopRunId !== currentRunId) {
       _lastShopRunId = currentRunId;
       _shopState = {
         currentRunId: currentRunId,
         generatedAt: Date.now(),
         itemStock: _generateShopStock()
       };
     }
     return _shopState;
   }

   function _generateShopStock() {
     const stock = [];
     const depth = window.DUNGEON_DEPTH || window.currentWave || 3;
     const count = 6 + Math.floor(Math.random() * 3);  // 6-8 items
     for (let i = 0; i < count; i++) {
       try {
         stock.push(rollItem(null, depth));
       } catch (err) {
         // skip
       }
     }
     return stock;
   }
   ```
2. The runId concept may not exist yet — fallback to timestamp or `currentWave` so the state at least refreshes when entering a new dungeon run.

**Files:** `js/lootSystem.js` (~30 lines added)

**Validation:** `LootSystem.getOrCreateShopState().itemStock.length` → 6-8.

---

### T043 — Implement rerollItem in lootSystem.js

**Purpose:** The reroll mutation. Returns true on success, false on failure (insufficient gold).

**Steps:**
1. Replace the WP01 stub:
   ```js
   function rerollItem(item, costGold) {
     if (!item || item.tier === undefined) return false;
     if (!spendGold(costGold)) return false;
     // Re-roll affixes for the same tier and iLevel
     item.affixes = rollAffixes(item.iLevel, item.tier, Math.random, item.type);
     item.displayName = composeName(item);
     return true;
   }
   ```
2. The function MUTATES the item in place (per spec).

**Files:** `js/lootSystem.js` (~15 lines added)

**Validation:** Mock an item with 2 affixes, call `rerollItem(item, 50)` (with sufficient gold) → item.affixes changed, returned true.

---

## Definition of Done

- [ ] `ShopScene` registered and launches as a modal
- [ ] All 3 tabs (Items / Tränke / Reroll) render correctly
- [ ] Buying an item costs gold and adds to inventory
- [ ] Buying a potion costs gold and stacks correctly
- [ ] Reroll mutates an item's affixes and costs gold
- [ ] ESC closes the shop scene without stopping HubSceneV2
- [ ] Mara dialog has a "Schwarzmarkt" option that opens the shop
- [ ] `LootSystem.getOrCreateShopState()` regenerates per dungeon run
- [ ] `LootSystem.rerollItem(item, cost)` works as documented
- [ ] Smoke + unit tests still pass
- [ ] No console errors

## Risks

| Risk | Mitigation |
|---|---|
| Modal stacks with K-loadout or O-settings | Use isActive('ShopScene') guard in openShopScene |
| ESC handler also fires for parent scene | Phaser routes input to top-most active scene; verify parent doesn't react |
| Buying an item with full inventory loses gold | Refund gold on failed inventory push |
| Reroll cost can produce negative values for some edge cases | Math.max(1, computed) — add a floor |
| Shop stock regenerates when player walks to Mara mid-run | runId tracks the run, only refreshes when run changes |

## Reviewer Guidance

1. Walk to Mara, open shop. All 3 tabs visible.
2. Buy a potion → inventory gets it.
3. Buy an item → inventory gets it.
4. Try buying without enough gold → shows toast, no item added.
5. Reroll an item → affix values change.
6. Press ESC → shop closes, hub still rendered behind.
7. Walk away from Mara, then back, open shop → SAME stock (run hasn't changed).
8. Enter dungeon, complete a run, return to hub, open shop → DIFFERENT stock (new run).

## Activity Log

- 2026-04-09T17:47:27Z – claude – shell_pid=52720 – lane=doing – Started implementation via workflow command
- 2026-04-09T17:57:13Z – claude – shell_pid=52720 – lane=for_review – Mara shop complete; tests pass
