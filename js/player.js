let lastMoveDirection = new Phaser.Math.Vector2(0, 1); // Standard: Blick nach vorn (nach unten)

const PLAYER_FRAME_WIDTH = 125;
const PLAYER_FRAME_HEIGHT = 500;
const PLAYER_BASE_DISPLAY_WIDTH = 60;  // Increased from 36 for better sprite quality
const PLAYER_BASE_DISPLAY_HEIGHT = 150; // Increased from 90 for better sprite quality
const PLAYER_ORIGIN_Y = 0.92;
const DEBUG_PLAYER_COLLIDER = false;
const PLAYER_COLLIDER_WIDTH = 34;
const PLAYER_COLLIDER_HEIGHT = 56;
const PLAYER_COLLIDER_HEAD_CLEARANCE = 0;
const PLAYER_COLLIDER_FOOT_OVERHANG = 0;
const PLAYER_TINT_COLOR = 0xffffff; // Neutral tint (no color change)
const PLAYER_FRAME_METADATA = {};
const PLAYER_WIDTH_STRETCH = 1;
const PLAYER_SIDEWAYS_SCALE = 0.8;
const PLAYER_RIGHT_LEFT_WIDTH_MULT = 1.15;
const PLAYER_FRONT_BACK_WIDTH_MULT = 1.4;
const PLAYER_VISUAL_SCALE = 0.456; // 95% of 0.48 — slightly smaller to fit through tight gaps
const PLAYER_DIRECTION_FRAME_SHIFTS = {
  '02': 10
};
let PLAYER_FRAMES_NORMALIZED = false;

const PLAYER_DEFAULT_DD = '00';
const PLAYER_DIRECTION_SEQUENCE = [
  { dd: '00', name: 'front', vector: new Phaser.Math.Vector2(-1, 0).normalize() },       // links
  { dd: '01', name: 'frontRight', vector: new Phaser.Math.Vector2(-1, -1).normalize() }, // links-oben
  { dd: '02', name: 'right', vector: new Phaser.Math.Vector2(0, -1).normalize() },       // oben
  { dd: '03', name: 'backRight', vector: new Phaser.Math.Vector2(1, -1).normalize() },   // rechts-oben
  { dd: '04', name: 'back', vector: new Phaser.Math.Vector2(1, 0).normalize() },         // rechts
  { dd: '05', name: 'backLeft', vector: new Phaser.Math.Vector2(1, 1).normalize() },     // rechts-unten
  { dd: '06', name: 'left', vector: new Phaser.Math.Vector2(0, 1).normalize() },         // unten
  { dd: '07', name: 'frontLeft', vector: new Phaser.Math.Vector2(-1, 1).normalize() }    // links-unten
];
const PLAYER_DIRECTION_LOOKUP = PLAYER_DIRECTION_SEQUENCE.reduce((acc, entry) => {
  acc[entry.dd] = {
    ...entry,
    idleKey: `dir${entry.dd}_f00`
  };
  return acc;
}, {});

function preloadPlayerDirectionalFrames(loader) {
  if (!loader) return;
  const textureManager = loader.textureManager || loader.scene?.textures || loader.scene?.sys?.textures;
  const directionCount = 8;
  const frameCount = 8;

  for (let dir = 0; dir < directionCount; dir++) {
    const dirId = dir.toString().padStart(2, '0');
    for (let frame = 0; frame < frameCount; frame++) {
      const frameId = frame.toString().padStart(2, '0');
      const key = `dir${dirId}_f${frameId}`;
      if (textureManager?.exists?.(key)) continue;
      loader.image(key, `assets/PlayerSprites/${key}.png`);
    }
  }
}

// Track which directions are currently being loaded to avoid duplicate requests
const _directionLoadingPromises = {};

/**
 * Lazy-load all 8 frames for a given direction on demand.
 * Returns a Promise that resolves when textures are available.
 */
function ensureDirectionLoaded(scene, dd) {
  const testKey = `dir${dd}_f00`;
  if (scene.textures.exists(testKey)) return Promise.resolve();

  // If already loading this direction, return the existing promise
  if (_directionLoadingPromises[dd]) return _directionLoadingPromises[dd];

  const promise = new Promise(resolve => {
    for (let f = 0; f < 8; f++) {
      const fk = `dir${dd}_f${f.toString().padStart(2, '0')}`;
      if (!scene.textures.exists(fk)) {
        scene.load.image(fk, `assets/PlayerSprites/${fk}.png`);
      }
    }
    scene.load.once('complete', () => {
      delete _directionLoadingPromises[dd];
      // Create walk animation for this direction now that frames are loaded
      ensureDirectionAnimations(scene, dd);
      // Normalize frames for this direction
      normalizeDirectionFrames(scene, dd);
      resolve();
    });
    scene.load.start();
  });

  _directionLoadingPromises[dd] = promise;
  return promise;
}

/**
 * Create walk animation for a single direction (used after lazy-loading).
 */
function ensureDirectionAnimations(scene, dd) {
  if (!scene || !scene.anims) return;
  const key = `walk_${dd}`;
  if (scene.anims.exists(key)) return;

  const frames = [];
  for (let frame = 0; frame < 8; frame++) {
    const frameId = frame.toString().padStart(2, '0');
    const textureKey = `dir${dd}_f${frameId}`;
    if (scene.textures.exists(textureKey)) {
      frames.push({ key: textureKey });
    }
  }
  if (!frames.length) return;

  scene.anims.create({
    key,
    frames,
    frameRate: frames.length > 1 ? 10 : 1,
    repeat: -1
  });
}

/**
 * Normalize frames for a single direction (used after lazy-loading).
 * Mirrors the logic in normalizePlayerDirectionalFrames but for one direction only.
 */
function normalizeDirectionFrames(scene, dd) {
  if (!scene || !scene.textures) return;
  const texManager = scene.textures;
  const shiftY = PLAYER_DIRECTION_FRAME_SHIFTS[dd] || 0;
  const entries = [];
  for (let frame = 0; frame < 8; frame++) {
    const frameId = frame.toString().padStart(2, '0');
    const key = `dir${dd}_f${frameId}`;
    if (!texManager.exists(key)) continue;
    const meta = getDirectionalFrameMeta(scene, key);
    if (!meta) continue;
    const texture = texManager.get(key);
    const src = texture?.getSourceImage();
    if (!src) continue;
    entries.push({ key, meta, src });
  }

  if (!entries.length) return;

  let globalMinX = Infinity, globalMaxX = -Infinity;
  let globalMinY = Infinity, globalMaxY = -Infinity;

  entries.forEach(({ meta }) => {
    if (meta.minX < globalMinX) globalMinX = meta.minX;
    if (meta.maxX > globalMaxX) globalMaxX = meta.maxX;
    if (meta.minY < globalMinY) globalMinY = meta.minY;
    if (meta.maxY > globalMaxY) globalMaxY = meta.maxY;
  });

  if (!Number.isFinite(globalMinX) || !Number.isFinite(globalMaxX) ||
      !Number.isFinite(globalMinY) || !Number.isFinite(globalMaxY)) {
    return;
  }

  const targetWidth = Math.max(1, Math.round(globalMaxX - globalMinX + 1));
  const targetHeight = Math.max(1, Math.round(globalMaxY - globalMinY + 1));
  const globalCenterX = (globalMinX + globalMaxX) / 2;
  const globalFootRel = globalMaxY - globalMinY;

  entries.forEach(({ key, meta, src }) => {
    const tmpKey = `__norm_${key}`;
    const canvasTex = texManager.createCanvas(tmpKey, targetWidth, targetHeight);
    const ctx = canvasTex?.context;
    if (!ctx) {
      canvasTex?.destroy();
      return;
    }

    ctx.clearRect(0, 0, targetWidth, targetHeight);

    const cropWidth = meta.boundsWidth;
    const cropHeight = meta.boundsHeight;

    const desiredCenterRel = globalCenterX - globalMinX;
    const frameCenterRel = meta.centerX - meta.minX;
    let dx = Math.round(desiredCenterRel - frameCenterRel);
    let dy = Math.round(globalFootRel - (meta.maxY - meta.minY));

    const maxDx = targetWidth - cropWidth;
    const maxDy = targetHeight - cropHeight;
    if (maxDx < 0 || maxDy < 0) {
      canvasTex.destroy();
      return;
    }

    if (dx < 0) dx = 0;
    if (dx > maxDx) dx = maxDx;
    if (shiftY !== 0) dy -= shiftY;
    if (dy < 0) dy = 0;
    if (dy > maxDy) dy = maxDy;

    ctx.drawImage(src, meta.minX, meta.minY, cropWidth, cropHeight, dx, dy, cropWidth, cropHeight);

    canvasTex.refresh();
    texManager.remove(key);
    texManager.addCanvas(key, canvasTex.canvas);
    canvasTex.destroy();
    delete PLAYER_FRAME_METADATA[key];
  });
}

