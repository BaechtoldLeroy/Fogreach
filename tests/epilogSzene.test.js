// tests/epilogSzene.test.js — der Epilog als Bildfolge (js/epilogSzene.js).
//
// Gemeldet: der Epilog lief fast nur als Text mit einem einzigen Bild. Jetzt
// erzaehlt er auf PixelLab-Tableaus, und die Bilder folgen dem Ausgang wie
// der Text: Elara lebt oder ist tot, Harrens Grab, Aldric erzaehlt oder
// verschwiegen, der Platz mit Verbuendeten oder leer. Geprueft:
//   - jede Variante bekommt die passenden Bilder, kein Text geht verloren
//   - die Bilder liegen da, 384x192, ohne Text-Metadaten
//   - am echten Hub: Thom legt die Platten, der Hebel startet die Bildfolge
//     (nicht mehr den ganzen Text im Dialog); Uhr steht, Bilder geladen,
//     erste Taste zeigt den Satz ganz, die naechste blaettert, ESC beendet
//   - ?epilog=<variante> baut die Debug-Flaggen

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

const HUB = "window.game.scene.getScene('HubSceneV2')";
const Z = `${HUB}.__epilog`;
const ORDNER = path.join(__dirname, '..', 'assets', 'sprites', 'epilog');
let H = null;

