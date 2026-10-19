// tests/gegenstandsstufe.test.js — EINE Gegenstandsstufe, ueberall dieselbe.
//
// Gemeldet: "Gegenstandsstufe in der Schmiede wird falsch berechnet."
//
// Ein Stueck trug zwei Stufen. iLevel setzt rollItem: die Stufe, auf der es
// gewuerfelt wurde — an ihr haengen Affixstaerke, Vitalitaet und Umwurf.
// Daneben itemLevel, aus den WERTEN nachgerechnet (Tiefe + gewichtete
// Basiswerte): beim Wurf, auf Schwierig mit Tiefe x Faktor, beim Opferstein
// neu, nach dem Ausbau gar nicht. Gemessen vor dem Fix:
//
//   - Glutaxt, gewuerfelt auf 7:            itemLevel 8
//   - Nebelamulett (Questlohn, Stufe 18):   itemLevel weit ueber 18 (Ruestung x 50)
//   - Altstueck (Speicherstand v1, Tiefe 9, itemLevel 34): Schmiede zeigte 34,
//     weil die Migration das Wertegewicht als iLevel uebernahm
//
// Die Schmiede las iLevel und fiel auf itemLevel zurueck — Altstuecke zeigten
// so ihr Wertegewicht. Jetzt gilt LootSystem.gegenstandsstufe (= iLevel),
// itemLevel ist nur noch ihr Spiegel, und Altstuecke bekommen beim Laden
// einmal eine Stufe, unabhaengig von der Tiefe, auf der geladen wird.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

let H = null;
const hub = `window.game.scene.getScene('HubSceneV2')`;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  H.run("(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')");
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 400 }), 'Hub nicht erreicht');
  H.step(20);
  H.run(`(function () { var sc = ${hub}; if (sc._closeDialog) { try { sc._closeDialog([]); } catch (e) {} } sc._dialogOpen = false; })()`);
});
after(async () => { if (H) await H.shutdown(); });

// Was die Schmiede zu einem Stueck auf einem Platz anzeigt. Die Szene wird
// beim ersten Aufruf gestartet; die Questabgabe unten braucht den Hub.
async function schmiede() {
  if (!H.run(`window.game.scene.isActive('CraftingScene')`)) {
    H.run(`${hub}.scene.start('CraftingScene')`);
    assert.ok(await H.waitForScene('CraftingScene', { maxRounds: 250 }), 'Schmiede nicht erreicht');
  }
}
const ZEIGE = `function zeige(slot, it) {
  var sc = window.game.scene.getScene('CraftingScene');
  window.equipment[slot] = it;
  sc._refreshAll(); sc._selectEquip(slot);
  return { werk: String(sc.werkbankStufe.text || ''), platz: String(sc._platzZeile(it) || '') };
}`;

function stimmt(r, n, was) {
  assert.strictEqual(r.stufe, n, was + ': gegenstandsstufe ' + r.stufe + ', erwartet ' + n);
  assert.strictEqual(r.iLevel, n, was + ': iLevel ' + r.iLevel);
  assert.strictEqual(r.itemLevel, n,
    was + ': itemLevel ' + r.itemLevel + ' laeuft der Gegenstandsstufe ' + n + ' davon');
  if (r.werk !== undefined) {
    assert.ok(r.werk.indexOf('Gegenstandsstufe ' + n) >= 0, was + ': Werktisch "' + r.werk + '"');
    assert.ok(r.platz.indexOf('Gst ' + n) >= 0, was + ': Platzzeile "' + r.platz + '"');
  }
}

test('Questlohn: Stufe des Spielers, auch mit Signatur', () => {
  // Das Nebelamulett hebt per Signatur die Ruestung — vorher rechnete die
  // Abgabe itemLevel daraus nach (Ruestung x 50) und es lag weit ueber 18.
  const r = H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = {}; st.flags = {};
    var d = qs.QUEST_DEFINITIONS.elara_ritual;
    st.quests.elara_ritual = { status: 'active', objectives: d.objectives.map(function (o) {
      return { type: o.type, target: o.target, current: o.required, required: o.required }; }) };
    qs.loadQuestSaveData(st);
    for (var i = 0; i < window.inventory.length; i++) window.inventory[i] = null;
    playerLevel = 18; window.playerLevel = 18;
    if (!qs.completeQuest('elara_ritual')) return { fehler: 'nicht abgegeben' };
    var it = window.inventory.filter(function (x) { return x && x.key === 'RITUAL_AMULETT'; })[0];
    if (!it) return { fehler: 'nicht im Inventar' };
    window.__lohn = it;
    return { stufe: window.LootSystem.gegenstandsstufe(it), iLevel: it.iLevel, itemLevel: it.itemLevel };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  stimmt(r, 18, 'Nebelamulett');
});

