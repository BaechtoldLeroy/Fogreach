// tests/trailerModus.test.js — der Trailer-Modus (?trailer=1).
//
// Die Einstellungen sind fuer die Kamera gebaut; was sich headless pruefen
// laesst, ist das, woran eine Aufnahme scheitert: eine Einstellung wirft oder
// landet in der falschen Szene, das HUD steht im Bild, der Spieler stirbt,
// die Zeitlupe greift nicht — oder der Trailer schreibt einen Spielstand.
//
// Zeit laeuft nur ueber H.step. Die Einstellungen planen ihre Schritte auf der
// Bildzeit (zustand().seit), deshalb wird bis zu einer SEIT-Marke getaktet.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

let H = null;
let speicherVorher = null;

/** Der rohe localStorage des Testkopfs als einfache Zeichenkette. */
function speicherAbbild() {
  return H.run(`(function () {
    var ls = window.localStorage, out = [];
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); out.push(k + '=' + ls.getItem(k)); }
    return out.sort().join('\\n');
  })()`);
}

function zustand() { return H.run('window.TrailerModus.zustand()'); }

/** Taktet, bis die laufende Einstellung `ms` alt ist (ab ihrem Aufbau). */
async function bisSeit(ms, maxRunden) {
  for (let i = 0; i < (maxRunden || 1500); i++) {
    if (zustand().seit >= ms) return true;
    H.step(4);
    await flush();
  }
  return false;
}

function aktiv(key) { return H.activeScenes().indexOf(key) !== -1; }

before(async () => {
  H = await launch({ search: '?trailer=1', renderer: 'canvas', waitFor: 'StartScene' });
  const ok = await H.waitForScene('HubSceneV2', { maxRounds: 300 });
  assert.ok(ok, 'der Trailer-Modus kommt nicht im Hub an');
  await H.settle(() => zustand().hubGesehen, { maxRounds: 40 });
  speicherVorher = speicherAbbild();
});
after(async () => { if (H) await H.shutdown(); });

test('Trailer-Modus ist an, der Spielstand liegt im Sandkasten', () => {
  assert.strictEqual(H.run('window.TrailerModus.aktiv()'), true);
  assert.strictEqual(H.run('window.SaveSlots.imSandkasten()'), true);
  assert.ok(aktiv('TrailerOverlay'), 'die Overlay-Szene laeuft nicht');
});

test('im Hub ist das HUD weg: Menueknoepfe, Beschriftungen, Tutorial-Hinweis', () => {
  const r = H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    var id = hub.cameras.main.id;
    var weg = function (o) { return !!o && (o.cameraFilter & id) !== 0; };
    var band = hub.children.list.filter(function (o) {
      return o.scrollFactorX === 0 && o.depth >= 1001 && o.depth < 2400 && !o.__trailerBild;
    });
    return {
      menue: weg(hub._hubMenuBtn) && weg(hub._hubMenuIcon) && weg(hub._hubInvBtn),
      band: band.length, bandSichtbar: band.filter(function (o) { return !weg(o); }).length,
      prompt: weg(hub.prompt && hub.prompt._c)
    };
  })()`);
  assert.ok(r.menue, 'Menue-/Inventarknopf stehen noch im Bild');
  assert.ok(r.band > 0, 'kein HUD gefunden — der Test misst nichts');
  assert.strictEqual(r.bandSichtbar, 0, 'HUD-Teile im Bild: ' + r.bandSichtbar);
  assert.ok(r.prompt, 'die [E]-Aktionsbox steht im Bild');
});

test('Taste H blendet das HUD ein und wieder aus', () => {
  const sichtbar = () => H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    return (hub._hubMenuBtn.cameraFilter & hub.cameras.main.id) === 0;
  })()`);
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  assert.strictEqual(sichtbar(), true, 'H zeigt das HUD nicht');
  H.run(`window.TrailerModus.taste('h')`);
  H.step(2);
  assert.strictEqual(sichtbar(), false, 'zweites H versteckt es nicht wieder');
});

