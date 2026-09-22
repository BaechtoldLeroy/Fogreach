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

// Der Raum spawnt waehrend der Tests Gegner nach; ein fremder Schlag darf
// nicht als Explosion zaehlen. Deshalb jeden Treffer mit Verursacher
// mitschreiben: Explosionen kommen ohne Angreifer (applyPlayerDamage(d, sc)).
function trefferMitschreiben() {
  H.run(`(function () {
    if (!window.__apdOrig) {
      window.__apdOrig = applyPlayerDamage;
      window.applyPlayerDamage = function (d, sc, a) {
        (window.__treffer = window.__treffer || []).push({ d: d, typ: a ? a.enemyType : null });
        return window.__apdOrig.apply(this, arguments);
      };
    }
    window.__treffer = [];
  })()`);
}
const treffer = (typ) => H.run(`(window.__treffer || []).filter(function (t) { return t.typ === ${typ === undefined ? 'null' : typ}; }).length`);
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
  // Genug Lebenspunkte, dass ein nachgespawnter Gegner ihn nicht umhaut.
  H.run(`(function () { var e = window.__lab.refs[${brute}]; e.speed = 0; e.maxHp = 100; e.hp = 20; })()`);
  H.step(300);
  const b = zustand(brute);
  assert.ok(b.active, 'Kontrollgegner lebt nicht mehr');
  assert.ok(b.hp > 20, 'nicht geheilt: hp ' + b.hp + '/' + b.maxHp);
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
  trefferMitschreiben();
  H.step(90);
  assert.strictEqual(zustand(ref).active, false, 'Geschwuer ist nicht geplatzt');
  assert.strictEqual(treffer(), 0, 'Spieler wurde trotz Abstand von der Explosion getroffen');
  void vorher;
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
  trefferMitschreiben();
  H.step(60);
  assert.strictEqual(treffer(), 0, 'der Todesplatzer hat getroffen');
  void vorher;
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

// ------------------------------------------------ Beschwoerer, Nebelspringer

test('rufAnzahl: zwei je Ruf, hoechstens vier lebend und acht im ganzen Leben', () => {
  assert.strictEqual(SG.rufAnzahl(0, 0), 2);
  assert.strictEqual(SG.rufAnzahl(3, 3), 1);
  assert.strictEqual(SG.rufAnzahl(4, 4), 0);
  assert.strictEqual(SG.rufAnzahl(0, 7), 1);
  assert.strictEqual(SG.rufAnzahl(0, 8), 0);
});

test('sprungZiel: hinter den Spieler, nur im Abstandsfenster', () => {
  const p = { x: 500, y: 300 };
  assert.deepStrictEqual(SG.sprungZiel({ x: 750, y: 300 }, p), { x: 445, y: 300 });
  assert.deepStrictEqual(SG.sprungZiel({ x: 500, y: 100 }, p), { x: 500, y: 355 });
  assert.strictEqual(SG.sprungZiel({ x: 560, y: 300 }, p), null, 'zu nah: er schlaegt, statt zu springen');
  assert.strictEqual(SG.sprungZiel({ x: 1000, y: 300 }, p), null, 'zu weit');
  assert.deepStrictEqual(SG.sprungZiel({ x: 750, y: 300 }, p, 30), { x: 470, y: 300 }, 'eigener Abstand');
});

const gerufene = (ref) => H.run(`(function () {
  var b = window.__lab.refs[${ref}];
  return enemies.getChildren().filter(function (e) {
    return e && e.active && e._beschworenVon === b;
  }).map(function (e) {
    return { d: Math.round(Math.hypot(e.x - b.x, e.y - b.y)), typ: e.enemyType, elite: !!(e.isElite || e._eliteApplied) };
  });
})()`);
const rufJetzt = (ref) => H.run(`(function () { var b = window.__lab.refs[${ref}]; b._naechsterRuf = 0; b.speed = 0; })()`);

