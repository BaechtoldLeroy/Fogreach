// tests/ladeBildschirm.test.js — der Ladebildschirm im Messing-Stil
// (js/ladeBildschirm.js), am echten Spiel headless im Canvas-Renderer.
//
// Headless kommt jede Datei schon im naechsten Takt an; der Ladebildschirm
// waere nach einem Frame wieder weg. Darum haengt jeder Fall eine Datei an,
// die erst kommt, wenn der Test sie loslaesst ('__haengt'): bis dahin steht
// die Szene im Laden, und der Fortschritt laesst sich von Hand setzen.
//
// Geprueft:
//   - Start: Messing-Titel, Laterne, Messingleiste, Status und Prozent in der
//     Serifenschrift (kein Monospace, kein Dateiname), die Leiste waechst
//     sichtbar mit dem Fortschritt, Texte lesbar (Kontrast >= 4,5:1), nach
//     dem Laden weiches Ausblenden und danach alles abgeraeumt,
//   - Rueckfall ohne die Pack-Bilder: Schriftzug als Text, gezeichnete Leiste,
//   - Hub und Keller: derselbe Bildschirm, aber erst nach der Verzoegerung;
//     ohne etwas zu laden blitzt er nicht auf.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');
const { kontraste, alleLesbar, TEXTE_IN } = require('./kontrastMessung');

let H = null;

/** Bilder mit '__haengt' im Pfad laden erst, wenn loslassen() sie freigibt. */
function haengenEinrichten() {
  H.run(`(function () {
    var d = Object.getOwnPropertyDescriptor(window.Image.prototype, 'src');
    window.__srcOrig = d;
    Object.defineProperty(window.Image.prototype, 'src', { configurable: true, get: d.get,
      set: function (v) { if (String(v).indexOf('__haengt') >= 0) { window.__haengend = this; return; } d.set.call(this, v); } });
  })()`);
}

before(async () => {
  H = await launch({ renderer: 'canvas', waitFor: 'StartScene' });
  haengenEinrichten();
});
after(async () => { if (H) await H.shutdown(); });

const T = (key) => H.window.i18n.t(key);
const szene = (key) => H.scene(key);
const status = (key) => H.scenes().find((s) => s.key === key).status;

/**
 * Szene key starten (oder neu starten) und ihr preload eine haengende Datei
 * anhaengen; takten, bis nur noch diese offen ist. vorher laeuft vor dem
 * Start, imPreload zu Beginn des preload (die alte Szene ist dann schon weg).
 */
async function startenUndAnhalten(key, vorher, imPreload) {
  H.run(`(function () {
    var s = window.game.scene.getScene('${key}');
    if (s.textures.exists('__haengt')) s.textures.remove('__haengt');
    window.__haengend = null;
    var orig = s.preload;
    s.preload = function () {
      s.preload = orig;
      ${imPreload || ''}
      orig.apply(s, arguments);
      s.load.image('__haengt', 'assets/__haengt.png');
    };
    ${vorher || ''}
    var aktiv = window.game.scene.getScenes(true).filter(function (x) {
      return ['StartScene', 'HubSceneV2', 'GameScene'].indexOf(x.sys.settings.key) >= 0; })[0];
    if (aktiv === s) s.scene.restart(); else aktiv.scene.start('${key}');
  })()`);
  let erste = null;    // Deckkraft im ersten Bild des Ladens
  for (let i = 0; i < 400; i++) {
    H.step(1);
    if (erste === null && lb(key)) erste = lb(key).alpha;
    const offen = H.run(`(function () { var l = window.game.scene.getScene('${key}').load;
      return l.list.size + l.inflight.size + l.queue.size; })()`);
    if (offen === 1 && H.run('!!window.__haengend')) break;
    await new Promise((r) => setTimeout(r, 0));
  }
  assert.strictEqual(status(key), 'LOADING', key + ' laedt nicht (mehr)');
  return erste;
}

