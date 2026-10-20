// Hoehlen-Engstellen: jeder Durchgang muss fuer den Spielerkoerper (34x56 px)
// passierbar sein, nicht nur fuer einen Punkt. Gemeldet: "Es gibt noch
// Durchgaenge in proc room caverns, wo man knapp nicht durchkommt."
//
// Gemessen vor dem Fix (200 Hoehlen, Pixel-Konfigurationsraum): in 139 lag ein
// Eingang oder eine Truhe zwar per Kachel-BFS, aber nicht fuer den Koerper
// erreichbar (57 schon ohne Props — versetzte 2er-Treppen, 1-Kachel-Spalten).
//
// Die Pruefung hier ist unabhaengig vom Generator: ein echter Koerper-Flood-
// Fill in Pixeln (Waende 32er-Kacheln, Props mit Texturmass auf der
// Kachelmitte), nicht das 2x2-Blockmodell, das der Generator selbst benutzt.

const { test } = require('node:test');
const assert = require('node:assert');

global.window = global.window || {};
require('../js/caveGenerator.js');
require('../js/proceduralRooms.js');
const CG = window.CaveGenerator;
const PR = window.ProceduralRooms;

// STEP 4 px: Waende liegen auf 32er-Raster, der Koerper trifft jede Lage in einem 2-Kachel-Spalt.
const T = 32, BW = 34, BH = 56, STEP = 4;
const MASSE = {
  pillar_small: [32, 32], pillar_large: [48, 48], statue_knight: [48, 64],
  barrel: [24, 32], crate: [32, 32],
  chest_small: [36, 26], chest_medium: [44, 32], chest_large: [52, 38]
};

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hoehle mit festem Seed; Math.random (Truhenplatz) fuer die Dauer festhalten.
function hoehle(opts, gen) {
  const alt = Math.random;
  Math.random = mulberry(opts.seed ^ 0x9e37);
  try { return (gen || CG).generate(opts); } finally { Math.random = alt; }
}

