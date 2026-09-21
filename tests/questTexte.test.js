// tests/questTexte.test.js — Questtexte passen zu ihren Zielen und zur Story (#81).
//
// Beim Umbau von v3 auf v4 auf v5 wurden Ziele geaendert, Texte nicht immer.
// Gefunden: "Aldric sagt, Eindringlinge haetten sie entfuehrt" (v3), "Elara
// wartet mit den drei Blaettern" (v4), ein Archiv-Akt, der "Harren noch nichts
// sagen" will, obwohl Harren ihn in Auftrag gibt. Dieser Test haelt fest, was
// der Durchgang geprueft hat.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
loadGameModule('js/questSystem.js');
const D = globalThis.window.questSystem.QUEST_DEFINITIONS;
const FELDER = ['title', 'description', 'dialogueOffer', 'dialogueProgress', 'dialogueComplete'];

test('Keine Reste aus v3/v4 in den Questtexten', () => {
  const ALT = [
    [/Eindringling/, 'v3: Eindringlinge'],
    [/drei Blättern|Blätter-Mechanik/, 'v4: Blaetter'],
    [/Ich sage Harren noch nichts/, 'Harren ist der Auftraggeber'],
    [/Patrouillen verdoppeln sich/, 'die Verdoppelung ist die Pointe der geheimen Sitzung'],
    [/Der Rat fällt heute/, 'v4: Sturm auf den Rat nach dem Finale'],
    [/Nebelschleuse/, 'v4: Finalort']
  ];
  const treffer = [];
  Object.keys(D).forEach((id) => FELDER.forEach((f) => {
    const t = D[id][f] || '';
    ALT.forEach(([re, grund]) => { if (re.test(t)) treffer.push(id + '.' + f + ' (' + grund + ')'); });
  }));
  assert.deepStrictEqual(treffer, []);
});

// Zahlwoerter bis zwoelf und Ziffern. "Tiefe 3" oder "Welle 30" sind Orte,
// keine Mengen, und bleiben aussen vor.
const ZAHL = { ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12 };
function mengen(text) {
  const out = [];
  const re = /(Tiefe|Welle|Stufe)\s+\d+|(\d+)|\b(zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) continue;
    out.push(m[2] ? Number(m[2]) : ZAHL[m[3].toLowerCase()]);
  }
  return out;
}

test('Mengen in der Beschreibung stimmen mit dem Ziel ueberein', () => {
  const falsch = [];
  Object.keys(D).forEach((id) => {
    const obs = D[id].objectives || [];
    const erlaubt = new Set(obs.map((o) => o.required));
    // Zwei Schritte zu je 1 zaehlen als "zwei" (z. B. drucken, aushaengen).
    erlaubt.add(obs.length);
    // Inhalt, keine Menge: "drei Edikte" (die drei Fraktionen, #160).
    if (id === 'faction_campaign') erlaubt.add(3);
    mengen(D[id].description || '').forEach((n) => {
      if (!erlaubt.has(n)) falsch.push(id + ': "' + n + '" in der Beschreibung, Ziel ' + [...erlaubt].join('/'));
    });
  });
  assert.deepStrictEqual(falsch, []);
});

test('Wer den Auftrag gibt, wird im Abschlusstext nicht als Dritter behandelt', () => {
  // espionage_archive gibt Harren; der Abschluss sprach von ihm, als sei er nicht da.
  const t = D.espionage_archive.dialogueComplete;
  assert.ok(/Harren liest/.test(t), t);
});

test('Die Beschlagnahme laesst die Wahl beim Abgeben offen', () => {
  // Die Entscheidung "abgeben / heimlich behalten" faellt in storyDialog; der
  // Abschlusstext darf sie nicht vorwegnehmen.
  assert.ok(!/gibst sie trotzdem ab/.test(D.council_seizure.dialogueComplete));
});
