// tests/sitzungsBuehne.test.js — die gemalte Buehne der Ratssitzungen (#166, #167).
//
// Hinter der Flagge ?sitzung= zeigen die oeffentliche und die geheime Sitzung
// PixelLab-Bilder statt gezeichneter Kaesten, die drei Sprecher sind sichtbar,
// und wer redet, tritt hervor. Text, Ablauf und Quest-Folgen bleiben gleich.
// Ohne Flagge laeuft alles wie vorher — auch das ist hier geprueft.

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const VORAUS = ['harren_daughter_investigation', 'magistrat_verification', 'klerus_purification',
  'garde_patrol_expansion', 'widerstand_proof', 'faction_campaign'];
const FERTIG = { status: 'completed', objectives: [] };
function vorausFertig() { const q = {}; VORAUS.forEach((id) => { q[id] = FERTIG; }); return q; }
function sitzung(oeffentlich) {
  return { status: 'active', objectives: [
    { type: 'observe', target: 'oeffentliche_sitzung', current: oeffentlich ? 1 : 0, required: 1 },
    { type: 'observe', target: 'collusion_reveal_seen', current: 0, required: 1 }
  ] };
}
function standSetzen(H, quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(1);
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const flush = () => new Promise((r) => setTimeout(r, 0));

// --- Wer spricht? ------------------------------------------------------------

test('sprecherAus: der letzte Absatz entscheidet, Erzaehlung hebt niemanden hervor', () => {
  global.window = global.window || {};
  delete require.cache[require.resolve('../js/sitzungsBuehne.js')];
  require('../js/sitzungsBuehne.js');
  const s = global.window.SitzungsBuehne.sprecherAus;
  assert.strictEqual(s('(Der Ratssaal ist voll.)'), null);
  assert.strictEqual(s('(Der Ratssaal.)\n\nMAGISTRAT: Die Stimmen'), 'aldric');
  assert.strictEqual(s('ALDRIC: Solange\n\nKLERUS: Die Patrouillen'), 'klerus');
  assert.strictEqual(s('ALDRIC: x\n\nKLERUS: y\n\nGARDE: Wie'), 'garde');
  assert.strictEqual(s('CLERGY: x\n\nGUARD: y'), 'garde');
  assert.strictEqual(s('ALDRIC: Und die Abstimmung? (Er lacht leise.)\n\n(Du hast es'), null);
  // Ohne Gate keine Buehne — auch wenn die Datei geladen ist.
  assert.strictEqual(global.window.SitzungsBuehne.aktiv(), false);
});

// --- Hub: die oeffentliche Sitzung ----------------------------------------------

/**
 * Spielt die oeffentliche Sitzung im Hub ab und gibt zurueck, was dabei zu
 * sehen war. Der Text wird mitgeschrieben, wie er an den Aufbau geht.
 */
async function oeffentlichSpielen(H) {
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  standSetzen(H, Object.assign(vorausFertig(), { council_collusion_reveal: sitzung(false) }), { edikt_klerus: true });
  H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.__t = { texte: [], fertig: false, updates: sc.events.listenerCount('update') };
    var echtTW = window.DialogTypewriter.anTextobjekt;
    window.DialogTypewriter.anTextobjekt = function (s, obj, voll) { window.__t.texte.push(String(voll)); window.__t.obj = obj; return echtTW.apply(this, arguments); };
    window.__t.echtTW = echtTW;
    window.__t.echtWahl = window.DialogChoice.present;
    window.DialogChoice.present = function (s, cfg) { cfg.onResolved && cfg.onResolved(); };
    window.storyScenes.playOeffentlicheSitzung(sc, function () { window.__t.fertig = true; });
  })()`);
  // Die Bilder laden asynchron nach (nur mit Flagge).
  await H.settle(() => H.run('!!window.__t.obj'), { maxRounds: 200, framesPerRound: 2 });
  const lies = () => H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var figuren = sc.children.list.filter(function (o) { return o.texture && /^sitzung_(aldric|klerus|garde)$/.test(o.texture.key); });
    return {
      text: window.__t.obj ? window.__t.obj.text : '',
      bilder: sc.children.list.filter(function (o) { return o.texture && /^sitzung_/.test(o.texture.key); }).map(function (o) { return o.texture.key; }),
      figuren: figuren.map(function (f) { return { key: f.texture.key, tint: f.isTinted, scale: f.scaleX, y: f.y }; }),
      kaesten: sc.children.list.filter(function (o) { return o.type === 'Graphics' && o.depth === 1548; }).length
    };
  })()`);
  const anfang = lies();
  // Takten, bis KLERUS spricht, dann bis seine Hervorhebung steht.
  let klerus = null;
  for (let i = 0; i < 1000 && !klerus; i++) {
    H.step(2);
    const t = H.run('window.__t.obj ? window.__t.obj.text : ""');
    if (/\n\nKLERUS: [^\n]*$/.test(t)) { H.step(2); klerus = lies(); }
  }
  // Weiterwinken, sobald der Halt steht.
  for (let i = 0; i < 600 && !H.run('window.__t.fertig'); i++) {
    H.step(5);
    H.run(`(function(){ var sc = window.game.scene.getScene('HubSceneV2'); if (sc.__szeneWartet) sc.__szeneWartet.ausloesen(); })()`);
  }
  const ende = lies();
  const rest = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.DialogTypewriter.anTextobjekt = window.__t.echtTW;
    window.DialogChoice.present = window.__t.echtWahl;
    var q = window.questSystem.getActiveQuests().filter(function (x) { return x.id === 'council_collusion_reveal'; })[0];
    return { fertig: window.__t.fertig, texte: window.__t.texte,
             updatesVorher: window.__t.updates, updatesNachher: sc.events.listenerCount('update'),
             ziele: q ? q.objectives.map(function (o) { return o.target + ':' + o.current; }) : null };
  })()`);
  return { anfang, klerus, ende, rest };
}

let TEXT_OHNE = null;

test('Hub ohne Flagge: die Ratssitzung wie bisher (Kaesten, keine Bilder)', async () => {
  const H = await launch({ search: '?debug=1&autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    const r = await oeffentlichSpielen(H);
    assert.strictEqual(H.run('window.SitzungsBuehne.aktiv()'), false);
    assert.strictEqual(r.anfang.bilder.length, 0, 'ohne Flagge Bilder der Buehne: ' + r.anfang.bilder);
    assert.ok(r.anfang.kaesten >= 1, 'die gezeichnete Kulisse fehlt');
    assert.strictEqual(H.run(`window.game.textures.exists('sitzung_saal')`), false, 'ohne Flagge wird nachgeladen');
    assert.strictEqual(r.rest.fertig, true);
    assert.strictEqual(JSON.stringify(r.rest.ziele), JSON.stringify(['oeffentliche_sitzung:1', 'collusion_reveal_seen:0']));
    TEXT_OHNE = r.rest.texte;
  } finally { await H.shutdown(); }
});

test('Hub mit ?sitzung=neu: Ratssaal als Bild, drei Sprecher, der Redende tritt hervor', async () => {
  const H = await launch({ search: '?debug=1&autostart=1&sitzung=neu', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    // sitzung=neu spielt nichts von selbst (das tun nur oeffentlich/geheim).
    H.step(60);
    assert.strictEqual(H.run(`window.game.scene.getScene('HubSceneV2').children.list.filter(function (o) { return o.texture && o.texture.key === 'sitzung_saal'; }).length`), 0);
    const r = await oeffentlichSpielen(H);
    assert.ok(r.anfang.bilder.includes('sitzung_saal'), 'kein Ratssaal-Bild: ' + r.anfang.bilder);
    ['sitzung_pult_magistrat', 'sitzung_pult_klerus', 'sitzung_pult_garde', 'sitzung_menge'].forEach((k) =>
      assert.ok(r.anfang.bilder.includes(k), 'fehlt: ' + k));
    assert.strictEqual(JSON.stringify(r.anfang.figuren.map((f) => f.key).sort()), JSON.stringify(['sitzung_aldric', 'sitzung_garde', 'sitzung_klerus']));
    assert.strictEqual(r.anfang.kaesten, 0, 'die alten Kaesten liegen noch darunter');
    // Klerus spricht: er ungetoent und groesser, die anderen gedimmt.
    assert.ok(r.klerus, 'KLERUS kam nie an die Reihe');
    const f = {}; r.klerus.figuren.forEach((x) => { f[x.key] = x; });
    assert.strictEqual(f.sitzung_klerus.tint, false, 'der Sprecher ist gedimmt');
    assert.strictEqual(f.sitzung_aldric.tint, true, 'Aldric schweigt, ist aber nicht gedimmt');
    assert.strictEqual(f.sitzung_garde.tint, true, 'die Garde schweigt, ist aber nicht gedimmt');
    assert.ok(f.sitzung_klerus.scale > f.sitzung_aldric.scale, 'der Sprecher tritt nicht hervor');
    // Danach ist die Buehne abgeraeumt, und nichts haengt mehr am Update.
    assert.strictEqual(r.ende.bilder.length, 0, 'Buehne nicht abgeraeumt: ' + r.ende.bilder);
    assert.strictEqual(r.rest.updatesNachher, r.rest.updatesVorher, 'Mitleser haengt noch am Update');
    // Ablauf und Folgen wie ohne Flagge.
    assert.strictEqual(r.rest.fertig, true);
    assert.strictEqual(JSON.stringify(r.rest.ziele), JSON.stringify(['oeffentliche_sitzung:1', 'collusion_reveal_seen:0']));
    if (TEXT_OHNE) assert.strictEqual(JSON.stringify(r.rest.texte), JSON.stringify(TEXT_OHNE), 'der Text weicht ab');
    assert.ok(/Gewonnen hat das Edikt des Klerus/.test(r.rest.texte.join('\n')));
  } finally { await H.shutdown(); }
});

test('Hub mit ?sitzung=oeffentlich: die Szene spielt gleich nach dem Betreten (Vorschau)', async () => {
  const H = await launch({ search: '?debug=1&autostart=1&sitzung=oeffentlich', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    const da = await H.settle(() => H.run(`window.game.scene.getScene('HubSceneV2').children.list.some(function (o) { return o.texture && o.texture.key === 'sitzung_saal'; })`),
      { maxRounds: 200, framesPerRound: 5 });
    assert.ok(da, 'die Vorschau spielt den Ratssaal nicht');
  } finally { await H.shutdown(); }
});

// --- Dungeon: die geheime Sitzung ---------------------------------------------------

test('Dungeon mit ?sitzung=neu: die drei sitzen sichtbar am Tisch, der Dialog darunter', async () => {
  const D = await launchDungeon({ depth: 5, zusatz: '&sitzung=neu' });
  try {
    standSetzen(D, Object.assign(vorausFertig(), { council_collusion_reveal: sitzung(true) }), { edikt_garde: true });
    const start = D.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      initDungeonRun();
      var i = dungeonRun.templateOrder.indexOf('CouncilChamber');
      if (i < 0) return { fehler: 'keine Ratskammer' };
      window.__texte = [];
      window.__echt = window.EventSystem.showEventChoiceDialog;
      window.EventSystem.showEventChoiceDialog = function (s, t) { window.__texte.push(String(t)); return window.__echt.apply(this, arguments); };
      enterRoom(sc, i);
      var E = window.EspionageSystem;
      var zone = E.getState().observeZones[0];
      player.setPosition(zone.x, zone.y);
      E.getState().guards.forEach(function (g) { g.knocked = true; });
      for (var k = 0; k < 40; k++) E.update(sc, 0, 200);
      return { pausiert: window.__GAME_PAUSE.since != null };
    })()`);
    assert.ok(!start.fehler, start.fehler);
    assert.strictEqual(start.pausiert, true, 'waehrend die Bilder laden, laeuft das Spiel weiter');
    assert.ok(await D.settle(() => D.run('!!window.eventChoiceOpen'), { maxRounds: 200, framesPerRound: 2 }), 'kein Dialog');
    const seiten = [];
    for (let n = 0; n < 12 && D.run('!!window.eventChoiceOpen'); n++) {
      // Den Aufbau ueberspringen (Klick auf die Abdunklung), dann ansehen.
      D.step(2);
      D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        var dunkel = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2500 && o.active; })[0];
        if (dunkel) dunkel.emit('pointerdown');
      })()`);
      for (let k = 0; k < 4; k++) { D.step(1); await flush(); }
      seiten.push(D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        var L = sc.children.list;
        var figuren = L.filter(function (o) { return o.texture && /^sitzung_(aldric|klerus|garde)$/.test(o.texture.key) && o.visible; });
        var titel = L.filter(function (o) { return o.type === 'Text' && o.depth === 2501; })[0];
        var kopfUnten = Math.max.apply(null, figuren.map(function (f) { return f.y - f.displayHeight * 0.6; }));
        return { figuren: figuren.map(function (f) { return f.texture.key + ':' + (f.isTinted ? 'still' : 'hell'); }).sort(),
                 kammer: L.some(function (o) { return o.texture && o.texture.key === 'sitzung_kammer'; }),
                 tisch: L.some(function (o) { return o.texture && o.texture.key === 'sitzung_tisch'; }),
                 grossesZeichen: L.some(function (o) { return o.texture && o.texture.key === (window.Zeichen && window.Zeichen.KEY) && o.displayWidth >= 60; }),
                 text: titel ? titel.text : '', titelOben: titel ? titel.getBounds().top : -1, kopfUnten: kopfUnten };
      })()`));
      D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        var knopf = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
        if (knopf) knopf.emit('pointerdown');
      })()`);
      await D.settle(() => true, { maxRounds: 2, framesPerRound: 2 });
    }
    const ende = D.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      window.EventSystem.showEventChoiceDialog = window.__echt;
      var r = { texte: window.__texte.slice(),
        reste: sc.children.list.filter(function (o) { return o.texture && /^sitzung_/.test(o.texture.key); }).length,
        pausiert: window.__GAME_PAUSE.since != null,
        bereit: window.questSystem.isQuestReadyToComplete('council_collusion_reveal') };
      window.EspionageSystem.endMission();
      return r;
    })()`);

    assert.ok(seiten.length >= 3, 'zu wenige Seiten: ' + seiten.length);
    seiten.forEach((s, i) => {
      assert.ok(s.kammer && s.tisch, 'Seite ' + i + ': Kammer oder Tisch fehlt');
      assert.strictEqual(s.figuren.length, 3, 'Seite ' + i + ': nicht alle drei zu sehen: ' + s.figuren);
      assert.strictEqual(s.grossesZeichen, false, 'Seite ' + i + ': das grosse Zeichen liegt ueber der Buehne');
      assert.ok(s.titelOben > s.kopfUnten, 'Seite ' + i + ': der Dialog liegt ueber den Figuren (' + s.titelOben + ' <= ' + s.kopfUnten + ')');
    });
    // Seite 2: alle drei sprechen; am Ende des Aufbaus die Garde.
    const einig = seiten.filter((s) => /Patrouillen verdoppeln/.test(s.text))[0];
    assert.ok(einig, 'die Einigung kam nicht: ' + JSON.stringify(seiten));
    assert.strictEqual(JSON.stringify(einig.figuren), JSON.stringify(['sitzung_aldric:still', 'sitzung_garde:hell', 'sitzung_klerus:still']));
    // Seite 1 ist Erzaehlung: niemand gedimmt.
    assert.strictEqual(JSON.stringify(seiten[0].figuren), JSON.stringify(['sitzung_aldric:hell', 'sitzung_garde:hell', 'sitzung_klerus:hell']));
    // Text und Folgen wie ohne Flagge (tests/ratssitzung.test.js prueft denselben Weg ohne).
    assert.ok(ende.texte.some((t) => /Ratskammer bei Nacht/.test(t)));
    assert.ok(ende.texte.some((t) => /Wer oben hängt, gewinnt/.test(t)));
    assert.strictEqual(ende.texte.length, seiten.length);
    assert.strictEqual(ende.reste, 0, 'die Buehne bleibt nach der Sitzung stehen');
    assert.strictEqual(ende.pausiert, false, 'die Spieluhr bleibt angehalten');
    assert.strictEqual(ende.bereit, true, 'nach dem Belauschen ist die Quest nicht abgabebereit');
  } finally { await D.shutdown(); }
});
