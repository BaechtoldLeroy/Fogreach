// tests/einfuehrungAuftraege.test.js — die neuen Einfuehrungen am echten Spiel.
//
// "Deine Akte" (Charakterwerte, Taste C), der zweite Schritt von "Wofuer du
// taugst" (eine Faehigkeit auf eine Taste legen), "Was sich lohnt
// aufzuheben" (Truhe) und der Einstellungs-Hinweis am Ende des Tutorials.
//
// Geprueft am VERHALTEN: jeder Weg, auf dem der Spieler die Handlung
// ausfuehrt, einzeln — ein Ziel, das nur ueber einen von drei Wegen gemeldet
// wird, ist fuer zwei Drittel der Spieler unabschliessbar. Und umgekehrt:
// was der Spieler NICHT getan hat (Laden, automatisches Lernen), zaehlt nicht.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

/** Quest-Stand setzen: { id: status } bzw. { id: { status, objectives } }. */
const STAND = (eintraege) => `(function () {
  var qs = window.questSystem, st = qs.getQuestSaveData();
  st.quests = {}; st.flags = {};
  var e = ${JSON.stringify(eintraege)};
  Object.keys(e).forEach(function (id) {
    var v = e[id];
    if (typeof v === 'string') {
      var d = qs.QUEST_DEFINITIONS[id];
      v = { status: v, objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: v === 'completed' ? o.required : 0, required: o.required }; }) };
    }
    st.quests[id] = v;
  });
  qs.loadQuestSaveData(st);
  return true;
})()`;

/** Ziele eines laufenden Auftrags als "ziel:stand,…". */
const ZIELE = (id) => `(function () {
  var q = window.questSystem.getActiveQuests().filter(function (x) { return x.id === '${id}'; })[0];
  return q ? q.objectives.map(function (o) { return o.target + ':' + o.current; }).join(',') : 'nicht aktiv';
})()`;

const STATS_ZU = `(function () { if (window.HUDv2._statsContainer) window.HUDv2._statsContainer.close(); return true; })()`;

