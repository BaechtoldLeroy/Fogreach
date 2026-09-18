// tests/ratssitzung.test.js — die oeffentliche Ratssitzung vor der geheimen (#159).
//
// Story-Bibel v5 / #150 Vorschlag 4: Die Scheindemokratie ZEIGEN. Zuerst
// streiten Magistrat, Klerus und Garde vor den Buergern im Ratssaal (Hub).
// Danach belauscht der Spieler die geheime Sitzung in der Ratskammer im
// Dungeon — mit dem Spionagesystem, nicht mit einer Fortschrittsleiste —,
// wo dieselben drei sich in zwei Saetzen einig sind. Die Quest hakt sich
// nicht mehr beim Annehmen ab (#147).

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { launch, launchDungeon } = require('../tools/headless/index.js');

const VORAUS = ['harren_daughter_investigation', 'magistrat_verification', 'klerus_purification',
  'garde_patrol_expansion', 'widerstand_proof',
  'faction_campaign'];   // #160: die Abstimmung, deren Ergebnis der Ratssaal verkuendet
const FERTIG = { status: 'completed', objectives: [] };
function vorausFertig() { const q = {}; VORAUS.forEach((id) => { q[id] = FERTIG; }); return q; }
function sitzung(oeffentlich, geheim) {
  return { status: 'active', objectives: [
    { type: 'observe', target: 'oeffentliche_sitzung', current: oeffentlich ? 1 : 0, required: 1 },
    { type: 'observe', target: 'collusion_reveal_seen', current: geheim ? 1 : 0, required: 1 }
  ] };
}

