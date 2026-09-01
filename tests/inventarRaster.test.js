// tests/inventarRaster.test.js — Rasterbelegung des Inventars (#123 B).
//
// Bis hierher belegte ein Dolch genauso viel wie ein Zweihaender: 20 gleich
// grosse Faecher. Jetzt hat jeder Gegenstand eine Groesse in Zellen, und das
// Inventar wird zum Packproblem.
//
// Geprueft wird die reine Logik — kein Phaser, keine Szene. Die UI-Seite kann
// dadurch getrennt scheitern, ohne diese Zusicherungen mitzureissen.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

loadGameModule('js/inventoryGrid.js');
const G = globalThis.window.InventoryGrid;

const leer = (n) => new Array(n || 40).fill(null);

test('Raster: jede Waffenart hat ihre eigene Silhouette', () => {
  // Der Sinn des Umbaus. Waeren alle gleich gross, koennte man sich das
  // Packproblem sparen.
  const dolch = G.groesse({ type: 'weapon', key: 'WPN_SCHATTENDOLCH' });
  const schwert = G.groesse({ type: 'weapon', key: 'WPN_RICHTSCHWERT' });
  const hammer = G.groesse({ type: 'weapon', key: 'WPN_KRIEGSHAMMER' });
  const trank = G.groesse({ type: 'potion' });

  assert.deepStrictEqual([dolch.b, dolch.h], [1, 2], 'Dolch');
  assert.deepStrictEqual([schwert.b, schwert.h], [2, 4], 'Richtschwert');
  assert.deepStrictEqual([hammer.b, hammer.h], [2, 3], 'Kriegshammer');
  assert.deepStrictEqual([trank.b, trank.h], [1, 1], 'Trank');

  const flaeche = (g) => g.b * g.h;
  assert.ok(flaeche(dolch) < flaeche(hammer) && flaeche(hammer) <= flaeche(schwert),
    'die Groessen tragen die Waffenart nicht: Dolch ' + flaeche(dolch)
    + ', Hammer ' + flaeche(hammer) + ', Richtschwert ' + flaeche(schwert));
});

test('Raster: ein unbekannter Gegenstand faellt auf seine Art zurueck, nicht auf 1x1', () => {
  // Stillschweigend zu klein waere schlimmer als grob geschaetzt: der
  // Gegenstand passte dann ueberall hin und das Packproblem waere ausgehebelt.
  const g = G.groesse({ type: 'body', key: 'GIBT_ES_NICHT' });
  assert.deepStrictEqual([g.b, g.h], [2, 3], 'Ruestung ohne bekannten Schluessel');
});

test('Raster: Einfuegen belegt genau die Zellen der Groesse', () => {
  const inv = leer();
  const idx = G.einfuegen(inv, { type: 'body', name: 'Panzer' });
  assert.ok(idx >= 0, 'nicht eingefuegt');
  assert.strictEqual(inv[idx].gridX, 0);
  assert.strictEqual(inv[idx].gridY, 0);
  assert.strictEqual(G.freieZellen(inv), G.COLS * G.ROWS - 6, '2x3 belegt nicht 6 Zellen');
});

test('Raster: der naechste Fund legt sich daneben, nicht darueber', () => {
  const inv = leer();
  G.einfuegen(inv, { type: 'body', name: 'A' });          // 2x3 links oben
  const i2 = G.einfuegen(inv, { type: 'body', name: 'B' });
  assert.ok(i2 >= 0, 'zweiter Gegenstand nicht eingefuegt');
  assert.strictEqual(inv[i2].gridX, 2, 'B liegt nicht rechts neben A');
  assert.strictEqual(inv[i2].gridY, 0);
  assert.strictEqual(G.itemAn(inv, 0, 0).name, 'A');
  assert.strictEqual(G.itemAn(inv, 2, 0).name, 'B');
});

test('Raster: ist kein Platz mehr, wird NICHT eingefuegt', () => {
  const inv = leer();
  // 10x4 = 40 Zellen. Richtschwerter sind 2x4 -> genau 5 passen nebeneinander.
  for (let i = 0; i < 5; i++) {
    assert.ok(G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i }) >= 0,
      'Schwert ' + i + ' passte nicht, obwohl das Raster es hergibt');
  }
  assert.strictEqual(G.freieZellen(inv), 0, 'das Raster ist nicht voll');
  assert.strictEqual(G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'zuviel' }), -1,
    'ein sechstes Schwert wurde eingefuegt, obwohl kein Platz ist');
});

test('Raster: ein Trank passt noch in eine Luecke, ein Schwert nicht', () => {
  const inv = leer();
  // Vier Schwerter (2x4) fuellen 8 der 10 Spalten. Rest: 2 Spalten x 4 Zeilen.
  for (let i = 0; i < 4; i++) G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i });
  // Ein Trank (1x1) in die Restspalte.
  assert.ok(G.einfuegen(inv, { type: 'potion', name: 'Trank' }) >= 0, 'Trank passte nicht');
  assert.strictEqual(G.freieZellen(inv), 7, 'unerwartete Restflaeche');
  // Jetzt ist keine volle 2x4-Saeule mehr frei.
  assert.strictEqual(G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'X' }), -1,
    'ein Schwert wurde in eine Luecke gelegt, in die es nicht passt');
});

test('Raster: Altbestand ohne Lage bekommt einen Platz zugewiesen', () => {
  // Ein Spielstand aus der Zeit gleich grosser Faecher kennt kein gridX/gridY.
  // Ohne diesen Schritt waeren die Gegenstaende im Raster unsichtbar und
  // wuerden vom naechsten Fund ueberschrieben.
  const inv = leer();
  inv[0] = { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'Alt1' };
  inv[1] = { type: 'body', name: 'Alt2' };
  const heimatlos = G.lageErgaenzen(inv);
  assert.strictEqual(heimatlos.length, 0, 'unerwartet heimatlos: ' + heimatlos.length);
  assert.strictEqual(typeof inv[0].gridX, 'number', 'Alt1 hat keine Lage');
  assert.strictEqual(typeof inv[1].gridX, 'number', 'Alt2 hat keine Lage');
  assert.notStrictEqual(
    inv[0].gridX + ',' + inv[0].gridY, inv[1].gridX + ',' + inv[1].gridY,
    'beide liegen auf derselben Zelle');
});

test('Raster: was beim Nachtragen keinen Platz findet, wird GEMELDET statt verschluckt', () => {
  const inv = leer();
  for (let i = 0; i < 6; i++) inv[i] = { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i };
  const heimatlos = G.lageErgaenzen(inv);
  assert.strictEqual(heimatlos.length, 1,
    'erwartet: genau eines faellt heraus (5 passen, 6 nicht), gemeldet: ' + heimatlos.length);
  assert.ok(inv.filter(Boolean).length === 5, 'das Feld enthaelt noch das heimatlose Stueck');
});
