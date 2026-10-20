// tests/hubKnoepfeFps.test.js — Hub-Knoepfe oben rechts wie im Dungeon; die
// FPS-Anzeige nur im Debug-Modus.
//
// Gemeldet: "inventar symbol im hub ist noch alte grafik" — der Hub baute
// seine Knoepfe selbst, mit Text-"☰" und Emoji-Rucksack. Jetzt Messingring
// und die Pixel-Symbole aus hud_icons wie hudV2 im Dungeon.
// Gewuenscht: "fps overlay soll in den debug modus verschoben werden" —
// Menue-Eintrag und Taste P nur noch mit aktivem DebugGate.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";

async function hub(search) {
  const H = await launch({ search, renderer: 'canvas' });
  await H.waitForScene('HubSceneV2', { maxRounds: 600 });
  H.run(`(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  return H;
}

describe('ohne Debug', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1'); });
  after(async () => { if (H) await H.shutdown(); });

  test('Hub-Knoepfe zeigen die Pixel-Symbole im Messingring', () => {
    const r = H.run(`(function () {
      var sc = ${HUB}, l = sc.children.list;
      var sym = function (n) { var o = l.filter(function (x) { return x.name === n; })[0]; return o ? o.type + ':' + (o.texture && o.texture.key) : 'fehlt'; };
      return { menue: sym('hubMenueSymbol'), inv: sym('hubInventarSymbol'),
        ringe: l.filter(function (o) { return o.texture && o.texture.key === 'ui_ring' && o.scrollFactorX === 0 && o.x > sc.scale.width * 0.6 && o.y < 200; }).length,
        emoji: l.some(function (o) { return o.type === 'Text' && /\u{1F392}|☰/u.test(o.text || ''); }) };
    })()`);
    assert.strictEqual(r.menue, 'Image:hud_icons');
    assert.strictEqual(r.inv, 'Image:hud_icons');
    // Menue, Inventar und darunter der Rueckmeldungsknopf (feedback.js).
    assert.strictEqual(r.ringe, 3, 'kein Messingring');
    assert.strictEqual(r.emoji, false, 'noch ein Text-/Emoji-Symbol');
  });

  test('FPS: kein Menue-Eintrag, Taste P wirkungslos', () => {
    // Lokal ist das Gate automatisch offen (debugGate.js) — hier gezielt zu.
    const r = H.run(`(function () {
      var sc = ${HUB};
      var echt = window.DebugGate.aktiv; window.DebugGate.aktiv = function () { return false; };
      window.HUDv2.openMenu(sc);
      var fps = sc.children.list.some(function (o) { return o.type === 'Text' && o.text === 'FPS Overlay'; });
      sc.input.keyboard.emit('keydown-P', {});
      window.DebugGate.aktiv = echt;
      if (window.HUDv2._menuContainer && window.HUDv2._menuContainer.close) window.HUDv2._menuContainer.close();
      return { fps: fps, monitor: !!sc._perfMonitor };
    })()`);
    assert.deepStrictEqual([r.fps, r.monitor], [false, false]);
  });
});

describe('mit Debug', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1'); });
  after(async () => { if (H) await H.shutdown(); });

  test('FPS: Menue-Eintrag da, Taste P oeffnet die Anzeige', () => {
    const r = H.run(`(function () {
      var sc = ${HUB};
      window.HUDv2.openMenu(sc);
      var fps = sc.children.list.some(function (o) { return o.type === 'Text' && o.text === 'FPS Overlay'; });
      sc.input.keyboard.emit('keydown-P', {});
      return { fps: fps, monitor: !!sc._perfMonitor };
    })()`);
    assert.deepStrictEqual([r.fps, r.monitor], [true, true]);
  });
});
