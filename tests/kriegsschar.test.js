// tests/kriegsschar.test.js — Der Bannerträger und sein Gefolge (#95).
//
// Die Vorlage war D2s Unique-Pack. Gemessen passt sie so nicht: bei uns oeffnet
// die Treppe erst im leeren Raum (es gibt also keine Entscheidung, das Pack zu
// umgehen), und die Raeume sind extrem verschieden gross. Ueber ganze Laeufe
// gemessen haben rund 60 % der Raeume 4 Gegner — die Untergrenze —, aber jeder
// fuenfte hat 14 bis 28. Ein Pack aus 1+5 waere im kleinen Raum der GANZE Raum
// und im grossen unsichtbar.
//
// Darum skaliert die Groesse mit dem Raum, und ein Fremder bleibt immer uebrig:
// erst der Kontrast macht die Schar sichtbar.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

const W = globalThis.window;
loadGameModule('js/kriegsschar.js');
const K = W.Kriegsschar;

test('Die Gefolgegroesse waechst mit dem Raum und ist gedeckelt', () => {
  // Der Deckel haelt die Zahl der Gegner mit geerbtem Affix konstant, egal wie
  // voll der Raum ist — sonst traegt ein 28-Gegner-Raum 14 verstaerkte Gegner.
  assert.strictEqual(K.gefolgeGroesse(4), 3, 'kleiner Raum: Untergrenze');
  assert.strictEqual(K.gefolgeGroesse(7), 3);
  assert.strictEqual(K.gefolgeGroesse(12), 5, 'Deckel');
  assert.strictEqual(K.gefolgeGroesse(28), 5, 'auch im vollsten Raum');
  assert.ok(K.gefolgeGroesse(1) >= K.GEFOLGE_MIN, 'nie unter der Untergrenze');
});

test('Im kleinen Raum kommt genau EIN Gegner dazu, im grossen keiner', () => {
  // Gemessen: 4 Gegner ist die haeufigste Raumgroesse. 1 Fuehrer + 3 Gefolge
  // waere dort der ganze Raum — ein Fremder muss bleiben.
  assert.strictEqual(K.zielGesamt(4, 3), 5, '4 -> 5, also +1');
  assert.strictEqual(K.zielGesamt(5, 3), 5, 'ab 5 reicht die Welle selbst');
  assert.strictEqual(K.zielGesamt(7, 3), 7, 'kein Zusatz');
  assert.strictEqual(K.zielGesamt(28, 5), 28, 'grosser Raum bleibt unangetastet');
});

test('Es bleibt immer mindestens ein Fremder im Raum', () => {
  for (let n = 1; n <= 30; n++) {
    const g = K.gefolgeGroesse(n);
    const gesamt = K.zielGesamt(n, g);
    assert.ok(gesamt >= 2 + g,
      'bei ' + n + ' Gegnern: ' + gesamt + ' gesamt, Schar ' + (1 + g));
  }
});

test('Enge Raeume bekommen keine Schar', () => {
  // Gemessen gibt es Raeume mit 20k, 63k und 84k px² begehbarer Flaeche —
  // Kammern von wenigen hundert Pixeln. Die Gegnerzahl kann das nicht
  // ausdruecken: sie klemmt bei 4 fuer alles unter 382k px².
  const immer = () => 0;   // wuerfelt immer "ja"
  assert.strictEqual(K.plane(4, 20000, 20, immer), null, '20k px²');
  assert.strictEqual(K.plane(4, 149999, 20, immer), null, 'knapp darunter');
  assert.ok(K.plane(4, 150000, 20, immer), 'genau auf der Schwelle');
  assert.ok(K.plane(4, 4090000, 20, immer), 'grosser Raum');
});

