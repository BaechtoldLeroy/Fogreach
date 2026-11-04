// tests/hubNebelVorne.test.js — der Hub-Nebel treibt auch VOR Figuren und Haeusern.
//
// Gemeldet (b519): "der Nebel liegt hinter den NPCs und Gebaeuden, das
// muesste anders sein". Beide Nebelebenen lagen knapp ueber dem Boden, alle
// y-sortierten Figuren und Haeuser darueber. Jetzt bleibt die dichte Ebene
// am Boden, die duenne treibt ueber allem, was auf dem Platz steht — aber
// unter Markern, Bedienung und Dialogen (Tiefe >= 1000).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { launch } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
let H = null;

before(async () => {
  H = await launch({ search: '', renderer: 'canvas', waitFor: 'StartScene' });
  H.run(`window.game.scene.getScene('StartScene').scene.start('HubSceneV2')`);
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(10);
});
after(async () => { if (H) await H.shutdown(); });

test('die obere Nebelebene liegt ueber Spieler, NPCs und Haeusern, unter der Bedienung', () => {
  const r = JSON.parse(H.run(`(function () { var sc = ${HUB};
    var nebel = sc._bodenNebel || [];
    var ist = function (o) { return nebel.indexOf(o) >= 0; };
    // Alles, was in der Welt steht (mitscrollend, sichtbar, Bild oder Figur).
    var welt = sc.children.list.filter(function (o) {
      return !ist(o) && o.visible && o.scrollFactorX !== 0 && o.depth < 1000
        && (o.type === 'Sprite' || o.type === 'Image');
    });
    var hoechstes = welt.reduce(function (m, o) { return Math.max(m, o.depth); }, -1e9);
    return JSON.stringify({ ebenen: nebel.map(function (n) { return n.depth; }),
      welt: welt.length, hoechstes: hoechstes, spieler: sc.player ? sc.player.depth : null });
  })()`));
  assert.strictEqual(r.ebenen.length, 2, 'zwei Nebelebenen erwartet');
  assert.ok(r.welt > 10, 'keine Weltobjekte gefunden (Testannahme)');
  assert.ok(r.ebenen[0] < 0, 'die dichte Ebene gehoert an den Boden: ' + r.ebenen[0]);
  assert.ok(r.ebenen[1] > r.hoechstes, 'Nebel hinter Figuren/Haeusern: ' + r.ebenen[1] + ' <= ' + r.hoechstes);
  assert.ok(r.ebenen[1] > r.spieler, 'Nebel hinter dem Spieler');
  assert.ok(r.ebenen[1] < 1000, 'Nebel ueber Markern und Bedienung');
});
