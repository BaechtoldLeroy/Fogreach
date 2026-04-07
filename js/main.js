// ==================================================
// 1) CONFIG & STARTUP
// ==================================================
const GameScene = {
  key: 'GameScene',
  preload,
  create,
  update
};
const config = {
  pixelArt: true,
  roundPixels: true,
  input: { activePointers: 2 },
  type: Phaser.AUTO,
  parent: 'game-container',
  render: { pixelArt: true, antialias: false, roundPixels: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,     // Canvas-Breite (Player 72px = 15% von 480px)
    height: 480     // Canvas-Höhe
  },
  backgroundColor: '#2d2d2d',
  physics: {
    default: 'arcade',
    fps: 60,
    arcade: { gravity: { y: 0 }, debug: false, overlapBias: 8, tileBias: 32 }
  },
  scene: [StartScene, HubSceneV2, CraftingScene, TestTerrainScene, GameScene],
  plugins: {
    global: [{
      key: 'rexVirtualJoystick',
      plugin: rexvirtualjoystickplugin,
      start: true
    }]
  }
};

let game = new Phaser.Game(config);
const WORLD_RIGHT_PADDING = 256;

// Development flag: enable room template profiling logs by default.
if (typeof window !== 'undefined') {
  if (typeof window.__DEV_ROOM_PROFILING__ === 'undefined') {
    window.__DEV_ROOM_PROFILING__ = true;
  }
  if (typeof window.__DEV_SKIP_FLOOR_TILES__ === 'undefined') {
    window.__DEV_SKIP_FLOOR_TILES__ = false;
  }
  if (typeof window.__DEV_SKIP_WALL_OBSTACLES__ === 'undefined') {
    window.__DEV_SKIP_WALL_OBSTACLES__ = false;
  }
  window.gotoTestTerrainScene = () => {
    if (!game) return;
    game.scene.stop('StartScene');
    game.scene.start('TestTerrainScene', { source: 'gotoTestTerrainScene' });
  };
  if (window.__DEV_AUTO_TEST_TERRAIN__ === true) {
    setTimeout(() => window.gotoTestTerrainScene(), 50);
  }
}

if (typeof window !== 'undefined' && !window.__GLOBAL_ERROR_LOGGER__) {
  window.addEventListener('error', (evt) => {
    try {
      console.error('[GlobalError]', {
        message: evt.message,
        filename: evt.filename,
        lineno: evt.lineno,
        colno: evt.colno,
        error: evt.error?.stack
      });
    } catch (err) {
      console.warn('[GlobalError] failed to log', err);
    }
  });
  window.__GLOBAL_ERROR_LOGGER__ = true;
}

if (typeof Phaser !== 'undefined' && Phaser?.GameObjects?.Container && !Phaser.GameObjects.Container.__debugUndefinedPatch) {
  const originalPreDestroy = Phaser.GameObjects.Container.prototype.preDestroy;
  Phaser.GameObjects.Container.prototype.preDestroy = function patchedPreDestroy() {
    if (Array.isArray(this.list) && this.list.length) {
      const copy = this.list.slice();
      this.list.length = 0;
      copy.forEach((child, idx) => {
        if (!child) {
          return;
        }
        if (typeof child.destroy === 'function') {
          try {
            child.destroy();
          } catch (err) {
            console.warn('[Container preDestroy] child destroy failed', {
              container: this.name || this.type || 'Container',
              index: idx,
              error: err
            });
          }
        } else if (child && typeof child.removeFromDisplayList === 'function') {
          try {
            child.removeFromDisplayList();
          } catch (err) {
            console.warn('[Container preDestroy] child remove failed', {
              container: this.name || this.type || 'Container',
              index: idx,
              error: err
            });
          }
        }
      });
    }
    let result;
    try {
      result = originalPreDestroy.call(this);
    } catch (err) {
      console.error('[Container preDestroy] original preDestroy failed', {
        container: this.name || this.type || this.constructor?.name || 'Container',
        error: err
      });
    }
    return result;
  };
  Phaser.GameObjects.Container.__debugUndefinedPatch = true;
}

if (typeof Phaser !== 'undefined' && Phaser?.GameObjects?.Sprite && !Phaser.GameObjects.Sprite.__safePreDestroy) {
  Phaser.GameObjects.Sprite.prototype.preDestroy = function safeSpritePreDestroy() {
    if (this.anims && typeof this.anims.destroy === 'function') {
      try {
        this.anims.destroy();
      } catch (err) {
        console.warn('[Sprite preDestroy] anims.destroy failed', {
          texture: this.texture?.key,
          frame: this.frame?.name,
          scene: this.scene?.sys?.settings?.key,
          error: err
        });
      }
    } else if (this.anims !== undefined) {
      console.warn('[Sprite preDestroy] missing anims.destroy', {
        texture: this.texture?.key,
        frame: this.frame?.name,
        scene: this.scene?.sys?.settings?.key
      });
    }
    this.anims = undefined;
  };
  Phaser.GameObjects.Sprite.__safePreDestroy = true;
}

if (typeof Phaser !== 'undefined' && Phaser?.GameObjects?.GameObject && !Phaser.GameObjects.GameObject.__safeRemoveFromDisplayList) {
  Phaser.GameObjects.GameObject.prototype.removeFromDisplayList = function safeRemoveFromDisplayList() {
    const scene = this.scene;
    const displayList = this.displayList || scene?.sys?.displayList;
    const gameObjectEvents = Phaser?.GameObjects?.Events;
    const sceneEvents = Phaser?.Scenes?.Events;

    if (!displayList || typeof displayList.remove !== 'function') {
      this.displayList = null;
      return this;
    }

    let removed = false;
    try {
      if (typeof displayList.exists === 'function' ? displayList.exists(this) : true) {
        displayList.remove(this, true);
        removed = true;
      }
    } catch (err) {
      console.warn('[GameObject removeFromDisplayList] failed', {
        name: this.name || this.type,
        scene: scene?.sys?.settings?.key,
        error: err
      });
    }

    if (removed && typeof displayList.queueDepthSort === 'function') {
      displayList.queueDepthSort();
    }

    this.displayList = null;

    if (scene?.sys?.events) {
      if (gameObjectEvents?.REMOVED_FROM_SCENE) {
        this.emit?.(gameObjectEvents.REMOVED_FROM_SCENE, this, scene);
      }
      if (sceneEvents?.REMOVED_FROM_SCENE) {
        scene.sys.events.emit?.(sceneEvents.REMOVED_FROM_SCENE, this, scene);
      }
    }

    return this;
  };
  Phaser.GameObjects.GameObject.__safeRemoveFromDisplayList = true;
}

if (typeof Phaser !== 'undefined' && Phaser?.GameObjects?.Container && !Phaser.GameObjects.Container.__guardedDestroy) {
  const originalDestroy = Phaser.GameObjects.Container.prototype.destroy;
  Phaser.GameObjects.Container.prototype.destroy = function guardedDestroy(fromScene) {
    try {
      return originalDestroy.call(this, fromScene);
    } catch (err) {
      console.error('[Container destroy] suppressed exception', {
        container: this.name || this.type || this.constructor?.name || 'Container',
        scene: this.scene?.sys?.settings?.key,
        error: err
      });
      if (Array.isArray(this.list)) {
        this.list = this.list.filter(Boolean);
      }
      Phaser.GameObjects.GameObject.prototype.destroy.call(this, fromScene);
      return this;
    }
  };
  Phaser.GameObjects.Container.__guardedDestroy = true;
}

