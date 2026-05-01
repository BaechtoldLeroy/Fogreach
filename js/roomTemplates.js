// roomTemplates.js
(function(w) {
  // 1) Globales Objekt sicherstellen
  if (!w.RoomTemplates) w.RoomTemplates = {};
  var RT = w.RoomTemplates;

  // 2) Manifest definieren – Namen müssen exakt den JSON-Dateien unter /roomTemplates/ entsprechen
  if (!Array.isArray(RT.MANIFEST)) {
    RT.MANIFEST = [
      'ArmoryVault',
      'CollapsingHall',
      'DungeonLibrary',
      'PrisonCells',
      'RitualChamber',
      'SewageTunnel',
      'RathausArchive',
      'RitualVault',
      'PrisonDepths',
      'CouncilChamber',
      'ForgottenCrypt'
    ];
  }
})(window);

// ========== Room Theme System ==========
const ROOM_THEMES = {
  'Crypt_Small_Altar': { floor: 'floor_stone_dark', wall: 'wall_dungeon' },
  'Cathedral':         { floor: 'floor_tile_ornate', wall: 'wall_stone_large' },
  'ThroneRoom':        { floor: 'floor_tile_ornate', wall: 'wall_stone_large' },
  'DungeonLibrary':    { floor: 'floor_tile_ornate', wall: 'wall_stone_large' },
  'TreasureVault':     { floor: 'floor_cobble', wall: 'wall_brick' },
  'Treasure_Small':    { floor: 'floor_cobble', wall: 'wall_brick' },
  'GrandBazaar':       { floor: 'floor_cobble', wall: 'wall_brick' },
  'RathausArchive':    { floor: 'floor_tile_ornate', wall: 'wall_stone_large' },
  'RitualVault':       { floor: 'floor_stone_dark', wall: 'wall_dungeon' },
  'PrisonDepths':      { floor: 'floor_stone_dark', wall: 'wall_brick' },
  'CouncilChamber':    { floor: 'floor_tile_ornate', wall: 'wall_stone_large' },
  'ForgottenCrypt':    { floor: 'floor_cobble', wall: 'wall_dungeon' },
  '_default':          { floor: 'floor_stone', wall: 'obstacleWall' }
};

function getRoomTheme(templateName) {
  if (templateName && ROOM_THEMES[templateName]) return ROOM_THEMES[templateName];
  return ROOM_THEMES['_default'];
}

const _MISSING_TEXTURE_WARNINGS = new Set();
let FLOOR_BAKE_COUNTER = 0;
const AUTO_OBSTACLE_TILE_KEYS = new Set([
  'pillar_small',
  'pillar_large',
  'pillar',
  'altar',
  'brazer',
  'brazier',
  'statue'
]);

function warnMissingTexture(scene, key, context = '') {
  if (!key) return false;
  const textures = scene?.textures;
  const exists = textures?.exists?.(key);
  if (exists) return true;
  const token = `${key}:${context}`;
  if (_MISSING_TEXTURE_WARNINGS.has(token)) return;
  _MISSING_TEXTURE_WARNINGS.add(token);
  console.warn(`[RoomTemplates] Missing texture '${key}'${context ? ` (${context})` : ''}`);
  return false;
}

function getFallbackTexture(key) {
  if (!key) return 'obstacleWall';
  if (typeof key === 'string' && key.toLowerCase().startsWith('chest')) {
    if (obstacles?.scene?.textures?.exists?.('chest_small')) return 'chest_small';
    if (obstacles?.scene?.textures?.exists?.('crate')) return 'crate';
    return 'obstacleWall';
  }
  return 'obstacleWall';
}

// ========== Hilfsfunktionen ==========

// Grid-Koordinaten → Pixel
function gx(tpl, x) { return x * tpl.size.tile; }
function gy(tpl, y) { return y * tpl.size.tile; }

/**
 * @typedef {Object} RoomTemplate
 * @property {string} name
 * @property {{ tile: number, w: number, h: number }} size
 * @property {{ legend: Object<string,string>, walls: string[] }} layout
 * @property {{ floor?: string }} [tiles]
 * @property {Array<{ x: number, y: number, dir?: string }>} [entrances]
 * @property {Array<{ type: string, x: number, y: number }>} [objects]
 * @property {{
 *   player?: { x: number, y: number },
 *   enemies?: Array<{ type: number, x: number, y: number, count?: number, radius?: number }>,
 *   loot?: Array<{ x: number, y: number, type: string, locked?: boolean }>
 * }} [spawns]
 * @property {{ difficulty?: number, lights?: any[] }} [rules]
 */

/**
 * Render a room template into the given Phaser scene at world origin (originX, originY).
 * Spawns walls, decorative objects, enemies (respecting safe distance from
 * player spawn), loot, lights, and the protected-tile set used to keep
 * spawn/entrance/loot tiles obstacle-free.
 *
 * @param {Phaser.Scene} scene
 * @param {RoomTemplate} tpl
 * @param {number} [originX=0]
 * @param {number} [originY=0]
 */
