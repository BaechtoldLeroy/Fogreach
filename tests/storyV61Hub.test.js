// tests/storyV61Hub.test.js — Story-Kern v6.1 am echten Hub.
//
//   * Zwei Abschluesse: Das Ratssiegel abliefern oder unbemerkt beschaedigen
//     (Aldric), Maras Namensliste abliefern oder die Leute warnen (Klerus).
//     Die Wahl faellt beim Abgeben im echten Gespraech (storyDialog +
//     DialogChoice), danach wird abgeschlossen.
//   * Die Quelle: Branka gibt sie, Thom nimmt sie ab.
//   * Elara steht nie im Hub (auch nicht mit der alten Flagge aus b457),
//     Harren fehlt oben, sobald er Dir nach unten gefolgt ist.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const HUB = `window.game.scene.getScene('HubSceneV2')`;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
  H.step(20);
  H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog([]); } catch (e) {} sc._dialogOpen = false; })()`);
});
after(async () => { if (H) await H.shutdown(); });

/** Quest-Stand setzen: { id: 'completed' | 'ready' | 'active' }. */
function stand(eintraege, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = ${JSON.stringify(flags || {})};
    var e = ${JSON.stringify(eintraege)};
    Object.keys(e).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id];
      st.quests[id] = { status: e[id] === 'completed' ? 'completed' : 'active', objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: e[id] === 'active' ? 0 : o.required, required: o.required }; }) };
    });
    qs.loadQuestSaveData(st);
    return true;
  })()`);
}

/**
 * Bei einer Figur abgeben und an der Entscheidungsseite den Knopf `wahl`
 * druecken. Laeuft durch das echte Gespraech: _showNpcDialogue baut die
 * Seiten, die Entscheidungsseite rendert DialogChoice, deren Antwort schiebt
 * die Antwortseite ein, die Lohnseite schliesst ab.
 */
function abgeben(npc, wahl) {
  return H.run(`(function () {
    var sc = ${HUB}, qs = window.questSystem;
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt' };
    var orig = sc._showDialoguePages, aufrufe = [];
    sc._showDialoguePages = function (d, t, pages, mode, q, i) {
      aufrufe.push({ t: t, pages: pages, mode: mode, q: q, i: i });
      return orig.apply(this, arguments);
    };
    try {
      sc._dialogOpen = false;
      sc._showNpcDialogue(n.data);
      var a = aufrufe[0];
      if (!a || a.mode !== 'turnin') return { fehler: 'kein Abgabegespraech: ' + (a && a.mode) };
      var texte = a.pages.map(function (p) { return p.text; });
      var wi = a.pages.findIndex(function (p) { return p._choiceConfig; });
      if (wi < 0) return { fehler: 'keine Entscheidungsseite', texte: texte };
      orig.call(sc, n.data, a.t, a.pages, a.mode, a.q, wi);
      var panel = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0];
      if (!panel) return { fehler: 'DialogChoice erscheint nicht' };
      var knopf = panel.list.filter(function (o) { return o.type === 'Text' && o.input && o.text === ${JSON.stringify(wahl)}; })[0];
      if (!knopf) return { fehler: 'Knopf fehlt', knoepfe: panel.list.filter(function (o) { return o.type === 'Text' && o.input; }).map(function (o) { return o.text; }) };
      knopf.emit('pointerup');
      var b = aufrufe[aufrufe.length - 1];
      var antwort = b.pages[b.i] && b.pages[b.i].text;
      var lohn = b.pages.findIndex(function (p) { return p._isTurnin; });
      sc._handleDialogueChoice('complete', n.data, b.t, b.pages, b.mode, b.q, lohn, []);
      return { texte: texte, antwort: antwort, flags: qs.getFlags(),
        fertig: qs.getCompletedQuests().map(function (q) { return q.id; }) };
    } finally {
      sc._showDialoguePages = orig;
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = false;
    }
  })()`);
}

test('Verifikation: das Siegel abliefern', () => {
  stand({ harren_daughter_investigation: 'completed', magistrat_verification: 'ready' });
  const r = abgeben('aldric', 'Das Siegel abliefern');
  assert.ok(!r.fehler, r.fehler + ' ' + JSON.stringify(r.knoepfe || r.texte || ''));
  assert.ok(/weich/.test(r.texte[0]), 'der Abschlusstext nimmt die Wahl vorweg: ' + r.texte[0]);
  assert.ok(/Person von Interesse/.test(r.antwort), r.antwort);
  assert.strictEqual(r.flags.verification_sealed, true);
  assert.strictEqual(!!r.flags.verification_refused, false);
  assert.ok(Array.from(r.fertig).indexOf('magistrat_verification') >= 0, 'nicht abgeschlossen');
});

test('Verifikation: das Siegel unbemerkt beschaedigen', () => {
  stand({ harren_daughter_investigation: 'completed', magistrat_verification: 'ready' });
  const r = abgeben('aldric', 'Es unbemerkt beschädigen');
  assert.ok(!r.fehler, r.fehler);
  assert.ok(/Daumen/.test(r.antwort) && /Branka/.test(r.antwort), r.antwort);
  assert.strictEqual(r.flags.verification_refused, true);
  assert.strictEqual(!!r.flags.verification_sealed, false);
  assert.ok(Array.from(r.fertig).indexOf('magistrat_verification') >= 0, 'nicht abgeschlossen');
  // Branka vertraut Dir (Finale-Regler), der Epilog sagt es.
  const st = H.run(`window.QuestFinale.computeFinaleState(window.questSystem.getFlags()).allies.branka`);
  assert.strictEqual(st, true);
});

