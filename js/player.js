let lastMoveDirection = new Phaser.Math.Vector2(0, 1); // Standard: Blick nach vorn (nach unten)
// Expose on window so InputScheme.getAimDirection (classic mode) and
// mobileAutoAim can read/update the same Vector2 instance.
window.lastMoveDirection = lastMoveDirection;

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
      // 052 WP03: apply LINEAR post-normalization for THIS direction.
      // (Normalization swaps texture via addCanvas → wipes prior filter.)
      if (window.RenderQuality) {
        window.RenderQuality.applyLinearFilterByPrefix(scene, [`dir${dd}_`]);
      }
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

// Zustandsabhängiger Spieler-Tint: wird jeden Frame in updatePlayerSpriteAnimation
// gesetzt (sonst überschreibt das Richtungs-Sprite jeden Overlay-Tint sofort).
// Berserker -> rot, Heilung -> kurzer grüner Flash, sonst neutral.
function _playerOverlayTint() {
  try {
    // Heil-Flash gegen die Wall-Clock (Date.now) — scene.time.now ist pro Szene
    // verschieden, sonst bleibt der Flash über einen Szenenwechsel hängen.
    if (window._healFlashUntil && Date.now() < window._healFlashUntil) return 0x66ff8a;
    var sc = (typeof player !== 'undefined' && player && player.scene) ? player.scene : null;
    var now = (sc && sc.time && typeof sc.time.now === 'number') ? sc.time.now : 0;
    var bs = window.berserkState;
    if (bs && bs.active && (typeof bs.expiry !== 'number' || now < bs.expiry)) return 0xff4040;
  } catch (e) { /* fall through to neutral */ }
  return PLAYER_TINT_COLOR;
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
  // In ARPG the sprite faces the cursor-based aim instead of the movement
  // direction — enables strafe/kite play. The dead-zone fallback ('lastKnown')
  // means hovering the cursor on the player keeps the current facing instead
  // of snapping back to movement direction.
  const scheme = (window.InputScheme && typeof window.InputScheme.getScheme === 'function')
    ? window.InputScheme.getScheme() : 'classic';
  let facingX = vx, facingY = vy;
  if (scheme === 'arpg' && window.InputScheme && typeof window.InputScheme.getAimDirection === 'function') {
    const aim = window.InputScheme.getAimDirection(sprite.scene || null, sprite);
    if (aim && aim.source === 'cursor') {
      facingX = aim.x;
      facingY = aim.y;
    }
    // When source is 'lastKnown', keep facing from the cached lastAim so
    // the sprite doesn't snap to movement direction mid-kite.
    else if (aim && aim.source === 'lastKnown') {
      facingX = aim.x;
      facingY = aim.y;
    }
  }
  const hasFacing = facingX !== 0 || facingY !== 0;
  const direction = hasFacing
    ? getDirectionFromVelocity(facingX, facingY, state.direction || PLAYER_DEFAULT_DD)
    : (state.direction || PLAYER_DEFAULT_DD);

  // --- Espionage-Verkleidung: ERSETZT das Spieler-Sprite durch die Kettenrat-
  // Waechter-Montur (kein Overlay mehr). Richtung (links/rechts) + Lauf-Frames
  // folgen der Bewegung; bei Enttarnung faellt die Verkleidung -> unten laeuft
  // wieder die normale Spieler-Animation.
  if (window.EspionageSystem && typeof window.EspionageSystem.isDisguised === 'function'
      && window.EspionageSystem.isDisguised()
      && sprite.scene?.textures?.exists('chainguard_right0')) {
    let ddir = state._disguiseDir || 'right';
    if (facingX < -0.01) ddir = 'left';
    else if (facingX > 0.01) ddir = 'right';
    state._disguiseDir = ddir;
    let dframe = 0;
    if (moving) {
      const now = sprite.scene.time?.now || 0;
      const c = Math.floor(now / 140) % 4;
      dframe = (c === 1) ? 1 : (c === 3) ? 2 : 0;
    }
    const dkey = `chainguard_${ddir}${dframe}`;
    if (sprite.scene.textures.exists(dkey) && sprite.texture.key !== dkey) {
      if (state.playing) { sprite.anims.stop(); state.playing = null; }
      sprite.setTexture(dkey);
    }
    // Groesse an die normale Spielerhoehe angleichen (etwas groesser, sonst
    // wirkt die Montur zu klein). Aspect aus dem Frame erhalten.
    const baseH = window.PLAYER_BASE_DISPLAY_HEIGHT || PLAYER_BASE_DISPLAY_HEIGHT;
    const vScale = (window.PLAYER_VISUAL_SCALE != null ? window.PLAYER_VISUAL_SCALE : PLAYER_VISUAL_SCALE) || 1;
    const dH = Math.max(1, Math.round(baseH * vScale * 1.2));
    // Wachen sollen exakt so gross wie die verkleidete Spielerfigur sein.
    if (typeof window !== 'undefined') window.__ESP_GUARD_H = dH;
    const fw = (sprite.frame && (sprite.frame.cutWidth || sprite.frame.width)) || dH;
    const fh = (sprite.frame && (sprite.frame.cutHeight || sprite.frame.height)) || dH;
    const dW = Math.max(1, Math.round(dH * (fw / fh)));
    const doy = (window.PLAYER_ORIGIN_Y != null ? window.PLAYER_ORIGIN_Y : PLAYER_ORIGIN_Y);
    sprite.setOrigin(0.5, doy);
    sprite.setDisplaySize(dW, dH);
    if (sprite.body) {
      const sx = Math.abs(sprite.scaleX) || 1, sy = Math.abs(sprite.scaleY) || 1;
      const cw = Math.max(8, window.PLAYER_COLLIDER_WIDTH != null ? window.PLAYER_COLLIDER_WIDTH : PLAYER_COLLIDER_WIDTH);
      const ch = Math.max(8, window.PLAYER_COLLIDER_HEIGHT != null ? window.PLAYER_COLLIDER_HEIGHT : PLAYER_COLLIDER_HEIGHT);
      sprite.body.setSize(cw / sx, ch / sy);
      const ax = sprite.displayWidth, ay = sprite.displayHeight;
      sprite.body.setOffset(Math.max(0, (ax - cw) / 2) / sx, Math.max(0, ay * doy - ch) / sy);
    }
    sprite.clearTint();                 // Montur ungetintet zeigen (kein Disguise-Blau)
    state.direction = direction;
    sprite.setData('animState', state);
    return;
  }

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
    sprite.setTint(_playerOverlayTint());
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
  // Feature 059 WP03: run-amulet per-hit damage multiplier (Schlächterkrone
  // momentum kill-stacks). 1 if no amulet / decayed. (Glass-Amulett geht ueber
  // recalcDerived, nicht hier.)
  const amuletDmgMul = (window.AmuletEffects && typeof window.AmuletEffects.damageMul === 'function')
    ? window.AmuletEffects.damageMul() : 1;
  // === 060 Strang WUT — Berserker (berserk) ===
  // Globaler Schadens-Buff (LP-Opfer). window.berserkState wird von der berserk-
  // Ability gesetzt und laeuft zeitlich ab. Defensiv: Default 1.
  let berserkDmgMul = 1;
  try {
    const bs = window.berserkState;
    if (bs && bs.active) {
      const bnow = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();
      if (bnow <= (bs.expiry || 0)) berserkDmgMul = bs.mult || 1;
    }
  } catch (e) { /* never break combat */ }
  // === 060 Strang WUT — per-cast Skill-Rang-Multiplikator ===
  // whirlwind/hammer-Casts setzen window._skillCastDmgMult (aus SkillTree-Rang/
  // Synergie) vor dem Aufruf der Basis-Funktion und raeumen danach auf.
  // Defensiv: Default 1.
  let skillCastDmgMul = 1;
  try {
    const sc = window._skillCastDmgMult;
    if (typeof sc === 'number' && isFinite(sc) && sc > 0) skillCastDmgMul = sc;
  } catch (e) { /* never break combat */ }
  const base = Math.max(1, weaponDamage * multiplier * damageMult * lootDmgMul * amuletDmgMul * berserkDmgMul * skillCastDmgMul);
  // #60: Krit-Multiplikator 1.5x + Staerke-Zweiteffekt (playerCritDamageBonus).
  const critMult = 1.5 + (typeof window.playerCritDamageBonus === 'number' ? window.playerCritDamageBonus : 0);
  const damage = Math.max(1, Math.round(isCrit ? base * critMult : base));

  // Snapshot maxHp on first hit so the lazy enemy hp bar (drawn by
  // handleEnemyHit -> drawEnemyHpBar) has a correct denominator. Many
  // regular enemies don't carry maxHp on spawn — only mini-bosses /
  // bosses do — so without this capture the bar would treat the
  // post-damage hp as 100% and look like the enemy is at full health.
  if (typeof enemy.maxHp !== 'number') enemy.maxHp = enemy.hp;
  enemy.hp -= damage;

  if (isCrit && enemy.active && scene?.time) {
    enemy.setTintFill(0xfff2a6);
    scene.time.delayedCall(160, () => {
      if (enemy && enemy.active) enemy.clearTint();
    });
  }

  // Lebensraub (Life Steal): combine skill + loot affix "of the Leech" + endless buff.
  if (damage > 0 && typeof addPlayerHealth === 'function') {
    let lsPct = 0;
    if (typeof window.hasSkill === 'function' && window.hasSkill('survival_life_steal')) {
      lsPct += 0.10;
    }
    if (window.LootSystem && typeof window.LootSystem.getBonus === 'function') {
      lsPct += (window.LootSystem.getBonus('lifesteal') || 0) / 100;
    }
    lsPct += window.PLAYER_LIFESTEAL || 0;
    // Feature 059 WP03: Aderlass-Talisman — starker Lebensraub (ueber Affixe).
    if (window.AmuletEffects && typeof window.AmuletEffects.lifestealPct === 'function') {
      lsPct += window.AmuletEffects.lifestealPct();
    }
    if (lsPct > 0) {
      addPlayerHealth(Math.max(1, Math.round(damage * lsPct)));
    }
  }

  // Feature 059 WP03: Kettenherz (chain) — the hit jumps to up to N nearby
  // enemies for a reduced fraction. Applied DIRECTLY (not via dealDamageToEnemy)
  // and guarded so chained hits never re-chain (no cascade).
  const _chain = (window.AmuletEffects && typeof window.AmuletEffects.chainParams === 'function')
    ? window.AmuletEffects.chainParams() : null;
  if (_chain && damage > 0 && !window.__amuletChaining && typeof enemies !== 'undefined'
      && enemies && enemies.children) {
    window.__amuletChaining = true;
    try {
      const _near = [];
      enemies.children.iterate((cand) => {
        if (!cand || !cand.active || cand === enemy) return;
        const cd = Math.hypot((cand.x || 0) - enemy.x, (cand.y || 0) - enemy.y);
        if (cd <= _chain.range) _near.push({ cand, cd });
      });
      _near.sort((a, b) => a.cd - b.cd);
      const _chainDmg = Math.max(1, Math.round(damage * _chain.frac));
      for (let _i = 0; _i < Math.min(_chain.count, _near.length); _i++) {
        const _ce = _near[_i].cand;
        if (typeof _ce.maxHp !== 'number') _ce.maxHp = _ce.hp;
        _ce.hp -= _chainDmg;
        if (window.particleFactory) window.particleFactory.hitSpark(_ce.x, _ce.y);
        handleEnemyHit(scene, _ce, { tint: 0x66ccff, duration: 80 });
      }
    } catch (e) { /* never crash gameplay */ }
    window.__amuletChaining = false;
  }

  // Feature 059 WP03: Frostsiegel (frost) — hits chill the enemy (SLOW) and mark
  // it, so a chilled enemy shatters into a frost burst when it dies.
  const _frostHit = (window.AmuletEffects && typeof window.AmuletEffects.frostParams === 'function')
    ? window.AmuletEffects.frostParams() : null;
  if (_frostHit && damage > 0 && enemy && enemy.active
      && window.statusEffectManager && window.StatusEffectType) {
    try {
      window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.SLOW, 'amuletFrost');
      enemy.__amuletChilled = true;
    } catch (e) { /* never crash gameplay */ }
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
window.performRoll = performRoll;
window.throwDagger = throwDagger;
window.shieldBash = shieldBash;
window.handlePlayerProjectileEnemyOverlap = handlePlayerProjectileEnemyOverlap;

function hasLineOfSightToEnemy(enemy) {
  if (!enemy || !player || typeof Steering === 'undefined' || !obstacles) {
    return !!enemy;
  }
  // Check obstacles first
  if (!Steering.hasLineOfSight(player, enemy, obstacles)) return false;
  // Also check closed doors (separate physics group)
  var scene = player.scene || (obstacles && obstacles.scene);
  if (scene && scene._doorGroup) {
    var line = new Phaser.Geom.Line(player.x, player.y, enemy.x, enemy.y);
    var blocked = false;
    scene._doorGroup.children.iterate(function (door) {
      if (blocked || !door || !door.active) return;
      if (door.getData && door.getData('walkthrough')) return; // open door
      var r = door.getBounds();
      if (Phaser.Geom.Intersects.LineToRectangle(line, r)) blocked = true;
    });
    if (blocked) return false;
  }
  return true;
}

// Test whether a destructible obstacle is visible to the player. We can't
// reuse hasLineOfSightToEnemy here because Steering.hasLineOfSight intersects
// every obstacle in the obstacles group — including the destructible target
// itself, which would always block the line. Instead we test against the
// cached fog-of-war vision polygon (built each frame by
// roomManager.updateFogOfWar), which already accounts for walls and closed
// doors via raycasting. Falls back to "allowed" if the polygon hasn't been
// computed yet (early frames, headless tests) so combat never softlocks.
function hasLineOfSightToTarget(target) {
  if (!target || !player) return !!target;
  var scene = player.scene || (obstacles && obstacles.scene);
  var poly = scene && scene._lastVisionPolygon;
  if (!poly || poly.length < 6
      || typeof Phaser === 'undefined'
      || !Phaser.Geom || !Phaser.Geom.Polygon) {
    return true; // no LOS data yet — fail open to avoid breaking combat
  }
  // Reuse the cached Polygon object across frames (mirrors the pattern in
  // eliteEnemies.js so we don't allocate a Polygon per attack).
  try {
    if (!scene._lastVisionPolyObj || scene._lastVisionPolyData !== poly) {
      scene._lastVisionPolyObj = new Phaser.Geom.Polygon(poly);
      scene._lastVisionPolyData = poly;
    }
    return Phaser.Geom.Polygon.Contains(scene._lastVisionPolyObj, target.x, target.y);
  } catch (_) {
    return true; // polygon malformed — fail open
  }
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

    // _hitReach (grosse Gegner mit gefittetem Body, enemy.js fitBodyToSprite)
    // erweitert die Reichweite um den Trefferradius: der Schlag muss die
    // Body-KANTE erreichen, nicht das Zentrum. Ohne das haelt der solide
    // Boss-Body den Spieler vom Zentrum weg -> vertikale Angriffe verfehlen.
    // Normale Gegner haben kein _hitReach -> Verhalten unveraendert.
    const reach = enemy._hitReach || 0;
    if (distance - reach > range) return;
    if (requireLineOfSight && !hasLineOfSightToEnemy(enemy)) return;

    callback(enemy, { distance, dx, dy });
  });
}

