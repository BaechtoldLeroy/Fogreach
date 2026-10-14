// tests/bossZwischenszene.test.js — Zwischenszene vor dem ersten Kampf
// gegen jeden Boss (js/bossZwischenszene.js).
//
// Haeufigkeit: beim ersten Kampf die Szene, danach der Banner; gemerkt als
// Quest-Flag bossintro_<bossId> im Spielstand. ?boss= zeigt sie immer.
// Der Testkopf schaltet die Szene sonst ab (ohneBossIntro); hier ist sie an.
// Je Boss: die Szene laeuft, die Spieluhr steht, die Plakette
// zeigt Siegel, Name und Beiname, der Boss spricht Seite fuer Seite (weiter
// per Taste und per Klick), ESC und der Knopf "Ueberspringen" beenden
// jederzeit, danach ist alles zurueckgedreht und der Boss greift an. Keine
// eckigen Klammern, Kontrast >= 4,5:1, Knoepfe >= 44 px, scrollFactor 0.
// Fehlen die Bilder, laeuft die Szene trotzdem (schlichte Plakette).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launchDungeon } = require('../tools/headless/index.js');
const { kontraste, alleLesbar } = require('./kontrastMessung.js');

const SC = "window.game.scene.getScene('GameScene')";
const BOSSE = ['chainMaster', 'ceremonyMaster', 'shadowCouncillor', 'elaraBesessen'];
const schritte = (ms) => Math.ceil(ms / 16.666);
const ZS = `${SC}.__bossZwischenszene`;

// Mit Zwischenszene starten (der Testkopf schaltet sie sonst ab).
const starten = (zusatz) => launchDungeon({ depth: 10, zusatz: zusatz || '', ohneBossIntro: false });

/**
 * Boss erzwingen und erscheinen lassen; das Finale (Elara) haelt nicht auf.
 * gesehen: false (Standard) = erste Begegnung, das Merk-Flag wird geloescht.
 */
function boss(H, id, gesehen) {
  H.lab.clearEnemies();
  H.run(`(function () {
    window._playerInvincible = true;
    if (!${!!gesehen}) window.questSystem.setFlag(window.BossZwischenszene.merkFlagge('${id}'), false);
    window.__echtFinale = window.__echtFinale || (window.Finale && window.Finale.vorKampf);
    if (window.Finale) window.Finale.vorKampf = function () { return false; };
    debugForcedBoss = function () { return BOSS_DEFINITIONS['${id}']; };
  })()`);
  const r = H.lab.spawnBoss();
  assert.ok(!r.error, r.error);
  return r;
}

function lage(H) {
  return JSON.parse(H.run(`(function () {
    var sc = ${SC}, z = sc.__bossZwischenszene, kam = sc.cameras.main;
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    return JSON.stringify({
      phase: z ? z.phase : null, seite: z ? z.seite : null, seiten: z ? z.seiten : null,
      pausiert: window.__GAME_PAUSE.since != null, zeitAus: !!sc.time.paused,
      laeuft: !!sc.__bossIntroLaeuft, wahl: !!window.eventChoiceOpen,
      halt: b ? b._introHaltBis : null, muster: b ? b.patternIndex : null,
      folgt: kam._follow === player, zoom: kam.zoom
    });
  })()`));
}

function taste(H, key) { H.run(`${SC}.input.keyboard.emit('keydown', { key: '${key}' })`); }
function klick(H) { H.run(`${SC}.input.emit('pointerdown', ${SC}.input.activePointer)`); }
function knopfDruck(H, name) {
  H.run(`(function () { var k = ${SC}.children.getByName('${name}');
    k.emit('pointerdown', ${SC}.input.activePointer, 0, 0, { stopPropagation: function () { window.__gestoppt = true; } }); })()`);
}
function texte(H) {
  return JSON.parse(H.run(`JSON.stringify(${SC}.children.list.filter(function (o) {
    return o.type === 'Text' && /^bossintro/.test(o.name || '') && o.visible; }).map(function (o) { return o.text; }))`));
}

