// tests/hubTruheSchliessen.test.js — Die Hub-Truhe muss OHNE Tastatur zu
// schliessen sein (#134).
//
// Gemeldet: auf Mobile kam man aus der Truhe nur durch Neuladen der Seite
// heraus. Ursache war, dass oeffne() ausschliesslich Tastatur-Horcher anlegte:
//
//     if (scene.input.keyboard) {
//       scene.input.keyboard.on('keydown-E', schliesse);
//       scene.input.keyboard.on('keydown-ESC', schliesse);
//     }
//
// Zeiger-Horcher gab es zwar, aber nur fuers Ziehen. Der Hinweistext nannte
// obendrein genau die beiden Wege, die es auf dem Handy nicht gibt.
//
// Jetzt: ein sichtbares ✕ und ein Tipp neben das Panel. Beides laeuft hier
// gegen die ECHTE Szene, weil die Fallstricke (Zeigerdruck, Trefferflaeche,
// Aufraeumen) genau dort sitzen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
});
after(async () => { if (H) await H.shutdown(); });

/** Steht das ✕ noch in der Szene? Das ist der Beleg, dass die Truhe offen ist. */
const KREUZ_DA = `(function () {
  var sc = window.game.scene.getScene('HubSceneV2');
  var da = false;
  sc.children.list.forEach(function (o) {
    if (o.type === 'Text' && String(o.text) === '✕') da = true;
  });
  return da;
})()`;

function zu() { H.run("(function(){ try { window.HubTruheUI.schliesse(); } catch (e) {} })()"); }

test('Die Truhe hat einen sichtbaren Schliess-Knopf mit grosser Trefferflaeche', () => {
  zu();
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.oeffne(sc);
    var kreuz = null;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text) === '✕') kreuz = o;
    });
    if (!kreuz) return { fehler: 'kein Schliess-Knopf' };
    return {
      klickbar: !!kreuz.input,
      breite: kreuz.input ? Math.round(kreuz.input.hitArea.width) : 0,
      hoehe: kreuz.input ? Math.round(kreuz.input.hitArea.height) : 0,
      scrollFactor: kreuz.scrollFactorX
    };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.klickbar, true, 'der Knopf nimmt keine Zeiger an');
  // 20-px-Zeichen sind auf dem Handy zu klein; die Flaeche ist bewusst groesser.
  assert.ok(r.breite >= 40 && r.hoehe >= 34,
    'Trefferflaeche zu klein: ' + r.breite + 'x' + r.hoehe);
  assert.strictEqual(r.scrollFactor, 0,
    'ohne scrollFactor 0 wandert die Trefferflaeche mit der Hub-Kamera davon');
  zu();
});

test('Das Kreuz schliesst und raeumt sauber ab', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.oeffne(sc);
    var kreuz = null;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text) === '✕') kreuz = o;
    });
    if (!kreuz) return { fehler: 'kein Schliess-Knopf' };
    kreuz.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} });
    var noch = false;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text) === '✕') noch = true;
    });
    return { zu: !noch, offenFlagge: window.HubTruheUI.istOffen(),
      eventChoiceOpen: !!window.eventChoiceOpen };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.zu, true, 'das Panel steht noch');
  assert.strictEqual(r.offenFlagge, false, 'istOffen meldet weiter offen');
  assert.strictEqual(r.eventChoiceOpen, false,
    'eventChoiceOpen bleibt gesetzt — die Kampfeingabe waere dauerhaft stillgelegt');
});

test('Ein Tipp NEBEN das Panel schliesst', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.oeffne(sc);
    sc.input.emit('pointerdown', { x: 4, y: 4 });
    var noch = false;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text) === '✕') noch = true;
    });
    return { zu: !noch };
  })()`);
  assert.strictEqual(r.zu, true, 'ein Tipp daneben schliesst nicht');
});

test('Ein Tipp INS Panel schliesst nicht', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.oeffne(sc);
    var cam = sc.cameras.main;
    sc.input.emit('pointerdown', { x: cam.width / 2, y: cam.height / 2 });
    var noch = false;
    sc.children.list.forEach(function (o) {
      if (o.type === 'Text' && String(o.text) === '✕') noch = true;
    });
    return { offen: noch };
  })()`);
  assert.strictEqual(r.offen, true, 'ein Tipp mitten ins Panel hat geschlossen');
  zu();
});

