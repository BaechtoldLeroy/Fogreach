// tools/makeBuergerSprite.js — Roh-Render -> spielfertiges NPC-Sprite.
//
// Ansatz (robust gegen entsaettigte Figur vor Vignette-Hintergrund):
//   1. Figuren-Maske = "warm getoent" (R deutlich > B). Der Hintergrund
//      (schwarz -> graues Halo) ist neutral, die Figur durchgaengig warm.
//   2. Morphologisch SCHLIESSEN (dilate+erode), um duenne neutrale Risse im
//      Stoff zu ueberbruecken -> geschlossene Silhouette.
//   3. LOECHER FUELLEN: neutrale Stoffstellen INNERHALB der Silhouette (nicht
//      mit dem Rand verbunden) zaehlen zur Figur.
//   4. GROESSTE Komponente behalten -> streut warme Reste im Hintergrund weg.
//   5. Alpha aus der Maske, weiche Kante, trim, auf 153px skalieren (wie Thom).
//
// Aufruf:  node tools/makeBuergerSprite.js [input] [output]
const sharp = require('sharp');
const path = require('path');

const IN = process.argv[2] || 'reference/buerger_raw.png';
const OUT = process.argv[3] || 'assets/sprites/buerger.png';
const TARGET_W = 153;

(async function () {
  const { data, info } = await sharp(path.resolve(IN)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const N = W * H;
  const at = (x, y) => (y * W + x) * C;

  // 1. Warme Figuren-Maske.
  const fig = new Uint8Array(N);
  for (let i = 0, p = 0; i < N; i++, p += C) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const warm = (r - b) >= 10 && r > 34;          // warm & nicht tiefschwarz
    const white = Math.min(r, g, b) > 236;          // weisse Variante = Hintergrund
    fig[i] = (warm && !white) ? 1 : 0;
  }

  // Morphologie-Helfer (Radius 1, 4-Nachbarschaft, mehrfach anwendbar).
  function morph(src, grow, iters) {
    let a = src;
    for (let t = 0; t < iters; t++) {
      const b = new Uint8Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = a[i];
        const nb = a[i] ? 0 : 1;                     // dilate sucht 1en, erode sucht 0en
        if (a[i] !== grow) {
          if ((x > 0 && a[i - 1] === grow) || (x < W - 1 && a[i + 1] === grow) ||
              (y > 0 && a[i - W] === grow) || (y < H - 1 && a[i + W] === grow)) v = grow;
        }
        b[i] = v;
      }
      a = b;
    }
    return a;
  }
  // 2. Schliessen = dilate dann erode (Radius ~5) — bruecke zerlumpte Kanten.
  let mask = morph(fig, 1, 5);   // dilate
  mask = morph(mask, 0, 5);      // erode

  // 3. Loecher fuellen: markiere "aussen" (0 vom Rand aus zusammenhaengend),
  //    alle uebrigen 0 sind eingeschlossen -> zur Figur.
  const outside = new Uint8Array(N);
  const st = [];
  for (let x = 0; x < W; x++) { if (!mask[x]) { outside[x] = 1; st.push(x); } const j = (H - 1) * W + x; if (!mask[j]) { outside[j] = 1; st.push(j); } }
  for (let y = 0; y < H; y++) { const l = y * W; if (!mask[l]) { outside[l] = 1; st.push(l); } const r = l + W - 1; if (!mask[r]) { outside[r] = 1; st.push(r); } }
  while (st.length) {
    const i = st.pop(), x = i % W, y = (i / W) | 0;
    const nb = [i - 1, i + 1, i - W, i + W];
    const ok = [x > 0, x < W - 1, y > 0, y < H - 1];
    for (let k = 0; k < 4; k++) { if (ok[k] && !mask[nb[k]] && !outside[nb[k]]) { outside[nb[k]] = 1; st.push(nb[k]); } }
  }
  for (let i = 0; i < N; i++) if (!mask[i] && !outside[i]) mask[i] = 1;

  // 4. Groesste zusammenhaengende Komponente behalten.
  const comp = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0;
  for (let s = 0; s < N; s++) {
    if (!mask[s] || comp[s] !== -1) continue;
    const q = [s]; comp[s] = s; let size = 0; let head = 0;
    while (head < q.length) {
      const i = q[head++]; size++;
      const x = i % W, y = (i / W) | 0;
      const nb = [i - 1, i + 1, i - W, i + W];
      const ok = [x > 0, x < W - 1, y > 0, y < H - 1];
      for (let k = 0; k < 4; k++) { const j = nb[k]; if (ok[k] && mask[j] && comp[j] === -1) { comp[j] = s; q.push(j); } }
    }
    if (size > bestSize) { bestSize = size; best = s; }
  }
  for (let i = 0; i < N; i++) mask[i] = (comp[i] === best) ? 1 : 0;

  // 5. Alpha aus Maske; weiche 1px-Kante (Nachbar-Mittel), dann anwenden.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = at(x, y);
    let a = mask[i] ? 255 : 0;
    if (mask[i]) {
      const edge = (x > 0 && !mask[i - 1]) || (x < W - 1 && !mask[i + 1]) ||
                   (y > 0 && !mask[i - W]) || (y < H - 1 && !mask[i + W]);
      if (edge) a = 170;
    }
    data[p + 3] = a;
  }

  await sharp(data, { raw: { width: W, height: H, channels: C } }).png()
    .trim().resize({ width: TARGET_W }).toFile(path.resolve(OUT));

  const meta = await sharp(path.resolve(OUT)).metadata();
  console.log('geschrieben:', OUT, meta.width + 'x' + meta.height, '| Figur:', ((bestSize / N) * 100).toFixed(1) + '%');
})().catch((e) => { console.error('Fehler:', e.message); process.exit(1); });
