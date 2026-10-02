// tests/maraDienste.test.js — Maras Laden bleibt offen, auch mit Auftrag.
//
// Mara ist nicht nur eine Questgeberin: an ihrem Dialog haengen drei Systeme
// des Spiels — Schwarzmarkt, Wissensbaum und Talentbaum. Sie erschienen nur,
// solange sie GAR KEINE Quest hatte (questMode 'flavor').
//
// Damit sperrte jeder ihrer Auftraege drei Systeme aus, und ihr eigener
// Einfuehrungsauftrag ("kauf mir etwas ab", #143) sperrte genau den Laden,
// den er verlangt — angenommen und nicht mehr erfuellbar.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  // Sauberer Auftragsstand und geschlossener Dialog. Und Tiefe 4: der
  // Schwarzmarkt hat ein ZWEITES, aelteres Tor (#51, isBlackMarketUnlocked)
  // — ohne das bleibt sein Knopf auch ohne jeden Auftrag weg, und der Test
  // wuerde den falschen Grund messen.
  H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = {};
    qs.loadQuestSaveData(st);
    if (typeof sc._closeDialog === 'function') { try { sc._closeDialog([]); } catch (e) {} }
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '6');
    window.LootSystem.grantGold(5000);
    return window.LootSystem.isBlackMarketUnlocked();
  })()`);
});

/** Oeffnet Maras Dialog und sammelt allen sichtbaren Text ein. */
function maraDialog() {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var m = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    if (!m) return { fehler: 'Mara fehlt' };
    sc._showNpcDialogue(m.data);
    var texte = [];
    (function sammeln(o) {
      if (!o) return;
      if (o.type === 'Text' && o.text) texte.push(o.text);
      (o.list || []).forEach(sammeln);
    })({ list: sc.children.list });
    return { texte: texte };
  })()`);
}

const hatDienste = (r) => {
  const alles = Array.from(r.texte).join(' | ');
  return {
    markt: /Schwarzmarkt/.test(alles),
    wissen: /Wissen/.test(alles),
    talente: /Talent/.test(alles),
    alles: alles
  };
};

test('Ohne Auftrag stehen ihre drei Dienste im Dialog', () => {
  const r = maraDialog();
  assert.ok(!r.fehler, r.fehler);
  const d = hatDienste(r);
  assert.ok(d.markt && d.wissen && d.talente,
    'ein Dienst fehlt schon ohne Auftrag: ' + JSON.stringify(d));
});

test('Mit angenommenem Auftrag bleiben sie stehen', () => {
  // Der Kern des Fehlers: ihr eigener Auftrag verlangt einen Kauf bei ihr.
  H.run(`window.questSystem.acceptQuest('einfuehrung_markt')`);
  assert.strictEqual(
    H.run(`window.questSystem.getActiveQuests('mara').map(function (q) { return q.id; }).join(',')`),
    'einfuehrung_markt', 'der Auftrag laeuft gar nicht');
  const d = hatDienste(maraDialog());
  assert.ok(d.markt, 'der Schwarzmarkt ist zu, solange ihr Auftrag laeuft — '
    + 'genau der Auftrag, der einen Kauf verlangt: ' + d.alles);
  assert.ok(d.wissen && d.talente,
    'Wissensbaum oder Talente fehlen mit laufendem Auftrag: ' + JSON.stringify(d));
});

test('Auch ein fremder Auftrag von ihr sperrt nichts aus', () => {
  // Nicht nur die Einfuehrung: JEDE ihrer Quests hatte denselben Effekt.
  H.run(`(function () {
    var qs = window.questSystem;
    qs.acceptQuest('mara_contact');
    return 1;
  })()`);
  const d = hatDienste(maraDialog());
  assert.ok(d.markt && d.wissen && d.talente,
    'ein Dienst fehlt bei laufendem mara_contact: ' + JSON.stringify(d));
});

