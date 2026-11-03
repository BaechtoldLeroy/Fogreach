// tests/loadoutPause.test.js — das Faehigkeiten-Loadout haelt das Spiel an.
//
// Gemeldet: "fähigkeiten loadout muss das spiel im hintergrund pausieren, so
// wie alle anderen menüs auch". Inventar und Einstellungen halten die
// Spieluhr an (pauseGameClock: scene.time und Physik stehen), das Loadout
// liess Gegner und Abklingzeiten weiterlaufen. Geprueft im laufenden Keller.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;
let H = null;

before(async () => {
  H = await launchDungeon({ depth: 3 });
  H.run('window._playerInvincible = true');
});
after(async () => { if (H) await H.shutdown(); });

function oeffnen() {
  H.run(`(function () { var sc = ${SC}; sc._dialogOpen = false; sc._loadoutSuppressUntil = 0;
    window.openLoadoutUI(sc); })()`);
  H.step(2);
}
function schliessen() {
  H.run(`(function () { var sc = ${SC};
    var k = sc.children.list.filter(function (o) { return o._loadout && o._loadout.art === 'close'; })[0];
    k.emit('pointerdown'); })()`);
  H.step(2);
}
// Objekte aus dem vm-Realm sind nicht deepStrictEqual zu Node-Objekten: per JSON.
const angehalten = () => JSON.parse(H.run(`(function () { var sc = ${SC};
  return JSON.stringify({ uhr: window.__GAME_PAUSE.since != null, zeit: !!sc.time.paused,
    physik: !!sc.physics.world.isPaused }); })()`));

test('offen: Spieluhr, Zeit und Physik stehen, Gegner ruehren sich nicht; zu: alles laeuft wieder', () => {
  assert.deepStrictEqual(angehalten(), { uhr: false, zeit: false, physik: false }, 'schon vorher angehalten');
  oeffnen();
  assert.ok(H.run(`!!${SC}._loadoutContainer`), 'Loadout nicht offen');
  assert.deepStrictEqual(angehalten(), { uhr: true, zeit: true, physik: true });

  const lage = () => H.run(`JSON.stringify((${SC}.enemies ? ${SC}.enemies.getChildren() : [])
    .filter(function (e) { return e.active; }).map(function (e) { return [Math.round(e.x), Math.round(e.y)]; }))`);
  const vorher = lage();
  H.step(60);
  assert.strictEqual(lage(), vorher, 'Gegner bewegen sich hinter dem offenen Loadout');

  schliessen();
  assert.strictEqual(H.run(`!!${SC}._loadoutContainer`), false, 'Loadout nicht zu');
  assert.deepStrictEqual(angehalten(), { uhr: false, zeit: false, physik: false });
});

test('war das Spiel schon angehalten, laesst das Schliessen es angehalten', () => {
  H.run(`window.pauseGameClock(${SC})`);
  oeffnen();
  schliessen();
  assert.strictEqual(angehalten().uhr, true, 'Loadout hat eine fremde Pause aufgehoben');
  H.run(`window.resumeGameClock(${SC})`);
});

test('K schliesst das Loadout auch bei stehender Spieluhr', () => {
  oeffnen();
  H.step(10);   // der K-Griff haengt an setTimeout (50 ms), nicht an der stehenden scene.time
  H.run(`${SC}.input.keyboard.emit('keydown-K', {})`);
  H.step(2);
  assert.strictEqual(H.run(`!!${SC}._loadoutContainer`), false, 'K schliesst nicht');
  assert.strictEqual(angehalten().uhr, false);
});
