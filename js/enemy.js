// enemy.js

const ENEMY_SPAWN_MARGIN = 32;
const ENEMY_SPAWN_HALF_SIZE = 24;
const DEFAULT_RANGED_ATTACK_RANGE = 520;

function randomIntBetween(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return min;
  if (min >= max) return min;
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  if (hi <= lo) return lo;
  return Phaser.Math.Between(lo, hi);
}

function isSpawnBlocked(px, py, halfSize = ENEMY_SPAWN_HALF_SIZE) {
  if (typeof window !== "undefined" && typeof window.isSpawnPositionBlocked === "function") {
    return window.isSpawnPositionBlocked(px, py, halfSize);
  }
  if (!obstacles || typeof obstacles.getChildren !== "function") return false;

  const rect = new Phaser.Geom.Rectangle(
    px - halfSize,
    py - halfSize,
    halfSize * 2,
    halfSize * 2
  );

  const list = obstacles.getChildren();
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (!o || !o.body || !o.body.enable) continue;

    const bounds = o.getBounds ? o.getBounds() : o.body?.getBounds?.();
    if (!bounds) continue;

    const inflated = new Phaser.Geom.Rectangle(
      bounds.x - 4,
      bounds.y - 4,
      bounds.width + 8,
      bounds.height + 8
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, inflated)) {
      return true;
    }
  }

  return false;
}

function pickAccessibleSpawnPosition(scene, boundsRect, margin, maxAttempts = 6) {
  if (!scene || typeof scene.pickAccessibleSpawnPoint !== "function") {
    return null;
  }

  const nav = scene._accessibleArea;
  const jitter =
    nav && Number.isFinite(nav.jitter) ? nav.jitter : nav ? Math.max(4, Math.floor(nav.cellSize * 0.35)) : 0;

  const left = boundsRect.left + margin;
  const right = boundsRect.right - margin;
  const top = boundsRect.top + margin;
  const bottom = boundsRect.bottom - margin;

  const clampCandidate = (cx, cy) => {
    const x = Phaser.Math.Clamp(cx, left, right);
    const y = Phaser.Math.Clamp(cy, top, bottom);
    if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) return null;
    if (isSpawnBlocked(x, y)) return null;
    return { x, y };
  };

  const attempts = Math.max(1, maxAttempts);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const base = scene.pickAccessibleSpawnPoint({
      maxAttempts: Math.max(24, attempts * 4),
    });
    if (!base) break;
    let x = base.x;
    let y = base.y;
    if (jitter > 0) {
      x += Phaser.Math.Between(-jitter, jitter);
      y += Phaser.Math.Between(-jitter, jitter);
    }
    const candidate = clampCandidate(x, y);
    if (candidate) return candidate;
  }

  const fallback = scene.pickAccessibleSpawnPoint({ maxAttempts: 1 });
  if (fallback) {
    const candidate = clampCandidate(fallback.x, fallback.y);
    if (candidate) return candidate;
  }

  return null;
}

function getDifficultyMultiplierValue() {
  const fn = typeof window?.getDifficultyMultiplier === 'function'
    ? window.getDifficultyMultiplier
    : null;
  const raw = fn ? fn() : window?.DIFFICULTY_MULTIPLIER;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 1;
  return Phaser?.Math?.Clamp ? Phaser.Math.Clamp(raw, 0.1, 10) : Math.min(Math.max(raw, 0.1), 10);
}

/**
 * Spawnt einen Gegner vom Typ 1–4 und benutzt den passenden Texture-Key.
 */
