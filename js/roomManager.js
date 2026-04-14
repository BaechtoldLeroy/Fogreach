// roomManager.js

// Globale Raumdaten
let rooms = [];
let currentRoomId = 0;

// Optional: Basisgröße für Räume
const ROOM_W = 1200;
const ROOM_H = 600;

// ---- Dungeon-Run State ----
// Holds the procedural run configuration for the current dungeon visit.
let dungeonRun = null; // { templateOrder: string[], totalRooms: number, currentIndex: number }

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Compute how many rooms this run should have.
 * Base 5, +1 per 5 dungeon depth levels, max 10.
 */
function computeRunRoomCount() {
  const depth = Math.max(1, window.DUNGEON_DEPTH || 1);
  return Math.min(12, 7 + Math.floor((depth - 1) / 5));
}

// ---- Story Room Descriptions (German) ----
const ROOM_DESCRIPTIONS = {
  'RathausArchive': 'Rathaus-Archiv \u2014 Verbotene Protokolle lagern hier...',
  'RitualVault':    'Ritualkammer \u2014 Daemonische Energie pulsiert in der Luft...',
  'PrisonDepths':   'Kerkertiefen \u2014 Schreie hallen durch die Gaenge...',
  'CouncilChamber': 'Ratskammer \u2014 Der Thron des Kettenrats steht verlassen...',
  'ForgottenCrypt': 'Vergessene Krypta \u2014 Uralte Siegel leuchten schwach...'
};

// Story-themed room pools by act/wave depth
const STORY_ROOMS = {
  act2: ['RathausArchive', 'PrisonDepths'],
  act3: ['RitualVault', 'ForgottenCrypt'],
  act4: ['CouncilChamber']
};

// Final room for milestone waves
const MILESTONE_FINAL_ROOMS = {
  10: 'RathausArchive',
  20: 'RitualVault',
  30: 'CouncilChamber'
};

/**
 * Determine which story act the player is in based on dungeon depth.
 */
function getStoryAct(depth) {
  if (depth >= 30) return 4;
  if (depth >= 20) return 3;
  if (depth >= 10) return 2;
  return 1;
}

/**
 * Initialise a new procedural dungeon run.
 * Shuffles the full template pool and picks `totalRooms` unique templates.
 * Story rooms are mixed in based on the current act (wave depth).
 */
function initDungeonRun() {
  if (window.EventSystem && window.EventSystem.reset) window.EventSystem.reset();
  const RT = window.RoomTemplates || {};
  const allNames = Object.keys(RT.TEMPLATES || {});
  if (!allNames.length) {
    // Fallback to manifest
    allNames.push(...(RT.MANIFEST || []));
  }

  const totalRooms = computeRunRoomCount();
  const depth = Math.max(1, window.DUNGEON_DEPTH || 1);
  const act = getStoryAct(depth);

  // Separate regular rooms from story rooms
  const allStoryNames = [].concat(STORY_ROOMS.act2, STORY_ROOMS.act3, STORY_ROOMS.act4);
  const regularNames = allNames.filter(function(n) { return allStoryNames.indexOf(n) === -1; });

  // Determine which story rooms are available for this act
  var storyPool = [];
  if (act >= 2) storyPool = storyPool.concat(STORY_ROOMS.act2);
  if (act >= 3) storyPool = storyPool.concat(STORY_ROOMS.act3);
  if (act >= 4) storyPool = storyPool.concat(STORY_ROOMS.act4);

  // Shuffle both pools
  shuffleArray(regularNames);
  shuffleArray(storyPool);

  // Build template order: mix regular and story rooms
  var templateOrder = [];

  // Determine final room based on milestone depth
  var finalRoom = null;
  if (MILESTONE_FINAL_ROOMS[depth] && allNames.indexOf(MILESTONE_FINAL_ROOMS[depth]) !== -1) {
    finalRoom = MILESTONE_FINAL_ROOMS[depth];
  }

  // Pick rooms: for acts 2+, include 1-2 story rooms in the middle
  var storyCount = 0;
  if (act >= 2 && storyPool.length > 0) {
    storyCount = Math.min(2, storyPool.length, Math.floor(totalRooms / 3));
  }

  // Fill regular rooms first (minus story slots and final room slot)
  var regularCount = totalRooms - storyCount - (finalRoom ? 1 : 0);
  for (var i = 0; i < regularCount && i < regularNames.length; i++) {
    templateOrder.push(regularNames[i]);
  }

  // Insert story rooms at roughly even intervals
  for (var s = 0; s < storyCount && s < storyPool.length; s++) {
    var insertAt = Math.floor((s + 1) * templateOrder.length / (storyCount + 1));
    // Don't insert a room that's also the final room
    if (storyPool[s] !== finalRoom) {
      templateOrder.splice(insertAt, 0, storyPool[s]);
    } else {
      // Pick another regular room instead
      var extra = regularNames[regularCount + s];
      if (extra) templateOrder.splice(insertAt, 0, extra);
    }
  }

  // Add final room
  if (finalRoom) {
    templateOrder.push(finalRoom);
  }

  // Inject 1-2 procedural rooms into the run for variety
  if (window.ProceduralRooms && window.RoomTemplates) {
    var procCount = 1 + Math.floor(Math.random() * 2); // 1-2 rooms
    for (var pi = 0; pi < procCount; pi++) {
      var procWidth = 80 + Math.floor(Math.random() * 40);  // 80-120
      var procHeight = 80 + Math.floor(Math.random() * 40); // 80-120
      var procName = 'Procedural_' + Date.now() + '_' + pi;
      var procTpl = window.ProceduralRooms.generate({
        width: procWidth,
        height: procHeight,
        name: procName
      });
      window.RoomTemplates.TEMPLATES[procName] = procTpl;
      // Insert at a random mid position (not first, not last)
      var insertPos = 1 + Math.floor(Math.random() * Math.max(1, templateOrder.length - 2));
      templateOrder.splice(insertPos, 0, procName);
    }
  }

  // Pad if needed
  while (templateOrder.length < totalRooms) {
    var padIdx = templateOrder.length % regularNames.length;
    templateOrder.push(regularNames[padIdx]);
  }

  // Trim if over
  if (templateOrder.length > totalRooms) {
    templateOrder.length = totalRooms;
  }

  dungeonRun = {
    templateOrder: templateOrder,
    totalRooms: totalRooms,
    currentIndex: 0
  };

  window.dungeonRun = dungeonRun;
  console.log('[DungeonRun] Act ' + act + ' | Initialized run with ' + totalRooms + ' rooms:', templateOrder);
  return dungeonRun;
}

