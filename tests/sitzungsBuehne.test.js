// tests/sitzungsBuehne.test.js — die gemalte Buehne der Ratssitzungen (#166, #167).
//
// Beide Sitzungen spielen fest (ohne Flagge) auf PixelLab-Bildern statt
// gezeichneter Kaesten, die drei Sprecher sind sichtbar, und wer redet, tritt
// hervor. Ein Sprecher pro Seite; nach jeder Seite haelt die Szene an, bis der
// Spieler eine Taste drueckt. Text, Ablauf und Quest-Folgen bleiben gleich.
// Fehlt die Buehne, spielt die oeffentliche Sitzung auf den alten Kaesten —
// auch das ist hier geprueft. Die Flagge ?sitzung= ist nur noch die Vorschau.

const { test } = require('node:test');
const assert = require('node:assert');
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

/**
 * Wer sollte auf dieser Seite hervorgehoben sein? Erwartet als sortierte
 * Liste "figur:hell|still" — bei Erzaehlung alle hell.
 */
function erwarteteFiguren(H, text) {
  const wer = H.run(`window.SitzungsBuehne.sprecherAus(${JSON.stringify(text)})`);
  return ['aldric', 'garde', 'klerus'].map((n) => 'sitzung_' + n + ':' + (!wer || wer === n ? 'hell' : 'still'));
}

// --- Wer spricht? ------------------------------------------------------------

test('sprecherAus: der letzte Absatz entscheidet, Erzaehlung hebt niemanden hervor', () => {
  global.window = global.window || {};
  delete require.cache[require.resolve('../js/sitzungsBuehne.js')];
  require('../js/sitzungsBuehne.js');
  const s = global.window.SitzungsBuehne.sprecherAus;
  assert.strictEqual(s('(Der Ratssaal ist voll.)'), null);
  assert.strictEqual(s('MAGISTRAT: Die Stimmen'), 'aldric');
  assert.strictEqual(s('KLERUS: Die Patrouillen'), 'klerus');
  assert.strictEqual(s('GARDE: Wie'), 'garde');
  assert.strictEqual(s('CLERGY: x'), 'klerus');
  assert.strictEqual(s('GUARD: y'), 'garde');
  assert.strictEqual(s('ALDRIC: Und die Abstimmung? (Er lacht leise.) Wer oben'), 'aldric');
  // Ohne Gate keine Vorschau — die Buehne selbst haengt an keiner Flagge mehr.
  assert.strictEqual(global.window.SitzungsBuehne.vorschauArt(), null);
  assert.strictEqual(global.window.SitzungsBuehne.aktiv, undefined, 'aktiv() gibt es noch');
});

// --- Hub: die oeffentliche Sitzung ----------------------------------------------

/**
 * Spielt die oeffentliche Sitzung im Hub ab, Seite fuer Seite. An jeder Seite
 * wird gewartet, bis sie steht; dann vergehen 5 Sekunden OHNE Taste (die
 * Seite muss bleiben), dann kommt ein echter keydown auf die Tastatur.
 */
