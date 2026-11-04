// tests/questErklaerungHub.test.js — Was der Hub ueber Auftraege und Tiefe sagt.
//
// Am echten Hub (headless, Canvas):
//  - Angebot: Titel, darunter Geber und Art ("Auftrag von … · Story"), nie
//    mehr "Aufgabe 6/3" (die Kettennummer lief laengst ueber 3 hinaus).
//  - Hinabstieg: an JEDEM Boss-Tor (9, 19, 24, 29) der Auftrag, der es
//    oeffnet, und wo es ihn gibt; je Tiefe die Auftraege, die dort nicht
//    zaehlen.
//  - Laufuebersicht: neue Grenze oder warum sie bleibt.
//  - Gespraech ohne Auftrag: "Komm wieder, wenn …", Aldric bei Verdacht,
//    Harren vor der geheimen Sitzung.
//  - Einmal die Legende der Zeichen ueber den Koepfen.
// Die reinen Regeln stehen in tests/questErklaerung.test.js.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const HUB = `window.game.scene.getScene('HubSceneV2')`;
function run(js) {
  // H.run liefert Werte aus einem anderen Realm: als JSON herueberholen.
  const s = JSON.stringify(H.run(js));
  return s === undefined ? undefined : JSON.parse(s);
}

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(30);
  run(`(function () {
    var sc = ${HUB};
    sc.input.keyboard.emit('keydown-ESC', {});
    // Jede Dialogseite festhalten statt zeichnen.
    window.__dlg = [];
    sc._showDialoguePages = function (npc, titel, seiten, modus) {
      window.__dlg.push({ npc: npc && npc.id, modus: modus,
        seiten: seiten.map(function (p) { return { text: p.text, wahl: !!(p.choices && p.choices.length), info: !!p._isInfoPage }; }) });
      this._dialogOpen = false;
    };
    // Toasts mitschreiben (und weiter zeigen).
    window.__toasts = [];
    var echt = window.EventSystem.showToast;
    window.EventSystem.showToast = function (s, msg) { window.__toasts.push(msg); return echt.apply(this, arguments); };
  })()`);
});
after(async () => {
  if (H) {
    try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {}
    await H.shutdown();
  }
});

/** Questzustand, Akt, Flags und erreichte Tiefe setzen. 'bereit' = aktiv und erfuellt. */
function stand(quests, akt, tiefe, flags) {
  run(`(function () {
    var sc = ${HUB};
    try { sc._closeDialog(null); } catch (e) {}
    sc._dialogOpen = false;
    var qs = window.questSystem, st = qs.getQuestSaveData(), q = ${JSON.stringify(quests)};
    st.quests = {};
    Object.keys(q).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id], voll = q[id] === 'bereit';
      st.quests[id] = { status: voll ? 'active' : q[id], objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: voll || q[id] === 'completed' ? o.required : 0, required: o.required }; }) };
    });
    st.flags = Object.assign({ hub_intro_a0_seen: true, zeichen_legende_gesehen: true }, ${JSON.stringify(flags || {})});
    qs.loadQuestSaveData(st);
    var ss = window.storySystem;
    ss.resetToAct0();
    ss.advanceToAct(${akt || 0});
    while (ss.consumePendingEvent()) {}
    (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '${tiefe || 1}');
    window.__dlg = [];
    window.__toasts = [];
  })()`);
  H.step(3);
}

const NPC = (id) => `(${HUB}.npcs.filter(function (x) { return x.data.id === '${id}'; })[0] || { data: { id: '${id}', name: '${id}' } }).data`;

/** Mit der Figur sprechen; Rueckgabe: die Seitentexte. */
function sprechen(id) {
  return run(`(function () { window.__dlg = []; var sc = ${HUB}; sc._dialogOpen = false;
    sc._showNpcDialogue(${NPC(id)});
    var d = window.__dlg[window.__dlg.length - 1]; return d ? d : null; })()`);
}

// ---- A) Angebot ---------------------------------------------------------------

