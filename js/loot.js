const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const ITEM_RARITIES = [
  { key: 'common', label: 'Gewöhnlich', value: 1, chance: 55 },
  { key: 'rare', label: 'Selten', value: 2, chance: 25 },
  { key: 'epic', label: 'Episch', value: 3, chance: 13 },
  { key: 'legendary', label: 'Legendär', value: 4, chance: 7 }
];

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

function getRarityValueFromKey(key) {
  const entry = ITEM_RARITIES.find((r) => r.key === key);
  return entry ? entry.value : null;
}

function rollAttackEffect(depth, rarityValue, existingIds = []) {
  const pool = ATTACK_EFFECT_OPTIONS.filter((opt) => !existingIds.includes(opt.id));
  if (!pool.length) return null;
  const option = Phaser.Utils.Array.GetRandom(pool);
  const depthScale = 1 + Math.min(0.8, Math.max(0, (depth || 1) - 1) * 0.01);
  const rarityScale = 1 + Math.min(0.6, Math.max(0, (rarityValue || 1) - 1) * 0.12);
  const raw = Phaser.Math.FloatBetween(option.min, option.max);
  const value = Number((Math.min(option.max * 1.6, raw * depthScale * rarityScale)).toFixed(3));
  return { id: option.id, ability: option.ability, stat: option.stat, value: Math.max(0, value) };
}

function maybeAttachAttackEffect(item, rarityValue, depth) {
  if (!item) return;
  const chance = Math.min(0.65, ATTACK_EFFECT_BASE_CHANCE + (rarityValue || 1) * 0.12);
  if (Math.random() > chance) return;
  const statKeys = ITEM_STAT_KEYS.filter((key) => (item[key] || 0) > 0);
  const existingIds = Array.isArray(item.attackEffects) ? item.attackEffects.map((e) => e.id) : [];
  const effect = rollAttackEffect(depth, rarityValue, existingIds);
  if (!effect) return;
  if (statKeys.length) {
    const removeKey = Phaser.Utils.Array.GetRandom(statKeys);
    item[removeKey] = 0;
  }
  item.attackEffects = Array.isArray(item.attackEffects) ? item.attackEffects : [];
  item.attackEffects.push(effect);
  item.itemLevel = computeItemLevelFromStats(item, depth);
}

