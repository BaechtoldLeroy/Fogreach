// Regression #109: der Voll-Boss sperrte die Treppe nicht.
//
// wave.js behandelte die beiden Klimax-Zweige ungleich:
//   * Mini-Boss  -> window.__climaxEnemy + lockStairs(true).
//                   Kommentar dort: "kein Vorbeilaufen".
//   * Voll-Boss  -> spawnen, Musik, return. Keine Sperre.
//
// Ausgerechnet der story-tragende Boss war damit der einzige Gegner im Spiel,
// an dem man vorbeilaufen konnte. Im Testlauf zweimal auf Tiefe 10 gemessen:
//     7 Raeume, Ausgang=Dungeon abgeschlossen | Boss chainMaster 225/225
//     8 Raeume, Ausgang=Dungeon abgeschlossen | Boss chainMaster 225/225
// Voller Trefferpunktestand, kein onBossKilled, Lauf trotzdem abgeschlossen.
// 'mara_warning' (boss_kill kettenmeister) war dadurch praktisch unerfuellbar,
// und daran haengt das Tor von Tiefe 9 auf 10 (runDepth.js:22).
//
// Geprueft wird der Boss-ZWEIG als Block, nicht die Datei als Ganzes: beide
// Anweisungen kommen fuer den Mini-Boss ohnehin vor, ein datei-weites Suchen
// waere also immer gruen gewesen.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LF = String.fromCharCode(10);
const lies = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')
  .split(String.fromCharCode(13)).join('');

/** Schneidet den Block ab `start` heraus, ueber Klammerzaehlung bis zum Ende. */
function block(quelle, start) {
  const i = quelle.indexOf(start);
  assert.ok(i >= 0, 'Blockanfang nicht gefunden: ' + start);
  let tiefe = 0;
  for (let j = i; j < quelle.length; j++) {
    const c = quelle[j];
    if (c === '{') tiefe++;
    else if (c === '}') { tiefe--; if (tiefe === 0) return quelle.slice(i, j + 1); }
  }
  throw new Error('Block nicht geschlossen: ' + start);
}

const WAVE = lies('wave.js');
const VOLLBOSS = block(WAVE, 'if (_climaxArmed && bossesUnlocked && _isTierGate) {');

test('#109: der Voll-Boss-Zweig fuehrt den Boss als Klimax-Gegner', () => {
  assert.match(VOLLBOSS, /window\.__climaxEnemy\s*=/,
    'ohne __climaxEnemy gibt checkWaveEnd die Treppe nie wieder frei — und sperrt sie nie');
});

test('#109: der Voll-Boss-Zweig sperrt die Treppe', () => {
  assert.match(VOLLBOSS, /lockStairs\(\s*this\s*,\s*true\s*\)/,
    'die Treppe bleibt offen — der Boss ist ueberspringbar');
});

test('#109: der Boss-Zweig sperrt VOR dem return', () => {
  // Ein lockStairs NACH dem return waere toter Code und der Test trotzdem gruen.
  const iSperre = VOLLBOSS.indexOf('lockStairs');
  const iReturn = VOLLBOSS.indexOf('return;');
  assert.ok(iSperre >= 0 && iReturn >= 0, 'Sperre oder return fehlen');
  assert.ok(iSperre < iReturn, 'die Sperre steht hinter dem return und laeuft nie');
});

test('#109: spawnBoss gibt den Boss zurueck', () => {
  // Ohne Rueckgabewert kann wave.js nichts registrieren; __climaxEnemy waere
  // undefined und die Sperre wuerde uebersprungen.
  const ENEMY = lies('enemy.js');
  const fn = block(ENEMY, 'function spawnBoss() {');
  assert.match(fn, new RegExp('return boss;'),
    'spawnBoss liefert nichts — der Aufrufer hat keinen Gegner zum Fuehren');
});

test('#109: der Mini-Boss-Zweig sperrt weiterhin (keine Regression)', () => {
  const mini = block(WAVE, 'if (isMiniBossWave && typeof spawnMiniBoss === \'function\') {');
  assert.match(mini, /window\.__climaxEnemy\s*=/);
  assert.match(mini, /lockStairs\(/);
});
