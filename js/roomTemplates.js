// roomTemplates.js
(function(w) {
  // 1) Globales Objekt sicherstellen
  if (!w.RoomTemplates) w.RoomTemplates = {};
  var RT = w.RoomTemplates;

  // 2) Manifest definieren – Namen müssen exakt den JSON-Dateien unter /roomTemplates/ entsprechen
  if (!Array.isArray(RT.MANIFEST)) {
    RT.MANIFEST = [
      'Crypt_Small_Altar',
      'Crossroads',
      'Treasure_Small'
    ];
  }
})(window);

const _MISSING_TEXTURE_WARNINGS = new Set();
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

// Template anwenden
function applyRoomTemplate(scene, tpl, originX = 0, originY = 0) {
  const ox = originX, oy = originY;
  const T = tpl.size.tile;

  const H = tpl.layout.walls.length;
  const W = tpl.layout.walls[0].length;
  const wallsGrid = tpl.layout?.walls || [];

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

  // Preload textures once
  let floorKey = tpl.tiles?.floor || 'floor_stone';
  if (!warnMissingTexture(scene, floorKey, 'floor tile')) {
    floorKey = 'floor_stone';
  }
  if (!warnMissingTexture(scene, floorKey, 'floor fallback')) {
    floorKey = null;
  }

  let wallTexture = 'obstacleWall';
  if (!warnMissingTexture(scene, wallTexture, 'wall tile')) {
    wallTexture = getFallbackTexture(wallTexture);
    if (!warnMissingTexture(scene, wallTexture, 'wall fallback')) {
      wallTexture = null;
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

      if (key === 'wall' || key === 'obstacleWall') {
        const start = x;
        while (x + 1 < W) {
          const nextKey = tpl.layout.legend[row[x + 1]];
          if (nextKey === 'wall' || nextKey === 'obstacleWall') {
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
        if (AUTO_OBSTACLE_TILE_KEYS.has(key) && scene.spawnObstacle) {
          const obstacleX = ox + x * T + T / 2;
          const obstacleY = oy + y * T + T / 2;
          scene.spawnObstacle(obstacleX, obstacleY, key);
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

  const templateWalls = scene._templateWalls = scene._templateWalls || [];

  if (!skipFloorTiles && floorKey && scene.add?.tileSprite) {
    const floorSprite = scene.add.tileSprite(
      ox + (W * T) / 2,
      oy + (H * T) / 2,
      W * T,
      H * T,
      floorKey
    );
    floorSprite.setOrigin(0.5);
    floorSprite.setDepth(-5);
    templateWalls.push(floorSprite);
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
      templateWalls.push(sprite);
    }

    if (!skipWallObstacles) {
      spawnWallRect(cx, cy, widthPx, heightPx, wallTexture || undefined);
    }
  });

  // Objekte
  tpl.objects?.forEach(o => {
    const px = ox + gx(tpl, o.x) + T / 2;
    const py = oy + gy(tpl, o.y) + T / 2;
    const typeKey = o.type;
    if (!warnMissingTexture(scene, typeKey, 'object')) {
      const fallback = getFallbackTexture(typeKey);
      warnMissingTexture(scene, fallback, 'object fallback');
      o.type = fallback;
    }
    scene.spawnObstacle(px, py, o.type);
    objectCount++;
  });

  // Gegner-Spawns
  tpl.spawns?.enemies?.forEach(s => {
    const baseCount = Math.max(1, Math.round(s.count || 1));
    const spawnCount = Math.max(1, Math.round(baseCount * spawnMultiplier));
    for (let i = 0; i < spawnCount; i++) {
      const chosen = findAccessibleTileNear(s.x, s.y, s.radius || 0);
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
    const tile = findAccessibleTileNear(ps.x, ps.y, 0) || { x: ps.x, y: ps.y };
    const px = originX + gx(tpl, tile.x) + T/2;
    const py = originY + gy(tpl, tile.y) + T/2;

    player.setPosition(px, py);
    
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
  // 1) Ausgangswerte
  const srcRows = tpl.layout.walls.length;
  const srcCols = tpl.layout.walls[0].length;
  const originalSize = {
    w: tpl.size?.w ?? srcCols,
    h: tpl.size?.h ?? srcRows
  };
  const isLargeTemplate =
    (tpl.size && ((tpl.size.w || 0) >= 80 || (tpl.size.h || 0) >= 80)) ||
    originalSize.w >= 80 ||
    originalSize.h >= 80;

  const wallKey =
    Object.keys(tpl.layout.legend || {}).find((key) => tpl.layout.legend[key] === 'wall') || '#';
  // 2) Zielgitter anlegen, default = Wand '#'
  const target = Array.from({ length: ROWS_TARGET }, () => Array(COLS_TARGET).fill(wallKey));

  // 3) Zentrieroffset
  const offX = Math.floor((COLS_TARGET - srcCols) / 2);
  const offY = Math.floor((ROWS_TARGET - srcRows) / 2);

  // 4) Inhalt rueberkopieren (alles ausserhalb wird ignoriert)
  for (let y = 0; y < srcRows; y++) {
    const row = tpl.layout.walls[y];
    for (let x = 0; x < srcCols; x++) {
      const tx = x + offX;
      const ty = y + offY;
      if (tx >= 0 && tx < COLS_TARGET && ty >= 0 && ty < ROWS_TARGET) {
        target[ty][tx] = row[x];
      }
    }
  }

  // 5) Optional: Rand als Wand setzen, damit der Raum "geschlossen" ist
  for (let x = 0; x < COLS_TARGET; x++) {
    target[0][x] = target[ROWS_TARGET - 1][x] = Object.keys(tpl.layout.legend).find(k => tpl.layout.legend[k] === 'wall') || '#';
  }
  for (let y = 0; y < ROWS_TARGET; y++) {
    target[y][0] = target[y][COLS_TARGET - 1] = Object.keys(tpl.layout.legend).find(k => tpl.layout.legend[k] === 'wall') || '#';
  }

  // 6) Arrays zu Strings
  const walls = target.map(r => r.join(''));

  // 7) Koordinaten verschieben (Entrances, Exits, Objects, Spawns)
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const shiftPt = p => ({ ...p, x: clamp(p.x + offX, 1, COLS_TARGET - 2), y: clamp(p.y + offY, 1, ROWS_TARGET - 2) });

  const entrances = (tpl.entrances || []).map(shiftPt);
  const exits = (tpl.exits || []).map(shiftPt);
  const objects = (tpl.objects || []).map(o => ({ ...o, x: clamp(o.x + offX, 0, COLS_TARGET - 1), y: clamp(o.y + offY, 0, ROWS_TARGET - 1) }));

  const spawns = {
    enemies: (tpl.spawns?.enemies || []).map(s => ({ ...s, x: clamp(s.x + offX, 1, COLS_TARGET - 2), y: clamp(s.y + offY, 1, ROWS_TARGET - 2) })),
    loot: (tpl.spawns?.loot || []).map(l => ({ ...l, x: clamp(l.x + offX, 1, COLS_TARGET - 2), y: clamp(l.y + offY, 1, ROWS_TARGET - 2) })),
    player:  tpl.spawns?.player ? shiftPt(tpl.spawns.player) : undefined
  };

  // 8) Rueckgabe: Tile immer 32, Grid auf Ziel, Pixelmasse konsistent
  return {
    ...tpl,
    size: { tile: TILE_PX, w: COLS_TARGET, h: ROWS_TARGET },
    layout: { ...tpl.layout, walls },
    entrances, exits, objects, spawns,
    meta: { ...(tpl.meta || {}), isLarge: isLargeTemplate, originalSize }
  };
}

function buildTemplateRoom(scene) {
  const RT = window.RoomTemplates;

  const tpl = window.RoomTemplates.pick(scene, {});
  //const tpl = RT.TEMPLATES?.["TreasureVault"];   // << gewünschter Name hier
  const built = RT.buildRoomFromTemplate(scene, tpl, 0, 0);

  console.log(tpl);
  
  return {
    type: 'template',
    name: tpl.name || 'Template',
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
