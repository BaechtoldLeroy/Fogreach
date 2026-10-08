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

test('die Uebergangskacheln sind ausserhalb ihrer Art durchsichtig', async () => {
  // Bis b331 trugen sie die untere Art eingebacken (Stein UEBER Erde). Dann
  // konnte Stein nur an Erde grenzen: wo er an Gras stiess, malte die
  // Erdhaelfte ueber das Gras, und eine harte Kante blieb. Durchsichtig
  // liegt jede Schicht auf dem, was darunter schon gezeichnet ist — Stein
  // geht direkt in Wiese ueber.
  const sharp = require('sharp');
  const W = welt();
  const zuDicht = [];
  for (const sch of W._SCHICHTEN) {
    for (let m = 1; m < 15; m++) {
      const { data, info } = await sharp(path.join(HUB_ASSETS, 'ueber_' + sch.name + m + '.png'))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // Das Eckpixel jeder Ecke, die zur UNTEREN Art gehoert, muss
      // durchsichtig sein. (Weiter innen reicht die Rasterung der oberen
      // Art absichtlich hinein — das ist der weiche Rand.)
      const ecken = [[0, 0, 8], [1, 0, 4], [0, 1, 2], [1, 1, 1]];   // NW NE SW SE
      ecken.forEach(([ex, ey, bit]) => {
        if (m & bit) return;
        const x = ex ? info.width - 1 : 0, y = ey ? info.height - 1 : 0;
        if (data[(y * info.width + x) * 4 + 3] !== 0) zuDicht.push(sch.name + m);
      });
    }
  }
  assert.deepStrictEqual([...new Set(zuDicht)], [], 'diese Uebergaenge tragen die untere Art eingebacken: ' + [...new Set(zuDicht)].join(', '));
});

