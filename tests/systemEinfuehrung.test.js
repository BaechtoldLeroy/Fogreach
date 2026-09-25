// tests/systemEinfuehrung.test.js — #143: Systeme kommen ueber Quests herein.
//
// Ein Tutorialschritt haelt das Spiel an, sagt etwas und wartet. Eine Quest
// ist ein Grund: nach ihr hat man in der Schmiede einmal etwas verbessert und
// weiss, wozu sie taugt. Vier Systeme, vier Figuren, vier Auftraege.
//
// Die teuerste Falle dabei ist nicht der Text, sondern der Ausloeser: eine
// Quest, deren Ziel im Spiel nie gemeldet wird, laesst sich nicht abschliessen
// und bleibt fuer immer im Journal stehen. Deshalb prueft dieser Lauf nicht
// nur, dass die Quests da sind, sondern dass es zu JEDEM Ziel eine Stelle im
// Spielcode gibt, die es meldet.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { resetStore } = require('./setup');
const { loadGameModule } = require('./loadGameModule');

function frisch() {
  resetStore();
  delete globalThis.window.questSystem;
  globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
  globalThis.window.DUNGEON_DEPTH = 99;
  loadGameModule('js/questSystem.js');
  return globalThis.window.questSystem;
}

beforeEach(() => { resetStore(); });

/**
 * System-Ziel -> Einfuehrungsquest -> Figur, die sie vergibt.
 *
 * `vorher` sind die Auftraege, die davor liegen muessen. Die vier ersten
 * haengen nur an Aldrics Auftakt; Wissensbaum und Amulette bauen auf einer
 * frueheren Einfuehrung auf — den Wissensbaum kann man ohne Fragment gar
 * nicht benutzen, und die Amulette fuehrt nur der Haendler in der Tiefe.
 */
const EINFUEHRUNGEN = [
  { ziel: 'upgrade', quest: 'einfuehrung_schmiede', npc: 'branka', vorher: [] },
  { ziel: 'edikt', quest: 'einfuehrung_presse', npc: 'thom', vorher: [] },
  { ziel: 'markt', quest: 'einfuehrung_markt', npc: 'mara', vorher: [] },
  { ziel: 'talent', quest: 'einfuehrung_talente', npc: 'aldric', vorher: [] },
  { ziel: 'wissen', quest: 'einfuehrung_wissen', npc: 'branka',
    vorher: ['aldric_patrol', 'einfuehrung_schmiede', 'harren_daughter_investigation'] },
  { ziel: 'amulett', quest: 'einfuehrung_amulett', npc: 'mara',
    vorher: ['einfuehrung_markt'] }
];

/** Alle js-Dateien des Spiels, damit ein Ausloeser auffindbar ist. */
function spielDateien(verzeichnis) {
  const out = [];
  fs.readdirSync(verzeichnis, { withFileTypes: true }).forEach((e) => {
    const p = path.join(verzeichnis, e.name);
    if (e.isDirectory()) out.push(...spielDateien(p));
    else if (e.name.endsWith('.js')) out.push(p);
  });
  return out;
}

test('Zu jedem System-Ziel gibt es eine Stelle im Spiel, die es meldet', () => {
  // Das ist die Prüfung, die eine unabschliessbare Quest verhindert: die
  // Definition allein sagt nichts darueber, ob der Auftrag je fertig wird.
  const quellen = spielDateien('js')
    .filter((p) => !p.endsWith(path.join('js', 'questSystem.js')))   // die Meldestelle selbst zaehlt nicht
    .map((p) => fs.readFileSync(p, 'utf8'))
    .join('\n');
  const ohne = EINFUEHRUNGEN
    .filter((e) => quellen.indexOf("onSystemUsed('" + e.ziel + "')") === -1)
    .map((e) => e.ziel + ' (' + e.quest + ')');
  assert.deepStrictEqual(ohne, [],
    'diese Ziele werden nirgends gemeldet — die Quests waeren unabschliessbar');
});

test('onSystemUsed nimmt nur bekannte Ziele an — und sagt es laut', () => {
  const qs = frisch();
  assert.deepStrictEqual(Array.from(qs.SYSTEM_ZIELE).sort(),
    EINFUEHRUNGEN.map((e) => e.ziel).sort());
  qs.acceptQuest('einfuehrung_schmiede');

  // Ein Tippfehler bewegt nichts — aber das allein faellt niemandem auf:
  // ein unbekanntes Ziel findet ohnehin kein Objective. Er muss SICHTBAR
  // sein, sonst sucht man den Fehler spaeter im Spiel statt im Aufruf.
  const echt = console.warn;
  const gesagt = [];
  console.warn = function () { gesagt.push(Array.prototype.join.call(arguments, ' ')); };
  try {
    assert.strictEqual(qs.onSystemUsed('upgrde'), false, 'ein Tippfehler wurde angenommen');
    assert.strictEqual(gesagt.length, 1, 'der Tippfehler blieb stumm: ' + gesagt.join(' | '));
    assert.match(gesagt[0], /upgrde/, 'die Warnung nennt das Ziel nicht: ' + gesagt[0]);
    assert.strictEqual(qs.onSystemUsed('upgrade'), true);
    assert.strictEqual(gesagt.length, 1, 'ein gueltiges Ziel hat gewarnt');
  } finally { console.warn = echt; }
  assert.strictEqual(qs.getActiveQuests()[0].objectives[0].current, 1);
});

