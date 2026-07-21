// Unit tests for js/hubPhaseView.js — die Phasen-Darstellung des Hubs.
//
// Phaser ist im Node-Lauf nicht da, also faehrt hier eine Fake-Szene mit, die
// jeden erzeugten Layer samt Depth/scrollFactor mitschreibt. Die Tests decken
// genau die Fehler ab, die im Playtest aufgefallen sind:
//   - Nebel/Schleier lagen HINTER den Figuren (Depth ~92 statt ueber ~200)
//   - weltfeste Dinge (Rathaus-Markierung, Tafeln) bekamen scrollFactor 0
//     und wanderten mit dem Spieler mit
//   - die Anschlagtafeln wurden gar nicht bzw. an Bildschirm-Prozenten gemalt

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

function makeGfx(rec) {
  const g = {
    _kind: 'graphics', depth: 0, scrollFactor: null, destroyed: false,
    calls: [],
    setDepth(d) { this.depth = d; return this; },
    setScrollFactor(v) { this.scrollFactor = v; return this; },
    destroy() { this.destroyed = true; }
  };
  ['fillStyle', 'fillRect', 'fillEllipse', 'fillCircle', 'fillTriangle',
   'fillPoints', 'lineStyle', 'strokePoints', 'strokeRect'].forEach((m) => {
    g[m] = function () { this.calls.push(m); return this; };
  });
  rec.push(g);
  return g;
}

function makeScene(opts) {
  const objects = [];
  const existing = (opts && opts.textures) || [];
  const scene = {
    objects,
    cameras: { main: { width: 800, height: 480 } },
    textures: { exists: (k) => existing.indexOf(k) >= 0 },
    add: {
      graphics: () => makeGfx(objects),
      rectangle(x, y, w, h, color, alpha) {
        const o = {
          _kind: 'rect', x, y, w, h, color, alpha, depth: 0, scrollFactor: null,
          destroyed: false,
          setDepth(d) { this.depth = d; return this; },
          setScrollFactor(v) { this.scrollFactor = v; return this; },
          destroy() { this.destroyed = true; }
        };
        objects.push(o);
        return o;
      },
      image(x, y, key) {
        const o = {
          _kind: 'image', x, y, key, depth: 0, scrollFactor: null, destroyed: false,
          setOrigin() { return this; },
          setDepth(d) { this.depth = d; return this; },
          setScrollFactor(v) { this.scrollFactor = v; return this; },
          destroy() { this.destroyed = true; }
        };
        objects.push(o);
        return o;
      }
    }
  };
  return scene;
}

function makeRefs() {
  return {
    bg: { x: 0, y: 0, originX: 0, originY: 0, tinted: null,
          setTint(c) { this.tinted = c; }, clearTint() { this.tinted = null; } },
    overlayDepth: 90,
    rathausRect: { x: 588.8, y: 176, w: 358.4, h: 268.8 },
    posterSpots: [{ x: 659.2, y: 480 }, { x: 876.8, y: 480 }]
  };
}

let V = null;
beforeEach(() => {
  if (!V) {
    if (!globalThis.window) globalThis.window = {};
    loadGameModule('js/hubPhase.js');
    loadGameModule('js/hubPhaseView.js');
    V = globalThis.window.HubPhaseView;
  }
});

const PHASES = ['council', 'doubleAgent', 'broken', 'epilogue'];

// --- Anschlagtafeln ---------------------------------------------------------

test('jede Phase zeichnet eine Tafel pro posterSpot', () => {
  PHASES.forEach((p) => {
    const scene = makeScene(), refs = makeRefs();
    V.apply(scene, p, refs);
    const boards = scene.objects.filter((o) => o._kind === 'graphics' && o.depth === 480);
    assert.strictEqual(boards.length, 2, p + ': zwei Tafeln erwartet');
  });
});

test('Tafeln sind weltfest und an der Standlinie tiefensortiert', () => {
  const scene = makeScene(), refs = makeRefs();
  V.apply(scene, 'council', refs);
  const boards = scene.objects.filter((o) => o._kind === 'graphics' && o.depth === 480);
  boards.forEach((b) => {
    assert.strictEqual(b.scrollFactor, 1, 'Tafel darf NICHT am Bildschirm kleben');
    assert.strictEqual(b.depth, 480, 'Depth = Standlinie (y-Sortierung)');
  });
});

