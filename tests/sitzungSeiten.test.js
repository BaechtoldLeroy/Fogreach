// tests/sitzungSeiten.test.js — ein Sprecher pro Seite in beiden Ratssitzungen.
//
// Der Wunsch: nach jedem Sprecher eine Pause, weiter per Tastendruck. Dazu
// sind die Seiten der oeffentlichen Sitzung (frueher EINE Seite mit allem) und
// der geheimen (die Einigung der drei stand auf einer Seite) in einzelne
// Seiten geteilt. Der Text selbst bleibt Wort fuer Wort derselbe: geprueft
// gegen tests/sitzungTexteVorher.json, gewonnen aus dem Stand vor der Teilung
// (b371) fuer DE und EN und jede Flaggen-Kombination. v6.1 (b458) hat den
// Wortlaut dreier Zeilen geaendert (die Patrouillen werden oeffentlich
// verkuendet, das beschaedigte Siegel); die Datei traegt seither diesen Stand,
// mit den alten Seitengrenzen.
//
// Ob die Szene an jeder Seite wirklich haelt, messen tests/sitzungsBuehne.test.js
// (Hub und Dungeon, echte Uhr) und der Attrappen-Fall unten.

const { test } = require('node:test');
const assert = require('node:assert');
const VORHER = require('./sitzungTexteVorher.json');

function laden(lang, flags) {
  global.window = {
    i18n: { getLanguage: () => lang },
    questSystem: { hasFlag: (n) => !!flags[n], updateQuestProgress() {} }
  };
  delete require.cache[require.resolve('../js/sitzungsBuehne.js')];
  require('../js/sitzungsBuehne.js');
  delete require.cache[require.resolve('../js/storyScenes.js')];
  require('../js/storyScenes.js');
  return global.window;
}

// Jede Kombination, die der alte Stand kannte: Schluessel wie in der Datei.
function faelle() {
  const aus = [];
  for (const lang of ['de', 'en']) {
    for (const sieger of ['-', 'magistrat', 'klerus', 'garde']) {
      aus.push({ art: 'oeffentlich', key: lang + '|' + sieger, lang,
        flags: sieger === '-' ? {} : { ['edikt_' + sieger]: true } });
    }
    for (const edikt of ['-', 'edikt']) {
      for (const siegel of ['-', 'verification_sealed', 'verification_refused']) {
        const flags = {};
        if (edikt === 'edikt') flags.edikt_garde = true;
        if (siegel !== '-') flags[siegel] = true;
        aus.push({ art: 'geheim', key: lang + '|' + edikt + '|' + siegel, lang, flags });
      }
    }
  }
  return aus;
}

// Wie viele Absaetze beginnen mit "NAME:"? Ein Sprecher pro Absatz.
function sprecherZahl(seite) {
  return String(seite).split(/\n\s*\n/).filter((a) => /^\s*[A-ZÄÖÜ][A-ZÄÖÜ ]+:/.test(a)).length;
}

test('Wortgleich: zusammengesetzt steht derselbe Text da wie vor der Teilung (DE und EN)', () => {
  const alle = faelle();
  assert.strictEqual(alle.length, Object.keys(VORHER.oeffentlich).length + Object.keys(VORHER.geheim).length);
  alle.forEach((f) => {
    const W = laden(f.lang, f.flags);
    const neu = W.storyScenes.sitzungSeiten(f.art);
    const alt = f.art === 'oeffentlich' ? VORHER.oeffentlich[f.key] : VORHER.geheim[f.key].join('\n\n');
    assert.ok(alt, 'kein alter Text fuer ' + f.key);
    assert.strictEqual(neu.join('\n\n'), alt, f.art + ' ' + f.key + ' weicht ab');
  });
});

test('Hoechstens ein Sprecher pro Seite, in beiden Sitzungen', () => {
  // Gegenprobe: der alte Stand hatte Seiten mit mehreren Sprechern.
  const altMehr = Object.values(VORHER.oeffentlich).concat(...Object.values(VORHER.geheim))
    .filter((s) => sprecherZahl(s) > 1).length;
  assert.ok(altMehr > 0, 'die Pruefung erkennt mehrere Sprecher gar nicht');
  faelle().forEach((f) => {
    const W = laden(f.lang, f.flags);
    W.storyScenes.sitzungSeiten(f.art).forEach((s, i) => {
      assert.ok(sprecherZahl(s) <= 1, f.art + ' ' + f.key + ' Seite ' + i + ' hat mehrere Sprecher: ' + s);
      assert.ok(!/\n\s*\n/.test(s), f.art + ' ' + f.key + ' Seite ' + i + ' hat noch mehrere Absaetze: ' + s);
      // Die Buehne hebt genau den Sprecher der Seite hervor.
      const m = /^([A-ZÄÖÜ][A-ZÄÖÜ ]+):/.exec(s);
      const wer = W.SitzungsBuehne.sprecherAus(s);
      if (m) assert.ok(wer, f.key + ' Seite ' + i + ': Sprecher ' + m[1] + ' wird nicht erkannt');
      else assert.strictEqual(wer, null, f.key + ' Seite ' + i + ': Erzaehlung hebt jemanden hervor');
    });
  });
});

