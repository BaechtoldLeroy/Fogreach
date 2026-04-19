if (window.i18n) {
  window.i18n.register('de', {
    'loot.legacy.weapon': 'Klingenschwert',
    'loot.legacy.head': 'Stahlhelm',
    'loot.legacy.body': 'Brustplatte',
    'loot.legacy.boots': 'Stiefel',
    'loot.legacy.material': 'Eisenbrocken',
    'loot.quest_item.QUEST_DOC': 'Protokoll-Abschrift',
    'loot.quest_item.QUEST_PLATE': 'Verbotene Druckplatte'
  });
  window.i18n.register('en', {
    'loot.legacy.weapon': 'Sword',
    'loot.legacy.head': 'Steel Helm',
    'loot.legacy.body': 'Breastplate',
    'loot.legacy.boots': 'Boots',
    'loot.legacy.material': 'Iron Chunk',
    'loot.quest_item.QUEST_DOC': 'Protocol Transcript',
    'loot.quest_item.QUEST_PLATE': 'Forbidden Print Plate'
  });
}
const _LOOT_T = (key) => (window.i18n ? window.i18n.t(key) : key);

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Tier weights mirror the LootSystem tier model (0=Common .. 3=Legendary).
// The `chance` percentages preserve the historical drop distribution used by
// legacy randomLoot() while we finish migrating callers onto LootSystem.rollItem.
const TIER_WEIGHTS = [
  { tier: 0, chance: 55 },
  { tier: 1, chance: 25 },
  { tier: 2, chance: 13 },
  { tier: 3, chance: 7 }
];
// Tier color map — indexed by item.tier (0=Common .. 3=Legendary). Declared
// here and re-exported as window.TIER_COLORS so other production modules can
// share a single source of truth without re-declaring it.
const LOOT_TIER_COLORS = ['#cccccc', '#88aaff', '#ffdd44', '#ff8844'];

const ITEM_STAT_KEYS = ['hp', 'damage', 'speed', 'range', 'armor', 'crit'];
const ITEM_ALL_STAT_KEYS = [...ITEM_STAT_KEYS, 'move'];

const ITEM_SLOT_MODS = {
  weapon: { hp: 0.7, damage: 1.45, speed: 1.4, range: 1.35, armor: 0.7, crit: 1.6 },
  head:   { hp: 1.05, damage: 0.85, speed: 0.8, range: 0.75, armor: 1.2, crit: 1.0 },
  body:   { hp: 1.55, damage: 0.9, speed: 0.65, range: 0.8, armor: 1.45, crit: 0.85 },
  boots:  { hp: 0.95, damage: 0.95, speed: 1.5, range: 0.9, armor: 0.95, crit: 1.1 },
  generic:{ hp: 1, damage: 1, speed: 1, range: 1, armor: 1, crit: 1 }
};

const ATTACK_EFFECT_BASE_CHANCE = 0.2;
const ATTACK_EFFECT_OPTIONS = [
  { id: 'attack_damage', ability: 'attack', stat: 'damage', min: 0.08, max: 0.18 },
  { id: 'attack_cooldown', ability: 'attack', stat: 'cooldown', min: 0.07, max: 0.16 },
  { id: 'spin_damage', ability: 'spin', stat: 'damage', min: 0.1, max: 0.22 },
  { id: 'spin_cooldown', ability: 'spin', stat: 'cooldown', min: 0.08, max: 0.18 },
  { id: 'charge_damage', ability: 'charge', stat: 'damage', min: 0.12, max: 0.25 },
  { id: 'charge_cooldown', ability: 'charge', stat: 'cooldown', min: 0.08, max: 0.18 },
  { id: 'dash_damage', ability: 'dash', stat: 'damage', min: 0.1, max: 0.2 },
  { id: 'dash_cooldown', ability: 'dash', stat: 'cooldown', min: 0.08, max: 0.18 },
  { id: 'dagger_damage', ability: 'dagger', stat: 'damage', min: 0.12, max: 0.26 },
  { id: 'dagger_cooldown', ability: 'dagger', stat: 'cooldown', min: 0.1, max: 0.22 },
  { id: 'shield_damage', ability: 'shield', stat: 'damage', min: 0.1, max: 0.22 },
  { id: 'shield_cooldown', ability: 'shield', stat: 'cooldown', min: 0.08, max: 0.18 }
];

