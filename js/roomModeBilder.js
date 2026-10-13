/* =====================================================================
 * roomModeBilder.js — Pixelbilder und Messing-Toasts der Sonderraum-Modi
 * ---------------------------------------------------------------------
 * Vorschau hinter ?debug=1&raummodi=neu. Ohne Flagge (oder wenn ein Bild
 * fehlt) bleibt alles, wie es war: gezeichnete Kreise, der alte Altar, das
 * alte Banner. Die Modi selbst fragen hier nur "gibt es ein Bild?" — ihre
 * Mechanik (Koerper, Timer, Ziele) haengt an nichts davon.
 *
 * Bilder: assets/sprites/raummodi/, gebaut von tools/raummodiBauen.js aus
 * den PixelLab-Rohbildern unter tools/rohbilder/raummodi/.
 * ===================================================================== */
(function () {
  'use strict';

  var ORDNER = 'assets/sprites/raummodi/';
  var V = 1;
  var BILDER = {
    altar: 'raummodus_altar',
    altarRissig: 'raummodus_altar_rissig',
    sanduhr: 'raummodus_sanduhr',
    fluchtpfeil: 'raummodus_fluchtpfeil'
  };
  // Bodensiegel: 16 Bilder im 4x4-Raster (vfx_workbench), Anker = Bildmitte
  // am Boden. ankerY ist der Anteil der Bildhoehe, an dem der Boden liegt.
  var SIEGEL = {
    jagd: { key: 'raummodus_siegel_jagd', w: 84, h: 46, ankerY: 28 / 46 },
    bannkreis: { key: 'raummodus_siegel_bannkreis', w: 102, h: 50, ankerY: 28 / 50 },
    flucht: { key: 'raummodus_siegel_flucht', w: 92, h: 45, ankerY: 25 / 45 }
  };
  var SYMBOL = {
    hunt: 'raummodus_symbol_jagd',
    defend: 'raummodus_symbol_verteidigung',
    escape: 'raummodus_symbol_flucht',
    survival: 'raummodus_symbol_durchhalten'
  };

  if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.register === 'function') {
    window.i18n.register('de', {
      'roommode.toast.zehn': 'Noch 10 Sekunden!',
      'roommode.toast.altar_broeckelt': 'Der Altar bröckelt!',
      'roommode.toast.erfuellt': 'Ziel erfüllt!',
      'roommode.toast.verfehlt': 'Ziel verfehlt',
      'roommode.toast.hunt.erfuellt': 'Der Rudelführer ist gefallen!',
      'roommode.toast.defend.erfuellt': 'Der Altar hat gehalten!',
      'roommode.toast.defend.verfehlt': 'Der Altar ist zerbrochen.',
      'roommode.toast.survival.erfuellt': 'Durchgehalten!',
      'roommode.toast.escape.erfuellt': 'Durchgehalten — die Bonus-Truhe wartet!'
    });
    window.i18n.register('en', {
      'roommode.toast.zehn': '10 seconds left!',
      'roommode.toast.altar_broeckelt': 'The altar is crumbling!',
      'roommode.toast.erfuellt': 'Objective complete!',
      'roommode.toast.verfehlt': 'Objective failed',
      'roommode.toast.hunt.erfuellt': 'The pack leader has fallen!',
      'roommode.toast.defend.erfuellt': 'The altar held!',
      'roommode.toast.defend.verfehlt': 'The altar has shattered.',
      'roommode.toast.survival.erfuellt': 'You endured!',
      'roommode.toast.escape.erfuellt': 'You held out — the bonus chest awaits!'
    });
  }

  function _t(key, params) {
    var I = (typeof window !== 'undefined') ? window.i18n : null;
    return (I && typeof I.t === 'function') ? I.t(key, params || {}) : key;
  }

  /** Steht die Vorschau-Flagge? (?debug=1&raummodi=neu) */
  function aktiv() {
    var G = (typeof window !== 'undefined') ? window.DebugGate : null;
    try { return !!(G && G.flagge('raummodi') === 'neu'); } catch (e) { return false; }
  }

  function _alleKeys() {
    var k = [];
    Object.keys(BILDER).forEach(function (n) { k.push(BILDER[n]); });
    Object.keys(SIEGEL).forEach(function (n) { k.push(SIEGEL[n].key); });
    Object.keys(SYMBOL).forEach(function (n) { k.push(SYMBOL[n]); });
    return k;
  }

  /** Im preload(): nur mit Flagge, nur die fehlenden. */
  function vorladen(scene) {
    if (!aktiv() || !scene || !scene.load || !scene.textures) return;
    Object.keys(BILDER).forEach(function (n) {
      var k = BILDER[n];
      if (!scene.textures.exists(k)) scene.load.image(k, ORDNER + k + '.png?v=' + V);
    });
    Object.keys(SYMBOL).forEach(function (n) {
      var k = SYMBOL[n];
      if (!scene.textures.exists(k)) scene.load.image(k, ORDNER + k + '.png?v=' + V);
    });
    Object.keys(SIEGEL).forEach(function (n) {
      var s = SIEGEL[n];
      if (!scene.textures.exists(s.key)) {
        scene.load.spritesheet(s.key, ORDNER + s.key + '.png?v=' + V, { frameWidth: s.w, frameHeight: s.h });
      }
    });
  }

  /** Bild verwendbar? Ohne Flagge nie — dann zeichnen die Modi wie bisher. */
  function hat(scene, key) {
    return !!(key && aktiv() && scene && scene.textures && scene.textures.exists(key));
  }

  // ---- Welt-Objekte ------------------------------------------------------

  /** Altar-Textur oder null (dann die alte Zeichnung). */
  function altarKey(scene) { return hat(scene, BILDER.altar) ? BILDER.altar : null; }

  /**
   * Zustand des Altars zeigen. Liefert false, wenn kein Altarbild laeuft —
   * dann toent roomModeDefend wie bisher.
   */
  function altarZustand(sprite, frac, hp) {
    if (!sprite || !sprite.texture || sprite.texture.key.indexOf('raummodus_altar') !== 0) return false;
    var sc = sprite.scene;
    var rissig = frac < 0.35 && sc && sc.textures && sc.textures.exists(BILDER.altarRissig);
    var soll = rissig ? BILDER.altarRissig : BILDER.altar;
    if (sprite.texture.key !== soll) sprite.setTexture(soll);
    if (hp <= 0) { sprite.setTint(0x555555); sprite.setAlpha(0.6); }
    else sprite.clearTint();
    return true;
  }

  function _anim(scene, s) {
    var name = s.key + '_lauf';
    if (scene.anims && !scene.anims.exists(name)) {
      scene.anims.create({
        key: name, frames: scene.anims.generateFrameNumbers(s.key, { start: 0, end: 15 }),
        frameRate: 10, repeat: -1
      });
    }
    return name;
  }

  /**
   * Ein Bodensiegel (jagd, bannkreis, flucht) an (x,y) = Bodenpunkt.
   * null ohne Flagge oder Bild — der Aufrufer bleibt dann beim Alten.
   */
  function siegel(scene, art, x, y, tiefe) {
    var s = SIEGEL[art];
    if (!s || !hat(scene, s.key) || !scene.add) return null;
    try {
      var sp = scene.add.sprite(x, y, s.key, 0).setOrigin(0.5, s.ankerY).setScrollFactor(1);
      sp.setDepth(typeof tiefe === 'number' ? tiefe : -2);
      var a = _anim(scene, s);
      if (sp.anims && a) sp.play(a);
      return sp;
    } catch (e) { return null; }
  }

  /**
   * Kleines schwebendes Bild (Sanduhr, Fluchtpfeil) mit sanftem Auf und Ab.
   * x,y = Fusspunkt der Schwebe; das Bild haengt mit der Unterkante dort.
   * Aufrecht, aber ohne Koerper: es ruht auf der Ereignistiefe (45) und
   * rueckt ueber sortiereZumSpieler vor den Spieler, wenn er dahinter steht.
   */
  function schwebe(scene, name, x, y, tiefe) {
    var key = BILDER[name];
    if (!hat(scene, key) || !scene.add) return null;
    try {
      var sp = scene.add.image(x, y, key).setOrigin(0.5, 1).setScrollFactor(1)
        .setDepth(typeof tiefe === 'number' ? tiefe : 45);
      if (typeof window.sortiereZumSpieler === 'function') window.sortiereZumSpieler(scene, sp);
      if (scene.tweens && typeof scene.tweens.add === 'function') {
        scene.tweens.add({ targets: sp, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return sp;
    } catch (e) { return null; }
  }

  // ---- Toasts --------------------------------------------------------------

  /** Symbol des Modus oder null. */
  function symbolKey(scene, modeId) { return hat(scene, SYMBOL[modeId]) ? SYMBOL[modeId] : null; }

  /**
   * Toast im Messing-Stil (showEventToast, #189) mit dem Symbol des Modus.
   * Liefert true, wenn er gezeigt wurde; false = Aufrufer zeigt sein Altes.
   */
  function toast(scene, modeId, text) {
    var sym = symbolKey(scene, modeId);
    var zeige = (typeof window !== 'undefined') ? window.showEventToast : null;
    if (!sym || typeof zeige !== 'function' || !scene || !scene.add) return false;
    var UR = window.uiRahmen;
    if (!UR || !UR.bereit(scene)) return false;   // ohne Banner kein halber Messing-Toast
    try { zeige(scene, text, 'raummodus'); } catch (e) { return false; }
    // showEventToast kennt die Modi nicht und setzt das Ereignis-Medaillon;
    // dieses gegen das Modus-Symbol tauschen (gleiche Groesse, gleicher Ort).
    var e = scene._activeEventToast;
    if (!e || !e.teile) return false;
    var allg = UR.symbol('raummodus');
    for (var i = 0; i < e.teile.length; i++) {
      var t = e.teile[i];
      if (t && t.texture && t.texture.key === allg) {
        var w = t.displayWidth, h = t.displayHeight;
        t.setTexture(sym).setDisplaySize(w, h);
        e.art = sym;
        e.modus = modeId;
        break;
      }
    }
    return true;
  }

  /** Ziel erfuellt/verfehlt als Toast; true = gezeigt (dann kein alter Text). */
  function zielToast(scene, failed) {
    var R = (typeof window !== 'undefined') ? window.RoomMode : null;
    var m = (R && typeof R.activeModeId === 'function') ? R.activeModeId() : null;
    if (!m || m === 'clear') return false;
    var eigen = 'roommode.toast.' + m + (failed ? '.verfehlt' : '.erfuellt');
    var text = _t(eigen);
    if (text === eigen) text = _t(failed ? 'roommode.toast.verfehlt' : 'roommode.toast.erfuellt');
    return toast(scene, m, (failed ? '✗ ' : '✓ ') + text);
  }

  var RoomModeBilder = {
    aktiv: aktiv, vorladen: vorladen, hat: hat,
    altarKey: altarKey, altarZustand: altarZustand,
    siegel: siegel, schwebe: schwebe,
    symbolKey: symbolKey, toast: toast, zielToast: zielToast,
    BILDER: BILDER, SIEGEL: SIEGEL, SYMBOL: SYMBOL
  };
  if (typeof window !== 'undefined') window.RoomModeBilder = RoomModeBilder;
  if (typeof module !== 'undefined' && module.exports) module.exports = RoomModeBilder;
})();
