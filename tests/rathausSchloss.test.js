// tests/rathausSchloss.test.js — das Kettenschloss an der Rathaustuer (b480).
//
// Nach dem Bruch (Flag enttarnt, Hub-Phase 'broken') haengt der Rat seine
// Kette vor das Rathaus. Bis b479 hing sie an der TUERZONE — die liegt zum
// Hingehen auf dem Vorplatz, und so baumelten Bretter und Kette ueber der
// Treppe, ein gutes Stueck unter und rechts neben der gemalten Tuer.
// Geprueft wird darum am Bild, nicht an abgeschriebenen Zahlen:
//   - das Tuerblatt aus der Karte (portal, Bildpixel) liegt im Rathausbild
//     wirklich auf Holz, nicht auf Stein,
//   - im laufenden Hub sitzt das Schloss auf diesem Tuerblatt, ueber der
//     Fassade und hinter den Figuren, und nur in der Phase 'broken'.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { launch } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const HUB = `window.game.scene.getScene('HubSceneV2')`;

function laden(datei) {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', datei), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
  return fenster;
}

function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

test('das Tuerblatt der Karte liegt im Rathausbild auf Holz', async () => {
  const fenster = laden('hubNeuKarte.js');
  const K = fenster.HUB_NEU_KARTE;
  const rh = K.haeuser.find((h) => h.bild === 'hub_rathaus_sockel');
  assert.ok(rh && rh.portal, 'Rathaus ohne portal in der Karte');
  const { data, info } = await sharp(path.join(WURZEL, 'assets', 'hub', 'rathaus_sockel.png'))
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  // Holz ist warm (rot ueber blau), der Stein drumherum kalt.
  const waerme = (x0, y0, b, h) => {
    let s = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + b; x++) {
      const i = (y * info.width + x) * 4;
      s += data[i] - data[i + 2]; n++;
    }
    return s / n;
  };
  const p = rh.portal;
  // Innen (ohne den Rand, der die Laibung streift) ist es Holz, und das
  // ganze Blatt ist deutlich waermer als gleich grosser Stein daneben.
  const innen = waerme(p.x + 2, p.y + 4, p.b - 4, p.h - 8);
  const blatt = waerme(p.x, p.y, p.b, p.h);
  assert.ok(innen > 3, 'portal liegt nicht auf dem Tuerholz (' + innen + ')');
  [-30, 30].forEach((dx) => {
    const stein = waerme(p.x + dx, p.y, p.b, p.h);
    assert.ok(blatt - stein > 8, 'Gegenprobe ' + dx + ': kein Unterschied zum Stein daneben');
  });
});

