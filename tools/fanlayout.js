// Ring-Layout generator + collision/fit verifier for the mobile ability
// cluster. Mirrors js/mobileControls.js:_fanLayout() 1:1 (same
// constants/formulas) — re-run this after touching that geometry. Game
// renders at fixed 960x480 (Phaser FIT); we verify spacing & bounds across
// button scales and safe-area insets.

const BASE_RADIUS = 38, CORNER_PAD = 20, MIN_HIT_HALF = 22;
const PRIMAR_FACTOR = 1.9 * 0.9, RING_FACTOR = 0.9, TRANK_FACTOR = 1.0;
const CORNER_INSET_X = 50, CORNER_INSET_Y = 15;
const RING_GAP = 12, RING_ARC_START = 40, TRANK_GAP = 4, TRANK_EDGE_PAD = 4;

function computeLayout(screenW, screenH, scale, sa) {
  const BR = BASE_RADIUS * scale;
  const PR = BR * PRIMAR_FACTOR;
  const RR = BR * RING_FACTOR;
  const TR = BR * TRANK_FACTOR;
  const G = RING_GAP * scale;
  const Cx = screenW - (CORNER_PAD + (sa.right || 0));
  const Cy = screenH - (CORNER_PAD + (sa.bottom || 0));
  const Px = Cx - PR - CORNER_INSET_X * scale;
  const Py = Cy - PR - CORNER_INSET_Y * scale;

  const out = [];
  out.push({ key: 'primar', x: Px, y: Py, r: PR });

  const Rr = PR + RR + G;
  const chord = 2 * RR + G;
  const dBeta = 2 * Math.asin(Math.min(1, chord / (2 * Rr)));
  const start = RING_ARC_START * Math.PI / 180;
  const ringKeys = ['dash', 'S1', 'S2', 'S3', 'S4'];
  const ringY = [];
  for (let k = 0; k < ringKeys.length; k++) {
    const th = start + k * dBeta;
    const rx = Px + Rr * Math.cos(th);
    const ry = Py - Rr * Math.sin(th);
    out.push({ key: ringKeys[k], x: rx, y: ry, r: RR });
    ringY.push(ry);
  }

  const minRingY = Math.min(ringY[0], ringY[1]);
  out.push({
    key: 'trank',
    x: Cx - TR - TRANK_EDGE_PAD * scale,
    y: minRingY - TR - RR - TRANK_GAP * scale,
    r: TR,
  });
  return out;
}

function verify(label, screenW, screenH, scale, sa) {
  const L = computeLayout(screenW, screenH, scale, sa);
  const problems = [];
  let minGap = Infinity, minPair = '';
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const gap = d - (a.r + b.r);
    if (gap < minGap) { minGap = gap; minPair = a.key + '-' + b.key; }
    if (gap < -0.5) problems.push(`OVERLAP ${a.key}-${b.key} gap=${gap.toFixed(1)}`);
  }
  L.forEach(o => {
    if (o.x - o.r < 6) problems.push(`${o.key} off-left x=${(o.x - o.r).toFixed(1)}`);
    if (o.x + o.r > screenW - 6) problems.push(`${o.key} off-right x=${(o.x + o.r).toFixed(1)}`);
    if (o.y - o.r < 40) problems.push(`${o.key} too-high (HUD) y=${(o.y - o.r).toFixed(1)}`);
    if (o.y + o.r > screenH - 6) problems.push(`${o.key} off-bottom y=${(o.y + o.r).toFixed(1)}`);
    if (Math.max(MIN_HIT_HALF, o.r) < 22) problems.push(`${o.key} tap-target<44px`);
  });
  console.log(`\n=== ${label} (scale=${scale}, sa.right=${sa.right || 0}, sa.bottom=${sa.bottom || 0}) ===`);
  L.forEach(o => console.log(`  ${o.key.padEnd(7)} x=${o.x.toFixed(0)} y=${o.y.toFixed(0)} r=${o.r.toFixed(0)}`));
  console.log(`  minGap=${minGap.toFixed(1)} (${minPair})`);
  console.log(problems.length ? '  PROBLEMS: ' + problems.join(' | ') : '  OK');
  return problems.length === 0;
}

let ok = true;
ok &= verify('default', 960, 480, 1.0, {});
ok &= verify('big', 960, 480, 1.2, {});
ok &= verify('small', 960, 480, 0.8, {});
ok &= verify('notch-right', 960, 480, 1.0, { right: 44 });
ok &= verify('big+notch', 960, 480, 1.2, { right: 44, bottom: 24 });
console.log('\nALL OK:', !!ok);
