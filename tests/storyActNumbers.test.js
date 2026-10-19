// tests/storyActNumbers.test.js
//
// Sichert die Akt-Nummerierung der Titelkarten ab. Anlass: der (entfernte)
// Demo-Outro-Splash sagte "Ende von Akt 1 / Akt 2", waehrend die Titelkarte
// desselben Uebergangs "Akt 3" zeigte. Ergebnis des Audits: die Karten selbst
// sind korrekt und zeigen die Akte in Reihenfolge. Stufe 1b (Story v6.1):
// Index 0 ist der Prolog (ohne Nummer), danach Akt 1 bis 4, die Nummer ist
// der Index. Diese Tests halten genau das fest.
//
// Ausserdem: die Wave-Meilenstein-Splashes ("Tiefe N erreicht") wurden
// entfernt — onWaveCompleted darf kein pending Event mehr erzeugen.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { loadGameModule } = require('./loadGameModule');

let S = null;
beforeEach(() => {
  if (!S) {
    if (!globalThis.window) globalThis.window = {};
    // Funktionaler i18n-Stub: die Akt-Namen sind i18n-Getter (act.name ->
    // t('story.act.<id>.name')), deren Fallback nur die Akt-ID ist. Um die
    // ECHTEN deutschen Namen zu sehen, muss der Stub die Registrierungen des
    // Moduls speichern und zurueckgeben.
    const dicts = { de: {}, en: {} };
    let lang = 'de';
    globalThis.window.i18n = {
      register(l, obj) { dicts[l] = Object.assign(dicts[l] || {}, obj || {}); },
      t: (k) => {
        const v = (dicts[lang] && dicts[lang][k] != null) ? dicts[lang][k] : (dicts.de ? dicts.de[k] : undefined);
        return v != null ? v : '[MISSING:' + k + ']';
      },
      setLanguage(l) { lang = l; },
      getLanguage: () => lang,
      onChange: () => () => {}
    };
    loadGameModule('js/storySystem.js');
    S = globalThis.window.storySystem;
  }
  S.resetToAct0();
});

// Erwartete Nummer, Plakette und Name je STORY_ACTS-Index.
const EXPECTED = [
  { idx: 0, num: 0, label: 'Prolog', id: 'auftrag',       name: 'Der Dienst' },
  { idx: 1, num: 1, label: 'Akt 1',  id: 'treuer_diener', name: 'Treuer Diener' },
  { idx: 2, num: 2, label: 'Akt 2',  id: 'erste_risse',   name: 'Das Doppelspiel' },
  { idx: 3, num: 3, label: 'Akt 3',  id: 'wahrheit',      name: 'Die Enttarnung' },
  { idx: 4, num: 4, label: 'Akt 4',  id: 'bruch',         name: 'Die Esse' }
];

test('STORY_ACTS hat genau 5 Akte in der erwarteten Reihenfolge', () => {
  assert.strictEqual(S.STORY_ACTS.length, 5);
  EXPECTED.forEach((e) => {
    assert.strictEqual(S.STORY_ACTS[e.idx].id, e.id, 'idx ' + e.idx + ' id');
    assert.strictEqual(S.STORY_ACTS[e.idx].name, e.name, 'idx ' + e.idx + ' name');
  });
});

test('jede Akt-Titelkarte zeigt die korrekte Nummer (Prolog, dann Akt = Index)', () => {
  // Der Prolog (Index 0) ist der Start und hat keine Uebergangskarte, die Karten
  // beginnen beim ersten advanceToAct.
  for (let i = 1; i < EXPECTED.length; i++) {
    S.resetToAct0();
    const e = EXPECTED[i];
    const ok = S.advanceToAct(e.idx);
    assert.strictEqual(ok, true, 'advanceToAct(' + e.idx + ')');
    const card = S.consumePendingEvent();
    assert.ok(card, 'Titelkarte fuer Akt ' + e.num + ' erwartet');
    assert.strictEqual(card.actNumber, e.num,
      e.name + ' muss Nummer ' + e.num + ' tragen, war ' + card.actNumber);
    assert.strictEqual(card.actLabel, e.label);
    assert.strictEqual(card.actName, e.name);
  }
});

test('Uebergang nach Q6 (advanceToAct 2) zeigt Akt 2 (Das Doppelspiel)', () => {
  // Seit Stufe 1b zaehlt der Prolog nicht mit: Index 2 ist Akt 2.
  S.advanceToAct(2);
  const card = S.consumePendingEvent();
  assert.strictEqual(card.actNumber, 2);
  assert.strictEqual(card.actLabel, 'Akt 2');
  assert.strictEqual(card.actName, 'Das Doppelspiel');
});

test('advanceToAct ist monoton — kein Rueckwaerts, keine doppelte Karte', () => {
  S.advanceToAct(3);
  assert.strictEqual(S.consumePendingEvent().actNumber, 3);
  // Gleicher oder kleinerer Index: kein no-op-Sprung, keine neue Karte.
  assert.strictEqual(S.advanceToAct(2), false);
  assert.strictEqual(S.consumePendingEvent(), null);
});

test('Journal zeigt "Prolog · Der Dienst", dann "Akt N von 4"', () => {
  const j0 = S.getJournalData();
  assert.strictEqual(j0.actNumber, 0);
  assert.strictEqual(j0.totalActs, 4);
  assert.strictEqual(j0.actLine, 'Prolog · Der Dienst');
  S.advanceToAct(2);
  const j2 = S.getJournalData();
  assert.strictEqual(j2.actNumber, 2);
  assert.strictEqual(j2.actLine, 'Akt 2 von 4: Das Doppelspiel');
  S.advanceToAct(4);
  assert.strictEqual(S.getJournalData().actLine, 'Akt 4 von 4: Die Esse');
});

test('Wave-Meilensteine sind entfernt: onWaveCompleted erzeugt keine Splash-Karte', () => {
  // Akt hochsetzen, damit ein etwaiges Act-Gate erfuellt waere, und die Karte
  // des Uebergangs konsumieren.
  S.advanceToAct(4);
  S.consumePendingEvent();
  // Frueher haetten diese Waves "Tiefe N erreicht"-Splashes eingereiht.
  [5, 10, 15, 20, 30, 40].forEach((w) => S.onWaveCompleted(w));
  assert.strictEqual(S.consumePendingEvent(), null, 'kein Meilenstein-Splash mehr');
});
