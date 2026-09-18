// tests/elaraEnglisch.test.js — Elaras Dungeon-Dialoge auf Englisch.
//
// roomManager.js fragte die Sprache ueber window.i18n.getLang() ab. i18n.js
// exportiert aber nur getLanguage — die Pruefung auf getLang war also immer
// falsch, und englische Spieler bekamen in allen Dungeon-Dialogen Elaras den
// deutschen Text.
//
// Geprueft am laufenden Spiel: Sprache auf 'en', Dialog oeffnen, der Text,
// der an showEventChoiceDialog geht, muss englisch sein.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Den Text mitschreiben, wenn er an den Dialog geht (auf dem Bildschirm
    // baut er sich Wort fuer Wort auf, #139).
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel, wahlen) {
      window.__dialogLog.push({ text: String(titel || ''),
        knoepfe: (wahlen || []).map(function (w) { return w && w.label; }) });
      return echt.apply(this, arguments);
    };
    window.__knoepfe = function () {
      return sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
      });
    };
    window.__durchklicken = function () {
      var n = 0;
      while (window.eventChoiceOpen && n < 20) {
        var k = window.__knoepfe()[0];
        if (!k) break;
        k.emit('pointerdown');
        n++;
      }
      return n;
    };
  })()`);
});
after(async () => {
  if (H) {
    H.run("window.i18n.setLanguage('de')");
    await H.shutdown();
  }
});

test('Auf Englisch spricht Elara im Dungeon englisch', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__durchklicken();
    window.i18n.setLanguage('en');
    window.__dialogLog = [];
    _showElaraDialog(sc, 1);
    var erster = window.__dialogLog[0] || { text: '', knoepfe: [] };
    var szene = _elaraT('deutsch', 'english');
    window.__durchklicken();
    window.i18n.setLanguage('de');
    return { erster: erster, szene: szene, sprache: window.i18n.getLanguage() };
  })()`);
  assert.ok(/Archivesmith/.test(r.erster.text), 'Elaras Dialog ist nicht englisch: ' + r.erster.text);
  assert.ok(!/Archivschmied/.test(r.erster.text), 'Elaras Dialog enthaelt deutschen Text: ' + r.erster.text);
  assert.strictEqual(r.erster.knoepfe.join('|'), 'Continue', 'der Knopf ist nicht englisch');
  assert.strictEqual(r.szene, 'english', '_elaraT waehlt auf Englisch den deutschen Text');
  assert.strictEqual(r.sprache, 'de', 'die Sprache wurde nicht zurueckgesetzt');
});

test('Auf Deutsch bleibt Elara deutsch', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__durchklicken();
    window.__dialogLog = [];
    _showElaraDialog(sc, 1);
    var erster = window.__dialogLog[0] || { text: '', knoepfe: [] };
    window.__durchklicken();
    return erster;
  })()`);
  assert.ok(/Archivschmied/.test(r.text), 'Elaras Dialog ist nicht deutsch: ' + r.text);
  assert.strictEqual(r.knoepfe.join('|'), 'Weiter');
});
