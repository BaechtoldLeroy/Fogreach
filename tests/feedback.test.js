// tests/feedback.test.js — Rueckmeldungen der Tester (js/feedback.js), am echten Spiel.
//
// Hub: Knopf unter dem Inventar oeffnet das Panel (auch per F8), Spieluhr
// steht, ESC schliesst. Senden mit gemocktem fetch (Payload ohne persoenliche
// Daten), Offline-Warteschlange in SlotStorage und Nachsenden. Mobile: jedes
// Kind des Panels hat scrollFactor 0, ein Tap trifft auch bei verschobener
// Kamera. Laufbewertung jeder 5. Lauf, in den Einstellungen abschaltbar.
// Dungeon: derselbe Knopf unter dem Inventar, F8, Spieluhr steht.
// Zeit nur per H.step (eine Uhr).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const HUB = `window.game.scene.getScene('HubSceneV2')`;
const BILD = 'data:image/jpeg;base64,QUJD';

/** H.run, Ergebnis aus dem vm-Realm geholt (deepStrictEqual vergleicht sonst Prototypen). */
function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** Takten, bis die Bedingung gilt (gedeckelt). */
function bis(H, js, max) {
  for (let i = 0; i < (max || 120); i++) { if (run(H, js)) return true; H.step(1); }
  return !!run(H, js);
}

/** Screenshot sofort (Bild-Attrappe) und fetch als Aufzeichnung; ok steuert die Antwort. */
function attrappen(H) {
  run(H, `(function () {
    window.__echtBild = window.__echtBild || window.Feedback._bildMachen;
    window.Feedback._bildMachen = function (scene, fertig) { fertig(${JSON.stringify(BILD)}); };
    window.__fetchAufrufe = [];
    window.__fetchModus = 'ok';
    window.fetch = function (url, opts) {
      window.__fetchAufrufe.push({ url: url, methode: opts.method, daten: JSON.parse(opts.body) });
      if (window.__fetchModus === 'offline') return Promise.reject(new Error('offline'));
      if (window.__fetchModus === '503') return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve({ ok: true, status: 201 });
    };
    return 1;
  })()`);
}

/** Promises (fetch-Attrappe) durchlaufen lassen. */
async function atmen(H) {
  for (let i = 0; i < 5; i++) { await new Promise((r) => setImmediate(r)); H.step(1); }
}

const meldung = (H) => run(H, `(function () { var l = ${HUB}.children.list.filter(function (o) { return o.name === 'feedbackMeldung'; }); return l.length ? l[l.length - 1].text : null; })()`);
const offen = (H) => run(H, `window.Feedback.istOffen()`);
const schlange = (H) => run(H, `window.Feedback.warteschlange()`);

