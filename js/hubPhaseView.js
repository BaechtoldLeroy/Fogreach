// js/hubPhaseView.js — Hub-Phasen-Darstellung (Feature 064 WP02).
//
// Wendet eine Phase (aus HubPhase) auf die bestehende Hub-Szene an: Tint/
// Entsättigung, Nebel-Overlay, Anschlagtafeln-Zustand, feindliches Rathaus.
// Code-gezeichnet mit Asset-Austauschpunkt (assetKey -> textures.exists ->
// Textur, sonst Fallback). Idempotent: erneuter apply räumt die vorherigen
// Overlays ab (kein Aufstapeln). Kontrakt:
// kitty-specs/064-hub-evolution/contracts/hub-phase-view-contract.md.
//
// Classic Script: window.HubPhaseView. Alle GameObjects scrollFactor(0).
(function () {
  'use strict';

  var NOOP = { destroy: function () {} };

  // --- Anschlagtafel (Vektor) -------------------------------------------------
  // Die drei Ratsfraktionen hängen je ein Plakat aus — "Drei Farben, ein
  // Ergebnis". Genau dieses Motiv trägt die Kippung: frisch und dreifarbig im
  // Rats-Hub, vergilbt und angeglichen im Doppelspiel, zerfetzt nach dem Bruch,
  // abgeräumt im Epilog. Keine Fraktionsfarben im Code definiert -> plausibel
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

  // --- Feindliches Rathaus ----------------------------------------------------
  // Ein Balken quer, gedreht über die Verbindungslinie zweier Punkte.
  function _plank(g, x1, y1, x2, y2, w) {
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var dx = Math.sin(ang) * w / 2, dy = -Math.cos(ang) * w / 2;
    var pts = [
      { x: x1 + dx, y: y1 + dy }, { x: x2 + dx, y: y2 + dy },
      { x: x2 - dx, y: y2 - dy }, { x: x1 - dx, y: y1 - dy }
    ];
    g.fillStyle(0x4a3728, 1);
    g.fillPoints(pts, true);
    // Maserung entlang der Achse + hellere Oberkante
    g.fillStyle(0x63492f, 0.8);
    g.fillPoints([
      { x: x1 + dx, y: y1 + dy }, { x: x2 + dx, y: y2 + dy },
      { x: x2 + dx * 0.3, y: y2 + dy * 0.3 }, { x: x1 + dx * 0.3, y: y1 + dy * 0.3 }
    ], true);
    // Nägel an den Enden
    g.fillStyle(0x1e1710, 0.9);
    g.fillCircle(x1 + (x2 - x1) * 0.06, y1 + (y2 - y1) * 0.06, 2);
    g.fillCircle(x1 + (x2 - x1) * 0.94, y1 + (y2 - y1) * 0.94, 2);
  }

  // Durchhängende Kette aus einzelnen Gliedern — das Motiv des Kettenrats.
  function _chain(g, x1, y1, x2, y2, sag, linkR) {
    var n = Math.max(8, Math.round(Math.abs(x2 - x1) / (linkR * 1.5)));
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var x = x1 + (x2 - x1) * t;
      var y = y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * sag;
      g.fillStyle(0x23232a, 1);
      g.fillCircle(x, y, linkR);
      g.fillStyle(0x74747f, 0.85);
      g.fillCircle(x - linkR * 0.22, y - linkR * 0.3, linkR * 0.42);
    }
  }

  // cx = Mitte, baseY = Standlinie (Füsse), damit die Tafel auf dem Boden
  // steht und über die Depth ihrer Standlinie in die y-Sortierung passt.
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

    // Vordach: kleines Satteldach mit Schindeln, Traufbrett, Firstbalken und
    // Kopfbändern. Vorher war das ein flaches dunkles Zickzack-Polygon ohne
    // Tiefe — hier tragen Zweitonung (links belichtet, rechts im Schatten),
    // Schattenwurf aufs Brett und versetzte Stossfugen die Plastizität.
    var eaveY = top - 6, peakY = top - 22;
    var ovr = 11, lx = left - ovr, rx = right + ovr;
    var halfSpan = (rx - lx) / 2, rise = eaveY - peakY;

    // Schattenwurf des Dachs auf die oberste Planke
    g.fillStyle(0x1d150e, 0.4);
    g.fillRect(left - 4, top - 4, panelW + 8, 5);

    // Dachflächen — linke Seite zum Licht, rechte im Schatten
    g.fillStyle(0x634a33, 1);
    g.fillPoints([{ x: lx, y: eaveY }, { x: cx, y: peakY }, { x: cx, y: eaveY }], true);
    g.fillStyle(0x3f2e1e, 1);
    g.fillPoints([{ x: cx, y: peakY }, { x: rx, y: eaveY }, { x: cx, y: eaveY }], true);

    // Schindelreihen, nach oben schmaler werdend, mit versetzten Stossfugen
    for (var c = 1; c <= 3; c++) {
      var ct = c / 4;
      var cyy = eaveY - rise * ct;
      var chw = halfSpan * (1 - ct);
      g.fillStyle(0x2f2317, 0.5);
      g.fillRect(cx - chw, cyy, chw * 2, 1);
      g.fillStyle(0x2f2317, 0.3);
      var off = (c % 2) ? 4 : 0;
      for (var sx = cx - chw + off; sx < cx + chw - 1; sx += 8) {
        g.fillRect(sx, cyy, 1, rise / 4);
      }
    }

    // Traufbrett mit heller Oberkante
    g.fillStyle(0x33261b, 1);
    g.fillRect(lx, eaveY, rx - lx, 3);
    g.fillStyle(0x7a5c3e, 0.5);
    g.fillRect(lx, eaveY, rx - lx, 1);

    // Firstbalken + kleiner Knauf
    g.fillStyle(0x2a1e14, 1);
    g.fillRect(cx - 5, peakY - 1, 10, 3);
    g.fillCircle(cx, peakY - 3, 2);

    // Kopfbänder: kleine Streben vom Rahmen zur Traufe
    g.fillStyle(0x3b2c20, 1);
    g.fillTriangle(left - 4, top + 10, left - 4, top - 2, lx + 1, top - 2);
    g.fillTriangle(right + 4, top + 10, right + 4, top - 2, rx - 1, top - 2);

    // Drei Plakatplätze (zwei oben nebeneinander, eines breit darunter).
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
        // Nur noch die Nagellöcher.
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

      // Eselsohr: im Doppelspiel löst sich eine Ecke und klappt nach vorn.
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

    // Idempotenz: vorherige View-Overlays dieser Szene abräumen.
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
    // Welt-Ebene: Dinge, die AN der Kulisse hängen (Phasen-Textur, Rathaus-
    // Markierung). Liegen über dem Hintergrund (Depth 0), aber unter den
    // Figuren (y-sortiert ab ~200) — man läuft davor.
    var depth = (refs.overlayDepth != null) ? refs.overlayDepth : 90;
    // Atmosphäre-Ebene: Vollbild-Schleier + Nebel. MUSS über den Figuren
    // liegen, sonst steht der Spieler im Nebel statt dahinter. Unter der
    // UI (Menü-Knopf 1300, Dialoge ab 1500), damit Bedienung lesbar bleibt.
    var atmoDepth = (refs.atmosphereDepth != null) ? refs.atmosphereDepth : 1250;
    var objs = [];

    // scrollFactor ist KEIN Detail: 0 = bildschirmfest (Vollbild-Atmosphäre),
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
      // Phasen-Textur über dem Hintergrund; ersetzt den code-gezeichneten Tint.
      // Weltfest (hängt an der Kulisse, nicht am Bildschirm).
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
    // Die Hub-Grafik enthält keine Anschlagtafeln, also werden sie hier als
    // Vektor-Platzhalter gezeichnet. Positionen kommen als WELTkoordinaten in
    // refs.posterSpots (flankierend zur Rathaustreppe) — so hängen die
    // zerrissenen Reste in 'broken' an Aldrics eigenem Gebäude.
    // Früher: zwei dunkle Rechtecke an geratenen Bildschirm-Prozenten mit
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

    // --- Vollbild-Atmosphäre (über den Figuren, bildschirmfest) ---------------
    // Farbstich/Entsättigung: kühle, halbtransparente Fläche über der
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

    // --- Feindliches Rathaus (weltfest — markiert ein Gebäude) -----------------
    if (s.rathausHostile && refs.rathausRect) {
      var r = refs.rathausRect;
      // 1) Das Gebäude wirkt erloschen: dunkler, leicht rotstichiger Schleier
      //    statt des früheren knallroten Kastens mit rotem Rahmen.
      track(scene.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h,
        0x2a0d0d, 0.18).setDepth(depth + 3), 1);

      var g = scene.add.graphics().setDepth(depth + 4);
      // Eingang: aus den Refs, sonst grob aus dem Gebäuderechteck geschätzt.
      var ent = refs.rathausEntrance || {
        x: r.x + r.w * 0.38, y: r.y + r.h * 0.86, w: r.w * 0.24, h: r.h * 0.16
      };
      var dcx = ent.x + ent.w / 2;
      var dTop = ent.y - 30;
      var dBot = ent.y + ent.h;
      var half = ent.w / 2;

      // 2) Zwei gekreuzte Bretter über der Tür — vernagelt.
      _plank(g, dcx - half - 7, dTop + 8, dcx + half + 7, dBot - 6, 9);
      _plank(g, dcx + half + 7, dTop + 8, dcx - half - 7, dBot - 6, 9);

      // 3) Schwere Kette quer davor. Der Rat heisst Kettenrat — nach dem Bruch
      //    hängt seine eigene Kette vor der Tür.
      var cy0 = dTop + 12;
      g.fillStyle(0x1a1a1f, 1);
      g.fillCircle(dcx - half - 16, cy0, 4);   // Ankerring links
      g.fillCircle(dcx + half + 16, cy0, 4);   // Ankerring rechts
      _chain(g, dcx - half - 16, cy0, dcx + half + 16, cy0, 13, 3.4);

      // 4) Amtssiegel, das am tiefsten Punkt der Kette hängt.
      var sy = cy0 + 13;
      g.fillStyle(0x2b2b30, 1);
      g.fillRect(dcx - 1, sy, 2, 7);
      g.fillStyle(0x7a1414, 1);
      g.fillCircle(dcx, sy + 12, 7);
      g.fillStyle(0x3d0a0a, 0.85);
      g.fillCircle(dcx, sy + 12, 4);
      g.fillStyle(0xa33030, 0.7);
      g.fillCircle(dcx - 2, sy + 10, 2);

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
