// tests/bossSignaturen.test.js — Kettenmeister fesselt, Zeremonienmeister loescht aus (#144).
//
// Story-Bibel: Jede Boss-Signatur traegt das Thema ihres Aktes im Spielgefuehl.
//   Kettenmeister — Fesselung: ein Ring zieht sich zusammen; wer drin bleibt,
//     liegt in Ketten, kann weder laufen noch ausweichen und muss die Kette mit
//     drei Schlaegen zerbrechen (nach spaetestens 4 s bricht sie von selbst).
//   Zeremonienmeister — Ausloeschung: Nebel loescht Teile der Arena (nur Sicht),
//     Gefallene kehren als Vergessene zurueck, eine Faehigkeit ist kurz weg.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 10 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`(function () {
    if (typeof window._fesselLoesen === 'function') window._fesselLoesen(null, 'test');
    window._playerInvincible = true;
  })()`);
  L.clearEnemies();
  L.healPlayer();
});

function boss(tiefe) {
  L.setDepth(tiefe, tiefe);
  const b = L.spawnBoss();
  assert.ok(!b.error, b.error);
  // Der Boss soll nicht von sich aus angreifen — geprueft wird die Signatur.
  H.run(`(function () {
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.nextPatternAt = 1e12; b.speed = 0; b.damage = 0;
  })()`);
  return b;
}
const sig = (name) => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
  BOSS_ATTACK_MAP['${name}'].call(sc, b);
  b.nextPatternAt = 1e12;
})()`);

test('Die Signaturen sind zugeordnet', () => {
  const r = H.run(`({ k: BOSS_SIGNATURE.chainMaster, z: BOSS_SIGNATURE.ceremonyMaster,
    f: typeof BOSS_ATTACK_MAP.fesselung, a: typeof BOSS_ATTACK_MAP.ausloeschung,
    rat: BOSS_DEFINITIONS.shadowCouncillor.attacks.slice() })`);
  assert.strictEqual(r.k, 'fesselung');
  assert.strictEqual(r.z, 'ausloeschung');
  assert.strictEqual(r.f, 'function');
  assert.strictEqual(r.a, 'function');
  assert.ok(r.rat.includes('fesselung') && r.rat.includes('ausloeschung'), 'der Schattenrat vereint nicht beide');
});

// --- Fesselung ---------------------------------------------------------------