function createRooms() {
  // Init the procedural run
  initDungeonRun();

  const rightPadding = typeof WORLD_RIGHT_PADDING === 'number' ? WORLD_RIGHT_PADDING : 0;
  const roomWidth = ROOM_W + rightPadding;

  // Create room entries for each room in the run
  rooms = [];
  for (let i = 0; i < dungeonRun.totalRooms; i++) {
    rooms.push(makeRoom(i, {
      exits: i < dungeonRun.totalRooms - 1
        ? [{
            to: i + 1,
            x: roomWidth - Phaser.Math.Between(20, 1000),
            y: ROOM_H - Phaser.Math.Between(20, 400),
          }]
        : [] // Last room: no exit (will trigger hub return)
    }));
  }
}

function makeRoom(id, opts) {
  const rightPadding = typeof WORLD_RIGHT_PADDING === 'number' ? WORLD_RIGHT_PADDING : 0;
  return {
    id,
    width: ROOM_W + rightPadding,
    height: ROOM_H,
    w: ROOM_W + rightPadding,
    h: ROOM_H,
    exits: opts.exits || [], // Treppen/Übergänge
    // pro Raum eigene Wave-Parameter (du kannst das verfeinern)
    enemiesPerWave: 4,
    wave: 1,
    cleared: false,
  };
}

function ensureObstacleColliders(scene) {
  if (!scene || !obstacles || typeof obstacles.getChildren !== 'function') return;
  const world = scene.physics?.world;
  if (!world) return;
  const staticBodyType = Phaser?.Physics?.Arcade?.STATIC_BODY;

  obstacles.getChildren().forEach((child) => {
    if (!child) return;
    if (!child.body) {
      if (staticBodyType) world.enable(child, staticBodyType);
      else {
        world.enable(child);
      }
    }
    if (child.body) {
      child.body.setAllowGravity?.(false);
      child.body.setImmovable?.(true);
      child.body.moves = false;
      child.refreshBody?.();
    }
  });

  if (typeof obstacles.refresh === 'function') {
    obstacles.refresh();
  }
}

/**
 * Betritt einen Raum: setzt WorldBounds, platziert Hindernisse,
 * baut Treppen, sperrt sie bis Raumwelle clear ist.
 */
