// tests/gegnerHoehe.test.js — wie gross ein Gegner erscheint, haengt an der
// FIGUR und nicht am Rahmen.
//
// Skaliert wurde frueher auf die Rahmenhoehe: setScale(48 / enemy.height).
// Solange jedes Bild gleich viel leeren Rand mitbrachte, fiel das nicht auf.
// Der Schattenrat brachte ihn nicht: seine Figur sass in der oberen Haelfte
// eines 1024 Pixel hohen Rahmens, seine 96*3.6 trafen also den RAHMEN, und
// sichtbar blieben 87 Pixel — weniger als der Kettenmeister mit 127, obwohl
// der Kommentar daneben von "doppelter Darstellungsgroesse" sprach.
//
// Beim Bilderwechsel waere derselbe Fehler andersherum aufgeschlagen: die
// Pixelbilder sind eng zugeschnitten, jede Figur waere um ihren frueheren
// Randanteil gewachsen (der Schattenrat um das 3.7-fache).
//
// Der zweite Fall legt genau das offen: dieselbe Figur, einmal eng und
// einmal in einem dreimal so hohen Rahmen. Er faellt, sobald wieder der
// Rahmen gemessen wird — und zwar auf dem ECHTEN Weg ueber spawnEnemy, nicht
// an der Hilfsfunktion vorbei.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launchDungeon({ depth: 8 }); });
after(async () => { if (H) await H.shutdown(); });

/**
 * Spawnt einen Typ und gibt die sichtbare Anzeigehoehe zurueck.
 *
 * Elite- und Mini-Boss-Gegner haben EIGENE Groessenregeln (sie rechnen auf
 * die Breite) und werden beim Spawn zufaellig vergeben — die werden hier
 * uebersprungen, sonst flattert der Fall.
 */
