// tests/spionageFigurenStil.test.js: die eigenen Bilder der Spionage-Figuren
// und der Nachteskorte (PixelLab, tools/spionageFigurenBauen.js).
//
// Vorher standen dort umgetoente Hub-Figuren (die Toenung greift im
// Canvas-Renderer nicht: der Geleerte war ein brauner Buerger), ein Ritter als
// Fuhrmann und gezeichnete Kisten/Pulte. Geprueft wird je Figur: ihr eigener
// Schluessel, eine Groesse neben dem Spieler (54), keine Toenung, Gehbilder
// beim Gehen — und der Rueckfall auf das alte Bild, wenn das neue fehlt.
// Zeit nur per H.step.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const { launchDungeon, flush } = require('../tools/headless/index.js');

const GS = "window.game.scene.getScene('GameScene')";

async function bis(H, js, runden, jeRunde) {
  for (let i = 0; i < (runden || 600); i++) {
    if (H.run(js)) return true;
    if (jeRunde) H.run(jeRunde);
    H.step(2);
    await flush();
  }
  return false;
}

async function szeneWeg(H) {
  await bis(H, `!!${GS}.__spionSzene`, 400);
  H.run(`${GS}.__spionSzene && ${GS}.__spionSzene.ueberspringen && ${GS}.__spionSzene.ueberspringen()`);
  H.run(`${GS}.input.keyboard.emit('keydown', { key: 'Escape', keyCode: 27 })`);
  await bis(H, `!${GS}.__spionSzene`, 300);
}

// Je Spionage-Figur: Typ, Bild, sichtbare Hoehe, Toenung, Beiwerk (Kiste/Pult).
const FIGUREN = `(function () {
  var gs = ${GS}, s = window.EspionageSystem.getState();
  var spr = gs.children.list.filter(function (o) { return o.type === 'Sprite' && o.depth === 522 && o !== window.player; });
  // Die Figur zu einem Akteur: das Sprite an seiner Stelle (Geleerte buecken sich um bis zu 3 px).
  var zu = function (a) { return spr.filter(function (o) { return Math.abs(o.x - a.x) < 0.5 && Math.abs(o.y - a.y) <= 3.5; })[0]; };
  var bilder = gs.children.list.filter(function (o) { return o.type === 'Image'; }).map(function (o) { return o.texture.key; });
  return JSON.stringify({ figuren: s.actors.map(function (a) {
    var o2 = zu(a); return { typ: a.type, key: o2.texture.key, h: Math.round(o2.displayHeight), getoent: o2.isTinted }; }), beiwerk: bilder }); })()`;

