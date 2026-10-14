// tests/aktKartenLueckenlos.test.js — Zwischen JEDEM Akt kommt eine Karte.
//
// Gemeldet: "aktwechsel gibts nicht zwischen jedem akt". Zwei Luecken:
//  1. Akt 1 ("Der Dienst") ist der Startakt. Karten entstanden nur beim
//     AUFSTIEG (advanceToAct) — in den Startakt steigt man nie auf, seine
//     Karte kam nie. Jetzt ist der Einfuehrungstext eines neuen Spiels die
//     Karte von Akt 1 (eine Karte, nicht zwei hintereinander).
//  2. Der Merkplatz pendingEvent war EINZELN: zwei Aktwechsel im selben Lauf
//     (z. B. Abschluesse im Dungeon) -> der zweite ueberschrieb den ersten.
//     Jetzt eine Warteschlange, und der Hub zeigt alle nacheinander.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;

before(async () => {
  H = await launch();
  await H.waitForScene('HubSceneV2', { timeoutMs: 60000 });
  for (let i = 0; i < 5; i++) await H.step(1);
});
after(async () => { if (H) await H.shutdown(); });

/** Karten abspielen, ohne echtes Overlay: zeichnet die actIds auf. */
function kartenAufzeichnen() {
  H.run(`(function () {
    var ss = window.storySystem;
    window.__karten = [];
    window.__echtOverlay = window.__echtOverlay || ss.showStoryOverlay;
    ss.showStoryOverlay = function (sc, d, cb) { window.__karten.push(d.actId); if (cb) cb(); };
  })()`);
}

test('Zwei Aktwechsel im selben Lauf: beide Karten, in Reihenfolge', () => {
  kartenAufzeichnen();
  const r = H.run(`(function () {
    var ss = window.storySystem, sc = ${hub};
    ss.resetToAct0();
    ss.advanceToAct(1);      // z. B. Harrens Auftrag im Dungeon erledigt
    ss.advanceToAct(2);      // und die geheime Sitzung im selben Lauf
    sc._dialogOpen = false;
    sc._checkStoryEvent();
    return window.__karten.join(',') + '|' + sc._dialogOpen;
  })()`);
  assert.strictEqual(r, 'treuer_diener,erste_risse|false', 'Karten: ' + r);
});

test('Ein Sprung ueber mehrere Akte (Altstand, Debug) zeigt nur den Zielakt', () => {
  kartenAufzeichnen();
  const r = H.run(`(function () {
    var ss = window.storySystem, sc = ${hub};
    ss.resetToAct0();
    ss.advanceToAct(2);
    sc._checkStoryEvent();
    return window.__karten.join(',');
  })()`);
  assert.strictEqual(r, 'erste_risse');
});

test('Die Warteschlange ueberlebt Speichern und Laden', () => {
  const r = H.run(`(function () {
    var ss = window.storySystem;
    ss.resetToAct0();
    ss.advanceToAct(1);
    ss.advanceToAct(2);
    ss.advanceToAct(3);
    var d = JSON.parse(JSON.stringify(ss.getStorySaveData()));
    ss.resetToAct0();
    ss.loadStorySaveData(d);
    var ids = [], e;
    while ((e = ss.consumePendingEvent())) ids.push(e.actId);
    return ids.join(',');
  })()`);
  assert.strictEqual(r, 'treuer_diener,erste_risse,wahrheit');
});

test('Neues Spiel: der Einfuehrungstext erscheint als Karte von Akt 1', () => {
  kartenAufzeichnen();
  const r = H.run(`(function () {
    var ss = window.storySystem, sc = ${hub};
    ss.resetToAct0();
    sc._dialogOpen = false;
    var aufgezeichnet = [];
    var echt = ss.showStoryOverlay;
    ss.showStoryOverlay = function (s, d, cb) { aufgezeichnet.push(d.actId + ':' + d.actNumber + ':' + (/Fogreach/.test(d.narrative))); if (cb) cb(); };
    try { sc._showIntroSplash(); } finally { ss.showStoryOverlay = echt; }
    return aufgezeichnet.join(',') + '|' + ss.startaktEreignis('x');
  })()`);
  // Akt 1, Nummer 1, mit dem Einfuehrungstext; danach ist sie verbraucht.
  assert.strictEqual(r, 'auftrag:1:true|null', r);
});

test('Wer schon weiter ist, bekommt keine Akt-1-Karte, sondern den alten Text', () => {
  const r = H.run(`(function () {
    var ss = window.storySystem, sc = ${hub};
    ss.resetToAct0();
    ss.advanceToAct(1);
    while (ss.consumePendingEvent()) {}
    var modal = 0, karte = 0;
    var echtM = sc._showSplashModal, echtO = ss.showStoryOverlay;
    sc._showSplashModal = function (t, b, c, onClose) { modal++; if (onClose) onClose(); };
    ss.showStoryOverlay = function (s, d, cb) { karte++; if (cb) cb(); };
    try { sc._showIntroSplash(); } finally { sc._showSplashModal = echtM; ss.showStoryOverlay = echtO; }
    return modal + ':' + karte;
  })()`);
  assert.strictEqual(r, '1:0');
});

test('ESC ueberspringt eine mehrseitige Akt-Karte ganz, Leertaste blaettert', () => {
  const r = H.run(`(function () {
    var ss = window.storySystem, sc = ${hub};
    var ss2 = window.__echtOverlay || ss.showStoryOverlay;
    var zu = 0;
    var nl = String.fromCharCode(10, 10);
    var lang = 'Erster Absatz. '.repeat(30) + nl + 'Zweiter Absatz. '.repeat(30) + nl + 'Dritter. '.repeat(30);
    var k = ss2.call(ss, sc, { actId: 'auftrag', actName: 'Der Dienst', actNumber: 1, narrative: lang }, function () { zu++; });
    var seiten = k.seiten.length;
    sc.input.keyboard.emit('keydown-SPACE', {});
    var nachLeer = k.seite() + ':' + zu;
    sc.input.keyboard.emit('keydown-ESC', {});
    return seiten + '|' + nachLeer + '|' + zu;
  })()`);
  const [seiten, nachLeer, zu] = r.split('|');
  assert.ok(Number(seiten) >= 3, 'die Karte hat nur ' + seiten + ' Seiten — Test misst nichts');
  assert.strictEqual(nachLeer, '1:0', 'Leertaste blaettert nicht eine Seite weiter');
  assert.strictEqual(zu, '1', 'ESC schliesst die Karte nicht');
});
