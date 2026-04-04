const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PX = 8;

function p(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function block(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
}

function shade(hex, f) {
  const r = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(1,3),16)*f)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(3,5),16)*f)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(5,7),16)*f)));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function mix(hex1, hex2, t) {
  const r1=parseInt(hex1.slice(1,3),16), g1=parseInt(hex1.slice(3,5),16), b1=parseInt(hex1.slice(5,7),16);
  const r2=parseInt(hex2.slice(1,3),16), g2=parseInt(hex2.slice(3,5),16), b2=parseInt(hex2.slice(5,7),16);
  const r=Math.round(r1+(r2-r1)*t), g=Math.round(g1+(g2-g1)*t), b=Math.round(b1+(b2-b1)*t);
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
}

function vGrad(ctx, x, y, w, h, c1, c2) {
  for (let dy = 0; dy < h; dy++) {
    const t = h > 1 ? dy/(h-1) : 0;
    const c = mix(c1, c2, t);
    for (let dx = 0; dx < w; dx++) p(ctx, x+dx, y+dy, c);
  }
}

// Colors — dark armored warrior
const armor = '#4a3a2a';    // brown leather armor
const ar_hi = '#5a4a3a';
const ar_dk = '#3a2a1a';
const ar_dd = '#2a1a0a';
const chain = '#606878';    // chainmail
const ch_hi = '#7888a0';
const ch_dk = '#4a5a6a';
const helm = '#505868';     // dark helmet
const hlm_hi = '#687888';
const hlm_dk = '#384050';
const skin = '#8a7060';     // dark skin tones
const sk_hi = '#9a8070';
const sk_dk = '#6a5040';
const sword = '#8898a8';    // steel blade
const sw_hi = '#a0b0c0';
const sw_dk = '#607080';
const hilt = '#553311';
const hlt_hi = '#664422';
const gold = '#ccaa33';
const out = '#1a1208';

const GW = 56, GH = 68;

