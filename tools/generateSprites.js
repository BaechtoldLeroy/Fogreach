// Dark medieval enemy sprite generator — old-school gritty pixel art style
// Inspired by Diablo 1, Darkest Dungeon, classic dungeon crawlers
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PX = 4; // smaller pixels = more detail (112x136 effective grid on 448x544)

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

function mix(h1, h2, t) {
  const r1=parseInt(h1.slice(1,3),16),g1=parseInt(h1.slice(3,5),16),b1=parseInt(h1.slice(5,7),16);
  const r2=parseInt(h2.slice(1,3),16),g2=parseInt(h2.slice(3,5),16),b2=parseInt(h2.slice(5,7),16);
  const r=Math.round(r1+(r2-r1)*t),g=Math.round(g1+(g2-g1)*t),b=Math.round(b1+(b2-b1)*t);
  return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
}

// Dither: checkerboard between two colors for gritty texture
function dither(ctx, x, y, w, h, c1, c2) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      p(ctx, x+dx, y+dy, (dx+dy)%2===0 ? c1 : c2);
}

// Noisy fill: randomly pick from color array for organic look
function noiseFill(ctx, x, y, w, h, colors, seed=0) {
  let s = seed;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      p(ctx, x+dx, y+dy, colors[s % colors.length]);
    }
}

// Organic edge: draw a rough-edged shape (not perfectly rectangular)
function roughBlock(ctx, x, y, w, h, colors, indent=1) {
  let s = 42;
  for (let dy = 0; dy < h; dy++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const li = (s % 3 === 0) ? indent : 0; // random left indent
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const ri = (s % 3 === 0) ? indent : 0; // random right indent
    for (let dx = li; dx < w - ri; dx++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      p(ctx, x+dx, y+dy, colors[s % colors.length]);
    }
  }
}

function save(canvas, outPath) {
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Generated:', path.basename(outPath));
}

// ============================================================
//  IMP — Hunched, feral little demon. Muted dark reds, bony.
// ============================================================
function generateImp(outPath) {
  const W = 112, H = 136;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  // Palette: dark muted reds, almost brown
  const skin = ['#6a2a22','#5e2420','#72302a','#582018','#4e1a14'];
  const skinHi = ['#7a3830','#843e36'];
  const skinDk = ['#3e1410','#34100c','#2a0c08'];
  const bone = ['#c8b8a0','#b8a890','#d0c0a8'];
  const eye = '#cc8800';
  const eyeGlow = '#ffaa22';

  // Head — slightly too large, hunched forward
  roughBlock(ctx, 38, 8, 36, 28, skin, 2);
  noiseFill(ctx, 40, 10, 32, 24, skin, 7);
  // Brow ridge — heavy, overhanging
  noiseFill(ctx, 36, 16, 40, 4, skinDk, 3);
  // Sunken eyes
  block(ctx, 44, 20, 8, 6, '#0a0404');
  block(ctx, 62, 20, 8, 6, '#0a0404');
  p(ctx, 46, 22, eye); p(ctx, 47, 22, eyeGlow); p(ctx, 48, 21, shade(eye,0.6));
  p(ctx, 64, 22, eye); p(ctx, 65, 22, eyeGlow); p(ctx, 66, 21, shade(eye,0.6));
  // Snout/mouth — protruding, jagged teeth
  noiseFill(ctx, 44, 28, 24, 6, skinDk, 11);
  for (let i = 0; i < 6; i++) {
    p(ctx, 46+i*3, 28, bone[i%3]); // upper teeth
    p(ctx, 47+i*3, 33, bone[(i+1)%3]); // lower teeth, offset
  }
  // Horns — curved, cracked
  for (let i = 0; i < 10; i++) {
    const hx = 34-Math.floor(i*0.8), hy = 12-i;
    p(ctx, hx, hy, bone[i%3]); p(ctx, hx+1, hy, shade(bone[0], 0.7));
  }
  for (let i = 0; i < 10; i++) {
    const hx = 78+Math.floor(i*0.8), hy = 12-i;
    p(ctx, hx, hy, bone[i%3]); p(ctx, hx-1, hy, shade(bone[0], 0.7));
  }
  // Pointed ears
  roughBlock(ctx, 28, 14, 10, 14, skin, 1);
  roughBlock(ctx, 74, 14, 10, 14, skin, 1);
  p(ctx, 26, 12, skinDk[0]); p(ctx, 27, 11, skinDk[1]);
  p(ctx, 85, 12, skinDk[0]); p(ctx, 84, 11, skinDk[1]);

  // Neck — thin, sinuous
  noiseFill(ctx, 48, 36, 16, 6, skinDk, 5);

  // Torso — hunched, lean, visible ribs
  roughBlock(ctx, 34, 42, 44, 30, skin, 2);
  noiseFill(ctx, 36, 44, 40, 26, skin, 13);
  // Rib shadows
  for (let i = 0; i < 4; i++) {
    dither(ctx, 40, 48+i*5, 32, 2, skinDk[0], skinDk[1]);
  }
  // Chest wound/scar
  for (let i = 0; i < 6; i++) p(ctx, 52+i, 50+Math.floor(Math.sin(i)*2), '#3a0808');

  // Arms — long, sinewy, clawed
  for (let y = 42; y <= 82; y++) {
    const t = (y-42)/40;
    const arm = skin[Math.floor(t*skin.length)%skin.length];
    const armD = skinDk[Math.floor(t*2)%skinDk.length];
    // Left arm (reaching forward)
    const lx = 24 - Math.floor(t*8);
    p(ctx,lx,y,armD); p(ctx,lx+1,y,arm); p(ctx,lx+2,y,arm); p(ctx,lx+3,y,armD);
    // Right arm
    const rx = 82 + Math.floor(t*4);
    p(ctx,rx,y,armD); p(ctx,rx+1,y,arm); p(ctx,rx+2,y,arm); p(ctx,rx+3,y,armD);
  }
  // Claws — long, sharp, yellowed bone
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 6; j++) {
      p(ctx, 12+i*3-j, 84+j, bone[j%3]);
    }
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
      p(ctx, 90+i*3+j, 84+j, bone[j%3]);
    }
  }

  // Belt — ragged leather
  noiseFill(ctx, 36, 70, 40, 4, ['#3a2a18','#2e2010','#342414','#28180c'], 7);
  p(ctx, 56, 71, '#887044'); // crude buckle

  // Legs — digitigrade, thin
  for (let y = 74; y <= 110; y++) {
    const t = (y-74)/36;
    const c = skin[Math.floor(t*3)%skin.length];
    const cd = skinDk[Math.floor(t*2)%skinDk.length];
    // Left leg
    noiseFill(ctx, 38+Math.floor(t*-4), y, 8, 1, [c, cd], y*3);
    // Right leg
    noiseFill(ctx, 64+Math.floor(t*4), y, 8, 1, [c, cd], y*7);
  }
  // Feet — clawed
  noiseFill(ctx, 28, 110, 16, 6, skinDk, 33);
  noiseFill(ctx, 68, 110, 16, 6, skinDk, 44);
  p(ctx,27,115,bone[0]); p(ctx,30,116,bone[1]); p(ctx,34,115,bone[2]);
  p(ctx,69,115,bone[0]); p(ctx,73,116,bone[1]); p(ctx,76,115,bone[2]);

  // Tail — thin, whip-like
  for (let i = 0; i < 20; i++) {
    const tx = 80+i*1.5, ty = 65+Math.sin(i*0.5)*3;
    p(ctx, Math.round(tx), Math.round(ty), skinDk[i%3]);
    p(ctx, Math.round(tx), Math.round(ty)+1, skin[i%skin.length]);
  }

  save(canvas, outPath);
}