function enterRoom(scene, roomId) {
  currentRoomId = roomId;

  let room = rooms[roomId];

  if (!scene || !room) {
    //createRooms();
    room = rooms[roomId];
  }

  // 1) Alles Alte bereinigen
  const rightPadding = typeof WORLD_RIGHT_PADDING === 'number' ? WORLD_RIGHT_PADDING : 0;
  scene.physics.world.setBounds(0, 0, ROOM_W + rightPadding, ROOM_H); // wird gleich auf echte Raumgroesse aktualisiert
  scene.cameras.main.setBounds(0, 0, ROOM_W + rightPadding, ROOM_H);

  enemies?.clear(true, true);
  enemyProjectiles?.clear(true, true);
  // Pool sprites were just destroyed by the group clear above; reset the pool
  // so we don't hand out dead references.
  if (scene) scene._enemyProjectilePool = [];
  lootGroup?.clear(true, true);
  if (Array.isArray(scene?._activeLootSprites)) {
    scene._activeLootSprites.slice().forEach((loot) => loot?.destroy?.());
    scene._activeLootSprites.length = 0;
  } else if (scene) {
    scene._activeLootSprites = [];
  }
  if (scene) {
    if (Array.isArray(scene._templateWalls)) {
      scene._templateWalls.forEach((wall) => wall?.destroy?.());
      scene._templateWalls.length = 0;
    } else {
      scene._templateWalls = [];
    }
    // Remove baked floor textures from the texture cache so we don't leak
    // canvases on every room transition.
    if (Array.isArray(scene._bakedFloorKeys)) {
      scene._bakedFloorKeys.forEach((key) => {
        try { scene.textures.removeKey(key); } catch (err) { /* ignore */ }
      });
      scene._bakedFloorKeys.length = 0;
    }
  }
  if (obstacles && typeof obstacles.clear === 'function') {
    obstacles.clear(true, true);
  }

  const needsNewStairsGroup =
    !scene.stairsGroup ||
    scene.stairsGroup.scene !== scene ||
    !scene.stairsGroup.children ||
    typeof scene.stairsGroup.children.size !== 'number';

  if (needsNewStairsGroup) {
    if (scene.stairsGroup?.destroy) {
      try {
        scene.stairsGroup.destroy(true);
      } catch (err) {
        console.warn('[enterRoom] old stairsGroup destroy failed', err);
      }
    }
    scene.stairsGroup = scene.physics.add.staticGroup();
  } else {
    scene.stairsGroup.clear(true, true);
  }

  // Fog reset
  scene.exploredRT?.clear();
  scene.spotlightRT?.clear();

  // 1) Raum bauen: use procedural template from dungeon run if available
  let builtMeta = null;
  let pickedType = null;

  const templateName = dungeonRun && dungeonRun.templateOrder[roomId];
  if (templateName) {
    builtMeta = buildTemplateRoom(scene, templateName);
    pickedType = "template";
  }
  if (!builtMeta) {
    // Fallback: random pick from pool
    builtMeta = buildTemplateRoom(scene);
    pickedType = "template";
  }
  if (!builtMeta) {
    builtMeta = buildRandomRoom(scene, room);
    pickedType = "random";
  }

  // Update dungeon run index
  if (dungeonRun) {
    dungeonRun.currentIndex = roomId;
    window.dungeonRun = dungeonRun;
  }

  // Update room counter HUD
  if (typeof updateRoomCounter === 'function') {
    updateRoomCounter(roomId, dungeonRun ? dungeonRun.totalRooms : rooms.length);
  }

  // Trigger random event system
  if (window.EventSystem && typeof window.EventSystem.onRoomEnter === 'function') {
    window.EventSystem.onRoomEnter(scene, roomId);
  }

  const builtWidth = (builtMeta?.w ?? room?.width ?? ROOM_W) + rightPadding;
  const builtHeight = builtMeta?.h ?? room?.height ?? ROOM_H;

  scene.physics.world.setBounds(0, 0, builtWidth, builtHeight);
  scene.cameras.main.setBounds(0, 0, builtWidth, builtHeight);

  ensureObstacleColliders(scene);

  if (scene._playerObstacleCollider) {
    scene._playerObstacleCollider.destroy();
    scene._playerObstacleCollider = null;
  }
  if (scene._enemyObstacleCollider) {
    scene._enemyObstacleCollider.destroy();
    scene._enemyObstacleCollider = null;
  }
  if (scene._projectileObstacleCollider) {
    scene._projectileObstacleCollider.destroy();
    scene._projectileObstacleCollider = null;
  }
  scene._playerObstacleCollider = scene.physics.add.collider(player, obstacles);
  scene._enemyObstacleCollider = scene.physics.add.collider(enemies, obstacles);
  scene._projectileObstacleCollider = scene.physics.add.collider(enemyProjectiles, obstacles, (proj) => {
    if (proj && proj.active) {
      if (typeof window.releaseEnemyProjectile === 'function') {
        window.releaseEnemyProjectile(proj);
      } else {
        proj.destroy();
      }
    }
  });

  recomputeAccessibleArea(scene);

  // 2) Stairs aufbauen und sperren
  scene.stairsGroup.clear(true, true);
  const doorList = builtMeta.doors && builtMeta.doors.length > 0
    ? builtMeta.doors
    : [{ x: (builtMeta.w || 800) / 2, y: (builtMeta.h || 600) - 64, dir: null }]; // fallback door
  doorList.forEach((d) => {
    // Offset stair away from wall into room interior
    let sx = d.x, sy = d.y;
    const dir = d.dir || '';
    if (dir === 'N' || dir === 'n') sy += 64;       // wall at top → move down
    else if (dir === 'S' || dir === 's') sy -= 64;   // wall at bottom → move up
    else if (dir === 'W' || dir === 'w') sx += 64;   // wall at left → move right
    else if (dir === 'E' || dir === 'e') sx -= 64;   // wall at right → move left
    else sy -= 48; // default: assume bottom wall

    const STAIR_HALF = 44; // 80px display + 8px margin
    const STAIR_HALF_SQ = STAIR_HALF * STAIR_HALF;

    // Helper: does any object (physics obstacle OR visual-only template wall)
    // overlap a square area of side 2*STAIR_HALF centered on (cx, cy)?
    const checkBucket = (list, cx, cy) => {
      if (!list) return null;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o || (o.active === false)) continue;
        if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
        // Skip the room-wide floor image — it covers the whole room and would
        // otherwise be wrongly destroyed by the stair-clear fallback below.
        if (o.getData && o.getData('isFloor')) continue;
        const ox = o.x, oy = o.y;
        const ohw = (o.displayWidth || 32) / 2 + STAIR_HALF;
        const ohh = (o.displayHeight || 32) / 2 + STAIR_HALF;
        if (Math.abs(ox - cx) < ohw && Math.abs(oy - cy) < ohh) {
          return o;
        }
      }
      return null;
    };
    const obstacleAt = (cx, cy) => {
      const fromPhysics = scene.obstacles && scene.obstacles.getChildren
        ? checkBucket(scene.obstacles.getChildren(), cx, cy)
        : null;
      if (fromPhysics) return fromPhysics;
      // Visual-only objects (statues etc. that were too close to a wall to
      // become physics obstacles) live on scene._templateWalls.
      return checkBucket(scene._templateWalls, cx, cy);
    };

    // 1) First try to NUDGE the stair to a nearby clear spot. This handles
    //    the common case where the door-derived position lands on a brazier
    //    or pillar without sacrificing decorative obstacles.
    const NUDGE_OFFSETS = [
      [0, 0],
      [48, 0], [-48, 0], [0, 48], [0, -48],
      [48, 48], [-48, 48], [48, -48], [-48, -48],
      [96, 0], [-96, 0], [0, 96], [0, -96],
    ];
    let placedX = sx, placedY = sy;
    let foundClear = false;
    for (const [dx, dy] of NUDGE_OFFSETS) {
      const tx = sx + dx, ty = sy + dy;
      if (!obstacleAt(tx, ty)) {
        placedX = tx;
        placedY = ty;
        foundClear = true;
        break;
      }
    }

    // 2) If every nearby position is blocked, fall back to (sx, sy) and
    //    forcibly remove any obstacles that overlap it. The stair MUST
    //    exist near the door so the player can reach the next room.
    if (!foundClear) {
      let blocker;
      let safety = 12;
      while (safety-- > 0 && (blocker = obstacleAt(placedX, placedY))) {
        if (blocker.body) blocker.body.enable = false;
        // Also remove from templateWalls cache if present, so it doesn't
        // get re-checked in the next iteration.
        if (Array.isArray(scene._templateWalls)) {
          const i = scene._templateWalls.indexOf(blocker);
          if (i >= 0) scene._templateWalls.splice(i, 1);
        }
        blocker.destroy();
      }
    }

    const stair = scene.stairsGroup.create(placedX, placedY, "stairDown");
    stair.setData("locked", true);
    stair.setData("dir", d.dir || null);
    // Scale 500x500 source down to ~80px tile-fit display size
    stair.setDisplaySize(80, 80);
    // Fixed depth 40: above floor decorations (depth 0-30) but below the
    // enemy layer (depth 50) and player (>= 100), so enemies and the player
    // always render on top of the stair tile.
    stair.setAlpha(0.95).setDepth(40).refreshBody();
  });

  // Overlap Spieler ↔ Stairs
  // Tear down any previous overlap registration so we don't accumulate
  // stale callbacks on every room transition.
  if (scene._playerStairsOverlap && scene._playerStairsOverlap.destroy) {
    try { scene._playerStairsOverlap.destroy(); } catch (err) { /* ignore */ }
    scene._playerStairsOverlap = null;
  }
  scene._playerStairsOverlap = scene.physics.add.overlap(
    player,
    scene.stairsGroup,
    onStairOverlap,
    null,
    scene,
  );

  // 3) Raumstatus setzen
  scene.currentRoom = {
    id: roomId,
    name: builtMeta.name,
    origin: builtMeta.origin,
    w: builtMeta.w,
    h: builtMeta.h,
    doors: builtMeta.doors,
    kind: pickedType,
    isLarge: !!builtMeta.isLarge,
    enteredAt: scene.time?.now ?? performance.now()
  };

  // Grace period: enemies are frozen for 500ms after room entry so the
  // player isn't ambushed before they can orient themselves.
  const nowMs = scene.time?.now ?? performance.now();
  scene._enemyAttackGraceUntil = nowMs + 500;

  // Show story room description overlay
  var roomDescText = ROOM_DESCRIPTIONS[templateName];
  if (roomDescText && scene && scene.add) {
    var camW = scene.cameras.main.width;
    var descLabel = scene.add.text(camW / 2, 60, roomDescText, {
      fontSize: '18px',
      fill: '#ffea6a',
      fontStyle: 'italic',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 16, y: 8 },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setAlpha(1);
    scene.tweens.add({
      targets: descLabel,
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: function() { descLabel.destroy(); }
    });
  }

  scene._largeRoomIsActive = !!builtMeta.isLarge;
  scene._largeRoomEnterTime = scene.currentRoom.enteredAt;
  scene._largeRoomHintShown = false;
  scene._largeRoomHintUnlocked = false;
  if (typeof LARGE_ROOM_HINT_DELAY === 'number') {
    scene._largeRoomHintUnlockAt = scene._largeRoomIsActive
      ? scene._largeRoomEnterTime + LARGE_ROOM_HINT_DELAY
      : Infinity;
  } else {
    scene._largeRoomHintUnlockAt = Infinity;
  }
  if (Array.isArray(scene._enemyDirectionIndicators)) {
    scene._enemyDirectionIndicators.forEach((indicator) => indicator?.label?.destroy?.());
  }
  scene._enemyDirectionIndicators = null;
  if (typeof hideEnemyDirectionIndicators === 'function') {
    hideEnemyDirectionIndicators(scene);
  }

  // 4) Waves fuer den Raum setzen
  window.waveInProgress = false;
  window.spawnedEnemiesInWave = 0;

  let savedDepth = window.DUNGEON_DEPTH;
  if (typeof savedDepth !== 'number' || !isFinite(savedDepth)) {
    savedDepth = room?.wave || 1;
  }

  let depth;
  if (typeof window.SELECTED_WAVE_OVERRIDE === 'number') {
    depth = Math.max(1, Math.round(window.SELECTED_WAVE_OVERRIDE));
    window.SELECTED_WAVE_OVERRIDE = null;
  } else {
    depth = Math.max(1, Math.round(savedDepth));
  }

  window.DUNGEON_DEPTH = depth;
  window.NEXT_DUNGEON_DEPTH = depth + 1;
  if (room) room.wave = depth;

  const targetWave = Math.max(1, depth);
  const builtW = builtMeta?.w ?? room?.width ?? ROOM_W;
  const builtH = builtMeta?.h ?? room?.height ?? ROOM_H;
  const roomAreaPx = builtW * builtH;
  const baseEnemies =
    typeof window.computeWaveEnemyTotal === "function"
      ? window.computeWaveEnemyTotal(targetWave, roomAreaPx)
      : 4 + (targetWave - 1) * 2;

  // Difficulty scaling based on room position within the run.
  // Earlier rooms are easier (fewer enemies), later rooms are harder.
  // Final room always gets the full difficulty boost.
  const totalRooms = dungeonRun ? dungeonRun.totalRooms : rooms.length;
  let roomDifficultyMult = 1.0;
  if (totalRooms > 1) {
    const progress = roomId / (totalRooms - 1); // 0.0 to 1.0
    // Scale from 0.6x (first room) to 1.4x (last room)
    roomDifficultyMult = 0.6 + 0.8 * progress;
  }
  const scaledEnemies = Math.max(2, Math.round(baseEnemies * roomDifficultyMult));

  enemiesPerWave = window.enemiesPerWave = scaledEnemies;
  if (room) room.enemiesPerWave = scaledEnemies;
  currentWave = Math.max(0, depth - 1);
  window.currentWave = currentWave;


  // 5) Türen sperren bis Clear
  lockStairs(scene, true);


  // 6) Start der Welle
  if (typeof startNextWave === "function") {
    startNextWave.call(scene, false);
    window.currentWave = currentWave;
  }
}