if (typeof Phaser !== 'undefined' && Phaser?.GameObjects?.DisplayList && !Phaser.GameObjects.DisplayList.__guardedRemove) {
  const originalRemove = Phaser.GameObjects.DisplayList.prototype.remove;
  Phaser.GameObjects.DisplayList.prototype.remove = function guardedRemove(child, removeFromScene, destroyChild) {
    if (Array.isArray(child)) {
      child = child.filter(Boolean);
    } else if (!child) {
      console.warn('[DisplayList remove] child is falsy, skipping');
      return this;
    }
    try {
      return originalRemove.call(this, child, removeFromScene, destroyChild);
    } catch (err) {
      console.error('[DisplayList remove] caught error, retrying without destroy', {
        error: err,
        childType: child?.type || child?.constructor?.name || typeof child,
        stack: err?.stack
      });
      try {
        return originalRemove.call(this, child, false, false);
      } catch (err2) {
        console.error('[DisplayList remove] second attempt failed', err2);
        return this;
      }
    }
  };
  Phaser.GameObjects.DisplayList.__guardedRemove = true;
}

// ==================================================
// 2) GLOBALE VARIABLEN
// ==================================================

if (typeof window.DIFFICULTY_MULTIPLIER !== 'number' || !Number.isFinite(window.DIFFICULTY_MULTIPLIER) || window.DIFFICULTY_MULTIPLIER <= 0) {
  window.DIFFICULTY_MULTIPLIER = 1;
}

if (typeof window.getDifficultyMultiplier !== 'function') {
  window.getDifficultyMultiplier = function () {
    const value = window.DIFFICULTY_MULTIPLIER;
    return (typeof value === 'number' && Number.isFinite(value) && value > 0) ? value : 1;
  };
}

if (typeof window.ensureDebugPanel !== 'function') {
  window.__DEBUG_LOG_LINES__ = window.__DEBUG_LOG_LINES__ || [];
  window.ensureDebugPanel = function () {
    return null;
  };

  window.debugSummarizeInventory = function (arr) {
    if (!Array.isArray(arr)) return '[]';
    return arr.map((item, idx) => `${idx}:${item ? (item.name || item.key || 'item') : '-'}`).join(' | ');
  };

  window.debugSummarizeEquipment = function (eq) {
    if (!eq || typeof eq !== 'object') return '{}';
    const parts = [];
    ['weapon', 'head', 'body', 'boots'].forEach((slot) => {
      const item = eq[slot];
      parts.push(`${slot}:${item ? (item.name || item.key || 'item') : '-'}`);
    });
    return parts.join(' | ');
  };

  window.debugLog = function (section, payload) {
    try {
      const ts = new Date().toLocaleTimeString();
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const line = `[${ts}] ${section}: ${message}`;
      window.__DEBUG_LOG_LINES__.push(line);
      if (window.__DEBUG_LOG_LINES__.length > 80) {
        window.__DEBUG_LOG_LINES__ = window.__DEBUG_LOG_LINES__.slice(-80);
      }
      if (typeof console !== 'undefined' && console?.log) {
        console.log(line);
      }
    } catch (err) {
      console.warn('[debugLog] failed', err);
    }
  };
}

let player, cursors, spaceKey, rKey, eKey, qKey, fKey;
let enemies, enemyProjectiles, playerProjectiles, obstacles, lootGroup;
let attackBtn, spinBtn, chargeSlashBtn, dashSlashBtn, daggerThrowBtn, shieldBashBtn;
let attackBtnCooldownText, spinBtnCooldownText, chargeSlashCooldownText,
  dashSlashCooldownText, daggerThrowCooldownText, shieldBashCooldownText;
let weaponStatsText, playerHealthText,
  playerXPText, waveText, gameOverText, levelUpText, defeatedEnemiesInWave, joystick;
let abilityStatusDisplay = {};
let statusEffectHudIcons = []; // HUD icons for active status effects on player
const ABILITY_STATUS_STYLES = {
  attack: 0xff4d5a,
  spin: 0x4eddff,
  charge: 0xffb347,
  dash: 0x5aa9ff,
  dagger: 0xff8856,
  shield: 0x7cf8d4
};

const ABILITY_KEYS = ['attack', 'spin', 'charge', 'dash', 'dagger', 'shield'];
const ABILITY_LABELS = {
  attack: 'Basic Attack',
  spin: 'Spin Attack',
  charge: 'Charged Slash',
  dash: 'Dash Slash',
  dagger: 'Throw Dagger',
  shield: 'Shield Bash'
};

const abilityBonuses = {};
function resetAbilityBonuses() {
  Object.keys(abilityBonuses).forEach((key) => delete abilityBonuses[key]);
  ABILITY_KEYS.forEach((key) => {
    abilityBonuses[key] = { damage: 0, cooldown: 0 };
  });
}
resetAbilityBonuses();

function applyAbilityEffect(effect) {
  if (!effect || !effect.ability || !abilityBonuses[effect.ability]) return;
  const bucket = abilityBonuses[effect.ability];
  const value = Number(effect.value) || 0;
  if (effect.stat === 'damage') {
    bucket.damage = Math.min(bucket.damage + value, 2);
  } else if (effect.stat === 'cooldown') {
    bucket.cooldown = Math.min(bucket.cooldown + value, 0.85);
  }
}

window.ABILITY_LABELS = ABILITY_LABELS;
window.abilityBonuses = abilityBonuses;
window.resetAbilityBonuses = resetAbilityBonuses;
window.applyAbilityEffect = applyAbilityEffect;

const ABILITY_STATUS_CONFIG = [
  { key: 'attack', label: 'Attack', control: 'SPACE' },
  { key: 'spin', label: 'Spin Attack', control: 'SHIFT' },
  { key: 'charge', label: 'Charged Slash', control: 'E (hold)' },
  { key: 'dash', label: 'Dash Slash', control: 'Q' },
  { key: 'dagger', label: 'Throw Dagger', control: 'R' },
  { key: 'shield', label: 'Shield Bash', control: 'F' }
];

const ABILITY_STATUS_LOOKUP = ABILITY_STATUS_CONFIG.reduce((acc, entry) => {
  acc[entry.key] = entry;
  return acc;
}, {});

let pendingLoadedSave = null;
window.__DEV_FORCE_CHEAT__ = window.__DEV_FORCE_CHEAT__ || false;
let playerHealth = 30;
let playerMaxHealth = 30;
let playerXP = 0;
let playerLevel = 1;
let weaponDamage = 1;
let weaponAttackSpeed = 1.0;
let attackRange = 100;
let playerSpeed = 160;
let playerArmor = 0;
let playerCritChance = 0;
let neededXP = 2 * playerLevel;

let enemiesPerWave = 4;
let spawnInterval = 1000;
let spawnTimer = 0;
let currentWave = 0;
let spawnedEnemiesInWave = 0;
let waveInProgress = false;
let bossActive = false;
let currentBoss = null;
let fowCover, fowRT, fowMask, fowGfx;
let exploredRT;   // stores permanently revealed areas
const FOW_ALPHA = 0.9;   // darkness
const FOW_RADIUS = 220;
const LARGE_ROOM_HINT_DELAY = 60_000;