test('Wer im Ring bleibt, liegt in Ketten: keine Bewegung, kein Rollen', () => {
  boss(10);
  sig('fesselung');
  H.step(60);                               // Telegraph 800 ms
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var gefesselt = !!window.__fessel;
    var x0 = player.x;
    player.body.setVelocity(300, 0);
    return { gefesselt: gefesselt, rollen: performRoll.call(sc), x0: x0 };
  })()`);
  assert.strictEqual(r.gefesselt, true, 'nicht gefesselt');
  assert.strictEqual(r.rollen, false, 'man rollt aus der Fessel');
  // Der eine Frame mit der hier gesetzten Geschwindigkeit zaehlt nicht —
  // danach haelt die Sperre in handlePlayerMovement jeden Frame fest.
  H.step(1);
  const x1 = H.run('player.x');
  // Echte Eingabe: der Spieler drueckt nach rechts.
  H.run(`(function () {
    window.__echteEingabe = window.InputScheme.getMovementInput;
    window.InputScheme.getMovementInput = function () { return { x: 1, y: 0 }; };
  })()`);
  try { H.step(20); } finally {
    H.run('window.InputScheme.getMovementInput = window.__echteEingabe');
  }
  const dx = H.run(`Math.abs(player.x - ${x1})`);
  assert.ok(dx < 2, 'der Gefesselte laeuft ' + dx + ' px');
});

test('Drei Schlaege zerbrechen die Kette', () => {
  boss(10);
  sig('fesselung');
  H.step(60);
  assert.strictEqual(H.run('!!window.__fessel'), true);
  for (let i = 0; i < 3; i++) {
    H.run(`attack.call(window.game.scene.getScene('GameScene'))`);
    if (i < 2) assert.strictEqual(H.run('!!window.__fessel'), true, 'die Kette bricht schon nach ' + (i + 1) + ' Schlaegen');
    H.step(60);
  }
  assert.strictEqual(H.run('!!window.__fessel'), false, 'nach drei Schlaegen noch gefesselt');
});

test('Wer rechtzeitig aus dem Ring kommt, entkommt', () => {
  boss(10);
  sig('fesselung');
  H.step(20);
  H.run('player.setPosition(player.x + 160, player.y)');
  H.step(50);
  assert.strictEqual(H.run('!!window.__fessel'), false, 'gefesselt, obwohl draussen');
});

test('Nach spaetestens vier Sekunden bricht die Kette von selbst', () => {
  boss(10);
  sig('fesselung');
  H.step(60);
  assert.strictEqual(H.run('!!window.__fessel'), true);
  H.step(260);
  assert.strictEqual(H.run('!!window.__fessel'), false, 'der Spieler haengt fest');
});

test('Ein Raumwechsel loest die Fessel', () => {
  boss(10);
  sig('fesselung');
  H.step(60);
  H.run(`enterRoom(window.game.scene.getScene('GameScene'), 1)`);
  assert.strictEqual(H.run('!!window.__fessel'), false);
});

// --- Ausloeschung ------------------------------------------------------------

test('Gefallene kehren als Vergessene zurueck, dieselben Typen', () => {
  H.run(`enterRoom(window.game.scene.getScene('GameScene'), 1)`);
  L.clearEnemies();
  // Zwei Nebelbestien fallen, bevor der Zeremonienmeister kommt.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    for (var i = 0; i < 2; i++) {
      var e = spawnEnemy.call(sc, player.x + 120 + i * 40, player.y, 3);
      e.hp = 0; handleEnemyHit(sc, e, {});
    }
  })()`);
  boss(20);
  const vorher = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e._vergessen; }).length`);
  sig('ausloeschung');
  H.step(50);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var v = enemies.getChildren().filter(function (e) { return e && e.active && e._vergessen; });
    return { n: v.length, typen: v.map(function (e) { return e.enemyType; }),
             nebel: sc.children.list.filter(function (o) { return o._ausloeschung && o.active; }).length };
  })()`);
  assert.strictEqual(vorher, 0);
  assert.strictEqual(r.n, 2, r.n + ' Vergessene statt 2');
  assert.ok(r.typen.every((t) => t === 3), 'andere Typen kehrten zurueck: ' + r.typen);
  assert.strictEqual(r.nebel, 3, 'kein Nebel ueber der Arena');
});

test('Ohne Gefallene kommen Schatten', () => {
  H.run(`enterRoom(window.game.scene.getScene('GameScene'), 1)`);
  L.clearEnemies();
  boss(20);
  sig('ausloeschung');
  H.step(50);
  const typen = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e._vergessen; }).map(function (e) { return e.enemyType; })`);
  assert.ok(typen.length >= 1 && Array.from(typen).every((t) => t === 5), 'Typen: ' + typen);
});

test('Eine Faehigkeit ist kurz weg — nicht alle (das bleibt Elara)', () => {
  boss(20);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var AS = window.AbilitySystem;
    var ids = AS.getAllAbilityDefs().map(function (d) { return d.id; }).slice(0, 2);
    ids.forEach(function (id, i) { AS.learnAbility(id, { silent: true }); AS.setSlot('slot' + (i + 1), id); AS.resetCooldown(id); });
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    BOSS_ATTACK_MAP.ausloeschung.call(sc, b);
    var jetzt = window.gameNow(sc);
    return ids.map(function (id) { return AS.getCooldownRemaining(id, jetzt) > 0; });
  })()`);
  assert.strictEqual(Array.from(r).filter(Boolean).length, 1, 'gesperrt: ' + JSON.stringify(r));
});
