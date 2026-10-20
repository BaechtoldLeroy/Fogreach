// tests/bruchNachtSzene.test.js — Die Nacht nach dem Bruch als Zwischenszene
// (js/bruchNachtSzene.js, b484).
//
// Gemeldet: "Die Message 'die Nacht nach dem Bruch' braucht eine Cutscene."
// Bisher stand sie als Textblock ueber dem Versteck. Jetzt: drei Tableaus,
// Zeile fuer Zeile Wort fuer Wort. Geprueft am echten Ausloeser (E bei Elara
// im Versteck): die Szene spielt einmal mit ihren Bildern, die Flagge steht
// wie vorher, die erste Taste zeigt die Zeile ganz, die naechste blaettert,
// Tasten waehlen nie eine Antwort, ESC beendet, die Spieluhr steht nur
// waehrenddessen, und ein zweites Ansprechen spielt nichts doppelt.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
const GS = "window.game.scene.getScene('GameScene')";
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

function standNachDemBruch() {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(4);
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify({ harren_daughter_investigation: FERTIG, widerstand_proof: FERTIG, elara_meeting: FERTIG, bruch_confrontation: FERTIG })};
    st.flags = { elaraMet: true, elara_versteck_gesehen: true, elara_camp_seen: true };
    qs.loadQuestSaveData(st);
  })()`);
  // Akt-Karten und Rest-Dialoge des Stands wegraeumen.
  H.run(`(function () { var sc = ${GS};
    sc.children.list.filter(function (o) { return o.name === 'aktwechsel'; }).forEach(function (o) { o.destroy(); });
    window.eventChoiceOpen = false; })()`);
}

/** Lauf mit Versteck, hinein, Elara ansprechen (E neben ihr). */
function zuElara() {
  return H.run(`(function () {
    window.DUNGEON_DEPTH = 5; initDungeonRun();
    var sc = ${GS};
    var i = dungeonRun.templateOrder.indexOf('ElarasVersteck');
    if (i < 0) return { fehler: 'kein Versteck' };
    enterRoom(sc, i);
    return { besuch: sc._versteckBesuch };
  })()`);
}
function eDruecken() {
  return H.run(`(function () {
    var sc = ${GS};
    var e = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'elara_right0' && o.active; })[0];
    if (!e) return false;
    player.setPosition(e.x - 30, e.y);
    sc.input.keyboard.emit('keydown-E', { key: 'e', keyCode: 69 });
    return true;
  })()`);
}
const Z = `${GS}.__bruchNacht`;
function taste(key) {
  H.run(`${GS}.input.keyboard.emit('keydown', { key: ${JSON.stringify(key)}, keyCode: ${key === 'Escape' ? 27 : 32}, repeat: false })`);
}
function zustand() {
  return H.run(`(function () { var z = ${Z}; if (!z) return null;
    return { phase: z.phase, schritt: z.schritt, bild: z.bild, text: z.text(), voll: z.voll, laeuft: z.laeuft(), offen: z.offen() }; })()`);
}
/** Bis zur naechsten fertig geschriebenen Zeile (Taste ueberspringt den Aufbau). */
function zeileFertig() {
  const z = zustand();
  if (z && z.laeuft) taste(' ');
  H.step(2);
}

test('E bei Elara spielt die Szene mit ihren drei Bildern, einmal, Flagge wie vorher', () => {
  standNachDemBruch();
  const r = zuElara();
  assert.strictEqual(r.besuch, 'bruch_nacht', JSON.stringify(r));
  assert.ok(bis(`window.BruchNachtSzene.BILDER.every(function (n) { return ${GS}.textures.exists(window.BruchNachtSzene.bildKey(n)); })`),
    'die Tableaus werden beim Betreten nicht geladen');
  H.step(10);
  assert.ok(eDruecken(), 'Elara steht nicht im Versteck');
  assert.ok(bis(`!!${Z}`, 50), 'keine Zwischenszene nach dem Ansprechen');
  // Derselbe Druck kommt auch als allgemeines keydown an: er darf die erste
  // Zeile nicht gleich fertig zeigen.
  taste('e');
  assert.strictEqual(zustand().laeuft, true, 'der ausloesende Druck hat die erste Zeile uebersprungen');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('bruch_nacht_gesehen')`), true);
  const bilder = H.run(`(function () { var c = ${GS}.children.list.filter(function (o) { return o.name === 'bruchNacht'; })[0];
    return c ? c.list.filter(function (o) { return /^bruchNachtBild_/.test(o.name); }).map(function (o) { return o.texture.key; }) : []; })()`);
  assert.deepStrictEqual(Array.from(bilder), ['bruchnacht_spalt', 'bruchnacht_kerze', 'bruchnacht_morgen']);
  const z = zustand();
  assert.strictEqual(z.bild, 'spalt');
  assert.ok(/Versteck/.test(z.voll), 'erste Zeile: ' + z.voll);
  assert.strictEqual(H.run(`${GS}.time.paused`), true, 'die Spieluhr laeuft waehrend der Szene');
  assert.strictEqual(H.run('window.eventChoiceOpen'), true, 'Angriffe nicht gesperrt');
  assert.strictEqual(H.run('window.versteckBesuchFaellig()'), null, 'danach ist noch ein Besuch faellig');
});

