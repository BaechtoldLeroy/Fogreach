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
//
// NACHTRAG: das war nur die HAELFTE. Es gibt zwei Belohnungswege beim
// Raumabschluss — den Bonus-Chest fuers erfuellte Spezialziel und den Lohn
// fuers Leerraeumen eines prozeduralen Raums. Nur der erste fragte nach dem
// Ziel; der zweite zahlte weiter (in einem Viertel der Faelle eine grosse
// Truhe). Die Entscheidung faellt darum jetzt VOR beiden Bloecken.
//
// Diese Datei prueft die Form des Codes, nicht sein Verhalten — sie kann nur
// belegen, dass die Vorkehrungen noch dastehen. Das VERHALTEN misst
// tests/headlessCombat.test.js ("Ein verfehltes Raumziel gibt gar keine
// Belohnung") im echten Dungeon ueber beide Wege.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const QUELLE = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'roomManager.js'), 'utf8');

// Vom Beginn der Entscheidung bis zum Ende der Bonus-Truhen-Vergabe. Die
// Entscheidung steht seit b161 VOR dem prozeduralen Raum-Lohn, weil sie fuer
// beide Belohnungswege gilt — der Ausschnitt umfasst deshalb beide.
function bonusBlock() {
  const i = QUELLE.indexOf('Verfehltes Raumziel: EINMAL entscheiden');
  assert.ok(i > 0, 'Entscheidungsblock nicht gefunden');
  const j = QUELLE.indexOf('Bonus-Chest darf den Raum-Abschluss nie brechen', i);
  assert.ok(j > i, 'Ende der Bonus-Vergabe nicht gefunden');
  return QUELLE.slice(i, j);
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

test('Auch der prozedurale Raum-Lohn fragt nach dem Ziel', () => {
  // Der zweite Belohnungsweg. Er fragte gar nicht — wer den Altar verlor und
  // danach die Wellen raeumte, bekam trotzdem etwas, in einem Viertel der
  // Faelle eine grosse Truhe. Gemessen ueber 40 Durchgaenge: vorher 40
  // Belohnungen trotz verlorenem Altar, danach 0.
  const b = bonusBlock();
  assert.ok(/_rewardGranted\s*=\s*true/.test(b),
    'ohne den Merker vergibt der zweite markRoomCleared-Aufruf den Lohn doch');
  assert.ok(/_spezial\s*&&\s*_zielVerfehlt/.test(b),
    'der Raum-Lohn prueft das verfehlte Ziel nicht');
});

test('Die Truhe gibt es weiterhin nur bei erfuelltem Ziel', () => {
  // Sonst waere "gar keine Truhe mehr" eine bestandene Loesung.
  const b = bonusBlock();
  assert.ok(/!_zielVerfehlt/.test(b), 'die Erfolgsbedingung fehlt');
  assert.ok(/_bonusGranted\s*=\s*true/.test(b), 'die Einmal-Vergabe fehlt');
  assert.ok(/chest_large/.test(b), 'es wird keine Truhe mehr abgelegt');
});