function updateAbilityStatus(key, info = {}) {
  if (typeof info === 'number') {
    info = { remainingMs: info };
  }
  const { remainingMs = 0, durationMs = null, customText = null } = info;
  const cfg = ABILITY_STATUS_LOOKUP[key];
  const display = abilityStatusDisplay[key];
  if (!cfg || !display) return;

  if (Number.isFinite(durationMs)) {
    display.durationMs = durationMs;
  }

  const duration = Number.isFinite(display.durationMs) && display.durationMs > 0
    ? display.durationMs
    : (Number.isFinite(durationMs) ? durationMs : null);

  const ready = remainingMs <= 0 && !customText;
  let statusText;
  if (typeof customText === 'string' && customText.length) {
    statusText = customText;
  } else if (!ready && remainingMs > 0) {
    statusText = `${(remainingMs / 1000).toFixed(1)}s`;
  } else {
    statusText = 'Ready';
  }

  if (display.statusText) {
    display.statusText.setText(statusText);
    display.statusText.setColor(customText ? '#ffba6b' : (ready ? '#78f3c7' : '#ffd966'));
  }

  if (display.fill && Number.isFinite(display.width)) {
    const effectiveDuration = (duration && duration > 0) ? duration : null;
    if (customText) {
      display.fill.setVisible(true);
      display.fill.displayWidth = display.width;
      display.fill.setAlpha(0.28);
    } else if (effectiveDuration) {
      const clampedRemaining = Phaser.Math.Clamp(remainingMs, 0, effectiveDuration);
      const progress = 1 - (clampedRemaining / effectiveDuration);
      if (ready) {
        display.fill.setVisible(true);
        display.fill.displayWidth = display.width;
        display.fill.setAlpha(0.16);
      } else if (progress > 0) {
        display.fill.setVisible(true);
        display.fill.displayWidth = Math.max(2, display.width * progress);
        display.fill.setAlpha(0.38);
      } else {
        display.fill.setVisible(false);
      }
    } else if (ready) {
      display.fill.setVisible(true);
      display.fill.displayWidth = display.width;
      display.fill.setAlpha(0.16);
    } else {
      display.fill.setVisible(false);
    }
  }

  if (display.bg) {
    const readyFill = ready && !customText;
    const strokeColor = display.color ?? 0x78f3c7;
    display.bg.setFillStyle(readyFill ? 0x182136 : 0x10131c, readyFill ? 0.85 : 0.65);
    display.bg.setStrokeStyle(1, readyFill ? strokeColor : 0xffffff, readyFill ? 0.5 : 0.18);
  }
}

window.updateAbilityStatus = updateAbilityStatus;

function clampPlayerHealth(value) {
  const max = Math.max(1, playerMaxHealth || 1);
  return Phaser.Math.Clamp(value ?? playerHealth, 0, max);
}

function setPlayerHealth(value, updateUi = true) {
  playerHealth = clampPlayerHealth(value);
  if (typeof window !== 'undefined') {
    window.playerHealth = playerHealth;
  }
  if (typeof window !== 'undefined') {
    window.playerMaxHealth = playerMaxHealth;
  }
  if (updateUi && typeof updateHUD === 'function') {
    updateHUD();
  } else if (updateUi && playerHealthText?.setText) {
    playerHealthText.setText(`Health: ${playerHealth}/${playerMaxHealth}`);
  }
  return playerHealth;
}

function addPlayerHealth(delta, updateUi = true) {
  if (!Number.isFinite(delta)) return playerHealth;
  return setPlayerHealth(playerHealth + delta, updateUi);
}

function setPlayerMaxHealth(value, options = {}) {
  const { preserveRatio = false, refill = false, updateUi = true } = options;
  const oldMax = Math.max(1, playerMaxHealth || 1);
  const newMax = Math.max(1, Math.round(value || oldMax));
  playerMaxHealth = newMax;
  if (typeof window !== 'undefined') {
    window.playerMaxHealth = playerMaxHealth;
  }

  if (preserveRatio) {
    const ratio = oldMax > 0 ? Phaser.Math.Clamp(playerHealth / oldMax, 0, 1) : 1;
    playerHealth = ratio * newMax;
  } else if (refill) {
    playerHealth = newMax;
  } else {
    // Maintain previous behavior: adjust by delta but clamp within bounds
    const delta = newMax - oldMax;
    if (delta !== 0) {
      playerHealth += delta;
    }
  }

  return setPlayerHealth(playerHealth, updateUi);
}

window.setPlayerHealth = setPlayerHealth;
window.addPlayerHealth = addPlayerHealth;
window.setPlayerMaxHealth = setPlayerMaxHealth;
window.clampPlayerHealth = clampPlayerHealth;

function hideEnemyDirectionIndicators(scene) {
  if (!scene) return;
  if (!Array.isArray(scene._enemyDirectionIndicators)) return;
  scene._enemyDirectionIndicators.forEach((entry) => entry?.label?.setVisible(false));
  scene._largeRoomHintShown = false;
}

function ensureEnemyDirectionIndicators(scene) {
  if (!scene) return [];
  if (Array.isArray(scene._enemyDirectionIndicators) && scene._enemyDirectionIndicators.length) {
    return scene._enemyDirectionIndicators;
  }
  const cam = scene.cameras?.main;
  if (!cam) return [];

  const style = {
    fontSize: '32px',
    fontStyle: 'bold',
    fill: '#ffef8b',
    stroke: '#000000',
    strokeThickness: 4
  };

  const positions = [
    { dir: 'north', glyph: '↑', x: cam.width / 2, y: 48 },
    { dir: 'south', glyph: '↓', x: cam.width / 2, y: cam.height - 48 },
    { dir: 'west',  glyph: '←', x: 48, y: cam.height / 2 },
    { dir: 'east',  glyph: '→', x: cam.width - 48, y: cam.height / 2 }
  ];

  const indicators = positions.map((cfg) => {
    const label = scene.add
      .text(cfg.x, cfg.y, cfg.glyph, style)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000)
      .setVisible(false);
    return { ...cfg, label };
  });

  scene._enemyDirectionIndicators = indicators;
  return indicators;
}

function updateEnemyDirectionHint(scene, now) {
  if (!scene || !scene.cameras?.main) return;

  if (!scene._largeRoomIsActive) {
    hideEnemyDirectionIndicators(scene);
    return;
  }

  const referenceTime = typeof now === 'number' ? now : scene.time?.now ?? performance.now();
  const unlockAt = Number.isFinite(scene._largeRoomHintUnlockAt)
    ? scene._largeRoomHintUnlockAt
    : (scene._largeRoomEnterTime ?? referenceTime) + LARGE_ROOM_HINT_DELAY;

  if (referenceTime < unlockAt) {
    hideEnemyDirectionIndicators(scene);
    return;
  }

  scene._largeRoomHintUnlocked = true;

  if (!player || !player.active) {
    hideEnemyDirectionIndicators(scene);
    return;
  }

  const enemyGroup = enemies;
  const activeEnemies = enemyGroup?.getChildren?.().filter((e) => e && e.active);
  if (!activeEnemies || !activeEnemies.length) {
    hideEnemyDirectionIndicators(scene);
    return;
  }

  const indicators = ensureEnemyDirectionIndicators(scene);
  if (!indicators.length) return;

  const cam = scene.cameras.main;
  const positions = {
    north: { x: cam.width / 2, y: 48 },
    south: { x: cam.width / 2, y: cam.height - 48 },
    west:  { x: 48, y: cam.height / 2 },
    east:  { x: cam.width - 48, y: cam.height / 2 }
  };

  const counts = { north: 0, south: 0, west: 0, east: 0 };
  activeEnemies.forEach((enemy) => {
    const ex = enemy.x ?? enemy.body?.x ?? 0;
    const ey = enemy.y ?? enemy.body?.y ?? 0;
    const dx = ex - player.x;
    const dy = ey - player.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) counts.east += 1;
      else counts.west += 1;
    } else {
      if (dy > 0) counts.south += 1;
      else counts.north += 1;
    }
  });

  let anyVisible = false;
  indicators.forEach((entry) => {
    const pos = positions[entry.dir];
    if (pos) entry.label.setPosition(pos.x, pos.y);
    const amount = counts[entry.dir] || 0;
    if (amount > 0) {
      const suffix = amount > 1 ? ` ${amount}` : '';
      entry.label.setText(entry.glyph + suffix);
      entry.label.setVisible(true);
      anyVisible = true;
    } else {
      entry.label.setVisible(false);
    }
  });

  scene._largeRoomHintShown = anyVisible;
}