function getDirectionalFrameMeta(scene, textureKey) {
  if (!textureKey || typeof textureKey !== 'string' || !textureKey.startsWith('dir')) {
    return null;
  }
  if (PLAYER_FRAME_METADATA[textureKey]) {
    return PLAYER_FRAME_METADATA[textureKey];
  }
  if (!scene || !scene.textures?.exists(textureKey)) {
    return null;
  }

  const tex = scene.textures.get(textureKey);
  const src = tex?.getSourceImage();
  if (!src) return null;

  const { width, height } = src;
  if (!width || !height) return null;

  const tmpKey = `__player_meta_${textureKey}`;
  const canvasTex = scene.textures.createCanvas(tmpKey, width, height);
  const ctx = canvasTex?.context;
  if (!ctx) {
    canvasTex?.destroy();
    return null;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(src, 0, 0);

  const data = ctx.getImageData(0, 0, width, height).data;
  canvasTex.destroy();

  let minX = width, maxX = -1, minY = height, maxY = -1;
  const alphaThreshold = 16;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    PLAYER_FRAME_METADATA[textureKey] = null;
    return null;
  }

  const boundsWidth = maxX - minX + 1;
  const boundsHeight = maxY - minY + 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const footY = maxY;

  const originX = Phaser.Math.Clamp(centerX / width, 0, 1);
  const originY = Phaser.Math.Clamp((footY + 1) / height, 0, 1);

  const meta = {
    originX,
    originY,
    boundsWidth,
    boundsHeight,
    minX,
    maxX,
    minY,
    maxY,
    centerX,
    centerY,
    footY,
    sourceWidth: width,
    sourceHeight: height
  };
  PLAYER_FRAME_METADATA[textureKey] = meta;
  return meta;
}

function normalizePlayerDirectionalFrames(scene) {
  if (!scene || !scene.textures || PLAYER_FRAMES_NORMALIZED) return;

  const texManager = scene.textures;
  let updated = false;

  PLAYER_DIRECTION_SEQUENCE.forEach(({ dd }) => {
    const shiftY = PLAYER_DIRECTION_FRAME_SHIFTS[dd] || 0;
    const entries = [];
    for (let frame = 0; frame < 8; frame++) {
      const frameId = frame.toString().padStart(2, '0');
      const key = `dir${dd}_f${frameId}`;
      if (!texManager.exists(key)) continue;
      const meta = getDirectionalFrameMeta(scene, key);
      if (!meta) continue;
      const texture = texManager.get(key);
      const src = texture?.getSourceImage();
      if (!src) continue;
      entries.push({ key, meta, src });
    }

    if (!entries.length) return;

    let globalMinX = Infinity;
    let globalMaxX = -Infinity;
    let globalMinY = Infinity;
    let globalMaxY = -Infinity;

    entries.forEach(({ meta }) => {
      if (meta.minX < globalMinX) globalMinX = meta.minX;
      if (meta.maxX > globalMaxX) globalMaxX = meta.maxX;
      if (meta.minY < globalMinY) globalMinY = meta.minY;
      if (meta.maxY > globalMaxY) globalMaxY = meta.maxY;
    });

    if (!Number.isFinite(globalMinX) || !Number.isFinite(globalMaxX) || !Number.isFinite(globalMinY) || !Number.isFinite(globalMaxY)) {
      return;
    }

    const targetWidth = Math.max(1, Math.round(globalMaxX - globalMinX + 1));
    const targetHeight = Math.max(1, Math.round(globalMaxY - globalMinY + 1));
    const globalCenterX = (globalMinX + globalMaxX) / 2;
    const globalFootRel = globalMaxY - globalMinY;

    entries.forEach(({ key, meta, src }) => {
      const tmpKey = `__norm_${key}`;
      const canvasTex = texManager.createCanvas(tmpKey, targetWidth, targetHeight);
      const ctx = canvasTex?.context;
      if (!ctx) {
        canvasTex?.destroy();
        return;
      }

      ctx.clearRect(0, 0, targetWidth, targetHeight);

      const cropWidth = meta.boundsWidth;
      const cropHeight = meta.boundsHeight;

      const desiredCenterRel = globalCenterX - globalMinX;
      const frameCenterRel = meta.centerX - meta.minX;
      let dx = Math.round(desiredCenterRel - frameCenterRel);
      let dy = Math.round(globalFootRel - (meta.maxY - meta.minY));

      const maxDx = targetWidth - cropWidth;
      const maxDy = targetHeight - cropHeight;
      if (maxDx < 0 || maxDy < 0) {
        canvasTex.destroy();
        return;
      }

      if (dx < 0) dx = 0;
      if (dx > maxDx) dx = maxDx;
      if (shiftY !== 0) {
        dy -= shiftY;
      }
      if (dy < 0) dy = 0;
      if (dy > maxDy) dy = maxDy;

      ctx.drawImage(
        src,
        meta.minX,
        meta.minY,
        cropWidth,
        cropHeight,
        dx,
        dy,
        cropWidth,
        cropHeight
      );

      canvasTex.refresh();
      texManager.remove(key);
      texManager.addCanvas(key, canvasTex.canvas);
      canvasTex.destroy();
      delete PLAYER_FRAME_METADATA[key];
      updated = true;
    });
  });

  if (updated) {
    Object.keys(PLAYER_FRAME_METADATA).forEach((key) => delete PLAYER_FRAME_METADATA[key]);
    PLAYER_FRAMES_NORMALIZED = true;
  }
}

function getDirectionFromVelocity(vx, vy, fallbackDd = PLAYER_DEFAULT_DD) {
  if (vx === 0 && vy === 0) {
    return fallbackDd;
  }
  const movement = new Phaser.Math.Vector2(vx, vy);
  if (!movement.lengthSq()) {
    return fallbackDd;
  }

  movement.normalize();
  let bestDirection = fallbackDd;
  let bestDot = -Infinity;

  PLAYER_DIRECTION_SEQUENCE.forEach(({ dd, vector }) => {
    const dot = movement.dot(vector);
    if (dot > bestDot) {
      bestDot = dot;
      bestDirection = dd;
    }
  });

  return bestDirection;
}

function ensurePlayerAnimations(scene) {
  if (!scene || !scene.anims) return;

  PLAYER_DIRECTION_SEQUENCE.forEach(({ dd }) => {
    const key = `walk_${dd}`;
    if (scene.anims.exists(key)) return;

    const frames = [];
    for (let frame = 0; frame < 8; frame++) {
      const frameId = frame.toString().padStart(2, '0');
      const textureKey = `dir${dd}_f${frameId}`;
      if (scene.textures.exists(textureKey)) {
        frames.push({ key: textureKey });
      }
    }

    if (!frames.length) return;

    scene.anims.create({
      key,
      frames,
      frameRate: frames.length > 1 ? 10 : 1,
      repeat: -1
    });
  });
}

function getPlayerTextureKey(scene) {
  return `dir${PLAYER_DEFAULT_DD}_f00`;
}

