// js/scenes/CraftingScene.js — Archivschmiede Crafting Scene
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

    // --- Enhancement cost table ---
    this.ENHANCE_COSTS = [5, 10, 20, 40, 80]; // index 0 = cost from +0 to +1

    // --- Crafting recipes ---
    this.RECIPES = [
      {
        id: 'eisenklinge',
        name: 'Eisenklinge',
        type: 'weapon',
        cost: 15,
        item: {
          type: 'weapon', key: 'WPN_CRAFT', name: 'Eisenklinge',
          iconKey: 'itWeapon',
          rarity: 'common', rarityLabel: 'Gewoehnlich', rarityValue: 1,
          itemLevel: 1, hp: 0, damage: 8, speed: 0, range: 0, armor: 0, crit: 0,
          enhanceLevel: 0
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
          rarity: 'common', rarityLabel: 'Gewoehnlich', rarityValue: 1,
          itemLevel: 1, hp: 0, damage: 0, speed: 0, range: 0, armor: 5, crit: 0,
          enhanceLevel: 0
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
          rarity: 'common', rarityLabel: 'Gewoehnlich', rarityValue: 1,
          itemLevel: 1, hp: 0, damage: 0, speed: 15, range: 0, armor: 0, crit: 0,
          enhanceLevel: 0
        }
      }
    ];

    // --- State ---
    this._selectedSlot = null; // 'weapon' | 'head' | 'body' | 'boots'

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

    // Equipment slot list
    const slots = ['weapon', 'head', 'body', 'boots'];
    const slotLabels = { weapon: 'Waffe', head: 'Helm', body: 'Ruestung', boots: 'Stiefel' };
    this.equipSlots = {};
    this.equipSlotBgs = {};

    const slotStartY = panelY + 30;
    const slotH = 60;
    const slotW = panelW;

    slots.forEach((slot, i) => {
      const sy = slotStartY + i * (slotH + 8);
      const bg = this.add.rectangle(leftX + slotW / 2, sy + slotH / 2, slotW, slotH, COL_SLOT)
        .setDepth(9).setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(2, 0x444444);

      const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
      const nameStr = item ? this._getEnhancedName(item) : '(leer)';
      const color = item ? (getRarityColor ? getRarityColor(item) : '#ffffff') : COL_DISABLED;

      const label = this.add.text(leftX + 10, sy + 8, slotLabels[slot], {
        fontFamily: 'monospace', fontSize: '12px', color: COL_GOLD
      }).setDepth(10);

      const nameText = this.add.text(leftX + 10, sy + 26, nameStr, {
        fontFamily: 'monospace', fontSize: '14px', color: color
      }).setDepth(10);

      const statsText = this.add.text(leftX + 10, sy + 42, item ? this._getStatsLine(item) : '', {
        fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa'
      }).setDepth(10);

      bg.on('pointerdown', () => this._selectEquipSlot(slot));
      bg.on('pointerover', () => {
        if (this._selectedSlot !== slot) bg.setFillStyle(COL_BTN_HOVER);
      });
      bg.on('pointerout', () => {
        if (this._selectedSlot !== slot) bg.setFillStyle(COL_SLOT);
      });

      this.equipSlots[slot] = { bg, label, nameText, statsText };
      this.equipSlotBgs[slot] = bg;
    });

    // Enhancement info panel
    const enhY = slotStartY + 4 * (slotH + 8) + 10;
    this.enhanceInfo = this.add.text(leftX + 10, enhY, 'Waehle ein Ausruestungsstueck zum Verbessern.', {
      fontFamily: 'monospace', fontSize: '12px', color: COL_PARCHMENT,
      wordWrap: { width: slotW - 20 }
    }).setDepth(10);

    // Enhance button
    this.enhanceBtn = this._createButton(
      leftX + slotW / 2, enhY + 60, 180, 36,
      'Verbessern', () => this._enhanceItem()
    );
    this.enhanceBtn.container.setVisible(false);

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

    // ESC key to return
    this.input.keyboard.on('keydown-ESC', this._returnToHub, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-ESC', this._returnToHub, this);
    });
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

  _getEnhancedName(item) {
    if (!item) return '(leer)';
    const lvl = item.enhanceLevel || 0;
    const baseName = item._baseName || item.name || 'Item';
    return lvl > 0 ? `${baseName} +${lvl}` : baseName;
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
    const lvl = item.enhanceLevel || 0;
    if (lvl > 0) parts.push(`(+${lvl})`);
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

  // =================== Equipment Selection ===================
  _selectEquipSlot(slot) {
    const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
    if (!item) {
      this._showFeedback('Kein Gegenstand in diesem Slot.', '#ff4444');
      return;
    }

    // Deselect previous
    if (this._selectedSlot && this.equipSlotBgs[this._selectedSlot]) {
      this.equipSlotBgs[this._selectedSlot].setFillStyle(0x333333);
      this.equipSlotBgs[this._selectedSlot].setStrokeStyle(2, 0x444444);
    }

    this._selectedSlot = slot;

    // Highlight selected
    this.equipSlotBgs[slot].setFillStyle(0x4a3a1a);
    this.equipSlotBgs[slot].setStrokeStyle(2, 0xd4a543);

    // Show enhance info
    const lvl = item.enhanceLevel || 0;
    if (lvl >= 5) {
      this.enhanceInfo.setText(`${this._getEnhancedName(item)}\nMaximal verbessert! (+5)`);
      this.enhanceBtn.container.setVisible(false);
    } else {
      const cost = this.ENHANCE_COSTS[lvl];
      const canAfford = getMaterialCount('MAT') >= cost;
      const statBonus = '+10% auf alle Werte';
      this.enhanceInfo.setText(
        `${this._getEnhancedName(item)}\n` +
        `Naechste Stufe: +${lvl + 1}  |  ${statBonus}\n` +
        `Kosten: ${cost} Eisenbrocken` +
        (canAfford ? '' : '  (nicht genug!)')
      );
      this.enhanceBtn.container.setVisible(true);
      if (canAfford) {
        this.enhanceBtn.bg.setFillStyle(0x3a3a3a);
        this.enhanceBtn.text.setColor('#f1e9d8');
      } else {
        this.enhanceBtn.bg.setFillStyle(0x222222);
        this.enhanceBtn.text.setColor('#666666');
      }
    }
  }

  // =================== Enhancement ===================
  _enhanceItem() {
    if (!this._selectedSlot) return;
    const item = (typeof equipment !== 'undefined') ? equipment[this._selectedSlot] : null;
    if (!item) return;

    const lvl = item.enhanceLevel || 0;
    if (lvl >= 5) {
      this._showFeedback('Bereits maximal verbessert!', '#ff4444');
      return;
    }

    const cost = this.ENHANCE_COSTS[lvl];
    if (getMaterialCount('MAT') < cost) {
      this._showFeedback('Nicht genug Eisenbrocken!', '#ff4444');
      return;
    }

    // Spend materials
    spendMaterialFromStorage('MAT', cost);

    // Store base name on first enhancement
    if (!item._baseName) {
      item._baseName = item.name;
    }

    // Increase enhance level
    item.enhanceLevel = lvl + 1;

    // Boost all non-zero stats by 10%
    const statKeys = ['hp', 'damage', 'speed', 'range', 'armor', 'crit'];
    statKeys.forEach(s => {
      if (typeof item[s] === 'number' && item[s] !== 0) {
        item[s] = Math.round(item[s] * 1.1 * 100) / 100;
        // Keep integers for integer stats
        if (s === 'hp' || s === 'damage' || s === 'range') {
          item[s] = Math.round(item[s]);
        }
      }
    });

    // Update display name
    item.name = `${item._baseName} +${item.enhanceLevel}`;

    // Save game
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) { console.warn('[CraftingScene] save failed', e); }
    }

    // Refresh UI
    this._refreshAll();
    this._selectEquipSlot(this._selectedSlot);
    this._showFeedback(`${item.name} verbessert!`, '#44ff44');

    // Flash effect
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
      const nameStr = item ? this._getEnhancedName(item) : '(leer)';
      const color = item ? (typeof getRarityColor === 'function' ? getRarityColor(item) : '#ffffff') : '#666666';

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
