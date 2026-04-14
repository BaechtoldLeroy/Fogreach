// minimap.js — Dungeon minimap overlay for GameScene

/**
 * Initialize the minimap. Call from GameScene create().
 * Attaches minimap objects to the scene.
 */
function initMinimap(scene) {
  const MAP_W = 160;
  const MAP_H = 120;
  const SCREEN_W = scene.scale.width; // 960

  // RenderTexture for the minimap content
  scene._minimapRT = scene.add.renderTexture(SCREEN_W - MAP_W - 10, 10, MAP_W, MAP_H)
    .setScrollFactor(0)
    .setDepth(1500)
    .setOrigin(0, 0);

  // Border rectangle behind the minimap
  scene._minimapBorder = scene.add.rectangle(
    SCREEN_W - MAP_W - 10 - 1, 10 - 1,
    MAP_W + 2, MAP_H + 2,
    0x666666
  )
    .setScrollFactor(0)
    .setDepth(1499)
    .setOrigin(0, 0);

  // Offscreen graphics for drawing into the render texture
  scene._minimapGfx = scene.make.graphics({ x: 0, y: 0, add: false });

  // Toggle state
  scene._minimapVisible = true;
  scene._minimapFrameCounter = 0;

  // Blinking state for the player dot
  scene._minimapBlinkOn = true;
  scene._minimapBlinkTimer = 0;

  // TAB key to toggle
  scene._minimapTabKey = scene.input.keyboard.addKey('TAB');
  scene.input.keyboard.on('keydown-TAB', () => {
    scene._minimapVisible = !scene._minimapVisible;
    scene._minimapRT.setVisible(scene._minimapVisible);
    scene._minimapBorder.setVisible(scene._minimapVisible);
  });

  // Move the room counter text below the minimap for visual consistency
  if (window._roomCounterText) {
    window._roomCounterText.setPosition(SCREEN_W - MAP_W - 10, 10 + MAP_H + 4);
    window._roomCounterText.setOrigin(0, 0);
    window._roomCounterText.setDepth(1501);
  }
}

/**
 * Update the minimap. Call from GameScene update() — internally throttles to every 5 frames.
 */
