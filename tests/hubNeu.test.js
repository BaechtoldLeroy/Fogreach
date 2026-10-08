// tests/hubNeu.test.js — der gekachelte Hub (#181) als Probe, nicht als Umbau.
//
// Der neue Platz haengt an EINER Flagge: ?debug=1&hubneu=1. Zwei Dinge muessen
// darum nachweisbar sein, und sie sind verschieden wichtig:
//
//   1. OHNE Flagge aendert sich nichts. Der Hub ist das Erste, was ein Spieler
//      sieht; ein halbfertiger Umbau, der sich aus Versehen einschaltet, waere
//      der teuerste aller Fehler. Das ist der Fall, der hier wirklich zaehlt.
//   2. MIT Flagge steht der Platz auch da: Boden, Haeuser, Requisiten — und
//      das gemalte Bild ist weg.
//
// Dazu die Buchhaltung: jedes Bild, das die Tabellen nennen, muss auf der
// Platte liegen. Phaser verschluckt eine fehlende Datei still (die Kachel
// bleibt dann einfach leer), und genau so faellt es im Spiel niemandem auf.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const HUB_ASSETS = path.join(WURZEL, 'assets', 'hub');

/** Die Tabellen aus hubNeuWelt lesen, ohne Phaser zu starten. */
function welt() {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', 'hubNeuWelt.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
  return fenster.HubNeuWelt;
}

function karte() {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', 'hubNeuKarte.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
  return fenster.HUB_NEU_KARTE;
}

test('die Karte ist rechteckig und kennt jedes ihrer Zeichen', () => {
  const K = karte();
  assert.strictEqual(K.zeilen.length, K.hoehe,
    'die Karte hat ' + K.zeilen.length + ' Zeilen statt ' + K.hoehe);
  const schief = K.zeilen
    .map((z, i) => (z.length === K.breite ? null : 'Zeile ' + i + ' ist ' + z.length + ' lang'))
    .filter(Boolean);
  assert.deepStrictEqual(schief, [], schief.join('; '));

  // Ein unbekanntes Zeichen laesst die Kachel still verschwinden — ein Loch
  // im Platz, durch das der schwarze Hintergrund scheint.
  const unbekannt = new Set();
  K.zeilen.forEach((z) => {
    for (const c of z) if (!(c in K.legende)) unbekannt.add(c);
  });
  assert.deepStrictEqual([...unbekannt], [],
    'unbekannte Zeichen in der Karte: ' + [...unbekannt].join(' '));

  // Die Karte muss die Welt genau ausfuellen: 48*32 = 1536, 32*32 = 1024.
  assert.strictEqual(K.breite * K.kachel, 1536, 'die Karte ist nicht 1536 breit');
  assert.strictEqual(K.hoehe * K.kachel, 1024, 'die Karte ist nicht 1024 hoch');
});

test('jedes Bild, das die Tabellen nennen, liegt auf der Platte', () => {
  const W = welt();
  const K = karte();
  const fehlt = [];
  const pruefe = (datei) => {
    if (!fs.existsSync(path.join(HUB_ASSETS, datei))) fehlt.push(datei);
  };

  // Boden: jede Nummer, die die Legende nennt.
  const nummern = new Set();
  Object.keys(K.legende).forEach((c) => K.legende[c].forEach((n) => nummern.add(n)));
  assert.ok(nummern.size >= 8, 'die Legende nennt nur ' + nummern.size + ' Bodenbilder');
  nummern.forEach((n) => pruefe('boden' + n + '.png'));

  W._HAEUSER.forEach((h) => pruefe(h.datei));
  // Requisiten heissen hub_<name> und liegen als <name>.png.
  const req = new Set(W._REQUISITEN.map((r) => r.key));
  assert.ok(req.size >= 10, 'nur ' + req.size + ' verschiedene Requisiten');
  req.forEach((k) => pruefe(k.replace(/^hub_/, '') + '.png'));

  assert.deepStrictEqual(fehlt, [], 'fehlende Bilder in assets/hub: ' + fehlt.join(', '));
});