test('Angebot: Titel, darunter Geber und Art — fuer jeden Auftrag, nie "x/3"', () => {
  stand({}, 0, 1);
  const r = run(`(function () {
    var sc = ${HUB}, D = window.questSystem.QUEST_DEFINITIONS, aus = [];
    Object.keys(D).forEach(function (id) {
      if (id === 'the_reckoning') return;   // das Finale spielt eine eigene Szene
      var q = D[id];
      sc._gespraechsLage = function () { return { questMode: 'offer', questData: q }; };
      window.__dlg = [];
      sc._dialogOpen = false;
      sc._showNpcDialogue({ id: q.npcId, name: 'NAME' });
      delete sc._gespraechsLage;
      var d = window.__dlg[0];
      var wahl = d && d.seiten.filter(function (p) { return p.wahl && !p.info; }).pop();
      var info = d && d.seiten.filter(function (p) { return p.info; })[0];
      aus.push({ id: id, chain: q.chain, kopf: wahl ? wahl.text.split('\\n').slice(0, 2) : null, info: info ? info.text : '' });
    });
    return aus; })()`);
  assert.ok(r.length > 50, 'zu wenige Auftraege: ' + r.length);
  assert.ok(r.some((x) => x.chain > 3), 'kein Auftrag mit Kettennummer ueber 3 — der Test prueft nichts');
  const art = { aushang: 'Aushang an der Anschlagtafel' };
  for (const x of r) {
    assert.ok(x.kopf, x.id + ': keine Angebotsseite');
    assert.ok(!/\d+\s*\/\s*3|Questkette/.test(x.kopf.join(' ') + x.info), x.id + ': Kettennummer im Angebot: ' + x.kopf.join(' | '));
    const erwartet = run(`(function () { var a = window.questSystem.getAuftragsArt('${x.id}');
      return a === 'aushang' ? '${art.aushang}' : 'Auftrag von NAME · ' + { story: 'Story', neben: 'Nebenauftrag', einfuehrung: 'Einführung' }[a]; })()`);
    assert.strictEqual(x.kopf[1], erwartet, x.id);
    const artText = run(`window.i18n.t('hub.dialog.npc_quest.art_text.' + window.questSystem.getAuftragsArt('${x.id}'))`);
    assert.ok(artText.length > 20 && x.info.indexOf(erwartet + '. ' + artText) >= 0, x.id + ': Info ohne Art-Erklaerung: ' + x.info);
  }
  // Stichproben der Arten
  const art2 = Object.fromEntries(r.map((x) => [x.id, x.kopf[1]]));
  assert.strictEqual(art2.aldric_cleanup, 'Auftrag von NAME · Nebenauftrag');
  assert.strictEqual(art2.mara_warning, 'Auftrag von NAME · Story');
  assert.strictEqual(art2.einfuehrung_schmiede, 'Auftrag von NAME · Einführung');
  assert.strictEqual(art2.brett_stoerer, 'Aushang an der Anschlagtafel');

  // Englisch
  run(`window.i18n.setLanguage('en')`);
  const en = run(`(function () { var sc = ${HUB}, q = window.questSystem.QUEST_DEFINITIONS.mara_warning;
    sc._gespraechsLage = function () { return { questMode: 'offer', questData: q }; };
    window.__dlg = []; sc._dialogOpen = false; sc._showNpcDialogue({ id: 'mara', name: 'Mara' });
    delete sc._gespraechsLage;
    return window.__dlg[0].seiten.filter(function (p) { return p.wahl && !p.info; }).pop().text.split('\\n')[1]; })()`);
  run(`window.i18n.setLanguage('de')`);
  assert.strictEqual(en, 'Task from Mara · Story');
});

// ---- B) Hinabstieg: Boss-Tore und eingefrorene Auftraege ----------------------

const DLG = `${HUB}.children.list.filter(function (o) { return o.name === 'waveSelectDialog'; })[0]`;
const TEXTE = `(function () { var t = []; (function lauf(l) { l.forEach(function (x) {
  if (x.type === 'Container') lauf(x.list); else if (x.type === 'Text') t.push({ n: x.name, t: x.text }); }); })(${DLG}.list); return t; })()`;
