// tests/questTaktung.test.js — die Taktung der fruehen Auftraege (b512).
//
// Simuliert einen Spieler, der alles annimmt und erledigt, Besuch fuer
// Besuch (Tiefe 1..19), und prueft, auf welcher erreichten Tiefe jeder
// Auftrag zum ersten Mal angeboten wird. Dazu:
//  - je Hub-Besuch hoechstens EINE neue Einfuehrung,
//  - nichts wird angeboten, das auf dieser Tiefe noch eingefroren waere
//    (minDepth ueber der erreichten Tiefe).
//
// Modell eines Besuchs auf Tiefe d:
//  1. Abgabe: was im letzten Lauf (Tiefe d-1) erledigt werden konnte.
//  2. Angebot: alles annehmen; was nur im Hub zu tun ist (Schmiede, Presse,
//     Talente, oeffentliche Sitzung, ...), gleich erledigen — und neu schauen.
//  3. Lauf auf Tiefe d: Elara taucht auf, nimmt ab und vergibt (im Keller).
//     Ein abgeschlossener Lauf hebt die Tiefe (RunDepth, mit Boss-Toren).

const { test } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');

let akt = 0;
let maxTiefe = 1;
globalThis.window.storySystem = {
  getCurrentActIndex: () => akt,
  advanceToAct: (n) => { akt = Math.max(akt, n); }
};
globalThis.window.Persistence = {
  getMaxDepth: () => maxTiefe,
  bumpMaxDepth: () => ++maxTiefe
};
globalThis.window.playerLevel = 5;   // "Deine Akte" erst ab Stufe 2
loadGameModule('js/questSystem.js');
loadGameModule('js/runDepth.js');
const QS = globalThis.window.questSystem;
const RD = globalThis.window.RunDepth;
const D = QS.QUEST_DEFINITIONS;

// Das Ziel: erreichte Tiefe, auf der der Auftrag zuerst angeboten wird.
const ERWARTET = {
  // Einfuehrungen, eine je Besuch
  einfuehrung_talente: 2, einfuehrung_akte: 3, einfuehrung_presse: 4, einfuehrung_schmiede: 5,
  einfuehrung_truhe: 7, einfuehrung_markt: 6, einfuehrung_wissen: 8, einfuehrung_amulett: 11,
  // Akt 0/1
  harren_daughter_investigation: 2, magistrat_verification: 3, garde_patrol_expansion: 4,
  klerus_purification: 5, faction_campaign: 5, council_collusion_reveal: 6,
  // Akt 2: die geheime Sitzung wird im Lauf belauscht und bei Harren
  // abgegeben, der Akt beginnt also einen Besuch nach ihrem Angebot.
  mara_contact: 7, council_seizure: 7, espionage_convoy: 8, branka_doubt: 8,
  council_surveillance: 8, branka_transcripts: 9, mara_warning: 9, elara_meeting: 9,
  // Akt 3
  klerus_district_purge: 11, espionage_archive: 12, buerger_hund: 13, thom_truth: 14,
  garde_night_escort: 16, who_you_were: 17, elara_ritual: 19
};

// Ziele, die oben im Hub erfuellt werden.
const HUB_ZIELE = new Set(['upgrade', 'edikt', 'markt', 'talent', 'loadout', 'charakterwerte',
  'truhe', 'wissen', 'oeffentliche_sitzung', 'edikte_gedruckt', 'edikte_plakatiert']);
const BOSS_TIEFE = { kettenmeister: 10, zeremonienmeister: 20, nachhall: 25, schattenrat: 30 };

function zielTiefe(id) {
  let t = 1;
  const st = QS.getQuestSaveData().quests[id];
  const m = st && st.abTiefe !== undefined ? st.abTiefe : D[id].minDepth;
  if (typeof m === 'number') t = Math.max(t, m);
  (D[id].objectives || []).forEach((o) => {
    if (o.type === 'boss_kill') t = Math.max(t, BOSS_TIEFE[o.target] || 1);
    if (o.type === 'wave') t = Math.max(t, o.required);
  });
  return t;
}

/** Ziele (alle oder nur die Hub-Ziele) eines laufenden Auftrags erfuellen. */
function erfuellen(id, nurHub) {
  const st = QS.getQuestSaveData();
  const q = st.quests[id];
  (q.objectives || []).forEach((o) => {
    if (!nurHub || HUB_ZIELE.has(o.target) || D[id].type === 'dialogue') o.current = o.required;
  });
  QS.loadQuestSaveData(st);
}

