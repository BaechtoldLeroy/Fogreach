// tests/ratNachDemBruch.test.js — Nach dem Bruch: Aldric weg, seine Auftraege
// entfallen, die Figuren sprechen von der Jagd (Stufe 1b, Story v6.1).
//
// Bis b459 stand Aldric nach dem Bruch weiter auf dem Platz (hubLayout
// hiddenAfterFlag nur story_ending), seine noch offenen Auftraege hingen
// ohne Abgabe herum, und zwischen Bruch und Maulwurf sagte Branka "Sie sucht
// Dich noch nicht", obwohl die Kettenwache Dich laengst jagte.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const hub = "window.game.scene.getScene('HubSceneV2')";
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/**
 * Spielstand: ALLE Auftraege erledigt, ausser den genannten
 * ('available' | 'active' | 'ready'). Akt mit allen Karten gesehen.
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
    sc._refreshNpcVisibility();
    return true;
  })()`);
}

// Kurz vor dem Bruch: der Bruch ist abgabereif, alles danach steht aus.
// Zwei Einfuehrungen bei Aldric: die Akte laeuft, die Talente nie angenommen.
const VOR_BRUCH = {
  bruch_confrontation: 'ready', espionage_informant: 'available', was_der_rauch_behaelt: 'available',
  schattenrat_finale: 'available', mara_assault: 'available', the_reckoning: 'available',
  thom_pamphlets: 'available', branka_eichgewicht: 'available',
  einfuehrung_akte: 'active', einfuehrung_talente: 'available'
};

const aldricSichtbar = () => H.run(`(function () {
  var n = ${hub}.npcs.filter(function (x) { return x.data && x.data.id === 'aldric'; })[0];
  return !!(n && n.sprite && n.sprite.active && n.sprite.visible);
})()`);
const status = (id) => H.run(`(window.questSystem.getQuestSaveData().quests['${id}'] || {}).status`);

test('Der Bruch: Aldric verschwindet, seine offenen Auftraege entfallen ohne Lohn', () => {
  stand(3, VOR_BRUCH);
  assert.strictEqual(aldricSichtbar(), true, 'Aldric fehlt schon vor dem Bruch');
  assert.strictEqual(H.run(`window.questSystem.getActiveQuests('aldric').length`), 1, 'die Akte laeuft nicht');
  const vorher = H.run(`({ xp: window.playerXP || 0, gold: window.LootSystem.getGold ? window.LootSystem.getGold() : 0 })`);
  assert.strictEqual(H.run(`window.questSystem.completeQuest('bruch_confrontation')`), true, 'der Bruch liess sich nicht abschliessen');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('enttarnt')`), true);
  assert.strictEqual(status('einfuehrung_akte'), 'entfallen', 'der laufende Auftrag haengt weiter');
  assert.strictEqual(status('einfuehrung_talente'), 'entfallen', 'der nie angenommene Auftrag bleibt offen');
  assert.strictEqual(status('council_seizure'), 'completed', 'ein erledigter Auftrag wurde angefasst');
  const r = H.run(`(function () {
    var qs = window.questSystem;
    return { aktiv: qs.getActiveQuests().map(function (q) { return q.id; }),
      angebot: qs.getAvailableQuests('aldric').map(function (q) { return q.id; }),
      tracker: qs.getTrackerText(),
      journal: window.storySystem.getJournalData().entfalleneQuests.map(function (q) { return q.title; }) };
  })()`);
  assert.ok(!Array.from(r.aktiv).includes('einfuehrung_akte'), 'die Akte zaehlt noch als laufend');
  assert.deepStrictEqual(Array.from(r.angebot), [], 'Aldric hat noch Angebote');
  assert.ok(!/Akte/.test(r.tracker), 'das Ziel steht noch im Tracker: ' + r.tracker);
  // Nur was man angenommen hatte, steht im Journal.
  assert.deepStrictEqual(Array.from(r.journal), ['Deine Akte']);
  H.step(2);
  assert.strictEqual(aldricSichtbar(), false, 'Aldric steht nach dem Bruch noch auf dem Platz');
  // Kein Lohn fuer die entfallenen: XP/Gold bewegen sich nur um den Bruch selbst.
  const lohnBruch = H.run(`window.questSystem.getQuestSaveData().quests.bruch_confrontation.lohn`);
  const nachher = H.run(`({ xp: window.playerXP || 0, gold: window.LootSystem.getGold ? window.LootSystem.getGold() : 0 })`);
  assert.ok(nachher.gold - vorher.gold <= (lohnBruch.gold | 0), 'Gold fuer einen entfallenen Auftrag');
});

test('Das Journal schreibt den Vermerk', () => {
  // Der Stand aus dem Fall davor (Akte entfallen).
  const r = H.run(`(function () {
    var sc = ${hub};
    window.storySystem.showJournalOverlay(sc, function () {});
    var c = sc.children.list.filter(function (o) { return o.type === 'Container' && o.depth === 6001; }).pop();
    var t = []; (function s(o) { if (!o) return; if (o.type === 'Text') t.push(String(o.text)); (o.list || []).forEach(s); })(c);
    sc.children.list.filter(function (o) { return o.depth >= 6000 && o.depth < 6100; }).forEach(function (o) { o.destroy(); });
    if (window.resumeGameClock) window.resumeGameClock();
    return t;
  })()`);
  const alles = Array.from(r).join(' | ');
  assert.ok(/✕ Deine Akte/.test(alles), 'der entfallene Auftrag fehlt im Journal: ' + alles.slice(0, 400));
  assert.ok(/Der Rat gibt Dir keine Aufträge mehr\./.test(alles), 'der Vermerk fehlt: ' + alles.slice(0, 400));
});

test('Spielstand hinter dem Bruch: beim Laden entfallen die Auftraege, auch ohne Flag', () => {
  // Aeltere Staende trugen 'enttarnt' noch nicht; der abgeschlossene Bruch genuegt.
  stand(3, { espionage_informant: 'available', was_der_rauch_behaelt: 'available', schattenrat_finale: 'available',
    mara_assault: 'available', the_reckoning: 'available', einfuehrung_akte: 'active' });
  assert.strictEqual(H.run(`window.questSystem.hasFlag('enttarnt')`), true, 'das Flag wurde nicht nachgezogen');
  assert.strictEqual(status('einfuehrung_akte'), 'entfallen');
  H.step(2);
  assert.strictEqual(aldricSichtbar(), false);
  // Und es bleibt so: speichern, laden.
  H.run(`window.questSystem.loadQuestSaveData(window.questSystem.getQuestSaveData())`);
  assert.strictEqual(status('einfuehrung_akte'), 'entfallen', 'der Vermerk geht beim Laden verloren');
  assert.strictEqual(H.run(`window.storySystem.getJournalData().entfalleneQuests.length`), 1);
});

test('Vor dem Bruch bleibt alles, wie es ist', () => {
  stand(3, VOR_BRUCH);
  assert.strictEqual(status('einfuehrung_akte'), 'active');
  assert.strictEqual(status('einfuehrung_talente'), 'available');
  assert.strictEqual(aldricSichtbar(), true);
});

test('Die verseuchte Kammer steht vor dem Bruch; ein laufender Bruch wird nicht gesperrt', () => {
  const pre = H.run(`window.questSystem.QUEST_DEFINITIONS.bruch_confrontation.prerequisites`);
  assert.ok(Array.from(pre).includes('verseuchte_kammer'), 'die Kammer ist keine Voraussetzung des Bruchs');
  // Ohne Kammer kein Angebot ...
  stand(3, Object.assign({}, VOR_BRUCH, { bruch_confrontation: 'available', verseuchte_kammer: 'available' }));
  assert.ok(!H.run(`window.questSystem.getAvailableQuests('branka').map(function (q) { return q.id; })`).includes('bruch_confrontation'));
  // ... aber ein Stand, in dem der Bruch schon laeuft, bleibt laufend und abschliessbar.
  stand(3, Object.assign({}, VOR_BRUCH, { verseuchte_kammer: 'available' }));
  assert.strictEqual(status('bruch_confrontation'), 'active');
  assert.strictEqual(H.run(`window.questSystem.completeQuest('bruch_confrontation')`), true);
  // Die Kammer selbst war Aldrics Auftrag: sie entfaellt mit dem Bruch.
  assert.strictEqual(status('verseuchte_kammer'), 'entfallen');
});

/** Die Zeilen, die eine Figur im Flavor-Gespraech sagt (alle Seiten). */
function zeilen(npc) {
  return Array.from(H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    var orig = sc._showDialoguePages, fang = null;
    sc._showDialoguePages = function (d, t, pages, mode) { if (!fang) fang = pages.map(function (p) { return (p.text || '') + ((p.choices || p._choiceConfig) ? ' [Auswahl]' : ''); }); };
    try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
    sc._dialogOpen = false;
    return fang || [];
  })()`));
}

// Stand zwischen Bruch und Maulwurf, ohne offene Auftraege bei den Figuren.
const ZWISCHEN = { espionage_informant: 'available', was_der_rauch_behaelt: 'available', schattenrat_finale: 'available',
  mara_assault: 'available', the_reckoning: 'available',
  thom_pamphlets: 'available', branka_eichgewicht: 'available' };

test('Zwischen Bruch und Maulwurf: Branka spricht von der Jagd, Mara und Harren verraten den Maulwurf nicht', () => {
  stand(3, ZWISCHEN, { enttarnt: true, elara_ist_lene: true });
  const branka = zeilen('branka').join(' | ');
  assert.ok(/Aldric weiss es/.test(branka), 'Branka spricht nicht vom Bruch: ' + branka);
  assert.ok(!/sucht Dich noch nicht/.test(branka), 'Branka sagt noch, man suche Dich nicht');
  // Mara und Harren haben in diesem Stand Auftraege (der Maulwurf, das
  // Archiv); ihre Flavor-Zeilen kommen aus derselben Quelle wie Brankas.
  const mara = Array.from(H.run(`window.storySystem.getNpcDialogue('mara')`)).join(' | ');
  assert.ok(/Aldric weiss, wer Du bist/.test(mara), 'Mara: ' + mara);
  assert.ok(!/Elara/.test(mara), 'Mara weiss schon vom Maulwurf: ' + mara);
  const harren = Array.from(H.run(`window.storySystem.getNpcDialogue('harren')`)).join(' | ');
  assert.ok(/Kettenwache war bei mir/.test(harren), 'Harren: ' + harren);
  assert.ok(!/neben Aldric/.test(harren), 'Harren weiss schon vom Maulwurf: ' + harren);
  const thom = zeilen('thom').join(' | ');
  assert.ok(/drucken wir alles/.test(thom), 'Thom: ' + thom);
});

test('Vor dem Bruch gelten noch die Zeilen der Enttarnung', () => {
  stand(3, Object.assign({}, ZWISCHEN, { bruch_confrontation: 'available', verseuchte_kammer: 'available' }), { elara_ist_lene: true });
  assert.ok(/sucht Dich noch nicht/.test(zeilen('branka').join(' | ')));
});

test('Klerus, Wachtmeister und Buerger haben Zeilen fuer den Bruch und den Epilog', () => {
  stand(4, { mara_assault: 'available', the_reckoning: 'available', schattenrat_finale: 'available' }, { enttarnt: true });
  const klerus = zeilen('klerus_priester').join(' | ');
  assert.ok(/Besessenheit/.test(klerus), 'Klerus im Bruch: ' + klerus);
  const wache = zeilen('stadtwache').join(' | ');
  assert.ok(/Befehl, Dich festzunehmen/.test(wache), 'Wachtmeister im Bruch: ' + wache);
  const buerger = zeilen('buerger');
  assert.ok(/sie suchen Dich/.test(buerger.join(' | ')), 'Buerger im Bruch: ' + buerger.join(' | '));
  assert.ok(!buerger.some((z) => /\[Auswahl\]/.test(z)), 'der Buerger fragt noch, ob Du im Rathaus aus und ein gehst');
  stand(4, {}, { enttarnt: true, story_ending: true });
  assert.ok(/Reinigung/.test(zeilen('klerus_priester').join(' | ')), 'Klerus im Epilog');
  assert.ok(/Gewohnheit/.test(zeilen('stadtwache').join(' | ')), 'Wachtmeister im Epilog');
  assert.ok(/BÜRGER: /.test(zeilen('buerger').join(' | ')), 'Buerger im Epilog');
});

test('Mara heisst "Späherin Mara"', () => {
  assert.strictEqual(H.run(`${hub}.npcs.filter(function (x) { return x.data.id === 'mara'; })[0].data.name`), 'Späherin Mara');
});
