// tests/englischSichtbar.test.js — auf Englisch steht kein deutsches Wort im Bild.
//
// i18nVollstaendig prueft das Woerterbuch: jeder deutsche Key hat eine
// englische Fassung. Was es nicht sieht, sind Texte, die gar nicht ueber i18n
// laufen, sondern fest im Code stehen ('Tagebuch', 'STUFE ', '[E] Handel').
// Die fallen erst auf, wenn jemand auf Englisch spielt. Dieser Test spielt auf
// Englisch: er schaltet die Sprache um, geht die Hauptbildschirme ab, sammelt
// jedes sichtbare Textobjekt und meldet alles, was deutsch aussieht.
//
// Deterministisch: ein frischer Spielstand, Zufallsereignisse aus (Standard
// von launch), jede Ansicht wird direkt geoeffnet statt ueber den Bot, und
// zwischen den Ansichten wird getaktet, bis die Szene wirklich laeuft.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

// Eigennamen, die im Englischen bleiben. Sie werden vor der Pruefung entfernt.
const EIGENNAMEN = ['Fogreach', 'Elara', 'Mara', 'Branka', 'Thom', 'Harren', 'Aldric'];

// Haeufige deutsche Woerter, die im Englischen nicht vorkommen. Bewusst ohne
// Doppelgaenger wie die, will, war, hat, Gift, Ring oder Rat.
const DEUTSCH = [
  'und', 'der', 'das', 'nicht', 'ist', 'ein', 'eine', 'einen', 'mit', 'auf',
  'Du', 'Dich', 'Dir', 'Dein', 'Deine', 'du', 'dich', 'dein', 'ich', 'wir', 'zu', 'von', 'noch',
  'kein', 'keine', 'wird', 'oder', 'aber', 'sich', 'auch', 'wenn', 'dem',
  'zum', 'zur', 'Weiter', 'Schliessen', 'schliessen', 'Kaufen', 'Verkaufen',
  'Schaden', 'Tiefe', 'Stufe', 'STUFE', 'Gegner', 'Truhe', 'Schmiede',
  'Druckerei', 'Rathauskeller', 'Faehigkeit', 'Auftrag', 'Aufgaben',
  'Abbrechen', 'Waffe', 'Stiefel', 'Handschuhe', 'Taste', 'Leertaste',
  'Tippen', 'Beenden', 'Einstellungen', 'Sprache', 'Tagebuch', 'Talentpunkt',
  'Hinterhalt', 'HINTERHALT', 'Handel', 'Welle', 'Wellen', 'Raum', 'KRIT',
  'Kettenrat', 'Esse', 'Spitzel', 'Archivschmied', 'Eisenbrocken', 'Klick',
  'fortfahren', 'erlernt', 'ERLERNT', 'besiegt', 'Belohnung', 'Ratsherr',
  'Neues', 'Fortsetzen', 'Nein', 'Ausgeruestet', 'Skill Auswahl', 'Equipment-Items'
];
const DEUTSCH_RE = new RegExp('[\\u00e4\\u00f6\\u00fc\\u00c4\\u00d6\\u00dc\\u00df]|\\b(' + DEUTSCH.join('|') + ')\\b');

/** Liefert die deutsch aussehenden Stellen eines Textes (leer = englisch). */
function deutschIn(text) {
  let t = String(text);
  EIGENNAMEN.forEach((n) => { t = t.split(n).join(' '); });
  const m = t.match(DEUTSCH_RE);
  return m ? m[0] : null;
}

// Sammelt die Texte aller laufenden oder pausierten, sichtbaren Szenen.
// Unsichtbare Container zaehlen samt Inhalt nicht.
const SAMMELN = `(function () {
  var out = [];
  function gehe(liste, szene) {
    (liste || []).forEach(function (o) {
      if (!o || o.visible === false) return;
      if ((o.type === 'Text' || o.type === 'BitmapText') && o.text && String(o.text).trim()) {
        out.push(szene + ' | ' + String(o.text).replace(/\\n/g, ' / '));
      }
      if (o.list) gehe(o.list, szene);
    });
  }
  window.game.scene.scenes.forEach(function (s) {
    var st = s.sys.settings.status;
    if ((st === 5 || st === 6) && s.sys.settings.visible !== false) gehe(s.sys.displayList.list, s.sys.settings.key);
  });
  return JSON.stringify(out);
})()`;

let H = null;
const gesehen = {};       // Ansicht -> Liste der Texte

