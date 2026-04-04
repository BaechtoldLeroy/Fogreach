const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PX = 8; // smaller art-pixel for higher detail

function p(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, PX, PX);
}

function block(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
}

function save(canvas, outPath) {
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Generated:', path.basename(outPath));
}

// Color math
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

// Dithered fill: alternates between two colors in checkerboard
function dither(ctx, x, y, w, h, c1, c2) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      p(ctx, x+dx, y+dy, (dx+dy)%2===0 ? c1 : c2);
}

// Gradient block: vertical gradient from c1 to c2
function vGrad(ctx, x, y, w, h, c1, c2) {
  for (let dy = 0; dy < h; dy++) {
    const t = h > 1 ? dy/(h-1) : 0;
    const c = mix(c1, c2, t);
    for (let dx = 0; dx < w; dx++) p(ctx, x+dx, y+dy, c);
  }
}

// Outlined body part with shading (left highlight, right shadow, gradient top-bottom)
function shadedBlock(ctx, x, y, w, h, base, outline) {
  const hi = shade(base, 1.25);
  const dk = shade(base, 0.7);
  const dd = shade(base, 0.5);
  // Fill with vertical gradient
  vGrad(ctx, x+1, y+1, w-2, h-2, hi, dk);
  // Left edge highlight
  for (let dy = 1; dy < h-1; dy++) p(ctx, x, y+dy, mix(hi, base, dy/(h-1)));
  // Right edge shadow
  for (let dy = 1; dy < h-1; dy++) p(ctx, x+w-1, y+dy, mix(dk, dd, dy/(h-1)));
  // Top/bottom outline
  for (let dx = 0; dx < w; dx++) { p(ctx, x+dx, y, outline); p(ctx, x+dx, y+h-1, outline); }
  // Side outline
  p(ctx, x, y, outline); p(ctx, x+w-1, y, outline);
  p(ctx, x, y+h-1, outline); p(ctx, x+w-1, y+h-1, outline);
}

