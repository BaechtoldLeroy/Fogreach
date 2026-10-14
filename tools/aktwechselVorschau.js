/**
 * tools/aktwechselVorschau.js — Standbild je Akt-Zwischenszene nach vorschau/
 * headless gerendert. Nicht Teil des Spiels.
 *
 * Tableaus: assets/sprites/aktwechsel/aktwechsel_<aktId>.png, je ein
 * PixelLab-Bild (create_image_pro, 384x192) — unbearbeitet uebernommen.
 *
 *   node tools/aktwechselVorschau.js [en]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { launch } = require('./headless/index.js');

(async () => {
  const lang = process.argv[2] === 'en' ? 'en' : 'de';
  const ziel = path.join(__dirname, '..', 'vorschau');
  fs.mkdirSync(ziel, { recursive: true });
  const H = await launch({ search: '?autostart=1&debug=1', renderer: 'canvas', waitFor: 'StartScene' });
  try {
    if (!await H.waitForScene('HubSceneV2', { maxRounds: 250 })) throw new Error('Hub nicht erreicht');
    H.step(10);
    if (lang === 'en') H.run(`window.i18n.setLanguage('en')`);
    for (const n of ['1', '2', '3', '4', '5', 'epilog']) {
      H.run(`(function () { var sc = window.game.scene.getScene('HubSceneV2');
        window.__ov = window.storySystem.showStoryOverlay(sc, window.storySystem.probeEreignis('${n}'), function () {}); })()`);
      // Schwenk ein Stueck laufen lassen, bis der Text eingeblendet ist.
      for (let i = 0; i < 12; i++) { H.step(20); await new Promise((r) => setTimeout(r, 0)); }
      const datei = path.join(ziel, 'aktwechsel_' + n + (lang === 'en' ? '_en' : '') + '.png');
      fs.writeFileSync(datei, H.window.game.canvas.toBuffer('image/png'));
      console.log(datei, H.run('window.__ov.neu ? "neu" : "alt"'), H.run('window.__ov.seiten.length'));
      H.run('window.__ov.ueberspringen ? window.__ov.ueberspringen() : null');
      H.step(2);
    }
  } finally { await H.shutdown(); }
})().catch((e) => { console.error(e); process.exit(1); });
