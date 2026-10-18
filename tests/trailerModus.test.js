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

// Hochkant (Standard mit ?trailer=1) zeigt eine zweite Kamera ohne Zoom alles
// am Bildschirm Klebende; "im Bild" heisst darum: irgendeine Kamera der Szene
// zeichnet es.
// KAMERA_ZEIGT fragt nur die Kameras, IM_BILD auch visible.
const KAMERA_ZEIGT = `function (o) {
  if (!o || !o.scene) return false;
  return o.scene.cameras.cameras.some(function (k) { return (o.cameraFilter & k.id) === 0; });
}`;
const IM_BILD = `function (o) { return !!o && o.visible !== false && (${KAMERA_ZEIGT})(o); }`;

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
    var weg = function (o) { return !!o && !(${KAMERA_ZEIGT})(o); };
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
    return (${IM_BILD})(hub._hubMenuBtn);
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

test('hochkant: ?trailer=1 laeuft auf einem 9:16-Canvas (540x960)', () => {
  assert.strictEqual(H.run('JSON.stringify([window.game.scale.width, window.game.scale.height, window.game.canvas.width, window.game.canvas.height])'),
    '[540,960,540,960]');
  assert.strictEqual(zustand().hochkant, true);
});

// Hochkant: was eine Einstellung zeigt, muss ganz ins schmale Bild passen.
// INNEN(b, unten): Rechteck im Canvas, optional unten nur bis `unten`
// (die unteren 20 % belegen Reels/Shorts mit ihrer Oberflaeche).
const INNEN = `function (b, unten) { return b.left >= -1 && b.right <= 541 && b.top >= -1 && b.bottom <= (unten || 961); }`;
// AUF_UI(o): nur die Kamera ohne Zoom zeichnet es, nicht die Hauptkamera.
const AUF_UI = `function (o) { var s = o.scene, ui = s.__trailerUiKam; return !!ui && (o.cameraFilter & s.cameras.main.id) !== 0 && (o.cameraFilter & ui.id) === 0; }`;
const HUB = `window.game.scene.getScene('HubSceneV2')`;
const GS = `window.game.scene.getScene('GameScene')`;
const HOCH = {
  1: `${HUB}.cameras.main.zoom === 1.3`,
  2: `(function () { var hub = ${HUB}, c = hub._dialogContainer;
        return hub.cameras.main.zoom === 2 && (${AUF_UI})(c) && (${INNEN})(c.getBounds(), 768); })()`,
  3: `${GS}.cameras.main.zoom === 1.8`,
  4: `${GS}.cameras.main.zoom === 1.8`,
  5: `${GS}.cameras.main.zoom === 1.6`,
  6: `(function () { var b = ${HUB}.__trailerBuehne;
        return !!b.box && (${AUF_UI})(b.box) && b.figuren.length === 3
          && b.figuren.every(function (f) { return (${INNEN})(f.getBounds(), 768) && f.getBounds().top > 115; }); })()`,
  7: `${GS}.cameras.main.zoom === 1.8`,
  8: `(function () { var p = ${HUB}.children.list.filter(function (o) { return o.name === 'druckerpresse'; })[0];
        return (${AUF_UI})(p) && (${INNEN})(p.getBounds()); })()`,
  9: `(${INNEN})(window.game.scene.getScene('TrailerTitel').titel.getBounds())`,
};

