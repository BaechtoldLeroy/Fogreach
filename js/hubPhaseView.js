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

  // --- Anschlagtafel (Vektor) -------------------------------------------------
  // Die drei Ratsfraktionen haengen je ein Plakat aus — "Drei Farben, ein
  // Ergebnis". Genau dieses Motiv traegt die Kippung: frisch und dreifarbig im
  // Rats-Hub, vergilbt und angeglichen im Doppelspiel, zerfetzt nach dem Bruch,
  // abgeraeumt im Epilog. Keine Fraktionsfarben im Code definiert -> plausibel
  // gesetzt: Magistrat Gold, Klerus Knochenweiss, Garde Rot.
  var FACTION_INK = [
    { fresh: 0xe0b854, faded: 0xa08c55 },  // Magistrat
    { fresh: 0xd3dce4, faded: 0x9aa2a8 },  // Klerus
    { fresh: 0xb4483a, faded: 0x8a5a50 }   // Garde
  ];

  // Dreht lokale Punkte um (pcx,pcy) und liefert Phaser-Punktobjekte.
  function _rot(pts, pcx, pcy, tilt) {
    var c = Math.cos(tilt), s = Math.sin(tilt);
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var dx = pts[i][0] - pcx, dy = pts[i][1] - pcy;
      out.push({ x: pcx + dx * c - dy * s, y: pcy + dx * s + dy * c });
    }
    return out;
  }

  function _quad(x, y, w, h, tilt) {
    return _rot([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], x + w / 2, y + h / 2, tilt);
  }

  // Rest eines abgerissenen Plakats: obere Kante ganz, unten ausgefranst.
  function _shred(x, y, w, h, tilt) {
    return _rot([
      [x, y], [x + w, y],
      [x + w, y + h * 0.44], [x + w * 0.78, y + h * 0.63],
      [x + w * 0.60, y + h * 0.37], [x + w * 0.42, y + h * 0.68],
      [x + w * 0.24, y + h * 0.42], [x, y + h * 0.71]
    ], x + w / 2, y + h / 2, tilt);
  }

  // cx = Mitte, baseY = Standlinie (Fuesse), damit die Tafel auf dem Boden
  // steht und ueber die Depth ihrer Standlinie in die y-Sortierung passt.
  function _drawNoticeBoard(scene, cx, baseY, state) {
    var g = scene.add.graphics();
    var panelW = 56, panelH = 62, legH = 24, legW = 6;
    var bot = baseY - legH;
    var top = bot - panelH;
    var left = cx - panelW / 2;
    var right = cx + panelW / 2;

    // Bodenschatten — verankert die Tafel optisch auf dem Pflaster.
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(cx, baseY + 2, panelW * 0.85, 9);

    // Pfosten: dunkler Kern mit hellerer Vorderkante (Rundung angedeutet).
    [cx - 19, cx + 13].forEach(function (px) {
      g.fillStyle(0x2e2218, 1);
      g.fillRect(px, bot - 2, legW, legH + 2);
      g.fillStyle(0x4a3728, 1);
      g.fillRect(px, bot - 2, legW - 2, legH + 2);
    });
    // Querstrebe
    g.fillStyle(0x3b2c20, 1);
    g.fillRect(cx - 19, baseY - legH * 0.45, 38, 3);

    // Brett: dunkler Rahmen, darin drei waagrechte Planken mit Fugen.
    g.fillStyle(0x33261b, 1);
    g.fillRect(left - 4, top - 4, panelW + 8, panelH + 8);
    var plankH = panelH / 3;
    for (var i = 0; i < 3; i++) {
      g.fillStyle(i % 2 === 0 ? 0x6b5238 : 0x634c33, 1);
      g.fillRect(left, top + i * plankH, panelW, plankH - 1);
      // Maserung
      g.fillStyle(0x55402a, 0.45);
      g.fillRect(left + 4, top + i * plankH + plankH * 0.35, panelW - 12, 1);
      g.fillRect(left + 10, top + i * plankH + plankH * 0.68, panelW - 24, 1);
    }

    // Kleines Vordach — gibt der Tafel eine erkennbare Silhouette.
    g.fillStyle(0x3b2c20, 1);
    g.fillPoints([
      { x: left - 9, y: top - 4 }, { x: cx, y: top - 17 },
      { x: right + 9, y: top - 4 }, { x: right + 9, y: top - 1 },
      { x: cx, y: top - 13 }, { x: left - 9, y: top - 1 }
    ], true);

    // Drei Plakatplaetze (zwei oben nebeneinander, eines breit darunter).
    var slots = [
      { x: left + 4,  y: top + 5,  w: 21, h: 27, tilt: -0.05 },
      { x: left + 30, y: top + 4,  w: 21, h: 25, tilt:  0.06 },
      { x: left + 9,  y: top + 36, w: 38, h: 21, tilt:  0.02 }
    ];

    slots.forEach(function (sl, idx) {
      var ink = FACTION_INK[idx];

      // Ausgeblichener Fleck: wo lange ein Plakat hing, ist das Holz heller.
      if (state === 'torn' || state === 'gone') {
        g.fillStyle(0x7d6547, 0.5);
        g.fillPoints(_quad(sl.x - 1, sl.y - 1, sl.w + 2, sl.h + 2, sl.tilt), true);
      }

      if (state === 'gone') {
        // Nur noch die Nagelloecher.
        g.fillStyle(0x2b2018, 0.8);
        g.fillCircle(sl.x + sl.w * 0.5, sl.y + 2, 1.4);
        return;
      }

      var faded = (state === 'faded');
      var torn = (state === 'torn');
      var paperCol = torn ? 0xb0a488 : (faded ? 0xd8cba6 : 0xf2e6c8);
      var paperAlpha = torn ? 0.85 : (faded ? 0.9 : 1);
      var inkCol = (faded || torn) ? ink.faded : ink.fresh;
      var pts = torn ? _shred(sl.x, sl.y, sl.w, sl.h, sl.tilt)
                     : _quad(sl.x, sl.y, sl.w, sl.h, sl.tilt);

      // Blatt + feine Kante
      g.fillStyle(paperCol, paperAlpha);
      g.fillPoints(pts, true);
      g.lineStyle(1, 0x6a5c42, faded || torn ? 0.5 : 0.7);
      g.strokePoints(pts, true);

      // Kopfbalken in der Fraktionsfarbe (die "drei Farben").
      var head = _quad(sl.x + 2, sl.y + 2, sl.w - 4, 5, sl.tilt);
      g.fillStyle(inkCol, torn ? 0.7 : (faded ? 0.8 : 1));
      g.fillPoints(head, true);

      // Textzeilen — bei Fetzen nur die obersten, der Rest fehlt ja.
      var lines = torn ? 1 : 3;
      g.fillStyle(0x5b5140, faded || torn ? 0.4 : 0.6);
      for (var li = 0; li < lines; li++) {
        var ly = sl.y + 11 + li * 4.5;
        var lw = (li === lines - 1) ? (sl.w - 10) : (sl.w - 6);
        g.fillPoints(_quad(sl.x + 3, ly, lw, 1.6, sl.tilt), true);
      }

      // Siegel unten rechts (nur solange das Plakat ganz ist).
      if (!torn) {
        g.fillStyle(inkCol, faded ? 0.55 : 0.85);
        g.fillCircle(sl.x + sl.w - 6, sl.y + sl.h - 6, 2.6);
      }

      // Eselsohr: im Doppelspiel loest sich eine Ecke und klappt nach vorn.
      if (faded && idx === 1) {
        g.fillStyle(0xbfb49a, 0.95);
        g.fillTriangle(
          sl.x + sl.w - 7, sl.y + sl.h,
          sl.x + sl.w,     sl.y + sl.h,
          sl.x + sl.w,     sl.y + sl.h - 7
        );
      }

      // Nagel oben
      g.fillStyle(0x2b2018, 0.9);
      g.fillCircle(sl.x + sl.w * 0.5, sl.y + 2, 1.4);
    });

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
