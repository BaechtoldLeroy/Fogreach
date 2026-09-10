// tests/amulettVerfaellt.test.js — Amulette ueberleben die Rueckkehr nicht.
//
// Gemeldet: "Amulette sollen immer zerstoert werden bei der Rueckkehr in den
// Hub, auch wenn sie nicht getragen wurden."
//
// Gemessen war genau das der Fall: leaveDungeonForHub leerte den Platz am Hals,
// eines im Beutel kam mit in den Hub und stand danach im Spielstand. Amulette
// gelten aber nur fuer den laufenden Gang (#42).
//
// Der Test laeuft am echten Spiel, nicht an der Funktion allein: der Fehler lag
// nicht in clearRunAmulet, sondern darin, WAS der Aufrufer ihr gab.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=20', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

/** Legt Amulette ueberall ab, kehrt in den Hub zurueck und zaehlt nach. */
function heimkehr() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var LS = window.LootSystem;

    // Eines am Hals, eines im Beutel, eines in der Truhe.
    window.equipment.amulet = LS.rollAmulet(20);
    var freierPlatz = -1;
    for (var i = 0; i < inventory.length; i++) if (!inventory[i]) { freierPlatz = i; break; }
    inventory[freierPlatz] = LS.rollAmulet(20);
    // Ein gewoehnliches Stueck daneben — es muss bleiben.
    var waffenPlatz = -1;
    for (var j = 0; j < inventory.length; j++) if (!inventory[j]) { waffenPlatz = j; break; }
    inventory[waffenPlatz] = LS.rollItem(null, 5);
    if (window.HubTruhe) {
      var f = window.HubTruhe.faecher();
      for (var k = 0; k < f.length; k++) { if (!f[k]) { f[k] = LS.rollAmulet(20); break; } }
    }

    function zaehle(feld) {
      var n = 0;
      for (var m = 0; m < feld.length; m++) {
        var it = feld[m];
        if (it && (it.type === 'amulet' || it.isAmulet === true)) n++;
      }
      return n;
    }

    var vorher = {
      getragen: !!window.equipment.amulet,
      beutel: zaehle(inventory),
      truhe: window.HubTruhe ? zaehle(window.HubTruhe.faecher()) : 0
    };

    leaveDungeonForHub(sc, { skipSave: true });

    return {
      vorher: vorher,
      getragen: !!window.equipment.amulet,
      beutel: zaehle(inventory),
      truhe: window.HubTruhe ? zaehle(window.HubTruhe.faecher()) : 0,
      waffeNochDa: !!inventory[waffenPlatz],
      beutelLaenge: inventory.length
    };
  })()`);
}

test('Kein Amulett ueberlebt die Rueckkehr in den Hub', () => {
  const r = heimkehr();

  // Erst die Gegenprobe: lagen ueberhaupt welche da? Sonst prueft der Test
  // gegen einen leeren Beutel und ist immer gruen.
  assert.strictEqual(r.vorher.getragen, true, 'es wurde keines getragen');
  assert.strictEqual(r.vorher.beutel, 1, 'im Beutel lag keines');
  assert.strictEqual(r.vorher.truhe, 1, 'in der Truhe lag keines');

  assert.strictEqual(r.getragen, false, 'das getragene Amulett ist noch da');
  assert.strictEqual(r.beutel, 0, 'im Beutel liegen noch ' + r.beutel + ' Amulette');
  assert.strictEqual(r.truhe, 0, 'in der Truhe liegen noch ' + r.truhe + ' Amulette');
});

test('Der uebrige Beutel bleibt unberuehrt', () => {
  // Der naheliegende Fehlgriff waere splice: dann rutscht jedes Stueck hinter
  // dem Amulett einen Rasterplatz nach vorn.
  const r = heimkehr();
  assert.strictEqual(r.waffeNochDa, true, 'die Waffe neben dem Amulett ist verschwunden');
  assert.ok(r.beutelLaenge > 0, 'der Beutel hat seine Plaetze verloren');
});