// ============================================================
//  IMP — 56x68 grid (448x544 canvas)
// ============================================================
function generateImp(outPath) {
  const GW = 56, GH = 68;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const skin='#b83030', sk1='#cc4040', sk2='#d05050', sk3='#a02828',
        sk4='#8a1e1e', sk5='#701818', out='#1a0808';
  const arm='#6a2020', arm1='#7a2828', arm2='#883838', arm3='#5a1818', arm4='#4a1010';
  const horn='#c8a848', hrn2='#b09030', hrn3='#907828', hrn4='#786020';
  const eye='#ffe020', eyedk='#ff8800', pupil='#ff2200';
  const fang='#e8e0d0', fang2='#ccc4b0';
  const belt='#5a3a18', belt2='#6a4a28', buckle='#c0a040';

  // --- Horns (curved, multi-shade) ---
  p(ctx,14,1,hrn4); p(ctx,15,0,hrn3); p(ctx,16,0,horn); p(ctx,17,0,hrn2);
  p(ctx,15,1,horn); p(ctx,16,1,shade(horn,1.1)); p(ctx,17,1,horn);
  p(ctx,15,2,hrn2); p(ctx,16,2,hrn3); p(ctx,17,2,hrn4);
  p(ctx,16,3,hrn4); p(ctx,16,4,hrn4);
  // Right horn (mirrored)
  p(ctx,41,1,hrn4); p(ctx,40,0,hrn3); p(ctx,39,0,horn); p(ctx,38,0,hrn2);
  p(ctx,40,1,horn); p(ctx,39,1,shade(horn,1.1)); p(ctx,38,1,horn);
  p(ctx,40,2,hrn2); p(ctx,39,2,hrn3); p(ctx,38,2,hrn4);
  p(ctx,39,3,hrn4); p(ctx,39,4,hrn4);

  // --- Head (shaded oval) ---
  vGrad(ctx, 20, 5, 16, 4, sk2, sk1); // top forehead
  vGrad(ctx, 18, 9, 20, 4, sk1, skin); // upper face
  vGrad(ctx, 18, 13, 20, 4, skin, sk3); // mid face
  vGrad(ctx, 19, 17, 18, 4, sk3, sk4); // lower face/jaw
  vGrad(ctx, 20, 21, 16, 2, sk4, sk5); // chin
  // Head outline
  for (let x = 20; x < 36; x++) p(ctx, x, 4, out);
  for (let x = 18; x < 38; x++) p(ctx, x, 22, out);
  for (let y = 5; y <= 8; y++) { p(ctx, 19, y, out); p(ctx, 36, y, out); }
  for (let y = 9; y <= 21; y++) { p(ctx, 17, y, out); p(ctx, 38, y, out); }

  // Brow ridge (dark)
  for (let x = 19; x <= 36; x++) p(ctx, x, 10, sk5);
  p(ctx, 18, 10, out); p(ctx, 37, 10, out);

  // --- Eyes (glowing, layered) ---
  block(ctx, 21, 11, 5, 4, '#110800');
  block(ctx, 30, 11, 5, 4, '#110800');
  // Eye glow layers
  block(ctx, 22, 12, 3, 2, '#cc6600');
  block(ctx, 31, 12, 3, 2, '#cc6600');
  p(ctx, 23, 12, eye); p(ctx, 32, 12, eye);
  p(ctx, 23, 13, pupil); p(ctx, 32, 13, pupil);
  // Eye shine
  p(ctx, 24, 12, '#ffffaa'); p(ctx, 33, 12, '#ffffaa');

  // --- Nose ---
  p(ctx, 27, 15, sk5); p(ctx, 28, 15, sk5);
  p(ctx, 27, 16, sk4); p(ctx, 28, 16, sk4);

  // --- Mouth + fangs ---
  block(ctx, 22, 18, 12, 3, '#2a0808');
  // Upper fangs
  p(ctx,22,18,fang); p(ctx,23,18,fang2); p(ctx,24,19,fang);
  p(ctx,33,18,fang); p(ctx,32,18,fang2); p(ctx,31,19,fang);
  // Lower fangs
  p(ctx,23,20,fang); p(ctx,32,20,fang);
  // Tongue
  p(ctx,27,19,'#cc2244'); p(ctx,28,19,'#cc2244');

  // --- Pointed ears ---
  vGrad(ctx, 14, 9, 3, 8, sk1, sk4);
  p(ctx, 13, 10, sk3); p(ctx, 12, 11, sk5);
  vGrad(ctx, 39, 9, 3, 8, sk1, sk4);
  p(ctx, 42, 10, sk3); p(ctx, 43, 11, sk5);

  // --- Neck ---
  vGrad(ctx, 23, 23, 10, 3, sk4, sk5);

  // --- Torso (leather armor with shading) ---
  vGrad(ctx, 17, 26, 22, 5, arm2, arm1); // upper chest
  vGrad(ctx, 15, 31, 26, 5, arm1, arm); // mid chest
  vGrad(ctx, 15, 36, 26, 5, arm, arm3); // lower chest
  vGrad(ctx, 16, 41, 24, 3, arm3, arm4); // waist
  // Outline
  for (let y = 26; y <= 43; y++) { p(ctx, 14, y, out); p(ctx, 41, y, out); }

  // Chest cross-straps with shading
  for (let i = 0; i < 8; i++) {
    p(ctx, 19+i, 28+i, belt); p(ctx, 20+i, 28+i, belt2);
    p(ctx, 37-i, 28+i, belt); p(ctx, 36-i, 28+i, belt2);
  }
  // Chest scar
  for (let i = 0; i < 4; i++) { p(ctx, 25+i, 32, sk5); p(ctx, 26+i, 33, mix(sk5,arm,0.5)); }

  // Belt with gradient
  vGrad(ctx, 15, 42, 26, 3, belt2, belt);
  block(ctx, 26, 42, 4, 3, buckle);
  p(ctx, 27, 43, shade(buckle, 1.3)); p(ctx, 28, 43, shade(buckle, 0.8));

  // --- Arms with muscle shading ---
  for (let y = 26; y <= 44; y++) {
    const t = (y-26)/18;
    const c = mix(sk1, sk4, t);
    const ch = shade(c, 1.15);
    const cd = shade(c, 0.8);
    // Left arm
    p(ctx, 10, y, out); p(ctx, 11, y, cd); p(ctx, 12, y, c);
    p(ctx, 13, y, ch); p(ctx, 14, y, c);
    // Right arm
    p(ctx, 41, y, c); p(ctx, 42, y, ch); p(ctx, 43, y, c);
    p(ctx, 44, y, cd); p(ctx, 45, y, out);
  }
  // Claws
  const clw = [fang, fang2, shade(fang,0.9)];
  p(ctx,9,45,clw[0]); p(ctx,10,46,clw[1]); p(ctx,11,46,clw[2]);
  p(ctx,12,45,clw[0]); p(ctx,13,46,clw[1]);
  p(ctx,42,45,clw[0]); p(ctx,43,46,clw[1]); p(ctx,44,46,clw[2]);
  p(ctx,45,45,clw[0]); p(ctx,44,45,clw[1]);

  // --- Legs with shading ---
  for (let y = 45; y <= 60; y++) {
    const t = (y-45)/15;
    const c = mix(arm3, sk5, t);
    const ch = shade(c, 1.2);
    const cd = shade(c, 0.75);
    // Left leg
    p(ctx,19,y,out); p(ctx,20,y,cd); p(ctx,21,y,c); p(ctx,22,y,ch);
    p(ctx,23,y,c); p(ctx,24,y,c); p(ctx,25,y,cd); p(ctx,26,y,out);
    // Right leg
    p(ctx,30,y,out); p(ctx,31,y,cd); p(ctx,32,y,c); p(ctx,33,y,ch);
    p(ctx,34,y,c); p(ctx,35,y,c); p(ctx,36,y,cd); p(ctx,37,y,out);
  }

  // --- Feet + toe claws ---
  vGrad(ctx, 17, 61, 12, 4, sk5, shade(sk5,0.7));
  vGrad(ctx, 28, 61, 12, 4, sk5, shade(sk5,0.7));
  // Toe claws
  p(ctx,17,65,fang); p(ctx,19,65,fang); p(ctx,22,65,fang);
  p(ctx,28,65,fang); p(ctx,31,65,fang); p(ctx,33,65,fang);

  // --- Tail ---
  for (let i = 0; i < 7; i++) {
    const tc = mix(sk3, sk1, i/6);
    p(ctx, 42+i, 38-Math.floor(i*0.4), tc);
    p(ctx, 42+i, 39-Math.floor(i*0.4), shade(tc, 0.8));
  }
  // Arrow tip
  p(ctx,49,36,sk1); p(ctx,50,35,sk2); p(ctx,50,37,sk2);

  save(canvas, outPath);
}