function updateMinimap(scene) {
  if (!scene._minimapRT || !scene._minimapVisible) return;

  scene._minimapFrameCounter = (scene._minimapFrameCounter || 0) + 1;
  if (scene._minimapFrameCounter % 5 !== 0) return;

  const MAP_W = 160;
  const MAP_H = 120;

  const wallsGrid = scene._minimapWallsGrid;
  const gridW = scene._minimapGridW || 0;
  const gridH = scene._minimapGridH || 0;
  const tileSize = scene._minimapTileSize || 32;

  if (!wallsGrid || gridW === 0 || gridH === 0) return;

  // Calculate scale: fit the room grid into the minimap
  const scaleX = MAP_W / gridW;
  const scaleY = MAP_H / gridH;
  const scale = Math.min(scaleX, scaleY);
  // Pixel size per tile on the minimap
  const tpx = Math.max(1, Math.floor(scale));

  // Offset to center the map in the minimap area
  const drawW = gridW * tpx;
  const drawH = gridH * tpx;
  const offX = Math.floor((MAP_W - drawW) / 2);
  const offY = Math.floor((MAP_H - drawH) / 2);

  const gfx = scene._minimapGfx;
  gfx.clear();

  // Background
  gfx.fillStyle(0x000000, 0.6);
  gfx.fillRect(0, 0, MAP_W, MAP_H);

  // Determine explored areas from the exploredRT
  // We use a simplified approach: check if the player has been near each tile
  // by using the camera and fog data. For simplicity, we track explored tiles
  // in an array the first time and update incrementally.
  if (!scene._minimapExplored) {
    scene._minimapExplored = new Uint8Array(gridW * gridH);
  }

  // Reset explored data when entering a new room
  if (scene._minimapLastRoomId !== (scene.currentRoom && scene.currentRoom.id)) {
    scene._minimapLastRoomId = scene.currentRoom ? scene.currentRoom.id : 0;
    scene._minimapExplored = new Uint8Array(gridW * gridH);
  }

  // Mark tiles as explored only if they are visible (line of sight respected)
  if (player && player.active) {
    const origin = scene.currentRoom ? scene.currentRoom.origin : { x: 0, y: 0 };
    const ptx = Math.floor((player.x - origin.x) / tileSize);
    const pty = Math.floor((player.y - origin.y) / tileSize);
    const visionRadius = 8;

    // Helper: is the ray from player center to tile center blocked by walls?
    const hasLineOfSight = (worldTileX, worldTileY) => {
      if (typeof isBlockedByObstacle !== 'function') return true;
      const sx = player.x, sy = player.y;
      const ex = worldTileX * tileSize + origin.x + tileSize / 2;
      const ey = worldTileY * tileSize + origin.y + tileSize / 2;
      const dist = Math.hypot(ex - sx, ey - sy);
      const steps = Math.max(2, Math.ceil(dist / 16));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = sx + (ex - sx) * t;
        const cy = sy + (ey - sy) * t;
        if (isBlockedByObstacle(cx, cy)) return false;
      }
      return true;
    };

    for (let dy = -visionRadius; dy <= visionRadius; dy++) {
      for (let dx = -visionRadius; dx <= visionRadius; dx++) {
        if (dx * dx + dy * dy > visionRadius * visionRadius) continue;
        const tx = ptx + dx;
        const ty = pty + dy;
        if (tx < 0 || tx >= gridW || ty < 0 || ty >= gridH) continue;
        // Only mark if LOS is clear (respect walls)
        if (hasLineOfSight(tx, ty)) {
          scene._minimapExplored[ty * gridW + tx] = 1;
        }
      }
    }
  }

  // Draw walls and floors (only explored tiles)
  for (let ty = 0; ty < gridH; ty++) {
    const row = wallsGrid[ty];
    if (!row) continue;
    for (let tx = 0; tx < gridW; tx++) {
      if (!scene._minimapExplored[ty * gridW + tx]) continue;

      const ch = typeof row === 'string' ? row.charAt(tx) : row[tx];
      const px = offX + tx * tpx;
      const py = offY + ty * tpx;

      if (ch === '#') {
        gfx.fillStyle(0x444444, 1);
        gfx.fillRect(px, py, tpx, tpx);
      } else if (ch === '.') {
        gfx.fillStyle(0x222222, 1);
        gfx.fillRect(px, py, tpx, tpx);
      }
    }
  }

  // Draw stairs/exit as yellow dot
  if (scene.stairsGroup && scene.stairsGroup.children) {
    const origin = scene.currentRoom ? scene.currentRoom.origin : { x: 0, y: 0 };
    scene.stairsGroup.children.iterate((stair) => {
      if (!stair || !stair.active) return;
      const stx = Math.floor((stair.x - origin.x) / tileSize);
      const sty = Math.floor((stair.y - origin.y) / tileSize);
      // Only show if explored
      if (stx >= 0 && stx < gridW && sty >= 0 && sty < gridH &&
          scene._minimapExplored[sty * gridW + stx]) {
        gfx.fillStyle(0xffff00, 1);
        const dotSize = Math.max(2, tpx);
        gfx.fillRect(offX + stx * tpx - 1, offY + sty * tpx - 1, dotSize + 1, dotSize + 1);
      }
    });
  }

  // Draw enemies as red dots
  if (typeof enemies !== 'undefined' && enemies && enemies.children) {
    const origin = scene.currentRoom ? scene.currentRoom.origin : { x: 0, y: 0 };
    enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      const etx = Math.floor((enemy.x - origin.x) / tileSize);
      const ety = Math.floor((enemy.y - origin.y) / tileSize);
      // Only show if in explored area
      if (etx >= 0 && etx < gridW && ety >= 0 && ety < gridH &&
          scene._minimapExplored[ety * gridW + etx]) {
        gfx.fillStyle(0xff0000, 1);
        gfx.fillRect(offX + etx * tpx, offY + ety * tpx, Math.max(2, tpx), Math.max(2, tpx));
      }
    });
  }

  // Draw player as green blinking dot
  if (player && player.active) {
    // Blink toggle every ~15 frames (every 3 update calls at 5-frame interval)
    scene._minimapBlinkTimer = (scene._minimapBlinkTimer || 0) + 1;
    if (scene._minimapBlinkTimer >= 3) {
      scene._minimapBlinkTimer = 0;
      scene._minimapBlinkOn = !scene._minimapBlinkOn;
    }

    if (scene._minimapBlinkOn) {
      const origin = scene.currentRoom ? scene.currentRoom.origin : { x: 0, y: 0 };
      const ptx = Math.floor((player.x - origin.x) / tileSize);
      const pty = Math.floor((player.y - origin.y) / tileSize);
      if (ptx >= 0 && ptx < gridW && pty >= 0 && pty < gridH) {
        gfx.fillStyle(0x00ff00, 1);
        const dotSize = Math.max(3, tpx + 1);
        gfx.fillRect(
          offX + ptx * tpx - 1,
          offY + pty * tpx - 1,
          dotSize,
          dotSize
        );
      }
    }
  }

  // Draw into the render texture
  scene._minimapRT.clear();
  scene._minimapRT.draw(gfx, 0, 0);
}

/**
 * Clean up minimap resources. Call when leaving GameScene.
 */
function destroyMinimap(scene) {
  if (scene._minimapRT) { scene._minimapRT.destroy(); scene._minimapRT = null; }
  if (scene._minimapBorder) { scene._minimapBorder.destroy(); scene._minimapBorder = null; }
  if (scene._minimapGfx) { scene._minimapGfx.destroy(); scene._minimapGfx = null; }
  scene._minimapExplored = null;
}

// Export to global scope
window.initMinimap = initMinimap;
window.updateMinimap = updateMinimap;
window.destroyMinimap = destroyMinimap;