test('jedes Bild, das die Karte nennt, liegt auf der Platte', () => {
  const K = karte();
  const W = welt();
  const fehlt = [];
  const pruefe = (datei) => {
    if (!fs.existsSync(path.join(HUB_ASSETS, datei))) fehlt.push(datei);
  };
  const ort = (b) => (b.indexOf('hub_') === 0)
    ? path.join(HUB_ASSETS, b.slice(4) + '.png')
    : path.join(WURZEL, 'assets', 'tiles', b + '.png');
  const pruefeBild = (b) => { if (!fs.existsSync(ort(b))) fehlt.push(b); };
  K.haeuser.forEach((h) => pruefeBild(h.bild));
  const req = new Set(K.requisiten.map((r) => r.bild));
  assert.ok(req.size >= 10, 'nur ' + req.size + ' verschiedene Requisiten');
  req.forEach(pruefeBild);
  // Animationen: jedes Bild der Folge muss da sein, nicht nur das erste.
  K.requisiten.forEach((r) => {
    if (r.anim === 'brunnen') for (let i = 0; i < 8; i++) pruefeBild(r.bild + i);
    if (r.anim === 'feuer') for (let i = 0; i < 9; i++) pruefeBild('brazier' + i);
  });
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

// --- Optimierungslauf: Groessen und Verdeckung ------------------------------
//
// Zwei Klagen nach b329: "gewisse Objekte sind zu gross" und "stehen hinter
// anderen". Beide lassen sich messen, und beide hatten eine gemeinsame
// Wurzel: Requisiten wurden ueber die BREITE gesetzt. Bei schraeg
// gezeichneten Objekten sagt die Breite wenig ueber die sichtbare Masse —
// eine Bank kam so 63 px hoch heraus, hoeher als die Spielerfigur (54).

/** Alles, was im Hub steht, mit Bildschirmrechteck und Tiefe. */
const STEHT = `(function () {
  var sc = window.game.scene.getScene('HubSceneV2');
  var out = [];
  (sc.children.list || []).forEach(function (c) {
    if (!c || !c.visible || !c.getBounds) return;
    var k = c.texture && c.texture.key;
    var id = c.getData && c.getData('id');
    var art = null;
    if (id && c.type === 'Sprite' || (id && c.type === 'Image')) art = 'npc';
    else if (k && /^hub_(werkstatt|druckerei|kate_a|kate_b|rathaus_sockel|stuetzmauer)$/.test(k)) art = 'bau';
    else if (k && /^brazier[0-9]$/.test(k)) { art = 'ding'; k = 'brazier0'; }
    // Der Lichtschein liegt mit Absicht ueber dem, was leuchtet.
    else if (k && /^hub_/.test(k) && !/boden|ueber|flaeche|nebel|kiefer|baum|freitreppe|schein/.test(k)) art = 'ding';
    if (k && /^hub_kettenbrunnen[0-9]$/.test(k)) k = 'hub_kettenbrunnen';
    if (!art) return;
    var b = c.getBounds();
    out.push({ art: art, name: id || k, x0: b.x, x1: b.x + b.width, y0: b.y, y1: b.y + b.height,
      fuss: c.y, tiefe: c.depth, h: b.height });
  });
  return out;
})()`;

test('keine Requisite am Boden ist hoeher als die Spielerfigur', () => {
  // Bank, Fass, Kisten, Holz, Karren, Trog, Kuebel, Schutt: alles, was
  // ein Mensch ueberblickt. Groesser als er sind nur Bauten, Laternen,
  // Tafeln, Schilder, der Marktstand und die Statue.
  const NIEDRIG = /^hub_(bank|fass|kisten|holz|karren|trog|kuebel|schutt)$/;
  const zuHoch = Array.prototype.slice.call(mit.run(STEHT))
    .filter((o) => o.art === 'ding' && NIEDRIG.test(o.name) && o.h > 54)
    .map((o) => o.name + ' ' + Math.round(o.h) + ' px');
  assert.deepStrictEqual(zuHoch, [], 'hoeher als die Spielerfigur (54): ' + zuHoch.join(', '));
});

test('keine Requisite weicht von der Hoehe ab, die die Karte nennt', () => {
  const K = karte();
  const ist = {};
  Array.prototype.slice.call(mit.run(STEHT)).forEach((o) => {
    if (o.art === 'ding') (ist[o.name] = ist[o.name] || []).push(o.h);
  });
  const daneben = [];
  K.requisiten.forEach((r) => {
    if (!r.hoehe) return;
    const hs = ist[r.bild] || [];
    if (!hs.some((h) => Math.abs(h - r.hoehe) <= 1.5)) {
      daneben.push(r.bild + ' soll ' + r.hoehe + ', ist ' + hs.map(Math.round).join('/'));
    }
  });
  assert.ok(K.requisiten.filter((r) => r.hoehe).length >= 10,
    'zu wenige Requisiten mit Hoehe — der Fall misst nichts');
  assert.deepStrictEqual(daneben, [], daneben.join('; '));
});

test('nichts und niemand steht verdeckt hinter einem Bau', () => {
  // Verdeckt heisst: das Rechteck ueberlappt das eines Baus spuerbar, und
  // die Figur wird VOR dem Bau gezeichnet — liegt also dahinter. Baeume
  // sind ausgenommen, die sollen hinter den Haeusern stehen.
  const alle = Array.prototype.slice.call(mit.run(STEHT));
  const baue = alle.filter((o) => o.art === 'bau');
  const verdeckt = [];
  alle.filter((o) => o.art !== 'bau').forEach((o) => {
    baue.forEach((b) => {
      const ux = Math.min(o.x1, b.x1) - Math.max(o.x0, b.x0);
      const uy = Math.min(o.y1, b.y1) - Math.max(o.y0, b.y0);
      if (ux <= 0 || uy <= 0) return;
      // Spuerbar: mehr als ein Viertel der Figur liegt im Bau.
      const anteil = (ux * uy) / ((o.x1 - o.x0) * (o.y1 - o.y0));
      if (anteil > 0.25 && o.tiefe < b.tiefe) {
        verdeckt.push(o.name + ' hinter ' + b.name + ' (' + Math.round(anteil * 100) + ' %)');
      }
    });
  });
  assert.deepStrictEqual(verdeckt, [], verdeckt.join('; '));
});


// --- Erreichbarkeit ----------------------------------------------------------
//
// "Steht nicht in einer Wand" beweist nicht, dass man hinkommt: Aldric stand in
// b330 auf freiem Boden, aber auf einer Galerie von 32 px Tiefe, und der
// Spielerkoerper ist 56 px hoch. Darum hier der eigentliche Beweis — mit dem
// echten Koerper vom Startpunkt aus ueber den ganzen Platz geflutet.

/** HUB_HITBOXES so, wie HubSceneV2 sie mit Flagge vorfindet. */
function layoutMitFlagge() {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  fenster.DebugGate = { an: (n) => n === 'hubneu' };
  ['hubLayout.js', 'hubNeuKarte.js', 'hubNeuWelt.js'].forEach((d) => {
    const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', d), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', 'module', 'console', q)(fenster, {}, fenster.console);
  });
  fenster.HubNeuWelt.layoutUebernehmen();
  return { HB: fenster.HUB_HITBOXES, K: fenster.HUB_NEU_KARTE, W: fenster.HubNeuWelt };
}

/**
 * Alle Fusspunkte, die der Spieler vom Startpunkt aus erreicht — mit dem
 * echten Koerper, allen NPC-Koerpern und etwas Luft. Raster 8 px.
 */
function erreichbar() {
  const { HB, K, W } = layoutMitFlagge();
  const M = 1536 / 960;
  const welt = W.welt();
  const wand = HB.colliders.map((c) => ({ x0: c.x * M, y0: c.y * M, x1: (c.x + c.w) * M, y1: (c.y + c.h) * M }));
  // NPC sind feste Koerper (30 x 36 ueber dem Fuss, HubSceneV2). Mit ALLEN,
  // auch den gerade ausgeblendeten: sie bekommen ihren Koerper zurueck,
  // sobald sie im spaeteren Akt erscheinen. In b331 stand Thom mitten im
  // einzigen Gang zur Druckerei — ohne NPC-Koerper sah dieser Test das nicht.
  K.npcs.forEach((n) => {
    const nx = n.x * K.kachel, ny = n.y * K.kachel;
    wand.push({ x0: nx - 15, x1: nx + 15, y0: ny - 36, y1: ny });
  });
  // Koerper wie in player.js: 34 breit, 56 hoch, Fuesse unten — plus 4 px
  // Luft ringsum. Ein Spalt, durch den man nur auf den Pixel genau passt,
  // ist in der Hand des Spielers ein versperrter Weg (so stand Thom in b331
  // im Gang zur Druckerei: 11 px Platz neben ihm).
  const LUFT = 4;
  const frei = (x, y) => {
    const x0 = x - 17 - LUFT, x1 = x + 17 + LUFT, y0 = y - 56 - LUFT, y1 = y + LUFT;
    if (x0 < 0 || y0 < 0 || x1 > welt.breite || y1 > welt.hoehe) return false;
    return !wand.some((r) => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);
  };
  const S = 8;                                        // Raster in Weltpixeln
  const start = [Math.round(welt.start.x / S) * S, Math.round(welt.start.y / S) * S];
  if (!frei(start[0], start[1])) return { HB, K, W, orte: [], M, startFrei: false };
  const gesehen = new Set([start.join(',')]);
  const offen = [start];
  while (offen.length) {
    const [x, y] = offen.pop();
    [[S, 0], [-S, 0], [0, S], [0, -S]].forEach(([dx, dy]) => {
      const n = [x + dx, y + dy], k = n.join(',');
      if (!gesehen.has(k) && frei(n[0], n[1])) { gesehen.add(k); offen.push(n); }
    });
  }
  const orte = [...gesehen].map((k) => k.split(',').map(Number));
  return { HB, K, W, orte, M, startFrei: true };
}

test('jeder NPC und jede Tuer ist mit dem echten Koerper erreichbar', () => {
  const { HB, K, W, orte, M, startFrei } = erreichbar();
  assert.ok(startFrei, 'schon der Startpunkt ist zugebaut');

  const fehlt = [];
  // NPC: HubSceneV2 spricht an, wenn der Fusspunkt naeher als 100 px ist.
  // Das genuegt hier NICHT: Aldric liess sich in b330 vom obersten
  // Treppenabsatz aus gerade noch ansprechen, hinlaufen konnte man nicht.
  // Erreichbar heisst: man kann neben ihm stehen — hoechstens zwei
  // Kacheln vom Fusspunkt.
  K.npcs.forEach((n) => {
    const nx = n.x * K.kachel, ny = n.y * K.kachel;
    if (!orte.some(([x, y]) => Math.hypot(x - nx, y - ny) < 64)) fehlt.push('NPC ' + n.id);
  });
  // Tueren: die Figur (34 x 54 ueber dem Fuss) muss die Zone ueberlappen.
  HB.entrances.forEach((e) => {
    const r = { x0: e.x * M, y0: e.y * M, x1: (e.x + e.w) * M, y1: (e.y + e.h) * M };
    const ok = orte.some(([x, y]) => x - 17 < r.x1 && x + 17 > r.x0 && y - 54 < r.y1 && y > r.y0);
    if (!ok) fehlt.push('Tuer ' + e.id);
  });
  // Die Anschlagtafeln: Reichweite 144 um (x, y - 64), wie in HubSceneV2.
  (K.anschlagtafeln || []).forEach((p, i) => {
    const px = p.x * K.kachel, py = p.y * K.kachel - 64;
    if (!orte.some(([x, y]) => Math.hypot(x - px, y - py) < 130)) fehlt.push('Anschlagtafel ' + i);
  });
  assert.ok(orte.length > 2000, 'nur ' + orte.length + ' erreichbare Stellen — der Platz ist zugebaut');

  // Hinter ein Haus laufen: die Figur steht noerdlich der Standlinie eines
  // Hauses, und ihr Bild liegt spuerbar in dessen Bild. Gemessen an den
  // echten Bildmassen (PNG-Kopf), nicht an der Grundflaeche — das Dach
  // ragt in Schraegsicht weit ueber sie hinaus.
  const pngMass = (b) => {
    const d = fs.readFileSync(path.join(HUB_ASSETS, b.slice(4) + '.png'));
    return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
  };
  const haeuser = K.haeuser.map((h) => {
    const m = pngMass(h.bild), w = h.breite * K.kachel, hh = w * m.h / m.w;
    const cx = h.x * K.kachel, fuss = h.y * K.kachel;
    return { bild: h.bild, x0: cx - w / 2, x1: cx + w / 2, y0: fuss - hh, y1: fuss };
  });
  const dahinter = new Set();
  orte.forEach(([x, y]) => {
    haeuser.forEach((h) => {
      if (y >= h.y1) return;                        // davor: alles gut
      const ux = Math.min(x + 17, h.x1) - Math.max(x - 17, h.x0);
      const uy = Math.min(y, h.y1) - Math.max(y - 54, h.y0);
      if (ux > 0 && uy > 0 && (ux * uy) / (34 * 54) > 0.25) dahinter.add(h.bild);
    });
  });
  assert.deepStrictEqual([...dahinter], [], 'man kann hinter diese Haeuser laufen: ' + [...dahinter].join(', '));

  // Durch feste Requisiten laeuft man nicht: kein erreichbarer Fusspunkt
  // liegt mitten in einer Bank, einem Fass oder einer Laterne.
  const durch = [];
  K.requisiten.filter((q) => q.fest).forEach((q) => {
    const x0 = (q.x - q.fest / 2) * K.kachel + 2, x1 = (q.x + q.fest / 2) * K.kachel - 2;
    const y0 = (q.y - 0.3) * K.kachel, y1 = q.y * K.kachel;
    if (orte.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1)) durch.push(q.bild + ' bei ' + q.x + '/' + q.y);
  });
  assert.deepStrictEqual(durch, [], 'man laeuft hindurch: ' + durch.join(', '));
  assert.deepStrictEqual(fehlt, [], 'nicht erreichbar: ' + fehlt.join(', '));
});