test('derselbe Platz wuerfelt zweimal dasselbe', () => {
  // Der Hub wird bei jeder Rueckkehr aus dem Dungeon neu gebaut. Mit echtem
  // Zufall laege nach jedem Besuch ein anderes Pflaster da.
  const W = welt();
  const a = [], b = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { a.push(W._streu(x, y, 1)); b.push(W._streu(x, y, 1)); }
  assert.deepStrictEqual(a, b, 'der Wuerfel liefert beim zweiten Mal etwas anderes');
  // Und er streut wirklich: 64 Felder, die alle dasselbe ergeben, waeren kein
  // Wuerfel, sondern eine Konstante.
  assert.ok(new Set(a).size > 40,
    'von 64 Feldern kamen nur ' + new Set(a).size + ' verschiedene Werte');
});

async function imHub(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  h.run("window.game.scene.start('HubSceneV2')");
  const ok = await h.waitForScene('HubSceneV2', { maxRounds: 300 });
  if (!ok) { await h.shutdown(); throw new Error('HubSceneV2 wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 30 });
  return h;
}

/** Was steht im Hub? */
const BESTAND = `(function () {
  var sc = window.game.scene.getScene('HubSceneV2');
  var gemalt = null, rt = 0, neu = 0;
  (sc.children.list || []).forEach(function (c) {
    var k = c.texture && c.texture.key;
    if (k === 'hubscene_bg') gemalt = c.visible;
    if (c.type === 'RenderTexture') rt++;
    if (k && k.indexOf('hub_') === 0) neu++;
  });
  return { gemaltSichtbar: gemalt, renderTexturen: rt, neueBilder: neu,
           flagge: !!(window.HubNeuWelt && window.HubNeuWelt.aktiv()) };
})()`;

let ohne = null, mit = null;
before(async () => {
  ohne = await imHub('');
  mit = await imHub('?debug=1&hubneu=1');
});
after(async () => {
  if (ohne) await ohne.shutdown();
  if (mit) await mit.shutdown();
});

test('ohne Flagge bleibt der gemalte Hub genau wie er war', () => {
  const r = ohne.run(BESTAND);
  assert.strictEqual(r.flagge, false, 'die Flagge ist ohne Adresse an');
  assert.strictEqual(r.gemaltSichtbar, true, 'das gemalte Hub-Bild ist nicht mehr sichtbar');
  assert.strictEqual(r.neueBilder, 0,
    'im ausgelieferten Hub stehen ' + r.neueBilder + ' Bilder des neuen Platzes');
});

test('mit Flagge steht der gekachelte Platz da und das Gemaelde ist weg', () => {
  const r = mit.run(BESTAND);
  assert.strictEqual(r.flagge, true, 'die Flagge greift nicht');
  assert.strictEqual(r.gemaltSichtbar, false, 'das gemalte Hub-Bild liegt noch obenauf');
  assert.ok(r.renderTexturen >= 1, 'der Kachelboden fehlt');
  // Haeuser, Mauer, Requisiten und Baeume zusammen — deutlich mehr als die
  // Handvoll, die ein halb gebauter Platz ergaebe.
  assert.ok(r.neueBilder > 100,
    'nur ' + r.neueBilder + ' Bilder des neuen Platzes — da fehlt etwas');
});

test('die Haeuser stehen in der Breite, die die Tabelle nennt', () => {
  // Die Bilder kommen in verschiedenen Massen aus PixelLab. Wer sie ueber den
  // Massstab statt ueber die Breite setzt, bekommt fuenf verschieden grosse
  // Haeuser — genau der Fehler, der bei den Gegnern schon einmal passiert ist.
  const W = welt();
  const ist = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var out = {};
    (sc.children.list || []).forEach(function (c) {
      var k = c.texture && c.texture.key;
      if (k && /^hub_(rathaus|werkstatt|druckerei|kate_a|kate_b)$/.test(k)) {
        out[k] = { b: c.displayWidth, x: c.x, y: c.y };
      }
    });
    return out;
  })()`);
  const M = 1536 / 960;
  const daneben = [];
  W._HAEUSER.forEach((h) => {
    const i = ist[h.key];
    if (!i) { daneben.push(h.key + ' steht nicht da'); return; }
    if (Math.abs(i.b - h.breite * M) > 1.5) {
      daneben.push(h.key + ' ist ' + i.b.toFixed(1) + ' breit statt ' + (h.breite * M).toFixed(1));
    }
    // Und es steht auf seinem Fusspunkt, nicht irgendwo.
    if (Math.abs(i.y - h.y * M) > 1.5) {
      daneben.push(h.key + ' steht bei y=' + i.y.toFixed(1) + ' statt ' + (h.y * M).toFixed(1));
    }
  });
  assert.deepStrictEqual(daneben, [], daneben.join('; '));
});
