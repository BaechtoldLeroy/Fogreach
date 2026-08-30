// tests/botWegpunktSprung.test.js — Der uebersprungene Wegpunkt darf den
// Aufgeben-Zaehler des Spieltest-Bots nicht scharf halten.
//
// MESSUNG, die dahinter steht: ueber 13 Stillstaende eines Dauerlaufs stand
// der Planfehler-Zaehler JEDES Mal auf 0 und die Verfolgung nie ueber 28 —
// bei einer Aufgeben-Schwelle von 50 Runden, waehrend der Bot 3000 bis 6400
// Runden feststeckte. Die Aufgabe-Spur eines weiteren Stillstands zeigte
// 7 von 7 Ruecksetzungen aus dem Wegpunkt-Zweig, 0 aus Zielwechseln.
//
// URSACHE: Der Sprung ueber einen unerreichbaren Wegpunkt erhoehte notwegIdx.
// Der Zielblock liest `notwegIdx > besterWegpunkt` als Fortschritt entlang
// des Weges und setzt verfolgtRunden auf 0. Da der Sprung nach 20 Runden
// feuert und der Ausstieg erst bei 50 greift, kam der Ausstieg NIE zustande.
// Das ist keine Wahrscheinlichkeit, sondern Arithmetik: 20 < 50.
//
// Die Regel steht ZWEIMAL im Bot (Treppen- und Verfolgungs-Zweig). Deshalb
// prueft dieser Test beide Stellen und schlaegt an, wenn eine dritte Kopie
// dazukommt, die niemand mitgezogen hat.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = path.join(__dirname, '..', 'tools', 'headless', 'index.js');

/** Kommentare entfernen — sonst liest der Test seine eigene Begruendung als
 *  Beleg. Genau dieser Fehlalarm ist hier schon einmal passiert. */
function ohneKommentare(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const CODE = ohneKommentare(fs.readFileSync(QUELLE, 'utf8'));

test('Wegpunkt-Sprung: beide Stellen zaehlen den Sprung nicht als Fortschritt', () => {
  const stellen = [];
  let ab = 0;
  for (;;) {
    const i = CODE.indexOf('wpZaeh >= 20', ab);
    if (i < 0) break;
    stellen.push(i);
    ab = i + 1;
  }
  assert.strictEqual(stellen.length, 2,
    'erwartet: genau 2 Wegpunkt-Sprungstellen, gefunden: ' + stellen.length);

  stellen.forEach((i, n) => {
    const block = CODE.slice(i, i + 400);
    assert.ok(block.includes('notwegIdx++'),
      'Stelle ' + (n + 1) + ': kein notwegIdx++ im Sprungblock');
    assert.ok(/besterWegpunkt\s*=\s*Math\.max\(\s*besterWegpunkt\s*,\s*notwegIdx\s*\)/.test(block),
      'Stelle ' + (n + 1) + ': der Sprung hebt besterWegpunkt nicht mit — '
      + 'damit gilt er als Fortschritt und setzt den Aufgeben-Zaehler zurueck');
  });
});

test('Wegpunkt-Sprung: die Schwellen stehen noch im gemessenen Verhaeltnis', () => {
  // Der Sprung (20) muss kleiner bleiben als das Aufgeben (50), sonst greift
  // die Begruendung oben nicht mehr — und wer die Zahlen dreht, soll hier
  // darueber stolpern statt im naechsten Dauerlauf.
  assert.ok(CODE.includes('wpZaeh >= 20'), 'Sprung-Schwelle nicht mehr 20');
  const m = CODE.match(/gibAufNach\s*=\s*opts\.gibAufNach\s*\|\|\s*(\d+)/);
  assert.ok(m, 'Aufgeben-Schwelle nicht gefunden');
  assert.ok(Number(m[1]) > 20,
    'Aufgeben-Schwelle (' + m[1] + ') liegt nicht mehr ueber der Sprung-Schwelle (20)');
});
