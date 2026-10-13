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
  // #166: die Sitzung spielt auf der gemalten Buehne; ihre Bilder laden
  // asynchron. Einmal vorladen, dann startet sie sofort.
  H.run("window.__buehne = false; window.SitzungsBuehne.laden(window.game.scene.getScene('HubSceneV2'), function () { window.__buehne = true; })");
  assert.ok(await H.settle(() => H.run('window.__buehne'), { maxRounds: 200 }), 'die Bilder der Sitzungsbuehne laden nicht');
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.flags = {}; st.quests = {};
    qs.loadQuestSaveData(st);
    window.__fertig = 0;
    return 1;
  })()`);
  // Eine Szene, die noch haelt, stammt aus dem Test davor (der loest sie
  // absichtlich NIE auf). Sie muss weg, sonst startet die naechste
  // Sitzung darueber und beide Texte stehen gleichzeitig im Bild. Seit #166
  // hat die Sitzung mehrere Seiten: bis zum Ende durchwinken, solange noch
  // ein Szenentext (Tiefe 1550) steht — am Text selbst laesst es sich nicht
  // ablesen, der ist zu Beginn des Aufbaus leer.
  for (let i = 0; i < 3000; i++) {
    const offen = H.run(`(function () {
      var hub = window.game.scene.getScene('HubSceneV2');
      if (hub.__szeneWartet) { var w = hub.__szeneWartet; hub.__szeneWartet = null; try { w.ausloesen(); } catch (e) {} }
      return hub.children.list.some(function (o) { return o.type === 'Text' && o.depth === 1550 && o.active; });
    })()`);
    if (!offen) break;
    H.step(2);
  }
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
    if (Array.from(texte()).some((t) => /Taste drücken|Press any key/.test(t))) return true;
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

// Irgendeine Seite der Sitzung im Bild (seit #166 hat jede nur einen Sprecher).
const laeuftNoch = () => Array.from(texte()).some((t) =>
  /Ratssaal|council hall|^(MAGISTRAT|KLERUS|GARDE|MAGISTRATE|CLERGY|GUARD):|Bürger rufen|citizens shout|ganz oben hing|very top/.test(t));

/** Wie oft steht die Schlussfrage der Sitzung im Bild? */
const auswahlZahl = () => H.run(`(function () {
  var hub = window.game.scene.getScene('HubSceneV2');
  // Nur die Rede zaehlen: der Sprecher steht im Messing-Panel als eigene Zeile.
  var kurz = window.DialogChoice.sprecherTeilen(window.storyDialog.byScene.oeffentliche_sitzung.prompt).rede.slice(0, 24);
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
  // Geprueft wird hier, DASS beide Wege gebunden sind. Dass ein keydown auf
  // Phasers Tastatur (keyboard.emit('keydown')) wirklich Seite fuer Seite
  // weiterschaltet, misst tests/sitzungsBuehne.test.js (#166).
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  assert.strictEqual(H.run(`window.game.scene.getScene('HubSceneV2').__szeneWartet.gebunden`), 2,
    'es ist nicht auf beiden Wegen gebunden');
});

/** Von Seite `ab` (1-basiert) bis zur letzten weiterwinken (ein Sprecher pro Seite, #166). */
function bisZurLetztenSeite(ab) {
  const zahl = H.run(`window.storyScenes.sitzungSeiten('oeffentlich').length`);
  for (let n = ab; n < zahl; n++) {
    H.run(`window.game.scene.getScene('HubSceneV2').__szeneWartet.ausloesen()`);
    H.step(2);
    assert.ok(bisZumHalt(), 'Seite ' + (n + 1) + ' kam nie zum Halten');
  }
}

test('Aufgeloest schaltet die Szene eine Seite weiter, nach der letzten ist sie fort', () => {
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  assert.ok(Array.from(texte()).some((t) => /Ratssaal ist voll/.test(t)), 'die erste Seite steht nicht');
  H.run(`window.game.scene.getScene('HubSceneV2').__szeneWartet.ausloesen()`);
  H.step(10);
  assert.ok(!Array.from(texte()).some((t) => /Ratssaal ist voll/.test(t)), 'die erste Seite steht immer noch');
  assert.ok(bisZumHalt(), 'die zweite Seite kam nie zum Halten');
  assert.ok(Array.from(texte()).some((t) => /^KLERUS:/.test(t)), 'die zweite Seite ist nicht der Klerus');
  bisZurLetztenSeite(2);
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
  const treffer = Array.from(texte()).filter((t) => /^(Taste drücken|Press any key)$/.test(t));
  assert.strictEqual(treffer.length, 1, 'kein eigener Hinweis: ' + Array.from(texte()).join(' | '));
});

test('Mehrfach ausloesen schaltet die Szene nur einmal weiter', () => {
  // Der Halt horcht auf Tastatur UND Zeiger. Feuern beide — Taste gehalten
  // und dabei geklickt — darf die Szene trotzdem genau einmal weiterlaufen,
  // sonst baut sich die Auswahl doppelt auf und ein Quest-Trigger zaehlt
  // zweimal.
  sitzungStarten();
  assert.ok(bisZumHalt(), 'die Szene kam nie zum Halten');
  // Auch zwischen den Seiten: dreimal ausloesen ueberspringt keine Seite.
  H.run(`(function () {
    var w = window.game.scene.getScene('HubSceneV2').__szeneWartet;
    w.ausloesen(); w.ausloesen(); w.ausloesen();
  })()`);
  H.step(10);
  assert.ok(Array.from(texte()).some((t) => /^KLERUS:/.test(t)), 'nach dreimal ausloesen nicht auf Seite 2');
  assert.ok(bisZumHalt(), 'die zweite Seite kam nie zum Halten');
  bisZurLetztenSeite(2);
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

