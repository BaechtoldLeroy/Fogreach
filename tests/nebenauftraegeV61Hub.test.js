// tests/nebenauftraegeV61Hub.test.js — die sieben Nebenauftraege der Akte 3/4
// (Story-Kern v6.1), der Teil oben in der Stadt.
//
//   * Angebot: zur richtigen Tiefe (angebotAb), zum richtigen Akt, nach der
//     Voraussetzung, und nur, solange das Tor offen ist.
//   * Entfallen: der Klerus-Auftrag mit dem Bruch (wie Aldrics), Elaras
//     Uebung mit dem Maulwurf. Beide ueber den echten Abschluss ausgeloest.
//   * Thoms Gegen-Edikt ueber die echte Presse (riskante Stufe zaehlt, milde nicht).
//   * Die drei Wahlen beim Abgeben im echten Gespraech (storyDialog +
//     DialogChoice), danach die Zeilen im Epilog, deutsch und englisch.
//   * Brankas Schmiedestueck kommt als seltenes Stueck an.
//   * Kreidesaetze im Nachhall, die Drehung im Finale.
//
// Der Kellerteil (Beschwoerer, Helmmarke, Kreidezeichen, Schloesser, Jagd,
// Verteidigung) steht in nebenauftraegeV61Keller.test.js.

const { test, before, after, afterEach } = require('node:test');
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
afterEach(() => { H.run(`window.i18n.setLanguage('de')`); });

/**
 * Stand setzen: Akt (STORY_ACTS-Index), Auftraege { id: 'completed'|'ready'|'active' }
 * (alle anderen bleiben offen), Flaggen, erreichte Tiefe.
 */