// Wo jede Einstellung landen muss, und woran man sieht, dass sie aufgebaut ist.
// Tempo (Wunsch "der trailer ist etwas zu langsam vom pacing"): `bis` ist
// zugleich die Frist — was eine Einstellung zeigen soll, steht spaetestens
// dann; `moment` ist ihr Hoehepunkt mit Frist (ms ab Aufbau). Vorher lagen
// die Hoehepunkte bei 1,7-7,5 s.
const ERWARTET = {
  1: { szene: 'HubSceneV2', bis: 2300, moment: ['rathaus', 2300] },
  2: { szene: 'HubSceneV2', bis: 600, pruef: `!!window.game.scene.getScene('HubSceneV2')._dialogContainer`, moment: ['dialog', 400] },
  3: { szene: 'GameScene', bis: 2600, moment: ['keller', 2600] },
  4: { szene: 'GameScene', bis: 3700, moment: ['wache', 3700] },
  // Kampf mit HUD (ersetzt die Verkleidung): HUD im Bild, Stufenaufstieg.
  5: { szene: 'GameScene', bis: 2800, pruef: `window.TrailerModus.zustand().hudAn && playerLevel >= 2`, moment: ['stufe', 2600] },
  6: { szene: 'HubSceneV2', bis: 800, pruef: `!!window.game.scene.getScene('HubSceneV2').__trailerBuehne`, moment: ['sitzung', 600], ende: 2600 },
  7: { szene: 'GameScene', bis: 3200, pruef: `!window.game.scene.getScene('GameScene').__bossZwischenszene && enemies.getChildren().some(function (e) { return e.active && e.isBoss && e.bossType === 'chainMaster'; })`, moment: ['treffer', 3000] },
  // #198: die stampfende Presse gross im Bild (frueher Fassade + Druckerei-Ansicht).
  8: { szene: 'HubSceneV2', bis: 1500, pruef: `window.game.scene.getScene('HubSceneV2').children.list.some(function (o) { return o.name === 'druckerpresse' && o.visible; })`, moment: ['presse', 900] },
  9: { szene: 'TrailerTitel', bis: 2600, pruef: `window.game.scene.getScene('TrailerTitel').titel.alpha > 0.9`, moment: ['titel', 2600] },
};

for (const n of Object.keys(ERWARTET)) {
  test('Einstellung ' + n + ' baut fehlerfrei auf, landet in ' + ERWARTET[n].szene + ' und kommt schnell zur Sache', async () => {
    const e = ERWARTET[n];
    const fehlerVorher = H.hardErrors().length;
    H.run(`window.TrailerModus.taste('${n}')`);
    assert.ok(await bisSeit(e.bis), 'Einstellung ' + n + ' wurde nicht aufgebaut');
    const neu = H.hardErrors().slice(fehlerVorher);
    assert.deepStrictEqual(neu.map((f) => f.msg), [], 'Fehler in Einstellung ' + n);
    assert.ok(aktiv(e.szene), 'Einstellung ' + n + ' steht in ' + H.activeScenes().join(','));
    if (e.auch) assert.ok(aktiv(e.auch), e.auch + ' fehlt');
    if (e.pruef) assert.strictEqual(H.run(e.pruef), true, 'Einstellung ' + n + ': ' + e.pruef);
    assert.strictEqual(H.run(HOCH[n]), true, 'Einstellung ' + n + ' hochkant: ' + HOCH[n]);
    assert.ok(aktiv('TrailerOverlay'), 'das Overlay ist verschwunden');
    const z = zustand();
    const [name, frist] = e.moment;
    assert.ok(z.momente[name] !== undefined && z.momente[name] <= frist,
      'Einstellung ' + n + ': Hoehepunkt "' + name + '" bei ' + z.momente[name] + ' ms, Frist ' + frist);
    // Kein Schritt der Choreografie liegt spaeter als 4,5 s (Boss mit Zeitlupe).
    assert.ok(z.planEnde <= 4500, 'Einstellung ' + n + ': letzter Schritt bei ' + z.planEnde + ' ms');
    // Mit Kamerafahrt: auch am Ende der Fahrt passt alles ins Bild.
    if (e.ende) {
      assert.ok(await bisSeit(e.ende));
      assert.strictEqual(H.run(HOCH[n]), true, 'Einstellung ' + n + ' hochkant am Ende: ' + HOCH[n]);
    }
  });
}

