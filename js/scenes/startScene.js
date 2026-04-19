// startScene.js

// 1) Scene-Konstruktor
function StartScene() {
  Phaser.Scene.call(this, { key: "StartScene" });
}
StartScene.prototype = Object.create(Phaser.Scene.prototype);
StartScene.prototype.constructor = StartScene;

// 2) preload / create / update der Menu-Scene
StartScene.prototype.preload = function () {
  const width = this.cameras.main.width;
  const height = this.cameras.main.height;

  // Load-time instrumentation: how long does the initial preload take?
  const preloadStart = performance.now();
  this.load.once('complete', () => {
    const elapsed = (performance.now() - preloadStart).toFixed(0);
    console.log(`[StartScene] preload complete in ${elapsed}ms`);
  });

  // Dark background for loading screen
  const bg = this.add.graphics();
  bg.fillStyle(0x1a1a1a, 1);
  bg.fillRect(0, 0, width, height);

  if (window.i18n) {
    window.i18n.register('de', {
      'start.loading': 'Laden...',
      'start.loading_file': 'Lade: {file}'
    });
    window.i18n.register('en', {
      'start.loading': 'Loading...',
      'start.loading_file': 'Loading: {file}'
    });
  }
  const T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);

  // Progress bar container (outline)
  const progressBox = this.add.graphics();
  progressBox.lineStyle(2, 0x666666, 1);
  progressBox.strokeRect(width / 2 - 200, height / 2 - 10, 400, 20);

  // Progress bar fill
  const progressBar = this.add.graphics();

  // "Laden..." text above the bar
  const loadingText = this.make.text({
    x: width / 2,
    y: height / 2 - 30,
    text: T('start.loading'),
    style: {
      font: '20px monospace',
      fill: '#ccaa33'
    }
  });
  loadingText.setOrigin(0.5, 0.5);

  // Percentage text below the bar
  const percentText = this.make.text({
    x: width / 2,
    y: height / 2 + 25,
    text: '0%',
    style: {
      font: '16px monospace',
      fill: '#ffffff'
    }
  });
  percentText.setOrigin(0.5, 0.5);

  // Currently-loading file name
  const fileText = this.make.text({
    x: width / 2,
    y: height / 2 + 50,
    text: '',
    style: {
      font: '12px monospace',
      fill: '#888888'
    }
  });
  fileText.setOrigin(0.5, 0.5);

  this.load.on('progress', function (value) {
    percentText.setText(parseInt(value * 100) + '%');
    progressBar.clear();
    progressBar.fillStyle(0xccaa33, 1);
    progressBar.fillRect(width / 2 - 198, height / 2 - 8, 396 * value, 16);
  });

  this.load.on('fileprogress', function (file) {
    fileText.setText(T('start.loading_file', { file: file.key }));
  });

  this.load.on('complete', function () {
    bg.destroy();
    progressBar.destroy();
    progressBox.destroy();
    loadingText.destroy();
    percentText.destroy();
    fileText.destroy();
  });

  // Only preload initial direction (dir00) at startup - other directions lazy-loaded
  if (typeof preloadPlayerDirectionalFrames === 'function') {
    preloadPlayerDirectionalFrames(this.load);
  }

  // NPC sprites for the hub are now lazy-loaded inside HubSceneV2.preload()
  // — keeps the StartScene menu reachable in fewer HTTP round-trips.

  // Brute enemy sprites
  this.load.image('brute_left0', 'assets/enemy/brute/left0.png');
  this.load.image('brute_left1', 'assets/enemy/brute/left1.png');
  this.load.image('brute_left2', 'assets/enemy/brute/left2.png');
  this.load.image('brute_right0', 'assets/enemy/brute/right0.png');
  this.load.image('brute_right1', 'assets/enemy/brute/right1.png');
  this.load.image('brute_right2', 'assets/enemy/brute/right2.png');

  // Imp enemy sprites
  this.load.image('imp_left0', 'assets/enemy/imp/left0.png');
  this.load.image('imp_left1', 'assets/enemy/imp/left1.png');
  this.load.image('imp_left2', 'assets/enemy/imp/left2.png');
  this.load.image('imp_right0', 'assets/enemy/imp/right0.png');
  this.load.image('imp_right1', 'assets/enemy/imp/right1.png');
  this.load.image('imp_right2', 'assets/enemy/imp/right2.png');

  // Shadow Creeper enemy sprites
  this.load.image('shadow_left0', 'assets/enemy/shadow/left0.png');
  this.load.image('shadow_left1', 'assets/enemy/shadow/left1.png');
  this.load.image('shadow_left2', 'assets/enemy/shadow/left2.png');
  this.load.image('shadow_right0', 'assets/enemy/shadow/right0.png');
  this.load.image('shadow_right1', 'assets/enemy/shadow/right1.png');
  this.load.image('shadow_right2', 'assets/enemy/shadow/right2.png');

  // Flame Weaver enemy sprites
  this.load.image('flameweaver_left0', 'assets/enemy/flameweaver/left0.png');
  this.load.image('flameweaver_left1', 'assets/enemy/flameweaver/left1.png');
  this.load.image('flameweaver_left2', 'assets/enemy/flameweaver/left2.png');
  this.load.image('flameweaver_right0', 'assets/enemy/flameweaver/right0.png');
  this.load.image('flameweaver_right1', 'assets/enemy/flameweaver/right1.png');
  this.load.image('flameweaver_right2', 'assets/enemy/flameweaver/right2.png');

  // Chain Guard enemy sprites
  this.load.image('chainguard_left0', 'assets/enemy/chainguard/left0.png');
  this.load.image('chainguard_left1', 'assets/enemy/chainguard/left1.png');
  this.load.image('chainguard_left2', 'assets/enemy/chainguard/left2.png');
  this.load.image('chainguard_right0', 'assets/enemy/chainguard/right0.png');
  this.load.image('chainguard_right1', 'assets/enemy/chainguard/right1.png');
  this.load.image('chainguard_right2', 'assets/enemy/chainguard/right2.png');

  // Archer enemy sprites
  this.load.image('archer_left0', 'assets/enemy/archer/left0.png');
  this.load.image('archer_left1', 'assets/enemy/archer/left1.png');
  this.load.image('archer_left2', 'assets/enemy/archer/left2.png');
  this.load.image('archer_right0', 'assets/enemy/archer/right0.png');
  this.load.image('archer_right1', 'assets/enemy/archer/right1.png');
  this.load.image('archer_right2', 'assets/enemy/archer/right2.png');

  // Mage enemy sprites
  this.load.image('mage_left0', 'assets/enemy/mage/left0.png');
  this.load.image('mage_left1', 'assets/enemy/mage/left1.png');
  this.load.image('mage_left2', 'assets/enemy/mage/left2.png');
  this.load.image('mage_right0', 'assets/enemy/mage/right0.png');
  this.load.image('mage_right1', 'assets/enemy/mage/right1.png');
  this.load.image('mage_right2', 'assets/enemy/mage/right2.png');

  // Rat directional frames
  this.load.image('rat_left0', 'assets/enemy/rat/left0.png');
  this.load.image('rat_left1', 'assets/enemy/rat/left1.png');
  this.load.image('rat_left2', 'assets/enemy/rat/left2.png');
  this.load.image('rat_right0', 'assets/enemy/rat/right0.png');
  this.load.image('rat_right1', 'assets/enemy/rat/right1.png');
  this.load.image('rat_right2', 'assets/enemy/rat/right2.png');

  // Bat directional frames
  this.load.image('bat_left0', 'assets/enemy/bat/left0.png');
  this.load.image('bat_left1', 'assets/enemy/bat/left1.png');
  this.load.image('bat_left2', 'assets/enemy/bat/left2.png');
  this.load.image('bat_right0', 'assets/enemy/bat/right0.png');
  this.load.image('bat_right1', 'assets/enemy/bat/right1.png');
  this.load.image('bat_right2', 'assets/enemy/bat/right2.png');

  // Wolf directional frames
  this.load.image('wolf_left0', 'assets/enemy/wolf/left0.png');
  this.load.image('wolf_left1', 'assets/enemy/wolf/left1.png');
  this.load.image('wolf_left2', 'assets/enemy/wolf/left2.png');
  this.load.image('wolf_right0', 'assets/enemy/wolf/right0.png');
  this.load.image('wolf_right1', 'assets/enemy/wolf/right1.png');
  this.load.image('wolf_right2', 'assets/enemy/wolf/right2.png');

  // Enemy sprites (pixel art)
  this.load.image('sprite_imp', 'assets/enemy/imp/imp.png');
  this.load.image('sprite_archer', 'assets/enemy/archer/archer.png');
  this.load.image('sprite_mage', 'assets/enemy/mage/mage.png');
  this.load.image('sprite_shadow', 'assets/enemy/shadow/shadow.png');
  this.load.image('sprite_chainguard', 'assets/enemy/chainguard/chainguard.png');
  this.load.image('sprite_flameweaver', 'assets/enemy/flameweaver/flameweaver.png');
  // Boss sprites (animated)
  ['boss_chain', 'boss_ceremony', 'boss_shadow'].forEach(boss => {
    ['left0','left1','left2','right0','right1','right2'].forEach(frame => {
      this.load.image(boss + '_' + frame, 'assets/enemy/' + boss + '/' + frame + '.png');
    });
  });
  // Fallbacks
  this.load.image('sprite_boss_chain', 'assets/enemy/boss_chain/idle.png');
  this.load.image('sprite_boss_ceremony', 'assets/enemy/boss_ceremony/idle.png');
  this.load.image('sprite_boss_shadow', 'assets/enemy/boss_shadow/idle.png');

  // UI/environment sprites
  this.load.image('stairDown', 'assets/tiles/stairDown.png');

  // Enemy projectile sprites — distinct per enemy archetype
  this.load.image('proj_arrow',    'assets/projectiles/proj_arrow.png');
  this.load.image('proj_arcane',   'assets/projectiles/proj_arcane.png');
  this.load.image('proj_fireball', 'assets/projectiles/proj_fireball.png');
  this.load.image('proj_default',  'assets/projectiles/proj_default.png');

  // Hub NPCs (Aldric, Elara, Harren) are also lazy-loaded inside HubSceneV2.preload()

  const templateNames = [
    "Arena", "ArmoryVault", "BridgeOverGap", "Cathedral", "CelestialGardens", "Checkerboard",
    "CirclePillars", "CollapsingHall", "Crosshall", "CrossroadChamber", "Crossroads",
    "Crypt_Small_Altar", "DungeonLibrary", "GrandBazaar", "MazeLite", "PrisonCells",
    "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault",
    "RathausArchive", "RitualVault", "PrisonDepths", "CouncilChamber", "ForgottenCrypt"
  ];
  for (const name of templateNames) {
    this.load.json(name, `js/roomTemplates/${name}.json`);
  }
};

