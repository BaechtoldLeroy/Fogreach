// tests/doorwayInWall.test.js — Ein Durchgang muss in einer WAND liegen.
//
// Diese Zusicherung war nie ausgesprochen, sondern nur ein Nebeneffekt: die
// Kandidatenspanne kam aus den BSP-Boxen, und dort liegt die gemeinsame Wand
// beider Kinder per Konstruktion. Als die Spanne auf das ganze Raster
// verbreitert wurde (Commit f7293cb, wieder zurueckgezogen), fiel sie
// ersatzlos weg: die verbleibende Pruefung verlangt nur begehbare
// ANLAUFREIHEN, und das trifft auf offenen Boden mitten im Raum genauso zu.
//
// Gemessen ueber 300 Seeds: 4273 von 7150 Durchgaengen (59.8 %) standen frei
// im Raum, vorher und nachher 0 %. Im Browser sofort als "Tuer mitten im Raum"
// sichtbar — gefunden vom Projektinhaber, nicht von der Testsuite.
//
// Erkennungsmerkmal: laengs der Wand muss unmittelbar neben der geraeumten
// Spanne wieder Wand stehen. Eine Tuer mitten im Raum hat dort Boden.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

loadGameModule('js/proceduralRooms.js');

test('Durchgaenge liegen in einer Wand, nicht frei im Raum', () => {
  const PR = globalThis.window && globalThis.window.ProceduralRooms;
  assert.ok(PR && typeof PR.generate === 'function', 'ProceduralRooms nicht geladen');

  const istWand = (w, x, y) => { const z = w[y]; return z !== undefined && z[x] === '#'; };

  let tueren = 0; let frei = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = PR.generate({ seed });
    if (!r || !r.layout || !r.doorways) continue;
    const w = r.layout.walls;
    r.doorways.forEach((d) => {
      tueren++;
      const waag = d.orientation === 'horizontal';
      const laengs = waag ? [1, 0] : [0, 1];
      const halb = (d.width - 1) / 2;
      let wandNeben = 0;
      [-1, 1].forEach((s) => {
        const ax = Math.round(d.x + laengs[0] * (halb + 1) * s);
        const ay = Math.round(d.y + laengs[1] * (halb + 1) * s);
        const treffer = waag
          ? (istWand(w, ax, Math.floor(d.y)) || istWand(w, ax, Math.ceil(d.y)))
          : (istWand(w, Math.floor(d.x), ay) || istWand(w, Math.ceil(d.x), ay));
        if (treffer) wandNeben++;
      });
      if (wandNeben === 0) frei++;
    });
  }

  assert.ok(tueren > 1000, 'zu wenige Durchgaenge gemessen: ' + tueren);
  const quote = frei / tueren;
  // Schwelle bewusst knapp: gemessen sind es 0 %. Der Fehlerfall lag bei 59.8 %,
  // ein Rueckfall waere also weit jenseits jeder Toleranz.
  assert.ok(quote < 0.02,
    'Tueren frei im Raum: ' + (quote * 100).toFixed(1) + ' % von ' + tueren
    + ' — erwartet nahe 0 %');
});
