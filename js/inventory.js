// Tier color/label maps (indexed by item.tier: 0=Common .. 3=Legendary).
// Read from window.TIER_COLORS (loot.js) when present so both modules share
// a single source of truth.
if (window.i18n) {
  window.i18n.register('de', {
    'inventory.tier.common': 'Gewöhnlich',
    'inventory.tier.magic': 'Magisch',
    'inventory.tier.rare': 'Selten',
    'inventory.tier.legendary': 'Legendär',
    'inventory.material.MAT': 'Eisenbrocken',
    'inventory.material.fallback': 'Material',
    'inventory.label.rarity': 'Seltenheit',
    'inventory.label.damage': 'Schaden',
    'inventory.label.speed': 'Tempo',
    'inventory.label.range': 'Reichweite',
    'inventory.label.armor': 'Rüstung',
    'inventory.label.crit': 'Krit',
    'inventory.label.move': 'Bewegung',
    'inventory.label.hp': 'LP',
    'inventory.attack.cooldown': '{name}: -{pct}% Cooldown',
    'inventory.attack.damage': '{name}: +{pct}% Schaden',
    'inventory.unknown_item': 'Unbekanntes Item',
    'inventory.title': 'Inventar',
    'inventory.help': 'Klicke ein Item zum Ausrüsten / Entfernen',
    'inventory.btn.equip': 'Ausrüsten',
    'inventory.btn.drop': 'Entfernen',
    'inventory.btn.portal': 'Portal ({count})'
  });
  window.i18n.register('en', {
    'inventory.tier.common': 'Common',
    'inventory.tier.magic': 'Magic',
    'inventory.tier.rare': 'Rare',
    'inventory.tier.legendary': 'Legendary',
    'inventory.material.MAT': 'Iron Chunk',
    'inventory.material.fallback': 'Material',
    'inventory.label.rarity': 'Rarity',
    'inventory.label.damage': 'Damage',
    'inventory.label.speed': 'Speed',
    'inventory.label.range': 'Range',
    'inventory.label.armor': 'Armor',
    'inventory.label.crit': 'Crit',
    'inventory.label.move': 'Move',
    'inventory.label.hp': 'HP',
    'inventory.attack.cooldown': '{name}: -{pct}% Cooldown',
    'inventory.attack.damage': '{name}: +{pct}% Damage',
    'inventory.unknown_item': 'Unknown Item',
    'inventory.title': 'Inventory',
    'inventory.help': 'Click an item to equip / drop',
    'inventory.btn.equip': 'Equip',
    'inventory.btn.drop': 'Drop',
    'inventory.btn.portal': 'Portal ({count})'
  });
}
const _INV_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);
const _INV_TIER_KEYS = ['inventory.tier.common', 'inventory.tier.magic', 'inventory.tier.rare', 'inventory.tier.legendary'];

const INV_TIER_COLORS_FALLBACK = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];
// Kept as a tuple so legacy index-based callers still work; values are
// resolved live via i18n through getItemTierLabel below.
const INV_TIER_LABELS = ['Gewöhnlich', 'Magisch', 'Selten', 'Legendär'];

const getItemTier = (it) => {
  if (!it) return 0;
  const t = Number(it.tier);
  if (Number.isFinite(t)) return Math.max(0, Math.min(3, Math.round(t)));
  return 0;
};
const getItemTierColor = (it) => {
  const arr = (window && window.TIER_COLORS) || INV_TIER_COLORS_FALLBACK;
  return arr[getItemTier(it)];
};
const getItemTierLabel = (it) => _INV_T(_INV_TIER_KEYS[getItemTier(it)] || _INV_TIER_KEYS[0]);
const getItemDisplayName = (it) => {
  if (!it) return '';
  if (window.LootSystem && typeof window.LootSystem.composeName === 'function') {
    try { return window.LootSystem.composeName(it); } catch (e) { /* fall through */ }
  }
  return it.displayName || it._baseName || it.name || 'Item';
};
const getItemLevel = (it) => {
  if (!it) return 0;
  if (typeof it.itemLevel === 'number') return it.itemLevel;
  const compute = window.computeItemLevelFromStats;
  if (typeof compute === 'function') {
    const lvl = compute(it, window.DUNGEON_DEPTH || 1);
    it.itemLevel = lvl;
    return lvl;
  }
  return 1;
};

// --------------------------------------------------
//  Material Management (Eisenbrocken counter)
// --------------------------------------------------
const MATERIAL_DISPLAY_NAMES = {
  MAT: 'Eisenbrocken'
};

const FALLBACK_ITEM_ICONS = {
  weapon: 'itWeapon',
  head: 'itHead',
  body: 'itBody',
  boots: 'itBoots',
  consumable: 'itConsumable',
  material: 'itMat'
};

const UPGRADEABLE_TYPES = new Set(['weapon', 'head', 'body', 'boots']);

let materialCounts = window.materialCounts;
if (!materialCounts || typeof materialCounts !== 'object') {
  materialCounts = {};
}
if (typeof materialCounts.MAT !== 'number') {
  // Test default: start every new run with 20 Eisenbrocken so the forge is
  // immediately usable for QA. Saved games override this via storage.js.
  materialCounts.MAT = 20;
}
if (typeof materialCounts.PORTAL_SCROLL !== 'number') {
  materialCounts.PORTAL_SCROLL = 2; // start with 2 free scrolls
}
window.materialCounts = materialCounts;

const getItemMaterialKey = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.materialKey === 'string' && item.materialKey.length) return item.materialKey;
  if (typeof item.baseMaterialKey === 'string' && item.baseMaterialKey.length) return item.baseMaterialKey;
  if (typeof item.key === 'string' && item.key.length) return item.key;
  return null;
};

