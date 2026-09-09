// tests/ausbau.test.js — ein gefundenes Stueck weiter verbessern (#115).
//
// Bis hierher war ein Fund entweder besser als das Getragene oder wertlos. Der
// Ausbau gibt dem Spieler einen Hebel, den er selbst in der Hand hat: eine
// Stufe hebt alle PUNKTE auf dem Stueck um 10 Prozent, und die Seltenheit
// entscheidet, wie viele Stufen es gibt.
//
// Die Tests decken die drei Stellen ab, an denen so etwas leise falsch wird:
// die Eigenart einer Basis mitzuheben (dann wird die Glutaxt langsamer statt
// staerker), flache Affixe auf Nachkommastellen zu bringen, und Kosten, die
// nicht mit dem Vermoegen mitwachsen.

const { test } = require('node:test');
const assert = require('node:assert');

function frisch() {
  delete require.cache[require.resolve('../js/lootSystem.js')];
  global.window = {};
  global.Phaser = { Math: { Clamp: (v, a, b) => Math.min(b, Math.max(a, v)) } };
  require('../js/lootSystem.js');
  global.window.DUNGEON_DEPTH = 20;
  global.window.currentWave = 20;
  return global.window.LootSystem;
}

test('Die Seltenheit entscheidet, wie weit sich ein Stueck ausbauen laesst', () => {
  const LS = frisch();
  const erwartet = [1, 2, 3, 5];
  erwartet.forEach((soll, tier) => {
    const it = LS.rollItem('BD_PLATTENPANZER', 20, tier);
    assert.strictEqual(LS.ausbauMaxStufen(it), soll,
      'Seltenheit ' + tier + ': ' + LS.ausbauMaxStufen(it) + ' Stufen statt ' + soll);
    let n = 0;
    while (LS.ausbauKosten(it)) { assert.strictEqual(LS.ausbauen(it), true); n++; }
    assert.strictEqual(n, soll, 'Seltenheit ' + tier + ': ' + n + ' Stufen wirklich gegangen');
    assert.strictEqual(LS.ausbauen(it), false, 'ueber das Maximum hinaus ausgebaut');
  });
});

test('Eine Stufe hebt alle Machtwerte um 10 Prozent', () => {
  const LS = frisch();
  const it = LS.rollItem('BD_PLATTENPANZER', 20, 3);
  const vorher = { armor: it.armor, affixe: it.affixes.map((a) => a.value) };
  LS.ausbauen(it);
  assert.ok(Math.abs(it.armor / vorher.armor - 1.1) < 0.01,
    'Ruestung: ' + vorher.armor + ' -> ' + it.armor);
  it.affixes.forEach((a, i) => {
    // Flache Affixe (Lebenspunkte, Reichweite) runden auf ganze Zahlen, die
    // Abweichung ist dort groesser.
    assert.ok(a.value > vorher.affixe[i],
      'Affix ' + a.defId + ' ist nicht gewachsen: ' + vorher.affixe[i] + ' -> ' + a.value);
  });
});

test('Die EIGENART einer Basis bleibt unberuehrt', () => {
  // Der Fehler, der hier am leichtesten passiert: Tempo und Reichweite sind
  // die Eigenart einer Basis, nicht ihre Staerke. Das Minus der Glutaxt aufs
  // Tempo mit 1,1 zu multiplizieren machte die Waffe SCHLECHTER, nicht besser.
  const LS = frisch();
  const axt = LS.rollItem('WPN_GLUTAXT', 20, 0);
  const vorher = { speed: axt.speed, range: axt.range, damage: axt.damage };
  LS.ausbauen(axt);
  assert.strictEqual(axt.speed, vorher.speed,
    'das Tempo wurde mitgehoben: ' + vorher.speed + ' -> ' + axt.speed);
  assert.strictEqual(axt.range, vorher.range,
    'die Reichweite wurde mitgehoben: ' + vorher.range + ' -> ' + axt.range);
  assert.ok(axt.damage > vorher.damage, 'der Schaden ist nicht gewachsen');
});

test('Flache Affixe bleiben ganze Zahlen und wachsen um mindestens eins', () => {
  // "+5,5 Lebenspunkte" waere unsinnig, und eine bezahlte Stufe darf nie
  // wirkungslos verpuffen, nur weil 5 x 1,1 auf 5 zurueckrundet.
  const LS = frisch();
  const it = LS.rollItem('BD_LEDERHARNISCH', 20, 1);
  // Wert 4 gewaehlt, weil 4 x 1,1 = 4,4 auf 4 ZURUECKrundet. Mit 5 (5,5 -> 6)
  // faellt der Fehler nicht auf — der Test bestand die Mutationsprobe erst mit
  // dieser Zahl.
  it.affixes = [{ defId: 'of_health', value: 4 }];
  LS.ausbauen(it);
  const w = it.affixes[0].value;
  assert.strictEqual(w, Math.round(w), 'die Lebenspunkte haben Nachkommastellen: ' + w);
  assert.strictEqual(w, 5, 'die bezahlte Stufe ist verpufft: 4 -> ' + w);
});

