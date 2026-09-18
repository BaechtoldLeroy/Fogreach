// tests/zeichenKlinge.test.js — das Zeichen des Schattenrats auf Elaras Klinge (#156).
//
// Story-Bibel v5, Abschnitt 5: Statt der Blaetter-Mechanik gibt es EIN
// Zeichen, das der Spieler wiedererkennt — drei Ketten, ineinander
// verschlungen. Auf Elaras Klinge ist es nahe am Heft eingraviert. Wer es
// vorher auf den Siegeln der geheimen Sitzung gesehen hat, erkennt es; das
// setzt zeichen_bemerkt, und im Finale gilt der Verrat als vorhergesehen.
//
// Geprueft ueber window.formatItemTooltip — dieselbe Formatierung, die
// Inventar und Truhe beim Hinsehen benutzen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
});
after(async () => { if (H) await H.shutdown(); });

const KLINGE = "({ type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', rarity: 'legendary', rarityValue: 4, damage: 7, speed: 1.3, range: 120, crit: 0.15 })";

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests || {})};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}

test('Die Klinge traegt die Gravur', () => {
  stand({});
  const r = H.run(`(function () {
    if (typeof window.formatItemTooltip !== 'function') return { fehler: 'formatItemTooltip fehlt' };
    return { body: window.formatItemTooltip(${KLINGE}).body };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(/drei Ketten/.test(r.body), 'keine Gravur im Tooltip: ' + r.body);
});

test('Ohne die geheime Sitzung erkennt man das Zeichen nicht', () => {
  stand({});
  const r = H.run(`(function () {
    var body = window.formatItemTooltip(${KLINGE}).body;
    return { body: body, flag: window.questSystem.hasFlag('zeichen_bemerkt') };
  })()`);
  assert.ok(!/geheimen Sitzung/.test(r.body), 'man erkennt ein Zeichen, das man nie gesehen hat');
  assert.strictEqual(r.flag, false, 'zeichen_bemerkt ohne die Sitzung gesetzt');
});

test('Nach der Sitzung erkennt man es — und der Verrat gilt als vorhergesehen', () => {
  stand({ council_collusion_reveal: { status: 'completed', objectives: [] } });
  const r = H.run(`(function () {
    var body = window.formatItemTooltip(${KLINGE}).body;
    var flags = window.questSystem.getFlags();
    return { body: body, flag: !!flags.zeichen_bemerkt,
             regler: window.QuestFinale.computeFinaleState(flags).betrayalForeseen };
  })()`);
  assert.ok(/geheimen Sitzung/.test(r.body), 'das Zeichen wird nicht erkannt: ' + r.body);
  assert.strictEqual(r.flag, true, 'zeichen_bemerkt wurde nicht gesetzt');
  assert.strictEqual(r.regler, true, 'der Finale-Regler "Verrat vorhergesehen" bleibt aus');
});

test('Andere Stuecke tragen keine Gravur', () => {
  const r = H.run(`(function () {
    var it = window.LootSystem.rollItem(null, 5, 2);
    return window.formatItemTooltip(it).body;
  })()`);
  assert.ok(!/drei Ketten|eingraviert/.test(r), 'ein gewoehnliches Stueck traegt die Gravur');
});

// --- Das Zeichen als Grafik (js/zeichen.js) ---------------------------------

test('Das Zeichen ist eine Grafik, an einer Stelle gezeichnet', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var key = window.Zeichen && window.Zeichen.sicherstellen(sc);
    if (!key) return { fehler: 'window.Zeichen fehlt' };
    var src = sc.textures.get(key).getSourceImage();
    return { key: key, w: src.width, h: src.height };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.key, 'zeichen_schattenrat');
  assert.strictEqual(r.w, 64);
  assert.strictEqual(r.h, 64);
});

test('Das Buendel liegt mit dem Zeichen auf dem Siegel am Boden', () => {
  stand({ resistance_fetch_01: { status: 'active', objectives: [{ type: 'fetch', target: 'sealed_bundle', current: 0, required: 1 }] } });
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    lootGroup.clear(true, true);
    var echt = Math.random;
    Math.random = function () { return 0; };       // jeder Wurf gelingt, auch der Quest-Fund
    try { spawnLoot.call(sc, player.x + 40, player.y, null, null); }
    finally { Math.random = echt; }
    var b = lootGroup.getChildren().filter(function (s) {
      var it = s.getData && s.getData('item');
      return it && it.key === 'SEALED_BUNDLE';
    })[0];
    return b ? { textur: b.texture.key } : { fehler: 'kein Buendel gefallen' };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.textur, 'zeichen_schattenrat', 'das Buendel liegt ohne Zeichen da');
});

test('Die Enthuellung zeigt das Zeichen am Ring als Bild', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.storyScenes.playMaulwurfEnthuellung(sc, function () {});
    // Nur die Szenen-Ebene zaehlen: das Buendel aus dem Test davor liegt mit
    // derselben Textur am Boden und liess eine fehlende Szene gruen aussehen.
    var da = sc.children.list.some(function (o) {
      return o.texture && o.texture.key === 'zeichen_schattenrat' && o.active && o.depth >= 1550 && o.depth < 1560;
    });
    sc.children.list.filter(function (o) { return o.depth >= 1550 && o.depth < 1560; })
      .forEach(function (o) { try { o.destroy(); } catch (e) {} });
    return da;
  })()`);
  assert.strictEqual(r, true, 'die Enthuellung zeigt das Zeichen nicht');
});
