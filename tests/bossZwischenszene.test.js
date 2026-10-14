// tests/bossZwischenszene.test.js — Zwischenszene vor jedem Boss
// (Vorschau ?debug=1&bossintro=neu, js/bossZwischenszene.js).
//
// Ohne Flagge: alles wie bisher (Banner, kein Halt, keine Bilder geladen).
// Mit Flagge, je Boss: die Szene laeuft, die Spieluhr steht, die Plakette
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

/** Boss erzwingen und erscheinen lassen; das Finale (Elara) haelt nicht auf. */
function boss(H, id) {
  H.lab.clearEnemies();
  H.run(`(function () {
    window._playerInvincible = true;
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

describe('ohne Flagge: wie bisher', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 10 }); });
  after(async () => { if (H) await H.shutdown(); });

  test('kein Halt, keine Szene, Banner wie gehabt, keine Bilder geladen', () => {
    assert.strictEqual(H.run('window.BossZwischenszene.aktiv()'), false);
    boss(H, 'ceremonyMaster');
    H.step(3);
    const l = lage(H);
    assert.strictEqual(l.phase, null, 'Zwischenszene ohne Flagge');
    assert.strictEqual(l.pausiert, false, 'Spieluhr angehalten ohne Flagge');
    assert.strictEqual(l.halt, undefined, 'Boss stillgelegt ohne Flagge');
    const banner = JSON.parse(H.run(`JSON.stringify(${SC}.children.list.filter(function (o) {
      return o.type === 'Text' && o.depth === 1100; }).map(function (o) { return o.text; }))`));
    assert.ok(banner.includes('Zeremonienmeister'), 'alter Banner fehlt: ' + banner);
    const geladen = H.run(`${SC}.textures.getTextureKeys().filter(function (k) { return /^bossintro_/.test(k); }).length`);
    assert.strictEqual(geladen, 0, 'Bilder ohne Flagge geladen');
  });
});

describe('mit Flagge bossintro=neu', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 10, zusatz: '&debug=1&bossintro=neu' }); });
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

// Standbilder je Boss (Auftritt + Plakette) nach vorschau/, nur auf Wunsch.
if (process.env.VORSCHAU) {
  test('Standbilder', async () => {
    const H = await launchDungeon({ depth: 10, zusatz: '&debug=1&bossintro=neu' });
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
