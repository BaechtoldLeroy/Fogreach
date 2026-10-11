// tests/kettenschlossMobil.test.js — Das Kettenschloss auf dem Handy.
//
// Gemeldet: "Kettenschloss funktioniert nicht auf Mobile." Setzen ging nur
// per Leertaste, Aufhoeren nur per E — auf dem Handy gibt es beides nicht.
// Man konnte den Dietrich ueber die Leiste ziehen, aber nichts damit tun; das
// Spiel hing bis zur Frist. Dazu fiel jeder Tipp durch die (nicht
// anfassbare) Abdunklung auf die Handy-Knoepfe darunter: wer neben die Leiste
// tippte, schlug zu, rollte oder setzte ein Laufziel.
//
// Getippt wird hier ueber die Beruehrungs-Eingabe von Phaser selbst
// (InputManager.onTouchStart/End), nicht per emit() auf ein Objekt — sonst
// waere gerade die Trefferpruefung (was liegt oben, was faengt den Tipp ab)
// gar nicht im Test.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launchDungeon({ depth: 10 });
  H.lab.clearEnemies();
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    // Die Handy-Steuerung aufbauen wie auf einem Beruehrungsgeraet.
    if (!window.attackBtn && typeof window.initMobileControls === 'function') window.initMobileControls(sc);
    window.__tippe = function (x, y, id) {
      var m = window.game.input;
      var t = { target: window.game.canvas, identifier: id || 7, pageX: x, pageY: y, clientX: x, clientY: y };
      var ev = { target: window.game.canvas, changedTouches: [t], touches: [t], timeStamp: Date.now(), preventDefault: function () {} };
      m.onTouchStart(ev);
      m.onTouchEnd({ target: window.game.canvas, changedTouches: [t], touches: [], timeStamp: Date.now(), preventDefault: function () {} });
    };
    window.__klick = function (x, y) {
      var m = window.game.input;
      var ev = { target: window.game.canvas, button: 0, buttons: 1, pageX: x, pageY: y, clientX: x, clientY: y, timeStamp: Date.now(), preventDefault: function () {} };
      m.onMouseDown(ev);
      ev.buttons = 0;
      m.onMouseUp(ev);
    };
    window.__mitte = function (o) { return { x: o.x, y: o.y }; };
    return 1;
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

