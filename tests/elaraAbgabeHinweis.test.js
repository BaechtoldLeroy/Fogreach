// tests/elaraAbgabeHinweis.test.js — wo Elaras fertige Auftraege abgegeben werden.
//
// Elara kommt nicht in den Hub; ihre Auftraege nimmt sie ab, wenn sie unten
// im Keller auftaucht (roomManager, ELARA_AUFTRAEGE; seit b466 im naechsten
// Raum, sobald der Auftrag fertig ist). Vorher stand der Auftrag fertig im
// Journal, ohne zu sagen, wohin damit — und oben nahm ihn keiner ab.
//
// Geprueft am laufenden Spiel: Tracker-Zeile, Journal (Daten und Overlay)
// und der Toast beim Erfuellen nennen den Keller, deutsch und englisch.
// Nicht fertige Auftraege und solche, die oben abgegeben werden, bleiben
// ohne Hinweis.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

const SC = `window.game.scene.getScene('GameScene')`;

let H = null;
before(async () => {
  H = await launchDungeon({ depth: 1 });
  H.run('window._playerInvincible = true');
});
after(async () => {
  if (H) {
    try { H.run(`window.i18n.setLanguage('de')`); } catch (e) {}
    await H.shutdown();
  }
});

/** Laufende Auftraege setzen: { id: fertig? }. */
function stand(eintraege) {
  H.run(`(function () {
    var qs = window.questSystem, e = ${JSON.stringify(eintraege)};
    var st = { storyVersion: qs.STORY_VERSION, quests: {}, flags: {} };
    Object.keys(e).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id];
      st.quests[id] = { status: 'active', objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: e[id] ? o.required : 0, required: o.required };
      }) };
    });
    qs.loadQuestSaveData(st);
  })()`);
}

/** Alle Texte des Journal-Overlays (auch in verschachtelten Containern). */
function journalTexte() {
  return H.run(`(function () {
    var sc = ${SC};
    var vorher = sc.children.list.slice();
    window.storySystem.showJournalOverlay(sc, function () {});
    var neu = sc.children.list.filter(function (o) { return vorher.indexOf(o) < 0; });
    var texte = [];
    (function sammeln(liste) {
      liste.forEach(function (o) {
        if (typeof o.text === 'string') texte.push(o.text);
        if (o.list) sammeln(o.list);
      });
    })(neu);
    neu.forEach(function (o) { try { o.destroy(); } catch (e) {} });
    if (typeof window.resumeGameClock === 'function') window.resumeGameClock(sc);
    return texte.join('\\n');
  })()`);
}

test('fertiges Buendel: Tracker und Journal sagen, wo Elara es abnimmt', () => {
  stand({ resistance_fetch_01: true, elara_meeting: false, aldric_cleanup: true });
  const r = H.run(`(function () {
    var qs = window.questSystem;
    var j = window.storySystem.getJournalData().activeQuests;
    return {
      hinweis: qs.getAbgabeHinweis('resistance_fetch_01'),
      offen: qs.getAbgabeHinweis('elara_meeting'),
      oben: qs.getAbgabeHinweis('aldric_cleanup'),
      tracker: qs.getTrackerText(),
      journal: j.map(function (q) { return q.title + '|' + (q.hinweis || ''); }).join('\\n')
    };
  })()`);
  assert.strictEqual(r.hinweis, 'Bring Elara das Bündel. Sie findet Dich im Keller.');
  assert.strictEqual(r.offen, '', 'nicht fertig, trotzdem Hinweis');
  assert.strictEqual(r.oben, '', 'Hub-Auftrag mit Keller-Hinweis');
  assert.ok(r.tracker.includes('Sie findet Dich im Keller.'), 'Tracker: ' + r.tracker);
  assert.ok(r.journal.includes('Das versiegelte Bündel|Bring Elara das Bündel. Sie findet Dich im Keller.'), 'Journal: ' + r.journal);
  assert.ok(!/Elaras Geheimnis\|./.test(r.journal), 'offener Auftrag mit Hinweis: ' + r.journal);

  const overlay = journalTexte();
  assert.ok(overlay.includes('Bring Elara das Bündel. Sie findet Dich im Keller.'), 'Overlay: ' + overlay);
});

test('jeder fertige Elara-Auftrag nennt den Keller, deutsch und englisch', () => {
  const ids = ['resistance_fetch_01', 'widerstand_proof', 'elara_meeting', 'elara_ritual', 'elara_blade', 'elara_second_truth'];
  const e = {};
  ids.forEach((id) => { e[id] = true; });
  stand(e);
  const de = H.run(`(${JSON.stringify(ids)}).map(function (id) { return window.questSystem.getAbgabeHinweis(id); })`);
  H.run(`window.i18n.setLanguage('en')`);
  const en = H.run(`(${JSON.stringify(ids)}).map(function (id) { return window.questSystem.getAbgabeHinweis(id); })`);
  const enOverlay = journalTexte();
  H.run(`window.i18n.setLanguage('de')`);
  for (let i = 0; i < ids.length; i++) {
    assert.ok(/^(Bring Elara .+\. Sie findet Dich im Keller\.|Elara wartet im Keller auf Dich\.)$/.test(de[i]), ids[i] + ' de: ' + de[i]);
    assert.ok(/^(Take .+ to Elara\. She will find you in the cellar\.|Elara is waiting for you in the cellar\.)$/.test(en[i]), ids[i] + ' en: ' + en[i]);
  }
  assert.ok(enOverlay.includes('Take the bundle to Elara. She will find you in the cellar.'), 'Overlay en: ' + enOverlay);
});

test('der Toast beim Erfuellen sagt es auch', () => {
  stand({ resistance_fetch_01: false });
  const msg = H.run(`(function () {
    var es = window.EventSystem, alt = es.showToast, gesehen = [];
    es.showToast = function (scene, text) { gesehen.push(text); };
    try { window.questSystem.updateQuestProgress('fetch', 'sealed_bundle', 1); }
    finally { es.showToast = alt; }
    return gesehen.join('\\n');
  })()`);
  assert.ok(msg.includes('Bring Elara das Bündel. Sie findet Dich im Keller.'), 'Toast: ' + msg);
});
