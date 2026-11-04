// tests/hubBodenNebel.test.js — weicher Nebel, ruhiger Boden im Hub (b512).
//
// Gemeldet (b511): "der Nebel im Hub verlaeuft zu quadratisch, und es gibt
// Kacheln mit zu grossem Kontrast nebeneinander". Drei Ursachen:
//
//  1. Der Nebelfleck (eine Kachel, die als TileSprite ueber den Platz
//     gekachelt wird) war nicht nahtlos: Flecken am Bildrand wurden
//     abgeschnitten, und alle 320 Weltpixel lief eine gerade Kante durch den
//     Nebel — senkrecht und waagrecht.
//  2. Jede Bodenkachel trug ihr eigenes Gefaelle (oben hell, unten dunkel);
//     gekachelt ein Gitter aus schattierten Quadraten.
//  3. Die Varianten einer Flaeche und die Arten untereinander lagen in der
//     Helligkeit weit auseinander.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ARTEN, ebene, luma } = require('../tools/bodenAngleichen.js');

const WURZEL = path.join(__dirname, '..');
const HUB = path.join(WURZEL, 'assets', 'hub');

function welt() {
  const fenster = { console: { warn() {}, log() {} } };
  fenster.window = fenster;
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'hub', 'hubNeuWelt.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'module', q)(fenster, {});
  return fenster.HubNeuWelt;
}

async function lade(name) {
  const { data, info } = await sharp(path.join(HUB, name + '.png')).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
function mittel(b) {
  let s = 0, n = 0;
  for (let i = 0; i < b.data.length; i += 4) if (b.data[i + 3] >= 128) { s += luma(b.data, i); n++; }
  return s / n;
}

// ------------------------------------------------------------------ Nebel

test('der Nebelfleck ist nahtlos: gegenueberliegende Raender passen aneinander', () => {
  const W = welt();
  const S = W.NEBEL_GROESSE;
  const feld = W.nebelFeld(S);
  assert.strictEqual(feld.length, S * S);
  // Ueber eine Kachelgrenze hinweg darf sich der Nebel nicht staerker
  // aendern als zwischen zwei beliebigen Nachbarpunkten im Inneren.
  let innen = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S - 1; x++) innen = Math.max(innen, Math.abs(feld[y * S + x] - feld[y * S + x + 1]));
  }
  for (let x = 0; x < S; x++) {
    for (let y = 0; y < S - 1; y++) innen = Math.max(innen, Math.abs(feld[y * S + x] - feld[(y + 1) * S + x]));
  }
  let naht = 0;
  for (let i = 0; i < S; i++) {
    naht = Math.max(naht, Math.abs(feld[i * S] - feld[i * S + S - 1]));      // links/rechts
    naht = Math.max(naht, Math.abs(feld[i] - feld[(S - 1) * S + i]));        // oben/unten
  }
  assert.ok(naht <= innen + 1e-6,
    'Sprung an der Kachelnaht ' + naht.toFixed(3) + ' > groesster innerer Schritt ' + innen.toFixed(3));
  // Und es ist Nebel, keine gleichmaessige Flaeche: Schwaden und Luecken.
  let min = 1, max = 0;
  for (let i = 0; i < feld.length; i++) { min = Math.min(min, feld[i]); max = Math.max(max, feld[i]); }
  assert.ok(max - min > 0.3, 'der Nebel ist zu gleichmaessig: ' + min.toFixed(2) + '..' + max.toFixed(2));
});

