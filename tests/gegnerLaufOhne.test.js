// tests/gegnerLaufOhne.test.js — OHNE ?gegnerlauf=1 bleibt alles wie vor #170.
//
// Keine Laufbilder geladen, kein Laufbild gezeigt, kein Lauf-Zustand am
// Gegner: laufende Gegner tragen wie bisher nur ihre Ruhepose.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 8 }); H.run('window._playerInvincible = true'); });
after(async () => { if (H) await H.shutdown(); });

test('ohne Flagge: keine Laufbilder geladen', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var geladen = sc.textures.getTextureKeys().filter(function (k) { return /_walk_/.test(k); });
    return { geladen: geladen, ruhe: sc.textures.exists('imp_right0') };
  })()`);
  assert.ok(r.ruhe, 'die gewoehnlichen Gegnerbilder fehlen — Test misst nichts');
  // Laenge statt deepStrictEqual: das Feld stammt aus dem vm-Realm.
  assert.strictEqual(r.geladen.length, 0, 'ohne Flagge geladen: ' + r.geladen.join(', '));
});

test('ohne Flagge: laufende Gegner bleiben auf der Ruhepose', () => {
  const gesehen = new Set();
  let zustand = false;
  [[1, 'imp'], [3, 'brute'], [10, 'wolf']].forEach(([typ]) => {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      sc._enemyAttackGraceUntil = 0;
      var e = spawnEnemy.call(sc, player.x + 220, player.y, ${typ});
      if (e && e.body && e.body.reset) e.body.reset(e.x, e.y);
      window.__g = e;
    })()`);
    for (let i = 0; i < 120; i++) {
      const r = H.run(`(function () {
        var e = window.__g;
        if (!e || !e.active) return null;
        return { key: e.texture.key, x: e.x, lauf: e._laufBild !== undefined || e._laufT !== undefined };
      })()`);
      if (r) { gesehen.add(r.key); if (r.lauf) zustand = true; }
      H.step(1);
    }
  });
  const lauf = [...gesehen].filter((k) => /_walk_/.test(k));
  assert.deepStrictEqual(lauf, [], 'Laufbilder ohne Flagge');
  assert.strictEqual(zustand, false, 'Lauf-Zustand am Gegner ohne Flagge');
});
