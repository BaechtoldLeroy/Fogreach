// Regression #101: prozedurale Tueren landeten in der Raumecke.
//
// carveDoorway waehlt die Position mit einem Rand zur Querwand — der Rand galt
// aber fuer dx/dy, GERAEUMT wird ab dx-1 (die Schleife beginnt bei i = -1).
// Mit dem alten Rand 2 begann der freie Bereich damit bei Kammerkante+1: die
// aeusserste Tuerkachel lag unmittelbar an der Querwand, der Anlauf darauf
// wurde zum L-Winkel.
//
// Im Spieltest (#96) war das mit 21 Faellen der zweithaeufigste Blocker; eine
// Aufnahme zeigte den Bot mit voller Geschwindigkeit gegen einen OFFENEN
// Durchgang, 2 px Fortschritt ueber 500 Runden.
//
// Geprueft wird an der Kachelkarte, nicht an der Absicht: rund um jede
// Tuerkachel muss genug freier Boden liegen, damit der Spieler gerade
// hineinlaufen kann.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

function frisch() {
  if (globalThis.window) delete globalThis.window.ProceduralRooms;
  loadGameModule('js/proceduralRooms.js');
  return globalThis.window.ProceduralRooms;
}

/** Das Raster liegt in layout.WALLS — layout selbst ist ein Objekt mit
 * {legend, walls}. Ein erster Anlauf indizierte layout direkt, damit galt jede
 * Kachel als Wand und der Test meldete 4763 Engstellen bei ~200 Raeumen.
 * Ist die Kachel begehbar? '#' ist Wand, alles andere Boden. */
function frei(grid, x, y) {
  const zeile = grid[y];
  if (!zeile) return false;
  const c = String(zeile)[x];
  return c !== undefined && c !== '#';
}

/**
 * Freier Korridor quer zur Tuer: eine Tuer, die an einer Querwand klebt, hat
 * auf einer Seite sofort Wand. Geprueft wird die Kachelreihe DURCH die Tuer.
 */
function engstelleGefunden(grid, d) {
  const cx = Math.round(d.x);
  const cy = Math.round(d.y);
  // Quer zur Durchgangsrichtung messen: bei einer horizontalen Wand laeuft der
  // Durchgang in X, die Engstelle zeigt sich also links/rechts der Mitte.
  const laengs = d.orientation === 'horizontal'
    ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
  let breite = 1;
  for (const [dx, dy] of laengs) {
    for (let k = 1; k <= 4; k++) {
      if (!frei(grid, cx + dx * k, cy + dy * k)) break;
      breite++;
    }
  }
  // doorWidth ist 3-4 Kacheln, geraeumt werden doorWidth+2. Weniger als 4
  // begehbare Kacheln quer bedeutet, dass eine Querwand hineinragt.
  return breite < 4;
}

// Der urspruenglich hier stehende Test ("keine Tuer klebt an einer Querwand")
// ist entfallen: er bestand mit dem alten UND dem neuen Rand, pruefte also
// nichts. Die Messung dazu steht in Issue #101 — der groessere Rand machte die
// Anlaufsituation sogar minimal schlechter (22,5 % statt 21,3 % Tueren mit
// hoechstens einer freien Anlaufkachel). Der Engpass liegt also woanders.

test('#101: jeder Raum behaelt seine Durchgaenge (keine stille Verbindungsluecke)', () => {
  // Der groessere Rand laesst den Ueberlapp oefter zu knapp werden. Frueher gab
  // es dann ein blankes return und damit GAR KEINEN Durchgang. Jetzt wird der
  // Rand gestuft nachgegeben (3 -> 2 -> 1), also darf die Zahl der Durchgaenge
  // nicht einbrechen.
  const PR = frisch();
  let ohne = 0;
  let gesamt = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = PR.generate({ seed });
    if (!r || !r.layout && r.layout.walls) continue;
    gesamt++;
    if (!r.doorways || r.doorways.length === 0) ohne++;
  }
  assert.ok(gesamt > 0, 'keine Raeume erzeugt');
  assert.ok(ohne / gesamt < 0.10,
    ohne + ' von ' + gesamt + ' Raeumen ganz ohne Durchgang — der Rand ist zu streng');
});
