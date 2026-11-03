// tests/elaraSzene.test.js — Elaras ruhige Momente auf Tableaus (b503).
//
// Gemeldet: drei Story-Stellen sollen Bilder bekommen statt Text bzw.
// gezeichneter Formen. Geprueft am laufenden Dungeon:
//   - Hammer (Werkstatt-Besuch im Versteck, E bei Elara): ein Tableau, die
//     Flagge wie vorher, Wort fuer Wort, die Wahl nur per Klick, die Antwort
//     folgt, danach ist alles weg und die Uhr laeuft.
//   - Klinge (elara_blade annehmen): zwei Tableaus, die Gravur auf ihrem
//     eigenen Bild, ESC springt zur Wahl statt sie zu ueberspringen.
//   - Erster Riss (elara_second_truth annehmen): ein Tableau, die Wahl aus
//     storyDialog, der Auftrag schliesst danach ab wie bisher.
//   - Rueckblick in der Ratskammer: die gemalte Kammer und der gemalte
//     Kellerboden statt Rechtecken und Ellipsen, die Figuren stehen davor.
//   - Ohne das Modul bleibt die Textfassung.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
const GS = "window.game.scene.getScene('GameScene')";
const Z = `${GS}.__elaraSzene`;
const FERTIG = { status: 'completed', objectives: [] };

before(async () => { H = await launchDungeon({ depth: 5 }); });
after(async () => { if (H) await H.shutdown(); });

function bis(js, max) {
  for (let i = 0; i < (max || 400); i++) {
    if (H.run(js)) return true;
    H.step(3);
  }
  return !!H.run(js);
}

