// tests/bossBeute.test.js — Bossbeute liegt ueber dem Tiefenniveau (#111).
//
// Ein Boss erscheint nur alle zehn Tiefen (roomManager: depth % 10 === 0) und
// ist der Hoehepunkt eines Laufs. Vorher fiel dort dieselbe Ware wie aus einer
// Truhe im dritten Raum: gemessen ueber 500 Abwuerfe auf Tiefe 10 waren
// 54 % gewoehnlich, das mittlere iLevel lag bei genau 10.
//
// Jetzt zwei Aufschlaege, beide klein gehalten:
//   * drei Tiefen hoeher gewuerfelt (ueber das iLEVEL, damit Grundwerte UND
//     Affixe mitwachsen — nicht nur die Farbe)
//   * mindestens magisch (Stufe 1, blau)
//
// Gemessen nach der Aenderung: 0 % gewoehnlich, 92 % magisch, 6 % selten,
// 2 % legendaer, mittleres iLevel 13.
//
// Der Test laeuft gegen die ECHTE Szene: randomLoot haengt an currentWave und
// an LootSystem, beides gibt es ohne Spiel nicht.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=10', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Faengt ab, was randomLoot fuer diese Quelle liefert.
 * Ueber randomLoot statt ueber die Beute-Sprites: so haengt die Messung nicht
 * daran, wie spawnLoot seine Anzeigeobjekte ablegt.
 */
function serie(quelle, n) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.currentWave = 10; window.DUNGEON_DEPTH = 10;
    var AUS = { weapon: 1, head: 1, body: 1, boots: 1 };
    var orig = window.randomLoot;
    var stufen = [0, 0, 0, 0], iLs = [], arten = {};
    window.randomLoot = function () {
      var it = orig.apply(this, arguments);
      if (it) {
        arten[it.type] = (arten[it.type] || 0) + 1;
        if (AUS[it.type]) { stufen[it.tier || 0]++; iLs.push(it.iLevel || 0); }
      }
      return it;
    };
    for (var i = 0; i < ${n}; i++) {
      try { spawnLoot.call(sc, 400, 300, null, ${JSON.stringify(quelle)}); } catch (e) {}
    }
    window.randomLoot = orig;
    var summe = stufen.reduce(function (a, b) { return a + b; }, 0);
    return {
      stufen: stufen, ausruestung: summe, arten: arten,
      iLmittel: iLs.length ? iLs.reduce(function (a, b) { return a + b; }, 0) / iLs.length : 0
    };
  })()`);
}

test('Bossbeute ist NIE gewoehnlich — mindestens magisch', () => {
  const r = serie({ isBoss: true }, 400);
  assert.ok(r.ausruestung > 200, 'zu wenig Ausruestung gemessen: ' + r.ausruestung);
  assert.strictEqual(r.stufen[0], 0,
    r.stufen[0] + ' von ' + r.ausruestung + ' Bossstuecken waren gewoehnlich');
});

test('Bossbeute wuerfelt drei Tiefen hoeher', () => {
  const r = serie({ isBoss: true }, 400);
  // Auf Tiefe 10 also im Mittel 13. Etwas Spielraum, weil computeItemLevelFromStats
  // das angezeigte itemLevel aus den Werten nachrechnet.
  assert.ok(r.iLmittel >= 12.5 && r.iLmittel <= 13.5,
    'mittleres iLevel ' + r.iLmittel.toFixed(1) + ', erwartet rund 13');
});

test('Der Aufschlag gilt NUR fuer echte Bosse', () => {
  // Mini-Bosse behalten ihren Qualitaetsbonus, aber nicht den Tiefensprung —
  // sie kommen mehrfach je Lauf, ein Aufschlag dort waere ein Beutestrom.
  const r = serie({ isMiniBoss: true }, 900);
  assert.ok(r.ausruestung > 5, 'zu wenig Mini-Boss-Ausruestung: ' + r.ausruestung);
  assert.ok(r.iLmittel <= 11,
    'Mini-Bosse wuerfeln mit iLevel ' + r.iLmittel.toFixed(1) + ' ebenfalls erhoeht');
  assert.ok(r.stufen[0] > 0,
    'Mini-Bosse lassen keine gewoehnlichen Stuecke mehr fallen — der Boss verliert '
    + 'damit seine Sonderstellung');
});

test('Die Seltenheit bleibt eine VERTEILUNG, kein fester Rang', () => {
  // Wuerde die Mindeststufe per forceTier auf den ersten Wurf gelegt, waere
  // JEDES Bossstueck genau magisch — die Chance auf selten/legendaer waere weg.
  const r = serie({ isBoss: true }, 500);
  assert.ok(r.stufen[1] > 0, 'keine magischen Stuecke');
  assert.ok(r.stufen[2] + r.stufen[3] > 0,
    'kein einziges seltenes oder legendaeres Stueck in ' + r.ausruestung
    + ' Abwuerfen — die Mindeststufe hat die Verteilung nach oben gekappt');
});
