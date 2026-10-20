// tests/finaleQuelle.test.js — das Finale an der Quelle und der Konvoi (#158).
//
// Story-Kern v6.1, Das Finale. Geprueft am laufenden Spiel, mit den echten
// Seiten (seit b498 Sprechblasen, FinaleBlasen.zeigen) und echten Knoepfen:
//   * Vor dem Kampf: der erhobene Hammer als Handwerk (Stufe 3: E halten an
//     der Esse, mitten im Heben die Erkenntnis, loslassen), Elaras Satz,
//     Harren ruft "Lene", sie stoesst ihn weg (harren_dead) BEVOR sie den
//     Hammer nimmt und die Esse sie nimmt
//   * Nach dem Kampf: ihre eigene Klinge, der letzte Schlag als Handwerk
//     (dieselbe Halte-Aktion, andere Richtung), Mara verlangt das Urteil,
//     verschonen oder richten (elara_spared/killed); das Ziel ist erfuellt,
//     abgegeben wird bei Thom
//   * Am Konvoi: still bleiben oder die Klinge ziehen    -> convoy_blown (#84),
//     im Messing-Dialog nach der Abhoer-Szene, genau einmal (b447)
// Die Halte-Aktion selbst (Handy, kurzer Druck, Slot 3) steht in
// tests/finaleHandwerk.test.js.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

let H = null;
let L = null;

