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
  assert.ok(!/Schmiedemarke/.test(r.body), 'die Schmiedemarke steht da, bevor man das Zeichen kennt');
  assert.strictEqual(r.flag, false, 'zeichen_bemerkt ohne die Sitzung gesetzt');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('schmiedemarke_erkannt')`), false);
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

// v6.1: "Wer sie im Inventar genauer ansieht, findet das Zeichen der drei
// Ketten im Stahl." Der echte Weg: Elaras Geschenk abholen, das Inventar
// oeffnen und mit dem Zeiger auf die Klinge gehen. Erst das Hinsehen setzt
// zeichen_bemerkt ("Zeichen entdeckt", Startvorteil im Endkampf).
test('Im Inventar: wer die Klinge genauer ansieht, entdeckt das Zeichen (v6.1)', () => {
  stand({ council_collusion_reveal: { status: 'completed', objectives: [] },
    elara_ritual: { status: 'completed', objectives: [] } });
  const r = H.run(`(function () {
    var qs = window.questSystem;
    for (var i = 0; i < inventory.length; i++) inventory[i] = null;
    if (!qs.acceptQuest('elara_blade') || !qs.completeQuest('elara_blade')) return { fehler: 'Geschenk nicht abgeholt' };
    var nachGeschenk = qs.hasFlag('zeichen_bemerkt');
    var idx = inventory.findIndex(function (it) { return it && it.key === 'ELARAS_KLINGE'; });
    if (idx < 0) return { fehler: 'die Klinge liegt nicht im Inventar' };
    openInventory();
    refreshInventoryUI();
    // Das Rasterfeld, auf dem die Klinge liegt (Zeiger darueber = hinsehen).
    var it = inventory[idx];
    var zelle = (invUI.zellen || []).filter(function (z) { return z.c === it.gridX && z.r === it.gridY; })[0];
    if (!zelle) return { fehler: 'kein Rasterfeld unter der Klinge' };
    var vorHover = qs.hasFlag('zeichen_bemerkt');
    zelle.bg.emit('pointerover', { x: 200, y: 200, worldX: 200, worldY: 200 });
    var nachHover = qs.hasFlag('zeichen_bemerkt');
    closeInventory();
    return { nachGeschenk: nachGeschenk, vorHover: vorHover, nachHover: nachHover,
      regler: window.QuestFinale.computeFinaleState(qs.getFlags()).betrayalForeseen };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.nachGeschenk, false, 'das Zeichen gilt schon beim Annehmen als entdeckt');
  assert.strictEqual(r.vorHover, false, 'das Oeffnen des Inventars allein entdeckt das Zeichen');
  assert.strictEqual(r.nachHover, true, 'das Ansehen der Klinge setzt zeichen_bemerkt nicht');
  assert.strictEqual(r.regler, true);
});