function hinabstieg() {
  run(`(function () { var s = ${HUB}; s._dialogOpen = false; s._openWaveSelectDialog(function () {}); })()`);
  H.step(2);
  const t = run(TEXTE);
  run(`${HUB}.input.keyboard.emit('keydown', { code: 'Escape', preventDefault: function () {} })`);
  H.step(1);
  return t;
}

test('Hinabstieg: jedes Boss-Tor nennt seinen Auftrag und wo es ihn gibt', () => {
  const faelle = [
    [9, 2, {}, /“ läuft\. Den Auftrag gibt Dir Späherin Mara in der Stadt\.$/],
    [19, 3, {}, /“ läuft\. Den Auftrag gibt Dir Elara, sie findet Dich im Keller\.$/],
    [24, 4, {}, /“ läuft\. Den Auftrag gibt Dir Späherin Mara in der Stadt\.$/],
    [29, 4, { was_der_rauch_behaelt: 'completed' }, /“ läuft\. Den Auftrag gibt Dir Schmiedemeisterin Branka in der Stadt\.$/]
  ];
  for (const [tiefe, akt, q, re] of faelle) {
    // Bis zur Torstufe ist alles erledigt, was davor liegt — nur der Torauftrag fehlt.
    stand(Object.assign({ mara_warning: 'completed', elara_ritual: 'completed' }, q), akt, tiefe);
    const torId = run(`window.RunDepth.BOSS_TORE.filter(function (t) { return t.tiefe === ${tiefe}; })[0].questId`);
    run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData();
      delete st.quests['${torId}']; qs.loadQuestSaveData(st); })()`);
    const titel = run(`window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS['${torId}'])`);
    const t = hinabstieg().map((x) => x.t);
    const hinweis = t.filter((s) => /^Tiefer geht es erst/.test(s));
    assert.strictEqual(hinweis.length, 1, 'Tiefe ' + tiefe + ': kein Torhinweis in ' + JSON.stringify(t));
    assert.ok(hinweis[0].indexOf('„' + titel + '“') > 0, 'Tiefe ' + tiefe + ': Titel fehlt: ' + hinweis[0]);
    assert.match(hinweis[0], re, 'Tiefe ' + tiefe);
  }
  // Laeuft der Auftrag, kein Hinweis.
  stand({ elara_ritual: 'active', mara_warning: 'completed' }, 3, 19);
  assert.ok(!hinabstieg().some((x) => /^Tiefer geht es erst/.test(x.t)), 'Hinweis trotz laufendem Auftrag');
});

test('Hinabstieg: je Tiefe die laufenden Auftraege, die dort nicht zaehlen', () => {
  stand({ who_you_were: 'active', mara_warning: 'completed' }, 3, 14);
  const t = hinabstieg();
  const notizen = t.filter((x) => x.n === 'waveNotiz').map((x) => x.t);
  const tiefen = (texte) => texte.filter((x) => x.n === 'waveTiefe').map((x) => Number(x.t));
  const titel = run(`window.questSystem.QUEST_DEFINITIONS.who_you_were.title`);
  assert.deepStrictEqual(tiefen(t), [14, 10, 9, 4]);
  assert.strictEqual(notizen.length, 4, 'jede Option unter 17 mit Notiz: ' + JSON.stringify(notizen));
  for (const n of notizen) assert.strictEqual(n, '„' + titel + '“ zählt hier nicht (ab 17)');
  assert.ok(t.some((x) => x.t === 'Wartet auf mehr Tiefe:\n· ' + titel + ' (ab Tiefe 17)'), 'Kopfhinweis fehlt');
  // Ab Tiefe 17 zaehlt er dort, auf den flacheren Optionen nicht.
  stand({ who_you_were: 'active', mara_warning: 'completed' }, 3, 17);
  const t2 = hinabstieg();
  assert.strictEqual(t2.filter((x) => x.n === 'waveNotiz').length, tiefen(t2).filter((d) => d < 17).length);
  assert.ok(tiefen(t2).includes(17) && tiefen(t2).length > 1);
  assert.ok(!t2.some((x) => /^Wartet auf mehr Tiefe/.test(x.t)), 'Kopfhinweis, obwohl 17 waehlbar ist');
  // Ohne eingefrorenen Auftrag keine Notiz.
  stand({ mara_warning: 'completed' }, 3, 14);
  assert.strictEqual(hinabstieg().filter((x) => x.n === 'waveNotiz').length, 0);
  // Es zaehlt die Mindesttiefe, mit der der Auftrag angenommen wurde
  // (state.abTiefe), nicht die heutige Definition.
  stand({ who_you_were: 'active', mara_warning: 'completed' }, 3, 14);
  run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests.who_you_were.abTiefe = 12; qs.loadQuestSaveData(st); })()`);
  const t3 = hinabstieg();
  assert.ok(!t3.some((x) => /^Wartet auf mehr Tiefe/.test(x.t)), 'Kopfhinweis nach def.minDepth statt abTiefe');
  assert.strictEqual(t3.filter((x) => x.n === 'waveNotiz').length, tiefen(t3).filter((d) => d < 12).length);
});