function onStairOverlap(player, stair) {
  // nur wenn freigeschaltet
  if (stair.getData("locked")) return;

  const nextIndex = currentRoomId + 1;
  const totalRooms = dungeonRun ? dungeonRun.totalRooms : rooms.length;

  // Last room cleared -> return to hub
  if (nextIndex >= totalRooms) {
    const scene = obstacles.scene;
    if (typeof leaveDungeonForHub === 'function') {
      leaveDungeonForHub(scene, { reason: 'dungeon_complete' });
    }
    return;
  }

  const depthBase = Math.max(
    1,
    typeof window.NEXT_DUNGEON_DEPTH === 'number' && isFinite(window.NEXT_DUNGEON_DEPTH)
      ? window.NEXT_DUNGEON_DEPTH
      : (window.DUNGEON_DEPTH || 1) + 1,
    (currentWave || 0) + 1
  );
  window.SELECTED_WAVE_OVERRIDE = depthBase;

  // Betritt naechsten Raum
  enterRoom(obstacles.scene, nextIndex);
}

/** Türen/Treppen sperren/freischalten */
function lockStairs(scene, lock) {
  scene.stairsGroup.children.iterate(
    (s) => s && s.setData("locked", !!lock) && s.setAlpha(lock ? 0.6 : 1),
  );
}