function trackLootSprite(scene, sprite) {
  if (!scene || !sprite) return sprite;
  const list = scene._activeLootSprites = scene._activeLootSprites || [];
  list.push(sprite);
  const cleanup = () => {
    if (!Array.isArray(scene._activeLootSprites)) return;
    const idx = scene._activeLootSprites.indexOf(sprite);
    if (idx !== -1) {
      scene._activeLootSprites.splice(idx, 1);
    }
  };
  if (typeof sprite.once === 'function') {
    sprite.once('destroy', cleanup);
  }
  return sprite;
}

function getDifficultyMultiplierValue() {
  const fn = typeof window?.getDifficultyMultiplier === 'function'
    ? window.getDifficultyMultiplier
    : null;
  const raw = fn ? fn() : window?.DIFFICULTY_MULTIPLIER;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 1;
  return Phaser?.Math?.Clamp ? Phaser.Math.Clamp(raw, 0.1, 10) : Math.min(Math.max(raw, 0.1), 10);
}

// Legacy helper kept only so older save blobs (pre-migration) don't crash if
// any reader passes a string tier key. Always returns a numeric tier (0-3).
function getTierFromLegacyRarityKey(key) {
  const map = { common: 0, rare: 1, epic: 2, legendary: 3 };
  return (typeof key === 'string' && key in map) ? map[key] : null;
}

function rollAttackEffect(depth, tier, existingIds = []) {
  const pool = ATTACK_EFFECT_OPTIONS.filter((opt) => !existingIds.includes(opt.id));
  if (!pool.length) return null;
  const option = Phaser.Utils.Array.GetRandom(pool);
  const depthScale = 1 + Math.min(0.8, Math.max(0, (depth || 1) - 1) * 0.01);
  const tierScale = 1 + Math.min(0.6, Math.max(0, (tier || 0)) * 0.12);
  const raw = Phaser.Math.FloatBetween(option.min, option.max);
  const value = Number((Math.min(option.max * 1.6, raw * depthScale * tierScale)).toFixed(3));
  return { id: option.id, ability: option.ability, stat: option.stat, value: Math.max(0, value) };
}

function maybeAttachAttackEffect(item, tier, depth) {
  if (!item) return;
  const chance = Math.min(0.65, ATTACK_EFFECT_BASE_CHANCE + ((tier || 0) + 1) * 0.12);
  if (Math.random() > chance) return;
  const statKeys = ITEM_STAT_KEYS.filter((key) => (item[key] || 0) > 0);
  const existingIds = Array.isArray(item.attackEffects) ? item.attackEffects.map((e) => e.id) : [];
  const effect = rollAttackEffect(depth, tier, existingIds);
  if (!effect) return;
  if (statKeys.length) {
    const removeKey = Phaser.Utils.Array.GetRandom(statKeys);
    item[removeKey] = 0;
  }
  item.attackEffects = Array.isArray(item.attackEffects) ? item.attackEffects : [];
  item.attackEffects.push(effect);
  item.itemLevel = computeItemLevelFromStats(item, depth);
}

// Cap an item's non-zero stat count by its tier+1 so that a newly-rolled item
// doesn't silently outshine its intended tier budget. Keeps the strongest
// stats and zeros the rest.
function normalizeItemStatsForTier(item, tier = 0) {
  if (!item) return item;
  const allowed = Math.max(1, Math.round(Number(tier) || 0) + 1);
  const stats = ITEM_ALL_STAT_KEYS
    .map((key) => ({ key, value: Number(item[key]) || 0 }))
    .filter((entry) => entry.value !== 0);

  if (stats.length <= allowed) return item;

  stats.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const keep = new Set(stats.slice(0, allowed).map((entry) => entry.key));
  ITEM_ALL_STAT_KEYS.forEach((key) => {
    if (!keep.has(key)) item[key] = 0;
  });
  return item;
}

