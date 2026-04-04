/**
 * ParticleFactory - Reusable particle effect system for Demonfall
 * Uses Phaser 3.60+ particle API
 */
class ParticleFactory {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Create a one-shot burst of particles at a position, auto-cleanup after done.
   */
  burst(x, y, textureKey, config) {
    const scene = this.scene;
    if (!scene || !scene.add) return null;

    const emitter = scene.add.particles(x, y, textureKey, Object.assign({
      emitting: false
    }, config));

    const cleanup = Math.max(config.lifespan || 500, 200) + 200;
    scene.time.delayedCall(cleanup, () => {
      if (emitter && !emitter.destroyed) emitter.destroy();
    });

    emitter.explode(config.quantity || 6);
    return emitter;
  }

  /** White/yellow sparks on melee hit */
  hitSpark(x, y) {
    return this.burst(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.5, end: 0 },
      lifespan: 200,
      quantity: 6,
      tint: [0xffffff, 0xffff00, 0xffffaa],
      gravityY: 100
    });
  }

  /** Red particles on enemy damage */
  bloodSplat(x, y) {
    return this.burst(x, y, 'particle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      quantity: 4,
      tint: 0xff2222,
      gravityY: 50
    });
  }

  /** Larger red/orange burst on enemy death */
  deathBurst(x, y) {
    return this.burst(x, y, 'particle', {
      speed: { min: 60, max: 120 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: 12,
      tint: [0xff2222, 0xff6600, 0xff4400]
    });
  }

  /** Red flash particles when player takes damage */
  playerHit(x, y) {
    return this.burst(x, y, 'particle', {
      speed: { min: 40, max: 80 },
      scale: { start: 0.4, end: 0 },
      lifespan: 250,
      quantity: 8,
      tint: 0xff0000
    });
  }

  /** Gold sparkle on loot pickup */
  lootSparkle(x, y) {
    return this.burst(x, y, 'particle_soft', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.4, end: 0 },
      lifespan: 500,
      quantity: 5,
      tint: 0xffd700,
      gravityY: -40
    });
  }

  /** Colored trail for abilities */
  abilityTrail(x, y, color) {
    return this.burst(x, y, 'particle_soft', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.35, end: 0 },
      lifespan: 150,
      quantity: 3,
      tint: color || 0x00ffff
    });
  }

  /** Camera shake helper */
  screenShake(duration, intensity) {
    const cam = this.scene.cameras?.main;
    if (cam) {
      cam.shake(duration, intensity);
    }
  }
}

// Expose globally
window.ParticleFactory = ParticleFactory;