function stand(quests, flags, akt) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt || 1});
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
    var sc = ${GS};
    sc.children.list.filter(function (o) { return o.name === 'aktwechsel' || o.name === 'dialogChoiceContainer'; })
      .forEach(function (o) { o.destroy(); });
    window.eventChoiceOpen = false;
  })()`);
}

function taste(key) {
  H.run(`${GS}.input.keyboard.emit('keydown', { key: ${JSON.stringify(key)}, keyCode: ${key === 'Escape' ? 27 : 32}, repeat: false })`);
}
function zustand() {
  return H.run(`(function () { var z = ${Z}; if (!z) return null;
    return { id: z.id, phase: z.phase, schritt: z.schritt, bild: z.bild, text: z.text(), voll: z.voll,
      laeuft: z.laeuft(), sprecher: z.sprecher(), gezeigt: z.gezeigt.slice() }; })()`);
}
function zeileFertig() {
  const z = zustand();
  if (z && z.laeuft) taste(' ');
  H.step(2);
}
/** Blaettert bis zur Wahl (oder zum Ende). */
function bisZurWahl() {
  let n = 0;
  while (zustand() && zustand().phase === 'zeile' && n++ < 30) { zeileFertig(); taste(' '); }
}
function bilderDerSzene() {
  return Array.from(H.run(`(function () { var c = ${GS}.children.list.filter(function (o) { return o.name === 'elaraSzene'; })[0];
    return c ? c.list.filter(function (o) { return /^elaraSzeneBild_/.test(o.name); }).map(function (o) { return o.texture.key; }) : []; })()`));
}
/** Klickt in der offenen Auswahl die Antwort mit Index n. */
function waehle(n) {
  return H.run(`(function () { var sc = ${GS};
    var box = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0];
    if (!box) return 'keine Auswahl';
    if (box.depth <= 6000) return 'Auswahl unter der Szene: ' + box.depth;
    var wahl = window.ElaraSzene.schritte(sc.__elaraSzene.id).filter(function (s) { return s.wahl; })[0];
    var label = wahl.wahl.wahlen[${n}].label;
    var knoepfe = [];
    (function lauf(l) { l.forEach(function (o) { if (o.input && o.input.enabled) knoepfe.push(o); if (o.list) lauf(o.list); }); })(box.list);
    var k = knoepfe.filter(function (o) { return o.text === label; })[0];
    if (!k) return 'kein Knopf fuer ' + label;
    k.emit('pointerup', { x: 0, y: 0 }, 0, 0, { stopPropagation: function () {} });
    return 'ok';
  })()`);
}
function reste() {
  return H.run(`${GS}.children.list.filter(function (o) { return /^elaraSzene|dialogChoiceContainer/.test(o.name || ''); }).length`);
}

test('Hammer: E bei Elara im Versteck spielt das Tableau, Flagge wie vorher', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elaraMet: true, elara_versteck_gesehen: true }, 2);
  const r = H.run(`(function () {
    window.DUNGEON_DEPTH = 5; initDungeonRun();
    var sc = ${GS};
    var i = dungeonRun.templateOrder.indexOf('ElarasVersteck');
    if (i < 0) return { fehler: 'kein Versteck' };
    enterRoom(sc, i);
    return { besuch: sc._versteckBesuch };
  })()`);
  assert.strictEqual(r.besuch, 'werkstatt', JSON.stringify(r));
  assert.ok(bis(`${GS}.textures.exists('elaraszenen_hammer')`), 'das Tableau wird beim Betreten nicht geladen');
  H.step(10);
  const gedrueckt = H.run(`(function () { var sc = ${GS};
    var e = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0' && o.active; })[0];
    if (!e) return false;
    player.setPosition(e.x - 30, e.y);
    sc.input.keyboard.emit('keydown-E', { key: 'e', keyCode: 69 });
    return true; })()`);
  assert.ok(gedrueckt, 'Elara steht nicht im Versteck');
  assert.ok(bis(`!!${Z}`, 50), 'keine Zwischenszene nach dem Ansprechen');
  taste('e');     // derselbe Druck als allgemeines keydown: zaehlt nicht
  let z = zustand();
  assert.strictEqual(z.id, 'werkstatt');
  assert.strictEqual(z.laeuft, true, 'der ausloesende Druck hat die erste Zeile uebersprungen');
  assert.deepStrictEqual(bilderDerSzene(), ['elaraszenen_hammer']);
  assert.strictEqual(z.bild, 'hammer');
  assert.ok(/Hammer/.test(z.voll), 'erste Zeile: ' + z.voll);
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_camp_seen')`), true);
  assert.strictEqual(H.run(`${GS}.time.paused`), true, 'die Spieluhr laeuft waehrend der Szene');
  assert.strictEqual(H.run('window.eventChoiceOpen'), true, 'Angriffe nicht gesperrt');
  // Erste Taste zeigt die Zeile ganz, die zweite blaettert.
  H.step(30);
  z = zustand();
  assert.ok(z.text.length < z.voll.length, 'die Zeile stand schon ganz da');
  taste(' ');
  z = zustand();
  assert.strictEqual(z.schritt, 0, 'die erste Taste hat weitergeblaettert');
  assert.strictEqual(z.text, z.voll);
  taste(' ');
  z = zustand();
  assert.strictEqual(z.schritt, 1);
  assert.strictEqual(z.sprecher, 'ELARA');
  assert.ok(/aufgehoben/.test(z.voll), z.voll);
});

