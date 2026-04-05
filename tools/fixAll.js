const { createCanvas, Image } = require('canvas');
const fs = require('fs');

// === 1. Fix Mage sprites — re-extract cleaner from spritesheet ===
console.log('=== Fixing Mage Sprites ===');

const mageSheet = new Image();
mageSheet.src = fs.readFileSync('reference/7.png');

function removeBg(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const d = ctx.getImageData(0, 0, w, h);
  const data = d.data;

  // Pass 1: Remove gray/white background
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const avg = (r + g + b) / 3;
    const maxDiff = Math.max(Math.abs(r-avg), Math.abs(g-avg), Math.abs(b-avg));
    if (maxDiff < 30 && avg > 80) data[i+3] = 0;
  }

  // Pass 2-4: Erode white/light edge pixels (3 passes for thorough cleanup)
  for (let pass = 0; pass < 3; pass++) {
    const copy = new Uint8ClampedArray(data);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (copy[idx+3] === 0) continue;
        const r = copy[idx], g = copy[idx+1], b = copy[idx+2];
        if (r > 150 && g > 150 && b > 150) {
          let tn = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x+dx, ny = y+dy;
              if (nx < 0 || nx >= w || ny < 0 || ny >= h) { tn++; continue; }
              if (copy[(ny*w+nx)*4+3] === 0) tn++;
            }
          }
          if (tn >= 2) data[idx+3] = 0;
        }
      }
    }
  }
  ctx.putImageData(d, 0, 0);
}

function trim(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (data[(y * canvas.width + x) * 4 + 3] > 10) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  const p = 2;
  x0 = Math.max(0, x0-p); y0 = Math.max(0, y0-p);
  x1 = Math.min(canvas.width-1, x1+p); y1 = Math.min(canvas.height-1, y1+p);
  const t = createCanvas(x1-x0+1, y1-y0+1);
  t.getContext('2d').drawImage(canvas, x0, y0, x1-x0+1, y1-y0+1, 0, 0, x1-x0+1, y1-y0+1);
  return t;
}

function flip(canvas) {
  const f = createCanvas(canvas.width, canvas.height);
  const ctx = f.getContext('2d');
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return f;
}

// Better extraction positions — tighter crop, avoid neighboring sprites
// Pose 0 (idle): the one at x~530, but crop ABOVE the lower flame remnant
const extractPose = (x, y, w, h, maxH) => {
  const c = createCanvas(w, h);
  c.getContext('2d').drawImage(mageSheet, x, y, w, h, 0, 0, w, h);
  removeBg(c);
  let trimmed = trim(c);
  // If trimmed is taller than maxH, crop from bottom (remove lower artifacts)
  if (maxH && trimmed.height > maxH) {
    const cropped = createCanvas(trimmed.width, maxH);
    cropped.getContext('2d').drawImage(trimmed, 0, 0);
    trimmed = cropped;
  }
  return trimmed;
};

// Extract 3 clean mage poses
const pose0 = extractPose(520, 15, 135, 260, 240);  // idle - tighter crop, shorter
const pose1 = extractPose(520, 345, 135, 220, 200); // windup
const pose2 = extractPose(675, 15, 150, 260, 240);  // casting

console.log('pose0:', pose0.width + 'x' + pose0.height);
console.log('pose1:', pose1.width + 'x' + pose1.height);
console.log('pose2:', pose2.width + 'x' + pose2.height);

// Normalize all to same canvas size (bottom-aligned, centered)
const maxW = Math.max(pose0.width, pose1.width, pose2.width);
const maxH = Math.max(pose0.height, pose1.height, pose2.height);
console.log('Normalizing to:', maxW + 'x' + maxH);

function normalizeToCanvas(sprite, targetW, targetH) {
  const c = createCanvas(targetW, targetH);
  const ctx = c.getContext('2d');
  const dx = Math.floor((targetW - sprite.width) / 2);
  const dy = targetH - sprite.height;
  ctx.drawImage(sprite, dx, dy);
  return c;
}

const poses = [pose0, pose1, pose2];
const names = ['right0', 'right1', 'right2'];