test('Unter Tiefe 6 gibt es keine Schar', () => {
  // Dort gibt es auch keine Uniques: shouldSpawnElite liefert fuer depth < 6
  // immer null. Gemessen: 0 von 10 Raeumen auf Tiefe 4 hatte einen Elite.
  const immer = () => 0;
  assert.strictEqual(K.plane(4, 500000, 5, immer), null, 'Tiefe 5');
  assert.strictEqual(K.plane(4, 500000, 1, immer), null, 'Tiefe 1');
  assert.ok(K.plane(4, 500000, 6, immer), 'ab Tiefe 6');
});

test('Die Rate entspricht der bisherigen Unique-Chance des Raums', () => {
  // Der Bannertraeger soll genauso oft kommen wie ein Unique heute — es aendert
  // sich nur, was er mitbringt. Bisher wuerfelt JEDER Gegner einzeln, die
  // Raumchance ist also 1-(1-p)^n.
  const n = 4;
  [6, 12, 20].forEach((tiefe) => {
    const p = K.uniqueRate(tiefe);
    const erwartet = 1 - Math.pow(1 - p, n);
    // Knapp unter der Schwelle muss es greifen, knapp darueber nicht.
    assert.ok(K.plane(n, 500000, tiefe, () => erwartet - 0.001),
      'Tiefe ' + tiefe + ': unter der Schwelle muss eine Schar kommen');
    assert.strictEqual(K.plane(n, 500000, tiefe, () => erwartet + 0.001), null,
      'Tiefe ' + tiefe + ': darueber nicht');
  });
});

test('Die Unique-Raten stimmen mit eliteEnemies ueberein', () => {
  // Sie sind hier gespiegelt, weil shouldSpawnElite sie in einer Funktion
  // eingebacken hat, die gleich WUERFELT. Wer sie dort aendert, muss sie hier
  // nachziehen — dieser Test faellt dann auf.
  const fs = require('fs');
  const path = require('path');
  const s = fs.readFileSync(path.join(__dirname, '..', 'js', 'eliteEnemies.js'), 'utf8');
  const treffer = s.match(/uniqueRate = (0\.\d+)/g) || [];
  assert.strictEqual(treffer.length, 3, 'erwartet drei Tiefenstufen, fand ' + treffer.length);
  const werte = treffer.map((t) => Number(t.split('= ')[1]));
  assert.deepStrictEqual(werte, [K.uniqueRate(8), K.uniqueRate(12), K.uniqueRate(20)],
    'eliteEnemies und kriegsschar sind auseinandergelaufen');
});

test('Gefaehrliche Affixe werden nicht vererbt', () => {
  // Fuenf Gegner mit Frostaura heissen dauerhaft verlangsamt ohne Ausweg. Das
  // ist kein schwierigerer Kampf, sondern ein unfairer. Dasselbe gilt fuer
  // Tempo und Mehrfachschuss: die Gruppe waere nicht mehr kitebar.
  const gefaehrlich = ['cold_aura', 'extra_fast', 'multishot', 'lightning_enchanted'];
  gefaehrlich.forEach((id) => {
    assert.strictEqual(K.erbbarerAffix([id], Math.random), null, id + ' darf nicht vererbt werden');
  });
  // Aus einer gemischten Liste kommt nur ein sicherer heraus.
  for (let i = 0; i < 200; i++) {
    const gewaehlt = K.erbbarerAffix(['cold_aura', 'berserker', 'multishot'], Math.random);
    assert.strictEqual(gewaehlt, 'berserker');
  }
});

test('Ohne Affixe wird nichts vererbt, statt zu werfen', () => {
  assert.strictEqual(K.erbbarerAffix([], Math.random), null);
  assert.strictEqual(K.erbbarerAffix(null, Math.random), null);
  assert.strictEqual(K.erbbarerAffix(undefined), null);
});

test('Ohne Szene oder Anfuehrer setzt sich kein Gefolge', () => {
  assert.deepStrictEqual(K.gefolgeSpawnen(null, {}, 3, null), []);
  assert.deepStrictEqual(K.gefolgeSpawnen({}, null, 3, null), []);
});