// Gegenstueck zu forEachEnemyInRange fuer zerstoerbare Props (Truhen, Kisten,
// Faesser, Statuen, Saeulen). Skills trafen bisher NUR Gegner — ein Wirbelwind
// mitten in einer Saeulenhalle liess alles stehen, waehrend ein simpler
// Nahkampfschlag (player.js) und Projektile (main.js-Collider) laengst Props
// zerschlugen. Radius-basiert: die Skills haben zwar unterschiedliche Formen
// (Kegel/Linie/Kreis), aber "was im Wirkbereich lag, zerbricht" ist die
// erwartbare Regel — und Props sind statisch, also gibt es kein Zielproblem.
// scene wird durchgereicht, weil breakDestructibleObstacle die Szene fuer
// Partikel/Loot braucht.
// `cx`/`cy` verschieben das Zentrum weg vom Spieler — noetig fuer Skills, deren
// Wirkung NICHT beim Spieler liegt (Hammer-Einschlag vor dem Spieler). Deren
// forEachEnemyInRange-Reichweite ist nur ein grober Vorfilter, die echte Form
// rechnet der Callback; wer die Vorfilter-Reichweite hier durchreicht, zerlegt
// Props quer durch den Raum.
function breakDestructiblesInRange(scene, range, options = {}) {
  if (!obstacles?.children || !player) return 0;
  if (typeof window.breakDestructibleObstacle !== 'function') return 0;

  const { requireLineOfSight = false, cx = null, cy = null } = options;
  const px = (cx != null) ? cx : (player.x ?? player.body?.x ?? 0);
  const py = (cy != null) ? cy : (player.y ?? player.body?.y ?? 0);

  // Erst sammeln, dann brechen: breakDestructibleObstacle ruft obs.destroy(),
  // und waehrend children.iterate() aus der Gruppe zu entfernen ueberspringt
  // Eintraege.
  const targets = [];
  obstacles.children.iterate((obs) => {
    if (!obs || !obs.active || !obs.getData || !obs.getData('destructible')) return;
    const dx = (obs.x ?? 0) - px;
    const dy = (obs.y ?? 0) - py;
    if (Math.hypot(dx, dy) > range) return;
    if (requireLineOfSight && !hasLineOfSightToTarget(obs)) return;
    targets.push(obs);
  });
  targets.forEach((t) => {
    try { window.breakDestructibleObstacle(scene, t); } catch (e) {}
  });
  return targets.length;
}
if (typeof window !== 'undefined') window.breakDestructiblesInRange = breakDestructiblesInRange;

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
  // Der Bottom-Right-Cooldown-Zahltext (`label`) wird nicht mehr angezeigt: er
  // lag auf Depth 101 UNTER den Fog-Overlays (Depth 900/1000) und blitzte nur
  // auf, wo rechts der Fog aufgeklaert war — sah wie ein Bug aus. Er ist zudem
  // redundant zum gewollten Cooldown-Indikator (Skill-Button-Grauout +
  // Skill-Tiles via updateAbilityStatus), die beide erhalten bleiben.
  const { button = null, onComplete = null, statusKey = null } = options;
  const label = null;
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
  // 060: Die 5 Affix-Buckets (spinAttack/chargeSlash/dashSlash/daggerThrow/
  // shieldBash) sind auf die neuen Skills umgemappt. Die internen statKey-
  // Strings bleiben STABIL (keine Save-Migration/Test-Bruch) — nur Label +
  // Ziel-Skill wechseln:
  //   spinAttack→Wirbelwind, chargeSlash→Hammer, dashSlash→Wirbelsog(cyclone),
  //   daggerThrow→Frostnova, shieldBash→Todesstoss(deathBlow).
  switch (abilityKey) {
    // 5 Bestands-Buckets (statKeys stabil) auf die neuen Skills gemappt:
    case 'spin':           return 'spinAttack';     // (Legacy)
    case 'whirlwind':      return 'spinAttack';     // Wirbelwind
    case 'hammer':         return 'chargeSlash';    // Hammer (recycelt chargeSlash)
    case 'cycloneStrike':  return 'dashSlash';      // Wirbelsog
    case 'frostNova':      return 'daggerThrow';    // Frostnova
    case 'deathBlow':      return 'shieldBash';     // Todesstoss
    // 7 neue Buckets (statKey == abilityId) — Affixe für alle Skills:
    case 'twistingBlades': return 'twistingBlades';
    case 'steelGrasp':     return 'steelGrasp';
    case 'charge':         return 'charge';         // Ansturm (Hammer nutzt jetzt 'hammer')
    case 'teleportDash':   return 'teleportDash';
    case 'heilwunde':      return 'heilwunde';
    case 'frenzy':         return 'frenzy';
    case 'berserk':        return 'berserk';
    default: return null; // 'attack' → nur all_abilities
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
  // #60: Fokus-Zweiteffekt -> globaler Fähigkeitsschaden. Bewusst NICHT auf den
  // Basis-Angriff ('attack'), damit Fokus rein Fähigkeiten skaliert (Staerke
  // deckt den Waffen-/Auto-Schaden ab) und die beiden sich nicht ueberlappen.
  const focusDmg = (abilityKey && abilityKey !== 'attack'
    && typeof window.playerFocusAbilityDmg === 'number') ? window.playerFocusAbilityDmg : 0;
  return perAbility + allAbilities + focusDmg;
}

// WP07 T045: Total cooldown reduction fraction from equipped affixes for a given ability.
// Returns the subtractive fraction (e.g. 0.25 → cooldown shrinks by 25%).
function getLootAbilityCooldownReduction(abilityKey) {
  const suffix = _lootAbilityStatKey(abilityKey);
  const perAbility = suffix ? _getLootBonus('cd_' + suffix) : 0;
  const allAbilities = _getLootBonus('cd_all_abilities');
  // Issue #26 — Knowledge-Tree cdrAll applies to every ability equally.
  // Additive on top of per-ability + global affix reductions. The downstream
  // consumer (applyCooldownModifier) already floors at Math.max(0, 1 - x)
  // and 100ms, so no clamp needed here.
  const ktAll = (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.cdrAll) || 0;
  // #60: Fokus-Attribut (nur von Items) -> globale Cooldown-Reduktion. Cap ist
  // bereits in recalcDerived bei −40 % gedeckelt; applyCooldownModifier floort
  // zusaetzlich bei 100 ms, daher hier kein weiterer Clamp noetig.
  const focusCdr = (typeof window.playerFocusCdr === 'number') ? window.playerFocusCdr : 0;
  return perAbility + allAbilities + ktAll + focusCdr;
}

// Feature 059: Blutpakt-Amulett — Abilities fast ohne Cooldown, kosten dafür LP.
// Zentrale, ENTPRELLTE Kosten-Funktion, damit klassische Abilities
// (applyCooldownModifier) UND AbilitySystem-Abilities (tryActivate) dieselbe
// Logik nutzen und derselbe Aktivierungs-Frame die LP nicht DOPPELT abzieht
// (whirlwind/hammer laufen durch beide Pfade).
var _bloodpactLastCost = 0;
function isBloodpactActive() {
  return !!(window.AmuletEffects && typeof window.AmuletEffects.activeEffect === 'function'
    && window.AmuletEffects.activeEffect() === 'bloodpact');
}
function applyBloodpactCost() {
  if (!isBloodpactActive()) return;
  var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - _bloodpactLastCost < 90) return; // 1x pro Aktivierung (Entprellung)
  _bloodpactLastCost = now;
  var mh = (typeof playerMaxHealth === 'number') ? playerMaxHealth : (window.playerMaxHealth || 30);
  var cost = Math.max(1, Math.round(mh * 0.08));
  if (typeof playerHealth === 'number') {
    playerHealth = Math.max(1, playerHealth - cost); // tötet nie direkt (Floor 1)
    window.playerHealth = playerHealth;
    if (typeof updateHUD === 'function') { try { updateHUD(); } catch (e) {} }
  }
}
if (typeof window !== 'undefined') {
  window.isBloodpactActive = isBloodpactActive;
  window.applyBloodpactCost = applyBloodpactCost;
}

function applyCooldownModifier(base, key) {
  const bonus = getAbilityBonus(key);
  const mult = Math.max(0.2, 1 - (bonus.cooldown || 0));
  // WP07 T045: also apply equipment affix cooldown reduction from LootSystem.
  // cdReductionMul = 1 - cd_<ability> - cd_all_abilities; floor resulting CD at 100ms.
  const lootCdMul = Math.max(0, 1 - getLootAbilityCooldownReduction(key));
  const effective = base * mult * lootCdMul;
  // Feature 059 WP03: Blutpakt (bloodpact) — abilities (NOT the basic attack)
  // have almost no cooldown but cost HP per use. applyCooldownModifier runs once
  // per activation, so the HP cost is deducted here; HP is floored at 1 (the
  // pact never kills you outright).
  if (key && key !== 'attack' && isBloodpactActive()) {
    applyBloodpactCost();
    return Math.max(60, effective * 0.1);
  }
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
const SPIN_RANGE_BASE = 140;
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
  var base = Math.max(0.2, weaponAttackSpeed || 1);
  // === 060 Strang WUT — Raserei (frenzy) ===
  // Stapelbarer Angriffstempo-Buff: window.frenzyState wird von der frenzy-
  // Ability gesetzt und bei Treffern/Kills hochgestapelt (siehe abilitySystem
  // frenzy + _frenzyBump). Defensiv: nie den Loop brechen, Default 1.
  try {
    var fs = (typeof window !== 'undefined') ? window.frenzyState : null;
    if (fs && fs.active) {
      var now = (typeof player !== 'undefined' && player && player.scene && player.scene.time)
        ? player.scene.time.now : Date.now();
      if (now <= (fs.expiry || 0)) {
        base *= (1 + (fs.stacks || 0) * (fs.perStack || 0));
      }
    }
  } catch (e) { /* never break the loop */ }
  return base;
}

function getRangeFromBase(base) {
  return attackRange * (base / DEFAULT_ATTACK_RANGE_BASE);
}

function getMeleeCooldown() {
  // Etwas schwererer Grundangriff: höhere Grund-Abklingzeit + höherer Floor,
  // damit auch bei viel Angriffstempo ein spürbarer Rhythmus bleibt.
  return Math.max(320, 650 / getAttackSpeedMultiplier());
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

// Smoothed velocity state for acceleration/deceleration (D2-style weight).
// weight=0 -> instant setVelocity; weight=1 -> ~180ms time constant.
let _smoothVelX = 0, _smoothVelY = 0;
let _lastTargetDirX = 0, _lastTargetDirY = 0;
let _turnPenaltyUntil = 0;        // timestamp (ms) while turn-cap active
let _attackCommitUntil = 0;       // timestamp (ms) while attack-commit lingers
let _prevIsAttacking = false;     // rising-edge detection for attack commit
const _ATTACK_COMMIT_MS = 420;    // total duration of move-reduction after a swing starts

function _applySmoothedVelocity(targetVx, targetVy, scene) {
  const weight = typeof window.__MOVEMENT_WEIGHT__ === 'number' ? window.__MOVEMENT_WEIGHT__ : 0;
  const now = scene && scene.time ? scene.time.now : (performance.now ? performance.now() : Date.now());

  // Turn penalty: sharp direction change (>120°) briefly caps speed (D2 turn-in-place feel).
  if (weight > 0) {
    const tLen = Math.hypot(targetVx, targetVy);
    const lLen = Math.hypot(_lastTargetDirX, _lastTargetDirY);
    if (tLen > 0 && lLen > 0) {
      const cos = (targetVx * _lastTargetDirX + targetVy * _lastTargetDirY) / (tLen * lLen);
      if (cos < -0.5) { // >120° turn
        _turnPenaltyUntil = now + 100 + weight * 40; // 100–140 ms
      }
    }
    if (tLen > 0) {
      _lastTargetDirX = targetVx / tLen;
      _lastTargetDirY = targetVy / tLen;
    }
    if (now < _turnPenaltyUntil) {
      const cap = 1 - 0.3 * weight; // up to 30% speed reduction during turn
      targetVx *= cap;
      targetVy *= cap;
    }
  }

  if (weight <= 0) {
    _smoothVelX = targetVx;
    _smoothVelY = targetVy;
  } else {
    const dt = (scene && scene.game && scene.game.loop && scene.game.loop.delta) || 16;
    const tau = 40 + weight * 140; // 40 ms (barely) … 180 ms (heavy)
    const k = 1 - Math.exp(-dt / tau);
    _smoothVelX += (targetVx - _smoothVelX) * k;
    _smoothVelY += (targetVy - _smoothVelY) * k;
    if (Math.abs(_smoothVelX) < 1) _smoothVelX = 0;
    if (Math.abs(_smoothVelY) < 1) _smoothVelY = 0;
  }
  player.setVelocity(_smoothVelX, _smoothVelY);
  return [_smoothVelX, _smoothVelY];
}

function handlePlayerMovement() {
  if (isDashing || isRolling) return;

  // Stun check: if stunned, stop all movement (hard-stop — bypass smoothing)
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) {
    _smoothVelX = 0; _smoothVelY = 0;
    player.setVelocity(0, 0);
    updatePlayerSpriteAnimation(player, 0, 0);
    return;
  }

  // Boss-Ranzieh-Fenster (Kettenmeister chainPull/chainReel): solange aktiv, die
  // vom Boss gesetzte Velocity NICHT mit der Spieler-Eingabe überschreiben — sonst
  // wird der Pull-Impuls im selben/nächsten Frame sofort annulliert und der Spieler
  // bewegt sich nicht. Für die kurze Pull-Dauer gleitet er Richtung Boss.
  if (window._pullUntil && Date.now() < window._pullUntil) {
    var _pb = player.body;
    updatePlayerSpriteAnimation(player, _pb ? _pb.velocity.x : 0, _pb ? _pb.velocity.y : 0);
    return;
  }

  // Eingaben sammeln — scheme-aware via InputScheme (arrows in classic,
  // WASD in arpg). `lastMoveDirection` is still updated below; it remains
  // the Classic-scheme aim source AND the ARPG dead-zone fallback for
  // InputScheme.getAimDirection. Do not stop updating it across schemes.
  let vx = 0, vy = 0;
  if (window.InputScheme && typeof window.InputScheme.getMovementInput === 'function') {
    const mv = window.InputScheme.getMovementInput();
    vx = mv.x;
    vy = mv.y;
  } else {
    // Defensive fallback — InputScheme should always be present in this build.
    if (cursors.left.isDown)  vx -= 1;
    if (cursors.right.isDown) vx += 1;
    if (cursors.up.isDown)    vy -= 1;
    if (cursors.down.isDown)  vy += 1;
  }

  // Slow check: reduce speed if slowed
  let effectiveSpeed = playerSpeed;
  if (window.statusEffectManager) {
    effectiveSpeed *= window.statusEffectManager.getSpeedMultiplier(player);
  }
  // Attack commitment: when a swing starts, reduce movement for a fixed window
  // (longer than the swing itself, so the commit actually reads as weight).
  const moveWeight = typeof window.__MOVEMENT_WEIGHT__ === 'number' ? window.__MOVEMENT_WEIGHT__ : 0;
  const nowMs = this && this.time ? this.time.now : (performance.now ? performance.now() : Date.now());
  if (isAttacking && !_prevIsAttacking) {
    _attackCommitUntil = nowMs + _ATTACK_COMMIT_MS;
  }
  _prevIsAttacking = isAttacking;
  if (moveWeight > 0 && nowMs < _attackCommitUntil) {
    effectiveSpeed *= (1 - 0.6 * moveWeight); // up to 60% reduction at max weight
  }

  // Richtung normalisieren -> konstante Geschwindigkeit (auch diagonal)
  let targetVx = 0, targetVy = 0;
  if (vx !== 0 || vy !== 0) {
    const len = Math.hypot(vx, vy);     // 1 bei gerade, ~1.414 diagonal
    targetVx = (vx / len) * effectiveSpeed;
    targetVy = (vy / len) * effectiveSpeed;
    lastMoveDirection.set(targetVx, targetVy).normalize();
  }

  const [actualVx, actualVy] = _applySmoothedVelocity(targetVx, targetVy, this);
  updatePlayerSpriteAnimation(player, actualVx, actualVy);
}

function handleMobileMovement() {
  if (isDashing || isRolling) return;

  // Stun check: hard-stop, bypass smoothing
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) {
    _smoothVelX = 0; _smoothVelY = 0;
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
  // Attack commitment — see keyboard handler for rationale
  const moveWeight = typeof window.__MOVEMENT_WEIGHT__ === 'number' ? window.__MOVEMENT_WEIGHT__ : 0;
  const nowMs = this && this.time ? this.time.now : (performance.now ? performance.now() : Date.now());
  if (isAttacking && !_prevIsAttacking) {
    _attackCommitUntil = nowMs + _ATTACK_COMMIT_MS;
  }
  _prevIsAttacking = isAttacking;
  if (moveWeight > 0 && nowMs < _attackCommitUntil) {
    effectiveSpeed *= (1 - 0.6 * moveWeight);
  }

  // WP03: analog force with dead zone. Force < deadZone → zero velocity,
  // above dead zone → proportional speed up to effectiveSpeed.
  const force = joystick.force;       // 0.0 … 1.0
  const deadZone = typeof window.__MOBILE_DEAD_ZONE__ === 'number'
    ? window.__MOBILE_DEAD_ZONE__ : 0.15;
  let targetVx = 0, targetVy = 0;
  if (force > deadZone) {
    // rex plugin can report force > 1 when the thumb drags beyond the base
    // radius; clamp to prevent runaway speed.
    const analog = Math.min(1, (force - deadZone) / (1 - deadZone));
    const rad = Phaser.Math.DegToRad(joystick.angle);
    targetVx = Math.cos(rad) * effectiveSpeed * analog;
    targetVy = Math.sin(rad) * effectiveSpeed * analog;
    lastMoveDirection.set(Math.cos(rad), Math.sin(rad));
    // Joystick active — cancel any tap-to-move target
    window.__MOBILE_MOVE_TARGET__ = null;
  } else if (window.__MOBILE_MOVE_TARGET__ && player) {
    // Tap-to-move: walk toward target position (D2-style)
    const mt = window.__MOBILE_MOVE_TARGET__;
    const dx = mt.x - player.x;
    const dy = mt.y - player.y;
    const dist = Math.hypot(dx, dy);
    const ARRIVE_THRESHOLD = 8;
    if (dist > ARRIVE_THRESHOLD) {
      targetVx = (dx / dist) * effectiveSpeed;
      targetVy = (dy / dist) * effectiveSpeed;
      lastMoveDirection.set(dx / dist, dy / dist);
    } else {
      // Arrived at target
      window.__MOBILE_MOVE_TARGET__ = null;
    }
  }

  const [actualVx, actualVy] = _applySmoothedVelocity(targetVx, targetVy, this);
  updatePlayerSpriteAnimation(player, actualVx, actualVy);
}

function handlePlayerAttack() {
  // InputScheme.isBasicAttackTriggered fires once per Space press OR per
  // left-mouse-button press (flag set by main.js pointerdown handler). It
  // already gates on shouldSuppressCombatInput, so no local guard needed.
  if (window.InputScheme && typeof window.InputScheme.isBasicAttackTriggered === 'function') {
    if (window.InputScheme.isBasicAttackTriggered()) {
      attack.call(this);
    }
  } else if (Phaser.Input.Keyboard.JustDown(spaceKey)) {
    // Defensive fallback if InputScheme is not loaded.
    attack.call(this);
  }
}

