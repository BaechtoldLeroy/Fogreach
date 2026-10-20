// tests/finaleBlasen.test.js — Sprechblasen statt Messing im Finale (b498).
//
// Gewuenscht: "Die Endszene bei der Esse soll nicht so grosse Toasts aus
// Messing haben. Wie waers mit Sprechblasen ueber den Charakteren?"
// Geprueft am laufenden Spiel, mit den echten Seiten aus finale.js:
//   * gesprochene Zeilen stehen als Blase ueber der Figur, die spricht (Elara,
//     Harren, Mara), folgen ihr und bleiben im Bild
//   * Erzaehlung (in Klammern) steht als schmale Zeile unten
//   * keine Messing-Platte, kein Messing-Toast im Finale
//   * erste Taste zeigt den Satz ganz, die naechste blaettert, gehaltene Taste
//     blaettert nicht; die Spieluhr steht
//   * das Urteil: kleine Knoepfe, Tasten 1/2 oder Tippen, Leertaste waehlt nie;
//     dieselben Flaggen wie vorher
// Die Szene selbst (Reihenfolge, Flaggen, Handwerk) steht in finaleQuelle.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');
const FB = require('../js/finaleBlasen.js');

const GSC = "window.game.scene.getScene('GameScene')";
const FINALE_AKTIV = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };

describe('Zerlegen in Blasen und Zeilen (rein)', () => {
  test('Erzaehlung in Klammern wird Zeile, Sprecher wird Blase', () => {
    const s = FB.schritte('(Die Esse. Davor: Elara.)\n\nELARA: Du bist da. Ich wusste es.');
    assert.deepStrictEqual(s.map((x) => x.art + ':' + x.sprecher), ['zeile:', 'blase:ELARA']);
    assert.strictEqual(s[1].text, 'Du bist da. Ich wusste es.');
  });
  test('Harren ruft zwischen zwei Erzaehlungen', () => {
    const s = FB.schritte('(Schritte hinter Dir.)\n\nHARREN: Lene.\n\n(Sie zögert.)');
    assert.deepStrictEqual(s.map((x) => x.art + ':' + x.sprecher + ':' + x.text),
      ['zeile::(Schritte hinter Dir.)', 'blase:HARREN:Lene.', 'zeile::(Sie zögert.)']);
  });
  test('Ein Absatz ohne Sprecher, der nicht ganz in Klammern steht, gehoert dem letzten Sprecher', () => {
    const s = FB.schritte('ELARA: Du hast mir nie ganz getraut.\n\n(Sie sieht auf ihren Ring.) Du hast es erkannt.');
    assert.deepStrictEqual(s.map((x) => x.art + ':' + x.sprecher), ['blase:ELARA', 'blase:ELARA']);
  });
  test('Ohne Sprecher auf der Seite bleibt alles Erzaehlung', () => {
    const s = FB.schritte('Du lässt die Klinge sinken. Sie wird leben.');
    assert.deepStrictEqual(s.map((x) => x.art), ['zeile']);
    assert.strictEqual(FB.nurKlammer('(A.) B.'), false);
    assert.strictEqual(FB.nurKlammer('(A (b) c.)'), true);
    assert.strictEqual(FB.anzeigeName('ELARA'), 'Elara');
  });
});