// WP03: Spawn a goldPile sprite at (x, y) worth `amount` gold.
// Auto-collected by the player-overlap registered in main.js via window.goldGroup.
// Each pile despawns after 5 minutes to cap sprite count (see feature 020 assumption 7).
function _spawnGoldPile(scene, x, y, amount) {
  if (!scene || !scene.physics || !scene.add) return null;
  if (typeof scene.textures?.exists === 'function' && !scene.textures.exists('goldPile')) return null;
  const safeAmount = Math.max(1, Math.floor(Number(amount) || 1));
  const sprite = scene.physics.add.sprite(x, y, 'goldPile');
  if (!sprite) return null;
  sprite.setData('goldAmount', safeAmount);
  sprite.setDepth(80);
  if (window.goldGroup && typeof window.goldGroup.add === 'function') {
    window.goldGroup.add(sprite);
  }
  trackLootSprite(scene, sprite);
  if (scene.time && typeof scene.time.delayedCall === 'function') {
    scene.time.delayedCall(300000, () => {
      if (sprite && sprite.active) sprite.destroy();
    });
  }
  return sprite;
}

// WP03: Roll how much gold an enemy drops. Boss: mLevel * 50 (flat, reliable).
// Regular: 30% chance to drop, 1..(mLevel*5) with ±20% jitter.
function _rollEnemyGoldDrop(mLevel, isBoss) {
  const level = Math.max(1, Math.floor(Number(mLevel) || 1));
  if (isBoss) {
    const base = level * 50;
    return Math.max(1, Math.floor(base * (0.8 + Math.random() * 0.4)));
  }
  if (Math.random() >= 0.30) return 0;
  const raw = 1 + Math.floor(Math.random() * (level * 5));
  return Math.max(1, Math.floor(raw * (0.8 + Math.random() * 0.4)));
}

function _dropEnemyGold(scene, enemy) {
  if (!scene || !enemy) return;
  const level = enemy.iLevel || enemy.mLevel || (typeof currentWave !== 'undefined' ? currentWave : 1) || 1;
  const isBoss = !!(enemy.isBoss || enemy.isMiniBoss);
  const amount = _rollEnemyGoldDrop(level, isBoss);
  if (amount <= 0) return;
  // Scatter gold around the enemy so it doesn't perfectly stack on the
  // XP/health pickup that lootGroup spawns at the same tile.
  const angle = Math.random() * Math.PI * 2;
  const dist = 18 + Math.random() * 22; // 18..40 px from enemy
  const gx = enemy.x + Math.cos(angle) * dist;
  const gy = enemy.y + Math.sin(angle) * dist;
  _spawnGoldPile(scene, gx, gy, amount);
}