before(async () => {
  H = await launchDungeon({ depth: 30 });
  L = H.lab;
  // Seit b498 laufen die Seiten als Sprechblasen (FinaleBlasen.zeigen). Eine
  // Seite kann mehrere Blasen haben: __klick tippt bis zur letzten durch (echte
  // Taps auf die Flaeche) und dann auf Knopf n, bei einer Wahl ohne Knopf noch
  // einmal auf die Flaeche.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    window.__dialogLog = [];
    var echt = window.FinaleBlasen.zeigen;
    window.FinaleBlasen.zeigen = function (s, titel, wahlen) {
      window.__dialogLog.push({ text: String(titel || ''), wahlen: (wahlen || []).map(function (w) { return w.label; }) });
      return echt.apply(this, arguments);
    };
    window.__klick = function (n) {
      var d = sc.__finaleBlase;
      if (!d) return false;
      for (var k = 0; k < 60 && d.schritt() < d.schritte.length - 1; k++) d.fang.emit('pointerdown');
      if (d.knoepfe.length) {
        var b = d.knoepfe[n || 0];
        if (!b) return false;
        b.emit('pointerdown');
        return true;
      }
      if (n) return false;
      d.fang.emit('pointerdown');
      if (sc.__finaleBlase === d) d.fang.emit('pointerdown');
      return true;
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

const GSC = "window.game.scene.getScene('GameScene')";

beforeEach(() => {
  esseHalten(false);
  L.clearEnemies();
  L.healPlayer();
  L.setDepth(30, 30);
  // Offene Dialoge und Halte-Aktionen vom Fall davor schliessen.
  for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) {
    H.run("(function () { var d = window.game.scene.getScene('GameScene').__konvoiDialog; if (d) d.zu(); else window.__klick(0); })()");
    H.step(2);
  }
  H.run(`(function () { var sc = ${GSC};
    ['__finaleHammer', '__finaleLoesen'].forEach(function (k) { if (sc[k]) { sc[k].abbrechen(); sc[k] = null; } });
    sc.__finaleNachKampf = false; sc.__esseOrt = null; })()`);
  H.run('window.__dialogLog.length = 0');
});

function stand(quests, flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(quests)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
const FINALE_AKTIV = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };

const letzter = () => H.run(`(function () { var l = window.__dialogLog; return l.length ? l[l.length - 1] : null; })()`);
/** Taktet, bis ein neuer Dialog offen ist (Seiten mit Figurenspiel davor brauchen Zeit). */
function naechsterDialog(vorher) {
  for (let i = 0; i < 900; i++) {
    if (H.run('window.__dialogLog.length') > vorher && H.run('!!window.eventChoiceOpen')) return letzter();
    H.step(2);
  }
  return null;
}
/** Klickt Knopf n im offenen Dialog; gibt den naechsten Dialog zurueck (oder null). */
function klick(n) {
  H.step(2);
  const zahl = H.run('window.__dialogLog.length');
  const ok = H.run(`window.__klick(${n || 0})`);
  assert.ok(ok, 'kein Knopf zum Klicken');
  H.step(2);
  return naechsterDialog(zahl);
}
/** Klickt und erwartet KEINEN weiteren Dialog (die Halte-Aktion kommt). */
function klickOhneFolge(n) {
  H.step(2);
  assert.ok(H.run(`window.__klick(${n || 0})`), 'kein Knopf zum Klicken');
  H.step(4);
}
const flag = (n) => H.run(`window.questSystem.hasFlag('${n}')`);
function esseHalten(an) {
  H.run(`(function () { var k = ${GSC}.input.keyboard.addKey('E', false); k.isDown = ${!!an}; })()`);
}
function zurEsse(feld) {
  H.run(`(function () { var h = ${GSC}.${feld || '__finaleHammer'};
    player.setPosition(h.x, h.y + 20); player.body.reset(player.x, player.y); })()`);
  H.step(2);
}
const halt = (feld) => H.run(`(function () { var h = ${GSC}.${feld || '__finaleHammer'};
  return h ? { phase: h.phase, f: h.fortschritt } : null; })()`);
/** E halten, bis die Halte-Aktion `phase` erreicht. */
function haltenBis(phase, feld) {
  esseHalten(true);
  let h = halt(feld);
  for (let i = 0; i < 600 && h && h.phase !== phase; i++) { H.step(1); h = halt(feld); }
  return h;
}

test('Vor dem Kampf: der erhobene Hammer als Handwerk, Harren, dann nimmt die Esse sie (v6.1, Stufe 3)', () => {
  stand(FINALE_AKTIV, {});
  const b = L.spawnBoss();
  assert.strictEqual(b.type, 'elaraBesessen');
  H.step(2);
  const erste = H.run('window.__dialogLog[0]');
  assert.ok(erste && /löse die Bindung/.test(erste.text), 'die Szene an der Esse startet nicht: ' + JSON.stringify(erste));
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), true, 'das Spiel laeuft waehrend der Szene weiter');
  // Bis die Esse sie nimmt, ist die besessene Elara nicht im Raum.
  const boss = () => H.run(`(function () { var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return b ? { sichtbar: b.visible, koerper: !!(b.body && b.body.enable), unverwundbar: !!b._unverwundbar, kampf: !!b._elaraKampf } : null; })()`);
  assert.strictEqual(JSON.stringify(boss()), JSON.stringify({ sichtbar: false, koerper: false, unverwundbar: true, kampf: false }));
  const genommen = () => H.run(`!!${GSC}.__quelleNahmSie`);

  // Seite 1 ist Handwerk: kein Dialog, sondern die Halte-Aktion an der Esse.
  klickOhneFolge(0);
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'nach dem Empfang steht noch ein Dialog');
  // Noch nicht gehoben: je nach Abstand zur Esse hingehen oder bereit.
  assert.ok(['hingehen', 'bereit'].indexOf(halt().phase) >= 0 && halt().f === 0, JSON.stringify(halt()));
  zurEsse();
  let h = haltenBis('erkannt');
  assert.strictEqual(h.phase, 'erkannt', 'die Erkenntnis kommt nicht: ' + JSON.stringify(h));
  assert.ok(Math.abs(h.f - H.run('window.FinaleHandwerk.ERKENNEN_BEI')) < 1e-9, 'der Hammer steigt ueber die Erkenntnis hinaus');
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'mitten im Heben steht ein Dialog');
  // Der Moment: Puls, der Satz, die Bindung zeigt rot in die Glut.
  const moment = H.run(`(function () { var sc = ${GSC};
    return { puls: !!sc.children.getByName('esseErkenntnisPuls'),
      satz: (sc.children.getByName('esseErkenntnisSatz') || {}).text || null,
      hinweis: (sc.children.getByName('esseHinweis') || {}).text || null }; })()`);
  assert.ok(moment.puls, 'kein Puls');
  assert.strictEqual(moment.satz, 'Das ist kein Lösen. Das ist Erneuern.');
  assert.strictEqual(moment.hinweis, 'Lass los');
  // Weiter halten bringt nichts: erst das Loslassen fuehrt weiter.
  H.step(120);
  assert.strictEqual(halt().phase, 'erkannt');
  assert.strictEqual(H.run('window.__dialogLog.length'), 1, 'ein Dialog kommt, ohne dass losgelassen wurde');
  esseHalten(false);
  let d = naechsterDialog(1);
  assert.ok(d && /Du hältst inne/.test(d.text) && /Erneuern/.test(d.text), 'der erhobene Hammer fehlt: ' + JSON.stringify(d));
  d = klick(0);
  assert.ok(/Alles haben wir vorausgesehen\. Nur nicht, dass Du es merkst\./.test(d.text), d.text);
  d = klick(0);
  assert.ok(/Nur Deine Hände/.test(d.text), 'sie spricht den Plan nicht aus: ' + d.text);
  d = klick(0);
  assert.ok(/HARREN: Lene\./.test(d.text), 'Harren kommt nicht');
  const harren = () => H.run(`(function () { var o = ${GSC}.children.getByName('finaleHarren'); return o ? { winkel: Math.round(o.angle) } : null; })()`);
  assert.ok(harren(), 'Harren steht nicht als Figur an der Esse');
  d = klick(0);
  assert.ok(/stösst sie ihn weg/.test(d.text) && /bewusst/.test(d.text), d.text);
  // Ihr Punkt ohne Rueckkehr liegt VOR der Besessenheit.
  assert.strictEqual(genommen(), false, 'die Esse nimmt sie schon, bevor sie ihn wegstoesst');
  assert.strictEqual(flag('harren_dead'), false, 'Harren stirbt schon, bevor man es gelesen hat');
  assert.ok(Math.abs(harren().winkel) >= 80, 'Harren liegt nicht: ' + JSON.stringify(harren()));
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('finaleHammer')`), false, 'sie hat den Hammer schon vor dem Stoss');
  d = klick(0);
  assert.strictEqual(flag('harren_dead'), true, 'harren_dead nicht gesetzt');
  assert.ok(/reisst Dir den Hammer/.test(d.text), 'sie nimmt den Hammer nicht: ' + d.text);
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('finaleHammer')`), true, 'der Hammer wechselt nicht sichtbar zu ihr');
  assert.strictEqual(genommen(), false, 'die Esse nimmt sie, bevor sie es selbst versucht');
  d = klick(0);
  assert.ok(/keine Archivschmiedin/.test(d.text) && /schmiedet die Esse sie/.test(d.text), d.text);
  // #89: Der Moment ist inszeniert (Blitz, Stoss), nicht nur eine Textseite.
  assert.strictEqual(genommen(), true, 'die Besessenheit ist nur eine Textseite');
  assert.deepStrictEqual(Array.from(d.wahlen), ['Kämpfen']);
  assert.strictEqual(boss().sichtbar, false, 'der Boss steht schon vor "Kämpfen"');
  H.step(2);
  H.run('window.__klick(0)');
  H.step(4);
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false, 'der Kampf beginnt nicht');
  assert.strictEqual(JSON.stringify(boss()), JSON.stringify({ sichtbar: true, koerper: true, unverwundbar: false, kampf: true }),
    'aus der Elara an der Esse wird nicht der Boss');
  assert.strictEqual(H.run(`!!${GSC}.children.getByName('finaleElara')`), false, 'die Buehnen-Elara bleibt stehen');
});

