// tests/finaleTableau.test.js — echte Bilder im wichtigsten Moment (b501).
//
// Vorher war Harren ein grau getoentes Bild, das glitt und zum Sterben um
// 90 Grad gedreht wurde, Elara wurde zur Besessenheit nur violett getoent und
// gross gezogen, die Kniende war gestaucht, Mara rutschte als Standbild herein,
// Hammer und Klinge waren Rechtecke. Jetzt (PixelLab, tools/finaleBilderBauen.js):
//   * acht Tableaus (384x192) an den Momenten: hammer, lene, stoss, esse;
//     bruch, urteil, verschonen/richten (js/finaleTableau.js)
//   * Figuren mit eigenen Bildern: Harren geht und faellt, Elara verwandelt
//     sich, Elara kniet (und atmet), Mara geht
//   * Hammer und Elaras Klinge (mit der Gravur der drei Ketten) als Bilder
// Geprueft: die Dateien, die Tableaus an den richtigen Schritten mit dem
// richtigen Stand der Figuren, die Bedienung wie im Wiedersehen (erste Taste
// zeigt die Zeile ganz, die naechste geht weiter, ESC beendet, der ausloesende
// Druck zaehlt nicht), Spieluhr und Angriffe stehen. Zeit nur per H.step.
// Die Reihenfolge der Tableaus samt Flaggen prueft tests/finaleQuelle.test.js.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launchDungeon } = require('../tools/headless/index.js');

const GSC = "window.game.scene.getScene('GameScene')";
const WURZEL = path.join(__dirname, '..');
const TABLEAUS = ['hammer', 'lene', 'stoss', 'esse', 'bruch', 'urteil', 'verschonen', 'richten'];

/** Text-Metadaten in einer PNG (tEXt, iTXt, zTXt, eXIf)? */
function hatMetadaten(datei) {
  const b = fs.readFileSync(datei);
  for (let o = 8; o < b.length;) {
    const len = b.readUInt32BE(o), typ = b.toString('latin1', o + 4, o + 8);
    if (/^(tEXt|iTXt|zTXt|eXIf)$/.test(typ)) return true;
    if (typ === 'IEND') break;
    o += 12 + len;
  }
  return false;
}

describe('Die Dateien', () => {
  test('acht Tableaus, 384x192 wie das Wiedersehen, ohne Metadaten', async () => {
    const ref = await sharp(path.join(WURZEL, 'assets/sprites/wiedersehen/wiedersehen_licht.png')).metadata();
    for (const n of TABLEAUS) {
      const datei = path.join(WURZEL, 'assets/sprites/finale/tableau_' + n + '.png');
      assert.ok(fs.existsSync(datei), 'es fehlt ' + datei);
      const m = await sharp(datei).metadata();
      assert.deepStrictEqual([m.width, m.height], [ref.width, ref.height], n);
      assert.strictEqual(hatMetadaten(datei), false, n + ' traegt Metadaten');
    }
  });

  test('je Figur ein gemeinsamer Ausschnitt, Hammer und Klinge stehen aufrecht', async () => {
    const ordner = path.join(WURZEL, 'assets/sprites/finale/figuren');
    for (const f of fs.readdirSync(ordner)) {
      const masse = new Set();
      for (const d of fs.readdirSync(path.join(ordner, f))) {
        const m = await sharp(path.join(ordner, f, d)).metadata();
        masse.add(m.width + 'x' + m.height);
        assert.strictEqual(hatMetadaten(path.join(ordner, f, d)), false, f + '/' + d);
      }
      assert.strictEqual(masse.size, 1, f + ': verschiedene Ausschnitte springen beim Wechsel ' + [...masse]);
    }
    for (const d of ['hammer', 'klinge']) {
      const m = await sharp(path.join(WURZEL, 'assets/finale/' + d + '.png')).metadata();
      assert.ok(m.height > m.width, d + ' liegt quer: ' + m.width + 'x' + m.height);
    }
  });
});