let isMobile = false;
let isWeaponDecisionActive = false;

let isAttacking, attackCooldown;
let isSpinning = false;
let lastSpinTime = 0;
let isChargingSlash = false;
let chargeSlashCooldown = false;
let chargeSlashStartTime = 0;
let chargeSlashMaxTimer = null;
let dashSlashCooldown = false;
let daggerThrowCooldown = false;
let shieldBashCooldown = false;
let isDashing = false;
let playerDeathHandled = false;

// ==== INVENTAR & AUSRÜSTUNG ====
const INV_COLS = 5, INV_ROWS = 4;
const INV_SLOTS = INV_COLS * INV_ROWS;

let inventory = new Array(INV_SLOTS).fill(null); // Grid
let invOpen = false;
let invUI = {
  panel: null,
  slots: [],
  labels: [],
  equip: {},
  title: null,
  help: null,
  btnUse: null,
  btnEquip: null,
  btnDrop: null,
  btnClose: null,
  materialsText: null
};
let invSelected = -1;

window.inventory = inventory;


// Ausrüstungsslots wie in MMOs
let equipment = {
  weapon: null,
  head: null,
  body: null,
  boots: null
};

window.equipment = equipment;

let isReturningToHub = false;

// Spieler-Basiswerte + abgeleitete Werte aus Gear
let baseStats = { damage: 1, speed: 1.0, range: 100, maxHP: 30, move: 160, armor: 0.0, crit: 0.05 };
playerArmor = baseStats.armor;
playerCritChance = baseStats.crit;

// Tooltip (optional, simpel)
let tooltip;

// ==================================================
// 3) PRELOAD
// ==================================================
function preload() {
  if (typeof preloadPlayerDirectionalFrames === 'function') {
    preloadPlayerDirectionalFrames(this.load);
  }

  // Rathauskeller background image
  this.load.image('rathauskeller_bg', 'js/roomTemplates/rathauskeller.png');

  // nur Loot-Placeholder (wir generieren Textures im Create)
  if (!this.textures.exists('lootTexture')) {
    this.textures.generate('lootTexture', {
      data: ['.'], pixelWidth: 16, pixelHeight: 16
    });
  }
}

// ==================================================
// 4) CREATE
// ==================================================
function create() {
  playerDeathHandled = false;
  window._secondChanceUsed = false; // Reset Zweite Chance for new dungeon run
  window._playerInvincible = false; // Reset invincibility flag
  isReturningToHub = false;
  isChargingSlash = false;
  chargeSlashCooldown = false;
  chargeSlashStartTime = 0;
  if (chargeSlashMaxTimer?.remove) {
    chargeSlashMaxTimer.remove(false);
  }
  chargeSlashMaxTimer = null;
  dashSlashCooldown = false;
  daggerThrowCooldown = false;
  shieldBashCooldown = false;
  isDashing = false;
  abilityStatusDisplay = {};
  const updateWorldBounds = (width, height) => {
    const boundsWidth = width + WORLD_RIGHT_PADDING;
    this.physics.world.setBounds(0, 0, boundsWidth, height);
    this.cameras.main.setBounds(0, 0, boundsWidth, height);
  };

  updateWorldBounds(this.scale.width, this.scale.height);
  this.scale.on('resize', (gameSize) => {
    updateWorldBounds(gameSize.width, gameSize.height);
  });

  // 4.1 Vollbild & Touch-Pointer
  this.input.addPointer(1);
  /*this.input.on('pointerdown', () => {
    if (!this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }
  });*/

  // 4.2 Plattform erkennen
  isMobile = this.sys.game.device.input.touch;

  // 4.3 Keyboard-Shortcuts
  cursors = this.input.keyboard.createCursorKeys();
  spaceKey = this.input.keyboard.addKey('SPACE');
  rKey = this.input.keyboard.addKey('R');
  eKey = this.input.keyboard.addKey('E');
  qKey = this.input.keyboard.addKey('Q');
  fKey = this.input.keyboard.addKey('F');
  this.input.keyboard.on('keydown-I', () => { invOpen ? closeInventory() : openInventory(); });
  this.input.keyboard.on('keydown-M', () => {
    if (window.soundManager) window.soundManager.toggleMute();
  });

  // 4.3.1 Rathauskeller background (based on dialog selection)
  if (window.USE_RATHAUSKELLER_BG && this.textures.exists('rathauskeller_bg')) {
    this.rathauskellerBg = this.add.image(480, 240, 'rathauskeller_bg');
    this.rathauskellerBg.setDisplaySize(960, 480);
    this.rathauskellerBg.setScrollFactor(0);
    this.rathauskellerBg.setDepth(50);
    this.rathauskellerBg.setAlpha(0.85);
  }

  // 4.4 UI-Elemente initialisieren
  initUI.call(this);

  // 4.5 Touch-/Desktop-Controls
  initControls.call(this);

  // 4.6 Graphics-Texturen erzeugen und FogOfWar initialisieren
  if (typeof normalizePlayerDirectionalFrames === 'function') {
    normalizePlayerDirectionalFrames(this);
  }
  createAllGraphics.call(this);
  // Initialize particle effects system
  if (window.ParticleFactory) {
    window.particleFactory = new window.ParticleFactory(this);
  }
  this.initFogOfWar = initFogOfWar.bind(this);
  this.updateFogOfWar = updateFogOfWar.bind(this);
  this.initFogOfWar();

  // 4.65 Inventar-UI initialisieren
  initInventoryUI.call(this)

  // 4.7 Physics-Gruppen & Kollisionen
  initializeGameObjects.call(this);

  if (typeof window.DUNGEON_DEPTH !== 'number' || !isFinite(window.DUNGEON_DEPTH)) {
    window.DUNGEON_DEPTH = 1;
  }
  if (typeof window.NEXT_DUNGEON_DEPTH !== 'number' || !isFinite(window.NEXT_DUNGEON_DEPTH)) {
    window.NEXT_DUNGEON_DEPTH = window.DUNGEON_DEPTH;
  }

  // 4.8 Spielstand laden und starten
  // Räume initialisieren (einmal)
  if (typeof createRooms === 'function') createRooms();

  // Save angewendet?
  let appliedSave = null;
  if (window.pendingLoadedSave) {

    const s = window.pendingLoadedSave;
    window.pendingLoadedSave = null;

    if (typeof applySaveToState === 'function') {
      applySaveToState(this, s);
    }
    appliedSave = s;
  }

  if (window.__DEV_FORCE_CHEAT__) {
    grantCheatTestWeapon();
    window.__DEV_FORCE_CHEAT__ = false;
  } else if (!appliedSave) {
    grantCheatTestWeapon();
  }

  enterRoom(this, 0);

  // Initialize minimap after first room is loaded
  if (typeof initMinimap === 'function') initMinimap(this);

  // UI nach Save/Enter aktualisieren
  if (typeof updateHUD === 'function') updateHUD();
  else if (playerHealthText) playerHealthText.setText(`Health: ${playerHealth}/${playerMaxHealth}`);
  if (playerXPText) {
    const need = (typeof getNeededXP === 'function') ? getNeededXP(playerLevel) : (2 * playerLevel);
    playerXPText.setText('Level: ' + playerLevel + ' XP: ' + playerXP + '/' + need);
  }
  if (weaponStatsText) {
    weaponStatsText.setText(
      'Damage: ' + weaponDamage +
      '  Speed: ' + weaponAttackSpeed.toFixed(2) +
      '  Range: ' + attackRange +
      '\nArmor: ' + (playerArmor * 100).toFixed(0) + '%  Crit: ' + (playerCritChance * 100).toFixed(1) + '%'
    );
  }
}