// ============================================================
//  ARCHER — 56x68 grid
// ============================================================
function generateArcher(outPath) {
  const GW = 56, GH = 68;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const hood='#2a5a2a', hd1='#3a7a3a', hd2='#4a8a4a', hd3='#1a3a1a', hd4='#0d2a0d';
  const skin='#c4a882', sk1='#d4b892', sk2='#b09070', sk3='#9a7a5a';
  const tunic='#1e4a1e', tu1='#2a5a2a', tu2='#3a6a3a', tu3='#0d330d';
  const leather='#553311', lth1='#6a4422', lth2='#775533', lth3='#442200';
  const bow='#885522', bow2='#774411', bow3='#996633';
  const metal='#aaaaaa', met2='#cccccc', string='#ccccaa';
  const out='#0a1a0a';

  // --- Hood (rounded, shaded) ---
  vGrad(ctx, 22, 2, 12, 3, hd2, hd1);
  vGrad(ctx, 20, 5, 16, 4, hd1, hood);
  vGrad(ctx, 19, 9, 18, 3, hood, hd3);
  for (let x = 22; x < 34; x++) p(ctx, x, 1, out);
  for (let y = 2; y <= 4; y++) { p(ctx, 21, y, out); p(ctx, 34, y, out); }
  for (let y = 5; y <= 11; y++) { p(ctx, 18, y, out); p(ctx, 36, y, out); }

  // --- Face (shaded) ---
  vGrad(ctx, 21, 9, 14, 3, sk1, skin);
  vGrad(ctx, 21, 12, 14, 4, skin, sk2);
  vGrad(ctx, 22, 16, 12, 3, sk2, sk3);
  for (let y = 9; y <= 18; y++) { p(ctx, 20, y, out); p(ctx, 35, y, out); }

  // Eyes (sharp, red)
  block(ctx, 23, 12, 4, 3, '#1a0800');
  block(ctx, 30, 12, 4, 3, '#1a0800');
  p(ctx,24,13,'#ff3300'); p(ctx,25,13,'#ff6600');
  p(ctx,31,13,'#ff3300'); p(ctx,32,13,'#ff6600');
  p(ctx,25,12,'#ff886644'); p(ctx,32,12,'#ff886644'); // eye shine

  // Nose + mouth
  p(ctx,27,15,sk3); p(ctx,28,15,sk3);
  for (let x = 25; x <= 30; x++) p(ctx, x, 17, sk3);

  // Neck
  vGrad(ctx, 24, 19, 8, 2, sk2, sk3);

  // --- Torso (layered tunic) ---
  vGrad(ctx, 17, 21, 22, 6, tu2, tu1);
  vGrad(ctx, 15, 27, 26, 6, tu1, tunic);
  vGrad(ctx, 15, 33, 26, 5, tunic, tu3);
  for (let y = 21; y <= 37; y++) { p(ctx, 14, y, out); p(ctx, 41, y, out); }
  // Highlight strip on chest
  for (let y = 22; y <= 28; y++) p(ctx, 22, y, tu2);

  // Leather straps
  for (let i = 0; i < 7; i++) {
    p(ctx, 20+i, 23+i, leather); p(ctx, 21+i, 23+i, lth1);
    p(ctx, 36-i, 23+i, leather); p(ctx, 35-i, 23+i, lth1);
  }

  // Belt
  vGrad(ctx, 15, 37, 26, 3, lth1, leather);
  block(ctx, 26, 37, 4, 3, lth2);
  p(ctx, 27, 38, shade(lth2, 1.3));

  // --- Quiver ---
  for (let y = 10; y <= 34; y++) {
    p(ctx, 41, y, leather); p(ctx, 42, y, lth1); p(ctx, 43, y, lth2);
  }
  // Arrow tips
  p(ctx,41,9,metal); p(ctx,42,8,met2); p(ctx,43,9,metal);
  p(ctx,42,10,met2);

  // --- Bow + arrow (left side) ---
  for (let y = 8; y <= 38; y++) {
    const t = Math.abs(y - 23) / 15;
    p(ctx, 6 - Math.round(t*2), y, bow);
    p(ctx, 7 - Math.round(t*2), y, y%3===0 ? bow3 : bow2);
  }
  // Bowstring
  for (let y = 10; y <= 36; y++) p(ctx, 9, y, string);
  // Arrow
  for (let x = 2; x <= 10; x++) p(ctx, x, 28, x <= 3 ? metal : bow2);
  p(ctx, 1, 28, met2); // arrowhead tip
  p(ctx, 1, 27, metal); p(ctx, 1, 29, metal);

  // --- Arms ---
  for (let y = 22; y <= 38; y++) {
    const t = (y-22)/16;
    // Left arm
    p(ctx,10,y,mix(tu1,skin,t)); p(ctx,11,y,mix(tu2,skin,t));
    p(ctx,12,y,mix(tu1,sk2,t));
    // Right arm
    p(ctx,42,y,mix(tu1,skin,t)); p(ctx,43,y,mix(tu2,skin,t));
    p(ctx,44,y,mix(tu1,sk2,t));
  }
  // Hands
  block(ctx, 10, 39, 3, 3, skin); block(ctx, 42, 39, 3, 3, skin);

  // --- Legs ---
  for (let y = 40; y <= 57; y++) {
    const t = (y-40)/17;
    const c = mix(tu3, hd4, t);
    const ch = shade(c, 1.2), cd = shade(c, 0.8);
    // Left
    p(ctx,19,y,out); p(ctx,20,y,cd); p(ctx,21,y,c); p(ctx,22,y,ch);
    p(ctx,23,y,c); p(ctx,24,y,c); p(ctx,25,y,cd); p(ctx,26,y,out);
    // Right
    p(ctx,30,y,out); p(ctx,31,y,cd); p(ctx,32,y,c); p(ctx,33,y,ch);
    p(ctx,34,y,c); p(ctx,35,y,c); p(ctx,36,y,cd); p(ctx,37,y,out);
  }

  // Boots (detailed)
  for (let y = 58; y <= 64; y++) {
    const t = (y-58)/6;
    const c = mix(lth1, lth3, t);
    block(ctx, 17, y, 12, 1, c);
    block(ctx, 28, y, 12, 1, c);
  }
  // Boot highlight
  for (let y = 58; y <= 60; y++) { p(ctx, 19, y, lth2); p(ctx, 30, y, lth2); }
  // Boot strap
  for (let x = 18; x <= 27; x++) p(ctx, x, 60, leather);
  for (let x = 29; x <= 38; x++) p(ctx, x, 60, leather);

  save(canvas, outPath);
}

