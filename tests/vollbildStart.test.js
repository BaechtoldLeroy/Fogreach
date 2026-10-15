// tests/vollbildStart.test.js — Vollbild beim Start und "Zum Home-Bildschirm".
//
// Browser erlauben Vollbild nur aus einer Geste heraus. Frueher ging das Spiel
// beim ERSTEN beliebigen Klick ins Vollbild — das loeste oft versehentlich aus
// und wurde entfernt (main.js 4.1). Jetzt: genau beim bewussten Klick auf
// "Fortsetzen" bzw. "Neues Spiel" (dort ueber den Reload hinweg), abschaltbar
// in den Einstellungen ("Vollbild beim Start", Standard an). iPhone/iPad
// koennen kein Element-Vollbild — dafuer das Web-App-Manifest + Hinweis.

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { launch, flush } = require('../tools/headless/index.js');

const WURZEL = path.join(__dirname, '..');
let H = null;

before(async () => {
  H = await launch({ renderer: 'canvas', waitFor: 'StartScene' });
  for (let i = 0; i < 10; i++) { H.step(2); await flush(); }
});
after(async () => { if (H) await H.shutdown(); });

/** _vollbildBeimStart mit einer Szene, deren Vollbild man beobachten kann. */
function probe(einstellung, verfuegbar, schonAn) {
  return H.run(`(function () {
    var st = window.SlotStorage || localStorage, k = 'demonfall_settings_v1';
    var s = window.loadGameSettings(); s.vollbildStart = ${einstellung}; st.setItem(k, JSON.stringify(s));
    var gerufen = 0;
    var scene = { scale: { isFullscreen: ${schonAn}, fullscreen: { available: ${verfuegbar} },
      startFullscreen: function () { gerufen++; } } };
    var r = window._vollbildBeimStart(scene);
    return r + ':' + gerufen;
  })()`);
}

test('Einstellung "Vollbild beim Start" ist standardmaessig an', () => {
  const r = H.run(`(function () {
    var st = window.SlotStorage || localStorage; st.removeItem('demonfall_settings_v1');
    return window.loadGameSettings().vollbildStart; })()`);
  assert.strictEqual(r, true);
});

test('Start-Klick: Vollbild nur, wenn erlaubt, verfuegbar und noch nicht an', () => {
  assert.strictEqual(probe(true, true, false), 'true:1', 'an + verfuegbar');
  assert.strictEqual(probe(false, true, false), 'false:0', 'Einstellung aus');
  assert.strictEqual(probe(true, false, false), 'false:0', 'Browser kann es nicht (iOS)');
  assert.strictEqual(probe(true, true, true), 'false:0', 'schon im Vollbild');
});

test('Beide Startknoepfe fragen das Vollbild an (Fortsetzen direkt, Neues Spiel ueber den Reload)', () => {
  const src = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'startScene.js'), 'utf8');
  const i = src.indexOf('cont.platte.on("pointerdown"');
  assert.ok(i > 0 && src.slice(i, i + 200).includes('_vollbildBeimStart(this)'), 'Fortsetzen ruft das Vollbild nicht');
  const j = src.indexOf('window.sessionStorage.setItem(_NEW_GAME_FLAG');
  assert.ok(j > 0 && src.slice(j, j + 800).includes('window.sessionStorage.setItem(_RESUME_FS_FLAG'),
    'Neues Spiel stoesst das Vollbild nach dem Reload nicht an');
});

test('Einstellungsmenue hat den Schalter', () => {
  const src = fs.readFileSync(path.join(WURZEL, 'js', 'scenes', 'SettingsScene.js'), 'utf8');
  assert.ok(/_toggleRow\([^)]*'settings\.display\.fullscreen_start'\), 'vollbildStart'/.test(src), 'kein Schalter');
  const de = H.run(`window.i18n.t('settings.display.fullscreen_start')`);
  assert.strictEqual(de, 'Vollbild beim Start');
});

test('Zum Home-Bildschirm: Manifest, Icons und Meta-Tags', () => {
  const html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  assert.ok(/<link rel="manifest" href="assets\/manifest\.webmanifest/.test(html), 'kein Manifest verlinkt');
  assert.ok(/apple-mobile-web-app-capable" content="yes"/.test(html), 'iOS-App-Modus fehlt');
  const m = JSON.parse(fs.readFileSync(path.join(WURZEL, 'assets', 'manifest.webmanifest'), 'utf8'));
  assert.strictEqual(m.display, 'fullscreen');
  assert.strictEqual(m.name, 'Fogreach');
  // Pfade im Manifest gelten relativ zu ihm (assets/).
  assert.ok(fs.existsSync(path.join(WURZEL, 'assets', m.start_url)), 'start_url zeigt ins Leere: ' + m.start_url);
  m.icons.forEach((ic) => {
    const p = path.join(WURZEL, 'assets', ic.src);
    assert.ok(fs.existsSync(p), 'Icon fehlt: ' + ic.src);
    const b = fs.readFileSync(p);
    const [w, h] = ic.sizes.split('x').map(Number);
    assert.deepStrictEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [w, h], ic.src);
  });
});
