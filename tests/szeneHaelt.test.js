// tests/szeneHaelt.test.js — Story-Szenen warten auf den Spieler.
//
// Sie liefen nach einer festen Lesepause (900 ms) von selbst weiter. Wer
// langsamer liest — oder waehrend einer Zeile kurz wegschaut — verlor den
// Satz, und diese Szenen tragen die Geschichte: die Ratssitzung, das
// Wiedersehen, der Verrat.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.flags = {}; st.quests = {};
    qs.loadQuestSaveData(st);
    window.__fertig = 0;
    // Eine Szene, die noch haelt, stammt aus dem Test davor (der loest sie
    // absichtlich NIE auf). Sie muss weg, sonst startet die naechste
    // Sitzung darueber und beide Texte stehen gleichzeitig im Bild.
    var hub = window.game.scene.getScene('HubSceneV2');
    for (var i = 0; i < 3 && hub.__szeneWartet; i++) {
      var w = hub.__szeneWartet;
      hub.__szeneWartet = null;
      try { w.ausloesen(); } catch (e) {}
    }
    return 1;
  })()`);
  H.step(20);
});

/** Startet die oeffentliche Ratssitzung und schreibt den Text fertig. */
function sitzungStarten() {
  return H.run(`(function () {
    var hub = window.game.scene.getScene('HubSceneV2');
    window.__fertig = 0;
    window.storyScenes.playOeffentlicheSitzung(hub, function () { window.__fertig++; });
    return 1;
  })()`);
}

/** Taktet, bis der Hinweis steht — erst dann haelt die Szene wirklich. */
function bisZumHalt() {
  for (let i = 0; i < 600; i++) {
    if (Array.from(texte()).some((t) => /Taste druecken|Press any key/.test(t))) return true;
    H.step(1);
  }
  return false;
}

/** Alles, was gerade an Text in der Szene steht. */
const texte = () => H.run(`(function () {
  var hub = window.game.scene.getScene('HubSceneV2');
  var aus = [];
  (function s(o) {
    if (!o) return;
    if (o.type === 'Text' && o.text) aus.push(o.text);
    (o.list || []).forEach(s);
  })({ list: hub.children.list });
  return aus;
})()`);

const laeuftNoch = () => Array.from(texte()).some((t) => /Ratssaal|council hall|KLERUS|CLERGY/.test(t));

/** Wie oft steht die Schlussfrage der Sitzung im Bild? */
const auswahlZahl = () => H.run(`(function () {
  var hub = window.game.scene.getScene('HubSceneV2');
  var kurz = String(window.storyDialog.byScene.oeffentliche_sitzung.prompt).slice(0, 24);
  var n = 0;
  (function s(o) {
    if (!o) return;
    if (o.type === 'Text' && o.text && o.text.indexOf(kurz) >= 0) n++;
    (o.list || []).forEach(s);
  })({ list: hub.children.list });
  return n;
})()`);

test('Die Sitzung laeuft nicht von selbst weiter', () => {
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  assert.ok(laeuftNoch(), 'die Szene steht gar nicht');
  // Deutlich laenger als die alte Lesepause (900 ms = 54 Bilder). Lief sie
  // von selbst weiter, ist der Text hier laengst weg.
  H.step(600);                                  // 10 Sekunden
  assert.ok(laeuftNoch(), 'die Szene ist ohne Zutun weitergelaufen');
  assert.strictEqual(H.run('window.__fertig'), 0, 'sie hat sich selbst beendet');
});

test('Der Halt horcht auf Tastatur UND Zeiger', () => {
  // Die Bindung selbst laesst sich hier NICHT ausloesen: der Testkopf hat
  // keine Tastatur, und weder Phasers emit() noch ein echtes DOM-Ereignis
  // erreichen den Zuhoerer. Geprueft wird deshalb, DASS beide Wege gebunden
  // sind — dass ein echter Tastendruck weiterschaltet, ist im Browser
  // nachgesehen (b294).
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  assert.strictEqual(H.run(`window.game.scene.getScene('HubSceneV2').__szeneWartet.gebunden`), 2,
    'es ist nicht auf beiden Wegen gebunden');
});

test('Aufgeloest schaltet die Szene weiter', () => {
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  assert.ok(laeuftNoch(), 'die Szene steht gar nicht');
  H.run(`window.game.scene.getScene('HubSceneV2').__szeneWartet.ausloesen()`);
  H.step(10);
  assert.ok(!laeuftNoch(), 'der Text steht immer noch');
});

test('Ein Hinweis sagt, dass es am Spieler liegt', () => {
  // Ohne den Hinweis sieht ein stehender Text wie ein Haenger aus.
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  // Genau auf den Hinweis pruefen, nicht auf /Taste/i: der Hub zeigt
  // "PfeilTASTEn zum Bewegen", und darauf ist der erste Entwurf
  // hereingefallen — gruen, ohne etwas zu pruefen.
  const treffer = Array.from(texte()).filter((t) => /^(Taste druecken|Press any key)$/.test(t));
  assert.strictEqual(treffer.length, 1, 'kein eigener Hinweis: ' + Array.from(texte()).join(' | '));
});

test('Mehrfach ausloesen schaltet die Szene nur einmal weiter', () => {
  // Der Halt horcht auf Tastatur UND Zeiger. Feuern beide — Taste gehalten
  // und dabei geklickt — darf die Szene trotzdem genau einmal weiterlaufen,
  // sonst baut sich die Auswahl doppelt auf und ein Quest-Trigger zaehlt
  // zweimal.
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  const vorher = auswahlZahl();
  H.run(`(function () {
    var w = window.game.scene.getScene('HubSceneV2').__szeneWartet;
    w.ausloesen(); w.ausloesen(); w.ausloesen();
  })()`);
  H.step(20);
  // Die DIFFERENZ zaehlt, nicht der Absolutwert: die Tests davor lassen
  // ihre aufgeloesten Auswahlen stehen.
  assert.strictEqual(auswahlZahl() - vorher, 1,
    'die Auswahl kam ' + (auswahlZahl() - vorher) + '-mal dazu');
});

