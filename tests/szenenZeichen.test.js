// tests/szenenZeichen.test.js — Eine Szene im Gespraech zeigt ihr "!".
//
// Manche Schritte der Geschichte sind keine Auftraege, sondern Szenen, die
// beim Ansprechen einer Figur spielen (HubSceneV2._showNpcDialogue). Ohne
// Zeichen ueber dem Kopf wusste niemand, dass er hingehen soll: In Akt 3
// wartete das Wiedersehen bei Harren, und erst danach bietet er "Das
// versiegelte Archiv" an — die Geschichte stand still.
//
// Ausloeser und Zeichen lesen dieselbe Bedingung (_wiedersehenFaellig,
// _oeffentlicheSitzungFaellig, _abrechnungFaellig). Geprueft wird am echten
// Hub: das Zeichen VOR dem Gespraech, die Szene IM Gespraech, kein Zeichen
// DANACH. Vorrang: Abgabe "?" > Szene "!" > Angebot "!".

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const hub = "window.game.scene.getScene('HubSceneV2')";
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
  // Die Szenen werden aufgezeichnet und sofort beendet. Die oeffentliche
  // Sitzung feuert dabei ihren observe-Trigger wie die echte.
  H.run(`(function () {
    var sc = ${hub};
    window.__szenen = [];
    ['playWiedersehen', 'playOeffentlicheSitzung'].forEach(function (n) {
      window.storyScenes[n] = function (s, fertig) {
        window.__szenen.push(n);
        if (n === 'playOeffentlicheSitzung') window.questSystem.updateQuestProgress('observe', 'oeffentliche_sitzung', 1);
        if (typeof fertig === 'function') fertig();
      };
    });
    sc._showReckoningFinale = function () { window.__szenen.push('abrechnung'); };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Spielstand: ALLE Auftraege erledigt, ausser den genannten ('available' |
 * 'active' | 'ready'). Akt mit allen Karten gesehen.
 */
function stand(akt, offen, flags) {
  return H.run(`(function () {
    window.storySystem.loadStorySaveData({ currentActIndex: ${akt},
      eventsSeen: ['auftrag', 'treuer_diener', 'erste_risse', 'wahrheit', 'bruch'] });
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = ${JSON.stringify(flags || {})};
    st.flags.hub_intro_a0_seen = true;
    var offen = ${JSON.stringify(offen)};
    Object.keys(qs.QUEST_DEFINITIONS).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id], v = offen[id] || 'completed';
      st.quests[id] = { status: v === 'ready' ? 'active' : v, objectives: v === 'available' ? null : d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: (v === 'completed' || v === 'ready') ? o.required : 0, required: o.required }; }) };
    });
    qs.loadQuestSaveData(st);
    var sc = ${hub};
    try { sc._wendeHubPhaseAn(sc._ermittelePhase()); } catch (x) {}
    sc._refreshQuestIndicators();
    return window.storySystem.getCurrentActIndex();
  })()`);
}

/** Das Zeichen, wie es ueber dem Kopf steht (Textobjekt), und was _questZeichen sagt. */
function zeichen(npc) {
  return H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt im Hub' };
    var t = n.questIndicator;
    return { regel: sc._questZeichen('${npc}'), sichtbar: !!(t && t.visible), text: t ? t.text : null };
  })()`);
}

