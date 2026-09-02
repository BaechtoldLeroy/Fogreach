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

// --- Was der Fund hergibt --------------------------------------------------

test('Die Beute-Verteilung folgt ihren Gewichten', () => {
  // 45/30/20/5 — Material am haeufigsten, Wissensfragment selten.
  const grenzen = [
    [0.00, 'material'], [0.44, 'material'],
    [0.46, 'trank'],    [0.74, 'trank'],
    [0.76, 'item'],     [0.94, 'item'],
    [0.96, 'fragment'], [0.99, 'fragment'],
  ];
  grenzen.forEach(([r, erwartet]) => {
    assert.strictEqual(H.beuteArt(() => r), erwartet, 'bei r=' + r);
  });
});

test('Ein garantierter Ausruestungsfund waere zu viel', () => {
  // Wer in jedem Fund Ausruestung findet, MUSS absuchen. Material und Trank
  // zusammen tragen die Mehrheit.
  let material = 0;
  for (let i = 0; i < 1000; i++) {
    const a = H.beuteArt(() => i / 1000);
    if (a === 'material' || a === 'trank') material++;
  }
  assert.ok(material > 700, 'Alltagsbeute ueberwiegt (gemessen ' + material + '/1000)');
});

// --- Welche Fundart steht im Raum? -----------------------------------------

test('Die Fundarten folgen ihren Gewichten', () => {
  // 45/30/25 — die Nische bleibt der Regelfall, Lager und Falle geben dem
  // Absuchen zwei ANDERE Antworten als "noch etwas Beute".
  assert.strictEqual(H.fundArt(() => 0.00), 'nische');
  assert.strictEqual(H.fundArt(() => 0.44), 'nische');
  assert.strictEqual(H.fundArt(() => 0.46), 'lager');
  assert.strictEqual(H.fundArt(() => 0.74), 'lager');
  assert.strictEqual(H.fundArt(() => 0.76), 'falle');
  assert.strictEqual(H.fundArt(() => 0.99), 'falle');
});

test('Keine Art dominiert das Absuchen', () => {
  const zaehl = { nische: 0, lager: 0, falle: 0 };
  for (let i = 0; i < 1000; i++) zaehl[H.fundArt(() => i / 1000)]++;
  Object.keys(zaehl).forEach((k) => {
    assert.ok(zaehl[k] > 150, k + ' kommt zu selten (' + zaehl[k] + '/1000)');
    assert.ok(zaehl[k] < 550, k + ' kommt zu oft (' + zaehl[k] + '/1000)');
  });
});

test('Die Rast gibt einen spuerbaren, aber begrenzten Anteil zurueck', () => {
  // Zu wenig ist keine Entscheidung, zu viel ersetzt den Trankvorrat.
  assert.ok(H.LAGER_HEILUNG >= 0.15, 'unter 15 % merkt es niemand');
  assert.ok(H.LAGER_HEILUNG <= 0.4, 'ueber 40 % waere ein Volltrank umsonst');
});

test('Die Falle schickt eine Handvoll Gegner, keinen Ansturm', () => {
  // Erkunden soll ein Einsatz sein, keine Bestrafung.
  assert.ok(H.FALLE_GEGNER >= 2 && H.FALLE_GEGNER <= 5,
    'gemessen ' + H.FALLE_GEGNER);
});

test('Ohne Szene stellt keine Art etwas hin, statt zu werfen', () => {
  ['spawneNische', 'spawneLager', 'spawneFalle'].forEach((fn) => {
    assert.strictEqual(H[fn](null, { x: 0, y: 0 }), false, fn);
    assert.strictEqual(H[fn]({}, null), false, fn + ' ohne Platz');
  });
});

// --- Verschuetteter Durchgang: die Kammer ----------------------------------
//
// Das Wandraster besteht aus ZEICHEN in STRING-Zeilen ('#' Wand, '.' Boden,
// 'P' Start). Der erste Entwurf ging von Zahlen in Feldern aus: er hielt jeden
// Boden fuer Wand, konnte nicht in Strings schreiben, und seine Eingangspruefung
// verwarf String-Zeilen kommentarlos. Diese Tests halten das Format fest.

