// tools/headless/boot.js — startet Fogreach ohne Rendering in einem vm-Kontext.
//
// Kernidee: `vm.runInContext` teilt top-level `let`/`const`/`function` zwischen
// nacheinander ausgefuehrten Skripten — exakt wie mehrere <script>-Tags im
// Browser. Genau darauf beruht das Spiel (z. B. `let player` in main.js, das
// enemy.js/player.js bar referenzieren; ~1030 Fundstellen in 52 Dateien).
// Die bestehende tests/loadGameModule.js kann das NICHT: sie nutzt
// `new Function` pro Datei, wodurch jede Datei einen eigenen Scope bekommt —
// deshalb testet sie nur in sich geschlossene IIFE-Module.
//
// Die Ladereihenfolge wird aus index.html gelesen, damit sie nicht doppelt
// gepflegt werden muss und ein neues Modul hier automatisch mitkommt.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createDomStub } = require('./domStub');

const ROOT = path.join(__dirname, '..', '..');

/** Liest die <script src>-Reihenfolge aus index.html (ohne ?v=-Cache-Buster). */
function readScriptOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1].split('?')[0]);
  return out;
}

/**
 * Baut den Kontext und laedt alle Spiel-Skripte.
 * @returns {{ctx, window, errors, loaded, skipped, step, dispatch}}
 */
