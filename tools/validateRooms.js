// tools/validateRooms.js
// Validates room template accessibility: spawn -> entrances/loot/enemies via flood fill.
// Wall character is '#'. Everything else is treated as walkable floor.

const fs = require('fs');
const path = require('path');

const ROOMS_DIR = path.resolve(__dirname, '..', 'js', 'roomTemplates');

function floodFill(walls, startX, startY) {
  const H = walls.length;
  const W = walls[0].length;
  const visited = new Set();
  if (startX < 0 || startX >= W || startY < 0 || startY >= H) return visited;
  if (walls[startY][startX] === '#') return visited;
  const queue = [[startX, startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const key = x + ',' + y;
    if (visited.has(key)) continue;
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    if (walls[y][x] === '#') continue;
    visited.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return visited;
}

function tileChar(walls, x, y) {
  if (y < 0 || y >= walls.length) return null;
  if (x < 0 || x >= walls[0].length) return null;
  return walls[y][x];
}

function validateRoom(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { name: path.basename(filePath), error: 'JSON parse: ' + e.message };
  }
  const name = json.name || path.basename(filePath, '.json');
  const walls = json.layout && json.layout.walls;
  if (!Array.isArray(walls) || walls.length === 0) {
    return { name, error: 'Missing layout.walls' };
  }
  const H = walls.length;
  const W = walls[0].length;

  // Validate uniform width
  for (let i = 0; i < walls.length; i++) {
    if (walls[i].length !== W) {
      return { name, error: `Row ${i} width ${walls[i].length} != ${W}` };
    }
  }

  const spawn = json.spawns && json.spawns.player;
  const issues = [];

  if (!spawn || typeof spawn.x !== 'number' || typeof spawn.y !== 'number') {
    issues.push({ kind: 'no_player_spawn' });
    return { name, W, H, issues };
  }

  const spawnTile = tileChar(walls, spawn.x, spawn.y);
  if (spawnTile === null) {
    issues.push({ kind: 'spawn_out_of_bounds', x: spawn.x, y: spawn.y });
    return { name, W, H, issues };
  }
  if (spawnTile === '#') {
    issues.push({ kind: 'spawn_in_wall', x: spawn.x, y: spawn.y });
  }

  const reachable = floodFill(walls, spawn.x, spawn.y);

  // Helper: a target is "reachable" if its tile is reachable, OR (since
  // entrances often sit on the boundary wall edge) any 4-neighbor is.
  function reachableInclEdge(x, y) {
    if (reachable.has(x + ',' + y)) return true;
    const neigh = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
    for (const [nx, ny] of neigh) {
      if (reachable.has(nx + ',' + ny)) return true;
    }
    return false;
  }

  // Entrances
  const entrances = Array.isArray(json.entrances) ? json.entrances : [];
  entrances.forEach((e, i) => {
    if (typeof e.x !== 'number' || typeof e.y !== 'number') return;
    if (!reachableInclEdge(e.x, e.y)) {
      issues.push({ kind: 'entrance_unreachable', index: i, x: e.x, y: e.y, dir: e.dir });
    }
  });

  // Loot
  const loot = (json.spawns && Array.isArray(json.spawns.loot)) ? json.spawns.loot : [];
  loot.forEach((l, i) => {
    if (typeof l.x !== 'number' || typeof l.y !== 'number') return;
    if (!reachableInclEdge(l.x, l.y)) {
      issues.push({ kind: 'loot_unreachable', index: i, x: l.x, y: l.y, type: l.type });
    }
  });

  // Enemies
  const enemies = (json.spawns && Array.isArray(json.spawns.enemies)) ? json.spawns.enemies : [];
  enemies.forEach((en, i) => {
    if (typeof en.x !== 'number' || typeof en.y !== 'number') return;
    if (!reachableInclEdge(en.x, en.y)) {
      issues.push({ kind: 'enemy_unreachable', index: i, x: en.x, y: en.y, type: en.type });
    }
  });

  return { name, W, H, issues, reachableCount: reachable.size };
}

function main() {
  const files = fs.readdirSync(ROOMS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .sort();

  const results = [];
  for (const f of files) {
    const r = validateRoom(path.join(ROOMS_DIR, f));
    r.file = f;
    results.push(r);
  }

  let broken = 0;
  console.log('=== Room Validation Report ===');
  for (const r of results) {
    if (r.error) {
      console.log(`[ERROR] ${r.file}: ${r.error}`);
      broken++;
      continue;
    }
    if (r.issues && r.issues.length > 0) {
      broken++;
      console.log(`[BROKEN] ${r.name} (${r.file}) ${r.W}x${r.H}`);
      for (const i of r.issues) {
        console.log('   - ' + JSON.stringify(i));
      }
    } else {
      console.log(`[OK] ${r.name}`);
    }
  }
  console.log(`\nSummary: ${results.length} rooms, ${broken} with issues.`);

  // Exit non-zero if anything is broken (useful for CI)
  if (broken > 0) process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { validateRoom, floodFill };
