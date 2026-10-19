// tests/schwachstelleUndInventarEsc.test.js
//
// 1. Schwachstelle (combat_lethal_thrust): +10 % Kritchance je Rang fuer den
//    Hammer der Ahnen UND den Wirbelwind (gewuenscht), nicht fuer andere Angriffe.
// 2. ESC schliesst das Inventar auch im Hub (im Dungeon ging es schon).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(30);
});
after(async () => { if (H) await H.shutdown(); });

/** Krit bei Wurf 0.25, Grund-Krit 0, Schwachstelle auf Rang r? */
function krit(fertigkeit, rang) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var altRang = window.skillRang, altZufall = Math.random, altKrit = playerCritChance;
    window.skillRang = function (id) { return id === 'combat_lethal_thrust' ? ${rang} : 0; };
    playerCritChance = 0;
    Math.random = function () { return 0.25; };
    var e = enemies.getChildren().filter(function (x) { return x && x.active && !x.isBoss; })[0];
    if (!e) return 'kein gegner';
    e.hp = e.maxHp = 1e9; e.isElite = false; e._enchant = null; e.isMagicResistant = false; e._shieldUp = false;
    var r;
    try { r = dealDamageToEnemy(sc, e, 1, ${JSON.stringify(fertigkeit)}); }
    finally { window.skillRang = altRang; Math.random = altZufall; playerCritChance = altKrit; }
    return !!(r && r.isCrit);
  })()`);
}

test('Schwachstelle Rang 3 gibt Hammer und Wirbelwind +30 % Krit, sonst nichts', () => {
  assert.strictEqual(krit('hammer', 3), true, 'Hammer ohne Bonus');
  assert.strictEqual(krit('whirlwind', 3), true, 'Wirbelwind ohne Bonus');
  assert.strictEqual(krit('attack', 3), false, 'Grundangriff bekommt den Bonus');
  assert.strictEqual(krit('charge', 3), false, 'Ansturm bekommt den Bonus');
  assert.strictEqual(krit('whirlwind', 0), false, 'ohne Talent trotzdem Krit');
  assert.strictEqual(krit('whirlwind', 2), false, 'Rang 2 (+20 %) reicht bei Wurf 0.25 nicht');
});

test('ESC schliesst das Inventar im Hub', async () => {
  H.run("window.game.scene.getScene('GameScene').scene.start('HubSceneV2')");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
  H.step(30);
  const offen = H.run(`(function () {
    if (typeof openInventory !== 'function' || typeof invUI === 'undefined' || !invUI || !invUI.overlay) return 'kein inventar';
    openInventory();
    return invOpen;
  })()`);
  assert.strictEqual(offen, true, 'Inventar liess sich im Hub nicht oeffnen: ' + offen);
  H.run("window.game.scene.getScene('HubSceneV2').input.keyboard.emit('keydown-ESC')");
  assert.strictEqual(H.run('invOpen'), false, 'ESC hat das Inventar im Hub nicht geschlossen');
});
