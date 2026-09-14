// tests/altarFest.test.js — der Altar im Verteidigungs-Modus ist fuer niemanden durchgehbar.
//
// Gemeldet: "Altar soll auch fuer Gegner und Projektile nicht durchgehbar sein."
//
// Seit #82 hatte der Altar einen soliden Koerper, aber nur einen Collider fuer
// den SPIELER. Gegner liefen durch das Podest, und Geschosse beider Seiten
// flogen hindurch. Jetzt verhaelt er sich wie jedes Hindernis: Gegner prallen
// ab, Gegnergeschosse gehen zurueck in den Pool, Spielergeschosse vergehen.
//
// Aufgebaut wird der ECHTE Modus ueber die Registry (RoomMode.create) und
// arm(scene) — genau der Weg, auf dem der Raum den Altar hinstellt.
//
// WARUM OHNE FLUG. Ein erster Entwurf schoss Geschosse ueber gepumpte Frames
// auf den Altar. Der Testkopf faengt die simulierte Zeit aber bei jedem
// step()-Aufruf wieder bei 0 an; die Physik stand dabei still, und die
// Geschosse kamen nie an. Stattdessen wird das Geschoss hier AUF den
// Altar-Koerper gelegt und der Collider des Modus direkt ausgeloest — das
// prueft genau die Collider und Callbacks aus roomModeDefend.js, ohne sich auf
// die Uhr zu verlassen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=8', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.clear(true, true);
    enemyProjectiles.clear(true, true);
    sc._enemyProjectilePool = [];
    window.__altarModus = window.RoomMode.create('defend', {});
    window.__altarModus.arm(sc);
    window.__altarSprite = sc.children.list.filter(function (o) {
      return o && o.texture && o.texture.key === 'roommode_defend_altar';
    }).pop();
    // Neue Collider liegen bis zum naechsten Physik-Schritt in einer
    // Warteschlange; hier von Hand aktivieren.
    sc.physics.world.colliders.update();
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Die Collider des Modus am Altar, nach Partner benannt. */
const COLLIDER = `function altarCollider(sc) {
  var alt = window.__altarSprite;
  var aus = {};
  sc.physics.world.colliders.getActive().forEach(function (c) {
    if (c.object1 !== alt && c.object2 !== alt) return;
    var partner = (c.object1 === alt) ? c.object2 : c.object1;
    var name = partner === enemies ? 'gegner'
      : partner === enemyProjectiles ? 'gegnerGeschosse'
      : partner === playerProjectiles ? 'spielerGeschosse'
      : partner === player ? 'spieler' : 'anderes';
    aus[name] = (aus[name] || []).concat([c]);
  });
  return aus;
}`;

/** Legt ein Geschoss auf den Altar-Koerper und loest den Collider des Modus aus. */
function treffer(art) {
  return H.run(`(function () {
    ${COLLIDER}
    var sc = window.game.scene.getScene('GameScene');
    var alt = window.__altarSprite, b = alt.body;
    var c = altarCollider(sc)[${JSON.stringify(art === 'gegner' ? 'gegnerGeschosse' : 'spielerGeschosse')}] || [];
    var g;
    if (${JSON.stringify(art)} === 'gegner') {
      g = acquireEnemyProjectile(sc, 0, 0, 'projectileTexture');
    } else {
      g = sc.physics.add.sprite(0, 0, 'projectileTexture');
      playerProjectiles.add(g);
    }
    g.setPosition(b.x + b.width / 2, b.y + b.height / 2);
    g.body.reset(g.x, g.y);
    var vorher = g.active;
    // Arcade sucht dynamische Koerper ueber einen raeumlichen Baum, der erst im
    // naechsten Physik-Schritt neu gebaut wird — ein eben hingelegtes Geschoss
    // steht noch nicht darin, und der Collider faende nichts. Fuer diesen einen
    // Aufruf die Gruppe direkt durchgehen lassen.
    var w = sc.physics.world, baum = w.useTree;
    w.useTree = false;
    try { c.forEach(function (k) { k.update(); }); }
    finally { w.useTree = baum; }
    return { collider: c.length, vorher: vorher, nachher: !!g.active,
             altarAktiv: !!alt.active, altarSichtbar: !!alt.visible,
             altarImPool: (sc._enemyProjectilePool || []).indexOf(alt) >= 0 };
  })()`);
}

test('Der Altar steht mit Koerper da', () => {
  // Gegenprobe fuer alle weiteren Tests: ohne Altar und Koerper pruefen sie nichts.
  const r = H.run('({ da: !!window.__altarSprite, koerper: !!(window.__altarSprite && window.__altarSprite.body) })');
  assert.strictEqual(r.da, true, 'kein Altar-Sprite gefunden');
  assert.strictEqual(r.koerper, true, 'der Altar hat keinen Koerper');
});

test('Ein Gegnergeschoss wird am Altar aufgehalten', () => {
  const r = treffer('gegner');
  assert.strictEqual(r.collider, 1, r.collider + ' Collider zwischen Gegnergeschossen und Altar');
  assert.strictEqual(r.vorher, true, 'das Geschoss war schon vor dem Treffer weg');
  assert.strictEqual(r.nachher, false, 'das Geschoss wurde am Altar nicht zurueckgegeben');
  assert.strictEqual(r.altarImPool, false, 'der ALTAR landete im Geschoss-Pool');
  assert.strictEqual(r.altarAktiv && r.altarSichtbar, true, 'der Altar ist nach dem Treffer weg');
});

test('Ein Spielergeschoss wird am Altar aufgehalten', () => {
  const r = treffer('spieler');
  assert.strictEqual(r.collider, 1, r.collider + ' Collider zwischen Spielergeschossen und Altar');
  assert.strictEqual(r.vorher, true, 'das Geschoss war schon vor dem Treffer weg');
  assert.strictEqual(r.nachher, false, 'das Geschoss wurde am Altar nicht zerstoert');
  assert.strictEqual(r.altarAktiv && r.altarSichtbar, true, 'der Altar ist nach dem Treffer weg');
});

test('Gegner kollidieren mit dem Altar', () => {
  // Die Physik-Welt statt einer Bewegung: die Gegner-KI setzt ihre
  // Geschwindigkeit in jedem Frame neu, ein geschobener Gegner misst die KI.
  const n = H.run(`(function () {
    ${COLLIDER}
    return (altarCollider(window.game.scene.getScene('GameScene')).gegner || []).length;
  })()`);
  assert.strictEqual(n, 1, n + ' Collider zwischen Gegnern und Altar');
});

test('stop() baut alle Altar-Collider wieder ab', () => {
  const r = H.run(`(function () {
    ${COLLIDER}
    var sc = window.game.scene.getScene('GameScene');
    var zaehle = function () {
      var c = altarCollider(sc), n = 0;
      Object.keys(c).forEach(function (k) { n += c[k].length; });
      return n;
    };
    var vorher = zaehle();
    window.__altarModus.stop();
    sc.physics.world.colliders.update();
    return { vorher: vorher, nachher: zaehle() };
  })()`);
  // Spieler, Gegner, Gegnergeschosse, Spielergeschosse.
  assert.strictEqual(r.vorher, 4, r.vorher + ' Collider am Altar vor stop()');
  assert.strictEqual(r.nachher, 0, r.nachher + ' Collider am Altar nach stop()');
});
