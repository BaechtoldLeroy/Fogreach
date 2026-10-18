// tests/storyV61.test.js — Story-Kern v6.1, Stufe 1: Reihenfolge, Abgabe bei
// einer anderen Figur, Aldrics Ende als zweites Ziel und Spielstaende aus v5.
//
// kitty-specs/062-story-v4-quest-backbone/research/Fogreach_Story_v6.md,
// "Aenderungen an den Auftraegen". Am echten questSystem, mit einer kleinen
// Akt-Attrappe (monoton wie storySystem.advanceToAct).

const { test } = require('node:test');
const assert = require('node:assert');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function system(akt) {
  resetStore();
  delete globalThis.window.questSystem;
  const story = { akt: akt || 0, sprung: [] };
  globalThis.window.storySystem = {
    getCurrentActIndex: () => story.akt,
    advanceToAct: (n) => { story.sprung.push(n); if (n > story.akt) story.akt = n; },
    resetToAct0: () => { story.akt = 0; }
  };
  globalThis.window.DUNGEON_DEPTH = 99;
  loadGameModule('js/questSystem.js');
  return { qs: globalThis.window.questSystem, story };
}

/** Stand setzen: { id: 'completed' | 'active' | 'ready' }. */
function stand(qs, eintraege, flags) {
  const st = { storyVersion: qs.STORY_VERSION, quests: {}, flags: flags || {} };
  Object.keys(eintraege).forEach((id) => {
    const d = qs.QUEST_DEFINITIONS[id];
    const e = eintraege[id];
    st.quests[id] = { status: e === 'ready' ? 'active' : e,
      objectives: d.objectives.map((o) => ({ type: o.type, target: o.target,
        current: e === 'ready' ? o.required : 0, required: o.required })) };
  });
  qs.loadQuestSaveData(st);
}
const angebot = (qs, npc) => qs.getAvailableQuests(npc).map((q) => q.id);
function abschliessen(qs, id) {
  assert.strictEqual(qs.acceptQuest(id), true, id + ' annehmbar');
  qs.QUEST_DEFINITIONS[id].objectives.forEach((o) => {
    if (o.type === 'boss_kill') qs.onBossKilled(o.target);
    else if (o.type === 'wave') qs.onWaveCompleted(o.required);
    else qs.updateQuestProgress(o.type, o.target, o.required);
  });
  assert.strictEqual(qs.completeQuest(id), true, id + ' abschliessbar');
}

test('Akt 1: erst die Rettung, dann das Buendel, dann das Ratsdokument', () => {
  const { qs } = system(1);
  stand(qs, { harren_daughter_investigation: 'completed' });
  assert.deepStrictEqual(angebot(qs, 'elara'), [], 'Elara bietet vor der Rettung etwas an');
  qs.setFlag('elaraMet', true);
  assert.deepStrictEqual(angebot(qs, 'elara'), ['resistance_fetch_01']);
  abschliessen(qs, 'resistance_fetch_01');
  assert.deepStrictEqual(angebot(qs, 'elara'), ['widerstand_proof']);
  // Die geheime Sitzung verlangt das Dokument weiterhin.
  assert.ok(qs.QUEST_DEFINITIONS.council_collusion_reveal.prerequisites.indexOf('widerstand_proof') >= 0);
});

test('Das versiegelte Archiv kommt nach dem Wiedersehen, nicht nach dem Konvoi', () => {
  const { qs } = system(3);
  stand(qs, { espionage_convoy: 'completed' });
  assert.ok(angebot(qs, 'harren').indexOf('espionage_archive') < 0, 'das Archiv kommt vor dem Wiedersehen');
  qs.setFlag('elara_ist_lene', true);
  assert.ok(angebot(qs, 'harren').indexOf('espionage_archive') >= 0, 'nach dem Wiedersehen fehlt das Archiv');
  // Auch ohne Konvoi: Vorgaenger ist allein das Wiedersehen.
  stand(qs, {}, { elara_ist_lene: true });
  assert.ok(angebot(qs, 'harren').indexOf('espionage_archive') >= 0);
});

