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
  // Stufe und Laufzaehler offen; die Sperren selbst pruefen eigene Tests.
  globalThis.window.playerLevel = 5;
  globalThis.window.Persistence = { getMaxDepth: () => 3, hasSave: () => false };
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
  // Zwei Ziele, in dieser Reihenfolge: erst der Punkt, dann die Taste.
  { ziel: 'talent', quest: 'einfuehrung_talente', npc: 'aldric', vorher: [], danach: ['loadout'] },
  { ziel: 'wissen', quest: 'einfuehrung_wissen', npc: 'branka',
    vorher: ['aldric_patrol', 'einfuehrung_schmiede', 'harren_daughter_investigation'] },
  { ziel: 'haendler', quest: 'einfuehrung_amulett', npc: 'mara',
    vorher: ['einfuehrung_markt'] },
  // Erst nach dem ersten Stufenaufstieg (eigener Test unten).
  { ziel: 'charakterwerte', quest: 'einfuehrung_akte', npc: 'aldric', vorher: [] },
  // Erst nach dem ersten ganz durchgespielten Lauf (eigener Test unten).
  { ziel: 'truhe', quest: 'einfuehrung_truhe', npc: 'branka', vorher: ['einfuehrung_schmiede'] }
];

/** Alle System-Ziele, auch die zweiten Schritte. */
const ALLE_ZIELE = EINFUEHRUNGEN.reduce((a, e) => a.concat([e.ziel], e.danach || []), []);

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
  const ohne = ALLE_ZIELE
    .filter((ziel) => quellen.indexOf("onSystemUsed('" + ziel + "')") === -1);
  assert.deepStrictEqual(ohne, [],
    'diese Ziele werden nirgends gemeldet — die Quests waeren unabschliessbar');
});

test('onSystemUsed nimmt nur bekannte Ziele an — und sagt es laut', () => {
  const qs = frisch();
  assert.deepStrictEqual(Array.from(qs.SYSTEM_ZIELE).sort(), ALLE_ZIELE.slice().sort());
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

EINFUEHRUNGEN.forEach(({ ziel, quest, npc, vorher, danach }) => {
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
    (danach || []).forEach((z) => {
      assert.strictEqual(qs.completeQuest(quest), false, 'fertig, obwohl "' + z + '" noch fehlt');
      assert.strictEqual(qs.onSystemUsed(z), true, 'der zweite Schritt "' + z + '" rueckte nicht vor');
    });
    assert.strictEqual(qs.completeQuest(quest), true);
    assert.ok(qs.getCompletedQuests().some((q) => q.id === quest));
  });
});