// Zuerst: der erste Dungeon der Sitzung wuerfelt sonst anders als jeder
// spaetere (beim ersten Mal entstehen Texturen, die Wuerfe verbrauchen).
test('Einstellung 4 zweimal: dieselbe Raumfolge (fester Zufall)', async () => {
  H.run(`window.TrailerModus.taste('4')`);
  assert.ok(await bisSeit(200));
  const erst = H.run('window.dungeonRun.templateOrder.join(",")');
  H.run(`window.TrailerModus.taste('4')`);
  assert.ok(await bisSeit(200));
  const dann = H.run('window.dungeonRun.templateOrder.join(",")');
  // Die Zufallsraeume tragen die Uhrzeit im Namen — die zaehlt nicht.
  const ohneZeit = (s) => s.replace(/_[\d.]+_/g, '_');
  assert.ok(erst.split(',').length > 3);
  assert.strictEqual(ohneZeit(dann), ohneZeit(erst));
});

// Wo jede Einstellung landen muss, und woran man sieht, dass sie aufgebaut ist.
const ERWARTET = {
  1: { szene: 'HubSceneV2', bis: 2500 },
  2: { szene: 'HubSceneV2', bis: 1500, pruef: `!!window.game.scene.getScene('HubSceneV2')._dialogContainer` },
  3: { szene: 'GameScene', bis: 4500 },
  4: { szene: 'GameScene', bis: 6500 },
  5: { szene: 'GameScene', bis: 2600, pruef: `window.EspionageSystem.isActive() && window.EspionageSystem.isDisguised() && window.EspionageSystem.getDetection() > 0.5` },
  6: { szene: 'HubSceneV2', bis: 1500, pruef: `!!window.game.scene.getScene('HubSceneV2').__trailerBuehne` },
  7: { szene: 'GameScene', bis: 7300, pruef: `!window.game.scene.getScene('GameScene').__bossZwischenszene && enemies.getChildren().some(function (e) { return e.active && e.isBoss && e.bossType === 'chainMaster'; })` },
  8: { szene: 'HubSceneV2', bis: 3000, auch: 'PrintingHouseScene' },
  9: { szene: 'TrailerTitel', bis: 3500, pruef: `window.game.scene.getScene('TrailerTitel').titel.alpha > 0.9` },
};

for (const n of Object.keys(ERWARTET)) {
  test('Einstellung ' + n + ' baut fehlerfrei auf und landet in ' + ERWARTET[n].szene, async () => {
    const e = ERWARTET[n];
    const fehlerVorher = H.hardErrors().length;
    H.run(`window.TrailerModus.taste('${n}')`);
    assert.ok(await bisSeit(e.bis), 'Einstellung ' + n + ' wurde nicht aufgebaut');
    const neu = H.hardErrors().slice(fehlerVorher);
    assert.deepStrictEqual(neu.map((f) => f.msg), [], 'Fehler in Einstellung ' + n);
    assert.ok(aktiv(e.szene), 'Einstellung ' + n + ' steht in ' + H.activeScenes().join(','));
    if (e.auch) assert.ok(aktiv(e.auch), e.auch + ' fehlt');
    if (e.pruef) assert.strictEqual(H.run(e.pruef), true, 'Einstellung ' + n + ': ' + e.pruef);
    assert.ok(aktiv('TrailerOverlay'), 'das Overlay ist verschwunden');
  });
}

