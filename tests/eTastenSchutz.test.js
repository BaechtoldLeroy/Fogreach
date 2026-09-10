// tests/eTastenSchutz.test.js — ein E, eine Wirkung.
//
// Gemeldet: "beim Betreten eines Raums wird manchmal noch Skill E ausgefuehrt."
//
// In der klassischen Belegung liegt auf E dreierlei: Treppe, Tuer und die
// Faehigkeit auf Slot 3. Damit ein Druck nicht zwei Dinge tut, setzt die
// Treppe eine Marke, und der Faehigkeits-Versand schluckt den Druck, wenn sie
// steht.
//
// Diese Marke war rein zeitlich (300 ms). Gemessen dauert ein Raumaufbau aber
// 27 bis 1643 ms: die Treppe setzt die Marke, der Aufbau blockiert die
// Schleife, und wenn der Versand im naechsten Frame drankommt, ist das Fenster
// laengst zu. Genau daher das "manchmal" — nur langsame Aufbauten sind
// betroffen.
//
// Jetzt traegt eine EINMAL-MARKE die Hauptlast. Sie ueberlebt beliebig lange
// Aufbauten und wird vom ersten Versand danach verbraucht.
//
// Gemessen wird an den echten Helfern in main.js. Sie sind script-scoped und
// ueber den blossen Namen erreichbar.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=12', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(30);
});
after(async () => { if (H) await H.shutdown(); });

/** Setzt Marke und Zeitstempel und fragt den Helfer ab. */
function pruefe(js) {
  return H.run(`(function () {
    window.__stairConsumedE = false;
    window.__stairConsumedEAt = 0;
    window.__eventConsumedE = false;
    window.__eventConsumedEAt = 0;
    ${js}
  })()`);
}

test('Die Marke ueberlebt einen langsamen Raumaufbau', () => {
  // 1600 ms zurueck — laenger als der gemessene langsamste Aufbau, weit
  // ausserhalb des alten 300-ms-Fensters.
  const r = pruefe(`
    window.__stairConsumedE = true;
    window.__stairConsumedEAt = Date.now() - 1600;
    return _stairJustConsumedE();
  `);
  assert.strictEqual(r, true,
    'nach 1600 ms gilt der Druck als frei — dann feuert die Faehigkeit zusaetzlich');
});

test('Ohne die Marke rettet die Zeit allein nichts', () => {
  // Die Gegenprobe: genau das war der alte Zustand. Faellt sie weg, prueft der
  // Test darueber nicht mehr, was ihn rettet.
  const r = pruefe(`
    window.__stairConsumedEAt = Date.now() - 1600;
    return _stairJustConsumedE();
  `);
  assert.strictEqual(r, false,
    'die Zeitschranke greift nach 1600 ms noch — dann misst der Test etwas anderes');
});

test('Die Marke wird nur EINMAL verbraucht', () => {
  // Sonst schluckt sie auch den naechsten Druck, und die Tuer geht nicht auf.
  //
  // Mit ALTEM Zeitstempel geprueft: bei frischem greift danach noch die
  // Zeitschranke, und die Einmal-Eigenschaft waere nicht zu sehen. Genau daran
  // ist der erste Entwurf dieses Tests gefallen — er mass die Zeitschranke
  // und hielt sie fuer die Marke.
  const r = pruefe(`
    window.__stairConsumedE = true;
    window.__stairConsumedEAt = Date.now() - 1600;
    return [_stairJustConsumedE(), _stairJustConsumedE()];
  `);
  assert.strictEqual(r[0], true, 'der erste Druck wurde nicht geschluckt');
  assert.strictEqual(r[1], false, 'die Marke schluckt auch den zweiten Druck');
});

test('Eine uralte Marke verschluckt den naechsten Druck nicht', () => {
  // Die Treppe kann auch per Ueberlappung ausloesen, ohne dass je ein E folgt.
  // Bliebe die Marke dann liegen, ginge irgendwann eine Tuer nicht auf.
  const r = pruefe(`
    window.__stairConsumedE = true;
    window.__stairConsumedEAt = Date.now() - 60000;
    return _stairJustConsumedE();
  `);
  assert.strictEqual(r, false, 'eine eine Minute alte Marke gilt noch');
});

test('Auch Ereignisobjekte tragen die Marke', () => {
  // Koederbeutel, Truhe und Kettenschloss haengen ihren Handler direkt an E.
  const r = pruefe(`
    window.__eventConsumedE = true;
    window.__eventConsumedEAt = Date.now() - 1600;
    return _eventJustConsumedE();
  `);
  assert.strictEqual(r, true, 'die Ereignis-Marke ueberlebt keinen langsamen Aufbau');
});

test('Die Treppe setzt die Marke wirklich', () => {
  // Der Helfer koennte tadellos sein und trotzdem nie eine Marke sehen. Genau
  // so eine Luecke war der Kettenblitz.
  const quelle = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');
  assert.ok(quelle.indexOf('window.__stairConsumedE = true') > 0,
    'roomManager setzt die Einmal-Marke nicht');

  ['eventSystem.js', 'hubTruheUI.js', 'kettenschloss.js'].forEach((datei) => {
    const q = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'js', datei), 'utf8');
    assert.ok(q.indexOf('window.__eventConsumedE = true') > 0,
      datei + ' setzt die Einmal-Marke nicht');
  });
});