function getMaterialCount(key) {
  if (!key) return 0;
  const store = window.materialCounts || materialCounts;
  const raw = store?.[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function changeMaterialCount(key, delta) {
  if (!key || typeof delta !== 'number' || !Number.isFinite(delta)) return;
  const store = window.materialCounts || materialCounts;
  const current = store?.[key] || 0;
  const next = Math.max(0, Math.round(current + delta));
  store[key] = next;
}

function addMaterialToStorage(item, amount = 1, { silent = false } = {}) {
  const key = getItemMaterialKey(item);
  if (!key) return false;
  changeMaterialCount(key, amount);
  if (!silent) updateMaterialCounterUI();
  return true;
}

function spendMaterialFromStorage(key, amount) {
  if (!key) return false;
  const current = getMaterialCount(key);
  if (amount <= 0) return true;
  if (current < amount) return false;
  changeMaterialCount(key, -amount);
  updateMaterialCounterUI();
  return true;
}

function setMaterialCounts(snapshot) {
  const store = window.materialCounts || materialCounts;
  Object.keys(store).forEach((key) => { store[key] = 0; });
  store.MAT = store.MAT || 0;
  if (snapshot && typeof snapshot === 'object') {
    Object.entries(snapshot).forEach(([key, value]) => {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) {
        store[key] = Math.max(0, Math.floor(num));
      }
    });
  }
  updateMaterialCounterUI();
}

function siphonMaterialsFromInventory() {
  if (typeof inventory === 'undefined' || !Array.isArray(inventory)) return;
  let updated = false;
  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    if (!item || item.type !== 'material') continue;
    const handled = addMaterialToStorage(item, item.amount || 1, { silent: true });
    if (handled) {
      inventory[i] = null;
      updated = true;
    }
  }
  if (updated) {
    updateMaterialCounterUI();
  }
}

function isValidGameObject(obj) {
  if (!obj) return false;
  const scene = obj.scene;
  if (!scene || !scene.sys) return false;
  if (scene.sys.isDestroyed) return false;
  if (obj.destroyed || obj._destroyed) return false;
  return true;
}

function updateMaterialCounterUI() {
  const counterText = (typeof invUI !== 'undefined' && invUI && invUI.materialsText)
    ? invUI.materialsText
    : null;
  if (!isValidGameObject(counterText)) {
    if (invUI && invUI.materialsText === counterText) {
      invUI.materialsText = null;
    }
    return;
  }
  const label = _INV_T('inventory.material.MAT') || MATERIAL_DISPLAY_NAMES.MAT || _INV_T('inventory.material.fallback');
  counterText.setText(`${label}: ${getMaterialCount('MAT')}`);
}

const getTextureManager = () => {
  const maybeInvUI = (typeof invUI !== 'undefined') ? invUI : null;
  const managers = [
    maybeInvUI?.panel?.scene?.textures,
    tooltip?.scene?.textures,
    window.game?.textures,
    window.Phaser?.Scene?.systems?.textures
  ];
  for (const mgr of managers) {
    if (mgr && typeof mgr.exists === 'function') return mgr;
  }
  return null;
};

function resolveItemIconKey(item) {
  if (!item) return null;
  const textures = getTextureManager();
  const hasTexture = (key) => !textures || (key && textures.exists(key));
  const genericIcons = new Set(['itMat', 'lootTexture', 'chest_small', 'chest_medium', 'chest_large', 'uiSlot']);
  if (item.iconKey && hasTexture(item.iconKey)) {
    if (item.type && item.type !== 'material' && genericIcons.has(item.iconKey)) {
      // prefer type-based fallback over generic chest/material icons
    } else {
      return item.iconKey;
    }
  }
  const fallback = FALLBACK_ITEM_ICONS[item.type];
  if (fallback && hasTexture(fallback)) return fallback;
  return hasTexture('itMat') ? 'itMat' : null;
}

const SLOT_BASE_ALPHA = 0.32;
const SLOT_HOVER_ALPHA = 0.62;
const SLOT_EMPTY_HOVER_ALPHA = 0.4;

function parseTintColor(value, fallback = 0xffffff) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    let hex = value.trim();
    if (hex.startsWith('#')) hex = hex.slice(1);
    const num = parseInt(hex, 16);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
}

function setSpriteTint(sprite, color) {
  if (!sprite) return;
  if (typeof sprite.setTintFill === 'function') sprite.setTintFill(color);
  else if (typeof sprite.setTint === 'function') sprite.setTint(color);
}

function setSlotHighlight(target, item) {
  if (!isValidGameObject(target)) return;
  let highlight = target.__hoverHighlight;
  if (!isValidGameObject(highlight)) {
    highlight = null;
    target.__hoverHighlight = null;
  }
  const hasItem = !!item;
  const tintColor = hasItem ? parseTintColor(getItemTierColor(item), 0xffffff) : null;

  if (highlight) {
    if (hasItem) {
      setSpriteTint(highlight, tintColor);
      highlight.setAlpha(SLOT_BASE_ALPHA);
      highlight.setVisible(true);
    } else {
      highlight.setVisible(false);
      highlight.setAlpha(0);
    }
  } else {
    if (hasItem) {
      setSpriteTint(target, tintColor);
      if (typeof target.setAlpha === 'function') target.setAlpha(SLOT_BASE_ALPHA);
    } else {
      if (typeof target.clearTint === 'function') target.clearTint();
      if (typeof target.setAlpha === 'function') target.setAlpha(1);
    }
  }

  target.__highlightTintColor = tintColor;
  target.__highlightBaseAlpha = hasItem ? SLOT_BASE_ALPHA : 0;
  target.__hasBaseHighlight = hasItem;
  target.__hoverTintApplied = false;
  target.__hoverTempHighlight = false;
}

function getEquippedLevelForType(type) {
  if (!type || typeof equipment !== 'object' || !equipment) return 0;
  const equippedItem = equipment[type];
  if (!equippedItem) return 0;
  return getItemLevel(equippedItem);
}