// Koerper-Flood-Fill. Liefert pro Kachel: punkt (Kachel-BFS ueber Boden ohne
// Objektkacheln), mitte (ein erreichbarer Koerper ueberdeckt die Kachelmitte)
// und nah (ein erreichbarer Koerper kommt der Kachel auf 8 px nahe).
function koerperFlut(tpl) {
  const walls = tpl.layout.walls, H = walls.length, W = walls[0].length;
  // Rand mauert applyRoomTemplate zu.
  const wand = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1 || walls[y][x] !== '.';
  const objekte = (tpl.objects || []).filter((o) => MASSE[o.type]).concat(tpl.spawns.loot || []);
  const eimer = new Map();
  objekte.forEach((o) => {
    const m = MASSE[o.type] || [32, 32];
    const cx = o.x * T + T / 2, cy = o.y * T + T / 2;
    const r = { x0: cx - m[0] / 2, y0: cy - m[1] / 2, x1: cx + m[0] / 2, y1: cy + m[1] / 2 };
    for (let ty = Math.floor(r.y0 / T); ty <= Math.floor((r.y1 - 1) / T); ty++) {
      for (let tx = Math.floor(r.x0 / T); tx <= Math.floor((r.x1 - 1) / T); tx++) {
        const k = ty * W + tx;
        if (!eimer.has(k)) eimer.set(k, []);
        eimer.get(k).push(r);
      }
    }
  });
  const CW = Math.floor((W * T - BW) / STEP) + 1, CH = Math.floor((H * T - BH) / STEP) + 1;
  const memo = new Uint8Array(CW * CH);
  const frei = (i, j) => {
    const k = j * CW + i;
    if (memo[k]) return memo[k] === 1;
    const x0 = i * STEP, y0 = j * STEP, x1 = x0 + BW, y1 = y0 + BH;
    let ok = true;
    for (let ty = Math.floor(y0 / T); ty <= Math.floor((y1 - 1) / T) && ok; ty++) {
      for (let tx = Math.floor(x0 / T); tx <= Math.floor((x1 - 1) / T) && ok; tx++) {
        if (wand(tx, ty)) { ok = false; break; }
        for (const r of eimer.get(ty * W + tx) || []) {
          if (r.x0 < x1 && r.x1 > x0 && r.y0 < y1 && r.y1 > y0) { ok = false; break; }
        }
      }
    }
    memo[k] = ok ? 1 : 2;
    return ok;
  };
  const sp = tpl.spawns.player;
  let start = -1, best = Infinity;
  const i0 = Math.round((sp.x * T + 16 - BW / 2) / STEP), j0 = Math.round((sp.y * T + 16 - BH / 2) / STEP);
  for (let dj = -16; dj <= 16; dj++) {
    for (let di = -16; di <= 16; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= CW || j >= CH || !frei(i, j)) continue;
      if (di * di + dj * dj < best) { best = di * di + dj * dj; start = j * CW + i; }
    }
  }
  const erreicht = new Uint8Array(CW * CH);
  const mitte = new Uint8Array(W * H), nah = new Uint8Array(W * H);
  if (start >= 0) {
    const q = [start]; erreicht[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % CW, j = (k - i) / CW;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= CW || b >= CH) continue;
        const kk = b * CW + a;
        if (erreicht[kk] || !frei(a, b)) continue;
        erreicht[kk] = 1; q.push(kk);
      }
      const x0 = i * STEP, y0 = j * STEP;
      for (let ty = Math.floor(y0 / T); ty <= Math.floor((y0 + BH - 1) / T); ty++) {
        for (let tx = Math.floor(x0 / T); tx <= Math.floor((x0 + BW - 1) / T); tx++) {
          const cx = tx * T + 16, cy = ty * T + 16;
          if (cx > x0 && cx < x0 + BW && cy > y0 && cy < y0 + BH) mitte[ty * W + tx] = 1;
        }
      }
      for (let ty = Math.floor((y0 - 8) / T); ty <= Math.floor((y0 + BH + 7) / T); ty++) {
        for (let tx = Math.floor((x0 - 8) / T); tx <= Math.floor((x0 + BW + 7) / T); tx++) {
          if (tx >= 0 && ty >= 0 && tx < W && ty < H) nah[ty * W + tx] = 1;
        }
      }
    }
  }
  const objKachel = new Set(objekte.map((o) => o.y * W + o.x));
  const punkt = new Uint8Array(W * H);
  if (!wand(sp.x, sp.y)) {
    const q = [sp.y * W + sp.x]; punkt[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % W, y = (k - x) / W;
      for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (wand(a, b)) continue;
        const kk = b * W + a;
        if (punkt[kk] || objKachel.has(kk)) continue;
        punkt[kk] = 1; q.push(kk);
      }
    }
  }
  return { W, H, punkt, mitte, nah };
}

// Was der Punkt erreicht, der Koerper aber nicht: Ziele (Eingaenge, Truhen)
// und zusammenhaengende Bodenflecken ab 4 Kacheln (kleinere sind Zwickel
// direkt an runden Props, an die der Koerper nur nicht mittig herankommt).
function befund(tpl) {
  const f = koerperFlut(tpl);
  const { W } = f;
  const ziele = [];
  (tpl.entrances || []).forEach((e) => {
    if (f.punkt[e.y * W + e.x] && !f.nah[e.y * W + e.x]) ziele.push(`Eingang ${e.dir} (${e.x},${e.y})`);
  });
  (tpl.spawns.loot || []).forEach((l) => {
    const p = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => f.punkt[(l.y + b) * W + l.x + a]);
    if (p && !f.nah[l.y * W + l.x]) ziele.push(`Truhe (${l.x},${l.y})`);
  });
  const weg = new Set();
  for (let i = 0; i < f.punkt.length; i++) if (f.punkt[i] && !f.mitte[i]) weg.add(i);
  const gesehen = new Set(), flecken = [];
  weg.forEach((k0) => {
    if (gesehen.has(k0)) return;
    const q = [k0]; gesehen.add(k0);
    for (let h = 0; h < q.length; h++) {
      for (const kk of [q[h] + 1, q[h] - 1, q[h] + W, q[h] - W]) {
        if (weg.has(kk) && !gesehen.has(kk)) { gesehen.add(kk); q.push(kk); }
      }
    }
    if (q.length >= 4) flecken.push(`${q.length} Kacheln ab (${q[0] % W},${Math.floor(q[0] / W)})`);
  });
  return { ziele, flecken };
}

