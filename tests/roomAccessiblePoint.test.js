// Unit tests for pointAccessibleInGrid (Issue #57).
//
// The accessible-area grid is anchored to the physics-world bounds, while room
// tiles are placed at the room's own origin. A legit player-spawn center can
// therefore map to a slightly-off, wall-clearance-blocked cell and wrongly read
// as inaccessible. pointAccessibleInGrid tolerates a sub-cell offset by also
// checking the neighbour cells toward the point's nearest cell edge.

const { test, before } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

let P; // pointAccessibleInGrid

before(() => {
  if (!globalThis.window) require('./setup');
  loadGameModule('js/roomManager.js');
  P = globalThis.window.pointAccessibleInGrid;
});

// Build a minimal grid whose only accessible cell is (5,5).
function grid(visitedKeys) {
  return { cellSize: 32, cols: 10, rows: 10, bounds: { x: 0, y: 0 }, visited: new Set(visitedKeys) };
}
const CELL = 32;
const center = (c) => c * CELL + CELL / 2; // world center of a cell index

test('null grid is treated as accessible (no restriction yet)', () => {
  assert.strictEqual(P(null, 100, 100), true);
});

test('a point inside a visited cell is accessible', () => {
  const g = grid(['5|5']);
  assert.strictEqual(P(g, center(5), center(5)), true);
});

test('sub-cell offset: point in an unvisited cell but leaning toward a visited neighbour is accessible (#57)', () => {
  const g = grid(['5|5']);
  // x just inside cell 6 (192..224) but in its left half (<208) -> leans toward cell 5.
  assert.strictEqual(P(g, 196, center(5)), true, 'leans left into the visited cell');
  // same on the y axis: cell (5,6) leaning up toward (5,5).
  assert.strictEqual(P(g, center(5), 196), true, 'leans up into the visited cell');
});

test('a point more than half a cell away from any visited cell stays inaccessible', () => {
  const g = grid(['5|5']);
  // cell 6, right half (>208) -> leans away from cell 5, no visited neighbour that way.
  assert.strictEqual(P(g, 220, center(5)), false, 'leans away -> not falsely accessible');
  // deep in an all-unvisited corner.
  assert.strictEqual(P(g, 16, 16), false);
});

test('a point outside the grid bounds is inaccessible', () => {
  const g = grid(['5|5']);
  assert.strictEqual(P(g, -50, -50), false);
  assert.strictEqual(P(g, 100000, 100000), false);
});