function drawBruteBody(ctx, facingRight) {
  const mx = facingRight ? 0 : 0; // no mirror offset needed, we draw mirrored

  // Helper for mirrored x
  const fx = facingRight ? (x) => x : (x) => (GW/PX - 1 - x);
  // For blocks, mirror means flipping x start
  const fblock = (x, y, w, h, c) => {
    if (facingRight) block(ctx, x, y, w, h, c);
    else block(ctx, GW/PX - x - w, y, w, h, c);
  };
  const fp = (x, y, c) => p(ctx, fx(x), y, c);
  const fvGrad = (x, y, w, h, c1, c2) => {
    if (facingRight) vGrad(ctx, x, y, w, h, c1, c2);
    else vGrad(ctx, GW/PX - x - w, y, w, h, c1, c2);
  };

  // --- Helmet ---
  fvGrad(20, 2, 16, 5, hlm_hi, helm);
  fvGrad(18, 7, 20, 5, helm, hlm_dk);
  // Visor
  fblock(22, 8, 12, 4, '#0a0808');
  // Eyes behind visor
  fp(24, 9, '#dd4400'); fp(25, 9, '#ff6622');
  fp(30, 9, '#dd4400'); fp(31, 9, '#ff6622');
  // Helmet crest
  fblock(24, 2, 8, 1, hlm_hi);
  fp(28, 1, hlm_hi);
  // Nose guard
  for (let y = 5; y <= 10; y++) fp(28, y, hlm_hi);

  // --- Neck ---
  fvGrad(24, 12, 8, 2, sk_dk, skin);

  // --- Shoulder pauldrons ---
  fvGrad(8, 14, 10, 5, ch_hi, chain);
  fvGrad(38, 14, 10, 5, ch_hi, chain);
  // Rivets
  fp(10, 16, gold); fp(14, 16, gold);
  fp(40, 16, gold); fp(44, 16, gold);

  // --- Chainmail chest ---
  fvGrad(16, 14, 24, 6, ch_hi, chain);
  fvGrad(16, 20, 24, 6, chain, ch_dk);
  // Chain links
  for (let y = 16; y <= 24; y += 2)
    for (let x = 17; x <= 37; x += 3) {
      fp(x, y, ch_hi); fp(x+1, y+1, shade(chain, 1.1));
    }

  // --- Leather armor over chain ---
  fvGrad(18, 14, 8, 12, ar_hi, armor);   // left chest plate
  fvGrad(30, 14, 8, 12, ar_hi, armor);   // right chest plate
  // Leather straps
  for (let i = 0; i < 5; i++) {
    fp(22+i, 16+i, ar_dk); fp(34-i, 16+i, ar_dk);
  }

  // --- Belt ---
  fblock(14, 26, 28, 3, ar_dk);
  fblock(16, 26, 24, 1, armor);
  fblock(26, 26, 4, 3, gold);
  fp(27, 27, shade(gold, 1.3));

  // --- Tassets (leg armor plates) ---
  fvGrad(16, 29, 10, 4, armor, ar_dk);
  fvGrad(30, 29, 10, 4, armor, ar_dk);

  // --- Legs (armored) ---
  for (let y = 33; y <= 52; y++) {
    const t = (y-33)/19;
    const c = mix(ar_dk, ar_dd, t);
    const ch = shade(c, 1.2), cd = shade(c, 0.8);
    // Left leg
    fblock(18, y, 1, 1, out);
    for (let x = 19; x <= 25; x++) fp(x, y, x<=20?cd : x<=22?c : x<=24?ch : cd);
    fblock(26, y, 1, 1, out);
    // Right leg
    fblock(30, y, 1, 1, out);
    for (let x = 31; x <= 37; x++) fp(x, y, x<=32?cd : x<=34?c : x<=36?ch : cd);
    fblock(38, y, 1, 1, out);
  }

  // Knee guards
  fvGrad(19, 42, 6, 3, ch_hi, chain);
  fvGrad(31, 42, 6, 3, ch_hi, chain);

  // --- Boots ---
  fvGrad(16, 53, 12, 5, ar_dk, shade(ar_dd, 0.7));
  fvGrad(28, 53, 12, 5, ar_dk, shade(ar_dd, 0.7));
  fblock(17, 53, 10, 2, armor);
  fblock(29, 53, 10, 2, armor);
  // Boot buckle
  fp(20, 55, gold); fp(32, 55, gold);

  // --- Arms ---
  for (let y = 14; y <= 30; y++) {
    const t = (y-14)/16;
    const c = mix(ch_hi, ch_dk, t);
    // Left arm
    fp(10, y, shade(c, 0.8)); fp(11, y, c); fp(12, y, shade(c, 1.1)); fp(13, y, c);
    // Right arm
    fp(42, y, c); fp(43, y, shade(c, 1.1)); fp(44, y, c); fp(45, y, shade(c, 0.8));
  }
  // Gauntlets
  fvGrad(9, 30, 5, 4, ar_dk, ar_dd);
  fvGrad(42, 30, 5, 4, ar_dk, ar_dd);

  return { fp, fblock, fvGrad };
}

// --- Frame 0: Idle (sword at side) ---
function generateFrame0(outPath, facingRight) {
  const canvas = createCanvas(GW * PX, GH * PX);
  const ctx = canvas.getContext('2d');
  const { fp, fblock, fvGrad } = drawBruteBody(ctx, facingRight);

  // Sword at side (right hand for right-facing)
  const swordX = facingRight ? 46 : 4;
  for (let y = 10; y <= 40; y++) {
    const t = (y-10)/30;
    p(ctx, swordX, y, mix(sw_hi, sw_dk, t));
    p(ctx, swordX+1, y, mix(sword, sw_dk, t));
  }
  // Hilt
  p(ctx, swordX, 35, hilt); p(ctx, swordX+1, 35, hlt_hi);
  p(ctx, swordX, 36, hilt); p(ctx, swordX+1, 36, hilt);
  // Crossguard
  for (let dx = -1; dx <= 2; dx++) p(ctx, swordX+dx, 34, gold);
  // Pommel
  p(ctx, swordX, 37, gold); p(ctx, swordX+1, 37, shade(gold, 0.8));

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Generated:', path.basename(outPath));
}

