// tests/sondergegner.test.js — Priester und Nebelgeschwuer (#12).
//
// Jeder neue Gegnertyp verlangt eine eigene Antwort (Story-Bibel v5, Abschnitt 12):
//   Priester       heilt Verbuendete, solange er lebt   -> ihn zuerst fallen
//   Nebelgeschwuer zuendet am Spieler, platzt auch tot  -> Abstand halten
//
// Teil 1 prueft die Rechnungen ohne Phaser, Teil 2 das Verhalten im echten
// Dungeon (headless).

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launchDungeon } = require('../tools/headless/index.js');

loadGameModule('js/sondergegner.js');
const SG = globalThis.window.Sondergegner;

// ------------------------------------------------------------ Rechnungen

const g = (o) => Object.assign({ active: true, hp: 5, maxHp: 10, x: 0, y: 0 }, o);

test('heilziele: verwundete Verbuendete in Reichweite, die schwersten zuerst, hoechstens zwei', () => {
  const p = g({ isPriester: true, hp: 3, maxHp: 3 });
  const leicht = g({ hp: 8, x: 100 });
  const schwer = g({ hp: 2, x: 120 });
  const mittel = g({ hp: 5, x: 60 });
  const voll = g({ hp: 10, x: 50 });
  const fern = g({ hp: 1, x: 900 });
  const r = SG.heilziele(p, [p, leicht, schwer, mittel, voll, fern]);
  assert.deepStrictEqual(r, [schwer, mittel]);
});

test('heilziele: nie Priester, Bosse, Minibosse oder Tote', () => {
  const p = g({ isPriester: true });
  const liste = [
    g({ isPriester: true, hp: 1 }), g({ isBoss: true, hp: 1 }),
    g({ isMiniBoss: true, hp: 1 }), g({ hp: 0 }), g({ hp: 1, active: false })
  ];
  assert.deepStrictEqual(SG.heilziele(p, liste), []);
});

test('heilmenge: ein Viertel der maximalen Lebenspunkte, nie ueber das Maximum', () => {
  assert.strictEqual(SG.heilmenge(g({ hp: 1, maxHp: 20 })), 5);
  assert.strictEqual(SG.heilmenge(g({ hp: 18, maxHp: 20 })), 2);
  assert.strictEqual(SG.heilmenge(g({ hp: 1, maxHp: 2 })), 1);
});

test('explosionsSchaden: dreifacher Gegnerschaden, zwischen 4 und 24', () => {
  assert.strictEqual(SG.explosionsSchaden({ baseDamage: 5 }), 15);
  assert.strictEqual(SG.explosionsSchaden({ baseDamage: 1 }), 4);
  assert.strictEqual(SG.explosionsSchaden({ baseDamage: 30 }), 24);
});

test('voll: Obergrenzen je Raum (2 Priester, 3 Geschwuere)', () => {
  const pr = [g({ enemyType: 12 }), g({ enemyType: 12 })];
  assert.strictEqual(SG.voll(12, pr), true);
  assert.strictEqual(SG.voll(12, pr.slice(1)), false);
  assert.strictEqual(SG.voll(12, [g({ enemyType: 12 }), g({ enemyType: 12, hp: 0 })]), false, 'Tote zaehlen nicht');
  assert.strictEqual(SG.voll(11, [g({ enemyType: 11 }), g({ enemyType: 11 })]), false);
  assert.strictEqual(SG.voll(3, [g({ enemyType: 3 }), g({ enemyType: 3 }), g({ enemyType: 3 })]), false);
});

// --------------------------------------------------------- Im Dungeon

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 22 });
  L = H.lab;
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  L.setDepth(22, 22);
  L.clearEnemies();
  L.healPlayer();
  L.makePlayerVulnerable();
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc._enemyAttackGraceUntil = 0;
  })()`);
});

/** Gegner erzeugen und an eine feste Stelle relativ zum Spieler setzen. */
function setze(typ, dx, dy) {
  const ref = L.spawnEnemy(typ);
  H.run(`(function () {
    var e = window.__lab.refs[${ref}];
    if (e.body && e.body.reset) e.body.reset(player.x + ${dx}, player.y + ${dy});
    else e.setPosition(player.x + ${dx}, player.y + ${dy});
  })()`);
  return ref;
}
const zustand = (ref) => H.run(`(function () {
  var e = window.__lab.refs[${ref}];
  return { hp: e.hp, maxHp: e.maxHp, active: !!e.active, typ: e.enemyType };
})()`);
const spielerHp = () => H.run('window.playerHealth');
// Spieler 300 px weg vom Geschehen. Steht er an der linken Wand, geht es nach
// rechts (am Geschwuer vorbei) — sonst schoebe die Weltgrenze ihn zurueck.
const spielerWeg = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var b = sc.physics.world.bounds;
  var dx = (player.x - 300 > b.x + 60) ? -300 : 300;
  if (player.body && player.body.reset) player.body.reset(player.x + dx, player.y);
  else player.x += dx;
})()`);