// ============================================================
//  ARCHER — Gaunt, hooded figure with longbow. Dark greens/browns.
// ============================================================
function generateArcher(outPath) {
  const W = 112, H = 136;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const cloak = ['#1e3a1e','#1a3018','#223e22','#162a14','#1e341c'];
  const cloakDk = ['#0e1e0c','#0a180a','#122210'];
  const skin = ['#8a7a60','#7e6e54','#968868'];
  const skinDk = ['#5e5040','#524434'];
  const leather = ['#3a2a14','#2e2010','#342414'];
  const wood = ['#5a3a1a','#4e3016','#664420'];
  const metal = ['#888888','#7a7a7a','#969696'];
  const string = '#aaa888';

  // Hood — deep, shadowed
  roughBlock(ctx, 36, 4, 40, 20, cloak, 2);
  noiseFill(ctx, 38, 6, 36, 16, cloak, 3);
  // Hood shadow over face
  noiseFill(ctx, 40, 18, 32, 6, cloakDk, 5);

  // Face — gaunt, angular, in shadow
  noiseFill(ctx, 42, 16, 28, 18, skinDk, 7);
  noiseFill(ctx, 44, 18, 24, 12, skin, 9);
  // Eyes — sharp red, predatory
  block(ctx, 48, 22, 6, 3, '#0c0404');
  block(ctx, 60, 22, 6, 3, '#0c0404');
  p(ctx,50,23,'#aa2200'); p(ctx,51,23,'#cc3300');
  p(ctx,62,23,'#aa2200'); p(ctx,63,23,'#cc3300');
  // Thin mouth
  noiseFill(ctx, 50, 28, 12, 2, skinDk, 11);

  // Neck
  noiseFill(ctx, 48, 34, 16, 4, skinDk, 5);

  // Torso — lean, cloaked
  roughBlock(ctx, 30, 38, 52, 28, cloak, 2);
  noiseFill(ctx, 32, 40, 48, 24, cloak, 17);
  // Leather straps crossing chest
  for (let i = 0; i < 10; i++) {
    p(ctx, 38+i*2, 42+i*2, leather[i%3]);
    p(ctx, 39+i*2, 42+i*2, leather[(i+1)%3]);
    p(ctx, 72-i*2, 42+i*2, leather[i%3]);
    p(ctx, 73-i*2, 42+i*2, leather[(i+1)%3]);
  }

  // Belt
  noiseFill(ctx, 32, 64, 48, 4, leather, 13);
  p(ctx, 55, 65, '#776040'); p(ctx, 56, 65, '#887050');

  // Quiver on back
  for (let y = 16; y <= 60; y++) {
    p(ctx, 82, y, leather[y%3]); p(ctx, 83, y, leather[(y+1)%3]);
    p(ctx, 84, y, shade(leather[0], 1.2));
  }
  // Arrow feathers
  p(ctx,82,14,metal[0]); p(ctx,83,13,metal[1]); p(ctx,84,15,metal[0]);

  // Bow — left side, curved wood with grain
  for (let y = 10; y <= 80; y++) {
    const curve = Math.sin((y-10)/70 * Math.PI) * 8;
    const bx = 14 - Math.round(curve);
    p(ctx, bx, y, wood[y%3]);
    p(ctx, bx+1, y, wood[(y+1)%3]);
  }
  // Bowstring
  for (let y = 14; y <= 76; y++) p(ctx, 20, y, string);
  // Arrow nocked
  for (let x = 6; x <= 22; x++) {
    p(ctx, x, 45, wood[x%3]);
  }
  p(ctx, 5, 45, metal[0]); p(ctx, 4, 44, metal[1]); p(ctx, 4, 46, metal[1]);

  // Arms
  for (let y = 40; y <= 68; y++) {
    const t = (y-40)/28;
    // Left arm (bow hand)
    const c = cloak[Math.floor(t*3)%cloak.length];
    p(ctx, 22, y, c); p(ctx, 23, y, shade(c,1.1)); p(ctx, 24, y, c);
    // Right arm
    p(ctx, 84, y, c); p(ctx, 85, y, shade(c,1.1)); p(ctx, 86, y, c);
  }
  // Hands
  noiseFill(ctx, 20, 68, 6, 4, skin, 19);
  noiseFill(ctx, 84, 68, 6, 4, skin, 21);

  // Legs — wrapped in cloth
  for (let y = 68; y <= 108; y++) {
    const t = (y-68)/40;
    const c = cloakDk[Math.floor(t*2)%cloakDk.length];
    noiseFill(ctx, 38, y, 12, 1, [c, shade(c,1.1)], y*3);
    noiseFill(ctx, 60, y, 12, 1, [c, shade(c,1.1)], y*7);
  }

  // Boots — worn leather
  noiseFill(ctx, 34, 108, 18, 8, leather, 23);
  noiseFill(ctx, 56, 108, 18, 8, leather, 29);
  // Boot wrappings
  for (let i = 0; i < 3; i++) {
    dither(ctx, 36, 110+i*2, 14, 1, leather[0], leather[2]);
    dither(ctx, 58, 110+i*2, 14, 1, leather[0], leather[2]);
  }

  save(canvas, outPath);
}

