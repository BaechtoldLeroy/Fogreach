// tests/gegnerLauf.test.js — Laufbilder der Gegner hinter ?gegnerlauf=1 (#170).
//
// Gegner glitten mit der Ruhepose ueber den Boden. Mit der Flagge spielen die
// Typen aus GEGNER_LAUFBILDER beim Laufen ihre walk_-Bilder, im Stand die
// Ruhepose; Schlagposen haben Vorrang. Der Gegenfall OHNE Flagge steht in
// tests/gegnerLaufOhne.test.js (eigener Start, die Flagge wird beim Laden
// gelesen).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?dungeon=8&gegnerlauf=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) throw new Error('GameScene wurde nicht erreicht');
  H.run('window._playerInvincible = true');
  await H.settle(() => false, { maxRounds: 10 });
});
after(async () => { if (H) await H.shutdown(); });

// Typnummern aus enemy.js -> Bildname.
const TYPEN = [[1, 'imp'], [2, 'archer'], [3, 'brute'], [4, 'mage'], [5, 'shadow'], [6, 'chainguard'],
  [7, 'flameweaver'], [8, 'rat'], [9, 'bat'], [10, 'wolf'], [11, 'geschwuer'], [12, 'priester'],
  [13, 'beschwoerer'], [14, 'springer'], [15, 'hund'], [16, 'alarm']];

