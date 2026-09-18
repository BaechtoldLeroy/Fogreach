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

/** Betritt einen frischen Raum mit der angegebenen Nummer (ueber enterRoom). */
function raumBetreten(nummer) {
  return H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__durchklicken();
    enterRoom(sc, ${nummer});
    return sc.currentRoom.id;
  })()`);
}

function hinterhaltGegner() {
  return H.run(`(function () {
    var n = 0, kette = 0;
    enemies.getChildren().forEach(function (e) {
      if (e && e.active && e._hinterhalt) { n++; if (e.isChainGuard) kette++; }
    });
    return { n: n, kette: kette };
  })()`);
}

test('Der Hinterhalt: ab Raum 3 stellt die Kettenwache den Spieler, Elara rettet ihn', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] } }, {}, 1);
  H.run('playerHealth = playerMaxHealth; window._playerInvincible = false;');
  raumBetreten(3);
  H.step(10);
  const g = hinterhaltGegner();
  assert.strictEqual(g.n, 4, g.n + ' Gegner im Hinterhalt statt 4');
  assert.strictEqual(g.kette, 4, 'der Hinterhalt besteht nicht aus Kettenwachen');

  // Sterben kann man hier nicht: ein Treffer, der toeten wuerde, wird abgefangen.
  const schutz = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var angreifer = enemies.getChildren().filter(function (e) { return e && e._hinterhalt; })[0];
    playerHealth = 3;
    applyPlayerDamage(500, sc, angreifer);
    return playerHealth;
  })()`);
  assert.ok(schutz >= 1, 'ein Treffer im Hinterhalt hat den Spieler getoetet (LP ' + schutz + ')');

  H.step(5);
  const a = H.run(`({ offen: !!window.eventChoiceOpen, text: window.__dialogText(),
    rettung: window.questSystem.hasFlag('elara_rettung_gesehen') })`);
  assert.strictEqual(a.offen, true, 'in Not kam keine Rettung');
  assert.strictEqual(a.rettung, true);
  assert.ok(/Kettenwache/.test(a.text), 'die Rettung erzaehlt nicht vom Hinterhalt: ' + a.text);

  H.run('window.__durchklicken()');
  H.step(120);
  const b = H.run(`({ rest: enemies.getChildren().filter(function (e) { return e && e.active && e._hinterhalt; }).length,
    getroffen: window.questSystem.hasFlag('elaraMet'),
    auftrag: window.questSystem.getActiveQuests().map(function (q) { return q.id; }),
    lebt: !!(player && player.active) })`);
  assert.strictEqual(b.rest, 0, 'vom Hinterhalt stehen noch ' + b.rest + ' Gegner');
  assert.strictEqual(b.lebt, true, 'der Spieler hat den Hinterhalt nicht ueberlebt');
  assert.strictEqual(b.getroffen, true, 'nach der Rettung gilt Elara nicht als getroffen');
  assert.ok(Array.from(b.auftrag).indexOf('widerstand_proof') >= 0, 'ihr erster Auftrag wurde nicht vergeben');
});

test('Wer gut ausweicht, wird spaetestens nach 30 Sekunden gerettet', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] } }, {}, 1);
  H.run('playerHealth = playerMaxHealth; window._playerInvincible = true;');
  raumBetreten(4);
  H.step(1500);                                   // 25 s: noch nicht
  const frueh = H.run(`!!window.questSystem.hasFlag('elara_rettung_gesehen')`);
  H.step(400);                                    // ueber 30 s
  const spaet = H.run(`({ rettung: !!window.questSystem.hasFlag('elara_rettung_gesehen'), offen: !!window.eventChoiceOpen })`);
  H.run('window._playerInvincible = false; window.__durchklicken();');
  assert.strictEqual(frueh, false, 'die Rettung kam schon vor 30 s, ohne dass der Spieler in Not war');
  assert.strictEqual(spaet.rettung, true, 'nach 30 s kam keine Rettung');
  assert.strictEqual(spaet.offen, true);
});

test('Vor Raum 3 gibt es keinen Hinterhalt', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] } }, {}, 1);
  raumBetreten(2);
  H.step(20);
  assert.strictEqual(hinterhaltGegner().n, 0, 'schon in Raum 2 ein Hinterhalt');
});

test('Nach dem Ratsdokument zeigt sie ihr Versteck', () => {
  stand({ harren_daughter_investigation: { status: 'completed', objectives: [] },
          widerstand_proof: { status: 'active', objectives: [{ type: 'fetch', target: 'council_document', current: 1, required: 1 }] } },
        { elaraMet: true }, 1);
  // #161: Das Versteck ist ein Raum. Nach der Uebergabe kuendigt sie es an,
  // der naechste Raum des Laufs IST das Versteck, und dort spielt die Szene.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, 1);
    window.__durchklicken();
    _showElaraDialog(sc, 2);
    window.__klick(0);                       // Uebergabe bestaetigen
    var text = window.__dialogText();
    window.__durchklicken();
    return { text: text, fertig: window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'widerstand_proof'; }),
             naechster: dungeonRun.templateOrder[2],
             versteck: window.questSystem.hasFlag('elara_versteck_gesehen') };
  })()`);
  assert.strictEqual(r.fertig, true, 'die Uebergabe schliesst den Auftrag nicht ab');
  assert.ok(/Komm mit/.test(r.text), 'sie kuendigt das Versteck nicht an: ' + r.text);
  assert.strictEqual(r.naechster, 'ElarasVersteck', 'der naechste Raum ist nicht ihr Versteck');
  assert.strictEqual(r.versteck, false, 'die Versteck-Szene lief schon vor dem Raum');

  const d = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    enterRoom(sc, 2);
    var besuch = sc._versteckBesuch;
    window._versteckSzeneSpielen(sc, besuch);
    var text = window.__dialogText();
    window.__durchklicken();
    return { besuch: besuch, text: text, versteck: window.questSystem.hasFlag('elara_versteck_gesehen') };
  })()`);
  assert.strictEqual(d.besuch, 'versteck');
  assert.ok(/Spalt|crack/.test(d.text), 'im Versteck spielt nicht die Versteck-Szene: ' + d.text);
  assert.strictEqual(d.versteck, true, 'das Versteck wurde nicht gezeigt');
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
