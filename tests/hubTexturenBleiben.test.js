// tests/hubTexturenBleiben.test.js — Beim Wechsel Dungeon -> Hub bleiben die
// Gegenstandsbilder dieselben Texturen.
//
// Gemeldet (b413): "Cannot read properties of null (reading 'isGLTexture')"
// beim Verlassen des Dungeons, direkt nach "[Pixeltexturen] 42 Texturen
// ersetzt". Der Hub wendet die Gegenstandsbilder bei jedem Eintritt erneut an
// (HubSceneV2 -> gegenstandsBilderAnwenden), und pixelTexturenAnwenden
// entfernte dabei jede Textur und legte sie neu an — auch wenn sie das Bild
// laengst trug. Ein Objekt, das sie in dem Moment noch hielt, renderte dann
// eine zerstoerte Textur. Jetzt bleibt eine Textur, die das Bild schon traegt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 3 }); });
after(async () => { if (H) await H.shutdown(); });

test('Dungeon -> Hub: die Gegenstandsbilder werden nicht zerstoert und neu angelegt', async () => {
  H.run(`(function () {
    var tm = window.game.textures;
    window.__alt = {};
    ['itSword', 'itBow', 'itAxe'].forEach(function (k) { window.__alt[k] = tm.get(k); });
    window.game.scene.getScene('GameScene').scene.start('HubSceneV2');
  })()`);
  await H.waitForScene('HubSceneV2', { timeoutMs: 60000 });
  for (let i = 0; i < 10; i++) await H.step(1);
  const r = H.run(`(function () {
    var tm = window.game.textures, out = [];
    Object.keys(window.__alt).forEach(function (k) {
      var alt = window.__alt[k];
      out.push(k + ':' + (tm.get(k) === alt ? 'gleich' : 'NEU') + ':' + ((alt.source && alt.source.length) ? 'heil' : 'ZERSTOERT'));
    });
    return out.join(',');
  })()`);
  assert.strictEqual(r, 'itSword:gleich:heil,itBow:gleich:heil,itAxe:gleich:heil',
    'Texturen beim Hub-Eintritt ersetzt: ' + r);
});
