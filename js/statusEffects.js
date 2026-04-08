// statusEffects.js — Status Effect System for Demonfall
// Manages poison, stun, slow, and bleed effects on player and enemies.

const StatusEffectType = {
  POISON: 'poison',
  STUN: 'stun',
  SLOW: 'slow',
  BLEED: 'bleed'
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
  constructor(type, source) {
    const cfg = STATUS_EFFECT_CONFIG[type];
    this.type = type;
    this.duration = cfg.duration;
    // Apply source-specific duration override if any
    const overrides = STATUS_EFFECT_SOURCE_OVERRIDES[type === StatusEffectType.STUN ? 'STUN' : ''];
    if (overrides && source && Number.isFinite(overrides[source])) {
      this.duration = overrides[source];
    }
    this.tickInterval = cfg.tickInterval;
    this.damage = cfg.damage;
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
  }

  applyEffect(target, effectType, source) {
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
    } else {
      targetEffects.set(effectType, new StatusEffect(effectType, source));
      this._applyVisual(target, effectType);
    }
  }

  removeEffect(target, effectType) {
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

  _applyVisual(target, effectType) {
    if (!target || !target.setTint) return;
    const cfg = STATUS_EFFECT_CONFIG[effectType];
    if (cfg?.tint) {
      target.setTint(cfg.tint);
    }
  }

  _refreshVisual(target) {
    if (!target || !target.setTint) return;
    if (!this._effects.has(target) || this._effects.get(target).size === 0) {
      this._clearVisual(target);
      return;
    }
    // Apply tint of the first active effect (priority order)
    const priority = [StatusEffectType.STUN, StatusEffectType.POISON, StatusEffectType.BLEED, StatusEffectType.SLOW];
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
    // Restore original tint for enemies
    if (target !== player && target._originalTint !== undefined) {
      target.setTint(target._originalTint);
    } else if (target === player) {
      target.clearTint();
    } else {
      target.clearTint();
    }
  }
}

// Create global instance
window.statusEffectManager = new StatusEffectManager();
window.StatusEffectType = StatusEffectType;
window.STATUS_EFFECT_CONFIG = STATUS_EFFECT_CONFIG;