test('Der Bruch bleibt in Akt 3 und schliesst das Rathaus, der Maulwurf oeffnet Akt 4', () => {
  const { qs, story } = system(3);
  stand(qs, { verseuchte_kammer: 'completed', elara_second_truth: 'completed', espionage_archive: 'completed' });
  abschliessen(qs, 'bruch_confrontation');
  assert.strictEqual(story.akt, 3, 'der Bruch springt schon auf Akt 4');
  assert.strictEqual(qs.hasFlag('enttarnt'), true, 'enttarnt fehlt');
  assert.ok(angebot(qs, 'mara').indexOf('espionage_informant') >= 0, 'der Maulwurf wird in Akt 3 nicht angeboten');
  abschliessen(qs, 'espionage_informant');
  assert.strictEqual(story.akt, 4, 'der Maulwurf oeffnet Akt 4 nicht');
  assert.strictEqual(qs.hasFlag('mole_evidence'), true);
});

test('Die Quelle: Branka gibt sie nach dem Maulwurf, Thom nimmt sie ab', () => {
  const { qs } = system(4);
  stand(qs, {});
  assert.ok(angebot(qs, 'branka').indexOf('schattenrat_finale') < 0, 'die Quelle kommt vor dem Maulwurf');
  assert.ok(angebot(qs, 'harren').indexOf('schattenrat_finale') < 0, 'Harren vergibt die Quelle noch');
  stand(qs, { espionage_informant: 'completed' });
  assert.ok(angebot(qs, 'branka').indexOf('schattenrat_finale') >= 0, 'Branka bietet die Quelle nicht an');
  qs.acceptQuest('schattenrat_finale');
  const bei = (npc) => qs.getActiveQuestsAt(npc).map((q) => q.id);
  // Laufend: Branka spricht darueber, Thom nicht.
  assert.deepStrictEqual(bei('branka'), ['schattenrat_finale']);
  assert.deepStrictEqual(bei('thom'), []);
  qs.onBossKilled('schattenrat');
  // Fertig: abgegeben wird bei Thom.
  assert.deepStrictEqual(bei('branka'), []);
  assert.deepStrictEqual(bei('thom'), ['schattenrat_finale']);
  assert.strictEqual(qs.abgabeNpc('schattenrat_finale'), 'thom');
  assert.strictEqual(qs.abgabeNpc('mara_contact'), 'mara', 'ohne turnInNpcId gibt man beim Geber ab');
  assert.strictEqual(qs.completeQuest('schattenrat_finale'), true);
  assert.ok(angebot(qs, 'thom').indexOf('the_reckoning') >= 0, 'danach bietet Thom die Presse an');
});

test('Die letzte Wache: erst Welle 30, dann Aldric, dann fertig', () => {
  const { qs } = system(4);
  stand(qs, { schattenrat_finale: 'completed' });
  qs.acceptQuest('mara_assault');
  qs.onWaveCompleted(30);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_assault'), false, 'fertig, ohne Aldric gesehen zu haben');
  qs.updateQuestProgress('observe', 'aldric_gefunden', 1);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_assault'), true);
});

test('Die Gegenprobe: ohne Welle 30 zaehlt Aldric nicht vor', () => {
  // Reihenfolge nur ueber die Begegnung (roomManager); das Ziel selbst zaehlt
  // unabhaengig. Hier nur: beide Ziele sind noetig.
  const { qs } = system(4);
  stand(qs, { schattenrat_finale: 'completed' });
  qs.acceptQuest('mara_assault');
  qs.updateQuestProgress('observe', 'aldric_gefunden', 1);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_assault'), false);
});

// ---------------------------------------------------------------------------
// Spielstaende aus v5 (storyVersion 4, b457): sie laden ohne Reset und laufen
// weiter. STORY_VERSION bleibt 4 (kein Umbau der IDs, nur Reihenfolge/Texte).
// ---------------------------------------------------------------------------

test('STORY_VERSION bleibt 4, ein v5-Stand wird nicht zurueckgesetzt', () => {
  const { qs } = system(0);
  assert.strictEqual(qs.STORY_VERSION, 4);
});

