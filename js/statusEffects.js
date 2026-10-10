// statusEffects.js — Status Effect System for Demonfall
// Manages poison, stun, slow, and bleed effects on player and enemies.

const StatusEffectType = {
  POISON: 'poison',
  STUN: 'stun',
  SLOW: 'slow',
  BLEED: 'bleed',
  BURNED: 'burned'
};

const STATUS_EFFECT_CONFIG = {
  [StatusEffectType.POISON]: {
    duration: 5000,       // 5 seconds
    tickInterval: 1000,   // damage every 1 second
    damage: 2,            // 2 dmg per tick
    tint: 0x44ff44,       // green
    stackable: true,
    maxStacks: 3
  },
  [StatusEffectType.STUN]: {
    duration: 1500,       // 1.5 seconds
    tickInterval: 0,
    damage: 0,
    tint: 0xffff00,       // yellow
    stackable: false,
    maxStacks: 1
  },
  [StatusEffectType.SLOW]: {
    duration: 3000,       // 3 seconds
    tickInterval: 0,
    damage: 0,
    speedReduction: 0.5,  // 50% speed reduction
    tint: 0x4488ff,       // blue
    stackable: false,
    maxStacks: 1
  },
  [StatusEffectType.BLEED]: {
    duration: 4000,       // 4 seconds (was 8)
    tickInterval: 1000,   // damage every 1 second
    damage: 1,            // 1 dmg per tick
    tint: 0xff4444,       // red
    stackable: true,
    maxStacks: 2          // max 2 stacks (was 5)
  },
  [StatusEffectType.BURNED]: {
    // Visuell analog zu BLEED (gleiche Tick-Kadenz + Stack-Verhalten, damit der
    // Tint-Flash ruhig statt hektisch wirkt) — nur wärmer getönt (Feuer).
    duration: 4000,       // wie bleed
    tickInterval: 1000,   // wie bleed (1s) statt hektischem Schnellticken
    damage: 2,            // Feuer trifft etwas härter als Blutung (1)
    tint: 0xff5a1e,       // orange-rot (Feuer), flasht wie bleeds Rot
    stackable: true,
    maxStacks: 2          // wie bleed
  }
};

// Per-source duration overrides — lets specific attackers apply shorter or
// longer status effects than the global default. Source key is the third
// argument passed to applyEffect().
const STATUS_EFFECT_SOURCE_OVERRIDES = {
  STUN: {
    brute: 600    // brute melee stun is short — was 1500ms global default
  }
};

class StatusEffect {
  /**
   * @param {string} type
   * @param {string} source
   * @param {number} [schadenJeTick]  ueberschreibt den Wert aus der Tabelle
   */
  constructor(type, source, schadenJeTick) {
    const cfg = STATUS_EFFECT_CONFIG[type];
    this.type = type;
    this.duration = cfg.duration;
    // Apply source-specific duration override if any
    const overrides = STATUS_EFFECT_SOURCE_OVERRIDES[type === StatusEffectType.STUN ? 'STUN' : ''];
    if (overrides && source && Number.isFinite(overrides[source])) {
      this.duration = overrides[source];
    }
    this.tickInterval = cfg.tickInterval;
    // Der Schaden je Tick kann vom Ausloeser kommen. Die Giftklinge braucht
    // das: ihre 2 flachen Punkte waren fruehe Uebermacht und spaeter belanglos,
    // weil sie weder mit der Tiefe noch mit der Ausruestung wuchsen.
    this.damage = Number.isFinite(schadenJeTick) && schadenJeTick > 0
      ? schadenJeTick : cfg.damage;
    this.stacks = 1;
    this.maxStacks = cfg.maxStacks;
    this.stackable = cfg.stackable;
    this.source = source || null;
    this.startTime = Date.now();
    this.lastTickTime = this.startTime;
    this.tint = cfg.tint;
    this.speedReduction = cfg.speedReduction || 0;
  }