test('Truhe, Anschlagtafeln, Brunnen und Lichter sind die neuen und bewegen sich', () => {
  const K = karte();
  const r = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2');
    var liste = sc.children.list || [];
    var truhe = sc._truheBild;
    var tafeln = liste.filter(function (c) { return c.texture && /^hub_tafel_/.test(c.texture.key); })
      .map(function (c) { return { x: c.x, y: c.y, key: c.texture.key }; });
    var brunnen = liste.filter(function (c) { return c.texture && /^hub_kettenbrunnen/.test(c.texture.key); })[0];
    var feuer = liste.filter(function (c) { return c.texture && /^brazier/.test(c.texture.key); });
    var schein = liste.filter(function (c) { return c.texture && c.texture.key === 'hub_schein'; });
    var schutt = liste.filter(function (c) { return c.texture && c.texture.key === 'hub_schutt'; })[0];
    var a0 = schein.map(function (c) { return c.alpha; });
    var b0 = brunnen && brunnen.frame ? brunnen.frame.name + '|' + brunnen.texture.key : null;
    return {
      truhe: truhe ? (truhe.texture && truhe.texture.key) : null,
      tafeln: tafeln,
      spots: (sc._hubPhaseRefs.posterSpots || []).map(function (p) { return { x: p.x, y: p.y }; }),
      brunnenSpielt: !!(brunnen && brunnen.anims && brunnen.anims.isPlaying),
      feuerSpielt: feuer.filter(function (c) { return c.anims && c.anims.isPlaying; }).length,
      schein: schein.length, scheinVorher: a0,
      schuttTiefe: schutt ? schutt.depth : null,
      spielerTiefe: sc.player.depth
    };
  })()`);
  assert.strictEqual(r.truhe, 'hub_truhe', 'die Truhe ist ' + r.truhe + ' statt der Truhe aus dem Dungeon');
  // Die Tafeln stehen auf den Ankern der Karte, nicht auf den alten Koordinaten.
  const soll = K.anschlagtafeln.map((p) => Math.round(p.x * K.kachel) + '/' + Math.round(p.y * K.kachel)).join(' ');
  const ist = Array.prototype.slice.call(r.spots).map((p) => Math.round(p.x) + '/' + Math.round(p.y)).join(' ');
  assert.strictEqual(ist, soll, 'die Anschlagtafeln stehen bei ' + ist + ' statt ' + soll);
  assert.strictEqual(r.tafeln.length, K.anschlagtafeln.length,
    'es stehen ' + r.tafeln.length + ' Tafelbilder statt ' + K.anschlagtafeln.length + ' — gezeichnet statt Bild?');
  assert.ok(r.brunnenSpielt, 'der Brunnen spielt kein Wasserspiel');
  assert.strictEqual(r.feuerSpielt, 2, 'es brennen ' + r.feuerSpielt + ' Feuerkoerbe statt 2');
  assert.ok(r.schein >= 5, 'nur ' + r.schein + ' Lichtscheine');
  // Schutt liegt flach: er wird nie ueber eine Figur gezeichnet.
  assert.ok(r.schuttTiefe < 0, 'der Schutt liegt auf Tiefe ' + r.schuttTiefe + ' und kann eine Figur verdecken');

  // Flackern: nach ein paar Bildern haben sich die Scheine veraendert.
  mit.step(20);
  const nachher = Array.prototype.slice.call(mit.run(`(window.game.scene.getScene('HubSceneV2').children.list || [])
    .filter(function (c) { return c.texture && c.texture.key === 'hub_schein'; })
    .map(function (c) { return c.alpha; })`));
  const vorher = Array.prototype.slice.call(r.scheinVorher);
  const bewegt = nachher.filter((a, i) => Math.abs(a - vorher[i]) > 0.005).length;
  assert.ok(bewegt >= Math.ceil(vorher.length / 2),
    'nur ' + bewegt + ' von ' + vorher.length + ' Lichtern flackern');
});

test('die Stuetzmauer endet an beiden Seiten in einem Pfeiler', () => {
  // Sie endete in b330 einfach im Gras — "in der Luft".
  const K = karte();
  const T = K.terrasse;
  const pfeiler = K.requisiten.filter((r) => r.bild === 'hub_mauerende');
  const fussZeile = T.y + T.h;
  [T.x, T.x + T.b].forEach((ende) => {
    const da = pfeiler.some((p) => Math.abs(p.x - ende) <= 1 && Math.abs(p.y - fussZeile) <= 0.5);
    assert.ok(da, 'am Mauerende bei Spalte ' + ende + ' steht kein Pfeiler');
  });
});

test('keine Laterne steht ohne Pfahl auf dem Boden', () => {
  // Die erste Laterne war eine Haengelaterne, auf den Boden gestellt — "im
  // Nirgendwo". Licht am Boden kommt von Laternenpfaehlen und Feuerkoerben.
  const K = karte();
  const ohne = K.requisiten.filter((r) => r.licht && !/laternenpfahl|^brazier/.test(r.bild));
  assert.deepStrictEqual(ohne.map((r) => r.bild + ' bei ' + r.x + '/' + r.y), [],
    'Lichter ohne Pfahl: ' + ohne.map((r) => r.bild).join(', '));
  assert.ok(!K.requisiten.some((r) => r.bild === 'hub_laterne'), 'die Haengelaterne steht wieder auf dem Boden');
});

// --- Runde 3: Loop, eine Box, Figur, Wiese ------------------------------------

test('das Wasserspiel ist ein Loop: vom letzten Bild zurueck zum ersten ist kein Sprung', async () => {
  // Die erste Animation lief Strahl - Aufprall - Stille, und dann sprang sie
  // zurueck auf den vollen Strahl. Ein Loop heisst: der Schritt vom letzten
  // zum ersten Bild ist nicht groesser als die Schritte dazwischen.
  const sharp = require('sharp');
  const bilder = [];
  for (let i = 0; i < 8; i++) {
    const { data } = await sharp(path.join(HUB_ASSETS, 'kettenbrunnen' + i + '.png'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    bilder.push(data);
  }
  const diff = (a, b) => {
    let n = 0;
    for (let k = 0; k < a.length; k += 4) {
      if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])
        + Math.abs(a[k + 3] - b[k + 3]) > 24) n++;
    }
    return n;
  };
  const schritte = [];
  for (let i = 0; i < 7; i++) schritte.push(diff(bilder[i], bilder[i + 1]));
  const rueck = diff(bilder[7], bilder[0]);
  // Gegen den TYPISCHEN Schritt (Median), nicht den groessten: ein einziger
  // Sprung mitten in der Folge darf den Massstab nicht verschieben.
  const typisch = schritte.slice().sort((a, b) => a - b)[3];
  assert.ok(rueck <= typisch * 1.5,
    'vom letzten zum ersten Bild aendern sich ' + rueck + ' Pixel, typisch sind ' + typisch);
  assert.ok(Math.max(...schritte) <= typisch * 2.5,
    'mitten in der Folge springt das Bild: ' + schritte.join(', '));

  // Was man sieht, ist nicht der Pixelabstand, sondern ob der Strahl
  // AUSSETZT: die erste Animation lief Strahl - Aufprall - Stille, und die
  // Wassermenge schwankte um ein Viertel. Ein Loop fliesst gleichmaessig.
  const wasser = (d, w, h) => {
    let n = 0;
    for (let y = 0; y < Math.floor(h * 0.6); y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        if (d[k + 3] > 200 && d[k + 2] > 170 && d[k + 1] > 140 && d[k + 2] > d[k] + 25) n++;
      }
    }
    return n;
  };
  const m = await sharp(path.join(HUB_ASSETS, 'kettenbrunnen0.png')).metadata();
  const menge = bilder.map((d) => wasser(d, m.width, m.height));
  assert.ok(Math.min(...menge) / Math.max(...menge) >= 0.9,
    'die Wassermenge schwankt von Bild zu Bild: ' + menge.join(' ') + ' — der Strahl setzt aus');
});

test('das Mauerende ist aus demselben Stein wie die Mauer', async () => {
  // Der erste Pfeiler war hell und anders gemauert. Gemessen an der
  // mittleren Farbe der sichtbaren Pixel.
  const sharp = require('sharp');
  const mittel = async (n) => {
    const { data } = await sharp(path.join(HUB_ASSETS, n + '.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0, z = 0;
    for (let k = 0; k < data.length; k += 4) if (data[k + 3] > 200) { r += data[k]; g += data[k + 1]; b += data[k + 2]; z++; }
    return [r / z, g / z, b / z];
  };
  const K = karte();
  const ende = K.requisiten.find((r) => /mauerende/.test(r.bild));
  assert.ok(ende, 'kein Mauerende in der Karte');
  const a = await mittel('stuetzmauer'), b = await mittel(ende.bild.slice(4));
  const abstand = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  assert.ok(abstand < 25, 'das Mauerende weicht um ' + abstand.toFixed(1) + ' in der Farbe von der Mauer ab');
});

test('neben dem Rathaus liegt kein Stein mehr, nur Wiese und Wald', () => {
  // Der Vorplatz reicht genau so weit wie das Rathaus. Was links und rechts
  // davon auf der Terrasse liegt, ist Wald.
  const K = karte();
  const R = [];
  K.zeilen.forEach((z, y) => { for (let x = 0; x < z.length; x++) if (z[x] === 'R') R.push(x); });
  const links = Math.min(...R), rechts = Math.max(...R);
  const stein = [];
  for (let y = K.terrasse.y; y < K.terrasse.y + K.terrasse.h - 2; y++) {
    for (let x = K.terrasse.x; x < K.terrasse.x + K.terrasse.b; x++) {
      if (x >= links && x <= rechts) continue;
      const c = K.zeilen[y].charAt(x);
      if (c !== 'g') stein.push(x + ',' + y + '=' + c);
    }
  }
  assert.deepStrictEqual(stein, [], 'neben dem Rathaus liegt noch: ' + stein.join(' '));
  assert.strictEqual(K.arten.R, 'gras', 'unter der schraegen Sockel-Ecke des Rathauses liegt keine Wiese');
});

test('nie mehr als eine Aktionsbox, und sie ist die gestaltete', () => {
  // Vorher: Schild ueber der Tuer UND Box ueber dem Kopf, Namensschild ueber
  // dem NPC UND Box — bei zwei NPC nebeneinander vier Kaestchen. Hier wird
  // die Figur ueber den ganzen Platz gefuehrt und an jeder Stelle gezaehlt.
  const r = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2'), p = sc.player;
    var gestaltet = !!(sc.prompt && sc.prompt._c);
    var maxBoxen = 0, wo = null, mitZiel = 0, eckig = [];
    for (var y = 150; y < 760; y += 12) {
      for (var x = 20; x < 1260; x += 12) {
        p.x = x; p.y = y;
        sc._refreshInteractionPrompt();
        var n = sc.prompt.visible ? 1 : 0;
        (sc.entranceLabels || []).forEach(function (e) { if (e.label.visible) n++; });
        (sc.npcs || []).forEach(function (q) { if (q.nameText && q.nameText.visible) n++; });
        if (sc.prompt.visible) mitZiel++;
        if (n > maxBoxen) { maxBoxen = n; wo = x + '/' + y; }
      }
    }
    var text = sc.prompt._c ? sc.prompt._c.list.filter(function (o) { return o.type === 'Text'; })
      .map(function (o) { return o.text; }) : [];
    return { gestaltet: gestaltet, maxBoxen: maxBoxen, wo: wo, mitZiel: mitZiel, texte: text };
  })()`);
  assert.ok(r.gestaltet, 'die Aktionsbox ist noch das alte Textfeld');
  assert.ok(r.mitZiel > 50, 'nur an ' + r.mitZiel + ' Stellen gab es ueberhaupt ein Ziel — der Fall misst nichts');
  assert.ok(r.maxBoxen <= 1, 'bei ' + r.wo + ' standen ' + r.maxBoxen + ' Kaestchen gleichzeitig');
  // Die Taste hat ein eigenes Schild; "[E]" steht nicht mehr im Text.
  assert.ok(!Array.prototype.slice.call(r.texte).some((t) => /\[E\]/.test(t)), 'in der Box steht noch "[E]"');
});

