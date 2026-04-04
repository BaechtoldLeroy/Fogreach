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
  
  const progressBar = this.add.graphics();
  const progressBox = this.add.graphics();
  progressBox.fillStyle(0x222222, 0.8);
  progressBox.fillRect(width / 2 - 160, height / 2 - 30, 320, 50);
  
  const loadingText = this.make.text({
    x: width / 2,
    y: height / 2 - 50,
    text: 'Lade Assets...',
    style: {
      font: '20px monospace',
      fill: '#ffffff'
    }
  });
  loadingText.setOrigin(0.5, 0.5);
  
  const percentText = this.make.text({
    x: width / 2,
    y: height / 2,
    text: '0%',
    style: {
      font: '18px monospace',
      fill: '#ffffff'
    }
  });
  percentText.setOrigin(0.5, 0.5);
  
  const assetText = this.make.text({
    x: width / 2,
    y: height / 2 + 50,
    text: '',
    style: {
      font: '14px monospace',
      fill: '#888888'
    }
  });
  assetText.setOrigin(0.5, 0.5);
  
  this.load.on('progress', function (value) {
    percentText.setText(parseInt(value * 100) + '%');
    progressBar.clear();
    progressBar.fillStyle(0xffffff, 1);
    progressBar.fillRect(width / 2 - 150, height / 2 - 20, 300 * value, 30);
  });
  
  this.load.on('fileprogress', function (file) {
    assetText.setText('Lade: ' + file.key);
  });
  
  this.load.on('complete', function () {
    progressBar.destroy();
    progressBox.destroy();
    loadingText.destroy();
    percentText.destroy();
    assetText.destroy();
  });
  
  if (typeof preloadPlayerDirectionalFrames === 'function') {
    preloadPlayerDirectionalFrames(this.load);
  }

  // Brute enemy sprites
  this.load.image('brute_left0', 'assets/enemy/brute/left0.png');
  this.load.image('brute_left1', 'assets/enemy/brute/left1.png');
  this.load.image('brute_left2', 'assets/enemy/brute/left2.png');
  this.load.image('brute_right0', 'assets/enemy/brute/right0.png');
  this.load.image('brute_right1', 'assets/enemy/brute/right1.png');
  this.load.image('brute_right2', 'assets/enemy/brute/right2.png');

  // Enemy sprites (pixel art)
  this.load.image('sprite_imp', 'assets/enemy/imp/imp.png');
  this.load.image('sprite_archer', 'assets/enemy/archer/archer.png');
  this.load.image('sprite_mage', 'assets/enemy/mage/mage.png');
  this.load.image('sprite_shadow', 'assets/enemy/shadow/shadow.png');
  this.load.image('sprite_chainguard', 'assets/enemy/chainguard/chainguard.png');
  this.load.image('sprite_flameweaver', 'assets/enemy/flameweaver/flameweaver.png');
  // Boss sprites
  this.load.image('sprite_boss_chain', 'assets/enemy/boss_chain/chainmaster.png');
  this.load.image('sprite_boss_ceremony', 'assets/enemy/boss_ceremony/ceremonymaster.png');
  this.load.image('sprite_boss_shadow', 'assets/enemy/boss_shadow/shadowcouncillor.png');

  const templateNames = [
    "Arena", "ArmoryVault", "BridgeOverGap", "Cathedral", "CelestialGardens", "Checkerboard",
    "CirclePillars", "CollapsingHall", "Crosshall", "CrossroadChamber", "Crossroads",
    "Crypt_Small_Altar", "DungeonLibrary", "GrandBazaar", "MazeLite", "PrisonCells",
    "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault"
  ];
  for (const name of templateNames) {
    this.load.json(name, `js/roomTemplates/${name}.json`);
  }
};

StartScene.prototype.create = function () {
  if (typeof normalizePlayerDirectionalFrames === 'function') {
    normalizePlayerDirectionalFrames(this);
  }
  // Vollbild bei erstem Touch
  this.input.addPointer(1);
  /*this.input.on('pointerdown', () => {
    if (!this.scale.isFullscreen) this.scale.startFullscreen();
  });*/

  // Titel
  this.add
    .text(400, 200, "Demonfall", {
      fontSize: "48px",
      fill: "#ffffff",
    })
    .setOrigin(0.5);

  const hasExistingSave = window.hasSave && hasSave();

  let startY = hasExistingSave ? 340 : 300;

  let btn;

  // Fortsetzen zuerst, wenn Save vorhanden ist
  if (hasExistingSave) {
    const contBtn = this.add
      .text(400, 280, "FORTSETZEN", {
        fontSize: "36px",
        fill: "#ffea6a",
        backgroundColor: "#111",
        padding: { x: 16, y: 10 },
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

    const saveInfo = this.add.text(400, 322, 'Spielstand gefunden', {
      fontSize: '18px',
      fill: '#cfcfcf'
    }).setOrigin(0.5).setDepth(1001);

    const delBtn = this.add
      .text(400, 360, "SPIELSTAND LOESCHEN", {
        fontSize: "18px",
        fill: "#ff6666",
        backgroundColor: '#200',
        padding: { x: 10, y: 4 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);

    delBtn.on("pointerdown", () => {
      if (window.clearSave) clearSave();
      contBtn.destroy();
      delBtn.destroy();
      saveInfo.destroy();
    });

    startY = 420;
  }

  // START GAME
  btn = this.add
    .text(400, startY, hasExistingSave ? "NEUES SPIEL" : "START GAME", {
      fontSize: hasExistingSave ? "28px" : "32px",
      fill: hasExistingSave ? "#88ff88" : "#00ff00",
      backgroundColor: "#000",
      padding: { x: 12, y: 6 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(1001);

  btn
    .on("pointerdown", () => {
      if (window.clearSave) {
        /* optional: clearSave(); */
      }
      if (typeof window.pendingLoadedSave !== "undefined") {
        window.pendingLoadedSave = null;
      }
      window.__DEV_FORCE_CHEAT__ = true;
      // Starte GameScene erst, wenn Templates geladen sind
      loadRoomTemplatesAndStart.call(this);
    })
    .on("pointerover", () => btn.setStyle({ fill: hasExistingSave ? '#b0ffb0' : '#ffff00' }))
    .on("pointerout", () => btn.setStyle({ fill: hasExistingSave ? '#88ff88' : '#00ff00' }));

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
      "RitualChamber", "SewageTunnel", "Spiral", "ThroneRoom", "Treasure_Small", "TreasureVault"
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