// --- Frame 1: Attack wind-up (sword raised) ---
function generateFrame1(outPath, facingRight) {
  const canvas = createCanvas(GW * PX, GH * PX);
  const ctx = canvas.getContext('2d');
  drawBruteBody(ctx, facingRight);

  // Sword raised above head (diagonal)
  const baseX = facingRight ? 36 : 12;
  const dir = facingRight ? 1 : -1;
  for (let i = 0; i < 14; i++) {
    const sx = baseX + i * dir;
    const sy = 4 - Math.floor(i * 0.5);
    const t = i / 13;
    p(ctx, sx, sy, mix(sw_hi, sword, t));
    p(ctx, sx, sy+1, mix(sword, sw_dk, t));
  }
  // Hilt at shoulder
  p(ctx, baseX, 5, hilt); p(ctx, baseX, 6, hlt_hi);
  for (let dx = -1; dx <= 1; dx++) p(ctx, baseX + dx, 4, gold);

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Generated:', path.basename(outPath));
}

// --- Frame 2: Attack swing (sword extended forward) ---
function generateFrame2(outPath, facingRight) {
  const canvas = createCanvas(GW * PX, GH * PX);
  const ctx = canvas.getContext('2d');
  drawBruteBody(ctx, facingRight);

  // Sword extended horizontally
  const startX = facingRight ? 46 : 2;
  const dir = facingRight ? 1 : -1;
  for (let i = 0; i < 10; i++) {
    const sx = startX + i * dir;
    const t = i / 9;
    p(ctx, sx, 20, mix(sw_hi, sw_dk, t));
    p(ctx, sx, 21, mix(sword, sw_dk, t));
  }
  // Hilt
  p(ctx, startX - dir, 20, hilt); p(ctx, startX - dir, 21, hlt_hi);
  p(ctx, startX - dir*2, 20, gold); p(ctx, startX - dir*2, 21, gold);
  // Tip shine
  p(ctx, startX + 9*dir, 20, '#c0d0e0');

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Generated:', path.basename(outPath));
}

// Generate all 6 frames
const bruteDir = path.join(__dirname, '..', 'assets', 'enemy', 'brute');

generateFrame0(path.join(bruteDir, 'right0.png'), true);
generateFrame1(path.join(bruteDir, 'right1.png'), true);
generateFrame2(path.join(bruteDir, 'right2.png'), true);
// Generate left frames by flipping right frames horizontally
function flipHorizontal(srcPath, destPath) {
  const srcCanvas = createCanvas(GW * PX, GH * PX);
  const srcCtx = srcCanvas.getContext('2d');
  // Read source
  const { createCanvas: cc, loadImage } = require('canvas');
  const imgData = fs.readFileSync(srcPath);
  const img = new (require('canvas').Image)();
  img.src = imgData;
  srcCtx.drawImage(img, 0, 0);

  const destCanvas = createCanvas(GW * PX, GH * PX);
  const destCtx = destCanvas.getContext('2d');
  destCtx.translate(GW * PX, 0);
  destCtx.scale(-1, 1);
  destCtx.drawImage(srcCanvas, 0, 0);

  fs.writeFileSync(destPath, destCanvas.toBuffer('image/png'));
  console.log('Generated (flipped):', path.basename(destPath));
}

flipHorizontal(path.join(bruteDir, 'right0.png'), path.join(bruteDir, 'left0.png'));
flipHorizontal(path.join(bruteDir, 'right1.png'), path.join(bruteDir, 'left1.png'));
flipHorizontal(path.join(bruteDir, 'right2.png'), path.join(bruteDir, 'left2.png'));

console.log('\nAll 6 brute frames generated!');
