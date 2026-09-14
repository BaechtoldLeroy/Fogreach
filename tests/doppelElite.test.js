// tests/doppelElite.test.js — ein Gegner, der zweimal Elite wird, laesst nichts liegen.
//
// Gemeldet: "schon wieder eine Aura und ein Label eines Mobs: Spectral Hit Brute".
//
// Der Pfad: der Bannertraeger der Kriegsschar (wave.js) kommt aus spawnEnemy,
// das selbst schon Champion wuerfeln kann, und wird danach auf 'unique'
// gesetzt. Vor dem Fix ueberschrieben Aura und Zug des Bannertraegers die
// Referenzen des Champions; die alten gehoerten niemandem mehr und blieben an
// der Spawnstelle stehen. Gemessen: 2 Auren, 2 Zuege, je einer verwaist, und
// die LP gestapelt (x1,5 und dann x2).
//
// verwaisteAuren.test.js prueft den Kehraus beim Raumwechsel. Dieser Test
// prueft, dass der Muell gar nicht erst entsteht.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  // schar=1 erzwingt die Kriegsschar in jeder Welle (nur bei aktivem DebugGate).
  H = await launch({ search: '?autostart=1&dungeon=12&schar=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/** Zaehlt Auren und Zuege in der Gegner-Ebene, und welche niemandem gehoeren. */
const ZAEHLEN = `function zaehle(sc) {
  var bes = new Set();
  enemies.children.iterate(function (e) {
    if (!e) return;
    if (e._eliteAura) bes.add(e._eliteAura);
    if (e._eliteNameTag) bes.add(e._eliteNameTag);
  });
  var z = { auren: 0, zuege: 0, verwaist: [] };
  sc.enemyLayer.list.forEach(function (o) {
    var a = o.type === 'Graphics' && o.depth === 38;
    var t = o.type === 'Text' && o.depth === 51;
    if (a) z.auren++;
    if (t) z.zuege++;
    if ((a || t) && !bes.has(o)) z.verwaist.push(t ? o.text : 'Aura');
  });
  return z;
}`;

test('Der Bannertraeger der Kriegsschar hinterlaesst keine Champion-Aura', () => {
  // Am ECHTEN Weg: startNextWave setzt die Kriegsschar. Der Wurf in spawnEnemy
  // ist auf Champion festgehalten — genau der Fall, der den Bannertraeger
  // zweimal aufwertet. Gefolge und Auffueller werden dabei ebenfalls Champion;
  // das ist gewollt, jeder von ihnen besitzt dann seine eigene Aura.
  //
  // startNextWave setzt die Gegner erst per delayedCall(0) — der Wurf muss
  // darum ueber den gepumpten Frame festgehalten bleiben, nicht nur ueber den
  // Aufruf.
  //
  // MEHRERE Wellen: spawnEnemy wuerfelt vorher noch den alten Legacy-Elite
  // (8 % ab Tiefe 5). Trifft der den Bannertraeger, wird er gar nicht erst
  // Champion, und die Welle prueft den Doppelpfad nicht. Genau das ist beim
  // ersten Entwurf dieses Tests passiert: er lief einmal, erwischte die 8 %
  // und blieb auch ohne Fix gruen. Deshalb wird gezaehlt, wie viele Wellen den
  // Doppelpfad WIRKLICH getroffen haben, und das muss mindestens eine sein.
  const WELLEN = 4;
  let doppelt = 0;
  for (let w = 0; w < WELLEN; w++) {
    H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      enemies.clear(true, true);
      window.EliteEnemies.verwaisteAnzeigenAbraeumen(sc, enemies);
      var EE = window.EliteEnemies;
      window.__echtEliteWurf = EE.shouldSpawnElite;
      window.__echtAufwerten = EE.applyEliteToEnemy;
      window.__doppelt = 0;
      EE.shouldSpawnElite = function () { return 'champion'; };
      EE.applyEliteToEnemy = function (e, rang) {
        if (e && e._isElite && rang === 'unique') window.__doppelt++;
        return window.__echtAufwerten.apply(this, arguments);
      };
      startNextWave.call(sc, true);
    })()`);
    try { H.step(5); }
    finally {
      H.run(`(function () {
        window.EliteEnemies.shouldSpawnElite = window.__echtEliteWurf;
        window.EliteEnemies.applyEliteToEnemy = window.__echtAufwerten;
        delete window.__echtEliteWurf; delete window.__echtAufwerten;
      })()`);
    }
    const r = H.run(`(function () {
      ${ZAEHLEN}
      var sc = window.game.scene.getScene('GameScene');
      var banner = 0;
      enemies.children.iterate(function (e) { if (e && e.eliteTier === 'unique') banner++; });
      return { banner: banner, gegner: enemies.getLength(), doppelt: window.__doppelt, z: zaehle(sc) };
    })()`);
    assert.strictEqual(r.banner, 1, 'Welle ' + (w + 1) + ': kein Bannertraeger gesetzt (' + r.gegner + ' Gegner)');
    // Laenge statt deepStrictEqual: H.run liefert Arrays aus dem Spiel-Realm.
    assert.strictEqual(r.z.verwaist.length, 0,
      'Welle ' + (w + 1) + ' hinterliess verwaist: ' + JSON.stringify(r.z.verwaist));
    doppelt += r.doppelt;
  }
  // Gegenprobe: ohne einen echten Doppelpfad prueft der Test nichts.
  assert.ok(doppelt >= 1, 'in ' + WELLEN + ' Wellen wurde kein Bannertraeger zweimal aufgewertet');
});

test('Zweimal aufgewertet: eine Aura, ein Zug, LP nur einmal vervielfacht', () => {
  const r = H.run(`(function () {
    ${ZAEHLEN}
    var sc = window.game.scene.getScene('GameScene');
    enemies.clear(true, true);
    window.EliteEnemies.verwaisteAnzeigenAbraeumen(sc, enemies);
    var echt = window.EliteEnemies.shouldSpawnElite;
    window.EliteEnemies.shouldSpawnElite = function () { return null; };
    var e;
    try { e = spawnEnemy.call(sc, 400, 400, 'enemy'); }
    finally { window.EliteEnemies.shouldSpawnElite = echt; }
    var grund = e.hp;
    window.EliteEnemies.applyEliteToEnemy(e, 'champion');
    var alsChampion = e.hp;
    window.EliteEnemies.applyEliteToEnemy(e, 'unique');
    return {
      grund: grund, alsChampion: alsChampion, hp: e.hp, maxHp: e.maxHp,
      rang: e.eliteTier, z: zaehle(sc)
    };
  })()`);
  assert.strictEqual(r.rang, 'unique');
  assert.ok(r.alsChampion > r.grund, 'Champion hat die LP nicht erhoeht');
  assert.strictEqual(r.z.verwaist.length, 0, 'verwaist: ' + JSON.stringify(r.z.verwaist));
  assert.strictEqual(r.z.auren, 1, r.z.auren + ' Auren fuer einen Gegner');
  assert.strictEqual(r.z.zuege, 1, r.z.zuege + ' Zuege fuer einen Gegner');
  assert.strictEqual(r.hp, Math.round(r.grund * 2),
    'LP ' + r.hp + ' statt ' + Math.round(r.grund * 2) + ' (Grund ' + r.grund + ' x2)');
  assert.strictEqual(r.maxHp, r.hp);
});