// ============================================================
//  MAGE — 56x68 grid
// ============================================================
function generateMage(outPath) {
  const GW = 56, GH = 68;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const rb='#3a1a5a', rb1='#4a2a6a', rb2='#5a3a7a', rb3='#2a0a4a', rb4='#1a0030', rb5='#100020';
  const skin='#7744aa', sk1='#8855bb', sk2='#9966cc';
  const beard='#888888', brd2='#777777', brd3='#666666';
  const hat='#4a1a6a', hat1='#5a2a7a', hat2='#3a0a5a';
  const gem='#cc44ff', gem2='#ff88ff', gem3='#9922cc';
  const gold='#ccaa33', gold2='#ddbb44';
  const staff='#664422', stf2='#553311';
  const out='#0a0515';

  // --- Pointed hat (taller, more detailed) ---
  p(ctx,28,0,hat1);
  block(ctx,27,1,3,1,hat1); p(ctx,28,1,shade(hat1,1.2));
  block(ctx,26,2,5,1,hat);
  block(ctx,25,3,7,1,hat);
  block(ctx,24,4,9,1,hat);
  block(ctx,23,5,11,2,hat);
  block(ctx,21,7,15,2,hat2);
  block(ctx,20,9,17,2,shade(hat2,0.8));
  // Hat band
  block(ctx,20,10,17,2,gold);
  p(ctx,28,10,gold2); p(ctx,27,11,shade(gold,0.8));
  // Star on hat
  p(ctx,28,4,'#ffdd66'); p(ctx,27,5,'#ffcc44'); p(ctx,29,5,'#ffcc44');

  // --- Head ---
  vGrad(ctx, 22, 12, 13, 4, sk2, sk1);
  vGrad(ctx, 22, 16, 13, 4, sk1, skin);
  for (let y = 12; y <= 19; y++) { p(ctx, 21, y, out); p(ctx, 35, y, out); }

  // Eyes (glowing purple)
  block(ctx, 24, 14, 3, 3, '#110022');
  block(ctx, 30, 14, 3, 3, '#110022');
  p(ctx,25,15,gem); p(ctx,31,15,gem);
  p(ctx,25,14,gem2); p(ctx,31,14,gem2); // eye shine

  // --- Beard (flowing, multi-shade) ---
  for (let y = 18; y <= 30; y++) {
    const w = y <= 20 ? 10 : y <= 24 ? 8 : y <= 27 ? 6 : y <= 29 ? 4 : 2;
    const x0 = 28 - Math.floor(w/2);
    const t = (y-18)/12;
    const c = mix(beard, brd3, t);
    for (let x = x0; x < x0+w; x++) {
      p(ctx, x, y, (x+y)%3===0 ? shade(c,1.1) : c);
    }
  }

  // --- Robe body ---
  vGrad(ctx, 17, 22, 23, 5, rb2, rb1);
  vGrad(ctx, 15, 27, 27, 5, rb1, rb);
  vGrad(ctx, 14, 32, 29, 4, rb, rb3);
  for (let y = 22; y <= 35; y++) { p(ctx, 13, y, out); p(ctx, 43, y, out); }

  // Rune symbols (glowing)
  p(ctx,24,27,gem3); p(ctx,33,27,gem3);
  p(ctx,26,29,gem); p(ctx,31,29,gem);
  p(ctx,28,31,gem2);
  // Connecting lines
  dither(ctx, 25, 28, 2, 1, gem3, rb);
  dither(ctx, 31, 28, 2, 1, gem3, rb);

  // Sash
  block(ctx, 25, 33, 7, 2, gold);
  p(ctx,28,33,gold2); p(ctx,28,34,shade(gold,0.8));

  // --- Sleeves (wide) ---
  for (let y = 24; y <= 38; y++) {
    const t = (y-24)/14;
    const c = mix(rb1, rb3, t);
    // Left sleeve
    for (let x = 7; x <= 14; x++) p(ctx, x, y, x <= 8 ? shade(c,0.8) : x <= 10 ? c : shade(c,1.15));
    // Right sleeve
    for (let x = 42; x <= 49; x++) p(ctx, x, y, x >= 48 ? shade(c,0.8) : x >= 46 ? c : shade(c,1.15));
  }

  // --- Staff ---
  for (let y = 4; y <= 62; y++) {
    p(ctx, 51, y, staff); p(ctx, 52, y, stf2);
  }
  // Staff orb
  vGrad(ctx, 49, 0, 6, 6, '#aa22ee', '#6600aa');
  block(ctx, 50, 1, 4, 4, gem3);
  p(ctx, 51, 2, gem2); p(ctx, 52, 3, gem);
  // Orb glow
  p(ctx,49,0,'#ff66ff44'); p(ctx,54,0,'#ff66ff44');
  p(ctx,48,3,gem3); p(ctx,55,3,gem3);

  // --- Casting hand (left) ---
  block(ctx, 5, 36, 4, 3, skin);
  // Magic particles
  p(ctx,3,34,gem); p(ctx,2,36,gem3); p(ctx,4,38,gem2);
  p(ctx,1,35,shade(gem,0.5)); p(ctx,3,37,shade(gem,0.6));

  // --- Robe skirt (flowing with folds) ---
  for (let y = 36; y <= 65; y++) {
    const w = y < 42 ? 32 : y < 50 ? 34 : y < 58 ? 32 : 28;
    const x0 = 28 - Math.floor(w/2);
    const t = (y-36)/29;
    const c = mix(rb3, rb5, t);
    for (let x = x0; x < x0+w; x++) {
      p(ctx, x, y, c);
    }
    // Folds (darker vertical lines)
    if (y >= 38) {
      p(ctx, 20, y, shade(c, 0.6));
      p(ctx, 28, y, shade(c, 0.6));
      p(ctx, 36, y, shade(c, 0.6));
      // Highlight between folds
      p(ctx, 24, y, shade(c, 1.3));
      p(ctx, 32, y, shade(c, 1.3));
    }
  }

  save(canvas, outPath);
}

