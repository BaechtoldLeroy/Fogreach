// tests/headlessUhr.test.js — die Uhr des Testkopfs laeuft ueber alle step()-Aufrufe weiter.
//
// Bis b252 fing tools/headless/boot.js die simulierte Zeit bei JEDEM
// step()-Aufruf wieder bei 0 an. Der rAF-Zeitstempel sprang zurueck, und
// Phaser sah keinen Fortschritt:
//
//   - 60x step(1) hintereinander: ein Koerper mit 300 px/s kam 25 px weit
//     statt rund 300 und blieb dann stehen.
//
// (Ein zweiter Fall, "step(60) direkt nach step(60)", stand hier auch. Er
// blieb mit der alten Uhr gruen, sicherte also nichts ab, und ist wieder raus.)
//
// Tests, die sich darauf verliessen, waren still falsch: der Kettenblitz-Test
// stellte Gegner hin, die nur deshalb stehen blieben und nicht regenerierten;
// der Pluenderer-Test umging den Fehler mit einem einzigen step(400).
//
// Dieser Test haelt die Uhr fest, damit das nicht wiederkommt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/** Legt einen frei fliegenden Koerper hin, fern von Waenden und Gegnern. */
function koerper() {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (window.__uhrKoerper) { try { window.__uhrKoerper.destroy(); } catch (e) {} }
    var k = sc.physics.add.image(-5000, -5000, 'projectileTexture');
    k.body.setAllowGravity(false);
    k.body.setCollideWorldBounds(false);
    k.body.setVelocity(300, 0);
    window.__uhrKoerper = k;
    window.__uhrStart = k.x;
  })()`);
}
const strecke = () => H.run('Math.round(window.__uhrKoerper.x - window.__uhrStart)');

test('Viele step(1) hintereinander bewegen einen Koerper stetig', () => {
  koerper();
  for (let i = 0; i < 60; i++) H.step(1);
  // 60 Frames zu 16,666 ms mit 300 px/s = 300 px. Grosszuegige Schranke:
  // gemessen wird "die Physik laeuft", nicht die exakte Integration.
  const s = strecke();
  assert.ok(s > 240, 'nach 60x step(1) nur ' + s + ' px statt rund 300');
});