async function oeffentlichSpielen(H, ohneBuehne) {
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
    ${ohneBuehne ? 'window.__t.SB = window.SitzungsBuehne; delete window.SitzungsBuehne;' : ''}
    window.storyScenes.playOeffentlicheSitzung(sc, function () { window.__t.fertig = true; });
  })()`);
  // Die Bilder laden asynchron nach.
  await H.settle(() => H.run('!!window.__t.obj'), { maxRounds: 200, framesPerRound: 2 });
  const lies = () => H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var L = sc.children.list;
    var figuren = L.filter(function (o) { return o.texture && /^sitzung_(aldric|klerus|garde)$/.test(o.texture.key); });
    var lebt = window.__t.obj && window.__t.obj.scene;
    return {
      text: lebt ? window.__t.obj.text : '',
      seiten: window.__t.texte.length,
      haelt: !!sc.__szeneWartet,
      hinweis: L.some(function (o) { return o.type === 'Text' && /^(Taste drücken|Press any key)$/.test(o.text) && o.visible; }),
      bilder: L.filter(function (o) { return o.texture && /^sitzung_/.test(o.texture.key); }).map(function (o) { return o.texture.key; }),
      figuren: figuren.map(function (f) { return f.texture.key + ':' + (f.isTinted ? 'still' : 'hell'); }).sort(),
      groesster: figuren.slice().sort(function (a, b) { return b.scaleX - a.scaleX; }).map(function (f) { return f.texture.key + ':' + f.scaleX.toFixed(3); }),
      kaesten: L.filter(function (o) { return o.type === 'Graphics' && o.depth === 1548; }).length,
      fertig: window.__t.fertig
    };
  })()`);
  const seiten = [];
  for (let n = 0; n < 12 && !H.run('window.__t.fertig'); n++) {
    // Bis die Seite fertig geschrieben ist und die Szene haelt.
    const steht = () => H.run(`(function () {
      var o = window.__t.obj;
      return !!window.game.scene.getScene('HubSceneV2').__szeneWartet && !!o && !!o.scene
        && o.text === window.__t.texte[window.__t.texte.length - 1];
    })()`);
    for (let i = 0; i < 600 && !steht(); i++) H.step(3);
    assert.ok(steht(), 'Seite ' + n + ' haelt nie an');
    H.step(30);                                  // Hervorhebung einschwingen lassen
    const vor = lies();
    H.step(300);                                 // 5 Sekunden ohne Taste
    const nach = lies();
    seiten.push({ vor, bleibt: nach.text === vor.text && nach.seiten === vor.seiten && !nach.fertig });
    // Ein echter Tastendruck (Leertaste), ueber Phasers Tastatur.
    H.run(`window.game.scene.getScene('HubSceneV2').input.keyboard.emit('keydown', { key: ' ', keyCode: 32, repeat: false })`);
    H.step(2);
  }
  const ende = lies();
  const rest = H.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    window.DialogTypewriter.anTextobjekt = window.__t.echtTW;
    window.DialogChoice.present = window.__t.echtWahl;
    if (window.__t.SB) window.SitzungsBuehne = window.__t.SB;
    var q = window.questSystem.getActiveQuests().filter(function (x) { return x.id === 'council_collusion_reveal'; })[0];
    return { fertig: window.__t.fertig, texte: window.__t.texte,
             updatesVorher: window.__t.updates, updatesNachher: sc.events.listenerCount('update'),
             ziele: q ? q.objectives.map(function (o) { return o.target + ':' + o.current; }) : null,
             erwartet: window.storyScenes.sitzungSeiten('oeffentlich') };
  })()`);
  return { seiten, ende, rest };
}

test('Hub ohne Flagge (#166): Ratssaal als Bild, ein Sprecher pro Seite, Halt bis zur Taste', async () => {
  const H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    const r = await oeffentlichSpielen(H, false);
    // Seite fuer Seite, genau die erwarteten Seiten (mit Abstimmung: 6).
    assert.strictEqual(JSON.stringify(r.rest.texte), JSON.stringify(r.rest.erwartet), 'die Seiten weichen ab');
    assert.strictEqual(r.seiten.length, 6, 'nicht sechs Seiten: ' + r.seiten.length);
    r.seiten.forEach((s, i) => {
      const v = s.vor;
      assert.ok(v.bilder.includes('sitzung_saal'), 'Seite ' + i + ': kein Ratssaal-Bild: ' + v.bilder);
      ['sitzung_pult_magistrat', 'sitzung_pult_klerus', 'sitzung_pult_garde', 'sitzung_menge'].forEach((k) =>
        assert.ok(v.bilder.includes(k), 'Seite ' + i + ': fehlt ' + k));
      assert.strictEqual(v.kaesten, 0, 'Seite ' + i + ': die alten Kaesten liegen noch darunter');
      assert.ok(v.hinweis, 'Seite ' + i + ': kein Hinweis "Taste drücken"');
      assert.ok(s.bleibt, 'Seite ' + i + ' lief ohne Taste weiter');
      // Genau der Sprecher dieser Seite tritt hervor.
      assert.strictEqual(JSON.stringify(v.figuren), JSON.stringify(erwarteteFiguren(H, v.text)),
        'Seite ' + i + ' (' + v.text.slice(0, 30) + '): falsche Hervorhebung');
    });
    // Klerus spricht: er ist groesser als die anderen.
    const klerus = r.seiten.filter((s) => /^KLERUS:/.test(s.vor.text))[0];
    assert.ok(klerus, 'KLERUS kam nie an die Reihe');
    assert.ok(/^sitzung_klerus:/.test(klerus.vor.groesster[0]), 'der Sprecher tritt nicht hervor: ' + klerus.vor.groesster);
    // Danach ist die Buehne abgeraeumt, und nichts haengt mehr am Update.
    assert.strictEqual(r.ende.bilder.length, 0, 'Buehne nicht abgeraeumt: ' + r.ende.bilder);
    assert.strictEqual(r.rest.updatesNachher, r.rest.updatesVorher, 'Mitleser haengt noch am Update');
    assert.strictEqual(r.rest.fertig, true);
    assert.strictEqual(JSON.stringify(r.rest.ziele), JSON.stringify(['oeffentliche_sitzung:1', 'collusion_reveal_seen:0']));
    assert.ok(/Gewonnen hat das Edikt des Klerus/.test(r.rest.texte.join('\n')));
  } finally { await H.shutdown(); }
});

test('Hub ohne Buehne: Rueckfall auf die Kaesten, ebenfalls Seite fuer Seite', async () => {
  const H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    const r = await oeffentlichSpielen(H, true);
    assert.strictEqual(JSON.stringify(r.rest.texte), JSON.stringify(r.rest.erwartet), 'die Seiten weichen ab');
    assert.strictEqual(r.seiten.length, 6);
    r.seiten.forEach((s, i) => {
      assert.strictEqual(s.vor.bilder.length, 0, 'Seite ' + i + ': Bilder der Buehne ohne Buehne');
      assert.ok(s.vor.kaesten >= 1, 'Seite ' + i + ': die gezeichnete Kulisse fehlt');
      assert.ok(s.bleibt, 'Seite ' + i + ' lief ohne Taste weiter');
    });
    assert.strictEqual(r.ende.kaesten, 0, 'Kaesten nicht abgeraeumt');
    assert.strictEqual(r.rest.fertig, true);
    assert.strictEqual(JSON.stringify(r.rest.ziele), JSON.stringify(['oeffentliche_sitzung:1', 'collusion_reveal_seen:0']));
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

test('Dungeon (fest, #167): die drei am Tisch, ein Sprecher pro Seite, weiter erst per Taste', async () => {
  const D = await launchDungeon({ depth: 5 });
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
    // Weiter abwechselnd mit E, Leertaste und dem Knopf.
    const wege = ['E', 'SPACE', 'KNOPF'];
    for (let n = 0; n < 12 && D.run('!!window.eventChoiceOpen'); n++) {
      // Den Aufbau ueberspringen (Klick auf die Abdunklung), dann ansehen.
      D.step(2);
      D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        var dunkel = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2500 && o.active; })[0];
        if (dunkel) dunkel.emit('pointerdown');
      })()`);
      for (let k = 0; k < 20; k++) { D.step(1); await flush(); }
      const lies = () => D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        var L = sc.children.list;
        var figuren = L.filter(function (o) { return o.texture && /^sitzung_(aldric|klerus|garde)$/.test(o.texture.key) && o.visible; });
        var titel = L.filter(function (o) { return o.type === 'Text' && o.depth === 2501; })[0];
        var kopfUnten = Math.max.apply(null, figuren.map(function (f) { return f.y - f.displayHeight * 0.6; }));
        return { figuren: figuren.map(function (f) { return f.texture.key + ':' + (f.isTinted ? 'still' : 'hell'); }).sort(),
                 kammer: L.some(function (o) { return o.texture && o.texture.key === 'sitzung_kammer'; }),
                 tisch: L.some(function (o) { return o.texture && o.texture.key === 'sitzung_tisch'; }),
                 grossesZeichen: L.some(function (o) { return o.texture && o.texture.key === (window.Zeichen && window.Zeichen.KEY) && o.displayWidth >= 60; }),
                 weiter: L.some(function (o) { return o.type === 'Text' && o.depth === 2503 && /^(Weiter|Continue)$/.test(o.text); }),
                 offen: !!window.eventChoiceOpen, zahl: window.__texte.length,
                 text: titel ? titel.text : '', titelOben: titel ? titel.getBounds().top : -1, kopfUnten: kopfUnten };
      })()`);
      const vor = lies();
      for (let k = 0; k < 60; k++) { D.step(5); await flush(); }   // ~5 Sekunden ohne Taste
      const nach = lies();
      vor.bleibt = nach.offen && nach.zahl === vor.zahl && nach.text === vor.text;
      seiten.push(vor);
      const weg = wege[n % wege.length];
      vor.weg = weg;
      D.run(`(function () {
        var sc = window.game.scene.getScene('GameScene');
        if (${JSON.stringify(weg)} === 'KNOPF') {
          var knopf = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
          if (knopf) knopf.emit('pointerdown');
        } else {
          sc.input.keyboard.emit('keydown-' + ${JSON.stringify(weg)}, { repeat: false });
        }
      })()`);
      await D.settle(() => true, { maxRounds: 2, framesPerRound: 2 });
      vor.danach = D.run('window.__texte.length');
    }
    const ende = D.run(`(function () {
      var sc = window.game.scene.getScene('GameScene');
      window.EventSystem.showEventChoiceDialog = window.__echt;
      var r = { texte: window.__texte.slice(),
        reste: sc.children.list.filter(function (o) { return o.texture && /^sitzung_/.test(o.texture.key); }).length,
        pausiert: window.__GAME_PAUSE.since != null,
        bereit: window.questSystem.isQuestReadyToComplete('council_collusion_reveal'),
        erwartet: window.storyScenes.sitzungSeiten('geheim') };
      window.EspionageSystem.endMission();
      return r;
    })()`);

    // Mit Abstimmung, ohne Siegel-Entscheidung: 7 Seiten.
    assert.strictEqual(JSON.stringify(ende.texte), JSON.stringify(ende.erwartet), 'die Seiten weichen ab');
    assert.strictEqual(seiten.length, 7, 'nicht sieben Seiten: ' + seiten.length);
    seiten.forEach((s, i) => {
      assert.ok(s.kammer && s.tisch, 'Seite ' + i + ': Kammer oder Tisch fehlt');
      assert.strictEqual(s.figuren.length, 3, 'Seite ' + i + ': nicht alle drei zu sehen: ' + s.figuren);
      assert.strictEqual(s.grossesZeichen, false, 'Seite ' + i + ': das grosse Zeichen liegt ueber der Buehne');
      assert.ok(s.titelOben > s.kopfUnten, 'Seite ' + i + ': der Dialog liegt ueber den Figuren (' + s.titelOben + ' <= ' + s.kopfUnten + ')');
      assert.ok(s.weiter, 'Seite ' + i + ': kein Knopf "Weiter"');
      assert.ok(s.bleibt, 'Seite ' + i + ' lief ohne Taste weiter');
      // Genau der Sprecher dieser Seite tritt hervor.
      assert.strictEqual(JSON.stringify(s.figuren), JSON.stringify(erwarteteFiguren(D, s.text)),
        'Seite ' + i + ' (' + s.text.slice(0, 30) + '): falsche Hervorhebung');
      // Die Taste schaltet genau eine Seite weiter (bzw. beendet die letzte).
      const soll = i < seiten.length - 1 ? s.zahl + 1 : s.zahl;
      assert.strictEqual(s.danach, soll, 'Seite ' + i + ': ' + s.weg + ' schaltet nicht weiter');
    });
    // Die Einigung: jeder der drei auf eigener Seite, jeweils allein im Licht.
    ['aldric', 'klerus', 'garde'].forEach((n) => {
      assert.ok(seiten.some((s) => JSON.stringify(s.figuren) === JSON.stringify(['aldric', 'garde', 'klerus']
        .map((m) => 'sitzung_' + m + ':' + (m === n ? 'hell' : 'still')))), n + ' spricht nie allein');
    });
    assert.strictEqual(JSON.stringify(seiten[0].figuren), JSON.stringify(['sitzung_aldric:hell', 'sitzung_garde:hell', 'sitzung_klerus:hell']));
    assert.ok(ende.texte.some((t) => /Wer oben hängt, gewinnt/.test(t)));
    assert.strictEqual(ende.reste, 0, 'die Buehne bleibt nach der Sitzung stehen');
    assert.strictEqual(ende.pausiert, false, 'die Spieluhr bleibt angehalten');
    assert.strictEqual(ende.bereit, true, 'nach dem Belauschen ist die Quest nicht abgabebereit');
  } finally { await D.shutdown(); }
});
