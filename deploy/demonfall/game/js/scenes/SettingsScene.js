// SettingsScene — overlay scene for audio + debug toggles.
// Launched via window.openSettingsScene(parentScene) or by pressing O.
// Persists everything to localStorage 'demonfall_settings_v1'.

(function () {
  if (window.i18n) {
    window.i18n.register('de', {
      'settings.title': 'Einstellungen',
      'settings.section.audio': 'AUDIO',
      'settings.section.controls': 'STEUERUNG',
      'settings.section.mobile': 'MOBILE',
      'settings.section.display': 'ANZEIGE',
      'settings.section.debug': 'DEBUG',
      'settings.audio.master': 'Master',
      'settings.audio.music': 'Musik',
      'settings.audio.sfx': 'SFX',
      'settings.audio.muted': 'Stumm',
      'settings.controls.movement_weight': 'Gewicht (D2)',
      'settings.mobile.haptics': 'Vibration',
      'settings.mobile.auto_aim': 'Auto-Aim',
      'settings.mobile.d2_controls': 'D2 Controls',
      'settings.display.fullscreen': 'Vollbild',
      'settings.display.reduced_effects': 'Reduz. Effekte',
      'settings.display.language': 'Sprache',
      'settings.display.language.de': 'Deutsch',
      'settings.display.language.en': 'Englisch',
      'settings.debug.autostart': 'Auto-Start',
      'settings.debug.no_fow': 'Kein Nebel',
      'settings.debug.add_iron': '+100 Eisenbrocken',
      'settings.debug.toast_added_iron': '+100 Eisenbrocken',
      'settings.close': 'Schliessen [ESC]',
      'settings.toggle.on': 'AN',
      'settings.toggle.off': 'AUS'
    });
    window.i18n.register('en', {
      'settings.title': 'Settings',
      'settings.section.audio': 'AUDIO',
      'settings.section.controls': 'CONTROLS',
      'settings.section.mobile': 'MOBILE',
      'settings.section.display': 'DISPLAY',
      'settings.section.debug': 'DEBUG',
      'settings.audio.master': 'Master',
      'settings.audio.music': 'Music',
      'settings.audio.sfx': 'SFX',
      'settings.audio.muted': 'Muted',
      'settings.controls.movement_weight': 'Weight (D2)',
      'settings.mobile.haptics': 'Haptics',
      'settings.mobile.auto_aim': 'Auto-Aim',
      'settings.mobile.d2_controls': 'D2 Controls',
      'settings.display.fullscreen': 'Fullscreen',
      'settings.display.reduced_effects': 'Reduced FX',
      'settings.display.language': 'Language',
      'settings.display.language.de': 'German',
      'settings.display.language.en': 'English',
      'settings.debug.autostart': 'Autostart',
      'settings.debug.no_fow': 'No Fog',
      'settings.debug.add_iron': '+100 Iron Chunks',
      'settings.debug.toast_added_iron': '+100 Iron Chunks',
      'settings.close': 'Close [ESC]',
      'settings.toggle.on': 'ON',
      'settings.toggle.off': 'OFF'
    });
  }

  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  const STORAGE_KEY = 'demonfall_settings_v1';

  const MOBILE_BUTTON_SCALES = [0.8, 1.0, 1.2];

  const DEFAULTS = {
    master: 0.5,
    music: 0.3,
    sfx: 0.7,
    muted: false,
    fullscreen: false,
    reducedEffects: false, // mobile performance: fewer particles, simpler fog
    movementWeight: 0.0, // 0 = instant (current), 1.0 = D2-like weight
    debug: {
      autostart: false,
      noFow: false
    },
    mobile: {
      deadZone: 0.15,
      haptics: true,
      autoAim: true,
      d2Controls: true,
      buttonScale: 1.0
    }
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, parsed, {
        debug: Object.assign({}, DEFAULTS.debug, parsed.debug || {}),
        mobile: Object.assign({}, DEFAULTS.mobile, parsed.mobile || {})
      });
    } catch (err) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('[Settings] save failed', err);
    }
  }

  // Apply settings to live systems (sound, debug flags). Called whenever a value changes.
  function applySettings(settings) {
    if (window.soundManager) {
      window.soundManager.setVolume('master', settings.master);
      window.soundManager.setVolume('music', settings.music);
      window.soundManager.setVolume('sfx', settings.sfx);
      if (settings.muted && !window.soundManager.muted) window.soundManager.mute();
      if (!settings.muted && window.soundManager.muted) window.soundManager.unmute();
    }
    window.__DEBUG_NO_FOW__ = !!settings.debug.noFow;
    window.__REDUCED_EFFECTS__ = !!settings.reducedEffects;
    window.__MOVEMENT_WEIGHT__ = typeof settings.movementWeight === 'number'
      ? Math.max(0, Math.min(1, settings.movementWeight))
      : 0;

    const m = (settings.mobile && typeof settings.mobile === 'object')
      ? settings.mobile : DEFAULTS.mobile;
    window.__MOBILE_DEAD_ZONE__ = Math.max(0, Math.min(0.4,
      typeof m.deadZone === 'number' ? m.deadZone : DEFAULTS.mobile.deadZone));
    window.__MOBILE_HAPTICS__ = m.haptics !== undefined ? !!m.haptics : true;
    window.__MOBILE_AUTO_AIM__ = m.autoAim !== undefined ? !!m.autoAim : true;
    window.__MOBILE_D2_CONTROLS__ = m.d2Controls !== undefined ? !!m.d2Controls : true;
    window.__MOBILE_BUTTON_SCALE__ = MOBILE_BUTTON_SCALES.includes(m.buttonScale)
      ? m.buttonScale : 1.0;
  }

  // Expose so other code (e.g. startScene) can apply on game boot
  window.loadGameSettings = loadSettings;
  window.applyGameSettings = applySettings;

  class SettingsScene extends Phaser.Scene {
    constructor() {
      super({ key: 'SettingsScene' });
    }

    create(data) {
      this.parentSceneKey = data && data.from || null;
      this.settings = loadSettings();

      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;

      // Dim backdrop
      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7).setScrollFactor(0).setDepth(2000);

      const panelW = Math.min(560, cw - 40);
      const panelH = Math.min(460, ch - 20);
      const px = cw / 2;
      const py = ch / 2;

      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.96).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
      panel.lineStyle(3, 0xffd166, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

      // Title
      this.add.text(px, py - panelH / 2 + 16, T('settings.title'), {
        fontFamily: 'serif',
        fontSize: '24px',
        color: '#ffd166',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      // -- Audio section --
      let rowY = py - panelH / 2 + 50;
      this._sectionLabel(px - panelW / 2 + 20, rowY, T('settings.section.audio'));
      rowY += 18;
      this._volumeRow(px, rowY, T('settings.audio.master'), 'master', panelW); rowY += 24;
      this._volumeRow(px, rowY, T('settings.audio.music'), 'music', panelW);    rowY += 24;
      this._volumeRow(px, rowY, T('settings.audio.sfx'), 'sfx', panelW);        rowY += 24;
      this._toggleRow(px, rowY, T('settings.audio.muted'), 'muted', panelW);    rowY += 26;

      // -- Controls section --
      this._sectionLabel(px - panelW / 2 + 20, rowY, T('settings.section.controls'));
      rowY += 18;
      this._volumeRow(px, rowY, T('settings.controls.movement_weight'), 'movementWeight', panelW); rowY += 26;

      // -- Mobile section (only on touch devices) --
      const isTouch = !!(this.sys && this.sys.game && this.sys.game.device
        && this.sys.game.device.input && this.sys.game.device.input.touch);
      if (isTouch) {
        this._sectionLabel(px - panelW / 2 + 20, rowY, T('settings.section.mobile'));
        rowY += 18;
        this._toggleRow(px, rowY, T('settings.mobile.haptics'), 'mobile.haptics', panelW); rowY += 22;
        this._toggleRow(px, rowY, T('settings.mobile.auto_aim'), 'mobile.autoAim', panelW); rowY += 22;
        this._toggleRow(px, rowY, T('settings.mobile.d2_controls'), 'mobile.d2Controls', panelW); rowY += 22;
        // Mobile fullscreen toggle (mirrored from DISPLAY → Vollbild). Mobile
        // browsers usually need an explicit user gesture to enter fullscreen,
        // so the picker click itself is the gesture that actually triggers it.
        this._fullscreenRow(px, rowY, panelW); rowY += 24;
      }

      // -- Display section --
      this._sectionLabel(px - panelW / 2 + 20, rowY, T('settings.section.display'));
      rowY += 18;
      this._fullscreenRow(px, rowY, panelW); rowY += 22;
      this._toggleRow(px, rowY, T('settings.display.reduced_effects'), 'reducedEffects', panelW); rowY += 22;
      this._languageRow(px, rowY, panelW); rowY += 24;

      // -- Debug section --
      this._sectionLabel(px - panelW / 2 + 20, rowY, T('settings.section.debug'));
      rowY += 18;
      this._toggleRow(px, rowY, T('settings.debug.autostart'), 'debug.autostart', panelW); rowY += 22;
      this._toggleRow(px, rowY, T('settings.debug.no_fow'), 'debug.noFow', panelW); rowY += 22;
      this._actionRow(px, rowY, T('settings.debug.add_iron'), () => {
        if (typeof window.changeMaterialCount === 'function') {
          window.changeMaterialCount('MAT', 100);
          this._toast(T('settings.debug.toast_added_iron'));
        }
      }, panelW);
      rowY += 32;

      // Close button
      const closeBtnY = py + panelH / 2 - 30;
      const closeBg = this.add.rectangle(px, closeBtnY, 200, 36, 0x3a3a3a)
        .setStrokeStyle(2, 0xd4a543)
        .setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(px, closeBtnY, T('settings.close'), {
        fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      closeBg.on('pointerdown', () => this._close());
      closeBg.on('pointerover', () => closeBg.setFillStyle(0x555555));
      closeBg.on('pointerout', () => closeBg.setFillStyle(0x3a3a3a));

      this.input.keyboard.on('keydown-ESC', () => this._close());
      this.input.keyboard.on('keydown-O', () => this._close());

      // Apply current settings to live systems on open
      applySettings(this.settings);

      // Re-render scene if language changes (e.g. via debug console or
      // via the language picker). Cleanup on shutdown to avoid leaking the
      // old scene reference into the subscriber set.
      if (window.i18n) {
        this._unsubscribeI18n = window.i18n.onChange(() => {
          if (this.scene && this.scene.isActive && this.scene.isActive()) {
            this.scene.restart({ from: this.parentSceneKey });
          }
        });
        this.events.once('shutdown', () => {
          if (this._unsubscribeI18n) {
            this._unsubscribeI18n();
            this._unsubscribeI18n = null;
          }
        });
      }
    }

    _sectionLabel(x, y, text) {
      this.add.text(x, y, text, {
        fontFamily: 'serif',
        fontSize: '13px',
        color: '#d4a543',
        fontStyle: 'bold'
      }).setScrollFactor(0).setDepth(2002);
    }

    _getSetting(path) {
      const parts = path.split('.');
      let cur = this.settings;
      for (const p of parts) cur = cur && cur[p];
      return cur;
    }

    _setSetting(path, value) {
      const parts = path.split('.');
      let cur = this.settings;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] || {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      saveSettings(this.settings);
      applySettings(this.settings);
    }

    _volumeRow(centerX, y, label, settingKey, panelW) {
      // Label on the left
      this.add.text(centerX - panelW / 2 + 20, y, label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      // Value text
      const valueText = this.add.text(centerX + 60, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      const refresh = () => {
        const v = this._getSetting(settingKey);
        valueText.setText(Math.round(v * 100) + '%');
      };
      refresh();

      // Minus button
      const minusX = centerX + 4;
      const minusBg = this.add.rectangle(minusX, y + 8, 24, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(minusX, y + 8, '-', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      minusBg.on('pointerdown', () => {
        const cur = this._getSetting(settingKey);
        this._setSetting(settingKey, Math.max(0, Math.round((cur - 0.1) * 10) / 10));
        refresh();
      });

      // Plus button
      const plusX = centerX + 110;
      const plusBg = this.add.rectangle(plusX, y + 8, 24, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(plusX, y + 8, '+', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      plusBg.on('pointerdown', () => {
        const cur = this._getSetting(settingKey);
        this._setSetting(settingKey, Math.min(1, Math.round((cur + 0.1) * 10) / 10));
        refresh();
      });
    }

    _sliderRow(centerX, y, label, settingKey, panelW, opts) {
      const min = (opts && typeof opts.min === 'number') ? opts.min : 0;
      const max = (opts && typeof opts.max === 'number') ? opts.max : 1;
      const step = (opts && typeof opts.step === 'number') ? opts.step : 0.1;
      const fmt = (opts && typeof opts.format === 'function')
        ? opts.format : (v) => Math.round(v * 100) + '%';
      const round = (v) => Math.round(v / step) * step;
      this.add.text(centerX - panelW / 2 + 20, y, label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);
      const valueText = this.add.text(centerX + 60, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      const refresh = () => valueText.setText(fmt(this._getSetting(settingKey)));
      refresh();
      const minusBg = this.add.rectangle(centerX + 4, y + 8, 24, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(centerX + 4, y + 8, '-', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      minusBg.on('pointerdown', () => {
        const cur = this._getSetting(settingKey);
        this._setSetting(settingKey, Math.max(min, round(cur - step)));
        refresh();
      });
      const plusBg = this.add.rectangle(centerX + 110, y + 8, 24, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(centerX + 110, y + 8, '+', {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      plusBg.on('pointerdown', () => {
        const cur = this._getSetting(settingKey);
        this._setSetting(settingKey, Math.min(max, round(cur + step)));
        refresh();
      });
    }

    _pickerRow(centerX, y, label, settingKey, options, format, panelW) {
      this.add.text(centerX - panelW / 2 + 20, y, label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);
      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      const refresh = () => valueText.setText(format(this._getSetting(settingKey)));
      refresh();
      const btnBg = this.add.rectangle(centerX + 80, y + 8, 60, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        const cur = this._getSetting(settingKey);
        let i = options.indexOf(cur);
        if (i < 0) i = 0;
        const next = options[(i + 1) % options.length];
        this._setSetting(settingKey, next);
        refresh();
      });
    }

    _toggleRow(centerX, y, label, settingKey, panelW) {
      this.add.text(centerX - panelW / 2 + 20, y, label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      const refresh = () => {
        const on = !!this._getSetting(settingKey);
        valueText.setText(on ? T('settings.toggle.on') : T('settings.toggle.off'));
        valueText.setColor(on ? '#88ff88' : '#888888');
      };
      refresh();

      const btnBg = this.add.rectangle(centerX + 80, y + 8, 60, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        this._setSetting(settingKey, !this._getSetting(settingKey));
        refresh();
      });
    }

    _languageRow(centerX, y, panelW) {
      const supportedLangs = ['de', 'en'];
      const langLabelKey = (lang) => 'settings.display.language.' + lang;
      this.add.text(centerX - panelW / 2 + 20, y, T('settings.display.language') + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      const refresh = () => {
        const cur = window.Persistence ? window.Persistence.getLanguage() : 'de';
        valueText.setText(T(langLabelKey(cur)));
      };
      refresh();

      const btnBg = this.add.rectangle(centerX + 80, y + 8, 80, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        const cur = window.Persistence ? window.Persistence.getLanguage() : 'de';
        const next = supportedLangs[(supportedLangs.indexOf(cur) + 1) % supportedLangs.length];
        if (window.Persistence) window.Persistence.setLanguage(next);
        if (window.i18n) window.i18n.setLanguage(next); // triggers onChange → scene.restart
        refresh();
      });
    }

    _fullscreenRow(centerX, y, panelW) {
      const self = this;
      this.add.text(centerX - panelW / 2 + 20, y, T('settings.display.fullscreen') + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      const refresh = () => {
        const isFs = !!self.scale.isFullscreen;
        valueText.setText(isFs ? T('settings.toggle.on') : T('settings.toggle.off'));
        valueText.setColor(isFs ? '#88ff88' : '#888888');
      };
      refresh();

      const btnBg = this.add.rectangle(centerX + 80, y + 8, 60, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        // Toggle fullscreen ad-hoc only — never persist the value. Stored
        // fullscreen flags caused stale auto-restores on focus regain.
        if (self.scale.isFullscreen) {
          self.scale.stopFullscreen();
        } else {
          self.scale.startFullscreen();
        }
        self.time.delayedCall(200, refresh);
      });
    }

    _actionRow(centerX, y, label, callback, panelW) {
      const btnBg = this.add.rectangle(centerX, y + 8, 200, 24, 0x3a3a3a)
        .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(centerX, y + 8, label, {
        fontFamily: 'monospace', fontSize: '12px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      btnBg.on('pointerdown', callback);
      btnBg.on('pointerover', () => btnBg.setFillStyle(0x555555));
      btnBg.on('pointerout', () => btnBg.setFillStyle(0x3a3a3a));
    }

    _toast(msg) {
      const cam = this.cameras.main;
      const txt = this.add.text(cam.width / 2, cam.height - 60, msg, {
        fontFamily: 'monospace', fontSize: '14px', color: '#88ff88',
        backgroundColor: '#0c0c11cc', padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2010);
      this.tweens.add({
        targets: txt, alpha: 0, delay: 1500, duration: 400,
        onComplete: () => txt.destroy()
      });
    }

    _close() {
      this.input.keyboard.off('keydown-ESC');
      this.input.keyboard.off('keydown-O');
      if (this._unsubscribeI18n) {
        this._unsubscribeI18n();
        this._unsubscribeI18n = null;
      }
      // Resume the parent scene if it was paused (we don't pause currently
      // because we use scene.launch — but stop ourselves)
      this.scene.stop();
    }
  }

  window.SettingsScene = SettingsScene;

  window.openSettingsScene = function (fromScene) {
    if (!fromScene || !fromScene.scene) return;
    // Defensive: a zombie SettingsScene instance can linger across hub →
    // dungeon transitions, leaving isActive() truthy without any visible
    // overlay. Force-stop before relaunching so the burger-menu entry in
    // the dungeon HUD reliably opens the settings panel.
    try {
      if (fromScene.scene.isActive('SettingsScene')) {
        fromScene.scene.stop('SettingsScene');
      }
    } catch (e) { /* ignore */ }
    fromScene.scene.launch('SettingsScene', { from: fromScene.scene.key });
  };
})();