function spawnLoot(x, y, maybeItem, sourceEnemy) {
  const scene = (this && this.physics && this.physics.world) ? this : (obstacles?.scene || window.currentScene);
  // WP03: enemies always roll a gold drop in addition to their item drop.
  // Chest-type maybeItem calls go through the early-return path below and
  // should NOT trigger enemy gold (no sourceEnemy).
  if (sourceEnemy && scene) {
    _dropEnemyGold(scene, sourceEnemy);
  }
  if (maybeItem && typeof maybeItem.type === 'string') {
    const typeLower = maybeItem.type.toLowerCase();
    if (typeLower.startsWith('chest')) {
      const spawnFn = scene?.spawnObstacle ? scene.spawnObstacle.bind(scene) : spawnObstacle;
      const chest = spawnFn ? spawnFn(x, y, maybeItem.type) : spawnObstacle(x, y, maybeItem.type);
      chest?.setData('locked', !!maybeItem.locked);
      if (typeof maybeItem.tier !== 'undefined') chest?.setData('tier', maybeItem.tier);
      return chest;
    }
  }

  // Quest item drops (10% chance each)
  if (!maybeItem && window.questSystem) {
    var activeQuests = window.questSystem.getActiveQuests();

    // Check for active fetch quests and spawn matching quest items
    var questItemDefs = [
      { target: 'document', name: _LOOT_T('loot.quest_item.QUEST_DOC'), nameKey: 'loot.quest_item.QUEST_DOC', key: 'QUEST_DOC', tint: 0xffdd44 },
      { target: 'print_plate', name: _LOOT_T('loot.quest_item.QUEST_PLATE'), nameKey: 'loot.quest_item.QUEST_PLATE', key: 'QUEST_PLATE', tint: 0x88aaff }
    ];

    for (var qi = 0; qi < questItemDefs.length; qi++) {
      var qiDef = questItemDefs[qi];
      var needsItem = activeQuests.some(function (q) {
        return q.objectives.some(function (o) {
          return o.type === 'fetch' && o.target === qiDef.target && o.current < o.required;
        });
      });
      if (needsItem && Math.random() < 0.10) {
        var questItem = {
          type: 'quest_item',
          key: qiDef.key,
          name: qiDef.name,
          nameKey: qiDef.nameKey,
          iconKey: 'itMat',
          isQuestItem: true,
          questTarget: qiDef.target
        };
        var questLoot = lootGroup.create(x, y, questItem.iconKey || 'itMat');
        questLoot.setDisplaySize(28, 22);
        questLoot.setData('item', questItem);
        questLoot.setData('questItem', true);
        questLoot.setDepth(80);
        questLoot.setTint(qiDef.tint);
        trackLootSprite(scene || questLoot.scene, questLoot);
        return;
      }
    }
  }

  // Elite enemies have higher loot chance and better tier
  // D2-like drop frequencies: trash rarely drops, elites modestly, minibosses often.
  const isEliteDrop = sourceEnemy && sourceEnemy.isElite;
  const isMiniBossDrop = sourceEnemy && sourceEnemy.isMiniBoss;
  const lootChanceBonus = isEliteDrop ? 10 : (isMiniBossDrop ? 23 : 0);

  const roll = Phaser.Math.Between(0, 100);

  if (maybeItem || roll < (2 + lootChanceBonus)) {
    const baseItem = maybeItem ? { ...maybeItem } : randomLoot();
    let tier = (typeof baseItem?.tier === 'number') ? baseItem.tier : 0;
    // Elite enemies: bump tier by 1; Mini-bosses: by 2 (cap at 3 = Legendary)
    if (isEliteDrop && tier < 3) {
      tier = Math.min(3, tier + 1);
      baseItem.tier = tier;
    } else if (isMiniBossDrop && tier < 3) {
      tier = Math.min(3, tier + 2);
      baseItem.tier = tier;
    }
    const item = maybeItem
      ? normalizeItemStatsForTier(scaleItemForDifficulty(baseItem, Math.max(1, currentWave)), tier)
      : normalizeItemStatsForTier(baseItem, tier);
    const loot = lootGroup.create(x, y, item.iconKey || 'itMat');
    loot.setDisplaySize(32, 24);
    loot.setData('item', item);
    loot.setDepth(80);
    trackLootSprite(scene || loot.scene, loot);
    _attachRarityFx(scene || loot.scene, loot, item);
  } else if (roll < 50) {
    spawnPickup.call(this, x, y, 'health');
  } else if (roll < 80) {
    spawnPickup.call(this, x, y, 'xp');
  }
}

