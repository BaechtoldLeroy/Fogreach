// tests/journalFolgen.test.js — Das Journal erklaert die Auftraege, und
// folgenreiche Wahlen kuendigen sich an.
//
// Vorher stand im Journal je Auftrag nur "Titel (1/3)" fuer das erste offene
// Ziel. Wer vergeben hatte, wo abzugeben war, ab welcher Tiefe es zaehlt und
// wie es ohne Story-Auftrag weitergeht, musste man sich merken. Ebenso, was
// man unterwegs entschieden hatte. Und vor dem Bruch und dem Maulwurf sagte
// nichts, dass danach Auftraege liegen bleiben.
//
// Geprueft am laufenden Hub: Journal-Daten und Overlay-Texte, die getoenten
// Knoepfe der Auswahl, die Warnung im Angebot und dass sie genau das nennt,
// was beim Abschluss wirklich entfaellt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const hub = "window.game.scene.getScene('HubSceneV2')";
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
  H.step(5);
});
after(async () => {
  if (H) {
    try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {}
    await H.shutdown();
  }
});

/**
 * Spielstand: ALLE Auftraege erledigt, ausser den genannten
 * ('available' | 'active' | 'ready' | [stand je Ziel]).
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
      if (Array.isArray(v)) {
        st.quests[id] = { status: 'active', objectives: d.objectives.map(function (o, i) {
          return { type: o.type, target: o.target, current: v[i], required: o.required }; }) };
        return;
      }
      st.quests[id] = { status: v === 'ready' ? 'active' : v, objectives: v === 'available' ? null : d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: (v === 'completed' || v === 'ready') ? o.required : 0, required: o.required }; }) };
    });
    qs.loadQuestSaveData(st);
    return true;
  })()`);
}

/** Alle Texte des Journal-Overlays; danach wieder zu. */
function journalTexte() {
  return Array.from(H.run(`(function () {
    var sc = ${hub};
    window.storySystem.showJournalOverlay(sc, function () {});
    var c = sc.children.list.filter(function (o) { return o.type === 'Container' && o.depth === 6001; }).pop();
    var t = []; (function s(o) { if (!o) return; if (o.type === 'Text') t.push(String(o.text)); (o.list || []).forEach(s); })(c);
    sc.children.list.filter(function (o) { return o.depth >= 6000 && o.depth < 6100; }).forEach(function (o) { o.destroy(); });
    if (window.resumeGameClock) window.resumeGameClock();
    return t;
  })()`));
}

const aktive = () => H.run(`(function () {
  var j = window.storySystem.getJournalData();
  var aus = {};
  j.activeQuests.forEach(function (q) { aus[q.title] = { ziele: q.ziele.map(function (z) { return (z.fertig ? '+' : '-') + z.text; }), herkunft: q.herkunft }; });
  return JSON.stringify({ aktiv: aus, naechster: j.naechsterSchritt, wahl: j.entscheidungen });
})()`);
const journal = () => JSON.parse(aktive());

test('Journal: jedes Ziel eine Zeile mit Zaehler und Tiefe, dazu Geber und Abgabe', () => {
  stand(3, { mara_kreide: [1], garde_night_escort: [1, 0, 0], resistance_fetch_01: 'active',
    espionage_informant: 'available', the_reckoning: 'available' });
  const j = journal();
  const kreide = j.aktiv['Kreide an der Zellenwand'];
  assert.deepStrictEqual(kreide.ziele, ['-Kreidezeichen gelesen 1/3 · ab Tiefe 18']);
  assert.strictEqual(kreide.herkunft, 'Auftrag von Späherin Mara · Abgabe: Späherin Mara');
  const eskorte = j.aktiv[H.run(`window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS.garde_night_escort)`)];
  assert.deepStrictEqual(eskorte.ziele, ['+An der Verladung 1/1 · ab Tiefe 16', '-An der Waage 0/1 · ab Tiefe 16', '-Am Schacht 0/1 · ab Tiefe 16']);
  assert.strictEqual(eskorte.herkunft, 'Auftrag von Hauptmann der Stadtwache · Abgabe: Hauptmann der Stadtwache');
  const buendel = j.aktiv['Das versiegelte Bündel'];
  assert.deepStrictEqual(buendel.ziele, ['-Versiegeltes Bündel gefunden 0/1']);
  assert.strictEqual(buendel.herkunft, 'Auftrag von Elara · Abgabe: Sie findet Dich im Keller');
  // Ein Story-Auftrag laeuft nicht, aber der Maulwurf steht bei Mara bereit.
  const texte = journalTexte().join(' | ');
  assert.ok(texte.includes('· Kreidezeichen gelesen 1/3 · ab Tiefe 18'), 'Zielzeile fehlt im Overlay: ' + texte.slice(0, 500));
  assert.ok(texte.includes('✓ An der Verladung 1/1'), 'erledigtes Ziel nicht abgehakt');
  assert.ok(texte.includes('Abgabe: Sie findet Dich im Keller'), 'Elaras Abgabe fehlt im Overlay');
  // Englisch
  H.run(`window.i18n.setLanguage('en')`);
  const en = journal();
  H.run(`window.i18n.setLanguage('de')`);
  const kreideEn = en.aktiv['Chalk on the Cell Wall'];
  assert.deepStrictEqual(kreideEn.ziele, ['-Chalk marks read 1/3 · from depth 18']);
  assert.strictEqual(kreideEn.herkunft, 'Task from Mara the Scout · Turn in: Mara the Scout');
});

