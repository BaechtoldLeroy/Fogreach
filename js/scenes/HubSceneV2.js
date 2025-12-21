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

    this.player = this.physics.add.sprite(W / 2, H / 2, textureKey, 0)
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
    this.cursors = this.input.keyboard.createCursorKeys();
    
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  update(t, dt) {
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
    
    if (typeof updatePlayerSpriteAnimation === 'function') {
      updatePlayerSpriteAnimation(p, velX, velY);
    }
  }
}
