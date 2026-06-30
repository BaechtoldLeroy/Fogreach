/* =====================================================================
 * espionageVisuals.js — Sichtbarkeitsschicht fuer Espionage-Missionen
 * ---------------------------------------------------------------------
 * Feature 055 lieferte die Stealth-MECHANIK (espionageSystem.js), aber kein
 * klares Feedback. Dieses Modul rendert den Missions-State, OHNE die testbare
 * Logik zu beruehren. #54-Redesign:
 *
 *   - Detection-RING am Spieler (gruen->gelb->rot) — der zentrale, bisher
 *     unsichtbare detection-Zustand wird sichtbar (auch die Recovery-Phase).
 *   - Status-CHIP (VERKLEIDET / VERDAECHTIG / ENTTARNT / ABGEHOERT) + kurze
 *     Aktionszeile statt langem Negativ-Banner.
 *   - Wachen-Sichtradien IMMER (dezent gedimmt, intensivieren mit detection /
 *     bei Enttarnung) — die Welt wird lesbar.
 *   - Deckungs-Zonen (blau-gruen) — der _inCover-Vorteil wird sichtbar.
 *   - Off-screen-Pfeil zur naechsten Abhoer-Zone.
 *   - Enttarn-Moment: Kamera-Flash + Shake + Sound (Flankenerkennung).
 *
 * Selbstverwaltend: sync(scene) wird jeden Frame aus dem GameScene-Update
 * aufgerufen, no-op ausserhalb einer Mission.
 * ===================================================================== */