test('Auf der Auswahlseite treten sie zurueck', () => {
  // Wenn die Seite annehmen/ablehnen anbietet, braucht sie den Platz. Das ist
  // die einzige Bedingung, die bleiben durfte.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var m = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    // Angebotsseite: Quest verfuegbar, noch nicht angenommen.
    sc._showNpcDialogue(m.data);
    var texte = [];
    (function sammeln(o) {
      if (!o) return;
      if (o.type === 'Text' && o.text) texte.push(o.text);
      (o.list || []).forEach(sammeln);
    })({ list: sc.children.list });
    return { texte: texte, auswahl: texte.some(function (t) { return /Annehmen|Accept/i.test(t); }) };
  })()`);
  if (!r.auswahl) return;                  // keine Auswahlseite -> nichts zu pruefen
  const alles = Array.from(r.texte).join(' | ');
  assert.ok(!/Schwarzmarkt/.test(alles),
    'die Dienste draengen sich zwischen die Auswahlknoepfe: ' + alles);
});

test('Auf der Abgabeseite treten sie ebenfalls zurueck', () => {
  // Die andere Richtung desselben Fehlers. Die Bedingung stand erst zu eng
  // (questMode === 'flavor' sperrte den Laden bei jeder Quest), dann zu weit
  // (!hasChoices): auf der ABGABE-Seite standen die drei Dienste mit, der
  // Abgabeknopf liegt aber erst auf der naechsten Seite. Die Seite sagte
  // 'Aufgabe abgeschlossen!' und bot drei Wege an, die alle vom Abschluss
  // wegfuehren — Dialog zu, Quest bleibt 'active', Belohnung nicht abgeholt.
  // Gemeldet als 'die Quest wurde nicht abgeschlossen'.
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var sc = window.game.scene.getScene('HubSceneV2');
    // Die Kette freischalten und den Auftrag abschlussreif machen.
    ['einfuehrung_upgrade', 'einfuehrung_markt'].forEach(function (id) {
      if (!qs.QUEST_DEFINITIONS || !qs.QUEST_DEFINITIONS[id]) return;
      qs.acceptQuest(id);
      var st = qs.getQuestSaveData();
      if (st.quests[id]) { st.quests[id].status = 'completed'; qs.loadQuestSaveData(st); }
    });
    qs.acceptQuest('einfuehrung_amulett');
    qs.onSystemUsed('haendler');
    if (!qs.isQuestReadyToComplete('einfuehrung_amulett')) return { fehler: 'nicht abschlussreif' };
    var m = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    if (!m) return { fehler: 'Mara fehlt' };
    if (typeof sc._closeDialog === 'function') { try { sc._closeDialog([]); } catch (e) {} }
    sc._showNpcDialogue(m.data);
    var texte = [];
    (function sammeln(o) {
      if (!o) return;
      if (o.type === 'Text' && o.text) texte.push(String(o.text));
      (o.list || []).forEach(sammeln);
    })({ list: sc.children.list });
    return { texte: texte };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  const alles = Array.from(r.texte).join(' | ');
  // Die Seite muss sich als Abgabe zu erkennen geben, sonst misst der Fall
  // den falschen Dialog.
  assert.ok(/abgeschlossen|complete/i.test(alles),
    'das ist keine Abgabeseite: ' + alles.slice(0, 200));
  assert.ok(!/Schwarzmarkt/.test(alles),
    'der Schwarzmarkt fuehrt von der Abgabe weg: ' + alles.slice(0, 200));
  assert.ok(!/Talente/.test(alles),
    'die Talente fuehren von der Abgabe weg: ' + alles.slice(0, 200));
  assert.ok(!/Wissen lernen/.test(alles),
    'das Wissen fuehrt von der Abgabe weg: ' + alles.slice(0, 200));
});

test('Die Abgabe fuehrt bis zur abgeholten Belohnung', () => {
  // Die ganze Kette, damit der Fall oben nicht nur Text zusichert: blaettern
  // bis zur Belohnung, abholen, Status pruefen.
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var sc = window.game.scene.getScene('HubSceneV2');
    ['einfuehrung_upgrade', 'einfuehrung_markt'].forEach(function (id) {
      if (!qs.QUEST_DEFINITIONS || !qs.QUEST_DEFINITIONS[id]) return;
      qs.acceptQuest(id);
      var st = qs.getQuestSaveData();
      if (st.quests[id]) { st.quests[id].status = 'completed'; qs.loadQuestSaveData(st); }
    });
    qs.acceptQuest('einfuehrung_amulett');
    qs.onSystemUsed('haendler');
    var m = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    if (typeof sc._closeDialog === 'function') { try { sc._closeDialog([]); } catch (e) {} }
    sc._showNpcDialogue(m.data);
    var text = function () {
      var t = [];
      (function s2(o) { if (!o) return; if (o.type === 'Text' && o.text) t.push(String(o.text)); (o.list || []).forEach(s2); })({ list: sc.children.list });
      return t;
    };
    var hat = function (re) { return text().some(function (t) { return re.test(t); }); };
    // Bis zur Belohnungsseite blaettern — BIS zur Bedingung, nicht feste Male.
    for (var i = 0; i < 6 && !hat(/Belohnung abholen/); i++) {
      if (sc._dialogPointerOnce) sc._dialogPointerOnce();
      else sc.input.keyboard.emit('keydown-SPACE', { preventDefault: function () {} });
    }
    if (!hat(/Belohnung abholen/)) return { fehler: 'die Belohnungsseite ist nicht erreichbar' };
    var vor = (qs.getQuestSaveData().quests.einfuehrung_amulett || {}).status;
    // Phaser gibt dem Handler (pointer, localX, localY, event) — ohne das
    // vierte Argument faellt er in event.stopPropagation().
    var EV = [{}, 0, 0, { stopPropagation: function () {} }];
    var ziel = null;
    (function s3(o) {
      if (!o || ziel) return;
      if (o.type === 'Text' && /Belohnung abholen/.test(String(o.text || ''))) ziel = o;
      (o.list || []).forEach(s3);
    })({ list: sc.children.list });
    var nah = [];
    (function s4(o) {
      if (!o) return;
      if (o.input && o.input.enabled && typeof o.emit === 'function' && typeof o.x === 'number'
          && Math.hypot(o.x - ziel.x, o.y - ziel.y) < 40) nah.push(o);
      (o.list || []).forEach(s4);
    })({ list: sc.children.list });
    nah.forEach(function (o) { try { o.emit.apply(o, ['pointerdown'].concat(EV)); } catch (e) {} });
    return { vor: vor, nach: (qs.getQuestSaveData().quests.einfuehrung_amulett || {}).status };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.vor, 'active', 'die Quest war vor dem Abholen schon abgeschlossen');
  assert.strictEqual(r.nach, 'completed',
    'nach dem Abholen steht die Quest auf "' + r.nach + '" statt completed');
});