/** Die Figur ansprechen; welche Szenen spielten. Danach ist der Dialog zu. */
function reden(npc) {
  return Array.from(H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    var vorher = window.__szenen.length;
    sc._dialogOpen = false;
    sc._showNpcDialogue(n.data);
    try { sc._closeDialog(null); } catch (e) {}
    sc._dialogOpen = false;
    return window.__szenen.slice(vorher);
  })()`));
}

// Nach dem Wiedersehen steht nur noch das Spaetere aus.
const SPAETER = {
  espionage_informant: 'available', was_der_rauch_behaelt: 'available', schattenrat_finale: 'available',
  mara_assault: 'available', the_reckoning: 'available', branka_weapons: 'available',
  thom_pamphlets: 'available', branka_eichgewicht: 'available', bruch_confrontation: 'available'
};

test('Harren zeigt in Akt 3 "!" fuer das Wiedersehen, danach nicht mehr', () => {
  // Das Archiv als erledigt: so bleibt nach der Szene nichts, was ein "!" setzt.
  assert.strictEqual(stand(3, SPAETER), 3, 'der Stand misst nicht, was er soll (Akt)');
  assert.strictEqual(H.run(`window.questSystem.getAvailableQuests('harren').length`), 0,
    'der Stand misst nicht, was er soll: Harren bietet etwas an');
  const vor = zeichen('harren');
  assert.ok(!vor.fehler, vor.fehler);
  assert.deepStrictEqual([vor.regel, vor.sichtbar, vor.text], ['!', true, '!'],
    'ueber Harren steht vor dem Wiedersehen kein "!": ' + JSON.stringify(vor));
  assert.deepStrictEqual(reden('harren'), ['playWiedersehen'], 'das Gespraech spielt das Wiedersehen nicht');
  const nach = zeichen('harren');
  assert.deepStrictEqual([nach.regel, nach.sichtbar], [null, false],
    'das "!" bleibt nach dem Wiedersehen stehen: ' + JSON.stringify(nach));
});

test('Nach dem Wiedersehen kommt Harrens Archiv-Auftrag mit seinem eigenen "!"', () => {
  stand(3, Object.assign({}, SPAETER, { espionage_archive: 'available' }));
  assert.strictEqual(zeichen('harren').regel, '!');
  assert.deepStrictEqual(reden('harren'), ['playWiedersehen']);
  assert.deepStrictEqual(Array.from(H.run(`window.questSystem.getAvailableQuests('harren').map(function (q) { return q.id; })`)),
    ['espionage_archive'], 'nach dem Wiedersehen bietet Harren das Archiv nicht an');
  assert.strictEqual(zeichen('harren').regel, '!', 'das Archiv-Angebot zeigt kein "!"');
  assert.deepStrictEqual(reden('harren'), [], 'das Wiedersehen kam ein zweites Mal');
});

test('In Akt 2 steht nichts an: kein Zeichen ueber Harren', () => {
  // Der Kettenmeister offen: sonst zieht das Laden den Akt auf 3 nach.
  stand(2, Object.assign({}, SPAETER, { espionage_archive: 'available', mara_warning: 'available' }));
  assert.strictEqual(H.run(`window.storySystem.getCurrentActIndex()`), 2, 'der Stand misst nicht, was er soll');
  const z = zeichen('harren');
  assert.deepStrictEqual([z.regel, z.sichtbar], [null, false], 'Zeichen ohne Szene und Auftrag: ' + JSON.stringify(z));
  assert.deepStrictEqual(reden('harren'), []);
});

test('Die Abgabe geht dem Wiedersehen im Zeichen vor', () => {
  stand(3, Object.assign({}, SPAETER, { espionage_archive: 'ready' }));
  assert.strictEqual(zeichen('harren').regel, '?');
});

test('Die oeffentliche Sitzung steht an: "!" ueber Harren statt "…"', () => {
  // Angenommen, aber nie im Ratssaal gewesen (z. B. abgebrochen).
  stand(1, Object.assign({}, SPAETER, { council_collusion_reveal: 'active' }),
    { elara_ist_lene: true });
  const lage = H.run(`(function () { var l = ${hub}._gespraechsLage('harren'); return [l.questMode, l.questData && l.questData.id]; })()`);
  assert.deepStrictEqual(Array.from(lage), ['progress', 'council_collusion_reveal'], 'der Stand misst nicht, was er soll');
  const vor = zeichen('harren');
  assert.deepStrictEqual([vor.regel, vor.text], ['!', '!'], 'ueber Harren steht kein "!" fuer die Sitzung: ' + JSON.stringify(vor));
  assert.deepStrictEqual(reden('harren'), ['playOeffentlicheSitzung'], 'das Gespraech schickt nicht in die Sitzung');
  // Danach laeuft die geheime Sitzung unten — das ist Arbeit, kein neuer Schritt hier.
  assert.strictEqual(zeichen('harren').regel, '…', 'nach der Sitzung bleibt das "!" stehen');
});

test('Die Abrechnung laeuft schon: "!" ueber Thom statt "…"', () => {
  stand(4, { the_reckoning: 'active' }, { enttarnt: true, elara_ist_lene: true });
  const lage = H.run(`(function () { var l = ${hub}._gespraechsLage('thom'); return [l.questMode, l.questData && l.questData.id]; })()`);
  assert.deepStrictEqual(Array.from(lage), ['progress', 'the_reckoning'], 'der Stand misst nicht, was er soll');
  assert.strictEqual(zeichen('thom').regel, '!', 'ueber Thom steht kein "!" fuer das Finale');
  assert.deepStrictEqual(reden('thom'), ['abrechnung'], 'das Gespraech spielt das Finale nicht');
});

test('Gegenprobe: ein laufender Auftrag ohne Szene bleibt "…"', () => {
  stand(4, { who_you_were: 'active', branka_eichgewicht: 'available' }, { enttarnt: true, elara_ist_lene: true });
  assert.strictEqual(zeichen('branka').regel, '…');
});