// Resolve the current aim as a normalized Phaser.Math.Vector2.
// In Classic mode this is lastMoveDirection; in ARPG it's the cursor-based
// aim from InputScheme (with dead-zone fallback to last known). Degenerate
// (0,0) input is coerced to (0,1) downward — same fallback the ability
// functions used before this refactor.
function _getAimVector2(scene) {
  let ax = 0, ay = 0;
  if (window.InputScheme && typeof window.InputScheme.getAimDirection === 'function') {
    const aim = window.InputScheme.getAimDirection(scene || null, player);
    ax = aim ? aim.x : 0;
    ay = aim ? aim.y : 0;
  } else {
    ax = lastMoveDirection.x;
    ay = lastMoveDirection.y;
  }
  const v = new Phaser.Math.Vector2(ax, ay);
  if (v.lengthSq() === 0) v.set(0, 1);
  v.normalize();
  return v;
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

  const angle = _getAimVector2(scene).angle();
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

// === 060 Strang WUT — Raserei (frenzy) Stack-Pump ===
// Stapelt den Angriffstempo-Buff, solange er aktiv ist, und frischt das
// Decay-Fenster auf. amount: Stacks pro Ereignis (Treffer=1, Kill=2).
// Defensiv: no-op wenn frenzy nicht aktiv / abgelaufen.
function _frenzyBump(scene, amount) {
  try {
    const fs = (typeof window !== 'undefined') ? window.frenzyState : null;
    if (!fs || !fs.active) return;
    const now = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : Date.now();
    if (now > (fs.expiry || 0)) { fs.stacks = 0; return; } // bereits abgeklungen
    fs.stacks = Math.min(fs.maxStacks || 0, (fs.stacks || 0) + (amount || 1));
    fs.expiry = now + (fs.decayMs || 0);
  } catch (e) { /* never break combat */ }
}

function handleEnemyHit(scene, enemy, options = {}) {
  if (!scene || !enemy) return;
  // Raserei: jeder Treffer stapelt etwas, ein Kill stapelt mehr.
  _frenzyBump(scene, (enemy && enemy.hp <= 0) ? 2 : 1);

  // Lazy hp bar — every enemy gets a small healthbar above its head once it
  // takes its first hit. Bosses + mini-bosses have their own bars (boss UI
  // / drawMiniBossBar) so we skip them. Newly-spawned enemies that haven't
  // been hit show no bar so the room doesn't read as cluttered.
  if (enemy.active && enemy.hp > 0 && !enemy.isMiniBoss && !enemy.isBoss) {
    if (!enemy.hpBar && scene.add && typeof scene.add.graphics === 'function') {
      enemy.hpBar = scene.add.graphics().setDepth(1001);
      if (scene.enemyLayer && typeof scene.enemyLayer.add === 'function') {
        scene.enemyLayer.add(enemy.hpBar);
      }
      enemy.on('destroy', () => {
        try { if (enemy.hpBar) enemy.hpBar.destroy(); } catch (_) {}
      });
    }
    if (enemy.hpBar) drawEnemyHpBar(enemy);
  }

  if (enemy.hp <= 0) {
    // Feature 059 WP03: run-amulet on-kill hook (Schlächterkrone momentum-stack;
    // spaetere Batches: killburst/frost-shatter/tempo-burst). enemy lebt hier
    // noch -> x/y gueltig fuer AoE-Effekte.
    if (window.AmuletEffects && typeof window.AmuletEffects.onEnemyKilled === 'function') {
      try { window.AmuletEffects.onEnemyKilled(enemy, scene); } catch (e) { /* never crash */ }
    }
    // Feature 059 WP03: Aschefunke (killburst) — dying enemy explodes for AoE.
    // Cascades are allowed but bounded by maxDepth (window.__killburstDepth).
    const _kb = (window.AmuletEffects && typeof window.AmuletEffects.killburstParams === 'function')
      ? window.AmuletEffects.killburstParams() : null;
    if (_kb && (window.__killburstDepth || 0) < _kb.maxDepth
        && typeof enemies !== 'undefined' && enemies && enemies.children) {
      window.__killburstDepth = (window.__killburstDepth || 0) + 1;
      try {
        const _ex = enemy.x, _ey = enemy.y;
        const _boom = Math.max(1, Math.round((enemy.maxHp || enemy.hp || 10) * _kb.frac));
        if (scene && scene.add && typeof scene.add.circle === 'function') {
          const _g = scene.add.circle(_ex, _ey, _kb.radius, 0xff7733, 0.35).setDepth(78);
          if (scene.tweens) scene.tweens.add({ targets: _g, alpha: 0, scale: 1.35, duration: 220, onComplete: () => { try { _g.destroy(); } catch (_) {} } });
          else if (scene.time) scene.time.delayedCall(220, () => { try { _g.destroy(); } catch (_) {} });
        }
        const _victims = [];
        enemies.children.iterate((cand) => {
          if (!cand || !cand.active || cand === enemy) return;
          if (Math.hypot((cand.x || 0) - _ex, (cand.y || 0) - _ey) <= _kb.radius) _victims.push(cand);
        });
        _victims.forEach((cand) => {
          if (!cand.active) return;
          if (typeof cand.maxHp !== 'number') cand.maxHp = cand.hp;
          cand.hp -= _boom;
          if (window.particleFactory) window.particleFactory.hitSpark(cand.x, cand.y);
          handleEnemyHit(scene, cand, { tint: 0xff7733, duration: 90 });
        });
      } catch (e) { /* never crash */ }
      window.__killburstDepth = Math.max(0, (window.__killburstDepth || 1) - 1);
    }
    // Feature 059 WP03: Frostsiegel (frost) — a chilled enemy SHATTERS on death,
    // chilling nearby enemies (SLOW).
    const _fp = (window.AmuletEffects && typeof window.AmuletEffects.frostParams === 'function')
      ? window.AmuletEffects.frostParams() : null;
    if (_fp && enemy.__amuletChilled && typeof enemies !== 'undefined' && enemies && enemies.children
        && window.statusEffectManager && window.StatusEffectType) {
      try {
        const _fx = enemy.x, _fy = enemy.y;
        enemies.children.iterate((cand) => {
          if (!cand || !cand.active || cand === enemy) return;
          if (Math.hypot((cand.x || 0) - _fx, (cand.y || 0) - _fy) > _fp.radius) return;
          window.statusEffectManager.applyEffect(cand, window.StatusEffectType.SLOW, 'amuletFrostShatter');
          cand.__amuletChilled = true;
        });
      } catch (e) { /* never crash */ }
    }
    // Issue #24: chance to drop a Druckblatt on kill. Elite enemies have
    // a higher chance. Direct call to PrintingHouse.addDruckblaetter
    // (clamped to the 50-cap inside). Drops nothing visible — counter
    // ticks up in the Druckerei UI summary.
    if (window.PrintingHouse && typeof window.PrintingHouse.addDruckblaetter === 'function') {
      try {
        var dropChance = enemy.isElite ? 0.18 : 0.06;
        if (enemy.isMiniBoss) dropChance = 0.40;
        if (enemy.isBoss) dropChance = 1.00; // bosses always drop
        if (Math.random() < dropChance) {
          window.PrintingHouse.addDruckblaetter(enemy.isBoss ? 3 : (enemy.isMiniBoss ? 2 : 1));
        }
      } catch (_) { /* never crash gameplay */ }
    }
    if (window.soundManager) window.soundManager.playSFX('enemy_death');
    // Particle effects: death burst + screen shake. Bosse bekommen den
    // wuchtigeren bossDeath-Effekt (Wellen + Schockringe + Blitz) statt des
    // normalen Gegner-Bursts, damit ein Boss-Kill sich als Ereignis anfuehlt.
    if (window.particleFactory) {
      if (enemy.isBoss) {
        // Boss-Einfaerbung wie die HP-Leiste (drawBossBar).
        const bossColor = enemy.bossType === 'chainMaster' ? 0xcccccc
          : enemy.bossType === 'ceremonyMaster' ? 0xaa33ff
          : enemy.bossType === 'shadowCouncillor' ? 0xff3322
          : 0xff8844;
        window.particleFactory.bossDeath(enemy.x, enemy.y, bossColor);
      } else {
        window.particleFactory.deathBurst(enemy.x, enemy.y);
        window.particleFactory.screenShake(80, 0.003);
      }
    }
    // Boss besiegt: alle noch lebenden Ads (Beschwoerungen, Klone) mitraeumen —
    // nach dem Boss soll kein Gegner mehr im Raum stehen. Der Boss-Raum ist der
    // Klimax-Finalraum (trash-cleared, event-frei), die einzigen uebrigen Gegner
    // sind also Boss-Beschwoerungen.
    if (enemy.isBoss && typeof enemies !== 'undefined' && enemies && enemies.children) {
      const _boss = enemy;
      enemies.children.iterate((other) => {
        if (!other || other === _boss || !other.active || other.isBoss) return;
        try { other.destroy(); } catch (e) {}
      });
    }
    spawnLoot.call(scene, enemy.x, enemy.y, null, enemy);
    enemy.destroy();
    defeatedEnemiesInWave += 1;
    // Run-summary: count every kill, plus elite/boss subcounts for the modal.
    if (window.runStats) {
      window.runStats.enemiesKilled += 1;
      if (enemy.isBoss) window.runStats.bossesKilled += 1;
      else if (enemy.isElite) window.runStats.elitesKilled += 1;
    }
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
        // Quest-Ziel-IDs je Boss. Die Boss-Leiter (Tiefe 10/20/30) spiegelt die
        // Quest-Leiter: Kettenmeister->Maras Warnung, Zeremonienmeister->Die
        // Ritualkammer, Schattenrat->Rettung oder Beweis.
        // (Fix: 'ceremonyMaster' zeigte per Copy-Paste auf 'kettenmeister' —
        //  der Zeremonienmeister hatte dadurch keine eigene Quest-Identitaet.)
        var bossMapping = {
          'chainMaster': 'kettenmeister',
          'ceremonyMaster': 'zeremonienmeister',
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
  if (isAttacking || attackCooldown || isDashing || isChargingSlash || isRolling) return;
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) return;

  isAttacking = true;

  // Espionage (Feature 055): Angreifen lässt die Verkleidung fallen und treibt
  // den Verdacht hoch (FR-04). No-op außerhalb einer aktiven Espionage-Mission.
  if (window.EspionageSystem && window.EspionageSystem.isActive()) {
    try { window.EspionageSystem.onPlayerAttack(); } catch (e) {}
  }

  // Bow path: spawn an arrow projectile instead of swinging melee. Cooldown
  // path below still runs so attack speed + AoE-on-cooldown UI works.
  if (_hasBowEquipped()) {
    _fireBowArrow(this);
    // Feature 059 WP03: Zwillingsklinge — a second, weaker arrow at a slight angle.
    const _twinFracBow = (window.AmuletEffects && typeof window.AmuletEffects.twinDamageFrac === 'function')
      ? window.AmuletEffects.twinDamageFrac() : 0;
    if (_twinFracBow > 0 && this.time && this.time.delayedCall) {
      this.time.delayedCall(210, () => _fireBowArrow(this, { damageMult: _twinFracBow, angleOffset: 0.18 }));
    }

    this.time.delayedCall(120, () => { isAttacking = false; }, null, this);
    attackCooldown = true;
    const baseCdB = getMeleeCooldown();
    const cdB = applyCooldownModifier(baseCdB, 'attack');
    startCooldownTimer(this, cdB, {
      button: attackBtn,
      label: attackBtnCooldownText,
      statusKey: 'attack',
      onComplete: () => { attackCooldown = false; }
    });
    return;
  }

  if (window.soundManager) window.soundManager.playSFX('attack');

  // Längerer, schwererer Swing-Kegel (Default ist 100ms).
  showAttackEffect(this, { duration: 170 });

  const toEnemy = new Phaser.Math.Vector2();
  // Schadens-Kegel MUSS dieselbe Richtung wie der sichtbare Kegel
  // (showAttackEffect → _getAimVector2) nutzen. In ARPG ist das die Cursor-Aim,
  // nicht lastMoveDirection (Bewegung) — sonst treffen Gegner im sichtbaren
  // Kegel den Schadens-Kegel nicht. In Classic liefert _getAimVector2 die
  // Bewegungsrichtung, Verhalten also unverändert.
  const attackDir = _getAimVector2(this);

  forEachEnemyInRange(attackRange, (enemy, { dx, dy }) => {
    toEnemy.set(dx, dy);
    const distance = toEnemy.length();
    if (distance === 0) return;

    toEnemy.normalize();
    const dot = attackDir.dot(toEnemy); // Cosinus-Wert zwischen -1 und 1
    // Feature 059 WP03: Schnitterband (cleave) — 360°-Rundumschlag statt Kegel.
    const _cleave = window.AmuletEffects && typeof window.AmuletEffects.activeEffect === 'function'
      && window.AmuletEffects.activeEffect() === 'cleave';
    if (!_cleave && dot <= 0.5) return; // ~60° nach vorn (cleave hebt den Kegel auf)

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

  // Espionage: derselbe Schwung trifft auch Wachen (offener Nahkampf) — im
  // vorderen Kegel, -1 hp pro Treffer, hp<=0 -> Wache faellt (Kegel weg).
  if (window.EspionageSystem && window.EspionageSystem.isActive()
      && typeof window.EspionageSystem.attackGuards === 'function') {
    try {
      const _gp = (typeof player !== 'undefined' && player) ? player : this;
      const hitGuards = window.EspionageSystem.attackGuards(_gp.x, _gp.y, attackDir.x, attackDir.y, attackRange + 24);
      if (hitGuards > 0 && window.particleFactory) window.particleFactory.hitSpark(_gp.x + attackDir.x * 40, _gp.y + attackDir.y * 40);
    } catch (e) {}
  }

  // Feature 059 WP03: Zwillingsklinge (twin) — a second, weaker strike (~60%)
  // deliberately ~230ms later (not 90ms) so the follow-up reads as a SEPARATE
  // hit from the amulet, not part of the same swing. Same cone/aim; reuses the
  // normal damage path. No-op without the twin amulet.
  const _twinFrac = (window.AmuletEffects && typeof window.AmuletEffects.twinDamageFrac === 'function')
    ? window.AmuletEffects.twinDamageFrac() : 0;
  if (_twinFrac > 0) {
    const _twinScene = this;
    const _twinDir = _getAimVector2(_twinScene);
    const _twinSecond = () => {
      // Visible "second blade": replay the swing arc in cyan so the double
      // strike reads on screen (the damage tick alone looked like a normal hit
      // -> players reported "no visible effect"). Fires even on a whiff.
      if (typeof showAttackEffect === 'function') {
        showAttackEffect(_twinScene, { color: 0x66ddff, alpha: 0.32, duration: 130 });
      }
      forEachEnemyInRange(attackRange, (enemy, { dx, dy }) => {
        const v = new Phaser.Math.Vector2(dx, dy);
        if (v.length() === 0) return;
        v.normalize();
        if (_twinDir.dot(v) <= 0.5) return;
        dealDamageToEnemy(_twinScene, enemy, _twinFrac, 'attack');
        if (window.particleFactory) window.particleFactory.hitSpark(enemy.x, enemy.y);
        handleEnemyHit(_twinScene, enemy, { useTween: true, duration: 80 });
      }, { requireLineOfSight: true });
    };
    if (_twinScene.time && _twinScene.time.delayedCall) _twinScene.time.delayedCall(230, _twinSecond);
    else _twinSecond();
  }

  // Melee can also break destructible obstacles (chests, barrels, crates) in front of player
  if (obstacles && obstacles.children && typeof window.breakDestructibleObstacle === 'function') {
    const meleeRange = attackRange;
    const aim = _getAimVector2(this);
    const targets = [];
    obstacles.children.iterate(obs => {
      if (!obs || !obs.active || !obs.getData || !obs.getData('destructible')) return;
      const dx = obs.x - player.x;
      const dy = obs.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > meleeRange * meleeRange) return;
      const dist = Math.sqrt(distSq);
      const ndx = dx / dist;
      const ndy = dy / dist;
      const dotO = aim.x * ndx + aim.y * ndy;
      if (dotO <= 0.5) return;
      // LOS gate: don't break crates/barrels through closed doors or walls.
      // Uses the cached fog-of-war vision polygon (raycast-derived). Fails
      // open if the polygon isn't ready yet so combat never softlocks.
      if (!hasLineOfSightToTarget(obs)) return;
      targets.push(obs);
    });
    targets.forEach(t => window.breakDestructibleObstacle(this, t));
  }

  // Effekt + Angriff abschliessen. Längeres Swing-Fenster = schwererer Angriff
  // (der Charakter ist länger im Schlag gebunden, bevor der nächste startet).
  this.time.delayedCall(300, () => {
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
  // Gating passiert in AbilitySystem.tryActivate (prüft die GELERNTE Ability,
  // z.B. 'whirlwind'). Kein interner _abilityGate('spinAttack') mehr — die alte
  // ID wird nie gelernt, das würde whirlwind tot-gaten (060).
  const now = (typeof window.gameNow === 'function') ? window.gameNow(this) : this.time.now;
  const baseCooldown = getSpinCooldown();
  const abilityCooldown = applyCooldownModifier(baseCooldown, 'spin');
  if (isSpinning || now - lastSpinTime < abilityCooldown || isChargingSlash || isDashing || isRolling) return;

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
  breakDestructiblesInRange(spinScene, range);
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
  if (chargeSlashCooldown || isChargingSlash || isSpinning || isDashing || isRolling) return;

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

// Hammer der Ahnen — Einschlag-FX: Impact-Flash, expandierender Shockwave-Ring,
// radiale Bodenrisse, Staub-Puffs, Screenshake (skaliert mit Ladung).
function _hammerSlamFx(scene, x, y, radius, charge) {
  try {
    const GOLD = 0xffcf6a, BRONZE = 0xb8862f, WHITE = 0xffffff;
    const T = scene.tweens;
    const kill = (o, dur) => { if (scene.time) scene.time.delayedCall(dur, () => { try { o.destroy(); } catch (e) {} }); };
    const flash = scene.add.circle(x, y, 26 + charge * 22, WHITE, 0.9).setDepth(71);
    if (T) T.add({ targets: flash, scale: 2.4, alpha: 0, duration: 200, onComplete: () => { try { flash.destroy(); } catch (e) {} } }); else kill(flash, 200);
    const ring = scene.add.graphics().setDepth(70);
    ring.lineStyle(5, GOLD, 0.95); ring.strokeCircle(0, 0, radius); ring.setPosition(x, y).setScale(0.15);
    if (T) T.add({ targets: ring, scale: 1, alpha: 0, duration: 300, ease: 'Cubic.Out', onComplete: () => { try { ring.destroy(); } catch (e) {} } }); else kill(ring, 300);
    const cracks = scene.add.graphics().setDepth(40);
    cracks.lineStyle(3, BRONZE, 0.8);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 2) * 0.22;
      const r2 = radius * (0.7 + (i % 3) * 0.1);
      const jx = x + Math.cos(a + 0.35) * r2 * 0.55, jy = y + Math.sin(a + 0.35) * r2 * 0.55;
      cracks.lineBetween(x, y, jx, jy);
      cracks.lineBetween(jx, jy, x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    }
    if (T) T.add({ targets: cracks, alpha: 0, duration: 550, onComplete: () => { try { cracks.destroy(); } catch (e) {} } }); else kill(cracks, 550);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, dist = radius * (0.3 + Math.random() * 0.5);
      const dust = scene.add.circle(x + Math.cos(a) * dist, y + Math.sin(a) * dist, 8 + Math.random() * 8, BRONZE, 0.3).setDepth(41);
      if (T) T.add({ targets: dust, scale: 2, alpha: 0, duration: 400 + Math.random() * 200, onComplete: () => { try { dust.destroy(); } catch (e) {} } }); else kill(dust, 700);
    }
    if (window.particleFactory) { try { window.particleFactory.hitSpark(x, y); } catch (e) {} }
    if (scene.cameras && scene.cameras.main) { try { scene.cameras.main.shake(130, 0.004 + charge * 0.004); } catch (e) {} }
    if (window.soundManager) { try { window.soundManager.playSFX('ability_spin'); } catch (e) {} }
  } catch (e) { /* visual only */ }
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
  const damageMultiplier = 1.4 + chargeRatio * 1.8;
  const knockback = 180 + chargeRatio * 220;

  const forward = _getAimVector2(scene);
  if (forward.lengthSq() === 0) {
    forward.set(0, 1);
  }
  forward.normalize();

  // Hammer der Ahnen: AOE-EINSCHLAG leicht vor dem Spieler (statt Schwerthieb-
  // Kegel). Flächen-Druckwelle, radialer Knockback vom Einschlagpunkt.
  const impactDist = range * 0.35;
  const ix = player.x + forward.x * impactDist;
  const iy = player.y + forward.y * impactDist;
  const slamRadius = range * 0.78;
  _hammerSlamFx(scene, ix, iy, slamRadius, chargeRatio);

  // Tödlicher Stoß (Lethal Thrust): +25% crit chance
  let _savedCritChance;
  if (typeof window.hasSkill === 'function' && window.hasSkill('combat_lethal_thrust')) {
    _savedCritChance = playerCritChance;
    playerCritChance = Math.min(1, (playerCritChance || 0) + 0.25);
  }

  const hits = new Set();
  forEachEnemyInRange(impactDist + slamRadius, (enemy) => {
    if (!enemy || !enemy.active || hits.has(enemy)) return;
    const ddx = enemy.x - ix, ddy = enemy.y - iy;
    const d = Math.hypot(ddx, ddy);
    if (d > slamRadius) return;                       // nur im Einschlagradius
    hits.add(enemy);
    const { isCrit } = dealDamageToEnemy(scene, enemy, damageMultiplier, 'hammer');
    handleEnemyHit(scene, enemy, { tint: isCrit ? 0xfff2a6 : 0xffcf6a, duration: isCrit ? 200 : 150 });
    if (window.statusEffectManager && window.StatusEffectType && enemy.active) {
      window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.BLEED, 'hammer');
    }
    if (enemy.body) {
      const nl = Math.max(1, d);
      enemy.body.setVelocity((ddx / nl) * knockback, (ddy / nl) * knockback);
      scene.time.delayedCall(150, () => { if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0); });
    }
  }, { requireLineOfSight: false });

  // Props im Einschlagradius zerschlagen (Zentrum = Einschlag, NICHT Spieler).
  breakDestructiblesInRange(scene, slamRadius, { cx: ix, cy: iy });

  if (_savedCritChance !== undefined) {
    playerCritChance = _savedCritChance;
  }

  isAttacking = true;
  scene.time.delayedCall(220, () => {
    isAttacking = false;
  });

  chargeSlashCooldown = true;
  const baseCooldown = getChargedSlashCooldown();
  const finalCooldown = applyCooldownModifier(baseCooldown, 'hammer');
  // 060: Cooldown auch der Loadout-HUD melden (Hammer hat kein def.cooldownMs,
  // verwaltet seinen CD intern -> sonst zeigt die HUD keinen Cooldown an).
  if (window.AbilitySystem && window.AbilitySystem.setCooldown) {
    const _hnow = (typeof window.gameNow === 'function') ? window.gameNow(scene) : scene.time.now;
    try { window.AbilitySystem.setCooldown('hammer', finalCooldown, _hnow); } catch (e) {}
  }
  startCooldownTimer(scene, finalCooldown, {
    button: chargeSlashBtn,
    label: chargeSlashCooldownText,
    statusKey: 'charge',
    onComplete: () => {
      chargeSlashCooldown = false;
    }
  });
}

// 054 WP02 + WP03: Dodge-Roll execution.
//
// WP02: Movement via Phaser velocity for `RollConfig.duration` ms in current
// movement direction (or cached lastMoveDir for stillstand-roll, FR-02).
// Speed = distance / duration ≈ 450 px/s — fast enough that wall-collisions
// stop the roll cleanly, slow enough that Phaser arcade-physics handles them
// without manual tunneling-detection (unlike dashSlash at ~1000 px/s).
//
// WP03: i-Frames via window._playerInvincible flag set true for the duration.
// applyPlayerDamage (enemy.js:1649) already respects the flag — zero
// damage-system refactor needed. DoT-ticks (C-06) + Brute-Stun (C-07) bypass
// the flag intentionally (research §4 documented exceptions).
//
// Mutation order:
//   1. Read movement input, update lastMoveDir
//   2. Set isRolling, rollCooldown, _playerInvincible
//   3. setVelocity for full Roll-speed in direction
//   4. delayedCall(duration) → reset isRolling + _playerInvincible
//   5. delayedCall(cooldown) → reset rollCooldown

// ── Feature 059 (#42) WP03 Batch 3b: per-frame amulet effects ───────────────
// orbit (Trabantenstein): rotierende Klingen, die Gegner bei Kontakt treffen.
// aura  (Brandmal):       getakteter Flächen-DoT um den Spieler.
// dashstrike (Schattenmantel): Roll fügt durchquerten Gegnern Schaden zu
//   (Phasing + Unverwundbarkeit liefert performRoll bereits).
// Gated auf den equippten Effekt; ohne passendes Amulett komplett no-op.
// Aufgerufen aus dem GameScene-update()-Loop (main.js).
var _orbitState = { sprites: [], angle: 0, hits: (typeof WeakMap !== 'undefined' ? new WeakMap() : null) };
var _auraTimer = 0;
var _dashstrikeHits = (typeof WeakMap !== 'undefined' ? new WeakMap() : null);

function _destroyOrbitals() {
  for (var i = 0; i < _orbitState.sprites.length; i++) {
    try { if (_orbitState.sprites[i]) _orbitState.sprites[i].destroy(); } catch (_) {}
  }
  _orbitState.sprites = [];
}

// Tags Gegner-HP runter + Standard-Trefferbehandlung (Tint/Tod/Kaskaden).
function _amuletTickDamage(scene, en, dmg, tint, now, store) {
  if (!en || !en.active || en.hp == null) return;
  if (store) {
    var last = store.get(en) || 0;
    if (now - last <= 300) return;     // pro Gegner gedrosselt
    store.set(en, now);
  }
  if (typeof en.maxHp !== 'number') en.maxHp = en.hp;
  en.hp -= dmg;
  try { if (window.particleFactory && window.particleFactory.hitSpark) window.particleFactory.hitSpark(en.x, en.y); } catch (_) {}
  try { handleEnemyHit(scene, en, { tint: tint, duration: 60 }); } catch (_) {}
}

function updateAmuletPerFrame(scene, delta) {
  if (!scene || typeof player === 'undefined' || !player || !player.active) { _destroyOrbitals(); return; }
  var eff = (window.AmuletEffects && window.AmuletEffects.activeEffect) ? window.AmuletEffects.activeEffect() : null;
  var dt = (typeof delta === 'number' && delta > 0) ? delta : 16;
  var now = (scene.time && typeof scene.time.now === 'number') ? scene.time.now : (typeof performance !== 'undefined' ? performance.now() : 0);
  var enemyGroup = (typeof enemies !== 'undefined') ? enemies : null;
  var dmgBase = (typeof weaponDamage === 'number' ? weaponDamage : 5);

  // ORBIT ───────────────────────────────────────────────────────────────
  if (eff === 'orbit') {
    // tote/zerstörte Sprites (z.B. nach Raumwechsel) aussortieren + nachfüllen
    _orbitState.sprites = _orbitState.sprites.filter(function (s) { return s && s.active && s.scene; });
    while (_orbitState.sprites.length < 3 && scene.add && scene.add.circle) {
      var blade = scene.add.circle(player.x, player.y, 9, 0x88ddff, 0.9).setDepth(72);
      if (blade.setStrokeStyle) blade.setStrokeStyle(2, 0xffffff, 0.8);
      _orbitState.sprites.push(blade);
    }
    _orbitState.angle += dt * 0.005;
    var R = 72, n = _orbitState.sprites.length;
    for (var i = 0; i < n; i++) {
      var a = _orbitState.angle + (i * 2 * Math.PI / n);
      var sp = _orbitState.sprites[i];
      if (sp && sp.setPosition) sp.setPosition(player.x + Math.cos(a) * R, player.y + Math.sin(a) * R);
    }
    if (enemyGroup && enemyGroup.children) {
      var odmg = Math.max(1, Math.round(dmgBase * 0.4));
      enemyGroup.children.iterate(function (en) {
        if (!en || !en.active) return;
        for (var j = 0; j < _orbitState.sprites.length; j++) {
          var s2 = _orbitState.sprites[j];
          if (s2 && Math.hypot(en.x - s2.x, en.y - s2.y) < 26) {
            _amuletTickDamage(scene, en, odmg, 0x88ddff, now, _orbitState.hits);
            break;
          }
        }
      });
    }
  } else if (_orbitState.sprites.length) {
    _destroyOrbitals();
  }

  // AURA ──────────────────────────────────────────────────────────────────
  if (eff === 'aura') {
    _auraTimer += dt;
    if (_auraTimer >= 500) {
      _auraTimer = 0;
      var R2 = 110, admg = Math.max(1, Math.round(dmgBase * 0.5));
      if (scene.add && scene.add.circle) {
        var pulse = scene.add.circle(player.x, player.y, R2, 0xff5522, 0.12).setDepth(40);
        if (scene.tweens) scene.tweens.add({ targets: pulse, alpha: 0, scale: 1.1, duration: 400, onComplete: function () { try { pulse.destroy(); } catch (_) {} } });
        else if (scene.time) scene.time.delayedCall(400, function () { try { pulse.destroy(); } catch (_) {} });
      }
      if (enemyGroup && enemyGroup.children) {
        enemyGroup.children.iterate(function (en) {
          if (!en || !en.active) return;
          if (Math.hypot(en.x - player.x, en.y - player.y) <= R2) _amuletTickDamage(scene, en, admg, 0xff5522, now, null);
        });
      }
    }
  } else {
    _auraTimer = 0;
  }

  // DASHSTRIKE ──────────────────────────────────────────────────────────────
  if (eff === 'dashstrike' && typeof isRolling !== 'undefined' && isRolling && enemyGroup && enemyGroup.children) {
    var ddmg = Math.max(1, Math.round(dmgBase * 0.8));
    enemyGroup.children.iterate(function (en) {
      if (!en || !en.active) return;
      if (Math.hypot(en.x - player.x, en.y - player.y) <= 36) _amuletTickDamage(scene, en, ddmg, 0xaa66ff, now, _dashstrikeHits);
    });
  }

  // (Berserker-Tint wird in updatePlayerSpriteAnimation via _playerOverlayTint
  // gesetzt — sonst überschreibt das Richtungs-Sprite den Tint jeden Frame.)

  // FRENZY-Aura ───────────────────────────────────────────────────────────
  // Solange der Raserei-Buff läuft, regelmäßig orange Speed-Motes um den
  // Spieler — laufendes Feedback zusätzlich zum Aktivierungs-Burst (_frenzyFx).
  var fsr = window.frenzyState;
  var frenzyActive = !!(fsr && fsr.active && (typeof fsr.expiry !== 'number' || now < fsr.expiry));
  if (frenzyActive) {
    // Pulsierender Aura-Ring um den Spieler für die GANZE Buff-Dauer (damit der
    // Effekt sichtbar bleibt, nicht nur der kurze Aktivierungs-Burst).
    if (!window._frenzyAura || !window._frenzyAura.scene) {
      try { window._frenzyAura = scene.add.graphics().setDepth(38); } catch (e) { window._frenzyAura = null; }
    }
    if (window._frenzyAura) {
      var pulse = 1 + 0.12 * Math.sin(now / 90);
      window._frenzyAura.clear();
      window._frenzyAura.lineStyle(3, 0xff5a1a, 0.6);
      window._frenzyAura.strokeCircle(player.x, player.y, 34 * pulse);
      window._frenzyAura.lineStyle(2, 0xffb14a, 0.4);
      window._frenzyAura.strokeCircle(player.x, player.y, 26 * pulse);
    }
    if (window.particleFactory) {
      window._frenzyMoteT = (window._frenzyMoteT || 0) + dt;
      if (window._frenzyMoteT >= 75) {
        window._frenzyMoteT = 0;
        try { window.particleFactory.abilityTrail(player.x + (Math.random() - 0.5) * 26, player.y + (Math.random() - 0.5) * 26, 0xff7a1a); } catch (e) {}
      }
    }
  } else {
    window._frenzyMoteT = 0;
    if (window._frenzyAura) { try { window._frenzyAura.destroy(); } catch (e) {} window._frenzyAura = null; }
  }
}
if (typeof window !== 'undefined') window.updateAmuletPerFrame = updateAmuletPerFrame;

// Treppenrolle (bei Mara gekauft): teleportiert den Spieler zur NÄCHSTEN Treppe
// im aktuellen Raum. Reines Repositionieren — die Treppe bleibt bis Raum-Clear
// gesperrt (kein Descend-Skip). Gibt true zurück, wenn teleportiert wurde; bei
// false (keine Treppe / kein Raum) verbraucht der Aufrufer die Rolle NICHT.
function useStairScroll(scene) {
  try {
    if (!scene || !player || !player.active) return false;
    const grp = scene.stairsGroup;
    if (!grp || typeof grp.getChildren !== 'function') return false;
    const stairs = grp.getChildren().filter(function (s) { return s && s.active; });
    if (!stairs.length) return false;
    let best = null, bestD = Infinity;
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      const d = Math.hypot(s.x - player.x, s.y - player.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) return false;
    const tx = best.x, ty = best.y + 10;
    _stairScrollPoof(scene, player.x, player.y);
    player.setPosition(tx, ty);
    if (player.body && typeof player.body.reset === 'function') player.body.reset(tx, ty);
    _stairScrollPoof(scene, tx, ty);
    if (scene.cameras && scene.cameras.main) scene.cameras.main.flash(120, 120, 200, 255);
    if (window.soundManager) { try { window.soundManager.playSFX('ability_spin'); } catch (e) {} }
    return true;
  } catch (e) { return false; }
}
function _stairScrollPoof(scene, x, y) {
  try {
    if (!scene || !scene.add) return;
    const g = scene.add.graphics().setDepth(120);
    g.fillStyle(0x66ccff, 0.5); g.fillCircle(0, 0, 26);
    g.lineStyle(2, 0xaaddff, 0.9); g.strokeCircle(0, 0, 26);
    g.setPosition(x, y);
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 260, onComplete: function () { try { g.destroy(); } catch (_) {} } });
    else if (scene.time) scene.time.delayedCall(260, function () { try { g.destroy(); } catch (_) {} });
  } catch (e) {}
}
if (typeof window !== 'undefined') window.useStairScroll = useStairScroll;