test('Der Ausbau ueberholt die Fundtiefe — bewusst', () => {
  // Entscheidung des Nutzers: ein voll ausgebautes legendaeres Stueck DARF
  // besser sein als alles, was faellt. Das ist der Sinn eines Projekts ueber
  // mehrere Laeufe.
  const LS = frisch();
  const ausgebaut = LS.rollItem('BD_PLATTENPANZER', 20, 3);
  ausgebaut.affixes = [];
  while (LS.ausbauKosten(ausgebaut)) LS.ausbauen(ausgebaut);

  // Der beste Wurf derselben Basis auf derselben Tiefe, ohne Ausbau.
  let bester = 0;
  for (let i = 0; i < 300; i++) {
    const f = LS.rollItem('BD_PLATTENPANZER', 20, 3);
    if (f.armor > bester) bester = f.armor;
  }
  assert.ok(ausgebaut.armor > bester,
    'voll ausgebaut ' + ausgebaut.armor + ' liegt nicht ueber dem besten Wurf ' + bester);
});

test('Die Goldkosten verdoppeln sich je Stufe', () => {
  // Das ist der Teil, der die unbegrenzte Anhaeufung einholt. Gemessen liegen
  // auf Tiefe 28 rund 61 600 Gold herum (#132); feste Preise koennen ein
  // wachsendes Vermoegen nie einholen, eine Verdopplung schon.
  const LS = frisch();
  const it = LS.rollItem('BD_PLATTENPANZER', 20, 3);
  const preise = [];
  let k;
  while ((k = LS.ausbauKosten(it))) { preise.push(k.gold); LS.ausbauen(it); }
  assert.strictEqual(preise.length, 5);
  for (let i = 1; i < preise.length; i++) {
    assert.strictEqual(preise[i], preise[i - 1] * 2,
      'Stufe ' + (i + 1) + ' kostet ' + preise[i] + ' statt ' + (preise[i - 1] * 2));
  }
  const summe = preise.reduce((a, b) => a + b, 0);
  assert.ok(summe > 61626,
    'ein voller Ausbau kostet nur ' + summe + ' Gold und damit weniger als der '
    + 'gemessene Bestand auf Tiefe 28 (61 626) — die Senke greift nicht');
});

test('Zerlegen gibt die Haelfte der eingesetzten Brocken zurueck', () => {
  // Ohne Rueckgabe waere jede Fehlinvestition endgueltig, und niemand baute
  // ein Stueck aus, das er vielleicht noch ersetzt.
  const LS = frisch();
  const it = LS.rollItem('BD_PLATTENPANZER', 20, 3);
  assert.strictEqual(LS.ausbauRueckgabe(it), 0, 'ein frisches Stueck gibt schon etwas zurueck');
  let eingesetzt = 0, k;
  while ((k = LS.ausbauKosten(it))) { eingesetzt += k.brocken; LS.ausbauen(it); }
  assert.strictEqual(LS.ausbauBrockenGesamt(it), eingesetzt,
    'die Summe der eingesetzten Brocken stimmt nicht');
  assert.strictEqual(LS.ausbauRueckgabe(it), Math.floor(eingesetzt / 2),
    'zurueck kommen ' + LS.ausbauRueckgabe(it) + ' von ' + eingesetzt);
});

test('Der Name traegt die Stufe', () => {
  // Sonst sind zwei gleich heissende Stuecke im Inventar nicht zu
  // unterscheiden — und genau das ist beim Vergleichen die Frage.
  const LS = frisch();
  const it = LS.rollItem('BD_PLATTENPANZER', 20, 1);
  const ohne = LS.composeName(it);
  assert.ok(ohne.indexOf('+') < 0, 'schon ohne Ausbau steht ein Plus im Namen: ' + ohne);
  LS.ausbauen(it);
  assert.ok(LS.composeName(it).indexOf('+1') > 0,
    'die Stufe fehlt im Namen: ' + LS.composeName(it));
});

test('Die Kosten haengen an der Seltenheit, nicht nur an der Stufe', () => {
  // Sonst waere ein gewoehnliches Stueck genauso teuer auszubauen wie ein
  // legendaeres, obwohl es viel weniger dabei herausholt.
  const LS = frisch();
  const preise = [0, 1, 2, 3].map((t) => LS.ausbauKosten(LS.rollItem('BD_PLATTENPANZER', 20, t)).gold);
  for (let i = 1; i < preise.length; i++) {
    assert.ok(preise[i] > preise[i - 1],
      'Seltenheit ' + i + ' kostet nicht mehr als ' + (i - 1) + ': ' + preise.join(' / '));
  }
});