/** Was gerade steht: Tableau, Blase, Figuren. */
function lage(H) {
  return H.run(`(function () { var sc = ${GSC}, t = sc.__finaleTableau, d = sc.__finaleBlase;
    var key = function (n) { var o = sc.children.getByName(n); return o && o.active ? o.texture.key : null; };
    // Wo die Figur steht und welche Animation laeuft (fuer die Gehrichtung).
    var zug = function (n) { var o = sc.children.getByName(n); if (!o || !o.active) return null;
      var a = o.anims && o.anims.isPlaying && o.anims.currentAnim; return { x: o.x, y: o.y, anim: a ? a.key : null, flip: o.flipX }; };
    var bild = t && t.bild;
    var alle = [];
    if (t) (function sammle(o) { alle.push(o); if (o.list) o.list.forEach(sammle); })(t.container);
    return {
      tableau: t ? t.name : null, phase: t ? t.phase : null, laeuft: !!(t && t.lauf && t.lauf.laeuft()),
      bild: bild ? { key: bild.texture.key, w: bild.frame.width, h: bild.frame.height, breite: Math.round(bild.displayWidth) } : null,
      nichtFest: alle.filter(function (o) { return o.scrollFactorX !== 0 || o.scrollFactorY !== 0; }).length,
      ueberspringen: !!(t && alle.some(function (o) { return o.name === 'finaleTableauUeberspringen'; })),
      text: t ? t.text : null, kamB: sc.cameras.main.width,
      blase: d ? d.text : null, offen: !!window.eventChoiceOpen,
      pause: !!(window.__GAME_PAUSE && window.__GAME_PAUSE.since != null),
      hz: zug('finaleHarren'), mz: zug('finaleMara'),
      harren: key('finaleHarren'), elara: key('finaleElara'), elaraFall: key('finaleElaraFall'), mara: key('finaleMara'),
      harrenTot: window.questSystem.hasFlag('harren_dead'), genommen: !!sc.__quelleNahmSie,
      gerichtet: window.questSystem.hasFlag('elara_killed'), verschont: window.questSystem.hasFlag('elara_spared')
    }; })()`);
}
const taste = (H, k) => H.run(`${GSC}.input.keyboard.emit('keydown', { key: '${k}', keyCode: ${k === 'Escape' ? 27 : 32}, repeat: false })`);

/**
 * Laeuft durch das Finale, bis `ende(l)` stimmt. Blasen werden weitergetippt
 * (Wahl n), an jedem Tableau ruft es bei(name, l) und blaettert es dann weg.
 * Merkt sich, welche Bilder die Figuren unterwegs trugen.
 */
function durch(H, bei, ende, wahl) {
  const gesehen = { harren: new Set(), elara: new Set(), elaraFall: new Set(), mara: new Set() };
  const tableaus = [];
  // Schritte, in denen Harren bzw. Mara sich bewegten: Weg, Animation, Bild.
  const schritte = { harren: [], mara: [] }, vorher = {};
  H.lab.zuElara();   // die Szene beginnt erst, wenn Elara im Bild steht
  for (let i = 0; i < 6000; i++) {
    H.step(1);
    const l = lage(H);
    Object.keys(gesehen).forEach((k) => { if (l[k]) gesehen[k].add(l[k]); });
    [['harren', l.hz], ['mara', l.mz]].forEach(([n, z]) => {
      const v = vorher[n];
      if (z && v && Math.hypot(z.x - v.x, z.y - v.y) > 0.5) schritte[n].push({ dx: z.x - v.x, dy: z.y - v.y, anim: z.anim, flip: z.flip, bild: l[n] });
      vorher[n] = z;
    });
    if (ende(l)) return { gesehen, tableaus, schritte, l };
    if (l.tableau && tableaus[tableaus.length - 1] !== l.tableau) {
      tableaus.push(l.tableau);
      if (bei) bei(l.tableau, l);
      if (H.run(`!!${GSC}.__finaleTableau`)) H.lab.tableauWeg();
      continue;
    }
    if (l.blase && i % 15 === 14) {
      const n = H.run(`${GSC}.__finaleBlase ? ${GSC}.__finaleBlase.wahlen.length : 0`);
      H.lab.blaseTippen(n > 1 ? (wahl || 0) : 0);
    }
  }
  return { gesehen, tableaus, schritte, l: lage(H) };
}

