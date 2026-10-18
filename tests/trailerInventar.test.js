// tests/trailerInventar.test.js — Trailer-Einstellung 0: das Inventar.
//
// Wunsch: "was hältst du noch von einem weiteren clip, der das inventar
// zeigt?" Einstellung 0 fuellt Raster und Papierpuppe mit Stuecken aller
// Seltenheiten (inkl. Amulett), oeffnet das Inventar und zeigt den Tooltip
// eines legendaeren Stuecks — ohne Eingabe, reproduzierbar, im Bild (das
// Inventar liegt oberhalb des HUD-Bands, das der Trailer ausblendet).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, flush } = require('../tools/headless/index.js');

let H = null;
const zustand = () => H.run('window.TrailerModus.zustand()');

before(async () => {
  H = await launch({ search: '?trailer=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 300 }), 'kein Hub');
  await H.settle(() => zustand().hubGesehen, { maxRounds: 40 });
});
after(async () => { if (H) await H.shutdown(); });

async function bisSeit(ms) {
  for (let i = 0; i < 1500; i++) {
    if (zustand().seit >= ms) return true;
    H.step(4);
    await flush();
  }
  return false;
}

test('Taste 0: Inventar voller Beute, offen, Tooltip eines legendaeren Stuecks', async () => {
  H.run("window.TrailerModus.taste('0')");
  assert.ok(await bisSeit(2200), 'Einstellung 0 laeuft nicht an');
  const r = H.run(`(function () {
    var inv = window.inventory.filter(Boolean), eq = window.equipment;
    var tip = (typeof tooltip !== 'undefined') ? tooltip : null;
    var gs = window.game.scene.getScene('GameScene');
    var kam = gs.cameras.main;
    // Hochkant zeichnet die zweite Kamera (ohne Zoom) das Inventar, die
    // Hauptkamera nicht.
    var ui = gs.__trailerUiKam;
    var panelImBild = !!(invUI.panel && invUI.panel.visible && ui
      && !(invUI.panel.cameraFilter & ui.id) && (invUI.panel.cameraFilter & kam.id));
    // ... und ganz im schmalen Bild, der Tooltip darunter ueber den unteren 20 %.
    var w = gs.scale.width, h = gs.scale.height;
    var pb = invUI.panel.getBounds(), tb = tip.getBounds();
    var passt = pb.left >= 0 && pb.right <= w && pb.top >= h * 0.12
      && tb.left >= 0 && tb.right <= w && tb.top >= pb.bottom && tb.bottom <= h * 0.8;
    return {
      szene: gs.sys.isActive(), offen: invOpen, panelImBild: panelImBild, passt: passt,
      massstab: tip.scaleX, zoom: kam.zoom,
      stuecke: inv.length,
      legendaer: inv.filter(function (i) { return i.tier === 3; }).length,
      amulett: inv.some(function (i) { return i.type === 'amulet'; }) && !!eq.amulet,
      angelegt: ['weapon', 'offhand', 'head', 'body', 'boots'].filter(function (k) { return !!eq[k]; }).length,
      tooltip: !!(tip && tip.visible), titel: tip && tip.title ? tip.title.text : '',
      vergleich: !!(tip && tip.compareBox && tip.compareBox.visible),
      prunk: window.inventory.filter(function (i) { return i && i.tier === 3; })[0].displayName || ''
    };
  })()`);
  assert.ok(r.szene, 'nicht im Dungeon');
  assert.strictEqual(r.offen, true, 'das Inventar ist nicht offen');
  assert.ok(r.panelImBild, 'das Inventar ist nicht im Bild (vom HUD-Ausblenden erfasst?)');
  assert.ok(r.passt, 'Inventar/Tooltip passen hochkant nicht ins Bild');
  assert.ok(r.massstab > 1.2, 'der Tooltip ist hochkant nicht vergroessert: ' + r.massstab);
  assert.strictEqual(r.zoom, 1.8, 'die Welt dahinter steht nicht nah');
  assert.ok(r.stuecke >= 9, 'zu wenig Beute im Raster: ' + r.stuecke);
  assert.ok(r.legendaer >= 1, 'kein legendaeres Stueck im Raster');
  assert.ok(r.amulett, 'kein Amulett in Raster und Platz');
  assert.strictEqual(r.angelegt, 5, 'die Papierpuppe ist nicht voll');
  assert.ok(r.tooltip, 'kein Tooltip sichtbar');
  assert.ok(r.titel.length > 0, 'der Tooltip hat keinen Titel');
  assert.strictEqual(r.vergleich, false, 'der Vergleichskasten deckt das Raster zu');
});

// Geschlossen wird es beim Szenenwechsel vom Spiel selbst (kein eigener
// Aufraeumschritt noetig) — der Fall haelt fest, dass es so bleibt.
test('Wechsel auf eine andere Einstellung schliesst das Inventar', async () => {
  H.run("window.TrailerModus.taste('4')");
  for (let i = 0; i < 400 && H.run('invOpen'); i++) { H.step(4); await flush(); }
  assert.strictEqual(H.run('invOpen'), false, 'das Inventar bleibt ueber der naechsten Einstellung offen');
});

test('Aufnahme in Einstellung 0 heisst fogreach_0_inventar_01.webm', () => {
  const r = H.run(`(function () {
    window.TrailerModus.taste('0');
    var namen = [];
    var echtC = HTMLCanvasElement.prototype.captureStream;
    var canvas = window.game.canvas;
    canvas.captureStream = function () { return { getTracks: function () { return []; }, addTrack: function () {}, getVideoTracks: function () { return []; } }; };
    var echtMR = window.MediaRecorder;
    window.MediaRecorder = function () { this.state = 'inactive'; };
    window.MediaRecorder.isTypeSupported = function () { return true; };
    window.MediaRecorder.prototype.start = function () { this.state = 'recording'; };
    window.MediaRecorder.prototype.stop = function () { this.state = 'inactive'; if (this.onstop) this.onstop(); };
    var echtA = document.createElement;
    window.__dateiname = null;
    var echtUrl = URL.createObjectURL;
    URL.createObjectURL = function () { return 'blob:x'; };
    document.createElement = function (t) {
      var el = echtA.call(document, t);
      if (String(t).toLowerCase() === 'a') { el.click = function () { window.__dateiname = el.download; }; }
      // Hochkant nimmt eine eigene, doppelt so grosse Leinwand auf.
      if (String(t).toLowerCase() === 'canvas') el.captureStream = canvas.captureStream;
      return el;
    };
    try {
      window.TrailerModus.taste('r');
      window.TrailerModus.taste('r');
    } finally {
      document.createElement = echtA; window.MediaRecorder = echtMR; URL.createObjectURL = echtUrl;
      delete canvas.captureStream;
    }
    return window.__dateiname;
  })()`);
  assert.ok(/^fogreach_0_inventar_\d\d\.webm$/.test(String(r)), 'Dateiname: ' + r);
});

test('Tooltip: der Typ steht in der Sprache des Spiels, nicht roh ("WEAPON")', () => {
  const r = H.run(`(function () {
    window.TrailerModus.taste('0');
    var aus = function () {
      var it = window.LootSystem.rollItem('WPN_EISENKLINGE', 10, 1);
      var box = tooltip; box.setVisible(false);
      var z = invUI.zellen[0];
      if (!invOpen) openInventory();
      window.inventory[0] = it; it.gridX = z.c; it.gridY = z.r;
      refreshInventoryUI();
      var b = z.bg.getBounds();
      z.bg.emit('pointerover', { x: b.centerX, y: b.centerY });
      return box.body ? box.body.text : '';
    };
    var de = aus();
    window.i18n.setLanguage('en');
    var en = aus();
    window.i18n.setLanguage('de');
    return de + '|||' + en;
  })()`);
  const [de, en] = r.split('|||');
  assert.ok(/Typ: Waffe/.test(de), 'DE: ' + de);
  assert.ok(/Type: Weapon/.test(en), 'EN: ' + en);
  assert.ok(!/WEAPON/.test(de + en), 'roher Typ im Tooltip');
});