test('Eine Nische in dicker Wand wird gestanzt', () => {
  const g = ['###########', '#.........#', '#.........#',
             '###########', '###########', '###########', '###########'];
  const r = H.stanzeKammer(g, () => 0);
  assert.ok(r, 'es gibt hier einen Platz');
  assert.strictEqual(r.kammer.length, H.KAMMER_B * H.KAMMER_H);
  // Die Zellen sind wirklich Boden geworden — in den STRING-Zeilen.
  r.kammer.forEach((t) => {
    assert.strictEqual(g[t.y][t.x], '.', 'Zelle ' + t.x + '/' + t.y + ' nicht ausgestanzt');
  });
  // Der Mund liegt ausserhalb der Kammer und ist Boden.
  assert.strictEqual(g[r.mund.y][r.mund.x], '.');
  assert.ok(!r.kammer.some((t) => t.x === r.mund.x && t.y === r.mund.y),
    'der Mund gehoert NICHT zur Kammer');
});

test('Ein freistehender Pfeiler wird nicht ausgehoehlt', () => {
  // Boden auf drei Seiten: das waere keine Nische, sondern ein Loch mitten im
  // Raum — und mit zwei Zugaengen eine Abkuerzung statt eines Durchgangs.
  const g = ['###########', '#.........#', '#.........#',
             '#..###....#', '#..###....#', '#..###....#', '###########'];
  assert.strictEqual(H.stanzeKammer(g, () => 0), null);
});

test('Massive Wand ohne Zugang bleibt massiv', () => {
  const g = ['######', '######', '######', '######', '######'];
  assert.strictEqual(H.stanzeKammer(g, () => 0), null);
});

test("'P' zaehlt als Boden, nicht als Wand", () => {
  // Der Startpunkt steht als eigenes Zeichen im Raster. Wer ihn fuer Wand
  // haelt, stanzt Kammern in den Eingangsbereich.
  const mitP = ['###########', '#PPPPPPPPP#', '#.........#',
                '###########', '###########', '###########', '###########'];
  const r = H.stanzeKammer(mitP, () => 0);
  assert.ok(r, 'unter dem Boden ist trotzdem eine Nische moeglich');
  assert.ok(!r.kammer.some((t) => t.y <= 1), 'nicht in die P-Zeile stanzen');
});

test('Kaputte Raster liefern null, statt zu werfen', () => {
  [null, [], [[]], ['']].forEach((g) => {
    assert.strictEqual(H.stanzeKammer(g, () => 0), null, JSON.stringify(g));
  });
});

test('Der Schutt kommt in die Kammerkachel am Mund, nicht auf den Mund', () => {
  const kammer = [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 4 }];
  const eingang = H.kammerEingang(kammer, { x: 3, y: 3 });
  assert.deepStrictEqual(eingang, { x: 4, y: 3 });
  assert.strictEqual(H.kammerEingang([], { x: 0, y: 0 }), null);
  assert.strictEqual(H.kammerEingang(kammer, null), null);
});

test('Eine Kammer ist seltener als ein gewoehnlicher Fund', () => {
  // Sie veraendert die Raumgeometrie — in jedem zweiten Raum ein zugeschuetteter
  // Gang liesse die Karte beliebig wirken.
  assert.ok(H.DURCHGANG_CHANCE < H.CHANCE,
    'Durchgang ' + H.DURCHGANG_CHANCE + ' vs Fund ' + H.CHANCE);
  assert.strictEqual(H.willDurchgang(() => 0.001), true);
  assert.strictEqual(H.willDurchgang(() => 0.999), false);
});

test('Die Belohnung hinter dem Schutt ist garantiert, nicht gewuerfelt', () => {
  // spawnLoot ohne Gegenstand wuerfelt nur eine Drop-Chance — gemessen blieb
  // die Kammer damit leer. Wer Schutt wegschlaegt, darf nicht leer ausgehen.
  for (let i = 0; i < 50; i++) {
    const t = H._truhe(true);
    assert.ok(t && typeof t.type === 'string' && t.type.indexOf('chest') === 0,
      'immer eine Truhe, bekam ' + JSON.stringify(t));
  }
});
