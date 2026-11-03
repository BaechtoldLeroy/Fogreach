// tests/tiefenBegegnungen.test.js — Harrens Abstieg und Aldrics Ende (v6.1).
//
// Story-Kern v6.1: Harren folgt Dir ohne Amulett; mit jeder Tiefe nimmt ihm
// der Nebel mehr (Amt, Stadt, Deinen Namen), zuletzt bleibt nur "Lene". In
// "Die letzte Wache" fuehrt Mara Dich bei Welle 30 zu Aldric, der fragt, wer
// er ist; sagen oder schweigen setzt eine Flagge fuer den Epilog.
//
// Seit b501 spielen die Begegnungen als Zwischenszene auf Tableaus
// (js/tiefenSzene.js). Am laufenden Dungeon (roomManager._tiefenBegegnung):
// die Figur steht im Raum (sitzend, wo der Text es sagt), [E] in ihrer Naehe
// spielt die Szene; geblaettert wird per Taste, gewaehlt per Klick auf die
// echten Knoepfe. Ausloeser (Quest, Tiefe, Reihenfolge, zwei Raeume Abstand)
// sind unveraendert. Ohne das Szenenmodul bleibt die alte Textfassung.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
let L = null;
const SC = `window.game.scene.getScene('GameScene')`;
const Z = `${SC}.__tiefenSzene`;