const T0 = Date.now();
function sammle(name) {
  gesehen[name] = JSON.parse(H.run(SAMMELN));
  if (process.env.EN_DUMP) console.log('[EN] ' + name + ' nach ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
}
async function takte(runden) {
  for (let i = 0; i < runden; i++) { H.step(10); await new Promise((r) => setTimeout(r, 0)); }
}
function laeuft(key) {
  return H.run(`(function () { var s = window.game.scene.getScene('${key}');
    return !!(s && s.sys.settings.status === 5); })()`);
}
async function bis(pred, runden) {
  for (let i = 0; i < (runden || 200); i++) {
    if (pred()) return true;
    H.step(10); await new Promise((r) => setTimeout(r, 0));
  }
  return !!pred();
}
async function hubNeu() {
  H.run(`window.game.scene.getScene('HubSceneV2').scene.restart()`);
  await takte(2);
  assert.ok(await bis(() => laeuft('HubSceneV2')), 'Hub laeuft nach dem Neustart nicht');
  await takte(10);
}
function hub(code) {
  return H.run(`(function () { var hub = window.game.scene.getScene('HubSceneV2'); ${code} })()`);
}
function spiel(code) {
  return H.run(`(function () { var gs = window.game.scene.getScene('GameScene'); ${code} })()`);
}

before(async () => {
  H = await launch({ renderer: 'canvas', waitFor: 'StartScene', maxRounds: 250 });
  H.run(`window.Persistence.setLanguage('en'); window.i18n.setLanguage('en')`);

  // --- Startbildschirm ---------------------------------------------------
  H.run(`window.game.scene.getScene('StartScene').scene.restart()`);
  await takte(2);
  assert.ok(await bis(() => laeuft('StartScene')), 'StartScene laeuft nicht');
  await takte(20);
  sammle('start');

  // --- Neues Spiel -> Hub (derselbe Weg wie "Neues Spiel" nach dem Neuladen)
  H.run(`window.sessionStorage.setItem('demonfall.pendingNewGame', '1');
    window.game.scene.getScene('StartScene').scene.restart()`);
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 wurde nicht erreicht');
  await takte(30);
  sammle('hub');

  // --- Dialoge im Hub ----------------------------------------------------
  const npcs = hub(`return JSON.stringify(hub.npcs.map(function (n) { return n.data.id; }))`);
  for (const id of JSON.parse(npcs)) {
    hub(`var n = hub.npcs.filter(function (x) { return x.data.id === '${id}'; })[0];
      hub._showNpcDialogue(n.data);`);
    await takte(40);
    sammle('dialog_' + id);
    await hubNeu();
  }

  // --- Ueberlagerungen im Hub ---------------------------------------------
  H.run(`openInventory()`); await takte(5); sammle('inventar');
  H.run(`closeInventory()`); await takte(3);

  hub(`hub._handleJournal()`); await takte(8); sammle('tagebuch');
  await hubNeu();

  H.run(`window.openSkillTreeScene(window.game.scene.getScene('HubSceneV2'))`);
  assert.ok(await bis(() => laeuft('SkillTreeScene')), 'SkillTreeScene laeuft nicht');
  await takte(8); sammle('talente');
  H.run(`window.game.scene.stop('SkillTreeScene')`); await hubNeu();

  hub(`hub._showKnowledgeTreeUI()`); await takte(8); sammle('wissensbaum');
  await hubNeu();

  H.run(`window.openSettingsScene(window.game.scene.getScene('HubSceneV2'))`);
  assert.ok(await bis(() => laeuft('SettingsScene')), 'SettingsScene laeuft nicht');
  await takte(8); sammle('einstellungen');
  H.run(`window.game.scene.stop('SettingsScene')`); await hubNeu();

  H.run(`window.openPrintingHouseScene(window.game.scene.getScene('HubSceneV2'))`);
  assert.ok(await bis(() => laeuft('PrintingHouseScene')), 'PrintingHouseScene laeuft nicht');
  await takte(8); sammle('druckerei');
  H.run(`window.game.scene.stop('PrintingHouseScene')`); await hubNeu();

  // Der Schwarzmarkt oeffnet sonst erst ab Tiefe 4; die Haendler-Flagge umgeht die Sperre.
  H.run(`window._dungeonMerchant = true; window.openShopScene(window.game.scene.getScene('HubSceneV2'))`);
  assert.ok(await bis(() => laeuft('ShopScene')), 'ShopScene laeuft nicht');
  await takte(8); sammle('schwarzmarkt');
  H.run(`window.game.scene.stop('ShopScene'); window._dungeonMerchant = false;`); await hubNeu();

  hub(`window.HubTruheUI.oeffne(hub)`); await takte(8); sammle('truhe');
  await hubNeu();

  // --- Schmiede ------------------------------------------------------------
  hub(`hub._enterLocation(window.HUB_HITBOXES.entrances.filter(function (e) { return e.target === 'CraftingScene'; })[0])`);
  assert.ok(await H.waitForScene('CraftingScene', { maxRounds: 250 }), 'CraftingScene wurde nicht erreicht');
  await takte(15); sammle('schmiede');
  H.run(`window.game.scene.getScene('CraftingScene').scene.start('HubSceneV2')`);
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'zurueck im Hub');
  await takte(10);

  // --- Dungeon -------------------------------------------------------------
  hub(`hub._enterLocation(window.HUB_HITBOXES.entrances.filter(function (e) { return e.target === 'GameScene'; })[0])`);
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 250 }), 'GameScene wurde nicht erreicht');
  H.run('window._playerInvincible = true');
  await takte(40); sammle('dungeon');

  H.run(`openInventory()`); await takte(5); sammle('dungeon_inventar');
  H.run(`closeInventory()`); await takte(3);

  // Aufstieg: derselbe Effekt und Hinweis wie beim echten Stufenaufstieg.

  H.run(`addXP(neededXP - playerXP + 1)`);
  await takte(2); sammle('aufstieg');
  await takte(30);

  // Haendler: erscheinen lassen, daneben stellen, [E]-Hinweis lesen.
  spiel(`var m = window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'wandering_merchant'; })[0];
    m.handler(gs);`);
  assert.ok(await bis(() => H.run('!!window.EventSystem.aktiverHaendler()'), 120), 'der Haendler erscheint nicht');
  spiel(`var a = window.EventSystem.aktiverHaendler();
    player.x = a.sprite.x + 30; player.y = a.sprite.y + 10;
    if (player.body) player.body.reset(player.x, player.y);`);
  await takte(2); sammle('haendler');

  // Hinterhalt: das Banner.
  spiel(`var e = window.EventSystem.EVENT_TYPES.filter(function (e) { return e.id === 'ambush'; })[0];
    e.handler(gs);`);
  await takte(2); sammle('hinterhalt');
  await takte(30);

  // Ereignis-Dialog (Schatzfund), danach schliessen.
  spiel(`window.EventSystem.showEventChoiceDialog(gs, window.i18n.t('event.treasure.name'), [
      { label: window.i18n.t('event.treasure.choice_search'), callback: function () {} },
      { label: window.i18n.t('event.treasure.choice_gold', { amount: 10 }), callback: function () {} }
    ]);`);
  await takte(5); sammle('ereignis');
  spiel(`gs.input.keyboard.emit('keydown-ESC')`);
  await takte(5);

  // Neue Faehigkeit erlernt.
  H.run(`window.AbilitySystem.forgetAbility('frostNova'); window.AbilitySystem.learnAbility('frostNova')`);
  await takte(5); sammle('faehigkeit');
  spiel(`gs.input.keyboard.emit('keydown-SPACE')`);
  await takte(10);

  // Boss-Auftritt (Vorkampf-Beat) des Kettenmeisters.
  spiel(`var def = getBossDefinition(10).def;
    window.BossIntro.inszeniere(gs, { x: player.x + 80, y: player.y, body: { setVelocity: function () {} } },
      def.name, _bossIntroLore(def));`);
  await takte(2); sammle('bossauftritt');
});

