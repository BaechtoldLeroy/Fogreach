// tests/amulettBilder.test.js — die vierzehn Lauf-Amulette tragen Pixelbilder.
//
// Gemeldet: "Amulette brauchen noch neue Grafiken." Waffen, Ruestungen und
// Traenke kommen seit b321 aus Dateien (tests/itemIconBilder.test.js), die
// Amulette (amuZwillingsklinge .. amuBlutpakt) zeichnete graphics.js noch
// von Hand. Geprueft am laufenden Spiel (headless, Canvas):
//
//  - jedes Amulett aus AMULET_DEFS hat eine 48er-Datei und steht in der
//    Tauschliste — sonst bliebe es still beim gezeichneten Bild;
//  - im Dungeon UND im Hub zeigt jede Amulett-Textur den INHALT ihrer Datei
//    (Fingerabdruck wie in tests/itemIconBilder.test.js);
//  - am Boden liegt das Amulett mit seinem Bild, quadratisch;
//  - im Inventar-Raster und im Amulett-Platz unverzerrt eingepasst;
//  - fehlt eine Datei, bleibt die gezeichnete Form (Rueckfall).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');

/** Die Amulett-Symbole aus lootSystem.js — EINE Quelle, kein Abschreiben. */
function amulettSchluessel() {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'lootSystem.js'), 'utf8');
  const m = [...s.matchAll(/type: 'amulet',[^\n]*?iconKey: '(\w+)'/g)].map((x) => x[1]);
  assert.ok(m.length >= 14, 'nur ' + m.length + ' Amulette gefunden — Muster veraltet?');
  return m;
}

function tauschliste() {
  const s = fs.readFileSync(path.join(WURZEL, 'js', 'pixelTexturen.js'), 'utf8');
  const m = /var NAMENSGLEICH = \[([\s\S]*?)\]\);/.exec(s);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function datei(k) { return path.join(WURZEL, 'assets', 'tiles', k + '.png'); }

async function sollAbdruck(k) {
  const { data, info } = await sharp(datei(k)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    a += data[i + 3];
    b += (data[i] + data[i + 1] + data[i + 2]) * (data[i + 3] > 0 ? 1 : 0);
  }
  return info.width + 'x' + info.height + '|' + a + ':' + b;
}

// Im Spiel: Fingerabdruck einer Textur (gleiche Rechnung wie sollAbdruck()).
const ABDRUCK_JS = `function (tm, n) {
  if (!tm.exists(n)) return 'fehlt';
  var q = tm.get(n).getSourceImage();
  var c = document.createElement('canvas'); c.width = q.width; c.height = q.height;
  var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(q, 0, 0);
  var d = ctx.getImageData(0, 0, q.width, q.height).data, a = 0, b = 0;
  for (var i = 0; i < d.length; i += 4) { a += d[i + 3]; b += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] > 0 ? 1 : 0); }
  return q.width + 'x' + q.height + '|' + a + ':' + b;
}`;

function imSpiel(H, schluessel) {
  return H.run(`(function () {
    var ab = ${ABDRUCK_JS}, out = {};
    ${JSON.stringify(schluessel)}.forEach(function (n) { out[n] = ab(window.game.textures, n); });
    return JSON.stringify(out);
  })()`);
}

test('jedes Amulett hat eine 48er-Datei und steht in der Tauschliste', async () => {
  const liste = tauschliste();
  const fehler = [];
  for (const k of amulettSchluessel()) {
    if (liste.indexOf(k) < 0) fehler.push(k + ': nicht in NAMENSGLEICH');
    if (!fs.existsSync(datei(k))) { fehler.push(k + ': keine Datei'); continue; }
    const m = await sharp(datei(k)).metadata();
    if (m.width !== 48 || m.height !== 48) fehler.push(k + ': ' + m.width + 'x' + m.height);
  }
  assert.strictEqual(fehler.length, 0, fehler.join('; '));
});