before(async () => {
  H = await launchDungeon({ depth: 29 });
  L = H.lab;
  H.run(`(function () {
    var sc = ${SC};
    window.__dialogLog = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, titel, wahlen) {
      window.__dialogLog.push({ text: String(titel || ''), wahlen: (wahlen || []).map(function (w) { return w.label; }) });
      return echt.apply(this, arguments);
    };
    window.__klick = function (n) {
      var k = sc.children.list.filter(function (o) {
        return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active;
      })[n || 0];
      if (!k) return false;
      k.emit('pointerdown');
      return true;
    };
    window.__figur = function (bild) {
      return sc.children.list.filter(function (o) { return o.active && o.texture && o.texture.key === bild; })[0] || null;
    };
    window.__ansprechen = function (bild) {
      var f = window.__figur(bild);
      if (!f) return false;
      player.x = f.x + 20; player.y = f.y;
      if (player.body && player.body.reset) player.body.reset(f.x + 20, f.y);
      sc.input.keyboard.emit('keydown-E', {});
      return true;
    };
    // Einen Knopf der Wahl ueber der Szene anklicken (wie bruchNachtSzene.test).
    window.__wahlKlick = function (n) {
      var box = sc.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; })[0];
      if (!box) return 'keine Auswahl';
      if (box.depth <= 6000) return 'Auswahl unter der Szene: ' + box.depth;
      var knoepfe = [];
      (function lauf(l) { l.forEach(function (o) { if (o.input && o.input.enabled) knoepfe.push(o); if (o.list) lauf(o.list); }); })(box.list);
      var k = knoepfe[n || 0];
      if (!k) return 'kein Knopf ' + n;
      k.emit('pointerup', { x: 0, y: 0 }, 0, 0, { stopPropagation: function () {} });
      return 'ok';
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

function bis(js, max) {
  for (let i = 0; i < (max || 400); i++) {
    if (H.run(js)) return true;
    H.step(3);
  }
  return !!H.run(js);
}
function taste(key) {
  H.run(`${SC}.input.keyboard.emit('keydown', { key: ${JSON.stringify(key)}, keyCode: ${key === 'Escape' ? 27 : 32}, repeat: false })`);
}
function zustand() {
  return H.run(`(function () { var z = ${Z}; if (!z) return null;
    return { id: z.id, phase: z.phase, schritt: z.schritt, bild: z.bild, text: z.text(), voll: z.voll, laeuft: z.laeuft(), offen: z.offen(), variante: z.variante() }; })()`);
}

function aufraeumen() {
  // Eine liegengebliebene Szene (fehlgeschlagener Test) zu Ende bringen.
  for (let i = 0; i < 10 && H.run(`!!${Z}`); i++) {
    if (H.run(`${Z}.phase === 'wahl'`)) H.run('window.__wahlKlick(0)'); else { H.step(30); taste('Escape'); }
    H.step(2);
  }
  for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) { H.run('window.__klick(0)'); H.step(2); }
  H.run(`window.EventSystem.cleanupEventObjects && window.EventSystem.cleanupEventObjects()`);
  H.run(`${SC}.children.list.filter(function (o) { return o.name === 'dialogChoiceContainer'; }).forEach(function (o) { o.destroy(); })`);
  H.run('window.__dialogLog.length = 0; window.eventChoiceOpen = false');
  H.run(`window.resumeGameClock && window.resumeGameClock(${SC})`);
}
beforeEach(() => {
  L.clearEnemies();
  L.healPlayer();
  aufraeumen();
  // Jede Begegnung beginnt in einem frischen Lauf (Raumsperre zurueck).
  H.run('window.initDungeonRun && window.initDungeonRun()');
});

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const QUELLE = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };
const flag = (n) => H.run(`window.questSystem.hasFlag('${n}')`);
const faellig = (t) => H.run(`(function () { var f = window.tiefenBegegnungFaellig(${t}); return f ? (f.art + (f.nr ? f.nr : '')) : null; })()`);

/** Begegnung im Raum `raum` ausloesen; gibt zurueck, ob die Figur steht. */
function begegnung(raum, bild) {
  H.run(`window._tiefenBegegnung(${SC}, ${raum})`);
  H.step(2);
  return H.run(`!!window.__figur('${bild}')`);
}

/**
 * Die Figur ansprechen und die Szene durchspielen: jede Zeile per Taste
 * fertig und weiter, an der Wahl Knopf `wahl`. Rueckgabe: gezeigte Zeilen,
 * Bilder in der Reihenfolge, Variante.
 */
function szene(figur, wahl, opt) {
  // Die Angriffssperre der vorigen Szene laeuft kurz nach (dieselbe Taste).
  assert.ok(bis('!window.eventChoiceOpen', 50), 'die Sperre der vorigen Szene haengt');
  assert.ok(H.run(`window.__ansprechen('${figur}')`), figur + ' steht nicht im Raum');
  assert.ok(bis(`!!${Z}`, 200), 'keine Zwischenszene nach dem Ansprechen von ' + figur + ': '
    + JSON.stringify(H.run(`({ figur: !!window.__figur('${figur}'), log: window.__dialogLog.length, wahl: !!window.eventChoiceOpen,
      bilder: Object.keys(window.TiefenSzene.SZENEN).map(function (id) { return id + ':' + window.TiefenSzene.SZENEN[id].bilder.every(function (n) { return ${SC}.textures.exists(window.TiefenSzene.bildKey(id, n)); }); }).join(',') })`)));
  H.run(`window.__tsLetzte = ${Z}`);
  H.step(30);   // ueber die Sperre gegen den ausloesenden Druck
  const bilder = [];
  let uhrStand = true;
  for (let n = 0; n < 60 && zustand(); n++) {
    const z = zustand();
    if (bilder[bilder.length - 1] !== z.bild) bilder.push(z.bild);
    if (!H.run(`${SC}.time.paused`)) uhrStand = false;
    if (opt && opt.esc && z.phase === 'zeile') { taste('Escape'); H.step(2); continue; }
    if (z.phase === 'wahl') {
      assert.strictEqual(H.run(`window.__wahlKlick(${wahl || 0})`), 'ok');
    } else {
      if (z.laeuft) taste(' ');
      H.step(2);
      taste(' ');
    }
    H.step(2);
  }
  assert.strictEqual(zustand(), null, 'die Szene geht nicht zu');
  return {
    zeilen: JSON.parse(H.run('JSON.stringify(window.__tsLetzte.gezeigt)')),   // nicht aus dem vm-Realm vergleichen
    bilder: bilder,
    variante: H.run('window.__tsLetzte.variante()'),
    uhrStand: uhrStand
  };
}

test('Harren erscheint nur waehrend der Quelle und erst ab Tiefe 24', () => {
  stand({}, {});
  assert.strictEqual(faellig(29), null, 'Harren ohne laufende Quelle');
  stand(QUELLE, {});
  assert.strictEqual(faellig(23), null, 'Harren schon auf Tiefe 23');
  assert.strictEqual(faellig(24), 'harren1');
  stand(QUELLE, { harren_dead: true });
  assert.strictEqual(faellig(29), null, 'der tote Harren erscheint noch');
});

test('Harrens Abstieg: drei Szenen in fester Reihenfolge, jedes Mal weniger er selbst', () => {
  stand(QUELLE, {});
  L.setDepth(29, 29);
  // Raum 1 ist zu frueh, Raum 2 bringt ihn.
  assert.strictEqual(begegnung(1, 'harren_right0'), false, 'Harren schon im ersten Raum');
  assert.strictEqual(begegnung(2, 'harren_right0'), true, 'Harren erscheint nicht');
  const eins = szene('harren_right0', 1);
  const t1 = eins.zeilen.join('\n');
  assert.deepStrictEqual(eins.bilder, ['wand'], 'Bilder der ersten Begegnung');
  assert.ok(eins.uhrStand, 'die Spieluhr lief waehrend der Szene');
  assert.ok(/Archivschmied/.test(t1), 'er kennt Dich noch: ' + t1);
  assert.ok(/Amt/.test(t1) && /weiss nicht mehr, welches/.test(t1), 'das Amt ist nicht weg: ' + t1);
  assert.ok(/Ich muss nur an sie denken/.test(t1), 'die Antwort auf "Bleib bei mir" fehlt: ' + t1);
  assert.strictEqual(H.run('window.__dialogLog.length'), 0, 'die alte Textfassung lief mit');
  assert.strictEqual(flag('harren_abstieg_1'), true);
  assert.strictEqual(faellig(29), 'harren2');

  // Gleich im naechsten Raum noch nicht, zwei Raeume spaeter schon, und er sitzt.
  assert.strictEqual(begegnung(3, 'harren_right0') || H.run(`!!window.__figur('harren_sitzend')`), false,
    'zwei Begegnungen direkt hintereinander');
  assert.strictEqual(begegnung(4, 'harren_sitzend'), true, 'auf der Stufe sitzt Harren nicht');
  assert.strictEqual(H.run(`!!window.__figur('harren_right0')`), false, 'der stehende Harren steht daneben');
  const hoehe = H.run(`(function () { var f = window.__figur('harren_sitzend'); var g = window.figurGrenzen(${SC}, 'harren_sitzend'); return g.boundsHeight * f.scaleY; })()`);
  assert.ok(hoehe > 34 && hoehe < 46, 'der Sitzende ist so gross wie ein Stehender: ' + hoehe);
  const zwei = szene('harren_sitzend', 0);
  const t2 = zwei.zeilen.join('\n');
  assert.deepStrictEqual(zwei.bilder, ['stufe']);
  assert.ok(/Archivschmied/.test(t2), 'den Namen hat er schon verloren: ' + t2);
  assert.ok(/Stadt/.test(t2) && /weiss ich nicht mehr/.test(t2), 'die Stadt ist nicht weg: ' + t2);
  assert.ok(/Es bleibt nicht/.test(t2), 'die Antwort auf "Fogreach" fehlt: ' + t2);
  assert.strictEqual(flag('harren_abstieg_2'), true);

  assert.strictEqual(begegnung(6, 'harren_right0'), true, 'die dritte Begegnung kommt nicht');
  const drei = szene('harren_right0');
  assert.deepStrictEqual(drei.bilder, ['schacht']);
  const harrenSagt = drei.zeilen.filter((s) => /^HARREN:/.test(s));
  assert.deepStrictEqual(harrenSagt, ['HARREN: Lene.'], 'zuletzt sagt er nur "Lene": ' + drei.zeilen.join(' | '));
  assert.ok(!/Archivschmied/.test(drei.zeilen.join('\n')), 'er kennt Dich noch');
  assert.strictEqual(flag('harren_abstieg_3'), true);
  assert.strictEqual(faellig(29), null, 'eine vierte Begegnung');
  assert.strictEqual(begegnung(8, 'harren_right0'), false);
});

test('Die Reihenfolge haengt an den Flaggen, nicht an der Tiefe', () => {
  // Wer tief steht, sieht trotzdem zuerst die erste Begegnung.
  stand(QUELLE, {});
  assert.strictEqual(faellig(29), 'harren1');
  stand(QUELLE, { harren_abstieg_1: true });
  assert.strictEqual(faellig(25), null, 'die zweite Begegnung schon auf Tiefe 25');
  assert.strictEqual(faellig(26), 'harren2');
  stand(QUELLE, { harren_abstieg_2: true });
  assert.strictEqual(faellig(29), 'harren1', 'ohne die erste kommt die zweite nicht zuerst');
});

const WACHE = (welle, gefunden) => ({
  schattenrat_finale: { status: 'completed', objectives: [] },
  mara_assault: { status: 'active', objectives: [
    { type: 'wave', target: 'reach_wave', current: welle, required: 30 },
    { type: 'observe', target: 'aldric_gefunden', current: gefunden ? 1 : 0, required: 1 }] }
});

test('Aldric erst bei Welle 30, und nur einmal', () => {
  stand(WACHE(29, false), {});
  assert.strictEqual(faellig(30), null, 'Aldric vor Welle 30');
  stand(WACHE(30, true), {});
  assert.strictEqual(faellig(30), null, 'Aldric ein zweites Mal');
  stand(WACHE(30, false), {});
  assert.strictEqual(faellig(30), 'aldric');
});

test('Aldrics Ende: er sitzt ohne Mantel im Raum, Mara fuehrt Dich hin, Du sagst ihm, wer er war', () => {
  stand(WACHE(30, false), {});
  L.setDepth(30, 30);
  assert.strictEqual(begegnung(2, 'aldric_sitzend'), true, 'Aldric sitzt nicht im Raum');
  assert.strictEqual(H.run(`!!window.__figur('aldric_right0')`), false, 'der Ratsherr im Mantel steht im Raum');
  const s = szene('aldric_sitzend', 0);
  const t = s.zeilen.join('\n');
  assert.deepStrictEqual(s.bilder, ['biegung', 'leer', 'erzaehlt'], 'Bilder der Variante "erzaehlt"');
  assert.strictEqual(s.variante, 'erzaehlt');
  assert.ok(/Mara wartet/.test(t), 'Mara fuehrt Dich nicht hin: ' + t);
  assert.ok(/Weisst Du, wer ich bin\?/.test(t), 'er fragt nicht, wer er ist');
  assert.ok(/schlechten Menschen/.test(t) && /Lass ihn hier/.test(t), 'Antwort oder Maras Schluss fehlt: ' + t);
  assert.strictEqual(flag('aldric_erzaehlt'), true);
  assert.strictEqual(flag('aldric_verschwiegen'), false);
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_assault')`), true,
    'die letzte Wache ist nach der Begegnung nicht fertig');
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/Aldric lebt in einer Kammer/.test(ep), 'der Epilog kennt die Wahl nicht');
});

