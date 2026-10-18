// tests/druckerpresse.test.js — Die stampfende Druckerpresse (#198).
//
// Pixelbild aus PixelLab (assets/sprites/presse/druckerpresse.png, 9 Bilder
// 128x128). Vorschau ?presse=neu: beim Drucken eines Edikts stampft die
// Presse in der Druckerei, Flugblaetter fliegen, dann schliesst sie. Ohne
// Flagge wie bisher (Toast, nach 900 ms zu). Der Trailer (Einstellung 8)
// zeigt die Presse gross im Bild.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, flush } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const PH = "window.game.scene.getScene('PrintingHouseScene')";

async function bis(H, js, runden) {
  for (let i = 0; i < (runden || 800); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

test('Das Spritesheet: 9 Bilder 128x128 in einer Zeile', () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', 'assets', 'sprites', 'presse', 'druckerpresse.png'));
  assert.strictEqual(buf.readUInt32BE(16), 9 * 128, 'Breite');
  assert.strictEqual(buf.readUInt32BE(20), 128, 'Hoehe');
});

/** Druckerei oeffnen und ein Edikt "drucken" (Ausgang von publishEdict festgelegt). */
async function drucken(H) {
  H.run(`(function () {
    window.openPrintingHouseScene(${HUB});
  })()`);
  assert.ok(await bis(H, `!!(${PH} && ${PH}.sys.isActive())`), 'die Druckerei geht nicht auf');
  for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  H.run(`(function () {
    var ph = window.PrintingHouse;
    window.__echtPublish = window.__echtPublish || ph.publishEdict;
    ph.publishEdict = function () { return { success: true }; };
    var id = (ph.getEdictCatalog()[0] || {}).id;
    ${PH}._publish(id);
    ph.publishEdict = window.__echtPublish;
  })()`);
}

describe('mit ?presse=neu', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1&debug=1&presse=neu', renderer: 'canvas' });
    await H.waitForScene('HubSceneV2', { maxRounds: 600 });
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Drucken: die Presse stampft, Flugblaetter fliegen, dann schliesst die Druckerei', async () => {
    await drucken(H);
    assert.ok(await bis(H, `${PH}.sys.isActive() && ${PH}.children.list.some(function (o) { return o.name === 'druckerpresse'; })`),
      'keine Presse beim Drucken');
    const tiefen = H.run(`(function () {
      var t = ${PH}.children.list.filter(function (o) { return o.name === 'druckerpresse' || o.name === 'druckGrund'; })
        .map(function (o) { return o.depth; });
      return t;
    })()`);
    assert.ok(Array.from(tiefen).every((d) => d >= 2400), 'die Presse liegt unter den Karten');
    // Flugblaetter beim Stoss: Rechtecke ueber der Presse.
    assert.ok(await bis(H, `${PH}.children.list.some(function (o) { return o.type === 'Rectangle' && o.depth === 2402; })`),
      'keine Flugblaetter beim Stoss');
    assert.ok(await bis(H, `!${PH}.sys.isActive()`, 1500), 'die Druckerei schliesst nach dem Stampfen nicht');
  });
});

describe('ohne Flagge', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas' });
    await H.waitForScene('HubSceneV2', { maxRounds: 600 });
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Drucken wie bisher: keine Presse, die Druckerei schliesst', async () => {
    await drucken(H);
    for (let i = 0; i < 30; i++) { H.step(2); await flush(); }
    assert.strictEqual(H.run(`${PH}.sys.isActive() && ${PH}.children.list.some(function (o) { return o.name === 'druckerpresse'; })`), false,
      'Presse ohne Flagge');
    assert.ok(await bis(H, `!${PH}.sys.isActive()`, 1500), 'die Druckerei schliesst nicht');
  });
});

describe('Trailer', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?trailer=1', renderer: 'canvas', waitFor: 'StartScene' });
    await H.waitForScene('HubSceneV2', { maxRounds: 300 });
    await H.settle(() => H.run('window.TrailerModus.zustand().hubGesehen'), { maxRounds: 40 });
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Einstellung 8: die Presse gross im Bild, stampft mit Flugblaettern', async () => {
    H.run("window.TrailerModus.taste('8')");
    assert.ok(await bis(H, `${HUB}.children.list.some(function (o) { return o.name === 'druckerpresse' && o.visible; })`),
      'keine Presse in Einstellung 8');
    const r = H.run(`(function () {
      var s = ${HUB}.children.list.filter(function (o) { return o.name === 'druckerpresse'; })[0];
      var kam = ${HUB}.cameras.main;
      // Hochkant (b446) zeichnet sie die zweite Kamera ohne Zoom: im Bild,
      // wenn irgendeine Kamera sie zeigt.
      var imBild = ${HUB}.cameras.cameras.some(function (k) { return (s.cameraFilter & k.id) === 0; });
      return { breite: s.displayWidth, schirm: kam.width, imBild: imBild };
    })()`);
    assert.ok(r.breite >= r.schirm * 0.2, 'die Presse ist zu klein: ' + r.breite);
    assert.ok(r.imBild, 'die Presse wird als HUD ausgeblendet');
    assert.ok(await bis(H, `${HUB}.children.list.some(function (o) { return o.type === 'Rectangle' && o.depth === 2501; })`),
      'keine Flugblaetter');
  });
});
