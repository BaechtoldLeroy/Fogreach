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

  var DEPTH_WORLD = 460;   // über Boden/Objekten
  var DEPTH_HUD = 1650;    // über dem normalen HUD

  var mounted = false;
  var g = null;            // UNmaskiert: Defend-Zone + Altar-HP-Balken (immer sichtbar)
  var gMask = null;        // maskiert an die Sicht -> Hunt-Marker hinter Fog verborgen
  var banner = null, bannerInfo = null, bannerBg = null, hudText = null;
  var _prevMode = 'clear';
  var _bannerUntil = 0;
  var _bannerBottom = 90;  // Unterkante des Banner-Kastens (dynamisch, für HUD-Y)
  // Pixelbilder und Messing-Toasts (roomModeBilder.js). Alles hier bleibt null,
  // solange ein Bild nicht da ist — dann zeichnet die alte Anzeige.
  var jagdSiegel = null, jagdKopf = null, altarLeiste = null, hudPlatte = null, hudSymbol = null;
  var _gemeldet = {};      // Fortschritts-Toasts, je Raum hoechstens einmal
  var MESSING_TEXT = '#f3e6c4', ERFUELLT_TEXT = '#8dffb0', VERFEHLT_TEXT = '#ffa0a0';

  function _B() { return (typeof window !== 'undefined') ? window.RoomModeBilder : null; }
  function _UR(scene) {
    var U = (typeof window !== 'undefined') ? window.uiRahmen : null;
    return (U && U.bereit(scene)) ? U : null;
  }

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
    gMask = scene.add.graphics().setDepth(DEPTH_WORLD).setScrollFactor(1);
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
    [g, gMask, banner, bannerInfo, bannerBg, hudText].forEach(function (o) { if (o) { try { o.destroy(); } catch (e) {} } });
    g = gMask = banner = bannerInfo = bannerBg = hudText = null;
    _bilderWeg();
  }

  function _bilderWeg() {
    [jagdSiegel, jagdKopf, altarLeiste, hudPlatte, hudSymbol].forEach(function (o) { if (o) { try { o.destroy(); } catch (e) {} } });
    jagdSiegel = jagdKopf = altarLeiste = hudPlatte = hudSymbol = null;
  }

  // Ein Bild an die Sicht-Maske binden (wie gMask): der Rudelfuehrer bleibt im Nebel verborgen.
  function _maske(scene, o) {
    if (o && scene && scene._enemyVisionMask && typeof o.setMask === 'function') {
      try { o.setMask(scene._enemyVisionMask); } catch (e) {}
    }
    return o;
  }

  // Rudelfuehrer: Bodensiegel unter den Fuessen + Modus-Medaillon ueber dem Kopf.
  // false = kein Bild, der gezeichnete Kreis bleibt.
  function _jagdBilder(scene, state) {
    var B = _B();
    if (!B) return false;
    if (!jagdSiegel) {
      var T = window.WELT_TIEFEN;
      jagdSiegel = _maske(scene, B.siegel(scene, 'jagd', state.x, state.fussY || state.y, T ? T.BODEN_SCHEIN : 44));
      if (!jagdSiegel) return false;
      var sym = B.symbolKey(scene, 'hunt');
      if (sym) jagdKopf = _maske(scene, scene.add.image(state.x, 0, sym).setDisplaySize(18, 18).setDepth(DEPTH_WORLD));
      // sync() laeuft in update(), die Physik schreibt die Koerperposition aber
      // erst in postupdate auf den Sprite: ohne Nachziehen hinkt das Siegel
      // dem laufenden Anfuehrer ein Bild hinterher.
      if (scene.events && !scene.__jagdNachziehen) {
        scene.__jagdNachziehen = true;
        scene.events.on('postupdate', _jagdNachziehen);
      }
    }
    var an = !!state.targetAlive;
    jagdSiegel.setVisible(an);
    if (jagdKopf) jagdKopf.setVisible(an);
    if (an) _jagdSetzen(scene, state);
    return true;
  }

  function _jagdSetzen(scene, state) {
    jagdSiegel.setPosition(state.x, state.fussY || state.y);
    if (jagdKopf) {
      var now = (scene.time && scene.time.now) || 0;
      jagdKopf.setPosition(state.x, (state.kopfY || state.y - 40) - 12 - 2 * Math.sin(now / 220));
    }
  }

  function _jagdNachziehen() {
    if (!jagdSiegel || !jagdSiegel.scene) return;
    var R = window.RoomMode;
    if (!R || typeof R.activeModeId !== 'function' || R.activeModeId() !== 'hunt') return;
    var state = (typeof R.activeState === 'function') ? (R.activeState() || {}) : {};
    if (state.targetAlive && typeof state.x === 'number') _jagdSetzen(jagdSiegel.scene, state);
  }

  // Messingrahmen um den Altar-Lebensbalken (Balken selbst bleibt in g).
  function _altarRahmen(scene, x, y) {
    var B = _B(), U = _UR(scene);
    if (!B || !U || typeof U.leisteBild !== 'function') return false;
    if (!altarLeiste) {
      var key = U.leisteBild(scene, 58, 16);
      if (!key) return false;
      altarLeiste = scene.add.image(x, y, key).setScrollFactor(1).setDepth(DEPTH_WORLD - 1);
    }
    altarLeiste.setPosition(x, y);
    return true;
  }

  // HUD-Zeile auf einer Messingplatte mit Modus-Symbol (Stil der HUD-Leiste).
  function _hudPlatte(scene, modeId) {
    var B = _B(), U = _UR(scene);
    if (!B || !U || typeof U.leisteBild !== 'function' || !hudText) return false;
    var sym = B.symbolKey(scene, modeId);
    var SYM = 22, pad = 12;
    // Platz links fuer das Symbol; fehlt sein Bild, steht der Text mittig.
    var vorne = sym ? pad + SYM : 0;
    // Breite in 16er-Stufen: jede neue Groesse waere eine eigene Textur.
    var w = Math.ceil((hudText.width + vorne + pad * 2) / 16) * 16, h = 34;
    var key = U.leisteBild(scene, w, h);
    if (!key) return false;
    if (!hudPlatte) hudPlatte = scene.add.image(0, 0, key).setScrollFactor(0).setDepth(DEPTH_HUD - 1);
    else if (hudPlatte.texture.key !== key) hudPlatte.setTexture(key);
    hudPlatte.setPosition(hudText.x, hudText.y);
    var links = hudText.x - w / 2;
    if (sym) {
      if (!hudSymbol) hudSymbol = scene.add.image(0, 0, sym).setScrollFactor(0).setDepth(DEPTH_HUD);
      else if (hudSymbol.texture.key !== sym) hudSymbol.setTexture(sym);
      hudSymbol.setDisplaySize(SYM, SYM).setPosition(links + pad + SYM / 2, hudText.y);
    }
    // Text rechts neben dem Symbol mittig in den Rest.
    hudText.x = links + vorne + (w - vorne) / 2;
    hudPlatte.setVisible(true);
    if (hudSymbol) hudSymbol.setVisible(!!sym);
    return true;
  }

  // Fortschritt: einmal je Raum "noch 10 Sekunden" und "der Altar broeckelt".
  function _fortschritt(scene, modeId, state, done) {
    var B = _B();
    if (!B || done || state.failed) return;
    var sek = state.seconds;
    if ((modeId === 'survival' || modeId === 'escape' || modeId === 'defend')
        && typeof sek === 'number' && sek > 0 && sek <= 10 && !_gemeldet.zehn) {
      _gemeldet.zehn = true;
      B.toast(scene, modeId, _t('roommode.toast.zehn'));
    }
    if (modeId === 'defend' && state.maxHp > 0 && state.hp > 0 && state.hp / state.maxHp < 0.35 && !_gemeldet.altar) {
      _gemeldet.altar = true;
      B.toast(scene, modeId, _t('roommode.toast.altar_broeckelt'));
    }
  }

  // Unterkante des gerade sichtbaren Event-Toasts (oder 0).
  function _toastUnten(scene) {
    var e = scene && scene._activeEventToast;
    if (!e || !e.label || !e.label.scene) return 0;
    return e.label.y + e.label.height / 2 + 16;
  }

  function sync(scene) {
    var R = (typeof window !== 'undefined') ? window.RoomMode : null;
    if (!R || typeof R.isSpecialRoom !== 'function') { if (mounted) _unmount(); return; }
    // Stale-mount guard (Scene-Wechsel zerstört unsere Objekte).
    if (mounted && (!g || !g.scene)) {
      mounted = false; g = gMask = banner = bannerInfo = bannerBg = hudText = null;
      jagdSiegel = jagdKopf = altarLeiste = hudPlatte = hudSymbol = null;
    }

    var special = R.isSpecialRoom();
    if (!special) { if (mounted) _unmount(); _prevMode = 'clear'; return; }
    if (!mounted) _mount(scene);
    if (!hudText) return;

    // NUR den Hunt-Marker (gMask) an die Sicht-Maske binden — der Rudelführer-Kreis
    // soll hinter dem Fog verborgen sein. Die Defend-Zone (g) bleibt UNmaskiert
    // (gameplay-kritischer Marker, muss immer sichtbar sein). Einmalig setzen.
    if (gMask && !gMask.__vmaskApplied && scene && scene._enemyVisionMask && typeof gMask.setMask === 'function') {
      try { gMask.setMask(scene._enemyVisionMask); gMask.__vmaskApplied = true; } catch (e) {}
    }

    var modeId = R.activeModeId();
    var state = (typeof R.activeState === 'function') ? (R.activeState() || {}) : {};
    var now = (scene && scene.time && typeof scene.time.now === 'number') ? scene.time.now : 0;

    // Intro-Banner beim Betreten eines neuen Spezialraums (Titel + Erklärung, ~4.5s).
    if (_prevMode !== modeId) {
      var _secs = state.seconds != null ? state.seconds : Math.ceil(state.remaining || 0);
      var bk = bannerKeyFor(modeId);
      var ik = bannerInfoKeyFor(modeId);
      _gemeldet = {};
      _bilderWeg(); // Siegel/Rahmen gehoeren zum vorigen Raum
      // Start als Messing-Toast mit Modus-Symbol; ohne Bild/Banner der alte Kasten.
      var _Bs = _B();
      var _alsToast = !!(bk && _Bs && _Bs.toast(scene, modeId,
        _t(bk, { seconds: _secs }) + (ik ? '\n' + _t(ik, { seconds: _secs }) : '')));
      if (_alsToast) {
        _bannerUntil = 0;
      } else {
        if (bk && banner) banner.setText(_t(bk, { seconds: _secs }));
        if (bannerInfo) bannerInfo.setText(ik ? _t(ik, { seconds: _secs }) : '');
        _layoutBanner(scene); // Kasten an die tatsächliche Texthöhe anpassen
        if (bk) _bannerUntil = now + 4500;
      }
      _prevMode = modeId;
    }
    var showBanner = now < _bannerUntil;
    if (banner) banner.setVisible(showBanner);
    if (bannerInfo) bannerInfo.setVisible(showBanner);
    if (bannerBg) bannerBg.setVisible(showBanner);
    // HUD-Zeile unter den Banner rücken, solange er sichtbar ist (kein Überlappen).
    if (hudText) hudText.y = showBanner ? (_bannerBottom + 16) : Math.max(104, _toastUnten(scene) + 17);

    // HUD-Zeile. Bei ERFÜLLTEM Ziel (nicht verfehlt) grün + ✓ (der goldige Text
    // wird zur Erfolgsbestätigung); Fehlschlag (defend) bleibt rot.
    var _done = (typeof R.isObjectiveComplete === 'function') && R.isObjectiveComplete();
    hudText.x = (scene && scene.cameras && scene.cameras.main) ? scene.cameras.main.width / 2 : hudText.x;
    var _erfuellt = _done && !state.failed;
    hudText.setText((_erfuellt ? '✓ ' : '') + hudTextFor(modeId, state));
    // Platte erst nach dem Text: ihre Breite richtet sich nach ihm.
    var _platte = _hudPlatte(scene, modeId);
    if (_erfuellt) hudText.setColor(_platte ? ERFUELLT_TEXT : '#66ff9c');
    else hudText.setColor(state.failed ? (_platte ? VERFEHLT_TEXT : '#ff7a7a') : (_platte ? MESSING_TEXT : '#ffe28a'));
    _fortschritt(scene, modeId, state, _done);

    // Welt-Marker. g = UNmaskiert (Defend), gMask = maskiert (Hunt hinter Fog).
    g.clear();
    gMask.clear();
    if (modeId === 'defend' && typeof state.x === 'number') {
      // Deutlich markierte Drain-Zone: nur Gegner HIER DRIN beschädigen den Altar.
      if (typeof state.drainRadius === 'number' && state.drainRadius > 0) {
        var _pz = 0.5 + 0.5 * Math.sin(now / 350);
        g.fillStyle(0xff3030, state.failed ? 0.20 : (0.16 + 0.06 * _pz));
        g.fillCircle(state.x, state.y, state.drainRadius);
        g.lineStyle(3, 0xff5555, 0.9);            // kräftiger Rand
        g.strokeCircle(state.x, state.y, state.drainRadius);
        g.lineStyle(2, 0xffb0b0, 0.35 + 0.35 * _pz); // pulsierender Innenring
        g.strokeCircle(state.x, state.y, state.drainRadius - 6);
      }
      var frac = (state.maxHp > 0) ? Math.max(0, Math.min(1, state.hp / state.maxHp)) : 0;
      var bw = 46, bh = 6, bx = state.x - bw / 2, by = state.y - 34;
      _altarRahmen(scene, state.x, by + bh / 2);
      g.fillStyle(0x000000, 0.6); g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle(0x3a0d0d, 1); g.fillRect(bx, by, bw, bh);
      var col = frac > 0.5 ? 0x53e07a : (frac > 0.25 ? 0xffd24a : 0xff5a5a);
      g.fillStyle(col, 1); g.fillRect(bx, by, bw * frac, bh);
    } else if (modeId === 'hunt' && (jagdSiegel || state.targetAlive) && typeof state.x === 'number'
               && _jagdBilder(scene, state)) {
      // Pixel-Siegel und Kopfmarke folgen dem Anfuehrer (s. _jagdBilder).
    } else if (modeId === 'hunt' && state.targetAlive && typeof state.x === 'number') {
      var pulse = 0.5 + 0.5 * Math.sin(now / 180);
      gMask.lineStyle(3, 0xff5a5a, 0.6 + 0.4 * pulse);
      gMask.strokeCircle(state.x, state.y, 26 + pulse * 4);
      gMask.fillStyle(0xff5a5a, 0.9);
      gMask.beginPath(); gMask.moveTo(state.x, state.y - 40); gMask.lineTo(state.x - 7, state.y - 52); gMask.lineTo(state.x + 7, state.y - 52); gMask.closePath(); gMask.fillPath();
    }
  }

  if (typeof window !== 'undefined') {
    window.RoomModeVisuals = { sync: sync, bannerKeyFor: bannerKeyFor, bannerInfoKeyFor: bannerInfoKeyFor, hudTextFor: hudTextFor };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bannerKeyFor: bannerKeyFor, bannerInfoKeyFor: bannerInfoKeyFor, hudTextFor: hudTextFor };
  }
})();
