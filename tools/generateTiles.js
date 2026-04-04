const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ============================================================
//  Output directory
// ============================================================
const OUT = path.join(__dirname, '..', 'assets', 'tiles');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ============================================================
//  Color helpers
// ============================================================
function parseHex(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: 1,
  };
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function shade(hex, f) {
  const c = parseHex(hex);
  return toHex(c.r * f, c.g * f, c.b * f);
}

function mix(hex1, hex2, t) {
  const a = parseHex(hex1), b = parseHex(hex2);
  return toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

// ============================================================
//  Seeded PRNG (for reproducible tiles)
// ============================================================
let _seed = 42;
function seed(s) { _seed = s; }
function rand() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 0x7fffffff;
}
function randInt(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ============================================================
//  Pixel helpers
// ============================================================
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function pxA(ctx, x, y, r, g, b, a) {
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
  ctx.fillRect(x, y, 1, 1);
}

function fill(ctx, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function save(canvas, name) {
  const out = path.join(OUT, name);
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  console.log('Generated:', name);
}

// Wrap coords for seamless tiling
function wrap(v, size) { return ((v % size) + size) % size; }

// Noise: value noise on a tileable grid
function makeNoise(w, h) {
  const grid = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < w; x++) grid[y][x] = rand();
  }
  return grid;
}

// Smooth tileable noise via bilinear interpolation on a smaller grid
function tileableNoise(w, h, scale) {
  const gw = Math.max(2, Math.floor(w / scale));
  const gh = Math.max(2, Math.floor(h / scale));
  const grid = [];
  for (let y = 0; y < gh; y++) {
    grid[y] = [];
    for (let x = 0; x < gw; x++) grid[y][x] = rand();
  }
  const out = [];
  for (let y = 0; y < h; y++) {
    out[y] = [];
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * gw;
      const gy = (y / h) * gh;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy;
      const v00 = grid[iy % gh][ix % gw];
      const v10 = grid[iy % gh][(ix + 1) % gw];
      const v01 = grid[(iy + 1) % gh][ix % gw];
      const v11 = grid[(iy + 1) % gh][(ix + 1) % gw];
      const top = v00 + (v10 - v00) * fx;
      const bot = v01 + (v11 - v01) * fx;
      out[y][x] = top + (bot - top) * fy;
    }
  }
  return out;
}

// ============================================================
//  1. floor_stone_dark.png
// ============================================================
function genFloorStoneDark() {
  seed(100);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const colors = ['#3a3a42', '#333338', '#2d2d32'];

  // Base: smooth noise
  const n1 = tileableNoise(S, S, 6);
  const n2 = tileableNoise(S, S, 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = n1[y][x] * 0.7 + n2[y][x] * 0.3;
      const idx = Math.min(2, Math.floor(t * 3));
      px(ctx, x, y, colors[idx]);
    }
  }

  // Mortar lines: a grid of subtle lines
  const mortarColor = '#26262c';
  // Horizontal mortar at y=0 and y=16 (tileable)
  for (let x = 0; x < S; x++) {
    if (rand() > 0.15) px(ctx, x, 0, mortarColor);
    if (rand() > 0.15) px(ctx, x, 16, mortarColor);
  }
  // Vertical mortar offset per row-band
  for (let y = 1; y < 16; y++) {
    if (rand() > 0.15) px(ctx, 10, y, mortarColor);
    if (rand() > 0.15) px(ctx, 26, y, mortarColor);
  }
  for (let y = 17; y < S; y++) {
    if (rand() > 0.15) px(ctx, 0, y, mortarColor);
    if (rand() > 0.15) px(ctx, 18, y, mortarColor);
  }

  // Cracks: a couple short diagonal lines
  const crackColor = '#222228';
  let cx = 5, cy = 4;
  for (let i = 0; i < 6; i++) {
    px(ctx, wrap(cx, S), wrap(cy, S), crackColor);
    cx += pick([0, 1]); cy += pick([1, 1]);
  }
  cx = 20; cy = 22;
  for (let i = 0; i < 5; i++) {
    px(ctx, wrap(cx, S), wrap(cy, S), crackColor);
    cx += pick([1, 0]); cy += pick([1, 1]);
  }

  // Dark wear spots
  for (let i = 0; i < 12; i++) {
    const sx = randInt(0, S - 1), sy = randInt(0, S - 1);
    px(ctx, sx, sy, shade(colors[2], 0.85));
  }

  save(canvas, 'floor_stone_dark.png');
}

