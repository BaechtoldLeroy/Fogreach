// tests/spionageKeinRing.test.js — In der Spionage wird um den Spieler kein
// Kreis mehr gezeichnet.
//
// Bis b414 lag ein Entdeckungsring (Radius 30) dauerhaft um die Figur, mit
// farbigem Bogen bei Verdacht. Der User wollte ihn weg; Verdacht zeigen die
// Wachen selbst (Kegel und Figur orange, enttarnt rot).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 3 }); });
after(async () => {
  if (H) { try { H.run('window.EspionageSystem.endMission(); window.EspionageVisuals.sync()'); } catch (e) {} await H.shutdown(); }
});

test('Spionage: kein Kreis um den Spieler, auch nicht bei Verdacht', () => {
  const r = H.run(`(function () {
    enemies.clear(true, true);
    var sc = window.game.scene.getScene('GameScene');
    var E = window.EspionageSystem;
    E.startMission(sc, { missionId: 'test', guards: [] });
    window.EspionageVisuals.sync(sc);
    var kreise = [];
    var g = sc.children.list.filter(function (o) { return o.type === 'Graphics'; });
    g.forEach(function (gr) {
      var sc0 = gr.strokeCircle, arc = gr.arc;
      gr.strokeCircle = function (x, y, r) { kreise.push([x, y, r]); return sc0.apply(this, arguments); };
      gr.arc = function (x, y, r) { kreise.push([x, y, r]); return arc.apply(this, arguments); };
    });
    E.getState().detection = 0.6;
    window.EspionageVisuals.sync(sc);
    E.getState().exposed = true;
    window.EspionageVisuals.sync(sc);
    var amSpieler = kreise.filter(function (k) {
      return Math.abs(k[0] - player.x) < 2 && Math.abs(k[1] - player.y) < 60;
    });
    return { anzahl: amSpieler.length, graphics: g.length };
  })()`);
  assert.ok(r.graphics > 0, 'keine Spionage-Grafik aufgebaut — Test misst nichts');
  assert.strictEqual(r.anzahl, 0, r.anzahl + ' Kreise/Boegen um den Spieler gezeichnet');
});
