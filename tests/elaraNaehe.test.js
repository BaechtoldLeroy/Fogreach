// tests/elaraNaehe.test.js — Elaras ruhige Momente im Dungeon (#155).
//
// Story-Bibel v5, Abschnitt 6: Der Verrat trifft nur, wenn man Elara mag,
// ihr vertraut und mit ihr fuehlt. Vorher gab sie nur Auftraege. Jetzt
// rettet sie den Spieler, zeigt ihm ihr Versteck, spricht ueber den
// Menschen, zu dem sie nicht darf, gibt ihm ein Stueck seiner Vergangenheit
// zurueck und schenkt ihm ihre Klinge.
//
// Geprueft am laufenden Spiel ueber die echten Dungeon-Wege
// (_maybeFireElaraCellarEncounter, _showElaraDialog, _elaraAuftragsDialog).
// Knoepfe werden gedrueckt, nicht Callbacks direkt gerufen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1&dungeon=3', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('GameScene', { maxRounds: 400 }), 'GameScene nicht erreicht');
  H.step(60);
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Den Dialog-Stand pruefen und Knoepfe druecken koennen.
    //
    // Der Text wird mitgeschrieben, wenn er an den Dialog GEHT: auf dem
    // Bildschirm baut er sich Wort fuer Wort auf (#139) und ist beim Nachsehen
    // meist erst angefangen.
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel, wahlen) {
      window.__dialogLog.push(String(titel || ''));
      return echt.apply(this, arguments);
    };
    window.__dialogText = function () {
      return window.__dialogLog.length ? window.__dialogLog[window.__dialogLog.length - 1] : '';
    };
    window.__knoepfe = function () {
      return sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
      });
    };
    window.__klick = function (n) {
      var k = window.__knoepfe()[n || 0];
      if (!k) return false;
      k.emit('pointerdown');
      return true;
    };
    // Einen Dialog ganz durchklicken (immer die erste Wahl).
    window.__durchklicken = function () {
      var n = 0;
      while (window.eventChoiceOpen && n < 20) { if (!window.__klick(0)) break; n++; }
      return n;
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

function stand(quests, flags, akt) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt});
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags)};
    qs.loadQuestSaveData(st);
    window.__durchklicken();
    enemies.clear(true, true);
  })()`);
}

test('Elara rettet den Spieler, wenn er in Bedraengnis geraet', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] } }, {}, 1);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Am ECHTEN Einstieg: enterRoom ruft _maybeFireElaraCellarEncounter, und
    // der stellt die Rettung scharf. Raum >= 2, darunter erscheint sie nie.
    var raum = Math.max(2, (sc.currentRoom && sc.currentRoom.id || 0) + 1);
    enterRoom(sc, raum);
    enemies.clear(true, true);
    // Ein Gegner nah am Spieler, einer weit weg.
    var nah = spawnEnemy.call(sc, 0, 0, 8), fern = spawnEnemy.call(sc, 0, 0, 8);
    nah.x = player.x + 60; nah.y = player.y;
    // Der ferne Gegner an einen ERREICHBAREN Punkt im Raum, ausserhalb des
    // Nebels. Fest "x + 700" lag je nach Raum ausserhalb und wurde entfernt;
    // eine feste Mindestweite von 400 px gab es in kleinen Raeumen nicht.
    var weit = null, weiteste = 0;
    for (var v = 0; v < 60; v++) {
      var p = sc.pickAccessibleSpawnPoint ? sc.pickAccessibleSpawnPoint({ maxAttempts: 8 }) : null;
      var d = p ? Math.hypot(p.x - player.x, p.y - player.y) : 0;
      if (d > weiteste) { weiteste = d; weit = p; }
    }
    if (!weit || weiteste <= ELARA_RETTUNG_RADIUS + 30) return { fehler: 'kein Punkt ausserhalb des Nebels im Raum (weitester ' + Math.round(weiteste) + ' px)' };
    fern.x = weit.x; fern.y = weit.y;
    [nah, fern].forEach(function (g) { if (g.body) { g.body.reset(g.x, g.y); g.body.moves = false; } g.hp = 9999; });
    window.__nah = nah; window.__fern = fern;
    playerHealth = Math.floor(playerMaxHealth * 0.4);
    return raum;
  })()`);
  assert.ok(!(r && r.fehler), r && r.fehler);
  H.step(30);
  const a = H.run(`({ offen: !!window.eventChoiceOpen, text: window.__dialogText(),
    rettung: window.questSystem.hasFlag('elara_rettung_gesehen') })`);
  assert.strictEqual(a.offen, true, 'bei 40 % Leben kam kein Dialog');
  assert.strictEqual(a.rettung, true, 'die Rettung wurde nicht gespielt');
  assert.ok(/Nebel/.test(a.text), 'der Dialog erzaehlt keine Rettung: ' + a.text);
  // Durchklicken: Rettung, Antwort, dann ihr Auftrag.
  H.run('window.__durchklicken()');
  // Die Gegner blenden per Tween aus; im Testkopf braucht das mehr Bilder
  // als die 450 ms vermuten lassen (gemessen: nach 40 Bildern Alpha 0,31).
  H.step(120);
  const b = H.run(`({ nah: !!(window.__nah && window.__nah.active), fern: !!(window.__fern && window.__fern.active),
    getroffen: window.questSystem.hasFlag('elaraMet'),
    auftrag: window.questSystem.getActiveQuests().map(function (q) { return q.id; }) })`);
  assert.strictEqual(b.nah, false, 'der Gegner neben dem Spieler steht noch');
  assert.strictEqual(b.fern, true, 'der Nebel hat auch den weit entfernten Gegner geholt');
  assert.strictEqual(b.getroffen, true, 'nach der Rettung gilt Elara nicht als getroffen');
  assert.ok(Array.from(b.auftrag).indexOf('widerstand_proof') >= 0, 'ihr erster Auftrag wurde nicht vergeben');
});