/** Bis die Rede steht (oder Abbruch). */
function bisRede(H) {
  for (let i = 0; i < 200 && lage(H).phase !== 'rede'; i++) H.step(5);
  H.step(schritte(400));          // Eingabesperre der Seite abwarten
}
/** Bis die Szene fertig ist. */
function bisEnde(H) {
  for (let i = 0; i < 200 && lage(H).laeuft; i++) H.step(5);
}

describe('Haeufigkeit: erster Kampf Szene, danach Banner', () => {
  let H = null;
  before(async () => { H = await starten(); });
  after(async () => { if (H) await H.shutdown(); });

  const banner = () => JSON.parse(H.run(`JSON.stringify(${SC}.children.list.filter(function (o) {
    return o.type === 'Text' && o.depth === 1100; }).map(function (o) { return o.text; }))`));

  test('keine Vorschau-Flagge mehr: weder in der Liste noch noetig', () => {
    assert.strictEqual(H.run(`/[?&]bossintro=/.test(location.search)`), false);
    assert.strictEqual(typeof H.run('window.BossZwischenszene.aktiv'), 'undefined', 'Flaggen-Abfrage noch da');
    const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'debugGate.js'), 'utf8');
    assert.ok(!/'bossintro'/.test(quelle), 'bossintro steht noch in BEKANNTE_FLAGGEN');
  });

  test('der erste Kampf gegen einen Boss zeigt die Szene und merkt es im Spielstand', () => {
    assert.strictEqual(H.run(`window.questSystem.hasFlag('bossintro_ceremonyMaster')`), false, 'Aufbau: frischer Spielstand');
    boss(H, 'ceremonyMaster', true);    // NICHT zuruecksetzen: echter erster Kampf
    assert.strictEqual(lage(H).phase, 'auftritt', 'erster Kampf ohne Szene');
    assert.strictEqual(H.run(`window.questSystem.hasFlag('bossintro_ceremonyMaster')`), true, 'nicht gemerkt');
    // Im Spielstand: die Quest-Daten tragen das Flag, auch nach dem Laden.
    const r = JSON.parse(H.run(`(function () { var Q = window.questSystem, d = Q.getQuestSaveData();
      var vorher = !!d.flags.bossintro_ceremonyMaster;
      Q.loadQuestSaveData(JSON.parse(JSON.stringify(d)));
      return JSON.stringify({ vorher: vorher, nachher: Q.hasFlag('bossintro_ceremonyMaster') }); })()`));
    assert.deepStrictEqual(r, { vorher: true, nachher: true });
    taste(H, 'Escape');
    bisEnde(H);
  });

  test('beim zweiten Kampf gegen denselben Boss nur der kurze Banner', () => {
    boss(H, 'ceremonyMaster', true);
    H.step(3);
    const l = lage(H);
    assert.strictEqual(l.phase, null, 'Szene ein zweites Mal');
    assert.strictEqual(l.pausiert, false, 'Spieluhr angehalten');
    assert.strictEqual(l.halt, undefined, 'Boss stillgelegt');
    assert.ok(banner().includes('Zeremonienmeister'), 'Banner fehlt: ' + banner());
  });

  test('ein anderer Boss bekommt trotzdem seine erste Szene', () => {
    boss(H, 'shadowCouncillor', true);
    assert.strictEqual(lage(H).phase, 'auftritt', 'Szene fuer neuen Boss fehlt');
    taste(H, 'Escape');
    bisEnde(H);
  });
});