test('Aldrics Ende: Du schweigst, das Bild bleibt ihm im Dunkeln', () => {
  stand(WACHE(30, false), {});
  L.setDepth(30, 30);
  assert.strictEqual(begegnung(2, 'aldric_sitzend'), true);
  const s = szene('aldric_sitzend', 1);
  assert.deepStrictEqual(s.bilder, ['biegung', 'leer', 'geschwiegen'], 'Bilder der Variante "geschwiegen"');
  assert.strictEqual(s.variante, 'geschwiegen');
  assert.ok(/Seine Geschichte bleibt bei Dir/.test(s.zeilen.join('\n')));
  assert.strictEqual(flag('aldric_verschwiegen'), true);
  assert.strictEqual(flag('aldric_erzaehlt'), false);
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_assault')`), true);
  const ep = H.run(`window.QuestFinale.epilog(window.questSystem.getFlags(), 'de').join(' ')`);
  assert.ok(/weiss nicht, dass es seiner ist/.test(ep), 'der Epilog kennt das Schweigen nicht');
});

test('ESC springt zur Wahl, ueberspringt sie aber nie; danach endet die Szene', () => {
  stand(WACHE(30, false), {});
  L.setDepth(30, 30);
  assert.strictEqual(begegnung(2, 'aldric_sitzend'), true);
  assert.ok(H.run(`window.__ansprechen('aldric_sitzend')`));
  assert.ok(bis(`!!${Z}`, 200));
  H.step(30);
  taste('Escape');
  H.step(2);
  let z = zustand();
  assert.ok(z, 'ESC hat die Szene samt Wahl beendet');
  assert.strictEqual(z.phase, 'wahl', 'ESC springt nicht zur Wahl');
  assert.strictEqual(z.bild, 'leer');
  [' ', 'Enter', 'Escape', 'e'].forEach(taste);
  H.step(2);
  assert.strictEqual(zustand().phase, 'wahl', 'eine Taste hat die Wahl beendet');
  assert.strictEqual(flag('aldric_erzaehlt') || flag('aldric_verschwiegen'), false, 'Flagge ohne Wahl');
  assert.strictEqual(H.run('window.__wahlKlick(1)'), 'ok');
  H.step(2);
  z = zustand();
  assert.strictEqual(z.phase, 'zeile');
  assert.strictEqual(z.bild, 'geschwiegen');
  H.step(30);
  taste('Escape');
  H.step(2);
  assert.strictEqual(zustand(), null, 'ESC nach der Wahl beendet die Szene nicht');
  assert.strictEqual(flag('aldric_verschwiegen'), true);
  assert.strictEqual(H.run(`${SC}.time.paused`), false, 'die Spieluhr steht noch');
  assert.strictEqual(H.run(`${SC}.children.list.filter(function (o) { return /^tiefenSzene|dialogChoiceContainer/.test(o.name || ''); }).length`), 0,
    'Reste der Szene liegen herum');
  assert.strictEqual(H.run(`window.questSystem.isQuestReadyToComplete('mara_assault')`), true);
  H.step(20);
  assert.strictEqual(H.run('window.eventChoiceOpen'), false, 'die Angriffssperre bleibt haengen');
});