test('der Nebel hat keine harten Kanten: auf dem Schirm kein sichtbarer Sprung', () => {
  const W = welt();
  const S = W.NEBEL_GROESSE;
  const feld = W.nebelFeld(S);
  // Mit Umlauf gemessen — die Naht zaehlt mit.
  let schritt = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = feld[y * S + x];
      schritt = Math.max(schritt, Math.abs(a - feld[y * S + (x + 1) % S]), Math.abs(a - feld[((y + 1) % S) * S + x]));
    }
  }
  // Ein Fleckpunkt wird auf mindestens 2.5 Weltpixel gezogen und mit der
  // Deckkraft seiner Ebene gezeichnet. Was zaehlt, ist der Sprung auf dem
  // Schirm — auch in der dichtesten Phase hoechstens ein Hauch.
  const dichteste = Math.max(...['council', 'doubleAgent', 'broken', 'epilogue'].map((ph) => {
    const ebenen = W.NEBEL_EBENEN.map(() => ({ active: true, setAlpha(a) { this.alpha = a; return this; } }));
    W.nebelFuerPhase(ebenen, ph);
    return Math.max(...ebenen.map((e) => e.alpha));
  }));
  assert.ok(schritt * dichteste < 0.08,
    'groesster Schritt ' + schritt.toFixed(3) + ' x Deckkraft ' + dichteste.toFixed(2));
});

// Gemeldet (b512): "seh ich jetzt gar kein Nebel mehr", und auf dem ersten
// Vorschlag (b513-Entwurf, gleiche Schleier 0.13/0.09): "Nebel kann ich nicht
// sehen". Im Browser (WebGL) kam der Nebel an, hellte den Boden aber nur um
// gut 11 von 255 auf — ein Grauschleier. Nebel sieht man an hellen Baenken
// mit Luecken dazwischen. Kennzahlen des Flecks: alter, gemalter Fleck (bis
// b511) Mittel 0.44, Streuung 0.29, frei (< 0.1) 18 %; b512 0.45 / 0.21 / 8 %.
function kennzahlen(feld) {
  const n = feld.length;
  let m = 0, max = 0, frei = 0;
  for (let i = 0; i < n; i++) { m += feld[i]; max = Math.max(max, feld[i]); if (feld[i] < 0.1) frei++; }
  m /= n;
  let q = 0;
  for (let i = 0; i < n; i++) q += (feld[i] - m) * (feld[i] - m);
  return { mittel: m, streuung: Math.sqrt(q / n), frei: frei / n, max };
}

test('der Nebelfleck hat Baenke und Luecken, keinen gleichmaessigen Schleier', () => {
  const W = welt();
  const k = kennzahlen(W.nebelFeld(W.NEBEL_GROESSE));
  const txt = JSON.stringify(k, (key, v) => (typeof v === 'number' ? +v.toFixed(3) : v));
  assert.ok(k.mittel >= 0.45 && k.mittel <= 0.7, 'mittlere Deckung ausserhalb 0.45..0.7: ' + txt);
  assert.ok(k.streuung >= 0.38, 'zu gleichmaessig, nur ein Grauschleier: ' + txt);
  assert.ok(k.frei >= 0.2, 'kaum Luecken zwischen den Baenken: ' + txt);
  assert.ok(k.max >= 0.95, 'keine dichte Bank: ' + txt);
});

function attrappenSzene() {
  const s = { bild: null, erneuert: false, geschrieben: false, texturen: {} };
  const ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (b) => { s.bild = b; s.geschrieben = true; s.erneuert = false; },
  };
  s.szene = {
    textures: {
      exists: (k) => !!s.texturen[k],
      createCanvas: (k, w, h) => (s.texturen[k] = { w, h, getContext: () => ctx, refresh: () => { s.erneuert = true; } }),
    },
    add: {
      tileSprite: (x, y, w, h, key) => {
        const ts = { key, w, h, active: true, tilePositionX: 0, tilePositionY: 0 };
        ts.setOrigin = () => ts;
        ts.setAlpha = (a) => { ts.alpha = a; return ts; };
        ts.setDepth = (d) => { ts.depth = d; return ts; };
        return ts;
      },
    },
    events: { on(n, f) { s.update = f; }, once() {}, off() {} },
  };
  return s;
}

// Luma, wie bodenAngleichen sie misst.
const helle = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