test('ohne posterSpots werden keine Tafeln gezeichnet (kein Absturz)', () => {
  const scene = makeScene(), refs = makeRefs();
  delete refs.posterSpots;
  V.apply(scene, 'council', refs);
  const boards = scene.objects.filter((o) => o._kind === 'graphics' && o.depth === 480);
  assert.strictEqual(boards.length, 0);
});

test('gone zeichnet weniger als fresh (Plakate sind ab)', () => {
  const fresh = makeScene(), gone = makeScene();
  V.apply(fresh, 'council', makeRefs());
  V.apply(gone, 'epilogue', makeRefs());
  const count = (sc) => sc.objects
    .filter((o) => o._kind === 'graphics' && o.depth === 480)
    .reduce((n, b) => n + b.calls.length, 0);
  assert.ok(count(gone) < count(fresh), 'leeres Brett braucht weniger Zeichenschritte');
});

// --- Atmosphaere ------------------------------------------------------------

test('Nebel und Schleier liegen UEBER den Figuren', () => {
  // Figuren sind y-sortiert bis ~1000 (Sprites/Prompts). Alles darunter waere
  // hinter ihnen — genau der Bug aus dem Playtest.
  ['doubleAgent', 'broken', 'epilogue'].forEach((p) => {
    const scene = makeScene(), refs = makeRefs();
    V.apply(scene, p, refs);
    const full = scene.objects.filter((o) => o._kind === 'rect' && o.w === 800 && o.h === 480);
    assert.ok(full.length > 0, p + ': Vollbild-Atmosphaere erwartet');
    full.forEach((o) => {
      assert.ok(o.depth > 1000, p + ': Atmosphaere muss ueber den Figuren liegen, war ' + o.depth);
      assert.strictEqual(o.scrollFactor, 0, p + ': Atmosphaere ist bildschirmfest');
    });
  });
});

test('council hat keine Atmosphaere-Overlays', () => {
  const scene = makeScene(), refs = makeRefs();
  V.apply(scene, 'council', refs);
  const full = scene.objects.filter((o) => o._kind === 'rect' && o.w === 800 && o.h === 480);
  assert.strictEqual(full.length, 0);
});

// --- Rathaus ----------------------------------------------------------------

test('feindliche Rathaus-Markierung ist weltfest (scrollt nicht mit)', () => {
  const scene = makeScene(), refs = makeRefs();
  V.apply(scene, 'broken', refs);
  const mark = scene.objects.find((o) => o._kind === 'rect' && o.w === 358.4);
  assert.ok(mark, 'Markierung erwartet');
  assert.strictEqual(mark.scrollFactor, 1, 'Markierung klebt sonst am Bildschirm');
  assert.ok(mark.depth < 200, 'unter den Figuren — man laeuft davor');
});

test('nur broken markiert das Rathaus', () => {
  ['council', 'doubleAgent', 'epilogue'].forEach((p) => {
    const scene = makeScene(), refs = makeRefs();
    V.apply(scene, p, refs);
    assert.ok(!scene.objects.find((o) => o._kind === 'rect' && o.w === 358.4), p);
  });
});

// --- Idempotenz / Asset -----------------------------------------------------

test('erneutes apply raeumt die vorherigen Layer ab (kein Aufstapeln)', () => {
  const scene = makeScene(), refs = makeRefs();
  V.apply(scene, 'broken', refs);
  const first = scene.objects.slice();
  V.apply(scene, 'council', refs);
  assert.ok(first.every((o) => o.destroyed), 'alle Layer der ersten Phase zerstoert');
});

test('vorhandene Phasen-Textur ersetzt die gezeichneten Tafeln', () => {
  const scene = makeScene({ textures: ['hub_broken'] });
  V.apply(scene, 'broken', makeRefs());
  const img = scene.objects.find((o) => o._kind === 'image');
  assert.ok(img, 'Phasen-Textur erwartet');
  assert.strictEqual(img.scrollFactor, 1, 'Kulisse ist weltfest');
  const boards = scene.objects.filter((o) => o._kind === 'graphics' && o.depth === 480);
  assert.strictEqual(boards.length, 0, 'Textur bringt eigene Tafeln mit');
});

test('destroy() raeumt alles ab', () => {
  const scene = makeScene(), refs = makeRefs();
  const h = V.apply(scene, 'broken', refs);
  h.destroy();
  assert.ok(scene.objects.every((o) => o.destroyed));
  assert.strictEqual(refs.bg.tinted, null, 'Tint zurueckgesetzt');
});
