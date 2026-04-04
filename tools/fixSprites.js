const { createCanvas, Image } = require('canvas');
const fs = require('fs');

function removeBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Remove white/gray background
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const avg = (r + g + b) / 3;
    const maxDiff = Math.max(Math.abs(r-avg), Math.abs(g-avg), Math.abs(b-avg));
    if (maxDiff < 25 && avg > 90) data[i+3] = 0;
  }

  // Remove white edge pixels near transparency
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (copy[idx+3] === 0) continue;
      const r = copy[idx], g = copy[idx+1], b = copy[idx+2];
      if (r > 170 && g > 170 && b > 170) {
        let tn = 0, tot = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) { tn++; tot++; continue; }
            tot++;
            if (copy[(ny*w+nx)*4+3] === 0) tn++;
          }
        if (tn >= 3) data[idx+3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function cleanEdges(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (copy[idx+3] === 0) continue;
      const r = copy[idx], g = copy[idx+1], b = copy[idx+2];
      if (r > 200 && g > 200 && b > 200) {
        let tn = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x+dx, ny = y+dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) { tn++; continue; }
            if (copy[(ny*w+nx)*4+3] === 0) tn++;
          }
        if (tn >= 2) data[idx+3] = 0;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (data[(y * canvas.width + x) * 4 + 3] > 10) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  const pad = 2;
  minX = Math.max(0, minX-pad); minY = Math.max(0, minY-pad);
  maxX = Math.min(canvas.width-1, maxX+pad); maxY = Math.min(canvas.height-1, maxY+pad);
  const cw = maxX-minX+1, ch = maxY-minY+1;
  const t = createCanvas(cw, ch);
  t.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return t;
}

function flipH(canvas) {
  const f = createCanvas(canvas.width, canvas.height);
  const ctx = f.getContext('2d');
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return f;
}

// === Fix Brute white edges ===
console.log('--- Brute edge cleanup ---');
for (const frame of ['right0','right1','right2','left0','left1','left2']) {
  const p = 'assets/enemy/brute/' + frame + '.png';
  const img = new Image();
  img.src = fs.readFileSync(p);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  cleanEdges(c);
  const trimmed = trimCanvas(c);
  fs.writeFileSync(p, trimmed.toBuffer('image/png'));
  console.log(frame + ': ' + trimmed.width + 'x' + trimmed.height);
}

// === Extract 3 Mage poses ===
console.log('\n--- Mage extraction ---');
const mageSheet = new Image();
mageSheet.src = fs.readFileSync('reference/7.png');

// Positions from visual analysis of topleft quadrant
const poses = [
  { x: 75, y: 20, w: 155, h: 315 },   // pose 1: staff right
  { x: 270, y: 20, w: 135, h: 315 },   // pose 2: idle front
  { x: 415, y: 20, w: 175, h: 315 },   // pose 3: staff right, different
];

poses.forEach((pos, i) => {
  const c = createCanvas(pos.w, pos.h);
  c.getContext('2d').drawImage(mageSheet, pos.x, pos.y, pos.w, pos.h, 0, 0, pos.w, pos.h);
  removeBackground(c);
  const trimmed = trimCanvas(c);

  const rname = ['right0', 'right1', 'right2'][i];
  fs.writeFileSync('assets/enemy/mage/' + rname + '.png', trimmed.toBuffer('image/png'));

  const flipped = flipH(trimmed);
  const lname = ['left0', 'left1', 'left2'][i];
  fs.writeFileSync('assets/enemy/mage/' + lname + '.png', flipped.toBuffer('image/png'));

  console.log(rname + ': ' + trimmed.width + 'x' + trimmed.height);
});

// Main sprite = idle
const main = new Image();
main.src = fs.readFileSync('assets/enemy/mage/right0.png');
const mc = createCanvas(main.width, main.height);
mc.getContext('2d').drawImage(main, 0, 0);
fs.writeFileSync('assets/enemy/mage/mage.png', mc.toBuffer('image/png'));

// === Fix Imp edges ===
console.log('\n--- Imp edge cleanup ---');
for (const frame of ['right0','right1','right2','left0','left1','left2','imp']) {
  const p = 'assets/enemy/imp/' + frame + '.png';
  if (!fs.existsSync(p)) continue;
  const img = new Image();
  img.src = fs.readFileSync(p);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  cleanEdges(c);
  fs.writeFileSync(p, c.toBuffer('image/png'));
  console.log(frame + ' cleaned');
}

console.log('\nAll sprites fixed!');
