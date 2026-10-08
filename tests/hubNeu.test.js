// tests/hubNeu.test.js — der gekachelte Marktplatz (#181) als Probe.
//
// Der neue Platz haengt an EINER Flagge: ?debug=1&hubneu=1. Zwei Dinge muessen
// darum nachweisbar sein, und sie sind verschieden wichtig:
//
//   1. OHNE Flagge aendert sich nichts. Der Hub ist das Erste, was ein Spieler
//      sieht; ein halbfertiger Umbau, der sich aus Versehen einschaltet, waere
//      der teuerste aller Fehler. Das ist der Fall, der hier wirklich zaehlt.
//   2. MIT Flagge steht der Platz da — und zwar so, wie die Karte es sagt.
//
// Der wichtigste neue Fall ist der dritte: KEIN NPC UND KEINE TUER STEHT IN
// EINER WAND. Genau dafuer leitet hubNeuWelt die Kollisionen aus der Karte ab,
// statt sie in einer zweiten Liste zu pflegen. Faellt dieser Fall, ist die
// Ableitung umsonst gewesen.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
const HUB_ASSETS = path.join(WURZEL, 'assets', 'hub');

/** Ein klassisches Skript in eine Fenster-Attrappe laden. */
function laden(datei) {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', datei), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
  return fenster;
}
const karte = () => laden('hubNeuKarte.js').HUB_NEU_KARTE;
const welt = () => laden('hubNeuWelt.js').HubNeuWelt;

test('die Karte ist rechteckig und kennt jedes ihrer Zeichen', () => {
  const K = karte();
  assert.strictEqual(K.zeilen.length, K.hoehe,
    'die Karte hat ' + K.zeilen.length + ' Zeilen statt ' + K.hoehe);
  const schief = K.zeilen
    .map((z, i) => (z.length === K.breite ? null : 'Zeile ' + i + ' ist ' + z.length + ' lang'))
    .filter(Boolean);
  assert.deepStrictEqual(schief, [], schief.join('; '));

  // Ein unbekanntes Zeichen liesse die Kachel still verschwinden — ein Loch,
  // durch das der schwarze Hintergrund scheint.
  const unbekannt = new Set();
  K.zeilen.forEach((z) => { for (const c of z) if (!(c in K.arten)) unbekannt.add(c); });
  assert.deepStrictEqual([...unbekannt], [],
    'unbekannte Zeichen in der Karte: ' + [...unbekannt].join(' '));

  // Die Kachel muss zum Entwurfsraster passen: 32 Weltpixel / 1.6 = 20.
  assert.strictEqual(K.kachel / K.jeKachel, 1536 / 960,
    'Kachelmass und Entwurfseinheit passen nicht zum SCALE_FACTOR');
});

test('Stein stoesst nirgends direkt an Gras', () => {
  // Fuer Stein-an-Erde und Gras-an-Erde gibt es Uebergangskacheln, fuer
  // Stein-an-Gras nicht. Wo die beiden sich direkt beruehren, bleibt genau
  // die harte Kante stehen, derentwegen der Umbau ueberhaupt laeuft.
  const K = karte();
  const art = (x, y) => {
    if (x < 0 || y < 0 || x >= K.breite || y >= K.hoehe) return null;
    return K.arten[K.zeilen[y].charAt(x)] || null;
  };
  const stoss = [];
  for (let y = 0; y < K.hoehe; y++) {
    for (let x = 0; x < K.breite; x++) {
      const a = art(x, y);
      if (a !== 'platte' && a !== 'pflaster') continue;
      [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy]) => {
        if (art(x + dx, y + dy) === 'gras') stoss.push(x + ',' + y);
      });
    }
  }
  assert.deepStrictEqual([...new Set(stoss)], [],
    'Stein grenzt ohne Uebergang an Gras bei: ' + [...new Set(stoss)].join(' '));
});

test('jedes Bild, das die Karte nennt, liegt auf der Platte', () => {
  const K = karte();
  const W = welt();
  const fehlt = [];
  const pruefe = (datei) => {
    if (!fs.existsSync(path.join(HUB_ASSETS, datei))) fehlt.push(datei);
  };
  K.haeuser.forEach((h) => pruefe(h.bild.replace(/^hub_/, '') + '.png'));
  const req = new Set(K.requisiten.map((r) => r.bild));
  assert.ok(req.size >= 10, 'nur ' + req.size + ' verschiedene Requisiten');
  req.forEach((b) => pruefe(b.replace(/^hub_/, '') + '.png'));
  // Boden: Grund, Flaechen und alle vierzehn Uebergaenge je Grenze.
  pruefe('boden9.png');
  W._SCHICHTEN.forEach((s) => {
    s.flaeche.forEach((f) => pruefe(f.replace(/^hub_/, '') + '.png'));
    for (let m = 1; m < 15; m++) pruefe('ueber_' + s.name + m + '.png');
  });
  assert.deepStrictEqual(fehlt, [], 'fehlende Bilder in assets/hub: ' + fehlt.join(', '));
});

