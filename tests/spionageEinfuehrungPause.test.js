// tests/spionageEinfuehrungPause.test.js — waehrend die Auftrags-Einfuehrung
// laeuft, steht die Spionage still.
//
// Gemeldet (b525): "Spaeher wird schon ausgeloest, wenn noch der
// Introduction-Overlay am Anfang laeuft". Die Szene hielt die Spieluhr an,
// EspionageSystem.update tickte aber weiter: Wachen liefen, Spitzel und
// Ratsbote erkannten den Spieler, bevor er die erste Seite gelesen hatte.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
let H = null;

async function bis(js, runden) {
  for (let i = 0; i < runden; i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

// Spieler direkt vor jeden Melder, Blick auf ihn: so erkennen sie ihn sofort.
const VOR_DIE_MELDER = `(function () {
  var s = window.EspionageSystem.getState();
  var a = s.actors.filter(function (o) { return o && !o.knocked && (o.type === 'spitzel' || o.type === 'ratsbote'); })[0];
  if (!a) return;
  player.setPosition(a.x + 30, a.y); if (player.body) player.body.reset(player.x, player.y);
})()`;

const BILD = `JSON.stringify((function () {
  var s = window.EspionageSystem.getState();
  return {
    wachen: s.guards.map(function (g) { return [Math.round(g.x), Math.round(g.y)]; }),
    melder: s.actors.map(function (a) { return [a.type, a._state || '', Math.round(a.x), Math.round(a.y), !!a._target]; }),
    verdacht: s.detection, enttarnt: !!s.exposed
  };
})())`;

before(async () => {
  H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=lager' });
  H.run('window._playerInvincible = true; if (window.SpionageSzenen) window.SpionageSzenen._TEMPO = 0.2');
});
after(async () => { if (H) await H.shutdown(); });

test('waehrend der Einfuehrung bewegt und meldet niemand', async () => {
  assert.ok(await bis(`!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'start'
    && window.EspionageSystem.getState().actors.length)`, 400), 'keine Einfuehrung im Lager');
  H.run(VOR_DIE_MELDER);
  const vorher = H.run(BILD);
  // Gut 10 s Spielzeit, ohne die Einfuehrung zu schliessen.
  for (let i = 0; i < 300; i++) { H.run(VOR_DIE_MELDER); H.step(2); await flush(); }
  assert.ok(H.run(`!!${GS}.__spionSzene`), 'die Einfuehrung schloss sich von selbst');
  assert.strictEqual(H.run(BILD), vorher, 'die Spionage lief unter der Einfuehrung weiter');

  // Gegenprobe: nach der Einfuehrung laeuft sie wieder.
  H.run(`${GS}.__spionSzene && ${GS}.__spionSzene.ueberspringen()`);
  assert.ok(await bis(`!${GS}.__spionSzene`, 400), 'die Einfuehrung schliesst nicht');
  for (let i = 0; i < 150; i++) { H.run(VOR_DIE_MELDER); H.step(2); await flush(); }
  assert.notStrictEqual(H.run(BILD), vorher, 'nach der Einfuehrung steht die Spionage noch');
});
