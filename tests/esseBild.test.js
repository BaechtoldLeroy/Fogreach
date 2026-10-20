// tests/esseBild.test.js — die Esse als Bild im Finalraum (DieQuelle).
//
// Drei Zustaende (FinaleHandwerk.esseAufstellen/esseZustand):
//   * intakt: beim Betreten und waehrend des erhobenen Hammers (?finale=hammer)
//   * flackern: sobald die Esse Elara nimmt, im Kampf, beim letzten Schlag
//     (die Debug-Schritte kampf ... loesen stellen genau diese Flaggen her)
//   * zerbrochen: nach dem letzten Schlag, und beim Wiederkommen nach dem Urteil
// Der Ort der Esse ([E], Reichweite, Bindung) bleibt, wo die Glut war; der
// Sockel hat einen Koerper (auch Harren liegt nicht darauf). Fehlt das Bild,
// bleibt das alte Leuchten.

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { launchDungeon } = require('../tools/headless/index.js');

let H = null;
const GSC = "window.game.scene.getScene('GameScene')";
const FINALE_AKTIV = { schattenrat_finale: { status: 'active', objectives: [{ type: 'boss_kill', target: 'schattenrat', current: 0, required: 1 }] } };

before(async () => {
  H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&finale=hammer' });
  H.run(`(function () {
    window._playerInvincible = true;
    var sc = ${GSC};
    // Die Seiten des Finales sind Sprechblasen (b498): bis zur letzten tippen, dann waehlen.
    window.__knopf = function () {
      var d = sc.__finaleBlase;
      if (!d) return false;
      for (var k = 0; k < 60 && d.schritt() < d.schritte.length - 1; k++) d.fang.emit('pointerdown');
      if (d.knoepfe.length) { d.knoepfe[0].emit('pointerdown'); return true; }
      d.fang.emit('pointerdown');
      if (sc.__finaleBlase === d) d.fang.emit('pointerdown');
      return true;
    };
  })()`);
});
after(async () => { if (H) await H.shutdown(); });

beforeEach(() => {
  taste(false);
  for (let i = 0; i < 20 && H.run('!!window.eventChoiceOpen'); i++) { H.run('window.__knopf()'); H.step(2); }
  H.run(`(function () { var sc = ${GSC};
    ['__finaleHammer', '__finaleLoesen', '__testHalt'].forEach(function (k) { if (sc[k]) { sc[k].abbrechen(); sc[k] = null; } });
    sc.__finaleNachKampf = false; })()`);
  H.lab.clearEnemies();
});

function stand(flags) {
  H.run(`(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.quests = ${JSON.stringify(FINALE_AKTIV)};
    st.flags = ${JSON.stringify(flags || {})};
    qs.loadQuestSaveData(st);
  })()`);
}
function taste(an) {
  H.run(`(function () { var k = ${GSC}.input.keyboard.addKey('E', false); k.isDown = ${!!an}; })()`);
}
/** Die Arena neu betreten (frischer Aufbau der Esse). */
function arenaBetreten() {
  H.run(`(function () { var sc = ${GSC};
    window.DUNGEON_DEPTH = 30; if (typeof currentWave !== 'undefined') currentWave = 30;
    initDungeonRun();
    var n = dungeonRun.templateOrder.length - 1;
    dungeonRun.templateOrder[n] = 'DieQuelle';
    enterRoom(sc, n); })()`);
  H.step(2);
}
const esse = () => H.run(`(function () { var sc = ${GSC}, b = sc._esseBild, k = sc._esseKoerper, g = sc._quelleGlow;
  var o = window.FinaleHandwerk.ort(sc);
  return {
    bild: !!(b && b.active), key: b && b.active ? b.texture.key : null, zustand: b && b.active ? b.getData('esseZustand') : null,
    bx: b ? b.x : null, by: b ? b.y : null, tiefe: b ? b.depth : null,
    koerper: k && k.active && k.body ? { l: k.body.left, r: k.body.right, o: k.body.top, u: k.body.bottom, inHindernissen: obstacles.contains(k) } : null,
    glut: g && g.active ? { x: g.x, y: g.y, tiefe: g.depth } : null,
    ort: o
  }; })()`);

