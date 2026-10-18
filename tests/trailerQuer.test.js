// tests/trailerQuer.test.js — der Trailer im Querformat (?trailer=1&quer=1).
//
// Hochkant (9:16) ist seit b446 das Trailer-Format. Quer soll es weiter
// geben, genau wie vorher: 960x480, keine zweite Kamera, kein Zoom auf die
// Figuren, symmetrische Letterbox, Aufnahme direkt vom Spiel-Canvas — und
// jede Einstellung baut fehlerfrei auf.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

let H = null;
const zustand = () => H.run('window.TrailerModus.zustand()');

async function bisSeit(ms) {
  for (let i = 0; i < 1500; i++) {
    if (zustand().seit >= ms) return true;
    H.step(4);
    await flush();
  }
  return false;
}

before(async () => {
  H = await launch({ search: '?trailer=1&quer=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 300 }), 'kein Hub');
  await H.settle(() => zustand().hubGesehen, { maxRounds: 40 });
});
after(async () => { if (H) await H.shutdown(); });

test('quer=1: Canvas 960x480, Trailer-Modus an, nicht hochkant', () => {
  assert.strictEqual(H.run('JSON.stringify([window.game.scale.width, window.game.scale.height])'), '[960,480]');
  assert.strictEqual(H.run('window.TrailerModus.aktiv()'), true);
  assert.strictEqual(zustand().hochkant, false);
});

// [Einstellung, Szene, bis (ms), Probe]
const EINSTELLUNGEN = [
  [1, 'HubSceneV2', 2300, `window.game.scene.getScene('HubSceneV2').cameras.main.zoom === 1.12`],
  [2, 'HubSceneV2', 600, `(function () { var hub = window.game.scene.getScene('HubSceneV2');
     return hub.cameras.main.zoom === 1 && hub._dialogContainer.scaleX === 1; })()`],
  [3, 'GameScene', 2600, `window.game.scene.getScene('GameScene').cameras.main.zoom === 1`],
  [4, 'GameScene', 3700, `window.game.scene.getScene('GameScene').cameras.main.zoom === 1`],
  // Kampf mit HUD: quer steht das HUD, wie das Spiel es baut — ganz im Bild.
  [5, 'GameScene', 2800, `(function () { var l = window.TrailerModus._hudLage(window.game.scene.getScene('GameScene'));
     return window.TrailerModus.zustand().hudAn && playerLevel >= 2 && l.length > 10
       && l.every(function (x) { return !x.b || (x.b.l >= -1 && x.b.t >= -1 && x.b.r <= 961 && x.b.u <= 481); })
       && window.game.scene.getScene('GameScene').cameras.main.zoom === 1; })()`],
  [6, 'HubSceneV2', 800, `!window.game.scene.getScene('HubSceneV2').__trailerBuehne.box`],
  [7, 'GameScene', 3200, `(function () { var b = enemies.getChildren().filter(function (e) { return e.active && e.isBoss; })[0];
     return !!b && Math.abs(b.y - player.y) < 60; })()`],
  [8, 'HubSceneV2', 1500, `window.game.scene.getScene('HubSceneV2').children.list.some(function (o) { return o.name === 'druckerpresse' && o.scaleX === 3; })`],
  [9, 'TrailerTitel', 2600, `window.game.scene.getScene('TrailerTitel').titel.scaleX === 3`],
];

for (const [n, szene, bis, probe] of EINSTELLUNGEN) {
  test('quer: Einstellung ' + n + ' baut fehlerfrei auf wie bisher', async () => {
    const vorher = H.hardErrors().length;
    H.run(`window.TrailerModus.taste('${n}')`);
    assert.ok(await bisSeit(bis), 'Einstellung ' + n + ' wurde nicht aufgebaut');
    assert.strictEqual(JSON.stringify(H.hardErrors().slice(vorher).map((f) => f.msg)), '[]');
    assert.ok(H.activeScenes().indexOf(szene) !== -1, 'steht in ' + H.activeScenes().join(','));
    assert.strictEqual(H.run(probe), true, probe);
    // Quer gibt es nur die eine Kamera je Szene.
    if (szene !== 'TrailerTitel') {
      assert.strictEqual(H.run(`window.game.scene.getScene('${szene}').cameras.cameras.length`), 1, 'zweite Kamera im Querformat');
    }
  });
}

test('quer: Letterbox oben und unten gleich (12 %)', () => {
  assert.strictEqual(H.run(`JSON.stringify(window.game.scene.getScene('TrailerOverlay').balken.map(function (b) { return b.height; }))`), '[58,58]');
});

test('quer: R nimmt das Spiel-Canvas selbst auf (960x480)', () => {
  H.run(`(function () {
    function MR() {}
    MR.isTypeSupported = function () { return false; };
    MR.prototype.start = function () {};
    MR.prototype.stop = function () { this.onstop(); };
    window.MediaRecorder = MR;
    window.game.canvas.captureStream = function () { window.__quelle = this; return { addTrack: function () {} }; };
    window.URL = { createObjectURL: function () { return 'blob:probe'; }, revokeObjectURL: function () {} };
  })()`);
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(zustand().aufnahme, true);
  assert.strictEqual(H.run('window.__quelle === window.game.canvas'), true);
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(H.run('window.TrailerModus.letzteAufnahme.groesse'), '960x480');
});
