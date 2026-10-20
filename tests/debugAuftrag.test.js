// tests/debugAuftrag.test.js — ?auftrag=<questId> (js/debugAuftrag.js).
//
// Die Flagge stellt beim Hub-Eintritt den Stand her, den ein Auftrag braucht
// (Vorgaenger, Tor-Flaggen, Akt, erreichte Tiefe), und nimmt ihn an. Geprueft
// wird ueber den echten Ablauf: einmal im Hub (?autostart=1, Thoms Edikt an
// der echten Presse) und einmal mit ?dungeon=N, wo der Hub den Stand setzen
// muss, BEVOR er absteigt (Elaras Schloesser, echtes Kettenschloss, Abgabe
// bei ihr im Keller). Dazu: mehrere Auftraege direkt, ohne Gate wirkungslos,
// eine ungueltige ID harmlos, ?kreide=1.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const GS = `window.game.scene.getScene('GameScene')`;
let H = null;   // Hub, ?auftrag=thom_gegenedikt&auftragfast=1
let K = null;   // Keller, ?dungeon=21&auftrag=elara_schloesser&auftragfast=1&event=chain_lock

before(async () => {
  H = await launch({ search: '?debug=1&autostart=1&auftrag=thom_gegenedikt&auftragfast=1', renderer: 'canvas', waitFor: 'StartScene' });
  H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
  H.step(20);
  H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog([]); } catch (e) {} sc._dialogOpen = false; })()`);
  // Ereignisse an: ?event=chain_lock soll ab Raum 1 wirklich ein Schloss stellen.
  K = await launchDungeon({ depth: 21, ohneZufallsereignisse: false,
    zusatz: '&debug=1&auftrag=elara_schloesser&auftragfast=1&event=chain_lock' });
});
after(async () => {
  if (H) await H.shutdown();
  if (K) await K.shutdown();
});

const stand = (h, id) => JSON.parse(h.run(`JSON.stringify((function () { var d = window.questSystem.getQuestSaveData().quests['${id}'] || {};
  return { status: d.status || 'available', ziele: (d.objectives || []).map(function (o) { return o.current + '/' + o.required; }).join(' '),
    bereit: window.questSystem.isQuestReadyToComplete('${id}') }; })())`));
const status = (h, id) => stand(h, id).status;

/** Frischer Stand: keine Auftraege, Akt 0, erreichte Tiefe 1. */
function leeren(h) {
  h.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = {}; qs.loadQuestSaveData(st);
    window.storySystem.loadStorySaveData({ currentActIndex: 0 });
    (window.SlotStorage || localStorage).setItem(window.Persistence.KEYS.MAX_DEPTH, '1');
  })()`);
}

/** Setzt location.search/hostname, vergisst das Gate, ruft code, stellt zurueck. */
function mitAdresse(h, such, host, code) {
  return h.run(`(function () {
    var G = window.DebugGate, l = window.location;
    var alt = { search: l.search, hostname: l.hostname, protocol: l.protocol };
    var setzen = function (k, v) { try { Object.defineProperty(l, k, { value: v, configurable: true }); } catch (e) {} };
    setzen('search', ${JSON.stringify(such)});
    if (${JSON.stringify(host)}) { setzen('hostname', ${JSON.stringify(host)}); setzen('protocol', 'https:'); }
    G._vergessen(); window.DebugAuftrag._vergessen();
    var gesagt = [], echt = console.warn;
    console.warn = function () { gesagt.push(Array.prototype.join.call(arguments, ' ')); };
    try { var r = (function () { ${code} })(); return { r: r, offen: G.aktiv(), gesagt: gesagt.join(' | ') }; }
    finally { console.warn = echt; Object.keys(alt).forEach(function (k) { setzen(k, alt[k]); }); G._vergessen(); }
  })()`);
}