/** Was die offene Seite gerade zeigt. */
function blase(H) {
  return H.run(`(function () { var sc = ${GSC}, d = sc.__finaleBlase; if (!d) return null;
    var s = d.aktuell(), l = d.lage();
    return { text: d.text, schritt: d.schritt(), anzahl: d.schritte.length, art: d.art(), sprecher: s && s.sprecher,
      arten: d.schritte.map(function (x) { return x.art; }), laeuft: d.laeuft(),
      lage: l ? { x: l.x, y: l.y, w: l.w, h: l.h, seite: l.seite || null, spitze: l.spitze || null } : null,
      knoepfe: d.knoepfe.map(function (k) { var b = k.getBounds(); return { label: k._label.text, x: b.centerX, y: b.centerY, h: b.height }; }) }; })()`);
}
/** Wo die Figur auf dem Schirm steht (Mitte, Oberkante). */
function figurAmSchirm(H, name) {
  return H.run(`(function () { var sc = ${GSC}, f = sc.children.getByName('${name}'); if (!f) return null;
    var k = sc.cameras.main, b = f.getBounds();
    return { x: b.centerX - k.scrollX, oben: b.top - k.scrollY, unten: b.bottom - k.scrollY, l: b.left - k.scrollX, r: b.right - k.scrollX }; })()`);
}
const kam = (H) => H.run(`(function () { var k = ${GSC}.cameras.main; return { w: k.width, h: k.height }; })()`);
const taste = (H, name, gehalten) => { H.run(`${GSC}.input.keyboard.emit('keydown-${name}', { repeat: ${!!gehalten} })`); H.step(1); };
/** Oberstes interaktives Objekt an (x, y), so wie ein echter Tap es trifft. */
function getippt(H, x, y) {
  H.step(2);   // neue Trefferflaechen nimmt Phaser erst im naechsten Bild auf
  return H.run(`(function () { var s = ${GSC}, p = s.input.activePointer; p.position.x = ${x}; p.position.y = ${y};
    var o = s.input.sortGameObjects(s.input.hitTestPointer(p), p)[0]; return o ? (o.name || o.type) : null; })()`);
}
/** Messing: Platte/Knoepfe des Ereignis-Dialogs im Bild, Toasts aus dem Finale (seit dem Start gezaehlt). */
function messing(H) {
  return H.run(`(function () { var sc = ${GSC};
    return sc.children.list.filter(function (o) {
      return o.active && o.visible && ((o.type === 'Image' && o.texture && o.texture.key === 'ui_rahmen')
        || (o.type === 'Rectangle' && o.depth === 2502));
    }).length + 100 * window.__finaleToasts.length; })()`);
}
/** Zaehlt Messing-Toasts aus finale.js ('finale') und elaraKampf.js ('elara_besessen'). */
function toastsZaehlen(H) {
  H.run(`(function () { window.__finaleToasts = [];
    var echt = window.EventSystem.showEventToast;
    window.EventSystem.showEventToast = function (s, text, art) {
      if (art === 'finale' || art === 'elara_besessen') window.__finaleToasts.push(text);
      return echt.apply(this, arguments);
    }; })()`);
}
/** Spieler (und Kamera) vor die Esse, damit Elara im Bild steht. */
function vorDieEsse(H) {
  H.run(`(function () { var sc = ${GSC}, o = window.FinaleHandwerk.ort(sc);
    player.setPosition(o.x, o.y + 150); player.body.reset(player.x, player.y); })()`);
  H.step(40);
}
const pause = (H) => H.run('!!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)');
const flag = (H, n) => H.run(`window.questSystem.hasFlag('${n}')`);
function warteAufSeite(H, re) {
  for (let i = 0; i < 1500; i++) {
    const b = blase(H);
    if (b && (!re || re.test(b.text))) return b;
    H.step(2);
  }
  return null;
}
function stand(H, flags) {
  H.run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(FINALE_AKTIV)}; st.flags = ${JSON.stringify(flags || {})}; qs.loadQuestSaveData(st); })()`);
}
/**
 * Die Spitze zeigt auf die Figur (ueber ihr: auf den Scheitel, daneben: auf
 * Kopfhoehe an ihren Rand), und die Blase verdeckt ihren Kopf nicht.
 */
function zeigtAuf(b, f, tol) {
  const s = b.lage.spitze, l = b.lage;
  const spitze = l.seite === 'oben' ? Math.abs(s.x - f.x) <= tol && Math.abs(s.y - f.oben) <= tol
    : (l.seite === 'rechts' || l.seite === 'links') && s.x >= f.l - tol && s.x <= f.r + tol && s.y >= f.oben - tol && s.y <= f.oben + 30;
  const kopf = { x: f.x, y: f.oben + 6 };
  const deckt = kopf.x > l.x && kopf.x < l.x + l.w && kopf.y > l.y && kopf.y < l.y + l.h;
  return spitze && !deckt;
}
function imBild(b, k) {
  return b.lage.x >= 0 && b.lage.y >= 0 && b.lage.x + b.lage.w <= k.w && b.lage.y + b.lage.h <= k.h;
}

describe('Vor dem Kampf', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' });
    H.run('window._playerInvincible = true');
    toastsZaehlen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Empfang: Erzaehlzeile unten, dann Elaras Blase ueber ihr; kein Messing, Uhr steht, Tasten wie im Dialog', () => {
    stand(H, {});
    vorDieEsse(H);
    H.lab.spawnBoss();
    H.step(2);
    const k = kam(H);
    let b = blase(H);
    assert.ok(b && /löse die Bindung/.test(b.text), 'die Szene an der Esse startet nicht: ' + JSON.stringify(b));
    assert.deepStrictEqual(Array.from(b.arten), ['zeile', 'blase']);
    assert.strictEqual(messing(H), 0, 'Messing-Platte oder -Toast im Finale');
    assert.strictEqual(pause(H), true, 'die Spieluhr laeuft waehrend der Szene');
    assert.strictEqual(H.run('!!window.eventChoiceOpen'), true, 'Angriffe gehen durch die Szene');
    // Erzaehlung: schmal, unten, mittig, ueber der Faehigkeitsleiste.
    assert.strictEqual(b.art, 'zeile');
    assert.ok(b.lage.y > k.h / 2 && b.lage.y + b.lage.h <= k.h - FB.UNTEN + 1, 'die Zeile steht nicht unten: ' + JSON.stringify(b.lage));
    assert.ok(Math.abs(b.lage.x + b.lage.w / 2 - k.w / 2) <= 1, 'die Zeile steht nicht mittig');
    assert.ok(b.lage.h <= 70, 'die Zeile ist kein schmaler Untertitel: ' + b.lage.h);
    // Erste Taste: der Satz steht ganz da, es wird nicht geblaettert.
    assert.strictEqual(b.laeuft, true, 'der Text baut sich nicht auf (Test misst nichts)');
    taste(H, 'SPACE');
    b = blase(H);
    assert.strictEqual(b.schritt, 0, 'die erste Taste blaettert schon');
    assert.strictEqual(b.laeuft, false, 'die erste Taste zeigt den Satz nicht ganz');
    // Gehaltene Taste blaettert nicht.
    taste(H, 'SPACE', true);
    assert.strictEqual(blase(H).schritt, 0, 'die gehaltene Taste blaettert');
    taste(H, 'SPACE');
    H.step(1);
    b = blase(H);
    assert.strictEqual(b.schritt, 1);
    assert.strictEqual(b.art, 'blase', 'Elara spricht nicht aus einer Blase');
    assert.strictEqual(b.sprecher, 'ELARA');
    const f = figurAmSchirm(H, 'finaleElara');
    assert.ok(f, 'keine Elara an der Esse');
    assert.ok(zeigtAuf(b, f, 3), 'die Blase zeigt nicht auf Elara: ' + JSON.stringify({ lage: b.lage, figur: f }));
    assert.ok(imBild(b, k), 'die Blase ragt aus dem Bild');
    assert.ok(b.lage.w <= 270, 'die Blase ist zu breit: ' + b.lage.w);
    assert.strictEqual(messing(H), 0);
  });

  test('Die Blase folgt der Figur und bleibt am Rand im Bild', () => {
    const k = kam(H);
    const vorher = blase(H);
    H.run(`${GSC}.children.getByName('finaleElara').x -= 40`);
    H.step(1);
    let b = blase(H);
    assert.ok(Math.abs(b.lage.spitze.x - (vorher.lage.spitze.x - 40)) <= 1, 'die Blase folgt Elara nicht: ' + JSON.stringify([vorher.lage, b.lage]));
    // Weit rechts aus dem Bild: die Blase klemmt am Rand, die Spitze zeigt in ihre Richtung.
    H.run(`(function () { var sc = ${GSC}, f = sc.children.getByName('finaleElara'); f.__altX = f.x + 40; f.x = sc.cameras.main.scrollX + sc.cameras.main.width + 300; })()`);
    H.step(1);
    b = blase(H);
    assert.ok(imBild(b, k), 'die Blase verlaesst das Bild: ' + JSON.stringify(b.lage));
    assert.ok(b.lage.x + b.lage.w >= k.w - 8, 'die Blase klemmt nicht am rechten Rand: ' + JSON.stringify(b.lage));
    assert.ok(b.lage.spitze.x >= b.lage.x + b.lage.w - 5, 'die Spitze zeigt nicht nach rechts');
    H.run(`(function () { var f = ${GSC}.children.getByName('finaleElara'); f.x = f.__altX; })()`);
    H.step(1);
    // Bestaetigen: die Seite schliesst, die Uhr laeuft wieder (der erhobene Hammer).
    taste(H, 'SPACE'); taste(H, 'SPACE');
    H.step(2);
    assert.strictEqual(blase(H), null, 'die Seite schliesst nicht');
    assert.strictEqual(pause(H), false, 'die Spieluhr bleibt stehen');
    assert.strictEqual(H.run('!!window.eventChoiceOpen'), false);
    // Der Hinweis zum Hammer ist eine schmale Zeile, kein Messing-Toast.
    const hw = H.run(`(function () { var h = ${GSC}.__finaleHinweis; return h ? { text: h.text, y: h.lage.y, h: h.lage.h } : null; })()`);
    assert.ok(hw && /Geh zur Esse/.test(hw.text), 'kein Hinweis zum Hammer: ' + JSON.stringify(hw));
    assert.strictEqual(messing(H), 0, 'der Hinweis kommt als Messing-Toast');
    H.run(`(function () { var sc = ${GSC}; if (sc.__finaleHammer) { sc.__finaleHammer.abbrechen(); sc.__finaleHammer = null; } })()`);
  });

  test('Fehlt die Figur, spricht sie aus einer Zeile unten (mit Namen)', () => {
    H.run(`window.FinaleBlasen.zeigen(${GSC}, 'MARA: Hier bin ich.', [{ label: 'Weiter', callback: function () {} }], { figur: function () { return null; } })`);
    H.step(1);
    const b = blase(H);
    assert.strictEqual(b.art, 'zeile');
    assert.strictEqual(H.run(`${GSC}.__finaleBlase.lage().y`) > kam(H).h / 2, true);
    const text = H.run(`(function () { var t = ${GSC}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === window.FinaleBlasen.TIEFE + 2; })[0]; return t ? t.text : ''; })()`);
    taste(H, 'SPACE');
    const voll = H.run(`(function () { var t = ${GSC}.children.list.filter(function (o) { return o.type === 'Text' && o.depth === window.FinaleBlasen.TIEFE + 2; })[0]; return t ? t.text : ''; })()`);
    assert.ok(/^Mara: Hier bin ich\.$/.test(voll), 'der Name fehlt: ' + JSON.stringify([text, voll]));
    taste(H, 'SPACE');
    assert.strictEqual(blase(H), null);
  });

  test('Steht die Figur am oberen Rand, steht die Blase neben ihr auf Kopfhoehe (nicht ueber dem Kopf, nicht an den Fuessen)', () => {
    H.run(`(function () { var sc = ${GSC}, k = sc.cameras.main;
      var f = sc.add.image(k.scrollX + 300, k.scrollY + 40, 'elara_right0').setDepth(85).setName('testRandFigur');
      f.setScale(64 / (f.height || 60));
      window.FinaleBlasen.zeigen(sc, 'ELARA: Hier oben ist kein Platz fuer eine Blase, also stehe ich daneben und rede trotzdem weiter.',
        [{ label: 'Weiter', callback: function () {} }], { figur: function () { return f; } }); })()`);
    H.step(1);
    const b = blase(H);
    const f = figurAmSchirm(H, 'testRandFigur');
    assert.ok(f.oben < b.lage.h, 'die Figur steht nicht am Rand (Test misst nichts)');
    assert.ok(b.lage.seite === 'rechts' || b.lage.seite === 'links', 'die Blase steht nicht neben ihr: ' + b.lage.seite);
    assert.ok(zeigtAuf(b, f, 3), 'die Blase zeigt nicht auf ihren Kopf: ' + JSON.stringify({ lage: b.lage, figur: f }));
    assert.ok(imBild(b, kam(H)));
    H.run(`(function () { var sc = ${GSC}; sc.__finaleBlase.zu(); sc.children.getByName('testRandFigur').destroy(); })()`);
  });

  test('Im Kampf an der Esse: die Hinweise sind schmale Zeilen, keine Messing-Toasts', () => {
    H.lab.clearEnemies();
    stand(H, { harren_dead: true, zeichen_bemerkt: true });
    H.lab.spawnBoss();
    H.step(4);
    assert.strictEqual(H.run(`!!enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]._elaraKampf`), true, 'der Kampf beginnt nicht');
    // Das Zeichen zeigt sich eine halbe Sekunde nach Kampfbeginn.
    const hinweis = () => H.run(`(function () { var h = ${GSC}.__finaleHinweis; return h ? h.text : null; })()`);
    let hw = hinweis();
    for (let i = 0; i < 300 && !/Zeichen/.test(hw || ''); i++) { H.step(1); hw = hinweis(); }
    assert.ok(/Du kennst das Zeichen/.test(hw || ''), 'der Hinweis zum Zeichen fehlt: ' + hw);
    assert.strictEqual(messing(H), 0, 'der Kampf meldet sich mit Messing-Toasts');
    H.lab.clearEnemies();
  });
});

describe('Harren und der Stoss (?finale=harren)', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=harren' });
    H.run('window._playerInvincible = true');
    toastsZaehlen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Harren ruft aus einer Blase ueber ihm, Elara antwortet ueber ihr; "Kämpfen" ist ein kleiner Knopf', () => {
    const k = kam(H);
    vorDieEsse(H);
    // Blaettern, bis die Seite mit Harren offen ist.
    let b = null;
    for (let i = 0; i < 12; i++) {
      b = warteAufSeite(H);
      if (b && /HARREN: Lene/.test(b.text)) break;
      H.lab.blaseTippen(0);
    }
    assert.ok(b && /HARREN: Lene/.test(b.text), 'Harren kommt nicht');
    assert.deepStrictEqual(Array.from(b.arten), ['zeile', 'blase', 'zeile']);
    // Waehrend der Seite steht sein kurzer Ruf nicht doppelt da.
    assert.strictEqual(H.run(`!!${GSC}.children.getByName('finaleKurzBlase')`), false, 'der kurze Ruf steht neben der Seite');
    taste(H, 'SPACE'); taste(H, 'SPACE');
    b = blase(H);
    assert.strictEqual(b.schritt, 1);
    assert.strictEqual(b.sprecher, 'HARREN');
    const f = figurAmSchirm(H, 'finaleHarren');
    assert.ok(zeigtAuf(b, f, 3),
      'die Blase zeigt nicht auf Harren: ' + JSON.stringify({ lage: b.lage, figur: f }));
    // Weiter bis "Die Esse braucht keinen Vater": Elaras Blase ueber Elara.
    H.lab.blaseTippen(0);
    b = warteAufSeite(H, /keinen Vater/);
    assert.ok(b, 'der Stoss fehlt');
    taste(H, 'SPACE'); taste(H, 'SPACE');
    b = blase(H);
    assert.strictEqual(b.sprecher, 'ELARA');
    const e = figurAmSchirm(H, 'finaleElara');
    assert.ok(zeigtAuf(b, e, 3), 'die Blase zeigt nicht auf Elara: ' + JSON.stringify({ lage: b.lage, figur: e }));
    // Bis "Kämpfen".
    for (let i = 0; i < 6; i++) {
      H.lab.blaseTippen(0);
      b = warteAufSeite(H);
      if (b && b.knoepfe.length) break;
      for (let j = 0; j < 30 && b && b.schritt < b.anzahl - 1; j++) { taste(H, 'SPACE'); b = blase(H); }
      if (b && b.knoepfe.length) break;
    }
    assert.ok(b && b.knoepfe.length === 1 && b.knoepfe[0].label === 'Kämpfen', 'kein Knopf "Kämpfen": ' + JSON.stringify(b && b.knoepfe));
    assert.ok(b.knoepfe[0].h <= 44, 'der Knopf ist keine kleine Wahl: ' + b.knoepfe[0].h);
    assert.strictEqual(messing(H), 0);
    // Echter Tap auf den Knopf (fest am Schirm, auch bei verschobener Kamera).
    assert.strictEqual(getippt(H, b.knoepfe[0].x, b.knoepfe[0].y), 'finaleBlaseKnopf', 'der Tap trifft den Knopf nicht');
    H.run(`(function () { var d = ${GSC}.__finaleBlase; d.knoepfe[0].emit('pointerdown'); })()`);
    H.step(4);
    assert.strictEqual(blase(H), null);
    assert.strictEqual(H.run(`!!enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]._elaraKampf`), true, 'der Kampf beginnt nicht');
  });
});

describe('Das Urteil', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle' });
    H.run('window._playerInvincible = true');
    toastsZaehlen(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  /** Elara besiegen, letzter Schlag, bis Mara das Urteil verlangt. */
  function bisZumUrteil() {
    H.run(`(function () { var sc = ${GSC};
      ['__finaleHammer', '__finaleLoesen'].forEach(function (k) { if (sc[k]) { sc[k].abbrechen(); sc[k] = null; } });
      if (sc.__finaleBlase) sc.__finaleBlase.zu(); sc.__finaleNachKampf = false; })()`);
    H.lab.clearEnemies();
    stand(H, { harren_dead: true, elara_trust: true });
    H.lab.spawnBoss();
    H.run(`(function () { var sc = ${GSC}; var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]; b.hp = 0; handleEnemyHit(sc, b, {}); })()`);
    let b = warteAufSeite(H);
    assert.ok(b, 'keine Szene nach dem Kampf');
    H.lab.blaseTippen(0);
    H.step(2);
    // Der Hinweis zum letzten Schlag: schmale Zeile statt Messing-Toast.
    const hw = H.run(`(function () { var h = ${GSC}.__finaleHinweis; return h ? h.text : null; })()`);
    assert.ok(/Nimm Deinen Hammer|Take your hammer/.test(hw || ''), 'kein Hinweis zum letzten Schlag: ' + hw);
    assert.strictEqual(messing(H), 0, 'der Hinweis kommt als Messing-Toast');
    H.run(`(function () { var h = ${GSC}.__finaleLoesen; player.setPosition(h.x, h.y + 20); player.body.reset(player.x, player.y); })()`);
    H.run(`${GSC}.input.keyboard.addKey('E', false).isDown = true`);
    for (let i = 0; i < 900 && !blase(H); i++) H.step(1);
    H.run(`${GSC}.input.keyboard.addKey('E', false).isDown = false`);
    for (let i = 0; i < 10; i++) {
      b = warteAufSeite(H);
      if (b && /MARA:/.test(b.text)) break;
      H.lab.blaseTippen(0);
    }
    return warteAufSeite(H, /MARA:/);
  }

  test('Mara spricht aus einer Blase ueber ihr, die Wahl sind zwei kleine Knoepfe; Leertaste waehlt nie, Taste 2 richtet', () => {
    let b = bisZumUrteil();
    assert.ok(b, 'Mara verlangt kein Urteil');
    assert.deepStrictEqual(Array.from(b.arten), ['blase', 'zeile']);
    assert.strictEqual(b.sprecher, 'MARA');
    assert.strictEqual(b.art, 'blase');
    const f = figurAmSchirm(H, 'finaleMara');
    assert.ok(f, 'Mara steht nicht als Figur da');
    assert.ok(zeigtAuf(b, f, 3), 'die Blase zeigt nicht auf Mara: ' + JSON.stringify({ lage: b.lage, figur: f }));
    assert.strictEqual(b.knoepfe.length, 0, 'die Wahl steht schon vor der letzten Zeile');
    taste(H, 'SPACE'); taste(H, 'SPACE');
    b = blase(H);
    assert.strictEqual(b.art, 'zeile');
    assert.deepStrictEqual(Array.from(b.knoepfe, (x) => x.label.replace(/^\d\s+/, '')), ['Verschonen', 'Richten']);
    const k = kam(H);
    for (const kn of b.knoepfe) {
      assert.ok(kn.y < b.lage.y && kn.y > k.h / 2, 'Knopf nicht unten ueber der Zeile: ' + JSON.stringify([kn, b.lage]));
      assert.ok(kn.h <= 44, 'Knopf zu gross: ' + kn.h);
    }
    // Leertaste/Enter/ESC zeigen den Satz, waehlen aber nie.
    for (const t of ['SPACE', 'ENTER', 'ESC', 'SPACE']) taste(H, t);
    assert.ok(blase(H), 'eine Taste hat das Urteil getroffen');
    assert.strictEqual(flag(H, 'elara_spared') || flag(H, 'elara_killed'), false);
    taste(H, 'TWO', true);
    assert.strictEqual(flag(H, 'elara_killed'), false, 'die gehaltene Taste waehlt');
    taste(H, 'TWO');
    assert.strictEqual(flag(H, 'elara_killed'), true, 'Taste 2 richtet nicht');
    assert.strictEqual(flag(H, 'elara_spared'), false);
    b = warteAufSeite(H);
    assert.ok(b && /Geschenk/.test(b.text) && b.art === 'zeile', 'die Folge des Richtens fehlt: ' + JSON.stringify(b));
    H.lab.blaseTippen(0);
    H.step(2);
    assert.strictEqual(blase(H), null);
    assert.strictEqual(pause(H), false);
  });

  test('Verschonen per Tap auf den Knopf (fest am Schirm)', () => {
    let b = bisZumUrteil();
    taste(H, 'SPACE'); taste(H, 'SPACE');
    b = blase(H);
    assert.strictEqual(b.knoepfe.length, 2);
    assert.strictEqual(getippt(H, b.knoepfe[0].x, b.knoepfe[0].y), 'finaleBlaseKnopf', 'der Tap trifft den Knopf nicht');
    H.run(`${GSC}.__finaleBlase.knoepfe[0].emit('pointerdown')`);
    H.step(1);
    assert.strictEqual(flag(H, 'elara_spared'), true);
    assert.strictEqual(flag(H, 'elara_killed'), false);
    H.lab.blaseTippen(0);
  });

  test('Englisch: dieselbe Szene, englische Zeilen und Knoepfe', () => {
    H.run("window.i18n.setLanguage('en')");
    try {
      let b = bisZumUrteil();
      assert.ok(b && /Judge her, Archivesmith/.test(b.text), JSON.stringify(b));
      taste(H, 'SPACE'); taste(H, 'SPACE');
      b = blase(H);
      assert.deepStrictEqual(Array.from(b.knoepfe, (x) => x.label.replace(/^\d\s+/, '')), ['Spare her', 'Judge her']);
      taste(H, 'ONE');
      assert.strictEqual(flag(H, 'elara_spared'), true);
      H.lab.blaseTippen(0);
    } finally { H.run("window.i18n.setLanguage('de')"); }
  });
});