describe('im Dungeon', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 10 }); });
  after(async () => { if (H) await H.shutdown(); });

  test('jede Amulett-Textur zeigt den INHALT ihrer Datei', async () => {
    const ist = JSON.parse(imSpiel(H, amulettSchluessel()));
    const falsch = [];
    for (const k of amulettSchluessel()) {
      const soll = await sollAbdruck(k);
      if (ist[k] !== soll) falsch.push(k + ': ' + ist[k] + ' statt ' + soll);
    }
    assert.strictEqual(falsch.length, 0, falsch.join('; '));
  });

  test('am Boden: jedes Amulett mit seinem Bild, quadratisch', () => {
    const r = JSON.parse(H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene'), LS = window.LootSystem, out = [];
      LS.AMULET_DEFS.forEach(function (d, i) {
        var it = LS.rollAmulet(10, function () { return (i + 0.5) / LS.AMULET_DEFS.length; });
        var s = spawnLoot.call(sc, player.x + 200, player.y + 200, it, null);
        out.push({ soll: d.iconKey, key: s && s.texture.key, w: s && s.displayWidth, h: s && s.displayHeight });
        if (s) s.destroy();
      });
      return JSON.stringify(out);
    })()`));
    assert.strictEqual(r.length, amulettSchluessel().length);
    r.forEach((s) => {
      assert.strictEqual(s.key, s.soll, 'am Boden falsches Bild');
      assert.ok(s.w > 0 && Math.abs(s.w - s.h) < 1e-6, s.soll + ' verzerrt: ' + s.w + 'x' + s.h);
    });
  });

  test('Rueckfall: ohne Datei bleibt die gezeichnete Form', async () => {
    const k = 'amuKettenherz';
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      // So, als waere die Datei nie geladen worden: geladenes Bild weg,
      // Schluessel neu gezeichnet, dann der Tausch.
      sc.textures.remove('testgrafik__${k}');
      sc.textures.remove('${k}');
      createItemGraphics.call(sc);
      var n = window.pixelTexturenAnwenden(sc, ['${k}']);
      return JSON.stringify({ n: n, ab: (${ABDRUCK_JS})(sc.textures, '${k}') });
    })()`);
    const { n, ab } = JSON.parse(r);
    assert.strictEqual(n, 0, 'ohne Datei wurde trotzdem getauscht');
    assert.notStrictEqual(ab, 'fehlt', 'Textur fehlt ganz — kein Rueckfall');
    assert.notStrictEqual(ab, await sollAbdruck(k), 'zeigt noch die Datei');
    const deckung = Number(ab.split('|')[1].split(':')[0]);
    assert.ok(deckung > 255 * 100, 'gezeichnete Form leer (' + deckung + ')');
  });
});

describe('im Hub', () => {
  let H = null;
  before(async () => {
    H = await launch({ renderer: 'canvas', search: '?autostart=1' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 600 }), 'Hub nicht erreicht');
    H.step(20);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('schon vor dem ersten Abstieg zeigen die Amulette ihre Datei', async () => {
    const ist = JSON.parse(imSpiel(H, amulettSchluessel()));
    const falsch = [];
    for (const k of amulettSchluessel()) {
      if (ist[k] !== await sollAbdruck(k)) falsch.push(k);
    }
    assert.strictEqual(falsch.length, 0, 'im Hub noch gezeichnet: ' + falsch.join(', '));
  });

  test('Inventar-Raster und Amulett-Platz: gleichmaessig eingepasst, mittig', () => {
    const r = JSON.parse(H.run(`(function () {
      var LS = window.LootSystem, out = [];
      var a = LS.rollAmulet(10, function () { return 0.05; });      // Zwillingsklinge
      var b = LS.rollAmulet(10, function () { return 0.4; });
      window.InventoryGrid.einlagern(a);
      equipment.amulet = b;
      openInventory();
      refreshInventoryUI();
      inventory.forEach(function (it, i) {
        if (it !== a) return;
        var s = invUI.slots[i];
        var u = symbolUmriss(s.icon.scene, s.icon.texture.key);
        out.push({ wo: 'raster', key: s.icon.texture.key, soll: a.iconKey, sx: s.icon.scaleX, sy: s.icon.scaleY,
          umrissB: u.w * s.icon.scaleX, umrissH: u.h * s.icon.scaleY,
          rechteckB: s.bg.displayWidth, rechteckH: s.bg.displayHeight,
          mitteX: s.icon.x - (u.x + u.w / 2 - u.tw / 2) * s.icon.scaleX - s.bg.x,
          mitteY: s.icon.y - (u.y + u.h / 2 - u.th / 2) * s.icon.scaleY - s.bg.y });
      });
      var e = invUI.equip.amulet.icon;
      out.push({ wo: 'platz', key: e.texture.key, soll: b.iconKey, sx: e.scaleX, sy: e.scaleY });
      closeInventory();
      return JSON.stringify(out);
    })()`));
    assert.strictEqual(r.length, 2, 'Amulett nicht im Raster: ' + JSON.stringify(r));
    r.forEach((s) => {
      assert.strictEqual(s.key, s.soll, s.wo + ': falsches Bild');
      assert.ok(Math.abs(s.sx - s.sy) < 1e-6, s.wo + ' verzerrt: ' + s.sx + ' x ' + s.sy);
    });
    const g = r[0];
    assert.ok(g.umrissB <= g.rechteckB + 0.5 && g.umrissH <= g.rechteckH + 0.5, 'ragt aus dem Feld');
    assert.ok(Math.max(g.umrissB / g.rechteckB, g.umrissH / g.rechteckH) >= 0.75, 'nutzt das Feld nicht');
    assert.ok(Math.abs(g.mitteX) < 1.5 && Math.abs(g.mitteY) < 1.5, 'nicht mittig: ' + g.mitteX + '/' + g.mitteY);
  });
});
