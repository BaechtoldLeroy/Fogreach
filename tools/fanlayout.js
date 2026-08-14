// Polar "Daumen-Bogen" layout generator + collision/fit verifier.
// Game renders at fixed 960x480 (Phaser FIT). We verify spacing & bounds
// across button scales and safe-area insets.

function computeLayout(screenW, screenH, scale, sa) {
  const BR = 38 * scale;
  const PR = BR * 1.26;          // primär bigger
  const G  = 12 * scale;         // desired edge gap between neighbours
  const padR = 20 + (sa.right || 0);
  const padB = 20 + (sa.bottom || 0);
  const Cx = screenW - padR;
  const Cy = screenH - padB;

  const out = [];
  // Primär: hugs corner
  const primar = { key:'primar', x: Cx - PR, y: Cy - PR, r: PR };
  out.push(primar);

  // Dash: left of primär, bottom-aligned
  const dGap = PR + BR + G;
  out.push({ key:'dash', x: primar.x - dGap, y: Cy - BR, r: BR });

  // Skills: arc centred on corner C, guaranteed equal chord = 2BR+G
  const step = 2 * BR + G;
  const Rs = 250 * scale;                     // arc radius (tuning knob)
  const dBeta = 2 * Math.asin(step / (2 * Rs));
  const betaBottom = 68 * Math.PI / 180;      // bottom skill angle from vertical (tuning knob)
  const skills = [];
  for (let k = 0; k < 4; k++) {
    const beta = betaBottom - k * dBeta;      // upward = smaller beta
    const x = Cx - Rs * Math.sin(beta);
    const y = Cy - Rs * Math.cos(beta);
    const s = { key:'S'+(k+1), x, y, r: BR, beta: beta*180/Math.PI };
    skills.push(s); out.push(s);
  }

  // Trank: set apart up-left, on the mid-ray between S1 and S2 but one step
  // further out (higher-left) so it clears the fan and always fits vertically.
  const betaTrank = betaBottom - 0.5 * dBeta;  // between S1 and S2
  const Rt = Rs + step;
  out.push({ key:'trank', x: Cx - Rt * Math.sin(betaTrank), y: Cy - Rt * Math.cos(betaTrank), r: BR });

  return out;
}

function verify(label, screenW, screenH, scale, sa) {
  const L = computeLayout(screenW, screenH, scale, sa);
  const problems = [];
  // pairwise gaps
  let minGap = Infinity, minPair = '';
  for (let i=0;i<L.length;i++) for (let j=i+1;j<L.length;j++){
    const a=L[i],b=L[j];
    const d=Math.hypot(a.x-b.x,a.y-b.y);
    const gap=d-(a.r+b.r);
    if(gap<minGap){minGap=gap;minPair=a.key+'-'+b.key;}
    if(gap < -0.5) problems.push(`OVERLAP ${a.key}-${b.key} gap=${gap.toFixed(1)}`);
  }
  // bounds (must stay fully on 0..W / 0..H, keep 6px margin)
  L.forEach(o=>{
    if(o.x-o.r < 6) problems.push(`${o.key} off-left x=${(o.x-o.r).toFixed(1)}`);
    if(o.x+o.r > screenW-6) problems.push(`${o.key} off-right x=${(o.x+o.r).toFixed(1)}`);
    if(o.y-o.r < 40) problems.push(`${o.key} too-high (HUD) y=${(o.y-o.r).toFixed(1)}`);
    if(o.y+o.r > screenH-6) problems.push(`${o.key} off-bottom y=${(o.y+o.r).toFixed(1)}`);
  });
  console.log(`\n=== ${label} (scale=${scale}, sa.right=${sa.right||0}, sa.bottom=${sa.bottom||0}) ===`);
  L.forEach(o=>console.log(`  ${o.key.padEnd(7)} x=${o.x.toFixed(0)} y=${o.y.toFixed(0)} r=${o.r.toFixed(0)}${o.beta?' β='+o.beta.toFixed(1):''}`));
  console.log(`  minGap=${minGap.toFixed(1)} (${minPair})`);
  console.log(problems.length? '  PROBLEMS: '+problems.join(' | ') : '  OK');
  return problems.length===0;
}

let ok = true;
ok &= verify('default',      960,480,1.0,{});
ok &= verify('big',          960,480,1.2,{});
ok &= verify('small',        960,480,0.8,{});
ok &= verify('notch-right',  960,480,1.0,{right:44});
ok &= verify('big+notch',    960,480,1.2,{right:44,bottom:24});
console.log('\nALL OK:', !!ok);
