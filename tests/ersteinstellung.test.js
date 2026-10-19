// tests/ersteinstellung.test.js — Beim ersten Start eines Slots fragt das
// Spiel nach Schwierigkeit und Steuerung (js/ersteinstellung.js).
//
// Laeuft gegen die echte StartScene: "Neues Spiel" setzt das Start-Flag, der
// "Reload" (Szene neu) zeigt das Fenster statt direkt in den Hub zu gehen.
// Danach: genau einmal je Slot, nie beim Fortsetzen, nie im Trailer-Modus,
// Auswahl landet in denselben Speichern wie in den Einstellungen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let h = null;
before(async () => { h = await launch({ renderer: 'canvas', waitFor: 'StartScene' }); });
after(async () => { if (h) await h.shutdown(); });

const start = () => h.scene('StartScene');

async function neuAufbauen() {
  start().scene.restart();
  h.step(1);
  assert.ok(await h.waitForScene('StartScene'), 'StartScene kam nicht wieder');
  h.step(2);
}

/** Wie ein Klick auf NEUES SPIEL samt Reload; wartet auf das Fenster (oder den Hub). */
async function neuesSpiel() {
  start().menuKnoepfe.neuesSpiel.platte.emit('pointerdown');
  await neuAufbauen();
  await h.settle(() => !!(start() && start()._ersteinstellung) || h.window.game.scene.isActive('HubSceneV2'),
    { maxRounds: 60 });
  return start()._ersteinstellung || null;
}

/** Zurueck ins Startmenue (aus dem Hub). */
async function zumMenue() {
  const g = h.window.game;
  ['HubSceneV2', 'GameScene'].forEach((k) => { if (g.scene.isActive(k)) g.scene.stop(k); });
  g.scene.start('StartScene');
  h.step(1);
  assert.ok(await h.waitForScene('StartScene'), 'StartScene nicht erreicht');
  h.step(2);
}

function taste(name) {
  const kb = start().input.keyboard;
  kb.emit('keydown-' + name, { preventDefault() {}, shiftKey: false });
}

/** Rekursiv: hat irgendein Objekt (auch in Behaeltern) einen Scrollfaktor != 0? */
function nichtFest(objekte) {
  const schlecht = [];
  const pruefe = (o) => {
    if (!o) return;
    if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) schlecht.push(o.type);
    if (o.list) o.list.forEach(pruefe);
  };
  objekte.forEach(pruefe);
  return schlecht;
}

test('Ersteinstellung: Desktop — einmal je Slot, Enter uebernimmt Wahl', async () => {
  h.run('window.game.device.input.touch = false');
  const W = h.window;
  W.DIFFICULTY_MULTIPLIER = 1;
  W.Persistence.setControlScheme('classic');
  W.InputScheme.setScheme('classic');

  const e = await neuesSpiel();
  assert.ok(e, 'kein Ersteinstellungs-Fenster nach Neues Spiel');
  assert.ok(!W.game.scene.isActive('HubSceneV2'), 'Hub laeuft schon, waehrend das Fenster offen ist');
  assert.strictEqual(e.touch, false);
  assert.strictEqual(e.zustand.stufe, 1, 'Normal nicht vorgewaehlt');
  assert.strictEqual(e.zustand.schema, 0, 'Klassisch nicht vorgewaehlt');
  assert.ok(/ O /.test(e.hinweis.text), 'Desktop-Hinweis nennt O nicht: ' + e.hinweis.text);
  assert.deepStrictEqual(nichtFest(e.objekte), [], 'Objekte mit Scrollfaktor != 0');

  // Tastatur: rechts = Schwer, runter auf Steuerung, rechts = ARPG, Enter.
  taste('RIGHT');
  // Im Browser kommt dasselbe KeyboardEvent im selben Bild mehrfach an: es
  // darf den Fokus trotzdem nur einmal weiterschieben.
  const ev = { preventDefault() {}, shiftKey: false };
  start().input.keyboard.emit('keydown-DOWN', ev);
  start().input.keyboard.emit('keydown-DOWN', ev);
  assert.strictEqual(e.zustand.fokus, 1, 'doppelt gemeldete Taste schob den Fokus zweimal');
  taste('RIGHT');
  assert.strictEqual(e.zustand.stufe, 2);
  assert.strictEqual(e.zustand.schema, 1);
  taste('ENTER');
  assert.strictEqual(start()._ersteinstellung, null, 'Fenster nach Enter noch offen');
  assert.strictEqual(e.objekte.length, 0, 'Objekte nicht abgebaut');

  assert.strictEqual(W.DIFFICULTY_MULTIPLIER, 1.5, 'Schwierigkeit nicht angewandt');
  assert.strictEqual(JSON.parse(W.SlotStorage.getItem('demonfall_lastDifficulty')), 1.5, 'Schwierigkeit nicht gespeichert');
  assert.strictEqual(W.Persistence.getControlScheme(), 'arpg', 'Steuerung nicht gespeichert');
  assert.strictEqual(W.InputScheme.getScheme(), 'arpg', 'Steuerung nicht angewandt');
  assert.strictEqual(W.SlotStorage.getItem('demonfall_ersteinstellung'), '1', 'Marke nicht gesetzt');
  assert.ok(await h.waitForScene('HubSceneV2', { maxRounds: 250 }), 'nach Los gehts nicht im Hub');

  // Fortsetzen (Spielstand vorhanden): kein Fenster.
  h.run('saveGame()');
  await zumMenue();
  assert.ok(start().menuKnoepfe.fortsetzen, 'kein FORTSETZEN');
  assert.strictEqual(h.run('window.Ersteinstellung.faellig()'), false, 'faellig trotz Spielstand');
  // Alter Spielstand von vor der Ersteinstellung (ohne Marke): auch nicht.
  W.SlotStorage.removeItem('demonfall_ersteinstellung');
  assert.strictEqual(h.run('window.Ersteinstellung.faellig()'), false, 'alter Spielstand ohne Marke faellig');
  W.SlotStorage.setItem('demonfall_ersteinstellung', '1');
  // Startet der Fortsetzen-Weg, geht es ohne Fenster in den Hub.
  start().menuKnoepfe.fortsetzen.platte.emit('pointerdown');
  await h.settle(() => W.game.scene.isActive('HubSceneV2'), { maxRounds: 250 });
  assert.ok(!(start() && start()._ersteinstellung), 'Fenster beim Fortsetzen');
  assert.ok(W.game.scene.isActive('HubSceneV2'), 'Fortsetzen fuehrt nicht in den Hub');

  // Marke gesetzt, Slot ohne Spielstand (z. B. Abbruch nach dem Fenster): nicht noch einmal.
  W.SlotStorage.removeItem('demonfall_save_v1');
  assert.strictEqual(h.run('window.Ersteinstellung.faellig()'), false, 'zweites Mal faellig');

  W.InputScheme.setScheme('classic');
  W.DIFFICULTY_MULTIPLIER = 1;
});

