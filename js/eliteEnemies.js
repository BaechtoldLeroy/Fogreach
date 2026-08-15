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
        // Wirkung: Blitzring beim Tod (player.js, Gegner-Tod-Block, #90).
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
        // Wirkung: SLOW-StatusEffect im Update-Tick (enemy.js handleEnemies, #90).
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
        // Wirkung: Common-Waffen richten nur 35% aus (player.js dealDamageToEnemy, #90).
        // Bewusst keine harte Immunitaet — sonst unbesiegbar ohne Magic-Waffe.
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
        // Wirkung: shootProjectile leitet auf shootSpreadProjectiles um (enemy.js, #90).
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
        // Wirkung: Heilung am zugefuegten Schaden (enemy.js applyPlayerDamage, #90).
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
        // Wirkung: Schadensverdopplung unter 30% HP (enemy.js applyPlayerDamage, #90).
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
        // Wirkung: abilityKey !== attack -> halber Schaden (player.js dealDamageToEnemy, #90).
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
    // Bedingte Chance (wird NUR gewürfelt, wenn der Gegner kein Legacy-Elite ist,
    // ~8% ab Tiefe 5). Zusammen deckelt die GESAMT-Elite-Chance bei ~30%:
    //   Gesamt = legacy + (1-legacy)*(champion+unique)
    //   T6-10 ~18%, T11-15 ~24%, T16+ ~29%.
    let championRate, uniqueRate;
    if (depth <= 10) { championRate = 0.09; uniqueRate = 0.02; }
    else if (depth <= 15) { championRate = 0.13; uniqueRate = 0.04; }
    else { championRate = 0.18; uniqueRate = 0.05; }
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

  // Sichtlinien-Test gegen das zwischengespeicherte Vision-Polygon (wird jeden
  // Frame von roomManager.updateFogOfWar gefüllt). Liegt (x,y) ausserhalb —
  // also hinter einer Wand oder geschlossenen Tür — ist das Objekt zu
  // verstecken.
  //
  // Nötig für Namens-Tag UND Aura: beide hängen zwar im enemyLayer, aber die
  // GeometryMask dort greift bei ihnen nicht (Text ohnehin nicht, die Aura-
  // Graphics zeichnet in Weltkoordinaten). Ohne diesen Test leuchten die Auren
  // verzauberter Gegner durch geschlossene Türen. (Refs #14)
  function _isInVision(scene, x, y, fallback) {
    var poly = scene && scene._lastVisionPolygon;
    if (!poly || poly.length < 6 || typeof window === 'undefined'
        || !window.Phaser || !window.Phaser.Geom || !window.Phaser.Geom.Polygon) {
      return fallback;
    }
    try {
      // Polygon-Objekt einmal bauen und wiederverwenden, solange sich die
      // Punktliste nicht geändert hat (läuft im 16ms-Timer).
      if (!scene._lastVisionPolyObj || scene._lastVisionPolyData !== poly) {
        scene._lastVisionPolyObj = new window.Phaser.Geom.Polygon(poly);
        scene._lastVisionPolyData = poly;
      }
      return window.Phaser.Geom.Polygon.Contains(scene._lastVisionPolyObj, x, y);
    } catch (_) {
      return fallback;
    }
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
      // Aura (Phaser.Graphics circle at depth 38). Perf (#70): der Kreis wird
      // EINMAL bei (0,0) gezeichnet und danach nur noch verschoben — kein
      // clear()+fillCircle()-Geometrie-Rebuild pro Frame mehr.
      if (typeof scene.add.graphics === 'function') {
        try {
          const aura = scene.add.graphics();
          aura.fillStyle(picked[0].auraColor, 0.35);
          aura.fillCircle(0, 0, 36);
          aura.setPosition(enemy.x, enemy.y);
          if (typeof aura.setDepth === 'function') aura.setDepth(38);
          // Put aura in enemyLayer so it respects the enemy vision mask
          if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') {
            scene.enemyLayer.add(aura);
          }
          enemy._eliteAura = aura;
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
        } catch (e) { /* swallow */ }
      }

      // EIN gemeinsamer Visual-Timer fuer Aura + Tag (Perf #70). Frueher zwei
      // 16ms-Loop-Timer PRO Elite, die JE _isInVision (Punkt-in-Polygon, O(rays))
      // mit 60Hz aufriefen -> skalierte schlecht mit der Elite-Anzahl. Jetzt:
      //   - Position jeden Tick (folgt dem Gegner fluessig),
      //   - Sichtbarkeits-Check (das teure _isInVision) nur alle 3 Ticks — das
      //     Vision-Polygon aktualisiert die Fog-Schleife auf Mobile ohnehin nur
      //     ~15Hz, 60Hz-Checks waren 4x redundant.
      // Text-Objekte umgehen die GeometryMask des enemyLayer, darum der explizite
      // LOS-Test gegen das gecachte Sichtpolygon (Refs #14).
      if (scene.time && typeof scene.time.addEvent === 'function'
          && (enemy._eliteAura || enemy._eliteNameTag)) {
        let _visTick = 0;
        let _lastVis = true;
        const visualTimer = scene.time.addEvent({
          delay: 16,
          loop: true,
          callback: function () {
            const aura = enemy._eliteAura;
            const tag = enemy._eliteNameTag;
            // Bail wenn Enemy/Szene weg (Shutdown mid-transition) — sonst
            // "Cannot read properties of undefined (reading 'sys')".
            const sceneAlive = (aura && aura.scene && aura.scene.sys)
              || (tag && tag.scene && tag.scene.sys);
            if (!enemy || !enemy.active || !sceneAlive) {
              if (visualTimer && typeof visualTimer.remove === 'function') visualTimer.remove();
              return;
            }
            if (aura && aura.active) aura.setPosition(enemy.x, enemy.y);
            if (tag && tag.active) { tag.x = enemy.x; tag.y = enemy.y - 30; }
            if ((_visTick++ % 3) === 0) {
              const vscene = (aura && aura.scene) || (tag && tag.scene);
              _lastVis = enemy.visible && _isInVision(vscene, enemy.x, enemy.y, true);
            }
            if (aura && typeof aura.setVisible === 'function') aura.setVisible(_lastVis);
            if (tag && typeof tag.setVisible === 'function') tag.setVisible(enemy.active && _lastVis);
          }
        });
        enemy._eliteVisualTimer = visualTimer;
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
    // Gemeinsamer Visual-Timer (Perf #70) zuerst stoppen, bevor Aura/Tag weg sind.
    if (enemy._eliteVisualTimer) {
      try { if (typeof enemy._eliteVisualTimer.remove === 'function') enemy._eliteVisualTimer.remove(); } catch (e) {}
      enemy._eliteVisualTimer = null;
    }
    // Alt-Timer defensiv mit abraeumen, falls je noch ein Enemy welche traegt.
    if (enemy._eliteAuraTimer) {
      try { if (typeof enemy._eliteAuraTimer.remove === 'function') enemy._eliteAuraTimer.remove(); } catch (e) {}
      enemy._eliteAuraTimer = null;
    }
    if (enemy._eliteNameTagTimer) {
      try { if (typeof enemy._eliteNameTagTimer.remove === 'function') enemy._eliteNameTagTimer.remove(); } catch (e) {}
      enemy._eliteNameTagTimer = null;
    }
    // Destroy aura
    if (enemy._eliteAura) {
      try { if (typeof enemy._eliteAura.destroy === 'function') enemy._eliteAura.destroy(); } catch (e) {}
      enemy._eliteAura = null;
    }
    // Destroy name tag
    if (enemy._eliteNameTag) {
      try { if (typeof enemy._eliteNameTag.destroy === 'function') enemy._eliteNameTag.destroy(); } catch (e) {}
      enemy._eliteNameTag = null;
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

  // Feature 061 (WP04 / HuntMode): das beste "Jagd-Ziel" aus einer Gegner-Gruppe
  // wählen — bevorzugt einen Elite, sonst den mit der höchsten Max-HP. Gibt das
  // Gegner-Objekt zurück (oder null). Rein (nutzt nur die übergebene Gruppe).
  function pickHuntTarget(enemyGroup) {
    if (!enemyGroup || typeof enemyGroup.getChildren !== 'function') return null;
    var list = enemyGroup.getChildren();
    var best = null, bestScore = -1;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.active) continue;
      var hp = (typeof e.maxHealth === 'number') ? e.maxHealth : ((typeof e.health === 'number') ? e.health : 1);
      var score = hp + (isElite(e) ? 100000 : 0); // Elites klar bevorzugen
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
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
    pickHuntTarget: pickHuntTarget,
    modifyDropTable: modifyDropTable
  };
})();
