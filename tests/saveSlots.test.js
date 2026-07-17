// Unit tests fuer js/saveSlots.js (#63 — mehrere Speicherslots).
//
// Diese Schicht entscheidet, welcher Key in welchem Slot landet. Ein Fehler
// hier bedeutet: Slots ueberschreiben sich gegenseitig oder ein Alt-Spielstand
// verschwindet. Entsprechend eng abgesteckt.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function fresh() {
  delete globalThis.window.SaveSlots;
  delete globalThis.window.SlotStorage;
  loadGameModule('js/saveSlots.js'); // migriert beim Laden
  return globalThis.window.SaveSlots;
}

beforeEach(() => { resetStore(); });

// --- Key-Namespacing -------------------------------------------------------

test('Fortschritts-Keys bekommen einen Slot-Praefix, globale nicht', () => {
  const S = fresh();
  assert.strictEqual(S.key('demonfall_save_v1'), 'demonfall.slot1.demonfall_save_v1');
  assert.strictEqual(S.key('demonfall.skillTree.v1'), 'demonfall.slot1.demonfall.skillTree.v1');
  // Settings/Audio/Schwierigkeit gelten geraeteweit -> unveraendert
  assert.strictEqual(S.key('demonfall_settings_v1'), 'demonfall_settings_v1');
  assert.strictEqual(S.key('demonfall_audio'), 'demonfall_audio');
  assert.strictEqual(S.key('demonfall_lastDifficulty'), 'demonfall_lastDifficulty');
  assert.strictEqual(S.key('demonfall_endless_best'), 'demonfall_endless_best');
});

test('der aktive Slot bestimmt den Praefix', () => {
  const S = fresh();
  S.setActiveSlot(2);
  assert.strictEqual(S.key('demonfall_save_v1'), 'demonfall.slot2.demonfall_save_v1');
  S.setActiveSlot(3);
  assert.strictEqual(S.key('demonfall_save_v1'), 'demonfall.slot3.demonfall_save_v1');
  // explizites Slot-Argument sticht den aktiven Slot
  assert.strictEqual(S.key('demonfall_save_v1', 1), 'demonfall.slot1.demonfall_save_v1');
});

test('ungueltige Slots werden abgewiesen, der aktive bleibt erhalten', () => {
  const S = fresh();
  S.setActiveSlot(2);
  [0, 4, -1, 'x', null, undefined, NaN].forEach((bad) => {
    S.setActiveSlot(bad);
    assert.strictEqual(S.getActiveSlot(), 2, 'Slot ' + String(bad) + ' darf nichts aendern');
  });
});

test('unbekannte Keys gelten als Fortschritt (sichere Richtung)', () => {
  const S = fresh();
  // Ein vergessener Fortschritts-Key duerfte NIE zwischen Slots geteilt werden.
  assert.strictEqual(S.key('demonfall_irgendwas_neues'), 'demonfall.slot1.demonfall_irgendwas_neues');
});

// --- Slot-Isolation (der eigentliche Zweck) --------------------------------

test('SlotStorage trennt Fortschritt zwischen Slots', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;

  S.setActiveSlot(1);
  St.setItem('demonfall_save_v1', '{"playerLevel":5}');
  S.setActiveSlot(2);
  assert.strictEqual(St.getItem('demonfall_save_v1'), null, 'Slot 2 startet leer');

  St.setItem('demonfall_save_v1', '{"playerLevel":9}');
  S.setActiveSlot(1);
  assert.strictEqual(St.getItem('demonfall_save_v1'), '{"playerLevel":5}', 'Slot 1 ist unveraendert');
  S.setActiveSlot(2);
  assert.strictEqual(St.getItem('demonfall_save_v1'), '{"playerLevel":9}');
});

test('SlotStorage teilt globale Keys ueber alle Slots', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;

  S.setActiveSlot(1);
  St.setItem('demonfall_settings_v1', '{"language":"en"}');
  S.setActiveSlot(3);
  assert.strictEqual(St.getItem('demonfall_settings_v1'), '{"language":"en"}',
    'Sprache/Lautstaerke gelten fuer alle Spielstaende');
});

