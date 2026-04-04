const HUB_HITBOXES = {
  colliders: [
    { id: 'city_silhouette_wall', x: 0,   y: 200, w: 960, h: 92 },
    { id: 'rathaus_body',         x: 368, y: 110, w: 224, h: 168 },
    { id: 'rathaus_steps',        x: 430, y: 280, w: 100, h: 16 },
    { id: 'fountain',             x: 444, y: 344, w: 72,  h: 26 },
    { id: 'planter_left',         x: 356, y: 306, w: 38,  h: 22 },
    { id: 'planter_right',        x: 566, y: 306, w: 38,  h: 22 },
    { id: 'bench_left',           x: 390, y: 484, w: 48,  h: 16 },
    { id: 'bench_right',          x: 522, y: 484, w: 48,  h: 16 },
    { id: 'archivschmiede_body',  x: 220, y: 244, w: 148, h: 62 },
    { id: 'druckerei_body',       x: 652, y: 244, w: 148, h: 62 }
  ],
  entrances: [
    { id: 'rathaus_entrance',   x: 452, y: 296, w: 56, h: 26, label: 'Rathauskeller [E]', target: 'GameScene' },
    { id: 'schmiede_entrance',  x: 292, y: 318, w: 64, h: 34, label: 'Werkstatt [E]', target: 'workshop' },
    { id: 'druckerei_entrance', x: 668, y: 334, w: 64, h: 34, label: 'Druckerei [E]', target: 'druckerei' }
  ],
  npcs: [
    { 
      id: 'branka', 
      name: 'Schmiedemeisterin Branka', 
      x: 300, y: 416, 
      texture: 'schmiedemeisterin', 
      scale: 0.08,
      lines: [
        'Stahl allein schneidet die Luegen des Rates nicht. Erst wenn jede Klinge Wissen traegt, faellt ihre Maske.',
        'Im Keller unter dem Rathaus lagern Protokolle aus Daemonenverhoeren. Bring mir Abschriften, und ich veredele deine Artefakte.',
        'Sprich draussen leise. Die Aufseher des Kettenrats tragen inzwischen die Farben der Stadtgarde.'
      ]
    },
    { 
      id: 'thom', 
      name: 'Setzer Thom', 
      x: 700, y: 416, 
      texture: 'setzer_thom', 
      scale: 0.17,
      lines: [
        'Der Kettenrat verordnet Gebete, Mahlzeiten, sogar Traeume. Wir antworten mit Pamphleten voller Namen und Zahlen.',
        'Bring mir Beweise aus dem Rathauskeller. Jede Spalte, die wir drucken, nimmt der Angst einen Zoll.',
        'Verteile nichts Ungeprueftes. Eine falsche Zeile, und sie sperren wieder zehn Familien ein.'
      ]
    },
    { 
      id: 'mara', 
      name: 'Mara vom Untergrund', 
      x: 512, y: 322, 
      texture: 'spaeherin', 
      scale: 0.0792,
      lines: [
        'Die Schreiber des Rates markieren Haeuser mit Kreideketten. Wer widerspricht, verschwindet in Ritualschachten.',
        'Der Zeremonienmeister besitzt neue Siegel. Sie holen Daemonen als stilles Archiv.',
        'Sichere Augen im Rathauskeller. Jedes Siegel, das du brichst, lockert ihre Ketten an der Stadt.'
      ]
    }
  ]
};

const HUB_DEBUG = false;
const SCALE_FACTOR = 1536 / 960;

class HubSceneV2 extends Phaser.Scene {
  constructor() {
    super({ key: 'HubSceneV2' });
  }

  preload() {
    this.load.image('hubscene_bg', 'assets/hubscene.png');
    this.load.image('schmiedemeisterin', 'assets/sprites/schmiedemeisterin.png');
    this.load.image('setzer_thom', 'assets/sprites/setzer_thom.png');
    this.load.image('spaeherin', 'assets/sprites/spaeherin.png');
  }