poses.forEach((p, i) => {
  const norm = normalizeToCanvas(p, maxW, maxH);
  fs.writeFileSync('assets/enemy/mage/' + names[i] + '.png', norm.toBuffer('image/png'));
  const flipped = flip(norm);
  fs.writeFileSync('assets/enemy/mage/left' + i + '.png', flipped.toBuffer('image/png'));
  console.log(names[i] + ': done');
});
fs.writeFileSync('assets/enemy/mage/mage.png', normalizeToCanvas(pose0, maxW, maxH).toBuffer('image/png'));

// === 2. Fix stair texture ===
console.log('\n=== Improving Stair Texture ===');

// Check current stair texture generation in graphics.js
// We'll create a better one programmatically
const stairW = 48, stairH = 48;
const stairCanvas = createCanvas(stairW, stairH);
const sctx = stairCanvas.getContext('2d');

// Dark stone base
sctx.fillStyle = '#3a3a42';
sctx.fillRect(0, 0, stairW, stairH);

// Draw descending stairs (4 steps)
const stepColors = ['#555560', '#4e4e58', '#474750', '#404048'];
const stepHighlight = ['#666670', '#5e5e68', '#565660', '#4e4e58'];
const stepShadow = ['#3a3a42', '#333338', '#2d2d32', '#28282e'];

for (let i = 0; i < 4; i++) {
  const sy = 8 + i * 10;
  const sx = 4 + i * 3;
  const sw = stairW - 8 - i * 6;

  // Step top surface (lighter)
  sctx.fillStyle = stepHighlight[i];
  sctx.fillRect(sx, sy, sw, 3);

  // Step front face
  sctx.fillStyle = stepColors[i];
  sctx.fillRect(sx, sy + 3, sw, 5);

  // Step shadow edge
  sctx.fillStyle = stepShadow[i];
  sctx.fillRect(sx, sy + 7, sw, 2);

  // Left edge highlight
  sctx.fillStyle = stepHighlight[i];
  sctx.fillRect(sx, sy, 2, 8);

  // Right edge shadow
  sctx.fillStyle = stepShadow[i];
  sctx.fillRect(sx + sw - 2, sy, 2, 8);

  // Noise on step face
  for (let n = 0; n < 5; n++) {
    const nx = sx + 3 + Math.floor(Math.random() * (sw - 6));
    const ny = sy + 3 + Math.floor(Math.random() * 4);
    sctx.fillStyle = Math.random() > 0.5 ? stepHighlight[i] : stepShadow[i];
    sctx.fillRect(nx, ny, 1, 1);
  }
}

// Arrow indicator at bottom
sctx.fillStyle = '#ccaa33';
sctx.beginPath();
sctx.moveTo(24, 42);
sctx.lineTo(18, 36);
sctx.lineTo(30, 36);
sctx.closePath();
sctx.fill();

// Arrow outline
sctx.strokeStyle = '#aa8822';
sctx.lineWidth = 1;
sctx.beginPath();
sctx.moveTo(24, 42);
sctx.lineTo(18, 36);
sctx.lineTo(30, 36);
sctx.closePath();
sctx.stroke();

fs.writeFileSync('assets/tiles/stairDown.png', stairCanvas.toBuffer('image/png'));
console.log('Stair texture generated: 48x48');

// === 3. Check player display size for level clearance ===
console.log('\n=== Player Size Analysis ===');
console.log('PLAYER_COLLIDER_WIDTH: 34px');
console.log('PLAYER_COLLIDER_HEIGHT: 56px');
console.log('PLAYER_BASE_DISPLAY_WIDTH: 60px (before VISUAL_SCALE)');
console.log('PLAYER_BASE_DISPLAY_HEIGHT: 150px (before VISUAL_SCALE)');
console.log('PLAYER_VISUAL_SCALE: 0.48');
console.log('Actual display: 60*0.48=29px wide, 150*0.48=72px tall');
console.log('Physics body: 34x56px');
console.log('');
console.log('For 3-tile-wide passages (96px):');
console.log('  34px body fits easily (62px clearance)');
console.log('  56px body height fits in 2 tiles (64px) tightly');
console.log('');
console.log('Problem: objects like pillars/crates are 32x32 sprites');
console.log('with physics bodies. If placed 1 tile from wall,');
console.log('gap = 32px (1 tile) which is LESS than 34px body width!');
console.log('Need at least 2 tiles (64px) gap between object and wall.');

console.log('\nAll fixes done!');
