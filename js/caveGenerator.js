// js/caveGenerator.js — Procedural cave generator (Cellular-Automata-style)
//
// Sibling to js/proceduralRooms.js. Where that one produces D2-style rectangular
// chambers (BSP, shared walls, axis-aligned doorways), THIS one produces organic
// erosion-cave layouts: irregular blob-shaped open areas, jagged wall edges, no
// rectangular structure, no shared chamber walls.
//
// Output is a template object with the same shape as roomTemplates/*.json — it
// plugs into RT.TEMPLATES via window.RoomTemplates.TEMPLATES[name] and is then
// consumed by applyRoomTemplate exactly like an authored template.
//
// Algorithm:
//   1) Fill grid with random walls (~46 % density).
//   2) Run N iterations of a B5678/S45678 cellular-automata smoother. After
//      ~4 passes the noise collapses into smooth blob-shaped open regions
//      bounded by jagged walls.
//   3) Flood-fill from a guaranteed interior tile to find the largest open
//      region; everything outside that region is sealed (filled with wall).
//   4) Drill 1-2-tile-wide tunnels from the room's interior to the map edges
//      so doorways exist at N/S/E/W cardinals.
//   5) Sprinkle stalagmites, rubble, mushrooms, breakable crates onto floor
//      tiles using theme-specific prop sets.
//   6) Pick the player spawn near the "most open" floor tile and place loot
//      in the floor tile farthest from spawn (BFS distance).
//   7) Spawn 4-8 enemy clusters distributed across the open area.

