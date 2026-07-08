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
  var banner = null, bannerBg = null, hudText = null;
  var _prevMode = 'clear';
  var _bannerUntil = 0;

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
  function hudTextFor(modeId, state) {
    state = state || {};
    if (modeId === 'survival') return _t('roommode.survival.hud', { seconds: state.seconds != null ? state.seconds : Math.ceil(state.remaining || 0) });
    if (modeId === 'defend') return _t('roommode.defend.hud', { hp: state.hp != null ? state.hp : 0 });
    if (modeId === 'hunt') return _t('roommode.hunt.hud');
    if (modeId === 'escape') return _t('roommode.escape.hud');
    return '';
  }

  function _mount(scene) {
    if (mounted || !scene || !scene.add) return;
    mounted = true;
    var cam = scene.cameras && scene.cameras.main;
    var cw = cam ? cam.width : 1536;
    g = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);
    bannerBg = scene.add.rectangle(cw / 2, 52, Math.min(560, cw - 40), 34, 0x10131c, 0.85)
      .setScrollFactor(0).setDepth(DEPTH_HUD - 1).setStrokeStyle(2, 0xffb347, 0.8).setVisible(false);
    banner = scene.add.text(cw / 2, 52, '', { fontFamily: 'serif', fontSize: '20px', color: '#ffd166', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD).setVisible(false);
    hudText = scene.add.text(cw / 2, 92, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffe28a', fontStyle: 'bold' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD);
  }

  function _unmount() {
    mounted = false;
    [g, banner, bannerBg, hudText].forEach(function (o) { if (o) { try { o.destroy(); } catch (e) {} } });
    g = banner = bannerBg = hudText = null;
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

    // Intro-Banner beim Betreten eines neuen Spezialraums (~2.5 s).
    if (_prevMode !== modeId) {
      var bk = bannerKeyFor(modeId);
      if (bk && banner) {
        banner.setText(_t(bk, { seconds: state.seconds != null ? state.seconds : Math.ceil(state.remaining || 0) }));
        _bannerUntil = now + 2500;
      }
      _prevMode = modeId;
    }
    var showBanner = now < _bannerUntil;
    if (banner) banner.setVisible(showBanner);
    if (bannerBg) bannerBg.setVisible(showBanner);

    // HUD-Zeile.
    hudText.setText(hudTextFor(modeId, state));
    hudText.setColor(state.failed ? '#ff7a7a' : '#ffe28a');

    // Welt-Marker.
    g.clear();
    if (modeId === 'defend' && typeof state.x === 'number') {
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
    window.RoomModeVisuals = { sync: sync, bannerKeyFor: bannerKeyFor, hudTextFor: hudTextFor };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bannerKeyFor: bannerKeyFor, hudTextFor: hudTextFor };
  }
})();
