// tests/kettenschlossBilder.test.js — Das Kettenschloss als Pixelbilder.
//
// Bis hier zeichnete das Minispiel Schloss, Dietrich und Stift als Flaechen
// (Phaser Graphics). Jetzt sind es PixelLab-Bilder (assets/kettenschloss/,
// tools/kettenschlossBilderBauen.js): Schlosskoerper mit Kanal, Ketten links
// und rechts, Spanner, Stift, Dietrich. Die Spiellogik bleibt, wie sie war —
// also muessen die Bilder genau dort liegen, wo die Logik rechnet: der
// Schluesselkanal ueber der Leiste, der Dietrich an der Zeigerstelle. Fehlt
// ein Bild, zeichnet das Spiel wie vorher.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launchDungeon } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const DATEIEN = ['koerper', 'dietrich', 'stift', 'spanner', 'kette'];

/** Breite/Hoehe aus dem IHDR-Block. */
function masse(datei) {
  const b = fs.readFileSync(datei);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
/** Text-Metadaten in einer PNG (tEXt, iTXt, zTXt, eXIf)? */
function hatMetadaten(datei) {
  const b = fs.readFileSync(datei);
  let o = 8;
  while (o < b.length) {
    const len = b.readUInt32BE(o), typ = b.toString('latin1', o + 4, o + 8);
    if (/^(tEXt|iTXt|zTXt|eXIf)$/.test(typ)) return true;
    if (typ === 'IEND') break;
    o += 12 + len;
  }
  return false;
}

test('Die Bilder liegen bei, ohne Metadaten, Schloss passend zur Leiste', () => {
  for (const n of DATEIEN) {
    const p = path.join(WURZEL, 'assets', 'kettenschloss', n + '.png');
    assert.ok(fs.existsSync(p), 'fehlt: ' + p);
    assert.strictEqual(hatMetadaten(p), false, n + '.png traegt Text-Metadaten');
  }
  // Der Kanal laeuft 31 Pixel von jedem Rand: 440 Leiste + 2 x 31.
  assert.deepStrictEqual(masse(path.join(WURZEL, 'assets', 'kettenschloss', 'koerper.png')), { w: 502, h: 40 });
  // Der Dietrich reicht von der Spitze (leisteY - 30) bis zum Griffende (+30).
  assert.strictEqual(masse(path.join(WURZEL, 'assets', 'kettenschloss', 'dietrich.png')).h, 60);
});

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 10 });
  H.lab.clearEnemies();
  H.run(`(function () {
    window.__tippe = function (x, y, id) {
      var m = window.game.input;
      var t = { target: window.game.canvas, identifier: id || 7, pageX: x, pageY: y, clientX: x, clientY: y };
      var ev = { target: window.game.canvas, changedTouches: [t], touches: [t], timeStamp: Date.now(), preventDefault: function () {} };
      m.onTouchStart(ev);
      m.onTouchEnd({ target: window.game.canvas, changedTouches: [t], touches: [], timeStamp: Date.now(), preventDefault: function () {} });
    };
    return 1;
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

// Stift genau in der Mitte: Math.random fest auf 0,5 fuer die ganze Taktung.
function starte() {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__randAlt = window.__randAlt || Math.random;
    Math.random = function () { return 0.5; };
    window.__erg = null;
    window.__ks = window.Kettenschloss.spiele(sc, 10, function (e) { window.__erg = e; });
    return 1;
  })()`);
  H.step(3);
}
function ende() {
  H.run(`(function () {
    if (window.__ks) window.__ks.abbrechen();
    if (window.__randAlt) { Math.random = window.__randAlt; window.__randAlt = null; }
    return 1;
  })()`);
  H.step(3);
}

test('Die Bilder sind im Dungeon geladen', () => {
  assert.strictEqual(H.run(`window.Kettenschloss.bilderBereit(window.game.scene.getScene('GameScene'))`), true,
    'Texturen fehlen: ' + H.run(`Object.keys(window.Kettenschloss.BILDER).filter(function (k) {
      return !window.game.scene.getScene('GameScene').textures.exists(k); }).join(',')`));
});