test('Erste Taste zeigt die Zeile ganz, die naechste blaettert weiter', () => {
  H.step(30);   // ueber die Sperre gegen den ausloesenden Druck
  let z = zustand();
  assert.strictEqual(z.schritt, 0);
  assert.strictEqual(z.laeuft, true, 'die Zeile schreibt sich nicht Wort fuer Wort');
  assert.ok(z.text.length < z.voll.length, 'die Zeile stand schon ganz da');
  taste(' ');
  z = zustand();
  assert.strictEqual(z.schritt, 0, 'die erste Taste hat weitergeblaettert');
  assert.strictEqual(z.text, z.voll, 'nach der ersten Taste steht die Zeile nicht ganz');
  taste(' ');
  z = zustand();
  assert.strictEqual(z.schritt, 1, 'die zweite Taste blaettert nicht weiter');
  assert.ok(z.laeuft, 'die neue Zeile baut sich nicht auf');
});

test('Die Wahl der Nacht nimmt keine Tasten, ein Klick waehlt, die Antwort folgt', () => {
  let n = 0;
  while (zustand().phase === 'zeile' && n++ < 20) { zeileFertig(); taste(' '); }
  let z = zustand();
  assert.strictEqual(z.phase, 'wahl', 'keine Wahl in der Nacht');
  assert.strictEqual(z.bild, 'kerze');
  const vorher = z.schritt;
  [' ', 'Enter', '1', 'e'].forEach(taste);
  z = zustand();
  assert.strictEqual(z.phase, 'wahl', 'eine Taste hat die Wahl beendet');
  assert.strictEqual(z.schritt, vorher);
  const geklickt = H.run(`(function () { var sc = ${GS};
    var box = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0];
    if (!box) return 'keine Auswahl';
    if (box.depth <= 6000) return 'Auswahl unter der Szene: ' + box.depth;
    var label = window.storyDialog.byScene.bruch_nacht.choices[0].label;
    var knoepfe = [];
    (function lauf(l) { l.forEach(function (o) { if (o.input && o.input.enabled) knoepfe.push(o); if (o.list) lauf(o.list); }); })(box.list);
    var k = knoepfe.filter(function (o) { return o.text === label; })[0] || knoepfe[0];
    if (!k) return 'kein Knopf';
    k.emit('pointerup', { x: 0, y: 0 }, 0, 0, { stopPropagation: function () {} });
    return 'ok';
  })()`);
  assert.strictEqual(geklickt, 'ok');
  H.step(2);
  z = zustand();
  assert.strictEqual(z.phase, 'zeile');
  assert.ok(/weiss/.test(z.voll), 'die Antwort fehlt: ' + z.voll);
});

test('Am Ende der Morgen, dann geht die Szene, die Uhr laeuft, nichts doppelt', () => {
  let n = 0, morgen = false;
  while (zustand() && n++ < 30) {
    if (zustand().bild === 'morgen') morgen = true;
    zeileFertig(); taste(' ');
  }
  assert.ok(morgen, 'das Morgenbild kam nicht');
  assert.strictEqual(zustand(), null, 'die Szene ist nicht zu');
  assert.strictEqual(H.run(`${GS}.time.paused`), false, 'die Spieluhr steht noch');
  assert.strictEqual(H.run(`${GS}.children.list.filter(function (o) { return /^bruchNacht|dialogChoiceContainer/.test(o.name || ''); }).length`), 0,
    'Reste der Szene liegen herum');
  H.step(20);
  assert.strictEqual(H.run('window.eventChoiceOpen'), false, 'die Angriffssperre bleibt haengen');
  // Noch einmal ansprechen: die Nacht ist gesehen.
  H.run(`window._versteckSzeneSpielen(${GS}, 'bruch_nacht')`);
  assert.strictEqual(zustand(), null, 'die Nacht spielt ein zweites Mal');
});

test('ESC ueberspringt die ganze Szene, auch ohne Wahl', () => {
  H.run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData(); st.flags.bruch_nacht_gesehen = false; qs.loadQuestSaveData(st); })()`);
  H.run(`window._versteckSzeneSpielen(${GS}, 'bruch_nacht')`);
  assert.ok(zustand(), 'keine Szene');
  H.step(30);
  taste('Escape');
  assert.strictEqual(zustand(), null, 'ESC beendet die Szene nicht');
  assert.strictEqual(H.run(`${GS}.time.paused`), false);
  assert.strictEqual(H.run(`${GS}.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; }).length`), 0,
    'nach dem Ueberspringen steht noch die Wahl');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('bruch_nacht_gesehen')`), true);
});

test('Ein Spielstand nach der Nacht bekommt sie nicht noch einmal', () => {
  standNachDemBruch();
  H.run(`(function () { var qs = window.questSystem, st = qs.getQuestSaveData(); st.flags.bruch_nacht_gesehen = true; qs.loadQuestSaveData(st); })()`);
  assert.strictEqual(H.run('window.versteckBesuchFaellig()'), null);
  H.run(`window._versteckSzeneSpielen(${GS}, 'bruch_nacht')`);
  assert.strictEqual(zustand(), null);
});
