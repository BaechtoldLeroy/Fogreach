// js/hubPhaseView.js — Hub-Phasen-Darstellung (Feature 064 WP02).
//
// Wendet eine Phase (aus HubPhase) auf die bestehende Hub-Szene an: Tint/
// Entsaettigung, Nebel-Overlay, Anschlagtafeln-Zustand, feindliches Rathaus.
// Code-gezeichnet mit Asset-Austauschpunkt (assetKey -> textures.exists ->
// Textur, sonst Fallback). Idempotent: erneuter apply raeumt die vorherigen
// Overlays ab (kein Aufstapeln). Kontrakt:
// kitty-specs/064-hub-evolution/contracts/hub-phase-view-contract.md.
//
// Classic Script: window.HubPhaseView. Alle GameObjects scrollFactor(0).
(function () {
  'use strict';

  var NOOP = { destroy: function () {} };

  function apply(scene, phase, refs) {
    if (!scene || typeof window === 'undefined' || !window.HubPhase
        || !refs || !refs.bg) {
      return NOOP;
    }

    // Idempotenz: vorherige View-Overlays dieser Szene abraeumen.
    if (scene._hubPhaseViewObjs) {
      scene._hubPhaseViewObjs.forEach(function (o) { try { if (o) o.destroy(); } catch (_) {} });
      scene._hubPhaseViewObjs = null;
    }
    try { if (refs.bg.clearTint) refs.bg.clearTint(); } catch (_) {}

    var STYLE = window.HubPhase.PHASE_STYLE || {};
    var s = STYLE[phase] || STYLE.council || {
      tint: 0xffffff, desaturate: 0, fog: 0, posters: 'fresh', assetKey: null, rathausHostile: false
    };
    var cam = scene.cameras.main;
    var depth = (refs.overlayDepth != null) ? refs.overlayDepth : 90;
    var objs = [];

    function track(o) {
      if (o) { try { if (o.setScrollFactor) o.setScrollFactor(0); } catch (_) {} objs.push(o); }
      return o;
    }

    // --- Asset-Austauschpunkt --------------------------------------------------
    var hasAsset = s.assetKey && scene.textures && scene.textures.exists
      && scene.textures.exists(s.assetKey);
    if (hasAsset) {
      // Phasen-Textur ueber dem Hintergrund; ersetzt die code-gezeichneten
      // Tint/Poster-Effekte. Nebel wird zur Atmosphaere trotzdem gelegt.
      var img = scene.add.image(refs.bg.x || 0, refs.bg.y || 0, s.assetKey);
      if (img.setOrigin) img.setOrigin(refs.bg.originX != null ? refs.bg.originX : 0.5,
                                       refs.bg.originY != null ? refs.bg.originY : 0.5);
      img.setDepth(depth);
      track(img);
    } else {
      // --- Code-gezeichnet -----------------------------------------------------
      if (s.tint && s.tint !== 0xffffff && refs.bg.setTint) {
        try { refs.bg.setTint(s.tint); } catch (_) {}
      }
      // Entsaettigung: kuehle, halbtransparente Overlay-Flaeche.
      if (s.desaturate > 0) {
        track(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
          0x223044, s.desaturate * 0.5).setDepth(depth));
      }
      // Anschlagtafeln (heuristische Positionen oben-mittig; kein Layout-Umbau).
      if (s.posters && s.posters !== 'fresh') {
        var strength = s.posters === 'faded' ? 0.35 : (s.posters === 'torn' ? 0.55 : 0.85);
        [[0.42, 0.30], [0.58, 0.32]].forEach(function (p) {
          track(scene.add.rectangle(cam.width * p[0], cam.height * p[1], 72, 92,
            0x1a1712, strength).setDepth(depth + 1));
        });
      }
    }

    // --- Nebel-Overlay (immer, Staerke aus Style) -------------------------------
    if (s.fog > 0) {
      var fogColor = (phase === 'epilogue') ? 0xdfe4ea : 0x8a8f98;
      track(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
        fogColor, s.fog).setDepth(depth + 2));
    }

    // --- Feindliches Rathaus ----------------------------------------------------
    if (s.rathausHostile && refs.rathausRect) {
      var r = refs.rathausRect;
      track(scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h,
        0x8b1a1a, 0.28).setDepth(depth + 3));
      var g = scene.add.graphics().setDepth(depth + 3);
      g.lineStyle(3, 0xb02020, 0.9).strokeRect(r.x, r.y, r.w, r.h);
      track(g);
    }

    scene._hubPhaseViewObjs = objs;

    return {
      destroy: function () {
        objs.forEach(function (o) { try { if (o) o.destroy(); } catch (_) {} });
        scene._hubPhaseViewObjs = null;
        try { if (refs.bg && refs.bg.clearTint) refs.bg.clearTint(); } catch (_) {}
      }
    };
  }

  window.HubPhaseView = { apply: apply };
})();
