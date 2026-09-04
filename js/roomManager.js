// roomManager.js

if (window.i18n) {
  window.i18n.register('de', {
    'room.counter': 'Raum {cur}/{total}',
    'room.stair_prompt': '[E] Nächster Raum',
    'room.cleared.1': 'Die Stille kehrt zurück.',
    'room.cleared.2': 'Der Raum atmet wieder.',
    'room.cleared.3': 'Boden gewonnen.',
    'room.cleared.4': 'Die Schatten weichen — vorerst.',
    'room.cleared.5': 'Ihre Asche staubt im Kerzenlicht.',
    'room.cleared.6': 'Ein Raum mehr im Rücken der Stadt.',
    'room.cleared.7': 'Die Ketten werden leichter.',
    'room.objective_done': '✓ Ziel erfüllt!',
    'room.objective_failed': '✗ Ziel verfehlt',
    // Gesperrte Treppe: der Spieler stand davor und nichts geschah — ohne
    // jeden Hinweis, warum. Je Sperrgrund ein eigener Satz.
    'stairs.locked.objective': 'Die Aufgabe dieses Raums ist noch offen.',
    'stairs.locked.defend': 'Der Altar steht noch unter Beschuss — halte ihn.',
    'stairs.locked.survival': 'Der Ansturm ist nicht vorbei. Halte durch.',
    'stairs.locked.hunt': 'Das Ziel lebt noch. Finde es.',
    'stairs.locked.escape': 'Der Weg nach unten ist erst frei, wenn du entkommen bist.',
    'stairs.locked.leader': 'Der Anführer lebt noch — er versperrt den Abstieg.',
    'stairs.locked.enemies': 'Noch {n} Gegner im Raum.',
    'stairs.locked.generic': 'Hier wartet noch eine Aufgabe.'
  });
  window.i18n.register('en', {
    'room.counter': 'Room {cur}/{total}',
    'room.stair_prompt': '[E] Next room',
    'room.objective_done': '✓ Objective complete!',
    'room.objective_failed': '✗ Objective failed',
    'room.cleared.1': 'Silence returns.',
    'room.cleared.2': 'The room breathes again.',
    'room.cleared.3': 'Ground gained.',
    'room.cleared.4': 'The shadows recede — for now.',
    'room.cleared.5': 'Their ashes drift in the candlelight.',
    'room.cleared.6': 'Another room reclaimed for the city.',
    'room.cleared.7': 'The chains grow lighter.',
    'stairs.locked.objective': "This room's task is still open.",
    'stairs.locked.defend': 'The altar is still under fire — hold it.',
    'stairs.locked.survival': 'The assault is not over. Hold out.',
    'stairs.locked.hunt': 'The target still lives. Find it.',
    'stairs.locked.escape': 'The way down opens once you have escaped.',
    'stairs.locked.leader': 'The leader still lives — he bars the descent.',
    'stairs.locked.enemies': '{n} enemies still in the room.',
    'stairs.locked.generic': 'Something here still needs doing.'
  });
}
const _ROOM_T = (key, params) => (window.i18n ? window.i18n.t(key, params) : key);
const _ROOM_CLEARED_KEYS = [
  'room.cleared.1', 'room.cleared.2', 'room.cleared.3', 'room.cleared.4',
  'room.cleared.5', 'room.cleared.6', 'room.cleared.7'
];

// Fade-in/hold/fade-out toast at top-center. Used for room-cleared flavor lines.
function _showRoomClearedToast(scene) {
  if (!scene || !scene.add || !scene.tweens) return;
  const cw = scene.cameras && scene.cameras.main ? scene.cameras.main.width : scene.scale.width;
  const key = _ROOM_CLEARED_KEYS[Math.floor(Math.random() * _ROOM_CLEARED_KEYS.length)];
  const txt = scene.add.text(cw / 2, 120, _ROOM_T(key), {
    fontFamily: 'serif',
    fontSize: '26px',
    color: '#ffd166',
    fontStyle: 'italic',
    stroke: '#000000',
    strokeThickness: 4,
    align: 'center'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0);

  // 300ms fade-in, drift up 12px, hold ~2.4s, 300ms fade-out, drift up another 6px
  scene.tweens.add({
    targets: txt,
    alpha: { from: 0, to: 1 },
    y: { from: 132, to: 120 },
    duration: 300,
    ease: 'Sine.Out',
    onComplete: function () {
      scene.tweens.add({
        targets: txt,
        alpha: { from: 1, to: 0 },
        y: { from: 120, to: 114 },
        duration: 300,
        delay: 2400,
        ease: 'Sine.In',
        onComplete: function () { try { txt.destroy(); } catch (e) {} }
      });
    }
  });
}

// Feature 061: eigener Clue für ERFÜLLTES SPEZIAL-ZIEL (nicht "Raum gecleart").
// Level-Up-artig: grüner Kamera-Flash + Sound + kurzer grüner "✓ Ziel erfüllt!"-
// Text. Der persistente grüne ✓-HUD-Text macht RoomModeVisuals.
function _objectiveCompleteFx(scene) {
  if (!scene) return;
  try { if (scene.cameras && scene.cameras.main) scene.cameras.main.flash(300, 40, 190, 90); } catch (e) {}
  try { if (window.soundManager) window.soundManager.playSFX('level_up'); } catch (e) {}
  if (!scene.add || !scene.tweens) return;
  try {
    const cw = scene.cameras && scene.cameras.main ? scene.cameras.main.width : scene.scale.width;
    const txt = scene.add.text(cw / 2, 128, _ROOM_T('room.objective_done'), {
      fontFamily: 'serif', fontSize: '26px', color: '#66ff9c', fontStyle: 'bold',
      stroke: '#0a2a14', strokeThickness: 4, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0).setScale(0.8);
    scene.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, scale: { from: 0.8, to: 1.05 },
      y: { from: 140, to: 126 }, duration: 320, ease: 'Back.Out',
      onComplete: function () {
        scene.tweens.add({
          targets: txt, alpha: { from: 1, to: 0 }, y: { from: 126, to: 118 },
          duration: 320, delay: 1900, ease: 'Sine.In',
          onComplete: function () { try { txt.destroy(); } catch (e) {} }
        });
      }
    });
  } catch (e) { /* Clue darf den Abschluss nie brechen */ }
}

