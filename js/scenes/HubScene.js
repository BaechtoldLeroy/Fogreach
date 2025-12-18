// HubScene.js
class HubScene extends Phaser.Scene {
  constructor() {
    super('HubScene');
  }

  init(data) {
    this.gameState = data?.gameState || { hubPhase: 0 };
  }

// HubScene.js
preload() {
  if (window.PerformanceMonitor) {
    this._perfMonitor = new window.PerformanceMonitor(this);
    this._perfMonitor.startTimer('preload_total');
  }
  
  // Pfad einmal setzen
  this.load.setPath('assets/sprites');
  
  if (this._perfMonitor) this._perfMonitor.startTimer('preload_archivschmiede');
  this.load.image('archivschmiede', 'archivschmiede.png');
  this.load.once('filecomplete-image-archivschmiede', () => {
    if (this._perfMonitor) {
      this._perfMonitor.endTimer('preload_archivschmiede', 'assetLoading');
      this._perfMonitor.trackAssetLoad('archivschmiede', 'building');
    }
  });
  
  if (this._perfMonitor) this._perfMonitor.startTimer('preload_rathaus');
  this.load.image('rathaus', 'rathaus.png');
  this.load.once('filecomplete-image-rathaus', () => {
    if (this._perfMonitor) {
      this._perfMonitor.endTimer('preload_rathaus', 'assetLoading');
      this._perfMonitor.trackAssetLoad('rathaus', 'building');
    }
  });
  
  if (this._perfMonitor) this._perfMonitor.startTimer('preload_ground');
  
  // Tilemap Texturen laden
  this.load.setPath('assets/tilesmap');
  this.load.image('tile_grass', 'grass.png');
  this.load.image('tile_ground', 'ground.png');
  this.load.image('tile_ground_street', 'ground_street.png');
  this.load.image('tile_grass_bottom_ground_top', 'grass_bottom_ground_top.png');
  this.load.image('tile_grass_left_ground_right', 'grass_left_ground_right.png');
  this.load.image('tile_grass_right_ground_left', 'grass_right_ground_left.png');
  this.load.image('tile_grass_top_ground_bottom', 'grass_top_ground_bottom.png');
  this.load.setPath('assets/sprites');
  
  this.load.once('filecomplete-image-tile_ground', () => {
    if (this._perfMonitor) {
      this._perfMonitor.endTimer('preload_ground', 'assetLoading');
      this._perfMonitor.trackAssetLoad('tile_ground', 'terrain');
      this._perfMonitor.trackAssetLoad('tile_grass', 'terrain');
      this._perfMonitor.trackAssetLoad('tile_ground_street', 'terrain');
    }
  });
  
  this.load.once('complete', () => {
    if (this._perfMonitor) {
      this._perfMonitor.endTimer('preload_total', 'assetLoading');
    }
  });
}


  create() {
    if (this._perfMonitor) {
      this._perfMonitor.startTimer('create_total');
      this._perfMonitor.startTimer('create_world_setup');
    }
    
    // Weltgroesse
    const W = 2048, H = 1536;
    this.cameras.main.setBounds(0, 0, W, H);
    this.physics.world.setBounds(0, 0, W, H);

    
    if (this._perfMonitor) this._perfMonitor.endTimer('create_world_setup');

    if (this._perfMonitor) this._perfMonitor.startTimer('create_player');
    
    // Spieler-Textur bereitstellen (Spritesheet bevorzugt, sonst Fallback)
    const hasSheet = this.textures.exists('playerSprites');
    if (!hasSheet && !this.textures.exists('playerTexture')) {
      if (typeof window.createPlayerGraphics === 'function') {
        window.createPlayerGraphics.call(this);
      } else if (typeof createPlayerGraphics === 'function') {
        createPlayerGraphics.call(this);
      }
    }

    const textureKey = (typeof getPlayerTextureKey === 'function')
      ? getPlayerTextureKey(this)
      : (hasSheet ? 'playerSprites' : 'playerTexture');

    if (typeof normalizePlayerDirectionalFrames === 'function') {
      normalizePlayerDirectionalFrames(this);
    }

    // Spieler - startet auf dem Boulevard
    this.player = this.physics.add.sprite(1024, 612, textureKey, 0)
      .setCollideWorldBounds(true);

    if (typeof applyPlayerDisplaySettings === 'function') {
      applyPlayerDisplaySettings(this.player);
    }
    if (typeof ensurePlayerAnimations === 'function') ensurePlayerAnimations(this);
    if (typeof updatePlayerSpriteAnimation === 'function') {
      updatePlayerSpriteAnimation(this.player, 0, 0);
    }
    this.player.setDepth(100); // Spieler über allen anderen Objekten
    this.cursors = this.input.keyboard.createCursorKeys();
    this._activeInteractable = null;
    this._dialogOpen = false;
    
    if (this._perfMonitor) this._perfMonitor.endTimer('create_player');

    // Gebaeude und Kollision
    this.buildingGroup = this.physics.add.staticGroup();
    this.entranceZones = this.physics.add.staticGroup();
    this.npcGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this._interactionZones = [];

    // Layout laden und zeichnen
    this.buildings = HUB_LAYOUT.buildings;
    
    if (this._perfMonitor) this._perfMonitor.startTimer('create_drawHubGround');
    this._drawHubGround(W, H);
    if (this._perfMonitor) this._perfMonitor.endTimer('create_drawHubGround');
    
    if (this._perfMonitor) this._perfMonitor.startTimer('create_spawnBuildings');
    this._spawnBuildings(this.buildings);
    if (this._perfMonitor) this._perfMonitor.endTimer('create_spawnBuildings');
    
    if (this._perfMonitor) this._perfMonitor.startTimer('create_createNPCs');
    this._createNPCs();
    if (this._perfMonitor) this._perfMonitor.endTimer('create_createNPCs');

    this.input.keyboard.on('keydown-E', this._handleInteract, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-E', this._handleInteract, this);
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.input.keyboard.off('keydown-E', this._handleInteract, this);
    });

