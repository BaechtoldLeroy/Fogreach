// js/doorSystem.js — Door sprite system for Demonfall
// Spawns door sprites at procedural room doorway positions.
// Doors auto-open when the player approaches and auto-close when they leave.

(function () {
  'use strict';

  // ─── Texture generation ───────────────────────────────────────────────────

  // Cache of generated texture keys by size: 'proc_door_closed_WxH' → true
  var generatedTextures = {};

  /**
   * Generate a procedural door texture at a given pixel size.
   * Textures are cached by dimension so we only generate once per unique size.
   *
   * @param {Phaser.Scene} scene
   * @param {number} W  pixel width
   * @param {number} H  pixel height
   * @returns {{ closedKey: string, openKey: string }}
   */
  function generateDoorTextures(scene, W, H) {
    W = W || 32;
    H = H || 48;

    var closedKey = 'proc_door_closed_' + W + 'x' + H;
    var openKey   = 'proc_door_open_' + W + 'x' + H;

    // ── proc_door_closed ──────────────────────────────────────────────────
    if (!generatedTextures[closedKey]) {
      var canvasClosed = scene.textures.createCanvas(closedKey, W, H);
      var ctx = canvasClosed.getContext('2d');

      // Wooden base
      ctx.fillStyle = '#5a3d1f';
      ctx.fillRect(0, 0, W, H);

      // Wood grain lines (evenly spaced)
      ctx.strokeStyle = '#4a3218';
      ctx.lineWidth = 1;
      var grainSpacing = Math.max(8, Math.floor(W / 4));
      for (var gx = grainSpacing; gx < W; gx += grainSpacing) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }

      // Light highlight on left edge
      ctx.fillStyle = '#7a5a35';
      ctx.fillRect(0, 0, 2, H);

      // Iron band top
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 4, W, 5);
      // Iron band rivets
      ctx.fillStyle = '#3a3a3a';
      for (var rx = 3; rx < W - 3; rx += Math.max(10, Math.floor(W / 3))) {
        ctx.fillRect(rx, 5, 3, 3);
      }

      // Iron band bottom
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, H - 9, W, 5);
      ctx.fillStyle = '#3a3a3a';
      for (var rx2 = 3; rx2 < W - 3; rx2 += Math.max(10, Math.floor(W / 3))) {
        ctx.fillRect(rx2, H - 8, 3, 3);
      }

      // Iron band middle
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, Math.floor(H / 2) - 2, W, 4);

      // Handle (right side, vertically centered)
      var hx = W - 7, hy = Math.floor(H / 2) - 4;
      ctx.fillStyle = '#888';
      ctx.fillRect(hx, hy, 4, 8);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(hx + 1, hy + 1, 2, 6);

      // Dark border / frame
      ctx.strokeStyle = '#1a1005';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

      canvasClosed.refresh();
      generatedTextures[closedKey] = true;
    }

    // ── proc_door_open ────────────────────────────────────────────────────
    if (!generatedTextures[openKey]) {
      var canvasOpen = scene.textures.createCanvas(openKey, W, H);
      var ctxO = canvasOpen.getContext('2d');

      // Dim background representing the gap/opening (darkened passage)
      ctxO.fillStyle = '#1a1005';
      ctxO.fillRect(0, 0, W, H);

      // Door panel receded to one side (right-hand side, narrower)
      var panelW = Math.max(8, Math.floor(W * 0.25));
      var panelX = W - panelW;
      ctxO.fillStyle = '#3d2a14';
      ctxO.fillRect(panelX, 0, panelW, H);

      // Foreshortened wood lines on the receded panel
      ctxO.strokeStyle = '#2a1c0e';
      ctxO.lineWidth = 1;
      ctxO.beginPath(); ctxO.moveTo(panelX + Math.floor(panelW * 0.4), 0);
      ctxO.lineTo(panelX + Math.floor(panelW * 0.4), H); ctxO.stroke();

      // Iron band top on receded panel
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, 4, panelW, 4);

      // Iron band bottom
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, H - 8, panelW, 4);

      // Opening glow
      var grad = ctxO.createLinearGradient(0, 0, panelX, 0);
      grad.addColorStop(0, 'rgba(90, 60, 20, 0.15)');
      grad.addColorStop(1, 'rgba(90, 60, 20, 0)');
      ctxO.fillStyle = grad;
      ctxO.fillRect(0, 0, panelX, H);

      // Dark frame border
      ctxO.strokeStyle = '#0a0805';
      ctxO.lineWidth = 1;
      ctxO.strokeRect(0.5, 0.5, W - 1, H - 1);

      canvasOpen.refresh();
      generatedTextures[openKey] = true;
    }

    return { closedKey: closedKey, openKey: openKey };
  }

  // ─── Door spawning ────────────────────────────────────────────────────────

  var TILE_SIZE = 32;

  /**
   * Spawn a door sprite at world-pixel position (x, y).
   *
   * @param {Phaser.Scene} scene
   * @param {number} x       World pixel X (center of doorway)
   * @param {number} y       World pixel Y (center of doorway)
   * @param {string} orientation  'horizontal' or 'vertical'
   * @param {number} [doorWidthTiles]  width of the doorway in tiles (default 4)
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  function spawnDoor(scene, x, y, orientation, doorWidthTiles) {
    if (!scene || !scene.physics) return null;

    var obstaclesGroup = window.obstacles;
    if (!obstaclesGroup) return null;

    doorWidthTiles = doorWidthTiles || 4;
    var doorWidthPx = doorWidthTiles * TILE_SIZE;
    var doorThickness = 12; // pixels — how thick the door panel is

    // Generate textures sized to the doorway
    // For horizontal doorways (wall runs left-right): door spans X, thin in Y
    // For vertical doorways (wall runs up-down): door spans Y, thin in X
    var texW, texH;
    if (orientation === 'horizontal') {
      texW = doorWidthPx;
      texH = doorThickness;
    } else {
      texW = doorThickness;
      texH = doorWidthPx;
    }

    var keys = generateDoorTextures(scene, texW, texH);

    // Create a static physics sprite in the obstacles group
    var door = obstaclesGroup.create(x, y, keys.closedKey);
    if (!door) return null;

    door.setOrigin(0.5, 0.5);
    door.setDepth(42);

    // Set the physics body to match the texture size exactly (no rotation needed)
    if (door.body) {
      door.body.setSize(texW, texH);
      door.body.setOffset(
        (door.width - texW) / 2,
        (door.height - texH) / 2
      );
    }

    door.setData('isDoor', true);
    door.setData('doorState', 'closed');
    door.setData('orientation', orientation);
    door.setData('closedKey', keys.closedKey);
    door.setData('openKey', keys.openKey);

    door.refreshBody();

    // Track all doors on the scene for the update loop
    if (!scene._doors) scene._doors = [];
    scene._doors.push(door);

    return door;
  }

  // ─── Door interaction ──────────────────────────────────────────────────────

  var INTERACT_DIST = 100; // player must be within this distance to interact

  /**
   * Toggle the nearest door's open/closed state.
   * @param {Phaser.Physics.Arcade.Sprite} door
   */
  function toggleDoor(door) {
    var state = door.getData('doorState');
    if (state === 'closed') {
      door.setTexture(door.getData('openKey'));
      door.setData('doorState', 'open');
      if (door.body) {
        door.body.enable = false;
      }
    } else {
      door.setTexture(door.getData('closedKey'));
      door.setData('doorState', 'closed');
      if (door.body) {
        door.body.enable = true;
        door.refreshBody();
      }
    }
    // Invalidate wall cache so fog of war updates immediately
    if (typeof window.invalidateWallCache === 'function') {
      window.invalidateWallCache();
    }
  }

  /**
   * Find the nearest door within interaction range of the player.
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  function findNearestDoor(scene, player) {
    if (!scene || !player) return null;
    var doors = scene._doors;
    if (!doors || !doors.length) return null;

    var px = player.x, py = player.y;
    var best = null;
    var bestDist = Infinity;

    for (var i = doors.length - 1; i >= 0; i--) {
      var door = doors[i];
      if (!door || !door.active || door.scene == null) {
        doors.splice(i, 1);
        continue;
      }
      var dx = door.x - px;
      var dy = door.y - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INTERACT_DIST && dist < bestDist) {
        bestDist = dist;
        best = door;
      }
    }
    return best;
  }

  /**
   * Try to interact with the nearest door. Call when E is pressed.
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} player
   * @returns {boolean} true if a door was toggled
   */
  function tryInteractDoor(scene, player) {
    var door = findNearestDoor(scene, player);
    if (door) {
      toggleDoor(door);
      return true;
    }
    return false;
  }

  /**
   * Update loop: just cleans up destroyed doors from the tracking list.
   * Call this every frame from the main update loop.
   *
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} player
   */
  function updateDoors(scene, player) {
    if (!scene) return;
    var doors = scene._doors;
    if (!doors || !doors.length) return;

    for (var i = doors.length - 1; i >= 0; i--) {
      var door = doors[i];
      if (!door || !door.active || door.scene == null) {
        doors.splice(i, 1);
      }
    }
  }

  /**
   * Clear all tracked doors (call on room cleanup).
   * @param {Phaser.Scene} scene
   */
  function clearDoors(scene) {
    if (scene && scene._doors) {
      scene._doors.length = 0;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.DoorSystem = {
    generateDoorTextures: generateDoorTextures,
    spawnDoor: spawnDoor,
    updateDoors: updateDoors,
    tryInteractDoor: tryInteractDoor,
    clearDoors: clearDoors
  };
})();
