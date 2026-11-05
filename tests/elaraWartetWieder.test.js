// tests/elaraWartetWieder.test.js — Elaras spaetere Auftraege: sie wartet im
// naechsten Raum und kommt wieder, bis man mit ihr gesprochen hat.
//
// Gemeldet: "Bei Tiefe 19, wo Elara im Dungeon wartet, kommt sie viel zu
// selten oder nie." Sie kam einmal je Lauf, 3..5 Raeume weiter; wer an ihr
// vorbeiging, sah sie den ganzen Lauf nicht mehr.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(30);
  // Ein offenes Angebot (die Ritualkammer); Auftritte mitschreiben, das
  // Ansprechen ueber den echten Haken in _spawnElaraSprite.
  H.run(`(function () {
    var qs = window.questSystem;
    window.__anliegen = 'elara_ritual';
    qs.isQuestReadyToComplete = function () { return false; };
    qs.getAvailableQuests = function (npc) { return npc === 'elara' ? [{ id: window.__anliegen }] : []; };
    window.__auftritte = [];
    window.EventSystem.spawnEventObject = function (sc, key, a, b, label, beiE) {
      window.__auftritte.push({ raum: window.__raum, beiE: beiE });
    };
    _showElaraDialog = function () {};
  })()`);
});
after(async () => { if (H) await H.shutdown(); });
beforeEach(() => H.run("_resetElaraEncounterRunState(); window.__auftritte = []; window.__anliegen = 'elara_ritual';"));

// Raeume 2..bis betreten; die Raeume, in denen sie stand.
const laufe = (von, bis) => H.run(`JSON.stringify((function () {
  var sc = window.game.scene.getScene('GameScene'), da = [];
  for (var r = ${von}; r <= ${bis}; r++) {
    window.__raum = r; var n = window.__auftritte.length;
    _elaraSpaetereAuftraege(sc, r);
    if (window.__auftritte.length > n) da.push(r);
  }
  return da;
})())`);

test('Sie wartet im naechsten Raum und kommt wieder, wenn man vorbeigeht', () => {
  assert.deepStrictEqual(JSON.parse(laufe(2, 9)), [3, 5, 7, 9]);
});

test('Wer mit ihr gesprochen hat, dem laeuft sie mit demselben Anliegen nicht nach', () => {
  JSON.parse(laufe(2, 3));
  H.run('window.__auftritte[0].beiE()');          // [E]: angesprochen (auch wenn man ablehnt)
  assert.deepStrictEqual(JSON.parse(laufe(4, 9)), []);
});

test('Ein neues Anliegen bringt sie im selben Lauf wieder', () => {
  JSON.parse(laufe(2, 3));
  H.run("window.__auftritte[0].beiE(); window.__anliegen = 'elara_blade';");
  assert.deepStrictEqual(JSON.parse(laufe(4, 6)), [5]);
});