test('Wer Harren schon hat sterben sehen, kommt direkt zum Kampf', () => {
  stand(FINALE_AKTIV, { harren_dead: true });
  L.spawnBoss();
  H.step(2);
  const log = H.run('window.__dialogLog.map(function (d) { return d.text; })');
  assert.ok(!log.some((t) => /löse die Bindung/.test(t)), 'die Szene spielt ein zweites Mal');
  assert.strictEqual(H.run(`!!enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0]._elaraKampf`), true,
    'ohne Buehne beginnt der Kampf nicht');
});

function elaraBesiegen() {
  L.spawnBoss();
  // Keine Vorkampf-Szene (harren_dead) — Elara direkt besiegen.
  H.run(`(function () {
    var sc = window.game.scene.getScene('GameScene');
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    b.hp = 0;
    handleEnemyHit(sc, b, {});
  })()`);
  return naechsterDialog(0);
}
/** Der letzte Schlag: zur Esse, halten, bis sie zerbrochen ist, dann die naechste Seite. */
function letzterSchlag() {
  const zahl = H.run('window.__dialogLog.length');
  zurEsse('__finaleLoesen');
  const h = haltenBis('fertig', '__finaleLoesen');
  esseHalten(false);
  assert.ok(!h || h.phase === 'fertig', 'die Bindung loest sich nicht: ' + JSON.stringify(h));
  return naechsterDialog(zahl);
}

