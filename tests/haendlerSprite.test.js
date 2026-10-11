// tests/haendlerSprite.test.js — #165: der wandernde Haendler ist der Alte mit
// dem Handkarren (eigenes Bild statt Maras Sprite), fest eingebaut ohne Flagge.
//
// Maras Sprite ('spaeherin', 120 px) bleibt nur als Notbild, falls das
// Karrenbild fehlt. Gezeichnet wird er nach Bildhoehe gegen den Spieler:
// steht der Spieler unterhalb des Karrens, ist er davor, sonst dahinter.

const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run(`window.__shopOrig = window.openShopScene`);
});
after(async () => { if (H) await H.shutdown(); });
afterEach(() => {
  H.run(`window.openShopScene = window.__shopOrig; window._dungeonMerchant = false;`);
});

// Laesst den Haendler erscheinen und taktet, bis er steht (das Bild wird
// erst nachgeladen).
function haendlerHerbei() {
  H.run(`(function () {
    window.EventSystem.reset && window.EventSystem.reset();
    var sc = window.game.scene.getScene('GameScene');
    var m = window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'wandering_merchant'; })[0];
    m.handler(sc);
  })()`);
  for (let i = 0; i < 120 && !H.run('!!window.EventSystem.aktiverHaendler()'); i++) H.step(16);
  return H.run(`(function () {
    var a = window.EventSystem.aktiverHaendler();
    if (!a) return null;
    return { key: a.sprite.texture.key, hoehe: a.sprite.displayHeight,
             breite: a.sprite.displayWidth, x: a.sprite.x, y: a.sprite.y,
             schein: !!(a.schein && a.schein.active) };
  })()`);
}

// Spieler neben den Haendler, dann [E]: oeffnet sich der Laden?
function handelMitE() {
  H.run(`(function () {
    var a = window.EventSystem.aktiverHaendler();
    window.__shopAufgerufen = 0;
    window.openShopScene = function () { window.__shopAufgerufen++; };
    player.x = a.sprite.x + 30; player.y = a.sprite.y + 10;
    if (player.body) { player.body.reset(player.x, player.y); }
  })()`);
  H.step(16); H.step(16);
  const hinweis = H.run(`(function () {
    var a = window.EventSystem.aktiverHaendler();
    return { sichtbar: a.prompt.visible, dy: a.sprite.y - a.prompt.y, text: a.prompt.text };
  })()`);
  H.run(`window.game.scene.getScene('GameScene').input.keyboard.emit('keydown-E')`);
  return Object.assign(hinweis, { laden: H.run('window.__shopAufgerufen') });
}

test('der Haendler ist der Alte mit dem Karren, in Spielergroesse', () => {
  const h = haendlerHerbei();
  assert.ok(h, 'der Haendler erscheint nicht (Bild nicht geladen?)');
  assert.strictEqual(h.key, 'haendler_karren');
  // Die Textur muss echt geladen sein, nicht Phasers __MISSING-Platzhalter.
  const quelle = H.run(`(function () {
    var f = window.game.textures.getFrame('haendler_karren');
    return f ? { w: f.width, h: f.height } : null;
  })()`);
  assert.ok(quelle && quelle.w > 64 && quelle.h > 32, 'Textur fehlt: ' + JSON.stringify(quelle));
  // Der Karren macht das Bild breiter als hoch; die Hoehe liegt um Spielergroesse.
  assert.ok(h.breite > h.hoehe, 'kein Karren im Bild? ' + h.breite + 'x' + h.hoehe);
  const spieler = H.run('player.displayHeight');
  assert.ok(h.hoehe > spieler * 0.9 && h.hoehe < spieler * 1.4,
    'Haendler ' + h.hoehe.toFixed(0) + ' px gegen Spieler ' + spieler.toFixed(0) + ' px');
  const e = handelMitE();
  assert.ok(e.sichtbar, '[E] nicht sichtbar');
  // Knapp ueber der Oberkante: nicht im Bild, aber auch nicht in der Luft.
  assert.ok(e.dy > h.hoehe / 2 && e.dy < h.hoehe / 2 + 25, '[E] sitzt nicht ueber dem Haendler: ' + e.dy);
  assert.strictEqual(e.laden, 1, 'der Laden oeffnet sich nicht');
  // Die Laterne flackert, und beim Aufraeumen verschwindet der Schein mit.
  assert.ok(h.schein, 'kein Laternenschein');
  const scheinObj = 'window.__schein';
  H.run(scheinObj + ' = window.EventSystem.aktiverHaendler().schein');
  const a0 = H.run(scheinObj + '.alpha'); for (let i = 0; i < 8; i++) H.step(16);
  assert.notStrictEqual(H.run(scheinObj + '.alpha'), a0, 'der Schein flackert nicht');
  H.run('window.EventSystem.reset && window.EventSystem.reset()');
  assert.strictEqual(H.run(scheinObj + '.active'), false, 'der Schein bleibt nach dem Aufraeumen stehen');
});

// Gemessen wird die Reihenfolge, in der Phaser wirklich zeichnet: die
// sortierte Anzeigeliste der Szene. Haengt ein Objekt in einem Layer
// (enemyLayer), zaehlt der Platz des Layers, nicht die eigene Tiefe.
const PLATZ = `function platz(sc, o) {
  var liste = sc.sys.displayList;
  var oben = o;
  while (oben && oben.displayList && oben.displayList !== liste) oben = oben.displayList;
  while (oben && oben.parentContainer) oben = oben.parentContainer;
  return liste.getIndex(oben);
}`;