test('Schmiede zeigt die Wurfstufe — frisch, nach Ausbau und beim Questlohn', async () => {
  await schmiede();
  const r = H.run(`(function () {
    ${ZEIGE}
    var LS = window.LootSystem, out = {};
    var a = LS.rollItem('WPN_GLUTAXT', 7, 2);
    out.frisch = Object.assign({ stufe: LS.gegenstandsstufe(a), iLevel: a.iLevel, itemLevel: a.itemLevel }, zeige('weapon', a));
    LS.ausbauen(a); LS.ausbauen(a);
    out.ausbau = Object.assign({ stufe: LS.gegenstandsstufe(a), iLevel: a.iLevel, itemLevel: a.itemLevel }, zeige('weapon', a));
    var l = window.__lohn;
    out.lohn = Object.assign({ stufe: LS.gegenstandsstufe(l), iLevel: l.iLevel, itemLevel: l.itemLevel }, zeige('head', l));
    return out;
  })()`);
  stimmt(r.frisch, 7, 'frisch gewuerfelt');
  stimmt(r.ausbau, 7, 'nach zwei Ausbaustufen');
  assert.ok(r.ausbau.platz.indexOf('Ausbau +2') >= 0, 'Ausbau fehlt in der Platzzeile: ' + r.ausbau.platz);
  stimmt(r.lohn, 18, 'Questlohn in der Schmiede');
});

test('Schwierig: haertere Werte, dieselbe Stufe', () => {
  // _applyDifficultyToRolledItem rechnete itemLevel mit Tiefe x 1,5 nach.
  const r = H.run(`(function () {
    var alt = window.DIFFICULTY_MULTIPLIER, altF = window.getDifficultyMultiplier;
    window.getDifficultyMultiplier = function () { return 1.5; };
    window.DIFFICULTY_MULTIPLIER = 1.5;
    var cw = window.currentWave; window.currentWave = 10; currentWave = 10;
    var it = null;
    try {
      for (var i = 0; i < 60 && !(it && it.tier !== undefined && it.baseStats && it.type !== 'material' && it.type !== 'potion'); i++) {
        it = window.randomLoot(1, { nurAusruestung: true });
      }
    } finally {
      window.getDifficultyMultiplier = altF; window.DIFFICULTY_MULTIPLIER = alt;
      window.currentWave = cw; currentWave = cw;
    }
    return { stufe: window.LootSystem.gegenstandsstufe(it), iLevel: it.iLevel, itemLevel: it.itemLevel };
  })()`);
  stimmt(r, 10, 'Schwierig, Tiefe 10');
});

test('Opferstein: andere Zahlen, dieselbe Stufe', async () => {
  await schmiede();
  const r = H.run(`(function () {
    ${ZEIGE}
    var LS = window.LootSystem;
    var a = LS.rollItem('WPN_GLUTAXT', 12, 2);
    window.equipment.weapon = a;
    var u = window.EventSystem.opferUmwurf('weapon', 3, { besser: true, spanne: 0.3 });
    var neu = window.equipment.weapon;
    return Object.assign({ getauscht: neu !== a, stufe: LS.gegenstandsstufe(neu), iLevel: neu.iLevel, itemLevel: neu.itemLevel }, zeige('weapon', neu));
  })()`);
  assert.ok(r.getauscht, 'der Stein hat nicht getauscht — der Test saehe nichts');
  stimmt(r, 12, 'nach dem Opferstein (geopfert auf Tiefe 3)');
});

