// tests/questErklaerung.test.js — Was das Spiel ueber Auftraege und Tiefe sagt.
//
// Die Mechanik stand, aber man sah sie nicht: warum die Tiefengrenze nach
// einem Lauf nicht wuchs, warum ein Auftrag auf Tiefe 10 nicht zaehlte, wo
// ein fertiger Auftrag abzugeben war, woher die Sammelstuecke kommen. Hier die
// reinen Teile (questSystem, RunDepth) mit Akt-Attrappe; die Anzeige im Hub
// prueft tests/questErklaerungHub.test.js.

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

let maxTiefe = 1;
function system(akt) {
  resetStore();
  delete globalThis.window.questSystem;
  const story = { akt: akt || 0 };
  globalThis.window.storySystem = {
    getCurrentActIndex: () => story.akt,
    advanceToAct: (n) => { if (n > story.akt) story.akt = n; },
    resetToAct0: () => { story.akt = 0; }
  };
  maxTiefe = 1;
  globalThis.window.Persistence = { getMaxDepth: () => maxTiefe, bumpMaxDepth: () => ++maxTiefe };
  globalThis.window.DUNGEON_DEPTH = 1;
  if (!globalThis.window.i18n) loadGameModule('js/i18n.js');
  globalThis.window.i18n.setLanguage('de');
  loadGameModule('js/questSystem.js');
  return globalThis.window.questSystem;
}

function stand(qs, eintraege) {
  const st = { storyVersion: qs.STORY_VERSION, quests: {}, flags: {} };
  Object.keys(eintraege).forEach((id) => {
    const d = qs.QUEST_DEFINITIONS[id];
    const voll = eintraege[id] === 'bereit';
    st.quests[id] = {
      status: voll ? 'active' : eintraege[id],
      objectives: d.objectives.map((o) => ({ type: o.type, target: o.target, current: voll ? o.required : 0, required: o.required }))
    };
  });
  qs.loadQuestSaveData(st);
}

// ---- Grenze nach dem Lauf (RunDepth.letzterLauf) ----------------------------

test('Laufende: die Grenze waechst nur an der Grenze, nach ganzem Lauf, ohne Tor — und sagt, warum nicht', () => {
  const qs = system(3);
  loadGameModule('js/runDepth.js');
  const RD = globalThis.window.RunDepth;
  RD._resetForTest();

  maxTiefe = 6;
  RD.markRunStarted();
  RD.tryCompleteRun('death', 6);
  assert.deepStrictEqual(RD.letzterLauf(), { grund: 'nicht_fertig', vorher: 6, nachher: 6, tor: null });

  RD.markRunStarted();
  RD.tryCompleteRun('dungeon_complete', 4);
  assert.deepStrictEqual(RD.letzterLauf(), { grund: 'unter_grenze', vorher: 6, nachher: 6, tor: null });

  RD.markRunStarted();
  RD.tryCompleteRun('dungeon_complete', 6);
  assert.deepStrictEqual(RD.letzterLauf(), { grund: 'gewachsen', vorher: 6, nachher: 7, tor: null });
  assert.strictEqual(maxTiefe, 7);

  // Tor 19: "Die Ritualkammer" laeuft noch nicht.
  stand(qs, {});
  maxTiefe = 19;
  RD.markRunStarted();
  RD.tryCompleteRun('dungeon_complete', 19);
  const l = RD.letzterLauf();
  assert.strictEqual(l.grund, 'tor');
  assert.strictEqual(l.nachher, 19);
  assert.strictEqual(l.tor.questId, 'elara_ritual');

  // Ein neuer Lauf beginnt ohne Altlast; ein zweiter Aufruf im selben Lauf
  // (Tod nach dem Abschluss) ueberschreibt das Ergebnis nicht.
  RD.markRunStarted();
  assert.strictEqual(RD.letzterLauf(), null);
  maxTiefe = 3;
  RD.tryCompleteRun('dungeon_complete', 3);
  RD.tryCompleteRun('death', 3);
  assert.strictEqual(RD.letzterLauf().grund, 'gewachsen');
});

// ---- Angebote, die nur auf die Tiefe warten ---------------------------------

