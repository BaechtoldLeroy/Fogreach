// tests/questTiefen.test.js — verschobene Auftragstiefen (b475).
//
// Aushaenge, Bruch, Pamphlete und einige Story-/Nebenauftraege kommen
// tiefer. Drei Dinge muessen dabei halten:
//  1. Angeboten wird erst ab der Tiefe (angebotAb gegen die erreichte Tiefe),
//     und wer schon tiefer steht, bekommt den Auftrag.
//  2. Die Geschichte von Akt 3 bis zum Finale laeuft weiter durch: kein
//     Auftrag wartet auf eine Tiefe, die ein Boss-Tor (runDepth BOSS_TORE)
//     erst nach ihm freigibt.
//  3. Laufende Auftraege aus alten Staenden behalten ihre alte Tiefe.

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

let akt = 3;
let maxTiefe = 1;
globalThis.window.storySystem = {
  getCurrentActIndex: () => akt,
  advanceToAct: (n) => { akt = Math.max(akt, n); }
};
globalThis.window.Persistence = {
  getMaxDepth: () => maxTiefe,
  bumpMaxDepth: () => ++maxTiefe
};
loadGameModule('js/anschlagtafel.js');
loadGameModule('js/questSystem.js');
loadGameModule('js/runDepth.js');
const QS = globalThis.window.questSystem;
const RD = globalThis.window.RunDepth;
const AT = globalThis.window.Anschlagtafel;
const D = QS.QUEST_DEFINITIONS;

const NEU = {
  brett_stoerer: 3, brett_kammern: 4, brett_anfuehrer: 10, brett_welle: 14, brett_aufruf: 16,
  brett_laeufe: 18, brett_zeugen: 22, bruch_confrontation: 20, verseuchte_kammer: 15,
  elara_blade: 20, elara_second_truth: 20, klerus_district_purge: 7, branka_weapons: 24, thom_pamphlets: 27
};

/** Stand setzen: alle Auftraege mit requiredAct < von abgeschlossen. */
function standAb(von, tiefe) {
  QS.loadQuestSaveData({ storyVersion: QS.getQuestSaveData().storyVersion, quests: {}, flags: {} });
  const quests = {};
  Object.keys(D).forEach((id) => {
    if ((D[id].requiredAct || 0) < von && !D[id].repeatable) quests[id] = { status: 'completed', objectives: null };
  });
  QS.loadQuestSaveData({ storyVersion: QS.getQuestSaveData().storyVersion, quests, flags: {} });
  akt = von; maxTiefe = tiefe;
}

/** Wird der Auftrag (bei erfuellten Vorbedingungen) gerade angeboten? */
function angeboten(id) {
  const st = QS.getQuestSaveData();
  (D[id].prerequisites || []).forEach((p) => { st.quests[p] = { status: 'completed', objectives: null }; });
  st.quests[id] = { status: 'available', objectives: null };
  QS.loadQuestSaveData(st);
  akt = 99;
  const gate = D[id].gate;
  try {
    D[id].gate = null;   // Brett-Rotation prueft der Test unten eigens
    return QS.getAvailableQuests(D[id].npcId).some((q) => q.id === id);
  } finally { D[id].gate = gate; }
}

test('die neuen Tiefen stehen in den Definitionen', () => {
  const ist = {};
  Object.keys(NEU).forEach((id) => { ist[id] = QS.angebotsTiefe(id) > 1 ? QS.angebotsTiefe(id) : D[id].minDepth; });
  assert.deepStrictEqual(ist, NEU);
  assert.strictEqual(D.thom_pamphlets.minDepth, 27, 'die Pamphlet-Laeufe zaehlen ab 27');
  assert.strictEqual(D.brett_welle.objectives[0].required, 6, 'Standhalten: 6 Raeume ab Tiefe 14');
});

test('kein verschobener Auftrag wird unter seiner Tiefe angeboten, ab ihr (und tiefer) schon', () => {
  Object.keys(NEU).forEach((id) => {
    const t = QS.angebotsTiefe(id);
    if (t <= 1) return;   // unverschoben (Ruhe in den Kellern, Leere Kammern)
    standAb(0, t - 1);
    assert.strictEqual(angeboten(id), false, id + ' schon auf Tiefe ' + (t - 1));
    standAb(0, t);
    assert.strictEqual(angeboten(id), true, id + ' nicht auf Tiefe ' + t);
    standAb(0, 40);
    assert.strictEqual(angeboten(id), true, id + ' nicht fuer wen schon tiefer steht');
  });
});

test('am Brett haengt nur, was auf dieser Tiefe angeboten wird — und immer einer', () => {
  for (let t = 1; t <= 40; t++) {
    const rat = AT.RATS_AUSHAENGE.filter((id) => AT.haengt(id, 'council', t));
    assert.strictEqual(rat.length, 1, 'Tiefe ' + t + ': ' + rat.join(','));
    assert.ok(QS.angebotsTiefe(rat[0]) <= t, rat[0] + ' haengt auf Tiefe ' + t);
    // Nach dem Bruch (ab Tiefe 20) haengt immer ein Aufruf.
    const wid = AT.WIDERSTAND_AUFRUFE.filter((id) => AT.haengt(id, 'broken', t));
    if (t >= 20) assert.strictEqual(wid.length, 1, 'broken, Tiefe ' + t + ': ' + wid.join(','));
    wid.forEach((id) => assert.ok(QS.angebotsTiefe(id) <= t, id + ' haengt auf Tiefe ' + t));
  }
});

