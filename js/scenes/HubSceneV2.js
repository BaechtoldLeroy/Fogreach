const HUB_HITBOXES = {
  colliders: [
    { id: 'city_silhouette_wall', x: 0,   y: 0,   w: 960, h: 92 },
    { id: 'rathaus_body',         x: 368, y: 110, w: 224, h: 168 },
    { id: 'rathaus_steps',        x: 430, y: 280, w: 100, h: 16 },
    { id: 'fountain',             x: 444, y: 328, w: 72,  h: 52 },
    { id: 'planter_left',         x: 356, y: 318, w: 38,  h: 22 },
    { id: 'planter_right',        x: 566, y: 318, w: 38,  h: 22 },
    { id: 'bench_left',           x: 390, y: 352, w: 96,  h: 16 },
    { id: 'bench_right',          x: 474, y: 352, w: 96,  h: 16 },
    { id: 'lamp_left',            x: 348, y: 336, w: 8,   h: 32 },
    { id: 'lamp_right',           x: 602, y: 336, w: 8,   h: 32 },
    { id: 'archivschmiede_body',  x: 220, y: 300, w: 180, h: 110 },
    { id: 'druckerei_body',       x: 620, y: 300, w: 180, h: 110 },
    { id: 'boulevard_edge',       x: 0,   y: 440, w: 960, h: 12 }
  ],
  entrances: [
    { id: 'rathaus_entrance',   x: 452, y: 296, w: 56, h: 26, label: 'Rathauskeller [E]' },
    { id: 'schmiede_entrance',  x: 292, y: 366, w: 64, h: 34, label: 'Werkstatt [E]' },
    { id: 'druckerei_entrance', x: 668, y: 366, w: 64, h: 34, label: 'Druckerei [E]' }
  ],
  npcs: [
    { id: 'branka', name: 'Schmiedemeisterin Branka', x: 300, y: 416 },
    { id: 'thom',   name: 'Setzer Thom',              x: 700, y: 416 },
    { id: 'mara',   name: 'Mara',                     x: 512, y: 304 }
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
        const rect = this.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, 0xff0000, 0.3);
        rect.setStrokeStyle(2, 0xff0000);
        rect.setDepth(1000);
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
        const rect = this.add.rectangle(sx + sw / 2, sy + sh / 2, sw, sh, 0x00ff00, 0.3);
        rect.setStrokeStyle(2, 0x00ff00);
        rect.setDepth(1000);
      }
    });
  }

  createNPCs() {
    this.npcs = [];
    
    HUB_HITBOXES.npcs.forEach(npc => {
      const sx = npc.x * SCALE_FACTOR;
      const sy = npc.y * SCALE_FACTOR;
      
      let sprite;
      const spriteKey = this.getNPCSpriteKey(npc.id);
      
      if (this.textures.exists(spriteKey)) {
        sprite = this.add.sprite(sx, sy, spriteKey);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(0.5);
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
        const marker = this.add.circle(sx, sy, 8, 0x0000ff, 0.8);
        marker.setDepth(1000);
      }
    });
  }

  getNPCSpriteKey(id) {
    const mapping = {
      'branka': 'schmiedemeisterin',
      'thom': 'setzer_thom',
      'mara': 'spaeherin'
    };
    return mapping[id] || id;
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