// ============================================================
//  2. floor_stone_wet.png
// ============================================================
function genFloorStoneWet() {
  seed(200);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const base = '#2e3038';
  const highlight = '#3a4050';

  const n1 = tileableNoise(S, S, 6);
  const n2 = tileableNoise(S, S, 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = n1[y][x] * 0.6 + n2[y][x] * 0.4;
      px(ctx, x, y, mix(base, shade(base, 0.9), t));
    }
  }

  // Mortar lines
  const mortar = '#24262e';
  for (let x = 0; x < S; x++) {
    if (rand() > 0.1) px(ctx, x, 0, mortar);
    if (rand() > 0.1) px(ctx, x, 16, mortar);
  }
  for (let y = 1; y < 16; y++) {
    if (rand() > 0.1) px(ctx, 12, y, mortar);
    if (rand() > 0.1) px(ctx, 28, y, mortar);
  }
  for (let y = 17; y < S; y++) {
    if (rand() > 0.1) px(ctx, 0, y, mortar);
    if (rand() > 0.1) px(ctx, 20, y, mortar);
  }

  // Wet highlights: scattered reflective dots
  const nh = tileableNoise(S, S, 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (nh[y][x] > 0.72) {
        px(ctx, x, y, highlight);
      }
    }
  }

  // A few bright specular spots
  for (let i = 0; i < 8; i++) {
    const sx = randInt(0, S - 1), sy = randInt(0, S - 1);
    px(ctx, sx, sy, shade(highlight, 1.2));
  }

  save(canvas, 'floor_stone_wet.png');
}

// ============================================================
//  3. floor_cobble.png
// ============================================================
function genFloorCobble() {
  seed(300);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const mortar = '#222228';
  const stoneColors = ['#4a4a50', '#3d3d44', '#454550', '#424248'];

  fill(ctx, S, S, mortar);

  // Place irregular rounded stones using a simple grid with jitter
  const stones = [];
  const gs = 8; // grid step
  for (let gy = 0; gy < S; gy += gs) {
    for (let gx = 0; gx < S; gx += gs) {
      const jx = randInt(-1, 1);
      const jy = randInt(-1, 1);
      const sw = randInt(5, 7);
      const sh = randInt(5, 7);
      const col = pick(stoneColors);
      stones.push({ x: gx + jx, y: gy + jy, w: sw, h: sh, col });
    }
  }

  for (const s of stones) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const rx = s.w / 2, ry = s.h / 2;
    for (let dy = 0; dy < s.h; dy++) {
      for (let dx = 0; dx < s.w; dx++) {
        const nx = (s.x + dx - cx) / rx;
        const ny = (s.y + dy - cy) / ry;
        const dist = nx * nx + ny * ny;
        if (dist < 1.0) {
          // Shading: lighter toward top-left, darker bottom-right
          const shadeF = 1.0 - dist * 0.15 + (nx * -0.08) + (ny * -0.08);
          const c = shade(s.col, shadeF);
          // Add slight per-pixel noise
          const noisy = rand() > 0.8 ? shade(c, 0.92) : c;
          px(ctx, wrap(s.x + dx, S), wrap(s.y + dy, S), noisy);
        }
      }
    }
  }

  save(canvas, 'floor_cobble.png');
}