test('removeItem trifft nur den eigenen Slot', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;
  S.setActiveSlot(1); St.setItem('demonfall_save_v1', 'A');
  S.setActiveSlot(2); St.setItem('demonfall_save_v1', 'B');
  St.removeItem('demonfall_save_v1');
  assert.strictEqual(St.getItem('demonfall_save_v1'), null, 'Slot 2 ist geloescht');
  S.setActiveSlot(1);
  assert.strictEqual(St.getItem('demonfall_save_v1'), 'A', 'Slot 1 lebt weiter');
});

// --- Migration des Alt-Spielstands -----------------------------------------

test('Migration hebt den Alt-Spielstand nach Slot 1', () => {
  resetStore();
  // Zustand VOR dem Update: un-praefixierte Keys.
  localStorage.setItem('demonfall_save_v1', '{"playerLevel":12}');
  localStorage.setItem('demonfall.skillTree.v1', '{"points":3}');
  localStorage.setItem('demonfall_maxDepth', '17');
  localStorage.setItem('demonfall_settings_v1', '{"language":"de"}');

  const S = fresh(); // migriert beim Laden
  const St = globalThis.window.SlotStorage;

  assert.strictEqual(S.getActiveSlot(), 1);
  assert.strictEqual(St.getItem('demonfall_save_v1'), '{"playerLevel":12}');
  assert.strictEqual(St.getItem('demonfall.skillTree.v1'), '{"points":3}');
  assert.strictEqual(St.getItem('demonfall_maxDepth'), '17');
  // Globale Keys werden nicht angefasst (sie waren nie slot-gebunden)
  assert.strictEqual(localStorage.getItem('demonfall_settings_v1'), '{"language":"de"}');
});

test('Migration laesst die Alt-Keys liegen (Rollback-Sicherheit)', () => {
  resetStore();
  localStorage.setItem('demonfall_save_v1', '{"playerLevel":12}');
  fresh();
  assert.strictEqual(localStorage.getItem('demonfall_save_v1'), '{"playerLevel":12}',
    'Alt-Key bleibt, damit die Vorversion nach einem Rollback noch laedt');
});

// Der Alt-Stand darf gespielten Fortschritt nie zurueckdrehen. Dagegen schuetzen
// ZWEI unabhaengige Mechanismen: der Migrations-Latch und der Ueberschreib-Schutz.
// Sie sind redundant — ein Test, der nur "Fortschritt ueberlebt zwei Boots"
// prueft, ist gruen, solange EINER von beiden lebt, und deckt damit keinen von
// beiden ab (mit Mutationstests verifiziert). Darum je ein Test, der den anderen
// Mechanismus gezielt ausschaltet.

test('Migration: der Latch verhindert einen zweiten Durchlauf', () => {
  resetStore();
  localStorage.setItem('demonfall_save_v1', '{"playerLevel":1}');
  const S = fresh();
  assert.strictEqual(S.migrateLegacySave().reason, 'already-done',
    'nach dem Boot ist die Migration gelatcht');

  // Ueberschreib-Schutz ausschalten, indem das Ziel geleert wird: jetzt haengt
  // alles am Latch. Ohne ihn wuerde der Alt-Stand erneut einwandern.
  localStorage.removeItem('demonfall.slot1.demonfall_save_v1');
  S.migrateLegacySave();
  assert.strictEqual(localStorage.getItem('demonfall.slot1.demonfall_save_v1'), null,
    'gelatchte Migration darf nichts mehr schreiben');
});

test('Migration: der Ueberschreib-Schutz rettet gespielten Fortschritt', () => {
  resetStore();
  localStorage.setItem('demonfall_save_v1', '{"playerLevel":1}');
  const S = fresh();
  const St = globalThis.window.SlotStorage;

  // Spieler spielt weiter -> Slot 1 ist aktueller als der liegengebliebene Alt-Key.
  St.setItem('demonfall_save_v1', '{"playerLevel":40}');

  // Latch ausschalten: jetzt haengt alles am Ueberschreib-Schutz.
  localStorage.removeItem('demonfall.slotsMigrated.v1');
  const res = S.migrateLegacySave();

  assert.strictEqual(St.getItem('demonfall_save_v1'), '{"playerLevel":40}',
    'Level 40 darf nicht auf den Alt-Stand Level 1 zurueckfallen');
  assert.strictEqual(res.migrated, false, 'nichts zu migrieren — Ziel war belegt');
});