/** Die haengende Datei freigeben und warten, bis die Szene laeuft. */
async function loslassen(key) {
  H.run(`window.__srcOrig.set.call(window.__haengend, 'assets/start/start_funke.png')`);
  assert.ok(await H.waitForScene(key), key + ' kam nach dem Laden nicht');
}

/** Ein Bild rendern (ohne Ladeschlange) und den Pixel bei (x, y) liefern. */
function pixel(x, y) {
  H.run('(function () { var g = window.game; g.renderer.preRender(); g.scene.render(g.renderer); g.renderer.postRender(); })()');
  const c = H.window.game.canvas;
  const d = c.getContext('2d').getImageData(Math.round(x * c.width / 960), Math.round(y * c.height / 480), 1, 1).data;
  return [d[0], d[1], d[2]];
}
const warm = (p) => p[0] > 150 && p[0] > p[2] + 80;

/** Laeuft der Ladebildschirm-Container gerade in der Szene? */
const lb = (key) => H.run(`(function () { var h = window.game.scene.getScene('${key}').ladeBildschirm;
  if (!h || !h.container) return null;
  return { voll: h.voll, alpha: h.container.alpha, wert: h.wert, breite: h.fuellBreite, innen: h.innen,
    titelTyp: h.titel.type, titelBild: h.titel.texture ? h.titel.texture.key : null, titelText: h.titel.text || null,
    rahmenTyp: h.rahmen.type, rahmenBild: h.rahmen.texture ? h.rahmen.texture.key : null,
    laterne: !!h.laterne, status: h.status.text, prozent: h.prozent.text,
    schriften: [h.status.style.fontFamily, h.prozent.style.fontFamily],
    groessen: [parseInt(h.status.style.fontSize, 10), parseInt(h.prozent.style.fontSize, 10)],
    texte: h.container.list.filter(function (o) { return o.type === 'Text'; }).map(function (o) { return o.text; }),
    statusBreite: h.status.getBounds().width, titelBreite: h.titel.getBounds().width };
})()`);

const fortschritt = (key, wert) => H.run(`window.game.scene.getScene('${key}').load.emit('progress', ${wert})`);

test('Start: Messing-Titel, Laterne, Messingleiste, Status und Prozent in Serifenschrift', async () => {
  const erste = await startenUndAnhalten('StartScene');
  assert.strictEqual(erste, 1, 'beim Start nicht sofort sichtbar');
  const z = lb('StartScene');
  assert.ok(z, 'kein Ladebildschirm waehrend des Ladens');
  assert.strictEqual(z.voll, true, 'Pack-Bilder fehlen — Rueckfall statt Messing');
  assert.strictEqual(z.titelBild, 'start_titel', 'kein Messing-Schriftzug');
  assert.ok(/^ui_leiste@/.test(z.rahmenBild || ''), 'keine Messingleiste: ' + z.rahmenBild);
  assert.ok(z.laterne, 'keine Laterne');
  assert.strictEqual(z.alpha, 1, 'beim Start sofort sichtbar');
  assert.strictEqual(z.status, T('start.loading'));
  assert.ok(/^\d+ %$/.test(z.prozent), 'Prozent fehlt: ' + z.prozent);
  z.schriften.forEach((f) => assert.strictEqual(f, 'serif'));
  // Kein Dateiname mehr (er wechselte zu schnell, um ihn zu lesen).
  assert.strictEqual(z.texte.slice().sort().join('|'), [z.prozent, z.status].sort().join('|'), 'weitere Texte');
  // Hochkant auf dem Handy (960x480 FIT, etwa 0,4fach) noch lesbar und im Bild.
  assert.ok(z.groessen[0] >= 26 && z.groessen[1] >= 20, 'Schrift zu klein: ' + z.groessen);
  assert.ok(z.statusBreite < 900 && z.titelBreite >= 300, 'Breiten: ' + z.statusBreite + '/' + z.titelBreite);
});