// ============================================================
//  4. floor_tile_ornate.png
// ============================================================
function genFloorTileOrnate() {
  seed(400);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const base = '#3a3640';
  const pattern = '#4a4048';
  const border = '#302c36';

  // Base fill with subtle noise
  const n = tileableNoise(S, S, 5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      px(ctx, x, y, mix(base, shade(base, 0.92), n[y][x]));
    }
  }

  // Border line around edge (1px)
  for (let i = 0; i < S; i++) {
    px(ctx, i, 0, border); px(ctx, i, S - 1, border);
    px(ctx, 0, i, border); px(ctx, S - 1, i, border);
  }

  // Diamond pattern in center
  const mid = 16;
  const diamondSize = 9;
  for (let dy = -diamondSize; dy <= diamondSize; dy++) {
    for (let dx = -diamondSize; dx <= diamondSize; dx++) {
      if (Math.abs(dx) + Math.abs(dy) === diamondSize) {
        px(ctx, mid + dx, mid + dy, pattern);
      }
    }
  }

  // Inner diamond
  const innerSize = 5;
  for (let dy = -innerSize; dy <= innerSize; dy++) {
    for (let dx = -innerSize; dx <= innerSize; dx++) {
      if (Math.abs(dx) + Math.abs(dy) === innerSize) {
        px(ctx, mid + dx, mid + dy, pattern);
      }
    }
  }

  // Cross in center
  for (let i = -3; i <= 3; i++) {
    px(ctx, mid + i, mid, pattern);
    px(ctx, mid, mid + i, pattern);
  }

  // Corner accents (small L shapes)
  const ca = shade(pattern, 0.9);
  const corners = [[3, 3], [3, 28], [28, 3], [28, 28]];
  for (const [cx, cy] of corners) {
    px(ctx, cx, cy, ca);
    px(ctx, cx + 1, cy, ca);
    px(ctx, cx, cy + (cy < 16 ? 1 : -1), ca);
  }

  // Noise wear
  for (let i = 0; i < 10; i++) {
    const sx = randInt(2, S - 3), sy = randInt(2, S - 3);
    px(ctx, sx, sy, shade(base, 0.88));
  }

  save(canvas, 'floor_tile_ornate.png');
}

// ============================================================
//  5. floor_dirt.png
// ============================================================
function genFloorDirt() {
  seed(500);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const colors = ['#3a3020', '#332a1a', '#362e1e'];
  const pebble = '#4a4030';

  const n1 = tileableNoise(S, S, 6);
  const n2 = tileableNoise(S, S, 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = n1[y][x] * 0.6 + n2[y][x] * 0.4;
      const idx = Math.min(2, Math.floor(t * colors.length));
      // Subtle per-pixel jitter
      const jitter = rand() > 0.7 ? shade(colors[idx], 0.9 + rand() * 0.2) : colors[idx];
      px(ctx, x, y, jitter);
    }
  }

  // Pebbles: small 1-2px dots
  for (let i = 0; i < 18; i++) {
    const sx = randInt(0, S - 1), sy = randInt(0, S - 1);
    const c = shade(pebble, 0.9 + rand() * 0.2);
    px(ctx, sx, sy, c);
    if (rand() > 0.5) px(ctx, wrap(sx + 1, S), sy, shade(c, 0.92));
    if (rand() > 0.6) px(ctx, sx, wrap(sy + 1, S), shade(c, 0.88));
  }

  // Tiny dark spots (old stains)
  for (let i = 0; i < 8; i++) {
    px(ctx, randInt(0, S - 1), randInt(0, S - 1), '#2a2010');
  }

  save(canvas, 'floor_dirt.png');
}