test('wartetAufTiefe: nur, wenn allein die erreichte Tiefe fehlt', () => {
  const qs = system(0);
  // Brankas erster Schliff haengt an Aldrics Saeuberung und an Tiefe 5.
  assert.strictEqual(qs.wartetAufTiefe('branka'), null, 'Vorbedingung fehlt, also nicht nur die Tiefe');
  stand(qs, { aldric_cleanup: 'completed' });
  maxTiefe = 4;
  assert.strictEqual(qs.wartetAufTiefe('branka'), 5);
  assert.ok(!qs.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_schmiede'));
  maxTiefe = 5;
  assert.ok(qs.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_schmiede'));
  // Die Truhe (7) haengt am Schliff — erst danach wartet sie nur auf die Tiefe.
  assert.strictEqual(qs.wartetAufTiefe('branka'), null);
  stand(qs, { aldric_cleanup: 'completed', einfuehrung_schmiede: 'completed' });
  assert.strictEqual(qs.wartetAufTiefe('branka'), 7);
  // Akt fehlt: Maras Warnung (Akt 2, ab 9) zaehlt nicht als "nur Tiefe".
  maxTiefe = 1;
  assert.strictEqual(qs.wartetAufTiefe('mara'), 6, 'Markt (6) ja, Akt-2-Auftraege nein');
});

// ---- Eingefrorene Auftraege (minDepth) ---------------------------------------

test('Zu flach: laufende Auftraege unter ihrer Mindesttiefe werden genannt', () => {
  const qs = system(3);
  stand(qs, { who_you_were: 'active', thom_truth: 'active', aldric_cleanup: 'active' });
  const liste = qs.eingefroreneAuftraege(10).map((q) => q.id + '@' + q.tiefe);
  assert.deepStrictEqual(liste, ['thom_truth@14', 'who_you_were@17']);
  assert.strictEqual(qs.zuFlachText(10), 'Zu flach für: „' + qs.QUEST_DEFINITIONS.thom_truth.title + '“ (ab Tiefe 14), „'
    + qs.QUEST_DEFINITIONS.who_you_were.title + '“ (ab Tiefe 17)');
  assert.strictEqual(qs.zuFlachText(14).indexOf(qs.QUEST_DEFINITIONS.thom_truth.title), -1);
  assert.strictEqual(qs.zuFlachText(17), '');
  // Ein fertiger Auftrag friert nicht ein (er ist abzugeben).
  stand(qs, { who_you_were: 'bereit' });
  assert.strictEqual(qs.zuFlachText(1), '');
  // Englisch
  stand(qs, { who_you_were: 'active' });
  globalThis.window.i18n.setLanguage('en');
  assert.match(qs.zuFlachText(5), /^Too shallow for: ".+" \(from depth 17\)$/);
  globalThis.window.i18n.setLanguage('de');
});

// ---- Sammelauftraege: die Gegner tragen es -----------------------------------

test('Sammelauftraege sagen, dass Gegner die Stuecke tragen; keine Registratur, kein "gut versteckt"', () => {
  const qs = system(0);
  const D = qs.QUEST_DEFINITIONS;
  const I = globalThis.window.i18n;
  const fetch = Object.keys(D).filter((id) => (D[id].objectives || []).some((o) => o.type === 'fetch'));
  assert.ok(fetch.length >= 12, 'zu wenige Sammelauftraege: ' + fetch.length);
  for (const id of fetch) {
    assert.match(D[id].description, /Gegner|Gesindel|Anführer/, id + ': Beschreibung nennt die Traeger nicht');
    assert.match(I._wert('en', 'quest.' + id + '.description') || '', /enem|rabble|leader/i, id + ': EN nennt die Traeger nicht');
  }
  const alle = [];
  Object.keys(D).forEach((id) => ['description', 'dialogueOffer', 'dialogueProgress', 'dialogueProgressNext'].forEach((f) => {
    if (typeof D[id][f] === 'string') alle.push([id + '.' + f, D[id][f], I._wert('en', 'quest.' + id + '.' + f) || '']);
  }));
  for (const [k, de, en] of alle) {
    assert.ok(!/Registratur|gut versteckt|Welle \d/.test(de), k + ': ' + de);
    assert.ok(!/registry|well hidden|wave \d/i.test(en), k + ' (EN): ' + en);
  }
  assert.match(D.wache_helm.description, /Elite-Gegner, goldener Name/);
  assert.match(D.harren_daughter_investigation.dialogueComplete, /zuerst Aldric .*dann die Garde, dann der Klerus/);
});

// ---- "Quest-Ziel erfuellt" nennt die Abgabe ----------------------------------

test('Ziel-Toast nennt, wo abzugeben ist (Figur, Elara im Keller, Anschlagtafel)', () => {
  const qs = system(1);
  const I = globalThis.window.i18n;
  I.register('de', { 'hub.npc.aldric.name': 'Ratsherr Aldric' });
  I.register('en', { 'hub.npc.aldric.name': 'Councillor Aldric' });
  const toasts = [];
  globalThis.window.gameScene = { sys: { isActive: () => true }, add: {} };
  globalThis.window.EventSystem = { showToast: (s, msg) => toasts.push(msg) };
  globalThis.window.DUNGEON_DEPTH = 99;   // der Aushang zaehlt erst ab Tiefe 3
  try {
    stand(qs, { aldric_cleanup: 'active', resistance_fetch_01: 'active', brett_stoerer: 'active' });
    qs.updateQuestProgress('kill', 'enemy', 12);
    qs.updateQuestProgress('fetch', 'sealed_bundle', 1);
    const text = toasts.join('\n---\n');
    assert.match(text, /Quest-Ziel erfüllt: Säuberung der Keller\nAbgabe bei Ratsherr Aldric/);
    assert.match(text, /Bring Elara das Bündel\. Sie findet Dich im Keller\./);
    assert.match(text, /Abgabe an der Anschlagtafel/);
    assert.strictEqual(toasts.length, 3);
    assert.strictEqual(qs.abgabeZeile('aldric_cleanup'), 'Abgabe bei Ratsherr Aldric');
    I.setLanguage('en');
    assert.strictEqual(qs.abgabeZeile('aldric_cleanup'), 'Turn in to Councillor Aldric');
  } finally {
    I.setLanguage('de');
    delete globalThis.window.gameScene;
    delete globalThis.window.EventSystem;
  }
});

test('Auftragsart: Aushang, Einfuehrung, Neben, Story', () => {
  const qs = system(0);
  assert.strictEqual(qs.getAuftragsArt('brett_stoerer'), 'aushang');
  assert.strictEqual(qs.getAuftragsArt('einfuehrung_schmiede'), 'einfuehrung');
  assert.strictEqual(qs.getAuftragsArt('aldric_cleanup'), 'neben');
  assert.strictEqual(qs.getAuftragsArt('mara_warning'), 'story');
  assert.strictEqual(qs.getAuftragsArt('schattenrat_finale'), 'story');
});