function spawnEnemy(xCoordinates, yCoordinates, enemyType) {
  const scene =
    this && this.sys ? this : window.currentScene || obstacles?.scene;
  if (!scene) {
    console.warn("[spawnEnemy] no scene");
    return null;
  }

  const margin = ENEMY_SPAWN_MARGIN;
  const worldBounds = scene.physics?.world?.bounds;
  const baseWidth = worldBounds?.width ?? 1200;
  const baseHeight = worldBounds?.height ?? 600;
  const baseLeft = worldBounds?.x ?? 0;
  const baseTop = worldBounds?.y ?? 0;
  const rawRight = baseLeft + baseWidth;
  const rawBottom = baseTop + baseHeight;

  const leftBound = rawRight - margin > baseLeft + margin ? baseLeft + margin : baseLeft + baseWidth / 2;
  const rightBound = rawRight - margin > baseLeft + margin ? rawRight - margin : baseLeft + baseWidth / 2;
  const topBound = rawBottom - margin > baseTop + margin ? baseTop + margin : baseTop + baseHeight / 2;
  const bottomBound = rawBottom - margin > baseTop + margin ? rawBottom - margin : baseTop + baseHeight / 2;

  const usableBounds = {
    left: baseLeft,
    right: rawRight,
    top: baseTop,
    bottom: rawBottom,
  };

  const clampX = (value) => Phaser.Math.Clamp(value, Math.min(leftBound, rightBound), Math.max(leftBound, rightBound));
  const clampY = (value) => Phaser.Math.Clamp(value, Math.min(topBound, bottomBound), Math.max(topBound, bottomBound));

  let x = randomIntBetween(leftBound, rightBound);
  let y = randomIntBetween(topBound, bottomBound);

  if (xCoordinates > 0 && yCoordinates > 0) {
    x = xCoordinates;
    y = yCoordinates;
  } else {
    const preferred = pickAccessibleSpawnPosition(scene, usableBounds, margin);
    if (preferred) {
      x = preferred.x;
      y = preferred.y;
    }
  }

  const ensureValidSpot = () => {
    if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) {
      return false;
    }
    if (isSpawnBlocked(x, y)) {
      return false;
    }
    if (player && player.active) {
      const minDistance = scene?._accessibleArea?.minSpawnDistance;
      if (minDistance && minDistance > 0) {
        const dx = x - player.x;
        const dy = y - player.y;
        if (dx * dx + dy * dy < minDistance * minDistance) {
          return false;
        }
      }
    }
    return true;
  };

  if (!ensureValidSpot()) {
    const retry = pickAccessibleSpawnPosition(scene, usableBounds, margin);
    if (retry) {
      x = retry.x;
      y = retry.y;
    }
  }

  const tryOffsets = [
    // Basis
    [0, 0],

    // 1 Tile Abstand (64px)
    [64, 0], [-64, 0], [0, 64], [0, -64],
    [64, 64], [64, -64], [-64, 64], [-64, -64],

    // 2 Tiles Abstand (128px)
    [128, 0], [-128, 0], [0, 128], [0, -128],
    [128, 128], [128, -128], [-128, 128], [-128, -128],

    // 3 Tiles Abstand (192px)
    [192, 0], [-192, 0], [0, 192], [0, -192],
    [192, 192], [192, -192], [-192, 192], [-192, -192],

    // 4 Tiles Abstand (256px)
    [256, 0], [-256, 0], [0, 256], [0, -256],
    [256, 256], [256, -256], [-256, 256], [-256, -256],
  ];

  // freie Position finden
  for (let k = 0; k < tryOffsets.length; k++) {
    const nx = clampX(x + tryOffsets[k][0]);
    const ny = clampY(y + tryOffsets[k][1]);

    if (scene.isPointAccessible && !scene.isPointAccessible(nx, ny)) {
      continue;
    }

    if (!isSpawnBlocked(nx, ny)) {
      x = nx;
      y = ny;   
      
      break;
    }
  }

  if (!ensureValidSpot()) {
    const fallback = pickAccessibleSpawnPosition(scene, usableBounds, margin);
    if (fallback) {
      x = fallback.x;
      y = fallback.y;
    }
  }
  
  // 2) Typ-Fallunterscheidung + Key, Speed, HP, Ranged-Flag
  // Determine available types based on current wave
  const wave = typeof currentWave === 'number' ? currentWave : 0;
  let type;
  if (typeof enemyType === 'number' && enemyType >= 1 && enemyType <= 7) {
    type = enemyType;
  } else {
    // Wave-based type selection
    let availableTypes;
    if (wave <= 2) {
      availableTypes = [1, 2]; // Imp, Archer
    } else if (wave <= 4) {
      availableTypes = [1, 2, 3, 4]; // + Brute, Mage
    } else if (wave <= 6) {
      availableTypes = [1, 2, 3, 4, 5]; // + Schattenschleicher
    } else {
      availableTypes = [1, 2, 3, 4, 5, 6, 7]; // + Kettenwächter, Flammenweber
    }
    type = availableTypes[Phaser.Math.Between(0, availableTypes.length - 1)];
  }

  let key,
    speed,
    hp,
    isRanged = false,
    tint,
    rangedAttackRange = null;

  // Helper: prefer loaded sprite, fall back to procedural texture
  const tex = (spriteKey, fallback) => scene.textures?.exists(spriteKey) ? spriteKey : fallback;

  switch (type) {
    case 1:
      key = tex('sprite_imp', 'enemyImp');
      speed = 80;
      hp = 1;
      tint = key === 'sprite_imp' ? null : 0xff0000;
      break; // Imp
    case 2:
      key = tex('sprite_archer', 'enemyArcher');
      speed = 140;
      hp = 1;
      isRanged = true;
      rangedAttackRange = 480;
      tint = key === 'sprite_archer' ? null : 0x00ff00;
      break; // Bogenschütze
    case 3:
      key = "brute_right0";
      speed = 50;
      hp = 3;
      tint = null;
      break; // Brute
    case 5:
      key = tex('sprite_shadow', 'enemyShadow');
      speed = 120;
      hp = 1;
      tint = key === 'sprite_shadow' ? null : 0x6600aa;
      break; // Schattenschleicher
    case 6:
      key = tex('sprite_chainguard', 'enemyChainGuard');
      speed = 40;
      hp = 5;
      tint = null;
      break; // Kettenwächter
    case 7:
      key = tex('sprite_flameweaver', 'enemyFlameWeaver');
      speed = 70;
      hp = 2;
      isRanged = true;
      rangedAttackRange = 400;
      tint = null;
      break; // Flammenweber
    default:
      key = tex('sprite_mage', 'enemyMage');
      speed = 60;
      hp = 2;
      isRanged = true;
      rangedAttackRange = 560;
      tint = 0xaa00ff;
      break; // Magier - lila
  }

  // 3) Sprite mit richtigem Key erzeugen
  const enemy = scene.physics.add.sprite(x, y, key);
  enemies.add(enemy);
  enemy.speed = speed;
  enemy.hp = hp;
  enemy.isRanged = isRanged;
  enemy.enemyType = type; // 1=Imp, 2=Archer, 3=Brute, 4=Mage
  enemy._originalTint = tint; // store for status effect visual reset
  enemy.rangedAttackRange = isRanged
    ? Math.max(120, rangedAttackRange || DEFAULT_RANGED_ATTACK_RANGE)
    : null;
  enemy.lastAttackTime = 0;
  enemy.setCollideWorldBounds(true); // verhindert das Rauslaufen
  enemy.body.onWorldBounds = true; // optional für blocked-Check
  if (enemy.body.setPushable) enemy.body.setPushable(false); // Spieler kann keine Gegner wegschieben

  if (scene.enemyLayer) scene.enemyLayer.add(enemy);

  // Maske einmalig pro Gegner setzen oder vormerken
  if (scene._enemyVisionMask && enemy.setMask) {
    enemy.setMask(scene._enemyVisionMask);
  } else {
    scene._needsMask = scene._needsMask || [];
    scene._needsMask.push(enemy);
  }

  // 3b) Scale sprite-based enemies to match game scale (~48-64px display)
  if (key.startsWith('sprite_')) {
    const targetSize = type === 6 ? 72 : 48; // chain guard bigger
    const srcW = enemy.width || 448;
    enemy.setScale(targetSize / srcW);
  }

  // 4) Tint anwenden (nur wenn vorhanden)
  if (tint !== null) {
    enemy.setTint(tint);
  }

  // 5) Schaden skaliert mit currentWave
  const waveIndex = Math.max(1, (Number.isFinite(currentWave) ? currentWave : 0) + 1);
  enemy.baseDamage = Math.max(1, 1 + Math.floor((waveIndex - 1) * 0.25));
  enemy.damage = enemy.baseDamage;

  // Store the enemy type for later reference
  enemy.enemyType = type;

  // 6) Steering-Parameter je Typ (für handleEnemies + Steering.js) ---
  if (type === 1) {
    // Imp (Nahkampf)
    enemy.sepWeight = 0.9;
    enemy.cohWeight = 0.25;
    enemy.avoidWeight = 1.0;
    enemy.sepRadius = 90;
    enemy.cohRadius = 220;
  } else if (type === 2) {
    // Archer (Fernkampf)
    enemy.kiteRadius = 220; // Zielabstand zum Spieler
    enemy.strafeSpeed = 80; // Seitwärtsbewegung
    enemy.strafeSign = Math.random() < 0.5 ? -1 : 1;
    enemy.sepWeight = 0.8;
    enemy.cohWeight = 0.35;
    enemy.avoidWeight = 1.2;
    enemy.sepRadius = 110;
    enemy.cohRadius = 260;
  } else if (type === 3) {
    // Brute (Panzer) - uses sprite-based animation
    enemy.speed = 70;
    enemy.sepWeight = 0.35;
    enemy.cohWeight = 0.15;
    enemy.avoidWeight = 0.6;
    enemy.sepRadius = 80;
    enemy.cohRadius = 160;
    // Scale down large sprites to fit game scale
    enemy.setScale(0.08);
    // Crop 2px from top to remove white stripe artifact at small scale
    const frame = enemy.frame;
    if (frame) enemy.setCrop(0, 2, frame.width, frame.height - 2);
    // Mark as brute for animation handling
    enemy.isBrute = true;
    enemy.bruteDirection = 'right';
    enemy.bruteAttacking = false;
    enemy.bruteAttackFrame = 0;
  } else if (type === 5) {
    // Schattenschleicher (Shadow Creeper) - fast melee, teleports when player is close
    enemy.sepWeight = 0.7;
    enemy.cohWeight = 0.1;
    enemy.avoidWeight = 1.2;
    enemy.sepRadius = 60;
    enemy.cohRadius = 180;
    enemy.isShadowCreeper = true;
    enemy.lastTeleportTime = 0;
    enemy.setScale(0.7); // smaller size
  } else if (type === 6) {
    // Kettenwächter (Chain Guard) - slow tank, has shield that blocks first hit
    enemy.sepWeight = 0.3;
    enemy.cohWeight = 0.15;
    enemy.avoidWeight = 0.5;
    enemy.sepRadius = 100;
    enemy.cohRadius = 200;
    enemy.isChainGuard = true;
    enemy.shieldActive = true; // blocks first hit, then breaks
    enemy.setScale(1.2); // large size
  } else if (type === 7) {
    // Flammenweber (Flame Weaver) - shoots 3-projectile spread
    enemy.kiteRadius = 240;
    enemy.strafeSpeed = 50;
    enemy.strafeSign = Math.random() < 0.5 ? -1 : 1;
    enemy.sepWeight = 0.8;
    enemy.cohWeight = 0.4;
    enemy.avoidWeight = 1.0;
    enemy.sepRadius = 100;
    enemy.cohRadius = 240;
    enemy.isFlameWeaver = true;
  } else {
    // Mage (Fern/Support)
    enemy.kiteRadius = 260;
    enemy.strafeSpeed = 60;
    enemy.strafeSign = Math.random() < 0.5 ? -1 : 1;
    enemy.sepWeight = 0.9;
    enemy.cohWeight = 0.5;
    enemy.avoidWeight = 1.1;
    enemy.sepRadius = 120;
    enemy.cohRadius = 280;
  }

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    enemy.hp = Math.max(1, Math.round(enemy.hp * difficulty));
    enemy.damage = Math.max(1, Math.round(enemy.baseDamage * difficulty));
  }

  // Elite chance: 15% starting from wave 5, ramping up from wave 3
  let eliteChance = 0;
  if (wave >= 5) {
    eliteChance = 0.15;
  } else if (wave >= 3) {
    eliteChance = 0.05;
  }

  if (Math.random() < eliteChance) {
    makeElite.call(this, enemy);
  }

  return enemy;
}