/**
 * Raum „cleared“ markieren und Türen freischalten.
 * Aufrufst du, wenn Raum‑Wave erledigt ist.
 */
function markRoomCleared() {
  const scene = obstacles.scene;
  const room = rooms[currentRoomId];
  if (!scene || !room) return;

  room.cleared = true;
  lockStairs(scene, false);
  // Quest progress: room cleared
  if (window.questSystem && typeof window.questSystem.updateQuestProgress === 'function') {
    window.questSystem.updateQuestProgress('explore', 'room', 1);
  }
  // Story stats: room cleared
  if (window.storySystem && typeof window.storySystem.onRoomCleared === 'function') {
    window.storySystem.onRoomCleared();
  }
  // Nächste Raum‑Wave vorbereiten (wenn du pro Raum mehrere willst)
  room.wave += 1;
  // Aktualisiere gespeicherte Gegnerzahl anhand der festen Progression
  room.enemiesPerWave =
    typeof window.computeWaveEnemyTotal === "function"
      ? window.computeWaveEnemyTotal(room.wave)
      : 4 + Math.max(0, room.wave - 1) * 2;
  const completed = Math.max(currentWave || 1, window.DUNGEON_DEPTH || 1);
  window.DUNGEON_DEPTH = completed;
  window.NEXT_DUNGEON_DEPTH = completed + 1;
  saveGame(scene);
}

