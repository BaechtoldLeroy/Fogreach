// tests/patrouilleSprite.test.js — Die Patrouillen im Hub (#168).
//
// Nach der geheimen Ratssitzung stehen zwei Patrouillen mehr auf dem Platz.
// Sie trugen das Sprite des Wachtmeisters (der Questgeber ist) — drei gleiche
// Figuren, nur eine antwortet auf [E]. Das eigene Sprite steht vorerst hinter
// ?patrouille=neu.
//
// Unterwegs behoben (gilt auch ohne Flagge): die Patrouillen standen auf
// Koordinaten des alten, gemalten Hubs — die linke UNTER dem Kartenrand — und
// trugen den Faktor des alten Grossbilds (14 px hoch statt 58). Dasselbe galt
// fuer die Vorleser im Epilog (19 px statt 52).

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

const hub = `window.game.scene.getScene('HubSceneV2')`;

async function hubStarten(zusatz) {
  const H = await launch({ search: '?autostart=1' + (zusatz || ''), renderer: 'canvas', waitFor: 'StartScene' });
  assert.ok(await H.waitForScene('HubSceneV2', { maxRounds: 250 }), 'Hub nicht erreicht');
  return H;
}

// Die Patrouillen neu aufstellen und vermessen.
function aufstellen(H, flaggen) {
  return H.run(`(function () {
    var qs = window.questSystem;
    var st = qs.getQuestSaveData();
    st.flags = {};
    ${JSON.stringify(flaggen || [])}.forEach(function (f) { st.flags[f] = true; });
    qs.loadQuestSaveData(st);
    var sc = ${hub};
    var n = sc._patrouillenAufstellen();
    var w = window.HubNeuWelt.welt();
    var npcs = (sc.npcs || []).map(function (e) { return { x: e.sprite.x, y: e.sprite.y }; });
    return {
      n: n,
      wachen: sc._patrouillen.map(function (s) {
        var naechste = npcs.reduce(function (m, q) { return Math.min(m, Math.hypot(q.x - s.x, q.y - s.y)); }, Infinity);
        return { key: s.texture.key, h: Math.round(s.displayHeight), x: s.x, y: s.y, naechste: naechste };
      }),
      breite: w.breite, hoehe: w.hoehe, npcZahl: npcs.length,
      geladen: sc.textures.exists('patrouille')
    };
  })()`);
}

describe('ohne Flagge', () => {
  let H = null;
  before(async () => { H = await hubStarten(''); });
  after(async () => { if (H) await H.shutdown(); });

  test('vor der geheimen Sitzung steht keine Patrouille', () => {
    assert.strictEqual(aufstellen(H, []).n, 0);
  });

  test('danach zwei, im Sprite der Stadtwache — das neue wird nicht einmal geladen', () => {
    const r = aufstellen(H, ['patrouillen_verdoppelt']);
    assert.strictEqual(r.n, 2);
    r.wachen.forEach((w) => assert.strictEqual(w.key, 'garde'));
    assert.strictEqual(r.geladen, false, 'patrouille.png wird ohne Flagge geladen');
  });

  test('sie stehen IN der Karte, figurhoch und abseits der NPC', () => {
    const r = aufstellen(H, ['patrouillen_verdoppelt']);
    assert.ok(r.npcZahl >= 5, 'keine NPC gefunden — der Abstand prueft nichts');
    r.wachen.forEach((w) => {
      assert.ok(w.x > 0 && w.x < r.breite && w.y > 0 && w.y <= r.hoehe, 'ausserhalb der Karte: ' + w.x + '/' + w.y);
      assert.strictEqual(w.h, 58, 'Hoehe ' + w.h + ' statt 58');
      assert.ok(w.naechste >= 120, 'nur ' + Math.round(w.naechste) + ' px zur naechsten Figur');
    });
  });

  test('im Epilog (story_ending) keine Patrouille', () => {
    assert.strictEqual(aufstellen(H, ['patrouillen_verdoppelt', 'story_ending']).n, 0);
  });

  test('die Vorleser im Epilog sind so gross wie der Buerger', () => {
    const r = H.run(`(function () {
      var sc = ${hub};
      var echt = window.HubPhase.epilogVorleser, phase = sc._hubPhase;
      window.HubPhase.epilogVorleser = function () { return 3; };
      sc._hubPhase = 'epilogue';
      try {
        var n = sc._vorleserAufstellen();
        return { n: n, h: sc._vorleser.map(function (s) { return Math.round(s.displayHeight); }) };
      } finally {
        window.HubPhase.epilogVorleser = echt; sc._hubPhase = phase; sc._vorleserAufstellen();
      }
    })()`);
    assert.strictEqual(r.n, 3);
    assert.strictEqual(r.h.join(','), '52,52,52');
  });
});

describe('?patrouille=neu', () => {
  let H = null;
  before(async () => { H = await hubStarten('&patrouille=neu'); });
  after(async () => { if (H) await H.shutdown(); });

  test('die Patrouillen stehen sofort, im eigenen Sprite', () => {
    const r = aufstellen(H, []);
    assert.strictEqual(r.geladen, true, 'patrouille.png nicht geladen');
    assert.strictEqual(r.n, 2);
    r.wachen.forEach((w) => {
      assert.strictEqual(w.key, 'patrouille');
      assert.strictEqual(w.h, 58);
    });
  });

  test('beim Betreten des Hubs stehen sie schon (create ruft das Aufstellen)', () => {
    const r = H.run(`${hub}._patrouillen.length`);
    assert.strictEqual(r, 2);
  });

  test('auch mit Flagge: im Epilog keine', () => {
    assert.strictEqual(aufstellen(H, ['story_ending']).n, 0);
  });
});

describe('?patrouille=alt (Vergleich)', () => {
  let H = null;
  before(async () => { H = await hubStarten('&patrouille=alt'); });
  after(async () => { if (H) await H.shutdown(); });

  test('stellt sie sofort auf, aber im alten Sprite', () => {
    const r = aufstellen(H, []);
    assert.strictEqual(r.n, 2);
    r.wachen.forEach((w) => assert.strictEqual(w.key, 'garde'));
  });
});

test('Das Sprite liegt bei den Hub-Figuren: freigestellt, so gross wie die Stadtwache', async () => {
  const sharp = require('sharp');
  const datei = path.join(__dirname, '..', 'assets', 'sprites', 'patrouille.png');
  assert.ok(fs.existsSync(datei), 'assets/sprites/patrouille.png fehlt');
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * 4 + 3];
  assert.strictEqual(alpha(0, 0), 0, 'Hintergrund nicht freigestellt');
  assert.strictEqual(alpha(info.width - 1, 0), 0, 'Hintergrund nicht freigestellt');
  // Zugeschnitten wie garde.png (38x62): die Figur fuellt das Bild.
  assert.ok(info.height >= 50 && info.height <= 70, 'Hoehe ' + info.height);
  assert.ok(info.width <= 64, 'Breite ' + info.width);
});