// ============================================================
//  6. wall_brick.png
// ============================================================
function genWallBrick() {
  seed(600);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const mortarCol = '#2a2218';
  const brickBase = '#5a4a3a';

  fill(ctx, S, S, mortarCol);

  const brickH = 6;   // brick height
  const brickW = 14;   // brick width (roughly)
  const mortarW = 1;

  const rows = Math.ceil(S / (brickH + mortarW));
  for (let row = 0; row < rows + 1; row++) {
    const yy = row * (brickH + mortarW);
    const offset = (row % 2 === 0) ? 0 : 8; // stagger
    for (let col = -1; col < 3; col++) {
      const xx = col * (brickW + mortarW) + offset;
      // Per-brick color variation
      const variation = 0.9 + rand() * 0.2;
      const bCol = shade(brickBase, variation);
      for (let dy = 0; dy < brickH; dy++) {
        for (let dx = 0; dx < brickW; dx++) {
          const px_ = wrap(xx + dx, S);
          const py_ = wrap(yy + dy, S);
          // Inner shading: top edge lighter, bottom darker
          let sf = 1.0;
          if (dy === 0) sf = 1.08;
          else if (dy === brickH - 1) sf = 0.88;
          else if (dy === 1) sf = 1.04;
          // Per-pixel noise
          const noise = rand() > 0.8 ? 0.95 : 1.0;
          px(ctx, px_, py_, shade(bCol, sf * noise));
        }
      }
    }
  }

  save(canvas, 'wall_brick.png');
}

// ============================================================
//  7. wall_stone_large.png
// ============================================================
function genWallStoneLarge() {
  seed(700);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const mortar = '#3a3a40';
  const stones = ['#555560', '#4a4a52', '#505058'];

  fill(ctx, S, S, mortar);

  // 2-3 large blocks: top half = one tall block + one short, bottom = one wide
  const blocks = [
    { x: 1, y: 1, w: 18, h: 14 },
    { x: 20, y: 1, w: 11, h: 14 },
    { x: 1, y: 16, w: 30, h: 15 },
  ];

  for (const b of blocks) {
    const col = pick(stones);
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const px_ = wrap(b.x + dx, S);
        const py_ = wrap(b.y + dy, S);
        // Edge shading
        let sf = 1.0;
        if (dy === 0 || dx === 0) sf = 1.06;
        if (dy === b.h - 1 || dx === b.w - 1) sf = 0.9;
        // Surface texture noise
        const noise = 0.96 + rand() * 0.08;
        px(ctx, px_, py_, shade(col, sf * noise));
      }
    }
  }

  // Chiseling marks: occasional darker pixels inside blocks
  for (let i = 0; i < 15; i++) {
    const sx = randInt(2, S - 3), sy = randInt(2, S - 3);
    px(ctx, sx, sy, shade('#4a4a52', 0.85));
  }

  save(canvas, 'wall_stone_large.png');
}

// ============================================================
//  8. wall_dungeon.png
// ============================================================
function genWallDungeon() {
  seed(800);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const base = '#3a3a40';
  const moss = '#2a3a22';
  const mortar = '#28282e';

  // Base stone with noise
  const n1 = tileableNoise(S, S, 5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      px(ctx, x, y, mix(base, shade(base, 0.88), n1[y][x]));
    }
  }

  // Mortar grid: rough irregular stones
  // Horizontal mortar
  for (let x = 0; x < S; x++) {
    if (rand() > 0.1) px(ctx, x, 0, mortar);
    if (rand() > 0.1) px(ctx, x, 10, mortar);
    if (rand() > 0.1) px(ctx, x, 11, mortar);
    if (rand() > 0.1) px(ctx, x, 21, mortar);
    if (rand() > 0.1) px(ctx, x, 22, mortar);
  }
  // Vertical mortar
  const vLines = [
    { x: 8, y0: 1, y1: 10 },
    { x: 22, y0: 1, y1: 10 },
    { x: 0, y0: 12, y1: 21 },
    { x: 15, y0: 12, y1: 21 },
    { x: 10, y0: 23, y1: 31 },
    { x: 26, y0: 23, y1: 31 },
  ];
  for (const vl of vLines) {
    for (let y = vl.y0; y <= vl.y1; y++) {
      if (rand() > 0.1) px(ctx, vl.x, y, mortar);
    }
  }

  // Moss spots: small clusters
  const mossNoise = tileableNoise(S, S, 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (mossNoise[y][x] > 0.78) {
        const mc = shade(moss, 0.9 + rand() * 0.3);
        px(ctx, x, y, mc);
      }
    }
  }

  // Extra dark wear
  for (let i = 0; i < 8; i++) {
    px(ctx, randInt(0, S - 1), randInt(0, S - 1), shade(base, 0.75));
  }

  save(canvas, 'wall_dungeon.png');
}