function simulieren(bisTiefe) {
  akt = 0; maxTiefe = 1;
  QS.loadQuestSaveData({ storyVersion: QS.getQuestSaveData().storyVersion, quests: {}, flags: {} });
  if (RD._resetForTest) RD._resetForTest();
  const npcs = [...new Set(Object.values(D).map((d) => d.npcId))]
    .filter((n) => n !== 'anschlagtafel' && n !== 'elara');
  const angebotBei = {};
  const angenommenBei = {};
  const eingefroren = [];

  const annehmen = (q, d) => {
    if (!(q.id in angebotBei)) angebotBei[q.id] = d;
    if (typeof D[q.id].minDepth === 'number' && D[q.id].minDepth > d) {
      eingefroren.push(q.id + ' (Tiefe ' + d + ', zaehlt ab ' + D[q.id].minDepth + ')');
    }
    if (QS.acceptQuest(q.id)) { angenommenBei[q.id] = d; return true; }
    return false;
  };

  for (let d = 1; d <= bisTiefe && maxTiefe === d; d++) {
    // 1. Abgabe: im letzten Lauf erledigt (ohne Elara, die nimmt unten ab).
    QS.getActiveQuests().forEach((q) => {
      if (q.npcId === 'elara' || angenommenBei[q.id] >= d || zielTiefe(q.id) > d - 1) return;
      erfuellen(q.id, false);
      QS.completeQuest(q.id);
    });
    // 2. Im Hub: annehmen, Hub-Ziele erledigen, bis sich nichts mehr bewegt.
    let bewegt = true;
    while (bewegt) {
      bewegt = false;
      npcs.forEach((n) => QS.getAvailableQuests(n).forEach((q) => { if (annehmen(q, d)) bewegt = true; }));
      QS.getActiveQuests().forEach((q) => {
        if (q.npcId === 'elara' || zielTiefe(q.id) > d) return;
        erfuellen(q.id, true);
        if (QS.isQuestReadyToComplete(q.id) && QS.completeQuest(q.id)) bewegt = true;
      });
    }
    // 3. Der Lauf. Wiedersehen bei Harren ab Akt 3 (Archiv-Auftrag).
    if (akt >= 3) QS.setFlag('elara_ist_lene', true);
    const fertig = QS.getCompletedQuests().map((q) => q.id);
    if (fertig.includes('harren_daughter_investigation')) QS.setFlag('elaraMet', true);
    QS.getActiveQuests().forEach((q) => {
      if (q.npcId !== 'elara' || angenommenBei[q.id] >= d || zielTiefe(q.id) > d - 1) return;
      erfuellen(q.id, false);
      QS.completeQuest(q.id);
    });
    QS.getAvailableQuests('elara').forEach((q) => annehmen(q, d));
    RD.markRunStarted();
    RD.tryCompleteRun('dungeon_complete', d);
  }
  return { angebotBei, eingefroren };
}

test('Taktung: jeder Auftrag kommt auf seiner Tiefe (alles angenommen und erledigt)', () => {
  const r = simulieren(19);
  const ist = {};
  Object.keys(ERWARTET).forEach((id) => { ist[id] = r.angebotBei[id] || null; });
  assert.deepStrictEqual(ist, ERWARTET);
  assert.strictEqual(maxTiefe, 20, 'die Simulation blieb auf Tiefe ' + maxTiefe + ' stehen');
});

test('Taktung: je Hub-Besuch hoechstens eine neue Einfuehrung', () => {
  const r = simulieren(19);
  const jeTiefe = {};
  Object.keys(r.angebotBei).forEach((id) => {
    if (D[id].rewardTier !== 'einfuehrung') return;
    (jeTiefe[r.angebotBei[id]] = jeTiefe[r.angebotBei[id]] || []).push(id);
  });
  const doppelt = Object.keys(jeTiefe).filter((t) => jeTiefe[t].length > 1).map((t) => t + ': ' + jeTiefe[t].join(', '));
  assert.deepStrictEqual(doppelt, []);
  // Alle acht kommen vor
  assert.strictEqual(Object.values(jeTiefe).flat().length, 8);
});

test('Taktung: nichts im Journal, das auf der erreichten Tiefe noch eingefroren ist', () => {
  const r = simulieren(19);
  assert.deepStrictEqual(r.eingefroren, []);
});

test('Altstand: schon angebotene und laufende Auftraege bleiben, wer tiefer steht, bekommt sie', () => {
  akt = 1; maxTiefe = 2;
  // Vor b512 angenommen: Presse und Schmiede laufen, Truhe ist angeboten.
  QS.loadQuestSaveData({ storyVersion: QS.getQuestSaveData().storyVersion, flags: {}, quests: {
    aldric_cleanup: { status: 'completed', objectives: null },
    einfuehrung_presse: { status: 'active', objectives: [{ type: 'system', target: 'edikt', current: 0, required: 1 }] },
    einfuehrung_schmiede: { status: 'completed', objectives: null },
    einfuehrung_truhe: { status: 'available', objectives: null }
  } });
  assert.ok(QS.getActiveQuests().some((q) => q.id === 'einfuehrung_presse'), 'laufende Presse verloren');
  QS.updateQuestProgress('system', 'edikt', 1);
  assert.strictEqual(QS.completeQuest('einfuehrung_presse'), true);
  // Die Truhe wartet jetzt auf Tiefe 7 — und ist dort wieder da.
  assert.strictEqual(QS.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_truhe'), false);
  maxTiefe = 7;
  assert.strictEqual(QS.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_truhe'), true);
});
