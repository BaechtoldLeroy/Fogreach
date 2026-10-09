// tests/headlessEineUhr.test.js — im Sandkasten vergeht Zeit nur durch Takten (b336).
//
// Die Gesamtlaeufe flatterten unter Last: 38 bis 142 Ausfaelle je Lauf, und
// jedesmal andere. Ursache war, dass im Sandkasten ZWEI Uhren liefen. Die
// Spielschleife taktete mit festem dt, aber setTimeout, setInterval,
// performance.now und das Dateiladen liefen auf Nodes Wanduhr. Ein Beispiel:
// nach einem Treffer ist der Spieler 1,5 s unverwundbar (setTimeout in
// enemy.js). Auf einem freien Rechner hielt das viele getaktete Frames, unter
// Last war es sofort vorbei — der Spieler starb mitten im Test, die Szene
// startete neu.
//
// Jetzt gibt es eine Uhr. Diese Faelle halten fest, was daraus folgt: Timer
// und Dateien kommen nach getakteten Frames an, nie durch blosses Warten.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => { H = await launch(); });
after(async () => { if (H) await H.shutdown(); });

const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));

test('setTimeout feuert nach getakteter Zeit, nicht nach Wanduhr', async () => {
  H.run(`window.__uhrTimer = 0; setTimeout(function () { window.__uhrTimer = 1; }, 1500);`);
  await schlafen(1700);
  assert.strictEqual(H.run('window.__uhrTimer'), 0, 'der Timer lief auf der Wanduhr');
  H.step(80);                                   // 1333 ms
  assert.strictEqual(H.run('window.__uhrTimer'), 0, 'der Timer feuerte zu frueh');
  H.step(12);                                   // 1533 ms
  assert.strictEqual(H.run('window.__uhrTimer'), 1, 'der Timer feuerte nicht');
});

test('Date.now und performance.now folgen dem Takt', async () => {
  const a = H.run('[Date.now(), performance.now()]');
  await schlafen(300);
  const b = H.run('[Date.now(), performance.now()]');
  assert.strictEqual(b[0] - a[0], 0, 'Date.now lief ohne Takt weiter');
  assert.strictEqual(b[1] - a[1], 0, 'performance.now lief ohne Takt weiter');
  H.step(60);
  const c = H.run('[Date.now(), performance.now()]');
  assert.ok(Math.abs(c[0] - b[0] - 1000) < 2, 'Date.now: ' + (c[0] - b[0]) + ' ms fuer 60 Frames');
  assert.ok(Math.abs(c[1] - b[1] - 1000) < 2, 'performance.now: ' + (c[1] - b[1]) + ' ms fuer 60 Frames');
});

test('ein nachgeladenes Bild kommt im naechsten Takt — und nur dann', async () => {
  // Das Spiel laedt im Lauf nach (Spielerbilder je Richtung, Haendlerin).
  // Frueher kam die Datei, wenn Node mit dem Lesen fertig war — nach wie
  // vielen getakteten Frames, hing an der Rechnerlast.
  // Eine leere Szene mit eigenem Loader — der der StartScene zeichnet
  // noch seinen Fortschrittsbalken, den es nicht mehr gibt.
  H.run(`window.game.scene.add('UhrTest', {}, true);`);
  H.step(2);
  H.run(`(function () {
    var sc = window.game.scene.getScene('UhrTest');
    sc.load.image('uhrTestBild', 'assets/projectiles/proj_fireball0.png');
    sc.load.start();
  })()`);
  await schlafen(300);
  assert.strictEqual(H.run(`window.game.textures.exists('uhrTestBild')`), false,
    'das Bild kam ohne Takt an');
  H.step(3);
  assert.strictEqual(H.run(`window.game.textures.exists('uhrTestBild')`), true,
    'das Bild kam drei Takte spaeter noch nicht an');
});

test('Zufallsereignisse beim Raumbetreten sind im Test aus (#178)', () => {
  // Der Elite-Hinterhalt (ab Tiefe 5) oeffnet 800 ms nach dem Betreten eine
  // Wahl und haelt die Spieluhr an. Je nach Wurf standen dann alle
  // delayedCalls, und in einer Datei fielen mehrere Faelle auf einmal
  // (elaraBesessen: etwa jeder vierte Lauf, bossSignaturen, ...).
  // Erzwungen: ein Ereignis, das beim Betreten kommen MUESSTE.
  const r = H.run(`(function () {
    window.DEBUG_FORCE_EVENT = { roomId: 99, eventId: 'elite_ambush' };
    try { window.EventSystem.onRoomEnter(window.game.scene.getScenes(true)[0], 99); }
    finally { window.DEBUG_FORCE_EVENT = null; }
    return { offen: !!window.eventChoiceOpen, geplant: window.game.scene.getScenes(true)[0].time._pendingInsertion.length };
  })()`);
  H.step(60);
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'das Ereignis kam trotzdem');
  assert.strictEqual(r.geplant, 0, 'das Ereignis wurde eingeplant');
});