test('Ersteinstellung: Mobile — ohne Steuerungszeile, ohne O; Klick auf Los', async () => {
  await zumMenue();
  h.run('window.game.device.input.touch = true');
  const W = h.window;
  W.Persistence.setControlScheme('classic');

  // Neues Spiel leert den Slot samt Marke: der frische Durchgang fragt wieder.
  const e = await neuesSpiel();
  assert.ok(e, 'kein Fenster auf Mobile');
  assert.strictEqual(e.touch, true);
  assert.strictEqual(e.zustand.schema, null, 'Steuerungszeile auf Mobile');
  const texte = e.objekte.filter((o) => o.type === 'Text').map((o) => o.text);
  assert.ok(!texte.some((t) => /Steuerung|Controls|Klassisch|ARPG/.test(t)), 'Steuerung sichtbar: ' + texte.join(' | '));
  assert.ok(!/ O /.test(e.hinweis.text), 'Mobile-Hinweis nennt O: ' + e.hinweis.text);
  assert.ok(/Menü oben rechts|menu at the top right/.test(e.hinweis.text), 'Hinweis aufs Menue fehlt');
  assert.deepStrictEqual(nichtFest(e.objekte), [], 'Objekte mit Scrollfaktor != 0');

  // Leicht antippen, dann den Los-Knopf.
  e.waehle('stufe', 0);
  const los = e.objekte.find((o) => o.type === 'Rectangle' && o.input && o.width >= 200 && o.height === 40);
  assert.ok(los, 'Los-Knopf nicht gefunden');
  los.emit('pointerdown');
  assert.strictEqual(W.DIFFICULTY_MULTIPLIER, 0.6, 'Leicht nicht angewandt');
  assert.strictEqual(W.Persistence.getControlScheme(), 'classic', 'Mobile hat die Steuerung veraendert');
  assert.ok(await h.waitForScene('HubSceneV2', { maxRounds: 250 }), 'nach Los gehts nicht im Hub');
  W.DIFFICULTY_MULTIPLIER = 1;
  h.run('window.game.device.input.touch = false');
});

test('Ersteinstellung: nie im Trailer-Modus', () => {
  const W = h.window;
  W.SlotStorage.removeItem('demonfall_ersteinstellung');
  W.SlotStorage.removeItem('demonfall_save_v1');
  assert.strictEqual(h.run('window.Ersteinstellung.faellig()'), true, 'Grundfall: frischer Slot nicht faellig');
  const alt = W.TrailerModus;
  W.TrailerModus = { aktiv: () => true };
  try {
    assert.strictEqual(h.run('window.Ersteinstellung.faellig()'), false, 'im Trailer-Modus faellig');
  } finally { W.TrailerModus = alt; }
  assert.strictEqual(h.hardErrors().length, 0,
    'Konsolenfehler: ' + h.hardErrors().map((x) => String(x.msg).slice(0, 120)).join(' | '));
});