test('Bedienung: Text Wort fuer Wort, erste Taste zeigt die Zeile ganz, die naechste blaettert, Ueberspringen-Knopf', () => {
  stand({}, {});
  assert.ok(bis('!window.eventChoiceOpen', 50));
  assert.strictEqual(H.run(`window.TiefenSzene.spielen(${SC}, 'abstieg3', function () {}, null, { probe: true })`), true);
  assert.ok(bis(`!!${Z}`, 200));
  // Der ausloesende Druck zaehlt nicht.
  taste('e');
  let z = zustand();
  assert.strictEqual(z.schritt, 0);
  assert.strictEqual(z.laeuft, true, 'der ausloesende Druck hat die erste Zeile fertig gezeigt');
  H.step(30);
  z = zustand();
  assert.ok(z.text.length < z.voll.length, 'die Zeile stand schon ganz da');
  taste(' ');
  z = zustand();
  assert.strictEqual(z.schritt, 0, 'die erste Taste hat weitergeblaettert');
  assert.strictEqual(z.text, z.voll);
  H.step(2);
  taste(' ');
  assert.strictEqual(zustand().schritt, 1, 'die zweite Taste blaettert nicht');
  assert.strictEqual(H.run(`${SC}.time.paused`), true, 'die Spieluhr laeuft');
  const knopf = H.run(`(function () { var c = ${SC}.children.list.filter(function (o) { return o.name === 'tiefenSzene'; })[0];
    var k = c && c.list.filter(function (o) { return o.name === 'tiefenSzeneUeberspringen'; })[0];
    if (!k) return 'kein Knopf';
    if (k.displayHeight < 44) return 'zu klein: ' + k.displayHeight;
    k.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} });
    return 'ok'; })()`);
  assert.strictEqual(knopf, 'ok');
  assert.strictEqual(zustand(), null, 'Ueberspringen beendet die Szene ohne Wahl nicht');
  assert.strictEqual(H.run(`${SC}.time.paused`), false);
});

