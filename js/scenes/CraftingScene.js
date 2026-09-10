// js/scenes/CraftingScene.js — Archivschmiede Crafting Scene

if (window.i18n) {
  window.i18n.register('de', {
    'crafting.title': 'ARCHIVSCHMIEDE',
    'crafting.materials.counter': 'Eisenbrocken: {count}',
    'crafting.materials.gold': 'Gold: {count}',
    'crafting.section.enhance': 'Ausrüstung verbessern',
    'crafting.section.inventory': 'Inventar (Equipment)',
    'crafting.section.ausbau': 'Ausbau',
    'crafting.ausbau.keins': 'Wähle links ein Stück aus.',
    'crafting.ausbau.stufe': 'Stufe {n} von {max}',
    'crafting.ausbau.wirkung': 'Jede Stufe hebt alle Werte um {pct} %.',
    'crafting.ausbau.kosten': 'Nächste Stufe: {gold} Gold + {brocken} Eisenbrocken',
    'crafting.ausbau.voll': 'Voll ausgebaut. Eine höhere Seltenheit gibt mehr Stufen.',
    'crafting.ausbau.rueckgabe': 'Beim Zerlegen kommen {n} Eisenbrocken zurück.',
    'crafting.btn.ausbau': 'Ausbauen',
    'crafting.kosten.aufwerten': 'Auf {tier}, +1 Affix\n{brocken} Eisenbrocken',
    'crafting.kosten.zerlegen': 'Bringt {brocken} Eisenbrocken',
    'crafting.feedback.ausbau_ok': 'Ausgebaut auf Stufe {n}.',
    'crafting.feedback.ausbau_gold': 'Zu wenig Gold: {gold} nötig.',
    'crafting.feedback.ausbau_brocken': 'Zu wenig Eisenbrocken: {brocken} nötig.',
    'crafting.feedback.ausbau_voll': 'Dieses Stück ist voll ausgebaut.',
    'crafting.btn.enhance': 'Verbessern',
    'crafting.btn.salvage': 'Zerlegen',
    'crafting.btn.mass_salvage': 'Massenzerlegung',
    'crafting.mass_salvage.hint': 'Zerlegt Inventar bis Selten/gelb — Legendär bleibt ({count})',
    'crafting.feedback.mass_salvaged': '{count} Items zerlegt: +{amount} Eisenbrocken',
    'crafting.feedback.mass_salvaged_none': 'Nichts zu zerlegen (gewöhnl./magisch)',
    'crafting.empty_slot': '(leer)',
    'crafting.slot.weapon': 'Waffe',
    'crafting.slot.offhand': 'Nebenhand',
    'crafting.slot.head': 'Helm',
    'crafting.slot.body': 'Rüstung',
    'crafting.slot.boots': 'Stiefel',
    'crafting.info.idle': 'Klicke einen Slot oder ein Inventar-Item zum Verbessern oder Zerlegen.\nReroll bei Mara im Schwarzmarkt.',
    'crafting.info.tier_affix': 'Tier: {tier}  |  Affixe: {count}',
    'crafting.info.enhance_to': 'Verbessern: -> {tier}, +1 Affix (behält bestehende) — {cost} Eisenbrocken',
    'crafting.info.already_legendary': 'Bereits Legendär — keine Verbesserung möglich.',
    'crafting.info.reroll_hint': 'Reroll verfügbar bei Mara (Schwarzmarkt).',
    'crafting.feedback.enhanced_to': 'Verbessert auf {tier}!',
    'crafting.feedback.salvaged': 'Zerlegt: +{amount} Eisenbrocken',
    'crafting.feedback.no_slot_item': 'Kein Gegenstand in diesem Slot.',
    'crafting.feedback.already_legendary': 'Item ist bereits Legendär.',
    'crafting.feedback.not_enough_iron_for': 'Nicht genug Eisenbrocken ({cost} nötig).',
    'crafting.feedback.not_enough_iron': 'Nicht genug Eisenbrocken!',
    'crafting.tier.common': 'Gewöhnlich',
    'crafting.tier.magic': 'Magisch',
    'crafting.tier.rare': 'Selten',
    'crafting.tier.legendary': 'Legendär'
  });
  window.i18n.register('en', {
    'crafting.title': 'ARCHIVE FORGE',
    'crafting.materials.counter': 'Iron Chunks: {count}',
    'crafting.materials.gold': 'Gold: {count}',
    'crafting.section.enhance': 'Enhance Equipment',
    'crafting.section.inventory': 'Inventory (Equipment)',
    'crafting.section.ausbau': 'Upgrade',
    'crafting.ausbau.keins': 'Pick an item on the left.',
    'crafting.ausbau.stufe': 'Level {n} of {max}',
    'crafting.ausbau.wirkung': 'Each level raises all values by {pct}%.',
    'crafting.ausbau.kosten': 'Next level: {gold} gold + {brocken} iron chunks',
    'crafting.ausbau.voll': 'Fully upgraded. A higher rarity grants more levels.',
    'crafting.ausbau.rueckgabe': 'Salvaging returns {n} iron chunks.',
    'crafting.btn.ausbau': 'Upgrade',
    'crafting.kosten.aufwerten': 'To {tier}, +1 affix\n{brocken} iron chunks',
    'crafting.kosten.zerlegen': 'Yields {brocken} iron chunks',
    'crafting.feedback.ausbau_ok': 'Upgraded to level {n}.',
    'crafting.feedback.ausbau_gold': 'Not enough gold: {gold} needed.',
    'crafting.feedback.ausbau_brocken': 'Not enough iron chunks: {brocken} needed.',
    'crafting.feedback.ausbau_voll': 'This item is fully upgraded.',
    'crafting.btn.enhance': 'Enhance',
    'crafting.btn.salvage': 'Salvage',
    'crafting.btn.mass_salvage': 'Mass Salvage',
    'crafting.mass_salvage.hint': 'Salvages inventory up to Rare/yellow — keeps Legendary ({count})',
    'crafting.feedback.mass_salvaged': '{count} items salvaged: +{amount} Iron Chunks',
    'crafting.feedback.mass_salvaged_none': 'Nothing to salvage (common/magic)',
    'crafting.empty_slot': '(empty)',
    'crafting.slot.weapon': 'Weapon',
    'crafting.slot.offhand': 'Off-Hand',
    'crafting.slot.head': 'Helm',
    'crafting.slot.body': 'Armor',
    'crafting.slot.boots': 'Boots',
    'crafting.info.idle': 'Click a slot or inventory item to enhance or salvage.\nReroll available at Mara in the Black Market.',
    'crafting.info.tier_affix': 'Tier: {tier}  |  Affixes: {count}',
    'crafting.info.enhance_to': 'Enhance: -> {tier}, +1 affix (keeps existing) — {cost} Iron Chunks',
    'crafting.info.already_legendary': 'Already Legendary — no further enhancement.',
    'crafting.info.reroll_hint': 'Reroll available at Mara (Black Market).',
    'crafting.feedback.enhanced_to': 'Enhanced to {tier}!',
    'crafting.feedback.salvaged': 'Salvaged: +{amount} Iron Chunks',
    'crafting.feedback.no_slot_item': 'No item in this slot.',
    'crafting.feedback.already_legendary': 'Item is already Legendary.',
    'crafting.feedback.not_enough_iron_for': 'Not enough Iron Chunks ({cost} needed).',
    'crafting.feedback.not_enough_iron': 'Not enough Iron Chunks!',
    'crafting.tier.common': 'Common',
    'crafting.tier.magic': 'Magic',
    'crafting.tier.rare': 'Rare',
    'crafting.tier.legendary': 'Legendary'
  });
}
const _CRAFT_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);
const _CRAFT_TIER_KEYS = ['crafting.tier.common', 'crafting.tier.magic', 'crafting.tier.rare', 'crafting.tier.legendary'];
// Die Ausruestungsplaetze — EINE Liste fuer Anzeige, Auffrischen, Filter und
// Layoutrechnung. Sie stand frueher viermal in dieser Datei, und die Hoehe
// der Platzspalte war zusaetzlich als Zahl 4 notiert; #124 trug den fuenften
// Platz zwar in die Listen ein, nicht aber in die Rechnung (#141).
const _CRAFT_EQUIP_SLOTS = ['weapon', 'offhand', 'head', 'body', 'boots'];

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
  if (!item) return _CRAFT_T('crafting.empty_slot');
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

    // --- Title ---
    this.add.text(W / 2, 20, _CRAFT_T('crafting.title'), {
      fontFamily: 'serif', fontSize: '24px', color: '#ffd166',
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
    // Die linke Spalte zeigt nur noch, WAS man besitzt: Platz, Name,
    // Seltenheit, Ausbaustufe. Die Einzelwerte standen frueher als gequetschte
    // Zeile darunter und liefen ueber die Spalte hinaus; sie stehen jetzt
    // rechts im Werktisch, wo Platz ist. Dadurch traegt die rechte Haelfte,
    // die vorher fast leer war, den eigentlichen Inhalt.
    const panelW = 330;

    this.add.text(leftX + panelW / 2, panelY, _CRAFT_T('crafting.section.enhance'), {
      fontFamily: 'monospace', fontSize: '16px', color: COL_GOLD
    }).setOrigin(0.5, 0).setDepth(10);

    // ----- Equipped slots (top of left panel) -----
    const slots = _CRAFT_EQUIP_SLOTS;
    const slotLabels = {
      weapon: _CRAFT_T('crafting.slot.weapon'),
      offhand: _CRAFT_T('crafting.slot.offhand'),
      head: _CRAFT_T('crafting.slot.head'),
      body: _CRAFT_T('crafting.slot.body'),
      boots: _CRAFT_T('crafting.slot.boots')
    };
    this.equipSlots = {};
    this.equipSlotBgs = {};

    const slotStartY = panelY + 24;
    const slotH = 36;
    const slotGap = 2;
    const slotW = panelW;

    slots.forEach((slot, i) => {
      const sy = slotStartY + i * (slotH + slotGap);
      const bg = this.add.rectangle(leftX + slotW / 2, sy + slotH / 2, slotW, slotH, COL_SLOT)
        .setDepth(9).setInteractive({ useHandCursor: true });
      bg.setStrokeStyle(2, 0x444444);

      const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
      const nameStr = item ? _composeItemName(item) : _CRAFT_T('crafting.empty_slot');
      const color = item ? _getTierColor(item) : COL_DISABLED;

      // Compact one-line layout: [Slot] Name (stats)
      const label = this.add.text(leftX + 8, sy + 4, '[' + slotLabels[slot] + ']', {
        fontFamily: 'monospace', fontSize: '10px', color: COL_GOLD
      }).setDepth(10);

      const nameText = this.add.text(leftX + 8, sy + 16, nameStr, {
        fontFamily: 'monospace', fontSize: '11px', color: color
      }).setDepth(10);

      // Statt der Wertezeile: Seltenheit und, wenn vorhanden, Ausbaustufe.
      // Beides entscheidet, ob sich ein Blick lohnt — die Einzelwerte liest
      // man rechts.
      const statsText = this.add.text(leftX + 8, sy + 26, this._platzZeile(item), {
        fontFamily: 'monospace', fontSize: '9px', color: '#8f8f8f'
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
    // #141: hier stand `4 * (slotH + 4)` — die Platzanzahl von VOR der
    // Nebenhand. Seit #124 sind es fuenf Kaesten, die Ueberschrift landete
    // deshalb 28 px innerhalb des Stiefel-Platzes und die Liste darunter
    // verdeckte ihn. Die Zahl haengt an der Laenge der Platzliste, also
    // steht sie jetzt auch dort.
    const invHeaderY = slotStartY + slots.length * (slotH + slotGap) + 6;
    this.add.text(leftX + 8, invHeaderY, _CRAFT_T('crafting.section.inventory'), {
      fontFamily: 'monospace', fontSize: '10px', color: COL_GOLD
    }).setDepth(10);

    this.invListY = invHeaderY + 14;
    this.invRowH = 28;
    this.invMaxRows = 2;
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

    // --- Rechter Werktisch (#115) ---
    //
    // Hier standen bis b226 die Schmiedeplaene: drei Rezepte mit FESTEN Werten
    // (Eisenklinge Schaden 8, iLevel 1, keine Affixe). Danach war die Haelfte
    // fast leer — eine Ueberschrift und vier Zeilen Text.
    //
    // Jetzt traegt sie das ausgewaehlte Stueck: Name in seiner Seltenheitsfarbe,
    // Ausbaustufe als Punktreihe, alle Werte untereinander statt in einer
    // Zeile mit Trennstrichen, die Affixe darunter, und ganz unten die beiden
    // Handlungen mit ihren Preisen.
    const rightX = leftX + panelW + 24;
    const rightW = W - rightX - 30;
    const werkY = panelY;

    this.werkbankRahmen = this.add.rectangle(
      rightX + rightW / 2, werkY + 158, rightW, 316, COL_PANEL
    ).setDepth(8).setStrokeStyle(1, 0x444444);

    this.werkbankName = this.add.text(rightX + 14, werkY + 12, '', {
      fontFamily: 'monospace', fontSize: '13px', color: COL_PARCHMENT,
      fontStyle: 'bold', wordWrap: { width: rightW - 28 }
    }).setDepth(10);

    this.werkbankStufe = this.add.text(rightX + 14, werkY + 48, '', {
      fontFamily: 'monospace', fontSize: '11px', color: COL_GOLD
    }).setDepth(10);

    // Zwei Spalten in EINEM Textobjekt: Name links, Zahl rechtsbuendig durch
    // Auffuellen. Untereinander liest man Zahlen deutlich schneller als in
    // einer Zeile mit Trennstrichen.
    this.werkbankWerte = this.add.text(rightX + 14, werkY + 70, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#cfcabb', lineSpacing: 2
    }).setDepth(10);

    this.werkbankAffixe = this.add.text(rightX + 14, werkY + 70, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#88aaff',
      lineSpacing: 2, wordWrap: { width: rightW - 28 }
    }).setDepth(10);

    // Trennlinie: darueber steht, WAS das Stueck ist, darunter, was man damit
    // tun kann. Ohne sie liest sich der Abstand wie eine Luecke statt wie eine
    // Gliederung.
    this.add.rectangle(rightX + rightW / 2, werkY + 196, rightW - 28, 1, 0x444444).setDepth(9);

    // Drei Preisspalten, jede genau ueber IHREM Knopf. Vorher standen alle
    // Preise untereinander in einem Block, und man musste raten, welche Zeile
    // zu welcher Handlung gehoert — bei zwei Waehrungen und drei Handlungen ist
    // das die Stelle, an der man sich verklickt.
    const spaltenB = 168, spaltenAbstand = 12;
    const spalte0 = rightX + 14;
    const spaltenStil = {
      fontFamily: 'monospace', fontSize: '10px', color: COL_PARCHMENT,
      lineSpacing: 2, wordWrap: { width: spaltenB }
    };
    this.kostenAufwerten = this.add.text(spalte0, werkY + 206, '', spaltenStil).setDepth(10);
    this.kostenAusbau = this.add.text(
      spalte0 + spaltenB + spaltenAbstand, werkY + 206, '', spaltenStil).setDepth(10);
    this.kostenZerlegen = this.add.text(
      spalte0 + 2 * (spaltenB + spaltenAbstand), werkY + 206, '', spaltenStil).setDepth(10);

    // Sammelfeld: die drei Spalten in einem String. Nur fuer Tests und Sonden —
    // sichtbar ist es nie.
    this.werkbankKosten = this.add.text(spalte0, werkY + 206, '', {
      fontFamily: 'monospace', fontSize: '11px', color: COL_PARCHMENT, lineSpacing: 2
    }).setDepth(10).setVisible(false);

    // Alle drei Handlungen an EINEM Ort. Vorher lagen Aufwerten und Zerlegen
    // unten links, der Ausbau rechts, und die Auskunft ueber das gewaehlte
    // Stueck stand in beiden Haelften — man musste zwischen ihnen hin und her
    // schauen, um eine einzige Entscheidung zu treffen.
    const btnB = 168, btnAbstand = 12;
    const btnY = werkY + 288;
    const btn0 = rightX + 14 + btnB / 2;
    this.enhanceBtn = this._createButton(
      btn0, btnY, btnB, 28, _CRAFT_T('crafting.btn.enhance'), () => this._enhanceItem()
    );
    this.ausbauBtn = this._createButton(
      btn0 + btnB + btnAbstand, btnY, btnB, 28,
      _CRAFT_T('crafting.btn.ausbau'), () => this._ausbauen()
    );
    this.salvageBtn = this._createButton(
      btn0 + 2 * (btnB + btnAbstand), btnY, btnB, 28,
      _CRAFT_T('crafting.btn.salvage'), () => this._salvageItem()
    );
    this.enhanceBtn.container.setVisible(false);
    this.ausbauBtn.container.setVisible(false);
    this.salvageBtn.container.setVisible(false);

    // ----- Massenzerlegung (persistent) — unter dem Werktisch -----
    // Bulk-salvage all unequipped Common+Magic gear in one click. Always
    // visible (unlike the selection-only Zerlegen button) and kept off the
    // crowded left/bottom area. Rare + Legendary are never touched, so a stray
    // click can't destroy good gear.
    // Weiter nach rechts und unten: sie steht unter der rechten Knopfreihe,
    // nicht mittig unter dem ganzen Bild — sie gehoert zum Werktisch.
    const _massY = H - 46;
this.massSalvageHint = this.add.text(rightX + rightW - 120, _massY - 16, '', {
      fontFamily: 'monospace', fontSize: '9px', color: COL_PARCHMENT
    }).setOrigin(0.5, 0.5).setDepth(10);
    this.massSalvageBtn = this._createButton(
      rightX + rightW - 120, _massY, 240, 26,
      _CRAFT_T('crafting.btn.mass_salvage'), () => this._massSalvage()
    );
    this._updateMassSalvageHint();

    // --- Feedback text ---
    this.feedbackText = this.add.text(W / 2, H - 60, '', {
      fontFamily: 'monospace', fontSize: '14px', color: COL_GREEN
    }).setOrigin(0.5, 0).setDepth(10);

    // --- Back button ---
    const backBtn = this._createButton(W / 2, H - 25, 220, 32, 'Zurück zum Hub [ESC]', () => this._returnToHub());

    // Initial render of inventory list
    this._refreshInventoryList();

    // Scroll handlers for the inventory list (mousewheel + arrow keys)
    this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
      if (dy > 0) this._scrollInventory(1);
      else if (dy < 0) this._scrollInventory(-1);
    });
    this.input.keyboard.on('keydown-DOWN', () => this._scrollInventory(1));
    this.input.keyboard.on('keydown-UP', () => this._scrollInventory(-1));

    // Mobile: on-screen ▲/▼ buttons (Mausrad + Pfeiltasten gibt es auf Touch
    // nicht). Sichtbarkeit/Dimmen steuert _refreshInventoryList bei Überlauf.
    const _scrBtnX = leftX + slotW - 20;
    this.invUpBtn = this._createButton(_scrBtnX, this.invListY + 14, 30, 24, '▲', () => this._scrollInventory(-1));
    this.invDownBtn = this._createButton(_scrBtnX, this.invListY + this.invRowH * this.invMaxRows - 14, 30, 24, '▼', () => this._scrollInventory(1));
    [this.invUpBtn, this.invDownBtn].forEach((b) => { if (b && b.container) b.container.setDepth(12); });
    this._setInvScrollButtons(false, 0, 0);

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

  // ▲/▼-Buttons ein-/ausblenden + an den Enden dimmen.
  _setInvScrollButtons(hasOverflow, offset, maxOffset) {
    if (this.invUpBtn && this.invUpBtn.container) {
      this.invUpBtn.container.setVisible(hasOverflow);
      if (this.invUpBtn.bg) this.invUpBtn.bg.setAlpha(offset > 0 ? 1 : 0.35);
    }
    if (this.invDownBtn && this.invDownBtn.container) {
      this.invDownBtn.container.setVisible(hasOverflow);
      if (this.invDownBtn.bg) this.invDownBtn.bg.setAlpha(offset < maxOffset ? 1 : 0.35);
    }
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
    // BEIDE Vorraete. Der Ausbau kostet Gold UND Brocken, hier stand aber nur
    // der Brockenstand — man konnte den Preis lesen und trotzdem nicht wissen,
    // ob man ihn bezahlen kann.
    const brocken = getMaterialCount('MAT');
    const LS = window.LootSystem;
    const gold = (LS && typeof LS.getGold === 'function') ? LS.getGold() : 0;
    this.matText.setText(_CRAFT_T('crafting.materials.gold', { count: gold })
      + '      ' + _CRAFT_T('crafting.materials.counter', { count: brocken }));
  }

  /** Eine Zeile fuer die kompakte Anzeige in der Platzspalte. */
  _getStatsLine(item) {
    return this._statPaare(item).map(function (z) { return z[0] + ' ' + z[1]; }).join('  ');
  }

  /**
   * Die Werte eines Stuecks als [Name, Wert]-Paare.
   *
   * NUR 'speed' ist ein Bruch (Eigenart der Basis, 0,15 = +15 %). Ruestung,
   * Krit, Lauftempo, Block und Brand stehen seit #104 als absolute PUNKTE da
   * und werden erst beim Tragen mit der Tiefe umgerechnet. Sie hier mit 100
   * zu multiplizieren ergab "Ruestung +2220,0 %" an einem Bronzehelm —
   * derselbe Fehler, der im Inventar-Tooltip in b215 behoben wurde.
   */
  _statPaare(item) {
    if (!item) return [];
    const PERCENT = { speed: true };
    const labels = {
      hp: 'LP', damage: 'Schaden', speed: 'Angr.tempo', range: 'Reichweite',
      armor: 'Rüstung', crit: 'Krit', move: 'Lauftempo',
      block: 'Block', brand: 'Brand', sicht: 'Sichtweite'
    };
    const paare = [];
    ['damage', 'armor', 'hp', 'crit', 'move', 'speed', 'range', 'block', 'brand', 'sicht']
      .forEach((k) => {
        const val = item[k];
        if (!val) return;
        const vz = val >= 0 ? '+' : '';
        let str;
        if (PERCENT[k]) str = vz + (val * 100).toFixed(1) + '%';
        else if (k === 'sicht') str = vz + val + '%';
        else str = vz + (Math.round(val * 10) / 10);
        paare.push([labels[k] || k, str]);
      });
    return paare;
  }

  /** Die Affixzeilen eines Stuecks, so wie sie im Inventar-Tooltip stehen. */
  _affixZeilen(item) {
    const LS = window.LootSystem;
    if (!item || !Array.isArray(item.affixes) || !LS || !LS.AFFIX_DEFS) return [];
    const raus = [];
    item.affixes.forEach((inst) => {
      if (!inst) return;
      const def = LS.AFFIX_DEFS.find((d) => d.id === inst.defId);
      if (!def) return;
      const txt = (typeof LS.getAffixTooltipText === 'function')
        ? LS.getAffixTooltipText(def, inst.value)
        : String(inst.value) + ' ' + def.statKey;
      if (txt) raus.push(txt);
    });
    return raus;
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
      this._showFeedback(_CRAFT_T('crafting.feedback.no_slot_item'), '#ff4444');
      return;
    }
    this._applySelection('equip', slot);
  }

  _selectInventory(idx) {
    const item = (typeof inventory !== 'undefined') ? inventory[idx] : null;
    if (!item) return;
    this._applySelection('inv', idx);
  }

  /** Die Auswahl hat sich geaendert — der Werktisch zeigt jetzt alles. */
  _showEnhanceInfoForSelection() {
    this._refreshAusbau();
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
      this._showFeedback(_CRAFT_T('crafting.feedback.already_legendary'), '#ff4444');
      return;
    }
    const cost = this._getEnhanceCost(item);
    if (getMaterialCount('MAT') < cost) {
      this._showFeedback(_CRAFT_T('crafting.feedback.not_enough_iron_for', { cost: cost }), '#ff4444');
      return;
    }
    if (typeof changeMaterialCount === 'function') {
      changeMaterialCount('MAT', -cost);
    }

    // Bump tier and ADD one fresh affix while KEEPING the existing ones
    // (additive enhance — never makes the item worse). The old behaviour
    // re-rolled the WHOLE affix set, so a good roll could be lost on upgrade.
    // Affix-only rerolls (replace, same tier) still live at Mara's Schwarzmarkt.
    const newTier = tier + 1;
    const kept = Array.isArray(item.affixes) ? item.affixes.slice() : [];
    const usedIds = {};
    kept.forEach(function (a) { if (a && a.defId) usedIds[a.defId] = true; });
    if (kept.length < newTier && window.LootSystem && typeof window.LootSystem.rollAffixes === 'function') {
      const iLevel = (typeof item.iLevel === 'number') ? item.iLevel : 1;
      let fresh = [];
      try {
        // Oversample so we can skip any affix the item already carries, then
        // append fresh UNIQUE affixes until we reach the new tier's count.
        fresh = window.LootSystem.rollAffixes(iLevel, newTier + kept.length + 3, Math.random, item.type) || [];
      } catch (e) { fresh = []; }
      for (let i = 0; i < fresh.length && kept.length < newTier; i++) {
        const f = fresh[i];
        if (f && f.defId && !usedIds[f.defId]) {
          usedIds[f.defId] = true;
          kept.push(f);
        }
      }
    }
    item.tier = newTier;
    item.affixes = kept;
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
    // Quest progress: tick any active craft objective (e.g. branka_weapons
    // wants 3 crafted items). The questSystem.onItemCrafted hook exists but
    // was never called — fixing here so craft-type quests are actually
    // completable.
    if (window.questSystem && typeof window.questSystem.onItemCrafted === 'function') {
      try { window.questSystem.onItemCrafted(); } catch (e) { /* swallow */ }
    }
    this._refreshAll();
    this._showEnhanceInfoForSelection();
    this._showFeedback(_CRAFT_T('crafting.feedback.enhanced_to', {
      tier: _CRAFT_T(_CRAFT_TIER_KEYS[Math.max(0, Math.min(3, newTier))])
    }), '#88ff88');
    this._flashEffect();
  }

  // =================== Ausbau (#115) ===================

  /** Die kurze Zeile unter einem Ausruestungsplatz. */
  _platzZeile(item) {
    if (!item) return '';
    const LS = window.LootSystem;
    const teile = [_CRAFT_T(_CRAFT_TIER_KEYS[Math.max(0, Math.min(3, Number(item.tier) || 0))])];
    const stufe = (LS && typeof LS.ausbauStufe === 'function') ? LS.ausbauStufe(item) : 0;
    if (stufe > 0) teile.push('Ausbau +' + stufe);
    return teile.join('  ·  ');
  }

  /**
   * Die Ausbaustufe als Punktreihe: gefuellt, was bezahlt ist, offen der Rest.
   * Auf einen Blick lesbar, ohne "3 von 5" im Kopf zu verrechnen.
   */
  _stufenPunkte(stufe, max) {
    let raus = '';
    for (let i = 0; i < max; i++) raus += (i < stufe) ? '●' : '○';
    return raus;
  }

  /** Zeichnet den Werktisch neu: Stueck, Werte, Affixe, Preise, Knopf. */
  _refreshAusbau() {
    if (!this.werkbankName) return;
    const LS = window.LootSystem;
    const item = this._getSelectedItem();
    const leer = !item;

    if (leer) {
      this.werkbankName.setText(_CRAFT_T('crafting.ausbau.keins')).setColor('#8f8f8f');
      this.werkbankStufe.setText('');
      this.werkbankWerte.setText('');
      this.werkbankAffixe.setText('');
      this.werkbankKosten.setText('');
      this.kostenAufwerten.setText('');
      this.kostenAusbau.setText('');
      this.kostenZerlegen.setText('');
      if (this.enhanceBtn) this.enhanceBtn.container.setVisible(false);
      if (this.ausbauBtn) this.ausbauBtn.container.setVisible(false);
      if (this.salvageBtn) this.salvageBtn.container.setVisible(false);
      return;
    }

    this.werkbankName.setText(_composeItemName(item)).setColor(_getTierColor(item));

    const stufe = (LS && typeof LS.ausbauStufe === 'function') ? LS.ausbauStufe(item) : 0;
    const max = (LS && typeof LS.ausbauMaxStufen === 'function') ? LS.ausbauMaxStufen(item) : 0;
    const seltenheit = _CRAFT_T(_CRAFT_TIER_KEYS[Math.max(0, Math.min(3, Number(item.tier) || 0))]);
    this.werkbankStufe.setText(seltenheit + '   ' + this._stufenPunkte(stufe, max)
      + '  ' + _CRAFT_T('crafting.ausbau.stufe', { n: stufe, max: max }));

    // Name links, Zahl rechtsbuendig — untereinander liest man Zahlen
    // schneller als in einer Zeile mit Trennstrichen.
    const paare = this._statPaare(item);
    const breite = 26;
    this.werkbankWerte.setText(paare.map(function (z) {
      const luecke = Math.max(1, breite - z[0].length - z[1].length);
      return z[0] + new Array(luecke + 1).join(' ') + z[1];
    }).join(String.fromCharCode(10)));

    const affixe = this._affixZeilen(item);
    this.werkbankAffixe.y = this.werkbankWerte.y + this.werkbankWerte.height + 8;
    this.werkbankAffixe.setText(affixe.join(String.fromCharCode(10)));

    // Preise: was fehlt, steht rot da. Rot heisst hier nicht "verboten",
    // sondern "dafuer reicht es noch nicht" — deshalb bleibt der Knopf sichtbar.
    const kosten = (LS && typeof LS.ausbauKosten === 'function') ? LS.ausbauKosten(item) : null;
    const gold = (LS && typeof LS.getGold === 'function') ? LS.getGold() : 0;
    const brocken = getMaterialCount('MAT');

    // Aufwerten hebt die SELTENHEIT und gibt einen Affix dazu — und schaltet
    // damit weitere Ausbaustufen frei. Beide Wege stehen nebeneinander, jeder
    // ueber seinem eigenen Knopf.
    const tier = Math.max(0, Math.min(3, Number(item.tier) || 0));
    const kannAufwerten = tier < 3;
    if (kannAufwerten) {
      const preisAuf = this._getEnhanceCost(item);
      this.kostenAufwerten.setText(_CRAFT_T('crafting.kosten.aufwerten', {
        tier: _CRAFT_T(_CRAFT_TIER_KEYS[tier + 1]), brocken: preisAuf
      }));
      this.kostenAufwerten.setColor(brocken >= preisAuf ? '#f1e9d8' : '#ff8844');
    } else {
      this.kostenAufwerten.setText(_CRAFT_T('crafting.info.already_legendary'))
        .setColor('#8f8f8f');
    }
    if (this.enhanceBtn) this.enhanceBtn.container.setVisible(kannAufwerten);
    if (kosten) {
      this.kostenAusbau.setText(
        _CRAFT_T('crafting.ausbau.wirkung', { pct: Math.round(LS.AUSBAU_JE_STUFE * 100) })
        + String.fromCharCode(10)
        + _CRAFT_T('crafting.ausbau.kosten', { gold: kosten.gold, brocken: kosten.brocken }));
      const reicht = gold >= kosten.gold && brocken >= kosten.brocken;
      this.kostenAusbau.setColor(reicht ? '#f1e9d8' : '#ff8844');
    } else {
      this.kostenAusbau.setText(_CRAFT_T('crafting.ausbau.voll')).setColor('#8f8f8f');
    }

    // Was das Zerlegen einbringt, gehoert ueber SEINEN Knopf — und VOR die
    // Entscheidung, sonst erfaehrt man erst hinterher, was verloren geht.
    const zurueck = (stufe > 0) ? LS.ausbauRueckgabe(item) : 0;
    this.kostenZerlegen.setText(_CRAFT_T('crafting.kosten.zerlegen', {
      brocken: this._salvageValue(item.tier) + zurueck
    })).setColor('#8f8f8f');

    this.werkbankKosten.setText([this.kostenAufwerten.text, this.kostenAusbau.text,
      this.kostenZerlegen.text].join(String.fromCharCode(10)));

    if (this.ausbauBtn) this.ausbauBtn.container.setVisible(!!kosten);
    if (this.salvageBtn) this.salvageBtn.container.setVisible(true);
  }

  _ausbauen() {
    const LS = window.LootSystem;
    const item = this._getSelectedItem();
    if (!LS || typeof LS.ausbauen !== 'function' || !item) return;
    const kosten = LS.ausbauKosten(item);
    if (!kosten) {
      this._showFeedback(_CRAFT_T('crafting.feedback.ausbau_voll'), '#ff4444');
      return;
    }
    // BEIDE Vorraete pruefen, BEVOR einer abgebucht wird. Sonst zahlt man
    // das Gold und scheitert dann an den Brocken.
    const gold = (typeof LS.getGold === 'function') ? LS.getGold() : 0;
    if (gold < kosten.gold) {
      this._showFeedback(_CRAFT_T('crafting.feedback.ausbau_gold', { gold: kosten.gold }), '#ff4444');
      return;
    }
    if (getMaterialCount('MAT') < kosten.brocken) {
      this._showFeedback(_CRAFT_T('crafting.feedback.ausbau_brocken', { brocken: kosten.brocken }), '#ff4444');
      return;
    }
    if (typeof LS.spendGold !== 'function' || !LS.spendGold(kosten.gold)) {
      this._showFeedback(_CRAFT_T('crafting.feedback.ausbau_gold', { gold: kosten.gold }), '#ff4444');
      return;
    }
    if (typeof changeMaterialCount === 'function') changeMaterialCount('MAT', -kosten.brocken);

    LS.ausbauen(item);

    // Die Werte des Stuecks haben sich geaendert — wer es traegt, muss das
    // sofort spueren, nicht erst im naechsten Raum.
    if (typeof LS.recomputeBonuses === 'function') { try { LS.recomputeBonuses(); } catch (e) {} }
    if (typeof recalcDerived === 'function') { try { recalcDerived(0, 0); } catch (e) {} }

    // Ausbauen IST das Herstellen fuer craft-Quests (branka_weapons, "Stelle
    // 3 Gegenstaende her"). Vorher haing der Haken am Schmieden von Rezepten;
    // die gibt es nicht mehr, also muss er hier sitzen — sonst waere die
    // Quest nur noch ueber das Aufwerten erfuellbar.
    if (window.questSystem && typeof window.questSystem.onItemCrafted === 'function') {
      try { window.questSystem.onItemCrafted(); } catch (e) { /* swallow */ }
    }
    if (typeof saveGame === 'function') { try { saveGame(); } catch (e) {} }

    this._showFeedback(_CRAFT_T('crafting.feedback.ausbau_ok', { n: LS.ausbauStufe(item) }), '#44ff44');
    this._refreshAll();
    this._flashEffect();
  }

  // =================== Salvage ===================
  // Eisenbrocken pro zerlegtem Item nach Tier: Gewöhnlich 1, Magisch 2,
  // Selten 4, Legendär 6. (Vorher 3/6/9/12 — zu grosszügig: Upgrades wurden
  // praktisch kostenlos finanziert, siehe #55.)
  _salvageValue(tier) {
    const VALUES = [1, 2, 4, 6];
    const t = Math.max(0, Math.min(3, (typeof tier === 'number') ? tier : 0));
    return VALUES[t];
  }

  /** Was der Ausbau eines Stuecks beim Zerlegen zurueckgibt (0 ohne Ausbau). */
  _ausbauRueckgabe(item) {
    const LS = window.LootSystem;
    return (LS && typeof LS.ausbauRueckgabe === 'function') ? LS.ausbauRueckgabe(item) : 0;
  }

  _salvageItem() {
    const item = this._getSelectedItem();
    if (!item) return;

    // #115: Die HAELFTE der Brocken, die in den Ausbau geflossen sind, kommt
    // zurueck. Ohne das waere jede Fehlinvestition endgueltig, und niemand
    // baute ein Stueck aus, das er vielleicht noch ersetzt.
    const matValue = this._salvageValue(item.tier) + this._ausbauRueckgabe(item);

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
    this._refreshAusbau();
    this._refreshAll();
    this._showFeedback(_CRAFT_T('crafting.feedback.salvaged', { amount: matValue }), '#ccaa33');
    this._flashEffect();
  }

  // =================== Mass Salvage ===================
  // Items eligible for bulk salvage: unequipped gear (weapon/head/body/boots)
  // of tier <= 2 — Common, Magic AND Rare ("gelbe" Items, tier-color #ffdd44).
  // Only LEGENDARY (tier 3, orange) is kept safe. Excludes the dev-cheat weapon,
  // amulets (run-specific, no salvage value), and potions/materials/quest items.
  // Equipped gear lives in `equipment`, NOT `inventory`, so it's never touched
  // here — only inventory items are salvaged (per request).
  _isMassSalvageable(it) {
    if (!it || it.devCheat) return false;
    if (_CRAFT_EQUIP_SLOTS.indexOf(it.type) === -1) return false;
    const tier = (typeof it.tier === 'number') ? it.tier : 0;
    return tier <= 2;
  }

  _countMassSalvageable() {
    if (typeof inventory === 'undefined' || !Array.isArray(inventory)) return 0;
    let n = 0;
    for (let i = 0; i < inventory.length; i++) {
      if (this._isMassSalvageable(inventory[i])) n++;
    }
    return n;
  }

  _updateMassSalvageHint() {
    if (!this.massSalvageHint) return;
    const n = this._countMassSalvageable();
    this.massSalvageHint.setText(_CRAFT_T('crafting.mass_salvage.hint', { count: n }));
    if (this.massSalvageBtn) {
      const enabled = n > 0;
      this.massSalvageBtn.bg.setFillStyle(enabled ? 0x3a3a3a : 0x222222);
      this.massSalvageBtn.text.setColor(enabled ? '#f1e9d8' : '#666666');
    }
  }

  _massSalvage() {
    if (typeof inventory === 'undefined' || !Array.isArray(inventory)) return;
    let count = 0;
    let total = 0;
    for (let i = 0; i < inventory.length; i++) {
      const it = inventory[i];
      if (!this._isMassSalvageable(it)) continue;
      total += this._salvageValue(it.tier) + this._ausbauRueckgabe(it);
      inventory[i] = null;
      count++;
    }
    if (count === 0) {
      this._showFeedback(_CRAFT_T('crafting.feedback.mass_salvaged_none'), '#ff8844');
      return;
    }
    if (typeof window !== 'undefined') window.inventory = inventory;

    if (typeof changeMaterialCount === 'function') {
      changeMaterialCount('MAT', total);
    } else if (typeof materialCounts !== 'undefined') {
      materialCounts.MAT = (materialCounts.MAT || 0) + total;
    }

    // A salvaged item may have been the active selection — clear it.
    this._selection = null;
    this._selectedSlot = null;
    this._clearVisualSelection();
    this._refreshAusbau();

    if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
      try { window.LootSystem.recomputeBonuses(); } catch (e) { /* swallow */ }
    }
    if (typeof saveGame === 'function') {
      try { saveGame(this); } catch (e) {}
    }

    this._refreshAll();
    this._updateMassSalvageHint();
    this._showFeedback(_CRAFT_T('crafting.feedback.mass_salvaged', { count: count, amount: total }), '#ccaa33');
    this._flashEffect();
  }

  // =================== Crafting ===================
  // =================== Refresh ===================
  _refreshAll() {
    this._updateMatText();
    this._refreshAusbau();

    // Refresh equipment slots
    const slots = _CRAFT_EQUIP_SLOTS;
    slots.forEach(slot => {
      const el = this.equipSlots[slot];
      if (!el) return;
      const item = (typeof equipment !== 'undefined') ? equipment[slot] : null;
      const nameStr = item ? _composeItemName(item) : _CRAFT_T('crafting.empty_slot');
      const color = item ? _getTierColor(item) : '#666666';

      el.nameText.setText(nameStr);
      el.nameText.setColor(color);
      el.statsText.setText(this._platzZeile(item));
    });

    // Refresh inventory list
    this._refreshInventoryList();

    // Keep the mass-salvage count/button state in sync with the inventory.
    this._updateMassSalvageHint();
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
      this._setInvScrollButtons(false, 0, 0);
      return;
    }

    // Collect all equipment items in inventory (with original index)
    const EQUIP_TYPES = new Set(_CRAFT_EQUIP_SLOTS);
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
      this._setInvScrollButtons(false, 0, 0);
      return;
    }
    this.invEmptyText.setVisible(false);

    // Clamp scroll offset against the new list length
    const maxOffset = Math.max(0, equipItems.length - this.invMaxRows);
    if (this.invScrollOffset > maxOffset) this.invScrollOffset = maxOffset;
    if (this.invScrollOffset < 0) this.invScrollOffset = 0;

    const visible = equipItems.slice(this.invScrollOffset, this.invScrollOffset + this.invMaxRows);

    // Overflow indicator with scroll position info + \u25B2/\u25BC-Buttons (Touch).
    const _hasOverflow = equipItems.length > this.invMaxRows;
    if (_hasOverflow) {
      const above = this.invScrollOffset;
      const below = equipItems.length - (this.invScrollOffset + visible.length);
      const parts = [];
      if (above > 0) parts.push('\u25B2' + above);
      if (below > 0) parts.push('\u25BC' + below);
      this.invOverflowText.setText(parts.join('  '));
    } else {
      this.invOverflowText.setText('');
    }
    this._setInvScrollButtons(_hasOverflow, this.invScrollOffset, maxOffset);

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

      const SLOT_LABEL = { weapon: 'W', offhand: 'N', head: 'H', body: 'R', boots: 'S' };
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