// ---- B) Laufuebersicht --------------------------------------------------------

test('Laufuebersicht: neue Grenze, oder warum sie bleibt', () => {
  stand({}, 3, 19);
  const W = { durationMs: 65000, startDepth: 6, deepestDepth: 6, goldGained: 10, fragmentsGained: 0,
    xpGained: 120, enemiesKilled: 9, elitesKilled: 0, bossesKilled: 0, roomsEntered: 4 };
  const zeile = (grenze, reason) => {
    run(`(function () { var s = ${HUB};
      var d = s.children.list.filter(function (o) { return o.name === 'runSummaryDialog'; })[0];
      if (d) s.input.keyboard.emit('keydown-ESC');
      s._showRunSummary(Object.assign({ reason: '${reason || 'portal'}', grenze: ${JSON.stringify(grenze)} }, ${JSON.stringify(W)})); })()`);
    H.step(1);
    return run(`(function () { var d = ${HUB}.children.list.filter(function (o) { return o.name === 'runSummaryDialog'; })[0];
      var g = d.list.filter(function (o) { return o.name === 'laufGrenze'; })[0]; return g ? g.text : null; })()`);
  };
  assert.strictEqual(zeile({ grund: 'gewachsen', vorher: 6, nachher: 7, tor: null }), 'Neue Grenze: Tiefe 7');
  assert.strictEqual(zeile({ grund: 'nicht_fertig', vorher: 6, nachher: 6, tor: null }, 'death'),
    'Die Grenze bleibt bei Tiefe 6.\nNur ein Lauf bis zum letzten Raum schiebt sie weiter.');
  assert.strictEqual(zeile({ grund: 'unter_grenze', vorher: 9, nachher: 9, tor: null }),
    'Die Grenze bleibt bei Tiefe 9.\nNur ein Lauf, der an der Grenze beginnt („An die Grenze“), schiebt sie weiter.');
  const tor = run(`window.RunDepth.BOSS_TORE[1]`);
  assert.strictEqual(zeile({ grund: 'tor', vorher: 19, nachher: 19, tor: tor }),
    'Die Grenze bleibt bei Tiefe 19.\nTiefer geht es erst, wenn „Die Ritualkammer“ läuft. Den Auftrag gibt Dir Elara, sie findet Dich im Keller.');
  assert.strictEqual(zeile(null), null, 'ohne Grenzwissen keine Zeile');
  run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
  H.step(1);
});

// ---- B/C) Gespraech ohne Auftrag ---------------------------------------------