test('Hammer: die Wahl nimmt keine Tasten, ein Klick waehlt, die Antwort folgt, dann ist alles weg', () => {
  bisZurWahl();
  let z = zustand();
  assert.strictEqual(z.phase, 'wahl', 'keine Wahl');
  const vorher = z.schritt;
  [' ', 'Enter', '1', 'e'].forEach(taste);
  z = zustand();
  assert.strictEqual(z.phase, 'wahl', 'eine Taste hat gewaehlt');
  assert.strictEqual(z.schritt, vorher);
  assert.strictEqual(waehle(0), 'ok');
  H.step(2);
  z = zustand();
  assert.strictEqual(z.phase, 'zeile');
  assert.ok(/Handwerker/.test(z.voll), 'die Antwort fehlt: ' + z.voll);
  bisZurWahl();
  assert.strictEqual(zustand(), null, 'die Szene ist nicht zu');
  assert.strictEqual(reste(), 0, 'Reste der Szene liegen herum');
  assert.strictEqual(H.run(`${GS}.time.paused`), false, 'die Spieluhr steht noch');
  H.step(20);
  assert.strictEqual(H.run('window.eventChoiceOpen'), false, 'die Angriffssperre bleibt haengen');
  H.run(`window._versteckSzeneSpielen(${GS}, 'werkstatt')`);
  assert.strictEqual(zustand(), null, 'die Szene spielt ein zweites Mal');
});

test('Klinge: zwei Tableaus, die Gravur auf ihrem eigenen Bild, ESC springt zur Wahl', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, resistance_fetch_01: FERTIG,
          elara_meeting: FERTIG, elara_ritual: FERTIG }, { elaraMet: true }, 3);
  const r = H.run(`(function () {
    var sc = ${GS}, qs = window.questSystem;
    window.SlotStorage.setItem('demonfall_maxDepth', '20');
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'elara_blade'; })[0];
    if (!angebot) return 'nicht angeboten';
    _spawnElaraSprite(sc, { id: 'elara_blade', modus: 'angebot', quest: angebot });
    return 'ok';
  })()`);
  assert.strictEqual(r, 'ok');
  assert.ok(bis(`${GS}.textures.exists('elaraszenen_klinge') && ${GS}.textures.exists('elaraszenen_gravur')`),
    'die Tableaus der Klinge laden nicht, solange Elara wartet');
  H.run(`(function () { var sc = ${GS}, qs = window.questSystem;
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'elara_blade'; })[0];
    _elaraAuftragsDialog(sc, { id: 'elara_blade', modus: 'angebot', quest: angebot }, 'Weiter', false);
    var k = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
    if (k) k.emit('pointerdown');
  })()`);
  assert.ok(bis(`!!${Z}`, 50), 'keine Klingen-Szene nach dem Annehmen');
  assert.strictEqual(H.run(`window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'elara_blade'; })`), true);
  assert.strictEqual(H.run(`window.questSystem.hasFlag('elara_klinge_erhalten')`), true);
  assert.deepStrictEqual(bilderDerSzene(), ['elaraszenen_klinge', 'elaraszenen_gravur']);
  assert.strictEqual(zustand().bild, 'klinge');
  H.step(30);
  zeileFertig(); taste(' ');
  let z = zustand();
  assert.strictEqual(z.bild, 'gravur', 'die Gravur steht nicht auf ihrem Bild');
  assert.ok(/eingraviert/.test(z.voll), z.voll);
  taste('Escape');
  z = zustand();
  assert.ok(z, 'ESC hat die Szene samt Wahl beendet');
  assert.strictEqual(z.phase, 'wahl', 'ESC springt nicht zur Wahl');
  assert.strictEqual(z.bild, 'klinge');
  taste('Escape');
  assert.strictEqual(zustand().phase, 'wahl', 'ESC hat die Wahl uebersprungen');
  assert.strictEqual(waehle(1), 'ok');
  H.step(2);
  assert.ok(/beschützen/.test(zustand().voll), 'die Antwort fehlt: ' + zustand().voll);
  taste('Escape');
  assert.strictEqual(zustand(), null, 'nach der Wahl beendet ESC die Szene nicht');
  assert.strictEqual(reste(), 0);
  assert.strictEqual(H.run(`${GS}.time.paused`), false);
});