function updatePlayerSpriteAnimation(sprite, vx = 0, vy = 0) {
  if (!sprite) return;

  if (!sprite.data) sprite.setDataEnabled();
  let state = sprite.getData('animState');
  if (!state) {
    state = { direction: PLAYER_DEFAULT_DD, playing: null, loadingDir: null };
    sprite.setData('animState', state);
  }

  const moving = vx !== 0 || vy !== 0;
  const direction = moving
    ? getDirectionFromVelocity(vx, vy, state.direction || PLAYER_DEFAULT_DD)
    : (state.direction || PLAYER_DEFAULT_DD);

  const animKey = `walk_${direction}`;
  const idleKey = PLAYER_DIRECTION_LOOKUP[direction]?.idleKey || `dir${PLAYER_DEFAULT_DD}_f00`;

  if (moving && sprite.scene?.anims?.exists(animKey)) {
    if (state.playing !== animKey) {
      sprite.anims.play(animKey, true);
      state.playing = animKey;
    }
  } else {
    if (state.playing) {
      sprite.anims.stop();
      state.playing = null;
    }
    if (sprite.scene?.textures?.exists(idleKey)) {
      if (sprite.texture.key !== idleKey) {
        sprite.setTexture(idleKey);
      }
    }
  }

  if (sprite.frame) applyPlayerDisplaySettings(sprite);
  state.direction = direction;
  sprite.setData('animState', state);
}

function applyPlayerDisplaySettings(sprite) {
  if (!sprite || !sprite.frame) return;

  const frame = sprite.frame;
  const originY = window.PLAYER_ORIGIN_Y ?? PLAYER_ORIGIN_Y;
  const textureKey = frame.texture?.key;
  const isDirectionalImage = typeof textureKey === 'string' && textureKey.startsWith('dir');
  const baseWidth = window.PLAYER_BASE_DISPLAY_WIDTH || PLAYER_BASE_DISPLAY_WIDTH;
  const baseHeight = window.PLAYER_BASE_DISPLAY_HEIGHT || PLAYER_BASE_DISPLAY_HEIGHT;

  const sourceWidth = frame.cutWidth ?? frame.width ?? PLAYER_FRAME_WIDTH;
  const sourceHeight = frame.cutHeight ?? frame.height ?? PLAYER_FRAME_HEIGHT;

  let targetWidth = Math.max(1, baseWidth);
  let targetHeight = Math.max(1, baseHeight);
  const appliedOriginX = 0.5;
  let appliedOriginY = originY;
  const baselineOrigin = PLAYER_ORIGIN_Y;

  if (isDirectionalImage) {
    targetHeight = baseHeight;
    targetWidth = Math.max(1, Math.round(baseWidth * PLAYER_WIDTH_STRETCH));

    const dd = textureKey.slice(3, 5);
    if (dd === '00' || dd === '04') {
      //targetWidth = Math.max(1, Math.round(targetWidth * PLAYER_FRONT_BACK_WIDTH_MULT));
      //targetHeight = Math.max(1, Math.round(targetHeight * PLAYER_SIDEWAYS_SCALE));
    }
    if (dd === '03' || dd === '05') {
      targetWidth = Math.max(1, Math.round(targetWidth * PLAYER_RIGHT_LEFT_WIDTH_MULT));
    }

    const meta = getDirectionalFrameMeta(sprite.scene, textureKey);
    if (meta && typeof meta.originY === 'number') {
      appliedOriginY = Phaser.Math.Clamp(meta.originY, 0, 1);
    }
  } else {
    const ratio = sourceHeight / Math.max(1, sourceWidth);
    targetWidth = Math.max(1, baseWidth);
    targetHeight = Math.max(1, Math.round(targetWidth * ratio));
  }

  const visualWidth = Math.max(1, Math.round(targetWidth * PLAYER_VISUAL_SCALE));
  const visualHeight = Math.max(1, Math.round(targetHeight * PLAYER_VISUAL_SCALE));

  sprite.setOrigin(appliedOriginX, appliedOriginY);
  sprite.setDisplaySize(visualWidth, visualHeight);
  if (isDirectionalImage) {
    sprite.setTint(PLAYER_TINT_COLOR);
  }

  if (sprite.body) {
    const scaleX = Math.abs(sprite.scaleX) || 1;
    const scaleY = Math.abs(sprite.scaleY) || 1;
    const colliderReferenceWidth = Math.max(8, window.PLAYER_COLLIDER_WIDTH ?? PLAYER_COLLIDER_WIDTH);
    const colliderReferenceHeight = Math.max(8, window.PLAYER_COLLIDER_HEIGHT ?? PLAYER_COLLIDER_HEIGHT);

    // Set fixed body size. Offset is recalculated each frame to stay
    // centered on the sprite regardless of display size changes.
    // Use fixed pixel values to avoid drift from changing scale.
    sprite.body.setSize(colliderReferenceWidth / scaleX, colliderReferenceHeight / scaleY);

    // Center body horizontally on sprite, align to bottom (feet)
    const actualWidth = sprite.displayWidth;
    const actualHeight = sprite.displayHeight;
    const bodyPxW = colliderReferenceWidth;
    const bodyPxH = colliderReferenceHeight;
    const offsetX = Math.max(0, (actualWidth - bodyPxW) / 2);
    const offsetY = Math.max(0, actualHeight * PLAYER_ORIGIN_Y - bodyPxH);

    sprite.body.setOffset(offsetX / scaleX, offsetY / scaleY);

    if (DEBUG_PLAYER_COLLIDER) {
      updatePlayerColliderDebug(sprite);
    }
  }
}

function updatePlayerColliderDebug(sprite) {
  const body = sprite.body;
  const scene = sprite.scene;
  if (!body || !scene) return;

  if (!sprite._colliderDebug) {
    sprite._colliderDebug = scene.add.graphics().setDepth(2100).setScrollFactor(1);
  }

  const g = sprite._colliderDebug;
  g.clear();
  g.fillStyle(0x00ff00, 0.18);
  g.fillRect(body.x, body.y, body.width, body.height);
  g.lineStyle(1, 0x00ff00, 1);
  g.strokeRect(body.x, body.y, body.width, body.height);
  g.setVisible(true);
}

function dealDamageToEnemy(scene, enemy, multiplier = 1, abilityKey = 'attack') {
  if (!enemy) return { damage: 0, isCrit: false };

  // Kettenwächter (Chain Guard): shield blocks the first hit then breaks
  if (enemy.isChainGuard && enemy.shieldActive) {
    enemy.shieldActive = false;
    // Visual feedback: flash white briefly, remove shield tint
    if (enemy.active && scene?.time) {
      enemy.setTintFill(0xffffff);
      scene.time.delayedCall(200, () => {
        if (enemy && enemy.active) {
          enemy.clearTint();
          if (enemy.isElite) enemy.setTint(0xffe066);
        }
      });
    }
    return { damage: 0, isCrit: false, shieldBlocked: true };
  }

  const critChance = Phaser.Math.Clamp(playerCritChance || 0, 0, 0.95);
  const isCrit = Math.random() < critChance;
  const bonus = getAbilityBonus(abilityKey);
  const damageMult = 1 + (bonus.damage || 0);
  // WP07 T044: Equipment affix damage bonus via LootSystem.getBonus().
  // Per-ability key maps to the loot stat key (e.g. 'spin' -> 'dmg_spinAttack').
  // Plain 'attack' only picks up 'dmg_all_abilities' (no per-ability affix).
  const lootDmgMul = 1 + getLootAbilityDamageBonus(abilityKey);
  const base = Math.max(1, weaponDamage * multiplier * damageMult * lootDmgMul);
  const damage = Math.max(1, Math.round(isCrit ? base * 1.5 : base));

  enemy.hp -= damage;

  if (isCrit && enemy.active && scene?.time) {
    enemy.setTintFill(0xfff2a6);
    scene.time.delayedCall(160, () => {
      if (enemy && enemy.active) enemy.clearTint();
    });
  }

  // Lebensraub (Life Steal): 10% of damage dealt heals the player
  if (typeof window.hasSkill === 'function' && window.hasSkill('survival_life_steal') && damage > 0) {
    const healAmount = Math.max(1, Math.round(damage * 0.1));
    if (typeof addPlayerHealth === 'function') {
      addPlayerHealth(healAmount);
    }
  }

  return { damage, isCrit };
}