// ============================================================
//  SHADOW CREEPER — 48x58 grid
// ============================================================
function generateShadowCreeper(outPath) {
  const GW = 48, GH = 58;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const body='#140020', bd1='#1e002e', bd2='#220033', bd3='#0c0016', bd4='#08000e';
  const glow='#cc00ff', glow2='#ff44ff', glow3='#9900bb';
  const claw='#8800cc', claw2='#6600aa';

  // --- Head (hunched forward, predatory) ---
  vGrad(ctx, 18, 4, 12, 4, bd2, bd1);
  vGrad(ctx, 17, 8, 14, 5, bd1, body);
  for (let y = 4; y <= 12; y++) { p(ctx, 16, y, '#050008'); p(ctx, 31, y, '#050008'); }

  // Glowing eyes (large, menacing)
  block(ctx, 19, 8, 4, 3, '#0a0015');
  block(ctx, 26, 8, 4, 3, '#0a0015');
  p(ctx,20,9,glow); p(ctx,21,9,glow2); p(ctx,22,9,glow);
  p(ctx,27,9,glow); p(ctx,28,9,glow2); p(ctx,29,9,glow);
  // Eye glow bleed
  p(ctx,20,8,glow3); p(ctx,21,8,glow3); p(ctx,27,8,glow3); p(ctx,28,8,glow3);
  p(ctx,20,10,glow3); p(ctx,29,10,glow3);

  // --- Spine/Back (hunched) ---
  vGrad(ctx, 17, 13, 14, 10, body, bd3);
  // Spine ridge
  for (let y = 13; y <= 22; y++) {
    p(ctx, 24, y, '#330055');
    p(ctx, 23, y, mix(body, '#330055', 0.3));
  }

  // --- Long arms (thin, sinuous) ---
  for (let y = 10; y <= 30; y++) {
    const t = (y-10)/20;
    const c = mix(bd2, bd3, t);
    // Left arm
    const lx = Math.round(10 - t*4);
    p(ctx, lx, y, c); p(ctx, lx+1, y, shade(c, 1.2)); p(ctx, lx+2, y, c);
    // Right arm
    const rx = Math.round(35 + t*4);
    p(ctx, rx, y, c); p(ctx, rx+1, y, shade(c, 1.2)); p(ctx, rx+2, y, c);
  }
  // Claws (long, sharp, glowing tips)
  for (let i = 0; i < 4; i++) {
    p(ctx, 4+i, 31+i, claw2); p(ctx, 5+i, 32+i, claw);
    p(ctx, 41-i, 31+i, claw2); p(ctx, 42-i, 32+i, claw);
  }
  // Claw tips glow
  p(ctx, 7, 34, glow); p(ctx, 8, 35, glow);
  p(ctx, 38, 34, glow); p(ctx, 39, 35, glow);

  // --- Legs (digitigrade, thin) ---
  for (let y = 23; y <= 40; y++) {
    const t = (y-23)/17;
    const c = mix(body, bd4, t);
    // Upper legs
    p(ctx, 19, y, c); p(ctx, 20, y, shade(c,1.2)); p(ctx, 21, y, c);
    p(ctx, 27, y, c); p(ctx, 28, y, shade(c,1.2)); p(ctx, 29, y, c);
  }
  // Backward knee bend
  for (let y = 38; y <= 46; y++) {
    const c = mix(bd3, bd4, (y-38)/8);
    p(ctx, 16, y, c); p(ctx, 17, y, shade(c,1.1)); p(ctx, 18, y, c);
    p(ctx, 30, y, c); p(ctx, 31, y, shade(c,1.1)); p(ctx, 32, y, c);
  }
  // Feet
  vGrad(ctx, 13, 47, 8, 3, bd3, bd4);
  vGrad(ctx, 28, 47, 8, 3, bd3, bd4);
  // Toe claws
  p(ctx,12,49,claw); p(ctx,15,50,claw); p(ctx,18,49,claw);
  p(ctx,28,49,claw); p(ctx,31,50,claw); p(ctx,34,49,claw);

  // --- Shadow wisps (atmospheric) ---
  const wisps = [[8,4],[38,6],[5,20],[42,18],[14,52],[34,54],[24,56],[20,2],[36,3]];
  wisps.forEach(([wx,wy]) => {
    p(ctx, wx, wy, '#180028');
    p(ctx, wx+1, wy+1, '#10001a');
  });

  save(canvas, outPath);
}

// ============================================================
//  CHAIN GUARD — 60x72 grid
// ============================================================
function generateChainGuard(outPath) {
  const GW = 60, GH = 72;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const ar='#606878', ar1='#7888a0', ar2='#90a0b8', ar3='#4a5a6a', ar4='#384858', ar5='#283848';
  const chain='#8898a8', ch2='#a0b0c0';
  const sh='#7888aa', sh1='#99aacc', sh2='#aabbdd', sh3='#556688';
  const gold='#ccaa33', gold2='#ddbb44';
  const eye='#ff2200';
  const wood='#664422', wd2='#553311';
  const out='#222233';

  // --- Helmet (detailed) ---
  vGrad(ctx, 22, 2, 16, 5, ar2, ar1);
  vGrad(ctx, 20, 7, 20, 6, ar1, ar);
  vGrad(ctx, 21, 13, 18, 4, ar, ar3);
  for (let x = 22; x < 38; x++) p(ctx, x, 1, out);
  for (let y = 2; y <= 16; y++) { p(ctx, 19, y, out); p(ctx, 40, y, out); }
  // Crown ridge
  block(ctx, 24, 2, 12, 1, gold);
  p(ctx, 30, 1, gold2);
  // Nose guard
  for (let y = 5; y <= 14; y++) p(ctx, 30, y, ar2);
  // Visor
  block(ctx, 24, 9, 12, 5, '#1a0505');
  // Eyes behind visor
  block(ctx, 26, 10, 3, 2, eye);
  block(ctx, 33, 10, 3, 2, eye);
  p(ctx, 27, 10, '#ff6644'); p(ctx, 34, 10, '#ff6644');

  // --- Massive shoulders ---
  for (let y = 17; y <= 26; y++) {
    const t = (y-17)/9;
    const c = mix(ar1, ar3, t);
    // Left
    block(ctx, 6, y, 14, 1, c);
    // Right
    block(ctx, 40, y, 14, 1, c);
  }
  // Shoulder highlights
  for (let y = 17; y <= 20; y++) { p(ctx, 8, y, ar2); p(ctx, 42, y, ar2); }
  // Rivets
  p(ctx,9,20,gold); p(ctx,13,20,gold); p(ctx,17,20,gold);
  p(ctx,43,20,gold); p(ctx,47,20,gold); p(ctx,51,20,gold);
  // Hanging chains
  for (let y = 27; y <= 36; y += 2) {
    p(ctx,8,y,chain); p(ctx,10,y+1,ch2); p(ctx,12,y,chain);
    p(ctx,48,y,chain); p(ctx,50,y+1,ch2); p(ctx,52,y,chain);
  }

  // --- Chain mail body ---
  vGrad(ctx, 18, 17, 24, 8, ar1, ar);
  vGrad(ctx, 18, 25, 24, 8, ar, ar3);
  vGrad(ctx, 18, 33, 24, 6, ar3, ar4);
  // Chain mail pattern (detailed dither)
  for (let y = 20; y <= 36; y += 2)
    for (let x = 19; x <= 40; x += 3) {
      p(ctx, x, y, chain); p(ctx, x+1, y+1, ch2);
    }

  // Belt
  vGrad(ctx, 18, 38, 24, 3, shade(wood,1.2), wood);
  block(ctx, 28, 38, 4, 3, gold);
  p(ctx, 29, 39, gold2);

  // --- Shield (left, detailed) ---
  vGrad(ctx, 0, 20, 10, 6, sh2, sh1);
  vGrad(ctx, 0, 26, 10, 10, sh1, sh);
  vGrad(ctx, 0, 36, 10, 6, sh, sh3);
  // Shield boss
  block(ctx, 3, 29, 4, 4, gold);
  p(ctx, 4, 30, gold2); p(ctx, 5, 31, shade(gold,0.8));
  // Shield cross
  for (let y = 22; y <= 40; y++) p(ctx, 5, y, sh3);
  for (let x = 1; x <= 9; x++) p(ctx, x, 31, sh3);
  // Shield edge outline
  for (let y = 20; y <= 41; y++) p(ctx, 10, y, out);

  // --- Mace (right hand) ---
  for (let y = 12; y <= 36; y++) { p(ctx, 53, y, wood); p(ctx, 54, y, wd2); }
  // Mace head
  vGrad(ctx, 51, 6, 6, 8, ar2, ar);
  block(ctx, 52, 7, 4, 6, ar1);
  // Spikes
  p(ctx,50,5,chain); p(ctx,57,5,chain);
  p(ctx,50,13,chain); p(ctx,57,13,chain);
  p(ctx,54,4,ch2); p(ctx,54,14,ch2);

  // --- Legs (armored) ---
  for (let y = 41; y <= 60; y++) {
    const t = (y-41)/19;
    const c = mix(ar3, ar5, t);
    const ch = shade(c, 1.2), cd = shade(c, 0.8);
    // Left
    p(ctx,21,y,out); p(ctx,22,y,cd);
    for (let x = 23; x <= 28; x++) p(ctx, x, y, x<=24?c:x<=26?ch:c);
    p(ctx,29,y,cd); p(ctx,30,y,out);
    // Right
    p(ctx,31,y,out); p(ctx,32,y,cd);
    for (let x = 33; x <= 38; x++) p(ctx, x, y, x<=34?c:x<=36?ch:c);
    p(ctx,39,y,cd); p(ctx,40,y,out);
  }
  // Knee guards
  block(ctx, 23, 51, 6, 3, ar1);
  block(ctx, 33, 51, 6, 3, ar1);

  // Boots
  vGrad(ctx, 19, 61, 14, 5, ar4, ar5);
  vGrad(ctx, 29, 61, 14, 5, ar4, ar5);
  block(ctx, 20, 61, 12, 2, ar3);
  block(ctx, 30, 61, 12, 2, ar3);

  save(canvas, outPath);
}

