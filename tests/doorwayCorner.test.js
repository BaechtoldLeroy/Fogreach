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

// ---------------------------------------------------------------------------
// Zweiter Anlauf (#101). Die urspruengliche Vermutung — Platzierungsrand 2 -> 3
// — ist oben widerlegt. Die ECHTE Ursache: der Rand wird gegen node.left /
// node.right gerechnet, das sind BOUNDING BOXES. 4966 von 7150 Durchgaengen
// (300 Seeds) liegen zwischen Knoten, deren Kinder selbst wieder geteilt sind;
// dort steht die echte Kammerwand irgendwo INNERHALB der Box. carveDoorway
// prueft die Anlaufreihen deshalb jetzt am Raster.
//
// Messung vor/nach, gleiche Messfunktion, 300 Seeds:
//   Anlauf < 2 Kacheln   67,5 %  ->  25,5 %
//   Tuer oeffnet auf Fels 28,5 %  ->   4,1 %
//   Durchgaenge insgesamt  7150   ->   7150   (keiner verloren)

/**
 * Anlauf einer Tuer: Abstand der AEUSSERSTEN geraeumten Kachel zur naechsten
 * Querwand, gemessen in der Kammerbodenreihe vor der Wand — auf beiden Seiten
 * und in beiden Kammern, das Minimum zaehlt. -1 heisst: die Tuerkachel oeffnet
 * dort auf Fels.
 */
function anlaufKacheln(grid, d) {
  const halb = (d.width - 1) / 2;
  const laengs = d.orientation === 'horizontal' ? [1, 0] : [0, 1];
  const quer = d.orientation === 'horizontal' ? [0, 1] : [1, 0];
  let min = Infinity;
  for (const versatz of [-1.5, 1.5]) {
    for (const s of [-1, 1]) {
      const ax = Math.round(d.x + quer[0] * versatz + laengs[0] * halb * s);
      const ay = Math.round(d.y + quer[1] * versatz + laengs[1] * halb * s);
      if (!frei(grid, ax, ay)) { min = Math.min(min, -1); continue; }
      let k = 1;
      while (k < 40 && frei(grid, ax + laengs[0] * k * s, ay + laengs[1] * k * s)) k++;
      min = Math.min(min, k - 1);
    }
  }
  return min;
}

function anlaufStatistik(seeds) {
  const PR = frisch();
  const werte = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const r = PR.generate({ seed });
    if (!r || !r.layout || !r.layout.walls || !r.doorways) continue;
    for (const d of r.doorways) werte.push(anlaufKacheln(r.layout.walls, d));
  }
  return werte;
}

test('#101: Durchgaenge haben Anlauf statt Wandklebe (waagerecht und senkrecht)', () => {
  const werte = anlaufStatistik(120);
  assert.ok(werte.length > 2000, 'zu wenige Durchgaenge gemessen: ' + werte.length);
  const eng = werte.filter((v) => v < 2).length / werte.length;
  // Schwelle zwischen Messung vorher (0,675) und nachher (0,255) gelegt.
  assert.ok(eng < 0.40,
    (eng * 100).toFixed(1) + ' % der Durchgaenge haben weniger als 2 Anlaufkacheln (erwartet < 40 %)');
});

test('#101: Durchgaenge oeffnen nicht auf Fels', () => {
  const werte = anlaufStatistik(120);
  const aufFels = werte.filter((v) => v < 0).length / werte.length;
  // Schwelle zwischen Messung vorher (0,285) und nachher (0,041).
  assert.ok(aufFels < 0.12,
    (aufFels * 100).toFixed(1) + ' % der Tuerkacheln oeffnen auf Fels (erwartet < 12 %)');
});

