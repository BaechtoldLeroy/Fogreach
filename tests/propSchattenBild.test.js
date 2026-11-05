// tests/propSchattenBild.test.js — die Schatten unter Props sind Bilder.
//
// Bis b527 lagen alle Prop-Schatten als Ellipsen in einem geteilten Graphics
// (Tiefe 38). Phaser zerlegt jede Graphics-Ellipse in jedem Bild neu in
// Dreiecke: bis 4000 Befehle je Raum, auf gebremster CPU der groesste
// einzelne Posten (tools/mobilMessung.js --profil). Jetzt: ein Bild einer
// einmal erzeugten Ellipse je Prop, unter dem Prop, mit dem Raum aufgeraeumt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 12, zusatz: '&debug=1' });
  H.step(10); await flush();
});
after(async () => { if (H) await H.shutdown(); });

const ZAEHLEN = `JSON.stringify((function () {
  var sc = ${GS}, T = window.WELT_TIEFEN.PROP_SCHATTEN;
  var L = sc.children.list.filter(function (o) { return o.active !== false && o.depth === T; });
  var props = (window.obstacles && window.obstacles.getChildren ? window.obstacles.getChildren() : []).length;
  return {
    graphics: L.filter(function (o) { return o.type === 'Graphics'; }).length,
    bilder: L.filter(function (o) { return o.type === 'Image' && /^__prop_schatten_/.test(o.texture.key); }).length,
    props: props
  };
})())`;

test('Prop-Schatten: Bilder einer Textur, kein Graphics mehr, mit dem Raum aufgeraeumt', async () => {
  const r = JSON.parse(H.run(ZAEHLEN));
  assert.strictEqual(r.graphics, 0, 'Schatten liegen noch in einem Graphics');
  assert.ok(r.bilder > 0, 'keine Schattenbilder im Raum: ' + JSON.stringify(r));
  // Das Bild: Schwarz, durchscheinend, in der Mitte gedeckt, an der Ecke leer.
  const px = JSON.parse(H.run(`JSON.stringify((function () {
    var sc = ${GS}, b = sc.children.list.filter(function (o) { return o.texture && /^__prop_schatten_/.test(o.texture.key); })[0];
    var src = b.texture.getSourceImage(), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height; var x = c.getContext('2d'); x.drawImage(src, 0, 0);
    var mitte = x.getImageData(Math.floor(src.width / 2), Math.floor(src.height / 2), 1, 1).data;
    var ecke = x.getImageData(0, 0, 1, 1).data;
    return { mitte: Array.from(mitte), ecke: Array.from(ecke), y: b.y, x: b.x };
  })())`));
  assert.deepStrictEqual(px.mitte.slice(0, 3), [0, 0, 0], 'Schatten nicht schwarz');
  assert.ok(px.mitte[3] > 40 && px.mitte[3] < 90, 'Deckung in der Mitte ' + px.mitte[3]);
  assert.strictEqual(px.ecke[3], 0, 'Ecke nicht leer: keine Ellipse');

  // Raumwechsel: die alten Schatten gehen mit, jeder Raum bringt eigene.
  let letzte = r.bilder;
  for (let raum = 2; raum <= 5; raum++) {
    H.run(`enterRoom(${GS}, ${raum})`);
    H.step(4); await flush();
    const n = JSON.parse(H.run(ZAEHLEN));
    assert.strictEqual(n.graphics, 0);
    // Alle Schatten im Raum gehoeren zu ihm: nicht mehr als Props plus Ruinen.
    assert.ok(n.bilder <= Math.max(letzte, n.props) + 40, 'Schatten haeufen sich an: ' + letzte + ' -> ' + JSON.stringify(n));
    letzte = n.bilder;
  }
});

// Brazier-Licht: ebenfalls ein Bild statt Kreisen in einem Graphics (b528).
test('Brazier-Licht: echtes Bild der Glut-Textur, verschwindet mit dem Brazier', () => {
  const r = JSON.parse(H.run(`JSON.stringify((function () {
    var sc = ${GS}, RT = window.RoomTemplates, pts = sc._brazierGlowPoints;
    var p = window.player, x = p.x + 200, y = p.y;
    var bild = RT.registerBrazierGlow(sc, pts, x, y);
    var src = bild.texture.getSourceImage(), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height; var k = c.getContext('2d'); k.drawImage(src, 0, 0);
    var mitte = Array.from(k.getImageData(src.width / 2, src.height / 2, 1, 1).data);
    var ecke = Array.from(k.getImageData(0, 0, 1, 1).data);
    var tiefe = bild.depth, boden = !!bild.getData('isFloor');
    var weg = RT.removeBrazierGlow(sc, x + 5, y);
    return { boden: boden, key: bild.texture.key, typ: bild.type, mitte: mitte, ecke: ecke, tiefe: tiefe, weg: weg,
      aktiv: bild.active, rest: pts.some(function (q) { return q.x === x && q.y === y; }),
      glutGraphics: sc.children.list.filter(function (o) { return o.type === 'Graphics' && o.depth === window.WELT_TIEFEN.UEBER_PROP; }).length };
  })())`));
  assert.strictEqual(r.typ, 'Image');
  assert.strictEqual(r.key, '__brazier_glut');
  assert.strictEqual(r.tiefe, H.run('window.WELT_TIEFEN.UEBER_PROP'), 'Licht auf falscher Tiefe');
  assert.ok(r.mitte[0] > 200 && r.mitte[3] > 60, 'Mitte nicht warm/gedeckt: ' + r.mitte);
  assert.strictEqual(r.ecke[3], 0, 'Ecke nicht leer: kein Kreis');
  // Sonst sah die Treppensuche 160-px-Bloecke um jedes Brazier (Treppe verschob sich).
  assert.strictEqual(r.boden, true, 'Licht gilt der Treppensuche als Hindernis');
  assert.strictEqual(r.weg, true);
  assert.strictEqual(r.aktiv, false, 'Licht bleibt nach dem Zerstoeren');
  assert.strictEqual(r.rest, false);
  assert.strictEqual(r.glutGraphics, 0, 'Licht liegt noch in einem Graphics');
});
