// js/proceduralRooms.js — Procedural room generator (BSP + corridors)
// Produces templates compatible with the existing roomTemplates.js loader.

(function () {
  'use strict';

  // Seeded Mulberry32 PRNG for reproducibility
  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // BSP Node
  function Node(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null;
    this.room = null; // {x, y, w, h} inner rect
  }

  function splitNode(node, minSize, rng) {
    if (node.left || node.right) return false;

    // Decide split direction — prefer the longer axis
    var splitH = rng() < 0.5;
    if (node.w > node.h * 1.25) splitH = false;
    if (node.h > node.w * 1.25) splitH = true;

    var max = (splitH ? node.h : node.w) - minSize;
    if (max <= minSize) return false;

    var split = Math.floor(rng() * (max - minSize)) + minSize;

    if (splitH) {
      node.left = new Node(node.x, node.y, node.w, split);
      node.right = new Node(node.x, node.y + split, node.w, node.h - split);
    } else {
      node.left = new Node(node.x, node.y, split, node.h);
      node.right = new Node(node.x + split, node.y, node.w - split, node.h);
    }
    return true;
  }

  function createRooms(node, rng, minRoom) {
    if (node.left || node.right) {
      if (node.left) createRooms(node.left, rng, minRoom);
      if (node.right) createRooms(node.right, rng, minRoom);
    } else {
      // Leaf — carve a room inside with some padding
      var pad = 2;
      var rx = node.x + pad + Math.floor(rng() * 2);
      var ry = node.y + pad + Math.floor(rng() * 2);
      var rw = Math.max(minRoom, node.w - pad * 2 - Math.floor(rng() * 3));
      var rh = Math.max(minRoom, node.h - pad * 2 - Math.floor(rng() * 3));
      rw = Math.min(rw, node.w - pad * 2);
      rh = Math.min(rh, node.h - pad * 2);
      node.room = { x: rx, y: ry, w: rw, h: rh };
    }
  }

  function getRoom(node) {
    if (node.room) return node.room;
    var l = node.left ? getRoom(node.left) : null;
    var r = node.right ? getRoom(node.right) : null;
    return l || r;
  }

  function connectNodes(node, grid, rng) {
    if (!node.left || !node.right) return;
    var lRoom = getRoom(node.left);
    var rRoom = getRoom(node.right);
    if (!lRoom || !rRoom) return;

    var lx = lRoom.x + Math.floor(lRoom.w / 2);
    var ly = lRoom.y + Math.floor(lRoom.h / 2);
    var rx = rRoom.x + Math.floor(rRoom.w / 2);
    var ry = rRoom.y + Math.floor(rRoom.h / 2);

    // L-shaped corridor, random bend order
    var horizFirst = rng() < 0.5;
    var corridorWidth = 2; // 2-tile wide corridors
    if (horizFirst) {
      carveHorizontal(grid, lx, rx, ly, corridorWidth);
      carveVertical(grid, ly, ry, rx, corridorWidth);
    } else {
      carveVertical(grid, ly, ry, lx, corridorWidth);
      carveHorizontal(grid, lx, rx, ry, corridorWidth);
    }

    connectNodes(node.left, grid, rng);
    connectNodes(node.right, grid, rng);
  }

  function carveHorizontal(grid, x1, x2, y, width) {
    var from = Math.min(x1, x2), to = Math.max(x1, x2);
    for (var x = from; x <= to; x++) {
      for (var w = 0; w < width; w++) {
        if (grid[y + w] && x >= 0 && x < grid[y + w].length) {
          grid[y + w][x] = '.';
        }
      }
    }
  }

  function carveVertical(grid, y1, y2, x, width) {
    var from = Math.min(y1, y2), to = Math.max(y1, y2);
    for (var y = from; y <= to; y++) {
      for (var w = 0; w < width; w++) {
        if (grid[y] && x + w >= 0 && x + w < grid[y].length) {
          grid[y][x + w] = '.';
        }
      }
    }
  }

  function carveRoom(grid, room) {
    for (var y = room.y; y < room.y + room.h; y++) {
      for (var x = room.x; x < room.x + room.w; x++) {
        if (grid[y] && x >= 0 && x < grid[y].length) {
          grid[y][x] = '.';
        }
      }
    }
  }

  function collectAllRooms(node, out) {
    if (node.room) out.push(node.room);
    if (node.left) collectAllRooms(node.left, out);
    if (node.right) collectAllRooms(node.right, out);
  }

  /**
   * Generate a procedural room template compatible with the existing loader.
   * @param {Object} opts - { width, height, seed, name }
   * @returns template object
   */
  function generate(opts) {
    opts = opts || {};
    var width = opts.width || 80;
    var height = opts.height || 80;
    var seed = opts.seed || Math.floor(Math.random() * 1e9);
    var name = opts.name || ('Procedural_' + seed);

    var rng = mulberry32(seed);

    // 1) Init grid all walls
    var grid = [];
    for (var y = 0; y < height; y++) {
      var row = new Array(width);
      for (var x = 0; x < width; x++) row[x] = '#';
      grid.push(row);
    }

    // 2) BSP tree
    var root = new Node(1, 1, width - 2, height - 2);
    var MIN_NODE_SIZE = 12;
    var MIN_ROOM_SIZE = 5;

    // Recursively split
    var queue = [root];
    var iterations = 0;
    while (queue.length && iterations < 50) {
      iterations++;
      var n = queue.shift();
      if (splitNode(n, MIN_NODE_SIZE, rng)) {
        queue.push(n.left, n.right);
      }
    }

    // 3) Carve rooms at leaves
    createRooms(root, rng, MIN_ROOM_SIZE);
    var rooms = [];
    collectAllRooms(root, rooms);
    rooms.forEach(function (r) { carveRoom(grid, r); });

    // 4) Connect rooms via corridors
    connectNodes(root, grid, rng);

    // 5) Convert grid rows to strings
    var walls = grid.map(function (r) { return r.join(''); });

    // 6) Pick player spawn in first room
    var playerSpawn = rooms[0]
      ? { x: rooms[0].x + Math.floor(rooms[0].w / 2), y: rooms[0].y + Math.floor(rooms[0].h / 2) }
      : { x: Math.floor(width / 2), y: Math.floor(height / 2) };

    // 7) Entrances: one at each edge (find accessible points near edges)
    var entrances = [];
    // North entrance: find leftmost floor in row 1-3
    for (var ex = 2; ex < width - 2; ex++) {
      if (grid[1][ex] === '.' || grid[2][ex] === '.') {
        entrances.push({ x: ex, y: 1, dir: 'N' }); break;
      }
    }
    // South
    for (var ex2 = 2; ex2 < width - 2; ex2++) {
      if (grid[height - 2][ex2] === '.' || grid[height - 3][ex2] === '.') {
        entrances.push({ x: ex2, y: height - 2, dir: 'S' }); break;
      }
    }

    // 8) Enemy spawns: scatter 8-15 enemies across accessible rooms (not first room)
    var enemies = [];
    var enemyCount = 8 + Math.floor(rng() * 8);
    for (var i = 1; i < rooms.length && enemies.length < enemyCount; i++) {
      var r = rooms[i];
      var groupSize = 1 + Math.floor(rng() * 3);
      enemies.push({
        type: Math.floor(rng() * 4) + 1, // 1-4 (Imp, Archer, Brute, Mage)
        x: r.x + Math.floor(rng() * r.w),
        y: r.y + Math.floor(rng() * r.h),
        count: groupSize,
        radius: 2
      });
    }

    // 9) Loot: 1-2 chests in last room, 1-2 small chests elsewhere
    var loot = [];
    if (rooms.length >= 2) {
      var last = rooms[rooms.length - 1];
      loot.push({
        x: last.x + Math.floor(last.w / 2),
        y: last.y + Math.floor(last.h / 2),
        type: 'chest_large',
        locked: true
      });
    }
    for (var j = 1; j < rooms.length - 1; j++) {
      if (rng() < 0.4) {
        var rr = rooms[j];
        loot.push({
          x: rr.x + Math.floor(rng() * rr.w),
          y: rr.y + Math.floor(rng() * rr.h),
          type: rng() < 0.3 ? 'chest_medium' : 'chest_small'
        });
      }
    }

    // 10) Objects: braziers, barrels, crates scattered
    var objects = [];
    for (var k = 0; k < rooms.length; k++) {
      var room = rooms[k];
      var objCount = Math.floor(rng() * 3);
      for (var o = 0; o < objCount; o++) {
        var objTypes = ['brazier', 'barrel', 'crate', 'rubble'];
        objects.push({
          type: objTypes[Math.floor(rng() * objTypes.length)],
          x: room.x + Math.floor(rng() * room.w),
          y: room.y + Math.floor(rng() * room.h)
        });
      }
    }

    return {
      name: name,
      tags: ['procedural', 'large'],
      size: { tile: 32, w: width, h: height },
      tiles: { floor: 'floor_stone' },
      layout: {
        legend: {
          '#': 'obstacleWall',
          '.': 'floor_stone'
        },
        walls: walls
      },
      entrances: entrances,
      objects: objects,
      spawns: {
        player: playerSpawn,
        enemies: enemies,
        loot: loot
      },
      _procedural: true,
      _seed: seed
    };
  }

  // Register globally
  window.ProceduralRooms = {
    generate: generate,
    mulberry32: mulberry32
  };
})();