function handleEnemies(time, delta = 16) {
  const dt = delta / 1000;

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;

    if (enemy.isBoss) {
      handleBossAI.call(this, time, enemy, this);
      return; // boss handled, skip regular enemy logic
    }

    // Status effect: stunned enemies cannot move or attack
    if (window.statusEffectManager && window.statusEffectManager.isStunned(enemy)) {
      enemy.body.setVelocity(0, 0);
      return;
    }

    // Draw mini-boss health bar each frame
    if (enemy.isMiniBoss && enemy.miniBossBar) {
      drawMiniBossBar(enemy);
    }

    // Mini-boss ground slam AoE
    if (enemy.isMiniBoss && !enemy.isRanged) {
      if (!enemy.lastSlamTime || time - enemy.lastSlamTime > 4000) {
        const slamDist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
        if (slamDist <= 120) {
          enemy.lastSlamTime = time;
          miniBossSlam.call(this, enemy);
        }
      }
    }

    // Status effect: slow reduces max speed
    let speedMult = 1;
    if (window.statusEffectManager) {
      speedMult = window.statusEffectManager.getSpeedMultiplier(enemy);
    }

    const maxSpeed = (enemy.speed || 80) * speedMult;
    const stopDist = (enemy.body.width + player.body.width) / 1.5;
    const dToPlayer = Phaser.Math.Distance.Between(
      enemy.x,
      enemy.y,
      player.x,
      player.y,
    );

    // Schattenschleicher: teleport when player gets within 100px
    if (enemy.isShadowCreeper && dToPlayer < 100) {
      if (!enemy.lastTeleportTime || time - enemy.lastTeleportTime > 2000) {
        enemy.lastTeleportTime = time;
        // Teleport to a random offset 80-150px away from current position
        const teleAngle = Math.random() * Math.PI * 2;
        const teleDist = 80 + Math.random() * 70;
        const bounds = this.physics?.world?.bounds;
        let newX = enemy.x + Math.cos(teleAngle) * teleDist;
        let newY = enemy.y + Math.sin(teleAngle) * teleDist;
        if (bounds) {
          newX = Phaser.Math.Clamp(newX, bounds.x + 32, bounds.x + bounds.width - 32);
          newY = Phaser.Math.Clamp(newY, bounds.y + 32, bounds.y + bounds.height - 32);
        }
        enemy.setPosition(newX, newY);
        // Brief visual flash
        enemy.setAlpha(0.3);
        if (this.tweens) {
          this.tweens.add({ targets: enemy, alpha: 1, duration: 300 });
        }
      }
    }

    // Zielgeschwindigkeit
    let desired = new Phaser.Math.Vector2();

    if (enemy.isRanged) {
      // --- Fernkämpfer: Kiten + Strafen + LoS prüfen
      const kite = enemy.kiteRadius || 220;

      if (dToPlayer > kite + 30) {
        // zu weit weg -> näher ran (arrive für weiches Abbremsen)
        desired = Steering.arrive(enemy, player, maxSpeed, 160);
      } else if (dToPlayer < kite - 30) {
        // zu nah -> weg vom Spieler
        desired = new Phaser.Math.Vector2(
          enemy.x - player.x,
          enemy.y - player.y,
        );
        if (desired.lengthSq() > 0) desired.normalize().scale(maxSpeed);
      } else {
        // im Sweetspot -> seitwärts strafen
        const dir = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const side = (enemy.strafeSign || 1) * (enemy.strafeSpeed || 60);
        desired.add(
          new Phaser.Math.Vector2(
            Math.cos(dir + Math.PI / 2),
            Math.sin(dir + Math.PI / 2),
          ).scale(side),
        );
      }

      // Keine Sichtlinie? leicht seitlich „zappeln", um eine Schusslinie zu finden
      if (!Steering.hasLineOfSight(enemy, player, obstacles)) {
        desired.add(
          new Phaser.Math.Vector2(
            (Math.random() < 0.5 ? -1 : 1) * 80,
            (Math.random() < 0.5 ? -1 : 1) * 80,
          ),
        );
      }
    } else {
      // --- Melee: weit weg -> seek, nah -> arrive (weiches Abbremsen)
      const stopDist = (enemy.body.width + player.body.width) / 1.5;
      const dToPlayer = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        player.x,
        player.y,
      );

      if (dToPlayer > stopDist + 40) {
        desired = Steering.seek(enemy, player, maxSpeed);
      } else {
        // weich abbremsen, aber nicht komplett „einschlafen"
        desired = Steering.arrive(
          enemy,
          player,
          maxSpeed,
          Math.max(stopDist, 60),
        );

        // kleiner Vorwärts-Nudge, falls die Arrive-Geschwindigkeit zu klein wird
        if (dToPlayer > stopDist * 0.85) {
          const nudge = Steering.seek(enemy, player, Math.min(maxSpeed, 60));
          desired.add(nudge.scale(0.4));
        }
      }
    }

    // Repel-Faktor: nahe am Spieler weniger starke Abstoß-/Schwarmkräfte,
    // damit sie nicht „stecken bleiben"
    const baseFade = Phaser.Math.Clamp(dToPlayer / 220, 0, 1);
    const repelFade = enemy.isRanged ? baseFade : Math.max(baseFade, 0.35); // Nahkämpfer nie < 0.35 dämpfen

    // Zusatzkräfte: Hindernisvermeidung + Separation + Kohäsion
    desired.add(
      Steering.obstacleAvoidance(enemy, obstacles, 90).scale(
        (enemy.avoidWeight || 1.0) * repelFade,
      ),
    );

    const neigh = enemies.getChildren();
    desired.add(
      Steering.separation(
        enemy,
        neigh,
        enemy.sepRadius || 90,
        enemy.sepWeight || 0.8,
      ).scale(repelFade),
    );
    desired.add(
      Steering.cohesion(
        enemy,
        neigh,
        enemy.cohRadius || 220,
        enemy.cohWeight || 0.3,
      ).scale(repelFade * 0.8),
    );

    // Begrenzen & anwenden
    Steering.limit(desired, maxSpeed);
    enemy.body.setVelocity(desired.x, desired.y);

    // Brute sprite animation based on movement direction
    if (enemy.isBrute && !enemy.bruteAttacking) {
      const newDir = desired.x >= 0 ? 'right' : 'left';
      if (newDir !== enemy.bruteDirection) {
        enemy.bruteDirection = newDir;
        const idleKey = `brute_${newDir}0`;
        if (this.textures.exists(idleKey)) {
          enemy.setTexture(idleKey);
        }
      }
    }

    // --- Angriff / Schaden unverändert
    const attackCooldown = 1500;

    if (enemy.isRanged) {
      if (!enemy.lastShotTime || time - enemy.lastShotTime > 1500) {
        const maxRange = enemy.rangedAttackRange || DEFAULT_RANGED_ATTACK_RANGE;
        if (dToPlayer <= maxRange && Steering.hasLineOfSight(enemy, player, obstacles)) {
          if (enemy.isFlameWeaver) {
            // Flammenweber: shoot 3 projectiles in a spread pattern
            shootSpreadProjectiles.call(this, enemy, 3, Phaser.Math.DegToRad(30));
          } else {
            shootProjectile.call(this, enemy);
          }
          enemy.lastShotTime = time;
        }
      }
    } else {
      if (dToPlayer <= stopDist) {
        enemy.body.setVelocity(0);
        if (
          !enemy.lastAttackTime ||
          time - enemy.lastAttackTime > attackCooldown
        ) {
          enemy.lastAttackTime = time;

          // Brute attack animation (500ms total, 250ms per frame)
          if (enemy.isBrute) {
            enemy.bruteAttacking = true;
            const dir = enemy.bruteDirection || 'right';
            const scene = this;
            // Frame 1 of attack
            if (scene.textures.exists(`brute_${dir}1`)) {
              enemy.setTexture(`brute_${dir}1`);
            }
            // Frame 2 of attack after 250ms
            scene.time.delayedCall(250, () => {
              if (enemy && enemy.active && scene.textures.exists(`brute_${dir}2`)) {
                enemy.setTexture(`brute_${dir}2`);
              }
            });
            // Return to idle after 500ms
            scene.time.delayedCall(500, () => {
              if (enemy && enemy.active) {
                enemy.bruteAttacking = false;
                if (scene.textures.exists(`brute_${dir}0`)) {
                  enemy.setTexture(`brute_${dir}0`);
                }
              }
            });
          }

          // kurzzeitig physischen Block waehrend des Schlages aktivieren
          enemy._meleeCol = enemy._meleeCol || this.physics.add.collider(player, enemy);
          if (enemy._meleeCol) enemy._meleeCol.active = true;
          const prevImmov = enemy.body.immovable;
          if (enemy.body.setPushable) enemy.body.setPushable(false);
          enemy.setImmovable(true);
          this.time.delayedCall(220, () => {
            if (enemy && enemy.active) {
              if (enemy._meleeCol) enemy._meleeCol.active = false;
              enemy.setImmovable(prevImmov);
              if (enemy.body.setPushable) enemy.body.setPushable(false);
            }
          });

          // Schaden wie bisher
          applyPlayerDamage(enemy.damage, this);
          showEnemyMeleeEffect(this, enemy, player);

          // Brute melee: 30% chance to apply STUN on player
          if (enemy.isBrute && window.statusEffectManager && window.StatusEffectType && player) {
            if (Math.random() < 0.3) {
              window.statusEffectManager.applyEffect(player, window.StatusEffectType.STUN, 'brute');
            }
          }
        }
      }
    }
  }, this);
}