// Einstellung 7 im Einzelnen. Beim Aufnehmen stand eine Treppe (der
// Durchgang des Raums, "eine Tuer") genau zwischen Spieler und Kettenmeister.
// Und seit die Boss-Zwischenszene fest eingebaut ist, darf sie die
// Einstellung nicht anhalten: sie laeuft ohne Taste durch.
// (Der Testkopf schaltet die Zwischenszene sonst ab; die Einstellung zeigt
// sie bewusst und schaltet sie fuer den Kettenmeister selbst ein.)
const STOERER = `function (o) { return o && o.texture && /^(stair|proc_door|door)/i.test(o.texture.key); }`;
function bossBild() {
  return H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    var cam = gs.cameras.main, wv = cam.worldView;
    var boss = enemies.getChildren().filter(function (e) { return e.active && e.isBoss; })[0];
    var z = gs.__bossZwischenszene;
    var strecke = function (p, a, b) {
      var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    var stoerer = gs.children.list.filter(${STOERER});
    var sichtbar = stoerer.filter(function (o) {
      return o.visible && (o.cameraFilter & cam.id) === 0
        && o.x > wv.x - 40 && o.x < wv.right + 40 && o.y > wv.y - 40 && o.y < wv.bottom + 40;
    });
    var zwischen = boss ? Math.min.apply(null, stoerer.map(function (o) { return strecke(o, player, boss); }).concat([9999])) : -1;
    var teil = function (n) { return z && z.teile.filter(function (o) { return o.name === n; })[0]; };
    var weg = function (o) { return !o || (o.cameraFilter & cam.id) !== 0 || !o.visible; };
    return {
      phase: z ? z.phase + ':' + z.seite : null, boss: !!boss, stoerer: stoerer.length,
      sichtbar: sichtbar.length, zwischen: Math.round(zwischen),
      knoepfeWeg: z ? (weg(teil('bossintroWeiter')) && weg(teil('bossintroUeberspringen'))) : null,
      redeDa: z ? !weg(teil('bossintroRede')) : null
    };
  })()`);
}

test('Einstellung 7: Zwischenszene laeuft ohne Taste durch, keine Treppe/Tuer im Bild', async () => {
  const fehlerVorher = H.hardErrors().length;
  H.run(`window.TrailerModus.taste('7')`);
  assert.ok(await bisSeit(2600));
  let b = bossBild();
  assert.match(String(b.phase), /^rede:0/, 'die Rede des Kettenmeisters laeuft nicht: ' + b.phase);
  assert.strictEqual(b.redeDa, true, 'die Rede ist ausgeblendet');
  assert.strictEqual(b.knoepfeWeg, true, 'Weiter/Ueberspringen stehen im Bild');
  assert.ok(b.stoerer > 0, 'der Raum hat keine Treppe — der Test misst nichts');
  assert.strictEqual(b.sichtbar, 0, 'Treppe/Tuer im Bild');
  assert.ok(b.zwischen >= 150, 'Treppe/Tuer zu nah an der Strecke Spieler-Boss: ' + b.zwischen);
  assert.ok(await bisSeit(4600));
  assert.match(String(bossBild().phase), /^rede:1/, 'zweite Seite kommt nicht von selbst');
  assert.ok(await bisSeit(7600));
  b = bossBild();
  assert.strictEqual(b.phase, null, 'die Zwischenszene endet nicht von selbst');
  assert.strictEqual(b.boss, true);
  assert.strictEqual(b.sichtbar, 0, 'Treppe/Tuer im Bild (Kampf)');
  assert.ok(b.zwischen >= 100, 'Treppe/Tuer zwischen Spieler und Boss: ' + b.zwischen);
  assert.ok(await bisSeit(8200));
  assert.strictEqual(zustand().zeitlupe, true, 'der Treffer laeuft nicht in Zeitlupe');
  assert.strictEqual(H.run(`window.__GAME_PAUSE.since`), null, 'die Spieluhr steht noch');
  assert.deepStrictEqual(H.hardErrors().slice(fehlerVorher).map((f) => f.msg), []);
});

test('im Dungeon ist das HUD weg (Lebensleiste, Faehigkeiten, Minikarte)', async () => {
  H.run("window.TrailerModus.taste('4')");
  assert.ok(await bisSeit(300));
  const r = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    var id = gs.cameras.main.id;
    var band = gs.children.list.filter(function (o) {
      return o.scrollFactorX === 0 && o.depth >= 1001 && o.depth < 2400 && !o.__trailerBild;
    });
    return { n: band.length, sichtbar: band.filter(function (o) { return (o.cameraFilter & id) === 0; }).length };
  })()`);
  assert.ok(r.n > 10, 'HUD nicht gefunden (' + r.n + ')');
  assert.strictEqual(r.sichtbar, 0);
});