describe('Zwischenszene je Boss', () => {
  let H = null;
  before(async () => { H = await starten(); });
  after(async () => { if (H) await H.shutdown(); });

  test('alle Siegel und Effekte sind vorgeladen', () => {
    const fehlt = H.run(`(function () { var B = window.BossZwischenszene, sc = ${SC}, k = [];
      Object.keys(B.BOSSE).forEach(function (id) { k.push(B.siegelKey(B.BOSSE[id].siegel), B.vfxKey(B.BOSSE[id].vfx)); });
      return k.filter(function (x) { return !sc.textures.exists(x); }).join(','); })()`);
    assert.strictEqual(fehlt, '');
  });

  for (const id of BOSSE) {
    test(id + ': Szene, Plakette, Seiten per Taste und Klick, danach Kampf', () => {
      boss(H, id);
      let l = lage(H);
      assert.strictEqual(l.phase, 'auftritt', 'Szene laeuft nicht an');
      assert.strictEqual(l.pausiert, true, 'Spieluhr laeuft weiter');
      assert.strictEqual(l.zeitAus, true, 'scene.time laeuft weiter');
      assert.strictEqual(l.wahl, true, 'Kampfeingabe nicht gesperrt');
      assert.ok(l.halt > 1e12, 'Boss nicht stillgelegt');
      assert.strictEqual(l.folgt, false, 'Kamera folgt weiter dem Spieler');

      // Die uebrige Oberflaeche ist aus, nur die Szene steht ueber 1000.
      const fremd = H.run(`${SC}.children.list.filter(function (o) { return o.visible && o.scrollFactorX === 0
        && o.depth >= 1000 && ${ZS}.teile.indexOf(o) < 0; }).length`);
      assert.strictEqual(fremd, 0, 'HUD steht noch im Bild');

      // Ein noch fliegender Tastendruck blaettert nichts weg.
      taste(H, 'Enter');
      assert.strictEqual(lage(H).phase, 'auftritt', 'Tastendruck sofort nach dem Start wirkt');

      bisRede(H);
      l = lage(H);
      assert.strictEqual(l.phase, 'rede');
      assert.strictEqual(l.seite, 0);
      assert.strictEqual(l.seiten, 2);
      assert.ok(Math.abs(l.zoom - 1) < 0.01, 'Zoom steht bei der Rede nicht wieder auf 1: ' + l.zoom);
      const t = texte(H);
      const name = H.run(`BOSS_DEFINITIONS['${id}'].name`);
      assert.ok(t.includes(name), 'Name fehlt: ' + t);
      assert.ok(t.includes(name.toUpperCase()), 'Sprecher fehlt: ' + t);
      assert.ok(t.length >= 6, 'Plakette/Rede unvollstaendig: ' + t);
      t.forEach((s) => assert.ok(!/[[\]]/.test(s), 'eckige Klammer: ' + s));
      const siegel = H.run(`(function () { var s = ${SC}.children.getByName('bossintroSiegel'); return s ? s.texture.key : null; })()`);
      assert.strictEqual(siegel, H.run(`window.BossZwischenszene.siegelKey(window.BossZwischenszene.BOSSE['${id}'].siegel)`));
      const fx = H.run(`${SC}.children.list.filter(function (o) { return o.texture && /^bossintro_vfx_/.test(o.texture.key) && o.active; }).length`);
      if (id !== 'chainMaster') assert.strictEqual(fx, 1, 'Effekt fehlt');   // Ketten-Risse sind einmalig und schon vorbei

      // Knoepfe: >= 44 px, alles ohne Bildlauf.
      const k = JSON.parse(H.run(`JSON.stringify(['bossintroWeiter', 'bossintroUeberspringen'].map(function (n) {
        var o = ${SC}.children.getByName(n); return { h: o.height, s: o.scrollFactorX, i: !!o.input }; }))`));
      k.forEach((x) => { assert.ok(x.h >= 44, 'Knopf zu flach: ' + x.h); assert.ok(x.i, 'Knopf nicht klickbar'); });
      const bildlauf = H.run(`${SC}.children.list.filter(function (o) { return o.visible && o.depth >= 1098 && o.depth < 1110 && o.scrollFactorX !== 0; }).length`);
      assert.strictEqual(bildlauf, 0, 'Teil der Szene laeuft mit der Kamera mit');

      // Seite 2 per Taste, Ende per Klick.
      taste(H, 'Enter');
      assert.strictEqual(lage(H).seite, 1, 'Taste blaettert nicht');
      H.step(schritte(400));
      klick(H);
      assert.strictEqual(lage(H).phase, 'ausklang', 'Klick beendet die letzte Seite nicht');
      bisEnde(H);
      l = lage(H);
      assert.strictEqual(l.laeuft, false);
      assert.strictEqual(l.pausiert, false, 'Spieluhr bleibt stehen');
      assert.strictEqual(l.wahl, false, 'Kampfeingabe bleibt gesperrt');
      assert.strictEqual(l.halt, 0, 'Boss bleibt stillgelegt');
      assert.strictEqual(l.folgt, true, 'Kamera folgt nicht wieder dem Spieler');
      assert.strictEqual(l.zoom, 1);
      assert.strictEqual(H.run(`${SC}.children.list.filter(function (o) { return /^bossintro/.test(o.name || ''); }).length`), 0, 'Reste der Szene');
      const hud = H.run(`${SC}.children.list.filter(function (o) { return o.visible && o.scrollFactorX === 0 && o.depth >= 1000; }).length`);
      assert.ok(hud > 5, 'HUD kommt nicht zurueck: ' + hud);
      // Der Kampf laeuft: der Boss greift an.
      for (let i = 0; i < 100 && !(lage(H).muster > 0); i++) H.step(5);
      assert.ok(lage(H).muster > 0, 'Boss greift nach der Szene nicht an');
    });
  }

  test('ESC ueberspringt schon waehrend des Auftritts', () => {
    boss(H, 'chainMaster');
    H.step(schritte(200));
    taste(H, 'Escape');
    assert.strictEqual(lage(H).phase, 'ausklang');
    bisEnde(H);
    const l = lage(H);
    assert.strictEqual(l.pausiert, false);
    assert.strictEqual(l.halt, 0);
  });

  test('der Knopf Ueberspringen beendet, ohne dass der Klick zusaetzlich blaettert', () => {
    boss(H, 'shadowCouncillor');
    bisRede(H);
    H.run('window.__gestoppt = false');
    knopfDruck(H, 'bossintroUeberspringen');
    assert.strictEqual(H.run('window.__gestoppt'), true, 'Klick laeuft bis zur Szene durch');
    assert.strictEqual(lage(H).phase, 'ausklang');
    bisEnde(H);
    assert.strictEqual(lage(H).pausiert, false);
  });

  test('der Weiter-Knopf blaettert genau eine Seite', () => {
    boss(H, 'ceremonyMaster');
    bisRede(H);
    knopfDruck(H, 'bossintroWeiter');
    assert.strictEqual(lage(H).seite, 1);
    taste(H, 'Escape');
    bisEnde(H);
  });

  test('Kontrast >= 4,5:1 fuer Plakette, Rede und Knoepfe', () => {
    boss(H, 'elaraBesessen');
    bisRede(H);
    alleLesbar(kontraste(H, `${SC}.children.list.filter(function (o) { return o.type === 'Text' && /^bossintro/.test(o.name || ''); })`), 'Zwischenszene');
    taste(H, 'Escape');
    bisEnde(H);
  });

  test('Elara: nach dem Finale an der Quelle folgt die Zwischenszene', () => {
    H.lab.clearEnemies();
    H.run(`(function () {
      window.questSystem.setFlag('bossintro_elaraBesessen', false);
      window.Finale.vorKampf = function (sc, b, weiter) { window.__finaleWeiter = weiter; return true; };
      debugForcedBoss = function () { return BOSS_DEFINITIONS.elaraBesessen; };
    })()`);
    H.lab.spawnBoss();
    assert.strictEqual(lage(H).phase, null, 'Szene startet vor dem Finale');
    H.run('window.__finaleWeiter()');
    assert.strictEqual(lage(H).phase, 'auftritt', 'Szene folgt dem Finale nicht');
    taste(H, 'Escape');
    bisEnde(H);
  });

  test('Rueckfall ohne Bilder: Szene laeuft mit schlichter Plakette', () => {
    H.run(`(function () { var sc = ${SC};
      sc.textures.getTextureKeys().filter(function (k) { return /^bossintro_/.test(k) || /^ui_/.test(k); })
        .forEach(function (k) { sc.textures.remove(k); }); })()`);
    boss(H, 'chainMaster');
    bisRede(H);
    const l = lage(H);
    assert.strictEqual(l.phase, 'rede');
    assert.strictEqual(H.run(`!!${SC}.children.getByName('bossintroSiegel')`), false);
    assert.ok(texte(H).includes('Kettenmeister'));
    taste(H, 'Enter'); H.step(schritte(400)); taste(H, 'Enter');
    bisEnde(H);
    assert.strictEqual(lage(H).pausiert, false);
  });
});