/** Abgabe im echten Gespraech; waehlt den ersten Knopf, falls eine Wahl kommt. */
function abgeben(h, npc, id) {
  return h.run(`(function () {
    var sc = ${HUB}, qs = window.questSystem;
    var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
    if (!n) return { fehler: '${npc} fehlt im Hub' };
    var orig = sc._showDialoguePages, aufrufe = [];
    sc._showDialoguePages = function (d, t, pages, mode, q, i) { aufrufe.push({ t: t, pages: pages, mode: mode, q: q, i: i }); return orig.apply(this, arguments); };
    try {
      sc._dialogOpen = false;
      sc._showNpcDialogue(n.data);
      var a = aufrufe[0];
      if (!a || a.mode !== 'turnin') return { fehler: 'kein Abgabegespraech: ' + (a && a.mode) };
      var wi = a.pages.findIndex(function (p) { return p._choiceConfig; });
      var knoepfe = null;
      if (wi >= 0) {
        orig.call(sc, n.data, a.t, a.pages, a.mode, a.q, wi);
        var panel = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0];
        if (!panel) return { fehler: 'DialogChoice erscheint nicht' };
        var tasten = panel.list.filter(function (o) { return o.type === 'Text' && o.input; });
        knoepfe = tasten.map(function (o) { return o.text; });
        tasten[0].emit('pointerup');
      }
      var b = aufrufe[aufrufe.length - 1];
      sc._handleDialogueChoice('complete', n.data, b.t, b.pages, b.mode, b.q, b.pages.findIndex(function (p) { return p._isTurnin; }), []);
      return { wahl: knoepfe, fertig: qs.getCompletedQuests().some(function (q) { return q.id === '${id}'; }) };
    } finally { sc._showDialoguePages = orig; try { sc._closeDialog(null); } catch (e) {} sc._dialogOpen = false; }
  })()`);
}

// --- Hub: ?autostart=1&auftrag=thom_gegenedikt&auftragfast=1 ---------------------