// ============================================================
//  FLAME WEAVER — 56x68 grid
// ============================================================
function generateFlameWeaver(outPath) {
  const GW = 56, GH = 68;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');

  const rb='#aa3300', rb1='#cc5511', rb2='#dd6622', rb3='#882200', rb4='#661100', rb5='#440800';
  const fl1='#ff8800', fl2='#ffaa00', fl3='#ffcc44', fl4='#ffff88';
  const skin='#cc4400', sk1='#dd5511', sk2='#ee6622';
  const out='#220800';

  // --- Flame crown (animated-looking, tall) ---
  const flames = [
    [20,0,fl2],[22,0,fl1],[24,0,fl3],[26,0,fl1],[28,0,fl2],[30,0,fl3],[32,0,fl1],[34,0,fl2],
    [19,1,fl1],[21,1,fl3],[23,1,fl2],[25,1,fl4],[27,1,fl3],[29,1,fl1],[31,1,fl4],[33,1,fl2],[35,1,fl1],
    [18,2,fl1],[20,2,fl2],[22,2,fl3],[24,2,fl1],[26,2,fl2],[28,2,fl3],[30,2,fl1],[32,2,fl2],[34,2,fl3],[36,2,fl1],
    [17,3,'#ff4400'],[19,3,fl1],[21,3,fl2],[35,3,fl1],[37,3,'#ff4400'],
  ];
  flames.forEach(([x,y,c]) => p(ctx, x, y, c));
  block(ctx, 18, 4, 20, 2, '#ee3300');
  block(ctx, 19, 4, 18, 1, '#ff4400');

  // --- Head ---
  vGrad(ctx, 21, 6, 14, 4, sk2, sk1);
  vGrad(ctx, 21, 10, 14, 4, sk1, skin);
  for (let y = 6; y <= 13; y++) { p(ctx, 20, y, out); p(ctx, 35, y, out); }

  // Eyes (bright white-yellow, burning)
  block(ctx, 23, 9, 4, 3, '#331100');
  block(ctx, 30, 9, 4, 3, '#331100');
  p(ctx,24,10,fl3); p(ctx,25,10,fl4); p(ctx,26,10,fl3);
  p(ctx,31,10,fl3); p(ctx,32,10,fl4); p(ctx,33,10,fl3);
  // Eye glow
  p(ctx,24,9,fl1); p(ctx,25,9,fl2); p(ctx,31,9,fl1); p(ctx,32,9,fl2);

  // Mouth (inner glow)
  block(ctx, 25, 12, 6, 1, '#552200');
  p(ctx,26,12,fl1); p(ctx,29,12,fl1);

  // --- Robe ---
  vGrad(ctx, 16, 14, 24, 6, rb2, rb1);
  vGrad(ctx, 14, 20, 28, 6, rb1, rb);
  vGrad(ctx, 14, 26, 28, 6, rb, rb3);
  for (let y = 14; y <= 31; y++) { p(ctx, 13, y, out); p(ctx, 42, y, out); }

  // Ember pattern on robe
  const embers = [[22,18,fl1],[34,20,fl2],[26,24,fl1],[30,17,fl3],[18,22,fl1],[38,24,fl2]];
  embers.forEach(([x,y,c]) => p(ctx, x, y, c));

  // --- Arms with fire orbs ---
  for (let y = 16; y <= 28; y++) {
    const t = (y-16)/12;
    const c = mix(rb1, rb3, t);
    p(ctx,8,y,c); p(ctx,9,y,shade(c,1.15)); p(ctx,10,y,c); p(ctx,11,y,shade(c,0.85));
    p(ctx,44,y,shade(c,0.85)); p(ctx,45,y,c); p(ctx,46,y,shade(c,1.15)); p(ctx,47,y,c);
  }

  // Fire orb left
  block(ctx, 2, 26, 8, 8, fl1);
  vGrad(ctx, 3, 27, 6, 6, fl2, fl1);
  block(ctx, 4, 28, 4, 4, fl3);
  p(ctx, 5, 29, fl4); p(ctx, 6, 30, '#ffffff');
  // Flames above orb
  p(ctx,3,24,fl1); p(ctx,5,23,fl2); p(ctx,7,24,fl3); p(ctx,4,22,fl1);

  // Fire orb right
  block(ctx, 46, 26, 8, 8, fl1);
  vGrad(ctx, 47, 27, 6, 6, fl2, fl1);
  block(ctx, 48, 28, 4, 4, fl3);
  p(ctx, 49, 29, fl4); p(ctx, 50, 30, '#ffffff');
  p(ctx,47,24,fl1); p(ctx,49,23,fl2); p(ctx,51,24,fl3);

  // --- Robe bottom ---
  for (let y = 32; y <= 63; y++) {
    const w = y < 40 ? 30 : y < 50 ? 28 : y < 58 ? 26 : 22;
    const x0 = 28 - Math.floor(w/2);
    const t = (y-32)/31;
    const c = mix(rb3, rb5, t);
    for (let x = x0; x < x0+w; x++) p(ctx, x, y, c);
    // Folds with highlights
    if (y >= 34) {
      p(ctx, 20, y, shade(c, 0.6)); p(ctx, 28, y, shade(c, 0.6)); p(ctx, 36, y, shade(c, 0.6));
      p(ctx, 24, y, shade(c, 1.3)); p(ctx, 32, y, shade(c, 1.3));
    }
  }

  // Floating embers
  const sparks = [[10,4,fl3],[44,2,fl2],[6,14,fl1],[50,12,fl2],[3,40,fl1],[52,38,fl3]];
  sparks.forEach(([x,y,c]) => { p(ctx,x,y,c); p(ctx,x+1,y,shade(c,0.7)); });

  save(canvas, outPath);
}

