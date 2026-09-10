// tests/dungeonDialogAufbau.test.js — Elaras Text im Dungeon baut sich WIRKLICH auf.
//
// Gemeldet: "Elara-Text ist nun zuerst nicht sichtbar und nach der Leertaste
// wird der ganze Text eingeblendet."
//
// Der Grund: showEventChoiceDialog haelt das Spiel an (pauseGameClock setzt
// scene.time.paused = true), und der Aufbau taktete auf genau dieser Uhr. Eine
// angehaltene Phaser-Uhr feuert keine Ereignisse — der Text stand auf leer, bis
// man ihn uebersprang.
//
// Der alte Test las nur den Quelltext ("steht anTextobjekt im Block?"). Deshalb
// blieb der Fehler unentdeckt: die Zeile stand da, sie lief nur nie. Dieser
// Test misst stattdessen am laufenden Spiel, ob der Text WAECHST.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const VOLL = 'ELARA: Der Nebel wird dichter, je tiefer du gehst. '
  + 'Halte dich an das Licht, sonst findest du den Rueckweg nicht mehr.';

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/** Oeffnet den Dialog und gibt zurueck, wie man an seinen Text kommt. */
function oeffnen() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.EventSystem.showEventChoiceDialog(sc, ${JSON.stringify(VOLL)}, [
      { label: 'Weiter', callback: function () {} }
    ]);
    return {
      uhrAngehalten: !!(sc.time && sc.time.paused),
      text: window.__dlgText()
    };
  })()`);
}

/** Der Text, der gerade im Kasten steht. */
function text() {
  return H.run('window.__dlgText()');
}

// Ein Helfer im Spiel, der den Titeltext des offenen Dialogs findet: das
// oberste Textobjekt auf Tiefe 2501.
function helferSetzen() {
  H.run(`(function () {
    window.__dlgText = function () {
      var sc = window.game.scene.getScene('GameScene');
      var gefunden = '';
      sc.children.list.forEach(function (o) {
        if (o.type === 'Text' && o.depth === 2501) gefunden = String(o.text || '');
      });
      return gefunden;
    };
  })()`);
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

test('Der Text steht nicht sofort ganz da, sondern waechst', async () => {
  helferSetzen();
  const auf = oeffnen();

  // Gegenprobe zuerst: der Dialog haelt das Spiel wirklich an. Ohne diese
  // Zusicherung koennte der Test auf einer laufenden Uhr gruen werden und die
  // gemeldete Lage gar nicht treffen.
  assert.strictEqual(auf.uhrAngehalten, true,
    'die Szenenuhr laeuft — dann prueft dieser Test nicht den gemeldeten Fall');
  assert.ok(auf.text.length < VOLL.length,
    'der ganze Text steht sofort da (' + auf.text.length + ' Zeichen)');

  await warte(400);
  const mitte = text();
  assert.ok(mitte.length > auf.text.length,
    'nach 400 ms steht immer noch ' + mitte.length + ' Zeichen da (Start: '
    + auf.text.length + ') — der Aufbau taktet auf einer angehaltenen Uhr');

  await warte(2500);
  const ende = text();
  assert.strictEqual(ende, VOLL,
    'der Text wurde nicht fertig: ' + ende.length + ' von ' + VOLL.length + ' Zeichen');
});

test('Ueberspringen zeigt sofort alles', async () => {
  helferSetzen();
  oeffnen();
  const kurz = text();
  assert.ok(kurz.length < VOLL.length, 'schon vor dem Ueberspringen steht alles da');

  // Derselbe Griff wie im Spiel: ein Klick auf die dunkle Flaeche.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc.children.list.forEach(function (o) {
      if (o.type === 'Rectangle' && o.depth === 2500) o.emit('pointerdown');
    });
  })()`);
  assert.strictEqual(text(), VOLL, 'nach dem Ueberspringen fehlt noch Text');
});
