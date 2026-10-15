// tests/spionageSzenen.test.js — Zwischenszenen in der Spionage (#197).
//
// Vorschau hinter ?spionszene=neu: Missionsstart, mitgehoertes Gespraech,
// Enttarnung und Abschluss als kurze Szenen (Balken, Kamera, Messing-Plakette,
// Text Seite fuer Seite). Ratskammer und Konvoi behalten ihre Story-Szenen;
// "Verdacht steigt" bekommt bewusst keine Szene.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

async function bis(H, js, runden) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

const GS = "window.game.scene.getScene('GameScene')";

describe('mit ?spionszene=neu', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=1&spionszene=neu' });
    H.run('window.SpionageSzenen._TEMPO = 0.2; window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Missionsstart: Auftrag als Szene, Spieluhr steht, ESC beendet', async () => {
    assert.ok(H.run('window.EspionageSystem.isActive()'), '?spy=1 hat keine Mission gestartet — Test misst nichts');
    assert.ok(await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'start')`), 'keine Startszene');
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.phase === 'rede'`), 'die Rede beginnt nicht');
    const r = H.run(`(function () {
      var z = ${GS}.__spionSzene;
      var titel = z.teile.filter(function (o) { return o.name === 'spionTitel'; })[0];
      var rede = z.teile.filter(function (o) { return o.name === 'spionRede'; })[0];
      return { titel: titel ? titel.text : '', rede: rede ? rede.text : '', seiten: z.seiten,
        pause: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null),
        klammern: z.teile.some(function (o) { return typeof o.text === 'string' && /\\[|\\]/.test(o.text); }) };
    })()`);
    assert.ok(r.titel.length > 0, 'Plakette ohne Titel');
    assert.ok(r.rede.length > 10, 'keine Briefing-Zeile');
    assert.strictEqual(r.seiten, 2, 'Auftrag und Regel erwartet');
    assert.strictEqual(r.pause, true, 'die Spieluhr laeuft weiter');
    assert.strictEqual(r.klammern, false, 'eckige Klammern in der Szene');
    H.run(`${GS}.input.keyboard.emit('keydown', { key: 'Escape', keyCode: 27 })`);
    assert.ok(await bis(H, `!${GS}.__spionSzene`), 'ESC schliesst die Szene nicht');
    assert.strictEqual(H.run('!!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)'), false, 'die Spieluhr bleibt stehen');
  });

  test('Abgehoert: das Gespraech Sprecher fuer Sprecher, danach der Abschluss von selbst', async () => {
    H.run(`(function () { var p = window.player;
      window.SpionageSzenen.belauscht(${GS}, { questTarget: 'archive_record', x: p.x + 40, y: p.y }, true); })()`);
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.phase === 'rede'`), 'keine Gespraechsszene');
    const erst = H.run(`(function () { var z = ${GS}.__spionSzene;
      var t = function (n) { var o = z.teile.filter(function (x) { return x.name === n; })[0]; return o ? o.text : ''; };
      return { art: z.art, sprecher: t('spionSprecher'), rede: t('spionRede'), titel: t('spionTitel'), seiten: z.seiten }; })()`);
    assert.strictEqual(erst.art, 'belauscht');
    assert.strictEqual(erst.seiten, 2);
    assert.ok(/SCHREIBER/.test(erst.sprecher), 'Sprecher: ' + erst.sprecher);
    assert.ok(/Akt/.test(erst.rede + erst.titel), 'kein Gespraech: ' + erst.rede);
    // Seite 2 per Taste, dann Ende per Klick.
    for (let i = 0; i < 40; i++) { H.step(2); await flush(); }
    H.run(`${GS}.input.keyboard.emit('keydown', { key: ' ' })`);
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.seite === 1`), 'die Taste blaettert nicht');
    for (let i = 0; i < 40; i++) { H.step(2); await flush(); }
    H.run(`${GS}.input.emit('pointerdown', {})`);
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.art === 'fertig'`), 'der Abschluss folgt nicht');
    // Der Abschluss schliesst ohne Eingabe.
    assert.ok(await bis(H, `!${GS}.__spionSzene`, 1500), 'der Abschluss bleibt stehen');
  });

  test('Abgehoert: jedes Gespraech hat sein eigenes Bild (Tableau), ohne Bild die Spielwelt', async () => {
    assert.ok(await bis(H, `window.SpionageSzenen.BILDER.every(function (z) { return ${GS}.textures.exists(window.SpionageSzenen.bildKey(z)); })`, 1500),
      'die Tableaus werden beim Missionsstart nicht geladen');
    for (const ziel of ['convoy_intel', 'escort_route', 'archive_record', 'informant_id']) {
      H.run(`(function () { var p = window.player; window.__konvoiEcht = window.__konvoiEcht || window.Finale.konvoi;
        window.Finale.konvoi = function () { return true; };
        window.SpionageSzenen.belauscht(${GS}, { questTarget: '${ziel}', x: p.x, y: p.y }, false); })()`);
      assert.ok(await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.teile.some(function (o) { return o.name === 'spionTableau'; }))`),
        ziel + ': kein Tableau');
      const r = H.run(`(function () { var z = ${GS}.__spionSzene;
        var tab = z.teile.filter(function (o) { return o.name === 'spionTableau'; })[0];
        var kam = ${GS}.cameras.main;
        return { key: tab.texture.key, deckt: tab.displayWidth >= kam.width - 1 && tab.displayHeight >= kam.height - 1 }; })()`);
      assert.strictEqual(r.key, 'spionbild_' + ziel);
      assert.ok(r.deckt, ziel + ': das Bild fuellt den Schirm nicht');
      H.run(`${GS}.__spionSzene.ueberspringen()`);
      assert.ok(await bis(H, `!${GS}.__spionSzene`));
    }
    // Rueckfall: ohne Bild schwenkt die Kamera auf die Spielwelt, kein Tableau.
    H.run(`(function () { var gs = ${GS}, k = 'spionbild_archive_record';
      window.__tabBild = gs.textures.get(k).getSourceImage(); gs.textures.remove(k);
      var p = window.player; window.SpionageSzenen.belauscht(gs, { questTarget: 'archive_record', x: p.x, y: p.y }, false); })()`);
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.phase === 'rede'`));
    assert.strictEqual(H.run(`${GS}.__spionSzene.teile.some(function (o) { return o.name === 'spionTableau'; })`), false);
    H.run(`(function () { var gs = ${GS}; gs.__spionSzene.ueberspringen();
      gs.textures.addImage('spionbild_archive_record', window.__tabBild); window.Finale.konvoi = window.__konvoiEcht; })()`);
    assert.ok(await bis(H, `!${GS}.__spionSzene`));
  });

  test('Ratskammer: keine eigene Szene (die geheime Sitzung hat ihre Buehne)', () => {
    const r = H.run(`(function () { var p = window.player;
      var a = window.SpionageSzenen.belauscht(${GS}, { questTarget: 'collusion_reveal_seen', x: p.x, y: p.y }, true);
      return [a, !!${GS}.__spionSzene]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [null, false]);
  });

  test('Konvoi: das Gespraech als Szene, danach die Entscheidung', async () => {
    H.run(`(function () { var p = window.player;
      window.__konvoi = 0;
      window.__echtKonvoi = window.Finale.konvoi;
      window.Finale.konvoi = function () { window.__konvoi++; return true; };
      window.SpionageSzenen.belauscht(${GS}, { questTarget: 'convoy_intel', x: p.x, y: p.y }, true); })()`);
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.phase === 'rede'`), 'keine Konvoi-Szene');
    assert.strictEqual(H.run('window.__konvoi'), 0, 'die Entscheidung kommt vor dem Gespraech');
    H.run(`${GS}.__spionSzene.ueberspringen()`);
    assert.ok(await bis(H, `!${GS}.__spionSzene`), 'die Szene endet nicht');
    for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
    const r = H.run(`(function () { var n = window.__konvoi; window.Finale.konvoi = window.__echtKonvoi;
      return n + ':' + !!${GS}.__spionSzene; })()`);
    assert.strictEqual(r, '1:false', 'Entscheidung genau einmal, kein "Alles gehoert" darueber: ' + r);
  });

  test('"Quest-Ziel erfuellt" kommt als letzte Seite der Szene, nicht als Toast', async () => {
    const r = H.run(`(function () {
      var toasts = [], echt = window.EventSystem.showToast;
      window.EventSystem.showToast = function (sc, t) { toasts.push(t); };
      window.__toasts = toasts; window.__echtToast = echt;
      // Reihenfolge wie im Spiel: erst das Questsystem, dann die Szene.
      var uebernommen = window.SpionageSzenen.zielToast('Quest-Ziel erfüllt: Der versiegelte Akt');
      var p = window.player;
      window.SpionageSzenen.belauscht(${GS}, { questTarget: 'archive_record', x: p.x, y: p.y }, false);
      return uebernommen + ':' + ${GS}.__spionSzene.seiten;
    })()`);
    assert.strictEqual(r, 'true:3', 'zwei Gespraechsseiten + Ziel-Seite erwartet: ' + r);
    for (let i = 0; i < 30; i++) { H.step(2); await flush(); }
    assert.strictEqual(H.run('window.__toasts.length'), 0, 'trotzdem ein Toast');
    // Bis zur letzten Seite blaettern: sie traegt den Ziel-Text.
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 40; i++) { H.step(2); await flush(); }
      H.run(`${GS}.__spionSzene.weiter()`);
    }
    assert.ok(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.seite === 2`), 'die Ziel-Seite kommt nicht');
    const text = H.run(`${GS}.__spionSzene.teile.filter(function (o) { return o.name === 'spionRede'; })[0].text`);
    assert.ok(/Quest-Ziel erfüllt/.test(text), 'letzte Seite: ' + text);
    H.run(`${GS}.__spionSzene.ueberspringen()`);
    assert.ok(await bis(H, `!${GS}.__spionSzene`));
    H.run('window.EventSystem.showToast = window.__echtToast');
  });

  test('Ohne Szene (Ratskammer) bleibt "Quest-Ziel erfuellt" ein Toast', async () => {
    H.run(`(function () {
      var toasts = [], echt = window.EventSystem.showToast;
      window.EventSystem.showToast = function (sc, t) { toasts.push(t); };
      window.__toasts = toasts; window.__echtToast = echt;
      window.SpionageSzenen.zielToast('Quest-Ziel erfüllt: Die geheime Sitzung');
    })()`);
    for (let i = 0; i < 10; i++) { H.step(2); await flush(); }
    assert.strictEqual(H.run('window.__toasts.length'), 1, 'der Toast geht verloren');
    H.run('window.EventSystem.showToast = window.__echtToast');
  });

  test('Enttarnt: Blitz und Ruf, aber NICHTS steht still — man kann sofort kaempfen', async () => {
    const r = H.run(`(function () {
      var z = window.SpionageSzenen.enttarnt(${GS});
      return { art: z && z.art, ruf: !!(z && z.ruf && z.ruf.text), szene: !!${GS}.__spionSzene,
        pause: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null), wahl: !!window.eventChoiceOpen };
    })()`);
    assert.strictEqual(r.art, 'enttarnt');
    assert.ok(r.ruf, 'kein Ruf der Wache');
    assert.strictEqual(r.szene, false, 'die Enttarnung blockiert als Szene');
    assert.strictEqual(r.pause, false, 'die Spieluhr steht');
    assert.strictEqual(r.wahl, false, 'die Eingabe ist gesperrt');
    // Steht keine Wache im Bild, ruft es ueber dem Spieler (sonst saehe es keiner).
    const ort = H.run(`(function () {
      var st = window.EspionageSystem.getState(), p = window.player;
      var alt = st.guards; st.guards = [{ x: p.x + 5000, y: p.y + 5000 }];
      var z = window.SpionageSzenen.enttarnt(${GS});
      st.guards = alt;
      return Math.abs(z.ruf.x - p.x) < 1;
    })()`);
    assert.strictEqual(ort, true, 'der Ruf steht bei einer Wache ausserhalb des Bildes');
    // Die Spieluhr laeuft weiter, waehrend Ruf und Blitz zu sehen sind.
    const vorher = H.run('window.gameNow()');
    for (let i = 0; i < 10; i++) { H.step(2); await flush(); }
    assert.ok(H.run('window.gameNow()') > vorher, 'die Zeit steht');
  });

  test('Haken: Abhoeren und Entdecktwerden im EspionageSystem rufen die Szenen', () => {
    const r = H.run(`(function () {
      var E = window.EspionageSystem, S = window.SpionageSzenen, gs = ${GS}, p = window.player;
      var gerufen = [];
      var echtB = S.belauscht, echtE = S.enttarnt;
      S.belauscht = function (sc, z, alle) { gerufen.push('belauscht:' + z.questTarget + ':' + alle); };
      S.enttarnt = function () { gerufen.push('enttarnt'); };
      try {
        var st = E.getState();
        st.observeZones.forEach(function (z) { z._done = true; });
        var z = st.observeZones[0];
        z._done = false; z._elapsed = 0; z.seconds = 0.05; z.x = p.x; z.y = p.y; z.r = 200;
        E.update(gs, 0, 200);
        // Eine rote Wache direkt vor dem Spieler, Blick auf ihn.
        st.exposed = false; st.disguised = true; st.detection = 0.99;
        st.guards = [{ x: p.x, y: p.y + 0.5, _facing: 0, _baseFacing: 0, range: 300, halfAngle: Math.PI, scanArc: 0, speed: 0, pause: 99, patrol: null, alert: true, hp: 3, maxHp: 3, damage: 0, hostile: false, knocked: false, _atkCd: 0, _calmT: 0, _wpIndex: 0, _pauseT: 0, _scanT: 0 }];
        for (var i = 0; i < 5; i++) E.update(gs, 0, 200);
      } finally { S.belauscht = echtB; S.enttarnt = echtE; }
      return gerufen;
    })()`);
    const liste = Array.from(r);
    assert.ok(liste.some((x) => /^belauscht:.*:true$/.test(x)), 'Abhoeren ruft keine Szene: ' + liste.join(','));
    assert.ok(liste.indexOf('enttarnt') >= 0, 'Entdecktwerden ruft keine Szene: ' + liste.join(','));
  });
});

describe('ohne Flagge', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=1' }); });
  after(async () => { if (H) await H.shutdown(); });

  test('keine Szenen, alles wie bisher', async () => {
    assert.ok(H.run('window.EspionageSystem.isActive()'), 'keine Mission — Test misst nichts');
    for (let i = 0; i < 120; i++) { H.step(2); await flush(); }
    const r = H.run(`(function () { var gs = ${GS}, p = window.player;
      var a = window.SpionageSzenen.belauscht(gs, { questTarget: 'archive_record', x: p.x, y: p.y }, true);
      var b = window.SpionageSzenen.enttarnt(gs);
      return [!!gs.__spionSzene, a, b]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [false, null, null]);
  });
});
