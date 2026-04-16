// js/proceduralRooms.js — Procedural room generator (D2-style chambers)
// Produces templates compatible with the existing roomTemplates.js loader.
// Style: rooms directly adjacent with doorway openings in shared walls,
// NOT boxes connected by long corridors.

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

  // BSP Node — leaf rects become chambers (no inner padding, walls are shared)
  function Node(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.left = null; this.right = null;
    this.parent = null;
    this.splitAxis = null; // 'h' or 'v'
    this.splitPos = null;  // position of the split line
  }

  function splitNode(node, minSize, rng) {
    if (node.left || node.right) return false;

    // Prefer the longer axis
    var splitH = rng() < 0.5;
    if (node.w > node.h * 1.3) splitH = false;
    if (node.h > node.w * 1.3) splitH = true;

    var axisSize = splitH ? node.h : node.w;
    if (axisSize < minSize * 2 + 1) return false;

    // Split position — biased toward the middle but with variance
    var min = minSize;
    var max = axisSize - minSize - 1;
    if (max <= min) return false;
    var split = min + Math.floor(rng() * (max - min + 1));

    if (splitH) {
      node.splitAxis = 'h';
      node.splitPos = node.y + split;
      node.left = new Node(node.x, node.y, node.w, split);
      node.right = new Node(node.x, node.y + split, node.w, node.h - split);
    } else {
      node.splitAxis = 'v';
      node.splitPos = node.x + split;
      node.left = new Node(node.x, node.y, split, node.h);
      node.right = new Node(node.x + split, node.y, node.w - split, node.h);
    }
    node.left.parent = node;
    node.right.parent = node;
    return true;
  }

  function collectLeaves(node, out) {
    if (!node.left && !node.right) { out.push(node); return; }
    if (node.left) collectLeaves(node.left, out);
    if (node.right) collectLeaves(node.right, out);
  }

  function collectInternalNodes(node, out) {
    if (!node.left || !node.right) return;
    out.push(node);
    collectInternalNodes(node.left, out);
    collectInternalNodes(node.right, out);
  }

  // Carve a chamber: fill the leaf rect with floor, leaving a 1-tile border wall
  function carveChamber(grid, leaf) {
    for (var y = leaf.y + 1; y < leaf.y + leaf.h - 1; y++) {
      for (var x = leaf.x + 1; x < leaf.x + leaf.w - 1; x++) {
        if (grid[y] && x >= 0 && x < grid[y].length) {
          grid[y][x] = '.';
        }
      }
    }
  }

  // Carve a doorway in the shared wall between two BSP children
  // width: 3-4 tiles so the player collider reliably fits through
  function carveDoorway(grid, node, rng, doorwayTiles, doorways) {
    if (!node.left || !node.right) return;
    var doorWidth = 4 + Math.floor(rng() * 2); // 4-5 tiles (128-160px)

    var markDoor = function (x, y) {
      if (doorwayTiles) doorwayTiles[y + '|' + x] = true;
    };

    if (node.splitAxis === 'h') {
      var overlapX1 = Math.max(node.left.x, node.right.x) + 2;
      var overlapX2 = Math.min(node.left.x + node.left.w, node.right.x + node.right.w) - 2 - doorWidth;
      if (overlapX2 < overlapX1) return;
      var dx = overlapX1 + Math.floor(rng() * (overlapX2 - overlapX1 + 1));
      for (var i = 0; i < doorWidth; i++) {
        if (grid[node.splitPos - 1] && dx + i >= 0 && dx + i < grid[node.splitPos - 1].length) {
          grid[node.splitPos - 1][dx + i] = '.'; markDoor(dx + i, node.splitPos - 1);
        }
        if (grid[node.splitPos] && dx + i >= 0 && dx + i < grid[node.splitPos].length) {
          grid[node.splitPos][dx + i] = '.'; markDoor(dx + i, node.splitPos);
        }
      }
      // Record center tile of this horizontal-wall doorway (wall runs left-right → 'horizontal')
      if (doorways) {
        doorways.push({
          x: dx + Math.floor(doorWidth / 2),
          y: node.splitPos,
          orientation: 'horizontal',
          width: doorWidth
        });
      }
    } else if (node.splitAxis === 'v') {
      var overlapY1 = Math.max(node.left.y, node.right.y) + 2;
      var overlapY2 = Math.min(node.left.y + node.left.h, node.right.y + node.right.h) - 2 - doorWidth;
      if (overlapY2 < overlapY1) return;
      var dy = overlapY1 + Math.floor(rng() * (overlapY2 - overlapY1 + 1));
      for (var j = 0; j < doorWidth; j++) {
        if (grid[dy + j] && node.splitPos - 1 >= 0 && node.splitPos - 1 < grid[dy + j].length) {
          grid[dy + j][node.splitPos - 1] = '.'; markDoor(node.splitPos - 1, dy + j);
        }
        if (grid[dy + j] && node.splitPos >= 0 && node.splitPos < grid[dy + j].length) {
          grid[dy + j][node.splitPos] = '.'; markDoor(node.splitPos, dy + j);
        }
      }
      // Record center tile of this vertical-wall doorway (wall runs up-down → 'vertical')
      if (doorways) {
        doorways.push({
          x: node.splitPos,
          y: dy + Math.floor(doorWidth / 2),
          orientation: 'vertical',
          width: doorWidth
        });
      }
    }
  }

  // Occasionally merge two small adjacent chambers into a bigger room
  // by removing the entire shared wall instead of just a doorway
  function maybeMergeWall(grid, node, rng) {
    if (!node.left || !node.right) return false;
    // Only merge if both children are leaves
    if (node.left.left || node.right.left) return false;
    var leftArea = node.left.w * node.left.h;
    var rightArea = node.right.w * node.right.h;
    if (leftArea > 180 || rightArea > 180) return false; // allow larger merges
    if (rng() > 0.45) return false; // 45% chance (was 25%)

    // Remove the entire shared wall (both layers)
    if (node.splitAxis === 'h') {
      var x1 = Math.max(node.left.x, node.right.x) + 1;
      var x2 = Math.min(node.left.x + node.left.w, node.right.x + node.right.w) - 1;
      for (var x = x1; x < x2; x++) {
        if (grid[node.splitPos - 1]) grid[node.splitPos - 1][x] = '.';
        if (grid[node.splitPos]) grid[node.splitPos][x] = '.';
      }
    } else if (node.splitAxis === 'v') {
      var y1 = Math.max(node.left.y, node.right.y) + 1;
      var y2 = Math.min(node.left.y + node.left.h, node.right.y + node.right.h) - 1;
      for (var y = y1; y < y2; y++) {
        if (grid[y]) {
          grid[y][node.splitPos - 1] = '.';
          grid[y][node.splitPos] = '.';
        }
      }
    }
    return true;
  }

  // Randomly remove some inner chambers entirely (create dead-end walls / filler)
  function removeChamber(grid, leaf) {
    for (var y = leaf.y; y < leaf.y + leaf.h; y++) {
      for (var x = leaf.x; x < leaf.x + leaf.w; x++) {
        if (grid[y] && x >= 0 && x < grid[y].length) {
          grid[y][x] = '#';
        }
      }
    }
  }

  // Weighted random pick: weights is an array of numbers, returns chosen index
  function weightedPick(rng, weights) {
    var total = 0;
    for (var i = 0; i < weights.length; i++) total += weights[i];
    var r = rng() * total;
    for (var j = 0; j < weights.length; j++) {
      r -= weights[j];
      if (r <= 0) return j;
    }
    return weights.length - 1;
  }

  // Returns an enemy type number (1-6) biased by the current theme
  function pickEnemyType(rng, theme) {
    // Types: 1=basic, 2=fast, 3=brute, 4=ranged, 5=shadow, 6=chainguard, 7=imp, 8=mage, 9=archer
    // We map to the numeric types used in the existing system (1-4 range is safe default)
    var pools = {
      crypt:     { types: [5, 1],    weights: [5, 1] },
      cathedral: { types: [8, 6],    weights: [4, 6] },
      sewer:     { types: [3, 1, 2], weights: [3, 1, 2] },
      dungeon:   { types: [1, 2, 3, 4], weights: [1, 1, 1, 1] }
    };
    var pool = pools[theme.id] || pools.dungeon;
    var idx = weightedPick(rng, pool.weights);
    return pool.types[idx];
  }

  /**
   * Generate a D2-style procedural room.
   * @param {Object} opts - { width, height, seed, name }
   */
  function generate(opts) {
    opts = opts || {};
    var width = opts.width || 80;
    var height = opts.height || 80;
    var seed = opts.seed || Math.floor(Math.random() * 1e9);

    var rng = mulberry32(seed);

    // Theme pool — pick deterministically from the seed
    // Each theme includes cosmetic tints for visual variety (030-large-room-variety)
    var THEMES = [
      { id: 'crypt',      floor: 'floor_stone_dark',  wall: 'wall_dungeon',     tags: ['dark', 'crypt'],        floorTint: 0xccccdd, wallTint: 0xbbbbcc, propSet: 'ancient' },
      { id: 'cathedral',  floor: 'floor_tile_ornate', wall: 'wall_stone_large', tags: ['grand', 'holy'],        floorTint: 0xffe8c0, wallTint: 0xffd8a0, propSet: 'ancient' },
      { id: 'sewer',      floor: 'floor_cobble',      wall: 'wall_brick',       tags: ['dirty', 'underground'], floorTint: 0x99bbaa, wallTint: 0x88aa99, propSet: 'flooded' },
      { id: 'dungeon',    floor: 'floor_stone',       wall: 'obstacleWall',     tags: ['basic'],                floorTint: 0xffffff, wallTint: 0xffffff, propSet: 'crumbling' },
      { id: 'overgrown',  floor: 'floor_cobble',      wall: 'wall_brick',       tags: ['nature', 'ruin'],       floorTint: 0xaaddaa, wallTint: 0x99cc99, propSet: 'overgrown' },
      { id: 'bloodstained', floor: 'floor_stone_dark', wall: 'wall_dungeon',    tags: ['dark', 'horror'],       floorTint: 0xddaaaa, wallTint: 0xcc9999, propSet: 'bloodstained' },
      { id: 'frozen',     floor: 'floor_stone',       wall: 'wall_stone_large', tags: ['cold', 'ice'],          floorTint: 0xccddff, wallTint: 0xbbccee, propSet: 'ancient' }
    ];
    var theme = THEMES[Math.floor(rng() * THEMES.length)];

    var name = opts.name || (theme.id + '_Procedural_' + seed);

    // 1) All walls grid
    var grid = [];
    for (var y = 0; y < height; y++) {
      var row = new Array(width);
      for (var x = 0; x < width; x++) row[x] = '#';
      grid.push(row);
    }

    // 2) BSP split — aim for many small chambers (min 8 tile size)
    var root = new Node(0, 0, width, height);
    var MIN_NODE = 9;
    var queue = [root];
    var iter = 0;
    while (queue.length && iter < 200) {
      iter++;
      var n = queue.shift();
      if (splitNode(n, MIN_NODE, rng)) {
        queue.push(n.left);
        queue.push(n.right);
      }
    }

    // 3) Collect all leaves (chambers)
    var allLeaves = [];
    collectLeaves(root, allLeaves);

    // 3b) Mark some leaves as "sealed" — they stay solid wall, never carved.
    //     Creates inaccessible background structure, like masonry/cliffs in D2.
    //     Skip if it would seal the very first leaf (player spawn).
    var sealedLeaves = new Set();
    for (var li = 1; li < allLeaves.length; li++) {
      var leaf = allLeaves[li];
      var area = leaf.w * leaf.h;
      // Don't seal too-tiny or too-huge leaves. Mid-range 40-200 tiles area.
      if (area < 40 || area > 200) continue;
      if (rng() < 0.20) { // 20% of mid-sized leaves stay solid
        sealedLeaves.add(leaf);
      }
    }

    // Active leaves = those that will be carved as chambers
    var leaves = allLeaves.filter(function (l) { return !sealedLeaves.has(l); });

    // 4) Carve all active chambers (sealed ones remain solid wall)
    leaves.forEach(function (l) { carveChamber(grid, l); });

    // 4b) Open halls: randomly pick some internal subtrees and flatten them
    //     into one big open area — no interior walls. Creates large D2-style
    //     halls mixed with the smaller chambers.
    var openedSubtrees = new Set();
    var openHallRects = []; // track open hall bounds for extra decoration/spawns
    var candidateSubtrees = [];
    collectInternalNodes(root, candidateSubtrees);
    // Shuffle for variety
    for (var si = candidateSubtrees.length - 1; si > 0; si--) {
      var sj = Math.floor(rng() * (si + 1));
      var tmp = candidateSubtrees[si]; candidateSubtrees[si] = candidateSubtrees[sj]; candidateSubtrees[sj] = tmp;
    }
    // Make 1-2 open halls per room, preferring mid-sized subtrees
    var openCount = 1 + Math.floor(rng() * 2);
    var opened = 0;
    for (var ci = 0; ci < candidateSubtrees.length && opened < openCount; ci++) {
      var subtree = candidateSubtrees[ci];
      var subArea = subtree.w * subtree.h;
      // Skip tiny subtrees (boring) and massive ones (would eat the whole room)
      if (subArea < 300 || subArea > (width * height * 0.45)) continue;
      // Check if any ancestor already opened
      var alreadyOpened = false;
      var scan = subtree;
      while (scan) {
        if (openedSubtrees.has(scan)) { alreadyOpened = true; break; }
        scan = scan.parent;
      }
      if (alreadyOpened) continue;
      // Carve the whole subtree area as floor (1-tile wall border preserved)
      for (var oy2 = subtree.y + 1; oy2 < subtree.y + subtree.h - 1; oy2++) {
        for (var ox2 = subtree.x + 1; ox2 < subtree.x + subtree.w - 1; ox2++) {
          if (grid[oy2] && ox2 >= 0 && ox2 < grid[oy2].length) grid[oy2][ox2] = '.';
        }
      }
      openedSubtrees.add(subtree);
      openHallRects.push({ x: subtree.x, y: subtree.y, w: subtree.w, h: subtree.h });
      opened++;
    }

    // 5) Connect adjacent chambers — either merge wall (make bigger room)
    //    or carve a doorway. Process internal nodes bottom-up.
    //    Skip nodes inside opened subtrees (they're already one big hall).
    var internal = [];
    collectInternalNodes(root, internal);
    internal.reverse();
    var doorwayTiles = {}; // 'y|x' -> true, so we can keep objects off these tiles
    var doorways = [];    // [{x, y, orientation}] center tile of each carved doorway
    // Helper: does a subtree contain any non-sealed leaf?
    var hasActiveLeaf = function (n) {
      if (!n) return false;
      if (!n.left && !n.right) return !sealedLeaves.has(n);
      return hasActiveLeaf(n.left) || hasActiveLeaf(n.right);
    };

    internal.forEach(function (node) {
      // Skip if inside an opened hall
      var a = node;
      while (a) { if (openedSubtrees.has(a)) return; a = a.parent; }
      // Skip if either child subtree is entirely sealed (no carved chamber to connect)
      if (!hasActiveLeaf(node.left) || !hasActiveLeaf(node.right)) return;

      if (!maybeMergeWall(grid, node, rng)) {
        carveDoorway(grid, node, rng, doorwayTiles, doorways);
      }
    });

    // 6) Randomly fill some small chambers to create visual asymmetry
    //    (these become dead-end wall blocks — natural asymmetry like D2)
    leaves.forEach(function (l) {
      if (l.w * l.h < 60 && rng() < 0.15) {
        removeChamber(grid, l);
      }
    });

    // 6b) Re-stamp doorway tiles as floor — removeChamber may have
    //     filled them back in, blocking previously-carved passages
    Object.keys(doorwayTiles).forEach(function (key) {
      var parts = key.split('|');
      var dy = parseInt(parts[0], 10);
      var dx = parseInt(parts[1], 10);
      if (grid[dy] && dx >= 0 && dx < grid[dy].length) {
        grid[dy][dx] = '.';
      }
    });

    // 7) Ensure outer border is wall
    for (var bx = 0; bx < width; bx++) { grid[0][bx] = '#'; grid[height - 1][bx] = '#'; }
    for (var by = 0; by < height; by++) { grid[by][0] = '#'; grid[by][width - 1] = '#'; }

    // 8) Find accessible chambers (flood from first chamber center)
    var accessibleChambers = floodAccessible(grid, leaves);

    // Fallback: if flood found nothing, use all leaves
    if (accessibleChambers.length === 0) accessibleChambers = leaves.slice();

    // 9) Convert to strings
    var walls = grid.map(function (r) { return r.join(''); });

    // 10) Pick player spawn in first accessible chamber
    var firstChamber = accessibleChambers[0];
    var playerSpawn = {
      x: firstChamber.x + Math.floor(firstChamber.w / 2),
      y: firstChamber.y + Math.floor(firstChamber.h / 2)
    };

    // 11) Entrances on edges closest to playerSpawn
    var entrances = [];
    // North: find the floor tile closest to playerSpawn.x in top rows
    var topX = findNearestFloorInRow(grid, 1, playerSpawn.x);
    if (topX >= 0) entrances.push({ x: topX, y: 1, dir: 'N' });
    var botX = findNearestFloorInRow(grid, height - 2, playerSpawn.x);
    if (botX >= 0) entrances.push({ x: botX, y: height - 2, dir: 'S' });

    // 12) Enemy spawns in later chambers (skip first). Large chambers get
    //     multiple groups scattered within. Total density ~1 enemy per 40
    //     floor tiles (D2-ish).
    var enemies = [];
    for (var ec = 1; ec < accessibleChambers.length; ec++) {
      var c = accessibleChambers[ec];
      var floorTiles = (c.w - 2) * (c.h - 2);
      // Dense mob population — more groups per chamber
      var groups = Math.max(2, Math.floor(floorTiles / 15));
      for (var g = 0; g < groups; g++) {
        // Larger packs — 6-10 per group (was 4-7)
        var groupSize = 6 + Math.floor(rng() * 5);
        var enemyType = pickEnemyType(rng, theme);
        enemies.push({
          type: enemyType,
          x: c.x + 1 + Math.floor(rng() * Math.max(1, c.w - 2)),
          y: c.y + 1 + Math.floor(rng() * Math.max(1, c.h - 2)),
          count: groupSize,
          radius: 4
        });
      }
    }

    // 13) Loot — sparse. No guaranteed large chest (the cleared-room reward
    //     chest handles that). Maybe 1 small/medium chest scattered.
    var loot = [];
    for (var lc = 1; lc < accessibleChambers.length; lc++) {
      if (rng() < 0.12) { // was 0.35 — now 12% per chamber
        var lr = accessibleChambers[lc];
        loot.push({
          x: lr.x + 1 + Math.floor(rng() * Math.max(1, lr.w - 2)),
          y: lr.y + 1 + Math.floor(rng() * Math.max(1, lr.h - 2)),
          type: rng() < 0.25 ? 'chest_medium' : 'chest_small'
        });
      }
    }

    // 14) Objects scattered — avoid doorway tiles (+ 1 tile buffer) so they
    //     never block passage. Brazier especially must not be near doors.
    var objects = [];
    var themeObjTypes = {
      crypt:     ['brazier', 'rubble', 'barrel'],
      cathedral: ['brazier', 'statue_knight', 'pillar_small'],
      sewer:     ['barrel', 'crate', 'rubble'],
      dungeon:   ['brazier', 'barrel', 'crate', 'rubble']
    };
    var objTypes = themeObjTypes[theme.id] || themeObjTypes.dungeon;
    var isDoorwayOrAdjacent = function (tx, ty) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (doorwayTiles[(ty + dy) + '|' + (tx + dx)]) return true;
        }
      }
      return false;
    };
    accessibleChambers.forEach(function (c) {
      var count = Math.floor(rng() * 3);
      for (var o = 0; o < count; o++) {
        // Try up to 6 times to find a non-doorway tile
        var placed = false;
        for (var attempt = 0; attempt < 6 && !placed; attempt++) {
          var ox = c.x + 1 + Math.floor(rng() * Math.max(1, c.w - 2));
          var oy = c.y + 1 + Math.floor(rng() * Math.max(1, c.h - 2));
          if (!isDoorwayOrAdjacent(ox, oy)) {
            objects.push({
              type: objTypes[Math.floor(rng() * objTypes.length)],
              x: ox, y: oy
            });
            placed = true;
          }
        }
      }
    });

    // 14b) Grand halls get EXTRA decoration and enemies — make them memorable.
    //      Scatter pillar rows, braziers, statues, and a dense mob pack.
    var hallObjTypes = ['pillar_large', 'pillar_small', 'brazier', 'statue_knight', 'altar'];
    openHallRects.forEach(function (hall) {
      var hallTiles = (hall.w - 2) * (hall.h - 2);

      // Lots of decoration — 1 per 15 tiles
      var decorCount = Math.max(4, Math.floor(hallTiles / 15));
      for (var d = 0; d < decorCount; d++) {
        for (var at = 0; at < 6; at++) {
          var ox = hall.x + 2 + Math.floor(rng() * Math.max(1, hall.w - 4));
          var oy = hall.y + 2 + Math.floor(rng() * Math.max(1, hall.h - 4));
          if (!isDoorwayOrAdjacent(ox, oy)) {
            // 70% normal obstacles, 30% grand objects
            var typePool = rng() < 0.3 ? hallObjTypes : objTypes;
            objects.push({
              type: typePool[Math.floor(rng() * typePool.length)],
              x: ox, y: oy
            });
            break;
          }
        }
      }

      // Extra enemy packs in halls — 4-6 big groups, dense
      var extraGroups = 4 + Math.floor(rng() * 3);
      for (var gg = 0; gg < extraGroups; gg++) {
        var hx = hall.x + 2 + Math.floor(rng() * Math.max(1, hall.w - 4));
        var hy = hall.y + 2 + Math.floor(rng() * Math.max(1, hall.h - 4));
        enemies.push({
          type: pickEnemyType(rng, theme),
          x: hx, y: hy,
          count: 8 + Math.floor(rng() * 5), // 8-12 per pack
          radius: 5
        });
      }

      // Maybe place a medium chest as reward-teaser in the hall
      if (rng() < 0.4) {
        var chx = hall.x + Math.floor(hall.w / 2);
        var chy = hall.y + Math.floor(hall.h / 2);
        loot.push({
          x: chx, y: chy,
          type: rng() < 0.5 ? 'chest_medium' : 'chest_small'
        });
      }
    });

    return {
      name: name,
      tags: ['procedural', 'large'].concat(theme.tags),
      size: { tile: 32, w: width, h: height },
      tiles: { floor: theme.floor },
      layout: {
        legend: { '#': theme.wall, '.': theme.floor },
        walls: walls
      },
      entrances: entrances,
      objects: objects,
      spawns: { player: playerSpawn, enemies: enemies, loot: loot },
      doorways: doorways,
      theme: { id: theme.id, floorTint: theme.floorTint, wallTint: theme.wallTint, propSet: theme.propSet },
      _procedural: true,
      _seed: seed
    };
  }

  function findNearestFloorInRow(grid, targetRow, preferredX) {
    var best = -1;
    var bestDist = Infinity;
    // Look in rows near the edge for accessible floor tiles
    for (var scanRow = targetRow; scanRow < targetRow + 3 && scanRow < grid.length - 1; scanRow++) {
      for (var x = 1; x < grid[scanRow].length - 1; x++) {
        if (grid[scanRow][x] === '.') {
          var d = Math.abs(x - preferredX);
          if (d < bestDist) { bestDist = d; best = x; }
        }
      }
      if (best >= 0) break;
    }
    return best;
  }

  // Flood-fill from first chamber to find all connected chambers (ordered by discovery)
  function floodAccessible(grid, leaves) {
    if (!leaves.length) return [];
    var startLeaf = leaves[0];
    var startX = startLeaf.x + Math.floor(startLeaf.w / 2);
    var startY = startLeaf.y + Math.floor(startLeaf.h / 2);
    if (grid[startY][startX] !== '.') return [];

    var w = grid[0].length, h = grid.length;
    var visited = new Array(h);
    for (var i = 0; i < h; i++) visited[i] = new Array(w).fill(false);

    var queue = [[startX, startY]];
    visited[startY][startX] = true;
    var reachableTiles = 0;
    while (queue.length) {
      var p = queue.shift();
      reachableTiles++;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var d = 0; d < 4; d++) {
        var nx = p[0] + dirs[d][0];
        var ny = p[1] + dirs[d][1];
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (visited[ny][nx]) continue;
        if (grid[ny][nx] !== '.') continue;
        visited[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }

    // Return leaves that overlap reachable tiles
    var result = [];
    leaves.forEach(function (l) {
      var cx = l.x + Math.floor(l.w / 2);
      var cy = l.y + Math.floor(l.h / 2);
      if (visited[cy] && visited[cy][cx]) result.push(l);
    });
    return result;
  }

  window.ProceduralRooms = { generate: generate, mulberry32: mulberry32 };
})();
