const HUB_HITBOXES = {
  colliders: [
    { id: 'city_silhouette_wall', x: 0,   y: 200, w: 960, h: 92 },
    { id: 'rathaus_body',         x: 368, y: 110, w: 224, h: 168 },
    { id: 'rathaus_steps',        x: 430, y: 280, w: 100, h: 16 },
    { id: 'fountain',             x: 444, y: 344, w: 72,  h: 26 },
    { id: 'planter_left',         x: 356, y: 306, w: 38,  h: 22 },
    { id: 'planter_right',        x: 566, y: 306, w: 38,  h: 22 },
    { id: 'bench_left',           x: 390, y: 488, w: 48,  h: 2 },
    { id: 'bench_right',          x: 522, y: 488, w: 48,  h: 2 },
    { id: 'archivschmiede_body',  x: 220, y: 244, w: 148, h: 62 },
    { id: 'druckerei_body',       x: 652, y: 244, w: 148, h: 62 }
  ],
  entrances: [
    { id: 'rathaus_entrance',   x: 452, y: 296, w: 56, h: 26, label: 'Rathauskeller [E]' },
    { id: 'schmiede_entrance',  x: 292, y: 318, w: 64, h: 34, label: 'Werkstatt [E]' },
    { id: 'druckerei_entrance', x: 668, y: 334, w: 64, h: 34, label: 'Druckerei [E]' }
  ],
  npcs: [
    { id: 'branka', name: 'Schmiedemeisterin Branka', x: 300, y: 416, texture: 'schmiedemeisterin', scale: 0.08 },
    { id: 'thom',   name: 'Setzer Thom',              x: 700, y: 416, texture: 'setzer_thom', scale: 0.17 },
    { id: 'mara',   name: 'Mara',                     x: 512, y: 322, texture: 'spaeherin', scale: 0.0792 }
  ]
};

const HUB_DEBUG = true;
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

    const bg = this.add.image(0, 0, 'hubscene_bg');
    bg.setOrigin(0, 0);
    bg.setScale(1.0);

    this.createColliders();
    this.createEntrances();
    this.createNPCs();
    this.createPlayer();
    
    this.cursors = this.input.keyboard.createCursorKeys();
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    
    if (this.player) {
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.physics.add.collider(this.player, this.colliderGroup);
    }
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
      
      this.entranceLabels.push({ zone, label: labelText });
      
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
    
    if (this.cursors.left.isDown) inputX -= 1;
    if (this.cursors.right.isDown) inputX += 1;
    if (this.cursors.up.isDown) inputY -= 1;
    if (this.cursors.down.isDown) inputY += 1;
    
    const len = Math.hypot(inputX, inputY) || 1;
    const speed = (typeof playerSpeed !== 'undefined' ? playerSpeed : 220);
    const velX = (inputX / len) * speed;
    const velY = (inputY / len) * speed;
    
    p.setVelocity(velX, velY);
    p.setDepth(p.y);
    
    if (typeof updatePlayerSpriteAnimation === 'function') {
      updatePlayerSpriteAnimation(p, velX, velY);
    }
    
    this.updateEntranceLabels();
    this.updateNPCLabels();
    this.checkInteraction();
  }

  updateEntranceLabels() {
    if (!this.player || !this.entranceLabels) return;
    
    this.entranceLabels.forEach(({ zone, label }) => {
      const bounds = zone.getBounds();
      const playerBounds = this.player.getBounds();
      const overlaps = Phaser.Geom.Rectangle.Overlaps(bounds, playerBounds);
      label.setVisible(overlaps);
    });
  }

  updateNPCLabels() {
    if (!this.player || !this.npcs) return;
    
    const interactDist = 80;
    
    this.npcs.forEach(({ sprite, nameText, data }) => {
      const npcX = data.x * SCALE_FACTOR;
      const npcY = data.y * SCALE_FACTOR;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npcX, npcY);
      nameText.setVisible(dist < interactDist);
    });
  }

  checkInteraction() {
    if (!Phaser.Input.Keyboard.JustDown(this.interactKey)) return;
    
    this.entranceLabels.forEach(({ zone, label }) => {
      if (label.visible) {
        const entranceId = zone.getData('id');
        this.handleEntranceInteraction(entranceId);
      }
    });
    
    this.npcs.forEach(({ sprite, nameText, data }) => {
      if (nameText.visible) {
        this.handleNPCInteraction(data);
      }
    });
  }

  handleEntranceInteraction(entranceId) {
    console.log('Entering:', entranceId);
  }

  handleNPCInteraction(npcData) {
    console.log('Talking to:', npcData.name);
  }
}