function performRoll() {
  // Gate: kein Roll während anderer Action, Cooldown, oder Tod
  if (!this || !player || !player.active) return false;
  if (isRolling || rollCooldown || playerHealth <= 0) return false;
  if (isDashing || isAttacking || isChargingSlash) return false;
  if (window.statusEffectManager && window.statusEffectManager.isStunned(player)) return false;
  // 054 WP07: Block roll während offenem NPC-Dialog/Workshop/Loadout-Overlay
  // (HubScene-Pattern). Inventory wird bereits in InputScheme.isRollTriggered
  // über window.invOpen geblockt.
  if (this._dialogOpen) return false;

  // Zentrale Config (FR-11 Knowledge-Tree-Hook): später via Buff-Registry tweakbar
  const cfg = window.RollConfig || { distance: 90, duration: 200, cooldown: 600 };
  const distance = cfg.distance;
  const duration = cfg.duration;
  const cooldown = cfg.cooldown;

  // Direction-Resolution: 4-stufiger Fallback
  //   1) Keyboard-Input (Desktop) via InputScheme.getMovementInput
  //   2) Mobile-Joystick (wenn gerade gehalten)
  //   3) lastMoveDirection (Phaser Vector2, von beiden Schemes upgedatet —
  //      kanonische "Blickrichtung" der Player-Abilities)
  //   4) lastMoveDir cache → default "nach unten"
  // Auf Mobile war Stufe 1 immer 0 (nur Keys), Stufe 3 fehlte — daher rollte
  // der Player immer in die Default-Richtung (0,1) = nach unten.
  let dx = 0, dy = 0;
  if (window.InputScheme && typeof window.InputScheme.getMovementInput === 'function') {
    const mv = window.InputScheme.getMovementInput();
    if (mv && (mv.x !== 0 || mv.y !== 0)) {
      const mag = Math.hypot(mv.x, mv.y);
      if (mag > 0.0001) {
        dx = mv.x / mag;
        dy = mv.y / mag;
      }
    }
  }
  if (dx === 0 && dy === 0 && typeof joystick !== 'undefined' && joystick && typeof joystick.force === 'number' && joystick.force > 0.15) {
    const rad = Phaser.Math.DegToRad(joystick.angle);
    dx = Math.cos(rad);
    dy = Math.sin(rad);
  }
  if (dx === 0 && dy === 0 && lastMoveDirection && (lastMoveDirection.x !== 0 || lastMoveDirection.y !== 0)) {
    const mag = Math.hypot(lastMoveDirection.x, lastMoveDirection.y);
    if (mag > 0.0001) {
      dx = lastMoveDirection.x / mag;
      dy = lastMoveDirection.y / mag;
    }
  }
  if (dx === 0 && dy === 0) {
    dx = lastMoveDir.x || 0;
    dy = lastMoveDir.y || 1;
  }
  // Cache für nächsten Stillstand-Roll
  lastMoveDir = { x: dx, y: dy };

  isRolling = true;
  rollCooldown = true;
  rollCooldownStartTime = (this?.time?.now) || performance.now();
  window._playerInvincible = true;

  // 054 WP07 R-04: Mobile Tap-to-Move darf nach Roll-End nicht mehr
  // ziehen — sonst läuft der Player zurück zur Pre-Roll-Target-Position.
  if (window.__MOBILE_MOVE_TARGET__) window.__MOBILE_MOVE_TARGET__ = null;

  const speedPxPerSec = distance / (duration / 1000);
  // setMaxVelocity raised damit roll-speed nicht von normalem clamp gestoppt wird
  if (player.body) player.body.setMaxVelocity(speedPxPerSec, speedPxPerSec);
  if (player.setVelocity) player.setVelocity(dx * speedPxPerSec, dy * speedPxPerSec);
  // 054 WP07 R-05: _smoothVelX/Y muss schon HIER auf die Roll-Velocity
  // gesetzt werden, damit der Reset im Roll-End-Callback nicht von einem
  // veralteten Pre-Roll-Wert weglerpt.
  _smoothVelX = dx * speedPxPerSec;
  _smoothVelY = dy * speedPxPerSec;

  const scene = this;

  // WP04: Visual Choreography — Walk-Anim-Boost (timeScale 3) + Squash (yoyo
  // scaleY 1.0 → 0.7 → 1.0) + Purple Tint. Während des Rolls läuft kein
  // handlePlayerMovement (siehe gate oben), daher kein applyPlayerDisplay-
  // Settings-Overwrite — tween hat freie Bahn.
  const preRollScaleY = player.scaleY || 1;
  const preRollAnimTimeScale = (player.anims && player.anims.timeScale) || 1;
  const rollDir = getDirectionFromVelocity(dx, dy);
  const rollAnimKey = `walk_${rollDir}`;
  if (scene.anims && scene.anims.exists(rollAnimKey)) {
    player.anims.play(rollAnimKey, true);
    if (player.anims) player.anims.timeScale = 3;
    const animState = player.getData('animState') || {};
    animState.playing = rollAnimKey;
    animState.direction = rollDir;
    player.setData('animState', animState);
  }
  if (player.setTint) player.setTint(0x8844cc);
  const squashTween = scene.tweens.add({
    targets: player,
    scaleY: preRollScaleY * 0.7,
    duration: duration / 2,
    yoyo: true,
    ease: 'Sine.easeInOut'
  });

  scene.time.delayedCall(duration, () => {
    isRolling = false;
    window._playerInvincible = false;
    // MaxVelocity zurück auf normalen Player-Clamp (220 ist der base)
    if (player && player.body) player.body.setMaxVelocity(220, 220);
    // WP04: Visuals restoren
    if (squashTween && squashTween.isPlaying && squashTween.isPlaying()) {
      squashTween.stop();
    }
    if (player) {
      player.scaleY = preRollScaleY;
      if (player.anims) player.anims.timeScale = preRollAnimTimeScale;
      if (player.setTint) player.setTint(PLAYER_TINT_COLOR);
    }
    // 054 WP07 R-05: _smoothVelX/Y zurück auf 0 — sonst lerpt
    // handlePlayerMovement im nächsten Frame von der hohen Roll-Velocity
    // weg und der Player gleitet ungewollt weiter ("ghost slide").
    _smoothVelX = 0;
    _smoothVelY = 0;
    // 054 WP07 Edge-Case: wenn Roll in eine Wand gelaufen ist, körperliche
    // Velocity sauber stoppen (Phaser collide setzt nur die kollidierende
    // Achse zurück, die andere kann persistieren).
    if (player && player.body) {
      const blocked = player.body.blocked || {};
      if (blocked.left || blocked.right || blocked.up || blocked.down) {
        player.setVelocity(0, 0);
      }
    }
    // Velocity NICHT generell auf 0 setzen — handlePlayerMovement übernimmt
    // sofort wieder basierend auf aktuellem Input; ein erzwungenes Stop
    // würde sich klobig anfühlen wenn der Spieler bereits weiter rennt.
  }, null, scene);
  scene.time.delayedCall(cooldown, () => {
    rollCooldown = false;
  }, null, scene);

  return true;
}

