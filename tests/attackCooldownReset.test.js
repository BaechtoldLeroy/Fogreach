// Regression #106: attackCooldown / isAttacking bleiben nach einem
// Szenenwechsel haengen -> der Spieler kann NIE WIEDER angreifen.
//
// Mechanik: beide Flaggen werden ausschliesslich im Rueckruf eines
// scene.time-Timers zurueckgesetzt (player.js:1837 Bogen, :1961 Nahkampf).
// Der Timer stirbt mit der Szene, die Flaggen sind aber Modul-let und
// ueberleben sie. create() setzte die drei uebrigen Sperrflaggen zurueck
// (isChargingSlash/isDashing/isRolling) — ausgerechnet diese zwei nicht.
//
// Gemessen mit dem Spieltest-Bot (#96): 504 Angriffsaufrufe, 0 ausgefuehrt,
// waehrend ein Gegner mit 2 HP 7 px entfernt stand — fuenf Stillstaende in Folge.
//
// Bewusst OHNE Backslash-Escapes geschrieben: beim Erzeugen der Datei ging
// zweimal ein Backslash verloren, die Pruefung war dadurch stumm falsch und
// meldete alle fuenf Flaggen als fehlend, obwohl zwei dastanden.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LF = String.fromCharCode(10);
const lies = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

/** Die Zeilen von create() bis kurz dahinter, getrimmt. */
function createZeilen() {
  const s = lies('main.js');
  const i = s.indexOf('function create() {');
  assert.ok(i >= 0, 'create() nicht gefunden');
  return s.slice(i, i + 3000).split(LF).map((z) => z.trim());
}

/** Alle Flaggen, die in create() auf false gesetzt werden. */
function zurueckgesetzt() {
  const treffer = new Set();
  createZeilen().forEach((z) => {
    const teile = z.split(' ');
    if (teile.length === 3 && teile[1] === '=' && teile[2] === 'false;') treffer.add(teile[0]);
  });
  return treffer;
}

test('#106: create() setzt attackCooldown zurueck', () => {
  assert.ok(zurueckgesetzt().has('attackCooldown'),
    'ohne diesen Reset bleibt eine haengende Sperre ueber den Szenenwechsel bestehen');
});

test('#106: create() setzt isAttacking zurueck', () => {
  assert.ok(zurueckgesetzt().has('isAttacking'));
});

test('#106: alle fuenf Sperrflaggen aus attack() werden in create() zurueckgesetzt', () => {
  // Die Sperre in attack() (player.js:1807) prueft genau diese fuenf. Wer eine
  // davon per Timer aufraeumt, MUSS sie beim Szenenstart zuruecksetzen.
  const gesetzt = zurueckgesetzt();
  const flaggen = ['attackCooldown', 'isAttacking', 'isDashing', 'isChargingSlash', 'isRolling'];
  const fehlend = flaggen.filter((f) => !gesetzt.has(f));
  assert.deepStrictEqual(fehlend, [],
    'diese Sperrflaggen werden beim Szenenstart NICHT zurueckgesetzt: ' + fehlend.join(', '));
});

test('#106: attackCooldown wird sonst nur in Timer-Rueckrufen geloescht', () => {
  // Belegt die Ursache: gaebe es einen timer-unabhaengigen Reset, waere der
  // Fix ueberfluessig. Schlaegt dieser Test um, ist die Annahme veraltet.
  const player = lies('player.js');
  const treffer = player.split('attackCooldown = false').length - 1;
  assert.strictEqual(treffer, 2,
    'erwartet: genau zwei Ruecksetzungen (Bogen- und Nahkampf-Pfad), beide im Timer');
});