describe('Im Hub', () => {
  let H = null;
  const hub = `window.game.scene.getScene('HubSceneV2')`;

  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
    H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
    H.step(20);
    H.run(`(function () { var sc = ${hub}; if (sc._closeDialog) { try { sc._closeDialog([]); } catch (e) {} } sc._dialogOpen = false; })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  /** Was Aldric (bzw. eine Figur) beim Ansprechen sagt: Modus, Auftrag, Seiten. */
  function gespraech(npc) {
    return H.run(`(function () {
      var sc = ${hub};
      var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
      if (!n) return { fehler: '${npc} fehlt' };
      var orig = sc._showDialoguePages, fang = null;
      sc._showDialoguePages = function (d, t, pages, mode, q) {
        if (!fang) fang = { mode: mode, quest: q ? q.id : null, texte: pages.map(function (p) { return p.text; }) };
      };
      try { sc._dialogOpen = false; sc._showNpcDialogue(n.data); } finally { sc._showDialoguePages = orig; }
      sc._dialogOpen = false;
      return fang || { mode: 'keiner' };
    })()`);
  }

  // --- Deine Akte ---------------------------------------------------------

  test('Akte: Aldric bietet sie erst nach dem ersten Stufenaufstieg an', () => {
    H.run(STAND({ aldric_cleanup: 'completed', aldric_patrol: 'completed', einfuehrung_talente: 'completed' }));
    H.run('playerLevel = 1; window.playerLevel = 1');
    const vorher = gespraech('aldric');
    assert.notStrictEqual(vorher.quest, 'einfuehrung_akte', 'auf Stufe 1 angeboten');
    H.run('playerLevel = 2; window.playerLevel = 2');
    const nachher = gespraech('aldric');
    assert.strictEqual(nachher.mode, 'offer');
    assert.strictEqual(nachher.quest, 'einfuehrung_akte', 'auf Stufe 2 nicht angeboten: ' + JSON.stringify(nachher));
    assert.match(Array.from(nachher.texte).join('\n'), /Der Rat führt eine Akte über Dich/);
  });


  const AKTE_LAEUFT = { aldric_cleanup: 'completed', einfuehrung_akte: 'active' };

  test('Akte: Taste C im Hub oeffnet die Charakterwerte und erfuellt das Ziel', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:0');
    H.run(`${hub}.input.keyboard.emit('keydown-C', {})`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), true, 'C oeffnet nichts');
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:1');
    // Noch einmal C: schliesst.
    H.run(`${hub}.input.keyboard.emit('keydown-C', {})`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), false, 'C schliesst nicht');
  });

  test('Akte: der Menue-Eintrag "Charakterwerte" erfuellt das Ziel', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    const r = H.run(`(function () {
      var sc = ${hub};
      window.HUDv2.openMenu(sc);
      var lbl = sc.children.list.filter(function (o) { return o.type === 'Text' && o.text === 'Charakterwerte' && o.depth === 2503; })[0];
      if (!lbl) return 'kein Eintrag';
      var knopf = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.input && o.depth === 2502 && Math.abs(o.y - lbl.y) < 1; })[0];
      if (!knopf) return 'kein Knopf';
      knopf.emit('pointerdown');
      return 'ok';
    })()`);
    assert.strictEqual(r, 'ok');
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:1');
    H.run(STATS_ZU);
  });

  test('Akte: der Knopf im Inventar erfuellt das Ziel', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    const r = H.run(`(function () {
      var ui = window.invUI || (typeof invUI !== 'undefined' ? invUI : null);
      if (!ui || !ui.statsBtn) return 'kein Knopf';
      ui.statsBtn.emit('pointerdown');
      return 'ok';
    })()`);
    assert.strictEqual(r, 'ok');
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:1');
    H.run(STATS_ZU);
  });

  test('Akte: C oeffnet nicht ueber einem offenen Gespraech', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    H.run(`(function () { var sc = ${hub}; sc._dialogOpen = true; sc.input.keyboard.emit('keydown-C', {}); sc._dialogOpen = false; })()`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), false);
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:0');
  });

  test('Akte: im Trailer-Modus tut C nichts', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    H.run(`(function () {
      var echt = window.TrailerModus; window.TrailerModus = { aktiv: function () { return true; } };
      try { ${hub}.input.keyboard.emit('keydown-C', {}); } finally { window.TrailerModus = echt; }
    })()`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), false);
  });

  test('Akte: die Ansicht geht nach einem Szenenwechsel wieder auf', () => {
    // Der Bogen hielt HUDv2._statsContainer, bis man ihn schloss — ging die
    // Szene darunter weg (mit C geoeffnet, dann Treppe), blieb er fuer immer zu.
    H.run(STATS_ZU);
    const r = H.run(`(function () {
      var sc = ${hub};
      // Nicht sc.events.emit('shutdown'): das raeumte den ganzen Hub ab. Nur den
      // Horcher aufrufen, den die Ansicht selbst angemeldet hat.
      var vorher = sc.events.listeners('shutdown');
      window.HUDv2.openStats(sc);
      var neu = sc.events.listeners('shutdown').filter(function (f) { return vorher.indexOf(f) < 0; });
      if (neu.length !== 1) return 'kein eigener shutdown-Horcher: ' + neu.length;
      neu[0]();
      return !!window.HUDv2._statsContainer;
    })()`);
    assert.strictEqual(r, false, 'der Bogen bleibt nach dem Szenenende als offen markiert');
  });

  // --- Wofuer du taugst: Talentpunkt, dann Loadout --------------------------

  const TALENTE_LAEUFT = { aldric_cleanup: 'completed', einfuehrung_talente: 'active' };

  function talentPunktSetzen() {
    return H.run(`(function () {
      var A = window.AbilitySystem;
      ['hammer', 'steelGrasp', 'charge'].forEach(function (id) { try { A.forgetAbility(id); } catch (e) {} });
      var ST = window.SkillTree;
      ST._configureForTest({ skillPoints: 1, ranks: {} });
      var ok = ST.investPoint('hammer', 5);
      return { ok: ok, gelernt: A.isLearned('hammer'), slot: A.getSlotForAbility('hammer') };
    })()`);
  }

  test('Loadout: der Talentpunkt allein erfuellt den Auftrag nicht — Lernen legt nichts auf eine Taste', () => {
    H.run(STAND(TALENTE_LAEUFT));
    const r = talentPunktSetzen();
    assert.strictEqual(r.ok, true, 'investPoint ging nicht');
    assert.strictEqual(r.gelernt, true, 'die Faehigkeit wurde nicht gelernt');
    assert.strictEqual(H.run(ZIELE('einfuehrung_talente')), 'talent:1,loadout:0');
    assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('einfuehrung_talente')`), false);
    // Laden/automatisches Belegen (AbilitySystem.setSlot direkt) zaehlt nicht.
    H.run(`window.AbilitySystem.setSlot('slot1', 'hammer')`);
    assert.strictEqual(H.run(ZIELE('einfuehrung_talente')), 'talent:1,loadout:0');
    H.run(`window.AbilitySystem.setSlot('slot1', null)`);
  });

  test('Loadout: Aldric spricht nach dem Punkt vom naechsten Schritt', () => {
    H.run(STAND(TALENTE_LAEUFT));
    const vorher = gespraech('aldric');
    assert.strictEqual(vorher.mode, 'progress');
    assert.match(Array.from(vorher.texte).join(' '), /Noch immer unbestimmt/);
    talentPunktSetzen();
    const nachher = gespraech('aldric');
    assert.match(Array.from(nachher.texte).join(' '),
      /Ein Werkzeug, das Du nicht griffbereit hast, ist kein Werkzeug\. Leg es auf eine Taste/i);
    assert.match(Array.from(nachher.texte).join(' '), /0\/1/, 'der Fortschritt zeigt nicht das offene Ziel');
  });

  test('Loadout: eine Faehigkeit im Loadout (K) auf eine Taste legen erfuellt den Auftrag', () => {
    H.run(STAND(TALENTE_LAEUFT));
    talentPunktSetzen();
    const r = H.run(`(function () {
      var sc = ${hub};
      sc._dialogOpen = false; sc._loadoutSuppressUntil = 0;
      if (sc._loadoutContainer) { sc._loadoutContainer.destroy(true); sc._loadoutContainer = null; }
      sc.input.keyboard.emit('keydown-K', {});
      if (!sc._loadoutContainer) return 'K oeffnet nichts ' + JSON.stringify({ d: sc._dialogOpen, n: sc.time.now, s: sc._loadoutSuppressUntil, l: sc.listenerCount ? 0 : 0, k: sc.input.keyboard.listenerCount('keydown-K') });
      var z = sc.children.list.filter(function (o) { return o._loadout && o._loadout.art === 'pool' && o._loadout.id === 'hammer'; })[0];
      if (!z) return 'keine Zone';
      z.emit('pointerdown');
      var zu = sc.children.list.filter(function (o) { return o._loadout && o._loadout.art === 'close'; })[0];
      if (zu) zu.emit('pointerdown');
      return window.AbilitySystem.getSlotForAbility('hammer') || 'nicht gelegt';
    })()`);
    assert.match(r, /^slot\d$/, r);
    assert.strictEqual(H.run(ZIELE('einfuehrung_talente')), 'talent:1,loadout:1');
    assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('einfuehrung_talente')`), true);
  });

  test('Loadout: die mobile Skill-Auswahl erfuellt den Auftrag ebenfalls', () => {
    H.run(STAND(TALENTE_LAEUFT));
    talentPunktSetzen();
    const r = H.run(`(function () {
      var sc = ${hub};
      window.openSkillSelectionOverlay(sc);
      var slot = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.input && o.depth === 4502 && o.width === 220; })[0];
      if (!slot) return 'kein Slot';
      slot.emit('pointerdown');
      var zeile = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.input && o.depth === 4602 && o.width === 200; })[0];
      if (!zeile) return 'keine Faehigkeit';
      zeile.emit('pointerdown');
      return window.AbilitySystem.getSlotForAbility('hammer') || 'nicht gelegt';
    })()`);
    assert.match(r, /^slot\d$/, r);
    assert.strictEqual(H.run(ZIELE('einfuehrung_talente')), 'talent:1,loadout:1');
  });

  // --- Truhe ----------------------------------------------------------------

  test('Truhe: Branka bietet sie erst nach dem ersten abgeschlossenen Lauf an', () => {
    H.run(STAND({ aldric_cleanup: 'completed', einfuehrung_schmiede: 'completed', einfuehrung_wissen: 'completed' }));
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '1')`);
    const vorher = gespraech('branka');
    assert.notStrictEqual(vorher.quest, 'einfuehrung_truhe', 'vor dem ersten Lauf angeboten');
    H.run(`(window.SlotStorage || localStorage).setItem('demonfall_maxDepth', '2')`);
    const nachher = gespraech('branka');
    assert.strictEqual(nachher.quest, 'einfuehrung_truhe', JSON.stringify(nachher));
    assert.match(Array.from(nachher.texte).join('\n'), /Die Truhe unter der Schmiede gehört Dir/);
  });

  test('Truhe: ein Stueck in die Truhe ziehen erfuellt das Ziel — eine Absage nicht', () => {
    H.run(STAND({ aldric_cleanup: 'completed', einfuehrung_schmiede: 'completed', einfuehrung_truhe: 'active' }));
    const absage = H.run(`(function () {
      var sc = ${hub};
      window.HubTruhe.leeren();
      var mat = { key: 'WPN_EISENKLINGE', type: 'quest_item', name: 'Siegel' };
      window.InventoryGrid.einfuegen(window.inventory, mat);
      window.__mat = mat;
      window.HubTruheUI.oeffne(sc);
      var geo = window.HubTruheUI.geometrie(), Z = window.HubTruheUI.ZELLE;
      var von = { x: geo.inv.x + (mat.gridX + 0.5) * Z, y: geo.inv.y + (mat.gridY + 0.5) * Z };
      var nach = { x: geo.truhe.x + 1.5 * Z, y: geo.truhe.y + 0.5 * Z };
      sc.input.emit('pointerdown', von); sc.input.emit('pointermove', nach); sc.input.emit('pointerup', nach);
      var i = window.inventory.indexOf(mat); if (i >= 0) window.inventory[i] = null;
      return window.HubTruhe.anzahl();
    })()`);
    assert.strictEqual(absage, 0, 'Material kam in die Truhe');
    assert.strictEqual(H.run(ZIELE('einfuehrung_truhe')), 'truhe:0', 'eine Absage zaehlte als Einlagern');

    const r = H.run(`(function () {
      var sc = ${hub};
      var it = { key: 'WPN_EISENKLINGE', type: 'weapon', name: 'Testklinge' };
      window.InventoryGrid.einfuegen(window.inventory, it);
      var geo = window.HubTruheUI.geometrie(), Z = window.HubTruheUI.ZELLE;
      var von = { x: geo.inv.x + (it.gridX + 0.5) * Z, y: geo.inv.y + (it.gridY + 0.5) * Z };
      var nach = { x: geo.truhe.x + 2.5 * Z, y: geo.truhe.y + 1.5 * Z };
      sc.input.emit('pointerdown', von); sc.input.emit('pointermove', nach); sc.input.emit('pointerup', nach);
      var drin = window.HubTruhe.faecher().indexOf(it) >= 0;
      window.HubTruheUI.schliesse();
      return drin;
    })()`);
    assert.strictEqual(r, true, 'das Stueck kam nicht in die Truhe');
    assert.strictEqual(H.run(ZIELE('einfuehrung_truhe')), 'truhe:1');
  });

  // --- Journal-Hinweis in Aldrics erster Abgabe -------------------------------

  test('Journal: Aldrics erste Abgabe nennt das Journal (DE und EN)', () => {
    H.run(STAND({ aldric_cleanup: { status: 'active',
      objectives: [{ type: 'kill', target: 'enemy', current: 10, required: 10 }] } }));
    const de = gespraech('aldric');
    assert.strictEqual(de.mode, 'turnin');
    assert.match(Array.from(de.texte).join('\n'), /steht in Deinem Journal — Taste J oder das Journal-Symbol oben rechts/);
    H.run(`window.i18n.setLanguage('en')`);
    try {
      const en = gespraech('aldric');
      assert.match(Array.from(en.texte).join('\n'), /in your journal - key J or the journal icon/);
    } finally { H.run(`window.i18n.setLanguage('de')`); }
  });

  // --- Einstellungs-Hinweis --------------------------------------------------

  test('Tutorial: der Einstellungs-Hinweis steht im Hub (Desktop mit O, mobil ohne)', () => {
    const r = H.run(`(function () {
      var sc = ${hub};
      var step = window.TutorialSystem._STEPS.filter(function (s) { return s.id === 'settings.hint'; })[0];
      var ov = window.TutorialOverlay.create(sc);
      var lesen = function () {
        ov._renderBanner({ id: step.id, scene: step.scene, hintKey: step.hintKey, targetRef: null });
        var t = '';
        if (ov.banner && ov.banner.text) t = ov.banner.text.text;
        ov._destroyBanner();
        return t;
      };
      var desktop = lesen();
      var vorher = window.isMobile; window.isMobile = true;
      var mobil = lesen();
      window.isMobile = vorher;
      return { desktop: desktop, mobil: mobil };
    })()`);
    assert.match(r.desktop, /Lautstärke, Steuerung und Vollbild: Zahnrad oben rechts \(O\)/);
    assert.match(r.mobil, /Zahnrad oben rechts/);
    assert.ok(!/\(O\)/.test(r.mobil), 'mobil wird eine Taste genannt: ' + r.mobil);
  });
});