function shootProjectile(enemy) {
  const projectile = this.physics.add.sprite(
    enemy.x,
    enemy.y,
    "projectileTexture",
  );
  projectile.setDisplaySize(10, 10); // oder lass es in Originalgröße
  projectile.body.setCircle(5); // passend zur Form
  enemyProjectiles.add(projectile);
  this.physics.moveToObject(projectile, player, 200);
  const baseDamage = enemy.baseDamage || enemy.damage || 1;
  const projDifficulty = getDifficultyMultiplierValue();
  const scaledDamage = projDifficulty !== 1
    ? Math.max(1, Math.round(baseDamage * projDifficulty))
    : Math.max(1, Math.round(baseDamage));
  projectile.setData('baseDamage', baseDamage);
  projectile.setData('damage', scaledDamage);
  projectile.setData('enemyType', enemy.enemyType || 0);
  projectile.baseDamage = baseDamage;
  projectile.damage = scaledDamage;
  enemy.damage = scaledDamage;

  // Maske einmalig setzen oder vormerken
  if (this._enemyVisionMask && projectile.setMask) {
    projectile.setMask(this._enemyVisionMask);
  } else {
    this._needsMaskProj = this._needsMaskProj || [];
    this._needsMaskProj.push(projectile);
  }
}

// Flammenweber: shoot multiple projectiles in a spread pattern
function shootSpreadProjectiles(enemy, count, totalSpread) {
  const scene = this;
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const baseDamage = enemy.baseDamage || enemy.damage || 1;
  const projDifficulty = getDifficultyMultiplierValue();
  const scaledDamage = projDifficulty !== 1
    ? Math.max(1, Math.round(baseDamage * projDifficulty))
    : Math.max(1, Math.round(baseDamage));

  for (let i = 0; i < count; i++) {
    const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
    const ang = base + t * totalSpread;
    const proj = scene.physics.add.sprite(enemy.x, enemy.y, "projectileTexture");
    proj.setDisplaySize(10, 10);
    proj.body.setCircle(5);
    enemyProjectiles.add(proj);
    proj.setVelocity(Math.cos(ang) * 200, Math.sin(ang) * 200);
    proj.setData('baseDamage', baseDamage);
    proj.setData('damage', scaledDamage);
    proj.baseDamage = baseDamage;
    proj.damage = scaledDamage;

    if (scene._enemyVisionMask && proj.setMask) {
      proj.setMask(scene._enemyVisionMask);
    } else {
      scene._needsMaskProj = scene._needsMaskProj || [];
      scene._needsMaskProj.push(proj);
    }
  }
  enemy.damage = scaledDamage;
}

// Mini-Boss: ground slam AoE - damages player if within 120px
function miniBossSlam(enemy) {
  const scene = this;
  const r = 120;
  const g = scene.add.graphics().setDepth(1001);
  g.lineStyle(3, 0xff6600, 0.9);
  g.strokeCircle(enemy.x, enemy.y, r);
  g.fillStyle(0xff3300, 0.15);
  g.fillCircle(enemy.x, enemy.y, r);
  g.alpha = 0.0;

  scene.tweens.add({
    targets: g,
    alpha: { from: 0.0, to: 1.0 },
    duration: 300,
    yoyo: true,
    onYoyo: () => {
      const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
      if (d <= r + (player.body?.width || 0) * 0.5) {
        applyPlayerDamage(enemy.damage, scene);
      }
    },
    onComplete: () => g.destroy(),
  });

  // Camera shake for impact
  scene.cameras.main.shake(100, 0.003);
}

/**
 * Spawnt einen Mini-Boss: verstärkter Gegner mit HP-Balken und Spezialangriff.
 * Erscheint alle 5 Wellen (nicht die 10er-Boss-Wellen).
 */