// Tiefe, auf der ein Ziel erst zu erfuellen ist (Bosse, Wellen).
const BOSS_TIEFE = { kettenmeister: 10, zeremonienmeister: 20, nachhall: 25, schattenrat: 30 };
function zielTiefe(q) {
  let t = 1;
  const m = q.abTiefe !== undefined ? q.abTiefe : D[q.id].minDepth;
  if (typeof m === 'number') t = Math.max(t, m);
  (q.objectives || []).forEach((o) => {
    if (o.type === 'boss_kill') t = Math.max(t, BOSS_TIEFE[o.target] || 1);
    if (o.type === 'wave') t = Math.max(t, o.required);
  });
  return t;
}

test('Akt 3 bis zum Finale: der Spieler kommt durch, Auftrag fuer Auftrag, Lauf fuer Lauf', () => {
  standAb(3, 10);
  // Flags, die Szenen ohne Tiefenbezug setzen (Wiedersehen bei Harren ab
  // Akt 3, erste Begegnung mit Elara).
  QS.setFlag('elara_ist_lene', true);
  QS.setFlag('elaraMet', true);
  const npcs = [...new Set(Object.values(D).map((d) => d.npcId))];
  const story = ['verseuchte_kammer', 'elara_ritual', 'elara_second_truth', 'bruch_confrontation',
    'espionage_archive', 'espionage_informant', 'was_der_rauch_behaelt', 'schattenrat_finale',
    'mara_assault', 'the_reckoning', 'elara_blade', 'branka_weapons', 'thom_pamphlets', 'thom_truth'];
  const fertigBei = {};
  for (let lauf = 0; lauf < 80 && !(fertigBei.the_reckoning && fertigBei.mara_assault); lauf++) {
    // Im Hub: alles annehmen, was angeboten wird; erledigen, was diese Tiefe hergibt.
    let bewegt = true;
    while (bewegt) {
      bewegt = false;
      npcs.forEach((n) => QS.getAvailableQuests(n).forEach((q) => {
        if (q.npcId === 'anschlagtafel') return;   // Brett: nicht Teil der Kette
        if (QS.acceptQuest(q.id)) bewegt = true;
      }));
      QS.getActiveQuests().forEach((q) => {
        if (zielTiefe(Object.assign({ abTiefe: QS.getQuestSaveData().quests[q.id].abTiefe }, q)) > maxTiefe) return;
        q.objectives.forEach((o) => { o.current = o.required; });
        if (QS.completeQuest(q.id)) { bewegt = true; if (!fertigBei[q.id]) fertigBei[q.id] = maxTiefe; }
      });
    }
    // Ein abgeschlossener Lauf an der Grenze (die Boss-Tore entscheiden).
    RD.markRunStarted();
    RD.tryCompleteRun('dungeon_complete', maxTiefe);
  }
  const offen = story.filter((id) => !fertigBei[id]);
  assert.deepStrictEqual(offen, [], 'liegen geblieben (Tiefe ' + maxTiefe + ', Akt ' + akt + '): ' + offen.join(', ')
    + ' — fertig: ' + JSON.stringify(fertigBei));
  // Und in der Reihenfolge der Tiefen, nicht vorher.
  assert.ok(fertigBei.bruch_confrontation >= 20, 'Bruch vor Tiefe 20: ' + fertigBei.bruch_confrontation);
  assert.ok(fertigBei.thom_pamphlets >= 27, 'Pamphlete vor Tiefe 27');
  assert.ok(fertigBei.branka_weapons >= 24, 'Waffen vor Tiefe 24');
});

test('Altstand: laufender Auftrag unter der neuen Tiefe zaehlt weiter mit der alten', () => {
  standAb(3, 12);
  const st = QS.getQuestSaveData();
  // Vor b475 angenommen: kein abTiefe-Vermerk.
  st.quests.bruch_confrontation = { status: 'active', objectives: [{ type: 'kill', target: 'elite_enemy', current: 0, required: 3 }] };
  st.quests.brett_anfuehrer = { status: 'active', objectives: [{ type: 'kill', target: 'elite_enemy', current: 0, required: 3 }] };
  QS.loadQuestSaveData(st);
  globalThis.window.DUNGEON_DEPTH = 12;
  QS.updateQuestProgress('kill', 'elite_enemy', 3);
  assert.strictEqual(QS.isQuestReadyToComplete('bruch_confrontation'), true, 'Bruch zaehlt auf Tiefe 12 nicht mehr');
  assert.strictEqual(QS.isQuestReadyToComplete('brett_anfuehrer'), true, 'Aushang zaehlt auf Tiefe 12 nicht mehr');
  assert.strictEqual(QS.tiefeErreicht('bruch_confrontation', 8), true);
  // Neu angenommen gilt die neue Tiefe.
  const st2 = QS.getQuestSaveData();
  st2.quests.brett_zeugen = { status: 'available', objectives: null };
  QS.loadQuestSaveData(st2);
  QS.acceptQuest('brett_zeugen');
  globalThis.window.DUNGEON_DEPTH = 21;
  QS.updateQuestProgress('kill', 'elite_enemy', 4);
  assert.strictEqual(QS.isQuestReadyToComplete('brett_zeugen'), false, 'neu angenommen zaehlt schon auf 21');
  globalThis.window.DUNGEON_DEPTH = 22;
  QS.updateQuestProgress('kill', 'elite_enemy', 4);
  assert.strictEqual(QS.isQuestReadyToComplete('brett_zeugen'), true);
});