// Was sich am Boden um die Esse dreht oder ausbreitet: Glut, Bindung und
// Rauchzug der Halte-Aktion, Risse und Nebelring beim Zerbrechen, die
// Nebelzonen der Arena. Die Esse muss darueber liegen (Wunsch zu b487).
const KREISE = ['esseGlut', 'esseBindung', 'esseZug', 'esseRisse', 'esseNebelRing', 'elaraZone'];
const kreise = () => H.run(`(function () { var sc = ${GSC}, b = sc._esseBild, namen = ${JSON.stringify(KREISE)};
  var da = sc.children.list.filter(function (o) { return o.active && namen.indexOf(o.name) >= 0; });
  return {
    esse: b && b.active ? b.depth : null,
    gesehen: da.map(function (o) { return o.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(),
    drueber: da.filter(function (o) { return !(b && b.active && o.depth < b.depth); }).map(function (o) { return o.name + '@' + o.depth; })
  }; })()`);
function esseUeber(erwartet, wann) {
  const k = kreise();
  assert.ok(k.esse !== null, wann + ': kein Bild der Esse');
  erwartet.forEach((n) => assert.ok(k.gesehen.indexOf(n) >= 0, wann + ': ' + n + ' fehlt (' + k.gesehen.join(', ') + ')'));
  assert.deepStrictEqual(Array.from(k.drueber), [], wann + ': ueber der Esse (' + k.esse + ') liegen ' + k.drueber.join(', '));
}

test('Beim Betreten steht die Esse intakt, an der Stelle der Glut, der Sockel hat einen Koerper', () => {
  const e = esse();
  assert.strictEqual(e.bild, true, 'kein Bild der Esse (Textur geladen? ' + H.run(`${GSC}.textures.exists('esse_intakt')`) + ')');
  assert.strictEqual(e.key, 'esse_intakt');
  assert.ok(e.glut, 'die Glut fehlt');
  // Der Ort der Halte-Aktion ist weiter die Glut, das Bild steht darauf.
  assert.deepStrictEqual([e.ort.x, e.ort.y], [e.glut.x, e.glut.y]);
  assert.strictEqual(e.bx, e.glut.x);
  assert.strictEqual(e.by, e.glut.y + H.run('window.FinaleHandwerk.ESSE_SOCKEL'));
  // Schein am Boden unter dem Bild; die Esse steht ueber der Bodenebene, unter Props und Figuren.
  assert.ok(e.glut.tiefe < e.tiefe && e.tiefe < H.run('window.WELT_TIEFEN.PROP_SCHATTEN'), 'Tiefen: Schein ' + e.glut.tiefe + ', Bild ' + e.tiefe);
  // Koerper: der Sockel, 76 x 28, mittig unter dem Ort, Unterkante am Sockel.
  const k = e.koerper;
  assert.ok(k && k.inHindernissen, 'kein Sockelkoerper in den Hindernissen: ' + JSON.stringify(k));
  assert.strictEqual(Math.round(k.r - k.l), 76);
  assert.strictEqual(Math.round(k.u - k.o), 28);
  assert.strictEqual(Math.round((k.l + k.r) / 2), Math.round(e.glut.x));
  assert.strictEqual(Math.round(k.u), Math.round(e.by));
});