// ============================================================
//  MAGE — Hunched sorcerer in tattered robes. Deep purples, sickly.
// ============================================================
function generateMage(outPath) {
  const W = 112, H = 136;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const robe = ['#28103a','#22082e','#2e1444','#1e0828','#241038'];
  const robeDk = ['#140420','#100318','#0c0210'];
  const skin = ['#584488','#4e3a7a','#624e92'];
  const skinDk = ['#3a2860','#302050'];
  const gem = '#8844cc';
  const gemGlow = '#bb66ff';
  const staff = ['#3a2810','#2e200c','#44301a'];
  const bone = ['#b0a088','#a09078','#c0b098'];

  // Pointed hat — crooked, tattered
  for (let y = 0; y < 20; y++) {
    const w = 2 + y * 0.8;
    const x0 = 58 - w/2 - Math.sin(y*0.3)*2; // slight bend
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, robe, y*7);
  }
  // Hat brim
  noiseFill(ctx, 34, 18, 44, 4, robe, 33);
  dither(ctx, 36, 21, 40, 1, robeDk[0], robeDk[1]);

  // Head — thin, gaunt
  noiseFill(ctx, 42, 22, 28, 20, skin, 9);
  noiseFill(ctx, 44, 24, 24, 6, shade(skin[0],1.1), 11);
  // Sunken glowing eyes
  block(ctx, 46, 28, 7, 5, '#08001a');
  block(ctx, 60, 28, 7, 5, '#08001a');
  p(ctx,48,30,gem); p(ctx,49,30,gemGlow); p(ctx,50,29,shade(gem,0.5));
  p(ctx,62,30,gem); p(ctx,63,30,gemGlow); p(ctx,64,29,shade(gem,0.5));
  // Long wispy beard
  for (let y = 36; y <= 56; y++) {
    const bw = Math.max(2, 12 - (y-36)/2);
    const bx = 52 - bw/2;
    noiseFill(ctx, Math.round(bx), y, Math.round(bw), 1, bone, y*3);
  }

  // Robe body — flowing, tattered
  for (let y = 40; y <= 126; y++) {
    const t = (y-40)/86;
    const w = 40 + t * 20;
    const x0 = 56 - w/2;
    const colors = t < 0.3 ? robe : t < 0.7 ? [...robe,...robeDk] : robeDk;
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, colors, y*13);
    // Tattered edges
    if (y > 110 && y%3===0) {
      p(ctx, Math.round(x0)-1, y, robeDk[y%3]);
      p(ctx, Math.round(x0+w)+1, y, robeDk[(y+1)%3]);
    }
  }
  // Robe folds
  for (let y = 50; y <= 120; y++) {
    p(ctx, 44, y, robeDk[y%3]);
    p(ctx, 56, y, robeDk[(y+1)%3]);
    p(ctx, 68, y, robeDk[y%3]);
  }
  // Rune symbols on robe
  const runeY = 70;
  [48,52,56,60,64].forEach((rx,i) => {
    p(ctx, rx, runeY+i%3, shade(gem, 0.4+i*0.1));
  });

  // Staff — gnarled wood
  for (let y = 8; y <= 120; y++) {
    const wobble = Math.sin(y*0.15) * 1.5;
    const sx = 90 + Math.round(wobble);
    p(ctx, sx, y, staff[y%3]);
    p(ctx, sx+1, y, staff[(y+1)%3]);
  }
  // Staff orb
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      if (dx*dx+dy*dy <= 36) {
        const dist = Math.sqrt(dx*dx+dy*dy)/6;
        p(ctx, 91+dx, 4+dy, mix(gemGlow, gem, dist));
      }
    }
  }

  // Casting hand (left) — skeletal
  noiseFill(ctx, 18, 58, 8, 6, skinDk, 17);
  // Magic particles
  p(ctx,14,56,gemGlow); p(ctx,16,54,gem); p(ctx,12,58,shade(gem,0.5));
  p(ctx,18,52,shade(gemGlow,0.6)); p(ctx,10,60,shade(gem,0.3));

  // Sleeve
  for (let y = 42; y <= 62; y++) {
    const t = (y-42)/20;
    p(ctx, 24-Math.floor(t*6), y, robe[y%robe.length]);
    p(ctx, 25-Math.floor(t*6), y, robe[(y+1)%robe.length]);
  }

  save(canvas, outPath);
}