(function () {
  'use strict';

  var DEPTH_WORLD = 520;   // ueber Boden/Gegnern, unter HUD
  var DEPTH_HUD = 1640;    // ueber dem normalen HUD-Layer

  var mounted = false;
  var g = null;            // world-space Graphics (Zonen/Wachen/Deckung/Ring)
  var gHud = null;         // HUD-space Graphics (Off-screen-Pfeil)
  var banner = null;       // HUD-Text (kurze Aktionszeile)
  var bannerBg = null;
  var chipBg = null;       // Status-Chip Hintergrund
  var chipText = null;     // Status-Chip Text
  var zoneLabels = [];     // Text-Labels an den Abhoer-Zonen
  var guardSprites = [];   // echte Wachen-Sprites (statt Kreise)
  var _guardTex = null;    // aufgeloeste Wachen-Textur (ChainGuard o.ae.)
  var disguiseSpr = null;  // Verkleidungs-Overlay (Umhang/Kapuze) am Spieler
  var _t = 0;              // Pulse-Akkumulator
  var _prevExposed = false;
  var _cw = 1536, _ch = 800;

  // Echte Wachen-Textur aufloesen (ChainGuard passt zum Kettenrat-Warenhaus);
  // Fallback: einmalig eine simple Wachen-Figur generieren.
  function _resolveGuardTex(scene) {
    var cands = ['chainguard_right0', 'sprite_chainguard', 'enemyChainGuard', 'imp_right0', 'sprite_imp', 'enemyImp'];
    for (var i = 0; i < cands.length; i++) {
      if (scene.textures && scene.textures.exists(cands[i])) return cands[i];
    }
    if (scene.textures && !scene.textures.exists('esp_guard_fallback')) {
      try {
        var gg = scene.make.graphics({ add: false });
        gg.fillStyle(0x3a3f52, 1); gg.fillRoundedRect(5, 9, 18, 20, 5);   // Koerper
        gg.fillStyle(0x6a7088, 1); gg.fillCircle(14, 8, 7);                // Kopf
        gg.lineStyle(2, 0x9aa2bd, 1); gg.strokeRoundedRect(5, 9, 18, 20, 5);
        gg.generateTexture('esp_guard_fallback', 28, 32); gg.destroy();
      } catch (e) {}
    }
    return 'esp_guard_fallback';
  }

  var _disguiseDir = false;  // true = directionale ChainGuard-Frames verfuegbar

  // Verkleidungs-Textur aufloesen: die Verkleidung ist eine Kettenrat-Waechter-
  // Montur (echtes Sprite), damit man optisch als Wache durchgeht. Fallback:
  // gezeichneter Kapuzen-Umhang.
  function _resolveDisguiseTex(scene) {
    var tx = scene.textures;
    if (tx && tx.exists('chainguard_right0')) { _disguiseDir = true; return 'chainguard_right0'; }
    if (tx && tx.exists('sprite_chainguard')) { _disguiseDir = false; return 'sprite_chainguard'; }
    if (tx && tx.exists('enemyChainGuard')) { _disguiseDir = false; return 'enemyChainGuard'; }
    _ensureDisguiseTex(scene); _disguiseDir = false; return 'esp_disguise';
  }

  // Verkleidungs-Overlay-Textur (Kapuzen-Umhang) einmalig generieren — Fallback,
  // falls keine ChainGuard-Sprites geladen sind.
  function _ensureDisguiseTex(scene) {
    if (!scene.textures || scene.textures.exists('esp_disguise')) return;
    try {
      var gg = scene.make.graphics({ add: false });
      // Umhang (Trapez) + Kapuze (Bogen) — dunkel mit hellem Saum.
      gg.fillStyle(0x20243a, 1);
      gg.beginPath(); gg.moveTo(10, 14); gg.lineTo(30, 14); gg.lineTo(36, 44); gg.lineTo(4, 44); gg.closePath(); gg.fillPath();
      gg.fillStyle(0x14172a, 1); gg.fillCircle(20, 14, 13);              // Kapuze
      gg.fillStyle(0x05060c, 1); gg.fillCircle(20, 16, 8);              // Schatten im Kapuzen-Inneren
      gg.lineStyle(2, 0x99a6e0, 0.9);
      gg.beginPath(); gg.arc(20, 14, 13, Math.PI * 0.85, Math.PI * 2.15, false); gg.strokePath(); // Saum-Kante Kapuze
      gg.generateTexture('esp_disguise', 40, 48); gg.destroy();
    } catch (e) {}
  }

  function _scene() {
    return (typeof window !== 'undefined' && window.currentScene) ? window.currentScene : null;
  }
  function _isEN() {
    return !!(window.i18n && window.i18n.getLanguage && window.i18n.getLanguage() === 'en');
  }

  function mount(scene) {
    if (mounted || !scene || !scene.add) return;
    mounted = true;
    _t = 0;
    _prevExposed = false;
    g = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);
    gHud = scene.add.graphics().setDepth(DEPTH_HUD).setScrollFactor(0);

    // Echte Wachen-Sprites + Verkleidungs-Overlay (Kettenrat-Montur) vorbereiten.
    _guardTex = _resolveGuardTex(scene);
    var _disguiseTex = _resolveDisguiseTex(scene);
    guardSprites = [];
    disguiseSpr = scene.add.sprite(0, 0, _disguiseTex).setDepth(DEPTH_WORLD + 3).setScrollFactor(1).setVisible(false);

    var cam = scene.cameras && scene.cameras.main;
    _cw = cam ? cam.width : 1536;
    _ch = cam ? cam.height : 800;

    // Aktionszeile (kurz) unter dem Status-Chip
    bannerBg = scene.add.rectangle(_cw / 2, 66, Math.min(760, _cw - 40), 28, 0x10131c, 0.8)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(1, 0x5a6580, 0.7);
    banner = scene.add.text(_cw / 2, 66, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cdd9ff', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);

    // Status-Chip (Pille) darueber
    chipBg = scene.add.rectangle(_cw / 2, 40, 150, 26, 0x4a8fd0, 0.95)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(2, 0xffffff, 0.5);
    chipText = scene.add.text(_cw / 2, 40, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);

    zoneLabels = [];
  }

  function unmount() {
    mounted = false;
    [g, gHud, banner, bannerBg, chipBg, chipText, disguiseSpr].forEach(function (o) {
      if (o) { try { o.destroy(); } catch (e) {} }
    });
    g = gHud = banner = bannerBg = chipBg = chipText = disguiseSpr = null;
    for (var i = 0; i < zoneLabels.length; i++) { try { zoneLabels[i].destroy(); } catch (e) {} }
    for (var k = 0; k < guardSprites.length; k++) { try { guardSprites[k].destroy(); } catch (e) {} }
    zoneLabels = [];
    guardSprites = [];
  }

  function _ensureZoneLabels(scene, zones) {
    if (zoneLabels.length === zones.length) return;
    for (var i = 0; i < zoneLabels.length; i++) { try { zoneLabels[i].destroy(); } catch (e) {} }
    zoneLabels = [];
    var txt = _isEN() ? '▼ EAVESDROP' : '▼ ABHOEREN';
    for (var j = 0; j < zones.length; j++) {
      var z = zones[j];
      var lbl = scene.add.text(z.x, z.y - (z.r || 64) - 16, txt, {
        fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffe27a',
        stroke: '#000000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(DEPTH_WORLD + 1).setScrollFactor(1);
      zoneLabels.push(lbl);
    }
  }

  // Status-Chip-Inhalt nach State.
  function _statusInfo(st, allDone) {
    var en = _isEN();
    if (st.exposed) return { txt: en ? '! EXPOSED' : '! ENTTARNT', col: 0xff4444, tcol: '#ffffff', hot: true };
    if (allDone) return { txt: en ? '✓ ALL HEARD' : '✓ ABGEHOERT', col: 0x33cc77, tcol: '#06210f', hot: false };
    if ((st.detection || 0) > 0.05) return { txt: en ? 'SUSPICIOUS' : 'VERDAECHTIG', col: 0xe0a020, tcol: '#1a1200', hot: true };
    return { txt: en ? 'DISGUISED' : 'VERKLEIDET', col: 0x4a8fd0, tcol: '#04121f', hot: false };
  }

  function _actionText(st, allDone) {
    var en = _isEN();
    if (st.exposed) return en ? 'Get out of the red zones to blend back in.'
                              : 'Raus aus den roten Zonen, dann tauchst du wieder unter.';
    if (allDone) return en ? 'Leave via the stairs.' : 'Verlass den Raum ueber die Treppe.';
    return en ? 'Reach the gold circle and wait to listen.'
              : 'Geh in den goldenen Kreis und warte zum Abhoeren.';
  }

  function sync(scene) {
    scene = scene || _scene();
    var active = !!(window.EspionageSystem && typeof window.EspionageSystem.isActive === 'function'
      && window.EspionageSystem.isActive());
    // Stale-mount guard (Hub-Rueckkehr / Scene-Switch zerstoert unsere Objekte).
    if (mounted && (!g || !g.scene)) { mounted = false; g = gHud = banner = bannerBg = chipBg = chipText = disguiseSpr = null; zoneLabels = []; guardSprites = []; }

    if (!active) { if (mounted) unmount(); return; }
    if (!mounted) mount(scene);
    if (!g || !banner) return;

    var st = window.EspionageSystem.getState ? window.EspionageSystem.getState() : null;
    if (!st) return;
    _t += 0.06;
    var pulse = 0.5 + 0.5 * Math.sin(_t * 2.2);
    var en = _isEN();
    var det = (typeof st.detection === 'number') ? st.detection : 0;
    var zones = st.observeZones || [];
    var allDone = zones.length > 0 && zones.every(function (z) { return z._done; });
    var cam = scene.cameras && scene.cameras.main;
    var pl = window.player;
    var px = (pl && pl.active) ? pl.x : 0, py = (pl && pl.active) ? pl.y : 0;

    // --- Enttarn-Moment (Flanke verdeckt -> enttarnt) ------------------------
    if (st.exposed && !_prevExposed && cam) {
      try { cam.flash(180, 200, 30, 30, false); } catch (e) {}
      try { cam.shake(170, 0.006); } catch (e) {}
      if (window.soundManager) { try { window.soundManager.playSFX('hit'); } catch (e) {} }
    }
    _prevExposed = st.exposed;

    g.clear();

    // --- Deckungs-Zonen (blau-gruen; heller, wenn der Spieler drinsteht) -----
    (st.cover || []).forEach(function (c) {
      if (!c || !(c.w > 0)) return;
      var inside = (pl && px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + (c.h || 0));
      g.fillStyle(0x2aa6a0, inside ? 0.22 : 0.10);
      g.fillRect(c.x, c.y, c.w, c.h || 0);
      g.lineStyle(2, 0x55ddcc, inside ? 0.95 : 0.45);
      g.strokeRect(c.x, c.y, c.w, c.h || 0);
    });

    // --- Sichtkegel (Graphics) + echte Wachen-SPRITES ------------------------
    var alert = st.exposed ? 1 : Math.min(1, det * 1.5);
    var coneCol = st.exposed ? 0xff4040 : (alert > 0.5 ? 0xff8a2a : 0xffd24a);
    var guards = st.guards || [];
    // 1) Sichtkegel zeichnen (nur fuer wache, nicht-niedergeschlagene Wachen)
    guards.forEach(function (gd) {
      if (gd.knocked) return;
      var range = gd.range || 0;
      if (range <= 0) return;
      var f = gd._facing || 0, half = gd.halfAngle || 0.6;
      g.fillStyle(coneCol, 0.09 + 0.12 * alert);
      g.slice(gd.x, gd.y, range, f - half, f + half, false); g.fillPath();
      g.lineStyle(1.5, coneCol, 0.45 + 0.4 * alert);
      g.beginPath(); g.arc(gd.x, gd.y, range, f - half, f + half, false); g.strokePath();
      g.beginPath(); g.moveTo(gd.x, gd.y); g.lineTo(gd.x + Math.cos(f - half) * range, gd.y + Math.sin(f - half) * range); g.strokePath();
      g.beginPath(); g.moveTo(gd.x, gd.y); g.lineTo(gd.x + Math.cos(f + half) * range, gd.y + Math.sin(f + half) * range); g.strokePath();
      g.lineStyle(2, coneCol, 0.5);
      g.beginPath(); g.moveTo(gd.x, gd.y); g.lineTo(gd.x + Math.cos(f) * range * 0.5, gd.y + Math.sin(f) * range * 0.5); g.strokePath();
    });
    // 2) Wachen-Sprites synchronisieren (erstellen/positionieren/stylen)
    while (guardSprites.length < guards.length) {
      var sp = scene.add.sprite(0, 0, _guardTex || 'esp_guard_fallback').setDepth(DEPTH_WORLD + 2).setScrollFactor(1);
      sp.setDisplaySize(36, 42);   // einheitliche Wachen-Groesse
      guardSprites.push(sp);
    }
    while (guardSprites.length > guards.length) { try { guardSprites.pop().destroy(); } catch (e) {} }
    for (var gi = 0; gi < guards.length; gi++) {
      var gd2 = guards[gi], spr = guardSprites[gi];
      if (!spr) continue;
      spr.setVisible(true);
      spr.setPosition(gd2.x, gd2.y);
      var ff = gd2._facing || 0;
      spr.setFlipX(Math.cos(ff) < 0);                 // nach links schauen -> spiegeln
      if (gd2.knocked) {
        spr.setTint(0x777777); spr.setAlpha(0.7); spr.setAngle(90);  // liegt
      } else {
        spr.setAngle(0); spr.setAlpha(1);
        if (st.exposed) spr.setTint(0xff6a6a);        // alarmiert -> rot
        else if (alert > 0.4) spr.setTint(0xffc080);  // misstrauisch -> orange
        else spr.clearTint();
      }
    }

    // --- Verkleidungs-Overlay am Spieler: Kettenrat-Waechter-Montur ----------
    // Echtes ChainGuard-Sprite ueber dem Spieler -> man geht optisch als Wache
    // durch. Richtungs- + Lauf-Animation folgen der Spielerbewegung.
    if (disguiseSpr && pl && pl.active) {
      if (st.disguised && !st.exposed) {
        disguiseSpr.setVisible(true);
        var vx = (pl.body && pl.body.velocity) ? pl.body.velocity.x : 0;
        var vy = (pl.body && pl.body.velocity) ? pl.body.velocity.y : 0;
        var moving = (vx * vx + vy * vy) > 100;
        if (_disguiseDir) {
          var dir = (vx < -4) ? 'left' : 'right';
          var frame = 0;
          if (moving) { var c = Math.floor(_t * 7) % 4; frame = (c === 1) ? 1 : (c === 3) ? 2 : 0; }
          var key = 'chainguard_' + dir + frame;
          if (scene.textures.exists(key)) disguiseSpr.setTexture(key);
          else disguiseSpr.setFlipX(dir === 'left'); // falls nur eine Richtung existiert
        }
        // Groesse an den Spieler anpassen (Montur deckt die Spielerfigur ab).
        var ph = pl.displayHeight || 60;
        disguiseSpr.setDisplaySize(ph * 0.96, ph * 1.04);
        disguiseSpr.setPosition(px, py);
        disguiseSpr.setAlpha(1);
      } else {
        disguiseSpr.setVisible(false);
      }
    }

    // --- Abhoer-Zonen (golden, pulsierend; gruen wenn fertig) ----------------
    _ensureZoneLabels(scene, zones);
    zones.forEach(function (z, i) {
      var r = z.r || 64;
      // Fertigstellungs-Pop (einmalig je Zone)
      if (z._done && !z._fxDone) {
        z._fxDone = true;
        try {
          var fx = scene.add.circle(z.x, z.y, r, 0x66ffaa, 0.5).setDepth(DEPTH_WORLD).setScrollFactor(1);
          if (scene.tweens) scene.tweens.add({ targets: fx, scale: 1.5, alpha: 0, duration: 420, onComplete: function () { try { fx.destroy(); } catch (e) {} } });
          else scene.time.delayedCall(420, function () { try { fx.destroy(); } catch (e) {} });
          if (window.soundManager) window.soundManager.playSFX('level_up');
        } catch (e) {}
      }
      if (z._done) {
        g.fillStyle(0x33dd88, 0.20); g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0x44ee99, 0.95); g.strokeCircle(z.x, z.y, r);
        if (zoneLabels[i]) { zoneLabels[i].setText(en ? '✓ HEARD' : '✓ ABGEHOERT'); zoneLabels[i].setColor('#7dffb0'); }
      } else {
        g.fillStyle(0xffc23a, 0.12 + 0.16 * pulse); g.fillCircle(z.x, z.y, r);
        g.lineStyle(4, 0xffd966, 0.6 + 0.4 * pulse); g.strokeCircle(z.x, z.y, r);
        g.lineStyle(2, 0xffe27a, 0.8);
        g.beginPath(); g.moveTo(z.x - 10, z.y); g.lineTo(z.x + 10, z.y); g.strokePath();
        g.beginPath(); g.moveTo(z.x, z.y - 10); g.lineTo(z.x, z.y + 10); g.strokePath();
        var prog = (z.seconds > 0) ? Math.min(1, (z._elapsed || 0) / z.seconds) : 0;
        if (prog > 0.001) {
          g.lineStyle(6, 0xffffff, 0.95);
          g.beginPath(); g.arc(z.x, z.y, r + 7, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false); g.strokePath();
        }
      }
    });

    // --- Detection-RING am Spieler (Kernstueck) ------------------------------
    if (pl && pl.active) {
      var ringR = 30;
      g.lineStyle(3, 0x000000, 0.22); g.strokeCircle(px, py, ringR); // dezenter Track
      if (det > 0.02 || st.exposed) {
        var fill = st.exposed ? 1 : det;
        var col = st.exposed ? 0xff3b30 : (det < 0.5 ? 0xffd24a : (det < 0.85 ? 0xff8a2a : 0xff3b30));
        g.lineStyle(4, col, st.exposed ? (0.7 + 0.3 * pulse) : 0.95);
        g.beginPath();
        g.arc(px, py, ringR, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2, false);
        g.strokePath();
      }
    }

    // --- Off-screen-Pfeil zur naechsten offenen Zone -------------------------
    gHud.clear();
    if (cam && !st.exposed && !allDone) {
      var open = zones.filter(function (z) { return !z._done; });
      if (open.length && pl) {
        var tgt = open[0], best = Infinity;
        open.forEach(function (z) {
          var d = (z.x - px) * (z.x - px) + (z.y - py) * (z.y - py);
          if (d < best) { best = d; tgt = z; }
        });
        var onScreen = (tgt.x >= cam.scrollX && tgt.x <= cam.scrollX + cam.width
          && tgt.y >= cam.scrollY && tgt.y <= cam.scrollY + cam.height);
        if (!onScreen) {
          var sx = cam.width / 2, sy = cam.height / 2;
          var ang = Math.atan2((tgt.y - cam.scrollY) - sy, (tgt.x - cam.scrollX) - sx);
          var ex = sx + Math.cos(ang) * (cam.width / 2 - 60);
          var ey = sy + Math.sin(ang) * (cam.height / 2 - 60);
          var s = 15;
          gHud.fillStyle(0xffd24a, 0.92);
          gHud.beginPath();
          gHud.moveTo(ex + Math.cos(ang) * s, ey + Math.sin(ang) * s);
          gHud.lineTo(ex + Math.cos(ang + 2.5) * s, ey + Math.sin(ang + 2.5) * s);
          gHud.lineTo(ex + Math.cos(ang - 2.5) * s, ey + Math.sin(ang - 2.5) * s);
          gHud.closePath(); gHud.fillPath();
        }
      }
    }

    // --- HUD: Status-Chip + Aktionszeile ------------------------------------
    var si = _statusInfo(st, allDone);
    chipText.setText(si.txt);
    chipText.setColor(si.tcol);
    chipBg.setSize(Math.max(120, chipText.width + 26), 26);
    chipBg.setFillStyle(si.col, si.hot ? (0.75 + 0.25 * pulse) : 0.95);
    banner.setText(_actionText(st, allDone));
    banner.setColor(st.exposed ? '#ff9a9a' : '#ffe6a8');
  }

  window.EspionageVisuals = { sync: sync, mount: mount, unmount: unmount };
})();