test('Nach dem Kampf: ihre Klinge, der letzte Schlag als Handwerk, Mara verlangt das Urteil, verschonen (v6.1)', () => {
  stand(FINALE_AKTIV, { harren_dead: true, elara_trust: true });
  let d = elaraBesiegen();
  assert.ok(d && /Ihre eigene Klinge/.test(d.text), 'keine Szene nach dem Kampf: ' + JSON.stringify(d));
  assert.strictEqual(flag('elara_besiegt'), true, 'der Sieg ist nicht gemerkt (Rueckkehr an die Esse)');
  klickOhneFolge(0);
  // Der letzte Schlag ist Handwerk: erst die Halte-Aktion, dann zerbricht die Esse.
  const los = halt('__finaleLoesen');
  assert.ok(los && ['hingehen', 'bereit'].indexOf(los.phase) >= 0 && los.f === 0, 'keine Halte-Aktion fuer den letzten Schlag: ' + JSON.stringify(los));
  assert.strictEqual(H.run(`!!${GSC}.__esseZerbrochen`), false);
  d = letzterSchlag();
  assert.strictEqual(H.run(`!!${GSC}.__esseZerbrochen`), true, 'die Esse zerbricht nicht');
  assert.ok(/in die andere Richtung/.test(d.text) && /kein neuer Rauch/.test(d.text), d.text);
  d = klick(0);
  assert.ok(/fällt zurück in die Tiefe/.test(d.text) && /gibt er frei/.test(d.text), 'der Daemon faellt nicht: ' + d.text);
  d = klick(0);
  assert.ok(/Bis zum letzten Schlag/.test(d.text), 'ihre letzten Worte kennen das Vertrauen nicht: ' + d.text);
  d = klick(0);
  assert.ok(/MARA:/.test(d.text) && /Richte sie/.test(d.text), 'Mara verlangt kein Urteil: ' + d.text);
  assert.strictEqual(JSON.stringify(d.wahlen), JSON.stringify(['Verschonen', 'Richten']));
  klick(0);
  assert.strictEqual(flag('elara_spared'), true);
  assert.strictEqual(flag('elara_killed'), false);
  H.step(2);
  H.run('window.__klick(0)');
  H.step(2);
  // v6.1: Abgegeben wird oben bei Thom. Unten ist nur das Ziel erfuellt.
  const q = H.run(`(function () { var qs = window.questSystem;
    return { status: (qs.getQuestSaveData().quests.schattenrat_finale || {}).status,
      bereit: qs.isQuestReadyToComplete('schattenrat_finale'),
      thom: qs.getActiveQuestsAt('thom').map(function (x) { return x.id; }),
      branka: qs.getActiveQuestsAt('branka').map(function (x) { return x.id; }),
      wartet: _elaraWartet(), nachKampf: window.Finale.laeuftNachKampf(${GSC}) }; })()`);
  assert.strictEqual(q.status, 'active', 'die Quelle ist schon unten abgeschlossen');
  assert.strictEqual(q.bereit, true, 'das Ziel der Quelle ist nach dem Sieg nicht erfuellt');
  assert.ok(Array.from(q.thom).indexOf('schattenrat_finale') >= 0, 'Thom nimmt die Quelle nicht ab');
  assert.ok(Array.from(q.branka).indexOf('schattenrat_finale') < 0, 'Branka will sie noch einmal abnehmen');
  assert.strictEqual(q.wartet, false, 'Elara wartet nach dem entschiedenen Kampf erneut auf Tiefe 30');
  assert.strictEqual(q.nachKampf, false, 'das Finale sperrt nach dem Urteil weiter die Wellen');
});

