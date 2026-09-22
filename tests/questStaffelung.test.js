// tests/questStaffelung.test.js — die Geschichte steht nicht mehr still (#72, #148).
//
// Befund aus #72: Die Quests ballten sich auf Tiefe 1, 3, 10, 20 und 30;
// dazwischen lagen zwei Blöcke von je ~6 Läufen ohne Story-Fortschritt, weil
// die Bosse fest auf 10/20/30 stehen und alles andere vorher erledigbar war.
//
// Jetzt: Akt-3- und Akt-4-Aufträge sind über ihre Strecke gestaffelt
// (minDepth), zwei menschliche Nebenquests (#148, Story-Bibel §14) liegen in
// den Lücken, und jede Staffelung wird dem Spieler gesagt — im Questtext und
// im Abstiegsdialog am Rathauskeller.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
require('./setup');
const { loadGameModule } = require('./loadGameModule');
const { launch, launchDungeon } = require('../tools/headless/index.js');

// Die Questtexte laufen ueber i18n: DE wird aus den Daten registriert, EN
// ausdruecklich. Der Stub haelt beide Woerterbuecher fest.
const EN = {}, DE = {};
globalThis.window.i18n = {
  register(lang, dict) { Object.assign(lang === 'en' ? EN : DE, dict); },
  t: (k) => (k in DE ? DE[k] : k), getLanguage: () => 'de', setLanguage() {}, onChange: () => () => {},
  has: (k) => k in DE
};
globalThis.window.storySystem = { getCurrentActIndex: () => 99 };
loadGameModule('js/questSystem.js');
const QS = globalThis.window.questSystem;
const D = QS.QUEST_DEFINITIONS;

const STAFFEL = {
  espionage_archive: 12, thom_truth: 14, buerger_hund: 15, garde_night_escort: 16,
  who_you_were: 17, espionage_informant: 23, branka_eichgewicht: 26
};

test('Die Mindesttiefen der gestaffelten Aufträge', () => {
  const ist = {};
  Object.keys(STAFFEL).forEach((id) => { ist[id] = D[id] && D[id].minDepth; });
  assert.deepStrictEqual(ist, STAFFEL);
});

test('Jede Mindesttiefe steht im Text — Beschreibung und Dialog, Deutsch und Englisch', () => {
  const fehlt = [];
  Object.keys(D).forEach((id) => {
    const t = D[id].minDepth;
    if (typeof t !== 'number') return;
    const de = new RegExp('Tiefe ' + t + '\\b');
    const en = new RegExp('depth ' + t + '\\b');
    if (!de.test(D[id].description || '')) fehlt.push(id + '.description (DE)');
    if (!de.test((D[id].dialogueOffer || '') + (D[id].dialogueProgress || ''))) fehlt.push(id + '.dialog (DE)');
    if (!en.test(EN['quest.' + id + '.description'] || '')) fehlt.push(id + '.description (EN)');
    if (!en.test((EN['quest.' + id + '.dialogueOffer'] || '') + (EN['quest.' + id + '.dialogueProgress'] || ''))) fehlt.push(id + '.dialog (EN)');
  });
  assert.deepStrictEqual(fehlt, []);
});

/**
 * Tiefen, auf denen in einem Akt etwas weitergeht: Mindesttiefen der Quests,
 * der Aktbeginn und der Boss am Ende. Die groesste Luecke dazwischen ist die
 * laengste Strecke ohne neuen Auftrag.
 */
function groessteLuecke(akt, von, bis) {
  const beats = new Set([von, bis]);
  Object.values(D).forEach((q) => {
    if ((q.requiredAct ?? 0) !== akt) return;
    beats.add(typeof q.minDepth === 'number' ? Math.max(von, q.minDepth) : von);
  });
  if (akt === 4) [22, 23, 24].forEach((t) => beats.add(t));   // thom_pamphlets: drei Laeufe ab 22
  const s = [...beats].filter((t) => t >= von && t <= bis).sort((a, b) => a - b);
  let max = 0;
  for (let i = 1; i < s.length; i++) max = Math.max(max, s[i] - s[i - 1]);
  return { max, beats: s };
}

test('Akt 3 (Tiefe 10-20): höchstens drei Läufe ohne neuen Beat', () => {
  const r = groessteLuecke(3, 10, 20);
  assert.ok(r.max <= 3, 'Luecke ' + r.max + ' bei Beats ' + r.beats.join(','));
});

test('Akt 4 (Tiefe 20-30): höchstens vier Läufe ohne neuen Beat', () => {
  const r = groessteLuecke(4, 20, 30);
  assert.ok(r.max <= 4, 'Luecke ' + r.max + ' bei Beats ' + r.beats.join(','));
});

test('Die beiden Nebenquests: menschlich, ohne Story-Flags, in den Lücken', () => {
  const h = D.buerger_hund, e = D.branka_eichgewicht;
  assert.ok(h && e, 'Nebenquests fehlen');
  assert.strictEqual(h.requiredAct, 3);
  assert.strictEqual(e.requiredAct, 4);
  assert.ok(!h.completionFlags && !e.completionFlags && h.advanceAct === undefined && e.advanceAct === undefined,
    'Nebenquests beeinflussen die Hauptgeschichte nicht');
  assert.ok(EN['quest.buerger_hund.title'] && EN['quest.branka_eichgewicht.title'], 'englische Titel fehlen');
});

