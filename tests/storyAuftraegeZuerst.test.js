// tests/storyAuftraegeZuerst.test.js — Story-Auftraege kommen immer zuerst.
//
// Bis b459 bot eine Figur mit laufendem Auftrag nichts Neues an
// (HubSceneV2._showNpcDialogue: ein laufender Auftrag -> nur Fortschritt).
// Lief bei Branka der optionale Auftrag "Wer du warst", kamen "Der Bruch"
// und "Die Quelle" nicht, die Geschichte stand still. Jetzt: Abgabe, dann ein
// neuer Story-Auftrag (rewardTier story/boss/finale), dann der Stand des
// laufenden, dann ein Nebenauftrag. Das "!" ueber dem Kopf folgt derselben
// Reihenfolge.

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
 * Spielstand: ALLE Auftraege erledigt, ausser den genannten (Status
 * 'available' | 'active' | 'ready'). So steht nur das offen, was der Fall
 * betrachtet. Akt mit allen Karten gesehen, damit keine dazwischenkommt.
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
    return true;
  })()`);
}

const angebote = (npc) => Array.from(H.run(`window.questSystem.getAvailableQuests('${npc}').map(function (q) { return q.id; })`));

/** Welches Gespraech die Figur jetzt fuehren wuerde: Modus, Auftrag, Zeichen ueber dem Kopf. */
function gespraech(npc) {
  return H.run(`(function () {
    var sc = ${hub};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt' };
    var orig = sc._showDialoguePages, fang = null;
    sc._showDialoguePages = function (d, t, pages, mode, q) {
      if (!fang) fang = { mode: mode, quest: q ? q.id : null };
    };
    try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
    sc._dialogOpen = false;
    var r = fang || { mode: 'keiner', quest: null };
    r.zeichen = sc._questZeichen('${npc}');
    return r;
  })()`);
}

// Was nach dem Bruch kommt, steht noch aus.
const NACH_BRUCH = {
  espionage_informant: 'available', was_der_rauch_behaelt: 'available', schattenrat_finale: 'available',
  mara_assault: 'available', the_reckoning: 'available', branka_weapons: 'available',
  thom_pamphlets: 'available', branka_eichgewicht: 'available'
};

test('Branka: mit laufendem "Wer du warst" bietet sie "Der Bruch" an', () => {
  stand(3, Object.assign({}, NACH_BRUCH, { bruch_confrontation: 'available', who_you_were: 'active' }));
  assert.deepStrictEqual(angebote('branka'), ['bruch_confrontation'], 'der Stand misst nicht, was er soll');
  const g = gespraech('branka');
  assert.ok(!g.fehler, g.fehler);
  assert.deepStrictEqual([g.mode, g.quest], ['offer', 'bruch_confrontation'],
    'der Bruch wartet hinter dem optionalen Auftrag: ' + JSON.stringify(g));
  assert.strictEqual(g.zeichen, '!', 'ueber Branka steht kein "!" fuer den Bruch');
});

test('Branka: mit laufendem "Wer du warst" bietet sie "Die Quelle" an', () => {
  stand(4, { schattenrat_finale: 'available', mara_assault: 'available', the_reckoning: 'available',
    who_you_were: 'active' }, { enttarnt: true });
  assert.deepStrictEqual(angebote('branka'), ['schattenrat_finale'], 'der Stand misst nicht, was er soll');
  const g = gespraech('branka');
  assert.deepStrictEqual([g.mode, g.quest], ['offer', 'schattenrat_finale'], JSON.stringify(g));
  assert.strictEqual(g.zeichen, '!');
});

test('Ein Nebenauftrag draengt sich nicht vor den laufenden', () => {
  // Gegenprobe: Das Eichgewicht (Neben) ueberholt "Wer du warst" nicht.
  stand(4, { branka_eichgewicht: 'available', who_you_were: 'active' }, { enttarnt: true });
  assert.deepStrictEqual(angebote('branka'), ['branka_eichgewicht'], 'der Stand misst nicht, was er soll');
  const g = gespraech('branka');
  assert.deepStrictEqual([g.mode, g.quest], ['progress', 'who_you_were'], JSON.stringify(g));
  assert.strictEqual(g.zeichen, '…');
});

test('Die Abgabe geht trotzdem vor', () => {
  stand(3, Object.assign({}, NACH_BRUCH, { bruch_confrontation: 'available', who_you_were: 'ready' }));
  const g = gespraech('branka');
  assert.deepStrictEqual([g.mode, g.quest], ['turnin', 'who_you_were'], JSON.stringify(g));
  assert.strictEqual(g.zeichen, '?');
});

test('Ohne laufenden Auftrag kommt der Story-Auftrag vor dem Nebenauftrag', () => {
  // Die Wissens-Einfuehrung (Neben) steht in der Liste VOR dem Bruch.
  stand(3, Object.assign({}, NACH_BRUCH, { bruch_confrontation: 'available', einfuehrung_wissen: 'available' }));
  assert.deepStrictEqual(angebote('branka'), ['einfuehrung_wissen', 'bruch_confrontation'],
    'der Stand misst nicht, was er soll (Nebenauftrag steht vorn in der Liste)');
  assert.strictEqual(gespraech('branka').quest, 'bruch_confrontation');
});

test('Aldric unter der Jagd der Druckerei: Story-Auftraege ja, Nebenauftraege nein', () => {
  // Die Akt-Aufsteiger danach offen lassen: sonst zieht das Laden den Akt nach.
  stand(2, { council_seizure: 'available', council_surveillance: 'available', verseuchte_kammer: 'available',
    einfuehrung_talente: 'available', mara_warning: 'available', bruch_confrontation: 'available',
    espionage_informant: 'available' });
  assert.deepStrictEqual(angebote('aldric'), ['einfuehrung_talente', 'council_seizure'], 'der Stand misst nicht, was er soll');
  const unterJagd = (js) => H.run(`(function () {
    var PH = window.PrintingHouse, alt = PH.getRetaliationTier;
    PH.getRetaliationTier = function () { return 'active_hunt'; };
    try { return ${js}; } finally { PH.getRetaliationTier = alt; }
  })()`);
  assert.deepStrictEqual(Array.from(unterJagd(`${hub}._angeboteFuer('aldric').map(function (q) { return q.id; })`)),
    ['council_seizure'], 'unter der Jagd haelt Aldric die Geschichte an oder bietet Nebenauftraege an');
  const g = unterJagd(`(function () {
    var sc = ${hub}, n = sc.npcs.filter(function (x) { return x.data.id === 'aldric'; })[0];
    var orig = sc._showDialoguePages, fang = null;
    sc._showDialoguePages = function (d, t, p, mode, q) { if (!fang) fang = { mode: mode, quest: q ? q.id : null }; };
    try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
    sc._dialogOpen = false;
    return fang;
  })()`);
  assert.deepStrictEqual([g.mode, g.quest], ['offer', 'council_seizure'], JSON.stringify(g));
});
