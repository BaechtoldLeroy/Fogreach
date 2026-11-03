// tests/vollbildRaumgrenzen.test.js — Vollbild an und aus laesst den Raum ganz.
//
// Gemeldet: "wenn der vollbildschirm im dungeon geschlossen wird, ist nicht
// mehr der ganze dungeon spielbar". Jeder Vollbildwechsel (und jede neue
// Fenstergroesse) endet im Scale-Manager in refresh() -> 'resize'. GameScene
// setzte darauf Welt- und Kameragrenzen auf Spielflaeche + Rand (1216 x 480)
// zurueck und schnitt den Raum ab, den roomManager auf seine echte Groesse
// gesetzt hatte: der Spieler stiess an eine unsichtbare Wand.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;

describe('Vollbildwechsel im Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3 });
    H.run('window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  function grenzen() {
    return H.run(`(function () {
      var sc = ${SC}; var w = sc.physics.world.bounds; var c = sc.cameras.main._bounds;
      return { welt: [w.x, w.y, w.width, w.height], kamera: [c.x, c.y, c.width, c.height] };
    })()`);
  }

  test('Grenzen nach Vollbild an/aus wie vorher, hinterste Raumecke erreichbar', () => {
    const vorher = grenzen();
    // Der Raum muss groesser als die Spielflaeche sein, sonst prueft der Test nichts.
    assert.ok(vorher.welt[3] > 480 || vorher.welt[2] > 1216, 'Raum zu klein: ' + JSON.stringify(vorher));

    // Vollbild an, Vollbild aus — so wie Phaser es beim Wechsel selbst tut.
    H.run(`(function () { var s = window.game.scale;
      s.emit('enterfullscreen'); s.refresh();
      s.emit('leavefullscreen'); s.refresh(); })()`);
    H.step(2);
    assert.deepStrictEqual(grenzen(), vorher);

    // Spieler in die hinterste begehbare Stelle (Raster, kein Zufall): Arcade
    // darf ihn dort nicht an eine Weltgrenze zurueckdruecken.
    const ziel = H.run(`(function () {
      var sc = ${SC}; var b = sc.physics.world.bounds; var best = null;
      for (var x = 16; x < b.width; x += 16) for (var y = 16; y < b.height; y += 16) {
        if (sc.isPointAccessible(x, y) && (!best || x + y > best.x + best.y)) best = { x: x, y: y };
      }
      player.body.reset(best.x, best.y);
      return best;
    })()`);
    H.step(3);
    const p = H.run(`({ x: player.x, y: player.y })`);
    // Gegner duerfen ihn ein Stueck schubsen; die abgeschnittene Welt dagegen
    // setzte ihn Hunderte Pixel zurueck (Hoehe 480 statt des Raums).
    assert.ok(Math.abs(p.x - ziel.x) < 40 && Math.abs(p.y - ziel.y) < 40,
      'Spieler weggedrueckt: Ziel ' + JSON.stringify(ziel) + ', steht bei ' + JSON.stringify(p));
  });
});
