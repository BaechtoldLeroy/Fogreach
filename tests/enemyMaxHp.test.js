// Regression #107: gewoehnliche Gegner hatten kein maxHp.
//
// spawnEnemy setzte enemy.hp, maxHp entstand aber nur in bedingten Zweigen:
// Edikt-Buff (enemy.js:776), Raum-Modus (:806), Elite (:1905), Boss (:2702).
// Ein normaler Gegner in einem normalen Raum blieb ohne.
//
// Gemessen in den Spieltest-Protokollen (#96), Format hp/maxHp:
//     6x  HP 2/undefined      3x  HP 3/undefined
//    11x  HP 83/83            (Elite/Boss — dort wird maxHp gesetzt)
//
// Der Rueckfall in enemy.js:1999 nimmt dann die AKTUELLE HP als Maximum. Ein
// Gegner mit 1 von 3 HP erscheint dadurch unversehrt, und jede Prozentrechnung
// (Hinrichtungs-Schwellen, Heilanteile) sitzt auf falscher Basis.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const LF = String.fromCharCode(10);
const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'js', 'enemy.js'), 'utf8');
const ZEILEN = QUELLE.split(LF).map((z) => z.trim());

test('#107: spawnEnemy setzt maxHp direkt neben hp', () => {
  const i = ZEILEN.findIndex((z) => z.startsWith('enemy.hp = Math.max(1, Math.round(hp * statScale));'));
  assert.ok(i >= 0, 'die hp-Zuweisung im Normalpfad wurde nicht gefunden');
  // Innerhalb der naechsten zehn Zeilen, damit keine Bedingung dazwischen passt.
  const fenster = ZEILEN.slice(i, i + 10);
  assert.ok(fenster.some((z) => z === 'enemy.maxHp = enemy.hp;'),
    'maxHp wird im Normalpfad nicht gesetzt — Gegner ohne Buff/Modus/Elite bleiben ohne Maximum');
});

test('#107: die Zuweisung steht unbedingt, nicht in einem if-Zweig', () => {
  const i = ZEILEN.findIndex((z) => z.startsWith('enemy.hp = Math.max(1, Math.round(hp * statScale));'));
  const j = ZEILEN.findIndex((z, k) => k > i && z === 'enemy.maxHp = enemy.hp;');
  assert.ok(j > i, 'Zuweisung nicht gefunden');
  // Zwischen hp und maxHp darf kein if/try/for stehen — sonst waere sie wieder bedingt.
  const dazwischen = ZEILEN.slice(i + 1, j)
    .filter((z) => z.startsWith('if ') || z.startsWith('if(') || z.startsWith('try') || z.startsWith('for '));
  assert.deepStrictEqual(dazwischen, [],
    'zwischen hp und maxHp steht eine Bedingung: ' + dazwischen.join(' | '));
});

test('#107: die bedingten Nachsetzer bleiben erhalten', () => {
  // Sie korrigieren maxHp nach einem Multiplikator und muessen weiter laufen.
  const treffer = QUELLE.split('enemy.maxHp = enemy.hp').length - 1;
  assert.ok(treffer >= 3,
    'erwartet: Normalpfad plus die bedingten Nachsetzer, gefunden ' + treffer);
});