function normalizeItemStatsForRarity(item, rarityValue = 1) {
  if (!item) return item;
  const allowed = Math.max(1, Math.round(Number(rarityValue) || 1));
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
  _spawnGoldPile(scene, enemy.x, enemy.y, amount);
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
      { target: 'document', name: 'Protokoll-Abschrift', key: 'QUEST_DOC', tint: 0xffdd44 },
      { target: 'print_plate', name: 'Verbotene Druckplatte', key: 'QUEST_PLATE', tint: 0x88aaff }
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

  // Elite enemies have higher loot chance and better rarity
  const isEliteDrop = sourceEnemy && sourceEnemy.isElite;
  const isMiniBossDrop = sourceEnemy && sourceEnemy.isMiniBoss;
  const lootChanceBonus = isEliteDrop ? 20 : (isMiniBossDrop ? 30 : 0);

  const roll = Phaser.Math.Between(0, 100);

  if (maybeItem || roll < (12 + lootChanceBonus)) {
    const baseItem = maybeItem ? { ...maybeItem } : randomLoot();
    let rarityValue = baseItem?.rarityValue || getRarityValueFromKey(baseItem?.rarity) || 1;
    // Elite enemies: increase rarity tier by 1; Mini-bosses: by 2
    if (isEliteDrop && rarityValue < 4) {
      rarityValue += 1;
      const upgradedRarity = ITEM_RARITIES.find(r => r.value === rarityValue);
      if (upgradedRarity) {
        baseItem.rarity = upgradedRarity.key;
        baseItem.rarityLabel = upgradedRarity.label;
        baseItem.rarityValue = rarityValue;
      }
    } else if (isMiniBossDrop && rarityValue < 4) {
      rarityValue = Math.min(4, rarityValue + 2);
      const upgradedRarity = ITEM_RARITIES.find(r => r.value === rarityValue);
      if (upgradedRarity) {
        baseItem.rarity = upgradedRarity.key;
        baseItem.rarityLabel = upgradedRarity.label;
        baseItem.rarityValue = rarityValue;
      }
    }
    const item = maybeItem
      ? normalizeItemStatsForRarity(scaleItemForDifficulty(baseItem, Math.max(1, currentWave)), rarityValue)
      : normalizeItemStatsForRarity(baseItem, rarityValue);
    const loot = lootGroup.create(x, y, item.iconKey || 'itMat');
    loot.setDisplaySize(32, 24);
    loot.setData('item', item);
    loot.setDepth(80);
    trackLootSprite(scene || loot.scene, loot);
  } else if (roll < 50) {
    spawnPickup.call(this, x, y, 'health');
  } else if (roll < 80) {
    spawnPickup.call(this, x, y, 'xp');
  }
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

function collectLoot(playerSprite, loot) {
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
        // Inventory full → salvage to Eisenbrocken based on rarity
        const rarityValue = item?.rarityValue || 1;
        const matAmount = rarityValue * 2; // common=2, rare=4, epic=6, legendary=8
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

function pickItemRarity() {
  const roll = Phaser.Math.Between(1, 100);
  let acc = 0;
  for (const r of ITEM_RARITIES) {
    acc += r.chance;
    if (roll <= acc) return r;
  }
  return ITEM_RARITIES[0];
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
    const normalizedRarity = item.rarityValue || getRarityValueFromKey(item.rarity) || 1;
    normalizeItemStatsForRarity(item, normalizedRarity);
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

   const normalizedRarity = item.rarityValue || getRarityValueFromKey(item.rarity) || 1;
   normalizeItemStatsForRarity(item, normalizedRarity);

  return item;
}

function applyRarityBoosts(potentials, rarityValue, depth) {
  const boosted = ITEM_STAT_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  const available = ITEM_STAT_KEYS.filter(key => (potentials[key] ?? 0) > 0);
  const keysPool = available.length ? available : ITEM_STAT_KEYS;
  const boosts = Math.max(1, rarityValue);

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
    const rarityValue = item?.rarityValue || getRarityValueFromKey(item?.rarity) || 1;
    normalizeItemStatsForRarity(item, rarityValue);
    return;
  }
  const potentials = rollItemStatPotentials(item?.type || 'weapon', depth);
  const available = ITEM_STAT_KEYS.filter(key => (potentials[key] ?? 0) > 0);
  const keysPool = available.length ? available : ITEM_STAT_KEYS;
  for (let i = 0; i < totalBoosts; i++) {
    let applied = false;
    if (Math.random() < 0.35) {
      const prevCount = Array.isArray(item.attackEffects) ? item.attackEffects.length : 0;
      maybeAttachAttackEffect(item, item.rarityValue || boosts, depth);
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

  const rarityValue = item.rarityValue || getRarityValueFromKey(item.rarity) || totalBoosts;
  normalizeItemStatsForRarity(item, rarityValue);
}

function randomLoot() {
  const depth = Math.max(1, currentWave);
  const rarity = pickItemRarity();
  const roll = Phaser.Math.Between(1, 100);
  const applyDifficulty = (item) => normalizeItemStatsForRarity(scaleItemForDifficulty(item, depth), item.rarityValue || rarity.value || getRarityValueFromKey(item.rarity));

  if (roll <= 35) {
    const base = rollItemStatPotentials('weapon', depth);
    const core = applyRarityBoosts(base, rarity.value, depth);
    const itemLevel = computeItemLevelFromStats(core, depth);
    const item = makeItem({
      type: 'weapon', key: 'WPN', name: 'Klingenschwert',
      iconKey: 'itWeapon',
      rarity: rarity.key,
      rarityLabel: rarity.label,
      rarityValue: rarity.value,
      itemLevel,
      hp: core.hp,
      damage: core.damage,
      speed: core.speed,
      range: core.range,
      armor: core.armor,
      crit: core.crit
    });
    maybeAttachAttackEffect(item, rarity.value, depth);
    return applyDifficulty(item);
  }

  if (roll <= 55) {
    const base = rollItemStatPotentials('head', depth);
    const core = applyRarityBoosts(base, rarity.value, depth);
    const itemLevel = computeItemLevelFromStats(core, depth);
    const item = makeItem({
      type: 'head', key: 'HD', name: 'Stahlhelm',
      iconKey: 'itHead',
      rarity: rarity.key,
      rarityLabel: rarity.label,
      rarityValue: rarity.value,
      itemLevel,
      hp: core.hp,
      damage: core.damage,
      speed: core.speed,
      range: core.range,
      armor: core.armor,
      crit: core.crit
    });
    maybeAttachAttackEffect(item, rarity.value, depth);
    return applyDifficulty(item);
  }

  if (roll <= 75) {
    const base = rollItemStatPotentials('body', depth);
    const core = applyRarityBoosts(base, rarity.value, depth);
    const itemLevel = computeItemLevelFromStats(core, depth);
    const item = makeItem({
      type: 'body', key: 'BD', name: 'Brustplatte',
      iconKey: 'itBody',
      rarity: rarity.key,
      rarityLabel: rarity.label,
      rarityValue: rarity.value,
      itemLevel,
      hp: core.hp,
      damage: core.damage,
      speed: core.speed,
      range: core.range,
      armor: core.armor,
      crit: core.crit
    });
    maybeAttachAttackEffect(item, rarity.value, depth);
    return applyDifficulty(item);
  }

  if (roll <= 85) {
    const base = rollItemStatPotentials('boots', depth);
    const core = applyRarityBoosts(base, rarity.value, depth);
    const itemLevel = computeItemLevelFromStats(core, depth);
    const item = makeItem({
      type: 'boots', key: 'BT', name: 'Stiefel',
      iconKey: 'itBoots',
      rarity: rarity.key,
      rarityLabel: rarity.label,
      rarityValue: rarity.value,
      itemLevel,
      hp: core.hp,
      damage: core.damage,
      speed: core.speed,
      range: core.range,
      armor: core.armor,
      crit: core.crit
    });
    maybeAttachAttackEffect(item, rarity.value, depth);
    return applyDifficulty(item);
  }

  return applyDifficulty(makeItem({
    type: 'material',
    key: 'MAT',
    materialKey: 'MAT',
    name: 'Eisenbrocken',
    iconKey: 'itMat',
    rarity: rarity.key,
    rarityLabel: rarity.label,
    rarityValue: rarity.value,
    itemLevel: rarity.value,
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
  window.ITEM_RARITIES = ITEM_RARITIES;
  window.normalizeItemStatsForRarity = normalizeItemStatsForRarity;
  window.getRarityValueFromKey = getRarityValueFromKey;
  // WP03: expose gold-drop helpers so chest-open code and future systems can
  // spawn gold piles without duplicating the formula.
  window.spawnGoldPile = _spawnGoldPile;
  window.rollEnemyGoldDrop = _rollEnemyGoldDrop;
}