// ============================================================
//  9. wall_metal.png
// ============================================================
function genWallMetal() {
  seed(900);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const stone = '#444450';
  const metal = '#606878';
  const rivet = '#808898';

  // Stone base (left half)
  const n = tileableNoise(S, S, 5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      px(ctx, x, y, mix(stone, shade(stone, 0.9), n[y][x]));
    }
  }

  // Metal plate: a rectangular plate in the center-right area
  const plateX = 8, plateY = 4, plateW = 20, plateH = 24;
  for (let dy = 0; dy < plateH; dy++) {
    for (let dx = 0; dx < plateW; dx++) {
      const px_ = plateX + dx;
      const py_ = plateY + dy;
      // Vertical brushed-metal gradient with noise
      const gradT = dy / plateH;
      const base = mix(shade(metal, 1.1), shade(metal, 0.9), gradT);
      const noise = rand() > 0.7 ? shade(base, 0.96) : base;
      // Edge bevel
      let c = noise;
      if (dy === 0 || dx === 0) c = shade(metal, 1.15);
      if (dy === plateH - 1 || dx === plateW - 1) c = shade(metal, 0.8);
      px(ctx, wrap(px_, S), wrap(py_, S), c);
    }
  }

  // Rivets at corners and midpoints of plate
  const rivetPositions = [
    [plateX + 2, plateY + 2],
    [plateX + plateW - 3, plateY + 2],
    [plateX + 2, plateY + plateH - 3],
    [plateX + plateW - 3, plateY + plateH - 3],
    [plateX + Math.floor(plateW / 2), plateY + 2],
    [plateX + Math.floor(plateW / 2), plateY + plateH - 3],
  ];
  for (const [rx, ry] of rivetPositions) {
    // 3x3 rivet with highlight
    px(ctx, wrap(rx, S), wrap(ry, S), rivet);
    px(ctx, wrap(rx + 1, S), wrap(ry, S), shade(rivet, 0.85));
    px(ctx, wrap(rx, S), wrap(ry + 1, S), shade(rivet, 0.85));
    px(ctx, wrap(rx - 1, S), wrap(ry, S), shade(rivet, 1.1));
    px(ctx, wrap(rx, S), wrap(ry - 1, S), shade(rivet, 1.1));
  }

  // Scratches on metal
  for (let i = 0; i < 5; i++) {
    let sx = randInt(plateX + 1, plateX + plateW - 2);
    let sy = randInt(plateY + 1, plateY + plateH - 2);
    const len = randInt(2, 5);
    for (let j = 0; j < len; j++) {
      px(ctx, wrap(sx, S), wrap(sy, S), shade(metal, 1.2));
      sx += pick([0, 1]); sy += 1;
    }
  }

  save(canvas, 'wall_metal.png');
}