test('Beschwoerer steht still, ruft, und nach einer Sekunde stehen zwei Wichte bei ihm', () => {
  const b = setze(13, 330, 0);
  rufJetzt(b);
  H.step(10);
  assert.ok(H.run(`window.__lab.refs[${b}]._castingUntil > 0`), 'hat nicht zu rufen begonnen');
  assert.strictEqual(gerufene(b).length, 0, 'Wichte kamen ohne Vorwarnung');
  H.step(80);
  const w = gerufene(b);
  assert.strictEqual(w.length, 2, 'gerufen: ' + JSON.stringify(w));
  assert.ok(w.every((x) => x.typ === 1 && x.d < 90), 'nicht bei ihm: ' + JSON.stringify(w));
});

test('Erschlagen waehrend des Rufens: es kommt niemand', () => {
  const b = setze(13, 330, 0);
  rufJetzt(b);
  H.step(10);
  erschlagen(b);
  H.step(80);
  const n = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e.enemyType === 1; }).length`);
  assert.strictEqual(n, 0);
});

test('Faellt der Beschwoerer, loesen sich seine Wichte auf', () => {
  const b = setze(13, 330, 0);
  rufJetzt(b);
  H.step(90);
  assert.strictEqual(gerufene(b).length, 2);
  erschlagen(b);
  H.step(5);
  const n = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e.enemyType === 1; }).length`);
  assert.strictEqual(n, 0, 'Wichte leben weiter');
});

test('Beschwoerer: der Lebensdeckel gilt (acht insgesamt)', () => {
  const b = setze(13, 330, 0);
  H.run(`window.__lab.refs[${b}]._rufGesamt = 7`);
  rufJetzt(b);
  H.step(90);
  assert.strictEqual(gerufene(b).length, 1);
});

test('Gerufene Wichte sind nie Elite', () => {
  const b = setze(13, 330, 0);
  const r = H.run(`(function () {
    var EE = window.EliteEnemies, alt = EE.shouldSpawnElite;
    EE.shouldSpawnElite = function () { return 'champion'; };
    window.__eliteStub = alt;
    return true;
  })()`);
  assert.ok(r);
  try {
    rufJetzt(b);
    H.step(90);
    const w = gerufene(b);
    assert.strictEqual(w.length, 2);
    assert.ok(w.every((x) => !x.elite), 'Elite-Wicht: ' + JSON.stringify(w));
    // Gegenprobe: ein gewoehnlich gespawnter Wicht wird mit dem Stub Elite.
    const k = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var e = spawnEnemy.call(sc, 0, 0, 1);
      var elite = !!(e.isElite || e._eliteApplied);
      e.destroy();
      return elite;
    })()`);
    assert.ok(k, 'Gegenprobe: der Stub wirkt nicht');
  } finally {
    H.run(`window.EliteEnemies.shouldSpawnElite = window.__eliteStub`);
  }
});


// Der Raum ist zufaellig: liegt der Punkt hinter dem Spieler in einer Wand,
// springt der Nebelspringer (richtig) nicht. Also eine Richtung waehlen, in
// der seine Startstelle UND das Sprungziel frei sind.
function springerSetzen() {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var frei = function (x, y) {
      if (sc.isPointAccessible && !sc.isPointAccessible(x, y)) return false;
      if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(x, y)) return false;
      return true;
    };
    var richt = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    var suchen = function () {
      for (var i = 0; i < richt.length; i++) {
        var dx = richt[i][0], dy = richt[i][1];
        if (frei(player.x + dx * 250, player.y + dy * 250) && frei(player.x - dx * 55, player.y - dy * 55)) {
          return [Math.round(dx * 250), Math.round(dy * 250)];
        }
      }
      return null;
    };
    var r = suchen();
    // Eingeklemmt (Ecke, Saeulen)? Dann an eine andere freie Stelle im Raum.
    for (var v = 0; !r && v < 40 && typeof sc.pickAccessibleSpawnPoint === 'function'; v++) {
      var p = sc.pickAccessibleSpawnPoint({ minDistance: 0, maxAttempts: 10 });
      if (!p) continue;
      if (player.body && player.body.reset) player.body.reset(p.x, p.y); else player.setPosition(p.x, p.y);
      r = suchen();
    }
    return r;
  })()`);
  assert.ok(r, 'kein freier Platz um den Spieler');
  const ref = setze(14, r[0], r[1]);
  H.run(`(function () { window.__lab.refs[${ref}]._naechsterSprung = 0; })()`);
  return ref;
}

