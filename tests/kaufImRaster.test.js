// tests/kaufImRaster.test.js — Gekauftes muss auch IM INVENTAR liegen.
//
// Gemeldet: ein bei Mara gekauftes Stueck war in der Schmiede und beim Umwurf
// da, im Inventar aber nicht. Ursache war das Zellenraster aus #123: seither
// braucht jeder Gegenstand eine Lage (gridX/gridY), und InventoryGrid.belegung
// ueberspringt alles ohne sie:
//
//     if (typeof it.gridX !== 'number' || typeof it.gridY !== 'number') continue;
//
// Genau EIN Weg setzte die Lage (loot.js:636, der Abwurf). Sieben andere
// schrieben direkt in den ersten freien Listenplatz — vier Kaufwege im Laden,
// die Starttraenke, der Questlohn und die Schmiede. Sie alle laufen jetzt ueber
// InventoryGrid.einlagern.
//
// Der Test prueft die EIGENSCHAFT, nicht den Aufrufweg: was im Inventar liegt,
// muss im Raster auffindbar sein.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
W.i18n = W.i18n || { register() {}, t: (k) => k, onChange() {} };

loadGameModule('js/inventoryGrid.js');
loadGameModule('js/lootSystem.js');
const IG = W.InventoryGrid;
const LS = W.LootSystem;

function leeresInventar(n) {
  W.inventory = new Array(n || 40).fill(null);
  return W.inventory;
}

/** Findet das Raster den Gegenstand an irgendeiner Zelle wieder? */
function imRasterSichtbar(index) {
  const karte = IG.belegung(W.inventory);
  for (let y = 0; y < karte.length; y++) {
    for (let x = 0; x < karte[y].length; x++) {
      if (karte[y][x] === index) return true;
    }
  }
  return false;
}

test('einlagern setzt eine Rasterlage und macht das Stueck sichtbar', () => {
  leeresInventar();
  const item = LS.rollItem('WPN_EISENKLINGE', 10, 1);
  const idx = IG.einlagern(item);
  assert.ok(idx >= 0, 'einlagern hat keinen Platz gefunden');
  assert.strictEqual(typeof item.gridX, 'number', 'gridX fehlt');
  assert.strictEqual(typeof item.gridY, 'number', 'gridY fehlt');
  assert.ok(imRasterSichtbar(idx), 'das Stueck ist im Raster nicht auffindbar');
});

test('der alte Weg — direkt in den Listenplatz — macht es UNSICHTBAR', () => {
  // Das ist der gemeldete Fehler, als ausfuehrbare Beschreibung. Er belegt,
  // warum der Test oben ueberhaupt etwas aussagt.
  leeresInventar();
  const item = LS.rollItem('WPN_EISENKLINGE', 10, 1);
  W.inventory[0] = item;                 // ohne gridX/gridY
  assert.strictEqual(imRasterSichtbar(0), false,
    'ohne Lage duerfte das Raster den Gegenstand nicht finden — dann waere der '
    + 'gemeldete Fehler gar nicht moeglich gewesen und dieser Test wertlos');
});

test('einlagern lehnt ab, wenn das Raster voll ist — ohne etwas zu ueberschreiben', () => {
  leeresInventar();
  let gelegt = 0;
  for (let i = 0; i < 200; i++) {
    if (IG.einlagern(LS.rollItem('HD_KETTENHAUBE', 5, 0)) >= 0) gelegt++;
    else break;
  }
  assert.ok(gelegt > 0, 'nichts konnte abgelegt werden');
  assert.strictEqual(IG.einlagern(LS.rollItem('HD_KETTENHAUBE', 5, 0)), -1,
    'das volle Raster nimmt weiter etwas an');
  const belegt = W.inventory.filter(Boolean).length;
  assert.strictEqual(belegt, gelegt, 'ein Gegenstand wurde ueberschrieben');
});

test('einlagern ohne Inventar oder ohne Gegenstand faellt weich', () => {
  W.inventory = null;
  assert.strictEqual(IG.einlagern({ type: 'potion' }), -1);
  leeresInventar();
  assert.strictEqual(IG.einlagern(null), -1);
});

// ---------------------------------------------------------------------------
// Quellentest: kein Kaufweg darf am Raster vorbei schreiben.
// ---------------------------------------------------------------------------

const WURZEL = path.join(__dirname, '..');
const DATEIEN = ['js/scenes/ShopScene.js', 'js/abilitySystem.js',
  'js/questSystem.js', 'js/scenes/CraftingScene.js'];

test('kein Modul schreibt einen NEUEN Gegenstand direkt in einen Listenplatz', () => {
  // Die Rueckfallzweige duerfen es — sie greifen nur, wenn InventoryGrid fehlt.
  // Erkennbar sind sie daran, dass in denselben zehn Zeilen davor `einlagern`
  // steht.
  const treffer = [];
  DATEIEN.forEach((rel) => {
    const zeilen = fs.readFileSync(path.join(WURZEL, rel), 'utf8').split(/\r?\n/);
    zeilen.forEach((z, i) => {
      if (!/\binventory\[[A-Za-z_$][A-Za-z0-9_$]*\]\s*=\s*[^n]/.test(z)) return;
      if (/=\s*null/.test(z)) return;                       // Leeren ist erlaubt
      const umfeld = zeilen.slice(Math.max(0, i - 10), i + 1).join('\n');
      if (/einlagern/.test(umfeld)) return;                 // Rueckfallzweig
      treffer.push(rel + ':' + (i + 1) + '  ' + z.trim());
    });
  });
  assert.deepStrictEqual(treffer.length, 0,
    'diese Stellen legen ohne Rasterlage ab:\n  ' + treffer.join('\n  '));
});