window.ensurePlayerAnimations = ensurePlayerAnimations;
window.getPlayerTextureKey = getPlayerTextureKey;
window.updatePlayerSpriteAnimation = updatePlayerSpriteAnimation;
window.PLAYER_FRAME_WIDTH = PLAYER_FRAME_WIDTH;
window.PLAYER_FRAME_HEIGHT = PLAYER_FRAME_HEIGHT;
window.PLAYER_ORIGIN_Y = PLAYER_ORIGIN_Y;
window.PLAYER_BASE_DISPLAY_WIDTH = PLAYER_BASE_DISPLAY_WIDTH;
window.PLAYER_BASE_DISPLAY_HEIGHT = PLAYER_BASE_DISPLAY_HEIGHT;
window.applyPlayerDisplaySettings = applyPlayerDisplaySettings;
window.updatePlayerColliderDebug = updatePlayerColliderDebug;
window.DEBUG_PLAYER_COLLIDER = DEBUG_PLAYER_COLLIDER;
window.preloadPlayerDirectionalFrames = preloadPlayerDirectionalFrames;
window.normalizePlayerDirectionalFrames = normalizePlayerDirectionalFrames;
window.ensureDirectionLoaded = ensureDirectionLoaded;
window.beginChargedSlash = beginChargedSlash;
window.releaseChargedSlash = releaseChargedSlash;
window.spinAttack = spinAttack;
window.dashSlash = dashSlash;
window.throwDagger = throwDagger;
window.shieldBash = shieldBash;
window.handlePlayerProjectileEnemyOverlap = handlePlayerProjectileEnemyOverlap;

function hasLineOfSightToEnemy(enemy) {
  if (!enemy || !player || typeof Steering === 'undefined' || !obstacles) {
    return !!enemy;
  }
  return Steering.hasLineOfSight(player, enemy, obstacles);
}

function forEachEnemyInRange(range, callback, options = {}) {
  if (!enemies?.children || typeof callback !== 'function' || !player) return;

  const { requireLineOfSight = false } = options;
  const px = player.x ?? player.body?.x ?? 0;
  const py = player.y ?? player.body?.y ?? 0;

  enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;

    const ex = enemy.x ?? enemy.body?.x ?? 0;
    const ey = enemy.y ?? enemy.body?.y ?? 0;
    const dx = ex - px;
    const dy = ey - py;
    const distance = Math.hypot(dx, dy);

    if (distance > range) return;
    if (requireLineOfSight && !hasLineOfSightToEnemy(enemy)) return;

    callback(enemy, { distance, dx, dy });
  });
}

function setButtonActive(button, active) {
  if (!button) return;

  if (active) {
    button.setAlpha(1);
    if (typeof button.setInteractive === 'function') {
      button.setInteractive();
    }
  } else {
    if (typeof button.disableInteractive === 'function') {
      button.disableInteractive();
    }
    button.setAlpha(0.5);
  }
}

function startCooldownTimer(scene, duration, options = {}) {
  const { button = null, label = null, onComplete = null, statusKey = null } = options;
  const time = scene?.time;
  const updateStatus = (remainingMs, customText, durationOverride) => {
    if (!statusKey || typeof window.updateAbilityStatus !== 'function') return;
    const payload = { remainingMs, customText };
    if (Number.isFinite(durationOverride)) {
      payload.durationMs = durationOverride;
    }
    window.updateAbilityStatus(statusKey, payload);
  };

  if (!time || duration <= 0) {
    if (button) setButtonActive(button, true);
    if (label) label.setVisible(false);
    if (typeof onComplete === 'function') onComplete();
    updateStatus(0, null, 0);
    return;
  }

  if (button) setButtonActive(button, false);
  updateStatus(duration, null, duration);

  let remaining = duration;
  const updateLabel = () => {
    if (!label) return;
    if (remaining > 0) {
      label.setText((remaining / 1000).toFixed(1));
      label.setVisible(true);
    } else {
      label.setVisible(false);
    }
  };

  updateLabel();

  const repeatCount = Math.max(0, Math.ceil(duration / 100) - 1);

  time.addEvent({
    delay: 100,
    repeat: repeatCount,
    callback: () => {
      remaining = Math.max(0, remaining - 100);
      updateLabel();
      updateStatus(remaining, null, duration);
    }
  });

  time.delayedCall(duration, () => {
    if (button) setButtonActive(button, true);
    if (label) label.setVisible(false);
    if (typeof onComplete === 'function') onComplete();
    updateStatus(0, null, duration);
  });
}

function getAbilityBonus(key) {
  const source = (typeof abilityBonuses !== 'undefined' ? abilityBonuses : window?.abilityBonuses) || {};
  return source[key] || { damage: 0, cooldown: 0 };
}

// WP07: Map the player.js short ability keys ('spin','charge','dash','dagger','shield','attack')
// to the LootSystem statKey suffixes ('spinAttack','chargeSlash',...). Returns null for 'attack'
// since the plain melee does NOT get a per-ability affix, only 'dmg_all_abilities' / 'cd_all_abilities'.
function _lootAbilityStatKey(abilityKey) {
  switch (abilityKey) {
    case 'spin': return 'spinAttack';
    case 'charge': return 'chargeSlash';
    case 'dash': return 'dashSlash';
    case 'dagger': return 'daggerThrow';
    case 'shield': return 'shieldBash';
    default: return null; // 'attack' and anything else → no per-ability affix
  }
}

function _getLootBonus(statKey) {
  if (!statKey) return 0;
  const LS = window.LootSystem;
  if (!LS || typeof LS.getBonus !== 'function') return 0;
  const v = LS.getBonus(statKey);
  return Number.isFinite(v) ? v : 0;
}

// WP07 T044: Total damage multiplier fraction from equipped affixes for a given ability.
// e.g. abilityKey='spin' returns getBonus('dmg_spinAttack') + getBonus('dmg_all_abilities').
// Plain 'attack' returns only the all-abilities bonus.
function getLootAbilityDamageBonus(abilityKey) {
  const suffix = _lootAbilityStatKey(abilityKey);
  const perAbility = suffix ? _getLootBonus('dmg_' + suffix) : 0;
  const allAbilities = _getLootBonus('dmg_all_abilities');
  return perAbility + allAbilities;
}

// WP07 T045: Total cooldown reduction fraction from equipped affixes for a given ability.
// Returns the subtractive fraction (e.g. 0.25 → cooldown shrinks by 25%).
function getLootAbilityCooldownReduction(abilityKey) {
  const suffix = _lootAbilityStatKey(abilityKey);
  const perAbility = suffix ? _getLootBonus('cd_' + suffix) : 0;
  const allAbilities = _getLootBonus('cd_all_abilities');
  return perAbility + allAbilities;
}

function applyCooldownModifier(base, key) {
  const bonus = getAbilityBonus(key);
  const mult = Math.max(0.2, 1 - (bonus.cooldown || 0));
  // WP07 T045: also apply equipment affix cooldown reduction from LootSystem.
  // cdReductionMul = 1 - cd_<ability> - cd_all_abilities; floor resulting CD at 100ms.
  const lootCdMul = Math.max(0, 1 - getLootAbilityCooldownReduction(key));
  const effective = base * mult * lootCdMul;
  return Math.max(100, effective);
}

// WP07 T046 NOTE: The HUD bonus badge (+22% / -12% CD text under each ability slot tile)
// must be added in js/main.js inside buildTile / refreshSlotMappings. That file is owned
// by another work package, so the badge is deferred to a follow-up WP.
// WP07 T048 NOTE: Hooking LootSystem.recomputeBonuses() into equip-change events
// requires edits to js/inventory.js, js/scenes/CraftingScene.js, and js/storage.js,
// none of which are owned by WP07. Deferred to a follow-up WP.

