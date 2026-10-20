// tests/dialogSeiten.test.js — zu lange Dialogseiten werden geblaettert.
//
// Gemeldet: "Der Dialog von «Wer du warst» ist so lang, dass es eine
// Scrollbar braucht." Brankas Abgabetext (drei Absaetze) war hoeher als der
// Kasten; der Kasten selbst ragte unten 40 px aus dem Bild. Jetzt teilt der
// Hub jede zu lange Seite an Absaetzen, dann an Saetzen (js/dialogSeiten.js),
// die Auswahl steht nur auf der letzten Seite. Gilt fuer JEDE Seite des
// NPC-Dialogs und fuer den Ereignis-Dialog im Dungeon.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const DS = require('../js/dialogSeiten.js');
const { launch } = require('../tools/headless/index.js');

describe('Die Teilregel', () => {
  // "passt" nach Zeichenzahl — die Regel ist dieselbe, nur die Messung einfacher.
  const bis = (n) => (t) => t.length <= n;

  test('ein Text, der passt, bleibt eine Seite und unveraendert', () => {
    const t = 'BRANKA: Kurz.\n\nNoch kuerzer.';
    assert.deepStrictEqual(DS.teilen(t, bis(100)), [{ text: t, scrollen: false }]);
  });

  test('geteilt wird zuerst an Absaetzen', () => {
    const t = 'Erster Absatz mit zwei Saetzen. Hier der zweite.\n\nZweiter Absatz. Auch zwei.';
    const s = DS.teilen(t, bis(50));
    assert.deepStrictEqual(s.map((x) => x.text), ['Erster Absatz mit zwei Saetzen. Hier der zweite.', 'Zweiter Absatz. Auch zwei.']);
  });

  test('ein zu langer Absatz wird an Saetzen geteilt, nie mitten im Wort', () => {
    const t = 'Eins zwei drei. Vier fuenf sechs! Sieben acht neun? Zehn elf, z. B. zwoelf.';
    const s = DS.teilen(t, bis(36));
    assert.ok(s.length > 1, 'nicht geteilt');
    s.forEach((x) => {
      assert.ok(x.text.length <= 36 || x.scrollen, 'Seite zu lang: ' + x.text);
      assert.match(x.text, /[.!?]$/, 'Seite endet nicht am Satzende: ' + x.text);
    });
    // Nichts geht verloren, nichts wird zerschnitten.
    assert.strictEqual(s.map((x) => x.text).join(' '), t);
    assert.ok(!s.some((x) => /^B\./.test(x.text)), '"z. B." wurde als Satzende genommen');
  });

  test('der Sprecher steht auf jeder Seite', () => {
    const s = DS.teilen('THOM: Erster Satz hier. Zweiter Satz hier.', bis(30));
    assert.deepStrictEqual(s.map((x) => x.text), ['THOM: Erster Satz hier.', 'THOM: Zweiter Satz hier.']);
  });

  test('nur ein einzelner Riesensatz rollt', () => {
    const s = DS.teilen('Kurz. Ein sehr langer Satz, der auch allein nicht passt. Kurz.', bis(20));
    assert.deepStrictEqual(s.map((x) => x.scrollen), [false, true, false]);
  });
});

