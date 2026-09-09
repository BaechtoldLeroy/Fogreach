// tests/dialogTypewriter.test.js — Questtexte bauen sich Wort fuer Wort auf (#139).
//
// Das Modul ist bewusst Phaser-frei: die Szene fragt bei jedem Tick nach dem
// aktuellen Ausschnitt. Nur so laesst sich der Ablauf ohne Szene pruefen — und
// ohne Pruefung waeren die 233 Dialogzeilen des Spiels nur per Augenschein
// abgesichert.
//
// Die Uhr wird hier von aussen gestellt (opts.jetzt), sonst haenge der Test an
// echter Wartezeit und waere langsam UND flaky.

const { test } = require('node:test');
const assert = require('node:assert');
const TW = require('../js/dialogTypewriter.js');

function uhr() {
  const u = { t: 0 };
  u.jetzt = () => u.t;
  return u;
}

test('inWorte haengt Trennzeichen ans VORHERGEHENDE Wort', () => {
  // Sonst stuende nach dem letzten sichtbaren Wort ein Leerzeichen, und ein
  // Absatzumbruch waere offen, bevor sein erstes Wort da ist — der Kasten
  // wuerde sichtbar zucken.
  assert.deepStrictEqual(TW.inWorte('Hallo Welt'), ['Hallo ', 'Welt']);
  assert.deepStrictEqual(TW.inWorte('A\n\nB'), ['A\n\n', 'B']);
  assert.deepStrictEqual(TW.inWorte(''), []);
  assert.deepStrictEqual(TW.inWorte(null), []);
});

test('Der zusammengesetzte Text ist am Ende exakt der urspruengliche', () => {
  const proben = [
    'BRANKA: Du siegelst Akten, an die Du Dich nicht erinnerst.',
    'Zwei Absaetze.\n\nDer zweite hat  doppelte  Abstaende.',
    '  fuehrender und nachfolgender Abstand  ',
    'Eins'
  ];
  proben.forEach((p) => {
    assert.strictEqual(TW.inWorte(p).join(''), p, 'verstuemmelt: ' + JSON.stringify(p));
  });
});

test('Der Aufbau laeuft Wort fuer Wort in der richtigen Reihenfolge', () => {
  const u = uhr();
  const lauf = TW.starte('eins zwei drei', { tempo: 'normal', jetzt: u.jetzt });
  const takt = TW.msJeWort('normal');

  assert.strictEqual(lauf.tick().text, 'eins ', 'das erste Wort steht sofort');
  u.t = takt;
  assert.strictEqual(lauf.tick().text, 'eins zwei ');
  u.t = takt * 2;
  const letzt = lauf.tick();
  assert.strictEqual(letzt.text, 'eins zwei drei');
  assert.strictEqual(letzt.fertig, true);
});

test('Ein Zeitsprung holt mehrere Worte auf einmal nach', () => {
  // Der Takt laeuft ueber die Wanduhr, nicht ueber Frames. Nach einem
  // Ruckler duerfen keine Worte verloren gehen.
  const u = uhr();
  const lauf = TW.starte('a b c d e', { tempo: 'normal', jetzt: u.jetzt });
  lauf.tick();
  u.t = TW.msJeWort('normal') * 10;
  const stand = lauf.tick();
  assert.strictEqual(stand.text, 'a b c d e');
  assert.strictEqual(stand.fertig, true);
  assert.strictEqual(stand.neueWorte, 4, 'die vier fehlenden Worte kommen zusammen');
});

test('Tempo "sofort" schaltet den Aufbau ganz ab', () => {
  const lauf = TW.starte('eins zwei drei', { tempo: 'sofort', jetzt: () => 0 });
  assert.strictEqual(lauf.fertig(), true, 'es laeuft gar kein Aufbau');
  assert.strictEqual(lauf.tick().text, 'eins zwei drei');
});

test('sofortFertig ueberspringt und liefert den vollen Text', () => {
  const u = uhr();
  const lauf = TW.starte('eins zwei drei vier', { tempo: 'langsam', jetzt: u.jetzt });
  lauf.tick();
  assert.strictEqual(lauf.fertig(), false);
  assert.strictEqual(lauf.sofortFertig(), 'eins zwei drei vier');
  assert.strictEqual(lauf.fertig(), true);
  assert.strictEqual(lauf.tick().neueWorte, 0, 'nach dem Ueberspringen kommt nichts mehr');
});

test('neueWorte zaehlt genau die Worte, die in diesem Tick dazukamen', () => {
  // Daran haengt der Sprechklang — zaehlt es falsch, klingt es falsch.
  const u = uhr();
  const takt = TW.msJeWort('normal');
  const lauf = TW.starte('a b c', { tempo: 'normal', jetzt: u.jetzt });
  assert.strictEqual(lauf.tick().neueWorte, 1);
  assert.strictEqual(lauf.tick().neueWorte, 0, 'ohne Zeitfortschritt kommt nichts dazu');
  u.t = takt;
  assert.strictEqual(lauf.tick().neueWorte, 1);
});

test('Das Tempo wird gespeichert und weich zurueckgelesen', () => {
  const laden = {};
  const speicher = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(laden, k) ? laden[k] : null),
    setItem: (k, v) => { laden[k] = v; }
  };
  assert.strictEqual(TW.gewaehltesTempo(speicher), 'normal', 'Vorgabe ohne Eintrag');

  assert.strictEqual(TW.setzeTempo('langsam', speicher), true);
  assert.strictEqual(TW.gewaehltesTempo(speicher), 'langsam');

  assert.strictEqual(TW.setzeTempo('rasend', speicher), false, 'unbekanntes Tempo wird abgelehnt');
  assert.strictEqual(TW.gewaehltesTempo(speicher), 'langsam', 'und aendert nichts');

  laden[TW.SPEICHER_SCHLUESSEL] = '{kaputt';
  assert.strictEqual(TW.gewaehltesTempo(speicher), 'normal', 'kaputter Eintrag faellt auf die Vorgabe');
});

test('Die Tonhoehe ist je Figur stabil und unterscheidet sich zwischen Figuren', () => {
  const aldric = TW.tonhoehe('ALDRIC');
  assert.strictEqual(TW.tonhoehe('ALDRIC'), aldric, 'dieselbe Figur klingt immer gleich');
  assert.notStrictEqual(TW.tonhoehe('ELARA'), aldric, 'andere Figur, andere Tonhoehe');
  ['ALDRIC', 'ELARA', 'BRANKA', 'MARA', 'HARREN', 'THOM'].forEach((n) => {
    const t = TW.tonhoehe(n);
    assert.ok(t >= 0.82 && t <= 1.30, n + ' liegt mit ' + t + ' ausserhalb 0,82..1,30');
  });
});

test('Alle drei Tempi sind da, und "sofort" ist das Abschalten', () => {
  assert.deepStrictEqual(TW.tempoNamen().sort(), ['langsam', 'normal', 'sofort']);
  assert.strictEqual(TW.msJeWort('sofort'), 0);
  assert.ok(TW.msJeWort('langsam') > TW.msJeWort('normal'),
    'langsam muss langsamer sein als normal');
  assert.strictEqual(TW.msJeWort('unbekannt'), TW.msJeWort('normal'),
    'ein unbekannter Name faellt auf normal zurueck');
});
