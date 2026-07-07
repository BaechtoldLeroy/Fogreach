// js/scenes/ShopScene.js
// WP06 — Mara Schwarzmarkt shop overlay.
//
// Modal Phaser scene launched via window.openShopScene(parentScene). It renders
// a panel with 3 tabs (Items / Tränke / Reroll) on top of the parent scene
// (usually HubSceneV2). The parent scene keeps running underneath, and
// scene.stop() removes the overlay without affecting the hub.
//
// Shop stock is cached per dungeon run via LootSystem.getOrCreateShopState so
// that re-opening the shop between runs always refreshes, but re-opening it
// mid-run shows the same inventory.

(function () {
  'use strict';

  if (typeof Phaser === 'undefined') return;

  if (window.i18n) {
    window.i18n.register('de', {
      'shop.title': 'Schwarzmarkt — Mara',
      'shop.gold_counter': 'Gold: {amount}',
      'shop.close': 'Schliessen [ESC]',
      'shop.tab.items': 'Items',
      'shop.tab.potions': 'Tränke',
      'shop.tab.reroll': 'Reroll',
      'shop.btn.buy': 'Kaufen',
      'shop.empty.stock': 'Lager ist leer.',
      'shop.scroll.name': 'Portalrolle ({count})',
      'shop.scroll.desc': 'Teleport zurück zur Stadt',
      'shop.toast.scroll_bought': 'Portalrolle gekauft',
      'shop.potion.heal_pct': '+{pct}% MaxHP über 3s',
      'shop.toast.not_enough_gold': 'Nicht genug Gold',
      'shop.toast.inventory_full': 'Inventar voll',
      'shop.toast.bought': 'Gekauft: {name}',
      'shop.reroll.empty': 'Keine reroll-baren Items im Inventar.',
      'shop.reroll.header_select': 'Wähle ein Item:',
      'shop.reroll.header_selected': 'Ausgewähltes Item:',
      'shop.reroll.cost': 'Reroll-Kosten: {cost} Gold',
      'shop.reroll.btn': 'Reroll',
      'shop.reroll.cancel': 'Anderes Item',
      'shop.toast.reroll_unavailable': 'Reroll nicht verfügbar',
      'shop.toast.reroll_success': 'Reroll erfolgreich!',
      'shop.stock.reroll': 'Lager auffrischen ({cost} G)',
      'shop.blind_buy.name': '❓ Geheimnisvolle Ware',
      'shop.blind_buy.desc': 'Unbekannter Inhalt — schlechtere Chancen als ein Fund',
      'shop.blind_buy.button': 'Blindkauf',
      'shop.blind_buy.full': 'Inventar voll',
      'shop.blind_buy.result': 'Erhalten: {name}',
      'shop.toast.stock_rerolled': 'Mara breitet frische Ware aus.'
    });
    window.i18n.register('en', {
      'shop.title': 'Black Market — Mara',
      'shop.gold_counter': 'Gold: {amount}',
      'shop.close': 'Close [ESC]',
      'shop.tab.items': 'Items',
      'shop.tab.potions': 'Potions',
      'shop.tab.reroll': 'Reroll',
      'shop.btn.buy': 'Buy',
      'shop.empty.stock': 'Out of stock.',
      'shop.scroll.name': 'Portal Scroll ({count})',
      'shop.scroll.desc': 'Teleport back to the city',
      'shop.toast.scroll_bought': 'Portal scroll bought',
      'shop.potion.heal_pct': '+{pct}% MaxHP over 3s',
      'shop.toast.not_enough_gold': 'Not enough gold',
      'shop.toast.inventory_full': 'Inventory full',
      'shop.toast.bought': 'Bought: {name}',
      'shop.reroll.empty': 'No re-rollable items in inventory.',
      'shop.reroll.header_select': 'Choose an item:',
      'shop.reroll.header_selected': 'Selected item:',
      'shop.reroll.cost': 'Reroll cost: {cost} gold',
      'shop.reroll.btn': 'Reroll',
      'shop.reroll.cancel': 'Other item',
      'shop.toast.reroll_unavailable': 'Reroll unavailable',
      'shop.toast.reroll_success': 'Reroll successful!',
      'shop.stock.reroll': 'Refresh stock ({cost} G)',
      'shop.blind_buy.name': '❓ Mystery Wares',
      'shop.blind_buy.desc': 'Unknown contents — worse odds than a find',
      'shop.blind_buy.button': 'Gamble',
      'shop.blind_buy.full': 'Inventory full',
      'shop.blind_buy.result': 'Received: {name}',
      'shop.toast.stock_rerolled': 'Mara lays out fresh wares.'
    });
  }
  const _SHOP_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  const TIER_COLORS = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];

  class ShopScene extends Phaser.Scene {
    constructor() {
      super({ key: 'ShopScene' });
    }

    create(data) {
      this.parentSceneKey = (data && data.from) || null;
      this.activeTab = 'items';
      this.tabBody = [];
      this.selectedRerollItem = null;
      // Dungeon merchant: cheaper prices, better items, no reroll tab
      this.isDungeonMerchant = !!window._dungeonMerchant;
      window._dungeonMerchant = false;
      this.shopState = (window.LootSystem && typeof window.LootSystem.getOrCreateShopState === 'function')
        ? window.LootSystem.getOrCreateShopState()
        : { itemStock: [] };
      this._buildLayout();
      this._renderTab('items');
    }

    // -----------------------------------------------------------------------
    // Static panel / tab bar / footer
    // -----------------------------------------------------------------------
    _buildLayout() {
      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;

      // Dim backdrop
      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
        .setScrollFactor(0).setDepth(2000);

      // Panel
      const panelW = Math.min(720, cw - 20);
      const panelH = Math.min(460, ch - 20);
      const px = cw / 2;
      const py = ch / 2;
      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.96)
        .fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
      panel.lineStyle(3, 0xffd166, 0.9)
        .strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

      // Title
      this.add.text(px, py - panelH / 2 + 14, _SHOP_T('shop.title'), {
        fontFamily: 'serif', fontSize: '22px', color: '#ffd166', fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      // Gold counter
      this.goldText = this.add.text(px - panelW / 2 + 16, py + panelH / 2 - 26, _SHOP_T('shop.gold_counter', { amount: 0 }), {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffd166'
      }).setScrollFactor(0).setDepth(2002);
      this._refreshGold();

      // Close button
      const closeBg = this.add.rectangle(px + panelW / 2 - 110, py + panelH / 2 - 22, 200, 28, 0x3a3a3a)
        .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(px + panelW / 2 - 110, py + panelH / 2 - 22, _SHOP_T('shop.close'), {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      closeBg.on('pointerdown', () => this._close());

      // Tab buttons (dungeon merchant has no reroll)
      this._tabButtons = {};
      const tabs = this.isDungeonMerchant ? ['items', 'potions'] : ['items', 'potions', 'reroll'];
      const tabLabels = {
        items: _SHOP_T('shop.tab.items'),
        potions: _SHOP_T('shop.tab.potions'),
        reroll: _SHOP_T('shop.tab.reroll')
      };
      tabs.forEach((t, i) => {
        const tx = px - panelW / 2 + 70 + i * 120;
        const ty = py - panelH / 2 + 58;
        const bg = this.add.rectangle(tx, ty, 110, 28, 0x2a2a2a)
          .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
          .setInteractive({ useHandCursor: true });
        this.add.text(tx, ty, tabLabels[t], {
          fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        bg.on('pointerdown', () => this._renderTab(t));
        this._tabButtons[t] = bg;
      });

      // ESC handler
      this._escHandler = () => this._close();
      this.input.keyboard.on('keydown-ESC', this._escHandler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this._escHandler && this.input && this.input.keyboard) {
          this.input.keyboard.off('keydown-ESC', this._escHandler);
        }
        if (this.tabBody) {
          this.tabBody.forEach(g => g && g.destroy && g.destroy());
          this.tabBody = [];
        }
      });

      // Track panel coords for tab body positioning
      this._panel = { px, py, panelW, panelH };
    }

    _refreshGold() {
      const gold = (window.LootSystem && window.LootSystem.getGold) ? window.LootSystem.getGold() : 0;
      if (this.goldText) this.goldText.setText(_SHOP_T('shop.gold_counter', { amount: gold }));
    }

    _close() {
      try { this.scene.stop(); } catch (e) { /* swallow */ }
    }

    // -----------------------------------------------------------------------
    // Tab switching
    // -----------------------------------------------------------------------
    _renderTab(tabName) {
      this.activeTab = tabName;
      // Tear down old tab body
      if (this.tabBody && this.tabBody.length) {
        this.tabBody.forEach(g => g && g.destroy && g.destroy());
      }
      this.tabBody = [];

      if (tabName === 'items') this._renderItemsTab();
      else if (tabName === 'potions') this._renderPotionsTab();
      else if (tabName === 'reroll') this._renderRerollTab();

      // Highlight active tab button
      for (const t in this._tabButtons) {
        const isActive = t === tabName;
        this._tabButtons[t].setStrokeStyle(isActive ? 2 : 1, isActive ? 0xffd166 : 0x666666);
      }
    }

    // -----------------------------------------------------------------------
    // Items tab
    // -----------------------------------------------------------------------
    _renderItemsTab() {
      const { px, py, panelW, panelH } = this._panel;
      const startY = py - panelH / 2 + 90;
      const rowH = 40;
      const stock = (this.shopState && this.shopState.itemStock) || [];

      // Feature 059 (#42) WP04: the flying (dungeon) merchant offers a curated
      // run-amulet auslage from depth 10. Rendered ABOVE the regular gear so it
      // reads as the special, run-defining purchase. y-position uses a running
      // rowIndex; buy handlers keep their own stock index.
      let amuletStock = [];
      if (this.isDungeonMerchant && window.LootSystem
          && typeof window.LootSystem.getOrCreateAmuletShopState === 'function') {
        try { amuletStock = (window.LootSystem.getOrCreateAmuletShopState().amuletStock) || []; }
        catch (e) { amuletStock = []; }
      }

      let rowIndex = 0;
      // G2 (#51): Blindkauf — Gambling-Gold-Sink, IMMER verfuegbar (auch bei
      // leerem Lager). Eine unidentifizierte Ware zu Fixpreis; Inhalt wird beim
      // Kauf gewuerfelt (bewusst schlechtere Raritaets-Chancen als ein Fund).
      if (window.LootSystem && typeof window.LootSystem.blindBuy === 'function') {
        const bprice = (typeof window.LootSystem.getBlindBuyPrice === 'function')
          ? window.LootSystem.getBlindBuyPrice() : 100;
        const by = startY + rowIndex * rowH; rowIndex++;
        const bbg = this.add.rectangle(px, by + rowH / 2, panelW - 30, rowH - 4, 0x332a1a)
          .setStrokeStyle(1, 0xffb347).setScrollFactor(0).setDepth(2002);
        this.tabBody.push(bbg);
        const bnm = this.add.text(px - panelW / 2 + 24, by + 5, _SHOP_T('shop.blind_buy.name'), {
          fontFamily: 'monospace', fontSize: '12px', color: '#ffb347'
        }).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(bnm);
        const bdesc = this.add.text(px - panelW / 2 + 24, by + 21, _SHOP_T('shop.blind_buy.desc'), {
          fontFamily: 'monospace', fontSize: '10px', color: '#b89a6a', wordWrap: { width: panelW - 220 }
        }).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(bdesc);
        const bpt = this.add.text(px + panelW / 2 - 150, by + rowH / 2, bprice + ' G', {
          fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(bpt);
        const bbuyBg = this.add.rectangle(px + panelW / 2 - 50, by + rowH / 2, 60, 24, 0x4a3a1a)
          .setStrokeStyle(1, 0xffb347).setScrollFactor(0).setDepth(2003).setInteractive({ useHandCursor: true });
        const bbuyTx = this.add.text(px + panelW / 2 - 50, by + rowH / 2, _SHOP_T('shop.blind_buy.button'), {
          fontFamily: 'monospace', fontSize: '10px', color: '#f1e9d8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(bbuyBg); this.tabBody.push(bbuyTx);
        bbuyBg.on('pointerdown', () => this._tryBlindBuy());
        rowIndex += 0.4; // Abstand zur restlichen Auslage
      }

      if (stock.length === 0 && amuletStock.length === 0) {
        const t = this.add.text(px, py + 40, _SHOP_T('shop.empty.stock'), {
          fontFamily: 'monospace', fontSize: '13px', color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(t);
        return;
      }

      if (amuletStock.length > 0) {
        const hdr = this.add.text(px, startY + rowIndex * rowH - 6, _SHOP_T('shop.amulet.section'), {
          fontFamily: 'monospace', fontSize: '11px', color: '#c792ea'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(hdr);
        rowIndex += 0.6; // nudge first amulet row below the small header
        amuletStock.forEach((amulet, ai) => {
          const ry = startY + rowIndex * rowH;
          rowIndex++;
          const rowBg = this.add.rectangle(px, ry + rowH / 2, panelW - 30, rowH - 4, 0x2a2336)
            .setStrokeStyle(1, 0x6b4f8a).setScrollFactor(0).setDepth(2002);
          this.tabBody.push(rowBg);

          const amuletName = (window.LootSystem && typeof window.LootSystem.getLocalizedDisplayName === 'function')
            ? window.LootSystem.getLocalizedDisplayName(amulet)
            : (amulet.displayName || amulet.name || 'Amulett');
          const nameText = this.add.text(px - panelW / 2 + 24, ry + 5, amuletName, {
            fontFamily: 'monospace', fontSize: '12px', color: '#c792ea'
          }).setScrollFactor(0).setDepth(2003);
          this.tabBody.push(nameText);

          const desc = (window.LootSystem && typeof window.LootSystem.getAmuletEffectDesc === 'function')
            ? window.LootSystem.getAmuletEffectDesc(amulet.effect) : '';
          if (desc) {
            const descText = this.add.text(px - panelW / 2 + 24, ry + 21, desc, {
              fontFamily: 'monospace', fontSize: '10px', color: '#9a86b8',
              wordWrap: { width: panelW - 220 }
            }).setScrollFactor(0).setDepth(2003);
            this.tabBody.push(descText);
          }

          const aprice = this._computeAmuletPrice(amulet);
          const aPriceText = this.add.text(px + panelW / 2 - 150, ry + rowH / 2, aprice + ' G', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
          }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2003);
          this.tabBody.push(aPriceText);

          const aBuyBg = this.add.rectangle(px + panelW / 2 - 50, ry + rowH / 2, 60, 24, 0x3a2f4a)
            .setStrokeStyle(1, 0xc792ea).setScrollFactor(0).setDepth(2003)
            .setInteractive({ useHandCursor: true });
          const aBuyText = this.add.text(px + panelW / 2 - 50, ry + rowH / 2, _SHOP_T('shop.btn.buy'), {
            fontFamily: 'monospace', fontSize: '11px', color: '#f1e9d8'
          }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
          this.tabBody.push(aBuyBg);
          this.tabBody.push(aBuyText);
          aBuyBg.on('pointerdown', () => this._tryBuyAmulet(ai, aprice));
        });
        rowIndex += 0.4; // small gap before regular gear
      }

      stock.forEach((item, i) => {
        const ry = startY + rowIndex * rowH;
        rowIndex++;
        const rowBg = this.add.rectangle(px, ry + rowH / 2, panelW - 30, rowH - 4, 0x2a2a2a)
          .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2002);
        this.tabBody.push(rowBg);

        const nameColor = TIER_COLORS[item.tier || 0] || '#cccccc';
        const nameText = this.add.text(px - panelW / 2 + 24, ry + 6, item.displayName || item._baseName || 'Item', {
          fontFamily: 'monospace', fontSize: '12px', color: nameColor
        }).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(nameText);

        if (item.affixes && item.affixes.length > 0 && window.LootSystem && window.LootSystem.AFFIX_DEFS) {
          const getTip = window.LootSystem.getAffixTooltipText;
          const summary = item.affixes.map(a => {
            const def = window.LootSystem.AFFIX_DEFS.find(d => d.id === a.defId);
            if (!def) return '';
            return (typeof getTip === 'function')
              ? getTip(def, a.value)
              : (def.tooltipText || '').replace('{value}', a.value);
          }).filter(Boolean).join('  ');
          const affixText = this.add.text(px - panelW / 2 + 24, ry + 22, summary, {
            fontFamily: 'monospace', fontSize: '10px', color: '#888888',
            wordWrap: { width: panelW - 220 }
          }).setScrollFactor(0).setDepth(2003);
          this.tabBody.push(affixText);
        }

        const price = this._computeItemPrice(item);
        const priceText = this.add.text(px + panelW / 2 - 150, ry + rowH / 2, price + ' G', {
          fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(priceText);

        const buyBg = this.add.rectangle(px + panelW / 2 - 50, ry + rowH / 2, 60, 24, 0x3a3a3a)
          .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        const buyText = this.add.text(px + panelW / 2 - 50, ry + rowH / 2, _SHOP_T('shop.btn.buy'), {
          fontFamily: 'monospace', fontSize: '11px', color: '#f1e9d8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(buyBg);
        this.tabBody.push(buyText);
        buyBg.on('pointerdown', () => this._tryBuyItem(i, price));
      });

      // Feature 060 (WP05 / #51): Gold-Sink — "Lager auffrischen". Würfelt Maras
      // Auslage gegen (eskalierendes) Gold komplett neu. Nur bei Mara, nicht am
      // (run-scoped) Dungeon-Händler.
      if (!this.isDungeonMerchant && window.LootSystem
          && typeof window.LootSystem.rerollShopStock === 'function') {
        const rerollCost = (typeof window.LootSystem.getShopRerollCost === 'function')
          ? window.LootSystem.getShopRerollCost() : 120;
        const ry = py + panelH / 2 - 52;
        const rerollBg = this.add.rectangle(px, ry, 260, 26, 0x2f2438)
          .setStrokeStyle(2, 0xffd166).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        const rerollTxt = this.add.text(px, ry, _SHOP_T('shop.stock.reroll', { cost: rerollCost }), {
          fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(rerollBg);
        this.tabBody.push(rerollTxt);
        rerollBg.on('pointerdown', () => this._tryRerollStock(rerollCost));
      }
    }

    _tryRerollStock(cost) {
      if (!window.LootSystem || typeof window.LootSystem.rerollShopStock !== 'function') {
        this._showToast(_SHOP_T('shop.toast.reroll_unavailable'));
        return;
      }
      const ok = window.LootSystem.rerollShopStock(cost);
      if (!ok) {
        this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
        return;
      }
      // Refresh local handle + UI from the now-rerolled shop state.
      this.shopState = (typeof window.LootSystem.getOrCreateShopState === 'function')
        ? window.LootSystem.getOrCreateShopState() : this.shopState;
      this.selectedRerollItem = null;
      this._refreshGold();
      this._renderTab('items');
      this._showToast(_SHOP_T('shop.toast.stock_rerolled'));
    }

    // G2 (#51): Blindkauf. Freien Slot ZUERST pruefen (kein Gold verbrennen, wenn
    // voll), dann blindBuy (zieht Gold ab + wuerfelt), Item in den Slot legen.
    _tryBlindBuy() {
      if (!window.LootSystem || typeof window.LootSystem.blindBuy !== 'function') {
        this._showToast(_SHOP_T('shop.toast.reroll_unavailable'));
        return;
      }
      const inv = window.inventory;
      const slot = Array.isArray(inv) ? inv.findIndex((s) => !s) : -1;
      if (slot < 0) { this._showToast(_SHOP_T('shop.blind_buy.full')); return; }
      const res = window.LootSystem.blindBuy();
      if (!res || !res.ok) {
        this._showToast(_SHOP_T(res && res.reason === 'gold'
          ? 'shop.toast.not_enough_gold' : 'shop.toast.reroll_unavailable'));
        return;
      }
      window.inventory[slot] = res.item;
      if (typeof window._refreshInventoryHUD === 'function') { try { window._refreshInventoryHUD(); } catch (e) {} }
      this._refreshGold();
      this._renderTab('items'); // Preis kann tiefenabhaengig sein -> neu zeichnen
      const nm = (window.LootSystem && typeof window.LootSystem.getLocalizedDisplayName === 'function')
        ? window.LootSystem.getLocalizedDisplayName(res.item)
        : (res.item.displayName || res.item.name || 'Item');
      this._showToast(_SHOP_T('shop.blind_buy.result', { name: nm }));
    }

    _computeItemPrice(item) {
      const tierMul = [10, 50, 200, 800];
      const t = Math.max(0, Math.min(3, item.tier || 0));
      const iLevel = (typeof item.iLevel === 'number' && item.iLevel > 0) ? item.iLevel : 1;
      let base = Math.max(1, Math.round(tierMul[t] * (1 + iLevel * 0.1)));
      // Dungeon merchant offers 30% discount
      if (this.isDungeonMerchant) base = Math.max(1, Math.round(base * 0.7));
      // Printing-House edict: hub-side shop discount (run-scoped, only at Mara, not at dungeon merchant)
      const ph = (typeof window !== 'undefined') ? window.printingBuffs : null;
      if (ph && !this.isDungeonMerchant && typeof ph.shopPriceMult === 'number' && ph.shopPriceMult > 0) {
        base = Math.max(1, Math.round(base * ph.shopPriceMult));
      }
      return base;
    }

    _tryBuyItem(stockIdx, price) {
      if (!window.LootSystem || !window.LootSystem.spendGold(price)) {
        this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
        return;
      }
      const item = this.shopState.itemStock[stockIdx];
      if (!item) return;
      if (Array.isArray(window.inventory)) {
        const slot = window.inventory.findIndex(s => !s);
        if (slot < 0) {
          this._showToast(_SHOP_T('shop.toast.inventory_full'));
          window.LootSystem.grantGold(price); // refund
          return;
        }
        window.inventory[slot] = item;
      }
      this.shopState.itemStock.splice(stockIdx, 1);
      this._refreshGold();
      this._renderTab('items');
      this._showToast(_SHOP_T('shop.toast.bought', { name: item.displayName || item._baseName || 'Item' }));
      if (typeof window._refreshInventoryHUD === 'function') {
        try { window._refreshInventoryHUD(); } catch (e) { /* swallow */ }
      }
    }

    // Feature 059 (#42) WP04: run-amulets are pricier than gear (they redefine
    // a run). Scales with depth; dungeon-merchant discount applies.
    _computeAmuletPrice(amulet) {
      const iLevel = (amulet && typeof amulet.iLevel === 'number' && amulet.iLevel > 0) ? amulet.iLevel : 10;
      let base = Math.max(1, Math.round(180 * (1 + iLevel * 0.08)));
      if (this.isDungeonMerchant) base = Math.max(1, Math.round(base * 0.7));
      return base;
    }

    _tryBuyAmulet(stockIdx, price) {
      const state = (window.LootSystem && typeof window.LootSystem.getOrCreateAmuletShopState === 'function')
        ? window.LootSystem.getOrCreateAmuletShopState() : null;
      const amulet = state && state.amuletStock ? state.amuletStock[stockIdx] : null;
      if (!amulet) return;
      if (!window.LootSystem || !window.LootSystem.spendGold(price)) {
        this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
        return;
      }
      if (Array.isArray(window.inventory)) {
        const slot = window.inventory.findIndex(s => !s);
        if (slot < 0) {
          this._showToast(_SHOP_T('shop.toast.inventory_full'));
          window.LootSystem.grantGold(price); // refund
          return;
        }
        window.inventory[slot] = amulet;
      }
      state.amuletStock.splice(stockIdx, 1);
      this._refreshGold();
      this._renderTab('items');
      const boughtName = (window.LootSystem && typeof window.LootSystem.getLocalizedDisplayName === 'function')
        ? window.LootSystem.getLocalizedDisplayName(amulet)
        : (amulet.displayName || amulet.name || 'Amulett');
      this._showToast(_SHOP_T('shop.toast.bought', { name: boughtName }));
      if (typeof window._refreshInventoryHUD === 'function') {
        try { window._refreshInventoryHUD(); } catch (e) { /* swallow */ }
      }
    }

    // -----------------------------------------------------------------------
    // Potions tab
    // -----------------------------------------------------------------------
    _renderPotionsTab() {
      const { px, py, panelW, panelH } = this._panel;
      const startY = py - panelH / 2 + 90;
      const rowH = 48;
      const defs = (window.LootSystem && window.LootSystem.POTION_DEFS) || [];

      // Portal scroll row at the top
      const scrollPrice = 75;
      const scrollY = startY;
      const scrollRowBg = this.add.rectangle(px, scrollY + rowH / 2, panelW - 30, rowH - 4, 0x2a2a2a)
        .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2002);
      this.tabBody.push(scrollRowBg);
      const scrollCount = (window.materialCounts && typeof window.materialCounts.PORTAL_SCROLL === 'number')
        ? window.materialCounts.PORTAL_SCROLL : 0;
      const scrollNameText = this.add.text(px - panelW / 2 + 24, scrollY + 10, _SHOP_T('shop.scroll.name', { count: scrollCount }), {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2003);
      this.tabBody.push(scrollNameText);
      const scrollDesc = this.add.text(px - panelW / 2 + 24, scrollY + 28, _SHOP_T('shop.scroll.desc'), {
        fontFamily: 'monospace', fontSize: '10px', color: '#aaddff'
      }).setScrollFactor(0).setDepth(2003);
      this.tabBody.push(scrollDesc);
      const scrollPriceText = this.add.text(px + panelW / 2 - 180, scrollY + rowH / 2, scrollPrice + ' G', {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2003);
      this.tabBody.push(scrollPriceText);
      const scrollBuyBg = this.add.rectangle(px + panelW / 2 - 60, scrollY + rowH / 2, 70, 26, 0x3a3a3a)
        .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2003)
        .setInteractive({ useHandCursor: true });
      const scrollBuyText = this.add.text(px + panelW / 2 - 60, scrollY + rowH / 2, _SHOP_T('shop.btn.buy'), {
        fontFamily: 'monospace', fontSize: '11px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
      this.tabBody.push(scrollBuyBg);
      this.tabBody.push(scrollBuyText);
      scrollBuyBg.on('pointerdown', () => {
        if (!window.LootSystem || !window.LootSystem.spendGold(scrollPrice)) {
          this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
          return;
        }
        if (!window.materialCounts || typeof window.materialCounts !== 'object') window.materialCounts = {};
        if (typeof window.materialCounts.PORTAL_SCROLL !== 'number') window.materialCounts.PORTAL_SCROLL = 0;
        window.materialCounts.PORTAL_SCROLL += 1;
        // Also use changeMaterialCount if available for proper tracking
        if (typeof window.changeMaterialCount === 'function') {
          // changeMaterialCount adds delta, but we already incremented, so skip
        }
        scrollNameText.setText(_SHOP_T('shop.scroll.name', { count: window.materialCounts.PORTAL_SCROLL }));
        this._refreshGold();
        this._showToast(_SHOP_T('shop.toast.scroll_bought'));
      });

      // Offset potion rows by 1 to make room for scroll row
      defs.forEach((def, i) => {
        const ry = startY + (i + 1) * rowH;
        const rowBg = this.add.rectangle(px, ry + rowH / 2, panelW - 30, rowH - 4, 0x2a2a2a)
          .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2002);
        this.tabBody.push(rowBg);

        const _potName = (window.i18n ? window.i18n.t('loot.potion.t' + def.potionTier) : def.name);
        const nameText = this.add.text(px - panelW / 2 + 24, ry + 10, _potName, {
          fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
        }).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(nameText);

        const healPct = Math.round((def.healPercent || 0) * 100);
        const healText = this.add.text(px - panelW / 2 + 24, ry + 28, _SHOP_T('shop.potion.heal_pct', { pct: healPct }), {
          fontFamily: 'monospace', fontSize: '10px', color: '#88ff88'
        }).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(healText);

        let potionPrice = this.isDungeonMerchant ? Math.max(1, Math.round(def.goldCost * 0.7)) : def.goldCost;
        const _phPot = (typeof window !== 'undefined') ? window.printingBuffs : null;
        if (_phPot && !this.isDungeonMerchant && typeof _phPot.shopPriceMult === 'number' && _phPot.shopPriceMult > 0) {
          potionPrice = Math.max(1, Math.round(potionPrice * _phPot.shopPriceMult));
        }
        const priceText = this.add.text(px + panelW / 2 - 180, ry + rowH / 2, potionPrice + ' G', {
          fontFamily: 'monospace', fontSize: '12px', color: '#ffd166'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(priceText);

        const buyBg = this.add.rectangle(px + panelW / 2 - 60, ry + rowH / 2, 70, 26, 0x3a3a3a)
          .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        const buyText = this.add.text(px + panelW / 2 - 60, ry + rowH / 2, _SHOP_T('shop.btn.buy'), {
          fontFamily: 'monospace', fontSize: '11px', color: '#f1e9d8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(buyBg);
        this.tabBody.push(buyText);
        buyBg.on('pointerdown', () => this._tryBuyPotion(def, potionPrice));
      });
    }

    _tryBuyPotion(def, overridePrice) {
      const cost = overridePrice || def.goldCost;
      if (!window.LootSystem || !window.LootSystem.spendGold(cost)) {
        this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
        return;
      }
      if (!Array.isArray(window.inventory)) {
        this._refreshGold();
        this._showToast(_SHOP_T('shop.toast.bought', { name: def.name }));
        return;
      }
      let stacked = false;
      for (let i = 0; i < window.inventory.length; i++) {
        const it = window.inventory[i];
        if (it && it.type === 'potion' && it.potionTier === def.potionTier) {
          // Unlimited potion stacking: pile into the first matching slot with no
          // per-slot cap (matches the loot-pickup path in loot.js). Previously
          // capped at def.stackSize (5), which scattered bought potions across
          // multiple slots.
          it.stack = (it.stack || 1) + 1;
          stacked = true;
          break;
        }
      }
      if (!stacked) {
        const slot = window.inventory.findIndex(s => !s);
        if (slot < 0) {
          this._showToast(_SHOP_T('shop.toast.inventory_full'));
          window.LootSystem.grantGold(cost); // refund
          return;
        }
        window.inventory[slot] = {
          type: 'potion',
          potionTier: def.potionTier,
          name: def.name,
          nameKey: 'loot.potion.t' + def.potionTier,
          iconKey: def.iconKey,
          stack: 1
        };
      }
      this._refreshGold();
      const potName = (window.i18n ? window.i18n.t('loot.potion.t' + def.potionTier) : def.name);
      this._showToast(_SHOP_T('shop.toast.bought', { name: potName }));
      if (typeof window._refreshInventoryHUD === 'function') {
        try { window._refreshInventoryHUD(); } catch (e) { /* swallow */ }
      }
    }

    // -----------------------------------------------------------------------
    // Reroll tab
    // -----------------------------------------------------------------------
    _renderRerollTab() {
      const { px, py, panelW, panelH } = this._panel;
      // Reroll candidates: items in inventory AND currently-equipped items.
      // Equipped slots get an "[E]" prefix in the row label so the player
      // can tell them apart.
      const items = [];
      (window.inventory || []).forEach((it) => {
        if (it && it.type !== 'potion' && typeof it.tier === 'number') {
          items.push({ item: it, source: 'inv', label: '' });
        }
      });
      const eq = window.equipment || {};
      ['weapon', 'head', 'body', 'boots'].forEach((slot) => {
        const it = eq[slot];
        if (it && it.type !== 'potion' && typeof it.tier === 'number') {
          items.push({ item: it, source: 'equip', label: '[E] ' });
        }
      });

      if (items.length === 0) {
        const t = this.add.text(px, py, _SHOP_T('shop.reroll.empty'), {
          fontFamily: 'monospace', fontSize: '13px', color: '#888888'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(t);
        return;
      }

      const header = this.add.text(px, py - panelH / 2 + 92, _SHOP_T(this.selectedRerollItem ? 'shop.reroll.header_selected' : 'shop.reroll.header_select'), {
        fontFamily: 'monospace', fontSize: '13px', color: '#cccccc'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      this.tabBody.push(header);

      if (this.selectedRerollItem && items.findIndex((entry) => entry.item === this.selectedRerollItem) === -1) {
        // Selected item was removed from inventory (e.g. equipped elsewhere)
        this.selectedRerollItem = null;
      }

      if (this.selectedRerollItem) {
        const item = this.selectedRerollItem;
        const color = TIER_COLORS[item.tier || 0] || '#cccccc';
        const nameText = this.add.text(px, py - panelH / 2 + 120, item.displayName || item._baseName || 'Item', {
          fontFamily: 'monospace', fontSize: '15px', color: color
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(nameText);

        (item.affixes || []).forEach((a, i) => {
          const def = window.LootSystem && window.LootSystem.AFFIX_DEFS
            ? window.LootSystem.AFFIX_DEFS.find(d => d.id === a.defId)
            : null;
          if (!def) return;
          const tipTxt = (typeof window.LootSystem.getAffixTooltipText === 'function')
            ? window.LootSystem.getAffixTooltipText(def, a.value)
            : (def.tooltipText || '').replace('{value}', a.value);
          const lineText = this.add.text(px, py - panelH / 2 + 144 + i * 18, tipTxt, {
            fontFamily: 'monospace', fontSize: '11px', color: '#88ff88'
          }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
          this.tabBody.push(lineText);
        });

        const cost = (window.LootSystem && typeof window.LootSystem._computeRerollCost === 'function')
          ? window.LootSystem._computeRerollCost(item)
          : 50;
        const costText = this.add.text(px, py + panelH / 2 - 88, _SHOP_T('shop.reroll.cost', { cost: cost }), {
          fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
        this.tabBody.push(costText);

        const rerollBg = this.add.rectangle(px - 70, py + panelH / 2 - 58, 130, 30, 0x3a3a3a)
          .setStrokeStyle(2, 0xd4a543).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        const rerollTxt = this.add.text(px - 70, py + panelH / 2 - 58, _SHOP_T('shop.reroll.btn'), {
          fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(rerollBg);
        this.tabBody.push(rerollTxt);
        rerollBg.on('pointerdown', () => this._doReroll(cost));

        const cancelBg = this.add.rectangle(px + 70, py + panelH / 2 - 58, 130, 30, 0x2a2a2a)
          .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2003)
          .setInteractive({ useHandCursor: true });
        const cancelTxt = this.add.text(px + 70, py + panelH / 2 - 58, _SHOP_T('shop.reroll.cancel'), {
          fontFamily: 'monospace', fontSize: '11px', color: '#cccccc'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
        this.tabBody.push(cancelBg);
        this.tabBody.push(cancelTxt);
        cancelBg.on('pointerdown', () => {
          this.selectedRerollItem = null;
          this._renderTab('reroll');
        });
      } else {
        // List inventory + equipped items as clickable rows
        items.slice(0, 12).forEach((entry, idx) => {
          const item = entry.item;
          const ry = py - panelH / 2 + 120 + idx * 24;
          const color = TIER_COLORS[item.tier || 0] || '#cccccc';
          const rowBg = this.add.rectangle(px, ry, panelW - 60, 22, 0x2a2a2a)
            .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(2003)
            .setInteractive({ useHandCursor: true });
          this.tabBody.push(rowBg);
          const nameText = this.add.text(px, ry, entry.label + (item.displayName || item._baseName || 'Item'), {
            fontFamily: 'monospace', fontSize: '12px', color: color
          }).setOrigin(0.5).setScrollFactor(0).setDepth(2004);
          this.tabBody.push(nameText);
          rowBg.on('pointerdown', () => {
            this.selectedRerollItem = item;
            this._renderTab('reroll');
          });
        });
      }
    }

    _doReroll(cost) {
      if (!this.selectedRerollItem) return;
      if (!window.LootSystem || typeof window.LootSystem.rerollItem !== 'function') {
        this._showToast(_SHOP_T('shop.toast.reroll_unavailable'));
        return;
      }
      const ok = window.LootSystem.rerollItem(this.selectedRerollItem, cost);
      if (!ok) {
        this._showToast(_SHOP_T('shop.toast.not_enough_gold'));
        return;
      }
      this._refreshGold();
      this._renderTab('reroll');
      this._showToast(_SHOP_T('shop.toast.reroll_success'));
      if (typeof window.LootSystem.recomputeBonuses === 'function') {
        try { window.LootSystem.recomputeBonuses(); } catch (e) { /* swallow */ }
      }
      if (typeof window._refreshInventoryHUD === 'function') {
        try { window._refreshInventoryHUD(); } catch (e) { /* swallow */ }
      }
    }

    // -----------------------------------------------------------------------
    // Toast
    // -----------------------------------------------------------------------
    _showToast(msg) {
      const cam = this.cameras.main;
      const txt = this.add.text(cam.width / 2, cam.height - 60, msg, {
        fontFamily: 'monospace', fontSize: '13px', color: '#88ff88',
        backgroundColor: '#0c0c11', padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
      this.tweens.add({
        targets: txt, alpha: 0, delay: 1500, duration: 400,
        onComplete: () => { try { txt.destroy(); } catch (e) { /* swallow */ } }
      });
    }
  }

  window.ShopScene = ShopScene;

  function _ensureShopSceneRegistered(game) {
    if (!game || !game.scene) return false;
    // getScene returns the scene instance if registered, null otherwise.
    let registered = null;
    try { registered = game.scene.getScene('ShopScene'); } catch (e) { registered = null; }
    if (!registered) {
      try {
        game.scene.add('ShopScene', ShopScene, false);
      } catch (e) {
        // Some Phaser versions throw if already added; safe to ignore.
      }
    }
    return true;
  }

  window.openShopScene = function (parentScene) {
    const game = window.game;
    if (!game || !game.scene) return;
    _ensureShopSceneRegistered(game);
    if (game.scene.isActive && game.scene.isActive('ShopScene')) return;
    // Phaser SceneManager has start/stop but NOT launch. The launch method
    // lives on the ScenePlugin attached to a Scene instance, so we have to
    // call it via parentScene.scene (the plugin) or fall back to a fresh
    // active scene.
    const launcher = (parentScene && parentScene.scene && typeof parentScene.scene.launch === 'function')
      ? parentScene.scene
      : (function () {
          const active = game.scene.scenes.find((s) => s && s.sys && s.sys.isActive());
          return active && active.scene && typeof active.scene.launch === 'function' ? active.scene : null;
        }());
    if (!launcher) return;
    launcher.launch('ShopScene', {
      from: (parentScene && parentScene.scene && parentScene.scene.key) || null
    });
  };
})();