// Stellt den Spieler mit den Fuessen dy Pixel unter (+) bzw. ueber (-) die
// untere Kante des Karrens, leicht seitlich, damit sich die Bilder decken.
// Ein Bild takten, dann die sortierte Anzeigeliste lesen.
function spielerAnKarren(dy) {
  H.run(`(function () {
    var m = window.EventSystem.aktiverHaendler().sprite;
    player.x = m.x + 12; player.y = m.y + m.displayHeight * (1 - m.originY) + (${dy});
    if (player.body) { player.body.reset(player.x, player.y); }
  })()`);
  H.step(16);
  return H.run(`(function () {
    ${PLATZ}
    var sc = window.game.scene.getScene('GameScene');
    var a = window.EventSystem.aktiverHaendler();
    var m = a.sprite;
    sc.sys.displayList.depthSort();
    return { spieler: platz(sc, player), haendler: platz(sc, m), schein: platz(sc, a.schein),
             hinweis: platz(sc, a.prompt),
             fussSpieler: player.y, fussKarren: m.y + m.displayHeight * (1 - m.originY),
             spielerTiefe: player.depth, haendlerTiefe: m.depth, scheinTiefe: a.schein.depth };
  })()`);
}

test('Spieler unterhalb des Karrens: er wird vor Haendler, Karren und Laternenschein gezeichnet', () => {
  const h = haendlerHerbei();
  assert.ok(h, 'der Haendler erscheint nicht');
  const r = spielerAnKarren(+15);
  assert.ok(r.spieler >= 0 && r.haendler >= 0 && r.schein >= 0, 'nicht in der Anzeigeliste: ' + JSON.stringify(r));
  assert.ok(r.fussSpieler > r.fussKarren, 'Aufbau: Spieler steht nicht unterhalb: ' + JSON.stringify(r));
  assert.ok(r.spieler > r.haendler, 'Haendler (Figur+Karren) liegt ueber dem Spieler: ' + JSON.stringify(r));
  assert.ok(r.spieler > r.schein, 'Laternenschein liegt ueber dem Spieler: ' + JSON.stringify(r));
  // Der Schein gehoert zur Laterne: ueber dem Karren, sonst ist er unsichtbar.
  assert.ok(r.schein > r.haendler, 'Schein liegt unter dem Karren: ' + JSON.stringify(r));
  assert.ok(r.hinweis > r.spieler, '[E] liegt nicht obenauf: ' + JSON.stringify(r));
  assert.strictEqual(r.spielerTiefe, 100, 'der Spieler soll seine feste Tiefe behalten');
});

test('Spieler oberhalb (hinter) dem Karren: Haendler und Schein werden vor ihm gezeichnet', () => {
  const h = haendlerHerbei();
  assert.ok(h, 'der Haendler erscheint nicht');
  const r = spielerAnKarren(-15);
  assert.ok(r.spieler >= 0 && r.haendler >= 0 && r.schein >= 0, 'nicht in der Anzeigeliste: ' + JSON.stringify(r));
  assert.ok(r.fussSpieler < r.fussKarren, 'Aufbau: Spieler steht nicht oberhalb: ' + JSON.stringify(r));
  assert.ok(r.haendler > r.spieler, 'der Spieler liegt ueber dem Karren, obwohl er dahinter steht: ' + JSON.stringify(r));
  assert.ok(r.schein > r.haendler, 'Schein liegt unter dem Karren: ' + JSON.stringify(r));
  assert.ok(r.hinweis > r.haendler, '[E] liegt nicht obenauf: ' + JSON.stringify(r));
  // Und zurueck nach vorn: je Bild nachgefuehrt, nicht nur beim Erscheinen.
  const zurueck = spielerAnKarren(+15);
  assert.ok(zurueck.spieler > zurueck.haendler && zurueck.spieler > zurueck.schein,
    'nach dem Zuruecklaufen bleibt der Karren vorn: ' + JSON.stringify(zurueck));
});

test('Notfall: fehlt das Karrenbild, traegt er Maras Sprite (120 px)', () => {
  // Das Bild "entfernen": Textur weg und der Lader findet die Datei nicht.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.EventSystem.reset && window.EventSystem.reset();
    if (sc.textures.exists('haendler_karren')) sc.textures.remove('haendler_karren');
    window.__ladeOrig = sc.load.image;
    sc.load.image = function (key, pfad) {
      if (key === 'haendler_karren') pfad = 'assets/sprites/gibt_es_nicht_165.png';
      return window.__ladeOrig.apply(this, [key, pfad].concat([].slice.call(arguments, 2)));
    };
  })()`);
  try {
    const h = haendlerHerbei();
    assert.ok(h, 'ohne Karrenbild erscheint gar kein Haendler');
    assert.strictEqual(h.key, 'spaeherin');
    assert.ok(Math.abs(h.hoehe - 120) < 0.5, 'Hoehe ' + h.hoehe);
    assert.strictEqual(h.schein, false, 'ohne Karren darf keine Laterne flackern');
    const e = handelMitE();
    assert.ok(e.sichtbar, '[E] nicht sichtbar');
    assert.strictEqual(e.dy, 70);
    assert.strictEqual(e.laden, 1, 'der Laden oeffnet sich nicht');
  } finally {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      sc.load.image = window.__ladeOrig;
      window.EventSystem.reset && window.EventSystem.reset();
    })()`);
  }
});

test('das Bild liegt im Repo, die Flagge ist weg', () => {
  const p = path.join(__dirname, '..', 'assets', 'sprites', 'haendler_karren.png');
  assert.ok(fs.existsSync(p), p + ' fehlt');
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'eventSystem.js'), 'utf8');
  assert.ok(quelle.indexOf("an('haendler')") === -1, 'spawnMerchant fragt noch die Flagge ab');
});