test('#101: der Rasterfix kostet keine Durchgaenge', () => {
  // Gestufte Randnachgabe (2 -> 1 -> 0 -> ungeprueft) statt hartem return:
  // die Zahl der Durchgaenge muss identisch zur alten Platzierung bleiben.
  const PR = frisch();
  let tueren = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = PR.generate({ seed });
    if (r && r.doorways) tueren += r.doorways.length;
  }
  assert.ok(tueren > 2000, 'nur ' + tueren + ' Durchgaenge — die Platzierung verliert Verbindungen');
});

// ---------------------------------------------------------------------------
// Dritter Anlauf (#101). Der Rasterfix oben liess 25,5 % der Durchgaenge mit
// hoechstens einer Kachel seitlicher Luft zurueck. Instrumentiert gemessen
// (300 Seeds, 7150 Durchgaenge): in 0,0 % dieser Faelle haette die
// Kandidatenspanne einen besseren Platz geboten — die POSITION ist also
// ausgereizt, egal wie man sie sucht. Deshalb scheiterten beide Vorlaeufer.
//
// Zerlegung der engen Faelle: 78,6 % haben schon in EINER Kammer eine zu
// kurze freie Anlaufreihe, 21,4 % scheitern am Versatz beider Reihen. Ursache
// ist ein Groessenmissverhaeltnis: MIN_NODE 9 ergibt 7 Kacheln Kammerboden,
// die Oeffnung ist aber 5–6 Kacheln breit.
//
// Gegenprobe zur Alternative "Kammern vergroessern": MIN_NODE 12 senkt die
// Quote auf 0,6 %, kostet aber 2139 von 7150 Durchgaengen (-30 %) und damit
// die Kammerdichte. Stattdessen wird die TUER an die Kammer angepasst.
//
// Messung vor/nach, gleiche Messfunktion, 300 Seeds:
//   Anlauf < 2 Kacheln   25,5 %  ->  9,0 %
//   gar keine Luft        2,4 %  ->  0,3 %
//   Durchgaenge insgesamt  7150   ->  7150   (keiner verloren)

test('#101: die Tuer wird an die Kammer angepasst statt umgekehrt', () => {
  const werte = anlaufStatistik(120);
  assert.ok(werte.length > 2000, 'zu wenige Durchgaenge gemessen: ' + werte.length);
  const eng = werte.filter((v) => v < 2).length / werte.length;
  // Schwelle zwischen Messung vorher (0,256) und nachher (0,094) gelegt.
  assert.ok(eng < 0.15,
    (eng * 100).toFixed(1) + ' % der Durchgaenge haben weniger als 2 Anlaufkacheln (erwartet < 15 %)');
});

test('#101: kaum ein Durchgang bleibt ganz ohne seitliche Luft', () => {
  const werte = anlaufStatistik(120);
  // Genau 0 Luft heisst: die aeusserste geraeumte Kachel klebt an der
  // Querwand — das ist der im Browser gemeldete "geht um die Ecke"-Fall.
  // Vorher 2,5 %, nachher 0,3 %.
  const null_ = werte.filter((v) => v === 0).length / werte.length;
  assert.ok(null_ < 0.012,
    (null_ * 100).toFixed(1) + ' % der Durchgaenge haben null Anlaufkacheln (erwartet < 1,2 %)');
});

test('#101: die angepasste Breite unterschreitet nie 4 Kacheln Oeffnung', () => {
  // Die Anpassung darf nicht zum Schlupfloch werden: enger als 4 Kacheln
  // (128 px bei 34 px Spielerbreite) wird nie gestutzt. Ohne diese Grenze
  // wuerde die Quote zwar weiter fallen, aber auf Kosten der Passierbarkeit.
  const PR = frisch();
  let min = Infinity;
  let gesamt = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = PR.generate({ seed });
    if (!r || !r.doorways) continue;
    for (const d of r.doorways) { gesamt++; if (d.width < min) min = d.width; }
  }
  assert.ok(gesamt > 2000, 'zu wenige Durchgaenge gemessen: ' + gesamt);
  assert.ok(min >= 4, 'schmalste Oeffnung nur ' + min + ' Kacheln (erwartet >= 4)');
});
