// tests/itemIcons.test.js — jede Ausruestungs-Basis hat ihr eigenes Bild (#125).
//
// Vorher teilten sich 27 der 33 Basen fuenf Symbole: vierzehn Amulette sahen
// im Inventar identisch aus, dazu je drei Helme, Ruestungen und Stiefel und
// vier Boegen. Im Raster — der Flaeche, die man beim Sortieren zuerst
// wahrnimmt — sagte das Bild nichts; es blieb der Name.
//
// Geprueft wird dreierlei:
//   1. Kein Symbol wird von zwei Basen geteilt (ausser den Traenken, die
//      bewusst eine Familie bleiben).
//   2. Jeder iconKey hat auch wirklich eine Zeichenroutine — sonst bleibt die
//      Zelle im Spiel leer, und das faellt erst im Inventar auf.
//   3. Keine zwei Symbole sind sich zu aehnlich. Das ist der Fall, der sich
//      nicht von selbst zeigt: der erste Entwurf fuers Glasherz war ein rundes
//      Herz und lag 0,0010 vom Kettenherz entfernt — in Graustufen dasselbe
//      Bild. Verglichen wird die SILHOUETTE, nicht die Farbe.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { sammleSymbole, rastere, unterschied } = require('../tools/iconVorschau.js');

const W = globalThis.window;
loadGameModule('js/lootSystem.js');

/** Alle Basen mit ihrem iconKey — Ausruestung und Amulette. */
function basen() {
  const L = W.LootSystem;
  const liste = [];
  const sammle = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const b of arr) if (b && b.iconKey) liste.push({ name: b.name || b.key, iconKey: b.iconKey });
  };
  sammle(L.ITEM_BASES);
  sammle(L.AMULET_DEFS);
  return liste;
}

/** Symbole nach Schluessel — bei doppelten Schluesseln gewinnt der letzte,
 *  genau wie in Phaser (generateTexture ueberschreibt). */
function symbolKarte() {
  const karte = new Map();
  for (const s of sammleSymbole()) karte.set(s.key, s);
  return karte;
}

test('Die Basen sind ueberhaupt ladbar', () => {
  const b = basen();
  assert.ok(b.length >= 25, 'zu wenige Basen gefunden: ' + b.length);
});

test('Kein Symbol wird von zwei Basen geteilt', () => {
  // Traenke duerfen eine Familie bleiben: vier Stufen desselben Gegenstands,
  // die sich ueber Groesse und Farbe unterscheiden, sind gewollt.
  const zaehler = new Map();
  for (const b of basen()) {
    if (/^itPotion/.test(b.iconKey)) continue;
    if (!zaehler.has(b.iconKey)) zaehler.set(b.iconKey, []);
    zaehler.get(b.iconKey).push(b.name);
  }
  const doppelt = [...zaehler.entries()].filter(([, namen]) => namen.length > 1);
  assert.deepStrictEqual(doppelt.map(([k, n]) => k + ': ' + n.join(', ')), [],
    'Symbole werden mehrfach vergeben');
});

test('Jeder iconKey hat eine Zeichenroutine', () => {
  // Ohne sie erzeugt Phaser keine Textur und die Zelle bleibt leer — im Code
  // faellt das nirgends auf, erst im Inventar.
  const karte = symbolKarte();
  const fehlend = basen().filter((b) => !karte.has(b.iconKey))
    .map((b) => b.name + ' -> ' + b.iconKey);
  assert.deepStrictEqual(fehlend, [], 'Basen ohne gezeichnetes Symbol');
});

test('Jedes Symbol hat genug Lagen, um nicht flach zu wirken', () => {
  // Dunkle Grundform, Flaeche, Lichtkante, Glanzpunkt — vier Formen sind das
  // Minimum, unter dem das Muster aus #113 nicht mehr aufgeht.
  const duenn = [...symbolKarte().values()]
    .filter((s) => s.formen.length < 4)
    .map((s) => s.key + ' (' + s.formen.length + ')');
  assert.deepStrictEqual(duenn, [], 'zu wenige Lagen');
});

test('Keine zwei Symbole sind sich zu aehnlich', () => {
  // Der Schwellwert ist gemessen, nicht geraten: das aehnlichste erlaubte
  // Paar sind zwei Stiefel derselben Familie (0,031). Ein rundes Herz gegen
  // ein rundes Herz lag bei 0,0010. 0,01 trennt beides sauber.
  const SCHWELLE = 0.01;
  const n = 24;
  const raster = [...symbolKarte().values()].map((s) => ({ key: s.key, feld: rastere(s, n) }));
  const zuNah = [];
  for (let i = 0; i < raster.length; i++) {
    for (let j = i + 1; j < raster.length; j++) {
      // Traenke sind absichtlich eine Familie.
      if (/^itPotion/.test(raster[i].key) && /^itPotion/.test(raster[j].key)) continue;
      const d = unterschied(raster[i].feld, raster[j].feld);
      if (d < SCHWELLE) zuNah.push(raster[i].key + ' / ' + raster[j].key + ' = ' + d.toFixed(4));
    }
  }
  assert.deepStrictEqual(zuNah, [], 'Symbolpaare unter dem Mindestabstand');
});

test('Die Form traegt auch ohne Farbe', () => {
  // Silhouette vor Farbe: der Rastervergleich ist absichtlich farbblind (er
  // kennt nur Deckung). Waere er es nicht, wuerden zwei gleiche Formen in
  // verschiedenen Farbtoenen als verschieden durchgehen — genau der Fehler,
  // den das Issue ausschliesst.
  const karte = symbolKarte();
  const a = karte.get('amuKettenherz');
  const b = karte.get('amuGlasherz');
  assert.ok(a && b, 'Vergleichspaar fehlt');
  const roh = rastere(a, 24);
  const eingefaerbt = rastere(
    { formen: a.formen.map((f) => Object.assign({}, f, { farbe: 0x00ff00 })) }, 24);
  assert.strictEqual(unterschied(roh, eingefaerbt), 0,
    'der Vergleich reagiert auf Farbe statt auf Form');
});