test('Priester heilt einen verwundeten Verbuendeten', () => {
  const brute = setze(3, 320, 0);
  setze(12, 360, 40);
  H.run(`(function () { var e = window.__lab.refs[${brute}]; e.speed = 0; e.hp = 1; })()`);
  H.step(300);
  const b = zustand(brute);
  assert.ok(b.active, 'Kontrollgegner lebt nicht mehr');
  assert.ok(b.hp > 1, 'nicht geheilt: hp ' + b.hp + '/' + b.maxHp);
});

test('Priester heilt keinen anderen Priester', () => {
  const a = setze(12, 320, 0);
  setze(12, 360, 40);
  H.run(`(function () { window.__lab.refs[${a}].hp = 1; })()`);
  H.step(300);
  assert.strictEqual(zustand(a).hp, 1);
});

test('Nebelgeschwuer zuendet am Spieler und platzt', () => {
  const vorher = spielerHp();
  const ref = setze(11, 40, 0);
  const soll = H.run(`window.Sondergegner.explosionsSchaden(window.__lab.refs[${ref}])`);
  H.step(90);
  assert.strictEqual(zustand(ref).active, false, 'Geschwuer lebt noch');
  assert.ok(vorher - spielerHp() >= soll, 'Explosion hat nicht getroffen: ' + vorher + ' -> ' + spielerHp());
});

test('Wer nach dem Zuenden Abstand nimmt, entkommt', () => {
  const vorher = spielerHp();
  const ref = setze(11, 40, 0);
  H.step(8);                                  // es zuendet
  assert.ok(H.run(`typeof window.__lab.refs[${ref}]._zuendetBis === 'number'`), 'hat nicht gezuendet');
  spielerWeg();
  H.step(90);
  assert.strictEqual(zustand(ref).active, false, 'Geschwuer ist nicht geplatzt');
  // >= statt ===: der Spieler regeneriert in der Zwischenzeit.
  assert.ok(spielerHp() >= vorher, 'Spieler wurde trotz Abstand getroffen: ' + vorher + ' -> ' + spielerHp());
});

function erschlagen(ref) {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var e = window.__lab.refs[${ref}];
    e.hp = 0;
    handleEnemyHit(sc, e, {});
  })()`);
}

test('Erschlagen platzt es trotzdem — im Nahkampf trifft es', () => {
  const vorher = spielerHp();
  const ref = setze(11, 400, 0);
  H.run(`(function () {
    var e = window.__lab.refs[${ref}];
    if (e.body && e.body.reset) e.body.reset(player.x + 40, player.y);
  })()`);
  erschlagen(ref);
  H.step(60);
  assert.ok(spielerHp() < vorher, 'Todesplatzer hat nicht getroffen');
});

test('Erschlagen und wegtreten: der Todesplatzer verfehlt', () => {
  const vorher = spielerHp();
  const ref = setze(11, 40, 0);
  erschlagen(ref);
  spielerWeg();
  H.step(60);
  assert.ok(spielerHp() >= vorher, 'getroffen: ' + vorher + ' -> ' + spielerHp());
});

test('Die Explosion trifft auch andere Gegner', () => {
  const brute = setze(3, 460, 0);
  const ref = setze(11, 420, 0);
  H.run(`(function () { var b = window.__lab.refs[${brute}]; b.speed = 0; b.hp = 100; b.maxHp = 100; })()`);
  erschlagen(ref);
  H.step(60);
  assert.ok(zustand(brute).hp < 100, 'Nachbar blieb unversehrt');
});

test('Minibosse und Gefolge sind nie Priester oder Geschwuer', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var G = window.EnemySpawnGating, alt = G.getAvailableEnemyTypes;
    G.getAvailableEnemyTypes = function () { return [11, 12, 3]; };
    var typen = [];
    try {
      for (var i = 0; i < 20; i++) {
        var e = spawnMiniBoss.call(sc, player.x + 400, player.y);
        if (e) { typen.push(e.enemyType); e.destroy(); }
      }
    } finally { G.getAvailableEnemyTypes = alt; }
    return typen.join(',');
  })()`);
  assert.ok(r.length > 0, 'keine Minibosse erzeugt');
  assert.ok(r.split(',').every((t) => t === '3'), 'Sondertyp als Miniboss: ' + r);
});

test('Obergrenze: nie mehr als zwei Priester gleichzeitig', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var G = window.EnemySpawnGating, alt = G.getAvailableEnemyTypes;
    G.getAvailableEnemyTypes = function () { return [12, 3]; };
    try {
      for (var i = 0; i < 30; i++) window.__labOhneElite(function () { return spawnEnemy.call(sc, 0, 0); });
    } finally { G.getAvailableEnemyTypes = alt; }
    return enemies.getChildren().filter(function (e) { return e && e.active && e.enemyType === 12; }).length;
  })()`);
  assert.ok(r >= 1 && r <= 2, 'Priester im Raum: ' + r);
});