test('Altstand v1: Fundtiefe statt Wertegewicht, unabhaengig von der Ladetiefe', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem, out = {};
    function stand(tiefe) {
      window.DUNGEON_DEPTH = tiefe;
      // So legte die alte Beute itemLevel an: Fundtiefe 9 + Wertegewicht.
      var schwert = { type: 'weapon', key: 'WPN', name: 'Schwert', damage: 22, speed: 0.3, range: 20, hp: 4 };
      schwert.itemLevel = window.computeItemLevelFromStats(schwert, 9);
      // Alte Questbelohnung: von Hand gesetzte Stufe, Werte weit darueber.
      var klinge = { type: 'weapon', key: 'ELARAS_KLINGE', name: 'Elaras Klinge', itemLevel: 15,
        damage: 7, speed: 1.3, range: 120, armor: 0, crit: 0.15, hp: 0 };
      var s = LS.migrateSave({ saveVersion: 1, inventory: [klinge], equipment: { weapon: schwert } });
      return { schwert: s.equipment.weapon, klinge: s.inventory[0] };
    }
    var flach = stand(2), tief = stand(25);
    window.DUNGEON_DEPTH = 1;
    function r(it) { return { stufe: LS.gegenstandsstufe(it), iLevel: it.iLevel, itemLevel: it.itemLevel }; }
    return { flach: r(flach.schwert), tief: r(tief.schwert), klinge: r(flach.klinge) };
  })()`);
  stimmt(r.flach, 9, 'Altschwert, geladen auf Tiefe 2');
  stimmt(r.tief, 9, 'Altschwert, geladen auf Tiefe 25');
  stimmt(r.klinge, 15, 'alte Elaras Klinge (von Hand gesetzte Stufe)');
});

test('Jeder Ladevorgang: fehlende Stufe nachgetragen, abweichendes itemLevel angeglichen, Truhe inklusive', () => {
  const r = H.run(`(function () {
    var LS = window.LootSystem;
    window.DUNGEON_DEPTH = 30;
    var ohne = { type: 'body', key: 'X', name: 'Wams', tier: 0, affixes: [], hp: 5, baseStats: { hp: 5 } };
    ohne.itemLevel = window.computeItemLevelFromStats(ohne, 6);
    var drift = { type: 'boots', key: 'Y', name: 'Stiefel', tier: 1, affixes: [], iLevel: 6, itemLevel: 18, baseStats: {} };
    var truhe = { type: 'head', key: 'Z', name: 'Kappe', tier: 0, affixes: [], iLevel: 4, itemLevel: 40, baseStats: {} };
    var trank = { type: 'potion', potionTier: 1, stack: 2 };
    var s = LS.migrateSave({ saveVersion: 3, inventory: [ohne, trank], equipment: { boots: drift },
      truhe: { zeilen: 2, faecher: [truhe, null] } });
    window.DUNGEON_DEPTH = 1;
    function r(it) { return { stufe: LS.gegenstandsstufe(it), iLevel: it.iLevel, itemLevel: it.itemLevel }; }
    return { ohne: r(s.inventory[0]), drift: r(s.equipment.boots), truhe: r(s.truhe.faecher[0]),
      trank: s.inventory[1].iLevel === undefined && s.inventory[1].itemLevel === undefined };
  })()`);
  stimmt(r.ohne, 6, 'Stueck ohne iLevel (geladen auf Tiefe 30)');
  stimmt(r.drift, 6, 'Stueck mit abweichendem itemLevel');
  stimmt(r.truhe, 4, 'Stueck in der Truhe');
  assert.ok(r.trank, 'ein Trank hat eine Gegenstandsstufe bekommen');
});

test('Englisch: die Schmiede sagt Item Level', async () => {
  await schmiede();
  const r = H.run(`(function () {
    ${ZEIGE}
    window.i18n.setLanguage('en');
    try {
      var a = window.LootSystem.rollItem('WPN_GLUTAXT', 11, 2);
      window.LootSystem.ausbauen(a);
      return zeige('weapon', a);
    } finally { window.i18n.setLanguage('de'); }
  })()`);
  assert.ok(r.werk.indexOf('Item Level 11') >= 0, 'Werktisch: "' + r.werk + '"');
  assert.ok(r.platz.indexOf('iLvl 11') >= 0, 'Platzzeile: "' + r.platz + '"');
  assert.ok(r.platz.indexOf('Upgrade +1') >= 0, 'Platzzeile: "' + r.platz + '"');
});

test('Niemand rechnet itemLevel mehr aus den Werten nach', () => {
  // Der Rueckfall von vorher: eine neue Stelle schreibt
  // "x.itemLevel = computeItemLevelFromStats(...)" und die Stufen laufen
  // wieder auseinander. Gelesen wird die Stufe nur ueber gegenstandsstufe.
  const js = path.join(__dirname, '..', 'js');
  const dateien = [];
  (function sammle(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'vendor') sammle(p); } else if (e.name.endsWith('.js')) dateien.push(p);
    });
  })(js);
  const treffer = [];
  dateien.forEach((p) => {
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((z, i) => {
      if (/itemLevel\s*=\s*[^=]/.test(z) && /computeItemLevelFromStats/.test(z)) {
        treffer.push(path.relative(js, p) + ':' + (i + 1));
      }
      if (/\.itemLevel\b/.test(z) && !/^\s*(\/\/|\*)/.test(z) && !/lootSystem\.js$/.test(p)) {
        treffer.push(path.relative(js, p) + ':' + (i + 1) + ' liest/schreibt itemLevel');
      }
    });
  });
  assert.deepStrictEqual(treffer, []);
});