test('Der oeffnende Zeigerdruck schliesst nicht sofort wieder', () => {
  // Der eigentliche Mobile-Fall: der [E]-Knopf oeffnet die Truhe IM
  // pointerdown. Waere das Schliessen sofort scharf, finge derselbe Druck sie
  // gleich wieder ein — die Truhe wuerde nur aufblitzen.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    sc.input.activePointer.isDown = true;          // Zeiger liegt noch auf
    window.HubTruheUI.oeffne(sc);
    var scharfBeimOeffnen = window.HubTruheUI._scharf();
    sc.input.emit('pointerdown', { x: 4, y: 4 });   // derselbe Druck
    var nachDruck = window.HubTruheUI.istOffen();
    sc.input.emit('pointerup', { x: 4, y: 4 });     // loslassen macht scharf
    var scharfNachLoslassen = window.HubTruheUI._scharf();
    sc.input.emit('pointerdown', { x: 4, y: 4 });   // der NAECHSTE Druck
    var nachZweitem = window.HubTruheUI.istOffen();
    sc.input.activePointer.isDown = false;
    return { scharfBeimOeffnen: scharfBeimOeffnen, nochOffen: nachDruck,
      scharfNachLoslassen: scharfNachLoslassen, danachZu: !nachZweitem };
  })()`);
  assert.strictEqual(r.scharfBeimOeffnen, false,
    'bei liegendem Zeiger darf das Schliessen nicht sofort scharf sein');
  assert.strictEqual(r.nochOffen, true,
    'der oeffnende Druck hat die Truhe gleich wieder geschlossen');
  assert.strictEqual(r.scharfNachLoslassen, true, 'Loslassen macht nicht scharf');
  assert.strictEqual(r.danachZu, true, 'der naechste Druck daneben schliesst nicht');
});

test('Ohne liegenden Zeiger ist es sofort scharf — sonst braeuchte die Taste E zwei Klicks', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    sc.input.activePointer.isDown = false;
    window.HubTruheUI.oeffne(sc);
    var s = window.HubTruheUI._scharf();
    window.HubTruheUI.schliesse();
    return s;
  })()`);
  assert.strictEqual(r, true);
});

test('Die Tastatur schliesst weiterhin — der Rechner bleibt unveraendert', () => {
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.HubTruheUI.oeffne(sc);
    sc.input.keyboard.emit('keydown-ESC');
    var nachEsc = window.HubTruheUI.istOffen();
    window.HubTruheUI.oeffne(sc);
    sc.input.keyboard.emit('keydown-E');
    var nachE = window.HubTruheUI.istOffen();
    return { escZu: !nachEsc, eZu: !nachE };
  })()`);
  assert.strictEqual(r.escZu, true, 'Esc schliesst nicht mehr');
  assert.strictEqual(r.eZu, true, 'E schliesst nicht mehr');
});

test('Der Hinweistext nennt auf Beruehrungsgeraeten keine Tasten', () => {
  // Der Testkopf ist kein Beruehrungsgeraet, also wird die Erkennung
  // umgestellt. Geprueft wird beides — sonst faende man nicht heraus, ob der
  // Text sich ueberhaupt aendert.
  const r = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var geraet = sc.sys.game.device.input;
    function textJetzt() {
      window.HubTruheUI.oeffne(sc);
      var t = null;
      sc.children.list.forEach(function (o) {
        if (o.type === 'Text' && String(o.text || '').indexOf('Ziehen zum Umlegen') === 0) t = String(o.text);
      });
      window.HubTruheUI.schliesse();
      return t;
    }
    var alt = geraet.touch;
    geraet.touch = false; var rechner = textJetzt();
    geraet.touch = true;  var handy = textJetzt();
    geraet.touch = alt;
    return { rechner: rechner, handy: handy };
  })()`);
  assert.ok(r.rechner && r.handy, 'Hinweistext nicht gefunden: ' + JSON.stringify(r));
  assert.ok(/Esc/.test(r.rechner), 'am Rechner soll die Taste weiterhin stehen: ' + r.rechner);
  assert.ok(!/Esc/.test(r.handy) && !/\bE oder\b/.test(r.handy),
    'auf dem Handy stehen weiterhin Tasten im Hinweis: ' + r.handy);
  assert.ok(r.handy.indexOf('✕') >= 0,
    'der Hinweis auf dem Handy nennt den Schliess-Knopf nicht: ' + r.handy);
});
