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

  assert.deepStrictEqual([dolch.b, dolch.h], [1, 1], 'Dolch');
  assert.deepStrictEqual([schwert.b, schwert.h], [2, 2], 'Richtschwert');
  assert.deepStrictEqual([hammer.b, hammer.h], [2, 2], 'Kriegshammer');
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
  assert.deepStrictEqual([g.b, g.h], [2, 2], 'Ruestung ohne bekannten Schluessel');
});

test('Raster: Einfuegen belegt genau die Zellen der Groesse', () => {
  const inv = leer();
  const idx = G.einfuegen(inv, { type: 'body', name: 'Panzer' });
  assert.ok(idx >= 0, 'nicht eingefuegt');
  assert.strictEqual(inv[idx].gridX, 0);
  assert.strictEqual(inv[idx].gridY, 0);
  assert.strictEqual(G.freieZellen(inv), G.COLS * G.ROWS - 4, '2x2 belegt nicht 4 Zellen');
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
  // 10x4 = 40 Zellen, Richtschwerter sind 2x2 -> genau zehn passen hinein.
  for (let i = 0; i < 10; i++) {
    assert.ok(G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i }) >= 0,
      'Schwert ' + i + ' passte nicht, obwohl das Raster es hergibt');
  }
  assert.strictEqual(G.freieZellen(inv), 0, 'das Raster ist nicht voll');
  assert.strictEqual(G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'zuviel' }), -1,
    'ein elftes Schwert wurde eingefuegt, obwohl kein Platz ist');
});

test('Raster: in eine Restluecke passt ein Trank, aber kein Bogen', () => {
  const inv = leer();
  // Neun Richtschwerter (2x2) lassen genau eine 2x2-Ecke frei.
  for (let i = 0; i < 9; i++) G.einfuegen(inv, { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i });
  assert.strictEqual(G.freieZellen(inv), 4, 'unerwartete Restflaeche');
  // Ein Bogen ist 1x3 und passt nicht in eine 2x2-Ecke.
  assert.strictEqual(G.einfuegen(inv, { type: 'weapon', subtype: 'bow', name: 'Bogen' }), -1,
    'ein 1x3-Bogen wurde in eine 2x2-Luecke gelegt');
  assert.ok(G.einfuegen(inv, { type: 'potion', name: 'Trank' }) >= 0,
    'ein 1x1-Trank passte nicht in die freie Ecke');
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
  for (let i = 0; i < 11; i++) inv[i] = { type: 'weapon', key: 'WPN_RICHTSCHWERT', name: 'S' + i };
  const heimatlos = G.lageErgaenzen(inv);
  assert.strictEqual(heimatlos.length, 1,
    'erwartet: genau eines faellt heraus (10 passen, 11 nicht), gemeldet: ' + heimatlos.length);
  assert.ok(inv.filter(Boolean).length === 10, 'das Feld enthaelt noch das heimatlose Stueck');
});

test('Umlegen: ein Gegenstand blockiert sich beim Verschieben nicht selbst', () => {
  // Ohne das Ausblenden des eigenen Stuecks waere jede Bewegung um eine Zelle
  // unmoeglich — es kollidierte mit sich selbst.
  const inv = leer();
  const i = G.einfuegen(inv, { type: 'body', name: 'Panzer' });   // 2x3 auf 0,0
  assert.ok(G.kannHin(inv, i, 1, 0), 'Verschieben um eine Spalte wurde abgelehnt');
  assert.ok(G.verschiebe(inv, i, 1, 0), 'Verschieben schlug fehl');
  assert.strictEqual(inv[i].gridX, 1);
});

test('Umlegen: auf einen belegten Platz geht nicht', () => {
  const inv = leer();
  const a = G.einfuegen(inv, { type: 'body', name: 'A' });          // 2x3 auf 0,0
  const b = G.einfuegen(inv, { type: 'body', name: 'B' });          // 2x3 auf 2,0
  assert.ok(!G.kannHin(inv, b, 0, 0), 'B durfte auf A gelegt werden');
  assert.ok(!G.verschiebe(inv, b, 0, 0), 'B wurde auf A gelegt');
  assert.strictEqual(inv[b].gridX, 2, 'B ist trotz Ablehnung gewandert');
  assert.strictEqual(inv[a].gridX, 0, 'A wurde ueberschrieben');
});

test('Umlegen: ueber den Rand hinaus geht nicht', () => {
  const inv = leer();
  const i = G.einfuegen(inv, { type: 'body', name: 'Panzer' });     // 2x3
  assert.ok(!G.kannHin(inv, i, G.COLS - 1, 0), 'ragt rechts hinaus');
  assert.ok(!G.kannHin(inv, i, 0, G.ROWS - 1), 'ragt unten hinaus');
  assert.ok(!G.kannHin(inv, i, -1, 0), 'ragt links hinaus');
});
