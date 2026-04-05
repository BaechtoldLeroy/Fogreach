// wave.js

// --------------------------------------------------
// Wave sizing helper
// --------------------------------------------------
function computeWaveEnemyTotal(waveNumber) {
  const wave = Math.max(1, Math.floor(waveNumber || 1));
  // Logarithmic scaling: starts at 3, grows slowly, caps at 12
  // Wave 1: 3, Wave 5: 5, Wave 10: 7, Wave 20: 9, Wave 40: 11
  const base = 3;
  const scaled = base + Math.floor(Math.log2(wave) * 1.5);
  return Math.min(12, scaled);
}
window.computeWaveEnemyTotal = computeWaveEnemyTotal;

// --------------------------------------------------
// 6.5 Wellen-Logik
// --------------------------------------------------
function startNextWave(noIncrement) {
  // Spawn-Tempo ggf. neu berechnen
  if (!noIncrement) currentWave += 1;
  window.currentWave = currentWave;
  window.DUNGEON_DEPTH = currentWave;

  if (playerHealth > 1) {
    saveGame(this);
  }

  // Boss every 10th wave
  if (currentWave % 10 === 0) {
    bossActive = true;
    spawnedEnemiesInWave = 0;    // no regular spawns this wave
    waveInProgress = true;
    waveText.setText('Dungeon Level: ' + currentWave + '  (BOSS)');
    spawnBoss.call(this);        // <-- defined below
    if (window.soundManager) window.soundManager.playMusic('boss_music');
    return;                      // skip normal spawn setup
  }

  // Spawn-Intervall nie unter 200 ms reduzieren
  spawnInterval = Math.max(200, spawnInterval - 50);

  waveInProgress = true;
  const isMiniBossWave = (currentWave % 5 === 0 && currentWave % 10 !== 0);
  waveText.setText('Dungeon Level: ' + currentWave + (isMiniBossWave ? '  (MINI-BOSS)' : ''));
  spawnedEnemiesInWave = 0;
  window.spawnedEnemiesInWave = 0;
  spawnTimer = 0;

  // Alle regulären Gegner direkt zu Beginn der Welle erzeugen.
  if (!bossActive && typeof spawnEnemy === 'function') {
    const scene = this;
    const total = computeWaveEnemyTotal(currentWave);
    enemiesPerWave = window.enemiesPerWave = total;
    if (total > 0) {
      let spawned = 0;
      const spawnBatch = () => {
        while (spawned < total) {
          const enemy = spawnEnemy.call(scene, 0, 0, 'enemy');
          if (!enemy) break;
          spawned += 1;
          spawnedEnemiesInWave = spawned;
        }

        // Mini-boss every 5th wave (but not on 10th/20th/etc. boss waves)
        if (currentWave % 5 === 0 && currentWave % 10 !== 0 && typeof spawnMiniBoss === 'function') {
          const miniBoss = spawnMiniBoss.call(scene, 0, 0, 0);
          if (miniBoss) {
            spawned += 1;
            spawnedEnemiesInWave = spawned;
            // Update total to include mini-boss for wave-end check
            enemiesPerWave = window.enemiesPerWave = spawned;
          }
        }

        window.spawnedEnemiesInWave = spawnedEnemiesInWave;
      };

      if (this?.time?.delayedCall) {
        this.time.delayedCall(0, spawnBatch);
      } else {
        spawnBatch();
      }
    }
  }
}

// --------------------------------------------------
// 6.5b Prüfen, ob die Welle vorbei ist
// --------------------------------------------------
function checkWaveEnd(time) {  
  const total = computeWaveEnemyTotal(currentWave);
  if (waveInProgress &&
    spawnedEnemiesInWave >= total &&
    enemies.countActive(true) === 0) {
    waveInProgress = false;

    // Notify story system of wave completion
    if (window.storySystem && typeof window.storySystem.onWaveCompleted === 'function') {
      window.storySystem.onWaveCompleted(currentWave);
    }
    // Notify quest system of wave completion
    if (window.questSystem && typeof window.questSystem.onWaveCompleted === 'function') {
      window.questSystem.onWaveCompleted(currentWave);
    }

    // Raum gilt als geschafft → Treppen freigeben
    if (typeof markRoomCleared === 'function') markRoomCleared();
  }

  // Boss wave ends when boss is gone
  if (bossActive) {
    if (!currentBoss || !currentBoss.active) {
      bossActive = false;
      if (window.soundManager) window.soundManager.playMusic('dungeon_ambient');
      this.time.delayedCall(1000, () => startNextWave.call(this));
    }
    return;
  }
}

// --------------------------------------------------
// 6.6 Spawning neuer Gegner
// --------------------------------------------------
function handleSpawning(delta) {
  // Reguläres Spawning deaktiviert, da alle Gegner zu Wellenbeginn erzeugt werden.
  return;
}

// --------------------------------------------------
// 6.7 Hindernisse platzieren
// --------------------------------------------------
function placeObstaclesForWave() {
  if (!obstacles || typeof obstacles.clear !== 'function') {
    return;
  }

  obstacles.clear(true, true);

  const scene = obstacles.scene;
  if (!scene || !scene.scale) {
    return;
  }

  const W = scene.scale.width;
  const H = scene.scale.height;
  const margin = 48;

  // Anzahl pro Welle
  const count = Math.min(5 + currentWave * 2, 20);
  const types = ['obstacleWall', 'obstacleTree', 'obstacleRock'];

  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(margin, W - margin);
    const y = Phaser.Math.Between(margin, H - margin);
    const key = Phaser.Utils.Array.GetRandom(types);

    const obs = obstacles
      .create(x, y, key)
      .setData('type', key)
      .setOrigin(0.5, 0.5);
    obs.refreshBody();
  }

  if (obstacles && obstacles.children) {
    obstacles.children.iterate((child) => child?.refreshBody?.());
    if (typeof obstacles.refresh === 'function') obstacles.refresh();
  }

  if (typeof window.recomputeAccessibleArea === 'function' && obstacles?.scene) {
    try {
      window.recomputeAccessibleArea(obstacles.scene);
    } catch (err) {
      console.warn('[placeObstaclesForWave] recomputeAccessibleArea failed', err);
    }
  }
}

// --------------------------------------------------
// 6.8 Pausieren beim Loot-Dialog
// --------------------------------------------------
function pauseAllMotion() {
  enemies.children.iterate(e => e.body?.setVelocity(0));
  if (enemyProjectiles?.children) {
    enemyProjectiles.children.iterate(p => { if (p?.destroy) p.destroy(); });
    // optional (Pool aufräumen): enemyProjectiles.clear(false, true);
  }
  if (playerProjectiles?.children) {
    playerProjectiles.children.iterate(p => { if (p?.destroy) p.destroy(); });
  }
}