test('Nach dem Kampf: richten', () => {
  stand(FINALE_AKTIV, { harren_dead: true, zeichen_bemerkt: true });
  elaraBesiegen();
  klickOhneFolge(0);
  letzterSchlag();
  klick(0);
  const d = klick(0);
  assert.ok(/nie ganz getraut/.test(d.text));
  assert.ok(/Das Zeichen/.test(d.text), 'wer das Zeichen erkannt hat, dem sagt sie es');
  klick(0);
  H.step(2);
  H.run('window.__klick(1)');
  H.step(2);
  assert.strictEqual(flag('elara_killed'), true);
  assert.strictEqual(flag('elara_spared'), false);
});

test('Nach dem Kampf: ist Maras Netz verbrannt, stellt sich die Frage ohne sie (Stufe 1b)', () => {
  // Im Epilog heisst es dann, Mara sei seit dem Konvoi fort. Bis b459 kam sie
  // trotzdem die Stufen herab und verlangte das Urteil.
  stand(FINALE_AKTIV, { harren_dead: true, convoy_blown: true, convoy_blade_drawn: true });
  elaraBesiegen();
  klickOhneFolge(0);
  letzterSchlag();
  klick(0);
  klick(0);
  const d = klick(0);
  assert.ok(!/MARA:/.test(d.text), 'Mara verlangt das Urteil, obwohl sie fort ist: ' + d.text);
  assert.ok(/Niemand kommt die Stufen herab/.test(d.text), d.text);
  assert.strictEqual(JSON.stringify(d.wahlen), JSON.stringify(['Verschonen', 'Richten']));
  H.step(2);
  H.run('window.__klick(0)');
  H.step(2);
  assert.strictEqual(flag('elara_spared'), true);
});

test('Wer nach dem Sieg geht, findet Elara an der Esse wieder, ohne zweiten Kampf (Spielstand)', () => {
  // Der Sieg ist gemerkt (elara_besiegt), das Urteil fehlt: so steht es in
  // einem Spielstand, der waehrend des letzten Schlags verlassen wurde.
  stand(FINALE_AKTIV, { harren_dead: true, elara_besiegt: true });
  assert.strictEqual(H.run('_elaraWartet()'), true, 'ohne Urteil wartet die Esse nicht mehr');
  L.spawnBoss();
  const d = naechsterDialog(0);
  assert.ok(d && /liegt noch dort, wo sie fiel/.test(d.text), JSON.stringify(d));
  assert.strictEqual(H.run(`enemies.getChildren().filter(function (x) { return x && x.active && x.isBoss; }).length`), 0,
    'sie steht ein zweites Mal als Boss da');
  klickOhneFolge(0);
  const n = letzterSchlag();
  assert.ok(n && /in die andere Richtung/.test(n.text), 'der letzte Schlag fehlt: ' + JSON.stringify(n));
});

test('Waehrend des letzten Schlags kommt keine neue Welle in die Arena', () => {
  stand(FINALE_AKTIV, { harren_dead: true });
  L.spawnBoss();
  H.run(`(function () {
    var sc = ${GSC}; var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    bossActive = true; currentBoss = b; b.hp = 0; handleEnemyHit(sc, b, {});
  })()`);
  naechsterDialog(0);
  klickOhneFolge(0);
  // Die Uhr laeuft (kein Dialog): checkWaveEnd haette nach 1 s die naechste Welle gestartet.
  H.step(240);
  const r = H.run(`({ gegner: enemies.countActive(true), nachKampf: window.Finale.laeuftNachKampf(${GSC}), bossWelle: bossActive })`);
  assert.strictEqual(r.nachKampf, true);
  assert.strictEqual(r.gegner, 0, 'eine neue Welle stoert das Handwerk an der Esse');
  assert.strictEqual(r.bossWelle, true, 'die Bosswelle ist vorbei, bevor das Finale durch ist');
});

// --- Der Konvoi (#158, Messing-Dialog seit b447) -----------------------------
// Er folgt direkt auf die Abhoer-Szene und traegt deren Messing: Platte und
// Knoepfe aus uiRahmen, alles mit scrollFactor 0 (sonst gehen Taps auf dem
// Handy daneben), Tasten 1/2 fuer die Wahl.