function spawnMiniBoss(xCoord, yCoord, baseType) {
  const scene = this && this.sys ? this : window.currentScene || obstacles?.scene;
  if (!scene) return null;

  // Pick a valid base type for mini-boss (default to a melee type)
  const type = (typeof baseType === 'number' && baseType >= 1 && baseType <= 7) ? baseType : 3;
  const enemy = spawnEnemy.call(scene, xCoord || 0, yCoord || 0, type);
  if (!enemy) return null;

  // Mini-boss stats: 5x HP, 2x damage
  enemy.isMiniBoss = true;
  enemy.hp = Math.ceil(enemy.hp * 5);
  enemy.maxHp = enemy.hp;
  enemy.baseDamage = Math.ceil((enemy.baseDamage || enemy.damage || 1) * 2);
  enemy.damage = enemy.baseDamage;
  enemy.lastSlamTime = 0;

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    enemy.hp = Math.max(1, Math.round(enemy.hp * difficulty));
    enemy.damage = Math.max(1, Math.round(enemy.baseDamage * difficulty));
  }

  // Visual: slightly larger than regular enemy, capped at 64px display
  const maxDisplayPx = 64;
  const targetW = Math.min((enemy.displayWidth || 48) * 1.3, maxDisplayPx);
  enemy.setScale(targetW / (enemy.width || 64));
  enemy.setTint(0xff8800); // orange tint for mini-boss

  // Shimmer effect
  if (scene.tweens) {
    scene.tweens.add({
      targets: enemy,
      alpha: { from: 0.85, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  // Simple health bar (like boss but smaller)
  enemy.miniBossBar = scene.add.graphics().setDepth(1002);
  enemy.on('destroy', () => enemy.miniBossBar?.destroy());

  return enemy;
}

// Draw mini-boss health bar (called each frame)
function drawMiniBossBar(enemy) {
  const g = enemy.miniBossBar;
  if (!g) return;
  g.clear();

  const barW = 60;
  const barH = 5;
  const x = enemy.x - barW / 2;
  const y = enemy.y - enemy.displayHeight / 2 - 12;

  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - 1, y - 1, barW + 2, barH + 2);

  const pct = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
  g.fillStyle(0xff6600, 1);
  g.fillRect(x, y, barW * pct, barH);
}

function hitByMelee(playerSprite, enemy) {
  if (!enemy || !enemy.active) return;
  const now = Date.now();
  if (!enemy.lastAttackTime || now - enemy.lastAttackTime > 1000) {
    enemy.lastAttackTime = now;
    const difficulty = getDifficultyMultiplierValue();
    const baseDamage = enemy.baseDamage || enemy.damage || 1;
    const scaledDamage = difficulty !== 1
      ? Math.max(1, Math.round(baseDamage * difficulty))
      : Math.max(1, Math.round(baseDamage));
    enemy.damage = scaledDamage;
    applyPlayerDamage(scaledDamage, this);
    // Particle effects: player hit + screen shake
    if (window.particleFactory && playerSprite) {
      window.particleFactory.playerHit(playerSprite.x, playerSprite.y);
      window.particleFactory.screenShake(100, 0.005);
    }
  }
}

function hitByProjectile(player, projectile) {
  const stored = projectile?.getData?.('damage');
  const storedBase = projectile?.getData?.('baseDamage');
  const propDamage = projectile?.damage;
  const propBase = projectile?.baseDamage;
  const difficulty = getDifficultyMultiplierValue();

  let dmg;
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    dmg = Math.max(1, Math.round(stored));
  } else if (typeof propDamage === 'number' && Number.isFinite(propDamage)) {
    dmg = Math.max(1, Math.round(propDamage));
  } else {
    const baseDamage =
      typeof storedBase === 'number' && Number.isFinite(storedBase)
        ? storedBase
        : (typeof propBase === 'number' && Number.isFinite(propBase) ? propBase : null);
    if (typeof baseDamage === 'number' && Number.isFinite(baseDamage)) {
      dmg = difficulty !== 1
        ? Math.max(1, Math.round(baseDamage * difficulty))
        : Math.max(1, Math.round(baseDamage));
    } else {
      dmg = 1;
    }
  }

  // Apply status effects from enemy projectiles
  const projEnemyType = projectile?.getData?.('enemyType');
  projectile.destroy();
  applyPlayerDamage(dmg, this);
  // Particle effects: player hit by projectile + screen shake
  if (window.particleFactory && player) {
    window.particleFactory.playerHit(player.x, player.y);
    window.particleFactory.screenShake(100, 0.005);
  }

  if (window.statusEffectManager && window.StatusEffectType && player) {
    if (projEnemyType === 4) {
      // Mage projectiles apply SLOW
      window.statusEffectManager.applyEffect(player, window.StatusEffectType.SLOW, 'mage');
    } else if (projEnemyType === 2) {
      // Archer projectiles: 20% chance to apply BLEED
      if (Math.random() < 0.2) {
        window.statusEffectManager.applyEffect(player, window.StatusEffectType.BLEED, 'archer');
      }
    }
  }
}

// ---- einmalige Sicherstellung der Gegner-FX-Texturen
function ensureEnemyMeleeFXTextures(scene) {
  if (!scene.textures.exists("eSlashArc")) {
    const g = scene.add.graphics();
    g.clear();
    g.fillStyle(0xff6633, 0.18); // warmes Orange
    g.slice(
      64,
      64,
      56,
      Phaser.Math.DegToRad(-40),
      Phaser.Math.DegToRad(40),
      false,
    );
    g.fillPath();
    g.lineStyle(3, 0xffbb55, 0.9);
    g.arc(
      64,
      64,
      56,
      Phaser.Math.DegToRad(-40),
      Phaser.Math.DegToRad(40),
      false,
    );
    g.strokePath();
    g.generateTexture("eSlashArc", 128, 128);
    g.destroy();
  }
  if (!scene.textures.exists("eHitSpark")) {
    const s = scene.add.graphics();
    s.fillStyle(0xffe6a8, 1);
    s.fillCircle(6, 6, 6);
    s.generateTexture("eHitSpark", 12, 12);
    s.destroy();
  }
}

function applyPlayerDamage(rawDamage, scene) {
  // Blitzreflex (Lightning Reflex): if player has invincibility active, ignore damage
  if (window._playerInvincible) {
    return 0;
  }

  // Dodge check (using PLAYER_DODGE_CHANCE)
  const dodgeChance = window.PLAYER_DODGE_CHANCE || 0;
  if (dodgeChance > 0 && Math.random() < dodgeChance) {
    // Dodge successful
    if (scene && player) {
      player.setTint(0x88ccff);
      scene.time.delayedCall(200, () => {
        if (player && player.active && player.clearTint) player.clearTint();
      }, null, scene);
    }
    // Blitzreflex (Lightning Reflex): dodge triggers 0.5s invincibility
    if (typeof window.hasSkill === 'function' && window.hasSkill('mobility_lightning_reflex')) {
      window._playerInvincible = true;
      if (scene?.time) {
        scene.time.delayedCall(500, () => {
          window._playerInvincible = false;
        });
      } else {
        setTimeout(() => { window._playerInvincible = false; }, 500);
      }
    }
    return 0;
  }

  const armor = Phaser.Math.Clamp(playerArmor || 0, 0, 0.9);
  const mitigated = Math.max(1, Math.round(rawDamage * (1 - armor)));

  if (typeof addPlayerHealth === 'function') {
    addPlayerHealth(-mitigated);
  } else {
    playerHealth = Math.max(0, playerHealth - mitigated);
    if (typeof updateHUD === 'function') updateHUD();
  }

  if (window.soundManager) window.soundManager.playSFX('hit_player');

  if (scene && player) {
    player.setTint(0xff4444);
    scene.time.delayedCall(200, () => player.clearTint(), null, scene);
  }

  // Dornenrüstung (Thorn Armor): reflect 2 damage back to melee attackers
  if (typeof window.hasSkill === 'function' && window.hasSkill('survival_thorn_armor')) {
    if (enemies?.children) {
      let nearestEnemy = null;
      let nearestDist = 100; // only reflect to close melee range
      enemies.children.iterate((e) => {
        if (!e || !e.active) return;
        const edx = (e.x || 0) - (player.x || 0);
        const edy = (e.y || 0) - (player.y || 0);
        const dist = Math.hypot(edx, edy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = e;
        }
      });
      if (nearestEnemy && typeof nearestEnemy.hp === 'number') {
        nearestEnemy.hp -= 2;
        if (nearestEnemy.active && nearestEnemy.setTint && scene?.time) {
          nearestEnemy.setTint(0xff8844);
          scene.time.delayedCall(150, () => {
            if (nearestEnemy && nearestEnemy.active) nearestEnemy.clearTint();
          });
        }
        if (nearestEnemy.hp <= 0 && nearestEnemy.active && typeof handleEnemyHit === 'function') {
          handleEnemyHit(scene, nearestEnemy, { tint: 0xff8844, duration: 100 });
        }
      }
    }
  }

  if (playerHealth <= 0) {
    // Zweite Chance (Second Chance): revive once per dungeon run with 30% HP
    if (typeof window.hasSkill === 'function' && window.hasSkill('survival_second_chance')
        && !window._secondChanceUsed) {
      window._secondChanceUsed = true;
      const reviveHP = Math.max(1, Math.round(playerMaxHealth * 0.3));
      if (typeof setPlayerHealth === 'function') {
        setPlayerHealth(reviveHP);
      } else {
        playerHealth = reviveHP;
      }
      if (typeof updateHUD === 'function') updateHUD();
      if (player && player.active && player.setTint) {
        player.setTint(0xffffff);
        if (scene?.time) {
          scene.time.delayedCall(500, () => {
            if (player && player.active && player.clearTint) player.clearTint();
          });
        }
      }
      console.log('[Skills] Zweite Chance activated! Revived with', reviveHP, 'HP');
    } else {
      if (window.soundManager) {
        window.soundManager.playSFX('player_death');
        window.soundManager.stopMusic();
      }
      player.setTint(0xff0000);
      player.setVelocity(0);
      enemies.clear(true, true);
      if (gameOverText) {
        gameOverText.setText('DU BIST GESTORBEN\nZurück zur Stadt...');
        gameOverText.setVisible(true);
      }
      if (typeof handlePlayerDeath === 'function') {
        handlePlayerDeath(scene);
      }
    }
  }

  return mitigated;
}

// ---- reiner VISUELLER Effekt für Nahkampfangriff des Gegners (keine Hitbox)
function showEnemyMeleeEffect(scene, enemy, target) {
  ensureEnemyMeleeFXTextures(scene);

  // leichter Kamera-Impuls
  scene.cameras.main.shake(70, 0.0015);

  // Slash-Bogen an Gegnerposition, in Richtung Spieler
  const baseRad = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const baseDeg = Phaser.Math.RadToDeg(baseRad);

  const slash = scene.add
    .image(enemy.x, enemy.y, "eSlashArc")
    .setDepth(400)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.95)
    .setScale(Math.min((enemy.body?.width || 48) / 60, 1.2));

  const startDeg = baseDeg - 40;
  const endDeg = baseDeg + 40;

  scene.tweens.add({
    targets: { t: 0 },
    t: 1,
    duration: 140,
    ease: "Sine.InOut",
    onUpdate: (tw, obj) => {
      const ang = Phaser.Math.DegToRad(
        Phaser.Math.Linear(startDeg, endDeg, obj.t),
      );
      slash.x = enemy.x;
      slash.y = enemy.y;
      slash.setRotation(ang);
    },
    onComplete: () => slash.destroy(),
  });

  // kleiner Treffer-Funke am Spieler
  const spark = scene.add.image(target.x, target.y, "eHitSpark").setDepth(500);
  scene.time.delayedCall(100, () => spark.destroy());

}