// === BOSSES (66x78 grid) ===

function generateBossChainMaster(outPath) {
  const GW = 66, GH = 78;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');
  const ar='#667788',ar1='#8899aa',ar2='#a0b0c0',ar3='#4a5a6a',ar4='#384858',ar5='#283848';
  const chain='#aabbcc',ch2='#c0d0e0';
  const gold='#ccaa33',gold2='#ddbb44';
  const eye='#ff0000';
  const out='#222233';

  // Horned helmet
  for(let i=0;i<6;i++){p(ctx,14,i,mix(ar3,ar1,i/5));p(ctx,15,i,mix(ar,ar2,i/5));}
  for(let i=0;i<6;i++){p(ctx,50,i,mix(ar3,ar1,i/5));p(ctx,51,i,mix(ar,ar2,i/5));}

  // Helmet
  vGrad(ctx,22,3,22,6,ar2,ar1);
  vGrad(ctx,20,9,26,8,ar1,ar);
  vGrad(ctx,21,17,24,4,ar,ar3);
  for(let x=22;x<44;x++)p(ctx,x,2,out);
  block(ctx,24,3,18,2,gold);p(ctx,33,2,gold2);
  // Nose guard
  for(let y=6;y<=18;y++)p(ctx,33,y,ar2);
  // Visor
  block(ctx,26,11,14,6,  '#0a0505');
  block(ctx,28,12,4,3,eye);block(ctx,36,12,4,3,eye);
  p(ctx,29,12,'#ff4444');p(ctx,37,12,'#ff4444');

  // Massive shoulders
  for(let y=21;y<=32;y++){const t=(y-21)/11;const c=mix(ar1,ar3,t);
    block(ctx,4,y,16,1,c);block(ctx,46,y,16,1,c);}
  for(let y=21;y<=24;y++){p(ctx,6,y,ar2);p(ctx,48,y,ar2);}
  [8,12,16].forEach(x=>{p(ctx,x,25,gold);p(ctx,x+40,25,gold);});
  for(let y=33;y<=44;y+=2){[7,11,15].forEach(x=>{p(ctx,x,y,chain);p(ctx,x+40,y,chain);});}

  // Body
  vGrad(ctx,18,21,30,10,ar1,ar);
  vGrad(ctx,18,31,30,10,ar,ar3);
  vGrad(ctx,18,41,30,6,ar3,ar4);
  for(let y=25;y<=44;y+=2)for(let x=20;x<=46;x+=3){p(ctx,x,y,chain);p(ctx,x+1,y+1,ch2);}

  // Belt+chains
  vGrad(ctx,18,46,30,4,shade('#664422',1.1),'#664422');
  block(ctx,31,46,4,4,gold);p(ctx,32,47,gold2);
  for(let x=20;x<=46;x+=4)p(ctx,x,49,chain);

  // Chain whip
  for(let i=0;i<12;i++){const cx=60+(i%2);p(ctx,cx,18+i*2,chain);p(ctx,cx+1,19+i*2,ch2);}

  // Left fist
  block(ctx,2,34,5,5,ar3);block(ctx,3,35,3,3,ar);

  // Legs
  for(let y=50;y<=68;y++){const t=(y-50)/18;const c=mix(ar3,ar5,t);
    const ch=shade(c,1.2),cd=shade(c,0.8);
    p(ctx,23,y,out);for(let x=24;x<=31;x++)p(ctx,x,y,x<=25?cd:x<=28?ch:cd);p(ctx,32,y,out);
    p(ctx,34,y,out);for(let x=35;x<=42;x++)p(ctx,x,y,x<=36?cd:x<=39?ch:cd);p(ctx,43,y,out);
  }
  block(ctx,25,58,6,3,ar1);block(ctx,36,58,6,3,ar1);
  vGrad(ctx,21,69,14,5,ar4,ar5);vGrad(ctx,32,69,14,5,ar4,ar5);

  save(canvas,outPath);
}

