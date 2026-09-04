// tests/kettenschloss.test.js — Das Kettenschloss-Minispiel (#71).
//
// Warum kein Kartenspiel: Blackjack und Roulette waeren generisches
// Taverneninventar. Die Stadt heisst nach ihren Ketten — ein verkettetes
// Gitter aufzubrechen kommt aus dem Stoff des Spiels.
//
// ZWEITE FASSUNG. Die erste liess einen Zeiger laufen und war beides: kaputt
// (der Zeiger stand still, weil er an der angehaltenen Spieluhr hing) und
// duenn (eine Achse, ein Knopf, keine Entscheidung). Jetzt wird das Schloss
// abgetastet: der Widerstands-Anzeiger sagt, wie nah der Stift ist, aber
// seine feinste Stufe ist BREITER als die Trefferzone.
//
// Geprueft wird die Rechnerei: sie ist der Teil, der balanciert werden muss.
// Die Oberflaeche selbst ist am laufenden Spiel gemessen.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
loadGameModule('js/kettenschloss.js');
const K = W.Kettenschloss;

test('Die Stiftzahl waechst mit der Tiefe und bleibt im Rahmen', () => {
  // Drei sind schnell genug, dass es nicht zaeh wird; mehr als fuenf waere
  // mitten im Dungeon eine Geduldsprobe.
  assert.strictEqual(K.stifteFuerTiefe(1), 3);
  assert.strictEqual(K.stifteFuerTiefe(8), 4);
  assert.strictEqual(K.stifteFuerTiefe(16), 5);
  assert.strictEqual(K.stifteFuerTiefe(40), 5, 'gedeckelt');
  assert.strictEqual(K.stifteFuerTiefe(0), 3, 'kaputte Eingabe faellt auf das Minimum');
});

test('Die Trefferzone wird von Stift zu Stift enger', () => {
  // Die Spannung soll steigen, nicht am Anfang stehen.
  const n = 5;
  let vorher = Infinity;
  for (let i = 0; i < n; i++) {
    const t = K.toleranz(i, n);
    assert.ok(t < vorher, 'Stift ' + i + ' ist nicht enger als der vorige');
    vorher = t;
  }
  assert.ok(Math.abs(K.toleranz(0, n) - K.TOLERANZ_START) < 1e-9, 'erster Stift');
  assert.ok(Math.abs(K.toleranz(n - 1, n) - K.TOLERANZ_ENDE) < 1e-9, 'letzter Stift');
});

test('Die feinste Anzeigestufe ist BREITER als die Trefferzone', () => {
  // Das ist die Stellschraube des ganzen Spiels. Waeren beide gleich breit,
  // hiesse "es greift" dasselbe wie "Treffer" — dann bestuende das Koennen
  // im Warten und das Spiel waere wieder so dumm wie die erste Fassung.
  assert.ok(K.STUFE_FAKTOR > 1.5,
    'zu knapp: blindes Zugreifen waere ein sicherer Treffer');

  const tol = 0.03;
  const ziel = 0.5;
  // Genau am Rand der greifenden Stufe: es greift, trifft aber nicht.
  const randInnen = ziel + tol * (K.STUFE_FAKTOR - 0.05);
  assert.strictEqual(K.widerstandStufe(randInnen, ziel, tol), 5, 'greift noch');
  assert.strictEqual(K.istTreffer(randInnen, ziel, tol), false, 'trifft aber nicht');
});

test('Blindes Zugreifen im greifenden Bereich hat eine mittlere Chance', () => {
  // Weder geschenkt noch aussichtslos: wer sofort zupackt, sobald es greift,
  // soll ungefaehr zwei von fuenf Versuchen schaffen. Sonst kippt das Spiel
  // entweder in Geduld (immer Treffer) oder in Frust (nie).
  const tol = 0.03, ziel = 0.5;
  let greift = 0, trifft = 0;
  for (let i = 0; i <= 2000; i++) {
    const x = i / 2000;                       // die ganze Leiste abfahren
    if (K.widerstandStufe(x, ziel, tol) < 5) continue;
    greift++;
    if (K.istTreffer(x, ziel, tol)) trifft++;
  }
  const quote = trifft / greift;
  assert.ok(quote > 0.3 && quote < 0.55, 'Trefferquote blind: ' + quote.toFixed(2));
});

test('Der Widerstand steigt streng, je naeher man kommt', () => {
  // Sonst waere die Rueckmeldung nicht lesbar: man muss aus zwei Messungen
  // schliessen koennen, in welche Richtung es besser wird.
  const tol = 0.03, ziel = 0.5;
  let vorher = -1;
  for (const abstand of [0.9, 0.45, 0.25, 0.13, 0.06, 0.0]) {
    const s = K.widerstandStufe(ziel + abstand, ziel, tol);
    assert.ok(s >= vorher, 'Stufe faellt bei Abstand ' + abstand + ': ' + s);
    vorher = s;
  }
  assert.strictEqual(K.widerstandStufe(ziel, ziel, tol), 5, 'auf dem Stift');
  assert.strictEqual(K.widerstandStufe(0, 1, 0.02), 0, 'am anderen Ende: nichts');
});

test('Der Widerstand ist symmetrisch — die Richtung verraet nichts', () => {
  const tol = 0.03, ziel = 0.4;
  for (const d of [0.02, 0.08, 0.2, 0.5]) {
    assert.strictEqual(K.widerstandStufe(ziel - d, ziel, tol),
                       K.widerstandStufe(ziel + d, ziel, tol), 'Abstand ' + d);
  }
});

