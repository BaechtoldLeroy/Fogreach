// tests/pixelPartikel.test.js — #183: Pixelpartikel je Zweck hinter ?partikel=neu.
//
// Drei Dinge muessen halten:
//   1. OHNE Flagge bleibt alles beim Alten: weder wird die Tafel geladen,
//      noch tragen die Emitter etwas anderes als die zwei weichen Punkte.
//   2. MIT Flagge zieht jeder Effekt aus SEINER Zeile der Tafel — ein Funke
//      ist kein Blutstropfen.
//   3. Die Teilchenzahl bleibt dieselbe (Mobile): neue Bilder, keine neuen
//      Massen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const sharp = require('sharp');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const TAFEL = path.join(__dirname, '..', 'assets', 'tiles', 'partikel_atlas.png');

async function startenMit(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await h.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) { await h.shutdown(); throw new Error('GameScene wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 10 });
  return h;
}

// Jeden Effekt einmal ausloesen und festhalten, was der Emitter traegt.
const AUSLOESEN = `(function () {
  var pf = window.particleFactory;
  var sc = window.game.scene.getScene('GameScene');
  var faelle = {
    hitSpark: function () { return pf.hitSpark(200, 200); },
    bloodSplat: function () { return pf.bloodSplat(200, 200); },
    deathBurst: function () { return pf.deathBurst(200, 200); },
    playerHit: function () { return pf.playerHit(200, 200); },
    lootSparkle: function () { return pf.lootSparkle(200, 200); },
    feuerSpur: function () { return pf.abilityTrail(200, 200, 0xff7a1a); },
    frostSpur: function () { return pf.abilityTrail(200, 200, 0x9fe8ff); },
    lilaSpur: function () { return pf.abilityTrail(200, 200, 0x9b6bff); }
  };
  var out = { tafelGeladen: sc.textures.exists('partikel_atlas') };
  Object.keys(faelle).forEach(function (k) {
    var e = faelle[k]();
    out[k] = {
      bild: e.texture.key,
      bilder: (e.frames || []).map(function (f) { return (f && typeof f === 'object') ? f.name : f; }),
      teilchen: e.getAliveParticleCount(),
      getoent: !!(e.ops && e.ops.tint && e.ops.tint.propertyValue !== 0xffffff)
    };
  });
  return out;
})()`;

let ohne = null, mit = null;
before(async () => {
  const H1 = await launchDungeon({ depth: 5 });
  try { ohne = H1.run(AUSLOESEN); } finally { await H1.shutdown(); }
  const H2 = await startenMit('?dungeon=5&partikel=neu');
  try { mit = H2.run(AUSLOESEN); } finally { await H2.shutdown(); }
});

test('die Tafel: neun Zeilen zu sechs Bildern, keines leer', async () => {
  const m = await sharp(TAFEL).metadata();
  assert.strictEqual(m.width + 'x' + m.height, '128x144');
  const { data } = await sharp(TAFEL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let z = 0; z < 9; z++) {
    for (let s = 0; s < 6; s++) {
      let n = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (data[(((z * 16 + y) * 128) + s * 16 + x) * 4 + 3] > 24) n++;
      }
      assert.ok(n >= 4, 'Zeile ' + z + ', Bild ' + s + ' ist leer (' + n + ' Pixel)');
    }
  }
});

test('ohne Flagge: keine Tafel, die alten zwei Punkte', () => {
  assert.strictEqual(ohne.tafelGeladen, false, 'die Tafel wird auch ohne Flagge geladen');
  const erwartet = {
    hitSpark: 'particle', bloodSplat: 'particle', deathBurst: 'particle', playerHit: 'particle',
    lootSparkle: 'particle_soft', feuerSpur: 'particle_soft', frostSpur: 'particle_soft', lilaSpur: 'particle_soft'
  };
  Object.keys(erwartet).forEach((k) => {
    assert.strictEqual(ohne[k].bild, erwartet[k], k + ' traegt ' + ohne[k].bild);
  });
});

test('mit Flagge: jeder Effekt zieht aus seiner eigenen Zeile', () => {
  assert.strictEqual(mit.tafelGeladen, true, 'die Tafel wurde mit ?partikel=neu nicht geladen');
  const zeilen = (bilder) => [...new Set(Array.prototype.map.call(bilder, (b) => Math.floor(Number(b) / 8)))].sort();
  const erwartet = {
    hitSpark: [0], bloodSplat: [1], playerHit: [1], deathBurst: [2, 3],
    feuerSpur: [4], lilaSpur: [6], frostSpur: [7], lootSparkle: [8]
  };
  Object.keys(erwartet).forEach((k) => {
    assert.strictEqual(mit[k].bild, 'partikel_atlas', k + ' traegt ' + mit[k].bild);
    assert.deepStrictEqual(zeilen(mit[k].bilder), erwartet[k],
      k + ' zieht aus den Zeilen ' + zeilen(mit[k].bilder).join(','));
  });
});

test('mit Flagge: gleich viele Teilchen wie ohne', () => {
  Object.keys(ohne).forEach((k) => {
    if (k === 'tafelGeladen') return;
    assert.strictEqual(mit[k].teilchen, ohne[k].teilchen,
      k + ': ' + mit[k].teilchen + ' Teilchen statt ' + ohne[k].teilchen);
    assert.ok(ohne[k].teilchen > 0, k + ': der Fall misst nichts');
  });
});

test('mit Flagge: Bilder mit eigener Farbe werden nicht getoent, die Magiespur schon', () => {
  assert.strictEqual(ohne.bloodSplat.getoent, true, 'ohne Flagge war Blut ein roter Punkt — der Fall misst nichts');
  assert.strictEqual(mit.bloodSplat.getoent, false, 'der Blutstropfen wird umgefaerbt');
  assert.strictEqual(mit.hitSpark.getoent, false, 'der Funke wird umgefaerbt');
  assert.strictEqual(mit.lilaSpur.getoent, true, 'die Magiespur verliert die Farbe der Faehigkeit');
});
