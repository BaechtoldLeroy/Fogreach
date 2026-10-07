// tests/bodenfeuer.test.js — eine zerschlagene Feuerschale laesst den Boden
// WIRKLICH brennen, und zwar als Bild.
//
// spawnFloorFire zeichnete sieben Dreiecke in zufaelliger Hoehe, achtzigmal
// die Sekunde neu. Es flackerte, sah aber aus wie das, was es war — und seit
// die Schale selbst Pixelgrafik ist, stand daneben ein gezeichnetes Feuer.
//
// Zwei Dinge sollen hier haengen bleiben:
//   1. Das Zerschlagen loest ueberhaupt etwas aus. Der Weg geht ueber
//      breakDestructibleObstacle -> Typ faengt mit 'brazier' an ->
//      spawnFloorFire. Faellt eines davon weg, brennt gar nichts, und im
//      Spiel sieht man nur, dass die Schale verschwindet.
//   2. Das Feuer BEWEGT sich. Ein stehendes Bild waere kaum besser als die
//      Dreiecke.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');
const ANZAHL = 9;

test('es gibt neun Flammenbilder fuer den Boden', async () => {
  for (let i = 0; i < ANZAHL; i++) {
    const f = path.join(ORDNER, 'floorFire' + i + '.png');
    assert.ok(fs.existsSync(f), 'floorFire' + i + '.png fehlt');
    const m = await sharp(f).metadata();
    assert.strictEqual(m.width, m.height, 'floorFire' + i + ' ist nicht quadratisch');
  }
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

test('eine zerschlagene Feuerschale setzt ein brennendes Bild', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (typeof breakDestructibleObstacle !== 'function') return { kein: 'kein Zerschlagen' };
    var o = window.RoomTemplates.spawnObstacle(player.x + 320, player.y + 320, 'brazier');
    if (!o) return { kein: 'keine Schale' };
    var vorher = sc.children.list.length;
    breakDestructibleObstacle(sc, o);
    // Das Flammenbild unter den neu entstandenen Kindern suchen.
    var neu = sc.children.list.slice(vorher);
    var feuer = null;
    for (var i = 0; i < neu.length; i++) {
      var c = neu[i];
      if (c && c.texture && /^floorFire/.test(c.texture.key)) { feuer = c; break; }
    }
    if (!feuer) {
      return { kein: 'kein Flammenbild, nur: '
        + neu.map(function (c) { return (c.type || '?'); }).join(', ') };
    }
    window.__bfeuer = feuer;
    return {
      anim: (feuer.anims && feuer.anims.currentAnim) ? feuer.anims.currentAnim.key : null,
      breite: Math.round(feuer.displayWidth),
      tiefe: feuer.depth
    };
  })()`);
  if (r.kein) assert.fail(r.kein);
  assert.strictEqual(r.anim, 'bodenfeuer_brennen', 'es laeuft ' + r.anim);
  // radius 46 * 2.2 = etwa 101 px breit.
  assert.ok(r.breite > 60 && r.breite < 160,
    'das Feuer ist ' + r.breite + ' px breit — das passt nicht zum Wirkradius');
  // Hinter den Figuren, aber ueber dem Boden.
  const T = H.run('window.WELT_TIEFEN');
  assert.ok(r.tiefe < T.GEGNER, 'das Feuer (' + r.tiefe + ') liegt vor den Gegnern');

  // Und es muss sich bewegen — die ECHTE Schleife pumpen.
  const gesehen = new Set();
  for (let i = 0; i < 60 && gesehen.size < 3; i++) {
    const k = H.run(`(function () {
      var f = window.__bfeuer;
      return (f && f.active && f.texture) ? f.texture.key : null;
    })()`);
    if (k) gesehen.add(k);
    H.step(4);
  }
  assert.ok(gesehen.size >= 3,
    'ueber 60 Takte nur ' + gesehen.size + ' Bilder (' + [...gesehen].join(', ') + ')');
});
