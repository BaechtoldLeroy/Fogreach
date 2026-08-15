// tests/headlessHub.test.js — Hub und Meta-Systeme headless (#96).
//
// Der Hub (HubSceneV2, 3704 Zeilen) und die Meta-Systeme dahinter waren bisher
// vollstaendig ungetestet — die 600 Unit-Tests laden nur einzelne IIFE-Module
// und sehen keine Szene. Hier laeuft der echte Hub.
//
// Enthaelt am Ende zwei `todo`-Tests, die bekannte Defekte AUSFUEHRBAR
// dokumentieren (#83/#84). Sie machen die Suite nicht rot, melden aber
// automatisch Vollzug, sobald der Fehler behoben ist.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 250 });
  assert.ok(ok, 'HubSceneV2 wurde nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

test('hub: Szene laeuft und ist bevoelkert', () => {
  const hub = H.scene('HubSceneV2');
  assert.ok(hub, 'HubSceneV2 nicht gefunden');
  assert.ok(hub.children.list.length > 20,
    'Hub wirkt leer: ' + hub.children.list.length + ' Objekte');

  const npcs = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    return sc.npcGroup ? sc.npcGroup.getChildren().length : 0;
  })()`);
  assert.ok(npcs >= 4, 'zu wenige NPCs im Hub: ' + npcs);
});

test('hub: alle Meta-Systeme sind verfuegbar', () => {
  const systems = ['questSystem', 'PrintingHouse', 'FactionSystem', 'SkillTree',
    'KnowledgeTree', 'AbilitySystem', 'LootSystem', 'storySystem'];
  const missing = systems.filter((s) => H.run(`typeof window.${s}`) !== 'object');
  assert.deepStrictEqual(missing, [], 'fehlende Systeme: ' + missing.join(', '));
});

test('hub: Quest-Fluss verfuegbar -> annehmen -> aktiv', () => {
  const res = H.run(`(function () {
    var qs = window.questSystem;
    // getAvailableQuests(npcId) filtert auf den NPC — ohne id ist die Liste leer.
    var avail = qs.getAvailableQuests('aldric');
    if (!avail.length) return { fehler: 'keine Quest bei Aldric verfuegbar' };
    var id = avail[0].id;
    var accepted = qs.acceptQuest(id);
    return {
      id: id,
      accepted: accepted,
      aktiv: qs.getActiveQuests().map(function (q) { return q.id; }),
    };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.strictEqual(res.accepted, true, 'acceptQuest schlug fehl');
  assert.ok(Array.from(res.aktiv).includes(res.id),
    'angenommene Quest ist nicht aktiv: ' + Array.from(res.aktiv).join(', '));
});

test('hub: Fraktions-Ansehen laesst sich aendern und lesen', () => {
  const res = H.run(`(function () {
    var fs = window.FactionSystem;
    var before = fs.getStanding('widerstand');
    fs.adjustStanding('widerstand', 5);
    var after = fs.getStanding('widerstand');
    return { before: before, after: after };
  })()`);
  assert.strictEqual(res.after, res.before + 5,
    'Ansehen aenderte sich nicht wie erwartet: ' + res.before + ' -> ' + res.after);
});

test('hub: Druckerei kennt ihre Edikte, Blaetter und den Verdacht', () => {
  const res = H.run(`(function () {
    var ph = window.PrintingHouse;
    var cat = (typeof ph.getEdictCatalog === 'function') ? ph.getEdictCatalog() : [];
    return {
      edikte: cat.length,
      tiers: Array.from(new Set(cat.map(function (e) { return e.tier; }))).length,
      blaetter: ph.getDruckblaetter(),
      verdacht: ph.getSuspicion(),
    };
  })()`);
  assert.ok(res.edikte > 0, 'kein Edikt-Katalog gefunden');
  assert.ok(res.tiers > 1, 'Edikte haben keine Risikostufen (' + res.tiers + ')');
  assert.strictEqual(typeof res.blaetter, 'number', 'Druckblaetter nicht lesbar');
  assert.strictEqual(typeof res.verdacht, 'number', 'Verdacht nicht lesbar');
});

test('hub: Verdacht steigt und wird vom Vergeltungssystem gelesen', () => {
  const res = H.run(`(function () {
    var ph = window.PrintingHouse;
    var t0 = ph.getRetaliationTier();
    ph.addSuspicion(12);          // ueber die Vergeltungsschwelle (>=10)
    var t1 = ph.getRetaliationTier();
    return { vorher: t0, nachher: t1, verdacht: ph.getSuspicion() };
  })()`);
  // getRetaliationTier() liefert einen STRING ('none' | 'high_alert' | ...),
  // keinen Zahlenwert — deshalb auf Wechsel pruefen, nicht auf Groesser-als.
  assert.ok(res.verdacht >= 12, 'Verdacht stieg nicht: ' + res.verdacht);
  assert.strictEqual(res.vorher, 'none', 'unerwartete Ausgangsstufe: ' + res.vorher);
  assert.notStrictEqual(res.nachher, 'none',
    'Vergeltungsstufe reagiert nicht auf Verdacht: ' + res.vorher + ' -> ' + res.nachher);
});

// ---------------------------------------------------------------------------
// Bekannte Defekte — ausfuehrbar dokumentiert
// ---------------------------------------------------------------------------
// Als `todo` markiert: sie beschreiben das GEWUENSCHTE Verhalten und schlagen
// heute fehl. Die Suite bleibt dadurch gruen, aber sobald der Fix kommt, meldet
// node:test den Test als unerwartet bestanden — dann `todo` entfernen.

test('hub: observe-Trigger three_hands_seen erreicht das Finale (#83)',
  { todo: 'Bug #83 — Flag wird nur als Quest-Objective gefeuert, nie als Story-Flag' },
  () => {
    const res = H.run(`(function () {
      var qs = window.questSystem;
      qs.updateQuestProgress('observe', 'three_hands_seen', 1);
      var flags = qs.getFlags();
      return {
        flag: !!flags.three_hands_seen,
        regler: window.QuestFinale.computeFinaleState(flags).betrayalForeseen,
      };
    })()`);
    assert.strictEqual(res.flag, true, 'three_hands_seen wurde nicht als Flag gesetzt');
    assert.strictEqual(res.regler, true, 'Finale-Regler "Verrat vorhergesehen" bleibt false');
  });

test('hub: convoy_blown ist irgendwo setzbar (#84)',
  { todo: 'Bug #84 — der Flag wird im ganzen Projekt nur GELESEN, nie gesetzt' },
  () => {
    // Es existiert kein Spielpfad, der den Flag setzt. Der Test haelt fest,
    // dass Maras Anwesenheit im Finale damit keine echte Bedingung hat.
    const canBeUnset = H.run(`(function () {
      var qs = window.questSystem;
      var flags = qs.getFlags();
      return !flags.convoy_blown;
    })()`);
    assert.strictEqual(canBeUnset, false,
      'convoy_blown ist nie gesetzt — Maras Finale-Bedingung ist wirkungslos');
  });

// ---------------------------------------------------------------------------
// Behobene Defekte — Regression
// ---------------------------------------------------------------------------
// Steht bewusst am Dateiende: der Test faehrt den Quest-Stand ans Story-Ende
// und laesst ihn dort. Alles davor laeuft auf dem frischen Stand.

test('hub: the_reckoning schaltet den Epilog-Zustand frei (#100)', () => {
  const res = H.run(`(function () {
    var qs = window.questSystem;

    // Aufsetzen ueber den ECHTEN Speicherstand-Pfad — entspricht dem Laden
    // eines Spielstands kurz vor dem Finale. Nur die beiden Tore von
    // the_reckoning werden gestellt (Akt 4, Vorgaenger abgeschlossen), der
    // Abschluss selbst laeuft danach ueber acceptQuest/completeQuest.
    var quests = {};
    Object.keys(qs.QUEST_DEFINITIONS).forEach(function (id) {
      quests[id] = { status: 'available', objectives: null };
    });
    quests.schattenrat_finale = { status: 'completed', objectives: null };
    qs.loadQuestSaveData({ storyVersion: qs.STORY_VERSION, quests: quests, flags: {} });
    window.storySystem.advanceToAct(4);

    var offered = qs.getAvailableQuests('thom').map(function (q) { return q.id; });
    if (offered.indexOf('the_reckoning') < 0) {
      return { fehler: 'the_reckoning wird nicht angeboten: ' + offered.join(', ') };
    }
    if (!qs.acceptQuest('the_reckoning')) return { fehler: 'acceptQuest schlug fehl' };
    if (!qs.completeQuest('the_reckoning')) return { fehler: 'completeQuest schlug fehl' };

    var aldric = null;
    var sc = window.game.scene.getScene('HubSceneV2');
    if (sc && sc.npcGroup) {
      sc.npcGroup.getChildren().forEach(function (n) {
        if (n && n.npcId === 'aldric') aldric = { visible: n.visible, active: n.active };
      });
    }
    return {
      unlock: !!(window._questUnlocks && window._questUnlocks.story_ending),
      flag: !!qs.getFlags().story_ending,
      phase: window.HubPhase.current(),
      aldric: aldric,
    };
  })()`);

  assert.ok(!res.fehler, res.fehler);
  assert.strictEqual(res.unlock, true, 'story_ending fehlt in window._questUnlocks');
  // Der eigentliche Fix: der Unlock hat einen Flag-Zwilling (completionFlags).
  assert.strictEqual(res.flag, true,
    'story_ending erreicht die questFlags nicht — Hub bliebe in "broken" haengen');
  assert.strictEqual(res.phase, 'epilogue',
    'Hub-Phase nach dem Story-Ende ist "' + res.phase + '" statt "epilogue"');
});
