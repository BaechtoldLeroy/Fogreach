// tests/beuteVarianten.test.js — Truhen und Goldhaufen wuerfeln ihr Aussehen.
//
// Zwei Dinge koennen dabei schiefgehen, und beide waeren im Spiel teuer:
//
// 1. Die Variante koennte NICHT ins Mass passen. Die Truhen werden in
//    graphics.js in drei festen Groessen gezeichnet (36x26, 44x32, 52x38),
//    das Gold in zwei (24x20, 38x32). Weil die Aufrufstellen nur den NAMEN
//    tauschen und nichts an der Groesse tun, muss jede Variante exakt das
//    Mass ihres Grundnamens haben — sonst springt eine Truhe beim Betreten
//    des Raums in der Groesse.
//
// 2. Der Wuerfel koennte ins Leere greifen. Eine Truhe, die unsichtbar wird,
//    nimmt die Beute mit; darum gibt beuteBild bei fehlenden Varianten den
//    unveraenderten Schluessel zurueck.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const ORDNER = path.join(__dirname, '..', 'assets', 'tiles');

// Die Masse, die graphics.js fuer die Grundnamen zeichnet.
const MASSE = {
  chest_small: [36, 26], chest_medium: [44, 32], chest_large: [52, 38],
  goldPile: [24, 20], goldHoard: [38, 32]
};
const ANZAHL = 8;

test('jede Variante hat exakt das Mass ihres Grundnamens', async () => {
  const falsch = [];
  let geprueft = 0;
  for (const basis of Object.keys(MASSE)) {
    const [b, h] = MASSE[basis];
    for (let i = 0; i < ANZAHL; i++) {
      const f = path.join(ORDNER, basis + i + '.png');
      if (!fs.existsSync(f)) { falsch.push(basis + i + ' fehlt'); continue; }
      const m = await sharp(f).metadata();
      geprueft++;
      if (m.width !== b || m.height !== h) {
        falsch.push(basis + i + ' ist ' + m.width + 'x' + m.height + ' statt ' + b + 'x' + h);
      }
    }
  }
  assert.strictEqual(geprueft, Object.keys(MASSE).length * ANZAHL,
    'nur ' + geprueft + ' Varianten gefunden');
  assert.strictEqual(falsch.length, 0, falsch.join('; '));
});

let H = null;
before(async () => { H = await launchDungeon({ depth: 5 }); });
after(async () => { if (H) await H.shutdown(); });

test('alle Varianten sind geladen und der Wuerfel streut', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var basen = ['chest_small', 'chest_medium', 'chest_large', 'goldPile', 'goldHoard'];
    var geladen = {}, gezogen = {};
    basen.forEach(function (b) {
      geladen[b] = 0;
      for (var i = 0; i < 8; i++) if (sc.textures.exists(b + i)) geladen[b]++;
      var s = {};
      for (var w = 0; w < 60; w++) s[window.beuteBild(sc, b)] = 1;
      gezogen[b] = Object.keys(s);
    });
    return { geladen: geladen, gezogen: gezogen,
             unbekannt: window.beuteBild(sc, 'barrel') };
  })()`);
  Object.keys(MASSE).forEach((b) => {
    assert.strictEqual(r.geladen[b], ANZAHL,
      b + ': nur ' + r.geladen[b] + ' von ' + ANZAHL + ' Varianten geladen');
    const z = Array.prototype.slice.call(r.gezogen[b]);
    assert.ok(z.length >= 5,
      b + ': sechzig Wuerfe ergaben nur ' + z.length + ' verschiedene (' + z.join(', ') + ')');
    z.forEach((k) => assert.match(k, new RegExp('^' + b + '\\\d$'),
      b + ': gezogen wurde ' + k + ', das gehoert nicht dazu'));
  });
  // Ein Schluessel ohne Varianten kommt unveraendert zurueck — sonst waere
  // das Fass nach diesem Umbau texturlos.
  assert.strictEqual(r.unbekannt, 'barrel');
});

test('die Truhe im Raum traegt eine Variante und behaelt ihr Mass', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Eine Truhe jeder Groesse ueber den ECHTEN Weg setzen.
    if (!window.RoomTemplates || typeof window.RoomTemplates.spawnObstacle !== 'function') {
      return { kein: true };
    }
    var aus = [];
    ['chest_small', 'chest_medium', 'chest_large'].forEach(function (k) {
      var o = window.RoomTemplates.spawnObstacle(player.x + 300, player.y + 300, k);
      if (o) {
        aus.push({ basis: k, bild: o.texture.key,
          b: Math.round(o.displayWidth), h: Math.round(o.displayHeight) });
        try { o.destroy(); } catch (e) {}
      }
    });
    return { truhen: aus };
  })()`);
  if (r.kein) return;   // spawnObstacle nicht exportiert: nichts zu messen
  assert.ok(r.truhen.length === 3, 'nur ' + r.truhen.length + ' Truhen gesetzt');
  r.truhen.forEach((t) => {
    assert.match(t.bild, new RegExp('^' + t.basis + '\\\d?$'),
      t.basis + ' wurde zu ' + t.bild);
    const [b, h] = MASSE[t.basis];
    assert.ok(Math.abs(t.b - b) <= 1 && Math.abs(t.h - h) <= 1,
      t.basis + ' misst ' + t.b + 'x' + t.h + ' statt ' + b + 'x' + h);
  });
});