test('Start: die Leiste waechst sichtbar mit dem Fortschritt', () => {
  const i = lb('StartScene').innen;
  const y = i.y + i.h / 2;
  fortschritt('StartScene', 0.2);
  const a = lb('StartScene');
  assert.strictEqual(a.prozent, '20 %');
  assert.ok(warm(pixel(i.x + 6, y)), 'bei 20 % glueht der Anfang nicht');
  assert.ok(!warm(pixel(i.x + i.w * 0.6, y)), 'bei 20 % glueht schon die Mitte');
  fortschritt('StartScene', 0.8);
  const b = lb('StartScene');
  assert.strictEqual(b.prozent, '80 %');
  assert.ok(b.breite > a.breite * 3.5, 'Fuellung waechst nicht: ' + a.breite + ' -> ' + b.breite);
  assert.ok(warm(pixel(i.x + i.w * 0.6, y)), 'bei 80 % glueht die Mitte nicht');
  assert.ok(!warm(pixel(i.x + i.w - 6, y)), 'bei 80 % glueht schon das Ende');
});

test('Start: Status und Prozent sind lesbar (Kontrast >= 4,5:1)', () => {
  const liste = kontraste(H, TEXTE_IN("window.game.scene.getScene('StartScene').ladeBildschirm.container.list"));
  assert.strictEqual(liste.length, 2, 'Texte: ' + liste.map((t) => t.text));
  alleLesbar(liste, 'Ladebildschirm');
});

test('Start: nach dem Laden weich ausgeblendet, dann alles abgeraeumt', async () => {
  const hoerer = H.run("window.game.scene.getScene('StartScene').load.listenerCount('progress')");
  await loslassen('StartScene');
  // Das Menue steht schon, der Ladebildschirm liegt noch darueber und blendet aus.
  const alphas = [];
  for (let i = 0; i < 40; i++) {
    const z = lb('StartScene');
    if (!z) break;
    alphas.push(z.alpha);
    H.step(1);
  }
  assert.ok(szene('StartScene').titel, 'Menue nicht gebaut');
  assert.ok(alphas.length >= 5 && alphas.some((a) => a > 0.2 && a < 0.9),
    'kein weicher Uebergang: ' + alphas.map((a) => a.toFixed(2)));
  assert.strictEqual(lb('StartScene'), null, 'Ladebildschirm nicht abgeraeumt');
  assert.strictEqual(H.run(`window.game.scene.getScene('StartScene').children.list
    .filter(function (o) { return o.depth >= 20000; }).length`), 0, 'Reste des Ladebildschirms');
  assert.ok(H.run("window.game.scene.getScene('StartScene').load.listenerCount('progress')") < hoerer,
    'Fortschritts-Hoerer bleibt haengen');
});

test('Start: ohne Pack-Bilder der schlichte Rueckfall in denselben Farben', async () => {
  await startenUndAnhalten('StartScene', `
    window.__packVorher = s.sys.settings.pack;
    s.sys.settings.pack = { files: [] };`, `
    window.Ladebildschirm.PACK_KEYS.forEach(function (k) { if (s.textures.exists(k)) s.textures.remove(k); });
    // Der Titelglanz zeigt sonst auf die Bilder der entfernten Textur.
    s.anims.remove('start_titel_glanz');`);
  const z = lb('StartScene');
  assert.ok(z, 'kein Ladebildschirm im Rueckfall');
  assert.strictEqual(z.voll, false);
  assert.strictEqual(z.titelTyp, 'Text');
  assert.strictEqual(z.titelText, 'Fogreach');
  assert.strictEqual(z.rahmenTyp, 'Graphics');
  assert.strictEqual(z.laterne, false);
  fortschritt('StartScene', 0.5);
  const i = z.innen;
  assert.ok(warm(pixel(i.x + 6, i.y + i.h / 2)), 'Rueckfall-Leiste glueht nicht');
  assert.strictEqual(lb('StartScene').prozent, '50 %');
  alleLesbar(kontraste(H, TEXTE_IN("window.game.scene.getScene('StartScene').ladeBildschirm.container.list")), 'Rueckfall');
  H.run("window.game.scene.getScene('StartScene').sys.settings.pack = window.__packVorher");
  await loslassen('StartScene');
  H.step(40);
  assert.strictEqual(lb('StartScene'), null);
  // Noch ein Neustart mit dem Pack: danach ist alles wieder wie beim Boot.
  H.run("window.game.scene.getScene('StartScene').scene.restart()");
  assert.ok(await H.waitForScene('StartScene'));
  H.step(40);
  assert.ok(H.run('window.Ladebildschirm.bilderDa(window.game.scene.getScene("StartScene"))'), 'Pack nicht nachgeladen');
  assert.ok(szene('StartScene').titel && szene('StartScene').titel.texture.key === 'start_titel',
    'Menue-Titel fehlt nach dem Rueckfall');
});

