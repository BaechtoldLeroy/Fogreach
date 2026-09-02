// tests/hiddenFinds.test.js — Funde abseits des Wegs (#113).
//
// Der Kern des Issues ist nicht das Objekt, sondern WO es liegt: auf dem Weg
// zur Treppe ist es kein Fund, sondern nur Beute. Genau diese Entscheidung
// wird hier geprueft — rein, ohne Szene.

const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../js/hiddenFinds.js');

const EINGANG = { x: 0, y: 0 };
const AUSGANG = { x: 1000, y: 0 };   // Weg laeuft waagerecht

test('Abstand zaehlt zur STRECKE, nicht zu ihren Enden', () => {
  // Der gefaehrliche Denkfehler: ein Punkt in der Mitte zwischen Tuer und
  // Treppe ist von beiden weit weg — und liegt trotzdem mitten auf dem Weg.
  assert.strictEqual(H.abstandZurStrecke(500, 0, 0, 0, 1000, 0), 0);
  assert.strictEqual(H.abstandZurStrecke(500, 300, 0, 0, 1000, 0), 300);
});

test('Faellt das Lot neben die Strecke, zaehlt der naehere Endpunkt', () => {
  // Punkt hinter dem Ausgang: nicht "0, weil auf der Geraden".
  assert.strictEqual(H.abstandZurStrecke(1200, 0, 0, 0, 1000, 0), 200);
  assert.strictEqual(H.abstandZurStrecke(-150, 0, 0, 0, 1000, 0), 150);
});

test('Sind Eingang und Ausgang derselbe Punkt, bleibt es der reine Abstand', () => {
  assert.strictEqual(H.abstandZurStrecke(0, 100, 400, 400, 400, 400),
    Math.hypot(400, 300));
});

test('Punkte auf dem Weg kommen gar nicht in Frage', () => {
  const kandidaten = [
    { x: 200, y: 0 },    // mitten drauf
    { x: 500, y: 40 },   // knapp daneben
    { x: 700, y: 150 },  // knapp unter der Schwelle
  ];
  assert.deepStrictEqual(H.waehleAbseits(kandidaten, EINGANG, AUSGANG, 2), []);
});

test('Der am weitesten abseits liegende Punkt gewinnt', () => {
  const kandidaten = [
    { x: 500, y: 200 },
    { x: 500, y: 600 },   // am weitesten weg
    { x: 500, y: 300 },
  ];
  const g = H.waehleAbseits(kandidaten, EINGANG, AUSGANG, 1);
  assert.deepStrictEqual(g, [{ x: 500, y: 600 }]);
});

test('Zwei Funde landen nicht nebeneinander', () => {
  // 600 und 620 liegen beide weit abseits, aber 20 px auseinander — das waere
  // ein Fund, kein zweiter Grund abzubiegen.
  const kandidaten = [
    { x: 500, y: 600 },
    { x: 520, y: 620 },
    { x: 500, y: -400 },   // andere Seite, echter zweiter Ort
  ];
  const g = H.waehleAbseits(kandidaten, EINGANG, AUSGANG, 2);
  assert.strictEqual(g.length, 2);
  assert.ok(Math.hypot(g[0].x - g[1].x, g[0].y - g[1].y) >= 240,
    'die beiden Funde muessen auseinanderliegen');
});

test('Lieber weniger Funde als zwei am selben Fleck', () => {
  const kandidaten = [{ x: 500, y: 600 }, { x: 510, y: 610 }];
  assert.strictEqual(H.waehleAbseits(kandidaten, EINGANG, AUSGANG, 2).length, 1);
});

test('Kaputte Eingaben liefern nichts, statt zu werfen', () => {
  assert.deepStrictEqual(H.waehleAbseits(null, EINGANG, AUSGANG, 1), []);
  assert.deepStrictEqual(H.waehleAbseits([], EINGANG, AUSGANG, 1), []);
  assert.deepStrictEqual(H.waehleAbseits([{ x: 500, y: 600 }], EINGANG, AUSGANG, 0), []);
  assert.deepStrictEqual(
    H.waehleAbseits([null, { x: 'a', y: 1 }, { x: 500, y: 600 }], EINGANG, AUSGANG, 2),
    [{ x: 500, y: 600 }]);
  assert.strictEqual(H.abseitsWert(null, EINGANG, AUSGANG), 0);
});

test('Nicht jeder Raum bekommt einen Fund', () => {
  assert.strictEqual(H.anzahlFuerRaum(() => 0.01), 1, 'unter der Chance');
  assert.strictEqual(H.anzahlFuerRaum(() => 0.99), 0, 'darueber');
  // Und hoechstens einer: Erkundung soll ein Angebot bleiben, keine Pflicht.
  assert.ok(H.CHANCE < 0.5, 'die Mehrheit der Raeume bleibt ohne Fund');
});

test('Die Chance laesst sich nachjustieren, ohne den Code anzufassen', () => {
  // Am laufenden Spiel gemessen: nach dem Wuerfel muss noch ein Platz weit
  // genug abseits gefunden werden (9 von 12 Raeumen). Wer die Rate nachzieht,
  // dreht an CHANCE — also muss anzahlFuerRaum den EXPORTIERTEN Wert lesen.
  const echt = H.CHANCE;
  try {
    H.CHANCE = 0;
    assert.strictEqual(H.anzahlFuerRaum(() => 0.0001), 0, 'bei 0 nie ein Fund');
    H.CHANCE = 1;
    assert.strictEqual(H.anzahlFuerRaum(() => 0.9999), 1, 'bei 1 immer ein Fund');
  } finally {
    H.CHANCE = echt;
  }
});