function makeElite(enemy) {
  enemy.isElite = true;

  // Stats: 2x HP, 1.5x damage, 1.2x speed
  enemy.hp = Math.ceil(enemy.hp * 2);
  enemy.baseDamage = Math.ceil((enemy.baseDamage || enemy.damage || 1) * 1.5);
  enemy.damage = enemy.baseDamage;
  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    enemy.damage = Math.max(1, Math.round(enemy.baseDamage * difficulty));
  }
  enemy.speed = Math.round(enemy.speed * 1.2);

  // Optisch: 1.3x size, capped at 64px display
  const eliteTargetW = Math.min((enemy.displayWidth || 48) * 1.3, 64);
  enemy.setScale(eliteTargetW / (enemy.width || 64));

  // Goldener Glow / border durch Tint-Puls
  enemy.setTint(0xffe066); // gold
  enemy.scene.tweens.add({
    targets: enemy,
    alpha: { from: 0.8, to: 1 },
    duration: 500,
    yoyo: true,
    repeat: -1,
  });
}

// ===================================================================
// Boss Definitions: 3 unique bosses tied to Kettenrat lore
// ===================================================================
const BOSS_DEFINITIONS = {
  chainMaster: {
    id: 'chainMaster',
    name: 'Kettenmeister',
    texture: 'sprite_boss_chain',
    fallbackTexture: 'bossChainMaster',
    baseHP: 30,
    baseSpeed: 60,
    baseDamage: 4,
    scale: 1.6,
    loreIntro: 'Der Kettenmeister bewacht die ersten Siegel...',
    attacks: ['chainWhip', 'chainPull', 'groundChains'],
    attackCooldown: 3500,
  },
  ceremonyMaster: {
    id: 'ceremonyMaster',
    name: 'Zeremonienmeister',
    texture: 'sprite_boss_ceremony',
    fallbackTexture: 'bossCeremonyMaster',
    baseHP: 50,
    baseSpeed: 45,
    baseDamage: 6,
    scale: 1.7,
    loreIntro: 'Der Zeremonienmeister fuehrt die verbotenen Rituale durch...',
    attacks: ['ritualCircle', 'summonMinions', 'darkBlast'],
    attackCooldown: 4000,
  },
  shadowCouncillor: {
    id: 'shadowCouncillor',
    name: 'Schattenrat',
    texture: 'sprite_boss_shadow',
    fallbackTexture: 'bossShadowCouncillor',
    baseHP: 80,
    baseSpeed: 70,
    baseDamage: 8,
    scale: 1.8,
    loreIntro: 'Ein Mitglied des Kettenrats selbst tritt aus dem Schatten...',
    attacks: ['shadowDash', 'darknessWave', 'shadowClones'],
    attackCooldown: 3000,
  },
};

function getBossDefinition(wave) {
  const bossOrder = ['chainMaster', 'ceremonyMaster', 'shadowCouncillor'];
  const bossIndex = (Math.floor(wave / 10) - 1) % 3;
  const cycle = Math.floor((Math.floor(wave / 10) - 1) / 3);
  return { def: BOSS_DEFINITIONS[bossOrder[bossIndex]], cycle: cycle };
}

function spawnBoss() {
  const bounds = this.physics?.world?.bounds;
  const margin = 120;
  const px = player?.x ?? (bounds ? bounds.centerX : this.scale.width * 0.5);
  const py = player?.y ?? (bounds ? bounds.centerY : this.scale.height * 0.5);
  const jitterX = Phaser.Math.Between(-200, 200);
  const jitterY = Phaser.Math.Between(-140, 60);
  let x = px + jitterX;
  let y = py + jitterY;

  if (bounds) {
    x = Phaser.Math.Clamp(x, bounds.x + margin, bounds.x + bounds.width - margin);
    y = Phaser.Math.Clamp(y, bounds.y + margin, bounds.y + bounds.height - margin);
  } else {
    x = Phaser.Math.Clamp(x, margin, this.scale.width - margin);
    y = Phaser.Math.Clamp(y, margin, this.scale.height - margin);
  }

  const { def, cycle } = getBossDefinition(currentWave);
  const textureKey = this.textures?.exists(def.texture) ? def.texture
    : (def.fallbackTexture && this.textures?.exists(def.fallbackTexture)) ? def.fallbackTexture
    : 'enemyMage';

  const boss = enemies.create(x, y, textureKey);
  currentBoss = boss;

  // Scale sprite-based boss textures to game size
  if (textureKey.startsWith('sprite_')) {
    const targetSize = 96; // bosses are bigger
    const srcW = boss.width || 528;
    boss.setScale(targetSize / srcW);
  }

  makeBoss.call(this, boss, def, cycle);

  // Boss arena effects: screen flash + camera shake
  if (this.cameras?.main) {
    this.cameras.main.flash(300, 255, 255, 255, true);
    this.cameras.main.shake(400, 0.01);
  }

  // Boss intro lore text
  showBossIntro.call(this, def);
}

function showBossIntro(def) {
  const scene = this;
  const cx = scene.scale.width / 2;
  const cy = scene.scale.height * 0.25;

  const nameText = scene.add.text(cx, cy - 20, def.name, {
    fontSize: '28px',
    fontFamily: 'monospace',
    color: '#ff4444',
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center',
  }).setOrigin(0.5).setDepth(1100).setScrollFactor(0);

  const loreText = scene.add.text(cx, cy + 16, def.loreIntro, {
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#dddddd',
    stroke: '#000000',
    strokeThickness: 3,
    align: 'center',
  }).setOrigin(0.5).setDepth(1100).setScrollFactor(0);

  nameText.setAlpha(0);
  loreText.setAlpha(0);

  scene.tweens.add({
    targets: [nameText, loreText],
    alpha: 1,
    duration: 500,
    onComplete: () => {
      scene.time.delayedCall(2500, () => {
        scene.tweens.add({
          targets: [nameText, loreText],
          alpha: 0,
          duration: 500,
          onComplete: () => { nameText.destroy(); loreText.destroy(); },
        });
      });
    },
  });
}