function isItemUpgrade(item) {
  if (!item || !UPGRADEABLE_TYPES.has(item.type)) return false;
  const itemLevel = getItemLevel(item);
  const equippedLevel = getEquippedLevelForType(item.type);
  return itemLevel > equippedLevel;
}

function applySlotHoverTint(target, item) {
  if (!isValidGameObject(target)) return;
  let highlight = target.__hoverHighlight;
  if (!isValidGameObject(highlight)) {
    highlight = null;
    target.__hoverHighlight = null;
  }
  const hasItem = !!item;
  const tintColor = hasItem
    ? (target.__highlightTintColor ?? parseTintColor(getItemTierColor(item), 0xffffff))
    : parseTintColor('#777777', 0x777777);

  if (highlight) {
    if (!highlight.visible) {
      setSpriteTint(highlight, tintColor);
      highlight.setVisible(true);
      target.__hoverTempHighlight = !target.__hasBaseHighlight;
    } else if (hasItem) {
      setSpriteTint(highlight, tintColor);
    }
    const alpha = hasItem ? SLOT_HOVER_ALPHA : SLOT_EMPTY_HOVER_ALPHA;
    highlight.setAlpha(alpha);
  } else {
    setSpriteTint(target, tintColor);
    if (typeof target.setAlpha === 'function') {
      target.setAlpha(hasItem ? SLOT_HOVER_ALPHA : SLOT_EMPTY_HOVER_ALPHA);
    }
  }

  target.__hoverTintApplied = true;
}

function clearSlotHoverTint(target) {
  if (!isValidGameObject(target) || !target.__hoverTintApplied) return;
  let highlight = target.__hoverHighlight;
  if (!isValidGameObject(highlight)) {
    highlight = null;
    target.__hoverHighlight = null;
  }
  if (highlight) {
    if (target.__hasBaseHighlight) {
      highlight.setAlpha(target.__highlightBaseAlpha ?? SLOT_BASE_ALPHA);
    } else if (target.__hoverTempHighlight) {
      highlight.setVisible(false);
      highlight.setAlpha(0);
    } else {
      highlight.setVisible(false);
      highlight.setAlpha(0);
    }
  } else {
    if (target.__hasBaseHighlight) {
      const tintColor = target.__highlightTintColor ?? 0xffffff;
      setSpriteTint(target, tintColor);
      if (typeof target.setAlpha === 'function') {
        target.setAlpha(target.__highlightBaseAlpha ?? SLOT_BASE_ALPHA);
      }
    } else {
      if (typeof target.clearTint === 'function') target.clearTint();
      if (typeof target.setAlpha === 'function') target.setAlpha(1);
    }
  }
  target.__hoverTintApplied = false;
  target.__hoverTempHighlight = false;
}

if (typeof window !== 'undefined') {
  window.getMaterialCount = getMaterialCount;
  window.addMaterialToStorage = addMaterialToStorage;
  window.spendMaterialFromStorage = spendMaterialFromStorage;
  window.updateMaterialCounterUI = updateMaterialCounterUI;
  window.siphonMaterialsFromInventory = siphonMaterialsFromInventory;
  window.getItemMaterialKey = getItemMaterialKey;
  window.setMaterialCounts = setMaterialCounts;
  window.destroyInventoryUI = destroyInventoryUI;
}