test('Erster Riss: ein Tableau, die Wahl aus storyDialog, danach schliesst der Auftrag ab', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, resistance_fetch_01: FERTIG,
          elara_meeting: FERTIG, elara_ritual: FERTIG, elara_blade: FERTIG, thom_truth: FERTIG }, { elaraMet: true }, 3);
  const r = H.run(`(function () { var sc = ${GS}, qs = window.questSystem;
    window.SlotStorage.setItem('demonfall_maxDepth', '20');
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'elara_second_truth'; })[0];
    if (!angebot) return 'nicht angeboten';
    _spawnElaraSprite(sc, { id: 'elara_second_truth', modus: 'angebot', quest: angebot });
    return 'ok'; })()`);
  assert.strictEqual(r, 'ok');
  assert.ok(bis(`${GS}.textures.exists('elaraszenen_riss')`), 'das Tableau des Risses laedt nicht');
  // Der Trigger selbst (im Keller schliesst der Auftrag ohnehin ab, im Hub
  // haengt er an diesem Trigger): mitschreiben, wann er kommt.
  H.run(`(function () { var qs = window.questSystem; window.__riss = 0;
    qs.__echtUpdate = qs.__echtUpdate || qs.updateQuestProgress;
    qs.updateQuestProgress = function (typ, ziel) { if (ziel === 'erster_riss_gesehen') window.__riss++; return qs.__echtUpdate.apply(qs, arguments); };
  })()`);
  H.run(`(function () { var sc = ${GS}, qs = window.questSystem;
    var angebot = qs.getAvailableQuests('elara').filter(function (q) { return q.id === 'elara_second_truth'; })[0];
    _elaraAuftragsDialog(sc, { id: 'elara_second_truth', modus: 'angebot', quest: angebot }, 'Weiter', false);
    var k = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
    if (k) k.emit('pointerdown');
  })()`);
  assert.ok(bis(`!!${Z}`, 50), 'keine Riss-Szene nach dem Annehmen');
  assert.deepStrictEqual(bilderDerSzene(), ['elaraszenen_riss']);
  assert.ok(/Bote/.test(zustand().voll), zustand().voll);
  H.step(30);
  bisZurWahl();
  assert.strictEqual(zustand().phase, 'wahl');
  assert.strictEqual(H.run(`window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'elara_second_truth'; })`), false,
    'der Auftrag schliesst schon vor dem Ende der Szene');
  assert.strictEqual(H.run('window.__riss'), 0, 'der Trigger kam vor dem Ende der Szene');
  assert.strictEqual(waehle(0), 'ok');
  H.step(2);
  const antwort = H.run('window.storyDialog.byScene.elara_first_crack.choices[0].response');
  assert.ok(antwort.indexOf(zustand().voll) >= 0, 'die Antwort aus storyDialog fehlt: ' + zustand().voll);
  bisZurWahl();
  assert.strictEqual(zustand(), null);
  assert.strictEqual(H.run('window.__riss'), 1, 'erster_riss_gesehen feuert nicht genau einmal am Ende');
  H.run(`(function () { var qs = window.questSystem; qs.updateQuestProgress = qs.__echtUpdate; })()`);
  assert.strictEqual(H.run(`window.questSystem.getCompletedQuests().some(function (q) { return q.id === 'elara_second_truth'; })`), true,
    'der Auftrag schliesst nicht ab');
});

