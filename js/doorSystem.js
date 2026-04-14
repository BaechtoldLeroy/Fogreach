// js/doorSystem.js — Door sprite system for Demonfall
// Spawns door sprites at procedural room doorway positions.
// Doors auto-open when the player approaches and auto-close when they leave.

(function () {
  'use strict';

  // ─── Texture generation ───────────────────────────────────────────────────

  /**
   * Generate a procedural door texture and add it to the Phaser texture manager.
   * Textures are only created once per game instance.
   *
   * @param {Phaser.Scene} scene
   */
  function generateDoorTextures(scene) {
    if (scene.textures.exists('proc_door_closed') && scene.textures.exists('proc_door_open')) {
      return; // Already generated
    }

    var W = 32, H = 48;

    // ── proc_door_closed ──────────────────────────────────────────────────
    if (!scene.textures.exists('proc_door_closed')) {
      var canvasClosed = scene.textures.createCanvas('proc_door_closed', W, H);
      var ctx = canvasClosed.getContext('2d');

      // Wooden base
      ctx.fillStyle = '#5a3d1f';
      ctx.fillRect(0, 0, W, H);

      // Wood grain lines
      ctx.strokeStyle = '#4a3218';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, 0);  ctx.lineTo(8, H);  ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(24, H); ctx.stroke();

      // Light highlight on left edge
      ctx.fillStyle = '#7a5a35';
      ctx.fillRect(0, 0, 2, H);

      // Iron band top
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 4, W, 5);
      // Iron band rivets (top band)
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(3, 5, 3, 3);
      ctx.fillRect(13, 5, 3, 3);
      ctx.fillRect(26, 5, 3, 3);

      // Iron band bottom
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, H - 9, W, 5);
      // Rivets (bottom band)
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(3, H - 8, 3, 3);
      ctx.fillRect(13, H - 8, 3, 3);
      ctx.fillRect(26, H - 8, 3, 3);

      // Iron band middle
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, Math.floor(H / 2) - 2, W, 4);
      // Rivets (middle band)
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(3, Math.floor(H / 2) - 1, 3, 2);
      ctx.fillRect(26, Math.floor(H / 2) - 1, 3, 2);

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
    }

    // ── proc_door_open ────────────────────────────────────────────────────
    if (!scene.textures.exists('proc_door_open')) {
      var canvasOpen = scene.textures.createCanvas('proc_door_open', W, H);
      var ctxO = canvasOpen.getContext('2d');

      // Dim background representing the gap/opening (darkened passage)
      ctxO.fillStyle = '#1a1005';
      ctxO.fillRect(0, 0, W, H);

      // Door panel receded to one side (right-hand side, narrower)
      var panelX = W - 10;
      ctxO.fillStyle = '#3d2a14';
      ctxO.fillRect(panelX, 0, 10, H);

      // Foreshortened wood lines on the receded panel
      ctxO.strokeStyle = '#2a1c0e';
      ctxO.lineWidth = 1;
      ctxO.beginPath(); ctxO.moveTo(panelX + 4, 0); ctxO.lineTo(panelX + 4, H); ctxO.stroke();
      ctxO.beginPath(); ctxO.moveTo(panelX + 8, 0); ctxO.lineTo(panelX + 8, H); ctxO.stroke();

      // Iron band top on receded panel
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, 4, 10, 4);

      // Iron band bottom
      ctxO.fillStyle = '#1e1e1e';
      ctxO.fillRect(panelX, H - 8, 10, 4);

      // Opening glow (subtle warm light from beyond the door)
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
    }
  }

  // ─── Door spawning ────────────────────────────────────────────────────────

  /**
   * Spawn a door sprite at world-pixel position (x, y).
   *
   * @param {Phaser.Scene} scene
   * @param {number} x       World pixel X (center of doorway tile)
   * @param {number} y       World pixel Y (center of doorway tile)
   * @param {string} orientation  'horizontal' or 'vertical'
   * @returns {Phaser.Physics.Arcade.Sprite|null}
   */
  function spawnDoor(scene, x, y, orientation) {
    if (!scene || !scene.physics) return null;

    // Ensure textures exist
    generateDoorTextures(scene);

    var obstacles = window.obstacles;
    if (!obstacles) return null;

    // Create a static physics sprite added to the obstacles group
    var door = obstacles.create(x, y, 'proc_door_closed');
    if (!door) return null;

    door.setOrigin(0.5, 0.5);
    door.setDepth(42);

    // Rotate to match doorway orientation
    // 'horizontal' = wall runs left-right, door faces horizontally (no rotation)
    // 'vertical'   = wall runs up-down,    door faces vertically (rotate 90°)
    if (orientation === 'vertical') {
      door.setAngle(90);
    }

    door.setData('isDoor', true);
    door.setData('doorState', 'closed');
    door.setData('orientation', orientation);

    door.refreshBody();

    // Track all doors on the scene for the update loop
    if (!scene._doors) scene._doors = [];
    scene._doors.push(door);

    return door;
  }

  // ─── Door update (call from main update loop) ─────────────────────────────

  var OPEN_DIST  = 80;   // player within this distance → open door
  var CLOSE_DIST = 120;  // player beyond this distance → close door

  /**
   * Update all doors in the scene relative to the player.
   * Call this every frame from the main update loop.
   *
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} player
   */
  function updateDoors(scene, player) {
    if (!scene || !player) return;
    var doors = scene._doors;
    if (!doors || !doors.length) return;

    var px = player.x, py = player.y;

    for (var i = doors.length - 1; i >= 0; i--) {
      var door = doors[i];

      // Remove destroyed doors from the list
      if (!door || !door.active || door.scene == null) {
        doors.splice(i, 1);
        continue;
      }

      var dx = door.x - px;
      var dy = door.y - py;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var state = door.getData('doorState');

      if (state === 'closed' && dist < OPEN_DIST) {
        // Open the door
        door.setTexture('proc_door_open');
        door.setData('doorState', 'open');
        // Disable body so the player can pass through
        if (door.body) {
          door.body.enable = false;
        }
      } else if (state === 'open' && dist > CLOSE_DIST) {
        // Close the door
        door.setTexture('proc_door_closed');
        door.setData('doorState', 'closed');
        // Re-enable body
        if (door.body) {
          door.body.enable = true;
          door.refreshBody();
        }
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.DoorSystem = {
    generateDoorTextures: generateDoorTextures,
    spawnDoor: spawnDoor,
    updateDoors: updateDoors
  };
})();
