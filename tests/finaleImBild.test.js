// tests/finaleImBild.test.js — Elara spricht erst, wenn sie im Bild steht.
//
// Gemeldet (live b511): ?debug=1&dungeon=30&room=DieQuelle&boss=elara&stark=10
// "kommt der dialog mit elara, bevor sie im bild ist". Man betritt die Arena
// DieQuelle unten (Startfeld y~848), die Esse und Elara stehen in der Mitte
// (y~520), ausserhalb des Kamera-Ausschnitts und hinter dem Nebel; das Finale
// begann aber schon beim Betreten (spawnBoss -> Finale.vorKampf). Galt auch im
// echten Spiel (gleicher Raum, gleiches Startfeld) und fuer ?finale=loesen,
// urteil, harren.
//
// Geprueft: am Startfeld steht keine Blase; der Spieler geht Schritt fuer
// Schritt auf Elara zu, und in dem Bild, in dem die erste Blase (oder das
// erste Tableau) kommt, liegt Elara ganz in cameras.main.worldView.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const GSC = "window.game.scene.getScene('GameScene')";

function lage(H) {
  return H.run(`(function () { var sc = ${GSC}, kam = sc.cameras.main, v = kam.worldView;
    var e = sc.children.getByName('finaleElara') || sc.children.getByName('finaleElaraFall');
    var r = e ? e.getBounds() : null;
    return { szene: !!(sc.__finaleBlase || sc.__finaleTableau), elara: !!e,
      drin: !!(r && r.left >= v.x && r.right <= v.right && r.top >= v.y && r.bottom <= v.bottom),
      e: r && [Math.round(r.centerX), Math.round(r.centerY)], p: [Math.round(player.x), Math.round(player.y)],
      v: [Math.round(v.x), Math.round(v.y), Math.round(v.width), Math.round(v.height)] }; })()`);
}

/** Geht in kleinen Schritten auf Elara zu, bis die Szene beginnt; gibt die Lage in dem Bild zurueck. */
function hingehen(H) {
  for (let i = 0; i < 400; i++) {
    const l = lage(H);
    if (l.szene) return l;
    H.run(`(function () { var sc = ${GSC};
      var e = sc.children.getByName('finaleElara') || sc.children.getByName('finaleElaraFall');
      if (!e) return;
      var zx = e.x - 30, zy = e.y + 60, dx = zx - player.x, dy = zy - player.y, d = Math.hypot(dx, dy);
      if (d > 4) { player.setPosition(player.x + dx / d * 4, player.y + dy / d * 4); player.body.reset(player.x, player.y); } })()`);
    H.step(1);
  }
  return lage(H);
}

for (const schritt of ['hammer', 'harren', 'loesen', 'urteil']) {
  describe('?finale=' + schritt + ': Elara steht im Bild, wenn die Szene beginnt', () => {
    let H = null;
    before(async () => {
      H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=' + schritt });
      H.run('window._playerInvincible = true');
    });
    after(async () => { if (H) await H.shutdown(); });

    test('am Startfeld keine Blase, beim Hingehen erst mit Elara im Bild', () => {
      H.step(30);
      const start = lage(H);
      assert.strictEqual(start.elara, true, 'keine Elara auf der Buehne (Testannahme)');
      assert.strictEqual(start.drin, false, 'Elara steht schon am Startfeld im Bild, der Test misst nichts: ' + JSON.stringify(start));
      assert.strictEqual(start.szene, false, 'die Szene beginnt, bevor Elara im Bild ist: ' + JSON.stringify(start));
      const l = hingehen(H);
      assert.strictEqual(l.szene, true, 'die Szene beginnt auch bei Elara nicht: ' + JSON.stringify(l));
      assert.strictEqual(l.drin, true, 'Elara liegt beim ersten Dialog nicht im Kamera-Ausschnitt: ' + JSON.stringify(l));
      // Zu b515 gemeldet: unter der zerbrochenen Esse lag noch der gezeichnete
      // rote Schein ("seltsames Bodenartefakt").
      if (schritt === 'urteil') {
        assert.strictEqual(H.run(`(function () { var g = window.game.scene.getScene('GameScene')._quelleGlow;
          return !!(g && g.active); })()`), false, 'unter der zerbrochenen Esse glimmt noch der gezeichnete Schein');
      }
    });
  });
}

describe('Ohne Debug-Schritt (Arena wie im echten Spiel, Boss per spawnBoss)', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' });
    H.run('window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('die erste Blase kommt erst, wenn Elara im Bild ist', () => {
    H.run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData();
      st.quests = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };
      st.flags = {}; qs.loadQuestSaveData(st); })()`);
    assert.strictEqual(H.lab.spawnBoss().type, 'elaraBesessen');
    H.step(30);
    const start = lage(H);
    assert.strictEqual(start.szene, false, 'die Szene beginnt, bevor Elara im Bild ist: ' + JSON.stringify(start));
    const l = hingehen(H);
    assert.strictEqual(l.szene, true, 'die Szene beginnt auch bei Elara nicht: ' + JSON.stringify(l));
    assert.strictEqual(l.drin, true, 'Elara liegt beim ersten Dialog nicht im Kamera-Ausschnitt: ' + JSON.stringify(l));
  });
});