// ============================================================
//  10. torch_wall.png (16x32)
// ============================================================
function genTorchWall() {
  seed(1000);
  const W = 16, H = 32;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const bracket = '#554422';
  const flame1 = '#ff8800';
  const flame2 = '#ffcc44';
  const flameCore = '#ffee88';

  // Transparent background
  ctx.clearRect(0, 0, W, H);

  // Bracket: vertical bar (center, bottom portion)
  const bx = 7;
  for (let y = 14; y < 30; y++) {
    px(ctx, bx, y, bracket);
    px(ctx, bx + 1, y, shade(bracket, 0.85));
  }

  // Horizontal bracket arm
  for (let x = 3; x < 13; x++) {
    px(ctx, x, 20, bracket);
    px(ctx, x, 21, shade(bracket, 0.8));
  }

  // Wall mount plate
  for (let y = 18; y < 24; y++) {
    px(ctx, 3, y, shade(bracket, 0.9));
    px(ctx, 4, y, bracket);
    px(ctx, 12, y, shade(bracket, 0.9));
    px(ctx, 11, y, bracket);
  }

  // Torch head (cup at top of bracket)
  for (let x = 5; x < 11; x++) {
    px(ctx, x, 14, shade(bracket, 0.7));
    px(ctx, x, 13, bracket);
  }
  // Narrower cup top
  for (let x = 6; x < 10; x++) {
    px(ctx, x, 12, shade(bracket, 1.1));
  }

  // Flame shape
  const flamePixels = [
    // Core - bright
    [7, 10, flameCore], [8, 10, flameCore],
    [7, 9, flameCore], [8, 9, flameCore],
    [7, 8, flame2], [8, 8, flame2],
    // Mid flame
    [6, 10, flame2], [9, 10, flame2],
    [6, 9, flame2], [9, 9, flame2],
    [7, 7, flame2], [8, 7, flame2],
    [7, 11, flame1], [8, 11, flame1],
    // Outer flame
    [6, 8, flame1], [9, 8, flame1],
    [7, 6, flame1], [8, 6, shade(flame1, 0.9)],
    [7, 5, shade(flame1, 0.7)],
    [5, 9, shade(flame1, 0.7)], [10, 9, shade(flame1, 0.7)],
    [6, 7, shade(flame1, 0.8)], [9, 7, shade(flame1, 0.8)],
    // Tip
    [7, 4, shade(flame1, 0.5)], [8, 5, shade(flame1, 0.6)],
  ];
  for (const [fx, fy, fc] of flamePixels) {
    px(ctx, fx, fy, fc);
  }

  // Glow: faint orange around flame (semi-transparent)
  const glowSpots = [
    [5, 7], [10, 7], [5, 10], [10, 10],
    [6, 5], [9, 5], [6, 11], [9, 11],
    [7, 3], [8, 3],
  ];
  for (const [gx, gy] of glowSpots) {
    pxA(ctx, gx, gy, 255, 136, 0, 0.2);
  }

  save(canvas, 'torch_wall.png');
}

// ============================================================
//  11. blood_splat.png
// ============================================================
function genBloodSplat() {
  seed(1100);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // Fully transparent base
  ctx.clearRect(0, 0, S, S);

  const darkRed = '#4a0808';
  const darker = '#3a0505';

  // Main splat: irregular blob near center
  const cx = 16, cy = 16;
  for (let i = 0; i < 60; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * 6 + rand() * 4; // clustered near center
    const sx = Math.round(cx + Math.cos(angle) * dist);
    const sy = Math.round(cy + Math.sin(angle) * dist);
    if (sx >= 0 && sx < S && sy >= 0 && sy < S) {
      const col = rand() > 0.5 ? darkRed : darker;
      pxA(ctx, sx, sy, ...parseRGBA(col, 0.7 + rand() * 0.3));
    }
  }

  // Smaller satellite splatters
  for (let s = 0; s < 4; s++) {
    const scx = randInt(4, 28), scy = randInt(4, 28);
    for (let i = 0; i < 8; i++) {
      const sx = scx + randInt(-2, 2);
      const sy = scy + randInt(-2, 2);
      if (sx >= 0 && sx < S && sy >= 0 && sy < S) {
        pxA(ctx, sx, sy, ...parseRGBA(darker, 0.5 + rand() * 0.5));
      }
    }
  }

  // Drip trails
  for (let d = 0; d < 2; d++) {
    let dx = randInt(10, 22), dy = randInt(10, 16);
    const len = randInt(4, 8);
    for (let i = 0; i < len; i++) {
      if (dy < S) {
        pxA(ctx, dx, dy, ...parseRGBA(darkRed, 0.4 + rand() * 0.3));
        dy++; dx += pick([-1, 0, 0, 0, 1]);
        dx = Math.max(0, Math.min(S - 1, dx));
      }
    }
  }

  save(canvas, 'blood_splat.png');
}