// Startet ein Schloss mit dem Stift genau in der Mitte (Math.random fest
// auf 0,5 — fuer die GANZE Taktung, die Folgestifte wuerfeln spaeter).
function starte() {
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__randAlt = window.__randAlt || Math.random;
    Math.random = function () { return 0.5; };
    window.__erg = null;
    window.__griff = window.Kettenschloss.spiele(sc, 10, function (e) { window.__erg = e; });
    return 1;
  })()`);
  H.step(3);   // neue Trefferflaechen kommen erst im naechsten Takt dazu
}
function ende() {
  H.run(`(function () {
    if (window.__griff) window.__griff.abbrechen();
    if (window.__randAlt) { Math.random = window.__randAlt; window.__randAlt = null; }
    return 1;
  })()`);
  H.step(3);
}
const leisteBei = (anteil) => `window.__tippe(__griff.leiste.x + __griff.leiste.breite * ${anteil}, __griff.leiste.y)`;

test('Leiste antippen fuehrt den Dietrich, ein Knopf-Tipp nicht', () => {
  starte();
  try {
    H.run(leisteBei(0.2)); H.step(2);
    const nachLeiste = H.run('__griff.position()');
    assert.ok(Math.abs(nachLeiste - 0.2) < 0.01, 'Tipp auf die Leiste hat den Dietrich nicht bewegt: ' + nachLeiste);

    // Aufhoeren-Knopf liegt rechts unter der Leiste (x ~ 0,7 der Leiste).
    // Verschoebe ein Tipp darauf den Dietrich, stuende er danach dort.
    H.run('(function () { var m = __mitte(__griff.knoepfe.setzen); __tippe(m.x, m.y); return 1; })()');
    H.step(2);
    assert.ok(Math.abs(H.run('__griff.position()') - 0.2) < 0.01,
      'der Knopf-Tipp hat den Dietrich verschoben: ' + H.run('__griff.position()'));
  } finally { ende(); }
});

test('Knopf "Setzen" setzt bei Treffer und kostet bei Fehlgriff einen Dietrich', () => {
  starte();
  try {
    const tippSetzen = '(function () { var m = __mitte(__griff.knoepfe.setzen); __tippe(m.x, m.y); return 1; })()';
    H.run(leisteBei(0.5)); H.step(2);
    H.run(tippSetzen); H.step(12);
    let s = H.run('__griff.stand()');
    assert.strictEqual(s.gesetzt, 1, 'Treffer per Knopf hat keinen Stift gesetzt: ' + JSON.stringify(s));
    assert.strictEqual(s.dietriche, 4, 'Treffer hat einen Dietrich gekostet');

    H.run(leisteBei(0.05)); H.step(2);
    H.run(tippSetzen); H.step(12);
    s = H.run('__griff.stand()');
    assert.strictEqual(s.gesetzt, 1, 'Fehlgriff hat einen Stift gesetzt');
    assert.strictEqual(s.dietriche, 3, 'Fehlgriff per Knopf hat keinen Dietrich gekostet: ' + JSON.stringify(s));
  } finally { ende(); }
});

test('Ein Druck zaehlt einmal, auch wenn der Browser Maus nachschiebt', () => {
  // Manche Mobil-Browser liefern zum Tipp ein nachgeschobenes Mausereignis.
  // Beide im selben Augenblick duerfen nur EINEN Dietrich kosten.
  starte();
  try {
    H.run(leisteBei(0.05)); H.step(2);
    H.run('(function () { var m = __mitte(__griff.knoepfe.setzen); __tippe(m.x, m.y); __klick(m.x, m.y); return 1; })()');
    H.step(2);
    assert.strictEqual(H.run('__griff.stand()').dietriche, 3, 'ein Druck hat doppelt ausgeloest');
  } finally { ende(); }
});

test('Knopf "Aufhören" beendet mit dem bisherigen Ergebnis', () => {
  starte();
  try {
    H.run(leisteBei(0.5)); H.step(2);
    H.run('(function () { var m = __mitte(__griff.knoepfe.setzen); __tippe(m.x, m.y); return 1; })()');
    H.step(12);
    H.run('(function () { var m = __mitte(__griff.knoepfe.aufhoeren); __tippe(m.x, m.y); return 1; })()');
    H.step(2);
    const erg = H.run('JSON.stringify(window.__erg)');
    assert.ok(erg && erg !== 'null', 'Aufhoeren-Knopf hat das Spiel nicht beendet');
    const e = JSON.parse(erg);
    assert.strictEqual(e.gesetzt, 1);
    assert.strictEqual(e.geschafft, false);
    assert.strictEqual(e.verloren, false, 'Aufhoeren ist kein Verlust');
    assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'Kampfsperre bleibt nach dem Aufhoeren stehen');
  } finally { ende(); }
});

test('Handy-Knoepfe und Tippen-zum-Laufen sind waehrend des Schlosses still', () => {
  // Mitgezaehlt wird am Knopf selbst: sein pointerdown ist genau der Weg, auf
  // dem Angriff, Rolle und Faehigkeiten ausgeloest werden (mobileControls).
  // (Das Fenster-Ereignis demonfall:ability-tap taugt nicht: im Testkopf gibt
  // es kein CustomEvent, mobileControls schluckt den Fehler still.)
  const anzahlKnoepfe = H.run(`(function () {
    window.__abilityTaps = 0;
    var sc = window.game.scene.getScene('GameScene');
    window.__handyKnoepfe = sc.children.list.filter(function (o) {
      return o.type === 'Arc' && o.depth === 1200 && o.input && o.scene;
    });
    window.__handyKnoepfe.forEach(function (k) {
      if (!k.__gezaehlt) { k.__gezaehlt = true; k.on('pointerdown', function () { window.__abilityTaps++; }); }
    });
    return window.__handyKnoepfe.length;
  })()`);
  assert.ok(H.run('!!window.attackBtn') && anzahlKnoepfe >= 2, 'Handy-Knoepfe fehlen im Testaufbau: ' + anzahlKnoepfe);
  starte();
  try {
    H.run('window.__MOBILE_MOVE_TARGET__ = null');
    // Jeden Handy-Knopf antippen und eine freie Stelle links ueber der Leiste.
    H.run('__handyKnoepfe.forEach(function (k, i) { __tippe(k.x, k.y, 20 + i); }); 1');
    H.run('__tippe(40, __griff.leiste.y - 120)');
    H.step(2);
    assert.strictEqual(H.run('window.__abilityTaps'), 0, 'ein Handy-Faehigkeitsknopf hat durch das Schloss ausgeloest');
    assert.strictEqual(H.run('window.__MOBILE_MOVE_TARGET__'), null, 'Tippen-zum-Laufen hat ein Laufziel gesetzt');
    assert.strictEqual(H.run('__griff.stand().beendet'), false, 'das Schloss ist ungewollt zu');
  } finally { ende(); }
  // Gegenprobe: ohne Schloss erreicht derselbe Tipp den Knopf — sonst bewiese
  // die Null oben nichts.
  H.step(30);
  H.run('__tippe(window.attackBtn.x, window.attackBtn.y)');
  H.step(2);
  assert.ok(H.run('window.__abilityTaps') >= 1, 'der simulierte Tipp erreicht den Angriffsknopf gar nicht');
  H.step(60);
});

test('Nach dem Ende bleibt nichts zurueck: keine Elemente, keine Hoerer', () => {
  const zaehle = () => H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var kb = sc.input.keyboard;
    return {
      kinder: sc.children.list.length,
      down: sc.input.listenerCount('pointerdown'),
      move: sc.input.listenerCount('pointermove'),
      update: sc.events.listenerCount('update'),
      space: kb.listenerCount('keydown-SPACE'),
      e: kb.listenerCount('keydown-E'),
      links: kb.listenerCount('keydown-LEFT')
    };
  })()`);
  H.step(5);
  const vorher = zaehle();
  starte();
  const knoepfeDa = H.run('!!(__griff.knoepfe.setzen.scene && __griff.knoepfe.aufhoeren.scene)');
  assert.ok(knoepfeDa, 'Knoepfe fehlen');
  H.run('(function () { var m = __mitte(__griff.knoepfe.aufhoeren); __tippe(m.x, m.y); return 1; })()');
  H.step(3);
  const nachher = zaehle();
  ende();
  assert.strictEqual(H.run('!!(__griff.knoepfe.setzen.scene || __griff.knoepfe.aufhoeren.scene)'), false,
    'Knoepfe stehen nach dem Ende noch in der Szene');
  for (const k of Object.keys(vorher)) {
    assert.strictEqual(nachher[k], vorher[k], k + ': ' + vorher[k] + ' -> ' + nachher[k]);
  }
});

