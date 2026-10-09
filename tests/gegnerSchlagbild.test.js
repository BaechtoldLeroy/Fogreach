// tests/gegnerSchlagbild.test.js — jeder Gegner zeigt seine Schlagbilder.
//
// Unter assets/enemy liegen fuer JEDEN Typ drei Bilder (right0/1/2), und sie
// unterscheiden sich wirklich: gemessen ueber alle zwanzig Ordner liegt der
// Unterschied von right0 zu right1/right2 zwischen 10 und 66 %.
//
// Geschaltet wurde darauf aber nur bei vier Typen — Kettenwache,
// Schattenschleicher, Imp und Brute, je in einem eigenen, fast gleich-
// lautenden Block. Bogenschuetze, Magier, Flammenweber, die drei Tiere, die
// sechs Sondergegner und die Bosse standen still: drei Zeichnungen im Ordner,
// eine im Spiel.
//
// WICHTIG am Aufbau: der Fall loest einen ECHTEN Schlag aus und ruft NICHT
// _gegnerSchlagZeigen von Hand. Eine erste Fassung tat das — sie blieb gruen,
// als die Anbindung an den Angriff entfernt wurde, und mass damit nur den
// Helfer, nicht die Anbindung.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 8 }); });
after(async () => { if (H) await H.shutdown(); });

/**
 * Setzt einen Gegner direkt neben den Spieler und laesst ihn zuschlagen.
 *
 * @returns {{start:string}|{ohneBilder:true}|{fehler:string}}
 */