function makeBoss(boss, def, cycle) {
  boss.isBoss = true;
  boss.bossType = def.id;
  boss.bossName = def.name;

  // Scale stats with cycle (+50% HP, +25% damage per cycle beyond first)
  const hpMult = 1 + cycle * 0.5;
  const dmgMult = 1 + cycle * 0.25;

  boss.hp = Math.ceil(def.baseHP * hpMult);
  boss.damage = Math.ceil(def.baseDamage * dmgMult);
  boss.speed = def.baseSpeed;
  boss.isRanged = false;
  boss.baseDamage = boss.damage;

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    boss.hp = Math.max(1, Math.round(boss.hp * difficulty));
    boss.damage = Math.max(1, Math.round(boss.baseDamage * difficulty));
  }

  // Scale boss: use def.scale for procedural textures, cap for sprite textures
  const bossKey = boss.texture?.key || '';
  if (bossKey.startsWith('sprite_')) {
    // Sprite-based: target ~96px display
    const bossTargetPx = 96;
    boss.setScale(bossTargetPx / (boss.width || 528));
  } else {
    // Procedural texture: use def.scale directly
    boss.setScale(def.scale);
  }
  boss.setCollideWorldBounds(true);

  // Shimmer
  this.tweens.add({
    targets: boss,
    alpha: { from: 0.85, to: 1 },
    duration: 450,
    yoyo: true,
    repeat: -1,
  });

  // Health bar
  boss.bossBar = this.add.graphics().setDepth(1002);
  boss.on('destroy', () => {
    boss.bossBar?.destroy();
    if (boss._shadowClones) {
      boss._shadowClones.forEach(c => { if (c && c.active) c.destroy(); });
    }
  });

  boss.maxHp = boss.hp;

  // Attack cycle state
  boss.nextPatternAt = 0;
  boss.patternIndex = 0;
  boss.bossAttacks = def.attacks;
  boss.attackCooldown = def.attackCooldown;
}

function handleBossAI(time, boss, scene) {
  if (!boss.active) return;

  // Follow player
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const d = Math.hypot(dx, dy);

  const slowRadius = 180;
  const desiredSpeed = d < slowRadius ? boss.speed * (d / slowRadius) : boss.speed;
  const ux = d ? dx / d : 0;
  const uy = d ? dy / d : 0;
  boss.body.setVelocity(ux * desiredSpeed, uy * desiredSpeed);

  // Pattern timing
  if (time >= boss.nextPatternAt) {
    const attacks = boss.bossAttacks || ['chainWhip', 'chainPull', 'groundChains'];
    const p = boss.patternIndex % attacks.length;
    const attackName = attacks[p];

    if (BOSS_ATTACK_MAP[attackName]) {
      BOSS_ATTACK_MAP[attackName].call(scene, boss);
    }

    boss.patternIndex++;
    boss.nextPatternAt = time + (boss.attackCooldown || 3500);
  }

  drawBossBar.call(scene, boss);
}

function drawBossBar(boss) {
  const g = boss.bossBar;
  if (!g) return;
  g.clear();

  const barW = 140;
  const barH = 10;
  const x = boss.x - barW / 2;
  const y = boss.y - boss.displayHeight / 2 - 22;

  // Frame
  g.fillStyle(0x000000, 0.7);
  g.fillRect(x - 1, y - 1, barW + 2, barH + 2);

  // HP fill color varies by boss type
  const pct = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
  let barColor = 0xff2d2d;
  if (boss.bossType === 'chainMaster') barColor = 0xaaaaaa;
  else if (boss.bossType === 'ceremonyMaster') barColor = 0xaa00aa;
  else if (boss.bossType === 'shadowCouncillor') barColor = 0xff0000;
  g.fillStyle(barColor, 1);
  g.fillRect(x, y, barW * pct, barH);
}

/* ========== Boss Attack Implementations ========== */

// Helper: fire a projectile from boss
function bossFireProjectile(scene, boss, angle, speed, size, tint, damageOverride) {
  const proj = scene.physics.add.sprite(boss.x, boss.y, 'projectileTexture');
  proj.setDisplaySize(size, size);
  proj.body.setCircle(size / 2);
  if (tint !== undefined) proj.setTint(tint);
  enemyProjectiles.add(proj);
  proj.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

  const dmg = damageOverride || boss.damage || 1;
  proj.setData('baseDamage', dmg);
  proj.setData('damage', dmg);
  proj.baseDamage = dmg;
  proj.damage = dmg;

  if (scene._enemyVisionMask && proj.setMask) {
    proj.setMask(scene._enemyVisionMask);
  } else {
    scene._needsMaskProj = scene._needsMaskProj || [];
    scene._needsMaskProj.push(proj);
  }
  return proj;
}

// ---------- Kettenmeister Attacks ----------

// Chain Whip: long range line attack toward player
function bossChainWhip(boss) {
  const scene = this;
  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const range = 280;

  // Telegraph: draw line
  const warn = scene.add.graphics().setDepth(1001);
  warn.lineStyle(4, 0xcccccc, 0.6);
  warn.beginPath();
  warn.moveTo(boss.x, boss.y);
  warn.lineTo(boss.x + Math.cos(angle) * range, boss.y + Math.sin(angle) * range);
  warn.strokePath();

  scene.time.delayedCall(350, () => {
    warn.destroy();
    if (!boss.active) return;

    // Damage line visual
    const hitG = scene.add.graphics().setDepth(1001);
    hitG.lineStyle(6, 0xeeeeee, 1);
    hitG.beginPath();
    hitG.moveTo(boss.x, boss.y);
    hitG.lineTo(boss.x + Math.cos(angle) * range, boss.y + Math.sin(angle) * range);
    hitG.strokePath();
    scene.time.delayedCall(150, () => hitG.destroy());

    // Check if player is near the line
    const lx = boss.x + Math.cos(angle) * range;
    const ly = boss.y + Math.sin(angle) * range;
    const distToPlayer = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
    if (distToPlayer <= range + 20) {
      const cross = Math.abs((lx - boss.x) * (boss.y - player.y) - (boss.x - player.x) * (ly - boss.y));
      const lineLen = Math.hypot(lx - boss.x, ly - boss.y);
      const perpDist = lineLen > 0 ? cross / lineLen : 999;
      if (perpDist <= 30) {
        applyPlayerDamage(boss.damage, scene);
      }
    }
  });
}

// Chain Pull: pulls player toward boss briefly
function bossChainPull(boss) {
  const scene = this;
  const d = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);

  const warn = scene.add.graphics().setDepth(1001);
  warn.lineStyle(3, 0xcccccc, 0.7);
  warn.strokeCircle(player.x, player.y, 40);

  scene.time.delayedCall(400, () => {
    warn.destroy();
    if (!boss.active || !player.active) return;

    const pullAngle = Math.atan2(boss.y - player.y, boss.x - player.x);
    const pullStrength = 300;
    if (player.body) {
      player.body.setVelocity(
        Math.cos(pullAngle) * pullStrength,
        Math.sin(pullAngle) * pullStrength
      );
    }

    const chainG = scene.add.graphics().setDepth(1001);
    chainG.lineStyle(3, 0xaaaaaa, 0.8);
    chainG.beginPath();
    chainG.moveTo(boss.x, boss.y);
    chainG.lineTo(player.x, player.y);
    chainG.strokePath();
    scene.time.delayedCall(300, () => chainG.destroy());

    if (d < 400) {
      applyPlayerDamage(Math.ceil(boss.damage * 0.5), scene);
    }
  });
}

// Ground Chains: AoE zones that slow
function bossGroundChains(boss) {
  const scene = this;
  const numZones = 3;

  for (let i = 0; i < numZones; i++) {
    const zx = player.x + Phaser.Math.Between(-100, 100);
    const zy = player.y + Phaser.Math.Between(-100, 100);
    const radius = 60;

    const zone = scene.add.graphics().setDepth(1000);
    zone.lineStyle(2, 0x888888, 0.5);
    zone.strokeCircle(zx, zy, radius);
    zone.fillStyle(0x666666, 0.15);
    zone.fillCircle(zx, zy, radius);

    scene.time.delayedCall(500, () => {
      if (!boss.active) { zone.destroy(); return; }

      zone.clear();
      zone.lineStyle(2, 0xcccccc, 0.8);
      zone.strokeCircle(zx, zy, radius);
      zone.fillStyle(0x999999, 0.25);
      zone.fillCircle(zx, zy, radius);

      let ticks = 0;
      const maxTicks = 6;
      scene.time.addEvent({
        delay: 500,
        repeat: maxTicks - 1,
        callback: () => {
          ticks++;
          const dToPlayer = Phaser.Math.Distance.Between(zx, zy, player.x, player.y);
          if (dToPlayer <= radius) {
            if (player.body) player.body.velocity.scale(0.5);
            if (ticks === 1) applyPlayerDamage(Math.ceil(boss.damage * 0.3), scene);
          }
          if (ticks >= maxTicks) zone.destroy();
        },
      });

      scene.time.delayedCall(maxTicks * 500 + 100, () => zone.destroy());
    });
  }
}

