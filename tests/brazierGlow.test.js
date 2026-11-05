// Unit tests for RoomTemplates.registerBrazierGlow/removeBrazierGlow
// (js/roomTemplates.js).
//
// Jedes Brazier-Licht ist ein Bild derselben Textur (seit b528; vorher Kreise
// in einem geteilten Graphics, die Phaser jedes Bild neu triangulierte). Ein
// zerstoertes Brazier nimmt genau sein Bild mit. Diese Tests decken die
// Buchfuehrung ab — DOM-frei ueber eine Fake-Szene, die ihre Bilder mitschreibt.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

// Fake-Szene: die Glut-Textur wird einmal "gezeichnet", Bilder merken sich,
// ob sie zerstoert sind.
function makeScene() {
  const sc = {
    bilder: [],
    gezeichnet: 0,
    textures: { _k: {}, exists(k) { return !!this._k[k]; } },
    make: {
      graphics() {
        return {
          fillStyle() { return this; }, fillCircle() { return this; },
          generateTexture(k) { sc.gezeichnet++; sc.textures._k[k] = true; }, destroy() {}
        };
      }
    },
    add: {
      image(x, y, key) {
        const b = { x, y, key, weg: false, setDepth() { return this; }, destroy() { this.weg = true; } };
        sc.bilder.push(b);
        return b;
      }
    }
  };
  return sc;
}

// Lichter, die noch stehen.
function lichter(sc) {
  return sc.bilder.filter((b) => !b.weg).map((b) => ({ x: b.x, y: b.y }));
}
const punkte = (pts) => pts.map((p) => ({ x: p.x, y: p.y }));

let RT = null;
beforeEach(() => {
  if (!RT) {
    if (!globalThis.window) globalThis.window = {};
    loadGameModule('js/roomTemplates.js');
    RT = globalThis.window.RoomTemplates;
  }
});

// Szene mit Braziers, wie sie der Raum-Aufbau hinterlaesst.
function sceneWith(points) {
  const sc = makeScene();
  sc._brazierGlowPoints = [];
  points.forEach((p) => RT.registerBrazierGlow(sc, sc._brazierGlowPoints, p.x, p.y));
  return sc;
}

// Regression: _paintBrazierGlow lag zuerst in der IIFE am Dateikopf, der
// zeichnende Aufrufer (applyRoomTemplate) steht aber auf Top-Level und sah das
// Binding nicht -> "ReferenceError: _paintBrazierGlow is not defined" beim
// Betreten des ersten Raums mit Brazier. Dieser Test geht ueber den ECHTEN
// Zeichen-Pfad (die Glut-Textur malt _paintBrazierGlow).
test('registerBrazierGlow ist erreichbar und legt ein Licht hin (Scope-Regression)', () => {
  assert.strictEqual(typeof RT.registerBrazierGlow, 'function');
  const sc = makeScene();
  const pts = [];
  let bild = null;
  assert.doesNotThrow(function () { bild = RT.registerBrazierGlow(sc, pts, 120, 240); });
  assert.ok(bild, 'kein Bild');
  assert.deepStrictEqual(punkte(pts), [{ x: 120, y: 240 }]);
  assert.deepStrictEqual(lichter(sc), [{ x: 120, y: 240 }]);
});

test('die Glut-Textur wird nur einmal gezeichnet, alle Lichter teilen sie', () => {
  const sc = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }]);
  assert.strictEqual(sc.gezeichnet, 1);
  assert.strictEqual(new Set(sc.bilder.map((b) => b.key)).size, 1);
});

test('hinzufuegen und wieder entfernen greift ineinander', () => {
  const sc = makeScene();
  const pts = [];
  RT.registerBrazierGlow(sc, pts, 100, 100);
  RT.registerBrazierGlow(sc, pts, 300, 100);
  assert.deepStrictEqual(lichter(sc), [{ x: 100, y: 100 }, { x: 300, y: 100 }]);

  sc._brazierGlowPoints = pts;
  assert.strictEqual(RT.removeBrazierGlow(sc, 100, 100), true);
  assert.deepStrictEqual(lichter(sc), [{ x: 300, y: 100 }]);
  assert.strictEqual(pts.length, 1);
});

test('registerBrazierGlow ist robust ohne Szene/Liste', () => {
  assert.strictEqual(RT.registerBrazierGlow(null, [], 1, 1), false);
  assert.strictEqual(RT.registerBrazierGlow(makeScene(), null, 1, 1), false);
});

test('removeBrazierGlow entfernt genau den getroffenen Glow', () => {
  const sc = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 500, y: 100 }]);
  assert.strictEqual(RT.removeBrazierGlow(sc, 300, 100), true);
  assert.strictEqual(sc._brazierGlowPoints.length, 2);
  assert.deepStrictEqual(lichter(sc), [{ x: 100, y: 100 }, { x: 500, y: 100 }]);
});

test('leichte Positionsabweichung trifft trotzdem (Toleranz)', () => {
  const sc = sceneWith([{ x: 100, y: 100 }]);
  // Der Obstacle-Mittelpunkt weicht um wenige Pixel vom Glow-Zentrum ab.
  assert.strictEqual(RT.removeBrazierGlow(sc, 112, 108), true);
  assert.strictEqual(sc._brazierGlowPoints.length, 0);
  assert.deepStrictEqual(lichter(sc), []);
});

test('zu weit entfernt entfernt nichts', () => {
  const sc = sceneWith([{ x: 100, y: 100 }]);
  assert.strictEqual(RT.removeBrazierGlow(sc, 900, 900), false);
  assert.strictEqual(sc._brazierGlowPoints.length, 1);
  assert.deepStrictEqual(lichter(sc), [{ x: 100, y: 100 }]);
});

test('zweimal dasselbe Brazier entfernt nicht den Nachbarn', () => {
  const sc = sceneWith([{ x: 100, y: 100 }, { x: 300, y: 100 }]);
  assert.strictEqual(RT.removeBrazierGlow(sc, 100, 100), true);
  assert.strictEqual(RT.removeBrazierGlow(sc, 100, 100), false);
  assert.deepStrictEqual(punkte(sc._brazierGlowPoints), [{ x: 300, y: 100 }]);
  assert.deepStrictEqual(lichter(sc), [{ x: 300, y: 100 }]);
});

test('robust ohne Glow-State (Raum ohne Braziers)', () => {
  assert.strictEqual(RT.removeBrazierGlow({}, 100, 100), false);
  assert.strictEqual(RT.removeBrazierGlow(null, 100, 100), false);
  assert.strictEqual(RT.removeBrazierGlow({ _brazierGlowPoints: [] }, 1, 1), false);
});