/** Bringt einen Auftrag ohne Ruecksicht auf seine Ziele zum Abschluss. */
function durchwinken(qs, id) {
  assert.strictEqual(qs.acceptQuest(id), true, id + ' liess sich nicht annehmen');
  (qs.getActiveQuests().find((q) => q.id === id).objectives || []).forEach((o) => {
    qs.updateQuestProgress(o.type, o.target, o.required);
  });
  assert.strictEqual(qs.completeQuest(id), true, id + ' liess sich nicht abschliessen');
}

EINFUEHRUNGEN.forEach(({ ziel, quest, npc, vorher }) => {
  test('Die Einfuehrung zu "' + ziel + '" steht bei der richtigen Figur und wird fertig', () => {
    const qs = frisch();
    const def = qs.QUEST_DEFINITIONS[quest];
    assert.ok(def, quest + ' fehlt');
    assert.strictEqual(def.npcId, npc, 'falsche Figur');
    assert.ok(qs.getAvailableQuests(npc).some((q) => q.id === quest) === false,
      'sie steht schon vor dem ersten Lauf bereit');

    // Nach Aldrics Auftakt-Auftrag (und ggf. ihren Vorlaeufern) haengt sie
    // beim NPC.
    durchwinken(qs, 'aldric_cleanup');
    vorher.forEach((id) => durchwinken(qs, id));
    assert.ok(qs.getAvailableQuests(npc).some((q) => q.id === quest),
      'sie steht nach dem Auftakt nicht bereit');

    assert.strictEqual(qs.acceptQuest(quest), true);
    assert.strictEqual(qs.onSystemUsed(ziel), true, 'der Auftrag rueckte nicht vor');
    const aktiv = qs.getActiveQuests().find((q) => q.id === quest);
    assert.strictEqual(aktiv.objectives[0].current, 1);
    assert.strictEqual(qs.completeQuest(quest), true);
    assert.ok(qs.getCompletedQuests().some((q) => q.id === quest));
  });
});

test('Die Belohnung ist klein — Gold und Erfahrung, sonst nichts', () => {
  // Klein genug, dass niemand sie abarbeiten MUSS, gross genug, sie mitzunehmen.
  const qs = frisch();
  EINFUEHRUNGEN.forEach(({ quest }) => {
    const r = qs.QUEST_DEFINITIONS[quest].rewards || {};
    assert.deepStrictEqual(Object.keys(r).sort(), ['gold', 'xp'],
      quest + ' belohnt mehr als Gold und Erfahrung: ' + Object.keys(r).join(','));
    assert.ok(r.gold <= 50 && r.xp <= 60, quest + ' belohnt zu gut');
  });
});

test('Wer den Wissensbaum-Auftrag bekommt, hat auch ein Fragment dafuer', () => {
  // Der Baum kostet ein Erinnerungsfragment. Ohne eines waere der Auftrag
  // angenommen und nicht erfuellbar — genau das darf eine Einfuehrung nie
  // sein. Deshalb haengt er an einem Auftrag, der eines auszahlt.
  const qs = frisch();
  const def = qs.QUEST_DEFINITIONS.einfuehrung_wissen;
  const zahlt = (def.prerequisites || []).filter((id) => {
    const r = (qs.QUEST_DEFINITIONS[id] || {}).rewards || {};
    return (r.fragments | 0) > 0;
  });
  assert.ok(zahlt.length > 0,
    'keine Voraussetzung zahlt ein Fragment aus: ' + (def.prerequisites || []).join(', '));
});

test('Das Tutorial erklaert die Systeme nicht mehr selbst', () => {
  // Die andere Haelfte von #143: was eine Figur sagen kann, sagt kein Kasten
  // mehr. Zurueck bleibt nur, was ohne Ansage niemand herausfindet.
  const src = fs.readFileSync(path.join('js', 'tutorialSystem.js'), 'utf8');
  const drin = (id) => src.indexOf("id: '" + id + "'") >= 0;

  const zuviel = ['quest.close', 'dungeon.approach', 'dungeon.enter',
    'skill.wait', 'skill.loadout', 'skill.use'].filter(drin);
  assert.deepStrictEqual(zuviel, [],
    'diese Schritte haben im Hub eine Figur und gehoeren in eine Quest');

  const kern = ['movement', 'quest.dialog', 'combat.basics', 'loot.pickup',
    'loot.equip', 'combat.potion', 'journal.hint', 'save.notice'];
  assert.deepStrictEqual(kern.filter((id) => !drin(id)), [],
    'aus dem harten Kern fehlt etwas — das findet ohne Ansage niemand heraus');
});

test('Maras Stand bleibt zu, solange man nicht tief genug war', () => {
  resetStore();
  delete globalThis.window.questSystem;
  globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
  globalThis.window.DUNGEON_DEPTH = 2;             // flacher als ihre Tiefe 4
  loadGameModule('js/questSystem.js');
  const qs = globalThis.window.questSystem;
  qs.acceptQuest('einfuehrung_markt');
  assert.strictEqual(qs.onSystemUsed('markt'), false,
    'der Auftrag rueckte vor, obwohl der Stand noch gar nicht erreichbar ist');
  globalThis.window.DUNGEON_DEPTH = 4;
  assert.strictEqual(qs.onSystemUsed('markt'), true, 'auf Tiefe 4 rueckt er nicht vor');
});
