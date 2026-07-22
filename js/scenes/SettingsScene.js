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
      'settings.section.input': 'EINGABE',
      'settings.section.tutorial': 'TUTORIAL',
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
      'settings.difficulty.label': 'Schwierigkeit',
      'settings.difficulty.easy': 'Leicht',
      'settings.difficulty.normal': 'Normal',
      'settings.difficulty.hard': 'Schwer',
      'settings.display.language.de': 'Deutsch',
      'settings.display.language.en': 'Englisch',
      'settings.debug.autostart': 'Auto-Start',
      'settings.debug.no_fow': 'Kein Nebel',
      'settings.debug.add_iron': '+100 Eisenbrocken',
      'settings.debug.toast_added_iron': '+100 Eisenbrocken',
      'settings.section.gameplay': 'GAMEPLAY',
      'settings.gameplay.skip_tutorial': 'Tutorial überspringen',
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
      'settings.section.input': 'INPUT',
      'settings.section.tutorial': 'TUTORIAL',
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
      'settings.difficulty.label': 'Difficulty',
      'settings.difficulty.easy': 'Easy',
      'settings.difficulty.normal': 'Normal',
      'settings.difficulty.hard': 'Hard',
      'settings.display.language.de': 'German',
      'settings.display.language.en': 'English',
      'settings.debug.autostart': 'Autostart',
      'settings.debug.no_fow': 'No Fog',
      'settings.debug.add_iron': '+100 Iron Chunks',
      'settings.debug.toast_added_iron': '+100 Iron Chunks',
      'settings.section.gameplay': 'GAMEPLAY',
      'settings.gameplay.skip_tutorial': 'Skip Tutorial',
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
    // Feature 051: gameplay-flow toggles
    gameplay: {
      skipTutorial: false // returning-donor toggle — bypasses 044 tutorial steps
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
      const raw = (window.SlotStorage || localStorage).getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, parsed, {
        debug: Object.assign({}, DEFAULTS.debug, parsed.debug || {}),
        gameplay: Object.assign({}, DEFAULTS.gameplay, parsed.gameplay || {}),
        mobile: Object.assign({}, DEFAULTS.mobile, parsed.mobile || {})
      });
    } catch (err) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveSettings(settings) {
    try {
      (window.SlotStorage || localStorage).setItem(STORAGE_KEY, JSON.stringify(settings));
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
    // Feature 051: surface skip-tutorial flag for tutorialSystem.maybeAutoSkip.
    window.__SKIP_TUTORIAL__ = !!(settings.gameplay && settings.gameplay.skipTutorial);
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

      // Backstop: die Spiel-Pause IMMER aufheben, wenn diese Szene endet — egal
      // ueber welchen Weg (regulaeres _close, Zombie-Stop in openSettingsScene,
      // Szenenwechsel). Sonst bliebe __GAME_PAUSE (global!) haengen und der
      // Dungeon waere eingefroren. Idempotent ueber das Flag + resumeGameClock.
      this.events.once('shutdown', () => {
        if (window.__settingsPausedClock && typeof window.resumeGameClock === 'function') {
          try { window.resumeGameClock(); } catch (e) {}
          window.__settingsPausedClock = false;
        }
      });

      const cam = this.cameras.main;
      const cw = cam.width;
      const ch = cam.height;

      // Dim backdrop
      this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7).setScrollFactor(0).setDepth(2000);

      // Two-column layout. Wider panel + ~600 height fits Audio/Controls/
      // Display on the left and Input/Mobile + Tutorial + Debug on the right
      // without the close button being covered. Both dims clamp to the
      // viewport so small screens still render.
      const panelW = Math.min(720, cw - 40);
      const panelH = Math.min(600, ch - 20);
      const px = cw / 2;
      const py = ch / 2;

      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.96).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
      panel.lineStyle(3, 0xffd166, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

      // Title (centered)
      this.add.text(px, py - panelH / 2 + 16, T('settings.title'), {
        fontFamily: 'serif',
        fontSize: '24px',
        color: '#ffd166',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      // Column geometry. The row helpers (`_volumeRow`, `_toggleRow`, ...)
      // place labels at `centerX - panelW/2 + 20` and value/buttons at
      // `centerX + 80…+110`. By passing the column center + width as
      // (centerX, panelW), positions land naturally inside the column.
      const SIDE_PAD = 16;          // panel edge → column outer edge
      const COL_GAP  = 24;          // gutter between the two columns
      const COL_W    = (panelW - SIDE_PAD * 2 - COL_GAP) / 2;
      const LEFT_C   = px - panelW / 2 + SIDE_PAD + COL_W / 2;
      const RIGHT_C  = px + panelW / 2 - SIDE_PAD - COL_W / 2;
      const LEFT_LBL  = LEFT_C  - COL_W / 2;
      const RIGHT_LBL = RIGHT_C - COL_W / 2;

      const startY = py - panelH / 2 + 50;
      let leftY  = startY;
      let rightY = startY;

      const isTouch = !!(this.sys && this.sys.game && this.sys.game.device
        && this.sys.game.device.input && this.sys.game.device.input.touch);

      // ====== LEFT COLUMN: Audio | Controls | Display ======
      this._sectionLabel(LEFT_LBL, leftY, T('settings.section.audio')); leftY += 18;
      this._volumeRow(LEFT_C, leftY, T('settings.audio.master'), 'master', COL_W); leftY += 22;
      this._volumeRow(LEFT_C, leftY, T('settings.audio.music'),  'music',  COL_W); leftY += 22;
      this._volumeRow(LEFT_C, leftY, T('settings.audio.sfx'),    'sfx',    COL_W); leftY += 22;
      this._toggleRow(LEFT_C, leftY, T('settings.audio.muted'),  'muted',  COL_W); leftY += 28;

      this._sectionLabel(LEFT_LBL, leftY, T('settings.section.controls')); leftY += 18;
      this._volumeRow(LEFT_C, leftY, T('settings.controls.movement_weight'), 'movementWeight', COL_W); leftY += 28;
      this._difficultyRow(LEFT_C, leftY, COL_W); leftY += 22;

      this._sectionLabel(LEFT_LBL, leftY, T('settings.section.display')); leftY += 18;
      this._fullscreenRow(LEFT_C, leftY, COL_W); leftY += 22;
      this._toggleRow(LEFT_C, leftY, T('settings.display.reduced_effects'), 'reducedEffects', COL_W); leftY += 22;
      this._languageRow(LEFT_C, leftY, COL_W); leftY += 22;

      // ====== RIGHT COLUMN: Input/Mobile | Tutorial | Debug ======
      // Mobile-only section on touch devices; otherwise the desktop Input
      // section. The Display column already exposes a Fullscreen toggle, so
      // the duplicate fullscreen row that used to live under Mobile is gone.
      if (isTouch) {
        this._sectionLabel(RIGHT_LBL, rightY, T('settings.section.mobile')); rightY += 18;
        this._toggleRow(RIGHT_C, rightY, T('settings.mobile.haptics'),     'mobile.haptics',    COL_W); rightY += 22;
        this._toggleRow(RIGHT_C, rightY, T('settings.mobile.auto_aim'),    'mobile.autoAim',    COL_W); rightY += 22;
        this._toggleRow(RIGHT_C, rightY, T('settings.mobile.d2_controls'), 'mobile.d2Controls', COL_W); rightY += 28;
      } else {
        this._sectionLabel(RIGHT_LBL, rightY, T('settings.section.input')); rightY += 18;
        this._schemeRow(RIGHT_C, rightY, COL_W); rightY += 28;
      }

      this._sectionLabel(RIGHT_LBL, rightY, T('settings.section.tutorial')); rightY += 18;
      // Feature 051 FR-05: persistent skip-tutorial toggle. Applies on the
      // NEXT New Game (existing Skip button below closes the active flow
      // mid-run; this toggle is the returning-donor "don't show again").
      this._toggleRow(RIGHT_C, rightY, T('settings.gameplay.skip_tutorial'), 'gameplay.skipTutorial', COL_W); rightY += 24;
      const skipBtn = this._tutorialButton(RIGHT_C, rightY, T('tutorial.settings.skip_label'), () => {
        if (!(window.TutorialSystem && window.TutorialSystem.isActive && window.TutorialSystem.isActive())) return;
        const ok = window.confirm(T('tutorial.skip.confirm'));
        if (ok && window.TutorialSystem && typeof window.TutorialSystem.skip === 'function') {
          window.TutorialSystem.skip(true);
          this._refreshSkipButton();
        }
      }, COL_W);
      this._tutorialSkipBtn = skipBtn;
      rightY += 30;
      const replayBtn = this._tutorialButton(RIGHT_C, rightY, T('tutorial.settings.replay_label'), () => {
        const ok = window.confirm(T('tutorial.settings.replay_confirm'));
        if (ok && window.TutorialSystem && typeof window.TutorialSystem.replay === 'function') {
          window.TutorialSystem.replay();
          this._refreshSkipButton();
        }
      }, COL_W);
      this._tutorialReplayBtn = replayBtn;
      rightY += 32;

      this._refreshSkipButton();
      if (window.TutorialSystem && typeof window.TutorialSystem.onChange === 'function') {
        this._skipUnsub = window.TutorialSystem.onChange(() => this._refreshSkipButton());
      }
      if (window.i18n && typeof window.i18n.onChange === 'function') {
        this._i18nUnsub = window.i18n.onChange(() => {
          if (skipBtn && skipBtn.text && skipBtn.text.setText) {
            skipBtn.text.setText(T('tutorial.settings.skip_label'));
          }
          if (replayBtn && replayBtn.text && replayBtn.text.setText) {
            replayBtn.text.setText(T('tutorial.settings.replay_label'));
          }
        });
      }

      this._sectionLabel(RIGHT_LBL, rightY, T('settings.section.debug')); rightY += 18;
      this._toggleRow(RIGHT_C, rightY, T('settings.debug.autostart'), 'debug.autostart', COL_W); rightY += 22;
      this._toggleRow(RIGHT_C, rightY, T('settings.debug.no_fow'),    'debug.noFow',     COL_W); rightY += 22;
      this._actionRow(RIGHT_C, rightY, T('settings.debug.add_iron'), () => {
        if (typeof window.changeMaterialCount === 'function') {
          window.changeMaterialCount('MAT', 100);
          this._toast(T('settings.debug.toast_added_iron'));
        }
      }, COL_W);
      rightY += 32;

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

      // Re-render scene if control scheme changes from outside (e.g. console
      // command). Kept separate from i18n so external scheme flips while
      // Settings is open still move the picker highlight.
      if (window.InputScheme && typeof window.InputScheme.onChange === 'function') {
        this._unsubscribeInputScheme = window.InputScheme.onChange(() => {
          if (this.scene && this.scene.isActive && this.scene.isActive()) {
            this.scene.restart({ from: this.parentSceneKey });
          }
        });
        this.events.once('shutdown', () => {
          if (this._unsubscribeInputScheme) {
            this._unsubscribeInputScheme();
            this._unsubscribeInputScheme = null;
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

    // Schwierigkeits-Regler (vom Wave-Dialog hierher verschoben). Zyklisch
    // Leicht/Normal/Schwer -> DIFFICULTY_MULTIPLIER 0.6/1.0/1.5. Persistiert in
    // demonfall_lastDifficulty (beim Boot in window.DIFFICULTY_MULTIPLIER geladen).
    _difficultyRow(centerX, y, panelW) {
      const TIERS = [
        { key: 'easy',   mult: 0.6 },
        { key: 'normal', mult: 1.0 },
        { key: 'hard',   mult: 1.5 }
      ];
      const curMult = () => {
        const v = window.DIFFICULTY_MULTIPLIER;
        return (typeof v === 'number' && Number.isFinite(v) && v > 0) ? v : 1;
      };
      const nearestIdx = () => {
        const v = curMult();
        let bi = 1, bd = Infinity;
        TIERS.forEach((t, i) => { const d = Math.abs(t.mult - v); if (d < bd) { bd = d; bi = i; } });
        return bi;
      };
      this.add.text(centerX - panelW / 2 + 20, y, T('settings.difficulty.label') + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      const refresh = () => { valueText.setText(T('settings.difficulty.' + TIERS[nearestIdx()].key)); };
      refresh();

      const btnBg = this.add.rectangle(centerX + 80, y + 8, 80, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        const next = (nearestIdx() + 1) % TIERS.length;
        const val = TIERS[next].mult;
        window.DIFFICULTY_MULTIPLIER = val;
        try { (window.SlotStorage || localStorage).setItem('demonfall_lastDifficulty', JSON.stringify(val)); } catch (e) {}
        refresh();
      });
    }

    _schemeRow(centerX, y, panelW) {
      const supportedSchemes = ['classic', 'arpg'];
      const schemeLabelKey = (s) => 'input.scheme.' + s;
      this.add.text(centerX - panelW / 2 + 20, y, T('settings.input_scheme.label') + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      const refresh = () => {
        const cur = (window.InputScheme && window.InputScheme.getScheme)
          ? window.InputScheme.getScheme() : 'classic';
        valueText.setText(T(schemeLabelKey(cur)));
      };
      refresh();

      const btnBg = this.add.rectangle(centerX + 80, y + 8, 80, 22, 0x2a2a2a)
        .setStrokeStyle(1, 0x666666).setScrollFactor(0).setDepth(2001)
        .setInteractive({ useHandCursor: true });
      btnBg.on('pointerdown', () => {
        const cur = (window.InputScheme && window.InputScheme.getScheme)
          ? window.InputScheme.getScheme() : 'classic';
        const next = supportedSchemes[(supportedSchemes.indexOf(cur) + 1) % supportedSchemes.length];
        if (window.InputScheme && window.InputScheme.setScheme) {
          window.InputScheme.setScheme(next); // persists + notifies onChange subscribers
        }
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

    // Variant of _actionRow that returns { bg, text } refs so callers can
    // mutate label text live (i18n) and toggle enabled/dimmed state.
    _tutorialButton(centerX, y, label, callback, panelW) {
      const bg = this.add.rectangle(centerX, y + 8, 240, 24, 0x3a3a3a)
        .setStrokeStyle(1, 0xd4a543).setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      const text = this.add.text(centerX, y + 8, label, {
        fontFamily: 'monospace', fontSize: '12px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      bg.on('pointerdown', callback);
      bg.on('pointerover', () => { if (bg._enabled !== false) bg.setFillStyle(0x555555); });
      bg.on('pointerout',  () => { if (bg._enabled !== false) bg.setFillStyle(0x3a3a3a); });
      bg._enabled = true;
      return {
        bg,
        text,
        setEnabled(enabled) {
          this.bg._enabled = enabled;
          if (enabled) {
            this.bg.setFillStyle(0x3a3a3a).setStrokeStyle(1, 0xd4a543);
            this.text.setColor('#f1e9d8');
          } else {
            this.bg.setFillStyle(0x222222).setStrokeStyle(1, 0x555555);
            this.text.setColor('#666666');
          }
        }
      };
    }

    // Reflects TutorialSystem.isActive() in the skip button visual state.
    // Replay button is always enabled — replay works even after completion.
    _refreshSkipButton() {
      const active = !!(window.TutorialSystem && typeof window.TutorialSystem.isActive === 'function' && window.TutorialSystem.isActive());
      if (this._tutorialSkipBtn && typeof this._tutorialSkipBtn.setEnabled === 'function') {
        this._tutorialSkipBtn.setEnabled(active);
      }
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
      // Tutorial-feature subscriptions (044). Cleaned up alongside the
      // existing i18n unsubscribe so a late state change cannot resurrect a
      // destroyed button.
      if (this._skipUnsub) {
        this._skipUnsub();
        this._skipUnsub = null;
      }
      if (this._i18nUnsub) {
        this._i18nUnsub();
        this._i18nUnsub = null;
      }
      // Spiel-Pause wird im 'shutdown'-Handler aufgehoben (deckt auch Stop-Pfade
      // ohne _close ab). scene.stop() feuert 'shutdown'.
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
    // Volle Spiel-Pause der URSPRUNGS-Szene, aber NUR im Dungeon (GameScene):
    // das Menue laeuft als parallele Overlay-Szene, die GameScene tickt sonst
    // weiter -> Gegner/Projektile/Cooldowns liefen im Hintergrund. Im Hub gibt
    // es keine Gegner, und da __GAME_PAUSE global ist, wuerde eine offene
    // Hub-Pause beim Hub->Dungeon-Wechsel den Dungeon einfrieren -> deshalb hier
    // gar nicht pausieren. Nur pausieren, wenn nichts anderes bereits pausiert
    // (Inventar), sonst wuerde das Schliessen jenes Modal fortsetzen.
    window.__settingsPausedClock = false;
    if (fromScene.scene.key === 'GameScene'
        && window.__GAME_PAUSE && window.__GAME_PAUSE.since == null
        && typeof window.pauseGameClock === 'function') {
      try { window.pauseGameClock(fromScene); window.__settingsPausedClock = true; } catch (e) {}
    }
    try {
      fromScene.scene.launch('SettingsScene', { from: fromScene.scene.key });
      // Phaser renders scenes in registration-array order. GameScene sits
      // AFTER SettingsScene in main.js's `scene: [...]` config, so by
      // default SettingsScene would render BELOW GameScene and be invisible.
      // bringToTop hoists it to the front of the render order.
      fromScene.scene.bringToTop('SettingsScene');
    } catch (e) {
      console.warn('[openSettingsScene] launch failed', e);
    }
  };
})();
