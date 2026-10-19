// tests/dialogTasteVollText.test.js — keine Taste schneidet einen Satz ab.
//
// Gemeldet (wieder, nach b463): "Es kam schon wieder ein Elara-Dialog, der
// beim Tastendruck abgebrochen ist, statt den Text ganz darzustellen."
//
// b463 hatte den Ereignis-Dialog (showEventChoiceDialog) abgedichtet:
// Leertaste/Enter/ESC zeigen dort erst den ganzen Text. Abgesucht wurden
// danach ALLE Wege, auf denen eine Figur Wort fuer Wort spricht. Undicht waren:
//
//   - E nach Elaras Rettung: sie steht schon mit [E] im Raum, waehrend ihre
//     Rettungsworte laufen. E oeffnete ihr Angebot UEBER dem Rettungsdialog,
//     dessen Text war weg (der wahrscheinlichste Fall der Meldung — im Hub
//     blaettert E jede Dialogseite weiter, also drueckt man es auch hier).
//   - ESC auf Elaras Zeile in der Rettungs-Zwischensequenz beendete die
//     Sequenz mitten im Satz.
//   - E in der geheimen Sitzung blaetterte mitten im Aufbau weiter.
//   - Die Konvoi-Entscheidung: Leertaste/Enter/ESC bzw. die Ziffern wirkten
//     sofort, auch ueber einen halben Satz hinweg.
//   - Im Hub schloss ESC eine Dialogseite mitten im Aufbau, eine Ziffer
//     waehlte mitten im Aufbau.
//   - Elaras erster Riss im Hub: E oeffnete das Gespraech ueber der Szene.
//
// Gedrueckt wird ueber den ECHTEN Tastaturweg (KeyboardManager.onKeyDown):
// Phaser schickt erst 'keydown-NAME', dann 'keydown', und die Key-Objekte der
// Spielszene filtern Wiederholungen — ein blosses emit('keydown-SPACE') saehe
// davon nichts.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const TASTEN = {
  SPACE: { key: ' ', code: 'Space', keyCode: 32 },
  ENTER: { key: 'Enter', code: 'Enter', keyCode: 13 },
  ESC: { key: 'Escape', code: 'Escape', keyCode: 27 },
  E: { key: 'e', code: 'KeyE', keyCode: 69 },
  EINS: { key: '1', code: 'Digit1', keyCode: 49 }
};

/** Ein echter Tastendruck: runter und wieder hoch. */
function taste(H, name) {
  H.run(`(function () {
    var km = window.game.input.keyboard;
    var t = ${JSON.stringify(TASTEN[name])};
    var ev = { type: 'keydown', key: t.key, code: t.code, keyCode: t.keyCode, which: t.keyCode,
      repeat: false, altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0,
      timeStamp: Date.now(), defaultPrevented: false,
      preventDefault: function () {}, stopPropagation: function () {}, stopImmediatePropagation: function () {} };
    km.onKeyDown(ev);
    var hoch = Object.assign({}, ev, { type: 'keyup' });
    km.onKeyUp(hoch);
  })()`);
  H.step(1);
}

const SC = `window.game.scene.getScene('GameScene')`;

