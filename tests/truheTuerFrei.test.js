// tests/truheTuerFrei.test.js — keine Truhe im Durchgang eines Tores.
//
// _spawnRandomRoomChests prueft Treppen, Spieler, Kamera und andere Truhen,
// aber kein Tor. Gefunden ueber den flackernden tests/tuerenNeu.test.js
// (Saat 5 und 22, Math.random je Lauf festgehalten): eine Truhe stand 23 px
// hinter einem Tor, die andere im Torrahmen selbst. Wer das Tor oeffnete,
// lief gegen die Truhe.
//
// Geprueft wird die REINE Regel (window.truheHaeltTuerFrei) und dass die
// Platzierung sie mit den stehenden Toren fuettert. Ueber echte Raeume
// waere es ein statistischer Test (siehe treppeTuerFrei.test.js).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
before(async () => {
  H = await launch({ search: '?dungeon=3&room=bsp', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('GameScene', { maxRounds: 250 });
  if (!ok) throw new Error('GameScene wurde nicht erreicht');
  await H.settle(() => false, { maxRounds: 10 });
});
after(async () => { if (H) await H.shutdown(); });

test('die Regel sperrt den Streifen quer durch das Tor, nicht die Wand daneben', () => {
  const r = H.run(`(function () {
    var waag = [{ x: 500, y: 300, waag: true, laenge: 192 }];
    var senk = [{ x: 500, y: 300, waag: false, laenge: 160 }];
    return {
      imRahmen: truheHaeltTuerFrei(500, 300, waag),
      dahinter: truheHaeltTuerFrei(484, 252, waag),        // Saat 5: 48 px hinter dem Tor
      davor: truheHaeltTuerFrei(560, 380, waag),
      amPfosten: truheHaeltTuerFrei(500 + 96 + 20, 320, waag),
      nebenDran: truheHaeltTuerFrei(500 + 96 + 40, 300, waag),
      weitWeg: truheHaeltTuerFrei(500, 300 + 140, waag),
      senkDahinter: truheHaeltTuerFrei(440, 310, senk),
      senkNeben: truheHaeltTuerFrei(500, 300 + 80 + 40, senk)
    };
  })()`);
  assert.strictEqual(r.imRahmen, false, 'eine Truhe im Torrahmen wurde erlaubt');
  assert.strictEqual(r.dahinter, false, 'eine Truhe direkt hinter dem Tor wurde erlaubt');
  assert.strictEqual(r.davor, false, 'eine Truhe direkt vor dem Tor wurde erlaubt');
  assert.strictEqual(r.amPfosten, false, 'eine Truhe am Pfosten wurde erlaubt (ragt in den Durchgang)');
  assert.strictEqual(r.nebenDran, true, 'die Wand neben dem Tor wurde gesperrt');
  assert.strictEqual(r.weitWeg, true, 'ein Platz weit vor dem Tor wurde gesperrt');
  assert.strictEqual(r.senkDahinter, false, 'senkrechtes Tor: Truhe im Durchgang erlaubt');
  assert.strictEqual(r.senkNeben, true, 'senkrechtes Tor: Wand daneben gesperrt');
});

test('jede Tuer zaehlt, ein Loch in der Liste nicht', () => {
  const r = H.run(`(function () {
    var tore = [null, { x: 100, y: 100, waag: true, laenge: 128 }, { x: 900, y: 700, waag: false, laenge: 128 }];
    return { erste: truheHaeltTuerFrei(100, 130, tore), letzte: truheHaeltTuerFrei(930, 700, tore),
      frei: truheHaeltTuerFrei(500, 400, tore), leer: truheHaeltTuerFrei(1, 1, []), nichts: truheHaeltTuerFrei(1, 1, null) };
  })()`);
  assert.deepStrictEqual(Object.assign({}, r), { erste: false, letzte: false, frei: true, leer: true, nichts: true });
});

test('die Platzierung bekommt die stehenden Tore und meidet ihren Durchgang', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var tor = { active: true, x: 600, y: 600, displayWidth: 192, displayHeight: 64,
      getData: function (k) { return k === 'orientation' ? 'horizontal' : null; } };
    var gesetzt = [];
    var altLoot = window.spawnLoot, altBlock = window.isSpawnPositionBlocked, altZufall = Math.random;
    window.spawnLoot = function (x, y) { gesetzt.push([x, y]); };
    window.isSpawnPositionBlocked = function () { return false; };
    Math.random = function () { return 0; };
    function setzen(kand) {
      gesetzt.length = 0;
      var szene = { _doors: [tor], cameras: { main: { midPoint: { x: -5000, y: -5000 } } },
        pickAccessibleSpawnPoint: function () { return { x: kand.x, y: kand.y }; } };
      _spawnRandomRoomChests(szene, 1000, 1000, null, null);
      return { n: gesetzt.length, liste: szene.__truhenTorListe };
    }
    try {
      var drin = setzen({ x: 610, y: 552 });
      var frei = setzen({ x: 600, y: 900 });
      return { drin: drin.n, frei: frei.n, liste: drin.liste };
    } finally {
      window.spawnLoot = altLoot; window.isSpawnPositionBlocked = altBlock; Math.random = altZufall;
    }
  })()`);
  assert.strictEqual(r.liste.length, 1, 'die Platzierung kennt das Tor nicht');
  assert.deepStrictEqual(Object.assign({}, r.liste[0]), { x: 600, y: 600, waag: true, laenge: 192 });
  assert.strictEqual(r.drin, 0, 'die Truhe wurde in den Durchgang des Tores gesetzt');
  assert.strictEqual(r.frei, 1, 'ein freier Platz bekam keine Truhe (der Test misst sonst nichts)');
});
