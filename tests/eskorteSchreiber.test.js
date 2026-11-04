// tests/eskorteSchreiber.test.js: der Schreiber an der Waage der Umschlagstelle.
//
// Spieler meldeten: "wenn der Schreiber einen entdeckt hat, passiert nichts".
// Er rief zwar, aber verkleidet verflog der Verdacht in einem Augenblick, und
// die blauen Wachen, die nachsehen kamen, sahen nicht durch die Verkleidung.
// b522 machte die gerufenen Wachen wachsam; wer weiterging, merkte vom Ruf
// trotzdem nichts ("Schreiber funktioniert noch immer nicht"). Jetzt
// enttarnt der Ruf sofort, und der Transport wartet.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
const SCHREIBER = "window.EspionageSystem.getState().actors.filter(function (a) { return a.type === 'schreiber'; })[0]";

async function bis(H, js, runden, jedesMal) {
  for (let i = 0; i < (runden || 600); i++) {
    if (jedesMal) H.run(jedesMal);
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

// Vor das Pult, mitten in seinen Blick: so lange, bis er ruft.
const VOR_DEM_PULT = `(function () { var a = ${SCHREIBER};
  window.player.setPosition(a.x + Math.cos(a._baseFacing) * 50, a.y + Math.sin(a._baseFacing) * 50); })()`;
const GERUFEN = "window.EspionageSystem.getState().barks.some(function (b) { return b.key === 'ruf_schreiber'; })";

describe('Nachteskorte: der Schreiber entdeckt Dich', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 16, zusatz: '&debug=1&eskorte=1' });
    H.run('window.SpionageSzenen._TEMPO = 0.2; window._playerInvincible = true');
    await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'start')`, 400);
    H.run(`${GS}.__spionSzene && ${GS}.__spionSzene.ueberspringen()`);
    await bis(H, `!${GS}.__spionSzene`);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('der Ruf enttarnt sofort, auch wer gleich weitergeht; der Transport wartet', async () => {
    assert.ok(H.run(`!!${SCHREIBER}`), 'kein Schreiber in der Umschlagstelle');
    assert.strictEqual(H.run('window.EspionageSystem.isDetected()'), false, 'schon vorher enttarnt');
    assert.ok(await bis(H, GERUFEN, 600, VOR_DEM_PULT), 'der Schreiber ruft nicht');
    // Gleich nach dem Ruf weg in die Ecke: b522 liess einen damit davonkommen,
    // und der Spieler merkte vom Ruf nichts.
    H.run('window.player.setPosition(72, 72)');
    H.step(2); await flush();
    assert.strictEqual(H.run('window.EspionageSystem.isDetected()'), true, 'nach dem Ruf passiert nichts');
    const gerufen = H.run(`window.EspionageSystem.getState().guards.filter(function (g) { return g._invest; }).length`);
    assert.ok(gerufen > 0, 'keine Wache geht nachsehen');
    // Enttarnt faehrt der Karren nicht weiter (js/nachteskorte.js).
    const vorher = H.run(`(function () { var s = window.Nachteskorte.getState(); s.phase = 'fahren'; s.ziel = 1; return s.pos.x + ',' + s.pos.y; })()`);
    for (let i = 0; i < 30; i++) { H.run(VOR_DEM_PULT); H.step(2); await flush(); }
    const nachher = H.run(`(function () { var s = window.Nachteskorte.getState(); return s.pos.x + ',' + s.pos.y; })()`);
    assert.strictEqual(nachher, vorher, 'der Karren faehrt trotz Enttarnung');
  });
});
