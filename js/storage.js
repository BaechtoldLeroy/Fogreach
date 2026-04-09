// js/storage.js
const SAVE_KEY = 'demonfall_save_v1';

function saveGame(scene) {
  try {
    if (typeof siphonMaterialsFromInventory === 'function') {
      siphonMaterialsFromInventory();
    }

    const cloneInventory = Array.isArray(inventory)
      ? inventory.map((item) => (item ? JSON.parse(JSON.stringify(item)) : null))
      : [];
    const cloneEquipment = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      return {
        weapon: obj.weapon ? JSON.parse(JSON.stringify(obj.weapon)) : null,
        head: obj.head ? JSON.parse(JSON.stringify(obj.head)) : null,
        body: obj.body ? JSON.parse(JSON.stringify(obj.body)) : null,
        boots: obj.boots ? JSON.parse(JSON.stringify(obj.boots)) : null,
      };
    };
    const cloneMaterials = (() => {
      if (typeof window === 'undefined') return {};
      const source = (window.materialCounts && typeof window.materialCounts === 'object')
        ? window.materialCounts
        : {};
      return Object.entries(source).reduce((acc, [key, value]) => {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) {
          acc[key] = Math.max(0, Math.floor(num));
        }
        return acc;
      }, {});
    })();

    const waveForCount = Math.max(1, currentWave || 1);
    const normalizedEnemies =
      typeof window.computeWaveEnemyTotal === 'function'
        ? window.computeWaveEnemyTotal(waveForCount)
        : 4 + (waveForCount - 1) * 2;

    const cloneSkills = () => {
      if (typeof window === 'undefined' || !window.playerSkills) return {};
      return JSON.parse(JSON.stringify(window.playerSkills));
    };

    const cloneQuests = () => {
      if (typeof window.questSystem === 'object' && typeof window.questSystem.getQuestSaveData === 'function') {
        return window.questSystem.getQuestSaveData();
      }
      return null;
    };

    const cloneStory = () => {
      if (typeof window.storySystem === 'object' && typeof window.storySystem.getStorySaveData === 'function') {
        return window.storySystem.getStorySaveData();
      }
      return null;
    };

    const payload = {
      ts: Date.now(),
      // Core Progress
      currentWave,
      enemiesPerWave: normalizedEnemies,
      // Player Stats
      playerHealth,
      playerMaxHealth,
      playerXP,
      playerLevel,
      playerSpeed,
      dungeonDepth: window.DUNGEON_DEPTH || currentWave || 1,
      playerArmor,
      playerCritChance,
      // Weapon
      weaponDamage,
      weaponAttackSpeed,
      attackRange,
      difficultyMultiplier: (typeof window.getDifficultyMultiplier === 'function')
        ? window.getDifficultyMultiplier()
        : (typeof window.DIFFICULTY_MULTIPLIER === 'number' ? window.DIFFICULTY_MULTIPLIER : 1),
      // Inventory
      inventory: cloneInventory,
      equipment: cloneEquipment(equipment),
      materials: cloneMaterials,
      skills: cloneSkills(),
      quests: cloneQuests(),
      story: cloneStory()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    try {
      window.__LAST_SAVE_SNAPSHOT__ = JSON.parse(JSON.stringify(payload));
    } catch (err) {
      window.__LAST_SAVE_SNAPSHOT__ = payload;
    }
    // UI-Popup wurde entfernt, damit Saves ohne Overlay erfolgen
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function showSavePopup(scene, payload) {
  const cam = scene.cameras?.main;
  const width = cam ? cam.width : scene.scale.width;
  const height = cam ? cam.height : scene.scale.height;

  const overlay = scene.add.rectangle(width / 2, height / 2, width + 40, height + 40, 0x000000, 0.55)
    .setDepth(5000)
    .setScrollFactor(0)
    .setInteractive();

  const panelWidth = 440;
  const panelHeight = 260;
  const container = scene.add.container(width / 2, height / 2).setDepth(5001).setScrollFactor(0);

  const gfx = scene.add.graphics();
  gfx.fillStyle(0x101018, 0.95).fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18);
  gfx.lineStyle(2, 0x4a86ff, 0.85).strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 18);
  container.add(gfx);

  const title = scene.add.text(0, -panelHeight / 2 + 20, 'Spielstand gespeichert', {
    fontFamily: 'serif',
    fontSize: 26,
    color: '#f1f6ff'
  }).setOrigin(0.5, 0);
  container.add(title);

  const info = scene.add.text(-panelWidth / 2 + 24, title.y + title.height + 20,
    `Dungeon Level: ${payload.dungeonDepth}\n` +
    `Aktuelle Wave: ${payload.currentWave}\n` +
    `Spieler-Level: ${payload.playerLevel}`,
    {
      fontFamily: 'monospace',
      fontSize: 18,
      color: '#d6e7ff',
      lineSpacing: 4
    }
  ).setOrigin(0, 0);
  container.add(info);

  const btn = scene.add.text(0, panelHeight / 2 - 40, 'OK', {
    fontFamily: 'monospace',
    fontSize: 20,
    padding: { x: 14, y: 6 },
    backgroundColor: '#2c4d7c',
    color: '#ffffff'
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  container.add(btn);

  const close = () => {
    overlay.destroy();
    container.destroy(true);
  };

  btn.on('pointerdown', close);
  overlay.on('pointerdown', close);
  scene.input.keyboard.once('keydown-ENTER', close);
  scene.input.keyboard.once('keydown-SPACE', close);
  scene.input.keyboard.once('keydown-ESC', close);
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}


function applySaveToState(scene, s) {
  // Run loot migration first — converts old item structures in-place before
  // any state assignment. Idempotent; safe on already-migrated saves.
  if (s && typeof window !== 'undefined' && window.LootSystem && typeof window.LootSystem.migrateSave === 'function') {
    try {
      s = window.LootSystem.migrateSave(s);
    } catch (err) {
      console.warn('[storage] migrateSave failed', err);
    }
  }

  // 1) Core-Stats aus Save übernehmen (mit Fallbacks)
  currentWave        = Math.max(0, s.currentWave ?? currentWave);
  const waveForCount = Math.max(1, currentWave || 1);
  enemiesPerWave     =
    typeof window.computeWaveEnemyTotal === 'function'
      ? window.computeWaveEnemyTotal(waveForCount)
      : 4 + (waveForCount - 1) * 2;
  playerHealth       = (s.playerHealth ?? playerHealth);
  playerMaxHealth    = (s.playerMaxHealth ?? playerMaxHealth ?? baseStats?.maxHP ?? 30);
  playerXP           = (s.playerXP ?? playerXP);
  playerLevel        = (s.playerLevel ?? playerLevel);
  playerSpeed        = (s.playerSpeed ?? playerSpeed);
  playerArmor        = (s.playerArmor ?? playerArmor);
  playerCritChance   = (s.playerCritChance ?? playerCritChance);
  weaponDamage       = (s.weaponDamage ?? weaponDamage);
  weaponAttackSpeed  = (s.weaponAttackSpeed ?? weaponAttackSpeed);
  attackRange        = (s.attackRange ?? attackRange);
  const restoredDepth = Math.max(
    1,
    typeof s.dungeonDepth === 'number' ? Math.round(s.dungeonDepth) : 0,
    typeof s.currentWave === 'number' ? Math.round(s.currentWave) : 0
  );
  window.DUNGEON_DEPTH = restoredDepth;
  window.NEXT_DUNGEON_DEPTH = restoredDepth + 1;

  if (typeof s.difficultyMultiplier === 'number' && Number.isFinite(s.difficultyMultiplier) && s.difficultyMultiplier > 0) {
    window.DIFFICULTY_MULTIPLIER = s.difficultyMultiplier;
    window.__LAST_SELECTED_DIFFICULTY__ = s.difficultyMultiplier;
    try {
      localStorage.setItem('demonfall_lastDifficulty', JSON.stringify(s.difficultyMultiplier));
    } catch (err) {
      console.warn('[storage] unable to persist difficulty', err);
    }
  }

  // 1.5) Inventar & Ausrüstung
  if (Array.isArray(s.inventory)) {
    // Falls du eine feste Slot-Anzahl hast: auf Länge clampen/auffüllen
    if (typeof INV_SLOTS === 'number') {
      inventory = new Array(INV_SLOTS).fill(null);
      for (let i = 0; i < Math.min(INV_SLOTS, s.inventory.length); i++) {
        inventory[i] = s.inventory[i] || null;
      }
    } else {
      inventory = s.inventory.slice();
    }
    if (typeof window !== 'undefined') window.inventory = inventory;
  }

  if (typeof setMaterialCounts === 'function') {
    setMaterialCounts(s.materials || {});
  }

  if (s.equipment && typeof s.equipment === 'object') {
    equipment = equipment || {};
    equipment.weapon = s.equipment.weapon || null;
    equipment.head   = s.equipment.head   || null;
    equipment.body   = s.equipment.body   || null;
    equipment.boots  = s.equipment.boots  || null;
    if (typeof window !== 'undefined') window.equipment = equipment;
  }

  if (s.skills && typeof s.skills === 'object') {
    if (typeof window !== 'undefined') {
      window.playerSkills = s.skills;
    }
  }

  if (s.quests && typeof window.questSystem === 'object' && typeof window.questSystem.loadQuestSaveData === 'function') {
    window.questSystem.loadQuestSaveData(s.quests);
  }

  if (s.story && typeof window.storySystem === 'object' && typeof window.storySystem.loadStorySaveData === 'function') {
    window.storySystem.loadStorySaveData(s.story);
  }

  if (typeof applySkillEffects === 'function') {
    applySkillEffects();
  }

  if (typeof recalcDerived === 'function') {
    recalcDerived(0, 0);
  }
  // WP08 T048: after equipment has been hydrated from the save, aggregate
  // all affix bonuses into the LootSystem cache so ability damage/cooldown
  // bonuses are live immediately.
  if (window.LootSystem && typeof window.LootSystem.recomputeBonuses === 'function') {
    try { window.LootSystem.recomputeBonuses(); } catch (e) { /* swallow */ }
  }
  if (typeof setPlayerHealth === 'function') {
    setPlayerHealth(playerHealth);
  } else {
    playerHealth = Math.min(playerHealth, playerMaxHealth || playerHealth);
  }
  if (typeof siphonMaterialsFromInventory === 'function') {
    siphonMaterialsFromInventory();
  }
  if (typeof updateMaterialCounterUI === 'function') {
    updateMaterialCounterUI();
  }
  
  // 2) Spawn/Progress ableiten
  waveInProgress         = false;
  spawnedEnemiesInWave   = 0;
  spawnInterval = Math.max(200, 1000 - 50 * (currentWave - 1));

  // 3) HUD aktualisieren
  if (weaponStatsText?.setText) {
    weaponStatsText.setText(
      'Damage: ' + weaponDamage +
      '  Speed: ' + weaponAttackSpeed.toFixed(2) +
      '  Range: ' + attackRange +
      '\nArmor: ' + (playerArmor * 100).toFixed(0) + '%  Crit: ' + (playerCritChance * 100).toFixed(1) + '%'
    );
  }
  if (typeof updateHUD === 'function') {
    updateHUD();
  }
  if (playerXPText?.setText) {
    playerXPText.setText('Level: ' + playerLevel + ' XP: ' + playerXP + '/' + neededXP);
  }
  if (waveText?.setText) {
    waveText.setText('Wave: ' + currentWave);
  }

  // 4) Hindernisse passend zur Wave neu platzieren (optional, aber sinnvoll)
  if (typeof placeObstaclesForWave === 'function') {
    placeObstaclesForWave.call(scene);
  }
}

window.saveGame  = saveGame;
window.loadGame  = loadGame;
window.hasSave   = hasSave;
window.clearSave = clearSave;
