// Centralised persistence registry. Documents every localStorage key the game
// uses + exposes a single clearAllSaves() helper so "new game" wipes EVERY
// piece of state in one place (instead of forcing each subsystem to remember).
//
// New code should reference Persistence.KEYS rather than hard-coding strings.

(function () {
  const KEYS = Object.freeze({
    /**
     * Main save game (player stats, inventory, equipment, room progress).
     * WP03: also carries `materials.GOLD` (player gold counter). Gold lives
     * inside the existing `materials` map that storage.js already round-trips,
     * so no new localStorage key is needed. Old saves without `materials.GOLD`
     * default to 0 via `LootSystem.getGold` on first read.
     */
    SAVE: 'demonfall_save_v1',
    /** Learned abilities + active loadout + cooldowns. */
    ABILITIES: 'demonfall_abilities_v1',
    /** UI/audio settings + debug toggles. */
    SETTINGS: 'demonfall_settings_v1',
    /** Legacy audio-only key written by SoundManager pre-SettingsScene. */
    AUDIO_LEGACY: 'demonfall_audio',
    /** Last selected dungeon difficulty multiplier. */
    LAST_DIFFICULTY: 'demonfall_lastDifficulty'
  });

  // Keys that should be wiped on "new game". SETTINGS is intentionally
  // preserved — players don't expect their volume to reset when they
  // start a new run.
  const NEW_GAME_WIPE_KEYS = [
    KEYS.SAVE,
    KEYS.ABILITIES,
    KEYS.LAST_DIFFICULTY
  ];

  function clearAllSaves() {
    NEW_GAME_WIPE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[Persistence] failed to remove', key, err);
      }
    });
  }

  // Wipe ABSOLUTELY everything (including settings + audio). Used by debug
  // tooling, never by the new-game flow.
  function clearEverything() {
    Object.values(KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('[Persistence] failed to remove', key, err);
      }
    });
  }

  function listAllKeys() {
    return Object.values(KEYS).slice();
  }

  window.Persistence = {
    KEYS,
    clearAllSaves,
    clearEverything,
    listAllKeys
  };
})();