test('tiefeErreicht: mit und ohne Mindesttiefe', () => {
  assert.strictEqual(QS.tiefeErreicht('thom_truth', 13), false);
  assert.strictEqual(QS.tiefeErreicht('thom_truth', 14), true);
  assert.strictEqual(QS.tiefeErreicht('aldric_cleanup', 1), true);
});

// --------------------------------------------------------------- Im Spiel

let H = null;
before(async () => { H = await launchDungeon({ depth: 12 }); });
after(async () => { if (H) await H.shutdown(); });

/** spawnLoot mit erzwungenem Wurf; zaehlt Brunos Halsband im Beutetopf. */
function halsbandBeiTiefe(tiefe) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem, alt = qs.getActiveQuests, altR = Math.random;
    window.DUNGEON_DEPTH = ${tiefe};
    qs.getActiveQuests = function () { return [{ id: 'buerger_hund',
      objectives: [{ type: 'fetch', target: 'hundehalsband', current: 0, required: 1 }] }]; };
    var vorher = lootGroup.getChildren().length;
    Math.random = function () { return 0; };
    try { spawnLoot.call(sc, player.x + 40, player.y, null, null); }
    finally { Math.random = altR; qs.getActiveQuests = alt; }
    return lootGroup.getChildren().slice(vorher).filter(function (l) {
      var it = l.getData && l.getData('item');
      return it && it.key === 'HUNDEHALSBAND';
    }).length;
  })()`);
}

test('Questgegenstände fallen erst ab der Mindesttiefe', () => {
  assert.strictEqual(halsbandBeiTiefe(12), 0, 'Halsband auf Tiefe 12 (Quest ab 15)');
  assert.ok(halsbandBeiTiefe(16) >= 1, 'kein Halsband auf Tiefe 16');
});

test('Spionageräume erscheinen erst ab der Mindesttiefe ihrer Quest', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem, alt = qs.getActiveQuests;
    qs.getActiveQuests = function () { return [{ id: 'espionage_archive',
      objectives: [{ type: 'observe', target: 'archive_record', current: 0, required: 1 }] }]; };
    var out = {};
    try {
      [11, 12].forEach(function (t) {
        window.DUNGEON_DEPTH = t;
        initDungeonRun();
        out[t] = dungeonRun.templateOrder.indexOf('SealedArchive') !== -1;
      });
    } finally { qs.getActiveQuests = alt; window.DUNGEON_DEPTH = 12; }
    return out;
  })()`);
  assert.strictEqual(r[11], false, 'Archiv auf Tiefe 11 (Quest ab 12)');
  assert.strictEqual(r[12], true, 'kein Archiv auf Tiefe 12');
});

test('Quest-Gegnerbilder: Bruch mit Kettenwache und Hunden, Befallene sind Vergessene', () => {
  const G = H.run(`({ bruch: window.EnemySpawnGating.questProfil(['bruch_confrontation']),
    purge: window.EnemySpawnGating.questProfil(['klerus_district_purge']),
    beide: window.EnemySpawnGating.questProfil(['council_surveillance', 'klerus_district_purge']) })`);
  assert.strictEqual(JSON.stringify(G.bruch), JSON.stringify([6, 6, 15, 15]));
  assert.strictEqual(JSON.stringify(G.purge), JSON.stringify([5, 5, 5]));
  assert.strictEqual(JSON.stringify(G.beide), JSON.stringify([2, 2, 2, 16, 3, 5, 5, 5]), 'zwei Profile mischen sich');
});

test('Rathauskeller: der Abstiegsdialog nennt Aufträge, die auf mehr Tiefe warten', async () => {
  const hub = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    assert.ok(await hub.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    hub.step(10);
    const r = hub.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var qs = window.questSystem, alt = qs.getActiveQuests;
      (window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '11');
      qs.getActiveQuests = function () { return [{ id: 'thom_truth', objectives: [] }, { id: 'aldric_cleanup', objectives: [] }]; };
      var vorher = sc.children.list.length;
      try { sc._openWaveSelectDialog(function () {}); } finally { qs.getActiveQuests = alt; }
      var texte = [];
      var sammeln = function (o) {
        if (!o) return;
        if (o.type === 'Text') texte.push(o.text);
        if (o.list) o.list.forEach(sammeln);
      };
      sc.children.list.slice(vorher).forEach(sammeln);
      return texte.join(' | ');
    })()`);
    assert.match(r, /Wartet auf mehr Tiefe/, r);
    assert.match(r, /Verbotene Wahrheiten \(ab Tiefe 14\)/, r);
    assert.ok(!/Säuberung/.test(r), 'ein Auftrag ohne Mindesttiefe wird genannt');
  } finally {
    await hub.shutdown();
  }
});
