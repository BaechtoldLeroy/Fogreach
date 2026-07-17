// #63 Nachtrag: Slot-Wechsel OHNE Modul-Neuinitialisierung.
//
// Die Satelliten-Module laden ihren Zustand einmal beim Init und halten ihn im
// Speicher (init() ist gelatcht). Wechselt man den Slot, ohne dass die Module
// neu initialisieren, behalten sie den Zustand des ALTEN Slots — und schreiben
// ihn beim naechsten _persist() in den NEUEN. Genau so ging der Wissensbaum
// zwischen Spielstaenden verloren.
//
// tests/saveSlotsIntegration.test.js sieht das NICHT: dort wird das Modul pro
// Slot neu geladen (`delete window.X; loadGameModule(...)`) — das entspricht
// einem Seiten-Reload, den die UI beim Slot-Wechsel aber gerade nicht machte.
// Diese Datei modelliert bewusst den anderen Fall: Slot wechseln, Modul lebt
// weiter. Das ist der Zustand, den der Reload in startScene.js verhindert.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function boot(modules) {
  resetStore();
  delete globalThis.window.SaveSlots;
  delete globalThis.window.SlotStorage;
  loadGameModule('js/saveSlots.js');
  modules.forEach((m) => loadGameModule(m));
  return globalThis.window.SaveSlots;
}

beforeEach(() => { resetStore(); });

test('KnowledgeTree: init() ist gelatcht — ein Slot-Wechsel allein laedt nicht neu', () => {
  delete globalThis.window.KnowledgeTree;
  const S = boot(['js/knowledgeTree.js']);
  const KT = globalThis.window.KnowledgeTree;

  S.setActiveSlot(1);
  KT.init();
  KT.addFragments(7);
  assert.strictEqual(KT.getFragments(), 7);

  // Slot wechseln, wie es scene.restart() taete: Modul bleibt am Leben.
  S.setActiveSlot(2);
  KT.init(); // no-op wegen der Latch

  // DAS ist der Fehler, den der Spieler gesehen hat: Slot 2 zeigt die
  // Fragmente aus Slot 1. Der Test haelt das Verhalten fest, damit klar ist,
  // WARUM startScene.js beim Slot-Wechsel die Seite neu laedt.
  assert.strictEqual(KT.getFragments(), 7,
    'ohne Neuinitialisierung behaelt das Modul den alten Slot-Zustand');

  // Und schlimmer: es schreibt ihn in den neuen Slot.
  KT.addFragments(1);
  const slot2Blob = localStorage.getItem('demonfall.slot2.demonfall.knowledgeTree.v1');
  assert.ok(slot2Blob && JSON.parse(slot2Blob).fragments === 8,
    'der Stand aus Slot 1 landet in Slot 2 — deshalb der Reload');
});

test('KnowledgeTree: nach echter Neuinitialisierung ist der Slot sauber getrennt', () => {
  delete globalThis.window.KnowledgeTree;
  const S = boot(['js/knowledgeTree.js']);
  globalThis.window.KnowledgeTree.init();
  S.setActiveSlot(1);
  globalThis.window.KnowledgeTree.addFragments(7);

  // Das macht der Reload: Modul frisch, liest den aktiven Slot.
  S.setActiveSlot(2);
  delete globalThis.window.KnowledgeTree;
  loadGameModule('js/knowledgeTree.js');
  const KT2 = globalThis.window.KnowledgeTree;
  KT2.init();
  assert.strictEqual(KT2.getFragments(), 0, 'Slot 2 startet mit 0 Fragmenten');

  KT2.addFragments(3);
  assert.strictEqual(KT2.getFragments(), 3);

  // Zurueck zu Slot 1 — der alte Stand ist unberuehrt.
  S.setActiveSlot(1);
  delete globalThis.window.KnowledgeTree;
  loadGameModule('js/knowledgeTree.js');
  const KT3 = globalThis.window.KnowledgeTree;
  KT3.init();
  assert.strictEqual(KT3.getFragments(), 7, 'Slot 1 hat weiterhin 7 Fragmente');
});

test('startScene laedt bei Slot-Wechsel/Loeschen neu und startet nach dem Wipe automatisch', () => {
  // startScene.js ist eine Phaser-Szene und nicht unit-ladbar. Der Reload ist
  // aber die einzige Absicherung gegen den Stale-State oben — darum wenigstens
  // als Quelltext-Vertrag festhalten, damit ein Rueckbau auf scene.restart()
  // auffaellt.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'scenes', 'startScene.js'), 'utf8');

  assert.ok(/function _reloadForSlotChange\(\)/.test(src), '_reloadForSlotChange existiert');
  assert.ok(/window\.location\.reload\(\)/.test(src), 'der Slot-Wechsel laedt die Seite neu');

  // Alle drei Pfade (Zeile waehlen / ✕ / Neues Spiel) muessen darueber gehen.
  const calls = (src.match(/_reloadForSlotChange\(\)/g) || []).length;
  assert.ok(calls >= 4, 'Slot-Wechsel, Loeschen und Neues Spiel laden neu (gefunden: ' + calls + ')');

  // Und der Reload darf "Neues Spiel" nicht im Menue enden lassen.
  assert.ok(/_NEW_GAME_FLAG/.test(src) && /sessionStorage/.test(src),
    'nach dem Reload startet das neue Spiel automatisch weiter');
});
