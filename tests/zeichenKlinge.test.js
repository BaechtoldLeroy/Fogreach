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
const path = require('path');
const sharp = require('sharp');
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

// Seit #177 ist das Zeichen ein Pixelbild (assets/tiles/zeichen_schattenrat.png),
// getauscht ueber pixelTexturen.js. Verglichen wird der INHALT, nicht nur das
// Mass — die gezeichnete Fassung ist ebenfalls 64x64.
const BILD = path.join(__dirname, '..', 'assets', 'tiles', 'zeichen_schattenrat.png');
const ABDRUCK_IM_SPIEL = `function (q) {
  var c = document.createElement('canvas');
  c.width = q.width; c.height = q.height;
  var ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(q, 0, 0);
  var d = ctx.getImageData(0, 0, q.width, q.height).data;
  var a = 0, b = 0;
  for (var i = 0; i < d.length; i += 4) {
    a += d[i + 3];
    b += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] > 0 ? 1 : 0);
  }
  return q.width + 'x' + q.height + '|' + a + ':' + b;
}`;
async function abdruckDerDatei() {
  const { data, info } = await sharp(BILD).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let a = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    a += data[i + 3];
    b += (data[i] + data[i + 1] + data[i + 2]) * (data[i + 3] > 0 ? 1 : 0);
  }
  return info.width + 'x' + info.height + '|' + a + ':' + b;
}

test('Das Zeichen zeigt im Dungeon das Pixelbild aus der Datei', async () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var key = window.Zeichen && window.Zeichen.sicherstellen(sc);
    if (!key) return { fehler: 'window.Zeichen fehlt' };
    return { key: key, abdruck: (${ABDRUCK_IM_SPIEL})(sc.textures.get(key).getSourceImage()) };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.key, 'zeichen_schattenrat');
  assert.strictEqual(r.abdruck, await abdruckDerDatei(), 'im Dungeon steht noch das gezeichnete Zeichen');
});

test('Fehlt das Bild, zeichnet zeichen.js das Zeichen als Rueckfall, gleich gross', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var datei = sc.textures.get('zeichen_schattenrat').getSourceImage();
    sc.textures.remove('zeichen_schattenrat');
    try {
      var key = window.Zeichen.sicherstellen(sc);
      var src = sc.textures.get(key).getSourceImage();
      return { key: key, w: src.width, h: src.height, gezeichnet: src !== datei };
    } finally {
      // Fuer die folgenden Faelle wieder das Pixelbild einsetzen.
      sc.textures.remove('zeichen_schattenrat');
      sc.textures.addImage('zeichen_schattenrat', datei);
    }
  })()`);
  assert.strictEqual(r.key, 'zeichen_schattenrat');
  assert.strictEqual(r.w, 64);
  assert.strictEqual(r.h, 64);
  assert.strictEqual(r.gezeichnet, true);
});

test('Das Zeichen zeigt auch im Hub das Pixelbild, schon vor dem ersten Abstieg', async () => {
  // Sitzungsbuehne und Inventar-Gravur stehen im Hub. Der Hub tauschte bis
  // #177 nur die it*-Icons — das Zeichen blieb dort gezeichnet.
  const hub = await launch({ renderer: 'canvas', search: '?autostart=1' });
  try {
    assert.ok(await hub.waitForScene('HubSceneV2'), 'Hub nicht erreicht');
    hub.step(10);
    const imHub = hub.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var key = window.Zeichen.sicherstellen(sc);
      return (${ABDRUCK_IM_SPIEL})(sc.textures.get(key).getSourceImage());
    })()`);
    assert.strictEqual(imHub, await abdruckDerDatei(), 'im Hub steht noch das gezeichnete Zeichen');
  } finally {
    await hub.shutdown();
  }
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