StartScene.prototype.create = function () {
  if (typeof normalizePlayerDirectionalFrames === 'function') {
    normalizePlayerDirectionalFrames(this);
  }

  // Apply persisted settings on game boot (volume, debug flags, etc.)
  if (typeof window.applyGameSettings === 'function' && typeof window.loadGameSettings === 'function') {
    try { window.applyGameSettings(window.loadGameSettings()); } catch (e) { /* ignore */ }
  }

  // Auto-start support: ?autostart=1 in URL OR debug.autostart in settings.
  // Treated as a fresh new game — wipe persistent state so test runs are deterministic.
  const settingsAutostart = (() => {
    try {
      const s = window.loadGameSettings && window.loadGameSettings();
      return !!(s && s.debug && s.debug.autostart);
    } catch (e) { return false; }
  })();
  if (typeof window !== 'undefined' && window.location && (window.location.search.includes('autostart=1') || settingsAutostart)) {
    if (window.clearSave) clearSave();
    if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
      window.AbilitySystem.resetForNewGame();
    }
    window.__DEV_FORCE_CHEAT__ = true;
    if (typeof window.pendingLoadedSave !== 'undefined') window.pendingLoadedSave = null;
    const self = this;
    setTimeout(() => loadRoomTemplatesAndStart.call(self), 100);
    return;
  }

  // Vollbild bei erstem Touch
  this.input.addPointer(1);
  /*this.input.on('pointerdown', () => {
    if (!this.scale.isFullscreen) this.scale.startFullscreen();
  });*/

  // Titel
  const cw = this.cameras.main.width;
  const ch = this.cameras.main.height;
  const cx = cw / 2;

  this.add
    .text(cx, ch * 0.18, "Demonfall", {
      fontFamily: 'serif', fontSize: "48px", fill: "#ffd166", fontStyle: 'bold'
    })
    .setOrigin(0.5);

  // Subtitle
  this.add
    .text(cx, ch * 0.18 + 50, "Ein Dungeon-Crawler", {
      fontFamily: 'serif', fontSize: "16px", fill: "#888888"
    })
    .setOrigin(0.5);

  const hasExistingSave = window.hasSave && hasSave();

  let startY = hasExistingSave ? ch * 0.58 : ch * 0.52;

  let btn;

  // Fortsetzen zuerst, wenn Save vorhanden ist
  if (hasExistingSave) {
    const contBtn = this.add
      .text(cx, ch * 0.38, "FORTSETZEN", {
        fontFamily: 'serif', fontSize: "32px",
        fill: "#ffea6a",
        backgroundColor: "#111",
        padding: { x: 16, y: 8 },
        fontStyle: 'bold'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);

    contBtn.on("pointerdown", async () => {
      try {
        const save = window.loadGame.length ? await loadGame() : loadGame();
        window.pendingLoadedSave = save || null;
        window.__DEV_FORCE_CHEAT__ = false;
        loadRoomTemplatesAndStart.call(this);
      } catch (e) {
        console.error("[StartScene] loadGame failed:", e);
      }
    });

    contBtn.on('pointerover', () => contBtn.setStyle({ fill: '#fff27c' }));
    contBtn.on('pointerout', () => contBtn.setStyle({ fill: '#ffea6a' }));

    const delBtn = this.add
      .text(cx, ch * 0.48, "Spielstand loeschen", {
        fontFamily: 'monospace', fontSize: "14px",
        fill: "#ff6666",
        padding: { x: 8, y: 3 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);

    delBtn.on("pointerdown", () => {
      if (window.clearSave) clearSave();
      contBtn.destroy();
      delBtn.destroy();
    });

    startY = ch * 0.62;
  }

  // START GAME
  btn = this.add
    .text(cx, startY, hasExistingSave ? "NEUES SPIEL" : "SPIEL STARTEN", {
      fontFamily: 'serif', fontSize: hasExistingSave ? "24px" : "28px",
      fill: hasExistingSave ? "#88ff88" : "#88ff88",
      backgroundColor: "#1a1a1a",
      padding: { x: 14, y: 6 },
      fontStyle: 'bold'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);

  btn
    .on("pointerdown", () => {
      if (window.clearSave) clearSave();
      if (window.AbilitySystem && typeof window.AbilitySystem.resetForNewGame === 'function') {
        window.AbilitySystem.resetForNewGame();
      }
      if (typeof window.pendingLoadedSave !== "undefined") {
        window.pendingLoadedSave = null;
      }
      window.__DEV_FORCE_CHEAT__ = true;
      loadRoomTemplatesAndStart.call(this);
    })
    .on("pointerover", () => btn.setStyle({ fill: '#b0ffb0' }))
    .on("pointerout", () => btn.setStyle({ fill: '#88ff88' }));

  // EINSTELLUNGEN button below the start button
  const settingsBtn = this.add
    .text(cx, startY + 48, "EINSTELLUNGEN", {
      fontFamily: 'monospace', fontSize: "16px",
      fill: "#aaaaaa",
      backgroundColor: "#1a1a1a",
      padding: { x: 10, y: 4 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);
  settingsBtn.on("pointerdown", () => {
    if (typeof window.openSettingsScene === 'function') window.openSettingsScene(this);
  });
  settingsBtn.on("pointerover", () => settingsBtn.setStyle({ fill: '#ffffff' }));
  settingsBtn.on("pointerout", () => settingsBtn.setStyle({ fill: '#aaaaaa' }));

  // Optional: Highscores
  if (window.loadScores) {
    this.add
      .text(400, 460, "🏆 Highscores", {
        fontSize: "22px",
        fill: "#ffff00",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    window
      .loadScores()
      .then((list) => {
        (list || []).slice(0, 10).forEach((entry, i) => {
          this.add
            .text(
              400,
              490 + i * 22,
              `${i + 1}. ${entry.name}: ${entry.score}`,
              { fontSize: "16px", fill: "#ffffff" },
            )
            .setOrigin(0.5, 0)
            .setDepth(1001);
        });
      })
      .catch((err) => {
        this.add
          .text(400, 490, "Fehler beim Laden der Highscores", {
            fontSize: "16px",
            fill: "#ff0000",
          })
          .setOrigin(0.5)
          .setDepth(1001);
      });
  }

  // -------------- Loader-Logik fuer RoomTemplates ----------------

  function loadRoomTemplatesAndStart() {
    window.RoomTemplates = window.RoomTemplates || {};
    const RT = window.RoomTemplates;
    RT.TEMPLATES = RT.TEMPLATES || {};
    
    const allTemplateNames = [
      "Arena", "ArmoryVault", "BridgeOverGap", "Cathedral", "CelestialGardens", "Checkerboard",
      "CirclePillars", "CollapsingHall", "Crosshall", "CrossroadChamber", "Crossroads",
      "Crypt_Small_Altar", "DungeonLibrary", "GrandBazaar", "MazeLite", "PrisonCells",
      "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault",
      // Story rooms (gated by act / story system, but must be registered in
      // RT.TEMPLATES so the room picker can use them)
      "RathausArchive", "RitualVault", "PrisonDepths", "CouncilChamber", "ForgottenCrypt"
    ];

    for (const name of allTemplateNames) {
      const tpl = this.cache.json.get(name);
      if (tpl) {
        RT.TEMPLATES[name] = tpl;
      }
    }

    // Don't overwrite RT.MANIFEST — it's set in roomTemplates.js
    window.game = this.game;
    this.scene.start("HubSceneV2");
  }
};

// 3) Hier ganz unten, außerhalb aller Methoden:
window.StartScene = StartScene;
