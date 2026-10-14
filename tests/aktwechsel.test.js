// tests/aktwechsel.test.js — Aktwechsel als Zwischenszene (js/aktwechsel.js).
//
// Gemeldet: "splash texte bei aktwechsel brauchen neue grafiken oder
// cutscenes". Seit b430 fest (vorher Vorschau ?aktwechsel=neu): jeder
// Aktwechsel zeigt ein Pixel-Tableau mit Schwenk und Nebel, darueber eine
// Messing-Plakette "Akt N" + Aktname und den Text Stueck fuer Stueck. Nur
// wenn das Bild fehlt, bleibt die alte Titelkarte. Der Einfuehrungstext
// eines neuen Spiels ist die Szene von Akt 1 — sie sperrt den Hub nicht
// (_dialogOpen bleibt, Uhr laeuft). Geprueft am echten Hub: Nummer = Index + 1,
// Name aus STORY_ACTS/i18n, Seiten per Taste und Klick, ESC und
// "Ueberspringen", die Spieluhr steht nur waehrenddessen, nichts bleibt
// liegen, die Pending-Kette (Akt + Epilog) laeuft wie vorher.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const C = `${HUB}.children.list.filter(function (o) { return o.name === 'aktwechsel'; })[0]`;
// Ein Teil der Szene per Name, auch in der Textplatte (eigener Container).
const TEIL = (name) => `(function () { var c = ${C}; if (!c) return undefined; var r;
  (function lauf(l) { l.forEach(function (o) { if (!r && o.name === '${name}') r = o; if (o.list) lauf(o.list); }); })(c.list);
  return r; })()`;