const GS = "window.game.scene.getScene('GameScene')";
async function bis(js, runden) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    H.step(2);
    await flush();
  }
  return false;
}
/** Was der Konvoi-Dialog gerade zeigt (oder null). */
const konvoiDialog = () => H.run(`(function () { var d = ${GS}.__konvoiDialog;
  return d ? { text: d.text, wahlen: d.wahlen } : null; })()`);
/** Knopf n des Konvoi-Dialogs antippen (der echte Knopf, nicht waehle()). */
function konvoiTippen(n) {
  assert.ok(H.run(`(function () { var d = ${GS}.__konvoiDialog; var k = d && d.knoepfe[${n}];
    if (!k || !k.input || !k.input.enabled) return false; k.emit('pointerdown', {}, 0, 0, { stopPropagation: function () {} }); return true; })()`),
    'kein Knopf ' + n + ' im Konvoi-Dialog');
  H.step(2);
  return konvoiDialog();
}
async function konvoiTaste(key) {
  // Der Dialog nimmt erst nach einem Moment Tasten an (headless: Zeit nur per step).
  for (let i = 0; i < 30; i++) { H.step(2); await flush(); }
  H.run(`${GS}.input.keyboard.emit('keydown', { key: '${key}' })`);
  H.step(2);
  return konvoiDialog();
}
/** Offene Spionage-Szenen und Konvoi-Dialoge schliessen. */
async function aufraeumen() {
  for (let i = 0; i < 10; i++) {
    const offen = H.run(`(function () { var gs = ${GS};
      if (gs.__spionSzene) { gs.__spionSzene.ueberspringen(); return true; }
      if (gs.__konvoiDialog) { gs.__konvoiDialog.zu(); return true; }
      return false; })()`);
    if (!offen) break;
    await bis(`!${GS}.__spionSzene`, 400);
  }
  H.run(`window.EspionageSystem.isActive() && window.EspionageSystem.endMission()`);
}

test('Der Konvoi: Messing-Dialog, fest am Schirm, haelt das Spiel an', async () => {
  stand({}, {});
  assert.strictEqual(H.run(`window.uiRahmen.bereit(${GS})`), true, 'Messing-Bilder fehlen im Dungeon — Test misst nichts');
  assert.ok(H.run(`!!window.Finale.konvoi(${GS})`), 'der Konvoi fragt nicht');
  H.step(2);
  const r = H.run(`(function () {
    var gs = ${GS}, d = gs.__konvoiDialog, kam = gs.cameras.main;
    var alle = [];
    (function sammle(o) { alle.push(o); if (o.list) o.list.forEach(sammle); })(d.box);
    var rahmen = alle.filter(function (o) { return o.type === 'Image' && o.texture && o.texture.key === 'ui_rahmen'; });
    var platte = rahmen.reduce(function (m, o) {
      m.l = Math.min(m.l, o.x); m.t = Math.min(m.t, o.y);
      m.r = Math.max(m.r, o.x + o.displayWidth); m.b = Math.max(m.b, o.y + o.displayHeight); return m;
    }, { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    var text = alle.filter(function (o) { return o.name === 'konvoiText'; })[0];
    var knoepfe = d.knoepfe.map(function (k) { var b = k.getBounds(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, h: b.height }; });
    return {
      messing: d.messing, rahmen: rahmen.length,
      knopfBilder: d.knoepfe.every(function (k) { return !!(k._uiTextKnopf && k._uiTextKnopf.parentContainer === d.box); }),
      nichtFest: alle.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).map(function (o) { return o.type + ':' + o.name; }),
      platte: platte, kam: { w: kam.width, h: kam.height },
      textUnten: text.y + text.height, knoepfe: knoepfe,
      offen: !!window.eventChoiceOpen, pause: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null),
      ereignisKasten: gs.children.list.some(function (o) { return o.type === 'Rectangle' && o.depth === 2502 && o.input && o.input.enabled; })
    };
  })()`);
  assert.strictEqual(r.messing, true, 'kein Messing');
  assert.ok(r.rahmen >= 9, 'keine Platte aus uiRahmen: ' + r.rahmen);
  assert.ok(r.knopfBilder, 'die Knoepfe tragen keinen Messingknopf');
  assert.deepStrictEqual(Array.from(r.nichtFest), [], 'Teile mit scrollFactor != 0 (Taps gehen daneben)');
  assert.strictEqual(r.ereignisKasten, false, 'der alte Ereignis-Kasten steht auch da');
  assert.ok(r.platte.l >= 0 && r.platte.t >= 0 && r.platte.r <= r.kam.w && r.platte.b <= r.kam.h, 'die Platte ragt aus dem Bild: ' + JSON.stringify(r.platte));
  for (const k of r.knoepfe) {
    assert.ok(k.l >= r.platte.l && k.r <= r.platte.r && k.b <= r.platte.b, 'Knopf ausserhalb der Platte: ' + JSON.stringify(k));
    assert.ok(k.t >= r.textUnten, 'Knopf ueberdeckt den Text');
    assert.ok(k.h >= 44, 'Knopf zu klein zum Tippen: ' + k.h);
  }
  assert.strictEqual(r.offen, true, 'Angriffe gehen durch den Dialog');
  assert.strictEqual(r.pause, true, 'die Spieluhr laeuft weiter');
  await aufraeumen();
  assert.strictEqual(H.run('!!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null)'), false, 'die Spieluhr bleibt stehen');
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false);
});