// ============================================================
//  SHADOW CREEPER — Twisted, barely visible wraith
// ============================================================
function generateShadowCreeper(outPath) {
  const W = 96, H = 116;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const body = ['#0e0016','#120020','#0a000e','#10001a'];
  const bodyDk = ['#06000a','#080010','#040006'];
  const glow = '#9900dd';
  const glowHi = '#cc44ff';

  // Head — elongated, predatory
  roughBlock(ctx, 32, 8, 30, 18, body, 3);
  noiseFill(ctx, 34, 10, 26, 14, body, 5);
  // Eyes — large, glowing, unsettling
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++) {
      if (dx*dx+dy*dy <= 9) {
        const d = Math.sqrt(dx*dx+dy*dy)/3;
        p(ctx, 40+dx, 18+dy, mix(glowHi, glow, d));
        p(ctx, 56+dx, 18+dy, mix(glowHi, glow, d));
      }
    }
  // Eye glow bleed
  for (let i = 1; i <= 3; i++) {
    p(ctx,40,18-4-i,shade(glow,0.3-i*0.08));
    p(ctx,56,18-4-i,shade(glow,0.3-i*0.08));
  }

  // Body — thin, hunched, barely there
  for (let y = 26; y <= 60; y++) {
    const t = (y-26)/34;
    const w = 20 + Math.sin(t*Math.PI)*8;
    const x0 = 48 - w/2;
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, body, y*11);
  }
  // Spine protrusions
  for (let y = 28; y <= 55; y += 3) {
    p(ctx, 48, y, bodyDk[y%3]);
    p(ctx, 47, y+1, body[y%body.length]);
    p(ctx, 49, y+1, body[(y+1)%body.length]);
  }

  // Arms — incredibly long, thin, multi-jointed
  for (let y = 20; y <= 74; y++) {
    const t = (y-20)/54;
    const c = body[Math.floor(t*3)%body.length];
    // Left arm — reaching out
    const lx = 28 - Math.floor(t*16);
    p(ctx,lx,y,c); p(ctx,lx+1,y,shade(c,1.3)); p(ctx,lx+2,y,c);
    // Right arm
    const rx = 66 + Math.floor(t*12);
    p(ctx,rx,y,c); p(ctx,rx+1,y,shade(c,1.3)); p(ctx,rx+2,y,c);
  }
  // Claws — long curved talons
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 8; j++) {
      const c = mix(glow, '#1a0028', j/8);
      p(ctx, 8+i*2-j, 76+j, c);
      p(ctx, 82+i*2+j, 76+j, c);
    }
  }

  // Legs — spindly, digitigrade
  for (let y = 58; y <= 90; y++) {
    const t = (y-58)/32;
    const c = bodyDk[Math.floor(t*2)%bodyDk.length];
    p(ctx, 38-Math.floor(t*6), y, c); p(ctx, 39-Math.floor(t*6), y, body[y%body.length]);
    p(ctx, 56+Math.floor(t*6), y, c); p(ctx, 57+Math.floor(t*6), y, body[y%body.length]);
  }
  // Feet
  noiseFill(ctx, 26, 90, 12, 4, bodyDk, 33);
  noiseFill(ctx, 60, 90, 12, 4, bodyDk, 37);

  // Shadow wisps — ethereal trails
  const wisps = [[20,6],[72,4],[8,30],[84,26],[14,70],[80,68],[40,98],[56,96]];
  wisps.forEach(([wx,wy], i) => {
    for (let j = 0; j < 4; j++) {
      p(ctx, wx+j, wy+j, shade(body[j%body.length], 0.6));
    }
  });

  save(canvas, outPath);
}

