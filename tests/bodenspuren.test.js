// tests/bodenspuren.test.js — Risse und Flecken sind nicht mehr zwei Bilder.
//
// roomTemplates streut zehn bis fuenfzehn Bodenspuren je Raum und zog sie aus
// GENAU ZWEI Texturen: floor_crack und floor_stain. In einem Raum lag damit
// derselbe Riss ein Dutzend Mal, nur gedreht und verschieden durchsichtig.
//
// Zwei Dinge sollen haengen bleiben:
//   1. Die Entwuerfe sind da und haben das Kachelmass. Jede Abweichung
//      verschoebe die Spur gegen den Boden, auf dem sie liegt.
//   2. Im echten Raum kommen verschiedene vor. Eine Variantentabelle, die
//      niemand liest, aendert nichts am Bild.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');
const ARTEN = ['floor_crack', 'floor_stain'];
const ANZAHL = 8;

test('zu jeder Art gibt es acht Entwuerfe im Kachelmass', async () => {
  for (const art of ARTEN) {
    for (let i = 0; i < ANZAHL; i++) {
      const f = path.join(ORDNER, art + i + '.png');
      assert.ok(fs.existsSync(f), art + i + '.png fehlt');
      const m = await sharp(f).metadata();
      assert.strictEqual(m.width + 'x' + m.height, '32x32',
        art + i + ' ist ' + m.width + 'x' + m.height + ' statt 32x32');
    }
    // Der Grundname bleibt als Rueckgriff.
    assert.ok(fs.existsSync(path.join(ORDNER, art + '.png')), art + '.png fehlt');
  }
});

test('die Entwuerfe einer Art unterscheiden sich wirklich', async () => {
  // Acht Dateien mit demselben Inhalt waeren keine Varianten.
  for (const art of ARTEN) {
    const f = [];
    for (let i = 0; i < ANZAHL; i++) {
      const { data } = await sharp(path.join(ORDNER, art + i + '.png'))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const m = [];
      for (let k = 0; k < data.length; k += 4) m.push(data[k + 3] > 16 ? 1 : 0);
      f.push(m);
    }
    let minAbstand = 1;
    for (let i = 0; i < ANZAHL; i++) {
      for (let j = i + 1; j < ANZAHL; j++) {
        let s = 0;
        for (let k = 0; k < f[i].length; k++) s += Math.abs(f[i][k] - f[j][k]);
        minAbstand = Math.min(minAbstand, s / f[i].length);
      }
    }
    assert.ok(minAbstand > 0.01,
      art + ': zwei Entwuerfe liegen nur ' + (minAbstand * 100).toFixed(2)
      + ' % auseinander — das sind keine zwei');
  }
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 5 }); });
after(async () => { if (H) await H.shutdown(); });

test('der Wuerfel streut und bleibt bei der Art', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var out = {};
    ['floor_crack', 'floor_stain'].forEach(function (a) {
      var geladen = 0;
      for (var i = 0; i < 8; i++) if (sc.textures.exists(a + i)) geladen++;
      var s = {};
      for (var w = 0; w < 60; w++) s[window.variantenBild(sc, a)] = 1;
      out[a] = { geladen: geladen, gezogen: Object.keys(s) };
    });
    return out;
  })()`);
  ARTEN.forEach((a) => {
    assert.strictEqual(r[a].geladen, ANZAHL,
      a + ': nur ' + r[a].geladen + ' von ' + ANZAHL + ' Entwuerfen geladen');
    const z = Array.prototype.slice.call(r[a].gezogen);
    assert.ok(z.length >= 5,
      a + ': sechzig Wuerfe ergaben nur ' + z.length + ' verschiedene');
    // Ein Riss darf nicht als Fleck herauskommen: die Risse werden gedreht,
    // die Flecken nicht.
    z.forEach((k) => assert.ok(k.indexOf(a) === 0,
      a + ': gezogen wurde ' + k + ', das gehoert zur anderen Art'));
  });
});

test('ein echter Raum legt verschiedene Spuren', () => {
  // Der Wuerfel allein beweist nichts: roomTemplates koennte ihn gar nicht
  // fragen und weiter den Grundnamen nehmen. Darum im gebauten Raum zaehlen.
  const gesehen = new Set();
  let raeume = 0;
  for (let i = 0; i < 8 && gesehen.size < 4; i++) {
    const keys = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var out = [];
      (sc.children.list || []).forEach(function (c) {
        if (c && c.texture && /^floor_(crack|stain)/.test(c.texture.key)) {
          out.push(c.texture.key);
        }
      });
      return out;
    })()`);
    Array.prototype.forEach.call(keys || [], (k) => gesehen.add(k));
    if ((keys || []).length) raeume++;
    // Naechsten Raum bauen
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      if (window.RoomManager && typeof window.RoomManager.naechsterRaum === 'function') {
        try { window.RoomManager.naechsterRaum(sc); } catch (e) {}
      }
      return 1;
    })()`);
    H.step(8);
  }
  assert.ok(raeume > 0, 'in keinem Raum lag eine Bodenspur — der Fall misst nichts');
  assert.ok(gesehen.size >= 3,
    'es lagen nur ' + gesehen.size + ' verschiedene Spuren (' + [...gesehen].join(', ')
    + ') — der Raum fragt den Wuerfel nicht');
});
