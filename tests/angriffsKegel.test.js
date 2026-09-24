// tests/angriffsKegel.test.js — #164: der Schlag geht von der Koerpermitte aus.
//
// Der Ursprung der Spielfigur liegt bei 0.92, also fast am unteren Sprite-Rand.
// Gegner tragen ihren Ursprung in der Mitte. Gemessen wurde bis hierher von den
// Fuessen des Spielers bis zum Zentrum des Gegners — nach oben rund 90 px bei
// 100 Reichweite, nach unten fast nichts. Ein Schlag nach oben traf praktisch
// nie, nach unten immer.
//
// Zwei Aenderungen halten das jetzt gerade:
//   * angriffsUrsprung() — der Kegel beginnt in der sichtbaren Koerpermitte,
//   * _gegnerKante()     — gemessen wird bis zur Koerperkante des Gegners,
//                          nicht bis zu seinem Mittelpunkt.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 4 });
  L = H.lab;
  // Die Sichtlinie ist hier nicht die Frage. Die Raeume sind zufaellig mit
  // Faessern und Kisten vollgestellt; ohne diesen Griff haengt eine reine
  // Geometrie-Aussage am Wuerfel des Raumbaus.
  H.run(`(function () {
    window.__losEcht = Steering.hasLineOfSight;
    Steering.hasLineOfSight = function () { return true; };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  L.clearEnemies();
  L.disableCrit();
  L.healPlayer();
  H.run('window._playerInvincible = true');
});

const RICHTUNGEN = [
  ['rechts', 1, 0], ['runter-rechts', 0.7071, 0.7071],
  ['runter', 0, 1], ['runter-links', -0.7071, 0.7071],
  ['links', -1, 0], ['hoch-links', -0.7071, -0.7071],
  ['hoch', 0, -1], ['hoch-rechts', 0.7071, -0.7071]
];

/**
 * Setzt den Gegner mit demselben Abstand zum SICHTBAREN Koerper in Richtung
 * (dx,dy) und schlaegt einmal zu. Gibt den Schaden zurueck.
 */
function schlagIn(ref, dx, dy, spalt) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = window.__lab.refs[${ref}];
    if (!e) return { fehler: 'Gegner fehlt' };
    var u = angriffsUrsprung();
    // Halbe Ausdehnung der Spielfigur in Schlagrichtung — derselbe Rechenweg
    // wie _gegnerKante, nur fuer den Spieler.
    var hw = Math.abs(player.displayWidth || 0) / 2;
    var hh = Math.abs(player.displayHeight || 0) / 2;
    var ux = Math.abs(${dx}), uy = Math.abs(${dy});
    var spielerKante = Math.min(ux > 1e-6 ? hw / ux : Infinity, uy > 1e-6 ? hh / uy : Infinity);
    var weg = spielerKante + ${spalt} + _gegnerKante(e, ${dx}, ${dy});
    var x = u.x + ${dx} * weg, y = u.y + ${dy} * weg;
    e.body.reset(x, y); e.x = x; e.y = y;
    e.maxHp = 1000000; e.hp = 1000000;
    lastMoveDirection.set(${dx}, ${dy});
    isAttacking = false; attackCooldown = false;
    var vor = e.hp;
    attack.call(sc);
    return { schaden: vor - e.hp, abstand: Math.round(weg) };
  })()`);
}

test('Aus acht Richtungen bei gleichem Abstand trifft der Schlag acht Mal', () => {
  const SPALT = 50;                      // Luft zwischen beiden Koerpern
  const ref = L.spawnEnemy(1, 120, 0);
  const daneben = [];
  RICHTUNGEN.forEach(([name, dx, dy]) => {
    const r = schlagIn(ref, dx, dy, SPALT);
    assert.ok(!r.fehler, r.fehler);
    if (!(r.schaden > 0)) daneben.push(name + ' (Mitte zu Mitte ' + r.abstand + ')');
  });
  assert.strictEqual(daneben.length, 0, 'verfehlt: ' + daneben.join(', '));
});

test('Nach unten bleibt der Schlag brauchbar', () => {
  // Der verschobene Ursprung kostet nach unten dieselben ~29 px, die er nach
  // oben gewinnt. Dort war die Reichweite vorher zu grosszuegig — sie darf
  // aber nicht ins Gegenteil kippen.
  const ref = L.spawnEnemy(1, 120, 0);
  assert.ok(schlagIn(ref, 0, 1, 40).schaden > 0, '40 px unter der Figur traf nichts mehr');
});

test('Der Ursprung liegt in der Koerpermitte, nicht an den Fuessen', () => {
  const r = H.run(`(function () {
    var u = angriffsUrsprung();
    return { hoch: Math.round(player.y - u.y), breit: Math.round(player.x - u.x),
      halbeHoehe: Math.round(player.displayHeight / 2) };
  })()`);
  assert.strictEqual(r.breit, 0, 'waagerecht wurde verschoben');
  assert.ok(r.hoch > 0, 'der Ursprung sitzt weiterhin auf player.y');
  // 0.92 - 0.5 = 0.42 der Hoehe, also gut vier Fuenftel der halben Hoehe.
  assert.ok(Math.abs(r.hoch - r.halbeHoehe * 0.84) <= 2,
    'der Versatz passt nicht zur Figur: ' + r.hoch + ' bei halber Hoehe ' + r.halbeHoehe);
});

test('Der sichtbare Kegel beginnt dort, wo der Schaden beginnt', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var echt = sc.add.graphics, gesehen = null;
    sc.add.graphics = function () {
      var g = echt.apply(this, arguments);
      var slice = g.slice;
      g.slice = function (x, y) { gesehen = { x: x, y: y }; return slice.apply(this, arguments); };
      return g;
    };
    try { showAttackEffect(sc, { duration: 1 }); } finally { sc.add.graphics = echt; }
    var u = angriffsUrsprung();
    return { gesehen: gesehen, u: { x: u.x, y: u.y }, fuss: player.y };
  })()`);
  assert.ok(r.gesehen, 'showAttackEffect hat keinen Kegel gezeichnet');
  assert.ok(Math.abs(r.gesehen.x - r.u.x) < 0.01 && Math.abs(r.gesehen.y - r.u.y) < 0.01,
    'gezeichnet bei ' + JSON.stringify(r.gesehen) + ', geschadet ab ' + JSON.stringify(r.u));
  assert.ok(Math.abs(r.gesehen.y - r.fuss) > 1, 'der Kegel haengt noch an den Fuessen');
});

test('Die Kante wird richtungsabhaengig gemessen, nicht als Kreis', () => {
  const r = H.run(`(function () {
    var e = { _hitHalfW: 10, _hitHalfH: 25 };
    return { seite: _gegnerKante(e, 1, 0), oben: _gegnerKante(e, 0, -1),
      schraeg: Math.round(_gegnerKante(e, 1, -1) * 100) / 100 };
  })()`);
  assert.strictEqual(r.seite, 10, 'zur Seite wird nicht die halbe Breite gemessen');
  assert.strictEqual(r.oben, 25, 'nach oben wird nicht die halbe Hoehe gemessen');
  // 45 Grad: die schmale Achse begrenzt — 10 / (1/sqrt2) ≈ 14.14.
  assert.ok(Math.abs(r.schraeg - 14.14) < 0.02, 'schraeg: ' + r.schraeg);
});