test('Naechster Schritt: wer anbietet, worauf es wartet, oder die Tiefe', () => {
  // Mara bietet den Sturm an.
  stand(4, { mara_assault: 'available' });
  assert.strictEqual(journal().naechster, 'Bei Späherin Mara wartet ein neuer Auftrag.');
  assert.ok(journalTexte().includes('Nächster Schritt:'), 'Kopfzeile fehlt im Overlay');
  // Das Ratsdokument wartet auf Elaras Buendel, das gerade laeuft.
  stand(1, { widerstand_proof: 'available', resistance_fetch_01: 'active' }, { elaraMet: true });
  assert.strictEqual(journal().naechster, 'Erst muss erledigt sein: Das versiegelte Bündel.');
  // Die Pamphlete kommen erst ab Tiefe 27.
  stand(4, { thom_pamphlets: 'available' });
  assert.strictEqual(journal().naechster,
    'Steig an die Grenze hinab und schliess den Lauf ab. Neue Aufträge folgen mit der Tiefe. Der nächste wartet ab Tiefe 27.');
  // Laeuft ein Story-Auftrag, braucht es keinen Hinweis; ist alles erzaehlt, auch nicht.
  stand(4, { thom_pamphlets: 'active' });
  assert.strictEqual(journal().naechster, '');
  assert.ok(!journalTexte().includes('Nächster Schritt:'), 'Hinweis trotz laufendem Story-Auftrag');
  stand(4, {});
  assert.strictEqual(journal().naechster, '');
});

test('Was Du entschieden hast: genau die getroffenen Wahlen, in der Reihenfolge der Geschichte', () => {
  stand(3, { espionage_informant: 'available', the_reckoning: 'available' }, {
    wachtmeister_trost: true, verification_refused: true, convoy_blade_drawn: true, petitions_kept: true,
    elara_trust: true, enttarnt: true, patrouillen_verdoppelt: true
  });
  assert.deepStrictEqual(journal().wahl, [
    'Du hast das Siegel unbemerkt beschädigt.',
    'Du hast die Gesuche heimlich behalten.',
    'Am Konvoi hast Du die Klinge gezogen.',
    'Du hast dem Hauptmann gesagt, sein Sohn sei im Dienst gefallen.'
  ]);
  const t = journalTexte();
  assert.ok(t.includes('Was Du entschieden hast:'), 'Abschnitt fehlt');
  assert.ok(t.includes('• Du hast die Gesuche heimlich behalten.'));
  H.run(`window.i18n.setLanguage('en')`);
  assert.strictEqual(journal().wahl[0], 'You damaged the seal unnoticed.');
  H.run(`window.i18n.setLanguage('de')`);
  // Ohne Wahl kein Abschnitt.
  stand(3, { espionage_informant: 'available', the_reckoning: 'available' }, { elara_trust: true });
  assert.deepStrictEqual(journal().wahl, []);
  assert.ok(!journalTexte().includes('Was Du entschieden hast:'), 'leerer Abschnitt steht da');
});

/** Knoepfe und Hinweis einer DialogChoice-Auswahl. */
function auswahl(gruppe, id) {
  return H.run(`(function () {
    var sc = ${hub};
    var cfg = window.storyDialog.${gruppe}.${id};
    var h = window.DialogChoice.present(sc, { prompt: cfg.prompt, choices: cfg.choices, onResolved: function () {} });
    var c = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; }).pop();
    var toene = [], merken = false;
    (function s(o) { if (!o) return;
      if (o.name === 'dialogChoiceKnopf') toene.push(o.__ton || null);
      if (o.name === 'dialogChoiceMerken') merken = String(o.text);
      (o.list || []).forEach(s); })(c);
    h.destroy();
    return { toene: toene, merken: merken, folge: window.DialogChoice.TON_FOLGE };
  })()`);
}

