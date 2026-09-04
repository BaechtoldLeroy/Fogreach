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

// (#83 ist behoben — der Regressionstest steht am Dateiende, weil er den
//  Quest-Stand veraendert.)

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


// #83 steht bewusst HIER unten, nicht bei den uebrigen Hub-Tests: er nimmt zwei
// Vorbedingungs-Quests an und schliesst sie ab, veraendert also den geteilten
// Quest-Stand. Mitten in der Datei platziert hat er den #84-Test darunter
// verfaelscht (convoy_blown schlug ploetzlich um). Gleiche Begruendung wie beim
// #100-Test daneben.
test('hub: Abschluss von elara_second_truth setzt three_hands_seen (#83)', () => {
  // Der Flag wird beim ABSCHLUSS gesetzt (completionFlags, questSystem.js:1496),
  // nicht schon beim Fortschritt. Der Test durchlaeuft deshalb den echten Weg:
  // annehmen -> Objective erfuellen -> abschliessen. Die Vorgaengerfassung
  // feuerte nur updateQuestProgress und haette am Fix vorbeigeprueft.
  const res = H.run(`(function () {
    var qs = window.questSystem;
    var id = 'elara_second_truth';
    ['thom_truth', 'elara_ritual'].forEach(function (v) {
      if (qs.QUEST_DEFINITIONS[v]) { qs.acceptQuest(v); qs.completeQuest(v); }
    });
    var vorher = !!qs.getFlags().three_hands_seen;
    qs.acceptQuest(id);
    qs.updateQuestProgress('observe', 'three_hands_seen', 1);
    var fertig = qs.completeQuest(id);
    var flags = qs.getFlags();
    return { vorher: vorher, fertig: fertig, flag: !!flags.three_hands_seen,
             regler: window.QuestFinale.computeFinaleState(flags).betrayalForeseen };
  })()`);
  assert.strictEqual(res.vorher, false, 'Flag darf vorher nicht gesetzt sein');
  assert.strictEqual(res.fertig, true, 'Quest liess sich nicht abschliessen: ' + JSON.stringify(res));
  assert.strictEqual(res.flag, true, 'three_hands_seen wurde beim Abschluss nicht gesetzt');
  assert.strictEqual(res.regler, true, 'Finale-Regler bleibt false');
});
test('hub: ein Aktwechsel zieht das Phasen-Overlay sofort nach', async () => {
  // Vorher wurde die Phase EINMAL in create() berechnet. Wechselte der Akt,
  // waehrend man im Hub stand, blieb das alte Overlay stehen — es kam erst
  // beim naechsten Betreten des Hubs. Dieselbe Ursache liess den Hub nach
  // einem Neustart ganz ohne Overlay dastehen: create() rechnete, bevor der
  // Spielstand angewendet war, und sah darum immer Akt 0.
  const zustand = () => H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    return { phase: sc._hubPhase,
             objekte: sc._hubPhaseViewObjs ? sc._hubPhaseViewObjs.length : 0 };
  })()`);

  // Die Pruefung laeuft gedrosselt (400 ms Wanduhr) — also echte Zeit
  // verstreichen lassen und danach takten.
  const nachziehen = async () => {
    await new Promise((r) => setTimeout(r, 450));
    H.step(5);
  };

  H.run(`(function () {
    window.questSystem.setFlag('story_ending', false);
    window.storySystem.resetToAct0();
  })()`);
  await nachziehen();
  assert.strictEqual(zustand().phase, 'council', 'Ausgangslage');

  H.run(`window.storySystem.advanceToAct(2)`);
  await nachziehen();
  const doppelt = zustand();
  assert.strictEqual(doppelt.phase, 'doubleAgent', 'Akt 2 ohne Hubwechsel');
  assert.ok(doppelt.objekte > 0, 'kein Overlay aufgebaut: ' + doppelt.objekte);

  H.run(`window.storySystem.advanceToAct(4)`);
  await nachziehen();
  assert.strictEqual(zustand().phase, 'broken', 'Akt 4 ohne Hubwechsel');
});

test('hub: die Truhe laesst sich oeffnen, befuellen und raeumt sich ab (#127)', () => {
  // Die eine Regel, an der alles haengt: ein Stueck liegt nie doppelt. Hier
  // wird sie ueber die ECHTE Oberflaeche geprueft — Zeigerereignisse auf die
  // gerechneten Rasterzellen, nicht die Funktionen direkt.
  const zone = H.run(`(function () {
    var e = window.HUB_HITBOXES.entrances.filter(function (x) { return x.target === 'truhe'; })[0];
    var sc = window.game.scene.getScene('HubSceneV2');
    return { hitbox: !!e, bild: !!sc._truheBild, ui: typeof window.HubTruheUI };
  })()`);
  assert.ok(zone.hitbox, 'keine Truhen-Hitbox im Hub');
  assert.ok(zone.bild, 'die Truhe hat kein Bild — man stuende vor einer unsichtbaren Zone');
  assert.strictEqual(zone.ui, 'object', 'HubTruheUI fehlt');

  const vorher = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruhe.leeren();
    var it = { key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Testklinge' };
    window.InventoryGrid.einfuegen(window.inventory, it);
    window.__truheIt = it;
    var e = window.HUB_HITBOXES.entrances.filter(function (x) { return x.target === 'truhe'; })[0];
    sc._enterLocation(e);
    return { offen: window.HubTruheUI.istOffen(), gesperrt: !!window.eventChoiceOpen,
             objekte: sc.children.list.length };
  })()`);
  assert.strictEqual(vorher.offen, true, 'die Truhe ging nicht auf');
  assert.strictEqual(vorher.gesperrt, true, 'die Eingabe laeuft weiter — man greift beim Umlegen an');

  // Ins Truhenraster ziehen, auf eine BESTIMMTE Zelle.
  const hin = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var geo = window.HubTruheUI.geometrie(), Z = window.HubTruheUI.ZELLE, it = window.__truheIt;
    var von = { x: geo.inv.x + (it.gridX + 0.5) * Z, y: geo.inv.y + (it.gridY + 0.5) * Z };
    var nach = { x: geo.truhe.x + 2.5 * Z, y: geo.truhe.y + 1.5 * Z };
    sc.input.emit('pointerdown', von); sc.input.emit('pointermove', nach); sc.input.emit('pointerup', nach);
    return { imInventar: window.inventory.filter(function (s) { return s === it; }).length,
             inDerTruhe: window.HubTruhe.faecher().filter(function (s) { return s === it; }).length,
             x: it.gridX, y: it.gridY };
  })()`);
  assert.strictEqual(hin.inDerTruhe, 1, 'das Stueck kam nicht in der Truhe an');
  assert.strictEqual(hin.imInventar, 0, 'es liegt DOPPELT — im Inventar und in der Truhe');
  assert.strictEqual(hin.x, 2, 'es landete nicht auf der gezielten Zelle');
  assert.strictEqual(hin.y, 1, 'es landete nicht auf der gezielten Zeile');

  // Und wieder zurueck.
  const zurueck = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var geo = window.HubTruheUI.geometrie(), Z = window.HubTruheUI.ZELLE, it = window.__truheIt;
    var von = { x: geo.truhe.x + (it.gridX + 0.5) * Z, y: geo.truhe.y + (it.gridY + 0.5) * Z };
    var nach = { x: geo.inv.x + 5.5 * Z, y: geo.inv.y + 2.5 * Z };
    sc.input.emit('pointerdown', von); sc.input.emit('pointermove', nach); sc.input.emit('pointerup', nach);
    return { imInventar: window.inventory.filter(function (s) { return s === it; }).length,
             inDerTruhe: window.HubTruhe.faecher().filter(function (s) { return s === it; }).length };
  })()`);
  assert.strictEqual(zurueck.imInventar, 1, 'das Stueck kam nicht zurueck');
  assert.strictEqual(zurueck.inDerTruhe, 0, 'es liegt DOPPELT — in der Truhe und im Inventar');

  const zu = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.schliesse();
    return { offen: window.HubTruheUI.istOffen(), frei: !window.eventChoiceOpen,
             objekte: sc.children.list.length };
  })()`);
  assert.strictEqual(zu.offen, false);
  assert.strictEqual(zu.frei, true, 'die Eingabe bleibt gesperrt — der Hub waere tot');
  assert.ok(zu.objekte < vorher.objekte,
    'das Panel laesst Objekte zurueck: ' + vorher.objekte + ' -> ' + zu.objekte);
});


test('hub: Elara kehrt erst in Akt 5 in den Hub zurueck (#131)', () => {
  // Ihr Layout-Eintrag traegt visibleAfterFlag: 'elaraReturnedToHub' — und
  // diese Flagge wurde im ganzen Projekt NIRGENDS gesetzt. Ein einziges
  // Vorkommen, im Layout selbst.
  //
  // Im Dungeon erscheint sie nur, solange widerstand_proof offen ist — und
  // die MUSS man abschliessen, um Akt 2 zu erreichen (council_collusion_reveal
  // verlangt sie). Ab Akt 2 gab es Elara also nirgends mehr: nicht im Hub,
  // nicht im Dungeon. Mit ihr waren elara_meeting, elara_ritual und
  // elara_second_truth unerreichbar — und damit Akt 5.
  const erg = H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.resetToAct0();
    qs.loadQuestSaveData(qs.getQuestSaveData());
    var inAkt1 = qs.hasFlag('elaraReturnedToHub');
    window.storySystem.advanceToAct(2);
    qs.loadQuestSaveData(qs.getQuestSaveData());
    var inAkt3 = qs.hasFlag('elaraReturnedToHub');
    window.storySystem.advanceToAct(4);
    qs.loadQuestSaveData(qs.getQuestSaveData());   // wie ein geladener Stand
    return { akt1: inAkt1, akt3: inAkt3, akt5: qs.hasFlag('elaraReturnedToHub') };
  })()`);
  assert.strictEqual(erg.akt1, false, 'Elara steht schon in Akt 1 im Hub');
  assert.strictEqual(erg.akt3, false,
    'Elara steht schon waehrend des Doppelspiels offen im Hub — das untergraebt es');
  assert.strictEqual(erg.akt5, true,
    'Elara kommt auch nach dem Fall des Rates nicht in den Hub');
});