test('Seitenzahl: oeffentlich 4 bzw. 6, geheim 5 bis 8 (vorher 1 bzw. 3 bis 5)', () => {
  const zahl = (lang, flags, art) => laden(lang, flags).storyScenes.sitzungSeiten(art).length;
  assert.strictEqual(zahl('de', {}, 'oeffentlich'), 4);
  assert.strictEqual(zahl('de', { edikt_klerus: true }, 'oeffentlich'), 6);
  assert.strictEqual(zahl('en', {}, 'geheim'), 5);
  assert.strictEqual(zahl('en', { edikt_garde: true, verification_refused: true }, 'geheim'), 8);
});

// --- Die oeffentliche Sitzung haelt an jeder Seite (Attrappe ohne Buehne) ---

/** Eine Szene, deren Tastatur und Zeiger der Test selbst ausloest. */
function attrappe() {
  const hoerer = { keydown: [], pointerdown: [] };
  const texte = [];
  const nichts = () => new Proxy(function () {}, { get: (t, k) => (k === 'text' ? '' : nichts()), apply: () => nichts() });
  const scene = {
    cameras: { main: { width: 960, height: 480 } },
    add: {
      text: (x, y, t) => {
        const o = { text: t, scene: true, lebt: true };
        o.setText = (s) => { o.text = s; return o; };
        ['setOrigin', 'setDepth', 'setScrollFactor', 'setPosition', 'setWordWrapWidth', 'setFontSize', 'setLineSpacing']
          .forEach((k) => { o[k] = () => o; });
        o.destroy = () => { o.lebt = false; o.scene = null; };
        texte.push(o);
        return o;
      },
      graphics: () => nichts()
    },
    input: {
      on: (n, f) => { (hoerer[n] = hoerer[n] || []).push(f); },
      off: (n, f) => { hoerer[n] = (hoerer[n] || []).filter((x) => x !== f); },
      keyboard: {
        on: (n, f) => { (hoerer[n] = hoerer[n] || []).push(f); },
        off: (n, f) => { hoerer[n] = (hoerer[n] || []).filter((x) => x !== f); }
      }
    },
    tweens: { add() {} },
    time: { now: 0, addEvent: () => ({ remove() {} }), delayedCall: () => ({ remove() {} }) }
  };
  const feuern = (n, ev) => (hoerer[n] || []).slice().forEach((f) => f(ev));
  // Was gerade als Seite dasteht (ohne die Kulisse und den Hinweis).
  const seite = () => texte.filter((o) => o.lebt && /^\(|^[A-ZÄÖÜ ]+:/.test(o.text)).map((o) => o.text);
  return { scene, feuern, seite };
}

test('Ohne Tastendruck bleibt die Seite stehen, mit Tastendruck kommt die naechste', () => {
  const W = laden('de', { edikt_klerus: true });
  delete W.SitzungsBuehne;                     // Rueckfall: gezeichnete Kaesten
  let fertig = 0;
  W.storyDialog = null;                       // keine Schlussauswahl
  const A = attrappe();
  W.storyScenes.playOeffentlicheSitzung(A.scene, () => { fertig++; });
  const erwartet = W.storyScenes.sitzungSeiten('oeffentlich');
  const gesehen = [];
  for (let i = 0; i < erwartet.length; i++) {
    const jetzt = A.seite();
    assert.strictEqual(jetzt.length, 1, 'Seite ' + i + ': nicht genau eine Seite im Bild: ' + JSON.stringify(jetzt));
    gesehen.push(jetzt[0]);
    assert.ok(A.scene.__szeneWartet, 'Seite ' + i + ': die Szene haelt nicht an');
    // Eine wiederholte (gehaltene) Taste blaettert nicht.
    A.feuern('keydown', { repeat: true });
    assert.strictEqual(A.seite()[0], jetzt[0], 'Seite ' + i + ': gehaltene Taste blaettert weiter');
    assert.strictEqual(fertig, 0);
    A.feuern(i % 2 ? 'pointerdown' : 'keydown', { repeat: false });
  }
  assert.strictEqual(JSON.stringify(gesehen), JSON.stringify(erwartet), 'die Seiten kamen anders');
  assert.strictEqual(A.seite().length, 0, 'nach der letzten Seite steht noch Text');
  assert.strictEqual(fertig, 1, 'die Sitzung endet nicht genau einmal');
});