// Rare/Legendary drops get an audio jingle + pulsing colored beacon
// (D2-style). Tier 2 = rare (gold), Tier 3 = legendary (orange).
function _attachRarityFx(scene, loot, item) {
  const tier = item && typeof item.tier === 'number' ? item.tier : 0;
  if (tier < 2 || !scene || !loot) return;

  const tierHex = [0xcccccc, 0x88aaff, 0xffdd44, 0xff8844][tier] || 0xffffff;
  const sfxKey = tier >= 3 ? 'loot_legendary' : 'loot_rare';
  if (window.soundManager && typeof window.soundManager.playSFX === 'function') {
    try { window.soundManager.playSFX(sfxKey); } catch (e) { /* ignore */ }
  }

  // Glow beacon under the loot sprite — larger + brighter for legendary
  const radius = tier >= 3 ? 34 : 26;
  const glow = scene.add.circle(loot.x, loot.y, radius, tierHex, 0.35);
  glow.setDepth(79); // under the item sprite (80)
  glow.setBlendMode(Phaser.BlendModes.ADD);
  loot.setData('rarityGlow', glow);

  // Pulse tween
  const pulseTween = scene.tweens.add({
    targets: glow,
    scale: { from: 0.8, to: 1.25 },
    alpha: { from: 0.25, to: 0.55 },
    duration: tier >= 3 ? 650 : 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
  loot.setData('rarityTween', pulseTween);

  // Legendary: thin outer ring that rotates slowly
  if (tier >= 3) {
    const ring = scene.add.circle(loot.x, loot.y, radius + 10, 0xffffff, 0);
    ring.setStrokeStyle(2, tierHex, 0.7);
    ring.setDepth(79);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    loot.setData('rarityRing', ring);
    const ringTween = scene.tweens.add({
      targets: ring,
      angle: 360,
      duration: 3000,
      repeat: -1
    });
    loot.setData('rarityRingTween', ringTween);
  }

  // Keep beacon glued to the loot sprite each frame (bodies may drift on spawn).
  const updateBeacon = () => {
    if (!loot.active) return;
    const g = loot.getData('rarityGlow');
    const r = loot.getData('rarityRing');
    if (g) g.setPosition(loot.x, loot.y);
    if (r) r.setPosition(loot.x, loot.y);
  };
  scene.events.on('update', updateBeacon);
  loot.setData('rarityUpdateFn', updateBeacon);
  loot.setData('rarityScene', scene);

  // Defensive fallback: also fire on destroy, in case a path reaches destroy()
  // without going through collectLoot (e.g. scene shutdown).
  loot.once('destroy', () => _cleanupRarityFx(loot));
}

function spawnPickup(x, y, type) {
  const key = type === 'health' ? 'healthDrop' : 'xpDrop';
  const scene = (this && this.physics && this.physics.world) ? this : (obstacles?.scene || window.currentScene);
  const targetScene = scene || this;
  if (!targetScene?.physics) return null;
  const loot = targetScene.physics.add.sprite(x, y, key);
  loot.lootType = type;
  loot.setDepth(80);
  targetScene.physics.add.overlap(player, loot, collectLoot, null, targetScene);
  trackLootSprite(targetScene || loot.scene, loot);
}

function _cleanupRarityFx(loot) {
  if (!loot || !loot.getData) return;
  const g = loot.getData('rarityGlow');
  const r = loot.getData('rarityRing');
  const pt = loot.getData('rarityTween');
  const rt = loot.getData('rarityRingTween');
  const upd = loot.getData('rarityUpdateFn');
  const fxScene = loot.getData('rarityScene');
  if (fxScene && fxScene.events && upd) fxScene.events.off('update', upd);
  if (pt && pt.remove) pt.remove();
  if (rt && rt.remove) rt.remove();
  if (g && g.destroy) g.destroy();
  if (r && r.destroy) r.destroy();
  loot.setData('rarityGlow', null);
  loot.setData('rarityRing', null);
  loot.setData('rarityTween', null);
  loot.setData('rarityRingTween', null);
  loot.setData('rarityUpdateFn', null);
  loot.setData('rarityScene', null);
}

function collectLoot(playerSprite, loot) {
  _cleanupRarityFx(loot);
  if (window.soundManager) window.soundManager.playSFX('loot_pickup');
  // Particle effects: loot sparkle
  if (window.particleFactory && loot) {
    window.particleFactory.lootSparkle(loot.x, loot.y);
  }

  // Quest item handling
  if (loot.getData && loot.getData('questItem')) {
    var item = loot.getData('item');
    if (item && item.questTarget && window.questSystem) {
      window.questSystem.updateQuestProgress('fetch', item.questTarget, 1);
      console.log('[Loot] Collected quest item:', item.name);
    }
    loot.destroy();
    return;
  }

  if (loot.lootType === 'health') {
    if (typeof addPlayerHealth === 'function') {
      addPlayerHealth(2);
    } else {
      playerHealth = Math.min(playerHealth + 2, playerMaxHealth);
      if (typeof updateHUD === 'function') updateHUD();
    }
  } else if (loot.lootType === 'xp') {
    addXP.call(this);
  } else {
    const item = loot.getData('item');
    const isMaterial = item?.type === 'material'
      && typeof addMaterialToStorage === 'function'
      && addMaterialToStorage(item, item?.amount || 1);
    if (!isMaterial) {
      const idx = inventory.findIndex((slot) => !slot);
      if (idx >= 0) {
        inventory[idx] = item;
      } else {
        // Inventory full → salvage to Eisenbrocken based on tier
        const tier = (typeof item?.tier === 'number') ? item.tier : 0;
        const matAmount = (tier + 1) * 2; // T0=2, T1=4, T2=6, T3=8
        if (typeof changeMaterialCount === 'function') {
          changeMaterialCount('MAT', matAmount);
        } else if (typeof materialCounts !== 'undefined') {
          materialCounts.MAT = (materialCounts.MAT || 0) + matAmount;
        }
        // Visual feedback
        if (this.add && item) {
          const txt = this.add.text(loot.x, loot.y - 20,
            '+' + matAmount + ' Eisenbrocken', {
              fontSize: '14px',
              fontFamily: 'monospace',
              color: '#ccaa33',
              stroke: '#000',
              strokeThickness: 3
            }).setOrigin(0.5).setDepth(1500);
          this.tweens.add({
            targets: txt,
            y: txt.y - 30,
            alpha: 0,
            duration: 1500,
            onComplete: () => txt.destroy()
          });
        }
      }
    }
    if (typeof refreshInventoryUI === 'function') refreshInventoryUI();
  }
  loot.destroy();
}

function pickItemTier() {
  const roll = Phaser.Math.Between(1, 100);
  let acc = 0;
  for (const entry of TIER_WEIGHTS) {
    acc += entry.chance;
    if (roll <= acc) return entry.tier;
  }
  return 0;
}

function clampStat(key, value) {
  switch (key) {
    case 'hp':
      return clamp(Math.round(value), 1, 999);
    case 'damage':
      return clamp(Math.round(value), 1, 999);
    case 'speed':
      return clamp(Number(value.toFixed?.(2) ?? Number(value).toFixed(2)), 0.05, 3.5);
    case 'range':
      return clamp(Math.round(value), 5, 260);
    case 'armor':
      return clamp(Number(value.toFixed?.(3) ?? Number(value).toFixed(3)), 0, 0.8);
    case 'crit':
      return clamp(Number(value.toFixed?.(3) ?? Number(value).toFixed(3)), 0.01, 0.85);
    default:
      return value;
  }
}

function rollItemStatPotentials(slot, depth) {
  const waveLevel = Math.max(1, depth || 1);
  const mods = ITEM_SLOT_MODS[slot] || ITEM_SLOT_MODS.generic;
  const jitter = (base) => base * Phaser.Math.FloatBetween(0.9, 1.1);

  const baseHp = 4 + (waveLevel - 1) * 1.25;
  const baseDamage = 1 + Math.floor((waveLevel - 1) * 0.55);
  const baseSpeedBonus = 0.18 + Math.min(0.85, (waveLevel - 1) * 0.045);
  const baseRangeBonus = 18 + (waveLevel - 1) * 3.2;
  const baseArmor = 0.03 + Math.min(0.4, (waveLevel - 1) * 0.012);
  const baseCrit = 0.05 + Math.min(0.4, (waveLevel - 1) * 0.007);

  return {
    hp: clamp(Math.round(jitter(baseHp * mods.hp)), 1, 999),
    damage: clamp(Math.round(jitter(baseDamage * mods.damage)), 1, 999),
    speed: clamp(Number(jitter(baseSpeedBonus * mods.speed).toFixed(2)), 0.05, 3.5),
    range: clamp(Math.round(jitter(baseRangeBonus * mods.range)), 5, 260),
    armor: clamp(Number(jitter(baseArmor * mods.armor).toFixed(3)), 0, 0.8),
    crit: clamp(Number(jitter(baseCrit * mods.crit).toFixed(3)), 0.01, 0.85)
  };
}

function computeItemLevelFromStats(stats, depth) {
  const lvlBase = Math.max(1, depth || 1);
  let lvl = lvlBase;
  const add = (value, weight) => {
    lvl += (Number(value) || 0) * weight;
  };
  add(stats.damage, 1);
  add(stats.hp, 0.2);
  add(stats.speed, 6);
  add(stats.range, 0.04);
  add(stats.armor, 50);
  add(stats.crit, 20);
  return Math.max(1, Math.round(lvl));
}

function scaleItemForDifficulty(item, depth) {
  if (!item) return item;
  const multiplier = getDifficultyMultiplierValue();
  if (multiplier === 1) {
    const tier = (typeof item.tier === 'number') ? item.tier : 0;
    normalizeItemStatsForTier(item, tier);
    return item;
  }

  ITEM_STAT_KEYS.forEach((key) => {
    if (typeof item[key] === 'number') {
      const scaled = item[key] * multiplier;
      item[key] = clampStat(key, scaled);
    }
  });

  if (typeof item.move === 'number') {
    const scaledMove = item.move * multiplier;
    item.move = Number((Math.round(scaledMove * 100) / 100).toFixed(2));
  }

  if (Array.isArray(item.attackEffects)) {
    item.attackEffects = item.attackEffects.map((effect) => {
      if (!effect) return effect;
      const scaled = Number((effect.value * multiplier).toFixed(3));
      return { ...effect, value: Math.max(0, scaled) };
    });
  }

  item.itemLevel = computeItemLevelFromStats(
    item,
    Math.max(1, Math.round((depth || currentWave || 1) * multiplier))
  );

   const tier = (typeof item.tier === 'number') ? item.tier : 0;
   normalizeItemStatsForTier(item, tier);

  return item;
}

function applyTierBoosts(potentials, tier, depth) {
  const boosted = ITEM_STAT_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  const available = ITEM_STAT_KEYS.filter(key => (potentials[key] ?? 0) > 0);
  const keysPool = available.length ? available : ITEM_STAT_KEYS;
  const boosts = Math.max(1, (tier || 0) + 1);

  for (let i = 0; i < boosts; i++) {
    const statKey = Phaser.Utils.Array.GetRandom(keysPool);
    const addition = potentials[statKey] ?? 0;
    const current = boosted[statKey] ?? 0;
    boosted[statKey] = clampStat(statKey, Number(current) + addition);
  }
  return boosted;
}

function addBoostsToItem(item, boosts, depth) {
  const totalBoosts = Math.max(0, boosts);
  if (!totalBoosts) {
    const tier = (typeof item?.tier === 'number') ? item.tier : 0;
    normalizeItemStatsForTier(item, tier);
    return;
  }
  const potentials = rollItemStatPotentials(item?.type || 'weapon', depth);
  const available = ITEM_STAT_KEYS.filter(key => (potentials[key] ?? 0) > 0);
  const keysPool = available.length ? available : ITEM_STAT_KEYS;
  const effectTier = (typeof item?.tier === 'number') ? item.tier : Math.max(0, boosts - 1);
  for (let i = 0; i < totalBoosts; i++) {
    let applied = false;
    if (Math.random() < 0.35) {
      const prevCount = Array.isArray(item.attackEffects) ? item.attackEffects.length : 0;
      maybeAttachAttackEffect(item, effectTier, depth);
      const newCount = Array.isArray(item.attackEffects) ? item.attackEffects.length : 0;
      if (newCount > prevCount) {
        applied = true;
      }
    }
    if (!applied) {
      const statKey = Phaser.Utils.Array.GetRandom(keysPool);
      const addition = potentials[statKey] ?? 0;
      const current = Number(item[statKey] || 0);
      item[statKey] = clampStat(statKey, current + addition);
    }
  }
  item.itemLevel = computeItemLevelFromStats(item, depth);

  const tier = (typeof item.tier === 'number') ? item.tier : Math.max(0, totalBoosts - 1);
  normalizeItemStatsForTier(item, tier);
}

function randomLoot() {
  const depth = Math.max(1, currentWave);
  const tier = pickItemTier();
  const roll = Phaser.Math.Between(1, 100);
  const applyDifficulty = (item) => normalizeItemStatsForTier(
    scaleItemForDifficulty(item, depth),
    (typeof item.tier === 'number') ? item.tier : tier
  );

  const buildItem = (opts, slotType) => {
    const base = rollItemStatPotentials(slotType, depth);
    const core = applyTierBoosts(base, tier, depth);
    const itemLevel = computeItemLevelFromStats(core, depth);
    // Roll affixes via LootSystem so dungeon drops carry the same affix
    // shape as shop / migration items. Affix count = tier (0..3), matching
    // rollItem in lootSystem.js. Without this, dropped items showed up in
    // Mara's reroll tab with no affix lines.
    let rolledAffixes = [];
    if (window.LootSystem && typeof window.LootSystem.rollAffixes === 'function' && tier > 0) {
      try {
        rolledAffixes = window.LootSystem.rollAffixes(itemLevel, tier, Math.random, opts.type) || [];
      } catch (e) { /* swallow */ }
    }
    const item = makeItem(Object.assign({}, opts, {
      tier,
      affixes: rolledAffixes,
      iLevel: itemLevel,
      itemLevel,
      baseStats: {
        damage: core.damage || 0,
        armor: core.armor || 0,
        hp: core.hp || 0,
        speed: core.speed || 0,
        crit: core.crit || 0,
        range: core.range || 0
      },
      hp: core.hp,
      damage: core.damage,
      speed: core.speed,
      range: core.range,
      armor: core.armor,
      crit: core.crit
    }));
    item._baseName = item._baseName || item.name;
    if (window.LootSystem && typeof window.LootSystem.composeName === 'function') {
      try { item.displayName = window.LootSystem.composeName(item); } catch (e) { item.displayName = item.displayName || item.name; }
    } else {
      item.displayName = item.displayName || item.name;
    }
    maybeAttachAttackEffect(item, tier, depth);
    return applyDifficulty(item);
  };

  if (roll <= 35) {
    return buildItem({ type: 'weapon', key: 'WPN', name: _LOOT_T('loot.legacy.weapon'), nameKey: 'loot.legacy.weapon', iconKey: 'itWeapon' }, 'weapon');
  }
  if (roll <= 55) {
    return buildItem({ type: 'head', key: 'HD', name: _LOOT_T('loot.legacy.head'), nameKey: 'loot.legacy.head', iconKey: 'itHead' }, 'head');
  }
  if (roll <= 75) {
    return buildItem({ type: 'body', key: 'BD', name: _LOOT_T('loot.legacy.body'), nameKey: 'loot.legacy.body', iconKey: 'itBody' }, 'body');
  }
  if (roll <= 85) {
    return buildItem({ type: 'boots', key: 'BT', name: _LOOT_T('loot.legacy.boots'), nameKey: 'loot.legacy.boots', iconKey: 'itBoots' }, 'boots');
  }

  return applyDifficulty(makeItem({
    type: 'material',
    key: 'MAT',
    materialKey: 'MAT',
    name: _LOOT_T('loot.legacy.material'),
    nameKey: 'loot.legacy.material',
    iconKey: 'itMat',
    tier,
    affixes: [],
    iLevel: depth,
    itemLevel: depth,
    baseStats: {},
    hp: 0,
    damage: 0,
    speed: 0,
    range: 0,
    armor: 0,
    crit: 0
  }));
}

if (typeof window !== 'undefined') {
  window.spawnLoot = spawnLoot;
  window.randomLoot = randomLoot;
  window.collectLoot = collectLoot;
  window.computeItemLevelFromStats = computeItemLevelFromStats;
  window.rollItemStatPotentials = rollItemStatPotentials;
  window.addBoostsToItem = addBoostsToItem;
  window.normalizeItemStatsForTier = normalizeItemStatsForTier;
  window.TIER_COLORS = LOOT_TIER_COLORS;
  // Legacy aliases for any loose references that haven't been migrated yet
  // (e.g. js/scenes/HubScene.js is parsed but never instantiated).
  window.normalizeItemStatsForRarity = normalizeItemStatsForTier;
  window.getRarityValueFromKey = getTierFromLegacyRarityKey;
  window.ITEM_RARITIES = [];
  // WP03: expose gold-drop helpers so chest-open code and future systems can
  // spawn gold piles without duplicating the formula.
  window.spawnGoldPile = _spawnGoldPile;
  window.rollEnemyGoldDrop = _rollEnemyGoldDrop;
}