function generateBossCeremonyMaster(outPath) {
  const GW = 66, GH = 78;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');
  const rb='#2a0044',rb1='#441177',rb2='#552288',rb3='#1a0030',rb4='#0f0020',rb5='#080012';
  const skin='#5a1177',sk1='#6a2288';
  const gem_o='#ff6600',gem_p='#cc00cc',glow='#ff44ff';
  const staff='#553300',stf2='#442200';
  const gold='#ccaa33';

  // Headdress
  block(ctx,29,0,8,4,'#550088');block(ctx,28,1,10,2,'#440066');
  p(ctx,32,0,gem_o);p(ctx,33,1,'#ffaa00');p(ctx,34,0,gem_o);

  // Hood
  vGrad(ctx,24,4,18,6,'#3a0055','#2a0040');
  vGrad(ctx,22,10,22,4,rb1,rb);

  // Face
  vGrad(ctx,26,8,14,6,sk1,skin);
  vGrad(ctx,26,14,14,4,skin,shade(skin,0.8));
  block(ctx,29,11,3,3,'#111100');block(ctx,35,11,3,3,'#111100');
  p(ctx,30,12,gem_o);p(ctx,31,12,'#ffcc00');
  p(ctx,36,12,gem_o);p(ctx,37,12,'#ffcc00');
  block(ctx,31,16,4,1,'#220033');

  // Robe
  vGrad(ctx,20,18,26,8,rb2,rb1);
  vGrad(ctx,18,26,30,8,rb1,rb);
  vGrad(ctx,16,34,34,6,rb,rb3);
  // Pentagram
  p(ctx,33,22,gem_p);p(ctx,30,25,gem_p);p(ctx,36,25,gem_p);
  p(ctx,31,29,gem_p);p(ctx,35,29,gem_p);
  for(let x=30;x<=36;x++)p(ctx,x,25,shade(gem_p,0.7));

  // Staff
  for(let y=6;y<=70;y++){p(ctx,56,y,staff);p(ctx,57,y,stf2);}
  block(ctx,54,2,6,6,'#8800aa');block(ctx,55,3,4,4,'#aa22dd');
  p(ctx,56,4,glow);p(ctx,57,5,'#cc44ff');

  // Casting hand
  block(ctx,10,28,5,4,skin);
  [glow,shade(glow,0.6),gem_p].forEach((c,i)=>{p(ctx,8+i,26,c);p(ctx,7+i,30,c);});

  // Robe bottom
  for(let y=40;y<=74;y++){
    const w=y<50?36:y<60?34:y<68?30:26;
    const x0=33-Math.floor(w/2);
    const t=(y-40)/34;const c=mix(rb3,rb5,t);
    for(let x=x0;x<x0+w;x++)p(ctx,x,y,c);
    if(y>=42){p(ctx,24,y,shade(c,0.5));p(ctx,33,y,shade(c,0.5));p(ctx,42,y,shade(c,0.5));
      p(ctx,28,y,shade(c,1.3));p(ctx,38,y,shade(c,1.3));}
  }

  save(canvas,outPath);
}

function generateBossShadowCouncillor(outPath) {
  const GW = 66, GH = 78;
  const canvas = createCanvas(GW*PX, GH*PX);
  const ctx = canvas.getContext('2d');
  const cl='#0a0a0a',cl1='#141414',cl2='#1a1a1a',cl3='#060606',cl4='#030303';
  const red='#ff0000',red1='#cc0000',red2='#880000',red3='#440000',red4='#220000';

  // Hood
  vGrad(ctx,22,3,22,6,cl2,cl1);
  vGrad(ctx,20,9,26,6,cl1,cl);
  vGrad(ctx,21,15,24,4,cl,cl3);

  // Face (void with eyes)
  block(ctx,24,10,18,8,cl3);
  // Prominent glowing eyes
  block(ctx,27,12,5,3,'#1a0000');
  block(ctx,36,12,5,3,'#1a0000');
  block(ctx,28,13,3,1,red);block(ctx,37,13,3,1,red);
  p(ctx,29,13,'#ff4444');p(ctx,38,13,'#ff4444');
  // Eye glow bleed
  [27,28,29,30,31].forEach(x=>{p(ctx,x,11,red3);p(ctx,x,15,red3);});
  [36,37,38,39,40].forEach(x=>{p(ctx,x,11,red3);p(ctx,x,15,red3);});
  // Veins from eyes
  for(let i=1;i<=4;i++){p(ctx,26-i,13+i,mix(red2,cl,i/4));p(ctx,42+i,13+i,mix(red2,cl,i/4));}

  // Dark cloak body
  vGrad(ctx,16,19,34,8,cl1,cl);
  vGrad(ctx,14,27,38,8,cl,cl3);
  vGrad(ctx,14,35,38,6,cl3,cl4);
  // Red energy lines
  for(let y=22;y<=38;y+=3){p(ctx,20,y,red4);p(ctx,46,y,red4);}
  p(ctx,28,26,red3);p(ctx,38,28,red3);p(ctx,33,24,'#330000');

  // Shadow tendrils
  for(let y=20;y<=36;y++){const t=(y-20)/16;const c=mix(cl1,cl3,t);
    p(ctx,8,y,c);p(ctx,9,y,shade(c,1.2));p(ctx,10,y,c);p(ctx,11,y,shade(c,0.8));
    p(ctx,55,y,shade(c,0.8));p(ctx,56,y,c);p(ctx,57,y,shade(c,1.2));p(ctx,58,y,c);
  }
  // Tendril tips
  for(let i=0;i<4;i++){p(ctx,5+i,37+i,cl3);p(ctx,59-i,37+i,cl3);}
  p(ctx,4,38,red);p(ctx,5,39,red1);
  p(ctx,61,38,red);p(ctx,60,39,red1);

  // Flowing cloak
  for(let y=41;y<=74;y++){
    const w=y<50?40:y<60?36:y<68?30:24;
    const x0=33-Math.floor(w/2);
    const t=(y-41)/33;const c=mix(cl3,cl4,t);
    for(let x=x0;x<x0+w;x++)p(ctx,x,y,c);
    if(y>=44){p(ctx,22,y,'#020202');p(ctx,33,y,'#020202');p(ctx,44,y,'#020202');}
  }
  // Wisps at bottom
  [[18,72],[25,74],[33,73],[41,74],[48,72]].forEach(([x,y])=>{p(ctx,x,y,cl3);p(ctx,x+1,y+1,cl4);});

  save(canvas,outPath);
}

// ---- Generate All ----
const enemyDir = path.join(__dirname, '..', 'assets', 'enemy');
['imp','archer','mage','shadow','chainguard','flameweaver','boss_chain','boss_ceremony','boss_shadow']
  .forEach(d => { const dir = path.join(enemyDir, d); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

generateImp(path.join(enemyDir, 'imp', 'imp.png'));
generateArcher(path.join(enemyDir, 'archer', 'archer.png'));
generateMage(path.join(enemyDir, 'mage', 'mage.png'));
generateShadowCreeper(path.join(enemyDir, 'shadow', 'shadow.png'));
generateChainGuard(path.join(enemyDir, 'chainguard', 'chainguard.png'));
generateFlameWeaver(path.join(enemyDir, 'flameweaver', 'flameweaver.png'));
generateBossChainMaster(path.join(enemyDir, 'boss_chain', 'chainmaster.png'));
generateBossCeremonyMaster(path.join(enemyDir, 'boss_ceremony', 'ceremonymaster.png'));
generateBossShadowCouncillor(path.join(enemyDir, 'boss_shadow', 'shadowcouncillor.png'));

console.log('\nAll high-detail sprites with gradients generated!');
