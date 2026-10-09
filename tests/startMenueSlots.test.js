// tests/startMenueSlots.test.js — Speicherplaetze und "Neues Spiel" im neuen
// Startmenue (#63): ✕ mit Rueckfrage leert den Slot, die Slot-Zeile waehlt
// den Slot, NEUES SPIEL setzt das Start-Flag und landet nach dem "Reload" im
// Hub. Eigene Datei (eigener Prozess), weil ein zweites Canvas-Spiel im selben
// Prozess wie startMenue.test.js den Speicher sprengt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let h = null;
before(async () => { h = await launch({ renderer: 'canvas', waitFor: 'StartScene' }); });
after(async () => { if (h) await h.shutdown(); });

const start = () => h.scene('StartScene');

/** StartScene neu aufbauen (wie nach dem Reload) und warten, bis sie laeuft. */
async function neuAufbauen() {
  start().scene.restart();
  h.step(1);
  assert.ok(await h.waitForScene('StartScene'), 'StartScene kam nicht wieder');
  h.step(2);
}

/** Oberstes interaktives Objekt an (x, y) — so, wie ein echter Tap es trifft. */
function oben(s, x, y) {
  const p = s.input.activePointer;
  p.position.x = x; p.position.y = y;
  return s.input.sortGameObjects(s.input.hitTestPointer(p), p)[0] || null;
}

test('Startmenue: Slot loeschen, Slot wechseln und Neues Spiel', async () => {
  h.run('(function () { window.playerLevel = 5; saveGame(); })()');
  await neuAufbauen();
  let m = start().menuKnoepfe;
  assert.ok(m.loeschen1 && m.fortsetzen, 'Spielstand nicht im Menue');

  // ✕ -> Rueckfrage -> Ja: der Slot ist leer, danach kein FORTSETZEN mehr.
  m.loeschen1.platte.emit('pointerdown');
  h.step(1);   // neue Knoepfe nimmt die Eingabe erst im naechsten Frame auf
  assert.ok(m.loeschenJa && m.loeschenNein, 'keine Rueckfrage');
  assert.ok(oben(start(), m.loeschenJa.platte.x, m.loeschenJa.platte.y) === m.loeschenJa.platte,
    'Ja-Knopf der Rueckfrage verdeckt');
  m.loeschenJa.platte.emit('pointerdown');
  assert.strictEqual(h.run('hasSave()'), false, 'Slot nach dem Loeschen nicht leer');
  await neuAufbauen();
  m = start().menuKnoepfe;
  assert.ok(!m.fortsetzen, 'FORTSETZEN nach dem Loeschen');

  // Slot-Zeile waehlt den Slot (danach Reload; hier: Szene neu).
  m.slot2.platte.emit('pointerdown');
  assert.strictEqual(h.window.SaveSlots.getActiveSlot(), 2, 'Slot 2 nicht gewaehlt');
  await neuAufbauen();
  assert.ok(/▸/.test(start().menuKnoepfe.slot2.text.text), 'Slot 2 nicht als aktiv markiert');
  assert.strictEqual(start().menuKnoepfe.slot2.platte.frame.name, 1, 'aktiver Slot leuchtet nicht');

  // Neues Spiel: Flag setzen, "Reload" -> startet von selbst in den Hub.
  start().menuKnoepfe.neuesSpiel.platte.emit('pointerdown');
  assert.notStrictEqual(h.window.sessionStorage.getItem('demonfall.pendingNewGame'), null,
    'Neues Spiel setzt das Start-Flag nicht');
  await neuAufbauen();
  assert.ok(await h.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Neues Spiel fuehrt nicht in den Hub');
  assert.strictEqual(h.hardErrors().length, 0,
    'Konsolenfehler: ' + h.hardErrors().map((e) => String(e.msg).slice(0, 120)).join(' | '));
});
