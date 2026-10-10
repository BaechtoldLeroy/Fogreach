// tests/hubSchmiedeName.test.js — Der Eingang heisst "Schmiede" (#188).
//
// Der Hub-Eingang zur Archivschmiede heisst "Schmiede" (EN "Forge"), wie
// die Szene dahinter. Gemessen an der Aktionsbox ueber der Figur, wenn sie in
// der Tuerzone steht — das ist, was man sieht. Die Erzaehltexte ("Deine alte
// Werkstatt") sind nicht betroffen: sie meinen die Werkstatt vor dem Unfall.

const { test } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

async function hubMit(search) {
  const H = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  if (!ok) { await H.shutdown(); throw new Error('HubSceneV2 wurde nicht erreicht'); }
  H.step(20);
  return H;
}

/** Figur in die Schmiede-Tuerzone stellen und die Aktionsbox lesen. */
function boxVorDerSchmiede(H, sprache) {
  H.run(`(function () {
    window.i18n.setLanguage('${sprache}');
    var hub = window.game.scene.getScene('HubSceneV2');
    var z = hub.entranceLabels.filter(function (x) { return x.data.id === 'schmiede_entrance'; })[0].zone.getBounds();
    hub.player.setPosition(z.centerX, z.bottom + 20);
    hub.player.body.reset(z.centerX, z.bottom + 20);
  })()`);
  H.step(10);
  return H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    var a = hub._activeInteractable;
    return { ziel: a && a.type === 'entrance' ? a.data.id : null, text: hub.prompt.text };
  })()`);
}

test('der Eingang heisst Schmiede / Forge', async () => {
  const H = await hubMit('?autostart=1');
  try {
    const de = boxVorDerSchmiede(H, 'de');
    assert.strictEqual(de.ziel, 'schmiede_entrance', 'die Figur steht nicht an der Schmiedetuer');
    assert.strictEqual(de.text, 'Schmiede');
    const en = boxVorDerSchmiede(H, 'en');
    assert.strictEqual(en.text, 'Forge');
  } finally {
    try { H.run("window.i18n.setLanguage('de')"); } catch (e) {}
    await H.shutdown();
  }
});
