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

  switch (type) {
    case 1:
      key = "enemyImp";
      speed = 80;
      hp = 1;
      tint = 0xff0000;
      break; // Imp - rot
    case 2:
      key = "enemyArcher";
      speed = 140;
      hp = 1;
      isRanged = true;
      rangedAttackRange = 480;
      tint = 0x00ff00;
      break; // Bogenschütze - grün
    case 3:
      key = "brute_right0";
      speed = 50;
      hp = 3;
      tint = null; // no tint for sprite-based brute
      break; // Brute
    case 5:
      key = "enemyShadow";
      speed = 120;
      hp = 1;
      tint = 0x6600aa;
      break; // Schattenschleicher - dark purple
    case 6:
      key = "enemyChainGuard";
      speed = 40;
      hp = 5;
      tint = null; // texture already gray
      break; // Kettenwächter
    case 7:
      key = "enemyFlameWeaver";
      speed = 70;
      hp = 2;
      isRanged = true;
      rangedAttackRange = 400;
      tint = null; // texture already orange/red
      break; // Flammenweber
    default:
      key = "enemyMage";
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

      // Keine Sichtlinie? leicht seitlich „zappeln“, um eine Schusslinie zu finden
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
        // weich abbremsen, aber nicht komplett „einschlafen“
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
    // damit sie nicht „stecken bleiben“
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

  // Visual: larger, striped tint pattern
  const currentScale = enemy.scaleX || 1;
  enemy.setScale(currentScale * 1.5);
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

  // Optisch: 1.3x size
  const currentScale = enemy.scaleX || 1;
  enemy.setScale(currentScale * 1.3);

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

  // Reuse one of your enemy textures (e.g., Mage) for the boss
  const boss = enemies.create(x, y, "enemyMage");
  currentBoss = boss;

  makeBoss.call(this, boss);
}

function makeBoss(boss) {
  boss.isBoss = true;

  // Stats scale with wave
  const w = Math.max(1, currentWave);
  boss.hp = 20 + Math.floor(w * 4); // chunky health
  boss.damage = 2 + Math.floor((w - 1) * 0.5); // hurts more
  boss.speed = 70 + Math.floor(w * 1.5);
  boss.isRanged = false; // mixed kit, but moves in
  boss.baseDamage = boss.damage;

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    boss.hp = Math.max(1, Math.round(boss.hp * difficulty));
    boss.damage = Math.max(1, Math.round(boss.baseDamage * difficulty));
  }

  boss.setScale(1.8);
  boss.setTint(0xffe066); // gold tint
  boss.setCollideWorldBounds(true);

  // Shimmer (tight glow feel)
  this.tweens.add({
    targets: boss,
    alpha: { from: 0.85, to: 1 },
    duration: 450,
    yoyo: true,
    repeat: -1,
  });

  // Simple health bar
  boss.bossBar = this.add.graphics().setDepth(1002);
  boss.on("destroy", () => boss.bossBar?.destroy());

  boss.maxHp = boss.hp;

  // Attack cycle state
  boss.nextPatternAt = 0;
  boss.patternIndex = 0; // 0: CHARGE, 1: SLAM, 2: VOLLEY
}

function handleBossAI(time, boss, scene) {
  if (!boss.active) return;

  // Follow player, don’t hug too tight
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const d = Math.hypot(dx, dy);

  // Slight arrive-style drift toward player
  const slowRadius = 180;
  const desiredSpeed =
    d < slowRadius ? boss.speed * (d / slowRadius) : boss.speed;
  const ux = d ? dx / d : 0,
    uy = d ? dy / d : 0;
  boss.body.setVelocity(ux * desiredSpeed, uy * desiredSpeed);

  // Pattern timing
  if (time >= boss.nextPatternAt) {
    // rotate patterns
    const p = boss.patternIndex % 3;
    if (p === 0) bossCharge.call(scene, boss);
    else if (p === 1) bossSlam.call(scene, boss);
    else bossVolley.call(scene, boss);

    boss.patternIndex++;
    boss.nextPatternAt = time + 2200; // cooldown between patterns
  }

  // Update boss HP bar to follow + reflect HP
  drawBossBar.call(scene, boss);
}