test('Der Stift sitzt nie so nah am Rand, dass der Anschlag ihn verraet', () => {
  // Sonst waere er durch blosses Anfahren des Endes zu finden.
  for (let i = 0; i < 2000; i++) {
    const tol = K.toleranz(i % 5, 5);
    const z = K.zielPosition(tol, Math.random);
    assert.ok(z - tol >= -1e-9, 'links raus: ' + z);
    assert.ok(z + tol <= 1 + 1e-9, 'rechts raus: ' + z);
  }
});

test('Der Dietrich bleibt auf der Leiste und laeuft mit festem Tempo', () => {
  // Festes Tempo ist Absicht: wuerde er in der Naehe langsamer, verriete
  // schon die Bewegung die Stelle.
  assert.ok(Math.abs(K.dietrichSchritt(0.5, 1, 1000) - (0.5 + K.TEMPO)) < 1e-9);
  assert.ok(Math.abs(K.dietrichSchritt(0.5, -1, 1000) - (0.5 - K.TEMPO)) < 1e-9);
  assert.strictEqual(K.dietrichSchritt(0.5, 0, 1000), 0.5, 'ohne Taste kein Schritt');
  assert.strictEqual(K.dietrichSchritt(0.98, 1, 1000), 1, 'rechts gedeckelt');
  assert.strictEqual(K.dietrichSchritt(0.02, -1, 1000), 0, 'links gedeckelt');
  assert.strictEqual(K.dietrichSchritt(0.5, 1, -50), 0.5, 'negative Zeit bewegt nicht');
});

test('Die Frist reicht zum Sondieren, aber nicht fuer beliebig viel', () => {
  // Ohne Uhr waere Sondieren gratis und jeder Stift sicher.
  const drei = K.gesamtzeit(3);
  const fuenf = K.gesamtzeit(5);
  assert.ok(fuenf > drei, 'mehr Stifte, mehr Zeit');
  // Eine volle Leiste kostet 1/TEMPO Sekunden. Pro Stift muss mindestens
  // rund ein Durchgang drin sein, sonst ist es Rennen statt Tasten.
  const proStift = fuenf / 5 / 1000;
  assert.ok(proStift > 1 / K.TEMPO * 0.9, 'zu knapp: ' + proStift.toFixed(1) + 's je Stift');
  assert.ok(proStift < 4 / K.TEMPO, 'zu grosszuegig: ' + proStift.toFixed(1) + 's je Stift');
});

test('Die Belohnung ist gestaffelt, nicht alles oder nichts', () => {
  // Ein halber Erfolg soll sich lohnen, ohne den ganzen zu entwerten.
  const voll = K.belohnung(4, 4, 10);
  assert.strictEqual(voll.art, 'item', 'alle Stifte -> Ausruestung');
  assert.strictEqual(voll.iLevel, 14, 'Tiefe + 4');

  const halb = K.belohnung(2, 4, 10);
  assert.strictEqual(halb.art, 'gold');
  assert.ok(halb.gold > 0, 'kein Gold bei halbem Erfolg');

  const nichts = K.belohnung(0, 4, 10);
  assert.strictEqual(nichts.art, 'nichts');
  assert.strictEqual(nichts.gold, 0);
});

test('Wer den letzten Dietrich verliert, geht leer aus', () => {
  // DAS macht das Aufhoeren zu einer Entscheidung: sicheres Gold jetzt gegen
  // Ausruestung mit Risiko. Ohne diese Regel waere Weitermachen immer richtig.
  const abgebrochen = K.belohnung(3, 4, 10, false);
  const verloren = K.belohnung(3, 4, 10, true);
  assert.strictEqual(abgebrochen.art, 'gold', 'aufhoeren zahlt anteilig');
  assert.ok(abgebrochen.gold > 0);
  assert.strictEqual(verloren.art, 'nichts', 'verlieren zahlt nichts');
  assert.strictEqual(verloren.gold, 0);
});

test('Mehr Stifte bringen mehr Gold', () => {
  const eins = K.belohnung(1, 4, 10).gold;
  const drei = K.belohnung(3, 4, 10).gold;
  assert.ok(drei > eins, 'anteilig: ' + eins + ' vs ' + drei);
});

test('Das Gold bleibt unter einem ganzen anderen Ereignis', () => {
  // Der versteckte Schatz zahlt 30-70 + 15/Tiefe. Ein halb geknacktes Schloss
  // darf nicht besser zahlen als ein ganzes Ereignis.
  const tiefe = 10;
  const schatzMax = 70 + 15 * tiefe;
  for (let g = 1; g < 5; g++) {
    assert.ok(K.belohnung(g, 5, tiefe).gold < schatzMax, g + ' von 5 zahlt zu viel');
  }
});

test('Kaputte Eingaben liefern etwas Sinnvolles, statt zu werfen', () => {
  assert.strictEqual(K.belohnung(-5, 4, 10).art, 'nichts');
  assert.strictEqual(K.belohnung(99, 4, 10).art, 'item', 'mehr als moeglich zaehlt als voll');
  assert.ok(K.toleranz(99, 3) > 0);
  assert.ok(K.gesamtzeit(0) > 0);
  assert.strictEqual(K.widerstandStufe(0.5, 0.5, 0), 5, 'Toleranz 0 darf nicht durch null teilen');
  assert.ok(K.zielPosition(0, Math.random) >= 0);
});

test('Ohne Szene startet kein Spiel, sondern es meldet sich sauber zurueck', () => {
  let erg = null;
  K.spiele(null, 10, (e) => { erg = e; });
  assert.ok(erg, 'kein Rueckruf');
  assert.strictEqual(erg.geschafft, false);
  assert.strictEqual(erg.verloren, false);
});