function grantCheatTestWeapon() {
  if (!Array.isArray(inventory)) return;
  const existingCheat = inventory.find((item) => item && item.devCheat === true);
  if (existingCheat) return;

  const slotIndex = inventory.findIndex((item) => !item);
  const targetIndex = slotIndex >= 0 ? slotIndex : 0;

  const weapon = {
    type: 'weapon',
    key: 'dev_cheat_blade',
    name: 'Cheat Relic',
    iconKey: 'itWeapon',
    rarity: 'legendary',
    rarityLabel: 'Legendär',
    rarityValue: 4,
    itemLevel: 999,
    damage: 999,
    range: 500,
    speed: 3.0,
    crit: 0.65,
    hp: 50,
    move: 40,
    armor: 0.25,
    devCheat: true,
    attackEffects: []
  };

  inventory[targetIndex] = weapon;
  if (typeof window !== 'undefined') window.inventory = inventory;

  if (typeof normalizeItemStatsForRarity === 'function') {
    normalizeItemStatsForRarity(weapon, weapon.rarityValue || 4);
  }

  if (typeof refreshInventoryUI === 'function') {
    try {
      refreshInventoryUI();
    } catch (err) {
      console.warn('[CheatWeapon] refreshInventoryUI failed', err);
    }
  }

  console.log('[CheatWeapon] granted legendary test weapon', {
    slot: targetIndex,
    weapon
  });
}

// ==================================================
// 5) STATUS EFFECT HUD
// ==================================================
const STATUS_EFFECT_COLORS = {
  poison: 0x44ff44,
  stun: 0xffff00,
  slow: 0x4488ff,
  bleed: 0xff4444
};
const STATUS_EFFECT_LABELS = {
  poison: 'PSN',
  stun: 'STN',
  slow: 'SLW',
  bleed: 'BLD'
};

