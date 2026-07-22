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

    // Reduced effects mode: halve particle count (037-mobile-performance)
    if (window.__REDUCED_EFFECTS__) {
      config = Object.assign({}, config);
      config.quantity = Math.max(1, Math.floor((config.quantity || 6) / 2));
    }

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

  /**
   * Grosser Boss-Tod-Effekt: mehrere Partikel-Wellen, zwei expandierende
   * Schockwellen-Ringe, weisser Kamera-Blitz und längeres Beben. Deutlich
   * wuchtiger als deathBurst (den normale Gegner bekommen), damit ein
   * Boss-Kill sich als Ereignis anfühlt. `color` färbt Partikel + Ringe
   * je Boss ein (Kettenmeister grau, Zeremonienmeister violett, Schattenrat rot).
   */
  bossDeath(x, y, color) {
    const scene = this.scene;
    if (!scene || !scene.add) return;
    const tint = (typeof color === 'number') ? color : 0xff3322;

    // 1) Kamera: Blitz + kräftiges, langes Beben.
    const cam = scene.cameras && scene.cameras.main;
    if (cam) {
      if (cam.flash) cam.flash(400, 255, 240, 220, true);
      if (cam.shake) cam.shake(650, 0.014);
    }

    // 2) Partikel: eine grosse, weit streuende Welle + ein späterer Nachschlag.
    this.burst(x, y, 'particle', {
      speed: { min: 120, max: 320 },
      scale: { start: 1.6, end: 0 },
      lifespan: 750,
      quantity: 44,
      tint: [tint, 0xffcc44, 0xffffff]
    });
    scene.time.delayedCall(140, () => {
      if (scene.add) this.burst(x, y, 'particle', {
        speed: { min: 40, max: 160 },
        scale: { start: 1.1, end: 0 },
        lifespan: 900,
        quantity: 26,
        tint: [tint, 0x662222]
      });
    });

    // 3) Zwei expandierende Schockwellen-Ringe (Graphics, getweent + aufgeräumt).
    const ring = (delay, maxR, width) => {
      scene.time.delayedCall(delay, () => {
        if (!scene.add) return;
        const g = scene.add.graphics().setDepth(1600);
        const state = { r: 8, a: 0.9 };
        scene.tweens.add({
          targets: state,
          r: maxR,
          a: 0,
          duration: 520,
          ease: 'Cubic.Out',
          onUpdate: () => {
            if (!g.active) return;
            g.clear();
            g.lineStyle(width, tint, state.a);
            g.strokeCircle(x, y, state.r);
          },
          onComplete: () => { try { g.destroy(); } catch (e) {} }
        });
      });
    };
    ring(0, 180, 6);
    ring(120, 130, 4);
  }
}

// Expose globally
window.ParticleFactory = ParticleFactory;
