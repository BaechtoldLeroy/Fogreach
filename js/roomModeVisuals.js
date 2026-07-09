/* =====================================================================
 * roomModeVisuals.js — Feedback-Schicht für Raum-Modi (Feature 061, WP05)
 * ---------------------------------------------------------------------
 * Rendert den aktiven Raum-Modus (Banner + HUD + Welt-Marker) aus
 * window.RoomMode.activeState() — OHNE die testbare Modus-Logik zu
 * berühren (Vorbild espionageSystem ↔ espionageVisuals). sync(scene)
 * wird jeden Frame aus dem GameScene-Update aufgerufen; no-op in
 * `clear`-Räumen. Reine Anzeige-Helfer sind exportiert/testbar.
 * ===================================================================== */
(function () {
  'use strict';

  var DEPTH_WORLD = 460;   // ueber Boden/Objekten
  var DEPTH_HUD = 1650;    // ueber dem normalen HUD

  var mounted = false;
  var g = null;            // Welt-Graphics (Altar-HP-Balken, Hunt-Marker)
  var banner = null, bannerInfo = null, bannerBg = null, hudText = null;
  var _prevMode = 'clear';
  var _bannerUntil = 0;
  var _bannerBottom = 90;  // Unterkante des Banner-Kastens (dynamisch, für HUD-Y)

  function _t(key, params) {
    return (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function')
      ? window.i18n.t(key, params || {}) : key;
  }

  // --- Reine Helfer (testbar) ---------------------------------------------
  function bannerKeyFor(modeId) {
    if (modeId === 'survival') return 'roommode.survival.banner';
    if (modeId === 'defend') return 'roommode.defend.banner';
    if (modeId === 'hunt') return 'roommode.hunt.banner';
    if (modeId === 'escape') return 'roommode.escape.banner';
    return null;
  }
  // Zweite, erklärende Banner-Zeile (was tun / warum). null = kein Info-Text.
  function bannerInfoKeyFor(modeId) {
    if (modeId === 'survival') return 'roommode.survival.info';
    if (modeId === 'defend') return 'roommode.defend.info';
    if (modeId === 'hunt') return 'roommode.hunt.info';
    if (modeId === 'escape') return 'roommode.escape.info';
    return null;
  }
  function hudTextFor(modeId, state) {
    state = state || {};
    var secs = state.seconds != null ? state.seconds : Math.ceil(state.remaining || 0);
    if (modeId === 'survival') return _t('roommode.survival.hud', { seconds: secs });
    if (modeId === 'defend') return _t('roommode.defend.hud', { hp: state.hp != null ? state.hp : 0, seconds: secs });
    if (modeId === 'hunt') return _t('roommode.hunt.hud');
    if (modeId === 'escape') return _t('roommode.escape.hud', { seconds: secs });
    return '';
  }

  function _mount(scene) {
    if (mounted || !scene || !scene.add) return;
    mounted = true;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 1536;
    var bw = Math.min(640, cw - 40);
    g = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);
    // Titel-Zeile + erklärende Info-Zeile darunter. Kasten-Höhe wird in
    // _layoutBanner dynamisch an die (evtl. umbrechende) Texthöhe angepasst.
    bannerBg = scene.add.rectangle(cw / 2, 58, bw, 62, 0x10131c, 0.9)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(2, 0xffb347, 0.8).setVisible(false);
    banner = scene.add.text(cw / 2, 26, '', { fontFamily: 'serif', fontSize: '20px', color: '#ffd166', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH_HUD).setVisible(false);
    bannerInfo = scene.add.text(cw / 2, 52, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#d8d2f0',
      align: 'center', wordWrap: { width: bw - 28 }
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH_HUD).setVisible(false);
    hudText = scene.add.text(cw / 2, 104, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);
  }

  // Banner-Kasten dynamisch an Titel + (umbrechende) Info-Zeile anpassen, damit
  // der Text NIE über den Rahmen hinausläuft. Setzt _bannerBottom für die HUD-Y.
  function _layoutBanner(scene) {
    if (!banner || !bannerBg) return;
    var cam = scene && scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 1536;
    var bw = Math.min(640, cw - 40);
    var pad = 10, topY = 26, gap = 4;
    banner.setPosition(cw / 2, topY);
    var hasInfo = !!(bannerInfo && bannerInfo.text);
    var infoY = topY + banner.height + gap;
    if (bannerInfo) bannerInfo.setPosition(cw / 2, infoY);
    var contentBottom = hasInfo ? (infoY + bannerInfo.height) : (topY + banner.height);
    var bgTop = topY - pad;
    var bgH = (contentBottom + pad) - bgTop;
    try { bannerBg.setSize(bw, bgH); } catch (e) {}
    bannerBg.setPosition(cw / 2, bgTop + bgH / 2);
    _bannerBottom = bgTop + bgH;
  }

  function _unmount() {
    mounted = false;
    [g, banner, bannerInfo, bannerBg, hudText].forEach(function (o) { if (o) { try { o.destroy(); } catch (e) {} } });
    g = banner = bannerInfo = bannerBg = hudText = null;
  }

  function sync(scene) {
    var R = (typeof window !== 'undefined') ? window.RoomMode : null;
    if (!R || typeof R.isSpecialRoom !== 'function') { if (mounted) _unmount(); return; }
    // Stale-mount guard (Scene-Wechsel zerstoert unsere Objekte).
    if (mounted && (!g || !g.scene)) { mounted = false; g = banner = bannerBg = hudText = null; }

    var special = R.isSpecialRoom();
    if (!special) { if (mounted) _unmount(); _prevMode = 'clear'; return; }
    if (!mounted) _mount(scene);
    if (!hudText) return;

    var modeId = R.activeModeId();
    var state = (typeof R.activeState === 'function') ? (R.activeState() || {}) : {};
    var now = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : 0;

    // Intro-Banner beim Betreten eines neuen Spezialraums (Titel + Erklärung, ~4.5s).
    if (_prevMode !== modeId) {
      var _secs = state.seconds != null ? state.seconds : Math.ceil(state.remaining || 0);
      var bk = bannerKeyFor(modeId);
      if (bk && banner) banner.setText(_t(bk, { seconds: _secs }));
      var ik = bannerInfoKeyFor(modeId);
      if (bannerInfo) bannerInfo.setText(ik ? _t(ik, { seconds: _secs }) : '');
      _layoutBanner(scene); // Kasten an die tatsächliche Texthöhe anpassen
      if (bk) _bannerUntil = now + 4500;
      _prevMode = modeId;
    }
    var showBanner = now < _bannerUntil;
    if (banner) banner.setVisible(showBanner);
    if (bannerInfo) bannerInfo.setVisible(showBanner);
    if (bannerBg) bannerBg.setVisible(showBanner);
    // HUD-Zeile unter den Banner rücken, solange er sichtbar ist (kein Überlappen).
    if (hudText) hudText.y = showBanner ? (_bannerBottom + 16) : 104;

    // HUD-Zeile. Bei ERFÜLLTEM Ziel (nicht verfehlt) grün + ✓ (der goldige Text
    // wird zur Erfolgsbestätigung); Fehlschlag (defend) bleibt rot.
    var _done = (typeof R.isObjectiveComplete === 'function') && R.isObjectiveComplete();
    if (_done && !state.failed) {
      hudText.setText('✓ ' + hudTextFor(modeId, state));
      hudText.setColor('#66ff9c');
    } else {
      hudText.setText(hudTextFor(modeId, state));
      hudText.setColor(state.failed ? '#ff7a7a' : '#ffe28a');
    }

    // Welt-Marker.
    g.clear();
    if (modeId === 'defend' && typeof state.x === 'number') {
      // Markierte Drain-Zone: nur Gegner HIER DRIN beschädigen den Altar.
      if (typeof state.drainRadius === 'number' && state.drainRadius > 0) {
        var _dz = 0.10 + 0.05 * (0.5 + 0.5 * Math.sin(now / 400));
        g.fillStyle(0xff4a4a, state.failed ? 0.16 : _dz);
        g.fillCircle(state.x, state.y, state.drainRadius);
        g.lineStyle(2, 0xff6a6a, 0.55);
        g.strokeCircle(state.x, state.y, state.drainRadius);
      }
      var frac = (state.maxHp > 0) ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0;
      var bw = 46, bh = 6, bx = state.x - bw / 2, by = state.y - 34;
      g.fillStyle(0x000000, 0.6); g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle(0x3a0d0d, 1); g.fillRect(bx, by, bw, bh);
      var col = frac > 0.5 ? 0x53e07a : (frac > 0.25 ? 0xffd24a : 0xff5a5a);
      g.fillStyle(col, 1); g.fillRect(bx, by, bw * frac, bh);
    } else if (modeId === 'hunt' && state.targetAlive && typeof state.x === 'number') {
      var pulse = 0.5 + 0.5 * Math.sin(now / 180);
      g.lineStyle(3, 0xff5a5a, 0.6 + 0.4 * pulse);
      g.strokeCircle(state.x, state.y, 26 + pulse * 4);
      g.fillStyle(0xff5a5a, 0.9);
      g.beginPath(); g.moveTo(state.x, state.y - 40); g.lineTo(state.x - 7, state.y - 52); g.lineTo(state.x + 7, state.y - 52); g.closePath(); g.fillPath();
    }
  }

  if (typeof window !== 'undefined') {
    window.RoomModeVisuals = { sync: sync, bannerKeyFor: bannerKeyFor, bannerInfoKeyFor: bannerInfoKeyFor, hudTextFor: hudTextFor };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bannerKeyFor: bannerKeyFor, bannerInfoKeyFor: bannerInfoKeyFor, hudTextFor: hudTextFor };
  }
})();