/**
 * Jeder Schritt, den die Figur geht, laeuft in der Animation der Richtung,
 * in die sie sich bewegt (nicht in den Suedost-Bildern, gespiegelt). Das
 * letzte Stueck (zum Ziel gesetzt, schon im Standbild) zaehlt nicht, ebenso
 * Schritte, deren Animation `ohne` trifft (etwa das Fallen).
 */
function gehtInRichtung(H, schritte, figur, ohne) {
  const gehend = schritte.filter((s) => !/_stand$/.test(s.bild || '') && !(ohne && ohne.test(s.anim || '')));
  assert.ok(gehend.length >= 5, figur + ' bewegt sich kaum gehend: ' + JSON.stringify(schritte.slice(0, 5)));
  const falsch = gehend.filter((s) => {
    const r = H.run(`window.Finale.gehRichtung(${s.dx}, ${s.dy})`);
    return s.anim !== 'finale_' + figur + '_gehen_' + r || s.flip;
  });
  assert.deepStrictEqual(falsch.slice(0, 3), [], figur + ' geht nicht in Bewegungsrichtung');
}

describe('Vor dem Kampf (?finale=harren)', () => {
  let H = null, lauf = null;
  const bei = {};
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=harren' });
    // Langsamer Aufbau: nach der Sperre (350 ms) steht die Zeile sicher noch nicht ganz.
    H.run("window._playerInvincible = true; window.DialogTypewriter.setzeTempo('langsam')");
    lauf = durch(H, (name, l) => {
      bei[name] = { l };
      // (Das erste Tableau stand schon beim Start; lene kommt mitten im Lauf.)
      if (name === 'lene') {
        // Bedienung: der ausloesende Druck zaehlt nicht ...
        taste(H, ' ');
        bei.lene.gleich = lage(H);
        // ... nach der Sperre zeigt die erste Taste die Zeile ganz ...
        H.step(23);
        bei.lene.vorher = lage(H);
        taste(H, ' ');
        bei.lene.erste = lage(H);
        // ... die naechste geht weiter (das Bild blendet aus).
        taste(H, ' ');
        bei.lene.zweite = lage(H);
        for (let i = 0; i < 200 && H.run(`!!${GSC}.__finaleTableau`); i++) H.step(1);
        bei.lene.danach = lage(H);
      }
      if (name === 'stoss') {
        // ESC beendet das Bild sofort, auch mitten in der Zeile.
        H.step(2);
        bei.stoss.vorEsc = lage(H);
        taste(H, 'Escape');
        bei.stoss.esc = lage(H);
      }
    }, (l) => l.blase && /Kämpfen|keine Archivschmiedin/.test(l.blase));
  });
  after(async () => { if (H) await H.shutdown(); });

  test('vier Tableaus in der Reihenfolge der Geschichte, Bild geladen und bildfuellend, fest am Schirm', () => {
    assert.deepStrictEqual(lauf.tableaus, ['hammer', 'lene', 'stoss', 'esse']);
    for (const n of lauf.tableaus) {
      const l = bei[n].l;
      assert.ok(l.bild && l.bild.key === 'finale_tableau_' + n && l.bild.w === 384 && l.bild.h === 192, n + ': ' + JSON.stringify(l.bild));
      assert.ok(l.bild.breite >= l.kamB, n + ': das Bild fuellt den Schirm nicht: ' + JSON.stringify(l.bild));
      assert.strictEqual(l.nichtFest, 0, n + ': Teile mit scrollFactor != 0 (Taps gehen daneben)');
      assert.ok(l.ueberspringen, n + ': kein Ueberspringen');
      assert.ok(l.offen && l.pause, n + ': Angriffe oder Spieluhr laufen weiter: ' + JSON.stringify(l));
      assert.strictEqual(l.blase, null, n + ': eine Blase steht ueber dem Tableau');
      assert.ok(l.text && l.text.length > 8 && !/[—–]/.test(l.text), n + ': ' + l.text);
    }
  });

  test('die Figuren stehen an jedem Tableau so, wie das Bild es zeigt', () => {
    assert.strictEqual(bei.hammer.l.harren, null, 'Harren ist schon vor dem Hammer da');
    assert.strictEqual(bei.lene.l.harren, 'finale_fig_harren_stand', 'Harren steht nicht vor ihr: ' + bei.lene.l.harren);
    assert.strictEqual(bei.stoss.l.harren, 'finale_fig_harren_fall4', 'Harren liegt nicht: ' + bei.stoss.l.harren);
    assert.strictEqual(bei.stoss.l.harrenTot, false, 'harren_dead schon vor der Seite des Stosses');
    assert.strictEqual(bei.esse.l.genommen, true, 'die Esse hat sie beim Tableau noch nicht genommen');
    assert.strictEqual(bei.esse.l.elara, 'finale_fig_elara_besessen7', 'die Verwandlung ist nicht durch: ' + bei.esse.l.elara);
  });

  test('Harren geht und faellt, Elara verwandelt sich: mit eigenen Bildern', () => {
    const h = [...lauf.gesehen.harren], e = [...lauf.gesehen.elara];
    assert.ok(h.filter((k) => /^finale_fig_harren_gehen(_[a-z]+)?\d$/.test(k)).length >= 4, 'Harren geht nicht: ' + h);
    gehtInRichtung(H, lauf.schritte.harren, 'harren', /_fall/);
    assert.ok(h.filter((k) => /^finale_fig_harren_fall\d$/.test(k)).length >= 3, 'Harren faellt nicht: ' + h);
    assert.ok(e.indexOf('finale_fig_elara_stand') >= 0, 'Elara steht nicht als eigene Figur: ' + e);
    assert.ok(e.filter((k) => /^finale_fig_elara_besessen\d$/.test(k)).length >= 5, 'keine Verwandlung: ' + e);
    const getoent = H.run(`(function () { var sc = ${GSC}; return ['finaleHarren', 'finaleElara'].filter(function (n) {
      var o = sc.children.getByName(n); return o && o.isTinted; }); })()`);
    assert.deepStrictEqual(Array.from(getoent), [], 'getoent statt eigener Bilder');
  });

  test('Bedienung wie im Wiedersehen: Sperre, erste Taste ganz, zweite weiter; ESC beendet', () => {
    const b = bei.lene;
    assert.strictEqual(b.gleich.phase, 'text', 'der ausloesende Druck beendet das Bild');
    assert.strictEqual(b.vorher.laeuft, true, 'die Zeile steht schon ganz da (Test misst nichts)');
    assert.strictEqual(b.erste.laeuft, false, 'die erste Taste zeigt die Zeile nicht ganz');
    assert.strictEqual(b.erste.phase, 'text', 'die erste Taste blaettert schon weiter');
    assert.strictEqual(b.zweite.phase, 'ausklang', 'die zweite Taste geht nicht weiter');
    assert.strictEqual(b.danach.tableau, null);
    assert.strictEqual(b.danach.pause, true, 'zwischen Bild und Blase laeuft die Uhr ...');
    assert.ok(b.danach.blase && /HARREN: Lene/.test(b.danach.blase), '... weil gleich die Seite kommt: ' + JSON.stringify(b.danach));
    assert.strictEqual(bei.stoss.vorEsc.laeuft, true, 'die Zeile (stoss) steht schon ganz da (Test misst nichts)');
    assert.strictEqual(bei.stoss.esc.phase, 'ausklang', 'ESC beendet das Bild nicht');
  });
});

