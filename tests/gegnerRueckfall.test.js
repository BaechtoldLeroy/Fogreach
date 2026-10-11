// tests/gegnerRueckfall.test.js — die gezeichneten Gegnerformen als Rueckfall (#177).
//
// Gesehen werden die Sprite-Saetze aus assets/enemy. Die Formen enemyImp,
// enemyArcher, ... aus graphics.js stammen aus der Zeit davor und sind beim
// Aufraeumen (#177) als Rueckfall geblieben: fehlt eine Bilddatei, steht der
// Gegner damit als Figur da statt als Phasers Fehlerkaestchen. Dieser Fall
// haelt fest, dass das so bleibt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 4 }); });
after(async () => { if (H) await H.shutdown(); });

test('fehlen die Bilder eines Gegners, steht er mit der gezeichneten Form da', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Alles, was der Imp aus Dateien bekommen koennte, entfernen — so, als
    // waeren die Dateien nicht geladen worden.
    sc.textures.getTextureKeys().forEach(function (k) {
      if (k === 'sprite_imp' || /^imp_/.test(k)) sc.textures.remove(k);
    });
    var e = spawnEnemy.call(sc, player.x + 200, player.y, 1);
    if (!e) return { fehler: 'kein Gegner entstanden' };
    return { key: e.texture.key, w: e.frame.width, h: e.frame.height, sichtbar: e.visible && e.alpha > 0 };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.key, 'enemyImp', 'der Imp traegt nicht die Rueckfall-Form: ' + r.key);
  assert.strictEqual(r.w, 64);
  assert.strictEqual(r.h, 64);
  assert.strictEqual(r.sichtbar, true);
});

test('alle sechs Rueckfall-Formen existieren', () => {
  const fehlt = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    return ['enemyImp', 'enemyArcher', 'enemyChainGuard', 'enemyFlameWeaver', 'enemyMage', 'enemyShadow']
      .filter(function (k) { return !sc.textures.exists(k); });
  })()`);
  assert.strictEqual(fehlt.length, 0, 'es fehlen: ' + Array.prototype.join.call(fehlt, ', '));
});
