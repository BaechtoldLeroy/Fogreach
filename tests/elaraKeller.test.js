// tests/elaraKeller.test.js — Elaras erste Begegnung im Keller, zweigeteilt.
//
// Vorher lief alles in einem Zug: Der Nebel vertrieb den Hinterhalt, und im
// selben Moment stand der ganze Dialog da — samt angenommener Quest, ohne
// dass man sie je erreicht hatte. Jetzt wie ein Hub-Gespraech: erst die
// Rettung (sie stellt sich vor), dann steht ihr Sprite im Raum, und der
// Auftrag kommt auf [E].

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => { H = await launchDungeon({ depth: 6 }); });
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window._playerInvincible = true;
    enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
    // Saubere Ausgangslage: keine Flaggen, keine laufende Quest, kein Dialog.
    ['elaraMet', 'elara_rettung_gesehen'].forEach(function (f) {
      if (typeof questSystem.setFlag === 'function') questSystem.setFlag(f, false);
    });
    sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0'; })
      .forEach(function (o) { try { o.destroy(); } catch (x) {} });
    window.eventChoiceOpen = false;
    _resetElaraEncounterRunState();   // auch die Treppensperre faellt weg
    lockStairs(sc, false);
    // Dialoge mitschreiben statt im Szenenbaum suchen.
    if (!window.__dlgOrig) {
      window.__dlgOrig = window.EventSystem.showEventChoiceDialog;
      window.EventSystem.showEventChoiceDialog = function (s, text, knoepfe) {
        (window.__dlg = window.__dlg || []).push({ text: text, knoepfe: knoepfe || [] });
        return window.__dlgOrig.apply(this, arguments);
      };
    }
    window.__dlg = [];
    return 1;
  })()`);
});

/** Das Sprite im Raum, falls es steht. */
const elaraDa = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var s = sc.children.list.filter(function (o) {
    return o.texture && o.texture.key === 'elara_right0';
  })[0];
  return s ? { x: Math.round(s.x), y: Math.round(s.y) } : null;
})()`);
const dialoge = () => H.run('(window.__dlg || []).map(function (d) { return d.text; })');
const flagge = (f) => H.run(`!!questSystem.hasFlag('${f}')`);

test('Die Rettung stellt sie vor — und nimmt noch keinen Auftrag an', () => {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    _elaraRettet(sc);
  })()`);
  const s = elaraDa();
  assert.ok(s, 'ihr Sprite steht nicht im Raum');
  const texte = dialoge();
  assert.ok(texte.length > 0, 'gar kein Dialog');
  assert.ok(/Nebel quillt|Fog seeps/.test(texte[0]), 'die Rettung wird nicht gezeigt: ' + texte[0]);
  assert.ok(!texte.some((t) => /Archivschmied|Archivesmith/.test(t)),
    'der Auftrag kam ohne [E]: ' + texte.join(' | '));
  assert.strictEqual(flagge('elaraMet'), false, 'elaraMet wurde schon gesetzt');
  assert.strictEqual(
    H.run(`questSystem.getActiveQuests().some(function (q) { return q.id === 'widerstand_proof'; })`),
    false, 'die Quest laeuft schon');
});

test('Erst [E] bei ihr bringt den Auftrag', () => {
  H.run(`(function () { _elaraRettet(window.game.scene.getScene('GameScene')); })()`);
  const s = elaraDa();
  assert.ok(s, 'ihr Sprite steht nicht im Raum');
  // Dialoge der Rettung wegklicken, dann zu ihr gehen und [E].
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__dlg = [];
    window.eventChoiceOpen = false;
    player.body.reset(${s.x} + 20, ${s.y});
    sc.input.keyboard.emit('keydown-E');
  })()`);
  const texte = dialoge();
  assert.ok(texte.some((t) => /Archivschmied|Archivesmith/.test(t)),
    'kein Auftragsdialog auf [E]: ' + texte.join(' | '));
  // Den Weiter-Knopf druecken.
  H.run(`(function () {
    var d = (window.__dlg || [])[window.__dlg.length - 1];
    if (d && d.knoepfe && d.knoepfe[0] && typeof d.knoepfe[0].callback === 'function') d.knoepfe[0].callback();
  })()`);
  assert.strictEqual(flagge('elaraMet'), true, 'elaraMet nicht gesetzt');
  assert.strictEqual(
    H.run(`questSystem.getActiveQuests().some(function (q) { return q.id === 'widerstand_proof'; })`),
    true, 'die Quest wurde nicht angenommen');
});

