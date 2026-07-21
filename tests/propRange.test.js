// Unit tests fuer _propInRange (js/player.js) — die Reichweiten-Pruefung, mit
// der Skills zerstoerbare Props erfassen.
//
// Hintergrund: gemessen wurde frueher Mitte-zu-Mitte. Beim Ansturm (Radius 34)
// blockiert die Kiste den Dash, ihr Mittelpunkt liegt dann aber schon ~33-40px
// entfernt (halbe Spielerbreite + halbe Kistenbreite) — der Spieler rammte sie,
// ohne sie zu zerbrechen. Jetzt zaehlt die OBERFLAECHE.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

// Prop mit Groesse. 32x32 ist die typische Kisten-/Fassgroesse.
function prop(x, y, w = 32, h = 32) {
  return { x, y, displayWidth: w, displayHeight: h };
}

let inRange = null;
beforeEach(() => {
  if (!inRange) {
    if (!globalThis.window) globalThis.window = {};
    // Eigene, abhaengigkeitsfreie Datei — genau deshalb reicht hier ein Laden
    // ohne jeden Phaser-Stub.
    loadGameModule('js/propRange.js');
    inRange = globalThis.window._propInRange;
  }
});

test('_propInRange ist exportiert', () => {
  assert.strictEqual(typeof inRange, 'function');
});

// --- Der Ansturm-Fall -------------------------------------------------------

test('Ansturm: gerammte Kiste zaehlt als getroffen', () => {
  // Spieler (Breite ~34) presst sich an eine 32er-Kiste: Mittelpunkte liegen
  // ~33px auseinander. Mit Ansturm-Radius 34 war das frueher Grenzfall.
  const kiste = prop(33, 0);
  assert.strictEqual(inRange(kiste, 0, 0, 34), true);
});

test('Ansturm: auch bei etwas groesserem Abstand noch getroffen', () => {
  // Groessere Props (48px) stossen frueher an — Mittelpunkt entsprechend weiter.
  const fass = prop(45, 0, 48, 48);
  assert.strictEqual(inRange(fass, 0, 0, 34), true);
});

test('Mitte-zu-Mitte allein haette hier verfehlt (Regression)', () => {
  // Genau der alte Fehler: Mittelpunkt 40 > Radius 34, Oberflaeche aber bei 24.
  const kiste = prop(40, 0);
  assert.ok(Math.hypot(40, 0) > 34, 'Mittelpunkt liegt ausserhalb');
  assert.strictEqual(inRange(kiste, 0, 0, 34), true, 'Oberflaeche liegt drin');
});

// --- Grenzen ----------------------------------------------------------------

test('weit entferntes Prop bleibt unberuehrt', () => {
  assert.strictEqual(inRange(prop(300, 0), 0, 0, 34), false);
});

test('Reichweite wird nicht quer durch den Raum aufgeblasen', () => {
  // Ein 32er-Prop erweitert die Reichweite um hoechstens 16 — nicht mehr.
  const weit = prop(51, 0);
  assert.strictEqual(inRange(weit, 0, 0, 34), false, '51-16=35 > 34');
});

test('exakt auf der Kante zaehlt als getroffen', () => {
  const kante = prop(50, 0);
  assert.strictEqual(inRange(kante, 0, 0, 34), true, '50-16=34 == 34');
});

test('diagonal wird korrekt gemessen', () => {
  // 3-4-5-Dreieck: Abstand 50, minus 16 Halbbreite = 34.
  assert.strictEqual(inRange(prop(30, 40), 0, 0, 34), true);
  assert.strictEqual(inRange(prop(30, 40), 0, 0, 33), false);
});

test('verschobenes Zentrum (Hammer-Einschlag) wird beruecksichtigt', () => {
  // Der Hammer misst vom Einschlagpunkt, nicht vom Spieler.
  const kiste = prop(200, 0);
  assert.strictEqual(inRange(kiste, 0, 0, 34), false, 'vom Spieler aus zu weit');
  assert.strictEqual(inRange(kiste, 190, 0, 34), true, 'vom Einschlag aus in Reichweite');
});

// --- Robustheit -------------------------------------------------------------

test('Prop ohne Groessenangabe faellt auf Mitte-zu-Mitte zurueck', () => {
  const ohne = { x: 30, y: 0 };
  assert.strictEqual(inRange(ohne, 0, 0, 34), true);
  assert.strictEqual(inRange(ohne, 0, 0, 20), false);
});

test('fehlendes Prop wirft nicht', () => {
  assert.strictEqual(inRange(null, 0, 0, 34), false);
  assert.strictEqual(inRange(undefined, 0, 0, 34), false);
});
