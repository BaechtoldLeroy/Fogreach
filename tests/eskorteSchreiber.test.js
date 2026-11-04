// tests/eskorteSchreiber.test.js: der Schreiber an der Waage der Umschlagstelle.
//
// Spieler meldeten: "wenn der Schreiber einen entdeckt hat, passiert nichts".
// Er rief zwar, aber verkleidet verflog der Verdacht in einem Augenblick, und
// die blauen Wachen, die nachsehen kamen, sahen nicht durch die Verkleidung.
// Jetzt sind die gerufenen Wachen wachsam, solange sie nachsehen: wer stehen
// bleibt, fliegt auf; wer rechtzeitig verschwindet, kommt davon, und die
// Wachen sind danach wieder getaeuscht.

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

  test('wer rechtzeitig verschwindet, kommt davon; die Wachen sind danach wieder getaeuscht', async () => {
    assert.ok(H.run(`!!${SCHREIBER}`), 'kein Schreiber in der Umschlagstelle');
    const blau = H.run("window.EspionageSystem.getState().guards.map(function (g) { return !!g.alert; }).join()");
    assert.ok(await bis(H, GERUFEN, 600, VOR_DEM_PULT), 'der Schreiber ruft nicht');
    const gerufen = H.run(`window.EspionageSystem.getState().guards.filter(function (g) { return g._invest; })
      .map(function (g) { return !!g.alert; })`);
    assert.ok(gerufen.length > 0, 'keine Wache geht nachsehen');
    assert.ok(Array.from(gerufen).every(Boolean), 'die gerufenen Wachen sind nicht wachsam');
    // Weg in die Ecke (ausser Sicht), bis keine mehr nachsieht.
    assert.ok(await bis(H, "!window.EspionageSystem.getState().guards.some(function (g) { return g._invest; })", 900,
      'window.player.setPosition(72, 72)'), 'die Wachen sehen ewig nach');
    assert.strictEqual(H.run('window.EspionageSystem.isDetected()'), false, 'trotz Flucht enttarnt');
    assert.strictEqual(H.run("window.EspionageSystem.getState().guards.map(function (g) { return !!g.alert; }).join()"), blau,
      'die gerufenen Wachen bleiben wachsam');
  });

  test('wer stehen bleibt, den erkennen die gerufenen Wachen: enttarnt, der Transport wartet', async () => {
    H.run('window.EspionageSystem.getState().barks.length = 0');
    assert.ok(await bis(H, GERUFEN, 900, VOR_DEM_PULT), 'der Schreiber ruft kein zweites Mal');
    assert.ok(await bis(H, 'window.EspionageSystem.isDetected()', 600, VOR_DEM_PULT), 'nach dem Ruf passiert nichts');
    assert.ok(H.run("window.EspionageSystem.getState().guards.some(function (g) { return g.hostile; })"), 'keine Wache greift an');
    // Enttarnt faehrt der Karren nicht weiter (js/nachteskorte.js).
    const vorher = H.run(`(function () { var s = window.Nachteskorte.getState(); s.phase = 'fahren'; s.ziel = 1; return s.pos.x + ',' + s.pos.y; })()`);
    for (let i = 0; i < 30; i++) { H.run(VOR_DEM_PULT); H.step(2); await flush(); }
    const nachher = H.run(`(function () { var s = window.Nachteskorte.getState(); return s.pos.x + ',' + s.pos.y; })()`);
    assert.strictEqual(nachher, vorher, 'der Karren faehrt trotz Enttarnung');
  });
});