function initInventoryUI() {
  const scene = this;
  const BASE_W = 1200;
  const BASE_H = 600;

  // Panelgröße
  const PANEL_W = 800, PANEL_H = 480;
  const GRID_COLS = INV_COLS, GRID_ROWS = INV_ROWS;

  // Overlay
  const overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.35)
    .setOrigin(0).setDepth(9998).setScrollFactor(0).setVisible(false)
    .setInteractive();
  overlay.setName?.('InventoryOverlay');
  overlay.on('pointerdown', () => closeInventory());

  // Panel
  const panel = scene.add.container(scene.scale.width / 2, scene.scale.height / 2)
    .setDepth(10000).setScrollFactor(0).setVisible(false);
  if (typeof panel.setName === 'function') panel.setName('InventoryPanel');

  const panelBg = scene.add.image(0, 0, 'uiPanel').setOrigin(0.5).setDisplaySize(PANEL_W, PANEL_H).setScrollFactor(0);
  panel.add(panelBg);

  const title = scene.add.text(-PANEL_W / 2 + 20, -PANEL_H / 2 + 12, _INV_T('inventory.title'), {
    fontFamily: 'serif', fontSize: '26px', fill: '#ffd166', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 5, resolution: 2
  }).setOrigin(0, 0).setScrollFactor(0);
  panel.add(title);

  const help = scene.add.text(-PANEL_W / 2 + 20, -PANEL_H / 2 + 44,
    _INV_T('inventory.help'),
    { fontSize: '13px', fill: '#dddddd', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4, resolution: 2
    }).setOrigin(0, 0).setScrollFactor(0);
  panel.add(help);

  const materialCounter = scene.add.text(-PANEL_W / 2 + 20, -PANEL_H / 2 + 64, '', {
    fontSize: '16px', fontFamily: 'monospace',
    fill: '#f4d06f', stroke: '#000000', strokeThickness: 4, resolution: 2
  }).setOrigin(0, 0).setScrollFactor(0);
  panel.add(materialCounter);
  invUI.materialsText = materialCounter;
  updateMaterialCounterUI();

  const btnClose = scene.add.text(PANEL_W / 2 - 16, -PANEL_H / 2 + 10, '✕', {
    fontSize: '18px', fill: '#ff6666', fontStyle: 'bold'
  }).setOrigin(1, 0).setScrollFactor(0).setInteractive({ useHandCursor: true })
    .on('pointerdown', () => closeInventory());
  panel.add(btnClose);

  // --- Equipment links, aber innerhalb Panel ---
  // Tooltip Setup (vor Slot-Events verfügbar machen)
  const createTooltipBox = (bgColor = 0x000000) => {
    const container = scene.add.container(0, 0);
    container.setDepth(10001);
    if (typeof container.setScrollFactor === 'function') {
      container.setScrollFactor(0);
    }
    container.setVisible(false);
    const bg = scene.add.graphics();
    if (typeof bg.setScrollFactor === 'function') bg.setScrollFactor(0);
    container.add(bg);
    const title = scene.add.text(0, 0, '', { fontSize: '14px', fontStyle: 'bold', color: '#ffffff' });
    if (typeof title.setScrollFactor === 'function') title.setScrollFactor(0);
    const body = scene.add.text(0, 0, '', { fontSize: '12px', color: '#ffffff' });
    if (typeof body.setScrollFactor === 'function') body.setScrollFactor(0);
    container.add([title, body]);
    container.bg = bg;
    container.title = title;
    container.body = body;
    container.bgColor = bgColor;
    container._width = 0;
    container._height = 0;
    return container;
  };

  const layoutTooltipBox = (box) => {
    if (!box || !box.title || !box.body || !box.bg) return;
    const paddingX = 10;
    const paddingY = 8;
    const gap = box.title.text && box.body.text ? 6 : 0;
    box.title.setPosition(paddingX, paddingY);
    box.body.setPosition(paddingX, paddingY + (box.title.text ? box.title.height + gap : 0));
    const contentWidth = Math.max(
      box.title.text ? box.title.width : 0,
      box.body.text ? box.body.width : 0
    );
    const contentHeight = (box.title.text ? box.title.height : 0)
      + (box.body.text ? gap + box.body.height : 0);
    const totalWidth = Math.max(32, paddingX * 2 + contentWidth);
    const totalHeight = Math.max(24, paddingY * 2 + contentHeight);
    box.bg.clear();
    box.bg.fillStyle(box.bgColor, 0.92);
    box.bg.fillRoundedRect(0, 0, totalWidth, totalHeight, 8);
    box._width = totalWidth;
    box._height = totalHeight;
  };

  const tooltipBox = createTooltipBox(0x000000);
  if (typeof tooltipBox.setName === 'function') tooltipBox.setName('InventoryTooltip');
  tooltip = tooltipBox;

  const ensureCompareTooltip = () => {
    if (tooltip.compareBox) return tooltip.compareBox;
    tooltip.compareBox = createTooltipBox(0x111111);
    if (typeof tooltip.compareBox.setName === 'function') tooltip.compareBox.setName('InventoryTooltipCompare');
    return tooltip.compareBox;
  };

  const hideTooltip = () => {
    if (tooltip) tooltip.setVisible(false);
    if (tooltip?.compareBox) tooltip.compareBox.setVisible(false);
  };

  const formatItemTooltip = (it, heading) => {
    if (!it) return { title: '', body: '' };
    const bodyLines = [];
    if (heading) bodyLines.push(heading);
    bodyLines.push(`${_INV_T('inventory.label.rarity')}: ${getItemTierLabel(it)}`);
    const lvl = getItemLevel(it);
    bodyLines.push(`Item Level: ${lvl}`);
    if (it.type) bodyLines.push(`Typ: ${(it.type || '').toUpperCase()}`);

    const pushStat = (label, value, decimals = 1, suffix = '') => {
      const num = Number(value) || 0;
      if (num <= 0) return;
      bodyLines.push(`${label}: +${num.toFixed(decimals)}${suffix}`);
    };

    pushStat(_INV_T('inventory.label.hp'), it.hp, 1);
    pushStat(_INV_T('inventory.label.damage'), it.damage, 1);
    pushStat(_INV_T('inventory.label.speed'), it.speed, 2);
    pushStat(_INV_T('inventory.label.range'), it.range, 1);
    pushStat(_INV_T('inventory.label.armor'), (it.armor || 0) * 100, 1, '%');
    pushStat(_INV_T('inventory.label.crit'), (it.crit || 0) * 100, 1, '%');
    pushStat(_INV_T('inventory.label.move'), it.move, 1);
    // Affix lines (WP02+). Each affix renders its tooltipText with {value} replaced.
    // Prefer LootSystem.getAffixTooltipText (i18n-aware) over the raw def.tooltipText.
    if (Array.isArray(it.affixes) && it.affixes.length && window.LootSystem?.AFFIX_DEFS) {
      const defs = window.LootSystem.AFFIX_DEFS;
      const getTip = window.LootSystem.getAffixTooltipText;
      it.affixes.forEach((inst) => {
        if (!inst) return;
        const def = defs.find((d) => d.id === inst.defId);
        if (!def) return;
        const txt = (typeof getTip === 'function')
          ? getTip(def, inst.value)
          : (def.tooltipText || '').replace('{value}', inst.value);
        if (txt) bodyLines.push(txt);
      });
    }
    if (Array.isArray(it.attackEffects) && it.attackEffects.length) {
      const labels = (typeof ABILITY_LABELS !== 'undefined' ? ABILITY_LABELS : (window?.ABILITY_LABELS || {}));
      it.attackEffects.forEach((effect) => {
        if (!effect) return;
        const name = labels[effect.ability] || effect.ability || 'Attack';
        const pct = Math.round(Math.max(0, (effect.value || 0) * 100));
        if (pct <= 0) return;
        if (effect.stat === 'cooldown') {
          bodyLines.push(_INV_T('inventory.attack.cooldown', { name: name, pct: pct }));
        } else if (effect.stat === 'damage') {
          bodyLines.push(_INV_T('inventory.attack.damage', { name: name, pct: pct }));
        }
      });
    }
    return {
      title: getItemDisplayName(it) || it.name || _INV_T('inventory.unknown_item'),
      body: bodyLines.join('\n')
    };
  };

  const applyTooltipContent = (box, item, heading) => {
    if (!box || !item || !box.title || !box.body) return false;
    const info = formatItemTooltip(item, heading);
    box.title.setText(info.title || '');
    box.title.setStyle({ color: getItemTierColor(item) });
    box.body.setText(info.body || '');
    box.body.setStyle({ color: '#ffffff' });
    layoutTooltipBox(box);
    return true;
  };

  const positionTooltipBox = (box, x, y) => {
    if (!box) return;
    box.setPosition(x, y);
    box.setVisible(true);
  };

  const showItemTooltip = (pointer, it, compare) => {
    if (!tooltip) return;
    if (!it) {
      hideTooltip();
      return;
    }

    applyTooltipContent(tooltip, it);
    positionTooltipBox(tooltip, pointer.x + 16, pointer.y + 16);

    if (compare && compare !== it) {
      const compareBox = ensureCompareTooltip();
      if (applyTooltipContent(compareBox, compare, 'Ausgerüstet')) {
        const compareX = tooltip.x + tooltip._width + 12;
        positionTooltipBox(compareBox, compareX, tooltip.y);
      }
    } else if (tooltip.compareBox) {
      tooltip.compareBox.setVisible(false);
    }
  };

