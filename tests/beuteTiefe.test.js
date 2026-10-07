// tests/beuteTiefe.test.js — was am Boden liegt, liegt HINTER den Gegnern.
//
// Beute und Gold standen auf Tiefe 80, die Gegnerebene auf 50. Ein
// Goldhaufen wurde damit ueber den Gegner gezeichnet, der danebensteht, und
// bei mehreren Abwuerfen verschwand der Gegner halb darunter.
//
// Die 80 stammte aus der Zeit vor der Tiefentabelle: gemeint war "ueber
// allem, was am Boden liegt", getroffen wurden auch die Figuren.
//
// Geprueft wird am ECHTEN Abwurf, nicht an der Konstanten: eine Zahl, die
// nur in WELT_TIEFEN steht und die niemand liest, aendert nichts am Bild.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

test('die Tiefentabelle ordnet Boden, Beute und Figuren', () => {
  const T = H.run('window.WELT_TIEFEN');
  assert.ok(T, 'WELT_TIEFEN fehlt');
  assert.ok(T.BODEN_BEUTE > T.PROP_HOCH,
    'Beute (' + T.BODEN_BEUTE + ') liegt nicht ueber den hohen Requisiten (' + T.PROP_HOCH + ')');
  assert.ok(T.BODEN_BEUTE < T.GEGNER,
    'Beute (' + T.BODEN_BEUTE + ') liegt nicht hinter den Gegnern (' + T.GEGNER + ')');
  assert.ok(T.BODEN_SCHEIN < T.BODEN_BEUTE,
    'der Schein (' + T.BODEN_SCHEIN + ') liegt nicht unter dem Stueck (' + T.BODEN_BEUTE + ')');
});

test('ein echter Goldabwurf liegt hinter der Gegnerebene', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    if (!window.spawnGoldPile && !window.Loot) return { kein: 'keine Gold-Funktion' };
    var vorher = window.goldGroup ? window.goldGroup.getChildren().length : 0;
    // Ueber den echten Weg: das Gold faellt dort, wo ein Gegner stirbt.
    var f = window.spawnGoldPile || (window.Loot && window.Loot.spawnGoldPile);
    if (typeof f !== 'function') return { kein: 'spawnGoldPile nicht erreichbar' };
    f(sc, player.x + 80, player.y, 25, false);
    var kinder = window.goldGroup ? window.goldGroup.getChildren() : [];
    if (kinder.length <= vorher) return { kein: 'kein Gold erzeugt' };
    var g = kinder[kinder.length - 1];
    return { tiefe: g.depth, gegner: sc.enemyLayer ? sc.enemyLayer.depth : null };
  })()`);
  if (r.kein) assert.fail(r.kein);
  assert.ok(r.gegner !== null, 'die Gegnerebene hat keine Tiefe');
  assert.ok(r.tiefe < r.gegner,
    'das Gold liegt auf ' + r.tiefe + ', die Gegner auf ' + r.gegner
    + ' — es wird also VOR ihnen gezeichnet');
});

test('ein echtes Beutestueck liegt hinter der Gegnerebene', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var f = window.spawnLoot || (window.Loot && window.Loot.spawnLoot);
    if (typeof f !== 'function') return { kein: 'spawnLoot nicht erreichbar' };
    var vorher = (sc._activeLootSprites || []).length;
    for (var i = 0; i < 20; i++) {
      f(sc, player.x + 60, player.y + 10, 5);
      if ((sc._activeLootSprites || []).length > vorher) break;
    }
    var l = sc._activeLootSprites || [];
    if (l.length <= vorher) return { kein: 'kein Beutestueck erzeugt' };
    var s = l[l.length - 1];
    return { tiefe: s.depth, gegner: sc.enemyLayer ? sc.enemyLayer.depth : null };
  })()`);
  if (r.kein) return;   // nicht jeder Wurf gibt Beute — dann misst der Fall nichts
  assert.ok(r.tiefe < r.gegner,
    'die Beute liegt auf ' + r.tiefe + ', die Gegner auf ' + r.gegner);
});
