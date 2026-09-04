// tests/kettenschloss.test.js — Das Kettenschloss-Minispiel (#71).
//
// Warum kein Kartenspiel: Blackjack und Roulette waeren generisches
// Taverneninventar. Die Stadt heisst nach ihren Ketten — ein verkettetes Gitter
// aufzubrechen kommt aus dem Stoff des Spiels.
//
// Geprueft wird die Rechnerei: sie ist der Teil, der balanciert werden muss.
// Die Oberflaeche selbst ist am laufenden Spiel gemessen (Overlay erscheint,
// Kampfeingabe gesperrt, nach dem Ende null Reste).

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

test('Das Trefferfenster wird von Stift zu Stift enger', () => {
  // Die Spannung soll steigen, nicht am Anfang stehen.
  const n = 5;
  let vorher = Infinity;
  for (let i = 0; i < n; i++) {
    const b = K.zonenBreite(i, n);
    assert.ok(b < vorher, 'Stift ' + i + ' ist nicht enger als der vorige');
    vorher = b;
  }
  assert.ok(Math.abs(K.zonenBreite(0, n) - K.ZONE_START) < 1e-9, 'erster Stift');
  assert.ok(Math.abs(K.zonenBreite(n - 1, n) - K.ZONE_ENDE) < 1e-9, 'letzter Stift');
});

test('Der Zeiger wird von Stift zu Stift schneller', () => {
  // Zwei Achsen statt einer: enger UND schneller.
  const n = 5;
  assert.ok(K.laufzeit(n - 1, n) < K.laufzeit(0, n),
    'der letzte Stift muss schneller laufen als der erste');
});

test('Der Zeiger kehrt um, statt zu springen', () => {
  // Ein Sprung am Rand waere unfair — man sieht ihn nicht kommen.
  const d = 1000;
  assert.ok(Math.abs(K.zeigerPosition(0, d) - 0) < 1e-9, 'Start links');
  assert.ok(Math.abs(K.zeigerPosition(d, d) - 1) < 1e-9, 'nach einer Dauer rechts');
  assert.ok(Math.abs(K.zeigerPosition(d * 2, d) - 0) < 1e-9, 'nach zwei Dauern wieder links');
  // Stetig: zwei benachbarte Zeitpunkte duerfen nie weit auseinanderliegen.
  let vorher = K.zeigerPosition(0, d);
  for (let ms = 10; ms <= d * 4; ms += 10) {
    const jetzt = K.zeigerPosition(ms, d);
    assert.ok(Math.abs(jetzt - vorher) < 0.05,
      'Sprung bei ' + ms + ' ms: ' + vorher + ' -> ' + jetzt);
    vorher = jetzt;
  }
});

test('Der Zeiger bleibt auf der Leiste', () => {
  for (let ms = 0; ms < 5000; ms += 7) {
    const p = K.zeigerPosition(ms, 900);
    assert.ok(p >= 0 && p <= 1, 'ausserhalb bei ' + ms + ' ms: ' + p);
  }
});

test('Das Trefferfenster ragt nie ueber den Rand hinaus', () => {
  // Sonst waere ein Stift durch blosses Warten am Umkehrpunkt zu treffen —
  // dort steht der Zeiger am laengsten still.
  for (let i = 0; i < 500; i++) {
    const b = K.zonenBreite(i % 5, 5);
    const m = K.zonenMitte(b, Math.random);
    assert.ok(m - b / 2 >= -1e-9, 'links raus: ' + m + ' bei Breite ' + b);
    assert.ok(m + b / 2 <= 1 + 1e-9, 'rechts raus: ' + m + ' bei Breite ' + b);
  }
});

test('Der Treffertest sitzt genau auf der Fensterkante', () => {
  assert.strictEqual(K.istTreffer(0.5, 0.5, 0.2), true, 'Mitte');
  assert.strictEqual(K.istTreffer(0.6, 0.5, 0.2), true, 'genau auf der Kante');
  assert.strictEqual(K.istTreffer(0.61, 0.5, 0.2), false, 'knapp daneben');
  assert.strictEqual(K.istTreffer(0.39, 0.5, 0.2), false, 'andere Seite');
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
    assert.ok(K.belohnung(g, 5, tiefe).gold < schatzMax,
      g + ' von 5 zahlt zu viel');
  }
});

test('Kaputte Eingaben liefern etwas Sinnvolles, statt zu werfen', () => {
  assert.strictEqual(K.belohnung(-5, 4, 10).art, 'nichts');
  assert.strictEqual(K.belohnung(99, 4, 10).art, 'item', 'mehr als moeglich zaehlt als voll');
  assert.ok(K.zonenBreite(99, 3) > 0);
  assert.ok(K.laufzeit(-3, 3) > 0);
  assert.ok(K.zeigerPosition(0, 0) >= 0, 'Dauer 0 darf nicht durch null teilen');
});

test('Ohne Szene startet kein Spiel, sondern es meldet sich sauber zurueck', () => {
  let erg = null;
  K.spiele(null, 10, (e) => { erg = e; });
  assert.ok(erg, 'kein Rueckruf');
  assert.strictEqual(erg.geschafft, false);
});
