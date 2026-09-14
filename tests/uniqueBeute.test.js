// tests/uniqueBeute.test.js — das Magisch+-Stueck des Uniques unterliegt der Bremse.
//
// Gemeldet: "die Dropchance von Uniques und Elites auf Tiefe 30+ kommt mir
// sehr hoch vor."
//
// Gemessen auf Tiefe 30: Normale Gegner und Champions lagen im Rahmen (0,5 %
// bzw. ~4 % je Kill, gebremst ein Fuenftel davon). Das Unique lieferte ~107 %
// — ein GARANTIERTES Magisch+-Stueck, das an Schwelle und Bremse vorbeiging.
// Bei ~0,4 Uniques je Raum waren das rund fuenf sichere Stuecke je Durchgang;
// die Uniques waren der Beutestrom.
//
// Jetzt: sicher fuer die ersten zwei Stuecke des Laufs, danach 25 %.
//
// Nebenbefund, mit behoben: die Zusatzbeute haengt an destroy() und fiel
// darum auch, wenn ein Unique beim Raumwechsel nur weggeraeumt wurde — der
// Zaehler der Bremse stieg dabei um eins.
//
// Gemessen wird am echten Todesweg (handleEnemyHit). Der Zufall bleibt ueber
// die gepumpten Frames festgehalten, weil destroy und die Zusatzbeute nicht
// zwingend im selben Aufruf fallen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=30', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Legt ein Unique hin, haelt Math.random fest, faengt spawnLoot ab.
 * Gezaehlt werden nur Aufrufe mit einem FERTIGEN Stueck, die von diesem
 * Gegner kommen — das ist das Magisch+-Stueck. Die normalen Wuerfe reichen
 * item=null durch und zaehlen nicht.
 */
function uniqueVorbereiten(zaehler, zufall) {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var EE = window.EliteEnemies;
    var echtWurf = EE.shouldSpawnElite;
    EE.shouldSpawnElite = function () { return null; };
    var e;
    try {
      for (var t = 0; t < 50; t++) {
        e = spawnEnemy.call(sc, 400, 400, 'enemy');
        if (e && !e.isElite) break;
        if (e) { e.hp = 0; e._isElite = false; e.destroy(); e = null; }
      }
    } finally { EE.shouldSpawnElite = echtWurf; }
    EE.applyEliteToEnemy(e, 'unique');
    window.__probe = { gegner: e, stuecke: 0 };
    window.__echtLoot = window.spawnLoot;
    window.__echtZufall = Math.random;
    window.spawnLoot = function (x, y, item, quelle) {
      if (item && quelle === window.__probe.gegner) window.__probe.stuecke++;
      return window.__echtLoot.apply(this, arguments);
    };
    window.__runItemsDropped = ${zaehler};
    Math.random = function () { return ${zufall}; };
  })()`);
}

function aufraeumen() {
  H.run(`(function () {
    if (window.__echtZufall) Math.random = window.__echtZufall;
    if (window.__echtLoot) window.spawnLoot = window.__echtLoot;
    delete window.__echtZufall; delete window.__echtLoot;
  })()`);
}

/** Erlegt das Unique am echten Weg und liefert die Zahl der Magisch+-Stuecke. */
function erlegen(zaehler, zufall) {
  uniqueVorbereiten(zaehler, zufall);
  try {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var e = window.__probe.gegner;
      e.hp = 0;
      handleEnemyHit(sc, e);
    })()`);
    H.step(30);
  } finally { aufraeumen(); }
  return H.run('({ stuecke: window.__probe.stuecke, aktiv: !!window.__probe.gegner.active })');
}

test('Frueh im Lauf ist das Stueck sicher, auch beim schlechtesten Wurf', () => {
  const r = erlegen(0, 0.99);
  assert.strictEqual(r.aktiv, false, 'das Unique wurde nicht erlegt');
  assert.strictEqual(r.stuecke, 1, 'bei 0 gefallenen Stuecken kamen ' + r.stuecke + ' Magisch+-Stuecke');
});

test('Nach zwei Stuecken ist es keine Garantie mehr', () => {
  // 0,99 liegt ueber 25 %: kein Stueck. Das ist genau der Fall, der vorher
  // trotzdem ein Stueck lieferte.
  const r = erlegen(2, 0.99);
  assert.strictEqual(r.aktiv, false, 'das Unique wurde nicht erlegt');
  assert.strictEqual(r.stuecke, 0, 'bei 2 gefallenen Stuecken und schlechtem Wurf kam trotzdem eines');
});

test('Nach zwei Stuecken bleibt die Chance, sie ist nicht null', () => {
  // Gegenprobe: 0,1 liegt unter 25 %. Sonst waere der Test oben auch mit
  // einer abgeschalteten Beute gruen.
  const r = erlegen(6, 0.1);
  assert.strictEqual(r.stuecke, 1, 'bei gutem Wurf kam kein Stueck');
});

test('Ein weggeraeumtes Unique laesst beim Raumwechsel nichts fallen', () => {
  uniqueVorbereiten(0, 0.5);
  let r;
  try {
    r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var ziel = (sc.currentRoom && typeof sc.currentRoom.id === 'number') ? sc.currentRoom.id + 1 : 1;
      enterRoom(sc, ziel);
      return { stuecke: window.__probe.stuecke, zaehler: window.__runItemsDropped,
               weg: !window.__probe.gegner.active };
    })()`);
  } finally { aufraeumen(); }
  // Gegenprobe: ist das Unique wirklich weg? Sonst prueft der Test nichts.
  assert.strictEqual(r.weg, true, 'das Unique steht nach dem Raumwechsel noch');
  assert.strictEqual(r.stuecke, 0, 'das weggeraeumte Unique liess ein Magisch+-Stueck fallen');
  assert.strictEqual(r.zaehler, 0, 'der Zaehler der Bremse stieg beim Raumwechsel auf ' + r.zaehler);
});