test('Wer weitergeht, trifft sie wieder — aber ohne zweiten Hinterhalt', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var qs = window.questSystem, alt = qs.getCompletedQuests, altAktiv = qs.getActiveQuests;
    // Nur Q1 ist durch, sonst laeuft nichts — sonst greift der Zweig, der das
    // Ratsdokument setzt (widerstand_proof aus dem Test davor).
    qs.getCompletedQuests = function () { return [{ id: 'harren_daughter_investigation' }]; };
    qs.getActiveQuests = function () { return []; };
    qs.setFlag('elara_rettung_gesehen');      // die Rettung war schon
    qs.setFlag('elaraMet', false);
    _resetElaraEncounterRunState();
    var gefunden = null, hinterhalt = false;
    try {
      for (var raum = 3; raum <= 12 && !gefunden; raum++) {
        sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0'; })
          .forEach(function (o) { try { o.destroy(); } catch (x) {} });
        _maybeFireElaraCellarEncounter(sc, raum);
        if (typeof _hinterhalt !== 'undefined' && _hinterhalt) hinterhalt = true;
        var s = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0'; })[0];
        if (s) gefunden = raum;
      }
    } finally { qs.getCompletedQuests = alt; qs.getActiveQuests = altAktiv; }
    return { gefunden: gefunden, hinterhalt: hinterhalt };
  })()`);
  assert.ok(r.gefunden, 'sie taucht nicht wieder auf');
  assert.strictEqual(r.hinterhalt, false, 'es wurde ein zweiter Hinterhalt gestartet');
});

/** Zustand der Treppen dieses Raums. */
const treppen = () => H.run(`(function () {
  var sc = window.game.scene.getScene('GameScene');
  var alle = sc.stairsGroup ? sc.stairsGroup.getChildren() : [];
  return { gesamt: alle.length,
    offen: alle.filter(function (s) { return !s.getData('locked'); }).length,
    grund: treppenSperrGrund(sc) };
})()`);

test('Solange sie wartet, bleibt die Treppe zu', () => {
  H.run(`(function () { _elaraRettet(window.game.scene.getScene('GameScene')); })()`);
  // Der Nebel raeumt den Raum, die Welle gilt danach als erledigt — genau da
  // wollte die Treppe bisher aufgehen, noch bevor man sie erreicht hatte.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    rooms[currentRoomId].cleared = true;
    lockStairs(sc, false);
  })()`);
  const t = treppen();
  assert.ok(t.gesamt > 0, 'der Raum hat gar keine Treppe');
  assert.strictEqual(t.offen, 0, t.offen + ' von ' + t.gesamt + ' Treppen standen offen');
  assert.ok(/Elara/.test(t.grund), 'der Sperrgrund nennt sie nicht: ' + t.grund);
});

test('Nach dem Gespraech gibt sie den Weg frei', () => {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    _elaraRettet(sc);
    rooms[currentRoomId].cleared = true;
    lockStairs(sc, false);
  })()`);
  assert.strictEqual(treppen().offen, 0, 'die Treppe war schon vor dem Gespraech offen');
  const s = elaraDa();
  assert.ok(s, 'ihr Sprite steht nicht im Raum');
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__dlg = [];
    window.eventChoiceOpen = false;
    player.body.reset(${s.x} + 20, ${s.y});
    sc.input.keyboard.emit('keydown-E');
    var d = (window.__dlg || [])[window.__dlg.length - 1];
    if (d && d.knoepfe && d.knoepfe[0] && typeof d.knoepfe[0].callback === 'function') d.knoepfe[0].callback();
  })()`);
  const t = treppen();
  assert.strictEqual(t.offen, t.gesamt, 'die Treppe blieb nach dem Gespraech zu: ' + t.grund);
});
