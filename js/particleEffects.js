/**
 * ParticleFactory - Reusable particle effect system for Demonfall
 * Uses Phaser 3.60+ particle API
 */
// #183: Pixelpartikel je Zweck statt zweier weicher Punkte — nur mit
// ?partikel=neu. Alle Formen liegen in EINER Bildtafel (16x16 je Bild, eine
// Zeile je Zweck), damit es bei einem Zeichenaufruf bleibt. Die Emitter und
// ihre Teilchenzahl bleiben genau dieselben; getauscht werden nur Bild,
// Groesse und — wo das Bild seine Farbe selbst traegt — die Toenung.
const PARTIKEL_ATLAS = 'partikel_atlas';
const PARTIKEL_SPALTEN = 8;    // Bilder je Zeile der Tafel
// Zeile der Tafel und Anzahl Bilder darin. `toenen`: das Bild ist hell und
// grau gezeichnet und nimmt die Farbe des Aufrufers an (Faehigkeiten, Bosse).
const PARTIKEL_ZWECKE = {
  funken:       { zeile: 0, n: 6 },
  blut:         { zeile: 1, n: 6 },
  daemonenblut: { zeile: 2, n: 6 },
  splitter:     { zeile: 3, n: 6, toenen: true },
  glut:         { zeile: 4, n: 6 },
  staub:        { zeile: 5, n: 6, toenen: true },
  magie:        { zeile: 6, n: 6, toenen: true },
  frost:        { zeile: 7, n: 6 },
  glanz:        { zeile: 8, n: 6 },
  holz:         { zeile: 9, n: 6 },   // Spaene und Brettsplitter (Fass, Kiste, Truhe)
  metall:       { zeile: 10, n: 6 }   // Eisenstuecke (Feuerschale)
};

// Woraus ein zerschlagbares Prop besteht (Typ-Anfang -> Material). Ein Fass
// blutet nicht: mit ?partikel=neu fliegt, was es wirklich ist.
const OBJEKT_MATERIAL = [
  ['barrel', 'holz'], ['crate', 'holz'], ['chest', 'holz'],
  ['rubble', 'stein'], ['statue', 'stein'], ['pillar', 'stein'], ['altar', 'stein'],
  ['brazier', 'metall'], ['brazer', 'metall']
];
// Material -> Zwecke der Tafel und Toenung (nur die grauen Bilder nehmen sie an).
const MATERIAL_BILD = {
  holz:   { zwecke: ['holz'] },
  stein:  { zwecke: ['splitter', 'staub'], tint: [0x8a8478, 0x6e685e, 0xa49c8c] },
  metall: { zwecke: ['metall', 'funken'] },
  staub:  { zwecke: ['staub'], tint: [0x8a8478, 0x6e685e] }
};

function objektMaterial(typ) {
  const t = String(typ || '').toLowerCase();
  for (let i = 0; i < OBJEKT_MATERIAL.length; i++) {
    if (t.indexOf(OBJEKT_MATERIAL[i][0]) === 0) return OBJEKT_MATERIAL[i][1];
  }
  return 'staub';
}
// Die alten Punkte sind 8 px gross, die neuen Bilder 16 px. Ganz auf 8 px
// heruntergerechnet waere von der Form nichts mehr zu sehen; etwas groesser
// als vorher, damit Funke und Tropfen als solche lesbar sind.
const PARTIKEL_MASS = 0.75;

// Faehigkeitsfarben, die ein eigenes Bild haben. Alles andere wird zu
// getoenten Splittern — die Farbe bleibt die des Aufrufers.
const SPUR_ZWECK = {
  0xff7a1a: 'glut',   // Raserei, Feuerstoss
  0x9fe8ff: 'frost',  // Frostnova
  0x66ccff: 'frost'   // Eisschritt
};

function partikelNeuAn(scene) {
  if (!(window.DebugGate && window.DebugGate.an('partikel'))) return false;
  return !!(scene && scene.textures && scene.textures.exists(PARTIKEL_ATLAS));
}

/** Die Bildnummern eines oder mehrerer Zwecke in der Tafel. */
function partikelBilder(zwecke) {
  const out = [];
  zwecke.forEach((z) => {
    const d = PARTIKEL_ZWECKE[z];
    if (!d) return;
    for (let i = 0; i < d.n; i++) out.push(d.zeile * PARTIKEL_SPALTEN + i);
  });
  return out;
}