describe('Nachteskorte: eigene Bilder in der Umschlagstelle', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 16, zusatz: '&debug=1&eskorte=1' });
    H.run('window._playerInvincible = true; window.SpionageSzenen._TEMPO = 0.2');
    await szeneWeg(H);
    await bis(H, `(function () { var s = window.Nachteskorte.getState();
      return s && s.teile.fuhrmann && s.teile.fuhrmann.texture.key.indexOf('spion_fig_') === 0 && !!s.teile.schachtBild && !!s.teile.waage; })()`, 600);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Fuhrmann, Geleerte als Traeger, Karren, Waage und Schacht tragen ihre eigenen Bilder', () => {
    const r = JSON.parse(H.run(`(function () { var t = window.Nachteskorte.getState().teile, out = {};
      ['fuhrmann', 'traeger1', 'traeger2', 'karren', 'waage', 'schachtBild'].forEach(function (k) { var o = t[k];
        out[k] = o ? { key: o.texture.key, h: Math.round(o.displayHeight), getoent: o.isTinted } : null; });
      var sch = window.Nachteskorte.getState().schacht;
      out.schachtGezeichnet = ${GS}.children.list.some(function (o) {
        return o.type === 'Graphics' && o.depth === 31 && o.x === sch.x && o.y === sch.y; });
      return JSON.stringify(out); })()`));
    assert.strictEqual(r.fuhrmann.key, 'spion_fig_fuhrmann_right0');
    assert.strictEqual(r.traeger1.key, 'spion_fig_geleerter_right0');
    assert.strictEqual(r.traeger2.key, 'spion_fig_geleerter_right0');
    assert.strictEqual(r.karren.key, 'eskorte_karren_neu');
    assert.strictEqual(r.waage.key, 'eskorte_waage_bild');
    assert.strictEqual(r.schachtBild.key, 'eskorte_schacht_bild');
    assert.ok(!r.schachtGezeichnet, 'der gezeichnete Schacht liegt noch darunter');
    // Neben dem Spieler (54): nicht mehr die 72 der Hub-Bilder.
    for (const k of ['fuhrmann', 'traeger1', 'traeger2']) {
      assert.ok(r[k].h >= 48 && r[k].h <= 58, k + ' ist ' + r[k].h + ' px hoch');
      assert.ok(!r[k].getoent, k + ' ist getoent (wirkt im Canvas-Renderer nicht)');
    }
    assert.ok(r.karren.h >= 54 && r.karren.h <= 70, 'Karren ' + r.karren.h);
  });

  test('die Spionage-Figuren im Raum: eigene Bilder, eigene Requisiten', () => {
    const r = JSON.parse(H.run(FIGUREN));
    assert.deepStrictEqual(r.figuren.map((f) => f.typ).sort(), ['geleerter', 'geleerter', 'ratsbote', 'schreiber']);
    for (const f of r.figuren) {
      assert.ok(f.key.indexOf('spion_fig_' + f.typ + '_') === 0, f.typ + ' traegt ' + f.key);
      assert.ok(f.h >= 48 && f.h <= 58, f.typ + ' ist ' + f.h + ' px hoch');
      assert.ok(!f.getoent || f.typ === 'ratsbote', f.typ + ' ist getoent');
    }
    assert.ok(r.beiwerk.includes('spion_req_phiolenkiste'), 'die Geleerten arbeiten nicht an Phiolenkisten');
    assert.ok(r.beiwerk.includes('spion_req_pult'), 'der Schreiber hat kein Pult');
    assert.ok(!r.beiwerk.includes('esp_kiste') && !r.beiwerk.includes('esp_pult'), 'gezeichnete Requisiten: ' + r.beiwerk.join(','));
  });

  test('faehrt der Karren, gehen Fuhrmann und Traeger (Gehbilder)', async () => {
    H.run('(function () { var s = window.Nachteskorte.getState(); s.tempo = 200; s.frist = 99; })()');
    H.run(`(function () { var z = window.EspionageSystem.getState().observeZones.filter(function (o) { return o.questTarget === 'eskorte_verladung'; })[0];
      z._done = true; z._fxDone = true; })()`);
    const neben = `(function () { var s = window.Nachteskorte.getState(); player.setPosition(s.pos.x, s.pos.y + 30); })()`;
    const keys = new Set();
    const ok = await bis(H, `(function () { var t = window.Nachteskorte.getState().teile;
      return /walk_right/.test(t.fuhrmann.texture.key) && /walk_right/.test(t.traeger1.texture.key); })()`, 600,
      neben + `; window.__nkKeys = (window.__nkKeys || []).concat([window.Nachteskorte.getState().teile.fuhrmann.texture.key])`);
    assert.ok(ok, 'keine Gehbilder waehrend der Fahrt');
    for (let i = 0; i < 60; i++) { H.run(neben); H.run(`window.__nkKeys.push(window.Nachteskorte.getState().teile.fuhrmann.texture.key)`); H.step(2); await flush(); }
    JSON.parse(H.run('JSON.stringify(window.__nkKeys)')).forEach((k) => keys.add(k));
    const gang = [...keys].filter((k) => /walk_right/.test(k));
    assert.ok(gang.length >= 3, 'der Gang wechselt die Bilder nicht: ' + gang.join(','));
    // Hoehe bleibt beim Gehen (gemeinsamer Ausschnitt aller Bilder).
    const h = H.run(`Math.round(window.Nachteskorte.getState().teile.fuhrmann.displayHeight)`);
    assert.ok(h >= 48 && h <= 58, 'Fuhrmann gehend ' + h);
  });

  test('fehlt das eigene Bild, gilt das alte (Fuhrmann, Schreiber)', async () => {
    H.run(`(function () { var gs = ${GS}, t = window.Nachteskorte.getState().teile;
      // Erst weg von den Bildern, die gleich fehlen, dann entfernen.
      t.fuhrmann.setTexture('garde');
      var spr = gs.children.list.filter(function (o) { return o.type === 'Sprite' && o.depth === 522 && o !== window.player; });
  // Die Figur zu einem Akteur: das Sprite an seiner Stelle (Geleerte buecken sich um bis zu 3 px).
  var zu = function (a) { return spr.filter(function (o) { return Math.abs(o.x - a.x) < 0.5 && Math.abs(o.y - a.y) <= 3.5; })[0]; };
      var s = window.EspionageSystem.getState();
      s.actors.forEach(function (a) { if (a.type === 'schreiber') spr.filter(function (o) { return Math.abs(o.x - a.x) < 0.5 && Math.abs(o.y - a.y) < 0.5; })[0].setTexture('esp_figur_fallback'); });
      Object.keys(gs.textures.list).forEach(function (k) {
        if (k.indexOf('spion_fig_fuhrmann_') === 0 || k.indexOf('spion_fig_schreiber_') === 0) gs.textures.remove(k); });
    })()`);
    for (let i = 0; i < 6; i++) { H.step(2); await flush(); }
    const r = JSON.parse(H.run(`(function () { var f = window.Nachteskorte.getState().teile.fuhrmann;
      var fig = JSON.parse(${FIGUREN}).figuren.filter(function (x) { return x.typ === 'schreiber'; })[0];
      return JSON.stringify({ fuhrmann: f.texture.key, fh: Math.round(f.displayHeight), schreiber: fig.key }); })()`));
    assert.strictEqual(r.fuhrmann, 'garde');
    assert.strictEqual(r.fh, 72);
    assert.strictEqual(r.schreiber, 'vorleser_alter');
  });
});

