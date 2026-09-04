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

// --- Das Zeichen der Zugehoerigkeit ---------------------------------------
//
// Drei Anlaeufe, jeder durch eine Messung widerlegt:
//   1. Toenung, die an der Affix-Vererbung hing — kam oft gar nicht an, weil
//      aus rein unsicheren Affixen nichts vererbt wird (gemessen in einem von
//      drei Laeufen: Gefolge #ffffff, isTinted false, wie ein Fremder).
//   2. Bodenring und Wimpel als eigene Objekte — hielten, waren aber zu laut.
//   3. Jetzt: leichte Toenung in der aufgehellten Aurafarbe des Anfuehrers,
//      an der ZUGEHOERIGKEIT statt am Affix, und mit Wiederherstellung nach
//      den Trefferblitzen in player.js.

test('Die Toenung ist leicht, nicht die volle Aurafarbe', () => {
  // Unveraendert saehe ein Gefolge aus wie vier Elites.
  const gegner = { setTint(v) { this.tint = v; } };
  assert.strictEqual(K.scharToenung(gegner, 0x000000), true);
  assert.strictEqual(gegner.tint, 0x4d4d4d, 'Schwarz muss aufgehellt werden');
  // Die Aufhellung darf die Farbe nicht auswaschen: 0,55 war gemessen zu blass
  // (Aura #44aaff wurde #abd9ff und war auf hellen Sprites nicht mehr zu sehen).
  const stark = { setTint(v) { this.tint = v; } };
  K.scharToenung(stark, 0x44aaff);
  assert.strictEqual(stark.tint, 0x7cc4ff, 'Aura #44aaff soll #7cc4ff werden');
  const hell = { setTint(v) { this.tint = v; } };
  K.scharToenung(hell, 0xffffff);
  assert.strictEqual(hell.tint, 0xffffff, 'Weiss bleibt Weiss');
});

test('Die Toenung haengt an der Zugehoerigkeit, nicht am Affix', () => {
  // Der Fehler des ersten Entwurfs: ohne vererbbaren Affix keine Markierung.
  const fuehrer = { eliteAffixes: ['cold_aura', 'extra_fast'] };
  assert.strictEqual(K.erbbarerAffix(fuehrer.eliteAffixes, Math.random), null,
    'Vorbedingung: aus diesen Affixen ist keiner vererbbar');
  const gegner = { setTint(v) { this.tint = v; } };
  assert.strictEqual(K.scharToenung(gegner, K.scharFarbe(fuehrer)), true);
  assert.ok(typeof gegner._scharToenung === 'number', 'kein Merker gesetzt');
  assert.strictEqual(gegner.tint, gegner._scharToenung);
});

test('Der Merker ueberlebt die Trefferblitze', () => {
  // Drei Stellen in player.js loeschen die Gegner-Toenung nach einem Blitz.
  // Ohne Wiederherstellung war die Markierung nach dem ersten Treffer weg.
  //
  // Seit #129 steht die Wiederherstellung nicht mehr dreimal ausgeschrieben da,
  // sondern in _dauerToenungHerstellen() — der Pluenderer braucht sie genauso.
  // Geprueft wird deshalb beides: dass alle drei Stellen die Funktion rufen und
  // dass die Funktion die Schar-Toenung kennt.
  const fs2 = require('fs');
  const path2 = require('path');
  const s2 = fs2.readFileSync(path2.join(__dirname, '..', 'js', 'player.js'), 'utf8');
  const stellen = (s2.match(/_dauerToenungHerstellen\(enemy\);/g) || []).length;
  assert.strictEqual(stellen, 3,
    'erwartet drei Aufrufstellen in player.js, fand ' + stellen);
  const kern = s2.slice(s2.indexOf('function _dauerToenungHerstellen'));
  assert.ok(/_scharToenung/.test(kern.slice(0, 900)),
    'die gemeinsame Wiederherstellung kennt die Schar-Toenung nicht mehr');
});

test('_originalTint wird mitgesetzt, damit Statuseffekte sauber zuruecksetzen', () => {
  // statusEffects._clearVisual stellt bei Gegnern GENAU diesen Wert wieder her,
  // statt blank zu loeschen.
  const gegner = { setTint(v) { this.tint = v; } };
  K.scharToenung(gegner, 0xff5500);
  assert.strictEqual(gegner._originalTint, gegner._scharToenung);
});

test('Ohne Gegner passiert nichts, statt zu werfen', () => {
  assert.strictEqual(K.scharToenung(null, 0xffffff), false);
  assert.strictEqual(K.scharToenung({}, 0xffffff), false, 'ohne setTint');
});

test('In einem Raum steht genau EIN Banner', () => {
  // Nutzerbefund: ein Raum mit drei Bannertraegern. Ursache war nicht der
  // Test-Slug allein — shouldSpawnElite wuerfelt PRO GEGNER auf 'unique'
  // (ab Tiefe 16: 5 %). In einem 28-Gegner-Raum sind das 27 weitere Wuerfe,
  // Erwartungswert 1,35 zusaetzliche Bannertraeger. Der Slug legte nur einen
  // erzwungenen obendrauf.
  //
  // Steht eine Schar im Raum, wird jede weitere 'unique'-Rolle auf 'champion'
  // heruntergestuft: der Raum behaelt seine Abwechslung, der Rang bleibt
  // einmalig. Geprueft am Quelltext, weil der Wurf tief in spawnEnemy sitzt.
  const fs = require('fs');
  const path = require('path');
  const wurzel = path.join(__dirname, '..');

  const enemy = fs.readFileSync(path.join(wurzel, 'js', 'enemy.js'), 'utf8');
  assert.ok(/tier === 'unique' && window\.__scharImRaum/.test(enemy),
    'spawnEnemy stuft weitere Uniques nicht herunter — es koennen mehrere '
    + 'Bannertraeger in einem Raum stehen');

  // Der Merker gehoert zum RAUM. Bliebe er stehen, unterdrueckte ein
  // Bannertraeger die Uniques aller folgenden Raeume.
  const wave = fs.readFileSync(path.join(wurzel, 'js', 'wave.js'), 'utf8');
  assert.ok(/window\.__scharImRaum = false/.test(wave),
    'wave.js setzt den Merker vor der Welle nicht zurueck');
  assert.ok(/window\.__scharImRaum = true/.test(wave),
    'wave.js setzt den Merker beim Bannertraeger nicht');

  const rm = fs.readFileSync(path.join(wurzel, 'js', 'roomManager.js'), 'utf8');
  assert.ok(/window\.__scharImRaum = false/.test(rm),
    'roomManager loescht den Merker beim Raumwechsel nicht');
});
