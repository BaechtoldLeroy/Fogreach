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

// Die Zahlen aus enemy.js — sie sind die HOEHE IN BILDSCHIRMPIXELN und wurden
// aus der frueheren Darstellung uebernommen, damit der Bilderwechsel keinen
// Gegner groesser oder kleiner macht.
const ERWARTET = [
  [1, 'Imp', 48], [2, 'Bogenschuetze', 47], [3, 'Brute', 55], [4, 'Magier', 45],
  [5, 'Schattenschleicher', 35], [6, 'Kettenwache', 48], [7, 'Flammenweber', 45],
  [11, 'Geschwuer', 51], [12, 'Priester', 54], [13, 'Beschwoerer', 53],
  [14, 'Springer', 52], [15, 'Hund', 43], [16, 'Alarmwicht', 47]
];

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