test('Taste 5 ist der Kampf mit HUD, die Verkleidung ist weg', () => {
  assert.strictEqual(H.run(`window.TrailerModus.EINSTELLUNGEN[5].kurz`), 'kampfhud');
  assert.strictEqual(H.run(`Object.keys(window.TrailerModus.EINSTELLUNGEN).join(',')`), '0,1,2,3,4,5,6,7,8,9');
  assert.strictEqual(H.run(`JSON.stringify(window.TrailerModus.EINSTELLUNGEN).indexOf('erkleidung')`), -1);
});

// Einstellung 7 im Einzelnen. Beim Aufnehmen stand eine Treppe (der
// Durchgang des Raums, "eine Tuer") genau zwischen Spieler und Kettenmeister.
// Und seit die Boss-Zwischenszene fest eingebaut ist, darf sie die
// Einstellung nicht anhalten: sie laeuft ohne Taste durch.
// (Der Testkopf schaltet die Zwischenszene sonst ab; die Einstellung zeigt
// sie bewusst und schaltet sie fuer den Kettenmeister selbst ein.)
const STOERER = `function (o) { return o && o.texture && /^(stair|tor_neu|door)/i.test(o.texture.key); }`;
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
    var weg = function (o) { return !(${IM_BILD})(o); };
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
  // Zuegiger als im Spiel: die Rede steht schon nach ~1,1 s.
  assert.ok(await bisSeit(1500));
  let b = bossBild();
  assert.match(String(b.phase), /^rede:0/, 'die Rede des Kettenmeisters laeuft nicht: ' + b.phase);
  assert.strictEqual(b.redeDa, true, 'die Rede ist ausgeblendet');
  assert.strictEqual(b.knoepfeWeg, true, 'Weiter/Ueberspringen stehen im Bild');
  assert.ok(b.stoerer > 0, 'der Raum hat keine Treppe — der Test misst nichts');
  assert.strictEqual(b.sichtbar, 0, 'Treppe/Tuer im Bild');
  assert.ok(b.zwischen >= 150, 'Treppe/Tuer zu nah an der Strecke Spieler-Boss: ' + b.zwischen);
  // Hochkant: Plakette und Rede ganz im Bild, die Rede ueber den unteren
  // 20 %, beide auf der Kamera ohne Zoom; der Boss steht ueber dem Spieler.
  const hoch = H.run(`(function () {
    var gs = ${GS}, z = gs.__bossZwischenszene;
    var teil = function (n) { return z.teile.filter(function (o) { return o.name === n; })[0]; };
    var name = teil('bossintroName'), rede = teil('bossintroRede');
    var boss = enemies.getChildren().filter(function (e) { return e.active && e.isBoss; })[0];
    return {
      name: !!name && (${INNEN})(name.getBounds(), 768) && (${AUF_UI})(name),
      rede: !!rede && (${INNEN})(rede.getBounds(), 768) && (${AUF_UI})(rede),
      ueber: boss.y < player.y - 100
    };
  })()`);
  assert.strictEqual(JSON.stringify(hoch), JSON.stringify({ name: true, rede: true, ueber: true }));
  assert.ok(zustand().momente.plakette <= 1200, 'Plakette erst bei ' + zustand().momente.plakette);
  // Das Tempo gilt nur fuer diesen Auftritt — das Spiel behaelt seines.
  assert.strictEqual(H.run('window.BossZwischenszene._TEMPO'), 1);
  assert.ok(await bisSeit(2700));
  b = bossBild();
  assert.strictEqual(b.phase, null, 'die Zwischenszene endet nicht von selbst');
  assert.strictEqual(b.boss, true);
  assert.strictEqual(b.sichtbar, 0, 'Treppe/Tuer im Bild (Kampf)');
  assert.ok(b.zwischen >= 100, 'Treppe/Tuer zwischen Spieler und Boss: ' + b.zwischen);
  assert.ok(await bisSeit(3100));
  assert.strictEqual(zustand().zeitlupe, true, 'der Treffer laeuft nicht in Zeitlupe');
  assert.strictEqual(H.run(`window.__GAME_PAUSE.since`), null, 'die Spieluhr steht noch');
  assert.deepStrictEqual(H.hardErrors().slice(fehlerVorher).map((f) => f.msg), []);
});