test('Folgenreiche Wahlen: getoente Knoepfe und "(Das wird man sich merken.)"', () => {
  stand(3, {});
  ['magistrat_verification', 'council_seizure', 'klerus_district_purge', 'klerus_brueder', 'wache_helm', 'mara_letzte_fuhre']
    .forEach((id) => {
      const r = auswahl('byQuest', id);
      assert.strictEqual(r.toene.length, 2, id + ': Knoepfe fehlen');
      assert.ok(Array.from(r.toene).every((t) => t === r.folge), id + ': nicht getoent: ' + JSON.stringify(r.toene));
      assert.strictEqual(r.merken, '(Das wird man sich merken.)', id + ': Hinweis fehlt');
    });
  // Gespraechsfarbe bleibt schlicht.
  const farbe = auswahl('byQuest', 'hub_intro_a0');
  assert.ok(Array.from(farbe.toene).every((t) => t === null), 'Gespraechsfarbe getoent');
  assert.strictEqual(farbe.merken, false);
  // Der Konvoi (finale.js) traegt denselben Hinweis.
  const k = H.run(`(function () {
    var sc = ${hub};
    if (!window.Finale.konvoi(sc)) return 'nicht geoeffnet';
    var z = sc.__konvoiDialog, m = null;
    (function s(o) { if (!o) return; if (o.name === 'konvoiMerken') m = String(o.text); (o.list || []).forEach(s); })(z.box);
    z.zu();
    return m;
  })()`);
  assert.strictEqual(k, '(Das wird man sich merken.)');
});

const angebot = (id) => H.run(`window.questSystem.QUEST_DEFINITIONS.${id}.dialogueOffer`);
const status = (id) => H.run(`(window.questSystem.getQuestSaveData().quests['${id}'] || {}).status`);

test('Bruch: das Angebot nennt, was beim Rat liegen bleibt, und genau das entfaellt', () => {
  stand(3, { bruch_confrontation: 'ready', espionage_informant: 'available', the_reckoning: 'available',
    klerus_brueder: 'active', einfuehrung_talente: 'available' });
  const text = angebot('bruch_confrontation');
  assert.ok(text.endsWith('\n\n(Wenn Du das tust, ist das Rathaus zu. Was Du dem Rat noch schuldest, bleibt liegen: „Wofür du taugst“ und „Die schweigenden Brüder“.)'),
    'Warnung fehlt oder falsch: ' + text.slice(-220));
  assert.ok(text.startsWith('Aldric weiss es.'), 'Angebotstext verloren');
  H.run(`window.questSystem.completeQuest('bruch_confrontation')`);
  assert.strictEqual(status('klerus_brueder'), 'entfallen');
  assert.strictEqual(status('einfuehrung_talente'), 'entfallen');
  // Danach (oder ohne Offenes) keine falsche Liste.
  assert.ok(!angebot('bruch_confrontation').includes('Rathaus zu'), 'Warnung nach dem Bruch');
  stand(3, { bruch_confrontation: 'available', espionage_informant: 'available', the_reckoning: 'available' });
  assert.ok(angebot('bruch_confrontation').endsWith('(Wenn Du das tust, ist das Rathaus zu. Der Rat gibt Dir danach keine Aufträge mehr.)'));
  H.run(`window.i18n.setLanguage('en')`);
  const en = angebot('bruch_confrontation');
  H.run(`window.i18n.setLanguage('de')`);
  assert.ok(en.endsWith('(If you do this, the town hall is closed to you. The council gives you no more assignments after that.)'), en.slice(-160));
});

test('Maulwurf: das Angebot nennt Elaras Schloesser und die Kreide, solange sie offen sind', () => {
  stand(3, { espionage_informant: 'available', the_reckoning: 'available',
    elara_schloesser: 'active', mara_kreide: 'available' });
  const text = angebot('espionage_informant');
  assert.ok(text.endsWith('\n\n(Findest Du den Verräter, bleibt danach liegen: „Kreide an der Zellenwand“ und „Die Hand am Schloss“. Was Du dort noch tun willst, tu vorher.)'),
    'Warnung fehlt oder falsch: ' + text.slice(-200));
  // Mit dem Maulwurf: die Schloesser entfallen, die Kreide wird nicht mehr angeboten.
  H.run(`window.questSystem.setFlag('mole_evidence')`);
  assert.strictEqual(status('elara_schloesser'), 'entfallen');
  assert.strictEqual(H.run(`window.questSystem.getAvailableQuests('mara').some(function (q) { return q.id === 'mara_kreide'; })`), false);
  // Ist beides erledigt, steht keine Warnung da.
  stand(3, { espionage_informant: 'available', the_reckoning: 'available' });
  assert.ok(!angebot('espionage_informant').includes('Verräter, bleibt'), 'Warnung ohne Offenes');
});
