// tests/beuteDaempfung.test.js — wie viel Ausruestung ein Lauf abwirft.
//
// Es gibt KEINE harte Grenze, nur eine Bremse: je mehr echte Ausruestung in
// einem Lauf schon gefallen ist, desto seltener faellt weitere.
//
//   ab dem 3. Stueck   halbe Chance
//   ab dem 6. Stueck   ein Viertel
//
// Vorher setzte sie erst ab dem 4. Stueck ein und blieb dann bei der Haelfte
// stehen — nach oben war der Ertrag unbegrenzt.
//
// Stichprobe 5000 je Messung, Toleranz entsprechend weit: bei 6 % Grundchance
// liegt der Standardfehler des Verhaeltnisses bei rund 4 Prozentpunkten. Mit
// enger Toleranz flackerte der Test im Gesamtlauf, mit 12 000 Wuerfen lief er
// in die Zeitgrenze des Testkopfs (20 s).
//
// Der Test misst die WIRKUNG (wie oft faellt etwas), nicht die Formel: eine
// Pruefung auf "der Code enthaelt / 4" saehe gleich aus und sagte nichts
// darueber, ob die Zahl je einen Wurf erreicht.

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
 * Wie oft faellt bei N Toetungen Ausruestung, wenn der Laufzaehler auf `schon`
 * steht? Der Zaehler wird VOR jedem Wurf zurueckgesetzt, damit die Messung
 * genau eine Stufe der Bremse trifft.
 */
function trefferQuote(schon, gegnerArt, versuche) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var gefallen = 0;
    var AUS = { weapon: 1, offhand: 1, head: 1, body: 1, boots: 1 };
    var orig = window.randomLoot;
    window.randomLoot = function () {
      var it = orig.apply(this, arguments);
      if (it && AUS[it.type]) gefallen++;
      return it;
    };
    for (var i = 0; i < ${versuche}; i++) {
      window.__runItemsDropped = ${schon};
      try { spawnLoot.call(sc, 400, 300, null, ${JSON.stringify(gegnerArt)}); } catch (e) {}
    }
    window.randomLoot = orig;
    window.__runItemsDropped = 0;
    return gefallen / ${versuche};
  })()`);
}

test('Ab dem 3. Stueck faellt nur noch halb so oft etwas', () => {
  // Mini-Bosse gewaehlt, weil ihre Grundchance (6 %) gross genug ist, um den
  // Unterschied in vertretbar vielen Wuerfen zu sehen. Bei Trash (0,5 %)
  // braeuchte es Zehntausende.
  const voll = trefferQuote(0, { isMiniBoss: true }, 5000);
  const halb = trefferQuote(3, { isMiniBoss: true }, 5000);
  assert.ok(voll > 0.03, 'die volle Quote ist schon zu klein: ' + voll);
  const anteil = halb / voll;
  assert.ok(Math.abs(anteil - 0.5) < 0.20,
    'ab dem 3. Stueck fallen ' + (anteil * 100).toFixed(0) + ' % statt rund 50 %'
    + '  (' + (voll * 100).toFixed(1) + ' % -> ' + (halb * 100).toFixed(1) + ' %)');
});

test('Ab dem 6. Stueck nur noch ein Viertel', () => {
  const voll = trefferQuote(0, { isMiniBoss: true }, 5000);
  const viertel = trefferQuote(6, { isMiniBoss: true }, 5000);
  const anteil = viertel / voll;
  assert.ok(Math.abs(anteil - 0.25) < 0.14,
    'ab dem 6. Stueck fallen ' + (anteil * 100).toFixed(0) + ' % statt rund 25 %'
    + '  (' + (voll * 100).toFixed(1) + ' % -> ' + (viertel * 100).toFixed(1) + ' %)');
});

test('Bei 2 Stuecken bremst noch nichts', () => {
  // Die Grenze liegt bei DREI. Ein Off-by-one waere hier am leichtesten
  // passiert — vorher setzte die Bremse tatsaechlich erst ab vier ein.
  const voll = trefferQuote(0, { isMiniBoss: true }, 5000);
  const zwei = trefferQuote(2, { isMiniBoss: true }, 5000);
  assert.ok(Math.abs(zwei / voll - 1) < 0.20,
    'bei 2 Stuecken wird schon gebremst: ' + (voll * 100).toFixed(1)
    + ' % -> ' + (zwei * 100).toFixed(1) + ' %');
});

test('Der Boss laesst IMMER etwas fallen, egal wie viel schon gefallen ist', () => {
  // Er ist der Hoehepunkt einer Tiefe und erscheint nur alle zehn. Die Bremse
  // erreicht ihn gar nicht: sein Wurf wird nie befragt.
  //
  // Genau das war der Grund, den frueheren !isBossDrop-Zweig zu entfernen — er
  // sah aus wie eine Ausnahme, war aber wirkungslos, und keine Mutation konnte
  // ihn zum Fallen bringen. Was hier zaehlt, ist die Garantie.
  const frisch = trefferQuote(0, { isBoss: true }, 200);
  const spaet = trefferQuote(9, { isBoss: true }, 200);
  assert.strictEqual(frisch, 1, 'der Boss laesst nicht immer etwas fallen: ' + frisch);
  assert.strictEqual(spaet, 1,
    'nach 9 Stuecken laesst der Boss nur noch in ' + (spaet * 100).toFixed(0) + ' % der Faelle etwas fallen');
});

test('Der Zaehler wird bei jedem neuen Lauf zurueckgesetzt', () => {
  // Ohne das truege man die Bremse aus dem letzten Lauf in den naechsten.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');
  assert.ok(/__runItemsDropped\s*=\s*0/.test(quelle),
    'der Laufzaehler wird nirgends zurueckgesetzt');
});
