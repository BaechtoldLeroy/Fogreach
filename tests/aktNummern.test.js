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

test('Die Titelkarte zaehlt: Prolog ohne Nummer, dann Akt 1 bis 4 (Stufe 1b)', () => {
  // Story v6.1: Der Dienst ist der Prolog, danach vier Akte. Intern bleiben
  // die Indizes 0-4, die Nummer fuer den Spieler IST der Index.
  resetStore();
  globalThis.window.i18n = undefined;
  delete globalThis.window.storySystem;
  loadGameModule('js/storySystem.js');
  const S = globalThis.window.storySystem;
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((i) => S.aktNummer(i)), [0, 1, 2, 3, 4]);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((i) => S.aktLabel(i)), ['Prolog', 'Akt 1', 'Akt 2', 'Akt 3', 'Akt 4']);
  assert.strictEqual(S.AKT_ANZAHL, 4);
  S.resetToAct0();
  S.advanceToAct(2);
  const karte = S.consumePendingEvent();
  assert.deepStrictEqual([karte.actNumber, karte.actLabel], [2, 'Akt 2']);
  S.resetToAct0();
  const start = S.startaktEreignis('Text');
  assert.deepStrictEqual([start.actNumber, start.actLabel], [0, 'Prolog']);
});

test('Die Druckerei nennt dieselbe Zahl wie der Splashscreen', () => {
  // requireAct 2 ist der Index von "Das Doppelspiel" — fuer den Spieler Akt 2.
  const ph = frisch(0);
  const stark = ph.getEdictCatalog().filter((e) => e.tier === 'strong')[0];
  assert.ok(stark, 'keine starke Stufe im Katalog');
  assert.strictEqual(stark.requireAct, 2, 'der Index hat sich geaendert — Test nachziehen');

  const r = ph.publishEdict(stark.id);
  assert.strictEqual(r.success, false, 'die gesperrte Stufe liess sich drucken');
  assert.strictEqual(r.reasonKey, 'locked', 'kein erkennbarer Sperr-Grund');
  assert.strictEqual(r.req, 2,
    'die Druckerei nennt Akt ' + r.req + ', die Titelkarte nennt denselben Akt 2');
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
  // Die alte Textfassung der Druckerei im Hub ist weg (b436); die Sperre
  // steht jetzt auf den Karten der Druckerei-Szene.
  const hub = fs.readFileSync('js/scenes/HubSceneV2.js', 'utf8');
  assert.ok(!/ab Akt ' \+ e\.requireAct\b/.test(hub),
    'der Hub zeigt den Index wieder roh');
  const druckerei = fs.readFileSync('js/scenes/PrintingHouseScene.js', 'utf8');
  assert.ok(!/req: e\.requireAct\b/.test(druckerei), 'die Druckerei zeigt den Index roh');
  assert.ok(/_aktNummer\(e\.requireAct\)/.test(druckerei),
    'in der Druckerei fehlt die Umrechnung auf die Spieler-Zaehlung');
});
