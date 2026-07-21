// tests/storyActNumbers.test.js
//
// Sichert die Akt-Nummerierung der Titelkarten ab. Anlass: der (entfernte)
// Demo-Outro-Splash sagte "Ende von Akt 1 / Akt 2", waehrend die Titelkarte
// desselben Uebergangs "Akt 3" zeigte. Ergebnis des Audits: die Karten selbst
// sind korrekt — sie zeigen ueber index+1 sauber Akt 1..5 in Reihenfolge.
// Diese Tests halten genau das fest, damit es nicht erneut auseinanderlaeuft.
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

// Erwartete 1-basierte Nummer + Name je STORY_ACTS-Index.
const EXPECTED = [
  { idx: 0, num: 1, id: 'auftrag',       name: 'Der Dienst' },
  { idx: 1, num: 2, id: 'treuer_diener', name: 'Treuer Diener' },
  { idx: 2, num: 3, id: 'erste_risse',   name: 'Das Doppelspiel' },
  { idx: 3, num: 4, id: 'wahrheit',      name: 'Die Enttarnung' },
  { idx: 4, num: 5, id: 'bruch',         name: 'Der Verrat und die Presse' }
];

test('STORY_ACTS hat genau 5 Akte in der erwarteten Reihenfolge', () => {
  assert.strictEqual(S.STORY_ACTS.length, 5);
  EXPECTED.forEach((e) => {
    assert.strictEqual(S.STORY_ACTS[e.idx].id, e.id, 'idx ' + e.idx + ' id');
    assert.strictEqual(S.STORY_ACTS[e.idx].name, e.name, 'idx ' + e.idx + ' name');
  });
});

test('jede Akt-Titelkarte zeigt die korrekte Nummer (Akt = index+1)', () => {
  // Akt 1 (Index 0) ist der Start und hat keine Uebergangskarte — die Karten
  // beginnen beim ersten advanceToAct.
  for (let i = 1; i < EXPECTED.length; i++) {
    S.resetToAct0();
    const e = EXPECTED[i];
    const ok = S.advanceToAct(e.idx);
    assert.strictEqual(ok, true, 'advanceToAct(' + e.idx + ')');
    const card = S.consumePendingEvent();
    assert.ok(card, 'Titelkarte fuer Akt ' + e.num + ' erwartet');
    assert.strictEqual(card.actNumber, e.num,
      'Akt ' + e.name + ' muss "Akt ' + e.num + '" zeigen, war ' + card.actNumber);
    assert.strictEqual(card.actName, e.name);
  }
});

test('Uebergang nach Q6 (advanceToAct 2) zeigt Akt 3, nicht Akt 2', () => {
  // Genau der Widerspruch, den der alte Outro-Splash erzeugte.
  S.advanceToAct(2);
  const card = S.consumePendingEvent();
  assert.strictEqual(card.actNumber, 3);
  assert.strictEqual(card.actName, 'Das Doppelspiel');
});

test('advanceToAct ist monoton — kein Rueckwaerts, keine doppelte Karte', () => {
  S.advanceToAct(3);
  assert.strictEqual(S.consumePendingEvent().actNumber, 4);
  // Gleicher oder kleinerer Index: kein no-op-Sprung, keine neue Karte.
  assert.strictEqual(S.advanceToAct(2), false);
  assert.strictEqual(S.consumePendingEvent(), null);
});

test('Journal zeigt "Akt N von 5" passend zum aktuellen Akt', () => {
  const j0 = S.getJournalData();
  assert.strictEqual(j0.actNumber, 1);
  assert.strictEqual(j0.totalActs, 5);
  S.advanceToAct(2);
  const j2 = S.getJournalData();
  assert.strictEqual(j2.actNumber, 3, 'Index 2 -> "Akt 3 von 5"');
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