describe('Nach dem Kampf (?finale=urteil), Richten', () => {
  let H = null, lauf = null;
  const bei = {};
  before(async () => {
    H = await launchDungeon({ depth: 30, zusatz: '&debug=1&room=DieQuelle&boss=elara&finale=urteil' });
    H.run('window._playerInvincible = true');
    lauf = durch(H, (name, l) => { bei[name] = l; }, (l) => l.blase && /Geschenk/.test(l.blase), 1);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('bruch, urteil, richten; das Urteil ist gefallen, bevor das Bild kommt', () => {
    assert.deepStrictEqual(lauf.tableaus, ['bruch', 'urteil', 'richten']);
    for (const n of lauf.tableaus) assert.strictEqual(bei[n].bild.key, 'finale_tableau_' + n);
    assert.strictEqual(bei.urteil.gerichtet || bei.urteil.verschont, false, 'gewaehlt vor dem Urteil');
    assert.strictEqual(bei.richten.gerichtet, true, 'elara_killed fehlt beim Bild');
    assert.strictEqual(bei.richten.verschont, false);
  });

  test('Elara kniet als eigene Figur und atmet, Mara geht herein und steht beim Urteil', () => {
    const k = [...lauf.gesehen.elaraFall], m = [...lauf.gesehen.mara];
    assert.ok(k.filter((x) => /^finale_fig_elara_kniend_atmen\d$/.test(x)).length >= 3, 'die Kniende atmet nicht: ' + k);
    assert.ok(m.filter((x) => /^finale_fig_mara_gehen(_[a-z]+)?\d$/.test(x)).length >= 3, 'Mara geht nicht: ' + m);
    gehtInRichtung(H, lauf.schritte.mara, 'mara', null);
    assert.strictEqual(bei.urteil.mara, 'finale_fig_mara_stand', 'Mara steht beim Urteil nicht: ' + bei.urteil.mara);
    // Die Kniende ist kleiner als eine Stehende, aber nicht gestaucht.
    const r = H.run(`(function () { var o = ${GSC}.children.getByName('finaleElaraFall');
      return { h: o.displayHeight, sx: o.scaleX, sy: o.scaleY, p: player.displayHeight }; })()`);
    assert.ok(Math.abs(r.sx - r.sy) < 1e-6, 'gestaucht: ' + JSON.stringify(r));
    assert.ok(r.h < r.p * 0.95 && r.h > r.p * 0.6, 'kniend so gross wie stehend: ' + JSON.stringify(r));
  });

  test('Hammer und Klinge tragen ihre Bilder; die Zeilen gibt es auf Englisch', () => {
    const r = H.run(`(function () { var sc = ${GSC}, F = window.Finale, FH = window.FinaleHandwerk;
      var h = FH.halten(sc, { richtung: 'loesen' }); var bild = sc.children.getByName('esseHammer');
      var aus = { hammer: FH.hammerTextur(sc), hammerBild: bild.texture.key, hammerHoehe: Math.round(bild.frame.height * bild.scaleY),
        klinge: F.klingeTextur(sc), klingeDa: sc.textures.exists(F.KLINGE_BILD) };
      h.abbrechen();
      window.i18n.setLanguage('en'); aus.en = window.FinaleTableau.text('bruch'); window.i18n.setLanguage('de');
      aus.de = window.FinaleTableau.text('bruch');
      return aus; })()`);
    assert.strictEqual(r.hammer, 'finale_hammer_bild');
    assert.strictEqual(r.hammerBild, 'finale_hammer_bild', 'die Halte-Aktion zeigt den gezeichneten Hammer');
    assert.strictEqual(r.hammerHoehe, H.run('window.FinaleHandwerk.HAMMER_HOEHE'));
    assert.strictEqual(r.klinge, 'finale_klinge_bild');
    assert.ok(/Furnace/.test(r.en) && /Esse/.test(r.de), JSON.stringify(r));
  });
});

describe('Ohne Bild geht es weiter', () => {
  let H = null;
  before(async () => { H = await launchDungeon({ depth: 30 }); });
  after(async () => { if (H) await H.shutdown(); });

  test('ein unbekanntes Tableau ruft sofort weiter und haelt nichts an', () => {
    const r = H.run(`(function () { var sc = ${GSC}, weiter = 0;
      var t = window.FinaleTableau.zeigen(sc, 'gibtsnicht', function () { weiter++; });
      return { t: t, weiter: weiter, offen: !!window.eventChoiceOpen, steht: !!sc.__finaleTableau }; })()`);
    assert.strictEqual(JSON.stringify(r), JSON.stringify({ t: null, weiter: 1, offen: false, steht: false }));
  });

  test('alle Figurenbilder sind geladen', () => {
    const fehlt = H.run(`(function () { var sc = ${GSC};
      return window.Finale.figurBilder().filter(function (e) { return !sc.textures.exists(e[0]); }).map(function (e) { return e[0]; }); })()`);
    assert.deepStrictEqual(Array.from(fehlt), []);
  });
});