function standSetzen(H, quests, flags, akt) {
  H.run(`(function () {
    var qs = window.questSystem;
    window.storySystem.advanceToAct(${akt == null ? 1 : akt});
    var st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}

// --- Hub: der Ratssaal ------------------------------------------------------

test('Hub: Annehmen fuehrt in den Ratssaal, und die Quest ist danach NICHT fertig', async () => {
  const H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    standSetzen(H, vorausFertig(), { edikt_klerus: true }, 1);
    const r = H.run(`(function () {
      var sc = window.game.scene.getScene('HubSceneV2');
      var qs = window.questSystem;
      var gespielt = [];
      // Den vollen Text mitschreiben, wie er an den Wort-fuer-Wort-Aufbau geht.
      var texte = [];
      var echtTW = window.DialogTypewriter.anTextobjekt;
      window.DialogTypewriter.anTextobjekt = function (s, obj, voll) { texte.push(String(voll)); return echtTW.apply(this, arguments); };
      var echt = window.storyScenes.playOeffentlicheSitzung;
      window.storyScenes.playOeffentlicheSitzung = function (s, fertig) { gespielt.push('oeffentlich'); return echt.call(this, s, fertig); };
      // Die Auswahl am Ende der Szene sofort aufloesen.
      var echtWahl = window.DialogChoice.present;
      window.DialogChoice.present = function (s, cfg) { cfg.onResolved && cfg.onResolved(); };
      var harren = sc.npcs.filter(function (n) { return n.data && n.data.id === 'harren'; })[0].data;
      var q = qs.getAvailableQuests('harren').filter(function (x) { return x.id === 'council_collusion_reveal'; })[0];
      if (!q) return { fehler: 'nicht angeboten' };
      sc._handleDialogueChoice('accept', harren, 'Harren', [], 'offer', q, 0, null);
      var nachAnnahme = qs.isQuestReadyToComplete('council_collusion_reveal');
      for (var i = 0; i < 600; i++) sc.sys.game.loop.step(sc.sys.game.loop.now + 16.7 * (i + 1));
      window.DialogChoice.present = echtWahl;
      window.storyScenes.playOeffentlicheSitzung = echt;
      window.DialogTypewriter.anTextobjekt = echtTW;
      var aktiv = qs.getActiveQuests().filter(function (x) { return x.id === 'council_collusion_reveal'; })[0];
      return { gespielt: gespielt, nachAnnahme: nachAnnahme, text: texte.join('\\n'),
               ziele: aktiv ? aktiv.objectives.map(function (o) { return o.target + ':' + o.current; }) : null };
    })()`);
    assert.ok(!r.fehler, r.fehler);
    assert.strictEqual(JSON.stringify(r.gespielt), JSON.stringify(['oeffentlich']), 'der Ratssaal spielt nicht');
    assert.strictEqual(r.nachAnnahme, false, 'die Sitzung hakt sich beim Annehmen ab (#147)');
    // #160: Der Ratssaal verkuendet das Ergebnis der Abstimmung — das Edikt, das oben hing.
    assert.ok(/Gewonnen hat das Edikt des Klerus/.test(r.text), 'kein Ergebnis verkuendet: ' + r.text);
    assert.ok(/ganz oben hing/.test(r.text), 'kein Hinweis, dass es oben hing');
    assert.strictEqual(JSON.stringify(r.ziele), JSON.stringify(['oeffentliche_sitzung:1', 'collusion_reveal_seen:0']),
      'nach dem Ratssaal: ' + JSON.stringify(r.ziele));
  } finally { await H.shutdown(); }
});

test('Hub: der Ratssaal zeigt drei Pulte und die Buerger — es sieht aus wie eine Wahl', () => {
  // Inhalt der Szene, am Quelltext der echten Szene (voller Text, wie er an
  // den Wort-fuer-Wort-Aufbau geht).
  const quelle = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'storyScenes.js'), 'utf8');
  const teil = quelle.slice(quelle.indexOf('function playOeffentlicheSitzung'), quelle.indexOf('function playGeheimeSitzung'));
  ['MAGISTRAT:', 'KLERUS:', 'GARDE:', 'wie eine Wahl'].forEach((w) => assert.ok(teil.includes(w), 'fehlt: ' + w));
});

// --- Dungeon: die Ratskammer bei Nacht ----------------------------------------

let D = null;
test('Dungeon: vor dem Ratssaal liegt keine Ratskammer im Lauf', async () => {
  D = await launchDungeon({ depth: 5 });
  standSetzen(D, Object.assign(vorausFertig(), { council_collusion_reveal: sitzung(false, false) }), {}, 1);
  for (let i = 0; i < 10; i++) {
    const reihe = D.run(`(function () { initDungeonRun(); return dungeonRun.templateOrder.slice(); })()`);
    assert.ok(!reihe.includes('CouncilChamber'), 'Ratskammer schon vor der oeffentlichen Sitzung: ' + reihe.join(', '));
  }
});

test('Dungeon: Elaras Versteck verdraengt die Ratskammer nie', () => {
  // In Akt 1 ist nach widerstand_proof auch der erste Besuch im Versteck
  // faellig. Beide gehoeren in denselben Lauf — das Versteck ersetzte sonst
  // manchmal genau die Ratskammer (gemessen: sporadisch "keine Ratskammer").
  standSetzen(D, Object.assign(vorausFertig(), { council_collusion_reveal: sitzung(true, false) }), {}, 1);
  for (let i = 0; i < 30; i++) {
    const reihe = D.run(`(function () { initDungeonRun(); return dungeonRun.templateOrder.slice(); })()`);
    assert.ok(reihe.includes('CouncilChamber'), 'Lauf ohne Ratskammer: ' + reihe.join(', '));
    assert.ok(reihe.includes('ElarasVersteck'), 'Lauf ohne Versteck: ' + reihe.join(', '));
  }
});

function ratskammerBelauschen(flags) {
  standSetzen(D, Object.assign(vorausFertig(), { council_collusion_reveal: sitzung(true, false) }), flags, 1);
  return D.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    initDungeonRun();
    var i = dungeonRun.templateOrder.indexOf('CouncilChamber');
    if (i < 0) return { fehler: 'keine Ratskammer im Lauf: ' + dungeonRun.templateOrder.join(', ') };
    window.__texte = [];
    var echt = window.EventSystem.showEventChoiceDialog;
    window.EventSystem.showEventChoiceDialog = function (s, t) { window.__texte.push(String(t)); return echt.apply(this, arguments); };
    enterRoom(sc, i);
    var E = window.EspionageSystem;
    var aktiv = E.isActive();
    var zone = aktiv ? E.getState().observeZones[0] : null;
    var gegner = enemies.getChildren().filter(function (e) { return e && e.active; }).length;
    if (zone) {
      player.setPosition(zone.x, zone.y);
      // Wachen aus dem Spiel nehmen — geprueft wird das Belauschen, nicht das Schleichen.
      E.getState().guards.forEach(function (g) { g.knocked = true; });
      for (var k = 0; k < 40; k++) E.update(sc, 0, 200);
    }
    // Dialoge durchklicken
    for (var n = 0; n < 20 && window.eventChoiceOpen; n++) {
      var knopf = sc.children.list.filter(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled && o.active; })[0];
      if (!knopf) break;
      knopf.emit('pointerdown');
    }
    window.EventSystem.showEventChoiceDialog = echt;
    E.endMission();
    return { aktiv: aktiv, gegner: gegner, texte: window.__texte.slice(),
             bereit: window.questSystem.isQuestReadyToComplete('council_collusion_reveal') };
  })()`);
}

