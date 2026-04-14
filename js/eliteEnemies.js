// js/eliteEnemies.js — WP05 Elite Enemies
//
// Provides D2-style Champion and Unique elite variants by mutating regular
// enemy instances with 1 (Champion) or 2-3 (Unique) random affixes from a
// 10-entry pool. Adds HP boost, sprite tint, aura graphic, floating name
// tag, and on-death cleanup + bonus drops.
//
// Public API (window.EliteEnemies):
//   ENEMY_AFFIX_DEFS           — frozen 10-entry affix pool
//   shouldSpawnElite(depth,rng?) → 'champion'|'unique'|null
//   applyEliteToEnemy(enemy, tier, rng?) → void
//   removeEliteFromEnemy(enemy) → void (visual cleanup; called from destroy)
//   isElite(enemy) → boolean
//   modifyDropTable(enemy, baseDrops) → DropTable (pure helper for tests)

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // ENEMY_AFFIX_DEFS (T027) — 10 entries per data-model.md
  // -------------------------------------------------------------------------

  const ENEMY_AFFIX_DEFS = Object.freeze([
    {
      id: 'fanatic',
      displayName: 'Fanatic',
      tint: 0xff8844,
      auraColor: 0xff5500,
      category: 'speed',
      apply: function (enemy) {
        enemy._origSpeedFanatic = enemy.speed;
        enemy._origAttackCdMulFanatic = enemy._attackCdMul;
        enemy.speed = (enemy.speed || 60) * 1.5;
        enemy._attackCdMul = (enemy._attackCdMul || 1) * 0.5;
        enemy.isFanatic = true;
      },
      revert: function (enemy) {
        if (typeof enemy._origSpeedFanatic !== 'undefined') enemy.speed = enemy._origSpeedFanatic;
        if (typeof enemy._origAttackCdMulFanatic !== 'undefined') enemy._attackCdMul = enemy._origAttackCdMulFanatic;
        delete enemy.isFanatic;
      }
    },
    {
      id: 'lightning_enchanted',
      displayName: 'Lightning Enchanted',
      tint: 0x88aaff,
      auraColor: 0x66aaff,
      category: 'element',
      apply: function (enemy) {
        enemy.isLightningEnchanted = true;
        // TODO: hook into combat — spawn a ring of lightning bolts on death
      },
      revert: function (enemy) { delete enemy.isLightningEnchanted; }
    },
    {
      id: 'cold_aura',
      displayName: 'Cold Aura',
      tint: 0x88ccff,
      auraColor: 0x44aaff,
      category: 'aura',
      apply: function (enemy) {
        enemy.hasColdAura = true;
        enemy.coldAuraRadius = 150;
        // TODO: hook into combat — slow player within 150px by 30%
      },
      revert: function (enemy) { delete enemy.hasColdAura; delete enemy.coldAuraRadius; }
    },
    {
      id: 'spectral_hit',
      displayName: 'Spectral Hit',
      tint: 0xaa66ff,
      auraColor: 0x8844ff,
      category: 'defense',
      apply: function (enemy) {
        enemy.isSpectralHit = true;
        // TODO: hook into combat — only Magic+ items deal damage
      },
      revert: function (enemy) { delete enemy.isSpectralHit; }
    },
    {
      id: 'multishot',
      displayName: 'Multishot',
      tint: 0xff66cc,
      auraColor: 0xff3399,
      category: 'ranged',
      apply: function (enemy) {
        enemy.isMultishot = true;
        enemy.multishotCount = 3;
        // TODO: hook into combat — ranged attacks fire 3 projectiles
      },
      revert: function (enemy) { delete enemy.isMultishot; delete enemy.multishotCount; }
    },
    {
      id: 'vampiric',
      displayName: 'Vampiric',
      tint: 0xff4444,
      auraColor: 0xcc2222,
      category: 'survival',
      apply: function (enemy) {
        enemy.isVampiric = true;
        enemy.lifestealPct = 0.30;
        // TODO: hook into combat — 30% lifesteal on hit
      },
      revert: function (enemy) { delete enemy.isVampiric; delete enemy.lifestealPct; }
    },
    {
      id: 'berserker',
      displayName: 'Berserker',
      tint: 0xff8800,
      auraColor: 0xff5500,
      category: 'offense',
      apply: function (enemy) {
        enemy.isBerserker = true;
        // TODO: hook into combat — 2x damage below 30% HP
      },
      revert: function (enemy) { delete enemy.isBerserker; }
    },
    {
      id: 'extra_strong',
      displayName: 'Extra Strong',
      tint: 0xffaa00,
      auraColor: 0xff8800,
      category: 'offense',
      apply: function (enemy) {
        enemy._origDamageStrong = enemy.damage;
        enemy._origBaseDamageStrong = enemy.baseDamage;
        enemy.damage = (enemy.damage || 1) * 2;
        if (typeof enemy.baseDamage === 'number') enemy.baseDamage = enemy.baseDamage * 2;
        enemy.isExtraStrong = true;
      },
      revert: function (enemy) {
        if (typeof enemy._origDamageStrong !== 'undefined') enemy.damage = enemy._origDamageStrong;
        if (typeof enemy._origBaseDamageStrong !== 'undefined') enemy.baseDamage = enemy._origBaseDamageStrong;
        delete enemy.isExtraStrong;
      }
    },
    {
      id: 'extra_fast',
      displayName: 'Extra Fast',
      tint: 0x00ffcc,
      auraColor: 0x00ffff,
      category: 'speed',
      apply: function (enemy) {
        enemy._origSpeedFast = enemy.speed;
        enemy.speed = (enemy.speed || 60) * 1.5;
        enemy.isExtraFast = true;
      },
      revert: function (enemy) {
        if (typeof enemy._origSpeedFast !== 'undefined') enemy.speed = enemy._origSpeedFast;
        delete enemy.isExtraFast;
      }
    },
    {
      id: 'magic_resistant',
      displayName: 'Magic Resistant',
      tint: 0xcc88ff,
      auraColor: 0xaa66ff,
      category: 'defense',
      apply: function (enemy) {
        enemy.isMagicResistant = true;
        enemy.abilityDamageMul = 0.5;
        // TODO: hook into combat — abilities deal 50% damage
      },
      revert: function (enemy) { delete enemy.isMagicResistant; delete enemy.abilityDamageMul; }
    }
  ]);

  // -------------------------------------------------------------------------
  // shouldSpawnElite(depth, rng?)  (T028)
  // -------------------------------------------------------------------------

  function shouldSpawnElite(depth, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    if (typeof depth !== 'number' || depth < 6) return null;
    let championRate, uniqueRate;
    if (depth <= 10) { championRate = 0.25; uniqueRate = 0.05; }
    else if (depth <= 15) { championRate = 0.35; uniqueRate = 0.10; }
    else { championRate = 0.40; uniqueRate = 0.15; }
    const r = rng();
    if (r < uniqueRate) return 'unique';
    if (r < uniqueRate + championRate) return 'champion';
    return null;
  }

  // -------------------------------------------------------------------------
  // rollEliteAffixes(eliteTier, rng?)
  // -------------------------------------------------------------------------

  function rollEliteAffixes(eliteTier, rng) {
    if (typeof rng !== 'function') rng = Math.random;
    const isUnique = eliteTier === 'unique';
    // Champion = 1 affix; Unique = 2 or 3 affixes (random)
    const affixCount = isUnique ? (2 + Math.floor(rng() * 2)) : 1;
    const pool = ENEMY_AFFIX_DEFS.slice();
    const picked = [];
    for (let i = 0; i < affixCount && pool.length > 0; i++) {
      const idx = Math.floor(rng() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  // -------------------------------------------------------------------------
  // applyEliteToEnemy(enemy, eliteTier, rng?)  (T029)
  // -------------------------------------------------------------------------

  function _enemyTypeName(enemy) {
    if (!enemy) return 'Enemy';
    if (enemy.isBrute) return 'Brute';
    if (enemy.isImp) return 'Imp';
    if (enemy.isArcher) return 'Archer';
    if (enemy.isMage) return 'Mage';
    if (enemy.isFlameWeaver) return 'Flammenweber';
    if (enemy.isShadowCreeper || enemy.isShadow) return 'Schattenschleicher';
    if (enemy.isChainGuard) return 'Kettenwächter';
    return 'Gegner';
  }

  function applyEliteToEnemy(enemy, eliteTier, rng) {
    if (!enemy) return;
    if (eliteTier !== 'champion' && eliteTier !== 'unique') return;

    const picked = rollEliteAffixes(eliteTier, rng);

    // Apply affix mutations
    for (const def of picked) {
      try { def.apply(enemy); } catch (e) { /* swallow */ }
    }

    // HP boost (champion ×1.5, unique ×2.0). Multiply both current and max hp.
    const hpMul = eliteTier === 'unique' ? 2.0 : 1.5;
    const prevHp = (typeof enemy.hp === 'number') ? enemy.hp : 50;
    enemy.hp = Math.round(prevHp * hpMul);
    if (typeof enemy.maxHp === 'number') enemy.maxHp = enemy.hp;
    else enemy.maxHp = enemy.hp;
    if (typeof enemy.maxHealth === 'number') enemy.maxHealth = enemy.hp;
    if (typeof enemy.health === 'number') enemy.health = enemy.hp;

    // Mark enemy
    enemy._isElite = true;
    enemy.isElite = true; // existing code in loot.js reads this already
    enemy.eliteTier = eliteTier;
    enemy.eliteAffixes = picked.map((d) => d.id);
    enemy._eliteAffixDefs = picked;

    // Sprite tint from first affix
    if (picked.length > 0 && typeof enemy.setTint === 'function') {
      try { enemy.setTint(picked[0].tint); } catch (e) { /* swallow */ }
    }

    // Visuals: aura + name tag — only if we have a live scene
    const scene = enemy.scene;
    if (scene && scene.add && picked.length > 0) {
      // Aura (Phaser.Graphics circle at depth 38)
      if (typeof scene.add.graphics === 'function') {
        try {
          const aura = scene.add.graphics();
          aura.fillStyle(picked[0].auraColor, 0.35);
          aura.fillCircle(enemy.x, enemy.y, 36);
          if (typeof aura.setDepth === 'function') aura.setDepth(38);
          // Put aura in enemyLayer so it respects the enemy vision mask
          if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') {
            scene.enemyLayer.add(aura);
          }
          enemy._eliteAura = aura;
          if (scene.time && typeof scene.time.addEvent === 'function') {
            const auraTimer = scene.time.addEvent({
              delay: 16,
              loop: true,
              callback: function () {
                // Bail if enemy/aura/scene are gone (e.g., scene shutdown
                // mid-transition to hub). Without this guard the callback
                // can hit "Cannot read properties of undefined (reading 'sys')"
                // when Phaser tears down the scene.
                if (!enemy || !enemy.active || !aura || !aura.active ||
                    !aura.scene || !aura.scene.sys) {
                  if (auraTimer && typeof auraTimer.remove === 'function') auraTimer.remove();
                  return;
                }
                aura.clear();
                aura.fillStyle(picked[0].auraColor, 0.35);
                aura.fillCircle(enemy.x, enemy.y, 36);
              }
            });
            enemy._eliteAuraTimer = auraTimer;
          }
        } catch (e) { /* swallow */ }
      }

      // Floating name tag (Phaser.Text at depth 51)
      if (typeof scene.add.text === 'function') {
        try {
          const baseTypeName = _enemyTypeName(enemy);
          const tagText = picked.map((d) => d.displayName).join(' ') + ' ' + baseTypeName;
          const tag = scene.add.text(enemy.x, enemy.y - 30, tagText, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffaa00',
            backgroundColor: '#000a',
            padding: { x: 3, y: 1 }
          });
          if (typeof tag.setOrigin === 'function') tag.setOrigin(0.5);
          if (typeof tag.setDepth === 'function') tag.setDepth(51);
          // Put name tag in enemyLayer so it respects the vision mask
          if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') {
            scene.enemyLayer.add(tag);
          }
          enemy._eliteNameTag = tag;
          enemy.eliteNameTag = tagText;
          if (scene.time && typeof scene.time.addEvent === 'function') {
            const tagTimer = scene.time.addEvent({
              delay: 16,
              loop: true,
              callback: function () {
                if (!enemy || !enemy.active || !tag || !tag.active ||
                    !tag.scene || !tag.scene.sys) {
                  if (tagTimer && typeof tagTimer.remove === 'function') tagTimer.remove();
                  return;
                }
                tag.x = enemy.x;
                tag.y = enemy.y - 30;
              }
            });
            enemy._eliteNameTagTimer = tagTimer;
          }
        } catch (e) { /* swallow */ }
      }
    }

    // Hook destroy() so visuals and bonus drops are handled
    if (typeof enemy.destroy === 'function' && !enemy._eliteDestroyPatched) {
      const origDestroy = enemy.destroy.bind(enemy);
      enemy._eliteDestroyPatched = true;
      enemy.destroy = function () {
        try { _spawnEliteBonusDrops(enemy); } catch (e) { /* swallow */ }
        try { removeEliteFromEnemy(enemy); } catch (e) { /* swallow */ }
        return origDestroy.apply(this, arguments);
      };
    }
  }

  // -------------------------------------------------------------------------
  // removeEliteFromEnemy(enemy)  (T030)
  // -------------------------------------------------------------------------

  function removeEliteFromEnemy(enemy) {
    if (!enemy) return;
    // Revert each affix (best-effort)
    if (Array.isArray(enemy._eliteAffixDefs)) {
      for (const def of enemy._eliteAffixDefs) {
        if (def && typeof def.revert === 'function') {
          try { def.revert(enemy); } catch (e) { /* swallow */ }
        }
      }
    }
    // Destroy aura
    if (enemy._eliteAura) {
      try { if (typeof enemy._eliteAura.destroy === 'function') enemy._eliteAura.destroy(); } catch (e) {}
      enemy._eliteAura = null;
    }
    if (enemy._eliteAuraTimer) {
      try { if (typeof enemy._eliteAuraTimer.remove === 'function') enemy._eliteAuraTimer.remove(); } catch (e) {}
      enemy._eliteAuraTimer = null;
    }
    // Destroy name tag
    if (enemy._eliteNameTag) {
      try { if (typeof enemy._eliteNameTag.destroy === 'function') enemy._eliteNameTag.destroy(); } catch (e) {}
      enemy._eliteNameTag = null;
    }
    if (enemy._eliteNameTagTimer) {
      try { if (typeof enemy._eliteNameTagTimer.remove === 'function') enemy._eliteNameTagTimer.remove(); } catch (e) {}
      enemy._eliteNameTagTimer = null;
    }
    enemy._isElite = false;
  }

  // -------------------------------------------------------------------------
  // isElite(enemy)
  // -------------------------------------------------------------------------

  function isElite(enemy) {
    return !!(enemy && (enemy._isElite || enemy.isElite));
  }

  // -------------------------------------------------------------------------
  // _spawnEliteBonusDrops(enemy) — triggered from destroy() override.
  // Champion: +1 extra loot spawn. Unique: +2 extra + guaranteed Magic+ item.
  // -------------------------------------------------------------------------

  function _spawnEliteBonusDrops(enemy) {
    if (!enemy || !enemy._isElite) return;
    const scene = enemy.scene;
    if (!scene) return;
    if (typeof window === 'undefined' || typeof window.spawnLoot !== 'function') return;
    const x = enemy.x;
    const y = enemy.y;
    const tier = enemy.eliteTier;
    let extraCount = 0;
    if (tier === 'champion') extraCount = 1;
    else if (tier === 'unique') extraCount = 2;

    for (let i = 0; i < extraCount; i++) {
      try { window.spawnLoot.call(scene, x, y, null, enemy); } catch (e) { /* swallow */ }
    }

    // Unique: guaranteed Magic+ item via LootSystem.rollItem(base, level, forceTier=1)
    if (tier === 'unique' && window.LootSystem && typeof window.LootSystem.rollItem === 'function') {
      try {
        const lvl = enemy.iLevel || enemy.mLevel || window.currentWave || 5;
        const guaranteed = window.LootSystem.rollItem(null, lvl, 1);
        if (guaranteed) {
          window.spawnLoot.call(scene, x, y, guaranteed, enemy);
        }
      } catch (e) { /* swallow */ }
    }
  }

  // -------------------------------------------------------------------------
  // modifyDropTable(enemy, baseDrops) — pure helper (T031). Useful for tests
  // and any future drop pipeline that wants to apply elite bonuses up-front.
  // -------------------------------------------------------------------------

  function modifyDropTable(enemy, baseDrops) {
    if (!enemy || !enemy._isElite) return baseDrops;
    const base = baseDrops || { items: [], gold: 0 };
    const drops = {
      items: Array.isArray(base.items) ? base.items.slice() : [],
      gold: typeof base.gold === 'number' ? base.gold : 0
    };
    if (enemy.eliteTier === 'champion') {
      const extra = Math.max(1, Math.floor(drops.items.length * 0.5));
      for (let i = 0; i < extra && drops.items.length > 0; i++) {
        drops.items.push(drops.items[i % drops.items.length]);
      }
    } else if (enemy.eliteTier === 'unique') {
      drops.items = drops.items.concat(drops.items.slice());
      if (typeof window !== 'undefined' && window.LootSystem && typeof window.LootSystem.rollItem === 'function') {
        try {
          const lvl = enemy.iLevel || enemy.mLevel || 5;
          const guaranteed = window.LootSystem.rollItem(null, lvl, 1);
          if (guaranteed) drops.items.push(guaranteed);
        } catch (e) { /* swallow */ }
      }
      drops.gold = Math.round((drops.gold || 0) * 1.5);
    }
    return drops;
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  window.EliteEnemies = {
    ENEMY_AFFIX_DEFS: ENEMY_AFFIX_DEFS,
    shouldSpawnElite: shouldSpawnElite,
    rollEliteAffixes: rollEliteAffixes,
    applyEliteToEnemy: applyEliteToEnemy,
    removeEliteFromEnemy: removeEliteFromEnemy,
    isElite: isElite,
    modifyDropTable: modifyDropTable
  };
})();