describe('Hub', () => {
  let H = null;
  before(async () => {
    H = await launch({ renderer: 'canvas', waitFor: 'StartScene' });
    run(H, `window.SlotStorage.setItem('demonfall_seen_intro_splash', '1')`);
    H.run(`window.game.scene.start('HubSceneV2')`);
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    H.step(30);
    run(H, `(function () { var s = ${HUB}; s._dialogOpen = false;
      s.children.list.filter(function (o) { return o.name === 'runSummaryDialog'; }).forEach(function (o) { o.destroy(); });
      return 1; })()`);
    attrappen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Knopf unter dem Inventar, mit eigenem Icon', () => {
    const k = run(H, `(function () { var s = ${HUB}; var k = s.children.getByName('feedbackKnopf'), i = s._hubInvBtn,
      sym = s.children.getByName('feedbackSymbol');
      return { kx: k.x, ky: k.y, ix: i.x, iy: i.y, r: i.radius, tex: sym.texture.key, frame: sym.frame.name,
        erwartet: window.hudLeiste.frame('feedback'), sf: [k.scrollFactorX, sym.scrollFactorX], aktiv: !!(k.input && k.input.enabled) }; })()`);
    assert.strictEqual(k.kx, k.ix, 'nicht unter dem Inventar');
    assert.strictEqual(k.ky - k.iy, k.r * 2 + 8, 'Abstand wie zwischen Menue und Inventar');
    assert.strictEqual(k.tex, 'hud_icons');
    assert.strictEqual(k.frame, k.erwartet);
    assert.ok(k.erwartet >= 0);
    assert.deepStrictEqual(k.sf, [0, 0]);
    assert.ok(k.aktiv);
  });

  test('Knopf oeffnet das Panel, Spieluhr steht, ESC schliesst', () => {
    run(H, `${HUB}.children.getByName('feedbackKnopf').emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} })`);
    assert.ok(bis(H, `window.Feedback.istOffen()`), 'Panel nicht offen');
    const z = run(H, `({ pause: window.__GAME_PAUSE.since != null, zeit: ${HUB}.time.paused, kb: ${HUB}.input.keyboard.enabled,
      feld: !!window.Feedback._offen().textarea })`);
    assert.deepStrictEqual(z, { pause: true, zeit: true, kb: false, feld: true });
    run(H, `window.dispatchEvent('keydown', { key: 'Escape', preventDefault: function () {}, stopPropagation: function () {} })`);
    assert.strictEqual(offen(H), false, 'ESC schliesst nicht');
    const n = run(H, `({ pause: window.__GAME_PAUSE.since != null, kb: ${HUB}.input.keyboard.enabled,
      panel: !!${HUB}.children.getByName('feedbackPanel') })`);
    assert.deepStrictEqual(n, { pause: false, kb: true, panel: false });
  });

  test('F8 oeffnet und schliesst', () => {
    run(H, `${HUB}.input.keyboard.emit('keydown-F8')`);
    assert.ok(bis(H, `window.Feedback.istOffen()`), 'F8 oeffnet nicht');
    run(H, `window.dispatchEvent('keydown', { key: 'F8', preventDefault: function () {} })`);
    assert.strictEqual(offen(H), false);
  });

  test('Senden: Payload mit Kategorie, Text, Screenshot und Kontext, ohne persoenliche Daten', async () => {
    run(H, `window.__fetchAufrufe = []; window.__fetchModus = 'ok'; window.Feedback.oeffnen(${HUB})`);
    assert.ok(bis(H, `window.Feedback.istOffen()`));
    // Leer: Hinweis, nichts gesendet.
    run(H, `window.Feedback._offen().senden.emit('pointerdown', {}, 0, 0, {})`);
    assert.strictEqual(run(H, `window.Feedback._offen().statusText.text`), 'Bitte schreib ein paar Worte.');
    assert.strictEqual(run(H, `window.__fetchAufrufe.length`), 0);
    run(H, `(function () { var o = window.Feedback._offen();
      o.kats.filter(function (b) { return b._kategorie === 'balance'; })[0].emit('pointerdown', {}, 0, 0, {});
      o.textarea.value = '  Der Kettenmeister trifft zu hart.  ';
      o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
    assert.strictEqual(offen(H), false, 'Panel bleibt nach dem Senden offen');
    await atmen(H);
    const a = run(H, `window.__fetchAufrufe`);
    assert.strictEqual(a.length, 1);
    assert.strictEqual(a[0].url, '/api/feedback');
    assert.strictEqual(a[0].methode, 'POST');
    const d = a[0].daten;
    assert.deepStrictEqual(Object.keys(d).sort(), ['bild', 'kategorie', 'kontext', 'text', 'typ']);
    assert.strictEqual(d.typ, 'feedback');
    assert.strictEqual(d.kategorie, 'balance');
    assert.strictEqual(d.text, 'Der Kettenmeister trifft zu hart.');
    assert.strictEqual(d.bild, BILD);
    assert.deepStrictEqual(Object.keys(d.kontext).sort(),
      ['akt', 'bildschirm', 'geraet', 'quests', 'sprache', 'szene', 'tiefe', 'version']);
    assert.strictEqual(d.kontext.version, run(H, `window.GAME_VERSION`));
    assert.strictEqual(d.kontext.szene, 'HubSceneV2');
    assert.strictEqual(d.kontext.tiefe, null);
    assert.strictEqual(d.kontext.sprache, 'de');
    assert.strictEqual(d.kontext.geraet, 'desktop');
    assert.ok(Array.isArray(d.kontext.quests));
    assert.strictEqual(typeof d.kontext.akt, 'number');
    assert.ok(bis(H, `!!${HUB}.children.getByName('feedbackMeldung')`, 30), 'keine Meldung');
    assert.strictEqual(meldung(H), 'Danke! Deine Rückmeldung ist angekommen.');
  });

  test('Haken abgewaehlt: kein Screenshot im Payload', async () => {
    run(H, `window.__fetchAufrufe = []; window.Feedback.oeffnen(${HUB})`);
    assert.ok(bis(H, `window.Feedback.istOffen()`));
    run(H, `(function () { var o = window.Feedback._offen(); o.hakenZone.emit('pointerdown', {}, 0, 0, {});
      o.textarea.value = 'Idee'; o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
    await atmen(H);
    const d = run(H, `window.__fetchAufrufe[0].daten`);
    assert.strictEqual(d.bild, null);
    assert.strictEqual(d.kategorie, 'fehler', 'Vorgabe ist Fehler');
  });

  test('Offline: Warteschlange in SlotStorage, Nachsenden bei Verbindung', async () => {
    run(H, `window.__fetchAufrufe = []; window.__fetchModus = 'offline'`);
    for (const text of ['Erste', 'Zweite']) {
      run(H, `window.Feedback.oeffnen(${HUB})`);
      assert.ok(bis(H, `window.Feedback.istOffen()`));
      run(H, `(function () { var o = window.Feedback._offen(); o.textarea.value = ${JSON.stringify(text)};
        o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
      await atmen(H);
    }
    let l = schlange(H);
    assert.deepStrictEqual(l.map((e) => e.daten.text), ['Erste', 'Zweite']);
    assert.strictEqual(l[0].daten.bild, BILD, 'Screenshot geht in der Warteschlange verloren');
    // Geraeteweit, nicht pro Spielstand: der Schluessel liegt ohne Slot-Praefix.
    assert.ok(run(H, `!!localStorage.getItem('demonfall.feedbackWarteschlange.v1')`), 'nicht ueber SlotStorage global abgelegt');
    assert.strictEqual(meldung(H), 'Keine Verbindung. Wird später nachgesendet.');
    // Server ueberlastet: bleibt liegen.
    run(H, `window.__fetchModus = '503'; window.Feedback.nachsenden()`);
    await atmen(H);
    assert.strictEqual(schlange(H).length, 2);
    // Verbindung wieder da: das naechste erfolgreiche Senden reicht alles nach.
    run(H, `window.__fetchAufrufe = []; window.__fetchModus = 'ok'; window.Feedback.oeffnen(${HUB})`);
    assert.ok(bis(H, `window.Feedback.istOffen()`));
    run(H, `(function () { var o = window.Feedback._offen(); o.textarea.value = 'Dritte';
      o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
    await atmen(H);
    assert.deepStrictEqual(run(H, `window.__fetchAufrufe.map(function (a) { return a.daten.text; })`), ['Dritte', 'Erste', 'Zweite']);
    assert.strictEqual(schlange(H).length, 0, 'Warteschlange nicht geleert');
  });

  test('Beim Start: Liegengebliebenes wird nachgesendet', async () => {
    run(H, `window.__fetchModus = 'offline'; window.Feedback.einreihen({ typ: 'feedback', kategorie: 'idee', text: 'Alt', kontext: {} })`);
    assert.strictEqual(schlange(H).length, 1);
    // Der Start-Takt ruft nachsenden; hier dieselbe Funktion bei Verbindung.
    run(H, `window.__fetchAufrufe = []; window.__fetchModus = 'ok'; window.dispatchEvent('online', { type: 'online' })`);
    await atmen(H);
    assert.deepStrictEqual(run(H, `window.__fetchAufrufe.map(function (a) { return a.daten.text; })`), ['Alt']);
    assert.strictEqual(schlange(H).length, 0);
  });

  test('Mobile: jedes Kind hat scrollFactor 0, Tap trifft bei verschobener Kamera', () => {
    run(H, `window.Feedback.oeffnen(${HUB})`);
    assert.ok(bis(H, `window.Feedback.istOffen()`));
    H.step(2);   // neue Trefferflaechen kommen erst im naechsten Takt in die Eingabeliste
    const r = run(H, `(function () { var s = ${HUB}, o = window.Feedback._offen(), falsch = [];
      (function lauf(x) { if (x.scrollFactorX !== 0 || x.scrollFactorY !== 0) falsch.push(x.type + ':' + x.name);
        (x.list || []).forEach(lauf); })(o.c);
      var cam = s.cameras.main, vorher = [cam.scrollX, cam.scrollY];
      cam.stopFollow(); cam.setScroll(vorher[0] + 300, vorher[1] + 200);
      var b = o.senden, p = s.input.activePointer;
      p.x = b.x; p.y = b.y; p.position.set(b.x, b.y);
      var treffer = s.input.hitTestPointer(p);
      cam.setScroll(vorher[0], vorher[1]); if (s.player) cam.startFollow(s.player, true, 0.1, 0.1);
      return { falsch: falsch, getroffen: treffer.indexOf(b) >= 0, n: treffer.length }; })()`);
    assert.deepStrictEqual(r.falsch, []);
    run(H, `window.Feedback.schliessen()`);
    assert.ok(r.getroffen, 'Tap auf Senden trifft nicht (' + r.n + ' Treffer)');
  });

  test('Laufbewertung: jeder 5. Lauf, Sterne und Satz', async () => {
    run(H, `window.SlotStorage.setItem('demonfall.laufZaehler.v1', '0')`);
    for (let i = 1; i <= 4; i++) {
      run(H, `window.Feedback.laufBeendet({ reason: 'portal', deepestDepth: 3, durationMs: 61000 })`);
      assert.strictEqual(run(H, `window.Feedback.bewertungFaellig()`), false, 'schon nach Lauf ' + i);
    }
    run(H, `window.Feedback.laufBeendet({ reason: 'death', deepestDepth: 6, durationMs: 125000 })`);
    assert.strictEqual(run(H, `window.Feedback.bewertungFaellig()`), true);
    assert.strictEqual(run(H, `window.Feedback.bewertungAnbieten(${HUB})`), true);
    assert.strictEqual(run(H, `window.Feedback._offen().art`), 'bewertung');
    assert.strictEqual(run(H, `window.__GAME_PAUSE.since != null`), true, 'Spieluhr laeuft');
    // Ohne Sterne: Hinweis.
    run(H, `window.__fetchAufrufe = []; window.Feedback._offen().senden.emit('pointerdown', {}, 0, 0, {})`);
    assert.strictEqual(run(H, `window.Feedback._offen().statusText.text`), 'Bitte wähle 1 bis 5 Sterne.');
    run(H, `(function () { var s = ${HUB}, o = window.Feedback._offen();
      o.c.list.filter(function (x) { return x.name === 'bewertungStern4'; })[0].emit('pointerdown', {}, 0, 0, {});
      o.satzFeld.value = 'Spannend bis zum Schluss.'; o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
    await atmen(H);
    const d = run(H, `window.__fetchAufrufe[0].daten`);
    assert.strictEqual(d.typ, 'bewertung');
    assert.strictEqual(d.sterne, 4);
    assert.strictEqual(d.satz, 'Spannend bis zum Schluss.');
    assert.deepStrictEqual(d.kontext.lauf, { grund: 'death', tiefe: 6, dauerS: 125 });
    assert.strictEqual(run(H, `window.Feedback.bewertungFaellig()`), false, 'bleibt faellig');
    assert.strictEqual(run(H, `window.__GAME_PAUSE.since != null`), false);
  });

  test('Laufbewertung: in den Einstellungen abschaltbar', () => {
    run(H, `(function () { var s = window.loadGameSettings(); s.gameplay.laufBewertung = false;
      window.SlotStorage.setItem('demonfall_settings_v1', JSON.stringify(s)); return 1; })()`);
    for (let i = 0; i < 10; i++) run(H, `window.Feedback.laufBeendet(null)`);
    assert.strictEqual(run(H, `window.Feedback.bewertungFaellig()`), false);
    assert.strictEqual(run(H, `window.Feedback.bewertungAnbieten(${HUB})`), false);
    run(H, `(function () { var s = window.loadGameSettings(); s.gameplay.laufBewertung = true;
      window.SlotStorage.setItem('demonfall_settings_v1', JSON.stringify(s)); return 1; })()`);
  });

  test('Einstellungen: Schalter Laufbewertung vorhanden', () => {
    run(H, `window.openSettingsScene ? window.openSettingsScene(${HUB}) : window.game.scene.run('SettingsScene', { from: 'HubSceneV2' })`);
    assert.ok(bis(H, `!!(window.game.scene.getScene('SettingsScene').sys.isActive())`, 60), 'Einstellungen nicht offen');
    H.step(3);
    const texte = run(H, `window.game.scene.getScene('SettingsScene').children.list
      .filter(function (o) { return o.type === 'Text'; }).map(function (o) { return o.text; })`);
    assert.ok(texte.indexOf('Laufbewertung:') >= 0, 'kein Schalter: ' + texte.join('|'));
    // Schalter antippen: Einstellung aus, die Bewertung ist abgeschaltet.
    assert.strictEqual(run(H, `window.Feedback.bewertungAn()`), true);
    run(H, `(function () { var s = window.game.scene.getScene('SettingsScene');
      var l = s.children.list.filter(function (o) { return o.type === 'Text' && o.text === 'Laufbewertung:'; })[0];
      var k = s.children.list.filter(function (o) { return o.type === 'Rectangle' && o.input && Math.abs(o.y - (l.y + 8)) < 2 && o.x > l.x; })[0];
      k.emit('pointerdown'); return 1; })()`);
    assert.strictEqual(run(H, `window.Feedback.bewertungAn()`), false, 'Schalter wirkt nicht');
    run(H, `window.game.scene.getScene('SettingsScene')._close()`);
    H.step(3);
  });
});

describe('Hub: Bewertung nach der Laufzusammenfassung', () => {
  let H = null;
  before(async () => {
    H = await launch({ renderer: 'canvas', waitFor: 'StartScene' });
    run(H, `window.SlotStorage.setItem('demonfall_seen_intro_splash', '1')`);
    run(H, `window.SlotStorage.setItem('demonfall.laufZaehler.v1', '4')`);
    // Rueckkehr aus dem fuenften Lauf, wie leaveDungeonForHub sie hinterlaesst.
    run(H, `(function () { window.Feedback.laufBeendet({ reason: 'portal', deepestDepth: 2, durationMs: 90000 });
      window.lastRunSummary = { reason: 'portal', durationMs: 90000, startDepth: 1, deepestDepth: 2, goldGained: 10,
        fragmentsGained: 0, xpGained: 50, enemiesKilled: 4, elitesKilled: 0, bossesKilled: 0, roomsEntered: 3 }; return 1; })()`);
    H.run(`window.game.scene.start('HubSceneV2')`);
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    attrappen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Zusammenfassung schliessen bietet die Bewertung an', () => {
    assert.ok(bis(H, `!!${HUB}.children.getByName('runSummaryDialog')`, 200), 'keine Zusammenfassung');
    assert.strictEqual(offen(H), false, 'Bewertung ueber der Zusammenfassung');
    run(H, `(function () { var s = ${HUB}; s._dialogOpen = false;
      var w = s.children.getByName('runSummaryDialog').list.filter(function (o) { return o.name === 'laufWeiter'; })[0];
      w.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} }); return 1; })()`);
    assert.ok(bis(H, `window.Feedback.istOffen() && window.Feedback._offen().art === 'bewertung'`, 200), 'keine Bewertung');
    run(H, `window.Feedback.schliessen()`);
  });
});

describe('Dungeon', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 2 });
    attrappen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Knopf unter dem Inventar, F8 oeffnet, Spieluhr steht, Kontext mit Tiefe', async () => {
    const k = run(H, `(function () { var e = window.HUDv2.elements; return { kx: e.feedback.hit.x, ky: e.feedback.hit.y,
      ix: e.invHit.x, iy: e.invHit.y, frame: e.feedback.icon.frame.name, erwartet: window.hudLeiste.frame('feedback') }; })()`);
    assert.strictEqual(k.kx, k.ix);
    assert.strictEqual(k.ky - k.iy, 52);
    assert.strictEqual(k.frame, k.erwartet);
    run(H, `window.game.scene.getScene('GameScene').input.keyboard.emit('keydown-F8')`);
    assert.ok(bis(H, `window.Feedback.istOffen()`), 'F8 oeffnet nicht');
    const t0 = run(H, `window.gameNow(window.game.scene.getScene('GameScene'))`);
    H.step(60);
    assert.strictEqual(run(H, `window.gameNow(window.game.scene.getScene('GameScene'))`), t0, 'Spieluhr laeuft weiter');
    run(H, `(function () { var o = window.Feedback._offen(); o.textarea.value = 'Tuer klemmt';
      o.senden.emit('pointerdown', {}, 0, 0, {}); return 1; })()`);
    await atmen(H);
    const d = run(H, `window.__fetchAufrufe[0].daten`);
    assert.strictEqual(d.kontext.szene, 'GameScene');
    assert.strictEqual(d.kontext.tiefe, run(H, `window.DUNGEON_DEPTH`));
    assert.ok(d.kontext.tiefe >= 1);
    assert.ok(run(H, `window.gameNow(window.game.scene.getScene('GameScene'))`) >= t0);
    assert.strictEqual(run(H, `window.__GAME_PAUSE.since == null`), true, 'Spieluhr bleibt stehen');
  });

  test('Screenshot: echter Canvas-Schnappschuss als verkleinertes JPEG', () => {
    run(H, `window.__bildErgebnis = undefined; window.__echtBild(window.game.scene.getScene('GameScene'), function (u) { window.__bildErgebnis = u; })`);
    assert.ok(bis(H, `window.__bildErgebnis !== undefined`, 120), 'kein Rueckruf');
    const r = run(H, `(function () { var u = window.__bildErgebnis; return u ? { anfang: u.slice(0, 23), laenge: u.length, max: window.Feedback.MAX_BILD } : null; })()`);
    assert.ok(r, 'kein Bild');
    assert.strictEqual(r.anfang, 'data:image/jpeg;base64,');
    assert.ok(r.laenge > 1000 && r.laenge <= r.max, 'Groesse ' + r.laenge);
  });

  test('Knopf per Tap oeffnet auch im Dungeon', () => {
    run(H, `window.HUDv2.elements.feedback.hit.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} })`);
    assert.ok(bis(H, `window.Feedback.istOffen()`));
    run(H, `window.Feedback.schliessen()`);
    assert.strictEqual(offen(H), false);
  });
});
