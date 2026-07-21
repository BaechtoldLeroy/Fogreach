// Unit tests for RoomTemplates.removeBrazierGlow (js/roomTemplates.js).
//
// Alle Brazier-Lichter landen aus Perf-Gruenden in EINEM geteilten Graphics
// (ein Draw-Call). Ein zerstoertes Brazier kann sein Licht daher nur verlieren,
// indem die verbliebenen Glows neu gezeichnet werden. Diese Tests decken genau
// diese Buchfuehrung ab — DOM-frei ueber ein Fake-Graphics, das seine Aufrufe
// mitschreibt.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

// Fake-Graphics: zaehlt clear() und sammelt die Mittelpunkte der Fuellkreise.
function makeGfx() {
  return {
    clears: 0,
    circles: [],
    clear() { this.clears++; this.circles.length = 0; return this; },
    fillStyle() { return this; },
    fillCircle(x, y, r) { this.circles.push({ x, y, r }); return this; }
  };
}

// Eindeutige Glow-Mittelpunkte (jeder Glow malt mehrere Ringe auf denselben Punkt).
function centers(gfx) {
  const seen = new Set();
  const out = [];
  for (const c of gfx.circles) {
    const k = c.x + '|' + c.y;
    if (!seen.has(k)) { seen.add(k); out.push({ x: c.x, y: c.y }); }
  }
  return out;
}

let RT = null;
beforeEach(() => {
  if (!RT) {
    if (!globalThis.window) globalThis.window = {};
    loadGameModule('js/roomTemplates.js');
    RT = globalThis.window.RoomTemplates;
  }
});

// Szene mit drei Braziers, wie sie der Raum-Aufbau hinterlaesst.
function sceneWith(points) {
  const gfx = makeGfx();
  return {
    _brazierGlowGfx: gfx,
    _brazierGlowPoints: points.map((p) => ({ x: p.x, y: p.y })),
    gfx
  };
}

test('removeBrazierGlow entfernt genau den getroffenen Glow', () => {
  const scene = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }]);
  const removed = RT.removeBrazierGlow(scene, 300, 100);
  assert.strictEqual(removed, true);
  assert.strictEqual(scene._brazierGlowPoints.length, 2);
  const left = centers(scene.gfx);
  assert.deepStrictEqual(left, [{ x: 100, y: 100 }, { x: 500, y: 100 }]);
});

test('das geteilte Graphics wird vor dem Neuzeichnen geleert', () => {
  const scene = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }]);
  RT.removeBrazierGlow(scene, 100, 100);
  assert.strictEqual(scene.gfx.clears, 1);
  assert.deepStrictEqual(centers(scene.gfx), [{ x: 300, y: 100 }]);
});

test('leichte Positionsabweichung trifft trotzdem (Toleranz)', () => {
  const scene = sceneWith([{ x: 100, y: 100 }]);
  // Der Obstacle-Mittelpunkt weicht um wenige Pixel vom Glow-Zentrum ab.
  assert.strictEqual(RT.removeBrazierGlow(scene, 112, 108), true);
  assert.strictEqual(scene._brazierGlowPoints.length, 0);
});

test('zu weit entfernt entfernt nichts', () => {
  const scene = sceneWith([{ x: 100, y: 100 }]);
  assert.strictEqual(RT.removeBrazierGlow(scene, 900, 900), false);
  assert.strictEqual(scene._brazierGlowPoints.length, 1);
  // Kein Neuzeichnen, wenn nichts entfernt wurde.
  assert.strictEqual(scene.gfx.clears, 0);
});

test('zweimal dasselbe Brazier entfernt nicht den Nachbarn', () => {
  const scene = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }]);
  assert.strictEqual(RT.removeBrazierGlow(scene, 100, 100), true);
  assert.strictEqual(RT.removeBrazierGlow(scene, 100, 100), false);
  assert.deepStrictEqual(scene._brazierGlowPoints, [{ x: 300, y: 100 }]);
});

test('robust ohne Glow-State (Raum ohne Braziers)', () => {
  assert.strictEqual(RT.removeBrazierGlow({}, 100, 100), false);
  assert.strictEqual(RT.removeBrazierGlow(null, 100, 100), false);
  assert.strictEqual(
    RT.removeBrazierGlow({ _brazierGlowGfx: makeGfx(), _brazierGlowPoints: [] }, 1, 1),
    false
  );
});