test('hub: Elara ist ab Akt 5 im Hub wirklich sichtbar (#131)', () => {
  const erg = H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(4);
    qs.loadQuestSaveData(qs.getQuestSaveData());
    var sc = window.game.scene.getScene('HubSceneV2');
    sc.scene.restart();
    return 1;
  })()`);
  H.step(60);
  const sicht = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var e = sc.children.list.filter(function (o) {
      return o.getData && o.getData('id') === 'elara';
    })[0];
    return { da: !!e, sichtbar: !!(e && e.visible),
             bietet: window.questSystem.getAvailableQuests('elara').map(function (q) { return q.id; }) };
  })()`);
  assert.ok(sicht.da, 'Elara fehlt im Hub ganz');
  assert.strictEqual(sicht.sichtbar, true, 'Elara steht im Hub, ist aber unsichtbar');
  // Was sie im Hub anbietet, ist hier nicht der Punkt — ihre Auftraege vergibt
  // sie im Dungeon (siehe headlessCombat: 'Elara vergibt ihre spaeteren
  // Auftraege im Dungeon'). Hier zaehlt nur, dass sie ueberhaupt dasteht.
});

test('hub: die Tiefe bleibt vor jedem Story-Boss stehen (#131)', () => {
  // Es gab genau EIN Tor — vor dem Kettenmeister auf Tiefe 10. Der Gedanke
  // stimmte, wurde aber nie auf die anderen beiden Bosse uebertragen. Der
  // Zeremonienmeister steht auf Tiefe 20 und dann erst wieder auf 50; wer ihn
  // ohne 'Die Ritualkammer' erschlug, verlor den Weg nach Akt 5 fuer dreissig
  // Tiefen.
  const tore = H.run(`(function () {
    var qs = window.questSystem;
    // Ausgangslage ausdruecklich herstellen: die Faelle davor in dieser Datei
    // nehmen Quests an und schliessen sie ab. Geerbter Zustand wuerde hier
    // messen, was vorher passiert ist, nicht die Regel.
    var stand = qs.getQuestSaveData();
    ['mara_warning', 'elara_ritual', 'schattenrat_finale'].forEach(function (id) {
      stand.quests[id] = { status: 'available', objectives: null };
    });
    qs.loadQuestSaveData(stand);
    var RD = window.RunDepth;
    return {
      t9: RD.torBei(9), t19: RD.torBei(19), t29: RD.torBei(29),
      t15: RD.torBei(15), t20: RD.torBei(20)
    };
  })()`);
  assert.ok(tore.t9 && tore.t9.questId === 'mara_warning', 'Tor auf 9 fehlt');
  assert.ok(tore.t19 && tore.t19.questId === 'elara_ritual',
    'Tor auf 19 fehlt — genau hier ist der Durchgang gescheitert');
  assert.ok(tore.t29 && tore.t29.questId === 'schattenrat_finale', 'Tor auf 29 fehlt');
  assert.strictEqual(tore.t15, null, 'zwischen den Bossen darf nichts sperren');
  assert.strictEqual(tore.t20, null, 'das Tor sitzt VOR dem Boss, nicht auf ihm');
});