function anzeigeHoehe(typ) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    var e = spawnEnemy.call(sc, player.x + 150, player.y, ${typ});
    if (!e) return { fehler: 'kein Gegner' };
    if (e.isMiniBoss || e.isElite || e.eliteAffix) return { sonder: true };
    var box = _computeSpriteAlphaBounds(e);
    if (!box) return { fehler: 'keine Alpha-Messung' };
    return { hoehe: box.h * e.scaleY, bild: e.texture.key, rahmen: e.height, sicht: box.h };
  })()`);
}

/** Mehrfach versuchen, bis ein gewoehnlicher (nicht befoerderter) Gegner kommt. */
function gewoehnlicheHoehe(typ, name) {
  for (let i = 0; i < 12; i++) {
    const r = anzeigeHoehe(typ);
    if (r && r.fehler) assert.fail(name + ': ' + r.fehler);
    if (r && !r.sonder) return r;
  }
  assert.fail(name + ': zwoelfmal nur Elite/Mini-Boss gezogen');
  return null;
}

// Die Leiter aus enemy.js, in Bildschirmpixeln.
//
// Bis b317 waren das keine Entscheidung, sondern ein Rest: in b314 aus der
// frueheren Darstellung zurueckgerechnet, damit der Bilderwechsel niemanden
// groesser macht — und jene fruehere Darstellung war selbst schon schief,
// weil auf die RAHMENhoehe skaliert wurde. Gemessen kam heraus:
// Schattenschleicher 35, Magier 45, Priester 54, Brute 55.
const ERWARTET = [
  // die Kleinen, mit Absicht
  [1, 'Imp', 44], [16, 'Alarmwicht', 44],
  // alles mit Menschengestalt — EINE Stufe
  [2, 'Bogenschuetze', 52], [4, 'Magier', 52], [5, 'Schattenschleicher', 52],
  [7, 'Flammenweber', 52], [12, 'Priester', 52], [13, 'Beschwoerer', 52],
  [14, 'Springer', 52],
  // darueber, der Reihe nach
  [11, 'Geschwuer', 54], [6, 'Kettenwache', 56], [3, 'Brute', 60],
  // Tiere
  [8, 'Ratte', 30], [9, 'Fledermaus', 30], [10, 'Wolf', 42], [15, 'Hund', 46]
];

// Die Typen, die dieselbe Hoehe haben MUESSEN. Genau das war vorher kaputt:
// die Sondergegner standen durchweg hoeher als die Grundgegner, obwohl beide
// Menschen sind.
const MENSCHENGESTALT = [2, 4, 5, 7, 12, 13, 14];

test('jeder Gegnertyp erscheint in seiner vorgesehenen Hoehe', () => {
  const daneben = [];
  ERWARTET.forEach(([typ, name, soll]) => {
    const r = gewoehnlicheHoehe(typ, name);
    // Eine halbe Zeile Spielraum: die Figur wird in ganzen Pixeln gemessen.
    if (Math.abs(r.hoehe - soll) > 1.5) {
      daneben.push(name + ' ' + r.hoehe.toFixed(1) + ' statt ' + soll
        + ' (Rahmen ' + r.rahmen + ', Figur ' + r.sicht + ')');
    }
  });
  assert.strictEqual(daneben.length, 0, daneben.join('; '));
});

test('alles mit Menschengestalt ist gleich gross', () => {
  // Der eigentliche Punkt der Leiter. Einzelwerte zu pruefen reicht nicht:
  // verschoebe jemand alle sieben um denselben Betrag, waere das in Ordnung —
  // dass sie AUSEINANDERLAUFEN, ist der Fehler.
  const hoehen = MENSCHENGESTALT.map((t) => {
    const name = (ERWARTET.find((e) => e[0] === t) || [, 'Typ ' + t])[1];
    return { name: name, h: gewoehnlicheHoehe(t, name).hoehe };
  });
  const min = Math.min(...hoehen.map((x) => x.h));
  const max = Math.max(...hoehen.map((x) => x.h));
  assert.ok(max - min <= 1.5,
    'sie laufen um ' + (max - min).toFixed(1) + ' px auseinander: '
    + hoehen.map((x) => x.name + ' ' + x.h.toFixed(0)).join(', '));
});

test('ein dreimal so hoher Rahmen aendert die Groesse NICHT', () => {
  // Der Brute, weil sein Bild den Rahmen fast ausfuellt: waere der Rahmen das
  // Mass, muesste er auf ein Drittel schrumpfen — ein Unterschied, den keine
  // Messtoleranz verdeckt.
  const eng = gewoehnlicheHoehe(3, 'Brute');

  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var alt = sc.textures.get('brute_right0').getSourceImage();
    var b = alt.width, h = alt.height;
    // Dieselbe Figur, oben in einen dreimal so hohen Rahmen gesetzt — die
    // Lage des alten Schattenrats.
    var c = sc.textures.createCanvas('__brute_mit_rand', b, h * 3);
    if (!c) return { fehler: 'kein Canvas' };
    c.context.drawImage(alt, 0, 0);
    c.refresh();
    // Die Textur UNTER DEM GEWOHNTEN NAMEN unterschieben, damit der echte
    // Spawn-Weg sie nimmt; der Messpuffer muss mit weg.
    sc.textures.remove('brute_right0');
    sc.textures.addCanvas('brute_right0', c.getCanvas());
    delete _spriteAlphaBoundsCache['brute_right0'];
    return { ok: true, neueHoehe: h * 3 };
  })()`);
  assert.ok(r && r.ok, 'Textur mit Rand liess sich nicht bauen: ' + JSON.stringify(r));

  const mitRand = gewoehnlicheHoehe(3, 'Brute mit Rand');
  assert.strictEqual(mitRand.rahmen, r.neueHoehe,
    'der Gegner traegt den hohen Rahmen gar nicht — der Fall misst nichts');
  assert.ok(Math.abs(mitRand.hoehe - eng.hoehe) <= 1.5,
    'mit leerem Rand ' + mitRand.hoehe.toFixed(1) + ' statt ' + eng.hoehe.toFixed(1)
    + ' Pixel — die Groesse haengt wieder am Rahmen');
});
