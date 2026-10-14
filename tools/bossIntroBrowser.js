/**
 * tools/bossIntroBrowser.js — Boss-Zwischenszenen im ECHTEN Browser (WebGL)
 * fotografieren: Auftritt, Plakette, Rede, je Boss. Der Canvas-Testkopf
 * zeichnet Nebel und Licht nicht wie das Spiel; was der Spieler sieht,
 * zeigt nur Chromium mit WebGL.
 *
 *   npx http-server -p 8080 -c-1 -s .      (im Repo, eigener Prozess)
 *   node tools/bossIntroBrowser.js [kettenmeister ...] [--breite 1670 --hoehe 833]
 *
 * Bilder: vorschau/bossintro_browser_<boss>_<phase>.png (nicht committen).
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const BREITE = +opt('breite', 1670), HOEHE = +opt('hoehe', 833);
const PORT = opt('port', '8080');
const BOSSE = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const LISTE = BOSSE.length ? BOSSE : ['kettenmeister', 'zeremonienmeister', 'schattenrat', 'elara'];
const ZIEL = path.join(__dirname, '..', 'vorschau');
fs.mkdirSync(ZIEL, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  for (const boss of LISTE) {
    const page = await browser.newPage({ viewport: { width: BREITE, height: HOEHE } });
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => {
      try { localStorage.setItem('demonfall_audio', JSON.stringify({ master: 0, sfx: 0, music: 0, muted: true })); } catch (e) {}
    });
    await page.goto(`http://127.0.0.1:${PORT}/?debug=1&dungeon=1&boss=${boss}&bossintro=neu`, { waitUntil: 'load' });
    const phase = () => page.evaluate(() => {
      const g = window.game; const s = g && g.scene.getScene('GameScene');
      const z = s && s.__bossZwischenszene;
      return z ? z.phase + ':' + z.seite : (s && s.sys.isActive() ? 'spiel' : 'laden');
    }).catch(() => 'laden');
    // Elara: das Finale an der Quelle zuerst — ueberspringen (Weiter-Knoepfe druecken).
    const t0 = Date.now();
    let p = await phase();
    while (!/^auftritt/.test(p) && Date.now() - t0 < 90000) {
      if (boss === 'elara') await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(150);
      p = await phase();
    }
    const info = await page.evaluate(() => ({ renderer: window.game.renderer.type, version: window.GAME_VERSION }));
    console.log(boss, 'Renderer', info.renderer === 2 ? 'WebGL' : 'Canvas', info.version, p);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(ZIEL, `bossintro_browser_${boss}_auftritt.png`) });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(ZIEL, `bossintro_browser_${boss}_plakette.png`) });
    for (let i = 0; i < 40 && !/^rede/.test(await phase()); i++) await page.waitForTimeout(100);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ZIEL, `bossintro_browser_${boss}_rede.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(ZIEL, `bossintro_browser_${boss}_danach.png`) });
    console.log('  danach', await phase(), fehler.slice(0, 3));
    await page.close();
  }
  await browser.close();
})();
