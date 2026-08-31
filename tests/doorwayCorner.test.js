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

test('Durchgang: die Suchspanne kommt aus dem Raster, nicht aus den BSP-Boxen', () => {
  // Der erste Anlauf (#101) stellte die PRUEFUNG auf das Raster um, liess die
  // SUCHSPANNE aber bei den BSP-Bounding-Boxes. Gemessen ueber 300 Seeds blieben
  // dadurch 1824 von 7150 Durchgaengen mit hoechstens einer Kachel seitlicher
  // Luft — und 1643 davon (90.1 %) haetten an derselben Wand einen besseren
  // Platz gehabt. Die Boxen waren die Fessel: ihre Kinder sind oft selbst
  // wieder geteilt, die echte Kammer liegt also irgendwo INNERHALB der Box.
  //
  // Nach der Umstellung: 2.7 % zu eng, davon 3.6 % vermeidbar.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'proceduralRooms.js'), 'utf8');

  // Der Rueckfall darf NICHT mitwandern — ohne Pruefung geraten wird weiterhin
  // nur in der BSP-Spanne, sonst landet ein Durchgang am Rasterrand.
  assert.ok(/waehleDurchgang\(rng, von, bis, doorWidth, frei, notVon, notBis\)/.test(quelle),
    'waehleDurchgang nimmt keine getrennte Rueckfallspanne entgegen');
  assert.ok(quelle.includes('rv + Math.floor(rng() * (rb - rv + 1))'),
    'der Rueckfall raet nicht mehr innerhalb der BSP-Spanne');

  // Beide Achsen muessen ueber das Raster suchen.
  assert.ok(/waehleDurchgang\(rng, 1, Math\.max\(1, breiteH - doorWidth - 2\),/.test(quelle),
    'die waagerechte Achse sucht weiterhin nur in der BSP-Spanne');
  assert.ok(/waehleDurchgang\(rng, 1, Math\.max\(1, hoeheV - doorWidth - 2\),/.test(quelle),
    'die senkrechte Achse sucht weiterhin nur in der BSP-Spanne');
});

test('Durchgang: seitliche Luft ueber 300 Seeds', () => {
  // Die eigentliche Zusicherung — gemessen am erzeugten Raster, nicht am Text.
  const PR = globalThis.window && globalThis.window.ProceduralRooms;
  assert.ok(PR && typeof PR.generate === 'function', 'ProceduralRooms nicht geladen');
  const frei = (w, x, y) => {
    const z = w[y];
    return z !== undefined && z[x] !== undefined && z[x] !== '#';
  };

  let tueren = 0; let eng = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = PR.generate({ seed });
    if (!r || !r.layout || !r.doorways) continue;
    const w = r.layout.walls;
    r.doorways.forEach((d) => {
      tueren++;
      const laengs = d.orientation === 'horizontal' ? [1, 0] : [0, 1];
      const quer = d.orientation === 'horizontal' ? [0, 1] : [1, 0];
      const halb = (d.width - 1) / 2;
      let minLuft = Infinity;
      [-1.5, 1.5].forEach((o) => {
        [-1, 1].forEach((s) => {
          let k = 0;
          while (k < 12) {
            const ax = Math.round(d.x + quer[0] * o + laengs[0] * (halb + 1 + k) * s);
            const ay = Math.round(d.y + quer[1] * o + laengs[1] * (halb + 1 + k) * s);
            if (!frei(w, ax, ay)) break;
            k++;
          }
          minLuft = Math.min(minLuft, k);
        });
      });
      if (minLuft <= 1) eng++;
    });
  }

  assert.ok(tueren > 1000, 'zu wenige Durchgaenge gemessen: ' + tueren);
  const quote = eng / tueren;
  // Vor der Umstellung: 25.5 %. Gemessen danach: 2.7 %. Die Schwelle liegt
  // bewusst bei 8 % — knapp genug, um eine Rueckkehr zur BSP-Spanne zu fangen,
  // weit genug, um bei geaenderten Raumvorlagen nicht grundlos zu reissen.
  assert.ok(quote < 0.08,
    'zu enge Durchgaenge: ' + (quote * 100).toFixed(1) + ' % von ' + tueren
    + ' — vor der Umstellung waren es 25.5 %');
});
