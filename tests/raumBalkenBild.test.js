// tests/raumBalkenBild.test.js — der Raum-Fortschrittsbalken unter der
// Minikarte ist ein Bild, kein Graphics.
//
// Seine abgerundeten Segmente zerlegte Phaser in JEDEM Bild neu in Dreiecke,
// obwohl er sich nur beim Raumwechsel aendert: auf gebremster CPU der
// groesste einzelne Grafik-Posten (tools/mobilMessung.js, b528). Jetzt wird
// er bei Aenderung in eine kleine Textur gezeichnet.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 5, zusatz: '&debug=1' });
  H.step(6); await flush();
});
after(async () => { if (H) await H.shutdown(); });

// Farbe des Balkenbilds in der Mitte des Segments n (1-basiert).
const SEGMENT = (n) => `JSON.stringify((function () {
  var b = window._roomProgressGfx, p = window._roomProgress, g = window._roomProgressGeom;
  var src = b.texture.getSourceImage(), c = document.createElement('canvas');
  c.width = src.width; c.height = src.height; var x = c.getContext('2d'); x.drawImage(src, 0, 0);
  var gap = p.total > 1 ? Math.max(2, Math.min(4, Math.floor((g.w / p.total) * 0.18))) : 0;
  var segW = (g.w - gap * (p.total - 1)) / p.total;
  var px = Math.round(2 + (${n} - 1) * (segW + gap) + segW / 2), py = 2 + 3;
  return { rgba: Array.from(x.getImageData(px, py, 1, 1).data), key: b.texture.key, typ: b.type,
    w: src.width, cur: p.cur, total: p.total };
})())`;

test('Raumbalken: ein Bild mit gold fuer den aktuellen Raum, neu nur beim Raumwechsel', async () => {
  assert.strictEqual(H.run('window._roomProgressGfx && window._roomProgressGfx.type'), 'Image', 'Balken ist kein Bild');
  const a = JSON.parse(H.run(SEGMENT('window._roomProgress.cur')));
  assert.ok(/^__raumbalken_/.test(a.key), 'Balken ohne eigene Textur: ' + a.key);
  assert.ok(a.total > 1, 'Testannahme: mehrere Raeume');
  // Gold = 0xffd166.
  assert.ok(a.rgba[0] > 230 && a.rgba[1] > 180 && a.rgba[2] < 140 && a.rgba[3] > 200, 'aktuelles Segment nicht gold: ' + a.rgba);
  // Ein Bild lang bleibt die Textur dieselbe (nicht jedes Bild neu).
  H.step(10); await flush();
  assert.strictEqual(H.run('window._roomProgressGfx.texture.key'), a.key, 'Balken wird jedes Bild neu gebaut');

  // Naechster Raum: neue Textur, die alte ist weg, das naechste Segment gold.
  H.run(`enterRoom(${GS}, ${a.cur})`);
  H.step(4); await flush();
  const b = JSON.parse(H.run(SEGMENT('window._roomProgress.cur')));
  assert.strictEqual(b.cur, a.cur + 1);
  assert.notStrictEqual(b.key, a.key, 'nach dem Raumwechsel nicht neu gezeichnet');
  assert.strictEqual(H.run(`${GS}.textures.exists(${JSON.stringify(a.key)})`), false, 'alte Balken-Textur bleibt liegen');
  assert.ok(b.rgba[0] > 230 && b.rgba[1] > 180 && b.rgba[2] < 140, 'neues aktuelles Segment nicht gold: ' + b.rgba);
  const vorher = JSON.parse(H.run(SEGMENT(String(a.cur))));
  // Gruen = 0x66dd88: geschafft.
  assert.ok(vorher.rgba[1] > 180 && vorher.rgba[0] < 140, 'geschafftes Segment nicht gruen: ' + vorher.rgba);
});
