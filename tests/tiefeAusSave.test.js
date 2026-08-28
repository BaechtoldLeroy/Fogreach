// Regression: die im Hub gewaehlte Tiefe wurde vom Wellenzaehler ueberschrieben.
//
// storage.js stellte die Tiefe als Maximum aus ZWEI Feldern wieder her:
//     Math.max(1, s.dungeonDepth, s.currentWave)
//
// currentWave startet bei depth - 1 (roomManager.js:1322) und waechst mit jeder
// Welle (wave.js:35) — am Laufende liegt er also auf oder ueber der Tiefe.
// startDungeon speichert und setzt danach pendingLoadedSave neu
// (HubSceneV2.js:2428), sodass dieser Block bei JEDEM Dungeon-Start laeuft.
//
// Folge, im Testlauf gemessen:
//     Tiefenwahl-Dialog: Ziel 20 [DUNGEON_DEPTH=20 OVERRIDE=20]
//     Dungeon gestartet auf Tiefe 21
//     AUSGANG-ROHDATEN: {"grund":"dungeon_complete","tiefe":21}
// Wer Tiefe 20 waehlte, landete auf 21 — und damit NEBEN dem Boss-Tor, denn
// Voll-Bosse stehen nur auf Vielfachen von 10 (wave.js:70). Der Lauf hob
// zusaetzlich die Tiefengrenze an und schob das Tor weiter weg.
//
// storage.js ist kein ladbares Modul (freie Script-Globals), deshalb wird die
// Stelle im Quelltext geprueft — wie in economyProgression.test.js begruendet.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8')
  .split(String.fromCharCode(13)).join('');

/** Der Block, der restoredDepth berechnet — ohne Kommentarzeilen. */
function block() {
  const i = QUELLE.indexOf('const restoredDepth');
  assert.ok(i >= 0, 'restoredDepth nicht gefunden');
  // Rueckwaerts bis zum Anfang der zugehoerigen Berechnung.
  const von = Math.max(0, QUELLE.lastIndexOf('const _tiefeAusSave', i) >= 0
    ? QUELLE.lastIndexOf('const _tiefeAusSave', i) : i);
  return QUELLE.slice(von, i + 260)
    .split(String.fromCharCode(10))
    .filter((z) => !z.trim().startsWith('//'))
    .join(String.fromCharCode(10));
}

test('die gespeicherte Tiefe wird nicht gegen den Wellenzaehler maximiert', () => {
  const b = block();
  // Genau das war der Fehler: beide Felder in EINEM Math.max.
  // Klammer-zaehlend statt per Regex: [^)]* bricht schon am ersten ) von
  // Math.round(...) ab und liesse den alten Code durch.
  let beideImMax = false;
  let von = b.indexOf('Math.max(');
  while (von >= 0 && !beideImMax) {
    let tiefe = 0, schluss = -1;
    for (let k = von + 'Math.max'.length; k < b.length; k++) {
      if (b[k] === '(') tiefe++;
      else if (b[k] === ')') { tiefe--; if (tiefe === 0) { schluss = k; break; } }
    }
    if (schluss < 0) break;
    const inhalt = b.slice(von, schluss);
    if (inhalt.includes('dungeonDepth') && inhalt.includes('currentWave')) beideImMax = true;
    von = b.indexOf('Math.max(', von + 1);
  }
  assert.ok(!beideImMax,
    'dungeonDepth und currentWave stehen zusammen in Math.max — der Wellenzaehler '
    + 'ueberschreibt damit die gewaehlte Tiefe');
});

test('currentWave dient nur als Rueckfall, wenn dungeonDepth fehlt', () => {
  const b = block();
  assert.match(b, /_tiefeAusSave\s*>\s*0\s*\?\s*_tiefeAusSave\s*:\s*_welleAusSave/,
    'der Rueckfall auf den Wellenzaehler ist nicht an "dungeonDepth fehlt" gebunden');
});

test('die Regel selbst: gewaehlte Tiefe gewinnt, Wellenzaehler nur ohne sie', () => {
  // Spiegelt die Regel aus storage.js — dokumentiert das erwartete Verhalten
  // an konkreten Zahlen, auch wenn das Modul nicht ladbar ist.
  const regel = (dungeonDepth, currentWave) => {
    const t = (typeof dungeonDepth === 'number' && isFinite(dungeonDepth)) ? Math.round(dungeonDepth) : 0;
    const w = (typeof currentWave === 'number' && isFinite(currentWave)) ? Math.round(currentWave) : 0;
    return Math.max(1, t > 0 ? t : w);
  };
  assert.strictEqual(regel(20, 21), 20, 'der gemessene Fall: Wahl 20, Welle 21 -> 20');
  assert.strictEqual(regel(10, 11), 10, 'derselbe Fall eine Bossstufe tiefer');
  assert.strictEqual(regel(undefined, 7), 7, 'alter Spielstand ohne dungeonDepth -> Wellenzaehler');
  assert.strictEqual(regel(0, 0), 1, 'nie unter 1');
});