describe('Spionage-Lager: der Traeger traegt seine Kiste selbst', () => {
  let H = null;
  before(async () => {
    H = await launchDungeon({ depth: 3, zusatz: '&debug=1&spy=lager&spyseed=7' });
    H.run('window._playerInvincible = true; window.SpionageSzenen._TEMPO = 0.2');
    await szeneWeg(H);
    await bis(H, `${FIGUREN}.indexOf('spion_fig_traeger') !== -1`, 600);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('Traeger und Ratsbote mit eigenen Bildern, keine aufgeklebte Kiste', () => {
    const r = JSON.parse(H.run(FIGUREN));
    const tr = r.figuren.filter((f) => f.typ === 'traeger');
    assert.ok(tr.length >= 1, 'kein Traeger im Lager');
    for (const f of r.figuren.filter((x) => x.typ === 'traeger' || x.typ === 'ratsbote')) {
      assert.ok(f.key.indexOf('spion_fig_' + f.typ + '_') === 0, f.typ + ' traegt ' + f.key);
      assert.ok(f.h >= 48 && f.h <= 60, f.typ + ' ist ' + f.h + ' px hoch');
    }
    assert.ok(!r.beiwerk.includes('esp_kiste'), 'die gezeichnete Kiste klebt noch am Traeger');
  });

  test('der Ratsbote geht mit Gehbildern', async () => {
    const keys = [];
    for (let i = 0; i < 300; i++) {
      const k = JSON.parse(H.run(FIGUREN)).figuren.filter((f) => f.typ === 'ratsbote')[0].key;
      keys.push(k);
      if (new Set(keys.filter((x) => /walk_right/.test(x))).size >= 3) break;
      H.run('player.setPosition(40, 40)');
      H.step(2); await flush();
    }
    assert.ok(new Set(keys.filter((x) => /walk_right/.test(x))).size >= 3, 'Ratsbote ohne Gang: ' + [...new Set(keys)].join(','));
  });
});
