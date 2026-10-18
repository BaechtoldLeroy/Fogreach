// tests/trailerModusOhne.test.js — ohne ?trailer=1 aendert sich nichts.
//
// Der Trailer-Modus greift tief ein (Spielstand, Leben, Uhr, HUD). Ohne
// Flagge darf davon nichts wirken: HUD sichtbar, Spieler verwundbar, die
// Ziffern bleiben Faehigkeitstasten, der Spielstand wird geschrieben.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 1 }); });
after(async () => { if (H) await H.shutdown(); });

test('ohne Flagge ist der Trailer-Modus aus und nichts davon geladen', () => {
  assert.strictEqual(H.run('window.TrailerModus.aktiv()'), false);
  assert.strictEqual(H.run('typeof window.TrailerModus.einstellung'), 'undefined');
  assert.strictEqual(H.run('window.SaveSlots.imSandkasten()'), false);
  assert.strictEqual(H.run(`!!window.game.scene.getScene('TrailerOverlay')`), false);
  assert.strictEqual(H.run('!!window.setPlayerHealth.__trailer'), false);
});

// Hochkant (b446) haengt nur am Trailer: das Spiel selbst bleibt quer.
test('ohne Flagge: Canvas 960x480, eine Kamera, kein Zoom', () => {
  const r = H.run(`JSON.stringify({
    groesse: [window.game.config.width, window.game.config.height, window.game.scale.width, window.game.scale.height],
    hochkant: TRAILER_HOCHKANT,
    kameras: window.game.scene.getScene('GameScene').cameras.cameras.length,
    zoom: window.game.scene.getScene('GameScene').cameras.main.zoom
  })`);
  assert.strictEqual(r, JSON.stringify({ groesse: [960, 480, 960, 480], hochkant: false, kameras: 1, zoom: 1 }));
});

test('ohne Flagge bleibt das HUD im Bild', () => {
  const r = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    var band = gs.children.list.filter(function (o) { return o.scrollFactorX === 0 && o.depth >= 1600 && o.depth < 1700; });
    return { n: band.length, weg: band.filter(function (o) { return o.cameraFilter !== 0; }).length };
  })()`);
  assert.ok(r.n > 5, 'kein HUD gefunden');
  assert.strictEqual(r.weg, 0);
});

test('ohne Flagge ist der Spieler verwundbar', () => {
  const r = H.run(`(function () {
    var vorher = playerHealth;
    window._playerInvincible = false;
    applyPlayerDamage(3, window.game.scene.getScene('GameScene'), null);
    return { vorher: vorher, nachher: playerHealth, flag: window._playerInvincible };
  })()`);
  assert.ok(r.nachher < r.vorher, 'kein Schaden: ' + JSON.stringify(r));
});

test('ohne Flagge loesen die Ziffern keine Einstellung aus', async () => {
  for (const k of ['1', '4', '9', 'z', 'l']) {
    H.dispatch('keydown', { key: k, preventDefault() {}, stopImmediatePropagation() {} });
  }
  H.step(30);
  assert.deepStrictEqual(H.activeScenes().join(','), 'GameScene');
  const t0 = H.run(`window.gameNow(window.game.scene.getScene('GameScene'))`);
  H.step(60);
  const dt = H.run(`window.gameNow(window.game.scene.getScene('GameScene'))`) - t0;
  assert.ok(dt > 900, 'die Spieluhr laeuft verlangsamt: ' + dt);
});

test('ohne Flagge nimmt R nichts auf', () => {
  H.run(`(function () {
    window.__rec = [];
    window.MediaRecorder = function () { window.__rec.push(this); this.start = function () {}; this.stop = function () {}; };
    window.game.canvas.captureStream = function () { return { addTrack: function () {} }; };
  })()`);
  H.dispatch('keydown', { key: 'r', preventDefault() {}, stopImmediatePropagation() {} });
  H.step(5);
  assert.strictEqual(H.run('window.__rec.length'), 0);
});

test('ohne Flagge schreibt saveGame wie bisher', () => {
  H.run(`saveGame(window.game.scene.getScene('GameScene'))`);
  const roh = H.run(`window.localStorage.getItem(window.SaveSlots.key('demonfall_save_v1'))`);
  assert.ok(roh && roh.length > 10, 'kein Spielstand im localStorage');
});