test('Durch den Sockel kommt man nicht, an die Esse heran schon', () => {
  const e = esse();
  // Von unten auf die Esse zulaufen.
  H.run(`(function () { player.setPosition(${e.ort.x}, ${e.ort.y} + 140); player.body.reset(player.x, player.y); })()`);
  for (let i = 0; i < 90; i++) { H.run('player.body.setVelocity(0, -200)'); H.step(1); }
  H.run('player.body.setVelocity(0, 0)');
  const p = H.run('({ x: player.x, y: player.y, oben: player.body.top })');
  assert.ok(p.oben >= e.koerper.u - 1, 'der Spieler steckt im Sockel: ' + JSON.stringify(p) + ' Koerper ' + JSON.stringify(e.koerper));
  assert.ok(Math.hypot(p.x - e.ort.x, p.y - e.ort.y) <= H.run('window.FinaleHandwerk.REICHWEITE'), 'vor dem Sockel ausser Reichweite: ' + JSON.stringify(p));
  // Dort reicht E halten fuer die Halte-Aktion.
  H.run(`(function () { var sc = ${GSC}; window.__fertig = 0;
    sc.__testHalt = window.FinaleHandwerk.halten(sc, { richtung: 'erneuern', beiFertig: function () {} }); })()`);
  taste(true);
  let h = null;
  for (let i = 0; i < 400; i++) { H.step(1); h = H.run(`(function () { var h = ${GSC}.__testHalt; return { phase: h.phase, f: h.fortschritt }; })()`); if (h.phase === 'erkannt') break; }
  taste(false);
  assert.strictEqual(h.phase, 'erkannt', 'die Halte-Aktion greift vor dem Sockel nicht: ' + JSON.stringify(h));
});

test('?finale=hammer: waehrend des erhobenen Hammers glimmt die Esse (intakt)', () => {
  stand({});
  H.lab.spawnBoss();
  H.step(2);
  assert.ok(H.run('!!window.eventChoiceOpen'), 'die Szene an der Esse startet nicht');
  assert.strictEqual(esse().key, 'esse_intakt');
  H.run('window.__knopf()');
  for (let i = 0; i < 20 && !H.run(`!!${GSC}.__finaleHammer`); i++) H.step(1);
  assert.ok(H.run(`!!${GSC}.__finaleHammer`), 'keine Halte-Aktion');
  assert.strictEqual(esse().zustand, 'intakt');
  // Heben bis zur Erkenntnis, loslassen: noch glimmt sie.
  H.run(`(function () { var h = ${GSC}.__finaleHammer; player.setPosition(h.x, h.y + 70); player.body.reset(player.x, player.y); })()`);
  taste(true);
  for (let i = 0; i < 400 && H.run(`${GSC}.__finaleHammer.fortschritt`) < 0.3; i++) H.step(1);
  esseUeber(['esseBindung', 'esseGlut', 'esseZug'], 'erhobener Hammer');
  // Elara (und Harren, sobald er kommt) stehen auf der Buehne vor der Esse.
  const figuren = H.run(`(function () { var sc = ${GSC}, b = sc.__finaleBuehne || {};
    return [b.elara, b.harren].filter(function (o) { return o && o.active; }).map(function (o) { return o.depth; }); })()`);
  assert.ok(figuren.length >= 1, 'Elara fehlt auf der Buehne');
  figuren.forEach((d) => assert.ok(d > esse().tiefe, 'eine Figur liegt unter der Esse: ' + d));
  for (let i = 0; i < 400 && H.run(`${GSC}.__finaleHammer.phase`) !== 'erkannt'; i++) H.step(1);
  esseUeber(['esseBindung', 'esseGlut'], 'Erkenntnis');
  taste(false);
  for (let i = 0; i < 100 && H.run(`!!${GSC}.__finaleHammer`); i++) H.step(1);
  assert.strictEqual(esse().zustand, 'intakt', 'schon die Erkenntnis laesst die Esse lodern');
  // Durch die Seiten, bis die Esse Elara nimmt: ab da lodert sie.
  for (let i = 0; i < 3000 && !H.run(`!!${GSC}.__quelleNahmSie`); i++) {
    if (H.run('!!window.eventChoiceOpen') && i % 20 === 19) H.run('window.__knopf()');
    H.step(1);
  }
  assert.ok(H.run(`!!${GSC}.__quelleNahmSie`), 'die Esse nimmt Elara nicht');
  assert.strictEqual(esse().zustand, 'flackern', 'die Esse nimmt Elara, lodert aber nicht');
});