const CHARGED_SLASH_MIN_CHARGE = 300;
const CHARGED_SLASH_MAX_CHARGE = 1500;
const DEFAULT_ATTACK_RANGE_BASE = 100;
const SPIN_RANGE_BASE = 120;
const SPIN_COOLDOWN_BASE = 5000;
const SPIN_COOLDOWN_MIN = 800;
const CHARGED_SLASH_COOLDOWN_BASE = 4500;
const CHARGED_SLASH_COOLDOWN_MIN = 1200;
const DASH_SLASH_COOLDOWN_BASE = 3200;
const DASH_SLASH_COOLDOWN_MIN = 700;
const DASH_SLASH_DURATION_BASE = 220;
const DASH_SLASH_DISTANCE_BASE = 220;
const DASH_SLASH_RANGE_BASE = 120;
const DASH_SLASH_ARC = Phaser.Math.DegToRad(80);
const DAGGER_THROW_COOLDOWN_BASE = 2200;
const DAGGER_THROW_COOLDOWN_MIN = 500;
const DAGGER_THROW_SPEED_BASE = 480;
const DAGGER_THROW_LIFESPAN_BASE = 1200;
const DAGGER_THROW_KNOCKBACK = 140;
const SHIELD_BASH_COOLDOWN_BASE = 5000;
const SHIELD_BASH_COOLDOWN_MIN = 1200;
const SHIELD_BASH_RANGE_BASE = 90;
const SHIELD_BASH_ARC = Phaser.Math.DegToRad(110);

function getAttackSpeedMultiplier() {
  return Math.max(0.2, weaponAttackSpeed || 1);
}

function getRangeFromBase(base) {
  return attackRange * (base / DEFAULT_ATTACK_RANGE_BASE);
}

function getMeleeCooldown() {
  return Math.max(250, 500 / getAttackSpeedMultiplier());
}

function getSpinRange() {
  return getRangeFromBase(SPIN_RANGE_BASE);
}

function getSpinCooldown() {
  return Math.max(SPIN_COOLDOWN_MIN, SPIN_COOLDOWN_BASE / getAttackSpeedMultiplier());
}

function getChargedSlashCooldown() {
  return Math.max(CHARGED_SLASH_COOLDOWN_MIN, CHARGED_SLASH_COOLDOWN_BASE / getAttackSpeedMultiplier());
}

function getDashSlashRange() {
  return getRangeFromBase(DASH_SLASH_RANGE_BASE);
}

function getDashSlashDistance() {
  let dist = getRangeFromBase(DASH_SLASH_DISTANCE_BASE);
  // Schattensprung (Shadow Step): dash slash distance +50%
  if (typeof window.hasSkill === 'function' && window.hasSkill('mobility_shadow_step')) {
    dist *= 1.5;
  }
  return dist;
}

function getDashSlashDuration() {
  return Math.max(140, DASH_SLASH_DURATION_BASE / getAttackSpeedMultiplier());
}

function getDashSlashCooldown() {
  return Math.max(DASH_SLASH_COOLDOWN_MIN, DASH_SLASH_COOLDOWN_BASE / getAttackSpeedMultiplier());
}

function getDaggerThrowSpeed() {
  return DAGGER_THROW_SPEED_BASE * getAttackSpeedMultiplier();
}

function getDaggerThrowLifespan() {
  return DAGGER_THROW_LIFESPAN_BASE * (attackRange / DEFAULT_ATTACK_RANGE_BASE);
}

function getDaggerThrowCooldown() {
  return Math.max(DAGGER_THROW_COOLDOWN_MIN, DAGGER_THROW_COOLDOWN_BASE / getAttackSpeedMultiplier());
}

function getShieldBashRange() {
  return getRangeFromBase(SHIELD_BASH_RANGE_BASE);
}

function getShieldBashCooldown() {
  return Math.max(SHIELD_BASH_COOLDOWN_MIN, SHIELD_BASH_COOLDOWN_BASE / getAttackSpeedMultiplier());
}

function handlePlayerMovement() {
  if (isDashing) return;

  // Stun check: if stunned, stop all movement
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) {
    player.setVelocity(0, 0);
    updatePlayerSpriteAnimation(player, 0, 0);
    return;
  }

  // Eingaben sammeln
  let vx = 0, vy = 0;
  if (cursors.left.isDown)  vx -= 1;
  if (cursors.right.isDown) vx += 1;
  if (cursors.up.isDown)    vy -= 1;
  if (cursors.down.isDown)  vy += 1;

  // Slow check: reduce speed if slowed
  let effectiveSpeed = playerSpeed;
  if (window.statusEffectManager) {
    effectiveSpeed *= window.statusEffectManager.getSpeedMultiplier(player);
  }

  // Richtung normalisieren -> konstante Geschwindigkeit (auch diagonal)
  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy);     // 1 bei gerade, ~1.414 diagonal
    vx = (vx / len) * effectiveSpeed;
    vy = (vy / len) * effectiveSpeed;

    player.setVelocity(vx, vy);
    updatePlayerSpriteAnimation(player, vx, vy);

    // Blickrichtung aktualisieren
    lastMoveDirection.set(vx, vy).normalize();
  } else {
    player.setVelocity(0, 0);
    updatePlayerSpriteAnimation(player, 0, 0);
  }
}

function handleMobileMovement() {
  if (isDashing) return;

  // Stun check: if stunned, stop all movement
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) {
    player.setVelocity(0, 0);
    updatePlayerSpriteAnimation(player, 0, 0);
    return;
  }

  // Wenn kein Joystick existiert, nichts tun
  if (!joystick) {
    return
  }

  // Slow check: reduce speed if slowed
  let effectiveSpeed = playerSpeed;
  if (window.statusEffectManager) {
    effectiveSpeed *= window.statusEffectManager.getSpeedMultiplier(player);
  }

  const force = joystick.force;       // 0.0 … 1.0
  if (force > 0) {
    // Winkel in Radiant umrechnen
    const rad = Phaser.Math.DegToRad(joystick.angle);

    // Geschwindigkeit entlang X/Y
    const vx = Math.cos(rad) * effectiveSpeed;
    const vy = Math.sin(rad) * effectiveSpeed;

    // Spieler bewegen
    player.setVelocity(vx, vy);
    updatePlayerSpriteAnimation(player, vx, vy);

    // Merke dir die letzte Bewegungsrichtung für Angriffe
    lastMoveDirection.set(Math.cos(rad), Math.sin(rad));
  } else {
    // Kein Druck → stehen bleiben
    player.setVelocity(0, 0);
    updatePlayerSpriteAnimation(player, 0, 0);
  }
}

function handlePlayerAttack() {
  if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
    attack.call(this);
  }
}

function showAttackEffect(scene, options = {}) {
  if (!scene || !player) return;

  const {
    range = attackRange,
    arcWidth = Math.PI / 3,
    color = 0xffffff,
    alpha = 0.2,
    duration = 100
  } = options;

  const angle = lastMoveDirection.angle?.() ?? 0;
  const g = scene.add.graphics();
  g.fillStyle(color, alpha);
  g.slice(
    player.x,
    player.y,
    range,
    angle - arcWidth / 2,
    angle + arcWidth / 2,
    false
  );
  g.fillPath();

  scene.time.delayedCall(duration, () => g.destroy());
}