    // Kamera folgt Spieler
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // UI Prompt
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: 16,
      backgroundColor: '#000a',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5, 1).setDepth(1000).setVisible(false);

    const ensureInventoryLoadedFromSave = () => {
      const applyState = (state) => {
        if (!state || typeof applySaveToState !== 'function') return false;
        try {
          applySaveToState(this, state);
          return true;
        } catch (err) {
          console.warn('[HubScene] applySaveToState failed', err);
          return false;
        }
      };

      const inventoryMissing = () => !Array.isArray(window.inventory) || !window.inventory.some(Boolean);

      let applied = false;
      if (window.pendingLoadedSave) {
        applied = applyState(window.pendingLoadedSave) || applied;
      }

      if (!applied && inventoryMissing() && window.__LAST_SAVE_SNAPSHOT__) {
        applied = applyState(window.__LAST_SAVE_SNAPSHOT__) || applied;
      }

      if (!Array.isArray(window.inventory)) {
        window.inventory = new Array(typeof INV_SLOTS === 'number' ? INV_SLOTS : 20).fill(null);
      }
      if (typeof inventory !== 'undefined' && inventory !== window.inventory) {
        inventory = window.inventory;
      }
      if (typeof equipment !== 'undefined') {
        if (window.equipment && equipment !== window.equipment) {
          equipment = window.equipment;
        } else if (!window.equipment) {
          window.equipment = equipment;
        }
      }
    };

    ensureInventoryLoadedFromSave();

    // Kollision Spieler <-> Gebaeude
    this.physics.add.collider(this.player, this.buildingGroup);
    this.physics.add.collider(this.player, this.npcGroup);

    if (typeof ensurePlayerAnimations === 'function') ensurePlayerAnimations(this);
    if (typeof updatePlayerSpriteAnimation === 'function') {
      updatePlayerSpriteAnimation(this.player, 0, 0);
    }

    // Update je nach Hub-Phase (0..n)
    this._applyHubPhase(this.gameState.hubPhase);
    
    if (this._perfMonitor) {
      this._perfMonitor.endTimer('create_total');
      this._perfMonitor.createOverlay();
      
      this.input.keyboard.on('keydown-P', () => {
        if (this._perfMonitor) {
          this._perfMonitor.toggleOverlay();
        }
      });
      
      this.time.delayedCall(1000, () => {
        if (this._perfMonitor) {
          this._perfMonitor.printReport();
          console.log('[HubScene] Performance Monitor initialized. Press P to toggle overlay.');
        }
      });
    }
    
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this._perfMonitor) {
        this._perfMonitor.printReport();
        this._perfMonitor.destroy();
        this._perfMonitor = null;
      }
    });
    
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      if (this._perfMonitor) {
        this._perfMonitor.destroy();
        this._perfMonitor = null;
      }
    });
  }

  update(t, dt) {
    if (this._perfMonitor) {
      this._perfMonitor.updateFPS();
      this._perfMonitor.updatePlayerMovement(this.player);
      
      if (this._perfMonitor.overlayVisible) {
        this._perfMonitor.updateOverlay();
      }
      
      if (!this._perfMemoryUpdateTimer) {
        this._perfMemoryUpdateTimer = 0;
      }
      this._perfMemoryUpdateTimer += dt;
      if (this._perfMemoryUpdateTimer >= 2000) {
        this._perfMonitor.updateMemory();
        this._perfMemoryUpdateTimer = 0;
      }
    }
    
    // simple Movement
    const p = this.player;
    const prompt = this.prompt;
    let inputX = 0, inputY = 0;
    if (!this._dialogOpen) {
      if (this.cursors.left.isDown) inputX -= 1;
      if (this.cursors.right.isDown) inputX += 1;
      if (this.cursors.up.isDown) inputY -= 1;
      if (this.cursors.down.isDown) inputY += 1;
      const len = Math.hypot(inputX, inputY) || 1;
      const speed = (typeof playerSpeed !== 'undefined' ? playerSpeed : 220);
      const velX = (inputX / len) * speed;
      const velY = (inputY / len) * speed;
      p.setVelocity(velX, velY);
      updatePlayerSpriteAnimation(p, velX, velY);
    } else {
      p.setVelocity(0, 0);
      updatePlayerSpriteAnimation(p, 0, 0);
    }

    this._refreshInteractionPrompt();
    if (prompt) {
      prompt.setPosition(p?.x ?? 0, (p?.y ?? 0) - 52);
    }
  }

  _drawHubGround(W, H) {
    const TILE_SIZE = 32;
    const allTempTiles = [];
    
    const getScale = (texKey) => {
      const tex = this.textures.get(texKey);
      if (!tex) return { x: 1, y: 1 };
      return { x: TILE_SIZE / tex.source[0].width, y: TILE_SIZE / tex.source[0].height };
    };
    
    const placeTile = (tx, ty, texKey, tint = null) => {
      const s = getScale(texKey);
      const tile = this.add.image(tx, ty, texKey).setOrigin(0, 0).setScale(s.x, s.y).setDepth(0);
      if (tint) tile.setTint(tint);
      allTempTiles.push(tile);
      return tile;
    };
    
    const fillArea = (x, y, w, h, texKey, options = {}) => {
      const { tintVariation = 0.05, jitter = 0 } = options;
      const startX = Math.floor(x / TILE_SIZE) * TILE_SIZE;
      const startY = Math.floor(y / TILE_SIZE) * TILE_SIZE;
      const endX = Math.ceil((x + w) / TILE_SIZE) * TILE_SIZE;
      const endY = Math.ceil((y + h) / TILE_SIZE) * TILE_SIZE;
      
      for (let ty = startY; ty < endY; ty += TILE_SIZE) {
        for (let tx = startX; tx < endX; tx += TILE_SIZE) {
          let tint = null;
          if (tintVariation > 0) {
            const f = 1 + Phaser.Math.FloatBetween(-tintVariation, tintVariation);
            const v = Math.round(255 * f);
            tint = Phaser.Display.Color.GetColor(Phaser.Math.Clamp(v, 200, 255), Phaser.Math.Clamp(v, 200, 255), Phaser.Math.Clamp(v, 200, 255));
          }
          const tile = placeTile(tx, ty, texKey, tint);
          if (jitter > 0) {
            tile.x += Phaser.Math.FloatBetween(-jitter, jitter);
            tile.y += Phaser.Math.FloatBetween(-jitter, jitter);
          }
        }
      }
    };
    
    const placeTransitionEdges = (zoneX, zoneY, zoneW, zoneH) => {
      const s = getScale('tile_grass_top_ground_bottom');
      for (let tx = zoneX; tx < zoneX + zoneW; tx += TILE_SIZE) {
        const tTop = this.add.image(tx, zoneY - TILE_SIZE, 'tile_grass_top_ground_bottom').setOrigin(0, 0).setScale(s.x, s.y).setDepth(0);
        allTempTiles.push(tTop);
        const tBot = this.add.image(tx, zoneY + zoneH, 'tile_grass_bottom_ground_top').setOrigin(0, 0).setScale(s.x, s.y).setDepth(0);
        allTempTiles.push(tBot);
      }
      for (let ty = zoneY; ty < zoneY + zoneH; ty += TILE_SIZE) {
        const tLeft = this.add.image(zoneX - TILE_SIZE, ty, 'tile_grass_left_ground_right').setOrigin(0, 0).setScale(s.x, s.y).setDepth(0);
        allTempTiles.push(tLeft);
        const tRight = this.add.image(zoneX + zoneW, ty, 'tile_grass_right_ground_left').setOrigin(0, 0).setScale(s.x, s.y).setDepth(0);
        allTempTiles.push(tRight);
      }
    };

    const rathaus = (this.buildings || []).find(b => b.id === 'rathaus');
    const schmiede = (this.buildings || []).find(b => b.id === 'archivschmiede');
    const druckerei = (this.buildings || []).find(b => b.id === 'druckerei');

    const rathausBottom = rathaus ? rathaus.y + rathaus.h : 336;
    const plazaY = rathausBottom + 20;
    const plazaH = 160;
    const plazaW = 480;
    const plazaX = rathaus ? rathaus.x + (rathaus.w - plazaW) / 2 + 30 : W / 2 - plazaW / 2;
    const plaza = { x: plazaX, y: plazaY, w: plazaW, h: plazaH };

    const leftCourtyard = { x: plazaX - 180, y: plazaY + 40, w: 140, h: 100 };
    const rightCourtyard = { x: plazaX + plazaW + 60, y: plazaY + 20, w: 120, h: 120 };

    const blvH = 64;
    const blvY = 580;
    const blvX = 180;
    const blvW = W - 360;

    fillArea(0, 0, W, H, 'tile_grass', { tintVariation: 0.04 });

    const DIRT_PAD = 48;
    const DIRT_SOFT = 28;
    
    if (rathaus) {
      const dx = rathaus.x - DIRT_PAD;
      const dy = rathaus.y - 20;
      const dw = rathaus.w + DIRT_PAD * 2;
      const dh = rathaus.h + DIRT_PAD + 40;
      fillArea(dx, dy, dw, dh, 'tile_ground', { tintVariation: 0.06 });
    }

    [schmiede, druckerei].forEach(b => {
      if (!b) return;
      const dx = b.x - DIRT_PAD - DIRT_SOFT;
      const dy = b.y - DIRT_PAD;
      const dw = b.w + (DIRT_PAD + DIRT_SOFT) * 2;
      const dh = b.h + DIRT_PAD * 2 + 40;
      fillArea(dx, dy, dw, dh, 'tile_ground', { tintVariation: 0.06 });
    });

    fillArea(plaza.x, plaza.y, plaza.w, plaza.h, 'tile_ground_street', { tintVariation: 0.04, jitter: 0.5 });
    
    fillArea(leftCourtyard.x, leftCourtyard.y, leftCourtyard.w, leftCourtyard.h, 'tile_ground_street', { tintVariation: 0.05, jitter: 0.3 });
    fillArea(rightCourtyard.x, rightCourtyard.y, rightCourtyard.w, rightCourtyard.h, 'tile_ground_street', { tintVariation: 0.05, jitter: 0.3 });
    
    fillArea(leftCourtyard.x + leftCourtyard.w, leftCourtyard.y + 30, plaza.x - (leftCourtyard.x + leftCourtyard.w), 40, 'tile_ground_street', { tintVariation: 0.04 });
    fillArea(plaza.x + plaza.w, rightCourtyard.y + 40, rightCourtyard.x - (plaza.x + plaza.w), 40, 'tile_ground_street', { tintVariation: 0.04 });

    fillArea(blvX, blvY, blvW, blvH, 'tile_ground_street', { tintVariation: 0.05, jitter: 0.5 });

    const cx = plaza.x + plaza.w / 2 - 20;
    const bandW = 72;
    const bandTop = plaza.y + plaza.h;
    const bandBot = blvY;
    if (bandBot > bandTop) {
      fillArea(cx - bandW / 2, bandTop, bandW, bandBot - bandTop, 'tile_ground_street', { tintVariation: 0.04 });
    }

    const pathW = 52;
    if (schmiede) {
      const sx = schmiede.x + schmiede.w / 2;
      const pathTop = blvY + blvH;
      const pathBottom = schmiede.y - 20;
      if (pathBottom > pathTop) {
        fillArea(sx - pathW / 2, pathTop, pathW, pathBottom - pathTop, 'tile_ground_street', { tintVariation: 0.04, jitter: 0.4 });
      }
    }
    if (druckerei) {
      const dx = druckerei.x + druckerei.w / 2;
      const pathTop = blvY + blvH;
      const pathBottom = druckerei.y - 20;
      if (pathBottom > pathTop) {
        fillArea(dx - pathW / 2, pathTop, pathW, pathBottom - pathTop, 'tile_ground_street', { tintVariation: 0.04, jitter: 0.4 });
      }
    }

    this._hubGroundRT = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(0);
    allTempTiles.forEach(tile => {
      this._hubGroundRT.draw(tile, tile.x, tile.y);
    });
    allTempTiles.forEach(tile => tile.destroy());

    if (this._groundTile) {
      this._groundTile.destroy();
      this._groundTile = null;
    }

    this._spawnDecorations(rathaus, schmiede, druckerei, plaza, leftCourtyard, rightCourtyard, blvX, blvY, blvW, blvH);
    this._pendingUpperCityWall = { rathaus, W };
  }

  _spawnUpperCityWall(rathaus, W) {
    if (!rathaus) return;
    
    const wallY = rathaus.y;
    const wallH = rathaus.h;
    
    const leftEndX = rathaus.x;
    const rightStartX = rathaus.x + rathaus.w;
    
    if (leftEndX > 60) {
      this._spawnCityBlock(0, wallY, leftEndX - 10, wallH, 4);
      if (leftEndX > 200) {
        this._spawnCityBlock(40, wallY - 15, Math.min(180, leftEndX - 80), 70, 5);
      }
    }
    
    const rightWallW = W - rightStartX;
    if (rightWallW > 60) {
      this._spawnCityBlock(rightStartX + 10, wallY, rightWallW - 10, wallH, 4);
      if (rightWallW > 200) {
        this._spawnCityBlock(rightStartX + 50, wallY - 15, Math.min(180, rightWallW - 80), 70, 5);
      }
    }
    
    const colliderY = 0;
    const colliderH = rathaus.y + rathaus.h * 0.6;
    
    const leftZone = this.add.zone(leftEndX / 2, colliderH / 2, leftEndX, colliderH);
    this.physics.add.existing(leftZone, true);
    this.buildingGroup.add(leftZone);
    
    const rightZone = this.add.zone(rightStartX + rightWallW / 2, colliderH / 2, rightWallW, colliderH);
    this.physics.add.existing(rightZone, true);
    this.buildingGroup.add(rightZone);
    
    const topZone = this.add.zone(W / 2, rathaus.y / 2, W, rathaus.y);
    this.physics.add.existing(topZone, true);
    this.buildingGroup.add(topZone);
  }

  _spawnCityBlock(x, y, w, h, depth = 4) {
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x2a2a2a, 1).fillRect(x, y, w, h);
    g.fillStyle(0x1a1a1a, 1).fillRect(x, y, w, 16);
    const roofH = 20;
    g.fillStyle(0x1e1e1e, 1);
    g.beginPath();
    g.moveTo(x - 4, y);
    g.lineTo(x + w / 2, y - roofH);
    g.lineTo(x + w + 4, y);
    g.closePath();
    g.fillPath();
    const windowCount = Math.floor(w / 50);
    for (let i = 0; i < windowCount; i++) {
      const wx = x + 20 + i * 45;
      const wy = y + 28;
      g.fillStyle(0x3a3a3a, 0.6).fillRect(wx, wy, 18, 24);
      g.fillStyle(0x4a4a3a, 0.3).fillRect(wx + 2, wy + 2, 14, 20);
    }
    g.fillStyle(0x000000, 0.25).fillRect(x, y + h, w, 10);
    return g;
  }

  _spawnDecorations(rathaus, schmiede, druckerei, plaza, leftCourtyard, rightCourtyard, blvX, blvY, blvW, blvH) {
    if (rathaus) {
      const wingW = 100, wingH = 70;
      const wingY = rathaus.y + rathaus.h - 60;
      this._spawnWallWing(rathaus.x - wingW - 8, wingY, wingW, wingH, 4);
      this._spawnWallWing(rathaus.x + rathaus.w + 8, wingY, wingW, wingH, 4);
    }

    this._spawnLantern(plaza.x + 30, plaza.y + 20, 6);
    this._spawnLantern(plaza.x + plaza.w - 30, plaza.y + 20, 6);
    this._spawnLantern(plaza.x + plaza.w / 2, plaza.y + plaza.h - 20, 6);
    
    this._spawnPlanter(plaza.x + 80, plaza.y + plaza.h - 40, 6);
    this._spawnPlanter(plaza.x + plaza.w - 80, plaza.y + plaza.h - 40, 6);
    this._spawnBench(plaza.x + plaza.w / 2 - 80, plaza.y + 60, 6);
    this._spawnBench(plaza.x + plaza.w / 2 + 80, plaza.y + 60, 6);

    this._spawnLantern(leftCourtyard.x + 20, leftCourtyard.y + leftCourtyard.h - 10, 5);
    this._spawnPlanter(leftCourtyard.x + leftCourtyard.w - 30, leftCourtyard.y + 20, 5);
    
    this._spawnLantern(rightCourtyard.x + rightCourtyard.w - 20, rightCourtyard.y + 20, 5);
    this._spawnBench(rightCourtyard.x + 30, rightCourtyard.y + rightCourtyard.h - 30, 5);

    this._spawnLantern(blvX + 80, blvY + blvH + 15, 5);
    this._spawnLantern(blvX + blvW - 80, blvY + blvH + 15, 5);
    this._spawnLantern(blvX + blvW / 2, blvY + blvH + 15, 5);
    this._spawnPlanter(blvX + 200, blvY - 20, 5);
    this._spawnPlanter(blvX + blvW - 200, blvY - 20, 5);

    if (schmiede) {
      this._spawnLantern(schmiede.x - 20, schmiede.y + schmiede.h / 2, 5);
      this._spawnLantern(schmiede.x + schmiede.w + 20, schmiede.y + schmiede.h / 2, 5);
      this._spawnPlanter(schmiede.x + 30, schmiede.y - 30, 4);
      this._spawnBench(schmiede.x + schmiede.w - 60, schmiede.y - 35, 4);
    }
    if (druckerei) {
      this._spawnLantern(druckerei.x - 20, druckerei.y + druckerei.h / 2, 5);
      this._spawnLantern(druckerei.x + druckerei.w + 20, druckerei.y + druckerei.h / 2, 5);
      this._spawnPlanter(druckerei.x + druckerei.w - 30, druckerei.y - 30, 4);
    }
  }

  _spawnWallWing(x, y, w, h, depth = 4) {
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x3a3a3a, 1).fillRect(x, y, w, h);
    g.fillStyle(0x2a2a2a, 1).fillRect(x, y, w, 12);
    g.fillStyle(0x4a4a4a, 0.3).fillRect(x + 10, y + 20, 20, 30);
    g.fillRect(x + w - 30, y + 20, 20, 30);
    g.fillStyle(0x000000, 0.2).fillRect(x, y + h, w, 8);
    return g;
  }

  _spawnLantern(x, y, depth = 5) {
    // y ist die Bodenlinie der Laterne
    const pole = this.add.graphics().setDepth(depth);
    // Mast
    pole.fillStyle(0x2a2a2a, 1).fillRect(x - 2, y - 48, 4, 48);
    // Fuss
    pole.fillStyle(0x2a2a2a, 1).fillRect(x - 6, y - 6, 12, 6);
    // Kopf
    pole.fillStyle(0x2a2a2a, 1).fillRoundedRect(x - 10, y - 64, 20, 12, 3);
    // Glas
    pole.fillStyle(0xffe2a8, 1).fillRoundedRect(x - 8, y - 58, 16, 18, 3);
    pole.lineStyle(1, 0x1e1e1e, 1).strokeRoundedRect(x - 8, y - 58, 16, 18, 3);

    // Glow
    const glow = this.add.ellipse(x, y - 56, 140, 110, 0xffe2a8, 0.20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth - 1);

    // leichtes Flackern
    this.tweens.add({
      targets: glow,
      scaleX: { from: 0.96, to: 1.05 },
      scaleY: { from: 0.92, to: 1.08 },
      alpha: { from: 0.14, to: 0.26 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return { pole, glow };
  }

  _spawnBench(x, y, depth = 5) {
    const g = this.add.graphics().setDepth(depth);
    // Beine
    g.fillStyle(0x3a2a1a, 1).fillRect(x - 34, y + 10, 8, 12);
    g.fillRect(x + 26, y + 10, 8, 12);
    // Sitzflaeche
    g.fillStyle(0x6a4a2a, 1).fillRoundedRect(x - 40, y, 80, 12, 3);
    // Rueckenlehne
    g.fillStyle(0x5a3a1a, 1).fillRoundedRect(x - 40, y - 14, 80, 10, 3);
    // Schatten
    g.fillStyle(0x000000, 0.15).fillEllipse(x, y + 22, 84, 12);
    return g;
  }

  _spawnPlanter(x, y, depth = 5) {
    const g = this.add.graphics().setDepth(depth);
    // Steintopf
    g.fillStyle(0x5a5a5a, 1).fillRoundedRect(x - 16, y, 32, 14, 4);
    g.fillStyle(0x3a3a3a, 1).fillRoundedRect(x - 14, y + 2, 28, 10, 3);
    // Strauch
    g.fillStyle(0x2f5a3a, 1).fillCircle(x - 6, y, 10);
    g.fillCircle(x + 6, y - 2, 9);
    g.fillCircle(x, y - 6, 8);
    // leichter Schimmer
    g.fillStyle(0xffffff, 0.06).fillCircle(x + 4, y - 8, 6);
    return g;
  }

_placeBuildingImageFitHeight(b, texKey, extraYOffset = 0) {
  const tex = this.textures.get(texKey);
  const src = tex?.getSourceImage?.();
  const iw = src?.width || b.w;
  const ih = src?.height || b.h;

  const heightScaleFactor = 1.0;  // doppelte Gebäudehöhe
  const scale = (b.h * heightScaleFactor) / ih;

  const scaledW = iw * scale;
  const scaledH = ih * scale;

  const baseX = b.x + b.w / 2;
  const baseY = b.y + b.h + extraYOffset; // <— Offset hier angewendet

  const spr = this.add.image(baseX, baseY, texKey)
    .setOrigin(0.5, 1)
    .setScale(scale)
    .setDepth(b.depth || 1);

  const collider = this.buildingGroup.create(baseX, baseY - scaledH / 2, null);
  collider.setSize(scaledW, scaledH).setVisible(false);

  return { spr, scaledW, scaledH, baseX, baseY };
}



  _spawnBuildings(buildings) {
    for (const b of buildings) {
      let spr, glow;
// --- Archivschmiede (proportional zur Höhe)
if (b.id === 'archivschmiede' && this.textures.exists('archivschmiede')) {
  const placed = this._placeBuildingImageFitHeight(b, 'archivschmiede', -25); // ↓ 200px tiefer

  // Eingangszonen beibehalten (für Interaktion)
  if (b.entrances) {
    for (const e of b.entrances) {
      let zw = e.w, zh = e.h;
      let zx = b.x + e.x;
      let zy = b.y + e.y;
      if (b.door) {
        if (!zw) zw = Math.max(40, Math.round(b.door.w * 0.8));
        if (!zh) zh = Math.max(28, Math.round(b.door.h * 0.5));
        zx = b.x + b.door.x + Math.round((b.door.w - zw) / 2);
        zy = placed.baseY + 2 - zh;
      }
      const zone = this.add.zone(zx, zy, zw, zh).setOrigin(0, 0);
      this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
      this.entranceZones.add(zone);
      this._registerInteraction(zone, {
        type: 'building',
        buildingId: b.id,
        onEnter: e.onEnter,
        label: e.label || 'Betreten [E]'
      });
    }
  }
  continue;
}

// --- Rathaus (proportional zur Höhe)
if (b.id === 'rathaus' && this.textures.exists('rathaus')) {
  const placed = this._placeBuildingImageFitHeight(b, 'rathaus', 50);
  
  if (this._pendingUpperCityWall) {
    const actualRathaus = {
      x: placed.baseX - placed.scaledW / 2,
      y: placed.baseY - placed.scaledH,
      w: placed.scaledW,
      h: placed.scaledH
    };
    this._spawnUpperCityWall(actualRathaus, this._pendingUpperCityWall.W);
    this._pendingUpperCityWall = null;
  }

  if (b.entrances) {
    for (const e of b.entrances) {
      let zw = e.w, zh = e.h;
      let zx = b.x + e.x;
      let zy = b.y + e.y;
      if (b.door) {
        if (!zw) zw = Math.max(40, Math.round(b.door.w * 0.8));
        if (!zh) zh = Math.max(28, Math.round(b.door.h * 0.5));
        zx = b.x + b.door.x + Math.round((b.door.w - zw) / 2);
        zy = placed.baseY + 2 - zh;
      }
      const zone = this.add.zone(zx, zy, zw, zh).setOrigin(0, 0);
      this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
      this.entranceZones.add(zone);
      this._registerInteraction(zone, {
        type: 'building',
        buildingId: b.id,
        onEnter: e.onEnter,
        label: e.label || 'Betreten [E]'
      });
    }
  }
  continue;
}

      // Special handling for detailed Archivschmiede
      if (b.id === 'archivschmiede' && b.useDetailedTexture) {
        const texKey = this._ensureBuildingTexture(b);
        const result = placeArchivschmiede(this, Math.round(b.x), Math.round(b.y + b.h), texKey, { depth: b.depth || 1, embedAnvil: false });
        spr = result.img;
        glow = result.glow;

        // Update entrance positions based on door meta data
        const doorMeta = result.meta.door;
        if (b.entrances && b.entrances[0] && doorMeta) {
          b.entrances[0].x = result.img.x + doorMeta.x + doorMeta.w / 2;
          b.entrances[0].y = result.img.y - doorMeta.y - doorMeta.h;
        }

        // Eingangszonen fuer Archivschmiede direkt hier anlegen (Sonderzweig wuerde sonst ueberspringen)
        if (b.entrances && b.entrances[0] && doorMeta) {
          const e = b.entrances[0];
          const zw = e.w || Math.max(40, Math.round(doorMeta.w * 0.8));
          const zh = e.h || Math.max(28, Math.round(doorMeta.h * 0.5));
          const zx = result.img.x + doorMeta.x + Math.round((doorMeta.w - zw) / 2);
          // unten an die Fassadenkante, minimal vorstehend
          const zy = result.img.y - result.meta.size.h + result.meta.size.h + 2 - zh; // = result.img.y + 2 - zh
          const zone = this.add.zone(zx, zy, zw, zh).setOrigin(0, 0);
          this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
          this.entranceZones.add(zone);
          const meta = {
            type: 'building',
            buildingId: b.id,
            onEnter: e.onEnter,
            label: e.label || 'Betreten [E]'
          };
          this._registerInteraction(zone, meta);
        }

        // Spezielle Kollision für Archivschmiede - knapper, um Amboss Platz zu geben
        const customCollider = this.buildingGroup.create(
          result.img.x + result.meta.size.w / 2,
          result.img.y - result.meta.size.h / 2,
          null
        );
        customCollider.setSize(result.meta.size.w - 12, result.meta.size.h - 28).setVisible(false);
        // Standard-Kollider überspringen
        continue;
      } else {
        // Standard building rendering
        const texKey = this._ensureBuildingTexture(b);
        spr = this.add.image(b.x + b.w / 2, b.y + b.h / 2, texKey).setDepth(b.depth || 1);
      }

      // Kollision: statische Huelle
      const collider = this.buildingGroup.create(b.x + b.w / 2, b.y + b.h / 2, null);
      collider.setSize(b.w, b.h).setVisible(false);

      // Eingangszonen
      if (b.entrances) {
        for (const e of b.entrances) {
          // Standard-Position
          let zw = e.w, zh = e.h;
          let zx = b.x + e.x;
          let zy = b.y + e.y;

          // Wenn Door vorhanden: Zone VOR die Tuer auf den Boden schieben (nicht mehr im Gebaeude-Koerper)
          if (b.door) {
            if (!zw) zw = Math.max(40, Math.round(b.door.w * 0.8));
            if (!zh) zh = Math.max(28, Math.round(b.door.h * 0.5));
            zx = b.x + b.door.x + Math.round((b.door.w - zw) / 2);
            // Setze die Zone so, dass ihr UNTERER Rand knapp unterhalb der Fassadenkante liegt
            // -> komplett ausserhalb des Gebaeude-Colliders, gut erreichbar
            zy = b.y + b.h + 2 - zh;
          }

          const zone = this.add.zone(zx, zy, zw, zh).setOrigin(0, 0);
          this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
          this.entranceZones.add(zone);
          const meta = {
            type: 'building',
            buildingId: b.id,
            onEnter: e.onEnter,
            label: e.label || 'Betreten [E]'
          };
          this._registerInteraction(zone, meta);
        }
      }

      // Externe Ueberschrift nur fuer Gebaeude ohne eigene Plakette
      if (b.title && b.id !== 'rathaus' && b.id !== 'druckerei') {
        this.add.text(b.x + b.w / 2, b.y - 12, b.title, {
          fontFamily: 'serif',
          fontSize: 18,
          color: '#dddddd'
        }).setOrigin(0.5, 1);
      }
    }
  }

  _createNPCs() {
    const npcDefs = [
      {
        id: 'archivarin',
        name: 'Schmiedemeisterin Branka',
        texture: 'schmiedemeisterin',
        scale: 0.08,
        x: 452,
        y: 1110,
        depth: 120,
        lines: [
          'Stahl allein schneidet die Luegen des Rates nicht. Erst wenn jede Klinge Wissen traegt, faellt ihre Maske.',
          'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir Abschriften, und ich veredele deine Artefakte.',
          'Sprich draussen leise. Die Aufseher des Kettenrats tragen inzwischen die Farben der Stadtgarde.'
        ]
      },
      {
        id: 'drucker',
        name: 'Setzer Thom',
        texture: 'drucker',
        scale: 0.17,
        x: 1680,
        y: 1112,
        depth: 120,
        lines: [
          'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Traeume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
          'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
          'Verteile nichts Ungeprueftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
        ]
      },
      {
        id: 'spaeherin',
        name: 'Mara vom Untergrund',
        texture: 'spaeherin',
        scale: 0.0792,
        x: 960,
        y: 980,
        depth: 115,
        lines: [
          'Die Schreiber des Rates markieren Haeuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
          'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv.',
          'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
        ]
      }
    ];

    npcDefs.forEach((def) => {
      const texKey = this._ensureNpcTexture(def.texture, def.palette);
      const npc = this.physics.add.sprite(def.x, def.y, texKey)
        .setOrigin(0.5, 1)
        .setDepth(def.depth || 100);

      if (typeof def.scale === 'number') {
        npc.setScale(def.scale);
      }

      npc.body.setAllowGravity(false);
      npc.body.setImmovable(true);
      if (npc.body.setPushable) npc.body.setPushable(false);
      const hitW = 30;
      const hitH = 36;
      npc.body.setSize(hitW, hitH);
      npc.body.setOffset((npc.displayWidth - hitW) / 2, npc.displayHeight - hitH);
      this.npcGroup.add(npc);

      const zone = this.add.zone(def.x, def.y - 18, def.zoneWidth || 120, def.zoneHeight || 110);
      zone.setOrigin(0.5, 0.5);
      this.physics.world.enable(zone, Phaser.Physics.Arcade.STATIC_BODY);
      zone.body.setOffset(-zone.width / 2, -zone.height / 2);

      this._registerInteraction(zone, {
        type: 'npc',
        id: def.id,
        name: def.name,
        label: `${def.name} [E]`,
        lines: def.lines
      });
    });
  }

  _registerInteraction(zone, meta) {
    zone.meta = meta;
    this._interactionZones.push(zone);
    this.physics.add.overlap(this.player, zone, () => this._onInteractionOverlap(zone));
    zone.once(Phaser.GameObjects.Events.DESTROY, () => {
      const idx = this._interactionZones.indexOf(zone);
      if (idx !== -1) this._interactionZones.splice(idx, 1);
      if (this._activeInteractable === zone) {
        this._activeInteractable = null;
        this.prompt?.setVisible(false);
      }
    });
  }

  _onInteractionOverlap(zone) {
    if (this._dialogOpen) return;

    this._activeInteractable = zone;
    this.prompt.setText(zone.meta.label || 'Interagieren [E]');
    this.prompt.setVisible(true);
  }

  _refreshInteractionPrompt() {
    if (this._dialogOpen || !this.player?.body) return;
    const body = this.player.body;
    if (!body) return;
    const playerBounds = new Phaser.Geom.Rectangle(body.x ?? body.left ?? 0, body.y ?? body.top ?? 0, body.width ?? (body.halfWidth ? body.halfWidth * 2 : 0), body.height ?? (body.halfHeight ? body.halfHeight * 2 : 0));
    let active = null;
    for (const zone of this._interactionZones) {
      const zoneBody = zone?.body;
      if (!zoneBody) continue;
      const zx = zoneBody.x ?? zoneBody.left ?? (zone.x ?? 0);
      const zy = zoneBody.y ?? zoneBody.top ?? (zone.y ?? 0);
      const zw = zoneBody.width ?? (zoneBody.halfWidth ? zoneBody.halfWidth * 2 : zone?.width ?? 0);
      const zh = zoneBody.height ?? (zoneBody.halfHeight ? zoneBody.halfHeight * 2 : zone?.height ?? 0);
      const zoneBounds = new Phaser.Geom.Rectangle(zx, zy, zw, zh);
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zoneBounds)) {
        active = zone;
        break;
      }
    }

    if (active) {
      if (this._activeInteractable !== active) {
        this._activeInteractable = active;
        this.prompt.setText(active.meta.label || 'Interagieren [E]');
      }
      this.prompt.setVisible(true);
    } else {
      this._activeInteractable = null;
      this.prompt.setVisible(false);
    }
  }

  _activateInteraction(meta) {
    if (!meta) return;
    if (meta.type === 'npc') {
      this._showNpcDialogue(meta);
      return;
    }
    if (meta.onEnter) {
      this._enterTarget(meta);
    }
  }

  _handleInteract() {
    if (this._dialogOpen) return;
    const current = this._activeInteractable;
    if (!current) return;
    this._activeInteractable = null;
    this.prompt.setVisible(false);
    this._activateInteraction(current.meta);
  }


  _showNpcDialogue(meta) {
    if (!meta) return;

    console.log('[HubScene] Opening NPC dialogue for:', meta.name);
    this._dialogOpen = true;
    this._activeInteractable = null;
    this.prompt.setVisible(false);

    if (this._dialogContainer) {
      this._dialogContainer.destroy(true);
      this._dialogContainer = null;
    }

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height - 180;

    const container = this.add.container(cx, cy).setDepth(1500).setScrollFactor(0);
    const panelWidth = 520;
    const pad = 24;
    const innerWidth = panelWidth - pad * 2;

    const title = `${meta.name || 'Gespraech'}`;
    const header = this.add.text(0, 0, title, {
      fontFamily: 'serif',
      fontSize: 22,
      color: '#f1e9d8'
    }).setWordWrapWidth(innerWidth).setVisible(false);

    const bodyLines = meta.lines || [];
    const body = bodyLines.join('\n\n');
    const bodyText = this.add.text(0, 0, body, {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#d8d2c3',
      wordWrap: { width: innerWidth }
    }).setVisible(false);

    const headerHeight = header.height;
    const bodyHeight = bodyText.height;
    const hintHeight = 22;
    const panelHeight = Math.max(200, Math.ceil(pad + headerHeight + 12 + bodyHeight + pad + hintHeight));

    const g = this.add.graphics();
    g.fillStyle(0x0c0c11, 0.94).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    g.lineStyle(2, 0x484850, 0.9).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    container.add(g);

    header.setPosition(-panelWidth / 2 + pad, -panelHeight / 2 + pad).setVisible(true);
    bodyText.setPosition(-panelWidth / 2 + pad, header.y + headerHeight + 12).setVisible(true);
    container.add(header);
    container.add(bodyText);

    const hintY = panelHeight / 2 - pad * 0.75;
    
    if (meta.id === 'spaeherin') {
      const skillsBtn = this.add.text(0, hintY - 40, '[ Skills lernen ] (K)', {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#ffffff',
        backgroundColor: '#2a5a8a',
        padding: { x: 14, y: 8 }
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
      
      skillsBtn.on('pointerdown', (pointer, x, y, event) => {
        console.log('[HubScene] Skills button clicked');
        event.stopPropagation();
        closeDialog();
        this.time.delayedCall(100, () => {
          console.log('[HubScene] Opening skill tree UI from button');
          this._showSkillTreeUI();
        });
      });
      
      container.add(skillsBtn);
    }
    
    const hintText = this.add.text(0, hintY, 'E / Leer / ESC: schliessen', {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#b2aba0'
    }).setOrigin(0.5, 1);
    container.add(hintText);

    this._dialogContainer = container;

    const keyClosers = [];
    const unregisterKeyClosers = () => {
      while (keyClosers.length) {
        const { eventName, handler } = keyClosers.pop();
        this.input.keyboard.off(eventName, handler);
      }
    };

    const closeDialog = () => {
      if (!this._dialogOpen) return;
      this._dialogOpen = false;
      if (this._dialogContainer) {
        this._dialogContainer.destroy(true);
        this._dialogContainer = null;
      }
      unregisterKeyClosers();
      this.events.emit('dialog-closed', meta);
    };

    const bindClose = (eventName) => {
      const handler = () => closeDialog();
      this.input.keyboard.on(eventName, handler);
      keyClosers.push({ eventName, handler });
    };

    this.time.delayedCall(0, () => {
      bindClose('keydown-E');
      bindClose('keydown-SPACE');
      bindClose('keydown-ESC');
      bindClose('keydown-ENTER');
      bindClose('keydown-NUMPAD_ENTER');
      
      if (meta.id === 'spaeherin') {
        const skillHandler = () => {
          console.log('[HubScene] K pressed in Mara dialog');
          closeDialog();
          this.time.delayedCall(100, () => {
            this._showSkillTreeUI();
          });
        };
        this.input.keyboard.on('keydown-K', skillHandler);
        keyClosers.push({ eventName: 'keydown-K', handler: skillHandler });
      }
    });
    this.input.once('pointerdown', closeDialog);
  }

  _ensureNpcTexture(key, palette = {}) {
    const texKey = `npc_${key}`;
    if (this.textures.exists(texKey)) return texKey;

    const robe = palette.robe || 0x3d3a52;
    const trim = palette.trim || 0x1f1c2c;
    const skin = palette.skin || 0xc8a37e;
    const accent = palette.accent || 0xb85c38;

    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.clear();
    g.fillStyle(robe, 1).fillRoundedRect(8, 20, 24, 28, 8);
    g.fillStyle(trim, 1).fillRoundedRect(10, 22, 20, 10, 4);
    g.fillStyle(skin, 1).fillCircle(20, 14, 10);
    g.fillStyle(0x111111, 1).fillCircle(16, 12, 2);
    g.fillStyle(0x111111, 1).fillCircle(24, 12, 2);
    g.fillStyle(accent, 1).fillRect(18, 34, 4, 10);
    g.lineStyle(1, 0xffffff, 0.2).strokeRoundedRect(10, 22, 20, 10, 4);
    g.generateTexture(texKey, 40, 52);
    g.destroy();

    return texKey;
  }

  _showSkillTreeUI() {
    console.log('[HubScene] _showSkillTreeUI called');
    if (!window.SKILL_TREES || typeof window.getMaterialCount !== 'function') {
      console.warn('[HubScene] Skill system not loaded', {
        SKILL_TREES: !!window.SKILL_TREES,
        getMaterialCount: typeof window.getMaterialCount
      });
      return;
    }
    console.log('[HubScene] Opening skill tree UI');

    this._dialogOpen = true;
    if (this._dialogContainer) {
      this._dialogContainer.destroy(true);
      this._dialogContainer = null;
    }

    const cam = this.cameras.main;
    const cw = cam.width;
    const ch = cam.height;

    const overlay = this.add.rectangle(cw / 2, ch / 2, cw, ch, 0x000000, 0.7)
      .setDepth(2000)
      .setScrollFactor(0);

    const panelW = Math.min(900, cw - 40);
    const panelH = Math.min(600, ch - 40);
    const container = this.add.container(cw / 2, ch / 2).setDepth(2001).setScrollFactor(0);
    this._dialogContainer = container;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 0.97);
    bg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    bg.lineStyle(3, 0x3a4a7c, 0.9);
    bg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    container.add(bg);

    const titleText = this.add.text(0, -panelH / 2 + 20, 'Fertigkeiten bei Mara', {
      fontFamily: 'serif',
      fontSize: 28,
      color: '#e8d4b8'
    }).setOrigin(0.5, 0);
    container.add(titleText);

    const currentMaterials = window.getMaterialCount('MAT');
    const matsText = this.add.text(panelW / 2 - 20, -panelH / 2 + 20, `Eisenbrocken: ${currentMaterials}`, {
      fontFamily: 'monospace',
      fontSize: 18,
      color: '#8cb8ff'
    }).setOrigin(1, 0);
    container.add(matsText);

    const treeStartY = titleText.y + titleText.height + 30;
    const treeHeight = panelH - 140;
    const treePadding = 20;
    const trees = Object.values(window.SKILL_TREES);
    const treeWidth = (panelW - treePadding * (trees.length + 1)) / trees.length;

    let treeX = -panelW / 2 + treePadding;

    const skillHitAreas = [];
    
    const refreshUI = () => {
      matsText.setText(`Eisenbrocken: ${window.getMaterialCount('MAT')}`);
    };

    trees.forEach((tree, treeIdx) => {
      const treeBg = this.add.graphics();
      treeBg.fillStyle(0x1a1a28, 0.6);
      treeBg.fillRoundedRect(treeX, treeStartY, treeWidth, treeHeight, 12);
      treeBg.lineStyle(2, Phaser.Display.Color.HexStringToColor(tree.color).color, 0.5);
      treeBg.strokeRoundedRect(treeX, treeStartY, treeWidth, treeHeight, 12);
      container.add(treeBg);

      const treeTitle = this.add.text(treeX + treeWidth / 2, treeStartY + 15, tree.name, {
        fontFamily: 'serif',
        fontSize: 18,
        color: tree.color
      }).setOrigin(0.5, 0);
      container.add(treeTitle);

      const skillsByTier = {};
      tree.skills.forEach(skill => {
        const tier = skill.tier || 1;
        if (!skillsByTier[tier]) skillsByTier[tier] = [];
        skillsByTier[tier].push(skill);
      });

      const maxTier = Math.max(...Object.keys(skillsByTier).map(Number));
      const skillBoxHeight = 80;
      const tierGap = 15;
      const tierSpacing = skillBoxHeight + tierGap;

      let currentSkillY = treeStartY + treeTitle.height + 40;

      for (let tier = 1; tier <= maxTier; tier++) {
        const tierSkills = skillsByTier[tier] || [];
        if (tierSkills.length === 0) continue;
        
        const horizontalGap = tierSkills.length > 2 ? 8 : 12;
        const totalGapWidth = horizontalGap * Math.max(0, tierSkills.length - 1);
        const availableWidth = treeWidth - 40;
        const calculatedWidth = (availableWidth - totalGapWidth) / tierSkills.length;
        const skillBoxWidth = Math.min(140, calculatedWidth);
        const skillSpacing = skillBoxWidth + horizontalGap;
        
        const fontSize = skillBoxWidth < 80 ? 10 : 12;
        const costFontSize = skillBoxWidth < 80 ? 14 : 16;

        const totalRowWidth = skillBoxWidth * tierSkills.length + horizontalGap * (tierSkills.length - 1);
        const startX = treeX + (treeWidth - totalRowWidth) / 2;

        tierSkills.forEach((skill, idx) => {
          const skillX = startX + skillBoxWidth / 2 + idx * skillSpacing;
          const skillY = currentSkillY;
          
          const hasSkill = window.hasSkill(skill.id);
          const canPurchase = window.canPurchaseSkill(skill.id);

          let bgColor = 0x2a2a3a;
          let borderColor = 0x4a4a5a;
          let textColor = '#888888';

          if (hasSkill) {
            bgColor = Phaser.Display.Color.HexStringToColor(tree.color).color;
            borderColor = 0xffffff;
            textColor = '#ffffff';
          } else if (canPurchase.canPurchase) {
            bgColor = 0x3a3a4a;
            borderColor = Phaser.Display.Color.HexStringToColor(tree.color).color;
            textColor = '#dddddd';
          }

          const skillBox = this.add.graphics();
          skillBox.fillStyle(bgColor, 0.9);
          skillBox.fillRoundedRect(skillX - skillBoxWidth/2, skillY, skillBoxWidth, skillBoxHeight, 8);
          skillBox.lineStyle(2, borderColor, 0.9);
          skillBox.strokeRoundedRect(skillX - skillBoxWidth/2, skillY, skillBoxWidth, skillBoxHeight, 8);
          container.add(skillBox);

          const skillNameText = this.add.text(skillX, skillY + 10, skill.name, {
            fontFamily: 'Arial',
            fontSize: fontSize,
            color: textColor,
            fontStyle: 'bold',
            wordWrap: { width: skillBoxWidth - 10 },
            align: 'center'
          }).setOrigin(0.5, 0);
          container.add(skillNameText);

          const costText = this.add.text(skillX, skillY + skillBoxHeight - 22, hasSkill ? '✓' : `${skill.cost}`, {
            fontFamily: 'Arial',
            fontSize: costFontSize,
            color: hasSkill ? '#00ff00' : '#ffaa00',
            fontStyle: 'bold'
          }).setOrigin(0.5, 0);
          container.add(costText);

          const worldX = skillX + container.x;
          const worldY = skillY + skillBoxHeight/2 + container.y;
          
          const hitArea = this.add.rectangle(worldX, worldY, skillBoxWidth, skillBoxHeight, 0xffffff, 0.01)
            .setOrigin(0.5, 0.5)
            .setDepth(2050)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: !hasSkill && canPurchase.canPurchase });
          
          skillHitAreas.push(hitArea);

          hitArea.on('pointerover', () => {
            console.log('[Skills] Hover over skill:', skill.name);
            if (this._skillTooltip) {
              this._skillTooltip.destroy(true);
              this._skillTooltip = null;
            }

            const tooltipText = [
              skill.name,
              skill.description,
              '',
              `Kosten: ${skill.cost} Eisenbrocken`
            ];

            if (skill.requires && skill.requires.length > 0) {
              tooltipText.push('');
              tooltipText.push('Benötigt:');
              skill.requires.forEach(reqId => {
                const reqSkill = window.getSkillById(reqId);
                const reqName = reqSkill ? reqSkill.name : reqId;
                const reqHas = window.hasSkill(reqId);
                tooltipText.push(`  ${reqHas ? '✓' : '✗'} ${reqName}`);
              });
            }

            if (!canPurchase.canPurchase && !hasSkill) {
              tooltipText.push('');
              tooltipText.push(`❌ ${canPurchase.reason}`);
            }

            const tooltip = this.add.container(0, 0).setDepth(2100);
            const tooltipBg = this.add.graphics();
            const tooltipTextObj = this.add.text(0, 0, tooltipText.join('\n'), {
              fontFamily: 'monospace',
              fontSize: 14,
              color: '#ffffff',
              backgroundColor: '#1a1a2a',
              padding: { x: 12, y: 10 }
            }).setOrigin(0, 0);

            const tooltipW = tooltipTextObj.width + 4;
            const tooltipH = tooltipTextObj.height + 4;
            
            tooltipBg.fillStyle(0x1a1a2a, 0.95);
            tooltipBg.fillRoundedRect(-2, -2, tooltipW, tooltipH, 8);
            tooltipBg.lineStyle(2, 0x4a6a9c, 0.9);
            tooltipBg.strokeRoundedRect(-2, -2, tooltipW, tooltipH, 8);

            tooltip.add(tooltipBg);
            tooltip.add(tooltipTextObj);

            const worldX = skillX + container.x;
            const worldY = skillY + skillBoxHeight + container.y + 5;
            
            let tooltipX = worldX - tooltipW / 2;
            let tooltipY = worldY;

            if (tooltipX < 10) tooltipX = 10;
            if (tooltipX + tooltipW > cw - 10) tooltipX = cw - tooltipW - 10;
            if (tooltipY + tooltipH > ch - 10) {
              tooltipY = skillY + container.y - tooltipH - 5;
            }

            tooltip.setPosition(tooltipX, tooltipY).setScrollFactor(0);
            this._skillTooltip = tooltip;
            console.log('[Skills] Tooltip created for:', skill.name, 'at', tooltipX, tooltipY);
          });

          hitArea.on('pointerout', () => {
            if (this._skillTooltip) {
              this._skillTooltip.destroy(true);
              this._skillTooltip = null;
            }
          });

          hitArea.on('pointerdown', () => {
            if (hasSkill) {
              console.log('[Skills] Skill already owned:', skill.id);
              return;
            }

            if (!canPurchase.canPurchase) {
              console.log('[Skills] Cannot purchase:', canPurchase.reason);
              return;
            }

            console.log('[Skills] Attempting to purchase:', skill.id);
            const result = window.purchaseSkill(skill.id);
            if (result.success) {
              console.log('[Skills] Purchase successful, refreshing UI');
              closeSkillUI();
              this.time.delayedCall(50, () => {
                this._showSkillTreeUI();
              });
            } else {
              console.warn('[Skills] Purchase failed:', result.reason);
            }
          });
        });

        currentSkillY += tierSpacing;
      }

      treeX += treeWidth + treePadding;
    });

    const closeBtn = this.add.text(0, panelH / 2 - 30, '[ Schließen ]', {
      fontFamily: 'monospace',
      fontSize: 18,
      color: '#ffffff',
      backgroundColor: '#3a4a7c',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    container.add(closeBtn);

    const closeSkillUI = () => {
      if (this._skillTooltip) {
        this._skillTooltip.destroy(true);
        this._skillTooltip = null;
      }
      skillHitAreas.forEach(ha => ha.destroy());
      this._dialogOpen = false;
      overlay.destroy();
      container.destroy(true);
      this._dialogContainer = null;
    };

    closeBtn.on('pointerdown', () => {
      closeSkillUI();
    });
    this.input.keyboard.once('keydown-ESC', closeSkillUI);
  }

  _enterTarget(meta) {
    if (meta.onEnter === 'enterRathausDungeons') {
      this._openWaveSelectDialog((selectedWave, selectedDifficulty) => {
        window.SELECTED_WAVE_OVERRIDE = selectedWave;
        window.DUNGEON_DEPTH = selectedWave;
        window.NEXT_DUNGEON_DEPTH = selectedWave + 1;
        const difficulty = (typeof selectedDifficulty === 'number' && Number.isFinite(selectedDifficulty) && selectedDifficulty > 0)
          ? selectedDifficulty
          : (typeof window.getDifficultyMultiplier === 'function' ? window.getDifficultyMultiplier() : 1);
        window.DIFFICULTY_MULTIPLIER = difficulty;
        window.__LAST_SELECTED_DIFFICULTY__ = difficulty;
        try {
          localStorage.setItem('demonfall_lastDifficulty', JSON.stringify(difficulty));
        } catch (err) {
          console.warn('[HubScene] Unable to persist last difficulty', err);
        }

        if (typeof saveGame === 'function') {
          try {
        saveGame(this);
          } catch (err) {
            console.warn('[HubScene] saveGame before dungeon failed', err);
          }
        }

        if (window.__LAST_SAVE_SNAPSHOT__) {
          try {
            window.pendingLoadedSave = JSON.parse(JSON.stringify(window.__LAST_SAVE_SNAPSHOT__));
          } catch (err) {
            console.warn('[HubScene] snapshot clone failed', err);
            window.pendingLoadedSave = window.__LAST_SAVE_SNAPSHOT__;
          }
        }

        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('GameScene');
        });
      });
      return;
    }

    if (meta.type === 'building' && meta.buildingId === 'archivschmiede' && typeof meta.onEnter === 'function') {
      meta.onEnter(this);
      return;
    }

    this.cameras.main.fadeOut(250, 0, 0, 0, (_, p) => {
      if (p < 1) return;
      if (typeof meta.onEnter === 'function') {
        meta.onEnter(this);
      }
    });
  }

  _openWaveSelectDialog(onConfirm) {
    if (this._dialogOpen) return;

    this._dialogOpen = true;
    this._activeInteractable = null;
    this.prompt.setVisible(false);

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const overlay = this.add.rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.45)
      .setDepth(1595)
      .setScrollFactor(0);

    const container = this.add.container(cx, cy).setDepth(1600).setScrollFactor(0);

    const panelWidth = 440;
    const panelHeight = 280;
    const pad = 22;
    const g = this.add.graphics();
    g.fillStyle(0x101018, 0.95).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    g.lineStyle(2, 0x4a4a6a, 0.9).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    container.add(g);

    const savedInfo = (() => {
      if (window.__LAST_SAVE_SNAPSHOT__) return window.__LAST_SAVE_SNAPSHOT__;
      try {
        const raw = localStorage.getItem('demonfall_save_v1');
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    })();

    const savedDepth = typeof savedInfo?.dungeonDepth === 'number' ? savedInfo.dungeonDepth : null;
    const savedDifficulty = typeof savedInfo?.difficultyMultiplier === 'number' ? savedInfo.difficultyMultiplier : null;
    const storedDifficulty = (() => {
      try {
        const raw = localStorage.getItem('demonfall_lastDifficulty');
        if (!raw) return null;
        const val = Number(JSON.parse(raw));
        return Number.isFinite(val) && val > 0 ? val : null;
      } catch (err) {
        return null;
      }
    })();
    const runtimeDepth = Math.max(1, Math.floor(window.DUNGEON_DEPTH || window.currentWave || 1));
    const defaultDepth = savedDepth ? Math.max(1, Math.round(savedDepth)) : runtimeDepth;
    let selected = Phaser.Math.Clamp(defaultDepth, 1, 99);
    const minWave = 1;
    const maxWave = 99;
    const difficultyRuntime = (typeof window.getDifficultyMultiplier === 'function')
      ? window.getDifficultyMultiplier()
      : (typeof window.DIFFICULTY_MULTIPLIER === 'number' ? window.DIFFICULTY_MULTIPLIER : 1);
    const diffMin = 0.25;
    const diffMax = 5;
    const diffStep = 0.25;
    const rememberedDifficulty = (typeof window.__LAST_SELECTED_DIFFICULTY__ === 'number' && Number.isFinite(window.__LAST_SELECTED_DIFFICULTY__) && window.__LAST_SELECTED_DIFFICULTY__ > 0)
      ? window.__LAST_SELECTED_DIFFICULTY__
      : null;
    const initialDifficulty = rememberedDifficulty
      ? rememberedDifficulty
      : (storedDifficulty ?? (savedDifficulty && Number.isFinite(savedDifficulty) ? savedDifficulty : difficultyRuntime));
    let difficulty = Phaser.Math.Clamp(Number(initialDifficulty) || 1, diffMin, diffMax);

    const persistDifficultySelection = (value) => {
      const val = Phaser.Math.Clamp(Number(value) || 1, diffMin, diffMax);
      window.__LAST_SELECTED_DIFFICULTY__ = val;
      window.DIFFICULTY_MULTIPLIER = val;
      try {
        localStorage.setItem('demonfall_lastDifficulty', JSON.stringify(val));
      } catch (err) {
        console.warn('[HubScene] Unable to persist difficulty selection', err);
      }
    };
    persistDifficultySelection(difficulty);

    const title = this.add.text(0, -panelHeight / 2 + pad, 'Rathauskeller betreten', {
      fontFamily: 'serif',
      fontSize: 24,
      color: '#f2e9d8'
    }).setOrigin(0.5, 0);
    container.add(title);

    const subtitle = this.add.text(0, title.y + title.height + 12, 'Wähle das Start-Level (Schwierigkeit)', {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#c8c2b5'
    }).setOrigin(0.5, 0);
    container.add(subtitle);

    const waveLabel = this.add.text(0, subtitle.y + subtitle.height + 18, 'Dungeon Level', {
      fontFamily: 'monospace',
      fontSize: 18,
      color: '#cfd0ff'
    }).setOrigin(0.5, 0.5);
    container.add(waveLabel);

    const waveText = this.add.text(0, waveLabel.y + 52, '', {
      fontFamily: 'serif',
      fontSize: 48,
      color: '#ffe28a'
    }).setOrigin(0.5, 0.5);
    container.add(waveText);

    const difficultyLabel = this.add.text(0, waveText.y + 68, 'Schwierigkeits-Multiplikator', {
      fontFamily: 'monospace',
      fontSize: 18,
      color: '#cfd0ff'
    }).setOrigin(0.5, 0.5);
    container.add(difficultyLabel);

    const difficultyText = this.add.text(0, difficultyLabel.y + 40, '', {
      fontFamily: 'serif',
      fontSize: 42,
      color: '#ffaaff'
    }).setOrigin(0.5, 0.5);
    container.add(difficultyText);

    const formatDifficulty = (value) => {
      const rounded = Math.round(value * 100) / 100;
      return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}x`;
    };

    const updateDisplay = () => {
      waveText.setText(`${selected}`);
      difficultyText.setText(formatDifficulty(difficulty));
    };
    updateDisplay();

    const makeButton = (label, x, y, handler, style = {}) => {
      const txt = this.add.text(x, y, label, Object.assign({
        fontFamily: 'monospace',
        fontSize: 20,
        backgroundColor: '#2a2a3d',
        color: '#ffffff',
        padding: { x: 12, y: 6 }
      }, style)).setOrigin(0.5).setInteractive({ useHandCursor: true });
      txt.on('pointerdown', () => handler());
      txt.on('pointerover', () => txt.setStyle({ backgroundColor: '#3a3a5a' }));
      txt.on('pointerout', () => txt.setStyle({ backgroundColor: style.backgroundColor || '#2a2a3d' }));
      container.add(txt);
      return txt;
    };

    const adjustWave = (delta) => {
      selected += delta;
      if (selected < minWave) selected = minWave;
      if (selected > maxWave) selected = maxWave;
      updateDisplay();
    };

    makeButton('−', -120, waveText.y, () => adjustWave(-1), { fontSize: 28, padding: { x: 18, y: 8 } });
    makeButton('+', 120, waveText.y, () => adjustWave(1), { fontSize: 28, padding: { x: 18, y: 8 } });

    const adjustDifficulty = (steps) => {
      const raw = difficulty + steps * diffStep;
      const clamped = Phaser.Math.Clamp(raw, diffMin, diffMax);
      const stepped = Math.round(clamped / diffStep) * diffStep;
      difficulty = Number(stepped.toFixed(2));
      persistDifficultySelection(difficulty);
      updateDisplay();
    };

    makeButton('−', -120, difficultyText.y, () => adjustDifficulty(-1), { fontSize: 28, padding: { x: 18, y: 8 } });
    makeButton('+', 120, difficultyText.y, () => adjustDifficulty(1), { fontSize: 28, padding: { x: 18, y: 8 } });

    const info = this.add.text(0, difficultyText.y + 48, '←/→ Level ändern · ↑/↓ Multiplikator (wirkt auf Gegner & Loot)\nEnter/Space starten · ESC zurück', {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#9aa2c0'
    }).setOrigin(0.5, 0);
    info.setWordWrapWidth(panelWidth - pad * 2);
    container.add(info);

    const confirm = () => {
      cleanup();
      if (typeof onConfirm === 'function') onConfirm(selected, difficulty);
      persistDifficultySelection(difficulty);
    };

    const cancel = () => {
      cleanup();
    };

    makeButton('Starten', -80, info.y + info.height + 32, confirm, { backgroundColor: '#3d6a3d' });
    makeButton('Abbrechen', 120, info.y + info.height + 32, cancel, { backgroundColor: '#6a3d3d' });

    const onKeyDown = (event) => {
      switch (event.code) {
        case 'ArrowLeft':
        case 'Minus':
        case 'NumpadSubtract':
          event?.preventDefault?.();
          adjustWave(-1);
          break;
        case 'ArrowRight':
        case 'Equal':
        case 'NumpadAdd':
          event?.preventDefault?.();
          adjustWave(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
          event?.preventDefault?.();
          adjustDifficulty(1);
          break;
        case 'ArrowDown':
        case 'KeyS':
          event?.preventDefault?.();
          adjustDifficulty(-1);
          break;
        case 'Enter':
        case 'NumpadEnter':
        case 'Space':
          event?.preventDefault?.();
          confirm();
          break;
        case 'Escape':
          event?.preventDefault?.();
          cancel();
          break;
        default:
          break;
      }
    };

    this.input.keyboard.on('keydown', onKeyDown);

    const cleanup = () => {
      if (!container.active) return;
      container.destroy(true);
      overlay?.destroy();
      this._dialogOpen = false;
      this._dialogContainer = null;
      this.input.keyboard.off('keydown', onKeyDown);
    };

    this._dialogContainer = container;
  }

  _openWorkshopDialog() {
    if (this._dialogOpen) return;

    const materialKey = 'MAT';
    const materialName = 'Eisenbrocken';
    const upgradeableTypes = ['weapon', 'head', 'body', 'boots'];

    const getItemMaterialKey = (item) => {
      if (!item) return null;
      if (typeof item.materialKey === 'string' && item.materialKey.length) return item.materialKey;
      if (typeof item.baseMaterialKey === 'string' && item.baseMaterialKey.length) return item.baseMaterialKey;
      return item.key ?? null;
    };

    const isMatchingMaterial = (item, key) => {
      if (!item || item.type !== 'material') return false;
      const effectiveKey = getItemMaterialKey(item);
      return key ? effectiveKey === key : true;
    };

    if (typeof window.DUNGEON_DEPTH !== 'number' || !Number.isFinite(window.DUNGEON_DEPTH)) {
      window.DUNGEON_DEPTH = Math.max(1, Number(window.currentWave) || 1);
    }
    if (typeof window.currentWave !== 'number') {
      window.currentWave = Math.max(1, Number(window.DUNGEON_DEPTH) || 1);
    }

    if (!Array.isArray(window.inventory)) {
      window.inventory = new Array(typeof INV_SLOTS === 'number' ? INV_SLOTS : 20).fill(null);
    }
    if (typeof inventory !== 'undefined' && inventory !== window.inventory) {
      inventory = window.inventory;
    }

    const inventoryList = window.inventory;
    if (typeof siphonMaterialsFromInventory === 'function') {
      siphonMaterialsFromInventory();
    }

    if (!inventoryList.some(Boolean)) {
      const snapshotInv = window.__LAST_SAVE_SNAPSHOT__?.inventory;
      if (Array.isArray(snapshotInv) && snapshotInv.some(Boolean)) {
        for (let i = 0; i < Math.min(inventoryList.length, snapshotInv.length); i++) {
          inventoryList[i] = snapshotInv[i] || null;
        }
        if (typeof setMaterialCounts === 'function') {
          setMaterialCounts(window.__LAST_SAVE_SNAPSHOT__?.materials || {});
        }
      } else if (typeof loadGame === 'function') {
        try {
          const loaded = loadGame();
          if (Array.isArray(loaded?.inventory) && loaded.inventory.some(Boolean)) {
            for (let i = 0; i < Math.min(inventoryList.length, loaded.inventory.length); i++) {
              inventoryList[i] = loaded.inventory[i] || null;
            }
          }
          if (typeof setMaterialCounts === 'function') {
            setMaterialCounts(loaded?.materials || {});
          }
        } catch (err) {
          console.warn('[WorkshopEnter] loadGame inventory fallback failed', err);
        }
      }
    }

    const setInventorySlot = (idx, value) => {
      if (idx >= 0 && idx < inventoryList.length) {
        inventoryList[idx] = value;
      }
    };

    const countMaterial = (key) => {
      const fromStore = typeof getMaterialCount === 'function'
        ? getMaterialCount(key)
        : 0;
      const fromInventory = inventoryList.reduce(
        (sum, item) => sum + (isMatchingMaterial(item, key) ? 1 : 0),
        0
      );
      return fromStore + fromInventory;
    };

    const resolveEquipmentSource = () => {
      const direct = (typeof equipment === 'object' && equipment) ? equipment : null;
      if (direct && Object.values(direct).some(Boolean)) {
        return direct;
      }

      const fromSnapshot = window.__LAST_SAVE_SNAPSHOT__?.equipment;
      if (fromSnapshot && typeof fromSnapshot === 'object') {
        return fromSnapshot;
      }

      if (typeof loadGame === 'function') {
        try {
          const loaded = loadGame();
          if (loaded?.equipment && typeof loaded.equipment === 'object') {
            return loaded.equipment;
          }
        } catch (err) {
          console.warn('[WorkshopEnter] loadGame fallback failed', err);
        }
      }

      return direct || {};
    };

    const equipmentSource = resolveEquipmentSource();

    const totalUpgradeableInventory = inventoryList.filter(
      (it) => it && upgradeableTypes.includes(it.type)
    ).length;
    const totalUpgradeableEquipment = Object.values(equipmentSource || {}).filter(
      (item) => item && upgradeableTypes.includes(item.type)
    ).length;

    const rarities = (window.ITEM_RARITIES && window.ITEM_RARITIES.length)
      ? window.ITEM_RARITIES
      : [
          { key: 'common', label: 'Gewöhnlich', value: 1 },
          { key: 'rare', label: 'Selten', value: 2 },
          { key: 'epic', label: 'Episch', value: 3 },
          { key: 'legendary', label: 'Legendär', value: 4 }
        ];

    const raritiesFinal = rarities;

    const spendMaterial = (key, amount) => {
      if (amount <= 0) return true;
      const storeAvailable = typeof getMaterialCount === 'function'
        ? getMaterialCount(key)
        : 0;
      const inventoryAvailable = inventoryList.reduce(
        (sum, item) => sum + (isMatchingMaterial(item, key) ? 1 : 0),
        0
      );
      if (storeAvailable + inventoryAvailable < amount) return false;

      let remaining = amount;
      if (typeof spendMaterialFromStorage === 'function') {
        const spendFromStore = Math.min(remaining, storeAvailable);
        if (spendFromStore > 0) {
          spendMaterialFromStorage(key, spendFromStore);
          remaining -= spendFromStore;
        }
      }
      for (let i = 0; i < inventoryList.length && remaining > 0; i++) {
        const item = inventoryList[i];
        if (!isMatchingMaterial(item, key)) continue;
        setInventorySlot(i, null);
        remaining -= 1;
      }
      return remaining === 0;
    };

    const getRarityIndex = (key) => raritiesFinal.findIndex(r => r.key === key);
    const getRarityByKey = (key) => raritiesFinal[getRarityIndex(key)] || raritiesFinal[0];
    const getNextRarity = (key) => {
      const idx = getRarityIndex(key);
      if (idx < 0 || idx >= raritiesFinal.length - 1) return null;
      return raritiesFinal[idx + 1];
    };

    const computeCostForUpgrade = (currentKey) => {
      const next = getNextRarity(currentKey);
      if (!next) return null;
      const current = getRarityByKey(currentKey);
      if (!current) return null;
      const exponent = Math.max(0, current.value - 1);
      const amount = Math.max(1, 2 ** exponent);
      return { key: materialKey, name: materialName, amount };
    };

    const addBoosts = window.addBoostsToItem || (() => {});
    const computeItemLevel = window.computeItemLevelFromStats || (() => 1);

    const items = [];
    for (let i = 0; i < inventoryList.length; i++) {
      const item = inventoryList[i];
      if (!item) continue;
      if (!upgradeableTypes.includes(item.type)) continue;
      items.push({ label: `Inventar ${i + 1}: ${item.name || item.key}`, source: 'inventory', index: i, item });
    }
    Object.entries(equipmentSource || {}).forEach(([slot, item]) => {
      if (!item || !upgradeableTypes.includes(item.type)) return;
      items.push({ label: `Ausrüstung (${slot.toUpperCase()})`, source: 'equipment', slot, item });
    });

    if (!items.length) {
      this._showNpcDialogue({
        name: 'Archivschmiede',
        lines: [
          'Du hast derzeit keine passenden Gegenstände für eine Aufwertung.',
          'Besorge dir Waffen oder Rüstungen, dann kann ich dir weiterhelfen.'
        ]
      });
      return;
    }

    this._dialogOpen = true;

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const overlay = this.add.rectangle(cx, cy, cam.width, cam.height, 0x000000, 0.45)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    const container = this.add.container(cx, cy).setDepth(2001).setScrollFactor(0);
    this._dialogContainer = container;

    const panelWidth = 700;
    const panelHeight = 420;
    const pad = 24;
    const gfx = this.add.graphics();
    gfx.fillStyle(0x11141d, 0.96).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18);
    gfx.lineStyle(2, 0x4a6a9c, 0.85).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18);
    container.add(gfx);

    const title = this.add.text(0, -panelHeight / 2 + pad, 'Archivschmiede', {
      fontFamily: 'serif',
      fontSize: 28,
      color: '#f2f6ff'
    }).setOrigin(0.5, 0);
    container.add(title);

    const listStartX = -panelWidth / 2 + pad;
    const listStartY = title.y + title.height + 16;
    const listColumnWidth = 260;

    const listEntries = [];
    let selectedEntry = items[0];
    let selectedIndex = 0;

    const detailX = listStartX + listColumnWidth + 28;
    const detailY = listStartY;

    const dividerHeight = panelHeight - pad * 2 - 20;
    const divider = this.add.rectangle(detailX - 22, detailY - 8, 2, dividerHeight, 0x2a3b49, 0.6)
      .setOrigin(0.5, 0);
    container.add(divider);

    const detailTexts = {
      name: this.add.text(detailX, detailY, '', { fontFamily: 'monospace', fontSize: 18, color: '#ffffff' }).setOrigin(0, 0),
      level: this.add.text(detailX, detailY + 26, '', { fontFamily: 'monospace', fontSize: 16, color: '#c0e0ff' }).setOrigin(0, 0),
      rarity: this.add.text(detailX, detailY + 52, '', { fontFamily: 'monospace', fontSize: 16, color: '#ffea6a' }).setOrigin(0, 0),
      target: this.add.text(detailX, detailY + 80, '', { fontFamily: 'monospace', fontSize: 16, color: '#9ac7ff' }).setOrigin(0, 0),
      cost: this.add.text(detailX, detailY + 112, '', { fontFamily: 'monospace', fontSize: 16, color: '#ffffff' }).setOrigin(0, 0),
      boosts: this.add.text(detailX, detailY + 140, '', { fontFamily: 'monospace', fontSize: 16, color: '#ffffff' }).setOrigin(0, 0),
      stats: this.add.text(detailX, detailY + 174, '', { fontFamily: 'monospace', fontSize: 15, color: '#e2e2e2', lineSpacing: 4 }).setOrigin(0, 0)
        .setWordWrapWidth(240),
      status: this.add.text(detailX, detailY + 300, '', {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#ffaaaa',
        lineSpacing: 2
      }).setOrigin(0, 0).setWordWrapWidth(240)
    };
    Object.values(detailTexts).forEach(txt => container.add(txt));

    const scrapBtn = this.add.text(detailX, detailY + 260, 'Verwerten', {
      fontFamily: 'monospace',
      fontSize: 18,
      backgroundColor: '#5c2e2e',
      color: '#ffffff',
      padding: { x: 10, y: 6 }
    }).setOrigin(0, 0);
    scrapBtn.setVisible(false);
    scrapBtn.setAlpha(0.4);
    scrapBtn.disableInteractive();
    container.add(scrapBtn);

    const upgradeBtn = this.add.text(detailX, detailY + 260, 'Seltenheit steigern', {
      fontFamily: 'monospace',
      fontSize: 20,
      backgroundColor: '#28603b',
      color: '#ffffff',
      padding: { x: 12, y: 6 }
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    container.add(upgradeBtn);

    const closeBtn = this.add.text(panelWidth / 2 - pad, -panelHeight / 2 + pad, '✕', {
      fontFamily: 'monospace',
      fontSize: 20,
      color: '#ffffff',
      backgroundColor: '#333',
      padding: { x: 8, y: 4 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    container.add(closeBtn);

    const describeStats = (item) => {
      if (!item) return '';
      const lines = [];
      const pushStat = (label, value, decimals = 0, suffix = '', isPercent = false) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        if (value === 0) return;
        let formatted;
        if (isPercent) {
          formatted = (value * 100).toFixed(decimals);
        } else {
          formatted = value.toFixed(decimals);
        }
        // trim trailing zeros for decimals
        if (formatted.indexOf('.') >= 0) {
          formatted = formatted.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/,'$1');
        }
        const sign = value > 0 ? '+' : '';
        lines.push(`${label}: ${sign}${formatted}${suffix}`);
      };

      pushStat('HP', item.hp, 0);
      pushStat('Damage', item.damage, 0);
      pushStat('Speed', item.speed, 2);
      pushStat('Range', item.range, 0);
      pushStat('Movement', item.move, 2);
      pushStat('Armor', item.armor, 1, '%', true);
      pushStat('Crit', item.crit, 1, '%', true);

      const abilityLabels = (typeof ABILITY_LABELS !== 'undefined' ? ABILITY_LABELS : window?.ABILITY_LABELS) || {};
      if (Array.isArray(item.attackEffects) && item.attackEffects.length) {
        if (lines.length) lines.push('');
        lines.push('Fertigkeiten:');
        item.attackEffects.forEach((effect) => {
          if (!effect) return;
          const label = abilityLabels[effect.ability] || effect.ability || 'Attacke';
          const pct = Math.round(Math.max(0, (effect.value || 0) * 100));
          if (pct <= 0) return;
          if (effect.stat === 'cooldown') {
            lines.push(`  ${label}: -${pct}% Abklingzeit`);
          } else if (effect.stat === 'damage') {
            lines.push(`  ${label}: +${pct}% Schaden`);
          } else {
            lines.push(`  ${label}: +${pct}% ${effect.stat}`);
          }
        });
      }

      return lines.length ? lines.join('\n') : 'Keine Stat-Boni';
    };

    const updateDetails = () => {
      const entry = selectedEntry;
      if (!entry) return;
      const item = entry.item;
      const currentRarity = getRarityByKey(item.rarity);
      const nextRarity = getNextRarity(item.rarity);
      const cost = computeCostForUpgrade(item.rarity);
      const boostCount = nextRarity ? Math.max(0, nextRarity.value - (item.rarityValue || currentRarity.value)) : 0;
      const materialOwned = countMaterial(materialKey);
      const depth = window.DUNGEON_DEPTH || window.currentWave || 1;
      const levelValue = (typeof item.itemLevel === 'number' && Number.isFinite(item.itemLevel))
        ? item.itemLevel
        : computeItemLevel(item, depth);
      if (typeof item.itemLevel !== 'number' || !Number.isFinite(item.itemLevel)) {
        item.itemLevel = levelValue;
      }

      detailTexts.status.setText('');
      detailTexts.name.setText(`${item.name || item.key}`);
      detailTexts.level.setText(`Item-Level: ${levelValue}`);
      detailTexts.rarity.setText(`Seltenheit: ${currentRarity.label}`);
      if (nextRarity) {
        detailTexts.target.setText(`Nach Upgrade: ${nextRarity.label}`);
        detailTexts.boosts.setText(`Zusätzliche Boosts: ${boostCount}`);
      } else {
        detailTexts.target.setText('Nach Upgrade: — (max)');
        detailTexts.boosts.setText('');
      }

      detailTexts.stats.setText(describeStats(item));

      const statsHeight = detailTexts.stats.height || 0;
      const nextBlockY = detailTexts.stats.y + statsHeight + 14;
      const canScrap = entry.source === 'inventory';

      scrapBtn.setY(nextBlockY);
      upgradeBtn.setY(nextBlockY);

      if (canScrap) {
        scrapBtn.setVisible(true);
        scrapBtn.setAlpha(1);
        scrapBtn.setInteractive({ useHandCursor: true });
        scrapBtn.setX(detailX);
        upgradeBtn.setX(detailX + scrapBtn.width + 16);
      } else {
        scrapBtn.setVisible(false);
        scrapBtn.setAlpha(0.3);
        scrapBtn.disableInteractive();
        upgradeBtn.setX(detailX);
      }

      detailTexts.status.setY(upgradeBtn.y + upgradeBtn.height + 12);

      if (cost) {
        const color = materialOwned >= cost.amount ? '#b0ffb0' : '#ffaaaa';
        detailTexts.cost.setText(`Kosten: ${materialName} x${cost.amount} (Besitz: ${materialOwned})`);
        detailTexts.cost.setColor(color);
      } else {
        detailTexts.cost.setText('Kosten: —');
        detailTexts.cost.setColor('#ffffff');
      }

      const canUpgrade = !!nextRarity && cost && materialOwned >= cost.amount;
      upgradeBtn.setAlpha(canUpgrade ? 1 : 0.4);
      upgradeBtn.disableInteractive();
      if (canUpgrade) upgradeBtn.setInteractive({ useHandCursor: true });
    };

    const selectEntry = (entry) => {
      if (!entry) return;
      selectedEntry = entry;
      selectedIndex = Math.max(0, items.indexOf(entry));
      listEntries.forEach(obj => obj.text.setColor(obj.entry === entry ? '#ffff88' : '#cccccc'));
      updateDetails();
    };

    const selectEntryAt = (index) => {
      if (!items.length) return;
      const clamped = Phaser.Math.Wrap(index, 0, items.length);
      selectEntry(items[clamped]);
    };

    items.forEach((entry, idx) => {
      const text = this.add.text(listStartX, listStartY + idx * 26, entry.label, {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#cccccc'
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      text.setWordWrapWidth(listColumnWidth - 16);
      text.on('pointerdown', () => selectEntry(entry));
      container.add(text);
      listEntries.push({ text, entry });
    });

    selectEntry(selectedEntry);

    const createMaterialItem = () => ({
      type: 'material',
      key: 'MAT',
      materialKey: 'MAT',
      name: 'Eisenbrocken',
      iconKey: 'itMat',
      rarity: 'common',
      rarityLabel: 'Gewöhnlich',
      rarityValue: 1,
      itemLevel: 1,
      hp: 0,
      damage: 0,
      speed: 0,
      range: 0,
      armor: 0,
      crit: 0,
      move: 0
    });

    const addMaterialsToInventory = (amount, preferredIndex = null) => {
      let remaining = amount;
      const attemptPlace = (idx) => {
        if (idx < 0 || idx >= inventoryList.length) return false;
        if (inventoryList[idx]) return false;
        setInventorySlot(idx, createMaterialItem());
        remaining -= 1;
        return true;
      };

      if (preferredIndex !== null) {
        attemptPlace(preferredIndex);
      }

      for (let pass = 0; pass < inventoryList.length && remaining > 0; pass++) {
        attemptPlace(pass);
      }

      if (remaining > 0) {
        console.warn('[WorkshopScrap] insufficient_space_during_allocation', {
          requested: amount,
          allocated: amount - remaining,
          inventory: inventoryList.map((slot) => (slot ? (slot.name || slot.key || 'item') : null))
        });
      }
      return amount - remaining;
    };

    const workshopKeyHandlers = [];
    const bindWorkshopKey = (eventName, handler) => {
      const wrapped = (event) => handler(event);
      this.input.keyboard.on(eventName, wrapped);
      workshopKeyHandlers.push({ eventName, handler: wrapped });
    };

    const moveSelection = (dir) => {
      if (!items.length) return;
      selectEntryAt(selectedIndex + dir);
    };

    bindWorkshopKey('keydown-UP', (event) => {
      event?.preventDefault?.();
      moveSelection(-1);
    });
    bindWorkshopKey('keydown-DOWN', (event) => {
      event?.preventDefault?.();
      moveSelection(1);
    });
    bindWorkshopKey('keydown-W', (event) => {
      event?.preventDefault?.();
      moveSelection(-1);
    });
    bindWorkshopKey('keydown-S', (event) => {
      event?.preventDefault?.();
      moveSelection(1);
    });
    bindWorkshopKey('keydown-TAB', (event) => {
      event?.preventDefault?.();
      moveSelection(event?.shiftKey ? -1 : 1);
    });

    const scrapSelectedEntry = () => {
      const entry = selectedEntry;
      if (!entry || entry.source !== 'inventory') return;
      const idx = entry.index;
      if (typeof idx !== 'number' || idx < 0 || idx >= inventoryList.length) return;
      const item = entry.item;
      if (!item) return;

      console.log('[WorkshopScrap] attempt', {
        index: idx,
        item: item ? { name: item.name, key: item.key, rarity: item.rarity, rarityValue: item.rarityValue } : null,
        inventoryBefore: inventoryList.map((slot) => (slot ? (slot.name || slot.key || 'item') : null))
      });

      const payout = Math.max(1, item.rarityValue || getRarityByKey(item.rarity)?.value || 1);
      const freeSlots = inventoryList.reduce((sum, slot, i) => sum + (!slot || i === idx ? 1 : 0), 0);
      if (freeSlots < payout) {
        detailTexts.status.setColor('#ffaaaa');
        detailTexts.status.setText('Verwertung fehlgeschlagen (kein Platz)');
        console.warn('[WorkshopScrap] failed_insufficient_capacity', {
          slot: idx,
          payout,
          freeSlots,
          inventory: inventoryList.map((slot) => (slot ? (slot.name || slot.key || 'item') : null))
        });
        return;
      }

      const originalItem = item;
      setInventorySlot(idx, null);

      const gained = addMaterialsToInventory(payout, idx);
      if (gained <= 0) {
        setInventorySlot(idx, originalItem);
        detailTexts.status.setColor('#ffaaaa');
        detailTexts.status.setText('Verwertung fehlgeschlagen (kein Platz)');
        console.warn('[WorkshopScrap] failed_no_space', {
          slot: idx,
          payout,
          inventorySnapshot: inventoryList.map((slot) => (slot ? (slot.name || slot.key || 'item') : null))
        });
        return;
      }

      detailTexts.status.setColor('#aaffaa');
      detailTexts.status.setText(`Verwertet: +${gained} ${materialName}`);

      if (typeof refreshInventoryUI === 'function') {
        try {
          refreshInventoryUI();
        } catch (err) {
          console.warn('[Workshop] refreshInventoryUI nach Verwertung fehlgeschlagen', err);
        }
      }

      if (typeof saveGame === 'function') {
        try {
          saveGame(this);
        } catch (err) {
          console.warn('[Workshop] saveGame nach Verwertung fehlgeschlagen', err);
        }
      }

      console.log('[WorkshopScrap] success', {
        removedIndex: idx,
        payout: gained,
        inventory: inventoryList.map((slot) => (slot ? (slot.name || slot.key || 'item') : null))
      });

      close();
      this.time.delayedCall(80, () => {
        if (!this._dialogOpen) this._openWorkshopDialog();
      });
    };

    const attemptUpgrade = () => {
      const entry = selectedEntry;
      if (!entry) return;
      const item = entry.item;
      const nextRarity = getNextRarity(item.rarity);
      if (!nextRarity) return;
      const cost = computeCostForUpgrade(item.rarity);
      if (!cost) return;
      const owned = countMaterial(cost.key);
      if (owned < cost.amount) {
        detailTexts.status.setText('Nicht genug Materialien.');
        return;
      }
      if (!spendMaterial(cost.key, cost.amount)) {
        detailTexts.status.setText('Materialabzug fehlgeschlagen.');
        return;
      }

      const oldValue = item.rarityValue || getRarityByKey(item.rarity).value;
      item.rarity = nextRarity.key;
      item.rarityLabel = nextRarity.label;
      item.rarityValue = nextRarity.value;
      const extraBoosts = Math.max(0, nextRarity.value - oldValue);
      const depth = window.DUNGEON_DEPTH || window.currentWave || 1;
      addBoosts(item, extraBoosts, depth);
      item.itemLevel = computeItemLevel(item, depth);
      if (typeof normalizeItemStatsForRarity === 'function') {
        normalizeItemStatsForRarity(item, item.rarityValue || nextRarity.value);
      }

      if (typeof refreshInventoryUI === 'function') {
        try {
          refreshInventoryUI();
        } catch (err) {
          console.warn('[Workshop] refreshInventoryUI failed', err);
        }
      }

      if (typeof saveGame === 'function') {
        try {
          saveGame(this);
        } catch (err) {
          console.warn('[Workshop] saveGame failed', err);
        }
      }

      detailTexts.status.setColor('#aaffaa');
      detailTexts.status.setText(`Upgrade erfolgreich: ${nextRarity.label}`);

      if (this.sound?.get?.('forge_upgrade') || this.sound?.keys?.includes?.('forge_upgrade')) {
        this.sound.play('forge_upgrade');
      }

      updateDetails();
    };

    upgradeBtn.on('pointerdown', attemptUpgrade);
    bindWorkshopKey('keydown-ENTER', (event) => {
      event?.preventDefault?.();
      attemptUpgrade();
    });
    bindWorkshopKey('keydown-SPACE', (event) => {
      event?.preventDefault?.();
      attemptUpgrade();
    });
    scrapBtn.on('pointerdown', scrapSelectedEntry);
    bindWorkshopKey('keydown-R', (event) => {
      if (!scrapBtn.visible) return;
      event?.preventDefault?.();
      scrapSelectedEntry();
    });

    const close = () => {
      overlay.destroy();
      container.destroy(true);
      this._dialogOpen = false;
      if (this._dialogContainer === container) {
        this._dialogContainer = null;
      }
      workshopKeyHandlers.forEach(({ eventName, handler }) => {
        this.input.keyboard.off(eventName, handler);
      });
    };

    closeBtn.on('pointerdown', close);
    overlay.on('pointerdown', close);
    this.input.keyboard.once('keydown-ESC', close);
  }

  _applyHubPhase(phase) {
    // Phase 0: alles ruhig
    // Phase 1+: Plakate reissen, okkulte Risse, neue Haendler usw.
    if (phase >= 1) {
      this._spawnBannerTears();
    }
    if (phase >= 2) {
      this._spawnOkkulteRisse();
    }
  }

  _spawnBannerTears() {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x221111, 0.6);
    // dekorative Risse an der Rathausfront
    g.fillRect(960 - 360, 580, 720, 8);
  }

  _spawnOkkulteRisse() {
    const g = this.add.graphics().setDepth(11);
    g.lineStyle(2, 0xff3300, 1);
    g.strokeRect(960 - 100, 620, 200, 40);
    this.add.text(960, 640, 'Fluestern im Stein', { fontSize: 12, color: '#ff8844' }).setOrigin(0.5);
  }

  _ensureBuildingTexture(b) {
    const key = `bld_${b.id}_${b.w}x${b.h}`;
    if (this.textures.exists(key)) return key;

    // Archivschmiede uses detailed texture system
    if (b.id === 'archivschmiede' && b.useDetailedTexture) {
      makeArchivschmiedeTexture(this, key, { w: b.w, h: b.h });
      return key;
    }

    const g = this.make.graphics({ x: 0, y: 0, add: false });

    if (b.id === 'rathaus') {
      this._drawRathausFront(g, b);
      // RenderTexture notwendig, um Text einzubrennen
      const rt = this.make.renderTexture({ x: 0, y: 0, width: b.w, height: b.h, add: false });
      rt.draw(g, 0, 0);

      // Plaque-Position gem. _drawRathausFront erneut berechnen
      const padX = 14, over = 12, roofH = 48;
      const bodyX = padX;
      const bodyY = roofH + 6;
      const bodyW = b.w - padX * 2;
      const signW = Math.min(300, Math.round(bodyW * 0.72));
      const signH = 34;
      const signX = Math.round(bodyX + bodyW / 2 - signW / 2);
      const signY = bodyY + 10;

      if (b.title) {
        const label = this.add.text(
          Math.round(b.w / 2), Math.round(signY + signH / 2), b.title,
          { fontFamily: 'serif', fontSize: 40, resolution: 2, color: '#2a2016' }
        ).setOrigin(0.5).setScale(0.5);
        rt.draw(label);
        label.destroy();
      }

      rt.saveTexture(key);
      g.destroy();
      rt.destroy();
      return key;
    }

    // Druckerei: gleiches Verfahren wie Rathaus, damit Plakettentext eingebrannt wird
    if (b.id === 'druckerei') {
      this._drawDruckereiFront(g, b);
      const rt = this.make.renderTexture({ x: 0, y: 0, width: b.w, height: b.h, add: false });
      rt.draw(g, 0, 0);

      // Plaque-Position wie in _drawDruckereiFront rekonstruieren
      const padX = 12, roofH = 40;
      const bodyX = padX;
      const bodyY = roofH + 6;
      const bodyW = b.w - padX * 2;
      const signW = Math.min(220, Math.round(bodyW * 0.66));
      const signH = 32;
      const signX = Math.round(bodyX + bodyW / 2 - signW / 2);
      const signY = bodyY + 8;

      if (b.title) {
        const label = this.add.text(
          Math.round(b.w / 2), Math.round(signY + signH / 2), b.title,
          { fontFamily: 'serif', fontSize: 36, resolution: 2, color: '#2a2016' }
        ).setOrigin(0.5).setScale(0.5);
        rt.draw(label);
        label.destroy();
      }

      rt.saveTexture(key);
      g.destroy();
      rt.destroy();
      return key;
    }

    // andere Gebaeude: wie gehabt Graphics -> Texture
    this._drawGenericBuildingFront(g, b);
    g.generateTexture(key, b.w, b.h);
    g.destroy();
    return key;
  }

  _drawDruckereiFront(g, b) {
    // Stil wie Schmiede/Rathaus, aber etwas kompakter
    const padX = 12;
    const roofH = 40;
    const over  = 10;
    const padBottom = 20;

    const bodyX = padX;
    const bodyY = roofH + 6;           // genug Platz fuer das Dach
    const bodyW = b.w - padX * 2;
    const bodyH = b.h - bodyY - padBottom;

    // Korpus
    g.fillStyle(0x6a5a49, 1).fillRect(bodyX - 2, bodyY - 2, bodyW + 4, bodyH + 4);

    // Ziegel (wie bei Schmiede/Rathaus)
    const bw = 24, bh = 14, gap = 2;
    const stepX = bw + gap, stepY = bh + gap;
    g.fillStyle(0xb19b82, 1);
    const rows = Math.ceil(bodyH / stepY) + 1;
    const cols = Math.ceil(bodyW / stepX) + 2;
    for (let r = 0; r <= rows; r++) {
      const odd = (r & 1) ? bw / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const rx = bodyX + c * stepX - odd;
        const ry = bodyY + r * stepY;
        const sx = Math.max(rx, bodyX), sy = Math.max(ry, bodyY);
        const ex = Math.min(rx + bw, bodyX + bodyW), ey = Math.min(ry + bh, bodyY + bodyH);
        const cw = ex - sx, ch = ey - sy;
        if (cw > 0 && ch > 0) g.fillRect(Math.round(sx), Math.round(sy), Math.round(cw), Math.round(ch));
      }
    }

    // Innerer Rahmen
    g.fillStyle(0x1c1c1c, 1);
    g.fillRect(bodyX, bodyY, bodyW, 2);
    g.fillRect(bodyX, bodyY + bodyH - 2, bodyW, 2);
    g.fillRect(bodyX, bodyY, 2, bodyH);
    g.fillRect(bodyX + bodyW - 2, bodyY, 2, bodyH);

    // Giebeldach
    const apexX = Math.round(bodyX + bodyW / 2);
    const apexY = Math.round(bodyY - roofH);
    const lx = Math.round(bodyX - over);
    const rx = Math.round(bodyX + bodyW + over);
    const by = Math.round(bodyY);
    g.fillStyle(0x3b2b1b, 1);
    g.fillTriangle(apexX, apexY, lx, by, rx, by);
    g.fillStyle(0x2d1e12, 0.35);
    g.fillTriangle(apexX, Math.round(by - roofH * 0.55), lx + 3, by - 3, rx - 3, by - 3);
    g.fillStyle(0x2a1d14, 1).fillRect(lx + 1, by - 2, (rx - lx) - 2, 2);
    g.lineStyle(2, 0x24170e, 1);
    g.strokeTriangle(apexX, apexY, lx, by, rx, by);

    // Schild/Plakette
    const signW = Math.min(220, Math.round(bodyW * 0.66));
    const signH = 32;
    const signX = Math.round(bodyX + bodyW / 2 - signW / 2);
    const signY = bodyY + 8;
    g.fillStyle(0x4a3b2b, 1).fillRoundedRect(signX - 4, signY - 4, signW + 8, signH + 8, 6);
    g.fillStyle(0xd8c7aa, 1).fillRoundedRect(signX, signY, signW, signH, 4);

    // Kleine Druck-Ornamente (Papierkreise an Ketten)
    g.fillStyle(0xd8c7aa, 1);
    g.fillCircle(signX - 14, signY + signH / 2, 5);
    g.fillCircle(signX + signW + 14, signY + signH / 2, 5);
    g.lineStyle(2, 0x2a1d14, 1);
    g.strokeCircle(signX - 14, signY + signH / 2, 5);
    g.strokeCircle(signX + signW + 14, signY + signH / 2, 5);

    // Fenster (zwei links, zwei rechts)
    const rowY = bodyY + 62;
    const fW = 34, fH = 40, ggap = 16;
    const wxs = [signX - ggap - fW, signX + signW + ggap, signX - ggap * 2 - fW * 2, signX + signW + ggap * 2 + fW];
    wxs.forEach((wx) => {
      if (wx < bodyX + 6 || wx + fW > bodyX + bodyW - 6) return;
      g.fillStyle(0x2b2b2b, 1).fillRoundedRect(wx - 2, rowY - 2, fW + 4, fH + 4, 3);
      g.fillStyle(0x608a9a, 1).fillRoundedRect(wx, rowY, fW, fH, 2);
      g.lineStyle(1, 0x1b1b1b, 1).strokeRoundedRect(wx, rowY, fW, fH, 2);
      g.lineBetween(wx, rowY + fH / 2, wx + fW, rowY + fH / 2);
      g.lineBetween(wx + fW / 2, rowY, wx + fW / 2, rowY + fH);
    });

    // Eingang: Bogenportal im selben Stil
    if (b.door) {
      const dx = b.door.x, dy = b.door.y, dw = b.door.w, dh = b.door.h;
      g.fillStyle(0x3b2b1b, 1);
      g.lineStyle(2, 0x24170e, 1);
      g.beginPath();
      g.moveTo(dx, dy + 20);
      g.lineTo(dx, dy + dh);
      g.lineTo(dx + dw, dy + dh);
      g.lineTo(dx + dw, dy + 20);
      g.arc(dx + dw / 2, dy + 20, dw / 2, 0, Math.PI, true);
      g.closePath();
      g.fillPath();
      g.strokePath();
      // simpler Griff
      g.fillStyle(0x24170e, 1).fillCircle(dx + dw * 0.68, dy + dh * 0.56, 3);
    }
  }

  _drawRathausFront(g, b) {
    // Stil wie Schmiede, aber breiter: Ziegel, innerer Rahmen, Giebeldach, Plaquette, Fenster, Ornamente
    const padX = 14;
    const over = 12;          // Dach-ueberstand
    const roofH = 48;         // Dachhoehe
    const padBottom = 24;     // Unterer Rand

    const bodyX = padX;
    const bodyY = roofH + 6;                // genug Platz, damit das Dach nicht clippt
    const bodyW = b.w - padX * 2;
    const bodyH = b.h - bodyY - padBottom;

    // Korpus
    g.fillStyle(0x6a5a49, 1).fillRect(bodyX - 2, bodyY - 2, bodyW + 4, bodyH + 4);

    // Ziegelraster wie Schmiede
    const bw = 24, bh = 14, gap = 2;
    const stepX = bw + gap, stepY = bh + gap;
    g.fillStyle(0xb19b82, 1);
    const rows = Math.ceil(bodyH / stepY) + 1;
    const cols = Math.ceil(bodyW / stepX) + 2;
    for (let r = 0; r <= rows; r++) {
      const odd = (r & 1) ? bw / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const rx = bodyX + c * stepX - odd;
        const ry = bodyY + r * stepY;
        const sx = Math.max(rx, bodyX);
        const sy = Math.max(ry, bodyY);
        const ex = Math.min(rx + bw, bodyX + bodyW);
        const ey = Math.min(ry + bh, bodyY + bodyH);
        const cw = ex - sx, ch = ey - sy;
        if (cw > 0 && ch > 0) g.fillRect(Math.round(sx), Math.round(sy), Math.round(cw), Math.round(ch));
      }
    }

    // Innerer Rahmen deckt Ziegelkanten
    g.fillStyle(0x1c1c1c, 1);
    g.fillRect(bodyX, bodyY, bodyW, 2);
    g.fillRect(bodyX, bodyY + bodyH - 2, bodyW, 2);
    g.fillRect(bodyX, bodyY, 2, bodyH);
    g.fillRect(bodyX + bodyW - 2, bodyY, 2, bodyH);

    // Giebeldach mit Ueberstand (nicht abgeschnitten)
    const apexX = Math.round(bodyX + bodyW / 2);
    const apexY = Math.round(bodyY - roofH);
    const lx = Math.round(bodyX - over);
    const rx = Math.round(bodyX + bodyW + over);
    const by = Math.round(bodyY);
    g.fillStyle(0x3b2b1b, 1);
    g.fillTriangle(apexX, apexY, lx, by, rx, by);
    g.fillStyle(0x2d1e12, 0.35);
    g.fillTriangle(apexX, Math.round(by - roofH * 0.55), lx + 3, by - 3, rx - 3, by - 3);
    g.fillStyle(0x2a1d14, 1).fillRect(lx + 1, by - 2, (rx - lx) - 2, 2);
    g.lineStyle(2, 0x24170e, 1);
    g.strokeTriangle(apexX, apexY, lx, by, rx, by);

    // Pilaster links/rechts (schmale Saeulen)
    g.fillStyle(0x4a3b2b, 1);
    g.fillRect(bodyX + 6, bodyY + 6, 10, bodyH - 12);
    g.fillRect(bodyX + bodyW - 16, bodyY + 6, 10, bodyH - 12);

    // Gesimsleisten (horizontale Zierleisten)
    g.fillStyle(0x2a1d14, 1);
    g.fillRect(bodyX + 4, bodyY + 46, bodyW - 8, 2);
    g.fillRect(bodyX + 4, bodyY + 48, bodyW - 8, 2);

    // Plaquette unter dem Giebel (Text kommt spaeter via RenderTexture in _ensureBuildingTexture)
    const signW = Math.min(300, Math.round(bodyW * 0.72));
    const signH = 34;
    const signX = Math.round(bodyX + bodyW / 2 - signW / 2);
    const signY = bodyY + 10;
    g.fillStyle(0x4a3b2b, 1).fillRoundedRect(signX - 4, signY - 4, signW + 8, signH + 8, 6);
    g.fillStyle(0xd8c7aa, 1).fillRoundedRect(signX, signY, signW, signH, 4);

    // Kleine Rosetten neben der Plaquette
    g.fillStyle(0xd8c7aa, 1);
    g.fillCircle(signX - 16, signY + signH / 2, 6);
    g.fillCircle(signX + signW + 16, signY + signH / 2, 6);
    g.lineStyle(2, 0x2a1d14, 1);
    g.strokeCircle(signX - 16, signY + signH / 2, 6);
    g.strokeCircle(signX + signW + 16, signY + signH / 2, 6);

    // Fensterreihe (wie zuvor)
    const rowY = bodyY + 70;
    const fW = 40, fH = 46, ggap = 18;
    const wxs = [signX - ggap - fW, signX + signW + ggap, signX - ggap * 2 - fW * 2, signX + signW + ggap * 2 + fW];
    wxs.forEach((wx) => {
      if (wx < bodyX + 8 || wx + fW > bodyX + bodyW - 8) return;
      g.fillStyle(0x2b2b2b, 1).fillRoundedRect(wx - 2, rowY - 2, fW + 4, fH + 4, 3);
      g.fillStyle(0x608a9a, 1).fillRoundedRect(wx, rowY, fW, fH, 2);
      g.lineStyle(1, 0x1b1b1b, 1).strokeRoundedRect(wx, rowY, fW, fH, 2);
      g.lineBetween(wx, rowY + fH / 2, wx + fW, rowY + fH / 2);
      g.lineBetween(wx + fW / 2, rowY, wx + fW / 2, rowY + fH);
    });

    // Portal, wenn b.door gesetzt ist
    if (b.door) {
      const dx = b.door.x, dy = b.door.y, dw = b.door.w, dh = b.door.h;
      g.fillStyle(0x3b2b1b, 1);
      g.lineStyle(2, 0x24170e, 1);
      g.beginPath();
      g.moveTo(dx, dy + 24);
      g.lineTo(dx, dy + dh);
      g.lineTo(dx + dw, dy + dh);
      g.lineTo(dx + dw, dy + 24);
      g.arc(dx + dw / 2, dy + 24, dw / 2, 0, Math.PI, true);
      g.closePath();
      g.fillPath();
      g.strokePath();
      // Mittelnaht + Griffe
      g.lineBetween(dx + dw / 2, dy + 28, dx + dw / 2, dy + dh - 4);
      g.fillStyle(0x24170e, 1).fillCircle(dx + dw * 0.36, dy + dh * 0.56, 3);
      g.fillCircle(dx + dw * 0.64, dy + dh * 0.56, 3);
      // Kranz ueber dem Portal
      g.lineStyle(3, 0x2a1d14, 1);
      g.strokeCircle(dx + dw / 2, dy + 8, 12);
    }

    // Merke Koordinaten fuer Text in _ensureBuildingTexture (wird dort rekonstruiert, daher hier keine Speicherung noetig)
  }


  _drawGenericBuildingFront(g, b) {
    // Einfache Steinfassade
    g.fillStyle(0x4a4a3a, 1).fillRect(0, 0, b.w, b.h);

    // Steinstruktur
    g.lineStyle(2, 0x2a2a2a, 1);
    for (let y = 20; y < b.h; y += 20) {
      g.moveTo(0, y);
      g.lineTo(b.w, y);
    }
    g.strokePath();

    // Einfache Fenster
    const windowCount = Math.max(2, Math.floor(b.w / 80));
    for (let i = 0; i < windowCount; i++) {
      const wx = 40 + i * (b.w - 80) / (windowCount - 1);
      g.fillStyle(0x2a2a2a, 1).fillRect(wx - 12, 50, 24, 30);
      g.fillStyle(0x1a3a4a, 0.7).fillRect(wx - 10, 52, 20, 26);
      g.fillStyle(0x2a2a2a, 1);
      g.fillRect(wx - 2, 52, 4, 26);
      g.fillRect(wx - 10, 63, 20, 4);
    }

    // Eingangstür
    if (b.door) {
      const dx = b.door.x, dy = b.door.y, dw = b.door.w, dh = b.door.h;
      g.fillStyle(0x1a1a1a, 1).fillRect(dx - 3, dy - 3, dw + 6, dh + 6);
      g.fillStyle(0x3a2a1a, 1).fillRect(dx, dy, dw, dh);
      g.fillStyle(0x333333, 1);
      g.fillCircle(dx + dw - 8, dy + dh / 2, 3);
    }
  }

}

window.HubScene = HubScene;