// Groessen wie roomManager sie wuerfelt (small/medium/large, Mobile-Deckel).
const GROESSEN = [[56, 48], [63, 54], [74, 64], [85, 76], [100, 90], [116, 107], [60, 52], [70, 60]];

test('Hoehlen: Eingaenge, Truhen und Boden sind fuer den Koerper erreichbar (Seed-Sweep)', () => {
  const fehler = [];
  for (let n = 0; n < 48; n++) {
    const seed = 7001 + n * 104729;
    const [w, h] = GROESSEN[n % GROESSEN.length];
    const tpl = hoehle({ width: w, height: h, seed, depth: 1 + (n % 30) });
    const b = befund(tpl);
    if (b.ziele.length || b.flecken.length) {
      fehler.push(`seed ${seed} ${w}x${h} ${tpl.theme.id}: ${b.ziele.concat(b.flecken).join('; ')}`);
    }
  }
  assert.deepStrictEqual(fehler, [], 'punkt-, aber nicht koerper-erreichbar:\n' + fehler.join('\n'));
});

// BSP-Kammern (proceduralRooms) teilen die Reparatur. Vorher (200 Raeume):
// 1 Raum mit Tuer-Stummel, der die Nachbarkammer nur mit 1 Kachel beruehrt
// (seed 1236364, fast der ganze Raum hinter dem Spalt), mit Props 6 Raeume
// mit abgeschnittener Truhe/Treppe und 91 mit Bodenflecken hinter Props.
test('BSP-Kammern: Treppen, Truhen und Boden sind fuer den Koerper erreichbar (Seed-Sweep)', () => {
  const fehler = [];
  const seeds = [1236364];
  for (let n = 0; n < 23; n++) seeds.push(9001 + n * 7919);
  seeds.forEach((seed, n) => {
    const [w, h] = n === 0 ? [100, 90] : GROESSEN[n % GROESSEN.length];
    const tpl = hoehle({ width: w, height: h, seed }, PR);
    const b = befund(tpl);
    if (b.ziele.length || b.flecken.length) {
      fehler.push(`seed ${seed} ${w}x${h} ${tpl.theme.id}: ${b.ziele.concat(b.flecken).join('; ')}`);
    }
  });
  assert.deepStrictEqual(fehler, [], 'punkt-, aber nicht koerper-erreichbar:\n' + fehler.join('\n'));
});

// Kleines Gitter aus Zeichenketten ('#' Wand, '.' Boden) als veraenderbares Feld.
function gitter(zeilen) { return zeilen.map((z) => z.split('')); }
function text(g) { return g.map((r) => r.join('')); }

test('Hoehlen: 1-Kachel-Spalt zwischen zwei Kammern wird auf 2 Kacheln aufgeweitet', () => {
  const g = gitter([
    '##############',
    '#.....##.....#',
    '#.....##.....#',
    '#.....##.....#',
    '#............#',
    '#.....##.....#',
    '#.....##.....#',
    '##############'
  ]);
  CG.sichereKoerperDurchgaenge(g, []);
  const t = text(g);
  // Spalte 6/7, Zeile 4 war der einzige Spalt; jetzt muss eine zweite Zeile
  // daneben (3 oder 5) ebenfalls offen sein.
  const offen = (y) => t[y][6] === '.' && t[y][7] === '.';
  assert.ok(offen(4) && (offen(3) || offen(5)), 'Spalt nicht aufgeweitet:\n' + t.join('\n'));
  // Und beide Kammern sind noch da (nichts zugemauert).
  assert.strictEqual(t[2][2], '.', 'linke Kammer zugemauert:\n' + t.join('\n'));
  assert.strictEqual(t[2][11], '.', 'rechte Kammer zugemauert:\n' + t.join('\n'));
});