// ============================================================
//  CHAIN GUARD — Hulking armored sentinel. Rusted metal, worn.
// ============================================================
function generateChainGuard(outPath) {
  const W = 120, H = 144;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const armor = ['#4a4e56','#444850','#525660','#3e4248'];
  const armorHi = ['#5e6270','#687080'];
  const armorDk = ['#2e3038','#282c34','#343840'];
  const rust = ['#5a3828','#4e3020','#6a4030'];
  const chain = ['#686e78','#5e6470','#747a84'];
  const shield = ['#3a4050','#444e60','#4e5868'];
  const shieldHi = ['#5e6878','#687888'];
  const gold = ['#8a7830','#7a6828','#9a8838'];
  const eye = '#aa1100';
  const wood = ['#3a2810','#2e200c','#44301a'];

  // Helmet — heavy, angular, visor down
  roughBlock(ctx, 36, 4, 48, 28, armor, 2);
  noiseFill(ctx, 38, 6, 44, 24, armor, 5);
  // Helmet crest
  noiseFill(ctx, 44, 2, 32, 4, armorHi, 3);
  // Visor slit
  noiseFill(ctx, 42, 16, 36, 8, ['#0a0404','#080202','#0c0606'], 7);
  // Eyes behind visor
  p(ctx,48,19,eye); p(ctx,49,19,'#cc2200'); p(ctx,50,18,shade(eye,0.5));
  p(ctx,68,19,eye); p(ctx,69,19,'#cc2200'); p(ctx,70,18,shade(eye,0.5));
  // Nose guard
  for (let y = 10; y <= 22; y++) p(ctx, 60, y, armorHi[y%2]);
  // Rust patches on helmet
  p(ctx,40,8,rust[0]); p(ctx,41,9,rust[1]); p(ctx,72,12,rust[2]);

  // Shoulders — massive pauldrons
  roughBlock(ctx, 8, 32, 24, 16, armor, 2);
  roughBlock(ctx, 88, 32, 24, 16, armor, 2);
  noiseFill(ctx, 10, 34, 20, 12, armor, 11);
  noiseFill(ctx, 90, 34, 20, 12, armor, 13);
  // Rivets
  [12,18,24].forEach(x => { p(ctx,x,38,gold[0]); p(ctx,x+72,38,gold[1]); });
  // Rust on shoulders
  noiseFill(ctx, 14, 40, 6, 4, rust, 17);

  // Chain mail torso
  for (let y = 32; y <= 72; y++) {
    noiseFill(ctx, 30, y, 60, 1, chain, y*7);
    // Chain link pattern
    if (y%3 === 0) {
      for (let x = 32; x <= 86; x += 4) p(ctx, x, y, armorHi[x%2]);
    }
  }
  // Leather over chainmail
  roughBlock(ctx, 36, 38, 20, 20, armorDk, 1);
  roughBlock(ctx, 62, 38, 20, 20, armorDk, 1);

  // Belt
  noiseFill(ctx, 30, 72, 60, 6, ['#3a2a14','#2e2010','#342414','#28180c'], 19);
  p(ctx,58,74,gold[0]); p(ctx,59,74,gold[1]); p(ctx,60,74,gold[2]);

  // Shield — battered, dented
  for (let y = 30; y <= 72; y++) {
    const t = (y-30)/42;
    const w = 18 - Math.abs(t-0.5)*12;
    noiseFill(ctx, 2, y, Math.round(w), 1, t<0.5 ? shieldHi : shield, y*5);
  }
  // Shield boss
  for (let dy = -3; dy <= 3; dy++)
    for (let dx = -3; dx <= 3; dx++)
      if (dx*dx+dy*dy <= 9) p(ctx, 10+dx, 52+dy, gold[(dx+dy+6)%3]);
  // Shield dent
  p(ctx,8,44,armorDk[0]); p(ctx,9,45,armorDk[1]); p(ctx,7,46,armorDk[2]);

  // Mace — right hand
  for (let y = 16; y <= 68; y++) p(ctx, 108, y, wood[y%3]);
  // Mace head — flanged
  roughBlock(ctx, 104, 8, 10, 12, armor, 1);
  noiseFill(ctx, 105, 9, 8, 10, armorHi, 23);
  // Flanges
  p(ctx,103,8,chain[0]); p(ctx,114,8,chain[1]);
  p(ctx,103,19,chain[2]); p(ctx,114,19,chain[0]);

  // Legs — greaves
  for (let y = 78; y <= 120; y++) {
    const t = (y-78)/42;
    const c = armor[Math.floor(t*3)%armor.length];
    noiseFill(ctx, 38, y, 14, 1, [c, shade(c,0.85)], y*3);
    noiseFill(ctx, 66, y, 14, 1, [c, shade(c,0.85)], y*7);
  }
  // Knee guards
  noiseFill(ctx, 40, 96, 10, 4, armorHi, 27);
  noiseFill(ctx, 68, 96, 10, 4, armorHi, 29);

  // Boots
  noiseFill(ctx, 34, 120, 20, 8, armorDk, 31);
  noiseFill(ctx, 62, 120, 20, 8, armorDk, 33);

  save(canvas, outPath);
}