function initFogOfWar() {
  const scene = this;
  const W = scene.scale.width;
  const H = scene.scale.height;
  const camZoom = scene.cameras?.main?.zoom || 1;
  const fogW = Math.ceil(W / camZoom) + 20;
  const fogH = Math.ceil(H / camZoom) + 20;

  scene.exploredRT = scene.make
    .renderTexture({ x: 0, y: 0, width: W, height: H, add: false })
    .setOrigin(0, 0)
    .setScrollFactor(0);

  scene.spotlightRT = scene.make
    .renderTexture({ x: 0, y: 0, width: W, height: H, add: true })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(900);

  scene._visionGfx = scene.add
    .graphics()
    .setScrollFactor(0)
    .setDepth(899)
    .setVisible(false);

  // Oversize fogUnseen to cover viewport edges at low zoom
  scene.fogUnseen = scene.add.graphics().setScrollFactor(0).setDepth(1000);
  scene.fogUnseen.fillStyle(0x000000, 1);
  scene.fogUnseen.fillRect(-(fogW - W) / 2, -(fogH - H) / 2, fogW, fogH);
  scene.fogUnseenMask = new Phaser.Display.Masks.BitmapMask(
    scene,
    scene.exploredRT,
  );
  scene.fogUnseen.setMask(scene.fogUnseenMask);
  scene.fogUnseen.mask.invertAlpha = true;

  // Gegner-Masken-Gfx bleibt wie gehabt
  scene._enemyVisionMaskGfx = scene.add
    .graphics()
    .setVisible(false)
    .setScrollFactor(1);
  scene._enemyVisionMask = scene._enemyVisionMaskGfx.createGeometryMask();
  scene._enemyVisionMask.setInvertAlpha(false);
  if (scene.enemyLayer) scene.enemyLayer.setMask(scene._enemyVisionMask);

  // optionale Felder fuer Throttling
  scene._lastVisX = scene._lastVisY = undefined;
  scene._visTick = 0;
}

function updateFogOfWar() {
  const scene = this;
  if (!scene.spotlightRT || !scene.exploredRT || !player) return;

  const cam = scene.cameras.main;
  const px = player.x,
    py = player.y;

  // 1) Welt-Polygon
  const ptsWorld = computeVisionPolygon(scene, px, py);

  // 2) Explored-Stamp mit Pad, damit Waende nicht schwarz bleiben
  const ptsScreenExplored = ptsWorld.map((p) => ({
    x: p.x + p.dx * VISION_PAD_EXPLORED - cam.scrollX,
    y: p.y + p.dy * VISION_PAD_EXPLORED - cam.scrollY,
  }));
  scene._visionGfx.clear().fillStyle(0xffffff, 1);
  drawFilledPolygon(scene._visionGfx, ptsScreenExplored);
  scene.exploredRT.draw(scene._visionGfx);

  // 3) Spotlight-Loch mit UI-Pad
  const ptsScreenUI = ptsWorld.map((p) => ({
    x: p.x + p.dx * VISION_PAD_UI - cam.scrollX,
    y: p.y + p.dy * VISION_PAD_UI - cam.scrollY,
  }));
  scene.spotlightRT.clear();
  scene.spotlightRT.fill(0x000000, 0.4);
  scene._visionGfx.clear().fillStyle(0xffffff, 1);
  drawFilledPolygon(scene._visionGfx, ptsScreenUI);
  scene.spotlightRT.erase(scene._visionGfx);

  // 4) Gegner-Maske mit kleinem Pad
  if (scene._enemyVisionMaskGfx) {
    const g = scene._enemyVisionMaskGfx;
    g.clear().fillStyle(0xffffff, 1);
    const ptsEnemy = ptsWorld.map((p) => ({
      x: p.x + p.dx * VISION_PAD_ENEMY,
      y: p.y + p.dy * VISION_PAD_ENEMY,
    }));
    drawFilledPolygon(g, ptsEnemy);
  }

  scene._visionGfx.clear();
}

function buildRandomRoom(scene, room) {
  // Hindernisse neu platzieren
  placeObstaclesForWave();

  // Doors aus room.exits
  const doors = (room.exits || []).map((ex) => ({
    x: ex.x,
    y: ex.y,
    dir: ex.dir || null,
  }));
  if (obstacles && typeof obstacles.refresh === 'function') {
    obstacles.refresh();
  } else if (obstacles && obstacles.children) {
    obstacles.children.iterate((child) => child?.refreshBody?.());
  }
  return {
    type: "random",
    name: room.name || "Random",
    origin: { x: 0, y: 0 },
    w: room.width || room.w,
    h: room.height || room.h,
    doors,
  };
}

// --- Vision Tuning ---
const VISION_RADIUS = 220;
const VISION_RAYS = 192;
const VISION_STEP = 4; // feiner an die Wand
const VISION_WALL_BACKOFF = 0; // nicht vor der Wand zurueckspringen
const VISION_PAD_EXPLORED = 64; // wie weit "in die Wand" als bereits gesehen
const VISION_PAD_UI = 64; // Spotlight-Loch
const VISION_PAD_ENEMY = 64; // Gegner-Maske