async function hub(search) {
  const H = await launch({ search, renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(10);
  return H;
}

/** Takten, bis die Bedingung gilt (Tweens brauchen headless mehr Takte). */
function bis(H, js, max) {
  for (let i = 0; i < (max || 300); i++) {
    if (H.run(js)) return true;
    H.step(3);
  }
  return !!H.run(js);
}
const eingeblendet = (H) => bis(H, `${TEIL('aktwechselText')}.alpha === 1`);

/** Karte ueber showStoryOverlay oeffnen; merkt Rueckgabe und Dismiss. */
function oeffnen(H, ev) {
  H.run(`(function () { window.__zu = 0;
    window.__ov = window.storySystem.showStoryOverlay(${HUB}, ${ev}, function () { window.__zu++; }); })()`);
}

/** Reste der Szene zaehlen. */
function reste(H) {
  return H.run(`(function () { var sc = ${HUB}, r = 0;
    (function lauf(l) { l.forEach(function (o) { if (/^aktwechsel/.test(o.name || '')) r++; if (o.list) lauf(o.list); }); })(sc.children.list);
    var kb = sc.input.keyboard;
    // Tasten-Lauscher, die nach dem Merken dazukamen und nicht wieder gingen.
    var neu = 0, alt = window.__tastenVorher || {};
    ['keydown-SPACE', 'keydown-ENTER', 'keydown-ESC'].forEach(function (t) {
      kb.listeners(t).forEach(function (f) { if ((alt[t] || []).indexOf(f) === -1) neu++; }); });
    return { objekte: r, neueTasten: neu, uhr: window.__GAME_PAUSE.since, zeitPause: sc.time.paused,
      tweens: sc.tweens.getTweens().length };
  })()`);
}

describe('neues Spiel: Einfuehrungstext als Szene von Akt 1', () => {
  let H = null;
  before(async () => {
    // Ohne debug=1: die Szene haengt an keiner Flagge mehr. autostart geht
    // nur mit Debug — darum der Weg ueber den Startbildschirm.
    H = await launch({ search: '', renderer: 'canvas', waitFor: 'StartScene' });
    H.run(`window.game.scene.getScene('StartScene').scene.start('HubSceneV2')`);
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Tableaus vorgeladen, die Einfuehrung erscheint als Szene, Hub frei', () => {
    assert.strictEqual(H.run('window.DebugGate.flagge("aktprobe")'), null);
    assert.ok(bis(H, `!!(${C})`), 'die Einfuehrung kam nicht als Szene');
    const r = H.run(`(function () { var a = ${TEIL('aktwechselAkt')};
      return { alle: window.Aktwechsel.AKTE.every(function (id) { return ${HUB}.textures.exists('aktwechsel_' + id); }),
        bild: ${TEIL('aktwechselBild')}.texture.key, akt: a ? a.text : null, titel: ${TEIL('aktwechselTitel')}.text,
        name: window.storySystem.STORY_ACTS[0].name, offen: !!${HUB}._dialogOpen,
        uhr: window.__GAME_PAUSE.since, physik: ${HUB}.physics.world.isPaused }; })()`);
    assert.strictEqual(r.alle, true, 'nicht alle Tableaus geladen');
    assert.strictEqual(r.bild, 'aktwechsel_auftrag');
    assert.strictEqual(r.akt, 'Akt 1');
    assert.strictEqual(r.titel, r.name);
    assert.strictEqual(r.offen, false, 'die Einfuehrung sperrt den Hub (_dialogOpen)');
    assert.strictEqual(r.uhr, null, 'die Einfuehrung haelt die Spieluhr an');
    assert.strictEqual(r.physik, false, 'die Einfuehrung haelt die Physik an');
  });

  test('der Einfuehrungstext seitenweise, jede Seite passt auf die Platte', () => {
    assert.ok(eingeblendet(H), 'der Text blendet nicht ein');
    const r = H.run(`(function () {
      var t = ${TEIL('aktwechselText')}, w = ${TEIL('aktwechselWeiter')};
      var seiten = [], schrift = [], passt = true;
      // Seite fuer Seite blaettern, ohne zu schliessen (die letzte bleibt offen).
      var kb = ${HUB}.input.keyboard;
      for (var i = 0; i < 20; i++) {
        t.setAlpha(1);
        seiten.push(t.text); schrift.push(parseFloat(t.style.fontSize));
        if (t.y + t.height > w.y - w.height + 2) passt = false;
        var vorher = t.text;
        kb.emit('keydown-SPACE'); if (t.alpha < 1) kb.emit('keydown-SPACE');
        if (!${C}) break;
        if (t.text === vorher) break;
      }
      return { seiten: seiten, schrift: schrift, passt: passt, zu: !${C},
        gesehen: (window.SlotStorage || localStorage).getItem('demonfall_seen_intro_splash') };
    })()`);
    assert.ok(r.seiten.length >= 3, 'der Einfuehrungstext steht auf ' + r.seiten.length + ' Seite(n)');
    assert.ok(/^Fogreach/.test(r.seiten[0]), 'erste Seite ist nicht der Einfuehrungstext: ' + r.seiten[0]);
    assert.ok(/Keller/.test(r.seiten[r.seiten.length - 1]), 'letzte Seite fehlt');
    assert.strictEqual(r.passt, true, 'eine Seite laeuft aus der Platte');
    assert.ok(r.schrift.every((s) => s >= 17), 'Schrift notgedrungen verkleinert: ' + r.schrift);
    assert.strictEqual(r.zu, true, 'die letzte Seite schliesst nicht');
    assert.strictEqual(r.gesehen, '1', 'die Einfuehrung ist nicht als gesehen gemerkt');
  });
});

describe('Einfuehrung: ESC schliesst ganz', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1'); });
  after(async () => { if (H) await H.shutdown(); });

  test('ESC auf der ersten Seite schliesst die ganze Szene', () => {
    assert.ok(bis(H, `!!(${C})`), 'die Einfuehrung kam nicht als Szene');
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
    const r = H.run(`({ szene: !!(${C}), offen: !!${HUB}._dialogOpen, uhr: window.__GAME_PAUSE.since,
      gesehen: (window.SlotStorage || localStorage).getItem('demonfall_seen_intro_splash') })`);
    assert.strictEqual(r.szene, false, 'ESC schliesst die Einfuehrung nicht');
    assert.strictEqual(r.offen, false);
    assert.strictEqual(r.uhr, null);
    assert.strictEqual(r.gesehen, '1');
    assert.strictEqual(reste(H).objekte, 0, 'Teile der Szene bleiben liegen');
  });
});

describe('Zwischenszene', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1'); });
  after(async () => { if (H) await H.shutdown(); });

  test('jeder Akt: eigenes Bild, Plakette mit Index+1 und Name, echter Weg ueber den Hub', () => {
    H.run(`(function () { var kb = ${HUB}.input.keyboard; window.__tastenVorher = {};
      ['keydown-SPACE', 'keydown-ENTER', 'keydown-ESC'].forEach(function (t) { window.__tastenVorher[t] = kb.listeners(t); }); })()`);
    const vorher = reste(H);
    const akte = H.run(`window.storySystem.STORY_ACTS.map(function (a) { return a.id + '|' + a.name; })`);
    const gesehen = [];
    for (let i = 0; i < 5; i++) {
      const [id, name] = akte[i].split('|');
      if (i === 0) {
        // Akt 1 ist der Startzustand — kein Aufstieg dorthin; die Karte per Probe.
        H.run(`${HUB}._dialogOpen = true`);
        oeffnen(H, `window.storySystem.probeEreignis('1')`);
      } else {
        H.run(`window.storySystem.advanceToAct(${i}); ${HUB}._checkStoryEvent()`);
      }
      const r = H.run(`(function () { var c = ${C}; if (!c) return null;
        var akt = ${TEIL('aktwechselAkt')};
        return { bild: ${TEIL('aktwechselBild')}.texture.key, akt: akt ? akt.text : null,
          titel: ${TEIL('aktwechselTitel')}.text, offen: ${HUB}._dialogOpen,
          uhr: window.__GAME_PAUSE.since !== null };
      })()`);
      assert.ok(r, 'Akt ' + (i + 1) + ': keine Zwischenszene');
      assert.strictEqual(r.bild, 'aktwechsel_' + id);
      assert.strictEqual(r.akt, 'Akt ' + (i + 1), 'falsche Nummer');
      assert.strictEqual(r.titel, name);
      assert.strictEqual(r.offen, true, 'der Hub haelt die Szene nicht fuer offen');
      assert.strictEqual(r.uhr, true, 'die Spieluhr laeuft waehrend der Szene');
      gesehen.push(r.bild);
      H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
      if (i === 0) H.run(`${HUB}._dialogOpen = false`);
      assert.strictEqual(H.run(`${HUB}._dialogOpen`), false, 'nach ESC bleibt der Hub blockiert');
    }
    assert.strictEqual(new Set(gesehen).size, 5, 'zwei Akte teilen ein Bild');
    const n = reste(H);
    assert.strictEqual(n.objekte, 0, 'Teile der Szene bleiben liegen');
    assert.strictEqual(n.neueTasten, 0, 'Tasten-Lauscher der Szene bleiben haengen');
    assert.strictEqual(n.uhr, null, 'die Spieluhr bleibt stehen');
    assert.strictEqual(n.zeitPause, false);
    assert.ok(n.tweens <= vorher.tweens, 'Tweens laufen weiter: ' + n.tweens + ' statt ' + vorher.tweens);
    assert.strictEqual(H.run('window.storySystem.consumePendingEvent()'), null, 'eine Karte ist doppelt faellig');
  });

  test('Epilog: eigenes Bild, ohne Nummer', () => {
    oeffnen(H, `window.storySystem.probeEreignis('epilog')`);
    const r = H.run(`({ bild: ${TEIL('aktwechselBild')}.texture.key, akt: !!(${TEIL('aktwechselAkt')}), titel: ${TEIL('aktwechselTitel')}.text })`);
    assert.strictEqual(r.bild, 'aktwechsel_ending');
    assert.strictEqual(r.akt, false, 'der Epilog traegt eine Aktnummer');
    assert.strictEqual(r.titel, 'Epilog');
    H.run('window.__ov.ueberspringen()');
  });

  test('Text Seite fuer Seite: Taste, Klick, Hinweis "Weiter" ohne Klammern', () => {
    oeffnen(H, `window.storySystem.probeEreignis('3')`);
    const seiten = H.run('window.__ov.seiten.slice()');
    const ganz = H.run(`window.storySystem.probeEreignis('3').narrative`);
    assert.ok(seiten.length >= 2, 'der Akt-Text steht auf einer Seite: ' + seiten.length);
    assert.strictEqual(seiten.join(' '), ganz, 'beim Aufteilen ging Text verloren');
    assert.ok(seiten.every((s) => (s.match(/(^|\s)'/g) || []).length === (s.match(/'(\s|$)/g) || []).length),
      'ein Zitat ist ueber zwei Seiten zerrissen');
    assert.strictEqual(H.run(`${TEIL('aktwechselWeiter')}.text`), 'Weiter');
    assert.strictEqual(H.run(`${TEIL('aktwechselText')}.text`), seiten[0]);
    // Ein Klick sofort nach dem Oeffnen ist der ausloesende Klick: zaehlt nicht.
    H.run(`${TEIL('aktwechselGrund')}.emit('pointerdown')`);
    assert.strictEqual(H.run('window.__ov.seite()'), 0, 'der ausloesende Klick blaettert');
    // Vorspann: erst das Bild allein; Weiter kuerzt ihn ab, blaettert aber nicht.
    const platte = `${TEIL('aktwechselText')}.parentContainer`;
    H.step(10);
    assert.ok(H.run(`${platte}.alpha`) < 0.1, 'kein Vorspann: die Textplatte steht sofort da');
    H.step(20);
    H.run(`${HUB}.input.keyboard.emit('keydown-SPACE')`);
    assert.strictEqual(H.run(`${platte}.alpha`), 1, 'Weiter im Vorspann zeigt die Platte nicht');
    assert.strictEqual(H.run('window.__ov.seite()'), 0, 'Weiter im Vorspann blaettert');
    assert.ok(eingeblendet(H), 'der Text blendet nicht ein');
    H.run(`${HUB}.input.keyboard.emit('keydown-SPACE')`);
    assert.strictEqual(H.run('window.__ov.seite()'), 1, 'Leertaste blaettert nicht');
    assert.strictEqual(H.run(`${TEIL('aktwechselText')}.text`), seiten[1]);
    // Waehrend des Einblendens: erst fertig zeigen, dann weiter.
    H.run(`${HUB}.input.keyboard.emit('keydown-ENTER')`);
    assert.strictEqual(H.run(`${TEIL('aktwechselText')}.alpha`), 1);
    assert.strictEqual(H.run('window.__zu'), 0, 'schloss waehrend des Einblendens');
    for (let s = 2; s < seiten.length; s++) H.run(`${HUB}.input.keyboard.emit('keydown-ENTER'); ${HUB}.input.keyboard.emit('keydown-ENTER')`);
    // Letzte Seite: Klick/Tippen schliesst.
    H.run(`${TEIL('aktwechselGrund')}.emit('pointerdown')`);
    assert.strictEqual(H.run('window.__zu'), 1, 'Klick auf der letzten Seite schliesst nicht');
    assert.strictEqual(reste(H).objekte, 0);
    assert.strictEqual(reste(H).uhr, null);
  });

  test('Seiten aller Akte (DE + EN): nichts verloren, kein Zitat zerrissen', () => {
    const r = H.run(`(function () { var out = [];
      ['de', 'en'].forEach(function (l) { window.i18n.setLanguage(l);
        ['1', '2', '3', '4', '5', 'epilog'].forEach(function (n) {
          var t = window.storySystem.probeEreignis(n).narrative;
          out.push({ n: n + l, t: t, s: window.Aktwechsel.seitenAus(t, function () { return true; }, 150) });
        }); });
      window.i18n.setLanguage('de'); return JSON.stringify(out); })()`);
    for (const { n, t, s } of JSON.parse(r)) {
      assert.strictEqual(s.join(' '), t.split('\n\n').map((a) => a.trim()).join(' '), n + ': Text verloren');
      for (const seite of s) {
        const auf = (seite.match(/(^|\s)'/g) || []).length;
        const zu = (seite.match(/'(\s|$)/g) || []).length;
        assert.strictEqual(auf, zu, n + ': Zitat zerrissen: ' + seite);
      }
    }
  });

  test('ESC und "Ueberspringen" schliessen sofort, Trefferflaechen >= 44 px', () => {
    oeffnen(H, `window.storySystem.probeEreignis('2')`);
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
    assert.strictEqual(H.run('window.__zu'), 1, 'ESC schliesst nicht');
    oeffnen(H, `window.storySystem.probeEreignis('2')`);
    const feld = H.run(`(function () { var b = ${TEIL('aktwechselUeberspringen')}.getBounds(); return { w: b.width, h: b.height }; })()`);
    assert.ok(feld.h >= 44 && feld.w >= 44, 'Ueberspringen zu klein: ' + JSON.stringify(feld));
    assert.ok(eingeblendet(H));
    H.run(`${TEIL('aktwechselUeberspringen')}.emit('pointerdown')`);
    assert.strictEqual(H.run('window.__zu'), 1, 'Ueberspringen schliesst nicht');
    assert.strictEqual(reste(H).objekte, 0);
  });

  test('bildschirmfest: scrollFactor 0 rekursiv', () => {
    H.run(`${HUB}.cameras.main.scrollX += 300`);
    oeffnen(H, `window.storySystem.probeEreignis('4')`);
    const schlecht = H.run(`(function () { var r = [];
      (function lauf(o) { if (o.scrollFactorX !== 0 || o.scrollFactorY !== 0) r.push(o.type + ' ' + (o.name || o.text || ''));
        (o.list || []).forEach(lauf); })(${C}); return r; })()`);
    H.run(`window.__ov.ueberspringen(); ${HUB}.cameras.main.scrollX -= 300`);
    assert.strictEqual(schlecht.join(', '), '');
  });

  test('Kontrast aller Texte mind. 4,5:1 (jeder Akt DE, laengste Titel EN)', () => {
    for (const lang of ['de', 'en']) {
      H.run(`window.i18n.setLanguage('${lang}')`);
      // Englisch nur die laengsten Titel — jede Messung rendert ein ganzes Bild.
      for (const n of lang === 'de' ? ['1', '2', '3', '4', '5', 'epilog'] : ['2', '3', 'epilog']) {
        oeffnen(H, `window.storySystem.probeEreignis('${n}')`);
        assert.ok(eingeblendet(H));
        bis(H, `${TEIL('aktwechselWeiter')}.alpha > 0.95`);
        alleLesbar(kontraste(H, TEXTE_IN(`${C}.list`)), 'Akt ' + n + ' ' + lang);
        H.run('window.__ov.ueberspringen()');
      }
    }
    H.run(`window.i18n.setLanguage('de')`);
  });

  test('Englisch: "Act N", englischer Name, Continue/Skip', () => {
    H.run(`window.i18n.setLanguage('en')`);
    oeffnen(H, `window.storySystem.probeEreignis('3')`);
    const r = H.run(`({ akt: ${TEIL('aktwechselAkt')}.text, titel: ${TEIL('aktwechselTitel')}.text,
      weiter: ${TEIL('aktwechselWeiter')}.text,
      skip: ${C}.list.filter(function (o) { return o.type === 'Text' && o.text === 'Skip'; }).length })`);
    H.run(`window.__ov.ueberspringen(); window.i18n.setLanguage('de')`);
    assert.strictEqual(r.akt, 'Act 3');
    assert.strictEqual(r.titel, 'The Double Game');
    assert.strictEqual(r.weiter, 'Continue');
    assert.strictEqual(r.skip, 1);
  });

  test('Pending-Kette: Akt und Epilog nacheinander, keine doppelte Karte', () => {
    H.run(`(function () { var qs = window.questSystem;
      window.__echtAlle = qs.areAllQuestChainsComplete;
      qs.areAllQuestChainsComplete = function () { return true; };
      window.storySystem.resetToAct0(); window.storySystem.advanceToAct(4);
      ${HUB}._checkStoryEvent(); })()`);
    const erst = H.run(`${TEIL('aktwechselTitel')}.text`);
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
    const dann = H.run(`(function () { var t = ${TEIL('aktwechselTitel')}; return t ? t.text : null; })()`);
    const offen = H.run(`${HUB}._dialogOpen`);
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
    const r = H.run(`(function () { var qs = window.questSystem; qs.areAllQuestChainsComplete = window.__echtAlle;
      return { offen: ${HUB}._dialogOpen, naechste: window.storySystem.consumePendingEvent() }; })()`);
    assert.strictEqual(erst, 'Die Quelle');
    assert.strictEqual(dann, 'Epilog', 'der Epilog folgte nicht');
    assert.strictEqual(offen, true);
    assert.strictEqual(r.offen, false, 'nach der Kette bleibt der Hub blockiert');
    assert.strictEqual(r.naechste, null, 'eine Karte ist doppelt faellig');
    assert.strictEqual(reste(H).objekte, 0);
  });

  test('Rueckfall: fehlt das Bild, kommt die alte Karte', () => {
    H.run(`${HUB}.textures.remove('aktwechsel_wahrheit')`);
    oeffnen(H, `window.storySystem.probeEreignis('4')`);
    const r = H.run(`({ neu: !!window.__ov.neu, szene: !!(${C}), seiten: window.__ov.seiten.length })`);
    assert.strictEqual(r.neu, false, 'ohne Bild lief die neue Szene');
    assert.strictEqual(r.szene, false);
    for (let i = 0; i < r.seiten; i++) H.run('window.__ov.weiter()');
    assert.strictEqual(H.run('window.__zu'), 1);
  });
});

describe('?aktprobe=N', () => {
  let H = null;
  before(async () => { H = await hub('?autostart=1&debug=1&aktprobe=3'); });
  after(async () => { if (H) await H.shutdown(); });

  test('zeigt Akt 3 beim Hub-Eintritt, Spielstand unberuehrt', () => {
    const r = H.run(`(function () { var a = ${TEIL('aktwechselAkt')};
      return { akt: a ? a.text : null, index: window.storySystem.getCurrentActIndex(), offen: ${HUB}._dialogOpen }; })()`);
    assert.strictEqual(r.akt, 'Akt 3');
    assert.strictEqual(r.index, 0, 'die Probe hat den Akt verstellt');
    assert.strictEqual(r.offen, true);
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC')`);
    assert.strictEqual(H.run(`${HUB}._dialogOpen`), false);
  });
});