  get remaining() {
    return Math.max(0, this.duration - (Date.now() - this.startTime));
  }

  get isExpired() {
    return this.remaining <= 0;
  }
}

class StatusEffectManager {
  constructor() {
    // Map<target, Map<effectType, StatusEffect>>
    this._effects = new Map();
    // Map<target, Sprite>: die Flamme auf einer brennenden Figur (#173).
    // Vorher war Brand nur ein orangener Farbstich — und der wird bei vielen
    // Figuren jeden Frame von der Animation ueberschrieben.
    this._flammen = new Map();
  }

  /**
   * @param {object} target
   * @param {string} effectType
   * @param {string} source
   * @param {number} [schadenJeTick]  ueberschreibt den Tabellenwert
   */
  applyEffect(target, effectType, source, schadenJeTick) {
    if (!target || !effectType) return;
    const cfg = STATUS_EFFECT_CONFIG[effectType];
    if (!cfg) return;

    if (!this._effects.has(target)) {
      this._effects.set(target, new Map());
    }
    const targetEffects = this._effects.get(target);

    if (targetEffects.has(effectType)) {
      const existing = targetEffects.get(effectType);
      if (existing.stackable && existing.stacks < existing.maxStacks) {
        existing.stacks++;
        existing.startTime = Date.now(); // refresh duration
        existing.lastTickTime = Date.now();
      } else {
        // refresh duration
        existing.startTime = Date.now();
        existing.lastTickTime = Date.now();
      }
      // Der staerkere Wert gewinnt beim Auffrischen: sonst wuerde ein
      // schwaecherer Ausloeser (Falle, anderer Gegner) das Gift der Klinge
      // stillschweigend entwerten.
      if (Number.isFinite(schadenJeTick) && schadenJeTick > existing.damage) {
        existing.damage = schadenJeTick;
      }
    } else {
      targetEffects.set(effectType, new StatusEffect(effectType, source, schadenJeTick));
      this._applyVisual(target, effectType);
      if (effectType === StatusEffectType.BURNED) this._flammeAn(target);
    }
  }

  removeEffect(target, effectType) {
    if (effectType === StatusEffectType.BURNED) this._flammeAus(target);
    if (!this._effects.has(target)) return;
    const targetEffects = this._effects.get(target);
    targetEffects.delete(effectType);

    if (targetEffects.size === 0) {
      this._effects.delete(target);
      this._clearVisual(target);
    } else {
      // reapply tint from remaining highest-priority effect
      this._refreshVisual(target);
    }
  }

  removeAllEffects(target) {
    this._flammeAus(target);
    if (!this._effects.has(target)) return;
    this._effects.delete(target);
    this._clearVisual(target);
  }

  updateEffects(delta) {
    const now = Date.now();
    const toRemove = [];

    this._effects.forEach((targetEffects, target) => {
      // Skip destroyed or inactive targets
      if (!target || (target.active !== undefined && !target.active)) {
        toRemove.push({ target, effectType: null, removeAll: true });
        return;
      }

      targetEffects.forEach((effect, effectType) => {
        if (effect.isExpired) {
          toRemove.push({ target, effectType, removeAll: false });
          return;
        }

        // Apply tick damage (poison, bleed)
        if (effect.tickInterval > 0 && effect.damage > 0) {
          if (now - effect.lastTickTime >= effect.tickInterval) {
            effect.lastTickTime = now;
            const totalDamage = effect.damage * effect.stacks;
            this._applyTickDamage(target, totalDamage, effectType);
          }
        }
      });
    });

    // Clean up expired effects
    for (const entry of toRemove) {
      if (entry.removeAll) {
        this._effects.delete(entry.target);
      } else {
        this.removeEffect(entry.target, entry.effectType);
      }
    }
    this._flammenNachfuehren();
  }