const equipKeys = ['weapon', 'head', 'body', 'boots'];
const EQUIP_X = -PANEL_W / 2 + 160;  // Slots leicht nach rechts
const EQUIP_Y0 = -PANEL_H / 2 + 160;
const EQUIP_STEP = 90;

  for (let i = 0; i < equipKeys.length; i++) {
    const y = EQUIP_Y0 + i * EQUIP_STEP;

    const slot = scene.add.image(EQUIP_X, y, 'uiSlot')
      .setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
    slot.on('pointerdown', () => {
      selectEquipSlot(equipKeys[i]);
      hideTooltip();
      clearSlotHoverTint(slot);
    });
    slot.on('pointerover', (pointer) => {
      const item = equipment[equipKeys[i]];
      applySlotHoverTint(slot, item);
      showItemTooltip(pointer, item);
    });
    slot.on('pointermove', (pointer) => {
      if (tooltip?.visible) {
        const item = equipment[equipKeys[i]];
        applySlotHoverTint(slot, item);
        showItemTooltip(pointer, item);
      }
    });
    slot.on('pointerout', () => {
      clearSlotHoverTint(slot);
      hideTooltip();
    });
    panel.add(slot);

    const highlight = scene.add.image(EQUIP_X, y, 'uiSlot')
      .setOrigin(0.5).setScrollFactor(0).setVisible(false).setAlpha(SLOT_BASE_ALPHA);
    panel.add(highlight);
    slot.__hoverHighlight = highlight;

    const icon = scene.add.image(EQUIP_X, y, 'itMat').setOrigin(0.5).setVisible(false).setScrollFactor(0);
    panel.add(icon);

    invUI.equip[equipKeys[i]] = { slot, icon, highlight };
  }

  // --- Grid rechts ---
  invUI.slots = [];
  let idx = 0;

  const GRID_X0 = -PANEL_W / 2 + 260;
  const GRID_Y0 = -PANEL_H / 2 + 100;
  const GRID_W = PANEL_W - 320;
  const GRID_H = PANEL_H - 160;

  const cellW = GRID_W / GRID_COLS;
  const cellH = GRID_H / GRID_ROWS;

  const SLOT_W = 96, SLOT_H = 64;

  // Slots etwas größer
  const slotScaleX = (cellW * 0.95) / SLOT_W;
  const slotScaleY = (cellH * 0.95) / SLOT_H;
  const slotScale = Math.min(slotScaleX, slotScaleY, 0.65);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = GRID_X0 + c * cellW + cellW / 2;
      const y = GRID_Y0 + r * cellH + cellH / 2;

      const bg = scene.add.image(x, y, 'uiSlot').setOrigin(0.5).setScale(slotScale).setScrollFactor(0).setInteractive({ useHandCursor: true });
      bg.idx = idx;
      bg.on('pointerdown', () => {
        selectInventorySlot(bg.idx);
        hideTooltip();
        clearSlotHoverTint(bg);
      });
      bg.on('pointerover', (pointer) => {
        const item = inventory[bg.idx];
        const compare = item && equipment[item.type];
        applySlotHoverTint(bg, item);
        showItemTooltip(pointer, item, compare);
      });
      bg.on('pointermove', (pointer) => {
        if (tooltip?.visible) {
          const item = inventory[bg.idx];
          const compare = item && equipment[item.type];
          applySlotHoverTint(bg, item);
          showItemTooltip(pointer, item, compare);
        }
      });
      bg.on('pointerout', () => {
        clearSlotHoverTint(bg);
        hideTooltip();
      });
      panel.add(bg);

      const highlight = scene.add.image(x, y, 'uiSlot').setOrigin(0.5).setScale(slotScale).setScrollFactor(0).setVisible(false).setAlpha(SLOT_BASE_ALPHA);
      panel.add(highlight);
      bg.__hoverHighlight = highlight;

      const icon = scene.add.image(x, y - 10, 'itMat').setOrigin(0.5).setVisible(false).setScale(slotScale * 0.8).setScrollFactor(0);
      panel.add(icon);

      const indicator = scene.add.image(
        x + slotScale * SLOT_W * 0.28,
        y - slotScale * SLOT_H * 0.35,
        'uiItemBetter'
      ).setOrigin(0.5).setScale(Math.min(0.55, slotScale * 0.6)).setScrollFactor(0).setVisible(false);
      indicator.setAlpha(0.9);
      indicator.setDepth((panel.depth || 10000) + 5);
      panel.add(indicator);

      const label = scene.add.text(x, y + 20, '', {
        fontSize: '15px', fill: '#fff', fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setVisible(false);
      panel.add(label);

      invUI.slots.push({ bg, icon, label, highlight, indicator });
      idx++;
    }
  }

  // --- Buttons ---
  const btnPortal = scene.add.text(PANEL_W / 2 - 30, -PANEL_H / 2 + 58, '', {
    fontSize: '13px',
    fill: '#fff',
    fontFamily: 'monospace',
    backgroundColor: '#486c1d',
    padding: { x: 10, y: 5 }
  })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => {
      const scrolls = (window.materialCounts && window.materialCounts.PORTAL_SCROLL) || 0;
      if (scrolls <= 0) return;
      window.materialCounts.PORTAL_SCROLL = scrolls - 1;
      _refreshPortalButton();
      closeInventory();
      if (typeof leaveDungeonForHub === 'function') {
        leaveDungeonForHub(scene, { reason: 'portal' });
      }
    });
  panel.add(btnPortal);
  invUI.portalBtn = btnPortal;

  window._refreshPortalButton = function () {
    const count = (window.materialCounts && typeof window.materialCounts.PORTAL_SCROLL === 'number')
      ? window.materialCounts.PORTAL_SCROLL : 0;
    btnPortal.setText(_INV_T('inventory.btn.portal', { count: count }));
    btnPortal.setStyle({
      backgroundColor: count > 0 ? '#486c1d' : '#333333',
      fill: count > 0 ? '#fff' : '#888'
    });
  };
  window._refreshPortalButton();

  const btnY = PANEL_H / 2 - 24;
  const btnEquip = scene.add.text(-70, btnY, _INV_T('inventory.btn.equip'), { fontSize: '14px', fill: '#fff', backgroundColor: '#47a', padding: { x: 10, y: 5 } })
    .setOrigin(0.5, 1).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => equipSelectedItem.call(scene));
  const btnDrop = scene.add.text(70, btnY, _INV_T('inventory.btn.drop'), { fontSize: '14px', fill: '#fff', backgroundColor: '#a44', padding: { x: 10, y: 5 } })
    .setOrigin(0.5, 1).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => dropSelectedItem());
  panel.add([btnEquip, btnDrop]);

  updateMaterialCounterUI();

  invUI.panel = panel;
  invUI.overlay = overlay;
  invUI.hideTooltip = hideTooltip;
  invUI.showTooltip = showItemTooltip;
  invUI.btnPortal = btnPortal;
  invUI.btnEquip = btnEquip;
  invUI.btnDrop = btnDrop;
  invUI._destroyed = false;

  function place() {
    const w = scene.scale.width;
    const h = scene.scale.height;
    invUI.overlay.setSize(w, h);
    const s = Math.min(w / BASE_W, h / BASE_H);
    invUI.panel.setScale(s);
    invUI.panel.setPosition(w / 2, h / 2);
  }
  invUI._scene = scene;
  invUI._placeHandler = place;
  place();
  scene.scale.on('resize', place);
}