describe('Im Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3 });
    H.run(`(function () {
      var sc = ${SC};
      window._playerInvincible = true;
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      // Jeder Ereignis-Dialog wird mitgeschrieben.
      window.__dlgOrig = window.EventSystem.showEventChoiceDialog;
      window.EventSystem.showEventChoiceDialog = function (s, text, knoepfe) {
        (window.__dlg = window.__dlg || []).push({ text: text, knoepfe: (knoepfe || []).length });
        return window.__dlgOrig.apply(this, arguments);
      };
      // Der Text des obersten offenen Ereignis-Dialogs (Tiefe 2501).
      window.__dlgText = function () {
        var t = '';
        sc.children.list.forEach(function (o) { if (o.type === 'Text' && o.depth === 2501) t = String(o.text || ''); });
        return t;
      };
    })()`);
  });
  after(async () => { if (H) await H.shutdown(); });

  /** Offene Ereignis-Dialoge per Knopf wegklicken, bis keiner mehr steht. */
  function alleSchliessen() {
    for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) {
      H.run(`(function () {
        var sc = ${SC};
        var k = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input; });
        if (k.length) k[k.length - 1].emit('pointerdown');
      })()`);
      H.step(1);
    }
  }

  test('E nach Elaras Rettung oeffnet nicht ihr Angebot ueber den Rettungsworten', () => {
    const r = H.run(`(function () {
      var sc = ${SC};
      var qs = window.questSystem, st = qs.getQuestSaveData();
      st.quests = { harren_daughter_investigation: { status: 'completed', objectives: [] } };
      st.flags = {};
      qs.loadQuestSaveData(st);
      window.__dlg = [];
      // Wie nach der Zwischensequenz: erst steht sie mit [E] im Raum, dann
      // laufen ihre Worte (roomManager._elaraRettet).
      _spawnElaraSprite(sc, 1, { x: player.x + 30, y: player.y });
      var el = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0' && o.active; })[0];
      if (el) { el.x = player.x + 30; el.y = player.y; }
      _begegnungSpielen(sc, ELARA_SZENEN.rettung.seiten());
      return { elara: !!el, dialoge: window.__dlg.length };
    })()`);
    assert.ok(r.elara, 'Elara steht nicht im Raum');
    assert.strictEqual(r.dialoge, 1, 'die Rettungsworte kamen nicht');
    H.step(2);
    const vorher = H.run('window.__dlgText()');
    const voll = H.run('window.__dlg[0].text');
    assert.ok(vorher.length < voll.length, 'der Text steht schon ganz da, der Fall wird nicht geprueft');

    taste(H, 'E');
    assert.strictEqual(H.run('window.__dlg.length'), 1,
      'E hat einen zweiten Dialog ueber den Rettungsworten geoeffnet: ' + H.run('JSON.stringify(window.__dlg.map(function (d) { return d.text.slice(0, 40); }))'));
    assert.strictEqual(H.run(`window.questSystem.hasFlag('elaraMet')`), false, 'E hat ihr Angebot schon angenommen');
    assert.ok(H.run('window.__dlgText()').length >= vorher.length, 'der Rettungstext ist verschwunden');

    // Danach gehoert E wieder ihr: Rettung zu Ende, dann spricht man sie an.
    alleSchliessen();
    assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'der Rettungsdialog ging nicht zu');
    const n = H.run('window.__dlg.length');
    taste(H, 'E');
    assert.strictEqual(H.run('window.__dlg.length'), n + 1, 'nach dem Dialog oeffnet E ihr Angebot nicht mehr');
    alleSchliessen();
  });

  test('Ein-Knopf-Dialog: Leertaste, Enter und ESC zeigen erst den ganzen Text, E schliesst nichts', () => {
    const TEXT = 'ELARA: Der Nebel wird dichter, je tiefer du gehst. Halte dich an das Licht, sonst findest du den Rueckweg nicht mehr.';
    for (const name of ['SPACE', 'ENTER', 'ESC']) {
      H.run(`(function () {
        window.__weiter = 0;
        window.EventSystem.showEventChoiceDialog(${SC}, ${JSON.stringify(TEXT)}, [{ label: 'Weiter', callback: function () { window.__weiter++; } }]);
      })()`);
      H.step(1);
      assert.ok(H.run('window.__dlgText()').length < TEXT.length, name + ': der Text steht schon ganz da');
      taste(H, 'E');
      assert.strictEqual(H.run('window.__weiter'), 0, name + ': E hat den Dialog bestaetigt');
      assert.strictEqual(H.run('!!window.eventChoiceOpen'), true, name + ': E hat den Dialog geschlossen');
      taste(H, name);
      assert.strictEqual(H.run('window.__dlgText()'), TEXT, name + ': der erste Druck zeigte den Text nicht ganz');
      assert.strictEqual(H.run('window.__weiter'), 0, name + ': der erste Druck schloss den Dialog');
      taste(H, name);
      assert.strictEqual(H.run('window.__weiter'), 1, name + ': der zweite Druck bestaetigte nicht');
    }
  });

  test('Geheime Sitzung: E zeigt erst den ganzen Satz, dann die naechste Seite', () => {
    H.run(`(function () {
      window.__sbAlt = window.SitzungsBuehne;
      window.SitzungsBuehne = null;      // die gezeichnete Fassung, ohne Bilder nachzuladen
      window.__dlg = [];
      window.__sitzungFertig = false;
      window.storyScenes.playGeheimeSitzung(${SC}, function () { window.__sitzungFertig = true; });
      window.SitzungsBuehne = window.__sbAlt;
    })()`);
    H.step(1);
    const voll = H.run('window.__dlg[0].text');
    assert.ok(H.run('window.__dlgText()').length < voll.length, 'der Satz steht schon ganz da');
    taste(H, 'E');
    assert.strictEqual(H.run('window.__dlg.length'), 1, 'E hat mitten im Satz weitergeblaettert');
    assert.strictEqual(H.run('window.__dlgText()'), voll, 'E hat den Satz nicht zu Ende gezeigt');
    taste(H, 'E');
    assert.strictEqual(H.run('window.__dlg.length'), 2, 'das zweite E blaetterte nicht weiter');
    for (let i = 0; i < 40 && !H.run('window.__sitzungFertig'); i++) { taste(H, 'E'); taste(H, 'E'); }
    assert.ok(H.run('window.__sitzungFertig'), 'die Sitzung lief nicht zu Ende');
  });

  test('Rettungs-Zwischensequenz: ESC schneidet Elaras Zeile nicht ab', () => {
    H.run(`(function () {
      var sc = ${SC};
      sc.__rettungsSzene = null;
      window.__rsFertig = false;
      window.RettungsSzene.spielen(sc, { wachen: [], platz: { x: player.x + 40, y: player.y }, vertreiben: function () {} },
        function () { window.__rsFertig = true; });
    })()`);
    H.step(2);
    // ESC waehrend des Auftritts springt zu ihrer Zeile (die Ueberspringen-Geste).
    taste(H, 'ESC');
    const auf = H.run(`(function () { var z = ${SC}.__rettungsSzene; return { phase: z.phase, laeuft: !!(z.lauf && z.lauf.laeuft()) }; })()`);
    assert.strictEqual(auf.phase, 'rede', 'ESC sprang nicht zu ihrer Zeile');
    assert.ok(auf.laeuft, 'die Zeile steht schon ganz da, der Fall wird nicht geprueft');
    taste(H, 'ESC');
    const nach = H.run(`(function () { var z = ${SC}.__rettungsSzene; return { phase: z.phase, laeuft: !!(z.lauf && z.lauf.laeuft()) }; })()`);
    assert.strictEqual(nach.phase, 'rede', 'das zweite ESC beendete die Sequenz mitten in ihrer Zeile');
    assert.strictEqual(nach.laeuft, false, 'das zweite ESC zeigte die Zeile nicht zu Ende');
    H.step(30);
    taste(H, 'ESC');
    assert.strictEqual(H.run(`${SC}.__rettungsSzene.phase`), 'ausklang', 'das dritte ESC beendete die Sequenz nicht');
    for (let i = 0; i < 200 && !H.run('window.__rsFertig'); i++) H.step(5);
    assert.ok(H.run('window.__rsFertig'), 'die Sequenz lief nicht aus');
  });

  test('Konvoi-Entscheidung: die Ziffer waehlt nicht ueber einen halben Satz hinweg', () => {
    const r = H.run(`(function () {
      var qs = window.questSystem, st = qs.getQuestSaveData();
      st.flags = {};                    // noch keine Konvoi-Entscheidung
      qs.loadQuestSaveData(st);
      var z = window.Finale.konvoi(${SC});
      return !!z;
    })()`);
    assert.ok(r, 'die Konvoi-Entscheidung ging nicht auf');
    const zustand = () => H.run(`(function () {
      var z = ${SC}.__konvoiDialog;
      if (!z) return null;
      var t = ''; z.box.list.forEach(function (o) { if (o.type === 'Text' && String(o.text).length > t.length) t = String(o.text); });
      return { text: z.text, steht: t, offen: true };
    })()`);
    H.step(25);                       // ueber die 300-ms-Sperre nach dem Aufgehen
    const a = zustand();
    assert.ok(a && a.steht.length < a.text.length, 'der Text steht schon ganz da, der Fall wird nicht geprueft');
    taste(H, 'EINS');
    const b = zustand();
    assert.ok(b, 'die Ziffer hat mitten im Satz gewaehlt');
    assert.ok(b.steht.length >= b.text.length - 2, 'die Ziffer hat den Satz nicht zu Ende gezeigt');
    alleKonvoi();
    function alleKonvoi() {
      for (let i = 0; i < 10 && H.run(`!!${SC}.__konvoiDialog`); i++) H.run(`${SC}.__konvoiDialog.waehle(0); 1`);
    }
  });
});