function updateStatusEffectHUD(scene) {
  if (!scene || !player) return;

  const effects = window.statusEffectManager
    ? window.statusEffectManager.getActiveEffects(player)
    : [];

  // Remove old icons
  for (const icon of statusEffectHudIcons) {
    if (icon && icon.destroy) icon.destroy();
  }
  statusEffectHudIcons.length = 0;

  if (effects.length === 0) return;

  // Position below health text (health is at y=68, next row ~y=92)
  const startX = 16;
  const startY = 152;
  const iconSize = 20;
  const spacing = 4;

  effects.forEach((entry, i) => {
    const { type, effect } = entry;
    const color = STATUS_EFFECT_COLORS[type] || 0xffffff;
    const label = STATUS_EFFECT_LABELS[type] || '?';
    const remaining = effect.remaining;
    const ratio = remaining / effect.duration;

    const x = startX + i * (iconSize + spacing + 30);
    const y = startY;

    // Background box
    const bg = scene.add.rectangle(x, y, iconSize + 28, iconSize, 0x000000, 0.5)
      .setOrigin(0, 0).setDepth(1002).setScrollFactor(0);
    statusEffectHudIcons.push(bg);

    // Colored fill showing remaining duration
    const fillWidth = Math.max(1, (iconSize + 28) * ratio);
    const fill = scene.add.rectangle(x, y, fillWidth, iconSize, color, 0.4)
      .setOrigin(0, 0).setDepth(1003).setScrollFactor(0);
    statusEffectHudIcons.push(fill);

    // Label text
    let stackText = '';
    if (effect.stacks > 1) stackText = ' x' + effect.stacks;
    const txt = scene.add.text(x + 2, y + 2, label + stackText, {
      fontSize: '12px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(1004).setScrollFactor(0);
    statusEffectHudIcons.push(txt);

    // Timer text
    const secLeft = Math.ceil(remaining / 1000);
    const timer = scene.add.text(x + iconSize + 12, y + 2, secLeft + 's', {
      fontSize: '12px',
      fill: '#cccccc'
    }).setDepth(1004).setScrollFactor(0);
    statusEffectHudIcons.push(timer);
  });
}

// ==================================================
// 5) UPDATE
// ==================================================
function update(time, delta) {
  if (invOpen) {
    pauseAllMotion.call(this);
    return;
  }

  if (playerDeathHandled) {
    pauseAllMotion.call(this);
    return;
  }

  if (isReturningToHub) {
    pauseAllMotion.call(this);
    return;
  }

  if (playerHealth <= 0) {
    // Zweite Chance (Second Chance): revive once per dungeon run with 30% HP
    if (typeof window.hasSkill === 'function' && window.hasSkill('survival_second_chance')
        && !window._secondChanceUsed) {
      window._secondChanceUsed = true;
      const reviveHP = Math.max(1, Math.round(playerMaxHealth * 0.3));
      if (typeof setPlayerHealth === 'function') {
        setPlayerHealth(reviveHP);
      } else {
        playerHealth = reviveHP;
      }
      if (typeof updateHUD === 'function') updateHUD();
      // Visual feedback: flash white
      if (player && player.active && player.setTint) {
        player.setTint(0xffffff);
        if (this?.time) {
          this.time.delayedCall(500, () => {
            if (player && player.active && player.clearTint) player.clearTint();
          });
        }
      }
      console.log('[Skills] Zweite Chance activated! Revived with', reviveHP, 'HP');
    } else {
      pauseAllMotion.call(this);
      if (!playerDeathHandled && typeof handlePlayerDeath === 'function') {
        handlePlayerDeath(this);
      }
      return;
    }
  }

  // 5.2 Wave-Abschluss?
  checkWaveEnd.call(this, time);

  // 5.3 FogOfWar
  this.updateFogOfWar();

  // 5.3b Minimap
  if (typeof updateMinimap === 'function') updateMinimap(this);

  // Gegnern die Maske einmalig nachtraeglich geben, falls sie vor Fog init gespawnt wurden
  if (this._enemyVisionMask && this._needsMask && this._needsMask.length) {
    this._needsMask.forEach(e => e?.setMask?.(this._enemyVisionMask));
    this._needsMask.length = 0;
  }

  // 5.5 Spin-Attack (Desktop) — block abilities while stunned
  const playerStunned = window.statusEffectManager && window.statusEffectManager.isStunned(player);
  if (!playerStunned && !isMobile && Phaser.Input.Keyboard.JustDown(spinKey)) {
    spinAttack.call(this);
  }

  if (!playerStunned && !isMobile) {
    if (Phaser.Input.Keyboard.JustDown(eKey)) {
      beginChargedSlash.call(this);
    }
    if (Phaser.Input.Keyboard.JustUp(eKey)) {
      releaseChargedSlash.call(this);
    }
    if (Phaser.Input.Keyboard.JustDown(qKey)) {
      dashSlash.call(this);
    }
    if (Phaser.Input.Keyboard.JustDown(rKey)) {
      throwDagger.call(this);
    }
    if (fKey && Phaser.Input.Keyboard.JustDown(fKey)) {
      shieldBash.call(this);
    }
  }

  // 5.6 Bewegung & Angriff
  if (isMobile) {
    handleMobileMovement.call(this);
  } else {
    handlePlayerMovement.call(this);
    handlePlayerAttack.call(this);
  }

  // 5.6b Status effects update
  if (window.statusEffectManager) {
    window.statusEffectManager.updateEffects(delta);
    updateStatusEffectHUD(this);
  }

  // 5.7 Spawning neuer Gegner
  handleSpawning.call(this, delta);

  // 5.8 Gegner-KI
  handleEnemies.call(this, time, delta);

  updateEnemyDirectionHint(this, this.time?.now ?? time);
}

function leaveDungeonForHub(scene, options = {}) {
  if (!scene || isReturningToHub) return;
  isReturningToHub = true;

  const { reason = 'portal', skipSave = false, skipFade = false } = options;

  if (!skipSave && typeof saveGame === 'function') {
    try {
      saveGame(scene);
    } catch (err) {
      console.warn('[leaveDungeonForHub] saveGame failed', err);
    }
  }
  if (typeof setPlayerHealth === 'function') {
    setPlayerHealth(playerMaxHealth, false);
  } else {
    playerHealth = playerMaxHealth;
  }

  if (invOpen && typeof closeInventory === 'function') {
    try {
      closeInventory();
    } catch (err) {
      console.warn('[leaveDungeonForHub] closeInventory failed', err);
    }
  }

  const finalize = () => {
    const go = () => {
      const scenePlugin = scene.scene;
      const currentKey = scene?.sys?.settings?.key;
      if (!scenePlugin || !currentKey) {
        console.warn('[leaveDungeonForHub] scene plugin or key missing');
        isReturningToHub = false;
        return;
      }
      const transitionConfig = {
        target: 'HubSceneV2',
        duration: skipFade ? 0 : 250,
        moveBelow: true,
        sleep: false,
        allowInput: false,
        data: { gameState: { hubPhase: 0, respawnReason: reason } }
      };
      if (scenePlugin.transition) {
        scenePlugin.transition(transitionConfig);
      } else if (scenePlugin.manager?.transition) {
        scenePlugin.manager.transition(currentKey, transitionConfig);
      } else {
        console.warn('[leaveDungeonForHub] transition not available, using start fallback');
        scenePlugin.start('HubSceneV2', transitionConfig.data);
      }
      isReturningToHub = false;
    };

    if (scene?.time?.delayedCall) {
      scene.time.delayedCall(0, go);
    } else {
      go();
    }
  };

  const cam = scene.cameras?.main;
  if (!skipFade && cam?.fadeOut) {
    cam.fadeOut(250, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, finalize);
  } else {
    finalize();
  }

  const resetFlag = () => {
    isReturningToHub = false;
  };

  scene.events?.once(Phaser.Scenes.Events.SHUTDOWN, resetFlag);
  scene.events?.once(Phaser.Scenes.Events.DESTROY, resetFlag);
}
window.leaveDungeonForHub = leaveDungeonForHub;

function getRespawnHealth() {
  return Math.max(1, Math.round(playerMaxHealth || baseStats?.maxHP || 30));
}

function handlePlayerDeath(scene) {
  if (playerDeathHandled) return;
  playerDeathHandled = true;

  if (invOpen && typeof closeInventory === 'function') {
    try {
      closeInventory();
    } catch (err) {
      console.warn('[handlePlayerDeath] closeInventory failed', err);
    }
  }

  if (gameOverText) {
    gameOverText.setText('DU BIST GESTORBEN\nZurück zur Stadt...');
    gameOverText.setVisible(true);
  }

  if (scene && !scene.namePrompted) {
    scene.namePrompted = true;
    let name = 'Spieler';
    try {
      const response = window.prompt('Du bist gestorben! Name für die Rangliste:', name);
      if (typeof response === 'string' && response.trim().length) {
        name = response.trim();
      } else {
        name = 'Anonymous';
      }
    } catch (err) {
      console.warn('[handlePlayerDeath] prompt failed', err);
      name = 'Anonymous';
    }

    const score = playerLevel;
    if (typeof saveScore === 'function') {
      try {
        const maybePromise = saveScore(name, score);
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch((err) => console.error('Highscore konnte nicht gespeichert werden:', err));
        }
      } catch (err) {
        console.error('Highscore konnte nicht gespeichert werden:', err);
      }
    }

    const isSceneActive = () => !!scene?.sys?.isActive;

    if (typeof window.loadScores === 'function') {
      window.loadScores()
        .then((leaderboard) => {
          if (!isSceneActive()) return;
          scene.add.text(400, 360, '🏆 Highscores', { fontSize: '24px', fill: '#ffff00' })
            .setOrigin(0.5)
            .setDepth(1001);

          leaderboard.forEach((entry, i) => {
            scene.add.text(400, 400 + i * 22, `${i + 1}. ${entry.name}: ${entry.score}`, {
              fontSize: '18px',
              fill: '#ffffff'
            })
              .setOrigin(0.5, 0)
              .setDepth(1001);
          });
        })
        .catch((err) => {
          if (!isSceneActive()) return;
          console.error('Highscores konnten nicht geladen werden:', err);
          scene.add.text(400, 400, 'Fehler beim Laden der Highscores', {
            fontSize: '18px',
            fill: '#ff0000'
          })
            .setOrigin(0.5)
            .setDepth(1001);
        });
    }
  }

  if (Array.isArray(inventory)) {
    for (let i = 0; i < inventory.length; i++) {
      inventory[i] = null;
    }
  }
  invSelected = -1;
  if (typeof window !== 'undefined') {
    window.inventory = inventory;
  }

  if (typeof window !== 'undefined' && window.materialCounts && typeof window.materialCounts === 'object') {
    if (typeof window.materialCounts.MAT === 'number') {
      window.materialCounts.MAT = 0;
    }
  }

  if (typeof updateMaterialCounterUI === 'function') {
    try {
      updateMaterialCounterUI();
    } catch (err) {
      console.warn('[handlePlayerDeath] updateMaterialCounterUI failed', err);
    }
  }

  playerXP = 0;
  neededXP = 2 * playerLevel;
  setPlayerMaxHealth(getRespawnHealth(), { refill: true });

  if (typeof updateHUD === 'function') {
    updateHUD();
  } else {
    if (playerHealthText) playerHealthText.setText(`Health: ${playerHealth}/${playerMaxHealth}`);
    if (playerXPText) playerXPText.setText(`Level: ${playerLevel}  XP: ${playerXP}/${neededXP}`);
  }

  if (typeof refreshInventoryUI === 'function') {
    try {
      refreshInventoryUI();
    } catch (err) {
      console.warn('[handlePlayerDeath] refreshInventoryUI failed', err);
    }
  }

  if (typeof saveGame === 'function') {
    try {
      saveGame(scene);
    } catch (err) {
      console.warn('[handlePlayerDeath] saveGame failed', err);
    }
  }

  const scheduleReturn = () => {
    if (!scene) return;
    if (scene.time?.delayedCall) {
      scene.time.delayedCall(1500, () => leaveDungeonForHub(scene, { reason: 'death', skipSave: true }), null, scene);
    } else {
      leaveDungeonForHub(scene, { reason: 'death', skipSave: true });
    }
  };

  scheduleReturn();
}

// ==================================================
// 6) HILFSFUNKTIONEN
// ==================================================

// 6.1 initUI: HUD und Buttons
function initUI() {
  weaponStatsText = this.add.text(16, 16, 'Damage: 1  Speed: 1.0  Range: 100\nArmor: 0%  Crit: 5%', { fontSize: '20px', fill: '#fff' })
    .setDepth(1001).setScrollFactor(0)
    .setLineSpacing(6);
  playerHealthText = this.add.text(16, 68, '', { fontSize: '20px', fill: '#fff' })
    .setDepth(1001).setScrollFactor(0);
  playerXPText = this.add.text(16, 96, '', { fontSize: '20px', fill: '#0f0' })
    .setDepth(1001).setScrollFactor(0);
  waveText = this.add.text(16, 124, '', { fontSize: '20px', fill: '#ff0' })
    .setDepth(1001).setScrollFactor(0);
  window._roomCounterText = this.add.text(16, 152, '', { fontSize: '20px', fill: '#aaf' })
    .setDepth(1001).setScrollFactor(0);
  gameOverText = this.add.text(400, 300, 'DU BIST GESTORBEN\nZurück zur Stadt...', { fontSize: '40px', fill: '#f00', align: 'center' })
    .setDepth(1001).setScrollFactor(0)
    .setOrigin(0.5).setVisible(false);
  levelUpText = this.add.text(400, 150, 'LEVEL UP!', { fontSize: '48px', fill: '#0f0' })
    .setDepth(1001).setScrollFactor(0)
    .setOrigin(0.5).setVisible(false);

  // Cooldown-Texte
  const abilityTextStyle = { fontSize: '18px', fill: '#fff' };
  attackBtnCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
  spinBtnCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
  chargeSlashCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
  dashSlashCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
  daggerThrowCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);
  shieldBashCooldownText = this.add.text(0, 0, '', abilityTextStyle)
    .setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);

  const updateAbilityCooldownPositions = (width, height) => {
    if (isMobile) return;
    const baseX = width - 80;
    const baseY = height - 80;
    attackBtnCooldownText?.setPosition(baseX, baseY);
    spinBtnCooldownText?.setPosition(baseX - 80, baseY);
    chargeSlashCooldownText?.setPosition(baseX, baseY - 40);
    dashSlashCooldownText?.setPosition(baseX - 80, baseY - 40);
    daggerThrowCooldownText?.setPosition(baseX - 160, baseY);
    shieldBashCooldownText?.setPosition(baseX - 160, baseY - 40);
  };

  updateAbilityCooldownPositions(this.scale.width, this.scale.height);
  this.scale.on('resize', (gameSize) => {
    updateAbilityCooldownPositions(gameSize.width, gameSize.height);
  });

  if (!isMobile) {
    abilityStatusDisplay = {};
    const tileWidth = 220;
    const tileHeight = 42;
    const tileSpacing = 48;
    const tileEntries = [];
    const tilePadding = 12;

    ABILITY_STATUS_CONFIG.forEach((cfg) => {
      const color = ABILITY_STATUS_STYLES[cfg.key] ?? 0xffffff;
      const container = this.add.container(0, 0).setDepth(1001).setScrollFactor(0);
      const bg = this.add.rectangle(0, 0, tileWidth, tileHeight, 0x10131c, 0.65)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.2);
      const fill = this.add.rectangle(0, 0, tileWidth, tileHeight, color, 0.28)
        .setOrigin(0, 0)
        .setVisible(false);

      const nameText = this.add.text(tilePadding, 6, cfg.label, {
        fontSize: '14px',
        fill: '#f5f7ff',
        fontStyle: 'bold'
      });
      const keyText = this.add.text(0, 0, cfg.control, {
        fontSize: '12px',
        fill: '#0d1525',
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);

      const badgeWidth = Math.max(52, keyText.width + 14);
      const badgeHeight = 22;
      const badgeX = tileWidth - tilePadding - badgeWidth;
      const badgeY = 6;

      const keyBadge = this.add.rectangle(badgeX, badgeY, badgeWidth, badgeHeight, color, 0.18)
        .setOrigin(0, 0)
        .setStrokeStyle(1, color, 0.6);

      keyText.setPosition(badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

      const statusText = this.add.text(tilePadding, tileHeight - 6, 'Ready', {
        fontSize: '12px',
        fill: '#78f3c7'
      }).setOrigin(0, 1);

      container.add([bg, fill, nameText, keyBadge, keyText, statusText]);

      abilityStatusDisplay[cfg.key] = {
        container,
        fill,
        bg,
        statusText,
        width: tileWidth,
        durationMs: 0,
        color,
        labelWidth: badgeX - tilePadding
      };

      nameText.setWordWrapWidth(badgeX - tilePadding * 1.2);
      nameText.setMaxLines(2);

      tileEntries.push({ container, key: cfg.key });
    });

    const positionStatusTiles = (width, height) => {
      const baseX = width - 20 - tileWidth;
      const baseY = 150;
      tileEntries.forEach(({ container }, index) => {
        container.setPosition(baseX, baseY + index * tileSpacing);
      });
    };

    positionStatusTiles(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize) => {
      positionStatusTiles(gameSize.width, gameSize.height);
    });

    ABILITY_STATUS_CONFIG.forEach((cfg) => {
      updateAbilityStatus(cfg.key, { remainingMs: 0, durationMs: 0 });
    });
  } else {
    abilityStatusDisplay = {};
  }

  // ---- Quest Tracker HUD ----
  const questTrackerText = this.add.text(0, 0, '', {
    fontSize: '14px',
    fontFamily: 'monospace',
    fill: '#ffe088',
    backgroundColor: '#0c0c11cc',
    padding: { x: 8, y: 6 },
    wordWrap: { width: 200 }
  }).setDepth(1001).setScrollFactor(0).setVisible(false);

  const positionQuestTracker = (width) => {
    questTrackerText.setPosition(width - 220, 16);
  };
  positionQuestTracker(this.scale.width);
  this.scale.on('resize', (gameSize) => {
    positionQuestTracker(gameSize.width);
  });

  const refreshQuestTracker = () => {
    if (!window.questSystem) return;
    const text = window.questSystem.getTrackerText();
    if (text) {
      questTrackerText.setText(text);
      questTrackerText.setVisible(true);
    } else {
      questTrackerText.setVisible(false);
    }
  };

  if (window.questSystem) {
    window.questSystem.onQuestUpdate(refreshQuestTracker);
    refreshQuestTracker();
  }

  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (window.questSystem) {
      window.questSystem.offQuestUpdate(refreshQuestTracker);
    }
  });
}