(function () {
  'use strict';

  // ── PRNG ───────────────────────────────────────────────────────────────────
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

  // ── Grid helpers ───────────────────────────────────────────────────────────
  function makeGrid(w, h, fill) {
    var g = new Array(h);
    for (var y = 0; y < h; y++) {
      var row = new Array(w);
      for (var x = 0; x < w; x++) row[x] = fill;
      g[y] = row;
    }
    return g;
  }

  function inBounds(g, x, y) {
    return y >= 0 && y < g.length && x >= 0 && x < g[0].length;
  }

  function countWallNeighbors(g, cx, cy) {
    var n = 0;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        var nx = cx + dx, ny = cy + dy;
        if (!inBounds(g, nx, ny) || g[ny][nx] === '#') n++;
      }
    }
    return n;
  }

  // One CA pass. Classic cave rule B5678/S45678: a wall stays a wall if it has
  // ≥4 wall neighbors; a floor becomes a wall if it has ≥5 wall neighbors.
  function stepCA(g) {
    var h = g.length, w = g[0].length;
    var next = makeGrid(w, h, '#');
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        // Hard border — always wall (so we have something to drill through later)
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          next[y][x] = '#';
          continue;
        }
        var n = countWallNeighbors(g, x, y);
        if (g[y][x] === '#') {
          next[y][x] = (n >= 4) ? '#' : '.';
        } else {
          next[y][x] = (n >= 5) ? '#' : '.';
        }
      }
    }
    return next;
  }

  // Cellular-automata caves naturally produce 1-tile-wide passages that BFS
  // treats as walkable but the player's 32-px physics body cannot squeeze
  // through (it wedges on the wall corners). This pass widens every
  // 1-tile-tube and 1-tile-diagonal-pinch so corridors are at least 2 wide
  // everywhere. We run multiple passes because opening one pinch may reveal
  // a new one downstream.
  function widenNarrowPassages(g) {
    var h = g.length, w = g[0].length;
    var MAX_PASSES = 4;
    for (var pass = 0; pass < MAX_PASSES; pass++) {
      var toOpen = [];
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          if (g[y][x] !== '.') continue;
          var wallN = g[y - 1][x] === '#';
          var wallS = g[y + 1][x] === '#';
          var wallW = g[y][x - 1] === '#';
          var wallE = g[y][x + 1] === '#';
          // Horizontal tube  ###       Vertical tube  #.#
          //                  ...                      #.#
          //                  ###                      #.#
          if (wallN && wallS && !wallW && !wallE) {
            // Open the side that has more open space behind it (avoids
            // breaking into another wall-bound dead-end).
            var nScore = 0, sScore = 0;
            for (var dx = -1; dx <= 1; dx++) {
              if (g[y - 2] && g[y - 2][x + dx] === '.') nScore++;
              if (g[y + 2] && g[y + 2][x + dx] === '.') sScore++;
            }
            var openY = (nScore >= sScore) ? y - 1 : y + 1;
            if (openY > 0 && openY < h - 1) toOpen.push({ x: x, y: openY });
          }
          if (wallW && wallE && !wallN && !wallS) {
            var wScore = 0, eScore = 0;
            for (var dy = -1; dy <= 1; dy++) {
              if (g[y + dy] && g[y + dy][x - 2] === '.') wScore++;
              if (g[y + dy] && g[y + dy][x + 2] === '.') eScore++;
            }
            var openX = (wScore >= eScore) ? x - 1 : x + 1;
            if (openX > 0 && openX < w - 1) toOpen.push({ x: openX, y: y });
          }
          // Diagonal pinch — floor at (x,y) and (x+1,y+1), walls at the other
          // two corners (or mirror). BFS treats this as connected via the
          // floor tiles, but the player can't squeeze through the wall corner.
          // Open one of the wall corners.
          if (wallE && wallS && g[y + 1] && g[y + 1][x + 1] === '.') {
            toOpen.push({ x: x + 1, y: y });
          }
          if (wallW && wallS && g[y + 1] && g[y + 1][x - 1] === '.') {
            toOpen.push({ x: x - 1, y: y });
          }
        }
      }
      if (toOpen.length === 0) break;
      toOpen.forEach(function (c) {
        if (c.x > 0 && c.x < w - 1 && c.y > 0 && c.y < h - 1 && g[c.y][c.x] === '#') {
          g[c.y][c.x] = '.';
        }
      });
    }
  }

  // BFS from (sx, sy) over floor tiles. Returns a 2D distance array (Infinity
  // for unreachable tiles) and the count of tiles reached.
  function bfsDistance(g, sx, sy) {
    var h = g.length, w = g[0].length;
    var dist = makeGrid(w, h, Infinity);
    if (!inBounds(g, sx, sy) || g[sy][sx] !== '.') {
      return { dist: dist, reached: 0 };
    }
    dist[sy][sx] = 0;
    var queue = [[sx, sy]];
    var reached = 0;
    while (queue.length) {
      var p = queue.shift();
      reached++;
      var px = p[0], py = p[1], d = dist[py][px];
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < 4; i++) {
        var nx = px + dirs[i][0], ny = py + dirs[i][1];
        if (!inBounds(g, nx, ny)) continue;
        if (g[ny][nx] !== '.') continue;
        if (dist[ny][nx] !== Infinity) continue;
        dist[ny][nx] = d + 1;
        queue.push([nx, ny]);
      }
    }
    return { dist: dist, reached: reached };
  }

  // Find the largest connected region of '.' tiles via repeated flood-fill.
  // Returns { mask: 2D bool, size, seed: {x,y} } for the winning region.
  function findLargestRegion(g) {
    var h = g.length, w = g[0].length;
    var visited = makeGrid(w, h, false);
    var best = { mask: null, size: 0, seed: null };
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        if (g[y][x] !== '.' || visited[y][x]) continue;
        var mask = makeGrid(w, h, false);
        var queue = [[x, y]];
        mask[y][x] = true;
        visited[y][x] = true;
        var size = 0;
        while (queue.length) {
          var p = queue.shift();
          size++;
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (var i = 0; i < 4; i++) {
            var nx = p[0] + dirs[i][0], ny = p[1] + dirs[i][1];
            if (!inBounds(g, nx, ny)) continue;
            if (g[ny][nx] !== '.') continue;
            if (visited[ny][nx]) continue;
            visited[ny][nx] = true;
            mask[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
        if (size > best.size) {
          best = { mask: mask, size: size, seed: { x: x, y: y } };
        }
      }
    }
    return best;
  }

  // Carve a `width`-tile-wide tunnel from (sx, sy) to (tx, ty) using a simple
  // Manhattan walk. Existing floor tiles are left alone; walls along the path
  // become floor. The path includes both the start and the target cell, so a
  // 2-wide tunnel always lands at the target with full width — not a 1-tile
  // pinch on the final step.
  function carveTunnel(g, sx, sy, tx, ty, width) {
    width = width || 1;
    function carveAt(cx, cy) {
      for (var dy = 0; dy < width; dy++) {
        for (var dx = 0; dx < width; dx++) {
          if (inBounds(g, cx + dx, cy + dy)) g[cy + dy][cx + dx] = '.';
        }
      }
    }
    var x = sx, y = sy;
    var safety = 500;
    while ((x !== tx || y !== ty) && safety-- > 0) {
      carveAt(x, y);
      if (x !== tx) x += (tx > x) ? 1 : -1;
      else if (y !== ty) y += (ty > y) ? 1 : -1;
    }
    carveAt(tx, ty);
  }

  // Find the innermost floor tile closest to the requested edge, used as the
  // tunnel target when drilling a doorway. Walks inward as far as needed; if
  // the entire grid is wall, returns null (caller will fall back to drilling
  // through walls toward the cave-region seed).
  function nearestFloorTowardEdge(g, edge) {
    var h = g.length, w = g[0].length;
    var maxDepth = Math.max(w, h);
    var hits = [];
    if (edge === 'N') {
      for (var y = 1; y < h - 1 && !hits.length; y++) {
        for (var x = 1; x < w - 1; x++) if (g[y][x] === '.') hits.push({ x: x, y: y });
      }
    } else if (edge === 'S') {
      for (var y2 = h - 2; y2 >= 1 && !hits.length; y2--) {
        for (var x2 = 1; x2 < w - 1; x2++) if (g[y2][x2] === '.') hits.push({ x: x2, y: y2 });
      }
    } else if (edge === 'W') {
      for (var x3 = 1; x3 < w - 1 && !hits.length; x3++) {
        for (var y3 = 1; y3 < h - 1; y3++) if (g[y3][x3] === '.') hits.push({ x: x3, y: y3 });
      }
    } else if (edge === 'E') {
      for (var x4 = w - 2; x4 >= 1 && !hits.length; x4--) {
        for (var y4 = 1; y4 < h - 1; y4++) if (g[y4][x4] === '.') hits.push({ x: x4, y: y4 });
      }
    }
    if (!hits.length) return null;
    // Prefer a hit near the middle of the edge so the tunnel is short.
    var midX = w / 2, midY = h / 2;
    hits.sort(function (a, b) {
      var da = (a.x - midX) * (a.x - midX) + (a.y - midY) * (a.y - midY);
      var db = (b.x - midX) * (b.x - midX) + (b.y - midY) * (b.y - midY);
      return da - db;
    });
    return hits[0];
  }

  // ── Themes ─────────────────────────────────────────────────────────────────
  // Each theme picks a floor + wall texture and a prop palette. The tints are
  // applied at sprite-bake time elsewhere in the engine (same hook used by
  // proceduralRooms.js).
  var THEMES = [
    {
      id: 'mossy_cave',
      floor: 'floor_cobble',
      wall: 'obstacleWall',
      tags: ['cave', 'mossy', 'damp'],
      floorTint: 0x99bb88,
      wallTint: 0x778866,
      propSet: 'mossy'
    },
    {
      id: 'crystal_cavern',
      floor: 'floor_stone',
      wall: 'wall_dungeon',
      tags: ['cave', 'crystal', 'magical'],
      floorTint: 0xbbccff,
      wallTint: 0x9999cc,
      propSet: 'crystal'
    },
    {
      id: 'ice_cavern',
      floor: 'floor_stone',
      wall: 'wall_stone_large',
      tags: ['cave', 'cold', 'ice'],
      floorTint: 0xddeeff,
      wallTint: 0xccddee,
      propSet: 'ice'
    },
    {
      id: 'magma_grotto',
      floor: 'floor_stone_dark',
      wall: 'obstacleWall',
      tags: ['cave', 'fire', 'volcanic'],
      floorTint: 0xddaa88,
      wallTint: 0xaa6644,
      propSet: 'volcanic'
    },
    {
      id: 'bone_pit',
      floor: 'floor_stone_dark',
      wall: 'wall_brick',
      tags: ['cave', 'undead', 'horror'],
      floorTint: 0xccccaa,
      wallTint: 0xaaaa88,
      propSet: 'bones'
    }
  ];

  // Theme-specific decoration sets. The types reference existing in-engine
  // sprites; the tint is applied to the bake so we don't need new art.
  var PROP_SETS = {
    mossy:    ['prop_puddle', 'prop_rubble', 'prop_cobweb'],
    crystal:  ['prop_rubble', 'prop_cobweb', 'prop_rubble'],
    ice:      ['prop_rubble', 'prop_puddle', 'prop_rubble'],
    volcanic: ['prop_rubble', 'prop_rubble', 'prop_cobweb'],
    bones:    ['prop_rubble', 'prop_cobweb', 'prop_rubble']
  };

  // Theme-specific solid props (act as obstacles). Reused engine art:
  // - `pillar_small`  = stalagmite (mossy/crystal/ice)
  // - `pillar_large`  = boulder / large crystal
  // - `barrel`/`crate`= breakable deposits
  // - `statue_knight` = cave-guardian carving (bone_pit only)
  var SOLID_PROPS = {
    mossy:    ['pillar_small', 'pillar_small', 'pillar_large'],
    crystal:  ['pillar_small', 'pillar_large', 'pillar_small'],
    ice:      ['pillar_small', 'pillar_large', 'pillar_small'],
    volcanic: ['pillar_small', 'pillar_large', 'pillar_small'],
    bones:    ['pillar_small', 'statue_knight', 'pillar_small']
  };

  function pickEnemyType(rng, depth) {
    // Lean toward cave-appropriate enemy IDs. Engine uses numeric types; the
    // mix mirrors what proceduralRooms.js does.
    var pool = [1, 1, 2, 2, 3, 4];
    if (depth >= 10) pool.push(5);
    if (depth >= 20) pool.push(5, 6);
    return pool[Math.floor(rng() * pool.length)];
  }

  // ── Main generator ────────────────────────────────────────────────────────
  function generate(opts) {
    opts = opts || {};
    // Untergrenze 56x48 = der historisch IMMER genutzte kleinste Cave (alter
    // Code: width 56-80, height 48-68). Cellular-Automata-Caves unter dieser
    // Grösse erzeugen eine zu kleine grösste Region -> abgeriegelte Bereiche +
    // Treppe ausserhalb des begehbaren Bereichs. Kleinere "small"-Buckets werden
    // hier auf den verlässlichen Cave-Boden gehoben (BSP-Räume bleiben klein).
    var width = Math.max(56, Math.min(120, opts.width || 64));
    var height = Math.max(48, Math.min(120, opts.height || 56));
    var seed = (opts.seed !== undefined) ? (opts.seed >>> 0) : (Math.floor(Math.random() * 1e9) >>> 0);
    var rng = mulberry32(seed);
    var depth = Math.max(1, opts.depth || (window.DUNGEON_DEPTH || 1));

    var theme = THEMES[Math.floor(rng() * THEMES.length)];
    var name = opts.name || (theme.id + '_Cave_' + seed);

    // 1) Random fill — ~46 % walls produces a noticeable wall presence after
    //    smoothing. Drop a bit lower for bigger open areas.
    var FILL = 0.46;
    var g = makeGrid(width, height, '#');
    for (var y = 1; y < height - 1; y++) {
      for (var x = 1; x < width - 1; x++) {
        g[y][x] = (rng() < FILL) ? '#' : '.';
      }
    }

    // 2) Smooth — 4 CA passes is the sweet spot for cave-shaped blobs.
    var ITERATIONS = 4;
    for (var i = 0; i < ITERATIONS; i++) g = stepCA(g);

    // 2b) Widen narrow passages so the player's physics body fits everywhere
    //     in the cave. Without this pass, CA tubes can be 1 tile wide which
    //     looks navigable on the BFS but wedges the player against corners.
    widenNarrowPassages(g);

    // 3) Largest-region keep — discard small islands.
    var region = findLargestRegion(g);
    if (!region.mask) {
      // Pathological case: CA produced no open area. Re-seed and retry once.
      if (!opts._retried) {
        return generate(Object.assign({}, opts, { seed: seed + 1, _retried: true }));
      }
      // Give up — return a tiny safe room so the engine doesn't crash.
      return makeFallbackRoom(width, height, theme, name, seed);
    }
    for (var ry = 0; ry < height; ry++) {
      for (var rx = 0; rx < width; rx++) {
        if (g[ry][rx] === '.' && !region.mask[ry][rx]) g[ry][rx] = '#';
      }
    }

    // 4) Drill cardinal doorways. Pick 2-3 of the 4 cardinals (always include
    //    N + S so the room has a clear traversal axis).
    var edges = ['N', 'S'];
    if (rng() < 0.7) edges.push(rng() < 0.5 ? 'W' : 'E');
    if (edges.length < 3 && rng() < 0.4) edges.push('W');
    edges = dedupe(edges);

    var entrances = [];
    edges.forEach(function (edge) {
      var target = nearestFloorTowardEdge(g, edge);
      if (!target) return;
      var ex, ey;
      if (edge === 'N') { ex = target.x; ey = 0; }
      else if (edge === 'S') { ex = target.x; ey = height - 1; }
      else if (edge === 'W') { ex = 0; ey = target.y; }
      else if (edge === 'E') { ex = width - 1; ey = target.y; }
      // 2-tile-wide tunnel for breathing room
      carveTunnel(g, ex, ey, target.x, target.y, 2);
      // Clamp the entrance tile so the engine's applyRoomTemplate doesn't
      // reject coords at exactly 0 or w-1 (its border-fill would re-wall them).
      entrances.push({
        x: clamp(edge === 'W' ? 1 : (edge === 'E' ? width - 2 : ex), 1, width - 2),
        y: clamp(edge === 'N' ? 1 : (edge === 'S' ? height - 2 : ey), 1, height - 2),
        dir: edge
      });
    });

    // 5) Pick player spawn — the floor tile with the highest "openness" score
    //    (count of floor tiles in a 5×5 neighborhood). Falls back to the
    //    region seed if no good spot is found.
    var spawn = pickOpenestTile(g, region.mask, rng) || region.seed;

    // 6) Loot — BFS-farthest floor tile from spawn, plus one mid-distance.
    var farMap = bfsDistance(g, spawn.x, spawn.y);
    var farPick = findFarthest(g, region.mask, farMap.dist);
    var midPick = findFarthest(g, region.mask, farMap.dist, 0.5);
    var loot = [];
    if (farPick) loot.push({ x: farPick.x, y: farPick.y, type: rng() < 0.5 ? 'chest_medium' : 'chest_small', locked: rng() < 0.3 });
    if (midPick && (midPick.x !== farPick?.x || midPick.y !== farPick?.y)) {
      loot.push({ x: midPick.x, y: midPick.y, type: 'chest_small' });
    }

    // 7) Decorations + breakable props. Lower density than BSP chambers — caves
    //    feel emptier and rely on geometry for interest.
    var floorTiles = collectFloor(g, region.mask, spawn, entrances, loot);
    var solidPool = SOLID_PROPS[theme.propSet] || SOLID_PROPS.mossy;
    var propPool = PROP_SETS[theme.propSet] || PROP_SETS.mossy;

    var objects = [];
    var decorations = [];
    var solidCount = Math.floor(floorTiles.length * 0.025); // ~2.5 % of floor
    var breakableCount = Math.floor(floorTiles.length * 0.015); // ~1.5 %
    var decorCount = Math.floor(floorTiles.length * 0.04);   // ~4 %

    shuffleInPlace(floorTiles, rng);
    var used = new Set();
    var keyOf = function (p) { return p.x + '|' + p.y; };

    for (var s1 = 0; s1 < solidCount && floorTiles.length; s1++) {
      var pos = floorTiles.pop();
      if (!pos || used.has(keyOf(pos))) continue;
      used.add(keyOf(pos));
      objects.push({ type: solidPool[Math.floor(rng() * solidPool.length)], x: pos.x, y: pos.y });
    }
    for (var b1 = 0; b1 < breakableCount && floorTiles.length; b1++) {
      var pos2 = floorTiles.pop();
      if (!pos2 || used.has(keyOf(pos2))) continue;
      used.add(keyOf(pos2));
      objects.push({ type: rng() < 0.5 ? 'barrel' : 'crate', x: pos2.x, y: pos2.y, breakable: true });
    }
    for (var d1 = 0; d1 < decorCount && floorTiles.length; d1++) {
      var pos3 = floorTiles.pop();
      if (!pos3 || used.has(keyOf(pos3))) continue;
      used.add(keyOf(pos3));
      decorations.push({ type: propPool[Math.floor(rng() * propPool.length)], x: pos3.x, y: pos3.y });
    }

    // 8) Enemy clusters — 4-8 packs, distributed by BFS distance buckets so we
    //    don't pile everyone at the spawn.
    var enemies = [];
    var packCount = 4 + Math.floor(rng() * 5);
    var clusterCandidates = collectFloor(g, region.mask, spawn, entrances, loot)
      .filter(function (t) {
        var d = farMap.dist[t.y] && farMap.dist[t.y][t.x];
        return Number.isFinite(d) && d >= 8;
      });
    shuffleInPlace(clusterCandidates, rng);
    for (var ec = 0; ec < packCount && clusterCandidates.length; ec++) {
      var spot = clusterCandidates.pop();
      enemies.push({
        type: pickEnemyType(rng, depth),
        x: spot.x, y: spot.y,
        count: 2 + Math.floor(rng() * 3),
        radius: 3
      });
    }

    // 9) Convert grid to wall-strings.
    var walls = g.map(function (row) { return row.join(''); });

    return {
      name: name,
      tags: ['procedural', 'cave', 'large'].concat(theme.tags),
      size: { tile: 32, w: width, h: height },
      tiles: { floor: theme.floor },
      layout: {
        legend: { '#': theme.wall, '.': theme.floor },
        walls: walls
      },
      entrances: entrances,
      objects: objects,
      spawns: { player: spawn, enemies: enemies, loot: loot },
      decorations: decorations,
      theme: { id: theme.id, floorTint: theme.floorTint, wallTint: theme.wallTint, propSet: theme.propSet },
      _procedural: true,
      _cave: true,
      _seed: seed
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function dedupe(arr) {
    var seen = {}, out = [];
    arr.forEach(function (v) { if (!seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }

  function shuffleInPlace(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  function pickOpenestTile(g, mask, rng) {
    var h = g.length, w = g[0].length;
    var best = null, bestScore = -1;
    // Sample 200 floor tiles uniformly; pick the one with the most floor tiles
    // in its 5×5 neighborhood.
    var samples = 0;
    var attempts = 0;
    while (samples < 200 && attempts < 2000) {
      attempts++;
      var x = 1 + Math.floor(rng() * (w - 2));
      var y = 1 + Math.floor(rng() * (h - 2));
      if (!mask[y][x]) continue;
      samples++;
      var score = 0;
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          var nx = x + dx, ny = y + dy;
          if (inBounds(g, nx, ny) && g[ny][nx] === '.') score++;
        }
      }
      if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
    }
    return best;
  }

  function findFarthest(g, mask, dist, ratio) {
    var h = g.length, w = g[0].length;
    var maxD = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        if (!mask[y][x]) continue;
        var d = dist[y][x];
        if (Number.isFinite(d) && d > maxD) maxD = d;
      }
    }
    var target = ratio ? Math.floor(maxD * ratio) : maxD;
    var hits = [];
    for (var y2 = 1; y2 < h - 1; y2++) {
      for (var x2 = 1; x2 < w - 1; x2++) {
        if (!mask[y2][x2]) continue;
        var d2 = dist[y2][x2];
        if (Number.isFinite(d2) && d2 >= target - 1 && d2 <= target + 1) hits.push({ x: x2, y: y2 });
      }
    }
    if (!hits.length) return null;
    return hits[Math.floor(Math.random() * hits.length)];
  }

  function collectFloor(g, mask, spawn, entrances, loot) {
    var h = g.length, w = g[0].length;
    var reserved = {};
    function reserve(x, y, r) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) reserved[(x + dx) + '|' + (y + dy)] = 1;
      }
    }
    if (spawn) reserve(spawn.x, spawn.y, 2);
    (entrances || []).forEach(function (e) { reserve(e.x, e.y, 1); });
    (loot || []).forEach(function (l) { reserve(l.x, l.y, 0); });
    var tiles = [];
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        if (!mask[y][x]) continue;
        if (reserved[x + '|' + y]) continue;
        tiles.push({ x: x, y: y });
      }
    }
    return tiles;
  }

  // Last-resort 12×12 box so the engine never crashes on a degenerate seed.
  function makeFallbackRoom(width, height, theme, name, seed) {
    var w = Math.max(16, Math.min(width, 24));
    var h = Math.max(16, Math.min(height, 20));
    var grid = makeGrid(w, h, '#');
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) grid[y][x] = '.';
    }
    var walls = grid.map(function (r) { return r.join(''); });
    return {
      name: name,
      tags: ['procedural', 'cave', 'fallback'].concat(theme.tags),
      size: { tile: 32, w: w, h: h },
      tiles: { floor: theme.floor },
      layout: { legend: { '#': theme.wall, '.': theme.floor }, walls: walls },
      entrances: [
        { x: Math.floor(w / 2), y: 1, dir: 'N' },
        { x: Math.floor(w / 2), y: h - 2, dir: 'S' }
      ],
      objects: [],
      spawns: { player: { x: Math.floor(w / 2), y: Math.floor(h / 2) }, enemies: [], loot: [] },
      decorations: [],
      theme: { id: theme.id, floorTint: theme.floorTint, wallTint: theme.wallTint, propSet: theme.propSet },
      _procedural: true,
      _cave: true,
      _seed: seed,
      _fallback: true
    };
  }

  window.CaveGenerator = { generate: generate, mulberry32: mulberry32 };
})();
