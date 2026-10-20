// tests/wiedersehenSzene.test.js — «Das Wiedersehen» als Zwischenszene (b485).
//
// Gemeldet: die Szene "braucht eine Cutscene statt nur Text". Jetzt drei
// Tableaus (Harren mit dem Licht im Fenster, Elara zoegert in der Tuer, die
// Umarmung mit ihrem Blick ueber seine Schulter), Text Wort fuer Wort.
// Geprueft am echten Hub ueber das Gespraech mit Harren in Akt 3:
//   - sie spielt genau einmal, mit ihren Bildern, die Spieluhr steht dabei
//   - erste Taste zeigt den Satz ganz, die naechste blaettert, ESC beendet
//   - kein Druck aus der Szene waehlt in Harrens Frage etwas aus
//   - elara_ist_lene gesetzt, danach bietet Harren «Das versiegelte Archiv» an

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const Z = `${HUB}.__wiedersehen`;
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 wurde nicht erreicht');
  H.step(10);
  // Die Prolog-Karte eines frischen Spiels schliessen, falls sie offen ist.
  H.run(`(function () { var sc = ${HUB}; var k = sc.children.getByName('aktwechsel');
    if (k) { sc.input.keyboard.emit('keydown-ESC'); } sc._dialogOpen = false; })()`);
  H.step(5);
});
after(async () => { if (H) await H.shutdown(); });

function bis(js, max) {
  for (let i = 0; i < (max || 400); i++) {
    if (H.run(js)) return true;
    H.step(3);
  }
  return !!H.run(js);
}
function stand(akt, flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt});
    var st = qs.getQuestSaveData();
    st.quests = {};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
function reden(id) {
  return H.run(`(function () { var sc = ${HUB};
    var e = sc.npcs.filter(function (n) { return n.data && n.data.id === '${id}'; })[0];
    if (!e) return 'kein ' + '${id}';
    sc._dialogOpen = false;
    sc._showNpcDialogue(e.data);
    return null; })()`);
}
const taste = (k) => H.run(`${HUB}.input.keyboard.emit('keydown', { key: '${k}', keyCode: ${k === 'Escape' ? 27 : 32}, repeat: false })`);
const status = () => H.run(`(function () { var z = ${Z}; if (!z) return null;
  return { phase: z.phase, seite: z.seite, bild: z.bild, laeuft: !!(z.lauf && z.lauf.laeuft()),
    text: (function () { var c = ${HUB}.children.getByName('wiedersehen'), r = null;
      (function lauf(l) { l.forEach(function (o) { if (o.name === 'wiedersehenText') r = o.text; if (o.list) lauf(o.list); }); })(c ? c.list : []);
      return r; })() }; })()`);
const choice = () => H.run(`!!${HUB}.children.getByName('dialogChoiceContainer')`);

test('Akt 3 ohne Flagge: Harren spielt die Zwischenszene mit ihren drei Bildern', () => {
  stand(3);
  assert.strictEqual(reden('harren'), null);
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_ist_lene')`), true, 'elara_ist_lene nicht gesetzt');
  assert.ok(bis(`!!${Z} && ${Z}.phase === 'vorspann'`), 'die Szene lief nicht an: ' + JSON.stringify(status()));
  const r = H.run(`(function () { var sc = ${HUB};
    return { bilder: window.WiedersehenSzene.BILDER.map(function (n) { return sc.textures.exists('wiedersehen_' + n); }),
      bild: ${Z}.bild, uhr: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since), zeit: sc.time.paused }; })()`);
  assert.deepStrictEqual(Array.from(r.bilder), [true, true, true], 'Tableaus fehlen');
  assert.strictEqual(r.bild, 'licht');
  assert.ok(r.uhr || r.zeit, 'die Spieluhr laeuft waehrend der Szene');
  assert.strictEqual(choice(), false, 'die Auswahl kam schon waehrend der Szene');
});

test('Erste Taste zeigt den Satz ganz, die naechste blaettert; die Bilder wechseln mit', () => {
  H.step(30);                         // Sperre gegen den ausloesenden Druck
  taste(' ');                         // Vorspann abkuerzen -> Seite 0 schreibt
  assert.ok(bis(`${Z}.phase === 'text' && ${Z}.seite === 0`), 'Vorspann endet nicht');
  H.step(16);
  let s = status();
  assert.strictEqual(s.laeuft, true, 'der Text baut sich nicht Wort fuer Wort auf');
  const voll = H.run(`${Z}.seiten[0].text`);
  assert.notStrictEqual(s.text, voll, 'schon alles da');
  taste(' ');
  s = status();
  assert.strictEqual(s.seite, 0, 'die erste Taste hat geblaettert statt den Satz zu zeigen');
  assert.strictEqual(s.text, voll, 'die erste Taste zeigt den Satz nicht ganz');
  taste(' ');
  assert.strictEqual(status().seite, 1, 'die zweite Taste blaettert nicht');
  // Gehaltene Taste blaettert nichts. Erst den Satz ganz zeigen, damit die
  // Wiederholung blaettern wuerde, wenn sie zaehlte.
  H.step(16);
  taste(' ');
  assert.strictEqual(status().text, H.run(`${Z}.seiten[1].text`), 'Seite 1 nicht ganz');
  H.step(16);
  H.run(`${HUB}.input.keyboard.emit('keydown', { key: ' ', repeat: true })`);
  assert.strictEqual(status().seite, 1, 'eine gehaltene Taste hat etwas getan');
  // Bis zum Zoegern: dort steht das zweite Bild, dann das dritte.
  const gesehen = [];
  for (let i = 0; i < 40 && status() && status().seite < 7; i++) {
    H.step(16);
    taste(' ');
    if (status() && gesehen.indexOf(status().bild) < 0) gesehen.push(status().bild);
  }
  assert.ok(gesehen.indexOf('zoegern') >= 0 && gesehen.indexOf('umarmung') >= 0,
    'die Bilder wechseln nicht: ' + gesehen.join(','));
  const text = H.run(`${Z}.seiten.map(function (s) { return s.sprecher + ': ' + s.text; }).join(' | ')`);
  assert.ok(/Lene/.test(text) && /Elara/.test(text) && /Vater/.test(text) && /Atemzug zu lang/.test(text)
    && /eigenem Willen/.test(text), 'Inhalt fehlt: ' + text);
});