test('Der Konvoi: wer die Klinge zieht, verbrennt Maras Netz (#84)', async () => {
  stand({}, {});
  H.run(`window.Finale.konvoi(${GS})`);
  H.step(2);
  assert.deepStrictEqual(Array.from(konvoiDialog().wahlen), ['Still bleiben', 'Die Klinge ziehen']);
  const d = konvoiTippen(1);
  assert.strictEqual(flag('convoy_blade_drawn'), true);
  assert.strictEqual(flag('convoy_blown'), true, 'convoy_blown wird nicht gesetzt');
  assert.strictEqual(H.run(`window.QuestFinale.computeFinaleState(window.questSystem.getFlags()).allies.mara`), false,
    'Mara hilft trotz verbranntem Netz');
  assert.ok(d && /Maras Netz/.test(d.text) && d.wahlen.length === 1, 'keine Folge-Seite: ' + JSON.stringify(d));
  // Die Folge-Seite schliesst mit der Leertaste, wie jeder Ein-Knopf-Dialog.
  // Steht ihr Satz noch nicht ganz da, zeigt der erste Druck ihn zu Ende
  // (b470, tests/dialogTasteVollText.test.js); spaetestens der zweite schliesst.
  const nachErstem = await konvoiTaste(' ');
  if (nachErstem) assert.strictEqual(await konvoiTaste(' '), null, 'die Leertaste schliesst die Folge-Seite nicht');
  assert.strictEqual(H.run('!!window.eventChoiceOpen'), false);
});

test('Der Konvoi: wer still bleibt (Taste 1), behaelt Mara — und wird nicht noch einmal gefragt', async () => {
  stand({}, { petitions_kept: true });
  H.run(`window.Finale.konvoi(${GS})`);
  H.step(2);
  // Leertaste entscheidet NICHT (wer die Szene davor durchblaettert, soll nicht versehentlich waehlen).
  assert.ok(await konvoiTaste(' '), 'die Leertaste trifft eine Wahl');
  assert.strictEqual(flag('convoy_silent'), false);
  const d = await konvoiTaste('1');
  assert.strictEqual(flag('convoy_silent'), true, 'Taste 1 waehlt nicht');
  assert.strictEqual(flag('convoy_blown'), false);
  assert.ok(d && /Schatten/.test(d.text), 'keine Folge-Seite');
  assert.strictEqual(H.run(`window.QuestFinale.computeFinaleState(window.questSystem.getFlags()).allies.mara`), true);
  konvoiTippen(0);
  assert.strictEqual(konvoiDialog(), null);
  // Nur einmal: ein zweiter Durchgang fragt nicht noch einmal.
  assert.strictEqual(H.run(`window.Finale.konvoi(${GS})`), false);
});

