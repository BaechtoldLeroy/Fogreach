// enemy.js

// Resilienz: js/ai/steering.js lädt normal VOR enemy.js und setzt window.Steering.
// Wenn dieser Load fehlschlägt (transientes 503 von Pages, Tracking-Prevention,
// Adblock …), war der Steering-Global weg -> handleEnemies warf jeden Frame
// "Steering is not defined" und der Dungeon war unspielbar. Fallback-Shim: echte
// seek/arrive-Zusteuerung (Gegner jagen weiter den Spieler), Flocking/Avoidance
// degradieren zu No-Ops. Nur aktiv, wenn das echte Steering fehlt.
if (typeof window !== 'undefined' && !window.Steering && typeof Phaser !== 'undefined') {
  const _sv = (x = 0, y = 0) => new Phaser.Math.Vector2(x, y);
  window.Steering = {
    v: _sv,
    limit: (vec, max) => { if (vec.lengthSq() > max * max) vec.setLength(max); return vec; },
    seek: (from, to, maxSpeed) => _sv(to.x - from.x, to.y - from.y).normalize().scale(maxSpeed),
    arrive: (from, to, maxSpeed, arriveRadius = 120) => {
      const d = _sv(to.x - from.x, to.y - from.y);
      const dist = d.length();
      if (dist === 0) return _sv();
      const t = Phaser.Math.Clamp(dist / arriveRadius, 0, 1);
      return d.scale((t * maxSpeed) / dist);
    },
    separation: () => _sv(),
    cohesion: () => _sv(),
    obstacleAvoidance: () => _sv(),
    hasLineOfSight: () => true
  };
  try { console.warn('[enemy] Steering-Fallback aktiv — js/ai/steering.js nicht geladen'); } catch (e) {}
}

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

function pickAccessibleSpawnPosition(scene, boundsRect, margin, maxAttempts = 6, minDistFromPlayer = 0) {
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

  const minDistSq = minDistFromPlayer * minDistFromPlayer;
  const isFarEnough = (cx, cy) => {
    if (minDistSq <= 0 || !player || !player.active) return true;
    const dx = cx - player.x;
    const dy = cy - player.y;
    return dx * dx + dy * dy >= minDistSq;
  };

  const clampCandidate = (cx, cy, requireDistance = true) => {
    const x = Phaser.Math.Clamp(cx, left, right);
    const y = Phaser.Math.Clamp(cy, top, bottom);
    if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) return null;
    if (isSpawnBlocked(x, y)) return null;
    if (requireDistance && !isFarEnough(x, y)) return null;
    return { x, y };
  };

  // Increase attempts when a min-distance is required so we have more chances
  // to find a tile that's both accessible AND far enough from the player.
  const baseAttempts = Math.max(1, maxAttempts);
  const attempts = minDistFromPlayer > 0 ? baseAttempts * 4 : baseAttempts;

  // Wave-aware spreading (C): snapshot the already-spawned enemies of the
  // current wave (each is added to the `enemies` group before the next
  // spawnEnemy runs) so a new spawn can prefer a spot away from the REST of the
  // wave, not just the player. Without this, enemies bunched into one region.
  const existing = [];
  try {
    if (typeof enemies !== 'undefined' && enemies && typeof enemies.getChildren === 'function') {
      const arr = enemies.getChildren();
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        if (e && e.active) existing.push({ x: e.x, y: e.y });
      }
    }
  } catch (_) { /* group not ready — fall back to player-only spacing */ }

  // Spread score = squared distance to the NEAREST of {player, existing enemies}.
  // Higher = better separated. We keep the best-scoring candidate and early-exit
  // as soon as one is "good enough" so open rooms stay cheap.
  const spreadScoreSq = (cx, cy) => {
    let m = Infinity;
    if (player && player.active) {
      const dx = cx - player.x, dy = cy - player.y;
      m = Math.min(m, dx * dx + dy * dy);
    }
    for (let i = 0; i < existing.length; i++) {
      const dx = cx - existing[i].x, dy = cy - existing[i].y;
      m = Math.min(m, dx * dx + dy * dy);
    }
    return m === Infinity ? 0 : m;
  };
  const GOOD_SEPARATION_SQ = 200 * 200; // ~3 tiles clear of player + other enemies

  let best = null;
  let bestScore = -1;
  let collected = 0;
  for (let attempt = 0; attempt < attempts && collected < 8; attempt++) {
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
    const candidate = clampCandidate(x, y, true);
    if (candidate) {
      collected++;
      const sc = spreadScoreSq(candidate.x, candidate.y);
      if (sc > bestScore) { bestScore = sc; best = candidate; }
      // Well-separated from everyone already placed -> take it immediately.
      if (sc >= GOOD_SEPARATION_SQ) return candidate;
    }
  }
  if (best) return best;

  // Last-resort (A): in rooms too cramped to satisfy minDistFromPlayer, sample
  // many accessible tiles and pick a RANDOM one from the farther HALF (ranked by
  // spread from player + existing enemies). Previously this returned the single
  // farthest tile, which is identical for every enemy -> the whole wave piled
  // onto one spot. Randomising the farther half spreads them out.
  if (player && player.active && minDistFromPlayer > 0) {
    const samples = [];
    for (let i = 0; i < 40; i++) {
      const sample = scene.pickAccessibleSpawnPoint({ maxAttempts: 1 });
      if (!sample) continue;
      const c = clampCandidate(sample.x, sample.y, false);
      if (!c) continue;
      samples.push({ c, score: spreadScoreSq(c.x, c.y) });
    }
    if (samples.length) {
      samples.sort((a, b) => b.score - a.score); // farthest-from-everyone first
      const topN = Math.max(1, Math.ceil(samples.length / 2));
      return samples[Math.floor(Math.random() * topN)].c;
    }
  }

  // Final fallback: any accessible tile (used in tests / when no player exists).
  const fallback = scene.pickAccessibleSpawnPoint({ maxAttempts: 1 });
  if (fallback) {
    const candidate = clampCandidate(fallback.x, fallback.y, false);
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

  // Pick initial spawn position far from player
  let x, y;
  const playerX = player?.x || (leftBound + rightBound) / 2;
  const playerY = player?.y || (topBound + bottomBound) / 2;
  // Try up to 20 random positions, pick the one farthest from player
  let bestX = randomIntBetween(leftBound, rightBound);
  let bestY = randomIntBetween(topBound, bottomBound);
  let bestDist = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const tx = randomIntBetween(leftBound, rightBound);
    const ty = randomIntBetween(topBound, bottomBound);
    const dist = (tx - playerX) * (tx - playerX) + (ty - playerY) * (ty - playerY);
    if (dist > bestDist) {
      bestDist = dist;
      bestX = tx;
      bestY = ty;
    }
  }
  x = bestX;
  y = bestY;
  // Minimum spawn distance from player — enemies should NOT spawn on top of player
  const MIN_SPAWN_DISTANCE = 300;

  if (xCoordinates > 0 && yCoordinates > 0) {
    x = xCoordinates;
    y = yCoordinates;
  } else {
    const preferred = pickAccessibleSpawnPosition(scene, usableBounds, margin, 6, MIN_SPAWN_DISTANCE);
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
      const dx = x - player.x;
      const dy = y - player.y;
      if (dx * dx + dy * dy < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE) {
        return false;
      }
    }
    return true;
  };

  if (!ensureValidSpot()) {
    const retry = pickAccessibleSpawnPosition(scene, usableBounds, margin, 6, MIN_SPAWN_DISTANCE);
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

  // freie Position finden — auch hier MIN_SPAWN_DISTANCE check
  for (let k = 0; k < tryOffsets.length; k++) {
    const nx = clampX(x + tryOffsets[k][0]);
    const ny = clampY(y + tryOffsets[k][1]);

    if (scene.isPointAccessible && !scene.isPointAccessible(nx, ny)) {
      continue;
    }

    // Reject positions too close to player
    if (player && player.active) {
      const pdx = nx - player.x;
      const pdy = ny - player.y;
      if (pdx * pdx + pdy * pdy < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE) continue;
    }

    if (!isSpawnBlocked(nx, ny)) {
      x = nx;
      y = ny;   
      
      break;
    }
  }

  if (!ensureValidSpot()) {
    const fallback = pickAccessibleSpawnPosition(scene, usableBounds, margin, 6, MIN_SPAWN_DISTANCE);
    if (fallback) {
      x = fallback.x;
      y = fallback.y;
    }
  }

  // Final fallback: use the scene's accessible-area spawn point picker
  if (player && player.active) {
    const fdx = x - player.x;
    const fdy = y - player.y;
    if (fdx * fdx + fdy * fdy < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE) {
      if (scene.pickAccessibleSpawnPoint) {
        const pick = scene.pickAccessibleSpawnPoint({ minDistance: MIN_SPAWN_DISTANCE, maxAttempts: 30 });
        if (pick) { x = pick.x; y = pick.y; }
      }
    }
  }

  // Skip spawn if position is still invalid after all fallbacks
  if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) {
    return null;
  }

  // 2) Typ-Fallunterscheidung + Key, Speed, HP, Ranged-Flag

  // Generate procedural textures for animal enemies (once)
  if (!scene.textures.exists('proc_rat')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x8B4513); g.fillRect(0, 0, 24, 16);
    g.generateTexture('proc_rat', 24, 16); g.destroy();
  }
  if (!scene.textures.exists('proc_bat')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x4B0082); g.fillRect(0, 0, 16, 16);
    g.generateTexture('proc_bat', 16, 16); g.destroy();
  }
  if (!scene.textures.exists('proc_wolf')) {
    const g = scene.make.graphics({ add: false });
    g.fillStyle(0x808080); g.fillRect(0, 0, 32, 24);
    g.generateTexture('proc_wolf', 32, 24); g.destroy();
  }

  // Determine available types based on dungeon depth + story act (#40).
  const depth = window.DUNGEON_DEPTH || 1;
  let type;
  if (typeof enemyType === 'number' && enemyType >= 1 && enemyType <= 10) {
    type = enemyType; // explicit request — never gated (FR-05)
  } else {
    let availableTypes;
    // #40: gate the roster by the current story act on top of the depth floor.
    // Defensive: a missing/uninitialised story system reads as "full" (act 6)
    // so spawns are never over-restricted; a missing gating module falls back
    // to the inline depth tiers (behaviour unchanged from before the feature).
    const actIdx = (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function')
      ? window.storySystem.getCurrentActIndex()
      : 6;
    if (window.EnemySpawnGating && typeof window.EnemySpawnGating.getAvailableEnemyTypes === 'function') {
      availableTypes = window.EnemySpawnGating.getAvailableEnemyTypes(depth, actIdx);
    } else if (depth <= 2) {
      availableTypes = [8, 9, 10]; // Animals only
    } else if (depth <= 4) {
      availableTypes = [8, 9, 10, 1, 2]; // Animals + Imp, Archer
    } else if (depth <= 6) {
      availableTypes = [8, 9, 10, 1, 2, 3, 4]; // + Standard enemies (Bestien bleiben)
    } else if (depth <= 8) {
      availableTypes = [8, 9, 10, 1, 2, 3, 4, 5]; // + Shadow
    } else {
      availableTypes = [8, 9, 10, 1, 2, 3, 4, 5, 6, 7]; // Full roster (kumulativ)
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
      key = scene.textures?.exists('imp_right0') ? 'imp_right0' : tex('sprite_imp', 'enemyImp');
      speed = 80;
      hp = 1;
      tint = key.startsWith('imp_') ? null : (key === 'sprite_imp' ? null : 0xff0000);
      break; // Imp
    case 2:
      key = scene.textures?.exists('archer_right0') ? 'archer_right0' : tex('sprite_archer', 'enemyArcher');
      speed = 140;
      hp = 1;
      isRanged = true;
      rangedAttackRange = 480;
      tint = key.startsWith('archer_') ? null : (key === 'sprite_archer' ? null : 0x00ff00);
      break; // Bogenschütze
    case 3:
      key = "brute_right0";
      speed = 50;
      hp = 3;
      tint = null;
      break; // Brute
    case 5:
      key = scene.textures?.exists('shadow_right0') ? 'shadow_right0' : tex('sprite_shadow', 'enemyShadow');
      speed = 120;
      hp = 1;
      tint = key.startsWith('shadow_') ? null : (key === 'sprite_shadow' ? null : 0x6600aa);
      break; // Schattenschleicher
    case 6:
      key = scene.textures?.exists('chainguard_right0') ? 'chainguard_right0' : tex('sprite_chainguard', 'enemyChainGuard');
      speed = 40;
      hp = 5;
      tint = null;
      break; // Kettenwächter
    case 7:
      key = scene.textures?.exists('flameweaver_right0') ? 'flameweaver_right0' : tex('sprite_flameweaver', 'enemyFlameWeaver');
      speed = 70;
      hp = 2;
      isRanged = true;
      rangedAttackRange = 400;
      tint = null;
      break; // Flammenweber
    case 8:
      key = scene.textures?.exists('rat_right0') ? 'rat_right0' : 'proc_rat';
      speed = 100;
      hp = 1;
      tint = key.startsWith('rat_') ? null : 0x8B4513;
      break; // Ratte
    case 9:
      key = scene.textures?.exists('bat_right0') ? 'bat_right0' : 'proc_bat';
      speed = 130;
      hp = 1;
      tint = key.startsWith('bat_') ? null : 0x4B0082;
      break; // Fledermaus
    case 10:
      key = scene.textures?.exists('wolf_right0') ? 'wolf_right0' : 'proc_wolf';
      speed = 90;
      hp = 2;
      tint = key.startsWith('wolf_') ? null : 0x808080;
      break; // Wolf
    default:
      key = scene.textures?.exists('mage_right0') ? 'mage_right0' : tex('sprite_mage', 'enemyMage');
      speed = 60;
      hp = 2;
      isRanged = true;
      rangedAttackRange = 560;
      tint = key.startsWith('mage_') ? null : (key === 'sprite_mage' ? null : 0xaa00ff);
      break; // Magier
  }

  // 3) Sprite mit richtigem Key erzeugen
  const enemy = scene.physics.add.sprite(x, y, key);
  enemies.add(enemy);
  enemy.speed = speed;
  const depthForStats = window.DUNGEON_DEPTH || 1;
  const statScale = 1 + (depthForStats - 1) * 0.1; // +10% per depth level
  enemy.hp = Math.max(1, Math.round(hp * statScale));
  // #107: maxHp UNBEDINGT setzen. Vorher entstand sie nur in bedingten Zweigen
  // (Edikt-Buff :776, Raum-Modus :806, Elite :1905, Boss :2702) — ein gewoehnlicher
  // Gegner in einem normalen Raum hatte gar keine. Gemessen in den Spieltest-
  // Protokollen: "HP 2/undefined", "HP 3/undefined", waehrend Elites "HP 83/83"
  // zeigten. Der Rueckfall in :1999 nimmt dann die AKTUELLE HP als Maximum, also
  // zeigen HP-Balken immer voll und jede Prozentrechnung sitzt auf falscher Basis.
  // Die spaeteren Zweige setzen maxHp ohnehin nach; sie bleiben korrekt.
  enemy.maxHp = enemy.hp;
  enemy.isRanged = isRanged;
  enemy.enemyType = type; // 1=Imp, 2=Archer, 3=Brute, 4=Mage
  enemy._originalTint = tint; // store for status effect visual reset
  enemy.rangedAttackRange = isRanged
    ? Math.max(120, rangedAttackRange || DEFAULT_RANGED_ATTACK_RANGE)
    : null;
  enemy.lastAttackTime = -(Math.floor(Math.random() * 300)); // 0-300ms desync for melee
  enemy.lastShotTime = -(Math.floor(Math.random() * 500) + 1); // -1 to -501ms ranged fire desync
  enemy.setCollideWorldBounds(true); // verhindert das Rauslaufen
  enemy.body.onWorldBounds = true; // optional für blocked-Check
  // Enemies must NOT be pushable by the player — otherwise the player can
  // shove enemies through wall colliders. Phaser 3.50+ body.pushable=false
  // prevents this while still letting the enemy move under its own velocity.
  if (typeof enemy.body.pushable !== 'undefined') {
    enemy.body.pushable = false;
  }

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
  // Tier for loot/XP scaling: 0=animals, 1=basic, 2=standard, 3=elite
  enemy.enemyTier = (type >= 8) ? 0 : (type <= 2 ? 1 : (type <= 4 ? 2 : 3));

  // 6) Steering-Parameter je Typ (für handleEnemies + Steering.js) ---
  if (type === 1) {
    // Imp (Nahkampf)
    enemy.sepWeight = 0.9;
    enemy.cohWeight = 0.25;
    enemy.avoidWeight = 1.0;
    enemy.sepRadius = 90;
    enemy.cohRadius = 220;
    // Sprite-based imp with animation frames
    if (key.startsWith('imp_')) {
      const impH = enemy.height || 392;
      enemy.setScale(48 / impH);
      enemy.isImp = true;
      enemy.impDirection = 'right';
      enemy.impAttacking = false;
      enemy.impAttackFrame = 0;
    }
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
    // Always flag as archer (independent of sprite variant)
    enemy.isArcher = true;
    if (key.startsWith('archer_')) {
      const archerH = enemy.height || 212;
      enemy.setScale(48 / archerH);
      enemy.isArcherSprite = true;
      enemy.archerDirection = 'right';
      enemy.archerAttacking = false;
    }
  } else if (type === 3) {
    // Brute (Panzer) - uses sprite-based animation
    enemy.speed = 70;
    enemy.sepWeight = 0.35;
    enemy.cohWeight = 0.15;
    enemy.avoidWeight = 0.6;
    enemy.sepRadius = 80;
    enemy.cohRadius = 160;
    // Scale down large sprites to fit game scale (~56px display height)
    const bruteH = enemy.height || 870;
    enemy.setScale(56 / bruteH);
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
    if (key.startsWith('shadow_')) {
      const shadowH = enemy.height || 241;
      enemy.setScale(44 / shadowH); // slightly smaller than others
      enemy.isShadowSprite = true;
      enemy.shadowDirection = 'right';
      enemy.shadowAttacking = false;
    } else if (!key.startsWith('sprite_')) {
      enemy.setScale(0.7);
    }
  } else if (type === 6) {
    // Kettenwächter (Chain Guard) - slow tank, has shield that blocks first hit
    enemy.sepWeight = 0.3;
    enemy.cohWeight = 0.15;
    enemy.avoidWeight = 0.5;
    enemy.sepRadius = 100;
    enemy.cohRadius = 200;
    enemy.isChainGuard = true;
    enemy.shieldActive = true; // blocks first hit, then breaks
    if (key.startsWith('chainguard_')) {
      const cgH = enemy.height || 253;
      enemy.setScale(56 / cgH); // bigger than regular enemies
      enemy.isChainGuardSprite = true;
      enemy.chainGuardDirection = 'right';
      enemy.chainGuardAttacking = false;
    } else if (!key.startsWith('sprite_')) {
      enemy.setScale(1.2);
    }
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
    if (key.startsWith('flameweaver_')) {
      const fwH = enemy.height || 231;
      enemy.setScale(48 / fwH);
      enemy.isFlameWeaverSprite = true;
      enemy.flameWeaverDirection = 'right';
      enemy.flameWeaverAttacking = false;
    }
  } else if (type === 8) {
    // Rat - small, fast melee
    enemy.sepWeight = 1.0;
    enemy.cohWeight = 0.2;
    enemy.avoidWeight = 0.8;
    enemy.sepRadius = 50;
    enemy.cohRadius = 150;
    if (key.startsWith('rat_')) {
      enemy.setScale(0.28);
      enemy.isAnimalSprite = true;
      enemy.animalPrefix = 'rat';
      enemy.animalDirection = 'right';
    } else {
      enemy.setScale(0.6);
    }
  } else if (type === 9) {
    // Bat - faster, erratic melee
    enemy.sepWeight = 1.2;
    enemy.cohWeight = 0.1;
    enemy.avoidWeight = 0.9;
    enemy.sepRadius = 40;
    enemy.cohRadius = 120;
    if (key.startsWith('bat_')) {
      enemy.setScale(0.22);
      enemy.isAnimalSprite = true;
      enemy.animalPrefix = 'bat';
      enemy.animalDirection = 'right';
    } else {
      enemy.setScale(0.5);
    }
  } else if (type === 10) {
    // Wolf - slightly bigger, tougher melee
    enemy.sepWeight = 0.8;
    enemy.cohWeight = 0.3;
    enemy.avoidWeight = 0.9;
    enemy.sepRadius = 70;
    enemy.cohRadius = 180;
    if (key.startsWith('wolf_')) {
      enemy.setScale(0.35);
      enemy.isAnimalSprite = true;
      enemy.animalPrefix = 'wolf';
      enemy.animalDirection = 'right';
    } else {
      enemy.setScale(0.9);
    }
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
    // Always flag as mage (independent of sprite variant)
    enemy.isMage = true;
    if (key.startsWith('mage_')) {
      const mageH = enemy.height || 268;
      enemy.setScale(48 / mageH);
      enemy.isMageSprite = true;
      enemy.mageDirection = 'right';
      enemy.mageAttacking = false;
    }
  }

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    enemy.hp = Math.max(1, Math.round(enemy.hp * difficulty));
    enemy.damage = Math.max(1, Math.round(enemy.baseDamage * difficulty));
  }

  // Legacy-Elite (goldener Buff). Bewusst KLEIN gehalten, damit die Gesamt-Elite-
  // Chance (Legacy + Champion/Unique, sich GEGENSEITIG AUSSCHLIESSEND) bei ~30 %
  // deckelt. Champion/Unique (das Affix-System) trägt den Löwenanteil.
  let eliteChance = 0;
  if (depth >= 5) {
    eliteChance = 0.08;
  } else if (depth >= 3) {
    eliteChance = 0.03;
  }

  if (Math.random() < eliteChance) {
    makeElite.call(this, enemy);
    enemy._eliteApplied = true;
  }

  // WP05 — Champion/Unique. NUR wenn der Gegner nicht schon Legacy-Elite ist
  // (kein Doppel-Elite -> saubere Gesamt-Chance).
  if (!enemy._eliteApplied && window.EliteEnemies && typeof window.EliteEnemies.shouldSpawnElite === 'function') {
    try {
      const depth = typeof currentWave === 'number' ? currentWave : (window.currentWave || 1);
      let tier = window.EliteEnemies.shouldSpawnElite(depth);
      // #95: In einem Raum gibt es genau EIN Banner. Der Anfuehrer der
      // Kriegsschar wird gezielt auf 'unique' gesetzt; wuerfelte danach ein
      // weiterer Wellengegner ebenfalls 'unique', staenden zwei Bannertraeger
      // mit zwei Gefolgen im selben Raum — und der Rang saege nichts mehr aus.
      //
      // Heruntergestuft statt gestrichen: der Raum behaelt seine Abwechslung,
      // nur der Rang bleibt einmalig.
      if (tier === 'unique' && window.__scharImRaum) tier = 'champion';
      if (tier && typeof window.EliteEnemies.applyEliteToEnemy === 'function') {
        window.EliteEnemies.applyEliteToEnemy(enemy, tier);
        enemy._eliteApplied = true;
      }
    } catch (err) {
      console.warn('[spawnEnemy] elite injection failed', err);
    }
  }

  // Printing-House run buffs: enemy HP multiplier and additive tier bonus.
  // Plus suspicion retaliation: high_alert / active_hunt force one extra elite
  // injection per spawn (only when no elite was rolled above).
  try {
    const _phEn = window.printingBuffs;
    if (_phEn) {
      if (typeof _phEn.enemyHpMult === 'number' && _phEn.enemyHpMult > 0 && _phEn.enemyHpMult !== 1) {
        enemy.hp = Math.max(1, Math.round(enemy.hp * _phEn.enemyHpMult));
        if (typeof enemy.maxHp === 'number') enemy.maxHp = enemy.hp;
        else enemy.maxHp = enemy.hp;
      }
      if (typeof _phEn.enemyTierBonus === 'number' && _phEn.enemyTierBonus > 0
          && !enemy._eliteApplied
          && window.EliteEnemies && typeof window.EliteEnemies.applyEliteToEnemy === 'function') {
        try { window.EliteEnemies.applyEliteToEnemy(enemy, 'champion'); enemy._eliteApplied = true; }
        catch (_) {}
      }
    }
    if (window.PrintingHouse && typeof window.PrintingHouse.getRetaliationTier === 'function') {
      const tier = window.PrintingHouse.getRetaliationTier();
      if ((tier === 'high_alert' || tier === 'active_hunt')
          && !enemy._eliteApplied
          && Math.random() < 0.20  // 20% chance per spawn → roughly +1 elite per room of 5 enemies
          && window.EliteEnemies && typeof window.EliteEnemies.applyEliteToEnemy === 'function') {
        try { window.EliteEnemies.applyEliteToEnemy(enemy, 'champion'); enemy._eliteApplied = true; }
        catch (_) {}
      }
    }
  } catch (_) { /* swallow */ }

  // Room-mode HP scaling (Feature 061): a special room (e.g. survival) can make
  // its enemies tankier so the timed objective applies real pressure. Mirrors the
  // printingBuffs.enemyHpMult pattern above; no-op (×1) for `clear`/no mode.
  try {
    if (window.RoomMode && typeof window.RoomMode.enemyHpMultiplier === 'function') {
      const _modeMul = window.RoomMode.enemyHpMultiplier();
      if (typeof _modeMul === 'number' && _modeMul > 0 && _modeMul !== 1) {
        enemy.hp = Math.max(1, Math.round(enemy.hp * _modeMul));
        enemy.maxHp = enemy.hp;
      }
    }
  } catch (_) { /* swallow */ }

  return enemy;
}