test('Die Belohnung ist klein — Erfahrung und genau eine passende Gabe', () => {
  // Klein genug, dass niemand sie abarbeiten MUSS, gross genug, sie mitzunehmen.
  // Die Gabe passt zum System (Schmiede: Eisenbrocken, Presse: Druckblaetter …),
  // siehe tests/questLohn.test.js.
  const qs = frisch();
  EINFUEHRUNGEN.forEach(({ quest }) => {
    const r = qs.QUEST_DEFINITIONS[quest].rewards || {};
    const gaben = Object.keys(r).filter((k) => k !== 'xp');
    assert.strictEqual(gaben.length, 1, quest + ' belohnt mit ' + gaben.join(','));
    assert.ok(r.xp <= 60, quest + ' belohnt zu gut');
    assert.ok(!r.gold || r.gold <= 50, quest + ' zahlt zu viel Gold');
    assert.ok(!r.items, quest + ' verschenkt Ausruestung');
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

test('Der Haendler-Auftrag haengt nicht an Amuletten', () => {
  // Er hing an 'amulett' — und Amulette fuehrt der wandernde Haendler erst
  // ab Tiefe 10 (lootSystem AMULET_SHOP_MIN_DEPTH). Maras Auftrag kommt
  // aber schon nach ihrem Marktauftrag (Tiefe 4). Dazwischen war er
  // angenommen und nicht erfuellbar.
  const qs = frisch();
  const ziel = qs.QUEST_DEFINITIONS.einfuehrung_amulett.objectives[0].target;
  assert.strictEqual(ziel, 'haendler',
    'der Auftrag verlangt wieder "' + ziel + '"');
  const src = fs.readFileSync(path.join('js', 'lootSystem.js'), 'utf8');
  const m = /AMULET_SHOP_MIN_DEPTH = ([0-9]+)/.exec(src);
  assert.ok(m, 'AMULET_SHOP_MIN_DEPTH nicht gefunden');
  const amulettAb = Number(m[1]);
  const vorher = qs.QUEST_DEFINITIONS.einfuehrung_markt.minDepth | 0;
  assert.ok(amulettAb > vorher,
    'Amulette gaebe es schon ab Tiefe ' + amulettAb + ' — dann waere der alte Weg in Ordnung gewesen');
});

test('Nur der wandernde Haendler erfuellt ihn, nicht Maras Stand', () => {
  // Sonst koennte man ihn oben im Hub abhaken, ohne je unten gewesen zu sein.
  const src = fs.readFileSync(path.join('js', 'scenes', 'ShopScene.js'), 'utf8');
  const block = src.slice(src.indexOf('_kaufGemeldet() {'), src.indexOf('_tryBuyItem(stockIdx'));
  assert.ok(/isDungeonMerchant/.test(block),
    'der Haendler-Ausloeser unterscheidet nicht mehr, wo gekauft wurde');
  assert.ok(block.indexOf("onSystemUsed('haendler')") > block.indexOf('isDungeonMerchant'),
    'er meldet auch bei Mara');
});


test('Das Tutorial erklaert die Systeme nicht mehr selbst', () => {
  // Die andere Haelfte von #143: was eine Figur sagen kann, sagt kein Kasten
  // mehr. Zurueck bleibt nur, was ohne Ansage niemand herausfindet.
  const src = fs.readFileSync(path.join('js', 'tutorialSystem.js'), 'utf8');
  const drin = (id) => src.indexOf("id: '" + id + "'") >= 0;

  // dungeon.enter ist seit b428 wieder drin (User: "zwischen aldric und greif
  // an, sollte das tutorial den spieler ja in den dungeon weisen") — Aldrics
  // Auftrag allein fuehrte nicht sichtbar zur Kellertuer.
  const zuviel = ['quest.close', 'dungeon.approach',
    'skill.wait', 'skill.loadout', 'skill.use'].filter(drin);
  assert.deepStrictEqual(zuviel, [],
    'diese Schritte haben im Hub eine Figur und gehoeren in eine Quest');

  const kern = ['movement', 'quest.dialog', 'dungeon.enter', 'combat.basics', 'loot.pickup',
    'loot.equip', 'combat.potion', 'journal.hint', 'save.notice', 'settings.hint'];
  assert.deepStrictEqual(kern.filter((id) => !drin(id)), [],
    'aus dem harten Kern fehlt etwas — das findet ohne Ansage niemand heraus');
});

test('Maras Stand-Auftrag kommt erst, wenn ihr Stand offen ist', () => {
  // Frueher wurde er sofort angeboten und fror dann ein, solange der
  // LAUFENDE Lauf flacher als 4 war — gekauft wird aber oben bei ihr. Jetzt
  // sperrt das Angebot (Schwarzmarkt ab erreichter Tiefe 4), nicht das Zaehlen.
  let offen = false;
  globalThis.window.LootSystem = { isBlackMarketUnlocked: () => offen };
  try {
    const qs = frisch();
    durchwinken(qs, 'aldric_cleanup');
    globalThis.window.DUNGEON_DEPTH = 1;
    const angeboten = () => qs.getAvailableQuests('mara').some((d) => d.id === 'einfuehrung_markt');
    assert.strictEqual(angeboten(), false, 'angeboten, obwohl ihr Stand noch zu ist');
    offen = true;
    assert.strictEqual(angeboten(), true, 'mit offenem Stand nicht angeboten');
    qs.acceptQuest('einfuehrung_markt');
    assert.strictEqual(qs.onSystemUsed('markt'), true, 'der Kauf zaehlt nach einem flachen Lauf nicht');
  } finally {
    delete globalThis.window.LootSystem;
  }
});

// --- Sperren der neuen Einfuehrungen ---------------------------------------

test('"Deine Akte" kommt erst nach dem ersten Stufenaufstieg', () => {
  const qs = frisch();
  durchwinken(qs, 'aldric_cleanup');
  const angeboten = () => qs.getAvailableQuests('aldric').some((q) => q.id === 'einfuehrung_akte');
  globalThis.window.playerLevel = 1;
  assert.strictEqual(angeboten(), false, 'auf Stufe 1 angeboten — im Bogen hat sich noch nichts bewegt');
  globalThis.window.playerLevel = 2;
  assert.strictEqual(angeboten(), true, 'auf Stufe 2 nicht angeboten');
});

test('"Deine Akte" kommt nicht vor Aldrics erstem Auftrag', () => {
  const qs = frisch();
  globalThis.window.playerLevel = 9;
  assert.strictEqual(qs.getAvailableQuests('aldric').some((q) => q.id === 'einfuehrung_akte'), false);
});

test('Brankas Truhen-Auftrag kommt erst nach dem ersten ganz durchgespielten Lauf', () => {
  const qs = frisch();
  let tiefe = 1;
  globalThis.window.Persistence = { getMaxDepth: () => tiefe, hasSave: () => false };
  durchwinken(qs, 'aldric_cleanup');
  durchwinken(qs, 'einfuehrung_schmiede');
  const angeboten = () => qs.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_truhe');
  assert.strictEqual(angeboten(), false, 'vor dem ersten abgeschlossenen Lauf angeboten');
  tiefe = 2;   // RunDepth.tryCompleteRun hebt die Grenze beim ersten Abschluss
  assert.strictEqual(angeboten(), true, 'nach dem ersten Lauf nicht angeboten');
});

test('Brankas Truhen-Auftrag haengt an ihrer Schmiede-Einfuehrung', () => {
  const qs = frisch();
  durchwinken(qs, 'aldric_cleanup');
  assert.strictEqual(qs.getAvailableQuests('branka').some((q) => q.id === 'einfuehrung_truhe'), false);
});

test('"Wofuer du taugst": erst der Talentpunkt, dann die Taste', () => {
  const qs = frisch();
  const ziele = qs.QUEST_DEFINITIONS.einfuehrung_talente.objectives.map((o) => o.target);
  assert.deepStrictEqual(Array.from(ziele), ['talent', 'loadout']);
  assert.match(qs.QUEST_DEFINITIONS.einfuehrung_talente.dialogueProgressNext,
    /Ein Werkzeug, das Du nicht griffbereit hast, ist kein Werkzeug\. Leg es auf eine Taste/i);
});

// --- Alte Spielstaende -------------------------------------------------------

function standMit(qs, eintraege) {
  const st = qs.getQuestSaveData();
  Object.keys(eintraege).forEach((id) => { st.quests[id] = eintraege[id]; });
  qs.loadQuestSaveData(JSON.parse(JSON.stringify(st)));
}

test('Alter Stand: laufender Talent-Auftrag mit nur einem Ziel bekommt das Loadout-Ziel', () => {
  const qs = frisch();
  standMit(qs, {
    aldric_cleanup: { status: 'completed', objectives: [] },
    einfuehrung_talente: { status: 'active',
      objectives: [{ type: 'system', target: 'talent', current: 1, required: 1 }] }
  });
  const q = qs.getActiveQuests().find((x) => x.id === 'einfuehrung_talente');
  assert.strictEqual(q.objectives.length, 2);
  assert.strictEqual(q.objectives[0].current, 1, 'der schon gesetzte Punkt ging verloren');
  assert.strictEqual(q.objectives[1].target, 'loadout');
  assert.strictEqual(qs.isQuestReadyToComplete('einfuehrung_talente'), false);
  qs.onSystemUsed('loadout');
  assert.strictEqual(qs.completeQuest('einfuehrung_talente'), true);
});

test('Alter Stand: abgeschlossener Talent-Auftrag bleibt abgeschlossen', () => {
  const qs = frisch();
  standMit(qs, { einfuehrung_talente: { status: 'completed',
    objectives: [{ type: 'system', target: 'talent', current: 1, required: 1 }] } });
  assert.ok(qs.getCompletedQuests().some((q) => q.id === 'einfuehrung_talente'));
  assert.strictEqual(qs.getActiveQuests().some((q) => q.id === 'einfuehrung_talente'), false);
});

test('Alter Stand mit umbenanntem Ziel wird nicht ergaenzt', () => {
  // Ein Ziel, das die Definition nicht mehr kennt: dann bleibt der Stand, wie
  // er ist — ein zweites Ziel daneben machte ihn nicht besser.
  const qs = frisch();
  standMit(qs, { einfuehrung_amulett: { status: 'active',
    objectives: [{ type: 'system', target: 'amulett', current: 0, required: 1 }] } });
  const q = qs.getActiveQuests().find((x) => x.id === 'einfuehrung_amulett');
  assert.strictEqual(q.objectives.length, 1);
  assert.strictEqual(q.objectives[0].target, 'amulett');
});

// --- Journal-Hinweis ---------------------------------------------------------

test('Aldrics erste Abgabe verweist aufs Journal (J und Symbol)', () => {
  const qs = frisch();
  const de = qs.QUEST_DEFINITIONS.aldric_cleanup.dialogueComplete;
  assert.match(de, /Journal/);
  assert.match(de, /J\b/);
  assert.match(de, /Journal-Symbol/);
});