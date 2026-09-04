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
// Gemessen im ersten Entwurf: das Gefolge wurde ueber setTint gefaerbt, und in
// einem von drei Laeufen hatte der Anfuehrer NUR unsichere Affixe (cold_aura,
// extra_fast, lightning_enchanted). Dann wurde nichts vererbt — und weil die
// Faerbung an der Vererbung hing, sah das Gefolge aus wie beliebige Gegner:
// tint #ffffff, isTinted false, genau wie ein Fremder.

function attrappe() {
  const gemacht = { graphics: 0, timer: 0 };
  const grafik = () => ({
    lineStyle() { return this; }, strokeCircle() { return this; },
    fillStyle() { return this; }, fillCircle() { return this; },
    fillRect() { return this; }, fillTriangle() { return this; },
    setPosition() { return this; }, setDepth() { return this; },
    setVisible() { return this; }, destroy() { this.active = false; },
    active: true, scene: { sys: {} },
  });
  const scene = {
    add: { graphics: () => { gemacht.graphics++; return grafik(); } },
    time: { addEvent: () => { gemacht.timer++; return { remove() {} }; } },
    enemyLayer: { add() {} },
  };
  return { scene, gemacht };
}

test('Das Zeichen haengt an der Zugehoerigkeit, nicht am Affix', () => {
  // Der eigentliche Fehler des ersten Entwurfs: ohne vererbbaren Affix gab es
  // gar keine Markierung.
  const { scene, gemacht } = attrappe();
  const gegner = { x: 100, y: 100, active: true, visible: true };
  const fuehrer = { x: 100, y: 100, active: true, eliteAffixes: ['cold_aura', 'extra_fast'] };
  assert.strictEqual(K.erbbarerAffix(fuehrer.eliteAffixes, Math.random), null,
    'Vorbedingung: aus diesen Affixen ist keiner vererbbar');
  assert.strictEqual(K.scharZeichen(scene, gegner, fuehrer, K.BANNER_GOLD), true);
  assert.ok(gegner._scharRing, 'kein Ring');
  assert.ok(gegner._scharWimpel, 'kein Wimpel');
  assert.strictEqual(gemacht.graphics, 2, 'Ring und Wimpel sind eigene Objekte');
});

test('Die Farbe kommt vom Anfuehrer, mit Bannergold als Rueckfall', () => {
  const defs = (globalThis.window.EliteEnemies && globalThis.window.EliteEnemies.ENEMY_AFFIX_DEFS) || [];
  if (defs.length) {
    const ersterMitFarbe = defs.find((d) => typeof d.auraColor === 'number');
    if (ersterMitFarbe) {
      assert.strictEqual(K.scharFarbe({ eliteAffixes: [ersterMitFarbe.id] }), ersterMitFarbe.auraColor);
    }
  }
  assert.strictEqual(K.scharFarbe({ eliteAffixes: [] }), K.BANNER_GOLD, 'ohne Affixe Bannergold');
  assert.strictEqual(K.scharFarbe(null), K.BANNER_GOLD, 'ohne Anfuehrer Bannergold');
  assert.strictEqual(K.scharFarbe({ eliteAffixes: ['gibtsnicht'] }), K.BANNER_GOLD, 'unbekannter Affix');
});

test('Ohne Szene entsteht kein Zeichen, statt zu werfen', () => {
  assert.strictEqual(K.scharZeichen(null, {}, {}, 0xffffff), false);
  assert.strictEqual(K.scharZeichen({}, {}, {}, 0xffffff), false, 'Szene ohne add');
  assert.strictEqual(K.scharZeichen(attrappe().scene, null, {}, 0xffffff), false, 'ohne Gegner');
});

test('erbeAffix faerbt NICHT mehr', () => {
  // Toenung ist der falsche Kanal: sie teilt sich mit der Grundfarbe je
  // Gegnertyp, der Affixfarbe eines Elite, dem Mini-Boss-Orange und den
  // Trefferblitzen — und die rufen danach clearTint(), loeschen die Markierung
  // also dauerhaft.
  const fs = require('fs');
  const path = require('path');
  const s = fs.readFileSync(path.join(__dirname, '..', 'js', 'kriegsschar.js'), 'utf8');
  const i = s.indexOf('function erbeAffix');
  assert.ok(i > 0, 'erbeAffix nicht gefunden');
  const block = s.slice(i, s.indexOf('window.Kriegsschar', i));
  assert.ok(!/setTint\(/.test(block),
    'erbeAffix faerbt wieder — das uebersteht keinen Trefferblitz');
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