test('hub: ein Tor oeffnet sich, sobald sein Auftrag laeuft (#131)', () => {
  const erg = H.run(`(function () {
    var qs = window.questSystem;
    var RD = window.RunDepth;
    var stand = qs.getQuestSaveData();
    stand.quests['elara_ritual'] = { status: 'available', objectives: null };
    qs.loadQuestSaveData(stand);
    var zu = !!RD.torBei(19);
    qs.acceptQuest('elara_ritual');
    return { vorher: zu, nachher: !!RD.torBei(19) };
  })()`);
  assert.strictEqual(erg.vorher, true, 'das Tor war gar nicht zu');
  assert.strictEqual(erg.nachher, false,
    'das Tor bleibt zu, obwohl der Auftrag laeuft — dann kaeme man nie zum Boss');
});

test('hub: die Truhe zeigt Tooltips — mit denselben Texten wie das Inventar (#127)', () => {
  // Der Textaufbau kommt aus window.formatItemTooltip (js/inventory.js). Ein
  // nachgebauter Tooltip waere beim naechsten Affix auseinandergelaufen; hier
  // ist nur der Kasten neu.
  const erg = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruhe.leeren();
    var it = { key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Testklinge', damage: 7 };
    window.InventoryGrid.einfuegen(window.inventory, it);
    var e = window.HUB_HITBOXES.entrances.filter(function (x) { return x.target === 'truhe'; })[0];
    sc._enterLocation(e);
    var geo = window.HubTruheUI.geometrie(), Z = window.HubTruheUI.ZELLE;
    var finde = function () {
      return sc.children.list.filter(function (o) { return o.name === 'TruheTooltip'; })[0];
    };
    // 1) Ueber ein Stueck schweben
    sc.input.emit('pointermove', { x: geo.inv.x + (it.gridX + 0.5) * Z,
                                   y: geo.inv.y + (it.gridY + 0.5) * Z, isDown: false });
    var t = finde();
    var beimSchweben = { da: !!t, sichtbar: !!(t && t.visible),
      texte: t ? t.list.filter(function (o) { return o.type === 'Text'; }).map(function (o) { return o.text; }) : [] };
    // 2) Ueber eine LEERE Zelle
    sc.input.emit('pointermove', { x: geo.truhe.x + 6.5 * Z, y: geo.truhe.y + 1.5 * Z, isDown: false });
    var ueberLeer = !!(finde() && finde().visible);
    // 3) Waehrend des Ziehens
    sc.input.emit('pointerdown', { x: geo.inv.x + (it.gridX + 0.5) * Z, y: geo.inv.y + (it.gridY + 0.5) * Z });
    var beimZiehen = !!(finde() && finde().visible);
    sc.input.emit('pointerup', { x: geo.truhe.x + 1.5 * Z, y: geo.truhe.y + 0.5 * Z });
    var vorher = sc.children.list.length;
    window.HubTruheUI.schliesse();
    return { schweben: beimSchweben, ueberLeer: ueberLeer, beimZiehen: beimZiehen,
             vorher: vorher, nachher: sc.children.list.length };
  })()`);

  assert.ok(erg.schweben.da, 'die Truhe hat gar keinen Tooltip');
  assert.strictEqual(erg.schweben.sichtbar, true, 'der Tooltip erscheint beim Schweben nicht');
  assert.ok(erg.schweben.texte.join(' ').indexOf('Testklinge') >= 0,
    'der Tooltip nennt das Stueck nicht: ' + JSON.stringify(erg.schweben.texte));
  assert.ok(/Seltenheit|Item-St/.test(erg.schweben.texte.join(' ')),
    'der Tooltip nutzt nicht die Formatierung des Inventars');
  assert.strictEqual(erg.ueberLeer, false, 'ueber einer leeren Zelle bleibt der Tooltip stehen');
  assert.strictEqual(erg.beimZiehen, false, 'beim Ziehen steht der Tooltip im Weg');
  assert.ok(erg.nachher < erg.vorher, 'beim Schliessen bleibt etwas zurueck');
});
