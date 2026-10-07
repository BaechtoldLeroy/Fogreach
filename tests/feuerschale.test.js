// tests/feuerschale.test.js — die Feuerschale brennt wirklich.
//
// Sie war ein EINGEFRORENES Bild: graphics.js legte fuenf Fuellungen
// uebereinander und rief generateTexture. Der Kommentar daneben sprach von
// "animated-look" — bewegt hat sich nie etwas, und sie ist in vier
// Raumthemen die Hauptlichtquelle.
//
// Zwei Dinge, die schiefgehen koennen:
//   1. Die Animation laeuft gar nicht (Bild fehlt, Schluessel vertippt) — im
//      Spiel sieht das aus wie vorher, nur merkt es niemand.
//   2. Der KESSEL wandert. Die neun Bilder sind auf einer gemeinsamen Box
//      zugeschnitten; einzeln zugeschnitten sitzt der Kessel in jedem Bild
//      woanders, sobald die Flamme kleiner wird, und die Schale huepft.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');
const ANZAHL = 9;

test('es gibt neun Flammenbilder im Mass der Feuerschale', async () => {
  for (let i = 0; i < ANZAHL; i++) {
    const f = path.join(ORDNER, 'brazier' + i + '.png');
    assert.ok(fs.existsSync(f), 'brazier' + i + '.png fehlt');
    const m = await sharp(f).metadata();
    assert.strictEqual(m.width + 'x' + m.height, '24x32',
      'brazier' + i + ' ist ' + m.width + 'x' + m.height + ' statt 24x32');
  }
});

test('der KESSEL steht still, nur die Flamme bewegt sich', async () => {
  // Die untere Haelfte ist der Kessel mit den Beinen. Sie muss ueber alle
  // neun Bilder nahezu gleich bleiben; die obere darf sich stark aendern.
  const unten = [];
  const oben = [];
  for (let i = 0; i < ANZAHL; i++) {
    const { data } = await sharp(path.join(ORDNER, 'brazier' + i + '.png'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const o = [], u = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 24; x++) {
        const a = data[(y * 24 + x) * 4 + 3];
        (y < 16 ? o : u).push(a > 16 ? 1 : 0);
      }
    }
    oben.push(o); unten.push(u);
  }
  const abw = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  };
  // Die Flamme wird an IHRER Flaeche gemessen, nicht an der halben Kachel:
  // sie deckt nur 236 der 384 Punkte der oberen Haelfte, und bezogen auf die
  // ganze Haelfte sah selbst ein deutliches Flackern nach 4 % aus.
  let flamme = 0;
  for (let i = 0; i < oben[0].length; i++) {
    if (oben.some((f) => f[i])) flamme++;
  }
  assert.ok(flamme > 50, 'nur ' + flamme + ' Punkte Flamme — da stimmt etwas nicht');

  let maxUnten = 0, maxFlamme = 0;
  for (let i = 1; i < ANZAHL; i++) {
    maxUnten = Math.max(maxUnten, abw(unten[0], unten[i]));
    let s = 0;
    for (let k = 0; k < oben[0].length; k++) s += Math.abs(oben[0][k] - oben[i][k]);
    maxFlamme = Math.max(maxFlamme, s / flamme);
  }
  // Gemessen: Kessel 0.0 %, Flamme 6.8 %. Die Schwellen lassen Luft, treffen
  // aber den Fall "alle neun Bilder gleich" (0 %) sicher.
  assert.ok(maxUnten <= 0.01,
    'der Kessel wandert um ' + (maxUnten * 100).toFixed(1) + ' % seiner Flaeche');
  assert.ok(maxFlamme >= 0.04,
    'die Flamme aendert nur ' + (maxFlamme * 100).toFixed(1) + ' % ihrer Flaeche — das sieht niemand');
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

test('eine gesetzte Feuerschale SPIELT die Animation', () => {
  const start = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (!window.RoomTemplates || typeof window.RoomTemplates.spawnObstacle !== 'function') {
      return { kein: 'spawnObstacle nicht erreichbar' };
    }
    var o = window.RoomTemplates.spawnObstacle(player.x + 300, player.y + 300, 'brazier');
    if (!o) return { kein: 'keine Schale gesetzt' };
    window.__schale = o;
    return {
      laeuft: !!(o.anims && o.anims.isPlaying),
      name: (o.anims && o.anims.currentAnim) ? o.anims.currentAnim.key : null
    };
  })()`);
  if (start.kein) assert.fail(start.kein);
  assert.ok(start.laeuft, 'die Schale spielt keine Animation');
  assert.strictEqual(start.name, 'feuerschale_flackern', 'es laeuft ' + start.name);

  // Die ECHTE Schleife pumpen, nicht anims.update von Hand rufen: die
  // Animation haengt am Taktgeber der Szene. Von Hand getaktet blieb das
  // Bild stehen, und der Fall meldete faelschlich eine tote Flamme.
  const gesehen = new Set();
  for (let i = 0; i < 60 && gesehen.size < 3; i++) {
    const k = H.run(`(function () {
      var o = window.__schale;
      return (o && o.texture) ? o.texture.key : null;
    })()`);
    if (k) gesehen.add(k);
    H.step(4);
  }
  H.run('(function () { try { window.__schale.destroy(); } catch (e) {} return 1; })()');
  assert.ok(gesehen.size >= 3,
    'ueber 60 Takte wurden nur ' + gesehen.size + ' Bilder gezeigt ('
    + [...gesehen].join(', ') + ') — sie steht still');
});