test('derselbe Platz wuerfelt zweimal dasselbe', () => {
  // Der Hub wird bei jeder Rueckkehr aus dem Dungeon neu gebaut. Mit echtem
  // Zufall laege nach jedem Besuch ein anderes Pflaster da.
  const W = welt();
  const a = [], b = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { a.push(W._streu(x, y, 1)); b.push(W._streu(x, y, 1)); }
  assert.deepStrictEqual(a, b, 'der Wuerfel liefert beim zweiten Mal etwas anderes');
  assert.ok(new Set(a).size > 40,
    'von 64 Feldern kamen nur ' + new Set(a).size + ' verschiedene Werte');
});

test('die festen Zellen werden zu wenigen Rechtecken verschmolzen', () => {
  // Je Zelle ein Collider waeren rund dreihundert Koerper, und eine Figur
  // bleibt an den Innenkanten zweier buendiger Koerper haengen.
  const K = karte();
  const W = welt();
  const rechtecke = W._festeFlaechen(K);
  let zellen = 0;
  K.zeilen.forEach((z) => { for (const c of z) if (K.fest.indexOf(c) >= 0) zellen++; });
  const bedeckt = rechtecke.reduce((s, r) => s + r.b * r.h, 0);
  assert.strictEqual(bedeckt, zellen,
    'die Rechtecke decken ' + bedeckt + ' Zellen ab, fest sind aber ' + zellen);
  assert.ok(rechtecke.length < zellen / 8,
    'aus ' + zellen + ' festen Zellen wurden ' + rechtecke.length + ' Rechtecke — zu wenig verschmolzen');
});

