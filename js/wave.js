// wave.js

// --------------------------------------------------
// Wave sizing helper
// --------------------------------------------------
// Variante A (2026-06): Gegnerzahl rein nach BEGEHBARER Flaeche (konstante
// Dichte) — NICHT mehr nach Tiefe. Tiefe macht Gegner staerker (HP, enemy.js
// statScale +10%/Tiefe), nicht zahlreicher. `walkableAreaPx` = erreichbare
// Flaeche in px² (window.computeWalkableAreaPx / roomManager). Fehlt sie,
// faellt die Formel auf den alten tiefen-basierten baseCount zurueck.
const AREA_PER_ENEMY = 85000; // ~1 Gegner pro ~85k px² begehbar — tunebar
const ENEMY_COUNT_MIN = 4;
const ENEMY_COUNT_MAX = 28;

function computeWaveEnemyTotal(waveNumber, walkableAreaPx) {
  if (walkableAreaPx && walkableAreaPx > 0) {
    const n = Math.round(walkableAreaPx / AREA_PER_ENEMY);
    const count = Math.max(ENEMY_COUNT_MIN, Math.min(ENEMY_COUNT_MAX, n));
    if (window.__ENEMY_COUNT_DEBUG__) {
      try { console.log('[enemyCount] begehbar=' + Math.round(walkableAreaPx) + 'px² -> ' + count + ' Gegner'); } catch (e) {}
    }
    return count;
  }
  // Fallback: Flaeche unbekannt -> bisheriger tiefen-basierter Wert.
  const wave = Math.max(1, Math.floor(waveNumber || 1));
  return Math.min(14, 4 + Math.floor(Math.log2(wave) * 1.7));
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

  // Story-aware boss gating: in Akt 1 (currentActIndex 0 = 'auftrag'),
  // every 10th wave gets a MINI-BOSS instead of the full boss to keep
  // the difficulty curve readable for the donor-demo pacing target.
  // Full bosses unlock from Akt 2 (currentActIndex >= 1 = 'treuer_diener')
  // onwards. The collusion-reveal in Q6 advances storySystem to act
  // index 2, which is when the narrative says "the catacombs open" and
  // bosses become thematically appropriate.
  const _storyAct = (window.storySystem && typeof window.storySystem.getCurrentActIndex === 'function')
    ? window.storySystem.getCurrentActIndex() : 0;
  const bossesUnlocked = _storyAct >= 1;

  // Boss every 10th wave — but only once Akt 2 has opened.
  if (currentWave % 10 === 0 && bossesUnlocked) {
    bossActive = true;
    spawnedEnemiesInWave = 0;    // no regular spawns this wave
    waveInProgress = true;
    waveText.setText((window.roomProgressText ? window.roomProgressText + '  |  ' : '') + 'Dungeon Level: ' + currentWave + '  (BOSS)');
    spawnBoss.call(this);        // <-- defined below
    if (window.soundManager) window.soundManager.playMusic('boss_music');
    return;                      // skip normal spawn setup
  }

  waveInProgress = true;
  // Mini-boss waves: any 5th wave when no full boss fired. Includes the
  // 10th-wave slot when bosses aren't unlocked yet — keeps the pacing
  // beat the player expects ("something bigger every 5 waves") without
  // pulling in the harder boss encounter too early.
  const isMiniBossWave = (currentWave % 5 === 0)
    && !(currentWave % 10 === 0 && bossesUnlocked);
  waveText.setText((window.roomProgressText ? window.roomProgressText + '  |  ' : '') + 'Dungeon Level: ' + currentWave + (isMiniBossWave ? '  (MINI-BOSS)' : ''));
  spawnedEnemiesInWave = 0;
  window.spawnedEnemiesInWave = 0;

  // Alle regulären Gegner direkt zu Beginn der Welle erzeugen.
  if (!bossActive && typeof spawnEnemy === 'function') {
    const scene = this;
    const total = computeWaveEnemyTotal(currentWave, window.__WALKABLE_AREA_PX__ || 0);
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

        // Mini-boss every 5th wave (also takes over the 10th-wave slot
        // when bosses are gated by storyAct < 1 — see isMiniBossWave above).
        if (isMiniBossWave && typeof spawnMiniBoss === 'function') {
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
  const total = computeWaveEnemyTotal(currentWave, window.__WALKABLE_AREA_PX__ || 0);
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
    if (window.AbilitySystem && typeof window.AbilitySystem.onWaveCompleted === 'function') {
      window.AbilitySystem.onWaveCompleted(currentWave);
    }

    // Brief breathing room after clearing a wave before unlocking stairs
    if (waveText) waveText.setText((window.roomProgressText ? window.roomProgressText + '  |  ' : '') + 'Wave Cleared!');
    const scene = this;
    if (scene?.time?.delayedCall) {
      scene.time.delayedCall(2000, () => {
        if (typeof markRoomCleared === 'function') markRoomCleared();
      });
    } else {
      if (typeof markRoomCleared === 'function') markRoomCleared();
    }
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
    // Reset pool too — handed-out references are now dead.
    const scene = window.currentScene || (window.game && window.game.scene && window.game.scene.scenes && window.game.scene.scenes.find(s => s && s.sys && s.sys.isActive()));
    if (scene) scene._enemyProjectilePool = [];
  }
  if (playerProjectiles?.children) {
    playerProjectiles.children.iterate(p => { if (p?.destroy) p.destroy(); });
  }
}