// ============================================================
//  FLAME WEAVER — Burning cultist. Embers, charred robes.
// ============================================================
function generateFlameWeaver(outPath) {
  const W = 112, H = 136;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const robe = ['#5a2200','#4e1a00','#662a00','#421400'];
  const robeDk = ['#2e0e00','#220800','#1a0400'];
  const skin = ['#884400','#7a3a00','#994e00'];
  const flame1 = ['#ff6600','#ee5500','#ff7722'];
  const flame2 = ['#ffaa00','#ff9900','#ffbb22'];
  const flame3 = ['#ffdd44','#ffcc22','#ffee66'];
  const white = '#ffffaa';
  const char = ['#1a1008','#221810','#140c04'];

  // Flame crown — flickering, organic
  for (let i = 0; i < 30; i++) {
    const fx = 30 + i * 1.8;
    const fh = 8 + Math.sin(i*1.3)*6 + Math.cos(i*0.7)*4;
    for (let fy = 0; fy < fh; fy++) {
      const t = fy/fh;
      const c = t < 0.3 ? flame3[i%3] : t < 0.6 ? flame2[i%3] : flame1[i%3];
      p(ctx, Math.round(fx), 14-Math.round(fy), c);
    }
  }

  // Head — charred, glowing cracks
  roughBlock(ctx, 38, 14, 36, 22, skin, 2);
  noiseFill(ctx, 40, 16, 32, 18, [...skin,...char], 9);
  // Eyes — white-hot
  block(ctx, 46, 22, 6, 4, '#331100');
  block(ctx, 62, 22, 6, 4, '#331100');
  p(ctx,48,23,white); p(ctx,49,24,flame3[0]); p(ctx,50,23,flame2[0]);
  p(ctx,64,23,white); p(ctx,65,24,flame3[1]); p(ctx,66,23,flame2[1]);
  // Mouth — inner glow
  noiseFill(ctx, 50, 30, 12, 3, [...char, flame1[0]], 11);

  // Robe — charred, burning edges
  for (let y = 34; y <= 126; y++) {
    const t = (y-34)/92;
    const w = 36 + t * 16;
    const x0 = 56 - w/2;
    const colors = t < 0.3 ? robe : t < 0.6 ? [...robe,...robeDk] : [...robeDk,...char];
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, colors, y*13);
    // Burning edges
    if (y > 100) {
      const edgeC = flame1[y%3];
      p(ctx, Math.round(x0), y, edgeC);
      p(ctx, Math.round(x0+w), y, edgeC);
      if (y%4===0) p(ctx, Math.round(x0)-1, y, flame2[y%3]);
    }
  }
  // Ember spots on robe
  const embers = [[44,50],[68,46],[52,62],[64,58],[48,78],[70,74],[40,90],[72,86]];
  embers.forEach(([ex,ey],i) => {
    p(ctx,ex,ey,flame1[i%3]); p(ctx,ex+1,ey,flame2[i%3]);
  });

  // Arms with fire orbs
  for (let y = 38; y <= 66; y++) {
    const t = (y-38)/28;
    const c = robe[Math.floor(t*3)%robe.length];
    p(ctx,20,y,c); p(ctx,21,y,shade(c,1.1)); p(ctx,22,y,c);
    p(ctx,88,y,c); p(ctx,89,y,shade(c,1.1)); p(ctx,90,y,c);
  }

  // Fire orbs — swirling flames
  for (let dy = -8; dy <= 8; dy++)
    for (let dx = -8; dx <= 8; dx++) {
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d <= 8) {
        const t = d/8;
        const c = t < 0.3 ? white : t < 0.5 ? flame3[0] : t < 0.7 ? flame2[0] : flame1[0];
        p(ctx, 10+dx, 66+dy, c);
        p(ctx, 100+dx, 66+dy, c);
      }
    }
  // Flame wisps above orbs
  for (let i = 0; i < 6; i++) {
    p(ctx, 8+i, 56-i*2, flame2[i%3]);
    p(ctx, 98+i, 56-i*2, flame1[i%3]);
  }

  // Floating embers
  const sparks = [[16,10],[96,8],[8,30],[102,26],[24,100],[86,96],[50,6],[66,4]];
  sparks.forEach(([sx,sy],i) => {
    p(ctx,sx,sy,flame2[i%3]); p(ctx,sx+1,sy-1,flame3[i%3]);
  });

  save(canvas, outPath);
}

// ============================================================
//  BOSSES — Larger canvas (144x168 grid at PX=4 = 576x672)
// ============================================================

