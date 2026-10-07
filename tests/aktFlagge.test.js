// tests/aktFlagge.test.js — ?akt=<n> oeffnet die Gegnerliste zum Durchtesten.
//
// Die Liste haengt an ZWEI Schranken: die Tiefe oeffnet sie (depthRoster),
// der Story-Akt schliesst sie wieder (ENEMY_MIN_ACT). Ein Sprung per
// ?dungeon=20 startet frisch, steht also in Akt 0 — und dort bleiben von den
// fuenfzehn Typen der Tiefe 20 genau vier uebrig: Ratte, Fledermaus, Wolf
// und Wicht. Es sah aus, als wuerden die uebrigen Gegner nicht spawnen.
//
// Geprueft wird am ECHTEN Weg: hundert Gegner spawnen lassen und zaehlen,
// welche Typen dabei herauskommen. Ein Fall, der nur getAvailableEnemyTypes
// aufruft, uebersieht, dass spawnEnemy den Akt gar nicht von der Flagge holt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

/**
 * Dungeon mit EIGENER Adresse starten.
 *
 * launchDungeon ueberschreibt `search` mit '?dungeon=<tiefe>' — eine zweite
 * Flagge kommt darueber nicht hinein. Der erste Anlauf dieses Falls gab die
 * Adresse an launchDungeon und blieb deshalb gruen gegen alles.
 */
async function startenMit(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await h.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) { await h.shutdown(); throw new Error('GameScene wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 10 });
  return h;
}

/** Welche Gegnertypen kommen bei hundert Spawns heraus? */
const ZAEHLEN = `(function () {
  var sc = window.game.scene.getScene('GameScene');
  var typen = {};
  for (var i = 0; i < 100; i++) {
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    var e = spawnEnemy.call(sc, player.x + 200, player.y);
    if (e && typeof e.enemyType === 'number') typen[e.enemyType] = (typen[e.enemyType] || 0) + 1;
  }
  return Object.keys(typen).map(Number).sort(function (a, b) { return a - b; });
})()`;

test('ohne Flagge bleibt die Liste auf dem Akt des Spielstands', async () => {
  const H = await launchDungeon({ depth: 20 });
  try {
    const typen = H.run(ZAEHLEN);
    const akt = H.run('(window.storySystem && window.storySystem.getCurrentActIndex) ? window.storySystem.getCurrentActIndex() : null');
    // Frisch gestartet: Akt 0. Erlaubt sind dann nur die vier mit minAct 0.
    assert.strictEqual(akt, 0, 'ein frischer Sprung sollte in Akt 0 stehen, steht aber in ' + akt);
    const erlaubt = [1, 8, 9, 10];
    const zuviel = Array.prototype.filter.call(typen, (t) => erlaubt.indexOf(t) === -1);
    assert.strictEqual(zuviel.length, 0,
      'in Akt 0 erschienen Typen spaeterer Akte: ' + Array.prototype.join.call(zuviel, ','));
    assert.ok(typen.length >= 3, 'nur ' + typen.length + ' Typen — zu wenig, der Fall misst nichts');
  } finally { await H.shutdown(); }
});

test('?akt=4 bringt auch die Gegner der spaeten Akte', async () => {
  const H = await startenMit('?dungeon=20&akt=4');
  try {
    const typen = H.run(ZAEHLEN);
    // Die Flagge aendert den Spielstand NICHT — sie wirkt nur auf die Liste.
    const akt = H.run('(window.storySystem && window.storySystem.getCurrentActIndex) ? window.storySystem.getCurrentActIndex() : null');
    assert.strictEqual(akt, 0, 'die Flagge darf den Akt des Spielstands nicht veraendern');

    // Typen, die es OHNE die Flagge nie gibt (minAct 2 bis 4).
    const spaet = [4, 5, 6, 7, 11, 12, 13, 14, 15];
    const gesehen = Array.prototype.filter.call(typen, (t) => spaet.indexOf(t) !== -1);
    assert.ok(gesehen.length >= 5,
      'nur ' + gesehen.length + ' spaete Typen bei hundert Spawns: '
      + Array.prototype.join.call(typen, ','));
  } finally { await H.shutdown(); }
});