function handleEnemyHit(scene, enemy, options = {}) {
  if (!scene || !enemy) return;

  if (enemy.hp <= 0) {
    if (window.soundManager) window.soundManager.playSFX('enemy_death');
    // Particle effects: death burst + screen shake
    if (window.particleFactory) {
      window.particleFactory.deathBurst(enemy.x, enemy.y);
      window.particleFactory.screenShake(80, 0.003);
    }
    spawnLoot.call(scene, enemy.x, enemy.y, null, enemy);
    enemy.destroy();
    defeatedEnemiesInWave += 1;
    addXP.call(scene);
    // Story stats: enemy kill
    if (window.storySystem && typeof window.storySystem.onEnemyKilled === 'function') {
      window.storySystem.onEnemyKilled();
    }
    // Ability unlock tracking: enemy kill counter
    if (window.AbilitySystem && typeof window.AbilitySystem.onEnemyKilled === 'function') {
      window.AbilitySystem.onEnemyKilled();
    }
    // Quest progress: enemy kill
    if (window.questSystem && typeof window.questSystem.updateQuestProgress === 'function') {
      window.questSystem.updateQuestProgress('kill', 'enemy', 1);
      // Track elite kills for quest objectives
      if (enemy.isElite) {
        window.questSystem.updateQuestProgress('kill', 'elite_enemy', 1);
      }
      // Track boss kills for quest objectives
      if (enemy.isBoss && enemy.bossType) {
        var bossMapping = {
          'chainMaster': 'kettenmeister',
          'ceremonyMaster': 'kettenmeister',
          'shadowCouncillor': 'schattenrat'
        };
        var questBossId = bossMapping[enemy.bossType] || enemy.bossType;
        if (typeof window.questSystem.onBossKilled === 'function') {
          window.questSystem.onBossKilled(questBossId);
        }
        // Ability unlock: notify AbilitySystem with raw bossType id
        if (window.AbilitySystem && typeof window.AbilitySystem.onBossKilled === 'function') {
          window.AbilitySystem.onBossKilled(enemy.bossType);
        }
      }
    }
    return;
  }
  if (window.soundManager) window.soundManager.playSFX('hit_enemy');
  // Particle effects: blood splat on hit
  if (window.particleFactory) {
    window.particleFactory.bloodSplat(enemy.x, enemy.y);
  }

  const {
    tint = 0xffff00,
    duration = 100,
    useTween = false,
    tweenAlpha = 0.3
  } = options;

  if (useTween && scene.tweens) {
    scene.tweens.add({
      targets: enemy,
      alpha: tweenAlpha,
      duration,
      yoyo: true,
      repeat: 1
    });
  } else if (enemy.setTint) {
    enemy.setTint(tint);
    scene.time.delayedCall(duration, () => {
      if (enemy && enemy.active) enemy.clearTint();
    }, null, scene);
  }
}

function attack() {
  if (isAttacking || attackCooldown || isDashing || isChargingSlash) return;
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) return;

  isAttacking = true;
  if (window.soundManager) window.soundManager.playSFX('attack');

  showAttackEffect(this);

  const toEnemy = new Phaser.Math.Vector2();

  forEachEnemyInRange(attackRange, (enemy, { dx, dy }) => {
    toEnemy.set(dx, dy);
    const distance = toEnemy.length();
    if (distance === 0) return;

    toEnemy.normalize();
    const dot = lastMoveDirection.dot(toEnemy); // Cosinus-Wert zwischen -1 und 1
    if (dot <= 0.5) return; // ~60° nach vorn

    dealDamageToEnemy(this, enemy, 1, 'attack');
    if (window.particleFactory) window.particleFactory.hitSpark(enemy.x, enemy.y);
    handleEnemyHit(this, enemy, { useTween: true, duration: 100 });

    // Giftklinge (Poison Blade): 20% chance to apply POISON on melee attacks
    if (typeof window.hasSkill === 'function' && window.hasSkill('combat_poison_blade')
        && window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
      if (Math.random() < 0.2) {
        window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.POISON, 'poisonBlade');
      }
    }
  }, { requireLineOfSight: true });

  // Effekt + Angriff abschliessen
  this.time.delayedCall(200, () => {
    isAttacking = false;
  }, null, this);

  attackCooldown = true;
  const baseCd = getMeleeCooldown();
  const cd = applyCooldownModifier(baseCd, 'attack');

  startCooldownTimer(this, cd, {
    button: attackBtn,
    label: attackBtnCooldownText,
    statusKey: 'attack',
    onComplete: () => {
      attackCooldown = false;
    }
  });
}

function _abilityGate(id) {
  if (!window.AbilitySystem) return true;
  return window.AbilitySystem.isLearned(id);
}

function spinAttack() {
  if (!_abilityGate('spinAttack')) return;
  const now = this.time.now;
  const baseCooldown = getSpinCooldown();
  const abilityCooldown = applyCooldownModifier(baseCooldown, 'spin');
  if (isSpinning || now - lastSpinTime < abilityCooldown || isChargingSlash || isDashing) return;

  isSpinning = true;
  lastSpinTime = now;
  if (window.soundManager) window.soundManager.playSFX('ability_spin');

  startCooldownTimer(this, abilityCooldown, {
    button: spinBtn,
    label: spinBtnCooldownText,
    statusKey: 'spin'
  });

  const range = getSpinRange();

  // 1) visueller Effekt: Kreis um Spieler
  const fx = this.add.graphics();
  fx.lineStyle(2, 0x00ffff, 0.8);
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  fx.strokeCircle(x, y, range);
  this.time.delayedCall(200, () => fx.destroy(), null, this);
  // Spin ability trail
  if (window.particleFactory) window.particleFactory.abilityTrail(x, y, 0x00ff88);

  // 2) Schaden an allen Gegnern im Umkreis
  const spinBonus = getAbilityBonus('spin');
  const spinScene = this;
  const spinHitEnemies = [];
  forEachEnemyInRange(range, (enemy) => {
    const { isCrit } = dealDamageToEnemy(spinScene, enemy, 1, 'spin');
    if (window.particleFactory) window.particleFactory.hitSpark(enemy.x, enemy.y);
    handleEnemyHit(spinScene, enemy, {
      tint: isCrit ? 0xfff2a6 : 0xffff00,
      duration: isCrit ? 160 : 100
    });

    // Spin attack applies SLOW
    if (window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
      window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.SLOW, 'spinAttack');
    }

    // Giftklinge (Poison Blade): 20% chance to apply POISON on melee attacks
    if (typeof window.hasSkill === 'function' && window.hasSkill('combat_poison_blade')
        && window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
      if (Math.random() < 0.2) {
        window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.POISON, 'poisonBlade');
      }
    }

    if (enemy && enemy.active) spinHitEnemies.push(enemy);
  }, { requireLineOfSight: true });

  // Kettenblitz (Chain Lightning): spin attack chains to 1 nearby enemy for 50% damage
  if (typeof window.hasSkill === 'function' && window.hasSkill('combat_chain_lightning') && spinHitEnemies.length > 0) {
    const chainRange = 120;
    const hitSet = new Set(spinHitEnemies);
    for (const hitEnemy of spinHitEnemies) {
      if (!hitEnemy || !hitEnemy.active) continue;
      let nearestChainTarget = null;
      let nearestDist = Infinity;
      if (enemies?.children) {
        enemies.children.iterate((candidate) => {
          if (!candidate || !candidate.active || hitSet.has(candidate)) return;
          const cdx = candidate.x - hitEnemy.x;
          const cdy = candidate.y - hitEnemy.y;
          const dist = Math.hypot(cdx, cdy);
          if (dist < chainRange && dist < nearestDist) {
            nearestDist = dist;
            nearestChainTarget = candidate;
          }
        });
      }
      if (nearestChainTarget) {
        hitSet.add(nearestChainTarget);
        dealDamageToEnemy(spinScene, nearestChainTarget, 0.5, 'spin');
        handleEnemyHit(spinScene, nearestChainTarget, {
          tint: 0x88ccff,
          duration: 120
        });
        // Visual: chain lightning line
        const chainFx = spinScene.add.graphics();
        chainFx.lineStyle(2, 0x88ccff, 0.8);
        chainFx.beginPath();
        chainFx.moveTo(hitEnemy.x, hitEnemy.y);
        chainFx.lineTo(nearestChainTarget.x, nearestChainTarget.y);
        chainFx.strokePath();
        spinScene.time.delayedCall(200, () => chainFx.destroy(), null, spinScene);
        break; // only chain once per spin
      }
    }
  }

  // 3) Ende des Spin-State
  this.time.delayedCall(300, () => {
    isSpinning = false;
  }, null, this);
}