// v6.1, leise: Unter dem Zeichen eine Schmiedemarke, die Deine Haende kennen.
// Keine Szene, nur die zweite Zeile im Tooltip, gleich nach dem Wiedererkennen.
// Sie setzt schmiedemarke_erkannt, und der Epilog bindet es an.
test('Im Inventar: unter dem Zeichen die eigene Schmiedemarke, und der Epilog nimmt sie auf', () => {
  stand({ council_collusion_reveal: { status: 'completed', objectives: [] },
    elara_ritual: { status: 'completed', objectives: [] } });
  const r = H.run(`(function () {
    var qs = window.questSystem;
    for (var i = 0; i < inventory.length; i++) inventory[i] = null;
    if (!qs.acceptQuest('elara_blade') || !qs.completeQuest('elara_blade')) return { fehler: 'Geschenk nicht abgeholt' };
    var idx = inventory.findIndex(function (it) { return it && it.key === 'ELARAS_KLINGE'; });
    if (idx < 0) return { fehler: 'die Klinge liegt nicht im Inventar' };
    var vorher = window.QuestFinale.epilog(qs.getFlags()).join('\\n');
    openInventory();
    refreshInventoryUI();
    var it = inventory[idx];
    var zelle = (invUI.zellen || []).filter(function (z) { return z.c === it.gridX && z.r === it.gridY; })[0];
    if (!zelle) return { fehler: 'kein Rasterfeld unter der Klinge' };
    var vorHover = qs.hasFlag('schmiedemarke_erkannt');
    zelle.bg.emit('pointerover', { x: 200, y: 200, worldX: 200, worldY: 200 });
    // Was der Tooltip jetzt zeigt, aus dem Szenenbaum gelesen.
    var sc = invUI._scene || window.game.scene.getScene('GameScene');
    var tip = sc.children.list.concat.apply([], sc.children.list.map(function (o) { return o.list ? o.list : [o]; }))
      .filter(function (o) { return o && o.type === 'Text' && o.visible && /Schmiedemarke/.test(o.text || ''); })
      .map(function (o) { return o.text; })[0] || null;
    closeInventory();
    return { vorHover: vorHover, nachHover: qs.hasFlag('schmiedemarke_erkannt'), tip: tip, vorher: vorher,
      nachher: window.QuestFinale.epilog(qs.getFlags()).join('\\n'),
      en: window.QuestFinale.epilog(qs.getFlags(), 'en').join('\\n') };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.ok(r.tip, 'der Tooltip zeigt keine Schmiedemarke');
  assert.match(r.tip, /Darunter eine Schmiedemarke\. Deine Hände kennen sie, bevor Du es tust\. Es ist Deine\./);
  // Die Zeile kommt nach dem Wiedererkennen, nicht davor.
  assert.ok(r.tip.indexOf('geheimen Sitzung') < r.tip.indexOf('Schmiedemarke'), 'die Reihenfolge stimmt nicht: ' + r.tip);
  assert.strictEqual(r.vorHover, false);
  assert.strictEqual(r.nachHover, true, 'das Ansehen setzt schmiedemarke_erkannt nicht');
  assert.ok(/die Siegel des Rats gemacht hat/.test(r.vorher), 'vorher ist der Epilog schon eingeweiht');
  assert.match(r.nachher, /Der Mann, der das Zeichen der drei Ketten geschmiedet hat, macht jetzt Werkzeug für alle\./);
  assert.match(r.en, /The man who forged the sign of the three chains now makes tools for everyone\./);
});

test('Branka in "Wer du warst": das Zeichen der drei Ketten ist von Dir', () => {
  stand({ branka_doubt: { status: 'completed', objectives: [] } });
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var q = (qs.getAvailableQuests('branka') || []).filter(function (x) { return x.id === 'who_you_were'; })[0]
      || { id: 'who_you_were' };
    var def = qs.getQuestDialogue ? qs.getQuestDialogue(q, 'complete') : '';
    window.i18n.setLanguage('en');
    var en = qs.getQuestDialogue ? qs.getQuestDialogue(q, 'complete') : '';
    window.i18n.setLanguage('de');
    var ok = qs.acceptQuest('who_you_were');
    var aktiv = qs.getActiveQuests().filter(function (x) { return x.id === 'who_you_were'; })[0];
    if (aktiv) aktiv.objectives.forEach(function (o) { o.current = o.required; });
    var fertig = qs.completeQuest('who_you_were');
    return { de: def, en: en, ok: ok, fertig: fertig, flag: qs.hasFlag('schmiedemarke_erkannt'),
      selbst: qs.hasFlag('self_remembered') };
  })()`);
  assert.match(r.de, /Du hast für sie geschmiedet\. Das Zeichen der drei Ketten ist von Dir\. Ich habe Dich daran arbeiten sehen\. Dann hast Du verstanden/);
  // Der Rest ihres Textes bleibt.
  assert.match(r.de, /Sie haben Dich geleert, weil sie Dich brauchten/);
  assert.match(r.en, /The sign of the three chains is yours\. I watched you work on it\./);
  assert.ok(r.ok && r.fertig, 'der Auftrag liess sich nicht abschliessen');
  assert.strictEqual(r.flag, true, 'Brankas Abschluss setzt schmiedemarke_erkannt nicht');
  assert.strictEqual(r.selbst, true);
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
  const SCG = `window.game.scene.getScene('GameScene')`;
  H.run(`${SCG}.__zettelSzene = null; window.storyScenes.playMaulwurfEnthuellung(${SCG}, function () {}); 1`);
  // Erst die Bilder des Weges (js/zettelSzene.js) und ggf. der Rueckblick,
  // dann die Kammer mit dem Ring.
  for (let i = 0; i < 300 && !H.run(`!!${SCG}.__zettelSzene`); i++) H.step(3);
  H.run(`${SCG}.__zettelSzene.ueberspringen(); 1`);
  for (let i = 0; i < 100 && H.run(`!!(${SCG}.__rueckblick && ${SCG}.__rueckblick.phase !== 'fertig')`); i++) {
    H.run(`${SCG}.__rueckblick.ueberspringen(); 1`);
    H.step(3);
  }
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
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