test('Nebelspringer kuendigt an und landet hinter dem Spieler', () => {
  const s = springerSetzen();
  H.step(3);
  const an = H.run(`(function () {
    var s = window.__lab.refs[${s}];
    return { bis: typeof s._sprungBis, wirbel: !!(s._wirbel && s._wirbel.active),
      ziel: s._sprungZiel, x: s.x, sy: s.y, px: player.x, py: player.y };
  })()`);
  assert.strictEqual(an.bis, 'number', 'keine Ankuendigung');
  assert.ok(an.wirbel, 'kein Wirbel am Ziel');
  // Hinter dem Spieler: das Ziel liegt vom Springer aus jenseits des Spielers.
  const vorSp = Math.hypot(an.x - an.px, an.sy - an.py), zumZiel = Math.hypot(an.x - an.ziel.x, an.sy - an.ziel.y);
  assert.ok(zumZiel > vorSp + 15, 'Ziel liegt nicht hinter dem Spieler: ' + JSON.stringify(an));
  H.step(36);
  const nach = H.run(`(function () {
    var s = window.__lab.refs[${s}];
    return { x: s.x, y: s.y, bis: s._sprungBis, wirbel: !!(s._wirbel) };
  })()`);
  assert.strictEqual(nach.bis, null, 'noch nicht gesprungen');
  assert.ok(Math.hypot(nach.x - an.ziel.x, nach.y - an.ziel.y) < 30,
    'nicht am Ziel gelandet: ' + JSON.stringify({ nach, ziel: an.ziel }));
  assert.strictEqual(nach.wirbel, false, 'Wirbel blieb liegen');
});

test('Nebelspringer: nach der Landung ein kurzes Reaktionsfenster, dann der Schlag', () => {
  const s = springerSetzen();
  H.step(3);
  const bis = H.run(`window.__lab.refs[${s}]._sprungBis`);
  // Bis zur Landung pumpen (Takt ~16,7 ms), dann 200 ms: noch kein Schlag.
  // Schon VOR der Landung mitschreiben: ohne Reaktionsfenster faellt der
  // Schlag im Landebild selbst.
  trefferMitschreiben();
  let n = 0;
  while (H.run(`typeof window.__lab.refs[${s}]._sprungBis === 'number'`) && n++ < 60) H.step(1);
  assert.ok(n < 60, 'nicht gelandet (bis ' + bis + ')');
  H.step(12);
  assert.strictEqual(treffer(14), 0, 'Schlag ohne Reaktionsfenster');
  H.step(80);
  const lage = H.run(`(function () { var e = window.__lab.refs[${s}]; return JSON.stringify({ d: Math.round(Math.hypot(e.x - player.x, e.y - player.y)), aktiv: e.active, v: [Math.round(e.body.velocity.x), Math.round(e.body.velocity.y)], stun: !!(window.statusEffectManager && window.statusEffectManager.isStunned(e)), la: e.lastAttackTime, t: Math.round(window.game.scene.getScene('GameScene').time.now), p: player.active, grace: window.game.scene.getScene('GameScene')._enemyAttackGraceUntil, alle: window.__treffer }); })()`);
  assert.ok(treffer(14) >= 1, 'kein Schlag des Springers nach der Landung ' + lage);
});

test('Stirbt der Springer waehrend der Ankuendigung, verschwindet der Wirbel', () => {
  const s = springerSetzen();
  H.step(3);
  const w = H.run(`(function () { window.__w = window.__lab.refs[${s}]._wirbel; return !!window.__w; })()`);
  assert.ok(w, 'kein Wirbel');
  erschlagen(s);
  H.step(2);
  assert.strictEqual(H.run('!!(window.__w && window.__w.active)'), false);
});

// ------------------------------------------------ Kettenhund, Alarmwicht