function beginChargedSlash() {
  if (!this || !player) return;
  if (!_abilityGate('chargeSlash')) return;
  if (chargeSlashCooldown || isChargingSlash || isSpinning || isDashing) return;

  isChargingSlash = true;
  chargeSlashStartTime = this.time.now;
  if (window.soundManager) window.soundManager.playSFX('ability_charge');
  if (typeof window.updateAbilityStatus === 'function') {
    window.updateAbilityStatus('charge', { customText: 'Charging...', durationMs: CHARGED_SLASH_MAX_CHARGE });
  }

  if (player?.setTint) player.setTint(0xffd27f);

  if (chargeSlashMaxTimer) {
    chargeSlashMaxTimer.remove(false);
    chargeSlashMaxTimer = null;
  }

  chargeSlashMaxTimer = this.time.delayedCall(CHARGED_SLASH_MAX_CHARGE + 50, () => {
    releaseChargedSlash.call(this, true);
  });
}

function releaseChargedSlash(forceMaxCharge = false) {
  if (!this || !isChargingSlash) return;

  const scene = this;
  const now = scene.time.now;
  const elapsed = forceMaxCharge
    ? CHARGED_SLASH_MAX_CHARGE
    : Math.max(0, now - chargeSlashStartTime);
  const clamped = Phaser.Math.Clamp(elapsed, CHARGED_SLASH_MIN_CHARGE, CHARGED_SLASH_MAX_CHARGE);
  const denom = Math.max(1, CHARGED_SLASH_MAX_CHARGE - CHARGED_SLASH_MIN_CHARGE);
  const chargeRatio = (clamped - CHARGED_SLASH_MIN_CHARGE) / denom;

  isChargingSlash = false;

  if (chargeSlashMaxTimer) {
    chargeSlashMaxTimer.remove(false);
    chargeSlashMaxTimer = null;
  }

  if (player?.clearTint) player.clearTint();

  const range = attackRange * (1.1 + chargeRatio * 0.9);
  const arcWidth = Phaser.Math.DegToRad(70 + chargeRatio * 70);
  const damageMultiplier = 1.4 + chargeRatio * 1.8;
  const knockback = 160 + chargeRatio * 200;

  showAttackEffect(scene, {
    range,
    arcWidth,
    color: 0xffd27f,
    alpha: 0.32,
    duration: 200
  });

  const forward = lastMoveDirection.clone?.() ?? new Phaser.Math.Vector2(lastMoveDirection.x, lastMoveDirection.y);
  if (forward.lengthSq() === 0) {
    forward.set(0, 1);
  }
  forward.normalize();

  // Tödlicher Stoß (Lethal Thrust): +25% crit chance for charged slash
  let _savedCritChance;
  if (typeof window.hasSkill === 'function' && window.hasSkill('combat_lethal_thrust')) {
    _savedCritChance = playerCritChance;
    playerCritChance = Math.min(1, (playerCritChance || 0) + 0.25);
  }

  const tempVec = new Phaser.Math.Vector2();
  const threshold = Math.cos(arcWidth / 2);

  const hits = new Set();

  forEachEnemyInRange(range, (enemy, { dx, dy }) => {
    if (hits.has(enemy)) return;
    tempVec.set(dx, dy);
    const len = tempVec.length();
    if (len === 0) return;
    tempVec.scale(1 / len);
    if (forward.dot(tempVec) <= threshold) return;

    hits.add(enemy);
    const { isCrit } = dealDamageToEnemy(scene, enemy, damageMultiplier, 'charge');
    handleEnemyHit(scene, enemy, {
      tint: isCrit ? 0xfff2a6 : 0xffd27f,
      duration: isCrit ? 200 : 140
    });

    // Charge slash applies BLEED
    if (window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
      window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.BLEED, 'chargeSlash');
    }

    if (!enemy || !enemy.active || !enemy.body) return;
    enemy.body.setVelocity(tempVec.x * knockback, tempVec.y * knockback);
    scene.time.delayedCall(140, () => {
      if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
    });
  }, { requireLineOfSight: true });

  // Restore crit chance after Tödlicher Stoß
  if (_savedCritChance !== undefined) {
    playerCritChance = _savedCritChance;
  }

  isAttacking = true;
  scene.time.delayedCall(220, () => {
    isAttacking = false;
  });

  chargeSlashCooldown = true;
  const baseCooldown = getChargedSlashCooldown();
  const finalCooldown = applyCooldownModifier(baseCooldown, 'charge');
  startCooldownTimer(scene, finalCooldown, {
    button: chargeSlashBtn,
    label: chargeSlashCooldownText,
    statusKey: 'charge',
    onComplete: () => {
      chargeSlashCooldown = false;
    }
  });
}

function dashSlash() {
  if (!_abilityGate('dashSlash')) return;
  if (!this || !player) return;
  if (dashSlashCooldown || isDashing || isSpinning || isChargingSlash) return;

  const scene = this;
  const baseCooldown = getDashSlashCooldown();
  const finalCooldown = applyCooldownModifier(baseCooldown, 'dash');
  const dashDir = lastMoveDirection.clone?.() ?? new Phaser.Math.Vector2(lastMoveDirection.x, lastMoveDirection.y);
  if (dashDir.lengthSq() === 0) dashDir.set(0, 1);
  dashDir.normalize();

  if (isDashing) return;
  isDashing = true;
  if (window.soundManager) window.soundManager.playSFX('ability_dash');

  const dashRange = getDashSlashRange();
  const dashDistance = getDashSlashDistance();
  const dashDuration = getDashSlashDuration();
  const dashSpeed = dashDistance / (dashDuration / 1000);
  if (player?.setTint) player.setTint(0x7fd6ff);
  if (player?.body) player.body.setMaxVelocity(dashSpeed, dashSpeed);
  if (player?.setVelocity) {
    player.setVelocity(dashDir.x * dashSpeed, dashDir.y * dashSpeed);
  }

  const tempVec = new Phaser.Math.Vector2();
  const dashHits = new Set();
  const threshold = Math.cos(DASH_SLASH_ARC / 2);
  const knockback = 180;
  const damageMultiplier = 1.1;

  const applyDashDamage = () => {
    forEachEnemyInRange(dashRange, (enemy, { dx, dy }) => {
      if (dashHits.has(enemy)) return;
      tempVec.set(dx, dy);
      const len = tempVec.length();
      if (len === 0) return;
      tempVec.scale(1 / len);
      if (dashDir.dot(tempVec) <= threshold) return;

      dashHits.add(enemy);
      const { isCrit } = dealDamageToEnemy(scene, enemy, damageMultiplier, 'dash');
      handleEnemyHit(scene, enemy, {
        tint: isCrit ? 0xfff2a6 : 0x7fd6ff,
        duration: isCrit ? 180 : 120
      });

      if (!enemy || !enemy.active || !enemy.body) return;
      enemy.body.setVelocity(tempVec.x * knockback, tempVec.y * knockback);
      scene.time.delayedCall(140, () => {
        if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
      });
    }, { requireLineOfSight: true });
  };

  applyDashDamage();
  // Dash ability trail (blue)
  if (window.particleFactory && player) {
    window.particleFactory.abilityTrail(player.x, player.y, 0x7fd6ff);
  }
  const tick = 40;
  const repeat = Math.max(0, Math.floor(dashDuration / tick) - 1);
  for (let i = 1; i <= repeat; i++) {
    scene.time.delayedCall(i * tick, () => {
      applyDashDamage();
      if (window.particleFactory && player && player.active) {
        window.particleFactory.abilityTrail(player.x, player.y, 0x7fd6ff);
      }
    });
  }

  showAttackEffect(scene, {
    range: dashRange,
    arcWidth: DASH_SLASH_ARC,
    color: 0x7fd6ff,
    alpha: 0.25,
    duration: dashDuration
  });

  scene.time.delayedCall(dashDuration, () => {
    if (player && player.active) {
      player.setVelocity(0, 0);
      if (player.body) player.body.setMaxVelocity(220, 220);
      if (player.clearTint) player.clearTint();
    }
    isDashing = false;
  });

  dashSlashCooldown = true;
  startCooldownTimer(scene, finalCooldown, {
    button: dashSlashBtn,
    label: dashSlashCooldownText,
    statusKey: 'dash',
    onComplete: () => {
      dashSlashCooldown = false;
    }
  });
}

