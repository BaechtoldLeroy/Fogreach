// tests/meldungJagd.test.js — die Wache, bei der der Spitzel meldet, kommt zu Dir.
//
// Gemeldet (b523): "der Spaeher laeuft zur Wache, aber die laeuft dann noch
// immer nicht zum Charakter". Die gemeldete Wache wurde feindselig, stand
// aber meist im Nachbarraum: ohne Sicht und weiter als 1,5 Sichtweiten weg
// beruhigte sie sich nach 4 s wieder. Jetzt sucht sie eine Weile auch ohne
// Sicht (JAGD_NACH_MELDUNG). Am Verhalten im Lager: Spieler steht im Raum
// oben links, die Wache steht im Mittelraum hinter der Trennwand.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

let H = null;

async function bis(js, runden, frames, jedesMal) {
  for (let i = 0; i < runden; i++) {
    if (jedesMal) H.run(jedesMal);
    if (H.run(js)) return true;
    H.step(frames || 2);
    await flush();
  }
  return false;
}

before(async () => {
  H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=lager' });
  H.run('window._playerInvincible = true; if (window.SpionageSzenen) window.SpionageSzenen._TEMPO = 0.2');
  const GS = "window.game.scene.getScene('GameScene')";
  await bis(`(function () { var sc = ${GS}; if (sc.__spionSzene && sc.__spionSzene.ueberspringen) sc.__spionSzene.ueberspringen();
    var s = window.EspionageSystem && window.EspionageSystem.getState(); return !!(s && s.actors && s.actors.length && !sc.__spionSzene); })()`, 400);
});
after(async () => { if (H) await H.shutdown(); });

test('nach der Meldung kommt die Wache aus dem Nachbarraum zum Spieler', async () => {
  H.run(`(function () {
    var s = window.EspionageSystem.getState(), tpl = window.RoomTemplates.TEMPLATES.CouncilWarehouse;
    var T = tpl.size.tile, g0 = tpl.espionage.guards[0];
    var ox = s.guards[0]._homeX - g0.x * T, oy = s.guards[0]._homeY - g0.y * T;
    var P = function (x, y) { return { x: ox + x * T, y: oy + y * T }; };
    // Die Wachen des Raums oben links sind ausser Gefecht: die naechste steht im Mittelraum.
    s.guards.forEach(function (g) { g.knocked = g._homeX < ox + 15 * T && g._homeY < oy + 12 * T; g.hostile = false; g.alert = false; });
    var a = s.actors.filter(function (o) { return o.type === 'spitzel'; })[0];
    var ecke = P(12.5, 10.5);
    a.knocked = false; a.x = ecke.x; a.y = ecke.y; a._weg = null;
    a._state = 'report'; a._runT = 0; a._target = null; a._cool = 0; a._notice = 0;
    window.__a = a; window.__ziel = null; window.__platz = P(3.5, 3.5);
  })()`);
  // Der Spieler steht still oben links in der Ecke (ausser Sicht, weiter als 1,5 Sichtweiten); der Spitzel meldet.
  const STEH = 'player.setPosition(window.__platz.x, window.__platz.y); player.body && player.body.reset(player.x, player.y);';
  const gemeldet = await bis(`(function () { var a = window.__a; if (a._target) window.__ziel = a._target; return a._state === 'rest'; })()`, 600, 2, STEH);
  assert.ok(gemeldet && H.run('!!window.__ziel'), 'der Spitzel meldet nicht');
  assert.ok(H.run('window.__ziel.hostile'), 'die gemeldete Wache ist nicht feindselig');
  // 20 s Spielzeit: die Wache muss bis auf Nahkampf heran.
  const da = await bis(`(function () { var z = window.__ziel; return Math.hypot(z.x - player.x, z.y - player.y) < 60; })()`, 200, 6, STEH);
  assert.ok(da, 'die Wache kommt nicht: ' + H.run(`JSON.stringify({ wache: [Math.round(window.__ziel.x), Math.round(window.__ziel.y)],
    feindselig: window.__ziel.hostile, spieler: [Math.round(player.x), Math.round(player.y)] })`));
});

// Gemeldet (b524): "die Wache reagiert noch immer nicht, wenn ich erkannt
// werde". Der Ratsbote machte die Wache nur wachsam, sie ging weiter ihre
// Runde. Jetzt sieht sie nach, wo er Dich gesehen hat, und die Nachsehzeit
// laeuft erst dort (der Weg aus dem Nachbarraum dauerte laenger als 5 s).
test('nach der Meldung des Ratsboten sieht die Wache nach, wo er Dich gesehen hat, und greift an', async () => {
  H.run(`(function () {
    var s = window.EspionageSystem.getState(), tpl = window.RoomTemplates.TEMPLATES.CouncilWarehouse;
    var T = tpl.size.tile, g0 = tpl.espionage.guards[0];
    var ox = s.guards[0]._homeX - g0.x * T, oy = s.guards[0]._homeY - g0.y * T;
    var P = function (x, y) { return { x: ox + x * T, y: oy + y * T }; };
    s.exposed = false; s.detection = 0; s.disguised = true;
    s.guards.forEach(function (g) {
      g.knocked = g._homeX < ox + 15 * T && g._homeY < oy + 12 * T;
      g.hostile = false; g.alert = false; g._invest = null; g._jagdT = 0; g.x = g._homeX; g.y = g._homeY; g._weg = null;
    });
    s.actors.forEach(function (o) { if (o.type === 'spitzel') o.knocked = true; });
    var a = s.actors.filter(function (o) { return o.type === 'ratsbote'; })[0];
    var ecke = P(12.5, 10.5);
    window.__platz = P(3.5, 3.5);
    a.knocked = false; a.x = ecke.x; a.y = ecke.y; a._weg = null;
    a._state = 'report'; a._runT = 0; a._target = null; a._cool = 0; a._notice = 0;
    a._gesehenBei = { x: window.__platz.x, y: window.__platz.y };
    window.__a = a; window.__ziel = null;
  })()`);
  const STEH = 'player.setPosition(window.__platz.x, window.__platz.y); player.body && player.body.reset(player.x, player.y);';
  const gemeldet = await bis(`(function () { var a = window.__a; if (a._target) window.__ziel = a._target; return a._state === 'rest'; })()`, 600, 2, STEH);
  assert.ok(gemeldet && H.run('!!window.__ziel'), 'der Ratsbote meldet nicht');
  assert.ok(H.run('window.__ziel.alert'), 'die Wache ist nicht wachsam');
  const da = await bis(`(function () { var z = window.__ziel; return z.hostile && Math.hypot(z.x - player.x, z.y - player.y) < 60; })()`, 250, 6, STEH);
  assert.ok(da, 'die Wache kommt nicht: ' + H.run(`JSON.stringify({ wache: [Math.round(window.__ziel.x), Math.round(window.__ziel.y)],
    feindselig: window.__ziel.hostile, nachsehen: !!window.__ziel._invest, spieler: [Math.round(player.x), Math.round(player.y)] })`));
});
