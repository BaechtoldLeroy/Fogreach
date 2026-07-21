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

  // Anschlagtafel als Vektor-Platzhalter (bis es echte Plakat-Assets gibt).
  // `state` kommt aus PHASE_STYLE.posters:
  //   fresh -> frische Wahlkampfplakate, faded -> vergilbt, torn -> Fetzen,
  //   gone  -> abgeraeumtes, leeres Brett.
  // cx = Mitte, baseY = Standlinie (Fuesse), damit die Tafel auf dem Boden
  // steht und ueber die Depth ihrer Standlinie in die y-Sortierung passt.
  function _drawNoticeBoard(scene, cx, baseY, state) {
    var g = scene.add.graphics();
    var panelW = 40, panelH = 46, legH = 18, legW = 5;
    var top = baseY - legH - panelH;
    var left = cx - panelW / 2;

    // Beine
    g.fillStyle(0x3b2c20, 1);
    g.fillRect(cx - 13, baseY - legH, legW, legH);
    g.fillRect(cx + 13 - legW, baseY - legH, legW, legH);

    // Rahmen + Brett
    g.fillStyle(0x4a3728, 1);
    g.fillRect(left - 3, top - 3, panelW + 6, panelH + 6);
    g.fillStyle(0x6b5238, 1);
    g.fillRect(left, top, panelW, panelH);

    if (state !== 'gone') {
      var paper, alpha;
      if (state === 'faded') { paper = 0xcfc3a0; alpha = 0.75; }
      else if (state === 'torn') { paper = 0x9a8f76; alpha = 0.60; }
      else { paper = 0xf2e6c8; alpha = 0.95; }

      g.fillStyle(paper, alpha);
      if (state === 'torn') {
        // Fetzen statt ganzer Blaetter — Reste, die noch am Brett haengen.
        g.fillTriangle(left + 5, top + 6, left + 19, top + 5, left + 8, top + 24);
        g.fillTriangle(left + 24, top + 20, left + 35, top + 16, left + 31, top + 38);
      } else {
        g.fillRect(left + 5, top + 5, 13, 18);
        g.fillRect(left + 22, top + 7, 13, 16);
        g.fillRect(left + 9, top + 27, 22, 14);
      }
    }
    return g;
  }

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

    // --- Anschlagtafeln (weltfest, y-sortiert wie Figuren) ---------------------
    // Die Hub-Grafik enthaelt keine Anschlagtafeln, also werden sie hier als
    // Vektor-Platzhalter gezeichnet. Positionen kommen als WELTkoordinaten in
    // refs.posterSpots (flankierend zur Rathaustreppe) — so haengen die
    // zerrissenen Reste in 'broken' an Aldrics eigenem Gebaeude.
    // Frueher: zwei dunkle Rechtecke an geratenen Bildschirm-Prozenten mit
    // scrollFactor(0) — die klebten am Bildschirm und wanderten mit.
    if (!hasAsset && s.posters && Array.isArray(refs.posterSpots)) {
      refs.posterSpots.forEach(function (p) {
        if (!p) return;
        var board = _drawNoticeBoard(scene, p.x, p.y, s.posters);
        // Depth = Standlinie: Figuren, die davor stehen, verdecken sie korrekt.
        board.setDepth(p.y);
        track(board, 1);
      });
    }

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
