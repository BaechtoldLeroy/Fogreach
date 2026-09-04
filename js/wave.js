// wave.js

// --------------------------------------------------
// Wave sizing helper
// --------------------------------------------------
// Variante A (2026-06): Gegnerzahl rein nach BEGEHBARER Fläche (konstante
// Dichte) — NICHT mehr nach Tiefe. Tiefe macht Gegner stärker (HP, enemy.js
// statScale +10%/Tiefe), nicht zahlreicher. `walkableAreaPx` = erreichbare
// Fläche in px² (window.computeWalkableAreaPx / roomManager). Fehlt sie,
// fällt die Formel auf den alten tiefen-basierten baseCount zurück.
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
  // Fallback: Fläche unbekannt -> bisheriger tiefen-basierter Wert.
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
  // Die LAUFTIEFE haengt NICHT am Wellenzaehler.
  //
  // Vorher stand hier "window.DUNGEON_DEPTH = currentWave;". Jede neue Welle
  // hob damit die Tiefe des laufenden Runs — im Widerspruch zu Feature 058
  // (#41): "within a run the depth never climbs per room" (runDepth.js:50).
  // Die Identitaets-Funktion nextRoomDepth hatte den Aufstieg pro RAUM
  // beseitigt, den pro WELLE aber nicht.
  //
  // Gemessen mit einem Mitschnitt aller Schreibzugriffe auf DUNGEON_DEPTH:
  //     20 -> 20  startDungeon (HubSceneV2.js:2405)
  //     20 -> 20  applySaveToState (storage.js:255)
  //     20 -> 20  enterRoom (roomManager.js:1292)
  //     20 -> 20  startNextWave <- enterRoom
  //     20 -> 21  startNextWave <- callback (wave.js:242)   <-- hier
  //
  // Folgen: Gegner-Skalierung, Beute-Stufe und vor allem das Boss-Tor
  // (Vielfache von 10) verschieben sich mitten im Lauf. Wer Tiefe 20 waehlte,
  // stand auf 21 und traf keinen Voll-Boss mehr.
  //
  // enterRoom setzt die Tiefe je Raum bereits korrekt (roomManager.js:1292).

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

  // Feature 058 (#41) Option B + Tier-Gate-Follow-up: the boss / mini-boss is the
  // RUN CLIMAX — at most ONE per run, only in the FINAL room, scaled to the
  // run-constant depth.
  //
  // Full bosses now spawn ONLY at TIER GATES (depth a multiple of 10: 10/20/30…).
  // Reason: depth is run-constant and grows only +1 per completed run (058), so a
  // plain "depth >= 10" rule put the SAME banded boss in every run across a whole
  // 10-band — the player fought the Kettenmeister ~10 runs in a row (depth 10–19).
  // Tier-gating makes each named boss a once-per-tier milestone:
  //   depth 10 -> chainMaster (Kettenmeister), 20 -> ceremonyMaster,
  //   30 -> shadowCouncillor; the in-between depths (11–19, 21–29, …) get a
  // mini-boss climax instead. getBossDefinition(depth) still bands the type.
  const _isFinalRoom = !!window.__isFinalDungeonRoom;
  const _climaxArmed = _isFinalRoom && !window.__runClimaxSpawned;
  const _isTierGate = (currentWave >= 10) && (currentWave % 10 === 0);

  // Debug (?boss=<name>): den Boss SOFORT setzen, statt Tiefe, Finalraum und
  // Akt-Freischaltung zusammenkommen zu lassen. Nur einmal je Lauf — sonst
  // stuende in jedem Raum einer.
  var _debugBoss = false;
  try {
    _debugBoss = !!(typeof window.debugForcedBoss === 'function'
      && window.debugForcedBoss() && !window.__runClimaxSpawned);
  } catch (e) { _debugBoss = false; }

  // Full boss: final room, on a tier gate, bosses narratively unlocked (Akt 2+).
  if (_debugBoss || (_climaxArmed && bossesUnlocked && _isTierGate)) {
    window.__runClimaxSpawned = true;
    bossActive = true;
    spawnedEnemiesInWave = 0;    // no regular spawns this wave
    waveInProgress = true;
    waveText.setText((window.roomProgressText ? window.roomProgressText + '  |  ' : '') + 'Dungeon Level: ' + currentWave + '  (BOSS)');
    const _boss = spawnBoss.call(this);   // <-- defined below
    if (window.soundManager) window.soundManager.playMusic('boss_music');

    // #109: Treppe SPERREN, bis der Voll-Boss besiegt ist — genau wie beim
    // Mini-Boss weiter unten. Ohne das war ausgerechnet der story-tragende
    // Boss der EINZIGE Gegner im Spiel, an dem man vorbeilaufen konnte:
    // gemessen zwei Laeufe auf Tiefe 10, beide "Dungeon abgeschlossen", der
    // Kettenmeister dabei unberuehrt bei voller HP. Damit war mara_warning
    // (boss_kill kettenmeister, questSystem.js:506) praktisch unerfuellbar —
    // und daran haengt das Tor von Tiefe 9 auf 10 (runDepth.js:22).
    // Entsperrt wird nicht hier: checkWaveEnd gibt die Treppe generisch frei,
    // sobald __climaxEnemy nicht mehr aktiv ist.
    if (_boss) {
      window.__climaxEnemy = _boss;
      if (typeof window.lockStairs === 'function' && this.stairsGroup) {
        try { window.lockStairs(this, true); } catch (e) {}
      }
    }
    return;                      // skip normal spawn setup
  }

  waveInProgress = true;
  // Mini-boss climax: JEDER bewaffnete finale Raum (Tiefe >= 1), der KEIN Voll-
  // Boss-Tier-Gate ist — also alle flachen Runs (1–9), die Zwischen-Runs (11–19, …)
  // und jeder tiefe Run, solange Bosse noch story-gesperrt sind (Akt 1). Der Voll-
  // Boss-Zweig oben ist schon zurueckgekehrt, hier gilt also "kein Voll-Boss".
  // #65: Gate von >=5 auf >=1 gesenkt -> jeder Run endet mit einem Mini-Boss (aus
  // dem tiefen-gegateten Gegnerpool, siehe spawnMiniBoss). Frueh sanft skaliert.
  const isMiniBossWave = _climaxArmed && currentWave >= 1;
  if (isMiniBossWave) window.__runClimaxSpawned = true;
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
      // Ein Raum, ein Banner (siehe spawnEnemy in enemy.js). Vor JEDER Welle
      // zuruecksetzen, sonst traegt der Merker in den naechsten Raum.
      window.__scharImRaum = false;
      // #95: Kriegsschar. Der Bannertraeger und sein Gefolge werden ZUERST
      // gesetzt, damit der Rest der Welle nur noch auffuellt — so bleibt die
      // Gesamtzahl unter Kontrolle, ohne dass frisch gespawnte Gegner wieder
      // entfernt werden muessten (die haengen an einer hpBar, die dabei
      // zurueckbliebe).
      let ziel = total;
      const spawnBatch = () => {
        try {
          const K = window.Kriegsschar;
          const erzwungen = window.DebugGate && window.DebugGate.an('schar');
          const plan = (K && typeof K.plane === 'function')
            ? (erzwungen
                ? { gefolge: K.gefolgeGroesse(total), gesamt: K.zielGesamt(total, K.gefolgeGroesse(total)) }
                : K.plane(total, window.__WALKABLE_AREA_PX__ || 0, window.DUNGEON_DEPTH || 1, Math.random))
            : null;
          if (plan) {
            window.__scharImRaum = true;
            const fuehrer = spawnEnemy.call(scene, 0, 0, 'enemy');
            if (fuehrer && window.EliteEnemies
                && typeof window.EliteEnemies.applyEliteToEnemy === 'function') {
              window.EliteEnemies.applyEliteToEnemy(fuehrer, 'unique');
              spawned += 1;
              const affix = K.erbbarerAffix(fuehrer.eliteAffixes || [], Math.random);
              const folge = K.gefolgeSpawnen(scene, fuehrer, plan.gefolge, affix, Math.random);
              spawned += folge.length;
              ziel = Math.max(plan.gesamt, spawned + 1);   // ein Fremder bleibt
              spawnedEnemiesInWave = spawned;
              if (window.DebugGate && window.DebugGate.aktiv() && typeof console !== 'undefined') {
                console.log('[Kriegsschar] Bannertraeger (Typ ' + fuehrer.enemyType
                  + ') + ' + folge.length + ' Gefolge, geerbter Affix: ' + (affix || 'keiner')
                  + ' — Raum bekommt ' + ziel + ' Gegner statt ' + total);
              }
            }
          }
        } catch (e) { /* eine fehlende Schar darf die Welle nie brechen */ }
        while (spawned < ziel) {
          const enemy = spawnEnemy.call(scene, 0, 0, 'enemy');
          if (!enemy) break;
          spawned += 1;
          spawnedEnemiesInWave = spawned;
        }

        // Mini-boss = Run-Climax im finalen Raum (isMiniBossWave, #65: ab Tiefe 1).
        // baseType 0 -> spawnMiniBoss zieht einen zufaelligen Typ aus dem Pool.
        if (isMiniBossWave && typeof spawnMiniBoss === 'function') {
          const miniBoss = spawnMiniBoss.call(scene, 0, 0, 0);
          if (miniBoss) {
            spawned += 1;
            spawnedEnemiesInWave = spawned;
            // Update total to include mini-boss for wave-end check
            enemiesPerWave = window.enemiesPerWave = spawned;
            // Treppe SPERREN, bis der Mini-Boss besiegt ist — kein Vorbeilaufen.
            // Entsperrt wird in checkWaveEnd, sobald der getrackte Mini-Boss tot ist.
            window.__climaxEnemy = miniBoss;
            if (typeof window.lockStairs === 'function' && scene.stairsGroup) {
              try { window.lockStairs(scene, true); } catch (e) {}
            }
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
  // Mini-Boss-Klimax: die Treppe bleibt gesperrt, bis der getrackte Mini-Boss
  // besiegt (nicht mehr aktiv) ist — dann sofort freigeben, auch wenn noch Trash
  // lebt (der Mini-Boss ist die Bedingung, nicht der ganze Raum).
  if (window.__climaxEnemy) {
    if (!window.__climaxEnemy.active) {
      // ERST entsperren, DANN den Merker verbrauchen.
      //
      // Vorher stand es umgekehrt: der Merker wurde geloescht, bevor die
      // Entsperrung ueberhaupt versucht wurde. Schlug sie fehl — kein `this`,
      // oder stairsGroup im Raumwechsel noch nicht da — blieb die Treppe
      // DAUERHAFT gesperrt, denn einen zweiten Versuch gab es nicht. Der
      // Spieler waere im Boss-Raum eingesperrt und muesste das Portal nehmen.
      //
      // Im Testlauf gemessen: von 5 Boss-Siegen endeten 2 mit "Portal
      // (Stillstand)" statt "Dungeon abgeschlossen".
      //
      // Bleibt der Merker stehen, versucht es der naechste Frame erneut.
      var entsperrt = false;
      if (typeof window.lockStairs === 'function' && this && this.stairsGroup) {
        try { window.lockStairs(this, false); entsperrt = true; } catch (e) {}
      }
      if (entsperrt) window.__climaxEnemy = null;
    }
  }

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

    // Feature 061: dem aktiven Raum-Modus die geräumte Welle melden. Nur der
    // `clear`-Modus schaltet die Treppe über DIESE Kette frei — andere Modi
    // haben ihre eigene Abschluss-Bedingung (und tun es aus updateActive).
    if (window.RoomMode && typeof window.RoomMode.onWaveCleared === 'function') {
      try { window.RoomMode.onWaveCleared(); } catch (e) {}
    }
    const _modeAllowsUnlock = !window.RoomMode
      || typeof window.RoomMode.allowWaveClearUnlock !== 'function'
      || window.RoomMode.allowWaveClearUnlock();

    // Brief breathing room after clearing a wave before unlocking stairs
    if (waveText) waveText.setText((window.roomProgressText ? window.roomProgressText + '  |  ' : '') + 'Wave Cleared!');
    const scene = this;
    if (_modeAllowsUnlock) {
      // Raum-ID beim Auslösen festhalten: der 2s-Delay + die schon offene Treppe
      // erlauben, dass der Spieler den Raum vorher verlässt -> markRoomCleared
      // darf dann NICHT im neuen Raum den Reward spawnen (an forRoomId gebunden).
      const _clearedRoomId = (typeof window.currentRoomId === 'number') ? window.currentRoomId : undefined;
      if (scene?.time?.delayedCall) {
        scene.time.delayedCall(2000, () => {
          if (typeof markRoomCleared === 'function') markRoomCleared({ forRoomId: _clearedRoomId });
        });
      } else {
        if (typeof markRoomCleared === 'function') markRoomCleared({ forRoomId: _clearedRoomId });
      }
    } else if (window.RoomMode && typeof window.RoomMode.isObjectiveComplete === 'function'
               && window.RoomMode.isObjectiveComplete()
               && typeof window.showRoomClearedToast === 'function') {
      // Spezialraum: Ziel war schon erfüllt (Treppe längst offen). Jetzt ist der
      // Raum WIRKLICH leergeräumt -> erst hier den "Raum gecleart"-Flavor-Toast.
      try { window.showRoomClearedToast(); } catch (e) {}
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
  obstacles.__steerRects = null; // Perf-Cache (#70) invalidieren: Hindernisse neu

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

    // #70: Atlas-Frame statt Einzeltextur, wenn vorhanden (Batching).
    const _ta = (typeof window.worldTexArgs === 'function') ? window.worldTexArgs(key) : [key, undefined];
    const obs = obstacles
      .create(x, y, _ta[0], _ta[1])
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