test('Ohne Not erscheint sie wie bisher, ohne Rettung', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] } }, {}, 1);
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0'; })
      .forEach(function (o) { try { o.destroy(); } catch (e) {} });
    playerHealth = playerMaxHealth;
    _elaraRettungScharfstellen(sc, sc.currentRoom.id);
  })()`);
  // Den Raum waehrend des Wartens leer halten: die Welle des Raums kann
  // nachspawnen, und dann waere er nicht "geraeumt".
  for (let i = 0; i < 6; i++) {
    H.run('enemies.clear(true, true)');
    H.step(20);
  }
  const r = H.run(`({ da: window.game.scene.getScene('GameScene').children.list.some(function (o) { return o.texture && o.texture.key === 'elara_right0'; }),
    offen: !!window.eventChoiceOpen, rettung: window.questSystem.hasFlag('elara_rettung_gesehen') })`);
  assert.strictEqual(r.da, true, 'in einem leeren Raum erscheint sie nicht');
  assert.strictEqual(r.offen, false, 'ohne Not oeffnet sich trotzdem ein Dialog');
  assert.strictEqual(r.rettung, false, 'ohne Not wurde eine Rettung gespielt');
});

test('Nach dem Ratsdokument zeigt sie ihr Versteck', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] },
          widerstand_proof: { status: 'active', objectives: [{ type: 'fetch', target: 'council_document', current: 1, required: 1 }] } },
        { elaraMet: true }, 1);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    _showElaraDialog(sc, 2);
    window.__klick(0);                       // Uebergabe bestaetigen
    var text = window.__dialogText();
    window.__durchklicken();
    return { text: text, fertig: window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'widerstand_proof'; }),
             versteck: window.questSystem.hasFlag('elara_versteck_gesehen') };
  })()`);
  assert.strictEqual(r.fertig, true, 'die Uebergabe schliesst den Auftrag nicht ab');
  assert.strictEqual(r.versteck, true, 'das Versteck wurde nicht gezeigt');
  assert.ok(/Spalt|crack/.test(r.text), 'der Dialog nach der Uebergabe ist nicht das Versteck: ' + r.text);
});

test('Das Buendel ist ihr naechster Auftrag, und danach spricht sie ueber ihre Familie', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] },
          widerstand_proof: { status: 'completed', objectives: [] } },
        { elaraMet: true }, 1);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem;
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'resistance_fetch_01'; })[0];
    var erster = ELARA_AUFTRAEGE[0];
    qs.acceptQuest('resistance_fetch_01');
    qs.updateQuestProgress('fetch', 'sealed_bundle', 1);
    var bereit = qs.isQuestReadyToComplete('resistance_fetch_01');
    var aktiv = qs.getActiveQuests().filter(function (q) { return q.id === 'resistance_fetch_01'; })[0];
    _elaraAuftragsDialog(sc, { id: 'resistance_fetch_01', modus: 'abgabe', quest: aktiv }, 'Weiter', false);
    var abgabeText = window.__dialogText();
    window.__klick(0);
    var familie = window.__dialogText();
    window.__durchklicken();
    return { erster: erster, angeboten: !!angebot, bereit: bereit, abgabeText: abgabeText, familie: familie,
             flag: qs.hasFlag('elara_familie_gehoert') };
  })()`);
  assert.strictEqual(r.erster, 'resistance_fetch_01', 'das Buendel steht nicht vorn in ihrer Reihe');
  assert.strictEqual(r.angeboten, true, 'das Buendel wird in Akt 1 nicht angeboten');
  assert.strictEqual(r.bereit, true, 'mit dem Buendel ist der Auftrag nicht abgabebereit — er haengt nicht am Fund');
  assert.ok(/drei Ketten/.test(r.abgabeText), 'das Siegel zeigt nicht das Zeichen: ' + r.abgabeText);
  assert.ok(/Licht ins Fenster/.test(r.familie), 'nach der Abgabe kam nicht die Familien-Szene: ' + r.familie);
  assert.strictEqual(r.flag, true);
});

test('Die Klinge bekommt man in Akt 3 im Dungeon, in einem Gespraech', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] },
          widerstand_proof: { status: 'completed', objectives: [] },
          resistance_fetch_01: { status: 'completed', objectives: [] },
          elara_meeting: { status: 'completed', objectives: [] },
          elara_ritual: { status: 'completed', objectives: [] } },
        { elaraMet: true }, 3);
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem;
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'elara_blade'; })[0];
    if (!angebot) return { fehler: 'elara_blade wird in Akt 3 nicht angeboten' };
    _elaraAuftragsDialog(sc, { id: 'elara_blade', modus: 'angebot', quest: angebot }, 'Weiter', false);
    window.__klick(0);
    var szene = window.__dialogText();
    window.__durchklicken();
    return { fertig: qs.getCompletedQuests().some(function (q) { return q.id === 'elara_blade'; }),
             szene: szene, flag: qs.hasFlag('elara_klinge_erhalten') };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.fertig, true, 'die Klinge wurde nicht in diesem Gespraech uebergeben');
  assert.ok(/eingraviert|engraved/.test(r.szene), 'die Klingen-Szene zeigt die Gravur nicht: ' + r.szene);
  assert.strictEqual(r.flag, true);
});