function parseRGBA(hex, alpha) {
  const c = parseHex(hex);
  return [c.r, c.g, c.b, alpha];
}

// ============================================================
//  12. crack_overlay.png
// ============================================================
function genCrackOverlay() {
  seed(1200);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, S, S);

  const crackCol = '#1a1a1e';

  // Main crack: starts from edge, wanders across
  function drawCrack(startX, startY, dirX, dirY, length) {
    let cx = startX, cy = startY;
    for (let i = 0; i < length; i++) {
      if (cx >= 0 && cx < S && cy >= 0 && cy < S) {
        pxA(ctx, cx, cy, 26, 26, 30, 0.8);
        // Occasionally wider
        if (rand() > 0.6) {
          const bx = cx + pick([-1, 1, 0]);
          const by = cy + pick([-1, 0, 1]);
          if (bx >= 0 && bx < S && by >= 0 && by < S) {
            pxA(ctx, bx, by, 26, 26, 30, 0.4);
          }
        }
      }
      cx += dirX + pick([-1, 0, 0, 1]);
      cy += dirY + pick([-1, 0, 0, 1]);
      cx = Math.max(0, Math.min(S - 1, cx));
      cy = Math.max(0, Math.min(S - 1, cy));

      // Branch
      if (rand() > 0.85 && i > 2) {
        let bx = cx, by = cy;
        const blen = randInt(2, 5);
        for (let j = 0; j < blen; j++) {
          bx += pick([-1, 0, 1]);
          by += pick([0, 1]);
          if (bx >= 0 && bx < S && by >= 0 && by < S) {
            pxA(ctx, bx, by, 26, 26, 30, 0.6);
          }
        }
      }
    }
  }

  // A couple of cracks from different edges
  drawCrack(0, randInt(8, 24), 1, 0, 28);
  drawCrack(randInt(8, 24), 0, 0, 1, 25);
  drawCrack(randInt(4, 12), randInt(4, 12), 1, 1, 15);

  save(canvas, 'crack_overlay.png');
}

// ============================================================
//  13. puddle.png
// ============================================================
function genPuddle() {
  seed(1300);
  const S = 32;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, S, S);

  // Puddle: elliptical shape centered, mostly transparent blue
  const cx = 16, cy = 16;
  const rx = 10, ry = 7;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const dist = nx * nx + ny * ny;
      if (dist < 1.0) {
        // Fade alpha toward edges
        const alpha = (1.0 - dist) * 0.38;
        // Slight color variation
        const blueShift = rand() * 10;
        pxA(ctx, x, y, 42, 58 + blueShift, 80 + blueShift, alpha);

        // Specular highlight near top
        if (dist < 0.3 && ny < -0.2) {
          pxA(ctx, x, y, 80, 100, 140, 0.15);
        }
      }
    }
  }

  // A couple bright reflection dots
  pxA(ctx, 14, 13, 120, 140, 180, 0.25);
  pxA(ctx, 13, 14, 100, 120, 160, 0.2);

  save(canvas, 'puddle.png');
}

// ============================================================
//  Run all generators
// ============================================================
console.log('Generating dungeon tiles...\n');

genFloorStoneDark();
genFloorStoneWet();
genFloorCobble();
genFloorTileOrnate();
genFloorDirt();
genWallBrick();
genWallStoneLarge();
genWallDungeon();
genWallMetal();
genTorchWall();
genBloodSplat();
genCrackOverlay();
genPuddle();

console.log('\nDone! All tiles saved to assets/tiles/');