// Ziel VERFEHLT (z. B. Altar zerstört): roter Flash + "✗ Ziel verfehlt". Der Raum
// öffnet trotzdem (Malus, kein Bonus) — aber KEIN grünes "erfüllt".
function _objectiveFailedFx(scene) {
  if (!scene) return;
  try { if (scene.cameras && scene.cameras.main) scene.cameras.main.flash(300, 190, 50, 50); } catch (e) {}
  if (!scene.add || !scene.tweens) return;
  try {
    const cw = scene.cameras && scene.cameras.main ? scene.cameras.main.width : scene.scale.width;
    const txt = scene.add.text(cw / 2, 128, _ROOM_T('room.objective_failed'), {
      fontFamily: 'serif', fontSize: '26px', color: '#ff7a7a', fontStyle: 'bold',
      stroke: '#2a0a0a', strokeThickness: 4, align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2200).setAlpha(0);
    scene.tweens.add({
      targets: txt, alpha: { from: 0, to: 1 }, y: { from: 140, to: 126 },
      duration: 300, ease: 'Sine.Out',
      onComplete: function () {
        scene.tweens.add({
          targets: txt, alpha: { from: 1, to: 0 }, y: { from: 126, to: 118 },
          duration: 320, delay: 1900, ease: 'Sine.In',
          onComplete: function () { try { txt.destroy(); } catch (e) {} }
        });
      }
    });
  } catch (e) { /* Clue darf den Abschluss nie brechen */ }
}

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
  'RitualVault':    'Ritualkammer \u2014 Dämonische Energie pulsiert in der Luft...',
  'PrisonDepths':   'Kerkertiefen \u2014 Schreie hallen durch die Gänge...',
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
  // Feature 058 (#41): re-arm the run-completion latch so this run can count
  // its +1 once on a clean finish (RunDepth.tryCompleteRun in leaveDungeonForHub).
  if (window.RunDepth && typeof window.RunDepth.markRunStarted === 'function') {
    window.RunDepth.markRunStarted();
  }
  // Feature 058 (#41) Option B: re-arm the once-per-run boss/mini-boss climax.
  window.__runClimaxSpawned = false;
  // Item-Drop-Zähler pro Run zurücksetzen (steuert die Halbierung der Item-Chance
  // ab dem 11. echten Item; Tränke/Rollen zählen nicht — s. loot.js spawnLoot).
  window.__runItemsDropped = 0;
  // Reroll the Elara cellar-encounter spawn targets each run so a player
  // who abandons mid-run gets fresh distances next time.
  _resetElaraEncounterRunState();
  // Run-summary tracker. Resets on every fresh run; deltas are computed on
  // leaveDungeonForHub. Hooks: addXP (player.js), enemy kill (player.js),
  // enterRoom (this file). Cleared from window when the summary modal
  // dismisses (HubSceneV2._showRunSummary).
  window.runStats = {
    startedAt: Date.now(),
    startDepth: Math.max(1, window.DUNGEON_DEPTH || 1),
    startGold: (window.LootSystem && typeof window.LootSystem.getGold === 'function')
      ? window.LootSystem.getGold() : 0,
    startFragments: (window.KnowledgeTree && typeof window.KnowledgeTree.getFragments === 'function')
      ? window.KnowledgeTree.getFragments() : 0,
    xpGained: 0,
    enemiesKilled: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    roomsEntered: 0,
    itemsFound: 0,
    deepestDepth: Math.max(1, window.DUNGEON_DEPTH || 1)
  };
  const RT = window.RoomTemplates || {};
  const allNames = Object.keys(RT.TEMPLATES || {});
  if (!allNames.length) {
    // Fallback to manifest
    allNames.push(...(RT.MANIFEST || []));
  }

  const totalRooms = computeRunRoomCount();
  const depth = Math.max(1, window.DUNGEON_DEPTH || 1);
  const act = getStoryAct(depth);

  // Feature 059 (#42) WP04: decide ONCE per run whether a run-amulet drops
  // early. CHANCE-based and only from depth 10 (spec §0/D6 — NOT every run).
  // The actual pickup is spawned in the first room by enterRoom ->
  // _maybeSpawnRunAmulet. Defensive: never let this break run setup.
  window._pendingRunAmulet = null;
  try {
    if (window.LootSystem && typeof window.LootSystem.shouldSpawnRunAmulet === 'function'
        && window.LootSystem.shouldSpawnRunAmulet(depth, Math.random)
        && typeof window.LootSystem.rollAmulet === 'function') {
      window._pendingRunAmulet = window.LootSystem.rollAmulet(depth);
    }
  } catch (e) { window._pendingRunAmulet = null; }

  // Separate regular rooms from story rooms. Feature 055: die kuratierten
  // Espionage-Räume sind aus dem regulären Pool ausgeschlossen — sie
  // erscheinen NUR per quest-gesteuertem Force-Inject (s. unten), nie zufällig.
  const ESPIONAGE_ROOM_NAMES = ['CouncilWarehouse', 'SealedArchive', 'InformantDen'];
  const allStoryNames = [].concat(STORY_ROOMS.act2, STORY_ROOMS.act3, STORY_ROOMS.act4, ESPIONAGE_ROOM_NAMES);
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

  // Determine final room based on milestone depth.
  var finalRoom = null;
  // #62: An Boss-Tier-Gates (Tiefe = Vielfaches von 10) den Endraum als passende,
  // große Arena je Boss-TYP wählen (nutzt vorhandene Templates). Deckt auch tiefe
  // Gates (40/50/…) ab, nicht nur die statische 10/20/30-Map, und matcht das Thema
  // an den Boss: Kettenmeister->Kerker, Zeremonienmeister->Ritual, Schattenrat->Rat.
  var BOSS_ARENAS = {
    chainMaster: 'PrisonDepths',
    ceremonyMaster: 'RitualVault',
    shadowCouncillor: 'CouncilChamber'
  };
  if (depth >= 10 && depth % 10 === 0 && typeof getBossDefinition === 'function') {
    try {
      var _bd = getBossDefinition(depth);
      var _arena = _bd && _bd.def && BOSS_ARENAS[_bd.def.id];
      if (_arena && allNames.indexOf(_arena) !== -1) finalRoom = _arena;
    } catch (e) { /* fällt unten auf die statische Map zurück */ }
  }
  if (!finalRoom && MILESTONE_FINAL_ROOMS[depth] && allNames.indexOf(MILESTONE_FINAL_ROOMS[depth]) !== -1) {
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


  // Inject 2-4 procedural rooms into the run for variety. Each room flips a
  // coin between the two generators so a single run can show both styles:
  //   • ProceduralRooms  → BSP-style rectangular chambers (D2 catacombs feel)
  //   • CaveGenerator    → cellular-automata caves (organic, eroded feel)
  if (window.RoomTemplates && (window.ProceduralRooms || window.CaveGenerator)) {
    var procCount = 2 + Math.floor(Math.random() * 3); // 2-4 rooms
    for (var pi = 0; pi < procCount; pi++) {
      // #43 (Feature 056): SIZE first via a weighted bucket (20% small / 60%
      // medium / 20% large), generator STYLE as a SEPARATE roll — so both Cave
      // and BSP can appear in any size bucket. Size logic lives in
      // ProceduralRooms (pure + unit-tested); here we only wire + fall back.
      var procWidth, procHeight, procName, procTpl;
      var _bucket = (window.ProceduralRooms && window.ProceduralRooms.rollBucket)
        ? window.ProceduralRooms.rollBucket(Math.random)
        : { key: 'medium', width: 80, height: 80 };
      procWidth = _bucket.width;
      procHeight = _bucket.height;
      // #70: Auf Mobile Riesenraeume deckeln. Der large-Bucket (bis 116x107, Flaeche
      // ~12.400) erzeugt GPU-Monster: ~28 Gegner + ~179 Hindernisse + 200+ Sprites ->
      // ~34fps. Da Gegnerzahl (Flaeche/85000) UND Prop-Dichte (pro Kammer-Flaeche) mit
      // der Groesse skalieren, senkt ein Dimensions-Deckel alles proportional mit,
      // OHNE die Dichte zu erhoehen (kein Gedraenge). ~oberes-Medium; Werte tunebar.
      if (typeof isMobile !== 'undefined' && isMobile) {
        procWidth = Math.min(procWidth, 74);
        procHeight = Math.min(procHeight, 64);
      }
      // Debug (?room=cave / ?room=bsp): den Generator festnageln. Sonst wirft
      // jeder Raum eine eigene Muenze und man trifft einen Stil nur zufaellig.
      var _erzwungenerStil = _debugRaumStil();
      var _style = _erzwungenerStil
        || ((window.ProceduralRooms && window.ProceduralRooms.pickProcStyle)
          ? window.ProceduralRooms.pickProcStyle(Math.random, _bucket.key)
          : 'cave');
      // Availability fallback: use whichever generator is actually loaded
      // (preserves the old single-generator behaviour).
      var useCave = window.CaveGenerator && (!window.ProceduralRooms || _style === 'cave');
      if (useCave) {
        procName = 'Cave_' + Date.now() + '_' + pi;
        procTpl = window.CaveGenerator.generate({
          width: procWidth, height: procHeight, name: procName, depth: window.DUNGEON_DEPTH
        });
      } else {
        procName = 'Procedural_' + Date.now() + '_' + pi;
        procTpl = window.ProceduralRooms.generate({
          width: procWidth, height: procHeight, name: procName
        });
      }
      window.RoomTemplates.TEMPLATES[procName] = procTpl;
      // Debug (#43): ?roomsize=1 loggt jede gerollte Grösse + laufende
      // Bucket-Verteilung, um ~20/60/20 im Playtest zu verifizieren. Zero-Effekt
      // ohne den URL-Parameter (analog ?perf=1 / __ENEMY_COUNT_DEBUG__).
      if (window.DebugGate && window.DebugGate.an('roomsize')) {          // #88
        window.__ROOM_SIZE_TALLY__ = window.__ROOM_SIZE_TALLY__ || { small: 0, medium: 0, large: 0 };
        window.__ROOM_SIZE_TALLY__[_bucket.key] = (window.__ROOM_SIZE_TALLY__[_bucket.key] || 0) + 1;
        var _rs = window.__ROOM_SIZE_TALLY__;
        var _rsTot = _rs.small + _rs.medium + _rs.large;
        var _pct = function (n) { return _rsTot ? Math.round((n / _rsTot) * 100) : 0; };
        console.log('[roomsize] ' + _bucket.key + ' ' + procWidth + 'x' + procHeight +
          ' (' + (useCave ? 'cave' : 'bsp') + ') — n=' + _rsTot +
          '  S ' + _rs.small + ' (' + _pct(_rs.small) + '%) /' +
          ' M ' + _rs.medium + ' (' + _pct(_rs.medium) + '%) /' +
          ' L ' + _rs.large + ' (' + _pct(_rs.large) + '%)');
      }
      var insertPos = 1 + Math.floor(Math.random() * Math.max(1, templateOrder.length - 2));
      templateOrder.splice(insertPos, 0, procName);
    }
  }

  // Feature 055: garantiere den kuratierten Espionage-Raum in diesem Run,
  // wenn die zugehörige Quest aktiv ist (quest-gesteuert, früh eingefügt
  // damit er den Trim überlebt). _maybeStartEspionage feuert dann beim Betreten.
  try {
    var ESP_MISSIONS = [
      { qid: 'espionage_convoy',    room: 'CouncilWarehouse' },
      { qid: 'espionage_archive',   room: 'SealedArchive' },
      { qid: 'espionage_informant', room: 'InformantDen' },
      // Feature 062: garde_night_escort teilt sich das Konvoi-Lager (thematisch
      // ein nächtlicher Transport). CouncilWarehouse trägt jetzt zusätzlich
      // die observe-Zone escort_route.
      { qid: 'garde_night_escort',  room: 'CouncilWarehouse' }
    ];
    var activeNow = (window.questSystem && typeof window.questSystem.getActiveQuests === 'function')
      ? window.questSystem.getActiveQuests() : [];
    ESP_MISSIONS.forEach(function (m) {
      var on = activeNow.some(function (q) { return q.id === m.qid; });
      var known = window.RoomTemplates && window.RoomTemplates.TEMPLATES && window.RoomTemplates.TEMPLATES[m.room];
      if (on && known && templateOrder.indexOf(m.room) === -1) {
        var pos = Math.min(templateOrder.length, 1 + Math.floor(Math.random() * 2));
        templateOrder.splice(pos, 0, m.room);
      }
    });
  } catch (e) {}

  // Pad if needed
  while (templateOrder.length < totalRooms) {
    var padIdx = templateOrder.length % regularNames.length;
    templateOrder.push(regularNames[padIdx]);
  }

  // Trim if over (Espionage-Räume sitzen früh -> überleben den Trim)
  if (templateOrder.length > totalRooms) {
    templateOrder.length = totalRooms;
  }

  // #54-Test (?spy=1): ersten Raum auf einen Spionage-Raum zwingen.
  if (_forceEspionageDebug()) {
    var _espForce = 'CouncilWarehouse';
    var _known = window.RoomTemplates && window.RoomTemplates.TEMPLATES && window.RoomTemplates.TEMPLATES[_espForce];
    if (_known) {
      var _ei = templateOrder.indexOf(_espForce);
      if (_ei !== -1) templateOrder.splice(_ei, 1);
      templateOrder.unshift(_espForce);
      if (templateOrder.length > totalRooms) templateOrder.length = totalRooms;
      try { console.log('[054-test] Spionage-Raum erzwungen als Raum 1 (?spy=1)'); } catch (e) {}
    }
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
    // Skip doors — they manage their own body state
    if (child.getData && child.getData('isDoor')) return;
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
 * Mindestabstände für die Treppen EINES Raums.
 *
 * WARUM (#99): Beide Abstände wurden aus der RAUM-BOUNDINGBOX abgeleitet
 * (30 % der Diagonale, gedeckelt auf die halbe kurze Kante) — und waren damit
 * systematisch unerfüllbar. Gemessen über 30 Räume war in **30 von 30** der
 * Spawn-Ausschlusskreis (pi * Mindestabstand^2) GRÖSSER als die gesamte
 * begehbare Fläche des Raums; im Mittel 3x, im Extremfall 13,5x. Es gab also
 * gar keinen Punkt, der die Regel erfüllen konnte — die Platzierung MUSSTE in
 * die Notfallpfade fallen. Die Warnungen waren ein Symptom, kein Fehler.
 *
 * Deshalb hängen die Abstände jetzt an der BEGEHBAREN Fläche (die der BFS
 * ohnehin liefert), also am Raum, den die Kandidaten wirklich haben:
 *   * Der Ausschlusskreis um den Spawn deckt höchstens die halbe begehbare
 *     Fläche ab  ->  r <= sqrt(A / 2pi)
 *   * Mit N Türen müssen N Treppen nebeneinander passen; grobe Packungsgrenze
 *     sqrt(A / N), mit Sicherheitsfaktor 0,75
 * Ist die Fläche unbekannt (BFS ausgefallen), bleibt es bei den alten Werten.
 *
 * Rein (keine Szene) — dadurch einzeln testbar.
 *
 * @param {Object} o { roomW, roomH, walkablePx, doorCount }
 * @returns {{minDistance:number, separation:number}} in Pixeln
 */
function stairSpacingForRoom(o) {
  const roomW = (o && o.roomW) || 0;
  const roomH = (o && o.roomH) || 0;
  const walkablePx = (o && o.walkablePx > 0) ? o.walkablePx : 0;
  const doorCount = Math.max(1, (o && o.doorCount) || 1);
  const diag = Math.sqrt(roomW * roomW + roomH * roomH);
  const roomMin = Math.max(1, Math.min(roomW, roomH));
  const spawnCap = walkablePx ? Math.sqrt(walkablePx / (2 * Math.PI)) : Infinity;
  const packCap = walkablePx ? 0.75 * Math.sqrt(walkablePx / doorCount) : Infinity;
  return {
    minDistance: Math.min(Math.max(32 * 6, diag * 0.30), roomMin * 0.5, spawnCap),
    // Untergrenze 96: Treppen-Sprite 80 px + Rand — näher wäre optische
    // Überlappung, und das war der ursprüngliche Zweck von #15.
    separation: Math.max(96, Math.min(
      Math.max(44 * 3, diag * 0.30), roomMin * 0.5, packCap
    )),
  };
}
if (typeof window !== 'undefined') window.stairSpacingForRoom = stairSpacingForRoom;

/**
 * Geordnete Kandidatenreihe für die Treppe EINER Tür: von der Tür aus ins
 * Rauminnere, erst nah an der Tür, dann weiter; je Abstand zuerst mittig,
 * dann seitlich versetzt.
 *
 * WARUM (#99): Bis hierher wurde eine Treppe, die zu nah am Spieler-Spawn lag,
 * pauschal auf `Spawn + Wandnormale * Schub` gesetzt — ein einziger,
 * ungeprüfter Sprung. Da der Spawn am Eingang liegt, schob das JEDE Treppe in
 * die Raummitte, also genau auf die Treppe der gegenüberliegenden Tür.
 * Gemessen über 40 Räume: 33 von 102 Treppen wurden deshalb als „zu nah"
 * verworfen (zwei Türen derselben Wand landeten sogar auf demselben Punkt),
 * 23 lagen ausserhalb der begehbaren Fläche und 22 in einem Hindernis — die
 * Sprungposition wurde nie gegen Wände oder Erreichbarkeit geprüft.
 * Statt eines Sprungs liefert diese Reihe Vorschläge; der Aufrufer nimmt den
 * ERSTEN, der seine Prüfung besteht.
 *
 * Rein (keine Szene, kein Zufall) — dadurch einzeln testbar.
 *
 * @param {{x:number,y:number,dir?:string}} door  Türmitte in Weltpixeln
 * @param {Object} opts  { roomW, roomH, inset, step, maxDist, lateral }
 * @returns {Array<{x:number,y:number}>}
 */
function stairCandidatesFromDoor(door, opts) {
  const o = opts || {};
  const dx0 = (door && Number.isFinite(door.x)) ? door.x : 0;
  const dy0 = (door && Number.isFinite(door.y)) ? door.y : 0;
  const roomW = o.roomW || 0;
  const roomH = o.roomH || 0;
  const inset = Number.isFinite(o.inset) ? o.inset : 96;
  const step = Math.max(8, o.step || 48);
  const lateral = o.lateral || [0, 64, -64, 128, -128, 192, -192];
  // Einwärts-Normale: 'N' = Wand oben -> ins Rauminnere heisst nach unten.
  // Ohne Richtungsangabe wird (wie bisher) die untere Wand angenommen.
  const dir = String((door && door.dir) || '').toUpperCase();
  let nx = 0, ny = -1;
  if (dir === 'N') { nx = 0; ny = 1; }
  else if (dir === 'S') { nx = 0; ny = -1; }
  else if (dir === 'W') { nx = 1; ny = 0; }
  else if (dir === 'E') { nx = -1; ny = 0; }
  const tx = -ny, ty = nx; // quer zur Normalen
  // Höchstens bis zur gegenüberliegenden Wand — dahinter liegt kein Raum mehr.
  const toFarWall = (nx !== 0)
    ? (nx > 0 ? roomW - dx0 : dx0)
    : (ny > 0 ? roomH - dy0 : dy0);
  const maxDist = Math.min(
    toFarWall,
    Number.isFinite(o.maxDist) ? o.maxDist : Math.max(roomW, roomH)
  );
  const out = [];
  for (let dist = inset; dist <= maxDist; dist += step) {
    for (let i = 0; i < lateral.length; i++) {
      out.push({
        x: dx0 + nx * dist + tx * lateral[i],
        y: dy0 + ny * dist + ty * lateral[i],
      });
    }
  }
  return out;
}
if (typeof window !== 'undefined') window.stairCandidatesFromDoor = stairCandidatesFromDoor;

// Zufällige Truhen-Platzierung pro Raum (ersetzt die fixen Template-Truhen).
// Ziel: ~1 Truhe pro 2 durchschnittlich grosse Räume (Audit-Mittel ~861 Tiles).
// Platziert NACH den Treppen, validiert gegen Treppen/Spieler-Spawn/Kamera/
// Hindernisse, damit keine Truhe eine Treppe oder ein anderes Objekt blockiert.
function _spawnRandomRoomChests(scene, roomW, roomH, spawnX, spawnY) {
  if (!scene || typeof window.spawnLoot !== 'function') return;
  const T = 32;
  const REF_TILES = 861; // durchschnittliche Raumfläche aus dem Template-Audit
  const tiles = Math.max(1, (roomW / T) * (roomH / T));
  // Basis 0.5 (= 1 pro 2 Räume beim Durchschnitt), mit der Fläche skaliert und
  // gedeckelt, damit Mini-Räume selten und Riesen-Räume nicht garantiert sind.
  let chance = 0.5 * (tiles / REF_TILES);
  chance = Math.max(0.15, Math.min(0.85, chance));
  let count = (Math.random() < chance) ? 1 : 0;
  // Nur sehr grosse Räume dürfen selten eine zweite Truhe bekommen.
  if (count === 1 && tiles > REF_TILES * 1.6 && Math.random() < 0.30) count = 2;
  if (count === 0) return;

  // Treppen-Positionen (Abstand halten).
  const stairs = [];
  if (scene.stairsGroup && typeof scene.stairsGroup.getChildren === 'function') {
    scene.stairsGroup.getChildren().forEach((s) => { if (s) stairs.push({ x: s.x, y: s.y }); });
  }
  const cam = scene.cameras && scene.cameras.main;
  const camX = cam ? cam.midPoint.x : roomW / 2;
  const camY = cam ? cam.midPoint.y : roomH / 2;
  const D = Phaser.Math.Distance.Between;
  const MIN_STAIR = 120; // Abstand Truhe <-> Treppe (Treppe ~80px + Truhe)
  const MIN_SPAWN = 140;  // nicht auf/neben dem Spieler
  const MIN_CAM = 200;    // nicht direkt vor der Startkamera
  const MIN_CHEST = 96;   // Truhen nicht stapeln
  const placed = [];

  for (let n = 0; n < count; n++) {
    let pos = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      let cand = null;
      if (typeof scene.pickAccessibleSpawnPoint === 'function') {
        cand = scene.pickAccessibleSpawnPoint({ minDistance: MIN_SPAWN, maxAttempts: 12 });
      }
      if (!cand) cand = { x: Phaser.Math.Between(48, roomW - 48), y: Phaser.Math.Between(48, roomH - 48) };
      const x = cand.x, y = cand.y;
      if (typeof window.isSpawnPositionBlocked === 'function' && window.isSpawnPositionBlocked(x, y)) continue;
      if (spawnX != null && spawnY != null && D(x, y, spawnX, spawnY) < MIN_SPAWN) continue;
      if (D(x, y, camX, camY) < MIN_CAM) continue;
      if (stairs.some((s) => D(x, y, s.x, s.y) < MIN_STAIR)) continue;
      if (placed.some((p) => D(x, y, p.x, p.y) < MIN_CHEST)) continue;
      pos = { x, y };
      break;
    }
    if (!pos) continue; // kein gültiger Platz -> lieber keine Truhe als eine falsche
    const r = Math.random();
    const type = r < 0.10 ? 'chest_large' : (r < 0.45 ? 'chest_medium' : 'chest_small');
    const locked = Math.random() < 0.20;
    try { window.spawnLoot(pos.x, pos.y, { type, locked }); } catch (e) { /* nie den Raum brechen */ }
    placed.push(pos);
  }
}

/**
 * Betritt einen Raum: setzt WorldBounds, platziert Hindernisse,
 * baut Treppen, sperrt sie bis Raumwelle clear ist.
 */
function enterRoom(scene, roomId) {
  currentRoomId = roomId;
  if (typeof window !== 'undefined') window.currentRoomId = roomId;
  // Mini-Boss-Treppensperre pro Raum zurücksetzen (kein Stale-Ref aus dem
  // Vorraum, der die Treppe eines neuen Raums fälschlich entsperren würde).
  if (typeof window !== 'undefined') window.__climaxEnemy = null;
  // #95: Der Schar-Merker gehoert zum Raum, nicht zum Lauf. Bliebe er stehen,
  // unterdrueckte ein Bannertraeger die Uniques aller FOLGENDEN Raeume.
  if (typeof window !== 'undefined') window.__scharImRaum = false;

  // Run-summary: each room entry counts as one cleared room (the player only
  // reaches the next via the stair, which requires waves to be cleared).
  // Track the deepest DUNGEON_DEPTH the run reached for the summary modal.
  if (window.runStats) {
    window.runStats.roomsEntered += 1;
    if ((window.DUNGEON_DEPTH || 1) > window.runStats.deepestDepth) {
      window.runStats.deepestDepth = window.DUNGEON_DEPTH;
    }
  }

  let room = rooms[roomId];

  if (!scene || !room) {
    //createRooms();
    room = rooms[roomId];
  }

  // 1) Alles Alte bereinigen
  const rightPadding = typeof WORLD_RIGHT_PADDING === 'number' ? WORLD_RIGHT_PADDING : 0;
  scene.physics.world.setBounds(0, 0, ROOM_W + rightPadding, ROOM_H); // wird gleich auf echte Raumgrösse aktualisiert
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
    obstacles.__steerRects = null; // Perf-Cache (#70) invalidieren: Hindernisse neu
  }
  // Clear door tracking list (door sprites were just destroyed with obstacles)
  if (window.DoorSystem?.clearDoors) window.DoorSystem.clearDoors(scene);

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
  scene._spotlightMaskGfx?.clear();

  // Feature 055: eine laufende Espionage-Mission endet beim Raumwechsel.
  if (window.EspionageSystem && window.EspionageSystem.isActive()) {
    try { window.EspionageSystem.endMission(); } catch (e) {}
  }

  // 1) Raum bauen: use procedural template from dungeon run if available
  let builtMeta = null;
  let pickedType = null;

  // Debug (?room=/?rooms=): hier erzwingen, nicht beim Bauen der Reihenfolge —
  // der Direkteinstieg ?dungeon=N laeuft an jener Stelle vorbei, und die
  // prozeduralen Raeume werden danach ohnehin noch eingespleisst.
  var _erzwungen = (typeof _debugRaumFolge === 'function')
    ? _debugRaumFolge(Object.keys((window.RoomTemplates && window.RoomTemplates.TEMPLATES) || {}))
    : null;
  const templateName = (_erzwungen && _erzwungen.length)
    ? _erzwungen[roomId % _erzwungen.length]
    : (dungeonRun && dungeonRun.templateOrder[roomId]);
  if (_erzwungen && _erzwungen.length) {
    try { console.log('[Raumtypen] Raum ' + roomId + ': ' + templateName); } catch (e) {}
  }
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

  // Finalraum-Flag SCHON HIER setzen (nicht erst bei der Wellen-Vorbereitung
  // weiter unten): der Event-Trigger direkt darunter liest es, um im Boss-/
  // Klimax-Raum KEIN Event zu feuern. Ohne diese frühe Zuweisung stünde hier
  // noch der Wert des VORRAUMS -> ein Event könnte doch im Boss-Raum spawnen.
  {
    var _tR = (dungeonRun && dungeonRun.totalRooms) ? dungeonRun.totalRooms : rooms.length;
    window.__isFinalDungeonRoom = (roomId === (_tR - 1));
  }

  // Trigger random event system
  if (window.EventSystem && typeof window.EventSystem.onRoomEnter === 'function') {
    window.EventSystem.onRoomEnter(scene, roomId);
  }

  // Story-driven Elara cellar encounter — see _maybeFireElaraCellarEncounter.
  _maybeFireElaraCellarEncounter(scene, roomId);

  // Feature 055: Espionage-Mission starten, wenn dieser Raum espionage-
  // Metadaten trägt UND eine passende observe-Quest aktiv ist.
  _maybeStartEspionage(scene, templateName, builtMeta);

  const builtWidth = (builtMeta?.w ?? room?.width ?? ROOM_W) + rightPadding;
  const builtHeight = builtMeta?.h ?? room?.height ?? ROOM_H;

  scene.physics.world.setBounds(0, 0, builtWidth, builtHeight);
  scene.cameras.main.setBounds(0, 0, builtWidth, builtHeight);

  // New room = new walls — invalidate the wall cache
  invalidateWallCache();

  // Reset fog of war for the new room — rebuild RTs sized to new world bounds
  if (typeof scene.initFogOfWar === 'function') {
    if (scene.exploredRT && scene.exploredRT.destroy) scene.exploredRT.destroy();
    if (scene.spotlightDim && scene.spotlightDim.destroy) scene.spotlightDim.destroy();
    if (scene._spotlightMaskGfx && scene._spotlightMaskGfx.destroy) scene._spotlightMaskGfx.destroy();
    if (scene.fogUnseen && scene.fogUnseen.destroy) scene.fogUnseen.destroy();
    if (scene._visionGfx && scene._visionGfx.destroy) scene._visionGfx.destroy();
    if (scene._visionGfxWorld && scene._visionGfxWorld.destroy) scene._visionGfxWorld.destroy();
    if (scene._enemyVisionMaskGfx && scene._enemyVisionMaskGfx.destroy) scene._enemyVisionMaskGfx.destroy();
    scene.initFogOfWar();
  }

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
  scene._playerObstacleCollider = scene.physics.add.collider(player, obstacles, null, (pl, obs) => {
    return !(obs && obs.getData && obs.getData('walkthrough'));
  });
  scene._enemyObstacleCollider = scene.physics.add.collider(enemies, obstacles, null, (en, obs) => {
    return !(obs && obs.getData && obs.getData('walkthrough'));
  });
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
  // Get player position (already placed at template spawn) for min-distance check
  const playerSpawnX = (player && player.active) ? player.x : null;
  const playerSpawnY = (player && player.active) ? player.y : null;

  const STAIR_HALF = 44; // 80px display + 8px margin
  const PLACED_STAIRS = []; // pixel coords of stairs placed in this loop
  const _roomMin = Math.max(1, Math.min(builtWidth, builtHeight));
  // Abstaende an die BEGEHBARE Flaeche koppeln, nicht an die Bounding-Box —
  // Begruendung und Messung siehe stairSpacingForRoom (#99).
  const _spacing = stairSpacingForRoom({
    roomW: builtWidth,
    roomH: builtHeight,
    walkablePx: computeWalkableAreaPx(scene),
    doorCount: doorList.length,
  });
  const MIN_STAIR_DISTANCE = _spacing.minDistance;
  const MIN_STAIR_DIST_SQ = MIN_STAIR_DISTANCE * MIN_STAIR_DISTANCE;
  const STAIR_SEPARATION = _spacing.separation;
  const STAIR_SEPARATION_SQ = STAIR_SEPARATION * STAIR_SEPARATION;
  // Mindestabstand Treppe <-> Tuer: verhindert, dass die Treppe auf/an einer Tuer
  // liegt (gemeldeter Bug). STAIR_HALF (44) + Tuerrahmen/-durchgang (~44) -> ~88px
  // Zentrum-zu-Zentrum, damit der Durchgang frei bleibt. Der Startversatz der
  // Kandidatenreihe (96px) ist bewusst groesser, sodass der erste Vorschlag die
  // Pruefung besteht und trotzdem in Tuernaehe bleibt.
  const DOOR_CLEARANCE_SQ = 88 * 88;

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

  // Prüft EINEN Treppenplatz: im Raum, frei von Tür/Spawn/anderen Treppen,
  // nicht in Wand oder Hindernis und vom Spawn aus ERREICHBAR.
  //
  // WARUM für alle Räume (#99): diese Prüfung lief bis hierher nur im
  // prozeduralen Zweig — der aber deckt gemessen nur 2 von 40 Räumen ab. Die
  // übrigen 38 (Templates) gingen durch einen Pfad, der WEDER Wände NOCH
  // Erreichbarkeit prüfte: 23 von 69 gesetzten Treppen lagen ausserhalb der
  // begehbaren Fläche, 22 in einem Hindernis. Genau daraus entstand die
  // Notfall-Treppe als Dauerzustand (~21 % der Räume).
  //
  // `relax` schaltet einzelne Regeln ab, wenn ein Raum sie nicht hergibt:
  //   { spawn: true }  Mindestabstand zum Spieler-Spawn fällt (Mini-Räume)
  //   { doors: true }  Tür-Freiraum fällt (nur für die ERSTE Treppe)
  // Der Abstand zu bereits gesetzten Treppen fällt NIE — Klumpen zu vermeiden
  // ist der ganze Zweck von #15.
  const isStairSpotValid = (cx, cy, relax) => {
    const r = relax || {};
    if (cx < STAIR_HALF || cx > builtWidth - STAIR_HALF) return false;
    if (cy < STAIR_HALF || cy > builtHeight - STAIR_HALF) return false;
    // Nicht auf/an einer Tuer platzieren (Bug: Treppe lag auf einer Tuer). Gegen
    // ALLE Tueren pruefen, nicht nur die eigene — so blockiert eine Treppe auch
    // keinen benachbarten Durchgang.
    if (!r.doors) {
      for (let i = 0; i < doorList.length; i++) {
        const ddx = cx - doorList[i].x;
        const ddy = cy - doorList[i].y;
        if (ddx * ddx + ddy * ddy < DOOR_CLEARANCE_SQ) return false;
      }
    }
    // Distance from player spawn (only when we know where the player is)
    if (!r.spawn && playerSpawnX !== null) {
      const dpx = cx - playerSpawnX;
      const dpy = cy - playerSpawnY;
      if (dpx * dpx + dpy * dpy < MIN_STAIR_DIST_SQ) return false;
    }
    // Don't stack stairs on top of each other
    for (let i = 0; i < PLACED_STAIRS.length; i++) {
      const dxs = cx - PLACED_STAIRS[i].x;
      const dys = cy - PLACED_STAIRS[i].y;
      if (dxs * dxs + dys * dys < STAIR_SEPARATION_SQ) return false;
    }
    // Wall-grid + obstacle check — same helper used by enemy/loot spawns.
    if (isSpawnPositionBlocked(cx, cy, STAIR_HALF)) return false;
    // Deko-Sprites ohne Physikkoerper (Statuen an Waenden) liegen nur in
    // _templateWalls und sind fuer isSpawnPositionBlocked unsichtbar.
    if (checkBucket(scene._templateWalls, cx, cy)) return false;
    // Reachability check — rooms can have sealed-off chambers; the stair
    // must lie in the BFS region the player can actually walk to from spawn.
    // (scene.isPointAccessible may be missing on the very first frame after
    // build; in that case skip the gate so we don't reject every candidate.)
    if (typeof scene.isPointAccessible === 'function'
        && !scene.isPointAccessible(cx, cy)) return false;
    return true;
  };

  // Zieht einen Punkt aus dem BFS-Pool garantiert erreichbarer Zellen.
  const stairSpotFromPool = (relax) => {
    if (typeof scene.pickAccessibleSpawnPoint !== 'function') return null;
    const minD = (relax && relax.spawn) ? 0 : MIN_STAIR_DISTANCE;
    for (let attempt = 0; attempt < 8; attempt++) {
      const spot = scene.pickAccessibleSpawnPoint({ minDistance: minD, maxAttempts: 12 });
      if (spot && isStairSpotValid(spot.x, spot.y, relax)) return spot;
    }
    return null;
  };

  doorList.forEach((d) => {
    // Kandidatenreihe von DIESER Tuer ins Rauminnere. Startversatz 96 px: das
    // ist der Tuer-Freiraum (DOOR_CLEARANCE 88) plus Rand — naeher an der Tuer
    // verstellt die Treppe ihren eigenen Durchgang, und JEDER Kandidat wuerde
    // an der Tuer-Regel scheitern.
    const CANDS = stairCandidatesFromDoor(d, {
      roomW: builtWidth,
      roomH: builtHeight,
      inset: 96,
      step: 48,
      // Weiter als die kurze Raumkante zu suchen bringt nichts — ab da greift
      // der Pool-Rueckgriff, der direkt aus der begehbaren Flaeche zieht.
      maxDist: Math.max(MIN_STAIR_DISTANCE + 96, _roomMin),
    });
    const firstValid = (relax) => {
      for (let i = 0; i < CANDS.length; i++) {
        if (isStairSpotValid(CANDS[i].x, CANDS[i].y, relax)) return CANDS[i];
      }
      return null;
    };

    // EIN Hauptpfad fuer alle Raumarten (#99): geordnete Suche ab der Tuer,
    // dann der BFS-Pool erreichbarer Zellen, dann dieselbe Suche ohne den
    // Spawn-Mindestabstand (den geben Mini-Raeume schlicht nicht her).
    let chosen = firstValid(null) || stairSpotFromPool(null) || firstValid({ spawn: true });
    let placedX, placedY;

    if (chosen) {
      placedX = chosen.x;
      placedY = chosen.y;
    } else if (PLACED_STAIRS.length > 0) {
      // #15: kein Platz, der Abstand zu den bereits gesetzten Treppen haelt ->
      // die Treppe dieser Tuer weglassen statt zwei aneinander zu klumpen. Der
      // Raum bleibt ueber die erste Treppe durchquerbar.
      try { console.warn('[stairs] dropped a stair too close to an existing one (#15)'); } catch (_) {}
      return;
    } else {
      // ERSTE Treppe des Raums: sie MUSS entstehen, sonst ist der Run
      // softgelockt. Letzte Stufen: Pool ohne Spawn- und Tuer-Regel, sonst der
      // erste Kandidat an der Tuer, dort Hindernisse wegraeumen.
      chosen = stairSpotFromPool({ spawn: true, doors: true });
      if (chosen) {
        placedX = chosen.x;
        placedY = chosen.y;
      } else {
        const fb = CANDS[0] || { x: d.x, y: d.y };
        placedX = fb.x;
        placedY = fb.y;
        let blocker;
        let safety = 12;
        while (safety-- > 0 && (blocker = obstacleAt(placedX, placedY))) {
          if (blocker.body) blocker.body.enable = false;
          // Auch aus dem templateWalls-Zwischenspeicher nehmen, sonst wird es
          // im naechsten Durchlauf erneut gefunden.
          if (Array.isArray(scene._templateWalls)) {
            const wi = scene._templateWalls.indexOf(blocker);
            if (wi >= 0) scene._templateWalls.splice(wi, 1);
          }
          blocker.destroy();
        }
        try { console.warn('[stairs] Rueckgriff: erste Treppe an der Tuer freigeraeumt'); } catch (_) {}
      }
    }

    PLACED_STAIRS.push({ x: placedX, y: placedY });
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

  // Sicherheitsnetz: zerstoerbare Props (Fass/Kiste/Geroell/Saeule ...), die auf
  // einer Treppe liegen, entfernen. Grund: die Platzierungs-Checks nutzen
  // STAIR_HALF (44px), das Treppen-Sprite ist aber 80px — Rand-Ueberlappungen
  // konnten durchrutschen (bes. im proc-"verified clear"-Pfad, der Nudge/Destroy
  // ueberspringt). Hier gegen die ECHTEN Treppen-Bounds pruefen und nur als
  // destructible markierte Props raeumen (Waende bleiben unberuehrt). Ein Prop
  // unter einer Treppe ist Wegwerf-Deko; die Treppe hat Vorrang.
  if (obstacles && typeof obstacles.getChildren === 'function' && scene.stairsGroup
      && Phaser && Phaser.Geom && Phaser.Geom.Intersects) {
    const _stairsArr = scene.stairsGroup.getChildren();
    if (_stairsArr.length > 0) {
      const _obsArr = obstacles.getChildren().slice(); // Kopie: wir destroyen waehrend Iteration
      for (let oi = 0; oi < _obsArr.length; oi++) {
        const o = _obsArr[oi];
        if (!o || !o.active || !(o.getData && o.getData('destructible')) || !o.getBounds) continue;
        const ob = o.getBounds();
        for (let si = 0; si < _stairsArr.length; si++) {
          const s = _stairsArr[si];
          if (!s || !s.getBounds) continue;
          if (Phaser.Geom.Intersects.RectangleToRectangle(ob, s.getBounds())) {
            try { if (o.body) o.body.enable = false; } catch (e) {}
            if (Array.isArray(scene._templateWalls)) {
              const wi = scene._templateWalls.indexOf(o);
              if (wi >= 0) scene._templateWalls.splice(wi, 1);
            }
            try { o.destroy(); } catch (e) {}
            break;
          }
        }
      }
    }
  }

  // INVARIANTE: jeder Raum MUSS mindestens eine ERREICHBARE Treppe haben —
  // sonst ist der Run softgelockt. Es genuegt NICHT, dass eine Treppe existiert:
  // sie kann in einer Wand oder einer vom Spawn abgeschnittenen Tasche gelandet
  // sein (size>=1, aber unerreichbar) — genau das war der "Raum ohne Treppe".
  // Deshalb pro Treppe die tatsaechliche Erreichbarkeit pruefen (isPointAccessible,
  // aus dem BFS-Flood-Fill). Ist KEINE erreichbar, eine Notfall-Treppe an einem
  // garantiert begehbaren Punkt erzwingen (alle Constraints fallen gelassen).
  var _hasReachableStair = false;
  var _stairCount = (scene.stairsGroup.children && scene.stairsGroup.children.size) || 0;
  if (_stairCount > 0) {
    if (typeof scene.isPointAccessible === 'function') {
      scene.stairsGroup.getChildren().forEach(function (s) {
        if (s && scene.isPointAccessible(s.x, s.y)) _hasReachableStair = true;
      });
    } else {
      _hasReachableStair = true; // ohne Erreichbarkeits-Check defensiv akzeptieren
    }
  }
  if (!_hasReachableStair) {
    var _emx = builtWidth / 2, _emy = builtHeight / 2;
    if (typeof scene.pickAccessibleSpawnPoint === 'function') {
      var _emsp = scene.pickAccessibleSpawnPoint({ minDistance: 0, maxAttempts: 40 });
      if (_emsp) { _emx = _emsp.x; _emy = _emsp.y; }
    }
    var _emStair = scene.stairsGroup.create(_emx, _emy, "stairDown");
    _emStair.setData("locked", true);
    _emStair.setData("dir", null);
    _emStair.setDisplaySize(80, 80);
    _emStair.setAlpha(0.95).setDepth(40).refreshBody();
    try { console.warn('[stairs] Notfall-Treppe erzwungen — keine ERREICHBARE Treppe (Raum hatte ' + _stairCount + ')'); } catch (_) {}
  }

  // Absolute Garantie: KEIN blockierendes Objekt (Saeule/Statue/Fass/Kiste)
  // hinter/unter einer Treppe. Deckt auch den PROZEDURALEN Pfad (der den
  // Nudge/Destroy oben ueberspringt) und die Notfall-Treppe ab — dort schaute
  // sonst z.B. eine Saeule hinter der Treppe hervor. Nur die Physik-Obstacles
  // (scene.obstacles), NICHT die Wand-/Deko-Sprites in _templateWalls. Braziers
  // bleiben ABSICHTLICH stehen (ihr Licht liegt jetzt vor der Treppe).
  if (scene.stairsGroup && scene.stairsGroup.getChildren
      && scene.obstacles && scene.obstacles.getChildren) {
    var _stairsList = scene.stairsGroup.getChildren();
    scene.obstacles.getChildren().slice().forEach(function (o) {
      if (!o || o.active === false) return;
      if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return;
      if (o.getData && o.getData('isFloor')) return;
      var _ty = (o.getData && o.getData('type')) || '';
      if (_ty === 'brazier' || _ty === 'brazer') return; // Fackeln behalten
      var _STAIR_HALF = 44; // 80px Treppe/2 + 4px Marge
      var ohw = (o.displayWidth || 32) / 2 + _STAIR_HALF;
      var ohh = (o.displayHeight || 32) / 2 + _STAIR_HALF;
      for (var _si = 0; _si < _stairsList.length; _si++) {
        var st = _stairsList[_si];
        if (st && Math.abs(o.x - st.x) < ohw && Math.abs(o.y - st.y) < ohh) {
          try { if (o.body) o.body.enable = false; o.destroy(); } catch (e) {}
          try { console.warn('[stairs] Objekt hinter Treppe entfernt: ' + (_ty || '?')); } catch (_) {}
          return;
        }
      }
    });
  }

  // Truhen werden NICHT mehr aus den Templates gespawnt (spawns.loot-Truhen
  // entfernt), sondern hier ZUFAELLIG platziert — nach den Treppen, damit die
  // Validierung sie meiden kann (früher standen Template-Truhen fix vor einer
  // Treppe). Ziel: ~1 Truhe pro 2 durchschnittlich grosse Räume.
  _spawnRandomRoomChests(scene, builtWidth, builtHeight, playerSpawnX, playerSpawnY);

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

  // 4) Waves für den Raum setzen
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
  // Variante A: Gegnerzahl nach BEGEHBARER Fläche (Flood-Fill), Fallback Box.
  const walkableAreaPx = (typeof window.computeWalkableAreaPx === "function"
    ? window.computeWalkableAreaPx(scene) : 0) || roomAreaPx;
  const baseEnemies =
    typeof window.computeWaveEnemyTotal === "function"
      ? window.computeWaveEnemyTotal(targetWave, walkableAreaPx)
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


  // 5) Stairs stay open — player can leave room even with enemies alive
  lockStairs(scene, false);


  // 6) Start der Welle
  // Feature 058 (#41) Option B: tell startNextWave whether this is the run's
  // FINAL room — the boss/mini-boss climax only spawns there (once per run).
  var _totalRooms = (dungeonRun && dungeonRun.totalRooms) ? dungeonRun.totalRooms : rooms.length;
  window.__isFinalDungeonRoom = (roomId === (_totalRooms - 1));
  // Feature 055: a curated espionage room runs a STEALTH mission, not combat.
  // _maybeStartEspionage (above) already activated the mission + disguise if
  // this room matches an active observe-quest. Spawning a normal wave here
  // would force the player to fight — and attacking blows the disguise
  // (FR-04), making the eavesdrop impossible. Skip the wave entirely; the
  // stairs are already open (lockStairs(false) above), so the player sneaks to
  // the observe zone, listens, and leaves. Detection by the (invisible) guards
  // stays the only threat.
  var _espionageRoom = !!(window.EspionageSystem
    && typeof window.EspionageSystem.isActive === 'function'
    && window.EspionageSystem.isActive());
  if (!_espionageRoom && typeof startNextWave === "function") {
    startNextWave.call(scene, false);
    window.currentWave = currentWave;
  }

  // Feature 061: Raum-Modus starten. Solange nur `clear` registriert ist,
  // wählt beginRoom immer `clear` -> keine Verhaltensänderung (NFR-01).
  // Boss = Klimax-Raum (Finalraum), erster Raum + Espionage bleiben `clear`.
  if (window.RoomMode && typeof window.RoomMode.beginRoom === 'function') {
    try {
      window.RoomMode.beginRoom(scene, {
        roomIndex: roomId,
        isBoss: !!window.__isFinalDungeonRoom,
        isEspionage: _espionageRoom,
        depth: Math.max(1, window.DUNGEON_DEPTH || currentWave || 1)
      });
    } catch (e) { /* nie den Raumaufbau brechen */ }
  }

  // Feature 061 sperrte die Treppe HIER, im Raumaufbau — also bevor der Spieler
  // ueberhaupt sehen konnte, worum es geht. Seit #112 haengt die Sperre am
  // EREIGNISSTART (roomModes._zielStarten): das Ereignis ist ein Angebot, wer es
  // nicht ausloest darf weiterziehen. Escape bleibt ausgenommen (offene Flucht).
  // markRoomCleared oeffnet die Treppe beim Zielabschluss wie bisher.

  // Feature 059 (#42) WP04 / Issue #120: Lauf-Amulett ablegen, sobald der Raum
  // dafür in Frage kommt (ab Raum 3, Notfallabwurf im Finalraum).
  _maybeSpawnRunAmulet(scene, roomId);

  // #113: ein verborgener Fund abseits des Wegs — als LETZTES, weil er die
  // Treppenposition braucht (die Strecke Eingang->Treppe ist der Weg, von dem
  // er wegliegen soll).
  _maybeSpawnHiddenFind(scene);

  // Die Markierung der VORIGEN Kammer muss weg, sonst zeigt die Minikarte im
  // neuen Raum auf eine Stelle, an der nichts ist.
  try { if (scene) scene._kammerMarkierung = null; } catch (e) {}

  // #113: Wurde beim Raumaufbau eine Kammer gestanzt, jetzt zuschuetten und
  // die Belohnung hineinlegen. Erst hier, weil spawnObstacle die fertige
  // Szene braucht.
  try {
    var k = scene && scene._kammer;
    if (k && window.HiddenFinds && typeof window.HiddenFinds.verschuetteKammer === 'function') {
      var T = scene._minimapTileSize || 32;
      window.HiddenFinds.verschuetteKammer(scene, k, 0, 0, T);
      scene._kammer = null;   // nur einmal je Raum
    }
  } catch (e) { /* nie den Raumaufbau brechen */ }
}

/**
 * Legt einen verborgenen Fund ab — abseits der Strecke Eingang -> Treppe (#113).
 *
 * Der schnellste Weg durch einen Raum war auch der beste. Ein Fund, der auf
 * diesem Weg liegt, aendert daran nichts; er muss dort liegen, wo man beim
 * Durchqueren NICHT vorbeikommt. Die Auswahl macht HiddenFinds (rein,
 * getestet), hier wird nur eingesammelt und hingestellt.
 *
 * Bricht nie den Raumaufbau: fehlt ein Baustein, gibt es in diesem Raum eben
 * keinen Fund.
 */
function _maybeSpawnHiddenFind(scene) {
  try {
    var HF = window.HiddenFinds;
    if (!HF || !scene || typeof player === 'undefined' || !player) return;
    if (!window.EventSystem || typeof window.EventSystem.spawnEventObject !== 'function') return;
    if (typeof scene.pickAccessibleSpawnPoint !== 'function') return;
    if (!HF.anzahlFuerRaum(Math.random)) return;

    // Der Weg: von da, wo der Spieler steht (= Eingang), zur Treppe.
    var eingang = { x: player.x, y: player.y };
    var ausgang = null;
    if (scene.stairsGroup && typeof scene.stairsGroup.getChildren === 'function') {
      var st = scene.stairsGroup.getChildren().filter(function (s) { return s && s.active; })[0];
      if (st) ausgang = { x: st.x, y: st.y };
    }
    // Ohne Treppe gibt es keinen "Weg", von dem etwas abliegen koennte.
    if (!ausgang) return;

    // Kandidaten einsammeln. Mehr Zuege als noetig: die begehbaren Punkte sind
    // ueber den Raum gestreut, und nur wenige davon liegen weit genug abseits.
    var kandidaten = [];
    for (var i = 0; i < 40; i++) {
      var p = scene.pickAccessibleSpawnPoint({ maxAttempts: 8 });
      if (!p) continue;
      if (typeof window.isSpawnPositionBlocked === 'function'
          && window.isSpawnPositionBlocked(p.x, p.y, 20)) continue;
      if (typeof window.isNearStair === 'function' && window.isNearStair(scene, p.x, p.y, 60)) continue;
      kandidaten.push(p);
    }
    var plaetze = HF.waehleAbseits(kandidaten, eingang, ausgang, 1);
    if (!plaetze.length) {
      // Im normalen Spiel heisst das: dieser Raum hat keine Stelle weit genug
      // abseits, also gibt es hier keinen Fund. Beim TESTEN (?find=<art>) waere
      // das nutzlos — gemessen fand sich in manchen Raeumen kein einziger
      // Kandidat, und der Slug lieferte dann gar nichts.
      if (!(HF.erzwungeneArt && HF.erzwungeneArt())) return;
      var ersatz = kandidaten[0]
        || (typeof scene.pickAccessibleSpawnPoint === 'function' ? scene.pickAccessibleSpawnPoint({ maxAttempts: 24 }) : null)
        || { x: player.x + 70, y: player.y };
      plaetze = [ersatz];
    }

    HF.spawne(scene, plaetze[0]);
  } catch (e) { /* nie den Raumaufbau brechen */ }
}


// Ab welchem betretenen Raum das Lauf-Amulett frühestens liegt (Issue #120).
var RUN_AMULET_MIN_ROOM = 3;

// Issue #120: Entscheidet, ob das vorgemerkte Lauf-Amulett in DIESEM Raum liegt.
// Rein und ohne Seiteneffekte, damit die Regel testbar bleibt.
//
// WARUM ab Raum 3: im ersten Raum liegt das Amulett vor Laufbeginn vor den
// Füßen — es wirkt wie Startausstattung statt wie ein Fund.
//
// WARUM der Notfallabwurf im letzten Raum: ein Amulett, das die Chance-Prüfung
// bereits BESTANDEN hat, dem Spieler aber wegen eines kurzen Laufs (< 3 Räume)
// vorenthalten wird, wäre ein stiller Verlust — im Spiel nicht nachvollziehbar
// und von aussen nicht von Pech zu unterscheiden. Lieber spät als gar nicht.
function shouldPlaceRunAmuletHere(roomsEntered, roomIndex, totalRooms) {
  var betreten = Number(roomsEntered);
  if (Number.isFinite(betreten) && betreten >= RUN_AMULET_MIN_ROOM) return true;
  // Letzte Gelegenheit: nur bei bekannter Raumzahl entscheidbar.
  var idx = Number(roomIndex);
  var gesamt = Number(totalRooms);
  if (!Number.isFinite(idx) || !Number.isFinite(gesamt) || gesamt < 1) return false;
  return idx >= gesamt - 1;
}

// Feature 059 (#42) WP04: spawn the pending run-amulet as a floor pickup
// (decided in initDungeonRun). Chance + depth gating already happened; here we
// only pick the room (shouldPlaceRunAmuletHere) and place the drop near the
// player on a walkable tile. Defensive: a failure must never break room entry.
function _maybeSpawnRunAmulet(scene, roomIndex) {
  try {
    var amulet = window._pendingRunAmulet;
    if (!amulet) return;
    // Noch zu früh? Vormerkung bleibt bestehen und trägt in den nächsten Raum.
    var _tR = (dungeonRun && dungeonRun.totalRooms) ? dungeonRun.totalRooms : rooms.length;
    var _betreten = window.runStats ? window.runStats.roomsEntered : NaN;
    // Ohne explizites Argument auf den laufenden Raum zurückfallen — sonst
    // stirbt der Notfallabwurf still, wenn ein Aufrufer den Index vergisst.
    var _idx = (typeof roomIndex === 'number') ? roomIndex : currentRoomId;
    if (!shouldPlaceRunAmuletHere(_betreten, _idx, _tR)) return;
    window._pendingRunAmulet = null;
    if (typeof window.spawnLoot !== 'function' || typeof player === 'undefined' || !player) return;
    var px = player.x + 90, py = player.y;
    if (scene && typeof scene.isPointAccessible === 'function' && !scene.isPointAccessible(px, py)) {
      if (typeof scene.pickAccessibleSpawnPoint === 'function') {
        var spot = scene.pickAccessibleSpawnPoint({ minDistance: 48, maxAttempts: 16 });
        if (spot) { px = spot.x; py = spot.y; }
      }
    }
    window.spawnLoot.call(scene, px, py, amulet);
  } catch (e) { /* never break room entry */ }
}

// Wie lange nach einer Treppen-Meldung geschwiegen wird. Der Overlap feuert
// jeden Frame, solange man auf der Treppe steht — ohne Sperre waere das ein
// Dauerfeuer aus Meldungen.
var _treppeGemeldetBis = 0;
var TREPPE_MELDE_PAUSE = 3000;

/**
 * Warum ist die Treppe zu? Gibt einen fertigen Satz zurueck, oder null.
 *
 * Reihenfolge nach Dringlichkeit: ein laufendes Raumziel ist die konkreteste
 * Antwort, danach der Anfuehrer, zuletzt die uebrigen Gegner.
 */
function treppenSperrGrund(scene) {
  var _t = function (k, f) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var s = window.i18n.t(k);
        if (s && s.indexOf('[MISSING:') !== 0) return s;
      }
    } catch (e) {}
    return f;
  };
  try {
    if (window.RoomMode && typeof window.RoomMode.activeModeId === 'function') {
      var id = window.RoomMode.activeModeId();
      if (id && id !== 'clear') {
        return _t('stairs.locked.' + id, _t('stairs.locked.objective',
          'Die Aufgabe dieses Raums ist noch offen.'));
      }
    }
  } catch (e) {}
  try {
    var chef = window.__climaxEnemy;
    if (chef && chef.active) {
      return _t('stairs.locked.leader', 'Der Anführer lebt noch — er versperrt den Abstieg.');
    }
  } catch (e) {}
  try {
    var uebrig = (window.enemies && typeof window.enemies.getChildren === 'function')
      ? window.enemies.getChildren().filter(function (g) { return g && g.active; }).length
      : 0;
    if (uebrig > 0) {
      return _t('stairs.locked.enemies', 'Noch {n} Gegner im Raum.').replace('{n}', uebrig);
    }
  } catch (e) {}
  return _t('stairs.locked.generic', 'Hier wartet noch eine Aufgabe.');
}

function onStairOverlap(player, stair) {
  // nur wenn freigeschaltet
  if (stair.getData("locked")) {
    // Vorher kehrte die Funktion still zurueck: der Spieler stand auf der
    // Treppe, drueckte E und nichts geschah — ohne jeden Hinweis, warum.
    //
    // ALLES in einem try: die Zeitabfrage stand zuerst davor und griff auf
    // `obstacles` zu — ein blosser Bezeichner, kein Fensterfeld. Ist er zum
    // Zeitpunkt des Overlaps nicht gesetzt, wirft die Zeile einen
    // ReferenceError, und der Overlap-Haken der Treppe bricht mit ihr ab. Eine
    // Meldung darf niemals den Weg nach unten verstellen.
    try {
      var _sc = (typeof obstacles !== 'undefined' && obstacles && obstacles.scene)
        ? obstacles.scene : window.currentScene;
      var jetzt = (typeof window.gameNow === 'function' && _sc)
        ? window.gameNow(_sc) : Date.now();
      if (jetzt >= _treppeGemeldetBis) {
        _treppeGemeldetBis = jetzt + TREPPE_MELDE_PAUSE;
        if (_sc && window.EventSystem && typeof window.EventSystem.showToast === 'function') {
          window.EventSystem.showToast(_sc, treppenSperrGrund(_sc));
        }
      }
    } catch (e) { /* eine fehlende Meldung darf den Raum nicht brechen */ }
    return;
  }

  // Require E key to confirm — no accidental room transitions
  const scene = obstacles?.scene;

  // Die TUER hat Vorrang. Liegt eine geschlossene Tuer in Reichweite, gehoert
  // der E-Druck ihr: sonst oeffnet ein einziger Druck die Tuer UND nimmt im
  // selben Moment die dahinterliegende Treppe — der Spieler sieht den Raum
  // hinter der Tuer nie. Ist die Tuer bereits offen, greift die Regel nicht,
  // dann will man die Treppe wirklich benutzen.
  if (scene && Array.isArray(scene._doors)) {
    const REICHWEITE = 100;   // identisch zu DoorSystem.INTERACT_DIST
    for (let i = 0; i < scene._doors.length; i++) {
      const tuer = scene._doors[i];
      if (!tuer || !tuer.active || !tuer.getData) continue;
      if (tuer.getData('doorState') !== 'closed') continue;
      const dx = tuer.x - player.x;
      const dy = tuer.y - player.y;
      if (dx * dx + dy * dy < REICHWEITE * REICHWEITE) return;
    }
  }
  if (scene && scene.input && scene.input.keyboard) {
    const eKey = scene.input.keyboard.addKey('E');
    const mobileInteract = !!window.__MOBILE_INTERACT_ACTIVE__;
    if (!eKey.isDown && !mobileInteract) {
      // Show prompt text above player
      if (!stair._prompt) {
        stair._prompt = scene.add.text(stair.x, stair.y - 40, _ROOM_T('room.stair_prompt'), {
          fontSize: '14px', fill: '#ffdd44', fontFamily: 'monospace',
          stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(500);
        scene.time.delayedCall(150, function () {
          if (stair._prompt && !stair._prompt._keep) { stair._prompt.destroy(); stair._prompt = null; }
        });
      }
      return;
    }
  }

  // Ab hier verbraucht die Treppe das E. Der Physics-Step läuft VOR
  // scene.update(), d.h. main.js prüft die Treppen-Nähe erst, wenn der
  // Spieler schon im nächsten Raum am Spawn steht — eine Geometrie-Prüfung
  // dort greift zwangsläufig ins Leere. Darum hier eine Zeitmarke setzen, die
  // main.js beim E-Druck konsumiert. Date.now() statt scene.time.now: die Marke
  // wird ggf. scene-übergreifend gelesen (Raumwechsel/Hub-Rückkehr).
  window.__stairConsumedEAt = Date.now();

  const nextIndex = currentRoomId + 1;
  const totalRooms = dungeonRun ? dungeonRun.totalRooms : rooms.length;
  const endlessActive = !!(window.Endless && window.Endless.isActive && window.Endless.isActive());

  // Last room cleared -> return to hub (NORMAL mode). In endless mode we
  // skip the hub: the next room is generated procedurally with a deeper
  // depth and the dungeon run is extended in place.
  if (nextIndex >= totalRooms) {
    if (endlessActive) {
      // Generate one more procedural room, extend the run, descend.
      const newDepth = (window.DUNGEON_DEPTH || 1) + 1;
      // Tiefen-Buffs enden mit der Tiefe. Im Normalmodus erledigt das der
      // Rueckweg in den Hub; hier geht der Lauf weiter, also hier loeschen.
      if (window.tiefenBuffs) {
        window.tiefenBuffs = null;
        if (typeof recalcDerived === 'function') {
          try { recalcDerived(0, 0); } catch (e) {}
        }
      }
      window.DUNGEON_DEPTH = newDepth;
      window.NEXT_DUNGEON_DEPTH = newDepth;
      window.SELECTED_WAVE_OVERRIDE = newDepth;
      if (window.Endless && window.Endless.onDepthAdvance) {
        try { window.Endless.onDepthAdvance(newDepth); } catch (e) {}
      }
      if (window.ProceduralRooms && window.RoomTemplates && dungeonRun) {
        const w = 90 + Math.floor(Math.random() * 60);  // 90-150 tiles
        const h = 90 + Math.floor(Math.random() * 60);
        const procName = 'Endless_' + Date.now() + '_' + nextIndex;
        const procTpl = window.ProceduralRooms.generate({ width: w, height: h, name: procName });
        window.RoomTemplates.TEMPLATES[procName] = procTpl;
        dungeonRun.templateOrder.push(procName);
        dungeonRun.totalRooms = dungeonRun.templateOrder.length;
        rooms.push(makeRoom(nextIndex, {
          exits: [{ to: nextIndex + 1, x: 600, y: 400 }]
        }));
      }
      enterRoom(obstacles.scene, nextIndex);
      return;
    }
    const scene = obstacles.scene;
    if (typeof leaveDungeonForHub === 'function') {
      leaveDungeonForHub(scene, { reason: 'dungeon_complete' });
    }
    return;
  }

  // Feature 058 (#41): depth is RUN-CONSTANT — entering the next room keeps the
  // run-start depth instead of climbing +1 per room (the old NEXT_DUNGEON_DEPTH
  // driver). The +1 now happens only on run COMPLETION (WP03). Endless mode
  // keeps its own per-depth advance (handled in the endless branch above).
  const runDepth = Math.max(1, window.DUNGEON_DEPTH || 1);
  window.SELECTED_WAVE_OVERRIDE = (window.RunDepth && typeof window.RunDepth.nextRoomDepth === 'function')
    ? window.RunDepth.nextRoomDepth(runDepth)
    : runDepth;

  // Betritt nächsten Raum
  enterRoom(obstacles.scene, nextIndex);
}

/** Türen/Treppen sperren/freischalten */
function lockStairs(scene, lock) {
  scene.stairsGroup.children.iterate(
    (s) => s && s.setData("locked", !!lock) && s.setAlpha(lock ? 0.6 : 1),
  );
}

// Ist (x,y) zu nah an einer Treppe? Verhindert, dass E-Interaktionsobjekte
// (Truhen/Schreine/Händler + Raum-Reward) AUF/unter Treppen spawnen, wo Treppe
// und Objekt dieselbe E-Taste beanspruchen würden. margin = Puffer über den
// halben Treppen-Sprite (STAIR_HALF 44) hinaus.
function isNearStair(scene, x, y, margin) {
  try {
    const grp = scene && scene.stairsGroup;
    if (!grp || typeof grp.getChildren !== 'function') return false;
    const r = 44 + (typeof margin === 'number' ? margin : 44);
    const r2 = r * r;
    const stairs = grp.getChildren();
    for (let i = 0; i < stairs.length; i++) {
      const s = stairs[i];
      if (!s || !s.active) continue;
      const dx = s.x - x, dy = s.y - y;
      if (dx * dx + dy * dy < r2) return true;
    }
  } catch (e) {}
  return false;
}
if (typeof window !== 'undefined') window.isNearStair = isNearStair;

/**
 * Raum „cleared“ markieren und Türen freischalten.
 * Aufrufst du, wenn Raum‑Wave erledigt ist.
 */
function markRoomCleared(opts) {
  const scene = obstacles.scene;
  const room = rooms[currentRoomId];
  if (!scene || !room) return;

  // Der Wellen-Clear ruft markRoomCleared VERZÖGERT (2s, wave.js). Die Treppe ist
  // in Normal-Räumen aber schon offen — läuft der Spieler in dieser Zeit weiter,
  // wäre currentRoomId inzwischen der NEUE Raum und Reward/State würden dort
  // (falsch) landen. Ist der Clear für einen anderen als den aktuellen Raum
  // gedacht, überspringen — der neue Raum triggert seinen eigenen Clear.
  if (opts && typeof opts.forRoomId === 'number' && opts.forRoomId !== currentRoomId) return;

  room.cleared = true;
  lockStairs(scene, false);

  // Feature 061: Bei ERFÜLLTEM SPEZIAL-ZIEL (opts.objective) NICHT den
  // "Raum gecleart"-Flavor-Toast zeigen (der Raum ist evtl. noch voller Gegner),
  // sondern einen Level-Up-artigen Ziel-erfüllt-Clue. Der "gecleart"-Toast kommt
  // erst, wenn der Raum wirklich leer ist (wave.js -> window.showRoomClearedToast).
  if (opts && opts.objective) {
    try { (opts.failed ? _objectiveFailedFx : _objectiveCompleteFx)(scene); } catch (e) { /* ignore */ }
  } else {
    room._clearedToastShown = true;
    try { _showRoomClearedToast(scene); } catch (e) { /* ignore */ }
  }

  // Endless mode: re-lock stairs and offer 1-of-3 upgrade cards before
  // letting the player descend.
  if (window.Endless && window.Endless.isActive && window.Endless.isActive()) {
    try { window.Endless.handleRoomCleared(scene); } catch (e) { /* ignore */ }
  }
  // Expose lockStairs so endlessMode can re-lock during the pick.
  window.lockStairs = lockStairs;

  // Procedural room reward: spawn a chest with a high-quality item when all
  // enemies in the room have been defeated.
  const currentTplName = dungeonRun && dungeonRun.templateOrder && dungeonRun.templateOrder[currentRoomId];
  const tpl = currentTplName && window.RoomTemplates && window.RoomTemplates.TEMPLATES && window.RoomTemplates.TEMPLATES[currentTplName];
  if (tpl && tpl._procedural && !room._rewardGranted) {
    room._rewardGranted = true;
    if (typeof spawnLoot === 'function') {
      // Weighted proc-room reward. Previously EVERY cleared proc room dropped a
      // guaranteed tier-2/3 chest (rare/legendary) — far too generous. Now it
      // mostly drops ordinary loot / consumables, with the special chest as the
      // minority case. Buckets: 25% special chest, 30% normal-item chest,
      // 25% potion, 20% town-portal scroll.
      const _depthNow = Math.max(1, window.DUNGEON_DEPTH || 1);
      const _rewardRoll = Math.random();
      let _rewardItem;
      let _isSpecial = false;
      if (_rewardRoll < 0.25) {
        _rewardItem = { type: 'chest_large', locked: false, tier: Math.random() < 0.6 ? 2 : 3 };
        _isSpecial = true;
      } else if (_rewardRoll < 0.55) {
        _rewardItem = { type: 'chest_medium', locked: false, tier: Math.random() < 0.6 ? 0 : 1 };
      } else if (_rewardRoll < 0.80) {
        _rewardItem = (typeof window.makePotionDrop === 'function') ? window.makePotionDrop(_depthNow) : null;
      } else {
        _rewardItem = (typeof window.makePortalScrollDrop === 'function') ? window.makePortalScrollDrop() : null;
      }
      // Defensive fallback so the room always grants *something*.
      if (!_rewardItem) _rewardItem = { type: 'chest_small', locked: false, tier: 0 };

      // Find a safe floor position near the player — prefer accessible, non-wall
      let rx = (player ? player.x : 0) + 60;
      let ry = (player ? player.y : 0) + 60;
      const tryOffsets = [
        [60, 0], [-60, 0], [0, 60], [0, -60],
        [80, 80], [-80, 80], [80, -80], [-80, -80],
        [120, 0], [-120, 0], [0, 120], [0, -120],
        [150, 150], [-150, 150], [150, -150], [-150, -150],
      ];
      let placed = false;
      if (player) {
        for (const [dx, dy] of tryOffsets) {
          const tx = player.x + dx;
          const ty = player.y + dy;
          if (scene.isPointAccessible && !scene.isPointAccessible(tx, ty)) continue;
          if (typeof isBlockedByObstacle === 'function' && isBlockedByObstacle(tx, ty)) continue;
          if (isNearStair(scene, tx, ty, 40)) continue; // nicht auf einer Treppe
          rx = tx; ry = ty; placed = true;
          break;
        }
      }
      // Last-ditch fallback: use pickAccessibleSpawnPoint
      if (!placed && scene.pickAccessibleSpawnPoint) {
        const pick = scene.pickAccessibleSpawnPoint({ minDistance: 60, maxAttempts: 10 });
        if (pick) { rx = pick.x; ry = pick.y; }
      }

      const rewardDrop = spawnLoot.call(scene, rx, ry, _rewardItem, null);
      if (rewardDrop && rewardDrop.setData) rewardDrop.setData('isRewardChest', true);
      // Celebratory jingle only for the special chest; ordinary loot/consumables
      // use the standard pickup feel (no fanfare).
      if (window.soundManager) {
        try { window.soundManager.playSFX(_isSpecial ? 'level_up' : 'loot_pickup'); } catch (e) {}
      }
    }
  }

  // Feature 061 (FR-08): Bonus-Chest bei erfolgreich abgeschlossenem SPEZIAL-Raum
  // (Modus != clear UND Ziel nicht verfehlt). Verfehlen = Malus (kein Chest), aber
  // der Raum bleibt passierbar. In WP01 dormant (nur `clear` registriert).
  //
  // WICHTIG — die Frage wird GENAU EINMAL entschieden.
  //
  // Vorher setzte nur der Erfolgsfall einen Merker. Bei verfehltem Ziel blieb
  // room._bonusGranted leer, und markRoomCleared wird ein ZWEITES Mal gerufen:
  // einmal vom Modus selbst (mit failed:true), danach nochmal von der
  // Wellen-Kette nach dem letzten Kill. Der zweite Aufruf wertete die Frage neu
  // aus — und vergab die Truhe doch.
  //
  // Gemessen im zerstoerten Verteidigungsraum:
  //   markRoomCleared({objective:true, failed:true}) -> 0 Bonus-Truhen
  //   danach markRoomCleared({})                     -> 1 Bonus-Truhe
  //
  // Darum: _bonusEntschieden wird IMMER gesetzt, sobald ein Spezialraum
  // abschliesst — egal wie er ausgeht. Und opts.failed zaehlt mit: der Aufrufer
  // weiss im Moment des Abschlusses, wie er ausging, waehrend eine spaetere
  // Abfrage am Modus schon veraendert sein kann.
  try {
    var _spezial = !!(window.RoomMode && window.RoomMode.isSpecialRoom
      && window.RoomMode.isSpecialRoom());
    var _verfehlt = !!(opts && opts.failed);
    try {
      if (window.RoomMode && typeof window.RoomMode.objectiveFailed === 'function') {
        _verfehlt = _verfehlt || !!window.RoomMode.objectiveFailed();
      }
    } catch (e) {}
    if (_spezial && !room._bonusEntschieden) {
      room._bonusEntschieden = true;
      room._bonusVerfehlt = _verfehlt;
    }
    if (_spezial && !_verfehlt && !room._bonusVerfehlt
        && !room._bonusGranted && typeof spawnLoot === 'function') {
      room._bonusGranted = true;
      var _bx = (player ? player.x : 0) + 60, _by = (player ? player.y : 0) - 60;
      if (player && scene.isPointAccessible && !scene.isPointAccessible(_bx, _by) && scene.pickAccessibleSpawnPoint) {
        var _bp = scene.pickAccessibleSpawnPoint({ minDistance: 60, maxAttempts: 10 });
        if (_bp) { _bx = _bp.x; _by = _bp.y; }
      }
      var _bonusChest = { type: 'chest_large', locked: false, tier: Math.random() < 0.5 ? 2 : 3 };
      var _bd = spawnLoot.call(scene, _bx, _by, _bonusChest, null);
      if (_bd && _bd.setData) _bd.setData('isBonusChest', true);
      if (window.soundManager) { try { window.soundManager.playSFX('level_up'); } catch (e) {} }
    }
  } catch (e) { /* Bonus-Chest darf den Raum-Abschluss nie brechen */ }

  // XP fürs Raum-Clearen / Lösen eines Spezialraums (zusätzlich zu Kill-XP).
  // Ein GELÖSTER Spezialraum (opts.objective && !failed) gibt mehr; ein normaler
  // Clear die Basis; ein VERFEHLTER Spezialraum nichts. Einmal pro Raum.
  if (!room._xpGranted && typeof window.addXP === 'function') {
    room._xpGranted = true;
    try {
      var _xpDepth = Math.max(1, window.DUNGEON_DEPTH || 1);
      var _xpGain = 0;
      if (opts && opts.objective) {
        if (!opts.failed) _xpGain = Math.max(6, Math.round(_xpDepth * 3)); // Spezialraum gelöst
      } else {
        _xpGain = Math.max(3, Math.round(_xpDepth * 1.5));                 // normaler Raum gecleart
      }
      if (_xpGain > 0) window.addXP(_xpGain);
    } catch (e) { /* XP-Vergabe darf den Raum-Abschluss nie brechen */ }
  }

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
      ? window.computeWaveEnemyTotal(room.wave,
          typeof window.computeWalkableAreaPx === "function" ? window.computeWalkableAreaPx(scene) : 0)
      : 4 + Math.max(0, room.wave - 1) * 2;
  // Feature 058 (#41): depth is run-constant — clearing a room's wave no longer
  // re-derives DUNGEON_DEPTH/NEXT (enterRoom is authoritative) and no longer
  // persists maxDepth per room. The maxDepth +1 moved to run COMPLETION (WP03,
  // RunDepth.tryCompleteRun via leaveDungeonForHub 'dungeon_complete').
  saveGame(scene);
}

function initFogOfWar() {
  const scene = this;
  const W = scene.scale.width;
  const H = scene.scale.height;
  // World bounds — exploredRT covers the full world so explored areas persist
  const bounds = scene.physics?.world?.bounds;
  const worldW = bounds ? Math.ceil(bounds.width) : W;
  const worldH = bounds ? Math.ceil(bounds.height) : H;

  // exploredRT in WORLD space — added to scene (invisible) so BitmapMask
  // aligns pixel-by-pixel with fogUnseen (also world-space below).
  //
  // Perf (053 WP06): exploredRT.draw() pro Fog-Tick war der dominante
  // Rest-Sink (EXPL-Toggle: 38->60fps), weil ein Framebuffer-Bind/Draw auf
  // einer welt-großen 37MB-RT den Tile-GPU stallt. Auf Mobile rendern wir
  // die RT daher in HALBER Auflösung (1/4 Pixel -> ~4x billiger) und
  // skalieren sie zur Anzeige wieder auf Weltgröße. Der Explored-Reveal ist
  // ein weicher Mask-Rand -> halbe Auflösung visuell unsichtbar. Die ins RT
  // gestempelten Polygone werden mit _exploredRes skaliert (s. updateFogOfWar).
  const _explOvr = window.__PERF && window.__PERF.explRes;
  const explRes = (typeof _explOvr === 'number' && _explOvr > 0)
    ? _explOvr
    : ((typeof isMobile !== 'undefined' && isMobile) ? 0.25 : 1);
  scene._exploredRes = explRes;
  scene._explLastX = null; // #70: Bewegungs-Tracker fuer den Explored-Stamp neu (frischer Stamp im neuen Raum)
  scene.exploredRT = scene.add
    .renderTexture(0, 0, Math.ceil(worldW * explRes), Math.ceil(worldH * explRes))
    .setOrigin(0, 0)
    .setVisible(false);
  if (explRes !== 1) scene.exploredRT.setScale(1 / explRes); // Anzeige in Weltgröße

  // Spotlight: screen-space 40%-Dim mit Vision-Loch. Früher ein
  // RenderTexture mit fill()+erase() PRO Fog-Tick — auf Mobile ~50ms
  // (053-Diagnose: SPOT-Toggle 20->40fps), weil RT-Framebuffer-Ops den
  // Tile-GPU stallen. Jetzt eine STATISCHE Graphics (einmal gefüllt) mit
  // invertierter Geometry-Mask; pro Tick wird nur das Mask-Polygon neu
  // gezeichnet (reine Geometrie, kein Framebuffer-Op). Optik identisch.
  scene.spotlightDim = scene.add
    .graphics()
    .setScrollFactor(0)
    .setDepth(900);
  scene.spotlightDim.fillStyle(0x000000, 0.4);
  scene.spotlightDim.fillRect(0, 0, W, H);
  scene._spotlightMaskGfx = scene.add
    .graphics()
    .setScrollFactor(0)
    .setVisible(false);
  scene.spotlightMask = scene._spotlightMaskGfx.createGeometryMask();
  scene.spotlightMask.setInvertAlpha(true);
  scene.spotlightDim.setMask(scene.spotlightMask);

  scene._visionGfx = scene.add
    .graphics()
    .setScrollFactor(0)
    .setDepth(899)
    .setVisible(false);

  // Graphics for drawing vision polygon in WORLD coords (for exploredRT)
  scene._visionGfxWorld = scene.add
    .graphics()
    .setDepth(899)
    .setVisible(false);

  // fogUnseen is WORLD-sized so it aligns pixel-by-pixel with exploredRT mask.
  // It scrolls with the camera.
  scene.fogUnseen = scene.add.graphics().setDepth(1000);
  scene.fogUnseen.fillStyle(0x000000, 1);
  scene.fogUnseen.fillRect(0, 0, worldW, worldH);
  scene._fogOx = 0;
  scene._fogOy = 0;
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

  // optionale Felder für Throttling
  scene._lastVisX = scene._lastVisY = undefined;
  scene._visTick = 0;
}

let _fogFrameCounter = 0;
// #70: Wird gesetzt, wenn sich die Sicht-Geometrie aendert (Tuer auf/zu, Prop
// zerstoert -> invalidateWallCache). Erzwingt EINEN sofortigen Fog-Tick (bypass
// des Skip-Intervalls), damit das Sichtfeld nicht bis zu fogSkipInterval Frames
// hinterherhinkt. window.forceFogUpdate() setzt es ebenfalls.
let _forceFogTick = false;
function updateFogOfWar() {
  const scene = this;
  if (!scene.spotlightDim || !scene.exploredRT || !player) return;

  // 053-Diagnose: Live-Toggles (perfProbe). Granular, um den teuersten
  // Fog-Teil zu isolieren. Nur aktiv wenn window.__PERF existiert (?perf=1).
  //   nofog  = alles aus (Mask + Spotlight + Raycasting/RT-draw)
  //   nomask = nur das welt-große BitmapMask-Layer (fogUnseen) aus
  //   nospot = nur das screen-große Spotlight-Dim aus
  const _P = window.__PERF || {};
  const _noMask = !!(_P.nofog || _P.nomask);
  const _noSpot = !!(_P.nofog || _P.nospot);
  if (scene.fogUnseen && scene.fogUnseen.visible === _noMask) scene.fogUnseen.setVisible(!_noMask);
  if (scene.spotlightDim && scene.spotlightDim.visible === _noSpot) scene.spotlightDim.setVisible(!_noSpot);
  // nofog: Gegner sichtbar machen, sonst bleiben ALLE unsichtbar — die
  // Sichtmaske _enemyVisionMask wird sonst nur weiter unten aktualisiert, und
  // der nofog-return darunter liesse sie leer (= alles ausmaskiert). Die Gegner
  // haengen an dieser Maske sowohl ueber den enemyLayer ALS AUCH teils einzeln
  // (main.js _needsMask -> enemy.setMask), darum reicht clearMask am Layer NICHT.
  // Robust: die Masken-Graphics WELTGROSS fuellen -> die Geometry-Mask gibt
  // ueberall frei. Live-Toggle-fest: bei nofog=aus zeichnet Schritt 4 unten die
  // Sichtkegel-Maske wieder normal. (Nur bei ?perf=1 relevant.)
  if (_P.nofog) {
    if (scene._enemyVisionMaskGfx) {
      const _b = scene.physics && scene.physics.world && scene.physics.world.bounds;
      const _ww = _b ? _b.width : 20000;
      const _wh = _b ? _b.height : 20000;
      scene._enemyVisionMaskGfx.clear().fillStyle(0xffffff, 1);
      scene._enemyVisionMaskGfx.fillRect(-2000, -2000, _ww + 4000, _wh + 4000);
    }
    return;
  }

  // Mobile optimization: Fog-Update nur jeden N-ten Frame (053 WP05).
  // exploredRT.draw (welt-große RT) + Raycasting kosten ~18ms/Update und
  // lassen sich nicht throtteln OHNE die aktuelle Sicht (Stamp) zu
  // verzögern — daher senken wir stattdessen die Update-Frequenz. 3 statt
  // 2 bringt Procroom über die 45fps-Schwelle; Sichtkegel-Edge minimal
  // weniger reaktiv (≈15Hz). __PERF.fogInterval erlaubt Live-Tuning (?perf).
  const isMobileFog = !!(typeof isMobile !== 'undefined' && isMobile);
  const _ovr = window.__PERF && window.__PERF.fogInterval;
  // #70: 4->6 auf Mobile. A/B-Dump zeigte Fog = ~2/3 der CPU-Last (updateMsAvg
  // 15.5 mit Fog vs 5.7 ohne, fpsAvg 42->50). Seltener stempeln (10Hz statt 15Hz)
  // senkt den periodischen ~17ms-Fog-Frame; Sichtkegel-Edge minimal weniger reaktiv.
  const fogSkipInterval = (typeof _ovr === 'number' && _ovr > 0) ? _ovr : (isMobileFog ? 6 : 1);
  _fogFrameCounter++;
  // Erzwungener Tick (Tuer/Prop -> invalidateWallCache): bypass des Skip-Intervalls,
  // sonst haengt das Sichtfeld nach dem Oeffnen bis zu fogSkipInterval Frames nach.
  const _forcedTick = _forceFogTick;
  _forceFogTick = false;
  if (!_forcedTick && _fogFrameCounter % fogSkipInterval !== 0) return;

  const cam = scene.cameras.main;
  const px = player.x,
    py = player.y;

  // 1) Welt-Polygon
  const ptsWorld = computeVisionPolygon(scene, px, py);

  // Cache the world-space polygon as a flat [x0,y0, x1,y1, ...] number list
  // so other systems (enemy name labels, healthbars) can do cheap point-in-
  // polygon tests without recomputing the LOS each frame. Updated every
  // fog tick (~60fps on desktop, every other frame on mobile).
  if (Array.isArray(ptsWorld) && ptsWorld.length >= 3) {
    const flat = new Array(ptsWorld.length * 2);
    for (let i = 0; i < ptsWorld.length; i++) {
      flat[i * 2]     = ptsWorld[i].x;
      flat[i * 2 + 1] = ptsWorld[i].y;
    }
    scene._lastVisionPolygon = flat;
  }

  // 2) Explored stamp in WORLD coords — exploredRT is a world-sized RT,
  //    so previously-explored tiles remain painted as the camera scrolls.
  // #70: Der exploredRT.draw ist der teure Teil des Fog-Frames (Framebuffer-Stall auf
  //    der welt-grossen RT). Er muss aber NUR neu stempeln, wenn sich die erkundete
  //    Flaeche aendert = wenn der Spieler sich BEWEGT hat. Beim Laufen stempeln wir
  //    also jeden Tick (Karte bleibt reaktiv, KEIN Lag wie b54), im Stillstand
  //    ueberspringen wir (spart den Stall in Steh-/Kampfmomenten). 6px-Schwelle.
  let _doStamp;
  if (_forcedTick || scene._explLastX == null) {
    _doStamp = true; // Tuer auf/erster Tick: erkundete Flaeche sofort mitstempeln
  } else {
    const _mdx = px - scene._explLastX, _mdy = py - scene._explLastY;
    _doStamp = (_mdx * _mdx + _mdy * _mdy) > 36;
  }
  if (!_P.noexpl && _doStamp) {
    scene._explLastX = px; scene._explLastY = py;
    // Koords mit _exploredRes skalieren: die RT ist auf Mobile halb-aufgelöst
    // (WP06), wird aber zur Anzeige auf Weltgröße hochskaliert.
    const _res = scene._exploredRes || 1;
    const ptsWorldExplored = ptsWorld.map((p) => ({
      x: (p.x + p.dx * VISION_PAD_EXPLORED) * _res,
      y: (p.y + p.dy * VISION_PAD_EXPLORED) * _res,
    }));
    const gfxWorld = scene._visionGfxWorld || scene._visionGfx;
    gfxWorld.clear().fillStyle(0xffffff, 1);
    drawFilledPolygon(gfxWorld, ptsWorldExplored);
    scene.exploredRT.draw(gfxWorld);
  }

  // 3) Spotlight-Loch in SCREEN coords — nur das invertierte Mask-Polygon
  //    der statischen Dim-Graphics neu zeichnen (kein RT-Framebuffer-Op).
  if (!_noSpot) {
    const ptsScreenUI = ptsWorld.map((p) => ({
      x: p.x + p.dx * VISION_PAD_UI - cam.scrollX,
      y: p.y + p.dy * VISION_PAD_UI - cam.scrollY,
    }));
    scene._spotlightMaskGfx.clear().fillStyle(0xffffff, 1);
    drawFilledPolygon(scene._spotlightMaskGfx, ptsScreenUI);
  }

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
// Mobile gets fewer rays (90 vs 180) to reduce CPU cost
const VISION_RAYS_DESKTOP = 180;
const VISION_RAYS_MOBILE = 48; // #70: 64->48, senkt Raycast ~25% (48 Rays = noch rund genug)
// BUGFIX (053): früher ein load-time const — aber roomManager.js lädt VOR
// main.js, wo `isMobile` erst gesetzt wird. Dadurch war isMobile beim Laden
// immer undefined -> VISION_RAYS dauerhaft 180 (Desktop), auch auf Mobile.
// Jetzt zur Laufzeit ermittelt, sodass Mobile wirklich nur 90 Rays castet
// (halbe Raycast-Kosten). __PERF.rays erlaubt Live-Tuning bei ?perf=1.
function _visionRays() {
  const ovr = window.__PERF && window.__PERF.rays;
  if (typeof ovr === 'number' && ovr > 0) return ovr;
  return (typeof isMobile !== 'undefined' && isMobile) ? VISION_RAYS_MOBILE : VISION_RAYS_DESKTOP;
}
const VISION_STEP = 6; // coarser = faster, still fine enough for walls
const VISION_WALL_BACKOFF = 0; // nicht vor der Wand zurückspringen
const VISION_PAD_EXPLORED = 20; // small overshoot so wall itself is revealed (~half tile)
const VISION_PAD_UI = 20; // spotlight overshoot (smaller = no see-through walls)
const VISION_PAD_ENEMY = 8; // enemy mask — tight to walls so enemies stay hidden behind cover

// Cached wall list — rebuilt when the obstacles group changes.
// Plus a spatial grid for fast point-in-wall lookup.
let _wallCache = null;
let _wallCacheVersion = -1;
let _wallGrid = null;
const WALL_GRID_CELL = 64;

function _buildWallCache() {
  // Combine obstacles + door group for wall cache (doors block vision when closed)
  const obstacleList = obstacles?.getChildren?.() || [];
  const scene = obstacles?.scene;
  const doorList = (scene && scene._doorGroup) ? scene._doorGroup.getChildren() : [];
  const list = obstacleList.concat(doorList);
  _wallCache = [];
  _wallGrid = new Map();
  for (let i = 0; i < list.length; i++) {
    const go = list[i];
    if (!go || !go.texture) continue;
    const key = go.texture.key;
    const isDoor = go.getData && go.getData('isDoor') && go.getData('doorState') === 'closed';
    const isWall = key === 'obstacleWall' || (typeof key === 'string' && key.startsWith('wall_'));
    if (!isWall && !isDoor) continue;
    const b = go.body;
    if (!b || !b.enable) continue;
    // Phaser body bounds: use position + size directly, no getBounds call
    const r = {
      x: b.x, y: b.y,
      width: b.width || 32, height: b.height || 32,
      right: b.x + (b.width || 32),
      bottom: b.y + (b.height || 32),
      contains: function (px, py) {
        return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
      }
    };
    const wall = { go, body: b, rect: r };
    _wallCache.push(wall);
    // Bucket by grid cells
    const gx0 = Math.floor(r.x / WALL_GRID_CELL);
    const gy0 = Math.floor(r.y / WALL_GRID_CELL);
    const gx1 = Math.floor((r.x + r.width) / WALL_GRID_CELL);
    const gy1 = Math.floor((r.y + r.height) / WALL_GRID_CELL);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const k = gx + '|' + gy;
        let bucket = _wallGrid.get(k);
        if (!bucket) { bucket = []; _wallGrid.set(k, bucket); }
        bucket.push(wall);
      }
    }
  }
  _wallCacheVersion = obstacles?._walls_version || 0;
}

function invalidateWallCache() {
  _wallCache = null;
  _wallGrid = null;
  if (obstacles) obstacles._walls_version = (obstacles._walls_version || 0) + 1;
  // #70: Sicht-Geometrie hat sich geaendert (Tuer, zerstoerter Prop) -> naechsten
  // Fog-Tick erzwingen, damit das Sichtfeld nicht bis zu fogSkipInterval Frames
  // hinterherhinkt (Tuer-Oeffnen fuehlte sich traege an).
  _forceFogTick = true;
}

function isBlockedByObstacle(x, y) {
  if (!_wallCache || _wallCacheVersion !== (obstacles?._walls_version || 0)) {
    _buildWallCache();
  }
  const gx = Math.floor(x / WALL_GRID_CELL);
  const gy = Math.floor(y / WALL_GRID_CELL);
  const bucket = _wallGrid.get(gx + '|' + gy);
  if (!bucket) return false;
  for (let i = 0; i < bucket.length; i++) {
    const w = bucket[i];
    if (!w.body.enable) continue;
    if (w.rect.contains(x, y)) return true;
  }
  return false;
}
window.invalidateWallCache = invalidateWallCache;
// #70: Erzwingt EINEN sofortigen Fog-Tick (bypass Skip-Intervall) — fuer Systeme,
// die die Sicht aendern, ohne den Wand-Cache zu invalidieren.
window.forceFogUpdate = function () { _forceFogTick = true; };

const VISION_MIN_RADIUS = 0; // No artificial minimum — walls block immediately

function computeVisionPolygon(scene, ox, oy) {
  const pts = [];
  const VISION_RAYS = _visionRays();
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
        // Mindest-Sichtradius erzwingen, damit Vision an Wänden nicht klippt
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
// Charakter-Clearance für die Begehbarkeits-/Spawn-Prüfung (Body ~34x56px).
// >16 (halbe Tile) sorgt dafür, dass 1-Tile-Korridore (32px) als unpassierbar
// gelten und mind. 2-Tile-Breite/Höhe verlangt wird (User-Wunsch).
const CHAR_CLEAR_HALF_W = 17;
const CHAR_CLEAR_HALF_H = 28;
const ROOM_SPAWN_PAD = 0;
const ACCESS_GRID_SIZE = 32;
const MIN_PLAYER_SPAWN_DISTANCE = 160;

/**
 * Debug: erzwungener Generator-Stil aus ?room=cave|bsp, sonst null.
 *
 * Getrennt von der Vorlagen-Auswahl, weil beides unter demselben Schalter
 * liegt: 'cave'/'bsp' sind keine Vorlagennamen, sondern Generatoren.
 */
function _debugRaumStil() {
  try {
    var v = window.DebugGate && window.DebugGate.flagge('room');
    if (!v) return null;
    v = String(v).toLowerCase();
    return (v === 'cave' || v === 'bsp') ? v : null;
  } catch (e) { return null; }
}

/**
 * Debug: erzwungene Vorlagenfolge aus ?room=<Name> oder ?rooms=a,b,c.
 *
 * Namen werden ohne Ruecksicht auf Gross-/Kleinschreibung aufgeloest — beim
 * Tippen in die Adresszeile will niemand 'PrisonDepths' buchstabengetreu
 * treffen. Unbekannte Namen werden mit der Liste auf der Konsole benannt
 * statt still verworfen.
 *
 * @param {Array<string>} allNames alle bekannten Vorlagen
 * @returns {Array<string>|null}
 */
function _debugRaumFolge(allNames) {
  try {
    var G = window.DebugGate;
    if (!G || !G.aktiv()) return null;
    var roh = G.flagge('rooms') || G.flagge('room');
    if (!roh) return null;
    var karte = {};
    (allNames || []).forEach(function (n) { karte[String(n).toLowerCase()] = n; });
    var gewuenscht = String(roh).split(',');
    var folge = [], unbekannt = [];
    gewuenscht.forEach(function (w) {
      var k = String(w).trim().toLowerCase();
      if (!k) return;
      if (k === 'cave' || k === 'bsp') return;   // Stil, keine Vorlage
      if (karte[k]) folge.push(karte[k]); else unbekannt.push(w);
    });
    if (unbekannt.length && typeof console !== 'undefined' && console.warn) {
      console.warn('[Raumtypen] unbekannt: ' + unbekannt.join(', ')
        + ' — bekannt sind: ' + (allNames || []).join(', '));
    }
    return folge.length ? folge : null;
  } catch (e) { return null; }
}

function isSpawnPositionBlocked(px, py, halfSize = ROOM_SPAWN_HALF_SIZE) {
  if (!obstacles || typeof obstacles.getChildren !== "function") return false;
  if (!Phaser || !Phaser.Geom || !Phaser.Geom.Rectangle) return false;

  // Check against the procedural room wall grid (if available).
  // Charakter-Clearance: nicht nur die Mitte-Tile prüfen, sondern den ganzen
  // Charakter-Footprint (~34x56px, Halb-Extents unten). Sonst gelten 1-Tile-
  // Engstellen (v.a. in Cavern-Generator-Räumen) fälschlich als begehbar,
  // obwohl der Charakter (breiter/höher als 1 Tile=32px) nicht durchpasst.
  // 3x3 Sample-Punkte des Footprints: blockt 1-Tile-Korridore, lässt 2-Tile zu.
  const scene = obstacles.scene;
  const wallsGrid = scene?._minimapWallsGrid;
  if (wallsGrid && wallsGrid.length > 0) {
    const tileSize = scene._minimapTileSize || 32;
    const cols = wallsGrid[0]?.length || 0;
    const sx = [px - CHAR_CLEAR_HALF_W, px, px + CHAR_CLEAR_HALF_W];
    const sy = [py - CHAR_CLEAR_HALF_H, py, py + CHAR_CLEAR_HALF_H];
    for (let i = 0; i < sx.length; i++) {
      for (let j = 0; j < sy.length; j++) {
        const tx = Math.floor(sx[i] / tileSize);
        const ty = Math.floor(sy[j] / tileSize);
        if (ty < 0 || ty >= wallsGrid.length || tx < 0 || tx >= cols) {
          return true; // Footprint ragt aus dem Grid -> blockiert
        }
        if (wallsGrid[ty]?.[tx] !== '.') {
          return true; // Footprint berührt eine Wand -> blockiert
        }
      }
    }
  }

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

// Begehbare (erreichbare) Fläche eines Raums in px² — Basis für die
// flächen-basierte Gegnerzahl (Variante A). Bevorzugt den Flood-Fill der
// erreichbaren Zellen (schliesst Wände, Hindernisse UND unerreichbare Taschen
// aus); fällt sonst auf Floor-Tiles ('.') zurück, sonst 0 (Caller nutzt dann
// den Tiefen-Fallback). Cached in window.__WALKABLE_AREA_PX__.
function computeWalkableAreaPx(scene) {
  var areaPx = 0;
  try {
    var a = scene && scene._accessibleArea;
    if (a && Array.isArray(a.reachableCells) && a.reachableCells.length && a.cellSize) {
      areaPx = a.reachableCells.length * a.cellSize * a.cellSize;
    }
  } catch (e) {}
  if (!areaPx) {
    try {
      var grid = scene && scene._minimapWallsGrid;
      var T = (scene && scene._minimapTileSize) || 32;
      if (grid && grid.length) {
        // Count any non-wall, non-empty tile as floor — some authored rooms
        // (e.g. TerracedHall) paint the interior with an ornate-floor char
        // like '+' instead of '.'. Only '#' (wall) and ' ' (void) are excluded
        // so the fallback area estimate isn't wildly undercounted for them.
        var floor = 0;
        for (var y = 0; y < grid.length; y++) {
          var row = grid[y]; if (!row) continue;
          for (var x = 0; x < row.length; x++) {
            var c = row[x];
            if (c && c !== '#' && c !== ' ') floor++;
          }
        }
        if (floor > 0) areaPx = floor * T * T;
      }
    } catch (e2) {}
  }
  if (areaPx > 0) window.__WALKABLE_AREA_PX__ = areaPx;
  return areaPx;
}
window.computeWalkableAreaPx = computeWalkableAreaPx;

// Ist der Weltpunkt (x,y) im begehbaren Grid? (#57) Der Access-Grid (an den
// Physik-Bounds ausgerichtet) und das Raum-Tile-Raster (am Raum-Origin) müssen
// nicht deckungsgleich sein — ein legitimer Spieler-Spawn-Mittelpunkt kann so
// auf eine knapp danebenliegende, wegen Wand-Clearance geblockte Zelle mappen
// und fälschlich `false` liefern. Fix: die direkte Zelle UND — bei Sub-Zellen-
// Offset — die Nachbarn in Richtung des nächsten Zellrands prüfen (max. ~1
// Zelle Toleranz, gerichtet, um Falsch-Positive gering zu halten).
function pointAccessibleInGrid(grid, x, y) {
  if (!grid) return true;
  const cs = grid.cellSize;
  const lx = x - grid.bounds.x, ly = y - grid.bounds.y;
  const cx = Math.floor(lx / cs), cy = Math.floor(ly / cs);
  const vis = (ax, ay) => ax >= 0 && ay >= 0 && ax < grid.cols && ay < grid.rows
    && grid.visited.has(`${ax}|${ay}`);
  if (vis(cx, cy)) return true;
  const sx = (lx / cs - cx) < 0.5 ? -1 : 1;   // Richtung zum nächsten Rand
  const sy = (ly / cs - cy) < 0.5 ? -1 : 1;
  return vis(cx + sx, cy) || vis(cx, cy + sy) || vis(cx + sx, cy + sy);
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

  // Prefer room entry point as flood-fill seed (guaranteed floor tile)
  const seedX = scene._roomEntryPoint?.x ?? activePlayer.x;
  const seedY = scene._roomEntryPoint?.y ?? activePlayer.y;
  let startCX = Phaser.Math.Clamp(Math.floor((seedX - bounds.x) / cellSize), 0, cols - 1);
  let startCY = Phaser.Math.Clamp(Math.floor((seedY - bounds.y) / cellSize), 0, rows - 1);

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

    // Check wall adjacency — prefer interior cells for spawning
    let adjacentToWall = false;
    for (let adx = -1; adx <= 1 && !adjacentToWall; adx++) {
      for (let ady = -1; ady <= 1 && !adjacentToWall; ady++) {
        if (adx === 0 && ady === 0) continue;
        if (isBlocked(cx + adx, cy + ady)) adjacentToWall = true;
      }
    }

    const dx = centerX - activePlayer.x;
    const dy = centerY - activePlayer.y;
    if (dx * dx + dy * dy >= minDistSq && !adjacentToWall) {
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
    return pointAccessibleInGrid(scene._accessibleArea, x, y);
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
window.pointAccessibleInGrid = pointAccessibleInGrid;   // #57 (rein/testbar)
if (typeof module !== 'undefined' && module.exports) module.exports.pointAccessibleInGrid = pointAccessibleInGrid;

/**
 * Update room counter HUD text.
 * Called from enterRoom. The actual text element is created in main.js.
 */
function updateRoomCounter(roomIndex, totalRooms) {
  const _roomLabel = _ROOM_T('room.counter', { cur: (roomIndex + 1), total: totalRooms });
  if (window._roomCounterText && window._roomCounterText.setText) {
    window._roomCounterText.setText(_roomLabel);
  }
  window.roomProgressText = _roomLabel;
  // #49: Daten für den segmentierten Fortschrittsbalken publizieren + neu zeichnen.
  window._roomProgress = { cur: (roomIndex + 1), total: totalRooms };
  if (typeof window._drawRoomProgress === 'function') {
    try { window._drawRoomProgress(); } catch (e) { /* visual only */ }
  }
}

// Per-run state for the Elara Q5 cellar encounter. Reset by initDungeonRun.
//   _elaraDocSpawnTarget    — roomId where the council document will spawn
//                             (rolled to currentRoomId + 3..5 once the player
//                             has accepted Q5; re-rolled if the player passes
//                             the target without picking it up).
//   _elaraStage2SpawnTarget — roomId where Elara reappears for turn-in
//                             (same rolling rule once Q5 is ready-to-complete).
let _elaraDocSpawnTarget = null;
let _elaraStage2SpawnTarget = null;

function _resetElaraEncounterRunState() {
  _elaraDocSpawnTarget = null;
  _elaraStage2SpawnTarget = null;
}

function _rollDistance() {
  // 3..5 inclusive
  return 3 + Math.floor(Math.random() * 3);
}

// Three-stage Rathauskeller Elara encounter — Elara stays underground for
// the entire Akt-1 chain. Both Q5 offer and Q5 turn-in are physical NPC
// interactions in the dungeon (sprite + [E] prompt), never hub dialog.
//
// State machine (driven by quest state, not local flags):
//
//   Stage 1 — Offer:
//     Q1 done, Q5 not active/completed, elaraMet flag not set.
//     Spawn Elara sprite in the current room (roomId >= 2).
//     E → dialog → setFlag('elaraMet') + acceptQuest('widerstand_proof').
//
//   Stage 1.5 — Document drop:
//     Q5 active, document not yet picked up.
//     Roll target room = currentRoomId + 3..5 the first time we see this
//     state, then on each enterRoom check if currentRoomId == target →
//     spawn the council document loot in that room. After spawn, latched
//     for the rest of the run so we never double-drop.
//
//   Stage 2 — Turn-in:
//     Q5 ready-to-complete (player picked up the document), not done.
//     Roll target room = currentRoomId + 3..5 the first time we see this
//     state, then on each enterRoom check if currentRoomId == target →
//     spawn Elara sprite again. E → dialog → completeQuest, granting Q5
//     rewards and unlocking Q6 at Harren.
// Feature 055: startet eine Espionage-Mission, wenn der gerade gebaute Raum
// espionage-Metadaten (guards/cover/observe in TILE-Koords) trägt UND eine
// aktive Quest ein passendes (noch offenes) observe-Objective hat. Konvertiert
// die Zonen-Koords aus Tiles in Welt-Pixel (origin + tile*T) und übergibt sie
// an EspionageSystem.startMission; aktiviert die Verkleidung automatisch.
// #54-Test: Debug-Schalter via URL ?spy=1 — erzwingt einen Spionage-Raum als
// ersten Dungeon-Raum und startet die Mission OHNE aktive Quest (nur zum Testen
// der Spionage-UI). Im Normalbetrieb (kein ?spy=1) komplett inaktiv.
function _forceEspionageDebug() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__FORCE_ESPIONAGE__) return true;
    return !!(window.DebugGate && window.DebugGate.an('spy'));            // #88
  } catch (e) { return false; }
}

function _maybeStartEspionage(scene, templateName, builtMeta) {
  try {
    if (!templateName || !window.EspionageSystem || !window.RoomTemplates) return;
    var tpl = window.RoomTemplates.TEMPLATES && window.RoomTemplates.TEMPLATES[templateName];
    var esp = tpl && tpl.espionage;
    if (!esp) return;

    // Aktive Quest mit offenem observe-Objective für eine Zone dieses Raums?
    var targets = (esp.observe || []).map(function (z) { return z.questTarget; });
    var active = (window.questSystem && typeof window.questSystem.getActiveQuests === 'function')
      ? window.questSystem.getActiveQuests() : [];
    var match = active.some(function (q) {
      return (q.objectives || []).some(function (o) {
        return o.type === 'observe' && targets.indexOf(o.target) !== -1
          && (o.current || 0) < (o.required || 1);
      });
    });
    if (!match && !_forceEspionageDebug()) return;  // #54-Test: ?spy=1 umgeht das Quest-Gating

    var T = (tpl.size && tpl.size.tile) || 32;
    var ox = (builtMeta && builtMeta.origin && builtMeta.origin.x) || 0;
    var oy = (builtMeta && builtMeta.origin && builtMeta.origin.y) || 0;
    var toWorld = function (z, hasWH) {
      var out = { x: ox + (z.x || 0) * T, y: oy + (z.y || 0) * T };
      if (z.range != null) out.range = z.range;       // bereits in Px
      if (z.r != null) out.r = z.r;                   // bereits in Px
      if (z.seconds != null) out.seconds = z.seconds;
      if (z.id != null) out.id = z.id;
      if (z.questTarget != null) out.questTarget = z.questTarget;
      if (hasWH) { out.w = (z.w || 0) * T; out.h = (z.h || 0) * T; }
      // #54: Wachen-Parameter (Sichtkegel + Patrouille) durchreichen.
      if (z.facing != null) out.facing = z.facing;            // rad
      if (z.halfAngle != null) out.halfAngle = z.halfAngle;   // rad
      if (z.speed != null) out.speed = z.speed;               // px/s
      if (z.scanArc != null) out.scanArc = z.scanArc;         // rad
      if (z.pause != null) out.pause = z.pause;               // s
      if (z.alert != null) out.alert = z.alert;               // Wachen-Typ (durchschaut Verkleidung)
      if (z.seesThroughDisguise != null) out.alert = z.seesThroughDisguise;
      if (z.patrol && z.patrol.length) {
        out.patrol = z.patrol.map(function (w) { return { x: ox + (w.x || 0) * T, y: oy + (w.y || 0) * T }; });
      }
      return out;
    };

    // Wand-/Hindernis-Gitter für die Wachen-Kollision (damit sie beim Jagen
    // nicht durch Wände laufen). '#'-Tiles + Auto-Hindernis-Objekte blockieren.
    var wallRows = (tpl.layout && tpl.layout.walls) || [];
    var blockedTiles = {};
    (tpl.objects || []).forEach(function (o) {
      if (!o) return;
      var ty = o.type;
      if (ty === 'altar' || ty === 'brazier' || ty === 'brazer' || ty === 'statue'
          || ty === 'pillar' || ty === 'pillar_small' || ty === 'pillar_large') {
        blockedTiles[(o.x || 0) + ',' + (o.y || 0)] = true;
      }
    });
    var blockedAt = function (wx, wy) {
      var tx = Math.floor((wx - ox) / T), ty = Math.floor((wy - oy) / T);
      if (ty < 0 || ty >= wallRows.length) return true;
      var row = wallRows[ty];
      if (!row || tx < 0 || tx >= row.length) return true;
      if (row.charAt(tx) === '#') return true;
      return !!blockedTiles[tx + ',' + ty];
    };

    window.EspionageSystem.startMission(scene, {
      missionId: templateName,
      guards: (esp.guards || []).map(function (g) { return toWorld(g, false); }),
      cover: (esp.cover || []).map(function (c) { return toWorld(c, true); }),
      observeZones: (esp.observe || []).map(function (o) { return toWorld(o, false); }),
      blockedAt: blockedAt
    });
    window.EspionageSystem.setDisguise(true); // Auto-Verkleidung bei Mission-Start
    try { console.log('[055] Espionage-Mission gestartet:', templateName); } catch (_) {}
  } catch (e) {
    try { console.warn('[055] _maybeStartEspionage failed', e); } catch (_) {}
  }
}

function _maybeFireElaraCellarEncounter(scene, roomId) {
  if (!scene || !window.questSystem || !window.EventSystem) return;
  if (typeof roomId !== 'number' || roomId < 2) return;
  const qs = window.questSystem;
  if (typeof qs.hasFlag !== 'function') return;

  const completed = (typeof qs.getCompletedQuests === 'function') ? qs.getCompletedQuests() : [];
  const completedIds = new Set((completed || []).map(function (q) { return q && q.id; }).filter(Boolean));
  const q1Done = completedIds.has('harren_daughter_investigation');
  const q5Done = completedIds.has('widerstand_proof');
  if (!q1Done) return;

  // Stage 2: Q5 ready-to-complete → spawn Elara again for the turn-in.
  // If the player passes the target room without interacting, we re-roll
  // a fresh target (currentRoomId + 3..5) so she's always somewhere ahead
  // — never permanently behind the player.
  if (!q5Done && typeof qs.isQuestReadyToComplete === 'function'
      && qs.isQuestReadyToComplete('widerstand_proof')) {
    if (_elaraStage2SpawnTarget === null || roomId > _elaraStage2SpawnTarget) {
      _elaraStage2SpawnTarget = roomId + _rollDistance();
    }
    if (roomId === _elaraStage2SpawnTarget) {
      _spawnElaraSprite(scene, /* stage */ 2);
    }
    return;
  }

  // Stage 1.5: Q5 active, waiting for document → spawn document in the
  // target room. Same re-roll-on-overshoot pattern as Stage 2 — if the
  // player wanders into the target room and leaves without picking the
  // document up (lootGroup is cleared between rooms), they get another
  // chance a few rooms later.
  const q5Active = (typeof qs.getActiveQuests === 'function')
    && qs.getActiveQuests().some(function (q) { return q && q.id === 'widerstand_proof'; });
  if (q5Active && !q5Done) {
    if (_elaraDocSpawnTarget === null || roomId > _elaraDocSpawnTarget) {
      _elaraDocSpawnTarget = roomId + _rollDistance();
    }
    if (roomId === _elaraDocSpawnTarget) {
      _spawnCouncilDocument(scene);
    }
    return;
  }

  // Stage 1: Q1 done, Q5 not yet active, !elaraMet → spawn Elara for the offer
  if (qs.hasFlag('elaraMet')) return;
  if (q5Done) return;
  _spawnElaraSprite(scene, /* stage */ 1);
}

// Spawn Elara as an interactive [E]-prompt sprite in the current room.
// `stage` selects which dialog to show on interact: 1 = offer, 2 = turn-in.
function _spawnElaraSprite(scene, stage) {
  if (!scene || !window.EventSystem || typeof window.EventSystem.spawnEventObject !== 'function') return;
  const isEn = (window.i18n && typeof window.i18n.getLang === 'function' && window.i18n.getLang() === 'en');
  const promptLabel = isEn ? 'Elara' : 'Elara';
  // Subtle violet glow to match the Widerstand-faction colour key.
  // Scale 0.16 mirrors the hub-layout entry — the source PNG is full-res
  // (1536x1024-ish) and renders gigantic at 1:1 without it.
  window.EventSystem.spawnEventObject(scene, 'elara_right0', 0xffffff, 0x8866cc, promptLabel, function () {
    _showElaraDialog(scene, stage);
  }, { scale: 0.16 });
}

function _showElaraDialog(scene, stage) {
  if (!scene || !window.EventSystem || typeof window.EventSystem.showEventChoiceDialog !== 'function') return;
  const qs = window.questSystem;
  const isEn = (window.i18n && typeof window.i18n.getLang === 'function' && window.i18n.getLang() === 'en');
  const btnContinueLabel = isEn ? 'Continue' : 'Weiter';

  let text;
  let onContinue;
  if (stage === 2) {
    text = isEn
      ? '"You found it." Elara takes the document, traces the three seals with one finger. Magistrate. Clergy. Guard.\n\n"Three signatures that should never share a page. They claim to be rivals — behind closed doors they agree. Bring this to Father. He has been waiting for the moment you understand."'
      : '"Du hast es gefunden." Elara nimmt das Dokument, fährt mit einem Finger über die drei Siegel. Magistrat. Klerus. Garde.\n\n"Drei Unterschriften, die nie auf einer Seite stehen sollten. Sie behaupten Rivalen zu sein — hinter verschlossenen Türen stimmen sie überein. Bring das zu Vater. Er wartet darauf, dass du verstehst."';
    onContinue = function () {
      if (qs && typeof qs.completeQuest === 'function') qs.completeQuest('widerstand_proof');
    };
  } else {
    text = isEn
      ? '"You. The Archivesmith. So Father did send someone."\n\nElara — Harren\'s daughter, alive — leans against the chamber wall.\n\n"I am not coming back. Not yet. Down here lies a document, sealed by all three Council factions. They would never sign such a thing in the open — and yet. Bring it to me when you find it."'
      : '"Du. Der Archivschmied. Vater hat also doch jemanden geschickt."\n\nElara — Harrens Tochter, lebendig — lehnt an der Kammerwand.\n\n"Ich komme nicht zurück. Noch nicht. Unten liegt ein Dokument, versiegelt von allen drei Ratsfraktionen. Öffentlich würden sie so etwas nie unterzeichnen — und doch. Bring es mir, sobald du es findest."';
    onContinue = function () {
      if (!qs) return;
      if (typeof qs.setFlag === 'function') qs.setFlag('elaraMet', true);
      if (typeof qs.acceptQuest === 'function') qs.acceptQuest('widerstand_proof');
    };
  }
  window.EventSystem.showEventChoiceDialog(scene, text, [{
    label: btnContinueLabel,
    callback: onContinue
  }]);
}

// Spawn the council document as a quest-item loot drop in the current room.
// Mirrors the questItem branch of LootSystem.spawnLoot but bypasses the
// per-kill RNG — this is a deterministic, story-placed item.
function _spawnCouncilDocument(scene) {
  if (!scene || !scene.add) return;
  const lg = window.lootGroup || (typeof lootGroup !== 'undefined' ? lootGroup : null);
  if (!lg) return;
  const _T = (key, fb) => (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : (fb || key);

  // Pick a walkable spawn point near the player
  let x = 0, y = 0;
  if (typeof scene.pickAccessibleSpawnPoint === 'function') {
    const spot = scene.pickAccessibleSpawnPoint({ maxAttempts: 24 });
    if (spot) { x = spot.x; y = spot.y; }
  }
  if (!x && !y && typeof player !== 'undefined' && player) {
    x = player.x + 60;
    y = player.y;
  }

  const questItem = {
    type: 'quest_item',
    key: 'COUNCIL_DOCUMENT',
    name: _T('loot.quest_item.COUNCIL_DOCUMENT', 'Ratsdokument'),
    nameKey: 'loot.quest_item.COUNCIL_DOCUMENT',
    iconKey: 'itMat',
    isQuestItem: true,
    questTarget: 'council_document'
  };
  const sprite = lg.create(x, y, questItem.iconKey || 'itMat');
  sprite.setDisplaySize(28, 22);
  sprite.setData('item', questItem);
  sprite.setData('questItem', true);
  sprite.setDepth(80);
  sprite.setTint(0xcc88dd);
  if (typeof window.trackLootSprite === 'function') {
    window.trackLootSprite(scene, sprite);
  } else if (typeof scene._activeLootSprites !== 'undefined' && Array.isArray(scene._activeLootSprites)) {
    scene._activeLootSprites.push(sprite);
  }
}

// Export in globalen Namespace
window.createRooms = createRooms;
window.enterRoom = enterRoom;
window.markRoomCleared = markRoomCleared;
// Feature 061: nur den "Raum gecleart"-Flavor-Toast zeigen (ohne erneut zu
// unlocken/beloohnen) — für Spezialräume, deren Ziel schon erfüllt war und die
// jetzt WIRKLICH leergeräumt sind. Einmal pro Raum.
window.showRoomClearedToast = function () {
  try {
    const room = rooms[currentRoomId];
    if (room && room._clearedToastShown) return;
    if (room) room._clearedToastShown = true;
    _showRoomClearedToast(obstacles.scene);
  } catch (e) { /* ignore */ }
};
window.lockStairs = lockStairs;
window.rooms = () => rooms;
window.currentRoomId = () => currentRoomId;
window.initDungeonRun = initDungeonRun;
window.updateRoomCounter = updateRoomCounter;
window.shouldPlaceRunAmuletHere = shouldPlaceRunAmuletHere;   // #120 (rein/testbar)
window.RUN_AMULET_MIN_ROOM = RUN_AMULET_MIN_ROOM;
// Nur zum Testen exportiert: belegt, dass die Raumregel wirklich VERDRAHTET ist
// und die Vormerkung bis zum passenden Raum stehen bleibt (#120).
window._maybeSpawnRunAmulet = _maybeSpawnRunAmulet;