after(async () => {
  if (H) {
    try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {}
    await H.shutdown();
  }
});

test('Englisch: jede Ansicht zeigt Text', () => {
  for (const name of Object.keys(gesehen)) {
    assert.ok(gesehen[name].length > 0, name + ': kein einziger Text gesammelt');
  }
  // Stichproben: die Ansichten sind wirklich offen gewesen.
  const alles = (n) => gesehen[n].join('\n');
  assert.match(alles('tagebuch'), /Journal/);
  assert.match(alles('haendler'), /\[E\] Trade/);
  assert.match(alles('hinterhalt'), /AMBUSH!/);
  assert.match(alles('faehigkeit'), /NEW ABILITY LEARNED/);
  assert.match(alles('aufstieg'), /LEVEL 2/);
  assert.match(alles('bossauftritt'), /Begin the fight/);
});

test('Englisch: kein deutsches Wort in den sichtbaren Texten', () => {
  const funde = [];
  for (const name of Object.keys(gesehen)) {
    for (const zeile of gesehen[name]) {
      const text = zeile.slice(zeile.indexOf(' | ') + 3);
      const wort = deutschIn(text);
      if (wort) funde.push(name + ' | ' + zeile + '   <- "' + wort + '"');
    }
  }
  if (process.env.EN_DUMP) console.log(JSON.stringify(gesehen, null, 1));
  assert.strictEqual(funde.length, 0, 'deutsch auf Englisch:\n  ' + funde.join('\n  '));
});