function dashSlash() {
  if (!this || !player) return;
  if (dashSlashCooldown || isDashing || isSpinning || isChargingSlash || isRolling) return;

  const scene = this;
  const baseCooldown = getDashSlashCooldown();
  const finalCooldown = applyCooldownModifier(baseCooldown, 'dash');
  const dashDir = _getAimVector2(scene);

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

  // Track previous position to detect wall crossings (Issue #21).
  // High dash velocity (~1000 px/s) can tunnel through static obstacle bodies
  // before the physics collider resolves; we manually raycast each tick.
  let prevDashX = player.x;
  let prevDashY = player.y;

  // Returns true if the segment from (fromX,fromY)->(toX,toY) crosses a wall
  // (obstacle group rectangle or closed door). Mirrors hasLineOfSightToEnemy
  // but operates on arbitrary points instead of two sprites.
  const dashCrossedWall = (fromX, fromY, toX, toY) => {
    const line = new Phaser.Geom.Line(fromX, fromY, toX, toY);
    if (obstacles && obstacles.children) {
      let blocked = false;
      obstacles.children.iterate((o) => {
        if (blocked || !o) return;
        if (o.getData && o.getData('walkthrough')) return;
        if (Phaser.Geom.Intersects.LineToRectangle(line, o.getBounds())) blocked = true;
      });
      if (blocked) return true;
    }
    if (scene && scene._doorGroup) {
      let blocked = false;
      scene._doorGroup.children.iterate((door) => {
        if (blocked || !door || !door.active) return;
        if (door.getData && door.getData('walkthrough')) return;
        if (Phaser.Geom.Intersects.LineToRectangle(line, door.getBounds())) blocked = true;
      });
      if (blocked) return true;
    }
    return false;
  };

  const stopDashAtWall = () => {
    if (!isDashing) return;
    if (player && player.active) {
      // Snap back to the last known safe position to undo any tunneling that
      // happened during this physics step.
      player.x = prevDashX;
      player.y = prevDashY;
      if (player.setVelocity) player.setVelocity(0, 0);
      if (player.body) player.body.setMaxVelocity(220, 220);
      if (player.clearTint) player.clearTint();
    }
    isDashing = false;
  };

  const applyDashDamage = () => {
    breakDestructiblesInRange(scene, dashRange);
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
      if (!isDashing || !player || !player.active) return;
      // Issue #21: abort the dash if we crossed a wall since the last tick.
      if (dashCrossedWall(prevDashX, prevDashY, player.x, player.y)) {
        stopDashAtWall();
        return;
      }
      prevDashX = player.x;
      prevDashY = player.y;
      applyDashDamage();
      if (window.particleFactory) {
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

// ============================================================
// === 060 Strang SCHATTEN — Helper-Funktionen ===
// Saubere, selbstständige Helfer für die vier neuen SkillTree-
// Abilities (charge / teleportDash / heilwunde / deathBlow).
// Alle SkillTree-Aufrufe sind DEFENSIV (fehlt die Funktion → mult 1).
// ============================================================

// Liest die echten Gegner-HP-Felder defensiv aus.
// Reihenfolge: enemy.hp / enemy.maxHp (Standard-Felder, siehe enemy.js:1506,
// eliteEnemies.js:234). maxHealth nur als Fallback.
function _shadowEnemyHp(enemy) {
  if (!enemy) return { hp: 0, max: 1 };
  var hp = (typeof enemy.hp === 'number') ? enemy.hp : 0;
  var max = (typeof enemy.maxHp === 'number') ? enemy.maxHp
          : (typeof enemy.maxHealth === 'number') ? enemy.maxHealth
          : (hp > 0 ? hp : 1);
  return { hp: hp, max: Math.max(1, max) };
}

function _shadowDmgMult(nodeId) {
  return (window.SkillTree && typeof window.SkillTree.getAbilityDamageMult === 'function')
    ? (window.SkillTree.getAbilityDamageMult(nodeId) || 1) : 1;
}
function _shadowCdMult(nodeId) {
  return (window.SkillTree && typeof window.SkillTree.getAbilityCooldownMult === 'function')
    ? (window.SkillTree.getAbilityCooldownMult(nodeId) || 1) : 1;
}
function _shadowRank(nodeId) {
  return (window.SkillTree && typeof window.SkillTree.getRank === 'function')
    ? (window.SkillTree.getRank(nodeId) || 1) : 1;
}
function _shadowSynergy(nodeId, stat) {
  return (window.SkillTree && typeof window.SkillTree.getSynergyValue === 'function')
    ? (window.SkillTree.getSynergyValue(nodeId, stat) || 0) : 0;
}

// charge — LINIEN-Sturm: dasht eine Strecke in Blickrichtung und trifft +
// knockt ALLE Gegner entlang des Pfades (nicht nur das erste Ziel wie dashSlash).
function shadowCharge() {
  var scene = this;
  if (!scene || !player || !player.active) return;
  if (isDashing || isSpinning || isChargingSlash || isRolling) return;

  var dmgMult = _shadowDmgMult('charge');
  var dashDir = _getAimVector2(scene);
  isDashing = true;
  if (window.soundManager) try { window.soundManager.playSFX('ability_dash'); } catch (e) {}

  var dashDistance = (typeof getDashSlashDistance === 'function') ? getDashSlashDistance() : 220;
  var dashDuration = (typeof getDashSlashDuration === 'function') ? getDashSlashDuration() : 220;
  // Linien-Sturm: trifft Gegner seitlich der Dash-Linie. Bewusst schmal (früher
  // 70 -> 45 -> 34), damit der Ansturm keine übergroße AoE-Schneise mehr schlägt.
  var lineRadius = 34;
  var knockback = 190;
  var dashSpeed = dashDistance / (dashDuration / 1000);

  if (player.setTint) player.setTint(0x66ccff);
  if (player.body) player.body.setMaxVelocity(dashSpeed, dashSpeed);
  if (player.setVelocity) player.setVelocity(dashDir.x * dashSpeed, dashDir.y * dashSpeed);

  var chargeHits = new Set();
  var tmp = new Phaser.Math.Vector2();

  // Trifft jeden Gegner, dessen Position nahe an der Bewegungslinie (Strahl in
  // dashDir ab Spielerposition) liegt. forEachEnemyInRange liefert dx/dy.
  var applyLineDamage = function () {
    // Zentrum = Spieler, aber nur der Nahbereich: die Vorfilter-Reichweite
    // (dashDistance + lineRadius) deckt die ganze Bahn ab — Props laengs der
    // Bahn zerbrechen ohnehin, waehrend der Spieler sie entlangfaehrt.
    breakDestructiblesInRange(scene, lineRadius);
    forEachEnemyInRange(dashDistance + lineRadius, function (enemy, info) {
      if (chargeHits.has(enemy)) return;
      // Projektion auf die Dash-Richtung; nur Gegner VOR dem Spieler (proj>=0)
      var proj = info.dx * dashDir.x + info.dy * dashDir.y;
      if (proj < -lineRadius) return;
      // Senkrechter Abstand zur Linie
      var perpX = info.dx - dashDir.x * proj;
      var perpY = info.dy - dashDir.y * proj;
      var perp = Math.hypot(perpX, perpY);
      if (perp > lineRadius) return;
      if (proj > dashDistance + lineRadius) return;

      chargeHits.add(enemy);
      var res = dealDamageToEnemy(scene, enemy, 0.8 * dmgMult, 'charge');
      handleEnemyHit(scene, enemy, {
        tint: res && res.isCrit ? 0xfff2a6 : 0x66ccff,
        duration: res && res.isCrit ? 180 : 120
      });
      // Knockt ALLE getroffenen Gegner in Dash-Richtung weg.
      if (enemy && enemy.active && enemy.body) {
        tmp.set(dashDir.x, dashDir.y);
        enemy.body.setVelocity(tmp.x * knockback, tmp.y * knockback);
        scene.time.delayedCall(140, function () {
          if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
        });
      }
    }, { requireLineOfSight: false });
  };

  applyLineDamage();
  if (window.particleFactory && player) {
    try { window.particleFactory.abilityTrail(player.x, player.y, 0x66ccff); } catch (e) {}
  }
  var tick = 40;
  var repeat = Math.max(0, Math.floor(dashDuration / tick) - 1);
  for (var i = 1; i <= repeat; i++) {
    scene.time.delayedCall(i * tick, function () {
      if (!isDashing || !player || !player.active) return;
      applyLineDamage();
      if (window.particleFactory) {
        try { window.particleFactory.abilityTrail(player.x, player.y, 0x66ccff); } catch (e) {}
      }
    });
  }

  scene.time.delayedCall(dashDuration, function () {
    if (player && player.active) {
      player.setVelocity(0, 0);
      if (player.body) player.body.setMaxVelocity(220, 220);
      if (player.clearTint) player.clearTint();
    }
    isDashing = false;
  });
}

// Blink-Poof für Schattenschritt: 'out' implodiert (Vanish), 'in' explodiert
// (Appear). Macht den Teleport optisch klar verschieden vom Ansturm-Dash.
function _blinkPoof(scene, x, y, mode) {
  try {
    if (!scene || !scene.add) return;
    const PURPLE = 0x9b6bff, LIGHT = 0xd6bcff;
    const T = scene.tweens;
    const ring = scene.add.graphics().setDepth(73);
    ring.lineStyle(3, PURPLE, 0.9); ring.strokeCircle(0, 0, 30); ring.setPosition(x, y);
    const from = mode === 'out' ? 1.4 : 0.2, to = mode === 'out' ? 0.1 : 1.3;
    ring.setScale(from);
    if (T) T.add({ targets: ring, scale: to, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(220, () => { try { ring.destroy(); } catch (e) {} });
    const g = scene.add.graphics().setDepth(73).setPosition(x, y);
    g.lineStyle(2, LIGHT, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r1 = mode === 'out' ? 22 : 6, r2 = mode === 'out' ? 6 : 26;
      g.lineBetween(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2);
    }
    if (T) T.add({ targets: g, alpha: 0, duration: 240, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(240, () => { try { g.destroy(); } catch (e) {} });
    if (window.particleFactory) { try { window.particleFactory.abilityTrail(x, y, PURPLE); } catch (e) {} }
  } catch (e) { /* visual only */ }
}

// teleportDash — echter BLINK: implodierender Vanish-Poof, Spieler wird fast
// unsichtbar und schnellt (sehr kurz) zum Ziel, dort Appear-Burst. I-Frames via
// window._playerInvincible. Strecke skaliert mit Rang. Klar verschieden vom
// sichtbaren Ansturm-Dash (charge).
function shadowTeleportDash() {
  var scene = this;
  if (!scene || !player || !player.active) return;
  if (isRolling || isDashing) return;

  var rank = _shadowRank('teleportDash');
  var dir = _getAimVector2(scene);
  if (dir.lengthSq() === 0) dir.set(0, 1);
  dir.normalize();
  var distance = 150 + (rank - 1) * 35;   // R1 150 … R5 290
  var duration = 110;                     // sehr kurz -> "Blink" statt Dash
  var speedPxPerSec = distance / (duration / 1000);

  isDashing = true;
  window._playerInvincible = true;
  if (window.soundManager) try { window.soundManager.playSFX('ability_dash'); } catch (e) {}

  _blinkPoof(scene, player.x, player.y, 'out');     // Vanish am Start
  if (player.setAlpha) player.setAlpha(0.12);         // fast unsichtbar im Blink
  if (player.setTint) player.setTint(0x9966ff);
  if (player.body) player.body.setMaxVelocity(speedPxPerSec, speedPxPerSec);
  if (player.setVelocity) player.setVelocity(dir.x * speedPxPerSec, dir.y * speedPxPerSec);

  scene.time.delayedCall(duration, function () {
    isDashing = false;
    window._playerInvincible = false;
    if (player && player.active) {
      player.setVelocity(0, 0);
      if (player.body) player.body.setMaxVelocity(220, 220);
      if (player.clearTint) player.clearTint();
      if (player.setAlpha) player.setAlpha(1);
      _blinkPoof(scene, player.x, player.y, 'in');  // Appear am Ziel
    }
  });
}

// Heilwunde — Heil-FX: aufsteigender Heil-Ring + weicher Glow + aufsteigende
// "+"-Zeichen + schwebende Heilzahl.
function _healFx(scene, amount) {
  try {
    if (!scene || !player) return;
    const GREEN = 0x66ff8a, SOFT = 0xbfffd0;
    const T = scene.tweens, cx = player.x, cy = player.y;
    // kurzer grüner Charakter-Flash (von _playerOverlayTint gelesen). Wall-Clock
    // (Date.now) statt scene.time.now: die Szenen-Uhren sind pro Szene verschieden,
    // ein im Dungeon gesetzter Ablauf lag im Hub dauerhaft in der Zukunft -> der
    // Charakter blieb dort grün. Date.now ist szenenübergreifend konsistent.
    window._healFlashUntil = Date.now() + 320;
    if (window.soundManager) { try { window.soundManager.playSFX('ability_spin'); } catch (e) {} }
    const ring = scene.add.graphics().setDepth(72);
    ring.lineStyle(3, GREEN, 0.9); ring.strokeCircle(0, 0, 30); ring.setPosition(cx, cy);
    if (T) T.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: 0, y: cy - 18, duration: 520, ease: 'Sine.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(520, () => { try { ring.destroy(); } catch (e) {} });
    const glow = scene.add.circle(cx, cy, 34, SOFT, 0.32).setDepth(41);
    if (T) T.add({ targets: glow, scale: 1.5, alpha: 0, duration: 500, onComplete: () => { try { glow.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(500, () => { try { glow.destroy(); } catch (e) {} });
    for (let i = 0; i < 6; i++) {
      const px = cx + (Math.random() - 0.5) * 44, py = cy + (Math.random() - 0.5) * 20;
      const g = scene.add.graphics().setDepth(73);
      g.lineStyle(3, GREEN, 0.95);
      g.lineBetween(px - 5, py, px + 5, py); g.lineBetween(px, py - 5, px, py + 5); // Pluszeichen
      if (T) T.add({ targets: g, y: -(36 + Math.random() * 16), alpha: 0, duration: 600 + Math.random() * 200, ease: 'Sine.easeOut', onComplete: () => { try { g.destroy(); } catch (e) {} } });
      else scene.time.delayedCall(820, () => { try { g.destroy(); } catch (e) {} });
    }
    if (scene.add.text) {
      const txt = scene.add.text(cx, cy - 24, '+' + amount, { fontFamily: 'monospace', fontSize: '16px', color: '#7dffa0', fontStyle: 'bold' }).setOrigin(0.5).setDepth(74);
      if (T) T.add({ targets: txt, y: cy - 56, alpha: 0, duration: 720, ease: 'Sine.easeOut', onComplete: () => { try { txt.destroy(); } catch (e) {} } });
      else scene.time.delayedCall(720, () => { try { txt.destroy(); } catch (e) {} });
    }
  } catch (e) { /* visual only */ }
}

// heilwunde — Heilung; Heilmenge skaliert mit Rang. Cooldown wird vom
// AbilitySystem über cooldownMs * cdMult gesteuert (siehe ability-def).
function shadowHeilwunde() {
  var rank = _shadowRank('heilwunde');
  var baseHeal = 5;
  var amount = Math.round(baseHeal * (1 + (rank - 1) * 0.15));
  try {
    if (typeof window.addPlayerHealth === 'function') {
      window.addPlayerHealth(amount);
    } else if (typeof setPlayerHealth === 'function' && typeof playerHealth === 'number') {
      setPlayerHealth(playerHealth + amount);
    }
    _healFx(this, amount);
  } catch (err) {
    console.warn('[Abilities] heilwunde failed', err);
  }
  return amount;
}

// Reaping-Crescent-Visual für Todesstoss (schmaler, fokussierter Frontschlag).
function _deathBlowFx(scene, forward, range, arc) {
  try {
    const CRIMSON = 0xff2233;
    const ang = Math.atan2(forward.y, forward.x);
    const g = scene.add.graphics().setDepth(70);
    g.fillStyle(CRIMSON, 0.26);
    g.slice(player.x, player.y, range, ang - arc / 2, ang + arc / 2, false);
    g.fillPath();
    g.lineStyle(3, 0xff6677, 0.9);
    g.beginPath(); g.arc(player.x, player.y, range * 0.92, ang - arc / 2, ang + arc / 2, false); g.strokePath();
    if (scene.tweens) scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(220, () => { try { g.destroy(); } catch (e) {} });
  } catch (e) { /* visual only */ }
}

// Dramatischer Exekutions-Burst (Instakill): Flash + Crimson-Ring + dunkle Splitter.
function _deathBlowExecuteBurst(scene, x, y) {
  try {
    const CRIMSON = 0xff2233, DARK = 0x550008, WHITE = 0xffffff;
    const T = scene.tweens;
    const flash = scene.add.circle(x, y, 18, WHITE, 0.9).setDepth(72);
    if (T) T.add({ targets: flash, scale: 2.6, alpha: 0, duration: 180, onComplete: () => { try { flash.destroy(); } catch (e) {} } });
    const ring = scene.add.graphics().setDepth(71);
    ring.lineStyle(4, CRIMSON, 0.95); ring.strokeCircle(0, 0, 40); ring.setPosition(x, y).setScale(0.2);
    if (T) T.add({ targets: ring, scale: 1.4, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) {} } });
    const shards = scene.add.graphics().setDepth(71).setPosition(x, y);
    shards.lineStyle(3, DARK, 0.9);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; shards.lineBetween(0, 0, Math.cos(a) * 46, Math.sin(a) * 46); }
    if (T) T.add({ targets: shards, alpha: 0, duration: 300, onComplete: () => { try { shards.destroy(); } catch (e) {} } });
    if (window.particleFactory) { try { window.particleFactory.hitSpark(x, y); } catch (e) {} }
  } catch (e) { /* visual only */ }
}

// deathBlow — fokussierter HINRICHTUNGS-Schlag (schmaler Kegel, weite Reichweite,
// HOHER Schaden), klar verschieden vom Normalangriff. Gegner unter X% Max-HP
// werden SOFORT exekutiert. Tötet er mindestens einen Gegner (Exekution ODER
// normaler Kill) → Cooldown-Reset (Ketten-Hinrichtung).
function shadowDeathBlow() {
  var scene = this;
  if (!scene || !player || !player.active) return false;

  var dmgMult = _shadowDmgMult('deathBlow');
  var rank = _shadowRank('deathBlow');
  var threshold = 0.15 + _shadowSynergy('deathBlow', 'threshold') + (rank - 1) * 0.05;
  if (threshold > 0.95) threshold = 0.95;

  var forward = _getAimVector2(scene);
  if (forward.lengthSq() === 0) forward.set(0, 1);
  forward.normalize();
  var range = 165;                 // weiter als der Normalangriff
  var arc = Math.PI / 2.4;          // SCHMALER, fokussierter Kegel (~75°)
  var threshCos = Math.cos(arc / 2);
  var tmp = new Phaser.Math.Vector2();
  var killed = 0;

  if (window.soundManager) try { window.soundManager.playSFX('attack'); } catch (e) {}
  _deathBlowFx(scene, forward, range, arc);

  var targets = [];
  breakDestructiblesInRange(scene, range);
  forEachEnemyInRange(range, function (enemy, info) {
    if (!enemy || !enemy.active) return;
    var len = Math.hypot(info.dx, info.dy);
    if (len > 0) {
      tmp.set(info.dx / len, info.dy / len);
      if (forward.dot(tmp) < threshCos) return;
    }
    targets.push(enemy);
  }, { requireLineOfSight: false });

  targets.forEach(function (enemy) {
    if (!enemy || !enemy.active) return;
    var info = _shadowEnemyHp(enemy);
    if (info.hp <= 0) return;
    if (info.hp <= info.max * threshold) {
      if (typeof enemy.maxHp !== 'number') enemy.maxHp = info.max;
      enemy.hp = 0;
      _deathBlowExecuteBurst(scene, enemy.x, enemy.y);
      handleEnemyHit(scene, enemy, { tint: 0xff2233, duration: 180 });
      killed++;
    } else {
      var res = dealDamageToEnemy(scene, enemy, 2.2 * dmgMult, 'deathBlow');   // schwerer Finisher
      var hpNow = _shadowEnemyHp(enemy).hp;
      handleEnemyHit(scene, enemy, { tint: res && res.isCrit ? 0xfff2a6 : 0xff5566, duration: res && res.isCrit ? 200 : 140 });
      if (hpNow <= 0) killed++;          // auch ein normaler Kill setzt den CD zurück
    }
  });

  if (killed > 0 && scene.cameras && scene.cameras.main) { try { scene.cameras.main.shake(90, 0.004); } catch (e) {} }
  return killed > 0;
}

window.shadowCharge = shadowCharge;
window.shadowTeleportDash = shadowTeleportDash;
window.shadowHeilwunde = shadowHeilwunde;
window.shadowDeathBlow = shadowDeathBlow;
// === /060 Strang SCHATTEN — Helper-Funktionen ===

// Raserei (frenzy) — Aktivierungs-Burst: orange/roter Ring + radiale Speed-Lines
// + Funken. Der laufende Buff zeigt zusätzlich Motes (updateAmuletPerFrame).
function _frenzyFx(scene) {
  try {
    if (!scene || !player) return;
    const ORANGE = 0xff7a1a, RED = 0xff3a2a;
    const T = scene.tweens, cx = player.x, cy = player.y;
    const ring = scene.add.graphics().setDepth(72);
    ring.lineStyle(4, ORANGE, 0.9); ring.strokeCircle(0, 0, 40); ring.setPosition(cx, cy).setScale(0.3);
    if (T) T.add({ targets: ring, scale: 1.5, alpha: 0, duration: 560, ease: 'Cubic.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(560, () => { try { ring.destroy(); } catch (e) {} });
    const g = scene.add.graphics().setDepth(72).setPosition(cx, cy);
    g.lineStyle(3, RED, 0.85);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.lineBetween(Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a) * 50, Math.sin(a) * 50); }
    if (T) T.add({ targets: g, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 480, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(480, () => { try { g.destroy(); } catch (e) {} });
    if (window.particleFactory) { try { window.particleFactory.abilityTrail(cx, cy, ORANGE); } catch (e) {} }
    if (window.soundManager) { try { window.soundManager.playSFX('ability_spin'); } catch (e) {} }
  } catch (e) { /* visual only */ }
}
window._frenzyFx = _frenzyFx;

function ensurePlayerDaggerTexture(scene) {
  if (!scene || scene.textures.exists('playerDagger')) return;
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(4, 12, 20, 12, 8, 2);
  g.fillRect(4, 10, 8, 4);
  g.generateTexture('playerDagger', 24, 24);
  g.destroy();
}

function ensurePlayerArrowTexture(scene) {
  if (!scene || scene.textures.exists('playerArrow')) return;
  const g = scene.make.graphics({ add: false });
  // Shaft (light brown)
  g.fillStyle(0xc8a060, 1);
  g.fillRect(2, 7, 18, 2);
  // Head (gray triangle)
  g.fillStyle(0xdddddd, 1);
  g.fillTriangle(20, 4, 20, 12, 28, 8);
  // Fletching (red)
  g.fillStyle(0xc0392b, 1);
  g.fillTriangle(0, 4, 0, 12, 5, 8);
  g.generateTexture('playerArrow', 28, 16);
  g.destroy();
}

// Returns true when the equipped weapon is a bow (subtype === 'bow').
function _hasBowEquipped() {
  const eq = (typeof equipment !== 'undefined') ? equipment : (window && window.equipment);
  return !!(eq && eq.weapon && eq.weapon.subtype === 'bow');
}

function _fireBowArrow(scene, opts) {
  if (!scene || !player || !playerProjectiles) return;
  opts = opts || {};
  ensurePlayerArrowTexture(scene);

  const dir = _getAimVector2(scene);
  // Feature 059 WP03: optional angle offset for the Zwillingsklinge 2nd arrow.
  if (opts.angleOffset) {
    const _a = dir.angle() + opts.angleOffset;
    dir.set(Math.cos(_a), Math.sin(_a));
  }

  const spawnOffset = 22;
  const projectile = scene.physics.add.sprite(
    player.x + dir.x * spawnOffset,
    player.y + dir.y * spawnOffset,
    'playerArrow'
  );
  projectile.setDepth(70);
  projectile.setRotation(dir.angle());
  projectile.setOrigin(0.5, 0.5);
  projectile.body?.setAllowGravity?.(false);
  projectile.body?.setSize?.(20, 6);
  projectile.body?.setOffset?.(4, 5);
  projectile.setData('damageMult', (typeof opts.damageMult === 'number') ? opts.damageMult : 1.0);
  projectile.setData('isBowArrow', true);
  projectile.setData('knockback', 60);

  playerProjectiles.add(projectile);

  const ARROW_SPEED = 620;
  projectile.body.setVelocity(dir.x * ARROW_SPEED, dir.y * ARROW_SPEED);

  // Lifespan scales with the player's effective range (so range upgrades /
  // affixes also extend bow shots). Reference: ~750ms at attackRange ~120.
  const baseLifespan = 600;
  const rangeBoost = Math.max(0, (attackRange - 100)) * 4;
  const lifespan = baseLifespan + rangeBoost;
  scene.time.delayedCall(lifespan, () => {
    if (projectile && projectile.active) projectile.destroy();
  });

  if (window.soundManager) try { window.soundManager.playSFX('attack'); } catch (e) {}
}

function throwDagger() {
  if (!this || !player || !playerProjectiles) return;
  if (daggerThrowCooldown || isChargingSlash || isRolling) return;

  if (window.soundManager) window.soundManager.playSFX('ability_dagger');
  const scene = this;
  ensurePlayerDaggerTexture(scene);

  const dir = _getAimVector2(scene);

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
  if (!this || !player) return;
  if (shieldBashCooldown || isDashing || isRolling) return;

  if (window.soundManager) window.soundManager.playSFX('ability_shield');
  const scene = this;
  const range = getShieldBashRange();
  const cooldown = getShieldBashCooldown();
  const finalCooldown = applyCooldownModifier(cooldown, 'shield');
  const forward = _getAimVector2(scene);

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

  breakDestructiblesInRange(scene, range);
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

  // 060 Strang KETTEN — twistingBlades (Boomerang): pierct ALLE Gegner und
  // trifft jeden Gegner pro Phase (Hin-/Rückweg) genau EINMAL. Eigener Zweig,
  // damit die Standard-Dolch-Logik (Poison + destroy-on-hit) nicht greift.
  if (projectile.getData('twistingBlades')) {
    const seen = projectile.getData('twHitForward') || {};
    const eid = enemy.name || enemy._twId || (enemy._twId = 'e' + Math.random().toString(36).slice(2));
    if (seen[eid]) return; // in dieser Phase bereits getroffen
    seen[eid] = true;
    projectile.setData('twHitForward', seen);
    const twMult = projectile.getData('damageMult') ?? 1;
    const { isCrit } = dealDamageToEnemy(scene, enemy, twMult, 'twistingBlades');
    handleEnemyHit(scene, enemy, { tint: isCrit ? 0xfff2a6 : 0xffaa88, duration: isCrit ? 200 : 140 });
    const tkb = projectile.getData('knockback') ?? 120;
    if (enemy.active && enemy.body) {
      const kdx = enemy.x - projectile.x;
      const kdy = enemy.y - projectile.y;
      const klen = Math.hypot(kdx, kdy) || 1;
      enemy.body.setVelocity((kdx / klen) * tkb, (kdy / klen) * tkb);
      scene.time.delayedCall(120, () => {
        if (enemy && enemy.active && enemy.body) enemy.body.setVelocity(0, 0);
      });
    }
    return; // niemals destroyen — Rückkehr/Lifespan-Timer räumt auf
  }

  const damageMult = projectile.getData('damageMult') ?? 1;
  const isBowArrow = !!projectile.getData('isBowArrow');
  const abilityKey = isBowArrow ? 'attack' : 'dagger';
  const knockback = projectile.getData('knockback')
    ?? (isBowArrow ? 60 : DAGGER_THROW_KNOCKBACK);

  const { isCrit } = dealDamageToEnemy(scene, enemy, damageMult, abilityKey);
  handleEnemyHit(scene, enemy, {
    tint: isCrit ? 0xfff2a6 : 0xffaa88,
    duration: isCrit ? 200 : 140
  });

  // Dagger throw applies POISON; bow arrows do not.
  if (!isBowArrow && window.statusEffectManager && window.StatusEffectType && enemy && enemy.active) {
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
  // Bow arrows always destroy on first hit (no pierce). Daggers may pierce
  // once if the player has the Wind Gust skill.
  if (!isBowArrow && typeof window.hasSkill === 'function' && window.hasSkill('mobility_wind_gust')
      && !projectile.getData('hasPierced')) {
    projectile.setData('hasPierced', true);
    // Don't destroy, let it continue
  } else {
    projectile.destroy();
  }
}

// #50/#48: Aufgewerteter Level-Up-Effekt — Gold-Burst am Spieler: Kamera-Flash,
// expandierender Goldring, Lichtstrahlen, aufsteigende Sparkles, "STUFE X"-Text
// + "+1 Talentpunkt". Rein visuell, defensiv.
function _levelUpFx(scene, level) {
  try {
    if (!scene || !scene.add || typeof player === 'undefined' || !player) return;
    const GOLD = 0xffd166, BRIGHT = 0xfff3c0;
    const T = scene.tweens, cx = player.x, cy = player.y;
    if (scene.cameras && scene.cameras.main) { try { scene.cameras.main.flash(220, 255, 226, 150, false); } catch (e) {} }
    // expandierende Goldring-Schockwelle
    const ring = scene.add.graphics().setDepth(74);
    ring.lineStyle(5, GOLD, 0.95); ring.strokeCircle(0, 0, 60); ring.setPosition(cx, cy).setScale(0.2);
    if (T) T.add({ targets: ring, scale: 1.8, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(520, () => { try { ring.destroy(); } catch (e) {} });
    // zentraler Flash
    const flash = scene.add.circle(cx, cy, 30, BRIGHT, 0.9).setDepth(74);
    if (T) T.add({ targets: flash, scale: 2.6, alpha: 0, duration: 320, onComplete: () => { try { flash.destroy(); } catch (e) {} } });
    // radiale Lichtstrahlen (drehen + wachsen + verblassen)
    const rays = scene.add.graphics().setDepth(73).setPosition(cx, cy);
    rays.fillStyle(GOLD, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, w = 0.16;
      rays.beginPath(); rays.moveTo(0, 0);
      rays.lineTo(Math.cos(a - w) * 90, Math.sin(a - w) * 90);
      rays.lineTo(Math.cos(a + w) * 90, Math.sin(a + w) * 90);
      rays.closePath(); rays.fillPath();
    }
    if (T) T.add({ targets: rays, scale: 1.5, alpha: 0, angle: 24, duration: 520, ease: 'Cubic.easeOut', onComplete: () => { try { rays.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(520, () => { try { rays.destroy(); } catch (e) {} });
    // aufsteigende Sparkles
    for (let i = 0; i < 10; i++) {
      const ox = (Math.random() - 0.5) * 70;
      const s = scene.add.circle(cx + ox, cy + 10, 2 + Math.random() * 3, BRIGHT, 0.95).setDepth(74);
      if (T) T.add({ targets: s, y: cy - 40 - Math.random() * 50, alpha: 0, duration: 600 + Math.random() * 300, ease: 'Sine.easeOut', onComplete: () => { try { s.destroy(); } catch (e) {} } });
      else scene.time.delayedCall(900, () => { try { s.destroy(); } catch (e) {} });
    }
    // "STUFE X" + Talentpunkt-Untertitel steigen auf
    const txt = scene.add.text(cx, cy - 30, 'STUFE ' + level, { fontFamily: 'serif', fontSize: '30px', color: '#ffd166', fontStyle: 'bold', stroke: '#5a3d00', strokeThickness: 4 }).setOrigin(0.5).setDepth(75);
    const sub = scene.add.text(cx, cy - 4, '+1 Talentpunkt', { fontFamily: 'monospace', fontSize: '13px', color: '#fff3c0', fontStyle: 'bold' }).setOrigin(0.5).setDepth(75);
    if (T) {
      txt.setScale(0.4); T.add({ targets: txt, scale: 1, duration: 240, ease: 'Back.easeOut' });
      T.add({ targets: [txt, sub], y: '-=46', alpha: 0, duration: 1100, delay: 250, ease: 'Sine.easeOut', onComplete: () => { try { txt.destroy(); sub.destroy(); } catch (e) {} } });
    } else {
      scene.time.delayedCall(1300, () => { try { txt.destroy(); sub.destroy(); } catch (e) {} });
    }
    if (window.particleFactory) { try { window.particleFactory.abilityTrail(cx, cy, GOLD); } catch (e) {} }
  } catch (e) { /* visual only */ }
}

function addXP(amount = 1) {
  // Issue #26 — Knowledge-Tree xpMult wraps the incoming amount once at the
  // function boundary so every call site (lore-fragment, enemy kill, quest
  // reward) benefits without per-site changes.
  if (window.knowledgeTreeBuffs && window.knowledgeTreeBuffs.xpMult > 1) {
    amount = Math.round(amount * window.knowledgeTreeBuffs.xpMult);
  }
  // 'of Wisdom' (xp_gain) affix — percent bonus on every XP gain. Wrapped at
  // the same boundary as the Knowledge-Tree xpMult so all call sites benefit.
  // getBonus returns a fraction (e.g. 0.10 for +10%); 0 when unequipped.
  if (window.LootSystem && typeof window.LootSystem.getBonus === 'function') {
    const _xpFind = Math.max(0, window.LootSystem.getBonus('xp_gain') || 0);
    if (_xpFind > 0) amount = Math.round(amount * (1 + _xpFind));
  }
  // Run-summary: track the scaled amount (what the player actually got).
  if (window.runStats) window.runStats.xpGained += amount;
  playerXP += amount;

  // WHILE statt IF: grosse XP-Belohnungen (z.B. Quests) koennen mehrere Level
  // auf einmal geben; der Rest wird UEBERTRAGEN (frueher playerXP=0 -> Ueberschuss
  // ging verloren). Zusammen mit der window-Spiegelung unten behebt das die
  // "290/136"-Fehlanzeige (Quest-XP umging Level-Up + Anzeige komplett).
  while (playerXP >= neededXP) {
    playerXP -= neededXP;
    playerLevel += 1;
    baseStats.maxHP += 2;
    if (typeof setPlayerMaxHealth === 'function') {
      setPlayerMaxHealth(playerMaxHealth + 2, { updateUi: false });
    } else {
      playerMaxHealth += 2;
      playerHealth = Math.min(playerMaxHealth, playerHealth + 2);
    }
    // #48: Level-Up heilt VOLL — spürbarer Belohnungs-/Power-Moment.
    if (typeof setPlayerHealth === 'function') setPlayerHealth(playerMaxHealth);
    else playerHealth = playerMaxHealth;
    neededXP = (typeof getNeededXP === 'function') ? getNeededXP(playerLevel) : (2 * playerLevel);

    // Feature 060: jeder Level-Up vergibt 1 Skill-Punkt fuer den Skill-Baum
    // (#48/#58). Defensiv — bricht nie den Level-Up-Pfad.
    if (typeof window !== 'undefined' && window.SkillTree
        && typeof window.SkillTree.grantSkillPoint === 'function') {
      try { window.SkillTree.grantSkillPoint(1); } catch (e) { /* swallow */ }
    }

    if (window.soundManager) window.soundManager.playSFX('level_up');

    // #50/#48: aufgewertetes Level-Up — Gold-VFX am Spieler + Talentpunkt-Toast
    // (ersetzt den statischen grünen "LEVEL UP!"-Text).
    const scene = (player && player.scene) ? player.scene
      : ((this && this.add) ? this : (typeof window !== 'undefined' ? window.currentScene : null));
    if (scene) {
      try { _levelUpFx(scene, playerLevel); } catch (e) {}
      if (window.EventSystem && typeof window.EventSystem.showToast === 'function') {
        try { window.EventSystem.showToast(scene, 'Stufe ' + playerLevel + ' erreicht!  +1 Talentpunkt — Taste [T]', 'level_up'); } catch (e) {}
      }
    }
  }

  // HUD + andere Klassik-Scripts bevorzugen window.playerXP/neededXP/playerLevel.
  // Hier IMMER spiegeln, damit die Anzeige nie vom echten Wert divergiert.
  if (typeof window !== 'undefined') {
    window.playerXP = playerXP;
    window.neededXP = neededXP;
    window.playerLevel = playerLevel;
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

  // New HUD bars + portrait halo + low-HP vignette
  if (window.HUDv2 && typeof window.HUDv2.update === 'function') {
    try { window.HUDv2.update(); } catch (err) { /* ignore */ }
  }
}

// =========================================================================
// === 060 Strang KETTEN & KONTROLLE — Skill-Tree-Fähigkeiten ==============
// =========================================================================
// Cast-Helfer für die vier Skill-Tree-Knoten des Strangs "Ketten & Kontrolle".
// Werden DEFENSIV von ABILITY_DEFS (js/abilitySystem.js) aufgerufen. Alle
// SkillTree-Werte werden defensiv gelesen (Knoten/Funktion fehlt → Multiplier 1).
// Die Pull-/Sog-Mechanik berührt nur lebende Gegner mit Physik-Body und fängt
// jeden Fehler ab, damit der enemies-Loop nie crasht.

function _kettenDmgMult(nodeId) {
  try {
    return (window.SkillTree && typeof window.SkillTree.getAbilityDamageMult === 'function')
      ? (window.SkillTree.getAbilityDamageMult(nodeId) || 1) : 1;
  } catch (e) { return 1; }
}
function _kettenCdMult(nodeId) {
  try {
    return (window.SkillTree && typeof window.SkillTree.getAbilityCooldownMult === 'function')
      ? (window.SkillTree.getAbilityCooldownMult(nodeId) || 1) : 1;
  } catch (e) { return 1; }
}
function _kettenRank(nodeId) {
  try {
    return (window.SkillTree && typeof window.SkillTree.getRank === 'function')
      ? (window.SkillTree.getRank(nodeId) | 0) : 1;
  } catch (e) { return 1; }
}
function _kettenSynergy(nodeId, stat) {
  try {
    return (window.SkillTree && typeof window.SkillTree.getSynergyValue === 'function')
      ? (window.SkillTree.getSynergyValue(nodeId, stat) || 0) : 0;
  } catch (e) { return 0; }
}

// Zieht einen Gegner für `durationMs` Richtung Spieler. Setzt _pullUntil/
// _pullSpeed; die Gegner-KI (handleEnemies) überspringt während dieser Zeit ihr
// Steering und zieht den Gegner aktiv heran (sonst überschreibt die KI die
// Velocity sofort → Pull unsichtbar). Defensiv: nur lebende Gegner mit Body.
function _pullEnemyToPlayer(scene, enemy, speed, durationMs) {
  try {
    if (!scene || !player || !enemy || !enemy.active || !enemy.body) return;
    var now = (scene.time && typeof scene.time.now === 'number') ? scene.time.now : 0;
    enemy._pullUntil = now + durationMs;
    enemy._pullSpeed = speed;
    // Sofort-Impuls (falls die KI diesen Frame schon lief).
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.body.setVelocity((dx / len) * speed, (dy / len) * speed);
  } catch (e) { /* never crash the loop */ }
}

// --- twistingBlades (Wirbelklingen) -------------------------------------
// Basiert auf daggerThrow: Projektil fliegt in Blickrichtung bis zur Reichweite
// und KEHRT dann zum Spieler ZURÜCK; Schaden auf Hin- und Rückweg (über die
// bestehende playerProjectiles↔enemies-Overlap, mit Hit-Set gegen Doppelhits).
function castTwistingBlades() {
  const scene = this;
  if (!scene || !player || !playerProjectiles) return;
  if (window.soundManager) window.soundManager.playSFX('ability_dagger');
  if (typeof ensurePlayerDaggerTexture === 'function') ensurePlayerDaggerTexture(scene);

  const dmgMult = _kettenDmgMult('twistingBlades');
  const dir = _getAimVector2(scene);
  const spawnOffset = 24;
  const projectile = scene.physics.add.sprite(
    player.x + dir.x * spawnOffset,
    player.y + dir.y * spawnOffset,
    'playerDagger'
  );
  projectile.setDepth(70);
  projectile.setRotation(dir.angle());
  projectile.setOrigin(0.3, 0.5);
  projectile.setScale(0.85);
  projectile.body?.setAllowGravity?.(false);
  projectile.body?.setSize?.(14, 6);
  projectile.body?.setOffset?.(6, 9);
  projectile.setData('damageMult', dmgMult);
  projectile.setData('knockback', (typeof DAGGER_THROW_KNOCKBACK !== 'undefined') ? DAGGER_THROW_KNOCKBACK : 120);
  // Boomerang-Marker: separates Hit-Set, damit ein Gegner auf Hin- und Rückweg
  // je EINMAL getroffen wird (verhindert Multi-Hit pro Frame durch Overlap).
  projectile.setData('twistingBlades', true);
  projectile.setData('twHitForward', {});
  projectile.setData('twPhase', 'out');
  playerProjectiles.add(projectile);

  const speed = (typeof getDaggerThrowSpeed === 'function') ? getDaggerThrowSpeed() : 420;
  projectile.body.setVelocity(dir.x * speed, dir.y * speed);

  // Reichweite: halbe Dolch-Lebensdauer auf dem Hinweg, dann Rückkehr.
  const baseLifespan = (typeof getDaggerThrowLifespan === 'function') ? getDaggerThrowLifespan() : 600;
  const outMs = Math.max(120, Math.round(baseLifespan * 0.55));

  let _twReturning = false;
  const homeStep = () => {
    if (!projectile || !projectile.active) return;
    if (!player || !player.active) { projectile.destroy(); return; }
    const ddx = player.x - projectile.x;
    const ddy = player.y - projectile.y;
    const dlen = Math.hypot(ddx, ddy);
    if (dlen < 22) { projectile.destroy(); return; }
    projectile.body?.setVelocity((ddx / dlen) * speed, (ddy / dlen) * speed);
    projectile.setRotation(Math.atan2(ddy, ddx));
    scene.time.delayedCall(60, homeStep);
  };
  const startReturn = () => {
    if (_twReturning || !projectile || !projectile.active) return;
    _twReturning = true;
    projectile.setData('twPhase', 'back');
    projectile.setData('twHitForward', {}); // Rückweg darf erneut treffen
    homeStep();
  };
  // Prallt die Klinge an einer Wand ab, kehrt sie SOFORT zurück: der
  // playerProjectiles↔obstacles-Collider (main.js) ruft twStartReturn statt
  // das Projektil zu zerstören. Sonst stirbt der Boomerang an der ersten Wand.
  projectile.setData('twStartReturn', startReturn);
  // Nach Reichweite automatisch zurückkehren.
  scene.time.delayedCall(outMs, startReturn);

  // Hard-Fallback: nie länger als 2× Lebensdauer leben.
  scene.time.delayedCall(baseLifespan * 2 + 400, () => {
    if (projectile && projectile.active) projectile.destroy();
  });
}

// --- steelGrasp (Stahlgriff) --------------------------------------------
// Ketten-/Greifer-Projektil in Blickrichtung; der ERSTE getroffene Gegner wird
// zum Spieler GEZOGEN + Schaden. Wir scannen einen Strahl/Kegel nach vorn und
// nehmen den nächstgelegenen Gegner innerhalb der Reichweite.
function castSteelGrasp() {
  const scene = this;
  if (!scene || !player) return;
  if (window.soundManager) window.soundManager.playSFX('ability_dagger');

  const dmgMult = _kettenDmgMult('steelGrasp');
  const dir = _getAimVector2(scene);
  const range = 360;
  const halfArcCos = Math.cos(Math.PI / 5); // ~36° Halbkegel

  // Visuelle Kette: kurze Linie in Blickrichtung.
  try {
    const fx = scene.add.graphics();
    fx.lineStyle(3, 0xbfc7d6, 0.85);
    fx.beginPath();
    fx.moveTo(player.x, player.y);
    fx.lineTo(player.x + dir.x * range, player.y + dir.y * range);
    fx.strokePath();
    scene.time.delayedCall(160, () => { try { fx.destroy(); } catch (e) {} });
  } catch (e) { /* visual only */ }

  // Ersten Gegner im Kegel finden (nächstgelegener gewinnt).
  let target = null;
  let bestDist = Infinity;
  const tmp = new Phaser.Math.Vector2();
  forEachEnemyInRange(range, (enemy, { distance, dx, dy }) => {
    const len = Math.hypot(dx, dy) || 1;
    tmp.set(dx / len, dy / len);
    if (dir.dot(tmp) < halfArcCos) return; // außerhalb des Vorwärts-Kegels
    if (distance < bestDist) { bestDist = distance; target = enemy; }
  });

  if (!target || !target.active) return;

  // Schaden + Pull zum Spieler. Stahlgriff ist primär ein PULL (Utility),
  // daher nur minimaler Schaden (0.12x).
  const { isCrit } = dealDamageToEnemy(scene, target, 0.12 * dmgMult, 'steelGrasp');
  handleEnemyHit(scene, target, { tint: isCrit ? 0xfff2a6 : 0xbfc7d6, duration: isCrit ? 200 : 140 });
  const pullDist = Math.max(1, bestDist);
  const pullDur = Phaser.Math.Clamp((pullDist / 360) * 250, 150, 250);
  const pullSpeed = pullDist / (pullDur / 1000);
  _pullEnemyToPlayer(scene, target, pullSpeed, pullDur);

  // Stahlgriff bindet kurz (SLOW), passend zur Ketten-Lore.
  if (window.statusEffectManager && window.StatusEffectType && target.active) {
    try { window.statusEffectManager.applyEffect(target, window.StatusEffectType.SLOW, 'steelGrasp'); } catch (e) {}
  }
}

// --- cycloneStrike (Wirbelsog) ------------------------------------------
// Wirbelsog: zieht ALLE Gegner im Radius zum Spieler + kleiner AoE-Schaden.
// Rang skaliert Radius und Schaden. cooldownMs liegt in ABILITY_DEFS.
function castCycloneStrike() {
  const scene = this;
  if (!scene || !player) return;
  if (window.soundManager) window.soundManager.playSFX('ability_spin');

  const dmgMult = _kettenDmgMult('cycloneStrike');
  const rank = Math.max(1, _kettenRank('cycloneStrike'));
  const radius = 290 + (rank - 1) * 25;           // größerer Sog-Radius (290..390)
  const aoeMult = 0.5 * dmgMult * (1 + (rank - 1) * 0.1);
  const CYAN = 0x66ddff, LIGHT = 0xbff2ff;

  // --- Vortex-Visual: spiralige, nach innen rotierende Sog-Arme + Ring ---
  try {
    const swirl = scene.add.graphics().setDepth(70);
    let a0 = 0, life = 0;
    const arms = 4, turns = 2.2;
    const swirlTimer = scene.time.addEvent({ delay: 16, loop: true, callback: () => {
      life += 16; a0 += 0.34;
      const k = Math.min(1, life / 360);                 // Sog zieht sich zusammen
      swirl.clear();
      swirl.lineStyle(3, CYAN, 0.85 * (1 - k * 0.6));
      swirl.strokeCircle(player.x, player.y, radius * (1 - k * 0.85));
      for (let s = 0; s < arms; s++) {
        swirl.lineStyle(2.5, s % 2 ? LIGHT : CYAN, 0.8 * (1 - k));
        swirl.beginPath();
        const base = a0 + s * (Math.PI * 2 / arms);
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const ang = base + t * turns * Math.PI * 2;
          const rr = radius * (1 - k) * (1 - t * 0.92);
          const px = player.x + Math.cos(ang) * rr, py = player.y + Math.sin(ang) * rr;
          if (t === 0) swirl.moveTo(px, py); else swirl.lineTo(px, py);
        }
        swirl.strokePath();
      }
      if (life >= 380) { try { swirl.destroy(); } catch (e) {} swirlTimer.remove(); }
    }});
    const core = scene.add.circle(player.x, player.y, 16, LIGHT, 0.8).setDepth(71);
    if (scene.tweens) scene.tweens.add({ targets: core, scale: 2.2, alpha: 0, duration: 300, onComplete: () => { try { core.destroy(); } catch (e) {} } });
    else scene.time.delayedCall(300, () => { try { core.destroy(); } catch (e) {} });
    if (window.particleFactory) window.particleFactory.abilityTrail(player.x, player.y, CYAN);
  } catch (e) { /* visual only */ }

  breakDestructiblesInRange(scene, radius);
  forEachEnemyInRange(radius, (enemy, { distance }) => {
    if (!enemy || !enemy.active) return;
    const { isCrit } = dealDamageToEnemy(scene, enemy, aoeMult, 'cycloneStrike');
    handleEnemyHit(scene, enemy, { tint: isCrit ? 0xfff2a6 : CYAN, duration: isCrit ? 160 : 110 });
    if (window.particleFactory) { try { window.particleFactory.hitSpark(enemy.x, enemy.y); } catch (e) {} }
    // Stärkerer Sog (in ~260ms ganz heran).
    const d = Math.max(1, distance);
    const dur = 260;
    _pullEnemyToPlayer(scene, enemy, (d / (dur / 1000)) * 1.15, dur);
  });
}

// --- frostNova (Frostnova) ----------------------------------------------
// AoE-Frost-Nova um den Spieler: verlangsamt Gegner + Schaden. Schaden/Slow
// skalieren mit dmgMult + Synergie-Bonus (getSynergyValue('frostNova','damage')).
function castFrostNova() {
  const scene = this;
  if (!scene || !player) return;
  if (window.soundManager) window.soundManager.playSFX('ability_spin');

  const dmgMult = _kettenDmgMult('frostNova');
  const synergy = _kettenSynergy('frostNova', 'damage');
  const totalMult = dmgMult * (1 + synergy);
  const range = 180;
  const ICE = 0x9fe8ff, DEEP = 0x4aa6e0, WHITE = 0xffffff;
  const cx = Math.round(player.x), cy = Math.round(player.y);
  const T = scene.tweens, fade = (obj, cfg, dur) => {
    if (T) T.add(Object.assign({ targets: obj, onComplete: () => { try { obj.destroy(); } catch (e) {} } }, cfg));
    else if (scene.time) scene.time.delayedCall(dur, () => { try { obj.destroy(); } catch (e) {} });
  };

  try {
    // 1) Doppel-Schockwelle (weiß außen + cyan innen, leicht gestaffelt)
    const ring1 = scene.add.graphics().setDepth(70);
    ring1.lineStyle(4, WHITE, 0.9); ring1.strokeCircle(0, 0, range); ring1.setPosition(cx, cy).setScale(0.1);
    fade(ring1, { scale: 1, alpha: 0, duration: 300, ease: 'Cubic.easeOut' }, 300);
    const ring2 = scene.add.graphics().setDepth(70);
    ring2.lineStyle(3, ICE, 0.85); ring2.strokeCircle(0, 0, range * 0.92); ring2.setPosition(cx, cy).setScale(0.1);
    fade(ring2, { scale: 1, alpha: 0, duration: 380, ease: 'Cubic.easeOut' }, 380);
    // 2) zentraler Flash
    const flash = scene.add.circle(cx, cy, 24, WHITE, 0.9).setDepth(72);
    fade(flash, { scale: 2.4, alpha: 0, duration: 220 }, 220);
    // 3) Frostfeld am Boden (gefüllt + gezackter Crackle-Rand), bleibt kurz liegen
    const field = scene.add.graphics().setDepth(39);
    field.fillStyle(DEEP, 0.18); field.fillCircle(cx, cy, range);
    field.lineStyle(2, ICE, 0.35); field.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const rr = range * (0.95 + ((i % 2) ? 0.05 : -0.03));
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) field.moveTo(px, py); else field.lineTo(px, py);
    }
    field.strokePath();
    fade(field, { alpha: 0, duration: 650 }, 650);
    // 4) detaillierte Eiskristalle (Stamm + 2 Facetten), wachsen nach außen
    const crystals = scene.add.graphics().setDepth(71).setPosition(cx, cy).setScale(0.2);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 2) * 0.1;
      const ox = Math.cos(a), oy = Math.sin(a), px = -oy, py = ox;
      const r1 = range * 0.30, r2 = range * (0.78 + (i % 3) * 0.06), f = range * 0.06;
      crystals.lineStyle(i % 2 ? 2 : 3, i % 2 ? LIGHT : ICE, 0.9);
      crystals.beginPath(); crystals.moveTo(ox * r1, oy * r1); crystals.lineTo(ox * r2, oy * r2); crystals.strokePath();
      const tx = ox * r2 * 0.78, ty = oy * r2 * 0.78;
      crystals.beginPath(); crystals.moveTo(tx, ty); crystals.lineTo(tx + (ox * 0.5 + px) * f, ty + (oy * 0.5 + py) * f); crystals.strokePath();
      crystals.beginPath(); crystals.moveTo(tx, ty); crystals.lineTo(tx + (ox * 0.5 - px) * f, ty + (oy * 0.5 - py) * f); crystals.strokePath();
    }
    if (T) T.add({ targets: crystals, scale: 1, duration: 240, ease: 'Back.easeOut' });
    fade(crystals, { alpha: 0, duration: 440 }, 440);
    // 5) treibende Schneeflocken (kleine *-Zeichen, driften nach außen + fade)
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, dist = range * (0.4 + Math.random() * 0.4);
      const sx = cx + Math.cos(a) * dist * 0.5, sy = cy + Math.sin(a) * dist * 0.5;
      const g = scene.add.graphics().setDepth(72);
      g.lineStyle(2, WHITE, 0.9);
      g.lineBetween(sx - 4, sy, sx + 4, sy); g.lineBetween(sx, sy - 4, sx, sy + 4);
      g.lineBetween(sx - 3, sy - 3, sx + 3, sy + 3); g.lineBetween(sx - 3, sy + 3, sx + 3, sy - 3);
      if (T) T.add({ targets: g, x: Math.cos(a) * dist * 0.5, y: Math.sin(a) * dist * 0.5, alpha: 0, duration: 500 + Math.random() * 200, onComplete: () => { try { g.destroy(); } catch (e) {} } });
      else scene.time.delayedCall(720, () => { try { g.destroy(); } catch (e) {} });
    }
    if (window.particleFactory) { try { window.particleFactory.abilityTrail(cx, cy, ICE); } catch (e) {} }
  } catch (e) { /* visual only */ }

  breakDestructiblesInRange(scene, range);
  forEachEnemyInRange(range, (enemy) => {
    if (!enemy || !enemy.active) return;
    // Schaden gesenkt (war 0.6 -> 0.32): Frostnova ist primär Kontrolle/Slow.
    const { isCrit } = dealDamageToEnemy(scene, enemy, 0.32 * totalMult, 'frostNova');
    handleEnemyHit(scene, enemy, { tint: isCrit ? 0xfff2a6 : ICE, duration: isCrit ? 180 : 130 });
    if (window.particleFactory) { try { window.particleFactory.hitSpark(enemy.x, enemy.y); } catch (e) {} }
    if (window.statusEffectManager && window.StatusEffectType && enemy.active) {
      try { window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.SLOW, 'frostNova'); } catch (e) {}
    }
  });
}

window.castTwistingBlades = castTwistingBlades;
window.castSteelGrasp = castSteelGrasp;
window.castCycloneStrike = castCycloneStrike;
window.castFrostNova = castFrostNova;

// --- whirlwind (Wirbelwind) — "Buzzsaw" ---------------------------------
// 060: CHANNEL (~1s), der Spieler wirbelt + bewegt sich frei (der Wirbel folgt)
// und trifft alle in Reichweite mehrfach + Slow. OPTIK: zwei gegenläufige
// Klingenscheiben (innen CW, außen CCW) mit Motion-Blur-Trails, Spin-up mit
// Overshoot, Kantenglanz, Funken + Mini-Screenshake bei Treffern.
// Schaden skaliert mit Rang; Cooldown via tryActivate. Damage-Key 'whirlwind'.
function castWhirlwind() {
  const scene = this;
  if (!scene || !player || !player.active) return;
  const dmgMult = (window.SkillTree && window.SkillTree.getAbilityDamageMult)
    ? window.SkillTree.getAbilityDamageMult('whirlwind') : 1;
  const rank = (window.SkillTree && window.SkillTree.getRank)
    ? Math.max(1, window.SkillTree.getRank('whirlwind') | 0) : 1;
  // Kompakter als der alte Spin (war zu groß): ~60% der Spin-Reichweite, für
  // Visual UND Schaden konsistent.
  const range = ((typeof getSpinRange === 'function') ? getSpinRange() : 110) * 0.6;
  const durationMs = 850 + (rank - 1) * 110;   // 0.85s .. 1.3s
  const tickMs = 120;
  const tickCount = Math.max(1, Math.floor(durationMs / tickMs));
  const perTick = 0.32 * dmgMult;
  // Rang -> mehr Klingen pro Scheibe (dichteres Sägeblatt).
  const outerBlades = 7 + Math.min(4, rank - 1);   // 7..11
  const innerBlades = 4 + Math.min(3, rank - 1);    // 4..7
  const STEEL = 0x33e0ff, GLINT = 0xffffff;
  if (window.soundManager) { try { window.soundManager.playSFX('ability_spin'); } catch (e) {} }

  // easeOutBack für den "Deploy"-Overshoot beim Hochdrehen.
  const easeBack = (t) => { const c1 = 1.9, c3 = c1 + 1; const u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; };

  const gfx = scene.add.graphics().setDepth(69);
  let angle = 0;
  let elapsed = 0;
  // Eine rotierende Klingenscheibe mit Motion-Blur-Trail zeichnen.
  const drawDisc = (baseA, dir, count, rInner, rOuter, width, alpha, glint) => {
    const GHOSTS = 4;
    for (let b = 0; b < count; b++) {
      const a0 = baseA * dir + b * (Math.PI * 2 / count);
      for (let g = GHOSTS; g >= 0; g--) {
        const a = a0 - dir * g * 0.10;                 // Trail läuft der Klinge hinterher
        const ga = alpha * (g === 0 ? 1 : 0.32 * (1 - g / (GHOSTS + 1)));
        if (ga <= 0.02) continue;
        gfx.lineStyle(g === 0 ? width : Math.max(1, width - 1), STEEL, ga);
        gfx.lineBetween(
          player.x + Math.cos(a) * rInner, player.y + Math.sin(a) * rInner,
          player.x + Math.cos(a) * rOuter, player.y + Math.sin(a) * rOuter);
      }
      if (glint) {                                      // weißer Kantenglanz an der Spitze
        const ax = player.x + Math.cos(a0) * rOuter, ay = player.y + Math.sin(a0) * rOuter;
        gfx.fillStyle(GLINT, alpha * 0.9);
        gfx.fillCircle(ax, ay, Math.max(1.5, width * 0.6));
      }
    }
  };

  const spinTimer = scene.time.addEvent({ delay: 16, loop: true, callback: () => {
    if (!player || !player.active) { try { gfx.destroy(); } catch (e) {} spinTimer.remove(); return; }
    elapsed += 16;
    const up = Math.min(1, elapsed / 240);                         // Hochdrehen 0..240ms
    const down = elapsed > durationMs - 160 ? Math.max(0, (durationMs - elapsed) / 160) : 1;
    const factor = Math.max(0, easeBack(up) * down);               // Radius/Alpha (mit Overshoot)
    const aFac = Math.min(1, up) * down;                           // Alpha ohne Overshoot
    angle += 0.22 + 0.42 * Math.min(1, up);                       // Drehung rampt hoch
    const r = range * factor;
    gfx.clear();
    // schwacher Disc-Glow + zwei Ringe für die Scheibenkontur
    gfx.fillStyle(STEEL, 0.06 * aFac); gfx.fillCircle(player.x, player.y, r);
    gfx.lineStyle(2, 0x66f0ff, 0.30 * aFac); gfx.strokeCircle(player.x, player.y, r);
    gfx.lineStyle(1, 0x66f0ff, 0.22 * aFac); gfx.strokeCircle(player.x, player.y, r * 0.42);
    // äußere Scheibe (CCW) + innere Scheibe (CW, gegenläufig)
    drawDisc(angle,  1, outerBlades, r * 0.66, r,        3.5, 0.9 * aFac, true);
    drawDisc(angle, -1, innerBlades, r * 0.12, r * 0.45, 3,   0.85 * aFac, false);
  }});
  if (window.particleFactory) { try { window.particleFactory.abilityTrail(player.x, player.y, STEEL); } catch (e) {} }

  // Schadens-Ticks: treffen alle in Reichweite, folgen dem (beweglichen) Spieler.
  scene.time.addEvent({ delay: tickMs, repeat: tickCount - 1, callback: () => {
    if (!player || !player.active) return;
    let hitThisTick = 0;
    // Pro Tick — Props sind nach dem ersten weg, der Rest laeuft ins Leere.
    breakDestructiblesInRange(scene, range);
    forEachEnemyInRange(range, (enemy) => {
      if (!enemy || !enemy.active) return;
      hitThisTick++;
      const { isCrit } = dealDamageToEnemy(scene, enemy, perTick, 'whirlwind');
      // Funken in Klingen-Tangenten-Richtung (2 kleine Bursts).
      if (window.particleFactory) {
        try {
          window.particleFactory.hitSpark(enemy.x, enemy.y);
          window.particleFactory.hitSpark(enemy.x + (Math.random() - 0.5) * 14, enemy.y + (Math.random() - 0.5) * 14);
        } catch (e) {}
      }
      handleEnemyHit(scene, enemy, { tint: isCrit ? 0xfff2a6 : GLINT, duration: 60, useTween: true });
      if (window.statusEffectManager && window.StatusEffectType) {
        try { window.statusEffectManager.applyEffect(enemy, window.StatusEffectType.SLOW, 'whirlwind'); } catch (e) {}
      }
    });
    // Mini-Screenshake, wenn das Sägeblatt mehrere Gegner gleichzeitig erwischt.
    if (hitThisTick >= 2 && scene.cameras && scene.cameras.main) {
      try { scene.cameras.main.shake(70, 0.0028); } catch (e) {}
    }
  }});

  scene.time.delayedCall(durationMs, () => { try { gfx.destroy(); } catch (e) {} try { spinTimer.remove(); } catch (e) {} });
}
window.castWhirlwind = castWhirlwind;
