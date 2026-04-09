// js/scenes/CraftingScene.js — Archivschmiede Crafting Scene
// Tier color map (WP08 T050): 0=Common, 1=Magic, 2=Rare, 3=Legendary.
// Reads window.TIER_COLORS (loot.js) with a local fallback so this module
// stays scene-graph friendly under the plain IIFE load order.
const _CRAFT_TIER_COLORS_FALLBACK = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
const _getTierColor = (item) => {
  if (!item) return '#666666';
  const t = Number(item.tier);
  const idx = Number.isFinite(t) ? Math.max(0, Math.min(3, Math.round(t))) : 0;
  const arr = (typeof window !== 'undefined' && window.TIER_COLORS) || _CRAFT_TIER_COLORS_FALLBACK;
  return arr[idx];
};
const _composeItemName = (item) => {
  if (!item) return '(leer)';
  if (window.LootSystem && typeof window.LootSystem.composeName === 'function') {
    try { return window.LootSystem.composeName(item); } catch (e) { /* fall through */ }
  }
  return item.displayName || item._baseName || item.name || 'Item';
};

class CraftingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CraftingScene' });
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // --- Colors ---
    const COL_BG       = 0x1a1a1a;
    const COL_GOLD     = '#d4a543';
    const COL_GOLD_HEX = 0xd4a543;
    const COL_PARCHMENT = '#f1e9d8';
    const COL_PANEL    = 0x2a2a2a;
    const COL_SLOT     = 0x333333;
    const COL_SLOT_SEL = 0x4a3a1a;
    const COL_BTN      = 0x3a3a3a;
    const COL_BTN_HOVER = 0x555555;
    const COL_DISABLED = '#666666';
    const COL_RED      = '#ff4444';
    const COL_GREEN    = '#44ff44';

    // --- Crafting recipes (tier 0 / Common items; no affixes). ---
    this.RECIPES = [
      {
        id: 'eisenklinge',
        name: 'Eisenklinge',
        type: 'weapon',
        cost: 15,
        item: {
          type: 'weapon', key: 'WPN_CRAFT', name: 'Eisenklinge',
          iconKey: 'itWeapon',
          tier: 0, affixes: [], iLevel: 1, itemLevel: 1,
          baseStats: { damage: 8 },
          hp: 0, damage: 8, speed: 0, range: 0, armor: 0, crit: 0
        }
      },
      {
        id: 'kettenhaube',
        name: 'Kettenhaube',
        type: 'head',
        cost: 12,
        item: {
          type: 'head', key: 'HD_CRAFT', name: 'Kettenhaube',
          iconKey: 'itHead',
          tier: 0, affixes: [], iLevel: 1, itemLevel: 1,
          baseStats: { armor: 5 },
          hp: 0, damage: 0, speed: 0, range: 0, armor: 5, crit: 0
        }
      },
      {
        id: 'lederstiefel',
        name: 'Lederstiefel',
        type: 'boots',
        cost: 10,
        item: {
          type: 'boots', key: 'BT_CRAFT', name: 'Lederstiefel',
          iconKey: 'itBoots',
          tier: 0, affixes: [], iLevel: 1, itemLevel: 1,
          baseStats: { speed: 15 },
          hp: 0, damage: 0, speed: 15, range: 0, armor: 0, crit: 0
        }
      }
    ];

    // --- State ---
    // Selection model: { kind: 'equip'|'inv', key: <slot-name|inventory-index> } | null
    this._selection = null;
    // Legacy alias kept for any external reads
    this._selectedSlot = null;

    // --- Background ---
    this.add.rectangle(W / 2, H / 2, W, H, COL_BG).setDepth(0);

    // Draw procedural forge background
    this._drawForgeBackground(W, H);

    // --- Title ---
    this.add.text(W / 2, 20, 'ARCHIVSCHMIEDE', {
      fontFamily: 'monospace', fontSize: '24px', color: COL_GOLD,
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(10);

    // --- Eisenbrocken counter ---
    this.matText = this.add.text(W / 2, 50, '', {
      fontFamily: 'monospace', fontSize: '16px', color: COL_PARCHMENT
    }).setOrigin(0.5, 0).setDepth(10);
    this._updateMatText();

    // --- Left panel: Equipment enhancement ---
    const leftX = 30;
    const panelY = 80;
    const panelW = (W / 2) - 50;
    const panelH = H - 140;

    this.add.text(leftX + panelW / 2, panelY, 'Ausruestung verbessern', {
      fontFamily: 'monospace', fontSize: '16px', color: COL_GOLD
    }).setOrigin(0.5, 0).setDepth(10);

    // ----- Equipped slots (top of left panel) -----
    const slots = ['weapon', 'head', 'body', 'boots'];
    const slotLabels = { weapon: 'Waffe', head: 'Helm', body: 'Ruestung', boots: 'Stiefel' };
    this.equipSlots = {};
    this.equipSlotBgs = {};

    const slotStartY = panelY + 24;
    const slotH = 36;
    const slotW = panelW;

    slots.forEach((slot, i) => {
      const sy = slotStartY + i * (slotH + 4);
      const bg = this.add.rectangle(leftX + slotW / 2, sy + slotH / 2, slotW, slotH, COL_SLOT)
        .setDepth(9).setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(2, 0x444444);

      const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
      const nameStr = item ? _composeItemName(item) : '(leer)';
      const color = item ? _getTierColor(item) : COL_DISABLED;

      // Compact one-line layout: [Slot] Name (stats)
      const label = this.add.text(leftX + 8, sy + 4, '[' + slotLabels[slot] + ']', {
        fontFamily: 'monospace', fontSize: '10px', color: COL_GOLD
      }).setDepth(10);

      const nameText = this.add.text(leftX + 8, sy + 16, nameStr, {
        fontFamily: 'monospace', fontSize: '11px', color: color
      }).setDepth(10);

      const statsText = this.add.text(leftX + 8, sy + 26, item ? this._getStatsLine(item) : '', {
        fontFamily: 'monospace', fontSize: '9px', color: '#888888'
      }).setDepth(10);

      bg.on('pointerdown', () => this._selectEquip(slot));
      bg.on('pointerover', () => {
        if (!this._isSelected('equip', slot)) bg.setFillStyle(COL_BTN_HOVER);
      });
      bg.on('pointerout', () => {
        if (!this._isSelected('equip', slot)) bg.setFillStyle(COL_SLOT);
      });

      this.equipSlots[slot] = { bg, label, nameText, statsText };
      this.equipSlotBgs[slot] = bg;
    });

    // ----- Inventory list (middle of left panel) -----
    const invHeaderY = slotStartY + 4 * (slotH + 4) + 8;
    this.add.text(leftX + 8, invHeaderY, 'Inventar (Equipment)', {
      fontFamily: 'monospace', fontSize: '10px', color: COL_GOLD
    }).setDepth(10);

    this.invListY = invHeaderY + 14;
    this.invRowH = 28;
    this.invMaxRows = 3;
    this.invScrollOffset = 0; // index of the first visible row
    this.invRows = [];
    this.invListBg = this.add.rectangle(
      leftX + slotW / 2,
      this.invListY + (this.invRowH * this.invMaxRows) / 2,
      slotW, this.invRowH * this.invMaxRows, 0x1f1f1f
    ).setDepth(8).setStrokeStyle(1, 0x444444);

    this.invEmptyText = this.add.text(
      leftX + slotW / 2,
      this.invListY + (this.invRowH * this.invMaxRows) / 2,
      '(keine Equipment-Items)', {
        fontFamily: 'monospace', fontSize: '10px', color: COL_DISABLED
      }
    ).setOrigin(0.5).setDepth(10);

    this.invOverflowText = this.add.text(
      leftX + slotW - 8,
      this.invListY + this.invRowH * this.invMaxRows + 2,
      '', {
        fontFamily: 'monospace', fontSize: '9px', color: COL_DISABLED
      }
    ).setOrigin(1, 0).setDepth(10);

    // ----- Salvage section (bottom of left panel) -----
    // WP08 T050: Verbessern button removed. Reroll vendor at Mara (ShopScene)
    // replaces the old enhance flow. Salvage stays for converting unwanted
    // equipment into Eisenbrocken.
    const enhY = this.invListY + this.invRowH * this.invMaxRows + 14;
    this.enhanceInfo = this.add.text(leftX + 8, enhY, 'Klicke einen Slot oder ein Inventar-Item zum Verbessern oder Zerlegen.\nReroll bei Mara im Schwarzmarkt.', {
      fontFamily: 'monospace', fontSize: '10px', color: COL_PARCHMENT,
      wordWrap: { width: slotW - 16 }
    }).setDepth(10);

    // Post-WP08 hotfix: Verbessern button is BACK, but with new semantics —
    // it now bumps the item's tier (Common → Magic → Rare → Legendary) and
    // re-rolls a fresh affix set for the new tier. Cost scales with the
    // target tier. The reroll vendor at Mara stays for affix-only rerolls.
    this.enhanceBtn = this._createButton(
      leftX + slotW / 2 - 60, enhY + 40, 110, 26,
      'Verbessern', () => this._enhanceItem()
    );
    this.enhanceBtn.container.setVisible(false);

    this.salvageBtn = this._createButton(
      leftX + slotW / 2 + 60, enhY + 40, 110, 26,
      'Zerlegen', () => this._salvageItem()
    );
    this.salvageBtn.container.setVisible(false);

    // --- Right panel: Crafting recipes ---
    const rightX = W / 2 + 20;
    const rightW = (W / 2) - 50;

    this.add.text(rightX + rightW / 2, panelY, 'Schmiedeplaene', {
      fontFamily: 'monospace', fontSize: '16px', color: COL_GOLD
    }).setOrigin(0.5, 0).setDepth(10);

    const recipeStartY = panelY + 30;
    const recipeH = 80;

    this.recipeElements = [];
    this.RECIPES.forEach((recipe, i) => {
      const ry = recipeStartY + i * (recipeH + 10);
      const bg = this.add.rectangle(rightX + rightW / 2, ry + recipeH / 2, rightW, recipeH, COL_SLOT)
        .setDepth(9).setStrokeStyle(2, 0x444444);

      const title = this.add.text(rightX + 10, ry + 8, recipe.name, {
        fontFamily: 'monospace', fontSize: '14px', color: COL_PARCHMENT, fontStyle: 'bold'
      }).setDepth(10);

      const desc = this.add.text(rightX + 10, ry + 26, this._getRecipeDesc(recipe), {
        fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa'
      }).setDepth(10);

      const canAfford = getMaterialCount('MAT') >= recipe.cost;
      const hasSpace = this._hasInventorySpace();
      const costColor = canAfford ? COL_GREEN : COL_RED;
      const costText = this.add.text(rightX + 10, ry + 42, `Kosten: ${recipe.cost} Eisenbrocken`, {
        fontFamily: 'monospace', fontSize: '11px', color: costColor
      }).setDepth(10);

      const craftBtn = this._createButton(
        rightX + rightW - 60, ry + recipeH / 2, 100, 30,
        'Schmieden', () => this._craftRecipe(recipe, i)
      );

      if (!canAfford || !hasSpace) {
        craftBtn.bg.setFillStyle(0x222222);
        craftBtn.text.setColor(COL_DISABLED);
      }

      bg.on('pointerover', () => bg.setFillStyle(COL_BTN_HOVER));
      bg.on('pointerout', () => bg.setFillStyle(COL_SLOT));

      this.recipeElements.push({ bg, title, desc, costText, craftBtn });
    });

    // --- Feedback text ---
    this.feedbackText = this.add.text(W / 2, H - 60, '', {
      fontFamily: 'monospace', fontSize: '14px', color: COL_GREEN
    }).setOrigin(0.5, 0).setDepth(10);

    // --- Back button ---
    const backBtn = this._createButton(W / 2, H - 25, 220, 32, 'Zurueck zum Hub [ESC]', () => this._returnToHub());

    // Initial render of inventory list
    this._refreshInventoryList();

    // Scroll handlers for the inventory list (mousewheel + arrow keys)
    this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
      if (dy > 0) this._scrollInventory(1);
      else if (dy < 0) this._scrollInventory(-1);
    });
    this.input.keyboard.on('keydown-DOWN', () => this._scrollInventory(1));
    this.input.keyboard.on('keydown-UP', () => this._scrollInventory(-1));

    // ESC key to return
    this.input.keyboard.on('keydown-ESC', this._returnToHub, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ESC', this._returnToHub, this);
      this.input.keyboard.off('keydown-DOWN');
      this.input.keyboard.off('keydown-UP');
      this.input.off('wheel');
    });
  }

  _scrollInventory(delta) {
    this.invScrollOffset = Math.max(0, this.invScrollOffset + delta);
    this._refreshInventoryList();
  }

  // =================== Forge Background ===================
  _drawForgeBackground(W, H) {
    const g = this.add.graphics().setDepth(1);

    // Stone floor
    g.fillStyle(0x2d2d2d, 1);
    g.fillRect(0, H * 0.7, W, H * 0.3);
    // Floor stones
    g.fillStyle(0x363636, 1);
    for (let x = 0; x < W; x += 48) {
      for (let y = H * 0.7; y < H; y += 32) {
        const offset = (Math.floor(y / 32) % 2) * 24;
        g.fillRect(x + offset + 1, y + 1, 46, 30);
      }
    }

    // Anvil silhouette (center-left)
    g.fillStyle(0x222222, 1);
    g.fillRect(80, H * 0.55, 60, 8);
    g.fillRect(90, H * 0.55 + 8, 40, 30);
    g.fillRect(85, H * 0.55 + 38, 50, 8);
    g.fillRect(95, H * 0.55 + 46, 30, 20);
    g.fillRect(88, H * 0.55 + 66, 44, 6);

    // Forge glow (right side)
    g.fillStyle(0xff5a1a, 0.08);
    g.fillCircle(W - 80, H * 0.5, 100);
    g.fillStyle(0xffc04a, 0.05);
    g.fillCircle(W - 80, H * 0.5, 60);

    // Embers
    g.fillStyle(0xff8833, 0.12);
    for (let i = 0; i < 12; i++) {
      const ex = W - 120 + Math.random() * 80;
      const ey = H * 0.3 + Math.random() * (H * 0.4);
      g.fillCircle(ex, ey, 1 + Math.random() * 2);
    }
  }

  // =================== UI Helpers ===================
  _createButton(x, y, w, h, label, callback) {
    const bg = this.add.rectangle(x, y, w, h, 0x3a3a3a).setDepth(9)
      .setStrokeStyle(2, 0xd4a543).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '12px', color: '#f1e9d8'
    }).setOrigin(0.5).setDepth(10);

    bg.on('pointerover', () => bg.setFillStyle(0x555555));
    bg.on('pointerout', () => bg.setFillStyle(0x3a3a3a));
    bg.on('pointerdown', callback);

    const container = this.add.container(0, 0, [bg, text]).setDepth(10);
    return { container, bg, text };
  }

  _updateMatText() {
    const count = getMaterialCount('MAT');
    this.matText.setText(`Eisenbrocken: ${count}`);
  }

  _getStatsLine(item) {
    if (!item) return '';
    const parts = [];
    const stats = ['hp', 'damage', 'speed', 'range', 'armor', 'crit'];
    const labels = { hp: 'LP', damage: 'Schaden', speed: 'Tempo', range: 'Reichw.', armor: 'Ruestung', crit: 'Krit' };
    stats.forEach(s => {
      const val = item[s];
      if (val && val !== 0) {
        parts.push(`${labels[s]}:${typeof val === 'number' && val < 1 && val > 0 ? val.toFixed(2) : val}`);
      }
    });
    // Append a compact affix count, e.g. "[2 affix]" for magic/rare/legendary.
    if (Array.isArray(item.affixes) && item.affixes.length) {
      parts.push(`[${item.affixes.length} affix]`);
    }
    return parts.join(' | ');
  }

  _getRecipeDesc(recipe) {
    const item = recipe.item;
    const parts = [];
    if (item.damage) parts.push(`Schaden: ${item.damage}`);
    if (item.armor) parts.push(`Ruestung: ${item.armor}`);
    if (item.speed) parts.push(`Tempo: ${item.speed}`);
    if (item.hp) parts.push(`LP: ${item.hp}`);
    return parts.join(' | ');
  }

  _hasInventorySpace() {
    if (typeof inventory === 'undefined' || !Array.isArray(inventory)) return false;
    return inventory.some(slot => !slot);
  }

  // =================== Selection ===================
  _isSelected(kind, key) {
    return this._selection && this._selection.kind === kind && this._selection.key === key;
  }

  _getSelectedItem() {
    if (!this._selection) return null;
    if (this._selection.kind === 'equip') {
      return (typeof equipment !== 'undefined') ? equipment[this._selection.key] : null;
    }
    if (this._selection.kind === 'inv') {
      return (typeof inventory !== 'undefined') ? inventory[this._selection.key] : null;
    }
    return null;
  }

  _setSelectedItem(newItem) {
    if (!this._selection) return;
    if (this._selection.kind === 'equip') {
      equipment[this._selection.key] = newItem;
    } else if (this._selection.kind === 'inv') {
      inventory[this._selection.key] = newItem;
      if (typeof window !== 'undefined') window.inventory = inventory;
    }
  }

  _clearVisualSelection() {
    // Reset all equip slot bg
    Object.keys(this.equipSlotBgs).forEach((slot) => {
      this.equipSlotBgs[slot].setFillStyle(0x333333);
      this.equipSlotBgs[slot].setStrokeStyle(2, 0x444444);
    });
    // Reset all inventory rows (they're rebuilt on every refresh, but harmless)
    (this.invRows || []).forEach((row) => {
      if (row.bg && row.bg.setFillStyle) {
        row.bg.setFillStyle(0x2a2a2a);
        row.bg.setStrokeStyle(1, 0x444444);
      }
    });
  }

  _applySelection(kind, key) {
    this._selection = { kind, key };
    this._selectedSlot = (kind === 'equip') ? key : null; // legacy alias

    this._clearVisualSelection();

    if (kind === 'equip') {
      const bg = this.equipSlotBgs[key];
      if (bg) {
        bg.setFillStyle(0x4a3a1a);
        bg.setStrokeStyle(2, 0xd4a543);
      }
    } else {
      const row = (this.invRows || []).find((r) => r.invIndex === key);
      if (row && row.bg) {
        row.bg.setFillStyle(0x4a3a1a);
        row.bg.setStrokeStyle(2, 0xd4a543);
      }
    }

    this._showEnhanceInfoForSelection();
  }

  _selectEquip(slot) {
    const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
    if (!item) {
      this._showFeedback('Kein Gegenstand in diesem Slot.', '#ff4444');
      return;
    }
    this._applySelection('equip', slot);
  }

  _selectInventory(idx) {
    const item = (typeof inventory !== 'undefined') ? inventory[idx] : null;
    if (!item) return;
    this._applySelection('inv', idx);
  }

  _showEnhanceInfoForSelection() {
    const item = this._getSelectedItem();
    if (!item) return;

    this.salvageBtn.container.setVisible(true);

    // Tier/affix-aware info panel.
    const tier = (typeof item.tier === 'number') ? item.tier : 0;
    const tierLabels = ['Gewoehnlich', 'Magisch', 'Selten', 'Legendaer'];
    const affixCount = Array.isArray(item.affixes) ? item.affixes.length : 0;
    const enhanceCost = this._getEnhanceCost(item);
    const canEnhance = tier < 3;
    if (this.enhanceBtn) {
      this.enhanceBtn.container.setVisible(canEnhance);
    }
    const lines = [
      `${_composeItemName(item)}`,
      `Tier: ${tierLabels[Math.max(0, Math.min(3, tier))]}  |  Affixe: ${affixCount}`
    ];
    if (canEnhance) {
      lines.push(`Verbessern: -> ${tierLabels[tier + 1]} (${enhanceCost} Eisenbrocken)`);
    } else {
      lines.push('Bereits Legendaer — keine Verbesserung moeglich.');
    }
    lines.push('Reroll verfuegbar bei Mara (Schwarzmarkt).');
    this.enhanceInfo.setText(lines.join('\n'));
  }

  _getEnhanceCost(item) {
    const tier = (typeof item?.tier === 'number') ? item.tier : 0;
    // Common→Magic=10, Magic→Rare=25, Rare→Legendary=60
    const costs = [10, 25, 60];
    return costs[Math.max(0, Math.min(2, tier))];
  }

  // =================== Enhance (tier bump) ===================
  _enhanceItem() {
    const item = this._getSelectedItem();
    if (!item) return;
    const tier = (typeof item.tier === 'number') ? item.tier : 0;
    if (tier >= 3) {
      this._showFeedback('Item ist bereits Legendaer.', '#ff4444');
      return;
    }
    const cost = this._getEnhanceCost(item);
    if (getMaterialCount('MAT') < cost) {
      this._showFeedback(`Nicht genug Eisenbrocken (${cost} noetig).`, '#ff4444');
      return;
    }
    if (typeof changeMaterialCount === 'function') {
      changeMaterialCount('MAT', -cost);
    }

    // Bump tier + re-roll affixes for the new tier.
    const newTier = tier + 1;
    item.tier = newTier;
    if (window.LootSystem && typeof window.LootSystem.rollAffixes === 'function') {
      const iLevel = (typeof item.iLevel === 'number') ? item.iLevel : 1;
      try {
        item.affixes = window.LootSystem.rollAffixes(iLevel, newTier, Math.random, item.type);
      } catch (e) { /* swallow */ }
    }
    if (window.LootSystem && typeof window.LootSystem.composeName === 'function') {
      try { item.displayName = window.LootSystem.composeName(item); } catch (e) {}
    }
    // Recompute aggregated bonuses since affixes changed
    if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
      try { window.LootSystem.recomputeBonuses(); } catch (e) {}
    }
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) {}
    }
    this._refreshAll();
    this._showEnhanceInfoForSelection();
    const tierLabels = ['Gewoehnlich', 'Magisch', 'Selten', 'Legendaer'];
    this._showFeedback(`Verbessert auf ${tierLabels[newTier]}!`, '#88ff88');
    this._flashEffect();
  }

  // =================== Salvage ===================
  _salvageItem() {
    const item = this._getSelectedItem();
    if (!item) return;

    // Salvage value: (tier + 1) * 3 — Common=3, Magic=6, Rare=9, Legendary=12.
    const tier = (typeof item.tier === 'number') ? item.tier : 0;
    const matValue = (Math.max(0, Math.min(3, tier)) + 1) * 3;

    // Remove item from its source (equipment slot or inventory slot)
    this._setSelectedItem(null);

    // Add materials
    if (typeof changeMaterialCount === 'function') {
      changeMaterialCount('MAT', matValue);
    } else if (typeof materialCounts !== 'undefined') {
      materialCounts.MAT = (materialCounts.MAT || 0) + matValue;
    }

    // Save
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) {}
    }

    // WP08 T048: equipment changed (possibly), recompute aggregated affix bonuses.
    if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
      try { window.LootSystem.recomputeBonuses(); } catch (e) { /* swallow */ }
    }

    // Clear selection + UI
    this._selection = null;
    this._selectedSlot = null;
    this._clearVisualSelection();
    this.salvageBtn.container.setVisible(false);
    if (this.enhanceBtn) this.enhanceBtn.container.setVisible(false);
    this.enhanceInfo.setText('Waehle ein Equipment-Item zum Verbessern oder Zerlegen.\nReroll bei Mara im Schwarzmarkt.');
    this._refreshAll();
    this._showFeedback(`Zerlegt: +${matValue} Eisenbrocken`, '#ccaa33');
    this._flashEffect();
  }

  // =================== Crafting ===================
  _craftRecipe(recipe, index) {
    const cost = recipe.cost;
    if (getMaterialCount('MAT') < cost) {
      this._showFeedback('Nicht genug Eisenbrocken!', '#ff4444');
      return;
    }
    if (!this._hasInventorySpace()) {
      this._showFeedback('Inventar voll!', '#ff4444');
      return;
    }

    // Spend materials
    spendMaterialFromStorage('MAT', cost);

    // Create item copy
    const newItem = JSON.parse(JSON.stringify(recipe.item));
    newItem._baseName = newItem.name;

    // Add to inventory
    const idx = inventory.findIndex(slot => !slot);
    if (idx >= 0) {
      inventory[idx] = newItem;
      if (typeof window !== 'undefined') window.inventory = inventory;
    }

    // Save game
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) { console.warn('[CraftingScene] save failed', e); }
    }

    // Refresh
    this._refreshAll();
    this._showFeedback(`${recipe.name} geschmiedet!`, '#44ff44');
    this._flashEffect();
  }

  // =================== Refresh ===================
  _refreshAll() {
    this._updateMatText();

    // Refresh equipment slots
    const slots = ['weapon', 'head', 'body', 'boots'];
    slots.forEach(slot => {
      const el = this.equipSlots[slot];
      if (!el) return;
      const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
      const nameStr = item ? _composeItemName(item) : '(leer)';
      const color = item ? _getTierColor(item) : '#666666';

      el.nameText.setText(nameStr);
      el.nameText.setColor(color);
      el.statsText.setText(item ? this._getStatsLine(item) : '');
    });

    // Refresh recipe costs
    this.RECIPES.forEach((recipe, i) => {
      const el = this.recipeElements[i];
      if (!el) return;
      const canAfford = getMaterialCount('MAT') >= recipe.cost;
      const hasSpace = this._hasInventorySpace();
      el.costText.setColor(canAfford ? '#44ff44' : '#ff4444');

      if (canAfford && hasSpace) {
        el.craftBtn.bg.setFillStyle(0x3a3a3a);
        el.craftBtn.text.setColor('#f1e9d8');
      } else {
        el.craftBtn.bg.setFillStyle(0x222222);
        el.craftBtn.text.setColor('#666666');
      }
    });

    // Refresh inventory list
    this._refreshInventoryList();
  }

  _refreshInventoryList() {
    // Tear down old rows
    (this.invRows || []).forEach((row) => {
      row.bg && row.bg.destroy();
      row.nameText && row.nameText.destroy();
      row.statsText && row.statsText.destroy();
    });
    this.invRows = [];

    if (typeof inventory === 'undefined' || !Array.isArray(inventory)) {
      this.invEmptyText.setVisible(true);
      this.invOverflowText.setText('');
      return;
    }

    // Collect all equipment items in inventory (with original index)
    const EQUIP_TYPES = new Set(['weapon', 'head', 'body', 'boots']);
    const equipItems = [];
    for (let i = 0; i < inventory.length; i++) {
      const it = inventory[i];
      if (it && EQUIP_TYPES.has(it.type)) {
        equipItems.push({ idx: i, item: it });
      }
    }

    if (equipItems.length === 0) {
      this.invEmptyText.setVisible(true);
      this.invOverflowText.setText('');
      return;
    }
    this.invEmptyText.setVisible(false);

    // Clamp scroll offset against the new list length
    const maxOffset = Math.max(0, equipItems.length - this.invMaxRows);
    if (this.invScrollOffset > maxOffset) this.invScrollOffset = maxOffset;
    if (this.invScrollOffset < 0) this.invScrollOffset = 0;

    const visible = equipItems.slice(this.invScrollOffset, this.invScrollOffset + this.invMaxRows);

    // Overflow indicator with scroll position info
    if (equipItems.length > this.invMaxRows) {
      const above = this.invScrollOffset;
      const below = equipItems.length - (this.invScrollOffset + visible.length);
      const parts = [];
      if (above > 0) parts.push('\u25B2' + above);
      if (below > 0) parts.push('\u25BC' + below);
      this.invOverflowText.setText(parts.join('  ') + '  (Scroll/Pfeiltasten)');
    } else {
      this.invOverflowText.setText('');
    }

    const leftX = 30;
    const slotW = (this.scale.width / 2) - 50;

    visible.forEach((entry, row) => {
      const ry = this.invListY + row * this.invRowH + this.invRowH / 2;
      const isSelected = this._isSelected('inv', entry.idx);

      const bg = this.add.rectangle(leftX + slotW / 2, ry, slotW - 6, this.invRowH - 4,
        isSelected ? 0x4a3a1a : 0x2a2a2a)
        .setDepth(9)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0xd4a543 : 0x444444)
        .setInteractive({ useHandCursor: true });

      const SLOT_LABEL = { weapon: 'W', head: 'H', body: 'R', boots: 'S' };
      const labelTxt = SLOT_LABEL[entry.item.type] || '?';
      const color = _getTierColor(entry.item);
      const nameText = this.add.text(leftX + 12, ry - 8, `[${labelTxt}] ${_composeItemName(entry.item)}`, {
        fontFamily: 'monospace', fontSize: '11px', color
      }).setDepth(10);
      const statsText = this.add.text(leftX + 12, ry + 3, this._getStatsLine(entry.item), {
        fontFamily: 'monospace', fontSize: '9px', color: '#888888'
      }).setDepth(10);

      bg.on('pointerdown', () => this._selectInventory(entry.idx));
      bg.on('pointerover', () => {
        if (!this._isSelected('inv', entry.idx)) bg.setFillStyle(0x3a3a3a);
      });
      bg.on('pointerout', () => {
        if (!this._isSelected('inv', entry.idx)) bg.setFillStyle(0x2a2a2a);
      });

      this.invRows.push({ bg, nameText, statsText, invIndex: entry.idx });
    });
  }

  // =================== Feedback ===================
  _showFeedback(msg, color) {
    this.feedbackText.setText(msg);
    this.feedbackText.setColor(color || '#44ff44');
    // Auto-clear after 2 seconds
    if (this._feedbackTimer) this._feedbackTimer.remove();
    this._feedbackTimer = this.time.delayedCall(2000, () => {
      if (this.feedbackText) this.feedbackText.setText('');
    });
  }

  _flashEffect() {
    const W = this.scale.width;
    const H = this.scale.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffc04a, 0.2).setDepth(100);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });
  }

  // =================== Navigation ===================
  _returnToHub() {
    // Save before leaving
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) { console.warn('[CraftingScene] save failed', e); }
    }
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('HubSceneV2');
    });
  }
}