  /**
   * Flammen den Figuren nachfuehren — einmal je Bild. Steht hinter dem
   * Aufraeumen, damit eine gerade erloschene Flamme nicht noch einmal
   * gesetzt wird. Hier verschwindet auch die Flamme einer Figur, die
   * gestorben oder entfernt ist — egal, ob sie noch andere Effekte traegt.
   */
  _flammenNachfuehren() {
    this._flammen.forEach((f, target) => {
      if (!f || !f.active || !target || target.active === false) { this._flammeAus(target); return; }
      const l = this._flammenLage(target);
      f.setPosition(l.x, l.fuss);
      f.setDepth((target.depth || 0) + 1);
      f.setVisible(target.visible !== false);
    });
  }

  /**
   * Wo und wie gross: ueber dem unteren Teil der Figur. Gemessen am
   * Bildrahmen der Figur — die Gegnerbilder sind seit b314 eng auf die Figur
   * zugeschnitten (tools/gegnerBauen.js), die Fuesse stehen am unteren Rand.
   *
   * Die Groesse richtet sich nach der HOEHE der Figur, nicht nach ihrer
   * Breite: die Flammen sind breit und flach (51x29). Nach der Breite
   * bemessen kam auf dem 24 px schmalen Spieler eine Flamme von 19x11 px
   * heraus — ein Flackern an den Fuessen.
   */
  _flammenLage(target) {
    const b = target.getBounds ? target.getBounds() : null;
    if (!b) return { x: target.x, fuss: target.y, hoehe: 24, maxBreite: 40 };
    return {
      x: b.centerX,
      fuss: b.bottom - b.height * 0.05,
      hoehe: b.height * 0.5,          // bis etwa zur Huefte
      maxBreite: b.width * 1.6        // und nicht viel breiter als die Figur
    };
  }

  _flammeAn(target) {
    if (!target || this._flammen.has(target)) return;
    const scene = target.scene;
    const f = (scene && typeof window !== 'undefined' && typeof window.brandFlamme === 'function')
      ? window.brandFlamme(scene) : null;
    if (!f) return;                       // ohne Bilder bleibt es beim Farbstich
    const l = this._flammenLage(target);
    f.setScale(Math.min(l.hoehe / (f.height || 1), l.maxBreite / (f.width || 1)));
    f.setAlpha(0.92);
    f.setPosition(l.x, l.fuss);
    f.setDepth((target.depth || 0) + 1);
    this._flammen.set(target, f);
  }

  _flammeAus(target) {
    const f = this._flammen.get(target);
    if (!f) return;
    this._flammen.delete(target);
    if (f.active && typeof f.destroy === 'function') f.destroy();
  }

  getActiveEffects(target) {
    if (!this._effects.has(target)) return [];
    const result = [];
    this._effects.get(target).forEach((effect, type) => {
      result.push({ type, effect });
    });
    return result;
  }

  hasEffect(target, effectType) {
    if (!this._effects.has(target)) return false;
    return this._effects.get(target).has(effectType);
  }

  isStunned(target) {
    return this.hasEffect(target, StatusEffectType.STUN);
  }

  getSpeedMultiplier(target) {
    if (!this.hasEffect(target, StatusEffectType.SLOW)) return 1;
    const effect = this._effects.get(target).get(StatusEffectType.SLOW);
    return 1 - (effect.speedReduction || 0.5);
  }

  _applyTickDamage(target, damage, effectType) {
    if (!target) return;

    // Is this the player?
    if (target === player) {
      if (typeof addPlayerHealth === 'function') {
        addPlayerHealth(-damage);
      } else if (typeof playerHealth !== 'undefined') {
        playerHealth = Math.max(0, playerHealth - damage);
      }
      // #183: eine Blutung tropft sichtbar. Brand und Gift bleiben bei der
      // Toenung — die sind kein Blut.
      if (effectType === StatusEffectType.BLEED && window.particleFactory) {
        window.particleFactory.playerHit(target.x, target.y);
      }
      // Flash tint for DoT
      if (target.setTint && target.active) {
        const tintColor = STATUS_EFFECT_CONFIG[effectType]?.tint || 0xff0000;
        target.setTint(tintColor);
        const scene = target.scene;
        if (scene?.time?.delayedCall) {
          scene.time.delayedCall(150, () => {
            if (target && target.active) this._refreshVisual(target);
          });
        }
      }
    } else {
      // Enemy target
      if (typeof target.hp === 'number') {
        target.hp -= damage;
        if (target.hp <= 0 && target.active) {
          // Trigger enemy death via existing logic
          if (typeof handleEnemyHit === 'function') {
            const scene = target.scene || window.currentScene;
            handleEnemyHit(scene, target, { tint: STATUS_EFFECT_CONFIG[effectType]?.tint || 0xff0000, duration: 100 });
          }
        }
      }
    }
  }

