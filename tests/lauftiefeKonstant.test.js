// Regression: die Lauftiefe stieg mitten im Lauf und uebersprang das Boss-Tor.
//
// Feature 058 (#41) legt fest, dass die Tiefe innerhalb eines Laufs konstant
// bleibt — runDepth.js:50: "within a run the depth never climbs per room".
// nextRoomDepth ist dafuer die Identitaet. Der Aufstieg pro RAUM war damit weg,
// der pro WELLE nicht: startNextWave schrieb
//     window.DUNGEON_DEPTH = currentWave;
// und hob die Tiefe bei jeder neuen Welle.
//
// Gemessen mit einem Mitschnitt aller Schreibzugriffe auf DUNGEON_DEPTH:
//     20 -> 20  startDungeon (HubSceneV2.js:2405)
//     20 -> 20  applySaveToState (storage.js:255)
//     20 -> 20  enterRoom (roomManager.js:1292)
//     20 -> 20  startNextWave <- enterRoom
//     20 -> 21  startNextWave <- callback (wave.js:242)
//
// Der letzte Schreibzugriff stammt aus dem Zweig "Boss ist tot" — der eine
// Zusatzwelle einplant. Er feuerte am ANFANG eines neuen Laufs, weil
// bossActive ein Modul-let ist (main.js:532) und nur beim bemerkten Boss-Tod
// zurueckgesetzt wird. Wer vorher rausgeht (Portal, Tod), nimmt das Flag mit.
//
// Folge: Wer Tiefe 20 waehlte, stand auf 21 — und traf keinen Voll-Boss mehr,
// denn Tore liegen nur auf Vielfachen von 10 (wave.js:70).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ohneKommentare = (t) => t.split(String.fromCharCode(10))
  .filter((z) => !z.trim().startsWith('//'))
  .join(String.fromCharCode(10));

const WAVE = ohneKommentare(fs.readFileSync(path.join(__dirname, '..', 'js', 'wave.js'), 'utf8')
  .split(String.fromCharCode(13)).join(''));
const MAIN = ohneKommentare(fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8')
  .split(String.fromCharCode(13)).join(''));

test('startNextWave schreibt die Lauftiefe nicht mehr', () => {
  const i = WAVE.indexOf('function startNextWave(');
  assert.ok(i >= 0, 'startNextWave nicht gefunden');
  const block = WAVE.slice(i, i + 700);
  assert.ok(!/window\.DUNGEON_DEPTH\s*=/.test(block),
    'startNextWave setzt DUNGEON_DEPTH — damit steigt die Tiefe mit jeder Welle');
});

test('der Wellenzaehler wird weiterhin gepflegt', () => {
  // Nur die TIEFE soll entkoppelt sein; currentWave selbst wird gebraucht
  // (Boss-Tor, Gegnerzahl).
  const i = WAVE.indexOf('function startNextWave(');
  const block = WAVE.slice(i, i + 700);
  assert.match(block, /window\.currentWave\s*=\s*currentWave/,
    'currentWave wird nicht mehr veroeffentlicht');
});

test('bossActive und currentBoss werden beim Laufstart zurueckgesetzt', () => {
  // Ohne Ruecksetzung nimmt ein abgebrochener Bosskampf das Flag mit in den
  // naechsten Lauf und loest dort sofort eine Zusatzwelle aus.
  const i = MAIN.indexOf('playerDeathHandled = false;', MAIN.indexOf('function create'));
  assert.ok(i >= 0, 'Ruecksetz-Block in create() nicht gefunden');
  const block = MAIN.slice(i, i + 1200);
  assert.match(block, /bossActive\s*=\s*false/, 'bossActive wird beim Laufstart nicht zurueckgesetzt');
  assert.match(block, /currentBoss\s*=\s*null/, 'currentBoss wird beim Laufstart nicht zurueckgesetzt');
});