test('Schloss, Dietrich und Stift liegen an den Stellen der Logik', () => {
  starte();
  try {
    const m = H.run(`(function () {
      var b = __ks.bilder, l = __ks.leiste;
      if (!b) return null;
      var k = b.koerper, sx = l.breite / window.Kettenschloss.BILD_KANAL.leiste;
      var alle = [k, b.dietrich, b.stift, b.spanner].concat(b.ketten);
      return {
        kanalL: k.x - k.displayWidth / 2 + window.Kettenschloss.BILD_KANAL.rand * sx,
        kanalR: k.x + k.displayWidth / 2 - window.Kettenschloss.BILD_KANAL.rand * sx,
        kanalY: k.y - k.displayHeight * k.originY + window.Kettenschloss.BILD_KANAL.mitteY,
        dx: b.dietrich.x, dy: b.dietrich.y, dh: b.dietrich.displayHeight,
        sx: b.stift.x, sUnten: b.stift.y,
        texturen: alle.map(function (o) { return o.texture.key; }),
        fest: alle.every(function (o) { return o.scrollFactorX === 0 && o.scrollFactorY === 0; }),
        tiefe: alle.every(function (o) { return o.depth === 4000; }),
        lx: l.x, lb: l.breite, ly: l.y, pos: __ks.position()
      };
    })()`);
    assert.ok(m, 'das Schloss wurde trotz geladener Bilder als Rueckfall gezeichnet');
    assert.ok(Math.abs(m.kanalL - m.lx) < 0.5, 'Kanal beginnt nicht an der Leiste: ' + m.kanalL + ' vs ' + m.lx);
    assert.ok(Math.abs(m.kanalR - (m.lx + m.lb)) < 0.5, 'Kanal endet nicht mit der Leiste: ' + m.kanalR);
    assert.ok(Math.abs(m.kanalY - m.ly) < 0.5, 'Kanal nicht auf der Hoehe der Leiste: ' + m.kanalY + ' vs ' + m.ly);
    assert.ok(Math.abs(m.dx - (m.lx + m.pos * m.lb)) < 4, 'Dietrich nicht an der Zeigerstelle: ' + m.dx);
    assert.strictEqual(m.dy, m.ly - 30, 'Dietrichspitze nicht dort, wo der alte Dietrich begann');
    assert.strictEqual(m.dh, 60);
    assert.strictEqual(m.sx, m.dx, 'der Stift sitzt nicht ueber dem Dietrich');
    // Als Text verglichen: Arrays aus dem Spiel-Realm sind fuer deepStrictEqual fremd.
    assert.strictEqual(m.texturen.slice(0, 4).join(','), 'ks_koerper,ks_dietrich,ks_stift,ks_spanner');
    assert.ok(m.texturen.slice(4).every((k) => k === 'ks_kette') && m.texturen.length === 8, 'Ketten fehlen');
    assert.ok(m.fest, 'ein Bild scrollt mit der Kamera (Handy-Taps verfehlen es)');
    assert.ok(m.tiefe, 'ein Bild liegt nicht auf der Ebene des Schlosses');

    // Der Dietrich folgt dem Finger, der Stift mit.
    H.run('__tippe(__ks.leiste.x + __ks.leiste.breite * 0.2, __ks.leiste.y)');
    H.step(3);
    const n = H.run('({ pos: __ks.position(), dx: __ks.bilder.dietrich.x, sx: __ks.bilder.stift.x })');
    assert.ok(Math.abs(n.pos - 0.2) < 0.01, 'Tipp hat den Dietrich nicht bewegt: ' + n.pos);
    assert.ok(Math.abs(n.dx - (m.lx + 0.2 * m.lb)) < 4, 'Dietrich-Bild folgt dem Zeiger nicht: ' + n.dx);
    assert.strictEqual(n.sx, n.dx);
  } finally { ende(); }
});

test('Mit Bildern weiter loesbar, danach ist alles weg', () => {
  starte();
  const bilder = H.run('__ks.bilder ? 1 : 0');
  assert.strictEqual(bilder, 1);
  // Stifte bei 0,5, Dietrich steht bei 0,5: jedes Setzen trifft.
  for (let i = 0; i < 6 && H.run('window.__erg') === null; i++) { H.run('__ks.setzen()'); H.step(2); }
  const e = H.run('window.__erg');
  ende();
  assert.ok(e && e.geschafft, 'Schloss nicht geloest: ' + JSON.stringify(e));
  assert.strictEqual(H.run(`(function () { var b = __ks.bilder;
    return [b.koerper, b.dietrich, b.stift, b.spanner].concat(b.ketten).some(function (o) { return !!o.scene; }); })()`),
  false, 'Bilder bleiben nach dem Ende in der Szene');
});

test('Mit Bildern abbrechbar ueber den Knopf "Aufhören"', () => {
  starte();
  try {
    H.run('(function () { var k = __ks.knoepfe.aufhoeren; __tippe(k.x, k.y); return 1; })()');
    H.step(3);
    const e = H.run('window.__erg');
    assert.ok(e, 'Aufhoeren hat nicht beendet');
    assert.strictEqual(e.geschafft, false);
    assert.strictEqual(e.verloren, false);
    assert.strictEqual(H.run('!!__ks.bilder.koerper.scene'), false, 'Schlossbild bleibt stehen');
  } finally { ende(); }
});

test('Fehlt ein Bild, wird das Schloss wie vorher gezeichnet und bleibt spielbar', () => {
  // Zuletzt: die Textur kommt in diesem Lauf nicht wieder.
  H.run(`window.game.scene.getScene('GameScene').textures.remove('ks_stift')`);
  starte();
  try {
    assert.strictEqual(H.run('__ks.bilder'), null, 'halb Bild, halb Kasten');
    for (let i = 0; i < 6 && H.run('window.__erg') === null; i++) { H.run('__ks.setzen()'); H.step(2); }
    const e = H.run('window.__erg');
    assert.ok(e && e.geschafft, 'Rueckfall nicht loesbar: ' + JSON.stringify(e));
  } finally { ende(); }
});