// 6.2 initControls: Joystick & Buttons
function initControls() {
  if (isMobile) {

    // 4.3b Inventar-Button
    const invBtn = this.add.text(this.scale.width - 16, 16, 'Bag',
      { fontSize: '16px', fill: '#fff', backgroundColor: '#222', padding: { x: 6, y: 4 } })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(4000).setInteractive()
      .on('pointerdown', () => { invOpen ? closeInventory() : openInventory(); });
    this.scale.on('resize', s => invBtn.setPosition(s.width - 16, 16));


    // Joystick
    joystick = this.plugins.get('rexVirtualJoystick').add(this, {
      x: 100,
      y: this.scale.height - 100,
      radius: 60,
      base: this.add.circle(0, 0, 60, 0x888888, 0.3),
      thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.5)
    });
    joystick.base.setScrollFactor(0).setDepth(100);
    joystick.thumb.setScrollFactor(0).setDepth(100);

    const abilityButtons = [];
    const abilityTexts = [];

    const registerAbilityButton = (key, btn, dx, dy) => {
      abilityButtons.push({ key, btn, dx, dy });
    };

    const registerAbilityText = (key, text, dx, dy) => {
      abilityTexts.push({ key, text, dx, dy });
    };

    const createAbilityButton = (key, dx, dy, radius, color, onDown, onUp) => {
      const btn = this.add.circle(0, 0, radius, color, 0.6)
        .setInteractive()
        .setScrollFactor(0)
        .setDepth(100);
      btn.on('pointerdown', () => onDown.call(this));
      if (onUp) {
        const release = () => onUp.call(this);
        btn.on('pointerup', release);
        btn.on('pointerupoutside', release);
        btn.on('pointerout', release);
      }
      registerAbilityButton(key, btn, dx, dy);
      return btn;
    };

    const createCooldownLabel = () => this.add.text(0, 0, '', {
      fontSize: '18px', fill: '#fff', align: 'center'
    })
      .setOrigin(0.5)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);

    attackBtn = createAbilityButton('attack', -100, -100, 40, 0xff0000, attack);
    spinBtn = createAbilityButton('spin', -200, -100, 40, 0x00ffff, spinAttack);
    chargeSlashBtn = createAbilityButton('charge', -100, -190, 34, 0xffaa00, beginChargedSlash, releaseChargedSlash);
    dashSlashBtn = createAbilityButton('dash', -200, -190, 34, 0x66ccff, dashSlash);
    daggerThrowBtn = createAbilityButton('dagger', -300, -100, 34, 0xff8800, throwDagger);
    shieldBashBtn = createAbilityButton('shield', -300, -190, 34, 0x66ffaa, shieldBash);

    attackBtnCooldownText?.destroy();
    spinBtnCooldownText?.destroy();
    chargeSlashCooldownText?.destroy();
    dashSlashCooldownText?.destroy();
    daggerThrowCooldownText?.destroy();
    shieldBashCooldownText?.destroy();

    attackBtnCooldownText = createCooldownLabel();
    spinBtnCooldownText = createCooldownLabel();
    chargeSlashCooldownText = createCooldownLabel();
    dashSlashCooldownText = createCooldownLabel();
    daggerThrowCooldownText = createCooldownLabel();
    shieldBashCooldownText = createCooldownLabel();

    registerAbilityText('attack', attackBtnCooldownText, -100, -100);
    registerAbilityText('spin', spinBtnCooldownText, -200, -100);
    registerAbilityText('charge', chargeSlashCooldownText, -100, -190);
    registerAbilityText('dash', dashSlashCooldownText, -200, -190);
    registerAbilityText('dagger', daggerThrowCooldownText, -300, -100);
    registerAbilityText('shield', shieldBashCooldownText, -300, -190);

    const positionAbilityUI = (width, height) => {
      abilityButtons.forEach(({ btn, dx, dy }) => btn?.setPosition(width + dx, height + dy));
      abilityTexts.forEach(({ text, dx, dy }) => text?.setPosition(width + dx, height + dy));
    };

    positionAbilityUI(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize) => {
      positionAbilityUI(gameSize.width, gameSize.height);
    });
  } else {
    spinKey = this.input.keyboard.addKey('SHIFT');
  }

  // UI-Elemente nicht von Fog beeinflussen lassen
  if (isMobile) {
    joystick.base.setScrollFactor(0).setDepth(1200).clearMask?.();
    joystick.thumb.setScrollFactor(0).setDepth(1200).clearMask?.();
    attackBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    spinBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    chargeSlashBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    dashSlashBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    daggerThrowBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    shieldBashBtn?.setScrollFactor(0).setDepth(1200).clearMask?.();
    // falls vorhanden:
    attackBtnCooldownText?.setScrollFactor(0).setDepth(1201);
    spinBtnCooldownText?.setScrollFactor(0).setDepth(1201);
    chargeSlashCooldownText?.setScrollFactor(0).setDepth(1201);
    dashSlashCooldownText?.setScrollFactor(0).setDepth(1201);
    daggerThrowCooldownText?.setScrollFactor(0).setDepth(1201);
    shieldBashCooldownText?.setScrollFactor(0).setDepth(1201);
  }
}

