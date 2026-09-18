// tests/elaraIdentitaet.test.js — Elaras Identitaet bleibt bis zum Wiedersehen verborgen (#155).
//
// Story-Bibel v5: Elara ist Harrens Tochter, aber das erfaehrt der Spieler
// erst am Ende von Akt 2, beim Wiedersehen. Vorher stand es ueberall: Harren
// sagte "Meine Tochter Elara" schon im Prolog, und Elara begruesste den
// Spieler bei der ersten Begegnung mit "Vater hat also doch jemanden
// geschickt". Die Enthuellung war keine.
//
// Jetzt heisst die Tochter buergerlich LENE; "Elara" ist ihr Name im
// Widerstand. Dieser Test haelt fest, dass bis einschliesslich Akt 2
// (Das Doppelspiel) keine Zeile die beiden verbindet.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
require('./setup');   // stellt globalThis.window bereit
const { loadGameModule } = require('./loadGameModule');

const WURZEL = path.join(__dirname, '..');
const lies = (f) => fs.readFileSync(path.join(WURZEL, f), 'utf8');

// Akt-Indizes (storySystem.STORY_ACTS): 0 Dienst, 1 Treuer Diener,
// 2 Doppelspiel, 3 Enttarnung, 4 Verrat. Das Wiedersehen liegt am Ende von 2.
const VOR_DEM_WIEDERSEHEN = 2;

function questTexte(q) {
  return [q.title, q.description, q.dialogueOffer, q.dialogueProgress, q.dialogueComplete]
    .filter((t) => typeof t === 'string').join('\n');
}

test('Harren nennt seine Tochter vor dem Wiedersehen nie Elara', () => {
  globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
  delete globalThis.window.questSystem;
  loadGameModule('js/questSystem.js');
  const qs = globalThis.window.questSystem;
  const alle = Object.values(qs.QUEST_DEFINITIONS || {});
  assert.ok(alle.length > 20, 'Quests nicht geladen (' + alle.length + ')');
  const verstoss = alle
    .filter((q) => q.npcId === 'harren' && (q.requiredAct || 0) <= VOR_DEM_WIEDERSEHEN)
    .filter((q) => /Elara/.test(questTexte(q)))
    .map((q) => q.id);
  assert.deepStrictEqual(Array.from(verstoss), [], 'Harren nennt Elara in: ' + verstoss.join(', '));
});

test('Elara verraet vor dem Wiedersehen nicht, wer sie ist', () => {
  globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
  delete globalThis.window.questSystem;
  loadGameModule('js/questSystem.js');
  const qs = globalThis.window.questSystem;
  const alle = Object.values(qs.QUEST_DEFINITIONS || {});
  const verstoss = alle
    .filter((q) => q.npcId === 'elara' && (q.requiredAct || 0) <= VOR_DEM_WIEDERSEHEN)
    .filter((q) => /\bVater\b|Tochter|geflohen|nicht entführt/.test(questTexte(q)))
    .map((q) => q.id);
  assert.deepStrictEqual(Array.from(verstoss), [], 'Elara verraet sich in: ' + verstoss.join(', '));
});

test('Hub und Keller verbinden Lene und Elara nicht', () => {
  // Die Stellen, an denen es frueher stand. Als Quelltext geprueft, weil sie
  // an Szenen haengen, die sich ohne laufendes Spiel nicht aufrufen lassen.
  const hub = lies('js/scenes/hub/hubLayout.js');
  assert.ok(!/Tochter Elara|daughter Elara/.test(hub), 'Harren sagt im Hub noch "Tochter Elara"');

  const keller = lies('js/roomManager.js');
  assert.ok(!/Vater hat also|Harrens Tochter|Bring das zu Vater|Father did send|Harren\\'s daughter/.test(keller),
    'Elaras Kellerbegegnung verraet noch, dass sie die Tochter ist');

  const story = lies('js/storySystem.js');
  const harren = /harren: \{[\s\S]*?\n    \},/.exec(story);
  assert.ok(harren, 'Harrens Dialogtabelle nicht gefunden');
  const frueh = /auftrag: \[[\s\S]*?\],\s*treuer_diener: \[[\s\S]*?\],\s*erste_risse: \[[\s\S]*?\]/.exec(harren[0]);
  assert.ok(frueh, 'Harrens Zeilen fuer Akt 0-2 nicht gefunden');
  assert.ok(!/Elara/.test(frueh[0]), 'Harren nennt Elara in seinen Zeilen fuer Akt 0-2');

  const elara = /elara: \{[\s\S]*?erste_risse: \[([\s\S]*?)\]/.exec(story);
  assert.ok(elara, 'Elaras Dialogtabelle nicht gefunden');
  assert.ok(!/geflohen|entführt|Tochter/.test(elara[1]), 'Elaras Zeilen in Akt 2 verraten sie');
});
