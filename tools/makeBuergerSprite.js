// tools/makeBuergerSprite.js — macht aus dem Roh-Render (weisser Hintergrund)
// ein spielfertiges NPC-Sprite: Weiss/Nebel -> transparent, auf Inhalt
// zugeschnitten, auf ~153px Breite skaliert (wie assets/sprites/setzer_thom.png).
//
// Aufruf:  node tools/makeBuergerSprite.js [input] [output]
//   input  default: assets/sprites/buerger_raw.png
//   output default: assets/sprites/buerger.png
//
// Braucht `sharp` (liegt bereits in node_modules).
const sharp = require('sharp');
const path = require('path');

const IN = process.argv[2] || 'assets/sprites/buerger_raw.png';
const OUT = process.argv[3] || 'assets/sprites/buerger.png';
const TARGET_W = 153; // = setzer_thom.png Breite

(async function () {
  const src = sharp(path.resolve(IN));
  const { data, info } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Hintergrund entfernen: near-weiss/grau -> transparent, mit weichem Rampen-
  // Uebergang fuer saubere Kanten. Die Figur ist dunkelbraun (min-Kanal niedrig),
  // also bleibt sie erhalten.
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    const nearNeutral = (mx - mn) < 16;      // weiss/grau, nicht farbig
    if (nearNeutral && mn >= 232) {
      data[i + 3] = 0;                        // voll transparent
    } else if (nearNeutral && mn >= 208) {
      // weicher Rand: 208..232 linear ausblenden
      const a = Math.round(((mn - 208) / (232 - 208)) * 255);
      data[i + 3] = Math.min(data[i + 3], 255 - a);
    }
  }

  const cut = sharp(data, { raw: { width, height, channels } }).png();
  // trim() schneidet die jetzt transparenten Raender weg; dann auf Zielbreite.
  await cut
    .trim()
    .resize({ width: TARGET_W })
    .toFile(path.resolve(OUT));

  const meta = await sharp(path.resolve(OUT)).metadata();
  console.log('geschrieben:', OUT, meta.width + 'x' + meta.height, 'colorType RGBA(6)=', meta.channels === 4);
})().catch((e) => { console.error('Fehler:', e.message); process.exit(1); });