test('Der Konvoi: steht der Dialog schon, kommt kein zweiter', async () => {
  stand({}, {});
  assert.ok(H.run(`!!window.Finale.konvoi(${GS})`));
  assert.strictEqual(H.run(`window.Finale.konvoi(${GS})`), false, 'zwei Konvoi-Dialoge uebereinander');
  await aufraeumen();
});

/** Konvoi abhoeren wie im Spiel; zaehlt, wie oft die Entscheidung gerufen wird. */
function konvoiAbhoeren(vorher) {
  H.run(`(function () {
    var gs = ${GS}, E = window.EspionageSystem;
    window.SpionageSzenen._TEMPO = 0.2;
    window.__konvoiRufe = 0; window.__konvoiDialoge = 0;
    window.__echtKonvoi = window.__echtKonvoi || window.Finale.konvoi;
    window.Finale.konvoi = function (sc) {
      window.__konvoiRufe++;
      var r = window.__echtKonvoi(sc);
      if (r) window.__konvoiDialoge++;
      return r;
    };
    ${vorher || ''}
    E.startMission(gs, { missionId: 'test_konvoi', guards: [], cover: [],
      observeZones: [{ id: 'k', x: player.x, y: player.y, r: 200, seconds: 0.2, questTarget: 'convoy_intel' }] });
    for (var i = 0; i < 20; i++) E.update(gs, 0, 100);
  })()`);
}
function konvoiEcht() {
  H.run(`window.Finale.konvoi = window.__echtKonvoi`);
}

test('Der Konvoi fragt nach der Abhoer-Szene, genau einmal', async () => {
  stand({ espionage_convoy: { status: 'active', objectives: [{ type: 'observe', target: 'convoy_intel', current: 0, required: 1 }] } }, {});
  try {
    konvoiAbhoeren();
    assert.ok(H.run(`!!(${GS}.__spionSzene && ${GS}.__spionSzene.art === 'belauscht')`), 'keine Abhoer-Szene am Konvoi');
    assert.strictEqual(H.run('window.__konvoiRufe'), 0, 'die Entscheidung kommt vor dem Gespraech');
    H.run(`${GS}.__spionSzene.ueberspringen()`);
    assert.ok(await bis(`!!${GS}.__konvoiDialog`), 'nach der Abhoer-Szene kommt keine Entscheidung');
    for (let i = 0; i < 30; i++) { H.step(2); await flush(); }
    assert.strictEqual(H.run('window.__konvoiDialoge + ":" + !!' + GS + '.__spionSzene'), '1:false',
      'Entscheidung nicht genau einmal (oder "Alles gehoert" darueber)');
    assert.deepStrictEqual(Array.from(konvoiDialog().wahlen), ['Still bleiben', 'Die Klinge ziehen']);
    konvoiTippen(0);
    konvoiTippen(0);
  } finally { konvoiEcht(); await aufraeumen(); }
});

test('Der Konvoi fragt auch, wenn keine Abhoer-Szene zustande kommt', async () => {
  stand({}, {});
  try {
    konvoiAbhoeren(`window.__echtBelauscht = window.SpionageSzenen.belauscht;
      window.SpionageSzenen.belauscht = function () { return null; };`);
    assert.strictEqual(H.run('window.__konvoiDialoge'), 1, 'ohne Szene faellt die Entscheidung aus');
  } finally {
    H.run('window.SpionageSzenen.belauscht = window.__echtBelauscht');
    konvoiEcht(); await aufraeumen();
  }
});

test('Andere Abhoerziele fragen nicht', async () => {
  stand({}, {});
  H.run(`(function () {
    var sc = ${GS};
    var E = window.EspionageSystem;
    E.startMission(sc, { missionId: 'test_archiv', guards: [], cover: [],
      observeZones: [{ id: 'a', x: player.x, y: player.y, r: 200, seconds: 0.2, questTarget: 'archive_record' }] });
    for (var i = 0; i < 20; i++) E.update(sc, 0, 100);
  })()`);
  await aufraeumen();
  for (let i = 0; i < 20; i++) { H.step(2); await flush(); }
  assert.strictEqual(konvoiDialog(), null, 'das Archiv stellt die Konvoi-Frage');
});