test('die Figur ist im Hub kleiner als im Dungeon, auch nach einem Richtungswechsel', () => {
  // Gleich hoch gemessen wie die NPC wirkte sie mit dem breiten hellen
  // Umhang zu gross. Jedes Nachladen einer Laufrichtung setzt die
  // Darstellung neu — darum wird nach einem Wechsel noch einmal gemessen.
  const K = karte();
  const miss = `(function () {
    var sc = window.game.scene.getScene('HubSceneV2'), p = sc.player;
    var f = figurGrenzen(sc, 'dir06_f00');
    return f ? f.boundsHeight * Math.abs(p.scaleY) : null;
  })()`;
  const vorher = mit.run(miss);
  mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2'), p = sc.player;
    if (sc.textures.exists('dir02_f00')) p.setTexture('dir02_f00');
    if (typeof applyPlayerDisplaySettings === 'function') applyPlayerDisplaySettings(p);
    return 1;
  })()`);
  const nachher = mit.run(miss);
  assert.ok(Math.abs(vorher - K.spielerHoehe) <= 1.5, 'die Figur ist ' + vorher + ' hoch statt ' + K.spielerHoehe);
  assert.ok(Math.abs(nachher - K.spielerHoehe) <= 1.5,
    'nach dem Richtungswechsel ist die Figur ' + nachher + ' hoch statt ' + K.spielerHoehe);
  assert.ok(K.spielerHoehe < 54, 'die Hub-Figur ist nicht kleiner als die 54 des Dungeons');
});

test('jedes Ziel ist irgendwo die aktive Box', () => {
  // Die Box nimmt das NAECHSTE Ziel. Steht ein Ziel so zwischen anderen,
  // dass von ueberall ein anderes naeher ist, wird es nie aktiv — es ist
  // dann so gut wie unerreichbar. So ging es der linken Anschlagtafel in
  // b332: zwischen Mara, der Laterne und dem Klerus war fast immer ein
  // NPC naeher.
  const { K, orte } = erreichbar();
  const proben = orte.filter((p, i) => i % 2 === 0);
  const r = mit.run(`(function (proben) {
    var sc = window.game.scene.getScene('HubSceneV2'), p = sc.player;
    var x0 = p.x, y0 = p.y, gesehen = {};
    proben.forEach(function (q) {
      p.x = q[0]; p.y = q[1];
      sc._refreshInteractionPrompt();
      var a = sc._activeInteractable;
      if (!a) return;
      var id = a.type === 'npc' ? 'npc:' + a.data.id
        : a.type === 'entrance' ? 'tuer:' + a.data.id
        : 'tafel:' + Math.round(a.x || 0);
      if (a.type === 'anschlag') {
        // Welche Tafel? Die naechste.
        var best = null, bd = Infinity;
        sc._hubPhaseRefs.posterSpots.forEach(function (t, i) {
          var d = Math.hypot(q[0] - t.x, q[1] - t.y); if (d < bd) { bd = d; best = i; }
        });
        id = 'tafel:' + best;
      }
      gesehen[id] = (gesehen[id] || 0) + 1;
    });
    p.x = x0; p.y = y0;
    var sichtbar = (sc.npcs || []).filter(function (n) { return n.sprite.visible; }).map(function (n) { return 'npc:' + n.data.id; });
    return { gesehen: gesehen, sichtbar: sichtbar };
  })(${JSON.stringify(proben)})`);
  const erwartet = Array.prototype.slice.call(r.sichtbar)
    .concat(['tuer:rathaus_entrance', 'tuer:schmiede_entrance', 'tuer:druckerei_entrance', 'tuer:truhe_entrance'])
    .concat(K.anschlagtafeln.map((t, i) => 'tafel:' + i));
  // Ein fairer Anteil, nicht ein einziger Rasterpunkt. Gemessen in b332:
  // NPC 37 bis 89, die rechte Tafel 17 — und die linke 7, Aldric 4. Tueren
  // sind bewusst kleine Zonen (man muss davorstehen) und brauchen weniger.
  const mindest = (id) => (id.indexOf('tuer:') === 0 ? 3 : 12);
  const selten = erwartet.filter((id) => (r.gesehen[id] || 0) < mindest(id))
    .map((id) => id + ' (' + (r.gesehen[id] || 0) + 'x)');

  assert.ok(erwartet.length >= 10, 'nur ' + erwartet.length + ' Ziele — der Fall misst zu wenig');
  assert.deepStrictEqual(selten, [], 'fast nie die aktive Box: ' + selten.join(', '));
});

test('die Kamera sieht nie ungezeichneten Boden', () => {
  // Ueber dem Rathaus lagen zwei leere Zeilen ("Nebel"), und die Kamera
  // durfte ueber den Kartenrand hinaus — dort stand die graue Hintergrund-
  // farbe. Der gezeichnete Boden muss alles abdecken, was die Kamera zeigen
  // KANN, nicht nur was sie meistens zeigt.
  const r = mit.run(`(function () {
    var sc = window.game.scene.getScene('HubSceneV2'), b = sc.cameras.main._bounds;
    var rt = (sc.children.list || []).filter(function (c) { return c.type === 'RenderTexture'; })[0];
    return { kam: [b.x, b.y, b.x + b.width, b.y + b.height],
      boden: rt ? [rt.x, rt.y, rt.x + rt.width, rt.y + rt.height] : null };
  })()`);
  assert.ok(r.boden, 'kein Kachelboden');
  const k = Array.prototype.slice.call(r.kam), b = Array.prototype.slice.call(r.boden);
  assert.ok(b[0] <= k[0] && b[1] <= k[1] && b[2] >= k[2] && b[3] >= k[3],
    'die Kamera reicht bis ' + k.join('/') + ', der Boden nur ' + b.join('/'));
  // Und auf diesem Boden liegt ueberall etwas: keine Zelle bleibt leer.
  const K = karte();
  const leer = K.zeilen.reduce((n, z) => n + (z.match(/x/g) || []).length, 0);
  assert.strictEqual(leer, 0, 'die Karte hat ' + leer + ' leere Zellen');
});

test('der Brunnen ist nicht breiter als sein Becken', () => {
  // In b332 stand er 5,4 Kacheln breit auf einem Becken von 5 — er ragte
  // ueber den eigenen Rand und wirkte zu gross.
  const K = karte();
  const brunnen = K.requisiten.find((r) => /kettenbrunnen/.test(r.bild));
  let spalten = new Set();
  K.zeilen.forEach((z) => { for (let x = 0; x < z.length; x++) if (z[x] === 'B') spalten.add(x); });
  assert.ok(brunnen && spalten.size > 0, 'Brunnen oder Becken fehlt');
  assert.ok(brunnen.breite <= spalten.size,
    'der Brunnen ist ' + brunnen.breite + ' Kacheln breit, sein Becken ' + spalten.size);
});

test('wer direkt vor einem Ziel steht, spricht genau dieses an', () => {
  // "Irgendwo aktiv" genuegte nicht: in b333 gewann die linke Tafel weiter
  // links, aber direkt vor ihr gewann der Priester — sie mass ihren Abstand
  // von einem Punkt 64 px UEBER ihrem Fuss (aus dem gemalten Hub, wo sie an
  // einer Wand hing), die NPC vom Fuss. Hier: die erreichbare Stelle, die
  // dem Fuss eines Ziels am naechsten liegt — dort muss es gewinnen.
  const { K, orte } = erreichbar();
  const ziele = K.npcs.map((n) => ({ id: 'npc:' + n.id, x: n.x * K.kachel, y: n.y * K.kachel }))
    .concat(K.anschlagtafeln.map((t, i) => ({ id: 'tafel:' + i, x: t.x * K.kachel, y: t.y * K.kachel })));
  ziele.forEach((z) => {
    let best = null, bd = Infinity;
    orte.forEach(([x, y]) => { const d = Math.hypot(x - z.x, y - z.y); if (d < bd) { bd = d; best = [x, y]; } });
    z.stand = best;
  });
  const r = mit.run(`(function (ziele) {
    var sc = window.game.scene.getScene('HubSceneV2'), p = sc.player;
    var x0 = p.x, y0 = p.y, out = [];
    var sichtbar = {};
    (sc.npcs || []).forEach(function (n) { sichtbar[n.data.id] = n.sprite.visible; });
    ziele.forEach(function (z) {
      if (z.id.indexOf('npc:') === 0 && !sichtbar[z.id.slice(4)]) return;   // in diesem Akt nicht da
      p.x = z.stand[0]; p.y = z.stand[1];
      sc._refreshInteractionPrompt();
      var a = sc._activeInteractable, id = null;
      if (a && a.type === 'npc') id = 'npc:' + a.data.id;
      else if (a && a.type === 'anschlag') {
        var bi = null, bdd = Infinity;
        sc._hubPhaseRefs.posterSpots.forEach(function (t, i) {
          var d = Math.hypot(p.x - t.x, p.y - t.y); if (d < bdd) { bdd = d; bi = i; }
        });
        id = 'tafel:' + bi;
      } else if (a) id = a.type;
      if (id !== z.id) out.push(z.id + ' -> ' + id + ' (bei ' + z.stand.join('/') + ')');
    });
    p.x = x0; p.y = y0;
    return out;
  })(${JSON.stringify(ziele)})`);
  const falsch = Array.prototype.slice.call(r);
  assert.deepStrictEqual(falsch, [], 'direkt davor gewinnt ein anderes Ziel: ' + falsch.join('; '));
});