describe('Im Hub', () => {
  let H = null;
  const HUB = `window.game.scene.getScene('HubSceneV2')`;
  const TASTEN = {
    E: { key: 'e', code: 'KeyE', keyCode: 69 },
    SPACE: { key: ' ', code: 'Space', keyCode: 32 }
  };
  function taste(name) {
    H.run(`(function () {
      var km = window.game.input.keyboard, t = ${JSON.stringify(TASTEN[name])};
      var ev = { type: 'keydown', key: t.key, code: t.code, keyCode: t.keyCode, which: t.keyCode,
        repeat: false, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0,
        timeStamp: Date.now(), defaultPrevented: false,
        preventDefault: function () {}, stopPropagation: function () {}, stopImmediatePropagation: function () {} };
      km.onKeyDown(ev);
      km.onKeyUp(Object.assign({}, ev, { type: 'keyup' }));
    })()`);
    H.step(2);
  }

  /** Quest-Stand: { id: 'completed' | 'ready' }. */
  const STAND = (eintraege) => H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = {};
    var e = ${JSON.stringify(eintraege)};
    Object.keys(e).forEach(function (id) {
      var d = qs.QUEST_DEFINITIONS[id];
      st.quests[id] = { status: e[id] === 'ready' ? 'active' : e[id], objectives: d.objectives.map(function (o) {
        return { type: o.type, target: o.target, current: o.required, required: o.required }; }) };
    });
    qs.loadQuestSaveData(st);
    return true;
  })()`);

  /**
   * Die offene Seite, vermessen: Text, Seitenzahl, Knoepfe, und ob alles im
   * Kasten und der Kasten im Bild liegt.
   */
  const seite = () => H.run(`(function () {
    var sc = ${HUB}, c = sc._dialogContainer;
    if (!c || !c.scene) return null;
    var cam = sc.cameras.main;
    var texte = c.list.filter(function (o) { return o.type === 'Text'; });
    var rumpf = texte.filter(function (o) { return o.style && o.style.fontFamily === 'monospace' && Number(o.style.fontSize.replace ? o.style.fontSize.replace('px', '') : o.style.fontSize) === 16 && !o.input; })[0];
    var zahl = texte.filter(function (o) { return /^\\d+\\/\\d+$/.test(String(o.text)); })[0];
    var knoepfe = texte.filter(function (o) { return o.input && o.input.enabled; });
    var hinweis = texte.filter(function (o) { return o.originY === 1; })[0];
    // Der Kasten ohne den gerollten Text (der reicht unter seiner Maske weiter).
    var b = { top: 1e9, bottom: -1e9 };
    c.list.forEach(function (o) {
      if (o.mask || o.type === 'Zone' || !o.getBounds) return;
      var ob = o.getBounds();
      b.top = Math.min(b.top, ob.top); b.bottom = Math.max(b.bottom, ob.bottom);
    });
    var unten = rumpf.y + rumpf.height;
    return {
      text: String(rumpf.text), laeuft: sc._dialogTextLaeuft(), zahl: zahl ? String(zahl.text) : null,
      knoepfe: knoepfe.map(function (k) { return String(k.text); }),
      imBild: b.top >= 0 && b.bottom <= cam.height, oben: Math.round(b.top), unten: Math.round(b.bottom),
      textUnten: unten, ersterKnopf: knoepfe.length ? Math.min.apply(null, knoepfe.map(function (k) { return k.y; })) : null,
      hinweisOben: hinweis ? hinweis.y - hinweis.height : null,
      maske: !!rumpf.mask
    };
  })()`);

  /** Erst den Text zu Ende holen, dann vermessen. */
  function ganzeSeite() {
    if (H.run(`${HUB}._dialogTextLaeuft()`)) H.run(`${HUB}._dialogTextUeberspringen()`);
    const s = seite();
    assert.ok(s, 'kein Dialog offen');
    return s;
  }

  function pruefeLage(s, wo) {
    assert.ok(s.imBild, wo + ': der Kasten ragt aus dem Bild (' + s.oben + '..' + s.unten + ')');
    if (s.ersterKnopf != null) assert.ok(s.textUnten <= s.ersterKnopf, wo + ': der Text laeuft in die Knoepfe');
    if (s.hinweisOben != null) assert.ok(s.textUnten <= s.hinweisOben, wo + ': der Text laeuft in den Hinweis');
  }

  function oeffne(npc) {
    H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = false;
      var n = sc.npcs.filter(function (x) { return x.data && x.data.id === '${npc}'; })[0];
      sc._dialogOpen = true;
      sc._showNpcDialogue(n.data);
    })()`);
    H.step(2);   // Tasten binden einen Tick spaeter
  }

  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
    H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
    H.step(20);
    H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog([]); } catch (e) {} sc._dialogOpen = false; })()`);
  });
  after(async () => {
    if (H) { H.run(`window.i18n.setLanguage('de')`); await H.shutdown(); }
  });

  for (const lang of ['de', 'en']) {
    test(lang + ': "Wer du warst" bei Branka abgeben — mehrere Seiten, keine laeuft ueber, Auswahl nur zuletzt', () => {
      H.run(`window.i18n.setLanguage('${lang}')`);
      STAND({ who_you_were: 'ready' });
      const voll = H.run(`window.questSystem.QUEST_DEFINITIONS.who_you_were.dialogueComplete`);
      oeffne('branka');

      // Der Abschlusstext (geteilt), dann Brankas Auswahl (DialogChoice),
      // ihre Antwort und die Belohnung mit dem Abgabeknopf.
      const auswahlOffen = () => H.run(`${HUB}.children.list.some(function (o) { return o.name === 'dialogChoiceContainer' && o.active; })`);
      const seiten = [];
      for (let i = 0; i < 8; i++) {
        const s = seite();
        if (!s && auswahlOffen()) break;
        assert.ok(s, 'Dialog ging vor der Auswahl zu');
        if (i === 0) {
          // Der Wortaufbau laeuft: die erste Taste zeigt den Text ganz,
          // blaettert aber nicht um.
          assert.ok(s.laeuft, 'der Text baut sich nicht auf');
          taste('E');
          const nach = seite();
          assert.strictEqual(nach.laeuft, false, 'E hat den Text nicht zu Ende gezeigt');
          assert.strictEqual(nach.zahl, s.zahl, 'E hat mitten im Aufbau umgeblaettert');
        }
        const g = ganzeSeite();
        pruefeLage(g, lang + ' Seite ' + (i + 1));
        seiten.push(g);
        if (g.knoepfe.length) break;
        taste('E');
      }
      assert.ok(auswahlOffen(), 'Brankas Auswahl kam nicht');
      const text = seiten;
      assert.ok(text.length >= 2, 'der Abgabetext wurde nicht geteilt (' + text.length + ' Seite)');
      // Zusammen ergeben die Seiten den ganzen Text, an Absatz- oder Satzgrenzen.
      assert.strictEqual(text.map((s) => s.text).join(' ').replace(/\s+/g, ' '), voll.replace(/\s+/g, ' '));
      const gesamt = Number(text[0].zahl.split('/')[1]);
      assert.ok(gesamt >= text.length + 2, 'die Seitenzahl zaehlt Auswahl und Belohnung nicht mit: ' + text[0].zahl);
      text.forEach((s, k) => {
        assert.strictEqual(s.knoepfe.length, 0, 'Seite ' + (k + 1) + ' hat Knoepfe');
        assert.strictEqual(s.zahl, (k + 1) + '/' + gesamt, 'Seitenzahl');
        assert.match(s.text, /[.!?)]$/, 'Seite ' + (k + 1) + ' endet mitten im Satz');
      });

      // Waehlen, die Antwort lesen; danach die Belohnung mit ihrem einen Knopf.
      H.run(`(function () {
        var c = ${HUB}.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; }).pop();
        c.list.filter(function (o) { return o.name === 'dialogChoiceKnopf'; })[0].emit('pointerup');
      })()`);
      H.step(2);
      let letzte = null;
      for (let i = 0; i < 4; i++) {
        const g = ganzeSeite();
        pruefeLage(g, lang + ' nach der Auswahl, Seite ' + (i + 1));
        if (g.knoepfe.length) { letzte = g; break; }
        taste('E');
      }
      assert.ok(letzte, 'die Belohnungsseite kam nicht');
      assert.strictEqual(letzte.knoepfe.length, 1, 'die Belohnungsseite hat nicht genau einen Knopf');
      assert.strictEqual(H.run(`window.questSystem.getQuestSaveData().quests.who_you_were.status`), 'active',
        'die Abgabe lief schon beim Blaettern');
      H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog(null); } catch (e) {} })()`);
      H.run(`window.i18n.setLanguage('de')`);
    });
  }

  test('Tippen (Mobile): der erste Tipp zeigt den Text ganz, der zweite blaettert', () => {
    STAND({ who_you_were: 'ready' });
    oeffne('branka');
    const tipp = () => { H.run(`${HUB}.input.emit('pointerdown', window.game.input.activePointer)`); H.step(2); };
    const a = seite();
    assert.ok(a.laeuft, 'der Text baut sich nicht auf');
    tipp();
    const b = seite();
    assert.strictEqual(b.laeuft, false, 'der Tipp zeigte den Text nicht ganz');
    assert.strictEqual(b.zahl, a.zahl, 'der erste Tipp blaetterte um');
    tipp();
    const c = seite();
    assert.notStrictEqual(c.zahl, a.zahl, 'der zweite Tipp blaetterte nicht um');
    H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog(null); } catch (e) {} })()`);
  });

  test('kurze Seiten bleiben, wie sie sind', () => {
    const r = H.run(`(function () {
      var sc = ${HUB};
      var seiten = [{ text: 'Kurz und knapp.', choices: null }, { text: 'Zweite Zeile.', choices: [{ label: 'Ok', action: 'decline' }] }];
      sc._dialogSeitenEinpassen({ id: 'harren', name: 'Harren' }, 'Harren', seiten, 'flavor', 0);
      return seiten.map(function (s) { return s.text + '|' + (s.choices ? s.choices.length : 0); });
    })()`);
    assert.deepStrictEqual(Array.from(r), ['Kurz und knapp.|0', 'Zweite Zeile.|1']);
  });

  test('eine lange Info-Seite ("Mehr erfahren") wird mit ihren Fortsetzungen gezeigt', () => {
    const satz = 'Diese Aufgabe fuehrt tief unter das Rathaus, wo die Akten liegen, die keiner lesen soll. ';
    const info = satz.repeat(5) + '\n\n' + satz.repeat(5);
    H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = true;
      sc._showDialoguePages({ id: 'harren', name: 'Harren' }, 'Harren', [
        { text: 'Willst Du mehr wissen?', choices: [{ label: 'Mehr', action: 'info' }, { label: 'Nein', action: 'decline' }] },
        { text: ${JSON.stringify(info)}, choices: [{ label: 'Ja', action: 'accept' }, { label: 'Nein', action: 'decline' }], _isInfoPage: true }
      ], 'offer', null, 0);
    })()`);
    H.step(2);
    assert.strictEqual(ganzeSeite().knoepfe.length, 2);
    H.run(`(function () {
      var c = ${HUB}._dialogContainer;
      c.list.filter(function (o) { return o.input && String(o.text) === 'Mehr'; })[0].emit('pointerdown', window.game.input.activePointer, 0, 0, { stopPropagation: function () {} });
    })()`);
    H.step(2);
    const gesehen = [];
    for (let i = 0; i < 6; i++) {
      const g = ganzeSeite();
      pruefeLage(g, 'Info-Seite ' + (i + 1));
      gesehen.push(g);
      if (g.knoepfe.length) break;
      taste('SPACE');
    }
    assert.ok(gesehen.length >= 2, 'die Info-Seite wurde nicht geteilt oder brach ab');
    assert.strictEqual(gesehen[0].zahl, '1/' + gesehen.length, 'Seitenzahl der Info-Seiten');
    assert.strictEqual(gesehen[gesehen.length - 1].knoepfe.length, 2, 'die Wahl fehlt auf der letzten Info-Seite');
    H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog(null); } catch (e) {} })()`);
  });

  test('Maras lange Seite: Text, Dienst-Knoepfe und Hinweis ueberlappen nicht', () => {
    const satz = 'Ich kenne jeden Schmuggelweg unter dieser Stadt, und jeder kostet etwas. ';
    const lang = satz.repeat(6) + '\n\n' + satz.repeat(6);
    H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = true;
      sc._showDialoguePages({ id: 'mara', name: 'Mara' }, 'Mara', [{ text: ${JSON.stringify(lang)}, choices: null }], 'flavor', null, 0);
    })()`);
    H.step(2);
    const zahl = [];
    for (let i = 0; i < 6; i++) {
      const g = ganzeSeite();
      pruefeLage(g, 'Mara Seite ' + (i + 1));
      assert.ok(g.knoepfe.length >= 1, 'Maras Dienst-Knoepfe fehlen');
      zahl.push(g.zahl);
      if (!g.zahl || g.zahl.split('/')[0] === g.zahl.split('/')[1]) break;
      taste('SPACE');
    }
    assert.ok(zahl.length >= 2, 'nicht geteilt');
    H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog(null); } catch (e) {} })()`);
  });

  test('ein einzelner Riesensatz rollt (Mausrad), Tippen auf den Text blaettert nicht', () => {
    const riese = 'Dieser Satz ' + 'wird immer laenger und laenger '.repeat(40) + 'bis er endet.';
    H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = true;
      window.__radVorher = sc.input.listenerCount('wheel');
      sc._showDialoguePages({ id: 'harren', name: 'Harren' }, 'Harren', [{ text: ${JSON.stringify(riese)}, choices: null }, { text: 'Danach.', choices: null }], 'flavor', null, 0);
    })()`);
    H.step(2);
    const g = ganzeSeite();
    assert.ok(g.maske, 'der Text hat keine Maske');
    assert.ok(g.imBild, 'der Kasten ragt aus dem Bild');
    const r = H.run(`(function () {
      var sc = ${HUB}, c = sc._dialogContainer;
      var rumpf = c.list.filter(function (o) { return o.type === 'Text' && o.mask; })[0];
      var y0 = rumpf.y;
      sc.input.emit('wheel', window.game.input.activePointer, [], 0, 200, 0);
      var y1 = rumpf.y;
      // Druck auf den Textbereich: die Zone verschluckt ihn, kein Umblaettern.
      var zone = c.list.filter(function (o) { return o.type === 'Zone'; })[0];
      var ev = { stopPropagation: function () { ev.gestoppt = true; } };
      zone.emit('pointerdown', window.game.input.activePointer, 0, 0, ev);
      return { y0: y0, y1: y1, gestoppt: !!ev.gestoppt, leiste: c.list.filter(function (o) { return o.type === 'Rectangle'; }).length };
    })()`);
    assert.ok(r.y1 < r.y0, 'das Mausrad rollt den Text nicht');
    assert.ok(r.gestoppt, 'der Druck auf den Text ginge an die Szene (blaetterte um)');
    assert.ok(r.leiste >= 2, 'keine Bildlaufleiste');
    H.run(`(function () { var sc = ${HUB}; try { sc._closeDialog(null); } catch (e) {} })()`);
    assert.strictEqual(H.run(`${HUB}.input.listenerCount('wheel')`), H.run('window.__radVorher'), 'der Mausrad-Hoerer blieb nach dem Schliessen haengen');
  });

  test('Ereignis-Dialog: zu langer Text wird mit "Weiter" geblaettert, Wahlen nur zuletzt', () => {
    const absatz = 'Elara bleibt im Schatten stehen und spricht leise, als koennte der Nebel mithoeren. '.repeat(5);
    const text = 'ELARA: ' + [absatz, absatz, absatz, absatz].join('\n\n');
    H.run(`(function () {
      var sc = ${HUB};
      window.__wahl = null;
      window.EventSystem.showEventChoiceDialog(sc, ${JSON.stringify(text)}, [
        { label: 'Ja', callback: function () { window.__wahl = 'ja'; } },
        { label: 'Nein', callback: function () { window.__wahl = 'nein'; } }
      ]);
    })()`);
    const blick = () => H.run(`(function () {
      var sc = ${HUB}, cam = sc.cameras.main;
      var t = sc.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 2501; }).pop();
      var k = sc.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 2503; });
      var unten = Math.max.apply(null, k.map(function (o) { return o.y + o.height / 2; }));
      return { text: String(t.text), knoepfe: k.map(function (o) { return String(o.text); }),
        oben: t.y - t.height / 2, unten: unten, h: cam.height };
    })()`);
    const gesehen = [];
    for (let i = 0; i < 8 && H.run('!!window.eventChoiceOpen'); i++) {
      taste('SPACE');                 // erst den ganzen Text
      const b = blick();
      assert.ok(b.oben >= 0 && b.unten <= b.h, 'Seite ' + (i + 1) + ' ragt aus dem Bild');
      assert.ok(b.text.startsWith('ELARA: '), 'der Sprecher fehlt auf Seite ' + (i + 1));
      gesehen.push(b);
      if (b.knoepfe.length > 1) break;
      assert.match(b.knoepfe[0], /\d+\/\d+$/, 'der Weiter-Knopf nennt die Seite nicht');
      taste('SPACE');                 // weiter
    }
    assert.ok(gesehen.length >= 2, 'nicht geteilt');
    assert.deepStrictEqual(Array.from(gesehen[gesehen.length - 1].knoepfe), ['Ja', 'Nein']);
    // Auf der Wahlseite waehlt eine Taste nie.
    taste('SPACE');
    taste('E');
    assert.strictEqual(H.run('window.__wahl'), null, 'eine Taste hat gewaehlt');
    H.run(`(function () {
      var sc = ${HUB};
      var k = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input; });
      k[0].emit('pointerdown');
    })()`);
    assert.strictEqual(H.run('window.__wahl'), 'ja');
    assert.strictEqual(H.run('!!window.eventChoiceOpen'), false);
  });
});
