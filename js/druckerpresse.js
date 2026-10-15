// js/druckerpresse.js — Die stampfende Druckerpresse (#198).
//
// Pixelbild aus PixelLab (tools/presseBauen.js): 9 Bilder 128x128 in einer
// Zeile, Bild 0 ist die Ruhe, um Bild 3 trifft die Platte das Papier. Beim
// Treffen fliegen Flugblaetter.
//
// Gebraucht in
//   - der Druckerei (PrintingHouseScene): beim Drucken eines Edikts stampft die
//     Presse kurz, bevor das Fenster schliesst — Vorschau ?presse=neu
//   - dem Trailer (Einstellung 8): die Presse gross im Bild
(function () {
  'use strict';

  var KEY = 'druckerpresse';
  var URL = 'assets/sprites/presse/druckerpresse.png';
  var ANIM = 'druckerpresse_stampfen';
  var BILDER = 9, KANTE = 128;
  var TREFFER = 3;                       // Bild, in dem die Platte aufliegt
  var PAPIER = { x: 0.5, y: 0.6 };       // wo das Blatt liegt (Anteil des Bildes)

  function an() { return !!(window.DebugGate && typeof window.DebugGate.an === 'function' && window.DebugGate.an('presse')); }
  function da(scene) { return !!(scene && scene.textures && scene.textures.exists(KEY)); }

  /** Laedt das Bild, falls es fehlt; fertig() sobald es da ist (oder sofort). */
  function vorladen(scene, fertig) {
    if (!scene || !scene.load) { if (fertig) fertig(false); return; }
    if (da(scene)) { if (fertig) fertig(true); return; }
    try {
      scene.load.spritesheet(KEY, URL, { frameWidth: KANTE, frameHeight: KANTE });
      if (fertig) {
        scene.load.once('complete', function () { fertig(da(scene)); });
        scene.load.once('loaderror', function () { fertig(da(scene)); });
      }
      if (!scene.load.isLoading()) scene.load.start();
    } catch (e) { if (fertig) fertig(false); }
  }

  function _anim(scene) {
    if (scene.anims.exists(ANIM)) return;
    scene.anims.create({
      key: ANIM,
      frames: scene.anims.generateFrameNumbers(KEY, { start: 0, end: BILDER - 1 }),
      frameRate: 12, repeat: 0
    });
  }

  /** Ein Schwall Flugblaetter von (x, y) aus — kleine Blaetter, die hochwirbeln und fallen. */
  function flugblaetter(scene, x, y, n, tiefe, fest) {
    var teile = [];
    for (var i = 0; i < n; i++) {
      var w = 7 + Math.random() * 5, h = w * 1.3;
      var blatt = scene.add.rectangle(x, y, w, h, 0xefe3c4, 1).setStrokeStyle(1, 0x5a4a35, 0.9).setDepth(tiefe);
      if (fest) blatt.setScrollFactor(0);
      var dx = (Math.random() - 0.5) * 260, hoch = 60 + Math.random() * 110;
      scene.tweens.add({ targets: blatt, x: x + dx, y: y - hoch, angle: (Math.random() - 0.5) * 540, duration: 420, ease: 'Quad.easeOut' });
      scene.tweens.add({
        targets: blatt, y: y - hoch + 140 + Math.random() * 80, alpha: 0, delay: 420,
        duration: 900 + Math.random() * 500, ease: 'Sine.easeIn',
        onComplete: function () { this.targets[0].destroy(); }
      });
      teile.push(blatt);
    }
    return teile;
  }

  /**
   * Laesst die Presse an (x, y) stampfen.
   * @param {object} [wie] { skala (3), stoesse (2), tiefe (2010), fest (scrollFactor 0), blaetter (8), beiStoss(), fertig(sprite) }
   * @returns {Phaser.GameObjects.Sprite|null} null ohne Bild
   */
  function stampfen(scene, x, y, wie) {
    wie = wie || {};
    if (!da(scene) || !scene.anims) return null;
    _anim(scene);
    var skala = wie.skala || 3, tiefe = wie.tiefe || 2010;
    var s = scene.add.sprite(x, y, KEY, 0).setScale(skala).setDepth(tiefe).setName('druckerpresse');
    if (wie.fest) s.setScrollFactor(0);
    var rest = wie.stoesse || 2;
    s.on('animationupdate', function (anim, frame) {
      if (anim.key !== ANIM || !frame || frame.index !== TREFFER + 1) return;   // index ist 1-basiert
      var bx = s.x + (PAPIER.x - 0.5) * KANTE * skala, by = s.y + (PAPIER.y - 0.5) * KANTE * skala;
      flugblaetter(scene, bx, by, wie.blaetter || 8, tiefe + 1, !!wie.fest);
      try { if (scene.cameras && scene.cameras.main) scene.cameras.main.shake(120, 0.004); } catch (e) {}
      if (typeof wie.beiStoss === 'function') { try { wie.beiStoss(); } catch (e) {} }
    });
    s.on('animationcomplete', function () {
      rest--;
      if (rest > 0) { s.play(ANIM); return; }
      s.setFrame(0);
      if (typeof wie.fertig === 'function') { try { wie.fertig(s); } catch (e) {} }
    });
    s.play(ANIM);
    return s;
  }

  /**
   * Druckerei: das gedruckte Edikt — dunkler Grund, die Presse stampft zweimal
   * mittig ueber der Ansicht, dann fertig().
   */
  function druckSzene(scene, fertig) {
    if (!da(scene)) { if (fertig) fertig(); return false; }
    var b = scene.cameras.main.width, h = scene.cameras.main.height;
    var grund = scene.add.rectangle(b / 2, h / 2, b, h, 0x05060a, 0).setScrollFactor(0).setDepth(2400).setName('druckGrund');
    scene.tweens.add({ targets: grund, fillAlpha: 0.82, duration: 200 });
    var presse = stampfen(scene, b / 2, h / 2 - 20, {
      skala: Math.max(2, Math.min(4, Math.floor(h / 230))), stoesse: 2, tiefe: 2401, fest: true, blaetter: 10,
      fertig: function (s) {
        scene.tweens.add({
          targets: [s, grund], alpha: 0, duration: 250,
          onComplete: function () { s.destroy(); grund.destroy(); if (fertig) fertig(); }
        });
      }
    });
    return !!presse;
  }

  window.Druckerpresse = {
    KEY: KEY, ANIM: ANIM, BILDER: BILDER, TREFFER: TREFFER,
    an: an, da: da, vorladen: vorladen, stampfen: stampfen, flugblaetter: flugblaetter, druckSzene: druckSzene
  };
})();