test('Dungeon: nach dem Ratssaal wird die Ratskammer zum Spionage-Raum, und die Sitzung spielt', () => {
  const r = ratskammerBelauschen({});
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.aktiv, true, 'in der Ratskammer startet keine Spionage');
  assert.strictEqual(r.gegner, 0, 'in der Ratskammer steht eine Welle Gegner');
  assert.ok(r.texte.some((t) => /Ratskammer bei Nacht/.test(t)), 'die geheime Sitzung spielt nicht: ' + JSON.stringify(r.texte));
  assert.ok(r.texte.some((t) => /Patrouillen verdoppeln/.test(t)), 'die drei sind sich nicht einig');
  assert.strictEqual(r.bereit, true, 'nach dem Belauschen ist die Quest nicht abgabebereit');
});

test('Dungeon: sie wissen, dass gewinnt, was oben haengt (#160)', () => {
  const mit = ratskammerBelauschen({ edikt_garde: true });
  assert.ok(!mit.fehler, mit.fehler);
  assert.ok(mit.texte.some((t) => /Wer oben hängt, gewinnt/.test(t)), JSON.stringify(mit.texte));
  assert.ok(mit.texte.some((t) => /Du hast es selbst aufgehängt/.test(t)));
  // Ohne Abstimmung (alter Stand) keine Zeile dazu.
  const ohne = ratskammerBelauschen({});
  assert.ok(!ohne.texte.some((t) => /Wer oben hängt/.test(t)));
});

test('Dungeon: wer gesiegelt hat, erkennt sein Siegel (#145)', () => {
  const r = ratskammerBelauschen({ verification_sealed: true });
  assert.ok(!r.fehler, r.fehler);
  assert.ok(r.texte.some((t) => /selbst unter ein Dokument gesetzt/.test(t)), JSON.stringify(r.texte));
});

test('Dungeon: wer verweigert hat, sieht Brankas Zeichen (#145)', async () => {
  const r = ratskammerBelauschen({ verification_refused: true });
  assert.ok(r.texte.some((t) => /Brankas Zeichen/.test(t)), JSON.stringify(r.texte));
  assert.ok(!r.texte.some((t) => /selbst unter ein Dokument/.test(t)));
});

test('Dungeon: alte Staende mit beiden Siegel-Flaggen gelten als verweigert (#145)', async () => {
  // magistrat_verification setzte frueher verification_sealed als Vorgabe —
  // auch bei Verweigerung. Solche Staende tragen beide Flaggen.
  const r = ratskammerBelauschen({ verification_refused: true, verification_sealed: true });
  assert.ok(r.texte.some((t) => /Brankas Zeichen/.test(t)), JSON.stringify(r.texte));
  await D.shutdown();
});