test('Hub: die Flagge stellt den Stand her, die echte Presse macht ihn fertig, Thom nimmt ab', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem, S = window.storySystem, d = qs.getQuestSaveData();
    return { truth: (d.quests.thom_truth || {}).status, akt: S.getCurrentActIndex(), max: window.Persistence.getMaxDepth(),
      story: S.getStorySaveData(), blaetter: window.PrintingHouse.getDruckblaetter(), offen: window.PrintingHouse.isUnlocked() };
  })()`);
  assert.deepStrictEqual(stand(H, 'thom_gegenedikt'), { status: 'active', ziele: '0/1', bereit: false });
  assert.strictEqual(r.truth, 'completed', 'der Vorgaenger fehlt');
  assert.strictEqual(r.akt, 3);
  assert.ok(r.max >= 16, 'erreichte Tiefe ' + r.max + ' unter angebotAb 16');
  assert.ok(r.story.eventsSeen.includes('wahrheit') && !r.story.pendingEvent, 'die Aktkarte deckt den Hub zu: ' + JSON.stringify(r.story));
  assert.ok(r.offen && r.blaetter >= 5, 'die Presse ist nicht bereit: ' + JSON.stringify(r));
  assert.strictEqual(H.run(`window.PrintingHouse.publishEdict('open_rebellion').success`), true);
  assert.strictEqual(stand(H, 'thom_gegenedikt').bereit, true, 'das riskante Edikt zaehlt nicht');
  const ab = abgeben(H, 'thom', 'thom_gegenedikt');
  assert.ok(!ab.fehler, ab.fehler);
  assert.strictEqual(ab.fertig, true);
});

test('Die Flagge wirkt einmal pro Laden, nicht bei jedem Hub-Eintritt', () => {
  assert.strictEqual(H.run('window.DebugAuftrag.anwenden()'), null);
  assert.strictEqual(status(H, 'thom_gegenedikt'), 'completed', 'der abgegebene Auftrag wurde neu angenommen');
});

// Je Auftrag: was erledigt sein muss, welche Flagge, welcher Akt, welche Tiefe.
const FAELLE = [
  { id: 'klerus_brueder', fertig: ['klerus_district_purge'], akt: 3, tiefe: 15, flags: { enttarnt: false } },
  { id: 'mara_kreide', fertig: ['mara_warning', 'mara_contact', 'espionage_convoy'], akt: 3, tiefe: 18 },
  { id: 'wache_helm', fertig: [], akt: 3, tiefe: 24, flags: { enttarnt: true } },
  { id: 'mara_letzte_fuhre', fertig: ['was_der_rauch_behaelt', 'espionage_informant'], akt: 4, tiefe: 28 },
  { id: 'branka_schmiede_halten', fertig: ['bruch_confrontation', 'elara_second_truth', 'thom_truth'], akt: 3, tiefe: 27, flags: { enttarnt: true } },
  // Story-Auftrag mit Tor ueber eine Flagge, ohne Vorgaenger.
  { id: 'espionage_archive', fertig: [], akt: 3, tiefe: 12, flags: { elara_ist_lene: true } },
];

FAELLE.forEach((f) => {
  test('Stand fuer ' + f.id + ': Vorgaenger, Flaggen, Akt, Tiefe, aktiv mit Zielen auf 0', () => {
    leeren(H);
    const r = H.run(`(function () {
      var res = window.DebugAuftrag.standSetzen('${f.id}');
      var qs = window.questSystem, d = qs.getQuestSaveData();
      return { res: res, quests: d.quests, flags: qs.getFlags(), akt: window.storySystem.getCurrentActIndex(),
        max: window.Persistence.getMaxDepth() };
    })()`);
    assert.ok(r.res, 'standSetzen lieferte nichts');
    const q = r.quests[f.id];
    assert.strictEqual(q.status, 'active');
    assert.ok(q.objectives.every((o) => o.current === 0), JSON.stringify(q.objectives));
    f.fertig.forEach((v) => assert.strictEqual((r.quests[v] || {}).status, 'completed', v + ' nicht erledigt'));
    Object.keys(f.flags || {}).forEach((k) => assert.strictEqual(!!r.flags[k], f.flags[k], 'Flagge ' + k));
    assert.ok(r.akt >= f.akt, 'Akt ' + r.akt + ' statt ' + f.akt);
    assert.ok(r.max >= f.tiefe, 'Tiefe ' + r.max + ' statt ' + f.tiefe);
  });
});

test('auftragfast: alle Ziele bis auf das letzte; ein Schritt, dann zeigt die Abgabe die Wahl', () => {
  leeren(H);
  H.run(`window.DebugAuftrag.standSetzen('klerus_brueder', { fast: true })`);
  assert.deepStrictEqual(stand(H, 'klerus_brueder'), { status: 'active', ziele: '2/3', bereit: false });
  H.run(`(function () { window.DUNGEON_DEPTH = 15; window.questSystem.updateQuestProgress('kill', 'typ_13', 1); })()`);
  assert.strictEqual(stand(H, 'klerus_brueder').bereit, true);
  const ab = abgeben(H, 'klerus_priester', 'klerus_brueder');
  assert.ok(!ab.fehler, ab.fehler);
  assert.ok(ab.wahl && ab.wahl.includes('Den schweren Ring Thom zustecken'), 'keine Wahl: ' + JSON.stringify(ab.wahl));
  assert.strictEqual(ab.fertig, true);
});

test('Elaras Kellerauftrag: ihre frueheren Auftraege sind erledigt, sonst kaeme sie mit denen', () => {
  leeren(H);
  const r = H.run(`(function () {
    window.DebugAuftrag.standSetzen('elara_schloesser');
    var d = window.questSystem.getQuestSaveData().quests;
    return { liste: window.ELARA_AUFTRAEGE.map(function (id) { return [id, (d[id] || {}).status]; }),
      angebot: window.questSystem.getAvailableQuests('elara').map(function (q) { return q.id; }),
      versteck: window.versteckBesuchFaellig() };
  })()`);
  r.liste.forEach(([id, st]) => assert.strictEqual(st, id === 'elara_schloesser' ? 'active' : 'completed', id));
  assert.deepStrictEqual(Array.from(r.angebot), [], 'Elara bietet noch an: ' + r.angebot);
  assert.strictEqual(r.versteck, null, 'ein Versteck-Besuch belegt den naechsten Raum');
});

test('Ohne debug=1 (und nicht lokal) tut die Flagge nichts', () => {
  leeren(H);
  const vorher = H.run('JSON.stringify(window.questSystem.getQuestSaveData())');
  const r = mitAdresse(H, '?auftrag=wache_helm&auftragfast=1', 'fogreach.example', 'return window.DebugAuftrag.anwenden();');
  assert.strictEqual(r.offen, false, 'das Tor liess sich nicht schliessen — der Test prueft nichts');
  assert.strictEqual(r.r, null);
  assert.strictEqual(H.run('JSON.stringify(window.questSystem.getQuestSaveData())'), vorher, 'der Stand hat sich geaendert');
  // Gegenprobe: dieselbe Adresse mit ?debug=1 wirkt.
  const mit = mitAdresse(H, '?debug=1&auftrag=wache_helm', 'fogreach.example', 'return window.DebugAuftrag.anwenden();');
  assert.strictEqual(mit.offen, true);
  assert.strictEqual(status(H, 'wache_helm'), 'active');
});

test('Eine ungueltige ID warnt auf der Konsole und aendert nichts', () => {
  leeren(H);
  const vorher = H.run('JSON.stringify(window.questSystem.getQuestSaveData())');
  const akt = H.run('window.storySystem.getCurrentActIndex()');
  const r = mitAdresse(H, '?debug=1&auftrag=gibt_es_nicht', null, 'return window.DebugAuftrag.anwenden();');
  assert.strictEqual(r.r, null);
  assert.match(r.gesagt, /gibt_es_nicht/, 'keine Warnung: ' + r.gesagt);
  assert.strictEqual(H.run('JSON.stringify(window.questSystem.getQuestSaveData())'), vorher);
  assert.strictEqual(H.run('window.storySystem.getCurrentActIndex()'), akt);
});

test('Die Flaggen stehen in der Liste des Gates', () => {
  const quelle = require('fs').readFileSync('js/debugGate.js', 'utf8');
  const block = quelle.slice(quelle.indexOf('BEKANNTE_FLAGGEN'), quelle.indexOf('];', quelle.indexOf('BEKANNTE_FLAGGEN')));
  ['auftrag', 'auftragfast', 'kreide'].forEach((f) => assert.ok(block.indexOf("'" + f + "'") >= 0, f + ' fehlt'));
});

// --- Keller: ?dungeon=21&auftrag=elara_schloesser&auftragfast=1&event=chain_lock ---

test('Mit ?dungeon=N steht der Stand, bevor der Keller beginnt; Schloss loesen, Elara nimmt ab', () => {
  const r = JSON.parse(K.run(`JSON.stringify({ tiefe: window.DUNGEON_DEPTH, akt: window.storySystem.getCurrentActIndex() })`));
  assert.deepStrictEqual(r, { tiefe: 21, akt: 3 });
  assert.deepStrictEqual(stand(K, 'elara_schloesser'), { status: 'active', ziele: '2/3', bereit: false });
  K.run(`window._playerInvincible = true;
    window.Kettenschloss.spiele = function (sc, tiefe, fertig) { fertig({ gesetzt: 3, anzahl: 3, geschafft: true, verloren: false }); };`);
  K.run(`enterRoom(${GS}, 1)`);
  let schloss = false;
  for (let i = 0; i < 40 && !schloss; i++) {
    K.step(10);
    schloss = K.run(`${GS}.children.list.some(function (x) { return x.texture && x.texture.key === 'evt_schloss' && x.active; })`);
  }
  assert.ok(schloss, '?event=chain_lock stellt kein Schloss');
  K.run(`(function () { var o = ${GS}.children.list.filter(function (x) { return x.texture && x.texture.key === 'evt_schloss' && x.active; }).pop();
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    player.body.reset(o.x + 30, o.y); })()`);
  K.step(2); K.input.interact(); K.step(3); K.input.releaseAll();
  assert.strictEqual(stand(K, 'elara_schloesser').bereit, true, 'das geloeste Schloss zaehlt nicht');
  const ab = K.run(`(function () {
    var sc = ${GS}, orig = window._spawnElaraSprite, gefunden = null;
    window._spawnElaraSprite = function (s, stage) { gefunden = stage; };
    try { for (var r = 2; r < 40 && !gefunden; r++) _elaraSpaetereAuftraege(sc, r); } finally { window._spawnElaraSprite = orig; }
    if (!gefunden) return null;
    var echt = window.EventSystem.showEventChoiceDialog, erst = true;
    window.EventSystem.showEventChoiceDialog = function (s, t, wahl) { if (erst) { erst = false; wahl[0].callback(); } };
    try { _showElaraDialog(sc, gefunden); } finally { window.EventSystem.showEventChoiceDialog = echt; }
    return { id: gefunden.id, modus: gefunden.modus };
  })()`);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ab)), { id: 'elara_schloesser', modus: 'abgabe' });
  assert.strictEqual(status(K, 'elara_schloesser'), 'completed');
});

test('?kreide=1 stellt in jedem Raum ein Kreidezeichen, ohne die Flagge entscheidet der Wurf', () => {
  K.run(`window.DebugAuftrag.standSetzen('mara_kreide')`);
  const wurf = (such) => mitAdresse(K, such, null, `
    var echt = Math.random; Math.random = function () { return 0.99; };
    try { return !!window.Kreidezeichen.vielleichtSpawnen(${GS}); } finally { Math.random = echt; }`).r;
  assert.strictEqual(wurf('?debug=1&kreide=1'), true, 'mit ?kreide=1 kein Zeichen');
  assert.strictEqual(wurf('?debug=1'), false, 'ohne Flagge trotz Fehlwurf ein Zeichen');
});
