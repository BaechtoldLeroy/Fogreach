/**
 * tools/mobilMessung.js — Bildrate wie auf einem Handy messen (Annaeherung).
 *
 * Chromium mit Handy-Bildschirm, Touch und Android-Kennung (das Spiel laeuft
 * also im Mobilmodus), dazu die CPU per DevTools gebremst. Gemessen wird
 * Bild fuer Bild per requestAnimationFrame, an festen Stellen des Spiels.
 *
 *   node tools/mobilMessung.js                     4x und 6x, alle Stellen
 *   node tools/mobilMessung.js --bremse 1,4,6      eigene Bremsstufen
 *   node tools/mobilMessung.js --stellen hub,kampf --sekunden 15
 *   node tools/mobilMessung.js --sichtbar          mit Fenster (echte GPU)
 *
 * Die Zahlen taugen zum VERGLEICHEN (vorher/nachher, Stelle gegen Stelle),
 * nicht als Zusage fuer ein bestimmtes Geraet: GPU, Waermedrosselung und
 * Safari bildet das nicht nach. Ohne --sichtbar zeichnet Chromium je nach
 * Rechner in Software — die Zeile "GPU" in der Ausgabe sagt, was lief.
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const BREMSEN = opt('bremse', '4,6').split(',').map(Number);
const SEKUNDEN = +opt('sekunden', 12);
const SICHTBAR = args.includes('--sichtbar');
// --profil: CPU-Profil waehrend der Messung, Eigenzeit je Funktion (Top 30).
const PROFIL = args.includes('--profil');
// Fester Zufall (Raum, Gegner, Deko): sonst misst jeder Lauf einen anderen Raum.
const SEED = +opt('seed', 1);
const WURZEL = path.join(__dirname, '..');

// Ein Mittelklasse-Android quer gehalten (Pixel-7-Masse).
const GERAET = {
  viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
};

const GS = "window.game && window.game.scene.getScene('GameScene')";
// Jede Stelle: Adresse, wann sie bereit ist, was danach einmal geschieht.
const STELLEN = {
  hub: {
    url: '/?debug=1',
    vorher: `(function () { var g = window.game; if (!g) return false;
      var st = g.scene.getScene('StartScene'), hub = g.scene.getScene('HubSceneV2');
      if (hub && hub.sys.isActive()) return true;
      if (st && st.sys.isActive() && !window.__mmHub) { window.__mmHub = 1; st.scene.start('HubSceneV2'); }
      return false; })()`
  },
  kampf: {
    url: '/?debug=1&dungeon=12',
    vorher: `!!(${GS} && ${GS}.sys.isActive() && window.player && window.enemies && window.enemies.countActive() > 0)`
  },
  spionage: {
    url: '/?debug=1&dungeon=3&spy=lager',
    vorher: `(function () { var s = ${GS}; if (!s || !s.sys.isActive() || !window.player) return false;
      if (s.__spionSzene) { if (s.__spionSzene.ueberspringen) s.__spionSzene.ueberspringen(); return false; }
      return !!(window.EspionageSystem && window.EspionageSystem.isActive()); })()`
  },
  boss: {
    url: '/?debug=1&dungeon=1&boss=kettenmeister',
    vorher: `(function () { var s = ${GS}; if (!s || !s.sys.isActive() || !window.player) return false;
      var z = s.__bossZwischenszene; if (z) { if (z.ueberspringen) z.ueberspringen(); return false; }
      return true; })()`
  }
};
const GEWAEHLT = opt('stellen', Object.keys(STELLEN).join(',')).split(',').filter((s) => STELLEN[s]);

// Kleiner statischer Server: kein liegengebliebener http-server danach.
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest': 'application/json' };
function server() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const p = path.join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
      const datei = p.endsWith(path.sep) || p === WURZEL ? path.join(p, 'index.html') : p;
      if (!datei.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
      fs.readFile(datei, (e, d) => {
        if (e) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream' });
        res.end(d);
      });
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

async function bis(page, js, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(js).catch(() => false)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

// Bildzeiten aus der Seite: rAF-Abstaende in ms.
const ZAEHLER = () => {
  window.__mm = { t: [], an: false, letzt: 0 };
  const tick = (now) => {
    const m = window.__mm;
    if (m.an && m.letzt) m.t.push(now - m.letzt);
    m.letzt = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try { localStorage.setItem('demonfall_audio', JSON.stringify({ master: 0, sfx: 0, music: 0, muted: true })); } catch (e) {}
};

function auswerten(t) {
  if (!t.length) return null;
  const s = t.slice().sort((a, b) => a - b);
  const summe = t.reduce((a, b) => a + b, 0);
  const p99 = s[Math.min(s.length - 1, Math.floor(s.length * 0.99))];
  return {
    fps: Math.round(1000 * t.length / summe),
    tief1: Math.round(1000 / p99),                     // "1 % low"
    haenger: t.filter((x) => x > 50).length,           // Bilder ueber 50 ms
    max: Math.round(s[s.length - 1])
  };
}

// Adresse -> Pfad im Repo ohne ?v=.
function kurz(u) { return (u || '').replace(/^.*\/\/[^/]+\//, '').replace(/\?.*$/, ''); }

// Eigenzeit je Funktion (Datei:Zeile) aus den Stichproben.
function eigenzeit(profil, titel) {
  const knoten = new Map(profil.nodes.map((n) => [n.id, n]));
  const zaehl = new Map();
  const dt = profil.timeDeltas || [];
  let gesamt = 0;
  profil.samples.forEach((id, i) => {
    const n = knoten.get(id), cf = n.callFrame, d = dt[i] || 0;
    gesamt += d;
    const datei = (cf.url || '').replace(/^.*\/\/[^/]+\//, '').replace(/\?.*$/, '');
    const name = (cf.functionName || '(anonym)') + (datei ? '  ' + datei + ':' + (cf.lineNumber + 1) : '');
    zaehl.set(name, (zaehl.get(name) || 0) + d);
  });
  const liste = [...zaehl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('\n--- Profil ' + titel + ' (Eigenzeit, ' + Math.round(gesamt / 1000) + ' ms gesamt) ---');
  liste.forEach(([n, d]) => console.log(String((100 * d / gesamt).toFixed(1)).padStart(5) + ' %  ' + n));
  // Dasselbe, aber jede Stichprobe der naechsten EIGENEN Funktion im Stapel
  // zugeschrieben: so zaehlt Phaser-Arbeit (Zeichnen, Physik) bei dem Spielcode,
  // der sie ausloest. Was keinen eigenen Aufrufer hat, ist Phasers Schleife.
  const eltern = new Map();
  profil.nodes.forEach((n) => (n.children || []).forEach((c) => eltern.set(c, n.id)));
  const eigen = new Map();
  profil.samples.forEach((id, i) => {
    const d = dt[i] || 0;
    let k = id, name = null;
    while (k != null) {
      const cf = knoten.get(k).callFrame, u = cf.url || '';
      if (u.indexOf('/js/') >= 0 && u.indexOf('vendor') < 0) {
        name = (cf.functionName || '(anonym)') + '  ' + kurz(u) + ':' + (cf.lineNumber + 1);
        break;
      }
      k = eltern.get(k);
    }
    const n0 = knoten.get(id).callFrame.functionName;
    if (!name) name = ['(program)', '(idle)', '(garbage collector)'].indexOf(n0) >= 0 ? n0 : '[Phaser-Schleife: Zeichnen, Physik, Tweens]';
    eigen.set(name, (eigen.get(name) || 0) + d);
  });
  console.log('--- ' + titel + ': der naechsten eigenen Funktion zugeschrieben ---');
  [...eigen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([n, d]) => console.log(String((100 * d / gesamt).toFixed(1)).padStart(5) + ' %  ' + n));
  console.log('');
}

async function messen(browser, stelle, bremse, port) {
  const ctx = await browser.newContext(GERAET);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  await page.addInitScript((seed) => {
    let a = seed >>> 0;
    Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, SEED);
  await page.addInitScript(ZAEHLER);
  await page.goto(`http://127.0.0.1:${port}${STELLEN[stelle].url}`, { waitUntil: 'load' });
  // Laden ungebremst; gebremst wird nur gemessen.
  const bereit = await bis(page, STELLEN[stelle].vorher, 90000);
  if (!bereit) { await ctx.close(); return { stelle, bremse, fehler: 'nicht bereit ' + (fehler[0] || '') }; }
  await page.evaluate('window._playerInvincible = true');
  const info = await page.evaluate(() => {
    const c = document.createElement('canvas'), gl = c.getContext('webgl');
    const d = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { mobil: window.isMobile === true || !!(window.game && window.game.device.input.touch),
      renderer: window.game && window.game.renderer.type === 2 ? 'WebGL' : 'Canvas',
      gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?', version: window.GAME_VERSION };
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: bremse });
  await page.waitForTimeout(1500);   // einschwingen
  if (PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  // Rechenzeit je Spielschritt (Update + Zeichnen): springt nicht in Vsync-Stufen
  // wie die Bildrate und taugt darum besser zum Vergleich vorher/nachher.
  await page.evaluate(() => { const lp = window.game.loop; if (!lp.__mmCb) { const cb = lp.__mmCb = lp.callback;
    lp.callback = function (a, b) { const s = performance.now(); cb(a, b); if (window.__mm.an) window.__mm.schritt.push(performance.now() - s); }; } });
  await page.evaluate(() => { window.__mm.t = []; window.__mm.schritt = []; window.__mm.an = true; window.__mm.weg = 0;
    const pl = () => window.player || (window.game.scene.getScene('HubSceneV2') || {}).player;
    let a = pl(); window.__mm.ort = a ? [a.x, a.y] : null;
    window.__mm.uhr = setInterval(() => { const b = pl(), o = window.__mm.ort; if (b && o) { window.__mm.weg += Math.hypot(b.x - o[0], b.y - o[1]); window.__mm.ort = [b.x, b.y]; } }, 100); });
  // Herumlaufen wie auf dem Handy: Daumen links auf den schwebenden Joystick
  // (js/mobileJoystick.js), alle 0,8 s eine andere Richtung.
  // Der Hub hat einen festen Joystick (HubSceneV2: 100 / Hoehe-100 in Spielpunkten).
  const basis = await page.evaluate((v) => {
    const hub = window.game.scene.getScene('HubSceneV2');
    if (!(hub && hub.sys.isActive() && hub.hubJoystick)) return { x: Math.round(v.width * 0.2), y: Math.round(v.height * 0.6) };
    const r = window.game.canvas.getBoundingClientRect(), sx = r.width / window.game.scale.width, sy = r.height / window.game.scale.height;
    return { x: Math.round(r.left + hub.hubJoystick.x * sx), y: Math.round(r.top + hub.hubJoystick.y * sy) };
  }, GERAET.viewport);
  const winkel = [0, 90, 180, 270, 45, 225];
  const ende = Date.now() + SEKUNDEN * 1000;
  const finger = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  for (let i = 0; Date.now() < ende; i++) {
    const w = winkel[i % winkel.length] * Math.PI / 180;
    await finger('touchStart', basis.x, basis.y);
    for (let s = 1; s <= 4; s++) await finger('touchMove', basis.x + Math.cos(w) * 15 * s, basis.y + Math.sin(w) * 15 * s);
    await page.waitForTimeout(800);
    await finger('touchEnd');
  }
  const profil = PROFIL ? (await cdp.send('Profiler.stop')).profile : null;
  const { t, schritt, weg } = await page.evaluate(() => { window.__mm.an = false; clearInterval(window.__mm.uhr); return { t: window.__mm.t, schritt: window.__mm.schritt, weg: Math.round(window.__mm.weg) }; });
  await ctx.close();
  if (profil) eigenzeit(profil, stelle + ' ' + bremse + 'x');
  const ss = schritt.slice().sort((a, b) => a - b);
  const rechnen = ss.length ? { ms: +(schritt.reduce((a, b) => a + b, 0) / schritt.length).toFixed(1), ms95: +ss[Math.floor(ss.length * 0.95)].toFixed(1) } : {};
  return Object.assign({ stelle, bremse, weg, fehler: fehler[0] || '' }, info, auswerten(t), rechnen);
}

(async () => {
  const srv = await server();
  const port = srv.address().port;
  const browser = await chromium.launch({ headless: !SICHTBAR, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const zeilen = [];
  try {
    for (const stelle of GEWAEHLT) {
      for (const bremse of BREMSEN) {
        const r = await messen(browser, stelle, bremse, port);
        zeilen.push(r);
        console.log(r.fps != null
          ? `${stelle.padEnd(9)} ${String(bremse + 'x').padEnd(4)} ${String(r.fps).padStart(3)} fps   Rechnen ${String(r.ms).padStart(5)} ms (95%: ${String(r.ms95).padStart(5)})   1%-tief ${String(r.tief1).padStart(3)}   Haenger>50ms ${String(r.haenger).padStart(3)}   max ${String(r.max).padStart(3)} ms   gelaufen ${r.weg} px${r.mobil ? '' : '   (NICHT mobil!)'}${r.fehler ? '   Fehler: ' + r.fehler : ''}`
          : `${stelle.padEnd(9)} ${bremse}x   ${r.fehler}`);
      }
    }
    const z = zeilen.find((r) => r.gpu);
    if (z) console.log(`\nGPU: ${z.gpu} · ${z.renderer} · ${z.version} · ${SEKUNDEN} s je Messung · seed ${SEED} · ${GERAET.viewport.width}x${GERAET.viewport.height} @${GERAET.deviceScaleFactor}`);
  } finally {
    await browser.close();
    srv.close();
  }
})();