function handleEnemies(time, delta = 16) {
  const dt = delta / 1000;

  // Room-entry grace period: enemies stand still and don't attack for a short
  // window after the player enters a new room, so the player isn't ambushed
  // before they can react.
  const inGrace = !!(this && this._enemyAttackGraceUntil && time < this._enemyAttackGraceUntil);

  // Spatial hash for steering: O(n²) → O(n*k) where k is the average number
  // of enemies in adjacent buckets. Cell size is sized to comfortably contain
  // the largest cohesion radius (~280 px) so each enemy only needs to look
  // at its home bucket and 8 neighbors.
  const STEER_CELL = 256;
  const steerHash = new Map();
  const steerKey = (cx, cy) => `${cx}|${cy}`;
  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    const cx = Math.floor(enemy.x / STEER_CELL);
    const cy = Math.floor(enemy.y / STEER_CELL);
    const k = steerKey(cx, cy);
    let bucket = steerHash.get(k);
    if (!bucket) {
      bucket = [];
      steerHash.set(k, bucket);
    }
    bucket.push(enemy);
  });

  // Returns neighbors in the 3x3 cell window around the given enemy.
  // The list typically holds 1-6 enemies instead of the full enemies group.
  const getSteerNeighbors = (enemy) => {
    const cx = Math.floor(enemy.x / STEER_CELL);
    const cy = Math.floor(enemy.y / STEER_CELL);
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = steerHash.get(steerKey(cx + dx, cy + dy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }
    return out;
  };

  // Camera culling: compute viewport bounds once per frame
  const cam = this.cameras?.main;
  const CULL_MARGIN = 160; // px outside viewport to still update
  let cullLeft = -Infinity, cullRight = Infinity, cullTop = -Infinity, cullBottom = Infinity;
  if (cam && typeof isMobile !== 'undefined' && isMobile) {
    cullLeft = cam.scrollX - CULL_MARGIN;
    cullRight = cam.scrollX + cam.width + CULL_MARGIN;
    cullTop = cam.scrollY - CULL_MARGIN;
    cullBottom = cam.scrollY + cam.height + CULL_MARGIN;
  }

  // Perf (#70): Hindernis-Bounds EINMAL pro Frame cachen. Steering.obstacleAvoidance
  // + hasLineOfSight lesen obstacles.__steerRects statt pro Gegner o.getBounds()
  // über alle Hindernisse zu rufen (war ~N_Gegner × N_Hindernisse getBounds/Frame).
  // Statisch innerhalb des Frames -> stets frisch, keine Stale-Cache-Gefahr.
  if (obstacles && obstacles.children) {
    const _rects = [];
    obstacles.children.iterate((o) => { if (o) _rects.push(o.getBounds()); });
    obstacles.__steerRects = _rects;
  }

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;

    // Camera culling: skip AI for off-screen enemies on mobile
    if (enemy.x < cullLeft || enemy.x > cullRight || enemy.y < cullTop || enemy.y > cullBottom) {
      if (enemy.body) enemy.body.setVelocity(0, 0);
      return;
    }

    if (enemy.isBoss) {
      handleBossAI.call(this, time, enemy, this);
      return; // boss handled, skip regular enemy logic
    }

    // Status effect: stunned enemies cannot move or attack
    if (window.statusEffectManager && window.statusEffectManager.isStunned(enemy)) {
      enemy.body.setVelocity(0, 0);
      return;
    }

    // 060: Sog (Wirbelsog/Stahlgriff) — solange _pullUntil läuft, die normale
    // KI-Steuerung ÜBERSPRINGEN und den Gegner aktiv zum Spieler ziehen. Sonst
    // überschreibt die Steering jeden Frame die Pull-Velocity (Pull unsichtbar).
    if (enemy._pullUntil && time < enemy._pullUntil && enemy.body && typeof player !== 'undefined' && player) {
      const pdx = player.x - enemy.x, pdy = player.y - enemy.y;
      const pl = Math.hypot(pdx, pdy);
      enemy.body.setVelocity(0, 0);
      if (pl >= 20) {
        // Position DIREKT ziehen (umgeht das maxVelocity-Cap der Gegner). Schritt
        // = max(pullSpeed*dt, 25% der Reststrecke) → frame-rate-unabhängig
        // spürbarer "Yank", nie überschießen.
        const ps = enemy._pullSpeed || 600;
        const step = Math.min(pl - 16, Math.max(ps * (delta / 1000), pl * 0.25));
        const nx = enemy.x + (pdx / pl) * step, ny = enemy.y + (pdy / pl) * step;
        if (enemy.body.reset) enemy.body.reset(nx, ny);
        else { enemy.x = nx; enemy.y = ny; }
      }
      return;
    }

    // #65 Signature-Angriffe: waehrend des Telegraphs (casting) steht der Mini-
    // Boss, waehrend des Dashs (Charge/Leap) zieht er zum EINGEFRORENEN Ziel.
    // Body bleibt AN -> weiter treffbar; umgeht nur die Steering (wie _pullUntil).
    if (enemy._castingUntil && time < enemy._castingUntil) {
      if (enemy.body) enemy.body.setVelocity(0, 0);
      return;
    }
    if (enemy._dashUntil && enemy.body && enemy._dashTarget) {
      const dxt = enemy._dashTarget.x - enemy.x, dyt = enemy._dashTarget.y - enemy.y;
      const dl = Math.hypot(dxt, dyt);
      enemy.body.setVelocity(0, 0);
      if (time >= enemy._dashUntil || dl <= 10) {
        enemy._dashUntil = 0;
        const cb = enemy._dashOnArrive; enemy._dashOnArrive = null; enemy._dashTarget = null;
        if (typeof cb === 'function') { try { cb(); } catch (e) {} }
      } else {
        const ds = enemy._dashSpeed || 800;
        const step = Math.min(dl, Math.max(ds * (delta / 1000), dl * 0.25));
        const nx = enemy.x + (dxt / dl) * step, ny = enemy.y + (dyt / dl) * step;
        if (enemy.body.reset) enemy.body.reset(nx, ny); else { enemy.x = nx; enemy.y = ny; }
      }
      // HP-Leiste + Label wandern mit, waehrend der Boss dasht (sonst detachen sie).
      if (enemy.miniBossBar) drawMiniBossBar(enemy);
      if (enemy.miniBossLabel) enemy.miniBossLabel.setPosition(enemy.x, enemy.y - ((enemy.displayHeight || 48) / 2) - 14);
      return;
    }

    // Grace period: freeze enemies completely. Skip movement + attack logic
    // until the grace window expires.
    if (inGrace) {
      enemy.body.setVelocity(0, 0);
      return;
    }

    // Draw mini-boss health bar each frame
    if (enemy.isMiniBoss && enemy.miniBossBar) {
      drawMiniBossBar(enemy);
      // #65 Phase 2: Verzauberungs-Label folgt dem Kopf (ueber der Leiste).
      if (enemy.miniBossLabel) {
        const _dh = (enemy.displayHeight || 48) / 2;
        enemy.miniBossLabel.setPosition(enemy.x, enemy.y - _dh - 14);
        if (typeof enemy.alpha === 'number') enemy.miniBossLabel.setAlpha(enemy.visible ? 1 : 0);
      }
      // #65 Phase 2: 'Zaeh' — Heal-over-time (~healFrac der maxHP pro Sekunde).
      if (enemy._enchant && enemy._enchant.healFrac && enemy.hp > 0 && enemy.hp < enemy.maxHp) {
        if (!enemy._lastHealMs) enemy._lastHealMs = time;
        if (time - enemy._lastHealMs >= 1000) {
          enemy._lastHealMs = time;
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.max(1, Math.round(enemy.maxHp * enemy._enchant.healFrac)));
        }
      }
    }

    // #90 Elite-Affix 'cold_aura': verlangsamt den Spieler in der Naehe.
    // Nutzt den bestehenden StatusEffect SLOW und erneuert ihn, solange der
    // Spieler im Radius steht — laeuft nach dem Verlassen von selbst aus.
    if (enemy.hasColdAura && enemy.hp > 0 && player) {
      const _cr = enemy.coldAuraRadius || 150;
      const _cdx = player.x - enemy.x, _cdy = player.y - enemy.y;
      if (_cdx * _cdx + _cdy * _cdy <= _cr * _cr) {
        if (!enemy._lastColdMs || time - enemy._lastColdMs >= 500) {
          enemy._lastColdMs = time;
          if (window.statusEffectManager && window.StatusEffectType
              && typeof window.statusEffectManager.applyEffect === 'function') {
            try {
              window.statusEffectManager.applyEffect(player, window.StatusEffectType.SLOW, 'eliteColdAura');
            } catch (e) { /* nie den Tick brechen */ }
          }
        }
      }
    }

    // Draw the regular enemy hp bar (created lazily on first hit by
    // handleEnemyHit). Only present after the enemy has taken damage; the
    // bar tracks the enemy's position so it stays above the head as they
    // move.
    if (enemy.hpBar && !enemy.isMiniBoss && !enemy.isBoss) {
      drawEnemyHpBar(enemy);
    }

    // #65 Signature-Angriffe je Archetyp (Charge/Leap/Salve) mit Telegraph +
    // Cooldown; Nahkampf-Slam als Point-Blank-Zusatz. Kein neuer Trigger, solange
    // ein Special laeuft (casting/dash).
    if (enemy.isMiniBoss && player && player.active
        && !(enemy._castingUntil && time < enemy._castingUntil)
        && !(enemy._dashUntil && time < enemy._dashUntil)) {
      const cd = enemy._specialCd || 5000;
      if (!enemy.lastSpecialTime || time - enemy.lastSpecialTime > cd) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, player.x, player.y);
        const sig = enemy._signature;
        let fired = true;
        if (sig === 'salve' && dist <= 420) miniBossSalve.call(this, enemy);
        else if (sig === 'charge' && dist <= 280 && dist >= 60) miniBossCharge.call(this, enemy);
        else if (sig === 'leap' && dist <= 340 && dist >= 70) miniBossLeap.call(this, enemy);
        else if (!enemy.isRanged && dist <= 120) miniBossSlam.call(this, enemy);
        else fired = false;
        if (fired) enemy.lastSpecialTime = time;
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

    // --- Pluenderer: Flucht zur Treppe (#129) --------------------------------
    //
    // Der Beutetraeger aus dem Hinterhalt soll nicht dastehen wie jeder andere.
    // Die Meldung verspricht eine Jagd — also gibt es eine.
    //
    // Bewusst KEINE neue Fluchtkraft in der Steering: bei der Leine der
    // Kriegsschar (#95) ging eine Zusatzkraft in Steering.limit unter (gemessen
    // 299 px mit gegen 323 px ohne — praktisch wirkungslos). Stattdessen die
    // erprobte Ansturm-Maschinerie (_dashTarget/_dashUntil), die die Steering
    // ohnehin umgeht: ein Satz alle paar Sekunden, sichtbar und unterbrechbar.
    //
    // Ziel ist die Treppe. Erreicht er sie, ist er weg — samt Beute. Das macht
    // aus dem Hinterhalt eine Entscheidung: den Traeger jagen oder erst die
    // anderen abraeumen.
    if (enemy._istPluenderer && enemy.hp > 0 && player && player.active) {
      // Die Meldung kommt erst, wenn man ihn WIRKLICH sieht.
      if (!enemy._pluendererGemeldet && _pluendererSichtbar(this, enemy)) {
        enemy._pluendererGemeldet = true;
        try {
          if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
            window.EventSystem.showToast(this, _pluendererMeldung(), 'ambush');
          }
        } catch (e) {}
      }
      var _fluchtCd = enemy._fluchtCd || 2400;
      var _bereit = !enemy._letzteFlucht || (time - enemy._letzteFlucht > _fluchtCd);
      // Er flieht, sobald er gesehen wurde — nicht erst, wenn man ihm auf den
      // Fersen ist. Vorher setzte er nur unter 300 px ab; wer ihn aus der
      // Ferne beschoss, sah nie eine Flucht.
      var _laeuft = !!enemy._pluendererGemeldet || dToPlayer < 300;
      if (_bereit && _laeuft && !(enemy._dashUntil && time < enemy._dashUntil)) {
        var _ziel = _pluendererFluchtziel(this, enemy);
        if (_ziel) {
          enemy._letzteFlucht = time;
          enemy._dashTarget = _ziel;
          // Ein SATZ, kein Blinzeln. 420 px/s ueber 620 ms sahen aus, als wuerde
          // er sich versetzen statt zu laufen — bei 260 px Sprungweite war er in
          // gut einer halben Sekunde am anderen Ende des Blickfelds. Jetzt
          // langsamer und laenger unterwegs: man sieht ihn die Strecke
          // zuruecklegen und kann ihm nachsetzen.
          enemy._dashSpeed = 230;
          enemy._dashUntil = time + 900;
          enemy._dashOnArrive = null;
        }
      }
      // Angekommen? Dann ist er mit der Beute unten durch.
      if (_pluendererAmAusgang(this, enemy)) {
        _pluendererEntkommt(this, enemy);
        return;
      }
    }

    // Schattenschleicher: teleport when player gets within 100px
    if (enemy.isShadowCreeper && dToPlayer < 100) {
      if (!enemy.lastTeleportTime || time - enemy.lastTeleportTime > 2000) {
        enemy.lastTeleportTime = time;
        // Try up to 10 random positions, only teleport if accessible
        const bounds = this.physics?.world?.bounds;
        let teleported = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          const teleAngle = Math.random() * Math.PI * 2;
          const teleDist = 80 + Math.random() * 70;
          let newX = enemy.x + Math.cos(teleAngle) * teleDist;
          let newY = enemy.y + Math.sin(teleAngle) * teleDist;
          if (bounds) {
            newX = Phaser.Math.Clamp(newX, bounds.x + 32, bounds.x + bounds.width - 32);
            newY = Phaser.Math.Clamp(newY, bounds.y + 32, bounds.y + bounds.height - 32);
          }
          // Check accessibility
          if (this.isPointAccessible && !this.isPointAccessible(newX, newY)) continue;
          // Check no obstacle blocking
          if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(newX, newY)) continue;
          enemy.setPosition(newX, newY);
          teleported = true;
          break;
        }
        if (teleported) {
          enemy.setAlpha(0.3);
          if (this.tweens) {
            this.tweens.add({ targets: enemy, alpha: 1, duration: 300 });
          }
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
      // --- Melee: weit weg -> seek, nah -> arrive (weiches Abbremsen).
      // #061 Defend-Modus: ein Ziel-Override (Altar) ZIEHT die Melee-Gegner AN,
      // statt dass sie den Spieler jagen — sonst lockt man sie in großen Räumen
      // einfach vom Altar weg und der Drain passiert nie. Ohne Override = Spieler.
      let chaseTarget = (typeof window !== 'undefined' && window.__ENEMY_CHASE_OVERRIDE__)
        ? window.__ENEMY_CHASE_OVERRIDE__ : player;
      // #95: Die Leine der Kriegsschar. Ein Gefolgsmann, der weiter als
      // LEINE_PX von seinem Bannertraeger entfernt ist, kehrt zu IHM zurueck,
      // statt weiter zum Spieler zu laufen.
      //
      // Erster Versuch war eine Zusatzkraft auf 'desired'. Gemessen brachte das
      // fast nichts (Abstand nach 150 Frames 299 px mit, 323 px ohne): das
      // Spieler-Verfolgen zieht mit voller Geschwindigkeit, und Steering.limit
      // verrechnet beides zu einem Kompromiss, in dem die Leine untergeht. Ein
      // Zielwechsel ist eindeutig — und genau das Verhalten, das die Schar als
      // Verband lesbar macht.
      //
      // Faellt der Anfuehrer, loest sich die Bindung von selbst.
      if (enemy._scharFuehrer && enemy._scharFuehrer.active) {
        const _lx = enemy._scharFuehrer.x - enemy.x;
        const _ly = enemy._scharFuehrer.y - enemy.y;
        if (_lx * _lx + _ly * _ly > 220 * 220) chaseTarget = enemy._scharFuehrer;
      }
      const _tgtBodyW = (chaseTarget.body && chaseTarget.body.width) || 24;
      const stopDist = (enemy.body.width + _tgtBodyW) / 1.5;
      const dToTarget = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        chaseTarget.x,
        chaseTarget.y,
      );

      if (dToTarget > stopDist + 40) {
        desired = Steering.seek(enemy, chaseTarget, maxSpeed);
      } else {
        // weich abbremsen, aber nicht komplett „einschlafen"
        desired = Steering.arrive(
          enemy,
          chaseTarget,
          maxSpeed,
          Math.max(stopDist, 60),
        );

        // kleiner Vorwärts-Nudge, falls die Arrive-Geschwindigkeit zu klein wird
        if (dToTarget > stopDist * 0.85) {
          const nudge = Steering.seek(enemy, chaseTarget, Math.min(maxSpeed, 60));
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

    // Use spatial hash bucket lookup instead of full enemies.getChildren().
    // Cuts steering cost from O(n²) to O(n*k) where k is local density.
    const neigh = getSteerNeighbors(enemy);
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

    // Anti-Durchlauf-Netz: der Spieler-Gegner-Collider (main.js, aus beim Rollen)
    // trennt normal sauber, aber bei hoher Relativgeschwindigkeit ODER grösseren
    // Gegnern (Brute) konnte man durchs ZENTRUM tunneln. Steckt der (nicht rollende)
    // Spieler tief im Gegner (< Kern-Radius), wird er sanft herausgeschoben. Greift
    // nur bei echtem Zentrums-Überlapp -> kein Ruckeln im Normalfall.
    if (player && player.active && enemy.body && player.body
        && !(typeof isRolling !== 'undefined' && isRolling)) {
      var _pdx = player.x - enemy.x, _pdy = player.y - enemy.y;
      var _pdd = Math.sqrt(_pdx * _pdx + _pdy * _pdy);
      var _coreR = 22;
      if (_pdd > 0.001 && _pdd < _coreR) {
        player.x = enemy.x + (_pdx / _pdd) * _coreR;
        player.y = enemy.y + (_pdy / _pdd) * _coreR;
      }
    }

    // Sprite direction switching for animated enemies
    // - Only switch on significant horizontal movement (threshold to avoid flicker)
    // - Never switch during attack animation
    // - Cooldown of 200ms between direction changes
    const DIR_THRESHOLD = 60; // minimum horizontal velocity to trigger direction change
    const DIR_COOLDOWN = 800; // ms between direction changes

    if (enemy.isImp && !enemy.impAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.impDirection) {
          enemy.impDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `imp_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isShadowSprite && !enemy.shadowAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.shadowDirection) {
          enemy.shadowDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `shadow_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isFlameWeaverSprite && !enemy.flameWeaverAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.flameWeaverDirection) {
          enemy.flameWeaverDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `flameweaver_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isArcherSprite && !enemy.archerAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.archerDirection) {
          enemy.archerDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `archer_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isMageSprite && !enemy.mageAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.mageDirection) {
          enemy.mageDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `mage_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isChainGuardSprite && !enemy.chainGuardAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.chainGuardDirection) {
          enemy.chainGuardDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `chainguard_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    if (enemy.isBrute && !enemy.bruteAttacking) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.bruteDirection) {
          enemy.bruteDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `brute_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    // Animal sprite direction switching (rat, bat, wolf)
    if (enemy.isAnimalSprite) {
      if (Math.abs(desired.x) > DIR_THRESHOLD && (!enemy._lastDirChange || time - enemy._lastDirChange > DIR_COOLDOWN)) {
        const newDir = desired.x > 0 ? 'right' : 'left';
        if (newDir !== enemy.animalDirection) {
          enemy.animalDirection = newDir;
          enemy._lastDirChange = time;
          const idleKey = `${enemy.animalPrefix}_${newDir}0`;
          if (this.textures.exists(idleKey)) enemy.setTexture(idleKey);
        }
      }
    }

    // --- Angriff / Schaden unverändert
    // #90 Nebenbefund: der Elite-Affix 'fanatic' setzt `_attackCdMul` (halbe
    // Abklingzeit), aber der Wert wurde NIRGENDS gelesen — nur sein Tempo-Anteil
    // wirkte. Beide Angriffstakte (Nah + Fern) respektieren ihn jetzt.
    const _cdMul = (typeof enemy._attackCdMul === 'number' && enemy._attackCdMul > 0)
      ? enemy._attackCdMul : 1;
    const attackCooldown = 1500 * _cdMul;

    if (enemy.isRanged) {
      if (!enemy.lastShotTime || time - enemy.lastShotTime > 1500 * _cdMul) {
        const maxRange = enemy.rangedAttackRange || DEFAULT_RANGED_ATTACK_RANGE;
        if (dToPlayer <= maxRange && Steering.hasLineOfSight(enemy, player, obstacles)) {
          if (enemy.isFlameWeaver) {
            // Flammenweber: shoot 3 projectiles in a spread pattern
            shootSpreadProjectiles.call(this, enemy, 3, Phaser.Math.DegToRad(30));
          } else {
            shootProjectile.call(this, enemy);
          }
          enemy.lastShotTime = time;

          // Flame Weaver cast animation (450ms)
          if (enemy.isFlameWeaverSprite && !enemy.flameWeaverAttacking) {
            enemy.flameWeaverAttacking = true;
            const dir = enemy.flameWeaverDirection || 'right';
            const sc = this;
            if (sc.textures.exists('flameweaver_' + dir + '1')) enemy.setTexture('flameweaver_' + dir + '1');
            sc.time.delayedCall(225, () => {
              if (enemy && enemy.active && sc.textures.exists('flameweaver_' + dir + '2')) enemy.setTexture('flameweaver_' + dir + '2');
            });
            sc.time.delayedCall(450, () => {
              if (enemy && enemy.active) {
                enemy.flameWeaverAttacking = false;
                if (sc.textures.exists('flameweaver_' + dir + '0')) enemy.setTexture('flameweaver_' + dir + '0');
              }
            });
          }

          // Archer shoot animation (400ms: draw → release → idle)
          if (enemy.isArcherSprite && !enemy.archerAttacking) {
            enemy.archerAttacking = true;
            const dir = enemy.archerDirection || 'right';
            const sc = this;
            if (sc.textures.exists('archer_' + dir + '1')) enemy.setTexture('archer_' + dir + '1');
            sc.time.delayedCall(200, () => {
              if (enemy && enemy.active && sc.textures.exists('archer_' + dir + '2')) enemy.setTexture('archer_' + dir + '2');
            });
            sc.time.delayedCall(400, () => {
              if (enemy && enemy.active) {
                enemy.archerAttacking = false;
                if (sc.textures.exists('archer_' + dir + '0')) enemy.setTexture('archer_' + dir + '0');
              }
            });
          }

          // Mage cast animation (500ms: windup → cast → idle)
          if (enemy.isMageSprite && !enemy.mageAttacking) {
            enemy.mageAttacking = true;
            const dir = enemy.mageDirection || 'right';
            const sc = this;
            if (sc.textures.exists('mage_' + dir + '1')) enemy.setTexture('mage_' + dir + '1');
            sc.time.delayedCall(250, () => {
              if (enemy && enemy.active && sc.textures.exists('mage_' + dir + '2')) enemy.setTexture('mage_' + dir + '2');
            });
            sc.time.delayedCall(500, () => {
              if (enemy && enemy.active) {
                enemy.mageAttacking = false;
                if (sc.textures.exists('mage_' + dir + '0')) enemy.setTexture('mage_' + dir + '0');
              }
            });
          }
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

          // Chain Guard attack animation (600ms — heavy, slow)
          if (enemy.isChainGuardSprite) {
            enemy.chainGuardAttacking = true;
            const dir = enemy.chainGuardDirection || 'right';
            const scene = this;
            if (scene.textures.exists(`chainguard_${dir}1`)) enemy.setTexture(`chainguard_${dir}1`);
            scene.time.delayedCall(300, () => {
              if (enemy && enemy.active && scene.textures.exists(`chainguard_${dir}2`)) enemy.setTexture(`chainguard_${dir}2`);
            });
            scene.time.delayedCall(600, () => {
              if (enemy && enemy.active) {
                enemy.chainGuardAttacking = false;
                if (scene.textures.exists(`chainguard_${dir}0`)) enemy.setTexture(`chainguard_${dir}0`);
              }
            });
          }

          // Shadow Creeper attack animation (350ms)
          if (enemy.isShadowSprite) {
            enemy.shadowAttacking = true;
            const dir = enemy.shadowDirection || 'right';
            const scene = this;
            if (scene.textures.exists(`shadow_${dir}1`)) enemy.setTexture(`shadow_${dir}1`);
            scene.time.delayedCall(175, () => {
              if (enemy && enemy.active && scene.textures.exists(`shadow_${dir}2`)) enemy.setTexture(`shadow_${dir}2`);
            });
            scene.time.delayedCall(350, () => {
              if (enemy && enemy.active) {
                enemy.shadowAttacking = false;
                if (scene.textures.exists(`shadow_${dir}0`)) enemy.setTexture(`shadow_${dir}0`);
              }
            });
          }

          // Imp attack animation (400ms total, 200ms per frame)
          if (enemy.isImp) {
            enemy.impAttacking = true;
            const dir = enemy.impDirection || 'right';
            const scene = this;
            if (scene.textures.exists(`imp_${dir}1`)) enemy.setTexture(`imp_${dir}1`);
            scene.time.delayedCall(200, () => {
              if (enemy && enemy.active && scene.textures.exists(`imp_${dir}2`)) enemy.setTexture(`imp_${dir}2`);
            });
            scene.time.delayedCall(400, () => {
              if (enemy && enemy.active) {
                enemy.impAttacking = false;
                if (scene.textures.exists(`imp_${dir}0`)) enemy.setTexture(`imp_${dir}0`);
              }
            });
          }

          // Brute attack animation (500ms total, 250ms per frame)
          if (enemy.isBrute) {
            enemy.bruteAttacking = true;
            const dir = enemy.bruteDirection || 'right';
            const scene = this;
            if (scene.textures.exists(`brute_${dir}1`)) enemy.setTexture(`brute_${dir}1`);
            scene.time.delayedCall(250, () => {
              if (enemy && enemy.active && scene.textures.exists(`brute_${dir}2`)) enemy.setTexture(`brute_${dir}2`);
            });
            scene.time.delayedCall(500, () => {
              if (enemy && enemy.active) {
                enemy.bruteAttacking = false;
                if (scene.textures.exists(`brute_${dir}0`)) enemy.setTexture(`brute_${dir}0`);
              }
            });
          }

          // No temporary collider — prevents pushing player through walls

          // Schaden wie bisher
          applyPlayerDamage(enemy.damage, this, enemy);
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

/**
 * Pick the right projectile texture for this enemy archetype.
 *
 * Enemy flag convention (set in spawnEnemy):
 *   - is{Type}        — ALWAYS set for ranged archetypes (Archer/Mage/FlameWeaver),
 *                       independent of sprite variant. Use these for behavior decisions.
 *   - is{Type}Sprite  — set ONLY when the enemy uses the directional sprite sheet.
 *                       Use these for animation flips only.
 *
 * @param {{isArcher?: boolean, isMage?: boolean, isFlameWeaver?: boolean}} enemy
 * @returns {'proj_arrow'|'proj_arcane'|'proj_fireball'|'proj_default'}
 */
function getProjectileTextureFor(enemy) {
  if (!enemy) return 'proj_default';
  if (enemy.isFlameWeaver) return 'proj_fireball';
  if (enemy.isMage)        return 'proj_arcane';
  if (enemy.isArcher)      return 'proj_arrow';
  return 'proj_default';
}

// ---------- Enemy projectile object pool ----------
// shootProjectile / shootSpreadProjectiles previously created a fresh
// physics sprite for every shot and destroyed it on impact. With Flame
// Weavers (3-projectile spread @ 1.5s cooldown × multiple casters) this
// allocates dozens of sprites per second. The pool reuses inactive
// projectiles to keep the GC quiet.
const ENEMY_PROJECTILE_POOL_MAX = 64;

// Configure size + body for a projectile based on its texture key.
function _configureProjectileShape(proj, texKey, ang) {
  if (texKey === 'proj_arrow') {
    proj.setDisplaySize(28, 8);
    if (proj.body && proj.body.setSize) proj.body.setSize(20, 6);
    if (typeof ang === 'number') proj.setRotation(ang);
  } else if (texKey === 'proj_fireball' || texKey === 'proj_arcane') {
    proj.setDisplaySize(20, 20);
    if (proj.body && proj.body.setCircle) proj.body.setCircle(8);
  } else {
    proj.setDisplaySize(14, 14);
    if (proj.body && proj.body.setCircle) proj.body.setCircle(6);
  }
}

/**
 * Borrow a projectile sprite from the scene's enemy projectile pool, or
 * create a new one if the pool is empty. The returned sprite is added to
 * the `enemyProjectiles` group, has its body re-enabled, and its texture
 * set to `texKey`. Caller must call `_configureProjectileShape()` afterwards.
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {string} texKey
 * @returns {Phaser.Physics.Arcade.Sprite}
 */
function acquireEnemyProjectile(scene, x, y, texKey) {
  const pool = scene._enemyProjectilePool || (scene._enemyProjectilePool = []);
  let proj = null;
  while (pool.length > 0) {
    const candidate = pool.pop();
    if (candidate && candidate.scene) {
      proj = candidate;
      break;
    }
  }
  if (proj) {
    if (proj.body) proj.body.enable = true;
    proj.setActive(true).setVisible(true);
    proj.setPosition(x, y);
    proj.setVelocity(0, 0);
    proj.setRotation(0);
    if (proj.texture && proj.texture.key !== texKey) {
      proj.setTexture(texKey);
    }
  } else {
    proj = scene.physics.add.sprite(x, y, texKey);
    if (enemyProjectiles && enemyProjectiles.add) enemyProjectiles.add(proj);
  }
  // Re-apply mask if the scene needs it (vision FX)
  if (scene._enemyVisionMask && proj.setMask) {
    proj.setMask(scene._enemyVisionMask);
  }
  return proj;
}

/**
 * Return a projectile sprite to the pool. Disables physics, hides the
 * sprite, and pushes it back to the scene's pool. If the pool is full
 * (>= ENEMY_PROJECTILE_POOL_MAX), destroys the sprite outright.
 * @param {Phaser.Physics.Arcade.Sprite|null|undefined} proj
 */
function releaseEnemyProjectile(proj) {
  if (!proj) return;
  if (proj.body) {
    proj.body.enable = false;
    if (proj.body.setVelocity) proj.body.setVelocity(0, 0);
  }
  proj.setActive(false).setVisible(false);
  const scene = proj.scene;
  if (!scene) return;
  const pool = scene._enemyProjectilePool || (scene._enemyProjectilePool = []);
  if (pool.length < ENEMY_PROJECTILE_POOL_MAX) {
    pool.push(proj);
  } else {
    proj.destroy();
  }
}
// Expose for collider callbacks in main.js (player ↔ projectile, projectile ↔ wall)
if (typeof window !== 'undefined') {
  window.releaseEnemyProjectile = releaseEnemyProjectile;
}

function shootProjectile(enemy) {
  // #90 Elite-Affix 'multishot': statt eines Geschosses ein Faecher. Nutzt die
  // bestehende Flammenweber-Streuung (shootSpreadProjectiles) — dadurch teilen
  // sich beide Pfade Schadens-, Pool- und Masken-Logik.
  if (enemy && enemy.isMultishot && typeof shootSpreadProjectiles === 'function') {
    const _n = Math.max(2, enemy.multishotCount || 3);
    shootSpreadProjectiles.call(this, enemy, _n, Math.PI / 6);
    return;
  }
  const texKey = getProjectileTextureFor(enemy);
  const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const projectile = acquireEnemyProjectile(this, enemy.x, enemy.y, texKey);
  _configureProjectileShape(projectile, texKey, ang);
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

  // Mask is re-applied by acquireEnemyProjectile when the scene has a vision mask;
  // we still queue the projectile if the mask isn't ready yet (race during scene init).
  if (!this._enemyVisionMask) {
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

  const texKey = getProjectileTextureFor(enemy);
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
    const ang = base + t * totalSpread;
    const proj = acquireEnemyProjectile(scene, enemy.x, enemy.y, texKey);
    _configureProjectileShape(proj, texKey, ang);
    proj.setVelocity(Math.cos(ang) * 200, Math.sin(ang) * 200);
    proj.setData('baseDamage', baseDamage);
    proj.setData('damage', scaledDamage);
    proj.baseDamage = baseDamage;
    proj.damage = scaledDamage;
    if (!scene._enemyVisionMask) {
      scene._needsMaskProj = scene._needsMaskProj || [];
      scene._needsMaskProj.push(proj);
    }
  }
  enemy.damage = scaledDamage;
}

// Mini-Boss: ground slam AoE. #65 Phase 3: klarer TELEGRAPH vor dem Impact —
// ~650 ms wachsende Gefahrenzone (roter Ring + fuellender Countdown-Kreis), erst
// DANN Schaden + Blitz + Shake. Der Zielort wird beim Start eingefroren, und der
// Schaden prueft die AKTUELLE Spielerposition beim Impact: rechtzeitig rauslaufen
// vermeidet ihn. Damage nur, wenn der Spieler beim Einschlag noch im Kreis ist.
function miniBossSlam(enemy) {
  const scene = this;
  const r = 120;
  const TELEGRAPH_MS = 650;
  const cx = enemy.x, cy = enemy.y; // Ziel einfrieren
  const g = scene.add.graphics().setDepth(1001);
  const st = { t: 0 };

  scene.tweens.add({
    targets: st, t: 1, duration: TELEGRAPH_MS, ease: 'Linear',
    onUpdate: () => {
      if (!g.scene) return;
      g.clear();
      // Aussenring blinkt schneller, je naeher der Einschlag.
      const blink = 0.5 + 0.5 * Math.sin(st.t * st.t * 30);
      g.lineStyle(3, 0xff5533, 0.55 + 0.35 * blink).strokeCircle(cx, cy, r);
      // Fuellkreis waechst als Countdown zum Impact.
      g.fillStyle(0xff2200, 0.10 + 0.18 * st.t).fillCircle(cx, cy, r * (0.18 + 0.82 * st.t));
    },
    onComplete: () => {
      if (!g.scene) return;
      // Impact: heller Blitz + Schaden (nur wenn Spieler noch im Kreis) + Shake.
      g.clear();
      g.fillStyle(0xffaa33, 0.5).fillCircle(cx, cy, r);
      g.lineStyle(4, 0xffe0a0, 1).strokeCircle(cx, cy, r);
      if (player && player.active) {
        const d = Phaser.Math.Distance.Between(cx, cy, player.x, player.y);
        if (d <= r + (player.body?.width || 0) * 0.5) {
          applyPlayerDamage(enemy.damage, scene, enemy);
        }
      }
      try { scene.cameras.main.shake(120, 0.004); } catch (e) {}
      scene.time.delayedCall(140, () => { if (g.scene) g.destroy(); });
    }
  });
}

// Distanz Punkt <-> Liniensegment (fuer den Charge-Schaden entlang der Bahn).
function _distPointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Feuert `count` Projektile in einem Faecher um den FIXEN Winkel `baseAng`
// (nicht auf die aktuelle Spielerposition neu berechnet) -> ehrlicher Kegel-
// Telegraph: raus aus dem Kegel = ausweichen. Mirror von shootSpreadProjectiles.
function _fireLockedSpread(enemy, count, totalSpread, baseAng) {
  const scene = this;
  const baseDamage = enemy.baseDamage || enemy.damage || 1;
  const diff = getDifficultyMultiplierValue();
  const scaled = diff !== 1 ? Math.max(1, Math.round(baseDamage * diff)) : Math.max(1, Math.round(baseDamage));
  const texKey = getProjectileTextureFor(enemy);
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
    const ang = baseAng + t * totalSpread;
    const proj = acquireEnemyProjectile(scene, enemy.x, enemy.y, texKey);
    _configureProjectileShape(proj, texKey, ang);
    proj.setVelocity(Math.cos(ang) * 210, Math.sin(ang) * 210);
    proj.setData('baseDamage', baseDamage); proj.setData('damage', scaled);
    proj.baseDamage = baseDamage; proj.damage = scaled;
    if (!scene._enemyVisionMask) { scene._needsMaskProj = scene._needsMaskProj || []; scene._needsMaskProj.push(proj); }
  }
}

// #65 Signature-Angriff: ANSTURM (Tank). Telegraph = rote Gefahren-Linie in
// Spielerrichtung (Aim gelockt); dann prescht der Boss die Bahn entlang, Schaden
// wer nahe an der Linie steht. Seitlich ausweichen = kein Treffer.
function miniBossCharge(enemy) {
  const scene = this;
  if (!player || !player.active || !scene.time) return;
  const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const TELE = 700, DASH = 430, dist = 210, w = 46;
  const sx = enemy.x, sy = enemy.y;
  const ex = sx + Math.cos(ang) * dist, ey = sy + Math.sin(ang) * dist;
  enemy._castingUntil = scene.time.now + TELE;
  const g = scene.add.graphics().setDepth(1001);
  const st = { t: 0 };
  scene.tweens.add({
    targets: st, t: 1, duration: TELE, ease: 'Linear',
    onUpdate: () => {
      if (!g.scene) return;
      g.clear();
      const blink = 0.5 + 0.5 * Math.sin(st.t * st.t * 30);
      g.lineStyle(w, 0xff3311, 0.10 + 0.16 * st.t); g.lineBetween(sx, sy, ex, ey);
      g.lineStyle(3, 0xff6644, 0.5 + 0.4 * blink); g.lineBetween(sx, sy, ex, ey);
    },
    onComplete: () => {
      if (!g.scene) return;
      if (!enemy.active) { g.destroy(); return; }
      enemy._dashTarget = { x: ex, y: ey };
      enemy._dashSpeed = 950;
      enemy._dashUntil = scene.time.now + DASH;
      enemy._dashOnArrive = () => {
        if (player && player.active) {
          const d = _distPointToSegment(player.x, player.y, sx, sy, ex, ey);
          if (d <= w * 0.6 + (player.body?.width || 0) * 0.5) applyPlayerDamage(enemy.damage, scene, enemy);
        }
        try { scene.cameras.main.shake(140, 0.004); } catch (e) {}
      };
      g.clear();
      scene.time.delayedCall(160, () => { if (g.scene) g.destroy(); });
    }
  });
}

// #65 Signature-Angriff: SPRUNG-SLAM (schneller Nahkampf). Telegraph = Zielkreis
// an der aktuellen Spielerposition (gelockt); der Boss springt dorthin, Landung =
// AoE. Wegbewegen, sobald der Kreis erscheint.
function miniBossLeap(enemy) {
  const scene = this;
  if (!player || !player.active || !scene.time) return;
  const tx = player.x, ty = player.y;
  const TELE = 620, DASH = 380, r = 105;
  const baseScale = enemy.scaleX || 1;
  enemy._castingUntil = scene.time.now + TELE;
  const g = scene.add.graphics().setDepth(1001);
  const st = { t: 0 };
  scene.tweens.add({
    targets: st, t: 1, duration: TELE, ease: 'Linear',
    onUpdate: () => {
      if (!g.scene) return;
      g.clear();
      const blink = 0.5 + 0.5 * Math.sin(st.t * st.t * 30);
      g.lineStyle(3, 0xffaa33, 0.5 + 0.4 * blink).strokeCircle(tx, ty, r);
      g.fillStyle(0xffaa00, 0.10 + 0.15 * st.t).fillCircle(tx, ty, r * (0.2 + 0.8 * st.t));
    },
    onComplete: () => {
      if (!g.scene) return;
      if (!enemy.active) { g.destroy(); return; }
      enemy._dashTarget = { x: tx, y: ty };
      enemy._dashSpeed = 1150;
      enemy._dashUntil = scene.time.now + DASH;
      enemy._dashOnArrive = () => {
        if (enemy.active && enemy.setScale) enemy.setScale(baseScale);
        if (!g.scene) return;
        g.clear();
        g.fillStyle(0xffbb44, 0.5).fillCircle(tx, ty, r);
        g.lineStyle(4, 0xffe0a0, 1).strokeCircle(tx, ty, r);
        if (player && player.active) {
          const d = Phaser.Math.Distance.Between(tx, ty, player.x, player.y);
          if (d <= r + (player.body?.width || 0) * 0.5) applyPlayerDamage(enemy.damage, scene, enemy);
        }
        try { scene.cameras.main.shake(130, 0.004); } catch (e) {}
        scene.time.delayedCall(150, () => { if (g.scene) g.destroy(); });
      };
      if (enemy.active) scene.tweens.add({ targets: enemy, scaleX: baseScale * 1.3, scaleY: baseScale * 1.3, duration: DASH / 2, yoyo: true });
    }
  });
}

// #65 Signature-Angriff: SALVE (Fernkampf). Telegraph = aufleuchtender Kegel in
// Blickrichtung; dann eine Projektil-Salve in genau diesen Bogen. Aus dem Kegel
// raus = ausweichen. Boss steht waehrend des Telegraphs.
function miniBossSalve(enemy) {
  const scene = this;
  if (!player || !player.active || !scene.time) return;
  const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const TELE = 700, cone = 0.9, len = 320, N = 7;
  enemy._castingUntil = scene.time.now + TELE + 100;
  const g = scene.add.graphics().setDepth(1001);
  const st = { t: 0 };
  scene.tweens.add({
    targets: st, t: 1, duration: TELE, ease: 'Linear',
    onUpdate: () => {
      if (!g.scene) return;
      g.clear();
      const blink = 0.5 + 0.5 * Math.sin(st.t * st.t * 30);
      const a1 = ang - cone / 2, a2 = ang + cone / 2;
      g.fillStyle(0xffcc33, 0.08 + 0.14 * st.t);
      g.beginPath();
      g.moveTo(enemy.x, enemy.y);
      g.lineTo(enemy.x + Math.cos(a1) * len, enemy.y + Math.sin(a1) * len);
      g.lineTo(enemy.x + Math.cos(a2) * len, enemy.y + Math.sin(a2) * len);
      g.closePath(); g.fillPath();
      g.lineStyle(2, 0xffdd66, 0.5 + 0.4 * blink); g.strokePath();
    },
    onComplete: () => {
      if (!g.scene) return;
      if (enemy.active && typeof _fireLockedSpread === 'function') {
        try { _fireLockedSpread.call(scene, enemy, N, cone, ang); } catch (e) {}
      }
      g.clear();
      scene.time.delayedCall(120, () => { if (g.scene) g.destroy(); });
    }
  });
}

/**
 * Spawnt einen Mini-Boss: verstärkter Gegner mit HP-Balken und Spezialangriff.
 * Erscheint alle 5 Wellen (nicht die 10er-Boss-Wellen).
 */
// #65 Phase 2: Mini-Boss-Verzauberungen — je EINE mit grossem Impact, klar per
// Name + Aura-Farbe (Tint) erkennbar. `resist` wirkt im Schadens-Funnel
// (player.js dealDamageToEnemy) ueber die Quelle (ranged/melee/skill);
// reflect (Dornen) ebenfalls dort; healFrac + speedMul hier/in der Update-Loop.
// #65 Phase 3: `weight` (Auswahl-Gewicht) + `minDepth` (ab wann verfuegbar) je
// Verzauberung -> tiefen-gewichteter Pool. Die drei Resistenzen kommen frueh (ab
// Tiefe 3), die staerkeren Effekte (Dornen/Rasend/Zaeh) gestaffelt tiefer.
const MINIBOSS_ENCHANTS = [
  { id: 'warded',      de: 'Bannschild',      en: 'Warded',      aura: 0x66aaff, resist: 'skill',  resistMul: 0.30, weight: 3, minDepth: 3 },
  { id: 'bulwark',     de: 'Fernkampfpanzer', en: 'Ranged Ward', aura: 0x88cc66, resist: 'ranged', resistMul: 0.30, weight: 3, minDepth: 3 },
  { id: 'bruiser',     de: 'Nahkampfhaut',    en: 'Melee Ward',  aura: 0xcc8844, resist: 'melee',  resistMul: 0.30, weight: 3, minDepth: 3 },
  { id: 'swift',       de: 'Rasend',          en: 'Swift',       aura: 0xffdd55, speedMul: 1.6,     weight: 2, minDepth: 4 },
  { id: 'thorns',      de: 'Dornen',          en: 'Thorns',      aura: 0xff5555, reflect: 0.35,     weight: 2, minDepth: 5 },
  { id: 'regenerator', de: 'Zaeh',            en: 'Regenerating',aura: 0x66cc99, healFrac: 0.04,    weight: 2, minDepth: 6 },
];
// Tiefen-Skalierung: ab Tiefe 8 haerter. Gibt eine KOPIE zurueck, damit die
// Registry-Basiswerte unveraendert bleiben.
function _scaleEnchant(e, depth) {
  if (!e || depth < 8) return e;
  const s = Object.assign({}, e);
  if (s.resistMul) s.resistMul = Math.max(0.15, s.resistMul - 0.10); // 0.30 -> 0.20 (staerker)
  if (s.reflect)   s.reflect   = Math.min(0.60, s.reflect + 0.15);   // 0.35 -> 0.50
  if (s.healFrac)  s.healFrac  = Math.min(0.08, s.healFrac + 0.02);  // 0.04 -> 0.06
  if (s.speedMul)  s.speedMul  = Math.min(2.0,  s.speedMul + 0.2);   // 1.6 -> 1.8
  return s;
}
function _pickMiniBossEnchant(depth) {
  const d = Math.max(1, depth || 1);
  const pool = MINIBOSS_ENCHANTS.filter((e) => (e.minDepth || 1) <= d);
  if (!pool.length) return null;
  let total = pool.reduce((s, e) => s + (e.weight || 1), 0);
  let roll = Math.random() * total;
  let chosen = pool[pool.length - 1];
  for (const e of pool) { roll -= (e.weight || 1); if (roll <= 0) { chosen = e; break; } }
  return _scaleEnchant(chosen, d);
}
function _enchantLabel(e) {
  const isEn = (typeof window !== 'undefined' && window.i18n
    && typeof window.i18n.getLang === 'function' && window.i18n.getLang() === 'en');
  return isEn ? e.en : e.de;
}

function spawnMiniBoss(xCoord, yCoord, baseType) {
  const scene = this && this.sys ? this : window.currentScene || obstacles?.scene;
  if (!scene) return null;

  // #65 Phase 1: Basistyp-VARIANZ. Ein expliziter, gueltiger baseType wird
  // respektiert; sonst zieht spawnEnemy (ohne Typ) einen zufaelligen Typ aus dem
  // tiefen-/akt-gegateten Gegnerpool -> der Mini-Boss ist nicht mehr immer der
  // Brute, sondern ein tiefen-passender Gegner (Nahkampf/Fernkampf/Tank ...).
  let enemy;
  if (typeof baseType === 'number' && baseType >= 1 && baseType <= 7) {
    enemy = spawnEnemy.call(scene, xCoord || 0, yCoord || 0, baseType);
  } else {
    enemy = spawnEnemy.call(scene, xCoord || 0, yCoord || 0);
  }
  if (!enemy) return null;

  // Mini-boss stats. HP-Multiplikator angehoben (Mini-Bosse gingen zu schnell
  // um): Tiefe 1-2 x12, Tiefe 3-4 x14, ab Tiefe 5 x16 (skaliert zusaetzlich mit
  // der run-konstanten Tiefe des Basisgegners) — nochmals verdoppelt gegenueber
  // 6/7/8, damit Mini-Bosse wie die Vollbosse doppelt so viel HP haben.
  // Frueh leicht flacher, damit der Tiefe-1..4-Climax auf der Onboarding-Rampe
  // schlagbar bleibt.
  const _depth = Math.max(1, (typeof window !== 'undefined' && window.DUNGEON_DEPTH) || window.currentWave || 1);
  const _hpMult = _depth <= 2 ? 12 : (_depth <= 4 ? 14 : 16);
  enemy.isMiniBoss = true;
  enemy.hp = Math.ceil(enemy.hp * _hpMult);
  enemy.maxHp = enemy.hp;
  enemy.baseDamage = Math.ceil((enemy.baseDamage || enemy.damage || 1) * 1.5);
  enemy.damage = enemy.baseDamage;
  enemy.lastSlamTime = 0;

  // #65: Signature-Angriff je Archetyp (nach BASIS-Tempo, vor evtl. Swift-Enchant).
  //   Fernkampf   -> Salve (Kegel-Projektile)
  //   langsamer Nahkampf (Tank) -> Ansturm (Charge-Linie)
  //   schneller Nahkampf        -> Sprung-Slam (Leap-AoE)
  if (enemy.isRanged) { enemy._signature = 'salve'; enemy._specialCd = 4200; }
  else if ((enemy.speed || 70) <= 70) { enemy._signature = 'charge'; enemy._specialCd = 5200; }
  else { enemy._signature = 'leap'; enemy._specialCd = 4600; }

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

  // Simple health bar (like boss but smaller) — added to enemyLayer so it
  // respects the fog-of-war vision mask and only shows when enemy is visible
  enemy.miniBossBar = scene.add.graphics().setDepth(1002);
  if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') {
    scene.enemyLayer.add(enemy.miniBossBar);
  }
  enemy.on('destroy', () => enemy.miniBossBar?.destroy());

  // #65 Phase 2: ab Tiefe 3 eine Verzauberung. Aura-Farbe (Tint) ueberschreibt
  // das generische Orange -> klar erkennbar; speed wirkt sofort ueber enemy.speed,
  // resist/reflect/heal an ihren Stellen. Ein Namens-Label ueber der HP-Leiste.
  if (_depth >= 3) {
    const ench = _pickMiniBossEnchant(_depth);
    if (ench) {
    enemy._enchant = ench;
    enemy.setTint(ench.aura);
    if (ench.speedMul) enemy.speed = Math.round((enemy.speed || 70) * ench.speedMul);
    enemy._lastHealMs = 0;
    const lbl = scene.add.text(enemy.x, enemy.y, _enchantLabel(ench), {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(1003);
    if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') scene.enemyLayer.add(lbl);
    enemy.miniBossLabel = lbl;
    enemy.on('destroy', () => enemy.miniBossLabel?.destroy());
    }
  }

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

// Generic enemy health bar — created lazily by handleEnemyHit on the first
// hit and redrawn every frame from the enemy update loop. Smaller than the
// mini-boss bar (38x3 px) so a roomful of them doesn't clutter the screen.
function drawEnemyHpBar(enemy) {
  const g = enemy.hpBar;
  if (!g) return;
  g.clear();
  if (!enemy.active) return;
  const maxHp = enemy.maxHp || enemy.maxHealth || enemy.hp || 1;
  const pct = Phaser.Math.Clamp(enemy.hp / maxHp, 0, 1);
  // No bar once the enemy is dead — the destroy hook removes the graphics
  // anyway, but skip the draw in case we get one extra update frame first.
  if (pct <= 0) return;
  const barW = 38;
  const barH = 3;
  const x = enemy.x - barW / 2;
  const y = enemy.y - (enemy.displayHeight || 24) / 2 - 8;
  g.fillStyle(0x000000, 0.6);
  g.fillRect(x - 1, y - 1, barW + 2, barH + 2);
  // Color shifts red->yellow->green as HP rises (more readable than a single
  // colour for skimming a roomful of enemies).
  let color = 0xe53935; // red
  if (pct > 0.66) color = 0x66bb6a;       // green
  else if (pct > 0.33) color = 0xfdd835;  // yellow
  g.fillStyle(color, 1);
  g.fillRect(x, y, barW * pct, barH);
}

// --- Pluenderer (#129) -------------------------------------------------------

/**
 * NAECHSTE Treppe zum Fluechtenden — nicht die erste beste.
 *
 * Raeume haben bis zu vier Treppen (gemessen). Die erste aus der Gruppe lag
 * gern auf der anderen Raumseite, hinter dem Spieler: der Pluenderer rannte
 * dann quer an ihm vorbei und sah aus, als flöhe er ueberhaupt nicht.
 */
function _pluendererTreppe(scene, enemy) {
  try {
    var grp = scene && scene.stairsGroup;
    if (!grp || typeof grp.getChildren !== 'function') return null;
    var liste = grp.getChildren();
    var beste = null, bestD = Infinity;
    for (var i = 0; i < liste.length; i++) {
      var s = liste[i];
      if (!s || !s.active) continue;
      if (!enemy) return s;
      var dx = s.x - enemy.x, dy = s.y - enemy.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; beste = s; }
    }
    return beste;
  } catch (e) {}
  return null;
}

/**
 * Sieht der Spieler den Pluenderer gerade?
 *
 * Die Meldung "Einer von ihnen traegt Beute" kam bisher in dem Moment, in dem
 * der Hinterhalt die Gegner setzte — also bevor man ueberhaupt jemanden sah.
 * Sie soll erst kommen, wenn er im Bild ist; sonst sucht man einen Goldton,
 * der noch gar nicht da ist.
 */
function _pluendererSichtbar(scene, enemy) {
  if (!scene || !enemy || !enemy.active) return false;
  if (typeof player === 'undefined' || !player) return false;
  var dx = enemy.x - player.x, dy = enemy.y - player.y;
  if (dx * dx + dy * dy > 420 * 420) return false;          // ausserhalb des Blickfelds
  try {
    var poly = scene._lastVisionPolygon;
    if (poly && poly.length >= 6 && window.Phaser && window.Phaser.Geom
        && window.Phaser.Geom.Polygon) {
      if (!scene.__plPolyObj || scene.__plPolyData !== poly) {
        scene.__plPolyObj = new window.Phaser.Geom.Polygon(poly);
        scene.__plPolyData = poly;
      }
      return window.Phaser.Geom.Polygon.Contains(scene.__plPolyObj, enemy.x, enemy.y);
    }
  } catch (e) {}
  // Ohne Sichtpolygon (Desktop ohne Nebel): Naehe genuegt.
  return true;
}

/**
 * Wohin springt er?
 *
 * Erste Wahl ist die Treppe. Steht eine Wand im Weg, faechert er auf: erst
 * schraeg an der Wand vorbei, dann notfalls einfach vom Spieler weg. Ohne
 * diesen Faecher blieb er in verwinkelten Raeumen einfach stehen — gemessen
 * 517 px zur Treppe vor dem Sprungversuch, 522 danach — und verhielt sich dann
 * wie jeder andere Gegner, obwohl die Meldung eine Jagd versprach.
 *
 * Der Sprung ist kurz gehalten, damit er nicht quer durch den Raum saust und
 * die Jagd aussichtslos wird.
 */
function _pluendererFluchtziel(scene, enemy) {
  var richtungen = [];
  var treppe = _pluendererTreppe(scene, enemy);
  if (treppe) richtungen.push(Math.atan2(treppe.y - enemy.y, treppe.x - enemy.x));
  if (typeof player !== 'undefined' && player) {
    richtungen.push(Math.atan2(enemy.y - player.y, enemy.x - player.x));
  }
  if (!richtungen.length) return null;

  // Je Grundrichtung erst geradeaus, dann schraeg — und je Winkel von weit
  // nach kurz. So bleibt die Treppe die erste Wahl, ohne dass eine Wand die
  // Flucht ganz verhindert.
  var abweichungen = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6];
  // Kuerzere Saetze: 260 px waren gut ein Drittel der Blickfeldbreite auf
  // einmal — das las sich als Sprung, nicht als Flucht.
  var weiten = [150, 110, 75, 45];
  var frei = function (x, y) {
    try {
      if (scene.isPointAccessible && !scene.isPointAccessible(x, y)) return false;
      if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(x, y)) return false;
    } catch (e) {}
    return true;
  };

  for (var r = 0; r < richtungen.length; r++) {
    for (var a = 0; a < abweichungen.length; a++) {
      var winkel = richtungen[r] + abweichungen[a];
      for (var w = 0; w < weiten.length; w++) {
        var nx = enemy.x + Math.cos(winkel) * weiten[w];
        var ny = enemy.y + Math.sin(winkel) * weiten[w];
        if (frei(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/** Steht er auf der Treppe? Dann ist er unten durch. */
function _pluendererAmAusgang(scene, enemy) {
  var treppe = _pluendererTreppe(scene, enemy);
  if (!treppe) return false;
  var dx = treppe.x - enemy.x, dy = treppe.y - enemy.y;
  return (dx * dx + dy * dy) < 48 * 48;
}

/**
 * Er entkommt: Beute weg, Meldung, Gegner weg.
 *
 * Die Beutedaten werden VOR dem Zerstoeren geloescht — sonst schuettet der
 * Todes-Pfad in player.js sie doch noch aus, und die Flucht waere folgenlos.
 */
function _pluendererEntkommt(scene, enemy) {
  try {
    enemy.setData('pluendererGold', 0);
    enemy._istPluenderer = false;
  } catch (e) {}
  try {
    var schein = enemy.getData && enemy.getData('pluendererSchein');
    if (schein && schein.destroy) schein.destroy();
  } catch (e) {}
  try {
    if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
      window.EventSystem.showToast(scene, _pluendererText(), 'ambush');
    }
  } catch (e) {}
  try { enemy.destroy(); } catch (e) {}
}

/** "Einer von ihnen traegt Beute" — erst bei Sicht. */
function _pluendererMeldung() {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t('event.ambush.toast_looter');
      if (v && String(v).indexOf('[MISSING:') !== 0) return v;
    }
  } catch (e) {}
  return 'Einer von ihnen traegt Beute — und will damit weg!';
}

function _pluendererText() {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      var v = window.i18n.t('event.ambush.looter_escaped');
      if (v && String(v).indexOf('[MISSING:') !== 0) return v;
    }
  } catch (e) {}
  return 'Der Pluenderer ist mit der Beute die Treppe hinunter.';
}

function hitByMelee(playerSprite, enemy) {
  if (!enemy || !enemy.active) return;
  // Zeitbasis: die Szenenuhr — DIESELBE, mit der die Angriffs-KI rechnet.
  //
  // Hier stand Date.now(). Beide Schadenspfade schreiben aber in dasselbe Feld
  // enemy.lastAttackTime: die KI stempelt die Szenenzeit (Sekunden seit
  // Szenenstart), dieser Pfad stempelte eine Unix-Zeit (~1,79 Billionen).
  // Sobald sich die Koerper einmal beruehrten — also genau dann, wenn man auf
  // dem Gegner steht — war 'time - lastAttackTime' in der KI fuer immer
  // negativ und ihre Abklingzeit nie wieder erreicht. Der Gegner griff danach
  // NIE mehr sichtbar an, sondern verteilte nur noch stillen Beruehrungs-
  // schaden. Gemessen: Wolf auf 22 px, 250 Bilder, genau 1 Angriff; auf 60 px
  // (kein Koerperkontakt) drei.
  //
  // Und die Abklingzeit ist bewusst LAENGER als die der KI. Beide Pfade
  // teilen sich ein Feld; wer zuerst stempelt, schiebt den anderen. Bei
  // Koerperkontakt gewann bisher immer die Beruehrung — der Gegner stand
  // scheinbar untaetig auf dem Spieler und tat trotzdem weh. Mit dem
  // laengeren Takt kommt die KI jedes Mal zuerst dran, und die Beruehrung
  // bleibt das, was sie sein soll: der Notnagel fuer die Faelle, in denen die
  // KI nicht zuschlaegt (Fernkaempfer, den man mit dem Koerper blockiert).
  // Gemessen bei 22 px Abstand ueber 250 Bilder: vorher 1 sichtbarer Angriff,
  // danach 3 — genauso viele wie ausserhalb der Koerperreichweite.
  const now = (this && this.time && typeof this.time.now === 'number')
    ? this.time.now : Date.now();
  const _cdMul = (typeof enemy._attackCdMul === 'number' && enemy._attackCdMul > 0)
    ? enemy._attackCdMul : 1;
  if (!enemy.lastAttackTime || now - enemy.lastAttackTime > 1500 * _cdMul + 600) {
    enemy.lastAttackTime = now;
    const difficulty = getDifficultyMultiplierValue();
    const baseDamage = enemy.baseDamage || enemy.damage || 1;
    const scaledDamage = difficulty !== 1
      ? Math.max(1, Math.round(baseDamage * difficulty))
      : Math.max(1, Math.round(baseDamage));
    enemy.damage = scaledDamage;
    applyPlayerDamage(scaledDamage, this, enemy);
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
  releaseEnemyProjectile(projectile);
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
      // Archer projectiles: 10% chance to apply BLEED
      if (Math.random() < 0.1) {
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

// `attacker` ist OPTIONAL und nur fuer Gegner-Affixe noetig (#90: vampiric,
// berserker). Alle Alt-Aufrufe ohne dritten Parameter verhalten sich unveraendert.
function applyPlayerDamage(rawDamage, scene, attacker) {
  // #90 Elite-Affix 'berserker': unter 30% eigener HP doppelter Schaden.
  // VOR der Ausweich-/Ruestungsrechnung, damit es wie ein staerkerer Schlag wirkt.
  if (attacker && attacker.isBerserker) {
    const _mx = (typeof attacker.maxHp === 'number' && attacker.maxHp > 0) ? attacker.maxHp : null;
    if (_mx && (attacker.hp / _mx) < 0.3) rawDamage = rawDamage * 2;
  }

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

  // Feature 059 WP03: Zweiter Atem (revive) — once per run, lethal damage is
  // survived at 1 HP with ~1.5s invulnerability instead of killing the player.
  if (window.AmuletEffects && typeof window.AmuletEffects.canRevive === 'function'
      && window.AmuletEffects.canRevive()
      && typeof playerHealth === 'number' && (playerHealth - mitigated) <= 0) {
    window.AmuletEffects.consumeRevive();
    playerHealth = 1;
    if (typeof updateHUD === 'function') { try { updateHUD(); } catch (e) {} }
    window._playerInvincible = true;
    if (scene && scene.time && scene.time.delayedCall) {
      scene.time.delayedCall(1500, () => { window._playerInvincible = false; });
    } else { setTimeout(() => { window._playerInvincible = false; }, 1500); }
    if (player && player.setTint) {
      player.setTint(0xffe066);
      if (scene && scene.time) scene.time.delayedCall(1500, () => { if (player && player.clearTint) player.clearTint(); });
    }
    return 0;
  }

  if (typeof addPlayerHealth === 'function') {
    addPlayerHealth(-mitigated);
  } else {
    playerHealth = Math.max(0, playerHealth - mitigated);
    if (typeof updateHUD === 'function') updateHUD();
  }

  if (window.soundManager) window.soundManager.playSFX('hit_player');

  // #90 Elite-Affix 'vampiric': der Angreifer heilt sich am zugefuegten Schaden.
  // Auf maxHp gedeckelt; ohne maxHp (normale Gegner tragen es erst ab dem ersten
  // Treffer) wird nichts geheilt, statt einen unbegrenzten Heilwert zu erlauben.
  if (attacker && attacker.isVampiric && attacker.active && typeof attacker.hp === 'number') {
    const _mx = (typeof attacker.maxHp === 'number' && attacker.maxHp > 0) ? attacker.maxHp : null;
    if (_mx) {
      const _heal = Math.max(1, Math.round(mitigated * (attacker.lifestealPct || 0.30)));
      attacker.hp = Math.min(_mx, attacker.hp + _heal);
      if (typeof drawEnemyHpBar === 'function' && attacker.hpBar) {
        try { drawEnemyHpBar(attacker); } catch (e) { /* nie den Treffer brechen */ }
      }
    }
  }

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
// WICHTIG zu `baseHP`: das ist die HP auf TIEFE 1, nicht die absolute HP.
// makeBoss multipliziert mit derselben Tiefen-Kurve wie normale Gegner
// (1 + (depth-1)*0.1). Vorher war baseHP absolut und Bosse skalierten GAR NICHT
// mit der Tiefe — dadurch war der Kettenmeister (96 HP) auf Tiefe 10 nur 1.6x
// so zaeh wie ein durchschnittlicher Mini-Boss (60.8 HP), der JEDEN Raum
// abschliesst, und schwaecher als ein zaeher Mini-Boss (bis 160 HP).
// Kalibrierung (Ziel: Boss ~3x Mini-Boss-Durchschnitt auf seiner Gate-Tiefe
// UND ueber dem ZAEHESTEN Mini-Boss dort). Die erste Kalibrierung mass nur
// drei Mini-Boss-Typen und lag daher zu tief: ueber alle zwoelf Typen reicht
// die Spanne auf T10 bis 192 HP (T20: 288, T30: 384), womit der Boss auf T10
// und T20 SCHWAECHER war als ein Mini-Boss, der jeden gewoehnlichen Raum
// abschliesst. Werte unten gegen die volle Spanne nachgemessen.
//   Kettenmeister      @T10: 118 * 1.9 = 225 HP = 3.01x Schnitt (max 192)
//   Zeremonienmeister  @T20: 120 * 2.9 = 348 HP = 3.00x Schnitt (max 288)
//   Schattenrat        @T30: 123 * 3.9 = 480 HP = 3.05x Schnitt (max 384)
const BOSS_DEFINITIONS = {
  chainMaster: {
    id: 'chainMaster',
    name: 'Kettenmeister',
    texture: 'boss_chain_right0',
    fallbackTexture: 'sprite_boss_chain',
    baseHP: 118,
    baseSpeed: 70,
    baseDamage: 6,
    scale: 1.6,
    loreIntro: 'Der Kettenmeister fesselt, was der Rat verschwinden lässt. Hinter ihm liegen die ersten Siegel — der erste harte Beweis.',
    attacks: ['chainWhip', 'chainPull', 'groundChains'],
    attackCooldown: 2900,
  },
  ceremonyMaster: {
    id: 'ceremonyMaster',
    name: 'Zeremonienmeister',
    texture: 'boss_ceremony_right0',
    fallbackTexture: 'sprite_boss_ceremony',
    baseHP: 120,
    baseSpeed: 45,
    baseDamage: 9,
    scale: 1.7,
    loreIntro: 'Der Zeremonienmeister vollzieht die verbotenen Rituale des Rats — jedes Siegel, das er zieht, kettet die Stadt fester.',
    attacks: ['ritualCircle', 'summonMinions', 'darkBlast'],
    attackCooldown: 4000,
  },
  shadowCouncillor: {
    id: 'shadowCouncillor',
    name: 'Schattenrat',
    texture: 'boss_shadow_right0',
    fallbackTexture: 'sprite_boss_shadow',
    // Finaler Boss der Leiter (Tiefe 30) — bewusst härter als die beiden davor
    // und als die 3x-Regel: 123 * 3.9 = 480 HP auf Tiefe 30 = 3.95x Mini-Boss.
    // Damit bleibt seine absolute HP gegenüber vorher exakt gleich (480), er
    // skaliert jetzt aber in späteren Zyklen korrekt mit. 2x Schaden (8->16),
    // scale 1.8->3.6 = doppelte Darstellungsgrösse (bossTargetPx = 96 * scale).
    baseHP: 123,
    baseSpeed: 70,
    baseDamage: 16,
    scale: 3.6,
    loreIntro: 'Ein Mitglied des Kettenrats selbst tritt aus dem Schatten — und mit ihm die Quelle des Nebels, die er hütet.',
    attacks: ['shadowDash', 'darknessWave', 'shadowClones'],
    attackCooldown: 3000,
  },
};

// Debug: welchen Boss meint ?boss=<name>? Akzeptiert die interne Id und den
// deutschen Namen, klein geschrieben und ohne Umlaute — beim Tippen in die
// Adresszeile will niemand nachschlagen.
const BOSS_ALIASE = {
  chainmaster: 'chainMaster', kettenmeister: 'chainMaster', ketten: 'chainMaster', '1': 'chainMaster',
  ceremonymaster: 'ceremonyMaster', zeremonienmeister: 'ceremonyMaster', zeremonie: 'ceremonyMaster', '2': 'ceremonyMaster',
  shadowcouncillor: 'shadowCouncillor', schattenrat: 'shadowCouncillor', schatten: 'shadowCouncillor', '3': 'shadowCouncillor'
};

/**
 * Erzwungener Boss aus ?boss=<name> (#88-Gate), oder null.
 *
 * Der regulaere Weg zu einem Boss ist lang: richtige Tiefe, Finalraum, Akt 2+.
 * Zum Ansehen einer Inszenierung ist das unbrauchbar.
 */
function debugForcedBoss() {
  try {
    if (typeof window === 'undefined' || !window.DebugGate) return null;
    var v = window.DebugGate.flagge('boss');
    if (!v) return null;
    var id = BOSS_ALIASE[String(v).toLowerCase()];
    if (!id && BOSS_DEFINITIONS[v]) id = v;
    if (!id) {
      try {
        console.warn('[?boss] unbekannt: "' + v + '" — bekannt sind: '
          + Object.keys(BOSS_ALIASE).join(', '));
      } catch (e) {}
      return null;
    }
    return BOSS_DEFINITIONS[id] || null;
  } catch (e) { return null; }
}

// Fuer wave.js: nur wenn der Name AUFLOESBAR ist, darf der Debug-Zweig
// gezogen werden. Sonst landete ?boss=quatsch im Boss-Zweig ohne Definition
// und riss das Spiel mit (gemessen).
if (typeof window !== 'undefined') window.debugForcedBoss = debugForcedBoss;

function getBossDefinition(wave) {
  var _erzwungen = debugForcedBoss();
  if (_erzwungen) return { def: _erzwungen, cycle: 0 };
  const bossOrder = ['chainMaster', 'ceremonyMaster', 'shadowCouncillor'];
  const bossIndex = (Math.floor(wave / 10) - 1) % 3;
  const cycle = Math.max(0, Math.floor((Math.floor(wave / 10) - 1) / 3));
  // Unter Welle 10 ist bossIndex negativ und der Zugriff undefined — bisher
  // unerreichbar (Tier-Gate), aber ein Absturz, sobald ein Aufrufer frueher
  // fragt. Erster Boss als Rueckfall.
  const id = bossOrder[bossIndex] || bossOrder[0];
  return { def: BOSS_DEFINITIONS[id], cycle: cycle };
}

function spawnBoss() {
  // #62: Boss-Arena — vorhandene Trash-Gegner entfernen, damit der Bosskampf
  // ohne sonstige Gegner stattfindet. Boss-Adds (summonMinions) sind Teil des
  // Kampfes und kommen erst danach. Neue reguläre Spawns sind in der Boss-Welle
  // bereits unterbunden (wave.js: spawnedEnemiesInWave = 0).
  try {
    if (typeof enemies !== 'undefined' && enemies && typeof enemies.getChildren === 'function') {
      enemies.getChildren().slice().forEach(function (e) {
        if (e && e.active && !e.isBoss) { try { e.destroy(); } catch (_) {} }
      });
    }
  } catch (_) {}

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

  // Scale boss textures to game size (~96px display)
  if (textureKey.startsWith('boss_') || textureKey.startsWith('sprite_')) {
    const targetSize = 96;
    const srcH = boss.height || 300;
    boss.setScale(targetSize / srcH);
  }

  // Boss sprite animation setup
  if (textureKey.startsWith('boss_')) {
    const bossPrefix = textureKey.replace('_right0', '').replace('_left0', '');
    boss._bossPrefix = bossPrefix;
    boss._bossDirection = 'right';
    boss._bossAttacking = false;
  }

  makeBoss.call(this, boss, def, cycle);

  // #77: Bei der inszenierten Erstbegegnung KEIN Blitz und kein Ruckeln —
  // beides zerschlaegt genau den ruhigen Moment, den der Beat herstellt.
  const _inszeniert = _istInszenierteBegegnung(def);
  if (!_inszeniert && this.cameras?.main) {
    this.cameras.main.flash(300, 255, 255, 255, true);
    this.cameras.main.shake(400, 0.01);
  }

  // #77: Vorkampf-Beat statt Banner — aber nur einmal, und nur wenn das Modul
  // da ist und den Beat auch wirklich uebernimmt. Sonst der bisherige Banner.
  let _beatLaeuft = false;
  if (_inszeniert && typeof window !== 'undefined'
      && window.BossIntro && typeof window.BossIntro.inszeniere === 'function') {
    try {
      _beatLaeuft = window.BossIntro.inszeniere(this, boss, def.name, _bossIntroLore(def));
    } catch (e) { _beatLaeuft = false; }
  }
  if (!_beatLaeuft) showBossIntro.call(this, def);

  // #109: Der Aufrufer braucht den Boss, um ihn als Klimax-Gegner zu fuehren
  // (wave.js -> window.__climaxEnemy) und damit die Treppe zu sperren.
  return boss;
}

// Wenn die fuehrende Quest aktiv ist, liest die Kettenmeister-Intro nicht die
// generische Lore, sondern knuepft an Maras Warnung an — so ist die (durch die
// Tiefensperre garantiert quest-getriebene) ERSTE Begegnung eine echte
// Inszenierung statt eines anonymen Boss-Banners.
/**
 * Ist das die inszenierte ERSTE Begegnung mit dem Kettenmeister?
 *
 * Bedingung ist die aktive Quest, nicht die Tiefe: die Tiefensperre in
 * runDepth.js garantiert ohnehin, dass man den Boss ohne `mara_warning` nicht
 * erreicht. Wer spaeter wieder auf Tiefe 10 hinabsteigt, bekommt den kurzen
 * Banner — ein Beat, den man zum fuenften Mal sieht, ist eine Wartezeit.
 */
function _istInszenierteBegegnung(def) {
  if (!def || def.id !== 'chainMaster') return false;
  // Debug: ?beat=1 zeigt die Inszenierung, ohne mara_warning spielen zu muessen.
  try {
    if (typeof window !== 'undefined' && window.DebugGate && window.DebugGate.an('beat')) return true;
  } catch (e) {}
  try {
    if (typeof window === 'undefined' || !window.questSystem
        || typeof window.questSystem.getActiveQuests !== 'function') return false;
    var active = window.questSystem.getActiveQuests() || [];
    return active.some(function (q) { return q && q.id === 'mara_warning'; });
  } catch (e) { return false; }
}

function _bossIntroLore(def) {
  if (_istInszenierteBegegnung(def)) {
    return 'Die Siegel, vor denen Mara warnte. Der Kettenmeister fesselt, '
      + 'was der Rat verschwinden lässt — schlag die Ketten, sonst wirst Du '
      + 'selbst zu einem Namen auf seinen Listen.';
  }
  return def.loreIntro;
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

  const loreText = scene.add.text(cx, cy + 16, _bossIntroLore(def), {
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#dddddd',
    stroke: '#000000',
    strokeThickness: 3,
    align: 'center',
    wordWrap: { width: Math.min(680, scene.scale.width - 60) },
  }).setOrigin(0.5).setDepth(1100).setScrollFactor(0);

  nameText.setAlpha(0);
  loreText.setAlpha(0);

  scene.tweens.add({
    targets: [nameText, loreText],
    alpha: 1,
    duration: 500,
    onComplete: () => {
      scene.time.delayedCall(3200, () => {
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

// Ermittelt die enge Bounding-Box der sichtbaren (nicht-transparenten) Pixel
// einer Textur — gecacht pro Textur-Key. Die Boss-Kunst hat teils riesige
// transparente Ränder (boss_shadow: Figur in der oberen Hälfte eines
// 307x1024-Frames), und Arcades Standard-Body ist das VOLLE Frame. Dadurch
// reichte die Hitbox weit unter das sichtbare Sprite. Werte sind UNSKALIERTE
// Textur-Pixel — Phaser skaliert den Body mit dem Sprite.
var _spriteAlphaBoundsCache = {};
function _computeSpriteAlphaBounds(sprite) {
  try {
    if (typeof document === 'undefined') return null;
    var frame = sprite.frame;
    var src = sprite.texture && sprite.texture.getSourceImage && sprite.texture.getSourceImage();
    if (!src) return null;
    var fw = frame ? frame.width : src.width;
    var fh = frame ? frame.height : src.height;
    var fx = frame ? frame.cutX : 0;
    var fy = frame ? frame.cutY : 0;
    if (!fw || !fh) return null;
    var canvas = document.createElement('canvas');
    canvas.width = fw; canvas.height = fh;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, fx, fy, fw, fh, 0, 0, fw, fh);
    var data = ctx.getImageData(0, 0, fw, fh).data;
    var minX = fw, minY = fh, maxX = -1, maxY = -1;
    var ALPHA = 16; // Rauschschwelle gegen halbtransparente Kantenpixel
    for (var y = 0; y < fh; y++) {
      for (var x = 0; x < fw; x++) {
        if (data[(y * fw + x) * 4 + 3] > ALPHA) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // komplett transparent
    return { x: minX, y: minY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
  } catch (e) { return null; }
}
function fitBodyToSprite(sprite) {
  if (!sprite || !sprite.body || !sprite.body.setSize) return;
  var key = sprite.texture && sprite.texture.key;
  if (!key) return;
  var box = _spriteAlphaBoundsCache[key];
  if (box === undefined) {
    box = _computeSpriteAlphaBounds(sprite);
    _spriteAlphaBoundsCache[key] = box; // null wird gecacht -> nicht erneut scannen
  }
  if (!box) return;

  var frame = sprite.frame;
  var fw = frame ? frame.width : (sprite.width || box.w);
  var fh = frame ? frame.height : (sprite.height || box.h);

  // Origin auf das FIGUR-Zentrum setzen (statt Frame-Mitte). Sonst liegt
  // sprite.x/sprite.y in der leeren transparenten Hälfte unter der Figur —
  // und Nahkampf/Fähigkeiten messen die Distanz genau dorthin (player.js
  // forEachEnemyInRange nutzt enemy.x/enemy.y). Beim Schattenrat sass der
  // Bezugspunkt ~113px UNTER der Figur: von oben anzugreifen reichte nicht
  // heran, von unten schon. Mit dem Figur-Zentrum als Origin trifft man von
  // allen Seiten gleich, und der Body (Offset frame-relativ) bleibt korrekt.
  sprite.setOrigin((box.x + box.w / 2) / fw, (box.y + box.h / 2) / fh);
  sprite.body.setSize(box.w, box.h);
  if (sprite.body.setOffset) sprite.body.setOffset(box.x, box.y);

  // Für die HP-Leiste: skalierte halbe Figur-Höhe (drawBossBar setzt die
  // Leiste sonst über die volle displayHeight -> weit über der Figur).
  var sy = Math.abs(sprite.scaleY || 1);
  var sx = Math.abs(sprite.scaleX || 1);
  sprite._fitHalfH = (box.h * sy) / 2;
  // Trefferradius für Nahkampf/Fähigkeiten (player.js forEachEnemyInRange).
  // Der Body ist ein solider Block von ~box*scale Weltpixeln; die Reichweite
  // wird aber Zentrum-zu-Zentrum gemessen. Bei einem grossen Boss (Figur ~87px)
  // hält der Body den Spieler so weit vom Zentrum weg, dass ein vertikaler
  // Angriff (Spieler ist höher als breit) aus der Reichweite fällt. Mit dem
  // halben Figur-Radius als "reach" reicht der Schlag bis an die Body-Kante.
  sprite._hitReach = (Math.max(box.w * sx, box.h * sy)) / 2;
}
if (typeof window !== 'undefined') window.fitBodyToSprite = fitBodyToSprite;

function makeBoss(boss, def, cycle) {
  boss.isBoss = true;
  boss.bossType = def.id;
  boss.bossName = def.name;

  // Scale stats with cycle (+50% HP, +25% damage per cycle beyond first)
  const hpMult = 1 + cycle * 0.5;
  const dmgMult = 1 + cycle * 0.25;

  // Tiefen-Skalierung der Boss-HP — dieselbe Kurve wie bei normalen Gegnern
  // (enemy.js spawnEnemy: 1 + (depth-1)*0.1). Ohne sie hatten Bosse eine FIXE
  // HP und wurden gegenüber den mit der Tiefe wachsenden Mini-Bossen, die jeden
  // Raum abschliessen, immer schwaecher. def.baseHP ist entsprechend die HP auf
  // Tiefe 1 (siehe Kalibrierung an BOSS_DEFINITIONS).
  const _bossDepth = Math.max(1, (typeof window !== 'undefined' && window.DUNGEON_DEPTH) || 1);
  const depthMult = 1 + (_bossDepth - 1) * 0.1;

  boss.hp = Math.ceil(def.baseHP * depthMult * hpMult);
  boss.damage = Math.ceil(def.baseDamage * dmgMult);
  boss.speed = def.baseSpeed;
  boss.isRanged = false;
  boss.baseDamage = boss.damage;

  const difficulty = getDifficultyMultiplierValue();
  if (difficulty !== 1) {
    boss.hp = Math.max(1, Math.round(boss.hp * difficulty));
    boss.damage = Math.max(1, Math.round(boss.baseDamage * difficulty));
  }

  // Scale boss: sprite-based textures normalize to a target pixel size,
  // then multiply by the per-boss def.scale factor so larger bosses
  // (Schattenrat scale=1.8) are visually bigger than small ones (1.5).
  const bossKey = boss.texture?.key || '';
  const isSpriteBasedBoss = bossKey.startsWith('boss_') || bossKey.startsWith('sprite_');
  if (isSpriteBasedBoss) {
    const bossTargetPx = 96 * (def.scale || 1);
    const srcH = boss.height || 300;
    boss.setScale(bossTargetPx / srcH);
  } else {
    boss.setScale(def.scale);
  }
  boss.setCollideWorldBounds(true);
  // Hitbox an die sichtbaren Pixel anpassen (Boss-Frames tragen grosse
  // transparente Ränder — sonst reicht der Body weit unter das Sprite).
  fitBodyToSprite(boss);

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

  // #62: HP-Phasen / Enrage. Kadenz + Tempo steigen mit sinkender HP; ein
  // schwerer, deutlich telegrafierter Schlag (heavySlam) kommt ab Phase 2 in
  // den Attacken-Pool -> Ausweichen/Mobility wird belohnt statt Facetank.
  boss.phase = 1;
  boss.baseCooldown = def.attackCooldown;
  boss._baseMoveSpeed = boss.speed;
  boss._lastAttack = null;
}

function handleBossAI(time, boss, scene) {
  if (!boss.active) return;

  // #77: Waehrend des Vorkampf-Beats steht der Boss. `active` bleibt bewusst
  // unangetastet — daran haengen Trefferkennung und die Klimax-Logik (#109).
  if (boss._introHaltBis && time < boss._introHaltBis) {
    try { if (boss.body && boss.body.setVelocity) boss.body.setVelocity(0, 0); } catch (e) {}
    return;
  }

  // #62: Phasenwechsel bei 66% / 33% HP (Kadenz + Tempo hoch, sichtbarer Wechsel).
  updateBossPhase(boss, scene, time);

  // Follow player
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const d = Math.hypot(dx, dy);

  const slowRadius = 180;
  const desiredSpeed = d < slowRadius ? boss.speed * (d / slowRadius) : boss.speed;
  const ux = d ? dx / d : 0;
  const uy = d ? dy / d : 0;
  boss.body.setVelocity(ux * desiredSpeed, uy * desiredSpeed);

  // Boss sprite direction switching
  if (boss._bossPrefix && !boss._bossAttacking) {
    if (Math.abs(dx) > 30 && (!boss._lastDirChange || time - boss._lastDirChange > 800)) {
      const newDir = dx > 0 ? 'right' : 'left';
      if (newDir !== boss._bossDirection) {
        boss._bossDirection = newDir;
        boss._lastDirChange = time;
        const idleKey = boss._bossPrefix + '_' + newDir + '0';
        if (scene.textures?.exists(idleKey)) boss.setTexture(idleKey);
      }
    }
  }

  // Pattern timing
  if (time >= boss.nextPatternAt) {
    // #62: nicht-deterministische Wahl (gewichtet, keine Sofort-Wiederholung)
    // statt fester Reihenfolge; heavySlam kommt ab Phase 2 dazu.
    const attackName = pickBossAttack(boss);

    if (BOSS_ATTACK_MAP[attackName]) {
      // Boss attack animation
      if (boss._bossPrefix && !boss._bossAttacking) {
        boss._bossAttacking = true;
        const dir = boss._bossDirection || 'right';
        const k1 = boss._bossPrefix + '_' + dir + '1';
        const k2 = boss._bossPrefix + '_' + dir + '2';
        const k0 = boss._bossPrefix + '_' + dir + '0';
        if (scene.textures?.exists(k1)) boss.setTexture(k1);
        scene.time.delayedCall(400, () => {
          if (boss?.active && scene.textures?.exists(k2)) boss.setTexture(k2);
        });
        scene.time.delayedCall(800, () => {
          if (boss?.active) {
            boss._bossAttacking = false;
            if (scene.textures?.exists(k0)) boss.setTexture(k0);
          }
        });
      }
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
  // Über der sichtbaren Figur, nicht über dem vollen (grossteils leeren)
  // Frame: _fitHalfH ist die skalierte halbe Figur-Höhe (fitBodyToSprite).
  // Fallback auf displayHeight für Bosse ohne Fit.
  const halfH = (typeof boss._fitHalfH === 'number') ? boss._fitHalfH : boss.displayHeight / 2;
  const y = boss.y - halfH - 14;

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
      // Pull-Fenster: handlePlayerMovement überschreibt die Velocity sonst sofort.
      window._pullUntil = Date.now() + 350;
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

// Summon Minions: beschwört 2 SCHATTEN (Typ 5) — passt thematisch zum
// Zeremonienmeister (Schatten-Rituale) statt Imps.
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
      const minion = spawnEnemy.call(scene, mx, my, 5); // 5 = Schattenschleicher
      if (minion) {
        minion.hp = 1;
        minion.setTint(0x9933ff); // Schatten-Beschwörungs-Marker
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

      // Klone tragen die ECHTE Boss-Textur. Vorher stand hier fest
      // 'bossShadowCouncillor' — die prozedurale 80x80-Form aus graphics.js,
      // während der Boss längst das gemalte Sprite (boss_shadow_*) trägt.
      // Nebeneffekt: clone.setScale(boss.scaleX * 0.8) rechnet mit dem
      // Boss-Scale, der auf dessen ~300px-Sprite normiert ist — auf die 80px-
      // Textur angewandt ergab das winzige Klone (~37px statt ~138px).
      // Mit derselben Textur stimmen Aussehen UND Grösse wieder.
      const textureKey = boss.texture?.key
        || (scene.textures?.exists('bossShadowCouncillor') ? 'bossShadowCouncillor' : 'enemyMage');
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
      // Gleiche Textur wie der Boss -> gleiche transparente Ränder -> Body fitten.
      if (typeof fitBodyToSprite === 'function') fitBodyToSprite(clone);
      if (clone.body?.setPushable) clone.body.setPushable(false);

      if (scene._enemyVisionMask && clone.setMask) {
        clone.setMask(scene._enemyVisionMask);
      }

      boss._shadowClones.push(clone);
    }
  });
}

// Attack name -> function map
// ---------------------------------------------------------------------------
// #62: Boss-Phasen + dynamische Attackenwahl.
// ---------------------------------------------------------------------------
// Kadenz-Faktor (× baseCooldown) und Tempo-Faktor (× baseMoveSpeed) je Phase.
const BOSS_PHASE_CADENCE = { 1: 1.0, 2: 0.72, 3: 0.5 };
const BOSS_PHASE_SPEED = { 1: 1.0, 2: 1.12, 3: 1.28 };

// Prüft die HP-Schwellen (66% / 33%) und schaltet EINMAL pro Phase hoch:
// schnellere Kadenz + höheres Tempo + sofort spürbarer Druck + sichtbarer FX.
function updateBossPhase(boss, scene, time) {
  const ratio = boss.maxHp ? boss.hp / boss.maxHp : 1;
  let phase = 1;
  if (ratio <= 0.33) phase = 3;
  else if (ratio <= 0.66) phase = 2;
  if (phase <= (boss.phase || 1)) return; // nur hoch, nie zurück

  boss.phase = phase;
  boss.attackCooldown = Math.round((boss.baseCooldown || 3500) * (BOSS_PHASE_CADENCE[phase] || 1));
  boss.speed = Math.round((boss._baseMoveSpeed || boss.speed || 60) * (BOSS_PHASE_SPEED[phase] || 1));
  boss.nextPatternAt = (time || 0) + 500; // nächste Attacke fast sofort
  bossPhaseTransitionFx(boss, scene, phase);
}

// Roter Puls am Boss + Screen-Flash/Shake + Banner ("Phase 2" / "RASEREI!").
function bossPhaseTransitionFx(boss, scene, phase) {
  if (!scene) return;
  try {
    if (scene.cameras?.main) {
      scene.cameras.main.flash(200, 120, 0, 0);
      scene.cameras.main.shake(300, 0.008);
    }
    if (typeof boss.setTint === 'function') {
      boss.setTint(0xff3333);
      scene.time.delayedCall(400, () => { if (boss?.active && typeof boss.clearTint === 'function') boss.clearTint(); });
    }
    const label = phase >= 3 ? 'RASEREI!' : 'Phase ' + phase;
    const cx = scene.scale.width / 2;
    const cy = scene.scale.height * 0.2;
    const t = scene.add.text(cx, cy, label, {
      fontSize: '26px', fontFamily: 'monospace',
      color: phase >= 3 ? '#ff2222' : '#ffaa33',
      stroke: '#000000', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setDepth(1100).setScrollFactor(0).setAlpha(0);
    scene.tweens.add({
      targets: t, alpha: 1, duration: 300, yoyo: true, hold: 800,
      onComplete: () => t.destroy(),
    });
  } catch (_) { /* FX dürfen nie das Gameplay crashen */ }
}

// #62: Signature-Mechanik pro Boss. Ab Phase 2 wandert der boss-eigene schwere
// Move in den Pool (Phase 3 doppelt gewichtet). Unbekannter Boss -> heavySlam.
const BOSS_SIGNATURE = {
  chainMaster: 'chainReel',       // harter Ranzieh-Zug -> Kiting-Puzzle
  ceremonyMaster: 'ritualHazard', // dauerhafte Gefahrenzonen
  shadowCouncillor: 'cloneSlam',  // Fake-out-Slams (nur einer echt)
};

// Gewichtet-zufällige Attackenwahl ohne Sofort-Wiederholung. Ab Phase 2 wandert
// der boss-spezifische Signature-Move in den Pool (Phase 3 doppelt gewichtet).
function pickBossAttack(boss) {
  let pool = (boss.bossAttacks || []).slice();
  if (!pool.length) pool = ['chainWhip'];
  const phase = boss.phase || 1;
  const sig = BOSS_SIGNATURE[boss.bossType] || 'heavySlam';
  if (phase >= 2) pool.push(sig);
  if (phase >= 3) pool.push(sig);
  let choices = pool.filter(a => a !== boss._lastAttack);
  if (!choices.length) choices = pool;
  const pick = choices[Math.floor(Math.random() * choices.length)];
  boss._lastAttack = pick;
  return pick;
}

// #62: Schwerer, stark telegrafierter Flächenschlag auf die Spielerposition.
// Langes Wind-up (~850ms) mit wachsendem Warnkreis = klares Ausweich-/Roll-
// Fenster; trifft hart (~2.2x), wenn man drin stehen bleibt. Kern-Anreiz, die
// Mobility-Skills (Ansturm / Schattenschritt) auch wirklich einzusetzen.
function bossHeavySlam(boss) {
  const scene = this;
  const tx = player.x;
  const ty = player.y;
  const radius = 135;
  const windup = 850;

  const warn = scene.add.graphics().setDepth(1000);
  const drawWarn = (progress) => {
    if (!warn.active) return;
    warn.clear();
    warn.lineStyle(3, 0xff5533, 0.9);
    warn.strokeCircle(tx, ty, radius);
    warn.fillStyle(0xff3311, 0.12 + progress * 0.22);
    warn.fillCircle(tx, ty, radius * (0.4 + progress * 0.6));
  };
  drawWarn(0);
  scene.tweens.addCounter({
    from: 0, to: 1, duration: windup,
    onUpdate: (tw) => drawWarn(tw.getValue()),
  });

  scene.time.delayedCall(windup, () => {
    warn.destroy();
    if (!boss.active) return;
    const hit = scene.add.graphics().setDepth(1001);
    hit.fillStyle(0xff4422, 0.5);
    hit.fillCircle(tx, ty, radius);
    scene.time.delayedCall(160, () => hit.destroy());
    if (scene.cameras?.main) scene.cameras.main.shake(220, 0.012);
    const d = Phaser.Math.Distance.Between(tx, ty, player.x, player.y);
    if (d <= radius) {
      applyPlayerDamage(Math.ceil(boss.damage * 2.2), scene);
    }
  });
}

// --- Kettenmeister-Signature: chainReel ------------------------------------
// Harter, stärker telegrafierter Ranzieh-Zug (Kette leuchtet ~500ms auf, dann
// kräftiger Pull + Schaden). In Raserei häufig -> der Spieler wird immer wieder
// herangerissen und muss sich per Dash/Roll neu absetzen = Kiting-Puzzle.
function bossChainReel(boss) {
  const scene = this;
  const warn = scene.add.graphics().setDepth(1001);
  warn.lineStyle(4, 0xffaa33, 0.75);
  warn.beginPath();
  warn.moveTo(boss.x, boss.y);
  warn.lineTo(player.x, player.y);
  warn.strokePath();

  scene.time.delayedCall(500, () => {
    warn.destroy();
    if (!boss.active || !player.active) return;
    const ang = Math.atan2(boss.y - player.y, boss.x - player.x);
    const strength = 560; // deutlich stärker als chainPull (300)
    if (player.body) {
      player.body.setVelocity(Math.cos(ang) * strength, Math.sin(ang) * strength);
      // Pull-Fenster: handlePlayerMovement überschreibt die Velocity sonst sofort.
      window._pullUntil = Date.now() + 420;
    }
    const chainG = scene.add.graphics().setDepth(1001);
    chainG.lineStyle(4, 0xcc8844, 0.9);
    chainG.beginPath();
    chainG.moveTo(boss.x, boss.y);
    chainG.lineTo(player.x, player.y);
    chainG.strokePath();
    scene.time.delayedCall(300, () => chainG.destroy());
    applyPlayerDamage(Math.ceil((boss.damage || 4) * 0.6), scene);
  });
}

// --- Zeremonienmeister-Signature: ritualHazard -----------------------------
// Legt 2 DAUERHAFTE Ritual-Gefahrenzonen nahe dem Spieler, die ~6s stehen
// bleiben und beim Drinstehen ticken -> zwingt zu ständiger Positionierung,
// verkleinert die nutzbare Arena. (Add-Wellen laufen über summonMinions weiter.)
function bossRitualHazard(boss) {
  const scene = this;
  for (let i = 0; i < 2; i++) {
    const zx = player.x + Phaser.Math.Between(-120, 120);
    const zy = player.y + Phaser.Math.Between(-120, 120);
    spawnPersistentHazard(scene, boss, zx, zy, 70, 6000);
  }
}

// Persistente Gefahrenzone: kurzer Telegraph (600ms), dann aktiv für `duration`
// ms; tickt alle 500ms Schaden, solange der Spieler drinsteht. Räumt sich selbst
// (und bei Boss-Tod) auf.
function spawnPersistentHazard(scene, boss, zx, zy, radius, duration) {
  const zone = scene.add.graphics().setDepth(1000);
  zone.lineStyle(2, 0xaa66ff, 0.5);
  zone.strokeCircle(zx, zy, radius);

  scene.time.delayedCall(600, () => {
    if (!boss.active) { zone.destroy(); return; }
    let elapsed = 0;
    const tick = scene.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        elapsed += 500;
        if (!zone.active) return;
        zone.clear();
        zone.lineStyle(2, 0xcc88ff, 0.8);
        zone.strokeCircle(zx, zy, radius);
        zone.fillStyle(0x8844cc, 0.22);
        zone.fillCircle(zx, zy, radius);
        if (player.active) {
          const d = Phaser.Math.Distance.Between(zx, zy, player.x, player.y);
          if (d <= radius) applyPlayerDamage(Math.ceil((boss.damage || 4) * 0.25), scene);
        }
        if (elapsed >= duration || !boss.active) { tick.remove(); zone.destroy(); }
      },
    });
    boss.once('destroy', () => { try { tick.remove(); } catch (_) {} zone.destroy(); });
  });
}

// --- Schattenrat-Signature: cloneSlam --------------------------------------
// Mehrere identisch aussehende Telegraph-Slams gleichzeitig — aber nur EINER
// trifft wirklich (auf der aktuellen Spielerposition). Die Fakes verpuffen
// harmlos. Der Spieler muss seine Ausgangsposition räumen (Dash/Roll), statt
// blind auszuweichen -> echtes Fake-out-Lesen.
function bossCloneSlam(boss) {
  const scene = this;
  const count = 3;
  const radius = 120;
  const windup = 800;
  const realIdx = Math.floor(Math.random() * count);
  const spots = [];
  for (let i = 0; i < count; i++) {
    if (i === realIdx) spots.push({ x: player.x, y: player.y, real: true });
    else spots.push({
      x: player.x + Phaser.Math.Between(-190, 190),
      y: player.y + Phaser.Math.Between(-190, 190),
      real: false,
    });
  }
  spots.forEach((s) => {
    const warn = scene.add.graphics().setDepth(1000);
    const draw = (p) => {
      if (!warn.active) return;
      warn.clear();
      warn.lineStyle(3, 0x9933ff, 0.9);
      warn.strokeCircle(s.x, s.y, radius);
      warn.fillStyle(0x7722dd, 0.10 + p * 0.20);
      warn.fillCircle(s.x, s.y, radius * (0.4 + p * 0.6));
    };
    draw(0);
    scene.tweens.addCounter({ from: 0, to: 1, duration: windup, onUpdate: (tw) => draw(tw.getValue()) });
    scene.time.delayedCall(windup, () => {
      warn.destroy();
      if (!boss.active) return;
      if (s.real) {
        const hit = scene.add.graphics().setDepth(1001);
        hit.fillStyle(0x9933ff, 0.5);
        hit.fillCircle(s.x, s.y, radius);
        scene.time.delayedCall(160, () => hit.destroy());
        if (scene.cameras?.main) scene.cameras.main.shake(220, 0.012);
        if (player.active) {
          const d = Phaser.Math.Distance.Between(s.x, s.y, player.x, player.y);
          if (d <= radius) applyPlayerDamage(Math.ceil((boss.damage || 8) * 2.0), scene);
        }
      } else {
        const fizz = scene.add.graphics().setDepth(1001);
        fizz.lineStyle(2, 0x552288, 0.5);
        fizz.strokeCircle(s.x, s.y, radius * 0.5);
        scene.time.delayedCall(120, () => fizz.destroy());
      }
    });
  });
}

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
  heavySlam: bossHeavySlam,
  chainReel: bossChainReel,
  ritualHazard: bossRitualHazard,
  cloneSlam: bossCloneSlam,
};

// ---------------------------------------------------------------------------
// Tutorial event wrappers (feature 044).
//
// The damage funnel `handleEnemyHit(scene, enemy, options)` lives in
// player.js (not owned by WP04). enemy.js loads after player.js per
// index.html script order, so we can safely wrap the global from here
// without touching player.js. One emission per damage application:
// - combat.hit always (advances tutorial step 7)
// - combat.kill when the application brought hp to 0 (informational; not
//   wired to a tutorial step but emitted per the data-model vocabulary).
// ---------------------------------------------------------------------------
(function () {
  if (typeof window === 'undefined') return;
  if (typeof window.handleEnemyHit !== 'function') return;
  if (window.handleEnemyHit._tutorialWrapped) return;
  var orig = window.handleEnemyHit;
  window.handleEnemyHit = function (scene, enemy, options) {
    var hpBefore = (enemy && typeof enemy.hp === 'number') ? enemy.hp : null;
    var ret = orig.apply(this, arguments);
    if (window.TutorialSystem && typeof window.TutorialSystem.report === 'function') {
      try {
        window.TutorialSystem.report('combat.hit', { byPlayer: true, enemyId: enemy && enemy.id });
        var hpAfter = (enemy && typeof enemy.hp === 'number') ? enemy.hp : null;
        if (hpBefore !== null && hpAfter !== null && hpBefore > 0 && hpAfter <= 0) {
          window.TutorialSystem.report('combat.kill', { enemyType: enemy && enemy.type });
        }
      } catch (_) { /* never crash gameplay */ }
    }
    return ret;
  };
  window.handleEnemyHit._tutorialWrapped = true;
})();
