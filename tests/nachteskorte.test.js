// tests/nachteskorte.test.js: die Nachteskorte (garde_night_escort).
//
// Eigener Raum (Umschlagstelle), ein Karren faehrt drei Stationen ab
// (Verladung, Waage, Schacht). Die Zone einer Station zaehlt erst, wenn der
// Karren dort haelt; unterwegs muss man in Reichweite bleiben, sonst setzt
// der Fuhrmann an der letzten Station neu an. Jede Station spielt ihr
// Gespraech mit eigenem Tableau, an der Waage folgt die Wahl um die Seite,
// am Schacht der Abschluss.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";
// Werte aus dem Spiel-Realm vergleichbar machen.
const j = (x) => JSON.parse(JSON.stringify(x));

async function bis(H, js, runden) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}

// Laeuft neben dem Karren her, bis die Bedingung gilt.
async function mitlaufen(H, js, runden) {
  for (let i = 0; i < (runden || 3000); i++) {
    if (H.run(js)) return true;
    H.run(`(function () { var s = window.Nachteskorte.getState(); var p = window.player;
      if (s && p) p.setPosition(s.pos.x, s.pos.y + 30); })()`);
    H.step(2);
    await flush();
  }
  return false;
}

// Stellt sich in die offene Zone der Station und wartet auf deren Szene.
async function zuhoeren(H, ziel) {
  H.run(`(function () { var z = window.EspionageSystem.getState().observeZones.filter(function (o) { return o.questTarget === '${ziel}'; })[0];
    window.player.setPosition(z.x, z.y + 20); })()`);
  return bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'belauscht' && ${GS}.__spionSzene.tableau === 'spionbild_${ziel}')`, 900);
}

function szeneTexte(H) {
  return H.run(`(function () { var z = ${GS}.__spionSzene; if (!z) return null;
    var t = function (n) { var o = z.teile.filter(function (x) { return x.name === n; })[0]; return o ? o.text : ''; };
    return { art: z.art, titel: t('spionTitel'), rede: t('spionRede'), seiten: z.seiten, tableau: z.tableau || null }; })()`);
}

async function szeneDurchblaettern(H, art) {
  // Alle Seiten lesen und den Text jeder Seite sammeln.
  art = art || 'belauscht';
  const texte = [];
  for (let n = 0; n < 12; n++) {
    if (!(await bis(H, `${GS}.__spionSzene && ${GS}.__spionSzene.phase === 'rede' && ${GS}.__spionSzene.seite === ${n}`, 300))) break;
    const t = szeneTexte(H);
    texte.push(t.rede);
    for (let i = 0; i < 12; i++) { H.step(2); await flush(); }
    // Letzte Seite: danach nicht warten, sonst faehrt der Karren ohne uns ab.
    if (n + 1 >= t.seiten) { H.run(`${GS}.__spionSzene.weiter()`); break; }
    H.run(`${GS}.__spionSzene.weiter()`);
  }
  await bis(H, `!${GS}.__spionSzene || ${GS}.__spionSzene.art !== '${art}'`, 600);
  return texte;
}

describe('Nachteskorte', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 16, zusatz: '&debug=1&eskorte=1' });
    H.run('window.SpionageSzenen._TEMPO = 0.2; window._playerInvincible = true');
    // Die Auftrags-Szene zu Beginn ueberspringen.
    await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'start')`, 400);
    H.run(`${GS}.__spionSzene && ${GS}.__spionSzene.ueberspringen()`);
    await bis(H, `!${GS}.__spionSzene`);
    // Der Karren faehrt im Test schneller und vermisst Dich frueher; die Regeln
    // bleiben dieselben (sonst dauert die Fahrt eine Minute Spielzeit).
    H.run('(function () { var s = window.Nachteskorte.getState(); s.tempo = 320; s.frist = 1.5; })()');
  });
  after(async () => { if (H) await H.shutdown(); });

  test('der Name auf der Waage folgt Maras Liste', () => {
    const r = H.run(`(function () { var N = window.Nachteskorte;
      return [N.erkannterName({ namen_gewarnt: true }), N.erkannterName({ namen_abgeliefert: true }), N.erkannterName({})]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), ['Oda Kessler', 'Benno Falk', 'Wendel Rusk']);
  });

  test('die Umschlagstelle ist im Lauf, solange die Eskorte laeuft (ab Tiefe 16, auch tiefer)', () => {
    const r = H.run(`(function () {
      var mit = function (t) { window.DUNGEON_DEPTH = t; var n = 0;
        for (var i = 0; i < 12; i++) { initDungeonRun(); if (dungeonRun.templateOrder.indexOf('Umschlagstelle') !== -1) n++; }
        return n; };
      var tief16 = mit(16), tief23 = mit(23), tief15 = mit(15);
      var qs = window.questSystem, d = qs.getQuestSaveData();
      var alt = d.quests.garde_night_escort;
      d.quests.garde_night_escort = { status: 'available', objectives: null }; qs.loadQuestSaveData(d);
      var ohne = mit(16);
      d.quests.garde_night_escort = alt; qs.loadQuestSaveData(d);
      window.DUNGEON_DEPTH = 16;
      return [tief16, tief23, tief15, ohne]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [12, 12, 0, 0]);
  });

  test('Start: der Karren haelt an der Verladung, nur deren Zone ist offen', () => {
    const r = H.run(`(function () { var s = window.Nachteskorte.getState();
      return { phase: s.phase, station: s.station, gesperrt: window.EspionageSystem.getState().observeZones.map(function (z) { return !!z.gesperrt; }),
        figuren: ['karren', 'fuhrmann', 'traeger1', 'traeger2'].every(function (k) { return s.teile[k] && s.teile[k].scene; }) }; })()`);
    assert.strictEqual(r.phase, 'halt');
    assert.strictEqual(r.station, 0);
    assert.deepStrictEqual(j(r.gesperrt), [false, true, true]);
    assert.ok(r.figuren, 'Karren, Fuhrmann und Traeger fehlen');
  });

  test('eine gesperrte Station zaehlt nicht, auch wenn man drinsteht', async () => {
    H.run(`(function () { var z = window.EspionageSystem.getState().observeZones[1]; window.player.setPosition(z.x, z.y); })()`);
    for (let i = 0; i < 130; i++) { H.step(2); await flush(); }
    const r = H.run(`window.questSystem.getActiveQuests().filter(function (q) { return q.id === 'garde_night_escort'; })[0].objectives.map(function (o) { return o.current; })`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [0, 0, 0]);
  });

  test('Verladung: Gespraech mit Tableau, danach faehrt der Karren', async () => {
    assert.ok(await zuhoeren(H, 'eskorte_verladung'), 'keine Szene an der Verladung');
    const texte = await szeneDurchblaettern(H);
    assert.ok(texte.some((t) => /Schild/.test(t)), 'Gespraech: ' + texte.join(' | '));
    assert.ok(await bis(H, "window.Nachteskorte.getState().phase === 'fahren'", 200), 'der Karren faehrt nicht los');
  });

  test('zurueckbleiben: nach der Frist an die letzte Station, Verdacht steigt', async () => {
    // Ein Stueck mitfahren, dann weit weg und dort bleiben.
    await mitlaufen(H, "window.Nachteskorte.getState().pos.x > 500", 2000);
    const vorher = H.run('window.EspionageSystem.getDetection()');
    H.run('window.player.setPosition(960, 96)');
    assert.ok(await bis(H, "window.Nachteskorte.warnt()", 100), 'keine Warnung ausserhalb der Reichweite');
    assert.ok(/Karren|cart/.test(H.run('window.Nachteskorte.hinweis({})')), 'kein Hinweis');
    assert.ok(await bis(H, "window.Nachteskorte.getState().verloren === 1", 1500), 'der Transport setzt nicht zurueck');
    const r = H.run(`(function () { var s = window.Nachteskorte.getState(); var a = s.pfad[s.stationen[0].punkt];
      return { phase: s.phase, amStart: s.pos.x === a.x && s.pos.y === a.y, verdacht: window.EspionageSystem.getDetection() }; })()`);
    assert.strictEqual(r.phase, 'warten');
    assert.ok(r.amStart, 'nicht an der letzten Station');
    assert.ok(r.verdacht > vorher, 'der Verdacht steigt nicht');
    // Zurueck zum Karren: er faehrt wieder.
    H.run(`(function () { var s = window.Nachteskorte.getState(); window.player.setPosition(s.pos.x, s.pos.y + 30); })()`);
    assert.ok(await bis(H, "window.Nachteskorte.getState().phase === 'fahren'", 100), 'faehrt nicht wieder an');
  });

  test('in Reichweite: der Karren erreicht die Waage, deren Zone oeffnet sich', async () => {
    assert.ok(await mitlaufen(H, "window.Nachteskorte.getState().phase === 'halt' && window.Nachteskorte.getState().station === 1"),
      'der Karren kommt nicht an der Waage an');
    assert.strictEqual(H.run('window.Nachteskorte.getState().verloren'), 1, 'trotz Begleitung verloren');
    assert.ok(await bis(H, 'window.EspionageSystem.getState().observeZones[1].gesperrt === false', 20));
  });

  test('Waage: der erkannte Name, danach die Wahl um die Seite (Flagge)', async () => {
    assert.ok(await zuhoeren(H, 'eskorte_waage'), 'keine Szene an der Waage');
    const texte = await szeneDurchblaettern(H);
    assert.ok(texte.some((t) => t.indexOf('Wendel Rusk') !== -1), 'der Name fehlt: ' + texte.join(' | '));
    assert.ok(texte.every((t) => t.indexOf('{name}') === -1), 'Platzhalter stehen geblieben');
    assert.ok(await bis(H, `!!${GS}.__konvoiDialog`, 300), 'keine Wahl nach der Waage');
    const w = H.run(`${GS}.__konvoiDialog.wahlen`);
    assert.strictEqual(w.length, 2);
    assert.strictEqual(H.run("window.Nachteskorte.getState().phase"), 'halt', 'der Karren faehrt waehrend der Wahl');
    H.run(`${GS}.__konvoiDialog.waehle(1)`);
    assert.ok(H.run("window.questSystem.hasFlag('eskorte_seite_gerissen')"), 'Flagge nicht gesetzt');
    assert.strictEqual(H.run("window.questSystem.hasFlag('eskorte_seite_gemerkt')"), false);
    assert.ok(await bis(H, `!!${GS}.__konvoiDialog`, 20));
    H.run(`${GS}.__konvoiDialog.waehle(0)`);
    assert.ok(await bis(H, "window.Nachteskorte.getState().phase === 'fahren'", 200), 'der Karren faehrt nicht weiter');
    // Kein zweites Mal.
    assert.strictEqual(H.run(`window.Nachteskorte.wahl(${GS})`), false);
  });

  test('Schacht: Gespraech, dann der eigene Abschluss mit Tableau; die Traeger sind fort', async () => {
    assert.ok(await mitlaufen(H, "window.Nachteskorte.getState().phase === 'halt' && window.Nachteskorte.getState().station === 2"),
      'der Karren kommt nicht am Schacht an');
    assert.ok(await zuhoeren(H, 'eskorte_schacht'), 'keine Szene am Schacht');
    const texte = await szeneDurchblaettern(H);
    assert.ok(texte.some((t) => /Wendeltreppe/.test(t)), texte.join(' | '));
    assert.ok(await bis(H, `!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'eskorte_abschluss')`, 300), 'kein Abschluss');
    assert.strictEqual(szeneTexte(H).tableau, 'spionbild_eskorte_abschluss');
    const ende = await szeneDurchblaettern(H, 'eskorte_abschluss');
    assert.strictEqual(ende.length, 3, ende.join(' | '));
    assert.ok(/Uniform.*Wendel Rusk/.test(ende[1]), 'die gerissene Seite fehlt im Abschluss: ' + ende[1]);
    assert.ok(await bis(H, `!${GS}.__spionSzene`, 300));
    const r = H.run(`(function () { var s = window.Nachteskorte.getState();
      return { phase: s.phase, fort: !s.teile.traeger1 && !s.teile.traeger2, fertig: window.questSystem.isQuestReadyToComplete('garde_night_escort') }; })()`);
    assert.deepStrictEqual(j(r), { phase: 'fertig', fort: true, fertig: true });
  });

  test('Abgabe setzt geleerte_gesehen; der Epilog erzaehlt Seite und Traeger', () => {
    const r = H.run(`(function () { var qs = window.questSystem; qs.completeQuest('garde_night_escort');
      var e = window.QuestFinale.epilog(qs.getFlags(), 'de').join(' ');
      var en = window.QuestFinale.epilog(qs.getFlags(), 'en').join(' ');
      return { flag: qs.hasFlag('geleerte_gesehen'), seite: /Register der Waage.*Wendel Rusk/.test(e), traeger: /Träger vom Schacht/.test(e),
        en: /register.*Wendel Rusk/.test(en) && /porters from the shaft/.test(en) }; })()`);
    assert.deepStrictEqual(j(r), { flag: true, seite: true, traeger: true, en: true });
  });

  test('alter Spielstand: escort_route wird zu den drei Stationen', () => {
    const r = H.run(`(function () { var qs = window.questSystem, d = qs.getQuestSaveData();
      var ziele = function () { return qs.getActiveQuests().filter(function (q) { return q.id === 'garde_night_escort'; })[0].objectives
        .map(function (o) { return o.target + ':' + o.current; }).join(','); };
      d.quests.garde_night_escort = { status: 'active', objectives: [{ type: 'observe', target: 'escort_route', current: 0, required: 1 }] };
      qs.loadQuestSaveData(d); var offen = ziele();
      d.quests.garde_night_escort = { status: 'active', objectives: [{ type: 'observe', target: 'escort_route', current: 1, required: 1 }] };
      qs.loadQuestSaveData(d); var fertig = ziele();
      return [offen, fertig, qs.isQuestReadyToComplete('garde_night_escort')]; })()`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), [
      'eskorte_verladung:0,eskorte_waage:0,eskorte_schacht:0',
      'eskorte_verladung:1,eskorte_waage:1,eskorte_schacht:1',
      true]);
  });

  test('erledigte Stationen zaehlen beim naechsten Betreten: der Karren wartet an der letzten', () => {
    const r = H.run(`(function () { var qs = window.questSystem, d = qs.getQuestSaveData();
      d.quests.garde_night_escort = { status: 'active', objectives: [
        { type: 'observe', target: 'eskorte_verladung', current: 1, required: 1 },
        { type: 'observe', target: 'eskorte_waage', current: 0, required: 1 },
        { type: 'observe', target: 'eskorte_schacht', current: 0, required: 1 }] };
      qs.loadQuestSaveData(d);
      var tpl = window.RoomTemplates.TEMPLATES.Umschlagstelle;
      window.EspionageSystem.startMission(${GS}, { observeZones: tpl.espionage.observe.map(function (o) {
        return { id: o.id, x: o.x * 32, y: o.y * 32, r: o.r, seconds: o.seconds, questTarget: o.questTarget, gesperrt: o.gesperrt }; }) });
      var s = window.Nachteskorte.starten(${GS}, tpl.espionage.eskorte, { x: 0, y: 0, tile: 32 });
      var z = window.EspionageSystem.getState().observeZones;
      return { phase: s.phase, station: s.station, done: z.map(function (o) { return !!o._done; }) }; })()`);
    assert.deepStrictEqual(j(r), { phase: 'warten', station: 0, done: [true, false, false] });
  });
});
