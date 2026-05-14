// Unit tests for the cellular-automata cave generator (js/caveGenerator.js).
// Mirrors the contract used by tests/roomNav.test.js for authored templates:
// every generated cave must be dimensionally consistent, have a walkable
// spawn, and have every entrance + loot tile reachable from spawn via BFS.

const { test } = require('node:test');
const assert = require('node:assert');

// The module attaches to `window` — give it a stub.
global.window = global.window || {};
require('../js/caveGenerator.js');

function isBlockingChar(c, legend) {
  if (c === '#') return true;
  const mapped = (legend && legend[c]) || '';
  if (mapped === 'obstacleWall') return true;
  if (mapped.startsWith('wall_')) return true;
  if (mapped.startsWith('pillar_')) return true;
  return false;
}

function floodFill(walls, blocked, sx, sy) {
  const h = walls.length, w = walls[0].length;
  const reach = Array.from({ length: h }, () => new Array(w).fill(false));
  if (sy < 0 || sy >= h || sx < 0 || sx >= w) return reach;
  if (blocked[sy][sx]) return reach;
  const queue = [[sx, sy]];
  reach[sy][sx] = true;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (reach[ny][nx] || blocked[ny][nx]) continue;
      reach[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  return reach;
}

function assertCaveValid(tpl, label) {
  assert.ok(tpl, `${label}: generate() returned null`);
  assert.ok(tpl._procedural && tpl._cave, `${label}: _procedural + _cave flags must be set`);
  const { w, h } = tpl.size;
  const walls = tpl.layout.walls;
  assert.strictEqual(walls.length, h, `${label}: walls.length must equal size.h (${h})`);
  walls.forEach((row, i) => {
    assert.strictEqual(row.length, w, `${label}: walls[${i}] length must equal size.w (${w})`);
  });

  const legend = tpl.layout.legend || {};
  const blocked = walls.map((row) => row.split('').map((c) => isBlockingChar(c, legend)));

  const spawn = tpl.spawns && tpl.spawns.player;
  assert.ok(spawn, `${label}: template must define spawns.player`);
  assert.strictEqual(blocked[spawn.y][spawn.x], false, `${label}: spawn (${spawn.x},${spawn.y}) must be walkable`);

  const reach = floodFill(walls, blocked, spawn.x, spawn.y);

  assert.ok((tpl.entrances || []).length >= 2, `${label}: cave must define ≥ 2 entrances (got ${tpl.entrances?.length})`);
  for (const e of tpl.entrances) {
    assert.strictEqual(blocked[e.y][e.x], false, `${label}: entrance ${e.dir} tile (${e.x},${e.y}) must be walkable`);
    assert.strictEqual(reach[e.y][e.x], true, `${label}: entrance ${e.dir} tile (${e.x},${e.y}) must be reachable from spawn`);
  }
  for (const l of ((tpl.spawns && tpl.spawns.loot) || [])) {
    assert.strictEqual(blocked[l.y][l.x], false, `${label}: loot (${l.x},${l.y}) must be walkable`);
    assert.strictEqual(reach[l.y][l.x], true, `${label}: loot (${l.x},${l.y}) must be reachable from spawn`);
  }
}

test('CaveGenerator: API surface', () => {
  assert.ok(window.CaveGenerator, 'window.CaveGenerator must be exposed');
  assert.strictEqual(typeof window.CaveGenerator.generate, 'function', 'generate must be a function');
});

// Fixed-seed reproducibility: same seed → same output.
test('CaveGenerator: deterministic for a given seed', () => {
  const a = window.CaveGenerator.generate({ width: 60, height: 50, seed: 4242 });
  const b = window.CaveGenerator.generate({ width: 60, height: 50, seed: 4242 });
  assert.deepStrictEqual(a.layout.walls, b.layout.walls, 'same seed must yield identical wall grids');
  assert.deepStrictEqual(a.entrances, b.entrances, 'same seed must yield identical entrances');
  assert.deepStrictEqual(a.spawns.player, b.spawns.player, 'same seed must yield identical spawn');
});

// Reachability stress test: a handful of seeds + sizes. Any failure here is a
// genuine bug (player stranded behind unconnected geometry).
const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];
for (const seed of SEEDS) {
  test(`CaveGenerator: seed ${seed} produces a fully-reachable cave`, () => {
    const tpl = window.CaveGenerator.generate({ width: 60, height: 52, seed });
    assertCaveValid(tpl, `seed=${seed}`);
  });
}

// Size envelope — the integration point passes 56–80 wide × 48–68 tall.
test('CaveGenerator: works across the size envelope used by roomManager', () => {
  for (const w of [56, 64, 72, 80]) {
    for (const h of [48, 56, 64, 68]) {
      const tpl = window.CaveGenerator.generate({ width: w, height: h, seed: w * 1000 + h });
      assertCaveValid(tpl, `${w}x${h}`);
    }
  }
});

// Theme coverage — sample 50 random seeds, confirm we observed multiple themes
// and that every cave is valid.
test('CaveGenerator: 50 random seeds all validate; multiple themes observed', () => {
  const themesSeen = new Set();
  for (let i = 0; i < 50; i++) {
    const tpl = window.CaveGenerator.generate({ width: 64, height: 56 });
    assertCaveValid(tpl, `random #${i}`);
    themesSeen.add(tpl.theme.id);
  }
  assert.ok(themesSeen.size >= 3, `expected ≥ 3 themes across 50 samples, saw ${themesSeen.size}`);
});