test('Rueckblick: die gemalte Ratskammer und der gemalte Kellerboden, die Figuren davor', () => {
  stand({}, { rettung_inszeniert: true, elara_rettung_gesehen: true, elaraMet: true }, 3);
  H.run(`window.__rbFertig = false; window.RettungsSzene.rueckblick(${GS}, 'voll', function () { window.__rbFertig = true; }); 1`);
  const RB = `${GS}.__rueckblick`;
  assert.ok(bis(`${RB} && ${RB}.phase === 'jetzt'`), 'der Rueckblick baut sich nicht auf');
  const jetzt = H.run(`(function () { var sc = ${GS};
    var k = sc.children.list.filter(function (o) { return o.name === 'rueckblickKulisse_jetzt'; })[0];
    var figuren = sc.children.list.filter(function (o) { return o.texture && /^(aldric|elara|chainguard)_/.test(o.texture.key) && o.depth > (k ? k.depth : 0); });
    var ellipsen = ${RB}.teile.filter(function (o) { return o.type === 'Ellipse' && o.scene; }).length;
    var cam = sc.cameras.main, r = k ? k.getBounds() : null;
    // Zwischen den Balken (oben 10 %, unten 17 %) kein Spalt.
    var deckt = !!r && r.x <= 0 && r.right >= cam.width && r.y <= Math.round(cam.height * 0.1) && r.bottom >= cam.height - Math.round(cam.height * 0.17);
    // Die Figuren stehen auf dem Boden vor dem Tisch: unter 80 % der Bildhoehe.
    var fussImBild = k ? (Math.round(cam.height * 0.66) - r.y) / r.height : 0;
    return { key: k && k.texture.key, deckt: deckt, fussImBild: fussImBild,
      figuren: figuren.length, ellipsen: ellipsen, kulisse: ${RB}.kulisse };
  })()`);
  assert.strictEqual(jetzt.key, 'rueckblick_kammer', 'keine gemalte Ratskammer');
  assert.strictEqual(jetzt.deckt, true, 'die Kammer fuellt das Bild nicht');
  assert.ok(jetzt.fussImBild > 0.8, 'die Figuren stehen nicht vor dem Tisch: ' + jetzt.fussImBild);
  assert.strictEqual(jetzt.figuren, 3, 'Aldric, Elara und der Waechter stehen nicht vor der Kammer');
  assert.strictEqual(jetzt.ellipsen, 0, 'der gezeichnete Lichtschein liegt noch dort');
  assert.ok(bis(`${RB}.wartet()`), 'der Rueckblick wartet nicht');
  H.run(`${RB}.weiter(); 1`);
  assert.ok(bis(`${RB}.phase === 'rueckzug' && !!${RB}.wachen`), 'die Vergangenheit kommt nicht');
  const damals = H.run(`(function () { var r = ${RB};
    var box = r.wachen[0].parentContainer;
    var boden = box.list[0];
    return { key: boden.texture ? boden.texture.key : boden.type, unten: box.list.indexOf(boden),
      grafik: box.list.filter(function (o) { return o.type === 'Graphics' && o !== r.busch; }).length,
      wachen: r.wachen.length, kulisse: r.kulisseVergangenheit };
  })()`);
  assert.strictEqual(damals.key, 'rueckblick_keller', 'kein gemalter Kellerboden: ' + damals.key);
  assert.strictEqual(damals.unten, 0, 'der Boden liegt nicht unter den Figuren');
  assert.strictEqual(damals.grafik, 0, 'das gezeichnete Schachbrett liegt noch dort');
  assert.strictEqual(damals.wachen, 4);
  // Der Ablauf bleibt: bis zum Ende durchwinken.
  for (let i = 0; i < 12 && !H.run('window.__rbFertig'); i++) {
    bis(`!${RB} || ${RB}.wartet()`, 200);
    H.run(`${RB} && ${RB}.weiter(); 1`);
  }
  assert.ok(bis('window.__rbFertig', 200), 'der Rueckblick endet nicht');
});

test('Ohne das Modul bleibt die Textfassung', () => {
  stand({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG },
        { elaraMet: true, elara_versteck_gesehen: true }, 2);
  const text = H.run(`(function () { var sc = ${GS};
    var ES = window.ElaraSzene; window.ElaraSzene = undefined;
    var log = [], echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, t) { log.push(String(t)); };
    try { window._versteckSzeneSpielen(sc, 'werkstatt'); }
    finally { window.EventSystem.showEventChoiceDialog = echt; window.ElaraSzene = ES; }
    return log[0] || ''; })()`);
  assert.ok(/Hammer/.test(text), 'keine Textfassung: ' + text);
  assert.strictEqual(zustand(), null);
});
