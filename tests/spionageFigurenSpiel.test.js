// tests/spionageFigurenSpiel.test.js: die weiteren Figuren der Spionage im
// echten Spiel (Gegenstueck zu tests/spionageFiguren.test.js, das die Regeln
// ohne Phaser prueft).
//
// Die Umschlagstelle ist der schwierigste Fall: dort faehrt zusaetzlich die
// Nachteskorte (Karren, Fuhrmann, Geleerte als Traeger). Geprueft wird, dass
// Schreiber, Geleerte und Ratsbote mit ihren Bildern im Raum stehen, dass die
// Eskorte unbeeintraechtigt faehrt und dass ein Ratsbote, der Dich erkennt,
// eine Wache wachsam macht. Zeit nur per H.step.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";

async function bis(H, js, runden, jeRunde) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    if (jeRunde) H.run(jeRunde);
    H.step(2);
    await flush();
  }
  return false;
}

describe('Spionage-Figuren im Spiel (Umschlagstelle mit Nachteskorte)', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=umschlag&spyseed=5' });
    H.run('window._playerInvincible = true; window.SpionageSzenen._TEMPO = 0.2');
    // Die Auftrags-Szene abwarten und schliessen, damit die Spieluhr laeuft.
    await bis(H, `!!${GS}.__spionSzene`, 400);
    H.run(`${GS}.input.keyboard.emit('keydown', { key: 'Escape', keyCode: 27 })`);
    await bis(H, `!${GS}.__spionSzene`, 200);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Mission laeuft mit Eskorte und gemischter Besetzung, jede Figur mit ihrem Bild', () => {
    const r = JSON.parse(H.run(`(function () {
      var s = window.EspionageSystem.getState(), gs = ${GS};
      var spr = gs.children.list.filter(function (o) { return o.type === 'Sprite' && o.depth === 522 && o.visible; });
      return JSON.stringify({ mission: s.missionId, nk: !!(window.Nachteskorte && window.Nachteskorte.aktiv()),
        typen: s.actors.map(function (a) { return a.type; }), bilder: spr.map(function (o) { return o.texture.key; }),
        wachen: s.guards.length });
    })()`));
    assert.strictEqual(r.mission, 'Umschlagstelle', 'falscher Raum: ' + r.mission);
    assert.ok(r.nk, 'die Nachteskorte laeuft nicht');
    assert.deepStrictEqual(r.typen.slice().sort(), ['geleerter', 'geleerter', 'ratsbote', 'schreiber']);
    // Die eigenen Figuren (tests/spionageFigurenStil prueft Groesse und Rueckfall).
    ['schreiber', 'ratsbote', 'geleerter'].forEach((n) => assert.ok(r.bilder.some((k) => k.indexOf('spion_fig_' + n + '_') === 0),
      'Bild fehlt: ' + n + ' in ' + r.bilder.join(',')));
    assert.ok(!r.bilder.includes('esp_figur_fallback'), 'eine Figur steht als Platzhalter da: ' + r.bilder.join(','));
    assert.ok(r.wachen >= 4, 'Wachen fehlen');
  });

  test('der Karren faehrt trotz der Figuren seine Strecke', async () => {
    // Die Verladung gilt als gehoert (das Gespraech prueft tests/nachteskorte), dann faehrt er los.
    H.run(`(function () { var z = window.EspionageSystem.getState().observeZones.filter(function (o) { return o.questTarget === 'eskorte_verladung'; })[0];
      z._done = true; z._fxDone = true; })()`);
    const start = H.run(`JSON.stringify(window.Nachteskorte.getState().pos)`);
    // Neben dem Karren bleiben, damit der Fuhrmann nicht zurueckfaehrt.
    const fuhr = await bis(H, `(function () { var p = window.Nachteskorte.getState().pos; return JSON.stringify(p) !== ${JSON.stringify(start)}; })()`, 900,
      `(function () { var s = window.Nachteskorte.getState(); player.setPosition(s.pos.x, s.pos.y + 30); })()`);
    assert.ok(fuhr, 'der Karren bewegt sich nicht');
  });

  test('Geleerter arbeitet und bemerkt nichts, der Ratsbote meldet: Wache wachsam', async () => {
    H.run(`(function () { var s = window.EspionageSystem.getState();
      s.guards.forEach(function (g) { g.alert = false; g.hostile = false; }); s.detection = 0; })()`);
    const g0 = H.run(`(function () { var s = window.EspionageSystem.getState(); var g = s.actors.filter(function (a) { return a.type === 'geleerter'; })[0];
      return g._workT; })()`);
    // Vor dem Ratsboten stehen, bis er losrennt; dann weit weg, bis er gemeldet hat.
    const ok = await bis(H, `(function () { var s = window.EspionageSystem.getState();
        return s.guards.some(function (g) { return g.alert; }); })()`, 1500,
      `(function () { var s = window.EspionageSystem.getState(); var a = s.actors.filter(function (o) { return o.type === 'ratsbote'; })[0];
        if (a._state === 'report') player.setPosition(40, 40);
        else player.setPosition(a.x + Math.cos(a._facing) * 45, a.y + Math.sin(a._facing) * 45); })()`);
    assert.ok(ok, 'der Ratsbote macht keine Wache wachsam');
    const r = JSON.parse(H.run(`(function () { var s = window.EspionageSystem.getState();
      var gel = s.actors.filter(function (a) { return a.type === 'geleerter'; });
      return JSON.stringify({ enttarnt: s.exposed, arbeit: gel[0]._workT, merkt: gel.map(function (a) { return a._notice; }) }); })()`));
    assert.strictEqual(r.enttarnt, false, 'die Meldung des Boten enttarnt sofort');
    assert.ok(r.arbeit > g0, 'der Geleerte arbeitet nicht');
    assert.deepStrictEqual(r.merkt, [0, 0], 'ein Geleerter hat etwas bemerkt');
  });
});
