// tests/zettelSzene.test.js — "Du bist dem gefalteten Zettel gefolgt" als
// Zwischensequenz (js/zettelSzene.js) vor dem Verrat in der Ratskammer.
//
// Bei Maras Abgabe von "Der Maulwurf" laufen zuerst drei Bilder (der Zettel,
// die Treppe mit dem Waechter, der Tuerspalt), DANACH der Rueckblick auf die
// Rettung und zuletzt der Ring mit der Auswahl. Gefahren wird die echte
// Abgabe ueber _showNpcDialogue, mit echten Tastendruecken.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const HUB = `window.game.scene.getScene('HubSceneV2')`;
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
  H.step(10);
  // Die Prolog-Karte eines frischen Spiels liegt sonst darueber.
  for (let i = 0; i < 4; i++) { H.run(`${HUB}.input.keyboard.emit('keydown-ESC', {}); 1`); H.step(20); }
  // Die Auswahl am Ende merken und beantworten, wenn der Test es sagt.
  H.run(`(function () {
    window.__praesentiert = [];
    window.DialogChoice.present = function (sc, cfg) {
      window.__praesentiert.push({ prompt: cfg && cfg.prompt, zettelOffen: !!(sc.__zettelSzene && sc.__zettelSzene.offen) });
      window.__offeneWahl = cfg;
      return { destroy: function () {} };
    };
    return 1;
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

const z = () => H.run(`(function () { var z = ${HUB}.__zettelSzene; if (!z) return null;
  return { bild: z.bild, zeile: z.zeile, phase: z.phase, tippt: z.tippt(), offen: z.offen,
    protokoll: JSON.parse(JSON.stringify(z.protokoll)) }; })()`);
const taste = (key, keyCode) => H.run(`${HUB}.input.keyboard.emit('keydown', { key: '${key}', keyCode: ${keyCode}, repeat: false }); 1`);

/** Abgabe an Mara mit dem Stand einer Rettung ('voll' | 'allgemein' | 'keiner'). */
function abgabe(art) {
  // Eine Akt-Karte nach dem vorigen Abschluss haelt die Uhr an: wegklicken.
  for (let i = 0; i < 4 && H.run(`!!${HUB}.children.getByName('aktwechsel')`); i++) {
    H.run(`${HUB}.input.keyboard.emit('keydown-ESC', {}); 1`); H.step(20);
  }
  assert.ok(H.run('window.__GAME_PAUSE.since == null'), 'die Spieluhr steht schon vor der Abgabe');
  const r = H.run(`(function () {
    var qs = window.questSystem, sc = ${HUB};
    window.storySystem.advanceToAct(4);
    var st = qs.getQuestSaveData();
    st.quests = {
      bruch_confrontation: { status: 'completed', objectives: [] },
      espionage_archive: { status: 'completed', objectives: [] },
      espionage_informant: { status: 'active', objectives: [{ type: 'observe', target: 'informant_id', current: 1, required: 1 }] }
    };
    st.flags = { elaraReturnedToHub: true, bruch_nacht_gesehen: true };
    qs.loadQuestSaveData(st);
    qs.setFlag('rettung_inszeniert', ${art === 'voll'});
    qs.setFlag('elara_rettung_gesehen', ${art !== 'keiner'});
    qs.setFlag('elaraMet', ${art !== 'keiner'});
    sc.__zettelSzene = null; sc.__rueckblick = null; sc.__szeneWartet = null;
    window.__praesentiert = []; window.__offeneWahl = null;
    var mara = sc.npcs.filter(function (n) { return n.data && n.data.id === 'mara'; })[0];
    if (!mara) return 'Mara nicht im Hub';
    sc._dialogOpen = false;
    sc._showNpcDialogue(mara.data);
    return null;
  })()`);
  assert.ok(!r, r);
  for (let i = 0; i < 300 && !(z() && z().offen); i++) H.step(3);
  assert.ok(z() && z().offen, 'die Zwischensequenz begann nicht');
}

/** Bis der Satz ganz steht. */
function bisSatzFertig() {
  for (let i = 0; i < 600; i++) {
    const s = z();
    if (!s.offen || (s.phase === 'text' && !s.tippt)) return s;
    H.step(3);
  }
  assert.fail('der Satz wurde nie fertig');
}

test('Die drei Bilder laufen vor dem Rueckblick, die Tasten zeigen erst den Satz, dann den naechsten', () => {
  abgabe('voll');
  // Waehrend der Bilder steht die Spieluhr, und noch kein Rueckblick.
  assert.ok(H.run('window.__GAME_PAUSE.since != null'), 'die Spieluhr laeuft waehrend der Zwischensequenz');
  // Der ausloesende Druck blaettert nicht gleich weiter (Sperrfrist).
  taste(' ', 32);
  assert.strictEqual(z().phase, 'vorspann', 'der ausloesende Tastendruck blaetterte weiter');

  for (let i = 0; i < 200 && z().phase !== 'text'; i++) H.step(3);
  let s = z();
  assert.strictEqual(s.bild, 0);
  assert.ok(s.tippt, 'der Satz baut sich nicht Wort fuer Wort auf');
  H.step(25);
  // Erste Taste: der Satz steht ganz, dieselbe Zeile.
  taste(' ', 32);
  s = z();
  assert.strictEqual(s.tippt, false, 'die erste Taste zeigte den Satz nicht ganz');
  assert.strictEqual(s.zeile, 0, 'die erste Taste blaetterte schon weiter');
  H.step(10);
  // Zweite Taste: die naechste Zeile.
  taste('Enter', 13);
  assert.strictEqual(z().zeile, 1, 'die zweite Taste blaetterte nicht weiter');
  // Ein Tipp tut dasselbe wie eine Taste.
  H.step(10);
  H.run(`${HUB}.input.emit('pointerdown', {}); 1`);
  assert.strictEqual(z().tippt, false, 'ein Tipp zeigte den Satz nicht ganz');

  // Bis ans Ende der Bilder, Satz fuer Satz.
  const bilder = [];
  for (let k = 0; k < 30 && z().offen; k++) {
    s = bisSatzFertig();
    if (!s.offen) break;
    if (bilder[bilder.length - 1] !== s.bild) bilder.push(s.bild);
    assert.strictEqual(H.run(`${HUB}.__rueckblick`), null, 'der Rueckblick laeuft schon waehrend der Bilder');
    H.step(10);
    taste(' ', 32);
    H.step(2);
  }
  assert.deepStrictEqual(bilder, [0, 1, 2], 'nicht alle drei Bilder in Folge');
  const texte = z().protokoll.filter((e) => e.text).map((e) => e.text).join(' | ');
  assert.match(texte, /drei Ketten/);
  assert.match(texte, /roter Helmbusch/);
  assert.match(texte, /Aldric steht am Tisch/);
  assert.deepStrictEqual(z().protokoll.filter((e) => e.bild && !e.text).map((e) => e.bild).join(','),
    'zettel_hand,zettel_treppe,zettel_spalt');
  // Das Bild ist weg, die Uhr laeuft wieder, der Rueckblick beginnt.
  assert.strictEqual(H.run(`${HUB}.children.list.some(function (o) { return o.name === 'zettelSzene'; })`), false, 'die Bilder bleiben liegen');
  assert.ok(H.run('window.__GAME_PAUSE.since == null'), 'nach den Bildern steht die Spieluhr noch');
  for (let i = 0; i < 200 && !H.run(`!!${HUB}.__rueckblick`); i++) H.step(3);
  assert.ok(H.run(`!!${HUB}.__rueckblick`), 'nach den Bildern kein Rueckblick');
  assert.strictEqual(H.run('window.__praesentiert.length'), 0, 'die Auswahl kam vor dem Rueckblick');

  // Rueckblick durch, dann der Ring mit der Auswahl.
  for (let k = 0; k < 8; k++) {
    for (let i = 0; i < 400 && !H.run(`${HUB}.__rueckblick.phase === 'fertig' || ${HUB}.__rueckblick.wartet()`); i++) H.step(3);
    if (H.run(`${HUB}.__rueckblick.phase === 'fertig'`)) break;
    H.run(`${HUB}.__rueckblick.weiter(); 1`);
  }
  for (let i = 0; i < 400 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
  H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
  H.step(3);
  const wahl = H.run('window.__praesentiert');
  assert.strictEqual(wahl.length, 1, 'keine Auswahl am Ende');
  assert.strictEqual(wahl[0].zettelOffen, false);
  // Die Auswahl trifft der Spieler, nicht die Szene.
  assert.strictEqual(H.run(`window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'espionage_informant'; })`), false,
    'der Auftrag wurde abgeschlossen, bevor gewaehlt war');
  H.run('window.__offeneWahl.onResolved(null); 1');
  H.step(3);
  const q = H.run(`(function () { var qs = window.questSystem;
    return { fertig: qs.getCompletedQuests().some(function (x) { return x.id === 'espionage_informant'; }),
      mole: qs.hasFlag('mole_evidence'), verrat: qs.hasFlag('elara_verrat_gesehen'),
      rueckblick: qs.hasFlag('rueckblick_rettung_gesehen') }; })()`);
  assert.strictEqual(JSON.stringify(q), JSON.stringify({ fertig: true, mole: true, verrat: true, rueckblick: true }));
});

test('ESC beendet die Bilder auf einmal, waehlt aber nichts: danach Rueckblick wie sonst', () => {
  abgabe('allgemein');
  for (let i = 0; i < 200 && z().phase !== 'text'; i++) H.step(3);
  taste('Escape', 27);
  const s = z();
  assert.strictEqual(s.offen, false, 'ESC beendete die Bilder nicht');
  assert.ok(s.protokoll.some((e) => e.uebersprungen));
  assert.strictEqual(H.run('window.__praesentiert.length'), 0, 'ESC traf eine Auswahl');
  for (let i = 0; i < 200 && !H.run(`!!${HUB}.__rueckblick`); i++) H.step(3);
  assert.ok(H.run(`!!${HUB}.__rueckblick`), 'nach ESC kein Rueckblick');
  // Der Rueckblick ignoriert dieses ESC: er laeuft noch.
  assert.notStrictEqual(H.run(`${HUB}.__rueckblick.phase`), 'fertig', 'das ESC der Bilder beendete auch den Rueckblick');
  H.run(`${HUB}.__rueckblick.ueberspringen(); 1`);
});

test('Ohne Rettung im Stand: die Wache an der Tuer ist eine fremde, danach gleich der Ring', () => {
  // Reste des vorigen Tests wegraeumen.
  for (let i = 0; i < 30 && H.run(`!!(${HUB}.__rueckblick && ${HUB}.__rueckblick.phase !== 'fertig')`); i++) {
    H.run(`${HUB}.input.keyboard.emit('keydown', { key: 'Escape', keyCode: 27 }); 1`); H.step(20);
    if (H.run(`!!${HUB}.__rueckblick.wartet && ${HUB}.__rueckblick.wartet()`)) H.run(`${HUB}.__rueckblick.weiter(); 1`);
  }
  for (let i = 0; i < 400 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
  if (H.run(`!!${HUB}.__szeneWartet`)) { H.run(`${HUB}.__szeneWartet.ausloesen(); 1`); H.step(3); }
  if (H.run('!!window.__offeneWahl')) H.run('window.__offeneWahl.onResolved(null); 1');
  H.step(5);

  abgabe('keiner');
  for (let k = 0; k < 30 && z().offen; k++) { bisSatzFertig(); H.step(10); H.run(`${HUB}.__zettelSzene.weiter(); 1`); H.step(2); }
  const texte = z().protokoll.filter((e) => e.text).map((e) => e.text).join(' | ');
  assert.ok(!/Kettenwächter|Helmbusch/.test(texte), 'ohne Rettung kennt man den Waechter nicht: ' + texte);
  assert.match(texte, /Wache/);
  for (let i = 0; i < 400 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
  assert.strictEqual(H.run(`${HUB}.__rueckblick`), null, 'ein Rueckblick ohne Rettung');
  const seite = H.run(`${HUB}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === 1550 && o.active; }).map(function (o) { return o.text; }).join(' | ')`);
  assert.match(seite, /Ring: drei Ketten/, JSON.stringify({ z: z(), warte: H.run(`!!${HUB}.__szeneWartet`), texte: H.run(`${HUB}.children.list.filter(function (o) { return o.type === 'Text' && o.depth >= 1500; }).map(function (o) { return o.depth + ':' + o.active + ':' + o.text.slice(0, 40); })`) }));
  H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
  H.step(3);
  H.run('window.__offeneWahl.onResolved(null); 1');
  H.step(3);
  assert.ok(H.run(`window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'espionage_informant'; })`));
});

test('Englisch: die Bilder sprechen Englisch', () => {
  const zeilen = H.run(`(function () { var alt = window.i18n.getLanguage(); window.i18n.setLanguage('en');
    var b = window.ZettelSzene.bilder('voll'); window.i18n.setLanguage(alt);
    return b.map(function (x) { return x.zeilen.join(' '); }).join(' '); })()`);
  assert.match(zeilen, /three chains/);
  assert.match(zeilen, /red plume/);
  assert.ok(!/[äöüß]/.test(zeilen), 'deutsche Reste: ' + zeilen);
});

test('Debug ?zettel=N: die Szene beginnt beim gewaehlten Bild', () => {
  H.run('window.ZettelSzene.startBildSetzen(2); 1');
  abgabe('keiner');
  assert.strictEqual(z().bild, 2);
  assert.strictEqual(z().protokoll[0].bild, 'zettel_spalt');
  H.run(`${HUB}.__zettelSzene.ueberspringen(); 1`);
  for (let i = 0; i < 400 && !H.run(`!!${HUB}.__szeneWartet`); i++) H.step(3);
  H.run(`${HUB}.__szeneWartet.ausloesen(); 1`);
  H.step(3);
  if (H.run('!!window.__offeneWahl')) H.run('window.__offeneWahl.onResolved(null); 1');
});
