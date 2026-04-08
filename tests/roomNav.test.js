// Unit tests for room navigation logic.
//
// applyRoomTemplate in js/roomTemplates.js is tightly coupled to Phaser, so we
// don't load it directly here. Instead these tests cover a parallel
// implementation of the same logic (protected-tile set + flood-fill
// reachability) that mirrors what applyRoomTemplate does. If the production
// code is updated, this file documents the contract.

const { test } = require('node:test');
const assert = require('node:assert');

// Mirror of the protected-tile builder used in roomTemplates.js
function buildProtectedTiles(template) {
  const set = new Set();
  const protect = (tx, ty, radius = 1) => {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        set.add(`${Math.round(tx) + dx}|${Math.round(ty) + dy}`);
      }
    }
  };
  if (template.spawns?.player) protect(template.spawns.player.x, template.spawns.player.y, 1);
  (template.entrances || []).forEach((e) => protect(e.x, e.y, 1));
  (template.spawns?.loot || []).forEach((l) => protect(l.x, l.y, 0));
  return set;
}

// Mirror of the flood-fill reachability check used in tools/testGame.js
function floodFill(walls, blocked, startX, startY) {
  const H = walls.length;
  const W = walls[0].length;
  const reach = Array.from({ length: H }, () => new Array(W).fill(false));
  if (startY < 0 || startY >= H || startX < 0 || startX >= W) return reach;
  if (blocked[startY][startX]) return reach;
  const queue = [[startX, startY]];
  reach[startY][startX] = true;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (reach[ny][nx] || blocked[ny][nx]) continue;
      reach[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }
  return reach;
}

// Tiny 10x10 fixture
function makeTemplate() {
  return {
    layout: {
      walls: [
        '##########',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '##########'
      ]
    },
    spawns: {
      player: { x: 5, y: 8 },
      loot: [{ x: 5, y: 1, type: 'chest_small' }]
    },
    entrances: [
      { x: 5, y: 0, dir: 'N' }
    ],
    objects: []
  };
}

test('protected tiles include player spawn + 1-tile buffer', () => {
  const tpl = makeTemplate();
  const set = buildProtectedTiles(tpl);
  // Spawn (5,8) plus 8 neighbors
  assert.ok(set.has('5|8'), 'spawn tile must be protected');
  assert.ok(set.has('4|8'), 'left neighbor must be protected');
  assert.ok(set.has('5|7'), 'top neighbor must be protected');
  assert.ok(set.has('6|9'), 'corner neighbor must be protected');
});

test('protected tiles include entrance + 1-tile buffer', () => {
  const tpl = makeTemplate();
  const set = buildProtectedTiles(tpl);
  assert.ok(set.has('5|0'), 'entrance tile must be protected');
  assert.ok(set.has('5|1'), 'tile next to entrance must be protected');
});

test('loot tile is protected (no buffer)', () => {
  const tpl = makeTemplate();
  const set = buildProtectedTiles(tpl);
  assert.ok(set.has('5|1'), 'loot tile must be protected');
});

test('flood fill reaches every walkable tile in an empty room', () => {
  const tpl = makeTemplate();
  const walls = tpl.layout.walls;
  const H = walls.length, W = walls[0].length;
  const blocked = walls.map((row) => row.split('').map((c) => c === '#'));
  const reach = floodFill(walls, blocked, 5, 8);
  let walkableCount = 0;
  let reachedCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!blocked[y][x]) {
        walkableCount++;
        if (reach[y][x]) reachedCount++;
      }
    }
  }
  assert.strictEqual(reachedCount, walkableCount, 'every walkable tile should be reachable from spawn');
});

test('flood fill respects an internal blocker wall', () => {
  // Build a 10x10 room with a horizontal wall at row 5 (cols 1..8) plus a
  // 1-tile gap at col 4 — only that gap connects top half to bottom half
  const walls = [
    '##########',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '###.######',
    '#........#',
    '#........#',
    '#........#',
    '##########'
  ];
  const blocked = walls.map((row) => row.split('').map((c) => c === '#'));
  // Spawn in the bottom half — top half should still be reachable through gap (3, 5)
  const reach = floodFill(walls, blocked, 5, 8);
  assert.strictEqual(reach[3][5], true, 'top half should be reachable through gap');
  // Now seal the gap
  blocked[5][3] = true;
  const reach2 = floodFill(walls, blocked, 5, 8);
  assert.strictEqual(reach2[3][5], false, 'top half must be unreachable when gap is sealed');
});
