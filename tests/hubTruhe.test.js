// tests/hubTruhe.test.js — die Truhe im Hub (#127).
//
// Die eine Regel, an der alles haengt: EIN STUECK LIEGT NIE DOPPELT. Legen und
// Nehmen sind je ein unteilbarer Vorgang — passt es nicht, bleibt alles, wie es
// war. Die naheliegende Fehlerquelle waere "kopieren und hoffen": aus einem
// Stueck wuerden zwei, und das faellt im Spiel erst auf, wenn jemand sich zwei
// Legendaere aus einem gebaut hat.
//
// Geprueft wird ausserdem, dass die Truhe im SELBEN Spielstand liegt wie alles
// andere (#63: sonst taucht sie beim Slot-Wechsel im falschen Durchgang auf)
// und dass ein Altstand ohne Truhe das Laden nicht sprengt.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
loadGameModule('js/inventoryGrid.js');
loadGameModule('js/hubTruhe.js');
const T = W.HubTruhe;
const G = W.InventoryGrid;

function stueck(key, type) {
  return { key: key, type: type || 'weapon', name: key };
}

function leeresInventar(n) {
  return new Array(n || 40).fill(null);
}

/** Zaehlt, wie oft DASSELBE Objekt in beiden Behaeltern vorkommt. */
function vorkommen(objekt, inventar) {
  let n = 0;
  for (const s of inventar) if (s === objekt) n++;
  for (const s of T.faecher()) if (s === objekt) n++;
  return n;
}

beforeEach(() => { T.leeren(); });

test('Die Truhe hat ein festes Raster, keinen unbegrenzten Speicher', () => {
  // Unbegrenzt macht die Frage "was hebe ich auf" wertlos.
  assert.strictEqual(T.SPALTEN, 10, 'zehn Spalten wie das Laufinventar');
  assert.strictEqual(T.zeilen(), T.ZEILEN_START);
  assert.strictEqual(T.plaetze(), T.SPALTEN * T.ZEILEN_START);
  assert.strictEqual(T.faecher().length, T.plaetze());
});

test('Material darf nicht hinein — dafuer gibt es schon einen Speicher', () => {
  // changeMaterialCount hat einen eigenen, unbegrenzten Vorrat. Ein zweiter
  // waere nur verwirrend.
  assert.strictEqual(T.darfHinein(stueck('WPN_EISENKLINGE', 'weapon')), true);
  assert.strictEqual(T.darfHinein(stueck('POT_HEIL', 'consumable')), true);
  assert.strictEqual(T.darfHinein(stueck('AMU_GLASHERZ', 'amulet')), true);
  assert.strictEqual(T.darfHinein(stueck('MAT_EISEN', 'material')), false);
  assert.strictEqual(T.darfHinein(null), false);
});

test('Hineinlegen nimmt aus dem Inventar UND legt in die Truhe', () => {
  const inv = leeresInventar();
  const it = stueck('WPN_EISENKLINGE');
  G.einfuegen(inv, it);
  const vorIdx = inv.indexOf(it);

  assert.strictEqual(T.hineinlegen(inv, vorIdx), true);
  assert.strictEqual(inv[vorIdx], null, 'im Inventar liegt es noch');
  assert.strictEqual(vorkommen(it, inv), 1, 'es liegt doppelt oder gar nicht');
  assert.strictEqual(T.anzahl(), 1);
});

test('Herausnehmen ist der Weg zurueck — und ebenfalls nur einmal', () => {
  const inv = leeresInventar();
  const it = stueck('WPN_KRIEGSHAMMER');
  G.einfuegen(inv, it);
  T.hineinlegen(inv, inv.indexOf(it));

  const truhenIdx = T.faecher().findIndex((s) => s === it);
  assert.ok(truhenIdx >= 0);
  assert.strictEqual(T.herausnehmen(inv, truhenIdx), true);
  assert.strictEqual(vorkommen(it, inv), 1, 'es liegt doppelt oder gar nicht');
  assert.strictEqual(T.anzahl(), 0);
});

test('Ohne Platz passiert GAR NICHTS — nicht halb', () => {
  // Der gefaehrliche Fall: wegnehmen gelingt, ablegen nicht. Dann waere das
  // Stueck verloren, und niemand koennte sagen, wo es geblieben ist.
  const inv = leeresInventar();
  const gross = { key: 'WPN_KRIEGSHAMMER', type: 'weapon', name: 'Hammer' };
  // Truhe randvoll fuellen (2x2-Stuecke, 10x3 Raster -> 5x1 passen nebeneinander)
  const fuell = leeresInventar();
  let gelegt = 0;
  for (let i = 0; i < 40; i++) {
    const f = { key: 'WPN_KRIEGSHAMMER', type: 'weapon', name: 'Fuell' + i };
    if (G.einfuegen(fuell, f) < 0) break;
    if (T.hineinlegen(fuell, fuell.indexOf(f))) gelegt++;
  }
  assert.ok(gelegt > 0, 'die Truhe liess sich gar nicht fuellen');
  const vollDanach = T.anzahl();

  G.einfuegen(inv, gross);
  const idx = inv.indexOf(gross);
  const ergebnis = T.hineinlegen(inv, idx);
  if (!ergebnis) {
    assert.strictEqual(inv[idx], gross, 'abgelehnt, aber trotzdem aus dem Inventar genommen');
    assert.strictEqual(T.anzahl(), vollDanach, 'abgelehnt, aber trotzdem abgelegt');
  }
});