test('Migration: zwei Boots hintereinander lassen den Fortschritt stehen', () => {
  resetStore();
  localStorage.setItem('demonfall_save_v1', '{"playerLevel":1}');
  fresh();
  globalThis.window.SlotStorage.setItem('demonfall_save_v1', '{"playerLevel":40}');
  fresh(); // zweiter Boot
  assert.strictEqual(globalThis.window.SlotStorage.getItem('demonfall_save_v1'),
    '{"playerLevel":40}');
});

test('Migration ohne Alt-Spielstand ist ein No-Op', () => {
  resetStore();
  const S = fresh();
  assert.strictEqual(S.getActiveSlot(), 1);
  assert.strictEqual(globalThis.window.SlotStorage.getItem('demonfall_save_v1'), null);
});

// --- Slot-Verwaltung -------------------------------------------------------

test('getSlotMeta liest die Vorschau aus dem Hauptsave', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;
  S.setActiveSlot(2);
  St.setItem('demonfall_save_v1', JSON.stringify({
    playerLevel: 7, dungeonDepth: 13, materials: { GOLD: 250 }, ts: 1234
  }));
  St.setItem('demonfall_maxDepth', '15');

  const m = S.getSlotMeta(2);
  assert.strictEqual(m.exists, true);
  assert.strictEqual(m.level, 7);
  assert.strictEqual(m.depth, 13);
  assert.strictEqual(m.gold, 250);
  assert.strictEqual(m.maxDepth, 15);
  assert.strictEqual(m.ts, 1234);

  assert.strictEqual(S.getSlotMeta(1).exists, false, 'leerer Slot');
});

test('getSlotMeta meldet einen kaputten Save als vorhanden', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;
  S.setActiveSlot(1);
  St.setItem('demonfall_save_v1', 'kein-json{{{');
  const m = S.getSlotMeta(1);
  // exists=false wuerde den Slot als frei anzeigen -> stilles Ueberschreiben.
  assert.strictEqual(m.exists, true, 'kaputter Save darf nicht als leer gelten');
  assert.strictEqual(m.level, 0);
});

test('listSlots liefert genau SLOT_COUNT Eintraege', () => {
  const S = fresh();
  const all = S.listSlots();
  assert.strictEqual(all.length, S.SLOT_COUNT);
  assert.deepStrictEqual(all.map((m) => m.slot), [1, 2, 3]);
});

test('deleteSlot loescht nur den eigenen Slot, Settings bleiben', () => {
  const S = fresh();
  const St = globalThis.window.SlotStorage;

  S.setActiveSlot(1); St.setItem('demonfall_save_v1', 'A'); St.setItem('demonfall.skillTree.v1', 'AT');
  S.setActiveSlot(2); St.setItem('demonfall_save_v1', 'B');
  localStorage.setItem('demonfall_settings_v1', 'SETTINGS');

  S.deleteSlot(1);

  assert.strictEqual(S.getSlotMeta(1).exists, false, 'Slot 1 ist leer');
  S.setActiveSlot(1);
  assert.strictEqual(St.getItem('demonfall.skillTree.v1'), null, 'auch Satelliten-Keys sind weg');
  S.setActiveSlot(2);
  assert.strictEqual(St.getItem('demonfall_save_v1'), 'B', 'Slot 2 bleibt unberuehrt');
  assert.strictEqual(localStorage.getItem('demonfall_settings_v1'), 'SETTINGS', 'Settings bleiben');
});

test('deleteSlot weist ungueltige Slots ab', () => {
  const S = fresh();
  [0, 4, -1, 'x'].forEach((bad) => assert.strictEqual(S.deleteSlot(bad), false));
});

test('jeder SLOT_KEY wird auch wirklich pro Slot behandelt', () => {
  const S = fresh();
  S.SLOT_KEYS.forEach((k) => {
    assert.ok(S.key(k).startsWith('demonfall.slot1.'), k + ' muss slot-gebunden sein');
    assert.ok(!S.isGlobalKey(k), k + ' darf nicht global sein');
  });
});

test('GLOBAL_KEYS und SLOT_KEYS ueberschneiden sich nicht', () => {
  const S = fresh();
  const overlap = S.SLOT_KEYS.filter((k) => S.GLOBAL_KEYS.indexOf(k) !== -1);
  assert.deepStrictEqual(overlap, [], 'ein Key kann nicht beides sein');
});