function selectInventorySlot(i) {
  invSelected = i;
  refreshInventoryUI();
  invUI.hideTooltip?.();
}

function selectEquipSlot(slotKey) {
  // Optional: spätere Features (unequip etc.)
  invUI.hideTooltip?.();
}

// Stattet Item mit Typ & Stats aus: {type, key, name, iconKey, damage?, speed?, range?, hp?, move?}
function makeItem(opts) {
  const type = opts?.type;
  return Object.assign({
    type: 'material',   // 'weapon' | 'head' | 'body' | 'boots' | 'consumable' | 'material'
    key: 'GEN',
    name: 'Item',
    iconKey: FALLBACK_ITEM_ICONS[type] || 'itMat',
    tier: 0,
    affixes: [],
    iLevel: 1,
    baseStats: {},
    itemLevel: 1,
    hp: 0,
    damage: 0,
    speed: 0,
    range: 0,
    armor: 0,
    crit: 0,
    move: 0,
    attackEffects: []
  }, opts || {});
}

function recalcDerived(oldItemHp = 0, newItemHp = 0) {
  // 1) Alle Boni aus aktueller Ausrüstung aufsummieren
  const sum = { damage: 0, speed: 0, range: 0, maxHP: 0, move: 0, armor: 0, crit: 0 };
  Object.values(equipment).forEach(it => {
    if (!it) return;
    sum.damage += (it.damage || 0);
    sum.speed += (it.speed || 0);
    sum.range += (it.range || 0);
    sum.maxHP += (it.hp || 0);
    sum.move += (it.move || 0);
    sum.armor += (it.armor || 0);
    sum.crit += (it.crit || 0);
  });

  // 2) Neue "abgeleitete" Stats einmalig aus Basis + Summe
  weaponDamage = baseStats.damage + sum.damage;
  weaponAttackSpeed = Math.max(0.2, baseStats.speed + sum.speed);
  attackRange = Math.max(20, baseStats.range + sum.range);
  playerSpeed = Math.max(60, baseStats.move + sum.move);
  playerArmor = Phaser.Math.Clamp((baseStats.armor || 0) + sum.armor, 0, 0.85);
  playerCritChance = Phaser.Math.Clamp((baseStats.crit || 0) + sum.crit, 0, 0.9);

  // 3) Max-Health neu bestimmen (Basis + Gear + Skills).
  // We must include skill HP here so setPlayerMaxHealth's delta-based
  // current-HP adjustment doesn't shrink playerHealth on every equip.
  // Previously the gear-only value was passed first, causing a negative
  // delta (since the running max already included skills) → playerHealth
  // dropped by the skill HP amount on every equip even though max didn't
  // change. We compute skill HP up front and roll it into newMaxHealth.
  let _skillMaxHpBonus = 0;
  if (typeof window.calculateSkillEffects === 'function') {
    try {
      const _se = window.calculateSkillEffects() || {};
      _skillMaxHpBonus = _se.playerMaxHealth || 0;
    } catch (e) { /* swallow */ }
  }
  const newMaxHealth = Math.max(1, Math.round((baseStats.maxHP || 0) + sum.maxHP + _skillMaxHpBonus));
  if (typeof setPlayerMaxHealth === 'function') {
    setPlayerMaxHealth(newMaxHealth, { updateUi: false });
  } else {
    const previousMax = Math.max(1, playerMaxHealth || 1);
    playerMaxHealth = newMaxHealth;
    const delta = newMaxHealth - previousMax;
    playerHealth = Phaser.Math.Clamp(playerHealth + delta, 0, playerMaxHealth);
  }

  if (typeof resetAbilityBonuses === 'function') {
    resetAbilityBonuses();
    Object.values(equipment).forEach((it) => {
      if (!it || !Array.isArray(it.attackEffects)) return;
      it.attackEffects.forEach((effect) => {
        if (typeof applyAbilityEffect === 'function') {
          applyAbilityEffect(effect);
        }
      });
    });
  }

  // 3.5) Skill-Effekte ON TOP of equipment (nicht applySkillEffects() rufen - Rekursion!).
  // NOTE: skillEffects.playerMaxHealth was already baked into newMaxHealth
  // above (step 3), so we DO NOT add it again here. Adding it twice would
  // double-count skill HP and break the delta-based current-HP adjustment.
  if (typeof window.calculateSkillEffects === 'function') {
    const skillEffects = window.calculateSkillEffects();

    // Add skill bonuses to already-calculated equipment stats
    weaponDamage += skillEffects.weaponDamage || 0;
    weaponAttackSpeed += skillEffects.weaponAttackSpeed || 0;
    attackRange += skillEffects.attackRange || 0;
    playerArmor = Math.min(0.85, playerArmor + (skillEffects.playerArmor || 0));
    playerSpeed += skillEffects.playerSpeed || 0;
    playerCritChance = Math.min(0.9, playerCritChance + (skillEffects.playerCritChance || 0));
    window.PLAYER_DODGE_CHANCE = skillEffects.dodgeChance > 0 ? Math.min(0.5, skillEffects.dodgeChance) : 0;
    window.PLAYER_HEALTH_REGEN = skillEffects.healthRegen > 0 ? skillEffects.healthRegen : 0;
  }

  // Reset additive globals that are only written inside the endless block
  // below — otherwise they accumulate across recalcs instead of rebuilding fresh.
  window.PLAYER_LIFESTEAL = 0;

  // Lifesteal from weapon affixes lives in LootSystem.getBonus('lifesteal') and
  // is queried at damage-time, so no explicit copy is needed here.

  // 3.55) Endless-mode upgrade buffs (additive, on top of skills, before
  // event multipliers). Rebuilt fresh per recalc so picked upgrades persist.
  const endlessBuffs = window.endlessBuffs;
  if (endlessBuffs) {
    weaponDamage += endlessBuffs.weaponDamage || 0;
    weaponAttackSpeed += endlessBuffs.weaponAttackSpeed || 0;
    attackRange += endlessBuffs.attackRange || 0;
    playerArmor = Math.min(0.85, playerArmor + (endlessBuffs.playerArmor || 0));
    playerSpeed += endlessBuffs.playerSpeed || 0;
    playerCritChance = Math.min(0.95, playerCritChance + (endlessBuffs.playerCritChance || 0));
    if (endlessBuffs.dodgeChance > 0) {
      window.PLAYER_DODGE_CHANCE = Math.min(0.5, (window.PLAYER_DODGE_CHANCE || 0) + endlessBuffs.dodgeChance);
    }
    if (endlessBuffs.healthRegen > 0) {
      window.PLAYER_HEALTH_REGEN = (window.PLAYER_HEALTH_REGEN || 0) + endlessBuffs.healthRegen;
    }
    if (endlessBuffs.lifesteal > 0) {
      window.PLAYER_LIFESTEAL = (window.PLAYER_LIFESTEAL || 0) + endlessBuffs.lifesteal;
    }
    if (endlessBuffs.playerMaxHealth > 0 && typeof setPlayerMaxHealth === 'function') {
      // Add max-HP delta into the running newMaxHealth via direct update
      const bonus = endlessBuffs.playerMaxHealth;
      setPlayerMaxHealth(playerMaxHealth + bonus, { updateUi: false });
    }
  }

  // 3.6) Event-Buffs (Shrine etc.) als letzte Schicht — überleben Equipment-Recalcs.
  const buffs = window.eventBuffs;
  if (buffs) {
    weaponDamage = Math.max(1, Math.round(weaponDamage * (buffs.damageMult || 1)));
    playerArmor = Phaser.Math.Clamp(
      (playerArmor + (buffs.armorAdd || 0)) * (buffs.armorMult || 1),
      0,
      0.85
    );
    playerSpeed = Math.max(60, Math.round(playerSpeed * (buffs.speedMult || 1)));
  }

  // 4) HUD aktualisieren
  if (weaponStatsText) {
    // Mirrors the same template HUD uses (main.js hud.stats key).
    if (window.i18n) {
      weaponStatsText.setText(window.i18n.t('hud.stats', {
        dmg: weaponDamage,
        spd: weaponAttackSpeed.toFixed(2),
        rng: attackRange,
        arm: (playerArmor * 100).toFixed(0),
        crit: (playerCritChance * 100).toFixed(1)
      }));
    } else {
      weaponStatsText.setText(
        `Damage: ${weaponDamage}  Speed: ${weaponAttackSpeed.toFixed(2)}  Range: ${attackRange}` +
        `\nArmor: ${(playerArmor * 100).toFixed(0)}%  Crit: ${(playerCritChance * 100).toFixed(1)}%`
      );
    }
  }
  if (typeof updateHUD === 'function') {
    updateHUD();
  }
}

