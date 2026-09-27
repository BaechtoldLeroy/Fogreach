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