test('v5-Stand mitten in Akt 1: Ratsdokument laeuft ohne Buendel weiter', () => {
  // v5: Elara gab nach der Rettung gleich das Dokument; das Buendel kam danach.
  const { qs, story } = system(1);
  qs.loadQuestSaveData({ storyVersion: 4, quests: {
    harren_daughter_investigation: { status: 'completed', objectives: [] },
    magistrat_verification: { status: 'completed', objectives: [] },
    widerstand_proof: { status: 'active', objectives: [{ type: 'fetch', target: 'council_document', current: 0, required: 1 }] }
  }, flags: { elaraMet: true, verification_sealed: true } });
  assert.strictEqual(story.akt, 1);
  assert.strictEqual(qs.getActiveQuests().some((q) => q.id === 'widerstand_proof'), true, 'der laufende Auftrag ist weg');
  qs.updateQuestProgress('fetch', 'council_document', 1);
  assert.strictEqual(qs.completeQuest('widerstand_proof'), true, 'der laufende Auftrag laesst sich nicht abgeben');
  // Das Buendel steht danach offen (es fehlte in v5 an dieser Stelle).
  assert.ok(angebot(qs, 'elara').indexOf('resistance_fetch_01') >= 0);
  assert.strictEqual(qs.hasFlag('verification_sealed'), true, 'Flaggen gehen beim Laden verloren');
});

test('v5-Stand nach dem Bruch (schon Akt 4, Maulwurf laeuft): Akt bleibt, Maulwurf und Quelle folgen', () => {
  const { qs, story } = system(4);
  qs.loadQuestSaveData({ storyVersion: 4, quests: {
    bruch_confrontation: { status: 'completed', objectives: [] },
    espionage_archive: { status: 'completed', objectives: [] },
    espionage_informant: { status: 'active', objectives: [{ type: 'observe', target: 'informant_id', current: 1, required: 1 }] }
  }, flags: { elaraReturnedToHub: true, bruch_nacht_gesehen: true } });
  assert.strictEqual(story.akt, 4, 'der Akt faellt zurueck');
  assert.strictEqual(qs.completeQuest('espionage_informant'), true);
  assert.ok(angebot(qs, 'branka').indexOf('schattenrat_finale') >= 0, 'die Quelle bleibt unerreichbar');
});

test('v5-Stand mit laufender Quelle bei Harren: laeuft weiter und wird bei Thom abgegeben', () => {
  const { qs } = system(4);
  qs.loadQuestSaveData({ storyVersion: 4, quests: {
    bruch_confrontation: { status: 'completed', objectives: [] },
    schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] }
  }, flags: {} });
  assert.deepStrictEqual(qs.getActiveQuestsAt('branka').map((q) => q.id), ['schattenrat_finale']);
  qs.onBossKilled('schattenrat');
  assert.deepStrictEqual(qs.getActiveQuestsAt('thom').map((q) => q.id), ['schattenrat_finale']);
  assert.strictEqual(qs.completeQuest('schattenrat_finale'), true);
});

test('v5-Stand mit laufender letzter Wache: Aldric wird als Ziel angehaengt', () => {
  const { qs } = system(4);
  qs.loadQuestSaveData({ storyVersion: 4, quests: {
    schattenrat_finale: { status: 'completed', objectives: [] },
    mara_assault: { status: 'active', objectives: [{ type: 'wave', target: 'reach_wave', current: 30, required: 30 }] }
  }, flags: {} });
  const q = qs.getActiveQuests().filter((x) => x.id === 'mara_assault')[0];
  assert.deepStrictEqual(q.objectives.map((o) => o.target + ':' + o.current), ['reach_wave:30', 'aldric_gefunden:0']);
  assert.strictEqual(qs.isQuestReadyToComplete('mara_assault'), false);
  qs.updateQuestProgress('observe', 'aldric_gefunden', 1);
  assert.strictEqual(qs.completeQuest('mara_assault'), true);
});

test('v5-Stand: das alte Bündel in Akt 0 (aktiv) bleibt abgebbar', () => {
  const { qs } = system(0);
  qs.loadQuestSaveData({ storyVersion: 4, quests: {
    resistance_fetch_01: { status: 'active', objectives: [{ type: 'fetch', target: 'sealed_bundle', current: 1, required: 1 }] }
  }, flags: {} });
  assert.strictEqual(qs.completeQuest('resistance_fetch_01'), true);
});

test('Alte storyVersion (v3) wird weiter sauber zurueckgesetzt', () => {
  const { qs, story } = system(3);
  qs.loadQuestSaveData({ storyVersion: 3, quests: { mara_contact: { status: 'completed', objectives: [] } }, flags: { x: true } });
  assert.strictEqual(story.akt, 0);
  assert.strictEqual(qs.hasFlag('x'), false);
});