function openInventory() {
  invOpen = true;
  if (typeof player !== 'undefined' && player && player.body && player.setVelocity) {
    player.setVelocity(0, 0);
  }
  siphonMaterialsFromInventory();
  refreshInventoryUI();
  // Refresh portal scroll count every time inventory opens
  if (typeof window._refreshPortalButton === 'function') {
    window._refreshPortalButton();
  }
  if (invUI.overlay?.setVisible) invUI.overlay.setVisible(true);
  if (invUI.panel?.setVisible) invUI.panel.setVisible(true);
}

function closeInventory() {
  invOpen = false;
  if (invUI.panel?.setVisible) invUI.panel.setVisible(false);
  if (invUI.overlay?.setVisible) invUI.overlay.setVisible(false);
  invUI.hideTooltip?.();
}

function destroyInventoryUI() {
  if (!invUI || invUI._destroyed) {
    invOpen = false;
    return;
  }
  invUI._destroyed = true;

  try {
    if (invUI?._scene && invUI._placeHandler) {
      invUI._scene.scale?.off?.('resize', invUI._placeHandler);
    }
  } catch (err) {
    console.warn('[destroyInventoryUI] unable to unbind resize', err);
  }

  if (invUI.panel?.setVisible) invUI.panel.setVisible(false);
  if (invUI.overlay?.setVisible) invUI.overlay.setVisible(false);
  if (tooltip?.setVisible) tooltip.setVisible(false);
  if (tooltip?.compareBox?.setVisible) tooltip.compareBox.setVisible(false);

  invUI.panel = null;
  invUI.overlay = null;
  invUI.slots = [];
  invUI.equip = {};
  invUI.btnPortal = null;
  invUI.btnEquip = null;
  invUI.btnDrop = null;
  invUI.materialsText = null;
  invUI.hideTooltip = null;
  invUI.showTooltip = null;
  invUI._scene = null;
  invUI._placeHandler = null;
  if (typeof tooltip !== 'undefined') {
    tooltip = null;
  }
  invOpen = false;
}

