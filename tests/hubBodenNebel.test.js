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

test('der Nebel hat keine harten Kanten: kein Schritt groesser als ein Hauch', () => {
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
  assert.ok(schritt < 0.06, 'groesster Schritt im Nebel ' + schritt.toFixed(3));
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