test('satzZiel: ueber die Stelle hinaus, nur im Fenster; satzSchaden: anderthalbfach', () => {
  const p = { x: 500, y: 300 };
  assert.deepStrictEqual(SG.satzZiel({ x: 640, y: 300 }, p), { x: 480, y: 300 });
  assert.strictEqual(SG.satzZiel({ x: 540, y: 300 }, p), null, 'zu nah: er beisst normal');
  assert.strictEqual(SG.satzZiel({ x: 700, y: 300 }, p), null, 'zu weit: er rennt erst heran');
  assert.strictEqual(SG.satzSchaden({ damage: 6 }), 9);
  assert.strictEqual(SG.satzSchaden({ damage: 1 }), 2);
});

/**
 * Richtung suchen, in der der Gegner bei +vor und der Raum HINTER dem Spieler
 * bis -hinter frei ist; notfalls die Figur an eine freie Stelle versetzen.
 * @returns {[number, number]} Einheitsrichtung vom Spieler zum Gegner
 */
function freieRichtung(vor, hinter) {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var frei = function (x, y) {
      if (sc.isPointAccessible && !sc.isPointAccessible(x, y)) return false;
      if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(x, y)) return false;
      return true;
    };
    var richt = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    var suchen = function () {
      for (var i = 0; i < richt.length; i++) {
        var dx = richt[i][0], dy = richt[i][1], ok = true;
        for (var s = 20; s <= ${vor}; s += 20) ok = ok && frei(player.x + dx * s, player.y + dy * s);
        for (var t = 20; t <= ${hinter}; t += 20) ok = ok && frei(player.x - dx * t, player.y - dy * t);
        // Sichtlinie eigens pruefen: sie rechnet mit allen Hindernis-Rechtecken
        // (auch Deko), die Begehbarkeit nicht.
        var ort = { x: player.x + dx * ${vor}, y: player.y + dy * ${vor} };
        if (ok && window.Steering && !window.Steering.hasLineOfSight(ort, player, obstacles)) ok = false;
        if (ok) return [dx, dy];
      }
      return null;
    };
    var r = suchen();
    for (var v = 0; !r && v < 60 && typeof sc.pickAccessibleSpawnPoint === 'function'; v++) {
      var p = sc.pickAccessibleSpawnPoint({ minDistance: 0, maxAttempts: 10 });
      if (!p) continue;
      if (player.body && player.body.reset) player.body.reset(p.x, p.y); else player.setPosition(p.x, p.y);
      r = suchen();
    }
    return r;
  })()`);
  assert.ok(r, 'kein freier Platz um den Spieler');
  return r;
}
const hundBereit = (abstand, hinter) => {
  const d = freieRichtung(abstand, hinter || 40);
  const ref = setze(15, Math.round(d[0] * abstand), Math.round(d[1] * abstand));
  H.run(`(function () { var h = window.__lab.refs[${ref}]; h._naechsterSatz = 0; })()`);
  return { ref, d };
};

test('Kettenhund duckt sich, setzt auf die Stelle und beisst, wer stehen bleibt', () => {
  const { ref } = hundBereit(130);
  H.step(3);
  const an = H.run(`(function () { var h = window.__lab.refs[${ref}];
    return { duck: typeof h._duckBis, linie: !!(h._satzLinie && h._satzLinie.active) }; })()`);
  assert.strictEqual(an.duck, 'number', 'duckt sich nicht');
  assert.ok(an.linie, 'keine Warnlinie');
  trefferMitschreiben();
  H.step(70);
  assert.ok(treffer(15) >= 1, 'kein Biss beim Satz');
  assert.strictEqual(H.run(`!!(window.__lab.refs[${ref}]._satzLinie)`), false, 'Warnlinie blieb liegen');
});

test('Wer nach dem Ducken ausweicht, entgeht dem Satz, und der Hund steht danach still', () => {
  const { ref, d } = hundBereit(130, 160);
  H.step(3);
  assert.strictEqual(H.run(`typeof window.__lab.refs[${ref}]._duckBis`), 'number', 'duckt sich nicht');
  // Zurueckweichen, weg vom Landepunkt (die Strecke ist frei geprueft).
  H.run(`(function () {
    var nx = player.x - ${d[0]} * 140, ny = player.y - ${d[1]} * 140;
    if (player.body && player.body.reset) player.body.reset(nx, ny); else player.setPosition(nx, ny);
  })()`);
  trefferMitschreiben();
  let n = 0;
  while (!H.run(`window.__lab.refs[${ref}]._castingUntil > 0`) && n++ < 80) H.step(1);
  assert.ok(n < 80, 'der Satz endete nicht');
  assert.strictEqual(treffer(15), 0, 'trotz Ausweichen gebissen');
  const r = H.run(`(function () { var h = window.__lab.refs[${ref}], sc = window.game.scene.getScene('GameScene');
    return { rest: h._castingUntil - sc.time.now }; })()`);
  assert.ok(r.rest > 400, 'keine Erholungspause nach dem Satz: ' + r.rest);
});

const alarmBereit = (abstand) => {
  const d = freieRichtung(abstand + 200, 40);
  const ref = setze(16, Math.round(d[0] * abstand), Math.round(d[1] * abstand));
  return ref;
};
const alarm = (ref) => H.run(`(function () { var a = window.__lab.refs[${ref}];
  return { zustand: a._alarm || null, aktiv: !!a.active,
    d: Math.round(Math.hypot(a.x - player.x, a.y - player.y)),
    verst: (a._gerufeneVerstaerkung || []).filter(function (e) { return e && e.active; }).length }; })()`);

test('Alarmwicht flieht, sobald er den Spieler sieht', () => {
  const ref = alarmBereit(150);
  const vorher = alarm(ref).d;
  H.step(40);
  const a = alarm(ref);
  const diag = H.run(`(function () { var e = window.__lab.refs[${ref}]; return JSON.stringify({ d: Math.round(Math.hypot(e.x - player.x, e.y - player.y)), los: window.Steering.hasLineOfSight(e, player, obstacles), stun: !!(window.statusEffectManager && window.statusEffectManager.isStunned(e)), cast: e._castingUntil, isAlarm: e.isAlarm, grace: window.game.scene.getScene('GameScene')._enemyAttackGraceUntil, t: Math.round(window.game.scene.getScene('GameScene').time.now) }); })()`);
  assert.strictEqual(a.zustand, 'flieht', diag);
  assert.ok(a.d > vorher + 20, 'flieht nicht: ' + vorher + ' -> ' + a.d);
});

test('Nach drei Sekunden Flucht ruft er, und dann kommt Verstaerkung', () => {
  const ref = alarmBereit(150);
  H.step(5);
  assert.strictEqual(alarm(ref).zustand, 'flieht');
  H.run(`(function () { var a = window.__lab.refs[${ref}]; a._fluchtSeit -= 3000; })()`);
  H.step(5);
  const r = alarm(ref);
  assert.strictEqual(r.zustand, 'ruft');
  assert.strictEqual(r.verst, 0, 'Verstaerkung ohne Vorwarnung');
  H.step(80);
  const n = alarm(ref);
  assert.strictEqual(n.zustand, 'gerufen');
  assert.strictEqual(n.verst, 2, 'Verstaerkung: ' + n.verst);
});

test('Erschlagen waehrend des Rufens: keine Verstaerkung', () => {
  const ref = alarmBereit(150);
  H.step(5);
  H.run(`(function () { var a = window.__lab.refs[${ref}]; a._fluchtSeit -= 3000; })()`);
  H.step(5);
  assert.strictEqual(alarm(ref).zustand, 'ruft');
  const vorher = H.run(`enemies.getChildren().filter(function (e) { return e && e.active; }).length`);
  erschlagen(ref);
  H.step(80);
  const nachher = H.run(`enemies.getChildren().filter(function (e) { return e && e.active && e._verstaerkungVon; }).length`);
  assert.strictEqual(nachher, 0, 'Verstaerkung trotz Tod (vorher ' + vorher + ' Gegner)');
});