describe('Im Dungeon', () => {
  let H = null;
  const gs = `window.game.scene.getScene('GameScene')`;

  before(async () => { H = await launchDungeon({ depth: 1 }); });
  after(async () => { if (H) await H.shutdown(); });

  const AKTE_LAEUFT = { aldric_cleanup: 'completed', einfuehrung_akte: 'active' };

  test('Akte: Taste C im Dungeon oeffnet und schliesst die Charakterwerte und erfuellt das Ziel', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    H.run(`${gs}.input.keyboard.emit('keydown-C', {})`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), true, 'C oeffnet im Dungeon nichts');
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:1');
    H.run(`${gs}.input.keyboard.emit('keydown-C', {})`);
    assert.strictEqual(H.run('!!window.HUDv2._statsContainer'), false, 'C schliesst im Dungeon nicht');
  });

  test('Akte: ein Klick aufs Portraet erfuellt das Ziel', () => {
    H.run(STATS_ZU); H.run(STAND(AKTE_LAEUFT));
    const r = H.run(`(function () {
      var sc = ${gs};
      var p = sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.input && o.x < 80 && o.y < 80 && o.width === o.height && o.width > 30;
      })[0];
      if (!p) return 'kein Portraet';
      p.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} });
      return 'ok';
    })()`);
    assert.strictEqual(r, 'ok');
    assert.strictEqual(H.run(ZIELE('einfuehrung_akte')), 'charakterwerte:1');
    H.run(STATS_ZU);
  });

  test('Tutorial: Beute waehrend "angreifen" zieht "aufheben" sofort vor — ueber den echten spawnLoot', () => {
    const r = H.run(`(function () {
      var TS = window.TutorialSystem, sc = ${gs};
      // Eigene Uhr: movement verlangt 5 s Anzeige, headless steht Date.now fast still.
      var uhr = 0;
      TS._configureForTest({ now: function () { uhr += 10000; return uhr; } });
      TS.init();
      TS.replay();
      TS.report('player.moved', {});
      TS.report('dialog.opened', { npc: 'aldric' });
      TS.report('hub.entrance.entered', { name: 'rathaus_entrance' });
      var vor = TS.getCurrentStep().id;
      window.spawnLoot.call(sc, player.x + 60, player.y, window.LootSystem.rollItem('WPN_EISENKLINGE', 1));
      var nach = TS.getCurrentStep().id;
      TS.report('loot.picked', {});
      TS.report('inventory.equipped', {});
      var zurueck = TS.getCurrentStep().id;
      TS.report('combat.hit', { byPlayer: true });
      var weiter = TS.getCurrentStep().id;
      TS.skip(true);
      return [vor, nach, zurueck, weiter].join(' > ');
    })()`);
    assert.strictEqual(r, 'combat.basics > loot.pickup > combat.basics > combat.potion');
  });
});
