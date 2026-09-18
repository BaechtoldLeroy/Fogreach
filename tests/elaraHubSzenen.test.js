// tests/elaraHubSzenen.test.js — Elaras Szenen im Hub (#155, #156).
//
// Story-Bibel v5, Abschnitt 6:
//   - Das Wiedersehen am Ende von Akt 2: Harren sieht seine Tochter. Hier
//     erfaehrt der Spieler, wer Elara ist.
//   - Die Nacht nach dem Bruch: sie versteckt Dich — das tiefste Vertrauen,
//     direkt vor dem Verrat.
//   - Der Maulwurf: Du folgst dem Zettel und siehst Elara mit Aldric, am Ring
//     das Zeichen des Schattenrats (#156).
//
// Am echten Hub ueber _showNpcDialogue. Die Szenen selbst werden fuer die
// Ausloeser-Pruefung aufgezeichnet und sofort beendet; ihr Inhalt wird am
// Ende an den ECHTEN Szenen geprueft (voller Text, wie er an den
// Wort-fuer-Wort-Aufbau geht).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 wurde nicht erreicht');
  H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.__szenen = [];
    window.__echt = {};
    ['playWiedersehen', 'playNachtNachDemBruch', 'playMaulwurfEnthuellung'].forEach(function (n) {
      window.__echt[n] = window.storyScenes[n];
      window.storyScenes[n] = function (s, fertig) { window.__szenen.push(n); if (typeof fertig === 'function') fertig(); };
    });
    window.__reden = function (id) {
      var eintrag = sc.npcs.filter(function (n) { return n.data && n.data.id === id; })[0];
      if (!eintrag) return { fehler: 'NPC ' + id + ' nicht im Hub' };
      var vorher = window.__szenen.length;
      sc._dialogOpen = false;
      sc._showNpcDialogue(eintrag.data);
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = false;
      return { szenen: window.__szenen.slice(vorher) };
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

function stand(akt, quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt});
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests || {})};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}

test('Kein Wiedersehen, solange das Doppelspiel laeuft (Akt 2)', () => {
  stand(2);
  const r = H.run(`window.__reden('harren')`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(Array.from(r.szenen).length, 0, 'in Akt 2 kam schon eine Szene: ' + Array.from(r.szenen).join(', '));
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_ist_lene')`), false);
});

test('In Akt 3 sieht Harren seine Tochter wieder, genau einmal', () => {
  stand(3);
  const erst = H.run(`window.__reden('harren')`);
  assert.deepStrictEqual(Array.from(erst.szenen), ['playWiedersehen'], 'das Wiedersehen kam nicht');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_ist_lene')`), true);
  const dann = H.run(`window.__reden('harren')`);
  assert.strictEqual(Array.from(dann.szenen).length, 0, 'das Wiedersehen kam ein zweites Mal');
});

test('Die Nacht nach dem Bruch spielt nicht im Hub, sondern in Elaras Versteck (#161)', () => {
  stand(4, { bruch_confrontation: { status: 'completed', objectives: [] } }, { elaraReturnedToHub: true });
  const erst = H.run(`window.__reden('elara')`);
  assert.ok(!erst.fehler, erst.fehler);
  assert.strictEqual(Array.from(erst.szenen).length, 0, 'die Nacht kommt noch im Hub');
  assert.strictEqual(H.run(`window.versteckBesuchFaellig()`), 'bruch_nacht',
    'nach dem Bruch ist kein Besuch im Versteck faellig');
});

test('Die Abgabe des Maulwurfs zeigt Elara mit Aldric und schliesst ab', () => {
  stand(4, {
    bruch_confrontation: { status: 'completed', objectives: [] },
    espionage_archive: { status: 'completed', objectives: [] },
    espionage_informant: { status: 'active', objectives: [{ type: 'observe', target: 'informant_id', current: 1, required: 1 }] }
  }, { elaraReturnedToHub: true, bruch_nacht_gesehen: true });
  const r = H.run(`window.__reden('mara')`);
  assert.ok(!r.fehler, r.fehler);
  assert.deepStrictEqual(Array.from(r.szenen), ['playMaulwurfEnthuellung'], 'die Enthuellung kam nicht');
  const q = H.run(`(function () { var qs = window.questSystem;
    return { fertig: qs.getCompletedQuests().some(function (x) { return x.id === 'espionage_informant'; }),
             mole: qs.hasFlag('mole_evidence'), verrat: qs.hasFlag('elara_verrat_gesehen') }; })()`);
  assert.strictEqual(q.fertig, true, 'der Maulwurf wurde nicht abgeschlossen');
  assert.strictEqual(q.mole, true, 'mole_evidence fehlt (Finale)');
  assert.strictEqual(q.verrat, true);
});

test('Der Maulwurf kommt erst nach dem Bruch', () => {
  stand(3, { espionage_archive: { status: 'completed', objectives: [] } });
  const angebot = H.run(`window.questSystem.getAvailableQuests('mara').map(function (q) { return q.id; })`);
  assert.ok(Array.from(angebot).indexOf('espionage_informant') < 0, 'der Maulwurf wird schon vor dem Bruch angeboten');
});

test('Die Szenen erzaehlen, was sie sollen', () => {
  // An den ECHTEN Szenen: der volle Text, wie er an den Aufbau geht.
  const t = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var TW = window.DialogTypewriter, echt = TW.anTextobjekt, aus = {};
    ['playWiedersehen', 'playNachtNachDemBruch', 'playMaulwurfEnthuellung'].forEach(function (n) {
      var gesehen = '';
      TW.anTextobjekt = function (s, textObj, voll) { gesehen = String(voll); return echt.apply(this, arguments); };
      try { window.__echt[n](sc, function () {}); } finally { TW.anTextobjekt = echt; }
      aus[n] = gesehen;
      sc.children.list.filter(function (o) { return o.depth >= 1550 && o.depth < 1560; })
        .forEach(function (o) { try { o.destroy(); } catch (e) {} });
    });
    return aus;
  })()`);
  assert.ok(/Lene/.test(t.playWiedersehen) && /Elara/.test(t.playWiedersehen) && /Vater/.test(t.playWiedersehen),
    'das Wiedersehen verbindet Lene und Elara nicht: ' + t.playWiedersehen);
  assert.ok(/Versteck/.test(t.playNachtNachDemBruch), 'die Nacht spielt nicht im Versteck: ' + t.playNachtNachDemBruch);
  assert.ok(/Aldric/.test(t.playMaulwurfEnthuellung) && /drei Ketten/.test(t.playMaulwurfEnthuellung),
    'die Enthuellung zeigt nicht Elara mit Aldric und das Zeichen: ' + t.playMaulwurfEnthuellung);
});