// 6.3 createAllGraphics: erzeugt alle Texturen
function createAllGraphics() {
  createEnemyGraphics.call(this);
  createLootGraphics.call(this);
  createObstacleGraphics.call(this);
  createProjectileGraphics.call(this);
  createInventoryGraphics.call(this);
  createItemGraphics.call(this);
  createParticleTextures.call(this);
}

// 6.4 initializeGameObjects: Physics-Gruppen & Kollisionen
function initializeGameObjects() {
  const textureKey = (typeof getPlayerTextureKey === 'function')
    ? getPlayerTextureKey(this)
    : (this.textures.exists('playerSprites') ? 'playerSprites' : 'playerTexture');
  player = this.physics.add.sprite(
    this.scale.width / 2,
    this.scale.height / 2,
    textureKey,
    0
  ).setCollideWorldBounds(true).setDepth(100);

  if (typeof applyPlayerDisplaySettings === 'function') {
    applyPlayerDisplaySettings(player);
  }

  player.body.setMaxVelocity(220, 220);
  if (player.body.setPushable) player.body.setPushable(false);

  const f = player.frame;
  if (f) {
    console.log('[playerSprite] frame', f.width, f.height, 'cut', f.cutWidth, f.cutHeight, 'trimmed', f.trimmed, 'x', f.x, 'y', f.y, 'sourceSize', f.sourceSize);
  }

  if (typeof ensurePlayerAnimations === 'function') ensurePlayerAnimations(this);
  if (typeof updatePlayerSpriteAnimation === 'function') {
    updatePlayerSpriteAnimation(player, 0, 0);
  }

  if (this.cameras?.main) {
    this.cameras.main.startFollow(player, true, 0.12, 0.12);
    const camWidth = this.cameras.main.width;
    const camHeight = this.cameras.main.height;
    this.cameras.main.setDeadzone(camWidth * 0.15, camHeight * 0.15);
  }
  
  enemies = this.physics.add.group();
  enemyProjectiles = this.physics.add.group();
  playerProjectiles = this.physics.add.group();
  obstacles = this.physics.add.staticGroup();
  lootGroup = this.physics.add.group();
  this.enemyLayer = this.add.layer().setDepth(50);
  this.physics.world.setBounds(0, 0, this.scale.width + WORLD_RIGHT_PADDING, this.scale.height, true, true, true, true);
  this.physics.world.TILE_BIAS = 24;

  if (typeof window.spawnObstacle === 'function') {
    this.spawnObstacle = window.spawnObstacle.bind(this);
  }

  this.physics.add.collider(player, obstacles);
  this.physics.add.collider(player, enemies);
  this.physics.add.collider(enemies, obstacles);
  // Soft collision between enemies (Diablo 2 style — they push each other)
  this.physics.add.collider(enemies, enemies);
  // Projektile prallen an Hindernissen ab/werden zerstört
  this.physics.add.collider(enemyProjectiles, obstacles, (proj /* Sprite */, obs) => {
    if (proj && proj.active) proj.destroy();
  });
  this.physics.add.collider(playerProjectiles, obstacles, (proj) => {
    if (proj && proj.active) proj.destroy();
  });

  this.physics.add.overlap(player, enemies, hitByMelee, null, this);
  this.physics.add.overlap(player, enemyProjectiles, hitByProjectile, null, this);
  this.physics.add.overlap(playerProjectiles, enemies, handlePlayerProjectileEnemyOverlap, null, this);
  this.physics.add.overlap(player, lootGroup, collectLoot, null, this);

  // Initialize sound manager and start dungeon ambient music
  if (typeof SoundManager === 'function') {
    window.soundManager = new SoundManager(this);
    window.soundManager.playMusic('dungeon_ambient');
  }
}