/** Gegner in `abstand` Pixeln Entfernung mit freier Sicht zum Spieler aufstellen. */
function aufstellen(typ, abstand) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    sc._enemyAttackGraceUntil = 0;
    var e = spawnEnemy.call(sc, player.x, player.y, ${typ});
    if (!e) return { fehler: 'kein Gegner' };
    var r = ${abstand};
    var seiten = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    var gut = null;
    for (var i = 0; i < seiten.length && !gut; i++) {
      e.x = player.x + seiten[i][0] * r; e.y = player.y + seiten[i][1] * r;
      var frei = !sc.isPointAccessible || sc.isPointAccessible(e.x, e.y);
      if (frei && Steering.hasLineOfSight(e, player, obstacles)) gut = seiten[i];
    }
    if (!gut) gut = seiten[0];
    e.x = player.x + gut[0] * r; e.y = player.y + gut[1] * r;
    if (e.body && e.body.reset) e.body.reset(e.x, e.y);
    window.__g = e;
    window.__seite = gut;
    return { key: e.texture.key };
  })()`);
}

function bild() {
  return H.run('(window.__g && window.__g.active) ? window.__g.texture.key : null');
}

/** Breite und Hoehe aus dem PNG-Kopf (synchron; await liesse die Spieluhr laufen). */
function groesse(datei) {
  const b = fs.readFileSync(datei);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('Laufbilder liegen deckungsgleich neben der Ruhepose', () => {
  const lauf = H.run('window.GEGNER_LAUFBILDER');
  assert.ok(lauf && Object.keys(lauf).length >= 16, 'GEGNER_LAUFBILDER fehlt oder ist zu kurz');
  for (const [typ, n] of Object.entries(lauf)) {
    const ordner = path.join(__dirname, '..', 'assets', 'enemy', typ);
    const ruhe = groesse(path.join(ordner, 'right0.png'));
    for (let i = 0; i < n; i++) {
      for (const d of ['right', 'left']) {
        const datei = path.join(ordner, 'walk_' + d + i + '.png');
        assert.ok(fs.existsSync(datei), datei + ' fehlt');
        const m = groesse(datei);
        // Gleiche Groesse heisst gleicher Ursprung und gleicher Body im Spiel.
        assert.deepStrictEqual(m, ruhe, typ + ' walk_' + d + i + ' ist ' + m.join('x') + ', right0 ' + ruhe.join('x'));
      }
    }
    // Kein Satz darf ueber seine Zahl hinaus Reste haben.
    assert.ok(!fs.existsSync(path.join(ordner, 'walk_right' + n + '.png')), typ + ': mehr Laufbilder als eingetragen');
  }
});

test('mit Flagge: laufende Gegner spielen mehrere Laufbilder', () => {
  const stumm = [];
  TYPEN.forEach(([typ, name]) => {
    // Beschwoerer und Priester halten 260-300 px Abstand: von weiter weg
    // kommen sie heran, statt auf der Stelle zu kreisen.
    const r = aufstellen(typ, (name === 'beschwoerer' || name === 'priester') ? 450 : 220);
    if (r.fehler) { stumm.push(name + ' (' + r.fehler + ')'); return; }
    // Der Alarmwicht flieht beim ersten Blick mit eigener Pose (die hat
    // Vorrang); laufen sieht man ihn erst, nachdem er gerufen hat.
    if (name === 'alarm') H.run("window.__g._alarm = 'gerufen'");
    const phasen = new Set();
    for (let i = 0; i < 240 && phasen.size < 3; i++) {
      const k = bild();
      const m = k && new RegExp('^' + name + '_walk_(right|left)([0-9])$').exec(k);
      if (m) phasen.add(m[2]);
      H.step(1);
    }
    if (phasen.size < 3) stumm.push(name + ' (Phasen ' + [...phasen].join(',') + ')');
  });
  assert.strictEqual(stumm.length, 0, 'ohne Gang: ' + stumm.join(', '));
});

test('mit Flagge: wer stehen bleibt, zeigt wieder die Ruhepose', () => {
  const r = aufstellen(3, 220);       // Brute
  assert.ok(!r.fehler, r.fehler);
  let lief = false;
  for (let i = 0; i < 120 && !lief; i++) { lief = /_walk_/.test(bild()); H.step(1); }
  assert.ok(lief, 'der Brute ist gar nicht erst losgelaufen');
  // Ein Signaturangriff haelt ihn fest (Telegraph): der Lauf-Takt wird dann
  // gar nicht mehr erreicht — genau der Fall, in dem er sonst auf einem
  // Laufbild einfroere.
  H.run('window.__g._castingUntil = window.game.scene.getScene("GameScene").time.now + 60000');
  let k = null;
  for (let i = 0; i < 120; i++) { H.step(1); k = bild(); if (/^brute_(right|left)0$/.test(k)) break; }
  assert.match(k, /^brute_(right|left)0$/, 'im Stand bleibt ' + k + ' stehen');
});

test('mit Flagge: die Fluchtpose des Alarmwichts bleibt stehen', () => {
  // Er laeuft erst (gerufen), dann flieht er: alarmTick setzt Pose 1 ueber
  // bildHalten, das sie NUR EINMAL setzt. Die Ruecksetzung am Schleifen-
  // anfang darf sie danach nicht durch die Ruhepose ersetzen.
  const r = aufstellen(16, 220);
  assert.ok(!r.fehler, r.fehler);
  H.run("window.__g._alarm = 'gerufen'");
  let lief = false;
  for (let i = 0; i < 160 && !lief; i++) { lief = /_walk_/.test(bild()); H.step(1); }
  assert.ok(lief, 'der Alarmwicht ist nicht gelaufen');
  H.run(`(function () {
    var e = window.__g, sc = window.game.scene.getScene('GameScene');
    e._alarm = 'flieht'; e._fluchtSeit = sc.time.now;
  })()`);
  H.step(30);   // ~500 ms, deutlich ueber dem Nachlauf von 150 ms
  assert.match(bild(), /^alarm_(right|left)1$/, 'auf der Flucht zeigt er ' + bild());
});

test('mit Flagge: die Schlagpose hat Vorrang vor dem Gang', () => {
  // Der Imp schlaegt ueber seinen eigenen Block (impAttacking). Er wird
  // waehrend des Schlags von Hand verschoben, als wuerde er gestossen:
  // er BEWEGT sich, der Takt darf die Schlagpose trotzdem nicht ersetzen.
  const r = aufstellen(1, 24);
  assert.ok(!r.fehler, r.fehler);
  H.run('window.__g.lastAttackTime = 0');
  let imSchlag = 0;
  const verdraengt = [];
  for (let i = 0; i < 200 && imSchlag < 12; i++) {
    const z = H.run(`(function () {
      var e = window.__g;
      if (!e || !e.active) return null;
      var s = window.__seite, d = 24 + (e.__schub = ((e.__schub || 0) + 3) % 9);
      e.x = player.x + s[0] * d; e.y = player.y + s[1] * d;
      if (e.body && e.body.reset) e.body.reset(e.x, e.y);
      return { an: !!e.impAttacking, key: e.texture.key };
    })()`);
    H.step(1);
    const nach = H.run('(function(){var e=window.__g;return e&&e.active?{an:!!e.impAttacking,key:e.texture.key}:null})()');
    if (z && z.an && nach && nach.an) {
      imSchlag++;
      if (/_walk_/.test(nach.key)) verdraengt.push(nach.key);
    }
  }
  assert.ok(imSchlag > 0, 'der Imp hat nicht zugeschlagen');
  assert.strictEqual(verdraengt.length, 0, 'Laufbild mitten im Schlag: ' + verdraengt.join(', '));
});
