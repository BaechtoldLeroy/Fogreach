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

  test('Ratskammer und Konvoi: keine eigene Szene (die Story erzaehlt)', () => {
    const r = H.run(`(function () { var p = window.player;
      var a = window.SpionageSzenen.belauscht(${GS}, { questTarget: 'collusion_reveal_seen', x: p.x, y: p.y }, true);
      var b = window.SpionageSzenen.belauscht(${GS}, { questTarget: 'convoy_intel', x: p.x, y: p.y }, false);
      return [a, b, !!${GS}.__spionSzene]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [null, null, false]);
  });

  test('Enttarnt: kurzer Moment an der Wache, laeuft ohne Eingabe weiter', async () => {
    H.run(`window.SpionageSzenen.enttarnt(${GS})`);
    assert.ok(await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'enttarnt')`), 'keine Enttarnungsszene');
    const knopf = H.run(`${GS}.__spionSzene.teile.some(function (o) { return o.name === 'spionWeiter' || o.name === 'spionUeberspringen'; })`);
    assert.strictEqual(knopf, false, 'die Enttarnung wartet auf Eingabe');
    assert.ok(await bis(H, `!${GS}.__spionSzene`, 1500), 'die Enttarnung schliesst nicht von selbst');
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