test('Hub: Ladebildschirm erst nach der Verzoegerung, dann abgeraeumt', async () => {
  const erste = await startenUndAnhalten('HubSceneV2');
  assert.strictEqual(erste, 0, 'im Hub sofort sichtbar (soll erst nach 250 ms kommen)');
  assert.ok(lb('HubSceneV2'), 'kein Ladebildschirm im Hub');
  // Wie lange schon geladen wurde, haengt am Rechner; die Verzoegerung zaehlt
  // die Zeit im Laden. Also: einblenden muss er spaetestens nach 0,5 s.
  for (let i = 0; i < 30 && lb('HubSceneV2').alpha < 1; i++) H.step(1);
  const z = lb('HubSceneV2');
  assert.strictEqual(z.alpha, 1, 'Ladebildschirm im Hub blendet nicht ein');
  assert.strictEqual(z.status, T('start.loading_hub'));
  assert.strictEqual(z.voll, true);
  await loslassen('HubSceneV2');
  H.step(40);
  assert.strictEqual(lb('HubSceneV2'), null, 'Ladebildschirm bleibt im Hub liegen');
});

test('Hub: ohne Ladezeit blitzt nichts auf', async () => {
  const hub = szene('HubSceneV2');
  H.run("window.game.scene.getScene('HubSceneV2').scene.restart()");
  // Gleich nach dem Bauen schauen: nichts zu laden -> nie sichtbar.
  for (let i = 0; i < 20; i++) {
    H.step(1);
    const z = lb('HubSceneV2');
    assert.ok(!z || z.alpha === 0, 'Ladebildschirm blitzt auf (alpha ' + (z && z.alpha) + ')');
    if (status('HubSceneV2') === 'RUNNING') break;
  }
  assert.strictEqual(status('HubSceneV2'), 'RUNNING');
  assert.strictEqual(lb('HubSceneV2'), null);
  assert.ok(hub);
});

test('Keller: derselbe Ladebildschirm beim Abstieg', async () => {
  // Der Keller braucht einen begonnenen Lauf (initDungeonRun): wie im
  // Spiel ueber ?autostart=1 in den Hub und von dort hinab.
  await H.shutdown();
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(20);
  haengenEinrichten();
  const erste = await startenUndAnhalten('GameScene');
  assert.strictEqual(erste, 0, 'im Keller sofort sichtbar');
  for (let i = 0; i < 30 && lb('GameScene') && lb('GameScene').alpha < 1; i++) H.step(1);
  const z = lb('GameScene');
  assert.ok(z, 'kein Ladebildschirm im Keller');
  assert.strictEqual(z.alpha, 1);
  assert.strictEqual(z.status, T('start.loading_dungeon'));
  assert.strictEqual(z.titelBild, 'start_titel');
  await loslassen('GameScene');
  // Ausblenden laeuft ueber dem Keller.
  assert.ok(lb('GameScene') && lb('GameScene').alpha > 0, 'kein weicher Uebergang in den Keller');
  H.step(40);
  assert.strictEqual(lb('GameScene'), null, 'Ladebildschirm bleibt im Keller liegen');
});