function boot(opts) {
  opts = opts || {};
  const dom = createDomStub(opts);
  const errors = [];

  // Konsolen-Proxy: Fehler/Warnungen einsammeln statt nur ausgeben, damit
  // Tests darauf zusichern koennen ("0 Konsolenfehler beim Boot").
  const consoleProxy = {
    log: opts.verbose ? console.log : () => {},
    info: opts.verbose ? console.info : () => {},
    debug: () => {},
    warn: (...a) => { errors.push({ level: 'warn', msg: a.join(' ') }); if (opts.verbose) console.warn(...a); },
    error: (...a) => { errors.push({ level: 'error', msg: a.join(' ') }); if (opts.verbose) console.error(...a); },
  };
  dom.window.console = consoleProxy;

  // localStorage-Stub (dasselbe Verhalten wie tests/setup.js)
  const store = Object.create(null);
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
  };

  const sandbox = dom.window;
  sandbox.localStorage = localStorage;
  sandbox.sessionStorage = localStorage;
  sandbox.console = consoleProxy;
  sandbox.global = sandbox;
  sandbox.process = process; // manche Tools pruefen darauf; harmlos

  const ctx = vm.createContext(sandbox);

  const scripts = readScriptOrder();
  const loaded = [];
  const skipped = [];

  let headlessPatched = false;
  for (const rel of scripts) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { skipped.push({ file: rel, reason: 'fehlt' }); continue; }
    const code = fs.readFileSync(abs, 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: rel, timeout: opts.timeout || 20000 });
      loaded.push(rel);
    } catch (e) {
      errors.push({ level: 'error', msg: `[LOAD ${rel}] ${e && e.message}` });
      skipped.push({ file: rel, reason: (e && e.message) || 'Fehler' });
      if (opts.stopOnLoadError) break;
    }

    // Sobald Phaser geladen ist (und BEVOR main.js das Spiel erzeugt):
    // Renderer-Typ auf HEADLESS zwingen. main.js setzt `type: Phaser.AUTO`
    // fest verdrahtet — ohne diesen Eingriff versucht Phaser einen echten
    // Canvas-/WebGL-Kontext und bricht mit "Cannot create Canvas context" ab.
    // Wir fassen dafuer die Spieldatei NICHT an, sondern nur die Bibliothek.
    if (!headlessPatched && opts.forceHeadless !== false && sandbox.Phaser && sandbox.Phaser.Game) {
      headlessPatched = true;
      const OrigGame = sandbox.Phaser.Game;
      // Zwei Betriebsarten:
      //   'headless' (Standard) — schnellster Lauf, KEIN Renderer. Phaser setzt
      //      dann game.renderer = null; unten haengen wir eine Attrappe ein.
      //      Reicht fuer Boot-, Logik- und Zustandstests.
      //   'canvas' — echter Canvas-Renderer auf node-canvas. Noetig, sobald der
      //      Spielcode ZEICHNET, um daraus Daten zu gewinnen: graphics.js nutzt
      //      78x generateTexture(), was ohne echten Renderer nicht geht
      //      (Graphics.renderCanvas). Langsamer, dafuer verhaltenstreu.
      const rendererType = (opts.renderer === 'canvas')
        ? sandbox.Phaser.CANVAS
        : sandbox.Phaser.HEADLESS;
      function HeadlessGame(cfg) {
        const c = Object.assign({}, cfg || {}, { type: rendererType });
        // Banner/AutoFocus fassen DOM-Details an, die der Stub nicht abbildet.
        c.banner = false;
        c.autoFocus = false;
        // Bilder direkt ueber <img src> laden statt ueber XHR->Blob->ObjectURL.
        // Der Standardweg braucht URL.createObjectURL + FileReader; damit blieben
        // alle Bilder in FILE_PROCESSING haengen. Mit HTMLImageElement greift
        // stattdessen die Pfad-Aufloesung aus domStub.js (node-canvas).
        c.loader = Object.assign({}, c.loader || {}, { imageLoadType: 'HTMLImageElement' });
        return new OrigGame(c);
      }
      HeadlessGame.prototype = OrigGame.prototype;
      sandbox.Phaser.Game = HeadlessGame;
    }
  }

  // Renderer-Attrappe: In HEADLESS setzt Phaser `game.renderer = null`, aber
  // `TextureSource.update()` liest `renderer.gl` OHNE Null-Pruefung. Der
  // Spielcode loest das aus (player.js normalizePlayerDirectionalFrames ->
  // texture.refresh()). Ein Objekt mit `gl: null` beantwortet die Pruefung
  // korrekt mit "kein WebGL", statt zu werfen. Die Methoden sind No-Ops —
  // headless wird nichts gezeichnet, nur Zustand gefuehrt.
  if (sandbox.game && sandbox.game.renderer === null) {
    const W = opts.width || 960, H = opts.height || 480;
    sandbox.game.renderer = {
      gl: null,
      type: sandbox.Phaser ? sandbox.Phaser.HEADLESS : 3,
      width: W, height: H,
      config: { clearBeforeRender: false, backgroundColor: { alpha: 0 } },
      createCanvasTexture: () => null,
      updateCanvasTexture: () => null,
      createTextureFromSource: () => null,
      canvasToTexture: () => null,
      deleteTexture: () => {},
      deleteFramebuffer: () => {},
      resize: () => {},
      preRender: () => {}, render: () => {}, postRender: () => {},
      snapshot: () => {}, snapshotArea: () => {}, snapshotPixel: () => {},
      setBlendMode: () => {}, setTexture2D: () => {},
      on: () => {}, once: () => {}, off: () => {}, emit: () => {},
    };
  }

  /**
   * Taktet die Phaser-Loop von Hand um `frames` Schritte mit fixem dt.
   * Kein requestAnimationFrame -> deterministisch und so schnell wie moeglich.
   */
  function step(frames, dtMs) {
    const dt = typeof dtMs === 'number' ? dtMs : 16.666;
    let simulated = 0;
    for (let i = 0; i < (frames || 1); i++) {
      const cb = dom.getRafCallback();
      if (!cb) break;
      simulated += dt;
      try { cb(simulated); } catch (e) { errors.push({ level: 'error', msg: `[STEP] ${e && e.message}` }); }
    }
    return simulated;
  }

  /**
   * Fuehrt Code IM Spiel-Kontext aus und gibt das Ergebnis zurueck.
   *
   * Notwendig, weil die Spiel-Globals als top-level `let` deklariert sind
   * (`player`, `cursors`, `enemies` ...) und damit NICHT auf `window` liegen —
   * von aussen sind sie sonst unerreichbar. Das ist derselbe Zugriff, den die
   * Browser-Konsole haette.
   */
  function run(code) {
    return vm.runInContext(code, ctx, { filename: 'headless-eval', timeout: opts.timeout || 20000 });
  }

  return {
    ctx,
    window: sandbox,
    errors,
    loaded,
    skipped,
    step,
    run,
    dispatch: dom.dispatch,
    getRafCallback: dom.getRafCallback,
  };
}

module.exports = { boot, readScriptOrder };
