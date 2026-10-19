// tests/elaraAbgabeNaechsterRaum.test.js — Elara kommt zur Abgabe im naechsten Raum.
//
// Gemeldet: "Elara kommt zu selten, wenn der Auftrag bereit ist zum Abgeben."
// Zwei Ursachen: (1) sie wartete 3..5 Raeume, bei 7 Raeumen je Lauf fiel das
// Ziel oft hinter das Ende; (2) das Ziel der spaeteren Auftraege wurde beim
// neuen Lauf nicht zurueckgesetzt — lag es bei Raum 8+, kam sie nie wieder.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(30);
  // Auftrag "Das versiegelte Buendel" fertig zum Abgeben; Elaras Auftritt zaehlen statt zeichnen.
  H.run(`(function () {
    var qs = window.questSystem;
    window.__elaraAuftritte = [];
    _spawnElaraSprite = function (sc, faellig) { window.__elaraAuftritte.push(faellig); };
    qs.isQuestReadyToComplete = function (id) { return id === 'resistance_fetch_01'; };
    qs.getActiveQuests = function () { return [{ id: 'resistance_fetch_01', objectives: [] }]; };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

const raum = (n) => H.run(`(function () {
  _elaraSpaetereAuftraege(window.game.scene.getScene('GameScene'), ${n});
  return window.__elaraAuftritte.length;
})()`);

test('Ist der Auftrag bereit, steht Elara im naechsten Raum', () => {
  H.run('_resetElaraEncounterRunState(); window.__elaraAuftritte = [];');
  assert.strictEqual(raum(5), 0, 'schon im selben Raum');
  assert.strictEqual(raum(6), 1, 'im naechsten Raum kam sie nicht');
  assert.strictEqual(H.run('window.__elaraAuftritte[0].modus'), 'abgabe');
});

test('Ein neuer Lauf vergisst das alte Ziel', () => {
  H.run('_resetElaraEncounterRunState(); window.__elaraAuftritte = [];');
  raum(7);                       // letzter Raum: Ziel waere Raum 8
  H.run('_resetElaraEncounterRunState();');
  raum(1);
  assert.strictEqual(raum(2), 1, 'im neuen Lauf wartet sie noch auf das alte Ziel');
});