test('Hoehlen: versetzte 2er-Treppe (Stufen ueberlappen nur 32 px) wird aufgeweitet', () => {
  const zeilen = [
    '############',
    '#...########',
    '#...########',
    '#....#######',
    '####..######',
    '#####..#####',
    '######..####',
    '#######....#',
    '#######....#',
    '#######....#',
    '############'
  ];
  const alsVorlage = (t) => ({ layout: { walls: t }, objects: [], entrances: [], spawns: { player: { x: 2, y: 2 }, loot: [] } });
  const ziel = 8 * 12 + 9;   // Kachel (9,8) in der rechten Kammer
  // Vorher: Kachel-BFS kommt durch, der Koerper nicht.
  const vorher = koerperFlut(alsVorlage(zeilen));
  assert.ok(vorher.punkt[ziel] && !vorher.mitte[ziel], 'Ausgangslage: Treppe sollte fuer den Koerper zu sein');
  const g = gitter(zeilen);
  CG.sichereKoerperDurchgaenge(g, []);
  const t = text(g);
  assert.ok(koerperFlut(alsVorlage(t)).mitte[ziel], 'rechte Kammer fuer den Koerper unerreichbar:\n' + t.join('\n'));
  assert.strictEqual(t[2][2], '.', 'linke Kammer zugemauert statt angebunden:\n' + t.join('\n'));
});

test('Hoehlen: Mini-Tasche hinter 1-Kachel-Spalt wird Wand statt Scheingang', () => {
  const g = gitter([
    '############',
    '#........###',
    '#.........##',
    '#........#.#',
    '#........###',
    '############'
  ]);
  // (10,3) ist eine 1-Kachel-Tasche, nur diagonal/ueber 1 Kachel erreichbar.
  CG.sichereKoerperDurchgaenge(g, []);
  const t = text(g);
  assert.strictEqual(t[3][10], '#', 'Tasche offen gelassen:\n' + t.join('\n'));
  assert.strictEqual(t[2][9], '#', '1-Kachel-Zipfel offen gelassen:\n' + t.join('\n'));
  assert.strictEqual(t[2][4], '.', 'Kammer angetastet:\n' + t.join('\n'));
});

test('Hoehlen: Saeule im 2er-Gang fliegt raus, Saeule im offenen Raum bleibt', () => {
  const g = gitter([
    '################',
    '#......#########',
    '#......#########',
    '#..............#',
    '#..............#',
    '#......####....#',
    '#......####....#',
    '################'
  ]);
  const verlust = CG.koerperPruefer(g, { x: 2, y: 2 });
  const imGang = { type: 'pillar_small', x: 9, y: 3 };
  const imRaum = { type: 'pillar_small', x: 3, y: 3 };
  assert.ok(verlust([imGang]).length > 0, 'Saeule im Gang sollte den Koerper aussperren');
  const rest = CG.ohneEngstellen([imGang, imRaum], verlust);
  assert.deepStrictEqual(rest, [imRaum]);
});

test('BSP-Kammern: zwei versetzte Altaere uebereinander (24 px Luft) — einer faellt weg', () => {
  const g = gitter([
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '############'
  ]);
  const verlust = CG.koerperPruefer(g, { x: 9, y: 8 });
  const oben = { type: 'altar', x: 5, y: 3 }, unten = { type: 'altar', x: 6, y: 5 };
  // Altar 64x40: zwischen beiden bleiben 24 px, darin steht kein 56 px hoher Koerper.
  assert.ok(verlust([oben, unten]).length > 0, 'Zwickel zwischen den Altaeren nicht erkannt');
  assert.strictEqual(CG.ohneEngstellen([oben, unten], verlust).length, 1);
});