  // ACHTUNG, gemessen (#95): am SPIELER haelt diese Faerbung nicht. Direkt nach
  // applyEffect steht sie da (#4488ff, isTinted true), einen Frame spaeter ist
  // sie weg — und zwar OHNE dass clearTint gerufen wird, am selben Objekt und
  // bei gleicher Textur. Etwas im Animationspfad setzt sie zurueck.
  //
  // Die sichtbare Rueckmeldung am Spieler ist darum ein eigener Bodenring
  // (updateStatusRing in main.js): ein eigenes Anzeigeobjekt kann kein
  // Toenungs-Zugriff erreichen. An GEGNERN funktioniert die Faerbung weiterhin.
  _applyVisual(target, effectType) {
    if (!target || !target.setTint) return;
    const cfg = STATUS_EFFECT_CONFIG[effectType];
    if (cfg?.tint) {
      target.setTint(cfg.tint);
    }
  }

  /**
   * Setzt die Statusfarbe neu — oeffentlich, weil die Spieler-Animation die
   * Toenung jeden Frame loescht und sie danach wiederherstellen muss.
   */
  refreshVisual(target) { this._refreshVisual(target); }

  _refreshVisual(target) {
    if (!target || !target.setTint) return;
    if (!this._effects.has(target) || this._effects.get(target).size === 0) {
      this._clearVisual(target);
      return;
    }
    // Apply tint of the first active effect (priority order)
    // BURNED fehlte hier: ein brennender Gegner fiel durch die Schleife und
    // landete in _clearVisual — die Glutschale (#124) faerbte also nie.
    const priority = [StatusEffectType.STUN, StatusEffectType.POISON,
      StatusEffectType.BURNED, StatusEffectType.BLEED, StatusEffectType.SLOW];
    const targetEffects = this._effects.get(target);
    for (const type of priority) {
      if (targetEffects.has(type)) {
        target.setTint(STATUS_EFFECT_CONFIG[type].tint);
        return;
      }
    }
    this._clearVisual(target);
  }

  _clearVisual(target) {
    if (!target || !target.clearTint) return;
    // Grundton zurueck — aber NUR, wenn es einen gibt.
    //
    // Gemessen: enemy._originalTint ist bei allen Sprite-Gegnern NULL (nur die
    // Rechteck-Rueckfaelle tragen eine Farbe, s. enemy.js createEnemy). Die
    // Pruefung stand auf "!== undefined", und null besteht sie. Phaser macht
    // aus setTint(null) SCHWARZ: der Standardwert 0xffffff greift nur bei
    // undefined, und GetColorFromValue(null) ist 0.
    //
    // Sichtbar wurde das beim Krit-Blitz: der ruft clearTint und danach
    // _toenungNachBlitz (player.js), das hier landet, wenn kein Statuseffekt
    // laeuft — der Gegner blieb schwarz stehen.
    if (target !== player && typeof target._originalTint === 'number') {
      target.setTint(target._originalTint);
      return;
    }
    target.clearTint();
  }
}

// Create global instance
window.statusEffectManager = new StatusEffectManager();
window.StatusEffectType = StatusEffectType;
window.STATUS_EFFECT_CONFIG = STATUS_EFFECT_CONFIG;