function generateBossChainMaster(outPath) {
  const W = 132, H = 156;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const armor = ['#4a5060','#444a58','#525868','#3e4450'];
  const armorHi = ['#6a7080','#747a8a'];
  const armorDk = ['#2a3038','#242830'];
  const chain = ['#7a8090','#6e7484','#868c9a'];
  const gold = ['#aa8828','#9a7820','#ba9838'];
  const eye = '#cc0000';
  const chainLink = ['#8898a8','#7e8e9e','#96a6b6'];

  // Horned helmet
  for (let i = 0; i < 16; i++) {
    p(ctx,24-i,8-Math.floor(i*0.6), armor[i%4]);
    p(ctx,25-i,8-Math.floor(i*0.6), armorHi[i%2]);
    p(ctx,108+i,8-Math.floor(i*0.6), armor[i%4]);
    p(ctx,107+i,8-Math.floor(i*0.6), armorHi[i%2]);
  }

  // Massive helmet
  roughBlock(ctx, 36, 6, 60, 32, armor, 2);
  noiseFill(ctx, 38, 8, 56, 28, armor, 5);
  noiseFill(ctx, 40, 8, 52, 10, armorHi, 7);
  // Crown
  noiseFill(ctx, 44, 6, 44, 3, gold, 9);
  // Visor
  noiseFill(ctx, 44, 20, 44, 10, ['#080404','#0a0606','#060202'], 11);
  p(ctx,52,24,eye); p(ctx,53,24,'#ff2200'); p(ctx,54,23,shade(eye,0.4));
  p(ctx,76,24,eye); p(ctx,77,24,'#ff2200'); p(ctx,78,23,shade(eye,0.4));

  // Massive body with chain armor
  for (let y = 38; y <= 100; y++) {
    noiseFill(ctx, 26, y, 80, 1, chain, y*7);
    if (y%3===0) for (let x = 28; x <= 102; x+=4) p(ctx,x,y,armorHi[x%2]);
  }
  // Shoulder plates
  roughBlock(ctx, 10, 38, 20, 18, armor, 2);
  roughBlock(ctx, 102, 38, 20, 18, armor, 2);
  noiseFill(ctx, 12, 40, 16, 14, armorHi, 13);
  noiseFill(ctx, 104, 40, 16, 14, armorHi, 15);
  [14,20,26].forEach(x => { p(ctx,x,44,gold[0]); p(ctx,x+92,44,gold[1]); });

  // Hanging chains from shoulders
  for (let y = 56; y <= 80; y+=2) {
    [12,18,24].forEach(x => p(ctx,x,y,chainLink[y%3]));
    [108,114,120].forEach(x => p(ctx,x,y,chainLink[(y+1)%3]));
  }

  // Belt + chain decorations
  noiseFill(ctx, 26, 98, 80, 6, ['#3a2a14','#2e2010','#342414'], 17);
  for (let x = 30; x <= 100; x+=5) p(ctx,x,100,chainLink[x%3]);

  // Chain whip (right hand) — links trailing
  for (let i = 0; i < 20; i++) {
    const cx = 122 + Math.sin(i*0.6)*4;
    const cy = 50 + i*3;
    p(ctx, Math.round(cx), cy, chainLink[i%3]);
    p(ctx, Math.round(cx)+1, cy+1, chain[i%chain.length]);
  }

  // Legs
  for (let y = 104; y <= 140; y++) {
    const t = (y-104)/36;
    noiseFill(ctx, 38, y, 16, 1, armor, y*3);
    noiseFill(ctx, 76, y, 16, 1, armor, y*7);
  }
  noiseFill(ctx, 40, 116, 12, 4, armorHi, 27);
  noiseFill(ctx, 78, 116, 12, 4, armorHi, 29);

  // Boots
  noiseFill(ctx, 34, 140, 24, 8, armorDk, 31);
  noiseFill(ctx, 72, 140, 24, 8, armorDk, 33);

  save(canvas, outPath);
}

function generateBossCeremonyMaster(outPath) {
  const W = 132, H = 156;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const robe = ['#1e0030','#220038','#180028','#2a0042'];
  const robeDk = ['#0e0018','#100020','#0a0010'];
  const skin = ['#4a2868','#3e2058','#563078'];
  const gem = '#cc44ff';
  const gemDk = '#8822aa';
  const fire = ['#ff6600','#ffaa00','#ff8800'];
  const staff = ['#3a2810','#2e200c','#44301a'];
  const gold = ['#aa8828','#9a7820'];

  // Tall headdress
  for (let y = 0; y < 14; y++) {
    const w = 8 + y;
    noiseFill(ctx, 66-w/2, y, w, 1, robe, y*7);
  }
  p(ctx,64,2,fire[0]); p(ctx,65,1,fire[1]); p(ctx,66,0,fire[2]);

  // Hood
  roughBlock(ctx, 40, 12, 52, 16, robe, 2);
  noiseFill(ctx, 42, 14, 48, 12, robe, 9);

  // Face — angular, sickly purple
  noiseFill(ctx, 48, 18, 36, 20, skin, 11);
  // Glowing orange eyes
  block(ctx, 54, 26, 8, 5, '#0a0008');
  block(ctx, 72, 26, 8, 5, '#0a0008');
  p(ctx,56,28,fire[0]); p(ctx,57,28,fire[1]); p(ctx,58,27,'#ffcc00');
  p(ctx,74,28,fire[0]); p(ctx,75,28,fire[1]); p(ctx,76,27,'#ffcc00');

  // Ritual robe — floor-length, flowing
  for (let y = 36; y <= 148; y++) {
    const t = (y-36)/112;
    const w = 50 + t * 24;
    const x0 = 66 - w/2;
    const colors = t < 0.2 ? robe : t < 0.6 ? [...robe,...robeDk] : robeDk;
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, colors, y*13);
  }
  // Pentagram symbol on chest
  const pcx = 66, pcy = 60;
  [[0,-8],[8,-3],[-8,-3],[5,7],[-5,7]].forEach(([dx,dy],i) => {
    p(ctx,pcx+dx,pcy+dy,gem);
    p(ctx,pcx+dx+1,pcy+dy,gemDk);
  });
  // Connecting lines
  for (let i = 0; i < 5; i++) {
    const a1 = i * Math.PI * 2 / 5 - Math.PI/2;
    const a2 = ((i+2)%5) * Math.PI * 2 / 5 - Math.PI/2;
    for (let t = 0; t <= 1; t += 0.1) {
      const lx = pcx + Math.round(Math.cos(a1)*8 + (Math.cos(a2)-Math.cos(a1))*8*t);
      const ly = pcy + Math.round(Math.sin(a1)*8 + (Math.sin(a2)-Math.sin(a1))*8*t);
      p(ctx, lx, ly, shade(gem, 0.5));
    }
  }

  // Staff — ritual, with skull
  for (let y = 10; y <= 140; y++) {
    const wobble = Math.sin(y*0.1)*1;
    p(ctx, 110+Math.round(wobble), y, staff[y%3]);
    p(ctx, 111+Math.round(wobble), y, staff[(y+1)%3]);
  }
  // Skull atop staff
  noiseFill(ctx, 106, 4, 10, 8, ['#c8b8a0','#b8a890','#d0c0a8'], 19);
  block(ctx, 108, 6, 3, 2, '#1a0808');
  block(ctx, 113, 6, 3, 2, '#1a0808');
  p(ctx,109,7,gem); p(ctx,114,7,gem);

  // Casting hand with magic
  noiseFill(ctx, 16, 56, 10, 6, skin, 21);
  // Magic circle
  for (let a = 0; a < Math.PI*2; a += 0.3) {
    const mx = 20 + Math.round(Math.cos(a)*10);
    const my = 58 + Math.round(Math.sin(a)*10);
    p(ctx, mx, my, gem);
  }

  save(canvas, outPath);
}

