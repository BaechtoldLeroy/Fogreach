// tests/geschossTiefe.test.js — Geschosse fliegen ueber der Treppe.
//
// Gemeldet: "Treppen sind oberhalb von Geschossen, das soll nicht sein."
//
// Nachgesehen: die Treppe liegt auf WELT_TIEFEN.TREPPE (34). Spieler-Geschosse
// standen schon auf 70. Die GEGNER-Geschosse aber bekamen nie eine Tiefe —
// weder acquireEnemyProjectile noch bossFireProjectile rief setDepth. Sie lagen
// auf 0 und damit unter der Treppe.
//
// Gemessen wird am laufenden Spiel, ueber die echten Erzeuger. Die Pool-Probe
// ist die wichtigste: ein Geschoss, das aus dem Pool zurueckkommt, darf nicht
// mit einer alten Tiefe weiterfliegen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=10', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

test('Die Geschoss-Tiefe liegt ueber der Treppe', () => {
  const t = H.run('({ treppe: window.WELT_TIEFEN.TREPPE, geschoss: window.WELT_TIEFEN.GESCHOSS })');
  assert.strictEqual(typeof t.geschoss, 'number', 'WELT_TIEFEN.GESCHOSS fehlt');
  assert.ok(t.geschoss > t.treppe,
    'Geschosse liegen auf ' + t.geschoss + ', die Treppe auf ' + t.treppe);
});

test('Ein neues Gegner-Geschoss liegt ueber der Treppe', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc._enemyProjectilePool = [];
    var p = acquireEnemyProjectile(sc, 100, 100, 'projectileTexture');
    return { tiefe: p.depth, treppe: window.WELT_TIEFEN.TREPPE };
  })()`);
  assert.ok(r.tiefe > r.treppe,
    'das Gegner-Geschoss liegt auf ' + r.tiefe + ', unter der Treppe (' + r.treppe + ')');
});

test('Auch ein Geschoss aus dem Pool liegt ueber der Treppe', () => {
  // Der gemeine Fall: die Tiefe wird nur beim Neubau gesetzt, und ein
  // wiederverwendetes Geschoss fliegt mit der alten weiter.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc._enemyProjectilePool = [];
    var p = acquireEnemyProjectile(sc, 100, 100, 'projectileTexture');
    p.setDepth(0);
    releaseEnemyProjectile(p);
    var q = acquireEnemyProjectile(sc, 140, 140, 'projectileTexture');
    return { ausDemPool: p === q, tiefe: q.depth, treppe: window.WELT_TIEFEN.TREPPE };
  })()`);
  // Gegenprobe: kam wirklich dasselbe Stueck zurueck? Sonst prueft der Test
  // den Pool gar nicht.
  assert.strictEqual(r.ausDemPool, true, 'der Pool hat kein Geschoss zurueckgegeben');
  assert.ok(r.tiefe > r.treppe,
    'das wiederverwendete Geschoss liegt auf ' + r.tiefe + ', unter der Treppe (' + r.treppe + ')');
});

test('Ein Boss-Geschoss liegt ueber der Treppe', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var vorher = enemyProjectiles.getChildren().slice();
    bossFireProjectile(sc, { x: 200, y: 200, damage: 1 }, 0, 100, 10, undefined, 1);
    var neu = enemyProjectiles.getChildren().filter(function (p) { return vorher.indexOf(p) < 0; });
    return { anzahl: neu.length, tiefe: neu.length ? neu[0].depth : null, treppe: window.WELT_TIEFEN.TREPPE };
  })()`);
  assert.strictEqual(r.anzahl, 1, 'bossFireProjectile hat ' + r.anzahl + ' Geschosse erzeugt');
  assert.ok(r.tiefe > r.treppe,
    'das Boss-Geschoss liegt auf ' + r.tiefe + ', unter der Treppe (' + r.treppe + ')');
});

test('Spieler-Geschosse lesen dieselbe Zahl, keine eigene', () => {
  // Zwei eingetippte 70 laufen beim ersten Verschieben auseinander.
  const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'player.js'), 'utf8');
  assert.ok(!/projectile\.setDepth\(\s*70\s*\)/.test(quelle),
    'player.js setzt die Geschoss-Tiefe noch als eigene Zahl');
});