test('die Deckung kommt in der Nebeltextur an, die Baenke sind auf dem Boden deutlich', () => {
  const W = welt();
  const S = W.NEBEL_GROESSE;
  const A = attrappenSzene();
  const erg = W._nebel(A.szene, 1280, 768);
  assert.ok(A.geschrieben, 'nichts in die Nebeltextur geschrieben');
  assert.ok(A.erneuert, 'Textur nach dem Schreiben nicht erneuert (WebGL laedt sonst nichts hoch)');
  assert.strictEqual(A.bild.width, S);
  const feld = W.nebelFeld(S);
  for (let p = 0; p < S * S; p++) {
    assert.strictEqual(A.bild.data[p * 4 + 3], Math.round(feld[p] * 255), 'Alpha an Punkt ' + p);
  }
  // Graublau und nicht vormultipliziert: heller als der Boden, auch wo die
  // Bank duenn ist, aber kein leuchtendes Weiss (b518: "zu hell").
  const farbe = [A.bild.data[0], A.bild.data[1], A.bild.data[2]];
  assert.ok(helle(...farbe) >= 140 && helle(...farbe) <= 190 && farbe[2] > farbe[0], 'Nebelfarbe ' + farbe);

  assert.strictEqual(erg.length, 2);
  for (const ts of erg) {
    assert.strictEqual(ts.key, 'hub_nebelfleck');
    assert.ok(ts.w >= 1280 && ts.h >= 768, 'Nebel deckt den Platz nicht');
    // Ueber dem Boden, unter allem, was steht (Baeume ab -8, Figuren nach y).
    assert.ok(ts.depth > -20 && ts.depth < -8, 'Nebeltiefe ' + ts.depth);
  }
  // Wie stark hebt eine dichte Bank (Fleck 1 in beiden Ebenen) den hellsten
  // Boden (Pflaster, Luma 50) an? b512: 1-(1-0.13)(1-0.09) = 0.21 -> +35, mit
  // dem Mittel des Flecks auf dem Schirm nur gut +11: unsichtbar.
  const deck = 1 - erg.reduce((p, ts) => p * (1 - ts.alpha), 1);
  const hub = deck * (helle(...farbe) - 50);
  // Sichtbar (b512: unsichtbar), aber nicht gleissend (b518: +102, "zu hell").
  assert.ok(hub >= 50 && hub <= 80, 'eine dichte Bank hebt den Boden um ' + hub.toFixed(0) + ' an (Deckung ' + deck.toFixed(2) + ')');

  // Die Ebenen treiben verschieden — die Luecken wandern, ohne Naht.
  const vorher = erg.map((ts) => [ts.tilePositionX, ts.tilePositionY]);
  A.update(0, 1000);
  const weg = erg.map((ts, i) => [ts.tilePositionX - vorher[i][0], ts.tilePositionY - vorher[i][1]]);
  assert.ok(weg.every(([dx]) => Math.abs(dx) >= 3), 'Nebel treibt nicht: ' + JSON.stringify(weg));
  assert.notStrictEqual(weg[0][0], weg[1][0], 'beide Ebenen treiben gleich');
  assert.notStrictEqual(erg[0].tileScaleX, erg[1].tileScaleX, 'beide Ebenen gleich gross');
});

test('der Bodennebel folgt der Hub-Phase: dichter im Bruch, duenn im Epilog', () => {
  const W = welt();
  const deck = {};
  for (const ph of ['council', 'doubleAgent', 'broken', 'epilogue', 'gibtsnicht']) {
    const ebenen = W.NEBEL_EBENEN.map(() => ({ active: true, setAlpha(a) { this.alpha = a; return this; } }));
    W.nebelFuerPhase(ebenen, ph);
    deck[ph] = 1 - ebenen.reduce((p, e) => p * (1 - e.alpha), 1);
  }
  assert.ok(deck.broken > deck.doubleAgent && deck.doubleAgent > deck.council, JSON.stringify(deck));
  assert.ok(deck.epilogue > 0 && deck.epilogue < deck.council, JSON.stringify(deck));
  assert.strictEqual(deck.gibtsnicht, deck.council);
  // Die Szene stellt ihn beim Anwenden der Phase ein.
  const q = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'HubSceneV2.js'), 'utf8');
  const an = q.slice(q.indexOf('_wendeHubPhaseAn(phase) {'));
  assert.ok(/nebelFuerPhase\(this\._bodenNebel, phase\)/.test(an.slice(0, 600)), '_wendeHubPhaseAn stellt den Nebel nicht ein');
});