function ensurePlayerDaggerTexture(scene) {
  if (!scene || scene.textures.exists('playerDagger')) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(4, 12, 20, 12, 8, 2);
  g.fillRect(4, 10, 8, 4);
  g.generateTexture('playerDagger', 24, 24);
  g.destroy();
}

function throwDagger() {
  if (!_abilityGate('daggerThrow')) return;
  if (!this || !player || !playerProjectiles) return;
  if (daggerThrowCooldown || isChargingSlash) return;

  if (window.soundManager) window.soundManager.playSFX('ability_dagger');
  const scene = this;
  ensurePlayerDaggerTexture(scene);

  const dir = lastMoveDirection.clone?.() ?? new Phaser.Math.Vector2(lastMoveDirection.x, lastMoveDirection.y);
  if (dir.lengthSq() === 0) dir.set(0, 1);
  dir.normalize();

  const spawnOffset = 24;
  const projectile = scene.physics.add.sprite(
    player.x + dir.x * spawnOffset,
    player.y + dir.y * spawnOffset,
    'playerDagger'
  );

  projectile.setDepth(70);
  projectile.setRotation(dir.angle());
  projectile.setOrigin(0.3, 0.5);
  projectile.setScale(0.8);
  projectile.body?.setAllowGravity?.(false);
  projectile.body?.setSize?.(14, 6);
  projectile.body?.setOffset?.(6, 9);
  projectile.setData('damageMult', 1.0);
  projectile.setData('knockback', DAGGER_THROW_KNOCKBACK);

  playerProjectiles.add(projectile);

  const projectileSpeed = getDaggerThrowSpeed();
  projectile.body.setVelocity(dir.x * projectileSpeed, dir.y * projectileSpeed);

  const lifespan = getDaggerThrowLifespan();
  scene.time.delayedCall(lifespan, () => {
    if (projectile && projectile.active) projectile.destroy();
  });

  daggerThrowCooldown = true;
  const baseCooldown = getDaggerThrowCooldown();
  const finalCooldown = applyCooldownModifier(baseCooldown, 'dagger');
  startCooldownTimer(scene, finalCooldown, {
    button: daggerThrowBtn,
    label: daggerThrowCooldownText,
    statusKey: 'dagger',
    onComplete: () => {
      daggerThrowCooldown = false;
    }
  });
}

function shieldBash() {
  if (!_abilityGate('shieldBash')) return;
  if (!this || !player) return;
  if (shieldBashCooldown || isDashing) return;

  if (window.soundManager) window.soundManager.playSFX('ability_shield');
  const scene = this;
  const range = getShieldBashRange();
  const cooldown = getShieldBashCooldown();
  const finalCooldown = applyCooldownModifier(cooldown, 'shield');
  const forward = lastMoveDirection.clone?.() ?? new Phaser.Math.Vector2(lastMoveDirection.x, lastMoveDirection.y);
  if (forward.lengthSq() === 0) forward.set(0, 1);
  forward.normalize();

  showAttackEffect(scene, {
    range,
    arcWidth: SHIELD_BASH_ARC,
    color: 0x8be0c8,
    alpha: 0.35,
    duration: 160
  });

  const tempVec = new Phaser.Math.Vector2();
  const threshold = Math.cos(SHIELD_BASH_ARC / 2);
  const knockback = 200;
  const damageMultiplier = 0.9;

  if (player?.setTint) {
    player.setTint(0x8be0c8);
    scene.time.delayedCall(160, () => {
      if (player && player.active && player.clearTint) player.clearTint();
    });
  }

  forEachEnemyInRange(range, (enemy, { dx, dy }) => {
    tempVec.set(dx, dy);
    const len = tempVec.length();
    if (len === 0) return;
    tempVec.scale(1 / len);
    if (forward.dot(tempVec) <= threshold) return;

    const { isCrit } = dealDamageToEnemy(scene, enemy, damageMultiplier, 'shield');
    handleEnemyHit(scene, enemy, {
      tint: isCrit ? 0xfff2a6 : 0x8be0c8,
      duration: isCrit ? 200 : 140
    });

    // Shield bash applies STUN
    if (window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
      window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.STUN, 'shieldBash');
    }

    if (!enemy || !enemy.active || !enemy.body) return;
    enemy.body.setVelocity(tempVec.x * knockback, tempVec.y * knockback);
    scene.time.delayedCall(180, () => {
      if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
    });
  }, { requireLineOfSight: true });

  shieldBashCooldown = true;
  startCooldownTimer(scene, finalCooldown, {
    button: shieldBashBtn,
    label: shieldBashCooldownText,
    statusKey: 'shield',
    onComplete: () => {
      shieldBashCooldown = false;
    }
  });
}

function handlePlayerProjectileEnemyOverlap(projectile, enemy) {
  if (!this || !projectile || !enemy) return;

  const scene = this;
  if (!projectile.active || !enemy.active) {
    if (projectile.active) projectile.destroy();
    return;
  }

  const damageMult = projectile.getData('damageMult') ?? 1;
  const knockback = projectile.getData('knockback') ?? DAGGER_THROW_KNOCKBACK;

  const { isCrit } = dealDamageToEnemy(scene, enemy, damageMult, 'dagger');
  handleEnemyHit(scene, enemy, {
    tint: isCrit ? 0xfff2a6 : 0xffaa88,
    duration: isCrit ? 200 : 140
  });

  // Dagger throw applies POISON
  if (window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
    window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.POISON, 'dagger');
  }

  if (enemy && enemy.active && enemy.body) {
    const dx = enemy.x - projectile.x;
    const dy = enemy.y - projectile.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.body.setVelocity((dx / len) * knockback, (dy / len) * knockback);
    scene.time.delayedCall(120, () => {
      if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
    });
  }

  // Windstoß (Wind Gust): dagger pierces through first enemy
  if (typeof window.hasSkill === 'function' && window.hasSkill('mobility_wind_gust')
      && !projectile.getData('hasPierced')) {
    projectile.setData('hasPierced', true);
    // Don't destroy, let it continue
  } else {
    projectile.destroy();
  }
}

function addXP(amount = 1) {
  playerXP += amount;

  if (playerXP >= neededXP) {
    playerXP = 0;
    playerLevel += 1;
    baseStats.maxHP += 2;
    if (typeof setPlayerMaxHealth === 'function') {
      setPlayerMaxHealth(playerMaxHealth + 2, { updateUi: false });
    } else {
      playerMaxHealth += 2;
      playerHealth = Math.min(playerMaxHealth, playerHealth + 2);
    }
    neededXP = 2 * playerLevel;

    if (window.soundManager) window.soundManager.playSFX('level_up');

    if (levelUpText) {
      levelUpText.setVisible(true);

      const scene = (this && this.time && typeof this.time.delayedCall === 'function')
        ? this
        : (typeof window !== 'undefined' ? window.currentScene : null);

      if (scene?.time?.delayedCall) {
        scene.time.delayedCall(1000, () => levelUpText.setVisible(false), null, scene);
      } else {
        setTimeout(() => levelUpText.setVisible(false), 1000);
      }
    }
  }

  updateHUD();
}

function updateHUD() {
  const current = Math.round(Math.max(0, playerHealth));
  const max = Math.round(Math.max(1, playerMaxHealth));
  
  if (playerHealthText?.setText && playerHealthText.scene?.sys?.isActive()) {
    try {
      playerHealthText.setText(`Health: ${current}/${max}`);
    } catch (err) {
      console.warn('[updateHUD] Failed to update health text:', err);
    }
  }
  
  if (playerXPText?.setText && playerXPText.scene?.sys?.isActive()) {
    try {
      playerXPText.setText(`Level: ${playerLevel}  XP: ${playerXP}/${neededXP}`);
    } catch (err) {
      console.warn('[updateHUD] Failed to update XP text:', err);
    }
  }
}