function drawBossBar(boss) {
  const g = boss.bossBar;
  if (!g) return;
  g.clear();

  const barW = 120;
  const barH = 8;
  const x = boss.x - barW / 2;
  const y = boss.y - boss.displayHeight / 2 - 18;

  // Frame
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - 1, y - 1, barW + 2, barH + 2);

  // HP
  const pct = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
  g.fillStyle(0xff2d2d, 1);
  g.fillRect(x, y, barW * pct, barH);
}

/* ========== Boss Patterns ========== */

// 1) CHARGE: kurzer Telegraph, dann schneller Dash zum Spieler
function bossCharge(boss) {
  const scene = this;
  // Telegraph
  const warn = scene.add.graphics().setDepth(1001);
  warn.lineStyle(3, 0xffe066, 0.9);
  warn.strokeCircle(boss.x, boss.y, 34);
  scene.time.delayedCall(200, () => warn.destroy());

  // Dash
  const dir = Math.atan2(player.y - boss.y, player.x - boss.x);
  const dashV = 380;
  boss.body.setVelocity(Math.cos(dir) * dashV, Math.sin(dir) * dashV);

  // Hit check after 180ms window
  scene.time.delayedCall(180, () => {
    const touch =
      Phaser.Math.Distance.Between(boss.x, boss.y, player.x, player.y) <=
      (boss.body.width + player.body.width) / 2 + 8;
    if (touch && playerHealth > 0) {
      applyPlayerDamage(boss.damage, scene);
    }
  });
}

// 2) SLAM: großer AoE-Kreis, klar telegraphiert
function bossSlam(boss) {
  const scene = this;
  const r = 120;
  const g = scene.add.graphics().setDepth(1001);
  g.lineStyle(2, 0xffe066, 0.9);
  g.strokeCircle(boss.x, boss.y, r);
  g.alpha = 0.0;

  scene.tweens.add({
    targets: g,
    alpha: { from: 0.0, to: 1.0 },
    duration: 250,
    yoyo: true,
    onYoyo: () => {
      // Damage when it "slams"
      const d = Phaser.Math.Distance.Between(
        boss.x,
        boss.y,
        player.x,
        player.y,
      );
      if (d <= r + player.body.width * 0.5) {
        applyPlayerDamage(boss.damage, scene);
      }
    },
    onComplete: () => g.destroy(),
  });
}

// 3) VOLLEY: mehrere Projektile in Fächerform
function bossVolley(boss) {
  const scene = this;
  const base = Math.atan2(player.y - boss.y, player.x - boss.x);
  const spread = Phaser.Math.DegToRad(40);
  const count = 7;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1) - 0.5; // -0.5..0.5
    const ang = base + t * spread;
    const proj = scene.physics.add.sprite(boss.x, boss.y, "projectileTexture");
    proj.setDisplaySize(10, 10);
    proj.body.setCircle(5);
    enemyProjectiles.add(proj);
    proj.setVelocity(Math.cos(ang) * 220, Math.sin(ang) * 220);
    const baseDamage = boss.baseDamage || boss.damage || 1;
    const volleyDifficulty = getDifficultyMultiplierValue();
    const volleyDamage = volleyDifficulty !== 1
      ? Math.max(1, Math.round(baseDamage * volleyDifficulty))
      : Math.max(1, Math.round(baseDamage));
    proj.setData('baseDamage', baseDamage);
    proj.setData('damage', volleyDamage);
    proj.baseDamage = baseDamage;
    proj.damage = volleyDamage;
    boss.damage = volleyDamage;

    if (scene._enemyVisionMask && proj.setMask) {
      proj.setMask(scene._enemyVisionMask);
    } else {
      scene._needsMaskProj = scene._needsMaskProj || [];
      scene._needsMaskProj.push(proj);
    }
  }
}