test('Am Rechner bleiben die Tasten und der Tasten-Hinweis, auf dem Handy nicht', () => {
  const hinweis = (touch) => {
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      var geraet = sc.sys.game.device.input;
      var alt = geraet.touch;
      geraet.touch = ${touch};
      window.__griff = window.Kettenschloss.spiele(sc, 10, function () {});
      geraet.touch = alt;
      var t = null;
      sc.children.list.forEach(function (o) {
        if (o.type === 'Text' && o.depth === 4000 && /·/.test(String(o.text)) && /Setzen|setzen/.test(String(o.text))) t = String(o.text);
      });
      var knoepfe = !!(__griff.knoepfe && __griff.knoepfe.setzen.visible && __griff.knoepfe.aufhoeren.visible);
      __griff.abbrechen();
      return { text: t, knoepfe: knoepfe };
    })()`);
    H.step(3);
    return r;
  };
  const rechner = hinweis(false);
  const handy = hinweis(true);
  assert.ok(rechner.text && /Leertaste/.test(rechner.text), 'am Rechner fehlt der Tasten-Hinweis: ' + rechner.text);
  assert.ok(handy.text && !/Leertaste|\bE\b/.test(handy.text), 'auf dem Handy nennt der Hinweis Tasten: ' + handy.text);
  assert.ok(/antippen/.test(handy.text), 'auf dem Handy fehlt der Tipp-Hinweis: ' + handy.text);
  assert.ok(rechner.knoepfe && handy.knoepfe, 'Knoepfe nicht auf beiden Geraeten sichtbar');

  // Die Tasten selbst: Leertaste setzt, E hoert auf.
  starte();
  try {
    H.run(`(function () { var kb = window.game.scene.getScene('GameScene').input.keyboard; kb.emit('keydown-SPACE'); return 1; })()`);
    H.step(2);
    assert.strictEqual(H.run('__griff.stand().gesetzt'), 1, 'Leertaste setzt nicht mehr');
    H.step(12);
    H.run(`(function () { var kb = window.game.scene.getScene('GameScene').input.keyboard; kb.emit('keydown-E'); return 1; })()`);
    H.step(2);
    assert.strictEqual(H.run('__griff.stand().beendet'), true, 'E hoert nicht mehr auf');
  } finally { ende(); }
});
