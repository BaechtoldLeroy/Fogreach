// tests/aktNummern.test.js — eine Zaehlung fuer den Spieler.
//
// Intern sind Akte INDIZES in STORY_ACTS (0..4). Der Splashscreen zeigt
// dagegen "Akt " + (index + 1). Wo ein Index roh in die Oberflaeche
// durchschlug, sah der Spieler zwei Zahlen fuer denselben Akt: die Druckerei
// sagte "Ab Akt 2" fuer eine Stufe, die aufgeht, waehrend oben "Akt 3" steht.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function frisch(aktIndex) {
  resetStore();
  delete globalThis.window.PrintingHouse;
  globalThis.window.storySystem = { getCurrentActIndex: () => aktIndex };
  loadGameModule('js/printingHouse.js');
  return globalThis.window.PrintingHouse;
}

test('Der Splashscreen zaehlt ab 1 — das ist die Zaehlung fuer den Spieler', () => {
  const src = fs.readFileSync('js/storySystem.js', 'utf8');
  assert.ok(/actNumber:\s*storyState\.currentActIndex \+ 1/.test(src),
    'die Uebersicht zaehlt nicht mehr ab 1');
  assert.ok(/actNumber:\s*act \? STORY_ACTS\.indexOf\(act\) \+ 1/.test(src),
    'der Aktwechsel zaehlt nicht mehr ab 1');
});

test('Die Druckerei nennt dieselbe Zahl wie der Splashscreen', () => {
  // requireAct 2 ist der Index von "Das Doppelspiel" — fuer den Spieler Akt 3.
  const ph = frisch(0);
  const stark = ph.getEdictCatalog().filter((e) => e.tier === 'strong')[0];
  assert.ok(stark, 'keine starke Stufe im Katalog');
  assert.strictEqual(stark.requireAct, 2, 'der Index hat sich geaendert — Test nachziehen');

  const r = ph.publishEdict(stark.id);
  assert.strictEqual(r.success, false, 'die gesperrte Stufe liess sich drucken');
  assert.strictEqual(r.reasonKey, 'locked', 'kein erkennbarer Sperr-Grund');
  assert.strictEqual(r.req, 3,
    'die Druckerei nennt Akt ' + r.req + ', der Splashscreen nennt denselben Akt 3');
});

test('Der Sperr-Grund kommt uebersetzbar, nicht als Entwicklersatz', () => {
  // Er landet als Toast beim Spieler. Vorher stand da ein englischer Satz
  // mitten in der deutschen Oberflaeche.
  const ph = frisch(0);
  const stark = ph.getEdictCatalog().filter((e) => e.tier === 'strong')[0];
  const r = ph.publishEdict(stark.id);
  assert.strictEqual(typeof r.reasonKey, 'string', 'kein Schluessel zum Uebersetzen');
  assert.strictEqual(typeof r.req, 'number', 'keine Zahl zum Einsetzen');
});

test('Ist der Akt erreicht, faellt die Sperre', () => {
  // Gegenprobe: sonst pruefte der Test nur, dass nie etwas geht.
  const ph = frisch(2);
  const stark = ph.getEdictCatalog().filter((e) => e.tier === 'strong')[0];
  const r = ph.publishEdict(stark.id);
  assert.notStrictEqual(r.reasonKey, 'locked',
    'die Stufe bleibt gesperrt, obwohl ihr Akt laeuft');
});

test('Keine Oberflaeche zeigt requireAct mehr roh', () => {
  // Der eigentliche Fehler war ein Index in der Anzeige. Wer ihn wieder
  // einbaut, faellt hier auf.
  const hub = fs.readFileSync('js/scenes/HubSceneV2.js', 'utf8');
  assert.ok(!/ab Akt ' \+ e\.requireAct\b/.test(hub),
    'der Hub zeigt den Index wieder roh');
  assert.ok(/ab Akt ' \+ \(\(e\.requireAct \| 0\) \+ 1\)/.test(hub),
    'im Hub fehlt die Umrechnung auf die Spieler-Zaehlung');
});
