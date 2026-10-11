// tests/elaraGroesse.test.js — Elara im Keller in Spielergroesse (#192).
//
// Versteck und Kellerbegegnung setzten Elara mit festem Faktor 0.16 — gemuenzt
// auf die alten Grossbilder (~1536 px). Seit den Pixel-NPCs (b326) ist ihr
// Bild 34x63, sie stand also 5x10 px gross im Raum. Jetzt wird die FIGUR im
// Bild gemessen (figurGrenzen) und auf Spielerhoehe gebracht.
//
// Gemessen wird die angezeigte Figurhoehe (Figurgrenzen x Skala), nicht der
// Rahmen; Vergleich gegen die angezeigte Figur des Spielers, +-15 %.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 5 });
  H.run(`(function () {
    window._playerInvincible = true;
    enemies.clear(true, true);
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Elaras Figur und ihr [E]-Hinweis, in Weltpixeln. */
const elaraMessen = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var e = sc.children.list.filter(function (o) {
    return o.active && o.texture && o.texture.key === 'elara_right0';
  }).pop();
  if (!e) return null;
  var f = figurGrenzen(sc, 'elara_right0');
  var oben = e.y - (e.height * e.originY - f.minY) * e.scaleY;
  var unten = e.y + (f.maxY + 1 - e.height * e.originY) * e.scaleY;
  var p = sc.children.list.filter(function (o) {
    return o.type === 'Text' && o.text === '[E] Elara';
  }).pop();
  var pf = figurGrenzen(sc, player.texture.key);
  return {
    figur: f.boundsHeight * e.scaleY, rahmen: e.displayHeight,
    oben: oben, unten: unten,
    hinweisUnten: p ? p.y + p.displayHeight * (1 - p.originY) : null,
    spieler: pf ? pf.boundsHeight * player.scaleY : null
  };
})()`);

function pruefen(m, wo) {
  assert.ok(m, wo + ': Elara steht nicht im Raum');
  assert.ok(m.spieler > 40, wo + ': Spielerfigur nicht messbar: ' + JSON.stringify(m));
  const verhaeltnis = m.figur / m.spieler;
  assert.ok(verhaeltnis > 0.85 && verhaeltnis < 1.15,
    wo + ': Elara ist ' + m.figur.toFixed(1) + ' px hoch, der Spieler ' + m.spieler.toFixed(1)
    + ' px (Verhaeltnis ' + verhaeltnis.toFixed(2) + ')');
  assert.ok(m.hinweisUnten !== null, wo + ': kein [E]-Hinweis');
  assert.ok(m.hinweisUnten <= m.oben, wo + ': [E] liegt auf der Figur: ' + JSON.stringify(m));
  assert.ok(m.oben - m.hinweisUnten < 16, wo + ': [E] schwebt weit ueber ihr: ' + JSON.stringify(m));
}

test('Im Versteck hat Elara Spielerhoehe, [E] sitzt ueber ihrem Kopf', () => {
  H.run(`(function () {
    var qs = window.questSystem;
    var st = qs.getQuestSaveData();
    st.quests = { harren_daughter_investigation: { status: 'completed', objectives: [] },
                  widerstand_proof: { status: 'completed', objectives: [] } };
    st.flags = { elaraMet: true };
    qs.loadQuestSaveData(st);
    window.DUNGEON_DEPTH = 5; initDungeonRun();
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, dungeonRun.templateOrder.indexOf('ElarasVersteck'));
    // Der Hinweis erscheint erst in der Naehe — Spieler zu ihr stellen.
    var e = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'elara_right0'; }).pop();
    if (e) { player.x = e.x + 30; player.y = e.y + 20; }
  })()`);
  H.step(50);
  pruefen(elaraMessen(), 'Versteck');
});

test('In der Kellerbegegnung ebenso', () => {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.EventSystem.reset();
    _spawnElaraSprite(sc, 1);
    var e = sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === 'elara_right0'; }).pop();
    if (e) { player.x = e.x + 30; player.y = e.y + 20; }
  })()`);
  H.step(50);
  pruefen(elaraMessen(), 'Kellerbegegnung');
});
