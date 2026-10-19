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

test("Der Zierboden '+' der TerracedHall ist Boden, keine Wandmasse", () => {
  // Galt alles ausser '.' als Wand, war die ganze obere Terrasse eine Masse
  // am Raumrand, und die Kammer landete mitten im Boden. Dort fand die
  // Begehbarkeit dann ihren einzigen Startplatz (Gesamtlauf-Flattern von
  // "Kammerschutt landet nie im Freiraum der Treppe").
  const vorlage = require('../js/roomTemplates/TerracedHall.json').layout.walls;
  assert.ok(vorlage.some((z) => z.indexOf('+') >= 0), 'die Vorlage hat keinen Zierboden mehr');
  for (let i = 0; i < 64; i++) {
    const g = vorlage.map((z) => z.slice());
    const r = H.stanzeKammer(g, () => i / 64);
    if (!r) continue;
    r.kammer.forEach((t) => {
      assert.strictEqual(vorlage[t.y][t.x], '#', 'Kammer bei ' + t.x + '/' + t.y + ' auf "' + vorlage[t.y][t.x] + '" gestanzt');
    });
  }
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

test('Die Kammer-Belohnung geht NICHT ueber eine Truhe', () => {
  // Eine Truhe schuettet beim Zerschlagen nur mit der Behaelter-Chance aus
  // (chest_medium 10 %, chest_large 15 %) — fuer einen Fund, den man erst
  // aufschlagen muss, ist das praktisch immer leer. Gemessen: 40 von 40
  // direkten Belohnungen gaben einen Gegenstand.
  const W = globalThis.window || (globalThis.window = {});
  const gespawnt = [];
  W.LootSystem = { rollItem: (a, iLevel, stufe) => ({ tier: stufe, iLevel: iLevel }) };
  W.spawnLoot = function (x, y, item) { gespawnt.push({ x, y, item }); };
  W.DUNGEON_DEPTH = 6;
  try {
    assert.strictEqual(H._belohnung({}, 100, 200), true);
    assert.strictEqual(gespawnt.length, 1);
    assert.ok(gespawnt[0].item, 'ein Gegenstand, keine Truhe');
    assert.ok(gespawnt[0].item.tier >= 1, 'mindestens magisch, nie gewoehnlich');
    // iLevel wie eine grosse Truhe: Tiefe + 8.
    assert.strictEqual(gespawnt[0].item.iLevel, 14);
  } finally {
    delete W.LootSystem; delete W.spawnLoot; delete W.DUNGEON_DEPTH;
  }
});

test('Ohne LootSystem faellt die Belohnung auf eine Truhe zurueck', () => {
  // Lieber eine Truhe als eine leere Kammer.
  const W = globalThis.window || (globalThis.window = {});
  const gespawnt = [];
  W.spawnLoot = function (x, y, item) { gespawnt.push(item); };
  try {
    assert.strictEqual(H._belohnung({}, 0, 0), true);
    assert.strictEqual(gespawnt.length, 1);
    assert.ok(String(gespawnt[0].type).indexOf('chest') === 0, 'Rueckfall ist eine Truhe');
  } finally { delete W.spawnLoot; }
});

test('Ein freistehender Wandklotz mitten im Raum wird nicht ausgehoehlt', () => {
  // GEMESSEN im Spiel: 2 von 5 Kammern lagen in einer freistehenden Wandinsel,
  // eine davon in nur 11 Wandkacheln — also einer duennen Schale um das Loch.
  // Der Spieler stand vor einem Geroellhaufen im offenen Raum.
  //
  // Die Pfeiler-Pruefung reichte nicht: sie sieht nur den unmittelbaren Ring
  // des 3x3-Blocks. In einem 5x5-Klotz hat der obere linke 3x3-Teilblock auf
  // drei Seiten Wand und faellt trotzdem nicht unter "Pfeiler".
  const g = [
    '###########',
    '#.........#',
    '#..#####..#',
    '#..#####..#',
    '#..#####..#',
    '#..#####..#',
    '#..#####..#',
    '#.........#',
    '###########',
  ];
  assert.strictEqual(H.stanzeKammer(g, () => 0), null,
    'in eine freistehende Insel darf keine Kammer');
});

test('An der durchgehenden Mauer wird weiterhin gestanzt', () => {
  // Gegenprobe: dieselbe Dicke, aber mit dem Raumrand verbunden. Ohne diesen
  // Test waere "gar nicht mehr stanzen" eine bestandene Loesung.
  const g = [
    '###########',
    '#.........#',
    '#.........#',
    '###########',
    '###########',
    '###########',
    '###########',
  ];
  const r = H.stanzeKammer(g, () => 0);
  assert.ok(r, 'an der Mauer muss es weiter gehen');
  r.kammer.forEach((t) => {
    assert.strictEqual(g[t.y][t.x], '.', 'Zelle ' + t.x + '/' + t.y + ' nicht ausgestanzt');
  });
});

// --- Vorpruefung VOR dem Stanzen (b474) -------------------------------------
//
// Gemeldet: "dunkle Bereiche, als ob das eine Kammer haette sein sollen, die
// es nicht an eine Mauer geschafft hat." Was sich am Raster pruefen laesst,
// wird jetzt geprueft, BEVOR ein Loch entsteht.

/** Ring um die Kammer ohne die Zugangsseite: alles, was nicht Wand ist. */
function ringOffen(g, r) {
  const xs = r.kammer.map((t) => t.x), ys = r.kammer.map((t) => t.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const m = r.mund, offen = [];
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
      const zugang = (m.x < x0 && x < x0) || (m.x > x1 && x > x1) || (m.y < y0 && y < y0) || (m.y > y1 && y > y1);
      if (!zugang && g[y][x] !== '#') offen.push(x + '/' + y);
    }
  }
  return offen;
}

test('Eine Kammer, die diagonal an Boden stoesst, wird nicht gestanzt', () => {
  // Zugang von unten. Der Block x=2..4 haette oben links (1/1) Boden an der
  // Ecke — er stuende halb frei. x=3..5 ist sauber eingemauert.
  const vorlage = [
    '#########',
    '#.#######',
    '#########',
    '#########',
    '#########',
    '#.......#',
    '#.......#',
    '#########',
  ];
  let gestanzt = 0;
  for (let i = 0; i < 10; i++) {
    const g = vorlage.slice();
    const r = H.stanzeKammer(g, () => i / 10);
    if (!r) continue;
    gestanzt++;
    assert.deepStrictEqual(ringOffen(vorlage, r), [], 'Kammer bei ' + JSON.stringify(r.kammer[0]));
  }
  assert.ok(gestanzt > 0, 'die saubere Stelle muss bleiben');
});

test('Ohne Vorplatz vor dem Mund wird nicht gestanzt', () => {
  // Der Boden vor der Wand ist nur EINE Kachel tief: die Figur (56 px hoch)
  // kaeme nie bis an den Mund heran.
  const flach = [
    '#########',
    '#########',
    '#########',
    '#########',
    '#..###..#',
    '#########',
  ];
  assert.strictEqual(H.stanzeKammer(flach.slice(), () => 0), null);
  // Gegenprobe: eine Kachel mehr Boden davor, und es geht.
  const tief = [
    '#########',
    '#########',
    '#########',
    '#########',
    '#..###..#',
    '#..###..#',
    '#########',
  ];
  assert.ok(H.stanzeKammer(tief.slice(), () => 0), 'mit Vorplatz muss es gehen');
});

test('Der Vorplatz muss vom Startpunkt aus erreichbar sein', () => {
  // Zwei Haelften, durch eine Mauer getrennt; der Start liegt links.
  const vorlage = [
    '###########',
    '#....#....#',
    '#....#....#',
    '###########',
    '###########',
    '###########',
    '###########',
  ];
  let rechts = 0;
  for (let i = 0; i < 20; i++) {
    const r = H.stanzeKammer(vorlage.slice(), () => i / 20, { start: { x: 1, y: 1 } });
    assert.ok(r, 'links ist Platz');
    // Der Mund liegt links; die Kammer darf bis unter die Trennmauer reichen,
    // aber nicht in die rechte Haelfte.
    assert.ok(r.mund.x <= 4, 'Mund in der unerreichbaren Haelfte: ' + JSON.stringify(r.mund));
    r.kammer.forEach((t) => assert.ok(t.x <= 5, 'Kammer unter der rechten Haelfte: ' + t.x + '/' + t.y));
    const ohne = H.stanzeKammer(vorlage.slice(), () => i / 20);
    if (ohne && ohne.kammer.some((t) => t.x >= 6)) rechts++;
  }
  assert.ok(rechts > 0, 'Gegenprobe: ohne Startpunkt gibt es auch rechts Kammern');
});

test('Zurueckmauern stellt das Raster exakt her', () => {
  const vorlage = [
    '#########',
    '#.......#',
    '#.......#',
    '#########',
    '#########',
    '#########',
    '#########',
  ];
  [false, true].forEach((alsFeld) => {
    const g = alsFeld ? vorlage.map((z) => z.split('')) : vorlage.slice();
    const r = H.stanzeKammer(g, () => 0);
    assert.ok(r, 'es gibt einen Platz');
    assert.strictEqual(r.vorher.length, r.kammer.length, 'das Original jeder Zelle ist gemerkt');
    assert.ok(r.kammer.every((t) => g[t.y][t.x] === '.'), 'ausgestanzt');
    assert.strictEqual(H.mauereKammerZu({ _minimapWallsGrid: g }, r, 0, 0, 32), true);
    const zurueck = alsFeld ? g.map((z) => z.join('')) : g;
    assert.deepStrictEqual(zurueck, vorlage, alsFeld ? 'Feld-Zeilen' : 'String-Zeilen');
  });
});
