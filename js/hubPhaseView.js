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
    // Welt-Ebene: Dinge, die AN der Kulisse haengen (Phasen-Textur, Rathaus-
    // Markierung). Liegen ueber dem Hintergrund (Depth 0), aber unter den
    // Figuren (y-sortiert ab ~200) — man laeuft davor.
    var depth = (refs.overlayDepth != null) ? refs.overlayDepth : 90;
    // Atmosphaere-Ebene: Vollbild-Schleier + Nebel. MUSS ueber den Figuren
    // liegen, sonst steht der Spieler im Nebel statt dahinter. Unter der
    // UI (Menue-Knopf 1300, Dialoge ab 1500), damit Bedienung lesbar bleibt.
    var atmoDepth = (refs.atmosphereDepth != null) ? refs.atmosphereDepth : 1250;
    var objs = [];

    // scrollFactor ist KEIN Detail: 0 = bildschirmfest (Vollbild-Atmosphaere),
    // 1 = weltfest (alles, was an einem Ort in der Stadt klebt). Vorher wurde
    // pauschal 0 gesetzt — dadurch wanderte die Rathaus-Markierung mit dem
    // Spieler mit, obwohl ihre Koordinaten Weltkoordinaten sind.
    function track(o, scrollFactor) {
      if (o) {
        try {
          if (o.setScrollFactor) o.setScrollFactor(scrollFactor == null ? 0 : scrollFactor);
        } catch (_) {}
        objs.push(o);
      }
      return o;
    }

    // --- Asset-Austauschpunkt --------------------------------------------------
    var hasAsset = s.assetKey && scene.textures && scene.textures.exists
      && scene.textures.exists(s.assetKey);
    if (hasAsset) {
      // Phasen-Textur ueber dem Hintergrund; ersetzt den code-gezeichneten Tint.
      // Weltfest (haengt an der Kulisse, nicht am Bildschirm).
      var img = scene.add.image(refs.bg.x || 0, refs.bg.y || 0, s.assetKey);
      if (img.setOrigin) img.setOrigin(refs.bg.originX != null ? refs.bg.originX : 0.5,
                                       refs.bg.originY != null ? refs.bg.originY : 0.5);
      img.setDepth(depth);
      track(img, 1);
    } else if (s.tint && s.tint !== 0xffffff && refs.bg.setTint) {
      // --- Code-gezeichnet: Tint direkt auf die Kulisse ------------------------
      try { refs.bg.setTint(s.tint); } catch (_) {}
    }

    // Anschlagtafeln: BEWUSST nicht gezeichnet. Die Hub-Grafik (assets/
    // hubscene.png) enthaelt gar keine Anschlagtafeln — es gibt nichts, was
    // verblassen oder zerreissen koennte. Frueher wurden hier zwei dunkle
    // Rechtecke an geratenen Bildschirm-Prozentpositionen gemalt; die klebten
    // am Bildschirm und wanderten mit dem Spieler mit. Das Style-Feld
    // `posters` bleibt Teil des Kontrakts, damit echte Plakat-Assets es
    // spaeter auswerten koennen.

    // --- Vollbild-Atmosphaere (ueber den Figuren, bildschirmfest) ---------------
    // Farbstich/Entsaettigung: kuehle, halbtransparente Flaeche ueber der
    // ganzen Szene — greift jetzt auch auf Figuren, nicht nur auf den Boden.
    if (s.desaturate > 0) {
      track(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
        0x223044, s.desaturate * 0.5).setDepth(atmoDepth), 0);
    }
    if (s.fog > 0) {
      var fogColor = (phase === 'epilogue') ? 0xdfe4ea : 0x8a8f98;
      track(scene.add.rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height,
        fogColor, s.fog).setDepth(atmoDepth + 1), 0);
    }

    // --- Feindliches Rathaus (weltfest — markiert ein Gebaeude) -----------------
    if (s.rathausHostile && refs.rathausRect) {
      var r = refs.rathausRect;
      track(scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h,
        0x8b1a1a, 0.28).setDepth(depth + 3), 1);
      var g = scene.add.graphics().setDepth(depth + 3);
      g.lineStyle(3, 0xb02020, 0.9).strokeRect(r.x, r.y, r.w, r.h);
      track(g, 1);
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
