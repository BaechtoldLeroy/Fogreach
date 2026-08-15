// tests/headlessBoot.test.js — Stufe 1 des Headless-Testsystems (#96).
//
// Deckt die Schicht ab, die bisher KEIN Test erreicht hat: den echten Spiel-
// Boot inklusive Phaser, Szenen, Asset-Loader und der Ladereihenfolge aller
// ~80 Skripte. Alle bisherigen Tests laden einzelne IIFE-Module ueber
// tests/loadGameModule.js und sehen deshalb weder main.js noch die Scenes.
//
// Diese Datei ist bewusst genuegsam: sie prueft, dass das Spiel ueberhaupt
// hochkommt und dabei nichts protestiert. Gameplay-Assertions (Raum raeumen,
// Affix-Wirkung, ...) kommen in spaeteren Stufen dazu.

const { test } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

// Ein einziger Boot fuer alle Faelle — er kostet ~2 s, und die Zusicherungen
// darauf sind unabhaengig voneinander.
let H = null;
async function game() {
  if (!H) H = await launch({});
  return H;
}

test('headless: alle Skripte aus index.html laden ohne Ausfall', async () => {
  const h = await game();
  assert.strictEqual(h.skipped.length, 0,
    'uebersprungen: ' + h.skipped.map((s) => s.file + ' (' + s.reason + ')').join(', '));
  assert.ok(h.loaded.length > 70, 'zu wenige Skripte geladen: ' + h.loaded.length);
});

test('headless: Phaser bootet und das Spielobjekt existiert', async () => {
  const h = await game();
  assert.strictEqual(typeof h.window.Phaser, 'object', 'Phaser fehlt');
  assert.ok(h.window.game, 'window.game fehlt');
  assert.strictEqual(h.window.game.isBooted, true);
});

test('headless: StartScene laeuft aktiv', async () => {
  const h = await game();
  const start = h.scenes().find((s) => s.key === 'StartScene');
  assert.ok(start, 'StartScene nicht registriert');
  assert.strictEqual(start.status, 'RUNNING', 'Status: ' + start.status);
  assert.strictEqual(start.active, true);
});

test('headless: alle Assets laden, keines faellt aus', async () => {
  const h = await game();
  const load = h.scene('StartScene').load;
  assert.ok(load.totalComplete > 100, 'nur ' + load.totalComplete + ' Assets geladen');
  assert.strictEqual(load.totalFailed, 0, load.totalFailed + ' Assets fehlgeschlagen');
});

test('headless: Boot erzeugt keine Konsolenfehler', async () => {
  const h = await game();
  const errs = h.hardErrors();
  assert.strictEqual(errs.length, 0,
    'Fehler beim Boot:\n' + errs.map((e) => '  ' + e.msg).join('\n'));
});

test('headless: die Loop laesst sich deterministisch takten', async () => {
  const h = await game();
  const before = h.window.game.loop.frame;
  h.step(30);
  const after = h.window.game.loop.frame;
  assert.ok(after > before, 'Frame-Zaehler bewegt sich nicht (' + before + ' -> ' + after + ')');
});
