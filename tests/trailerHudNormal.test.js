// tests/trailerHudNormal.test.js — das grosse Rand-HUD gibt es nur im Trailer.
//
// b454 vergroessert das HUD im Trailer-Modus und schiebt es ueber eigene
// Kameras an die Bildraender. Im normalen Spiel bleibt alles beim Alten:
// eine Kamera, kein Filter auf den HUD-Teilen, die Leiste an ihrem Platz in
// voller Groesse 1.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 1 }); });
after(async () => { if (H) await H.shutdown(); });

test('ohne ?trailer=1: eine Kamera, das HUD ungefiltert an seinem Platz', () => {
  H.step(10);
  const r = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene'), e = window.HUDv2.elements, b = e.hpFill.getBounds();
    return { trailer: !!(window.TrailerModus && window.TrailerModus.aktiv && window.TrailerModus.aktiv()),
      kameras: gs.cameras.cameras.length, zoom: gs.cameras.main.zoom, filter: e.hpFill.cameraFilter | e.hpText.cameraFilter,
      lage: [Math.round(b.left), Math.round(b.top), Math.round(b.height)], band: e.hpFill.__trailerBand || null };
  })()`);
  assert.strictEqual(JSON.stringify(r), JSON.stringify({ trailer: false, kameras: 1, zoom: 1, filter: 0, lage: [78, 20, 14], band: null }));
});