function applyRoomTemplate(scene, tpl, originX = 0, originY = 0) {
  const ox = originX, oy = originY;
  const T = tpl.size.tile;
  const templateWalls = scene._templateWalls = scene._templateWalls || [];

  const H = tpl.layout.walls.length;
  const W = tpl.layout.walls[0].length;
  const wallsGrid = tpl.layout?.walls || [];

  // Store walls grid on the scene for minimap access
  scene._minimapWallsGrid = wallsGrid;
  scene._minimapTileSize = T;
  scene._minimapGridW = W;
  scene._minimapGridH = H;

  const profile = !!window.__DEV_ROOM_PROFILING__;
  const skipFloorTiles = !!window.__DEV_SKIP_FLOOR_TILES__;
  const skipWallObstacles = !!window.__DEV_SKIP_WALL_OBSTACLES__;
  const originalSize = tpl.meta?.originalSize || tpl.size || { w: W, h: H };
  const isLargeRoom =
    !!tpl.meta?.isLarge ||
    ((originalSize.w || W) >= 80 && (originalSize.h || H) >= 80);
  const spawnMultiplier = isLargeRoom ? 3 : 1;
  const tStart = profile ? performance.now() : 0;
  let floorCount = 0;
  let wallCount = 0;
  let objectCount = 0;
  let enemyCount = 0;

  const keyFor = (tx, ty) => `${tx}|${ty}`;
  const blockedTilesByObjects = new Set();
  (tpl.objects || []).forEach((obj) => {
    if (!obj) return;
    const tx = Math.round(obj.x ?? 0);
    const ty = Math.round(obj.y ?? 0);
    if (Number.isFinite(tx) && Number.isFinite(ty)) {
      blockedTilesByObjects.add(keyFor(tx, ty));
    }
  });

  // Protected tiles — never spawn an obstacle here, no matter where the
  // template tries to put one. Covers player spawn, every entrance, and a
  // 1-tile buffer so the player can step away from doorways.
  const protectedTiles = new Set();
  const protect = (tx, ty, radius = 1) => {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        protectedTiles.add(keyFor(Math.round(tx) + dx, Math.round(ty) + dy));
      }
    }
  };
  if (tpl.spawns?.player) protect(tpl.spawns.player.x, tpl.spawns.player.y, 1);
  (tpl.entrances || []).forEach((e) => protect(e.x, e.y, 1));
  // Loot must remain reachable too — protect with 0 radius (just the tile itself)
  (tpl.spawns?.loot || []).forEach((l) => protect(l.x, l.y, 0));
  const isWalkableTile = (tx, ty) =>
    tx >= 0 &&
    tx < W &&
    ty >= 0 &&
    ty < H &&
    wallsGrid[ty] &&
    wallsGrid[ty][tx] === '.' &&
    !blockedTilesByObjects.has(keyFor(tx, ty));

  const pickWalkableTileNear = (baseX, baseY, radius = 0) => {
    const attempts = Math.max(10, radius ? Math.ceil(radius * 4) : 10);
    for (let i = 0; i < attempts; i++) {
      const offsetX = radius ? (Math.random() * 2 - 1) * radius : 0;
      const offsetY = radius ? (Math.random() * 2 - 1) * radius : 0;
      const trialX = baseX + offsetX;
      const trialY = baseY + offsetY;
      const tileX = Math.round(trialX);
      const tileY = Math.round(trialY);
      if (isWalkableTile(tileX, tileY)) {
        return { x: tileX, y: tileY };
      }
    }

    const startX = Math.round(baseX);
    const startY = Math.round(baseY);
    const visited = new Set();
    const queue = [{ x: startX, y: startY, dist: 0 }];
    const maxSearch = Math.max(12, radius ? Math.ceil(radius * 3) : 12);

    while (queue.length) {
      const { x: tileX, y: tileY, dist } = queue.shift();
      const key = `${tileX},${tileY}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (isWalkableTile(tileX, tileY)) {
        return { x: tileX, y: tileY };
      }

      if (dist >= maxSearch) continue;

      const neighbors = [
        { x: tileX + 1, y: tileY },
        { x: tileX - 1, y: tileY },
        { x: tileX, y: tileY + 1 },
        { x: tileX, y: tileY - 1 }
      ];
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < W && n.y >= 0 && n.y < H) {
          queue.push({ x: n.x, y: n.y, dist: dist + 1 });
        }
      }
    }

    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (isWalkableTile(tx, ty)) {
          return { x: tx, y: ty };
        }
      }
    }

    return { x: Math.max(1, Math.min(W - 2, startX)), y: Math.max(1, Math.min(H - 2, startY)) };
  };

  const computeAccessibleTiles = (startTile) => {
    if (!startTile) return null;
    const visited = new Set();
    const queue = [startTile];
    visited.add(keyFor(startTile.x, startTile.y));

    while (queue.length) {
      const { x, y } = queue.shift();
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];
      for (const n of neighbors) {
        const nKey = keyFor(n.x, n.y);
        if (visited.has(nKey)) continue;
        if (!isWalkableTile(n.x, n.y)) continue;
        visited.add(nKey);
        queue.push(n);
      }
    }

    return visited;
  };

  const playerSpawnSpec = tpl.spawns?.player || null;
  const playerStartTile = playerSpawnSpec
    ? pickWalkableTileNear(playerSpawnSpec.x, playerSpawnSpec.y, 0)
    : null;
  const accessibleTiles = computeAccessibleTiles(playerStartTile);

  const findAccessibleTileNear = (baseX, baseY, radius = 0) => {
    const primary = pickWalkableTileNear(baseX, baseY, radius);
    if (!accessibleTiles || !primary) return primary;

    const primaryKey = keyFor(primary.x, primary.y);
    if (accessibleTiles.has(primaryKey)) return primary;

    let bestTile = null;
    let bestDist = Infinity;
    accessibleTiles.forEach((key) => {
      const [tx, ty] = key.split('|').map(Number);
      const dx = tx - baseX;
      const dy = ty - baseY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestTile = { x: tx, y: ty };
      }
    });

    return bestTile || primary;
  };

  // Preload textures once — apply room theme based on template name
  const roomTheme = getRoomTheme(tpl.name);

  let floorKey = tpl.tiles?.floor || roomTheme.floor || 'floor_stone';
  if (!warnMissingTexture(scene, floorKey, 'floor tile')) {
    floorKey = 'floor_stone';
  }
  if (!warnMissingTexture(scene, floorKey, 'floor fallback')) {
    floorKey = null;
  }

  // Prefer wall texture from legend (procedural rooms set this per theme),
  // fallback to roomTheme, then obstacleWall.
  const legendWall = tpl.layout?.legend?.['#'];
  const legendWallIsTex = typeof legendWall === 'string' && legendWall.startsWith('wall_');
  let wallTexture = (legendWallIsTex ? legendWall : null) || roomTheme.wall || 'obstacleWall';
  if (!warnMissingTexture(scene, wallTexture, 'wall tile')) {
    wallTexture = 'obstacleWall';
    if (!warnMissingTexture(scene, wallTexture, 'wall fallback')) {
      wallTexture = getFallbackTexture(wallTexture);
      if (!warnMissingTexture(scene, wallTexture, 'wall fallback2')) {
        wallTexture = null;
      }
    }
  }

  const wallRects = [];
  const activeWallSpans = new Map();

  for (let y = 0; y < H; y++) {
    const row = tpl.layout.walls[y];
    const spansInRow = new Set();
    let x = 0;
    while (x < W) {
      const ch = row[x];
      const key = tpl.layout.legend[ch];
      if (!key) {
        x++;
        continue;
      }

      const isWallKey = (k) => k === 'wall' || k === 'obstacleWall' || (typeof k === 'string' && k.startsWith('wall_'));
      if (isWallKey(key)) {
        const start = x;
        while (x + 1 < W) {
          const nextKey = tpl.layout.legend[row[x + 1]];
          if (isWallKey(nextKey)) {
            x++;
          } else {
            break;
          }
        }
        const length = x - start + 1;
        const spanKey = `${start}|${length}`;
        spansInRow.add(spanKey);
        const existing = activeWallSpans.get(spanKey);
        if (existing) {
          existing.height += 1;
        } else {
          activeWallSpans.set(spanKey, { x: start, y, width: length, height: 1 });
        }
        wallCount += length;
      } else {
        floorCount++;
        // Skip auto-obstacles on protected tiles (spawn / entrances)
        if (AUTO_OBSTACLE_TILE_KEYS.has(key) && scene.spawnObstacle && !protectedTiles.has(keyFor(x, y))) {
          const obstacleX = ox + x * T + T / 2;
          const obstacleY = oy + y * T + T / 2;

          // Drop shadow under auto-obstacle
          if (scene.add?.graphics) {
            const shadowGfx = scene.add.graphics();
            shadowGfx.fillStyle(0x000000, 0.25);
            shadowGfx.fillEllipse(obstacleX, obstacleY + T * 0.35, T * 0.7, T * 0.25);
            shadowGfx.setDepth(38);
            templateWalls.push(shadowGfx);
          }

          // Ambient glow for braziers in grid
          if ((key === 'brazier' || key === 'brazer') && scene.add?.graphics) {
            const glowGfx = scene.add.graphics();
            glowGfx.fillStyle(0xff8800, 0.06);
            glowGfx.fillCircle(obstacleX, obstacleY, 80);
            glowGfx.fillStyle(0xffaa00, 0.1);
            glowGfx.fillCircle(obstacleX, obstacleY, 64);
            glowGfx.fillStyle(0xffcc33, 0.2);
            glowGfx.fillCircle(obstacleX, obstacleY, 40);
            glowGfx.fillStyle(0xffdd44, 0.12);
            glowGfx.fillCircle(obstacleX, obstacleY, 24);
            glowGfx.setDepth(-3);
            templateWalls.push(glowGfx);
          }

          // Check clearance: only spawn as physics obstacle if 2+ tiles from any wall
          let autoTooClose = false;
          const isBraz = key === 'brazier' || key === 'brazer';
          if (!isBraz) {
            for (let cdy = -2; cdy <= 2 && !autoTooClose; cdy++) {
              for (let cdx = -2; cdx <= 2 && !autoTooClose; cdx++) {
                if (cdx === 0 && cdy === 0) continue;
                const cx = x + cdx, cy = y + cdy;
                if (cy >= 0 && cy < H && cx >= 0 && cx < W && wallsGrid[cy]?.[cx] === '#') autoTooClose = true;
              }
            }
          }
          if (!autoTooClose) {
            scene.spawnObstacle(obstacleX, obstacleY, key);
          } else {
            // Visual only, no physics
            if (scene.textures?.exists(key)) {
              const vis = scene.add.image(obstacleX, obstacleY, key).setDepth(40).setAlpha(0.7);
              templateWalls.push(vis);
            }
          }
        }
      }
      x++;
    }

    for (const [keySpan, rect] of Array.from(activeWallSpans.entries())) {
      if (!spansInRow.has(keySpan)) {
        wallRects.push(rect);
        activeWallSpans.delete(keySpan);
      }
    }
  }

  for (const rect of activeWallSpans.values()) {
    wallRects.push(rect);
  }

  // Compute depth tint based on currentWave — more aggressive coloring
  const wave = typeof window.currentWave === 'number' ? window.currentWave : 0;
  let depthTint = null;
  if (wave >= 16) {
    depthTint = 0xaab0dd;   // very dark cool
  } else if (wave >= 9) {
    depthTint = 0xd0d8ff;   // cool tone
  } else if (wave >= 4) {
    depthTint = null;        // neutral — no tint
  } else if (wave >= 1) {
    depthTint = 0xffe8d0;   // warm tone
  }
  // Cosmetic theme tints override depth tint for procedural rooms (030-large-room-variety)
  let floorTint = depthTint;
  let wallTint = depthTint;
  if (tpl.theme) {
    if (tpl.theme.floorTint && tpl.theme.floorTint !== 0xffffff) floorTint = tpl.theme.floorTint;
    if (tpl.theme.wallTint && tpl.theme.wallTint !== 0xffffff) wallTint = tpl.theme.wallTint;
  }

  if (!skipFloorTiles && floorKey && scene.textures && scene.textures.get(floorKey)) {
    // Workaround: Phaser 3 TileSprite created from a canvas-generated texture
    // (graphics.generateTexture('floor_stone', 32, 32)) silently produces a
    // sprite with texture.key === null that renders as transparent.
    //
    // Solution: pre-bake the floor by drawing the source canvas tile into a
    // LARGER canvas via the native canvas 2D API (hundreds of times faster
    // than 6400 rt.draw() calls), then register that as a Phaser texture and
    // display it as a single Image. ~50ms instead of ~60 seconds per room.
    const floorWPx = W * T;
    const floorHPx = H * T;
    const sourceTex = scene.textures.get(floorKey);
    const sourceImg = sourceTex && sourceTex.source && sourceTex.source[0]
      ? sourceTex.source[0].image
      : null;
    if (sourceImg) {
      const bakedCanvas = document.createElement('canvas');
      bakedCanvas.width = floorWPx;
      bakedCanvas.height = floorHPx;
      const ctx = bakedCanvas.getContext('2d');
      // Disable smoothing so the procedural pixel art tiles cleanly
      ctx.imageSmoothingEnabled = false;
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          ctx.drawImage(sourceImg, tx * T, ty * T);
        }
      }
      // Register the baked canvas as a unique Phaser texture for this room
      const bakedKey = '__floor_baked_' + (++FLOOR_BAKE_COUNTER);
      try { scene.textures.removeKey(bakedKey); } catch (e) { /* fresh key */ }
      scene.textures.addCanvas(bakedKey, bakedCanvas);
      const floorImg = scene.add.image(ox, oy, bakedKey).setOrigin(0, 0);
      floorImg.setDepth(-5);
      // Tag as floor so the stair-placement fallback in roomManager doesn't
      // mistake the giant 2560x2560 floor image for an obstacle and destroy it.
      floorImg.setData('isFloor', true);
      if (floorTint) floorImg.setTint(floorTint);
      templateWalls.push(floorImg);
      // Track baked texture key so we can remove it on cleanup
      scene._bakedFloorKeys = scene._bakedFloorKeys || [];
      scene._bakedFloorKeys.push(bakedKey);
    }

    // Scatter 8-12 random "detail tiles" to break up tiling repetition
    if (scene.add?.graphics) {
      const scatterCount = Phaser.Math.Between(8, 12);
      for (let si = 0; si < scatterCount; si++) {
        const stx = Phaser.Math.Between(2, W - 3);
        const sty = Phaser.Math.Between(2, H - 3);
        if (isWalkableTile(stx, sty)) {
          const spx = ox + stx * T + T / 2;
          const spy = oy + sty * T + T / 2;
          const detGfx = scene.add.graphics();
          const kind = Math.random();
          if (kind < 0.35) {
            detGfx.fillStyle(0x000000, 0.1 + Math.random() * 0.15);
            detGfx.fillCircle(spx, spy, 3 + Math.random() * 4);
          } else if (kind < 0.65) {
            detGfx.fillStyle(0xffffff, 0.05 + Math.random() * 0.1);
            detGfx.fillCircle(spx, spy, 2 + Math.random() * 5);
          } else {
            detGfx.lineStyle(1, 0x000000, 0.1 + Math.random() * 0.15);
            detGfx.beginPath();
            detGfx.moveTo(spx - 4, spy);
            detGfx.lineTo(spx + 2, spy + 4);
            detGfx.lineTo(spx + 6, spy + 2);
            detGfx.strokePath();
          }
          detGfx.setDepth(-4);
          templateWalls.push(detGfx);
        }
      }
    }
  }

  const canRenderWalls = !!(wallTexture && scene.add?.tileSprite);
  wallRects.forEach(rect => {
    const widthPx = rect.width * T;
    const heightPx = rect.height * T;
    const cx = ox + rect.x * T + widthPx / 2;
    const cy = oy + rect.y * T + heightPx / 2;

    if (canRenderWalls) {
      const sprite = scene.add.tileSprite(cx, cy, widthPx, heightPx, wallTexture);
      sprite.setOrigin(0.5);
      sprite.setDepth(39);
      if (wallTint) sprite.setTint(wallTint);
      templateWalls.push(sprite);
    }

    // Inner shadow border — 2px dark edge where wall meets floor
    if (scene.add?.graphics) {
      const shadowGfx = scene.add.graphics();
      shadowGfx.fillStyle(0x000000, 0.3);
      const wx0 = ox + rect.x * T;
      const wy0 = oy + rect.y * T;
      // Bottom edge shadow (most visible — floor is below)
      if (rect.y + rect.height < H) {
        shadowGfx.fillRect(wx0, wy0 + heightPx, widthPx, 2);
      }
      // Right edge shadow
      if (rect.x + rect.width < W) {
        shadowGfx.fillRect(wx0 + widthPx, wy0, 2, heightPx);
      }
      // Top edge shadow (lighter)
      if (rect.y > 0) {
        shadowGfx.fillStyle(0x000000, 0.15);
        shadowGfx.fillRect(wx0, wy0 - 2, widthPx, 2);
      }
      // Left edge shadow (lighter)
      if (rect.x > 0) {
        shadowGfx.fillStyle(0x000000, 0.15);
        shadowGfx.fillRect(wx0 - 2, wy0, 2, heightPx);
      }
      shadowGfx.setDepth(39);
      templateWalls.push(shadowGfx);

      // Random damage marks on some wall spans
      if (widthPx > T * 2 && Math.random() < 0.4) {
        const dmgGfx = scene.add.graphics();
        dmgGfx.fillStyle(0x000000, 0.15);
        const dmgX = wx0 + Phaser.Math.Between(T, widthPx - T);
        const dmgY = wy0 + Phaser.Math.Between(2, heightPx - 6);
        dmgGfx.fillRect(dmgX, dmgY, Phaser.Math.Between(4, 10), Phaser.Math.Between(2, 4));
        dmgGfx.setDepth(39);
        templateWalls.push(dmgGfx);
      }
    }

    if (!skipWallObstacles) {
      spawnWallRect(cx, cy, widthPx, heightPx, wallTexture || undefined);
    }
  });

  // Atmospheric elements: drop shadows, brazier glow, floor details, cobwebs, vignette
  if (scene.add?.graphics) {
    // Random floor details (cracks & stains) — scatter 10-15 per room
    const detailCount = Phaser.Math.Between(10, 15);
    for (let i = 0; i < detailCount; i++) {
      const dtx = Phaser.Math.Between(2, W - 3);
      const dty = Phaser.Math.Between(2, H - 3);
      if (isWalkableTile(dtx, dty)) {
        const dpx = ox + dtx * T + T / 2;
        const dpy = oy + dty * T + T / 2;
        const detailKey = Math.random() < 0.5 ? 'floor_crack' : 'floor_stain';
        if (scene.textures?.exists?.(detailKey)) {
          const detail = scene.add.image(dpx, dpy, detailKey);
          detail.setDepth(-4);
          detail.setAlpha(0.3 + Math.random() * 0.3);
          if (detailKey === 'floor_crack') detail.setAngle(Math.random() * 360);
          templateWalls.push(detail);
        }
      }
    }

    // Cobweb sprites in corners (where two walls meet at 90 degrees)
    if (scene.textures?.exists?.('cobweb')) {
      // Check corner positions for wall adjacency
      const cornerChecks = [
        { tx: 1, ty: 1, angle: 0 },         // top-left
        { tx: W - 2, ty: 1, angle: 90 },     // top-right
        { tx: W - 2, ty: H - 2, angle: 180 },// bottom-right
        { tx: 1, ty: H - 2, angle: 270 }     // bottom-left
      ];
      // Also check interior corners where wall openings create L-shapes
      for (let cy2 = 2; cy2 < H - 2; cy2++) {
        for (let cx2 = 2; cx2 < W - 2; cx2++) {
          if (!isWalkableTile(cx2, cy2)) continue;
          // Check if this is an interior corner (wall above and wall to left)
          const wallAbove = cy2 > 0 && wallsGrid[cy2 - 1] && wallsGrid[cy2 - 1][cx2] !== '.';
          const wallLeft = cx2 > 0 && wallsGrid[cy2] && wallsGrid[cy2][cx2 - 1] !== '.';
          const wallRight = cx2 < W - 1 && wallsGrid[cy2] && wallsGrid[cy2][cx2 + 1] !== '.';
          const wallBelow = cy2 < H - 1 && wallsGrid[cy2 + 1] && wallsGrid[cy2 + 1][cx2] !== '.';
          if (wallAbove && wallLeft && Math.random() < 0.3) {
            cornerChecks.push({ tx: cx2, ty: cy2, angle: 0 });
          } else if (wallAbove && wallRight && Math.random() < 0.3) {
            cornerChecks.push({ tx: cx2, ty: cy2, angle: 90 });
          } else if (wallBelow && wallRight && Math.random() < 0.3) {
            cornerChecks.push({ tx: cx2, ty: cy2, angle: 180 });
          } else if (wallBelow && wallLeft && Math.random() < 0.3) {
            cornerChecks.push({ tx: cx2, ty: cy2, angle: 270 });
          }
        }
      }
      // Place cobwebs (limit to avoid spam)
      let cobwebCount = 0;
      for (const cc of cornerChecks) {
        if (cobwebCount >= 8) break;
        if (Math.random() < 0.6) {
          const cpx = ox + cc.tx * T + T / 2;
          const cpy = oy + cc.ty * T + T / 2;
          const web = scene.add.image(cpx, cpy, 'cobweb');
          web.setDepth(-3);
          web.setAlpha(0.3 + Math.random() * 0.3);
          web.setAngle(cc.angle);
          templateWalls.push(web);
          cobwebCount++;
        }
      }
    }

    // Dark vignette along room edges — subtle darkness near walls
    const vigGfx = scene.add.graphics();
    vigGfx.fillStyle(0x000000, 0.1);
    // Top edge
    vigGfx.fillRect(ox, oy, W * T, T);
    // Bottom edge
    vigGfx.fillRect(ox, oy + (H - 1) * T, W * T, T);
    // Left edge
    vigGfx.fillRect(ox, oy, T, H * T);
    // Right edge
    vigGfx.fillRect(ox + (W - 1) * T, oy, T, H * T);
    // Softer second layer
    vigGfx.fillStyle(0x000000, 0.05);
    vigGfx.fillRect(ox + T, oy, (W - 2) * T, T);
    vigGfx.fillRect(ox + T, oy + (H - 2) * T, (W - 2) * T, T);
    vigGfx.fillRect(ox, oy + T, T, (H - 2) * T);
    vigGfx.fillRect(ox + (W - 2) * T, oy + T, T, (H - 2) * T);
    vigGfx.setDepth(-3);
    templateWalls.push(vigGfx);
  }

  // Objekte with drop shadows and brazier glow
  tpl.objects?.forEach(o => {
    // Skip object placement entirely if it would land on a protected tile
    // (player spawn, entrance, or 1-tile buffer around them).
    const objTx = Math.round(o.x ?? 0);
    const objTy = Math.round(o.y ?? 0);
    if (protectedTiles.has(keyFor(objTx, objTy))) {
      return;
    }
    const px = ox + gx(tpl, o.x) + T / 2;
    const py = oy + gy(tpl, o.y) + T / 2;
    const typeKey = o.type;
    if (!warnMissingTexture(scene, typeKey, 'object')) {
      const fallback = getFallbackTexture(typeKey);
      warnMissingTexture(scene, fallback, 'object fallback');
      o.type = fallback;
    }

    // Drop shadow under obstacle
    if (scene.add?.graphics) {
      const shadowGfx = scene.add.graphics();
      shadowGfx.fillStyle(0x000000, 0.25);
      shadowGfx.fillEllipse(px, py + T * 0.35, T * 0.7, T * 0.25);
      shadowGfx.setDepth(38);
      templateWalls.push(shadowGfx);
    }

    // Ambient glow for braziers — large, warm, and visible
    if ((o.type === 'brazier' || o.type === 'brazer') && scene.add?.graphics) {
      const glowGfx = scene.add.graphics();
      glowGfx.fillStyle(0xff8800, 0.06);
      glowGfx.fillCircle(px, py, 80);
      glowGfx.fillStyle(0xffaa00, 0.1);
      glowGfx.fillCircle(px, py, 64);
      glowGfx.fillStyle(0xffcc33, 0.2);
      glowGfx.fillCircle(px, py, 40);
      glowGfx.fillStyle(0xffdd44, 0.12);
      glowGfx.fillCircle(px, py, 24);
      glowGfx.setDepth(-3);
      templateWalls.push(glowGfx);
    }

    // Check if object has enough clearance from walls (at least 2 tiles)
    // Player body is 34x56px, objects are 32x32. Need 2+ tiles gap.
    const isBrazier = o.type === 'brazier' || o.type === 'brazer';
    const isRubble = o.type === 'rubble';
    const tileX = Math.floor(o.x), tileY = Math.floor(o.y);
    let tooClose = false;
    if (!isBrazier && !isRubble && wallsGrid) {
      // Check 2-tile radius for walls
      for (let dy = -2; dy <= 2 && !tooClose; dy++) {
        for (let dx = -2; dx <= 2 && !tooClose; dx++) {
          if (dx === 0 && dy === 0) continue;
          const cx = tileX + dx, cy = tileY + dy;
          if (cy >= 0 && cy < wallsGrid.length && cx >= 0 && cx < (wallsGrid[cy]?.length || 0)) {
            if (wallsGrid[cy][cx] === '#') tooClose = true;
          }
        }
      }
    }

    if (!tooClose || isBrazier) {
      scene.spawnObstacle(px, py, o.type);
    } else {
      // Place visually only (no collision blocking) — but still destructible
      // if it's a chest/barrel/crate type.
      const visualKey = o.type;
      const lowerKey = String(visualKey).toLowerCase();
      const destructibleTypes = ['barrel', 'crate', 'chest_small', 'chest_medium', 'chest_large', 'rubble'];
      const isDestructible = destructibleTypes.some(t => lowerKey.startsWith(t));

      if (isDestructible) {
        // Spawn as obstacle (so destructible logic works) but flag as
        // walkable so the player can pass through.
        const o2 = scene.spawnObstacle(px, py, o.type);
        if (o2) {
          o2.setAlpha(0.7);
          o2.setData('walkthrough', true);
        }
      } else if (scene.textures?.exists(visualKey)) {
        const vis = scene.add.image(px, py, visualKey).setDepth(40).setAlpha(0.7);
        templateWalls.push(vis);
      }
    }
    objectCount++;
  });

  // Door spawns — only for procedural rooms that carry doorway data
  if (tpl._procedural) {
    (tpl.doorways || []).forEach(d => {
      const px = ox + gx(tpl, d.x) + T / 2;
      const py = oy + gy(tpl, d.y) + T / 2;
      if (window.DoorSystem?.spawnDoor) window.DoorSystem.spawnDoor(scene, px, py, d.orientation, d.width);
    });
  }

  // Decorative props — non-collidable visual detail (030-large-room-variety)
  if (tpl.decorations && tpl.decorations.length > 0) {
    if (typeof window.createPropTextures === 'function') {
      window.createPropTextures(scene);
    }
    // Mobile: cap decoration count for performance
    const isMobileProp = !!(scene.sys?.game?.device?.input?.touch);
    const maxDecorations = isMobileProp
      ? Math.min(tpl.decorations.length, Math.floor(tpl.decorations.length * 0.5))
      : tpl.decorations.length;
    for (let di = 0; di < maxDecorations; di++) {
      const d = tpl.decorations[di];
      if (!scene.textures.exists(d.type)) continue;
      const dpx = ox + gx(tpl, d.x) + T / 2;
      const dpy = oy + gy(tpl, d.y) + T / 2;
      // Subtle visual variety: randomize scale and alpha slightly
      const scaleVar = 0.85 + Math.random() * 0.3;  // 0.85–1.15
      const alphaVar = 0.55 + Math.random() * 0.25;  // 0.55–0.80
      const depthVar = d.type === 'prop_pillar' ? 41 : -2; // pillars render above floor
      const prop = scene.add.image(dpx, dpy, d.type)
        .setDepth(depthVar)
        .setAlpha(alphaVar)
        .setScale(scaleVar);
      templateWalls.push(prop);
    }
  }

  // Gegner-Spawns — enforce a minimum distance from the player spawn so
  // the player isn't ambushed on entry. If a template tries to spawn an
  // enemy too close, we relocate it to a distant accessible tile.
  const SAFE_RADIUS = 6; // tiles
  const safeRadiusSq = SAFE_RADIUS * SAFE_RADIUS;
  const spawnTileX = playerStartTile ? playerStartTile.x : null;
  const spawnTileY = playerStartTile ? playerStartTile.y : null;

  const isFarEnoughFromPlayer = (tx, ty) => {
    if (spawnTileX == null) return true;
    const dx = tx - spawnTileX;
    const dy = ty - spawnTileY;
    return dx * dx + dy * dy >= safeRadiusSq;
  };

  // Pre-compute the list of accessible tiles that are also far enough from
  // the player spawn — used as a fallback pool when a requested tile is too close.
  const distantAccessibleTiles = [];
  // Spatial bucket index: maps "bx|by" -> array of tiles in that bucket.
  // Bucket size = 4 tiles. Lookups search the home bucket + 8 neighbors (3x3),
  // turning the previous O(n) full-scan into O(k) where k is bucket density.
  const DISTANT_BUCKET_SIZE = 4;
  const distantBuckets = new Map();
  const bucketKey = (bx, by) => `${bx}|${by}`;

  if (accessibleTiles && spawnTileX != null) {
    accessibleTiles.forEach((key) => {
      const [tx, ty] = key.split('|').map(Number);
      if (isFarEnoughFromPlayer(tx, ty)) {
        const tile = { x: tx, y: ty };
        distantAccessibleTiles.push(tile);
        const bx = Math.floor(tx / DISTANT_BUCKET_SIZE);
        const by = Math.floor(ty / DISTANT_BUCKET_SIZE);
        const k = bucketKey(bx, by);
        let bucket = distantBuckets.get(k);
        if (!bucket) {
          bucket = [];
          distantBuckets.set(k, bucket);
        }
        bucket.push(tile);
      }
    });
  }

  const pickDistantTileNear = (baseX, baseY, radius = 0) => {
    // First try the template-specified location
    let chosen = findAccessibleTileNear(baseX, baseY, radius);
    if (chosen && isFarEnoughFromPlayer(chosen.x, chosen.y)) return chosen;

    // Too close — search the spatial bucket containing baseX/baseY plus its
    // 8 neighbors. Expand outward in rings of bucket-size if no nearby hit.
    if (!distantAccessibleTiles.length) return chosen; // no fallback available

    const homeBx = Math.floor(baseX / DISTANT_BUCKET_SIZE);
    const homeBy = Math.floor(baseY / DISTANT_BUCKET_SIZE);

    let best = null;
    let bestDist = Infinity;
    const checkBucket = (bx, by) => {
      const bucket = distantBuckets.get(bucketKey(bx, by));
      if (!bucket) return;
      for (let i = 0; i < bucket.length; i++) {
        const tile = bucket[i];
        const dx = tile.x - baseX;
        const dy = tile.y - baseY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = tile; }
      }
    };

    // Expand search rings until we find at least one candidate (cap at 6 rings).
    for (let ring = 0; ring <= 6 && best == null; ring++) {
      if (ring === 0) {
        checkBucket(homeBx, homeBy);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          checkBucket(homeBx + dx, homeBy + dy);
        }
      } else {
        // Just the new outer ring at distance `ring + 1`
        const r = ring + 1;
        for (let dx = -r; dx <= r; dx++) {
          checkBucket(homeBx + dx, homeBy - r);
          checkBucket(homeBx + dx, homeBy + r);
        }
        for (let dy = -r + 1; dy <= r - 1; dy++) {
          checkBucket(homeBx - r, homeBy + dy);
          checkBucket(homeBx + r, homeBy + dy);
        }
      }
    }

    // Last resort: full scan (shouldn't happen if rings cover the room)
    if (!best) {
      for (let i = 0; i < distantAccessibleTiles.length; i++) {
        const tile = distantAccessibleTiles[i];
        const dx = tile.x - baseX;
        const dy = tile.y - baseY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = tile; }
      }
    }

    return best || chosen;
  };

  tpl.spawns?.enemies?.forEach(s => {
    const baseCount = Math.max(1, Math.round(s.count || 1));
    const spawnCount = Math.max(1, Math.round(baseCount * spawnMultiplier));
    for (let i = 0; i < spawnCount; i++) {
      const chosen = pickDistantTileNear(s.x, s.y, s.radius || 0);
      const px = ox + gx(tpl, chosen.x) + T / 2;
      const py = oy + gy(tpl, chosen.y) + T / 2;
      if (scene.spawnEnemy) scene.spawnEnemy(scene, px, py, s.type);
      enemyCount++;
    }
  });

  // Loot
  tpl.spawns?.loot?.forEach(l => {
    const px0 = ox + gx(tpl, l.x) + T/2;
    const py0 = oy + gy(tpl, l.y) + T/2;

    const cam = scene.cameras.main;
    const cx = cam.midPoint.x, cy = cam.midPoint.y;
    const MIN = 220;

    let px = px0, py = py0;

    // wenn zu nah an der Kamera: random Position im Raum suchen
    if (Phaser.Math.Distance.Between(px, py, cx, cy) < MIN) {
      // Raumgrenzen, falls vorhanden, sonst Bildschirm
      const bounds = scene.currentRoom
        ? {
            x: scene.currentRoom.origin.x + 16,
            y: scene.currentRoom.origin.y + 16,
            w: scene.currentRoom.w - 32,
            h: scene.currentRoom.h - 32
          }
        : { x: 16, y: 16, w: scene.scale.width - 32, h: scene.scale.height - 32 };

      let tries = 0;
      do {
        px = Phaser.Math.Between(bounds.x, bounds.x + bounds.w);
        py = Phaser.Math.Between(bounds.y, bounds.y + bounds.h);
        tries++;
      } while (tries < 20 && Phaser.Math.Distance.Between(px, py, cx, cy) < MIN);
    }

    // WICHTIG: korrekte Signatur ohne zusaetzliches 'scene' Argument
    if (window.spawnLoot) window.spawnLoot(px, py, { type: l.type, locked: !!l.locked });
    // Falls du this.spawnLoot gebunden hast: this.spawnLoot(px, py, { ... });
  });

  // Türen
  const doors = [];
  [...(tpl.entrances || []), ...(tpl.exits || [])].forEach(d => {
    doors.push({
      x: ox + gx(tpl, d.x) + T / 2,
      y: oy + gy(tpl, d.y) + T / 2,
      dir: d.dir
    });
  });
  
  // --- optionaler Player-Spawn aus dem Template ---
  if (player && tpl.spawns && tpl.spawns.player) {
    const ps = tpl.spawns.player;
    let tile = findAccessibleTileNear(ps.x, ps.y, 0) || { x: ps.x, y: ps.y };

    // Object types that act as solid obstacles the player can get wedged
    // against. Decorative/walk-through types (rubble, brazier glow, loot) are
    // intentionally excluded — they do not create wedge geometry.
    // See GitHub Issue #19 (CirclePillars wedge spawn).
    const BLOCKING_OBJECT_TYPES = new Set([
      'pillar', 'pillar_small', 'pillar_large',
      'statue', 'statue_knight',
      'altar',
      'crate', 'barrel', 'chest_small', 'chest_medium', 'chest_large'
    ]);
    const blockingObjectTiles = [];
    (tpl.objects || []).forEach((obj) => {
      if (!obj) return;
      if (!BLOCKING_OBJECT_TYPES.has(obj.type)) return;
      const tx = Math.round(obj.x ?? 0);
      const ty = Math.round(obj.y ?? 0);
      if (Number.isFinite(tx) && Number.isFinite(ty)) {
        blockingObjectTiles.push({ x: tx, y: ty });
      }
    });

    // Ensure spawn has 3+ tiles clearance from walls AND is not within
    // 2 tiles of any blocking object (pillars, statues, etc.) — otherwise
    // the player can spawn wedged between two pillars or pillar+wall.
    const hasWallClearance = (tx, ty, dist) => {
      for (let dy = -dist; dy <= dist; dy++)
        for (let dx = -dist; dx <= dist; dx++) {
          const cx = tx+dx, cy = ty+dy;
          if (cy >= 0 && cy < H && cx >= 0 && cx < W && wallsGrid[cy]?.[cx] === '#') return false;
        }
      return true;
    };
    const OBJECT_CLEARANCE = 2;
    const hasObjectClearance = (tx, ty) => {
      for (const obj of blockingObjectTiles) {
        const dx = obj.x - tx;
        const dy = obj.y - ty;
        if (Math.abs(dx) <= OBJECT_CLEARANCE && Math.abs(dy) <= OBJECT_CLEARANCE) return false;
      }
      return true;
    };
    const hasSpawnClearance = (tx, ty, wallDist) =>
      hasWallClearance(tx, ty, wallDist) && hasObjectClearance(tx, ty);

    if (!hasSpawnClearance(tile.x, tile.y, 3)) {
      // Find a better spawn with clearance
      let bestTile = tile, bestDist = Infinity;
      if (accessibleTiles) {
        accessibleTiles.forEach((key) => {
          const [tx, ty] = key.split('|').map(Number);
          if (hasSpawnClearance(tx, ty, 3)) {
            const d = Math.abs(tx - ps.x) + Math.abs(ty - ps.y);
            if (d < bestDist) { bestDist = d; bestTile = { x: tx, y: ty }; }
          }
        });
      }
      // Fallback: relax wall clearance to 2, keep object clearance, in case
      // a small room has no tile satisfying both at radius 3.
      if (bestDist === Infinity && accessibleTiles) {
        accessibleTiles.forEach((key) => {
          const [tx, ty] = key.split('|').map(Number);
          if (hasSpawnClearance(tx, ty, 2)) {
            const d = Math.abs(tx - ps.x) + Math.abs(ty - ps.y);
            if (d < bestDist) { bestDist = d; bestTile = { x: tx, y: ty }; }
          }
        });
      }
      tile = bestTile;
    }

    const px = originX + gx(tpl, tile.x) + T/2;
    const py = originY + gy(tpl, tile.y) + T/2;

    player.setPosition(px, py);
    // Store entry point for flood-fill seed in recomputeAccessibleArea
    scene._roomEntryPoint = { x: px, y: py };

    // Kamera passend ausrichten
    if (scene.cameras?.main) scene.cameras.main.centerOn(px, py);

    // FoW initial kurz aufhellen, damit der Spieler nicht "hinter" Schwarz startet
    if (scene._visionGfx && scene.exploredRT) {
      scene._visionGfx.clear().fillStyle(0xffffff, 1).fillCircle(px, py, 160);
      scene.exploredRT.draw(scene._visionGfx);
    }
  }

  if (profile) {
    const dt = performance.now() - tStart;
    console.log(
      `[RoomTemplates] built ${tpl.name || 'unnamed'} ` +
        `${W}x${H} tiles in ${dt.toFixed(1)}ms ` +
        `(floor:${floorCount}${skipFloorTiles ? ' skipped' : ''} wall:${wallCount}${skipWallObstacles ? ' skipped' : ''} segments:${wallRects.length} objects:${objectCount} enemies:${enemyCount}${isLargeRoom ? ' x3' : ''})`
    );
  }

  return { doors, w: W * T, h: H * T, origin: { x: ox, y: oy }, isLarge: isLargeRoom };
}

// Rotation/Spiegelung
function transformTemplate(tpl, rot = 0, mirrorX = false, mirrorY = false) {
  const H = tpl.layout.walls.length;
  const W = tpl.layout.walls[0].length;
  let grid = tpl.layout.walls.map(r => r.split(""));

  if (mirrorX) grid = grid.map(r => r.slice().reverse());
  if (mirrorY) grid = grid.slice().reverse();

  function rot90(g) {
    const h = g.length, w = g[0].length;
    const out = Array.from({ length: w }, () => Array(h).fill("."));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      out[x][h - 1 - y] = g[y][x];
    }
    return out;
  }
  let g = grid;
  if (rot === 90) g = rot90(g);
  if (rot === 180) g = rot90(rot90(g));
  if (rot === 270) g = rot90(rot90(rot90(g)));

  const walls = g.map(r => r.join(""));
  
  return {
    ...tpl,
    size: { ...tpl.size, w: walls[0].length, h: walls.length },
    layout: { ...tpl.layout, walls },
    spawns: tpl.spawns ? JSON.parse(JSON.stringify(tpl.spawns)) : undefined,
    objects: tpl.objects ? JSON.parse(JSON.stringify(tpl.objects)) : undefined,
    entrances: tpl.entrances ? JSON.parse(JSON.stringify(tpl.entrances)) : undefined,
    exits: tpl.exits ? JSON.parse(JSON.stringify(tpl.exits)) : undefined
  };
}

// Template bauen
function buildRoomFromTemplate(scene, tpl, originX, originY) {
  const base = normalizeTemplateToFixedGrid(tpl);
  
  const v = base.variants || {};
  const rot = v.rotate ? v.rotate[Math.floor(Math.random() * v.rotate.length)] : 0;
  const mx = !!v.mirrorX && Math.random() < 0.5;
  const my = !!v.mirrorY && Math.random() < 0.5;

  const t = window.RoomTemplates.transformTemplate(base, rot || 0, mx, my);
  return window.RoomTemplates.applyRoomTemplate(scene, t, originX, originY);
}

const TILE_PX = 32;
const COLS_TARGET = 80; // 80 * 32 = 2560
const ROWS_TARGET = 80; // 80 * 32 = 2560

function normalizeTemplateToFixedGrid(tpl) {
  // Use the template's native size — no padding to 80x80.
  // Each room renders at its designed dimensions for variety.
  const srcRows = tpl.layout.walls.length;
  const srcCols = tpl.layout.walls[0].length;
  const targetCols = Math.max(srcCols, tpl.size?.w ?? srcCols);
  const targetRows = Math.max(srcRows, tpl.size?.h ?? srcRows);

  const wallKey =
    Object.keys(tpl.layout.legend || {}).find((key) => tpl.layout.legend[key] === 'wall') || '#';
  // 2) Zielgitter anlegen, default = Wand '#'
  const target = Array.from({ length: targetRows }, () => Array(targetCols).fill(wallKey));

  // 3) No centering offset — use template as-is
  const offX = 0;
  const offY = 0;

  // 4) Inhalt rueberkopieren (alles ausserhalb wird ignoriert)
  for (let y = 0; y < srcRows; y++) {
    const row = tpl.layout.walls[y];
    for (let x = 0; x < srcCols; x++) {
      const tx = x + offX;
      const ty = y + offY;
      if (tx >= 0 && tx < targetCols && ty >= 0 && ty < targetRows) {
        target[ty][tx] = row[x];
      }
    }
  }

  // 5) Optional: Rand als Wand setzen, damit der Raum "geschlossen" ist
  for (let x = 0; x < targetCols; x++) {
    target[0][x] = target[targetRows - 1][x] = wallKey;
  }
  for (let y = 0; y < targetRows; y++) {
    target[y][0] = target[y][targetCols - 1] = wallKey;
  }

  // 6) Arrays zu Strings
  const walls = target.map(r => r.join(''));

  // 7) Koordinaten verschieben (Entrances, Exits, Objects, Spawns)
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const shiftPt = p => ({ ...p, x: clamp(p.x + offX, 1, targetCols - 2), y: clamp(p.y + offY, 1, targetRows - 2) });

  const entrances = (tpl.entrances || []).map(shiftPt);
  const exits = (tpl.exits || []).map(shiftPt);
  const objects = (tpl.objects || []).map(o => ({ ...o, x: clamp(o.x + offX, 0, targetCols - 1), y: clamp(o.y + offY, 0, targetRows - 1) }));

  const spawns = {
    enemies: (tpl.spawns?.enemies || []).map(s => ({ ...s, x: clamp(s.x + offX, 1, targetCols - 2), y: clamp(s.y + offY, 1, targetRows - 2) })),
    loot: (tpl.spawns?.loot || []).map(l => ({ ...l, x: clamp(l.x + offX, 1, targetCols - 2), y: clamp(l.y + offY, 1, targetRows - 2) })),
    player:  tpl.spawns?.player ? shiftPt(tpl.spawns.player) : undefined
  };

  // 8) Rueckgabe: Tile immer 32, Grid = native template size
  return {
    ...tpl,
    size: { tile: TILE_PX, w: targetCols, h: targetRows },
    layout: { ...tpl.layout, walls },
    entrances, exits, objects, spawns,
    meta: { ...(tpl.meta || {}), isLarge: targetCols >= 40 || targetRows >= 40, originalSize: { w: srcCols, h: srcRows } }
  };
}

function buildTemplateRoom(scene, templateName) {
  const RT = window.RoomTemplates;

  let tpl;
  if (templateName && RT.TEMPLATES && RT.TEMPLATES[templateName]) {
    tpl = RT.TEMPLATES[templateName];
  } else {
    tpl = window.RoomTemplates.pick(scene, {});
  }
  if (!tpl) return null;

  const built = RT.buildRoomFromTemplate(scene, tpl, 0, 0);

  return {
    type: 'template',
    name: tpl.name || templateName || 'Template',
    origin: built.origin,
    w: built.w,
    h: built.h,
    doors: built.doors,
    isLarge: !!built.isLarge
  };
}

function spawnWallRect(x, y, width, height, textureKey) {
  const scene = obstacles?.scene;
  const key = textureKey || 'obstacleWall';
  if (!obstacles || typeof obstacles.create !== 'function') return null;

  const wall = obstacles.create(x, y, key);
  if (!wall) return null;

  wall.setVisible(false);
  wall.setOrigin(0.5, 0.5);

  if (typeof wall.setDisplaySize === 'function') {
    wall.setDisplaySize(width, height);
  } else if (typeof wall.setScale === 'function') {
    const baseW = wall.displayWidth || wall.width || TILE_PX;
    const baseH = wall.displayHeight || wall.height || TILE_PX;
    wall.setScale(
      baseW ? width / baseW : 1,
      baseH ? height / baseH : 1,
    );
  }

  const body = wall.body;
  if (body) {
    body.setAllowGravity?.(false);
    body.setImmovable?.(true);
    body.moves = false;
    if (body.setSize) {
      body.setSize(Math.max(1, width), Math.max(1, height));
    }
    if (body.setOffset) {
      body.setOffset(-Math.max(1, width) / 2, -Math.max(1, height) / 2);
    }
    body.updateFromGameObject?.();
  }

  wall.refreshBody?.();

  if (scene) {
    scene._templateWalls = scene._templateWalls || [];
    scene._templateWalls.push(wall);
  }

  wall.setData('type', 'obstacleWall');
  wall.setData('isMergedWall', true);
  if (key !== 'obstacleWall') {
    wall.setData('textureKey', key);
  }
  return wall;
}

function spawnObstacle(x, y, key) {
  // Neues Hindernis ins globale obstacles-StaticGroup einfügen
  const scene = obstacles?.scene;
  let textureKey = key;
  if (!warnMissingTexture(scene, textureKey, 'obstacle')) {
    const fallback = getFallbackTexture(textureKey);
    warnMissingTexture(scene, fallback, 'obstacle fallback');
    textureKey = fallback;
  }
  const o = obstacles.create(x, y, textureKey);

  // Standard-Setup
  o.setOrigin(0.5, 0.5);
  o.refreshBody();              // wichtig bei staticGroup
  o.setDepth(40);               // hinter Gegnern, aber vor Boden

  // Optionale Metadaten
  o.setData('type', key);
  if (textureKey !== key) {
    o.setData('textureKey', textureKey);
  }

  // Destructible/openable types — chests, barrels, crates can be broken for loot
  const destructibleTypes = ['barrel', 'crate', 'chest_small', 'chest_medium', 'chest_large', 'rubble'];
  const lowerKey = String(key).toLowerCase();
  const isDestructible = destructibleTypes.some(t => lowerKey.startsWith(t));
  if (isDestructible) {
    o.setData('destructible', true);
    o.setData('hp', lowerKey.startsWith('chest') ? 1 : 1); // 1 hit destroys
    // Loot table per type
    if (lowerKey.startsWith('chest_large')) {
      o.setData('lootTier', 'large');
    } else if (lowerKey.startsWith('chest_medium')) {
      o.setData('lootTier', 'medium');
    } else if (lowerKey.startsWith('chest')) {
      o.setData('lootTier', 'small');
    } else {
      o.setData('lootTier', 'minor'); // barrel, crate, rubble
    }
  }

  return o;
}

// ========== Globale Zuweisungen ==========
window.RoomTemplates.transformTemplate = transformTemplate;
window.RoomTemplates.applyRoomTemplate = applyRoomTemplate;
window.RoomTemplates.buildRoomFromTemplate = buildRoomFromTemplate;

// Optionaler Zufallspicker
window.RoomTemplates.pick = function(scene, { tags = [], difficulty = null } = {}) {
  const R = window.RoomTemplates || {};
  const listFromMem = Object.values(R.TEMPLATES || {});

  let poolAll = listFromMem;

  // Fallback: aus dem Cache ziehen, falls Speicher leer
  if (!poolAll.length) {
    const cache =
      (scene && scene.cache && scene.cache.json) ||
      (scene && scene.sys && scene.sys.game && scene.sys.game.cache && scene.sys.game.cache.json) ||
      (window.game && window.game.cache && window.game.cache.json) || null;

    if (cache && typeof cache.keys === 'function') {
      const keys = cache.keys();
      poolAll = keys.map(k => cache.get(k))
        .filter(t => t && t.size && t.size.tile && t.layout && Array.isArray(t.layout.walls));
    }
  }

  if (!poolAll.length) {
    console.warn('[RoomTemplates.pick] no templates captured yet');
    return null;
  }

  // Filter optional
  const poolFiltered = poolAll.filter(t => {
    const tagOK = !tags.length || (t.tags || []).some(x => tags.includes(x));
    const diffOK = difficulty == null || (t.rules && t.rules.difficulty === difficulty);
    return tagOK && diffOK;
  });

  const pool = poolFiltered.length ? poolFiltered : poolAll;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  return choice;
};