function isBlockedByObstacle(x, y) {
  const list = obstacles?.getChildren?.() || [];
  for (let i = 0; i < list.length; i++) {
    const go = list[i];
    if (!go || !go.texture || go.texture.key !== "obstacleWall") continue; // nur Waende blocken

    const b = go.body;
    if (!b || !b.enable) continue;

    if (typeof b.hitTest === "function") {
      if (b.hitTest(x, y)) return true;
    } else {
      const r = b.getBounds ? b.getBounds() : go.getBounds?.();
      if (r && r.contains(x, y)) return true;
    }
  }
  return false;
}

const VISION_MIN_RADIUS = 80; // Vision klippt nie enger als 80px

function computeVisionPolygon(scene, ox, oy) {
  const pts = [];
  for (let i = 0; i < VISION_RAYS; i++) {
    const t = (i / VISION_RAYS) * Math.PI * 2;
    const dx = Math.cos(t),
      dy = Math.sin(t);

    let hitX = ox + dx * VISION_RADIUS;
    let hitY = oy + dy * VISION_RADIUS;

    for (let r = VISION_STEP; r <= VISION_RADIUS; r += VISION_STEP) {
      const px = ox + dx * r;
      const py = oy + dy * r;
      if (isBlockedByObstacle(px, py)) {
        // Mindest-Sichtradius erzwingen, damit Vision an Waenden nicht klippt
        const clampedR = Math.max(r, VISION_MIN_RADIUS);
        hitX = ox + dx * clampedR;
        hitY = oy + dy * clampedR;
        break;
      }
    }
    // merke Treffpunkt und Ray-Richtung
    pts.push({ x: hitX, y: hitY, dx, dy });
  }
  return pts;
}

function drawFilledPolygon(gfx, pts) {
  if (!pts || pts.length < 3) return;
  gfx.beginPath();
  gfx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i].x, pts[i].y);
  gfx.closePath();
  gfx.fillPath();
}

const ROOM_SPAWN_HALF_SIZE = 8;
const ROOM_SPAWN_PAD = 0;
const ACCESS_GRID_SIZE = 32;
const MIN_PLAYER_SPAWN_DISTANCE = 160;

function isSpawnPositionBlocked(px, py, halfSize = ROOM_SPAWN_HALF_SIZE) {
  if (!obstacles || typeof obstacles.getChildren !== "function") return false;
  if (!Phaser || !Phaser.Geom || !Phaser.Geom.Rectangle) return false;

  const candidateRect = new Phaser.Geom.Rectangle(
    px - halfSize,
    py - halfSize,
    halfSize * 2,
    halfSize * 2
  );

  const list = obstacles.getChildren();
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (!o || !o.body || !o.body.enable) continue;

    const bounds = o.getBounds ? o.getBounds() : o.body?.getBounds?.();
    if (!bounds) continue;

    const inflated = new Phaser.Geom.Rectangle(
      bounds.x - ROOM_SPAWN_PAD,
      bounds.y - ROOM_SPAWN_PAD,
      bounds.width + ROOM_SPAWN_PAD * 2,
      bounds.height + ROOM_SPAWN_PAD * 2
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(candidateRect, inflated)) {
      return true;
    }
  }
  return false;
}