function stand(akt, eintraege, flags, tiefe) {
  H.run(`(function () {
    window.storySystem.loadStorySaveData({ currentActIndex: ${akt},
      eventsSeen: ['auftrag', 'treuer_diener', 'erste_risse', 'wahrheit', 'bruch'] });
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '${tiefe || 30}');
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

const angebote = (npc) => Array.from(H.run(`window.questSystem.getAvailableQuests('${npc}').map(function (q) { return q.id; })`));
const status = (id) => H.run(`(window.questSystem.getQuestSaveData().quests['${id}'] || {}).status || 'available'`);
const flags = () => H.run('window.questSystem.getFlags()');
const epilog = (lang) => H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), '${lang}').join(' ')`);

/** Angebot genau dann, wenn alles stimmt: einmal ja, dann je Bedingung nein. */
function angebotsFall(npc, id, gut, schlecht) {
  stand(gut.akt, gut.quests, gut.flags, gut.tiefe);
  assert.ok(angebote(npc).includes(id), id + ': im guten Stand nicht angeboten');
  Object.keys(schlecht).forEach((grund) => {
    const s = Object.assign({}, gut, schlecht[grund]);
    stand(s.akt, s.quests, s.flags, s.tiefe);
    assert.ok(!angebote(npc).includes(id), id + ': angeboten trotz ' + grund);
  });
}

// --- Angebote ---------------------------------------------------------------

test('Die schweigenden Brueder: Akt 3, ab Tiefe 15, nach der Reinigung, nicht nach dem Bruch', () => {
  angebotsFall('klerus_priester', 'klerus_brueder',
    { akt: 3, quests: { klerus_district_purge: 'completed' }, flags: {}, tiefe: 15 },
    { 'Tiefe 14': { tiefe: 14 }, 'Akt 2': { akt: 2 }, 'ohne Reinigung': { quests: {} },
      'Bruch': { flags: { enttarnt: true } } });
});

test('Ein Edikt, das keiner bestellt hat: Akt 3, ab Tiefe 16, nach den Druckplatten', () => {
  angebotsFall('thom', 'thom_gegenedikt',
    { akt: 3, quests: { thom_truth: 'completed' }, flags: {}, tiefe: 16 },
    { 'Tiefe 15': { tiefe: 15 }, 'Akt 2': { akt: 2 }, 'ohne Druckplatten': { quests: {} } });
  assert.strictEqual(H.run(`window.questSystem.QUEST_DEFINITIONS.thom_gegenedikt.minDepth`), undefined,
    'das Ziel liegt in der Druckerei, eine Mindesttiefe fuer den Fortschritt waere falsch');
});

test('Kreide an der Zellenwand: Akt 3, ab Tiefe 18, nach dem Kettenmeister, nicht nach dem Maulwurf', () => {
  angebotsFall('mara', 'mara_kreide',
    { akt: 3, quests: { mara_warning: 'completed' }, flags: {}, tiefe: 18 },
    // Kein Fall "Akt 2": der Kettenmeister selbst oeffnet Akt 3 (advanceAct),
    // ein Stand mit ihm und Akt 2 wird beim Laden nachgezogen.
    { 'Tiefe 17': { tiefe: 17 }, 'ohne Kettenmeister': { quests: {} },
      'Maulwurf': { flags: { mole_evidence: true } } });
});

test('Die Hand am Schloss: Akt 3, ab Tiefe 21, nach der Ritualkammer, nicht nach dem Maulwurf', () => {
  angebotsFall('elara', 'elara_schloesser',
    { akt: 3, quests: { elara_ritual: 'completed' }, flags: {}, tiefe: 21 },
    { 'Tiefe 20': { tiefe: 20 }, 'Akt 2': { akt: 2 }, 'ohne Ritualkammer': { quests: {} },
      'Maulwurf': { flags: { mole_evidence: true } } });
});

test('Ein Name auf dem Helm: erst nach dem Bruch, ab Tiefe 24', () => {
  angebotsFall('stadtwache', 'wache_helm',
    { akt: 3, quests: {}, flags: { enttarnt: true }, tiefe: 24 },
    { 'Tiefe 23': { tiefe: 23 }, 'vor dem Bruch': { flags: {} }, 'Akt 2': { akt: 2 } });
});

test('Die letzte Fuhre: Akt 4, ab Tiefe 28, nach dem Nachhall', () => {
  angebotsFall('mara', 'mara_letzte_fuhre',
    { akt: 4, quests: { was_der_rauch_behaelt: 'completed' }, flags: {}, tiefe: 28 },
    { 'Tiefe 27': { tiefe: 27 }, 'Akt 3': { akt: 3 }, 'ohne Nachhall': { quests: {} } });
});

test('Die Schmiede halten: nach dem Bruch, ab Tiefe 27', () => {
  angebotsFall('branka', 'branka_schmiede_halten',
    { akt: 3, quests: { bruch_confrontation: 'completed' }, flags: {}, tiefe: 27 },
    { 'Tiefe 26': { tiefe: 26 }, 'ohne Bruch': { quests: {} }, 'Akt 2': { akt: 2 } });
});

// --- Entfallen ------------------------------------------------------------------

test('Der Bruch beendet den Klerus-Auftrag wie Aldrics (echter Abschluss des Bruchs)', () => {
  stand(3, { klerus_district_purge: 'completed', klerus_brueder: 'active', bruch_confrontation: 'ready',
    verseuchte_kammer: 'completed', elara_second_truth: 'completed', thom_gegenedikt: 'active' }, {}, 20);
  assert.strictEqual(status('klerus_brueder'), 'active');
  assert.strictEqual(H.run(`window.questSystem.completeQuest('bruch_confrontation')`), true);
  assert.strictEqual(flags().enttarnt, true);
  assert.strictEqual(status('klerus_brueder'), 'entfallen', 'der Klerus vergibt nach dem Bruch weiter');
  const ent = Array.from(H.run(`window.questSystem.getEntfalleneQuests().map(function (q) { return q.id; })`));
  assert.ok(ent.includes('klerus_brueder'), 'nicht im Journal unter den entfallenen');
  assert.strictEqual(status('thom_gegenedikt'), 'active', 'Thom gehoert nicht zum Rat');
});

test('Der Maulwurf beendet Elaras Uebung; Maras Kreide laeuft weiter (echter Abschluss des Maulwurfs)', () => {
  stand(3, { espionage_archive: 'completed', bruch_confrontation: 'completed', espionage_informant: 'ready',
    elara_ritual: 'completed', elara_schloesser: 'active', mara_warning: 'completed', mara_kreide: 'active' }, {}, 23);
  assert.strictEqual(H.run(`window.questSystem.completeQuest('espionage_informant')`), true);
  assert.strictEqual(flags().mole_evidence, true);
  assert.strictEqual(status('elara_schloesser'), 'entfallen', 'Elara vergibt nach dem Maulwurf weiter');
  assert.strictEqual(status('mara_kreide'), 'active', 'Maras Auftrag haengt nur im Angebot am Maulwurf');
});

test('Auch die Flagge allein (setFlag mole_evidence) beendet Elaras Uebung', () => {
  stand(3, { elara_ritual: 'completed', elara_schloesser: 'active' }, {}, 23);
  H.run(`window.questSystem.setFlag('mole_evidence')`);
  assert.strictEqual(status('elara_schloesser'), 'entfallen');
});

test('Nie angenommen: der Klerus-Auftrag verschwindet mit dem Bruch auch aus dem Angebot', () => {
  stand(3, { klerus_district_purge: 'completed' }, {}, 20);
  assert.ok(angebote('klerus_priester').includes('klerus_brueder'));
  H.run(`window.questSystem.setFlag('enttarnt')`);
  assert.ok(!angebote('klerus_priester').includes('klerus_brueder'));
  assert.strictEqual(status('klerus_brueder'), 'entfallen');
});

// --- Thoms Gegen-Edikt (echte Presse) -------------------------------------------

test('Thom: nur ein riskantes Edikt an der Presse zaehlt', () => {
  stand(3, { thom_truth: 'completed', thom_gegenedikt: 'active' }, {}, 16);
  const r = H.run(`(function () {
    var P = window.PrintingHouse, qs = window.questSystem;
    var ziel = function () { return qs.getActiveQuests().filter(function (q) { return q.id === 'thom_gegenedikt'; })[0].objectives[0].current; };
    P.clearActivePublication(); P.addDruckblaetter(20);
    var mild = P.publishEdict('tip_to_guards');
    var nachMild = ziel();
    P.clearActivePublication();
    var riskant = P.publishEdict('open_rebellion');
    var nachRiskant = ziel();
    P.clearActivePublication();
    return { mild: mild.success, nachMild: nachMild, riskant: riskant.success, nachRiskant: nachRiskant,
      bereit: qs.isQuestReadyToComplete('thom_gegenedikt') };
  })()`);
  assert.ok(r.mild && r.riskant, 'Drucken scheiterte: ' + JSON.stringify(r));
  assert.strictEqual(r.nachMild, 0, 'ein mildes Edikt zaehlt mit');
  assert.strictEqual(r.nachRiskant, 1, 'das riskante Edikt zaehlt nicht');
  assert.strictEqual(r.bereit, true);
});

// --- Wahlen beim Abgeben (echtes Gespraech) -----------------------------------------

/** Wie in storyV61Hub.test.js: Abgabe, Entscheidungsseite, Knopf, Lohnseite. */
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

function wahlFall(o) {
  stand(o.akt, o.quests, o.flags || {}, o.tiefe);
  const r = abgeben(o.npc, o.wahl);
  assert.ok(!r.fehler, r.fehler + ' ' + JSON.stringify(r.knoepfe || r.texte || ''));
  assert.ok(Array.from(r.fertig).includes(o.id), o.id + ' nicht abgeschlossen');
  assert.strictEqual(r.flags[o.flag], true, 'Flagge ' + o.flag + ' fehlt');
  assert.strictEqual(!!r.flags[o.nicht], false, 'beide Flaggen gesetzt');
  return r;
}

test('Brueder: alle Ringe abgeben, kein Ring im Epilog', () => {
  const r = wahlFall({ npc: 'klerus_priester', id: 'klerus_brueder', wahl: 'Alle Ringe abgeben', akt: 3, tiefe: 15,
    quests: { klerus_district_purge: 'completed', klerus_brueder: 'ready' },
    flag: 'klerus_ringe_abgeliefert', nicht: 'klerus_ring_thom' });
  assert.ok(/Die Glut wird schwach. Wer erneuert sie\?/.test(r.texte.join(' ')), 'der Zettel fehlt im Abschluss');
  assert.ok(!/Hochpriesters gedruckt/.test(epilog('de')), 'Ring im Epilog, obwohl abgegeben');
});

test('Brueder: den Ring Thom zustecken, der Epilog druckt ihn unter Aldrics Namen', () => {
  wahlFall({ npc: 'klerus_priester', id: 'klerus_brueder', wahl: 'Den schweren Ring Thom zustecken', akt: 3, tiefe: 15,
    quests: { klerus_district_purge: 'completed', klerus_brueder: 'ready' },
    flag: 'klerus_ring_thom', nicht: 'klerus_ringe_abgeliefert' });
  assert.ok(/Unter Aldrics Namen steht auch der Ring des Hochpriesters gedruckt/.test(epilog('de')), epilog('de'));
  assert.ok(/High Priest's ring is printed too/.test(epilog('en')), epilog('en'));
});

test('Helm: die Wahrheit, im Epilog steht er vor Thoms Tuer und geht', () => {
  wahlFall({ npc: 'stadtwache', id: 'wache_helm', wahl: 'Die Wahrheit sagen', akt: 3, tiefe: 24,
    quests: { wache_helm: 'ready' }, flags: { enttarnt: true },
    flag: 'wachtmeister_wahrheit', nicht: 'wachtmeister_trost' });
  assert.ok(/vor Thoms Tür, allein/.test(epilog('de')) && /Dann geht er wieder/.test(epilog('de')), epilog('de'));
  assert.ok(/stands at Thom's door, alone/.test(epilog('en')), epilog('en'));
});

test('Helm: der Trost, im Epilog bleibt er der Garde treu', () => {
  wahlFall({ npc: 'stadtwache', id: 'wache_helm', wahl: '"Er ist im Dienst gefallen."', akt: 3, tiefe: 24,
    quests: { wache_helm: 'ready' }, flags: { enttarnt: true },
    flag: 'wachtmeister_trost', nicht: 'wachtmeister_wahrheit' });
  assert.ok(/bleibt der Garde treu/.test(epilog('de')), epilog('de'));
  assert.ok(/stays loyal to the Guard/.test(epilog('en')), epilog('en'));
  assert.ok(!/vor Thoms Tür, allein/.test(epilog('de')));
});

test('Fuhre: unten zerschlagen, die Heimkehrer kommen mit Luecken', () => {
  wahlFall({ npc: 'mara', id: 'mara_letzte_fuhre', wahl: 'Unten zerschlagen', akt: 4, tiefe: 28,
    quests: { was_der_rauch_behaelt: 'completed', mara_letzte_fuhre: 'ready' },
    flag: 'phiolen_zerschlagen', nicht: 'phiolen_gebunden' });
  const de = epilog('de');
  assert.ok(/der Verschwundenen/.test(de) && /letzten Fuhre heimkehrt, kommt mit Lücken/.test(de), de);
  assert.ok(/comes home with gaps/.test(epilog('en')));
});

test('Fuhre: zu Branka, die Heimkehrer kommen ganz zurueck', () => {
  wahlFall({ npc: 'mara', id: 'mara_letzte_fuhre', wahl: 'Zu Branka bringen', akt: 4, tiefe: 28,
    quests: { was_der_rauch_behaelt: 'completed', mara_letzte_fuhre: 'ready' },
    flag: 'phiolen_gebunden', nicht: 'phiolen_zerschlagen' });
  assert.ok(/kehrt ganz zurück/.test(epilog('de')), epilog('de'));
  assert.ok(/comes home whole/.test(epilog('en')));
});

test('Die Wahlen stehen auf Englisch, wenn das Spiel englisch spricht', () => {
  H.run(`window.i18n.setLanguage('en')`);
  const r = H.run(`(function () { var b = window.storyDialog.byQuest; return [
    b.klerus_brueder.choices[1].label, b.wache_helm.choices[0].label, b.mara_letzte_fuhre.choices[1].label,
    window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS.elara_schloesser)]; })()`);
  assert.deepStrictEqual(Array.from(r), ['Slip the heavy ring to Thom', 'Tell the truth', 'Take them to Branka', 'The Hand on the Lock']);
});

// --- Lohn, Nachhall, Finale -----------------------------------------------------

test('Branka: das Schmiedestueck kommt als seltenes Stueck mit ihrem Namen an', () => {
  stand(3, { bruch_confrontation: 'completed', branka_schmiede_halten: 'ready' }, {}, 27);
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var ok = qs.completeQuest('branka_schmiede_halten');
    return { ok: ok, lohn: qs.getErhaltenerLohn('branka_schmiede_halten') };
  })()`);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.lohn.items.length, 1, 'kein Stueck: ' + JSON.stringify(r.lohn));
  assert.strictEqual(r.lohn.items[0].tier, 2, 'nicht selten');
  assert.strictEqual(r.lohn.items[0].name, 'Brankas Schmiedestück');
});

test('Nachhall: nach der Kreide fluestert er die Kreidesaetze, mit Oda Kessler, wenn gewarnt', () => {
  const r = H.run(`(function () {
    var N = window.Nachhall;
    var ohne = N.fluesterPool({ lang: 'de', erledigt: [] });
    var mit = N.fluesterPool({ lang: 'de', flags: { namen_gewarnt: true }, erledigt: [{ id: 'mara_kreide' }] });
    var en = N.fluesterPool({ lang: 'en', erledigt: [{ id: 'mara_kreide' }] });
    var k = function (p) { return p.filter(function (x) { return x.quelle === 'kreide'; }).map(function (x) { return x.text; }); };
    return { ohne: k(ohne), mit: k(mit), en: k(en) };
  })()`);
  assert.strictEqual(r.ohne.length, 0, 'Kreide ohne gelesene Zeichen');
  assert.ok(r.mit.includes('Der Treffpunkt war verraten. Nur sieben wussten ihn.'), JSON.stringify(r.mit));
  assert.ok(r.mit.some((s) => /Oda Kessler/.test(s)), 'Oda Kessler fehlt: ' + JSON.stringify(r.mit));
  assert.ok(r.en.includes('The meeting place was betrayed. Only seven knew it.'));
});

test('Finale: wer die Schloesser geuebt hat, dessen Haende kennen die Drehung (de/en)', () => {
  const seite = (flag, lang) => H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.flags = ${flag ? "{ drehung_geuebt: true }" : '{}'}; qs.loadQuestSaveData(st);
    window.i18n.setLanguage('${lang}');
    return window.Finale.vorKampfSeiten()[1];
  })()`);
  assert.ok(/Deine Hände kennen die Drehung. Sie hat sie Dir beigebracht, Schloss für Schloss./.test(seite(true, 'de')));
  assert.ok(/Your hands know the turn/.test(seite(true, 'en')));
  assert.ok(!/Drehung/.test(seite(false, 'de')), 'die Zeile kommt auch ohne die Uebung');
  // Der Abschluss setzt die Flagge.
  stand(3, { elara_ritual: 'completed', elara_schloesser: 'ready' }, {}, 21);
  H.run(`window.questSystem.completeQuest('elara_schloesser')`);
  assert.strictEqual(flags().drehung_geuebt, true);
});