test('Maras Namensliste: abliefern', () => {
  stand({ klerus_district_purge: 'ready' });
  H.run('window.storySystem.advanceToAct(2)');
  const r = abgeben('klerus_priester', 'Die Liste abliefern');
  assert.ok(!r.fehler, r.fehler + ' ' + JSON.stringify(r.knoepfe || ''));
  assert.strictEqual(r.flags.namen_abgeliefert, true);
  assert.strictEqual(!!r.flags.namen_gewarnt, false);
  assert.ok(Array.from(r.fertig).indexOf('klerus_district_purge') >= 0);
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/Nur wenige der Verschwundenen/.test(ep), 'der Epilog kennt die Wahl nicht');
  assert.strictEqual(H.run(`window.HubPhase.epilogVorleser(window.questSystem.getFlags())`), 1);
});

test('Maras Namensliste: die Leute warnen', () => {
  stand({ klerus_district_purge: 'ready' });
  const r = abgeben('klerus_priester', 'Erst die Leute warnen');
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.flags.namen_gewarnt, true);
  assert.strictEqual(!!r.flags.namen_abgeliefert, false);
  assert.ok(Array.from(r.fertig).indexOf('klerus_district_purge') >= 0);
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/Viele der Verschwundenen kehren zurück. Wen Du/.test(ep), 'der Epilog kennt die Wahl nicht');
  assert.strictEqual(H.run(`window.HubPhase.epilogVorleser(window.questSystem.getFlags())`), 3);
});

/** Wie questLohnHub: was die Figur beim Ansprechen tun wuerde. */
function gespraech(npc) {
  return H.run(`(function () {
    var sc = ${HUB};
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt' };
    var orig = sc._showDialoguePages, fang = null;
    sc._showDialoguePages = function (d, t, pages, mode, q) {
      if (!fang) fang = { mode: mode, quest: q ? q.id : null, texte: pages.map(function (p) { return p.text; }) };
    };
    try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
    sc._dialogOpen = false;
    return fang || { mode: 'keiner' };
  })()`);
}
const zeichen = (npc) => H.run(`${HUB}._questZeichen('${npc}')`);

test('Die Quelle: Branka gibt sie, nach dem Sieg nimmt Thom sie ab', () => {
  H.run('window.storySystem.advanceToAct(4)');
  // Brankas fruehere Auftraege sind erledigt (sonst stuende der erste vorn).
  // Stufe 2: zwischen Maulwurf und Quelle liegt der Nachhall.
  const erledigt = { espionage_informant: 'completed', was_der_rauch_behaelt: 'completed' };
  Array.from(H.run(`Object.keys(window.questSystem.QUEST_DEFINITIONS).filter(function (id) {
    return window.questSystem.QUEST_DEFINITIONS[id].npcId === 'branka' && id !== 'schattenrat_finale'; })`))
    .forEach((id) => { erledigt[id] = 'completed'; });
  stand(erledigt);
  // Eine einmalige Seitenbemerkung (das Siegel aus dem Fall davor) darf vorgehen.
  let g = gespraech('branka');
  if (g.mode === 'flavor') g = gespraech('branka');
  assert.strictEqual(g.mode, 'offer', JSON.stringify(g));
  assert.strictEqual(g.quest, 'schattenrat_finale');
  assert.ok(/Harren hat gefragt/.test(g.texte.join(' ')), 'Branka erwaehnt Harren nicht');
  stand({ espionage_informant: 'completed', schattenrat_finale: 'active' });
  assert.strictEqual(zeichen('branka'), '…');
  assert.notStrictEqual(zeichen('thom'), '?', 'Thom will die laufende Quelle schon abnehmen');
  stand({ espionage_informant: 'completed', schattenrat_finale: 'ready' });
  assert.strictEqual(zeichen('thom'), '?', 'Thom zeigt kein "?"');
  assert.notStrictEqual(zeichen('branka'), '?', 'Branka will die Quelle abnehmen');
  const t = gespraech('thom');
  assert.strictEqual(t.mode, 'turnin');
  assert.strictEqual(t.quest, 'schattenrat_finale');
  assert.ok(/Thom wischt sich die Hände/.test(t.texte[0]), 'nicht Thoms Abschluss: ' + t.texte[0]);
});

function sichtbar(id) {
  return H.run(`(function () {
    var sc = ${HUB};
    sc._refreshNpcVisibility();
    var e = sc.npcs.filter(function (n) { return n.data && n.data.id === '${id}'; })[0];
    return !!(e && e.sprite && e.sprite.active && e.sprite.visible);
  })()`);
}

test('Elara steht nie im Hub, auch nicht mit der alten Flagge aus b457', () => {
  H.run('window.storySystem.advanceToAct(4)');
  stand({ espionage_informant: 'completed' }, { elaraReturnedToHub: true });
  assert.strictEqual(sichtbar('elara'), false, 'Elara steht nach dem Maulwurf im Hub');
});

test('Harren fehlt oben, sobald er Dir nach unten gefolgt ist', () => {
  H.run('window.storySystem.advanceToAct(4)');
  stand({ espionage_informant: 'completed', schattenrat_finale: 'active' }, {});
  assert.strictEqual(sichtbar('harren'), true, 'Harren fehlt schon vorher');
  stand({ espionage_informant: 'completed', schattenrat_finale: 'active' }, { harren_abstieg_1: true });
  assert.strictEqual(sichtbar('harren'), false, 'Harren steht nach seinem Abstieg noch oben');
  stand({ espionage_informant: 'completed', schattenrat_finale: 'ready' }, { harren_dead: true });
  assert.strictEqual(sichtbar('harren'), false, 'der tote Harren steht oben');
});
