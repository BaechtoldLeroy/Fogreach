// Centralised game-state namespace.
//
// Goal: replace the ~40 unrelated window.* globals with a single typed
// namespace so it's clear which state is "live game state" vs which is
// "module API" or "framework constant".
//
// Migration is incremental — both the namespace AND the legacy globals
// stay in sync via a getter/setter facade. New code should read from
// window.GameState.*; old code can keep reading window.* until it's
// rewritten.
//
// Categories:
//   GameState.player    - hp, xp, level, position-related stats
//   GameState.inventory - item slots + equipped items + materials
//   GameState.run       - current room, dungeon depth, wave
//
// Public API: just bare properties for now. As we move logic over, we
// can introduce setters that fire events.

(function () {
  if (window.GameState) return;

  const state = {
    player: {
      // these will be migrated from the standalone playerHealth/playerXP/...
      // globals over time. For now they're a parallel mirror.
    },
    inventory: {
      // window.inventory and window.equipment stay authoritative for now
    },
    run: {
      // currentRoomId, currentWave, dungeon depth — currently bare globals
    }
  };

  // Sync helpers — call these whenever the legacy globals change so the
  // namespace stays accurate. As call sites are migrated, the legacy
  // globals can be removed and the sync becomes unnecessary.
  function syncFromGlobals() {
    state.player.hp        = window.playerHealth;
    state.player.maxHp     = window.playerMaxHealth;
    state.player.xp        = window.playerXP;
    state.player.level     = window.playerLevel;
    state.run.currentWave  = window.currentWave;
    state.run.currentRoomId = window.currentRoomId;
    state.run.dungeonDepth = window.DUNGEON_DEPTH;
    state.inventory.items     = window.inventory;
    state.inventory.equipment = window.equipment;
    state.inventory.materials = window.materialCounts;
  }

  // Schedule periodic syncing while we still have legacy globals.
  // (Cheap — runs at game tick frequency only when game.scene exists)
  if (typeof requestAnimationFrame !== 'undefined') {
    function tick() {
      syncFromGlobals();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.GameState = state;
  window.GameState._syncFromGlobals = syncFromGlobals;
})();