// ------------------------------------------------------------------ Boden

test('die Bodenarten des Hubs sind genau die, die bodenAngleichen kennt', () => {
  const W = welt();
  const bekannt = [].concat(...ARTEN.map((a) => a.flaechen));
  const genutzt = [].concat(...W._SCHICHTEN.map((s) => s.flaeche)).concat([W._ERDE])
    .map((k) => k.replace(/^hub_/, ''));
  const fehlt = genutzt.filter((k) => bekannt.indexOf(k) < 0);
  assert.deepStrictEqual(fehlt, [], 'nicht angeglichen: ' + fehlt.join(', '));
});

test('keine Bodenkachel traegt ein eigenes Gefaelle (kein Quadratgitter)', async () => {
  const schief = [];
  for (const art of ARTEN) {
    for (const n of art.flaechen) {
      const b = await lade(n);
      const e = ebene(b.data, b.W, b.H);
      // Helligkeitsunterschied, den die Ebene ueber die Kachel aufbaut.
      const gefaelle = Math.abs(e.b) * (b.W - 1) + Math.abs(e.c) * (b.H - 1);
      if (gefaelle > 3) schief.push(n + ' ' + gefaelle.toFixed(1));
    }
  }
  assert.deepStrictEqual(schief, [], 'Gefaelle ueber die Kachel: ' + schief.join(', '));
});

test('Varianten einer Flaeche sind gleich hell, benachbarte Arten nah beieinander', async () => {
  const pegel = {};
  for (const art of ARTEN) {
    const m = [];
    for (const n of art.flaechen) m.push(mittel(await lade(n)));
    const spanne = Math.max(...m) - Math.min(...m);
    assert.ok(spanne < 1.5, art.name + ': Varianten ' + m.map((v) => v.toFixed(1)).join('/'));
    pegel[art.name] = m.reduce((a, b) => a + b, 0) / m.length;
  }
  // Wer an wen grenzt (hubNeuKarte): Pflaster an Platte und Erde, Platte an
  // Erde und Gras, Gras an Erde.
  const paare = [['pflaster', 'platte', 8], ['pflaster', 'erde', 22], ['platte', 'erde', 18],
    ['platte', 'gras', 16], ['gras', 'erde', 5]];
  const zu = paare.filter(([a, b, max]) => Math.abs(pegel[a] - pegel[b]) > max)
    .map(([a, b]) => a + ' ' + pegel[a].toFixed(1) + ' / ' + b + ' ' + pegel[b].toFixed(1));
  assert.deepStrictEqual(zu, [], 'zu grosser Helligkeitssprung: ' + zu.join('; '));
});

test('Uebergangskacheln sind Punkt fuer Punkt aus ihrer (angeglichenen) Grundkachel', async () => {
  const falsch = [];
  for (const art of ARTEN) {
    if (!art.uebergang) continue;
    const Q = await lade(art.uebergang);
    for (let m = 1; m < 15; m++) {
      const U = await lade('ueber_' + art.name + m);
      let ab = 0;
      for (let i = 0; i < U.data.length; i += 4) {
        if (U.data[i + 3] < 10) continue;
        if (U.data[i] !== Q.data[i] || U.data[i + 1] !== Q.data[i + 1] || U.data[i + 2] !== Q.data[i + 2]) ab++;
      }
      if (ab) falsch.push('ueber_' + art.name + m + ' (' + ab + ' Punkte)');
    }
  }
  assert.deepStrictEqual(falsch, [], 'weichen von der Grundkachel ab: ' + falsch.join(', '));
});