describe('Im Hub', () => {
  let H = null;
  const HUB = `window.game.scene.getScene('HubSceneV2')`;
  before(async () => {
    H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 wurde nicht erreicht');
    H.step(10);
  });
  after(async () => { if (H) await H.shutdown(); });

  const LANG = 'Ein langer Satz, der sich Wort fuer Wort aufbaut und deshalb eine ganze Weile braucht, bis er vollstaendig dasteht, damit man ihn in Ruhe lesen kann.';

  function seiteOeffnen(seiten) {
    H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      sc._dialogOpen = true;
      window.__wahl = 0;
      sc._handleDialogueChoiceAlt = sc._handleDialogueChoiceAlt || sc._handleDialogueChoice;
      sc._handleDialogueChoice = function () { window.__wahl++; };
      sc._showDialoguePages({ id: 'harren', name: 'Harren' }, 'HARREN', ${JSON.stringify(seiten)}, 'talk', null, 0);
    })()`);
    H.step(2);   // die Tasten binden einen Tick spaeter
  }
  const offen = () => H.run(`!!${HUB}._dialogOpen`);
  const laeuft = () => H.run(`${HUB}._dialogTextLaeuft()`);

  test('ESC schliesst eine Dialogseite erst, wenn der Text ganz dasteht', () => {
    seiteOeffnen([{ text: LANG }]);
    assert.ok(laeuft(), 'der Text steht schon ganz da, der Fall wird nicht geprueft');
    taste(H, 'ESC');
    assert.ok(offen(), 'ESC hat den Dialog mitten im Satz geschlossen');
    assert.strictEqual(laeuft(), false, 'ESC hat den Text nicht zu Ende gezeigt');
    taste(H, 'ESC');
    assert.strictEqual(offen(), false, 'das zweite ESC schloss nicht');
  });

  test('Ein gehaltenes Enter ueberspringt nicht und schliesst gleich mit', () => {
    // Der Hub hat fuer Enter und E keine Key-Objekte (die Leertaste bringt
    // createCursorKeys mit): Phaser reicht die Wiederholungen der gehaltenen
    // Taste als neue keydown durch.
    seiteOeffnen([{ text: LANG }]);
    assert.ok(laeuft(), 'der Text steht schon ganz da, der Fall wird nicht geprueft');
    // Jedes Ereignis in einem eigenen Bild: Phaser verwirft ein keydown mit
    // demselben Zeitstempel wie das vorige, und die Warteschlange leert sich
    // erst am Ende des Bildes.
    const roh = (typ, wdh) => {
      H.run(`(function () {
        var km = window.game.input.keyboard;
        var ev = { type: '${typ}', key: 'Enter', code: 'Enter', keyCode: 13, which: 13, repeat: ${wdh},
          altKey: false, ctrlKey: false, shiftKey: false, metaKey: false, location: 0, timeStamp: Date.now(),
          defaultPrevented: false, preventDefault: function () {}, stopPropagation: function () {}, stopImmediatePropagation: function () {} };
        if (ev.type === 'keydown') km.onKeyDown(ev); else km.onKeyUp(ev);
      })()`);
      H.step(1);
    };
    roh('keydown', false);
    roh('keydown', true);
    roh('keydown', true);
    roh('keyup', false);
    H.step(1);
    assert.strictEqual(laeuft(), false, 'der Druck hat den Text nicht zu Ende gezeigt');
    assert.ok(offen(), 'die Wiederholung der gehaltenen Taste hat den Dialog gleich geschlossen');
    H.run(`${HUB}._closeDialog(null); 1`);
  });

  test('Eine Ziffer waehlt erst, wenn der Text ganz dasteht', () => {
    seiteOeffnen([{ text: LANG, choices: [{ label: 'Ja', action: 'decline' }, { label: 'Nein', action: 'decline' }] }]);
    assert.ok(laeuft(), 'der Text steht schon ganz da, der Fall wird nicht geprueft');
    taste(H, 'EINS');
    assert.strictEqual(H.run('window.__wahl'), 0, 'die Ziffer hat mitten im Satz gewaehlt');
    assert.strictEqual(laeuft(), false, 'die Ziffer hat den Text nicht zu Ende gezeigt');
    taste(H, 'EINS');
    assert.strictEqual(H.run('window.__wahl'), 1, 'die zweite Ziffer waehlte nicht');
    H.run(`(function () { var sc = ${HUB}; sc._handleDialogueChoice = sc._handleDialogueChoiceAlt; sc._closeDialog(null); })()`);
  });

  test('Elaras erster Riss: E oeffnet kein Gespraech ueber der Szene, eine Taste zeigt den Satz zu Ende', () => {
    const r = H.run(`(function () {
      var sc = ${HUB};
      try { sc._closeDialog(null); } catch (e) {}
      var elara = sc.npcs.filter(function (n) { return n.data && n.data.id === 'elara'; })[0]
        || sc.npcs.filter(function (n) { return n.data; })[0];
      window.__gespraeche = 0;
      sc._showNpcDialogueAlt = sc._showNpcDialogueAlt || sc._showNpcDialogue;
      sc._showNpcDialogue = function () { window.__gespraeche++; };
      // Die Szene so starten, wie der Hub es beim Annehmen tut.
      sc._dialogOpen = true;
      sc._handleDialogueChoice('accept', elara.data, 'Elara', [{ text: 'x' }], 'offer', { id: 'elara_second_truth' }, 0, []);
      window.__elaraDaten = elara.data;
      return true;
    })()`);
    assert.ok(r);
    H.step(2);
    // Der Spieler steht noch bei ihr: E haette ein Ziel. Unmittelbar vor dem
    // Druck gesetzt — jedes Bild rechnet das Ziel aus der Naehe neu aus.
    H.run(`${HUB}._activeInteractable = { type: 'npc', data: window.__elaraDaten }; 1`);
    taste(H, 'E');
    assert.strictEqual(H.run('window.__gespraeche'), 0, 'E hat das Gespraech ueber der Szene geoeffnet');
    const wartet = H.run(`!!${HUB}.__szeneWartet`);
    assert.ok(wartet, 'die Taste hat den Satz nicht zu Ende gezeigt (die Szene wartet nicht auf Weiter)');
    H.run(`(function () { var sc = ${HUB}; sc._showNpcDialogue = sc._showNpcDialogueAlt; if (sc.__szeneWartet) sc.__szeneWartet.ausloesen(); })()`);
  });
});