function gegnerBereitstellen(typ) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    window._playerInvincible = true;
    sc._enemyAttackGraceUntil = 0;
    var e = spawnEnemy.call(sc, player.x + 30, player.y, ${typ});
    if (!e) return { fehler: 'kein Gegner vom Typ ${typ}' };
    // Nur gerichtete Bilder koennen wechseln; die prozeduralen Notnaegel
    // (proc_*) haben nur eines und sind hier nicht gemeint.
    if (!/_(right|left)[0-9]$/.test(e.texture.key)) return { ohneBilder: true };
    // Dicht an den Spieler und schlagbereit machen — auf einer Seite mit
    // freier Sicht. Fernkaempfer schiessen nur mit Sichtlinie; steht im
    // Zufallsraum ein Hindernis rechts neben dem Spieler, schlugen Bogen-
    // schuetze, Magier und Flammenweber nie zu (gemessen: 1 von 16 Laeufen).
    var seiten = [[24, 0], [-24, 0], [0, 24], [0, -24], [17, 17], [-17, 17], [17, -17], [-17, -17]];
    window.__seite = seiten[0];
    for (var i = 0; i < seiten.length; i++) {
      e.x = player.x + seiten[i][0]; e.y = player.y + seiten[i][1];
      if (Steering.hasLineOfSight(e, player, obstacles)) { window.__seite = seiten[i]; break; }
    }
    e.x = player.x + window.__seite[0]; e.y = player.y + window.__seite[1];
    if (e.body && e.body.reset) e.body.reset(e.x, e.y);
    e.lastAttackTime = 0;
    window.__g = e;
    return { start: e.texture.key };
  })()`);
}

/**
 * Taktet, bis der Gegner von selbst zuschlaegt, und sammelt die Bilder.
 *
 * Gesammelt werden die ENDZIFFERN (0/1/2), nicht die ganzen Namen: so faellt
 * auch auf, wenn zwar gewechselt wird, aber die zweite Schlagpose fehlt.
 */
function ziffernImSchlag() {
  const gesehen = new Set();
  for (let i = 0; i < 160 && gesehen.size < 3; i++) {
    const k = H.run(`(function () {
      var e = window.__g;
      if (!e || !e.active) return null;
      // Immer wieder dicht heranstellen: manche Typen weichen aus.
      e.x = player.x + window.__seite[0]; e.y = player.y + window.__seite[1];
      if (e.body && e.body.reset) e.body.reset(e.x, e.y);
      return e.texture.key;
    })()`);
    if (k) {
      const m = /([0-9])$/.exec(k);
      if (m) gesehen.add(m[1]);
    }
    H.step(4);
  }
  return [...gesehen].sort();
}

// Die Typnummern aus enemy.js.
const TYPEN = [
  [1, 'Imp'], [2, 'Bogenschuetze'], [3, 'Brute'], [4, 'Magier'],
  [5, 'Schattenschleicher'], [6, 'Kettenwache'], [7, 'Flammenweber'],
  [8, 'Ratte'], [9, 'Fledermaus'], [10, 'Wolf'],
  [11, 'Geschwuer'],
  // Der PRIESTER fehlt mit Absicht: er haelt Abstand und heilt, schlaegt also
  // nie zu. Seine Bilder laufen ueber bildFolge in sondergegner.js (1 -> 2 ->
  // 0, an _spriteAktion gehaengt), nicht ueber den Angriffsweg. Gemessen: er
  // war der einzige von sechzehn, der hier auf Phase 0 stehen blieb.
  [13, 'Beschwoerer'], [14, 'Springer'],
  [15, 'Hund'], [16, 'Alarmwicht']
];

test('jeder Gegnertyp zeigt beim ECHTEN Schlag beide Schlagbilder', () => {
  const stumm = [];
  const ohneZweite = [];
  const geprueft = [];
  TYPEN.forEach(([typ, name]) => {
    const r = gegnerBereitstellen(typ);
    if (r.fehler || r.ohneBilder) return;      // kein gerichteter Satz: nicht gemeint
    geprueft.push(name);
    const ziffern = ziffernImSchlag();
    if (!ziffern.includes('1')) stumm.push(name + ' (nur ' + ziffern.join(',') + ')');
    // Das GESCHWUER zeigt nur die erste Pose: es blaeht sich auf (bild(g, 1)
    // in sondergegner.js) und PLATZT dann — es kehrt nie in die Ruhe zurueck
    // und erreicht Phase 2 nicht. Der Bildwechsel wird oben trotzdem
    // verlangt.
    else if (name !== 'Geschwuer' && !ziffern.includes('2')) ohneZweite.push(name);
  });
  assert.ok(geprueft.length >= 10,
    'nur ' + geprueft.length + ' Typen mit gerichteten Bildern geprueft — zu wenig');
  assert.strictEqual(stumm.length, 0,
    stumm.length + ' von ' + geprueft.length + ' Typen schlagen ohne Bildwechsel: ' + stumm.join(', '));
  assert.strictEqual(ohneZweite.length, 0,
    ohneZweite.length + ' Typen zeigen die ZWEITE Schlagpose nicht: ' + ohneZweite.join(', '));
});

test('nach dem Schlag steht wieder die Ruhepose', () => {
  // Der WOLF, nicht der Brute: der Brute hat einen eigenen Rueckweg in seinem
  // alten Block, der Wolf laeuft ueber den neuen gemeinsamen. Mit dem Brute
  // blieb der Fall gruen, als die Ruecksetzung im neuen Weg entfernt wurde.
  const r = gegnerBereitstellen(10);
  assert.ok(!r.fehler && !r.ohneBilder, r.fehler || 'Wolf ohne gerichtete Bilder');
  const ziffern = ziffernImSchlag();
  assert.ok(ziffern.includes('1'), 'der Wolf hat gar nicht zugeschlagen (' + ziffern.join(',') + ')');
  // Bis die Ruecksetzung durch ist takten, nicht Bilder zaehlen.
  let jetzt = null;
  for (let i = 0; i < 200; i++) {
    jetzt = H.run(`(function () {
      var e = window.__g;
      return (e && e.active) ? /([0-9])$/.exec(e.texture.key)[1] : null;
    })()`);
    if (jetzt === '0') break;
    H.step(4);
  }
  assert.strictEqual(jetzt, '0', 'nach dem Schlag bleibt Phase ' + jetzt + ' stehen');
});