test('phasenAnker rechnet das Tuerblatt wie das Hausbild um', () => {
  const W = laden('hubNeuKarte.js');
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', 'hubNeuWelt.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(W, {});
  const K = W.HUB_NEU_KARTE;
  const d = fs.readFileSync(path.join(WURZEL, 'assets', 'hub', 'rathaus_sockel.png'));
  const m = { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
  const a = W.HubNeuWelt.phasenAnker((k) => (k === 'hub_rathaus_sockel' ? m : null));
  const t = a.rathausTuer;
  assert.ok(t, 'kein rathausTuer');
  const rh = K.haeuser.find((h) => h.bild === 'hub_rathaus_sockel');
  const s = rh.breite * K.kachel / m.w;
  const links = rh.x * K.kachel - m.w * s / 2, oben = rh.y * K.kachel - m.h * s;
  assert.ok(Math.abs(t.x - (links + rh.portal.x * s)) < 1e-6);
  assert.ok(Math.abs(t.y - (oben + rh.portal.y * s)) < 1e-6);
  assert.strictEqual(t.tiefe, rh.y * K.kachel, 'tiefe = Standlinie des Rathauses');
  // Das Tuerblatt steht IM Haus, ueber seiner Standlinie — nicht auf dem Vorplatz.
  assert.ok(t.y + t.h <= rh.y * K.kachel, 'Tuerblatt reicht unter die Standlinie');
  const zone = a.rathausEntrance;
  assert.ok(t.y + t.h <= zone.y, 'Tuerblatt liegt in der Tuerzone (Vorplatz) statt am Haus');
  // Ohne Bildmasse kein Tuerblatt — aber auch kein Absturz.
  assert.strictEqual(W.HubNeuWelt.phasenAnker().rathausTuer, null);
});

describe('im laufenden Hub', () => {
  let H = null;
  before(async () => {
    H = await launch({ search: '?debug=1', renderer: 'canvas', waitFor: 'StartScene' });
    run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
    H.run(`window.game.scene.start('HubSceneV2')`);
    assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
    H.step(10);
  });
  after(async () => { if (H) await H.shutdown(); });

  function schloss() {
    return run(H, `(function () {
      var sc = ${HUB}, s = sc._rathausSchloss;
      var rathaus = sc.children.list.filter(function (o) { return o.texture && o.texture.key === 'hub_rathaus_sockel'; })[0];
      var out = { phase: sc._hubPhase, tuer: sc._hubPhaseRefs.rathausTuer,
        geladen: sc.textures.exists('hub_rathaus_schloss'),
        rathausTiefe: rathaus ? rathaus.depth : null, schloss: null };
      if (s && s.active) {
        var b = s.getBounds();
        out.schloss = { key: s.texture ? s.texture.key : null, x: b.x, y: b.y, w: b.width, h: b.height,
          tiefe: s.depth, sichtbar: s.visible, sf: s.scrollFactorX };
      }
      return out;
    })()`);
  }

  test('vor dem Bruch haengt kein Schloss', () => {
    const z = schloss();
    assert.notStrictEqual(z.phase, 'broken', 'neuer Spielstand sollte nicht gebrochen sein');
    assert.strictEqual(z.schloss, null);
    ['council', 'doubleAgent', 'epilogue'].forEach((p) => {
      H.run(`${HUB}.previewPhase('${p}')`);
      assert.strictEqual(schloss().schloss, null, p + ': Schloss sichtbar');
    });
  });

  test('nach dem Bruch sitzt das Schloss auf der gemalten Tuer', () => {
    H.run(`${HUB}._phasenVorschau = false`);
    H.run(`window.questSystem.setFlag('enttarnt')`);
    H.run(`${HUB}._naechstePhasenPruefung = 0`);
    H.step(3);
    const z = schloss();
    assert.strictEqual(z.phase, 'broken', 'enttarnt -> broken');
    assert.ok(z.geladen, 'Textur hub_rathaus_schloss nicht geladen');
    const s = z.schloss, t = z.tuer;
    assert.ok(s, 'kein Schloss in broken');
    assert.strictEqual(s.key, 'hub_rathaus_schloss', 'Bild statt Ersatzzeichnung erwartet');
    assert.ok(s.sichtbar, 'Schloss unsichtbar');
    assert.strictEqual(s.sf, 1, 'Schloss muss weltfest sein');
    // Mitte des Schlosses im Tuerblatt, und es ueberdeckt das Blatt.
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    assert.ok(cx > t.x && cx < t.x + t.w && cy > t.y && cy < t.y + t.h,
      'Schlossmitte ' + [cx, cy] + ' nicht im Tuerblatt ' + JSON.stringify(t));
    const ux = Math.min(s.x + s.w, t.x + t.w) - Math.max(s.x, t.x);
    const uy = Math.min(s.y + s.h, t.y + t.h) - Math.max(s.y, t.y);
    assert.ok(ux * uy > 0.6 * t.w * t.h, 'Schloss deckt das Tuerblatt kaum');
    // Nicht breiter als das Portal samt Bogen, nicht unter der Standlinie.
    assert.ok(s.w < t.w * 2.5, 'Schloss ragt weit ueber die Tuer hinaus');
    assert.ok(s.y + s.h <= z.rathausTiefe + 1, 'Schloss haengt unter dem Haus auf dem Vorplatz');
    // Ueber der Fassade, hinter jeder Figur auf der Terrasse (Tuerzone ab y=131).
    assert.ok(s.tiefe > z.rathausTiefe, 'Schloss liegt hinter dem Rathaus');
    assert.ok(s.tiefe < 131, 'Schloss laege vor Figuren auf der Terrasse');
  });

  // Spieler in die Tuerzone, die Box ueber dem Kopf lesen — der echte Weg.
  function boxAnDerTuer() {
    return run(H, `(function () {
      var sc = ${HUB};
      var e = sc.entranceLabels.filter(function (x) { return x.data.id === 'rathaus_entrance'; })[0];
      var b = e.zone.getBounds();
      sc.player.setPosition(b.centerX, b.centerY);
      if (sc.player.body) sc.player.body.reset(b.centerX, b.centerY);
      sc._dialogOpen = false;
      sc._refreshInteractionPrompt();
      return { text: sc.prompt.text, sichtbar: sc.prompt.visible, typ: sc._activeInteractable && sc._activeInteractable.type };
    })()`);
  }

  test('die Box an der Tuer nennt die Kette, der Keller bleibt offen', () => {
    // Die Box zeigt die Taste selbst an; das [E] des Schilds faellt weg.
    const t = (k) => run(H, `window.i18n.t('${k}')`).replace(/\s*\[E\]$/, '');
    const zu = boxAnDerTuer();
    assert.strictEqual(zu.typ, 'entrance');
    assert.strictEqual(zu.text, t('hub.entrance.rathaus.verkettet'), 'broken: ' + zu.text);
    assert.notStrictEqual(zu.text, t('hub.entrance.rathaus'));
    H.run(`${HUB}.previewPhase('council')`);
    assert.strictEqual(boxAnDerTuer().text, t('hub.entrance.rathaus'), 'council: alter Text');
    H.run(`${HUB}.previewPhase('broken')`);
  });

  test('Phasenwechsel raeumt das Schloss ab', () => {
    H.run(`${HUB}.previewPhase('epilogue')`);
    assert.strictEqual(schloss().schloss, null);
    H.run(`${HUB}.previewPhase('broken')`);
    assert.ok(schloss().schloss, 'Schloss kommt zurueck');
  });
});