test('Gespraech: "Komm wieder", Aldric bei Verdacht, Harren vor der geheimen Sitzung', () => {
  // Branka: der erste Schliff wartet nur noch auf Tiefe 5.
  stand({ aldric_cleanup: 'completed', aldric_patrol: 'completed' }, 0, 4);
  let d = sprechen('branka');
  assert.strictEqual(d.modus, 'flavor');
  assert.ok(d.seiten.some((p) => p.text === 'Ich hätte noch etwas für Dich. Komm wieder, wenn Du bis Tiefe 5 hinabsteigen kannst.'),
    JSON.stringify(d.seiten));
  // Auf Tiefe 5 bietet sie ihn an.
  stand({ aldric_cleanup: 'completed', aldric_patrol: 'completed' }, 0, 5);
  assert.strictEqual(sprechen('branka').modus, 'offer');
  // Fehlt noch etwas anderes (Vorbedingung), sagt sie nichts von Tiefe.
  stand({}, 0, 1);
  d = sprechen('branka');
  assert.ok(!d.seiten.some((p) => /Komm wieder/.test(p.text)), 'Komm-wieder ohne Vorbedingung');

  // Aldric bei Verdacht ab 20: Nebenauftraege verweigert, mit Grund.
  stand({ aldric_cleanup: 'completed', aldric_patrol: 'completed' }, 0, 2);
  run(`window.__altStufe = window.PrintingHouse.getRetaliationTier; window.PrintingHouse.getRetaliationTier = function () { return 'active_hunt'; }`);
  try {
    d = sprechen('aldric');
    assert.strictEqual(d.modus, 'flavor', 'Aldric bietet trotz Jagd einen Nebenauftrag an');
    assert.ok(d.seiten.some((p) => /Erst muss der Verdacht des Rats sinken\./.test(p.text)), JSON.stringify(d.seiten));
  } finally {
    run(`window.PrintingHouse.getRetaliationTier = window.__altStufe`);
  }
  d = sprechen('aldric');
  assert.ok(!d.seiten.some((p) => /Verdacht des Rats sinken/.test(p.text)), 'Verdachtszeile ohne Jagd');

  // Harren in Akt 1: wer vor der geheimen Sitzung noch fehlt.
  stand({ aldric_cleanup: 'completed', aldric_patrol: 'completed', harren_daughter_investigation: 'completed',
    magistrat_verification: 'completed', garde_patrol_expansion: 'active' }, 1, 5);
  d = sprechen('harren');
  const zeile = d.seiten.map((p) => p.text).filter((t) => /^Bevor ich Dich zur Ratssitzung schicke/.test(t))[0];
  assert.ok(zeile, 'Harren nennt nicht, was fehlt: ' + JSON.stringify(d.seiten));
  for (const id of ['klerus_purification', 'garde_patrol_expansion', 'widerstand_proof', 'faction_campaign']) {
    const t = run(`window.questSystem.getQuestTitle(window.questSystem.QUEST_DEFINITIONS['${id}'])`);
    assert.ok(zeile.indexOf('„' + t + '“') > 0, id + ' fehlt: ' + zeile);
  }
  assert.ok(zeile.indexOf('Verifikation des Magistrats') < 0, 'Erledigtes wird genannt');
  assert.match(zeile, /„Patrouillen-Erweiterung“ \(Hauptmann der Stadtwache\)/);
});

// ---- Legende der Zeichen ------------------------------------------------------

test('Legende: beim ersten "?" einmal erklaert, danach nicht wieder', () => {
  stand({ aldric_cleanup: 'bereit' }, 0, 1);
  run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData(); delete st.flags.zeichen_legende_gesehen;
    window.__toasts = []; qs.loadQuestSaveData(st); ${HUB}._refreshQuestIndicators(); })()`);
  for (let i = 0; i < 300 && !run(`window.__toasts.length`); i++) H.step(5);
  const t = run(`window.__toasts`);
  assert.deepStrictEqual(t, ['Über den Köpfen: ? = Auftrag abgeben, … = läuft noch, ! = neuer Auftrag']);
  run(`${HUB}._refreshQuestIndicators()`);
  H.step(200);
  assert.strictEqual(run(`window.__toasts.length`), 1, 'Legende ein zweites Mal');
  assert.ok(run(`window.questSystem.hasFlag('zeichen_legende_gesehen')`), 'nicht im Spielstand vermerkt');
});