function recomputeAccessibleArea(scene, options = {}) {
  if (!scene || !scene.physics || !scene.physics.world) {
    if (scene) {
      scene._accessibleArea = null;
      scene.isPointAccessible = null;
      scene.pickAccessibleSpawnPoint = null;
    }
    return null;
  }

  const activePlayer = player && player.body ? player : null;
  if (!activePlayer) {
    scene._accessibleArea = null;
    scene.isPointAccessible = null;
    scene.pickAccessibleSpawnPoint = null;
    return null;
  }

  const bounds = scene.physics.world.bounds;
  if (!bounds) {
    scene._accessibleArea = null;
    scene.isPointAccessible = null;
    scene.pickAccessibleSpawnPoint = null;
    return null;
  }

  const cellSize = Math.max(16, Math.floor(options.cellSize || ACCESS_GRID_SIZE));
  const cols = Math.max(1, Math.ceil(bounds.width / cellSize));
  const rows = Math.max(1, Math.ceil(bounds.height / cellSize));
  const blockCache = new Map();
  const keyFor = (cx, cy) => `${cx}|${cy}`;

  const isBlocked = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
    const key = keyFor(cx, cy);
    if (blockCache.has(key)) return blockCache.get(key);

    const centerX = bounds.x + cx * cellSize + cellSize / 2;
    const centerY = bounds.y + cy * cellSize + cellSize / 2;
    let blocked = false;

    if (
      centerX - ROOM_SPAWN_HALF_SIZE < bounds.x ||
      centerX + ROOM_SPAWN_HALF_SIZE > bounds.x + bounds.width ||
      centerY - ROOM_SPAWN_HALF_SIZE < bounds.y ||
      centerY + ROOM_SPAWN_HALF_SIZE > bounds.y + bounds.height
    ) {
      blocked = true;
    } else {
      blocked = isSpawnPositionBlocked(centerX, centerY, ROOM_SPAWN_HALF_SIZE);
    }

    blockCache.set(key, blocked);
    return blocked;
  };

  let startCX = Phaser.Math.Clamp(Math.floor((activePlayer.x - bounds.x) / cellSize), 0, cols - 1);
  let startCY = Phaser.Math.Clamp(Math.floor((activePlayer.y - bounds.y) / cellSize), 0, rows - 1);

  if (isBlocked(startCX, startCY)) {
    let found = null;
    const maxRadius = Math.max(cols, rows);
    for (let radius = 1; radius < maxRadius && !found; radius++) {
      for (let dx = -radius; dx <= radius && !found; dx++) {
        for (let dy = -radius; dy <= radius && !found; dy++) {
          const cx = startCX + dx;
          const cy = startCY + dy;
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
          if (!isBlocked(cx, cy)) {
            found = { cx, cy };
          }
        }
      }
    }
    if (found) {
      startCX = found.cx;
      startCY = found.cy;
    }
  }

  if (isBlocked(startCX, startCY)) {
    scene._accessibleArea = null;
    scene.isPointAccessible = null;
    scene.pickAccessibleSpawnPoint = null;
    return null;
  }

  const queue = [{ cx: startCX, cy: startCY }];
  const visited = new Set([keyFor(startCX, startCY)]);
  const reachableCells = [];
  const fallbackCandidates = [];
  const spawnCandidates = [];
  const minDist = Math.max(0, options.minSpawnDistance || MIN_PLAYER_SPAWN_DISTANCE);
  const minDistSq = minDist * minDist;

  while (queue.length) {
    const { cx, cy } = queue.shift();
    const centerX = bounds.x + cx * cellSize + cellSize / 2;
    const centerY = bounds.y + cy * cellSize + cellSize / 2;

    reachableCells.push({ cx, cy, x: centerX, y: centerY });
    fallbackCandidates.push({ x: centerX, y: centerY });

    const dx = centerX - activePlayer.x;
    const dy = centerY - activePlayer.y;
    if (dx * dx + dy * dy >= minDistSq) {
      spawnCandidates.push({ x: centerX, y: centerY });
    }

    const neighbors = [
      { cx: cx + 1, cy },
      { cx: cx - 1, cy },
      { cx, cy: cy + 1 },
      { cx, cy: cy - 1 },
    ];

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n.cx < 0 || n.cy < 0 || n.cx >= cols || n.cy >= rows) continue;
      const key = keyFor(n.cx, n.cy);
      if (visited.has(key)) continue;
      if (isBlocked(n.cx, n.cy)) continue;
      visited.add(key);
      queue.push(n);
    }
  }

  const candidates = spawnCandidates.length ? spawnCandidates : fallbackCandidates.slice();
  const accessibleArea = {
    cellSize,
    cols,
    rows,
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    reachableCells,
    visited,
    spawnCandidates: candidates,
    fallbackCandidates,
    minSpawnDistance: minDist,
    jitter: Math.max(4, Math.floor(cellSize * 0.35)),
    updatedAt: (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(),
  };

  scene._accessibleArea = accessibleArea;

  scene.isPointAccessible = function isPointAccessible(x, y) {
    const grid = scene._accessibleArea;
    if (!grid) return true;
    const cx = Math.floor((x - grid.bounds.x) / grid.cellSize);
    const cy = Math.floor((y - grid.bounds.y) / grid.cellSize);
    if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return false;
    return grid.visited.has(`${cx}|${cy}`);
  };

  scene.pickAccessibleSpawnPoint = function pickAccessibleSpawnPoint(opts = {}) {
    const grid = scene._accessibleArea;
    if (!grid) return null;
    const pool = grid.spawnCandidates && grid.spawnCandidates.length
      ? grid.spawnCandidates
      : grid.fallbackCandidates;
    if (!pool || !pool.length) return null;

    const active = player && player.active ? player : null;
    const minDistance = Math.max(0, opts.minDistance ?? grid.minSpawnDistance);
    const minDistSqPick = minDistance * minDistance;
    const maxAttempts = Math.max(1, opts.maxAttempts ?? 24);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const idx = Math.floor(Math.random() * pool.length);
      const candidate = pool[idx];
      if (!candidate) continue;
      if (!active || !minDistSqPick) {
        return { x: candidate.x, y: candidate.y };
      }
      const dx = candidate.x - active.x;
      const dy = candidate.y - active.y;
      if (dx * dx + dy * dy >= minDistSqPick) {
        return { x: candidate.x, y: candidate.y };
      }
    }

    const fallback = pool[Math.floor(Math.random() * pool.length)];
    return fallback ? { x: fallback.x, y: fallback.y } : null;
  };

  return accessibleArea;
}

window.isSpawnPositionBlocked = isSpawnPositionBlocked;
window.recomputeAccessibleArea = recomputeAccessibleArea;

/**
 * Update room counter HUD text.
 * Called from enterRoom. The actual text element is created in main.js.
 */
function updateRoomCounter(roomIndex, totalRooms) {
  if (window._roomCounterText && window._roomCounterText.setText) {
    window._roomCounterText.setText('Raum ' + (roomIndex + 1) + '/' + totalRooms);
  }
  window.roomProgressText = 'Raum ' + (roomIndex + 1) + '/' + totalRooms;
}

// Export in globalen Namespace
window.createRooms = createRooms;
window.enterRoom = enterRoom;
window.markRoomCleared = markRoomCleared;
window.lockStairs = lockStairs;
window.rooms = () => rooms;
window.currentRoomId = () => currentRoomId;
window.initDungeonRun = initDungeonRun;
window.updateRoomCounter = updateRoomCounter;