/** Skaliert {start,end} oder eine Zahl. */
function partikelSkala(scale, f) {
  if (typeof scale === 'number') return scale * f;
  if (scale && typeof scale === 'object') {
    const out = Object.assign({}, scale);
    if (typeof out.start === 'number') out.start *= f;
    if (typeof out.end === 'number') out.end *= f;
    return out;
  }
  return scale;
}

class ParticleFactory {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Create a one-shot burst of particles at a position, auto-cleanup after done.
   * `zweck` (#183) waehlt mit ?partikel=neu das Pixelbild; ohne Flagge bleibt
   * es beim uebergebenen Punkt.
   */
  burst(x, y, textureKey, config, zweck) {
    const scene = this.scene;
    if (!scene || !scene.add) return null;

    if (zweck && partikelNeuAn(scene)) {
      const zwecke = [].concat(zweck);
      const bilder = partikelBilder(zwecke);
      if (bilder.length) {
        config = Object.assign({}, config);
        textureKey = PARTIKEL_ATLAS;
        config.frame = bilder;
        config.scale = partikelSkala(config.scale, PARTIKEL_MASS);
        // Ein Blutstropfen in Gold getoent waere keiner mehr.
        if (!zwecke.some((z) => PARTIKEL_ZWECKE[z].toenen)) delete config.tint;
        // Funken und Splitter fliegen nicht alle gleich ausgerichtet; eine
        // Staubwolke hat keine Richtung.
        if (zwecke.indexOf('staub') < 0) config.rotate = { min: 0, max: 360 };
      }
    }

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
    }, 'funken');
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
    }, 'blut');
  }

  /** Larger red/orange burst on enemy death */
  deathBurst(x, y) {
    return this.burst(x, y, 'particle', {
      speed: { min: 60, max: 120 },
      scale: { start: 0.8, end: 0 },
      lifespan: 400,
      quantity: 12,
      tint: [0xff2222, 0xff6600, 0xff4400]
    }, ['daemonenblut', 'splitter']);
  }

  /** Red flash particles when player takes damage */
  playerHit(x, y) {
    const config = {
      speed: { min: 40, max: 80 },
      scale: { start: 0.4, end: 0 },
      lifespan: 250,
      quantity: 8,
      tint: 0xff0000
    };
    const neu = partikelNeuAn(this.scene);
    if (neu) {
      // Bisher flogen die Tropfen auf Tiefe 0 HINTER der Spielerfigur (100)
      // los und waren weg, bevor sie unter ihr hervorkamen. Jetzt spritzen
      // sie weiter, fallen und liegen VOR der Figur.
      config.speed = { min: 70, max: 130 };
      config.scale = { start: 0.6, end: 0.1 };
      config.lifespan = 380;
      config.gravityY = 260;
    }
    const e = this.burst(x, y, 'particle', config, 'blut');
    const p = (typeof player !== 'undefined') ? player : null;
    if (neu && e && e.setDepth) e.setDepth(((p && p.depth) || 100) + 1);
    return e;
  }

  /**
   * Ein zerschlagenes Prop. Ohne ?partikel=neu genau der alte Gegnertod;
   * mit Flagge Splitter aus dem Material des Props (OBJEKT_MATERIAL), kein
   * Blut. Gleiche Teilchenzahl wie deathBurst.
   */
  objektBricht(x, y, typ) {
    if (!partikelNeuAn(this.scene)) return this.deathBurst(x, y);
    const m = MATERIAL_BILD[objektMaterial(typ)];
    const config = {
      speed: { min: 60, max: 130 },
      scale: { start: 0.8, end: 0.2 },
      lifespan: 450,
      quantity: 12,
      gravityY: 220
    };
    if (m.tint) config.tint = m.tint;
    return this.burst(x, y, 'particle', config, m.zwecke);
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
    }, 'glanz');
  }

  /** Colored trail for abilities */
  abilityTrail(x, y, color) {
    return this.burst(x, y, 'particle_soft', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.35, end: 0 },
      lifespan: 150,
      quantity: 3,
      tint: color || 0x00ffff
    }, SPUR_ZWECK[color] || 'magie');
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
    }, 'splitter');
    scene.time.delayedCall(140, () => {
      if (scene.add) this.burst(x, y, 'particle', {
        speed: { min: 40, max: 160 },
        scale: { start: 1.1, end: 0 },
        lifespan: 900,
        quantity: 26,
        tint: [tint, 0x662222]
      }, 'staub');
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
window.PARTIKEL_ZWECKE = PARTIKEL_ZWECKE;
window.partikelNeuAn = partikelNeuAn;
window.objektMaterial = objektMaterial;