function refreshInventoryUI() {
  updateMaterialCounterUI();
  if (!invUI || !Array.isArray(invUI.slots) || invUI.slots.length !== INV_SLOTS) {
    return;
  }
  // Grid
  for (let i = 0; i < INV_SLOTS; i++) {
    const it = inventory[i];
    const slot = invUI.slots[i];
    if (!slot) continue;
    const bg = isValidGameObject(slot.bg) ? slot.bg : null;
    if (!bg) continue;
    const icon = isValidGameObject(slot.icon) ? slot.icon : null;
    const label = isValidGameObject(slot.label) ? slot.label : null;
    const indicator = isValidGameObject(slot.indicator) ? slot.indicator : null;
    bg.setTexture(i === invSelected ? 'uiSlotSel' : 'uiSlot');
    setSlotHighlight(bg, it);
    if (it) {
      const iconKey = resolveItemIconKey(it);
      if (icon && iconKey) icon.setTexture(iconKey);
      if (icon) icon.setVisible(true);
      if (label) {
        label.setText('');
        label.setVisible(false);
      }
      if (indicator) {
        indicator.setVisible(isItemUpgrade(it));
      }
    } else {
      if (icon) icon.setVisible(false);
      if (label) {
        label.setText('');
        label.setVisible(false);
      }
      if (indicator) {
        indicator.setVisible(false);
      }
    }
  }

  // Equipment
  Object.entries(invUI.equip || {}).forEach(([k, ui]) => {
    const it = equipment[k];
    if (!ui) return;
    const slot = isValidGameObject(ui.slot) ? ui.slot : null;
    const icon = isValidGameObject(ui.icon) ? ui.icon : null;
    if (!slot) return;
    setSlotHighlight(slot, it);
    if (it) {
      const iconKey = resolveItemIconKey(it);
      if (icon && iconKey) icon.setTexture(iconKey);
      if (icon) icon.setVisible(true);
    } else if (icon) {
      icon.setVisible(false);
    }
  });
}

function equipSelectedItem() {
  if (invSelected < 0) return;
  const it = inventory[invSelected];
  if (!it) return;

  // nur Gear ausrüstbar
  if (['weapon', 'head', 'body', 'boots'].includes(it.type)) {
    const slotKey = it.type;

    // HP-Bonus des alten Items in diesem Slot merken
    const oldItem = equipment[slotKey] || null;
    const oldItemHp = oldItem && oldItem.hp ? oldItem.hp : 0;

    // Swap: new item into the equipment slot, old item back into the
    // inventory slot the new item came from. Without this swap, the old
    // item would be lost on equip.
    equipment[slotKey] = it;
    inventory[invSelected] = oldItem || null;
    invSelected = -1;

    // recalc: altes HP rausrechnen, neues rein (nur Delta!)
    const newItemHp = it.hp || 0;
    recalcDerived(oldItemHp, newItemHp);

    // WP08 T048: refresh aggregated affix bonuses whenever equipment changes.
    if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
      try { window.LootSystem.recomputeBonuses(); } catch (e) { /* swallow */ }
    }

    refreshInventoryUI();
  }
}

function useSelectedItem() {
  if (invSelected < 0) return;
  const it = inventory[invSelected];
  if (!it) return;

  if (it.type === 'consumable') {
    // Verbrauchs-Item entfernen
    inventory[invSelected] = null;
    invSelected = -1;
    refreshInventoryUI();
    if (typeof updateHUD === 'function') updateHUD();
  }
}

function dropSelectedItem() {
  if (invSelected < 0) return;
  const it = inventory[invSelected];
  if (!it) return;

  // optional: als Loot droppen
  // spawnLoot.call(this, player.x, player.y, it); // wenn du willst

  inventory[invSelected] = null;
  invSelected = -1;
  refreshInventoryUI();
}