// Der Weg, auf dem der Fehler im Browser auffiel (b424): ?boss= setzt den
// Boss noch im create() der Szene — vor Minikarte und Raumbalken, und bevor
// der Nebel irgendetwas erkundet hat. Die Welt war schwarz, die Minikarte
// lag ueber der Plakette.
describe('Debug-Weg: Boss per ?boss= beim Betreten des Raums', () => {
  let H = null;
  before(async () => {
    H = await starten('&debug=1&boss=kettenmeister');
    H.run('window._playerInvincible = true');
  });
  after(async () => { if (H) await H.shutdown(); });

  const sicht = () => JSON.parse(H.run(`(function () {
    var sc = ${SC}, kam = sc.cameras.main, bd = kam.getBounds ? kam.getBounds() : kam._bounds;
    var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
    var licht = sc.children.getByName('bossintroLicht');
    var lb = b.getBounds();
    return JSON.stringify({
      nebel: !!(sc.fogUnseen && sc.fogUnseen.visible), spot: !!(sc.spotlightDim && sc.spotlightDim.visible),
      maskeBoss: !!b.mask, maskeEbene: !!(sc.enemyLayer && sc.enemyLayer.mask),
      licht: licht ? { x: licht.x, y: licht.y, a: licht.alpha } : null, boss: { x: lb.centerX, y: lb.centerY },
      karte: !!(sc._minimapRT && sc._minimapRT.visible), rahmen: !!(sc._minimapBorder && sc._minimapBorder.visible),
      balken: !!(window._roomProgressGfx && window._roomProgressGfx.visible),
      kam: { x: kam.worldView.x, y: kam.worldView.y, w: kam.worldView.width, h: kam.worldView.height },
      grenzen: { x: bd.x, y: bd.y, w: bd.width, h: bd.height }
    });
  })()`));

  test('Minikarte und Raumbalken (erst nach dem Boss entstanden) sind waehrend der Szene aus', () => {
    const s = sicht();
    assert.strictEqual(s.karte, false, 'Minikarte sichtbar');
    assert.strictEqual(s.rahmen, false, 'Rahmen der Minikarte (graues Rechteck) sichtbar');
    assert.strictEqual(s.balken, false, 'Raumbalken (Punktreihe) sichtbar');
    // Was jetzt erst entsteht, faellt ebenso weg.
    H.run(`window.__spaet = ${SC}.add.rectangle(900, 60, 80, 80, 0x666666).setScrollFactor(0).setDepth(1500)`);
    H.step(1);
    assert.strictEqual(H.run('window.__spaet.visible'), false, 'spaet entstandenes HUD bleibt sichtbar');
  });

  test('Nebel, Spotlight und Sichtmaske treten zurueck, der Lichtkreis liegt auf dem Boss', () => {
    const s = sicht();
    assert.strictEqual(s.nebel, false, 'Kriegsnebel deckt die Szene zu');
    assert.strictEqual(s.spot, false, 'Spotlight dunkelt die Szene ab');
    assert.strictEqual(s.maskeBoss, false, 'Sichtmaske verdeckt den Boss');
    assert.strictEqual(s.maskeEbene, false, 'Sichtmaske der Gegnerebene verdeckt den Boss');
    assert.ok(s.licht, 'kein Lichtkreis');
    assert.ok(s.licht.a > 0.9, 'Lichtkreis nicht eingeblendet');
    assert.ok(Math.hypot(s.licht.x - s.boss.x, s.licht.y - s.boss.y) < 40, 'Lichtkreis nicht am Boss: ' + JSON.stringify(s));
  });

  test('die Plakette verdeckt den Kopf des Bosses nicht und Name/Beiname passen hinein', () => {
    const r = JSON.parse(H.run(`(function () {
      var sc = ${SC}, kam = sc.cameras.main;
      var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0].getBounds();
      var kopf = { x: b.x - kam.scrollX, y: b.y - kam.scrollY, w: b.width, h: b.height * 0.3 };
      var t = ['bossintroName', 'bossintroBeiname'].map(function (n) { return sc.children.getByName(n).getBounds(); });
      var p = sc.children.list.filter(function (o) { return sc.__bossZwischenszene.teile.indexOf(o) >= 0 && o.type === 'Image'
        && o.depth === 1101; })[0].getBounds();
      return JSON.stringify({ kopf: kopf, platte: { x: p.x, y: p.y, w: p.width, h: p.height },
        texte: t.map(function (q) { return { x: q.x, r: q.right }; }) });
    })()`));
    const k = r.kopf, p = r.platte;
    const schneidet = k.x < p.x + p.w && p.x < k.x + k.w && k.y < p.y + p.h && p.y < k.y + k.h;
    assert.strictEqual(schneidet, false, 'Plakette ueber dem Kopf: ' + JSON.stringify(r));
    r.texte.forEach((t) => assert.ok(t.r <= p.x + p.w - 8, 'Text ragt aus der Plakette: ' + JSON.stringify(r)));
  });

  // Der graue Streifen rechts (Browser, b424): dieser Raum ist schmaler als
  // das Bild (768 gegen 960 px). Die Kamera bleibt in ihren Grenzen, zeigt
  // aber zwangslaeufig ueber den Raum hinaus. Dort, wo sonst der Nebel
  // deckt, muss jetzt der Lichtkreis dunkel decken — das ganze Bild lang.
  test('die Kamera bleibt beim Schwenk in den Grenzen, und was ueber den Raum hinausragt, deckt der Lichtkreis', () => {
    // Neu ansetzen: die erste Szene stand nach dem Aufwaermen schon bei der Rede.
    taste(H, 'Escape'); bisEnde(H);
    // Die Raeume sind zufaellig; der schmale Fall wird hergestellt: Kamera-
    // grenzen schmaler als das Bild, wie im gemeldeten Raum.
    H.run(`(function () { var k = ${SC}.cameras.main, b = k.getBounds();
      window.__grenzenVorher = [b.x, b.y, b.width, b.height]; k.setBounds(b.x, b.y, 768, b.height); })()`);
    boss(H, 'chainMaster');
    assert.ok(lage(H).laeuft, 'Szene laeuft nicht');
    let schmal = false;
    for (let i = 0; i < 160 && lage(H).phase !== 'rede'; i++) {
      H.step(2);
      const s = sicht();
      const r = H.run(`(function () { var l = ${SC}.children.getByName('bossintroLicht'); if (!l) return null;
        var b = l.getBounds(); return JSON.stringify({ x: b.x, y: b.y, r: b.right, u: b.bottom }); })()`);
      const L = r ? JSON.parse(r) : null;
      const k = s.kam, g = s.grenzen, rand = 1;
      // Der Zoom-Stoss verkleinert die Ansicht um die Mitte: Mass ist die Ansicht bei Zoom 1.
      if (g.w >= k.w) assert.ok(k.x >= g.x - rand && k.x + k.w <= g.x + g.w + rand, 'Kamera links/rechts ausserhalb: ' + JSON.stringify(s));
      else schmal = true;
      if (g.h >= k.h) assert.ok(k.y >= g.y - rand && k.y + k.h <= g.y + g.h + rand, 'Kamera oben/unten ausserhalb: ' + JSON.stringify(s));
      else schmal = true;
      assert.ok(L && L.x <= k.x && L.y <= k.y && L.r >= k.x + k.w && L.u >= k.y + k.h,
        'Lichtkreis deckt nicht das ganze Bild: ' + JSON.stringify({ kam: k, licht: L }));
    }
    assert.strictEqual(lage(H).phase, 'rede');
    assert.ok(schmal, 'Aufbau: dieser Raum sollte schmaler sein als das Bild');
    H.run(`${SC}.cameras.main.setBounds.apply(${SC}.cameras.main, window.__grenzenVorher)`);
  });

  test('ein Boss mit eigener Sichtmaske steht ohne sie in der Szene und bekommt sie danach zurueck', () => {
    taste(H, 'Escape'); bisEnde(H);
    const r = JSON.parse(H.run(`(function () {
      var sc = ${SC}, b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
      var m = sc._enemyVisionMask; b.setMask(m);
      window.BossZwischenszene.spiele(sc, b, BOSS_DEFINITIONS.chainMaster);
      var waehrend = !!b.mask;
      window.__bossMaske = m; window.__maskenBoss = b;
      return JSON.stringify({ hatte: !!m, waehrend: waehrend });
    })()`));
    assert.ok(r.hatte, 'Aufbau: keine Sichtmaske in der Szene');
    assert.strictEqual(r.waehrend, false, 'Sichtmaske verdeckt den Boss in der Szene');
    taste(H, 'Escape'); bisEnde(H);
    assert.strictEqual(H.run('window.__maskenBoss.mask === window.__bossMaske'), true, 'Boss bekommt seine Sichtmaske nicht zurueck');
  });

  // Wie im Browser gesehen: der Boss steht oben an der Wand, die Kamera kann
  // ihn nicht in die Mitte holen — die Plakette muss nach unten ausweichen.
  test('steht der Boss oben am Raumrand, weicht die Plakette nach unten aus', () => {
    taste(H, 'Escape'); bisEnde(H);
    H.run(`(function () {
      var sc = ${SC}, g = sc.cameras.main.getBounds();
      window.__lab = window.__lab || { refs: [] };
      enemies.getChildren().slice().forEach(function (e) { try { e.destroy(); } catch (x) {} });
      debugForcedBoss = function () { return BOSS_DEFINITIONS.chainMaster; };
      // Spieler an die obere Wand: spawnBoss setzt den Boss in seine Naehe.
      player.setPosition(g.x + g.width / 2, g.y + 90); if (player.body) player.body.reset(player.x, player.y);
      sc.cameras.main.centerOn(player.x, player.y);
      window.__between = Phaser.Math.Between;
      Phaser.Math.Between = function (a) { return a < 0 ? -40 : 0; };
    })()`);
    try { H.lab.spawnBoss(); } finally { H.run('Phaser.Math.Between = window.__between'); }
    bisRede(H);
    const r = JSON.parse(H.run(`(function () {
      var sc = ${SC}, kam = sc.cameras.main;
      var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0].getBounds();
      var p = sc.children.list.filter(function (o) { return sc.__bossZwischenszene.teile.indexOf(o) >= 0 && o.type === 'Image' && o.depth === 1101; })[0].getBounds();
      return JSON.stringify({ kopf: { x: b.x - kam.worldView.x, y: b.y - kam.worldView.y, w: b.width, h: b.height * 0.3 },
        platte: { x: p.x, y: p.y, w: p.width, h: p.height }, h: kam.height });
    })()`));
    const k = r.kopf, p = r.platte;
    assert.ok(k.y < r.h * 0.35, 'Aufbau: Boss steht nicht oben: ' + JSON.stringify(r));
    const schneidet = k.x < p.x + p.w && p.x < k.x + k.w && k.y < p.y + p.h && p.y < k.y + k.h;
    assert.strictEqual(schneidet, false, 'Plakette ueber dem Kopf: ' + JSON.stringify(r));
    assert.ok(p.y > r.h / 2, 'Plakette ist nicht nach unten ausgewichen: ' + JSON.stringify(r));
    taste(H, 'Escape'); bisEnde(H);
  });

  test('ein zu langer Name wird in die Plakette eingepasst', () => {
    H.run(`(function () { var b = enemies.getChildren().filter(function (x) { return x && x.isBoss; })[0];
      window.BossZwischenszene.spiele(${SC}, b, { id: 'shadowCouncillor',
        name: 'Ein ausserordentlich langer Name fuer einen Boss aus dem Kettenrat' }); })()`);
    bisRede(H);
    const r = JSON.parse(H.run(`(function () { var sc = ${SC};
      var p = sc.children.list.filter(function (o) { return sc.__bossZwischenszene.teile.indexOf(o) >= 0 && o.type === 'Image' && o.depth === 1101; })[0].getBounds();
      var n = sc.children.getByName('bossintroName').getBounds();
      return JSON.stringify({ r: n.right, p: p.right, l: n.x, pl: p.x }); })()`));
    assert.ok(r.r <= r.p - 8 && r.l >= r.pl, 'Name ragt aus der Plakette: ' + JSON.stringify(r));
    taste(H, 'Escape'); bisEnde(H);
  });

  test('?boss= zeigt die Szene immer, auch wenn sie im Spielstand schon gesehen ist', () => {
    taste(H, 'Escape'); bisEnde(H);
    assert.strictEqual(H.run(`window.questSystem.hasFlag('bossintro_chainMaster')`), true, 'Aufbau: schon gesehen');
    boss(H, 'chainMaster', true);
    assert.strictEqual(lage(H).phase, 'auftritt', 'Debug-Weg zeigt die Szene nicht');
    taste(H, 'Escape'); bisEnde(H);
  });

  test('danach kommt alles zurueck: HUD, Nebel, Spotlight, Sichtmaske', () => {
    taste(H, 'Escape');
    bisEnde(H);
    const s = sicht();
    assert.strictEqual(s.karte, true, 'Minikarte fehlt danach');
    assert.strictEqual(s.rahmen, true);
    assert.strictEqual(s.balken, true);
    assert.strictEqual(H.run('window.__spaet.visible'), true, 'spaet entstandenes HUD fehlt danach');
    assert.strictEqual(s.nebel, true, 'Kriegsnebel fehlt danach');
    assert.strictEqual(s.spot, true, 'Spotlight fehlt danach');
    assert.strictEqual(s.licht, null, 'Lichtkreis bleibt liegen');
    H.step(3);
    assert.strictEqual(sicht().maskeEbene, true, 'Sichtmaske der Gegnerebene kommt nicht zurueck');
  });
});

// Standbilder je Boss (Auftritt + Plakette) nach vorschau/, nur auf Wunsch.
if (process.env.VORSCHAU) {
  test('Standbilder', async () => {
    const H = await starten();
    const ziel = path.join(__dirname, '..', 'vorschau');
    fs.mkdirSync(ziel, { recursive: true });
    const bild = (n) => {
      H.run(`${SC}.children.list.forEach(function (o) { if (o.type === 'Graphics' && o.scrollFactorX !== 0 && o.depth >= 1000) o.visible = false; })`);
      H.step(1);
      fs.writeFileSync(path.join(ziel, n + '.png'), H.window.game.canvas.toBuffer('image/png'));
    };
    try {
      for (const id of BOSSE) {
        boss(H, id);
        H.step(schritte(1050)); bild('bossintro_' + id + '_auftritt');
        H.step(schritte(1100)); bild('bossintro_' + id + '_plakette');
        taste(H, 'Escape'); bisEnde(H);
      }
    } finally { await H.shutdown(); }
  });
}
