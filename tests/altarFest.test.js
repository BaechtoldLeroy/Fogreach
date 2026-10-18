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
// auf den Altar. Damals fing der Testkopf die simulierte Zeit bei jedem
// step()-Aufruf wieder bei 0 an (inzwischen behoben); die Physik stand still,
// und die Geschosse kamen nie an. Das Geschoss wird hier AUF den Altar-Koerper
// gelegt und der Collider des Modus direkt ausgeloest — das prueft genau die
// Collider und Callbacks aus roomModeDefend.js, unabhaengig von Flugbahn,
// Tempo und anderen Hindernissen auf dem Weg.

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
      // Der Pixel-Altar (raummodus_altar); die alte Zeichnung nur ohne Bild.
      return o && o.texture && o.texture.key === 'raummodus_altar';
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

// Der Koerper soll nur das sichtbare Steinpodest abdecken (im Bild Zeilen
// ~34-56), nicht den schwebenden Kristall darueber. Bis b448 setzte ein
// updateFromGameObject() nach setSize/setOffset den statischen Koerper auf
// das volle 64x60-Rechteck zurueck; gemessen: Koerper 64x60 ab der linken
// oberen Sprite-Ecke, der Kristall blockierte mit.
test('Der Altar-Koerper deckt nur das Steinpodest ab', () => {
  const r = H.run(`(function () {
    var s = window.__altarSprite, b = s.body;
    var links = s.x - s.displayWidth * s.originX, oben = s.y - s.displayHeight * s.originY;
    var fy = s.displayHeight / s.frame.height, fx = s.displayWidth / s.frame.width;
    return { x: b.x - links, y: b.y - oben, w: b.width, h: b.height, fx: fx, fy: fy };
  })()`);
  const m = JSON.stringify(r);
  assert.ok(Math.abs(r.w - 48 * r.fx) <= 2 && Math.abs(r.h - 22 * r.fy) <= 2, 'Koerper ist nicht ~48x22: ' + m);
  // Relativ zur linken oberen Sprite-Ecke: auf Hoehe des Podests, nicht des Kristalls.
  assert.ok(r.y >= 30 * r.fy && r.y + r.h <= 60 * r.fy, 'Koerper liegt nicht auf dem Podest: ' + m);
  assert.ok(r.x >= 4 * r.fx && r.x + r.w <= 60 * r.fx, 'Koerper ragt seitlich ueber das Sprite: ' + m);
});

test('Der Spieler steht beim Kristall frei, im Podest nicht', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var s = window.__altarSprite, w = sc.physics.world, p = window.player, pb = p.body;
    var oben = s.y - s.displayHeight * s.originY;
    // Legt den Spieler so, dass die Mitte seines Koerpers auf (x, y) liegt,
    // und laesst die Physik-Welt Spieler und Altar einmal trennen.
    var probe = function (x, y) {
      var dx = p.x - pb.center.x, dy = p.y - pb.center.y;
      p.setPosition(x + dx, y + dy);
      pb.reset(p.x, p.y);
      var vorher = { x: p.x, y: p.y };
      var hit = w.collide(p, s);
      return { hit: hit, bewegt: Math.hypot(p.x - vorher.x, p.y - vorher.y) };
    };
    // Kristall: Unterkante des Spieler-Koerpers knapp ueber dem Podest, also
    // mitten im gezeichneten Kristall/Aufsatz (alter 64x60-Koerper).
    var kristall = probe(s.x, oben + 34 * (s.displayHeight / s.frame.height) - pb.height / 2 - 2);
    var podest = probe(s.body.center.x, s.body.center.y);
    return { kristall: kristall, podest: podest };
  })()`);
  const m = JSON.stringify(r);
  assert.strictEqual(r.kristall.hit, false, 'der Kristall ueber dem Podest blockiert den Spieler: ' + m);
  assert.strictEqual(r.kristall.bewegt, 0, 'der Spieler wurde vom Kristall weggeschoben: ' + m);
  assert.strictEqual(r.podest.hit, true, 'das Podest blockiert den Spieler nicht: ' + m);
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