// ---------- Zeremonienmeister Attacks ----------

// Ritual Circle: AoE damage zone centered on player position
function bossRitualCircle(boss) {
  const scene = this;
  const tx = player.x;
  const ty = player.y;
  const radius = 100;

  const circle = scene.add.graphics().setDepth(1001);
  circle.lineStyle(3, 0xff0066, 0.5);
  circle.strokeCircle(tx, ty, radius);
  circle.fillStyle(0x660033, 0.2);
  circle.fillCircle(tx, ty, radius);
  circle.lineStyle(1, 0xff0066, 0.4);
  circle.strokeCircle(tx, ty, radius * 0.5);

  scene.tweens.add({
    targets: circle,
    alpha: { from: 0.3, to: 1.0 },
    duration: 800,
    onComplete: () => {
      if (!boss.active) { circle.destroy(); return; }

      circle.clear();
      circle.fillStyle(0xff0066, 0.6);
      circle.fillCircle(tx, ty, radius);

      const d = Phaser.Math.Distance.Between(tx, ty, player.x, player.y);
      if (d <= radius) applyPlayerDamage(boss.damage, scene);

      scene.tweens.add({
        targets: circle,
        alpha: 0,
        duration: 400,
        onComplete: () => circle.destroy(),
      });
    },
  });
}

// Summon Minions: spawn 2 imp enemies
function bossSummonMinions(boss) {
  const scene = this;

  const warn = scene.add.graphics().setDepth(1001);
  warn.fillStyle(0xaa00aa, 0.3);
  warn.fillCircle(boss.x, boss.y, 50);
  scene.time.delayedCall(300, () => warn.destroy());

  scene.time.delayedCall(500, () => {
    if (!boss.active) return;
    for (let i = 0; i < 2; i++) {
      const mx = boss.x + Phaser.Math.Between(-80, 80);
      const my = boss.y + Phaser.Math.Between(-80, 80);
      const minion = spawnEnemy.call(scene, mx, my, 1);
      if (minion) {
        minion.hp = 1;
        minion.setTint(0xaa00aa);
      }
    }
  });
}

// Dark Blast: 3-way projectile spread
function bossDarkBlast(boss) {
  const scene = this;
  const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const spreadAngle = Phaser.Math.DegToRad(25);

  const warn = scene.add.graphics().setDepth(1001);
  warn.lineStyle(2, 0xff0066, 0.6);
  for (let i = -1; i <= 1; i++) {
    const a = baseAngle + i * spreadAngle;
    warn.beginPath();
    warn.moveTo(boss.x, boss.y);
    warn.lineTo(boss.x + Math.cos(a) * 80, boss.y + Math.sin(a) * 80);
    warn.strokePath();
  }
  scene.time.delayedCall(250, () => warn.destroy());

  scene.time.delayedCall(300, () => {
    if (!boss.active) return;
    for (let i = -1; i <= 1; i++) {
      const a = baseAngle + i * spreadAngle;
      bossFireProjectile(scene, boss, a, 200, 12, 0xff0066);
    }
  });
}

// ---------- Schattenrat Attacks ----------

// Shadow Dash: teleport near player + damage burst
function bossShadowDash(boss) {
  const scene = this;
  boss.setAlpha(0.3);

  scene.time.delayedCall(300, () => {
    if (!boss.active) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    let newX = player.x + Math.cos(angle) * dist;
    let newY = player.y + Math.sin(angle) * dist;

    const bounds = scene.physics?.world?.bounds;
    if (bounds) {
      newX = Phaser.Math.Clamp(newX, bounds.x + 40, bounds.x + bounds.width - 40);
      newY = Phaser.Math.Clamp(newY, bounds.y + 40, bounds.y + bounds.height - 40);
    }

    boss.setPosition(newX, newY);
    boss.setAlpha(1);

    const burstG = scene.add.graphics().setDepth(1001);
    burstG.fillStyle(0xff0000, 0.4);
    burstG.fillCircle(newX, newY, 50);
    scene.time.delayedCall(200, () => burstG.destroy());

    const d = Phaser.Math.Distance.Between(newX, newY, player.x, player.y);
    if (d <= 60) applyPlayerDamage(boss.damage, scene);
  });
}

// Darkness Wave: screen-wide damage, reduced by distance
function bossDarknessWave(boss) {
  const scene = this;

  const overlay = scene.add.graphics().setDepth(1050);
  overlay.fillStyle(0x000000, 0.0);
  overlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
  overlay.setScrollFactor(0);

  scene.tweens.add({
    targets: overlay,
    alpha: { from: 0.0, to: 0.6 },
    duration: 800,
    onComplete: () => {
      if (!boss.active) { overlay.destroy(); return; }

      const waveG = scene.add.graphics().setDepth(1001);
      waveG.lineStyle(4, 0xff0000, 0.8);
      waveG.strokeCircle(boss.x, boss.y, 40);

      let radius = 40;
      scene.time.addEvent({
        delay: 50,
        repeat: 15,
        callback: () => {
          radius += 30;
          waveG.clear();
          waveG.lineStyle(4, 0xff0000, Math.max(0, 0.8 - radius / 600));
          waveG.strokeCircle(boss.x, boss.y, radius);
        },
      });
      scene.time.delayedCall(800, () => waveG.destroy());

      const d = Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y);
      const maxRange = 500;
      if (d < maxRange) {
        const damageFactor = 1 - (d / maxRange);
        const dmg = Math.max(1, Math.ceil(boss.damage * damageFactor));
        applyPlayerDamage(dmg, scene);
      }

      scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 400,
        onComplete: () => overlay.destroy(),
      });
    },
  });
}

// Shadow Clones: spawn 2 decoy copies with 1 HP
function bossShadowClones(boss) {
  const scene = this;

  boss.setAlpha(0.4);
  scene.time.delayedCall(200, () => { if (boss.active) boss.setAlpha(1); });

  scene.time.delayedCall(400, () => {
    if (!boss.active) return;

    if (boss._shadowClones) {
      boss._shadowClones.forEach(c => { if (c && c.active) c.destroy(); });
    }
    boss._shadowClones = [];

    for (let i = 0; i < 2; i++) {
      const angle = (Math.PI * 2 / 3) * (i + 1);
      const dist = 80;
      let cx = boss.x + Math.cos(angle) * dist;
      let cy = boss.y + Math.sin(angle) * dist;

      const bounds = scene.physics?.world?.bounds;
      if (bounds) {
        cx = Phaser.Math.Clamp(cx, bounds.x + 30, bounds.x + bounds.width - 30);
        cy = Phaser.Math.Clamp(cy, bounds.y + 30, bounds.y + bounds.height - 30);
      }

      const textureKey = scene.textures?.exists('bossShadowCouncillor') ? 'bossShadowCouncillor' : 'enemyMage';
      const clone = enemies.create(cx, cy, textureKey);
      clone.hp = 1;
      clone.maxHp = 1;
      clone.damage = Math.ceil(boss.damage * 0.3);
      clone.baseDamage = clone.damage;
      clone.speed = boss.speed * 0.8;
      clone.isBoss = false;
      clone.isShadowClone = true;
      clone.setScale(boss.scaleX * 0.8);
      clone.setAlpha(0.6);
      clone.setCollideWorldBounds(true);
      if (clone.body?.setPushable) clone.body.setPushable(false);

      if (scene._enemyVisionMask && clone.setMask) {
        clone.setMask(scene._enemyVisionMask);
      }

      boss._shadowClones.push(clone);
    }
  });
}

// Attack name -> function map
const BOSS_ATTACK_MAP = {
  chainWhip: bossChainWhip,
  chainPull: bossChainPull,
  groundChains: bossGroundChains,
  ritualCircle: bossRitualCircle,
  summonMinions: bossSummonMinions,
  darkBlast: bossDarkBlast,
  shadowDash: bossShadowDash,
  darknessWave: bossDarknessWave,
  shadowClones: bossShadowClones,
};