test('Kampf (kampf ... schlag): die Esse flackert, im festen Muster zwischen beiden Bildern', () => {
  arenaBetreten();
  assert.strictEqual(esse().zustand, 'intakt');
  stand({ harren_dead: true });
  H.lab.spawnBoss();
  for (let i = 0; i < 10 && esse().zustand !== 'flackern'; i++) H.step(1);
  assert.strictEqual(esse().zustand, 'flackern', 'der Kampf laeuft, die Esse glimmt nur');
  const ms = H.run('window.FinaleHandwerk.FLACKER_MS');
  const gesehen = {};
  for (let i = 0; i < 40; i++) { H.step(Math.ceil(ms / 16)); gesehen[esse().key] = (gesehen[esse().key] || 0) + 1; }
  assert.ok(gesehen.esse_flackern > gesehen.esse_intakt && gesehen.esse_intakt > 0,
    'kein Flackern: ' + JSON.stringify(gesehen));
  assert.ok(!gesehen.esse_zerbrochen, 'im Kampf zerbrochen');
});

test('Arena-Zonen (zonen): die Esse liegt ueber dem Nebel, Elara und der Spieler davor ueber der Esse, dahinter verdeckt sie ihn', () => {
  const BOSS = 'enemies.getChildren().filter(function (x) { return x && x.isBoss && x.active; })[0]';
  arenaBetreten();
  stand({ harren_dead: true });
  H.lab.spawnBoss();
  // Wie der Kampf-Fall: braucht den verbrauchten ?finale=hammer-Schritt der Faelle davor.
  for (let i = 0; i < 10 && !H.run(`!!(${BOSS} && ${BOSS}._elaraKampf)`); i++) H.step(1);
  H.run(`(function () { var b = ${BOSS}; b.speed = 0; b.damage = 1; b.baseDamage = 1; b.nextPatternAt = 1e15; b.hp = Math.ceil(b.maxHp * 0.6); })()`);
  H.step(3);
  H.run(`${BOSS}.nextPatternAt = 1e15`);
  assert.strictEqual(H.run(`${BOSS}.phase`), 2, 'keine Phase 2: ' + H.run(`JSON.stringify({ kampf: !!${BOSS}._elaraKampf, harrenTot: window.questSystem.hasFlag('harren_dead') })`));
  esseUeber(['elaraZone'], 'Zonen angekuendigt');
  for (let i = 0; i < 90; i++) H.step(1);
  esseUeber(['elaraZone'], 'Zonen scharf');
  // Spieler vor dem Sockel: ueber der Esse. Hinter dem Schacht: die Esse vor ihm.
  const o = esse().ort;
  H.run(`(function () { player.setPosition(${o.x}, ${o.y} + 60); player.body.reset(player.x, player.y); })()`);
  H.step(2);
  assert.ok(esse().tiefe < H.run('player.depth'), 'der Spieler vor der Esse wird verdeckt');
  H.run(`(function () { player.setPosition(${o.x}, ${o.y} - 45); player.body.reset(player.x, player.y); })()`);
  H.step(2);
  assert.ok(esse().tiefe > H.run('player.depth'), 'hinter dem Schacht steht der Spieler vor der Esse');
  esseUeber(['elaraZone'], 'Spieler hinter der Esse');
});