before(async () => {
  H = await launch({ search: '?autostart=1', renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'HubSceneV2 wurde nicht erreicht');
  H.step(10);
  H.run(`(function () { var sc = ${HUB}; var k = sc.children.getByName('aktwechsel');
    if (k) { sc.input.keyboard.emit('keydown-ESC'); } sc._dialogOpen = false; })()`);
  H.step(5);
});
after(async () => { if (H) await H.shutdown(); });

function bis(js, max) {
  for (let i = 0; i < (max || 400); i++) {
    if (H.run(js)) return true;
    H.step(3);
  }
  return !!H.run(js);
}
const taste = (k) => H.run(`${HUB}.input.keyboard.emit('keydown', { key: '${k}', keyCode: ${k === 'Escape' ? 27 : 32}, repeat: false })`);
const status = () => H.run(`(function () { var z = ${Z}; if (!z) return null;
  return { phase: z.phase, seite: z.seite, bild: z.bild, laeuft: !!(z.lauf && z.lauf.laeuft()),
    text: (function () { var c = ${HUB}.children.getByName('epilog'), r = null;
      (function lauf(l) { l.forEach(function (o) { if (o.name === 'epilogText') r = o.text; if (o.list) lauf(o.list); }); })(c ? c.list : []);
      return r; })() }; })()`);

/** Die Bilder (in Reihenfolge, ohne Wiederholung) fuer einen Flaggen-Stand. */
function bilderFuer(flags, lang) {
  return H.run(`(function () { var out = [];
    window.EpilogSzene.seiten(${JSON.stringify(flags)}, '${lang || 'de'}').forEach(function (s) {
      if (out[out.length - 1] !== s.bild) out.push(s.bild); });
    return out.join(','); })()`).split(',');
}

test('Jeder Ausgang bekommt seine Bilder', () => {
  const lebt = bilderFuer({ harren_dead: true, elara_spared: true, verification_refused: true, aldric_erzaehlt: true });
  assert.deepStrictEqual(lebt, ['presse', 'nebel', 'grab', 'elara_lebt', 'rueckkehr', 'platz_voll', 'aldric_erzaehlt', 'schmiede']);
  const tot = bilderFuer({ elara_killed: true, aldric_verschwiegen: true });
  assert.deepStrictEqual(tot, ['presse', 'nebel', 'elara_tot', 'rueckkehr', 'platz_leer', 'aldric_verschwiegen', 'schmiede'],
    'ohne Harrens Tod kein Grab, ohne Verbuendete der leere Platz');
  // Mara fort (Konvoi), aber Thom bleibt: der Platz ist nicht leer.
  const thom = bilderFuer({ convoy_blown: true, thom_ally: true });
  assert.ok(thom.indexOf('platz_voll') >= 0 && thom.indexOf('platz_leer') < 0, thom.join(','));
  // Ohne die Wahl in der letzten Wache: kein Aldric-Bild.
  const ohne = bilderFuer({});
  assert.ok(!ohne.some((b) => /^aldric/.test(b)), ohne.join(','));
  assert.deepStrictEqual(Array.from(new Set(lebt.concat(tot))).length, 11, 'alle elf Bilder kommen vor');
});

test('Kein Text geht verloren (DE + EN), Seiten bleiben kurz', () => {
  const faelle = [{}, { harren_dead: true, elara_spared: true, petitions_kept: true, convoy_blade_drawn: true,
    geleerte_gesehen: true, phiolen_gebunden: true, verification_refused: true, thom_ally: true,
    wachtmeister_wahrheit: true, aldric_erzaehlt: true, nachhall_namen: ['Ada', 'Bero'], self_remembered: true }];
  for (const lang of ['de', 'en']) {
    for (const f of faelle) {
      const r = H.run(`(function () { var f = ${JSON.stringify(f)};
        return { s: window.EpilogSzene.seiten(f, '${lang}').map(function (x) { return x.text; }),
          ganz: window.QuestFinale.epilog(f, '${lang}') }; })()`);
      assert.strictEqual(r.s.join(' '), r.ganz.join(' '), lang + ': Text verloren');
      assert.ok(r.s.every((t) => t.length <= 260), lang + ': zu lange Seite');
    }
  }
});

test('Die Bilder liegen da: 384x192, ohne Text-Metadaten', () => {
  const namen = H.run('window.EpilogSzene.BILDER.slice()');
  assert.strictEqual(namen.length, 11);
  for (const n of namen) {
    const p = path.join(ORDNER, 'epilog_' + n + '.png');
    assert.ok(fs.existsSync(p), 'fehlt: ' + p);
    const b = fs.readFileSync(p);
    assert.strictEqual(b.readUInt32BE(16), 384, n + ' Breite');
    assert.strictEqual(b.readUInt32BE(20), 192, n + ' Hoehe');
    let o = 8;
    while (o < b.length) {
      const len = b.readUInt32BE(o), typ = b.toString('latin1', o + 4, o + 8);
      assert.ok(!/^(tEXt|iTXt|zTXt|eXIf)$/.test(typ), n + ' traegt Metadaten: ' + typ);
      o += 12 + len;
      if (typ === 'IEND') break;
    }
  }
});

test('Hub: Thom legt die Platten, der Hebel startet die Bildfolge', () => {
  const r = H.run(`(function () {
    var qs = window.questSystem, sc = ${HUB};
    var quests = {};
    Object.keys(qs.QUEST_DEFINITIONS).forEach(function (id) { quests[id] = { status: 'completed', objectives: [] }; });
    quests.the_reckoning = { status: 'available', objectives: null };
    qs.loadQuestSaveData({ storyVersion: qs.STORY_VERSION, quests: quests,
      flags: { harren_dead: true, elara_killed: true, aldric_verschwiegen: true } });
    window.storySystem.advanceToAct(4);
    while (window.storySystem.consumePendingEvent()) {}
    sc._dialogOpen = false;
    window.__seiten = null;
    var echt = sc._showDialoguePages;
    sc._showDialoguePages = function (npc, titel, pages) { window.__seiten = pages; return echt.apply(sc, arguments); };
    // Echt angesprochen, wie im Spiel: Thom nimmt the_reckoning ab.
    var thom = sc.npcs.filter(function (n) { return n.data && n.data.id === 'thom'; })[0];
    if (!thom) return { fehler: 'kein Thom' };
    try { sc._showNpcDialogue(thom.data); }
    finally { sc._showDialoguePages = echt; }
    var p = window.__seiten || [];
    return { n: p.length, text: p.map(function (x) { return x.text; }).join(' | '),
      knopf: p.length && p[p.length - 1].choices && p[p.length - 1].choices[0].action };
  })()`);
  assert.ok(!r.fehler, r.fehler);
  assert.strictEqual(r.knopf, 'reckoning_done');
  assert.ok(/Platten liegen/.test(r.text), 'Thoms Zeile fehlt: ' + r.text);
  assert.ok(!/Elara liegt neben ihrem Vater/.test(r.text), 'der Epilog steht noch als Text im Dialog');
  assert.strictEqual(r.n, 1, 'mehr als Thoms Seite: ' + r.n);
  assert.strictEqual(H.run(`!!${Z}`), false, 'der Epilog lief schon vor dem Hebel');
  // Der Hebel: Enter waehlt "Die Presse laeuft an" (erst den Text ganz, dann die Wahl).
  for (let i = 0; i < 6 && !H.run(`!!${Z}`); i++) {
    H.step(20);
    H.run(`${HUB}.input.keyboard.emit('keydown-ENTER', { repeat: false })`);
  }
  assert.ok(bis(`!!${Z}`), 'nach dem Hebel kam kein Epilog');
  assert.strictEqual(H.run(`window.questSystem.hasFlag('story_ending')`), true, 'the_reckoning nicht abgeschlossen');
  assert.ok(bis(`${Z}.phase === 'vorspann'`), 'die Bildfolge baut sich nicht auf: ' + JSON.stringify(status()));
  const z = H.run(`(function () { var sc = ${HUB}, z = ${Z};
    return { bilder: z.bilder.join(','), geladen: z.bilder.every(function (n) { return sc.textures.exists('epilog_' + n); }),
      bild: z.bild, uhr: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since), zeit: sc.time.paused }; })()`);
  assert.strictEqual(z.bilder, 'presse,nebel,grab,elara_tot,rueckkehr,platz_leer,aldric_verschwiegen,schmiede');
  assert.strictEqual(z.geladen, true, 'Tableaus nicht geladen');
  assert.strictEqual(z.bild, 'presse');
  assert.ok(z.uhr || z.zeit, 'die Spieluhr laeuft waehrend des Epilogs');
});

test('Erste Taste zeigt den Satz ganz, die naechste blaettert; die Bilder wechseln mit', () => {
  H.step(30);
  taste(' ');
  assert.ok(bis(`${Z}.phase === 'text' && ${Z}.seite === 0`), 'Vorspann endet nicht');
  H.step(16);
  let s = status();
  assert.strictEqual(s.laeuft, true, 'der Text baut sich nicht Wort fuer Wort auf');
  const voll = H.run(`${Z}.seiten[0].text`);
  assert.notStrictEqual(s.text, voll, 'schon alles da');
  taste(' ');
  s = status();
  assert.strictEqual(s.seite, 0, 'die erste Taste hat geblaettert');
  assert.strictEqual(s.text, voll, 'die erste Taste zeigt den Satz nicht ganz');
  taste(' ');
  assert.strictEqual(status().seite, 1, 'die zweite Taste blaettert nicht');
  const gesehen = ['presse'];
  const n = H.run(`${Z}.seiten.length`);
  for (let i = 0; i < 4 * n && status() && status().seite < n - 1; i++) {
    H.step(16);
    taste(' ');
    const b = status() && status().bild;
    if (b && gesehen[gesehen.length - 1] !== b) gesehen.push(b);
  }
  assert.deepStrictEqual(gesehen, ['presse', 'nebel', 'grab', 'elara_tot', 'rueckkehr', 'platz_leer', 'aldric_verschwiegen', 'schmiede']);
});

test('ESC beendet bewusst, nichts bleibt liegen, die Uhr laeuft wieder', () => {
  taste('Escape');
  assert.strictEqual(status().phase, 'ausklang', 'ESC beendet nicht');
  assert.ok(bis(`!${Z}`), 'der Epilog raeumt nicht auf');
  const r = H.run(`(function () { var sc = ${HUB}; return {
    reste: sc.children.list.filter(function (o) { return o.name === 'epilog'; }).length,
    uhr: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since), zeit: sc.time.paused, offen: !!sc._dialogOpen }; })()`);
  assert.strictEqual(r.reste, 0, 'Teile des Epilogs bleiben liegen');
  assert.strictEqual(r.uhr || r.zeit, false, 'die Spieluhr steht danach noch');
  assert.ok(bis(`!${HUB}._dialogOpen`), 'der Hub bleibt danach gesperrt');
  assert.strictEqual(H.run('window.storySystem.consumePendingEvent()'), null, 'der Epilog ist noch einmal faellig');
});

test('Debug: ?epilog=<variante> baut die Flaggen', () => {
  const r = H.run(`(function () { var E = window.EpilogSzene;
    return { stand: E.variantenFlags('1'), mix: JSON.stringify(E.variantenFlags('tot,grab,verschwiegen')),
      bilder: E.seiten(E.variantenFlags('lebt,grab,verbuendete,erzaehlt')).map(function (s) { return s.bild; }) }; })()`);
  assert.strictEqual(r.stand, null, '?epilog=1 nimmt den Spielstand');
  assert.deepStrictEqual(JSON.parse(r.mix), { elara_killed: true, harren_dead: true, aldric_verschwiegen: true });
  for (const b of ['grab', 'elara_lebt', 'platz_voll', 'aldric_erzaehlt']) assert.ok(r.bilder.indexOf(b) >= 0, b + ' fehlt');
});
