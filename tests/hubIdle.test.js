// tests/hubIdle.test.js — Idle-Schleifen der Hub-Figuren (#194, fest seit b391).
//
// Jede Figur spielt jede Figur (die neun NPC, die Patrouillen, die
// Epilog-Vorleser) eine kurze Schleife. Geprueft am laufenden Hub:
//   - jede Figur zeigt ueber die Zeit mehrere Bilder (H.step, eine Uhr),
//   - Lage, Groesse und [E]-Zone sind GENAU die des Standbilds — verglichen
//     mit einem Hub ohne Streifen (Rueckfall), nicht mit abgeschriebenen Zahlen,
//   - die Figuren laufen nicht im Gleichschritt (eigene Startphase, fest).
// Rueckfall ohne Streifen: keine Schleife, jede Figur zeigt ihr Standbild.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const { launch } = require('../tools/headless/index.js');

const HUB = `window.game.scene.getScene('HubSceneV2')`;

/** H.run, Ergebnis aus dem vm-Realm geholt (deepStrictEqual vergleicht sonst Prototypen). */
function run(H, js) {
  const v = H.run(js);
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

async function hubStarten(search, ohneStreifen) {
  const H = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  run(H, `(window.SlotStorage || localStorage).setItem('demonfall_seen_intro_splash', '1')`);
  if (ohneStreifen) run(H, `window.HubIdle.vorladen = function () { return 0; }; 1`);
  H.run(`window.game.scene.start('HubSceneV2')`);
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  H.step(10);
  // Patrouillen (nach der geheimen Sitzung) und drei Vorleser (Epilog) dazu.
  run(H, `(function () {
    var qs = window.questSystem, st = qs.getQuestSaveData();
    st.flags = st.flags || {}; st.flags.patrouillen_verdoppelt = true;
    qs.loadQuestSaveData(st);
    var sc = ${HUB};
    sc._patrouillenAufstellen();
    var echt = window.HubPhase.epilogVorleser, phase = sc._hubPhase;
    window.HubPhase.epilogVorleser = function () { return 3; };
    sc._hubPhase = 'epilogue';
    try { sc._vorleserAufstellen(); } finally { window.HubPhase.epilogVorleser = echt; sc._hubPhase = phase; }
  })()`);
  return H;
}

/** Alle Figuren mit Lage, Groesse, Bild und Schleife. */
function figuren(H) {
  return run(H, `(function () {
    var sc = ${HUB};
    var still = {};
    window.HUB_HITBOXES.npcs.forEach(function (n) { still[n.id] = n.texture; });
    function m(s, name, standbild) {
      var a = s.anims && s.anims.currentAnim;
      return { name: name, standbild: standbild, typ: s.type, x: s.x, y: s.y,
        w: s.displayWidth, h: s.displayHeight, ox: s.originX, oy: s.originY,
        fw: s.frame.width, fh: s.frame.height, key: s.texture.key, bild: s.frame.name,
        schleife: a ? a.key : null, laeuft: !!(s.anims && s.anims.isPlaying),
        sichtbar: s.visible && s.active };
    }
    var out = [];
    (sc.npcs || []).forEach(function (e) { var id = e.sprite.getData('id'); out.push(m(e.sprite, id, still[id])); });
    (sc._patrouillen || []).forEach(function (s, i) { out.push(m(s, 'patrouille' + i, 'patrouille')); });
    var plaetze = window.HubNeuWelt.phasenAnker().vorleser;
    (sc._vorleser || []).forEach(function (s, i) { out.push(m(s, 'vorleser' + i, plaetze[i].bild)); });
    return out;
  })()`);
}

function zonen(H) {
  return run(H, `${HUB}.npcGroup.getChildren().map(function (z) { return [z.x, z.y, z.width, z.height]; })`);
}

function standbildMass(H, keys) {
  return run(H, `(function () { var t = ${HUB}.textures, o = {};
    ${JSON.stringify(keys)}.forEach(function (k) { var f = t.getFrame(k); o[k] = f ? [f.width, f.height] : null; });
    return o; })()`);
}

describe('Rueckfall: Streifen fehlen', () => {
  let H = null, f = null;
  before(async () => { H = await hubStarten('?debug=1', true); f = figuren(H); });
  after(async () => { if (H) await H.shutdown(); });

  test('ohne Streifen keine Schleife, jede Figur zeigt ihr Standbild', () => {
    const geladen = run(H, `${HUB}.textures.getTextureKeys().filter(function (k) { return k.indexOf('hubidle_') === 0; })`);
    assert.deepStrictEqual(geladen, [], 'Streifen trotz Rueckfall geladen: ' + geladen.join(', '));
    assert.ok(f.length >= 14, 'nur ' + f.length + ' Figuren aufgestellt');
    f.forEach((x) => {
      assert.strictEqual(x.schleife, null, x.name + ' spielt ' + x.schleife);
      assert.strictEqual(x.key, x.standbild, x.name + ' zeigt ' + x.key + ' statt des Standbilds');
    });
  });

});

describe('Idle-Schleifen (fest, ohne Flagge)', () => {
  let H = null, ohne = null, ohneZonen = null, mit = null;
  before(async () => {
    const O = await hubStarten('?debug=1', true);
    try { ohne = figuren(O); ohneZonen = zonen(O); } finally { await O.shutdown(); }
    H = await hubStarten('?debug=1');
    mit = figuren(H);
  });
  after(async () => { if (H) await H.shutdown(); });

  test('jede Figur hat ihre Schleife: neun NPC, zwei Patrouillen, drei Vorleser', () => {
    const namen = mit.map((x) => x.name);
    ['branka', 'thom', 'mara', 'aldric', 'elara', 'harren', 'klerus_priester', 'stadtwache', 'buerger',
      'patrouille0', 'patrouille1', 'vorleser0', 'vorleser1', 'vorleser2'].forEach((n) => {
      assert.ok(namen.indexOf(n) >= 0, n + ' steht nicht im Hub');
    });
    mit.forEach((x) => assert.ok(x.schleife && x.schleife.indexOf('hubidle_') === 0,
      x.name + ' hat keine Idle-Schleife (' + x.schleife + ')'));
  });

  test('jede sichtbare Figur bewegt sich und steht zwischendurch still', () => {
    // Zwischen zwei Durchlaeufen steht jede Figur 2,5 bis 6,5 s still
    // (HubIdle.pause). Gemessen ueber rund 16 s: jede zeigt mehrere Bilder,
    // und jede steht mindestens einmal 2 s am Stueck auf demselben Bild.
    const gesehen = {}, still = {}, letzt = {}, seit = {};
    for (let r = 0; r < 160; r++) {
      H.step(6);   // ~0,1 s je Runde
      figuren(H).forEach((x) => {
        if (!x.sichtbar) return;
        (gesehen[x.name] = gesehen[x.name] || new Set()).add(x.bild);
        if (letzt[x.name] === x.bild) seit[x.name] = (seit[x.name] || 0) + 1;
        else { letzt[x.name] = x.bild; seit[x.name] = 0; }
        still[x.name] = Math.max(still[x.name] || 0, seit[x.name]);
      });
    }
    const namen = Object.keys(gesehen);
    assert.ok(namen.length >= 8, 'nur ' + namen.length + ' sichtbare Figuren — der Fall misst zu wenig');
    namen.forEach((n) => assert.ok(gesehen[n].size >= 6, n + ' zeigte nur ' + gesehen[n].size + ' Bilder'));
    namen.forEach((n) => assert.ok(still[n] >= 20, n + ' stand nie 2 s still (laengstens ' + (still[n] / 10).toFixed(1) + ' s)'));
  });

  test('die Pausen sind je Figur verschieden und fest', () => {
    const p = run(H, `window.HubIdle.FIGUREN.map(function (f, i) { return window.HubIdle.pause(i, 0); })`);
    p.forEach((ms) => assert.ok(ms >= 2500 && ms <= 6500, 'Pause ' + ms + ' ms ausserhalb 2,5..6,5 s'));
    assert.ok(new Set(p).size >= 5, 'zu wenig verschiedene Pausen: ' + p.join(','));
    assert.deepStrictEqual(run(H, `window.HubIdle.FIGUREN.map(function (f, i) { return window.HubIdle.pause(i, 0); })`), p);
  });

  test('Lage, Groesse und Fusspunkt gleich wie das Standbild', () => {
    assert.strictEqual(mit.length, ohne.length, 'andere Zahl Figuren');
    const mass = standbildMass(H, mit.map((x) => x.standbild));
    mit.forEach((x) => {
      const o = ohne.find((y) => y.name === x.name);
      assert.ok(o, x.name + ' fehlt im Rueckfall');
      for (const k of ['x', 'y', 'ox', 'oy']) assert.strictEqual(x[k], o[k], x.name + ' ' + k + ': ' + x[k] + ' statt ' + o[k]);
      for (const k of ['w', 'h']) assert.ok(Math.abs(x[k] - o[k]) < 0.01, x.name + ' ' + k + ': ' + x[k] + ' statt ' + o[k]);
      // Jedes Schleifenbild hat das Mass des Standbilds.
      assert.deepStrictEqual([x.fw, x.fh], mass[x.standbild], x.name + ' Bildmass');
    });
  });

  test('die [E]-Zonen sind dieselben', () => {
    assert.deepStrictEqual(zonen(H), ohneZonen);
  });

  test('die Figuren laufen nicht im Gleichschritt', () => {
    const jetzt = figuren(H).filter((x) => x.sichtbar);
    const bilder = new Set(jetzt.map((x) => x.bild));
    assert.ok(bilder.size >= 3, 'alle ' + jetzt.length + ' Figuren zeigen nur ' + bilder.size + ' verschiedene Bilder');
    // Frisch aufgestellt: die beiden Patrouillen (gleiches Bild) starten versetzt, fest und ohne Zufall.
    const p = run(H, `(function () { var sc = ${HUB}; sc._patrouillenAufstellen();
      return sc._patrouillen.map(function (s) { return s.frame.name; }); })()`);
    assert.strictEqual(p.length, 2);
    assert.notStrictEqual(p[0], p[1], 'beide Patrouillen starten mit Bild ' + p[0]);
    const p2 = run(H, `(function () { var sc = ${HUB}; sc._patrouillenAufstellen();
      return sc._patrouillen.map(function (s) { return s.frame.name; }); })()`);
    assert.deepStrictEqual(p2, p, 'Startphase nicht fest');
  });
});