async function imHub(search) {
  const h = await launch({ search: search, renderer: 'canvas', waitFor: 'StartScene' });
  h.run("window.game.scene.start('HubSceneV2')");
  const ok = await h.waitForScene('HubSceneV2', { maxRounds: 300 });
  if (!ok) { await h.shutdown(); throw new Error('HubSceneV2 wurde nicht erreicht'); }
  await h.settle(() => false, { maxRounds: 30 });
  return h;
}

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
           flagge: !!(window.HubNeuWelt && window.HubNeuWelt.aktiv()),
           welt: [sc.physics.world.bounds.width, sc.physics.world.bounds.height],
           collider: window.HUB_HITBOXES.colliders.length };
})()`;

// Die beiden Laeufe duerfen sich nicht ueberschneiden: zwei offene Spiele
// im selben Prozess teilen sich Fenster-Globale, und dann misst man den
// einen Hub mit den Werten des anderen.
let ohneWerte = null, mit = null;
before(async () => {
  const h = await imHub('');
  ohneWerte = h.run(BESTAND);
  await h.shutdown();
  mit = await imHub('?debug=1&hubneu=1');
});
after(async () => { if (mit) await mit.shutdown(); });

test('ohne Flagge bleibt der gemalte Hub genau wie er war', () => {
  const r = ohneWerte;
  assert.strictEqual(r.flagge, false, 'die Flagge ist ohne Adresse an');
  assert.strictEqual(r.gemaltSichtbar, true, 'das gemalte Hub-Bild ist nicht mehr sichtbar');
  assert.strictEqual(r.neueBilder, 0,
    'im ausgelieferten Hub stehen ' + r.neueBilder + ' Bilder des neuen Platzes');
  assert.strictEqual(r.welt[0] + 'x' + r.welt[1], '1536x1024',
    'die alte Hub-Welt misst ' + r.welt[0] + 'x' + r.welt[1]);
});

test('mit Flagge steht der gekachelte Platz da und das Gemaelde ist weg', () => {
  const K = karte();
  const r = mit.run(BESTAND);
  assert.strictEqual(r.flagge, true, 'die Flagge greift nicht');
  assert.strictEqual(r.gemaltSichtbar, false, 'das gemalte Hub-Bild liegt noch obenauf');
  assert.ok(r.renderTexturen >= 1, 'der Kachelboden fehlt');
  assert.strictEqual(r.welt[0] + 'x' + r.welt[1],
    (K.breite * K.kachel) + 'x' + (K.hoehe * K.kachel),
    'die Welt misst ' + r.welt[0] + 'x' + r.welt[1] + ', die Karte sagt etwas anderes');
  assert.ok(r.neueBilder > 100,
    'nur ' + r.neueBilder + ' Bilder des neuen Platzes — da fehlt etwas');
});

test('kein NPC und keine Tuer steht in einer Wand', () => {
  // Der Grund, warum die Kollisionen aus der Karte abgeleitet werden. Vorher
  // waren Grafik und Kollision zwei gepflegte Listen, die nur zufaellig
  // uebereinstimmten — daher der Trog halb in der Kate.
  const K = karte();
  const fest = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= K.breite || ty >= K.hoehe) return true;
    return K.fest.indexOf(K.zeilen[ty].charAt(tx)) >= 0;
  };
  const drin = [];
  K.npcs.forEach((n) => {
    // Fusspunkt: die Zelle, in der die Figur steht (Standlinie minus ein Haar).
    if (fest(Math.floor(n.x), Math.floor(n.y - 0.01))) drin.push('NPC ' + n.id);
  });
  K.tueren.forEach((t) => {
    // Vor einer Tuer muss man stehen koennen: die untere Haelfte des
    // Rechtecks wird geprueft, dort naehert sich die Figur.
    let frei = false;
    for (let x = Math.floor(t.x); x < t.x + t.b; x++) {
      if (!fest(x, Math.floor(t.y + t.h - 0.01))) frei = true;
    }
    if (!frei) drin.push('Tuer ' + t.id);
  });
  assert.deepStrictEqual(drin, [], drin.join('; ') + ' steht/stehen in einer Wand');
});

test('die Terrasse ist nur ueber die Freitreppe zu erreichen', () => {
  // Der Rat sitzt oben. Gaebe es einen zweiten Weg hinauf, waere die Treppe
  // Dekoration und die Aussage des Grundrisses hinfaellig.
  const K = karte();
  const T = K.terrasse;
  const offen = [];
  const kante = T.y + T.h - 1;                       // die Mauerzeile selbst
  for (let x = T.x; x < T.x + T.b; x++) {
    const c = K.zeilen[kante].charAt(x);
    if (K.fest.indexOf(c) < 0 && c !== 'S') offen.push('Spalte ' + x);
  }
  assert.deepStrictEqual(offen, [],
    'die Terrassenkante ist offen bei: ' + offen.join(', '));
  const treppe = K.zeilen[kante].slice(T.treppeX, T.treppeX + T.treppeB);
  assert.strictEqual(treppe, 'S'.repeat(T.treppeB),
    'an der Treppe steht "' + treppe + '" statt lauter S');
});

test('die Haeuser stehen in der Breite, die die Karte nennt', () => {
  // Die Bilder kommen in verschiedenen Massen aus PixelLab. Wer sie ueber den
  // Massstab statt ueber die Breite setzt, bekommt fuenf verschieden grosse
  // Haeuser — derselbe Fehler wie bei den Gegnern in b314.
  const K = karte();
  const ist = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var out = {};
    (sc.children.list || []).forEach(function (c) {
      var k = c.texture && c.texture.key;
      if (k && /^hub_(rathaus_sockel|werkstatt|druckerei|kate_a|kate_b)$/.test(k)) {
        out[k] = { b: c.displayWidth, y: c.y };
      }
    });
    return out;
  })()`);
  const daneben = [];
  K.haeuser.forEach((h) => {
    const i = ist[h.bild];
    if (!i) { daneben.push(h.bild + ' steht nicht da'); return; }
    if (Math.abs(i.b - h.breite * K.kachel) > 1.5) {
      daneben.push(h.bild + ' ist ' + i.b.toFixed(1) + ' breit statt ' + (h.breite * K.kachel));
    }
    if (Math.abs(i.y - h.y * K.kachel) > 1.5) {
      daneben.push(h.bild + ' steht bei y=' + i.y.toFixed(1) + ' statt ' + (h.y * K.kachel));
    }
  });
  assert.deepStrictEqual(daneben, [], daneben.join('; '));
});

test('die NPC stehen auf ihren Ankern, nicht mehr auf den alten Plaetzen', () => {
  const K = karte();
  const ist = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var out = {};
    (sc.children.list || []).forEach(function (c) {
      if (c && c.getData && c.getData('id')) out[c.getData('id')] = { x: c.x, y: c.y };
    });
    return out;
  })()`);
  const M = 1536 / 960;
  const daneben = [];
  let gesehen = 0;
  K.npcs.forEach((n) => {
    const i = ist[n.id];
    if (!i) return;                                  // steht in diesem Akt nicht da
    gesehen++;
    const sollX = n.x * K.jeKachel * M, sollY = n.y * K.jeKachel * M;
    if (Math.abs(i.x - sollX) > 2 || Math.abs(i.y - sollY) > 2) {
      daneben.push(n.id + ' steht bei ' + Math.round(i.x) + '/' + Math.round(i.y)
        + ' statt ' + Math.round(sollX) + '/' + Math.round(sollY));
    }
  });
  assert.ok(gesehen >= 5, 'nur ' + gesehen + ' NPC standen im Hub — der Fall misst zu wenig');
  assert.deepStrictEqual(daneben, [], daneben.join('; '));
});