function generateBossShadowCouncillor(outPath) {
  const W = 132, H = 156;
  const canvas = createCanvas(W*PX, H*PX);
  const ctx = canvas.getContext('2d');

  const cloak = ['#060606','#0a0a0a','#040404','#080808'];
  const cloakDk = ['#020202','#030303','#010101'];
  const red = '#cc0000';
  const redDk = '#440000';
  const redGlow = '#ff2222';

  // Hood — massive, void-like
  roughBlock(ctx, 34, 6, 64, 24, cloak, 3);
  noiseFill(ctx, 36, 8, 60, 20, cloak, 5);

  // Face — pure void with eyes
  noiseFill(ctx, 42, 16, 48, 18, cloakDk, 7);
  // Eyes — large, burning red, terrifying
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d <= 5) {
        const t = d/5;
        p(ctx, 52+dx, 26+dy, t < 0.3 ? redGlow : t < 0.6 ? red : redDk);
        p(ctx, 78+dx, 26+dy, t < 0.3 ? redGlow : t < 0.6 ? red : redDk);
      }
    }
  // Red veins from eyes
  for (let i = 1; i <= 8; i++) {
    p(ctx,46-i,28+i, shade(redDk, 1-i*0.1));
    p(ctx,84+i,28+i, shade(redDk, 1-i*0.1));
    p(ctx,52,32+i, shade(redDk, 1-i*0.08));
    p(ctx,78,32+i, shade(redDk, 1-i*0.08));
  }

  // Cloak body — massive, formless
  for (let y = 30; y <= 148; y++) {
    const t = (y-30)/118;
    const w = 60 + Math.sin(t*Math.PI)*20;
    const x0 = 66 - w/2;
    noiseFill(ctx, Math.round(x0), y, Math.round(w), 1, t < 0.5 ? cloak : cloakDk, y*11);
    // Red energy veins (sparse)
    if (y%7===0) {
      p(ctx, Math.round(x0+w*0.2), y, redDk);
      p(ctx, Math.round(x0+w*0.8), y, redDk);
    }
  }

  // Shadow tendrils — arms
  for (let y = 34; y <= 76; y++) {
    const t = (y-34)/42;
    const c = cloak[Math.floor(t*3)%cloak.length];
    // Left tendril
    const lx = 28 - Math.floor(t*18);
    for (let dx = 0; dx < 4; dx++) p(ctx, lx+dx, y, shade(c, 1+dx*0.1));
    // Right tendril
    const rx = 100 + Math.floor(t*14);
    for (let dx = 0; dx < 4; dx++) p(ctx, rx+dx, y, shade(c, 1+dx*0.1));
  }
  // Tendril tips — red energy
  p(ctx,6,78,red); p(ctx,7,79,redGlow); p(ctx,8,80,red);
  p(ctx,118,78,red); p(ctx,119,79,redGlow); p(ctx,120,80,red);

  // Wisps dissipating at bottom
  for (let y = 140; y <= 154; y++) {
    for (let i = 0; i < 8; i++) {
      const wx = 30 + i*12 + Math.sin(y*0.5+i)*4;
      p(ctx, Math.round(wx), y, cloakDk[y%3]);
    }
  }

  // Floating dark particles
  const particles = [[20,10],[110,8],[12,50],[118,46],[26,90],[104,88],[40,130],[90,132]];
  particles.forEach(([px,py],i) => {
    p(ctx,px,py,cloak[i%cloak.length]);
    p(ctx,px+1,py+1,cloakDk[i%cloakDk.length]);
  });

  save(canvas, outPath);
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

console.log('\nAll old-school dark medieval sprites generated!');