test('Alle Tableaus sind 384x192 und laden; die sitzenden Figuren sind da', () => {
  const r = H.run(`(function () {
    var TS = window.TiefenSzene, sc = ${SC}, aus = [];
    Object.keys(TS.SZENEN).forEach(function (id) { TS.vorladen(sc, id); });
    return true; })()`);
  assert.ok(r);
  assert.ok(bis(`Object.keys(window.TiefenSzene.SZENEN).every(function (id) { return window.TiefenSzene.SZENEN[id].bilder.every(function (n) { return ${SC}.textures.exists(window.TiefenSzene.bildKey(id, n)); }); })`),
    'nicht alle Tableaus geladen');
  const masse = H.run(`(function () { var TS = window.TiefenSzene, sc = ${SC}, m = {};
    Object.keys(TS.SZENEN).forEach(function (id) { TS.SZENEN[id].bilder.forEach(function (n) {
      var s = sc.textures.get(TS.bildKey(id, n)).getSourceImage(); m[TS.bildKey(id, n)] = s.width + 'x' + s.height; }); });
    return JSON.stringify(m); })()`);
  assert.deepStrictEqual(JSON.parse(masse), {
    abstieg_wand: '384x192', abstieg_stufe: '384x192', abstieg_schacht: '384x192',
    aldricende_biegung: '384x192', aldricende_leer: '384x192', aldricende_erzaehlt: '384x192', aldricende_geschwiegen: '384x192'
  });
  assert.strictEqual(H.run(`${SC}.textures.exists('harren_sitzend') && ${SC}.textures.exists('aldric_sitzend')`), true);
});

