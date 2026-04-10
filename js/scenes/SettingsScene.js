// SettingsScene — overlay scene for audio + debug toggles.
// Launched via window.openSettingsScene(parentScene) or by pressing O.
// Persists everything to localStorage 'demonfall_settings_v1'.

(function () {
  const STORAGE_KEY = 'demonfall_settings_v1';

  const DEFAULTS = {
    master: 0.5,
    music: 0.3,
    sfx: 0.7,
    muted: false,
    debug: {
      autostart: false,
      noFow: false
    }
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, parsed, {
        debug: Object.assign({}, DEFAULTS.debug, parsed.debug || {})
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
      const panelH = Math.min(420, ch - 40);
      const px = cw / 2;
      const py = ch / 2;

      const panel = this.add.graphics().setScrollFactor(0).setDepth(2001);
      panel.fillStyle(0x10131c, 0.96).fillRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);
      panel.lineStyle(3, 0xffd166, 0.9).strokeRoundedRect(px - panelW / 2, py - panelH / 2, panelW, panelH, 14);

      // Title
      this.add.text(px, py - panelH / 2 + 16, 'Einstellungen', {
        fontFamily: 'serif',
        fontSize: '24px',
        color: '#ffd166',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);

      // -- Audio section --
      let rowY = py - panelH / 2 + 60;
      this._sectionLabel(px - panelW / 2 + 20, rowY, 'AUDIO');
      rowY += 22;
      this._volumeRow(px, rowY, 'Master', 'master', panelW); rowY += 32;
      this._volumeRow(px, rowY, 'Musik', 'music', panelW);    rowY += 32;
      this._volumeRow(px, rowY, 'SFX', 'sfx', panelW);        rowY += 32;
      this._toggleRow(px, rowY, 'Stumm', 'muted', panelW);    rowY += 36;

      // -- Debug section --
      this._sectionLabel(px - panelW / 2 + 20, rowY, 'DEBUG');
      rowY += 22;
      this._toggleRow(px, rowY, 'Auto-Start (Menue ueberspringen)', 'debug.autostart', panelW); rowY += 32;
      this._toggleRow(px, rowY, 'Nebel des Krieges deaktivieren', 'debug.noFow', panelW); rowY += 32;
      this._actionRow(px, rowY, '+100 Eisenbrocken', () => {
        if (typeof window.changeMaterialCount === 'function') {
          window.changeMaterialCount('MAT', 100);
          this._toast('+100 Eisenbrocken');
        }
      }, panelW);
      rowY += 32;

      // Close button
      const closeBtnY = py + panelH / 2 - 30;
      const closeBg = this.add.rectangle(px, closeBtnY, 200, 36, 0x3a3a3a)
        .setStrokeStyle(2, 0xd4a543)
        .setScrollFactor(0).setDepth(2002)
        .setInteractive({ useHandCursor: true });
      this.add.text(px, closeBtnY, 'Schliessen [ESC]', {
        fontFamily: 'monospace', fontSize: '14px', color: '#f1e9d8'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2003);
      closeBg.on('pointerdown', () => this._close());
      closeBg.on('pointerover', () => closeBg.setFillStyle(0x555555));
      closeBg.on('pointerout', () => closeBg.setFillStyle(0x3a3a3a));

      this.input.keyboard.on('keydown-ESC', () => this._close());
      this.input.keyboard.on('keydown-O', () => this._close());

      // Apply current settings to live systems on open
      applySettings(this.settings);
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

    _toggleRow(centerX, y, label, settingKey, panelW) {
      this.add.text(centerX - panelW / 2 + 20, y, label + ':', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f1e9d8'
      }).setScrollFactor(0).setDepth(2002);

      const valueText = this.add.text(centerX + 80, y, '', {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffd166'
      }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2002);
      const refresh = () => {
        valueText.setText(this._getSetting(settingKey) ? 'AN' : 'AUS');
        valueText.setColor(this._getSetting(settingKey) ? '#88ff88' : '#888888');
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
      // Resume the parent scene if it was paused (we don't pause currently
      // because we use scene.launch — but stop ourselves)
      this.scene.stop();
    }
  }

  window.SettingsScene = SettingsScene;

  window.openSettingsScene = function (fromScene) {
    if (!fromScene || !fromScene.scene) return;
    if (fromScene.scene.isActive('SettingsScene')) return;
    fromScene.scene.launch('SettingsScene', { from: fromScene.scene.key });
  };
})();
