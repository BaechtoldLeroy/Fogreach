// tests/bonusTruhe.test.js — Die Bonus-Truhe eines Spezialraums wird GENAU
// EINMAL entschieden.
//
// Nutzerbefund: der Altar wurde zerstoert, es gab trotzdem eine Truhe.
//
// Ursache: markRoomCleared wird ZWEIMAL gerufen — einmal vom Raum-Modus selbst
// (mit failed:true, sobald das Ziel ausgeht) und danach nochmal von der
// Wellen-Kette nach dem letzten Kill. Der Erfolgsfall setzte einen Merker
// (room._bonusGranted), der Fehlschlag NICHT. Der zweite Aufruf wertete die
// Frage deshalb neu aus und vergab die Truhe doch.
//
// Am laufenden Spiel gemessen (Verteidigungsraum, Ziel verfehlt):
//   vorher : markRoomCleared({objective:true,failed:true}) -> 0 Truhen
//            danach markRoomCleared({})                    -> 1 Truhe
//   nachher: 0 und 0. Erfolgsfall unveraendert 1, ohne Verdoppelung.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');

function bonusBlock() {
  const i = QUELLE.indexOf('Bonus-Chest bei erfolgreich abgeschlossenem SPEZIAL-Raum');
  assert.ok(i > 0, 'Bonus-Truhen-Block nicht gefunden');
  return QUELLE.slice(i, i + 2600);
}

test('Der Ausgang wird festgehalten, nicht spaeter neu bewertet', () => {
  const b = bonusBlock();
  assert.ok(/_bonusEntschieden\s*=\s*true/.test(b),
    'ohne diesen Merker vergibt ein zweiter markRoomCleared-Aufruf die Truhe doch');
  assert.ok(/_bonusVerfehlt/.test(b),
    'der Fehlschlag muss festgehalten werden, nicht nur der Erfolg');
});

test('Das uebergebene failed zaehlt mit, nicht nur die Abfrage am Modus', () => {
  // Der Aufrufer weiss im Moment des Abschlusses, wie der Raum ausging. Eine
  // spaetere Abfrage am Modus kann schon veraendert sein (disarm, reset,
  // Raumwechsel).
  const b = bonusBlock();
  assert.ok(/opts\s*&&\s*opts\.failed/.test(b),
    'opts.failed wird nicht ausgewertet');
});

test('Die Truhe gibt es weiterhin nur bei erfuelltem Ziel', () => {
  // Sonst waere "gar keine Truhe mehr" eine bestandene Loesung.
  const b = bonusBlock();
  assert.ok(/!_verfehlt/.test(b), 'die Erfolgsbedingung fehlt');
  assert.ok(/_bonusGranted\s*=\s*true/.test(b), 'die Einmal-Vergabe fehlt');
  assert.ok(/chest_large/.test(b), 'es wird keine Truhe mehr abgelegt');
});