test('Ein volles Laufinventar verhindert das Herausnehmen, ohne Schaden', () => {
  const inv = leeresInventar();
  const it = stueck('WPN_EISENKLINGE');
  G.einfuegen(inv, it);
  T.hineinlegen(inv, inv.indexOf(it));

  // Inventar dichtmachen: jede Zelle mit 1x1-Stuecken belegen.
  const voll = [];
  for (let i = 0; i < 40; i++) voll.push(null);
  let n = 0;
  while (G.einfuegen(voll, { key: 'MAT', type: 'consumable', name: 'x' + n }) >= 0) { n++; if (n > 200) break; }

  const truhenIdx = T.faecher().findIndex((s) => s === it);
  assert.strictEqual(T.herausnehmen(voll, truhenIdx), false, 'es ging trotz vollem Inventar');
  assert.strictEqual(T.faecher()[truhenIdx], it, 'aus der Truhe genommen, obwohl es scheiterte');
});

test('Der Spielstand traegt die Truhe — und ein Altstand ohne sie bricht nichts', () => {
  const inv = leeresInventar();
  const it = stueck('AMU_FROSTSIEGEL', 'amulet');
  G.einfuegen(inv, it);
  T.hineinlegen(inv, inv.indexOf(it));

  const stand = T.alsSpielstand();
  assert.strictEqual(typeof stand.zeilen, 'number');
  assert.strictEqual(stand.faecher.filter(Boolean).length, 1);

  T.leeren();
  assert.strictEqual(T.anzahl(), 0);
  T.ausSpielstand(stand);
  assert.strictEqual(T.anzahl(), 1, 'die Truhe kam nicht zurueck');
  assert.strictEqual(T.faecher().find(Boolean).key, 'AMU_FROSTSIEGEL');

  // Altstand: kein 'truhe'-Feld.
  assert.deepStrictEqual(T.ausSpielstand(null), []);
  assert.strictEqual(T.anzahl(), 0);
  assert.deepStrictEqual(T.ausSpielstand({}), []);
});

test('Stuecke ohne Rasterlage bekommen einen Platz, statt unsichtbar zu werden', () => {
  // Genau der Fall beim Laden eines Stands aus der Zeit gleich grosser Faecher.
  const ohneLage = { key: 'WPN_EISENKLINGE', type: 'weapon', name: 'alt' };
  T.ausSpielstand({ zeilen: 3, faecher: [ohneLage] });
  const drin = T.faecher().find(Boolean);
  assert.ok(drin, 'das Stueck ist verschwunden');
  assert.strictEqual(typeof drin.gridX, 'number');
  assert.strictEqual(typeof drin.gridY, 'number');
});

test('Die Zeilenzahl aus dem Stand wird uebernommen und gedeckelt', () => {
  // Damit eine spaetere Erweiterung ueber eine Geldsenke (#98) nur eine Zahl ist.
  T.ausSpielstand({ zeilen: 5, faecher: [] });
  assert.strictEqual(T.zeilen(), 5);
  assert.strictEqual(T.plaetze(), 50);
  T.ausSpielstand({ zeilen: 999, faecher: [] });
  assert.strictEqual(T.zeilen(), T.ZEILEN_MAX, 'ungedeckelt');
  T.ausSpielstand({ zeilen: -3, faecher: [] });
  assert.ok(T.zeilen() >= 1, 'negative Zeilenzahl');
});

test('Verschieben innerhalb der Truhe achtet auf ihr eigenes Rastermass', () => {
  // Die Truhe ist niedriger als das Laufinventar. Wuerde sie dessen Mass
  // benutzen, liesse sich etwas in eine Zeile legen, die es gar nicht gibt.
  const inv = leeresInventar();
  const it = stueck('WPN_SCHATTENDOLCH');
  G.einfuegen(inv, it);
  T.hineinlegen(inv, inv.indexOf(it));
  const idx = T.faecher().findIndex(Boolean);

  assert.strictEqual(T.verschiebe(idx, 4, T.zeilen() - 1), true, 'letzte Zeile ist gueltig');
  assert.strictEqual(T.verschiebe(idx, 4, T.zeilen()), false, 'eine Zeile zu tief ging durch');
  assert.strictEqual(T.verschiebe(idx, T.SPALTEN, 0), false, 'eine Spalte zu weit ging durch');
});