test('der Spieler ist unverwundbar und stirbt nicht', () => {
  const r = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    var max = playerMaxHealth;
    window._playerInvincible = false;           // was das Spiel nach einer Rolle tut
    applyPlayerDamage(9999, gs, null);
    var nachTreffer = playerHealth;
    window.addPlayerHealth(-9999);               // Brand/Gift gehen diesen Weg
    return { max: max, nachTreffer: nachTreffer, nachDot: playerHealth, tot: playerDeathHandled };
  })()`);
  assert.strictEqual(r.nachTreffer, r.max);
  assert.strictEqual(r.nachDot, r.max);
  assert.strictEqual(r.tot, false);
});

test('Taste Z verlangsamt die Spieluhr (gameNow) auf etwa 0.3', () => {
  const lauf = () => {
    const a = H.run(`window.gameNow(window.game.scene.getScene('GameScene'))`);
    H.step(60);
    return H.run(`window.gameNow(window.game.scene.getScene('GameScene'))`) - a;
  };
  const normal = lauf();
  H.run(`window.TrailerModus.taste('z')`);
  const langsam = lauf();
  const physik = H.run(`window.game.scene.getScene('GameScene').physics.world.timeScale`);
  H.run(`window.TrailerModus.taste('z')`);
  const wieder = lauf();
  assert.ok(normal > 900, 'normaler Lauf zu kurz: ' + normal);
  assert.ok(Math.abs(langsam / normal - 0.3) < 0.03, 'Zeitlupe: ' + langsam + ' / ' + normal);
  assert.ok(Math.abs(physik - 1 / 0.3) < 0.01, 'Physik nicht verlangsamt: ' + physik);
  assert.ok(Math.abs(wieder / normal - 1) < 0.03, 'zurueck auf normal: ' + wieder + ' / ' + normal);
});

test('Taste L schaltet die Letterbox, Tasten kommen auch ueber keydown an', () => {
  const box = () => H.run(`window.game.scene.getScene('TrailerOverlay').balken[0].visible`);
  assert.strictEqual(box(), false);
  H.dispatch('keydown', { key: 'l', preventDefault() {}, stopImmediatePropagation() {} });
  assert.strictEqual(box(), true);
  H.dispatch('keydown', { key: 'L', preventDefault() {}, stopImmediatePropagation() {} });
  assert.strictEqual(box(), false);
});

// Headless gibt es weder MediaRecorder noch captureStream. Erst der ehrliche
// Fall (Meldung statt Fehler), dann mit Attrappen der ganze Weg bis zur Datei.
test('Taste R ohne MediaRecorder: Meldung statt Fehler', () => {
  const vorher = H.hardErrors().length;
  assert.strictEqual(H.run(`typeof window.MediaRecorder`), 'undefined');
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(zustand().aufnahme, false);
  assert.match(H.run('window.TrailerModus.letzteMeldung'), /nicht möglich/);
  assert.strictEqual(H.hardErrors().length, vorher);
});

test('Taste R nimmt auf und speichert fogreach_<nr>_<name>_<lauf>.webm', () => {
  H.run(`(function () {
    window.__rec = []; window.__laden = [];
    function MR(strom, opts) { this.strom = strom; this.opts = opts; window.__rec.push(this); }
    MR.isTypeSupported = function (m) { return m === 'video/webm;codecs=vp9'; };
    MR.prototype.start = function (ms) { this.ms = ms; this.ondataavailable({ data: { size: 1234 } }); };
    MR.prototype.stop = function () { this.gestoppt = true; this.onstop(); };
    window.MediaRecorder = MR;
    window.game.canvas.captureStream = function (fps) { window.__fps = fps; return { addTrack: function () {} }; };
    window.URL = { createObjectURL: function () { return 'blob:probe'; }, revokeObjectURL: function () {} };
    var erzeugen = document.createElement;
    document.createElement = function (tag) {
      var el = erzeugen(tag);
      if (String(tag).toLowerCase() === 'a') el.click = function () { window.__laden.push(el.download); };
      return el;
    };
  })()`);
  assert.strictEqual(zustand().einstellung, 4, 'Vorbedingung: Einstellung 4 laeuft');
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(zustand().aufnahme, true, 'R startet keine Aufnahme');
  const opts = H.run(`JSON.stringify(window.__rec[0].opts)`);
  assert.match(opts, /vp9/);
  assert.match(opts, /12000000/);
  assert.strictEqual(H.run('window.__fps'), 60);
  H.step(10);
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(zustand().aufnahme, false, 'zweites R stoppt nicht');
  assert.strictEqual(H.run('window.__rec[0].gestoppt'), true);
  assert.deepStrictEqual(H.run('window.__laden.join(",")'), 'fogreach_4_kampf_01.webm');
  H.run(`window.TrailerModus.taste('r')`);
  H.run(`window.TrailerModus.taste('r')`);
  assert.deepStrictEqual(H.run('window.__laden.join(",")'), 'fogreach_4_kampf_01.webm,fogreach_4_kampf_02.webm');
  assert.strictEqual(H.run('window.TrailerModus.letzteAufnahme.teile'), 1);
});

test('kein Spielstand wird geschrieben — auch nicht durch saveGame', () => {
  H.run(`saveGame(window.game.scene.getScene('GameScene'))`);
  H.run(`window.SlotStorage.setItem('demonfall_save_v1', '{"probe":1}')`);
  assert.strictEqual(H.run(`window.SlotStorage.getItem('demonfall_save_v1')`), '{"probe":1}',
    'im Spiel muss das Schreiben weiter wirken (Sandkasten)');
  assert.strictEqual(speicherAbbild(), speicherVorher, 'localStorage wurde veraendert');
});