test('Letzter Schlag (loesen): lodernd an der Esse, nach dem Schlag zerbrochen; Koerper und Ort bleiben', () => {
  arenaBetreten();
  stand({ harren_dead: true, elara_besiegt: true });
  H.lab.spawnBoss();
  for (let i = 0; i < 200 && !H.run('!!window.eventChoiceOpen'); i++) H.step(1);
  assert.strictEqual(esse().zustand, 'flackern', 'an der Esse liegt Elara, die Esse lodert nicht');
  H.run('window.__knopf()');
  for (let i = 0; i < 20 && !H.run(`!!${GSC}.__finaleLoesen`); i++) H.step(1);
  const vorher = esse();
  H.run(`(function () { var h = ${GSC}.__finaleLoesen; player.setPosition(h.x, h.y + 70); player.body.reset(player.x, player.y); })()`);
  taste(true);
  for (let i = 0; i < 400 && H.run(`!!${GSC}.__finaleLoesen && ${GSC}.__finaleLoesen.fortschritt < 0.5`); i++) H.step(1);
  esseUeber(['esseBindung', 'esseGlut', 'esseZug'], 'letzter Schlag');
  for (let i = 0; i < 400 && H.run(`!!${GSC}.__finaleLoesen`); i++) H.step(1);
  taste(false);
  assert.strictEqual(H.run(`!!${GSC}.__finaleLoesen`), false, 'der letzte Schlag geht nicht durch');
  H.step(2);
  esseUeber(['esseRisse', 'esseNebelRing'], 'Zerbrechen');
  const nach = esse();
  assert.strictEqual(nach.key, 'esse_zerbrochen');
  assert.strictEqual(nach.zustand, 'zerbrochen');
  // Das Flackern ist vorbei: auch spaeter kein anderes Bild.
  H.step(60);
  assert.strictEqual(esse().key, 'esse_zerbrochen');
  for (let i = 0; i < 300 && esse().glut; i++) H.step(2);
  const ende = esse();
  assert.strictEqual(ende.glut, null, 'die Glut brennt nach dem Schlag weiter');
  assert.deepStrictEqual([ende.ort.x, ende.ort.y], [vorher.glut.x, vorher.glut.y], 'der Ort der Esse wandert mit der Glut weg');
  assert.ok(ende.koerper, 'die Truemmer haben keinen Koerper');
});

test('Nach dem Urteil steht die Esse zerbrochen, ohne Glut', () => {
  stand({ harren_dead: true, elara_besiegt: true, elara_spared: true });
  arenaBetreten();
  const e = esse();
  assert.strictEqual(e.key, 'esse_zerbrochen');
  assert.strictEqual(e.glut, null);
  assert.ok(e.koerper);
});

test('Harren steht und liegt nicht auf dem Sockel der Esse', () => {
  arenaBetreten();
  const r = H.run(`(function () { var sc = ${GSC}, e = window.FinaleHandwerk.ort(sc), kb = sc._esseKoerper.getBounds(), rand = 22;
    var drin = [];
    [-1, 1].forEach(function (seite) {
      player.setPosition(e.x + seite * 200, e.y + 80); player.body.reset(player.x, player.y);
      var w = window.Finale.harrenWeg(sc, e.x + 74, e.y + 18, e);
      ['ziel', 'start', 'liegt'].forEach(function (k) {
        var p = w[k];
        if (p.x > kb.left - rand && p.x < kb.right + rand && p.y > kb.top - rand && p.y < kb.bottom + rand) drin.push(seite + ':' + k + ' ' + p.x + ',' + p.y);
      });
    });
    return drin; })()`);
  assert.strictEqual(r.length, 0, 'Harren auf dem Sockel: ' + Array.from(r).join('; '));
});

test('Ersatz: ohne Bild das alte Leuchten, kein Koerper, Zustandswechsel tut nichts', () => {
  stand({});
  H.run(`(function () { var sc = ${GSC}; ['esse_intakt', 'esse_flackern', 'esse_zerbrochen'].forEach(function (k) { if (sc.textures.exists(k)) sc.textures.remove(k); }); })()`);
  arenaBetreten();
  const e = esse();
  assert.strictEqual(e.bild, false);
  assert.strictEqual(e.koerper, null);
  assert.ok(e.glut && e.glut.tiefe === 31, 'kein altes Leuchten: ' + JSON.stringify(e.glut));
  assert.strictEqual(H.run(`window.FinaleHandwerk.esseZustand(${GSC}, 'flackern')`), false);
});