test('im Dungeon ist das HUD weg (Lebensleiste, Faehigkeiten, Minikarte)', async () => {
  H.run("window.TrailerModus.taste('4')");
  assert.ok(await bisSeit(300));
  const r = H.run(`(function () {
    var gs = window.game.scene.getScene('GameScene');
    var band = gs.children.list.filter(function (o) {
      return o.scrollFactorX === 0 && o.depth >= 1001 && o.depth < 2400 && !o.__trailerBild;
    });
    // (Unsichtbares zaehlt mit: das Spiel schaltet visible selbst um.)
    return { n: band.length, sichtbar: band.filter(function (o) {
      return gs.cameras.cameras.some(function (k) { return (o.cameraFilter & k.id) === 0; });
    }).length };
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
  // Hochkant decken die Balken die Zonen der Plattform-Oberflaeche ab: oben 12 %, unten 20 %.
  assert.strictEqual(H.run(`JSON.stringify(window.game.scene.getScene('TrailerOverlay').balken.map(function (b) { return b.height; }))`), '[115,192]');
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
    // Hochkant nimmt eine eigene, doppelt so grosse Leinwand auf; das
    // Spiel-Canvas selbst darf dann nicht die Quelle sein.
    window.__postrenderVorher = window.game.events.listenerCount('postrender');
    var strom = function (fps) { window.__fps = fps; window.__quelle = this; return { addTrack: function () {} }; };
    window.game.canvas.captureStream = strom;
    window.URL = { createObjectURL: function () { return 'blob:probe'; }, revokeObjectURL: function () {} };
    var erzeugen = document.createElement;
    document.createElement = function (tag) {
      var el = erzeugen(tag);
      if (String(tag).toLowerCase() === 'a') el.click = function () { window.__laden.push(el.download); };
      if (String(tag).toLowerCase() === 'canvas') el.captureStream = strom;
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
  assert.strictEqual(H.run('window.__quelle !== window.game.canvas'), true, 'hochkant nimmt das kleine Spiel-Canvas auf');
  assert.strictEqual(H.run('window.__quelle.width + "x" + window.__quelle.height'), '1080x1920');
  H.step(10);
  H.run(`window.TrailerModus.taste('r')`);
  assert.strictEqual(zustand().aufnahme, false, 'zweites R stoppt nicht');
  assert.strictEqual(H.run('window.__rec[0].gestoppt'), true);
  assert.deepStrictEqual(H.run('window.__laden.join(",")'), 'fogreach_4_kampf_01.webm');
  H.run(`window.TrailerModus.taste('r')`);
  H.run(`window.TrailerModus.taste('r')`);
  assert.deepStrictEqual(H.run('window.__laden.join(",")'), 'fogreach_4_kampf_01.webm,fogreach_4_kampf_02.webm');
  assert.strictEqual(H.run('window.TrailerModus.letzteAufnahme.teile'), 1);
  assert.strictEqual(H.run('window.TrailerModus.letzteAufnahme.groesse'), '1080x1920');
  // Die Kopie ins grosse Bild haengt nach dem Stopp nicht mehr am Spiel.
  assert.strictEqual(H.run(`window.game.events.listenerCount('postrender')`), H.run('window.__postrenderVorher'));
});

test('kein Spielstand wird geschrieben — auch nicht durch saveGame', () => {
  H.run(`saveGame(window.game.scene.getScene('GameScene'))`);
  H.run(`window.SlotStorage.setItem('demonfall_save_v1', '{"probe":1}')`);
  assert.strictEqual(H.run(`window.SlotStorage.getItem('demonfall_save_v1')`), '{"probe":1}',
    'im Spiel muss das Schreiben weiter wirken (Sandkasten)');
  assert.strictEqual(speicherAbbild(), speicherVorher, 'localStorage wurde veraendert');
});
