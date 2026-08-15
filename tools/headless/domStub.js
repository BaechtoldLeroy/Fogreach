// tools/headless/domStub.js — minimale Browser-Umgebung fuer den Headless-Lauf.
//
// Warum kein jsdom: Phaser im HEADLESS-Modus erzeugt keinen Renderer und
// braucht deshalb nur einen kleinen Ausschnitt der DOM-API. Ein handgebauter
// Stub haelt die Abhaengigkeiten des Projekts unveraendert (jsdom waere ~50
// zusaetzliche Pakete) und macht sichtbar, welche Browser-Funktionen das Spiel
// tatsaechlich anfasst.
//
// Canvas/Image kommen aus node-canvas, das bereits Projekt-Abhaengigkeit ist —
// damit funktionieren die ~78 generateTexture()-Aufrufe aus graphics.js echt
// und nicht als Attrappe.

const fs = require('fs');
const path = require('path');
const {
  createCanvas,
  Image: CanvasImage,
  CanvasRenderingContext2D,
  ImageData,
  CanvasGradient,
  CanvasPattern,
} = require('canvas');

function createDomStub(opts) {
  opts = opts || {};
  const width = opts.width || 960;
  const height = opts.height || 480;
  // Wurzel, gegen die relative Asset-Pfade aufgeloest werden (Repo-Root).
  const rootDir = opts.rootDir || path.join(__dirname, '..', '..');

  /** Relativen Browser-Pfad ('assets/x.png') auf eine Datei im Repo abbilden. */
  function resolveAsset(url) {
    const u = String(url || '').split('?')[0];
    if (/^(https?:|data:)/i.test(u)) return null; // extern: headless nicht unterstuetzt
    return path.join(rootDir, u.replace(/^\//, ''));
  }

  // ---- Image: node-canvas mit Pfad-Aufloesung -----------------------------
  // Phaser laedt Bilder ueber `new Image(); img.src = url`. node-canvas kann
  // lokale Dateien laden, kennt aber die Repo-Wurzel nicht — deshalb wird die
  // Zuweisung abgefangen und der Pfad absolut gemacht. Dadurch sind Texturen
  // ECHT (richtige Masse, echte Frames) statt Platzhalter.
  class HeadlessImage extends CanvasImage {
    set src(v) {
      const abs = resolveAsset(v);
      if (abs && fs.existsSync(abs)) {
        // BUFFER statt Dateipfad: node-canvas oeffnet unter Windows keine Pfade
        // mit Nicht-ASCII-Zeichen (hier: Umlaut im Benutzerordner) und meldet
        // "No such file or directory", obwohl fs.existsSync die Datei findet.
        // Der Umweg ueber den Puffer umgeht das Dateisystem komplett und ist
        // zugleich asynchron — genau das erwartet Phasers Loader.
        fs.readFile(abs, (err, buf) => {
          if (err) { super.src = v; return; }
          super.src = buf;
        });
      } else {
        super.src = v;
      }
    }
    get src() { return super.src; }
  }

  // ---- XMLHttpRequest: liest JSON/Text von der Platte ---------------------
  // Phaser nutzt XHR fuer JSON (hier: 36 Raum-Templates + Manifest).
  function HeadlessXHR() {
    const self = {
      readyState: 0, status: 0, responseText: '', response: null,
      responseType: '', timeout: 0, withCredentials: false,
      _url: null, _handlers: Object.create(null),
      open(_method, url) { self._url = url; self.readyState = 1; },
      setRequestHeader() {},
      overrideMimeType() {},
      abort() {},
      addEventListener(t, fn) { (self._handlers[t] || (self._handlers[t] = [])).push(fn); },
      removeEventListener(t, fn) {
        const a = self._handlers[t]; if (!a) return;
        const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
      },
      _fire(type) {
        const ev = { type, target: self, currentTarget: self };
        const on = self['on' + type];
        if (typeof on === 'function') { try { on.call(self, ev); } catch (e) { /* Stub */ } }
        (self._handlers[type] || []).forEach((fn) => { try { fn.call(self, ev); } catch (e) { /* Stub */ } });
      },
      send() {
        // Asynchron nachbilden, damit Phasers Loader-Zustandsmaschine wie im
        // Browser laeuft (sonst feuert 'load' noch waehrend send()).
        setTimeout(() => {
          const abs = resolveAsset(self._url);
          if (abs && fs.existsSync(abs)) {
            const buf = fs.readFileSync(abs);
            self.status = 200;
            self.readyState = 4;
            self.responseText = buf.toString('utf8');
            self.response = self.responseType === 'json'
              ? (() => { try { return JSON.parse(self.responseText); } catch (e) { return null; } })()
              : (self.responseType === 'arraybuffer'
                ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
                : self.responseText);
            self._fire('load');
          } else {
            self.status = 404;
            self.readyState = 4;
            self._fire('error');
          }
          self._fire('loadend');
        }, 0);
      },
    };
    return self;
  }

  const listeners = Object.create(null);
  function addEventListener(type, fn) {
    (listeners[type] || (listeners[type] = [])).push(fn);
  }
  function removeEventListener(type, fn) {
    const arr = listeners[type];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }
  function dispatch(type, ev) {
    (listeners[type] || []).forEach((fn) => { try { fn(ev || { type }); } catch (e) { /* Stub schluckt */ } });
  }

  /**
   * Haengt die 2D-Kontext-Anpassung an ein ECHTES node-canvas an.
   * Phaser ruft ctx.setTransform(matrixObjekt) mit EINEM Argument auf; Browser
   * akzeptieren dort ein DOMMatrix-aehnliches Objekt, node-canvas nur 6 Zahlen
   * (sonst "Expected DOMMatrix"). Wir packen das Objekt auseinander.
   */
  function patchContext(ctx) {
    if (!ctx || ctx.__fogreachPatched) return ctx;
    const orig = ctx.setTransform.bind(ctx);
    ctx.setTransform = function (a, b, c, d, e, f) {
      if (arguments.length === 1 && a && typeof a === 'object') {
        const m = a;
        const nums = (Array.isArray(m) || typeof m.length === 'number')
          ? [m[0], m[1], m[2], m[3], m[4], m[5]]
          : [m.a, m.b, m.c, m.d, m.e, m.f];
        if (nums.every((n) => typeof n === 'number' && isFinite(n))) {
          return orig(nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]);
        }
        return orig(1, 0, 0, 1, 0, 0);
      }
      return orig(a, b, c, d, e, f);
    };
    ctx.__fogreachPatched = true;
    return ctx;
  }

  /**
   * Canvas-Elemente sind ECHTE node-canvas-Objekte, nur um die DOM-Felder
   * ergaenzt, die Phaser anfasst. Wichtig: KEIN Wrapper-Objekt — der Spielcode
   * reicht Canvas/Image an ctx.drawImage() weiter (z. B. player.js
   * getDirectionalFrameMeta), und node-canvas lehnt alles ab, was nicht sein
   * eigener Typ ist ("Image or Canvas expected").
   */
  function makeCanvasElement() {
    const cv = createCanvas(width, height);
    const origGetContext = cv.getContext.bind(cv);
    cv.getContext = function (type, attrs) {
      let ctx;
      try { ctx = origGetContext(type === 'webgl' ? '2d' : type, attrs); }
      catch (e) { ctx = origGetContext('2d'); }
      return patchContext(ctx);
    };
    cv.tagName = 'CANVAS';
    cv.nodeName = 'CANVAS';
    cv.style = {};
    cv.className = '';
    cv.parentNode = null;
    cv.addEventListener = addEventListener;
    cv.removeEventListener = removeEventListener;
    cv.setAttribute = function () {};
    cv.getAttribute = function () { return null; };
    cv.removeAttribute = function () {};
    cv.focus = function () {};
    cv.blur = function () {};
    cv.getBoundingClientRect = function () {
      return { x: 0, y: 0, top: 0, left: 0, right: cv.width, bottom: cv.height, width: cv.width, height: cv.height };
    };
    Object.defineProperty(cv, 'clientWidth', { get: () => cv.width, configurable: true });
    Object.defineProperty(cv, 'clientHeight', { get: () => cv.height, configurable: true });
    Object.defineProperty(cv, 'offsetWidth', { get: () => cv.width, configurable: true });
    Object.defineProperty(cv, 'offsetHeight', { get: () => cv.height, configurable: true });
    return cv;
  }

  function makeElement(tag) {
    if (String(tag).toLowerCase() === 'canvas') return makeCanvasElement();
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      style: {},
      children: [],
      parentNode: null,
      // Phaser fragt diese Felder auf dem Canvas-Element ab
      width, height,
      clientWidth: width, clientHeight: height,
      offsetWidth: width, offsetHeight: height,
      addEventListener, removeEventListener,
      appendChild(c) { el.children.push(c); if (c) c.parentNode = el; return c; },
      removeChild(c) {
        const i = el.children.indexOf(c);
        if (i >= 0) el.children.splice(i, 1);
        return c;
      },
      setAttribute() {}, getAttribute() { return null; },
      getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height }; },
      focus() {}, blur() {},
      insertBefore(c) { el.children.push(c); return c; },
      contains() { return false; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    return el;
  }

  const body = makeElement('body');
  const documentElement = makeElement('html');

  const document = {
    body,
    documentElement,
    readyState: 'complete',
    hidden: false,
    visibilityState: 'visible',
    addEventListener, removeEventListener,
    createElement: makeElement,
    createElementNS: (_ns, tag) => makeElement(tag),
    getElementById() { return null; },
    getElementsByTagName() { return []; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createTextNode(t) { return { nodeValue: t }; },
    head: makeElement('head'),
    fonts: { ready: Promise.resolve(), add() {}, load() { return Promise.resolve(); } },
  };

  // rAF: KEIN echter Timer. Der Testtreiber taktet die Loop selbst, damit ein
  // Lauf deterministisch und schnell ist (siehe boot.js step()). Wir merken uns
  // nur den Callback, den Phaser registriert.
  let rafCb = null;
  let rafId = 1;
  function requestAnimationFrame(cb) { rafCb = cb; return rafId++; }
  function cancelAnimationFrame() { rafCb = null; }

  const win = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    // `search` ist konfigurierbar, damit Tests die vorhandenen Debug-Einstiege
    // nutzen koennen (z. B. '?dungeon=1' fuer den Direkteinstieg in einen Run —
    // derselbe _enterLocation-Pfad wie ein echter Klick).
    location: {
      href: 'http://localhost/' + (opts.search || ''),
      search: opts.search || '',
      protocol: 'http:',
      hostname: 'localhost',
      reload() {},
      replace() {},
    },
    navigator: {
      userAgent: 'HeadlessFogreach/1.0 (Node)',
      language: 'de-DE',
      platform: 'node',
      maxTouchPoints: 0,
      getGamepads() { return []; },
      vibrate() { return false; },
    },
    addEventListener, removeEventListener, dispatchEvent: dispatch,
    requestAnimationFrame, cancelAnimationFrame,
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
    console,
    Image: HeadlessImage,
    // Phasers Feature-Erkennung (Features.js) setzt `features.canvas` allein
    // anhand der Existenz von window.CanvasRenderingContext2D. Ohne diese
    // Klasse meldet Phaser "Cannot create Canvas context, aborting" und
    // verweigert den CANVAS-Renderer — obwohl node-canvas voll funktioniert.
    CanvasRenderingContext2D,
    ImageData,
    CanvasGradient,
    CanvasPattern,
    // Phaser prueft beim Laden auf diese Konstruktoren (Feature-Detection fuer
    // Video-/Audio-Dateitypen). Reine Platzhalter — headless wird nichts davon
    // instanziiert, aber ihr Fehlen bricht schon das Parsen von phaser.min.js.
    HTMLCanvasElement: function HTMLCanvasElement() {},
    HTMLElement: function HTMLElement() {},
    HTMLVideoElement: function HTMLVideoElement() {},
    HTMLAudioElement: function HTMLAudioElement() {},
    HTMLImageElement: HeadlessImage,
    Audio: function Audio() { return { canPlayType: () => '', play: () => Promise.resolve(), pause() {} }; },
    XMLHttpRequest: HeadlessXHR,
    Blob: function Blob() {},
    Worker: function Worker() {},
    Event: function Event(type) { this.type = type; },
    matchMedia() { return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; },
    getComputedStyle() { return { getPropertyValue: () => '' }; },
    focus() {}, scrollTo() {},
    URL: typeof URL !== 'undefined' ? URL : function () {},
    // AudioContext bewusst NICHT gestubbt: soundManager.js prueft defensiv und
    // schaltet sich ohne Web Audio still ab — genau das wollen wir headless.
  };
  win.window = win;
  win.self = win;
  win.top = win;
  win.document = document;
  win.parent = win;

  return {
    window: win,
    document,
    // Der Treiber braucht Zugriff auf den registrierten rAF-Callback, um die
    // Loop von Hand zu takten.
    getRafCallback: () => rafCb,
    dispatch,
  };
}

module.exports = { createDomStub };
