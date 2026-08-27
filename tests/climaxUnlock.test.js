// Regression: die Treppe blieb nach dem Boss-Tod dauerhaft gesperrt.
//
// checkWaveEnd loeschte den Klimax-Merker, BEVOR die Entsperrung versucht
// wurde:
//     window.__climaxEnemy = null;
//     if (... && this && this.stairsGroup) { lockStairs(this, false); }
// Schlug die Entsperrung fehl — kein `this`, oder stairsGroup im Raumwechsel
// noch nicht vorhanden — war der Merker weg und es gab keinen zweiten Versuch.
// Der Spieler waere im Boss-Raum eingesperrt (seit #109 sperrt der Voll-Boss
// die Treppe) und muesste das Portal nehmen.
//
// Im Testlauf gemessen: von 5 Boss-Siegen endeten 2 mit "Portal (Stillstand)"
// statt "Dungeon abgeschlossen".
//
// Geprueft wird die REIHENFOLGE im Quelltext: die Entsperrung muss vor dem
// Verbrauch stehen, und der Verbrauch an ihren Erfolg gebunden sein.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'js', 'wave.js'), 'utf8')
  .split(String.fromCharCode(13)).join('');

/** Schneidet den Klimax-Block aus checkWaveEnd heraus. */
function klimaxBlock() {
  const i = QUELLE.indexOf('if (window.__climaxEnemy) {');
  assert.ok(i >= 0, 'Klimax-Block nicht gefunden');
  let tiefe = 0;
  for (let j = i; j < QUELLE.length; j++) {
    const c = QUELLE[j];
    if (c === '{') tiefe++;
    else if (c === '}') { tiefe--; if (tiefe === 0) return QUELLE.slice(i, j + 1); }
  }
  throw new Error('Klimax-Block nicht geschlossen');
}

const BLOCK = klimaxBlock();

test('Entsperrung steht VOR dem Verbrauch des Merkers', () => {
  const iEntsperren = BLOCK.indexOf('lockStairs');
  const iVerbrauch = BLOCK.indexOf('__climaxEnemy = null');
  assert.ok(iEntsperren >= 0, 'kein lockStairs im Klimax-Block');
  assert.ok(iVerbrauch >= 0, 'der Merker wird nirgends verbraucht');
  assert.ok(iEntsperren < iVerbrauch,
    'der Merker wird geloescht, bevor entsperrt wird — schlaegt die Entsperrung '
    + 'fehl, bleibt die Treppe fuer immer zu');
});

test('der Verbrauch haengt am ERFOLG der Entsperrung', () => {
  // Ein unbedingtes "__climaxEnemy = null" waere auch nach dem Umsortieren
  // wieder die alte Falle: ein fehlgeschlagener Versuch duerfte den Merker
  // nicht verbrauchen.
  assert.match(BLOCK, /if\s*\(\s*entsperrt\s*\)\s*window\.__climaxEnemy\s*=\s*null/,
    'der Merker wird unbedingt verbraucht statt nur bei erfolgreicher Entsperrung');
});

test('der Erfolg wird nur im try-Zweig gesetzt', () => {
  // Wird `entsperrt` vor dem try gesetzt, zaehlt auch ein geworfener Aufruf
  // als Erfolg — der Merker waere wieder weg.
  assert.match(BLOCK, /try\s*\{\s*window\.lockStairs\(this,\s*false\);\s*entsperrt\s*=\s*true;/,
    'entsperrt wird nicht unmittelbar nach dem geglueckten lockStairs gesetzt');
});