test('ESC beendet die Szene bewusst; kein Druck waehlt in Harrens Frage', () => {
  taste('Escape');
  assert.strictEqual(status().phase, 'ausklang', 'ESC beendet nicht');
  // Weitere Drucke waehrend des Ausblendens duerfen nichts ausloesen.
  taste(' ');
  assert.ok(bis(`!${Z}`), 'die Szene raeumt nicht auf');
  assert.ok(bis(`!!${HUB}.children.getByName('dialogChoiceContainer')`), 'Harrens Frage kam nicht');
  const r = H.run(`(function () { var sc = ${HUB}; return {
    reste: sc.children.list.filter(function (o) { return o.name === 'wiedersehen'; }).length,
    uhr: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since), zeit: sc.time.paused,
    flags: Object.keys(window.questSystem.getQuestSaveData().flags || {}).filter(function (f) { return /harren|wiedersehen/.test(f); }) }; })()`);
  assert.strictEqual(r.reste, 0, 'Teile der Szene bleiben liegen');
  assert.strictEqual(r.uhr || r.zeit, false, 'die Spieluhr steht nach der Szene noch');
  // Die Frage bleibt offen, bis man selbst waehlt.
  H.step(30);
  assert.strictEqual(choice(), true, 'die Frage hat sich von selbst geschlossen (Druck aus der Szene)');
  // Waehlen: die erste Antwort.
  H.run(`(function () { var c = ${HUB}.children.getByName('dialogChoiceContainer'), b = null;
    (function lauf(l) { l.forEach(function (o) { if (!b && (o.name === 'dialogChoiceKnopf' || (o.input && o.type === 'Zone'))) b = o; if (o.list) lauf(o.list); }); })(c.list);
    b.emit('pointerup'); })()`);
  assert.ok(bis(`!${HUB}.children.getByName('dialogChoiceContainer')`), 'die Wahl schliesst nicht');
});

test('Danach: genau einmal, und Harren bietet das versiegelte Archiv an', () => {
  H.step(30);
  H.run(`${HUB}._closeDialog && ${HUB}._closeDialog(null)`);
  assert.strictEqual(reden('harren'), null);
  H.step(30);
  assert.strictEqual(H.run(`!!${Z}`), false, 'das Wiedersehen kam ein zweites Mal');
  const angebot = H.run(`window.questSystem.getAvailableQuests('harren').map(function (q) { return q.id; })`);
  assert.ok(Array.from(angebot).indexOf('espionage_archive') >= 0, 'nach dem Wiedersehen fehlt das Archiv: ' + Array.from(angebot).join(','));
  H.run(`${HUB}._closeDialog && ${HUB}._closeDialog(null)`);
});

test('Alter Spielstand mit elara_ist_lene: keine Szene', () => {
  stand(4, { elara_ist_lene: true });
  assert.strictEqual(reden('harren'), null);
  H.step(30);
  assert.strictEqual(H.run(`!!${Z}`), false, 'ein alter Stand sah das Wiedersehen noch einmal');
  H.run(`${HUB}._closeDialog && ${HUB}._closeDialog(null)`);
});

test('Zeiger noch unten: Harrens Frage wartet, bis er losgelassen ist', () => {
  H.run(`(function () { window.__fertig = 0; var sc = ${HUB};
    window.WiedersehenSzene.spielen(sc, function () { window.__fertig++; }); })()`);
  // Die Bilder sind jetzt geladen: der Aufbau laeuft sofort, die Platte kommt.
  H.step(30);
  taste(' ');
  assert.ok(bis(`${Z} && ${Z}.phase === 'text'`), 'mit geladenen Bildern kommt kein Text');
  H.step(20);
  assert.ok((status().text || '').length > 0, 'mit geladenen Bildern bleibt die Textplatte leer');
  H.run(`${HUB}.input.activePointer.isDown = true`);
  taste('Escape');
  H.step(60);
  assert.strictEqual(H.run('window.__fertig'), 0, 'onDone lief bei gedruecktem Zeiger');
  H.run(`${HUB}.input.activePointer.isDown = false`);
  assert.ok(bis('window.__fertig === 1'), 'onDone kam nach dem Loslassen nicht');
});
