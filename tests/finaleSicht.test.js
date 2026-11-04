// tests/finaleSicht.test.js — Das Finale beginnt nicht im Schwarzen.
//
// Gemeldet (b507): ?debug=1&dungeon=30&room=DieQuelle&boss=elara&finale=urteil
// "der dungeon ist ein blackscreen". Im Browser gemessen: nur HUD und Seite
// sichtbar, die Welt schwarz. Ursache: das Finale beginnt gleich beim Betreten
// des Raums, seine Seiten halten die Spieluhr an, und mit ihr den Nebel-Tick
// (main.js update). Der Kriegsnebel (fogUnseen) hatte so nie ein Sichtfeld
// gestempelt und deckte den ganzen Raum zu, bis zur Wahl. Galt fuer jeden
// Schritt (hammer, loesen, urteil). Headless zeichnet die Welt ohnehin
// schwarz; darum wird hier geprueft, ob der Nebel vor der ersten Seite getickt
// hat: Sichtfeld gestempelt, Sichtpolygon um den Spieler.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GSC = "window.game.scene.getScene('GameScene')";

/** Wartet, bis die erste Seite des Finales offen ist (Spieluhr steht). */
function ersteSeite(H) {
  for (let i = 0; i < 1500; i++) {
    if (H.run(`!!(${GSC} && ${GSC}.__finaleBlase)`)) return true;
    H.step(2);
  }
  return false;
}

function sicht(H) {
  return H.run(`(function () { var sc = ${GSC}, poly = sc._lastVisionPolygon;
    var drin = false;
    if (poly && poly.length >= 6) {
      // Punkt-im-Polygon fuer die Spielerposition.
      for (var i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
        var xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
        if (((yi > player.y) !== (yj > player.y)) && (player.x < (xj - xi) * (player.y - yi) / (yj - yi) + xi)) drin = !drin;
      }
    }
    return { gestempelt: sc._explLastX != null, spielerImSicht: drin,
      pause: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null), nebel: !!(sc.fogUnseen && sc.fogUnseen.visible) }; })()`);
}

for (const schritt of ['urteil', 'hammer']) {
  describe('?finale=' + schritt + ': der Nebel gibt das Sichtfeld frei', () => {
    let H = null;
    before(async () => {
      H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=' + schritt });
      H.lab.zuElara();   // die Szene beginnt erst, wenn Elara im Bild steht
    });
    after(async () => { if (H) await H.shutdown(); });

    test('Bei der ersten Seite ist das Sichtfeld schon gestempelt', () => {
      assert.ok(ersteSeite(H), 'das Finale beginnt nicht');
      const s = sicht(H);
      assert.strictEqual(s.pause, true, 'die Seite haelt die Spieluhr nicht an (Testannahme)');
      assert.strictEqual(s.nebel, true, 'der Kriegsnebel fehlt (Testannahme)');
      assert.strictEqual(s.gestempelt, true, 'der Nebel hat vor der Seite nie getickt: die Welt bleibt schwarz');
      assert.strictEqual(s.spielerImSicht, true, 'das Sichtfeld liegt nicht um den Spieler');
    });
  });
}