test('Debug-Vorschau: ?aldric=erzaehlt spielt die feste Variante ohne Wahl und ohne Flaggen', () => {
  stand({}, {});
  const r = H.run(`(function () {
    var G = window.DebugGate, echt = G.flagge;
    G.flagge = function (n) { return n === 'aldric' ? 'erzaehlt' : null; };
    var fertig = false;
    try { return { lief: window.TiefenSzene.probe(${SC}, function () { window.__probeFertig = true; }) }; }
    finally { G.flagge = echt; }
  })()`);
  assert.strictEqual(r.lief, true);
  assert.ok(bis(`!!${Z}`, 200));
  H.run(`window.__tsLetzte = ${Z}`);
  const bilder = [];
  H.step(30);
  for (let n = 0; n < 40 && zustand(); n++) {
    const z = zustand();
    assert.notStrictEqual(z.phase, 'wahl', 'die Vorschau fragt trotz fester Variante');
    if (bilder[bilder.length - 1] !== z.bild) bilder.push(z.bild);
    if (z.laeuft) taste(' ');
    H.step(2); taste(' '); H.step(2);
  }
  assert.strictEqual(zustand(), null);
  assert.deepStrictEqual(bilder, ['biegung', 'leer', 'erzaehlt']);
  assert.strictEqual(H.run('window.__probeFertig'), true);
  assert.strictEqual(flag('aldric_erzaehlt'), false, 'die Vorschau setzt die Flagge');
  // Einmal pro Laden.
  assert.strictEqual(H.run(`(function () { var G = window.DebugGate, echt = G.flagge;
    G.flagge = function (n) { return n === 'abstieg' ? '2' : null; };
    try { return window.TiefenSzene.probe(${SC}, function () {}); } finally { G.flagge = echt; } })()`), false);
});

test('Ohne das Szenenmodul bleibt die alte Textfassung', () => {
  stand(QUELLE, {});
  L.setDepth(29, 29);
  H.run('window.__tsWeg = window.TiefenSzene; window.TiefenSzene = null');
  try {
    assert.strictEqual(begegnung(2, 'harren_right0'), true);
    assert.ok(H.run(`window.__ansprechen('harren_right0')`));
    H.step(2);
    assert.strictEqual(H.run(`!!${Z}`), false);
    const d = H.run('window.__dialogLog[0]');
    assert.ok(d && /an die Wand gelehnt: Harren/.test(d.text), 'keine Textfassung: ' + JSON.stringify(d));
  } finally {
    H.run('window.TiefenSzene = window.__tsWeg');
  }
});