  create() {
    const W = 1536, H = 1024;

    this.cameras.main.setBounds(0, 0, W, H);
    this.physics.world.setBounds(0, 0, W, H);
    this.physics.world.TILE_BIAS = 24;

    const bg = this.add.image(0, 0, 'hubscene_bg');
    bg.setOrigin(0, 0);
    bg.setScale(1.0);

    this._dialogOpen = false;
    this._activeInteractable = null;
    this._dialogContainer = null;

    this.createColliders();
    this.createEntrances();
    this.createNPCs();
    this.createPlayer();
    this.createPrompt();
    
    // Initialize sound manager and start hub ambient music
    if (typeof SoundManager === 'function') {
      window.soundManager = new SoundManager(this);
      window.soundManager.playMusic('hub_ambient');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-E', this._handleInteract, this);
    this.input.keyboard.on('keydown-M', () => {
      if (window.soundManager) window.soundManager.toggleMute();
    });

    if (this.player) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.physics.add.collider(this.player, this.colliderGroup);
      this.physics.add.collider(this.player, this.npcGroup);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown-E', this._handleInteract, this);
      if (window.soundManager) window.soundManager.stopMusic();
    });
  }

  createPrompt() {
    this.prompt = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: 16,
      backgroundColor: '#000a',
      padding: { x: 6, y: 3 }
    }).setOrigin(0.5, 1).setDepth(1000).setVisible(false);
  }

  createColliders() {
    this.colliderGroup = this.physics.add.staticGroup();
    
    const colors = {
      'city_silhouette_wall': 0xff0000,
      'rathaus_body': 0xff4400,
      'rathaus_steps': 0xff8800,
      'fountain': 0x0088ff,
      'planter_left': 0x00ff00,
      'planter_right': 0x00ff00,
      'bench_left': 0x884400,
      'bench_right': 0x884400,
      'archivschmiede_body': 0x8800ff,
      'druckerei_body': 0xff00ff
    };
    
    HUB_HITBOXES.colliders.forEach(c => {
      const sx = c.x * SCALE_FACTOR;
      const sy = c.y * SCALE_FACTOR;
      const sw = c.w * SCALE_FACTOR;
      const sh = c.h * SCALE_FACTOR;
      
      const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh);
      this.physics.add.existing(zone, true);
      this.colliderGroup.add(zone);
      zone.setData('id', c.id);
      
      if (HUB_DEBUG) {
        const color = colors[c.id] || 0xff0000;
        const rect = this.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, color, 0.35);
        rect.setStrokeStyle(2, color);
        rect.setDepth(1000);
        
        const label = this.add.text(sx + sw / 2, sy + sh / 2, c.id, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#ffffff',
          backgroundColor: '#000000aa',
          padding: { x: 2, y: 1 }
        }).setOrigin(0.5).setDepth(1001);
      }
    });
  }

  createEntrances() {
    this.entranceGroup = this.physics.add.staticGroup();
    this.entranceLabels = [];
    
    HUB_HITBOXES.entrances.forEach(e => {
      const sx = e.x * SCALE_FACTOR;
      const sy = e.y * SCALE_FACTOR;
      const sw = e.w * SCALE_FACTOR;
      const sh = e.h * SCALE_FACTOR;
      
      const zone = this.add.zone(sx + sw / 2, sy + sh / 2, sw, sh);
      this.physics.add.existing(zone, true);
      this.entranceGroup.add(zone);
      zone.setData('id', e.id);
      zone.setData('label', e.label);
      
      const labelText = this.add.text(sx + sw / 2, sy - 10, e.label, {
        fontSize: '14px',
        fontFamily: 'serif',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5, 1).setDepth(200).setVisible(false);
      
      this.entranceLabels.push({ zone, label: labelText, data: e });
      
      if (HUB_DEBUG) {
        const rect = this.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, 0x00ff00, 0.4);
        rect.setStrokeStyle(3, 0x00ff00);
        rect.setDepth(1000);
        
        const debugLabel = this.add.text(sx + sw / 2, sy + sh / 2, e.id, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#00ff00',
          backgroundColor: '#000000cc',
          padding: { x: 2, y: 1 }
        }).setOrigin(0.5).setDepth(1001);
      }
    });
  }

  createNPCs() {
    this.npcs = [];
    this.npcGroup = this.physics.add.staticGroup();

    HUB_HITBOXES.npcs.forEach(npc => {
      const sx = npc.x * SCALE_FACTOR;
      const sy = npc.y * SCALE_FACTOR;

      let sprite;

      if (this.textures.exists(npc.texture)) {
        sprite = this.add.sprite(sx, sy, npc.texture);
        sprite.setOrigin(0.5, 1);
        if (npc.scale) sprite.setScale(npc.scale);
      } else {
        sprite = this.add.rectangle(sx, sy - 40, 40, 80, 0x8844aa);
        sprite.setStrokeStyle(2, 0xffffff);
      }

      sprite.setDepth(sy);
      sprite.setData('id', npc.id);
      sprite.setData('name', npc.name);

      const hitW = 30, hitH = 36;
      const npcZone = this.add.zone(sx, sy - hitH / 2, hitW, hitH);
      this.physics.add.existing(npcZone, true);
      this.npcGroup.add(npcZone);
      
      const nameText = this.add.text(sx, sy - 90, npc.name, {
        fontSize: '12px',
        fontFamily: 'serif',
        color: '#ffdd88',
        backgroundColor: '#000000cc',
        padding: { x: 4, y: 2 }
      }).setOrigin(0.5, 1).setDepth(201).setVisible(false);
      
      this.npcs.push({ sprite, nameText, data: npc });
      
      if (HUB_DEBUG) {
        const marker = this.add.circle(sx, sy, 10, 0x00ffff, 0.8);
        marker.setStrokeStyle(2, 0xffffff);
        marker.setDepth(1000);
        
        const npcLabel = this.add.text(sx, sy + 15, npc.id, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#00ffff',
          backgroundColor: '#000000cc',
          padding: { x: 2, y: 1 }
        }).setOrigin(0.5, 0).setDepth(1001);
      }
    });
  }

  createPlayer() {
    const W = 1536, H = 1024;
    
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

    this.player = this.physics.add.sprite(W / 2, H * 0.65, textureKey, 0)
      .setCollideWorldBounds(true);

    if (typeof applyPlayerDisplaySettings === 'function') {
      applyPlayerDisplaySettings(this.player);
    }
    if (typeof ensurePlayerAnimations === 'function') {
      ensurePlayerAnimations(this);
    }
    if (typeof updatePlayerSpriteAnimation === 'function') {
      updatePlayerSpriteAnimation(this.player, 0, 0);
    }
    
    this.player.setDepth(100);
  }

  update(t, dt) {
    if (!this.player) return;
    
    const p = this.player;
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
      if (typeof updatePlayerSpriteAnimation === 'function') {
        updatePlayerSpriteAnimation(p, velX, velY);
      }
    } else {
      p.setVelocity(0, 0);
      if (typeof updatePlayerSpriteAnimation === 'function') {
        updatePlayerSpriteAnimation(p, 0, 0);
      }
    }
    
    p.setDepth(p.y);
    this._refreshInteractionPrompt();
    
    if (this.prompt) {
      this.prompt.setPosition(p.x, p.y - 52);
    }
  }

  _refreshInteractionPrompt() {
    if (this._dialogOpen || !this.player?.body) return;
    
    const playerBounds = this.player.getBounds();
    let active = null;
    let activeLabel = null;

    for (const { zone, label, data } of this.entranceLabels) {
      const bounds = zone.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(bounds, playerBounds)) {
        active = { type: 'entrance', data, zone };
        activeLabel = data.label;
        label.setVisible(true);
      } else {
        label.setVisible(false);
      }
    }

    const interactDist = 100;
    for (const { sprite, nameText, data } of this.npcs) {
      const npcX = data.x * SCALE_FACTOR;
      const npcY = data.y * SCALE_FACTOR;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npcX, npcY);
      if (dist < interactDist) {
        active = { type: 'npc', data };
        activeLabel = `${data.name} [E]`;
        nameText.setVisible(true);
      } else {
        nameText.setVisible(false);
      }
    }

    if (active) {
      this._activeInteractable = active;
      this.prompt.setText(activeLabel);
      this.prompt.setVisible(true);
    } else {
      this._activeInteractable = null;
      this.prompt.setVisible(false);
    }
  }

  _handleInteract() {
    if (this._dialogOpen) return;
    const current = this._activeInteractable;
    if (!current) return;
    
    this._activeInteractable = null;
    this.prompt.setVisible(false);
    if (window.soundManager) window.soundManager.playSFX('ui_click');

    if (current.type === 'npc') {
      this._showNpcDialogue(current.data);
    } else if (current.type === 'entrance') {
      this._enterLocation(current.data);
    }
  }

  _showNpcDialogue(npcData) {
    console.log('[HubSceneV2] Opening NPC dialogue for:', npcData.name);
    this._dialogOpen = true;

    if (this._dialogContainer) {
      this._dialogContainer.destroy(true);
      this._dialogContainer = null;
    }

    const qs = window.questSystem;
    const npcId = npcData.id;

    // Determine quest context for this NPC
    let questMode = 'flavor'; // flavor | offer | progress | turnin
    let questData = null;

    if (qs && npcId) {
      // Check if there is an active quest ready to turn in
      const activeForNpc = qs.getActiveQuests(npcId);
      const readyToTurnIn = activeForNpc.find(q => qs.isQuestReadyToComplete(q.id));
      if (readyToTurnIn) {
        questMode = 'turnin';
        questData = readyToTurnIn;
      } else if (activeForNpc.length > 0) {
        questMode = 'progress';
        questData = activeForNpc[0];
      } else {
        const available = qs.getAvailableQuests(npcId);
        if (available.length > 0) {
          questMode = 'offer';
          questData = available[0];
        }
      }
    }

    const cam = this.cameras.main;
    const cx = cam.width / 2;
    const cy = cam.height - 180;

    const container = this.add.container(cx, cy).setDepth(1500).setScrollFactor(0);
    const panelWidth = 520;
    const pad = 24;
    const innerWidth = panelWidth - pad * 2;

    // Build title and body based on quest mode
    let titleStr = npcData.name || 'Gespraech';
    let bodyStr = '';
    let showAcceptBtn = false;
    let showCompleteBtn = false;

    if (questMode === 'offer' && questData) {
      titleStr = npcData.name + ' — Neue Aufgabe';
      bodyStr = questData.dialogueOffer + '\n\n[' + questData.title + ']\n' + questData.description;
      showAcceptBtn = true;
    } else if (questMode === 'progress' && questData) {
      const obj = questData.objectives[0];
      const progressStr = obj ? (obj.current + '/' + obj.required) : '';
      titleStr = npcData.name + ' — ' + questData.title;
      bodyStr = questData.dialogueProgress + '\n\nFortschritt: ' + progressStr;
    } else if (questMode === 'turnin' && questData) {
      titleStr = npcData.name + ' — Aufgabe abgeschlossen!';
      bodyStr = questData.dialogueComplete;
      showCompleteBtn = true;
    } else {
      // Flavor dialogue (existing behavior)
      const bodyLines = npcData.lines || [];
      bodyStr = bodyLines.join('\n\n');
    }

    const header = this.add.text(0, 0, titleStr, {
      fontFamily: 'serif',
      fontSize: 22,
      color: '#f1e9d8'
    }).setWordWrapWidth(innerWidth).setVisible(false);

    const bodyText = this.add.text(0, 0, bodyStr, {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#d8d2c3',
      wordWrap: { width: innerWidth }
    }).setVisible(false);

    const headerHeight = header.height;
    const bodyHeight = bodyText.height;
    const hintHeight = 22;
    const extraBtnHeight = (showAcceptBtn || showCompleteBtn) ? 48 : 0;
    const panelHeight = Math.max(200, Math.ceil(pad + headerHeight + 12 + bodyHeight + extraBtnHeight + pad + hintHeight));

    const g = this.add.graphics();
    g.fillStyle(0x0c0c11, 0.94).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    g.lineStyle(2, 0x484850, 0.9).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    container.add(g);

    header.setPosition(-panelWidth / 2 + pad, -panelHeight / 2 + pad).setVisible(true);
    bodyText.setPosition(-panelWidth / 2 + pad, header.y + headerHeight + 12).setVisible(true);
    container.add(header);
    container.add(bodyText);

    const hintY = panelHeight / 2 - pad * 0.75;
    const keyClosers = [];

    // Quest Accept button
    if (showAcceptBtn && questData) {
      const acceptBtn = this.add.text(0, hintY - 44, '[ Aufgabe annehmen ]', {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#ffffff',
        backgroundColor: '#3d6a3d',
        padding: { x: 14, y: 8 }
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });

      acceptBtn.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        if (qs) qs.acceptQuest(questData.id);
        this._closeDialog(keyClosers);
      });
      container.add(acceptBtn);

      // Also bind A key for accept
      const acceptKeyHandler = () => {
        if (qs) qs.acceptQuest(questData.id);
        this._closeDialog(keyClosers);
      };
      this.input.keyboard.on('keydown-A', acceptKeyHandler);
      keyClosers.push({ eventName: 'keydown-A', handler: acceptKeyHandler });
    }

    // Quest Complete button
    if (showCompleteBtn && questData) {
      const completeBtn = this.add.text(0, hintY - 44, '[ Belohnung abholen ]', {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#ffffff',
        backgroundColor: '#6a6a3d',
        padding: { x: 14, y: 8 }
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });

      completeBtn.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        if (qs) qs.completeQuest(questData.id);
        this._closeDialog(keyClosers);
      });
      container.add(completeBtn);

      const completeKeyHandler = () => {
        if (qs) qs.completeQuest(questData.id);
        this._closeDialog(keyClosers);
      };
      this.input.keyboard.on('keydown-A', completeKeyHandler);
      keyClosers.push({ eventName: 'keydown-A', handler: completeKeyHandler });
    }

    // Mara skill tree button (keep existing behavior)
    if (npcData.id === 'mara' && questMode === 'flavor') {
      const skillsBtn = this.add.text(0, hintY - 40, '[ Skills lernen ] (K)', {
        fontFamily: 'monospace',
        fontSize: 16,
        color: '#ffffff',
        backgroundColor: '#2a5a8a',
        padding: { x: 14, y: 8 }
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });

      skillsBtn.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        this._closeDialog();
        this.time.delayedCall(100, () => {
          if (typeof this._showSkillTreeUI === 'function') {
            this._showSkillTreeUI();
          }
        });
      });
      container.add(skillsBtn);
    }

    const hintParts = ['E / Leer / ESC: schliessen'];
    if (showAcceptBtn) hintParts.push('A: annehmen');
    if (showCompleteBtn) hintParts.push('A: abholen');

    const hintText = this.add.text(0, hintY, hintParts.join('  |  '), {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#b2aba0'
    }).setOrigin(0.5, 1);
    container.add(hintText);

    this._dialogContainer = container;

    const closeDialog = () => this._closeDialog(keyClosers);

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

      if (npcData.id === 'mara' && questMode === 'flavor') {
        const skillHandler = () => {
          this._closeDialog(keyClosers);
          this.time.delayedCall(100, () => {
            if (typeof this._showSkillTreeUI === 'function') {
              this._showSkillTreeUI();
            }
          });
        };
        this.input.keyboard.on('keydown-K', skillHandler);
        keyClosers.push({ eventName: 'keydown-K', handler: skillHandler });
      }
    });

    this._currentKeyClosers = keyClosers;
    this.input.once('pointerdown', closeDialog);
  }

  _closeDialog(keyClosers) {
    if (!this._dialogOpen) return;
    this._dialogOpen = false;
    
    if (this._dialogContainer) {
      this._dialogContainer.destroy(true);
      this._dialogContainer = null;
    }

    const closers = keyClosers || this._currentKeyClosers || [];
    while (closers.length) {
      const { eventName, handler } = closers.pop();
      this.input.keyboard.off(eventName, handler);
    }
    this._currentKeyClosers = null;
  }

  _enterLocation(entranceData) {
    console.log('[HubSceneV2] Entering:', entranceData.id, '-> target:', entranceData.target);
    
    if (entranceData.target === 'GameScene') {
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
          console.warn('[HubSceneV2] Unable to persist last difficulty', err);
        }

        if (typeof saveGame === 'function') {
          try {
            saveGame(this);
          } catch (err) {
            console.warn('[HubSceneV2] saveGame before dungeon failed', err);
          }
        }

        if (window.__LAST_SAVE_SNAPSHOT__) {
          try {
            window.pendingLoadedSave = JSON.parse(JSON.stringify(window.__LAST_SAVE_SNAPSHOT__));
          } catch (err) {
            console.warn('[HubSceneV2] snapshot clone failed', err);
            window.pendingLoadedSave = window.__LAST_SAVE_SNAPSHOT__;
          }
        }

        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('GameScene');
        });
      });
    } else if (entranceData.target === 'workshop') {
      this._showNpcDialogue({
        name: 'Werkstatt',
        lines: ['Die Werkstatt ist derzeit geschlossen.', 'Komm spaeter wieder.']
      });
    } else if (entranceData.target === 'druckerei') {
      this._showNpcDialogue({
        name: 'Druckerei',
        lines: ['Die Druckerpresse ruht.', 'Setzer Thom wird sie bald wieder anwerfen.']
      });
    }
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
    const panelHeight = 340;
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
        console.warn('[HubSceneV2] Unable to persist difficulty selection', err);
      }
    };
    persistDifficultySelection(difficulty);

    const title = this.add.text(0, -panelHeight / 2 + pad, 'Rathauskeller betreten', {
      fontFamily: 'serif',
      fontSize: 24,
      color: '#f2e9d8'
    }).setOrigin(0.5, 0);
    container.add(title);

    const subtitle = this.add.text(0, title.y + title.height + 12, 'Waehle das Start-Level (Schwierigkeit)', {
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

    // Background toggle checkbox
    let useBg = window.USE_RATHAUSKELLER_BG === true;
    const bgCheckboxY = difficultyText.y + 50;
    
    const bgCheckbox = this.add.graphics();
    const drawCheckbox = () => {
      bgCheckbox.clear();
      bgCheckbox.lineStyle(2, 0xaaaacc, 1);
      bgCheckbox.strokeRect(-100, bgCheckboxY - 10, 20, 20);
      if (useBg) {
        bgCheckbox.fillStyle(0x88cc88, 1);
        bgCheckbox.fillRect(-96, bgCheckboxY - 6, 12, 12);
      }
    };
    drawCheckbox();
    container.add(bgCheckbox);
    
    const bgLabel = this.add.text(-70, bgCheckboxY, 'Hintergrundbild verwenden', {
      fontFamily: 'monospace',
      fontSize: 16,
      color: '#c8c2b5'
    }).setOrigin(0, 0.5);
    container.add(bgLabel);
    
    const bgHitArea = this.add.rectangle(-20, bgCheckboxY, 200, 24, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    bgHitArea.on('pointerdown', () => {
      useBg = !useBg;
      window.USE_RATHAUSKELLER_BG = useBg;
      drawCheckbox();
    });
    container.add(bgHitArea);

    const info = this.add.text(0, bgCheckboxY + 40, 'Links/Rechts Level aendern - Hoch/Runter Multiplikator\nEnter/Space starten - ESC zurueck - B Hintergrund', {
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
        case 'KeyB':
          event?.preventDefault?.();
          useBg = !useBg;
          window.USE_RATHAUSKELLER_BG = useBg;
          drawCheckbox();
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

  _showSkillTreeUI() {
    console.log('[HubSceneV2] _showSkillTreeUI called');
    if (!window.SKILL_TREES || typeof window.getMaterialCount !== 'function') {
      console.warn('[HubSceneV2] Skill system not loaded');
      return;
    }

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
    const skillNodePositions = {}; // track node positions for connection lines

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

      const treeTitle = this.add.text(treeX + treeWidth / 2, treeStartY + 10, tree.name, {
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
      const skillBoxHeight = 60;
      const tierGap = 12;
      const tierSpacing = skillBoxHeight + tierGap;

      let currentSkillY = treeStartY + treeTitle.height + 30;

      for (let tier = 1; tier <= maxTier; tier++) {
        const tierSkills = skillsByTier[tier] || [];
        if (tierSkills.length === 0) continue;

        const horizontalGap = tierSkills.length > 2 ? 6 : 10;
        const availableWidth = treeWidth - 30;
        const calculatedWidth = (availableWidth - horizontalGap * Math.max(0, tierSkills.length - 1)) / tierSkills.length;
        const skillBoxWidth = Math.min(120, calculatedWidth);
        const skillSpacing = skillBoxWidth + horizontalGap;
        const fontSize = skillBoxWidth < 70 ? 9 : 11;
        const costFontSize = skillBoxWidth < 70 ? 12 : 14;

        const totalRowWidth = skillBoxWidth * tierSkills.length + horizontalGap * (tierSkills.length - 1);
        const startX = treeX + (treeWidth - totalRowWidth) / 2;

        tierSkills.forEach((skill, idx) => {
          const skillX = startX + skillBoxWidth / 2 + idx * skillSpacing;
          const skillY = currentSkillY;

          // Track position for connection lines
          skillNodePositions[skill.id] = {
            x: skillX,
            y: skillY + skillBoxHeight / 2
          };

          const owned = window.hasSkill(skill.id);
          const canPurchase = window.canPurchaseSkill(skill.id);
          const isActive = !!skill.isActive;

          let bgColor, borderColor, textColor;
          if (owned) {
            bgColor = isActive ? 0x2244aa : Phaser.Display.Color.HexStringToColor(tree.color).color;
            borderColor = 0xffffff;
            textColor = '#ffffff';
          } else if (canPurchase.canPurchase) {
            bgColor = isActive ? 0x1a2a4a : 0x3a3a4a;
            borderColor = isActive ? 0x4488ff : Phaser.Display.Color.HexStringToColor(tree.color).color;
            textColor = '#dddddd';
          } else {
            // Locked - gray
            bgColor = 0x222228;
            borderColor = 0x3a3a3a;
            textColor = '#666666';
          }

          const skillBox = this.add.graphics();
          skillBox.fillStyle(bgColor, 0.9);
          skillBox.fillRoundedRect(skillX - skillBoxWidth / 2, skillY, skillBoxWidth, skillBoxHeight, 8);
          skillBox.lineStyle(2, borderColor, 0.9);
          skillBox.strokeRoundedRect(skillX - skillBoxWidth / 2, skillY, skillBoxWidth, skillBoxHeight, 8);
          container.add(skillBox);

          const skillNameText = this.add.text(skillX, skillY + 8, skill.name, {
            fontFamily: 'Arial',
            fontSize: fontSize,
            color: textColor,
            fontStyle: 'bold',
            wordWrap: { width: skillBoxWidth - 8 },
            align: 'center'
          }).setOrigin(0.5, 0);
          container.add(skillNameText);

          // Type indicator
          if (isActive) {
            const typeIndicator = this.add.text(skillX - skillBoxWidth / 2 + 4, skillY + 2, 'A', {
              fontFamily: 'Arial',
              fontSize: 9,
              color: '#4488ff',
              fontStyle: 'bold'
            }).setOrigin(0, 0);
            container.add(typeIndicator);
          }

          const costLabel = owned ? '\u2713' : `${skill.cost}`;
          const costColor = owned ? '#00ff00' : '#ffaa00';
          const costText = this.add.text(skillX, skillY + skillBoxHeight - 16, costLabel, {
            fontFamily: 'Arial',
            fontSize: costFontSize,
            color: costColor,
            fontStyle: 'bold'
          }).setOrigin(0.5, 0.5);
          container.add(costText);

          // Hit area for interaction
          const worldX = skillX + container.x;
          const worldY = skillY + skillBoxHeight / 2 + container.y;

          const hitArea = this.add.rectangle(worldX, worldY, skillBoxWidth, skillBoxHeight, 0xffffff, 0.01)
            .setOrigin(0.5, 0.5)
            .setDepth(2050)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: !owned && canPurchase.canPurchase });

          skillHitAreas.push(hitArea);

          hitArea.on('pointerover', () => {
            if (this._skillTooltip) {
              this._skillTooltip.destroy(true);
              this._skillTooltip = null;
            }

            const tooltipLines = [
              skill.name,
              skill.description,
              '',
              `Kosten: ${skill.cost} Eisenbrocken`
            ];

            if (isActive) {
              tooltipLines.push('Typ: Aktive Fähigkeit');
            }

            if (skill.requires && skill.requires.length > 0) {
              tooltipLines.push('');
              tooltipLines.push('Benötigt:');
              skill.requires.forEach(reqId => {
                const reqSkill = window.getSkillById(reqId);
                const reqName = reqSkill ? reqSkill.name : reqId;
                const reqHas = window.hasSkill(reqId);
                tooltipLines.push(`  ${reqHas ? '\u2713' : '\u2717'} ${reqName}`);
              });
            }

            if (!canPurchase.canPurchase && !owned) {
              tooltipLines.push('');
              tooltipLines.push(`\u274C ${canPurchase.reason}`);
            }

            const tooltip = this.add.container(0, 0).setDepth(2100);
            const tooltipBg = this.add.graphics();
            const tooltipTextObj = this.add.text(0, 0, tooltipLines.join('\n'), {
              fontFamily: 'monospace',
              fontSize: 13,
              color: '#ffffff',
              backgroundColor: '#1a1a2a',
              padding: { x: 10, y: 8 }
            }).setOrigin(0, 0);

            const tooltipW = tooltipTextObj.width + 4;
            const tooltipH = tooltipTextObj.height + 4;

            tooltipBg.fillStyle(0x1a1a2a, 0.95);
            tooltipBg.fillRoundedRect(-2, -2, tooltipW, tooltipH, 8);
            tooltipBg.lineStyle(2, 0x4a6a9c, 0.9);
            tooltipBg.strokeRoundedRect(-2, -2, tooltipW, tooltipH, 8);

            tooltip.add(tooltipBg);
            tooltip.add(tooltipTextObj);

            let tooltipX = worldX - tooltipW / 2;
            let tooltipY = worldY + skillBoxHeight / 2 + 5;

            if (tooltipX < 10) tooltipX = 10;
            if (tooltipX + tooltipW > cw - 10) tooltipX = cw - tooltipW - 10;
            if (tooltipY + tooltipH > ch - 10) {
              tooltipY = worldY - skillBoxHeight / 2 - tooltipH - 5;
            }

            tooltip.setPosition(tooltipX, tooltipY).setScrollFactor(0);
            this._skillTooltip = tooltip;
          });

          hitArea.on('pointerout', () => {
            if (this._skillTooltip) {
              this._skillTooltip.destroy(true);
              this._skillTooltip = null;
            }
          });

          hitArea.on('pointerdown', () => {
            if (owned) return;
            if (!canPurchase.canPurchase) return;

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

    // Draw connection lines between skill prerequisites
    const connectionGraphics = this.add.graphics();
    connectionGraphics.lineStyle(1.5, 0x6688aa, 0.5);
    for (const tree of trees) {
      for (const skill of tree.skills) {
        if (!skill.requires || !skillNodePositions[skill.id]) continue;
        const toPos = skillNodePositions[skill.id];
        for (const reqId of skill.requires) {
          const fromPos = skillNodePositions[reqId];
          if (!fromPos) continue;
          const owned = window.hasSkill(reqId);
          connectionGraphics.lineStyle(1.5, owned ? 0x88aacc : 0x444466, owned ? 0.6 : 0.3);
          connectionGraphics.beginPath();
          connectionGraphics.moveTo(fromPos.x, fromPos.y + 30);
          connectionGraphics.lineTo(toPos.x, toPos.y - 30);
          connectionGraphics.strokePath();
        }
      }
    }
    container.addAt(connectionGraphics, 1); // behind skill boxes but above background

    // Respec button
    const totalSpent = window.getSkillPointsSpent();
    if (totalSpent > 0) {
      const respecCost = Math.ceil(totalSpent * 0.5);
      const respecBtn = this.add.text(-panelW / 2 + 20, panelH / 2 - 30,
        `[ Zurücksetzen (${respecCost} Eisenbrocken) ]`, {
          fontFamily: 'monospace',
          fontSize: 14,
          color: '#ff8888',
          backgroundColor: '#2a1a1a',
          padding: { x: 10, y: 6 }
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      container.add(respecBtn);

      respecBtn.on('pointerdown', () => {
        const result = window.respecSkills();
        if (result.success) {
          console.log('[Skills] Respec successful, refunded:', result.refunded);
          closeSkillUI();
          this.time.delayedCall(50, () => {
            this._showSkillTreeUI();
          });
        } else {
          console.warn('[Skills] Respec failed:', result.reason);
          // Show temporary error message
          const errText = this.add.text(0, panelH / 2 - 60, result.reason, {
            fontFamily: 'monospace',
            fontSize: 14,
            color: '#ff4444'
          }).setOrigin(0.5, 0.5).setDepth(2100).setScrollFactor(0);
          this.time.delayedCall(2000, () => errText.destroy());
        }
      });
    }

    // Close button
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

    closeBtn.on('pointerdown', () => closeSkillUI());
    this.input.keyboard.once('keydown-ESC', closeSkillUI);
  }
}
