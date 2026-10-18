// tests/trailerQuer.test.js — der Trailer im Querformat (?trailer=1&quer=1).
//
// Hochkant (9:16) ist seit b446 das Trailer-Format. Quer soll es weiter
// geben, genau wie vorher: 960x480, keine zweite Kamera, kein Zoom auf die
// Figuren, symmetrische Letterbox, Aufnahme direkt vom Spiel-Canvas — und
// jede Einstellung baut fehlerfrei auf. Nur mit HUD (Einstellung 5) kommen
// Kameras dazu: das HUD klebt 1.25-fach an den Raendern (b454), danach ist
// wieder nur die Hauptkamera da.

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
  // Kampf mit HUD: das HUD 1.25-fach an den Raendern — ganz im Bild.
  [5, 'GameScene', 2800, `(function () { var l = window.TrailerModus._hudLage(window.game.scene.getScene('GameScene'));
     return window.TrailerModus.zustand().hudAn && playerLevel >= 2 && l.length > 10
       && l.every(function (x) { return !x.b || (x.b.l >= -1 && x.b.t >= -1 && x.b.r <= 961 && x.b.u <= 481); })
       && window.game.scene.getScene('GameScene').cameras.main.zoom === 1; })()`],
  // Danach wieder ohne Zusatzkameras (siehe unten), das HUD weg.
  [4, 'GameScene', 300, `window.TrailerModus._hudLage(window.game.scene.getScene('GameScene')).length === 0`],
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
    // Quer gibt es nur die eine Kamera je Szene — ausser mit HUD.
    if (szene !== 'TrailerTitel') {
      assert.strictEqual(H.run(`window.game.scene.getScene('${szene}').cameras.cameras.length`), n === 5 ? 8 : 1, 'Kameras im Querformat');
    }
    if (n === 5) hudAmRand(H.run(`window.TrailerModus._hudLage(window.game.scene.getScene('GameScene'))`));
  });
}

test('quer: Taste H holt die HUD-Kameras und baut sie wieder ab (dieselbe Szene)', async () => {
  H.run(`window.TrailerModus.taste('4')`);
  assert.ok(await bisSeit(300));
  const kameras = () => H.run(`window.game.scene.getScene('GameScene').cameras.cameras.length`);
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  await flush();
  assert.strictEqual(kameras(), 8, 'mit HUD');
  hudAmRand(H.run(`window.TrailerModus._hudLage(window.game.scene.getScene('GameScene'))`));
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  await flush();
  assert.strictEqual(kameras(), 1, 'ohne HUD bleiben Zusatzkameras');
  // Und die Welt samt HUD-freiem Bild zeigt wieder die Hauptkamera allein.
  const r = H.run(`(function () { var gs = window.game.scene.getScene('GameScene'), id = gs.cameras.main.id;
    return { hud: window.TrailerModus._hudLage(gs).length, spieler: (player.cameraFilter & id) === 0 }; })()`);
  assert.strictEqual(JSON.stringify(r), '{"hud":0,"spieler":true}');
});

/** Quer: Leiste oben links, Knoepfe und Karte oben rechts, Faehigkeiten unten — 1.25-fach, nichts ueberdeckt sich. */
function hudAmRand(lage) {
  const g = {};
  lage.filter((x) => x.band && x.b).forEach((x) => {
    const r = g[x.band];
    g[x.band] = r ? { l: Math.min(r.l, x.b.l), t: Math.min(r.t, x.b.t), r: Math.max(r.r, x.b.r), u: Math.max(r.u, x.b.u) } : Object.assign({}, x.b);
  });
  for (const band of ['links', 'knoepfe', 'unten']) assert.ok(g[band], 'Gruppe fehlt: ' + band);
  assert.ok(!g.karte, 'Minikarte im Trailer sichtbar: ' + JSON.stringify(g.karte));
  assert.ok(g.links.t <= 16 && g.links.l <= 16, 'Leiste: ' + JSON.stringify(g.links));
  assert.ok(g.knoepfe.t <= 16 && g.knoepfe.r >= 944, 'Knoepfe: ' + JSON.stringify(g.knoepfe));
  assert.ok(g.unten.u >= 464, 'Faehigkeitsleiste: ' + JSON.stringify(g.unten));
  assert.ok(lage.every((x) => !x.band || ['titel', 'meldung'].indexOf(x.band) !== -1 || x.zoom === 1.25), 'nicht 1.25-fach');
  const namen = Object.keys(g);
  for (let i = 0; i < namen.length; i++) {
    for (let j = i + 1; j < namen.length; j++) {
      const a = g[namen[i]], b = g[namen[j]];
      const ueber = Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.u, b.u) - Math.max(a.t, b.t) > 1;
      assert.ok(!ueber, namen[i] + ' ueberdeckt ' + namen[j] + ': ' + JSON.stringify(g));
    }
  }
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
